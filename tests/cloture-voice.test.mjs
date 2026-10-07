/* Le Chemin de la clôture à voix haute (v2.3, js/games/cloture-logic.js : voicePlan & co.) : formes dites des fractions et
   des décimaux, ce que le micro écoute selon l'item, choix retenus, et couverture du lexique du modèle Vosk. */
import { test, assert } from './_t.mjs';
import * as L from '../js/games/cloture-logic.js';
import { gen, fracWords } from '../js/content/maths/ligne.js';
import { makeRng } from '../js/core/rng.js';
import { matchChoice, choiceGrammar } from '../js/core/voice-choice.js';
import { parseSpoken, toWords } from '../js/core/numbers-fr.js';
import { voiceGrammar, VOICE_FILLERS } from '../js/games/tables-logic.js';
import { loadLexicon } from './lexicon.mjs';

/* items « lire » de tous les paliers (graines fixes) */
function lireItems(per = 70) {
  const out = [];
  for (const A of [0.2, 0.5, 0.8, 1.1, 1.6, 2.1, 2.4, 2.8, 3.1, 3.3, 3.5, 3.8, 4.2, 4.6, 5.2]) {
    const rng = makeRng(4242 + Math.round(A * 100));
    for (let i = 0; i < per; i++) out.push(gen(A, rng, { mode: 'lire' }));
  }
  return out;
}
const ITEMS = lireItems();
const wordsOf = f => f.split(' ');
/* préfixes d'une forme dite, mot après mot (ce que donnent les résultats partiels pendant que l'enfant parle) */
const prefixes = f => wordsOf(f).map((_, k, a) => a.slice(0, k + 1).join(' '));

test('fracSay : la lecture de l’école, homophones singulier/pluriel, jamais de forme hors lexique', () => {
  assert.deepEqual(L.fracSay(3, 4), ['trois quarts', 'trois quart']);
  assert.deepEqual(L.fracSay(1, 4), ['un quart', 'un quarts']);
  assert.ok(L.fracSay(1, 2).includes('un demi') && L.fracSay(1, 2).includes('une demie'));
  assert.deepEqual(L.fracSay(1, 3), ['un tiers']);
  assert.deepEqual(L.fracSay(7, 4), ['sept quarts', 'sept quart']);
  assert.deepEqual(L.fracSay(5, 9), ['cinq neuvième'], '« neuvièmes » manque au lexique : le singulier (même son)');
  assert.deepEqual(L.fracSay(3, 24), [], 'dénominateur > 20 (distracteur de CM2) : au doigt');
  assert.deepEqual(L.fracSay(3, 1), []);
  assert.deepEqual(L.fracSay(0, 4), []);
});

test('fracSay : lexique du modèle — tous les mots connus, aucun pluriel connu oublié (dénominateurs 2 à 20)', () => {
  const lex = loadLexicon();
  for (let d = 2; d <= L.FRAC_SAY_MAX_DEN; d++) {
    for (let n = 1; n <= 3 * d; n++) {
      const forms = L.fracSay(n, d);
      assert.ok(forms.length, `${n}/${d} : au moins une forme`);
      for (const f of forms) for (const w of wordsOf(f)) assert.ok(lex.has(w), `${n}/${d} : « ${w} » (${f}) absent du lexique`);
    }
    const plural = fracWords(2, d).split(' ').slice(1).join(' ');
    assert.equal(L.fracSay(2, d).some(f => f.endsWith(' ' + plural)), lex.has(plural), `${d} : pluriel « ${plural} »`);
  }
});

test('decSay : « deux virgule huit cent douze », zéros dits', () => {
  assert.deepEqual(L.decSay(2.812), ['deux virgule huit cent douze']);
  assert.deepEqual(L.decSay(3.05), ['trois virgule zéro cinq']);
  assert.deepEqual(L.decSay(0.5), ['zéro virgule cinq']);
  assert.deepEqual(L.decSay(1.7), ['un virgule sept']);
  assert.deepEqual(L.decSay(20.007), ['vingt virgule zéro zéro sept']);
  assert.deepEqual(L.decSay(339.16), ['trois cent trente-neuf virgule seize']);
  assert.deepEqual(L.decSay(4), ['quatre']);
  assert.deepEqual(L.decSay(-1), []);
});

