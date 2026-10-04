import { test, assert } from './_t.mjs';
import {
  IMPORTANCE, eligibleAxes, axisWeight, planDay, ensureToday, completeBlock, finishDay, isPreReader, swapBlock
} from '../js/core/session.js';
import { mancheSize, gamesFor, GAME_BY_ID } from '../js/games/index.js';
import { makeRng } from '../js/core/rng.js';
import { addDays } from '../js/core/util.js';
import { CLASSES } from '../js/core/axes.js';

const D = '2026-10-02';
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

/* profil réaliste minimal (données inventées) : skills = { axe: θ } ; played = { axe: jours écoulés } */
function prof({ classe = 'CM2', skills = {}, played = {}, due = {}, sessionMin = 15 } = {}) {
  const p = {
    id: 'p1', name: 'Test', g: 'f', classe,
    wallet: { apples: 0, stars: {} },
    streak: { count: 0, last: '', freezes: 1, freezeWeek: '' },
    skills: {}, evals: [], snapshots: [], leitner: {}, history: [], mclm: [], today: null, legacy: null,
    settings: { sessionMin, timers: false, sound: true, motion: 'full' },
    stats: { minutes: 0, sessions: 0, items: 0 }
  };
  for (const [ax, t] of Object.entries(skills)) p.skills[ax] = { t, n: 4, last: '2026-09-20', trend: 0, src: 'eval' };
  for (const [ax, days] of Object.entries(played)) {
    p.history.push({ d: addDays(D, -days), t: 0, g: 'x', ax, n: 10, ok: 8, hint: 1, ms: 120000, th: 1.5, mode: 'libre' });
  }
  for (const [ax, n] of Object.entries(due)) {
    for (let i = 0; i < n; i++) p.leitner[`${ax}:k${i}`] = { b: 1, due: addDays(D, -1), seen: 1, ok: 0, last: addDays(D, -2) };
  }
  return p;
}
const games = plan => plan.blocks.map(b => b.game);
function assertNoRepeat(plan) {
  const g = games(plan);
  for (let i = 1; i < g.length; i++) if (g[i] !== null) assert.notEqual(g[i], g[i - 1], 'même jeu deux fois de suite : ' + g.join(' → '));
}

test('axes éligibles : jeux accessibles à la classe', () => {
  assert.deepEqual(eligibleAxes(prof({ classe: 'CP' })), ['fr.fluence', 'ma.ligne', 'ma.faits', 'ma.procedures']);
  assert.deepEqual(eligibleAxes(prof({ classe: 'CE1' })).length, 6);
  assert.deepEqual(eligibleAxes(prof({ classe: 'CM2' })),
    ['fr.fluence', 'ma.ligne', 'ma.faits', 'ma.procedures', 'fr.conjug', 'ma.operations']);
  assert.equal(eligibleAxes(prof({ classe: null })).length, 6);       /* classe pas encore choisie */
});

test('poids : (3 − θ)^1,5 × importance × fraîcheur', () => {
  const p = prof({ skills: { 'ma.ligne': 0.7, 'fr.fluence': 1 }, played: { 'ma.procedures': 0, 'fr.conjug': 3, 'ma.operations': 7 } });
  near(axisWeight(p, 'ma.ligne', D), Math.pow(2.3, 1.5) * 2);                 /* jamais pratiqué → 2 */
  near(axisWeight(p, 'fr.fluence', D), Math.pow(2, 1.5) * IMPORTANCE['fr.fluence'] * 2);
  near(axisWeight(p, 'ma.faits', D), Math.pow(1.5, 1.5) * 1.3 * 2);           /* θ par défaut 1,5 */
  near(axisWeight(p, 'ma.procedures', D), Math.pow(1.5, 1.5) * 0.5);          /* pratiqué aujourd'hui */
  near(axisWeight(p, 'fr.conjug', D), Math.pow(1.5, 1.5) * (1 + 3 / 7));
  near(axisWeight(p, 'ma.operations', D), Math.pow(1.5, 1.5) * 2);            /* ≥ 7 j */
  p.skills['ma.faits'] = { t: 3, n: 9, last: '', trend: 0, src: 'eval' };
  assert.equal(axisWeight(p, 'ma.faits', D), 0);
  /* un import d'évaluation (skill.last = aujourd'hui) n'est pas une pratique */
  p.skills['ma.ligne'].last = D;
  near(axisWeight(p, 'ma.ligne', D), Math.pow(2.3, 1.5) * 2);
});

