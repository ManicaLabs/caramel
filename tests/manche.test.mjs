import { test, assert, memoryStorage } from './_t.mjs';
import * as store from '../js/core/store.js';
import { defaultProfile } from '../js/core/profiles.js';
import { createManche } from '../js/core/manche.js';
import { ensureToday } from '../js/core/session.js';
import { skillOf, targetB } from '../js/core/adaptive.js';
import { absLevel, relLevel } from '../js/core/levels.js';
import { addDays, weekKey } from '../js/core/util.js';
import { mancheSize } from '../js/games/index.js';

const D = '2026-10-02';
const T0 = 1759400000000;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

/* ---------- doublures ---------- */
/* horloge pilotée : chaque appel à step() avance de dt ms */
function fakeClock(start = T0) {
  let t = start;
  const clock = () => t;
  clock.step = (dt = 10000) => { t += dt; return t; };
  return clock;
}
/* générateur factice de faits multiplicatifs (clés 'ma.faits:AxB', rejeu Leitner) */
function fakeFaits({ withFromKey = true, shiftA = 0 } = {}) {
  const calls = { gen: 0, fromKey: 0, A: [], opts: [] };
  const mod = {
    axis: 'ma.faits', calls,
    gen(A, rng, opts = {}) {
      calls.gen++; calls.A.push(A); calls.opts.push(opts);
      const avoid = opts.avoid || new Set();
      let a, b, key, n = 0;
      do { a = rng.int(2, 9); b = rng.int(2, 9); key = `ma.faits:${Math.min(a, b)}x${Math.max(a, b)}`; } while (avoid.has(key) && ++n < 80);
      return { axis: 'ma.faits', kind: 'mul', key, A: shiftA ? A + shiftA : A, prompt: `${a} × ${b}`, answer: a * b,
        hint: 'indice', explain: 'explication', leitner: true };
    }
  };
  if (withFromKey) {
    mod.fromKey = (key, A, rng) => {
      calls.fromKey++;
      const m = /^ma\.faits:(\d+)x(\d+)$/.exec(key);
      return m ? { axis: 'ma.faits', kind: 'mul', key, A: 3, prompt: `${m[1]} × ${m[2]}`, answer: m[1] * m[2], leitner: true } : null;
    };
  }
  return mod;
}
/* générateur factice générique (clés '<axe>:n') */
function fakeGen(axis) {
  return {
    axis,
    gen(A, rng, opts = {}) {
      const avoid = opts.avoid || new Set();
      let key, n = 0;
      do { key = axis + ':' + rng.int(1, 500); } while (avoid.has(key) && ++n < 80);
      return { axis, kind: 'k', key, A, prompt: 'q', answer: 1, hint: 'h', explain: 'e', leitner: false };
    }
  };
}
/* histoires factices (texte templaté, sans apostrophe) */
const STORY_TEXT = 'Le soleil brille sur la grande écurie de {N}. {P} prend la brosse et le galop commence.';
const fakeStories = {
  axis: 'fr.fluence',
  gen(A) { return { axis: 'fr.fluence', kind: 'story', storyId: 'pomme', key: 'fr.fluence:pomme', A: 2.4, prompt: '', answer: null }; },
  storyById: id => (id === 'pomme' ? { id, text: STORY_TEXT, lvl: 2.4 } : null)
};
function gens(extra = {}) {
  return {
    'ma.faits': fakeFaits(), 'ma.ligne': fakeGen('ma.ligne'), 'ma.procedures': fakeGen('ma.procedures'),
    'fr.conjug': fakeGen('fr.conjug'), 'ma.operations': fakeGen('ma.operations'), 'fr.fluence': fakeStories, ...extra
  };
}

/* store neuf sur un stockage en mémoire, avec un profil CM2 actif */
function setup({ classe = 'CM2', skills = {}, today = D, tweak } = {}) {
  const storage = memoryStorage();
  store.init(storage, today);
  const p = defaultProfile({ id: 'p1', name: 'Léa', g: 'f', classe, today });
  for (const [ax, t] of Object.entries(skills)) p.skills[ax] = { t, n: 4, last: '', trend: 0, src: 'eval' };
  if (tweak) tweak(p);
  store.addProfile(p);
  return { storage, P: () => store.getProfile() };
}
const saved = storage => JSON.parse(storage.getItem('caramel-v3'));
const savedProfile = storage => { const d = saved(storage); return d.profiles[d.active]; };
function play(m, clock, answer = () => ({ correct: true, hinted: false, ms: 1500 })) {
  const out = [];
  for (let item = m.nextItem(), i = 0; item; item = m.nextItem(), i++) {
    clock.step(10000);
    out.push({ item, fb: m.report(item, answer(item, i)) });
  }
  return out;
}

