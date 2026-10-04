import { test, assert } from './_t.mjs';
import { INTERVALS, review, dueKeys, weakKeys, stats } from '../js/core/leitner.js';
import { addDays } from '../js/core/util.js';

const D = '2026-10-02';

test('nouvelle clé : juste → boîte 2 (+2 j), faux → boîte 1 (+1 j)', () => {
  const p = {};
  const a = review(p, 'ma.faits:7x8', true, D);
  assert.deepEqual(a, { b: 2, due: '2026-10-04', seen: 1, ok: 1, last: D });
  const b = review(p, 'ma.faits:6x9', false, D);
  assert.deepEqual(b, { b: 1, due: '2026-10-03', seen: 1, ok: 0, last: D });
  assert.equal(p.leitner['ma.faits:7x8'], a);
});

test('clé connue : juste → boîte + 1 (max 5) et intervalle de la boîte ; faux → boîte 1', () => {
  const p = { leitner: {} };
  let day = D, e = review(p, 'k:x', true, day);               /* boîte 2 */
  for (const expected of [3, 4, 5, 5]) {
    day = e.due;
    e = review(p, 'k:x', true, day);
    assert.equal(e.b, expected);
    assert.equal(e.due, addDays(day, INTERVALS[expected - 1]));
  }
  assert.equal(e.due, addDays(day, 16));
  assert.equal(e.seen, 5); assert.equal(e.ok, 5);
  e = review(p, 'k:x', false, '2026-12-01');
  assert.deepEqual(e, { b: 1, due: '2026-12-02', seen: 6, ok: 5, last: '2026-12-01' });
  e = review(p, 'k:x', true, '2026-12-02');
  assert.equal(e.b, 2); assert.equal(e.due, '2026-12-04');
});

test('champs supplémentaires d’une entrée conservés (forme affichable d’un mot)', () => {
  const p = { leitner: { 'fr.fluence:ecurie': { b: 1, due: D, seen: 1, ok: 0, last: '2026-10-01', w: 'écurie' } } };
  const e = review(p, 'fr.fluence:ecurie', true, D);
  assert.deepEqual(e, { b: 2, due: '2026-10-04', seen: 2, ok: 1, last: D, w: 'écurie' });
});

test('entrée abîmée : reprise sans planter', () => {
  const p = { leitner: { 'k:a': { b: 'x', seen: -2, ok: null }, 'k:b': { b: 12, due: 5 } } };
  assert.deepEqual(review(p, 'k:a', true, D), { b: 2, due: '2026-10-04', seen: 1, ok: 1, last: D });
  assert.equal(review(p, 'k:b', true, D).b, 5);
  assert.deepEqual(dueKeys({ leitner: { 'k:z': { b: 3 } } }, 'k', D), ['k:z']);   /* sans date → due */
  assert.deepEqual(dueKeys({}, 'k', D), []);
  assert.deepEqual(dueKeys(null, 'k', D), []);
});

test('dueKeys : échéance ≤ aujourd’hui, boîte basse puis plus en retard d’abord', () => {
  const p = { leitner: {
    'ma.faits:7x8': { b: 3, due: '2026-09-20', seen: 4, ok: 3, last: '2026-09-16' },
    'ma.faits:6x9': { b: 1, due: '2026-10-02', seen: 2, ok: 0, last: '2026-10-01' },
    'ma.faits:4x7': { b: 1, due: '2026-09-28', seen: 3, ok: 1, last: '2026-09-27' },
    'ma.faits:3x8': { b: 2, due: '2026-10-01', seen: 1, ok: 1, last: '2026-09-29' },
    'ma.faits:2x9': { b: 2, due: '2026-10-03', seen: 1, ok: 1, last: '2026-10-01' },   /* demain */
    'ma.faits:add:7+8': { b: 1, due: '2026-10-01', seen: 1, ok: 0, last: '2026-09-30' },
    'fr.conjug:prendre|present|3p': { b: 1, due: '2026-09-01', seen: 1, ok: 0, last: '2026-08-31' },
    'ma.faitsx:1x1': { b: 1, due: '2026-09-01', seen: 1, ok: 0, last: '2026-08-31' }
  } };
  assert.deepEqual(dueKeys(p, 'ma.faits', D),
    ['ma.faits:4x7', 'ma.faits:add:7+8', 'ma.faits:6x9', 'ma.faits:3x8', 'ma.faits:7x8']);
  assert.deepEqual(dueKeys(p, 'ma.faits', D, 2), ['ma.faits:4x7', 'ma.faits:add:7+8']);
  assert.deepEqual(dueKeys(p, 'ma.faits:add:', D), ['ma.faits:add:7+8']);
  assert.deepEqual(dueKeys(p, 'fr.conjug', D), ['fr.conjug:prendre|present|3p']);
  assert.deepEqual(dueKeys(p, 'fr.conjug:prendre', D), ['fr.conjug:prendre|present|3p']);
  assert.ok(dueKeys(p, 'ma.faits', '2026-10-03').includes('ma.faits:2x9'));
  assert.equal(dueKeys(p, '', D).length, 7);
  /* même boîte et même échéance : la moins récemment vue d'abord */
  const q = { leitner: { 'a:1': { b: 1, due: D, last: '2026-10-01' }, 'a:2': { b: 1, due: D, last: '2026-09-25' } } };
  assert.deepEqual(dueKeys(q, 'a', D), ['a:2', 'a:1']);
});

