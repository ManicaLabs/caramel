/* ============ VOIX FLUIDE : MOTEUR PIPER (v2.2.2, d'après le prototype PT-proto) ============
   Texte → phonèmes (espeak-ng, via piper-phonemize compilé en WebAssembly) → identifiants → modèle VITS (onnxruntime-web)
   → échantillons PCM. Module PUR (aucun accès au DOM ni au réseau, importable dans Node) : il reçoit ses fichiers déjà
   téléchargés et tourne dans un Worker (js/core/piper-worker.js, cas normal) ou sur le fil principal (banc d'essai
   tests/harness/piper.html, mesures sous CPU ralenti). Téléchargement, cache et lecture : js/core/piper-tts.js.

   Réglages PARTAGÉS avec les clips enregistrés (tools/voix.mjs les importe d'ici) : même voix, même débit. Chaque phrase
   est synthétisée à part (comme piper 1.8 en Python) : amplitude ramenée à 1 puis × volume.
   VOIX D'ENFANT (décision du parent du 05/10/2026, après écoute) : Siwis « rajeunie », degré 4 sur 4, r = YOUTH = 1,33
   (+5 demi-tons). Piper parle r fois plus lentement (length_scale × r), puis le son est lu r fois plus vite
   (rééchantillonné) : hauteur ET timbre montent de r, le débit reste celui de Siwis (≈ 5 % plus vif : durées arrondies
   par Piper, comme dans l'échantillon validé). Clips : ffmpeg « asetrate=22050*r,
   aresample=22050 » ; voix fluide : rejuvenate(), dans le worker (le son arrive prêt : durées, cache et 🔊 inchangés).

   Phonémiseur : seules les données FRANÇAISES d'espeak-ng servent (≈ 711 Ko sur 18 Mo) : la liste des fichiers du paquet
   (métadonnées écrites dans la colle emscripten) est réécrite pour ce sous-ensemble avant l'évaluation. Le paquet
   complet n'est jamais gardé : piper-tts.js en extrait le sous-ensemble au premier téléchargement (extractSubset).
   Une barre « | » dans le texte coupe l'appel à espeak sans pause : « 38 | plusse 25 » garde le t de « trente-huit ».

   Licences : onnxruntime-web MIT ; piper-phonemize MIT, mais il embarque espeak-ng (GPL-3.0-or-later, programme ET
   données : téléchargés depuis jsDelivr, jamais hébergés dans le dépôt) ; voix siwis : modèle Piper (MIT), données
   SIWIS CC BY 4.0, poids convertis en float16 (tools/piper-modele.py). */

export const YOUTH = 1.33;
/* degrés écoutés par le parent, de Siwis telle quelle (0) à la voix retenue (4) : banc d'essai */
export const YOUTH_DEGREES = Object.freeze([1, 1.12, 1.19, 1.26, YOUTH]);
/* sentence_silence : silence entre deux phrases, en secondes de son FINAL */
export const PARAMS = Object.freeze({ length_scale: 1.05, noise_scale: 0.75, noise_w: 0.9, sentence_silence: 0.35, volume: 0.9, youth: YOUTH });
const youthOf = p => (Number(p && p.youth) > 0 ? Number(p.youth) : 1);
/* entrée « scales » du modèle : [noise_scale, length_scale × r, noise_w] */
export const scalesOf = p => [p.noise_scale, p.length_scale * youthOf(p), p.noise_w];

/* son calculé r fois trop lent → lu r fois plus vite, à la même fréquence d'échantillonnage (= « asetrate=rate*r,
   aresample=rate » de ffmpeg) : chaque sortie est interpolée par une sinc à fenêtre de Kaiser (16 passages par zéro de
   chaque côté) coupée à 95 % de la nouvelle demi-fréquence : pas de repliement, pas de grésillement. r = 1 : tel quel. */