/* ---------- tests ---------- */
test('manche de 10 items : niveau visé, clés distinctes, pommes, persistance, historique, série', () => {
  const { storage, P } = setup({ skills: { 'ma.faits': 2.0 } });
  const clock = fakeClock();
  const G = gens();
  const m = createManche({ gameId: 'tables', axis: 'ma.faits', count: 10, today: D, seed: 7, generators: G, clock });
  assert.equal(m.count, 10); assert.equal(m.hintsLeft, 2); assert.equal(m.mode, 'libre');
  /* le premier item vise b = θ − 0,8 */
  const first = m.nextItem();
  near(G['ma.faits'].calls.A[0], absLevel('CM2', targetB(2.0), D), 1e-12);
  near(first.b, relLevel('CM2', first.A, D), 1e-12);
  near(first.b, 1.2, 1e-9);
  assert.equal(first.assist, false);
  assert.ok(G['ma.faits'].calls.opts[0].avoid instanceof Set);
  clock.step(10000);
  const fb1 = m.report(first, { correct: true, hinted: false, ms: 1500 });
  assert.equal(fb1.r, 1); assert.equal(fb1.correct, true); assert.equal(fb1.apples, 1); assert.equal(fb1.streak, 1);
  assert.equal(fb1.fails, 0); assert.equal(fb1.assistNext, false); assert.equal(fb1.thetaBefore, 2);
  assert.ok(fb1.thetaAfter > 2); assert.equal(fb1.wallet, 1);
  /* persisté aussitôt */
  assert.equal(savedProfile(storage).wallet.apples, 1);
  assert.equal(savedProfile(storage).skills['ma.faits'].n, 5);
  const rest = play(m, clock, (it, i) => ({ correct: true, hinted: false, ms: i === 3 ? 4500 : 1500 }));
  assert.equal(rest.length, 9);
  assert.equal(m.nextItem(), null);                                  /* count atteint */
  const keys = [first, ...rest.map(x => x.item)].map(it => it.key);
  assert.equal(new Set(keys).size, 10);
  assert.equal(rest[3].fb.r, 0.8);                                   /* juste mais lent (> 3 s) */
  assert.deepEqual(m.state, { index: 10, count: 10, reports: 10, correct: 10, clean: 10, hinted: 0, apples: 10, startedAt: T0 });
  clock.step(5000);
  const s = m.finish();
  assert.equal(s.n, 10); assert.equal(s.correct, 10); assert.equal(s.clean, 10); assert.equal(s.hinted, 0);
  assert.equal(s.apples, 10); assert.equal(s.streakBonus, 10); assert.equal(s.streakCount, 1);
  assert.equal(s.thetaBefore, 2); assert.ok(s.thetaAfter > 2);
  assert.equal(s.ms, 100000); assert.equal(s.dayDone, false); assert.equal(s.aborted, false);
  assert.equal(s.gameId, 'tables'); assert.equal(s.axis, 'ma.faits');
  const p = P();
  assert.equal(p.wallet.apples, 20);                                 /* 10 bonnes réponses + 10 de série */
  assert.deepEqual(p.streak.last, D); assert.equal(p.streak.count, 1);
  assert.equal(p.history.length, 1);
  assert.deepEqual(p.history[0], { d: D, t: T0 + 105000, g: 'tables', ax: 'ma.faits', n: 10, ok: 10, hint: 0, ms: 100000,
    th: Math.round(s.thetaAfter * 100) / 100, mode: 'libre' });
  assert.equal(p.stats.sessions, 1); assert.equal(p.stats.items, 10);
  near(p.stats.minutes, 1.67, 1e-9); near(p.companion.minutes, 1.67, 1e-9);
  assert.equal(Object.keys(p.leitner).length, 10);
  assert.ok(Object.values(p.leitner).every(e => e.b === 2));       /* justes du premier coup */
  assert.ok(p.snapshots.some(x => x.w === weekKey(D)));
  assert.deepEqual(savedProfile(storage).history, p.history);       /* fin persistée */
  /* finish est idempotent ; plus rien n'est accepté ensuite */
  assert.equal(m.finish(), s);
  assert.equal(m.nextItem(), null);
  assert.equal(m.report(first, { correct: true }).ignored, true);
  assert.equal(P().wallet.apples, 20);
});

test('série : bonus à la première manche terminée du jour seulement', () => {
  const { P } = setup();
  const clock = fakeClock();
  const run = today => {
    const m = createManche({ gameId: 'tables', count: 2, today, seed: today, generators: gens(), clock });
    play(m, clock);
    return m.finish();
  };
  assert.equal(run(D).streakBonus, 10);
  assert.equal(run(D).streakBonus, 0);
  const s3 = run(addDays(D, 1));
  assert.equal(s3.streakBonus, 10); assert.equal(s3.streakCount, 2);
  assert.equal(P().streak.count, 2);
  assert.equal(P().stats.sessions, 3);
});

test('filet de sécurité : 2 échecs → plus facile et aidé ; 4 réussites → plus dur ; bornes', () => {
  setup({ skills: { 'ma.faits': 2.0 } });
  const clock = fakeClock();
  const G = gens({ 'ma.faits': fakeFaits({ withFromKey: false }) });
  const m = createManche({ gameId: 'tables', count: 40, today: D, seed: 3, generators: G, clock });
  const A = () => G['ma.faits'].calls.A[G['ma.faits'].calls.A.length - 1];
  const thetaNow = () => skillOf(store.getProfile(), 'ma.faits').t;
  let it = m.nextItem();
  let fb = m.report(it, { correct: false, hinted: true, tries: 2 });
  assert.equal(fb.r, 0); assert.equal(fb.fails, 1); assert.equal(fb.assistNext, false); assert.equal(m.adj, 0);
  it = m.nextItem(); assert.equal(it.assist, false);
  fb = m.report(it, { correct: true, hinted: true, tries: 2 });         /* juste au 2e essai : r = 0,6 = échec */
  assert.equal(fb.r, 0.6); assert.equal(fb.fails, 2); assert.equal(fb.assistNext, true); assert.equal(m.adj, -0.5);
  it = m.nextItem();
  assert.equal(it.assist, true);                                         /* indice d'emblée */
  near(A(), absLevel('CM2', targetB(thetaNow(), -0.5), D), 1e-12);      /* b − 0,5 */
  fb = m.report(it, { correct: true, hinted: false, ms: 1000 });         /* aidé : compte comme aidé */
  assert.equal(fb.r, 0.6); assert.equal(fb.hinted, true); assert.equal(fb.fails, 3); assert.equal(fb.assistNext, false);
  assert.equal(store.getProfile().leitner[it.key].b, 1);                /* Leitner : pas « juste » */
  it = m.nextItem(); assert.equal(it.assist, false);
  /* 4 réussites de suite → + 0,3 */
  for (let i = 0; i < 4; i++) {
    fb = m.report(it, { correct: true, hinted: false, ms: 1000 });
    assert.equal(fb.streak, i + 1);
    it = m.nextItem();
  }
  near(m.adj, -0.2, 1e-12);
  /* que des échecs : jamais 3 erreurs d'affilée sans aide, adj plafonné à −1,5 */
  let unaided = 0;
  for (let i = 0; i < 12; i++) {
    unaided = it.assist ? 0 : unaided + 1;
    assert.ok(unaided <= 2, 'trois erreurs de suite sans aide');
    m.report(it, { correct: false, hinted: true, tries: 2 });
    it = m.nextItem();
  }
  assert.equal(m.adj, -1.5);
  /* juste sur un item aidé : r = 0,6, la série d'échecs continue */
  if (!it.assist) { m.report(it, { correct: false, hinted: true, tries: 2 }); it = m.nextItem(); }
  assert.equal(it.assist, true);
  assert.equal(m.report(it, { correct: true, hinted: false, ms: 900 }).r, 0.6);
  /* que des réussites : + 0,3 toutes les 4, plafonné à 0,9 */
  const up = createManche({ gameId: 'tables', count: 20, today: D, seed: 4, generators: G, clock });
  const adjs = [];
  for (let x = up.nextItem(); x; x = up.nextItem()) { up.report(x, { correct: true, hinted: false, ms: 900 }); adjs.push(up.adj); }
  assert.deepEqual(adjs.slice(0, 13).map(v => Math.round(v * 10) / 10), [0, 0, 0, 0.3, 0.3, 0.3, 0.3, 0.6, 0.6, 0.6, 0.6, 0.9, 0.9]);
  assert.equal(up.adj, 0.9);
});

