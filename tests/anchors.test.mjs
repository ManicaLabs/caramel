import { test, assert } from './_t.mjs';
import { loadLexicon } from './lexicon.mjs';
import { makeRng } from '../js/core/rng.js';
import { weekKey, fmtNum, parseNum, addDays, daysBetween, frTypo } from '../js/core/util.js';
import { absLevel, relLevel, yearFrac, thetaFromMclm, mclmExpected } from '../js/core/levels.js';
import { radarTemplate, AXES } from '../js/core/axes.js';
import { GAMES, gamesFor, mancheSize } from '../js/games/index.js';

test('lexique Vosk extrait du modèle', () => {
  const lex = loadLexicon();
  assert.ok(lex.size > 90000);
  for (const w of ['licorne', 'cheval', 'quarante-deux', 'vingt-et-un']) assert.ok(lex.has(w), w);
  assert.ok(!lex.has('capybara'));
});
test('rng déterministe', () => {
  const a = makeRng(42), b = makeRng(42);
  for (let i = 0; i < 50; i++) assert.equal(a.int(0, 1000), b.int(0, 1000));
  assert.notEqual(makeRng('x').next(), makeRng('y').next());
});
test('semaines ISO', () => {
  assert.equal(weekKey('2026-10-02'), '2026-W40');
  assert.equal(weekKey('2027-01-01'), '2026-W53');
  assert.equal(weekKey('2026-01-01'), '2026-W01');
  assert.equal(weekKey('2024-12-30'), '2025-W01');
});
test('nombres à la française', () => {
  assert.equal(fmtNum(1234567), '1\u202f234\u202f567');
  assert.equal(fmtNum(3.25), '3,25');
  assert.equal(fmtNum(0.5, 2), '0,50');
  assert.equal(parseNum('3,25'), 3.25);
  assert.ok(Number.isNaN(parseNum('3,,2')));
  assert.equal(frTypo('Bravo !'), 'Bravo\u202f!');
});
test('dates', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(daysBetween('2026-10-01', '2026-10-08'), 7);
});
test('niveaux', () => {
  assert.equal(yearFrac('2026-09-01'), 0);
  assert.equal(yearFrac('2026-07-15'), 1);
  const A = absLevel('CM2', 2, '2026-10-02');
  assert.ok(A > 4.0 && A < 4.15, String(A));
  assert.ok(Math.abs(relLevel('CM2', A, '2026-10-02') - 2) < 1e-9);
  assert.equal(absLevel('CP', 0, '2026-09-01'), 0);
  const exp = mclmExpected('CM2', '2026-10-02');
  assert.ok(Math.abs(thetaFromMclm(exp, 'CM2', '2026-10-02') - 2) < 1e-9);
});
test('gabarits radar', () => {
  const fr = radarTemplate('CM2', 'fr'), ma = radarTemplate('CM2', 'ma');
  assert.equal(fr.axes.length, 9); assert.equal(ma.axes.length, 7);
  assert.ok(fr.official && ma.official);
  for (const a of [...fr.axes, ...ma.axes]) assert.ok(AXES[a.id], a.id);
  assert.equal(Math.round(ma.axes.find(a => a.id === 'ma.operations').angle), 180);
  const ce2 = radarTemplate('CE2', 'fr');
  assert.ok(!ce2.official && ce2.axes.length >= 8);
});
test('registre des jeux', () => {
  assert.equal(GAMES.length, 7);                      /* v2.5 : + les Missions du ranch */
  assert.equal(gamesFor('CP').length, 5);
  assert.equal(mancheSize('tables', 20), 12);
});
import { ficheTemplate, ficheToAxes, CLASS_AXES, axesFor } from '../js/core/axes.js';
test('fiches officielles et regroupement', () => {
  for (const c of ['CP', 'CE1', 'CE2', 'CM1', 'CM2']) for (const s of ['fr', 'ma']) {
    const t = ficheTemplate(c, s);
    assert.ok(t.axes.length >= 6, c + s);
    for (const a of t.axes) assert.ok(AXES[a.id], a.id);
    assert.equal(radarTemplate(c, s).axes.length, CLASS_AXES[c][s].length);
  }
  const cm1 = ficheTemplate('CM1', 'fr');
  assert.equal(cm1.axes.length, 11);
  const vals = cm1.axes.map((a, i) => a.id === 'fr.vocab' ? (i === 1 ? 2 : 3) : (a.id === 'fr.ortho' ? null : 1));
  const m = ficheToAxes(cm1, vals);
  assert.equal(m['fr.vocab'], 2.5); assert.equal(m['fr.ortho'], null);
  assert.deepEqual(AXES['fr.conjug'].grades, ['CE1', 'CE2', 'CM1', 'CM2']);
  assert.ok(axesFor('CP', 'ma').includes('ma.faits'));
});
