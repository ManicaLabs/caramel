/* L’Atelier des opérations — moteur d'étapes (js/games/operations-logic.js), confronté au vrai générateur
   ma.operations (js/content/maths/operations.js) sur toute la plage de A et les deux méthodes de soustraction. */
import { test, assert } from './_t.mjs';
import { makeRng } from '../js/core/rng.js';
import { gen, fromKey } from '../js/content/maths/operations.js';
import {
  cellKey, DIGITS, analyzeGrid, extentOf, fitCell, fontSizes, createRun, sayText, digitOfKey
} from '../js/games/operations-logic.js';

/* échantillon : A de 0 à 5,6 (pas 0,1) × 12 graines × 2 méthodes */
function sample() {
  const out = [];
  for (const subMethod of ['compensation', 'cassage']) {
    for (let i = 0; i <= 56; i++) {
      const rng = makeRng('ops-game-' + subMethod + '-' + i);
      for (let k = 0; k < 12; k++) out.push(gen(i / 10, rng, { subMethod }));
    }
  }
  return out;
}
const ITEMS = sample();
const wrongOf = d => (d === '9' ? '8' : String(Number(d) + 1));
const allKeys = it => new Set(it.data.grid.cells.map(cellKey));

test('échantillon : toutes les opérations sont représentées', () => {
  const kinds = new Set(ITEMS.map(it => it.kind));
  for (const k of ['add', 'sub', 'mul', 'div', 'divdec']) assert.ok(kinds.has(k), k);
  const methods = new Set(ITEMS.filter(it => it.kind === 'sub').map(it => it.data.method));
  assert.ok(methods.has('compensation') && methods.has('cassage'));
});

test('juste du premier coup : la feuille finale est complète, rien n’est donné, outcome propre', () => {
  for (const it of ITEMS) {
    const run = createRun(it);
    run.start();
    let guard = 0;
    while (!run.done && guard++ < 200) {
      const step = run.current;
      assert.ok(step && step.ask, it.key);
      const v = run.view();
      if (step.type === 'count') assert.equal(v.target, null, it.key);
      else {
        assert.equal(step.cells.length, 1, it.key + ' ' + step.id);
        assert.equal(v.target, cellKey(step.cells[0]));
        assert.ok(!run.visible.has(v.target), 'case attendue déjà visible ' + it.key + ' ' + step.id);
        assert.equal(run.cell(v.target).ch, step.expect, it.key + ' ' + step.id);
      }
      const res = run.answer(step.expect);
      assert.equal(res.result, 'right');
      assert.equal(res.tries, 1);
    }
    assert.ok(run.done, it.key);
    assert.deepEqual([...run.visible].sort(), [...allKeys(it)].sort(), 'toutes les cases visibles ' + it.key);
    const strikeKeys = it.data.grid.cells.filter(c => c.strike).map(cellKey).sort();
    assert.deepEqual([...run.struck].sort(), strikeKeys, it.key);
    assert.equal(run.given.size, 0);
    assert.deepEqual(run.outcome(1234.4), { correct: true, hinted: false, ms: 1234, tries: 1 });
    assert.equal(run.stats.answered, run.stats.asked);
    assert.equal(run.answer('1').result, 'ignored');
    assert.equal(run.joker(), null);
  }
});

test('1re erreur : on reste sur l’étape, indice montré ; juste ensuite → aidé, correct, tries 2', () => {
  for (const it of ITEMS.filter((_, i) => i % 7 === 0)) {
    const run = createRun(it);
    run.start();
    const step = run.current, i0 = run.index;
    assert.equal(run.hintShown, false);
    const r1 = run.answer(wrongOf(step.expect));
    assert.equal(r1.result, 'retry');
    assert.equal(run.index, i0);
    assert.equal(run.current, step);
    assert.equal(run.hintShown, true);
    if (step.cells.length) assert.ok(!run.visible.has(cellKey(step.cells[0])));
    const r2 = run.answer(step.expect);
    assert.equal(r2.result, 'right');
    assert.equal(r2.tries, 2);
    while (!run.done) run.answer(run.current.expect);
    assert.deepEqual(run.outcome(10), { correct: true, hinted: true, ms: 10, tries: 2 });
  }
});

