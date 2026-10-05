/* ============ VOIX ENREGISTRÉE DU COMPAGNON : lecture des clips (v2.2.2) ============
   Les clips MP3 (audio/voix/<id>.mp3, manifeste js/content/voice-manifest.js, générés par tools/voix.mjs) sont joués
   l'un après l'autre par Web Audio, dans le contexte partagé de js/core/audio.js (sortie directe, hors du muet : la voix
   obéit aux mêmes règles que la synthèse, décidées par js/ui/voice.js). Enchaînement sans trou : tous les clips d'une
   phrase sont chargés et décodés AVANT le départ, puis programmés à l'échantillon près avec le silence voulu (GAP de
   js/content/voice-lines.js) ; le silence que le décodeur MP3 laisse en tête et en queue est retiré au décodage.
   Fichiers : cache dédié 'caramel-voix-v1' (jamais effacé aux mises à jour, comme le modèle Vosk ; sw.js y range aussi
   ce qu'il voit passer), rempli à la première écoute ; prefetch() le remplit en tâche de fond, prune() retire les clips
   d'anciennes versions. Clip introuvable (hors ligne et jamais entendu) → play() résout { ok: false, reason: 'load' } :
   js/ui/voice.js passe alors à la synthèse du téléphone.
   Importable dans Node : aucun accès au navigateur au chargement ; _setBackend() pour les tests (faux Web Audio).
   API :
     has(id) ; urlOf(id) → 'audio/voix/<id>.mp3?v=<empreinte>' ; supported() ; buffer(id) → Promise<{ buf, a, b }> (décodé)
     play([{ id, gap }]) → Promise<{ ok, reason, heard }> ; reason : '' | 'cancelled' | 'load' | 'no-audio' | 'not-allowed'
     stop() ; playing() ; settle() → Promise résolue quand plus rien ne joue
     prefetch(ids, { gapMs }) → Promise<nombre de clips mis en cache> ; prune() → Promise */
import { VOICE } from '../content/voice-manifest.js';
import * as audio from './audio.js';

export const CACHE = 'caramel-voix-v1';
const CLIPS = (VOICE && VOICE.clips) || {};
const BASE = (VOICE && VOICE.base) || 'audio/voix/';
const MAX_DECODED_S = 60;          /* tampons décodés gardés en mémoire (≈ 10 Mo à 44,1 kHz) */
const LEAD = 0.03;                 /* s : marge de programmation avant le 1er clip */
const G = globalThis;
let backend = null;                /* tests : { context(), fetch(url), caches } */

const ctxOf = () => (backend ? backend.context() : audio.context());
const fetchOf = url => (backend && backend.fetch ? backend.fetch(url) : G.fetch(url));
const cachesOf = () => { try { return (backend ? backend.caches : G.caches) || null; } catch (_) { return null; } };
const R = (ok, reason = '', heard = ok) => ({ ok, reason, heard: !!heard });
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export function has(id) { return own(CLIPS, id); }
export function urlOf(id) { return has(id) ? BASE + id + '.mp3?v=' + CLIPS[id][1] : null; }
export function count() { return Object.keys(CLIPS).length; }
/* Web Audio et fetch disponibles, et des clips à jouer */
export function supported() {
  if (backend) return true;
  try { return !!(G.AudioContext || G.webkitAudioContext) && typeof G.fetch === 'function' && count() > 0; } catch (_) { return false; }
}