test('CM2 avec ligne graduée 0,7 et fluence 1,0 : la priorité cible un axe faible', () => {
  const skills = { 'fr.fluence': 1.0, 'ma.ligne': 0.7, 'ma.faits': 2.4, 'ma.procedures': 1.9, 'fr.conjug': 1.6, 'ma.operations': 2.0 };
  const plan = planDay(prof({ skills }), D);
  assert.equal(plan.d, D); assert.equal(plan.idx, 0); assert.equal(plan.done, false); assert.equal(plan.rewarded, false);
  assert.deepEqual(plan.blocks.map(b => b.kind), ['echauffement', 'priorite', 'revision', 'recompense']);
  const [b1, b2, b3, b4] = plan.blocks;
  /* échauffement sur le point fort, plus facile et plus court */
  assert.equal(b1.axis, 'ma.faits'); assert.equal(b1.game, 'tables');
  assert.equal(b1.offset, -0.6); assert.equal(b1.count, Math.ceil(0.7 * mancheSize('tables', 15)));
  /* priorité : un axe faible */
  assert.ok(['fr.fluence', 'ma.ligne'].includes(b2.axis), b2.axis);
  assert.equal(b2.axis, 'fr.fluence'); assert.equal(b2.count, 2); assert.equal(b2.offset, 0);   /* lecture prioritaire : 2 histoires */
  /* révision : jamais pratiqué → l'autre axe faible */
  assert.equal(b3.axis, 'ma.ligne'); assert.equal(b3.game, 'cloture'); assert.equal(b3.count, mancheSize('cloture', 15));
  /* la course est déjà au programme → jeu libre */
  assert.deepEqual(b4, { kind: 'recompense', game: null, axis: null, count: null, offset: 0, done: false, result: null });
  for (const b of plan.blocks) { assert.equal(b.done, false); assert.equal(b.result, null); }
  assertNoRepeat(plan);

  /* la lecture a déjà été pratiquée aujourd'hui : la priorité passe à la ligne graduée */
  const plan2 = planDay(prof({ skills, played: { 'fr.fluence': 0 } }), D);
  assert.equal(plan2.blocks[1].axis, 'ma.ligne');
  assert.equal(plan2.blocks[3].game, 'course');               /* course absente des blocs 1-3 → récompense */
  assert.equal(plan2.blocks[3].axis, 'fr.fluence');
  assert.equal(plan2.blocks[3].count, mancheSize('course', 15));
  assertNoRepeat(plan2);
});

test('durée de séance : count = mancheSize(jeu, sessionMin)', () => {
  const skills = { 'fr.fluence': 1.0, 'ma.ligne': 0.7, 'ma.faits': 2.4 };
  for (const sessionMin of [10, 15, 20]) {
    const plan = planDay(prof({ skills, sessionMin, played: { 'fr.fluence': 0 } }), D);
    const [b1, ...rest] = plan.blocks;
    assert.equal(b1.count, Math.ceil(0.7 * mancheSize(b1.game, sessionMin)));
    for (const b of rest) if (b.game) assert.equal(b.count, mancheSize(b.game, sessionMin), b.kind);
  }
});

