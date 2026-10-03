/* ============ PROCÉDURES DE CALCUL MENTAL — axe 'ma.procedures' · jeu « Pommes express » ============
   Module pur (aucun DOM). Contrat : docs/ARCHITECTURE.md §6 ; mise en scène : docs/JEUX.md §5
   (une pomme-carte par calcul, réponse au pavé ; après une erreur, la STRATÉGIE ; après deux, le calcul détaillé).
   gen(A, rng, opts) → item, déterministe pour (A, graine), pour tout A ∈ [0 ; 5,6] (core/levels.js).
   fromKey(key, A, rng) → l'item de même clé (même calcul).

   ---------- SOURCES ----------
   Programme du cycle 2, BO n°41 du 31/10/2024 (calcul mental CP p. 100-102, CE1 p. 108-110, CE2 p. 116-117) ;
   programme du cycle 3, BO n°16 du 17/04/2025 + Exemples de réussite CM1/CM2 (éduscol 2025) ;
   « Calcul mental du CP au CM2 » (éduscol, juillet 2025) pour les formulations des stratégies.
   Synthèse : rapports de recherche du 02/10/2026, maths-c2 §2.5, §3.5, §4.5, §10 (ligne « Procédures »)
   et maths-c3 §4 (tableau CM1/CM2). Pas de procédure « × 25 » ni de compléments nouveaux au CM (BO).

   ---------- CHAMP NUMÉRIQUE (nombres en jeu ET résultats) ----------
   CP ≤ 20 (P1, A < 0,2) · ≤ 59 (P2, A < 0,45) · ≤ 100 · CE1 ≤ 1 000 · CE2 et CM1 P1-P2 ≤ 9 999 (A < 3,4)
   · CM1 P3 → CM2 P2 ≤ 999 999 (A < 4,4) · ensuite ≤ 999 999 999 (jamais le milliard).
   Décimaux : aucun avant le CM1 P2 (A = 3,2 : dixièmes ; 3,3 : centièmes) ; millièmes au CM2 (A ≥ 4).

   ---------- PALIERS (A → procédures nouvelles ; les précédentes restent, sur le champ de l'année) ----------
   | A        | procédures (kind)                                                                          |
   |----------|--------------------------------------------------------------------------------------------|
   | 0 – 1    | CP : ±1, ±2 (plus1 moins1 plus2 moins2, dès 0) ; ±10 (plus10 moins10, 0,15) ; + n < 9 sans  |
   |          |   changer de dizaine (plusPetit, 0,2) ; complément à la dizaine supérieure 37 + … = 40      |
   |          |   (complDiz, 0,25) ; ± dizaines entières 76 − 30 (plusDiz moinsDiz, 0,3) ; + n < 9 avec      |
   |          |   passage 47 + 8 = 47 + 3 + 5 (plusPassage, 0,45) ; dizaines − n < 10 par cassage 50 − 6     |
   |          |   (dizMoins, 0,5) ; + 9 = + 10 − 1 (plus9, 0,55) ; a + b < 100, dizaines puis unités         |
   |          |   47 + 28 (deuxNombres, 0,6) ; moitié d'un nombre pair 46 = 40 + 6 (moitie, 0,7)            |
   | 1 – 2    | CE1 : ± dizaines et centaines 354 + 500, 746 + 80 (plusCent moinsCent dès 1 ; retenue 1,2) ; |
   |          |   − n < 9 sans changement 157 − 5 (moinsPetit, 1,1) ; × 10 d'un nombre < 100 (fois10, 1,15) ;|
   |          |   + 9 sur 3 chiffres (1), + 19, + 29 (1,3) ; − 9 = − 10 + 1 (moins9, 1,35) ; − n < 9 avec      |
   |          |   passage 523 − 7 = 523 − 3 − 4 (moinsPassage, 1,4) ; 11-19 × n < 10 : 13 × 7 = 70 + 21       |
   |          |   (distri, 1,4 selon les tables connues : 7 à 1,4, 8 à 1,6, 9 à 1,8) ; moitié de nombres       |
   |          |   ronds 470 = 400 + 70 (moitie, 1,5)                                                         |
   | 2 – 3    | CE2 : × 10 d'un entier (2) ; × 100 (fois100, 2,1) ; + 8 (plus8, 2,1) ; + 18, 28, 38, + 39     |
   |          |   (2,2) ; n × dizaines 9 × 40 (foisDiz, 2,2) ; − 19, 29, 39 (2,3) ; × 4 double du double       |
   |          |   (fois4, 2,4) ; complément à 100, rendu de monnaie (compl100, 2,4) ; 11-99 × n : 23 × 7       |
   |          |   (distri, 2,5) ; × 8 trois doubles (fois8, 2,6)                                             |
   | 3 – 4    | CM1 : ± 8 … 39 sur de grands nombres, − 8 = − 10 + 2 (moins8, 3) ; × 4, × 8 sur 3 chiffres    |
   |          |   (3) ; n × centaines 9 × 400 (foisCent, 3,1) ; entier × 1 000 (fois1000, 3,2) ; × 5 = × 10    |
   |          |   puis moitié, entier < 200 (fois5, 3,3) ; ± dixièmes, centièmes sans retenue 4,45 + 0,3       |
   |          |   (decPlus 3,3, decMoins 3,35) ; décimal × 10 (decFois, 3,3), ÷ 10 (decDiv, 3,4) ;            |
   |          |   distributivité simple, un facteur en « dizaines + 1 » 21 × 35 = 20 × 35 + 35 (distri, 3,4) ;  |
   |          |   ordres de grandeur en QCM 52 × 37 ≈ 2 000, 597 ÷ 2 ≈ 300 (estimation, 3,5) ; une paire de    |
   |          |   parenthèses 3 × (10 − 6) (parentheses, 3,6)                                                 |
   | 4 – 5    | CM2 : somme de deux décimaux < 10 à une décimale 8,6 + 7,8 (sommeDec, 4) ; ± 49 … 99 :        |
   |          |   + 98 = + 100 − 2 (4) ; distributivité 12 × 42 (distri, 4) ; décimal × 100, × 1 000 (4) et     |
   |          |   ÷ 100, ÷ 1 000 (4,1) ; millièmes sans retenue 4,452 + 0,03 (4) ; produits de dizaines,       |
   |          |   centaines, milliers 900 × 700 (produitRonds, 4,1) ; double d'un décimal 13,6 → 27,2          |
   |          |   (doubleDec, 4,2) ; ÷ 4 par moitiés (div4, 4,2) ; ajout avec retenue 4,45 + 0,8 (decRetenue, |
   |          |   4,2) ; ordres de grandeur 724 × 68 ≈ 49 000, 59 437 ÷ 6 ≈ 10 000 (estimation, 4,2), avec un |
   |          |   décimal 32 × 3 182,5 ≈ 90 000 (4,4) ; moitié d'un décimal 1,22 → 0,61 (moitieDec, 4,3) ;    |
   |          |   décimal × 5 : 5 × 1,46 = 7,3 (fois5, 4,3) ;                                                  |
   |          |   ÷ 8 par moitiés 260 ÷ 8 = 32,5 (div8, 4,4) ; décimal × 50 : 50 × 12,4 (fois50, 4,5) ;         |
   |          |   deux paires de parenthèses (15 − 7) × (6 + 3), 37 − (3 × (14 − 6)) (parentheses, 4,5)       |
   | 5 – 5,6  | Avancé (toujours programme du CM2) : mélange des procédures du CM2 sur de grands nombres,     |
   |          |   distributivité 23 × 34, × 50 d'un décimal à deux décimales, ÷ 8 non entier d'un nombre      |
   |          |   > 600, parenthèses avec une division ou un résultat intermédiaire > 100 (5) — parenthèses  |
   |          |   (× 3) et ordres de grandeur (× 1,5) plus fréquents                                         |
   Une procédure est tirée parmi celles déjà arrivées (poids de base ; × 1,6 si elle arrive dans l'année
   en cours) ; les procédures de CP « ± 1, ± 2 » sortent au CE1, etc. (fenêtre [from ; to] de chaque kind).

   ---------- ITEM ----------
   { axis: 'ma.procedures', kind, key, A, prompt, answer (nombre), choices? (estimation : 4 choix),
     hint (la stratégie générale, sans la réponse), explain (la stratégie appliquée aux vrais nombres),
     autoMs (5000 ; 7000 pour décimaux, distributivité, estimation, parenthèses et procédures en
     trois temps ×8 ÷8 ÷4), leitner: false, data }
   prompt : '47 + 9 = …', '37 + … = 40', 'moitié de 46 = …', 'double de 13,6 = …', '9 × 40 = …',
            '260 ÷ 8 = …', '(15 − 7) × (6 + 3) = …', '724 × 68 ≈ …' (nombres fmtNum, « … » = U+2026)
   key    : 'ma.procedures:<kind>:<opérandes ASCII>' — '47+9', '37' (complDiz/compl100 : le nombre de départ),
            '46' (moitie, doubleDec, moitieDec), '4x37' (l'ordre affiché compte), '4.45+0.8', '260/8',
            '(15-7)x(6+3)', '724x68' (estimation)
   item.A = niveau réel : max(arrivée de la procédure, niveau du champ numérique et des décimales),
            puis A demandé borné à [ce niveau ; ce niveau + 0,6] (comme ma.faits)
   data   = { strategy: kind, decimals (nombre de décimales de la réponse),
              ardoise: ['57', '56'] (résultats intermédiaires de la stratégie, comme sur l'ardoise) }
   opts   : avoid (Set de clés, jusqu'à 40 tirages), kind (imposé ; s'il n'existe pas encore à ce niveau,
            l'item est pris au premier niveau où il existe, et item.A le dit). */

import { fmtNum, frTypo } from '../../core/util.js';
import { makeRng } from '../../core/rng.js';

export const axis = 'ma.procedures';

const A_TOP = 5.6, TRIES = 40, SPAN = 0.6;
const AUTO = 5000, AUTO_SLOW = 7000;
const HOLE = '…';

const clampA = A => { const a = Number(A); return Math.min(A_TOP, Math.max(0, Number.isFinite(a) ? a : 0)); };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r2 = x => Math.round(x * 100) / 100;
const toSet = v => (v instanceof Set ? v : new Set(Array.isArray(v) ? v : []));
const isInt = n => Number.isInteger(n);
const f = n => fmtNum(n);
const T = s => frTypo(s);

/* ---------- décimaux exacts (entiers mis à l'échelle, une seule division finale) ---------- */
const POW = [1, 10, 100, 1000, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10];
const ndec = x => { const s = String(x); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };
const sc = (x, d) => Math.round(x * POW[d]);
const dv = (N, d) => N / POW[d];
const addD = (x, y) => { const d = Math.max(ndec(x), ndec(y)); return dv(sc(x, d) + sc(y, d), d); };
const subD = (x, y) => { const d = Math.max(ndec(x), ndec(y)); return dv(sc(x, d) - sc(y, d), d); };
const mulD = (x, k) => { const d = ndec(x); return dv(sc(x, d) * k, d); };          /* k entier */
const halfD = x => { const d = ndec(x), N = sc(x, d); return N % 2 === 0 ? dv(N / 2, d) : dv(N * 5, d + 1); };
const digitAt = (x, r) => { const d = Math.max(0, -r, ndec(x)); return Math.floor(sc(x, d) / POW[r + d]) % 10; };
const nDigits = n => String(Math.floor(Math.abs(n))).length;

