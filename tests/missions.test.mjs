/* Les Missions du ranch — logique pure (js/games/missions-logic.js), confrontée au vrai générateur ma.problemes. */
import { test, assert } from './_t.mjs';
import { readFileSync } from 'node:fs';
import { makeRng } from '../js/core/rng.js';
import { gen } from '../js/content/maths/problemes.js';
import { GAME_BY_ID, AXIS_GAME, gamesFor, mancheSize } from '../js/games/index.js';
import { hasGenerator } from '../js/content/index.js';
import {
  INTRO, SCHEMA_SAY, STEP_TITLES, chunks, readLines, fullText, answerMode, choicesOf, answerInfo, stepOf, checkTyped,
  checkChoice, stepMessage, idleText, voicePlan, voiceVerdict, schemaAllowed, solvedSchema, schemaLayout, explainSteps,
  explainSpeech
} from '../js/games/missions-logic.js';

const ITEMS = [];
for (let i = 0; i <= 56; i += 2) {
  const rng = makeRng('mi-' + i);
  for (let k = 0; k < 25; k++) ITEMS.push(gen(i / 10, rng));
}

test('registre : jeu 7, axe ma.problemes, dès le CP, manche courte', () => {
  const g = GAME_BY_ID.missions;
  assert.ok(g);
  assert.equal(g.primary, 'ma.problemes');
  assert.equal(AXIS_GAME['ma.problemes'], 'missions');
  assert.ok(hasGenerator('ma.problemes'));
  assert.ok(gamesFor('CP').some(x => x.id === 'missions'));
  assert.deepEqual([mancheSize('missions', 10), mancheSize('missions', 15), mancheSize('missions', 20)], [4, 5, 6]);
  const src = readFileSync('js/games/missions.js', 'utf8');
  assert.match(src, /id: 'missions'/);
  assert.match(src, /intro: true/, 'se présente lui-même');
  assert.match(src, /ctx\.petSVG\(/);
  assert.match(src, /createVoiceAnswer\(ctx/);
  assert.doesNotMatch(src, /\bmountSVG\s*\(/);
});

test('énoncé : nombres mis en valeur sans rien perdre du texte', () => {
  assert.deepEqual(chunks('Il y a 12\u00A0poules et 1\u202F500\u00A0€.'), [
    { k: 'txt', t: 'Il y a ' }, { k: 'num', t: '12' }, { k: 'txt', t: '\u00A0poules et ' }, { k: 'num', t: '1\u202F500\u00A0€' }, { k: 'txt', t: '.' }]);
  assert.deepEqual(chunks('à 14\u00A0h\u00A005 ; 2,50\u00A0€').filter(c => c.k === 'num').map(c => c.t), ['14\u00A0h\u00A005', '2,50\u00A0€']);
  for (const it of ITEMS) {
    const lines = readLines(it);
    assert.equal(lines.length, it.data.sentences.length + 1);
    assert.equal(lines[lines.length - 1], it.data.question);
    for (const l of lines) assert.equal(chunks(l).map(c => c.t).join(''), l);
    assert.equal(fullText(it), it.prompt);
  }
});

test('mode de réponse : 6 choix (Repères) ou pavé ; coup de pouce → 6 choix', () => {
  for (const it of ITEMS) {
    const m = answerMode(it);
    assert.equal(m, it.data.mode);
    if (m === 'choices') assert.equal(choicesOf(it).length, 6);
    const assisted = { ...it, assist: true };
    assert.equal(answerMode(assisted), 'choices');
    assert.equal(choicesOf(assisted).length, 6);
  }
  assert.ok(ITEMS.some(it => answerMode(it) === 'keypad') && ITEMS.some(it => answerMode(it) === 'choices'));
});

test('saisie : juste, faux, résultat intermédiaire jamais faux, décimaux', () => {
  for (const it of ITEMS) {
    const info = answerInfo(it);
    assert.equal(checkTyped(info.raw, it).ok, true, it.key);
    assert.equal(checkChoice(it.answer, it).ok, true);
    const wrong = it.data.choices.find(c => !checkChoice(c.value, it).ok && !stepOf(it, c.value));
    if (wrong) assert.equal(checkChoice(wrong.value, it).ok, false);
    for (const s of it.data.inter) {
      const r = checkTyped(String(s.v).replace('.', ','), it);
      assert.equal(r.ok, false);
      assert.ok(r.step, 'étape reconnue : ' + it.key);
      const msg = stepMessage(it, r.step);
      assert.match(msg, /^Bien ! .+\. Et maintenant \?$/);
    }
  }
  const it = gen(2.4, makeRng('dec'), { kind: 'achats' });
  const info = answerInfo(it);
  assert.equal(info.decimal, true);
  assert.equal(checkTyped(info.raw, it).ok, true);
  assert.equal(checkTyped(info.raw.replace(',', '.'), it).ok, true);
  assert.equal(checkTyped('abc', it).valid, false);
  assert.equal(checkTyped('', it).valid, false);
  assert.equal(idleText('choices'), 'Touche la bonne réponse.');
  assert.match(idleText('keypad', true), /dis ou tape/);
});

test('voix : les nombres de l’énoncé ne comptent jamais faux ; aux 6 choix, seul un choix proposé est faux', () => {
  for (const it of ITEMS) {
    const plan = voicePlan(it, { prev: 3 });
    assert.ok(!plan.ignore.includes(it.answer));
    for (const n of it.data.numbers) if (n !== it.answer) assert.ok(plan.ignore.includes(n), it.key);
    if (it.data.useless !== null) assert.ok(plan.ignore.includes(it.data.useless));
    assert.equal(plan.voice, !it.data.decimals && Number.isInteger(it.answer) && it.answer <= 99999);
    assert.equal(voiceVerdict(it.answer, it, answerMode(it), plan), 'right');
    for (const n of it.data.numbers) if (n !== it.answer && !stepOf(it, n)) assert.equal(voiceVerdict(n, it, 'keypad', plan), 'skip');
    for (const s of it.data.inter) assert.equal(voiceVerdict(s.v, it, 'keypad', plan), 'step');
    if (answerMode(it) === 'choices') {
      const outside = 987654;
      assert.equal(voiceVerdict(outside, it, 'choices', plan), 'skip', 'un nombre hors des choix ne compte pas');
      for (const c of it.data.choices) {
        const v = voiceVerdict(c.value, it, 'choices', plan);
        assert.ok(['right', 'wrong', 'skip', 'step'].includes(v));
      }
    } else if (plan.voice) {
      assert.equal(voiceVerdict(987654, it, 'keypad', plan), 'wrong');
    }
  }
  assert.equal(voiceVerdict(NaN, ITEMS[0], 'keypad'), 'skip');
});

test('schéma en barres : dès le CE1, géométrie dans le cadre, inconnue marquée, schéma complété', () => {
  for (const it of ITEMS) {
    assert.equal(schemaAllowed('CP', it), false, 'pas au CP (le programme l’écrit à partir du CE1)');
    assert.equal(schemaAllowed('CE1', it), true);
    for (const W of [300, 360, 520]) {
      const lay = schemaLayout(it.data.schema, W, { font: 15 });
      assert.ok(lay.h > 20 && lay.h < 320, it.key + ' hauteur ' + lay.h);
      for (const x of lay.items) {
        if (x.type === 'seg' || x.type === 'cell') {
          assert.ok(x.x >= 0 && x.x + x.w <= W + 1, `${it.key} : barre hors cadre (${x.x} + ${x.w} > ${W})`);
          assert.ok(x.w >= 4 && x.y >= 0 && x.y + x.h <= lay.h + 1, it.key);
        }
        if (x.type === 'brace') assert.ok(x.x1 >= 0 && x.x2 <= W + 1 && x.y - 20 >= 0, it.key + ' accolade');
      }
      assert.ok(lay.items.some(x => x.q) || it.data.schema.grid, 'un « ? » : ' + it.key);
    }
    const solved = solvedSchema(it.data.schema, it);
    const lay = schemaLayout(solved, 360);
    assert.ok(!lay.items.some(x => x.q), 'plus de « ? » une fois complété : ' + it.key);
  }
});

test('explication : les quatre phases du programme, dans l’ordre', () => {
  assert.deepEqual(STEP_TITLES.map(s => s.title), ['Comprendre', 'Modéliser', 'Calculer', 'Répondre']);
  for (const it of ITEMS) {
    const steps = explainSteps(it);
    assert.equal(steps.length, 4);
    for (const s of steps) assert.ok(s.text.length > 3, it.key + ' ' + s.key);
    assert.ok(steps[2].text.includes('=') || /minutes$/.test(steps[2].text), 'calcul : ' + steps[2].text);
    assert.equal(steps[3].text, it.data.answerText);
    assert.ok(explainSpeech(it).length > 20);
  }
  assert.match(INTRO, /mission/);
  assert.match(SCHEMA_SAY, /point d’interrogation/);
});