test('révision hebdomadaire : l’axe non pratiqué depuis ≥ 6 jours revient', () => {
  const skills = { 'ma.faits': 2.6, 'fr.fluence': 1.0, 'ma.ligne': 0.7, 'ma.operations': 2.2, 'ma.procedures': 1.9, 'fr.conjug': 1.6 };
  const played = { 'ma.faits': 1, 'fr.fluence': 1, 'ma.ligne': 1, 'ma.operations': 8, 'ma.procedures': 1, 'fr.conjug': 2 };
  const plan = planDay(prof({ skills, played }), D);
  assert.equal(plan.blocks[0].axis, 'ma.faits');
  assert.equal(plan.blocks[1].axis, 'fr.fluence');
  assert.equal(plan.blocks[2].kind, 'revision');
  assert.equal(plan.blocks[2].axis, 'ma.operations');
  /* 6 jours suffisent ; à 5 jours, c'est le 2e poids (ligne graduée) */
  assert.equal(planDay(prof({ skills, played: { ...played, 'ma.operations': 6 } }), D).blocks[2].axis, 'ma.operations');
  assert.equal(planDay(prof({ skills, played: { ...played, 'ma.operations': 5 } }), D).blocks[2].axis, 'ma.ligne');
  /* le plus longtemps délaissé d'abord */
  const p3 = planDay(prof({ skills, played: { ...played, 'ma.operations': 8, 'fr.conjug': 12 } }), D);
  assert.equal(p3.blocks[2].axis, 'fr.conjug');
});

test('révision espacée : ≥ 4 clés Leitner dues (faits, conjugaison)', () => {
  const skills = { 'ma.ligne': 2.5, 'fr.fluence': 1.0, 'fr.conjug': 1.2, 'ma.faits': 1.8, 'ma.procedures': 1.5, 'ma.operations': 1.7 };
  const played = { 'ma.ligne': 1, 'fr.fluence': 1, 'fr.conjug': 2, 'ma.faits': 2, 'ma.procedures': 1, 'ma.operations': 3 };
  const base = planDay(prof({ skills, played }), D);
  assert.equal(base.blocks[0].axis, 'ma.ligne');
  assert.equal(base.blocks[1].axis, 'fr.fluence');
  assert.equal(base.blocks[2].axis, 'fr.conjug');            /* sans dues : 2e poids */
  const withFaits = planDay(prof({ skills, played, due: { 'ma.faits': 5 } }), D);
  assert.equal(withFaits.blocks[2].axis, 'ma.faits'); assert.equal(withFaits.blocks[2].game, 'tables');
  const only3 = planDay(prof({ skills, played, due: { 'ma.faits': 3 } }), D);
  assert.equal(only3.blocks[2].axis, 'fr.conjug');           /* 3 dues : pas assez */
  const both = planDay(prof({ skills, played, due: { 'ma.faits': 5, 'fr.conjug': 7 } }), D);
  assert.equal(both.blocks[2].axis, 'fr.conjug');            /* le plus de clés dues */
  /* les dues de demain ne comptent pas */
  const p = prof({ skills, played });
  for (let i = 0; i < 6; i++) p.leitner['ma.faits:' + i + 'x7'] = { b: 2, due: addDays(D, 1), seen: 1, ok: 1, last: D };
  assert.equal(planDay(p, D).blocks[2].axis, 'fr.conjug');
});

test('récompense : la course si elle n’est pas déjà au programme, sinon jeu libre', () => {
  const skills = { 'ma.faits': 2.8, 'fr.fluence': 2.5, 'ma.ligne': 1.2, 'ma.procedures': 1.4, 'fr.conjug': 1.3, 'ma.operations': 1.6 };
  const plan = planDay(prof({ skills, played: { 'fr.fluence': 0 } }), D);
  assert.ok(plan.blocks.slice(0, 3).every(b => b.game !== 'course'));
  assert.deepEqual(plan.blocks[3], { kind: 'recompense', game: 'course', axis: 'fr.fluence', count: 1, offset: 0, done: false, result: null });
  /* point fort = lecture : la course sert d'échauffement, la récompense devient libre */
  const strongReader = planDay(prof({ skills: { ...skills, 'fr.fluence': 2.9 } }), D);
  assert.equal(strongReader.blocks[0].game, 'course');
  assert.equal(strongReader.blocks[0].count, 1);
  assert.equal(strongReader.blocks[3].game, null);
  /* égalité de θ (profil neuf) : l'échauffement laisse la course à la récompense */
  const fresh = planDay(prof(), D);
  assert.notEqual(fresh.blocks[0].game, 'course');
  assertNoRepeat(fresh);
});

