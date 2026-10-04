/* ============ MOTEUR VOCAL : Vosk intégré + secours Google ============
   Port du moteur v11 (index.html @ c5bd8d1, blocs « MOTEUR VOCAL » et micTap) — CDC v11 §4 : NE PAS RÉGRESSER.
   Aucun accès à window/document au chargement du module (tout est dans les fonctions).

   VERBATIM v11 (copié ligne à ligne ; `state.running` → `running`, `state.finalTranscript` →
   `finalTranscript`, `ingest(...)` → `emit(...)` ; les gestionnaires de résultats gagnent seulement
   les lignes marquées pour resetTranscript : live, skipVosk, wsSkip) :
   - VOSK_LIB, MODEL_URL, ERR_MSG ;
   - loadScript ; getModelBlob (cache 'vosk-model-v1', progression, repli sur le réseau) ;
   - ensureVosk : promesse unique, test WebAssembly, messages de statut identiques,
     createModel(blobUrl) puis repli createModel(MODEL_URL) ;
   - startVoskEngine : getUserMedia { echoCancellation, noiseSuppression, channelCount: 1 },
     AudioContext({ sampleRate: 16000 }) + repli, resume(), KaldiRecognizer(sampleRate, grammar)
     + replis (sans grammaire, sans argument), on('result') / on('partialresult') qui cumulent
     finalTranscript comme la v11, ScriptProcessor(4096, 1, 1), gain 0 vers la destination ;
   - stopVoskEngine ; startWebSpeech (fr-FR, continu, résultats intermédiaires, relance onend après 200 ms) ;
     stopWebSpeech ;
   - choix du moteur de micTap() → startListening : Vosk si prêt ; NotAllowedError / SecurityError →
     'not-allowed' ; NotFoundError → 'audio-capture' ; toute autre erreur → arrêt de Vosk et secours Web Speech.

   GÉNÉRALISÉ (les seuls écarts) :
   - setVoiceStatus alimente un statut observable (onStatus / statusText) au lieu de #engine-status ;
   - la progression du téléchargement part vers les rappels onPct d'ensureVosk (v11 : #mic-label) ;
   - la grammaire est un paramètre : mots DÉJÀ normalisés par l'appelant (le moteur ajoute '[unk]'),
     ou null = reconnaissance libre ; v11 : mots de l'histoire normalisés ici ;
   - ingest(texte) devient le rappel onText(texteCumulé, final) ; les messages d'erreur vont à
     onError(code, message) au lieu de #mic-label ; showCompat → onError('unsupported', COMPAT_MSG).

   AJOUTS (appli à écrans, absents de la v11) : un double appui pendant le chargement partage le même
   démarrage ; stopListening() pendant le démarrage annule proprement (le micro ne s'ouvre pas en
   arrière-plan) ; resetTranscript() oublie aussi la phrase en cours (pour enchaîner des réponses courtes) ;
   statut « reconnaissance Google en secours » aussi quand Vosk est prêt mais ne démarre pas et que Web Speech prend
   le relais (l'espace parents le signale : la voix passe alors par les serveurs de Google) ; « chargement… » en
   points de suspension typographiques. Le choix du moteur ne change pas.

   RESTENT DANS LE JEU : wake lock, minuteur « je ne t’entends pas » (7 s), ligne 👂, libellés du micro,
   alignement mot à mot (tokenize, computeProper, FORGIVE, isMatch, levenshtein, pauses, joker [unk]). */

export const VOSK_LIB = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';
export const MODEL_URL = 'models/fr.tar.gz';
let voskModel = null, voskPromise = null, engine = null, webRecognition = null;
const audio = { ctx:null, stream:null, source:null, node:null, gain:null, recognizer:null };
let voskSettled = false;

/* état qui vivait dans `state` (v11) + destinataires du texte et des erreurs */
let running = false, finalTranscript = '';
let textCb = null, errCb = null;
let statut = '';
const statusFns = new Set(), pctFns = new Set();
/* démarrages : session++ à chaque arrêt (un démarrage d'une ancienne session s'annule) */
let session = 0, inflight = null;
/* resetTranscript au milieu d'une phrase : live = phrase en cours, skipVosk / wsSkip = ce qu'il faut ignorer */
let live = '', skipVosk = false, wsSkip = 0, wsLen = 0;

