/* ============ FAITS NUMÉRIQUES — axe 'ma.faits' · jeu « Le Galop des tables » ============
   Module pur (aucun DOM). Contrat : docs/ARCHITECTURE.md §6 (générateurs), §5.5 (Leitner) ;
   mise en scène : docs/JEUX.md §4 (réponse au pavé ou à la voix).
   gen(A, rng, opts) → item, déterministe pour (A, graine), pour tout A ∈ [0 ; 5,6] (core/levels.js).
   fromKey(key, A, rng) → le même fait (même clé), présenté selon A.

   ---------- PALIERS (A → contenu) ----------
   Sources : programme du cycle 2, BO n°41 du 31/10/2024 (faits CP p. 100, CE1 p. 108, CE2 p. 116),
   livret d'accompagnement CE1 2025 (ordre des tables) ; programme du cycle 3, BO n°16 du 17/04/2025 +
   Exemples de réussite CM1/CM2 ; formats : Repères 2026 (« 6 × 7 = … », « 7 × … = 56 », « … × 9 = 81 »).
   Synthèse : rapports de recherche du 02/10/2026 (maths-c2 §2.4, §3.4, §4.4, §10 ; maths-c3 §4, §8).
   | A          | contenu (s'ajoute aux paliers précédents)                                                  |
   |------------|--------------------------------------------------------------------------------------------|
   | 0 – 1      | CP : tables d'addition a + b (0 ≤ a, b ≤ 10 ; « + 0 » rare) en égalités à trou, deux sens  |
   |            |   (« 5 + 3 = … », « 4 + … = 12 », « 10 = 7 + … ») : sommes ≤ 9, puis ≤ 13 (0,3), toutes (0,6) ;|
   |            |   compléments à 10 ; doubles 1-5, 6-10 (0,2), 20-50 (0,6) ; moitiés 2-10 (0,1), 12-20 (0,4), |
   |            |   40-100 (0,7). JAMAIS de signe − (BO : pas dans les faits mémorisés)                       |
   | 1 – 2      | CE1 : tables de × étalées sur l'année (livret) : 1, 2, 5, 10 (1) ; + 3, 4, 6 (1,2) ;         |
   |            |   + 7 (1,4) ; + 8 (1,6) ; + 9 (1,8) ; facteur manquant dès 1,5 (BO « dans les deux sens ») ; |
   |            |   multiples de 25 (1,5) ; doubles 11-15, 25-45, 100-500 ; moitiés 22-30, 50-90, 200-1 000    |
   | 2 – 3      | CE2 : toutes les tables dans les deux sens ; décompositions de 60 (… × 12 = 60) dès 2,3 ;    |
   |            |   doubles 16-20, 60, 75, 400, 600 ; moitiés 32-40, 120, 150, 800, 1 200                     |
   | 3 – 4      | CM1 : + quotients associés (56 ÷ 8 = …) ; entier × 10, 100, 1 000 (≤ 9 999 avant 3,4,         |
   |            |   ≤ 999 999 ensuite) ; dès 3,3 : décimal × 10 et ÷ 10 (au plus 2 décimales)                  |
   | 4 – 5,6    | CM2 : + moitiés des impairs ≤ 15 (moitié de 9 = 4,5) ; décimal × et ÷ 10, 100, 1 000         |
   |            |   (au plus 3 décimales) ; au-delà de 5 : même contenu, faits difficiles encore plus fréquents|
   Pondération : la part des faits difficiles (6-9 × 6-9 : 7 × 8, 6 × 7, 8 × 9…) croît avec A
   (poids × (1 + 8 k h), h = difficulté du fait ∈ [0 ; 1], k = 0 à A = 1,8 → 1 à A = 4) : environ 30 %
   des produits à A = 2, 46 % à A = 4,5 ; une table qui vient d'arriver est favorisée ; × 0, × 1, × 10
   deux fois moins fréquents au CM.
   Facteurs 0 (« 7 × 0 ») rares et seulement en produit (jamais « 0 × … = 0 », ambigu).

   ---------- ITEM ----------
   { axis: 'ma.faits', kind, key, A, prompt, answer (nombre), hint, explain, autoMs, leitner, data }
   kind   : 'add' | 'c10' | 'double' | 'moitie' | 'mul' | 'facteur' | 'div' | 'p10' (× ou ÷ 10/100/1 000)
   prompt : '7 × 8 = …', '7 × … = 56', '… × 9 = 81', '56 = 7 × …', '56 ÷ 8 = …', '7 + … = 10',
            '10 = 7 + …', 'double de 8', 'moitié de 16', '3,5 × 100 = …' (nombres fmtNum, « … » = U+2026)
   key (Leitner, même fait = même clé quelle que soit la présentation) :
            'ma.faits:7x8' (facteurs triés, mul/facteur/div ; aussi '3x25', '5x12', '0x7'),
            'ma.faits:add:7+8' (termes triés ; une somme égale à 10 est un complément : c10),
            'ma.faits:c10:3' (le plus petit des deux : 3 + 7 = 10), 'ma.faits:dbl:8', 'ma.faits:half:16',
            'ma.faits:p10:3.5x100' / 'ma.faits:p10:4200/100' (nombres JS ; p10 hors Leitner)
   leitner: true sauf p10 ; autoMs : 3000 (faits), 4000 (p10 entiers), 5000 (réponse ou opérande décimal)
   item.A = niveau réel du fait : A demandé, borné à [niveau d'apparition ; plafond de difficulté du fait]
   data = {
     voice,            // true si la réponse est un entier ≤ 1 000 (réponse à la voix possible)
     op,               // '+' | '×' | '÷' | 'double' | 'moitié'
     a, b, c,          // l'égalité vraie « a op b = c » (double/moitié : a = n, b = null, c = résultat ;
                       //   division : a = dividende, b = diviseur, c = quotient ; p10 : a op b = c)
     hole,             // terme caché, affiché « … » : 'a' | 'b' | 'c' ; answer = data[hole]
     reversed          // true : écrite « c = a op b » (format BO « 10 = 7 + … »)
   }
   opts : avoid (Set de clés), kind (sous-type imposé ; s'il n'existe pas encore à ce niveau, l'item est
          pris au premier niveau où il existe, et item.A le dit).
   describeKey(key) → '7 × 8 = 56' (écriture lisible d'une clé, pour l'espace parents « à revoir »).
   Calendrier (js/content/calendar.js, v2.5) : item.notion = la notion la plus récente du fait (table de 7, facteur
   manquant, doubles du CE1…), item.notions = toutes ses notions ; notionOfKey(clé Leitner) → notion de la clé.
   Un produit appartient à la première table où il s'apprend (7 × 8 : table de 7 ; à égalité, le plus grand facteur
   autre que 1 et 10 : 2 × 5 → table de 5). */

