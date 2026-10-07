/* Calendrier des notions (v2.5, js/content/calendar.js) : échelle, plafond « vu en classe » selon la date et le rythme,
   notions des générateurs, simulation du 7 octobre (mesure de l'étude « progression »), bouton « Pas encore appris »
   et ses limites, réglages du parent, déclarations d'un générateur. */
import { test, assert, memoryStorage } from './_t.mjs';
import * as C from '../js/content/calendar.js';
import * as store from '../js/core/store.js';
import { defaultProfile } from '../js/core/profiles.js';
import { createManche } from '../js/core/manche.js';
import { review } from '../js/core/leitner.js';
import { skillOf, targetB } from '../js/core/adaptive.js';
import { absLevel, expectedLevel } from '../js/core/levels.js';
import { makeRng } from '../js/core/rng.js';
import { planDay } from '../js/core/session.js';
import * as F from '../js/content/maths/faits.js';
import * as P from '../js/content/maths/procedures.js';
import * as O from '../js/content/maths/operations.js';
import * as L from '../js/content/maths/ligne.js';
import * as G from '../js/content/fr/conjug.js';

const DAY = '2026-10-07';
const GENS = { 'ma.faits': F, 'ma.procedures': P, 'ma.operations': O, 'ma.ligne': L, 'fr.conjug': G };
const CLASSES = ['CP', 'CE1', 'CE2', 'CM1', 'CM2'];
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const prof = (classe, extra = {}) => {
  const p = defaultProfile({ id: 'p1', name: 'Léa', classe, today: '2026-09-01' });
  return Object.assign(p, extra);
};
const levelOf = id => (C.notion(id) ? C.notion(id).level : NaN);
for (const g of Object.values(GENS)) C.useGenerator(g);

/* ---------- échelle et plafond ---------- */
test('calendrier : échelle des périodes (atLevel, periodOf)', () => {
  near(C.atLevel('CP-P1'), 0); near(C.atLevel('CE1-P3'), 1.4); near(C.atLevel('CM2-P5'), 4.8); near(C.atLevel('ce2'), 2);
  near(C.atLevel(1.35), 1.35);
  assert.ok(Number.isNaN(C.atLevel('CE3-P1')) && Number.isNaN(C.atLevel('CE1-P6')) && Number.isNaN(C.atLevel(null)));
  assert.deepEqual(C.periodOf(1.4), { classe: 'CE1', period: 3 });
  assert.deepEqual(C.periodOf(4.85), { classe: 'CM2', period: 5 });
  assert.deepEqual(C.periodOf(0), { classe: 'CP', period: 1 });
});

test('calendrier : plafond « vu en classe » selon la date (révisions de rentrée, délai de 2 semaines, été)', () => {
  const ce2 = prof('CE2');
  near(C.calLevel(ce2, '2026-09-01'), 1.95);                    /* rentrée : révisions du CE1 */
  near(C.calLevel(ce2, '2026-09-15'), 1.997, 1e-3);             /* encore sous le CE2 */
  assert.ok(C.calLevel(ce2, '2026-09-17') >= 2, 'P1 vue ≈ 2 semaines après la rentrée');
  near(C.calLevel(ce2, DAY), 2 + 0.12 - 0.05, 1e-3);            /* 7 octobre : 2,07 */
  near(C.calLevel(ce2, '2027-01-16'), 2.4, 2e-3);               /* P3 vue mi-janvier */
  near(C.calLevel(ce2, '2027-07-15'), 3);                       /* été, même classe : toute l'année, rien de plus */
  near(C.calLevel(prof('CE2', { settings: { rythme: 'avance' } }), DAY), 2.27, 1e-3);
  near(C.calLevel(prof('CE2', { settings: { rythme: 'avance' } }), '2027-07-15'), 3, 1e-9);   /* pas d'avance l'été */
  assert.equal(C.calLevel(prof('CE2', { settings: { rythme: 'libre' } }), DAY), Infinity);
  /* été après le passage dans la classe suivante : révisions de l'année finie, rien de la nouvelle classe */
  const moved = prof('CM1', { classeSince: '2027-07-04' });
  near(C.calLevel(moved, '2027-07-15'), 2.95);
  assert.equal(C.levelDay(moved, '2027-07-15'), '2027-09-01');
  near(expectedLevel(moved.classe, C.levelDay(moved, '2027-07-15')), 3);          /* attendu : début de CM1, pas sa fin */
  assert.equal(C.levelDay(prof('CM1', { classeSince: '2026-09-01' }), '2027-07-15'), '2027-07-15');
  near(C.calLevel(moved, '2027-09-20'), 3 + 0.063 - 0.05, 2e-3);
});

