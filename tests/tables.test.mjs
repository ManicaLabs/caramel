/* Le Galop des tables — logique pure (js/games/tables-logic.js), confrontée au vrai générateur ma.faits. */
import { test, assert } from './_t.mjs';
import { makeRng } from '../js/core/rng.js';
import { fmtNum } from '../js/core/util.js';
import { toWords } from '../js/core/numbers-fr.js';
import { gen } from '../js/content/maths/faits.js';
import {
  HOLE, VOICE_MAX, STABLE_MS, CONFIRM_MS, GROUND_SPEED, BRAKE_PX,
  voiceGrammar, promptParts, promptText, promptAria, shownNumbers, answerInfo, checkTyped, holeChars,
  heardLabel, createVoiceJudge, hintVisual, frameCells, cruiseRate, brakeRate, rushRate, approachSeconds, comboLabel
} from '../js/games/tables-logic.js';

/* échantillon large : A de 0 à 5,6 (pas 0,1) × 40 graines */
function sample() {
  const out = [];
  for (let i = 0; i <= 56; i++) {
    const A = i / 10;
    const rng = makeRng('tables-' + i);
    for (let k = 0; k < 40; k++) out.push(gen(A, rng));
  }
  return out;
}
const ITEMS = sample();
const NNBSP = String.fromCharCode(0x202f);

test('promptParts : une seule case, à la place de data[hole], énoncé identique à item.prompt', () => {
  const kinds = new Set();
  for (const it of ITEMS) {
    kinds.add(it.kind);
    const parts = promptParts(it);
    assert.equal(parts.filter(p => p.k === 'hole').length, 1, it.prompt);
    if (it.data.op === 'double' || it.data.op === 'moitié') {
      const head = it.data.op === 'double' ? 'Le double de' : 'La moitié de';
      assert.equal(promptText(parts), `${head} ${fmtNum(it.data.a)} est ${HOLE}`);
      assert.equal(it.prompt, `${it.data.op} de ${fmtNum(it.data.a)}`);
    } else {
      assert.equal(promptText(parts), it.prompt, it.key);
      /* les nombres affichés sont les termes connus de l'égalité vraie « a op b = c » */
      const shown = shownNumbers(parts).slice().sort((x, y) => x - y);
      const known = ['a', 'b', 'c'].filter(t => t !== it.data.hole).map(t => it.data[t]).sort((x, y) => x - y);
      assert.deepEqual(shown, known, it.prompt);
      assert.equal(it.data[it.data.hole], it.answer, it.prompt);
    }
  }
  for (const k of ['add', 'c10', 'double', 'moitie', 'mul', 'facteur', 'div', 'p10']) assert.ok(kinds.has(k), 'sous-type absent : ' + k);
});

test('promptParts : formes renversées « 56 = 7 × … » et secours sans data', () => {
  const rev = ITEMS.filter(it => it.data.reversed);
  assert.ok(rev.length > 20);
  for (const it of rev) {
    const parts = promptParts(it);
    assert.equal(parts[1].k, 'eq', it.prompt);
    assert.equal(promptText(parts), it.prompt);
  }
  const p1 = promptParts({ prompt: '7 × 8 = ' + HOLE, answer: 56 });
  assert.equal(promptText(p1), '7 × 8 = ' + HOLE);
  assert.deepEqual(shownNumbers(p1), [7, 8]);
  const p2 = promptParts({ prompt: 'double de 8', answer: 16 });
  assert.equal(p2.filter(p => p.k === 'hole').length, 1);
  assert.equal(promptText(promptParts({ prompt: '' })), HOLE);
});