import { fmtNum, frTypo } from '../../core/util.js';

export const axis = 'ma.faits';
export const KINDS = ['add', 'c10', 'double', 'moitie', 'mul', 'facteur', 'div', 'p10'];

const A_TOP = 5.6, TRIES = 12;
const AUTO_FACT = 3000, AUTO_P10 = 4000, AUTO_DEC = 5000;
const KIND_FROM = { add: 0, c10: 0, double: 0, moitie: 0.1, mul: 1, facteur: 1.5, div: 3, p10: 3 };
const HOLE = '…';

const clampA = A => { const a = Number(A); return Math.min(A_TOP, Math.max(0, Number.isFinite(a) ? a : 0)); };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r3 = x => Math.round(x * 1000) / 1000;
const f = n => fmtNum(n);
const toSet = v => (v instanceof Set ? v : new Set(Array.isArray(v) ? v : []));
const isInt = n => Number.isInteger(n);

/* ========== FAITS DISPONIBLES ========== */
/* tables de multiplication : niveau d'arrivée (livret CE1 : 1-6 et 10 en P1-P2, 7 en P3, 8 en P4, toutes en P5) */
const TABLE_FROM = { 1: 1, 2: 1, 5: 1, 10: 1, 3: 1.2, 4: 1.2, 6: 1.2, 7: 1.4, 8: 1.6, 9: 1.8 };
const DECOMP60 = [[1, 60], [2, 30], [3, 20], [4, 15], [5, 12]];       /* (6, 10) est déjà dans les tables */
const M25 = [[1, 25], [2, 25], [3, 25], [4, 25]];

/* fait multiplicatif {x ≤ y} : niveau d'apparition, difficulté h ∈ [0 ; 1], poids de base */
function mulInfo(x, y) {
  if (y === 25) return { lo: 1.5, h: 0.3, base: x === 1 ? 0.4 : 1 };
  if (y > 10) return { lo: 2.3, h: x === 1 ? 0 : 0.3, base: x === 1 ? 0.3 : 1 };
  if (x === 0) return { lo: 1.2, h: 0, base: 0.12 };
  const lo = Math.min(TABLE_FROM[x], TABLE_FROM[y]);
  let h, base = 1;
  if (x === 1 || y === 10) { h = 0; base = x === 1 ? 0.35 : 0.6; }
  else if (x === 2 || x === 5 || y === 5) h = 0.1;
  else if (x <= 4) h = 0.35;
  else h = 1;
  return { lo, h, base };
}
function mulFacts(A) {
  const out = [];
  for (let x = 0; x <= 10; x++) for (let y = Math.max(1, x); y <= 10; y++) {
    const info = mulInfo(x, y);
    if (A >= info.lo - 1e-9) out.push({ x, y, ...info });
  }
  for (const [x, y] of [...M25, ...DECOMP60]) { const info = mulInfo(x, y); if (A >= info.lo - 1e-9) out.push({ x, y, ...info }); }
  return out;
}
const mulCap = (fact, form) => Math.min(A_TOP, 2 + 3.6 * fact.h + (form === 'facteur' ? 0.4 : form === 'div' ? 0.8 : 0));
function mulWeight(fact, A) {
  const k = clamp((A - 1.8) / 2.2, 0, 1);                               /* 0 quand toutes les tables arrivent → 1 au CM1 */
  const fresh = A - fact.lo < 0.25 && fact.lo >= 1.2 ? 2 : 1;           /* table qui vient d'arriver */
  const trivial = fact.h === 0 && A >= 3 ? 0.5 : 1;                     /* × 0, × 1, × 10 : moins souvent au CM */
  const easy = A >= 3 && mulCap(fact, 'mul') < A - 0.6 ? 0.15 : 1;      /* fait bien sous le niveau demandé (revue D2-02) */
  return fact.base * (1 + 8 * k * fact.h) * fresh * trivial * easy;
}

/* additions a + b (a, b de 0 à 10 ; somme 10 → complément c10 ; « + 0 » rare, dès 0,3) */
function addInfo(a, b) {
  const s = a + b, big = Math.max(a, b);
  if (Math.min(a, b) === 0) return { lo: 0.3, cap: 1 };
  const lo = s <= 9 ? 0 : s <= 13 && big <= 9 ? 0.3 : 0.6;
  return { lo, cap: s <= 10 ? 1.5 : 2.5 };
}
function addFacts(A) {
  const out = [];
  for (let a = 0; a <= 10; a++) for (let b = Math.max(a, 1); b <= 10; b++) {
    if (a + b === 10) continue;
    const info = addInfo(a, b);
    if (A < info.lo - 1e-9) continue;
    let w = 1;
    if (a === b) w = 0.6;                                   /* doubles : aussi entraînés à part */
    if (a === 1 || b === 10) w = 0.5;
    if (a === 0) w = 0.15;
    if (a + b > 10) w *= 1 + clamp(A - 0.6, 0, 1.4);        /* passage de la dizaine, de plus en plus présent */
    out.push({ a, b, w, ...info });
  }
  return out;
}
/* doubles et moitiés (listes du BO, par niveau d'arrivée) */
const DOUBLES = [
  [0, [1, 2, 3, 4, 5]], [0.2, [6, 7, 8, 9, 10]], [0.6, [20, 30, 40, 50]],
  [1, [11, 12, 13, 14, 15]], [1.2, [25, 35, 45]], [1.5, [100, 200, 300, 500]], [1.7, [150, 250]],
  [2, [16, 17, 18, 19]], [2.2, [60, 75, 400, 600]]
];
const HALVES = [
  [0.1, [2, 4, 6, 8, 10]], [0.4, [12, 14, 16, 18, 20]], [0.7, [40, 60, 80, 100]],
  [1.1, [22, 24, 26, 28, 30]], [1.3, [50, 70, 90]], [1.5, [200, 400, 600, 1000]], [1.7, [300, 500]],
  [2, [32, 34, 36, 38]], [2.2, [120, 150, 800, 1200]], [4, [1, 3, 5, 7, 9, 11, 13, 15]]
];
function listAt(LIST, A) {
  const out = [];
  for (const [lo, ns] of LIST) if (A >= lo - 1e-9) for (const n of ns) out.push({ n, lo, cap: lo === 4 ? A_TOP : lo + 1.5 });
  return out;
}
const levelIn = (LIST, n) => { for (const [lo, ns] of LIST) if (ns.includes(n)) return lo; return null; };
const dblWeight = (d, A) => (A - d.lo < 0.5 ? 2 : 1) * (d.n <= 3 && A >= 1 ? 0.3 : 1);