/* message de showCompat() v11, sans HTML */
export const COMPAT_MSG = 'Ce navigateur ne peut pas faire de reconnaissance vocale. Essaie avec Chrome à jour 😊';

function setVoiceStatus(txt){
  statut = txt;
  statusFns.forEach(fn => { try { fn(txt); } catch (_) {} });
}
function emit(text, isFinal){
  if(!textCb) return;
  try { textCb(text, isFinal); } catch (e) { console.error('speech onText', e); }
}
function fail(code, msg){
  if(!errCb) return;
  try { errCb(code, msg || ERR_MSG[code] || ''); } catch (e) { console.error('speech onError', e); }
}

function loadScript(src){
  return new Promise((res, rej)=>{
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = ()=>rej(new Error('script '+src));
    document.head.appendChild(s);
  });
}
async function getModelBlob(onPct){
  let cache = null;
  try{
    cache = await caches.open('vosk-model-v1');
    const hit = await cache.match(MODEL_URL);
    if(hit) return await hit.blob();
  }catch(_){}
  const resp = await fetch(MODEL_URL);
  if(!resp.ok) throw new Error('modele HTTP ' + resp.status);
  const total = +resp.headers.get('content-length') || 0;
  let blob;
  if(resp.body && total){
    const reader = resp.body.getReader();
    const chunks = []; let got = 0;
    for(;;){
      const {done, value} = await reader.read();
      if(done) break;
      chunks.push(value); got += value.length;
      onPct(Math.min(99, Math.round(100*got/total)));
    }
    blob = new Blob(chunks);
  } else {
    blob = await resp.blob();
  }
  if(cache){ try{ await cache.put(MODEL_URL, new Response(blob)); }catch(_){} }
  return blob;
}
/* onPct(p) : progression du premier téléchargement (0-99 %) ; plusieurs appelants possibles */
export function ensureVosk(onPct){
  if(typeof onPct === 'function' && !voskSettled) pctFns.add(onPct);
  voskPromise = voskPromise || (async ()=>{
    try{
      if(typeof WebAssembly !== 'object') throw new Error('pas de WASM');
      setVoiceStatus('🎙 Moteur vocal : chargement\u2026');
      await loadScript(VOSK_LIB);
      const blob = await getModelBlob(p=>{
        setVoiceStatus('🎙 Moteur vocal : téléchargement ' + p + ' % (1re fois seulement)');
        pctFns.forEach(fn => { try { fn(p); } catch (_) {} });
      });
      const blobUrl = URL.createObjectURL(blob);
      try{ voskModel = await Vosk.createModel(blobUrl); }
      catch(e1){ voskModel = await Vosk.createModel(MODEL_URL); }
      setVoiceStatus('🎙 Moteur vocal prêt ✓ — la voix reste sur l\u2019appareil');
      return true;
    }catch(err){
      console.error('Vosk indisponible :', err);
      setVoiceStatus('🎙 Moteur intégré indisponible → reconnaissance Google en secours');
      return false;
    }finally{
      voskSettled = true;
      pctFns.clear();
    }
  })();
  return voskPromise;
}