/* ---------- notions des générateurs ---------- */
test('calendrier : chaque item des 5 générateurs porte des notions connues, jamais plus récentes que lui', () => {
  const unknown = new Set(), late = [];
  for (const [ax, g] of Object.entries(GENS)) {
    for (let A = 0; A <= 5.6 + 1e-9; A += 0.1) {
      for (let s = 0; s < (ax === 'fr.conjug' ? 25 : 40); s++) {
        const it = g.gen(A, makeRng(`cal|${ax}|${A.toFixed(1)}|${s}`), { classe: CLASSES[Math.min(4, Math.floor(A))] });
        assert.equal(typeof it.notion, 'string', `${ax} ${it.key} sans notion`);
        const ns = it.notions && it.notions.length ? it.notions : [it.notion];
        assert.equal(ns[0], it.notion, `${ax} ${it.key} : la notion principale vient en premier`);
        for (const n of ns) {
          if (!C.notion(n)) unknown.add(n);
          else if (!n.startsWith(ax + ':')) unknown.add('axe ' + n);
        }
        /* la date du calendrier ne précède jamais le contenu (sauf l'addition posée du CP, jeu dès le CE1) */
        if (C.notion(it.notion) && levelOf(it.notion) > it.A + 1e-6 && it.notion !== 'ma.operations:add.cp') late.push(`${it.notion} ${it.A}`);
      }
    }
  }
  assert.deepEqual([...unknown], []);
  assert.deepEqual(late.slice(0, 5), []);
  /* toutes les familles des notions ont un libellé enfant et adulte */
  for (const n of C.allNotions()) {
    const f = C.family(n.fam);
    assert.ok(f && f.child && f.adult && f.icon, 'famille ' + n.fam);
  }
});

test('calendrier : dates corrigées (décisions du parent) et tables du CE1 selon le livret Éduscol 2025', () => {
  const at = id => C.notion(id).at;
  assert.equal(at('fr.conjug:passe_simple'), 'CM2-P2');
  assert.equal(at('ma.operations:divdec'), 'CM2-P2');
  assert.equal(at('fr.conjug:plus_que_parfait'), 'CM2-P3');
  assert.equal(at('ma.operations:divdec.dec'), 'CM2-P3');
  assert.equal(at('fr.conjug:passe_simple.pers'), 'CM2-P3');
  assert.equal(at('ma.ligne:dec3'), 'CM2-P1');
  assert.equal(at('ma.operations:dec.cm2'), 'CM2-P1');
  assert.deepEqual(['t1', 't2', 't5', 't10', 't3', 't4', 't6', 't7', 't8', 't9'].map(t => at('ma.faits:' + t)),
    ['CE1-P1', 'CE1-P1', 'CE1-P1', 'CE1-P1', 'CE1-P2', 'CE1-P2', 'CE1-P2', 'CE1-P3', 'CE1-P4', 'CE1-P5']);
  assert.deepEqual(['present', 'imparfait', 'futur', 'passe_compose'].map(t => at('fr.conjug:' + t)), ['CE1-P1', 'CE1-P3', 'CE1-P4', 'CE1-P5']);
  /* générateurs alignés : rien avant la date */
  assert.equal(G.LEVELS.tense.imparfait, 1.4);
  for (let s = 0; s < 300; s++) {
    const it = O.gen(4.19, makeRng('dd' + s));
    assert.notEqual(it.kind, 'divdec', 'pas de division décimale avant la P2 du CM2');
    const c = G.gen(4.19, makeRng('ps' + s));
    assert.ok(!['passe_simple', 'plus_que_parfait'].includes(c.data.tense), 'pas de passé simple avant la P2 du CM2');
  }
  assert.equal(F.notionOfKey('ma.faits:7x8'), 'ma.faits:t7');
  assert.equal(F.notionOfKey('ma.faits:2x5'), 'ma.faits:t5');
  assert.equal(G.notionOfKey('fr.conjug:prendre|futur|3p'), 'fr.conjug:futur.irr');
  assert.equal(G.notionOfKey('fr.conjug:chanter|imparfait|1s'), 'fr.conjug:imparfait');
});

