/* Le Chef d’orchestre : logique pure (js/games/orchestre-logic.js) sur de vrais items du générateur fr.conjug. */
import { test, assert } from './_t.mjs';
import * as L from '../js/games/orchestre-logic.js';
import { gen } from '../js/content/fr/conjug.js';
import { TENSE_AT } from '../js/content/fr/verbs.js';
import { makeRng } from '../js/core/rng.js';

const KINDS = ['forme', 'terminaison', 'temps', 'accord', 'sujet', 'participe'];
/* échantillon : tous les sous-types sur toute l'échelle A (remédiation CP → fin de CM2) */
function sample(n = 1500, seed = 2026) {
  const rng = makeRng(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const A = (i % 57) / 10;                  /* 0 → 5,6 */
    const kind = i % 4 === 0 ? undefined : KINDS[i % KINDS.length];
    out.push(gen(A, rng, kind ? { kind } : {}));
  }
  return out;
}
const ITEMS = sample();
const fullOf = it => it.data.full || it.data.sentence.text;

test('tempo : 72 bpm, + 4 par réussite de suite, plafond 112', () => {
  assert.equal(L.tempoFor(0), 72);
  assert.equal(L.tempoFor(1), 76);
  assert.equal(L.tempoFor(5), 92);
  assert.equal(L.tempoFor(10), 112);
  assert.equal(L.tempoFor(25), 112);
  assert.equal(L.tempoFor(-3), 72);
  assert.equal(L.tempoFor(NaN), 72);
  assert.equal(L.tempoFor('3'), 84);
  assert.equal(Math.round(L.beatMs(72)), 833);
  assert.equal(L.beatMs(120), 500);
  assert.equal(Math.round(L.beatMs(0)), 833);
});

test('échantillon : les 6 sous-types sont couverts', () => {
  const seen = new Set(ITEMS.map(it => it.kind));
  for (const k of KINDS) assert.ok(seen.has(k), 'sous-type absent : ' + k);
});

test('phrase : les morceaux (trou rempli par la bonne réponse) redonnent exactement la phrase', () => {
  for (const it of ITEMS) {
    const m = L.sentenceModel(it);
    assert.equal(m.full, fullOf(it), it.key);
    assert.equal(L.sentenceText(m, m.slotText), fullOf(it), it.key);
    const mids = m.parts.filter(p => p.kind !== 'text');
    assert.equal(mids.length, 1, 'un seul trou ou verbe : ' + it.key);
    if (it.kind === 'temps') {
      assert.equal(m.mode, 'underline');
      assert.equal(mids[0].kind, 'verb');
      assert.equal(mids[0].text, it.data.form, it.key);
      const [a, b] = it.data.sentence.underline;
      assert.equal(it.data.sentence.text.slice(a, b), mids[0].text);
    } else {
      assert.equal(mids[0].kind, 'slot');
      assert.equal(m.mode, it.kind === 'terminaison' ? 'ending' : it.kind === 'sujet' ? 'subject' : 'slot');
      if (it.kind === 'terminaison') {
        assert.equal(mids[0].stem, it.data.stem);
        assert.equal(m.slotText, it.answer);
      }
    }
    for (const p of m.parts) if (p.kind === 'text') assert.ok(p.text.length > 0, 'morceau vide : ' + it.key);
  }
});

test('phrase : le sujet repéré est bien le sujet (ou le trou pour « sujet »)', () => {
  let flagged = 0;
  for (const it of ITEMS) {
    const m = L.sentenceModel(it);
    const subjText = m.parts.filter(p => p.subject).map(p => (p.kind === 'text' ? p.text : p.kind === 'verb' ? p.text : p.stem + m.slotText)).join('');
    if (!subjText) continue;
    flagged++;
    if (it.kind === 'sujet') {
      assert.ok(m.parts.find(p => p.kind === 'slot').subject, 'le trou est le sujet : ' + it.key);
      assert.equal(m.slotText.toLowerCase(), it.data.subject.toLowerCase());
    } else {
      const s = subjText.toLowerCase(), want = it.data.subject.toLowerCase();
      assert.ok(s === want || (want === 'je' && s === 'j’'), it.key + ' : « ' + s + ' » au lieu de « ' + want + ' »');
    }
  }
  assert.ok(flagged > ITEMS.length * 0.95, 'sujet repéré dans presque tous les items (' + flagged + ')');
});

