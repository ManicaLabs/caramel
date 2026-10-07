/* Répondre à voix haute au Défi en famille et « Avec un copain » (js/core/battle-voice.js, v2.3) : clé sonore, choix trop
   proches, plan de chaque question (pavé : nombres de l'énoncé jamais faux ; choix : formes dites, toutes dans le lexique
   du modèle Vosk ; conjugation écrite → au doigt). */
import { test, assert } from './_t.mjs';
import * as B from '../js/core/battle-voice.js';
import { wordsOf, choiceGrammar, matchChoice } from '../js/core/voice-choice.js';
import { VOICE_FILLERS } from '../js/games/tables-logic.js';
import { makeRng } from '../js/core/rng.js';
import * as CONJ from '../js/content/fr/conjug.js';
import * as FAITS from '../js/content/maths/faits.js';
import * as PROC from '../js/content/maths/procedures.js';
import { TENSE_LABEL } from '../js/content/fr/verbs.js';
import { loadLexicon } from './lexicon.mjs';

const GRID = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.6];

test('soundOf : les homophones de la conjugaison ont la même clé, les autres non', () => {
  const same = (list, opts = { verb: true }) => {
    const k = B.soundOf(list[0], opts);
    for (const w of list) assert.equal(B.soundOf(w, opts), k, w + ' ≠ ' + list[0]);
  };
  same(['mangeais', 'mangeait', 'mangeaient', 'mangeai']);
  same(['mange', 'manges', 'mangent']);
  same(['manger', 'mangé', 'mangez', 'mangée', 'mangées']);
  same(['finis', 'finit']);
  same(['mangerons', 'mangeront']);
  same(['viens', 'vient']);
  same(['allé', 'allée', 'allés', 'allées']);
  same(['a', 'as']);
  same(['achète', 'achètes', 'achètent']);
  same(['il', 'ils'], {});
  same(['elle', 'elles'], {});
  const differ = (a, b, opts = { verb: true }) => assert.notEqual(B.soundOf(a, opts), B.soundOf(b, opts), a + ' = ' + b);
  differ('mangeons', 'mangions');
  differ('finis', 'finissent');
  differ('pris', 'prise');
  differ('fait', 'faite');
  differ('viens', 'viennent');
  differ('sommes', 'sont');
  differ('nous', 'vous', {});
  differ('présent', 'imparfait', {});
  differ('les voisines', 'les voisins', {});
  assert.equal(B.soundOf('présent'), 'prEzA~', '« -ent » prononcé hors des verbes');
});

test('tooClose : même clé, ou une forme qui commence l’autre mot pour mot', () => {
  assert.ok(B.tooClose('il', 'ils'));
  assert.ok(B.tooClose('quatre', 'quatre cents'), 'un résultat partiel « quatre » viendrait avant « cents »');
  assert.ok(B.tooClose('le chat', 'le chat de Léa'));
  assert.ok(!B.tooClose('passé simple', 'passé composé'));
  assert.ok(!B.tooClose('quarante', 'quatre cents'));
  assert.ok(!B.tooClose('quatre cents', 'quatre mille'));
  assert.ok(B.tooClose('', 'rien'), 'une forme vide ne se dit pas');
});

test('voicePlan : tables — réponse, nombres de l’énoncé ignorés, voix jusqu’à 1 000', () => {
  let n = 0;
  for (const A of GRID) for (let s = 0; s < 60; s++) {
    const it = FAITS.gen(A, makeRng('t' + s + '|' + A));
    const p = B.voicePlan(Object.assign({ axis: 'ma.faits' }, it));
    assert.equal(p.mode, 'number');
    assert.equal(p.answer, Number(it.answer));
    const v = Number(it.answer);
    assert.equal(p.voice, Number.isInteger(v) && v >= 0 && v <= 1000 && !(it.data && it.data.voice === false), it.prompt);
    if (it.data && it.data.op && it.data.op !== 'double' && it.data.op !== 'moitié') {
      for (const k of ['a', 'b', 'c']) {
        const x = it.data[k];
        if (Number.isFinite(x) && x !== v) assert.ok(p.ignore.includes(x), it.prompt + ' : ' + x + ' pas ignoré');
      }
    }
    assert.ok(!p.ignore.includes(v) || [it.data && it.data.a, it.data && it.data.b, it.data && it.data.c].filter(x => x === v).length > 1
      || (it.data && (it.data.op === 'double' || it.data.op === 'moitié')), 'la réponse n’est jamais ignorée (sauf si l’énoncé l’écrit) : ' + it.prompt);
    n++;
  }
  assert.ok(n > 500);
});

test('voicePlan : calcul éclair — pavé entier (≤ 999 : un seul essai) ou estimation dite par des nombres bien distincts', () => {
  let est = 0, estVoice = 0, pad = 0, padVoice = 0;
  for (const A of GRID) for (let s = 0; s < 80; s++) {
    const it = PROC.gen(A, makeRng('p' + s + '|' + A));
    const item = Object.assign({ axis: 'ma.procedures' }, it);
    const p = B.voicePlan(item);
    if (Array.isArray(it.choices) && it.choices.length) {
      est++;
      assert.equal(p.mode, 'choices');
      assert.equal(p.list.length, it.choices.length);
      if (p.voice) {
        estVoice++;
        /* le bon choix, dit en toutes lettres, est reconnu, et lui seul */
        const right = p.list.find(c => Number(c.value) === Number(it.answer));
        assert.ok(right, it.prompt);
        const said = wordsOf(String(right.num)).length ? B.soundOf(String(right.num)) : '';
        assert.ok(said);
      }
      continue;
    }
    pad++;
    assert.equal(p.mode, 'number');
    const v = Number(it.answer);
    assert.equal(p.voice, Number.isInteger(v) && v >= 0 && v <= B.NUMBER_VOICE_MAX, it.prompt);
    if (p.voice) padVoice++;
    for (const x of B.promptNumbers(it.prompt)) assert.ok(p.ignore.includes(x));
  }
  console.log(`    calcul éclair à la voix : pavé ${padVoice}/${pad} · estimation ${estVoice}/${est}`);
  assert.ok(pad > 0 && padVoice / pad > 0.4, 'une bonne part des calculs se disent');
});

