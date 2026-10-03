/* Générateur « procédures de calcul mental » (js/content/maths/procedures.js) — contrat docs/ARCHITECTURE.md §6.
   La réponse est recalculée en analysant l'énoncé affiché (évaluateur indépendant, fractions exactes en BigInt) ;
   les bornes viennent des programmes (rapports de recherche maths-c2 §2.5, §3.5, §4.5, §8, §10 ; maths-c3 §4, §8),
   recopiées ici indépendamment du générateur. */
import { test, assert } from './_t.mjs';
import { makeRng } from '../js/core/rng.js';
import { fmtNum } from '../js/core/util.js';
import * as P from '../js/content/maths/procedures.js';

const NNBSP = '\u202f', HOLE = '…';
const GRID = Array.from({ length: 57 }, (_, i) => i / 10);
const SEEDS = 300;

/* ---------- fractions exactes ---------- */
const babs = x => (x < 0n ? -x : x);
const gcd = (a, b) => { a = babs(a); b = babs(b); while (b) [a, b] = [b, a % b]; return a || 1n; };
function Q(n, d = 1n) { if (d === 0n) throw new Error('division par 0'); if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; }
const qAdd = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d);
const qSub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d);
const qMul = (a, b) => Q(a.n * b.n, a.d * b.d);
const qDiv = (a, b) => Q(a.n * b.d, a.d * b.n);
const qEq = (a, b) => a.n === b.n && a.d === b.d;
const qNum = a => Number(a.n) / Number(a.d);
function qFromDec(str) {                                     /* '4,45' | '4.45' | '1 000' → fraction exacte */
  const s = String(str).replace(/\u202f/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('nombre illisible ' + str);
  const [i, dec = ''] = s.split('.');
  return Q(BigInt(i + dec), 10n ** BigInt(dec.length));
}
const qFromJs = x => qFromDec(String(x));                    /* nombre JS court (4.75, 999999999) */
const decimalsOf = x => { const s = String(x); return s.includes('.') ? s.split('.')[1].length : 0; };

/* ---------- analyse indépendante des écritures affichées ---------- */
const NUM = String.raw`\d{1,3}(?:\u202f\d{3})*(?:,\d+)?`;
const OP = '[+−×÷]';
function tokenize(s) {
  const out = [], re = new RegExp(`\\s*(${NUM}|[()+−×÷])`, 'y');
  let m, i = 0;
  while (i < s.length) {
    re.lastIndex = i; m = re.exec(s);
    if (!m) throw new Error(`écriture illisible « ${s} » à la position ${i}`);
    out.push(m[1]); i = re.lastIndex;
  }
  return out;
}
function evalExpr(s) {                                        /* priorités usuelles, parenthèses */
  const t = tokenize(s); let i = 0;
  const factor = () => {
    const x = t[i++];
    if (x === '(') { const v = expr(); if (t[i++] !== ')') throw new Error('parenthèse ' + s); return v; }
    if (x === undefined || !/^\d/.test(x)) throw new Error('nombre attendu ' + s);
    return qFromDec(x);
  };
  const term = () => { let v = factor(); while (t[i] === '×' || t[i] === '÷') { const o = t[i++]; const w = factor(); v = o === '×' ? qMul(v, w) : qDiv(v, w); } return v; };
  const expr = () => { let v = term(); while (t[i] === '+' || t[i] === '−') { const o = t[i++]; const w = term(); v = o === '+' ? qAdd(v, w) : qSub(v, w); } return v; };
  const v = expr(); if (i !== t.length) throw new Error('fin inattendue ' + s);
  return v;
}
const numsIn = s => (s.match(new RegExp(`(?<![\\d,\\u202f])${NUM}(?![\\d,])`, 'g')) || []);
const pairsIn = s => (s.match(/\(/g) || []).length;
/* énoncé → { form, lhs, exact (fraction), kindHint } */
function solve(prompt) {
  let m;
  if ((m = new RegExp(`^(moitié|double) de (${NUM}) = ${HOLE}$`).exec(prompt))) {
    const x = qFromDec(m[2]);
    return { form: m[1], lhs: m[2], exact: m[1] === 'double' ? qMul(x, Q(2n)) : qDiv(x, Q(2n)), nums: [m[2]] };
  }
  if ((m = new RegExp(`^(${NUM}) \\+ ${HOLE} = (${NUM})$`).exec(prompt)))
    return { form: 'trou', lhs: m[1], exact: qSub(qFromDec(m[2]), qFromDec(m[1])), nums: [m[1], m[2]] };
  if ((m = new RegExp(`^(.+) = ${HOLE}$`).exec(prompt))) return { form: 'calcul', lhs: m[1], exact: evalExpr(m[1]), nums: numsIn(m[1]) };
  if ((m = new RegExp(`^(.+) ≈ ${HOLE}$`).exec(prompt))) return { form: 'estimation', lhs: m[1], exact: evalExpr(m[1]), nums: numsIn(m[1]) };
  return null;
}

/* ---------- textes ---------- */
const P0 = NUM;
const P1 = `(?:${NUM}|\\(${P0}(?: ${OP} ${P0})+\\))`;
const P2 = `(?:${NUM}|\\(${P1}(?: ${OP} ${P1})+\\))`;
const EXPR = `${P2}(?: ${OP} ${P2})*`;
/* bornes d'une écriture : pas au milieu d'un nombre (« 6 710 », « 4,45 »), ni d'une parenthèse */
const LB = String.raw`(?<![\d(]|\d,|\d\u202f)`, LA = String.raw`(?![\d)]|,\d|\u202f\d)`;
/* toute chaîne « e1 = e2 (= e3…) » d'un texte est vraie ; « e1 ≈ e2 » est une approximation raisonnable */
function checkEqualities(text, ctx) {
  const re = new RegExp(`${LB}(${EXPR})((?: = ${EXPR})+)${LA}`, 'g');
  let m, n = 0;
  while ((m = re.exec(text))) {
    const parts = m[0].split(' = ').map(evalExpr);
    for (const p of parts.slice(1)) assert.ok(qEq(p, parts[0]), `égalité fausse « ${m[0]} » (${ctx})`);
    n++;
  }
  const ra = new RegExp(`${LB}(${EXPR}) ≈ (${EXPR})${LA}`, 'g');
  while ((m = ra.exec(text))) {
    const a = qNum(evalExpr(m[1])), b = qNum(evalExpr(m[2]));
    assert.ok(Math.abs(a - b) <= 0.25 * Math.abs(b), `approximation trop grossière « ${m[0]} » (${ctx})`);
  }
  return n;
}
function checkText(s, ctx) {
  assert.equal(typeof s, 'string', ctx);
  assert.ok(s.length > 3, `texte vide (${ctx})`);
  assert.ok(!/undefined|NaN|null|\[object|Infinity/.test(s), `texte invalide « ${s} » (${ctx})`);
  assert.ok(!/'/.test(s), `apostrophe droite dans « ${s} »`);
  assert.ok(!/ [?!;:]/.test(s), `espace ordinaire avant ? ! ; : dans « ${s} »`);
  assert.ok(!/\S[?!;:]/.test(s.replace(new RegExp(NNBSP + '[?!;:]', 'g'), '')), `ponctuation haute collée dans « ${s} »`);
  assert.ok(!/ {2}/.test(s), `double espace dans « ${s} »`);
  assert.ok(!/(^|[^a-zé])-\d/.test(s) && !/\d -/.test(s), `tiret au lieu du signe moins dans « ${s} »`);
  assert.ok(!/\d\.\d/.test(s), `point décimal au lieu de la virgule dans « ${s} »`);
  assert.ok(!/(?<![\d,])\d{4,}/.test(s), `nombre sans espace des milliers dans « ${s} »`);
  assert.ok(/^[A-ZÀÉÈ0-9(]/.test(s), `majuscule initiale dans « ${s} »`);
  assert.ok(/[.?!]$/.test(s), `ponctuation finale dans « ${s} »`);
}

/* ---------- programme (indépendant du générateur) ---------- */
/* champ numérique par niveau absolu : CP P1 ≤ 20 (livret), ≤ 59 en P2, ≤ 100 ; CE1 ≤ 1 000 ; CE2 ≤ 10 000 ;
   CM1 P1-P2 ≤ 9 999 puis ≤ 999 999 ; CM2 P1-P2 ≤ 999 999 puis ≤ 999 999 999 */
const fieldCap = A => (A < 0.2 ? 20 : A < 0.4 ? 59 : A < 1 ? 100 : A < 2 ? 1000 : A < 3 ? 10000 : A < 3.4 ? 9999 : A < 4.4 ? 999999 : 999999999);
/* décimaux : aucun avant le CM1 P2 ; centièmes au CM1 ; millièmes au CM2 */
const decCap = A => (A < 3.2 ? 0 : A < 4 ? 2 : 3);
/* première classe où chaque procédure est au programme (BO n°41/2024 cycle 2, BO n°16/2025 cycle 3) */
const CLASS_FROM = {
  plus1: 0, moins1: 0, plus2: 0, moins2: 0, plus10: 0, moins10: 0, plusPetit: 0, complDiz: 0, plusDiz: 0, moinsDiz: 0,
  plusPassage: 0, dizMoins: 0, plus9: 0, deuxNombres: 0, moitie: 0,
  plusCent: 1, moinsCent: 1, moinsPetit: 1, moinsPassage: 1, fois10: 1, moins9: 1, distri: 1,
  plus8: 2, fois100: 2, foisDiz: 2, fois4: 2, fois8: 2, compl100: 2,
  moins8: 3, foisCent: 3, fois1000: 3, fois5: 3, decPlus: 3, decMoins: 3, decFois: 3, decDiv: 3, estimation: 3, parentheses: 3,
  sommeDec: 4, produitRonds: 4, doubleDec: 4, moitieDec: 4, div4: 4, div8: 4, fois50: 4, decRetenue: 4
};
const SLOW = new Set(['distri', 'estimation', 'parentheses']);
const opsOfKey = key => key.split(':').slice(2).join(':');
/* clé ASCII → écriture affichée : '4.45+0.8' → '4,45 + 0,8' ; '(15-7)x(6+3)' → '(15 − 7) × (6 + 3)' */
const showKey = ops => ops.replace(/\d+(\.\d+)?/g, m => fmtNum(Number(m))).replace(/([+\-x/])/g, ' $1 ')
  .replace(/ x /g, ' × ').replace(/ \/ /g, ' ÷ ').replace(/ - /g, ' − ');

/* ---------- vérification d'un item ---------- */
function checkItem(it, A, ctx) {
  assert.equal(it.axis, 'ma.procedures', ctx);
  assert.ok(P.KINDS.includes(it.kind), `${ctx} kind ${it.kind}`);
  assert.ok(!/undefined|NaN|Infinity/.test(JSON.stringify(it)), `${ctx} valeur invalide : ${JSON.stringify(it)}`);
  assert.ok(Number.isFinite(it.A) && it.A >= 0 && it.A <= 5.6, `${ctx} A = ${it.A}`);
  assert.equal(it.leitner, false, ctx);
  assert.equal(typeof it.prompt, 'string', ctx);
  assert.ok(!/[-*/x']/.test(it.prompt) && !/\d\.\d/.test(it.prompt), `${ctx} signes typographiques dans « ${it.prompt} »`);
  const s = solve(it.prompt);
  assert.ok(s, `${ctx} énoncé illisible « ${it.prompt} »`);
  /* écriture des nombres : fmtNum (espaces fines, virgule) */
  for (const t of numsIn(it.prompt)) assert.equal(t, fmtNum(Number(t.replace(/\u202f/g, '').replace(',', '.'))), `${ctx} écriture ${t}`);
  /* réponse */
  assert.ok(Number.isFinite(it.answer) && it.answer >= 0, `${ctx} réponse ${it.answer}`);
  if (s.form === 'estimation') {
    assert.equal(it.kind, 'estimation', ctx);
    assert.ok(Array.isArray(it.choices) && it.choices.length === 4, `${ctx} 4 choix`);
    const vals = it.choices.map(c => c.value);
    assert.equal(new Set(vals).size, 4, `${ctx} choix distincts`);
    assert.ok(vals.includes(it.answer), `${ctx} la réponse est parmi les choix`);
    for (const c of it.choices) { assert.equal(c.label, fmtNum(c.value), `${ctx} libellé`); assert.ok(Number.isInteger(c.value) && c.value > 0, ctx); }
    const ex = qNum(s.exact);
    const additive = /^[^×÷]+$/.test(s.lhs);
    const dist = v => (additive ? Math.abs(v - ex) : Math.abs(Math.log(v / ex)));
    const sorted = [...vals].sort((a, b) => dist(a) - dist(b));
    assert.equal(sorted[0], it.answer, `${ctx} la réponse est la meilleure estimation de ${ex} parmi ${vals}`);
    if (additive) assert.ok(Math.abs(it.answer - ex) < 50, `${ctx} estimation à la centaine sans ambiguïté (${ex} ≈ ${it.answer})`);
    else assert.ok(dist(it.answer) < Math.log(2) && dist(sorted[1]) > Math.log(4), `${ctx} ordre de grandeur sans ambiguïté (${ex} ≈ ${it.answer})`);
  } else {
    assert.ok(!it.choices, `${ctx} réponse au pavé`);
    assert.ok(qEq(qFromJs(it.answer), s.exact), `${ctx} réponse ${it.answer} ≠ ${qNum(s.exact)} pour « ${it.prompt} »`);
  }
  /* champ numérique et décimales au niveau réel de l'item */
  const lvl = it.A + 1e-9;
  for (const t of [...s.nums, fmtNum(it.answer)]) {
    const v = Number(t.replace(/\u202f/g, '').replace(',', '.'));
    assert.ok(v <= fieldCap(lvl), `${ctx} ${t} hors du champ numérique à A=${it.A}`);
    assert.ok(decimalsOf(v) <= decCap(lvl), `${ctx} ${t} : trop de décimales à A=${it.A}`);
  }
  /* procédure au programme */
  assert.ok(it.A >= CLASS_FROM[it.kind] - 1e-9, `${ctx} ${it.kind} avant sa classe (A=${it.A})`);
  /* clé */
  const ops = opsOfKey(it.key);
  assert.equal(it.key, `ma.procedures:${it.kind}:${ops}`, `${ctx} clé`);
  assert.ok(/^[0-9.+\-x/()]+$/.test(ops), `${ctx} opérandes ASCII ${ops}`);
  if (s.form === 'calcul' || s.form === 'estimation') assert.equal(showKey(ops), s.lhs, `${ctx} clé ↔ énoncé`);
  else assert.equal(fmtNum(Number(ops)), s.lhs, `${ctx} clé ↔ énoncé`);
  /* data, seuil de vitesse */
  assert.equal(it.data.strategy, it.kind, ctx);
  assert.equal(it.data.decimals, decimalsOf(it.answer), `${ctx} data.decimals`);
  assert.ok(Array.isArray(it.data.ardoise), ctx);
  const anyDec = decimalsOf(it.answer) > 0 || s.nums.some(t => t.includes(','));
  assert.ok([5000, 7000].includes(it.autoMs), `${ctx} autoMs`);
  if (anyDec || SLOW.has(it.kind)) assert.equal(it.autoMs, 7000, `${ctx} autoMs 7 s (décimaux, distributivité, estimation, parenthèses)`);
  /* textes : stratégie générale (sans la réponse) ; explication = stratégie appliquée, donne la réponse */
  checkText(it.hint, `${ctx} hint`); checkText(it.explain, `${ctx} explain`);
  checkEqualities(it.explain, `${ctx} explain`);
  checkEqualities(it.hint, `${ctx} hint`);
  const ans = fmtNum(it.answer), shown = new Set(numsIn(it.prompt));
  assert.ok(numsIn(it.explain).includes(ans), `${ctx} l'explication donne ${ans} : ${it.explain}`);
  assert.ok(!numsIn(it.hint).includes(ans) || shown.has(ans), `${ctx} l'indice révèle la réponse : ${it.hint}`);
  for (const a of it.data.ardoise) assert.ok(numsIn(it.explain).includes(a), `${ctx} ardoise ${a} absente de l'explication : ${it.explain}`);
  return s;
}

/* règles propres à chaque procédure (BO : quand la procédure a un sens, et ce que montrent les exemples officiels) */
function checkStrategy(it, s, ctx) {
  const ops = opsOfKey(it.key), k = it.kind, A = it.A + 1e-9;
  const two = (re) => { const m = re.exec(ops); assert.ok(m, `${ctx} opérandes ${ops}`); return [Number(m[1]), Number(m[2])]; };
  if (['plus9', 'plus8', 'moins9', 'moins8'].includes(k)) {
    const [n, m] = two(/^(\d+)[+-](\d+)$/);
    const gap = k.endsWith('9') ? 1 : 2, u = n % 10;
    assert.equal((m + gap) % 10, 0, `${ctx} ${m} est proche d'une dizaine`);
    if (k.startsWith('plus')) assert.ok(u >= gap + 1, `${ctx} « + ${m} » inutile quand les unités valent ${u} (BO)`);
    else assert.ok(u <= 9 - gap, `${ctx} « − ${m} » sans intérêt quand les unités valent ${u}`);
    const lvlM = { plus9: m === 9 ? 0 : m <= 29 ? 1 : m === 39 ? 2 : 4, plus8: m <= 38 ? 2 : 4, moins9: m === 9 ? 1 : m <= 39 ? 2 : 4, moins8: m <= 38 ? 3 : 4 }[k];
    assert.ok(A >= lvlM, `${ctx} « ${m} » pas avant A = ${lvlM}`);
  }
  if (k === 'plusPetit') { const [n, m] = two(/^(\d+)\+(\d)$/); assert.ok(n % 10 >= 1 && n % 10 + m <= 9, `${ctx} sans changer de dizaine`); }
  if (k === 'plusPassage') { const [n, m] = two(/^(\d+)\+(\d)$/); assert.ok(n % 10 + m >= 11 && m <= 8, `${ctx} passage de la dizaine`); }
  if (k === 'moinsPetit') { const [n, m] = two(/^(\d+)-(\d)$/); assert.ok(n % 10 >= m && m <= 8, `${ctx} sans changer de dizaine`); }
  if (k === 'moinsPassage') { const [n, m] = two(/^(\d+)-(\d)$/); assert.ok(n % 10 >= 1 && n % 10 < m && m <= 8, `${ctx} passage par la dizaine inférieure`); }
  if (k === 'dizMoins') { const [n, m] = two(/^(\d+)-(\d)$/); assert.ok(n % 10 === 0 && m >= 1, `${ctx} dizaines entières − n < 10`); }
  if (k === 'plusDiz' || k === 'moinsDiz') { const [, m] = two(/^(\d+)[+-](\d+)$/); assert.ok(m % 10 === 0 && m >= 20 && m <= 90, ctx); }
  if (k === 'plusCent' || k === 'moinsCent') { const [, m] = two(/^(\d+)[+-](\d+)$/); assert.ok(m % 100 === 0 && m >= 100 && m <= 900, ctx); }
  if (k === 'complDiz') assert.ok(it.answer >= 1 && it.answer <= 9, `${ctx} complément à la dizaine`);
  if (k === 'compl100') assert.ok(it.prompt.endsWith('= 100') && it.answer >= 1 && it.answer <= 89, ctx);
  if (k === 'deuxNombres') {
    const [a, b] = two(/^(\d+)\+(\d+)$/);
    assert.ok(a >= 11 && a <= 99 && b >= 11 && b <= 99 && a % 10 && b % 10, `${ctx} deux nombres à deux chiffres`);
    if (A < 1) assert.ok(a + b <= 100, `${ctx} CP : somme ≤ 100`);
  }
  if (k === 'moitie') {
    const n = Number(ops);
    assert.ok(n % 2 === 0 && n > 20 && n < 1000, ctx);
    if (n >= 100 || Math.floor(n / 10) % 2) assert.ok(A >= 1, `${ctx} moitié de ${n} : CE1`);
  }
  if (k === 'distri') {
    const [x, y] = two(/^(\d+)x(\d+)$/);
    const lo = Math.min(x, y), hi = Math.max(x, y);
    if (lo < 10) {
      assert.ok(hi >= 11 && hi <= 99, ctx);
      if (hi >= 20) assert.ok(A >= 2, `${ctx} 11-99 × n : CE2`);
    } else {
      assert.ok(A >= 3, `${ctx} deux nombres à deux chiffres : cycle 3`);
      const simple = (lo % 10 === 1 && lo <= 51 && hi <= 49) || (hi % 10 === 1 && hi <= 51 && lo <= 49);
      if (!simple) assert.ok(A >= 4, `${ctx} distributivité 12 × 42 : CM2`);
    }
  }
  if (k === 'fois10' && Number(ops.split('x').find(t => t !== '10') || 10) >= 100) assert.ok(A >= 2, `${ctx} × 10 d'un nombre ≥ 100 : CE2`);
  if (k === 'fois4' || k === 'fois8') {
    const [x, y] = two(/^(\d+)x(\d+)$/); const n = x === (k === 'fois4' ? 4 : 8) ? y : x;
    assert.ok(n >= 11, ctx);
    if (n >= 100) assert.ok(A >= 3, `${ctx} × 4 / × 8 d'un nombre à trois chiffres : CM1`);
  }
  if (k === 'fois5') {
    const [x, y] = two(/^([\d.]+)x([\d.]+)$/); const n = x === 5 ? y : x;
    if (Number.isInteger(n)) assert.ok(n > 10 && n < 200, `${ctx} × 5 d'un entier < 200`);
    else { assert.ok(A >= 4, `${ctx} décimal × 5 : CM2`); assert.ok(String(n).replace('.', '').length <= 3, `${ctx} au plus trois chiffres`); }
  }
  if (k === 'fois50') {
    const [x, y] = two(/^([\d.]+)x([\d.]+)$/); const n = x === 50 ? y : x, digits = String(n).replace('.', '');
    assert.ok(n < 20 && digits.length <= 3 && Number(digits.at(-1)) % 2 === 0, `${ctx} × 50 : nombre < 20, au plus trois chiffres, dernier chiffre pair`);
  }
  if (k === 'decFois' || k === 'decDiv') {
    const [x, P10] = k === 'decDiv' ? two(/^([\d.]+)\/(\d+)$/) : (() => { const [a, b] = two(/^([\d.]+)x([\d.]+)$/); return [10, 100, 1000].includes(b) ? [a, b] : [b, a]; })();
    assert.ok([10, 100, 1000].includes(P10), ctx);
    if (A < 4) { assert.equal(P10, 10, `${ctx} CM1 : × 10 et ÷ 10 seulement`); if (k === 'decDiv') assert.ok(decimalsOf(x) <= 1, `${ctx} CM1 : pas de millièmes`); }
  }
  if (k === 'decPlus' || k === 'decMoins' || k === 'decRetenue') {
    const [x, y] = two(/^([\d.]+)[+-]([\d.]+)$/);
    const digits = String(y).replace('.', '').replace(/^0+/, '');
    assert.ok(/^[1-9]0*$/.test(digits), `${ctx} on ajoute un seul chiffre non nul : ${y}`);
    /* rang r du chiffre ajouté, chiffre de x à ce rang (calcul en millièmes entiers) */
    const r = decimalsOf(y) ? -decimalsOf(y) : String(y).length - 1;
    const digit = (v, rr) => Math.floor(Math.round(v * 1000) / 10 ** (rr + 3)) % 10;
    const g = digit(x, r), add = Number(digits[0]);
    if (k === 'decPlus') assert.ok(g + add <= 9, `${ctx} sans retenue`);
    if (k === 'decMoins') assert.ok(g >= add, `${ctx} sans retenue`);
    if (k === 'decRetenue') assert.ok(g + add >= 10 && A >= 4, `${ctx} avec retenue (CM2)`);
    assert.ok(decimalsOf(x) >= 1, `${ctx} un décimal`);
  }
  if (k === 'sommeDec') { const [a, b] = two(/^([\d.]+)\+([\d.]+)$/); assert.ok(a < 10 && b < 10 && decimalsOf(a) <= 1 && decimalsOf(b) <= 1, ctx); }
  if (k === 'doubleDec' || k === 'moitieDec') {
    const x = Number(ops), digits = String(x).replace('.', '').replace(/^0+/, '');
    assert.ok(decimalsOf(x) >= 1 && decimalsOf(x) <= 2 && digits.length <= 3, `${ctx} décimal d'au plus trois chiffres`);
  }
  if (k === 'div4' || k === 'div8') assert.ok(decimalsOf(it.answer) <= 1, `${ctx} quotient entier ou « ,5 » (260 ÷ 8 = 32,5)`);
  if (k === 'produitRonds') {
    const [x, y] = two(/^(\d+)x(\d+)$/);
    for (const v of [x, y]) assert.ok(/^[2-9]0{1,3}$/.test(String(v)), `${ctx} dizaines, centaines ou milliers : ${v}`);
  }
  if (k === 'parentheses') {
    const n = pairsIn(it.prompt);
    assert.ok(n >= 1 && n <= 2, `${ctx} une ou deux paires de parenthèses`);
    if (A < 4) assert.equal(n, 1, `${ctx} CM1 : une seule paire`);
    assert.ok(Number.isInteger(it.answer), ctx);
  }
  if (k === 'estimation' && s.lhs.includes(',')) assert.ok(A >= 4, `${ctx} estimation avec un décimal : CM2`);
}

/* ---------- tests ---------- */
test('procédures : exports du contrat', () => {
  assert.equal(P.axis, 'ma.procedures');
  for (const fn of ['gen', 'fromKey']) assert.equal(typeof P[fn], 'function', fn);
  assert.deepEqual([...P.KINDS].sort(), Object.keys(CLASS_FROM).sort());
});

test('procédures : déterminisme (gen et fromKey)', () => {
  for (const A of GRID) for (let s = 0; s < 20; s++) assert.deepEqual(P.gen(A, makeRng(`d${s}`)), P.gen(A, makeRng(`d${s}`)), `A=${A}`);
  for (const k of ['ma.procedures:plus9:47+9', 'ma.procedures:distri:21x35', 'ma.procedures:estimation:52x37', 'ma.procedures:parentheses:(15-7)x(6+3)'])
    for (const A of [1, 3.5, 5]) assert.deepEqual(P.fromKey(k, A, makeRng(3)), P.fromKey(k, A, makeRng(3)), k);
});

test('procédures : items justes et dans le programme sur toute la grille (57 niveaux × 300 graines)', () => {
  let n = 0;
  for (const A of GRID) for (let s = 0; s < SEEDS; s++) {
    const it = P.gen(A, makeRng(`g${A}|${s}`));
    const ctx = `A=${A} s=${s} « ${it.prompt} »`;
    const sol = checkItem(it, A, ctx);
    checkStrategy(it, sol, ctx);
    assert.ok(it.A <= A + 1e-9, `${ctx} niveau réel ${it.A} ≤ demandé`);
    if (it.choices) for (const c of it.choices) assert.ok(c.value <= fieldCap(A + 1e-9), `${ctx} choix ${c.label} hors champ`);
    n++;
  }
  /* bords de paliers */
  for (const A of [0.19, 0.2, 0.39, 0.45, 0.99, 1, 1.19, 1.2, 1.99, 2, 2.39, 2.4, 2.99, 3, 3.19, 3.2, 3.39, 3.4, 3.99, 4, 4.39, 4.4, 4.99, 5, 5.6])
    for (let s = 0; s < 200; s++) { const it = P.gen(A, makeRng(`e${A}|${s}`)); const ctx = `A=${A} « ${it.prompt} »`; checkStrategy(it, checkItem(it, A, ctx), ctx); assert.ok(it.A <= A + 1e-9, ctx); }
  assert.ok(n === GRID.length * SEEDS);
});

test('procédures : chaque procédure arrive à son palier (exemples officiels)', () => {
  const kindsIn = (A0, A1, n = 2500) => {
    const c = {};
    for (let s = 0; s < n; s++) { const it = P.gen(A0 + (A1 - A0) * ((s % 50) / 50), makeRng(`p${A0}|${s}`)); c[it.kind] = (c[it.kind] || 0) + 1; }
    return c;
  };
  const have = (c, list, name) => { for (const k of list) assert.ok(c[k] > 0, `${name} : ${k} absent`); };
  const cp = kindsIn(0, 1), ce1 = kindsIn(1, 2), ce2 = kindsIn(2, 3), cm1 = kindsIn(3, 4), cm2 = kindsIn(4, 5), adv = kindsIn(5, 5.6);
  have(cp, ['plus1', 'moins1', 'plus2', 'moins2', 'plus10', 'moins10', 'plusPetit', 'complDiz', 'plusDiz', 'moinsDiz', 'plusPassage', 'dizMoins', 'plus9', 'deuxNombres', 'moitie'], 'CP');
  have(ce1, ['plusCent', 'moinsCent', 'plusDiz', 'fois10', 'plus9', 'moins9', 'moinsPetit', 'moinsPassage', 'moitie', 'distri'], 'CE1');
  have(ce2, ['fois10', 'fois100', 'plus8', 'plus9', 'moins9', 'fois4', 'fois8', 'foisDiz', 'distri', 'compl100'], 'CE2');
  have(cm1, ['plus8', 'moins8', 'plus9', 'moins9', 'foisCent', 'fois5', 'distri', 'decPlus', 'decMoins', 'fois1000', 'decFois', 'decDiv', 'estimation', 'parentheses', 'fois4', 'fois8'], 'CM1');
  have(cm2, ['sommeDec', 'plus9', 'plus8', 'moins9', 'moins8', 'produitRonds', 'distri', 'doubleDec', 'moitieDec', 'div4', 'div8', 'fois5', 'fois50', 'decFois', 'decDiv', 'decRetenue', 'estimation', 'parentheses'], 'CM2');
  assert.ok(!cp.plusCent && !cp.distri && !ce1.fois4 && !ce1.plus8 && !ce2.fois5 && !ce2.estimation && !cm1.sommeDec && !cm1.div4, 'rien avant sa classe');
  assert.ok(!cm2.plus1 && !cm2.complDiz && !cm2.moitie, 'les procédures du CP ne reviennent plus au CM2');
  assert.ok(adv.parentheses / 2500 > cm2.parentheses / 2500, 'au-delà de 5 : parenthèses plus fréquentes');
  /* exemples des programmes et des Exemples de réussite, reconstruits par fromKey */
  const ex = [
    ['plus9:47+9', 56, 0.55], ['moinsDiz:76-30', 46, 0.45], ['plusPassage:47+8', 55, 0.45], ['dizMoins:50-6', 44, 0.5],
    ['deuxNombres:47+28', 75, 0.6], ['moitie:46', 23, 0.7], ['plusCent:354+500', 854, 1], ['plusDiz:746+80', 826, 1.2],
    ['moinsPetit:157-5', 152, 1.1], ['moinsPassage:523-7', 516, 1.4], ['moitie:470', 235, 1.5], ['distri:13x7', 91, 1.4],
    ['fois10:10x724', 7240, 2], ['plus8:47+38', 85, 2.2], ['moins9:75-29', 46, 2.3], ['fois4:4x37', 148, 2.4], ['fois8:8x27', 216, 2.6],
    ['foisDiz:9x40', 360, 2.2], ['distri:23x7', 161, 2.5], ['foisCent:9x400', 3600, 3.1], ['fois5:5x37', 185, 3.3],
    ['distri:21x35', 735, 3.4], ['decPlus:4.45+0.3', 4.75, 3.3], ['sommeDec:8.6+7.8', 16.4, 4], ['plus8:356+98', 454, 4],
    ['produitRonds:900x700', 630000, 4.1], ['distri:12x42', 504, 4], ['doubleDec:13.6', 27.2, 4.2], ['moitieDec:13.6', 6.8, 4.3],
    ['moitieDec:1.22', 0.61, 4.3], ['div8:260/8', 32.5, 4.4], ['fois5:5x1.46', 7.3, 4.3], ['fois50:50x12.4', 620, 4.5],
    ['decRetenue:4.45+0.8', 5.25, 4.2], ['decPlus:4.452+0.03', 4.482, 4], ['parentheses:3x(10-6)', 12, 3.6],
    ['parentheses:(15-7)x(6+3)', 72, 4.5], ['parentheses:37-(3x(14-6))', 13, 4.5], ['estimation:52x37', 2000, 3.5]
  ];
  for (const [k, ans, lo] of ex) {
    const it = P.fromKey('ma.procedures:' + k, 5.6, makeRng(k));
    assert.ok(it, `exemple officiel ${k} reconstruit`);
    assert.ok(Math.abs(it.answer - ans) < 1e-9, `${k} → ${ans}`);
    const low = P.fromKey('ma.procedures:' + k, 0, makeRng(k)), c = Math.floor(lo);
    assert.ok(low.A >= c - 1e-9 && low.A < c + 0.8, `${k} : niveau réel ${low.A}, l'exemple officiel est proposé dans sa classe (dès ${c}, au plus tard en P4)`);
    assert.ok(low.A <= lo + 1e-9, `${k} : niveau réel ${low.A} > ${lo}`);
    checkItem(it, 5.6, k);
  }
});

test('procédures : stratégies attendues dans les indices et les explications', () => {
  const it = k => P.fromKey('ma.procedures:' + k, 5, makeRng(k));
  assert.match(it('plus9:47+9').hint, /ajoute 10, puis enlève 1/);
  assert.match(it('plus9:47+9').explain, /47 \+ 10 = 57, puis 57 − 1 = 56/);
  assert.match(it('plus8:47+38').hint, /ajoute 40, puis enlève 2/);
  assert.match(it('moins9:75-29').hint, /soustrais 30, puis ajoute 1/);
  assert.match(it('plusPassage:47+8').explain, /47 \+ 3 = 50\. Il reste 5 à ajouter/);
  assert.match(it('moinsPassage:523-7').explain, /523 − 3 = 520\. Il reste 4 à enlever/);
  assert.match(it('dizMoins:50-6').explain, /Je casse une dizaine/);
  assert.match(it('distri:13x7').explain, /13 = 10 \+ 3\. 10 × 7 = 70 et 3 × 7 = 21\. 70 \+ 21 = 91/);
  assert.match(it('distri:21x35').explain, /21 = 20 \+ 1\. 20 × 35 = 700 et 1 × 35 = 35/);
  assert.match(it('fois4:4x37').explain, /Le double de 37 est 74, et le double de 74 est 148/);
  assert.match(it('fois5:5x37').hint, /multiplier par 10, puis prendre la moitié/);
  assert.match(it('div8:260/8').explain, /Moitié de 260\u202f: 130\. Moitié de 130\u202f: 65\. Moitié de 65\u202f: 32,5/);
  assert.match(it('moitie:470').explain, /470 = 400 \+ 70\. La moitié de 400 est 200 et la moitié de 70 est 35/);
  assert.match(it('decDiv:439.4/10').explain, /9 unités deviennent 9 dixièmes/);
  assert.match(it('estimation:52x37').explain, /52 ≈ 50 et 37 ≈ 40\. 50 × 40 = 2\u202f000/);
  assert.match(it('parentheses:37-(3x(14-6))').hint, /parenthèse la plus à l’intérieur/);
});

test('procédures : fromKey reconstruit le même calcul', () => {
  const keys = new Map();
  for (const A of GRID) for (let s = 0; s < 40; s++) { const it = P.gen(A, makeRng(`r${A}|${s}`)); keys.set(it.key, it); }
  assert.ok(keys.size > 1500, `${keys.size} clés rencontrées`);
  for (const [key, orig] of keys) for (const A of [orig.A, 5.6]) {
    const it = P.fromKey(key, A, makeRng(`${key}|${A}`));
    assert.ok(it, key);
    assert.equal(it.key, key, `fromKey(${key}) garde la clé`);
    assert.equal(it.prompt, orig.prompt, key);
    assert.equal(it.answer, orig.answer, key);
    assert.equal(it.explain, orig.explain, key);
    checkItem(it, A, `fromKey ${key}`);
  }
  for (const bad of ['', 'ma.procedures:', 'ma.procedures:inconnu:1+1', 'ma.procedures:plus9:47+8', 'ma.procedures:plus1:abc',
    'ma.procedures:moitie:47', 'ma.procedures:distri:20x7', 'ma.procedures:parentheses:3x4', 'ma.procedures:decDiv:45/7', 'ma.procedures:decDiv:4.567/10',
    'ma.faits:7x8', null, undefined, 42]) assert.equal(P.fromKey(bad, 2, makeRng(1)), null, String(bad));
});

test('procédures : opts.avoid respecté, sans boucle infinie', () => {
  for (const A of GRID) for (let s = 0; s < 30; s++) {
    const a = P.gen(A, makeRng(`v${A}|${s}`));
    const b = P.gen(A, makeRng(`v${A}|${s}`), { avoid: new Set([a.key]) });
    assert.notEqual(b.key, a.key, `A=${A} clé évitée`);
  }
  const all = new Set();
  for (let s = 0; s < 4000; s++) all.add(P.gen(0, makeRng(`w${s}`)).key);
  const it = P.gen(0, makeRng(1), { avoid: all });
  checkItem(it, 0, 'avoid saturé');
  assert.ok(P.gen(0, makeRng(1), { avoid: [...all] }));
});

test('procédures : opts.kind imposé (premier niveau où la procédure existe)', () => {
  for (const kind of P.KINDS) for (const A of [0, 1, 2.5, 3.6, 4.5, 5.6]) for (let s = 0; s < 25; s++) {
    const it = P.gen(A, makeRng(`k${kind}${A}|${s}`), { kind });
    const ctx = `${kind} imposé à A=${A}`;
    assert.equal(it.kind, kind, ctx);
    checkStrategy(it, checkItem(it, Math.max(A, CLASS_FROM[kind]), ctx), ctx);
  }
  for (const A of [-2, 80, NaN, '3']) checkItem(P.gen(A, makeRng(1)), 0, `A=${A}`);
  checkItem(P.gen(2, makeRng(1), null), 2, 'opts null');
  checkItem(P.gen(2, makeRng(1), { kind: 'inconnu' }), 2, 'kind inconnu');
});

test('procédures : couverture par palier (≥ 200 clés distinctes)', () => {
  const ranges = [[0, 1, 'CP'], [1, 2, 'CE1'], [2, 3, 'CE2'], [3, 4, 'CM1'], [4, 5, 'CM2'], [5, 5.6, '≥ 5']];
  const report = [];
  for (const [a, b, name] of ranges) {
    const keys = new Set();
    for (let s = 0; s < 3000; s++) keys.add(P.gen(a + (b - a) * ((s % 101) / 101), makeRng(`c${a}|${s}`)).key);
    report.push(`${name} : ${keys.size}`);
    assert.ok(keys.size >= 200, `${name} : ${keys.size} clés`);
  }
  /* CP période 1 (nombres ≤ 20) : l'espace est petit, mais varié */
  const p1 = new Set();
  for (let s = 0; s < 2000; s++) p1.add(P.gen(0.1, makeRng(`q${s}`)).key);
  assert.ok(p1.size >= 60, `CP P1 : ${p1.size} clés`);
  console.log('    procédures, clés distinctes par palier (3 000 tirages) : ' + report.join(' · ') + ` · CP P1 : ${p1.size}`);
});

test('procédures : ordres de grandeur en QCM (4 choix distincts, réponse incluse)', () => {
  let n = 0;
  for (const A of [3.5, 3.8, 4.2, 4.5, 5, 5.6]) for (let s = 0; s < 300; s++) {
    const it = P.gen(A, makeRng(`o${A}|${s}`), { kind: 'estimation' });
    checkItem(it, A, `estimation A=${A} « ${it.prompt} »`);
    assert.ok(it.prompt.includes('≈'), it.prompt);
    n++;
  }
  /* exemples officiels : 52 × 37 ≈ 50 × 40 ; 597 ÷ 2 ≈ 300 ; 59 437 ÷ 6 ≈ 10 000 ; 32 × 3 182,5 */
  assert.equal(P.fromKey('ma.procedures:estimation:52x37', 3.5, makeRng(1)).answer, 2000);
  assert.equal(P.fromKey('ma.procedures:estimation:597/2', 3.5, makeRng(1)).answer, 300);
  assert.equal(P.fromKey('ma.procedures:estimation:59437/6', 4.5, makeRng(1)).answer, 10000);
  assert.equal(P.fromKey('ma.procedures:estimation:32x3182.5', 4.5, makeRng(1)).answer, 90000);
  assert.ok(n > 0);
});
