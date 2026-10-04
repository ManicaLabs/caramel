/* ============ VOIX PIPER DANS LE NAVIGATEUR : TÉLÉCHARGEMENT, CACHE, LECTURE (prototype PT-proto) ============
   Banc d'essai : tests/harness/piper.html. Rien ici n'est branché sur l'appli (prototype à évaluer).

   Ce qui est téléchargé (une fois, puis gardé dans Cache Storage « piper-tts-v1 ») :
     onnxruntime-web 1.22.0 (MIT)       jsDelivr  ort.wasm.min.mjs 48 Ko + ort-wasm-simd-threaded.mjs 21 Ko + .wasm 11,2 Mo
                                                   (transfert brotli ≈ 2,4 Mo) ; un seul fil, SIMD obligatoire
     piper-phonemize + espeak-ng        jsDelivr  @diffusionstudio/piper-wasm@1.0.0 : colle 121 Ko, .wasm 635 Ko, données
       (espeak-ng : GPL-3.0-or-later)              18,1 Mo (9,3 Mo en brotli, toutes les langues) dont on ne GARDE que le
                                                   français (711 Ko) ; ou directement le sous-ensemble (option espeakUrl)
     voix siwis (MIT, données CC BY 4.0) huggingface.co/rhasspy/piper-voices (commit figé) : low 28,1 Mo (16 kHz),
                                                   medium 63,2 Mo (22,05 kHz, la voix des clips enregistrés)
   Le nom du cache ne commence pas par « caramel- » : sw.js supprime ces caches-là à chaque nouvelle version.

   API :
     loadPiper({ voice: 'low'|'medium', mode: 'worker'|'main', espeakUrl?, modelUrl? (variante du modèle, essais),
       ort? ('1.22.0' par défaut, '1.18.0' : .wasm sans mémoire partagée), onProgress?, log? }) → piper
       piper.synth(texte, { onSentence?, params? }) → { sentences, synthMs, audioSec, firstMs, rtf }  (texte déjà préparé)
       piper.speak(texte, { params?, onSentence? }) → idem, en jouant chaque phrase dès qu'elle est prête (Web Audio)
       piper.stop() ; piper.dispose() ; piper.info (temps de chargement, octets, cache)
     prepare(texteAffiché) → texte pour Piper : speakable() de l'appli + « plusse », « une pomme », nombres de calcul isolés
     unlockAudio() (à appeler dans le geste de l'utilisateur), encodeWav(pcm, rate), clearCache(), cacheBytes(), features() */
import { speakable, word100 } from '../../js/content/voice-lines.js';
import { PARAMS } from './piper-engine.js';

export const ORT_VERSION = '1.22.0';
const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@' + ORT_VERSION + '/dist/';
/* repli : 1.18.0, dernière version avec un .wasm sans fils (donc sans mémoire partagée) — option ort: '1.18.0' */
export const ORT_LEGACY = '1.18.0';
const ORT18 = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@' + ORT_LEGACY + '/dist/';
const PHON = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/';
const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/c10ece1aade47bb51c153c893d14e5bf8e5b7117/fr/fr_FR/siwis/';
export const CACHE = 'piper-tts-v1';
const ESPEAK_FR_KEY = PHON + 'piper_phonemize.data?sous-ensemble=fr';
const ESPEAK_FR_BYTES = 711140;

export const VOICES = Object.freeze({
  low: Object.freeze({ id: 'low', label: 'Légère', name: 'fr_FR-siwis-low', rate: 16000, bytes: 28130791 }),
  medium: Object.freeze({ id: 'medium', label: 'Standard', name: 'fr_FR-siwis-medium', rate: 22050, bytes: 63201294 })
});
export { PARAMS };

/* ---------- texte à dire ---------- */
const FEM = new Set(['pomme', 'pommes', 'étoile', 'étoiles', 'réponse', 'réponses', 'dizaine', 'dizaines', 'centaine',
  'centaines', 'unité', 'unités', 'minute', 'minutes', 'seconde', 'secondes', 'carotte', 'carottes', 'fraction', 'fractions']);