/* ========== PRÉSENTATIONS ========== */
/* mul / facteur / div selon A (BO CE1 : « dans les deux sens » = facteur manquant ; ÷ comme fait : CM1) */
function mulForms(A) {
  if (A < 1.5) return { mul: 1 };
  if (A < 2) return { mul: 0.8, facteur: 0.2 };
  if (A < 3) return { mul: 0.55, facteur: 0.45 };
  return { mul: 0.35, facteur: 0.33, div: 0.32 };
}
function addForms(A) {
  if (A < 0.3) return { sum: 0.7, b: 0.3 };
  if (A < 2) return { sum: 0.4, b: 0.3, a: 0.15, left: 0.15 };
  return { sum: 0.3, b: 0.3, a: 0.2, left: 0.2 };
}
const pickW = (rng, obj) => { const ks = Object.keys(obj); return rng.weighted(ks, ks.map(k => obj[k])); };

/* ========== TEXTES ========== */
const countBy = (step, upto) => { const out = []; for (let v = step; v <= upto; v += step) out.push(f(v)); return out.join(', '); };
/* « 7, 8, 9 » : on avance de 1 en 1 de from (exclu) à to (inclus) */
const countUp = (from, to) => { const out = []; for (let v = from + 1; v <= to; v++) out.push(f(v)); return out.join(', '); };

