/* ============ MOTION DESIGN (CDC v2 §11, contrat §8.2) ============
   Web Animations API + un <canvas> de particules ; aucune dépendance.
   Importable dans Node : aucun accès au DOM au chargement (tout est résolu à l'appel).
   Mouvement réduit = préférence système OU réglage « animations douces » (setMode('soft')) :
   fondus courts uniquement — aucun déplacement, aucune particule, flyTo = fondu de la cible.
   Retours : pop, squash, shake, enter → objet Animation (ou null) ;
   flyTo, burst, sparkle, confetti, countUp, morphPolygon, viewTransition → Promise.
   Les Promise se résolvent toujours (jamais de rejet, sauf viewTransition si fn échoue),
   avec un filet de sécurité si l'onglet passe en arrière-plan (rAF suspendu).
   Les transformations utilisent les propriétés individuelles scale/translate quand elles existent :
   elles se composent avec le transform CSS de l'élément (toast centré, etc.) au lieu de l'écraser.
   Thème visuel : setTheme({ confetti }) règle les emojis par défaut de confetti() ; les couleurs des
   particules (burst, sparkle) sont relues dans les jetons CSS du thème courant. */

import { fmtNum } from './util.js';

export const EASE = Object.freeze({
  out: 'cubic-bezier(.22,1,.36,1)',      /* entrées */
  pop: 'cubic-bezier(.34,1.56,.64,1)',   /* rebond (léger dépassement) */
  inOut: 'cubic-bezier(.65,0,.35,1)',
  in: 'cubic-bezier(.55,0,1,.45)'
});
export const DUR = Object.freeze({ fast: 150, med: 300, slow: 600 });

const G = globalThis;
const doc = () => G.document || null;
const nowMs = () => (G.performance && typeof G.performance.now === 'function' ? G.performance.now() : Date.now());
const rnd = (a, b) => a + Math.random() * (b - a);
const isEl = v => !!(v && typeof v.getBoundingClientRect === 'function');

/* ---------- mode ---------- */
let mode = 'full';
let mql;
/* 'full' | 'soft' (réglage parent « animations douces ») ; pose html.motion-soft pour les CSS */
export function setMode(m) {
  mode = m === 'soft' ? 'soft' : 'full';
  try { const d = doc(); if (d) d.documentElement.classList.toggle('motion-soft', mode === 'soft'); } catch (_) {}
  return mode;
}
export function getMode() { return mode; }
/* vrai si seuls les fondus sont permis (préférence système ou mode doux) */
export function reduced() {
  if (mode === 'soft') return true;
  try {
    if (mql === undefined) mql = typeof G.matchMedia === 'function' ? G.matchMedia('(prefers-reduced-motion: reduce)') : null;
    return !!(mql && mql.matches);
  } catch (_) { return false; }
}

/* ---------- outils ---------- */
/* courbe de Bézier cubique (identique à CSS) → fonction de progression, pour les animations rAF */
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = t => ((ax * t + bx) * t + cx) * t;
  const sy = t => ((ay * t + by) * t + cy) * t;
  const dx = t => (3 * ax * t + 2 * bx) * t + cx;
  const solve = x => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-5) return t;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 40 && hi - lo > 1e-6; i++) { if (sx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return t;
  };
  return x => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)));
}
const EASE_FN = {};
function easeFn(css) {
  if (typeof css === 'function') return css;
  if (EASE_FN[css]) return EASE_FN[css];
  const m = /cubic-bezier\(([^)]+)\)/.exec(String(css));
  const p = m ? m[1].split(',').map(Number) : null;
  return (EASE_FN[css] = p && p.length === 4 && p.every(isFinite) ? bezier(...p) : t => t);
}

/* propriétés individuelles de transformation (Chrome 104+, Safari 14.1+, Firefox 72+) */
let indiv;
function hasIndiv() {
  if (indiv === undefined) {
    try { indiv = !!(G.CSS && G.CSS.supports('scale', '1') && G.CSS.supports('translate', '1px 1px')); } catch (_) { indiv = false; }
  }
  return indiv;
}
const S = (x, y = x) => (hasIndiv() ? { scale: x === y ? String(x) : x + ' ' + y } : { transform: 'scale(' + x + ',' + y + ')' });
const T = (x, y = 0) => (hasIndiv() ? { translate: x + 'px ' + y + 'px' } : { transform: 'translate(' + x + 'px,' + y + 'px)' });

