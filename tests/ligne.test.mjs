/* Générateur « ligne graduée » (js/content/maths/ligne.js) — contrat docs/ARCHITECTURE.md §6.
   Toutes les vérifications recalculent indépendamment : graduations, bornes du programme par palier
   (table ci-dessous, tirée des rapports de recherche), égalités des explications, choix du QCM. */
import { test, assert } from './_t.mjs';
import { makeRng } from '../js/core/rng.js';
import { fmtNum } from '../js/core/util.js';
import * as L from '../js/content/maths/ligne.js';

const NNBSP = '\u202f';
const EPS = 1e-7;
const GRID = Array.from({ length: 57 }, (_, i) => Math.round(i) / 10);     /* 0 → 5,6 par pas de 0,1 */
const SEEDS = 300;
const isMult = (x, step) => Math.abs(x / step - Math.round(x / step)) < 1e-6;
const decimalsOf = x => { const s = String(Math.round(x * 1e6) / 1e6); return s.includes('.') ? s.split('.')[1].length : 0; };

/* ---------- bornes du programme (indépendantes du module) ----------
   CP : de 1 en 1, ≤ 20 (P1) / 59 (P2) / 100 ; CE1 : ≤ 1 000 (≤ 500 en P1) ; CE2 : ≤ 10 000 (≤ 5 000 en P1) ;
   CM1 : ≤ 9 999 en P1-P2 puis ≤ 999 999 ; CM2 : ≤ 999 999 en P1-P2 puis ≤ 999 999 999 (jamais le milliard).
   Fractions : dès 2,6 (CE2 P3), < 1 et dénominateur ≤ 12 au CE2 ; ≤ 20 au CM1 ; 2 à 12 au CM2.
   Décimaux : dès 3,2 (CM1 P2) ; 1 décimale avant 3,6 ; 2 avant 4 ; 3 ensuite. */
function bounds(A) {
  const intMax = A < 0.35 ? 20 : A < 0.65 ? 59 : A < 1 ? 100 : A < 1.2 ? 500 : A < 2 ? 1000 : A < 2.2 ? 5000
    : A < 3 ? 10000 : A < 3.4 ? 9999 : A < 4.4 ? 999999 : 999999999;
  const maxDec = A < 3.2 ? 0 : A < 3.6 ? 1 : A < 4 ? 2 : 3;
  const frac = A < 2.6 ? null : A < 3 ? { maxDen: 12, improper: false } : A < 4 ? { maxDen: 20, improper: true } : { maxDen: 12, improper: true };
  const minors = A < 1 ? [1] : A < 2 ? [1, 10, 100] : A < 3.4 ? [1, 10, 100, 1000] : null;
  return { intMax, maxDec, frac, minors };
}
const tolPct = A => (A < 2 ? 0.04 : A < 4 ? 0.025 : 0.015);

