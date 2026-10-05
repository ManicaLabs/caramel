/* ============ VOIX FLUIDE : TÉLÉCHARGEMENT, CACHE, DÉMARRAGE, SYNTHÈSE (v2.2.2, d'après le prototype PT-proto) ============
   La voix des clips enregistrés (Piper « siwis medium », rajeunie en voix d'enfant : YOUTH de piper-engine.js) calculée
   sur l'appareil : les phrases composées (calculs, nombres, explications) d'un seul tenant, et le prénom de l'enfant. Utilisé par l'appli (js/core/voice-fluid.js :
   quand télécharger, démarrage, étalonnage, préparation à l'avance) et par le banc d'essai tests/harness/piper.html.
   Aucun accès au DOM au chargement (importable dans Node et dans le worker) ; moteur : js/core/piper-engine.js.

   Ce qui est téléchargé (une fois, puis gardé dans Cache Storage « piper-tts-v1 », jamais purgé par sw.js : son nom ne
   commence pas par « caramel- ») — ≈ 44 Mo transférés, ≈ 45 Mo gardés :
     onnxruntime-web 1.22.0 (MIT)        jsDelivr  ort.wasm.min.mjs + ort-wasm-simd-threaded.mjs + .wasm 11,2 Mo (2,4 Mo
                                                    transférés) ; un seul fil, SIMD obligatoire. Repli 1.18.0 (.wasm sans
                                                    mémoire partagée) quand l'appareil refuse la mémoire partagée.
     piper-phonemize (MIT) + espeak-ng   jsDelivr  @diffusionstudio/piper-wasm@1.0.0 : colle 121 Ko, .wasm 635 Ko ; données
       (espeak-ng : GPL-3.0-or-later)               18,1 Mo (9,3 Mo transférés, toutes les langues) dont on ne GARDE que le
                                                    sous-ensemble français (711 Ko), extrait au premier téléchargement :
                                                    aucun fichier GPL n'est hébergé dans le dépôt.
     voix siwis medium (dépôt)           models/piper/fr_FR-siwis-medium-f16.onnx (32,0 Mo, poids convertis en float16 :
                                                    tools/piper-modele.py ; Piper MIT, données SIWIS CC BY 4.0) + réglages.
   Le cache reçoit chaque fichier en flux (pas de seconde copie en mémoire) ; le worker relit ensuite le modèle depuis le
   cache (le tampon téléchargé n'est pas gardé).

   API :
     filesFor({ voice?, ort?, espeakUrl?, modelUrl? }) → descriptions des fichiers ; missingFiles(files) → absents du cache
     ensureFiles(files, { onProgress?, signal?, log? }) → { network, fetched, buffers } (télécharge ce qui manque)
     loadPiper({ voice?, mode: 'worker'|'main', ort?, espeakUrl?, modelUrl?, onProgress?, log?, signal?, bootTimeoutMs?,
       download? }) → piper { synth(texte, { onSentence?, params? }), speak(texte) (banc d'essai), stop(), dispose(), info }
       (download: false : rien n'est téléchargé, un fichier absent du cache → erreur code 'absent')
     prepare(texteAffiché) → texte pour Piper ; features() ; sharedMemory() ; ortFor(features) ; clearCache() ; cacheBytes() ;
     prune(files) ; unlockAudio() ; encodeWav(pcm, rate) ; joinPcm(phrases)
     params : PARAMS (réglages des clips, voix d'enfant comprise) ; { ...PARAMS, youth: YOUTH_DEGREES[d] } : un autre degré */
import { fluidText } from '../content/voice-lines.js';
import { PARAMS, YOUTH, YOUTH_DEGREES, packageMeta, subsetOf, extractSubset } from './piper-engine.js';

export { PARAMS, YOUTH, YOUTH_DEGREES };
export const ORT_VERSION = '1.22.0';
/* repli : 1.18.0, dernière version avec un .wasm sans fils (donc sans mémoire partagée) */
export const ORT_LEGACY = '1.18.0';
const ORT = v => 'https://cdn.jsdelivr.net/npm/onnxruntime-web@' + v + '/dist/';
const PHON = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/';
const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/c10ece1aade47bb51c153c893d14e5bf8e5b7117/fr/fr_FR/siwis/';
export const CACHE = 'piper-tts-v1';
/* racine de l'appli (ce module est dans js/core/) : mêmes adresses depuis la page, le banc d'essai et le worker */
const ROOT = (() => { try { return new URL('../../', import.meta.url).href; } catch (_) { return ''; } })();
const ESPEAK_FR_KEY = PHON + 'piper_phonemize.data?sous-ensemble=fr';
const ESPEAK_FR_BYTES = 711140;
/* empreinte du modèle dans l'adresse : un modèle refait est un autre fichier en cache */
const MODEL_TAG = '4d426066';

