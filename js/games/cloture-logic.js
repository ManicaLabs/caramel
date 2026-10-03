/* ============ LE CHEMIN DE LA CLÔTURE — logique pure (aucun DOM) ============
   Utilisé par js/games/cloture.js ; testé par tests/cloture.test.mjs (node tests/run.mjs cloture).
   Un « plan » est une portion de ligne graduée telle que la décrit item.data (js/content/maths/ligne.js) :
   { min, max, major, minor, labels: [{ v, text }] } — la ligne principale, ou data.zoom (partie agrandie).
   - piquets : min + i × minor, i = 0 … n ; grands piquets aux multiples ABSOLUS de major (marge 1e-6) ;
   - échelle valeur ↔ x (pixels) ;
   - aimantation : aux piquets si data.snap, sinon à une grille fine d'un dixième d'intervalle
     (les cibles « à l'estime » du générateur en sont toujours des multiples) ;
   - tolérance : juste si |position − valeur| ≤ data.tolerance ;
   - saisie au pavé : parseNum(saisie) comparé à la réponse ;
   - fractions écrites « 7/4 » → morceaux pour l'écriture empilée ;
   - plaquettes : taille de police qui tient sans chevauchement ;
   - indice : les deux plaquettes (ou piquets) qui encadrent la valeur, et les petits sauts entre elles ;
   - caméra du zoom : zoom logarithmique à point fixe (la lisse ne bouge pas à l'écran) ;
   - saut en arc et marche du compagnon. */

import { parseNum, fmtNum } from '../core/util.js';

export const EPS = 1e-6;
const NNBSP = '\u202f';
const r9 = x => Math.round(x * 1e9) / 1e9;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- piquets ---------- */
/* nombre de petits intervalles du plan */
export function intervals(plane) {
  const n = Math.round((plane.max - plane.min) / plane.minor);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
/* v est-il un multiple de step (marge relative 1e-6 : 0,1 n'est pas exact en binaire) */
export function isMultiple(v, step) {
  if (!(step > 0) || !Number.isFinite(v)) return false;
  const q = v / step;
  return Math.abs(q - Math.round(q)) < EPS;
}
export function postValue(plane, i) { return r9(plane.min + i * plane.minor); }
/* [{ i, v, major }] du premier au dernier piquet */
export function posts(plane) {
  const n = intervals(plane), out = [];
  for (let i = 0; i <= n; i++) {
    const v = postValue(plane, i);
    out.push({ i, v, major: isMultiple(v, plane.major) });
  }
  return out;
}
/* indice du piquet le plus proche de v (borné au plan) */
export function postIndex(plane, v) {
  return clamp(Math.round((v - plane.min) / plane.minor), 0, intervals(plane));
}
export function nearestPost(plane, v) { return postValue(plane, postIndex(plane, v)); }
export function sameValue(a, b) { return Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b)); }
/* plaquette posée sur la valeur v, ou null */
export function labelAt(plane, v) { return (plane.labels || []).find(l => sameValue(l.v, v)) || null; }

/* ---------- échelle valeur ↔ x ---------- */
export function makeScale(min, max, x0, x1) {
  const span = max - min || 1, k = (x1 - x0) / span;
  return { min, max, x0, x1, k, toX: v => x0 + (v - min) * k, toV: x => min + (x - x0) / k };
}

/* ---------- placer : aimantation, flèches, tolérance ---------- */
/* pas des déplacements : un piquet si aimanté, sinon un dixième de petit intervalle */
export function fineStep(plane, snap) { return snap ? plane.minor : plane.minor / 10; }
/* position posable la plus proche de v (bornée au plan) */
export function quantize(plane, v, snap) {
  const s = fineStep(plane, snap);
  const n = Math.round((plane.max - plane.min) / s);
  const i = clamp(Math.round((v - plane.min) / s), 0, n);
  return r9(plane.min + i * s);
}
/* flèches ‹ › et clavier : dir = −1 | +1 ; rien de posé → la carotte arrive au premier piquet */
export function nudge(plane, v, dir, snap) {
  if (v === null || v === undefined || !Number.isFinite(v)) return plane.min;
  return quantize(plane, v + dir * fineStep(plane, snap), snap);
}
export function isCorrectPlace(data, pos) {
  if (pos === null || pos === undefined || !Number.isFinite(pos)) return false;
  return Math.abs(pos - data.value) <= data.tolerance + 1e-9;
}
/* texte accessible de la position (sans donner le nombre : c'est l'exercice) */
export function positionText(plane, v, snap) {
  if (v === null || v === undefined) return 'Carotte pas encore posée';
  if (snap) return 'Carotte sur le piquet ' + (postIndex(plane, v) + 1) + ' sur ' + (intervals(plane) + 1);
  const pct = Math.round(100 * (v - plane.min) / (plane.max - plane.min));
  return 'Carotte à ' + pct + NNBSP + '% de la clôture';
}