/* ---------- champ numérique ---------- */
function maxInt(A) {
  if (A < 0.2) return 20;
  if (A < 0.45) return 59;
  if (A < 1) return 100;
  if (A < 2) return 1000;
  if (A < 3.4) return 9999;
  if (A < 4.4) return 999999;
  return 999999999;
}
function fieldLevel(x) {
  const n = Math.floor(Math.abs(x));
  if (n <= 20) return 0;
  if (n <= 59) return 0.2;
  if (n <= 100) return 0.45;
  if (n <= 1000) return 1;
  if (n <= 9999) return 2;
  if (n <= 999999) return 3.4;
  return 4.4;
}
const decLevel = d => (d <= 0 ? 0 : d === 1 ? 3.2 : d === 2 ? 3.3 : 4);
const maxDec = A => (A < 3.2 ? 0 : A < 3.3 ? 1 : A < 4 ? 2 : 3);

/* ---------- tirages ---------- */
const randDigits = (rng, k) => rng.int(k <= 1 ? 1 : POW[k - 1], POW[k] - 1);
/* entier ≤ max avec un nombre de chiffres tiré uniformément entre minD et celui de max */
function upTo(rng, max, minD = 1) {
  const maxD = nDigits(max);
  if (max < 1) return 0;
  const k = rng.int(Math.min(minD, maxD), maxD);
  const lo = k <= 1 ? 1 : POW[k - 1];
  return rng.int(lo, Math.min(POW[k] - 1, max));
}
/* entier de [lo ; hi] dont le chiffre des unités vérifie ok(u) (null si aucun) */
function withUnits(rng, lo, hi, ok) {
  if (hi < lo) return null;
  for (let i = 0; i < 30; i++) { const n = rng.int(lo, hi); if (ok(n % 10)) return n; }
  for (let n = lo; n <= hi; n++) if (ok(n % 10)) return n;
  return null;
}
/* tirage pondéré des valeurs dont le niveau d'arrivée est ≤ A (les plus récentes favorisées) */
function pickArrived(rng, A, table) {
  const ok = table.filter(([, lo]) => lo <= A + 1e-9);
  if (!ok.length) return null;
  const top = Math.max(...ok.map(([, lo]) => lo));
  return rng.weighted(ok.map(([v]) => v), ok.map(([, lo]) => (lo === top ? 2 : 1)));
}

/* ---------- textes ---------- */
const pl = (n, s, p) => (Math.abs(n) >= 2 ? (p || s + 's') : s);
const nb = (n, s, p) => `${f(n)} ${pl(n, s, p)}`;
function du(D, U) {
  const parts = [];
  if (D) parts.push(nb(D, 'dizaine'));
  if (U || !D) parts.push(nb(U, 'unité'));
  return parts.join(' et ');
}
const RANKS = {
  '-3': ['millième', 'millièmes'], '-2': ['centième', 'centièmes'], '-1': ['dixième', 'dixièmes'],
  0: ['unité', 'unités'], 1: ['dizaine', 'dizaines'], 2: ['centaine', 'centaines'], 3: ['millier', 'milliers'],
  4: ['dizaine de milliers', 'dizaines de milliers'], 5: ['centaine de milliers', 'centaines de milliers'],
  6: ['million', 'millions'], 7: ['dizaine de millions', 'dizaines de millions'],
  8: ['centaine de millions', 'centaines de millions'], 9: ['millier de millions', 'milliers de millions']
};
const rk = (r, n = 2) => RANKS[r][Math.abs(n) >= 2 ? 1 : 0];
const nbR = (n, r) => `${f(n)} ${rk(r, n)}`;
const accord = (n, sing, plur) => (Math.abs(n) >= 2 ? plur : sing);

/* ---------- lecture des opérandes d'une clé ---------- */
const NUM_RE = /^\d+(\.\d+)?$/;
const num = s => (NUM_RE.test(s) ? Number(s) : NaN);
const S = x => String(x);
function bin(ops, op) {
  const i = ops.indexOf(op, 1);
  if (i < 0) return null;
  const a = num(ops.slice(0, i)), b = num(ops.slice(i + 1));
  return Number.isFinite(a) && Number.isFinite(b) ? { a, b } : null;
}
function one(ops) { const n = num(ops); return Number.isFinite(n) ? n : null; }
/* produit écrit dans l'ordre de la clé ('4x37' ou '37x4') : { x, y, expr } */
function prod(ops) {
  const p = bin(ops, 'x');
  return p ? { x: p.a, y: p.b, expr: `${f(p.a)} × ${f(p.b)}` } : null;
}
const flip = (rng, a, b, op = 'x') => (rng.chance(0.5) ? `${S(a)}${op}${S(b)}` : `${S(b)}${op}${S(a)}`);

/* ========== DÉFINITIONS DES PROCÉDURES ==========
   sample(A, rng) → opérandes (chaîne de clé) ou null ; build(ops, rng, A) → cœur d'item ou null :
   { prompt, answer, hint, explain, lo (arrivée de la procédure), nums (nombres en jeu), ardoise?, choices?, slow? } */
const DEF = {};
function def(kind, spec) { DEF[kind] = { kind, news: [spec.from], ...spec }; }

/* ----- CP : ± 1, ± 2 ----- */
def('plus1', {
  from: 0, to: 1.2, w: 0.5,
  sample: (A, rng) => `${upTo(rng, maxInt(A) - 1)}+1`,
  build(ops) {
    const p = bin(ops, '+'); if (!p || !isInt(p.a) || p.a < 1 || p.b !== 1) return null;
    const n = p.a, r = n + 1;
    return { prompt: `${f(n)} + 1 = ${HOLE}`, answer: r, lo: 0, nums: [n, r],
      hint: 'Ajouter 1, c’est trouver le nombre qui vient juste après.',
      explain: `Juste après ${f(n)} vient ${f(r)}. Donc ${f(n)} + 1 = ${f(r)}.` };
  }
});
def('moins1', {
  from: 0, to: 1.2, w: 0.5,
  sample: (A, rng) => `${Math.max(2, upTo(rng, maxInt(A)))}-1`,
  build(ops) {
    const p = bin(ops, '-'); if (!p || !isInt(p.a) || p.a < 2 || p.b !== 1) return null;
    const n = p.a, r = n - 1;
    return { prompt: `${f(n)} − 1 = ${HOLE}`, answer: r, lo: 0, nums: [n, r],
      hint: 'Enlever 1, c’est trouver le nombre qui vient juste avant.',
      explain: `Juste avant ${f(n)} vient ${f(r)}. Donc ${f(n)} − 1 = ${f(r)}.` };
  }
});
def('plus2', {
  from: 0.05, to: 1.2, w: 0.5,
  sample: (A, rng) => `${upTo(rng, maxInt(A) - 2)}+2`,
  build(ops) {
    const p = bin(ops, '+'); if (!p || !isInt(p.a) || p.a < 1 || p.b !== 2) return null;
    const n = p.a;
    return { prompt: `${f(n)} + 2 = ${HOLE}`, answer: n + 2, lo: 0.05, nums: [n, n + 2], ardoise: [n + 1, n + 2],
      hint: 'Pour ajouter 2, ajoute 1, puis encore 1.',
      explain: `${f(n)} + 1 = ${f(n + 1)}, puis ${f(n + 1)} + 1 = ${f(n + 2)}. Donc ${f(n)} + 2 = ${f(n + 2)}.` };
  }
});
def('moins2', {
  from: 0.05, to: 1.2, w: 0.5,
  sample: (A, rng) => `${Math.max(4, upTo(rng, maxInt(A)))}-2`,
  build(ops) {
    const p = bin(ops, '-'); if (!p || !isInt(p.a) || p.a < 4 || p.b !== 2) return null;
    const n = p.a;
    return { prompt: `${f(n)} − 2 = ${HOLE}`, answer: n - 2, lo: 0.05, nums: [n, n - 2], ardoise: [n - 1, n - 2],
      hint: 'Pour enlever 2, enlève 1, puis encore 1.',
      explain: `${f(n)} − 1 = ${f(n - 1)}, puis ${f(n - 1)} − 1 = ${f(n - 2)}. Donc ${f(n)} − 2 = ${f(n - 2)}.` };
  }
});

/* ----- ± 10 : une dizaine de plus ou de moins ----- */
def('plus10', {
  from: 0.15, to: 2.4, w: 0.7,
  sample(A, rng) {
    const max = maxInt(A) - 10;
    let n = upTo(rng, max, 1);
    if (A >= 1 && rng.chance(0.3)) {                         /* passage de la centaine : 395 + 10 */
      const c = rng.int(1, Math.max(1, Math.floor((max - 90) / 100)));
      n = Math.min(max, c * 100 + 90 + rng.int(0, 9));
    }
    return `${n}+10`;
  },
  build(ops) {
    const p = bin(ops, '+'); if (!p || !isInt(p.a) || p.a < 1 || p.b !== 10) return null;
    const n = p.a, D = Math.floor(n / 10), U = n % 10;
    return { prompt: `${f(n)} + 10 = ${HOLE}`, answer: n + 10, lo: 0.15, nums: [n, n + 10],
      hint: 'Ajouter 10, c’est ajouter une dizaine : il y a une dizaine de plus.',
      explain: `${f(n)}, c’est ${du(D, U)}. Avec une dizaine de plus : ${du(D + 1, U)}. Donc ${f(n)} + 10 = ${f(n + 10)}.` };
  }
});
def('moins10', {
  from: 0.15, to: 2.4, w: 0.7,
  sample(A, rng) {
    const max = maxInt(A);
    let n = Math.max(11, upTo(rng, max, 2));
    if (A >= 1 && rng.chance(0.3)) {                         /* passage de la centaine : 403 − 10 */
      const c = rng.int(1, Math.max(1, Math.floor(max / 100) - 1));
      n = c * 100 + rng.int(0, 9);
    }
    return `${n}-10`;
  },
  build(ops) {
    const p = bin(ops, '-'); if (!p || !isInt(p.a) || p.a < 11 || p.b !== 10) return null;
    const n = p.a, D = Math.floor(n / 10), U = n % 10;
    return { prompt: `${f(n)} − 10 = ${HOLE}`, answer: n - 10, lo: 0.15, nums: [n, n - 10],
      hint: 'Enlever 10, c’est enlever une dizaine : il y a une dizaine de moins.',
      explain: `${f(n)}, c’est ${du(D, U)}. Avec une dizaine de moins : ${du(D - 1, U)}. Donc ${f(n)} − 10 = ${f(n - 10)}.` };
  }
});

/* ----- + n < 9 sans changer de dizaine (32 + 4) ----- */
def('plusPetit', {
  from: 0.2, to: 1.6, w: 0.6,
  sample(A, rng) {
    const k = rng.int(2, 8);
    const n = withUnits(rng, 11, maxInt(A) - k, u => u >= 1 && u + k <= 9);
    return n === null ? null : `${n}+${k}`;
  },
  build(ops) {
    const p = bin(ops, '+'); if (!p || !isInt(p.a) || p.a < 11 || !(p.b >= 2 && p.b <= 8)) return null;
    const n = p.a, k = p.b, U = n % 10; if (U < 1 || U + k > 9) return null;
    return { prompt: `${f(n)} + ${k} = ${HOLE}`, answer: n + k, lo: 0.2, nums: [n, n + k],
      hint: 'Ajoute seulement aux unités : le reste du nombre ne change pas.',
      explain: `${U} + ${k} = ${U + k} : seul le chiffre des unités change. Donc ${f(n)} + ${k} = ${f(n + k)}.` };
  }
});

