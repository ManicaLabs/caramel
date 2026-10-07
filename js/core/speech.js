/* ============ MOTEUR VOCAL : Vosk intégré + secours Google ============
   Port du moteur v11 (index.html @ c5bd8d1, blocs « MOTEUR VOCAL » et micTap) — CDC v11 §4 : NE PAS RÉGRESSER.
   Aucun accès à window/document au chargement du module (tout est dans les fonctions).

   VERBATIM v11 (copié ligne à ligne ; `state.running` → `running`, `state.finalTranscript` →
   `finalTranscript`, `ingest(...)` → `emit(...)` ; les gestionnaires de résultats gagnent seulement
   les lignes marquées pour resetTranscript : live, cutN, wsSkip ; écarts 2.2.3 ci-dessous) :
   - VOSK_LIB, MODEL_URL, ERR_MSG ;
   - loadScript ; getModelBlob (cache 'vosk-model-v1', progression, repli sur le réseau) ;
   - ensureVosk : promesse unique, test WebAssembly, messages de statut identiques,
     (2.2.3 : modèle extrait sous une adresse fixe, puis) createModel(blobUrl) puis repli createModel(MODEL_URL) ;
   - startVoskEngine (2.2.3 : le micro dans openAudio) : getUserMedia { echoCancellation, noiseSuppression, channelCount: 1 },
     AudioContext({ sampleRate: 16000 }) + repli, resume(), KaldiRecognizer(sampleRate, grammar)
     + replis (sans grammaire, sans argument), on('result') / on('partialresult') qui cumulent
     finalTranscript comme la v11, ScriptProcessor(4096, 1, 1) (2.2.3 : en repli de l'AudioWorklet), gain 0 vers la destination ;
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
   arrière-plan) ; resetTranscript() oublie aussi le début de la phrase en cours (pour enchaîner des réponses courtes),
   sans jamais la couper (la couper net faisait reconnaître la fin d'un mot seule), et Web Speech oublie aussi les
   résultats finals déjà reçus ;
   un AudioContext du micro suspendu par le système (Android) est relancé aussitôt ;
   statut « reconnaissance Google en secours » aussi quand Vosk est prêt mais ne démarre pas et que Web Speech prend
   le relais (l'espace parents le signale : la voix passe alors par les serveurs de Google) ; « chargement… » en
   points de suspension typographiques. Le choix du moteur ne change pas.

   RESTENT DANS LE JEU : wake lock, minuteur « je ne t’entends pas » (7 s), ligne 👂, libellés du micro,
   alignement mot à mot (tokenize, computeProper, FORGIVE, isMatch, levenshtein, pauses, joker [unk]).

   v2.2.3 (retour terrain du 06/10/2026 : « le micro écoute, l'enfant parle et il se passe rien ; passé 3-4 étapes il a
   beaucoup de mal ») — mesuré sur le banc (enfant simulé, voix de synthèse dans un faux micro) :
   - MODÈLE EXTRAIT UNE FOIS (seedModel) : vosk-browser range le modèle extrait dans IndexedDB (IDBFS, base '/vosk') sous
     un chemin tiré de l'adresse donnée à createModel ; l'adresse blob: de la v11 changeait à chaque ouverture : extraction
     refaite, ≈ 54 Mo de plus dans le téléphone À CHAQUE ouverture (3 ouvertures = 206 Mo) et TOUTES les copies rechargées
     en mémoire au démarrage du micro. Désormais : adresse fixe (MODEL_URL absolue), archive du cache 'vosk-model-v1'
     déposée dans IDBFS comme si vosk-browser l'avait téléchargée (il l'extrait sans réseau), copies anciennes supprimées ;
     chargement borné dans le temps (openModel : la promesse de createModel ne finissait jamais si le chargement échouait :
     « Préparation du micro… » à vie) ;
   - SANTÉ DU MICRO (health / onHealth) : son reçu, niveau, voix, retard du moteur (requêtes en attente dans le worker de
     Vosk, qui traite chaque morceau dans l'ordre sans jamais en sauter) ; sur un téléphone lent (processeur bridé à 20 %),
     le retard montait à 28 s : plus rien ne se passait, et chaque relance du micro attendait derrière. Désormais, au-delà
     de ≈ 1 s de retard, les blancs ne sont plus envoyés (la voix toujours, avec 0,8 s de silence après pour finir la
     phrase) ; au-delà de ≈ 4 s, plus rien jusqu'au rattrapage. Micro muet (plus de son, ou des zéros : système, autre
     appli) → réouverture du micro seul (même reconnaisseur), 3 fois par minute au plus ; le jeu montre l'état (🎤 barré) ;
   - CAPTURE SUR LE FIL AUDIO (openWorklet, js/core/mic-worklet.js) : le ScriptProcessor de la v11 tourne sur le fil
     principal ; quand le jeu l'occupe, le navigateur perd des morceaux de son (fil principal occupé à 90 % : 1 réponse sur 8
     comprise, son haché ; 8 sur 8 sur le fil audio). Repli : le ScriptProcessor de la v11 (navigateur sans AudioWorklet) ;
   - resetTranscript : les mots DÉJÀ entendus de la phrase en cours sont oubliés, la suite est gardée (2.2.1 ignorait toute
     la phrase jusqu'au prochain silence : une réponse dite sans pause après la précédente était perdue) ;
   - prefetch() : tout télécharger et extraire à la première ouverture (demande du parent du 06/10/2026), sans garder Vosk
     en mémoire ; modelReady() ;
   - journal de diagnostic (js/core/debuglog.js, si un parent l'a activé) : chargement, écoute, santé, textes entendus. */

