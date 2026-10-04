/* En famille : classements de la semaine, concours de compagnons, points du défi (js/core/family.js),
   compteur de la semaine et trophées (js/core/economy.js), normalisation (js/core/profiles.js). */
import { test, assert } from './_t.mjs';
import * as F from '../js/core/family.js';
import { addApples, bumpWeek, weekCounter, addTrophy, bumpStreak, TROPHIES_MAX } from '../js/core/economy.js';
import { defaultProfile, normalizeProfile } from '../js/core/profiles.js';
import { addDays, weekKey } from '../js/core/util.js';
import { PET } from '../js/content/companion-data.js';

const D = '2026-10-03';                     /* samedi, semaine 2026-W40 (du lundi 28 septembre au dimanche 4 octobre) */
const W = weekKey(D);
const NOW = new Date(2026, 9, 3, 15, 0, 0).getTime();

function kid(id, name, opts = {}) {
  const p = defaultProfile({ id, name, g: opts.g || 'f', classe: opts.classe || 'CM2', today: '2026-09-01' });
  if (opts.week) p.stats.week = { w: W, minutes: 0, apples: 0, items: 0, ...opts.week };
  if (opts.streak) Object.assign(p.streak, opts.streak);
  if (opts.stars) p.wallet.stars = opts.stars;
  if (opts.trophies) p.trophies = opts.trophies;
  if (opts.companion) Object.assign(p.companion, opts.companion);
  if (opts.pet) Object.assign(p.companion.pet, opts.pet);
  return p;
}

/* ---------- semaine ---------- */
test('semaine : bornes lundi-dimanche, libellé français, 1er du mois', () => {
  assert.deepEqual(F.weekRange(D), { w: '2026-W40', from: '2026-09-28', to: '2026-10-04',
    label: 'du lundi 28\u00a0septembre au dimanche 4\u00a0octobre' });
  assert.equal(F.weekRange('2026-09-28').from, '2026-09-28');           /* lundi : début de sa propre semaine */
  assert.equal(F.weekRange('2026-10-04').from, '2026-09-28');           /* dimanche : même semaine */
  assert.equal(F.weekRange('2026-10-05').w, '2026-W41');
  assert.equal(F.frDayMonth('2026-10-01'), '1er\u00a0octobre');
  assert.equal(F.frDayMonth('2027-01-15'), '15\u00a0janvier');
  assert.equal(F.frWeekday('2026-10-03'), 'samedi');
});

test('weekStats : compteur de la semaine courante, zéro pour une autre semaine', () => {
  const p = kid('p1', 'Léa', { week: { minutes: 12.6, apples: 30, items: 41 } });
  assert.deepEqual(F.weekStats(p, D), { w: W, minutes: 12.6, apples: 30, items: 41 });
  assert.deepEqual(F.weekStats(p, '2026-10-05'), { w: '2026-W41', minutes: 0, apples: 0, items: 0 });
  assert.deepEqual(F.weekStats(defaultProfile({ today: D }), D), { w: W, minutes: 0, apples: 0, items: 0 });
  assert.deepEqual(F.weekStats(null, D), { w: W, minutes: 0, apples: 0, items: 0 });
});

test('série en cours : vivante aujourd’hui, hier, avant-hier avec un gel ; sinon 0', () => {
  const s = (last, freezes = 0) => F.liveStreak(kid('p', 'X', { streak: { count: 6, last, freezes } }), D);
  assert.equal(s(D), 6);
  assert.equal(s(addDays(D, -1)), 6);
  assert.equal(s(addDays(D, -2), 1), 6);
  assert.equal(s(addDays(D, -2), 0), 0);
  assert.equal(s(addDays(D, -3), 1), 0);
  assert.equal(s(''), 0);
  assert.equal(s(addDays(D, 1)), 6);                                   /* horloge reculée : la série reste */
  assert.equal(F.liveStreak({ streak: { count: 0, last: D } }, D), 0);
});