test('jokers : 2 par manche, l’item compte comme aidé, pas de double paiement', () => {
  const { P } = setup();
  const clock = fakeClock();
  const m = createManche({ gameId: 'tables', count: 4, today: D, seed: 11, generators: gens(), clock });
  assert.equal(m.hintsLeft, 2);
  let it = m.nextItem();
  assert.equal(m.useHint(), true); assert.equal(m.hintsLeft, 1);
  assert.equal(m.useHint(), true); assert.equal(m.hintsLeft, 1);       /* même item : déjà payé */
  let fb = m.report(it, { correct: true, hinted: false, ms: 900 });
  assert.equal(fb.r, 0.6); assert.equal(fb.hinted, true); assert.equal(fb.apples, 1);
  assert.equal(P().leitner[it.key].b, 1);
  it = m.nextItem();
  assert.equal(m.report(it, { correct: true, hinted: false, ms: 900 }).r, 1);   /* sans joker */
  it = m.nextItem();
  assert.equal(m.useHint(it), true); assert.equal(m.hintsLeft, 0);
  assert.equal(m.report(it, { correct: true, hinted: false, ms: 900 }).r, 0.6);
  it = m.nextItem();
  assert.equal(it.assist, false);
  assert.equal(m.useHint(), false); assert.equal(m.hintsLeft, 0);               /* plus de joker */
  fb = m.report(it, { correct: true, hinted: false, ms: 900 });
  assert.equal(fb.r, 1);
  assert.deepEqual([m.state.correct, m.state.clean, m.state.hinted], [4, 2, 2]);
  /* joker sur un item construit hors moteur (question de compréhension) */
  const q = { axis: 'fr.comp_ecrit', key: 'fr.comp_ecrit:pomme', A: 4.1, prompt: '?', answer: 0 };
  const m2 = createManche({ gameId: 'course', count: 1, today: D, seed: 2, generators: gens(), clock });
  assert.equal(m2.useHint(q), true);
  assert.equal(m2.report(q, { correct: true, hinted: false }).r, 0.6);
  /* sans item en cours (ctx.hints.use() pendant un item du jeu) : le joker est dépensé,
     le jeu rapporte alors hinted: true (contrat §7.3, étape 6) */
  const m3 = createManche({ gameId: 'course', count: 1, today: D, seed: 3, generators: gens(), clock });
  assert.equal(m3.useHint(), true); assert.equal(m3.hintsLeft, 1);
  assert.equal(m3.report(q, { correct: true, hinted: true }).r, 0.6);
});

test('pommes : +1 par bonne réponse (même aidée), jamais de perte', () => {
  const { P } = setup();
  const clock = fakeClock();
  const m = createManche({ gameId: 'pommes', count: 6, today: D, seed: 5, generators: gens(), clock });
  const pattern = [
    { correct: true, hinted: false }, { correct: false, hinted: true, tries: 2 }, { correct: true, hinted: true, tries: 2 },
    { correct: false, hinted: true, tries: 2 }, { correct: true, hinted: false }, { correct: true, hinted: false }
  ];
  const res = play(m, clock, (it, i) => ({ ...pattern[i], ms: 2000 }));
  assert.deepEqual(res.map(x => x.fb.apples), [1, 0, 1, 0, 1, 1]);
  let last = 0;
  for (const { fb } of res) { assert.ok(fb.wallet >= last); last = fb.wallet; }
  assert.equal(P().wallet.apples, 4);
  const s = m.finish();
  assert.equal(s.apples, 4);
  assert.equal(P().wallet.apples, 4 + s.streakBonus);
});

