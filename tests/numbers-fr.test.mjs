import { test, assert } from './_t.mjs';
import { loadLexicon } from './lexicon.mjs';
import { makeRng } from '../js/core/rng.js';
import { toWords, spell, grammarFor, parseSpoken, MAX } from '../js/core/numbers-fr.js';

const lex = loadLexicon();
const words = s => s.split(' ');
const notInLex = s => words(s).filter(w => !lex.has(w));

test('toWords : formes exactes (lexique Vosk)', () => {
  const cases = {
    0: 'zéro', 1: 'un', 9: 'neuf', 10: 'dix', 16: 'seize', 17: 'dix-sept', 19: 'dix-neuf',
    20: 'vingt', 21: 'vingt-et-un', 22: 'vingt-deux', 31: 'trente-et-un', 42: 'quarante-deux',
    61: 'soixante-et-un', 70: 'soixante-dix', 71: 'soixante-et-onze', 72: 'soixante-douze',
    77: 'soixante-dix-sept', 79: 'soixante-dix-neuf', 80: 'quatre-vingts', 81: 'quatre-vingt-un',
    89: 'quatre-vingt-neuf', 90: 'quatre-vingt-dix', 91: 'quatre-vingt-onze', 97: 'quatre-vingt-dix-sept',
    99: 'quatre-vingt-dix-neuf', 100: 'cent', 101: 'cent un', 121: 'cent vingt-et-un', 180: 'cent quatre-vingts',
    200: 'deux cents', 201: 'deux cent un', 280: 'deux cent quatre-vingts', 999: 'neuf cent quatre-vingt-dix-neuf',
    1000: 'mille', 1001: 'mille un', 1100: 'mille cent', 2000: 'deux mille', 2026: 'deux mille vingt-six',
    21000: 'vingt-et-un mille', 80000: 'quatre-vingt mille', 80080: 'quatre-vingt mille quatre-vingts',
    200000: 'deux cent mille', 300200: 'trois cent mille deux cents',
    999999: 'neuf cent quatre-vingt-dix-neuf mille neuf cent quatre-vingt-dix-neuf',
    1000000: 'un million', 2000000: 'deux millions', 80000000: 'quatre-vingts millions',
    200000000: 'deux cents millions', 1000000000: 'un milliard', 2500000000: 'deux milliards cinq cents millions'
  };
  for (const [n, w] of Object.entries(cases)) assert.equal(toWords(Number(n)), w, n);
});

test('toWords : tous les mots de 0 à 2 000 (et un échantillon jusqu’à MAX) sont dans le lexique', () => {
  for (let n = 0; n <= 2000; n++) assert.deepEqual(notInLex(toWords(n)), [], String(n));
  const rng = makeRng('lexique');
  for (let i = 0; i < 3000; i++) {
    const n = i < 1500 ? rng.int(0, 999999) : rng.int(0, MAX);
    assert.deepEqual(notInLex(toWords(n)), [], String(n));
  }
});

test('aller-retour toWords → parseSpoken de 0 à 1 000', () => {
  for (let n = 0; n <= 1000; n++) assert.equal(parseSpoken(toWords(n)), n, toWords(n));
});

test('aller-retour sur les grands nombres', () => {
  const fixed = [1001, 1999, 10000, 21021, 70071, 80000, 80081, 99999, 100000, 100100, 180180, 200000,
    999999, 1000000, 1000001, 2000000, 21000000, 80000000, 200000000, 999999999, 1000000000, 2000000000, MAX];
  for (const n of fixed) assert.equal(parseSpoken(toWords(n)), n, toWords(n));
  const rng = makeRng('grands');
  for (let i = 0; i < 4000; i++) {
    const n = i < 2000 ? rng.int(1000, 999999) : rng.int(0, MAX);
    assert.equal(parseSpoken(toWords(n)), n, toWords(n));
  }
});

test('spell : orthographe rectifiée de 1990 (affichage) et aller-retour', () => {
  const cases = {
    0: 'zéro', 21: 'vingt-et-un', 80: 'quatre-vingts', 200: 'deux-cents', 245: 'deux-cent-quarante-cinq',
    1000: 'mille', 1001: 'mille-un', 2026: 'deux-mille-vingt-six', 80000: 'quatre-vingt-mille',
    200000: 'deux-cent-mille', 1000000: 'un million', 2500000: 'deux millions cinq-cent-mille',
    300000000: 'trois-cents millions', 1000000021: 'un milliard vingt-et-un'
  };
  for (const [n, w] of Object.entries(cases)) assert.equal(spell(Number(n)), w, n);
  for (let n = 0; n <= 1200; n++) assert.equal(parseSpoken(spell(n)), n, spell(n));
  const rng = makeRng('spell');
  for (let i = 0; i < 1000; i++) { const n = rng.int(0, MAX); assert.equal(parseSpoken(spell(n)), n, spell(n)); }
});

