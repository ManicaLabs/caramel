/* Générateur « faits numériques » (js/content/maths/faits.js) — contrat docs/ARCHITECTURE.md §6, §5.5.
   La réponse est recalculée en analysant l'énoncé affiché ; les bornes viennent des listes du BO
   (rapports de recherche maths-c2 §2.4, §3.4, §4.4 ; maths-c3 §4), recopiées ici indépendamment. */
import { test, assert } from './_t.mjs';
import { makeRng } from '../js/core/rng.js';
import { fmtNum } from '../js/core/util.js';
import * as F from '../js/content/maths/faits.js';

const NNBSP = '\u202f';
const GRID = Array.from({ length: 57 }, (_, i) => i / 10);
const SEEDS = 300;
const range = (a, b, step = 1) => { const o = []; for (let x = a; x <= b; x += step) o.push(x); return o; };

/* ---------- listes officielles ---------- */
const DOUBLES = {
  CP: [...range(1, 10), 20, 30, 40, 50],
  CE1: [...range(1, 15), 20, 25, 30, 35, 40, 45, 50, 100, 150, 200, 250, 300, 500],
  CE2: [...range(1, 20), 25, 30, 35, 40, 45, 50, 60, 75, 100, 150, 200, 250, 300, 400, 500, 600]
};
const HALVES = {
  CP: [...range(2, 20, 2), 40, 60, 80, 100],
  CE1: [...range(2, 30, 2), 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 1000],
  CE2: [...range(2, 40, 2), 50, 60, 70, 80, 90, 100, 120, 150, 200, 300, 400, 500, 600, 800, 1000, 1200]
};
const ODD_HALVES = range(1, 15, 2);                                      /* CM2 */
const cls = A => (A < 1 ? 'CP' : A < 2 ? 'CE1' : 'CE2');                 /* CM1, CM2 : listes du CE2 */
/* tables de multiplication disponibles (livret CE1 : 1-6 et 10, puis 7, 8, toutes) */
const tablesAt = A => (A < 1 ? [] : A < 1.2 ? [0, 1, 2, 5, 10] : A < 1.4 ? [0, 1, 2, 3, 4, 5, 6, 10]
  : A < 1.6 ? [0, 1, 2, 3, 4, 5, 6, 7, 10] : A < 1.8 ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 10] : range(0, 10));
const DECOMP60 = ['1x60', '2x30', '3x20', '4x15', '5x12'];
const M25 = ['1x25', '2x25', '3x25', '4x25'];

/* ---------- analyse indépendante de l'énoncé ---------- */
const N = String.raw`\d{1,3}(?:\u202f\d{3})*(?:,\d+)?`;
const H = '…';
const num = t => Number(t.replace(/\u202f/g, '').replace(',', '.'));
const T = `(${N}|${H})`;
function solve(prompt) {
  let m;
  if ((m = new RegExp(`^double de (${N})$`).exec(prompt))) return { op: 'double', n: num(m[1]), ans: 2 * num(m[1]) };
  if ((m = new RegExp(`^moitié de (${N})$`).exec(prompt))) return { op: 'moitié', n: num(m[1]), ans: num(m[1]) / 2 };
  let a, op, b, c, reversed = false;
  if ((m = new RegExp(`^${T} ([+×÷]) ${T} = ${T}$`).exec(prompt))) [, a, op, b, c] = m;
  else if ((m = new RegExp(`^${T} = ${T} ([+×]) ${T}$`).exec(prompt))) { [, c, a, op, b] = m; reversed = true; }
  else return null;
  const holes = [a, b, c].filter(x => x === H).length;
  if (holes !== 1) return null;
  const [x, y, z] = [a, b, c].map(v => (v === H ? null : num(v)));
  let ans;
  if (op === '+') ans = z === null ? x + y : x === null ? z - y : z - x;
  else if (op === '×') ans = z === null ? x * y : x === null ? z / y : z / x;
  else { if (z !== null) return null; ans = x / y; }
  return { op, a: x, b: y, c: z, ans, reversed, hole: a === H ? 'a' : b === H ? 'b' : 'c' };
}
/* termes de l'égalité complète */
function factsOf(it, s) {
  if (s.op === 'double' || s.op === 'moitié') return { n: s.n };
  const full = { a: s.a ?? s.ans, b: s.b ?? s.ans, c: s.c ?? s.ans };
  return full;
}

