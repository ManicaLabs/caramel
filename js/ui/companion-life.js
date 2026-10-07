/* ============ COMPAGNON : MOTEUR DE VIE (v2.1 — CDC §10.3, §11) ============
   Fait vivre le compagnon SVG de js/ui/mount-svg.js PAR-DESSUS l'« idle » CSS de css/ui/mount.css (respiration,
   queue, balancement) : clignements irréguliers, regard (qui suit le doigt / la souris quand il est proche, sinon
   regarde autour de lui ou vers l'enfant), frémissement d'oreille, coup de queue, tête penchée, petites actions
   propres à l'espèce toutes les 8 à 20 s, humeur (jauges basses → oreilles basses, soupirs, « petit creux »),
   sommeil la nuit (22 h - 7 h, heure locale) et réactions aux soins (manger, brosser, promener, toucher, câlin…).

   API
     bringToLife(svg, { species, stage, interactive = true, onEvent, hitEl, greet = true, light = false, awake, mood, sleep }) → contrôleur
       (awake : la nuit, rester éveillé un moment — on vient de le réveiller —, au lieu de s'endormir aussitôt ;
        mood : jauges de départ { faim, forme, joie }, comme setMood ; sleep : true | false | null, sommeil imposé dès
        la naissance comme sleep(v) — v2.4, sieste de la fin du temps de jeu : endormi sans bâiller, ou, avec awake,
        éveillé un moment puis rendormi)
       setExpression(nom, ms?)        expression du rig (EXPRESSIONS) ; avec ms : temporaire, puis retour à la base
       react(action, opts) → Promise<boolean>   'tap' ({ x, y }) · 'hug' · 'eat' ({ food, from, flightMs }) · 'brush'
                                      · 'walk' ({ ms }) · 'celebrate' · 'proud' ({ acc }) · 'surprise' · 'yawn' · 'wake'
                                      · 'appear' ; résolue à la fin de la scène (false si interrompue ou détruite)
       lookAt(x, y)                   regarde un point de l'écran (coordonnées client) ; lookAt(null) → regard libre
       setMood({ faim, forme, joie }) jauges 0-100 → humeur (classe sad du rig si la moyenne < 40, comme la v11)
       sleep(true | false | null)     force le sommeil / l'éveil ; null → automatique (la nuit, 22 h - 7 h) ; sommeil
                                      forcé : un toucher le réveille ≈ 45 s, puis il se rendort (comme la nuit)
       pause(), resume(), destroy(), state → { sleeping, busy, mood, expr, running, species, stage, light, sleepMode }
       onEvent(type, detail) : 'tap' / 'hug' ({ x, y }, geste reconnu sur hitEl), 'sleep', 'wake', 'act' ({ name }),
                               'pause', 'resume'.
     liven(el, opts) → contrôleur LÉGER (regard + clignements + joie au toucher) pour les avatars des autres écrans
       (bilan de manche, bienvenue, profils… : companion.js l'appelle dans setAvatar).
     lifeOf(svg) → contrôleur existant ou null ; lifeStats() → { lives, tasks, timer } (mesure des fuites).
   Parties pures (testées par tests/companion-life.test.mjs) : stageFor, stageProgress, isNight, seasonOf, sunTimes,
     skyAt, mixHex, makeRng, createPlanner, SPECIES_ACTS.

   Principes
   - Rien n'est redessiné : le moteur agit sur le SVG en place (attribut data-expr, classes d'humeur du rig, animations
     Web Animations sur transform en composition « add » : elles s'ajoutent aux keyframes CSS du rig — respiration,
     balancement, regard — au lieu de les écraser). Effets (cœurs, « Z », miettes, bulles,
     fumée, papillon, brosse…) dessinés dans un groupe .cl-fx ajouté à la racine du SVG (unités du viewBox, ancres de
     mountAnchors) : ils suivent la taille du compagnon et disparaissent avec lui.
   - UN seul minuteur pour toute l'application (ordonnanceur partagé), UN IntersectionObserver, des écouteurs de
     pointeur partagés : rien ne s'accumule, tout s'arrête quand le dernier compagnon disparaît (ramasse-miettes si un
     écran oublie destroy()).
   - Pause automatique hors de l'écran (IntersectionObserver) et onglet caché (visibilityState) : pour la batterie.
   - Mouvement réduit (préférence système ou « animations douces ») : seuls le clignement et la respiration CSS
     restent ; le moteur ne change plus que l'expression (et le sommeil de la nuit, sans mouvement).
   - Silencieux : aucun son ici (les sons des soins passent par js/core/audio.js, dans companion.js, muet respecté).
   Module importable par Node : aucun accès au DOM au chargement. */

import { reduced, sparkle as motionSparkle } from '../core/motion.js';
import { mountAnchors, EXPRESSIONS } from './mount-svg.js';

const G = globalThis;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

/* ================= PARTIES PURES ================= */

/* ---------- stades (CDC §10.3) : minutes d'apprentissage cumulées (companion.minutes), jamais le score ---------- */
export const STAGE_MINUTES = Object.freeze([0, 60, 300]);
export function stageFor(minutes) {
  const m = Number(minutes) || 0;
  return m >= STAGE_MINUTES[2] ? 3 : m >= STAGE_MINUTES[1] ? 2 : 1;
}
/* → { stage, next (null au dernier stade), frac (0-1 vers le suivant), left (minutes restantes, entier) } */
export function stageProgress(minutes) {
  const m = Math.max(0, Number(minutes) || 0);
  const stage = stageFor(m);
  if (stage === 3) return { stage, next: null, frac: 1, left: 0 };
  const a = STAGE_MINUTES[stage - 1], b = STAGE_MINUTES[stage];
  return { stage, next: stage + 1, frac: clamp((m - a) / (b - a), 0, 1), left: Math.max(1, Math.ceil(b - m)) };
}

/* ---------- heure locale, saisons, ciel ---------- */
/* la nuit du compagnon : 22 h - 7 h (heure locale de l'appareil) */
export function isNight(date = new Date()) {
  const h = date.getHours();
  return h >= 22 || h < 7;
}
/* saisons astronomiques approchées (hémisphère nord) */
export function seasonOf(date = new Date()) {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  if (md >= 1221 || md < 320) return 'winter';
  if (md < 621) return 'spring';
  if (md < 923) return 'summer';
  return 'autumn';
}
/* lever / coucher du soleil en France (heure légale, mi-mois ; interpolation linéaire entre deux mi-mois) */
const SUN = [[8.63, 17.38], [8.07, 18.2], [7.2, 18.92], [7.12, 20.65], [6.28, 21.32], [5.77, 21.93],
  [6.07, 21.87], [6.72, 21.15], [7.43, 20.08], [8.17, 18.98], [7.97, 17.25], [8.6, 16.9]];
export function sunTimes(date = new Date()) {
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
  const dim = mm => new Date(y, mm + 1, 0).getDate();
  let i0, i1, f;
  if (d >= 15) { i0 = m; i1 = (m + 1) % 12; f = (d - 15) / dim(m); }
  else { i0 = (m + 11) % 12; i1 = m; const pd = dim(m - 1); f = (d - 15 + pd) / pd; }
  return { rise: lerp(SUN[i0][0], SUN[i1][0], f), set: lerp(SUN[i0][1], SUN[i1][1], f) };
}
/* mélange de deux couleurs #rrggbb (t = part de b) */
export function mixHex(a, b, t) {
  const pa = parseInt(String(a).slice(1), 16), pb = parseInt(String(b).slice(1), 16);
  if (!Number.isFinite(pa) || !Number.isFinite(pb)) return a;
  const k = clamp(+t || 0, 0, 1);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}
/* palettes du diorama (décor naturel FIXE, indépendant du thème) : [jour, nuit] ; warm = aube / crépuscule */
export const SKY_COLORS = Object.freeze({
  top: ['#8fd0f7', '#141c45'], bot: ['#dcf2ff', '#2e3a74'],
  warmTop: '#8a8fd6', warmBot: '#ffb07e'
});
export const LAND_COLORS = Object.freeze({
  hillFar: ['#c3ecc8', '#2a4864'], hillNear: ['#9ddfa7', '#24425a'],
  grassTop: ['#8fe6a0', '#2b5b50'], grassBot: ['#57cd78', '#1f483f'], clearing: ['#b4efaa', '#356456'],
  wood: ['#e9c391', '#7b6c80'], trunk: ['#b07a4b', '#4d4152'], leaf: ['#62bf73', '#2b5552'], leaf2: ['#8bd995', '#346363'],
  water: ['#8fd3f5', '#35548e'], waterHi: ['#dcf5ff', '#7590c8'], cloud: ['#ffffff', '#6f79ad'], flower: ['#ffffff', '#b9bfe0']
});
/* ciel à une date : phase, part de nuit (0-1), lueur d'aube / de crépuscule (0-1), soleil et lune (repère 400 × 200
   du diorama, horizon ≈ 120), couleurs du ciel et du décor */
export function skyAt(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const { rise, set } = sunTimes(date);
  const TW = 0.75;                                   /* crépuscule civil ≈ 45 min de part et d'autre */
  let night;
  if (h < rise - TW || h > set + TW) night = 1;
  else if (h < rise + TW) night = 1 - smooth((h - (rise - TW)) / (2 * TW));
  else if (h > set - TW) night = smooth((h - (set - TW)) / (2 * TW));
  else night = 0;
  const warm = clamp(Math.max(1 - Math.abs(h - rise) / 1.3, 1 - Math.abs(h - set) / 1.3), 0, 1);
  const am = h < 13;
  const phase = night >= 0.7 ? 'night' : (warm >= 0.3 || night > 0.3) ? (am ? 'dawn' : 'dusk') : 'day';
  const fd = (h - rise) / (set - rise);              /* 0 au lever, 1 au coucher */
  const sun = { on: fd > -0.06 && fd < 1.06, x: lerp(78, 322, clamp(fd, 0, 1)), y: 132 - 102 * Math.sin(Math.PI * clamp(fd, 0, 1)) };
  const nightLen = 24 - (set - rise);
  const fn = ((((h - set) % 24) + 24) % 24) / nightLen;   /* 0 au coucher, 1 au lever */
  const moon = { on: fn < 1.04 && night > 0.15, x: lerp(84, 316, clamp(fn, 0, 1)), y: 124 - 88 * Math.sin(Math.PI * clamp(fn, 0, 1)) };
  const glow = warm * (1 - night * 0.6);
  /* l'aube et le crépuscule gardent leurs couleurs chaudes près de l'horizon même quand le ciel s'assombrit */
  const top = mixHex(mixHex(SKY_COLORS.top[0], SKY_COLORS.warmTop, glow * 0.75), SKY_COLORS.top[1], night * (1 - 0.3 * glow));
  const bot = mixHex(mixHex(SKY_COLORS.bot[0], SKY_COLORS.warmBot, glow), SKY_COLORS.bot[1], night * (0.92 - 0.7 * glow));
  const land = {};
  for (const [k, [day, nite]] of Object.entries(LAND_COLORS)) land[k] = mixHex(mixHex(day, '#f2c49c', glow * 0.22), nite, night * (1 - 0.25 * glow));
  return { phase, night, warm, glow, h, rise, set, sun, moon, sky: { top, bot }, land };
}