test('2e erreur : le chiffre est posé (donné) et on continue ; l’opération n’est plus « correcte »', () => {
  for (const it of ITEMS.filter((_, i) => i % 5 === 0)) {
    const run = createRun(it);
    run.start();
    const step = run.current, i0 = run.index;
    run.answer(wrongOf(step.expect));
    const r = run.answer(wrongOf(step.expect));
    assert.equal(r.result, 'given');
    assert.ok(run.index > i0);
    for (const c of step.cells) {
      assert.ok(run.given.has(cellKey(c)));
      assert.ok(run.visible.has(cellKey(c)));
    }
    while (!run.done) {
      const s = run.current;
      assert.equal(run.hintShown, false, 'l’indice ne déborde pas sur l’étape suivante');
      run.answer(s.expect);
    }
    assert.deepEqual([...run.visible].sort(), [...allKeys(it)].sort());
    const o = run.outcome(5);
    assert.equal(o.correct, false);
    assert.equal(o.hinted, true);
    assert.equal(o.tries, 2);
    assert.equal(run.stats.given, 1);
  }
});

test('joker : indice de l’étape en cours, une seule fois par étape ; compte comme aidé', () => {
  const it = fromKey('ma.operations:add:45+37', 5.6);
  const run = createRun(it);
  run.start();
  const j = run.joker();
  assert.equal(j.step.id, 's1');
  assert.equal(j.already, false);
  assert.equal(run.hintShown, true);
  assert.equal(run.joker().already, true);
  run.answer('2');
  assert.equal(run.hintShown, false);
  while (!run.done) run.answer(run.current.expect);
  assert.deepEqual(run.outcome(0), { correct: true, hinted: true, ms: 0, tries: 1 });
  assert.equal(run.stats.jokers, 1);
});

test('coup de pouce (item.assist) : indice montré à chaque question, opération aidée', () => {
  const it = fromKey('ma.operations:mul:16x548', 5.6);
  const run = createRun(it, { assist: true });
  run.start();
  while (!run.done) {
    assert.equal(run.hintShown, true);
    assert.equal(run.joker().already, true);
    run.answer(run.current.expect);
  }
  const o = run.outcome(0);
  assert.equal(o.correct, true);
  assert.equal(o.hinted, true);
});

test('étapes automatiques : jouées d’un coup jusqu’à la prochaine question (retenue, marques, virgule…)', () => {
  const it = fromKey('ma.operations:add:45+37', 5.6);
  const run = createRun(it);
  const st = run.start();
  assert.deepEqual(st.autos, []);
  const r = run.answer('2');
  assert.deepEqual(r.autos.map(s => s.type), ['carry']);
  assert.ok(run.visible.has('0,1'));
  assert.equal(run.current.id, 's3');
  /* cassage : la première étape (marques) est automatique, avec les chiffres barrés */
  const cas = createRun(fromKey('ma.operations:sub:4000-1257:cassage', 5.6));
  const s0 = cas.start();
  assert.deepEqual(s0.autos.map(s => s.type), ['mark']);
  assert.deepEqual([...cas.struck].sort(), ['1,1', '1,2', '1,3']);
  assert.ok(cas.visible.has('1,4,avant'));
  /* division : le dernier commentaire est joué après la dernière réponse */
  const dv = createRun(fromKey('ma.operations:div:9456/7', 5.6));
  dv.start();
  let last = null;
  while (!dv.done) last = dv.answer(dv.current.expect);
  assert.equal(last.done, true);
  assert.equal(last.autos[last.autos.length - 1].type, 'info');
});

test('surlignage : colonne courante pour + et −, cases en jeu pour × (lignes de produit) et ÷', () => {
  const add = createRun(fromKey('ma.operations:add:76+7+568', 5.6));
  add.start();
  assert.equal(add.view().band, 3);
  add.answer('1');
  assert.equal(add.view().band, 2);
  const sub = createRun(fromKey('ma.operations:sub:74.36-12.50:compensation:euros', 5.6));
  sub.start();
  assert.equal(sub.view().band, 4);
  const mul = createRun(fromKey('ma.operations:mul:16x548', 5.6));
  mul.start();
  const v = mul.view();
  assert.equal(v.target, '6,4');
  assert.equal(v.band, 4);                       /* 6 × 8 : le 8 et le 6 sont dans la même colonne */
  mul.answer('8');
  const v2 = mul.view();
  assert.equal(v2.target, '6,3');
  assert.equal(v2.band, null);                   /* 6 × 4 + retenue : le 6 est dans une autre colonne */
  assert.ok(v2.focus.includes('3,4') && v2.focus.includes('2,3') && v2.focus.includes('1,3'));
  const dv = createRun(fromKey('ma.operations:div:9456/7', 5.6));
  dv.start();
  const c = dv.view();
  assert.equal(c.step.type, 'count');
  assert.equal(c.target, null);
  assert.equal(c.band, null);
  assert.ok(c.focus.length >= 2);
  /* aucune bande de colonne dans une potence */
  while (!dv.done) { assert.equal(dv.view().band, null); dv.answer(dv.current.expect); }
});