test('Leitner : clés dues rejouées (fromKey), dans l’ordre, sans doublon, puis mises à jour', () => {
  const { P } = setup({ tweak: p => {
    p.leitner['ma.faits:7x8'] = { b: 1, due: '2026-09-28', seen: 3, ok: 1, last: '2026-09-27' };
    p.leitner['ma.faits:6x9'] = { b: 2, due: '2026-09-30', seen: 2, ok: 1, last: '2026-09-28' };
    p.leitner['ma.faits:4x6'] = { b: 1, due: '2026-10-01', seen: 1, ok: 0, last: '2026-09-30' };
    p.leitner['ma.faits:3x7'] = { b: 3, due: '2026-10-09', seen: 4, ok: 4, last: '2026-10-01' };   /* pas due */
  } });
  const clock = fakeClock();
  const G = gens();
  const m = createManche({ gameId: 'tables', count: 12, today: D, seed: 1, generators: G, clock });
  const served = play(m, clock).map(x => x.item);
  const fromL = served.filter(it => it.fromLeitner).map(it => it.key);
  assert.ok(fromL.length >= 1 && fromL.length <= 3, String(fromL));
  assert.deepEqual(fromL, ['ma.faits:7x8', 'ma.faits:4x6', 'ma.faits:6x9'].slice(0, fromL.length));   /* boîte 1 d'abord */
  for (const it of served.filter(x => x.fromLeitner)) near(it.b, relLevel('CM2', 3, D), 1e-12);
  assert.equal(new Set(served.map(it => it.key)).size, served.length);
  assert.ok(!served.some(it => it.key === 'ma.faits:3x7' && it.fromLeitner));
  const L = P().leitner;
  assert.equal(L['ma.faits:7x8'].b, fromL.includes('ma.faits:7x8') ? 2 : 1);
  if (fromL.includes('ma.faits:7x8')) assert.equal(L['ma.faits:7x8'].due, addDays(D, 2));
});

test('Leitner : probabilité 0,4 en temps normal, 0,7 en bloc de révision', () => {
  const tweak = p => {
    for (let a = 2; a <= 9; a++) for (let b = a; b <= 9; b++) p.leitner[`ma.faits:${a}x${b}`] = { b: 1, due: '2026-10-01', seen: 1, ok: 0, last: '2026-09-30' };
    p.today = { d: D, idx: 0, done: false, rewarded: false, blocks: [
      { kind: 'revision', game: 'tables', axis: 'ma.faits', count: 10, offset: 0, done: false, result: null },
      { kind: 'priorite', game: 'tables', axis: 'ma.faits', count: 10, offset: 0, done: false, result: null }] };
  };
  const { storage } = setup({ tweak });
  const before = storage.getItem('caramel-v3');
  const rate = (mode, blockIdx) => {
    let hits = 0, total = 0;
    for (let s = 0; s < 60; s++) {
      const m = createManche({ gameId: 'tables', mode, blockIdx, count: 10, today: D, seed: 'r' + s, generators: gens() });
      for (let it = m.nextItem(); it; it = m.nextItem()) { total++; if (it.fromLeitner) hits++; }
      assert.equal(m.abort(), null);
    }
    return hits / total;
  };
  /* 36 clés dues : la part de révision monte avec l'arriéré (0,4 + dues/50, plafonnée à 0,8) */
  const libre = rate('libre', null), revision = rate('balade', 0), priorite = rate('balade', 1);
  assert.ok(Math.abs(libre - 0.8) < 0.08, 'libre ' + libre);
  assert.ok(Math.abs(revision - 0.8) < 0.08, 'révision ' + revision);
  assert.ok(Math.abs(priorite - 0.8) < 0.08, 'priorité ' + priorite);
  assert.equal(storage.getItem('caramel-v3'), before);               /* items servis sans rapport : aucune trace */
});

test('item servi = copie : un item figé du générateur n’est jamais modifié', () => {
  setup();
  const frozen = Object.freeze({ axis: 'ma.ligne', kind: 'lire', key: 'ma.ligne:fixe', A: 3, prompt: 'q', answer: 1 });
  const m = createManche({ gameId: 'cloture', count: 2, today: D, seed: 1, generators: { 'ma.ligne': { gen: () => frozen } } });
  const it = m.nextItem();
  assert.notEqual(it, frozen);
  assert.equal(it.key, 'ma.ligne:fixe'); assert.equal(it.assist, false);
  near(it.b, relLevel('CM2', 3, D), 1e-12);
  assert.equal(frozen.b, undefined);
  assert.equal(m.report(it, { correct: true, hinted: false }).r, 1);
});

test('item.b suit le niveau réel de l’item ; générateur manquant signalé', () => {
  setup({ skills: { 'ma.faits': 1.5 } });
  const G = gens({ 'ma.faits': fakeFaits({ shiftA: 0.5 }) });
  const m = createManche({ gameId: 'tables', count: 3, today: D, seed: 9, generators: G });
  const it = m.nextItem();
  near(it.A, absLevel('CM2', targetB(1.5), D) + 0.5, 1e-12);
  near(it.b, relLevel('CM2', it.A, D), 1e-12);
  near(it.b, targetB(1.5) + 0.5, 1e-9);
  assert.throws(() => m.nextItem('fr.vocab'), /Générateur non chargé/);
  /* axe secondaire injecté : l'item porte son axe et met à jour son propre θ */
  const m2 = createManche({ gameId: 'course', count: 2, today: D, seed: 9, generators: { ...gens(), 'fr.comp_ecrit': fakeGen('fr.comp_ecrit') } });
  const q = m2.nextItem('fr.comp_ecrit');
  assert.equal(q.axis, 'fr.comp_ecrit');
  m2.report(q, { correct: true, hinted: false });
  assert.equal(store.getProfile().skills['fr.comp_ecrit'].n, 1);
});