/* enfants SVG (groupes du compagnon…) : boîte de référence = la forme elle-même (leçon v11.2) */
function svgExtras(el, origin) {
  const o = {};
  const svgChild = G.SVGElement && el instanceof G.SVGElement && !(G.SVGSVGElement && el instanceof G.SVGSVGElement);
  if (svgChild) { o.transformBox = 'fill-box'; o.transformOrigin = origin || '50% 50%'; }
  else if (origin) o.transformOrigin = origin;
  return o;
}
const withX = (frames, x) => (Object.keys(x).length ? frames.map(f => ({ ...f, ...x })) : frames);

/* une seule animation d'un même genre par élément : la nouvelle remplace l'ancienne */
const RUNNING = new WeakMap();
function run(el, kind, frames, opts) {
  try {
    if (!el || typeof el.animate !== 'function') return null;
    let slot = RUNNING.get(el);
    if (!slot) RUNNING.set(el, (slot = {}));
    if (slot[kind]) { try { slot[kind].cancel(); } catch (_) {} }
    const a = el.animate(frames, opts);
    slot[kind] = a;
    const clear = () => { if (slot[kind] === a) slot[kind] = null; };
    a.addEventListener('finish', clear);
    a.addEventListener('cancel', clear);
    return a;
  } catch (_) { return null; }
}

/* fondu court (variante « mouvement réduit » de toutes les animations) */
function fadePulse(el, kind, { delay = 0, low = 0.5 } = {}) {
  let o = 1;
  try {
    const prev = RUNNING.get(el);
    if (prev && prev[kind]) prev[kind].cancel();      /* lire l'opacité au repos, pas en plein fondu */
    o = parseFloat(G.getComputedStyle(el).opacity);
    if (!isFinite(o)) o = 1;
  } catch (_) {}
  return run(el, kind, [{ opacity: o * low }, { opacity: o }], { duration: DUR.fast, delay, easing: 'ease-out' });
}