test('retenues pâlies : celles d’un produit partiel terminé, pas celles de l’addition en cours', () => {
  const run = createRun(fromKey('ma.operations:mul:876x208', 5.6));
  run.start();
  const play = () => run.answer(run.current.expect);
  /* 1re ligne (× 8) : retenues en ligne 1, actives */
  while (run.current.cells[0].r === 6) {
    play();
    for (const k of run.visible) if (k.startsWith('1,')) assert.equal(run.isStale(k), run.current.cells[0].r !== 6, k);
  }
  /* 2e ligne (× 200) : les retenues de la ligne 1 sont pâlies, celles de la ligne 0 actives */
  assert.equal(run.current.cells[0].r, 7);
  assert.ok(run.isStale('1,5') && run.isStale('1,4'));
  play();
  assert.ok(run.visible.has('0,5'));
  assert.equal(run.isStale('0,5'), false);
  while (run.current.cells[0].r === 7) play();
  /* addition finale : toutes les retenues des produits pâlies ; la retenue de l'addition reste active */
  assert.ok(run.isStale('0,5') && run.isStale('1,5'));
  while (!run.done) play();
  assert.ok(run.visible.has('5,2'));
  assert.equal(run.isStale('5,2'), false);
  /* addition : les retenues ne pâlissent jamais */
  const add = createRun(fromKey('ma.operations:add:76+7+568', 5.6));
  add.start();
  while (!add.done) add.answer(add.current.expect);
  for (const k of ['0,1', '0,2']) assert.equal(add.isStale(k), false);
});

test('division : la réponse au nombre de chiffres prépare les emplacements du quotient', () => {
  for (const [key, n] of [['ma.operations:div:9456/7', 4], ['ma.operations:divdec:785/4', 3], ['ma.operations:divdec:148.2/5', 2]]) {
    const it = fromKey(key, 5.6);
    const run = createRun(it);
    run.start();
    assert.equal(run.current.type, 'count');
    assert.equal(run.slots.size, 0);
    run.answer(run.current.expect);
    assert.equal(run.slots.size, n, key);
    const q = it.data.grid.cells.filter(c => c.role === 'quotient' && !c.pos).sort((a, b) => a.c - b.c).slice(0, n).map(cellKey);
    assert.deepEqual([...run.slots], q);
  }
  /* donné après deux erreurs : emplacements aussi */
  const run = createRun(fromKey('ma.operations:div:9456/7', 5.6));
  run.start();
  run.answer('1'); run.answer('2');
  assert.equal(run.slots.size, 4);
});

test('analyzeGrid : traits, lignes repliées, potence, cases finales', () => {
  for (const it of ITEMS) {
    const g = it.data.grid, geo = analyzeGrid(g);
    assert.equal(geo.units.length, g.rows);
    assert.ok(geo.height >= 2 && geo.height <= g.rows, it.key);
    for (const c of g.cells) {
      assert.ok(c.c >= 0 && c.c < g.cols, it.key);
      if (c.role !== 'rule' && !c.pos) assert.equal(geo.units[c.r], 1, 'case de chiffre sur une ligne repliée ' + it.key);
    }
    assert.equal(geo.width, g.cols - (geo.potence ? 1 : 0), it.key);
    for (const l of geo.lines) {
      assert.ok(l.x0 >= 0 && l.x1 <= geo.width + 1e-9 && l.x0 < l.x1 + 1e-9, it.key + ' ' + l.kind);
      assert.ok(l.y0 >= 0 && l.y1 <= geo.height + 1e-9, it.key + ' ' + l.kind);
    }
    assert.ok(geo.finalKeys.length >= 1, it.key);
    if (it.kind === 'div' || it.kind === 'divdec') {
      assert.ok(geo.potence, it.key);
      assert.ok(geo.lines.some(l => l.kind === 'bar') && geo.lines.some(l => l.kind === 'barH'), it.key);
      assert.ok(geo.lines.filter(l => l.kind === 'sub').length >= 1, it.key);
      assert.equal(geo.quotientKeys.length, it.data.result.replace(',', '').length, it.key);
      assert.ok(geo.restKeys.length >= 1, it.key);
      assert.ok(!geo.lines.some(l => l.kind === 'rule'), it.key);
      /* trait vertical sur une ligne du quadrillage, entre le dividende et le diviseur (colonne de largeur 0) */
      const bar = geo.lines.find(l => l.kind === 'bar');
      assert.equal(geo.colUnits[geo.potence.c], 0);
      const xb = geo.left[geo.potence.c];
      assert.ok(bar.x0 <= xb && bar.x0 >= xb - 0.15, it.key);
      const dividend = g.cells.filter(c => c.r === 0 && c.role === 'operand' && !c.pos);
      const divisor = g.cells.find(c => c.role === 'divisor');
      assert.ok(Math.max(...dividend.map(c => geo.left[c.c] + 1)) <= xb + 1e-9, it.key);
      assert.ok(geo.left[divisor.c] >= xb - 1e-9, it.key);
    } else {
      assert.equal(geo.potence, null);
      const rules = geo.lines.filter(l => l.kind === 'rule');
      assert.ok(rules.length >= 1, it.key);
      for (const l of rules) { assert.equal(l.x0, 0); assert.equal(l.x1, g.cols); }
      assert.equal(geo.width, g.cols);
      const digits = geo.finalKeys.map(k => it.data.grid.cells.find(c => cellKey(c) === k)).filter(c => /\d/.test(c.ch)).sort((a, b) => a.c - b.c);
      assert.equal(digits.map(c => c.ch).join(''), it.data.result.replace(',', ''), it.key);
    }
  }
  /* 548 × 16 : la ligne des retenues du 2e produit (aucune retenue) est repliée, les traits n'ont pas de hauteur */
  const geo = analyzeGrid(fromKey('ma.operations:mul:16x548', 5.6).data.grid);
  assert.equal(geo.units[0], 0);
  assert.equal(geo.units[4], 0);
  assert.equal(geo.units[8], 0);
  assert.equal(geo.height, 7);
  assert.deepEqual(geo.rowAnchor.slice(0, 3), ['bottom', 'bottom', 'mid']);
  /* compensation : « +1 » sous le nombre du bas, collé en haut ; cassage : marques au-dessus, collées en bas */
  assert.equal(analyzeGrid(fromKey('ma.operations:sub:4000-1257:compensation', 5.6).data.grid).rowAnchor[2], 'top');
  assert.equal(analyzeGrid(fromKey('ma.operations:sub:4000-1257:cassage', 5.6).data.grid).rowAnchor[0], 'bottom');
});