/* ---------- textes ---------- */
const NUMT = String.raw`\d{1,3}(?:\u202f\d{3})*(?:,\d+)?`;
const parseFr = t => Number(t.replace(/\u202f/g, '').replace(',', '.'));
const OPS = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => a / b };
/* évalue « a op b op c… » (× et ÷ avant + et −) */
function evalExpr(expr) {
  const parts = expr.split(' ');
  const vals = [parseFr(parts[0])], ops = [];
  for (let i = 1; i < parts.length; i += 2) {
    const op = parts[i], v = parseFr(parts[i + 1]);
    if (op === '×' || op === '÷') vals.push(OPS[op](vals.pop(), v)); else { ops.push(op); vals.push(v); }
  }
  return ops.reduce((acc, op, i) => OPS[op](acc, vals[i + 1]), vals[0]);
}
/* toutes les égalités « expr = n » et « n = expr » d'un texte doivent être vraies (expr : un ou plusieurs opérateurs) */
function checkEqualities(text, ctx) {
  const E = `${NUMT}(?: [+−×÷] ${NUMT})+`;
  const re1 = new RegExp(`(?<![\\d,/])(${E}) = (${NUMT})(?![\\d,/])`, 'g');
  const re2 = new RegExp(`(?<![\\d,/])(${NUMT}) = (${E})(?![\\d,/]| [+−×÷])`, 'g');
  assert.ok(!new RegExp(`= ${NUMT}(?: [+−×÷] ${NUMT})* =`).test(text), `chaîne d'égalités « … = … = … » interdite (${ctx}) : ${text}`);
  let m, n = 0;
  while ((m = re1.exec(text))) { assert.ok(Math.abs(evalExpr(m[1]) - parseFr(m[2])) < 1e-9, `égalité fausse « ${m[0]} » (${ctx})`); n++; }
  while ((m = re2.exec(text))) { assert.ok(Math.abs(evalExpr(m[2]) - parseFr(m[1])) < 1e-9, `égalité fausse « ${m[0]} » (${ctx})`); n++; }
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
  assert.ok(!/(^|[^a-zé])-\d/.test(s), `tiret au lieu du signe moins dans « ${s} »`);
}
const tokens = s => (s.match(new RegExp(`(?<![\\d,])${NUMT}(?![\\d,])`, 'g')) || []);