/* ----- complément à la dizaine supérieure (37 + … = 40) ----- */
def('complDiz', {
  from: 0.25, to: 2.4, w: 0.7,
  sample(A, rng) {
    const n = withUnits(rng, 11, maxInt(A) - 1, u => u >= 1);
    return n === null ? null : `${n}`;
  },
  build(ops) {
    const n = one(ops); if (n === null || !isInt(n) || n < 11 || n % 10 === 0) return null;
    const D = Math.floor(n / 10), U = n % 10, t = n + 10 - U;
    return { prompt: `${f(n)} + ${HOLE} = ${f(t)}`, answer: 10 - U, lo: 0.25, nums: [n, t],
      hint: 'Regarde le chiffre des unités : combien lui manque-t-il pour faire 10 ?',
      explain: `${f(n)}, c’est ${du(D, U)}. ${U} + ${10 - U} = 10. Donc ${f(n)} + ${10 - U} = ${f(t)}.` };
  }
});

/* ----- ± dizaines entières (76 − 30 ; CE1 : 234 + 60, 746 + 80 avec retenue) ----- */
function dizSample(A, rng, plus) {
  const max = maxInt(A);
  const k = rng.int(2, 9);
  if (plus) {
    if (max - 10 * k < 10) return null;
    let n = upTo(rng, max - 10 * k, 2);
    if (A >= 1.2 && rng.chance(0.4)) {                       /* avec retenue : 746 + 80 */
      const c = rng.int(1, Math.max(1, Math.floor((max - 100) / 100)));
      n = c * 100 + rng.int(10 - k, 9) * 10 + rng.int(0, 9);
      if (n + 10 * k > max) return null;
    }
    return `${n}+${10 * k}`;
  }
  let n = Math.max(10 * k + 10, upTo(rng, max, 2));
  if (A >= 1.2 && rng.chance(0.4)) {                         /* avec retenue : 512 − 30 */
    const c = rng.int(1, Math.max(1, Math.floor(max / 100) - 1));
    n = c * 100 + rng.int(0, k - 1) * 10 + rng.int(0, 9);
  }
  return n > max ? null : `${n}-${10 * k}`;
}
function dizBuild(ops, plus) {
  const p = bin(ops, plus ? '+' : '-');
  if (!p || !isInt(p.a) || !isInt(p.b) || p.a < 10 || p.b % 10 || p.b < 20 || p.b > 90) return null;
  const n = p.a, k = p.b / 10, D = Math.floor(n / 10), r = plus ? n + p.b : n - p.b;
  if (!plus && D - k < 1) return null;
  const crossing = n >= 100 && Math.floor(n / 100) !== Math.floor(r / 100);
  const U = n % 10;
  return { prompt: `${f(n)} ${plus ? '+' : '−'} ${f(p.b)} = ${HOLE}`, answer: r, lo: crossing ? 1.2 : 0.3, nums: [n, r],
    hint: plus ? `Ajouter ${f(p.b)}, c’est ajouter ${k} dizaines.` : `Soustraire ${f(p.b)}, c’est enlever ${k} dizaines.`,
    explain: `${f(n)}, c’est ${du(D, U)}. ${nb(D, 'dizaine')} ${plus ? '+' : '−'} ${k} dizaines = ${nb(plus ? D + k : D - k, 'dizaine')}`
      + `${U ? ', et les unités ne changent pas' : ''}. Donc ${f(n)} ${plus ? '+' : '−'} ${f(p.b)} = ${f(r)}.` };
}
def('plusDiz', { from: 0.3, to: 3, w: 0.8, news: [0.3, 1.2], sample: (A, rng) => dizSample(A, rng, true), build: ops => dizBuild(ops, true) });
def('moinsDiz', { from: 0.3, to: 3, w: 0.8, news: [0.3, 1.2], sample: (A, rng) => dizSample(A, rng, false), build: ops => dizBuild(ops, false) });

/* ----- + n < 9 avec passage de la dizaine (47 + 8 = 47 + 3 + 5) ----- */
def('plusPassage', {
  from: 0.45, to: 2, w: 0.9,
  sample(A, rng) {
    const k = rng.int(3, 8);
    const n = withUnits(rng, 12, maxInt(A) - k, u => u >= 2 && u + k >= 11);
    return n === null ? null : `${n}+${k}`;
  },
  build(ops) {
    const p = bin(ops, '+'); if (!p || !isInt(p.a) || p.a < 12 || !(p.b >= 2 && p.b <= 8)) return null;
    const n = p.a, k = p.b, U = n % 10, a = 10 - U, t = n + a, rest = k - a;
    if (U < 2 || rest < 1) return null;
    return { prompt: `${f(n)} + ${k} = ${HOLE}`, answer: n + k, lo: 0.45, nums: [n, n + k], ardoise: [t, n + k],
      hint: 'Va d’abord jusqu’à la dizaine suivante, puis ajoute ce qui reste.',
      explain: `${f(n)} + ${a} = ${f(t)}. Il reste ${rest} à ajouter, car ${k} = ${a} + ${rest}. `
        + `${f(t)} + ${rest} = ${f(n + k)}. Donc ${f(n)} + ${k} = ${f(n + k)}.` };
  }
});

/* ----- dizaines entières − n < 10 par cassage (50 − 6) ----- */
def('dizMoins', {
  from: 0.5, to: 2, w: 0.8,
  sample(A, rng) {
    const D = rng.int(2, Math.floor(maxInt(A) / 10)), k = rng.int(2, 9);
    return `${10 * D}-${k}`;
  },
  build(ops) {
    const p = bin(ops, '-'); if (!p || !isInt(p.a) || p.a % 10 || p.a < 20 || !(p.b >= 1 && p.b <= 9) || !isInt(p.b)) return null;
    const n = p.a, k = p.b, D = n / 10;
    return { prompt: `${f(n)} − ${k} = ${HOLE}`, answer: n - k, lo: 0.5, nums: [n, n - k],
      hint: 'Casse une dizaine : elle vaut 10 unités. Enlève les unités à ces 10.',
      explain: `${f(n)}, c’est ${nb(D, 'dizaine')}. Je casse une dizaine : ${nb(D - 1, 'dizaine')} et 10 unités. `
        + `10 − ${k} = ${10 - k}. Il reste ${du(D - 1, 10 - k)}. Donc ${f(n)} − ${k} = ${f(n - k)}.` };
  }
});

/* ----- ajouter / soustraire un nombre proche d'une dizaine : + 9 = + 10 − 1, + 38 = + 40 − 2… ----- */
const PLUS9 = [[9, 0.55], [19, 1.3], [29, 1.3], [39, 2.2], [49, 4], [59, 4], [69, 4], [79, 4], [89, 4], [99, 4]];
const PLUS8 = [[8, 2.1], [18, 2.2], [28, 2.2], [38, 2.2], [48, 4], [58, 4], [68, 4], [78, 4], [88, 4], [98, 4]];
const MOINS9 = [[9, 1.35], [19, 2.3], [29, 2.3], [39, 2.3], [49, 4], [59, 4], [69, 4], [79, 4], [89, 4], [99, 4]];
const MOINS8 = [[8, 3], [18, 3], [28, 3], [38, 3], [48, 4], [58, 4], [68, 4], [78, 4], [88, 4], [98, 4]];
function nearSample(A, rng, table, plus, gap) {
  const m = pickArrived(rng, A, table); if (m === null) return null;
  const max = maxInt(A);
  if (plus) {
    const n = withUnits(rng, 10, max - m, u => u >= gap + 1 && (plus || u <= 7));
    return n === null ? null : `${upToField(rng, n, max - m, A)}+${m}`;
  }
  const n = withUnits(rng, m + 11, max, u => u <= 9 - gap);
  return n === null ? null : `${upToFieldMinus(rng, n, m, max, gap)}-${m}`;
}
/* varie la taille du nombre de départ (champ de l'année ou un cran en dessous) en gardant ses unités */
function upToField(rng, n, max, A) {
  const big = upTo(rng, max, 2);
  const cand = Math.floor(big / 10) * 10 + (n % 10);
  return cand >= 10 && cand <= max ? cand : n;
}
function upToFieldMinus(rng, n, m, max, gap) {
  const big = upTo(rng, max, 2);
  const cand = Math.floor(big / 10) * 10 + (n % 10);
  return cand >= m + 11 && cand <= max && cand % 10 <= 9 - gap ? cand : n;
}
function nearBuild(ops, table, plus, gap) {
  const p = bin(ops, plus ? '+' : '-');
  if (!p || !isInt(p.a) || !isInt(p.b)) return null;
  const row = table.find(([v]) => v === p.b); if (!row) return null;
  const n = p.a, m = p.b, q = m + gap, r = plus ? n + m : n - m;
  if (n < 10 || r < 1) return null;
  const mid = plus ? n + q : n - q;
  if (mid < 1) return null;
  const sgn = plus ? '+' : '−', back = plus ? '−' : '+';
  return { prompt: `${f(n)} ${sgn} ${f(m)} = ${HOLE}`, answer: r, lo: row[1], nums: [n, mid, r], ardoise: [mid, r],
    hint: plus ? `Pour ajouter ${f(m)}, ajoute ${f(q)}, puis enlève ${gap}.` : `Pour soustraire ${f(m)}, soustrais ${f(q)}, puis ajoute ${gap}.`,
    explain: `${f(n)} ${sgn} ${f(q)} = ${f(mid)}, puis ${f(mid)} ${back} ${gap} = ${f(r)}. Donc ${f(n)} ${sgn} ${f(m)} = ${f(r)}.` };
}
def('plus9', { from: 0.55, to: 5.6, w: 1, news: [0.55, 1.3, 2.2, 4], sample: (A, rng) => nearSample(A, rng, PLUS9, true, 1), build: ops => nearBuild(ops, PLUS9, true, 1) });
def('plus8', { from: 2.1, to: 5.6, w: 0.8, news: [2.1, 2.2, 4], sample: (A, rng) => nearSample(A, rng, PLUS8, true, 2), build: ops => nearBuild(ops, PLUS8, true, 2) });
def('moins9', { from: 1.35, to: 5.6, w: 0.9, news: [1.35, 2.3, 4], sample: (A, rng) => nearSample(A, rng, MOINS9, false, 1), build: ops => nearBuild(ops, MOINS9, false, 1) });
def('moins8', { from: 3, to: 5.6, w: 0.7, news: [3, 4], sample: (A, rng) => nearSample(A, rng, MOINS8, false, 2), build: ops => nearBuild(ops, MOINS8, false, 2) });