test('promptAria : phrase lisible, « combien » à la place de la case, typographie française', () => {
  const it = { data: { op: '×', a: 7, b: 8, c: 56, hole: 'b', reversed: false }, answer: 8 };
  assert.equal(promptAria(promptParts(it)), '7 fois combien égale 56' + NNBSP + '?');
  const dv = { data: { op: '÷', a: 56, b: 8, c: 7, hole: 'c' }, answer: 7 };
  assert.equal(promptAria(promptParts(dv)), '56 divisé par 8 égale combien' + NNBSP + '?');
  const db = { data: { op: 'double', a: 8, b: null, c: 16, hole: 'c' }, answer: 16 };
  assert.equal(promptAria(promptParts(db)), 'Le double de 8 est combien' + NNBSP + '?');
});

test('answerInfo / checkTyped : réponses entières et décimales, voix = data.voice', () => {
  let dec = 0, novoice = 0;
  for (const it of ITEMS) {
    const info = answerInfo(it);
    assert.equal(info.decimal, !Number.isInteger(it.answer), it.prompt);
    assert.equal(info.voice, it.data.voice, it.prompt);
    if (info.decimal) { dec++; assert.equal(info.voice, false); }
    if (!info.voice) novoice++;
    /* saisie telle que tapée au pavé : chiffres et virgule, sans espaces */
    const typed = fmtNum(it.answer).replace(/\s/g, '');
    assert.equal(checkTyped(typed, it).ok, true, typed + ' pour ' + it.prompt);
    const off = checkTyped(fmtNum(it.answer + 1).replace(/\s/g, ''), it);
    assert.equal(off.ok, false);
    assert.equal(off.valid, true);
    assert.ok(holeChars(it) >= 2 && holeChars(it) <= 8);
  }
  assert.ok(dec > 10, 'des réponses décimales existent');
  assert.ok(novoice > dec, 'grands nombres sans voix');
  const it = { answer: 3.5, data: { voice: false } };
  assert.equal(checkTyped('3,5', it).ok, true);
  assert.equal(checkTyped('3,50', it).ok, true);
  assert.equal(checkTyped('35', it).ok, false);
  assert.equal(checkTyped('', it).valid, false);
  assert.equal(checkTyped('0,15', { answer: 0.15 }).ok, true);
  assert.equal(checkTyped('0,1', { answer: 0.15 }).ok, false);
});

test('voix : grammarFor(1000) contient tous les mots de toutes les réponses dites à voix haute', () => {
  const g = new Set(voiceGrammar());
  assert.ok(g.has('cinquante-six') && g.has('cent') && g.has('cents') && g.has('mille'));
  for (let n = 0; n <= VOICE_MAX; n++) for (const w of toWords(n).split(' ')) assert.ok(g.has(w), n + ' : ' + w);
  for (const it of ITEMS) if (it.data.voice) assert.ok(it.answer <= VOICE_MAX && Number.isInteger(it.answer));
});

test('juge de la voix : juste dès que la bonne réponse est entendue', () => {
  const j = createVoiceJudge({ answer: 56, ignore: [7, 8] });
  assert.deepEqual(j.feed('cinquante-six', true, 1000), { kind: 'right', value: 56, at: 1000 });
  assert.equal(j.done, true);
  assert.equal(j.feed('cinquante-six', true, 1100).kind, 'none', 'une seule décision');
  /* résultat partiel : confirmé après CONFIRM_MS sans changement */
  const k = createVoiceJudge({ answer: 56 });
  const e1 = k.feed('cinquante-six', false, 0);
  assert.equal(e1.kind, 'heard');
  assert.equal(e1.due, CONFIRM_MS);
  assert.equal(k.tick(CONFIRM_MS - 1).kind, 'none');
  assert.deepEqual(k.tick(CONFIRM_MS), { kind: 'right', value: 56, at: 0 });
  /* chiffres (secours Web Speech) */
  assert.equal(createVoiceJudge({ answer: 56 }).feed('56', true, 0).kind, 'right');
  /* auto-correction : « cinquante-quatre… cinquante-six » */
  const c = createVoiceJudge({ answer: 56 });
  assert.equal(c.feed('cinquante-quatre', false, 0).kind, 'heard');
  assert.equal(c.feed('cinquante-quatre cinquante-six', true, 900).kind, 'right');
});