/* stratégie d'un produit n × t (t = « la table » utilisée, n = l'autre facteur) */
function mulStrategy(x, y) {
  if (x === 0) return { t: 0, n: y };
  if (y > 10 && y !== 25 && x > 2) return { t: y, n: x };           /* 3 × 20, 4 × 15, 5 × 12 : décomposer */
  if (y === 25) return { t: 25, n: x };
  const order = [1, 10, 2, 5, 9, 4, 3, 8, 6, 7];
  for (const t of order) if (x === t || y === t) return { t, n: x === t ? y : x };
  return { t: y, n: x };
}
function mulHint(x, y) {
  const { t, n } = mulStrategy(x, y);
  switch (t) {
    case 0: return `Imagine ${n} paquets vides : combien d’objets en tout ?`;
    case 1: return 'Multiplier par 1 ne change pas le nombre.';
    case 10: return `× 10 : les unités deviennent des dizaines.`;
    case 2: return `× 2, c’est le double : ${n} + ${n}.`;
    case 5: return `× 5, c’est la moitié de × 10 : calcule ${n} × 10, puis prends la moitié.`;
    case 9: return `× 9, c’est × 10 moins une fois : calcule ${n} × 10, puis enlève ${n}.`;
    case 4: return `× 4, c’est le double du double : double ${n}, puis double encore.`;
    case 3: return `× 3, c’est ${n} + ${n} + ${n} : le double de ${n}, plus ${n}.`;
    case 8: return `× 8, c’est le double de × 4 : calcule ${n} × 4, puis double.`;
    case 6: return `× 6, c’est × 5 plus une fois : calcule ${n} × 5, puis ajoute ${n}.`;
    case 7: return '7 × 7, c’est 7 × 5 plus 7 × 2.';
    case 25: return 'Compte de 25 en 25 sur tes doigts : un doigt pour chaque 25.';
    case 20: case 30: case 60: return `${n} × ${t}, c’est ${n} × ${t / 10} dizaines.`;
    default: return `Décompose ${t} en 10 + ${t - 10} : calcule ${n} × 10 et ${n} × ${t - 10}.`;
  }
}
/* explication : « 7 × 8 = 56 : 7 × 4 = 28, et le double de 28 est 56. » (a × b dans l'ordre affiché) */
function mulExplain(a, b) {
  const x = Math.min(a, b), y = Math.max(a, b), p = a * b;
  const { t, n } = mulStrategy(x, y);
  const eq = `${a} × ${b} = ${f(p)}`;
  switch (t) {
    case 0: return `${eq} : ${a === 0 ? `0 fois ${b}, c’est 0` : `${a} paquets de 0 objet, cela fait 0 objet`}.`;
    case 1: return `${eq} : 1 fois ${n}, c’est ${n}.`;
    case 10: return `${eq} : ${n} fois 10, c’est ${n} ${n > 1 ? 'dizaines' : 'dizaine'}.`;
    case 2: return `${eq} : c’est le double de ${f(n)}, car ${f(n)} + ${f(n)} = ${f(p)}.`;
    case 5: return `${eq} : ${n} × 10 = ${f(10 * n)}, et la moitié de ${f(10 * n)} est ${f(p)}.`;
    case 9: return `${eq} : ${n} × 10 = ${f(10 * n)}, puis ${f(10 * n)} − ${n} = ${f(p)}.`
      + (n >= 2 && p >= 10 ? ` Astuce : dans la table de 9, les chiffres du résultat font 9 (${String(p).split('').join(' + ')} = 9).` : '');
    case 4: return `${eq} : le double de ${n} est ${2 * n}, et le double de ${2 * n} est ${f(p)}.`
      + (p === 12 ? ' Astuce : 1, 2, 3, 4 → 12 = 3 × 4.' : '');
    case 3: return `${eq} : ${n} + ${n} + ${n} = ${f(p)}.`;
    case 8: return `${eq} : ${n} × 4 = ${4 * n}, et le double de ${4 * n} est ${f(p)}.`
      + (p === 56 ? ' Astuce : 5, 6, 7, 8 → 56 = 7 × 8.' : '');
    case 6: return `${eq} : ${n} × 5 = ${5 * n}, puis ${5 * n} + ${n} = ${f(p)}.`;
    case 7: return `${eq} : 7 × 5 = 35 et 7 × 2 = 14, puis 35 + 14 = 49.`;
    case 25: return n === 1 ? `${eq} : une fois 25, c’est 25.` : `${eq} : ${countBy(25, p)}. ${n} fois 25, c’est ${f(p)}.`;
    case 20: case 30: case 60: return `${eq} : ${n} × ${t / 10} = ${n * t / 10}, et ${n * t / 10} dizaines font ${f(p)}.`;
    default: return `${eq} : ${n} × 10 = ${10 * n} et ${n} × ${t - 10} = ${n * (t - 10)}, puis ${10 * n} + ${n * (t - 10)} = ${f(p)}.`;
  }
}
/* facteur manquant : le facteur connu k, le produit p */
function facteurHint(k, p, ans) {
  if (k === 1) return 'Multiplier par 1 ne change pas le nombre.';
  if (k === 10) return `Combien de dizaines y a-t-il dans ${f(p)} ?`;
  if (ans === 1) return `Combien de fois ${k} faut-il pour faire ${f(p)} ?`;
  if (ans > 10) return `Partage ${f(p)} en ${k} parts égales : combien dans chaque part ?`;
  if (k > 10) return `Compte de ${k} en ${k} jusqu’à ${f(p)}.`;
  return `Combien de fois ${k} pour faire ${f(p)} ? Récite la table de ${k} jusqu’à ${f(p)}.`;
}
function facteurExplain(eqText, k, p, ans) {
  const head = `${eqText}, donc le nombre qui manque est ${f(ans)}.`;
  if (k === 1) return `${head} Multiplier par 1 ne change pas le nombre.`;
  if (k === 10) return `${head} ${f(p)}, c’est ${ans} ${ans > 1 ? 'dizaines' : 'dizaine'}.`;
  if (ans === 1) return `${head} Une fois ${k}, c’est ${k}.`;
  if (ans > 10) return `${head} ${k} fois ${ans} : ${countBy(ans, p)}.`;
  const tip = p === 56 ? ' Astuce : 5, 6, 7, 8 → 56 = 7 × 8.' : '';
  return `${head} Compte de ${k} en ${k} : ${countBy(k, p)}.${tip}`;
}
/* additions */
function addHintSum(a, b) {
  const s = a + b, big = Math.max(a, b), small = Math.min(a, b);
  if (small === 0) return 'Ajouter 0 ne change pas le nombre.';
  if (a === b) return `C’est un double : le double de ${a}.`;
  if (big - small === 1) return `${small} + ${big}, c’est le double de ${small}, plus 1.`;
  if (big === 10) return 'Ajouter 10, c’est ajouter une dizaine.';
  if (big === 9 && small >= 2) return 'Pour ajouter 9, ajoute 10 puis enlève 1.';
  if (s > 10) return `Passe par 10 : complète d’abord ${big} jusqu’à 10.`;
  if (small === 1) return `Ajouter 1, c’est trouver le nombre qui vient juste après ${big}.`;
  return `Pars du plus grand nombre, ${big}, et avance de ${small}.`;
}
function addExplainSum(a, b) {
  const s = a + b, big = Math.max(a, b), small = Math.min(a, b), eq = `${a} + ${b} = ${s}`;
  if (small === 0) return `${eq} : ajouter 0 ne change rien.`;
  if (a === b) return `${eq} : c’est le double de ${a}.`;
  if (big - small === 1) return `${eq} : ${small} + ${small} = ${2 * small}, puis ${2 * small} + 1 = ${s}.`;
  if (big === 10) return `${eq} : une dizaine et ${small} ${small > 1 ? 'unités' : 'unité'}, cela fait ${s}.`;
  if (big === 9 && small >= 2) return `${eq} : ${small} + 10 = ${small + 10}, puis ${small + 10} − 1 = ${s}.`;
  if (s > 10) return `${eq} : ${big} + ${10 - big} = 10, puis 10 + ${s - 10} = ${s}.`;
  if (small === 1) return `${eq} : juste après ${big}, il y a ${s}.`;
  return `${eq} : depuis ${big}, on avance de ${small} : ${countUp(big, s)}.`;
}
function addHintHole(k, c) {
  const m = c - k;
  if (m === 0) return `Que faut-il ajouter à ${k} pour rester à ${c} ?`;
  if (k === 0) return 'Ajouter 0 ne change pas le nombre.';
  if (c === 10) return `Pense à tes dix doigts : lève-en ${k}. Combien en reste-t-il de baissés ?`;
  if (m === 10 && k === 10) return '20, c’est 2 dizaines : il y en a déjà une dans 10.';
  if (m === 10) return `Regarde les unités de ${k} et de ${c} : ce sont les mêmes. Il manque donc des dizaines : combien ?`;
  if (k === 10) return `Dans ${c}, il y a une dizaine et combien d’unités ?`;
  if (c > 10) return `Pars de ${k} : va jusqu’à 10, puis de 10 jusqu’à ${c}.`;
  return `Pars de ${k} et compte jusqu’à ${c} : combien de pas fais-tu ?`;
}
function addExplainHole(eqText, k, c, m) {
  const head = `${eqText}, donc le nombre qui manque est ${m}.`;
  const unites = n => `${n} ${n > 1 ? 'unités' : 'unité'}`;
  if (m === 0 || k === 0) return `${head} Ajouter 0 ne change rien.`;
  if (c === 10) return `${head} ${k} et ${m} font 10.`;
  if (m === 10 && k === 10) return `${head} 20, c’est 2 dizaines.`;
  if (m === 10) return `${head} ${c}, c’est une dizaine et ${unites(k)}.`;
  if (k === 10) return `${head} ${c}, c’est une dizaine et ${unites(m)}.`;
  if (c > 10) return `${head} De ${k} à 10 : ${10 - k}. De 10 à ${c} : ${c - 10}. Et ${10 - k} + ${c - 10} = ${m}.`;
  return `${head} Depuis ${k}, on compte ${countUp(k, c)} : ${m} pas.`;
}
/* doubles */
function doubleTexts(n) {
  const d = 2 * n;
  if (n <= 10) return { hint: `Le double de ${n}, c’est ${n} + ${n}.`, explain: `Le double de ${n} est ${d}, car ${n} + ${n} = ${d}.` };
  if (n < 20) {
    const u = n - 10;
    return { hint: 'Double les dizaines, puis les unités.', explain: `Le double de ${n} est ${d} : 10 + 10 = 20 et ${u} + ${u} = ${2 * u}, puis 20 + ${2 * u} = ${d}.` };
  }
  if (n < 100 && n % 10 === 0) {
    const t = n / 10;
    return { hint: `Pense au double de ${t} : ici, ce sont des dizaines.`, explain: `Le double de ${n} est ${d} : le double de ${t} dizaines, c’est ${2 * t} dizaines.` };
  }
  if (n < 100) {
    const T = n - (n % 10), u = n % 10;
    return { hint: 'Double les dizaines, puis les unités.', explain: `Le double de ${n} est ${d} : ${T} + ${T} = ${2 * T} et ${u} + ${u} = ${2 * u}, puis ${2 * T} + ${2 * u} = ${d}.` };
  }
  if (n % 100 === 0) {
    const h = n / 100;
    return { hint: `Pense au double de ${h} : ici, ce sont des centaines.`, explain: `Le double de ${n} est ${f(d)} : le double de ${h} ${h > 1 ? 'centaines' : 'centaine'}, c’est ${2 * h} centaines.` };
  }
  const H = n - (n % 100), r = n % 100;
  return { hint: 'Double les centaines, puis les dizaines.', explain: `Le double de ${n} est ${f(d)} : ${H} + ${H} = ${2 * H} et ${r} + ${r} = ${2 * r}, puis ${2 * H} + ${2 * r} = ${f(d)}.` };
}
/* moitiés */
function halfTexts(n) {
  const h = n / 2;
  if (n % 2 === 1) {
    if (n === 1) return { hint: 'Partage 1 en deux parts égales : chaque part est un demi. Écris-le avec une virgule.', explain: 'La moitié de 1 est 0,5 (un demi), car 0,5 + 0,5 = 1.' };
    const q = (n - 1) / 2;
    return { hint: `${n}, c’est ${n - 1} + 1 : prends la moitié de ${n - 1}, puis la moitié de 1.`,
      explain: `La moitié de ${n} est ${f(h)} : la moitié de ${n - 1} est ${q}, la moitié de 1 est 0,5, et ${q} + 0,5 = ${f(h)}.` };
  }
  const split = (x, y) => ({ hint: `Coupe ${f(n)} en ${f(x)} et ${f(y)}, puis prends la moitié de chaque morceau.`,
    explain: `La moitié de ${f(n)} est ${f(h)} : la moitié de ${f(x)} est ${f(x / 2)}, la moitié de ${f(y)} est ${f(y / 2)}, et ${f(x / 2)} + ${f(y / 2)} = ${f(h)}.` });
  if (n <= 20) return { hint: `Cherche le nombre qui, ajouté à lui-même, donne ${n}.`, explain: `La moitié de ${n} est ${h}, car ${h} + ${h} = ${n}.` };
  if (n === 100 || n === 1000 || n === 1200) {
    const unit = n === 100 ? 10 : 100, word = n === 100 ? 'dizaines' : 'centaines', k = n / unit;
    return { hint: `${f(n)}, c’est ${k} ${word} : prends la moitié de ${k} ${word}.`,
      explain: `La moitié de ${f(n)} est ${f(h)} : la moitié de ${k} ${word}, c’est ${k / 2} ${word}.` };
  }
  if (n < 100 && n % 10 === 0) {
    const t = n / 10;
    if (t % 2 === 0) return { hint: `Pense à la moitié de ${t} : ici, ce sont des dizaines.`, explain: `La moitié de ${n} est ${h} : la moitié de ${t} dizaines, c’est ${t / 2} dizaines.` };
    return split(n - 10, 10);
  }
  if (n < 100) return split(n - (n % 10), n % 10);
  if (n < 200) return split(100, n - 100);
  const c = n / 100;
  if (c % 2 === 0) return { hint: `Pense à la moitié de ${c} : ici, ce sont des centaines.`, explain: `La moitié de ${n} est ${f(h)} : la moitié de ${c} centaines, c’est ${c / 2} ${c / 2 > 1 ? 'centaines' : 'centaine'}.` };
  return split(n - 100, 100);
}