/* ---------- classements ---------- */
test('rankRows : rang dense, ex aequo, pas de médaille pour une valeur nulle, ordre stable', () => {
  const r = F.rankRows([{ id: 'a', value: 5 }, { id: 'b', value: 9 }, { id: 'c', value: 5 }, { id: 'd', value: 0 }, { id: 'e', value: 0 }]);
  assert.deepEqual(r.map(x => [x.id, x.rank, x.tie, x.medal]),
    [['b', 1, false, 'or'], ['a', 2, true, 'argent'], ['c', 2, true, 'argent'], ['d', 3, true, null], ['e', 3, true, null]]);
  const four = F.rankRows([{ id: 'a', value: 4 }, { id: 'b', value: 3 }, { id: 'c', value: 2 }, { id: 'd', value: 1 }]);
  assert.deepEqual(four.map(x => x.medal), ['or', 'argent', 'bronze', null]);     /* le 4e : « bravo aussi », jamais « dernier » */
  const tie = F.rankRows([{ id: 'a', value: 7 }, { id: 'b', value: 7 }]);
  assert.deepEqual(tie.map(x => [x.rank, x.medal]), [[1, 'or'], [1, 'or']]);
  assert.deepEqual(F.rankRows([]), []);
});

test('classements de la semaine : effort et engagement seulement, podium et « bravo aussi »', () => {
  const lea = kid('p1', 'Léa', { week: { minutes: 25.4, apples: 40 }, streak: { count: 4, last: D },
    stars: { pomme: 3, foret: 2, inconnue: 3 }, trophies: [{ k: 'defi', d: D, w: W }, { k: 'defi', d: '2026-09-20', w: '2026-W38' }] });
  const tom = kid('p2', 'Tom', { classe: 'CE1', week: { minutes: 25.2, apples: 12 }, streak: { count: 9, last: addDays(D, -4) },
    trophies: [{ k: 'defi', d: D, w: W }, { k: 'concours', d: D, w: W }] });
  const zoe = kid('p3', 'Zoé', { classe: 'CP' });
  zoe.skills['ma.faits'] = { t: 3, n: 40, last: D, trend: 0, src: 'jeu' };           /* θ élevé : n'intervient nulle part */
  const boards = F.weeklyBoards([lea, tom, zoe], D);
  assert.deepEqual(boards.map(b => b.id), ['minutes', 'apples', 'streak', 'stars', 'trophies']);
  const by = Object.fromEntries(boards.map(b => [b.id, b]));
  /* minutes arrondies : 25 et 25 → ex aequo */
  assert.deepEqual(by.minutes.rows.map(r => [r.id, r.value, r.rank, r.medal]), [['p1', 25, 1, 'or'], ['p2', 25, 1, 'or'], ['p3', 0, 2, null]]);
  assert.deepEqual(by.minutes.podium.map(r => r.id), ['p1', 'p2']);
  assert.deepEqual(by.minutes.others.map(r => r.id), ['p3']);
  assert.deepEqual(by.apples.rows.map(r => [r.id, r.value]), [['p1', 40], ['p2', 12], ['p3', 0]]);
  assert.deepEqual(by.streak.rows.map(r => [r.id, r.value]), [['p1', 4], ['p2', 0], ['p3', 0]]);   /* série de Tom interrompue */
  assert.equal(by.stars.rows[0].value, 5);                                             /* ids d'histoires inconnus ignorés */
  assert.deepEqual(by.trophies.rows.map(r => [r.id, r.value]), [['p1', 1], ['p2', 1], ['p3', 0]]);   /* défis de la semaine */
  assert.equal(by.trophies.empty, false);
  const empty = F.weeklyBoards([kid('a', 'A'), kid('b', 'B')], D);
  assert.ok(empty.filter(b => b.id !== 'stars').every(b => b.empty && !b.podium.length));
  for (const b of F.BOARDS) assert.ok(b.title && b.icon && b.what && b.emptyText, b.id);
  assert.equal(empty[0].emptyText, F.BOARDS[0].emptyText);
});