/* ---------- simulation du 7 octobre (mesure de l'étude « progression ») ----------
   Étude (scratchpad/sim/notions.mjs) : 400 items par axe, θ = 3 avec adj 0 et + 0,9, part des items dont la notion
   arrive après l'attendu de la date (seuils des générateurs). Avant : jusqu'à 78 % ; au rythme de la classe : 0 %. */
const TABLE_FROM = { 0: 1.2, 1: 1, 2: 1, 5: 1, 10: 1, 3: 1.2, 4: 1.2, 6: 1.2, 7: 1.4, 8: 1.6, 9: 1.8 };
const PROC_FROM = Object.fromEntries('plus1 0|moins1 0|plus2 0.05|moins2 0.05|plus10 0.15|moins10 0.15|plusPetit 0.2|complDiz 0.25|plusDiz 0.3|moinsDiz 0.3|plusPassage 0.45|dizMoins 0.5|plus9 0.55|plus8 2.1|moins9 1.35|moins8 3|deuxNombres 0.6|moitie 0.7|plusCent 1|moinsCent 1|moinsPetit 1.1|moinsPassage 1.4|fois10 1.15|fois100 2.1|fois1000 3.2|distri 1.4|foisDiz 2.2|foisCent 3.1|produitRonds 4.1|fois4 2.4|fois8 2.6|compl100 2.4|fois5 3.3|fois50 4.5|decPlus 3.3|decMoins 3.35|decRetenue 4.2|decFois 3.3|decDiv 3.4|sommeDec 4|doubleDec 4.2|moitieDec 4.3|div4 4.2|div8 4.4|estimation 3.5|parentheses 3.6'
  .split('|').map(x => { const [k, v] = x.split(' '); return [k, Number(v)]; }));
function studyLo(ax, it) {
  if (ax === 'ma.faits') {
    const m = /:(\d+)x(\d+)$/.exec(it.key);
    let lo = { add: 0, c10: 0, double: 0, moitie: 0.1, mul: 1, facteur: 1.5, div: 3, p10: 3 }[it.kind];
    if (m && +m[2] <= 10) lo = Math.max(lo, Math.min(TABLE_FROM[+m[1]], TABLE_FROM[+m[2]]));
    return lo;
  }
  if (ax === 'ma.procedures') return PROC_FROM[it.kind];
  if (ax === 'ma.operations') return { add: 0, sub: 1.5, mul: 2.6, div: 3.2, divdec: 4.2 }[it.kind];
  if (ax === 'ma.ligne') return { entier: 0, fraction: 2.6, decimal: 3.2 }[it.kind];
  return G.LEVELS.tense[it.data.tense] || 0;
}
test('simulation du 7 octobre : 0 % de notion pas encore vue, au rythme de la classe (θ = 3, adj 0 et + 0,9)', () => {
  const lines = [];
  for (const classe of ['CE1', 'CE2', 'CM1', 'CM2']) {
    const p = prof(classe);
    const cal = expectedLevel(classe, DAY), cap = C.calLevel(p, DAY);
    for (const adj of [0, 0.9]) {
      const A = Math.min(absLevel(classe, targetB(3, adj), DAY), cap);
      const out = [];
      for (const [ax, g] of Object.entries(GENS)) {
        let study = 0, strict = 0;
        for (let i = 0; i < 400; i++) {
          const it = g.gen(A, makeRng(ax + i), { classe });
          if (studyLo(ax, it) > cal + 1e-9) study++;
          if ((it.notions || [it.notion]).some(n => levelOf(n) > cap + 1e-9)) strict++;
        }
        out.push(`${ax.split('.')[1]} ${study}/${strict}`);
        assert.equal(study, 0, `${classe} adj ${adj} ${ax} : ${study} items au-delà de l'attendu`);
        assert.equal(strict, 0, `${classe} adj ${adj} ${ax} : ${strict} items au-delà du calendrier`);
      }
      lines.push(`${classe} adj ${adj} A=${A.toFixed(2)} : ${out.join(' · ')}`);
    }
  }
  console.log('    simulation 7/10 (étude / calendrier) : ' + lines.join(' | '));
});