/* ---------- chargement ---------- */
async function bytesOf(id) {
  const url = urlOf(id);
  const cs = cachesOf();
  let cache = null;
  if (cs) {
    try {
      cache = await cs.open(CACHE);
      const hit = await cache.match(url);
      if (hit) return await hit.arrayBuffer();
    } catch (_) { cache = null; }
  }
  /* hors ligne et jamais entendu : inutile de demander (le service worker répondrait 503, une erreur de plus en console) */
  if (!backend && G.navigator && G.navigator.onLine === false) throw new Error('clip ' + id + ' : hors ligne');
  const res = await fetchOf(url);
  if (!res || !res.ok) throw new Error('clip ' + id + ' : ' + (res ? res.status : 'réseau'));
  if (cache) { try { await cache.put(url, res.clone()); } catch (_) {} }
  return res.arrayBuffer();
}
function decode(ac, data) {
  return new Promise((res, rej) => {
    try {
      const p = ac.decodeAudioData(data, res, rej);          /* vieux Safari : rappels seulement */
      if (p && typeof p.then === 'function') p.then(res, rej);
    } catch (e) { rej(e); }
  });
}
/* bornes de la voix dans le tampon : le décodeur MP3 laisse ≈ 50 ms de silence en tête (retard du codeur) */
export function bounds(buf) {
  const d = buf.getChannelData(0), n = d.length, sr = buf.sampleRate, thr = 0.004;
  let a = 0;
  while (a < n && Math.abs(d[a]) < thr) a++;
  let b = n - 1;
  while (b > a && Math.abs(d[b]) < thr) b--;
  if (a >= n) return { a: 0, b: 0 };
  return { a: Math.max(0, a - Math.round(0.006 * sr)) / sr, b: Math.min(n, b + 1 + Math.round(0.012 * sr)) / sr };
}
const decoded = new Map();          /* id → { buf, a, b } (ordre d'usage : le plus ancien d'abord) */
const loading = new Map();          /* id → Promise */
let decodedS = 0;
function remember(id, d) {
  decoded.set(id, d);
  decodedS += d.buf.duration || 0;
  while (decodedS > MAX_DECODED_S && decoded.size > 1) {
    const [k, v] = decoded.entries().next().value;
    decoded.delete(k);
    decodedS -= v.buf.duration || 0;
  }
}
function load(ac, id) {
  const d = decoded.get(id);
  if (d) { decoded.delete(id); decoded.set(id, d); return Promise.resolve(d); }
  if (loading.has(id)) return loading.get(id);
  const p = bytesOf(id).then(data => decode(ac, data)).then(buf => {
    const v = { buf, ...bounds(buf) };
    remember(id, v);
    return v;
  }).finally(() => loading.delete(id));
  loading.set(id, p);
  return p;
}

/* un clip décodé, bornes de la voix comprises → Promise<{ buf, a, b }> (voix fluide : js/core/voice-fluid.js enchaîne
   clips et phrases calculées dans le même contexte) */
export function buffer(id) {
  if (!has(id)) return Promise.reject(new Error('clip inconnu : ' + id));
  const ac = ctxOf();
  if (!ac) return Promise.reject(new Error('pas de son'));
  return load(ac, id);
}