test('piquets décimaux : « six virgule zéro un » (réponse) n’est pas à égalité avec « six virgule un »', () => {
  const data = { mode: 'lire', fmt: 'dec', min: 6, max: 6.2, major: 0.1, minor: 0.01, value: 6.01, labels: [{ v: 6, text: '6' }, { v: 6.2, text: '6,2' }], zoom: null };
  const list = L.postChoices(data);
  assert.ok(!list.some(c => c.value === 6.1), '6,1 se lit dans « six virgule zéro un » : écarté');
  assert.equal(matchChoice('six virgule zéro un', list).value, 6.01);
  assert.equal(matchChoice('six virgule un', list), null, 'dit, il ne vaut rien (jamais la réponse)');
  const other = L.postChoices({ ...data, value: 6.1 });
  assert.ok(other.some(c => c.value === 6.01));
  assert.equal(matchChoice('six virgule zéro un', other), null, 'réponse 6,1 : « six virgule zéro un » ne la donne pas');
});

test('piquets décimaux : « trois virgule » (souffle repris) ne vaut aucun piquet, « trois virgule trois » vaut 3,3', () => {
  const data = { mode: 'lire', fmt: 'dec', min: 3, max: 4, major: 1, minor: 0.1, value: 3.2, labels: [{ v: 3, text: '3' }, { v: 4, text: '4' }], zoom: null };
  const list = L.postChoices(data);
  assert.equal(matchChoice('trois virgule', list), null);
  assert.equal(matchChoice('trois', list), null);
  assert.equal(matchChoice('trois virgule trois', list).value, 3.3);
  assert.equal(matchChoice('trois virgule deux', list).value, 3.2);
  assert.equal(matchChoice('trois virgule un trois virgule deux', list).value, 3.2, 'il compte : le dernier dit');
});

test('spokenPrefixes : les nombres entendus en route vers la réponse', () => {
  assert.deepEqual(L.spokenPrefixes(3290), [3, 3000, 3002, 3200]);
  assert.deepEqual(L.spokenPrefixes(47), []);
  assert.deepEqual(L.spokenPrefixes(470), [4, 400]);
  for (const n of [178840, 689600, 5607, 1000, 999999]) {
    const w = wordsOf(toWords(n));
    for (let k = 1; k < w.length; k++) {
      const v = parseSpoken(w.slice(0, k).join(' '));
      if (v !== null && v !== n) assert.ok(L.spokenPrefixes(n).includes(v), `${n} : ${v}`);
    }
  }
});

test('voicePlan : placer → pause ; QCM, pavé entier, pavé décimal et grands nombres', () => {
  const kinds = new Set();
  for (const A of [1.1, 2.4, 2.8, 3.8, 4.8]) {
    const rng = makeRng(99);
    for (let i = 0; i < 30; i++) {
      const it = gen(A, rng, {});
      const p = L.voicePlan(it, { prev: 12 });
      if (it.data.mode === 'placer') { assert.equal(p.kind, 'pause'); kinds.add('placer'); continue; }
      if (it.choices) {
        assert.equal(p.kind, 'choices');
        assert.equal(p.list.length, it.choices.length);
        assert.deepEqual(p.list.map(c => c.value), it.choices.map(c => c.value), 'mêmes valeurs que les boutons');
        kinds.add('qcm-' + it.data.fmt);
      } else if (it.data.fmt === 'int' && it.answer <= L.VOICE_NUMBER_MAX) {
        assert.equal(p.kind, 'number');
        assert.equal(p.answer, it.answer);
        assert.ok(!p.ignore.includes(it.answer), 'la réponse n’est jamais ignorée');
        for (const l of [...it.data.labels, ...(it.data.zoom ? it.data.zoom.labels : [])]) if (l.v !== it.answer) assert.ok(p.ignore.includes(l.v), 'plaquette ignorée');
        if (it.answer !== 12) assert.ok(p.ignore.includes(12), 'réponse précédente ignorée');
        assert.ok(p.only.some(v => L.sameValue(v, it.answer)) && p.only.length <= 42, 'faux possibles : les piquets');
        kinds.add('nombre');
      } else if (it.data.fmt === 'dec') {
        assert.equal(p.kind, 'choices');
        kinds.add('piquets-dec');
      } else {
        assert.equal(p.kind, 'pause', 'nombre ≥ 100 000 : micro en pause');
        assert.ok(it.answer > L.VOICE_NUMBER_MAX);
        kinds.add('grand-pause');
      }
    }
  }
  for (const k of ['placer', 'qcm-int', 'qcm-frac', 'nombre', 'piquets-dec', 'grand-pause']) assert.ok(kinds.has(k), k);
  assert.equal(L.voicePlan(null).kind, 'pause');
});

