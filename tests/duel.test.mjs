/* « 👫 Avec un copain » (js/core/duel.js) : code de partie à 4 chiffres (encodage, décodage, refus gentil des fautes de
   frappe), règle commune liée au jour (mélange), comparaison des points d'un niveau à l'autre, récompenses de
   l'économie existante, carte de résultat sans prénom. */
import { test, assert } from './_t.mjs';
import * as D from '../js/core/duel.js';
import * as F from '../js/core/family.js';
import { makeRng } from '../js/core/rng.js';
import { defaultProfile } from '../js/core/profiles.js';

const DAY = '2026-10-07';
const ALL = [];                                      /* tous les codes valides : 4 types × 2 longueurs × 100 parties */
for (const type of D.CODE_TYPES) for (const rounds of D.DUEL.ROUNDS) for (let game = 0; game < D.DUEL.GAMES; game++) ALL.push({ type, rounds, game });

/* ---------- code ---------- */
test('code : 4 chiffres, aller-retour exact pour les 800 réglages, jamais de 0 ni de 9 en tête', () => {
  const seen = new Set();
  for (const s of ALL) {
    const code = D.encodeCode(s);
    assert.match(code, /^[1-8]\d{3}$/, code);
    assert.ok(!seen.has(code), 'code en double : ' + code);
    seen.add(code);
    const d = D.decodeCode(code);
    assert.deepEqual(d, { ok: true, code, ...s });
    assert.ok(D.isCode(code));
  }
  assert.equal(seen.size, 800);
  /* le chiffre de tête dit le défi et sa longueur */
  assert.equal(D.encodeCode({ type: 'tables', rounds: 3, game: 0 })[0], '1');
  assert.equal(D.encodeCode({ type: 'tables', rounds: 5, game: 0 })[0], '2');
  assert.equal(D.encodeCode({ type: 'melange', rounds: 5, game: 99 }).slice(0, 3), '899');
});

test('code : réglages inconnus → null ; types figés et tous connus du Défi en famille', () => {
  assert.equal(D.encodeCode({ type: 'dessin', rounds: 3, game: 1 }), null);
  assert.equal(D.encodeCode({ type: 'tables', rounds: 4, game: 1 }), null);
  assert.equal(D.encodeCode({ type: 'tables', rounds: 3, game: 100 }), null);
  assert.equal(D.encodeCode({ type: 'tables', rounds: 3, game: -1 }), null);
  assert.equal(D.encodeCode(), null);
  assert.deepEqual([...D.CODE_TYPES], ['tables', 'calcul', 'conjug', 'melange']);
  for (const t of D.CODE_TYPES) assert.ok(F.CHALLENGE_BY_ID[t], t);
  assert.deepEqual([...D.DUEL.ROUNDS], [...F.BATTLE.ROUNDS]);
  assert.ok(D.DUEL.ROUNDS.includes(D.DUEL.DEFAULT_ROUNDS));
});

test('code : toute faute de frappe sur UN chiffre est refusée (contrôle de Damm)', () => {
  let tried = 0;
  for (const s of ALL) {
    const code = D.encodeCode(s);
    for (let i = 0; i < 4; i++) {
      for (let d = 0; d <= 9; d++) {
        if (String(d) === code[i]) continue;
        const typo = code.slice(0, i) + d + code.slice(i + 1);
        const r = D.decodeCode(typo);
        assert.equal(r.ok, false, code + ' → ' + typo);
        tried++;
      }
    }
  }
  assert.equal(tried, 800 * 4 * 9);
});

test('code : deux chiffres voisins inversés sont refusés', () => {
  for (const s of ALL) {
    const code = D.encodeCode(s);
    for (let i = 0; i < 3; i++) {
      if (code[i] === code[i + 1]) continue;
      const swapped = code.slice(0, i) + code[i + 1] + code[i] + code.slice(i + 2);
      assert.equal(D.decodeCode(swapped).ok, false, code + ' → ' + swapped);
    }
  }
});