/* ---------- manche : plafond, filtre, Leitner, bouton ---------- */
function setup(classe, { skills = {}, tweak } = {}) {
  store.init(memoryStorage(), DAY);
  const p = defaultProfile({ id: 'p1', name: 'Léa', classe, today: '2026-09-01' });
  for (const [ax, t] of Object.entries(skills)) p.skills[ax] = { t, n: 30, last: '', trend: 0, src: 'eval' };
  if (tweak) tweak(p);
  store.addProfile(p);
  return () => store.getProfile();
}
const play = (m, n, correct = true) => {
  const items = [];
  for (let i = 0; i < n; i++) { const it = m.nextItem(); if (!it) break; items.push(it); m.report(it, { correct, ms: 1500 }); }
  return items;
};

test('manche : plafond appliqué même à θ = 3 et après une série de réussites (12 items × 5 axes × 4 classes)', () => {
  for (const classe of ['CE1', 'CE2', 'CM1', 'CM2']) {
    for (const [ax, g] of Object.entries(GENS)) {
      const P0 = setup(classe, { skills: { [ax]: 3 } });
      const cap = C.calLevel(P0(), DAY);
      const m = createManche({ gameId: 'tables', axis: ax, count: 24, today: DAY, seed: 'sim' + classe + ax, generators: { [ax]: g } });
      for (const it of play(m, 24)) {
        for (const n of it.notions || [it.notion]) assert.ok(levelOf(n) <= cap + 1e-9, `${classe} ${ax} ${it.key} : ${n} après le ${DAY}`);
      }
      assert.ok(m.adj > 0.5, 'le filet de sécurité est bien monté');
    }
  }
});

test('manche : « Selon ses réussites » garde le comportement d’avant (notions des périodes suivantes)', () => {
  const P0 = setup('CE1', { skills: { 'ma.faits': 3 }, tweak: p => { p.settings.rythme = 'libre'; } });
  const m = createManche({ gameId: 'tables', count: 30, today: DAY, seed: 'libre', generators: { 'ma.faits': F } });
  const items = play(m, 30);
  assert.ok(items.some(it => levelOf(it.notion) > C.calLevel(prof('CE1'), DAY)), 'des tables pas encore vues en classe');
  assert.equal(C.calLevel(P0(), DAY), Infinity);
});

test('manche : une clé Leitner pas encore vue en classe reste due, intacte (révisions limitées)', () => {
  const P0 = setup('CE1', { skills: { 'ma.faits': 3 }, tweak: p => {
    review(p, 'ma.faits:7x8', false, '2026-10-01');            /* apprise en avance : table de 7, CE1-P3 */
    review(p, 'ma.faits:2x5', false, '2026-10-01');            /* table de 5, déjà vue */
  } });
  const before = JSON.stringify(P0().leitner['ma.faits:7x8']);
  const m = createManche({ gameId: 'tables', count: 12, today: DAY, seed: 'lt', generators: { 'ma.faits': F } });
  const items = play(m, 12);
  assert.ok(!items.some(it => it.key === 'ma.faits:7x8'), '7 × 8 attend la période 3');
  assert.ok(items.some(it => it.key === 'ma.faits:2x5' && it.fromLeitner), '2 × 5 est bien révisé');
  assert.equal(JSON.stringify(P0().leitner['ma.faits:7x8']), before, 'clé intacte');
  /* la révision du jour ne compte pas la clé en attente */
  const plan = planDay(P0(), DAY);
  assert.ok(plan.blocks.length >= 3);
});