/* ========== × ET ÷ PAR 10, 100, 1 000 ========== */
const RANKS = {
  '-3': ['millième', 'millièmes'], '-2': ['centième', 'centièmes'], '-1': ['dixième', 'dixièmes'],
  0: ['unité', 'unités'], 1: ['dizaine', 'dizaines'], 2: ['centaine', 'centaines'], 3: ['millier', 'milliers'],
  4: ['dizaine de milliers', 'dizaines de milliers'], 5: ['centaine de milliers', 'centaines de milliers'],
  6: ['million', 'millions'], 7: ['dizaine de millions', 'dizaines de millions'], 8: ['centaine de millions', 'centaines de millions']
};
const rankWord = (d, r) => `${d} ${RANKS[r][d > 1 ? 1 : 0]}`;
/* I × 10^e, exact (division par une puissance de 10 → arrondi correct) */
const numOf = (I, e) => (e >= 0 ? I * 10 ** e : I / 10 ** -e);
const decimalsOf = (I, e) => Math.max(0, -e);
const JW = ['', 'd’un rang', 'de deux rangs', 'de trois rangs'];
const MULT_RANK = { 1: 'dizaines', 2: 'centaines', 3: 'milliers' };

function p10Texts(I, e, j, op) {
  const x = numOf(I, e), m = 10 ** j;
  const res = op === '×' ? numOf(I, e + j) : numOf(I, e - j);
  const eq = `${f(x)} ${op} ${f(m)} = ${f(res)}`;
  const hint = op === '×'
    ? `× ${f(m)} : chaque chiffre avance ${JW[j]} vers la gauche (les unités deviennent des ${MULT_RANK[j]}).`
    : `÷ ${f(m)} : chaque chiffre recule ${JW[j]} vers la droite (les ${MULT_RANK[j]} deviennent des unités).`;
  let explain;
  if (op === '×' && e >= 0) explain = `${eq} : ${f(x)} ${x > 1 ? 'unités deviennent' : 'unité devient'} ${f(x)} ${x > 1 ? MULT_RANK[j] : MULT_RANK[j].slice(0, -1)}.`;
  else if (op === '÷' && e - j >= 0) explain = `${eq} : ${f(x)}, c’est ${f(res)} ${res > 1 ? MULT_RANK[j] : MULT_RANK[j].slice(0, -1)}.`;
  else {
    /* chiffre par chiffre : « 3 unités deviennent 3 centaines et 5 dixièmes deviennent 5 dizaines » */
    const digits = String(I).split('').map(Number), top = e + digits.length - 1;
    const parts = [];
    digits.forEach((d, i) => {
      if (!d) return;
      const r = top - i, r2 = op === '×' ? r + j : r - j;
      parts.push(`${rankWord(d, r)} ${d > 1 ? 'deviennent' : 'devient'} ${rankWord(d, r2)}`);
    });
    explain = `${eq} : ${parts.length > 1 ? parts.slice(0, -1).join(', ') + ' et ' + parts[parts.length - 1] : parts[0]}.`;
  }
  return { hint, explain, x, m, res };
}
/* tirage d'un calcul ×/÷ 10^j au niveau A (null si la combinaison sort du programme) */
function p10Draw(A, rng) {
  const cm2 = A >= 4, decOk = A >= 3.3, maxDec = cm2 ? 3 : 2;
  const op = rng.chance(decOk ? 0.5 : 0) ? '÷' : '×';
  const j = rng.weighted([1, 2, 3], [1, 1, 0.8]);
  const sig = rng.weighted([1, 2, 3], [0.35, 0.45, 0.2]);
  let I = rng.int(sig === 1 ? 1 : sig === 2 ? 11 : 101, sig === 1 ? 9 : sig === 2 ? 99 : 999);
  if (I % 10 === 0) I += 1;                                  /* dernier chiffre significatif non nul */
  const e = decOk && rng.chance(cm2 ? 0.55 : 0.4) ? -rng.int(1, maxDec) : rng.int(0, 2);
  return p10Check(A, I, e, j, op) ? { I, e, j, op } : null;
}
function p10Check(A, I, e, j, op) {
  const cm2 = A >= 4, decOk = A >= 3.3;
  const maxDec = cm2 ? 3 : 2, cap = A < 3.4 ? 9999 : 999999;
  const eR = op === '×' ? e + j : e - j;
  const dx = decimalsOf(I, e), dr = decimalsOf(I, eR);
  const x = numOf(I, e), res = numOf(I, eR);
  if (dx > maxDec || dr > maxDec || x > cap || res > cap || x < 0.001) return false;
  if (!decOk && (dx > 0 || dr > 0 || op === '÷')) return false;        /* CM1 P1-P2 : entier × 10, 100, 1 000 */
  if (!cm2 && (dx > 0 || dr > 0 || op === '÷') && j !== 1) return false; /* CM1 : décimal × 10 et ÷ 10 seulement */
  return true;
}
const p10Key = (I, e, j, op) => `${axis}:p10:${numOf(I, e)}${op === '×' ? 'x' : '/'}${10 ** j}`;
function p10Info(I, e, j, op) {
  const eR = op === '×' ? e + j : e - j;
  const dec = decimalsOf(I, e) > 0 || decimalsOf(I, eR) > 0;
  const lo = !dec ? (op === '×' ? 3 : 3.3) : j === 1 ? 3.3 : 4;
  const cap = !dec ? 4.5 : j === 1 ? 5 : A_TOP;
  return { lo, cap, dec };
}