import { dlog } from './debuglog.js';

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
/* resetTranscript au milieu d'une phrase : live = phrase en cours (Vosk : le résultat partiel entier), cutN = nombre de ses
   mots déjà entendus au moment de l'oubli (2.2.3), wsSkip = résultats Web Speech à ignorer */
let live = '', cutN = 0, wsSkip = 0, wsLen = 0;

/* ---------- 2.2.3 : réglages de la santé du micro (mesurés sur le banc, cf. en-tête) ---------- */
export const TUNING = Object.freeze({
  chunkMs: 256,          /* un morceau de son : 4096 échantillons à 16 kHz */
  softPending: 4,        /* ≈ 1 s de son en attente dans le worker : les blancs ne sont plus envoyés */
  hardPending: 16,       /* ≈ 4 s : plus rien n'est envoyé jusqu'au rattrapage (softPending) */
  hangMs: 800,           /* après la voix, encore 0,8 s de blanc : Vosk termine la phrase */
  voiceMin: 0.006,       /* RMS minimal d'une voix (après le gain automatique du navigateur) */
  voiceRatio: 2.5,       /* voix = RMS > 2,5 × bruit de fond */
  slowMs: 2500,          /* retard au-delà duquel le moteur est « lent » */
  deafMs: 2000,          /* plus aucun son du micro depuis 2 s, page visible : micro « sourd » → réouverture */
  zeroMs: 4000,          /* 4 s de zéros numériques : micro pris par le système ou une autre appli → réouverture */
  reopenMax: 3,          /* réouvertures par minute ; au-delà, l'état « sourd » reste (le jeu le montre) */
  tickMs: 250,           /* vérification de la santé (et niveau pour l'oreille 👂 du jeu) */
  logEvery: 8            /* journal : une ligne de santé toutes les 8 vérifications (2 s) */
});
/* chargement du modèle : depuis l'extraction déjà faite / avec extraction (téléphone lent : jusqu'à 1 min mesurée bridé) */
export const LOAD_MS = Object.freeze({ ready: 60000, extract: 240000 });
/* IDBFS d'Emscripten dans vosk-browser 0.0.8 (base, magasin, version, modes POSIX d'un dossier et d'un fichier) */
export const IDB = Object.freeze({ name: '/vosk', store: 'FILE_DATA', version: 21, dirMode: 16877, fileMode: 33206 });
const LIB_CACHE = 'vosk-lib-v1';

const q = { sent: 0, done: 0 };         /* file du worker de Vosk : requêtes envoyées (son, fin de phrase, retrait) / réponses */
let hl = freshHealth(), tick = 0, reopenP = null, libP = null, prefetchP = null, visBound = false;
let keepVoice = false;                   /* startListening({ keepVoice }) : la voix n'est jamais écartée (la course : un mot perdu compte faux) */
const healthFns = new Set();
let snap = Object.freeze({ state: 'off', engine: null, level: 0, voice: false, lagMs: 0, pending: 0, dropped: 0, audioAgeMs: 0, reopens: 0 });
function freshHealth(){
  return { audioAt: Date.now(), chunks: 0, sentChunks: 0, level: 0, floor: 0.01, voicedAt: 0, zeroSince: 0, dropped: 0, held: null,
    catchup: false, reopens: [], ticks: 0, lastPartial: '', maxLag: 0 };
}

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
/* ---------- 2.2.3 : modèle extrait une fois, sous un nom fixe (cf. en-tête) ---------- */
/* chemin choisi par le worker de vosk-browser pour une adresse de modèle (load : storagePath + '/' + url.replace(/[\W]/g, '_')) */
export function modelDir(url){ return '/vosk/' + String(url).replace(/[\W]/g, '_'); }
/* fichiers d'IDBFS qui n'appartiennent pas au modèle d'adresse fixe : copies des ouvertures précédentes (blob:…) */
export function staleKeys(keys, dir){ return keys.map(String).filter(k => k !== dir && !k.startsWith(dir + '/')); }
/* dire « les 3 premiers mots » d'un texte : le reste (resetTranscript au milieu d'une phrase) */
export function dropWords(text, n){ return String(text || '').trim().split(/\s+/).filter(Boolean).slice(Math.max(0, n | 0)).join(' '); }
const countWords = t => String(t || '').trim().split(/\s+/).filter(Boolean).length;
function stableUrl(){ try{ return new URL(MODEL_URL, (typeof document !== 'undefined' && document.baseURI) || location.href).href; }catch(_){ return null; } }   /* comme fetch(MODEL_URL) : base du document */