/* ---------- concours ---------- */
test('stade : le plus avancé entre companion.stage et les minutes (mêmes seuils que le moteur de vie)', async () => {
  assert.equal(F.stageOf({ stage: 1, minutes: 0 }), 1);
  assert.equal(F.stageOf({ stage: 1, minutes: 59.9 }), 1);
  assert.equal(F.stageOf({ stage: 1, minutes: 60 }), 2);
  assert.equal(F.stageOf({ stage: 1, minutes: 300 }), 3);
  assert.equal(F.stageOf({ stage: 3, minutes: 0 }), 3);
  assert.equal(F.stageOf({ stage: 9 }), 3);
  assert.equal(F.stageOf(null), 1);
  let life = null;
  try { life = await import('../js/ui/companion-life.js'); } catch (_) { life = null; }
  if (life && life.STAGE_MINUTES) {
    assert.deepEqual([...F.STAGE_MINUTES], [...life.STAGE_MINUTES], 'seuils des stades alignés sur js/ui/companion-life.js');
    for (const m of [0, 30, 60, 120, 299, 300, 900]) assert.equal(F.stageOf({ stage: 1, minutes: m }), life.stageFor(m), String(m));
  }
});

test('jauges : décroissance douce depuis pet.last, plancher 15, pas de référence → valeurs stockées', () => {
  const h = 3600e3;
  const g = F.gaugesNow({ faim: 80, forme: 80, joie: 80, last: NOW - 24 * h }, NOW);
  assert.ok(Math.abs(g.faim - (80 - 100 * 24 / 48)) < 1e-9);
  assert.ok(Math.abs(g.forme - (80 - 100 * 24 / 72)) < 1e-9);
  assert.ok(Math.abs(g.joie - (80 - 100 * 24 / 96)) < 1e-9);
  assert.deepEqual(F.gaugesNow({ faim: 80, forme: 80, joie: 80, last: NOW - 400 * h }, NOW), { faim: PET.FLOOR, forme: PET.FLOOR, joie: PET.FLOOR });
  assert.deepEqual(F.gaugesNow({ faim: 70, forme: 50, joie: 90, last: 0 }, NOW), { faim: 70, forme: 50, joie: 90 });
  assert.deepEqual(F.gaugesNow(null, NOW), { faim: PET.START, forme: PET.START, joie: PET.START });
});

test('score d’évolution : croissance + soins + élégance (formule lisible)', () => {
  const p = kid('p1', 'Léa', { companion: { type: 'unicorn', owned: ['pony', 'unicorn', 'cat', 'licorne?'], stage: 1, minutes: 75.5,
    equip: { owned: ['chapeau', 'ailes', 'cape'], worn: ['ailes'] } }, pet: { faim: 90, forme: 60, joie: 90, last: 0 } });
  const s = F.companionScore(p, NOW);
  assert.equal(s.stage, 2);
  assert.deepEqual(s.notes, { growth: 200 + 75, care: 240, style: 2 * 25 + 2 * 15 });
  assert.equal(s.total, 275 + 240 + 80);
  assert.equal(s.accessories, 2); assert.equal(s.mounts, 2);
  /* plafond des minutes : 300 */
  const old = F.companionScore(kid('p2', 'Tom', { companion: { minutes: 5000 } }), NOW);
  assert.equal(old.notes.growth, 300 + 300);
  /* un compagnon tout neuf */
  const fresh = F.companionScore(defaultProfile({ today: D }), NOW);
  assert.deepEqual(fresh.notes, { growth: 100, care: 240, style: 0 });
});