/* ---------- vérification d'un item ---------- */
function checkItem(it, A, ctx = `A=${A}`) {
  assert.equal(it.axis, 'ma.faits', ctx);
  assert.ok(F.KINDS.includes(it.kind), `${ctx} kind ${it.kind}`);
  assert.ok(Number.isFinite(it.A) && it.A >= 0 && it.A <= 5.6, `${ctx} A`);
  checkText(it.hint, ctx); checkText(it.explain, ctx);
  assert.ok(!it.prompt.includes('−'), `${ctx} pas de signe − dans un fait mémorisé : ${it.prompt}`);
  assert.ok(!it.choices, `${ctx} réponse saisie (pavé ou voix), pas de QCM`);
  const s = solve(it.prompt);
  assert.ok(s, `${ctx} énoncé illisible « ${it.prompt} »`);
  assert.ok(Math.abs(s.ans - it.answer) < 1e-9, `${ctx} réponse ${it.answer} ≠ ${s.ans} pour « ${it.prompt} »`);
  assert.ok(it.answer >= 0 && Number.isFinite(it.answer), ctx);
  assert.ok(Number.isInteger(it.answer) || Math.abs(it.answer * 1000 - Math.round(it.answer * 1000)) < 1e-6, `${ctx} ≤ 3 décimales`);
  /* l'énoncé est écrit avec fmtNum */
  for (const t of it.prompt.match(new RegExp(N, 'g')) || []) assert.equal(t, fmtNum(num(t)), `${ctx} écriture ${t}`);
  /* data */
  const d = it.data;
  assert.equal(d.voice, Number.isInteger(it.answer) && it.answer <= 1000, `${ctx} voice`);
  assert.equal(d[d.hole], it.answer, `${ctx} data[hole] = answer`);
  if (s.op === 'double' || s.op === 'moitié') {
    assert.equal(d.op, s.op); assert.equal(d.a, s.n); assert.equal(d.b, null); assert.equal(d.hole, 'c');
  } else {
    assert.equal(d.op, s.op, ctx);
    assert.equal(d.reversed, s.reversed, ctx); assert.equal(d.hole, s.hole, ctx);
    const full = factsOf(it, s);
    assert.ok(Math.abs(OPS[d.op](d.a, d.b) - d.c) < 1e-9, `${ctx} data : égalité vraie`);
    assert.deepEqual([d.a, d.b, d.c].map(x => Math.round(x * 1e6)), [full.a, full.b, full.c].map(x => Math.round(x * 1e6)), ctx);
  }
  /* kind, clé, Leitner, seuil de vitesse */
  const kindOf = () => {
    if (s.op === 'double') return 'double';
    if (s.op === 'moitié') return 'moitie';
    if (s.op === '+') return d.c === 10 ? 'c10' : 'add';
    const isP10 = (d.op === '×' || d.op === '÷') && [10, 100, 1000].includes(d.b) && (!Number.isInteger(d.a) || !Number.isInteger(d.c) || d.a > 10 || d.c > 100 || it.key.includes('p10'));
    if (it.key.includes(':p10:')) return 'p10';
    if (isP10 && !/^ma\.faits:\d+x\d+$/.test(it.key)) return 'p10';
    return s.op === '÷' ? 'div' : s.hole === 'c' ? 'mul' : 'facteur';
  };
  assert.equal(it.kind, kindOf(), `${ctx} kind ${it.kind} pour « ${it.prompt} »`);
  let key;
  if (it.kind === 'add') key = `ma.faits:add:${Math.min(d.a, d.b)}+${Math.max(d.a, d.b)}`;
  else if (it.kind === 'c10') key = `ma.faits:c10:${Math.min(d.a, d.b)}`;
  else if (it.kind === 'double') key = `ma.faits:dbl:${d.a}`;
  else if (it.kind === 'moitie') key = `ma.faits:half:${d.a}`;
  else if (it.kind === 'mul' || it.kind === 'facteur') key = `ma.faits:${Math.min(d.a, d.b)}x${Math.max(d.a, d.b)}`;
  else if (it.kind === 'div') key = `ma.faits:${Math.min(d.b, d.c)}x${Math.max(d.b, d.c)}`;
  else key = `ma.faits:p10:${d.a}${d.op === '×' ? 'x' : '/'}${d.b}`;
  assert.equal(it.key, key, `${ctx} clé`);
  assert.equal(it.leitner, it.kind !== 'p10', ctx);
  const dec = !Number.isInteger(it.answer) || (it.kind === 'p10' && !Number.isInteger(d.a));
  assert.equal(it.autoMs, dec ? 5000 : it.kind === 'p10' ? 4000 : 3000, `${ctx} autoMs`);
  /* textes : égalités vraies ; l'explication donne la réponse ; l'indice ne la donne pas */
  checkEqualities(it.explain, `${ctx} explain`);
  checkEqualities(it.hint, `${ctx} hint`);
  assert.ok(tokens(it.explain).includes(fmtNum(it.answer)), `${ctx} l'explication donne ${it.answer} : ${it.explain}`);
  const shown = new Set(tokens(it.prompt));
  assert.ok(!tokens(it.hint).includes(fmtNum(it.answer)) || shown.has(fmtNum(it.answer)), `${ctx} l'indice révèle la réponse : ${it.hint}`);
  return s;
}
/* bornes du programme au niveau A */
function checkBounds(it, A, ctx) {
  const d = it.data, k = it.kind;
  if (A < 1) assert.ok(['add', 'c10', 'double', 'moitie'].includes(k), `${ctx} CP : ${k}`);
  if (A < 3) assert.ok(!['div', 'p10'].includes(k), `${ctx} pas de ÷ ni de p10 avant le CM1 (${it.prompt})`);
  if (A < 1.5) assert.notEqual(k, 'facteur', `${ctx} facteur manquant dès 1,5`);
  if (k === 'add' || k === 'c10') {
    assert.ok(d.a >= 0 && d.a <= 10 && d.b >= 0 && d.b <= 10, `${ctx} tables d'addition 0-10`);
    if (k === 'c10') assert.ok(d.a >= 1 && d.b >= 1, `${ctx} compléments : 1 + 9 … 9 + 1`);
    if (Math.min(d.a, d.b) === 0) assert.ok(A >= 0.3, `${ctx} « + 0 » après les premières semaines`);
    if (A < 0.3 && k === 'add') assert.ok(d.c <= 9, `${ctx} CP P1 : sommes ≤ 9`);
    if (A < 0.6 && k === 'add') assert.ok(d.c <= 13 && Math.max(d.a, d.b) <= 9, `${ctx} CP : passage de la dizaine progressif`);
  }
  if (k === 'double') assert.ok(DOUBLES[cls(A)].includes(d.a), `${ctx} double de ${d.a} hors liste ${cls(A)}`);
  if (k === 'moitie') {
    if (d.a % 2) assert.ok(A >= 4 && ODD_HALVES.includes(d.a), `${ctx} moitié d'un impair seulement au CM2`);
    else assert.ok(HALVES[cls(A)].includes(d.a), `${ctx} moitié de ${d.a} hors liste ${cls(A)}`);
  }
  if (k === 'mul' || k === 'facteur' || k === 'div') {
    const [x, y] = it.key.split(':')[1].split('x').map(Number);
    const tag = `${x}x${y}`;
    if (M25.includes(tag)) assert.ok(A >= 1.5, `${ctx} multiples de 25 au CE1 (dès 1,5)`);
    else if (DECOMP60.includes(tag)) assert.ok(A >= 2.3, `${ctx} décompositions de 60 au CE2`);
    else {
      assert.ok(x >= 0 && y <= 10, `${ctx} facteurs ≤ 10`);
      const t = tablesAt(A);
      assert.ok(t.includes(x) || t.includes(y), `${ctx} ${tag} : table pas encore étudiée à A=${A}`);
    }
    if (k !== 'mul') assert.ok(x > 0, `${ctx} jamais 0 dans un trou`);
  }
  if (k === 'p10') {
    const decs = n => { const t = String(n); return t.includes('.') ? t.split('.')[1].length : 0; };
    const maxDec = A < 3.3 ? 0 : A < 4 ? 2 : 3, cap = A < 3.4 ? 9999 : 999999;
    for (const n of [d.a, d.c]) { assert.ok(decs(n) <= maxDec, `${ctx} ${n} : décimales`); assert.ok(n <= cap, `${ctx} ${n} > ${cap}`); }
    if (A < 3.3) assert.equal(d.op, '×', `${ctx} CM1 P1-P2 : entier × 10, 100, 1 000`);
    if (A < 4 && (decs(d.a) || decs(d.c) || d.op === '÷')) assert.equal(d.b, 10, `${ctx} CM1 : décimal × 10 et ÷ 10 seulement`);
  }
}

