/* Économie : série 🔥 (règle v11 + gel hebdomadaire), 🍎, ⭐, badges (contrat §5.2). */
import { test, assert } from './_t.mjs';
import { BADGES, STREAK_BONUS, WEEK_BONUS, totalStars, addApples, bumpStreak, refreshFreeze, badgeOf } from '../js/core/economy.js';
import { defaultProfile } from '../js/core/profiles.js';
import { addDays, weekKey } from '../js/core/util.js';

const TODAY = '2026-10-02';                         /* vendredi, semaine 2026-W40 */
const YESTERDAY = '2026-10-01', BEFORE = '2026-09-30';

/* profil dont le gel de la semaine a déjà été distribué (refreshFreeze n'interfère pas) */
function prof(streak = {}, apples = 100) {
  const p = defaultProfile({ id: 'p1', today: '2026-09-01' });
  Object.assign(p.streak, { freezeWeek: weekKey(TODAY) }, streak);
  p.wallet.apples = apples;
  return p;
}

test('série : même jour → rien (bonus 0)', () => {
  const p = prof({ count: 4, last: TODAY });
  assert.deepEqual(bumpStreak(p, TODAY), { bonus: 0, count: 4, usedFreeze: false });
  assert.equal(p.wallet.apples, 100);
  assert.equal(p.streak.last, TODAY);
});

test('série : dernier jour = hier → +1, bonus 10 🍎', () => {
  const p = prof({ count: 4, last: YESTERDAY });
  assert.deepEqual(bumpStreak(p, TODAY), { bonus: STREAK_BONUS, count: 5, usedFreeze: false });
  assert.equal(p.wallet.apples, 110);
  assert.equal(p.streak.last, TODAY);
  assert.equal(p.streak.freezes, 1, 'gel non utilisé');
  /* deuxième manche du même jour : plus rien */
  assert.deepEqual(bumpStreak(p, TODAY), { bonus: 0, count: 5, usedFreeze: false });
  assert.equal(p.wallet.apples, 110);
});

test('série : avant-hier avec un gel → gel consommé, +1', () => {
  const p = prof({ count: 4, last: BEFORE, freezes: 1 });
  assert.deepEqual(bumpStreak(p, TODAY), { bonus: 10, count: 5, usedFreeze: true });
  assert.equal(p.streak.freezes, 0);
  assert.equal(p.streak.last, TODAY);
  assert.equal(p.wallet.apples, 110);
});

test('série : avant-hier sans gel → repart à 1', () => {
  const p = prof({ count: 4, last: BEFORE, freezes: 0 });
  assert.deepEqual(bumpStreak(p, TODAY), { bonus: 10, count: 1, usedFreeze: false });
  assert.equal(p.streak.freezes, 0);
});

test('série : trou de 3 jours ou plus → repart à 1, le gel est gardé', () => {
  for (const last of ['2026-09-29', '2026-09-01', '2025-10-02']) {
    const p = prof({ count: 9, last, freezes: 1 });
    assert.deepEqual(bumpStreak(p, TODAY), { bonus: 10, count: 1, usedFreeze: false }, last);
    assert.equal(p.streak.freezes, 1);
  }
});

test('série : tout premier jour → 1, bonus 10', () => {
  const p = prof({}, 0);
  assert.deepEqual(bumpStreak(p, TODAY), { bonus: 10, count: 1, usedFreeze: false });
  assert.equal(p.wallet.apples, 10);
});

test('série : bonus du 7e jour (+50), y compris quand le gel sauve la série', () => {
  const cases = [
    [{ count: 6, last: YESTERDAY }, 7, 60, false],
    [{ count: 13, last: YESTERDAY }, 14, 60, false],
    [{ count: 7, last: YESTERDAY }, 8, 10, false],
    [{ count: 6, last: BEFORE, freezes: 1 }, 7, 60, true],
    [{ count: 20, last: YESTERDAY }, 21, 60, false]
  ];
  for (const [streak, count, bonus, usedFreeze] of cases) {
    const p = prof(streak, 0);
    assert.deepEqual(bumpStreak(p, TODAY), { bonus, count, usedFreeze }, JSON.stringify(streak));
    assert.equal(p.wallet.apples, bonus);
  }
  assert.equal(STREAK_BONUS + WEEK_BONUS, 60);
});