function idbOpen(){
  return new Promise((res, rej)=>{
    let r;
    try{ r = indexedDB.open(IDB.name, IDB.version); }catch(e){ rej(e); return; }
    /* même schéma que l'IDBFS de vosk-browser (getDB) */
    r.onupgradeneeded = ()=>{
      const db = r.result, tx = r.transaction;
      const st = db.objectStoreNames.contains(IDB.store) ? tx.objectStore(IDB.store) : db.createObjectStore(IDB.store);
      if(!st.indexNames.contains('timestamp')) st.createIndex('timestamp', 'timestamp', { unique: false });
    };
    r.onsuccess = ()=>res(r.result);
    r.onerror = ()=>rej(r.error);
    r.onblocked = ()=>rej(new Error('base /vosk bloquée'));
  });
}
const idbReq = r => new Promise((res, rej)=>{ r.onsuccess = ()=>res(r.result); r.onerror = ()=>rej(r.error); });
function idbWrite(db, fn){
  return new Promise((res, rej)=>{
    const tx = db.transaction([IDB.store], 'readwrite');
    fn(tx.objectStore(IDB.store));
    tx.oncomplete = ()=>res();
    tx.onerror = ()=>rej(tx.error);
    tx.onabort = ()=>rej(tx.error || new Error('transaction annulée'));
  });
}
/* 'ready' : déjà extrait ; 'seeded' : archive déposée (vosk-browser l'extraira, sans réseau) ; null : IndexedDB impossible */
async function seedModel(url, onPct){
  let db = null;
  try{
    if(!url || typeof indexedDB === 'undefined' || !indexedDB) return null;
    const dir = modelDir(url);
    db = await idbOpen();
    const keys = (await idbReq(db.transaction([IDB.store]).objectStore(IDB.store).getAllKeys())).map(String);
    const stale = staleKeys(keys, dir);
    const mine = keys.filter(k => !stale.includes(k));
    if(stale.length) dlog('micro', 'anciennes copies du modèle supprimées', { fichiers: stale.length, copies: new Set(stale.map(k => k.split('/')[2])).size });
    if(mine.includes(dir + '/extracted.ok')){
      if(stale.length) await idbWrite(db, st => stale.forEach(k => st.delete(k)));
      return 'ready';
    }
    const blob = await getModelBlob(onPct);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const at = new Date();
    await idbWrite(db, st => {
      stale.concat(mine).forEach(k => st.delete(k));
      st.put({ timestamp: at, mode: IDB.dirMode }, dir);
      st.put({ timestamp: at, mode: IDB.fileMode, contents: bytes }, dir + '/downloaded.tar.gz');
      st.put({ timestamp: at, mode: IDB.fileMode, contents: new Uint8Array(0) }, dir + '/downloaded.ok');
    });
    dlog('micro', 'modèle déposé pour extraction', { octets: bytes.length });
    return 'seeded';
  }catch(err){
    dlog('micro', 'dépôt du modèle impossible : ' + String((err && (err.message || err.name)) || err));
    return null;
  }finally{
    try{ if(db) db.close(); }catch(_){}
  }
}
/* modèle extrait inutilisable (fichiers effacés par le système, extraction abîmée) : oublié, il sera redéposé à la prochaine ouverture */
async function forgetModel(url){
  let db = null;
  try{
    if(!url || typeof indexedDB === 'undefined' || !indexedDB) return;
    const dir = modelDir(url);
    db = await idbOpen();
    const keys = (await idbReq(db.transaction([IDB.store]).objectStore(IDB.store).getAllKeys())).map(String);
    const mine = keys.filter(k => k === dir || k.startsWith(dir + '/'));
    if(mine.length) await idbWrite(db, st => mine.forEach(k => st.delete(k)));
    dlog('micro', 'modèle extrait oublié', { fichiers: mine.length });
  }catch(_){}
  finally{ try{ if(db) db.close(); }catch(_){} }
}
/* le modèle est-il déjà extrait sur cet appareil ? (préchargement, espace parents) */
export async function modelReady(){
  let db = null;
  try{
    const url = stableUrl();
    if(!url || typeof indexedDB === 'undefined' || !indexedDB) return false;
    db = await idbOpen();
    return (await idbReq(db.transaction([IDB.store]).objectStore(IDB.store).count(modelDir(url) + '/extracted.ok'))) > 0;
  }catch(_){ return false; }
  finally{ try{ if(db) db.close(); }catch(_){} }
}
/* createModel borné dans le temps : sa promesse ne finit jamais si le chargement échoue (le worker répond 'error', pas 'load') */
function openModel(url, ms){
  return new Promise((res, rej)=>{
    let done = false, m = null, t = 0;
    const end = (err, v)=>{
      if(done) return;
      done = true; clearTimeout(t);
      if(err){ try{ if(m && m.worker) m.worker.terminate(); }catch(_){} rej(err); }
      else res(v);
    };
    t = setTimeout(()=>end(new Error('Vosk : chargement trop long (' + Math.round(ms / 1000) + ' s)')), ms);
    try{
      if(typeof Vosk.Model === 'function'){
        m = new Vosk.Model(url);
        m.on('load', msg => (msg && msg.result ? end(null, m) : end(new Error('Vosk : modèle refusé'))));
        m.on('error', msg => end(new Error('Vosk : ' + String((msg && msg.error) || 'erreur'))));
      } else {
        Vosk.createModel(url).then(v => end(null, v), e => end(e || new Error('Vosk : échec du chargement')));
      }
    }catch(e){ end(e); }
  });
}
/* compte des requêtes et réponses du worker de Vosk (une réponse par morceau de son, dans l'ordre) : le retard du moteur */
function instrument(model){
  try{
    if(!model || model.__caramel || typeof model.postMessage !== 'function') return;
    model.__caramel = true;
    const post = model.postMessage.bind(model);
    model.postMessage = (m, o)=>{
      if(m && m.recognizerId && (m.action === 'audioChunk' || m.action === 'retrieveFinalResult' || m.action === 'remove')) q.sent++;
      return post(m, o);
    };
    if(model.worker && model.worker.addEventListener){
      model.worker.addEventListener('message', ev => {
        const m = ev && ev.data;
        if(m && m.recognizerId && (m.event === 'result' || m.event === 'partialresult' || m.event === 'error')) q.done = Math.min(q.sent, q.done + 1);
      });
    }
  }catch(_){}
}
function loadLib(){
  if(!libP) libP = (async ()=>{
    await loadScript(VOSK_LIB);
  })().catch(e => { libP = null; throw e; });
  return libP;
}