test('CP : jamais l’orchestre ni les opérations', () => {
  const rng = makeRng('cp');
  for (let k = 0; k < 200; k++) {
    const skills = {}, played = {};
    for (const ax of ['fr.fluence', 'ma.ligne', 'ma.faits', 'ma.procedures', 'fr.conjug', 'ma.operations']) {
      if (rng.chance(0.8)) skills[ax] = Math.round(rng.float(0, 3) * 10) / 10;
      if (rng.chance(0.6)) played[ax] = rng.int(0, 12);
    }
    const plan = planDay(prof({ classe: 'CP', skills, played, due: { 'ma.faits': rng.int(0, 8) } }), D);
    for (const b of plan.blocks) {
      assert.ok(!['orchestre', 'operations'].includes(b.game), games(plan).join(' → '));
      assert.ok(!['fr.conjug', 'ma.operations'].includes(b.axis));
    }
    assertNoRepeat(plan);
  }
});

test('propriétés sur 1 000 profils variés : 4 blocs, jamais deux jeux identiques de suite', () => {
  const rng = makeRng('balade');
  const AX = ['fr.fluence', 'ma.ligne', 'ma.faits', 'ma.procedures', 'fr.conjug', 'ma.operations'];
  for (let k = 0; k < 1000; k++) {
    const classe = rng.pick(CLASSES);
    const skills = {}, played = {};
    for (const ax of AX) {
      if (rng.chance(0.85)) skills[ax] = rng.chance(0.2) ? rng.pick([0, 1.5, 3]) : Math.round(rng.float(0, 3) * 100) / 100;
      if (rng.chance(0.6)) played[ax] = rng.int(0, 10);
    }
    const sessionMin = rng.pick([10, 15, 20]);
    const p = prof({ classe, skills, played, sessionMin, due: { 'ma.faits': rng.int(0, 7), 'fr.conjug': rng.int(0, 7) } });
    const plan = planDay(p, D);
    const allowed = new Set(gamesFor(classe).map(g => g.id));
    assert.deepEqual(plan.blocks.map(b => b.kind), ['echauffement', 'priorite', 'revision', 'recompense']);
    assertNoRepeat(plan);
    const [b1, b2, b3, b4] = plan.blocks;
    for (const b of [b1, b2, b3]) {
      assert.ok(allowed.has(b.game), b.game);
      assert.equal(GAME_BY_ID[b.game].primary, b.axis);
    }
    assert.notEqual(b2.axis, b1.axis);
    /* un axe faible (θ < 2) pris en échauffement peut revenir en révision, à son vrai niveau (blocs non consécutifs) */
    assert.notEqual(b3.axis, b2.axis);
    if ((p.skills[b1.axis] ? p.skills[b1.axis].t : 1.5) >= 2) assert.notEqual(b3.axis, b1.axis);
    /* petit lecteur de CP (D1-03) : pas de lecture à voix haute imposée */
    const pre = isPreReader(p);
    const axes = eligibleAxes(p).filter(ax => !(pre && ax === 'fr.fluence'));
    if (pre) assert.ok(plan.blocks.every(b => b.game !== 'course'));
    const thetas = axes.map(ax => (p.skills[ax] ? p.skills[ax].t : 1.5));
    assert.equal(p.skills[b1.axis] ? p.skills[b1.axis].t : 1.5, Math.max(...thetas));
    assert.equal(b1.offset, -0.6);
    /* course : 1 histoire en échauffement, 2 en priorité/révision (3 pour 20 min) ; autres jeux : manche normale */
    const courseN = kind => (kind === 'echauffement' ? 1 : 2 + (sessionMin >= 20 ? 1 : 0));
    assert.equal(b1.count, b1.game === 'course' ? 1 : Math.ceil(0.7 * mancheSize(b1.game, sessionMin)));
    assert.equal(b2.count, b2.game === 'course' ? courseN('priorite') : mancheSize(b2.game, sessionMin));
    assert.equal(b3.count, b3.game === 'course' ? courseN('revision') : mancheSize(b3.game, sessionMin));
    /* priorité = poids maximal hors axe d'échauffement */
    const wMax = Math.max(...axes.filter(ax => ax !== b1.axis).map(ax => axisWeight(p, ax, D)));
    near(axisWeight(p, b2.axis, D), wMax);
    const courseUsed = [b1, b2, b3].some(b => b.game === 'course');
    assert.equal(b4.game, courseUsed || pre ? null : 'course');
  }
});