/* ---------- tests ---------- */
test('faits : exports du contrat', () => {
  assert.equal(F.axis, 'ma.faits');
  for (const fn of ['gen', 'fromKey', 'describeKey']) assert.equal(typeof F[fn], 'function', fn);
  assert.deepEqual(F.KINDS, ['add', 'c10', 'double', 'moitie', 'mul', 'facteur', 'div', 'p10']);
});

test('faits : déterminisme (gen et fromKey)', () => {
  for (const A of GRID) for (let s = 0; s < 20; s++) assert.deepEqual(F.gen(A, makeRng(`d${s}`)), F.gen(A, makeRng(`d${s}`)), `A=${A}`);
  for (const k of ['ma.faits:7x8', 'ma.faits:add:3+9', 'ma.faits:c10:4', 'ma.faits:dbl:35', 'ma.faits:half:70', 'ma.faits:p10:3.5x100'])
    for (const A of [0.5, 2.5, 4.5]) assert.deepEqual(F.fromKey(k, A, makeRng(3)), F.fromKey(k, A, makeRng(3)), k);
});

test('faits : items bien formés et justes sur toute la grille (57 niveaux × 300 graines)', () => {
  for (const A of GRID) for (let s = 0; s < SEEDS; s++) {
    const it = F.gen(A, makeRng(`g${A}|${s}`));
    checkItem(it, A, `A=${A} s=${s} « ${it.prompt} »`);
    checkBounds(it, A, `A=${A} s=${s} « ${it.prompt} »`);
    assert.ok(it.A <= A + 1e-9, `A=${A} : niveau réel ${it.A} ≤ demandé`);
  }
  for (const A of [0.29, 0.3, 0.59, 0.6, 0.99, 1.19, 1.2, 1.39, 1.4, 1.49, 1.5, 1.59, 1.6, 1.79, 1.8, 1.99, 2.29, 2.3, 2.99, 3, 3.29, 3.3, 3.39, 3.4, 3.99, 4, 5.6])
    for (let s = 0; s < 200; s++) { const it = F.gen(A, makeRng(`e${A}|${s}`)); checkItem(it, A); checkBounds(it, A, `A=${A} « ${it.prompt} »`); }
});