export function prepare(text) {
  /* « 7 × 8 = ? » passé par frTypo s'écrit « = ? » avec une espace fine insécable : speakable() (règle / = /) ne le
     lit plus « égale » ; on remet des espaces ordinaires autour du signe */
  let t = speakable(String(text).replace(/[\s\u00A0\u202F]*=[\s\u00A0\u202F]*/g, ' = '));
  /* « une » devant un nom féminin (1, 21… 81) : espeak dirait « un pomme » */
  t = t.replace(/(^|[^\d,\u00A0\u202F])(\d{1,2})(?=\s+(\p{L}+))/gu, (m, pre, n, w) => {
    const word = word100(Number(n));
    return FEM.has(w.toLowerCase()) && /un$/.test(word) ? pre + word.replace(/un$/, 'une') : m;
  });
  /* « plus » de calcul : [plys] (espeak lit [ply]) — entre deux nombres, avec « combien », « une de plus » */
  t = t.replace(/(\d|\bcombien)\s+plus\b(?=\s+(?:\d|combien))/giu, '$1 plusse');
  t = t.replace(/\bde plus(?=\s+dans\b|\s*[.!?,]|$)/giu, 'de plusse');
  /* calcul : un nombre suivi d'un signe (sauf « fois ») est lu seul, sans enchaînement : « trente-huit | plusse »
     garde son t, « six | égale » se dit [sis] et non [siz] ; « huit fois » reste [ɥi fwa] */
  t = t.replace(/(\d)\s+(?=(?:plusse|moins|égale|divisé)\b)/giu, '$1 | ');
  return t;
}

/* ---------- fichiers ---------- */
function filesFor(voice, espeakUrl, modelUrl, ort) {
  const v = VOICES[voice];
  if (!v) throw new Error('voix inconnue : ' + voice);
  const model = HF + voice + '/' + v.name + '.onnx';
  const runtime = ort === ORT_LEGACY
    ? [{ key: 'ortMjs', label: 'onnxruntime 1.18 (module)', url: ORT18 + 'esm/ort.wasm.min.js', bytes: 142864, text: true, step: 1 },
      { key: 'ortWasm', label: 'onnxruntime 1.18 (wasm)', url: ORT18 + 'ort-wasm-simd.wasm', bytes: 10595041, step: 2 }]
    : [{ key: 'ortMjs', label: 'onnxruntime (module)', url: ORT + 'ort.wasm.min.mjs', bytes: 48259, text: true, step: 1 },
      { key: 'ortGlue', label: 'onnxruntime (colle)', url: ORT + 'ort-wasm-simd-threaded.mjs', bytes: 20856, text: true, step: 1 },
      { key: 'ortWasm', label: 'onnxruntime (wasm)', url: ORT + 'ort-wasm-simd-threaded.wasm', bytes: 11210254, step: 2 }];
  return [
    ...runtime,
    { key: 'phonGlue', label: 'phonémiseur (colle)', url: PHON + 'piper_phonemize.js', bytes: 120714, text: true, step: 1 },
    { key: 'config', label: 'réglages de la voix', url: model + '.json', bytes: 5000, json: true, step: 1 },
    { key: 'phonWasm', label: 'phonémiseur (wasm)', url: PHON + 'piper_phonemize.wasm', bytes: 635212, step: 2 },
    espeakUrl
      ? { key: 'espeak', label: 'espeak-ng (français)', url: espeakUrl, bytes: ESPEAK_FR_BYTES, step: 2 }
      : { key: 'espeak', label: 'espeak-ng (données)', url: PHON + 'piper_phonemize.data', cacheKey: ESPEAK_FR_KEY,
        bytes: 18077249, cachedBytes: ESPEAK_FR_BYTES, subset: true, step: 2 },
    modelUrl
      ? { key: 'model', label: 'voix ' + v.name + ' (variante)', url: modelUrl, bytes: 0, step: 2 }
      : { key: 'model', label: 'voix ' + v.name, url: model, bytes: v.bytes, step: 2 }
  ];
}

async function openCache() {
  try { return await caches.open(CACHE); } catch (_) { return null; }   /* navigation privée, file:// … */
}
/* un fichier : depuis le cache, sinon du réseau avec progression ; le cache reçoit une copie du flux (pas une
   deuxième copie en mémoire) — sauf les données espeak, dont on ne garde que le sous-ensemble français */
async function getFile(f, cache, hit, onBytes, transform) {
  const key = f.cacheKey || f.url;
  if (hit) {
    try { const buf = await hit.arrayBuffer(); onBytes(buf.byteLength); return { buf, cached: true }; } catch (_) {}
  }
  const res = await fetch(f.url, { mode: 'cors', credentials: 'omit' });
  if (!res.ok || !res.body) throw new Error('téléchargement impossible (HTTP ' + res.status + ') : ' + f.url);
  let put = null;
  if (cache && !transform) put = cache.put(key, res.clone()).then(() => true, () => false);
  const reader = res.body.getReader();
  let out = new Uint8Array(f.bytes || 1 << 20), n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (n + value.length > out.length) {
      const bigger = new Uint8Array(Math.max(Math.ceil(out.length * 1.5), n + value.length));
      bigger.set(out.subarray(0, n));
      out = bigger;
    }
    out.set(value, n);
    n += value.length;
    onBytes(n);
  }
  let buf = n === out.length ? out.buffer : out.slice(0, n).buffer;
  let stored = put ? await put : false;
  if (transform) {
    buf = transform(buf);
    if (cache) stored = await cache.put(key, new Response(buf.slice(0))).then(() => true, () => false);
  }
  return { buf, cached: false, stored, netBytes: n };
}