test('ensureToday : même plan dans la journée, nouveau plan le lendemain', () => {
  const p = prof({ skills: { 'ma.ligne': 0.7, 'fr.fluence': 1.0 } });
  const plan = ensureToday(p, D);
  assert.equal(p.today, plan); assert.equal(plan.d, D);
  completeBlock(p, 0, { n: 7 });
  assert.equal(ensureToday(p, D), plan);                       /* conservé, progression comprise */
  assert.equal(p.today.blocks[0].done, true);
  const next = ensureToday(p, '2026-10-03');
  assert.notEqual(next, plan);
  assert.equal(next.d, '2026-10-03'); assert.equal(next.idx, 0);
  assert.ok(next.blocks.every(b => !b.done));
  /* plan devenu invalide (classe changée) ou abîmé → recalculé */
  p.classe = 'CM2';
  p.today = planDay(p, D);
  p.today.blocks[1] = { ...p.today.blocks[1], game: 'orchestre', axis: 'fr.conjug' };
  p.classe = 'CP';
  assert.ok(ensureToday(p, D).blocks.every(b => b.game !== 'orchestre'));
  p.today = { d: D, blocks: 'abîmé' };
  assert.equal(ensureToday(p, D).blocks.length, 4);
  p.today = null;
  assert.equal(ensureToday(p, D).d, D);
});

test('completeBlock : done, bloc suivant, balade finie', () => {
  const p = prof({ skills: { 'ma.ligne': 0.7 } });
  ensureToday(p, D);
  assert.equal(completeBlock(p, 0, { g: 'x', n: 7, ok: 6 }).idx, 1);
  assert.deepEqual(p.today.blocks[0].result, { g: 'x', n: 7, ok: 6 });
  completeBlock(p, 2);                                          /* dans le désordre */
  assert.equal(p.today.idx, 1); assert.equal(p.today.blocks[2].result, null);
  completeBlock(p, 1, {});
  assert.equal(p.today.idx, 3); assert.equal(p.today.done, false);
  completeBlock(p, 3, {});
  assert.equal(p.today.done, true); assert.equal(p.today.idx, 4);
  assert.equal(completeBlock(p, 9, {}), null);
  assert.equal(completeBlock(prof(), 0, {}), null);           /* pas de plan */
});

test('finishDay : +10 🍎 une seule fois, seulement si tout est fait', () => {
  const p = prof();
  assert.equal(finishDay(p), 0);
  ensureToday(p, D);
  completeBlock(p, 0); completeBlock(p, 1); completeBlock(p, 2);
  assert.equal(finishDay(p), 0);
  assert.equal(p.wallet.apples, 0);
  completeBlock(p, 3);
  assert.equal(finishDay(p), 10);
  assert.equal(p.wallet.apples, 10);
  assert.equal(p.today.rewarded, true);
  assert.equal(finishDay(p), 0);
  completeBlock(p, 1, { replay: true });                        /* rejouer un bloc ne repaie pas */
  assert.equal(finishDay(p), 0);
  assert.equal(p.wallet.apples, 10);
});