/* ---------- textes : typographie et égalités ---------- */
const NUM = String.raw`\d{1,3}(?:\u202f\d{3})*(?:,\d+)?(?:\/\d+)?`;
const parseFr = t => {
  if (t.includes('/')) { const [n, d] = t.split('/'); return Number(n.replace(/\u202f/g, '')) / Number(d); }
  return Number(t.replace(/\u202f/g, '').replace(',', '.'));
};
const OPS = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => a / b };
/* toutes les égalités « a op b = c » et « c = a op b » d'un texte doivent être vraies */
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
  const E = `${NUM}(?: [+−×÷] ${NUM})+`;
  const re1 = new RegExp(`(?<![\\d,/])(${E}) = (${NUM})(?![\\d,/])`, 'g');
  const re2 = new RegExp(`(?<![\\d,/])(${NUM}) = (${E})(?![\\d,/]| [+−×÷])`, 'g');
  assert.ok(!new RegExp(`= ${NUM}(?: [+−×÷] ${NUM})* =`).test(text), `chaîne d'égalités « … = … = … » interdite (${ctx}) : ${text}`);
  let m, n = 0;
  while ((m = re1.exec(text))) { assert.ok(Math.abs(evalExpr(m[1]) - parseFr(m[2])) < 1e-9, `égalité fausse « ${m[0]} » (${ctx})`); n++; }
  while ((m = re2.exec(text))) { assert.ok(Math.abs(evalExpr(m[2]) - parseFr(m[1])) < 1e-9, `égalité fausse « ${m[0]} » (${ctx})`); n++; }
  return n;
}
function checkText(s, ctx) {
  assert.equal(typeof s, 'string', ctx);
  assert.ok(s.length > 3, `texte vide : ${ctx}`);
  assert.ok(!/undefined|NaN|null|\[object|Infinity/.test(s), `texte invalide « ${s} » (${ctx})`);
  assert.ok(!/'/.test(s), `apostrophe droite dans « ${s} »`);
  assert.ok(!/ [?!;:]/.test(s), `espace ordinaire avant ? ! ; : dans « ${s} »`);
  assert.ok(!/\S[?!;]/.test(s.replace(new RegExp(NNBSP + '[?!;]', 'g'), '')), `ponctuation haute collée dans « ${s} »`);
  assert.ok(!/ {2}/.test(s), `double espace dans « ${s} »`);
  assert.ok(!/-(?=\d)/.test(s.replace(/[a-zé]-(?=\d)/g, '')), `tiret au lieu du signe moins dans « ${s} »`);
}
const tokens = s => (s.match(new RegExp(NUM, 'g')) || []);

/* ---------- vérification complète d'un item ---------- */
function checkItem(it, A, ctx = `A=${A}`) {
  const d = it.data;
  assert.equal(it.axis, 'ma.ligne', ctx);
  assert.ok(L.KINDS.includes(it.kind), `${ctx} kind ${it.kind}`);
  assert.equal(it.leitner, false, ctx);
  assert.ok(Number.isFinite(it.A) && it.A >= 0 && it.A <= 5.6, `${ctx} A ${it.A}`);
  assert.ok(['lire', 'placer'].includes(d.mode), ctx);
  assert.equal(it.answer, d.value, `${ctx} answer = data.value`);
  assert.equal(d.fmt, { entier: 'int', decimal: 'dec', fraction: 'frac' }[it.kind], ctx);
  for (const s of [it.prompt, it.hint, it.explain]) checkText(s, `${ctx} ${it.key}`);
  /* graduations */
  const plane = d.zoom || d;
  for (const p of [d, ...(d.zoom ? [d.zoom] : [])]) {
    assert.ok(p.max > p.min && p.minor > 0 && p.major >= p.minor - EPS, `${ctx} graduation ${JSON.stringify(p)}`);
    assert.ok(isMult(p.major, p.minor), `${ctx} major multiple de minor`);
    assert.ok(isMult(p.min, p.minor) && isMult(p.max, p.minor), `${ctx} bornes sur des piquets`);
    const nMinor = Math.round((p.max - p.min) / p.minor);
    assert.ok(nMinor >= 2 && nMinor <= 20, `${ctx} ${nMinor} petits intervalles`);
    assert.ok((p.max - p.min) / p.major <= 12 + EPS, `${ctx} trop de grands intervalles`);
    assert.ok(p.labels.length >= 2, `${ctx} au moins 2 plaquettes`);
    let prev = -Infinity;
    for (const lb of p.labels) {
      assert.ok(lb.v > prev, `${ctx} plaquettes triées`); prev = lb.v;
      assert.ok(lb.v >= p.min - EPS && lb.v <= p.max + EPS && isMult(lb.v, p.minor), `${ctx} plaquette ${lb.v} hors piquet`);
      assert.equal(lb.text, it.kind === 'fraction' ? String(lb.v) : fmtNum(lb.v), `${ctx} écriture de plaquette`);
    }
    /* les plaquettes tiennent sur un téléphone : écart ≥ 0,035 + 0,027 × longueur */
    const len = Math.max(...p.labels.map(lb => [...lb.text].reduce((n, c) => n + (c === NNBSP ? 0.5 : 1), 0)));
    for (let i = 1; i < p.labels.length; i++) {
      const gap = (p.labels[i].v - p.labels[i - 1].v) / (p.max - p.min);
      assert.ok(gap >= 0.035 + 0.027 * len - 1e-6, `${ctx} plaquettes trop serrées ${p.labels.map(x => x.text)}`);
    }
  }
  if (d.zoom) {
    assert.ok(Math.abs(d.zoom.max - d.zoom.min - d.minor) < EPS, `${ctx} le zoom agrandit un petit intervalle`);
    assert.ok(d.zoom.min >= d.min - EPS && d.zoom.max <= d.max + EPS && isMult(d.zoom.min, d.minor), `${ctx} zoom dans la ligne`);
    assert.ok(Math.abs(d.zoom.minor * 10 - d.minor) < EPS, `${ctx} zoom en dixièmes du pas`);
  }
  /* cible */
  assert.ok(d.value >= plane.min - EPS && d.value <= plane.max + EPS, `${ctx} cible dans la portion`);
  assert.ok(!plane.labels.some(lb => Math.abs(lb.v - d.value) < EPS), `${ctx} cible sur une plaquette`);
  if (d.snap) {
    assert.ok(isMult(d.value - plane.min, plane.minor), `${ctx} cible sur un piquet`);
    assert.ok(Math.abs(d.tolerance - plane.minor / 2) < 1e-6, `${ctx} tolérance = demi-graduation`);
  } else {
    assert.equal(d.mode, 'placer', `${ctx} non aimanté seulement pour placer`);
    assert.ok(!isMult(d.value - plane.min, plane.minor), `${ctx} estimation : cible entre deux piquets`);
    /* progressive, mais jamais moins de ±2 dixièmes d'intervalle (revue D2-05) */
    const exp = Math.max(tolPct(it.A) * (plane.max - plane.min), 0.2 * plane.minor);
    assert.ok(Math.abs(d.tolerance - exp) < 1e-6, `${ctx} tolérance progressive ${d.tolerance} ≠ ${exp}`);
    assert.ok(d.tolerance >= 0.2 * plane.minor - 1e-9, `${ctx} au moins 5 positions acceptées`);
    const r = (d.value - plane.min) / plane.minor, dist = Math.min(r - Math.floor(r), Math.ceil(r) - r) * plane.minor;
    assert.ok(dist > d.tolerance, `${ctx} la tolérance ne doit pas atteindre un piquet voisin`);
  }
  /* écriture de la cible et fractions */
  if (it.kind === 'fraction') {
    assert.ok(Number.isInteger(d.num) && Number.isInteger(d.den) && d.den >= 2, ctx);
    assert.equal(d.value, d.num / d.den, ctx);
    assert.equal(d.text, `${d.num}/${d.den}`, ctx);
    assert.ok(d.num % d.den !== 0, `${ctx} jamais un entier en fraction`);
    assert.ok(Math.abs(d.minor - 1 / d.den) < EPS && d.major === 1, ctx);
  } else {
    assert.equal(d.text, fmtNum(d.value), ctx);
    if (it.kind === 'entier') assert.ok(Number.isInteger(d.value), ctx);
    else assert.ok(!Number.isInteger(d.value), `${ctx} décimal non entier`);
  }
  /* clé : 'ma.ligne:<mode>:<min>-<max>:<valeur>' */
  assert.equal(it.key, `ma.ligne:${d.mode}:${d.min}-${d.max}:${it.kind === 'fraction' ? d.text : d.value}`, ctx);
  /* consignes */
  if (d.mode === 'placer') assert.equal(it.prompt, `Place ${d.text} sur la clôture.`, ctx);
  else assert.ok(/drapeau/.test(it.prompt), ctx);
  /* QCM : CP/CE1 en lecture, et fractions */
  const wantChoices = d.mode === 'lire' && (it.A < 2 || it.kind === 'fraction');
  assert.equal(!!it.choices, wantChoices, `${ctx} QCM attendu : ${wantChoices}`);
  if (it.choices) {
    assert.equal(it.choices.length, 6, ctx);
    assert.equal(new Set(it.choices.map(c => c.label)).size, 6, `${ctx} libellés distincts`);
    assert.equal(new Set(it.choices.map(c => Math.round(c.value * 1e9))).size, 6, `${ctx} valeurs distinctes`);
    assert.equal(it.choices.filter(c => Math.abs(c.value - it.answer) < 1e-12).length, 1, `${ctx} réponse une seule fois`);
    for (const c of it.choices) {
      assert.ok(c.value > 0 || (c.value === 0 && it.kind === 'entier'), `${ctx} choix positif`);
      if (it.kind === 'fraction') {
        assert.equal(c.label, `${c.num}/${c.den}`, ctx);
        assert.equal(c.value, c.num / c.den, ctx);
        if (it.A < 3) assert.ok(c.num < c.den && c.den <= 12, `${ctx} CE2 : jamais de fraction ≥ 1 (${c.label})`);
        else assert.ok(c.den <= (it.A < 4 ? 20 : 60), `${ctx} dénominateur ${c.label}`);
      } else {
        assert.ok(Number.isInteger(c.value), ctx);
        assert.equal(c.label, fmtNum(c.value), ctx);
        assert.ok(!d.labels.some(lb => lb.v === c.value), `${ctx} un distracteur ne doit pas être une plaquette`);
      }
    }
  }
  /* explication : égalités vraies, et elle donne la réponse */
  const nEq = checkEqualities(it.explain, `${ctx} explain ${it.key}`);
  const fromZero = /après 0\b/.test(it.explain) && !/\b0 \+/.test(it.explain);
  if (d.snap && !fromZero && (it.kind !== 'fraction' || d.value > 1)) assert.ok(nEq >= 1, `${ctx} l'explication montre le calcul : ${it.explain}`);
  assert.ok(d.value > 0, `${ctx} jamais de cible sur l'origine 0`);
  assert.ok(!/(^|[^\d,])0 [+−] /.test(it.explain), `${ctx} pas de « 0 + … » : ${it.explain}`);
  checkEqualities(it.hint, `${ctx} hint ${it.key}`);
  assert.ok(tokens(it.explain).includes(d.text), `${ctx} l'explication donne ${d.text} : ${it.explain}`);
  /* l'indice ne donne pas la réponse (sauf si elle se confond avec le pas ou figure dans la consigne) */
  if (d.mode === 'lire') {
    const step = it.kind === 'fraction' ? `1/${d.den}` : fmtNum(plane.minor);
    /* les nombres de l'indice, hors comptes d'intervalles (« il y a 10 petits intervalles », « en 4 parts ») */
    const h = it.hint.replace(/il y a \d+ (petits )?intervalles/g, '').replace(/en \d+ parts/g, '').replace(/en \d+ pour/g, '');
    assert.ok(!tokens(h).includes(d.text) || d.text === step, `${ctx} l'indice révèle ${d.text} : ${it.hint}`);
  }
}
function checkBounds(it, A, ctx) {
  const b = bounds(A), d = it.data;
  const nums = [d.min, d.max, d.value, ...d.labels.map(x => x.v), ...(d.zoom ? [d.zoom.min, d.zoom.max] : [])];
  for (const n of nums) {
    assert.ok(n >= 0 && n <= b.intMax, `${ctx} nombre ${n} hors du palier (≤ ${b.intMax}) ${it.key}`);
    assert.ok(n < 1e9, `${ctx} jamais le milliard`);
    if (it.kind !== 'fraction') assert.ok(decimalsOf(n) <= b.maxDec, `${ctx} ${n} : trop de décimales (≤ ${b.maxDec})`);
  }
  if (it.choices && it.kind === 'entier') for (const c of it.choices) assert.ok(c.value <= b.intMax * 1.2 + 20, `${ctx} choix ${c.value}`);
  if (it.kind === 'fraction') {
    assert.ok(b.frac, `${ctx} pas de fraction avant 2,6`);
    assert.ok(d.den <= b.frac.maxDen, `${ctx} dénominateur ${d.den} > ${b.frac.maxDen}`);
    if (!b.frac.improper) assert.ok(d.value < 1 && d.min === 0 && d.max === 1, `${ctx} CE2 : règle de 0 à 1, fraction < 1`);
    if (A < 2.8) assert.ok([4, 8, 10].includes(d.den), `${ctx} CE2 P3 : quarts, huitièmes, dixièmes`);
  }
  if (it.kind === 'decimal') assert.ok(A >= 3.2, `${ctx} pas de décimal avant 3,2`);
  if (A < 1) assert.equal(d.minor, 1, `${ctx} CP : de 1 en 1`);
  if (b.minors && it.kind === 'entier') assert.ok(b.minors.includes(d.minor), `${ctx} pas ${d.minor} hors programme`);
}

/* ---------- tests ---------- */
test('ligne : exports du contrat', () => {
  assert.equal(L.axis, 'ma.ligne');
  assert.equal(typeof L.gen, 'function');
  assert.equal(L.fromKey, undefined, 'pas de Leitner pour la ligne graduée');
  assert.deepEqual(L.KINDS, ['entier', 'decimal', 'fraction']);
});

test('ligne : déterminisme (même A, même graine → même item)', () => {
  for (const A of GRID) for (let s = 0; s < 20; s++) {
    assert.deepEqual(L.gen(A, makeRng(`d${s}`)), L.gen(A, makeRng(`d${s}`)), `A=${A} graine ${s}`);
  }
  /* opts compris */
  const o = () => ({ avoid: new Set(['ma.ligne:lire:0-20:3']), mode: 'placer' });
  assert.deepEqual(L.gen(2.7, makeRng(9), o()), L.gen(2.7, makeRng(9), o()));
});

test('ligne : items bien formés et justes sur toute la grille (57 niveaux × 300 graines)', () => {
  let n = 0;
  for (const A of GRID) for (let s = 0; s < SEEDS; s++) {
    const it = L.gen(A, makeRng(`g${A}|${s}`));
    checkItem(it, A, `A=${A} s=${s}`);
    assert.equal(it.A, A, 'A réel = A demandé');
    n++;
  }
  assert.equal(n, GRID.length * SEEDS);
});

test('ligne : bornes du programme par palier', () => {
  for (const A of GRID) for (let s = 0; s < SEEDS; s++) checkBounds(L.gen(A, makeRng(`b${A}|${s}`)), A, `A=${A} s=${s}`);
  /* bords de paliers */
  for (const A of [0.34, 0.35, 0.64, 0.65, 0.99, 1.19, 1.2, 1.99, 2.19, 2.59, 2.6, 2.79, 2.99, 3.19, 3.2, 3.39, 3.4, 3.59, 3.6, 3.99, 4.39, 4.4, 4.99, 5.6]) {
    for (let s = 0; s < 200; s++) { const it = L.gen(A, makeRng(`e${A}|${s}`)); checkItem(it, A); checkBounds(it, A, `A=${A}`); }
  }
});

test('ligne : contenus attendus par palier (fractions, décimaux, zoom, déduire le pas)', () => {
  const seen = (A0, A1, pred, n = 600) => {
    let c = 0;
    for (let s = 0; s < n; s++) { const A = A0 + (A1 - A0) * ((s % 50) / 50); if (pred(L.gen(A, makeRng(`c${A0}|${s}`)))) c++; }
    return c / n;
  };
  assert.equal(seen(0, 2.6, it => it.kind !== 'entier'), 0, 'que des entiers avant 2,6');
  assert.ok(seen(2.6, 3, it => it.kind === 'fraction') > 0.2, 'fractions au CE2 P3');
  assert.ok(seen(3.2, 4, it => it.kind === 'decimal') > 0.2, 'décimaux au CM1');
  assert.ok(seen(3.6, 4, it => it.kind === 'decimal' && decimalsOf(it.answer) === 2) > 0.05, 'centièmes dès 3,6');
  assert.ok(seen(4, 5, it => it.kind === 'decimal' && decimalsOf(it.answer) === 3) > 0.05, 'millièmes au CM2');
  assert.ok(seen(3.6, 5.6, it => !!it.data.zoom) > 0.03, 'zoom pour centièmes et millièmes');
  assert.ok(seen(3, 5.6, it => it.kind === 'fraction' && it.answer > 1) > 0.05, 'fractions > 1 au CM');
  assert.ok(seen(1.4, 2, it => it.data.variant === 'deduire') > 0.05, 'CE1 : déduire le pas de deux étiquettes voisines');
  assert.ok(seen(4.4, 5, it => it.kind === 'entier' && it.answer >= 1e6) > 0.05, 'CM2 : millions');
  assert.equal(seen(3.4, 4.4, it => it.kind === 'entier' && it.answer >= 1e6), 0, 'pas de million avant le CM2 P3');
  assert.ok(seen(5, 5.6, it => ['irregulier', 'espacees'].includes(it.data.variant)) > 0.2, 'au-delà de 5 : pas irréguliers');
  assert.ok(seen(5, 5.6, it => it.kind !== 'fraction' && [25, 250, 0.25, 2500].includes(it.data.minor)) > 0.03, 'pas de 25, 250, 0,25…');
});

test('ligne : formats Repères (QCM 6 au CP/CE1, pavé dès le CE2, placer ≈ 30 %)', () => {
  let placer = 0, total = 0;
  for (const A of GRID) for (let s = 0; s < 100; s++) {
    const it = L.gen(A, makeRng(`f${A}|${s}`));
    total++; if (it.data.mode === 'placer') placer++;
    if (it.data.mode === 'lire' && it.kind !== 'fraction') assert.equal(!!it.choices, A < 2, `A=${A}`);
  }
  const p = placer / total;
  assert.ok(p > 0.25 && p < 0.35, `part de « placer » ${p}`);
});

test('ligne : QCM pédagogiques (graduation voisine, mauvais pas)', () => {
  let neighbor = 0, n = 0, wrongStep = 0, nStep = 0;
  for (let s = 0; s < 1500; s++) {
    const A = (s % 20) / 10;
    const it = L.gen(A, makeRng(`q${s}`), { mode: 'lire' });
    if (!it.choices || it.kind !== 'entier') continue;
    const d = it.data, vals = it.choices.map(c => c.value);
    n++;
    if (vals.some(v => Math.abs(Math.abs(v - d.value) - d.minor) < EPS)) neighbor++;
    if (d.minor > 1) { nStep++; if (vals.some(v => !isMult(v - d.min, d.minor))) wrongStep++; }
  }
  assert.ok(neighbor / n > 0.95, `graduation voisine presque toujours proposée (${neighbor}/${n})`);
  assert.ok(wrongStep / nStep > 0.6, `lecture avec un mauvais pas souvent proposée (${wrongStep}/${nStep})`);
});

test('ligne : au moins 200 items distincts (clés) par palier', () => {
  const ranges = [[0, 0.35], [0.35, 0.65], [0.65, 1], [1, 1.2], [1.2, 2], [2, 2.2], [2.2, 2.6], [2.6, 3], [3, 3.2],
    [3.2, 3.4], [3.4, 3.6], [3.6, 4], [4, 4.4], [4.4, 5], [5, 5.6]];
  const report = [];
  for (const [a, b] of ranges) {
    const keys = new Set();
    for (let s = 0; s < 1500; s++) keys.add(L.gen(a + (b - a) * ((s % 97) / 97), makeRng(`k${a}|${s}`)).key);
    report.push(`${a}-${b} : ${keys.size}`);
    assert.ok(keys.size >= 200, `palier [${a} ; ${b}[ : ${keys.size} clés distinctes`);
  }
  console.log('    ligne, clés distinctes par palier (1 500 tirages) : ' + report.join(' · '));
});

test('ligne : opts.avoid respecté, sans boucle infinie', () => {
  for (const A of GRID) for (let s = 0; s < 30; s++) {
    const a = L.gen(A, makeRng(`v${A}|${s}`));
    const b = L.gen(A, makeRng(`v${A}|${s}`), { avoid: new Set([a.key]) });
    assert.notEqual(b.key, a.key, `A=${A} : clé évitée`);
    checkItem(b, A);
  }
  /* toutes les clés d'un petit palier évitées : un item est quand même rendu */
  const all = new Set();
  for (let s = 0; s < 3000; s++) all.add(L.gen(0.1, makeRng(`w${s}`)).key);
  const it = L.gen(0.1, makeRng(1), { avoid: all });
  checkItem(it, 0.1);
  assert.ok(L.gen(0.1, makeRng(1), { avoid: [...all] }), 'avoid en tableau accepté');
});

test('ligne : opts.kind et opts.mode imposés', () => {
  for (const A of [0, 1, 2, 3, 4, 5.6]) for (let s = 0; s < 40; s++) {
    const fr = L.gen(A, makeRng(`k${s}`), { kind: 'fraction' });
    assert.equal(fr.kind, 'fraction'); assert.equal(fr.A, Math.max(A, 2.6)); checkItem(fr, fr.A); checkBounds(fr, fr.A, 'kind fraction');
    const de = L.gen(A, makeRng(`k${s}`), { kind: 'decimal' });
    assert.equal(de.kind, 'decimal'); assert.equal(de.A, Math.max(A, 3.2)); checkItem(de, de.A); checkBounds(de, de.A, 'kind decimal');
    const en = L.gen(A, makeRng(`k${s}`), { kind: 'entier', mode: 'placer' });
    assert.equal(en.kind, 'entier'); assert.equal(en.data.mode, 'placer'); checkItem(en, A);
    const li = L.gen(A, makeRng(`k${s}`), { mode: 'lire' });
    assert.equal(li.data.mode, 'lire');
  }
  /* entrées hors bornes */
  checkItem(L.gen(-3, makeRng(1)), 0); checkItem(L.gen(99, makeRng(1)), 5.6); checkItem(L.gen(NaN, makeRng(1)), 0);
  assert.equal(L.gen(99, makeRng(1)).A, 5.6);
});

test('ligne : explications détaillées (exemples)', () => {
  /* CP : « Le drapeau est 3 petits piquets après 40 : 40 + 3 = 43. » */
  let found = 0;
  for (let s = 0; s < 400 && found < 3; s++) {
    const it = L.gen(0.8, makeRng(`x${s}`), { mode: 'lire' });
    if (/^Le drapeau est \d+ petits? piquets? (après|avant) \d+\u202f: \d+ [+−] \d+ = \d+\.$/.test(it.explain)) found++;
  }
  assert.ok(found >= 3, 'explication de comptage au CP');
  /* décimaux : lecture en unités de numération */
  const it = L.gen(3.3, makeRng(4), { kind: 'decimal', mode: 'lire' });
  assert.match(it.explain, /(dixième|centième)s?\)\.$/);
  /* fractions > 1 : « 1 + 3/4 = 7/4 » */
  for (let s = 0; s < 300; s++) {
    const f = L.gen(3.5, makeRng(`y${s}`), { kind: 'fraction', mode: 'lire' });
    if (f.answer > 1) { assert.match(f.explain, /\d+ \+ \d+\/\d+ = \d+\/\d+/); return; }
  }
  assert.fail('aucune fraction > 1 rencontrée');
});