test('extentOf : étendue en unités', () => {
  const it = fromKey('ma.operations:add:45+37', 5.6);
  const geo = analyzeGrid(it.data.grid);
  const e = extentOf(geo.finalKeys, geo);
  assert.deepEqual(e, { x0: 1, x1: 3, y0: geo.top[4], y1: geo.top[4] + 1 });
  assert.equal(extentOf([], geo), null);
});

test('fitCell : tout tient en largeur (390 px et moins), jamais de défilement horizontal', () => {
  for (const it of ITEMS) {
    const geo = analyzeGrid(it.data.grid);
    for (const [W, H] of [[336, 420], [300, 360], [600, 640], [250, 200]]) {
      const cw = fitCell({ W, H, cols: geo.width, height: geo.height });
      assert.ok(cw * geo.width <= W, it.key + ' ' + W);
      assert.ok(cw <= 56);
      if (H / geo.height >= 14) assert.ok(cw * geo.height <= H, it.key + ' H ' + H);
    }
  }
  assert.equal(fitCell({ W: 1000, H: 1000, cols: 4, height: 5 }), 56);
  assert.equal(fitCell({ W: 160, H: 1000, cols: 16, height: 5 }), 10);
  const f = fontSizes(44);
  assert.ok(f.big >= 30 && f.small >= 18);
  assert.equal(fontSizes(16).small, 11);
  for (let c = 12; c <= 72; c++) {
    const a = fontSizes(c), b = fontSizes(c + 1);
    assert.ok(b.big >= a.big, 'corps croissant ' + c);
    assert.ok(a.big * 0.62 < c, 'un chiffre tient dans sa case ' + c);
  }
});

test('sayText, digitOfKey, DIGITS', () => {
  assert.equal(sayText([{ say: 'A.' }, { say: null }, { say: 'B.' }, { say: 'C.' }]), 'B. C.');
  assert.equal(sayText([{ say: 'A.' }], 2), 'A.');
  assert.equal(sayText([]), '');
  assert.equal(digitOfKey('7'), '7');
  assert.equal(digitOfKey('Numpad3'), '3');
  assert.equal(digitOfKey('a'), null);
  assert.equal(digitOfKey(undefined), null);
  assert.deepEqual([...DIGITS].sort(), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
});

test('saisie invalide ignorée, sans compter d’erreur', () => {
  const run = createRun(fromKey('ma.operations:add:45+37', 5.6));
  run.start();
  assert.equal(run.answer('').result, 'ignored');
  assert.equal(run.answer('12').result, 'ignored');
  assert.equal(run.answer('x').result, 'ignored');
  assert.equal(run.stats.errors, 0);
  assert.equal(run.hintShown, false);
});
