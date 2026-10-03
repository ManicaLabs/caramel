/* ============ SONS (CDC v2 §11, contrat §8.2) ============
   Synthèse WebAudio : aucun fichier. Un seul AudioContext partagé, créé au premier son demandé
   après un geste de l'enfant, et relancé par unlock() (à appeler au premier geste).
   Chaîne : sources → bus maître (gain du muet) → compresseur doux (pas de saturation quand
   les sons se superposent) → sortie. Le muet coupe tout, tout de suite.
   Sans WebAudio, chaque fonction est silencieuse (jamais d'exception) et le métronome
   continue de battre sur l'horloge de la page (le jeu garde son rythme visuel).
   Importable dans Node : aucun accès à window/document/navigator au chargement. */

import { clamp } from './util.js';

const G = globalThis;
const nowMs = () => (G.performance && typeof G.performance.now === 'function' ? G.performance.now() : Date.now());

let ac = null;              // AudioContext partagé (null tant qu'aucun son n'a été demandé)
let bus = null;             // gain maître (porte le muet)
let broken = false;         // WebAudio absent ou création impossible : on n'essaie plus
let muted = false;
let noiseBuf = null;        // bruit blanc réutilisé (whoosh)
const voices = new Set();   // sources en cours (coupées par setMuted(true))

/* ---------- contexte ---------- */
function ctx() {
  if (ac) return ac.state === 'closed' ? null : ac;
  if (broken) return null;
  const C = G.AudioContext || G.webkitAudioContext;
  if (!C) { broken = true; return null; }
  /* avant le tout premier geste, le navigateur refuserait de démarrer (et le signalerait en console) */
  try { const ua = G.navigator && G.navigator.userActivation; if (ua && !ua.hasBeenActive) return null; } catch (_) {}
  try {
    try { ac = new C({ latencyHint: 'interactive' }); } catch (_) { ac = new C(); }
    bus = ac.createGain();
    bus.gain.value = muted ? 0 : 1;
    try {
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 4;
      comp.attack.value = 0.003; comp.release.value = 0.2;
      bus.connect(comp); comp.connect(ac.destination);
    } catch (_) { bus.connect(ac.destination); }
    /* iOS : appel, Siri, mise en veille → contexte « interrupted » ; on se réarme pour le prochain geste */
    try { ac.addEventListener('statechange', () => { if (ac && ac.state !== 'running' && ac.state !== 'closed') armGesture(); }); } catch (_) {}
    if (ac.state !== 'running') armGesture();
    return ac;
  } catch (_) { broken = true; ac = null; bus = null; return null; }
}

/* reprise du contexte ; une reprise refusée (pas de geste) peut rester en attente indéfiniment → délai max */
function resume() {
  const c = ac;
  if (!c || c.state === 'closed') return Promise.resolve(false);
  if (c.state === 'running') return Promise.resolve(true);
  return new Promise(res => {
    let done = false;
    const fin = () => { if (!done) { done = true; res(c.state === 'running'); } };
    try { const p = c.resume(); if (p && typeof p.then === 'function') p.then(fin, fin); } catch (_) {}
    setTimeout(fin, 350);
  });
}

/* écoute des gestes tant que le son n'est pas débloqué (Safari exige un geste pour resume()) */
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'];
let armed = false;
function onGesture() { unlock(); }
function armGesture() {
  if (armed || !G.document) return;
  armed = true;
  for (const t of GESTURES) { try { G.document.addEventListener(t, onGesture, { capture: true, passive: true }); } catch (_) {} }
}
function disarmGesture() {
  if (!armed || !G.document) return;
  armed = false;
  for (const t of GESTURES) { try { G.document.removeEventListener(t, onGesture, { capture: true }); } catch (_) {} }
}

/* à appeler au premier geste (pointerup, click, keydown) : crée/relance le contexte.
   → Promise<boolean> (true si le son est prêt) */
export function unlock() {
  const c = ctx();
  if (!c) return Promise.resolve(false);
  if (c.state === 'running') { disarmGesture(); return Promise.resolve(true); }
  /* vieux iOS : un échantillon silencieux joué pendant le geste déverrouille la sortie */
  try { const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); } catch (_) {}
  return resume().then(ok => { if (ok) disarmGesture(); return ok; });
}

