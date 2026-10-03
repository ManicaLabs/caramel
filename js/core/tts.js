/* ============ SYNTHÈSE VOCALE (fr-FR) ============
   speechSynthesis du navigateur, voix française de préférence LOCALE (hors ligne, sans délai réseau).
   L'appelant affiche TOUJOURS le texte (CDC §16 : sur Android, certaines voix demandent le réseau) :
   speak() résout false si rien n'a pu être dit (pas d'API, aucune voix française, voix muette,
   délai de garde dépassé, lecture interrompue).
   Aucun accès au navigateur au chargement du module. */

const VOICES_WAIT_MS = 1000;   /* Chrome charge la liste des voix en asynchrone */
const START_GUARD_MS = 2500;   /* la voix n'a toujours pas démarré : on abandonne */
const MAX_CHUNK = 160;         /* morceaux courts : Chrome coupe les longues lectures (~15 s) */

let job = null;                /* lecture en cours : { cancelled, finish(ok), u } */

function synth() { try { return globalThis.speechSynthesis || null; } catch (_) { return null; } }
function hasUtterance() { try { return typeof globalThis.SpeechSynthesisUtterance === 'function'; } catch (_) { return false; } }
function voices() { try { const s = synth(); return (s && s.getVoices()) || []; } catch (_) { return []; } }
const langOf = v => String((v && v.lang) || '').replace('_', '-').toLowerCase();
const isFr = v => langOf(v).startsWith('fr');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* fr-FR d'abord, puis voix locale (hors ligne), puis voix par défaut */
function pickVoice(list) {
  let best = null, bestScore = -1;
  for (const v of list) {
    if (!isFr(v)) continue;
    const score = (langOf(v) === 'fr-fr' ? 4 : 0) + (v.localService ? 3 : 0) + (v.default ? 1 : 0);
    if (score > bestScore) { best = v; bestScore = score; }
  }
  return best;
}

function waitVoices() {
  const s = synth(), now = voices();
  if (now.length || !s) return Promise.resolve(now);
  return new Promise(res => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { s.removeEventListener('voiceschanged', finish); } catch (_) {}
      res(voices());
    };
    try { s.addEventListener('voiceschanged', finish); } catch (_) {}
    setTimeout(finish, VOICES_WAIT_MS);
  });
}

/* découpe en phrases puis en morceaux de MAX_CHUNK caractères au plus (virgules, puis espaces) */
export function chunkText(text) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…;:]+(?:[.!?…;:]+[»"”)]*)?\s*/g) || [clean];
  const pieces = [];
  for (let s of sentences) {
    s = s.trim();
    while (s.length > MAX_CHUNK) {
      const head = s.slice(0, MAX_CHUNK);
      let cut = head.lastIndexOf(', ');
      if (cut < MAX_CHUNK / 3) cut = head.lastIndexOf(' ');
      if (cut <= 0) cut = MAX_CHUNK - 1;
      pieces.push(s.slice(0, cut + 1).trim());
      s = s.slice(cut + 1).trim();
    }
    if (s) pieces.push(s);
  }
  /* regroupe les phrases courtes pour garder une diction naturelle */
  const out = [];
  for (const p of pieces) {
    if (out.length && (out[out.length - 1] + ' ' + p).length <= MAX_CHUNK) out[out.length - 1] += ' ' + p;
    else out.push(p);
  }
  return out;
}

function speakOne(text, voice, o, j) {
  return new Promise(resolve => {
    const s = synth();
    let started = false, settled = false, guard = 0, maxGuard = 0;
    const done = ok => {
      if (settled) return;
      settled = true;
      clearTimeout(guard); clearTimeout(maxGuard);
      if (j.finish === done) j.finish = null;
      resolve(ok);
    };
    j.finish = done;
    try {
      const u = new globalThis.SpeechSynthesisUtterance(text);
      u.lang = (voice && voice.lang) || 'fr-FR';
      if (voice) u.voice = voice;
      u.rate = o.rate; u.pitch = o.pitch; u.volume = o.volume;
      u.onstart = () => { started = true; };
      u.onend = () => done(true);
      u.onerror = () => done(false);
      j.u = u;                   /* référence gardée : sinon Chrome peut perdre l'événement « end » */
      s.speak(u);
    } catch (_) { done(false); return; }
    guard = setTimeout(() => {
      let speaking = false;
      try { speaking = s.speaking; } catch (_) {}
      if (!started && !speaking) { try { s.cancel(); } catch (_) {} done(false); }
    }, START_GUARD_MS);
    /* « end » jamais reçu (bug connu) : on rend la main ; true si la voix avait bien démarré */
    maxGuard = setTimeout(() => done(started), START_GUARD_MS + 1500 + (text.length * 110) / Math.max(0.5, o.rate));
  });
}

/* lit le texte ; interrompt toute lecture en cours. opts : { rate = 0.95, pitch = 1, volume = 1 }
   → Promise<boolean> : true si tout a été lu, false sinon (l'appelant affiche déjà le texte). */
export async function speak(text, opts = {}) {
  const s = synth();
  const parts = chunkText(text);
  if (!s || !hasUtterance() || !parts.length) return false;
  const o = { rate: Number(opts.rate) || 0.95, pitch: Number(opts.pitch) || 1, volume: opts.volume === undefined ? 1 : Number(opts.volume) };
  let wasBusy = false;
  try { wasBusy = s.speaking || s.pending; } catch (_) {}
  stopSpeaking();
  const my = job = { cancelled: false, finish: null, wake: null, u: null };
  /* attente interruptible : stopSpeaking() réveille aussitôt ce speak() */
  const cancelled = new Promise(r => { my.wake = () => r(null); });
  if (wasBusy) await Promise.race([sleep(80), cancelled]);   /* Chrome Android avale un speak() juste après cancel() */
  const list = my.cancelled ? null : await Promise.race([waitVoices(), cancelled]);
  if (my.cancelled || !list) return false;
  const voice = pickVoice(list);
  if (list.length && !voice) { if (job === my) job = null; return false; }   /* voix chargées, aucune en français */
  try { if (s.paused) s.resume(); } catch (_) {}
  for (const part of parts) {
    const ok = await speakOne(part, voice, o, my);
    if (!ok || my.cancelled) { if (job === my) job = null; return false; }
  }
  if (job === my) job = null;
  return true;
}

export function stopSpeaking() {
  const j = job;
  job = null;
  if (j) { j.cancelled = true; if (j.wake) j.wake(); if (j.finish) j.finish(false); }
  try { const s = synth(); if (s) s.cancel(); } catch (_) {}
}

/* l'API existe et (liste pas encore chargée ou au moins une voix française) */
export function ttsAvailable() {
  if (!synth() || !hasUtterance()) return false;
  const list = voices();
  return !list.length || list.some(isFr);
}

/* à appeler lors d'un premier geste : lance le chargement des voix ; sur iPhone/iPad, une lecture vide
   pendant le geste débloque la synthèse pour la suite (sans geste, Safari iOS reste muet) */
export function warmUp() {
  const s = synth();
  if (!s) return;
  voices();
  try {
    const nav = globalThis.navigator || {};
    const ios = /iP(hone|ad|od)/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
    if (ios && hasUtterance()) {
      const u = new globalThis.SpeechSynthesisUtterance(' ');
      u.volume = 0;
      s.speak(u);
    }
  } catch (_) {}
}
