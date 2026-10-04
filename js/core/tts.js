/* ============ SYNTHÈSE VOCALE (fr-FR) ============
   speechSynthesis du navigateur, voix française de préférence LOCALE (hors ligne, sans délai réseau).
   L'appelant affiche TOUJOURS le texte (CDC §16 : sur Android, certaines voix demandent le réseau) :
   speak() résout false si rien n'a pu être dit ; speakResult() dit aussi pourquoi.
   Aucun accès au navigateur au chargement du module.

   Robustesse (v2.2.1, retour d'un parent sur Chrome Android : « 🔊 ne fait rien ») :
   - liste des voix vide au début : on attend « voiceschanged » ET on relit la liste (certains Android ne
     déclenchent jamais l'événement) ; toujours vide → on lit quand même avec lang = fr-FR (voix par défaut) ;
   - cancel() puis speak() avalé (Chrome Android) : cancel() seulement si quelque chose est en cours, puis une courte
     respiration (TIMING.settle) avant le speak() suivant ; énoncé disparu sans aucun événement → redonné une fois ;
   - « start » jamais déclenché, speaking incohérent : « boundary » et « end » valent preuve ; un appareil qui finit sans
     avoir dit « start » est retenu (plus d'abandon sur ce critère) ; jamais de cancel() d'une lecture peut-être audible
     faute de « start » ;
   - voix réseau lente, moteur à initialiser : la 1re lecture de la session attend plus longtemps son démarrage ;
   - voix choisie en échec (non installée…) : on retente sans l'imposer (moteur par défaut, langue fr-FR) et on l'écarte.

   API :
     speak(texte, opts) → Promise<boolean>
     speakResult(texte, opts) → Promise<{ ok, reason }> ; reason : '' | 'cancelled' (coupée par une autre lecture ou
       stopSpeaking) | 'empty' | 'no-api' | 'no-fr-voice' | 'not-started' | 'error:<code de SpeechSynthesisErrorEvent>'
     stopSpeaking() ; settle() → Promise : attend la fin de la respiration après un cancel() (avant d'ouvrir le micro) ;
     isSpeaking() ; ttsAvailable() ; diagnose() → { api, voices, fr, frLocal, voice } ; warmUp() ;
     onLateStart(fn) → désabonnement : une lecture déclarée « not-started » a fini par se faire entendre. */

export const TIMING = {
  voicesWait: 1500,     /* Chrome charge la liste des voix en asynchrone (Android : parfois plus d'une seconde) */
  voicesPoll: 250,      /* relecture de la liste pendant l'attente (événement « voiceschanged » parfois absent) */
  settle: 250,          /* respiration après cancel() : Chrome Android avale un speak() trop proche */
  startCheck: 1200,     /* ni « start » ni énoncé en file : il a été avalé → redonné une fois */
  startMax: 5000,       /* toujours rien : voix bloquée → abandon */
  startFirst: 8000,     /* 1re lecture de la session : moteur à initialiser, voix réseau lente */
  endSlack: 2500,       /* « end » jamais reçu (bug connu) : marge au-delà de la durée estimée */
  msPerChar: 110
};
const MAX_CHUNK = 160;         /* morceaux courts : Chrome coupe les longues lectures (~15 s) */

let job = null;                /* lecture en cours : { cancelled, finish(), wake(), u } */
let lastCancel = -1e9;         /* horodatage du dernier cancel() envoyé au moteur */
let spokeOnce = false;         /* une lecture a réellement démarré dans cette session */
let failedOnce = false;        /* une lecture n'a jamais démarré : plus d'attente longue */
let noStartEvent = false;      /* cet appareil peut finir une lecture sans avoir signalé « start » */
const badVoices = new Set();   /* voix en échec dans cette session (voiceURI ou nom) */
const lateFns = new Set();

function synth() { try { return globalThis.speechSynthesis || null; } catch (_) { return null; } }
function hasUtterance() { try { return typeof globalThis.SpeechSynthesisUtterance === 'function'; } catch (_) { return false; } }
function voices() { try { const s = synth(); return (s && s.getVoices()) || []; } catch (_) { return []; } }
const langOf = v => String((v && v.lang) || '').replace('_', '-').toLowerCase();
const isFr = v => langOf(v).startsWith('fr');
const keyOf = v => String((v && (v.voiceURI || v.name)) || '');
const sleep = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));
const now = () => { try { return globalThis.performance.now(); } catch (_) { return Date.now(); } };
const R = (ok, reason = '', heard = ok) => ({ ok, reason, heard: !!heard });

/* fr-FR d'abord, puis voix locale (hors ligne), puis voix par défaut ; jamais une voix déjà en échec */
function pickVoice(list) {
  let best = null, bestScore = -1;
  for (const v of list) {
    if (!isFr(v) || badVoices.has(keyOf(v))) continue;
    const score = (langOf(v) === 'fr-fr' ? 4 : 0) + (v.localService ? 3 : 0) + (v.default ? 1 : 0);
    if (score > bestScore) { best = v; bestScore = score; }
  }
  return best;
}

