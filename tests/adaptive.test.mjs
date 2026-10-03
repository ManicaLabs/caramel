import { test, assert } from './_t.mjs';
import {
  DEFAULT_THETA, SPEED_MS, prob, kFactor, skillOf, scoreR, applyResult, applyFluence, targetB, applyEval
} from '../js/core/adaptive.js';
import { mclmExpected, expectedLevel } from '../js/core/levels.js';

const TODAY = '2026-10-02';
const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const blank = (classe = 'CM2') => ({ classe, skills: {}, evals: [], today: null });

test('prob : logistique 1,7, symétrique et croissante', () => {
  assert.equal(prob(1.5, 1.5), 0.5);
  near(prob(1.5, 0.7), 1 / (1 + Math.exp(-1.7 * 0.8)), 1e-12);
  near(prob(1.5, 0.7), 0.796, 1e-3);                          /* cible p ≈ 0,8 quand b = θ − 0,8 */
  near(prob(2, 1) + prob(1, 2), 1, 1e-12);
  assert.ok(prob(2.5, 1) > prob(2, 1) && prob(2, 1) > prob(1.5, 1));
});

test('kFactor : 0,4/√(n+1) plancher 0,08', () => {
  assert.equal(kFactor(0), 0.4);
  near(kFactor(3), 0.2, 1e-12);
  near(kFactor(15), 0.1, 1e-12);
  assert.equal(kFactor(24), 0.08);
  assert.equal(kFactor(500), 0.08);
  assert.equal(kFactor(NaN), 0.4);
  assert.equal(kFactor(-3), 0.4);
});

test('targetB : θ − 0,8 + adj, borné à [0 ; 3]', () => {
  near(targetB(1.5), 0.7, 1e-12);
  near(targetB(2, -0.6), 0.6, 1e-12);
  near(targetB(2.2, 0.3), 1.7, 1e-12);
  assert.equal(targetB(0.5), 0);
  assert.equal(targetB(3, 0.9), 3);
  near(targetB(undefined), DEFAULT_THETA - 0.8, 1e-12);
});

test('skillOf : défaut non inséré, skill existant renvoyé tel quel', () => {
  const p = blank();
  const s = skillOf(p, 'ma.ligne');
  assert.deepEqual(s, { t: 1.5, n: 0, last: '', trend: 0, src: 'defaut' });
  assert.equal(p.skills['ma.ligne'], undefined);
  p.skills['ma.faits'] = { t: 2.1, n: 7, last: TODAY, trend: 0.1, src: 'eval' };
  assert.equal(skillOf(p, 'ma.faits'), p.skills['ma.faits']);
  p.skills['ma.ligne'] = { t: NaN };
  assert.equal(skillOf(p, 'ma.ligne').t, 1.5);
  assert.equal(skillOf(null, 'ma.ligne').t, 1.5);
});

test('scoreR : faux, aidé, lent, parfait', () => {
  const fait = { axis: 'ma.faits', key: 'ma.faits:7x8' };
  assert.equal(scoreR('ma.faits', fait, { correct: false, hinted: false, ms: 1000 }), 0);
  assert.equal(scoreR('ma.faits', fait, { correct: false, hinted: true }), 0);
  assert.equal(scoreR('ma.faits', fait, { correct: true, hinted: true, ms: 1000 }), 0.6);
  assert.equal(scoreR('ma.faits', fait, { correct: true, tries: 2, ms: 1000 }), 0.6);   /* 2e essai */
  assert.equal(scoreR('ma.faits', { ...fait, assist: true }, { correct: true, ms: 1000 }), 0.6);   /* indice proactif */
  assert.equal(scoreR('ma.faits', fait, { correct: true, ms: 2500 }), 1);
  assert.equal(scoreR('ma.faits', fait, { correct: true, ms: SPEED_MS['ma.faits'] + 1 }), 0.8);
  assert.equal(scoreR('ma.faits', fait, { correct: true }), 1);                          /* durée inconnue */
  assert.equal(scoreR('ma.procedures', {}, { correct: true, ms: 4900 }), 1);
  assert.equal(scoreR('ma.procedures', {}, { correct: true, ms: 5200 }), 0.8);
  /* item.autoMs prime sur le seuil par défaut */
  assert.equal(scoreR('ma.faits', { ...fait, autoMs: 6000 }, { correct: true, ms: 5000 }), 1);
  assert.equal(scoreR('ma.faits', { ...fait, autoMs: 2000 }, { correct: true, ms: 2500 }), 0.8);
  /* axe sans composante vitesse */
  assert.equal(scoreR('ma.ligne', { axis: 'ma.ligne' }, { correct: true, ms: 60000 }), 1);
  assert.equal(scoreR('fr.conjug', {}, { correct: true, hinted: false, tries: 1, ms: 9000 }), 1);
});