test('formes espacées, variantes et « et »', () => {
  const cases = {
    'vingt et un': 21, 'vingt un': 21, 'trente et un': 31, 'soixante et onze': 71, 'soixante onze': 71,
    'soixante dix': 70, 'soixante dix sept': 77, 'quatre vingt': 80, 'quatre vingts': 80,
    'quatre vingt un': 81, 'quatre vingt et un': 81, 'quatre vingt dix': 90, 'quatre vingt onze': 91,
    'quatre vingt dix sept': 97, 'dix sept': 17, 'cinquante six': 56, 'cent et un': 101,
    'mille et une': 1001, 'deux cent': 200, 'trois cents': 300, 'deux cents millions': 200000000,
    'cent mille': 100000, 'un million deux cent mille': 1200000, 'mille-deux-cent-trente-quatre': 1234,
    'septante': 70, 'septante-deux': 72, 'septante et un': 71, 'huitante': 80, 'octante et un': 81,
    'nonante-neuf': 99, 'nonante neuf': 99, 'Zéro': 0, 'zero': 0, 'QUATRE-VINGT-DIX-NEUF': 99, 'mil': 1000
  };
  for (const [s, n] of Object.entries(cases)) assert.equal(parseSpoken(s), n, s);
});

test('chiffres', () => {
  const cases = {
    '56': 56, '0': 0, '1 000': 1000, '1\u00a0000': 1000, '1\u202f000': 1000, '12 345': 12345,
    '1 000 000': 1000000, '3,5': 3.5, '1 000,5': 1000.5, '7 × 8 = 56': 56, 'il y a 3 pommes et 4 poires': 4,
    '7 8': 8, '2 millions': 2000000, 'j’ai dit 56.': 56, '56 cinquante-quatre': 54, 'cinquante-quatre 56': 56
  };
  for (const [s, n] of Object.entries(cases)) assert.equal(parseSpoken(s), n, s);
});

test('mots parasites ignorés, DERNIER nombre complet renvoyé', () => {
  const cases = {
    'euh je crois que c’est cinquante-six': 56, 'cinquante-six cinquante-quatre': 54,
    'quarante-huit non cinquante-six': 56, 'quarante huit cinquante six': 56, 'sept fois huit cinquante-six': 56,
    'six cinquante-six': 56, '[unk] cinquante [unk]': 50, 'cinquante-six et voilà': 56, 'sept et huit': 8,
    'vingt-deux vingt': 20, 'cent cent vingt': 120, 'mille mille cent': 1100, 'deux mille deux mille': 2000,
    'cent deux cents': 200, 'trois quatre-vingts': 80, 'un deux trois': 3, 'et': null, 'et et': null
  };
  for (const [s, n] of Object.entries(cases)) assert.equal(parseSpoken(s), n, s);
  for (const s of ['', '   ', 'bonjour', '[unk]', 'je ne sais pas', null, undefined]) assert.equal(parseSpoken(s), null, String(s));
});

test('grammarFor : exactement les mots employés par toWords (force brute jusqu’à 999 999)', () => {
  const used = new Set();
  const checkpoints = new Set([0, 1, 16, 17, 20, 21, 79, 80, 81, 99, 100, 101, 199, 200, 999, 1000, 1001, 9999,
    79999, 80000, 99999, 100000, 999999]);
  for (let n = 0; n <= 999999; n++) {
    for (const w of words(toWords(n))) used.add(w);
    if (checkpoints.has(n)) assert.deepEqual([...grammarFor(n)].sort(), [...used].sort(), 'max = ' + n);
  }
  /* au-delà : mots de structure */
  const big = grammarFor(MAX);
  for (const w of ['million', 'millions', 'milliard', 'milliards']) assert.ok(big.includes(w), w);
  assert.ok(!grammarFor(1999999).includes('millions'));
  assert.ok(grammarFor(2000000).includes('millions'));
});

test('grammarFor(100) et grammarFor(1000) : uniquement des mots du lexique, sans doublon', () => {
  for (const max of [10, 100, 1000, 10000, 1000000, MAX]) {
    const g = grammarFor(max);
    assert.deepEqual(g.filter(w => !lex.has(w)), [], 'max = ' + max);
    assert.equal(new Set(g).size, g.length, 'doublons, max = ' + max);
  }
  assert.equal(grammarFor(100).length, 101);          /* zéro…quatre-vingt-dix-neuf + cent */
  assert.ok(grammarFor(100).includes('zéro') && grammarFor(100).includes('cent'));
  assert.ok(!grammarFor(100).includes('cents') && grammarFor(1000).includes('mille'));
  assert.deepEqual(grammarFor(-5), ['zéro']);
});

test('toWords / spell : entrées invalides', () => {
  for (const bad of [-1, 1.5, NaN, Infinity, MAX + 1, 'abc']) {
    assert.throws(() => toWords(bad), RangeError, String(bad));
    assert.throws(() => spell(bad), RangeError, String(bad));
  }
  assert.equal(toWords('42'), 'quarante-deux');
});