test('answerPieces : morceaux d’une réponse ≥ 100 (« cent » mal entendu), jamais la réponse elle-même', () => {
  assert.deepEqual(B.answerPieces(172), [1, 52, 72]);
  assert.deepEqual(B.answerPieces(500), [5, 50]);
  assert.deepEqual(B.answerPieces(806), [6, 8, 56]);
  assert.deepEqual(B.answerPieces(3471), [3, 4, 51, 71, 471]);
  assert.deepEqual(B.answerPieces(100), [1, 50]);
  assert.deepEqual(B.answerPieces(99), []);
  assert.deepEqual(B.answerPieces(2.5), []);
  for (let v = 100; v < 20000; v += 37) assert.ok(!B.answerPieces(v).includes(v));
  const p = B.voicePlan({ axis: 'ma.procedures', prompt: '4 × 43 = …', answer: 172 });
  assert.deepEqual(p.ignore, [4, 43, 1, 52, 72]);
});

test('promptNumbers : nombres de l’énoncé, milliers et décimaux compris', () => {
  assert.deepEqual(B.promptNumbers('3 400 + 600 = …'), [3400, 600]);
  assert.deepEqual(B.promptNumbers('2,5 × 4 = …'), [2.5, 4]);
  assert.deepEqual(B.promptNumbers('12\u202F000 − 1 = …'), [12000, 1]);
});

test('voicePlan : conjugaison — temps et sujets à la voix (mots du lexique), le reste au doigt', () => {
  const lex = loadLexicon();
  const st = {};
  for (const A of GRID) for (let s = 0; s < 120; s++) {
    const it = CONJ.gen(A, makeRng('c' + s + '|' + A));
    const p = B.voicePlan(it);
    const k = it.kind;
    st[k] = st[k] || { n: 0, voice: 0 };
    st[k].n++;
    assert.equal(p.mode, 'choices');
    assert.deepEqual(p.list.map(c => c.value), it.choices.map(c => c.value), 'mêmes choix, même ordre');
    if (!B.SPOKEN_CONJ.includes(k)) { assert.equal(p.voice, false); assert.equal(p.why, 'written'); continue; }
    if (!p.voice) { assert.ok(p.why === 'same' || p.why === 'unheard', p.why); continue; }
    st[k].voice++;
    /* formes dites : toutes dans le lexique (sinon Vosk ne les reconnaîtrait jamais), grammaire comprise */
    for (const w of choiceGrammar(p.list, VOICE_FILLERS)) assert.ok(lex.has(w), w + ' : hors du lexique (' + it.prompt + ')');
    /* chaque choix, dit seul, désigne ce choix-là */
    for (const c of p.list) for (const f of c.say) assert.equal(String(matchChoice(f, p.list).value), String(c.value), f);
  }
  console.log('    conjugaison à la voix : ' + Object.entries(st).map(([k, v]) => k + ' ' + v.voice + '/' + v.n).join(' · '));
  assert.ok(st.temps && st.temps.voice === st.temps.n, 'les noms des temps se disent toujours');
  assert.ok(st.sujet && st.sujet.voice / st.sujet.n > 0.8, 'les sujets se disent presque toujours');
});

test('voicePlan : sujets — il / ils, elle / elles proposés ensemble → au doigt', () => {
  const p = B.voicePlan({ axis: 'fr.conjug', kind: 'sujet', choices: ['il', 'ils', 'nous', 'tu'].map(t => ({ label: t, value: t })) });
  assert.equal(p.voice, false);
  assert.equal(p.why, 'same');
  const q = B.voicePlan({ axis: 'fr.conjug', kind: 'sujet', choices: ['Léa', 'ils', 'nous', 'tu'].map(t => ({ label: t, value: t })) });
  assert.equal(q.voice, true);
});

test('TENSE_SAY : les noms des temps de verbs.js, tous dans le lexique', () => {
  const lex = loadLexicon();
  for (const [t, label] of Object.entries(TENSE_LABEL)) {
    assert.ok(B.TENSE_SAY[t], t);
    assert.equal(B.TENSE_SAY[t][0], label);
    for (const f of B.TENSE_SAY[t]) for (const w of wordsOf(f)) assert.ok(lex.has(w), w);
  }
});

test('sujets possibles du générateur : tous les mots dans le lexique', () => {
  const lex = loadLexicon();
  const I = CONJ._internals;
  const pools = [I.NAMES, I.KIDS, I.ADULTS, ...Object.values(I.P).flatMap(p => [p.gn || [], p.cdn || []])];
  const miss = new Set();
  for (const pool of pools) for (const s of pool) for (const w of wordsOf(s && s.t)) if (!lex.has(w)) miss.add(w);
  for (const w of ['je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles']) if (!lex.has(w)) miss.add(w);
  assert.deepEqual([...miss].sort(), [...B.UNHEARD].sort(), 'mots de sujets hors du lexique : tenir UNHEARD à jour');
});

test('voicePlan : question inconnue ou vide → rien', () => {
  assert.deepEqual(B.voicePlan(null), { mode: 'none' });
  assert.deepEqual(B.voicePlan({ axis: 'fr.fluence' }), { mode: 'none' });
});