/* centre d'un élément (ou d'un point { x, y }) en coordonnées de la fenêtre */
function pointOf(v) {
  if (!v) return null;
  if (isEl(v)) {
    const r = v.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  const x = +v.x, y = +v.y;
  return isFinite(x) && isFinite(y) ? { x, y } : null;
}

/* délai ajouté par stagger() aux animations lancées pendant son appel */
let stagDelay = 0;

/* ---------- animations d'élément ---------- */
/* petit « pop » : grossit vite puis revient avec un léger rebond */
export function pop(el, { scale = 1.15, dur = 380, delay = 0 } = {}) {
  delay += stagDelay;
  if (reduced()) return fadePulse(el, 'pop', { delay, low: 0.6 });
  return run(el, 'pop', withX([
    { ...S(1), easing: EASE.out },
    { ...S(scale), offset: 0.32, easing: EASE.pop },
    { ...S(1) }
  ], svgExtras(el)), { duration: dur, delay });
}

/* écrasement / étirement (atterrissage, appui) ; pivot en bas */
export function squash(el, { amount = 1, dur = 460, delay = 0 } = {}) {
  delay += stagDelay;
  if (reduced()) return fadePulse(el, 'squash', { delay, low: 0.6 });
  const a = Math.max(0, Math.min(2, +amount || 1));
  const k = v => +(1 + (v - 1) * a).toFixed(3);
  return run(el, 'squash', withX([
    { ...S(1, 1), easing: 'ease-out' },
    { ...S(k(1.16), k(0.84)), offset: 0.18, easing: 'ease-in-out' },
    { ...S(k(0.9), k(1.12)), offset: 0.42, easing: 'ease-in-out' },
    { ...S(k(1.05), k(0.96)), offset: 0.66, easing: 'ease-in-out' },
    { ...S(k(0.98), k(1.02)), offset: 0.84, easing: 'ease-out' },
    { ...S(1, 1) }
  ], svgExtras(el, '50% 100%')), { duration: dur, delay });
}

/* secousse douce horizontale (6 px par défaut) — un mouvement, jamais une couleur */
export function shake(el, { dist = 6, dur = 400, delay = 0 } = {}) {
  delay += stagDelay;
  if (reduced()) return fadePulse(el, 'shake', { delay, low: 0.55 });
  const d = +dist || 6;
  return run(el, 'shake', [
    { ...T(0) }, { ...T(-d), offset: 0.14 }, { ...T(d * 0.85), offset: 0.32 }, { ...T(-d * 0.6), offset: 0.5 },
    { ...T(d * 0.35), offset: 0.68 }, { ...T(-d * 0.15), offset: 0.85 }, { ...T(0) }
  ].map(f => ({ ...f, easing: 'ease-in-out' })), { duration: dur, delay });
}

/* entrée : from = 'bottom' | 'top' | 'left' | 'right' | 'scale' | 'fade' ; invisible pendant le délai */
export function enter(el, { from = 'bottom', delay = 0, dur, dist = 18 } = {}) {
  delay += stagDelay;
  if (reduced() || from === 'fade') {
    return run(el, 'enter', [{ opacity: 0 }, { opacity: 1 }],
      { duration: reduced() ? DUR.fast : dur || DUR.med, delay, fill: 'backwards', easing: 'ease-out' });
  }
  if (from === 'scale') {
    return run(el, 'enter', withX([{ opacity: 0, ...S(0.82) }, { opacity: 1, ...S(1) }], svgExtras(el)),
      { duration: dur || 380, delay, fill: 'backwards', easing: EASE.pop });
  }
  const v = { bottom: [0, dist], top: [0, -dist], left: [-dist * 1.4, 0], right: [dist * 1.4, 0] }[from] || [0, dist];
  return run(el, 'enter', [{ opacity: 0, ...T(v[0], v[1]) }, { opacity: 1, ...T(0, 0) }],
    { duration: dur || 420, delay, fill: 'backwards', easing: EASE.out });
}

/* cascade : appelle fn(el, i, délai) pour chaque élément ; les animations de ce module lancées
   pendant l'appel reçoivent automatiquement le délai i × step (sans scintillement initial).
   stagger(cartes, el => enter(el)) ; stagger(btns, (b, i, d) => …) → tableau des retours de fn */
export function stagger(els, fn, step = 60) {
  const list = els ? Array.from(els) : [];
  return list.map((el, i) => {
    const prev = stagDelay;
    stagDelay = prev + i * step;
    try { return fn(el, i, stagDelay); } catch (e) { console.error(e); return null; } finally { stagDelay = prev; }
  });
}

/* ---------- vol en arc (🍎 vers le porte-monnaie) ----------
   Trajectoire = Bézier quadratique (une parabole) échantillonnée en images clés ; point de contrôle
   au-dessus du trajet. from / to = Element ou { x, y } (coordonnées de la fenêtre).
   options : emoji, count, dur, size (px), gap (ms entre deux envols), arc (courbure),
             onArrive(i) à chaque arrivée (son, compteur), popTarget (pop de la cible à l'arrivée). */
export function flyTo(from, to, { emoji = '🍎', count = 1, dur = 700, size = 30, gap = 90, arc = 0.35, onArrive, popTarget = true } = {}) {
  return new Promise(resolve => {
    const n = Math.max(1, Math.min(30, Math.floor(+count) || 1));
    const target = isEl(to) ? to : null;
    let arrived = 0, settled = false;
    const settle = () => { if (!settled) { settled = true; resolve(); } };
    const arrive = i => {
      arrived++;
      try { if (typeof onArrive === 'function') onArrive(i); } catch (e) { console.error(e); }
      if (target && popTarget) pop(target, { scale: 1.2, dur: 320 });
      if (arrived >= n) settle();
    };
    try {
      const d = doc();
      const a = pointOf(from), b = pointOf(to);
      if (!d || !d.body || !a || !b || reduced()) {
        /* mouvement réduit (ou points introuvables) : fondu de la cible, arrivées immédiates */
        if (target) fadePulse(target, 'pop', { low: 0.35 });
        for (let i = 0; i < n; i++) { arrived++; try { if (typeof onArrive === 'function') onArrive(i); } catch (e) { console.error(e); } }
        setTimeout(settle, DUR.fast);
        return;
      }
      const W = G.innerWidth || 390, H = G.innerHeight || 844;
      const px = Math.max(12, +size || 30);
      for (let i = 0; i < n; i++) {
        const node = d.createElement('div');
        node.className = 'mo-fly';
        node.setAttribute('aria-hidden', 'true');
        if (typeof emoji === 'string') node.textContent = emoji;
        else if (emoji && typeof emoji.cloneNode === 'function') node.appendChild(emoji.cloneNode(true));
        Object.assign(node.style, {
          position: 'fixed', left: '0px', top: '0px', width: px + 'px', height: px + 'px',
          marginLeft: -px / 2 + 'px', marginTop: -px / 2 + 'px', display: 'grid', placeItems: 'center',
          fontSize: Math.round(px * 0.86) + 'px', lineHeight: '1', pointerEvents: 'none', zIndex: '95',
          willChange: 'transform, opacity', opacity: '0'
        });
        d.body.appendChild(node);
        const p0 = n > 1 ? { x: a.x + rnd(-12, 12), y: a.y + rnd(-10, 10) } : a;
        const c = control(p0, b, arc * (n > 1 ? rnd(0.75, 1.3) : 1), i % 2 ? -1 : 1, W, H);
        const turn = (i % 2 ? -1 : 1) * 12;
        const frames = [];
        const N = 24;
        for (let k = 0; k <= N; k++) {
          const t = k / N, u = 1 - t;
          const x = u * u * p0.x + 2 * u * t * c.x + t * t * b.x;
          const y = u * u * p0.y + 2 * u * t * c.y + t * t * b.y;
          /* jaillit (0,5 → 1,2), plane, puis rapetisse en entrant dans la cible */
          const s = t < 0.18 ? 0.5 + (t / 0.18) * 0.7 : t < 0.7 ? 1.2 - ((t - 0.18) / 0.52) * 0.2 : 1 - ((t - 0.7) / 0.3) * 0.45;
          const o = t < 0.08 ? t / 0.08 : t > 0.92 ? Math.max(0, (1 - t) / 0.08) : 1;
          frames.push({
            transform: 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' + (Math.sin(t * Math.PI * 2) * turn).toFixed(1) + 'deg) scale(' + s.toFixed(3) + ')',
            opacity: +o.toFixed(3)
          });
        }
        let done = false;
        const finish = () => { if (done) return; done = true; node.remove(); arrive(i); };
        let anim = null;
        try { anim = node.animate(frames, { duration: dur, delay: i * gap, easing: 'cubic-bezier(.35,0,.65,1)', fill: 'both' }); } catch (_) {}
        if (anim) anim.finished.then(finish, finish);
        setTimeout(finish, dur + i * gap + (anim ? 400 : 0));
      }
    } catch (_) { settle(); }
  });
}
/* point de contrôle de l'arc : normale au trajet, côté haut de l'écran, gardé dans la fenêtre */
function control(p0, p2, k, side, W, H) {
  const dx = p2.x - p0.x, dy = p2.y - p0.y, d = Math.hypot(dx, dy) || 1;
  let nx = -dy / d, ny = dx / d;
  if (ny > 0) { nx = -nx; ny = -ny; }
  if (Math.abs(ny) < 0.3 && side < 0) { nx = -nx; ny = -ny; }   /* trajet presque vertical : on alterne les côtés */
  const hgt = d * k + 24;
  return {
    x: Math.min(W - 16, Math.max(16, (p0.x + p2.x) / 2 + nx * hgt)),
    y: Math.min(H - 16, Math.max(16, (p0.y + p2.y) / 2 + ny * hgt))
  };
}

