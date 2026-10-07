/* L’Atelier des opérations — répondre à voix haute (v2.3) : partie pure de js/games/operations-logic.js
   (voiceTarget, voiceVerdict, voiceTotalNote, textNumbers), confrontée au vrai générateur ma.operations et au juge
   des tables (createVoiceJudge) sur les phrases mesurées avec Vosk (« huit, je retiens un » → « huit je vingt-et-un »). */
import { test, assert } from './_t.mjs';
import { makeRng } from '../js/core/rng.js';
import { gen, fromKey } from '../js/content/maths/operations.js';
import { createVoiceJudge, CONFIRM_MS, STABLE_MS } from '../js/games/tables-logic.js';
import {
  textNumbers, voiceTarget, voiceVerdict, voiceTotalNote, VOICE_BLEED_MS, VOICE_REPEAT_MS
} from '../js/games/operations-logic.js';

function sample() {
  const out = [];
  for (const subMethod of ['compensation', 'cassage']) {
    for (let i = 0; i <= 56; i += 2) {
      const rng = makeRng('ops-voice-' + subMethod + '-' + i);
      for (let k = 0; k < 8; k++) out.push(gen(i / 10, rng, { subMethod }));
    }
  }
  return out;
}
const ITEMS = sample();

test('textNumbers : milliers en espace fine, décimaux, pas de fusion sur une espace ordinaire', () => {
  assert.deepEqual(textNumbers('Dans 9\u202f456, combien de fois 7\u202f?'), [9456, 7]);
  assert.deepEqual(textNumbers('4,56\u00a0€ + 15,30\u00a0€'), [4.56, 15.3]);
  assert.deepEqual(textNumbers('Unités\u202f: 8 + 6 + 1 de retenue.'), [8, 6, 1]);
  assert.deepEqual(textNumbers('fois 9 100'), [9, 100]);
  assert.deepEqual(textNumbers(''), []);
  assert.deepEqual(textNumbers(null), []);
});

test('voiceTarget sur le vrai générateur : chaque question attend un chiffre, jamais ignoré', () => {
  let asked = 0, totals = 0, carries = 0;
  for (const it of ITEMS) {
    for (const st of it.data.steps) {
      const t = voiceTarget(st, { item: it });
      if (!st.ask) { assert.equal(t.voice, false, it.key + ' ' + st.id); continue; }
      asked++;
      assert.equal(t.voice, true, it.key + ' ' + st.id);
      assert.equal(t.answer, Number(st.expect));
      assert.ok(t.answer >= 0 && t.answer <= 9);
      assert.ok(!t.ignore.includes(t.answer), 'la réponse n’est jamais ignorée ' + it.key + ' ' + st.id);
      assert.ok(t.ignore.every(Number.isFinite));
      for (const n of textNumbers(st.prompt)) if (n !== t.answer) assert.ok(t.ignore.includes(n), 'nombre de la question ignoré ' + st.prompt);
      for (const n of textNumbers(it.prompt)) if (n !== t.answer) assert.ok(t.ignore.includes(n), 'nombre de l’opération ignoré ' + it.prompt);
      if (st.type === 'count' && t.answer !== 6) assert.ok(t.ignore.includes(6), '« chiffres » entendu « six »');
      if (t.total !== null) {
        totals++;
        assert.ok(t.total >= 10 && t.total <= 99, 'total ' + t.total);
        assert.equal(t.total % 10, t.answer, 'je pose le chiffre des unités du total ' + st.say);
        assert.equal(t.carry, Math.floor(t.total / 10), 'retenue = dizaines du total ' + st.say);
      }
      if (t.carry !== null) carries++;
    }
  }
  assert.ok(asked > 1000 && totals > 100 && carries > 100, `échantillon : ${asked} questions, ${totals} totaux, ${carries} retenues`);
});