/* ----- a + b < 100 : les dizaines entre elles, les unités entre elles (47 + 28 → 60 + 15) ----- */
def('deuxNombres', {
  from: 0.6, to: 2, w: 0.8,
  sample(A, rng) {
    const cap = A < 1 ? 100 : 198;
    for (let i = 0; i < 20; i++) {
      const a = rng.int(11, 89), b = rng.int(11, 89);
      if (a % 10 === 0 || b % 10 === 0 || a + b > cap) continue;
      if (rng.chance(0.6) && (a % 10) + (b % 10) < 10) continue;            /* surtout avec retenue */
      return `${a}+${b}`;
    }
    return null;
  },
  build(ops) {
    const p = bin(ops, '+');
    if (!p || !isInt(p.a) || !isInt(p.b) || p.a < 11 || p.b < 11 || p.a > 99 || p.b > 99 || p.a % 10 === 0 || p.b % 10 === 0) return null;
    const { a, b } = p, da = a - (a % 10), db = b - (b % 10), ua = a % 10, ub = b % 10, s = a + b;
    return { prompt: `${f(a)} + ${f(b)} = ${HOLE}`, answer: s, lo: 0.6, nums: [a, b, s], ardoise: [da + db, ua + ub, s],
      hint: 'Ajoute les dizaines entre elles, puis les unités entre elles, puis ajoute les deux résultats.',
      explain: `${f(da)} + ${f(db)} = ${f(da + db)} et ${ua} + ${ub} = ${ua + ub}. ${f(da + db)} + ${ua + ub} = ${f(s)}. `
        + `Donc ${f(a)} + ${f(b)} = ${f(s)}.` };
  }
});

/* ----- moitié d'un nombre pair par décomposition (46 = 40 + 6 ; 470 = 400 + 70 ; 846 = 800 + 40 + 6) ----- */
const HALF_H = { 1: 1.5, 2: 1.5, 3: 1.5, 4: 1.5, 5: 1.5, 6: 1.5, 8: 2.2 };        /* moitiés de centaines mémorisées */
def('moitie', {
  from: 0.7, to: 3.4, w: 0.7, news: [0.7, 1.5, 2.2],
  sample(A, rng) {
    const opts = [];
    opts.push(() => rng.pick([2, 4, 6, 8]) * 10 + rng.pick([2, 4, 6, 8]));                    /* CP */
    if (A >= 1.5) {
      opts.push(() => rng.pick([3, 5, 7, 9]) * 10 + rng.pick([2, 4, 6, 8]));                  /* 58 = 50 + 8 */
      opts.push(() => rng.pick([1, 2, 3, 4, 5, 6]) * 100 + rng.int(1, 9) * 10);               /* 470 = 400 + 70 */
    }
    if (A >= 2.2) opts.push(() => rng.pick([1, 2, 3, 4, 5, 6, 8]) * 100 + rng.int(1, 9) * 10 + rng.pick([2, 4, 6, 8]));
    return `${rng.pick(opts)()}`;
  },
  build(ops) {
    const n = one(ops); if (n === null || !isInt(n) || n % 2 || n <= 20 || n >= 1000) return null;
    const H = Math.floor(n / 100), Tn = Math.floor((n % 100) / 10), U = n % 10;
    let lo;
    if (n < 100) { if (U === 0) return null; lo = Tn % 2 === 0 ? 0.7 : 1.5; }
    else { if (!HALF_H[H] || Tn === 0) return null; lo = U ? 2.2 : HALF_H[H]; }
    const parts = [H * 100, Tn * 10, U].filter(x => x > 0), halves = parts.map(x => x / 2);
    const said = parts.map((x, i) => `la moitié de ${f(x)} est ${f(halves[i])}`);
    const sentence = said.length === 2 ? `${said[0]} et ${said[1]}` : `${said[0]}, ${said[1]} et ${said[2]}`;
    return { prompt: `moitié de ${f(n)} = ${HOLE}`, answer: n / 2, lo, nums: [n], ardoise: [...halves, n / 2],
      hint: 'Coupe le nombre en morceaux dont tu connais la moitié, puis ajoute les moitiés.',
      explain: `${f(n)} = ${parts.map(f).join(' + ')}. ${sentence[0].toUpperCase()}${sentence.slice(1)}. `
        + `${halves.map(f).join(' + ')} = ${f(n / 2)}. Donc la moitié de ${f(n)} est ${f(n / 2)}.` };
  }
});

/* ----- ± centaines entières (354 + 500 ; 765 − 200) ----- */
function centSample(A, rng, plus) {
  const max = maxInt(A), k = rng.int(1, 9);
  if (plus) {
    if (max - 100 * k < 100) return null;
    return `${upTo(rng, max - 100 * k, 3)}+${100 * k}`;
  }
  if (max < 100 * k + 100) return null;
  return `${rng.int(100 * k + 100, max)}-${100 * k}`;
}
function centBuild(ops, plus) {
  const p = bin(ops, plus ? '+' : '-');
  if (!p || !isInt(p.a) || !isInt(p.b) || p.a < 100 || p.b % 100 || p.b < 100 || p.b > 900) return null;
  const n = p.a, k = p.b / 100, C = Math.floor(n / 100), r = plus ? n + p.b : n - p.b;
  if (!plus && C - k < 1) return null;
  const crossing = n >= 1000 || r > 1000;
  const rest = n % 100;
  return { prompt: `${f(n)} ${plus ? '+' : '−'} ${f(p.b)} = ${HOLE}`, answer: r, lo: crossing ? 2 : 1, nums: [n, r],
    hint: plus ? `Ajouter ${f(p.b)}, c’est ajouter ${nb(k, 'centaine')}.` : `Soustraire ${f(p.b)}, c’est enlever ${nb(k, 'centaine')}.`,
    explain: `${f(n)}, c’est ${nb(C, 'centaine')}${rest ? ` et ${f(rest)}` : ''}. ${nb(C, 'centaine')} ${plus ? '+' : '−'} ${nb(k, 'centaine')} = ${nb(plus ? C + k : C - k, 'centaine')}`
      + `${rest ? `, et ${f(rest)} ne change pas` : ''}. Donc ${f(n)} ${plus ? '+' : '−'} ${f(p.b)} = ${f(r)}.` };
}
def('plusCent', { from: 1, to: 3.6, w: 0.7, sample: (A, rng) => centSample(A, rng, true), build: ops => centBuild(ops, true) });
def('moinsCent', { from: 1, to: 3.6, w: 0.7, sample: (A, rng) => centSample(A, rng, false), build: ops => centBuild(ops, false) });

/* ----- − n < 9 sans changement de dizaine (157 − 5) ; avec passage (523 − 7 = 523 − 3 − 4) ----- */
def('moinsPetit', {
  from: 1.1, to: 2, w: 0.6,
  sample(A, rng) {
    const k = rng.int(2, 8);
    const n = withUnits(rng, 12, maxInt(A), u => u >= k);
    return n === null ? null : `${n}-${k}`;
  },
  build(ops) {
    const p = bin(ops, '-'); if (!p || !isInt(p.a) || p.a < 12 || !(p.b >= 2 && p.b <= 8)) return null;
    const n = p.a, k = p.b, U = n % 10; if (U < k) return null;
    return { prompt: `${f(n)} − ${k} = ${HOLE}`, answer: n - k, lo: 1.1, nums: [n, n - k],
      hint: 'Enlève seulement aux unités : le reste du nombre ne change pas.',
      explain: `${U} − ${k} = ${U - k} : seul le chiffre des unités change. Donc ${f(n)} − ${k} = ${f(n - k)}.` };
  }
});
def('moinsPassage', {
  from: 1.4, to: 2.4, w: 0.9,
  sample(A, rng) {
    const k = rng.int(3, 8);
    const n = withUnits(rng, 21, maxInt(A), u => u >= 1 && u < k);
    return n === null ? null : `${n}-${k}`;
  },
  build(ops) {
    const p = bin(ops, '-'); if (!p || !isInt(p.a) || p.a < 21 || !(p.b >= 2 && p.b <= 8)) return null;
    const n = p.a, k = p.b, U = n % 10; if (U < 1 || U >= k) return null;
    return { prompt: `${f(n)} − ${k} = ${HOLE}`, answer: n - k, lo: 1.4, nums: [n, n - k], ardoise: [n - U, n - k],
      hint: 'Descends d’abord jusqu’à la dizaine juste en dessous, puis enlève ce qui reste.',
      explain: `${f(n)} − ${U} = ${f(n - U)}. Il reste ${k - U} à enlever, car ${k} = ${U} + ${k - U}. `
        + `${f(n - U)} − ${k - U} = ${f(n - k)}. Donc ${f(n)} − ${k} = ${f(n - k)}.` };
  }
});

/* ----- × 10, × 100, × 1 000 d'un entier : chaque chiffre prend une valeur 10 (100, 1 000) fois plus grande ----- */
/* « 7 dizaines deviennent 7 centaines et 2 unités deviennent 2 dizaines » : x × 10^p (p < 0 : x ÷ 10^−p).
   Au-delà de trois chiffres non nuls, on décrit les deux chiffres autour des unités, « et de même pour les autres ». */
function shiftPhrase(x, p) {
  const d = ndec(x), s = String(sc(x, d)), parts = [];
  for (let i = 0; i < s.length; i++) {
    const g = Number(s[i]), r = s.length - 1 - i - d;
    if (g) parts.push({ r, t: `${g} ${rk(r, g)} ${accord(g, 'devient', 'deviennent')} ${g} ${rk(r + p, g)}` });
  }
  if (parts.length <= 3) {
    const t = parts.map(q => q.t);
    return t.length > 1 ? `${t.slice(0, -1).join(', ')} et ${t[t.length - 1]}` : t[0];
  }
  let i = parts.findIndex(q => q.r < 0);                        /* premier chiffre après la virgule */
  i = i < 0 ? parts.length - 2 : Math.max(0, i - 1);
  return `${parts[i].t}, ${parts[i + 1].t}, et de même pour les autres chiffres`;
}
function timesPowSample(A, rng, P, small) {
  const max = Math.floor(maxInt(A) / P);
  if (max < 2) return null;
  const n = Math.max(2, upTo(rng, Math.min(max, small), 1));
  return flip(rng, n, P);
}
function timesPowBuild(ops, P) {
  const q = prod(ops); if (!q) return null;
  const n = q.x === P ? q.y : q.y === P ? q.x : null;
  if (n === null || !isInt(n) || n < 2) return null;
  const p = Math.round(Math.log10(P)), r = n * P;
  const lo = P === 10 ? (n < 100 ? 1.15 : 2) : P === 100 ? 2.1 : 3.2;
  const name = P === 10 ? 'dizaines' : P === 100 ? 'centaines' : 'milliers';
  return { prompt: `${q.expr} = ${HOLE}`, answer: r, lo, nums: [n, r],
    hint: `Multiplier par ${f(P)} : chaque chiffre prend une valeur ${f(P)} fois plus grande. Les unités deviennent des ${name}.`,
    explain: `Chaque chiffre prend une valeur ${f(P)} fois plus grande : ${shiftPhrase(n, p)}. Donc ${q.expr} = ${f(r)}.` };
}
def('fois10', { from: 1.15, to: 3.6, w: 0.7, news: [1.15, 2], sample: (A, rng) => timesPowSample(A, rng, 10, A < 2 ? 99 : 99999), build: ops => timesPowBuild(ops, 10) });
def('fois100', { from: 2.1, to: 3.6, w: 0.6, sample: (A, rng) => timesPowSample(A, rng, 100, A < 3.4 ? 99 : 9999), build: ops => timesPowBuild(ops, 100) });
def('fois1000', { from: 3.2, to: 4.6, w: 0.5, sample: (A, rng) => timesPowSample(A, rng, 1000, 999), build: ops => timesPowBuild(ops, 1000) });