test('code : refus gentil, avec la raison (vide, trop court, trop long, pas des chiffres, contrôle, type inconnu)', () => {
  assert.equal(D.decodeCode('').reason, 'empty');
  assert.equal(D.decodeCode(null).reason, 'empty');
  assert.equal(D.decodeCode('48').reason, 'short');
  assert.equal(D.decodeCode('48210').reason, 'long');
  assert.equal(D.decodeCode('48a1').reason, 'digits');
  const good = D.encodeCode({ type: 'calcul', rounds: 3, game: 42 });
  const bad = good.slice(0, 3) + ((Number(good[3]) + 1) % 10);
  assert.deepEqual(D.decodeCode(bad), { ok: false, reason: 'check', code: bad });
  /* un code au contrôle juste mais au chiffre de tête libre (0 ou 9, réservés) : type inconnu */
  const reserved = [];
  for (let n = 0; n < 10000; n++) {
    const s = String(n).padStart(4, '0');
    if ((s[0] === '0' || s[0] === '9') && D.decodeCode(s).reason === 'kind') reserved.push(s);
  }
  assert.equal(reserved.length, 200);                /* 2 chiffres de tête × 100 numéros, contrôle juste */
  /* espaces (affichage « 4 8 2 1 »), espaces fines et tirets tolérés */
  const code = D.encodeCode({ type: 'tables', rounds: 5, game: 7 });
  assert.equal(D.decodeCode(code.split('').join(' ')).code, code);
  assert.equal(D.decodeCode(code.slice(0, 2) + '\u202F' + code.slice(2)).code, code);
  assert.equal(D.decodeCode(code.slice(0, 2) + '-' + code.slice(2)).ok, true);
  /* sur 10 000 suites de 4 chiffres, une sur 12,5 seulement est un code : un chiffre tapé au hasard est presque
     toujours refusé */
  let valid = 0;
  for (let n = 0; n < 10000; n++) if (D.isCode(String(n).padStart(4, '0'))) valid++;
  assert.equal(valid, 800);
});

test('nouveau code : le défi choisi, un numéro au hasard, jamais le dernier code redonné tout de suite', () => {
  const rng = makeRng(12);
  const games = new Set();
  let prev = '';
  for (let i = 0; i < 400; i++) {
    const code = D.newCode({ type: 'conjug', rounds: 3 }, rng, prev);
    const d = D.decodeCode(code);
    assert.equal(d.ok, true);
    assert.equal(d.type, 'conjug');
    assert.equal(d.rounds, 3);
    assert.notEqual(code, prev);
    games.add(d.game);
    prev = code;
  }
  assert.ok(games.size > 90, 'numéros variés : ' + games.size);
  /* hasard obstiné (rng constant) : le numéro suivant */
  const stuck = { int: () => 5 };
  const five = D.encodeCode({ type: 'tables', rounds: 5, game: 5 });
  assert.equal(D.decodeCode(D.newCode({ type: 'tables', rounds: 5 }, stuck, five)).game, 6);
  /* réglages absents ou faux : tables, longueur par défaut */
  const d = D.decodeCode(D.newCode({}, makeRng(1)));
  assert.equal(d.type, 'tables');
  assert.equal(d.rounds, D.DUEL.DEFAULT_ROUNDS);
});

test('code dit chiffre par chiffre : une phrase par chiffre, sans rien d’autre', () => {
  assert.equal(D.spokenCode('4821'), '4. 8. 2. 1.');
  assert.equal(D.spokenCode('1 0 0 7'), '1. 0. 0. 7.');
  assert.deepEqual(D.codeDigits('4821'), ['4', '8', '2', '1']);
  assert.deepEqual(D.codeDigits('ab'), []);
});