test('bouton : conditions (CP, défi, copain, une fois, notion passée, famille réussie, 3 en attente, 2 de suite)', () => {
  const ce1 = prof('CE1');
  const t2 = F.fromKey('ma.faits:2x7', 1.07, makeRng('x'));       /* table de 2 : CE1-P1 */
  assert.equal(t2.notion, 'ma.faits:t2');
  const ok = C.canPostpone(ce1, t2, DAY, { mode: 'libre' });
  assert.ok(ok.ok && ok.fam === 'ma.faits:t2' && ok.label === 'la table de 2' && ok.until === '2026-11-01', JSON.stringify(ok));
  assert.ok(C.canPostpone(ce1, t2, DAY, { mode: 'balade' }).ok);
  assert.equal(C.canPostpone(prof('CP'), t2, DAY, { mode: 'libre' }).why, 'cp');
  for (const mode of ['battle', 'duel', 'famille', 'copain']) assert.equal(C.canPostpone(ce1, t2, DAY, { mode }).why, 'mode', mode);
  assert.equal(C.canPostpone(ce1, t2, DAY, { mode: 'libre', used: true }).why, 'once');
  assert.equal(C.canPostpone(ce1, t2, DAY, { mode: 'libre', clean: new Set(['ma.faits:t2']) }).why, 'reussie');
  const cpItem = F.fromKey('ma.faits:add:3+4', 1, makeRng('y'));
  assert.equal(C.canPostpone(ce1, cpItem, DAY, { mode: 'libre' }).why, 'passee', 'notion du CP : jamais');
  assert.equal(C.canPostpone(ce1, { axis: 'ma.faits', notion: 'ma.faits:inconnue' }, DAY, {}).why, 'notion');
  /* 3 familles en attente au plus */
  const p3 = prof('CE1');
  for (const k of ['ma.faits:5x5', 'ma.faits:10x10', 'ma.faits:1x1']) C.postpone(p3, F.fromKey(k, 1.07, makeRng(k)), DAY);
  assert.equal(C.activeLater(p3, DAY).length, 3);
  assert.equal(C.canPostpone(p3, t2, DAY, { mode: 'libre' }).why, 'max');
  assert.equal(C.canPostpone(p3, t2, '2026-11-01', { mode: 'libre' }).ok, true, 'revenues le 1er novembre');
  /* deux reports de suite au plus ; un mois sans report remet le compte à zéro */
  const p2 = prof('CE1');
  C.postpone(p2, t2, DAY);
  assert.equal(C.canPostpone(p2, t2, '2026-11-02', { mode: 'libre' }).ok, true);
  const e2 = C.postpone(p2, t2, '2026-11-02');
  assert.equal(e2.n, 2);
  assert.equal(e2.until, '2026-12-01');
  assert.equal(C.canPostpone(p2, t2, '2026-12-02', { mode: 'libre' }).why, 'streak', 'ensuite seul un parent peut');
  assert.equal(C.canPostpone(p2, t2, '2027-01-05', { mode: 'libre' }).ok, true, 'revenue depuis plus de 30 jours');
});

test('bouton : retour le 1er du mois suivant, au moins 14 jours plus tard', () => {
  assert.equal(C.laterUntil('2026-10-07'), '2026-11-01');
  assert.equal(C.laterUntil('2026-10-25'), '2026-11-08');
  assert.equal(C.laterUntil('2026-12-20'), '2027-01-03');
  assert.equal(C.laterUntil('2027-01-01'), '2027-02-01');
});

test('manche : « Pas encore appris » sans effet sur θ, Leitner, 🍎 ; la manche garde sa longueur ; famille écartée ensuite', () => {
  const P0 = setup('CE1', { skills: { 'ma.faits': 3 } });
  const m = createManche({ gameId: 'tables', count: 30, today: DAY, seed: 'later', generators: { 'ma.faits': F } });
  let it = m.nextItem();
  let guard = 0;
  /* les items du CP (années passées) n'ont jamais le bouton : on les réussit */
  while (!m.canLater(it).ok && guard++ < 25) { m.report(it, { correct: true }); it = m.nextItem(); if (!it) break; }
  assert.ok(it && m.canLater(it).ok, 'un item de l’année trouvé');
  const before = { t: skillOf(P0(), 'ma.faits').t, n: skillOf(P0(), 'ma.faits').n, leitner: JSON.stringify(P0().leitner),
    apples: P0().wallet.apples, idx: m.state.index, reports: m.state.reports };
  const res = m.postpone(it);
  assert.ok(res.ok && res.entry && res.entry.until === '2026-11-01', JSON.stringify(res));
  const q = P0();
  assert.equal(skillOf(q, 'ma.faits').t, before.t);
  assert.equal(skillOf(q, 'ma.faits').n, before.n);
  assert.equal(JSON.stringify(q.leitner), before.leitner);
  assert.equal(q.wallet.apples, before.apples);
  assert.equal(m.state.index, before.idx - 1, 'l’item ne compte pas');
  assert.equal(m.state.reports, before.reports);
  assert.equal(m.report(it, { correct: true }).ignored, true, 'item repoussé : un rapport tardif est ignoré');
  assert.ok(q.cal.later[res.fam], 'report enregistré');
  assert.equal(m.canLater(it).ok, false);
  assert.equal(m.postpone(it).ok, false, 'une fois par manche');
  /* la suite : jamais la famille repoussée (pour les notions de l'année) */
  const rest = [];
  for (let i = 0; i < 40; i++) { const x = m.nextItem(); if (!x) break; rest.push(x); m.report(x, { correct: true }); }
  assert.ok(rest.length >= 1);
  for (const x of rest) {
    const n = C.notion(x.notion);
    assert.ok(!(n && n.fam === res.fam && Math.floor(n.level + 1e-9) >= 1), 'famille repoussée servie : ' + x.key);
  }
  const s = m.finish();
  assert.ok(s.n >= 1);
  const h = P0().history.at(-1);
  assert.equal(h.skip, 1, 'mention dans l’historique');
});