/* ----- distributivité : 13 × 7 = 70 + 21 (CE1), 23 × 7 (CE2), 21 × 35 (CM1), 12 × 42 (CM2), 23 × 34 (avancé) ----- */
const TABLE_FROM = { 1: 1, 2: 1, 5: 1, 10: 1, 3: 1.2, 4: 1.2, 6: 1.2, 7: 1.4, 8: 1.6, 9: 1.8 };
function distriPlan(x, y) {
  /* quel facteur décomposer, et niveau d'arrivée */
  const small = Math.min(x, y), big = Math.max(x, y);
  if (small < 2 || big < 11 || big % 10 === 0) return null;
  if (small < 10) {
    if (big <= 19) {
      const u = big % 10;                                          /* 13 × 7 : 10 × 7 et 3 × 7 connus */
      return { a: big, m: small, lo: Math.max(1.4, Math.min(TABLE_FROM[u], TABLE_FROM[small])) };
    }
    return big <= 99 ? { a: big, m: small, lo: 2.5 } : null;
  }
  if (small % 10 === 0 || big > 99) return null;
  /* CM1, distributivité simple : un facteur « dizaines + 1 » (21 × 35 = 20 × 35 + 35) */
  if (small % 10 === 1 && small <= 51 && big <= 49) return { a: small, m: big, lo: 3.4 };
  if (big % 10 === 1 && big <= 51 && small <= 49) return { a: big, m: small, lo: 3.4 };
  /* CM2 : un facteur de 11 à 19 (12 × 42 = 10 × 42 + 2 × 42), ou « dizaines + 1 » plus grand */
  const in1119 = v => v >= 11 && v <= 19;
  if (in1119(small) || in1119(big)) { const a = in1119(small) ? small : big; return { a, m: a === small ? big : small, lo: 4 }; }
  if (small % 10 === 1) return { a: small, m: big, lo: 4 };
  if (big % 10 === 1) return { a: big, m: small, lo: 4 };
  return { a: small, m: big, lo: 5 };
}
def('distri', {
  from: 1.4, to: 5.6, w: 1, news: [1.4, 2.5, 3.4, 4, 5],
  sample(A, rng) {
    const kinds = [];
    if (A >= 1.4) kinds.push(['ce1', 1]);
    if (A >= 2.5) kinds.push(['ce2', 2]);
    if (A >= 3.4) kinds.push(['cm1', 2]);
    if (A >= 4) kinds.push(['cm2', 2]);
    if (A >= 5) kinds.push(['av', 2]);
    const t = rng.weighted(kinds.map(k => k[0]), kinds.map(k => k[1]));
    let a, m;
    for (let i = 0; i < 20; i++) {
      if (t === 'ce1') { a = rng.int(11, 19); m = rng.int(2, 9); }
      else if (t === 'ce2') { a = withUnits(rng, 21, 99, u => u > 0); m = rng.int(2, 9); }
      else if (t === 'cm1') { a = rng.int(2, 5) * 10 + 1; m = withUnits(rng, 12, 49, u => u > 0); }
      else if (t === 'cm2') { a = rng.int(11, 19); m = withUnits(rng, 21, 99, u => u > 0); }
      else { a = withUnits(rng, 21, 39, u => u >= 2); m = withUnits(rng, 12, 49, u => u >= 2); }
      const plan = distriPlan(a, m);
      if (plan && plan.lo <= A + 1e-9) return flip(rng, a, m);
    }
    return null;
  },
  build(ops) {
    const q = prod(ops); if (!q || !isInt(q.x) || !isInt(q.y)) return null;
    const plan = distriPlan(q.x, q.y); if (!plan) return null;
    const { a, m } = plan, U = a % 10, Tn = a - U, p1 = Tn * m, p2 = U * m, tot = a * m;
    return { prompt: `${q.expr} = ${HOLE}`, answer: tot, lo: plan.lo, nums: [a, m, p1, p2, tot], ardoise: [p1, p2, tot], slow: true,
      hint: `Décompose ${f(a)} en ${f(Tn)} + ${U}, multiplie chaque morceau par ${f(m)}, puis ajoute les deux résultats.`,
      explain: `${f(a)} = ${f(Tn)} + ${U}. ${f(Tn)} × ${f(m)} = ${f(p1)} et ${U} × ${f(m)} = ${f(p2)}. `
        + `${f(p1)} + ${f(p2)} = ${f(tot)}. Donc ${q.expr} = ${f(tot)}.` };
  }
});

/* ----- n < 10 × dizaines (9 × 40), × centaines (9 × 400) ; produits de nombres ronds (900 × 700) ----- */
function roundSample(rng, P) {
  const a = rng.int(2, 9), k = rng.int(2, 9);
  return flip(rng, a, k * P);
}
function roundBuild(ops, P) {
  const q = prod(ops); if (!q || !isInt(q.x) || !isInt(q.y)) return null;
  const a = q.x < 10 ? q.x : q.y < 10 ? q.y : null, b = a === q.x ? q.y : q.x;
  if (a === null || a < 2 || b % P || b / P < 2 || b / P > 9) return null;
  const k = b / P, ak = a * k, r = ak * P;
  return { prompt: `${q.expr} = ${HOLE}`, answer: r, lo: P === 10 ? 2.2 : 3.1, nums: [a, b, r], ardoise: [ak, r],
    hint: `${f(b)}, c’est ${k} × ${f(P)} : multiplie d’abord par ${k}, puis par ${f(P)}.`,
    explain: `${f(b)}, c’est ${k} × ${f(P)}. ${a} × ${k} = ${ak}, puis ${ak} × ${f(P)} = ${f(r)}. Donc ${q.expr} = ${f(r)}.` };
}
def('foisDiz', { from: 2.2, to: 3.6, w: 0.8, sample: (A, rng) => roundSample(rng, 10), build: ops => roundBuild(ops, 10) });
def('foisCent', { from: 3.1, to: 4.4, w: 0.7, sample: (A, rng) => roundSample(rng, 100), build: ops => roundBuild(ops, 100) });
const leadPow = n => { let p = 0; while (n % 10 === 0 && n > 0) { n /= 10; p++; } return { lead: n, p }; };
def('produitRonds', {
  from: 4.1, to: 5.6, w: 0.8,
  sample(A, rng) {
    const max = maxInt(A);
    for (let i = 0; i < 20; i++) {
      const a = rng.int(2, 9), b = rng.int(2, 9), p = rng.int(1, 3), q = rng.int(1, 3);
      if (a * b * POW[p + q] <= max) return `${a * POW[p]}x${b * POW[q]}`;
    }
    return null;
  },
  build(ops) {
    const q = prod(ops); if (!q || !isInt(q.x) || !isInt(q.y)) return null;
    const X = leadPow(q.x), Y = leadPow(q.y);
    if (X.lead < 2 || X.lead > 9 || Y.lead < 2 || Y.lead > 9 || X.p < 1 || Y.p < 1 || X.p > 3 || Y.p > 3) return null;
    const ab = X.lead * Y.lead, P = POW[X.p + Y.p], r = ab * P;
    return { prompt: `${q.expr} = ${HOLE}`, answer: r, lo: 4.1, nums: [q.x, q.y, r], ardoise: [ab, r],
      hint: 'Écris chaque nombre comme un chiffre multiplié par dix, cent ou mille. Multiplie les chiffres avec les tables, puis les nombres ronds entre eux.',
      explain: `${f(q.x)} = ${X.lead} × ${f(POW[X.p])} et ${f(q.y)} = ${Y.lead} × ${f(POW[Y.p])}. `
        + `${X.lead} × ${Y.lead} = ${ab} et ${f(POW[X.p])} × ${f(POW[Y.p])} = ${f(P)}. Donc ${q.expr} = ${ab} × ${f(P)} = ${f(r)}.` };
  }
});

/* ----- × 4 (double du double), × 8 (trois doubles) ----- */
function doublesBuild(ops, k) {
  const q = prod(ops); if (!q || !isInt(q.x) || !isInt(q.y)) return null;
  const n = q.x === k ? q.y : q.y === k ? q.x : null;
  if (n === null || n < 11) return null;
  const seq = [n]; while (seq[seq.length - 1] < n * k) seq.push(seq[seq.length - 1] * 2);
  const lo = k === 4 ? (n <= 99 ? 2.4 : 3) : (n <= 60 ? 2.6 : 3);
  const steps = seq.slice(1).map((v, i) => `${k === 4 ? 'le double' : 'Double'} de ${f(seq[i])}${k === 4 ? ' est' : ' :'} ${f(v)}`);
  const explain = k === 4
    ? `${steps[0][0].toUpperCase()}${steps[0].slice(1)}, et ${steps[1]}. Donc ${q.expr} = ${f(n * k)}.`
    : `${steps.join('. ')}. Donc ${q.expr} = ${f(n * k)}.`;
  return { prompt: `${q.expr} = ${HOLE}`, answer: n * k, lo, nums: [n, n * k], ardoise: seq.slice(1), slow: k === 8,
    hint: k === 4 ? 'Multiplier par 4, c’est prendre le double, puis encore le double.' : 'Multiplier par 8, c’est prendre le double trois fois de suite.',
    explain };
}
def('fois4', { from: 2.4, to: 3.8, w: 0.8, news: [2.4, 3], sample: (A, rng) => flip(rng, A >= 3 && rng.chance(0.4) ? rng.int(100, 250) : withUnits(rng, 11, 99, u => u > 0), 4), build: ops => doublesBuild(ops, 4) });
def('fois8', { from: 2.6, to: 4, w: 0.7, news: [2.6, 3], sample: (A, rng) => flip(rng, A >= 3 && rng.chance(0.4) ? rng.int(61, 125) : withUnits(rng, 11, 60, u => u > 0), 8), build: ops => doublesBuild(ops, 8) });

/* ----- complément à 100, rendu de monnaie (63 + … = 100) ----- */
def('compl100', {
  from: 2.4, to: 3.6, w: 0.7,
  sample: (A, rng) => `${withUnits(rng, 11, 99, u => u > 0)}`,
  build(ops) {
    const n = one(ops); if (n === null || !isInt(n) || n < 11 || n > 99 || n % 10 === 0) return null;
    const U = n % 10, a = 10 - U, t = n + a, r = 100 - n;
    const explain = t === 100
      ? `${U} + ${a} = 10, donc ${f(n)} + ${a} = 100.`
      : `${f(n)} + ${a} = ${f(t)}, puis ${f(t)} + ${f(100 - t)} = 100. En tout, on a ajouté ${a} + ${f(100 - t)} = ${f(r)}. Donc ${f(n)} + ${f(r)} = 100.`;
    return { prompt: `${f(n)} + ${HOLE} = 100`, answer: r, lo: 2.4, nums: [n, 100], ardoise: [t, 100],
      hint: 'Avance d’abord jusqu’à la dizaine suivante, puis jusqu’à 100.', explain };
  }
});

