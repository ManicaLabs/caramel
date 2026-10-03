/* Radar : échelle r(θ) des fiches officielles, valeurs, snapshots hebdomadaires, tendances (contrat §5.8). */
import { test, assert } from './_t.mjs';
import { rFrac, thetaFromFrac, polar, currentValues, referenceValues, snapshotIfNeeded, axisTrend, inProgress,
         SNAPSHOT_CAP } from '../js/core/radar-model.js';
import { radarTemplate } from '../js/core/axes.js';
import { defaultProfile } from '../js/core/profiles.js';
import { addDays, weekKey } from '../js/core/util.js';

const TODAY = '2026-10-02';                       /* vendredi, 2026-W40 */
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

function prof() { return defaultProfile({ id: 'p1', name: 'Zoé', classe: 'CM2', today: '2026-09-01' }); }
const sk = (t, n = 5) => ({ t, n, last: TODAY, trend: 0, src: 'jeu' });

test('rFrac : ⊕ = 0,5 R · ⊕⊕ = 0,75 R · ⊕⊕⊕ = R', () => {
  const cases = [[0, 0], [0.5, 0.25], [1, 0.5], [1.5, 0.625], [2, 0.75], [2.5, 0.875], [3, 1],
                 [-1, 0], [4, 1], [null, 0], [NaN, 0], ['2', 0.75]];
  for (const [t, f] of cases) assert.ok(close(rFrac(t), f), `${t} → ${rFrac(t)}`);
});

test('thetaFromFrac : inverse de rFrac (aller-retour), borné 0-3', () => {
  for (let i = 0; i <= 300; i++) {
    const t = i / 100;
    assert.ok(close(thetaFromFrac(rFrac(t)), t), String(t));
  }
  for (let i = 0; i <= 100; i++) {
    const f = i / 100;
    assert.ok(close(rFrac(thetaFromFrac(f)), f), String(f));
  }
  assert.equal(thetaFromFrac(0.5), 1);
  assert.equal(thetaFromFrac(0.75), 2);
  assert.equal(thetaFromFrac(1), 3);
  assert.equal(thetaFromFrac(1.3), 3);
  assert.equal(thetaFromFrac(-0.2), 0);
  assert.equal(thetaFromFrac('x'), 0);
  /* monotone : glisser une poignée vers l'extérieur augmente toujours θ */
  let prev = -1;
  for (let i = 0; i <= 100; i++) { const t = thetaFromFrac(i / 100); assert.ok(t > prev); prev = t; }
});

test('polar : angle en degrés, sens horaire depuis le haut', () => {
  assert.deepEqual(polar(100, 100, 50, 0, 1), [100, 50]);
  assert.deepEqual(polar(100, 100, 50, 90, 1), [150, 100]);
  assert.deepEqual(polar(100, 100, 50, 180, 1), [100, 150]);
  assert.deepEqual(polar(100, 100, 50, 270, 1), [50, 100]);
  assert.deepEqual(polar(100, 100, 50, 90, rFrac(1)), [125, 100]);
  assert.deepEqual(polar(100, 100, 50, 45, 0), [100, 100]);
  const [x] = polar(0, 0, 10, 180, 1);
  assert.ok(Object.is(x, 0), 'ni −0 ni 1e-16 dans le SVG');
  const [a, b] = polar(0, 0, 100, 25.7, 0.5);
  assert.ok(close(a, 50 * Math.sin(25.7 * Math.PI / 180), 1e-6) && close(b, -50 * Math.cos(25.7 * Math.PI / 180), 1e-6));
});

test('currentValues : skill observé, sinon évaluation de référence, sinon null', () => {
  const p = prof();
  p.skills['fr.fluence'] = sk(1.2, 3);
  p.skills['fr.vocab'] = sk(1.5, 0);                /* non observé : l'évaluation prime */
  p.skills['fr.conjug'] = sk(3.4);                   /* borné */
  p.evals.push({ src: 'reperes', date: '2026-09', classe: 'CM2', added: TODAY, precision: '',
    fr: { 'fr.vocab': 2.4, 'fr.ortho': null, 'fr.comp_oral': 1.1, 'fr.fluence': 0.9 }, ma: {} });
  const tpl = radarTemplate('CM2', 'fr');
  const v = currentValues(p, tpl);
  assert.deepEqual(Object.keys(v), tpl.axes.map(a => a.id));
  assert.equal(v['fr.fluence'], 1.2);
  assert.equal(v['fr.vocab'], 2.4);
  assert.equal(v['fr.ortho'], null);                 /* absent à l'évaluation */
  assert.equal(v['fr.comp_oral'], 1.1);
  assert.equal(v['fr.conjug'], 3);
  assert.equal(v['fr.classes'], null);               /* jamais vu */
  /* gabarit en tableau d'ids ou d'objets */
  assert.deepEqual(currentValues(p, ['fr.fluence', { id: 'fr.vocab' }]), { 'fr.fluence': 1.2, 'fr.vocab': 2.4 });
  /* maths : aucune évaluation → null partout */
  const m = currentValues(p, radarTemplate('CM2', 'ma'));
  assert.equal(Object.keys(m).length, 7);
  assert.ok(Object.values(m).every(x => x === null));
  assert.deepEqual(currentValues(null, tpl), Object.fromEntries(tpl.axes.map(a => [a.id, null])));
  assert.deepEqual(currentValues(p, null), {});
});