test('voiceTarget : la question précédente (chiffre, retenue) n’est jamais fausse, sauf si c’est la réponse', () => {
  const it = fromKey('ma.operations:add:5983+167', 5.6);
  const asks = it.data.steps.filter(s => s.ask);
  const a = voiceTarget(asks[0], { item: it });                 /* 3 + 7 = 10 : je pose 0, je retiens 1 */
  assert.equal(a.answer, 0);
  assert.equal(a.total, 10);
  assert.equal(a.carry, 1);
  const b = voiceTarget(asks[1], { item: it, prev: { expect: a.answer, carry: a.carry } });
  assert.ok(b.ignore.includes(0) && b.ignore.includes(1));
  const c = voiceTarget({ ask: true, type: 'digit', expect: '1', prompt: 'Combien\u202f?', say: '' }, { prev: { expect: 1, carry: 1 } });
  assert.equal(c.answer, 1);
  assert.ok(!c.ignore.includes(1));
  assert.equal(voiceTarget({ ask: true, type: 'digit', expect: '12' }).voice, false);
  assert.equal(voiceTarget(null).voice, false);
});

test('voiceTarget : combien de chiffres ? « six » ignoré, sauf si le quotient en a six', () => {
  assert.ok(voiceTarget({ ask: true, type: 'count', expect: '3', prompt: 'Avant de commencer\u202f: combien de chiffres aura le quotient\u202f?' }).ignore.includes(6));
  assert.ok(!voiceTarget({ ask: true, type: 'count', expect: '6', prompt: '' }).ignore.includes(6));
  assert.ok(!voiceTarget({ ask: true, type: 'quotient', expect: '3', prompt: 'Dans 25, combien de fois 8\u202f?' }).ignore.includes(6));
});

test('voiceVerdict : juste, autre chiffre (essai faux), total salué, grand nombre jamais faux', () => {
  const target = { answer: 4, ignore: [5, 9], total: 14, carry: 1 };
  assert.equal(voiceVerdict(4, true, { target, now: 10000 }), 'right');
  assert.equal(voiceVerdict(7, false, { target, now: 10000 }), 'digit');
  assert.equal(voiceVerdict(0, false, { target, now: 10000 }), 'digit');
  assert.equal(voiceVerdict(14, false, { target, now: 10000 }), 'total');
  assert.equal(voiceVerdict(15, false, { target, now: 10000 }), 'other');
  assert.equal(voiceVerdict(22, false, { target, now: 10000 }), 'other');   /* « il y va deux fois » → « vingt-deux » */
  assert.equal(voiceVerdict(100, false, { target, now: 10000 }), 'other');  /* « cinq » → « cent » */
  assert.equal(voiceVerdict(14, false, { target: { ...target, total: null }, now: 10000 }), 'other');
  assert.equal(voiceVerdict(null, false, { target, now: 10000 }), 'drop');
  assert.equal(voiceVerdict(NaN, true, { target, now: 10000 }), 'drop');
});

test('voiceVerdict : la fin de la phrase précédente est oubliée (retenue, grand nombre, chiffre répété)', () => {
  const target = { answer: 1, ignore: [], total: null, carry: null };
  const last = { at: 10000, expect: 8, carry: 1 };
  /* « huit, je retiens un » : « un » juste pour la question suivante, entendu 0,9 s après → oublié */
  assert.equal(voiceVerdict(1, true, { target, last, now: 10000 + 900 + CONFIRM_MS }), 'drop');
  /* « … je vingt-et-un » : 21 stable 1,5 s, entendu 0,9 s après → oublié (pas de « c'est juste », rien) */
  assert.equal(voiceVerdict(21, false, { target, last, now: 10000 + 900 + STABLE_MS }), 'drop');
  /* au-delà de la fenêtre : une vraie réponse */
  assert.equal(voiceVerdict(1, true, { target, last, now: 10000 + VOICE_BLEED_MS + CONFIRM_MS + 1 }), 'right');
  assert.equal(voiceVerdict(21, false, { target, last, now: 10000 + VOICE_BLEED_MS + STABLE_MS + 1 }), 'other');
  /* « huit… huit » : le chiffre précédent répété aussitôt → oublié ; redit une seconde plus tard → réponse */
  const t8 = { answer: 8, ignore: [], total: null, carry: null };
  assert.equal(voiceVerdict(8, true, { target: t8, last, now: 10000 + 500 + CONFIRM_MS }), 'drop');
  assert.equal(voiceVerdict(8, true, { target: t8, last, now: 10000 + VOICE_REPEAT_MS + CONFIRM_MS + 1 }), 'right');
  /* un autre chiffre, même aussitôt, reste une réponse */
  assert.equal(voiceVerdict(3, false, { target, last, now: 10000 + 200 + STABLE_MS }), 'digit');
});

