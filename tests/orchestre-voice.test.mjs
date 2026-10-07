/* Le Chef d’orchestre à voix haute (v2.3, js/games/orchestre-voice.js) : formes dites par sous-type, clé sonore,
   questions sans micro (homophones, mots hors du lexique de Vosk), choix dit = choix touché, lexique du modèle. */
import { test, assert } from './_t.mjs';
import * as OV from '../js/games/orchestre-voice.js';
import { matchChoice, choiceGrammar, wordsOf } from '../js/core/voice-choice.js';
import { VOICE_FILLERS } from '../js/games/tables-logic.js';
import { gen, GEN_VERBS, _internals } from '../js/content/fr/conjug.js';
import { TENSES, PERSONS, conjugate, participle, stemEnding, groupOf } from '../js/content/fr/verbs.js';
import { makeRng } from '../js/core/rng.js';
import { loadLexicon } from './lexicon.mjs';

const KINDS = ['forme', 'terminaison', 'temps', 'accord', 'sujet', 'participe'];
/* grand tirage : tous les sous-types sur toute l'échelle A (remédiation CP → fin de CM2) */
function draw(n, seed) {
  const rng = makeRng(seed), out = [];
  for (let i = 0; i < n; i++) {
    const it = gen((i % 57) / 10, rng, i % 7 === 0 ? {} : { kind: KINDS[i % 6] });
    if (it) out.push(it);
  }
  return out;
}
const ITEMS = draw(4000, 2026);
const VOICED = ITEMS.map(it => ({ it, vc: OV.voiceChoices(it) })).filter(x => x.vc.list);
const ofKind = k => ITEMS.filter(it => it.kind === k);
const same = (a, b) => String(a) === String(b);

test('clé sonore : homophones confondus, formes qui s’entendent séparées', () => {
  const close = [['mange', 'manges'], ['mange', 'mangent'], ['mangeais', 'mangeait'], ['mangeait', 'mangeaient'], ['chantait', 'chanté'],
    ['chanté', 'chanter'], ['chantez', 'chantais'], ['chantons', 'chantions'], ['chantez', 'chantiez'], ['finis', 'finit'], ['fini', 'finie'],
    ['allé', 'allées'], ['il', 'ils'], ['elle', 'elles'], ['a', 'as'], ['est', 'es'], ['serons', 'seront'], ['voit', 'voient'],
    ['as fait', 'a fait'], ['ont joué', 'ont jouer'], ['prend', 'prends'], ['peux', 'peut'], ['va', 'vas'], ['sera', 'seras']];
  for (const [a, b] of close) assert.ok(OV.tooClose(a, b), a + ' / ' + b + ' : trop proches à l’oral');
  const apart = [['mange', 'mangeons'], ['mangeons', 'mangez'], ['ai', 'a'], ['ont', 'avons'], ['finis', 'finissent'], ['finissons', 'finissez'],
    ['vient', 'viennent'], ['prend', 'prennent'], ['dit', 'disent'], ['fait', 'faites'], ['sera', 'serai'], ['mangera', 'mangerai'],
    ['vais', 'va'], ['nous', 'vous'], ['le chat', 'les chats'], ['une', 'un'], ['est allé', 'a allé'], ['mangeâmes', 'mangeâtes'],
    ['passé composé', 'passé simple'], ['présent', 'imparfait']];
  for (const [a, b] of apart) assert.ok(!OV.tooClose(a, b), a + ' / ' + b + ' : s’entendent différemment');
  assert.equal(OV.soundKey('J’ai  mangé'), OV.soundKey('j’ai mangé'));
});

/* la forme dite contient ces mots, collés, dans cet ordre */
const has = (form, words) => (' ' + form + ' ').includes(' ' + words.join(' ') + ' ');