/* ----- × 5 = × 10 puis moitié (entier < 200 au CM1 ; décimal d'au plus trois chiffres au CM2) ----- */
function decimalOf(rng, maxDigits, dmin = 1, dmax = 2) {
  for (let i = 0; i < 20; i++) {
    const d = rng.int(dmin, dmax), N = rng.int(POW[d], POW[maxDigits] - 1);
    if (N % 10) return dv(N, d);
  }
  return null;
}
def('fois5', {
  from: 3.3, to: 5.6, w: 0.9, news: [3.3, 4.3],
  sample(A, rng) {
    const x = A >= 4.3 && rng.chance(0.6) ? decimalOf(rng, 3) : withUnits(rng, 12, 199, u => u > 0);
    return x === null ? null : flip(rng, x, 5);
  },
  build(ops) {
    const q = prod(ops); if (!q) return null;
    const x = q.x === 5 ? q.y : q.y === 5 ? q.x : null;
    if (x === null || x <= 0 || x === 5) return null;
    const d = ndec(x);
    if (d === 0 ? !(isInt(x) && x >= 11 && x < 200) : sc(x, d) > 999 || d > 2) return null;
    const x10 = mulD(x, 10), r = halfD(x10);
    return { prompt: `${q.expr} = ${HOLE}`, answer: r, lo: d ? 4.3 : 3.3, nums: [x, x10, r], ardoise: [x10, r], slow: d > 0,
      hint: 'Multiplier par 5, c’est multiplier par 10, puis prendre la moitié.',
      explain: `10 × ${f(x)} = ${f(x10)} et la moitié de ${f(x10)} est ${f(r)}. Donc ${q.expr} = ${f(r)}.` };
  }
});
def('fois50', {
  from: 4.5, to: 5.6, w: 0.6, news: [4.5, 5],
  sample(A, rng) {
    for (let i = 0; i < 30; i++) {
      const d = A >= 5 ? rng.int(0, 2) : rng.int(0, 1), N = rng.int(2, 999);
      const x = dv(N, d);
      if (x >= 20 || N % 2 || (d > 0 && N % 10 === 0) || x < 1.2 || (d === 0 && x < 4)) continue;
      return flip(rng, x, 50);
    }
    return null;
  },
  build(ops) {
    const q = prod(ops); if (!q) return null;
    const x = q.x === 50 ? q.y : q.y === 50 ? q.x : null;
    if (x === null || x >= 20 || x <= 0) return null;
    const d = ndec(x), N = sc(x, d);
    if (d > 2 || N > 999 || N % 2 || (d > 0 && N % 10 === 0) || (d === 0 && x < 4)) return null;
    const x100 = mulD(x, 100), r = halfD(x100);
    return { prompt: `${q.expr} = ${HOLE}`, answer: r, lo: d === 2 ? 5 : 4.5, nums: [x, x100, r], ardoise: [x100, r], slow: true,
      hint: 'Multiplier par 50, c’est multiplier par 100, puis prendre la moitié.',
      explain: `100 × ${f(x)} = ${f(x100)} et la moitié de ${f(x100)} est ${f(r)}. Donc ${q.expr} = ${f(r)}.` };
  }
});

/* ----- dixièmes, centièmes, millièmes : ajouter / soustraire sans retenue (4,45 + 0,3) ; avec retenue (4,45 + 0,8) ----- */
function decAddSample(A, rng, mode) {
  const md = Math.max(1, maxDec(A));
  for (let i = 0; i < 30; i++) {
    const d = rng.int(1, mode === 'ret' ? Math.min(md, A >= 5 ? 3 : 2) : md);       /* 4,45 + 0,8 : centièmes surtout */
    const ip = upTo(rng, mode === 'ret' && A >= 4.6 ? 999 : 99, 1);
    const x = dv(ip * POW[d] + rng.int(1, POW[d] - 1), d);
    if (sc(x, d) % 10 === 0) continue;
    const ranks = [];
    for (let r = -d; r <= (mode === 'ret' ? 0 : 1); r++) ranks.push(r);
    const r = rng.pick(ranks), dg = digitAt(x, r);
    let k;
    if (mode === 'plus') { if (dg >= 9) continue; k = rng.int(1, 9 - dg); }
    else if (mode === 'moins') { if (dg < 1) continue; k = rng.int(1, dg); }
    else { if (dg < 2 || digitAt(x, r + 1) === 9) continue; k = rng.int(10 - dg, 9); }
    const y = r >= 0 ? k * POW[r] : dv(k, -r);
    if (mode === 'moins' && subD(x, y) <= 0) continue;
    return `${S(x)}${mode === 'moins' ? '-' : '+'}${S(y)}`;
  }
  return null;
}
function decAddBuild(ops, mode) {
  const p = bin(ops, mode === 'moins' ? '-' : '+'); if (!p) return null;
  const { a: x, b: y } = p;
  const dy = ndec(y), Ny = sc(y, dy), k = Ny / POW[nDigits(Ny) - 1];
  if (!isInt(k) || k < 1 || k > 9 || ndec(x) === 0 && mode !== 'ret') return null;
  const r = dy > 0 ? -dy : nDigits(Ny) - 1;
  if (r < -3 || r > 3) return null;
  const dg = digitAt(x, r), res = mode === 'moins' ? subD(x, y) : addD(x, y);
  if (mode === 'plus' && dg + k > 9) return null;
  if (mode === 'moins' && dg < k) return null;
  if (mode === 'ret' && (dg + k < 10 || digitAt(x, r + 1) === 9)) return null;
  const sgn = mode === 'moins' ? '−' : '+';
  const head = `${nbR(dg, r)} ${sgn} ${nbR(k, r)} = ${nbR(mode === 'moins' ? dg - k : dg + k, r)}`;
  const body = mode !== 'ret' ? head
    : dg + k === 10 ? `${head}, c’est 1 ${rk(r + 1, 1)}` : `${head}, c’est 1 ${rk(r + 1, 1)} et ${nbR(dg + k - 10, r)}`;
  return { prompt: `${f(x)} ${sgn} ${f(y)} = ${HOLE}`, answer: res, lo: mode === 'plus' ? 3.3 : mode === 'moins' ? 3.35 : 4.2,
    nums: [x, y, res], slow: true,
    hint: mode === 'ret' ? `Ajoute les ${rk(r)} : 10 ${rk(r)} font 1 ${rk(r + 1, 1)}.` : `Repère le chiffre des ${rk(r)} : c’est le seul qui change.`,
    explain: `${body}. Donc ${f(x)} ${sgn} ${f(y)} = ${f(res)}.` };
}
def('decPlus', { from: 3.3, to: 5.6, w: 0.8, sample: (A, rng) => decAddSample(A, rng, 'plus'), build: ops => decAddBuild(ops, 'plus') });
def('decMoins', { from: 3.35, to: 5.6, w: 0.7, sample: (A, rng) => decAddSample(A, rng, 'moins'), build: ops => decAddBuild(ops, 'moins') });
def('decRetenue', { from: 4.2, to: 5.6, w: 0.7, sample: (A, rng) => decAddSample(A, rng, 'ret'), build: ops => decAddBuild(ops, 'ret') });

/* ----- décimal × et ÷ 10, 100, 1 000 (CM1 : × 10 et ÷ 10 ; CM2 : tous) ----- */
def('decFois', {
  from: 3.3, to: 5.6, w: 0.7, news: [3.3, 4],
  sample(A, rng) {
    const P = A >= 4 ? rng.pick([10, 100, 1000]) : 10;
    const x = decimalOf(rng, A >= 4 ? 4 : 3, 1, Math.max(1, Math.min(maxDec(A), 3)));
    if (x === null || mulD(x, P) > maxInt(A)) return null;
    return flip(rng, x, P);
  },
  build(ops) {
    const q = prod(ops); if (!q) return null;
    const P = [10, 100, 1000].includes(q.y) ? q.y : [10, 100, 1000].includes(q.x) ? q.x : null;
    const x = P === q.y ? q.x : q.y;
    if (P === null || ndec(x) === 0 || x <= 0) return null;
    const r = mulD(x, P);
    return { prompt: `${q.expr} = ${HOLE}`, answer: r, lo: P === 10 ? 3.3 : 4, nums: [x, r], slow: true,
      hint: `Multiplier par ${f(P)} : chaque chiffre prend une valeur ${f(P)} fois plus grande.`,
      explain: `Chaque chiffre prend une valeur ${f(P)} fois plus grande : ${shiftPhrase(x, Math.round(Math.log10(P)))}. Donc ${q.expr} = ${f(r)}.` };
  }
});
def('decDiv', {
  from: 3.4, to: 5.6, w: 0.7, news: [3.4, 4.1],
  sample(A, rng) {
    const P = A >= 4.1 ? rng.pick([10, 100, 1000]) : 10, p = Math.round(Math.log10(P));
    const dmaxIn = Math.min(maxDec(A), 3) - p;                     /* décimales du résultat ≤ programme */
    if (dmaxIn < 0) return null;
    const d = rng.int(0, Math.min(dmaxIn, 2));
    const N = upTo(rng, Math.min(99999, maxInt(A) * POW[d]), 2);
    if (N % 10 === 0) return null;
    return `${S(dv(N, d))}/${P}`;
  },
  build(ops) {
    const p = bin(ops, '/'); if (!p || ![10, 100, 1000].includes(p.b) || p.a <= 0) return null;
    const x = p.a, P = p.b, dx = ndec(x), dr = dx + Math.round(Math.log10(P));
    if (dr > 3 || sc(x, dx) % 10 === 0) return null;
    const r = dv(sc(x, dx), dr);
    return { prompt: `${f(x)} ÷ ${f(P)} = ${HOLE}`, answer: r, lo: P === 10 && dx <= 1 ? 3.4 : 4.1, nums: [x, r], slow: true,
      hint: `Diviser par ${f(P)} : chaque chiffre prend une valeur ${f(P)} fois plus petite.`,
      explain: `Chaque chiffre prend une valeur ${f(P)} fois plus petite : ${shiftPhrase(x, -Math.round(Math.log10(P)))}. Donc ${f(x)} ÷ ${f(P)} = ${f(r)}.` };
  }
});

/* ----- somme de deux décimaux < 10 à une décimale (8,6 + 7,8) ----- */
def('sommeDec', {
  from: 4, to: 5.6, w: 0.9,
  sample(A, rng) {
    const a = dv(rng.int(11, 99), 1);
    const b = rng.chance(0.2) ? rng.int(1, 9) : dv(rng.int(2, 99), 1);
    if (ndec(a) === 0) return null;
    return flip(rng, a, b, '+');
  },
  build(ops) {
    const p = bin(ops, '+'); if (!p || p.a >= 10 || p.b >= 10 || p.a <= 0 || p.b <= 0) return null;
    const { a, b } = p;
    if (ndec(a) > 1 || ndec(b) > 1 || (ndec(a) === 0 && ndec(b) === 0)) return null;
    const ia = Math.floor(a), ib = Math.floor(b), fa = subD(a, ia), fb = subD(b, ib), s = addD(a, b);
    let explain;
    if (fa === 0 || fb === 0) {
      const fr = fa || fb;
      explain = `${f(ia)} + ${f(ib)} = ${f(ia + ib)}, puis ${f(ia + ib)} + ${f(fr)} = ${f(s)}. Donc ${f(a)} + ${f(b)} = ${f(s)}.`;
    } else {
      const sf = addD(fa, fb);
      explain = `${f(ia)} + ${f(ib)} = ${f(ia + ib)} et ${f(fa)} + ${f(fb)} = ${f(sf)}. `
        + `${f(ia + ib)} + ${f(sf)} = ${f(s)}. Donc ${f(a)} + ${f(b)} = ${f(s)}.`;
    }
    return { prompt: `${f(a)} + ${f(b)} = ${HOLE}`, answer: s, lo: 4, nums: [a, b, s], slow: true,
      hint: 'Ajoute les unités entre elles, puis les dixièmes entre eux, puis assemble les deux résultats.', explain };
  }
});