/* ========== NOTIONS (calendrier, js/content/calendar.js) ========== */
/* table d'un produit {x ≤ y} : la première table où il s'apprend (TABLE_FROM) ; à égalité, le plus grand facteur autre
   que 1 et 10 ; 0 × n : « multiplier par 0 » ; 25 × n et décompositions de 60 : leurs propres notions */
function tableNotion(x, y) {
  if (x === 0) return 't0';
  if (y === 25) return 'x25';
  if (y > 10) return 'dec60';
  const lx = TABLE_FROM[x], ly = TABLE_FROM[y];
  if (lx !== ly) return 't' + (lx < ly ? x : y);
  const pref = [x, y].filter(n => n !== 1 && n !== 10);
  return 't' + (pref.length ? Math.max(...pref) : Math.max(x, y));
}
const NOTION_AT = { t0: 1.2, t1: 1, t2: 1, t5: 1, t10: 1, t3: 1.2, t4: 1.2, t6: 1.2, t7: 1.4, t8: 1.6, t9: 1.8, x25: 1.5, dec60: 2.3, facteur: 1.5, div: 3 };
/* notions d'un produit présenté sous une forme : la plus récente en premier (à égalité, la table) */
function mulNotions(x, y, form) {
  const t = tableNotion(x, y);
  if (form !== 'facteur' && form !== 'div') return [t];
  return NOTION_AT[form] > NOTION_AT[t] ? [form, t] : [t, form];
}
function addNotion(a, b, kind) {
  if (kind === 'c10') return 'c10';
  const lo = addInfo(Math.min(a, b), Math.max(a, b)).lo;
  return lo < 0.3 ? 'add.s9' : lo < 0.6 ? 'add.s13' : 'add.passage';
}
/* doubles et moitiés : par année d'arrivée de la liste */
function dblNotion(lo, half) {
  if (lo >= 4) return 'half.cm2';
  if (lo >= 2) return 'dbl.ce2';
  if (lo >= 1) return 'dbl.ce1';
  if (lo >= 0.6) return 'dbl.cp4';
  return lo >= (half ? 0.4 : 0.2) ? 'dbl.cp2' : 'dbl.cp1';
}
const p10Notion = info => (info.lo >= 4 ? 'p10.dec3' : info.lo >= 3.3 ? 'p10.dec' : 'p10');