/* onPct(p) : progression du premier téléchargement (0-99 %) ; plusieurs appelants possibles */
export function ensureVosk(onPct){
  if(typeof onPct === 'function' && !voskSettled) pctFns.add(onPct);
  voskPromise = voskPromise || (async ()=>{
    const t0 = Date.now();
    try{
      if(typeof WebAssembly !== 'object') throw new Error('pas de WASM');
      setVoiceStatus('🎙 Moteur vocal : chargement\u2026');
      if(prefetchP){ try{ await prefetchP; }catch(_){} }   /* préchargement en cours (1re ouverture) : il finit d'abord */
      await loadLib();
      const progress = p=>{
        setVoiceStatus('🎙 Moteur vocal : téléchargement ' + p + ' % (1re fois seulement)');
        pctFns.forEach(fn => { try { fn(p); } catch (_) {} });
      };
      const url = stableUrl();
      const how = await seedModel(url, progress);
      if(how){
        try{ voskModel = await openModel(url, how === 'ready' ? LOAD_MS.ready : LOAD_MS.extract); }
        catch(e0){ console.error('Vosk : modèle extrait inutilisable', e0); voskModel = null; await forgetModel(url); }
      }
      if(!voskModel){
        /* repli (sans IndexedDB, ou extraction ratée) : la voie v11, depuis le blob */
        const blob = await getModelBlob(progress);
        const blobUrl = URL.createObjectURL(blob);
        try{ voskModel = await openModel(blobUrl, LOAD_MS.extract); }
        catch(e1){ voskModel = await openModel(MODEL_URL, LOAD_MS.extract); }
      }
      instrument(voskModel);
      setVoiceStatus('🎙 Moteur vocal prêt ✓ — la voix reste sur l\u2019appareil');
      dlog('micro', 'moteur prêt', { voie: how || 'blob', ms: Date.now() - t0 });
      return true;
    }catch(err){
      console.error('Vosk indisponible :', err);
      setVoiceStatus('🎙 Moteur intégré indisponible → reconnaissance Google en secours');
      dlog('micro', 'moteur indisponible : ' + String((err && err.message) || err), { ms: Date.now() - t0 });
      return false;
    }finally{
      voskSettled = true;
      pctFns.clear();
    }
  })();
  return voskPromise;
}