test('applyResult : formule exacte, n + 1, skill inséré', () => {
  const p = blank();
  const { before, after } = applyResult(p, 'ma.ligne', 0.7, 1, TODAY);
  assert.equal(before, 1.5);
  near(after, 1.5 + 0.4 * (1 - prob(1.5, 0.7)), 1e-4);
  assert.deepEqual(Object.keys(p.skills), ['ma.ligne']);
  const s = p.skills['ma.ligne'];
  assert.equal(s.n, 1); assert.equal(s.last, TODAY); assert.equal(s.t, after); assert.equal(s.src, 'defaut');
  /* deuxième réponse fausse : K = 0,4/√2 */
  const t1 = s.t;
  const r2 = applyResult(p, 'ma.ligne', 0.7, 0, TODAY);
  near(r2.after, t1 + (0.4 / Math.SQRT2) * (0 - prob(t1, 0.7)), 1e-4);
  assert.equal(s.n, 2);
});

test('applyResult : θ toujours dans [0 ; 3] et pas de plus en plus petits', () => {
  const p = blank();
  let prev = null;
  for (let i = 0; i < 200; i++) {
    const { before, after } = applyResult(p, 'ma.faits', 3, 1, TODAY);
    assert.ok(after >= 0 && after <= 3);
    if (i < 20) { if (prev !== null) assert.ok(after - before <= prev + 1e-9); prev = after - before; }
  }
  assert.ok(p.skills['ma.faits'].t > 2.9);
  for (let i = 0; i < 300; i++) {
    const { after } = applyResult(p, 'ma.faits', 0, 0, TODAY);
    assert.ok(after >= 0 && after <= 3);
  }
  assert.ok(p.skills['ma.faits'].t < 0.1);
  /* θ hors bornes ou r farfelu : on reste borné */
  p.skills['ma.ligne'] = { t: 7, n: 0, last: '', trend: 0, src: 'defaut' };
  assert.ok(applyResult(p, 'ma.ligne', 2, 5, TODAY).after <= 3);
  assert.ok(applyResult(p, 'ma.ligne', NaN, -4, TODAY).after >= 0);
});

test('applyResult : un enfant qui réussit 80 % des items ciblés reste stable', () => {
  const p = blank();
  p.skills['ma.procedures'] = { t: 1.8, n: 20, last: '', trend: 0, src: 'eval' };
  for (let i = 0; i < 50; i++) {
    const t = p.skills['ma.procedures'].t;
    applyResult(p, 'ma.procedures', targetB(t), i % 5 === 4 ? 0 : 1, TODAY);
  }
  near(p.skills['ma.procedures'].t, 1.8, 0.15);
});

test('applyFluence : lecture à l’attendu sur un texte de la classe → θ ≈ 2', () => {
  const p = blank('CM2');
  const mclm = mclmExpected('CM2', TODAY);
  const r = applyFluence(p, { mclm, textA: expectedLevel('CM2', TODAY), classe: 'CM2', today: TODAY });
  assert.equal(r.before, 1.5);
  near(r.obs, 2, 1e-9);
  near(r.after, 2, 1e-4);                             /* n = 0 → w = 1 */
  const s = p.skills['fr.fluence'];
  assert.equal(s.n, 1); assert.equal(s.last, TODAY);
  /* 2e observation plus lente (−25 %) : w = max(0,3 ; 1/2) = 0,5 */
  const r2 = applyFluence(p, { mclm: mclm * 0.75, textA: 9, today: TODAY });
  near(r2.obs, 1, 1e-9);
  near(r2.after, 1.5, 1e-4);
  /* au-delà de 2 observations, le poids plancher est 0,3 */
  s.n = 10;
  const r3 = applyFluence(p, { mclm, textA: 9, today: TODAY });
  near(r3.after, r2.after + 0.3 * (2 - r2.after), 1e-4);
});

test('applyFluence : texte facile → MCLM corrigé (−5 % par niveau, au plus −20 %)', () => {
  const exp = expectedLevel('CM2', TODAY), mclm = mclmExpected('CM2', TODAY);
  const p1 = blank(), p2 = blank(), p3 = blank();
  const a = applyFluence(p1, { mclm, textA: exp - 2, today: TODAY });     /* × 0,9 → obs = 2 − 0,4 */
  near(a.obs, 2 + (0.9 - 1) / 0.25, 1e-9);
  const b = applyFluence(p2, { mclm, textA: exp - 10, today: TODAY });    /* plancher × 0,8 */
  near(b.obs, 2 + (0.8 - 1) / 0.25, 1e-9);
  const c = applyFluence(p3, { mclm, textA: exp + 1, today: TODAY });     /* texte plus dur : pas de bonus */
  near(c.obs, 2, 1e-9);
  /* classe du profil par défaut */
  const p4 = { classe: 'CE1', skills: {} };
  near(applyFluence(p4, { mclm: mclmExpected('CE1', TODAY), today: TODAY }).obs, 2, 1e-9);
});