/* ---------- hasard reproductible (tests) ---------- */
export function makeRng(seed = 1) {
  let a = (Math.floor(Number(seed)) >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- planificateur des comportements d'attente (pur) ---------- */
/* actions spontanées propres à chaque espèce (les doublons pèsent plus lourd) */
export const SPECIES_ACTS = Object.freeze({
  pony: ['sniff', 'paw', 'maneShake', 'whinny'],
  horse: ['sniff', 'paw', 'maneShake', 'whinny'],
  unicorn: ['sniff', 'maneShake', 'whinny', 'hornSparkle', 'hornSparkle'],
  cat: ['lick', 'stretch', 'butterfly'],
  capy: ['yawn', 'bliss', 'mandarin'],
  dolphin: ['jump', 'bubbles'],
  lion: ['roar', 'maneShake'],
  dragon: ['flap', 'smoke'],
  /* v2.5 : provisoire (actions génériques), chaque agent remplace la ligne de ses espèces */
  bear: ['sniff', 'stretch', 'butterfly', 'bliss'], koala: ['yawn', 'bliss', 'bliss', 'stretch'], dog: ['sniff', 'paw', 'wiggle', 'butterfly'],
  whale: ['spout', 'spout', 'jump', 'bubbles'],          /* v2.5 — eau : elle souffle (plus souvent), saute, fait des bulles */
  /* v2.5 — oiseaux (les ailes .c-wing battent avec flap ; whinny = il chante, notes de musique ; sniff = le poussin picore ;
     maneShake = il s'ébroue ; le pingouin ne s'envole pas : pas de flap) */
  owl: ['tilt', 'tilt', 'lookAround', 'flap', 'yawn'], parrot: ['whinny', 'whinny', 'maneShake', 'flap', 'tilt'],
  penguin: ['wiggle', 'maneShake', 'lookAround', 'whinny'], chick: ['sniff', 'sniff', 'whinny', 'flap']
});
export const GENERIC_ACTS = Object.freeze(['tilt', 'lookAround', 'hop', 'wiggle', 'sigh', 'hungry', 'yawn', 'proudPose']);
export const SLEEP_ACTS = Object.freeze(['sleepTwitch', 'sleepSigh']);
function pickWeighted(list, rng) {
  let sum = 0;
  for (const [, w] of list) sum += w;
  let r = rng() * sum;
  for (const [name, w] of list) { r -= w; if (r <= 0) return name; }
  return list[list.length - 1][0];
}
/* createPlanner({ species, stage, rng }) → tirages « jamais mécaniques » :
   blink()   → { wait 2,5-6 s, double (≈ 18 %) }
   glance()  → { wait 1,3-4,2 s, kind 'around' | 'child' | 'ahead' | 'up', x, y (-1…1), head (°) }
   micro()   → { wait 3,8-9,5 s, kind 'ear' | 'tail' | 'nod', side 'l' | 'r' }
   action({ night, mood 'low' | 'ok' | 'happy', hungry, tired, first }) → { wait 8-20 s (1re : 3,5-6 s), name }
     jamais l'une des deux dernières actions ; espèce d'abord ; humeur basse → soupirs, « petit creux », bâillements ;
     petit stade → plus joueur, champion → pose fière ; la nuit → seulement de petits mouvements de sommeil. */
export function createPlanner({ species = 'pony', stage = 2, rng = Math.random } = {}) {
  const acts = SPECIES_ACTS[species] || SPECIES_ACTS.pony;
  const between = (a, b) => a + (b - a) * rng();
  let recent = [], lastGaze = '', gazeRun = 0;
  return {
    blink() {
      const r = (rng() + rng()) / 2;                 /* intervalle en cloche entre 2,5 et 6 s */
      return { wait: Math.round(2500 + 3500 * r), double: rng() < 0.18 };
    },
    glance() {
      const r = rng();
      let kind = r < 0.42 ? 'around' : r < 0.68 ? 'child' : r < 0.88 ? 'ahead' : 'up';
      if (kind === lastGaze) { if (++gazeRun >= 2) { kind = kind === 'child' ? 'around' : 'child'; gazeRun = 0; } }
      else gazeRun = 0;
      lastGaze = kind;
      let x, y;
      if (kind === 'child') { x = between(-0.25, 0); y = between(0, 0.15); }
      else if (kind === 'ahead') { x = between(0.6, 0.9); y = between(-0.1, 0.15); }
      else if (kind === 'up') { x = between(0.1, 0.6); y = between(-0.95, -0.7); }
      else { const a = between(0, Math.PI * 2), m = between(0.45, 1); x = Math.cos(a) * m; y = Math.sin(a) * m * 0.8; }
      const head = kind === 'up' ? -4 : kind === 'child' ? -1.5 : between(-2.5, 2.5);
      return { wait: Math.round(between(1300, 4200)), kind, x, y, head };
    },
    micro() {
      const r = rng();
      return { wait: Math.round(between(3800, 9500)), kind: r < 0.45 ? 'ear' : r < 0.8 ? 'tail' : 'nod', side: rng() < 0.5 ? 'l' : 'r' };
    },
    action({ night = false, mood = 'ok', hungry = false, tired = false, first = false } = {}) {
      if (night) return { wait: Math.round(between(6000, 14000)), name: rng() < 0.55 ? 'sleepTwitch' : 'sleepSigh' };
      const wait = Math.round(first ? between(3500, 6000) : between(8000, 20000));
      let pool = acts.map(a => [a, 3]);
      if (mood === 'low') {
        pool = pool.map(([a, w]) => [a, w * 0.35]);
        pool.push(['sigh', 4]);
        if (hungry) pool.push(['hungry', 5]);
        if (tired) pool.push(['yawn', 3]);
      } else {
        pool.push(['tilt', 2], ['lookAround', 2], ['hop', mood === 'happy' ? 1.6 : 0.7]);
        if (mood === 'happy') pool.push(['wiggle', 0.8]);
        if (hungry) pool.push(['hungry', 2.5]);
        if (tired) pool.push(['yawn', 2]);
      }
      if (stage === 1 && mood !== 'low') pool.push(['hop', 0.9]);
      if (stage === 3 && mood !== 'low') pool.push(['proudPose', 1.2]);
      /* fusion des doublons (poids additionnés) */
      const merged = new Map();
      for (const [a, w] of pool) merged.set(a, (merged.get(a) || 0) + w);
      let cand = [...merged].filter(([a]) => !recent.includes(a));
      if (!cand.length) cand = [...merged];
      const name = pickWeighted(cand, rng);
      recent = [name, ...recent].slice(0, 2);
      return { wait, name };
    }
  };
}

/* ================= MOTEUR (DOM, uniquement à l'appel) ================= */
const NS = 'http://www.w3.org/2000/svg';
const INK = '#4a2c1a';
const nowMs = () => (G.performance && typeof G.performance.now === 'function' ? G.performance.now() : Date.now());
const R = () => { try { return reduced(); } catch (_) { return false; } };
const EXPR = Array.isArray(EXPRESSIONS) && EXPRESSIONS.length ? EXPRESSIONS
  : ['neutral', 'happy', 'delighted', 'proud', 'surprised', 'sleepy', 'hungry', 'focused'];

/* capacités du navigateur (évaluées au premier usage) : composition « add » des Web Animations */
let caps = null;
function cap() {
  if (caps) return caps;
  caps = { add: false };
  try { caps.add = typeof G.KeyframeEffect === 'function' && 'composite' in G.KeyframeEffect.prototype; } catch (_) {}
  return caps;
}

/* ---------- ordonnanceur partagé : un seul setTimeout pour tous les compagnons ---------- */
const SCH = { tasks: [], timer: 0, at: Infinity, firing: false };
function sched(owner, ms, fn, tag = '') {
  const t = { at: nowMs() + Math.max(0, +ms || 0), fn, owner, tag, dead: false };
  SCH.tasks.push(t);
  arm();
  return t;
}
function unsched(owner, tag) {
  let n = 0;
  for (const t of SCH.tasks) if (t.owner === owner && (tag === undefined || t.tag === tag)) { t.dead = true; n++; }
  if (n) { SCH.tasks = SCH.tasks.filter(t => !t.dead); arm(); }
}
function arm() {
  if (SCH.firing) return;
  let next = Infinity;
  for (const t of SCH.tasks) if (t.at < next) next = t.at;
  if (SCH.timer && next === SCH.at) return;
  if (SCH.timer) { clearTimeout(SCH.timer); SCH.timer = 0; }
  SCH.at = next;
  if (next < Infinity) SCH.timer = setTimeout(fire, Math.max(0, Math.ceil(next - nowMs())));
}
function fire() {
  SCH.timer = 0; SCH.at = Infinity; SCH.firing = true;
  const lim = nowMs() + 3;
  const due = [];
  SCH.tasks = SCH.tasks.filter(t => (t.at <= lim ? (due.push(t), false) : true));
  due.sort((a, b) => a.at - b.at);
  for (const t of due) {
    if (t.dead) continue;
    t.dead = true;
    try { t.fn(); } catch (e) { try { console.error(e); } catch (_) {} }
  }
  SCH.firing = false;
  arm();
}

/* ---------- environnement partagé : registre, visibilité, pointeur, ramasse-miettes ---------- */
const BY_SVG = new WeakMap();
const ENV = { lives: new Set(), io: null, bound: false, ptr: null, raf: 0 };
function onIO(entries) {
  for (const en of entries) {
    const l = BY_SVG.get(en.target);
    if (l) l._setVisible(en.isIntersecting);
  }
}
function onVis() {
  let hid = false;
  try { hid = G.document.visibilityState === 'hidden'; } catch (_) {}
  for (const l of [...ENV.lives]) l._setDocHidden(hid);
}
function flushPtr() {
  ENV.raf = 0;
  const p = ENV.ptr;
  if (!p) return;
  for (const l of [...ENV.lives]) { try { l._onPointer(p); } catch (_) {} }
}
function onPtr(e) {
  ENV.ptr = { x: e.clientX, y: e.clientY, type: e.pointerType || 'mouse', down: e.type === 'pointerdown', t: nowMs() };
  if (!ENV.raf) { try { ENV.raf = G.requestAnimationFrame(flushPtr); } catch (_) { flushPtr(); } }
}
function gcTick() {
  const t = nowMs();
  for (const l of [...ENV.lives]) {
    if (!l.svg.isConnected && (l._seen || t - l._born > 15000)) l.destroy();
  }
  if (ENV.lives.size) sched(ENV, 4000, gcTick, 'gc');
}
function envAdd(l) {
  ENV.lives.add(l);
  BY_SVG.set(l.svg, l);
  if (!ENV.bound) {
    ENV.bound = true;
    try { ENV.io = typeof G.IntersectionObserver === 'function' ? new G.IntersectionObserver(onIO, { threshold: 0 }) : null; } catch (_) { ENV.io = null; }
    try {
      G.addEventListener('pointermove', onPtr, { passive: true });
      G.addEventListener('pointerdown', onPtr, { passive: true, capture: true });
      G.document.addEventListener('visibilitychange', onVis);
    } catch (_) {}
    sched(ENV, 4000, gcTick, 'gc');
    try { if (G.__caramelDebug && typeof G.__caramelDebug === 'object') G.__caramelDebug.life = lifeStats; } catch (_) {}
  }
  try { if (ENV.io) ENV.io.observe(l.svg); } catch (_) {}
}
function envRemove(l) {
  ENV.lives.delete(l);
  if (BY_SVG.get(l.svg) === l) BY_SVG.delete(l.svg);
  try { if (ENV.io) ENV.io.unobserve(l.svg); } catch (_) {}
  if (ENV.lives.size || !ENV.bound) return;
  ENV.bound = false;
  try { if (ENV.io) ENV.io.disconnect(); } catch (_) {}
  ENV.io = null;
  try {
    G.removeEventListener('pointermove', onPtr, { passive: true });
    G.removeEventListener('pointerdown', onPtr, { passive: true, capture: true });
    G.document.removeEventListener('visibilitychange', onVis);
  } catch (_) {}
  if (ENV.raf) { try { G.cancelAnimationFrame(ENV.raf); } catch (_) {} ENV.raf = 0; }
  ENV.ptr = null;
  unsched(ENV);
}
/* état du moteur (tests de fuite : quitter l'accueil et y revenir ne doit rien accumuler) */
export function lifeStats() {
  return { lives: ENV.lives.size, tasks: SCH.tasks.length, timer: !!SCH.timer, bound: ENV.bound };
}
export function lifeOf(svg) { return (svg && BY_SVG.get(svg)) || null; }

/* ---------- effets (SVG, centrés sur 0,0) ---------- */
const FONT = "Fredoka, 'Segoe UI Rounded', 'Segoe UI', system-ui, sans-serif";
const FX = {
  heart: (c = '#ff7f9e') => `<path d="M0,3.6C-4,.8 -6,-1.4 -6,-3.6C-6,-5.6 -4.5,-7 -2.9,-7C-1.6,-7 -.6,-6.3 0,-5.2C.6,-6.3 1.6,-7 2.9,-7C4.5,-7 6,-5.6 6,-3.6C6,-1.4 4,.8 0,3.6Z" fill="${c}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/><ellipse cx="-2.7" cy="-4.4" rx="1.3" ry=".8" fill="#fff" opacity=".75"/>`,
  z: size => `<text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-weight="700" font-size="${size}" fill="#ffffff" stroke="#6b5cad" stroke-width="1.5" stroke-linejoin="round" paint-order="stroke">Z</text>`,
  dot: (r, c) => `<circle r="${r}" fill="${c}" stroke="${INK}" stroke-width=".45"/>`,
  sparkle: (c = '#fff4b8', s = '#e0a52e') => `<path d="M0,-3.4L.9,-.9 3.4,0 .9,.9 0,3.4 -.9,.9 -3.4,0 -.9,-.9Z" fill="${c}" stroke="${s}" stroke-width=".6" stroke-linejoin="round"/>`,
  bubble: r => `<circle r="${r}" fill="#e8f8ff" fill-opacity=".5" stroke="#5aa6cf" stroke-width=".7"/><circle cx="${(-r * 0.35).toFixed(2)}" cy="${(-r * 0.35).toFixed(2)}" r="${(r * 0.28).toFixed(2)}" fill="#fff"/>`,
  puff: r => `<circle r="${r}" fill="#f7f3ef" stroke="#b8aba1" stroke-width=".6"/><circle cx="${(-r * 0.3).toFixed(2)}" cy="${(-r * 0.3).toFixed(2)}" r="${(r * 0.35).toFixed(2)}" fill="#fff"/>`,
  dust: r => `<ellipse rx="${r}" ry="${(r * 0.62).toFixed(2)}" fill="#ead9b4" stroke="#b79a6a" stroke-width=".5"/>`,
  note: c => `<path d="M.9,1.3V-5.6L5,-6.8V-5.2L2.2,-4.3" fill="none" stroke="${c}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="-.3" cy="1.6" rx="1.7" ry="1.25" fill="${c}" transform="rotate(-20 -.3 1.6)"/>`,
  drop: () => '<path d="M0,-2.2C1,-.7 1.5,.2 1.5,.9A1.5,1.5 0 0 1 -1.5,.9C-1.5,.2 -1,-.7 0,-2.2Z" fill="#a8e1fc" stroke="#4a90c2" stroke-width=".5"/>',
  roar: () => `<path d="M0,-3.6L4.6,-5.6M.4,0H5.6M0,3.6L4.6,5.6" fill="none" stroke="${INK}" stroke-width="1.15" stroke-linecap="round" opacity=".7"/>`,
  ember: () => '<circle r=".9" fill="#ffb347" stroke="#e26a1f" stroke-width=".4"/>',
  /* brosse vue de profil : dos rose, manche en bois, poils clairs dirigés vers le bas (pointe à y ≈ 1) */
  brush: () => `<g transform="rotate(-6)"><rect x="1.4" y="-6.6" width="11" height="3.4" rx="1.7" fill="#d99a5b" stroke="${INK}" stroke-width=".9"/>`
    + `<rect x="-8.6" y="-7.8" width="10.6" height="5.6" rx="2" fill="#f9a8d4" stroke="${INK}" stroke-width=".9"/>`
    + '<path d="M-7.4,-2.2v3M-5.4,-2.2v3.2M-3.4,-2.2v3.2M-1.4,-2.2v3.2M.6,-2.2v3" stroke="#fff8e8" stroke-width="1" stroke-linecap="round"/>'
    + '<ellipse cx="-5" cy="-6.2" rx="2.4" ry=".8" fill="#fff" opacity=".6"/></g>',
  /* papillon : ailes (battent en largeur) + corps */
  butterfly: () => '<g class="cl-bf-w"><path d="M0,0C-1.6,-4.8 -6.2,-6 -6.6,-3C-6.9,-.9 -3.2,.4 0,0Z" fill="#ffd166" stroke="#4a2c1a" stroke-width=".6"/>'
    + '<path d="M0,0C-2.8,1.4 -5.2,3.8 -3.4,5C-1.8,5.8 -.4,3 0,0Z" fill="#ff9fbf" stroke="#4a2c1a" stroke-width=".6"/>'
    + '<path d="M0,0C1.6,-4.8 6.2,-6 6.6,-3C6.9,-.9 3.2,.4 0,0Z" fill="#ffd166" stroke="#4a2c1a" stroke-width=".6"/>'
    + '<path d="M0,0C2.8,1.4 5.2,3.8 3.4,5C1.8,5.8 .4,3 0,0Z" fill="#ff9fbf" stroke="#4a2c1a" stroke-width=".6"/></g>'
    + `<ellipse rx=".7" ry="2.6" fill="${INK}"/><path d="M-.3,-2.4C-.9,-3.6 -1.6,-4 -2.2,-4M.3,-2.4C.9,-3.6 1.6,-4 2.2,-4" fill="none" stroke="${INK}" stroke-width=".45" stroke-linecap="round"/>`
};
/* miettes selon l'aliment, par emoji (react('eat', { food: emoji }) ; un emoji = un aliment, js/content/companion-data.js
   FOODS ; v2.4 : les trois aliments de chaque espèce — la poire avait les miettes rouges d'une pomme 🍎) */
export const CRUMBS = Object.freeze({
  '🥕': ['#ff9a3c', '#f07a1f', '#67c26f'], '🍐': ['#c9d94a', '#fff6c2', '#a8b83a'], '🥧': ['#f0c070', '#d9963f', '#fff0c8'],
  '🍓': ['#ef4b5f', '#ffd4d9', '#5fb85a'], '🍰': ['#fff3e0', '#f7b6c8', '#e9c48a'],
  '🥣': ['#b8763c', '#8a5428', '#d9a066'], '🐟': ['#9cc7e8', '#e8f4ff', '#6f9fc8'], '🍣': ['#fff8f0', '#ff9a76', '#3d5a40'],
  '🦐': ['#ff9b7a', '#ffd0bd', '#e8704f'], '🦑': ['#f6c6d6', '#ffe8ef', '#d996b0'],
  '🍊': ['#ffa53a', '#ffd38a', '#f08a1c'], '🥬': ['#8fd16a', '#d6f2b8', '#5fae45'], '🍉': ['#f2556a', '#ffd0d6', '#4fae5a'],
  '🍗': ['#d98a45', '#f5c993', '#a85f2a'], '🥩': ['#d65a5a', '#f6c0b0', '#a83a3a'], '🍔': ['#e8a54a', '#7a4a2a', '#6cbf5a'],
  '🌶\uFE0F': ['#e8402e', '#ff8a5c', '#5aa84a'], '🍿': ['#fffbe8', '#ffe28a', '#f2c94c'], '🍕': ['#f6c453', '#e8553e', '#fff0c8']
  /* v2.5 — terre : miettes des nouveaux aliments ici (chaque entrée commence par sa virgule) */
  , '🍒': ['#d8283c', '#ff8a96', '#6aa84f'], '🍯': ['#f6b42c', '#ffd977', '#e08e0b']
  , '🌱': ['#7ccf5a', '#c8f0a8', '#4f9e3a'], '🍃': ['#6cc46a', '#b9eab0', '#3f9a4a'], '🌿': ['#7fb59a', '#cfe8d8', '#4f8f74']
  , '🌭': ['#c8553a', '#f2c27a', '#e8a948'], '🦴': ['#fff6e6', '#e8dcc4', '#cbb898']
  /* v2.5 — eau : miettes des nouveaux aliments ici */
  , '🐠': ['#ffa53a', '#fff3e0', '#4fa8e8']
  /* v2.5 — oiseaux : miettes des nouveaux aliments ici */
  , '🐛': ['#9ad64f', '#e2f5a8', '#6aa83a'], '🦗': ['#8fbf4a', '#d4e89a', '#5e8a2c'], '🍢': ['#d9a066', '#f6d9a8', '#a86a3a']
  , '🌻': ['#5a4030', '#f6f0dc', '#f6c344'], '🍌': ['#ffe066', '#fff6c2', '#e8c33a'], '🥭': ['#ffb02e', '#ffd36b', '#f2763a']
  , '🌾': ['#e8c06a', '#f6dfa0', '#c99a3e'], '🌽': ['#ffd84a', '#fff0a0', '#7cc25a']
});
const DEFAULT_CRUMBS = ['#e8c18a', '#c9965a', '#fff0c8'];
/* repli si les ancres du rig sont indisponibles */
const ANCHORS0 = { ground: 74, mouth: [78, 40], eyes: [[59, 29], [68, 28]], top: [63, 17], neck: [61, 44], back: [40, 43], chest: [60, 52], tail: [24, 49] };
function anchorsOf(species, stage) {
  try {
    const a = mountAnchors(species, { stage });
    if (a && Array.isArray(a.mouth) && Array.isArray(a.eyes)) return a;
  } catch (_) {}
  return ANCHORS0;
}

/* ================= CONTRÔLEUR ================= */
class Life {
  constructor(svg, o) {
    this.svg = svg;
    this.light = !!o.light;
    this.species = o.species || svg.getAttribute('data-species') || 'pony';
    this.stage = clamp(Math.round(+o.stage || +svg.getAttribute('data-stage') || 2), 1, 3);
    this.interactive = o.interactive !== false;
    this.onEvent = typeof o.onEvent === 'function' ? o.onEvent : null;
    this.rng = typeof o.rng === 'function' ? o.rng : Math.random;
    this.planner = createPlanner({ species: this.species, stage: this.stage, rng: this.rng });
    this.autoSleep = !this.light && o.autoSleep !== false;
    this.hitEl = this.interactive ? (o.hitEl === undefined ? svg.parentElement : o.hitEl) : null;
    this.destroyed = false; this.paused = false; this.visible = true; this.docHidden = false; this.running = false;
    this._seen = !!svg.isConnected; this._born = nowMs();
    this.anims = new Set(); this.sceneAnims = new Set(); this.sceneClasses = new Set(); this.waiters = new Set();
    this.sceneTok = 0; this.sceneLevel = -1; this.rt = 0;
    this.origClass = svg.getAttribute('class') || '';
    this.origExpr = svg.getAttribute('data-expr') || 'neutral';
    this.baseExpr = EXPR.includes(this.origExpr) ? this.origExpr : 'neutral';
    this.tempExpr = null;
    this.mood = { faim: 80, forme: 80, joie: 80 }; this.moodState = 'ok'; this.flags = { hungry: false, tired: false, lonely: false };
    this.sleepMode = null; this.sleeping = false; this.awakeUntil = 0; this.lastTouch = 0; this.lastTap = 0; this.combo = 0;
    this.gz = { x: 0, y: 0 }; this.ptrUntil = 0; this.target = null;
    this.poses = {}; this.look = 0; this.posed = false;
    this.saved = [];
    this.firstAct = true;
    this.P = this._parts();
    this.A = anchorsOf(this.species, this.stage);
    const e = this.A.eyes || ANCHORS0.eyes;
    this.eyeC = [(e[0][0] + e[e.length - 1][0]) / 2, (e[0][1] + e[e.length - 1][1]) / 2];
    try { this.docHidden = G.document.visibilityState === 'hidden'; } catch (_) {}
    this._takeOver();
    if (this.svg.classList.contains('sleep')) this.sleeping = true;
    /* sommeil imposé dès la naissance (v2.4 : sieste quand le temps de jeu du jour est fini), comme sleep(v) */
    if (o.sleep === true || o.sleep === false) this.sleepMode = o.sleep;
    const night = this.sleepMode === null ? isNight(new Date()) : this.sleepMode;
    if (o.awake && !this.sleeping) { this.awakeUntil = nowMs() + 45000; this.lastTouch = nowMs(); }
    else if (this.autoSleep && !this.sleeping && night) this._sleepNow();
    if (this.sleeping) { this.svg.classList.add('sleep'); }
    if (o.mood && typeof o.mood === 'object') this.setMood(o.mood);
    this._applyPoses(1);
    this._bindHit();
    envAdd(this);
    this._sync();
    if (!this.light && o.greet !== false && !this.sleeping) sched(this, 420, () => this._greet(), 'greet');
  }

  /* ---------- outils ---------- */
  _parts() {
    const s = this.svg;
    const q = c => s.querySelector(c), qa = c => Array.from(s.querySelectorAll(c));
    return {
      all: q('.c-all'), body: q('.m-body'), head: q('.c-head'), earL: q('.c-ear-l'), earR: q('.c-ear-r'), ears: qa('.m-ear'),
      mane: qa('.c-mane'), lids: qa('.m-lid'), pupils: qa('.c-pupil'), cheek: q('.c-cheek'), nose: q('.c-nose'),
      tail: q('.m-tail'), tip: q('.c-tail-tip'), legsF: qa('.m-legF .c-leg'), legsB: qa('.m-legB .c-leg'),
      wings: qa('.c-wing'), spark: q('.c-spark'), shadow: q('.c-shadow')
    };
  }
  _inline(el, prop, val) {
    if (!el) return;
    this.saved.push([el, prop, el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)]);
    el.style.setProperty(prop, val);
  }
  /* le moteur prend la main sur les « secours » CSS (clignement, coup d'œil, oreilles) — sauf en mouvement réduit,
     où les règles !important de mount.css gardent le clignement CSS */
  _takeOver() {
    const P = this.P;
    /* clignement, coup d'œil et frémissement d'oreille : pilotés ici (les oreilles retrouvent aussi la pose d'humeur
       de mount.css, invisible tant que leur transform était animé) */
    for (const el of [...P.lids, ...P.pupils, ...P.ears]) this._inline(el, 'animation', 'none');
    /* poses d'humeur de la tête, du torse et de la queue : rejouées en transform additif (cf. _applyPoses) */
    if (cap().add) {
      for (const el of [P.head, P.body, P.tail]) {
        if (!el) continue;
        this._inline(el, 'transition', 'none'); this._inline(el, 'rotate', 'none'); this._inline(el, 'translate', 'none');
      }
      this.posed = true;
    }
    if (!this.light) {
      /* groupes animés ici mais absents de la liste fill-box de mount.css (aucun n'a d'attribut transform) */
      for (const el of [P.nose, ...P.mane]) {
        if (!el || el.hasAttribute('transform')) continue;
        this._inline(el, 'transform-box', 'fill-box');
        this._inline(el, 'transform-origin', '50% 50%');
      }
    }
  }
  _emit(type, detail) { if (this.onEvent) { try { this.onEvent(type, detail || {}); } catch (e) { try { console.error(e); } catch (_) {} } } }
  _sched(ms, fn, tag = 'idle') { return sched(this, ms, () => { if (!this.destroyed) fn(); }, tag); }
  _wait(ms, tok) {
    return new Promise(res => {
      if (this.destroyed) { res(false); return; }
      const done = v => { this.waiters.delete(done); res(v); };
      this.waiters.add(done);
      sched(this, ms, () => done(!this.destroyed && (tok === undefined || tok === this.sceneTok)), 'wait');
    });
  }
  /* animation suivie (annulée par destroy) */
  _play(el, frames, opts, scene) {
    if (!el || this.destroyed || typeof el.animate !== 'function') return null;
    try {
      const a = el.animate(frames, opts);
      this.anims.add(a);
      if (scene) this.sceneAnims.add(a);
      const done = () => { this.anims.delete(a); this.sceneAnims.delete(a); };
      a.addEventListener('finish', done);
      a.addEventListener('cancel', done);
      return a;
    } catch (_) { return null; }
  }
  /* geste additif : rotate (degrés), translate ([x, y] ou y) ou scale (k ou [kx, ky]), en unités du viewBox.
     Écrit sur la propriété transform en composition « add » : il s'ajoute aux keyframes CSS du rig (respiration,
     balancement, regard…). NB : Chrome ignore au rendu les propriétés individuelles rotate / translate / scale d'un
     groupe SVG dont transform est animé en CSS — d'où transform, et non ces propriétés. */
  _g(el, prop, values, dur, { delay = 0, easing = 'ease-in-out', offsets, composite, scene = true } = {}) {
    if (!el) return null;
    const fmt = v => (prop === 'rotate' ? 'rotate(' + v + 'deg)'
      : prop === 'translate' ? (Array.isArray(v) ? 'translate(' + v[0] + 'px,' + v[1] + 'px)' : 'translate(0px,' + v + 'px)')
        : (Array.isArray(v) ? 'scale(' + v[0] + ',' + v[1] + ')' : 'scale(' + v + ')'));
    const frames = values.map((v, i) => {
      const f = { transform: fmt(v) };
      if (offsets && offsets[i] !== undefined) f.offset = offsets[i];
      return f;
    });
    return this._play(el, frames, { duration: dur, delay, easing, composite: composite || (cap().add ? 'add' : 'replace') }, scene);
  }
  _mouth(expr) { return this.svg.querySelector('.x-' + expr + ' .m-mouth'); }
  _rand(a, b) { return a + (b - a) * this.rng(); }

  /* ---------- état actif / pause ---------- */
  _sync() {
    const run = !this.destroyed && !this.paused && this.visible && !this.docHidden;
    if (run === this.running) return;
    this.running = run;
    if (run) {
      this.svg.classList.remove('cl-paused');
      this._startLoops();
      this._emit('resume');
    } else {
      unsched(this, 'idle');
      unsched(this, 'zz');
      if (!this.destroyed) { this.svg.classList.add('cl-paused'); this._emit('pause'); }
    }
  }
  _setVisible(v) {
    if (v) this._seen = true;
    else if (!this.svg.isConnected && this._seen) { this.destroy(); return; }
    this.visible = !!v;
    this._sync();
  }
  _setDocHidden(h) { this.docHidden = !!h; this._sync(); }
  pause() { this.paused = true; this._sync(); }
  resume() { this.paused = false; this._sync(); }

  /* ---------- boucles d'attente ---------- */
  _startLoops() {
    unsched(this, 'idle');
    this._loopBlink();
    this._loopGaze();
    this._loopMicro();
    if (this.light) return;
    this._loopAct();
    this._loopClock(true);
    if (this.sleeping) this._loopZ();
  }
  _canIdle() { return this.running && !R(); }
  _loopBlink() {
    const b = this.planner.blink();
    this._sched(b.wait, () => { if (this._canIdle()) this._blink(b.double); this._loopBlink(); });
  }
  _loopGaze() {
    const g = this.planner.glance();
    this._sched(g.wait, () => {
      if (this._canIdle() && !this.sceneTok && !this.sleeping && !this.target && nowMs() > this.ptrUntil) {
        this._gaze(g.x, g.y, g.kind === 'child' ? 220 : 150);
        if (!this.light) this._headPose(g.head, 650);
      }
      this._loopGaze();
    });
  }
  _loopMicro() {
    const m = this.planner.micro();
    this._sched(m.wait, () => {
      if (this._canIdle() && !this.sceneTok && !this.sleeping) {
        if (m.kind === 'ear' || this.light) this._earTwitch(m.side);
        else if (m.kind === 'tail') this._tailFlick();
        else this._g(this.P.head, 'rotate', [0, -3.5, 1, 0], 1100, { scene: false });
      }
      this._loopMicro();
    });
  }
  _loopAct() {
    const state = () => ({ night: this.sleeping, mood: this.moodState, hungry: this.flags.hungry, tired: this.flags.tired });
    const s0 = state();
    const a = this.planner.action(Object.assign({ first: this.firstAct }, s0));
    this._sched(a.wait, () => {
      /* l'enfant joue avec lui en ce moment : on remet à un peu plus tard */
      if (nowMs() - this.lastTouch < 5000 || nowMs() < this.ptrUntil) { this._sched(2500 + 2000 * this.rng(), () => this._loopAct()); return; }
      if (this._canIdle() && !this.sceneTok) {
        this.firstAct = false;
        /* l'humeur (ou la nuit) a changé depuis le tirage : on choisit une action qui lui va */
        const s1 = state();
        const name = s1.night !== s0.night || s1.mood !== s0.mood || s1.hungry !== s0.hungry ? this.planner.action(s1).name : a.name;
        this._doAct(name);
      }
      this._loopAct();
    });
  }
  /* toutes les 20 s : la nuit tombe-t-elle ? le jour se lève-t-il ? */
  _clockCheck() {
    if (this.destroyed || !this.autoSleep) return;
    const night = this.sleepMode === null ? isNight(new Date()) : this.sleepMode;
    if (night && !this.sleeping && !this.sceneTok && nowMs() > this.awakeUntil && nowMs() - this.lastTouch > 30000) this._fallAsleep();
    else if (!night && this.sleeping && this.sleepMode !== true) this._wakeUp(false);
  }
  _loopClock(now) {
    if (now) this._clockCheck();
    this._sched(20000, () => { this._clockCheck(); this._loopClock(false); });
  }
  _loopZ() {
    unsched(this, 'zz');
    const tick = () => {
      if (!this.sleeping || !this.running) return;
      if (!R()) this._fxZ();
      this._sched(1700 + 900 * this.rng(), tick, 'zz');
    };
    this._sched(600, tick, 'zz');
  }

  /* ---------- micro-gestes ---------- */
  _blink(double) {
    if (this.sleeping || !this.P.lids.length) return;
    const ex = this.svg.getAttribute('data-expr');
    if (ex === 'delighted' || ex === 'sleepy' || ex === 'proud' || this.svg.classList.contains('dance')) return;
    const d = 140 + 50 * this.rng();
    const frames = double
      ? [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)', offset: 0.2 }, { transform: 'scaleY(.15)', offset: 0.42 }, { transform: 'scaleY(1)', offset: 0.64 }, { transform: 'scaleY(0)' }]
      : [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)', offset: 0.42 }, { transform: 'scaleY(1)', offset: 0.56 }, { transform: 'scaleY(0)' }];
    for (const l of this.P.lids) this._play(l, frames, { duration: double ? d * 2.2 : d, easing: 'ease-in-out', composite: 'replace' });
  }
  _earTwitch(side) {
    const ear = side === 'l' ? this.P.earL : this.P.earR;
    this._g(ear, 'rotate', [0, -15, 5, -7, 0], 460, { scene: false, offsets: [0, 0.25, 0.5, 0.75, 1] });
  }
  _tailFlick() {
    this._g(this.P.tail, 'rotate', [0, 11, -5, 0], 640, { scene: false });
    this._g(this.P.tip, 'rotate', [0, 16, -8, 0], 640, { scene: false, delay: 120 });
  }
  /* regard : déplacement des pupilles (transition CSS en ligne, interruptible) ; x, y ∈ [-1, 1] */
  _gaze(x, y, ms = 130) {
    if (!this.P.pupils.length) return;
    x = clamp(+x || 0, -1, 1); y = clamp(+y || 0, -1, 1);
    if (Math.abs(x - this.gz.x) < 0.03 && Math.abs(y - this.gz.y) < 0.03) return;
    this.gz = { x, y };
    const t = 'translate(' + (x * 0.85).toFixed(2) + 'px,' + (y * 0.7).toFixed(2) + 'px)';
    for (const p of this.P.pupils) {
      p.style.transition = 'transform ' + Math.round(ms) + 'ms cubic-bezier(.25,.8,.35,1)';
      p.style.transform = t;
    }
  }
  /* ---------- poses persistantes (additives, une animation « fill forwards » par groupe, remplacée en douceur) ----------
     Couchée la nuit, tête et queue basses quand ça ne va pas, menton levé quand il est fier : mount.css décrit ces
     poses avec les propriétés rotate / translate, que Chrome n'affiche pas sur un groupe dont transform est animé
     (tête, torse, queue). Le moteur neutralise ces propriétés sur ces trois groupes (style en ligne « none », sans
     transition), LIT les valeurs que mount.css leur donne pour l'humeur du moment et les rejoue en transform additif,
     avec une vraie transition (il se couche, se relève, baisse la tête) : si mount.css change ces valeurs — ou passe
     à une autre technique —, le moteur suit sans rien doubler. Le regard de la tête (vers le doigt, le papillon…)
     s'ajoute à la pose d'humeur. */
  _poseNow(st) {
    if (!st.anim) return st.to;
    const k = clamp((nowMs() - st.t0) / st.ms, 0, 1), e = 1 - Math.pow(1 - k, 2.2);
    const f = n => st.from[n] + (st.to[n] - st.from[n]) * e;
    return { r: f('r'), x: f('x'), y: f('y') };
  }
  _pose(key, el, to, ms) {
    if (!el || !cap().add) return;
    const st = this.poses[key] || (this.poses[key] = { from: { r: 0, x: 0, y: 0 }, to: { r: 0, x: 0, y: 0 }, t0: 0, ms: 1, anim: null });
    const cur = this._poseNow(st);
    const tgt = { r: +to.r || 0, x: +to.x || 0, y: +to.y || 0 };
    const near = (a, b) => Math.abs(a.r - b.r) < 0.25 && Math.abs(a.x - b.x) < 0.08 && Math.abs(a.y - b.y) < 0.08;
    if (near(cur, tgt) && near(st.to, tgt)) return;
    if (st.anim) { try { st.anim.cancel(); } catch (_) {} }
    const tf = p => 'translate(' + p.x.toFixed(2) + 'px,' + p.y.toFixed(2) + 'px) rotate(' + p.r.toFixed(2) + 'deg)';
    const dur = R() ? 1 : Math.max(1, ms);
    st.anim = this._play(el, [{ transform: tf(cur) }, { transform: tf(tgt) }], { duration: dur, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards', composite: 'add' });
    st.from = cur; st.to = tgt; st.t0 = nowMs(); st.ms = dur;
  }
  /* décalage que mount.css donne à ce groupe pour l'humeur / l'expression du moment (propriétés rotate et translate),
     lu un instant sans la neutralisation en ligne : { r (degrés), x, y (unités du viewBox) } */
  _cssOffsets(el) {
    const z = { r: 0, x: 0, y: 0 };
    if (!el || typeof G.getComputedStyle !== 'function') return z;
    const st = el.style;
    try {
      st.removeProperty('rotate'); st.removeProperty('translate');
      const cs = G.getComputedStyle(el);
      const r = parseFloat(String(cs.rotate || 'none').trim().split(/\s+/).pop());
      const t = String(cs.translate || 'none').trim().split(/\s+/).map(parseFloat);
      return { r: Number.isFinite(r) ? r : 0, x: Number.isFinite(t[0]) ? t[0] : 0, y: Number.isFinite(t[1]) ? t[1] : 0 };
    } catch (_) { return z; } finally {
      st.setProperty('rotate', 'none'); st.setProperty('translate', 'none');
    }
  }
  _applyPoses(ms = 650) {
    if (this.destroyed || !this.posed) return;
    const h = this._cssOffsets(this.P.head);
    this._pose('head', this.P.head, { r: h.r + this.look, x: h.x, y: h.y }, ms);
    this._pose('body', this.P.body, this._cssOffsets(this.P.body), ms);
    this._pose('tail', this.P.tail, this._cssOffsets(this.P.tail), ms);
  }
  /* rotation de regard de la tête (degrés), ajoutée à la pose d'humeur */
  _headPose(deg, ms = 500) {
    if (this.light || !this.posed) return;
    this.look = clamp(+deg || 0, -12, 12);
    const h = this._cssOffsets(this.P.head);
    this._pose('head', this.P.head, { r: h.r + this.look, x: h.x, y: h.y }, ms);
  }
  /* regarde un point de l'écran (coordonnées client) */
  _gazeAt(x, y, ms = 110) {
    let r;
    try { r = this.svg.getBoundingClientRect(); } catch (_) { return false; }
    if (!r || !r.width) return false;
    const ex = r.left + (this.eyeC[0] / 100) * r.width, ey = r.top + (this.eyeC[1] / 84) * r.height;
    const dx = x - ex, dy = y - ey, d = Math.hypot(dx, dy) || 1;
    const m = Math.min(1, d / Math.max(18, r.width * 0.3));
    this._gaze((dx / d) * m, (dy / d) * m, ms);
    if (!this.light) this._headPose(clamp((dy / d) * m * 7, -7, 7) * (dx < 0 ? 0.5 : 1), 420);
    return true;
  }
  _onPointer(p) {
    if (!this.running || R() || this.sleeping || this.target || (this.sceneTok && this.sceneLevel >= 1)) return;
    let r;
    try { r = this.svg.getBoundingClientRect(); } catch (_) { return; }
    if (!r || !r.width) return;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const reach = Math.max(170, r.width * 2.4);
    if (Math.hypot(p.x - cx, p.y - cy) > reach) return;
    if (this._gazeAt(p.x, p.y, p.down ? 160 : 90)) this.ptrUntil = nowMs() + (p.down ? 1700 : 1300);
  }

  /* ---------- expressions, classes ---------- */
  _applyExpr() {
    const ex = this.tempExpr || this.baseExpr;
    const was = this.svg.getAttribute('data-expr');
    if (was === ex) return;
    this.svg.setAttribute('data-expr', ex);
    if (was === 'proud' || ex === 'proud') this._applyPoses(420);
  }
  setExpression(name, ms) {
    if (this.destroyed) return;
    const ex = EXPR.includes(name) ? name : 'neutral';
    unsched(this, 'expr');
    if (+ms > 0) {
      this.tempExpr = ex;
      this._sched(+ms, () => { this.tempExpr = null; this._applyExpr(); }, 'expr');
    } else { this.baseExpr = ex; this.tempExpr = null; }
    this._applyExpr();
  }
  /* classe d'humeur à animation unique (hop, joy, wiggle…) : rejouée même si elle est déjà posée */
  _pulse(cls, ms) {
    const s = this.svg;
    s.classList.remove(cls);
    try { void s.getBoundingClientRect(); } catch (_) {}
    s.classList.add(cls);
    this.sceneClasses.add(cls);
    unsched(this, 'cls-' + cls);
    this._sched(ms, () => { s.classList.remove(cls); this.sceneClasses.delete(cls); }, 'cls-' + cls);
  }
  _addClass(cls) { this.svg.classList.add(cls); this.sceneClasses.add(cls); }
  _delClass(cls) { this.svg.classList.remove(cls); this.sceneClasses.delete(cls); unsched(this, 'cls-' + cls); }

  /* ---------- scènes (actions spontanées et réactions) : une seule à la fois ----------
     niveau 0 = action spontanée, 1 = petite réaction (toucher, surprise, fierté), 2 = soin (manger, brosser, promener,
     câlin, fête) ; une scène de niveau ≥ remplace la précédente (gestes rembobinés en douceur), sinon elle est refusée */
  _begin(level) {
    if (this.destroyed) return 0;
    if (this.sceneTok && level < this.sceneLevel) return 0;
    if (this.sceneTok) this._abort();
    this.sceneTok = ++this.rt;
    this.sceneLevel = level;
    return this.sceneTok;
  }
  _alive(tok) { return !this.destroyed && tok === this.sceneTok; }
  _end(tok) {
    if (tok !== this.sceneTok) return;
    /* après une réaction (soin, toucher), on laisse respirer avant la prochaine action spontanée */
    if (this.sceneLevel >= 1) this.lastTouch = Math.max(this.lastTouch, nowMs() - 2000);
    this.sceneTok = 0; this.sceneLevel = -1;
  }
  _abort() {
    for (const a of [...this.sceneAnims]) {
      try { if (a.playState === 'running') a.updatePlaybackRate(-4); else a.cancel(); } catch (_) { try { a.cancel(); } catch (__) {} }
    }
    this.sceneAnims.clear();
    for (const c of [...this.sceneClasses]) this._delClass(c);
    unsched(this, 'scene');
    this.tempExpr = null; unsched(this, 'expr'); this._applyExpr();
    this.sceneTok = 0; this.sceneLevel = -1;
  }
  _later(ms, fn, tok) { return this._sched(ms, () => { if (tok === undefined || this._alive(tok)) fn(); }, 'scene'); }

  /* ---------- effets ---------- */
  _fxLayer() {
    if (this.fx && this.fx.parentNode === this.svg) return this.fx;
    const g = G.document.createElementNS(NS, 'g');
    g.setAttribute('class', 'cl-fx');
    g.setAttribute('pointer-events', 'none');
    this.svg.appendChild(g);
    return (this.fx = g);
  }
  /* pose un effet en (x, y) (unités du viewBox) et l'anime : frames = [{ dx, dy, s, r, o, offset }] */
  _spawn(markup, x, y, frames, { dur = 1000, delay = 0, easing = 'ease-out' } = {}) {
    if (this.destroyed || !G.document) return null;
    const g = G.document.createElementNS(NS, 'g');
    g.setAttribute('class', 'cl-p');
    g.style.transformBox = 'view-box';
    g.style.transformOrigin = '0 0';
    g.innerHTML = markup;
    const tf = f => 'translate(' + (x + (f.dx || 0)).toFixed(2) + 'px,' + (y + (f.dy || 0)).toFixed(2) + 'px) rotate(' + (f.r || 0) + 'deg) scale(' + (f.s === undefined ? 1 : f.s) + ')';
    const kf = frames.map(f => { const k = { transform: tf(f), opacity: f.o === undefined ? 1 : f.o }; if (f.offset !== undefined) k.offset = f.offset; return k; });
    g.style.transform = kf[0].transform;
    g.style.opacity = '0';
    this._fxLayer().appendChild(g);
    const a = this._play(g, kf, { duration: dur, delay, easing, fill: 'both', composite: 'replace' });
    const end = () => { try { g.remove(); } catch (_) {} };
    if (a) a.finished.then(end, end); else end();
    return g;
  }
  _fxHeart(x, y, k = 1, delay = 0) {
    const sx = this._rand(-3, 3);
    if (R()) return this._spawn(FX.heart(), x, y, [{ s: k, o: 0 }, { s: k, o: 1, offset: 0.3 }, { s: k, o: 0 }], { dur: 900, delay });
    return this._spawn(FX.heart(), x, y, [
      { s: 0.2 * k, o: 0 }, { s: 1.1 * k, dy: -3, o: 1, offset: 0.18 }, { s: k, dx: sx, dy: -9, o: 1, offset: 0.55 }, { s: 0.9 * k, dx: -sx * 0.5, dy: -17, o: 0 }
    ], { dur: 1300, delay });
  }
  _fxSparkle(x, y, k = 1, delay = 0) {
    return this._spawn(FX.sparkle(), x, y, [{ s: 0, r: 0, o: 0 }, { s: 1.2 * k, r: 45, o: 1, offset: 0.4 }, { s: 0, r: 100, o: 0 }], { dur: 700, delay });
  }
  _fxZ() {
    const t = this.A.top, big = this.rng() < 0.5;
    const x = t[0] + 7, y = t[1] + 10;
    this._spawn(FX.z(big ? 9 : 7), x, y, [
      { s: 0.5, o: 0, r: -8 }, { s: 0.8, dx: 2, dy: -4, o: 1, r: -4, offset: 0.25 }, { s: 1, dx: 6, dy: -11, o: 0.9, r: 4, offset: 0.7 }, { s: 1.1, dx: 9, dy: -16, o: 0, r: 8 }
    ], { dur: 2600, easing: 'linear' });
  }
  _fxCrumbs(pt, cols) {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const vx = this._rand(-7, 7), r = this._rand(1.1, 1.8), c = cols[i % cols.length];
      this._spawn(FX.dot(r.toFixed(2), c), pt[0] + this._rand(-2, 2), pt[1] + 1.5, [
        { o: 1, s: 1 }, { dx: vx * 0.4, dy: -2.2, o: 1, offset: 0.25 }, { dx: vx * 0.8, dy: 4, o: 1, offset: 0.6 }, { dx: vx, dy: 13, o: 0, s: 0.7 }
      ], { dur: 700 + this._rand(0, 200), easing: 'cubic-bezier(.3,0,.8,.6)', delay: i * 35 });
    }
  }
  _fxBurst(markupFn, x, y, n, spread = 7, dur = 700) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this._rand(-0.3, 0.3), d = spread * this._rand(0.7, 1.1);
      this._spawn(markupFn(), x, y, [{ s: 0.3, o: 0 }, { s: 1, o: 1, dx: Math.cos(a) * d * 0.4, dy: Math.sin(a) * d * 0.4, offset: 0.25 },
        { s: 0.6, o: 0, dx: Math.cos(a) * d, dy: Math.sin(a) * d + 3 }], { dur, delay: i * 20 });
    }
  }

  /* ---------- sommeil ---------- */
  _sleepNow() {
    this.sleeping = true;
    this.svg.classList.add('sleep');
    this._gaze(0, 0, 200);
    this.look = 0;
    this._applyPoses(900);
  }
  async _fallAsleep() {
    if (this.sleeping || this.destroyed) return;
    const tok = this._begin(0);
    if (!tok) return;
    if (!R()) { await this._actYawn(tok, true); if (!this._alive(tok)) return; }
    this._end(tok);
    this._sleepNow();
    this._loopZ();
    this._emit('sleep');
  }
  async _wakeUp(surprised) {
    if (!this.sleeping || this.destroyed) return true;
    this.sleeping = false;
    this.svg.classList.remove('sleep');
    this._applyPoses(480);
    unsched(this, 'zz');
    this.awakeUntil = nowMs() + 45000;
    this._emit('wake');
    const tok = this._begin(1);
    if (!tok) return true;
    if (surprised) {
      this.setExpression('surprised', 950);
      if (!R()) {
        this._g(this.P.all, 'translate', [[0, 0], [-1.2, -3.2], [0, 0]], 520, { easing: 'cubic-bezier(.3,1.3,.6,1)' });
        for (const e of this.P.ears) this._g(e, 'rotate', [0, -12, 0], 700);
      }
      if (!await this._wait(900, tok)) return false;
    } else if (!R()) {
      await this._actYawn(tok, false);
      if (!this._alive(tok)) return false;
    }
    this.setExpression('happy', 1700);
    if (!R()) this._pulse('hop', 600);
    const ok = await this._wait(700, tok);
    this._end(tok);
    return ok;
  }
  sleep(v) {
    if (this.destroyed || this.light) return;
    this.sleepMode = v === true ? true : v === false ? false : null;
    if (v === true && !this.sleeping) this._fallAsleep();
    else if (v === false && this.sleeping) this._wakeUp(false);
    else if (v === null || v === undefined) { this.awakeUntil = 0; this._clockCheck(); }
  }

  /* ---------- humeur ---------- */
  setMood(g = {}) {
    if (this.destroyed) return;
    const v = k => clamp(Number.isFinite(+g[k]) ? +g[k] : this.mood[k], 0, 100);
    this.mood = { faim: v('faim'), forme: v('forme'), joie: v('joie') };
    const avg = (this.mood.faim + this.mood.forme + this.mood.joie) / 3;
    this.moodState = avg < 40 ? 'low' : avg >= 80 ? 'happy' : 'ok';
    this.flags = { hungry: this.mood.faim < 35, tired: this.mood.forme < 35, lonely: this.mood.joie < 35 };
    if (!this.light) {
      const was = this.svg.classList.contains('sad');
      this.svg.classList.toggle('sad', this.moodState === 'low');
      if (was !== (this.moodState === 'low')) this._applyPoses(700);
    }
  }

  /* ---------- regard imposé ---------- */
  lookAt(x, y) {
    if (this.destroyed) return;
    if (x === null || x === undefined || !Number.isFinite(+x) || !Number.isFinite(+y)) { this.target = null; this._gaze(0, 0, 220); this._headPose(0, 500); return; }
    this.target = { x: +x, y: +y };
    if (!R()) this._gazeAt(+x, +y, 160);
  }

  /* ---------- accueil : il te voit arriver ---------- */
  async _greet() {
    if (!this.running || this.sleeping || this.sceneTok || R()) return;
    const tok = this._begin(0);
    if (!tok) return;
    this._gaze(-0.12, 0.08, 220);
    for (const e of this.P.ears) this._g(e, 'rotate', [0, -10, 4, 0], 700);
    if (this.moodState === 'low') {
      await this._actSigh(tok);
    } else {
      this.setExpression('happy', 1500);
      this._later(180, () => this._pulse('hop', 600), tok);
      await this._wait(1500, tok);
    }
    this._end(tok);
  }

  /* ---------- actions spontanées ---------- */
  async _doAct(name) {
    const tok = this._begin(0);
    if (!tok) return;
    this._emit('act', { name });
    const fn = this['_act' + name.charAt(0).toUpperCase() + name.slice(1)];
    try { if (typeof fn === 'function') await fn.call(this, tok); } catch (e) { try { console.error(e); } catch (_) {} }
    if (this._alive(tok)) { this._gaze(0, 0, 260); this._end(tok); }
  }
  async _actTilt(tok) {
    const up = this.rng() < 0.6, deg = up ? -this._rand(7, 11) : this._rand(6, 9);
    const hold = this._rand(1300, 2400), D = 450 + hold + 500, o = [0, 450 / D, (450 + hold) / D, 1];
    this._g(this.P.head, 'rotate', [0, deg, deg, 0], D, { offsets: o });
    this._g(this.P.earL, 'rotate', [0, -11, -11, 0], D, { offsets: o });
    this._g(this.P.earR, 'rotate', [0, 7, 7, 0], D, { offsets: o });
    this._gaze((this.rng() < 0.5 ? -1 : 1) * this._rand(0.4, 0.9), up ? -0.5 : 0.25, 170);
    return this._wait(D, tok);
  }
  async _actLookAround(tok) {
    this._g(this.P.head, 'rotate', [0, 3, 3, -4, -4, 0], 2500, { offsets: [0, 0.12, 0.4, 0.52, 0.85, 1] });
    this._gaze(-0.85, 0.05, 170);
    if (!await this._wait(950, tok)) return false;
    this._gaze(0.9, -0.15, 190);
    if (!await this._wait(1150, tok)) return false;
    this._gaze(-0.1, 0.05, 220);
    return this._wait(400, tok);
  }
  async _actHop(tok) {
    this.setExpression('happy', 1000);
    this._pulse('hop', 600);
    return this._wait(800, tok);
  }
  async _actWiggle(tok) {
    this.setExpression('happy', 1500);
    this._pulse('wiggle', 1450);
    return this._wait(1450, tok);
  }
  async _actSigh(tok) {
    const D = 2600, o = [0, 0.38, 0.72, 1];
    this._g(this.P.body, 'translate', [[0, 0], [0, -0.7], [0, 0.9], [0, 0]], D, { offsets: o });
    this._g(this.P.head, 'rotate', [0, -3, 5, 0], D, { offsets: o });
    for (const e of this.P.ears) this._g(e, 'rotate', [0, -4, 9, 0], D, { offsets: o });
    this._gaze(0.2, 0.55, 320);
    this._later(D * 0.68, () => {
      const m = this.A.mouth;
      this._spawn(FX.puff(1.6), m[0] + 2.5, m[1] + 1, [{ s: 0.4, o: 0 }, { s: 1, dx: 2, o: 0.9, offset: 0.3 }, { s: 1.5, dx: 5, dy: -2, o: 0 }], { dur: 900 });
    }, tok);
    return this._wait(D, tok);
  }
  async _actHungry(tok) {
    this.setExpression('hungry', 2800);
    this._gaze(0.5, 0.85, 240);
    this._g(this.P.head, 'rotate', [0, 7, 7, 0], 2800, { offsets: [0, 0.15, 0.85, 1] });
    this._g(this.P.body, 'translate', [[0, 0], [0.4, 0], [-0.4, 0], [0.3, 0], [0, 0]], 520, { delay: 900 });
    return this._wait(2800, tok);
  }
  async _actYawn(tok, big = this.species === 'lion') {
    const D = big ? 2200 : 1800;
    this.setExpression('sleepy', D - 150);
    this._g(this._mouth('sleepy'), 'scale', [1, [2.2, big ? 3.6 : 3.2], [2.4, big ? 4 : 3.6], 1], D - 250, { offsets: [0, 0.4, 0.75, 1], composite: 'replace' });
    this._g(this.P.head, 'rotate', [0, -12, -13, 2, 0], D, { offsets: [0, 0.3, 0.7, 0.85, 1] });
    for (const e of this.P.ears) this._g(e, 'rotate', [0, -14, -14, 0], D, { offsets: [0, 0.3, 0.75, 1] });
    this._g(this.P.body, 'scale', [1, [1, 1.035], [1, 1.035], 1], D, { offsets: [0, 0.35, 0.7, 1] });
    return this._wait(D, tok);
  }
  async _actProudPose(tok) {
    this.setExpression('proud', 2200);
    this._g(this.P.all, 'scale', [1, [1.02, 1.03], [1.02, 1.03], 1], 2200, { offsets: [0, 0.25, 0.75, 1] });
    const c = this.A.chest;
    this._later(350, () => this._fxSparkle(c[0] + 1, c[1] - 2, 0.9), tok);
    return this._wait(2200, tok);
  }
  /* poney, cheval, licorne */
  async _actSniff(tok) {
    const D = 2800, o = [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1];
    this._g(this.P.head, 'rotate', [0, 30, 26, 31, 26, 30, 0], D, { offsets: o });
    this._g(this.P.head, 'translate', [[0, 0], [1.5, 4.5], [1.5, 4], [1.5, 4.6], [1.5, 4], [1.5, 4.5], [0, 0]], D, { offsets: o });
    this._g(this.P.all, 'rotate', [0, 2.5, 2.5, 0], D, { offsets: [0, 0.2, 0.8, 1] });
    this._g(this.P.nose, 'scale', [1, 1, 1.3, 1, 1.3, 1, 1], D, { offsets: o });
    for (const e of this.P.ears) this._g(e, 'rotate', [0, 10, 10, 0], D, { offsets: [0, 0.2, 0.8, 1] });
    this._gaze(0.45, 0.9, 260);
    return this._wait(D, tok);
  }
  async _actPaw(tok) {
    const leg = this.P.legsF[this.P.legsF.length - 1];
    const D = 1900, o = [0, 0.14, 0.3, 0.46, 0.62, 0.78, 1];
    this._g(leg, 'rotate', [0, -30, -4, -32, -4, -28, 0], D, { offsets: o });
    this._g(leg, 'translate', [[0, 0], [0, -2.2], [0, 0], [0, -2.2], [0, 0], [0, -2], [0, 0]], D, { offsets: o });
    this._g(this.P.head, 'rotate', [0, 12, 12, 0], D + 300, { offsets: [0, 0.2, 0.8, 1] });
    this._gaze(0.5, 0.9, 240);
    const x = this.A.chest[0] + 3, y = this.A.ground - 1.5;
    for (const t of [0.3, 0.62, 0.95]) {
      this._later(D * t, () => {
        for (let i = 0; i < 3; i++) this._spawn(FX.dust(this._rand(1, 1.6).toFixed(2)), x + this._rand(-1, 3), y, [{ s: 0.4, o: 0 }, { s: 1, dx: this._rand(-3, 4), dy: -1.5, o: 0.9, offset: 0.3 }, { s: 1.4, dx: this._rand(-5, 6), dy: -3.5, o: 0 }], { dur: 600, delay: i * 40 });
      }, tok);
    }
    return this._wait(D + 300, tok);
  }
  async _actManeShake(tok) {
    const D = 900, o = [0, 0.15, 0.32, 0.5, 0.68, 0.84, 1];
    this.setExpression('delighted', D + 300);
    this._g(this.P.head, 'rotate', [0, -9, 8, -7, 5, -2, 0], D, { offsets: o });
    for (const m of this.P.mane) {
      this._g(m, 'rotate', [0, 7, -8, 6, -4, 2, 0], D, { offsets: o, delay: 70 });
      if (this.species === 'lion') this._g(m, 'scale', [1, 1.07, 0.97, 1.05, 1, 1.02, 1], D, { offsets: o, delay: 40 });
    }
    for (const e of this.P.ears) this._g(e, 'rotate', [0, 14, -12, 9, -5, 0, 0], D, { offsets: o, delay: 40 });
    if (this.species === 'unicorn') {
      const t = this.A.top;
      for (let i = 0; i < 3; i++) this._later(200 + i * 160, () => this._fxSparkle(t[0] - 8 - i * 3, t[1] + 6 + i * 4, 0.8), tok);
    }
    return this._wait(D + 300, tok);
  }
  async _actWhinny(tok) {
    const D = 1500, o = [0, 0.25, 0.7, 1];
    this.setExpression('happy', D);
    this._g(this.P.head, 'rotate', [0, -17, -15, 0], D, { offsets: o });
    this._g(this.P.all, 'rotate', [0, -3, -3, 0], D, { offsets: o });
    this._g(this.P.all, 'translate', [[0, 0], [0, -1.4], [0, -1.4], [0, 0]], D, { offsets: o });
    for (const e of this.P.ears) this._g(e, 'rotate', [0, -15, -15, 0], D, { offsets: o });
    this._g(this.P.tail, 'rotate', [0, 12, -6, 0], D);
    const m = this.A.mouth;
    const note = (c, dx) => this._spawn(FX.note(c), m[0] + 3 + dx, m[1] - 9, [{ s: 0.4, o: 0, r: -10 }, { s: 1, o: 1, dy: -4, r: 6, offset: 0.3 }, { s: 1, o: 0, dx: 4, dy: -13, r: -6 }], { dur: 1300 });
    this._later(D * 0.28, () => note('#c06aa8', 0), tok);
    this._later(D * 0.52, () => note('#6a8fd8', 4), tok);
    return this._wait(D, tok);
  }
  async _actHornSparkle(tok) {
    this.setExpression('proud', 1800);
    this._g(this.P.spark, 'scale', [1, 2.2, 1], 900);
    this._g(this.P.spark, 'rotate', [0, 90], 900);
    const t = this.A.top, tip = [t[0] + 4.6, t[1] - 15];
    [[0, 0, 0], [-3, 4, 160], [3, 7, 320], [-1.5, 10, 480]].forEach(([dx, dy, d]) => this._later(d, () => this._fxSparkle(tip[0] + dx, tip[1] + dy, this._rand(0.8, 1.2)), tok));
    return this._wait(1800, tok);
  }
  /* chat */
  async _actLick(tok) {
    const leg = this.P.legsF[this.P.legsF.length - 1];
    const D = 2700, o = [0, 0.18, 0.34, 0.5, 0.66, 0.82, 1];
    this._g(leg, 'rotate', [0, -112, -104, -112, -104, -110, 0], D, { offsets: o });
    this._g(leg, 'translate', [[0, 0], [0, -2], [0, -2], [0, -2], [0, -2], [0, -2], [0, 0]], D, { offsets: o });
    this._g(this.P.head, 'rotate', [0, 20, 14, 20, 14, 20, 0], D, { offsets: o });
    this._later(D * 0.16, () => this.setExpression('focused', D * 0.68), tok);
    this._gaze(0.3, 0.8, 220);
    return this._wait(D, tok);
  }
  async _actStretch(tok) {
    const D = 2800, o = [0, 0.25, 0.75, 1];
    for (const l of this.P.legsF) this._g(l, 'rotate', [0, -26, -26, 0], D, { offsets: o });
    this._g(this.P.all, 'rotate', [0, 5, 5, 0], D, { offsets: o });
    this._g(this.P.all, 'translate', [[0, 0], [0, 1.2], [0, 1.2], [0, 0]], D, { offsets: o });
    this._g(this.P.tail, 'rotate', [0, -16, -16, 0], D, { offsets: o });
    this._g(this.P.head, 'rotate', [0, -6, -6, 0], D, { offsets: o });
    this.setExpression('sleepy', D - 400);
    this._g(this._mouth('sleepy'), 'scale', [1, [1.5, 2.4], [1.5, 2.4], 1], D - 700, { offsets: [0, 0.35, 0.7, 1], composite: 'replace', delay: 350 });
    return this._wait(D, tok);
  }
  async _actButterfly(tok) {
    /* trajet du papillon autour de la tête (unités du viewBox) ; le chat le suit des yeux puis tente de l'attraper */
    const t = this.A.top, e = this.eyeC;
    const pts = [[-12, 6], [10, -2], [30, 4], [e[0] + 14, t[1] - 4], [e[0] + 6, t[1] - 12], [e[0] - 8, t[1] - 6], [e[0] + 2, t[1] + 2],
      [e[0] + 16, e[1] - 2], [e[0] + 10, t[1] - 8], [e[0] + 20, t[1] - 22], [112, -14]];
    const D = 4400, n = pts.length;
    const at = k => { const f = clamp(k, 0, 1) * (n - 1), i = Math.min(n - 2, Math.floor(f)), u = f - i; return [lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]; };
    const frames = pts.map(([x, y], i) => ({ dx: x, dy: y, s: 1.2, r: i % 2 ? -12 : 10, o: i === 0 || i === n - 1 ? 0 : 1 }));
    const bf = this._spawn(FX.butterfly(), 0, 0, frames, { dur: D, easing: 'ease-in-out' });
    const wing = bf && bf.querySelector('.cl-bf-w');
    if (wing) {
      wing.style.transformBox = 'fill-box'; wing.style.transformOrigin = '50% 50%';
      this._play(wing, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(.25)' }], { duration: 140, iterations: Math.ceil(D / 140), direction: 'alternate', easing: 'ease-in-out' }, true);
    }
    const t0 = nowMs();
    const track = () => {
      if (!this._alive(tok)) return;
      const k = (nowMs() - t0) / D;
      if (k >= 1) return;
      const [bx, by] = at(k);
      const dx = bx - e[0], dy = by - e[1], d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / 12);
      this._gaze((dx / d) * m, (dy / d) * m, 120);
      this._headPose(clamp((dy / d) * m * 8, -9, 6), 300);
      this._later(130, track, tok);
    };
    track();
    this.setExpression('happy', 1600);
    const paw = this.P.legsF[this.P.legsF.length - 1];
    this._later(D * 0.66, () => {
      this.setExpression('surprised', 500);
      this._g(paw, 'rotate', [0, -95, -60, 0], 520, { offsets: [0, 0.35, 0.6, 1] });
      this._g(this.P.all, 'translate', [[0, 0], [0, -2.5], [0, 0]], 520);
    }, tok);
    this._later(D * 0.66 + 520, () => this.setExpression('happy', 1200), tok);
    const ok = await this._wait(D, tok);
    this._headPose(0, 500);
    return ok;
  }
  /* capybara */
  async _actBliss(tok) {
    const D = 3200;
    this.setExpression('proud', D);
    this._g(this.P.head, 'rotate', [0, -5, -5, 0], D, { offsets: [0, 0.2, 0.8, 1] });
    this._g(this.P.body, 'scale', [1, [1.01, 1.03], 1, [1.01, 1.03], 1], D);
    const t = this.A.top;
    this._later(700, () => this._fxHeart(t[0] + 6, t[1] - 2, 0.7), tok);
    return this._wait(D, tok);
  }
  async _actMandarin(tok) {
    /* la mandarine est dessinée par le rig dans l'expression « content » (sans chapeau ni couronne) */
    const hasMandarin = !!this.svg.querySelector('.x-happy circle[fill="#ffa33a"]');
    if (!hasMandarin) return this._actBliss(tok);
    const D = 3600;
    this.setExpression('happy', D);
    this._g(this.P.head, 'rotate', [0, -4, 2, -3, 1, 0], D);
    const t = this.A.top;
    this._later(450, () => this._fxSparkle(t[0] + 2, t[1] - 6, 0.9), tok);
    this._later(1500, () => this._fxSparkle(t[0] + 6, t[1] - 3, 0.7), tok);
    return this._wait(D, tok);
  }
  /* dauphin */
  _splash(x, y) {
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + this._rand(-1.1, 1.1), v = this._rand(5, 9);
      this._spawn(FX.drop(), x + this._rand(-3, 3), y, [{ s: 0.5, o: 0 }, { s: 1, o: 1, dx: Math.cos(a) * v * 0.6, dy: Math.sin(a) * v * 0.6, offset: 0.3 },
        { s: 0.8, o: 0, dx: Math.cos(a) * v, dy: Math.sin(a) * v * 0.3 + 5 }], { dur: 650, delay: i * 25, easing: 'cubic-bezier(.2,.6,.5,1)' });
    }
  }
  async _actJump(tok) {
    const D = 1500, o = [0, 0.14, 0.38, 0.5, 0.62, 0.86, 1];
    this.setExpression('delighted', D);
    this._g(this.P.all, 'translate', [[0, 0], [0, 2], [2, -19], [4, -21], [6, -19], [0, 2], [0, 0]], D, { offsets: o });
    this._g(this.P.all, 'rotate', [0, 5, -18, 0, 16, 3, 0], D, { offsets: o });
    const g = this.A.ground;
    this._later(D * 0.13, () => this._splash(54, g - 6), tok);
    this._later(D * 0.85, () => this._splash(58, g - 6), tok);
    return this._wait(D, tok);
  }
  async _actBubbles(tok) {
    this.setExpression('happy', 2200);
    const t = this.A.top, bx = t[0] - 7.5, by = t[1] + 1.5;
    for (let i = 0; i < 5; i++) {
      const r = this._rand(1.3, 2.3), sw = this._rand(1.5, 3) * (i % 2 ? 1 : -1);
      this._later(i * 270, () => this._spawn(FX.bubble(r.toFixed(2)), bx + this._rand(-1, 1), by, [
        { s: 0.3, o: 0 }, { s: 1, o: 1, dx: sw, dy: -5, offset: 0.25 }, { s: 1, o: 1, dx: -sw, dy: -12, offset: 0.6 }, { s: 1.35, o: 0, dx: sw * 0.5, dy: -19 }
      ], { dur: 1700, easing: 'linear' }), tok);
    }
    this._g(this.P.all, 'translate', [[0, 0], [0, -1.2], [0, 0]], 900);
    return this._wait(2400, tok);
  }
  /* lion */
  async _actRoar(tok) {
    const o = [0, 0.3, 0.5, 0.8, 1];
    this.setExpression('sleepy', 1700);
    this._g(this._mouth('sleepy'), 'scale', [1, [1.6, 2.4], [2.2, 3.4], [2.2, 3.4], 1], 1700, { offsets: o, composite: 'replace' });
    this._g(this.P.head, 'rotate', [0, -13, -15, -15, 0], 1900, { offsets: o });
    for (const m of this.P.mane) this._g(m, 'scale', [1, 1.04, 1.1, 1.1, 1], 1900, { offsets: o });
    const m = this.A.mouth;
    this._later(850, () => this._spawn(FX.roar(), m[0] + 6, m[1] - 3, [{ s: 0.5, o: 0 }, { s: 1, o: 0.9, dx: 2, offset: 0.4 }, { s: 1.2, o: 0, dx: 5 }], { dur: 650 }), tok);
    this._later(1700, () => this.setExpression('happy', 700), tok);
    return this._wait(2400, tok);
  }
  /* dragon */
  async _actFlap(tok) {
    const D = 1200, o = [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.85, 1];
    for (const w of this.P.wings) this._g(w, 'rotate', [0, -26, 4, -26, 4, -24, 2, 0], D, { offsets: o });
    this._g(this.P.all, 'translate', [[0, 0], [0, -3], [0, -4.5], [0, -5], [0, -4.5], [0, -3.5], [0, -1], [0, 0]], D, { offsets: o });
    this._g(this.P.shadow, 'scale', [1, 0.9, 0.82, 0.8, 0.82, 0.86, 0.95, 1], D, { offsets: o });
    this.setExpression('happy', D + 200);
    return this._wait(D + 200, tok);
  }
  async _actSmoke(tok) {
    this.setExpression('surprised', 450);
    this._g(this.P.cheek, 'scale', [1, 1.35, 1.35, 1], 700, { offsets: [0, 0.4, 0.8, 1] });
    this._g(this.P.head, 'rotate', [0, -5, -7, 0], 2000, { offsets: [0, 0.2, 0.6, 1] });
    const m = this.A.mouth, nx = m[0] + 2.5, ny = m[1] - 4;
    this._later(500, () => {
      this.setExpression('happy', 1300);
      for (let i = 0; i < 3; i++) {
        this._spawn(FX.puff(this._rand(2, 2.8).toFixed(2)), nx, ny, [{ s: 0.3, o: 0 }, { s: 1, o: 0.95, dx: 2 + i, dy: -2 - i, offset: 0.25 },
          { s: 2.1, o: 0, dx: 7 + i * 2, dy: -11 - i * 2 }], { dur: 1500, delay: i * 160 });
      }
      this._spawn(FX.ember(), nx + 1, ny, [{ s: 1, o: 1 }, { s: 0.5, o: 0, dx: 4, dy: -6 }], { dur: 500 });
    }, tok);
    return this._wait(2000, tok);
  }
  /* sommeil : petits mouvements */
  async _actSleepTwitch(tok) {
    if (this.rng() < 0.6) this._g(this.rng() < 0.5 ? this.P.earL : this.P.earR, 'rotate', [0, -10, 4, 0], 420);
    else this._g(this.P.tail, 'rotate', [0, 7, 0], 900);
    return this._wait(900, tok);
  }
  async _actSleepSigh(tok) {
    this._g(this.P.body, 'translate', [[0, 0], [0, -0.8], [0, 0.6], [0, 0]], 3000, { offsets: [0, 0.4, 0.75, 1] });
    return this._wait(3000, tok);
  }

  /* ---------- réactions ---------- */
  async react(action, opts = {}) {
    if (this.destroyed) return false;
    const o = opts && typeof opts === 'object' ? opts : {};
    this.lastTouch = nowMs();
    if (action === 'wake') return this._wakeUp(true);
    if (this.light && action !== 'tap') {                       /* avatar léger : seulement une expression */
      const ex = { hug: 'delighted', eat: 'happy', celebrate: 'delighted', proud: 'proud', surprise: 'surprised', yawn: 'sleepy' }[action];
      if (ex) this.setExpression(ex, 1400);
      return !!ex;
    }
    if (this.sleeping && action !== 'yawn') {
      /* endormi : l'enfant le réveille d'abord (surpris, puis content) */
      await this._wakeUp(true);
      if (this.destroyed) return false;
      if (action === 'tap') return true;
    } else if (this.sleeping) return false;
    switch (action) {
      case 'tap': return this._rxTap(o);
      case 'hug': return this._rxHug(o);
      case 'eat': return this._rxEat(o);
      case 'brush': return this._rxBrush(o);
      case 'walk': return this._rxWalk(o);
      case 'celebrate': return this._rxCelebrate(o);
      case 'proud': return this._rxProud(o);
      case 'surprise': return this._rxSurprise(o);
      case 'yawn': return this._rxYawn(o);
      case 'appear': return this._rxAppear(o);
      default: return false;
    }
  }
  async _rxTap(o) {
    const t = nowMs();
    this.combo = t - this.lastTap < 1600 ? this.combo + 1 : 1;
    this.lastTap = t;
    const big = this.combo >= 3;
    if (Number.isFinite(+o.x) && Number.isFinite(+o.y) && !R()) { this._gazeAt(+o.x, +o.y, 140); this.ptrUntil = t + 1200; }
    if (R()) { this.setExpression(big ? 'delighted' : 'happy', 1300); return true; }
    const tok = this._begin(1);
    if (!tok) {                                                 /* pendant un soin : un petit signe d'oreille suffit */
      for (const e of this.P.ears) this._g(e, 'rotate', [0, 10, 0], 450, { scene: false });
      return false;
    }
    this.setExpression(big ? 'delighted' : 'happy', big ? 1500 : 1200);
    this._pulse(big ? 'wiggle' : 'hop', big ? 1450 : 600);
    for (const e of this.P.ears) this._g(e, 'rotate', [0, 10, 0], 500);
    if (this.light || o.fx) { const tp = this.A.top; this._fxHeart(tp[0] + 2, tp[1] - 4, 0.9); }
    const ok = await this._wait(big ? 1400 : 750, tok);
    this._end(tok);
    return ok;
  }
  async _rxHug() {
    const tp = this.A.top;
    if (R()) { this.setExpression('delighted', 2000); this._fxHeart(tp[0] + 2, tp[1] - 4, 1); return true; }
    const tok = this._begin(2);
    if (!tok) return false;
    const D = 2600, o = [0, 0.15, 0.5, 0.8, 1];
    this._gaze(-0.1, 0.1, 200);
    this.setExpression('delighted', D);
    this._g(this.P.all, 'scale', [1, [1.05, 0.95], [1.03, 0.97], [1.05, 0.95], 1], D, { offsets: o });
    this._g(this.P.head, 'rotate', [0, 9, 6, 9, 0], D, { offsets: o });
    this._g(this.P.cheek, 'scale', [1, 1.4, 1.4, 1], D, { offsets: [0, 0.15, 0.85, 1] });
    this._g(this.P.tail, 'rotate', [0, 14, -8, 14, -8, 0], D);
    for (const e of this.P.ears) this._g(e, 'rotate', [0, -14, -14, 0], D, { offsets: [0, 0.15, 0.85, 1] });
    for (let i = 0; i < 5; i++) this._later(i * 380, () => this._fxHeart(tp[0] + this._rand(-9, 7), tp[1] - this._rand(0, 4), this._rand(0.75, 1.1)), tok);
    const ok = await this._wait(D, tok);
    this._end(tok);
    return ok;
  }
  async _rxEat(o) {
    const flight = clamp(+o.flightMs || 0, 0, 2500);
    const cols = CRUMBS[o.food] || CRUMBS[String(o.food || '') + '\uFE0F'] || CRUMBS[String(o.food || '').replace(/\uFE0F/g, '')] || DEFAULT_CRUMBS;
    if (R()) {
      this.setExpression('happy', flight + 1500);
      this._later(flight + 1500, () => this.setExpression('delighted', 900));
      return this._wait(flight + 2400);
    }
    const tok = this._begin(2);
    if (!tok) return false;
    if (o.from && Number.isFinite(+o.from.x)) this._gazeAt(+o.from.x, +o.from.y, 160);
    if (flight > 300) {
      this.setExpression('surprised', flight - 200);
      for (const e of this.P.ears) this._g(e, 'rotate', [0, 10, 10, 0], flight + 300, { offsets: [0, 0.3, 0.8, 1] });
      this._later(flight * 0.45, () => this._gaze(0.35, 0.3, 260), tok);
      if (!await this._wait(flight - 220, tok)) return false;
    }
    this.setExpression('happy', 2200);                         /* bouche ouverte : il l'attrape */
    this._g(this.P.head, 'rotate', [0, -6, 3, 0], 520);
    if (!await this._wait(240, tok)) return false;
    this._headPose(0, 300);
    this._gaze(0.1, 0.25, 220);
    this._addClass('eat');                                     /* mâche (rig : tête, bouche, joues) */
    for (let i = 0; i < 3; i++) this._later(160 + i * 520, () => this._fxCrumbs(this.A.mouth, cols), tok);
    if (!await this._wait(1700, tok)) return false;
    this._delClass('eat');
    this.setExpression('delighted', 1100);
    this._pulse('hop', 600);
    const tp = this.A.top;
    this._fxHeart(tp[0] + 3, tp[1] - 3, 0.9);
    const ok = await this._wait(1100, tok);
    this._end(tok);
    return ok;
  }
  async _rxBrush() {
    if (R()) { this.setExpression('proud', 2000); return this._wait(2000); }
    const tok = this._begin(2);
    if (!tok) return false;
    const D = 2400;
    this.setExpression('proud', D);                            /* yeux fermés de plaisir */
    this._g(this.P.all, 'rotate', [0, -2, -2, 0], D, { offsets: [0, 0.2, 0.8, 1] });
    this._g(this.P.tail, 'rotate', [0, 12, -6, 12, -6, 12, 0], D);
    const b = this.A.back, x0 = b[0], y0 = b[1] - 1.6;
    const strokes = [[-9, 0], [9, -1], [-9, 0], [9, -1], [-8, 0], [8, -1]];
    const fr = [{ dx: -2, dy: -8, s: 0.6, o: 0 }, { dx: -9, dy: 0, s: 1, o: 1, offset: 0.1 }];
    strokes.forEach(([dx, dy], i) => fr.push({ dx, dy, r: i % 2 ? 6 : -4, s: 1, o: 1, offset: 0.1 + ((i + 1) / strokes.length) * 0.78 }));
    fr.push({ dx: 10, dy: -9, s: 0.7, o: 0 });
    this._spawn(FX.brush(), x0, y0, fr, { dur: D, easing: 'ease-in-out' });
    for (let i = 0; i < 6; i++) this._later(300 + i * 320, () => this._fxSparkle(x0 + this._rand(-9, 9), y0 - this._rand(1, 6), this._rand(0.6, 1)), tok);
    if (!await this._wait(D, tok)) return false;
    this.setExpression('delighted', 1000);
    this._pulse('wiggle', 1400);
    for (let i = 0; i < 4; i++) this._fxSparkle(x0 + this._rand(-12, 12), y0 - this._rand(0, 8), this._rand(0.7, 1.1), i * 80);
    const ok = await this._wait(1100, tok);
    this._end(tok);
    return ok;
  }
  async _rxWalk(o) {
    const ms = clamp(+o.ms || 4000, 600, 12000);
    if (R()) { this.setExpression('happy', ms); return this._wait(ms); }
    const tok = this._begin(2);
    if (!tok) return false;
    this._addClass('walk');
    this.setExpression('happy', ms);
    this._gaze(0.75, 0.05, 220);
    if (!await this._wait(ms, tok)) return false;
    this._delClass('walk');
    this._gaze(-0.1, 0.05, 260);
    this._pulse('hop', 600);
    this.setExpression('delighted', 1000);
    const ok = await this._wait(900, tok);
    this._end(tok);
    return ok;
  }
  async _rxCelebrate() {
    if (R()) { this.setExpression('delighted', 2000); return this._wait(2000); }
    const tok = this._begin(2);
    if (!tok) return false;
    this._addClass('dance');
    this.setExpression('delighted', 2400);
    const c = this.eyeC;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      this._later(100 + i * 160, () => this._fxSparkle(c[0] - 12 + Math.cos(a) * 26, c[1] + 16 + Math.sin(a) * 22, this._rand(0.8, 1.3)), tok);
    }
    if (!await this._wait(1550, tok)) return false;
    this._delClass('dance');
    this._pulse('joy', 1000);
    const ok = await this._wait(1000, tok);
    this._end(tok);
    return ok;
  }
  async _rxProud(o) {
    this.setExpression('proud', 2000);
    if (R()) return this._wait(2000);
    const tok = this._begin(1);
    if (!tok) return false;
    this._g(this.P.all, 'scale', [1, [1.03, 1.04], [1.03, 1.04], 1], 1700, { offsets: [0, 0.25, 0.75, 1] });
    const acc = o.acc ? this.svg.querySelector('.c-acc.acc-' + String(o.acc).replace(/[^\w-]/g, '')) : null;
    if (acc) {
      try {
        const r = this.svg.getBoundingClientRect(), b = acc.getBoundingClientRect();
        if (r.width && b.width) {
          const ux = ((b.left + b.width / 2 - r.left) / r.width) * 100, uy = ((b.top + b.height / 2 - r.top) / r.height) * 84;
          const hw = (b.width / r.width) * 50, hh = (b.height / r.height) * 42;
          for (let i = 0; i < 4; i++) this._fxSparkle(ux + this._rand(-hw, hw), uy + this._rand(-hh, hh), this._rand(0.8, 1.2), 150 + i * 170);
          motionSparkle(acc, { count: 8 });
        }
      } catch (_) {}
    }
    const ok = await this._wait(2000, tok);
    this._end(tok);
    return ok;
  }
  async _rxSurprise() {
    this.setExpression('surprised', 1000);
    if (R()) return this._wait(1000);
    const tok = this._begin(1);
    if (!tok) return false;
    this._gaze(0, 0, 120);
    this._g(this.P.all, 'translate', [[0, 0], [-1.5, -3], [0, 0]], 520, { easing: 'cubic-bezier(.3,1.3,.6,1)' });
    for (const e of this.P.ears) this._g(e, 'rotate', [0, -12, 0], 640);
    const ok = await this._wait(1000, tok);
    this._end(tok);
    return ok;
  }
  async _rxYawn() {
    if (R()) { this.setExpression('sleepy', 1600); return this._wait(1600); }
    const tok = this._begin(1);
    if (!tok) return false;
    const ok = await this._actYawn(tok);
    this._end(tok);
    return ok;
  }
  async _rxAppear() {
    this.setExpression('delighted', 1300);
    if (R()) return this._wait(1300);
    const tok = this._begin(2);
    if (!tok) return false;
    this._later(260, () => this._pulse('hop', 600), tok);
    const c = this.eyeC;
    for (let i = 0; i < 5; i++) this._later(i * 90, () => this._fxSparkle(c[0] - 10 + this._rand(-26, 26), c[1] + this._rand(-10, 30), this._rand(0.8, 1.3)), tok);
    const ok = await this._wait(1300, tok);
    this._end(tok);
    return ok;
  }

  /* ---------- gestes reconnus sur la zone de toucher : toucher / appui long (câlin) ---------- */
  _bindHit() {
    const el = this.hitEl;
    if (!el || typeof el.addEventListener !== 'function') return;
    this.press = null;
    const cancel = () => { this.press = null; unsched(this, 'press'); };
    this.h = {
      down: e => {
        if (this.destroyed || (e.button !== undefined && e.button > 0)) return;
        this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: nowMs(), hug: false };
        if (!this.light) sched(this, 480, () => this._longPress(), 'press');
      },
      move: e => {
        const p = this.press;
        if (p && e.pointerId === p.id && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 14) cancel();
      },
      up: e => {
        const p = this.press;
        cancel();
        if (!p || p.hug || e.pointerId !== p.id || nowMs() - p.t > 700) return;
        this._emit('tap', { x: e.clientX, y: e.clientY });
        this.react('tap', { x: e.clientX, y: e.clientY });
      },
      cancel,
      ctx: e => { if (this.press || nowMs() - this.lastTouch < 1500) { try { e.preventDefault(); } catch (_) {} } }
    };
    el.addEventListener('pointerdown', this.h.down);
    el.addEventListener('pointermove', this.h.move, { passive: true });
    el.addEventListener('pointerup', this.h.up);
    el.addEventListener('pointercancel', this.h.cancel);
    if (!this.light) el.addEventListener('contextmenu', this.h.ctx);
  }
  _longPress() {
    const p = this.press;
    if (!p || this.destroyed) return;
    p.hug = true;
    this._emit('hug', { x: p.x, y: p.y });
    this.react('hug', { x: p.x, y: p.y });
  }
  _unbindHit() {
    const el = this.hitEl, h = this.h;
    if (!el || !h) return;
    try {
      el.removeEventListener('pointerdown', h.down);
      el.removeEventListener('pointermove', h.move, { passive: true });
      el.removeEventListener('pointerup', h.up);
      el.removeEventListener('pointercancel', h.cancel);
      el.removeEventListener('contextmenu', h.ctx);
    } catch (_) {}
    this.h = null;
  }

  get state() {
    return { sleeping: this.sleeping, busy: !!this.sceneTok, mood: this.moodState, expr: this.svg.getAttribute('data-expr'),
      running: this.running, species: this.species, stage: this.stage, light: this.light, sleepMode: this.sleepMode };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.running = false;
    unsched(this);
    for (const w of [...this.waiters]) { try { w(false); } catch (_) {} }
    this.waiters.clear();
    for (const st of Object.values(this.poses)) { if (st.anim) { try { st.anim.cancel(); } catch (_) {} } }
    for (const a of [...this.anims]) { try { a.cancel(); } catch (_) {} }
    this.anims.clear(); this.sceneAnims.clear();
    this._unbindHit();
    try { if (this.fx) this.fx.remove(); } catch (_) {}
    this.fx = null;
    for (const p of this.P.pupils) { try { p.style.removeProperty('transform'); p.style.removeProperty('transition'); } catch (_) {} }
    for (let i = this.saved.length - 1; i >= 0; i--) {
      const [el, prop, val, prio] = this.saved[i];
      try { if (val) el.style.setProperty(prop, val, prio); else el.style.removeProperty(prop); } catch (_) {}
    }
    this.saved = [];
    try {
      this.svg.setAttribute('class', this.origClass);
      this.svg.setAttribute('data-expr', this.origExpr);
    } catch (_) {}
    envRemove(this);
  }
}