test('formes dites : forme et accord (la forme, entourée du sujet et de la suite de la phrase)', () => {
  let n = 0, glued = 0;
  for (const { it, vc } of VOICED.filter(x => x.it.kind === 'forme' || x.it.kind === 'accord')) {
    assert.equal(vc.list.length, it.choices.length);
    vc.list.forEach((c, i) => {
      assert.ok(same(c.value, it.choices[i].value), 'même ordre que les boutons');
      assert.ok(c.say.some(f => has(f, wordsOf(c.value))), 'la forme : ' + c.say.join(' ; '));
      assert.equal(c.label, it.choices[i].label);
    });
    const ans = vc.list.find(c => same(c.value, it.answer));
    /* « nous mangeons » : le sujet collé au trou est dans les formes dites */
    const before = wordsOf(String(it.data.sentence.before).split(/[,;:!?«»]/).pop());
    if (it.data.structure === 'pron' && before.length === 1 && !/’$/.test(it.data.sentence.before)) {
      assert.ok(ans.say.some(f => has(f, [before[0], ...wordsOf(ans.value)])), it.key + ' : ' + ans.say.join(' ; '));
      n++;
    }
    /* « j’ai » : élision collée comme Vosk l'écrit */
    if (/j’$/.test(it.data.sentence.before) && OV.J_GLUE.has(wordsOf(ans.value)[0])) {
      assert.ok(ans.say.some(f => wordsOf(f).includes("j'" + wordsOf(ans.value)[0])), ans.say.join(' ; '));
      glued++;
    }
  }
  assert.ok(n > 20 && glued > 3, 'sujets collés ' + n + ', élisions ' + glued);
});

test('formes dites : terminaison (radical + tuile), temps, sujet', () => {
  const tiles = VOICED.filter(x => x.it.kind === 'terminaison');
  assert.ok(tiles.length > 10);
  for (const { it, vc } of tiles) vc.list.forEach(c => {
    assert.ok(c.say.some(f => has(f, wordsOf(it.data.stem + c.value))), 'le mot entier : ' + c.say.join(' ; '));
    assert.equal(c.label, it.data.stem + c.value, '👂 mangeons, pas « -ons »');
  });
  const temps = VOICED.filter(x => x.it.kind === 'temps');
  assert.equal(temps.length, ofKind('temps').length, 'les temps se disent toujours');
  /* la phrase lue (mots connus du modèle), puis le temps : « … le futur », « … au futur » */
  for (const { vc } of temps) vc.list.forEach(c => {
    assert.equal(c.say.length, OV.TENSE_SAY[c.value].length);
    c.say.forEach((f, i) => assert.ok(f.endsWith(wordsOf(OV.TENSE_SAY[c.value][i]).join(' ')), f));
  });
  for (const t of TENSES) assert.ok(OV.TENSE_SAY[t] && OV.TENSE_SAY[t].length >= 3, t);
  let verb = 0;
  for (const { it, vc } of VOICED.filter(x => x.it.kind === 'sujet')) {
    vc.list.forEach(c => assert.ok(c.say.some(f => has(f, wordsOf(c.value))), c.say.join(' ; ')));
    /* le sujet, puis le verbe (quand le modèle connaît la forme) */
    const v = wordsOf(it.data.form);
    if (v.every(w => !OV.VOICE_OOV.has(w))) {
      const ans = vc.list.find(c => same(c.value, it.answer));
      assert.ok(ans.say.some(f => has(f, [...wordsOf(ans.value), ...v])), ans.say.join(' ; '));
      verb++;
    }
  }
  assert.ok(verb > 50, verb + ' sujets suivis du verbe');
});

test('le choix dit est le choix touché : chaque forme dite, la phrase lue en entier (avec la bonne réponse ou une autre)', () => {
  let read = 0;
  for (const { it, vc } of VOICED) {
    for (const c of vc.list) for (const f of c.say) {
      const m = matchChoice(f, vc.list);
      assert.ok(m && same(m.value, c.value), it.key + ' : « ' + f + ' » → ' + (m && m.value) + ' au lieu de ' + c.value);
    }
    if (it.kind === 'temps') continue;
    const s = it.data.sentence;
    if (/’$/.test(s.before)) continue;                  /* « j’avons » : jamais lu tel quel */
    for (const c of it.choices) {
      const fill = it.kind === 'terminaison' ? it.data.stem + c.value : it.kind === 'sujet' ? c.label : c.value;
      const text = s.before + fill + s.after;
      const m = matchChoice(text, vc.list);
      assert.ok(m && same(m.value, c.value), it.key + ' : « ' + text + ' » → ' + (m && m.value) + ' au lieu de ' + c.value);
      read++;
    }
  }
  assert.ok(read > 500, read + ' phrases lues');
});

test('lexique : tous les mots des grammaires sont connus du modèle Vosk', () => {
  const lex = loadLexicon();
  const missing = new Set();
  for (const { vc } of VOICED) for (const w of choiceGrammar(vc.list, VOICE_FILLERS)) if (!lex.has(w)) missing.add(w);
  assert.deepEqual([...missing], [], 'hors lexique : ' + [...missing].join(' '));
});