/* ----- double et moitié d'un décimal (13,6 → 27,2 ; 1,22 → 0,61) : on compte en dixièmes ou en centièmes ----- */
function dmBuild(ops, dbl) {
  const x = one(ops); if (x === null || x <= 0) return null;
  const d = ndec(x), N = sc(x, d);
  if (d < 1 || d > 2 || N > 999 || N < 11 || N % 10 === 0 || (!dbl && N % 2)) return null;
  const M = dbl ? 2 * N : N / 2, r = dv(M, d), u = d === 1 ? ['dixième', 'dixièmes'] : ['centième', 'centièmes'];
  return { prompt: `${dbl ? 'double' : 'moitié'} de ${f(x)} = ${HOLE}`, answer: r,
    lo: dbl ? 4.2 : 4.3, nums: [x, r], ardoise: [M, r], slow: true,
    hint: `Compte en ${u[1]} : prends ${dbl ? 'le double' : 'la moitié'} du nombre de ${u[1]}.`,
    explain: `${f(x)}, c’est ${f(N)} ${u[1]}. ${dbl ? 'Le double' : 'La moitié'} de ${f(N)} est ${f(M)} : `
      + `${f(M)} ${pl(M, u[0], u[1])}, c’est ${f(r)}. Donc ${dbl ? 'le double' : 'la moitié'} de ${f(x)} est ${f(r)}.` };
}
def('doubleDec', {
  from: 4.2, to: 5.6, w: 0.6,
  sample: (A, rng) => { const x = decimalOf(rng, 3); return x === null ? null : S(x); },
  build: ops => dmBuild(ops, true)
});
def('moitieDec', {
  from: 4.3, to: 5.6, w: 0.6,
  sample(A, rng) {
    for (let i = 0; i < 20; i++) {
      const d = rng.int(1, 2), N = rng.int(12, 998);
      if (N % 2 || N % 10 === 0 || N < POW[d]) continue;
      return S(dv(N, d));
    }
    return null;
  },
  build: ops => dmBuild(ops, false)
});

/* ----- ÷ 4 et ÷ 8 par moitiés successives (140 ÷ 4 = 35 ; 260 ÷ 8 = 32,5) ----- */
function halvesBuild(ops, k) {
  const p = bin(ops, '/'); if (!p || p.b !== k || !isInt(p.a) || p.a < 20) return null;
  const n = p.a;
  if (k === 4 && n % 2) return null;
  if (k === 8 && n % 4) return null;
  const seq = [n]; for (let i = 0; i < (k === 4 ? 2 : 3); i++) seq.push(halfD(seq[seq.length - 1]));
  const r = seq[seq.length - 1];
  const lo = k === 4 ? (isInt(r) ? 4.2 : 4.4) : (n > 999 || (!isInt(r) && n > 600) ? 5 : 4.4);
  return { prompt: `${f(n)} ÷ ${k} = ${HOLE}`, answer: r, lo, nums: [n, r], ardoise: seq.slice(1), slow: true,
    hint: k === 4 ? 'Diviser par 4, c’est prendre la moitié, puis encore la moitié.' : 'Diviser par 8, c’est prendre la moitié trois fois de suite.',
    explain: `${seq.slice(1).map((v, i) => `Moitié de ${f(seq[i])} : ${f(v)}`).join('. ')}. Donc ${f(n)} ÷ ${k} = ${f(r)}.` };
}
def('div4', { from: 4.2, to: 5.6, w: 0.6, news: [4.2, 4.4], sample: (A, rng) => `${rng.int(10, A >= 4.4 ? 250 : 200) * (A >= 4.4 && rng.chance(0.4) ? 2 : 4)}/4`, build: ops => halvesBuild(ops, 4) });
def('div8', { from: 4.4, to: 5.6, w: 0.5, news: [4.4, 5], sample: (A, rng) => `${rng.int(20, A >= 5 ? 240 : 150) * 4}/8`, build: ops => halvesBuild(ops, 8) });

/* ----- ordres de grandeur (QCM à 4 choix) ----- */
const roundTo = (x, u) => Math.round(x / u) * u;
const lead1 = x => { const p = Math.floor(Math.log10(x)); const P = Math.pow(10, p); return { r: Math.round(x / P) * P, P }; };
function estChoicesMul(E, rng, cap) {
  /* E × 10^j pour 4 exposants consécutifs contenant 0 ; choix entiers, ≤ cap si possible */
  const wins = [];
  for (let s = -3; s <= 0; s++) {
    const vals = [0, 1, 2, 3].map(j => E * Math.pow(10, s + j));
    if (vals.every(v => isInt(Math.round(v * 1e6) / 1e6) && v >= 1)) wins.push(vals.map(v => Math.round(v)));
  }
  const fit = wins.filter(w => w.every(v => v <= cap));
  const pool = fit.length ? fit : wins;
  return pool.length ? (rng ? rng.pick(pool) : pool[0]) : null;
}
function estChoicesAdd(E, u, rng) {
  const wins = [];
  for (let s = -3; s <= 0; s++) { const vals = [0, 1, 2, 3].map(j => E + (s + j) * u); if (vals.every(v => v > 0)) wins.push(vals); }
  return wins.length ? (rng ? rng.pick(wins) : wins[0]) : null;
}
function estimSample(A, rng) {
  const types = [['sum', 1], ['diff', 1], ['prod', 1.2], ['quot', 1]];
  if (A >= 4.2) types.push(['prod32', 2], ['quot5', 1.6]);
  if (A >= 4.4) types.push(['decProd', 1]);
  const t = rng.weighted(types.map(x => x[0]), types.map(x => x[1]));
  const near = (r, d) => { let v; do { v = r + rng.int(-d, d); } while (v === r); return v; };
  const nearRel = r => near(r, Math.max(1, Math.floor(r * 0.08)));     /* écart ≤ 8 % : l'estimation reste sans ambiguïté */
  if (t === 'sum') return [0, 0, 0].map(() => near(rng.int(1, 9) * 100, 15)).join('+');
  if (t === 'diff') { const ra = rng.int(11, 49) * 100, rb = rng.int(1, 9) * 100; return `${near(ra, 15)}-${near(rb, 15)}`; }
  if (t === 'prod') return `${nearRel(rng.int(2, 9) * 10)}x${nearRel(rng.int(2, 9) * 10)}`;
  if (t === 'prod32') return flip(rng, nearRel(rng.int(2, 9) * 100), nearRel(rng.int(2, 9) * 10));
  if (t === 'decProd') {
    const b = dv(nearRel(rng.int(2, 9) * 10000), 1);
    return flip(rng, nearRel(rng.int(2, 9) * 10), b);
  }
  const big = t === 'quot5';
  for (let i = 0; i < 30; i++) {
    const d = rng.int(2, 9), L = rng.int(1, 9), p = big ? rng.int(3, 4) : rng.int(1, 2);
    const base = d * L * POW[p];
    if (big ? base < 10000 || base > 99999 : base < 100 || base > 999) continue;
    const D = base + rng.int(-Math.floor(base * 0.03), Math.floor(base * 0.03));
    if (D === base || nDigits(D) !== nDigits(base)) continue;
    return `${D}/${d}`;
  }
  return null;
}
function estimBuild(ops, rng, A) {
  const cap = maxInt(Math.max(A, 3.5));                          /* distracteurs dans le champ de l'année (au moins CM1) */
  let m;
  if ((m = /^(\d+)\+(\d+)\+(\d+)$/.exec(ops)) || (m = /^(\d+)-(\d+)$/.exec(ops))) {
    const terms = m.slice(1).map(Number), minus = ops.includes('-');
    const R = terms.map(t => roundTo(t, 100));
    if (terms.some((t, i) => Math.abs(t - R[i]) > 15 || R[i] < 100 || t === R[i])) return null;
    const E = minus ? R[0] - R[1] : R.reduce((s, x) => s + x, 0), trueV = minus ? terms[0] - terms[1] : terms.reduce((s, x) => s + x, 0);
    if (E <= 0) return null;
    const ch = estChoicesAdd(E, 100, rng); if (!ch) return null;
    const sym = minus ? ' − ' : ' + ';
    const approx = terms.map((t, i) => `${f(t)} ≈ ${f(R[i])}`);
    const approxTxt = approx.length === 2 ? approx.join(' et ') : `${approx[0]}, ${approx[1]} et ${approx[2]}`;
    return { prompt: `${terms.map(f).join(sym)} ≈ ${HOLE}`, answer: E, choices: ch, lo: 3.5, nums: [...terms, ...ch, trueV], slow: true,
      hint: 'Arrondis chaque nombre à la centaine la plus proche, puis calcule avec ces nombres ronds.',
      explain: `${approxTxt}. ${R.map(f).join(sym)} = ${f(E)}. Donc ${terms.map(f).join(sym)} ≈ ${f(E)}.` };
  }
  if ((m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(ops))) {
    const a = Number(m[1]), b = Number(m[2]);
    const la = lead1(a), lb = lead1(b);
    if (Math.abs(a - la.r) / la.r > 0.1 || Math.abs(b - lb.r) / lb.r > 0.1 || a === la.r || b === lb.r) return null;
    if (la.r < 10 || lb.r < 10) return null;
    const E = la.r * lb.r, ch = estChoicesMul(E, rng, cap); if (!ch) return null;
    const hasDec = ndec(a) + ndec(b) > 0, big = Math.max(a, b) >= 100;
    return { prompt: `${f(a)} × ${f(b)} ≈ ${HOLE}`, answer: E, choices: ch, lo: hasDec ? 4.4 : big ? 4.2 : 3.5,
      nums: [a, b, ...ch, mulExact(a, b)], slow: true,
      hint: 'Arrondis chaque nombre à un nombre rond (un seul chiffre non nul), puis multiplie ces nombres ronds.',
      explain: `${f(a)} ≈ ${f(la.r)} et ${f(b)} ≈ ${f(lb.r)}. ${f(la.r)} × ${f(lb.r)} = ${f(E)}. Donc ${f(a)} × ${f(b)} ≈ ${f(E)}.` };
  }
  if ((m = /^(\d+)\/(\d)$/.exec(ops))) {
    const D = Number(m[1]), d = Number(m[2]);
    if (d < 2) return null;
    const E = lead1(D / d).r;
    if (Math.abs(D / d - E) / E > 0.06 || D === d * E) return null;
    const ch = estChoicesMul(E, rng, cap); if (!ch) return null;
    return { prompt: `${f(D)} ÷ ${d} ≈ ${HOLE}`, answer: E, choices: ch, lo: D >= 1000 ? 4.2 : 3.5, nums: [D, ...ch, d * E], slow: true,
      hint: `Cherche un nombre rond qui, multiplié par ${d}, donne presque ${f(D)}.`,
      explain: `${d} × ${f(E)} = ${f(d * E)}, et ${f(D)} est proche de ${f(d * E)}. Donc ${f(D)} ÷ ${d} ≈ ${f(E)}.` };
  }
  return null;
}
const mulExact = (a, b) => { const da = ndec(a), db = ndec(b); return dv(sc(a, da) * sc(b, db), da + db); };
def('estimation', { from: 3.5, to: 5.6, w: 0.5, news: [3.5, 4.2, 4.4], sample: estimSample, build: estimBuild });