export async function clearCache() {
  try { return await caches.delete(CACHE); } catch (_) { return false; }
}
export async function cacheBytes() {
  const cache = await openCache();
  if (!cache) return null;
  let total = 0;
  const entries = [];
  for (const req of await cache.keys()) {
    const r = await cache.match(req);
    /* taille sans tout relire en mémoire (Blob adossé au disque) ; pas content-length : pour une réponse brotli, il
       donne la taille compressée alors que le cache garde le contenu décompressé */
    const b = r ? (await r.blob()).size : 0;
    entries.push({ url: req.url, bytes: b });
    total += b;
  }
  return { total, entries };
}

/* ---------- appareil ---------- */
const SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
export function features() {
  const wasm = typeof WebAssembly === 'object';
  let simd = false;
  try { simd = wasm && WebAssembly.validate(SIMD_PROBE); } catch (_) {}
  return {
    wasm, simd,
    worker: typeof Worker === 'function',
    cacheStorage: typeof caches === 'object',
    crossOriginIsolated: !!globalThis.crossOriginIsolated,
    cores: navigator.hardwareConcurrency || null,
    deviceMemory: navigator.deviceMemory || null,
    ua: navigator.userAgent
  };
}

/* ---------- audio ---------- */
let ctx = null;
export function unlockAudio() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
export function encodeWav(pcm, rate) {
  const v = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data');
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 32767, true);
  return new Blob([v.buffer], { type: 'audio/wav' });
}
/* phrases bout à bout, avec le silence entre phrases des clips (PARAMS.sentence_silence) */
export function joinPcm(sentences, silence = PARAMS.sentence_silence) {
  if (!sentences.length) return new Float32Array(0);
  const rate = sentences[0].sampleRate, gap = Math.round(silence * rate);
  const out = new Float32Array(sentences.reduce((n, s) => n + s.pcm.length, 0) + gap * (sentences.length - 1));
  let o = 0;
  sentences.forEach((s, i) => { out.set(s.pcm, o); o += s.pcm.length + (i < sentences.length - 1 ? gap : 0); });
  return out;
}