export function audioSupported() { return !!(G.AudioContext || G.webkitAudioContext); }

/* ---------- muet ---------- */
export function setMuted(b) {
  muted = !!b;
  if (!ac || !bus) return;
  try {
    const t = ac.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(muted ? 0 : 1, t + 0.03);   /* rampe courte : pas de clic */
    if (muted) { for (const v of voices) { try { v.stop(t + 0.035); } catch (_) {} } voices.clear(); }
  } catch (_) {}
}
export function isMuted() { return muted; }

/* ---------- moteur ---------- */
/* build(c, t) programme le son à l'instant t (horloge audio). Contexte suspendu : on tente une reprise ;
   si elle aboutit vite (geste en cours) le son part, sinon il est abandonné (jamais de rafale en retard). */
function play(build) {
  if (muted) return;
  const c = ctx();
  if (!c) return;
  if (c.state === 'running') { exec(c, build); return; }
  if (c.state === 'closed') return;
  const asked = nowMs();
  resume().then(ok => { if (ok && !muted && nowMs() - asked < 300) exec(c, build); });
}
function exec(c, build) { try { build(c, c.currentTime + 0.002); } catch (_) {} }

/* source suivie jusqu'à sa fin (débranchée ensuite ; coupée par le muet) */
function keep(src, nodes) {
  voices.add(src);
  src.onended = () => {
    voices.delete(src);
    try { src.disconnect(); } catch (_) {}
    for (const n of nodes) { try { n.disconnect(); } catch (_) {} }
  };
}

/* une note : oscillateur → enveloppe (attaque linéaire, déclin exponentiel) → destination
   to = glissando de fréquence ; extra = nœuds à débrancher à la fin (filtres partagés) */
function tone(c, t, { f, to, type = 'sine', dur = 0.15, gain = 0.1, attack = 0.005, dest = bus, extra = [] }) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
  keep(o, [g, ...extra]);
  return o;
}

/* bip v11 à l'identique (sinus, attaque franche, déclin exponentiel jusqu'à 0,001) */
function beepAt(c, t, freq, dur = 0.08, gain = 0.12) {
  const o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur);
  keep(o, [g]);
  return o;
}

/* cloche douce : fondamentale + octave + éclat cristallin très court */
function bell(c, t, f, gain = 0.15, len = 0.6) {
  tone(c, t, { f, dur: len, gain, attack: 0.004 });
  tone(c, t, { f: f * 2, dur: len * 0.45, gain: gain * 0.3, attack: 0.003 });
  tone(c, t, { f: f * 3.01, dur: len * 0.16, gain: gain * 0.1, attack: 0.002 });
}