test('faits : présentations selon le niveau (produit, facteur manquant, division)', () => {
  const kinds = (A0, A1, n = 1500) => {
    const c = {};
    for (let s = 0; s < n; s++) { const it = F.gen(A0 + (A1 - A0) * ((s % 50) / 50), makeRng(`p${A0}|${s}`)); c[it.kind] = (c[it.kind] || 0) + 1; }
    return c;
  };
  const cp = kinds(0, 1);
  assert.ok(cp.add && cp.c10 && cp.double && cp.moitie, 'CP : additions, compléments, doubles, moitiés');
  const ce1a = kinds(1, 1.5), ce1b = kinds(1.5, 2), ce2 = kinds(2, 3), cm = kinds(3, 5.6);
  assert.ok(ce1a.mul && !ce1a.facteur && !ce1a.div, 'CE1 début : produits seulement');
  assert.ok(ce1b.facteur && !ce1b.div, 'CE1 fin : facteur manquant, pas de division');
  assert.ok(ce2.facteur > ce1b.facteur && !ce2.div && !ce2.p10, 'CE2 : les deux sens');
  assert.ok(cm.div > 100 && cm.p10 > 100 && cm.facteur > 100, 'CM : quotients associés et × ÷ 10, 100, 1 000');
});

test('faits : progression des tables au CE1 et pondération vers les faits difficiles', () => {
  const hardShare = A => {
    let hard = 0, n = 0;
    for (let s = 0; s < 3000; s++) {
      const it = F.gen(A, makeRng(`h${A}|${s}`), { kind: 'mul' });
      const [x, y] = it.key.split(':')[1].split('x').map(Number);
      n++; if (x >= 6 && y <= 9) hard++;
    }
    return hard / n;
  };
  const h2 = hardShare(2), h4 = hardShare(4.5);
  assert.ok(h4 > 1.4 * h2, `part des faits 6-9 × 6-9 : ${h2.toFixed(2)} (A=2) → ${h4.toFixed(2)} (A=4,5)`);
  assert.ok(h4 > 0.4, `au CM2, les 10 faits difficiles (sur 59) font plus de 40 % des produits (${h4.toFixed(2)})`);
  console.log(`    faits : part des 6-9 × 6-9 parmi les produits ${h2.toFixed(2)} (A = 2) → ${h4.toFixed(2)} (A = 4,5)`);
  /* la table qui vient d'arriver est entraînée */
  let sevens = 0;
  for (let s = 0; s < 1000; s++) if (/\b7\b/.test(F.gen(1.45, makeRng(`t${s}`), { kind: 'mul' }).prompt)) sevens++;
  assert.ok(sevens > 150, `table de 7 travaillée à son arrivée (${sevens}/1000)`);
});