test('juge de la voix : un autre nombre stable 1,5 s = essai faux, une seule fois', () => {
  const j = createVoiceJudge({ answer: 56, ignore: [7, 8] });
  const e = j.feed('cinquante-quatre', false, 100);
  assert.equal(e.kind, 'heard');
  assert.equal(e.value, 54);
  assert.equal(e.due, 100 + STABLE_MS);
  assert.equal(j.feed('cinquante-quatre', false, 900).kind, 'heard', 'les partiels identiques ne relancent pas le délai');
  assert.equal(j.tick(100 + STABLE_MS - 1).kind, 'none');
  assert.deepEqual(j.tick(100 + STABLE_MS), { kind: 'wrong', value: 54, at: 100 });
  assert.equal(j.tick(10000).kind, 'none', 'pas deux fois le même essai');
  j.reset();
  assert.equal(j.feed('cinquante-six', true, 12000).kind, 'right', 'nouvel essai après reset');
});

test('juge de la voix : « quarante » ne vaut pas quand l’enfant dit « quarante-cinq »', () => {
  const j = createVoiceJudge({ answer: 40 });
  assert.equal(j.feed('quarante', false, 0).kind, 'heard');
  const e = j.feed('quarante-cinq', false, 250);
  assert.equal(e.kind, 'heard');
  assert.equal(e.value, 45);
  assert.equal(j.tick(CONFIRM_MS + 10).kind, 'none');
  assert.equal(j.tick(250 + STABLE_MS).kind, 'wrong');
});

test('juge de la voix : nombres de l’énoncé ignorés, bruit ignoré', () => {
  const j = createVoiceJudge({ answer: 56, ignore: [7, 8] });
  const e = j.feed('sept [unk] huit', true, 0);
  assert.equal(e.kind, 'heard');
  assert.equal(e.ignored, true);
  assert.equal(j.tick(60000).kind, 'none');
  assert.equal(j.feed('[unk]', false, 61000).kind, 'none');
  assert.equal(j.feed('', false, 61000).kind, 'none');
  assert.equal(j.feed('sept [unk] huit cinquante-six', true, 62000).kind, 'right');
  /* la réponse peut être un nombre de l'énoncé : « 6 × … = 36 » */
  assert.equal(createVoiceJudge({ answer: 6, ignore: [6, 36] }).feed('six', true, 0).kind, 'right');
});

test('heardLabel : orthographe rectifiée pour la ligne 👂', () => {
  assert.equal(heardLabel(56), 'cinquante-six');
  assert.equal(heardLabel(245), 'deux-cent-quarante-cinq');
  assert.equal(heardLabel(80), 'quatre-vingts');
  assert.equal(heardLabel(null), '');
  assert.equal(heardLabel(3.5), '3,5');
});

test('hintVisual : quadrillages groupés comme la stratégie, boîtes de 10', () => {
  const mul = (a, b) => ({ kind: 'mul', data: { op: '×', a, b, c: a * b, hole: 'c' } });
  const v78 = hintVisual(mul(7, 8));
  assert.deepEqual([v78.type, v78.rows, v78.cols, v78.groups, v78.ghost], ['array', 7, 8, [4, 4], 0]);
  assert.equal(v78.caption, '7 rangées de 8');
  const v96 = hintVisual(mul(9, 6));
  assert.deepEqual([v96.rows, v96.cols, v96.groups, v96.ghost], [6, 9, [5, 4], 1]);
  const v35 = hintVisual(mul(3, 5));
  assert.deepEqual([v35.rows, v35.cols, v35.ghost], [3, 5, 5]);
  assert.equal(hintVisual(mul(1, 7)), null);
  assert.equal(hintVisual(mul(3, 25)), null);
  const c10 = hintVisual({ kind: 'c10', data: { op: '+', a: 7, b: 3, c: 10, hole: 'b' } });
  assert.deepEqual(c10.parts, [{ n: 7, kind: 'a' }, { n: 3, kind: 'missing' }]);
  assert.equal(frameCells(c10).length, 1);
  const s = hintVisual({ kind: 'add', data: { op: '+', a: 8, b: 5, c: 13, hole: 'c' } });
  const cells = frameCells(s);
  assert.equal(cells.length, 2);
  assert.equal(cells.flat().filter(k => k === 'a').length, 8);
  assert.equal(cells.flat().filter(k => k === 'b').length, 5);
  assert.equal(cells.flat().filter(k => k === 'empty').length, 7);
  const dbl = hintVisual({ kind: 'double', data: { op: 'double', a: 6, b: null, c: 12, hole: 'c' } });
  assert.equal(dbl.total, 12);
  assert.equal(hintVisual({ kind: 'double', data: { op: 'double', a: 45, b: null, c: 90, hole: 'c' } }), null);
  assert.equal(hintVisual({ kind: 'p10', data: { op: '×', a: 3.5, b: 100, c: 350, hole: 'c' } }), null);
});