async function startVoskEngine(words){
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation:true, noiseSuppression:true, channelCount:1 }
  });
  audio.stream = stream;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  try{ audio.ctx = new Ctx({ sampleRate: 16000 }); }  /* fréquence native du modèle */
  catch(_){ audio.ctx = new Ctx(); }
  try{ await audio.ctx.resume(); }catch(_){}
  let rec;
  if(Array.isArray(words) && words.length){
    /* Grammaire : la reco ne connaît que les mots fournis (déjà normalisés par l'appelant) → précision maximale */
    const vocab = [...new Set(words.map(String))].filter(Boolean);
    const grammar = JSON.stringify(vocab.concat(['[unk]']));
    try{ rec = new voskModel.KaldiRecognizer(audio.ctx.sampleRate, grammar); }
    catch(e1){
      try{ rec = new voskModel.KaldiRecognizer(audio.ctx.sampleRate); }
      catch(e2){ rec = new voskModel.KaldiRecognizer(); }
    }
  } else {
    /* grammaire null : reconnaissance libre (modèle complet) */
    try{ rec = new voskModel.KaldiRecognizer(audio.ctx.sampleRate); }
    catch(e2){ rec = new voskModel.KaldiRecognizer(); }
  }
  audio.recognizer = rec;
  rec.on('result', (m)=>{
    if(!running) return;
    if(skipVosk){ skipVosk = false; live = ''; emit(finalTranscript, true); return; }   /* fin de la phrase oubliée */
    live = '';
    const t = (m && m.result && m.result.text) || '';
    if(t) finalTranscript += t + ' ';
    emit(finalTranscript, true);
  });
  rec.on('partialresult', (m)=>{
    if(!running) return;
    const p = (m && m.result && m.result.partial) || '';
    live = p;
    if(skipVosk){ emit(finalTranscript, false); return; }
    emit(finalTranscript + ' ' + p, false);
  });
  audio.source = audio.ctx.createMediaStreamSource(stream);
  audio.node = audio.ctx.createScriptProcessor(4096, 1, 1);
  audio.node.onaudioprocess = (e)=>{
    if(!running) return;
    try{ audio.recognizer.acceptWaveform(e.inputBuffer); }catch(_){}
  };
  audio.gain = audio.ctx.createGain();
  audio.gain.gain.value = 0;
  audio.source.connect(audio.node);
  audio.node.connect(audio.gain);
  audio.gain.connect(audio.ctx.destination);
}
function stopVoskEngine(){
  try{ if(audio.node){ audio.node.onaudioprocess = null; audio.node.disconnect(); } }catch(_){}
  try{ if(audio.source) audio.source.disconnect(); }catch(_){}
  try{ if(audio.gain) audio.gain.disconnect(); }catch(_){}
  try{ if(audio.recognizer && audio.recognizer.remove) audio.recognizer.remove(); }catch(_){}
  try{ if(audio.stream) audio.stream.getTracks().forEach(t=>t.stop()); }catch(_){}
  try{ if(audio.ctx) audio.ctx.close(); }catch(_){}
  audio.ctx = audio.stream = audio.source = audio.node = audio.gain = audio.recognizer = null;
}

export const ERR_MSG = {
  'not-allowed': 'Micro refusé 😕 Icône 🔒 à côté de l\u2019adresse → Micro → Autoriser, puis recharge.',
  'service-not-allowed': 'La reconnaissance est bloquée ici. Ouvre le lien directement dans Chrome.',
  'network': 'La reconnaissance a besoin d\u2019internet. Vérifie la connexion 📶',
  'audio-capture': 'Aucun micro détecté sur cet appareil 🎙️',
  'language-not-supported': 'Le français n\u2019est pas disponible sur ce navigateur.'
};
function startWebSpeech(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ fail('unsupported', COMPAT_MSG); return false; }
  webRecognition = new SR();
  webRecognition.lang = 'fr-FR';
  webRecognition.continuous = true;
  webRecognition.interimResults = true;
  webRecognition.onresult = (e)=>{
    let interim = '';
    for(let i=e.resultIndex; i<e.results.length; i++){
      if(i < wsSkip) continue;                         /* phrase oubliée par resetTranscript */
      if(e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' ';
      else interim += e.results[i][0].transcript + ' ';
    }
    wsLen = e.results.length;
    live = interim;
    emit(finalTranscript + ' ' + interim, !interim.trim());
  };
  webRecognition.onerror = (e)=>{
    const msg = ERR_MSG[e.error];
    if(msg) fail(e.error, msg);
  };
  webRecognition.onend = ()=>{
    wsSkip = wsLen = 0;                                /* une nouvelle session repart de l'indice 0 */
    if(running && engine === 'webspeech'){
      setTimeout(()=>{ try{ webRecognition.start(); }catch(_){} }, 200);
    }
  };
  try{ webRecognition.start(); }catch(_){ return false; }
  return true;
}
function stopWebSpeech(){
  if(webRecognition){ try{ webRecognition.stop(); }catch(_){} webRecognition = null; }
}

/* ---------- API généralisée ---------- */