test('concours : classement dense, un ruban pour chacun, trophée une seule fois par semaine', () => {
  const big = kid('p1', 'Léa', { companion: { minutes: 400 }, pet: { faim: 40, forme: 40, joie: 40, last: 0 } });
  const chic = kid('p2', 'Tom', { companion: { owned: ['pony', 'cat', 'dragon'], equip: { owned: ['chapeau', 'ailes', 'selle'], worn: [] } },
    pet: { faim: 50, forme: 50, joie: 50, last: 0 } });
  const cuddly = kid('p3', 'Zoé', { pet: { faim: 100, forme: 100, joie: 100, last: 0 } });
  const res = F.concoursResults([big, chic, cuddly], NOW);
  assert.deepEqual(res.map(r => [r.id, r.total, r.rank, r.medal]),
    [['p1', 600 + 120, 1, 'or'], ['p3', 100 + 300, 2, 'argent'], ['p2', 100 + 150 + 105, 3, 'bronze']]);
  assert.deepEqual(res.map(r => r.ribbon.id), ['growth', 'care', 'style']);
  assert.deepEqual(res.map(r => r.ribbon.best), [true, true, true]);
  for (const r of res) assert.ok(r.ribbon.label.startsWith('Grand ruban') && r.ribbon.icon);
  /* un compagnon qui n'a la meilleure note nulle part : ruban d'encouragement de son meilleur domaine (jamais « le plus ») */
  const shy = kid('p4', 'Lou', { pet: { faim: 90, forme: 90, joie: 90, last: 0 } });
  const r4 = F.concoursResults([big, chic, cuddly, shy], NOW).find(r => r.id === 'p4');
  assert.deepEqual(r4.ribbon, { id: 'care', icon: '💖', label: 'Ruban de la tendresse', best: false });
  for (const j of F.JURY) assert.ok(j.ribbon && j.soft && !/plus /.test(j.soft), j.id);
  /* trophée : une seule fois par semaine */
  assert.deepEqual(F.concoursWinnersToAward(res, [big, chic, cuddly], W), ['p1']);
  addTrophy(big, 'concours', D, { score: 720 });
  assert.deepEqual(F.concoursAwarded([big, chic, cuddly], W), ['p1']);
  assert.deepEqual(F.concoursWinnersToAward(res, [big, chic, cuddly], W), []);
  assert.deepEqual(F.concoursWinnersToAward(res, [big, chic, cuddly], '2026-W41'), ['p1']);
  /* ex aequo : deux gagnants */
  const twin = F.concoursResults([kid('a', 'A'), kid('b', 'B')], NOW);
  assert.deepEqual(twin.map(r => [r.rank, r.medal]), [[1, 'or'], [1, 'or']]);
  assert.deepEqual(F.concoursWinnersToAward(twin, [], W), ['a', 'b']);
});

/* ---------- défi ---------- */
test('défi : axe par manche, mélange tournant, pas de conjugaison avant le CE1', () => {
  assert.equal(F.battleAxis('tables', 1, 'CM2'), 'ma.faits');
  assert.equal(F.battleAxis('calcul', 4, 'CP'), 'ma.procedures');
  assert.equal(F.battleAxis('conjug', 2, 'CE1'), 'fr.conjug');
  assert.equal(F.battleAxis('conjug', 2, 'CP'), 'ma.faits');
  assert.deepEqual([1, 2, 3, 4, 5].map(r => F.battleAxis('melange', r, 'CM1')),
    ['ma.faits', 'ma.procedures', 'fr.conjug', 'ma.faits', 'ma.procedures']);
  assert.equal(F.battleAxis('melange', 3, 'CP'), 'ma.faits');
  assert.equal(F.battleAxis('inconnu', 1, 'CM2'), 'ma.faits');
  assert.deepEqual(F.battleAxes('melange', 5, ['CP', 'CM2']).sort(), ['fr.conjug', 'ma.faits', 'ma.procedures']);
  assert.deepEqual(F.battleAxes('conjug', 3, ['CP']), ['ma.faits']);
  for (const c of F.CHALLENGES) assert.ok(c.icon && c.title && c.blurb && c.axes.length, c.id);
});

test('défi : bonus de rapidité relatif au seuil de l’item, série plafonnée, jamais de points négatifs', () => {
  assert.equal(F.autoMsOf({ axis: 'ma.faits', autoMs: 5000 }), 5000);
  assert.equal(F.autoMsOf({ axis: 'ma.faits' }), 3000);
  assert.equal(F.autoMsOf({ axis: 'fr.conjug' }), 9000);
  assert.equal(F.autoMsOf({}), 6000);
  assert.equal(F.speedBonus(0, 3000), 50);
  assert.equal(F.speedBonus(3000, 3000), 50);
  assert.equal(F.speedBonus(6000, 3000), 25);
  assert.equal(F.speedBonus(9000, 3000), 0);
  assert.equal(F.speedBonus(60000, 3000), 0);
  assert.equal(F.speedBonus(14000, 7000), 25);                        /* relatif : un item plus long laisse plus de temps */
  assert.equal(F.speedBonus(NaN, 3000), 0);
  for (let ms = 0; ms < 12000; ms += 250) assert.equal(F.speedBonus(ms, 3000) % 5, 0);
  assert.deepEqual(F.questionPoints({ correct: true, ms: 1000, autoMs: 3000, streak: 1 }), { base: 100, speed: 50, streak: 0, total: 150 });
  assert.deepEqual(F.questionPoints({ correct: true, ms: 1000, autoMs: 3000, streak: 3 }), { base: 100, speed: 50, streak: 20, total: 170 });
  assert.deepEqual(F.questionPoints({ correct: true, ms: 1000, autoMs: 3000, streak: 9 }), { base: 100, speed: 50, streak: 30, total: 180 });
  assert.deepEqual(F.questionPoints({ correct: false, ms: 500, autoMs: 3000, streak: 4 }), { base: 0, speed: 0, streak: 0, total: 0 });
});