test('phrase : découpe robuste (span absent ou incohérent, trou vide)', () => {
  const it = { kind: 'forme', answer: 'chante', choices: [{ label: 'chante', value: 'chante' }],
    data: { sentence: { before: 'Il ', after: ' fort.' }, subjectSpan: [40, 99] } };
  const m = L.sentenceModel(it);
  assert.equal(m.full, 'Il chante fort.');
  assert.ok(m.parts.every(p => !p.subject));
  const empty = L.sentenceModel({ kind: 'forme', answer: '', choices: [], data: { sentence: { before: 'Il ', after: ' fort.' } } });
  assert.deepEqual(empty.parts.map(p => p.kind), ['text', 'slot', 'text']);
  assert.equal(L.sentenceText(empty, '…'), 'Il … fort.');
  const none = L.sentenceModel({ kind: 'temps', data: {} });
  assert.equal(none.parts.filter(p => p.kind === 'verb').length, 1);
});

test('choix : 4 choix, une seule bonne réponse, le trou est assez large pour chacun', () => {
  for (const it of ITEMS) {
    const ch = L.choiceModel(it);
    assert.equal(ch.length, 4, it.key);
    assert.equal(ch.filter(c => L.isRight(it, c.value)).length, 1, it.key);
    const m = L.sentenceModel(it);
    const right = ch.find(c => L.isRight(it, c.value));
    if (it.kind === 'temps') assert.equal(right.fill, '');
    else {
      assert.equal(right.fill, m.slotText, it.key);
      assert.ok(L.slotLen(it) >= Math.max(...ch.map(c => c.fill.length)));
    }
    if (it.kind === 'terminaison') for (const c of ch) assert.equal(c.label, '-' + c.fill);
    if (it.kind === 'sujet') for (const c of ch) assert.equal(c.fill, c.label);
  }
});

test('consigne : l’étiquette du temps est isolée, jamais pour « temps »', () => {
  for (const it of ITEMS) {
    const parts = L.promptParts(it);
    assert.equal(parts.map(p => p.text ?? p.tense).join(''), it.prompt, it.key);
    const tags = L.tagsFor(it);
    const label = TENSE_AT[it.data.tense];
    if (it.kind === 'temps') {
      assert.ok(!parts.some(p => p.tense));
      assert.equal(tags.tense, null);
      assert.equal(tags.verb, null);
    }
    if (it.kind === 'forme' || it.kind === 'terminaison') {
      assert.deepEqual(parts.filter(p => p.tense).map(p => p.tense), [label], it.prompt);
      assert.equal(tags.verb, it.data.verb);
      assert.equal(tags.tense, null, 'pas de doublon de l’étiquette');
    }
    if (it.kind === 'accord' || it.kind === 'participe') assert.equal(tags.tense, label);
    if (it.kind === 'sujet') assert.deepEqual(tags, { verb: null, tense: null });
  }
});

test('mise en valeur sur le temps fort', () => {
  assert.equal(L.emphasisTarget({ kind: 'sujet' }), 'slot');
  assert.equal(L.emphasisTarget({ kind: 'temps' }), 'verb');
  assert.equal(L.emphasisTarget({ kind: 'accord' }, false), 'slot');
  assert.equal(L.emphasisTarget({ kind: 'accord' }, true), 'subject');
  for (const k of ['forme', 'terminaison', 'participe']) assert.equal(L.emphasisTarget({ kind: k }), 'subject');
});