export const VOICES = Object.freeze({
  medium: Object.freeze({ id: 'medium', label: 'Standard', name: 'fr_FR-siwis-medium', rate: 22050, bytes: 32041984,
    url: ROOT + 'models/piper/fr_FR-siwis-medium-f16.onnx?v=' + MODEL_TAG, config: ROOT + 'models/piper/fr_FR-siwis-medium-f16.onnx.json?v=' + MODEL_TAG }),
  low: Object.freeze({ id: 'low', label: 'Légère', name: 'fr_FR-siwis-low', rate: 16000, bytes: 28130791,
    url: HF + 'low/fr_FR-siwis-low.onnx', config: HF + 'low/fr_FR-siwis-low.onnx.json' })
});
/* octets transférés au premier téléchargement de la voix de l'appli (onnxruntime 1.22 compressé, espeak complet compressé) */
export const DOWNLOAD_BYTES = 2426498 + 29400 + 212596 + 9283715 + 32041984 + 4875;

/* ---------- texte à dire ---------- */
/* texte affiché → texte pour Piper (js/content/voice-lines.js, fluidText : « plusse », « une pomme », nombres de calcul
   lus d'un bloc) */
export const prepare = fluidText;

/* ---------- fichiers ---------- */
export function filesFor({ voice = 'medium', ort = ORT_VERSION, espeakUrl = null, modelUrl = null } = {}) {
  const v = VOICES[voice];
  if (!v) throw new Error('voix inconnue : ' + voice);
  const runtime = ort === ORT_LEGACY
    ? [{ key: 'ortMjs', label: 'onnxruntime 1.18 (module)', url: ORT(ORT_LEGACY) + 'esm/ort.wasm.min.js', bytes: 142864, text: true, step: 1 },
      { key: 'ortWasm', label: 'onnxruntime 1.18 (wasm)', url: ORT(ORT_LEGACY) + 'ort-wasm-simd.wasm', bytes: 10595041, step: 2 }]
    : [{ key: 'ortMjs', label: 'onnxruntime (module)', url: ORT(ORT_VERSION) + 'ort.wasm.min.mjs', bytes: 48259, text: true, step: 1 },
      { key: 'ortGlue', label: 'onnxruntime (colle)', url: ORT(ORT_VERSION) + 'ort-wasm-simd-threaded.mjs', bytes: 20856, text: true, step: 1 },
      { key: 'ortWasm', label: 'onnxruntime (wasm)', url: ORT(ORT_VERSION) + 'ort-wasm-simd-threaded.wasm', bytes: 11210254, step: 2 }];
  return [
    ...runtime,
    { key: 'phonGlue', label: 'phonémiseur (colle)', url: PHON + 'piper_phonemize.js', bytes: 120714, text: true, step: 1 },
    { key: 'config', label: 'réglages de la voix', url: modelUrl ? modelUrl + '.json' : v.config, bytes: 4875, json: true, step: 1 },
    { key: 'phonWasm', label: 'phonémiseur (wasm)', url: PHON + 'piper_phonemize.wasm', bytes: 635212, step: 2 },
    espeakUrl
      ? { key: 'espeak', label: 'espeak-ng (français)', url: espeakUrl, bytes: ESPEAK_FR_BYTES, step: 2 }
      : { key: 'espeak', label: 'espeak-ng (données)', url: PHON + 'piper_phonemize.data', cacheKey: ESPEAK_FR_KEY,
        bytes: 18077249, cachedBytes: ESPEAK_FR_BYTES, subset: true, step: 2 },
    { key: 'model', label: 'voix ' + v.name + (modelUrl ? ' (variante)' : ''), url: modelUrl || v.url, bytes: modelUrl ? 0 : v.bytes, step: 3 }
  ];
}
const keyOf = f => f.cacheKey || f.url;
const G = globalThis;

async function openCache() {
  try { return G.caches ? await G.caches.open(CACHE) : null; } catch (_) { return null; }   /* navigation privée, file:// … */
}
const abortError = () => { const e = new Error('téléchargement interrompu'); e.name = 'AbortError'; e.code = 'aborted'; return e; };

