/* Répondre à voix haute parmi des choix (js/core/voice-choice.js, v2.3) : mots, grammaire, choix dit en dernier, juge. */
import { test, assert } from './_t.mjs';
import * as V from '../js/core/voice-choice.js';
import { loadLexicon } from './lexicon.mjs';

test('wordsOf : comme les mots de Vosk (minuscules, apostrophe droite, ponctuation retirée)', () => {
  assert.deepEqual(V.wordsOf('J’ai  MANGÉ, « vite » !'), ["j'ai", 'mangé', 'vite']);
  assert.deepEqual(V.wordsOf('quatre-vingt-dix'), ['quatre-vingt-dix']);
  assert.deepEqual(V.wordsOf(''), []);
});

test('matchChoice : le choix dit en dernier, sur ses mots distinctifs ; ambigu → rien', () => {
  const conj = [{ value: 'a', say: ['nous mangions'] }, { value: 'b', say: ['nous mangerons'] }, { value: 'c', say: ['nous mangeons'] }];
  assert.equal(V.matchChoice('euh nous mangerons', conj).value, 'b');
  assert.equal(V.matchChoice('mangerons', conj).value, 'b', 'le sujet commun ne départage rien : pas besoin de le dire');
  assert.equal(V.matchChoice('nous mangions non nous mangeons', conj).value, 'c', 'l’enfant se corrige : le dernier compte');
  assert.equal(V.matchChoice('nous', conj), null);
  assert.equal(V.matchChoice('', conj), null);
  const frac = [{ value: '3/4', say: ['trois quarts'] }, { value: '1/4', say: ['un quart'] }, { value: '3/2', say: ['trois demis'] }];
  assert.equal(V.matchChoice('trois', frac), null, '« trois » seul ne tranche pas');
  assert.equal(V.matchChoice('trois quarts', frac).value, '3/4');
  const nums = [{ value: 40, num: 40 }, { value: 400, num: 400 }, { value: 4000, num: 4000 }];
  assert.equal(V.matchChoice('quatre cents', nums).value, 400);
  assert.equal(V.matchChoice('je dirais quarante', nums).value, 40);
  assert.equal(V.matchChoice('quatre mille', nums).value, 4000);
});

test('choiceGrammar : formes dites + nombres + mots d’appoint, tous connus du modèle', () => {
  const lex = loadLexicon();
  const g = V.choiceGrammar([{ value: 'a', say: ['nous mangions'] }, { value: 3, num: 3000 }], ['euh']);
  for (const w of ['nous', 'mangions', 'trois', 'mille', 'euh']) assert.ok(g.includes(w), w);
  for (const w of g) assert.ok(lex.has(w), w + ' : hors du lexique');
});

test('createChoiceJudge : résultat final → tout de suite ; partiel → stable 0,6 s ; une seule fois', () => {
  const j = V.createChoiceJudge([{ value: 'a', say: ['mangeais'] }, { value: 'b', say: ['mange'] }]);
  assert.deepEqual(j.feed('mange', false, 0), { kind: 'heard', value: 'b', due: V.CHOICE_CONFIRM_MS });
  assert.deepEqual(j.feed('mangeais', false, 200), { kind: 'heard', value: 'a', due: 200 + V.CHOICE_CONFIRM_MS }, '« mange » ne valait pas encore');
  assert.deepEqual(j.tick(500), { kind: 'none', due: 200 + V.CHOICE_CONFIRM_MS });
  assert.deepEqual(j.tick(900), { kind: 'pick', value: 'a', at: 200 });
  assert.deepEqual(j.feed('mangeais', true, 950), { kind: 'none' }, 'déjà choisi');
  j.reset();
  assert.deepEqual(j.feed('euh mange', true, 1000), { kind: 'pick', value: 'b', at: 1000 }, 'résultat final : tout de suite');
});