function waitVoices() {
  const s = synth(), first = voices();
  if (first.length || !s) return Promise.resolve(first);
  return new Promise(res => {
    let done = false, poll = 0, stop = 0;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(poll); clearTimeout(stop);
      try { s.removeEventListener('voiceschanged', finish); } catch (_) {}
      res(voices());
    };
    try { s.addEventListener('voiceschanged', finish); } catch (_) {}
    poll = setInterval(() => { if (voices().length) finish(); }, TIMING.voicesPoll);
    stop = setTimeout(finish, TIMING.voicesWait);
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

/* un morceau → { ok, started, reason }. Seuls les événements de l'énoncé COURANT comptent (un énoncé redonné laisse
   l'ancien muet : son « interrupted » ne doit pas passer pour une lecture coupée). */
function speakOne(text, voice, o, j) {
  return new Promise(resolve => {
    const s = synth();
    const t0 = now();
    /* l'énoncé suit de près un cancel() : c'est là que Chrome Android l'avale ou l'interrompt de lui-même */
    const afterCancel = t0 - lastCancel < 1500;
    let started = false, settled = false, retried = false, lateSent = false, cur = null;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, Math.max(0, ms)); timers.add(t); };
    const done = (ok, reason = '') => {
      if (settled) return;
      settled = true;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      if (j.finish === stop) j.finish = null;
      if (ok || started) spokeOnce = true;
      resolve({ ok, started, reason });
    };
    const stop = () => done(false, 'cancelled');           /* appelé par stopSpeaking() */
    j.finish = stop;
    /* une lecture déclarée « not-started » se fait finalement entendre (voix réseau très lente) */
    const late = () => {
      if (lateSent) return;
      lateSent = true;
      spokeOnce = true;
      for (const fn of lateFns) { try { fn(); } catch (_) {} }
    };
    const est = TIMING.endSlack + (text.length * TIMING.msPerChar) / Math.max(0.5, o.rate);
    const onStart = mine => {
      if (mine !== cur || started) return;
      started = true;
      if (settled) { late(); return; }
      later(() => done(true), est);                           /* « end » jamais reçu : la voix avait démarré */
    };
    /* énoncé perdu par le moteur (avalé, ou interrompu sans que nous l'ayons coupé) : redonné UNE fois, sans cancel()
       (qui réarmerait le défaut), après une respiration */
    const retry = () => {
      retried = true;
      cur = null;
      later(() => { fire(); later(check, TIMING.startCheck); }, TIMING.settle * 2);
    };
    const fire = () => {
      if (settled || j.cancelled) return;
      let u;
      try {
        u = new globalThis.SpeechSynthesisUtterance(text);
        u.lang = (voice && voice.lang) || 'fr-FR';
        if (voice) u.voice = voice;
        u.rate = o.rate; u.pitch = o.pitch; u.volume = o.volume;
      } catch (_) { done(false, 'error:utterance'); return; }
      cur = u;
      u.onstart = () => onStart(u);
      u.onboundary = () => onStart(u);
      u.onend = () => {
        if (u !== cur) return;
        if (!started) noStartEvent = true;                    /* fini sans avoir dit « start » : on s'en souvient */
        if (settled) { late(); return; }
        done(true);
      };
      u.onerror = e => {
        if (u !== cur || settled) return;
        const code = String((e && e.error) || 'error');
        const cut = code === 'interrupted' || code === 'canceled';
        if (cut && j.cancelled) { done(false, 'cancelled'); return; }
        if (cut && !started && !retried) { retry(); return; }
        done(false, 'error:' + code);
      };
      j.u = u;                   /* référence gardée : sinon Chrome peut perdre l'événement « end » */
      try { s.speak(u); } catch (_) { done(false, 'error:speak'); }
    };
    const deadline = !spokeOnce && !failedOnce ? TIMING.startFirst : TIMING.startMax;
    const check = () => {
      if (settled || started) return;
      let speaking = false, pending = false;
      try { speaking = !!s.speaking; pending = !!s.pending; } catch (_) {}
      /* juste après un cancel(), rien en file et aucun événement : énoncé avalé (jamais sur un appareil connu pour parler
         sans dire « start » : on doublerait une phrase audible) */
      if (afterCancel && !speaking && !pending && !retried && !noStartEvent) { retry(); return; }
      const left = deadline - (now() - t0);
      if (left > 0) { later(check, Math.min(TIMING.startCheck, left)); return; }
      if (noStartEvent) { later(() => done(true), est - (now() - t0)); return; }   /* il parle sans le dire */
      /* rien : voix bloquée. Pas de cancel() (une voix lente peut encore se faire entendre : late()) ; la prochaine
         lecture videra la file ; la voix imposée est écartée pour la suite */
      failedOnce = true;
      if (voice) badVoices.add(keyOf(voice));
      done(false, 'not-started');
    };
    fire();
    later(check, TIMING.startCheck);
  });
}