test('partition : déterministe, pentatonique, chantante', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const a = L.makeScore(makeRng(seed), 12), b = L.makeScore(makeRng(seed), 12);
    assert.deepEqual(a, b);
    assert.equal(a.length, 12);
    for (let i = 0; i < a.length; i++) {
      assert.ok(Number.isInteger(a[i]) && a[i] >= 0 && a[i] <= L.SCORE_MAX, 'note hors gamme');
      if (i >= 2) assert.ok(!(a[i] === a[i - 1] && a[i] === a[i - 2]), 'trois fois la même note : ' + a.join(' '));
      if (i > 0) assert.ok(Math.abs(a[i] - a[i - 1]) <= 2 || i % 4 === 3, 'saut trop grand : ' + a.join(' '));
      if (i % 4 === 3) assert.ok([0, 2, 3].includes(a[i]), 'fin de mesure instable : ' + a.join(' '));
    }
  }
  assert.deepEqual(L.makeScore(makeRng(1), 0), []);
  assert.equal(L.makeScore(() => 0.5, 8).length, 8);
  assert.deepEqual(L.phraseOf([1, 2, 3, 4, 5, 6]), [3, 4, 5, 6]);
  assert.deepEqual(L.phraseOf([2]), [2]);
  assert.deepEqual(L.phraseOf(null), []);
});

test('portée en clé de sol : positions et lignes supplémentaires', () => {
  assert.equal(L.staffPos(0), 5);              /* do5 : 3e interligne */
  assert.equal(L.staffPos(1), 6);              /* ré5 : 4e ligne */
  assert.equal(L.staffPos(2), 7);              /* mi5 : 4e interligne */
  assert.equal(L.staffPos(3), 9);              /* sol5 : au-dessus de la portée */
  assert.equal(L.staffPos(4), 10);             /* la5 : 1re ligne supplémentaire */
  assert.equal(L.staffPos(5), 12);
  assert.deepEqual(L.ledgers(9), []);
  assert.deepEqual(L.ledgers(10), [10]);
  assert.deepEqual(L.ledgers(13), [10, 12]);
  assert.deepEqual(L.ledgers(-3), [-2]);
  for (let s = 0; s <= L.SCORE_MAX; s++) assert.ok(!L.stemUp(L.staffPos(s)), 'hampe vers le bas au-dessus du si4');
  assert.ok(L.stemUp(2));
});

test('fin de manche : plan de la mélodie rejouée', () => {
  const p = L.finalePlan([0, 1, 2, 3, 2, 1, 0, 2], 92);
  assert.equal(p.notes.length, 8);
  assert.ok(p.gap >= 300 && p.gap <= 460);
  for (let i = 1; i < p.notes.length; i++) assert.equal(p.notes[i].at - p.notes[i - 1].at, p.gap);
  assert.deepEqual(p.notes.filter(n => n.strong).map(n => n.idx), [0, 4]);
  assert.ok(p.chordAt > p.notes[7].at && p.end > p.chordAt);
  assert.deepEqual(p.chord, [0, 2, 3]);
  const none = L.finalePlan([], 72);
  assert.equal(none.notes.length, 0);
  assert.ok(none.end > 0);
  assert.ok(L.finalePlan([0], 112).gap >= 300);
});

test('gestes : battue à 4 temps, balancement alterné, musiciens de la mélodie', () => {
  assert.equal(L.batonAngle(0), L.BATON[0]);
  assert.equal(L.batonAngle(5), L.BATON[1]);
  assert.equal(L.batonAngle(-1), L.BATON[3]);
  assert.equal(L.swayAngle(0), -4);
  assert.equal(L.swayAngle(1), 4);
  assert.equal(L.swayAngle(2, 3), -3);
  assert.deepEqual([0, 1, 2, 3, 4].map(L.playerOf), [1, 2, 3, 1, 2]);
});