/* ---------- lire : saisie au pavé ---------- */
export function answerMatches(str, answer) {
  const x = parseNum(str), a = Number(answer);
  return Number.isFinite(x) && Number.isFinite(a) && Math.abs(x - a) <= 1e-9 * Math.max(1, Math.abs(a));
}
/* longueur de saisie à autoriser (chiffres + virgule + marge) */
export function keypadLen(answer) { return Math.max(4, String(answer).replace('.', ',').length + 2); }

/* ---------- fractions : écriture empilée ---------- */
/* « Compte 3 petits piquets : 3/4. » → [{ t: 'txt', s }, { t: 'frac', n: 3, d: 4 }, { t: 'txt', s }] */
export function splitFrac(str) {
  const s = String(str ?? ''), out = [], re = /(\d+)\/(\d+)/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: 'txt', s: s.slice(last, m.index) });
    out.push({ t: 'frac', n: Number(m[1]), d: Number(m[2]) });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ t: 'txt', s: s.slice(last) });
  return out;
}
/* opérations dans les bulles : le signe reste collé au nombre qui le suit (« = 48 » ne se sépare jamais),
   la ligne peut se couper avant le signe ; jamais à l'intérieur d'un nombre (espaces fines insécables) */
export function keepMath(s) { return String(s).replace(/ ([+−×÷=<>]) (?=[\d(]|$)/g, ' $1\u00A0'); }

/* ---------- plaquettes ---------- */
/* largeur estimée d'un libellé pour une police de 100 px (Fredoka 600 : chiffres ≈ 0,58 em) */
export function estimateWidth100(text) {
  return [...String(text)].reduce((w, c) => w + (c === NNBSP || c === ' ' ? 24 : c === ',' ? 26 : c === '/' ? 40 : 58), 0);
}
/* taille de police commune à toutes les plaquettes d'une ligne, sans chevauchement :
   xs = abscisses (px, triées), w100 = largeurs des libellés à 100 px ; pad = marge intérieure totale
   d'une plaquette, gap = écart minimal entre deux plaquettes. */
export function fitLabelFont(xs, w100, { pad = 8, gap = 3, min = 11, max = 17 } = {}) {
  let f = max;
  for (let i = 1; i < xs.length; i++) {
    const room = xs[i] - xs[i - 1] - pad - gap;
    const need = (w100[i] + w100[i - 1]) / 200;
    if (need > 0) f = Math.min(f, room / need);
  }
  return clamp(Math.floor(f * 2) / 2, min, max);
}

/* ---------- indice : ce qui encadre la valeur ----------
   aimanté → les deux plaquettes qui encadrent la valeur (au-delà de la dernière : les deux dernières) ;
   à l'estime → les deux piquets qui l'encadrent. → { a, b } (valeurs) */
export function hintSpan(plane, value, snap) {
  if (!snap) {
    const i = clamp(Math.floor((value - plane.min) / plane.minor + EPS), 0, intervals(plane) - 1);
    return { a: postValue(plane, i), b: postValue(plane, i + 1) };
  }
  const L = [...(plane.labels || [])].sort((x, y) => x.v - y.v);
  if (L.length < 2) return { a: plane.min, b: plane.max };
  for (let i = 0; i < L.length - 1; i++) {
    if (L[i].v - EPS <= value && value <= L[i + 1].v + EPS) return { a: L[i].v, b: L[i + 1].v };
  }
  return value < L[0].v ? { a: L[0].v, b: L[1].v } : { a: L[L.length - 2].v, b: L[L.length - 1].v };
}
/* petits sauts à dessiner pour l'indice : [[v, v + minor], …] entre a et b (à l'estime : tous) */
export function hopsBetween(plane, a, b, snap) {
  const out = [];
  const lo = snap ? Math.min(a, b) : plane.min, hi = snap ? Math.max(a, b) : plane.max;
  const n = intervals(plane);
  for (let i = 0; i < n; i++) {
    const v = postValue(plane, i), w = postValue(plane, i + 1);
    if (v >= lo - EPS && w <= hi + EPS) out.push([v, w]);
  }
  return out;
}
/* valeur d'un petit saut : { text: '+10' } ou, pour une fraction, { n: 1, d: 4 } */
export function stepLabel(plane, fmt) {
  if (fmt === 'frac') return { n: 1, d: Math.round(1 / plane.minor) };
  return { text: '+' + fmtNum(r9(plane.minor)) };
}

/* ---------- caméra du zoom (viewBox) ----------
   La partie agrandie est dessinée DANS son intervalle [X1 ; X2] de la ligne principale, à l'échelle 1/k
   (k = (x1 − x0) / (X2 − X1)), sa lisse posée sur la lisse principale. La caméra passe de la vue
   complète V0 = (0, 0, W, H) à V1 = (vx, vy, W/k, H/k) où la partie agrandie occupe tout l'écran,
   en zoom logarithmique autour du point fixe P (la lisse reste à la même hauteur à l'écran).
   → { k, sub: { tx, ty, s } (transformation du groupe agrandi), at(e) → [x, y, w, h] pour e ∈ [0 ; 1] } */
export function camera({ W, H, x0, x1, X1, X2, yRail }) {
  const k = (x1 - x0) / (X2 - X1);
  const vx = X1 - x0 / k, vy = yRail * (1 - 1 / k);
  const P = { x: k * vx / (k - 1), y: k * vy / (k - 1) };
  return {
    k, P, sub: { tx: vx, ty: vy, s: 1 / k },
    at(e) {
      const s = Math.pow(k, -clamp(e, 0, 1));
      return [P.x * (1 - s), P.y * (1 - s), W * s, H * s];
    }
  };
}
export function easeInOut(t) { const x = clamp(t, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

/* ---------- compagnon : saut en arc et marche ---------- */
/* points d'une parabole de (xa, ya) à (xb, yb), sommet « height » px au-dessus du segment */
export function arcPoints(xa, ya, xb, yb, height, n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push({ x: xa + (xb - xa) * t, y: ya + (yb - ya) * t - 4 * height * t * (1 - t), t });
  }
  return out;
}
/* durées (ms) : un saut ne bloque jamais plus de 400 ms ; la marche dépend de la distance */
export function jumpMs(dx) { return Math.round(clamp(240 + Math.abs(dx) * 0.5, 300, 400)); }
export function jumpHeight(dx) { return clamp(18 + Math.abs(dx) * 0.18, 22, 56); }
export function walkMs(dx) { return Math.round(clamp(Math.abs(dx) * 3.4, 420, 1500)); }

/* ---------- mise en page verticale de la scène (px) ----------
   A : bande du haut (mini-carte du zoom), above : bande au-dessus de la lisse (drapeau, compagnon,
   panneau, loupe), puis plaquettes entre les deux lisses et le pré. Ancrage EN HAUT : quand la scène
   rapetisse (bulle trop haute pour le pré, posée sous la scène), seul le pré se raccourcit. */
export function sceneLayout(W, H, { zoom = false, wide = false, lift = null, compact = false } = {}) {
  const S = wide ? 72 : 60;                         /* largeur du compagnon (≈ 64 px) */
  /* compact : petit écran avec pavé numérique (≈ 360 × 740) → bandes resserrées */
  const A = zoom ? (compact ? 48 : wide ? 66 : 60) : 12;
  const above = compact ? 76 : wide ? 98 : 88;
  const ideal = A + above + 62 + 20;
  const extra = Math.max(0, H - ideal);
  /* la clôture descend vers le milieu quand la scène est haute, en gardant ~90 px de pré sous les piquets
     (place de la bulle d'indice, posée sur l'herbe) */
  const lifted = lift === null ? clamp(Math.min(extra * 0.42, extra - 92), 0, wide ? 170 : 150) : lift;
  const yRail = A + lifted + above;
  return {
    W, H, S, wide, zoom, A, lift: lifted, yRail,
    railH: wide ? 12 : 10,
    bigTop: yRail - (wide ? 26 : 22), smallTop: yRail - (wide ? 14 : 12),
    bigW: wide ? 10 : 8, smallW: wide ? 5.5 : 4.5,
    yLabel: yRail + (wide ? 30 : 27),
    yRail2: yRail + (wide ? 52 : 47),
    yGround: yRail + (wide ? 70 : 62),
    left: wide ? 92 : 68,                           /* début de la clôture : place du compagnon à gauche */
    flagTop: yRail - (compact ? 64 : wide ? 86 : 74),   /* haut du mât du drapeau */
    signY: yRail - (compact ? 56 : wide ? 82 : 66),     /* centre du panneau de la valeur */
    tipY: yRail - (wide ? 31 : 26),                     /* pointe de la carotte */
    loupeY: yRail - (compact ? 58 : wide ? 76 : 66),    /* centre de la loupe */
    minH: A + above + 44,                           /* en dessous, les pieds des piquets sont coupés */
    ideal
  };
}