test('applyFluence : MCLM absent ou nul → aucune trace', () => {
  const p = blank();
  for (const mclm of [0, -5, NaN, undefined, null]) {
    const r = applyFluence(p, { mclm, textA: 3, today: TODAY });
    assert.equal(r.obs, null); assert.equal(r.before, 1.5); assert.equal(r.after, 1.5);
  }
  assert.equal(p.skills['fr.fluence'], undefined);
});

test('applyEval : n = 4, absents listés, clés inconnues ignorées, référence ajoutée', () => {
  const p = blank('CM2');
  p.skills['ma.ligne'] = { t: 2.6, n: 30, last: '2026-09-30', trend: 0.2, src: 'defaut' };
  const ev = {
    source: 'Repères', date: '2026-09', classe: 'CM2', precision: 'lecture photo ±0,3',
    fr: { 'fr.comp_oral': 2.4, 'fr.vocab': null, 'fr.inconnu': 2, 'fr.fluence': 1.0, 'fr.conjug': '1,8' },
    ma: { 'ma.ligne': 0.7, 'ma.faits': 4.2, 'ma.geo': 2, 'ma.repres': 'abc' }
  };
  const r = applyEval(p, ev, TODAY);
  assert.deepEqual(r.applied.sort(), ['fr.comp_oral', 'fr.conjug', 'fr.fluence', 'ma.faits', 'ma.ligne']);
  assert.deepEqual(r.absent, ['fr.vocab']);
  assert.deepEqual(p.skills['ma.ligne'], { t: 0.7, n: 4, last: TODAY, trend: 0, src: 'eval' });
  assert.equal(p.skills['ma.faits'].t, 3);                /* borné */
  assert.equal(p.skills['fr.conjug'].t, 1.8);
  assert.equal(p.skills['fr.vocab'], undefined);
  assert.equal(p.skills['ma.geo'], undefined);
  assert.equal(p.evals.length, 1);
  const e = p.evals[0];
  assert.equal(e.src, 'reperes'); assert.equal(e.date, '2026-09'); assert.equal(e.classe, 'CM2');
  assert.equal(e.added, TODAY); assert.equal(e.precision, 'lecture photo ±0,3');
  assert.deepEqual(e.fr, { 'fr.comp_oral': 2.4, 'fr.vocab': null, 'fr.fluence': 1, 'fr.conjug': 1.8 });
  assert.deepEqual(e.ma, { 'ma.ligne': 0.7, 'ma.faits': 3 });
});

test('applyEval : français puis maths (2 photos) → une seule évaluation complétée, en dernier', () => {
  const p = blank('CM2');
  p.evals.push({ src: 'reperes', date: '2025-09', classe: 'CM1', fr: { 'fr.fluence': 2 }, ma: {}, added: '2025-09-20', precision: '' });
  applyEval(p, { src: 'reperes', date: '2026-09', classe: 'CM2', fr: { 'fr.fluence': 1.2 } }, TODAY);
  applyEval(p, { src: 'reperes', date: '2026-09', classe: 'CM2', ma: { 'ma.ligne': 0.9 } }, '2026-10-03');
  assert.equal(p.evals.length, 2);
  const last = p.evals[1];
  assert.deepEqual(last.fr, { 'fr.fluence': 1.2 });
  assert.deepEqual(last.ma, { 'ma.ligne': 0.9 });
  assert.equal(last.added, '2026-10-03');
  assert.equal(p.evals[0].date, '2025-09');
  /* évaluation vide : rien n'est ajouté */
  assert.deepEqual(applyEval(p, { fr: { 'x.y': 2 } }, TODAY), { applied: [], absent: [] });
  assert.equal(p.evals.length, 2);
  /* valeurs par défaut */
  const q = { classe: 'CE2' };
  applyEval(q, { ma: { 'ma.faits': 2 } }, TODAY);
  assert.deepEqual(q.evals[0], { src: 'reperes', date: '2026-10', classe: 'CE2', fr: {}, ma: { 'ma.faits': 2 }, added: TODAY, precision: '' });
});

test('applyEval : un plan du jour non entamé est recalculé, pas un plan entamé', () => {
  const p = blank();
  p.today = { d: TODAY, idx: 0, done: false, rewarded: false, blocks: [{ done: false }, { done: false }] };
  applyEval(p, { ma: { 'ma.ligne': 1 } }, TODAY);
  assert.equal(p.today, null);
  const started = { d: TODAY, idx: 1, done: false, rewarded: false, blocks: [{ done: true }, { done: false }] };
  p.today = started;
  applyEval(p, { ma: { 'ma.ligne': 1.2 } }, TODAY);
  assert.equal(p.today, started);
});