/* fichiers absents du cache (tous si le cache est inaccessible) */
export async function missingFiles(files) {
  const cache = await openCache();
  if (!cache) return files.slice();
  const out = [];
  for (const f of files) {
    let hit = null;
    try { hit = await cache.match(keyOf(f)); } catch (_) { hit = null; }
    if (!hit) out.push(f);
  }
  return out;
}

/* un fichier entier en mémoire, avec progression */
async function fetchAll(f, signal, onBytes) {
  const res = await G.fetch(f.url, { mode: 'cors', credentials: 'omit', signal });
  if (!res.ok || !res.body) { const e = new Error('téléchargement impossible (HTTP ' + res.status + ') : ' + f.url); e.code = 'http'; throw e; }
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
  return n === out.length ? out.buffer : out.slice(0, n).buffer;
}
/* un fichier vers le cache, en flux (compté au passage) → true si gardé */
async function streamToCache(cache, f, signal, onBytes) {
  if (typeof G.TransformStream !== 'function' || typeof G.Response !== 'function') return false;
  const res = await G.fetch(f.url, { mode: 'cors', credentials: 'omit', signal });
  if (!res.ok || !res.body) { const e = new Error('téléchargement impossible (HTTP ' + res.status + ') : ' + f.url); e.code = 'http'; throw e; }
  let n = 0;
  const count = new G.TransformStream({ transform(chunk, ctl) { n += chunk.byteLength; onBytes(n); ctl.enqueue(chunk); } });
  const type = res.headers.get('Content-Type') || 'application/octet-stream';
  await cache.put(keyOf(f), new G.Response(res.body.pipeThrough(count), { headers: { 'Content-Type': type } }));
  if (signal && signal.aborted) throw abortError();
  return true;
}

/* télécharge ce qui manque. onProgress({ file, loaded, total }) : octets (décompressés) reçus sur ceux attendus.
   → { network (octets reçus), fetched (fichiers), buffers } ; buffers : fichiers que le cache n'a pas pu garder */
export async function ensureFiles(files, { onProgress = () => {}, signal = null, log = () => {} } = {}) {
  const cache = await openCache();
  const need = await missingFiles(files);
  const buffers = {};
  if (!need.length) return { network: 0, fetched: 0, buffers };
  try { if (G.navigator && G.navigator.storage && G.navigator.storage.persist) G.navigator.storage.persist().catch(() => {}); } catch (_) {}
  const loaded = {};
  const total = need.reduce((s, f) => s + (f.bytes || 0), 0);
  const tick = f => n => { loaded[f.key] = n; onProgress({ file: f.label, loaded: Object.values(loaded).reduce((a, b) => a + b, 0), total: Math.max(total, 1) }); };
  const text = async f => {
    if (buffers[f.key]) return new TextDecoder().decode(buffers[f.key]);
    const hit = cache ? await cache.match(keyOf(f)) : null;
    if (!hit) throw new Error('fichier absent : ' + f.label);
    return hit.text();
  };
  let network = 0;
  for (const f of need.slice().sort((a, b) => (a.step || 9) - (b.step || 9))) {
    if (signal && signal.aborted) throw abortError();
    const t = Date.now();
    try {
      if (f.subset) {
        /* données espeak : le paquet complet (toutes les langues) n'est jamais gardé, seulement le français */
        const glue = await text(files.find(x => x.key === 'phonGlue'));
        const sub = subsetOf(packageMeta(glue).meta);
        const full = await fetchAll(f, signal, tick(f));
        network += full.byteLength;
        const part = extractSubset(full, sub);
        let kept = false;
        if (cache) { try { await cache.put(keyOf(f), new G.Response(part)); kept = true; } catch (_) { kept = false; } }
        if (!kept) buffers[f.key] = part.buffer;
      } else {
        let kept = false;
        if (cache) {
          try { kept = await streamToCache(cache, f, signal, tick(f)); } catch (e) { if (e && (e.name === 'AbortError' || e.code === 'http')) throw e; kept = false; }
        }
        if (!kept) buffers[f.key] = await fetchAll(f, signal, tick(f));
        network += loaded[f.key] || 0;
      }
    } catch (e) {
      if (signal && signal.aborted) throw abortError();
      throw e;
    }
    log('réseau : ' + f.label + ' (' + (loaded[f.key] || 0) + ' o, ' + (Date.now() - t) + ' ms)');
  }
  return { network, fetched: need.length, buffers };
}