test('défi : classement final avec ex aequo, joueurs au repos, récompenses', () => {
  const players = [
    { id: 'p1', points: 320, answered: 3 }, { id: 'p2', points: 320, answered: 3 },
    { id: 'p3', points: 410, answered: 1, abandoned: true }, { id: 'p4', points: 150, answered: 3 }
  ];
  const r = F.battleRanking(players);
  assert.deepEqual(r.rows.map(x => [x.id, x.rank, x.medal]), [['p1', 1, 'or'], ['p2', 1, 'or'], ['p4', 2, 'argent']]);
  assert.deepEqual(r.winners, ['p1', 'p2']); assert.equal(r.tie, true);
  assert.deepEqual(r.resting, ['p3']);
  assert.deepEqual(F.battleRewards(players, r), {
    p1: { apples: 15, trophy: true }, p2: { apples: 15, trophy: true }, p3: { apples: 5, trophy: false }, p4: { apples: 5, trophy: false } });
  /* personne n'a marqué : pas de gagnant (ni trophée) */
  const zero = F.battleRanking([{ id: 'a', points: 0, answered: 3 }, { id: 'b', points: 0, answered: 3 }]);
  assert.deepEqual(zero.winners, []);
  /* un joueur qui s'arrête avant d'avoir répondu n'a pas de participation */
  assert.deepEqual(F.battleRewards([{ id: 'x', points: 0, answered: 0, abandoned: true }], F.battleRanking([])), { x: { apples: 0, trophy: false } });
  /* tout le monde au repos */
  assert.deepEqual(F.battleRanking([{ id: 'a', points: 90, abandoned: true }]).winners, []);
});

test('défi : piste et ordre de la revanche', () => {
  assert.equal(F.trackFrac(0, 3), 0);
  assert.equal(F.trackFrac(225, 3), 0.5);
  assert.equal(F.trackFrac(9999, 5), 1);
  assert.deepEqual(F.rotate(['a', 'b', 'c']), ['b', 'c', 'a']);
  assert.deepEqual(F.rotate(['a', 'b', 'c'], 2), ['c', 'a', 'b']);
  assert.deepEqual(F.rotate(['a']), ['a']);
});

/* ---------- économie : compteur de la semaine et trophées ---------- */
test('addApples : un gain compte dans la semaine, une dépense non ; bumpWeek remet à zéro le lundi', () => {
  const p = defaultProfile({ today: D });
  assert.ok(!('week' in p.stats));
  addApples(p, 12, D);
  addApples(p, -5, D);
  addApples(p, 0, D);
  assert.deepEqual(p.stats.week, { w: W, minutes: 0, apples: 12, items: 0 });
  bumpWeek(p, { minutes: 2.345, items: 3 }, D);
  bumpWeek(p, { minutes: -4, items: NaN, apples: 'x' }, D);
  assert.deepEqual(p.stats.week, { w: W, minutes: 2.35, apples: 12, items: 3 });
  /* lundi suivant : nouvelle semaine */
  addApples(p, 4, '2026-10-05');
  assert.deepEqual(p.stats.week, { w: '2026-W41', minutes: 0, apples: 4, items: 0 });
  /* horloge reculée : on reste dans la semaine enregistrée (pas de retour en arrière) */
  addApples(p, 1, D);
  assert.equal(p.stats.week.w, '2026-W41'); assert.equal(p.stats.week.apples, 5);
  /* le bonus de série compte dans la semaine de son jour */
  const q = defaultProfile({ today: D });
  bumpStreak(q, D);
  assert.deepEqual(q.stats.week, { w: W, minutes: 0, apples: 10, items: 0 });
  assert.equal(weekCounter(null, D), null);
  const bare = {};
  addApples(bare, 3, D);
  assert.deepEqual(bare.stats, { minutes: 0, sessions: 0, items: 0, week: { w: W, minutes: 0, apples: 3, items: 0 } });
});