test('referenceValues : dernière évaluation officielle de la matière', () => {
  const p = prof();
  assert.equal(referenceValues(p, 'fr'), null);
  p.evals.push({ date: '2026-09', added: '2026-10-01', fr: { 'fr.vocab': 2.4, 'fr.ortho': null }, ma: {} });
  p.evals.push({ date: '2026-09', added: '2026-10-01', fr: {}, ma: { 'ma.ligne': 1.8, 'ma.faits': 'x' } });
  p.evals.push({ date: '2025-09', added: '2026-10-02', fr: { 'fr.vocab': 1.1 }, ma: { 'ma.ligne': 0.4 } });
  assert.deepEqual(referenceValues(p, 'fr'), { 'fr.vocab': 2.4, 'fr.ortho': null });
  assert.deepEqual(referenceValues(p, 'ma'), { 'ma.ligne': 1.8, 'ma.faits': null },
    'une fiche plus ancienne importée ensuite ne devient pas la référence');
  p.evals.push({ date: '2026-09', added: '2026-10-05', fr: { 'fr.vocab': 2.7 }, ma: {} });
  assert.deepEqual(referenceValues(p, 'fr'), { 'fr.vocab': 2.7 }, 'même date : la plus récemment ajoutée');
  p.evals.push({ date: '2027-09', added: '2027-09-20', fr: { 'fr.vocab': 3.5 } });
  assert.deepEqual(referenceValues(p, 'fr'), { 'fr.vocab': 3 });
  assert.equal(referenceValues(null, 'fr'), null);
});

test('snapshotIfNeeded : un seul snapshot par semaine ISO', () => {
  const p = prof();
  assert.equal(snapshotIfNeeded(p, TODAY), null, 'aucun axe observé : rien à photographier');
  assert.equal(p.snapshots.length, 0);
  p.skills['ma.faits'] = sk(1.6234);
  p.skills['fr.fluence'] = sk(1.3);
  p.skills['ma.ligne'] = sk(1.5, 0);                 /* non observé : exclu */
  const s1 = snapshotIfNeeded(p, TODAY);
  assert.deepEqual(s1, { w: '2026-W40', d: TODAY, s: { 'ma.faits': 1.62, 'fr.fluence': 1.3 } });
  assert.equal(p.snapshots.length, 1);
  p.skills['ma.faits'].t = 2;
  assert.equal(snapshotIfNeeded(p, '2026-10-04'), null, 'dimanche : même semaine');
  assert.equal(snapshotIfNeeded(p, TODAY), null);
  assert.equal(p.snapshots.length, 1);
  assert.equal(p.snapshots[0].s['ma.faits'], 1.62, 'snapshot de la semaine inchangé');
  const s2 = snapshotIfNeeded(p, '2026-10-05');
  assert.equal(s2.w, '2026-W41');
  assert.equal(s2.s['ma.faits'], 2);
  assert.equal(p.snapshots.length, 2);
  /* horloge reculée : semaine déjà photographiée retrouvée, ordre chronologique conservé */
  assert.equal(snapshotIfNeeded(p, '2026-10-01'), null);
  assert.ok(snapshotIfNeeded(p, '2026-09-24'));
  assert.deepEqual(p.snapshots.map(s => s.w), ['2026-W39', '2026-W40', '2026-W41']);
  assert.equal(snapshotIfNeeded(null, TODAY), null);
});