test('balade : défauts du bloc, blocs validés, +10 🍎 de fin de balade une seule fois', () => {
  const skills = { 'fr.fluence': 1.0, 'ma.ligne': 0.7, 'ma.faits': 2.4, 'ma.procedures': 1.9, 'fr.conjug': 1.6, 'ma.operations': 2.0 };
  const { P, storage } = setup({ skills });
  store.mutateProfile(p => ensureToday(p, D));
  const plan = P().today;
  assert.deepEqual(plan.blocks.map(b => b.game), ['tables', 'course', 'cloture', null]);
  const clock = fakeClock();
  /* bloc 1 : échauffement (count, offset et axe repris du bloc) */
  const m1 = createManche({ gameId: 'tables', mode: 'balade', blockIdx: 0, today: D, seed: 1, generators: gens(), clock });
  assert.equal(m1.kind, 'echauffement'); assert.equal(m1.count, Math.ceil(0.7 * mancheSize('tables', 15)));
  assert.equal(m1.offset, -0.6); assert.equal(m1.axis, 'ma.faits');
  const G1 = gens();
  const m1b = createManche({ gameId: 'tables', mode: 'balade', blockIdx: 0, today: D, seed: 1, generators: G1, clock });
  m1b.nextItem();
  near(G1['ma.faits'].calls.A[0], absLevel('CM2', targetB(2.4, -0.6), D), 1e-12);
  m1b.abort();
  assert.equal(play(m1, clock).length, 7);
  const s1 = m1.finish();
  assert.equal(s1.dayDone, false); assert.equal(s1.streakBonus, 10);
  let day = P().today;
  assert.equal(day.blocks[0].done, true); assert.equal(day.idx, 1);
  assert.deepEqual(day.blocks[0].result, { g: 'tables', ax: 'ma.faits', n: 7, ok: 7, hint: 0, ms: 70000 });
  assert.equal(savedProfile(storage).today.blocks[0].done, true);
  /* bloc 2 : la course */
  const m2 = createManche({ gameId: 'course', mode: 'balade', blockIdx: 1, today: D, seed: 2, generators: gens(), clock });
  assert.equal(m2.count, 2);                                       /* lecture prioritaire : 2 histoires */
  const story = m2.nextItem();
  assert.equal(story.storyId, 'pomme');
  clock.step(90000);
  m2.report(story, { kind: 'race', storyId: 'pomme', mclm: 110, precision: 94, stars: 3, beatZip: true, ms: 85000, missed: [], textA: story.A, zip: 100 });
  const s2 = m2.finish({ skipSummary: true });
  assert.deepEqual(s2.extra, { skipSummary: true });
  assert.equal(s2.streakBonus, 0); assert.equal(P().today.idx, 2);
  /* bloc 3 abandonné : rien n'est validé */
  const m3a = createManche({ gameId: 'cloture', mode: 'balade', blockIdx: 2, today: D, seed: 3, generators: gens(), clock });
  const it = m3a.nextItem(); clock.step(); m3a.report(it, { correct: true, hinted: false });
  const ab = m3a.abort();
  assert.equal(ab.aborted, true); assert.equal(ab.dayDone, false);
  assert.equal(P().today.blocks[2].done, false); assert.equal(P().today.idx, 2);
  /* bloc 3 rejoué en entier */
  const m3 = createManche({ gameId: 'cloture', mode: 'balade', blockIdx: 2, today: D, seed: 4, generators: gens(), clock });
  assert.equal(m3.count, mancheSize('cloture', 15)); assert.equal(m3.kind, 'revision');
  play(m3, clock);
  assert.equal(m3.finish().dayDone, false);
  /* bloc 4 : jeu libre au choix (pommes) → balade terminée */
  const m4 = createManche({ gameId: 'pommes', mode: 'balade', blockIdx: 3, today: D, seed: 5, generators: gens(), clock });
  assert.equal(m4.count, mancheSize('pommes', 15));
  play(m4, clock);
  const applesBefore = P().wallet.apples;
  const s4 = m4.finish();
  assert.equal(s4.dayDone, true); assert.equal(s4.dayBonus, 10);
  assert.equal(P().wallet.apples, applesBefore + 10);
  day = P().today;
  assert.equal(day.done, true); assert.equal(day.rewarded, true); assert.equal(day.idx, 4);
  assert.equal(day.blocks[3].result.g, 'pommes');
  /* rejouer un bloc après coup : ni bonus, ni « balade finie » à nouveau */
  const m5 = createManche({ gameId: 'tables', mode: 'balade', blockIdx: 0, today: D, seed: 6, generators: gens(), clock });
  play(m5, clock);
  const s5 = m5.finish();
  assert.equal(s5.dayBonus, 0); assert.equal(s5.dayDone, false);
  /* plan d'un autre jour : la manche ne touche pas au plan */
  const m6 = createManche({ gameId: 'tables', mode: 'balade', blockIdx: 0, today: addDays(D, 1), seed: 7, generators: gens(), clock });
  assert.equal(m6.kind, null);
  play(m6, clock);
  assert.equal(m6.finish().dayDone, false);
  assert.equal(P().today.d, D);
  /* mode libre : jamais de bloc validé */
  assert.equal(createManche({ gameId: 'tables', mode: 'libre', blockIdx: 0, today: D, generators: gens() }).blockIdx, null);
  /* paramètres lus dans l'URL (chaînes) */
  const mq = createManche({ gameId: 'tables', mode: 'balade', blockIdx: '0', count: '3', offset: '-0.6', today: D, generators: gens() });
  assert.equal(mq.blockIdx, 0); assert.equal(mq.count, 3); assert.equal(mq.offset, -0.6); assert.equal(mq.kind, 'echauffement');
});