/* ----- calculs avec parenthèses : une paire (CM1), une ou deux paires (CM2) ----- */
/* mini-analyseur : nombres, + - x /, parenthèses → arbre { n } | { op, l, r, par } */
function parseExpr(s) {
  let i = 0;
  const peek = () => s[i];
  function factor() {
    if (peek() === '(') { i++; const e = expr(); if (s[i] !== ')') throw new Error('par'); i++; return { ...e, par: true }; }
    const m = /^\d+/.exec(s.slice(i)); if (!m) throw new Error('num');
    i += m[0].length; return { n: Number(m[0]) };
  }
  function term() { let l = factor(); while (peek() === 'x' || peek() === '/') { const op = s[i++]; l = { op, l, r: factor() }; } return l; }
  function expr() { let l = term(); while (peek() === '+' || peek() === '-') { const op = s[i++]; l = { op, l, r: term() }; } return l; }
  const e = expr(); if (i !== s.length) throw new Error('fin');
  return e;
}
const SYM = { '+': '+', '-': '−', x: '×', '/': '÷' };
const show = (e, top = true) => ('n' in e ? f(e.n) : `${e.par && !top ? '(' : ''}${show(e.l, false)} ${SYM[e.op]} ${show(e.r, false)}${e.par && !top ? ')' : ''}`);
const ascii = e => ('n' in e ? S(e.n) : `${e.par ? '(' : ''}${ascii(e.l)}${e.op}${ascii(e.r)}${e.par ? ')' : ''}`);
function evalSteps(e, steps) {
  if ('n' in e) return e.n;
  const a = evalSteps(e.l, steps), b = evalSteps(e.r, steps);
  let v;
  if (e.op === '+') v = a + b; else if (e.op === '-') v = a - b; else if (e.op === 'x') v = a * b; else v = b ? a / b : NaN;
  if (!isInt(v) || v < 0) throw new Error('val');
  steps.push({ txt: `${f(a)} ${SYM[e.op]} ${f(b)} = ${f(v)}`, leaf: 'n' in e.l && 'n' in e.r, v });
  return v;
}
const countPar = e => ('n' in e ? 0 : (e.par ? 1 : 0) + countPar(e.l) + countPar(e.r));
const depth = e => ('n' in e ? 0 : (e.par ? 1 : 0) + Math.max(depth(e.l), depth(e.r)));
const hasOp = (e, op) => !('n' in e) && (e.op === op || hasOp(e.l, op) || hasOp(e.r, op));
function parSample(A, rng) {
  const P = (op, l, r) => ({ op, l, r, par: true }), O = (op, l, r) => ({ op, l, r }), n = v => ({ n: v });
  const t2 = () => rng.int(2, 9);
  const tiers = [['one', 1]];
  if (A >= 4.5) tiers.push(['two', 2]);
  if (A >= 5) tiers.push(['adv', 2]);
  const tier = rng.weighted(tiers.map(x => x[0]), tiers.map(x => x[1]));
  const one = [
    () => { const c = rng.int(1, 9), b = c + t2(); return O('x', n(t2()), P('-', n(b), n(c))); },
    () => { const b = rng.int(1, 8); return O('x', n(t2()), P('+', n(b), n(rng.int(1, 10 - b)))); },
    () => { const a = rng.int(2, 8); return O('x', P('+', n(a), n(rng.int(1, 10 - a))), n(t2())); },
    () => { const b = rng.int(1, 9); return O('x', P('-', n(b + t2()), n(b)), n(t2())); },
    () => { const b = t2(), c = t2(); return O('-', n(b * c + rng.int(1, 30)), P('x', n(b), n(c))); },
    () => O('+', n(rng.int(1, 50)), P('x', n(t2()), n(t2()))),
    () => { const b = rng.int(2, 15), c = rng.int(2, 15); return O('-', n(b + c + rng.int(1, 30)), P('+', n(b), n(c))); }
  ];
  const two = [
    () => { const b = rng.int(1, 9); const d = rng.int(1, 8); return O('x', P('-', n(b + t2()), n(b)), P('+', n(rng.int(1, 10 - d)), n(d))); },
    () => { const a = rng.int(2, 8); const d = rng.int(1, 9); return O('x', P('+', n(a), n(rng.int(1, 10 - a))), P('-', n(d + t2()), n(d))); },
    () => { const a = t2(), b = t2(), c = t2(), d = t2(); return a * b >= c * d + 1 ? O('-', P('x', n(a), n(b)), P('x', n(c), n(d))) : O('-', P('x', n(c), n(d)), P('x', n(a), n(b))); },
    () => O('+', P('x', n(t2()), n(t2())), P('x', n(t2()), n(t2()))),
    () => { const d = rng.int(1, 9), c = d + t2(), b = t2(); return O('-', n(b * (c - d) + rng.int(1, 30)), P('x', n(b), P('-', n(c), n(d)))); }
  ];
  const adv = [
    () => { const b = t2(), q = t2(), d = rng.int(1, 8); return O('x', P('/', n(b * q), n(b)), P('+', n(rng.int(1, 10 - d)), n(d))); },
    () => { const b = rng.int(2, 9), c = rng.int(1, 6), d = t2(); const v = (b + c) * d; return O('-', n(v + rng.int(1, 60)), P('x', P('+', n(b), n(c)), n(d))); },
    () => { const a = rng.int(5, 20), b = rng.int(1, 4); const c = t2(); return O('+', P('x', P('-', n(a), n(b)), n(c)), n(rng.int(1, 40))); },
    () => { const d = t2(), q = t2(), a = rng.int(2, 9); return O('x', P('-', n(a + t2()), n(a)), P('/', n(d * q), n(d))); }
  ];
  const pool = tier === 'one' ? one : tier === 'two' ? two : adv;
  return ascii(rng.pick(pool)());
}
function parBuild(ops) {
  let e;
  try { e = parseExpr(ops); } catch (_) { return null; }
  if ('n' in e) return null;
  const pairs = countPar(e); if (pairs < 1 || pairs > 2) return null;
  const steps = [];
  let v;
  try { v = evalSteps(e, steps); } catch (_) { return null; }
  if (steps.length < 2 || steps.length > 3) return null;
  const leaf = steps.filter(s => s.leaf), rest = steps.filter(s => !s.leaf);
  const first = leaf.map(s => s.txt).join(' et ');
  const txt = [`D’abord ${first}.`, ...rest.map(s => `Puis ${s.txt}.`)].join(' ');
  const expr = show(e);
  const lo = pairs === 1 ? 3.6 : (hasOp(e, '/') || steps.length > 3 || steps.some(s => s.v > 100) ? 5 : 4.5);
  const nested = depth(e) > 1;
  return { prompt: `${expr} = ${HOLE}`, answer: v, lo: hasOp(e, '/') ? 5 : lo, nums: [v, ...steps.map(s => s.v)], ardoise: steps.map(s => s.v), slow: true,
    hint: pairs === 1 ? 'Calcule d’abord ce qui est entre parenthèses.'
      : nested ? 'Calcule d’abord la parenthèse la plus à l’intérieur, puis l’autre.' : 'Calcule d’abord chaque parenthèse, puis fais le dernier calcul.',
    explain: `${txt} Donc ${expr} = ${f(v)}.` };
}
def('parentheses', { from: 3.6, to: 5.6, w: 0.4, news: [3.6, 4.5, 5], sample: parSample, build: parBuild });

/* ========== TIRAGE ========== */
export const KINDS = Object.keys(DEF);

function kindWeight(d, A) {
  if (A < d.from - 1e-9 || A > d.to + 1e-9) return 0;
  let w = d.w;
  const pal = Math.floor(Math.min(A, 4.999));
  if (d.news.some(x => x <= A + 1e-9 && x >= pal - 1e-9)) w *= 1.6;          /* du nouveau dans l'année en cours */
  if (A >= 5) { if (d.kind === 'parentheses') w *= 3; else if (d.kind === 'estimation') w *= 1.5; }
  return w;
}
function pickKind(A, rng) {
  const ks = KINDS.filter(k => kindWeight(DEF[k], A) > 0);
  return rng.weighted(ks, ks.map(k => kindWeight(DEF[k], A)));
}

/* niveau réel d'un cœur d'item : arrivée de la procédure, champ numérique, décimales */
function levelOf(core) {
  let lo = core.lo;
  for (const x of core.nums) {
    if (!Number.isFinite(x)) return Infinity;
    lo = Math.max(lo, fieldLevel(x), decLevel(ndec(x)));
  }
  return lo;
}

function makeItem(kind, ops, A, rng) {
  const d = DEF[kind]; if (!d) return null;
  let core;
  try { core = d.build(ops, rng, A); } catch (_) { core = null; }
  if (!core || !Number.isFinite(core.answer)) return null;
  const lo = levelOf(core);
  if (!Number.isFinite(lo)) return null;
  const dec = ndec(core.answer);
  const slow = core.slow || dec > 0 || core.nums.some(x => ndec(x) > 0);
  const item = {
    axis, kind, key: `${axis}:${kind}:${ops}`,
    A: r2(clamp(A, lo, lo + SPAN)),
    prompt: core.prompt,
    answer: core.answer,
    hint: T(core.hint),
    explain: T(core.explain),
    autoMs: slow ? AUTO_SLOW : AUTO,
    leitner: false,
    data: { strategy: kind, decimals: dec, ardoise: (core.ardoise || []).map(f) }
  };
  if (core.choices) {
    const ch = rng ? rng.shuffle(core.choices) : core.choices.slice();
    item.choices = ch.map(v => ({ label: f(v), value: v }));
  }
  return { item, lo };
}

export function gen(A, rng, opts = {}) {
  const a = clampA(A);
  const o = opts && typeof opts === 'object' ? opts : {};
  const avoid = toSet(o.avoid);
  const forced = o.kind && DEF[o.kind] ? o.kind : null;
  let last = null;
  for (let i = 0; i < TRIES; i++) {
    const kind = forced || pickKind(a, rng);
    const d = DEF[kind];
    const aa = forced ? Math.max(a, d.from) : a;
    let ops = null;
    try { ops = d.sample(aa, rng); } catch (_) { ops = null; }
    if (!ops) continue;
    const res = makeItem(kind, ops, aa, rng);
    if (!res || res.lo > aa + 1e-9) continue;              /* hors programme à ce niveau : autre tirage */
    last = res.item;
    if (!avoid.has(res.item.key)) return res.item;
  }
  if (last) return last;
  /* filet de sécurité (jamais atteint en pratique) */
  const n = Math.min(maxInt(a) - 1, 9);
  return makeItem('plus1', `${Math.max(1, n)}+1`, a, rng).item;
}

export function fromKey(key, A, rng) {
  const m = /^ma\.procedures:([A-Za-z0-9]+):(.+)$/.exec(String(key || ''));
  if (!m || !DEF[m[1]]) return null;
  const res = makeItem(m[1], m[2], clampA(A), rng || makeRng(String(key)));
  return res && res.item.key === key ? res.item : null;
}