test('postChoices : les piquets de la partie où est le drapeau, sans plaquettes ni entiers ni débuts de la réponse', () => {
  const data = { mode: 'lire', fmt: 'dec', min: 2, max: 3, major: 1, minor: 0.1, value: 2.7,
    labels: [{ v: 2, text: '2' }, { v: 2.5, text: '2,5' }, { v: 3, text: '3' }], zoom: null };
  const list = L.postChoices(data);
  assert.equal(list[list.length - 1], L.VOICE_WITNESS, 'le témoin, en dernier');
  assert.deepEqual(list.slice(0, -1).map(c => c.value), [2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 2.9]);
  assert.deepEqual(list.find(c => c.value === 2.7).say, ['deux virgule sept']);
  assert.equal(list.find(c => c.value === 2.7).label, '2,7');
  /* zoom en millièmes : 2,8 (plaquette du plan principal, début de « deux virgule huit cent douze ») écarté */
  const z = { mode: 'lire', fmt: 'dec', min: 2, max: 3, major: 1, minor: 0.1, value: 2.812, labels: [{ v: 2, text: '2' }, { v: 3, text: '3' }],
    zoom: { min: 2.81, max: 2.82, major: 0.01, minor: 0.001, labels: [{ v: 2.81, text: '2,81' }, { v: 2.82, text: '2,82' }] } };
  const zl = L.postChoices(z).filter(c => c !== L.VOICE_WITNESS);
  assert.equal(zl.length, 9);
  assert.ok(zl.some(c => c.value === 2.812));
  assert.ok(!zl.some(c => c.value === 2.81 || c.value === 2.82));
});

test('items du jeu : la réponse dite est reconnue, un autre choix dit ne vaut jamais la réponse, un début de réponse jamais un autre choix', () => {
  let n = 0, ok = 0, tie = 0;
  for (const it of ITEMS) {
    const p = L.voicePlan(it, { prev: null });
    const ans = Number(it.answer);
    if (p.kind === 'number') {
      assert.equal(parseSpoken(toWords(ans)), ans);
      for (const pre of prefixes(toWords(ans)).slice(0, -1)) {
        const v = parseSpoken(pre);
        assert.ok(v === null || v === ans || p.ignore.includes(v), `${it.key} : « ${pre} » (${v}) compterait faux`);
      }
      n++;
      continue;
    }
    if (p.kind !== 'choices') continue;
    const said = c => (Number.isFinite(c.num) ? [toWords(c.num)] : c.say);
    const right = p.list.find(c => L.sameValue(Number(c.value), ans));
    assert.ok(right && said(right).length, `${it.key} : réponse dicible`);
    for (const f of said(right)) {
      const m = matchChoice(f, p.list);
      assert.ok(m && L.sameValue(Number(m.value), ans), `${it.key} : « ${f} » → ${m && m.value}`);
      for (const pre of prefixes(f).slice(0, -1)) {
        const mm = matchChoice(pre, p.list);
        assert.ok(!mm || L.sameValue(Number(mm.value), ans) || (p.never || []).some(x => L.sameValue(x, Number(mm.value))),
          `${it.key} : début « ${pre} » → autre choix ${mm && mm.value}`);
      }
    }
    /* chaque autre choix dit : lui-même, ou rien (égalité) — jamais un autre, jamais la réponse */
    for (const c of p.list) for (const f of said(c)) {
      if (c === right) continue;
      const m = matchChoice(f, p.list);
      assert.ok(!m || m.value === c.value, `${it.key} : « ${f} » → ${m && m.value} (attendu ${c.value})`);
      if (m) ok++; else tie++;
    }
    n++;
  }
  assert.ok(n > 900, 'assez d’items vérifiés : ' + n);
  assert.ok(tie <= ok * 0.01, `choix faux reconnus : ${ok}, à égalité (rien) : ${tie}`);
});