/* ---------- règle commune ---------- */
test('règle : la même sur tous les téléphones (code + jour), un type par manche', () => {
  for (const s of ALL.filter((_, i) => i % 7 === 0)) {
    const code = D.encodeCode(s);
    const a = D.duelRule(code, DAY), b = D.duelRule(code, DAY);
    assert.deepEqual(a, b);
    assert.equal(a.code, code);
    assert.equal(a.type, s.type);
    assert.equal(a.rounds, s.rounds);
    assert.equal(a.plan.length, s.rounds);
    const axes = F.CHALLENGE_BY_ID[s.type].axes;
    for (const ax of a.plan) assert.ok(axes.includes(ax), ax);
  }
  const good = D.encodeCode({ type: 'tables', rounds: 3, game: 40 });
  assert.equal(D.duelRule(good.slice(0, 3) + ((Number(good[3]) + 5) % 10), DAY), null);   /* faute de frappe */
  assert.equal(D.duelRule('', DAY), null);
  assert.ok(Object.isFrozen(D.duelRule(good, DAY).plan));
});

test('règle « mélange » : chaque type une fois par paquet de trois, jamais deux fois de suite, liée au jour', () => {
  const orders = new Set(), days = new Set();
  for (let game = 0; game < 100; game++) {
    for (const rounds of D.DUEL.ROUNDS) {
      const code = D.encodeCode({ type: 'melange', rounds, game });
      const { plan } = D.duelRule(code, DAY);
      assert.deepEqual([...plan.slice(0, 3)].sort(), ['fr.conjug', 'ma.faits', 'ma.procedures']);
      for (let i = 1; i < plan.length; i++) assert.notEqual(plan[i], plan[i - 1], code + ' : ' + plan.join(' '));
      if (rounds === 5) assert.notEqual(plan[3], plan[4]);
      if (rounds === 3) orders.add(plan.join(' '));
    }
  }
  assert.equal(orders.size, 6);                      /* les 6 ordres possibles sortent selon le numéro de partie */
  const code = D.encodeCode({ type: 'melange', rounds: 5, game: 31 });
  for (let k = 1; k <= 28; k++) days.add(D.duelRule(code, '2026-10-' + String(k).padStart(2, '0')).plan.join(' '));
  assert.ok(days.size >= 6, 'le même code change d’ordre d’un jour à l’autre : ' + days.size);
  /* un seul type : toutes les manches pareilles */
  assert.deepEqual([...D.duelRule(D.encodeCode({ type: 'calcul', rounds: 5, game: 3 }), DAY).plan], Array(5).fill('ma.procedures'));
});

test('règle : avant le CE1, la conjugaison devient des tables (comme le Défi en famille)', () => {
  const rule = D.duelRule(D.encodeCode({ type: 'conjug', rounds: 3, game: 9 }), DAY);
  assert.equal(D.duelAxis(rule, 1, 'CP'), 'ma.faits');
  assert.equal(D.duelAxis(rule, 1, 'CE1'), 'fr.conjug');
  assert.deepEqual(D.duelAxes(rule, 'CP'), ['ma.faits']);
  assert.deepEqual(D.duelAxes(rule, 'CM2'), ['fr.conjug']);
  const mix = D.duelRule(D.encodeCode({ type: 'melange', rounds: 5, game: 9 }), DAY);
  assert.deepEqual(D.duelAxes(mix, 'CP').sort(), ['ma.faits', 'ma.procedures']);
  assert.deepEqual(D.duelAxes(mix, 'CM1').sort(), ['fr.conjug', 'ma.faits', 'ma.procedures']);
  /* manche hors bornes : bornée ; règle absente : tables */
  assert.equal(D.duelAxis(mix, 99, 'CM1'), mix.plan[4]);
  assert.equal(D.duelAxis(mix, 0, 'CM1'), mix.plan[0]);
  assert.equal(D.duelAxis(null, 1, 'CM1'), 'ma.faits');
  /* la même règle que battleAxis pour un type simple */
  for (const cl of ['CP', 'CE1', 'CM2']) assert.equal(F.axisForClasse('fr.conjug', cl), F.battleAxis('conjug', 1, cl));
});