/* micTap() v11 sans l'interface : choisit Vosk puis Web Speech */
async function begin(grammar, my){
  const voskOk = await ensureVosk();
  if(my !== session) return { engine: null };                 /* arrêté pendant le chargement */
  running = true;
  engine = null;
  finalTranscript = ''; live = ''; skipVosk = false; wsSkip = wsLen = 0;

  if(voskOk){
    try{
      await startVoskEngine(grammar);
      engine = 'vosk';
    }catch(err){
      if(my !== session){ stopVoskEngine(); return { engine: null }; }
      if(err && (err.name==='NotAllowedError' || err.name==='SecurityError')){
        running = false; fail('not-allowed'); return { engine: null };
      }
      if(err && err.name==='NotFoundError'){
        running = false; fail('audio-capture'); return { engine: null };
      }
      console.error('vosk start', err);
      stopVoskEngine();
    }
    if(my !== session){ stopVoskEngine(); engine = null; return { engine: null }; }   /* arrêté pendant getUserMedia */
  }
  if(!engine){
    if(startWebSpeech()) engine = 'webspeech';
    else { running = false; return { engine: null }; }
    /* AJOUT 2.2 : Vosk était prêt mais n'a pas démarré, Web Speech prend le relais → le statut le dit */
    if(voskOk) setVoiceStatus('🎙 Moteur intégré indisponible → reconnaissance Google en secours');
  }
  return { engine };
}

/* grammar : string[] de mots DÉJÀ normalisés (le moteur ajoute '[unk]') ; null (ou []) = reco libre.
   onText(texteCumulé, final) : à chaque résultat partiel ou final (finalTranscript + ' ' + partiel, comme v11).
   onError(code, message) : 'not-allowed' | 'audio-capture' | 'network' | 'service-not-allowed' |
     'language-not-supported' | 'unsupported' — message prêt à afficher (ERR_MSG v11).
   Déjà à l'écoute → { engine } sans redémarrer (pour changer de grammaire : stopListening() puis startListening()). */
export async function startListening({ grammar = null, onText = null, onError = null } = {}){
  textCb = typeof onText === 'function' ? onText : null;
  errCb = typeof onError === 'function' ? onError : null;
  for(;;){
    if(inflight && inflight.session === session) return inflight.promise;   /* double appui : même démarrage */
    if(!inflight) break;
    try{ await inflight.promise; }catch(_){}                                /* ancien démarrage annulé : il se nettoie */
  }
  if(running) return { engine };
  const my = session;
  const promise = begin(grammar, my).catch(err => {
    console.error('speech start', err);
    if(my === session){ running = false; stopVoskEngine(); stopWebSpeech(); engine = null; }
    return { engine: null };
  }).finally(() => { if(inflight && inflight.promise === promise) inflight = null; });
  inflight = { session: my, promise };
  return promise;
}

export function stopListening(){
  session++;
  running = false;
  stopWebSpeech();
  stopVoskEngine();
  engine = null;
  live = ''; skipVosk = false; wsSkip = wsLen = 0;
  textCb = errCb = null;
}

/* oublie tout ce qui a été entendu, y compris la fin de la phrase en cours */
export function resetTranscript(){
  finalTranscript = '';
  if(!running || !live.trim()) return;
  if(engine === 'vosk' && audio.recognizer){
    /* FinalResult clôt la phrase côté Kaldi : la suivante repart de zéro ; on ignore ce résultat-là */
    try{ audio.recognizer.retrieveFinalResult(); skipVosk = true; }catch(_){}
  } else if(engine === 'webspeech'){
    wsSkip = wsLen;
  }
  live = '';
}

export function isListening(){ return running; }

/* statut du moteur (« 🎙 Moteur vocal prêt ✓ … ») : fn reçoit le statut courant puis chaque changement */
export function onStatus(fn){
  if(typeof fn !== 'function') return () => {};
  statusFns.add(fn);
  try { fn(statut); } catch (_) {}
  return () => statusFns.delete(fn);
}
export function statusText(){ return statut; }

/* une reconnaissance est-elle possible ici ? (Vosk : WASM + micro ; sinon Web Speech) */
export function speechSupported(){
  try{
    const g = globalThis;
    const md = g.navigator && g.navigator.mediaDevices;
    const vosk = typeof WebAssembly === 'object' && !!(md && md.getUserMedia);
    return vosk || !!(g.SpeechRecognition || g.webkitSpeechRecognition);
  }catch(_){ return false; }
}