test('rapport de course : ⭐ max, ⭐ × 10 🍎, MCLM, fluence, mots ratés et relus', () => {
  const { P, storage } = setup({ skills: { 'fr.fluence': 1.0 }, tweak: p => {
    p.wallet.stars.pomme = 1;
    p.leitner['fr.fluence:soleil'] = { b: 2, due: '2026-10-01', seen: 2, ok: 1, last: '2026-09-29' };
    p.leitner['fr.fluence:nuage'] = { b: 1, due: '2026-10-01', seen: 1, ok: 0, last: '2026-09-30' };
  } });
  const clock = fakeClock();
  const m = createManche({ gameId: 'course', count: 1, today: D, seed: 1, generators: gens(), clock });
  const story = m.nextItem();
  clock.step(120000);
  const fb = m.report(story, { kind: 'race', storyId: 'pomme', mclm: 96.4, precision: 91.6, stars: 2, beatZip: false,
    ms: 110000, missed: ['ecurie', 'galop', 'les', 'écurie', '', 'zebre'], textA: 4.1, zip: 88.2 });
  assert.equal(fb.stars, 2); assert.equal(fb.best, 2); assert.equal(fb.newBest, true);
  assert.equal(fb.apples, 20); assert.equal(fb.correct, true); assert.equal(fb.r, null);
  assert.equal(fb.thetaBefore, 1); assert.ok(fb.thetaAfter > 1); assert.ok(fb.obs > 1);
  let p = P();
  assert.equal(p.wallet.stars.pomme, 2); assert.equal(p.wallet.apples, 20);
  assert.deepEqual(p.mclm, [{ d: D, t: T0 + 120000, s: 'pomme', v: 96, p: 92, z: 88 }]);
  assert.equal(p.skills['fr.fluence'].n, 5);
  assert.equal(p.leitner['fr.fluence:ecurie'].b, 1);
  assert.equal(p.leitner['fr.fluence:ecurie'].w, 'écurie');          /* forme affichable tirée du texte */
  assert.equal(p.leitner['fr.fluence:galop'].b, 1);
  assert.equal(p.leitner['fr.fluence:galop'].w, 'galop');
  assert.equal(p.leitner['fr.fluence:zebre'].b, 1);                  /* hors texte : pas de forme connue */
  assert.equal(p.leitner['fr.fluence:zebre'].w, undefined);
  assert.equal(p.leitner['fr.fluence:les'], undefined);              /* mot-outil ignoré */
  assert.equal(p.leitner['fr.fluence:soleil'].b, 3);                 /* déjà suivi, bien lu → boîte suivante */
  assert.equal(p.leitner['fr.fluence:nuage'].b, 1);                  /* absent du texte : inchangé */
  assert.equal(p.leitner['fr.fluence:lea'], undefined);              /* {P} rempli, pas de nouvelle clé */
  assert.equal(savedProfile(storage).wallet.stars.pomme, 2);
  /* question de compréhension (axe secondaire, item construit par le jeu) */
  const q = { axis: 'fr.comp_ecrit', key: 'fr.comp_ecrit:pomme', A: 4.1, b: 2, prompt: '?', answer: 1 };
  const fq = m.report(q, { correct: true, hinted: false, tries: 1 });
  assert.equal(fq.r, 1); assert.equal(fq.apples, 1);
  assert.equal(P().skills['fr.comp_ecrit'].n, 1);
  const s = m.finish({ skipSummary: true });
  assert.equal(s.n, 2); assert.equal(s.correct, 2); assert.equal(s.apples, 21);
  assert.equal(s.race.storyId, 'pomme'); assert.equal(s.race.stars, 2); assert.equal(s.race.newBest, true);
  p = P();
  const h = p.history[p.history.length - 1];
  assert.equal(h.g, 'course'); assert.equal(h.ax, 'fr.fluence'); assert.equal(h.n, 2);
  near(h.th, Math.round(p.skills['fr.fluence'].t * 100) / 100, 1e-12);
  /* course moins réussie : aucune ⭐ perdue, mots relus promus */
  const m2 = createManche({ gameId: 'course', count: 1, today: D, seed: 2, generators: gens(), clock });
  const st2 = m2.nextItem();
  clock.step(100000);
  const fb2 = m2.report(st2, { kind: 'race', storyId: 'pomme', mclm: 70, precision: 70, stars: 1, beatZip: false,
    ms: 95000, missed: ['galop'], textA: 2.4, zip: 90 });
  assert.equal(fb2.best, 2); assert.equal(fb2.newBest, false); assert.equal(fb2.apples, 10);
  p = P();
  assert.equal(p.wallet.stars.pomme, 2);
  assert.equal(p.leitner['fr.fluence:galop'].b, 1); assert.equal(p.leitner['fr.fluence:galop'].seen, 2);
  assert.equal(p.leitner['fr.fluence:ecurie'].b, 1);              /* relu le jour même : pas de promotion (D2-06) */
  assert.equal(p.leitner['fr.fluence:ecurie'].w, 'écurie');          /* conservée après révision */
  assert.equal(p.mclm.length, 2);
  /* liste explicite des mots lus (extension) et micro muet (MCLM nul : rien n'est mesuré) */
  const m3 = createManche({ gameId: 'course', count: 1, today: D, seed: 3, generators: gens(), clock });
  const st3 = m3.nextItem();
  const tBefore = P().skills['fr.fluence'].t;
  m3.report(st3, { kind: 'race', storyId: 'pomme', mclm: 0, precision: 0, stars: 1, missed: [], read: ['galop'], zip: 90 });
  p = P();
  assert.equal(p.mclm.length, 2); assert.equal(p.skills['fr.fluence'].t, tBefore);
  assert.equal(p.leitner['fr.fluence:galop'].b, 1);               /* relu le jour même : pas de promotion (D2-06) */
  assert.equal(p.leitner['fr.fluence:galop'].seen, 3);
  assert.equal(p.leitner['fr.fluence:ecurie'].b, 1);              /* pas dans read : inchangé */
});

test('manche sans aucun rapport : aucune trace', () => {
  const { storage, P } = setup();
  store.mutateProfile(p => ensureToday(p, D));
  const before = storage.getItem('caramel-v3');
  const snap = JSON.stringify(P());
  const m = createManche({ gameId: 'tables', mode: 'balade', blockIdx: 0, today: D, seed: 1, generators: gens() });
  m.nextItem(); m.nextItem(); m.useHint();
  const s = m.finish();
  assert.equal(s.n, 0); assert.equal(s.streakBonus, 0); assert.equal(s.dayDone, false);
  assert.equal(storage.getItem('caramel-v3'), before);
  assert.equal(JSON.stringify(P()), snap);
  const m2 = createManche({ gameId: 'pommes', today: D, generators: gens() });
  m2.nextItem();
  assert.equal(m2.abort(), null);
  assert.equal(storage.getItem('caramel-v3'), before);
});