test('manche : jamais de manche vide quand tout est verrouillé (CE1, octobre, toutes les familles de l’année repoussées)', () => {
  for (const [ax, g] of Object.entries(GENS)) {
    for (const classe of ['CE1', 'CE2', 'CM1', 'CM2']) {
      setup(classe, { skills: { [ax]: 3 }, tweak: p => {
        const gi = CLASSES.indexOf(classe);
        const fams = new Set(C.allNotions(ax).filter(n => Math.floor(n.level + 1e-9) === gi).map(n => n.fam));
        p.cal = { later: {}, parent: Object.fromEntries([...fams].map(f => [f, { s: 'pasvu', d: DAY }])) };
      } });
      const m = createManche({ gameId: 'tables', axis: ax, count: 6, today: DAY, seed: 'all' + ax + classe, generators: { [ax]: g } });
      const items = play(m, 6);
      assert.equal(items.length, 6, `${classe} ${ax}`);
    }
  }
});

test('parent : « Pas encore vu » écarte une notion vue au calendrier, « Déjà vu » en ouvre une plus tôt', () => {
  const run = (day, fam, s, seed) => {
    store.init(memoryStorage(), day);
    const p = defaultProfile({ id: 'p1', name: 'Léa', classe: 'CE1', today: '2026-09-01' });
    p.skills['fr.conjug'] = { t: 3, n: 30, last: '', trend: 0, src: 'eval' };
    C.setParentFamily(p, fam, s, day);
    store.addProfile(p);
    const m = createManche({ gameId: 'orchestre', count: 60, today: day, seed, generators: { 'fr.conjug': G } });
    return play(m, 60);
  };
  /* CE1 en avril : l'imparfait est au calendrier (P3) ; le parent dit « pas encore vu » */
  let items = run('2027-04-02', 'fr.conjug:imparfait', 'pasvu', 'pasvu');
  assert.ok(!items.some(it => it.notions.includes('fr.conjug:imparfait')), 'imparfait écarté');
  assert.ok(items.some(it => it.notions.includes('fr.conjug:futur')), 'le futur, lui, vient');
  /* CE1 le 7 octobre : le futur (P4) est « déjà vu » selon le parent → il peut venir ; l'imparfait (P3) non */
  items = run(DAY, 'fr.conjug:futur', 'vu', 'vu');
  assert.ok(items.some(it => it.notion === 'fr.conjug:futur'), 'futur proposé');
  const cap = C.calLevel(store.getProfile(), DAY);
  for (const it of items) for (const n of it.notions) assert.ok(levelOf(n) <= cap + 1e-9 || n === 'fr.conjug:futur', `${it.key} : ${n}`);
  assert.equal(C.parentState(store.getProfile(), 'fr.conjug:futur'), 'vu');
  assert.equal(C.yearFamilies(store.getProfile(), DAY, ['fr.conjug']).find(f => f.fam === 'fr.conjug:futur').state, 'force');
});