const KZ = 16, KT = 64;        /* passages par zéro de chaque côté ; points de la table par passage */
let kern = null;
function kernel() {
  if (kern) return kern;
  const beta = 8.6;
  const I0 = x => { let s = 1, t = 1; for (let k = 1; k < 50 && t > 1e-12 * s; k++) { t *= (x / (2 * k)) ** 2; s += t; } return s; };
  kern = new Float32Array(KZ * KT + 2);
  for (let i = 0; i <= KZ * KT; i++) {
    const u = i / KT;
    kern[i] = (u ? Math.sin(Math.PI * u) / (Math.PI * u) : 1) * I0(beta * Math.sqrt(Math.max(0, 1 - (u / KZ) ** 2))) / I0(beta);
  }
  return kern;
}
export function rejuvenate(pcm, r = YOUTH) {
  if (!(r > 0) || Math.abs(r - 1) < 1e-6 || !pcm.length) return pcm;
  const k = kernel(), end = KZ * KT;
  const c = 0.95 * Math.min(1, 1 / r), half = KZ / c;
  const out = new Float32Array(Math.floor(pcm.length / r));
  for (let m = 0; m < out.length; m++) {
    const x = m * r;
    const i1 = Math.min(pcm.length - 1, Math.floor(x + half));
    let s = 0;
    for (let i = Math.max(0, Math.ceil(x - half)); i <= i1; i++) {
      const u = Math.abs(x - i) * c * KT, j = u | 0;
      if (j < end) s += pcm[i] * (k[j] + (k[j + 1] - k[j]) * (u - j));
    }
    out[m] = s * c;
  }
  return out;
}
/* fichiers d'espeak-ng utiles au français : table des phonèmes, intonations, dictionnaire, description de la langue */
export const KEEP_FR = /\/(phontab|phonindex|phondata|intonations|fr_dict)$|\/lang\/roa\/fr$/;

/* métadonnées du paquet de données (« loadPackage({"files":[…],"remote_package_size":…}) » dans la colle) */
export function packageMeta(glueSrc) {
  const m = /loadPackage\((\{"files":[\s\S]*?\})\)/.exec(glueSrc);
  if (!m) throw new Error('phonémiseur : métadonnées du paquet introuvables');
  return { json: m[1], meta: JSON.parse(m[1]) };
}
/* fichiers gardés, avec leur position dans le paquet complet (from) et dans le sous-ensemble (start, end) */
export function subsetOf(meta, keep = KEEP_FR) {
  const files = [];
  let pos = 0;
  for (const f of meta.files) {
    if (!keep.test(f.filename)) continue;
    const n = f.end - f.start;
    files.push({ ...f, from: f.start, start: pos, end: pos + n });
    pos += n;
  }
  if (!files.some(f => /fr_dict$/.test(f.filename))) throw new Error('phonémiseur : dictionnaire français absent du paquet');
  return { files, size: pos };
}
/* paquet complet (18 Mo) → sous-ensemble français ; un paquet trop court (téléchargement tronqué) est refusé */
export function extractSubset(full, sub) {
  const src = full instanceof Uint8Array ? full : new Uint8Array(full);
  const need = sub.files.reduce((m, f) => Math.max(m, f.from + (f.end - f.start)), 0);
  if (src.length < need) throw new Error('phonémiseur : paquet de données incomplet (' + src.length + ' o sur ' + need + ')');
  const out = new Uint8Array(sub.size);
  for (const f of sub.files) out.set(src.subarray(f.from, f.from + (f.end - f.start)), f.start);
  return out;
}
/* colle emscripten réécrite pour ne charger que le sous-ensemble */
export function patchGlue(glueSrc, sub) {
  const { json } = packageMeta(glueSrc);
  const files = sub.files.map(({ from, ...f }) => f);
  return glueSrc.replace(json, JSON.stringify({ files, remote_package_size: sub.size }));
}