/* 2.2.3 : tout préparer à la première ouverture (demande du parent du 06/10/2026) : bibliothèque (mise en cache même si le
   service worker ne contrôle pas encore la page), modèle (cache 'vosk-model-v1'), dépôt dans IDBFS puis extraction par un
   worker de Vosk aussitôt libéré (Vosk ne reste pas en mémoire : la voix fluide en a besoin) ; le premier micro démarre
   ensuite sans téléchargement ni extraction. Rien à faire si le micro a déjà chargé Vosk. onPct(p) : 0-99 %. */
async function cacheLib(){
  try{
    const c = await caches.open(LIB_CACHE);
    if(await c.match(VOSK_LIB)) return;
    const res = await fetch(VOSK_LIB, { mode: 'cors', credentials: 'omit' });
    if(res.ok) await c.put(VOSK_LIB, res);
  }catch(_){}
}
export function prefetch({ onPct = null, extract = true } = {}){
  if(voskPromise) return voskPromise.then(ok => !!ok);
  prefetchP = prefetchP || (async ()=>{
    const t0 = Date.now();
    try{
      if(typeof WebAssembly !== 'object') return false;
      const pct = p => { if(typeof onPct === 'function'){ try{ onPct(p); }catch(_){} } };
      await cacheLib();
      await loadLib();
      const url = stableUrl();
      const how = await seedModel(url, pct);
      if(!how){ await getModelBlob(pct); return true; }      /* sans IndexedDB : au moins le modèle en cache */
      if(how === 'seeded' && extract){
        const m = await openModel(url, LOAD_MS.extract);    /* vosk-browser extrait et enregistre, puis on le libère */
        try{ if(m.worker) m.worker.terminate(); }catch(_){}
      }
      dlog('micro', 'préchargement fini', { voie: how, ms: Date.now() - t0 });
      return true;
    }catch(err){
      console.error('Vosk : préchargement', err);
      dlog('micro', 'préchargement raté : ' + String((err && err.message) || err));
      return false;
    }finally{
      prefetchP = null;
    }
  })();
  return prefetchP;
}

/* ---------- 2.2.3 : santé du micro ---------- */
const trackState = () => { try{ const t = audio.stream && audio.stream.getTracks()[0]; return t ? t.readyState + (t.muted ? ' muet' : '') : '—'; }catch(_){ return '?'; } };
const ctxState = () => { try{ return audio.ctx ? audio.ctx.state : '—'; }catch(_){ return '?'; } };
const pending = () => Math.max(0, q.sent - q.done);
const captureKind = () => { try{ return audio.node ? (typeof AudioWorkletNode === 'function' && audio.node instanceof AudioWorkletNode ? 'fil audio' : 'v11') : '—'; }catch(_){ return '?'; } };
const levelOf = rms => Math.max(0, Math.min(1, (20 * Math.log10(Math.max(rms, 1e-6)) + 60) / 50));   /* −60 dB → 0, −10 dB → 1 */

/* chaque morceau de son (256 ms) : niveau, bruit de fond, voix ; faux = ne pas l'envoyer (moteur en retard, blanc) */
function feed(buf){
  let d = null;
  try{ d = buf && buf.getChannelData ? buf.getChannelData(0) : null; }catch(_){}
  return feedData(d);
}
function feedData(d){
  const now = Date.now();
  hl.audioAt = now; hl.chunks++;
  let voiced = true;
  if(d && d.length){
    let sum = 0, nz = false;
    for(let i = 0; i < d.length; i++){ const v = d[i]; sum += v * v; if(v !== 0) nz = true; }
    const rms = Math.sqrt(sum / d.length);
    hl.zeroSince = nz ? 0 : (hl.zeroSince || now);
    hl.floor = rms < hl.floor ? Math.max(rms, 1e-4) : hl.floor + (rms - hl.floor) * 0.01;
    voiced = rms > Math.max(TUNING.voiceMin, hl.floor * TUNING.voiceRatio);
    hl.level = Math.max(levelOf(rms), hl.level * 0.6);
  }
  if(voiced) hl.voicedAt = now;
  const p = pending();
  let send = true;
  if(p >= TUNING.hardPending && !keepVoice) hl.catchup = true;
  if(hl.catchup){ if(p > TUNING.softPending) send = false; else hl.catchup = false; }
  if(send && p >= TUNING.softPending && !voiced && now - hl.voicedAt > TUNING.hangMs) send = false;
  if(!send){ hl.dropped++; hl.held = d ? d.slice() : null; return false; }
  /* la voix revient après des blancs non envoyés : le morceau d'avant aussi (début du mot) */
  if(hl.held && voiced && audio.recognizer && audio.recognizer.acceptWaveformFloat && audio.ctx){
    try{ audio.recognizer.acceptWaveformFloat(hl.held, audio.ctx.sampleRate); }catch(_){}
  }
  hl.held = null;
  hl.sentChunks++;
  return true;
}