/* ===== v2.5 — EAU : action « souffle » de la baleine (SPECIES_ACTS.whale) — bloc à part, ajouté à la classe =====
   Elle prend son souffle (yeux fermés, elle se gonfle un peu), puis souffle : le jet d'eau du rig jaillit plus haut
   (classe spout sur la racine, css/ui/mount.css) et des gouttes retombent en gerbe autour de l'évent ; elle est ravie.
   L'évent n'est pas une ancre du rig : il est déduit du sommet de la tête (ancre top), à l'échelle du stade. */
Object.assign(Life.prototype, {
  async _actSpout(tok) {
    const t = this.A.top, e = this.A.eyes || ANCHORS0.eyes;
    const k = e.length > 1 ? Math.max(0.6, Math.min(1.3, (e[e.length - 1][0] - e[0][0]) / 10.2)) : 1;
    const hole = [t[0] - 12.6 * k, t[1] - 1.3 * k], jet = [hole[0], hole[1] - 18 * k];
    this.setExpression('proud', 650);
    this._g(this.P.all, 'scale', [1, [1.025, 1.04], [1.025, 1.04], 1], 900, { offsets: [0, 0.55, 0.7, 1] });
    if (!await this._wait(600, tok)) return false;
    this.setExpression('delighted', 1900);
    this._pulse('spout', 2400);
    this._g(this.P.all, 'translate', [[0, 0], [0, -1.6], [0, 0]], 700);
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1, dx = side * this._rand(5, 12) * k;
      this._later(150 + i * 110, () => this._spawn(FX.drop(), jet[0] + this._rand(-1, 1), jet[1], [
        { s: 0.5, o: 0 }, { s: 1, o: 1, dx: dx * 0.45, dy: -3 * k, offset: 0.3 }, { s: 0.85, o: 0, dx, dy: 16 * k }
      ], { dur: 900, easing: 'cubic-bezier(.2,.6,.5,1)' }), tok);
    }
    return this._wait(2200, tok);
  }
});