test('abandon : progrès gardés, ni série ni bloc ; rapports tardifs ignorés', () => {
  const { P } = setup();
  const clock = fakeClock();
  const m = createManche({ gameId: 'tables', count: 10, today: D, seed: 4, generators: gens(), clock });
  const items = [m.nextItem(), m.nextItem(), m.nextItem()];
  for (const it of items) { clock.step(5000); m.report(it, { correct: true, hinted: false, ms: 1000 }); }
  const late = m.nextItem();
  const s = m.abort();
  assert.equal(s.aborted, true); assert.equal(s.n, 3); assert.equal(s.streakBonus, 0); assert.equal(s.ms, 15000);
  const p = P();
  assert.equal(p.wallet.apples, 3);
  assert.equal(p.streak.count, 0);
  assert.equal(p.stats.sessions, 0); assert.equal(p.stats.items, 3);
  assert.equal(p.history.length, 1); assert.equal(p.history[0].n, 3);
  const fb = m.report(late, { correct: true, hinted: false });
  assert.equal(fb.ignored, true); assert.equal(fb.apples, 0);
  assert.equal(P().wallet.apples, 3);
  assert.equal(m.nextItem(), null);
  assert.equal(m.useHint(), false);
  assert.equal(m.abort(), s);
});

test('double rapport du même item : sans effet', () => {
  const { P } = setup();
  const m = createManche({ gameId: 'tables', count: 3, today: D, seed: 8, generators: gens() });
  const it = m.nextItem();
  const a = m.report(it, { correct: true, hinted: false, ms: 1000 });
  const b = m.report(it, { correct: true, hinted: false, ms: 1000 });
  assert.equal(a, b);
  assert.equal(m.state.reports, 1);
  assert.equal(P().wallet.apples, 1);
  assert.equal(P().skills['ma.faits'].n, 1);
});

test('temps d’apprentissage plafonné et tendance sur cinq manches', () => {
  const { P } = setup({ skills: { 'ma.procedures': 1.2 } });
  const clock = fakeClock();
  const m = createManche({ gameId: 'pommes', count: 3, today: D, seed: 1, generators: gens(), clock });
  const it1 = m.nextItem(); clock.step(8000); m.report(it1, { correct: true, hinted: false, ms: 3000 });
  const it2 = m.nextItem(); clock.step(3600000); m.report(it2, { correct: true, hinted: false, ms: 3000 });   /* appli oubliée 1 h */
  const it3 = m.nextItem(); clock.step(6000); m.report(it3, { correct: false, hinted: true, tries: 2 });
  assert.equal(m.finish().ms, 8000 + 120000 + 6000);
  const ths = [];
  for (let k = 0; k < 6; k++) {
    const mk = createManche({ gameId: 'pommes', count: 4, today: D, seed: 'k' + k, generators: gens(), clock });
    play(mk, clock, (it, i) => ({ correct: (i + k) % 3 !== 0, hinted: false, ms: 2000 }));
    mk.finish();
  }
  const h = P().history.filter(e => e.ax === 'ma.procedures');
  assert.equal(h.length, 7);
  const t = P().skills['ma.procedures'].t;
  near(P().skills['ma.procedures'].trend, Math.round((t - h[1].th) * 1000) / 1000, 1e-12);
});

test('historique plafonné à 500 entrées', () => {
  const { P } = setup({ tweak: p => {
    for (let i = 0; i < 500; i++) p.history.push({ d: '2026-09-01', t: i, g: 'tables', ax: 'ma.faits', n: 10, ok: 8, hint: 0, ms: 1, th: 1.5, mode: 'libre' });
  } });
  const m = createManche({ gameId: 'pommes', count: 1, today: D, seed: 1, generators: gens() });
  m.report(m.nextItem(), { correct: true, hinted: false });
  m.finish();
  const h = P().history;
  assert.equal(h.length, 500);
  assert.equal(h[0].t, 1);
  assert.equal(h[499].g, 'pommes');
});

/* ---------- défi en famille : manche liée à un profil donné (option profileId) ---------- */
function setupFamily() {
  const storage = memoryStorage();
  store.init(storage, D);
  const a = defaultProfile({ id: 'p1', name: 'Léa', g: 'f', classe: 'CM2', today: D });
  a.skills['ma.faits'] = { t: 2.0, n: 4, last: '', trend: 0, src: 'eval' };
  const b = defaultProfile({ id: 'p2', name: 'Tom', g: 'm', classe: 'CE1', today: D });
  b.skills['ma.faits'] = { t: 1.0, n: 4, last: '', trend: 0, src: 'eval' };
  store.addProfile(a);
  store.addProfile(b);
  store.setActive('p1');
  return { storage, get: id => store.getProfile(id) };
}