test('parents : programme de l’année (familles de la classe, période, état) et « Remettre maintenant »', () => {
  const p = prof('CE1');
  const fams = C.yearFamilies(p, DAY, ['ma.faits', 'fr.conjug']);
  const t8 = fams.find(f => f.fam === 'ma.faits:t8');
  assert.equal(t8.at.period, 4);
  assert.equal(t8.state, 'bientot');
  assert.equal(fams.find(f => f.fam === 'ma.faits:t2').state, 'vu');
  assert.ok(!fams.some(f => f.fam === 'ma.faits:add'), 'familles du CP absentes du programme du CE1');
  const e = C.postpone(p, F.fromKey('ma.faits:2x7', 1.07, makeRng('r')), DAY);
  assert.equal(C.yearFamilies(p, DAY, ['ma.faits']).find(f => f.fam === e.fam).state, 'later');
  assert.ok(C.release(p, e.fam, DAY));
  assert.equal(C.activeLater(p, DAY).length, 0);
  assert.equal(C.yearFamilies(p, DAY, ['ma.faits']).find(f => f.fam === e.fam).state, 'vu');
  /* « Pas encore vu » du parent met fin au report de l'enfant */
  C.postpone(p, F.fromKey('ma.faits:2x7', 1.07, makeRng('r')), '2026-12-02');
  C.setParentFamily(p, 'ma.faits:t2', 'pasvu', '2026-12-03');
  assert.equal(C.activeLater(p, '2026-12-03').length, 0);
  assert.equal(C.yearFamilies(p, '2026-12-03', ['ma.faits']).find(f => f.fam === 'ma.faits:t2').state, 'pasvu');
});

test('déclaration d’un générateur (CALENDAR) : notions et familles fusionnées sans toucher au calendrier', () => {
  const fake = {
    axis: 'ma.problemes',
    CALENDAR: {
      notions: { 'ma.problemes:partage': { at: 'CE1-P2', fam: 'ma.problemes:partage', src: 'bo' }, 'ma.faits:t2': { at: 'CM2-P5', fam: 'x' } },
      families: { 'ma.problemes:partage': { child: 'les problèmes de partage', adult: 'Problèmes de partage', icon: '🍰' } }
    },
    notionOfKey: k => (k === 'ma.problemes:k1' ? 'ma.problemes:partage' : null),
    gen: () => ({ axis: 'ma.problemes', key: 'ma.problemes:k1', A: 1.2, notion: 'ma.problemes:partage' })
  };
  C.useGenerator(fake);
  C.useGenerator(fake);                                         /* idempotent */
  near(C.notion('ma.problemes:partage').level, 1.2);
  assert.equal(C.notion('ma.faits:t2').at, 'CE1-P1', 'une notion de référence n’est jamais remplacée');
  assert.equal(C.family('ma.problemes:partage').child, 'les problèmes de partage');
  assert.equal(C.notionOfKey('ma.problemes:k1'), 'ma.problemes:partage');
  const ce1 = prof('CE1');
  assert.ok(C.calState(ce1, 'ma.problemes', DAY).locked.has('ma.problemes:partage'), 'P2 : pas encore vue le 7 octobre');
  assert.ok(!C.calState(ce1, 'ma.problemes', '2026-11-20').locked.has('ma.problemes:partage'));
  assert.ok(C.canPostpone(ce1, fake.gen(), '2026-11-20', { mode: 'libre' }).ok);
});

test('« 🌱 Pas encore appris » : chaque question a sa phrase enregistrée (sauf les familles à « 1 000 » : voix fluide)', async () => {
  const V = await import('../js/content/voice-lines.js');
  const { frTypo } = await import('../js/core/util.js');
  const M = await import('../js/content/maths/problemes.js');
  C.useGenerator(M);
  const labels = new Set();
  for (const n of C.allNotions()) if (n.level >= 1) { const f = C.family(n.fam); if (f) labels.add(f.child); }
  const whole = t => { const p = V.planSpeech(frTypo(t)); return p.ok && p.clips.length === 1; };
  const bad = [...labels].filter(l => !/\d[\s  ]000/.test(l) && !whole('Tu n’as pas encore appris ' + l + ' en classe ?'));
  assert.deepEqual(bad, [], 'familles sans phrase enregistrée (ajouter au groupe later de voice-lines.js)');
  assert.ok(whole('D’accord ! On le garde pour le mois prochain.'));
});