/* ================= API ================= */
/* donne vie à un compagnon (svg.c-rig) ; un contrôleur déjà présent sur ce SVG est remplacé */
export function bringToLife(svgEl, opts = {}) {
  if (!svgEl || typeof svgEl.querySelector !== 'function' || !G.document) return null;
  const prev = BY_SVG.get(svgEl);
  if (prev) prev.destroy();
  const life = new Life(svgEl, opts && typeof opts === 'object' ? opts : {});
  const api = {
    setExpression: (n, ms) => life.setExpression(n, ms),
    react: (a, o) => life.react(a, o),
    lookAt: (x, y) => life.lookAt(x, y),
    setMood: m => life.setMood(m),
    sleep: v => life.sleep(v),
    pause: () => life.pause(),
    resume: () => life.resume(),
    destroy: () => life.destroy(),
    get state() { return life.state; },
    get svg() { return life.svg; },
    get destroyed() { return life.destroyed; },
    /* bancs d'essai : jouer tout de suite une action spontanée (SPECIES_ACTS, GENERIC_ACTS, SLEEP_ACTS) */
    _act: name => life._doAct(String(name || ''))
  };
  life.api = api;
  return api;
}
/* vie LÉGÈRE pour un avatar (bilan de manche, bienvenue, profils, en-tête…) : regard + clignements + joie au
   toucher ; el = conteneur du SVG ou le SVG lui-même ; se nettoie tout seul quand l'avatar quitte la page */
export function liven(el, opts = {}) {
  try {
    if (!el || !G.document) return null;
    const svg = el.matches && el.matches('svg.c-rig') ? el : (el.querySelector ? el.querySelector('svg.c-rig') : null);
    if (!svg) return null;
    const prev = BY_SVG.get(svg);
    if (prev && prev.api) return prev.api;
    return bringToLife(svg, Object.assign({ light: true, interactive: true, greet: false, hitEl: svg.parentElement }, opts));
  } catch (_) { return null; }
}