/* ---------- particules (un seul <canvas> plein écran, créé à la demande, retiré à la fin) ---------- */
const FX = { cv: null, g: null, parts: [], raf: 0, last: 0, w: 0, h: 0, dpr: 1 };
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const PAL = {
  burst: [['--amber-400', '#fbbf24'], ['--pink-400', '#f472b6'], ['--accent', '#c084fc'], ['--sky', '#7dd3fc'], ['--grass', '#4ade80'], ['--amber-300', '#fcd34d']],
  spark: [['--amber-400', '#fbbf24'], ['--amber-300', '#fcd34d'], ['--pink-400', '#f472b6'], ['--amber-500', '#f59e0b']]
};
const palCache = {};
/* thème visuel (js/ui/theme-picker.js) : emojis des confettis par défaut ; les couleurs des particules
   suivent d'elles-mêmes les jetons du thème (le cache est vidé à chaque changement) */
const CONFETTI = ['🎉', '⭐', '✨', '💛', '🌸'];
let themeConfetti = null;
export function setTheme({ confetti: list } = {}) {
  themeConfetti = Array.isArray(list) && list.length ? list.filter(e => typeof e === 'string' && e).slice(0, 12) : null;
  if (themeConfetti && !themeConfetti.length) themeConfetti = null;
  for (const k of Object.keys(palCache)) delete palCache[k];
}
/* couleurs lues dans les jetons de base.css (repli sur les mêmes valeurs) */
function palette(name) {
  if (palCache[name]) return palCache[name];
  let cs = null;
  try { cs = G.getComputedStyle(doc().documentElement); } catch (_) {}
  return (palCache[name] = PAL[name].map(([v, fb]) => (cs && cs.getPropertyValue(v).trim()) || fb));
}