/* ---------- chargement ---------- */
export async function loadPiper({ voice = 'low', mode = 'worker', espeakUrl = null, modelUrl = null, ort = ORT_VERSION, onProgress = () => {}, log = () => {} } = {}) {
  const t0 = performance.now();
  const files = filesFor(voice, espeakUrl, modelUrl, ort);
  const cache = await openCache();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (_) {}
  const got = {}, loaded = {}, hits = {};
  const info = { voice, mode, ort: ort === ORT_LEGACY ? ORT_LEGACY : ORT_VERSION, files: {}, network: 0, fromCache: 0, cachedAll: true };
  /* ce qui est déjà en cache (la barre de progression compte alors la taille gardée, pas celle à télécharger) */
  if (cache) {
    await Promise.all(files.map(async f => {
      try { hits[f.key] = await cache.match(f.cacheKey || f.url) || null; } catch (_) { hits[f.key] = null; }
      if (hits[f.key] && f.cachedBytes) f.bytes = f.cachedBytes;
    }));
  }
  const total = () => files.reduce((n, f) => n + (loaded[f.key] ?? 0), 0);
  const expected = () => files.reduce((n, f) => n + (f.done ? loaded[f.key] : f.bytes), 0);
  const tick = f => n => { loaded[f.key] = n; onProgress({ file: f.label, loaded: total(), total: expected() }); };
  const fetchOne = async f => {
    const t = performance.now();
    let transform = null;
    if (f.subset && !hits[f.key]) {
      const { packageMeta, subsetOf, extractSubset } = await import('./piper-engine.js');
      const sub = subsetOf(packageMeta(new TextDecoder().decode(got.phonGlue)).meta);
      transform = buf => extractSubset(buf, sub).buffer;
    }
    const r = await getFile(f, cache, hits[f.key], tick(f), transform);
    f.done = true;
    got[f.key] = r.buf;
    info.files[f.key] = { url: f.url, bytes: r.buf.byteLength, cached: r.cached, ms: Math.round(performance.now() - t), netBytes: r.netBytes || 0 };
    if (r.cached) info.fromCache += r.buf.byteLength; else { info.network += r.netBytes; info.cachedAll = false; }
    log((r.cached ? 'cache : ' : 'réseau : ') + f.label + ' (' + (r.cached ? r.buf.byteLength : r.netBytes) + ' o, ' + info.files[f.key].ms + ' ms)');
  };
  await Promise.all(files.filter(f => f.step === 1).map(fetchOne));
  await Promise.all(files.filter(f => f.step === 2).map(fetchOne));
  info.fetchMs = Math.round(performance.now() - t0);

  const dec = b => new TextDecoder().decode(b);
  const payload = {
    ortMjs: dec(got.ortMjs), ortGlue: got.ortGlue ? dec(got.ortGlue) : null, ortGlueHref: got.ortGlue ? files.find(f => f.key === 'ortGlue').url : null,
    phonGlue: dec(got.phonGlue), config: JSON.parse(dec(got.config)),
    ortWasm: got.ortWasm, phonWasm: got.phonWasm, espeak: got.espeak, model: got.model
  };
  const tb = performance.now();
  let worker = null, engine = null, timings, sampleRate;
  const pending = new Map();
  let seq = 0;
  if (mode === 'worker') {
    worker = new Worker(new URL('./piper-worker.js', import.meta.url), { type: 'module' });
    const ready = new Promise((resolve, reject) => {
      worker.onmessage = ({ data: m }) => {
        if (m.type === 'log') log('worker : ' + m.text);
        else if (m.type === 'ready') resolve(m);
        else if (m.type === 'error' && m.id === undefined) reject(new Error(m.message));
        else if (pending.has(m.id)) pending.get(m.id)(m);
      };
      worker.onerror = e => reject(new Error('worker : ' + (e.message || 'erreur au démarrage')));
    });
    worker.postMessage({ type: 'init', files: payload }, [payload.ortWasm, payload.phonWasm, payload.espeak, payload.model]);
    ({ timings, sampleRate } = await ready);
  } else {
    const { boot } = await import('./piper-engine.js');
    engine = await boot(payload, s => log('moteur : ' + s));
    ({ timings, sampleRate } = engine);
  }
  info.bootMs = Math.round(performance.now() - tb);
  info.timings = timings;
  info.sampleRate = sampleRate;
  info.loadMs = Math.round(performance.now() - t0);
  log('voix prête en ' + info.loadMs + ' ms (fichiers ' + info.fetchMs + ' ms, démarrage ' + info.bootMs + ' ms)');

  /* une synthèse : phrase par phrase ; onSentence reçoit chaque phrase dès qu'elle est prête */
  async function synth(text, { onSentence = () => {}, params = PARAMS } = {}) {
    const t = performance.now();
    const sentences = [];
    let firstMs = null;
    const take = s => {
      const sent = { ...s, ms: Math.round(performance.now() - t), dur: s.pcm.length / s.sampleRate };
      if (firstMs === null) firstMs = sent.ms;
      sentences.push(sent);
      onSentence(sent);
    };
    if (engine) {
      for await (const s of engine.sentences(text, params)) take(s);
    } else {
      const id = ++seq;
      await new Promise((resolve, reject) => {
        pending.set(id, m => {
          if (m.type === 'sentence') take(m);
          else if (m.type === 'done') { pending.delete(id); resolve(); }
          else if (m.type === 'error') { pending.delete(id); reject(new Error(m.message)); }
        });
        worker.postMessage({ type: 'synth', id, text, params });
      });
    }
    const synthMs = Math.round(performance.now() - t);
    const audioSec = sentences.reduce((a, s) => a + s.dur, 0) + params.sentence_silence * Math.max(0, sentences.length - 1);
    return { sentences, synthMs, firstMs, audioSec, rtf: audioSec ? synthMs / 1000 / audioSec : 0,
      inferMs: sentences.reduce((a, s) => a + s.inferMs, 0), phonMs: sentences.reduce((a, s) => a + s.phonMs, 0) };
  }

  let playing = [];
  function stop() { for (const src of playing) try { src.stop(); } catch (_) {} playing = []; }
  async function speak(text, { params = PARAMS, onSentence = () => {} } = {}) {
    const c = unlockAudio();
    stop();
    const t = performance.now();
    let at = 0, firstSound = null;
    const r = await synth(text, { params, onSentence: s => {
      if (c) {
        const b = c.createBuffer(1, s.pcm.length, s.sampleRate);
        b.copyToChannel(s.pcm, 0);
        const src = c.createBufferSource();
        src.buffer = b;
        src.connect(c.destination);
        const start = Math.max(c.currentTime + 0.03, at);
        src.start(start);
        playing.push(src);
        if (firstSound === null) firstSound = Math.round(performance.now() - t + (start - c.currentTime) * 1000);
        at = start + b.duration + params.sentence_silence;
      }
      onSentence(s);
    } });
    r.firstSoundMs = firstSound;
    return r;
  }

  return {
    voice, mode, info, sampleRate, synth, speak, stop,
    dispose() { stop(); if (worker) worker.terminate(); if (engine) engine.release(); }
  };
}