/* ========== ASSEMBLAGE ========== */
function finish(o) {
  const voice = isInt(o.answer) && o.answer >= 0 && o.answer <= 1000;
  const notions = (o.notions || []).map(n => `${axis}:${n}`);
  return {
    axis, kind: o.kind, key: o.key, A: r3(o.A), prompt: o.prompt, answer: o.answer,
    notion: notions[0], notions,
    hint: frTypo(o.hint), explain: frTypo(o.explain), autoMs: o.autoMs || AUTO_FACT, leitner: o.kind !== 'p10',
    data: { voice, op: o.op, a: o.a, b: o.b ?? null, c: o.c, hole: o.hole, reversed: !!o.reversed }
  };
}
/* égalité à trou : « a op b = c » (ou « c = a op b ») avec un terme remplacé par « … » */
function eqPrompt(a, op, b, c, hole, reversed) {
  const t = { a: f(a), b: f(b), c: f(c) };
  t[hole] = HOLE;
  return reversed ? `${t.c} = ${t.a} ${op} ${t.b}` : `${t.a} ${op} ${t.b} = ${t.c}`;
}
/* fait additif {a, b} (ou complément c10) présenté selon la forme */
function addItem(a, b, form, A, kind) {
  const c = a + b;
  const info = kind === 'c10' ? { lo: 0, cap: 1.2 } : addInfo(Math.min(a, b), Math.max(a, b));
  const key = kind === 'c10' ? `${axis}:c10:${Math.min(a, b)}` : `${axis}:add:${Math.min(a, b)}+${Math.max(a, b)}`;
  const base = { kind, key, A: clamp(A, info.lo, info.cap), op: '+', a, b, c, notions: [addNotion(a, b, kind)] };
  if (form === 'sum') {
    return finish({ ...base, prompt: eqPrompt(a, '+', b, c, 'c'), answer: c, hole: 'c', hint: addHintSum(a, b), explain: addExplainSum(a, b) });
  }
  const hole = form === 'a' ? 'a' : 'b', reversed = form === 'left';
  const k = hole === 'a' ? b : a, m = hole === 'a' ? a : b;
  const eqText = reversed ? `${c} = ${a} + ${b}` : `${a} + ${b} = ${c}`;
  return finish({ ...base, prompt: eqPrompt(a, '+', b, c, hole, reversed), answer: m, hole, reversed,
    hint: addHintHole(k, c), explain: addExplainHole(eqText, k, c, m) });
}
function mulItem(x, y, form, A, rng) {
  const info = mulInfo(Math.min(x, y), Math.max(x, y));
  const key = `${axis}:${Math.min(x, y)}x${Math.max(x, y)}`;
  if (x === 0 || y === 0) form = 'mul';                       /* 0 × … = 0 : ambigu, jamais en trou */
  const lo = form === 'div' ? Math.max(info.lo, 3) : form === 'facteur' ? Math.max(info.lo, 1.5) : info.lo;
  const Ai = clamp(A, lo, Math.max(lo, mulCap(info, form)));
  const [a, b] = rng.chance(0.5) ? [x, y] : [y, x];           /* commutativité : les deux ordres */
  const p = a * b;
  const notions = mulNotions(Math.min(x, y), Math.max(x, y), form);
  if (form === 'mul') {
    return finish({ kind: 'mul', key, A: Ai, op: '×', a, b, c: p, hole: 'c', notions, prompt: eqPrompt(a, '×', b, p, 'c'), answer: p,
      hint: mulHint(Math.min(a, b), Math.max(a, b)), explain: mulExplain(a, b) });
  }
  if (form === 'div') {
    /* p ÷ b = a */
    const eqText = `${f(p)} ÷ ${b} = ${a}`;
    return finish({ kind: 'div', key, A: Ai, op: '÷', a: p, b, c: a, hole: 'c', notions, prompt: eqPrompt(p, '÷', b, a, 'c'), answer: a,
      hint: `Diviser, c’est chercher le facteur qui manque : ${b} × ${HOLE} = ${f(p)}.`,
      explain: `${eqText}, car ${b} × ${a} = ${f(p)}.` + (b > 1 && b <= 10 && a > 1 && a < 10 ? ` Compte de ${b} en ${b} : ${countBy(b, p)}.` : '') });
  }
  const sub = rng.weighted(['b', 'a', 'left'], [0.5, 0.3, 0.2]);
  const hole = sub === 'a' ? 'a' : 'b', reversed = sub === 'left';
  const k = hole === 'a' ? b : a, ans = hole === 'a' ? a : b;
  const eqText = reversed ? `${f(p)} = ${a} × ${b}` : `${a} × ${b} = ${f(p)}`;
  return finish({ kind: 'facteur', key, A: Ai, op: '×', a, b, c: p, hole, reversed, notions, prompt: eqPrompt(a, '×', b, p, hole, reversed),
    answer: ans, hint: facteurHint(k, p, ans), explain: facteurExplain(eqText, k, p, ans) });
}
function doubleItem(n, A) {
  const lo = levelIn(DOUBLES, n) ?? 0, t = doubleTexts(n);
  return finish({ kind: 'double', key: `${axis}:dbl:${n}`, A: clamp(A, lo, lo + 1.5), op: 'double', a: n, b: null, c: 2 * n, notions: [dblNotion(lo, false)],
    hole: 'c', prompt: `double de ${f(n)}`, answer: 2 * n, hint: t.hint, explain: t.explain });
}
function halfItem(n, A) {
  const lo = levelIn(HALVES, n) ?? 0, t = halfTexts(n), h = n / 2;
  return finish({ kind: 'moitie', key: `${axis}:half:${n}`, A: clamp(A, lo, lo === 4 ? A_TOP : lo + 1.5), op: 'moitié', a: n, b: null, notions: [dblNotion(lo, true)],
    c: h, hole: 'c', prompt: `moitié de ${f(n)}`, answer: h, hint: t.hint, explain: t.explain, autoMs: isInt(h) ? AUTO_FACT : AUTO_DEC });
}
function p10Item({ I, e, j, op }, A) {
  const t = p10Texts(I, e, j, op), info = p10Info(I, e, j, op);
  return finish({ kind: 'p10', key: p10Key(I, e, j, op), A: clamp(A, info.lo, info.cap), op, a: t.x, b: t.m, c: t.res, hole: 'c', notions: [p10Notion(info)],
    prompt: `${f(t.x)} ${op} ${f(t.m)} = ${HOLE}`, answer: t.res, hint: t.hint, explain: t.explain,
    autoMs: info.dec ? AUTO_DEC : AUTO_P10 });
}

/* ---------- tirage ---------- */
/* classe ≥ CM1 en remédiation (A bas) : l'axe Repères est « Connaître les tables de multiplication » →
   faits additifs limités à ~10 % des items, sans sommes ≤ 10 ni petits doubles (revue D2-07) */
const BIG_CLASSES = ['CM1', 'CM2'];
const ADD_KINDS = ['add', 'c10', 'double', 'moitie'];
function kindWeights(A, classe) {
  const w = baseKindWeights(A);
  if (BIG_CLASSES.includes(classe) && A >= 1) {
    const add = ADD_KINDS.reduce((t, k) => t + (w[k] || 0), 0);
    const rest = Object.keys(w).reduce((t, k) => t + (ADD_KINDS.includes(k) ? 0 : w[k]), 0);
    if (add > 0 && rest > 0 && add / (add + rest) > 0.1) {
      const f = (0.1 * rest) / (0.9 * add);
      for (const k of ADD_KINDS) if (w[k]) w[k] *= f;
    }
  }
  return w;
}
function baseKindWeights(A) {
  let w;
  if (A < 1) w = { add: A < 0.3 ? 0.45 : 0.42, c10: A < 0.3 ? 0.35 : 0.2, double: A < 0.1 ? 0.2 : 0.19, moitie: 0.19 };
  else if (A < 2) w = { add: 0.22, c10: 0.05, double: 0.1, moitie: 0.1, mul: 0.53 };
  else if (A < 3) w = { add: 0.14, c10: 0.02, double: 0.07, moitie: 0.07, mul: 0.7 };
  else if (A < 4) w = { add: 0.08, c10: 0.01, double: 0.04, moitie: 0.05, mul: 0.65, p10: 0.17 };
  else w = { add: 0.05, double: 0.04, moitie: 0.07, mul: 0.58, p10: 0.26 };
  if (A < KIND_FROM.moitie) delete w.moitie;
  return w;
}
const MUL_KINDS = ['mul', 'facteur', 'div'];
function build(A, rng, kind, classe) {
  const big = BIG_CLASSES.includes(classe) && A >= 1;
  let k = kind;
  if (!k) { k = pickW(rng, kindWeights(A, classe)); if (k === 'mul') k = pickW(rng, mulForms(A)); }
  if (MUL_KINDS.includes(k)) {
    const facts = mulFacts(A).filter(fc => (k === 'mul' || fc.x > 0));
    const fc = rng.weighted(facts, facts.map(x => mulWeight(x, A)));
    return mulItem(fc.x, fc.y, k, A, rng);
  }
  if (k === 'add') {
    let facts = addFacts(A);
    if (big && facts.some(x => x.a + x.b > 10)) facts = facts.filter(x => x.a + x.b > 10);
    const fc = rng.weighted(facts, facts.map(x => x.w));
    const [a, b] = rng.chance(0.5) ? [fc.a, fc.b] : [fc.b, fc.a];
    return addItem(a, b, pickW(rng, addForms(A)), A, 'add');
  }
  if (k === 'c10') {
    const a = rng.int(1, 9);
    const form = pickW(rng, A < 0.3 ? { b: 0.8, a: 0.2 } : { b: 0.5, a: 0.25, left: 0.25 });
    return addItem(a, 10 - a, form, A, 'c10');
  }
  if (k === 'double') {
    let ds = listAt(DOUBLES, A);
    if (big && ds.some(d => d.n > 10)) ds = ds.filter(d => d.n > 10);
    return doubleItem(rng.weighted(ds, ds.map(d => dblWeight(d, A))).n, A);
  }
  if (k === 'moitie') {
    const hs = listAt(HALVES, A);
    return halfItem(rng.weighted(hs, hs.map(d => dblWeight(d, A) * (d.lo === 4 ? 1.5 : 1))).n, A);
  }
  /* p10 */
  for (let i = 0; i < 60; i++) { const d = p10Draw(A, rng); if (d) return p10Item(d, A); }
  return p10Item({ I: 7, e: 0, j: 1, op: '×' }, A);
}