test('rotation sur 14 jours (profil de CM2 sous les attendus) : échauffement varié, chaque axe au niveau chaque semaine', () => {
  const skills = { 'fr.fluence': 1.3, 'ma.ligne': 0.7, 'ma.faits': 1.2, 'ma.procedures': 1.5, 'fr.conjug': 1.5, 'ma.operations': 1.5 };
  const p = prof({ skills });
  const warm = [], levelDays = {};
  for (let day = 0; day < 14; day++) {
    const d = addDays(D, day);
    const plan = planDay(p, d);
    p.today = plan;
    assertNoRepeat(plan);
    warm.push(plan.blocks[0].axis);
    for (const b of plan.blocks) {
      if (!b.game) continue;
      p.history.push({ d, t: day, g: b.game, ax: b.axis, n: b.count, ok: b.count, hint: 0, ms: 60000, th: 1.5, mode: 'balade', k: b.kind });
      if (b.kind !== 'echauffement') (levelDays[b.axis] = levelDays[b.axis] || []).push(day);
    }
  }
  /* jamais le même échauffement que l'un des deux jours précédents (au moins 3 candidats) */
  for (let i = 2; i < warm.length; i++) assert.ok(warm[i] !== warm[i - 1] && warm[i] !== warm[i - 2], warm.join(' → '));
  /* chaque axe éligible est travaillé à son niveau (hors échauffement) au moins une fois par fenêtre de 7 jours */
  for (const ax of eligibleAxes(p)) {
    const days = levelDays[ax] || [];
    for (let start = 0; start + 7 <= 14; start++) assert.ok(days.some(x => x >= start && x < start + 7), ax + ' jours ' + days.join(','));
  }
});

test('CP qui ne lit pas encore : aucune lecture à voix haute dans la balade, récompense au choix (D1-03)', () => {
  const rng = makeRng('cp-lecteur');
  for (let k = 0; k < 200; k++) {
    const skills = {};
    for (const ax of ['fr.fluence', 'ma.ligne', 'ma.faits', 'ma.procedures']) if (rng.chance(0.8)) skills[ax] = Math.round(rng.float(0, 3) * 10) / 10;
    const p = prof({ classe: 'CP', skills });
    assert.ok(isPreReader(p));
    const plan = planDay(p, D);
    assert.equal(plan.blocks.length, 4);
    assert.ok(plan.blocks.every(b => b.game !== 'course'), games(plan).join(' → '));
    assert.equal(plan.blocks[3].game, null);
    assertNoRepeat(plan);
  }
  /* une lecture mesurée à 15 mots/min ou plus (course, ou v11 importée) : la course revient */
  const reader = prof({ classe: 'CP' });
  reader.mclm = [{ d: D, t: 0, s: 'carotte', v: 18 }];
  assert.ok(!isPreReader(reader));
  assert.ok(planDay(reader, D).blocks.some(b => b.game === 'course'));
  const legacy = prof({ classe: 'CP' });
  legacy.legacy = { from: 'v11', mclm: 22, stars: 6 };
  assert.ok(!isPreReader(legacy));
  const slow = prof({ classe: 'CP' });
  slow.mclm = [{ d: D, t: 0, s: 'carotte', v: 9 }];
  assert.ok(isPreReader(slow));
  /* hors CP : rien ne change */
  assert.ok(!isPreReader(prof({ classe: 'CE1' })));
  assert.ok(planDay(prof({ classe: 'CE1' }), D).blocks.some(b => b.game === 'course'));
});