function publish(state, why){
  const now = Date.now();
  const p = pending(), lag = p * TUNING.chunkMs;
  if(lag > hl.maxLag) hl.maxLag = lag;
  const next = Object.freeze({ state, engine, level: Math.round(hl.level * 100) / 100, voice: now - hl.voicedAt < 400,
    lagMs: lag, pending: p, dropped: hl.dropped, audioAgeMs: Math.max(0, now - hl.audioAt), reopens: hl.reopens.length });
  const changed = next.state !== snap.state || next.engine !== snap.engine;
  snap = next;
  if(changed) dlog('micro', 'état : ' + state + (why ? ' (' + why + ')' : ''), { moteur: engine, ctx: ctxState(), piste: trackState(), retard: lag });
  else if(state !== 'off' && ++hl.ticks % TUNING.logEvery === 0){
    dlog('santé', '', { niveau: next.level, fond: Math.round(levelOf(hl.floor) * 100) / 100, voix: next.voice, retard: lag, max: hl.maxLag,
      sautés: hl.dropped, envoyés: hl.sentChunks, ctx: ctxState(), piste: trackState() });
  }
  healthFns.forEach(fn => { try{ fn(snap); }catch(_){} });
}
function checkHealth(){
  if(!running) return;
  if(engine !== 'vosk'){ publish(engine ? 'ok' : 'starting'); return; }
  const now = Date.now();
  let hidden = false;
  try{ hidden = !!document.hidden; }catch(_){}
  /* page cachée : le système coupe le son, ce n'est pas une panne */
  if(hidden){ hl.audioAt = now; if(hl.zeroSince) hl.zeroSince = now; }
  let st = 'ok', why = '';
  if(now - hl.audioAt > TUNING.deafMs){ st = 'deaf'; why = 'plus de son'; }
  else if(hl.zeroSince && now - hl.zeroSince > TUNING.zeroMs){ st = 'deaf'; why = 'son nul'; }
  else if(pending() * TUNING.chunkMs > TUNING.slowMs){ st = 'slow'; why = 'moteur en retard'; }
  if(reopenP) st = snap.state === 'off' ? 'starting' : snap.state;
  else if(st === 'deaf') reopenAudio(why);
  publish(st, why);
}
function startHealth(){
  stopHealth();
  try{ tick = setInterval(checkHealth, TUNING.tickMs); if(tick && tick.unref) tick.unref(); }catch(_){}   /* Node (tests) : ne retient pas le processus */
  if(!visBound){
    visBound = true;
    try{ document.addEventListener('visibilitychange', ()=>{ if(!document.hidden){ hl.audioAt = Date.now(); if(hl.zeroSince) hl.zeroSince = Date.now(); } }); }catch(_){}
  }
}
function stopHealth(){ if(tick){ try{ clearInterval(tick); }catch(_){} tick = 0; } }

/* le micro seul (flux, contexte audio) : le reconnaisseur reste */
function closeAudio(){
  try{ if(audio.node && audio.node.port) audio.node.port.postMessage('stop'); }catch(_){}
  try{ if(audio.node){ audio.node.onaudioprocess = null; audio.node.disconnect(); } }catch(_){}
  try{ if(audio.source) audio.source.disconnect(); }catch(_){}
  try{ if(audio.gain) audio.gain.disconnect(); }catch(_){}
  try{ if(audio.stream) audio.stream.getTracks().forEach(t=>t.stop()); }catch(_){}
  try{ if(audio.ctx) audio.ctx.close(); }catch(_){}
  audio.ctx = audio.stream = audio.source = audio.node = audio.gain = null;
}
/* micro muet (plus de son, ou des zéros) : on le rouvre, comme un arrêt / reprise du 🎤, sans perdre le reconnaisseur */
function reopenAudio(why){
  if(reopenP || !running || engine !== 'vosk' || !audio.recognizer) return;
  const now = Date.now();
  hl.reopens = hl.reopens.filter(t => now - t < 60000);
  if(hl.reopens.length >= TUNING.reopenMax) return;
  hl.reopens.push(now);
  const my = session;
  dlog('micro', 'réouverture du micro (' + why + ')', { ctx: ctxState(), piste: trackState(), fois: hl.reopens.length });
  reopenP = (async ()=>{
    closeAudio();
    try{
      await openAudio();
      if(my !== session){ closeAudio(); return; }
      dlog('micro', 'micro rouvert', { ctx: ctxState(), piste: trackState() });
    }catch(err){
      if(my !== session) return;
      dlog('micro', 'réouverture impossible : ' + String(err && (err.name || err.message)));
      if(err && (err.name==='NotAllowedError' || err.name==='SecurityError')) fail('not-allowed');
      else if(err && err.name==='NotFoundError') fail('audio-capture');
    }
  })().finally(()=>{ reopenP = null; hl.audioAt = Date.now(); hl.zeroSince = 0; });
}