test('snapshotIfNeeded : plafond de 104 semaines (les plus anciennes partent)', () => {
  const p = prof();
  p.skills['ma.faits'] = sk(2.1);
  for (let i = SNAPSHOT_CAP; i >= 1; i--) {
    const d = addDays(TODAY, -7 * i);
    p.snapshots.push({ w: weekKey(d), d, s: { 'ma.faits': 1 } });
  }
  assert.equal(p.snapshots.length, 104);
  const oldest = p.snapshots[0].w;
  const s = snapshotIfNeeded(p, TODAY);
  assert.equal(s.w, '2026-W40');
  assert.equal(p.snapshots.length, 104);
  assert.equal(p.snapshots[103], s);
  assert.ok(!p.snapshots.some(x => x.w === oldest));
  assert.equal(SNAPSHOT_CAP, 104);
});

function withHistory(entries) {
  const p = prof();
  entries.forEach(([d, ax, th], i) => p.history.push({ d, t: Date.parse(d + 'T17:00:00') + i, g: 'tables', ax, n: 10, ok: 8, hint: 0, ms: 120000, th, mode: 'libre' }));
  return p;
}

test('axisTrend : Δθ sur 14 jours depuis profile.history', () => {
  const p = withHistory([
    ['2026-09-10', 'ma.faits', 1.2],                 /* avant la fenêtre : base */
    ['2026-09-25', 'ma.faits', 1.4],
    ['2026-09-26', 'fr.conjug', 2.5],                /* autre axe : ignoré */
    ['2026-09-30', 'ma.faits', null],                /* θ inconnu : ignoré */
    ['2026-10-01', 'ma.faits', 1.7],
    ['2026-10-09', 'ma.faits', 2.9]                  /* futur : ignoré */
  ]);
  assert.equal(axisTrend(p, 'ma.faits', TODAY), 0.5);
  assert.equal(axisTrend(p, 'ma.faits', TODAY, 7), 0.3, 'fenêtre de 7 jours : base au 25/09');
  assert.equal(axisTrend(p, 'fr.conjug', TODAY), 0, 'une seule manche : pas de tendance');
  assert.equal(axisTrend(p, 'ma.faits', '2026-10-20'), 1.2, 'au 20/10 : fenêtre dès le 07/10, base = 1,7 (01/10) → 2,9 − 1,7');
  assert.equal(axisTrend(p, 'ma.faits', '2026-11-30'), 0, 'rien depuis 14 jours');
  assert.equal(axisTrend(p, 'ma.ligne', TODAY), 0);
  /* pas d'historique avant la fenêtre : base = première manche de la fenêtre */
  const q = withHistory([['2026-09-25', 'ma.faits', 1.4], ['2026-09-28', 'ma.faits', 1.3], ['2026-10-02', 'ma.faits', 1.0]]);
  assert.equal(axisTrend(q, 'ma.faits', TODAY), -0.4);
  assert.equal(axisTrend(null, 'ma.faits', TODAY), 0);
  /* ordre du tableau indifférent (tri par date puis heure) */
  const r = withHistory([['2026-10-01', 'ma.faits', 1.7], ['2026-09-10', 'ma.faits', 1.2]]);
  assert.equal(axisTrend(r, 'ma.faits', TODAY), 0.5);
});

test('inProgress : θ − évaluation ≥ 0,2 ou tendance > 0,1', () => {
  const p = prof();
  p.evals.push({ date: '2026-09', added: '2026-09-20', fr: {}, ma: { 'ma.ligne': 1.8, 'ma.faits': 2.5 } });
  p.skills['ma.ligne'] = sk(2.0);                    /* 2,0 − 1,8 = 0,2 (aux arrondis près) */
  assert.equal(inProgress(p, 'ma.ligne', TODAY), true);
  p.skills['ma.ligne'] = sk(1.95);
  assert.equal(inProgress(p, 'ma.ligne', TODAY), false);
  p.skills['ma.ligne'] = sk(2.6, 0);                 /* non observé */
  assert.equal(inProgress(p, 'ma.ligne', TODAY), false);
  /* tendance */
  const q = withHistory([['2026-09-10', 'ma.faits', 1.5], ['2026-10-01', 'ma.faits', 1.6]]);
  q.skills['ma.faits'] = sk(1.6);
  assert.equal(inProgress(q, 'ma.faits', TODAY), false, 'tendance de 0,1 : pas strictement > 0,1');
  q.history[1].th = 1.65;
  assert.equal(inProgress(q, 'ma.faits', TODAY), true);
  assert.equal(inProgress(prof(), 'fr.fluence', TODAY), false);
  assert.equal(inProgress(null, 'fr.fluence', TODAY), false);
});