test('faits : fromKey reconstruit le même fait, présenté selon A', () => {
  const keys = new Set();
  for (const A of GRID) for (let s = 0; s < 60; s++) { const it = F.gen(A, makeRng(`r${A}|${s}`)); if (it.leitner) keys.add(it.key); }
  assert.ok(keys.size > 150, `${keys.size} clés Leitner rencontrées`);
  for (const key of keys) for (const A of [0, 1.2, 1.7, 2.5, 3.5, 5.6]) {
    const it = F.fromKey(key, A, makeRng(`${key}|${A}`));
    assert.ok(it, key);
    assert.equal(it.key, key, `fromKey(${key}) garde la clé`);
    checkItem(it, A, `fromKey ${key} A=${A}`);
    if (/^ma\.faits:\d+x\d+$/.test(key)) {
      if (A < 1.5) assert.equal(it.kind, 'mul', `${key} : produit simple sous 1,5`);
      if (A < 3) assert.notEqual(it.kind, 'div', `${key} : pas de division sous 3`);
    }
  }
  /* les trois présentations apparaissent pour un même fait au CM */
  const forms = new Set();
  for (let s = 0; s < 60; s++) forms.add(F.fromKey('ma.faits:7x8', 4, makeRng(s)).kind);
  assert.deepEqual([...forms].sort(), ['div', 'facteur', 'mul']);
  /* clés invalides */
  for (const bad of ['', 'ma.faits:', 'ma.faits:11x12', 'ma.faits:8x7', 'ma.faits:add:5+5', 'ma.faits:add:0+10', 'ma.faits:c10:7', 'ma.faits:dbl:17x',
    'ma.faits:half:31', 'ma.ligne:lire:0-10:3', 'fr.conjug:etre|present|1s', 'ma.faits:p10:3.5x7', null, undefined]) assert.equal(F.fromKey(bad, 2, makeRng(1)), null, String(bad));
});

test('faits : describeKey (espace parents)', () => {
  assert.equal(F.describeKey('ma.faits:7x8'), '7 × 8 = 56');
  assert.equal(F.describeKey('ma.faits:add:7+8'), '7 + 8 = 15');
  assert.equal(F.describeKey('ma.faits:c10:3'), '3 + 7 = 10');
  assert.equal(F.describeKey('ma.faits:dbl:150'), 'double de 150 = 300');
  assert.equal(F.describeKey('ma.faits:half:9'), 'moitié de 9 = 4,5');
  assert.equal(F.describeKey('ma.faits:p10:3.5x100'), '3,5 × 100 = 350');
  assert.equal(F.describeKey('ma.faits:p10:4200/1000'), `4${NNBSP}200 ÷ 1${NNBSP}000 = 4,2`);
  assert.equal(F.describeKey('inconnu'), 'inconnu');
});

test('faits : opts.avoid respecté, sans boucle infinie', () => {
  for (const A of GRID) for (let s = 0; s < 30; s++) {
    const a = F.gen(A, makeRng(`v${A}|${s}`));
    const b = F.gen(A, makeRng(`v${A}|${s}`), { avoid: new Set([a.key]) });
    assert.notEqual(b.key, a.key, `A=${A} clé évitée`);
  }
  const all = new Set();
  for (let s = 0; s < 3000; s++) all.add(F.gen(0, makeRng(`w${s}`)).key);
  const it = F.gen(0, makeRng(1), { avoid: all });
  checkItem(it, 0);
  assert.ok(F.gen(0, makeRng(1), { avoid: [...all] }));
});