test('hintVisual sur tout l’échantillon : dessins cohérents avec l’égalité, jamais la case remplie', () => {
  let n = 0;
  for (const it of ITEMS) {
    const v = hintVisual(it);
    if (!v) continue;
    n++;
    if (v.type === 'array') {
      assert.equal(v.groups.reduce((s, g) => s + g, 0), v.cols, it.prompt);
      assert.ok(v.rows >= 2 && v.rows <= 10 && v.cols >= 2 && v.cols <= 10, it.prompt);
      const product = it.kind === 'div' ? it.data.a : it.data.c;
      assert.equal(v.rows * v.cols, product, it.prompt);
    } else {
      const cells = frameCells(v).flat();
      assert.ok(v.total <= 20 && cells.length === (v.total > 10 ? 20 : 10), it.prompt);
      assert.equal(cells.filter(k => k !== 'empty').length, v.total, it.prompt);
    }
    assert.ok(!/'/.test(v.caption), 'apostrophe typographique : ' + v.caption);
  }
  assert.ok(n > 300, 'les petits faits ont un dessin (' + n + ')');
});

test('vitesse du monde : zen, chrono (2 × autoMs), freinage doux, accélération', () => {
  assert.equal(cruiseRate({ timers: false, distance: 240, autoMs: 3000 }), 1);
  const r = cruiseRate({ timers: true, distance: 240, autoMs: 3000 });
  assert.ok(Math.abs(r - (240 + BRAKE_PX) / (GROUND_SPEED * 6)) < 1e-12);
  assert.ok(Math.abs(approachSeconds(240, r) - 6) < 1e-9, 'arrivée en 2 × autoMs');
  assert.ok(cruiseRate({ timers: true, distance: 240, autoMs: 5000 }) < r);
  assert.equal(brakeRate(500, 1), 1);
  assert.equal(brakeRate(0, 1), 0);
  assert.equal(brakeRate(0.2, 1), 0);
  let prev = 0;
  for (let s = 1; s <= BRAKE_PX; s++) { const v = brakeRate(s, 1); assert.ok(v >= prev && v <= 1); prev = v; }
  assert.equal(rushRate(0), 1.6);
  assert.equal(rushRate(10000), 4);
  /* simulation : l'obstacle s'arrête pile au point d'attente, sans le dépasser */
  let x = 240, t = 0;
  const dt = 1 / 60;
  while (x > 0 && t < 10) { x -= GROUND_SPEED * brakeRate(x, 1) * dt; t += dt; if (brakeRate(x, 1) === 0) break; }
  assert.ok(x > -3 && x < 1, 'arrêt au bon endroit (' + x + ')');
  assert.ok(t < 3, 'zen : arrivée rapide (' + t.toFixed(2) + ' s)');
});

test('combo : « ⚡ N » à partir de 2 réussites de suite (🔥 = jours de suite)', () => {
  assert.equal(comboLabel(0), '');
  assert.equal(comboLabel(1), '');
  assert.equal(comboLabel(3), '\u{26A1}\u{a0}3');
});