/* santé : { state: 'off' | 'starting' | 'ok' | 'slow' (moteur en retard) | 'deaf' (micro muet), engine, level (0-1),
   voice (voix entendue à l'instant), lagMs, pending, dropped (morceaux non envoyés), audioAgeMs, reopens } */
export function health(){
  const p = pending();                          /* l'état vient de la dernière vérification, les compteurs sont à jour */
  return Object.freeze({ ...snap, pending: p, lagMs: p * TUNING.chunkMs, dropped: hl.dropped });
}
export function onHealth(fn){
  if(typeof fn !== 'function') return () => {};
  healthFns.add(fn);
  try{ fn(snap); }catch(_){}
  return () => healthFns.delete(fn);
}

/* le micro (v11 : début et fin de startVoskEngine) ; 2.2.3 : aussi pour rouvrir un micro muet (reopenAudio) */
async function openAudio(){
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation:true, noiseSuppression:true, channelCount:1 }
  });
  audio.stream = stream;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  try{ audio.ctx = new Ctx({ sampleRate: 16000 }); }  /* fréquence native du modèle */
  catch(_){ audio.ctx = new Ctx(); }
  try{ await audio.ctx.resume(); }catch(_){}
  /* AJOUT (retour terrain 2.2, Android) : un AudioContext suspendu par le système (focus audio, appel, veille) n'envoie plus rien à
     Vosk : le micro restait sourd jusqu'à un arrêt / reprise du 🎤. On le relance dès qu'il se suspend. */
  const micCtx = audio.ctx;
  try{
    micCtx.addEventListener('statechange', ()=>{
      if(!running || audio.ctx !== micCtx || (micCtx.state !== 'suspended' && micCtx.state !== 'interrupted')) return;
      dlog('micro', 'contexte audio ' + micCtx.state + ' → relancé');
      try{ const p = micCtx.resume(); if(p && p.catch) p.catch(()=>{}); }catch(_){}
    });
  }catch(_){}
  /* AJOUT 2.2.3 : piste coupée par le système (appel, autre appli) : notée au journal, la santé rouvre le micro */
  try{
    const tr = stream.getTracks()[0];
    if(tr && tr.addEventListener){
      tr.addEventListener('ended', ()=>{ if(audio.stream === stream) dlog('micro', 'piste du micro terminée'); });
      tr.addEventListener('mute', ()=>{ if(audio.stream === stream) dlog('micro', 'piste du micro muette'); });
      tr.addEventListener('unmute', ()=>{ if(audio.stream === stream) dlog('micro', 'piste du micro de nouveau active'); });
    }
  }catch(_){}
  audio.source = audio.ctx.createMediaStreamSource(stream);
  /* AJOUT 2.2.3 : capture sur le fil audio (AudioWorklet), qui ne perd pas de son quand le jeu occupe la page ; repli : le
     ScriptProcessor de la v11 */
  if(await openWorklet()) return;
  audio.node = audio.ctx.createScriptProcessor(4096, 1, 1);
  audio.node.onaudioprocess = (e)=>{
    if(!running) return;
    if(!feed(e.inputBuffer)) return;            /* 2.2.3 : santé, et blancs gardés quand le moteur est en retard */
    try{ audio.recognizer.acceptWaveform(e.inputBuffer); }catch(_){}
  };
  audio.gain = audio.ctx.createGain();
  audio.gain.gain.value = 0;
  audio.source.connect(audio.node);
  audio.node.connect(audio.gain);
  audio.gain.connect(audio.ctx.destination);
}

/* le ScriptProcessor de la v11 tourne sur le fil principal : quand le jeu l'occupe (téléphone lent), le navigateur perd des morceaux
   de son (mesuré, fil principal occupé à 90 % : 1 réponse sur 8 comprise, son haché ; 8 sur 8 ici). L'AudioWorklet
   (js/core/mic-worklet.js) copie le son sur le fil audio et le poste à la page : les messages attendent sans se perdre. */
async function openWorklet(){
  const ctx = audio.ctx;
  try{
    if(!ctx || !ctx.audioWorklet || typeof AudioWorkletNode !== 'function') return false;
    await ctx.audioWorklet.addModule(new URL('./mic-worklet.js', import.meta.url).href);
    if(audio.ctx !== ctx) return true;                     /* micro fermé entre-temps : rien à brancher */
    const node = new AudioWorkletNode(ctx, 'caramel-mic', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
      channelCount: 1, channelCountMode: 'explicit' });
    node.port.onmessage = (e)=>{
      if(!running || audio.node !== node || !audio.recognizer) return;
      const d = e.data;
      if(!feedData(d)) return;
      try{ audio.recognizer.acceptWaveformFloat(d, ctx.sampleRate); }catch(_){}
    };
    audio.node = node;
    audio.gain = ctx.createGain();
    audio.gain.gain.value = 0;
    audio.source.connect(node);
    node.connect(audio.gain);
    audio.gain.connect(ctx.destination);
    return true;
  }catch(err){
    dlog('micro', 'capture sur le fil audio impossible, voie v11 : ' + String((err && (err.message || err.name)) || err));
    return false;
  }
}