/* ---------- lecture ---------- */
let job = null;                     /* { cancelled, srcs, t0, finish } */
const settleFns = new Set();
function resumeCtx(ac) {
  if (ac.state === 'running') return Promise.resolve(true);
  return new Promise(res => {
    let done = false;
    const fin = () => { if (!done) { done = true; res(ac.state === 'running'); } };
    try { const p = backend ? ac.resume() : audio.unlock(); if (p && typeof p.then === 'function') p.then(fin, fin); } catch (_) {}
    setTimeout(fin, 400);
  });
}
export function play(list) {
  stop();
  const clips = Array.isArray(list) ? list.filter(c => c && has(c.id)) : [];
  const my = job = { cancelled: false, srcs: [], t0: 0, ac: null, finish: null, timer: 0 };
  return new Promise(resolve => {
    my.finish = r => {
      if (my.done) return;
      my.done = true;
      clearTimeout(my.timer);
      if (job === my) job = null;
      resolve(r);
      if (!job) { for (const fn of settleFns) { try { fn(); } catch (_) {} } settleFns.clear(); }
    };
    (async () => {
      if (!clips.length) { my.finish(R(false, 'load')); return; }
      const ac = ctxOf();
      if (!ac) { my.finish(R(false, 'no-audio')); return; }
      my.ac = ac;
      if (!await resumeCtx(ac)) { my.finish(R(false, 'not-allowed')); return; }
      let parts;
      try { parts = await Promise.all(clips.map(c => load(ac, c.id))); } catch (_) { my.finish(R(false, 'load')); return; }
      if (my.cancelled) { my.finish(R(false, 'cancelled')); return; }
      let t = ac.currentTime + LEAD;
      my.t0 = t;
      try {
        clips.forEach((c, i) => {
          const p = parts[i];
          if (i > 0) t += Math.max(0, Number(c.gap) || 0) / 1000;
          const len = Math.max(0.01, p.b - p.a);
          const s = ac.createBufferSource();
          s.buffer = p.buf;
          s.connect(ac.destination);
          s.start(t, p.a, len);
          my.srcs.push(s);
          t += len;
        });
      } catch (_) { stopSources(my); my.finish(R(false, 'no-audio')); return; }
      const last = my.srcs[my.srcs.length - 1];
      last.onended = () => my.finish(R(true));
      /* filet : « ended » perdu (contexte suspendu par le système…) */
      my.timer = setTimeout(() => my.finish(R(true)), Math.max(0, (t - ac.currentTime) * 1000) + 800);
    })().catch(() => my.finish(R(false, 'no-audio')));
  });
}
function stopSources(j) {
  for (const s of j.srcs) {
    try { s.onended = null; } catch (_) {}
    try { s.stop(); } catch (_) {}
    try { s.disconnect(); } catch (_) {}
  }
  j.srcs = [];
}
/* coupe la lecture en cours (heard : un son était déjà sorti) */
export function stop() {
  const j = job;
  if (!j) return;
  job = null;
  j.cancelled = true;
  let heard = false;
  try { heard = !!(j.ac && j.srcs.length && j.ac.currentTime > j.t0 + 0.05); } catch (_) {}
  stopSources(j);
  if (j.finish) j.finish(R(false, 'cancelled', heard));
}
export function playing() { return !!job; }
/* → Promise résolue quand plus rien ne joue (tout de suite après stop()) */
export function settle() {
  if (!job) return Promise.resolve();
  return new Promise(res => settleFns.add(res));
}

/* ---------- cache en tâche de fond ---------- */
/* met en cache les clips absents, un à la fois, espacés (jamais en concurrence avec le jeu) ; s'arrête hors ligne ou
   après 3 échecs. → Promise<nombre de clips ajoutés> */
export async function prefetch(ids, { gapMs = 120 } = {}) {
  const cs = cachesOf();
  if (!cs) return 0;
  let cache;
  try { cache = await cs.open(CACHE); } catch (_) { return 0; }
  let added = 0, fails = 0;
  for (const id of ids || []) {
    const url = urlOf(id);
    if (!url) continue;
    try { if (G.navigator && G.navigator.onLine === false) break; } catch (_) {}
    try {
      if (await cache.match(url)) continue;
      const res = await fetchOf(url);
      if (!res || !res.ok) throw new Error('http');
      await cache.put(url, res);
      added++;
    } catch (_) { if (++fails >= 3) break; }
    if (gapMs) await new Promise(r => setTimeout(r, gapMs));
  }
  return added;
}
/* retire du cache les clips d'anciennes versions (empreinte ?v= différente) ou sortis de l'inventaire */
export async function prune() {
  const cs = cachesOf();
  if (!cs) return 0;
  let n = 0;
  try {
    const cache = await cs.open(CACHE);
    const want = new Set(Object.keys(CLIPS).map(id => id + '.mp3?v=' + CLIPS[id][1]));
    for (const req of await cache.keys()) {
      const u = String(req && req.url || req);
      const m = /\/audio\/voix\/([^/?#]+\.mp3\?v=[0-9a-f]+)$/.exec(u);
      if (!m || !want.has(m[1])) { await cache.delete(req); n++; }
    }
  } catch (_) {}
  return n;
}

/* tests : moteur simulé ({ context, fetch, caches }) ou null ; vide les tampons */
export function _setBackend(b) {
  stop();
  backend = b || null;
  decoded.clear(); loading.clear(); decodedS = 0;
}