test('faits : opts.kind imposé (premier niveau où le sous-type existe)', () => {
  const FROM = { add: 0, c10: 0, double: 0, moitie: 0.1, mul: 1, facteur: 1.5, div: 3, p10: 3 };
  for (const kind of F.KINDS) for (const A of [0, 1, 2, 3.2, 4.4, 5.6]) for (let s = 0; s < 30; s++) {
    const it = F.gen(A, makeRng(`k${kind}${s}`), { kind });
    assert.equal(it.kind, kind, `${kind} à A=${A}`);
    assert.ok(it.A >= FROM[kind] - 1e-9, `${kind} : niveau réel ≥ ${FROM[kind]}`);
    checkItem(it, Math.max(A, FROM[kind]));
    checkBounds(it, Math.max(A, FROM[kind]), `${kind} imposé`);
  }
  checkItem(F.gen(-2, makeRng(1)), 0); checkItem(F.gen(80, makeRng(1)), 5.6); checkItem(F.gen(NaN, makeRng(1)), 0);
});

test('faits : couverture par palier (≥ 200 clés quand le programme le permet)', () => {
  const ranges = [[0, 1, 'CP'], [1, 2, 'CE1'], [2, 3, 'CE2'], [3, 4, 'CM1'], [4, 5, 'CM2'], [5, 5.6, '≥ 5']];
  /* nombre de faits du programme (sans p10) : additions 50 + compléments 5 + doubles + moitiés + produits */
  /* additions : 55 paires de 1 à 10 − 5 compléments + 9 « 0 + n » ; produits : 55 + 10 « 0 × n » */
  const space = { CP: 59 + 5 + DOUBLES.CP.length + HALVES.CP.length,
    CE1: 59 + 5 + DOUBLES.CE1.length + HALVES.CE1.length + 65 + 4,
    CE2: 59 + 5 + DOUBLES.CE2.length + HALVES.CE2.length + 65 + 4 + 5 };
  const report = [];
  for (const [a, b, name] of ranges) {
    const keys = new Set();
    for (let s = 0; s < 6000; s++) keys.add(F.gen(a + (b - a) * ((s % 101) / 101), makeRng(`c${a}|${s}`)).key);
    report.push(`${name} : ${keys.size}${space[name] ? ` / ${space[name]} faits` : ''}`);
    if (space[name]) assert.ok(keys.size >= 0.9 * space[name], `${name} : ${keys.size} clés pour ${space[name]} faits au programme`);
    else assert.ok(keys.size >= 200, `${name} : ${keys.size} clés`);
  }
  console.log('    faits, clés distinctes par palier (6 000 tirages) : ' + report.join(' · '));
});

test('faits : stratégies attendues dans les indices', () => {
  const hintOf = (k, A = 2.5) => { for (let s = 0; s < 40; s++) { const it = F.fromKey(k, A, makeRng(s)); if (it.kind === 'mul') return it; } return null; };
  assert.match(hintOf('ma.faits:7x8').hint, /double de/);
  assert.match(hintOf('ma.faits:6x9').hint, /× 10 moins une fois/);
  assert.match(hintOf('ma.faits:5x7').hint, /moitié de × 10/);
  assert.match(F.fromKey('ma.faits:7x8', 1, makeRng(2)).explain, /5, 6, 7, 8 → 56 = 7 × 8/);
  const add = F.fromKey('ma.faits:add:6+7', 0.6, makeRng(1));
  if (add.kind === 'add' && add.data.hole === 'c') assert.match(add.hint, /double de 6, plus 1/);
  for (let s = 0; s < 30; s++) {
    const it = F.fromKey('ma.faits:add:5+8', 1, makeRng(s));
    if (it.data.hole === 'c') { assert.match(it.hint, /Passe par 10/); assert.match(it.explain, /8 \+ 2 = 10, puis 10 \+ 3 = 13/); break; }
  }
  const half = F.fromKey('ma.faits:half:9', 4.2, makeRng(1));
  assert.equal(half.answer, 4.5); assert.equal(half.data.voice, false); assert.equal(half.autoMs, 5000);
  const p = F.fromKey('ma.faits:p10:0.45/10', 4.2, makeRng(1));
  assert.equal(p.answer, 0.045); assert.match(p.explain, /4 dixièmes deviennent 4 centièmes et 5 centièmes deviennent 5 millièmes/);
});