test('weakKeys : boîtes 1-2, les plus fragiles d’abord', () => {
  const p = { leitner: {
    'fr.fluence:ecurie': { b: 1, due: D, seen: 4, ok: 1, last: D },
    'fr.fluence:galop': { b: 1, due: D, seen: 2, ok: 0, last: D },
    'fr.fluence:soleil': { b: 2, due: D, seen: 3, ok: 2, last: D },
    'fr.fluence:pomme': { b: 3, due: D, seen: 5, ok: 4, last: D },
    'ma.faits:7x8': { b: 1, due: D, seen: 1, ok: 0, last: D }
  } };
  assert.deepEqual(weakKeys(p, 'fr.fluence'), ['fr.fluence:galop', 'fr.fluence:ecurie', 'fr.fluence:soleil']);
  assert.deepEqual(weakKeys(p, 'fr.fluence', 1), ['fr.fluence:galop']);
  assert.deepEqual(weakKeys(p, 'ma.faits'), ['ma.faits:7x8']);
});

test('weakKeys : un fait réussi du premier coup (boîte 2, jamais manqué) n’est pas « à revoir »', () => {
  const p = {};
  review(p, 'ma.faits:5x9', true, D);                   /* nouvelle clé juste → boîte 2, seen 1 ok 1 */
  review(p, 'ma.faits:2x4', true, D);
  review(p, 'ma.faits:2x4', true, D);                   /* revu juste le même jour : boîte 2, seen 2 ok 2 */
  review(p, 'ma.faits:8x8', false, D);                  /* manqué → boîte 1 */
  review(p, 'ma.faits:8x8', false, D);
  review(p, 'ma.faits:add:10+10', false, D);            /* joker (aidé) = pas « juste » → boîte 1 */
  review(p, 'ma.faits:6x7', false, '2026-09-30');       /* manqué puis retrouvé à l'échéance : boîte 2, ok < seen */
  review(p, 'ma.faits:6x7', true, '2026-10-01');
  assert.equal(p.leitner['ma.faits:5x9'].b, 2);
  assert.equal(p.leitner['ma.faits:6x7'].b, 2);
  assert.deepEqual(weakKeys(p, 'ma.faits'), ['ma.faits:8x8', 'ma.faits:add:10+10', 'ma.faits:6x7']);
  /* boîte 1 sans compteurs (sauvegarde ancienne ou incomplète) : toujours à revoir */
  assert.deepEqual(weakKeys({ leitner: { 'a:1': { b: 1, due: D }, 'a:2': { b: 2, due: D, seen: 1, ok: 1 } } }, 'a'), ['a:1']);
});

test('stats : total, répartition par boîte, dues', () => {
  const p = {};
  review(p, 'ma.faits:7x8', true, '2026-09-28');      /* b2 due 09-30 */
  review(p, 'ma.faits:6x9', false, '2026-10-01');     /* b1 due 10-02 */
  review(p, 'ma.faits:2x2', true, D);                 /* b2 due 10-04 */
  review(p, 'fr.conjug:etre|present|1s', true, D);
  assert.deepEqual(stats(p, 'ma.faits', D), { total: 3, byBox: [1, 2, 0, 0, 0], due: 2 });
  assert.deepEqual(stats(p, 'fr.conjug', D), { total: 1, byBox: [0, 1, 0, 0, 0], due: 0 });
  assert.deepEqual(stats({}, 'ma.faits', D), { total: 0, byBox: [0, 0, 0, 0, 0], due: 0 });
});

test('révision : pas de promotion le jour même ni avant l’échéance (pas de bachotage)', () => {
  const p = { leitner: {} };
  review(p, 'ma.faits:7x8', true, '2026-10-05');                 /* nouvelle clé juste → boîte 2, due +2 j */
  assert.equal(p.leitner['ma.faits:7x8'].b, 2);
  review(p, 'ma.faits:7x8', true, '2026-10-05');                 /* même jour : reste en boîte 2, échéance gardée */
  review(p, 'ma.faits:7x8', true, '2026-10-05');
  assert.equal(p.leitner['ma.faits:7x8'].b, 2);
  assert.equal(p.leitner['ma.faits:7x8'].due, '2026-10-07');
  assert.equal(p.leitner['ma.faits:7x8'].seen, 3);
  review(p, 'ma.faits:7x8', true, '2026-10-06');                 /* pas encore dû : pas de promotion */
  assert.equal(p.leitner['ma.faits:7x8'].b, 2);
  review(p, 'ma.faits:7x8', true, '2026-10-07');                 /* dû : boîte 3 */
  assert.equal(p.leitner['ma.faits:7x8'].b, 3);
  review(p, 'ma.faits:7x8', false, '2026-10-07');                /* une erreur ramène toujours en boîte 1 */
  assert.equal(p.leitner['ma.faits:7x8'].b, 1);
  assert.equal(p.leitner['ma.faits:7x8'].due, '2026-10-08');
});