test('juge des tables + voiceVerdict sur les phrases mesurées (Vosk) : pas de faux injuste, pas de débordement', () => {
  const it = fromKey('ma.operations:add:65+29', 5.6);
  const [s1, s2] = it.data.steps.filter(s => s.ask);         /* 5 + 9 = 14 → 4, retiens 1 ; 6 + 2 + 1 = 9 */
  const t1 = voiceTarget(s1, { item: it });
  /* « quatre, je retiens un » entendu « quatre je vingt-et-un » : 4 juste au bout de 0,35 s */
  const j1 = createVoiceJudge({ answer: t1.answer, ignore: t1.ignore });
  j1.feed('quatre', false, 0);
  const ev = j1.tick(CONFIRM_MS);
  assert.equal(ev.kind, 'right');
  const now1 = CONFIRM_MS;
  assert.equal(voiceVerdict(ev.value, true, { target: t1, now: now1 }), 'right');
  const last = { at: now1, expect: t1.answer, carry: t1.carry };
  /* question suivante : la fin de la phrase (« vingt-et-un », puis « un ») arrive 0,9 s après */
  const t2 = voiceTarget(s2, { item: it, prev: last });
  const j2 = createVoiceJudge({ answer: t2.answer, ignore: t2.ignore });
  j2.feed('vingt-et-un', false, 1250);
  const ev2 = j2.tick(1250 + STABLE_MS);
  assert.equal(ev2.kind, 'wrong');                            /* le juge seul le compterait faux… */
  assert.equal(voiceVerdict(ev2.value, false, { target: t2, last, now: 1250 + STABLE_MS }), 'drop');   /* …pas l'atelier */
  const j3 = createVoiceJudge({ answer: t2.answer, ignore: t2.ignore });
  assert.equal(j3.feed('un', true, 1300).ignored, true);      /* la retenue dite n'est jamais fausse */
  /* « neuf » ensuite : juste */
  const j4 = createVoiceJudge({ answer: t2.answer, ignore: t2.ignore });
  const ev4 = j4.feed('neuf', true, 4000);
  assert.equal(ev4.kind, 'right');
  assert.equal(voiceVerdict(ev4.value, true, { target: t2, last, now: 4000 }), 'right');
  /* « quinze » à la place de « quatre » : le total est salué, jamais compté faux */
  const j5 = createVoiceJudge({ answer: t1.answer, ignore: t1.ignore });
  j5.feed('quinze', false, 0);
  assert.equal(voiceVerdict(j5.tick(STABLE_MS).value, false, { target: t1, now: STABLE_MS }), 'other');
  const j6 = createVoiceJudge({ answer: t1.answer, ignore: t1.ignore });
  j6.feed('quatorze', false, 0);
  assert.equal(voiceVerdict(j6.tick(STABLE_MS).value, false, { target: t1, now: STABLE_MS }), 'total');
});

test('voiceTotalNote : nombre écrit en lettres, espaces fines', () => {
  assert.equal(voiceTotalNote(15), 'Quinze, c’est juste\u202f! Mais dans la case, on n’écrit qu’un chiffre.');
  assert.ok(voiceTotalNote(45).startsWith('Quarante-cinq, c’est juste'));
  assert.ok(!/[ \u00a0][!?:]/.test(voiceTotalNote(71)), 'pas d’espace ordinaire avant ! : ?');
});

test('VOICE_WORDS (v2.3) : mots autour du chiffre, tous dans le lexique du modèle, aucun nombre', async () => {
  const { loadLexicon } = await import('./lexicon.mjs');
  const { parseSpoken } = await import('../js/core/numbers-fr.js');
  const L2 = await import('../js/games/operations-logic.js');
  const lex = loadLexicon();
  for (const w of L2.VOICE_WORDS) { assert.ok(lex.has(w), w + ' : hors du lexique'); assert.equal(parseSpoken(w), null, w); }
});