/* phonèmes d'une phrase → identifiants du modèle : ^ _ (phonème _)* $ (comme piper 1.8, phonemes_to_ids) */
export function phonemeIds(phonemes, idMap, missing = []) {
  const one = k => (idMap[k] || [])[0];
  const BOS = one('^'), EOS = one('$'), PAD = one('_');
  const ids = [BOS, PAD];
  for (const ch of phonemes.normalize('NFD')) {
    const id = idMap[ch];
    if (!id) { missing.push(ch); continue; }
    ids.push(...id, PAD);
  }
  ids.push(EOS);
  return ids;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/* Démarrage à partir des fichiers téléchargés (piper-tts.js) — même code dans le Worker et sur le fil principal.
   files : { ortMjs, ortGlue, phonGlue (textes), ortGlueHref (adresse d'origine de la colle), ortWasm, phonWasm, espeak,
   model (ArrayBuffer), config (objet) }.
   onnxruntime-web est importé depuis une URL blob: : tout vient du cache, rien ne dépend du réseau au démarrage.
   Sans ortGlue : onnxruntime 1.18 (colle incluse dans le module ; .wasm « ort-wasm-simd.wasm » SANS mémoire partagée,
   repli quand la mémoire partagée de 1.19+ est refusée, ex. Safari hors isolation). */
export async function boot(files, log = () => {}) {
  const t0 = now();
  const blobUrl = s => URL.createObjectURL(new Blob([s], { type: 'text/javascript' }));
  /* la colle d'onnxruntime calcule des chemins à partir de import.meta.url, invalide comme base pour une URL blob: :
     on lui donne sa vraie adresse (le .wasm, lui, est fourni directement : rien n'est téléchargé) */
  const legacy = !files.ortGlue;
  const glue = legacy ? null : files.ortGlueHref ? files.ortGlue.split('import.meta.url').join(JSON.stringify(files.ortGlueHref)) : files.ortGlue;
  const ortUrl = blobUrl(files.ortMjs), ortGlueUrl = legacy ? null : blobUrl(glue);
  const ortWasmUrl = legacy ? URL.createObjectURL(new Blob([files.ortWasm], { type: 'application/wasm' })) : null;
  log('import d’onnxruntime…');
  const ort = await import(ortUrl);
  const importMs = Math.round(now() - t0);
  log('onnxruntime importé (' + importMs + ' ms)');
  const engine = await createEngine({ ort, ortGlueUrl, ortWasm: legacy ? null : files.ortWasm, ortWasmUrl, glueSrc: files.phonGlue, phonWasm: files.phonWasm,
    espeak: files.espeak, model: files.model, config: files.config, log });
  engine.timings.import = importMs;
  engine.timings.boot = Math.round(now() - t0);
  return engine;
}

/* Moteur prêt à synthétiser.
   ort : module onnxruntime-web déjà importé ; ortGlueUrl : URL (blob: ou https:) de ort-wasm-simd-threaded.mjs ;
   ortWasm : ArrayBuffer du .wasm d'onnxruntime (1.19+) ; ortWasmUrl : URL du .wasm « ort-wasm-simd.wasm » (1.18) ;
   glueSrc : texte de piper_phonemize.js ; phonWasm : ArrayBuffer du .wasm ;
   espeak : sous-ensemble français (ArrayBuffer) ; model : ArrayBuffer du .onnx ; config : contenu du .onnx.json */
export async function createEngine({ ort, ortGlueUrl, ortWasm, ortWasmUrl, glueSrc, phonWasm, espeak, model, config, log = () => {} }) {
  const timings = {};
  /* --- onnxruntime-web : un seul fil (pas de COOP/COEP sur GitHub Pages), SIMD --- */
  let t = now();
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  if (ortWasm) ort.env.wasm.wasmBinary = ortWasm;
  if (ortGlueUrl) ort.env.wasm.wasmPaths = { mjs: ortGlueUrl };
  if (ortWasmUrl) { ort.env.wasm.simd = true; ort.env.wasm.wasmPaths = { 'ort-wasm-simd.wasm': ortWasmUrl }; }
  ort.env.logLevel = 'error';
  log('création de la session (modèle ' + model.byteLength + ' o)…');
  const session = await ort.InferenceSession.create(new Uint8Array(model), {
    executionProviders: ['wasm'], graphOptimizationLevel: 'all'
  });
  timings.session = Math.round(now() - t);
  log('modèle prêt (' + timings.session + ' ms) ; entrées : ' + session.inputNames.join(', '));

  /* --- phonémiseur --- */
  t = now();
  const { meta } = packageMeta(glueSrc);
  const sub = subsetOf(meta);
  const data = espeak.byteLength === sub.size ? espeak : extractSubset(espeak, sub).buffer;
  const create = (0, eval)(patchGlue(glueSrc, sub) + '\n;createPiperPhonemize');
  let out = null, err = '';
  const phon = await create({
    print: s => { out = s; },
    printErr: s => { err = s; },
    wasmBinary: phonWasm,
    locateFile: u => u,
    getPreloadedPackage: () => data
  });
  timings.phonemizer = Math.round(now() - t);
  log('phonémiseur prêt (' + timings.phonemizer + ' ms, données ' + sub.size + ' o)');

  const voice = (config.espeak && config.espeak.voice) || 'fr';
  const idMap = config.phoneme_id_map;
  const sampleRate = config.audio.sample_rate;
  const multi = session.inputNames.includes('sid');

  /* le programme piper-phonemize rend une ligne JSON : phonèmes (caractère par caractère, phrases bout à bout) et
     identifiants (chaque phrase encadrée par ^ … $) */
  function espeakCall(text) {
    out = null; err = '';
    phon.callMain(['-l', voice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']);
    if (!out) throw new Error('phonémiseur : pas de réponse' + (err ? ' (' + err + ')' : ''));
    const o = JSON.parse(out);
    return { ph: Array.isArray(o.phonemes) ? o.phonemes.join('') : String(o.phonemes || ''), ids: o.phoneme_ids || [] };
  }
  /* phrases : coupées après . ! ? (fins de phrase d'espeak), comme piper 1.8 ; une coupure « | » recolle les morceaux
     dans la même phrase avec une simple espace (pas de pause) */
  function phonemize(text) {
    const parts = String(text).split('|').map(s => s.trim()).filter(Boolean).map(s => espeakCall(s).ph.trim()).filter(Boolean);
    const list = [];
    let cur = '';
    for (const ch of parts.join(' ')) {
      cur += ch;
      if (ch === '.' || ch === '!' || ch === '?') { if (cur.trim()) list.push(cur.trim()); cur = ''; }
    }
    if (cur.trim()) list.push(cur.trim());
    return list;
  }
  /* contrôle : nos identifiants = ceux du programme (texte sans coupure) */
  function checkIds(text) {
    const ref = espeakCall(text).ids;
    const mine = phonemize(text).flatMap(s => phonemeIds(s, idMap));
    return ref.length === mine.length && ref.every((v, i) => v === mine[i]);
  }

  async function infer(phonemes, p = PARAMS) {
    const missing = [];
    const ids = phonemeIds(phonemes, idMap, missing);
    const feeds = {
      input: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.of(BigInt(ids.length)), [1]),
      scales: new ort.Tensor('float32', Float32Array.from(scalesOf(p)), [3])
    };
    if (multi) feeds.sid = new ort.Tensor('int64', BigInt64Array.of(BigInt(0)), [1]);
    const res = await session.run(feeds);
    const pcm = Float32Array.from(res[session.outputNames[0]].data);
    for (const k of Object.keys(res)) try { res[k].dispose && res[k].dispose(); } catch (_) {}
    /* comme piper 1.8 : amplitude ramenée à 1, puis × volume ; puis la voix d'enfant (comme les clips) */
    let peak = 0;
    for (let i = 0; i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > peak) peak = a; }
    const g = peak > 1e-8 ? (p.volume ?? 1) / peak : 0;
    for (let i = 0; i < pcm.length; i++) pcm[i] *= g;
    return { pcm: rejuvenate(pcm, youthOf(p)), ids: ids.length, missing };
  }

  /* phrase par phrase : on peut jouer la première pendant que la suivante se calcule */
  async function* sentences(text, p = PARAMS) {
    let t0 = now();
    const list = phonemize(text);
    const phonMs = now() - t0;
    for (let i = 0; i < list.length; i++) {
      t0 = now();
      const r = await infer(list[i], p);
      yield { index: i, count: list.length, phonemes: list[i], pcm: r.pcm, ids: r.ids, missing: r.missing,
        sampleRate, phonMs: i === 0 ? Math.round(phonMs) : 0, inferMs: Math.round(now() - t0) };
    }
  }

  return { timings, sampleRate, phonemize, checkIds, infer, sentences, release: () => session.release && session.release() };
}