function fxReady() {
  const d = doc();
  if (!d || !d.body || typeof G.requestAnimationFrame !== 'function') return false;
  if (FX.cv && FX.cv.isConnected) return true;
  try {
    const cv = d.createElement('canvas');
    cv.className = 'mo-fx';
    cv.setAttribute('aria-hidden', 'true');
    Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '90' });
    d.body.appendChild(cv);
    const g = cv.getContext('2d');
    if (!g) { cv.remove(); return false; }
    FX.cv = cv; FX.g = g; FX.w = 0; FX.h = 0;
    fxSize();
    return true;
  } catch (_) { return false; }
}
function fxSize() {
  const dpr = Math.min(3, G.devicePixelRatio || 1);
  const w = FX.cv.clientWidth || G.innerWidth || 390, h = FX.cv.clientHeight || G.innerHeight || 844;
  if (w !== FX.w || h !== FX.h || dpr !== FX.dpr) {
    FX.w = w; FX.h = h; FX.dpr = dpr;
    FX.cv.width = Math.round(w * dpr); FX.cv.height = Math.round(h * dpr);
  }
  FX.g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
/* ajoute un groupe de particules → Promise résolue quand le groupe a fini */
function fxAdd(parts, maxMs) {
  return new Promise(resolve => {
    if (!parts.length || !fxReady()) { resolve(); return; }
    const grp = { left: parts.length, done: false };
    grp.end = () => { if (!grp.done) { grp.done = true; resolve(); } };
    for (const p of parts) { p.grp = grp; FX.parts.push(p); }
    if (!FX.raf) { FX.last = 0; FX.raf = G.requestAnimationFrame(fxLoop); }
    setTimeout(grp.end, maxMs + 500);
  });
}
function fxLoop(ts) {
  FX.raf = 0;
  if (!FX.cv || !FX.cv.isConnected || !FX.g) {
    for (const p of FX.parts) p.grp.end();
    FX.parts = []; FX.cv = null; FX.g = null;
    return;
  }
  const dt = FX.last ? Math.min(0.05, Math.max(0, (ts - FX.last) / 1000)) : 1 / 60;
  FX.last = ts;
  fxSize();
  const g = FX.g;
  g.clearRect(0, 0, FX.w, FX.h);
  const keep = [];
  for (const p of FX.parts) {
    p.age += dt;
    if (p.age < 0) { keep.push(p); continue; }
    if (p.age >= p.life) { if (--p.grp.left <= 0) p.grp.end(); continue; }
    step(p, dt);
    try { draw(g, p); } catch (_) {}
    keep.push(p);
  }
  FX.parts = keep;
  if (keep.length) FX.raf = G.requestAnimationFrame(fxLoop);
  else { try { FX.cv.remove(); } catch (_) {} FX.cv = null; FX.g = null; FX.last = 0; }
}
function step(p, dt) {
  if (p.kind === 'twinkle') { p.y += p.vy * dt; p.rot += p.vr * dt; return; }
  const k = Math.exp(-p.drag * dt);
  p.vx *= k;
  p.vy = p.vy * k + p.grav * dt;
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.rot += p.vr * dt; p.flip += p.vf * dt;
}
function starPath(g, r) {
  const q = r * 0.27;
  g.beginPath();
  g.moveTo(0, -r);
  g.quadraticCurveTo(q, -q, r, 0);
  g.quadraticCurveTo(q, q, 0, r);
  g.quadraticCurveTo(-q, q, -r, 0);
  g.quadraticCurveTo(-q, -q, 0, -r);
  g.closePath();
}
function draw(g, p) {
  const u = p.age / p.life;
  let a, s;
  if (p.kind === 'twinkle') { s = Math.sin(Math.PI * Math.min(1, u)); a = Math.min(1, s * 1.6); }
  else { a = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4; s = 1 - 0.3 * u; }
  if (a <= 0.01 || s <= 0.01) return;
  g.save();
  g.globalAlpha = a;
  g.translate(p.x, p.y);
  g.rotate(p.rot);
  if (p.kind === 'dot') {
    g.fillStyle = p.color; g.beginPath(); g.arc(0, 0, (p.size / 2) * s, 0, Math.PI * 2); g.fill();
  } else if (p.kind === 'rect') {
    g.scale(1, Math.cos(p.flip));            /* confetti qui tourne sur lui-même */
    g.fillStyle = p.color; g.fillRect((-p.size / 2) * s, -p.size * 0.3 * s, p.size * s, p.size * 0.6 * s);
  } else if (p.kind === 'emoji') {
    g.font = Math.round(p.size * s) + 'px ' + EMOJI_FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(p.emoji, 0, 0);
  } else {                                    /* star / twinkle : étoile à 4 branches, halo doux, cœur clair */
    g.shadowColor = p.color; g.shadowBlur = 8;
    starPath(g, (p.size / 2) * s); g.fillStyle = p.color; g.fill();
    g.shadowBlur = 0;
    starPath(g, (p.size / 2) * s * 0.34); g.fillStyle = '#fff'; g.fill();
  }
  g.restore();
}

/* explosion de particules (pastilles, confettis, étoiles ; ou emojis) depuis (x, y).
   burst(élément, options) est aussi accepté (centre de l'élément). */
export function burst(x, y, { count = 18, colors, emojis, spread = 100, dur = 850, delay = 0 } = {}) {
  if (isEl(x)) {
    const c = pointOf(x);
    return c ? burst(c.x, c.y, y && typeof y === 'object' ? y : {}) : Promise.resolve();
  }
  delay += stagDelay;
  x = +x; y = +y;
  if (reduced() || !isFinite(x) || !isFinite(y)) return Promise.resolve();
  const pal = colors && colors.length ? colors : palette('burst');
  const ems = Array.isArray(emojis) && emojis.length ? emojis : null;
  const n = Math.max(1, Math.min(120, Math.floor(+count) || 18));
  const life = Math.max(200, +dur || 850) / 1000;
  const sp = Math.max(10, +spread || 100);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + rnd(-0.35, 0.35);
    const drag = 4.2;
    const v = sp * drag * rnd(0.55, 1.05);
    const kind = ems ? 'emoji' : i % 5 === 0 ? 'star' : i % 2 ? 'rect' : 'dot';
    parts.push({
      kind, x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - sp * 0.8, drag, grav: 520,
      life: life * rnd(0.7, 1), age: -(delay / 1000) - rnd(0, 0.04),
      size: kind === 'emoji' ? rnd(18, 26) : kind === 'star' ? rnd(13, 18) : kind === 'rect' ? rnd(9, 13) : rnd(6, 10),
      rot: rnd(0, Math.PI * 2), vr: rnd(-6, 6), flip: rnd(0, 6), vf: rnd(8, 14),
      color: pal[i % pal.length], emoji: ems ? ems[i % ems.length] : ''
    });
  }
  return fxAdd(parts, delay + life * 1000);
}