/* ---------- comparaison ---------- */
test('comparaison : mêmes réponses, mêmes points, quel que soit le niveau des questions', () => {
  /* un CP (tables simples) et un CM2 (calcul plus long) répondent juste, aussi vite par rapport au seuil de LEUR
     question : mêmes points ; le bonus de rapidité suit le seuil de chaque item */
  const play = (items, ratio) => {
    let streak = 0, points = 0;
    for (const it of items) {
      streak++;
      points += F.questionPoints({ correct: true, ms: F.autoMsOf(it) * ratio, autoMs: F.autoMsOf(it), streak }).total;
    }
    return points;
  };
  const cp = [{ axis: 'ma.faits', autoMs: 2500 }, { axis: 'ma.faits' }, { axis: 'ma.procedures', autoMs: 4000 }];
  const cm2 = [{ axis: 'ma.faits', autoMs: 3500 }, { axis: 'fr.conjug' }, { axis: 'ma.procedures', autoMs: 8000 }];
  assert.equal(play(cp, 0.8), play(cm2, 0.8));
  assert.equal(play(cp, 2), play(cm2, 2));
  assert.equal(play(cp, 0.5), 3 * 150 + 10 + 20);    /* 3 justes, rapides, série */
});

test('comparaison des cartes : rang dense, ex aequo, gagnants ; une carte d’une autre partie est mise à part', () => {
  const code = D.encodeCode({ type: 'tables', rounds: 5, game: 12 });
  const other = D.encodeCode({ type: 'tables', rounds: 5, game: 13 });
  const card = (pts, name, c = code) => D.resultCard({ companion: { name, type: 'pony' } }, { code: c, points: pts, answered: 5 });
  const res = D.compareCards([card(640, 'Caramel'), card(720, 'Noisette'), card(640, 'Étoile'), card(900, 'Zip', other)]);
  assert.equal(res.code, code);
  assert.deepEqual(res.rows.map(r => [r.card.pet.name, r.rank, r.tie]), [['Noisette', 1, false], ['Caramel', 2, true], ['Étoile', 2, true]]);
  assert.deepEqual(res.winners, ['1']);
  assert.equal(res.tie, false);
  assert.deepEqual(res.others.map(c => c.pet.name), ['Zip']);
  const tie = D.compareCards([card(500, 'A'), card(500, 'B')]);
  assert.equal(tie.tie, true);
  assert.equal(tie.winners.length, 2);
  const none = D.compareCards([card(0, 'A'), card(0, 'B')]);
  assert.deepEqual(none.winners, []);                 /* personne n'a de point : pas de gagnant */
  assert.deepEqual(D.compareCards([]).rows, []);
});

/* ---------- récompenses et bilan ---------- */
test('récompenses : participation du Défi en famille, jamais de trophée (l’appli ne sait pas qui a gagné)', () => {
  assert.deepEqual(D.duelRewards({ answered: 5, points: 900 }), { apples: F.BATTLE.PARTICIPATION, trophy: false });
  assert.deepEqual(D.duelRewards({ answered: 0, points: 0 }), { apples: 0, trophy: false });
  assert.deepEqual(D.duelRewards(null), { apples: 0, trophy: false });
});

test('carte de résultat : code, points, compagnon et thème — jamais le prénom de l’enfant', () => {
  const p = defaultProfile({ id: 'p1', name: 'Léa', g: 'f', classe: 'CE2', today: DAY });
  p.companion.name = 'Noisette';
  p.companion.type = 'unicorn';
  p.companion.minutes = 75;
  p.settings.theme = 'espace';
  const code = D.encodeCode({ type: 'melange', rounds: 3, game: 58 });
  const c = D.resultCard(p, { code, points: 455.7, answered: 3, correct: 3, apples: 8 });
  assert.deepEqual(c, { code, type: 'melange', rounds: 3, points: 455, answered: 3, correct: 3, apples: 8,
    pet: { name: 'Noisette', type: 'unicorn', stage: 2 }, theme: 'espace' });
  assert.ok(!JSON.stringify(c).includes('Léa'));
  /* valeurs absentes ou fausses : bornées, thème par défaut, compagnon par défaut */
  const z = D.resultCard(null, { code: 'abcd', points: -5 });
  assert.deepEqual(z, { code: '', type: null, rounds: 0, points: 0, answered: 0, correct: 0, apples: 0,
    pet: { name: 'Caramel', type: 'pony', stage: 1 }, theme: 'caramel' });
});