function noise(c) {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const len = Math.floor(c.sampleRate * 1);
  noiseBuf = c.createBuffer(1, len, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/* ---------- sons ---------- */
/* compatible v11 : beep(fréquence, durée en s, gain) */
export function beep(freq, dur = 0.08, gain = 0.12) {
  play((c, t) => beepAt(c, t, freq, dur, gain));
}

/* gamme pentatonique majeure (do ré mi sol la) à partir du do5 ; step 0 → do5, 5 → do6… */
const PENTA = [0, 2, 4, 7, 9];
export const SUCCESS_MAX = 9;                 /* plafond de la série : la6 */
export function pentatonic(step = 0) {
  const s = clamp(Math.floor(+step) || 0, 0, 14);
  return 523.25 * Math.pow(2, (12 * Math.floor(s / 5) + PENTA[s % 5]) / 12);
}

/* bonne réponse : la note monte avec la série (step 0…∞, plafonnée) ; longue série → 2de note plus haute */
export function success(step = 0) {
  const s = clamp(Math.floor(+step) || 0, 0, SUCCESS_MAX);
  play((c, t) => {
    const g = 0.16 - s * 0.006;               /* les aigus paraissent plus forts : on compense */
    bell(c, t, pentatonic(s), g, 0.6);
    if (s >= 4) bell(c, t + 0.075, pentatonic(s + 2), g * 0.4, 0.45);
  });
}

/* petite mélodie de notes pentatoniques (ex. l'orchestre rejoue les notes gagnées) ; null = silence */
export function melody(steps, gap = 0.22) {
  const list = Array.isArray(steps) ? steps.slice(0, 32) : [];
  if (!list.length) return;
  const g = clamp(+gap || 0.22, 0.08, 1);
  play((c, t) => list.forEach((s, i) => {
    if (s === null || s === undefined) return;
    bell(c, t + i * g, pentatonic(s), 0.13, Math.max(0.3, g * 2));
  }));
}

/* erreur : « bois doux », deux petits « toc » graves et filtrés, jamais agressifs */
export function soft() {
  play((c, t) => {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 950; lp.Q.value = 0.7;
    lp.connect(bus);
    tone(c, t, { type: 'triangle', f: 233, to: 205, dur: 0.16, gain: 0.2, attack: 0.003, dest: lp });
    tone(c, t, { f: 233 * 2.72, dur: 0.045, gain: 0.04, attack: 0.002, dest: lp });   /* partiel inharmonique : timbre de bois */
    tone(c, t + 0.12, { f: 196 * 2.72, dur: 0.045, gain: 0.028, attack: 0.002, dest: lp });
    tone(c, t + 0.12, { type: 'triangle', f: 196, to: 174, dur: 0.19, gain: 0.15, attack: 0.003, dest: lp, extra: [lp] });
  });
}

/* touche de pavé : petit « toc » discret, hauteur légèrement variable (moins mécanique) */
export function tap() {
  play((c, t) => {
    const f = 640 * (0.95 + Math.random() * 0.1);
    tone(c, t, { type: 'triangle', f, to: f * 0.72, dur: 0.05, gain: 0.07, attack: 0.002 });
  });
}

/* pomme gagnée : « pling » à deux notes (si5 → mi6) */
export function coin() {
  play((c, t) => {
    tone(c, t, { type: 'triangle', f: 987.77, dur: 0.09, gain: 0.1, attack: 0.002 });
    tone(c, t + 0.07, { type: 'triangle', f: 1318.51, dur: 0.34, gain: 0.1, attack: 0.002 });
    tone(c, t + 0.07, { f: 2637.02, dur: 0.12, gain: 0.022, attack: 0.002 });
  });
}

/* fanfare v11 : 523 / 659 / 784 / 1047 Hz toutes les 140 ms (+ éclat d'octave discret) */
export function fanfare() {
  play((c, t) => [523, 659, 784, 1047].forEach((f, i) => {
    beepAt(c, t + i * 0.14, f, 0.18, 0.15);
    tone(c, t + i * 0.14, { f: f * 2, dur: 0.14, gain: 0.03, attack: 0.003 });
  }));
}

/* souffle (transition, envol) : bruit filtré dont la bande monte puis redescend */
export function whoosh() {
  play((c, t) => {
    const src = c.createBufferSource();
    src.buffer = noise(c);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(350, t);
    bp.frequency.exponentialRampToValueAtTime(2200, t + 0.22);
    bp.frequency.exponentialRampToValueAtTime(900, t + 0.38);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    src.connect(bp); bp.connect(g); g.connect(bus);
    src.start(t, Math.random() * 0.5); src.stop(t + 0.4);
    keep(src, [bp, g]);
  });
}

/* hennissement v11 à l'identique : 620 Hz puis 780 Hz 130 ms plus tard */
export function neigh() {
  play((c, t) => { beepAt(c, t, 620, 0.1, 0.1); beepAt(c, t + 0.13, 780, 0.16, 0.1); });
}

/* sabots v11 à l'identique : 15 « clip-clop » (175 / 140 Hz) toutes les 260 ms, le 1er à 260 ms.
   → { stop() } pour l'interrompre (l'écran du compagnon se démonte pendant la promenade, etc.) */
export function clipClop() {
  let stopped = false;
  const srcs = [];
  play((c, t) => {
    if (stopped) return;
    for (let i = 0; i <= 14; i++) srcs.push(beepAt(c, t + (i + 1) * 0.26, i % 2 ? 140 : 175, 0.05, 0.1));
  });
  return {
    stop() {
      stopped = true;
      for (const s of srcs) { try { s.stop(); } catch (_) {} }
      srcs.length = 0;
    }
  };
}

/* ---------- métronome ----------
   Planification « à deux horloges » : un minuteur (25 ms) programme les clics sur l'horloge audio
   avec 120 ms d'avance (précision à l'échantillon), et onBeat(i, strong, { bar, pos }) est appelé
   au moment où le clic s'entend (latence de sortie comprise).
   i = numéro du temps depuis le départ (0, 1, 2…), strong = premier temps de la mesure.
   Audio indisponible, suspendu ou muet : les temps continuent sur l'horloge de la page (sans clic). */
const LOOKAHEAD = 0.12;
function clickAt(c, t, strong) {
  tone(c, t, { f: strong ? 1318.5 : 987.8, dur: strong ? 0.06 : 0.045, gain: strong ? 0.16 : 0.085, attack: 0.001 });
  tone(c, t, { type: 'triangle', f: strong ? 659.3 : 493.9, dur: 0.03, gain: strong ? 0.07 : 0.035, attack: 0.001 });
}
export function metronome({ bpm = 90, beatsPerBar = 4, onBeat, click = true } = {}) {
  let period = 60 / clamp(+bpm || 90, 20, 300);
  const perBar = Math.max(1, Math.floor(+beatsPerBar) || 4);
  let running = true, n = 0, last = null, lat = null;
  const pending = new Set();
  const audioOn = () => !!(ac && ac.state === 'running');
  let clock = audioOn() ? 'audio' : 'page';
  const now = () => (clock === 'audio' ? ac.currentTime : nowMs() / 1000);
  let next = now() + 0.06;

  function switchClock(to) {
    const delta = next - now();
    clock = to;
    next = now() + delta;
    if (last !== null) last = next - period;
  }
  function tick() {
    if (!running) return;
    if (clock === 'page' && audioOn()) switchClock('audio');
    else if (clock === 'audio' && !audioOn()) switchClock('page');
    const t0 = now();
    /* onglet endormi (minuteurs ralentis) : on saute les temps passés au lieu d'une rafale */
    if (next < t0 - 0.25) { const k = Math.ceil((t0 - next) / period); next += k * period; n += k; }
    while (next < t0 + LOOKAHEAD) {
      const i = n, strong = i % perBar === 0, at = next;
      let delay = 0;
      if (clock === 'audio') {
        if (click && !muted) { try { clickAt(ac, at, strong); } catch (_) {} }
        /* la latence de sortie n'est souvent connue qu'après le premier son : on la rejoint
           par petits pas (15 ms par temps) pour que le rythme visuel ne saute jamais */
        const target = ac.outputLatency || ac.baseLatency || 0;
        lat = lat === null ? target : lat + clamp(target - lat, -0.015, 0.015);
        delay = lat;
      }
      const id = setTimeout(() => {
        pending.delete(id);
        if (!running || typeof onBeat !== 'function') return;
        try { onBeat(i, strong, { bar: Math.floor(i / perBar), pos: i % perBar }); } catch (e) { console.error(e); }
      }, Math.max(0, (at - t0 + delay) * 1000));
      pending.add(id);
      last = at; n++; next += period;
    }
  }
  const timer = setInterval(tick, 25);
  tick();
  return {
    stop() {
      if (!running) return;
      running = false;
      clearInterval(timer);
      for (const id of pending) clearTimeout(id);
      pending.clear();
    },
    /* nouveau tempo dès le prochain temps non encore programmé */
    setBpm(b) {
      const v = +b;
      if (!isFinite(v) || v <= 0) return;
      period = 60 / clamp(v, 20, 300);
      if (last !== null) next = Math.max(last + period, now() + 0.01);
    },
    get bpm() { return Math.round(600 / period) / 10; },
    get running() { return running; }
  };
}