/* paillettes : petites étoiles qui scintillent autour de l'élément */
export function sparkle(el, { count = 7, colors, dur = 750, delay = 0 } = {}) {
  delay += stagDelay;
  if (reduced() || !isEl(el)) return Promise.resolve();
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return Promise.resolve();
  const pal = colors && colors.length ? colors : palette('spark');
  const n = Math.max(1, Math.min(40, Math.floor(+count) || 7));
  /* réparties le long du contour (légèrement à l'extérieur), même pour un bouton très large */
  const m = 4, L = r.left - m, Tp = r.top - m, pw = r.width + 2 * m, ph = r.height + 2 * m, per = 2 * (pw + ph);
  const u0 = rnd(0, per);
  const onEdge = u => (u < pw ? [L + u, Tp] : u < pw + ph ? [L + pw, Tp + u - pw]
    : u < 2 * pw + ph ? [L + pw - (u - pw - ph), Tp + ph] : [L, Tp + ph - (u - 2 * pw - ph)]);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = onEdge((u0 + ((i + rnd(-0.3, 0.3)) / n) * per + per) % per);
    parts.push({
      kind: 'twinkle', x, y,
      vy: rnd(-26, -10), vr: rnd(-2, 2), rot: rnd(0, 1), size: rnd(14, 22),
      life: (dur / 1000) * rnd(0.65, 1), age: -(delay / 1000) - rnd(0, 0.18), color: pal[i % pal.length]
    });
  }
  return fxAdd(parts, delay + dur + 200);
}