test('série : trois semaines de jeu avec trous (gel hebdomadaire)', () => {
  /* L = joué, . = pas joué ; du lundi 2026-09-28 (W40) au dimanche 2026-10-18 (W42) */
  const plan = 'LLLLL.L' + 'L..LLLL' + 'LLLLLLL';
  const p = defaultProfile({ id: 'p1', today: '2026-09-01' });
  p.streak.freezes = 1;                               /* gel offert à la migration */
  const counts = [];
  let apples = 0, used = 0;
  [...plan].forEach((c, i) => {
    if (c !== 'L') return;
    const r = bumpStreak(p, addDays('2026-09-28', i));
    counts.push(r.count);
    apples += r.bonus;
    if (r.usedFreeze) used++;
  });
  /* sam. 03/10 manqué → gel W40 utilisé le dim. ; mar.-mer. 06-07/10 manqués (2 jours) → repart à 1 ;
     le gel de W41 reste disponible puis W42 n'en ajoute pas un second (max 1) */
  assert.deepEqual(counts, [1, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(used, 1);
  assert.equal(p.streak.freezes, 1);
  assert.equal(p.streak.freezeWeek, '2026-W42');
  assert.equal(apples, 18 * 10 + 2 * 50);
  assert.equal(p.wallet.apples, apples);
});

test('gel : 1 gel offert par semaine ISO (freezes = max(freezes, 1))', () => {
  const p = defaultProfile({ id: 'p1', today: TODAY });
  p.streak.freezes = 0;
  p.streak.freezeWeek = '2026-W39';
  assert.equal(refreshFreeze(p, TODAY), true);
  assert.equal(p.streak.freezes, 1);
  assert.equal(p.streak.freezeWeek, '2026-W40');
  p.streak.freezes = 0;                              /* utilisé dans la semaine */
  assert.equal(refreshFreeze(p, '2026-10-04'), false, 'dimanche : même semaine ISO');
  assert.equal(p.streak.freezes, 0);
  assert.equal(refreshFreeze(p, '2026-10-05'), true, 'lundi : nouvelle semaine');
  assert.equal(p.streak.freezes, 1);
  p.streak.freezes = 2;                              /* jamais retiré, jamais cumulé au-delà */
  assert.equal(refreshFreeze(p, '2026-10-12'), true);
  assert.equal(p.streak.freezes, 2);
  /* passage d'année ISO */
  assert.equal(refreshFreeze(p, '2027-01-01'), true);
  assert.equal(p.streak.freezeWeek, '2026-W53');
  assert.equal(refreshFreeze(null, TODAY), false);
});

test('gel : le gel de la nouvelle semaine est rendu avant le calcul de la série', () => {
  const p = prof({ count: 10, last: '2026-10-03', freezes: 0, freezeWeek: '2026-W40' }, 0);
  const r = bumpStreak(p, '2026-10-05');             /* lundi : dimanche manqué */
  assert.deepEqual(r, { bonus: 10, count: 11, usedFreeze: true });
  assert.equal(p.streak.freezes, 0);
  assert.equal(p.streak.freezeWeek, '2026-W41');
});

test('série : passages de mois et d’année', () => {
  assert.equal(bumpStreak(prof({ count: 3, last: '2026-12-31' }), '2027-01-01').count, 4);
  assert.equal(bumpStreak(prof({ count: 3, last: '2027-02-27', freezes: 1, freezeWeek: '' }), '2027-03-01').usedFreeze, true);
  assert.equal(bumpStreak(prof({ count: 3, last: '2026-10-31' }), '2026-11-01').count, 4);
});

test('série : horloge de l’appareil reculée → série gardée, sans bonus', () => {
  const p = prof({ count: 9, last: '2026-10-05' });
  assert.deepEqual(bumpStreak(p, TODAY), { bonus: 0, count: 9, usedFreeze: false });
  assert.equal(p.streak.last, TODAY);
  assert.equal(p.wallet.apples, 100);
  assert.equal(bumpStreak(p, '2026-10-03').count, 10);
});

test('série : profil partiel ou valeurs farfelues', () => {
  const p = { wallet: { apples: '7' } };
  assert.deepEqual(bumpStreak(p, TODAY), { bonus: 10, count: 1, usedFreeze: false });
  assert.equal(p.wallet.apples, 17);
  assert.equal(p.streak.freezeWeek, '2026-W40');
  const q = prof({ count: '4', last: YESTERDAY, freezes: '1' });
  assert.equal(bumpStreak(q, TODAY).count, 5);
  assert.deepEqual(bumpStreak(null, TODAY), { bonus: 0, count: 0, usedFreeze: false });
  /* date passée en objet Date */
  const r = prof({ count: 2, last: YESTERDAY });
  assert.equal(bumpStreak(r, new Date(2026, 9, 2, 18)).count, 3);
  assert.equal(r.streak.last, TODAY);
});

test('totalStars : Σ min(3, ⭐)', () => {
  const p = defaultProfile({ today: TODAY });
  assert.equal(totalStars(p), 0);
  p.wallet.stars = { pomme: 3, foret: 5, cirque: -1, plage: '2', neige: 'x', reve: 1.9 };
  assert.equal(totalStars(p), 3 + 3 + 0 + 2 + 0 + 1);
  assert.equal(totalStars(null), 0);
  assert.equal(totalStars({}), 0);
});

test('addApples : gains, dépenses, jamais sous 0', () => {
  const p = defaultProfile({ today: TODAY });
  assert.equal(addApples(p, 25), 25);
  assert.equal(addApples(p, -10), 15);
  assert.equal(addApples(p, -100), 0);
  assert.equal(addApples(p, 2.6), 3);
  assert.equal(addApples(p, NaN), 3);
  assert.equal(addApples(p, '4'), 7);
  assert.equal(p.wallet.apples, 7);
  const q = {};
  assert.equal(addApples(q, 5), 5);
  assert.deepEqual(q.wallet, { apples: 5, stars: {} });
  assert.equal(addApples(null, 5), 0);
});

test('badgeOf : bronze 1,5 · argent 2,25 · or 2,75', () => {
  assert.deepEqual(BADGES, { bronze: 1.5, argent: 2.25, or: 2.75 });
  const cases = [[0, null], [1.49, null], [1.5, 'bronze'], [2.24, 'bronze'], [2.25, 'argent'],
                 [2.2499999999999, 'argent'], [2.74, 'argent'], [2.75, 'or'], [3, 'or'], ['2.8', 'or'],
                 [null, null], [undefined, null], [NaN, null], ['', null], ['abc', null]];
  for (const [t, b] of cases) assert.equal(badgeOf(t), b, String(t));
});