test('profileId : la manche lit et écrit le profil demandé, pas le profil actif', () => {
  const { storage, get } = setupFamily();
  const clock = fakeClock();
  const G = gens();
  const m = createManche({ gameId: 'battle', axis: 'ma.faits', count: 3, mode: 'battle', profileId: 'p2', today: D, seed: 5, generators: G, clock });
  assert.equal(m.profileId, 'p2'); assert.equal(m.mode, 'battle'); assert.equal(m.count, 3);
  const it = m.nextItem();
  /* niveau visé = celui de Tom (CE1, θ = 1), pas celui de Léa (CM2, θ = 2) */
  near(G['ma.faits'].calls.A[0], absLevel('CE1', targetB(1.0), D), 1e-12);
  near(it.b, relLevel('CE1', it.A, D), 1e-12);
  clock.step(4000);
  m.report(it, { correct: true, hinted: false, ms: 1500, tries: 1 });
  /* le profil actif change pendant la manche (un autre enfant joue son tour) : rien ne bouge */
  store.setActive('p2'); store.setActive('p1');
  const it2 = m.nextItem(); clock.step(4000); m.report(it2, { correct: false, hinted: false, ms: 6000, tries: 1 });
  const it3 = m.nextItem(); clock.step(4000); m.report(it3, { correct: true, hinted: false, ms: 2000, tries: 1 });
  assert.equal(m.nextItem(), null);
  const s = m.finish();
  assert.equal(s.n, 3); assert.equal(s.correct, 2); assert.equal(s.gameId, 'battle'); assert.equal(s.axis, 'ma.faits');
  const tom = get('p2'), lea = get('p1');
  assert.equal(tom.wallet.apples, 2 + 10);                          /* 2 bonnes réponses + bonus de série du jour */
  assert.equal(tom.history.length, 1);
  assert.equal(tom.history[0].mode, 'battle'); assert.equal(tom.history[0].g, 'battle'); assert.equal(tom.history[0].n, 3);
  assert.equal(tom.skills['ma.faits'].n, 7);
  assert.equal(tom.streak.count, 1);
  /* Léa n'a rien reçu */
  assert.equal(lea.wallet.apples, 0); assert.equal(lea.history.length, 0); assert.equal(lea.skills['ma.faits'].n, 4);
  assert.equal(lea.stats.items, 0); assert.ok(!lea.stats.week, 'aucun compteur de semaine pour Léa');
  assert.equal(store.getData().active, 'p1');
  assert.equal(JSON.parse(storage.getItem('caramel-v3')).profiles.p2.history.length, 1);
});

test('profileId : rétrocompatible (défaut = profil actif) ; profil inconnu → erreur claire', () => {
  setupFamily();
  const m = createManche({ gameId: 'tables', count: 2, today: D, seed: 1, generators: gens() });
  assert.equal(m.profileId, 'p1');
  const m2 = createManche({ gameId: 'tables', count: 2, today: D, seed: 1, generators: gens(), profileId: null });
  assert.equal(m2.profileId, 'p1');
  assert.throws(() => createManche({ gameId: 'tables', count: 2, today: D, generators: gens(), profileId: 'p9' }), /p9/);
});

test('deux manches entrelacées sur deux profils (tour par tour) : chacune garde ses comptes', () => {
  const { get } = setupFamily();
  const clock = fakeClock();
  const mA = createManche({ gameId: 'battle', axis: 'ma.faits', count: 3, mode: 'battle', profileId: 'p1', today: D, seed: 'a', generators: gens(), clock });
  const mB = createManche({ gameId: 'battle', axis: 'ma.faits', count: 3, mode: 'battle', profileId: 'p2', today: D, seed: 'b', generators: gens(), clock });
  for (let r = 0; r < 3; r++) {
    clock.step(3000); mA.report(mA.nextItem(), { correct: true, hinted: false, ms: 1000, tries: 1 });
    clock.step(3000); mB.report(mB.nextItem(), { correct: r !== 1, hinted: false, ms: 1000, tries: 1 });
  }
  const sA = mA.finish(), sB = mB.abort();
  assert.equal(sA.correct, 3); assert.equal(sA.aborted, false);
  assert.equal(sB.correct, 2); assert.equal(sB.aborted, true);
  assert.equal(get('p1').wallet.apples, 3 + 10);
  assert.equal(get('p2').wallet.apples, 2);                          /* abandon : ni série ni bonus, progrès gardés */
  assert.equal(get('p2').streak.count, 0);
  assert.equal(get('p2').history.length, 1);
});

test('compteur de la semaine : minutes, items et pommes gagnées ; nouvelle semaine → zéro', () => {
  const { P } = setup();
  const clock = fakeClock();
  const m = createManche({ gameId: 'tables', count: 3, today: D, seed: 2, generators: gens(), clock });
  play(m, clock, (it, i) => ({ correct: i !== 1, hinted: i === 1, tries: i === 1 ? 2 : 1, ms: 1500 }));
  m.finish();
  const w = P().stats.week;
  assert.equal(w.w, weekKey(D));
  assert.equal(w.items, 3);
  near(w.minutes, 0.5, 1e-9);                                        /* 3 × 10 s */
  assert.equal(w.apples, 2 + 10);                                    /* 2 bonnes réponses + série du jour */
  assert.equal(P().wallet.apples, 12);
  /* la semaine suivante repart de zéro (lundi 5 octobre) */
  const next = addDays(D, 3);
  const m2 = createManche({ gameId: 'tables', count: 1, today: next, seed: 3, generators: gens(), clock });
  play(m2, clock);
  m2.finish();
  const w2 = P().stats.week;
  assert.equal(w2.w, weekKey(next)); assert.notEqual(w2.w, w.w);
  assert.equal(w2.items, 1); assert.equal(w2.apples, 1 + 10);
  /* un abandon compte aussi le temps passé (progrès gardés) */
  const m3 = createManche({ gameId: 'tables', count: 4, today: next, seed: 4, generators: gens(), clock });
  clock.step(6000); m3.report(m3.nextItem(), { correct: true, hinted: false, ms: 1000 });
  m3.abort();
  assert.equal(P().stats.week.items, 2);
  assert.equal(P().stats.week.apples, 12);
});

test('compteur de la semaine : première manche de la semaine sans pomme → comptée une seule fois', () => {
  const { P } = setup({ tweak: p => {
    p.history.push({ d: D, t: 1, g: 'tables', ax: 'ma.faits', n: 5, ok: 4, hint: 0, ms: 120000, th: 1.5, mode: 'libre' });
  } });
  const clock = fakeClock();
  const m = createManche({ gameId: 'tables', count: 2, today: D, seed: 9, generators: gens(), clock });
  play(m, clock, () => ({ correct: false, hinted: true, tries: 2, ms: 3000 }));
  m.abort();                                                         /* ni pomme ni série : rien n'a créé le compteur avant */
  const w = P().stats.week;
  assert.equal(w.items, 5 + 2);
  near(w.minutes, 2.33, 1e-9);                                       /* 2 min d'historique + 2 × 10 s */
  assert.equal(w.apples, 0);
  assert.equal(P().history.length, 2);
});