/* pluie d'emojis façon v11 (#confetti) : chute en 2,6 s environ avec rotation et léger balancement ;
   emojis par défaut = ceux du thème visuel (setTheme), sinon 🎉 ⭐ ✨ 💛 🌸 */
export function confetti({ count = 22, emojis, dur = 2600 } = {}) {
  const d = doc();
  if (!(Array.isArray(emojis) && emojis.length)) emojis = themeConfetti || CONFETTI;
  if (reduced() || !d || !d.body) return Promise.resolve();
  return new Promise(resolve => {
    try {
      let box = d.querySelector('.mo-confetti');
      if (!box) {
        box = d.createElement('div');
        box.className = 'mo-confetti';
        box.setAttribute('aria-hidden', 'true');
        Object.assign(box.style, { position: 'fixed', inset: '0', overflow: 'hidden', pointerEvents: 'none', zIndex: '88' });
        d.body.appendChild(box);
      }
      const list = Array.isArray(emojis) && emojis.length ? emojis : ['🎉'];
      const n = Math.max(1, Math.min(80, Math.floor(+count) || 22));
      let left = n;
      const one = s => {
        s.remove();
        if (--left <= 0) { if (!box.children.length) box.remove(); resolve(); }
      };
      for (let i = 0; i < n; i++) {
        const s = d.createElement('span');
        s.textContent = list[i % list.length];
        Object.assign(s.style, {
          position: 'absolute', top: '-10%', left: rnd(0, 97).toFixed(1) + '%',
          fontSize: rnd(1.3, 1.9).toFixed(2) + 'rem', lineHeight: '1', willChange: 'transform'
        });
        box.appendChild(s);
        const sway = rnd(-40, 40), rot = rnd(200, 420) * (Math.random() < 0.5 ? -1 : 1), ms = (+dur || 2600) * rnd(0.85, 1.15);
        let a = null;
        try {
          a = s.animate([
            { transform: 'translate3d(0,0,0) rotate(0deg)' },
            { transform: 'translate3d(' + sway.toFixed(0) + 'px,60vh,0) rotate(' + (rot * 0.5).toFixed(0) + 'deg)', offset: 0.55 },
            { transform: 'translate3d(' + (-sway * 0.4).toFixed(0) + 'px,118vh,0) rotate(' + rot.toFixed(0) + 'deg)' }
          ], { duration: ms, delay: rnd(0, 700), easing: 'ease-in', fill: 'both' });
        } catch (_) {}
        let done = false;
        const fin = () => { if (!done) { done = true; one(s); } };
        if (a) a.finished.then(fin, fin);
        setTimeout(fin, ms + 1300);
      }
    } catch (_) { resolve(); }
  });
}

/* ---------- valeurs animées (rAF) ---------- */
const COUNTERS = new WeakMap();
/* compteur animé : el.textContent passe de from à to ; fmt(v) → texte (défaut : entier à la française) */
export function countUp(el, from, to, dur = 600, fmt) {
  const f = typeof fmt === 'function' ? fmt : v => fmtNum(Math.round(v));
  const a = +from || 0, b = +to || 0;
  return new Promise(resolve => {
    if (!el) { resolve(); return; }
    const prev = COUNTERS.get(el);
    if (prev) prev();
    const write = v => { try { el.textContent = f(v); } catch (_) {} };
    if (reduced() || !(dur > 0) || typeof G.requestAnimationFrame !== 'function') {
      write(b);
      if (reduced()) fadePulse(el, 'count', { low: 0.5 });
      resolve();
      return;
    }
    const ease = easeFn(EASE.out);
    let raf = 0, t0 = 0, over = false;
    const stop = final => {
      if (over) return;
      over = true;
      if (raf) G.cancelAnimationFrame(raf);
      if (COUNTERS.get(el) === cancel) COUNTERS.delete(el);
      if (final) write(b);
      resolve();
    };
    const cancel = () => stop(false);
    COUNTERS.set(el, cancel);
    const tick = ts => {
      if (over) return;
      if (!t0) t0 = ts;
      const p = Math.min(1, (ts - t0) / dur);
      write(a + (b - a) * ease(p));
      if (p < 1) raf = G.requestAnimationFrame(tick); else stop(true);
    };
    write(a);
    raf = G.requestAnimationFrame(tick);
    setTimeout(() => stop(true), dur + 500);
  });
}