test('grammaires du jeu : tous les mots connus du modèle (pavé, QCM, piquets)', () => {
  const lex = loadLexicon();
  for (const w of voiceGrammar()) assert.ok(lex.has(w), w);
  const seen = new Set();
  for (const it of ITEMS) {
    const p = L.voicePlan(it);
    if (p.kind !== 'choices') continue;
    for (const w of choiceGrammar(p.list, VOICE_FILLERS)) if (!seen.has(w)) { seen.add(w); assert.ok(lex.has(w), `${it.key} : « ${w} »`); }
  }
  for (const w of ['virgule', 'zéro', 'quarts', 'tiers']) assert.ok(seen.has(w), w);
});

test('voiceVerdict : juste tout de suite, faux retenu puis touché s’il est redit ; « un », débuts de réponse et morceaux jamais faux', () => {
  assert.equal(L.voiceVerdict(0.75, 0.75), 'now');
  assert.equal(L.voiceVerdict(0.5, 0.75), 'hold');
  assert.equal(L.voiceVerdict(0.5, 0.75, 0.5), 'now');
  assert.equal(L.voiceVerdict(0.25, 0.75, 0.5), 'hold');
  assert.equal(L.voiceVerdict(1, 7), 'skip');
  assert.equal(L.voiceVerdict(400, 470, null, { never: L.spokenPrefixes(470) }), 'skip');
  assert.equal(L.voiceVerdict(400, 470, 400, { never: L.spokenPrefixes(470) }), 'skip');
  const only = [4320, 4321, 4322, 4323, 4324, 4325];
  assert.equal(L.voiceVerdict(23, 4323, null, { only }), 'skip', '« trois vingt-trois » : un morceau');
  assert.equal(L.voiceVerdict(4024, 4323, null, { only }), 'skip', 'pas un piquet : erreur d’écoute');
  assert.equal(L.voiceVerdict(4324, 4323, null, { only }), 'hold', 'le piquet voisin : une vraie erreur de lecture');
  assert.equal(L.voiceVerdict('x', 3), 'skip');
  assert.ok(L.VOICE_HOLD_MS >= 600 && L.VOICE_HOLD_MS <= 1500);
});

test('holdDue : la réponse fausse retenue attend que l’enfant se taise (il compte), au plus 10 s', () => {
  const H = L.VOICE_HOLD_MS, Q = L.VOICE_QUIET_MS;
  assert.equal(L.holdDue({ pickAt: 0, lastVoiceAt: 0, now: H - 1 }), false, 'choix : jamais avant VOICE_HOLD_MS');
  assert.equal(L.holdDue({ pickAt: 0, lastVoiceAt: 0, now: Math.max(H, Q) }), true, 'silence : tapée');
  assert.equal(L.holdDue({ pickAt: 0, lastVoiceAt: H, now: H + 100 }), false, 'il parle encore (compte) : attendue');
  assert.equal(L.holdDue({ pickAt: 0, lastVoiceAt: H, now: H + Q }), true);
  assert.equal(L.holdDue({ pickAt: 0, lastVoiceAt: 5000, now: 5000 + Q - 1 }), false, 'il compte longtemps : toujours attendue');
  assert.equal(L.holdDue({ pickAt: 0, lastVoiceAt: L.VOICE_HOLD_MAX_MS - 1, now: L.VOICE_HOLD_MAX_MS }), true, 'bruit continu : au plus tard');
  assert.equal(L.holdDue({ pickAt: 0, lastVoiceAt: 0, now: Q, holdMs: 0 }), true, 'nombre (déjà stable 1,5 s) : dès le silence');
  assert.equal(L.holdDue({ pickAt: 100, now: 50 }), false);
});