async function startVoskEngine(words){
  await openAudio();
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
    const t = (m && m.result && m.result.text) || '';
    if(t) dlog('entendu', t, cutN ? { oubliés: cutN } : undefined);
    if(cutN){
      /* AJOUT 2.2.3 : fin d'une phrase dont le début a été oublié par resetTranscript : seule la suite compte */
      const k = dropWords(t, cutN);
      cutN = 0; live = '';
      if(k) finalTranscript += k + ' ';
      emit(finalTranscript, true); return;
    }
    live = '';
    if(t) finalTranscript += t + ' ';
    emit(finalTranscript, true);
  });
  rec.on('partialresult', (m)=>{
    if(!running) return;
    const p = (m && m.result && m.result.partial) || '';
    live = p;
    if(p && p !== hl.lastPartial){ hl.lastPartial = p; dlog('partiel', p); }
    if(cutN){ emit(finalTranscript + ' ' + dropWords(p, cutN), false); return; }   /* AJOUT 2.2.3 : début oublié */
    emit(finalTranscript + ' ' + p, false);
  });
  rec.on('error', (m)=>{ dlog('micro', 'erreur du reconnaisseur : ' + String((m && m.error) || '?')); });
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
  if(reopenP){ try{ await reopenP; }catch(_){} if(my !== session) return { engine: null }; }   /* 2.2.3 : réouverture finie d'abord */
  running = true;
  engine = null;
  finalTranscript = ''; live = ''; cutN = 0; wsSkip = wsLen = 0;
  hl = freshHealth();
  publish('starting');

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
    else { running = false; publish('off'); return { engine: null }; }
    /* AJOUT 2.2 : Vosk était prêt mais n'a pas démarré, Web Speech prend le relais → le statut le dit */
    if(voskOk) setVoiceStatus('🎙 Moteur intégré indisponible → reconnaissance Google en secours');
  }
  dlog('micro', 'écoute', { moteur: engine, mots: Array.isArray(grammar) ? grammar.length : 'libre', retard: pending() * TUNING.chunkMs,
    ctx: ctxState(), piste: trackState(), capture: captureKind() });
  startHealth();
  publish('ok');
  return { engine };
}

/* grammar : string[] de mots DÉJÀ normalisés (le moteur ajoute '[unk]') ; null (ou []) = reco libre.
   onText(texteCumulé, final) : à chaque résultat partiel ou final (finalTranscript + ' ' + partiel, comme v11).
   keepVoice (2.2.3) : moteur très en retard (> hardPending), la voix est quand même envoyée (la course : chaque mot lu compte ;
     les tables, elles, préfèrent rattraper : l'enfant redit sa réponse).
   onError(code, message) : 'not-allowed' | 'audio-capture' | 'network' | 'service-not-allowed' |
     'language-not-supported' | 'unsupported' — message prêt à afficher (ERR_MSG v11).
   Déjà à l'écoute → { engine } sans redémarrer (pour changer de grammaire : stopListening() puis startListening()). */
export async function startListening({ grammar = null, onText = null, onError = null, keepVoice: kv = false } = {}){
  textCb = typeof onText === 'function' ? onText : null;
  errCb = typeof onError === 'function' ? onError : null;
  keepVoice = !!kv;
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
  const was = running || !!inflight;
  session++;
  running = false;
  stopHealth();
  stopWebSpeech();
  stopVoskEngine();
  engine = null;
  live = ''; cutN = 0; wsSkip = wsLen = 0;
  textCb = errCb = null;
  if(was) dlog('micro', 'arrêt', { sautés: hl.dropped, envoyés: hl.sentChunks, retardMax: hl.maxLag, réouvertures: hl.reopens.length });
  publish('off');
}

/* oublie tout ce qui a été entendu, y compris le début de la phrase en cours (la suite de la phrase est gardée) */
export function resetTranscript(){
  finalTranscript = '';
  if(!running) return;
  /* AJOUT (dictée des tables) : Web Speech oublie aussi les résultats déjà finals (Chrome Android renvoie parfois toute la liste depuis
     l'indice 0 : la réponse précédente revenait sur le calcul suivant) */
  if(engine === 'webspeech'){ wsSkip = wsLen; live = ''; return; }
  /* CHANGÉ 2.2.3 : Vosk oublie les mots DÉJÀ entendus de la phrase en cours (cutN), sans la couper (couper net faisait reconnaître la
     fin d'un mot seule : « …vingt-un » → « quatre-vingts ») ni l'ignorer jusqu'au prochain silence (2.2.1 : une réponse dite
     sans pause après la précédente était perdue) */
  cutN = countWords(live);
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
