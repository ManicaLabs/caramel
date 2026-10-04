/* ============ VOIX PIPER DANS LE NAVIGATEUR : MOTEUR (prototype PT-proto) ============
   Texte → phonèmes (espeak-ng, via piper-phonemize compilé en WebAssembly) → identifiants → modèle VITS (onnxruntime-web)
   → échantillons PCM. Module PUR (aucun accès au DOM ni au réseau) : il reçoit ses fichiers déjà téléchargés et tourne
   dans un Worker (piper-worker.js, cas normal) ou sur le fil principal (mesures sous CPU ralenti).
   Banc d'essai : tests/harness/piper.html ; chargement et cache : piper-tts.js.

   Réglages = ceux des clips enregistrés (tools/voix.mjs, PARAMS) : même voix, même débit.
   Chaque phrase est synthétisée à part (comme piper 1.8 en Python) : amplitude ramenée à 1 puis × volume.

   Phonémiseur : on n'utilise que les données françaises d'espeak-ng (772 Ko sur 18 Mo) : la liste des fichiers du
   paquet (métadonnées écrites dans la colle emscripten) est réécrite pour ce sous-ensemble avant l'évaluation.
   Une barre « | » dans le texte coupe l'appel à espeak sans pause : « 38 | plusse 25 » garde le t de « trente-huit ».

   Licences : onnxruntime-web MIT ; piper-phonemize MIT mais il embarque espeak-ng (GPL-3.0-or-later, programme ET
   données) ; voix siwis : modèle Piper (MIT), données SIWIS CC BY 4.0. */

export const PARAMS = Object.freeze({ length_scale: 1.05, noise_scale: 0.75, noise_w: 0.9, sentence_silence: 0.35, volume: 0.9 });
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
/* paquet complet (18 Mo) → sous-ensemble français (≈ 772 Ko) */
export function extractSubset(full, sub) {
  const src = full instanceof Uint8Array ? full : new Uint8Array(full);
  const out = new Uint8Array(sub.size);
  for (const f of sub.files) out.set(src.subarray(f.from, f.from + (f.end - f.start)), f.start);
  return out;
}
/* colle emscripten réécrite pour ne charger que le sous-ensemble */
function patchGlue(glueSrc, sub) {
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
   repli prévu pour Safari si la mémoire partagée de 1.19+ y était refusée hors isolation). */
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
    const out = [];
    let cur = '';
    for (const ch of parts.join(' ')) {
      cur += ch;
      if (ch === '.' || ch === '!' || ch === '?') { if (cur.trim()) out.push(cur.trim()); cur = ''; }
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
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
      scales: new ort.Tensor('float32', Float32Array.of(p.noise_scale, p.length_scale, p.noise_w), [3])
    };
    if (multi) feeds.sid = new ort.Tensor('int64', BigInt64Array.of(0n), [1]);
    const res = await session.run(feeds);
    const pcm = Float32Array.from(res[session.outputNames[0]].data);
    for (const k of Object.keys(res)) try { res[k].dispose && res[k].dispose(); } catch (_) {}
    /* comme piper 1.8 : amplitude ramenée à 1, puis × volume */
    let peak = 0;
    for (let i = 0; i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > peak) peak = a; }
    const g = peak > 1e-8 ? (p.volume ?? 1) / peak : 0;
    for (let i = 0; i < pcm.length; i++) pcm[i] *= g;
    return { pcm, ids: ids.length, missing };
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