test('swapBlock : sans micro, l’étape course prend un autre jeu, jamais deux fois le même de suite (D1-01)', () => {
  /* lecture = priorité (bloc 2) */
  const skills = { 'fr.fluence': 0.8, 'ma.ligne': 2.6, 'ma.faits': 1.9, 'ma.procedures': 1.7, 'fr.conjug': 1.6, 'ma.operations': 1.8 };
  const p = prof({ skills, sessionMin: 20 });
  p.today = planDay(p, D);
  const i = p.today.blocks.findIndex(b => b.game === 'course');
  assert.ok(i >= 0 && i < 3, games(p.today).join(' → '));
  const before = JSON.parse(JSON.stringify(p.today.blocks[i]));
  const id = swapBlock(p, i, D);
  const b = p.today.blocks[i];
  assert.equal(b.game, id);
  assert.ok(id && id !== 'course');
  assert.equal(b.swapped, 'course');
  assert.equal(b.kind, before.kind);
  assert.equal(b.offset, before.offset);
  assert.equal(b.axis, GAME_BY_ID[id].primary);
  assert.equal(b.count, b.kind === 'echauffement' ? Math.ceil(0.7 * mancheSize(id, 20)) : mancheSize(id, 20));
  assert.ok(!p.today.blocks.some((x, k) => k !== i && x.axis === b.axis), 'axe déjà au programme');
  assertNoRepeat(p.today);
  /* récompense déjà au choix (la course était au programme) : la course choisie là ne démarre pas → elle devient le jeu
     remplacé, que la feuille ne propose plus (V22A-1) ; sans jeu en échec, ou le même encore, rien ne change */
  const r = p.today.blocks[3];
  assert.deepEqual([r.kind, r.game, r.swapped], ['recompense', null, undefined]);
  assert.equal(swapBlock(p, 3, D), undefined);
  assert.equal(r.swapped, undefined);
  assert.equal(swapBlock(p, 3, D, 'course'), null);
  assert.deepEqual([r.game, r.axis, r.count, r.swapped], [null, null, null, 'course']);
  assert.equal(swapBlock(p, 3, D, 'course'), undefined);
  /* récompense course → jeu au choix ; étape faite, déjà au choix, autre jour : rien ne change */
  const q = prof({ skills: { ...skills, 'fr.fluence': 2.5 }, played: { 'fr.fluence': 0 } });
  q.today = planDay(q, D);
  assert.equal(q.today.blocks[3].game, 'course');
  assert.equal(swapBlock(q, 3, D), null);
  assert.deepEqual([q.today.blocks[3].game, q.today.blocks[3].axis, q.today.blocks[3].count, q.today.blocks[3].swapped], [null, null, null, 'course']);
  assert.equal(swapBlock(q, 3, D), undefined);
  completeBlock(q, 0);
  const done = JSON.stringify(q.today.blocks[0]);
  assert.equal(swapBlock(q, 0, D), undefined);
  assert.equal(swapBlock(q, 0, D, 'course'), undefined);
  assert.equal(JSON.stringify(q.today.blocks[0]), done);
  assert.equal(swapBlock(q, 1, addDays(D, 1)), undefined);
  assert.equal(swapBlock(q, 9, D), undefined);
  assert.equal(swapBlock(prof(), 0, D), undefined);
  /* le plan reste valide : ensureToday le garde */
  const kept = q.today;
  ensureToday(q, D);
  assert.equal(q.today, kept);
});

test('swapBlock sur 500 plans variés : autre jeu de la classe, jamais deux fois le même de suite', () => {
  const rng = makeRng('swap');
  const AX = ['fr.fluence', 'ma.ligne', 'ma.faits', 'ma.procedures', 'fr.conjug', 'ma.operations'];
  for (let k = 0; k < 500; k++) {
    const classe = rng.pick(CLASSES);
    const skills = {}, played = {};
    for (const ax of AX) {
      if (rng.chance(0.8)) skills[ax] = Math.round(rng.float(0, 3) * 10) / 10;
      if (rng.chance(0.5)) played[ax] = rng.int(0, 10);
    }
    const p = prof({ classe, skills, played, sessionMin: rng.pick([10, 15, 20]) });
    p.today = planDay(p, D);
    const ok = new Set(gamesFor(classe).map(g => g.id));
    for (let i = 0; i < p.today.blocks.length; i++) {
      const was = p.today.blocks[i].game;
      const id = swapBlock(p, i, D);
      if (was === null) { assert.equal(id, undefined); continue; }
      if (p.today.blocks[i].kind === 'recompense') { assert.equal(id, null); continue; }
      if (id === undefined) continue;                       /* aucun autre jeu possible (jamais en pratique) */
      assert.ok(ok.has(id) && id !== was, classe + ' : ' + was + ' → ' + id);
      assertNoRepeat(p.today);
    }
  }
});