/* lit le texte ; interrompt toute lecture en cours. opts : { rate = 0.95, pitch = 1, volume = 1 } */
export async function speakResult(text, opts = {}) {
  const s = synth();
  if (!s || !hasUtterance()) return R(false, 'no-api');
  const parts = chunkText(text);
  if (!parts.length) return R(false, 'empty');
  const o = { rate: Number(opts.rate) || 0.95, pitch: Number(opts.pitch) || 1, volume: opts.volume === undefined ? 1 : Number(opts.volume) };
  stopSpeaking();
  const my = job = { cancelled: false, finish: null, wake: null, u: null };
  const release = () => { if (job === my) job = null; };
  /* attentes interruptibles : stopSpeaking() réveille aussitôt ce speak() */
  const cancelled = new Promise(r => { my.wake = () => r(null); });
  const pause = async ms => { if (ms > 0 && !my.cancelled) await Promise.race([sleep(ms), cancelled]); return !my.cancelled; };
  const list = await Promise.race([waitVoices(), cancelled]);
  if (my.cancelled || !list) return R(false, 'cancelled');
  let voice = pickVoice(list);
  if (list.length && !list.some(isFr)) { release(); return R(false, 'no-fr-voice'); }   /* voix chargées, aucune en français */
  if (!await pause(lastCancel + TIMING.settle - now())) return R(false, 'cancelled');
  try { if (s.paused) s.resume(); } catch (_) {}
  let heard = false;                                        /* un morceau au moins s'est fait entendre */
  for (const part of parts) {
    let r = await speakOne(part, voice, o, my);
    if (r.ok || r.started) heard = true;
    if (my.cancelled) return R(false, 'cancelled', heard);
    /* la voix choisie échoue avant d'avoir parlé : on la retire et on laisse le moteur choisir (langue fr-FR) */
    if (!r.ok && !r.started && voice && /^error:/.test(r.reason) && r.reason !== 'error:not-allowed') {
      badVoices.add(keyOf(voice));
      voice = null;
      try { if (s.speaking || s.pending) { s.cancel(); lastCancel = now(); } } catch (_) {}
      if (!await pause(TIMING.settle)) return R(false, 'cancelled', heard);
      r = await speakOne(part, null, o, my);
      if (r.ok || r.started) heard = true;
      if (my.cancelled) return R(false, 'cancelled', heard);
    }
    if (!r.ok) { release(); return R(false, r.reason || 'not-started', heard); }
  }
  release();
  return R(true);
}
export function speak(text, opts) { return speakResult(text, opts).then(r => !!r.ok, () => false); }

/* coupe la voix ; cancel() n'est envoyé au moteur que si un énoncé lui a été confié (sinon Chrome Android peut avaler
   le speak() suivant) */
export function stopSpeaking() {
  const j = job;
  job = null;
  const handed = !!(j && j.u);
  if (j) { j.cancelled = true; if (j.wake) j.wake(); if (j.finish) j.finish(); }
  try {
    const s = synth();
    if (s && (handed || s.speaking || s.pending)) { s.cancel(); lastCancel = now(); }
  } catch (_) {}
}
/* la respiration après le dernier cancel() est passée (à attendre avant d'ouvrir le micro, par exemple) */
export function settle() { return sleep(lastCancel + TIMING.settle - now()); }
export function isSpeaking() {
  if (job) return true;
  try { const s = synth(); return !!(s && (s.speaking || s.pending)); } catch (_) { return false; }
}
export function onLateStart(fn) {
  if (typeof fn !== 'function') return () => {};
  lateFns.add(fn);
  return () => lateFns.delete(fn);
}

/* l'API existe et (liste pas encore chargée ou au moins une voix française) */
export function ttsAvailable() {
  if (!synth() || !hasUtterance()) return false;
  const list = voices();
  return !list.length || list.some(isFr);
}
/* pour l'espace parents (« Tester la voix ») : ce que l'appareil propose */
export function diagnose() {
  const api = !!synth() && hasUtterance();
  const list = api ? voices() : [];
  const fr = list.filter(isFr);
  const v = pickVoice(list);
  return { api, voices: list.length, fr: fr.length, frLocal: fr.filter(x => x.localService).length, voice: v ? String(v.name || v.lang || '') : '' };
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

/* tests : remet l'état du module à zéro (moteur et minuteries simulés) */
export function _reset() {
  job = null; lastCancel = -1e9; spokeOnce = false; failedOnce = false; noStartEvent = false;
  badVoices.clear(); lateFns.clear();
}