test('semaine de la mise à jour : minutes et items retrouvés dans l’historique (pommes à 0), sans double compte', () => {
  const p = defaultProfile({ id: 'p1', today: D });
  p.history = [
    { d: '2026-09-29', t: 1, g: 'tables', ax: 'ma.faits', ms: 120000, n: 8 },
    { d: '2026-10-02', t: 2, g: 'pommes', ax: 'ma.procedures', ms: 60000, n: 4 },
    { d: '2026-09-27', t: 0, g: 'tables', ax: 'ma.faits', ms: 999999, n: 50 },      /* semaine précédente */
    'abîmé', { d: 'hier', ms: 5000, n: 1 }
  ];
  assert.deepEqual(F.weekStats(p, D), { w: W, minutes: 3, apples: 0, items: 12 });
  addApples(p, 5, D);                                                              /* crée le compteur, amorcé */
  assert.deepEqual(p.stats.week, { w: W, minutes: 3, apples: 5, items: 12 });
  assert.deepEqual(F.weekStats(p, D), { w: W, minutes: 3, apples: 5, items: 12 });
  /* la semaine suivante ne reprend rien */
  assert.deepEqual(F.weekStats(p, '2026-10-05'), { w: '2026-W41', minutes: 0, apples: 0, items: 0 });
});

test('addTrophy : entrée datée avec la semaine, sortes connues seulement, plafond', () => {
  const p = defaultProfile({ today: D });
  assert.ok(!('trophies' in p));
  const t = addTrophy(p, 'defi', D, { n: 3, pts: 420, type: 'tables', k: 'triche' });
  assert.deepEqual(t, { n: 3, pts: 420, type: 'tables', k: 'defi', d: D, w: W });
  assert.equal(p.trophies.length, 1);
  assert.equal(addTrophy(p, 'medaille', D), null);
  assert.equal(addTrophy(null, 'defi', D), null);
  for (let i = 0; i < TROPHIES_MAX + 5; i++) addTrophy(p, 'concours', D, { i });
  assert.equal(p.trophies.length, TROPHIES_MAX);
  assert.equal(p.trophies[TROPHIES_MAX - 1].i, TROPHIES_MAX + 4);
});

/* ---------- profils : normalisation (rétrocompatible) ---------- */
test('normalizeProfile : stats.week et trophies facultatifs, normalisés, idempotents', () => {
  /* absents → restent absents (anciennes sauvegardes inchangées) */
  const old = normalizeProfile(defaultProfile({ id: 'p1', today: D }), D);
  assert.ok(!('week' in old.stats)); assert.ok(!('trophies' in old));
  assert.deepEqual(old.stats, { minutes: 0, sessions: 0, items: 0 });
  /* valeurs abîmées bornées ; semaine illisible → retirée ; trophées illisibles filtrés */
  const p = normalizeProfile({
    id: 'p2', stats: { minutes: 3, sessions: 1, items: 2, week: { w: W, minutes: -3, apples: '7', items: 2.9, futur: 1 } },
    trophies: [{ k: 'defi', d: D, w: W, pts: 300 }, { k: 'concours', d: 'hier' }, 'abîmé', { d: D }, { k: 'defi', d: D, w: 'x' }]
  }, D);
  assert.deepEqual(p.stats.week, { w: W, minutes: 0, apples: 7, items: 2, futur: 1 });
  assert.deepEqual(p.trophies, [{ k: 'defi', d: D, w: W, pts: 300 }, { k: 'defi', d: D }]);
  assert.equal(JSON.stringify(normalizeProfile(p, '2030-01-01')), JSON.stringify(p));
  const bad = normalizeProfile({ stats: { minutes: 1, week: { w: 'semaine 40', apples: 3 } }, trophies: 'non' }, D);
  assert.ok(!('week' in bad.stats));
  assert.deepEqual(bad.trophies, []);
  const capped = normalizeProfile({ trophies: Array.from({ length: 320 }, (_, i) => ({ k: 'defi', d: D, i })) }, D);
  assert.equal(capped.trophies.length, 300);
  assert.equal(capped.trophies[0].i, 20);
});