/* tous les mots que la voix de l'orchestre peut employer : formes de tous les verbes de la banque à tous les temps,
   fautes typiques, tuiles des temps composés, participes, mots des cadres de phrases (sujets, compléments), tirages */
function universe(items) {
  const set = new Set();
  const add = t => { for (const w of wordsOf(t)) set.add(w); };
  for (const v of GEN_VERBS) for (const t of TENSES) for (const p of PERSONS) for (const g of ['m', 'f']) {
    const r = conjugate(v, t, p, { g }); if (r) add(r.form);
    for (const n of ['s', 'p']) { const c = conjugate(v, t, p, { cod: { g, n } }); if (c) add(c.form); }
    for (const e of _internals.errorForms(v, t, p, g, 6)) add(e.f);
    const se = stemEnding(v, t, p);
    if (se && (t === 'passe_compose' || t === 'plus_que_parfait')) {
      for (const e of (groupOf(v) === 1 ? ['é', 'er', 'ez', 'ait', 'ais', 'ent'] : ['i', 'is', 'it', 'ir', 'issent'])) add(se.stem + e);
    }
  }
  for (const v of GEN_VERBS) for (const g of ['m', 'f']) for (const n of ['s', 'p']) add(participle(v, g, n));
  const walk = o => { if (typeof o === 'string') { if (!_internals.P[o]) { add(o); for (const w of wordsOf(o)) set.add(OV.ctxWord(w)); } } else if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') Object.values(o).forEach(walk); };
  for (const k of ['FR', 'QUESTIONS', 'COD', 'CUES', 'P', 'NAMES', 'KIDS', 'ADULTS']) walk(_internals[k]);
  for (const s of Object.values(OV.TENSE_SAY)) s.forEach(add);
  for (const it of items) for (const w of OV.voiceWords(it)) set.add(w);
  return set;
}

test('lexique : VOICE_OOV et J_GLUE exactes (tests/lexicon.mjs)', () => {
  const lex = loadLexicon();
  const U = universe([...ITEMS, ...draw(3000, 7)]);
  const known = [...OV.VOICE_OOV].filter(w => lex.has(w));
  assert.deepEqual(known, [], 'dans le lexique, à retirer de VOICE_OOV : ' + known.join(' '));
  const oov = [...U].filter(w => !lex.has(w)).sort((a, b) => a.localeCompare(b, 'fr'));
  const lacking = oov.filter(w => !OV.VOICE_OOV.has(w));
  assert.deepEqual(lacking, [], 'hors lexique, à ajouter à VOICE_OOV : ' + lacking.join(' '));
  const badGlue = [...OV.J_GLUE].filter(w => !lex.has("j'" + w));
  assert.deepEqual(badGlue, [], '« j’ » + mot hors lexique, à retirer de J_GLUE : ' + badGlue.join(' '));
  const glue = [...U].filter(w => !w.includes("'") && /^[aeiouyàâäéèêëîïôöùûüœh]/.test(w) && lex.has("j'" + w) && !OV.J_GLUE.has(w));
  assert.deepEqual(glue, [], 'à ajouter à J_GLUE : ' + glue.join(' '));
  console.log('    voix de l’orchestre : ' + U.size + ' mots possibles, ' + oov.length + ' hors du lexique de Vosk, ' + OV.J_GLUE.size + ' élisions « j’ »');
});

test('questions sans micro : homophones et mots inconnus du modèle, comptés par sous-type', () => {
  const by = {};
  for (const it of ITEMS) {
    const vc = OV.voiceChoices(it);
    const b = by[it.kind] = by[it.kind] || { n: 0, voix: 0, lexique: 0, oral: 0 };
    b.n++;
    if (vc.list) b.voix++;
    else { assert.ok(vc.why === 'lexique' || vc.why === 'oral', it.key + ' : ' + vc.why); b[vc.why]++; }
    /* jamais de micro quand la bonne réponse sonne comme un autre choix */
    if (vc.list && it.kind !== 'temps') {
      const ans = it.choices.find(c => same(c.value, it.answer));
      const bare = c => (it.kind === 'terminaison' ? it.data.stem + c.value : String(c.value));
      for (const c of it.choices) if (c !== ans) assert.ok(!OV.tooClose(bare(c), bare(ans)), it.key + ' : ' + bare(c) + ' / ' + bare(ans));
    }
  }
  const pct = (a, b) => Math.round(100 * a / Math.max(1, b)) + ' %';
  console.log('    questions à voix haute : ' + KINDS.map(k => k + ' ' + pct(by[k].voix, by[k].n) + ' (pause : lexique ' + pct(by[k].lexique, by[k].n)
    + ', oral ' + pct(by[k].oral, by[k].n) + ')').join(' · '));
  const all = Object.values(by).reduce((a, b) => a + b.voix, 0);
  console.log('    en tout : ' + pct(all, ITEMS.length) + ' des questions se disent au micro');
  assert.equal(by.temps.voix, by.temps.n, 'les temps se disent toujours');
  assert.ok(by.sujet.voix / by.sujet.n > 0.85, 'sujets');
  assert.ok(by.participe.voix / by.participe.n < 0.05, 'participes : accords homophones');
  assert.ok(all / ITEMS.length > 0.3, 'au moins 30 % des questions');
});

test('questions sans micro : cas construits (homophones, mot inconnu, sous-type inconnu)', () => {
  const item = (kind, answer, values, data = {}) => ({ kind, answer, choices: values.map(v => ({ label: v, value: v })),
    data: Object.assign({ sentence: { before: 'Nous ', after: ' une pomme.' } }, data) });
  assert.equal(OV.voiceChoices(item('forme', 'mangeons', ['mangeons', 'mange', 'manges', 'mangent'])).why, '', 'distracteurs homophones entre eux : sans risque');
  assert.equal(OV.voiceChoices(item('forme', 'mange', ['mangeons', 'mange', 'manges', 'mangez'])).why, 'oral');
  assert.equal(OV.voiceChoices(item('forme', 'mangions', ['mangions', 'mangeons', 'mangez', 'mange'])).why, 'oral', '« i » glissé');
  assert.equal(OV.voiceChoices(item('forme', 'chanterai', ['chanterai', 'chantera', 'chanterons', 'chantez'])).why, 'lexique', '« chanterai » : hors du modèle');
  assert.equal(OV.voiceChoices(item('participe', 'tombée', ['tombé', 'tombée', 'tombés', 'tombées'])).why, 'oral');
  assert.equal(OV.voiceChoices(item('inconnu', 'a', ['a', 'b'])).why, 'type');
  assert.equal(OV.voiceChoices(item('forme', 'z', ['mange', 'manges'])).why, 'type', 'réponse absente des choix');
  assert.equal(OV.voiceChoices(null).why, 'type');
  /* la phrase lue contient un choix à l'oral : « à » s'entend « a », « Il y a longtemps » contient « il » */
  assert.equal(OV.voiceChoices(item('forme', 'ai', ['ai', 'a', 'ont', 'avons'], { sentence: { before: 'Je ', after: ' mal à la tête.' } })).why, 'oral');
  assert.equal(OV.voiceChoices(item('sujet', 'nous', ['nous', 'il', 'vous', 'les fermiers'],
    { sentence: { before: 'Il y a longtemps, ', after: ' criions très fort.' } })).why, 'oral');
  assert.equal(OV.voiceChoices(item('sujet', 'nous', ['nous', 'tu', 'vous', 'les fermiers'],
    { sentence: { before: 'Il y a longtemps, ', after: ' criions dans les champs.' } })).why, '', '« les » seul n’est pas « les fermiers »');
  /* la forme entourée de son bout de phrase ; dite seule, elle désigne toujours son choix */
  const vc = OV.voiceChoices(item('forme', 'mangeons', ['mangeons', 'mange', 'manges', 'mangent'], { sentence: { before: 'Ce soir, nous ', after: ' une pomme.' } }));
  assert.deepEqual(vc.list.map(c => c.say), [['ce soir nous mangeons une pomme'], ['ce soir nous mange une pomme'], ['ce soir nous manges une pomme'],
    ['ce soir nous mangent une pomme']]);
  assert.equal(matchChoice('euh mangeons', vc.list).value, 'mangeons');
  assert.equal(matchChoice('nous mangeons une pomme', vc.list).value, 'mangeons');
  /* « ont froid » se lit dans « ont eu froid » : chaque forme dite désigne quand même son choix */
  const eu = OV.voiceChoices(item('forme', 'ont eu', ['ont eu', 'ont', 'ai eu', 'avez eu'], { sentence: { before: 'Hier, elles ', after: ' froid.' } }));
  for (const c of eu.list) for (const f of c.say) assert.equal(matchChoice(f, eu.list).value, c.value, f);
  assert.equal(matchChoice('elles ont eu froid', eu.list).value, 'ont eu');
  assert.equal(matchChoice('elles ont froid', eu.list).value, 'ont');
});