/* fichiers → ce que le moteur attend (depuis les tampons fournis, sinon le cache) ; dans le worker comme sur la page */
export async function readPayload(files, { buffers = {} } = {}) {
  const cache = await openCache();
  const got = {};
  await Promise.all(files.map(async f => {
    if (buffers[f.key]) { got[f.key] = buffers[f.key]; return; }
    let hit = null;
    try { hit = cache ? await cache.match(keyOf(f)) : null; } catch (_) { hit = null; }
    if (!hit) { const e = new Error('fichier absent du cache : ' + f.label); e.code = 'absent'; throw e; }
    got[f.key] = await hit.arrayBuffer();
  }));
  const dec = b => new TextDecoder().decode(b);
  const glue = files.find(f => f.key === 'ortGlue');
  return {
    ortMjs: dec(got.ortMjs), ortGlue: got.ortGlue ? dec(got.ortGlue) : null, ortGlueHref: glue ? glue.url : null,
    phonGlue: dec(got.phonGlue), config: JSON.parse(dec(got.config)),
    ortWasm: got.ortWasm, phonWasm: got.phonWasm, espeak: got.espeak, model: got.model
  };
}

export async function clearCache() {
  try { return G.caches ? await G.caches.delete(CACHE) : false; } catch (_) { return false; }
}
/* retire du cache ce qui n'est plus dans la liste (ancienne version d'onnxruntime, ancien modèle) */
export async function prune(files) {
  const cache = await openCache();
  if (!cache) return 0;
  const want = new Set(files.map(keyOf));
  let n = 0;
  try {
    for (const req of await cache.keys()) {
      if (!want.has(req.url)) { await cache.delete(req); n++; }
    }
  } catch (_) {}
  return n;
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
/* mémoire partagée de WebAssembly (onnxruntime 1.19+ la réclame, 4 Go au plus) : sinon onnxruntime 1.18 */
export function sharedMemory() {
  try { return !!new WebAssembly.Memory({ initial: 1, maximum: 65536, shared: true }); } catch (_) { return false; }
}
let moduleWorkerOk = null;
function moduleWorker() {
  if (moduleWorkerOk !== null) return moduleWorkerOk;
  moduleWorkerOk = false;
  if (typeof G.Worker !== 'function') return false;
  /* l'option type n'est lue que par les navigateurs qui savent faire des workers modules */
  try { new G.Worker('data:,', { get type() { moduleWorkerOk = true; return 'module'; } }).terminate(); } catch (_) {}
  return moduleWorkerOk;
}
export function features() {
  const wasm = typeof WebAssembly === 'object';
  let simd = false;
  try { simd = wasm && WebAssembly.validate(SIMD_PROBE); } catch (_) {}
  const n = G.navigator || {};
  return {
    wasm, simd, shared: wasm && sharedMemory(),
    worker: typeof G.Worker === 'function', moduleWorker: moduleWorker(),
    cacheStorage: typeof G.caches === 'object' && !!G.caches,
    crossOriginIsolated: !!G.crossOriginIsolated,
    cores: n.hardwareConcurrency || null,
    deviceMemory: n.deviceMemory || null,
    ua: n.userAgent || ''
  };
}
/* onnxruntime à utiliser sur cet appareil */
export const ortFor = f => (f && f.shared === false ? ORT_LEGACY : ORT_VERSION);

/* ---------- audio (banc d'essai) ---------- */
let ctx = null;
export function unlockAudio() {
  const AC = G.AudioContext || G.webkitAudioContext;
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
const nowMs = () => (G.performance ? G.performance.now() : Date.now());
export async function loadPiper({ voice = 'medium', mode = 'worker', espeakUrl = null, modelUrl = null, ort = ORT_VERSION, onProgress = () => {},
  log = () => {}, signal = null, bootTimeoutMs = 0, download = true } = {}) {
  const t0 = nowMs();
  const files = filesFor({ voice, ort, espeakUrl, modelUrl });
  const info = { voice, mode, ort: ort === ORT_LEGACY ? ORT_LEGACY : ORT_VERSION, network: 0, fetched: 0 };
  let buffers = {};
  if (download) {
    const r = await ensureFiles(files, { onProgress, signal, log });
    buffers = r.buffers; info.network = r.network; info.fetched = r.fetched;
  } else if ((await missingFiles(files)).length) {
    const e = new Error('voix fluide absente du cache'); e.code = 'absent'; throw e;
  }
  info.cachedAll = !info.fetched;
  info.fetchMs = Math.round(nowMs() - t0);
  if (signal && signal.aborted) throw abortError();

  const tb = nowMs();
  let worker = null, engine = null, timings, sampleRate;
  const pending = new Map();
  let seq = 0, dead = null;
  const fail = err => {
    if (dead) return;
    dead = err;
    for (const fn of pending.values()) { try { fn({ type: 'error', message: err.message }); } catch (_) {} }
    pending.clear();
  };
  if (mode === 'worker') {
    worker = new G.Worker(new URL('./piper-worker.js', import.meta.url), { type: 'module' });
    const ready = new Promise((resolve, reject) => {
      let timer = 0;
      if (bootTimeoutMs > 0) timer = setTimeout(() => { const e = new Error('démarrage trop long'); e.code = 'boot-timeout'; reject(e); }, bootTimeoutMs);
      worker.onmessage = ({ data: m }) => {
        if (m.type === 'log') log('worker : ' + m.text);
        else if (m.type === 'ready') { clearTimeout(timer); resolve(m); }
        else if (m.type === 'error' && m.id === undefined) { clearTimeout(timer); const e = new Error(m.message); e.code = m.code || 'boot'; reject(e); fail(e); }
        else if (pending.has(m.id)) pending.get(m.id)(m);
      };
      worker.onerror = e => { clearTimeout(timer); const err = new Error('worker : ' + ((e && e.message) || 'erreur')); err.code = 'worker'; reject(err); fail(err); };
      /* démarrage abandonné (le micro démarre, la voix est supprimée) : le worker est arrêté sur-le-champ */
      if (signal) signal.addEventListener('abort', () => { clearTimeout(timer); reject(abortError()); }, { once: true });
    });
    const transfer = Object.values(buffers).filter(b => b instanceof ArrayBuffer);
    worker.postMessage({ type: 'init', files: files.map(({ key, url, cacheKey, text, json }) => ({ key, url, cacheKey, text, json })), buffers }, transfer);
    try { ({ timings, sampleRate } = await ready); } catch (e) { try { worker.terminate(); } catch (_) {} throw e; }
  } else {
    const { boot } = await import('./piper-engine.js');
    engine = await boot(await readPayload(files, { buffers }), s => log('moteur : ' + s));
    ({ timings, sampleRate } = engine);
  }
  buffers = null;
  info.bootMs = Math.round(nowMs() - tb);
  info.timings = timings;
  info.sampleRate = sampleRate;
  info.loadMs = Math.round(nowMs() - t0);
  info.files = files;
  log('voix prête en ' + info.loadMs + ' ms (fichiers ' + info.fetchMs + ' ms, démarrage ' + info.bootMs + ' ms)');

  /* une synthèse : phrase par phrase ; onSentence reçoit chaque phrase dès qu'elle est prête */
  async function synth(text, { onSentence = () => {}, params = PARAMS } = {}) {
    if (dead) throw dead;
    const t = nowMs();
    const sentences = [];
    let firstMs = null;
    const take = s => {
      const sent = { ...s, ms: Math.round(nowMs() - t), dur: s.pcm.length / s.sampleRate };
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
    const synthMs = Math.round(nowMs() - t);
    const audioSec = sentences.reduce((a, s) => a + s.dur, 0) + params.sentence_silence * Math.max(0, sentences.length - 1);
    return { sentences, synthMs, firstMs, audioSec, rtf: audioSec ? synthMs / 1000 / audioSec : 0,
      inferMs: sentences.reduce((a, s) => a + s.inferMs, 0), phonMs: sentences.reduce((a, s) => a + s.phonMs, 0) };
  }

  let playing = [];
  function stop() { for (const src of playing) try { src.stop(); } catch (_) {} playing = []; }
  /* banc d'essai : chaque phrase est jouée dès qu'elle est prête (Web Audio) */
  async function speak(text, { params = PARAMS, onSentence = () => {} } = {}) {
    const c = unlockAudio();
    stop();
    const t = nowMs();
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
        if (firstSound === null) firstSound = Math.round(nowMs() - t + (start - c.currentTime) * 1000);
        at = start + b.duration + params.sentence_silence;
      }
      onSentence(s);
    } });
    r.firstSoundMs = firstSound;
    return r;
  }

  return {
    voice, mode, info, sampleRate, synth, speak, stop,
    get alive() { return !dead; },
    dispose() { stop(); fail(Object.assign(new Error('voix fluide libérée'), { code: 'disposed' })); if (worker) worker.terminate(); if (engine) engine.release(); }
  };
}