/* points d'un polygone : 'x,y x,y' | [[x,y]…] | [{x,y}…] → [[x,y]…] */
function parsePts(v) {
  if (!v) return [];
  if (typeof v === 'string') {
    const nums = v.trim().split(/[\s,]+/).map(Number).filter(isFinite);
    const out = [];
    for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
    return out;
  }
  if (Array.isArray(v)) {
    return v.map(p => (Array.isArray(p) ? [+p[0], +p[1]] : p && typeof p === 'object' ? [+p.x, +p.y] : null))
      .filter(p => p && isFinite(p[0]) && isFinite(p[1]));
  }
  return [];
}
const ptsStr = pts => pts.map(p => (Math.round(p[0] * 100) / 100) + ',' + (Math.round(p[1] * 100) / 100)).join(' ');
const MORPHS = new WeakMap();
/* morphing d'un <polygon> SVG (radar) : fromPts null → points actuels du polygone */
export function morphPolygon(poly, fromPts, toPts, dur = 600) {
  return new Promise(resolve => {
    try {
      if (!poly || typeof poly.setAttribute !== 'function') { resolve(); return; }
      const B = parsePts(toPts);
      if (!B.length) { resolve(); return; }
      const A0 = parsePts(fromPts == null ? poly.getAttribute('points') : fromPts);
      const prev = MORPHS.get(poly);
      if (prev) prev();
      const set = pts => { try { poly.setAttribute('points', ptsStr(pts)); } catch (_) {} };
      if (reduced() || !(dur > 0) || !A0.length || typeof G.requestAnimationFrame !== 'function') {
        set(B);
        if (reduced()) fadePulse(poly, 'morph', { low: 0.4 });
        resolve();
        return;
      }
      /* nombres de sommets différents : on répète le dernier sommet */
      const n = Math.max(A0.length, B.length);
      const pad = P => Array.from({ length: n }, (_, i) => P[Math.min(i, P.length - 1)]);
      const A = pad(A0), Bp = pad(B);
      const ease = easeFn(EASE.out);
      let raf = 0, t0 = 0, over = false;
      const stop = final => {
        if (over) return;
        over = true;
        if (raf) G.cancelAnimationFrame(raf);
        if (MORPHS.get(poly) === cancel) MORPHS.delete(poly);
        if (final) set(B);
        resolve();
      };
      const cancel = () => stop(false);
      MORPHS.set(poly, cancel);
      const tick = ts => {
        if (over) return;
        if (!t0) t0 = ts;
        const p = Math.min(1, (ts - t0) / dur), e = ease(p);
        set(A.map((q, i) => [q[0] + (Bp[i][0] - q[0]) * e, q[1] + (Bp[i][1] - q[1]) * e]));
        if (p < 1) raf = G.requestAnimationFrame(tick); else stop(true);
      };
      set(A);
      raf = G.requestAnimationFrame(tick);
      setTimeout(() => stop(true), dur + 500);
    } catch (_) { resolve(); }
  });
}

/* ---------- transitions d'écran ---------- */
/* document.startViewTransition si disponible et mouvement non réduit, sinon fn() directement.
   → Promise résolue quand le DOM est à jour (rejetée seulement si fn échoue). */
export function viewTransition(fn) {
  const d = doc();
  try {
    if (d && !reduced() && typeof d.startViewTransition === 'function' && d.visibilityState !== 'hidden') {
      const vt = d.startViewTransition(() => (typeof fn === 'function' ? fn() : undefined));
      /* transition sautée (onglet masqué, autre transition…) : pas d'erreur en console */
      if (vt.ready) vt.ready.catch(() => {});
      if (vt.finished) vt.finished.catch(() => {});
      return vt.updateCallbackDone ? vt.updateCallbackDone : Promise.resolve();
    }
  } catch (_) { /* repli ci-dessous */ }
  try { return Promise.resolve(typeof fn === 'function' ? fn() : undefined); } catch (e) { return Promise.reject(e); }
}