/* gen(A, rng, opts) : opts.avoid (Set de clés), opts.kind (sous-type imposé), opts.classe (classe de l'enfant,
   transmise par la manche : en CM1-CM2, la remédiation se concentre sur les tables de multiplication) */
export function gen(A, rng, opts = {}) {
  const o = opts || {};
  const kind = KINDS.includes(o.kind) ? o.kind : null;
  const a = kind ? Math.max(clampA(A), KIND_FROM[kind]) : clampA(A);
  const avoid = toSet(o.avoid);
  let item = null;
  for (let i = 0; i < TRIES; i++) {
    item = build(a, rng, kind, typeof o.classe === 'string' ? o.classe.toUpperCase() : null);
    if (!avoid.has(item.key)) break;
  }
  return item;
}

/* ---------- clés ---------- */
function parseKey(key) {
  const s = String(key || '');
  if (!s.startsWith(axis + ':')) return null;
  const body = s.slice(axis.length + 1);
  let m;
  if ((m = /^(\d+)x(\d+)$/.exec(body))) {
    const x = +m[1], y = +m[2];
    if (x > y) return null;
    const ok = (y <= 10 && x >= 0 && y >= 1) || (y === 25 && x >= 1 && x <= 4) || DECOMP60.some(([p, q]) => p === x && q === y);
    return ok ? { type: 'mul', x, y } : null;
  }
  if ((m = /^add:(\d+)\+(\d+)$/.exec(body))) {
    const a = +m[1], b = +m[2];
    return a >= 0 && b >= 1 && a <= b && b <= 10 && a + b !== 10 ? { type: 'add', a, b } : null;
  }
  if ((m = /^c10:(\d+)$/.exec(body))) { const a = +m[1]; return a >= 1 && a <= 5 ? { type: 'c10', a } : null; }
  if ((m = /^dbl:(\d+)$/.exec(body))) { const n = +m[1]; return levelIn(DOUBLES, n) !== null ? { type: 'double', n } : null; }
  if ((m = /^half:(\d+)$/.exec(body))) { const n = +m[1]; return levelIn(HALVES, n) !== null ? { type: 'moitie', n } : null; }
  if ((m = /^p10:(\d+(?:\.\d+)?)(x|\/)(10|100|1000)$/.exec(body))) {
    const x = Number(m[1]), j = String(m[3]).length - 1, op = m[2] === 'x' ? '×' : '÷';
    const dec = (m[1].split('.')[1] || '').length;
    let I = Math.round(x * 10 ** dec), e = -dec;
    while (I % 10 === 0 && I > 0) { I /= 10; e++; }
    return I > 0 ? { type: 'p10', I, e, j, op } : null;
  }
  return null;
}
/* fromKey : même fait, présentation adaptée à A (produit sous 1,5 ; facteur manquant ensuite ; division dès 3) */
export function fromKey(key, A, rng) {
  const k = parseKey(key);
  if (!k) return null;
  const a = clampA(A);
  if (k.type === 'mul') return mulItem(k.x, k.y, pickW(rng, mulForms(a)), a, rng);
  if (k.type === 'add') {
    const [p, q] = rng.chance(0.5) ? [k.a, k.b] : [k.b, k.a];
    return addItem(p, q, pickW(rng, addForms(a)), a, 'add');
  }
  if (k.type === 'c10') {
    const p = rng.chance(0.5) ? k.a : 10 - k.a;
    return addItem(p, 10 - p, pickW(rng, a < 0.3 ? { b: 0.8, a: 0.2 } : { b: 0.5, a: 0.25, left: 0.25 }), a, 'c10');
  }
  if (k.type === 'double') return doubleItem(k.n, a);
  if (k.type === 'moitie') return halfItem(k.n, a);
  return p10Item(k, a);
}
/* notion d'une clé Leitner (calendrier) : 'ma.faits:7x8' → 'ma.faits:t7' (la forme n'est pas dans la clé) */
export function notionOfKey(key) {
  const k = parseKey(key);
  if (!k) return null;
  let n;
  if (k.type === 'mul') n = tableNotion(k.x, k.y);
  else if (k.type === 'add') n = addNotion(k.a, k.b, 'add');
  else if (k.type === 'c10') n = 'c10';
  else if (k.type === 'double') n = dblNotion(levelIn(DOUBLES, k.n), false);
  else if (k.type === 'moitie') n = dblNotion(levelIn(HALVES, k.n), true);
  else n = p10Notion(p10Info(k.I, k.e, k.j, k.op));
  return `${axis}:${n}`;
}
/* écriture lisible d'une clé (espace parents) : 'ma.faits:7x8' → '7 × 8 = 56' */
export function describeKey(key) {
  const k = parseKey(key);
  if (!k) return String(key || '');
  if (k.type === 'mul') return `${k.x} × ${k.y} = ${f(k.x * k.y)}`;
  if (k.type === 'add') return `${k.a} + ${k.b} = ${k.a + k.b}`;
  if (k.type === 'c10') return `${k.a} + ${10 - k.a} = 10`;
  if (k.type === 'double') return `double de ${f(k.n)} = ${f(2 * k.n)}`;
  if (k.type === 'moitie') return `moitié de ${f(k.n)} = ${f(k.n / 2)}`;
  const t = p10Texts(k.I, k.e, k.j, k.op);
  return `${f(t.x)} ${k.op} ${f(t.m)} = ${f(t.res)}`;
}
