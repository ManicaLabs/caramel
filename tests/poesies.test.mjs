/* « 📜 Mes poésies » (v2.6) : js/content/poems.js (texte, vers, étapes, grammaire, mots hors lexique, progression),
   js/core/lexicon.js (lexique du modèle Vosk lu dans l'archive), normalisation du profil et sauvegardes, et la course
   (moteur v11 inchangé, aucun mot dit pendant que le micro écoute). Poèmes : un quatrain écrit pour ces tests et deux
   extraits du domaine public (La Fontaine, Verlaine). Prénoms fictifs. */
import { test, assert } from './_t.mjs';
import { readFileSync, openAsBlob } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as P from '../js/content/poems.js';
import * as E from '../js/games/course-engine.js';
import { parseSymbols, lexiconFromTar, LEX_ID } from '../js/core/lexicon.js';
import { MODEL_URL } from '../js/core/speech.js';
import { loadLexicon } from './lexicon.mjs';
import { defaultProfile, normalizeProfile } from '../js/core/profiles.js';
import { exportProfile, parseBackup } from '../js/ui/backup.js';
import { minutesToday } from '../js/core/playtime.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = f => readFileSync(join(root, ...f.split('/')), 'utf8');
const TODAY = '2026-10-07';
const LEX = loadLexicon();
const has = w => LEX.has(w);
const NNBSP = '\u202f';

const QUATRAIN = 'Le petit lièvre dort dans l\'herbe,\nLa lune brille au fond du pré.\n\nDemain matin, sous le ciel superbe,\nIl ira courir et sauter.';
const CORBEAU = 'Maître Corbeau, sur un arbre perché,\nTenait en son bec un fromage.\nMaître Renard, par l’odeur alléché,\nLui tint à peu près ce langage :\nEt bonjour, Monsieur du Corbeau.\nQue vous êtes joli ! que vous me semblez beau !';
const VERLAINE = 'Les sanglots longs\nDes violons\nDe l’automne\nBlessent mon cœur\nD’une langueur\nMonotone.';

/* ---------- texte ---------- */
test('texte : espaces, apostrophe ’, guillemets, points de suspension, typographie française, strophes', () => {
  const raw = '  Il dit   "Viens"!\r\n\r\n\r\n\tC\'est l\'hiver...  Où vas-tu ?\n\n';
  const t = P.cleanPoemText(raw);
  assert.equal(t, 'Il dit «' + NNBSP + 'Viens' + NNBSP + '»' + NNBSP + '!\n\nC’est l’hiver… Où vas-tu' + NNBSP + '?');
  assert.equal(P.cleanPoemText(t), t, 'idempotent');
  assert.equal(P.cleanPoemText(" Il dit 'oui' "), "Il dit 'oui'", 'une apostrophe près d’une espace n’est jamais collée');
  assert.equal(P.cleanPoemText('a\n\n\n\nb'), 'a\n\nb', 'une seule ligne vide entre deux strophes');
  assert.doesNotMatch(P.cleanPoemText('a\u00a0b\u200bc\u0007d'), /[\u00a0\u200b\u0007]/);
});
test('texte : bornes (lignes, caractères, mots) appliquées en fin de vers', () => {
  const many = Array.from({ length: 100 }, (_, i) => 'vers numéro ' + (i + 1)).join('\n');
  const t = P.cleanPoemText(many);
  assert.equal(t.split('\n').length, P.LINES_MAX);
  const long = Array.from({ length: 80 }, () => 'un très long vers qui parle du vent et des nuages').join('\n');
  assert.ok(P.cleanPoemText(long).length <= P.TEXT_MAX);
  const words = Array.from({ length: 50 }, () => 'un deux trois quatre cinq six sept huit neuf dix').join('\n');
  assert.ok(P.poemLayout(P.cleanPoemText(words)).n <= P.WORDS_MAX);
  for (const l of P.cleanPoemText(words).split('\n')) assert.equal(l, 'un deux trois quatre cinq six sept huit neuf dix');
});
test('titre et auteur : une ligne, sans jetons {…}, coupés proprement ; titre par défaut = 1er vers', () => {
  assert.equal(P.cleanLabel('  Le {N}\n lièvre  ', 60), 'Le N lièvre');
  assert.ok(P.cleanLabel('x'.repeat(200), 60).length <= 60);
  assert.equal(P.firstVerse('Le petit lièvre dort dans l’herbe,\nLa lune'), 'Le petit lièvre dort dans l’herbe');
  assert.ok(P.firstVerse('a '.repeat(60)).endsWith('…'));
});

/* ---------- vers et moteur ---------- */
test('mise en page : vers, strophes, ponctuation rattachée, tiret de dialogue ; un jeton du moteur par mot affiché', () => {
  const t = P.cleanPoemText('— Bonjour ! dit-elle .\nLa lune , ronde\n\n« Viens » !\n…');
  const L = P.poemLayout(t);
  assert.deepEqual(L.tokens.map(x => x.raw.replace(/[\u00a0\u202f]/g, ' ')), ['— Bonjour !', 'dit-elle.', 'La', 'lune,', 'ronde', '« Viens » !']);
  assert.deepEqual(L.verses.map(v => [v.from, v.to, v.stanza, v.stanzaEnd]), [[0, 1, 0, false], [2, 4, 0, true], [5, 5, 1, true]]);
  for (const text of [QUATRAIN, CORBEAU, VERLAINE, t, P.cleanPoemText('Il a 2 ans ;\n— et « 3 » ?!\n... !')]) {
    const lay = P.poemLayout(P.cleanPoemText(text));
    assert.ok(P.layoutMatches(lay, E.tokenize(lay.engineText)), text.slice(0, 20));
    assert.ok(P.layoutMatches(lay, P.engineTokens(lay)));
  }
});
test('mise en page : textes au hasard (ponctuation, espaces, lignes vides) → toujours un jeton par mot', () => {
  const bits = ['le', 'Chat', 'l’', 'hiver', '!', '?', '…', '«', '»', '—', ',', 'arc-en-ciel', 'aujourd’hui', '2', '\n', '\n\n', ':', 'œil', 'Léa'];
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let k = 0; k < 300; k++) {
    const raw = Array.from({ length: 4 + Math.floor(rnd() * 30) }, () => bits[Math.floor(rnd() * bits.length)]).join(rnd() < 0.5 ? ' ' : '  ');
    const lay = P.poemLayout(P.cleanPoemText(raw));
    assert.ok(P.layoutMatches(lay, E.tokenize(lay.engineText)), JSON.stringify(raw));
  }
});
test('grammaire : formes à apostrophe et trait d’union du lexique Vosk, plus la forme collée v11 ; jamais une lettre seule', () => {
  const lay = P.poemLayout(P.cleanPoemText('L’hiver, dit-elle, arc-en-ciel'));
  const g = P.poemGrammar(E.tokenize(lay.engineText));
  for (const w of ["l'hiver", 'lhiver', 'dit-elle', 'ditelle', 'arc-en-ciel', 'arcenciel']) assert.ok(g.includes(w), w);
  assert.ok(!g.some(w => w.length === 1 && /\p{L}/u.test(w)), 'pas de « l », « d »…');
  assert.ok(has("l'hiver") && has('dit-elle') && has('arc-en-ciel') && !has('lhiver') && !has('ditelle'));
  /* la forme reconnue par Vosk (« l'hiver ») retrouve le mot attendu après normalize */
  assert.equal(E.normalize("l'hiver"), lay.tokens[0].eng ? E.normalize(lay.tokens[0].eng) : '');
});
test('mots hors lexique : moins qu’avec la grammaire v11, nombres en chiffres signalés', () => {
  const v11oov = text => P.poemLayout(P.cleanPoemText(text)).tokens.filter(t => !has(P.flatForm(t.raw))).map(t => P.bareWord(t.raw));
  assert.deepEqual(P.oovWords(P.cleanPoemText(VERLAINE), has), []);
  assert.deepEqual(v11oov(VERLAINE), ['l’automne'], '« dune » existe : « D’une » passait déjà');
  assert.deepEqual(P.oovWords(P.cleanPoemText(CORBEAU), has), []);
  assert.ok(v11oov(CORBEAU).includes('l’odeur'));
  assert.deepEqual(P.oovWords(P.cleanPoemText(QUATRAIN), has), []);
  assert.deepEqual(P.oovWords('J’ai 2 lapins et l’Oût, l’Oût', has), ['2', 'l’Oût']);
  assert.equal(P.wordKnown('anything', null), true, 'sans lexique : rien n’est signalé');
});
test('noms propres d’une poésie : la majuscule d’un début de vers n’en est pas un ; un prénom en milieu de vers, si', () => {
  const lay = P.poemLayout(P.cleanPoemText('Dans le pré, Léa chante,\nDans le bois, Léa danse.\nSous la lune'));
  const pr = P.poemProper(lay, ['l’Oût']);
  assert.ok(pr.has('lea') && pr.has('lout'));
  assert.ok(!pr.has('dans') && !pr.has('sous'));
  assert.ok(E.computeProper(E.tokenize(lay.engineText)).has('dans'), 'la règle v11 seule l’aurait pris pour un nom propre (deux majuscules)');
});

/* ---------- étapes ---------- */
test('étapes : 5, emoji de 2019 au plus, phrases pour l’enfant', () => {
  assert.equal(P.STAGES.length, P.STAGE_MAX);
  assert.deepEqual(P.STAGES.map(s => s.n), [1, 2, 3, 4, 5]);
  assert.equal(P.stageOf(0).n, 1);
  assert.equal(P.stageOf(9).n, 5);
  assert.equal(P.stageOf('3').n, 3);
});
test('masques : 1 tout ; 2 ≈ 1 mot sur 3, rimes d’abord, 1er mot de vers visible ; 3 premières lettres ; 4 débuts de vers ; 5 rien', () => {
  const lay = P.poemLayout(P.cleanPoemText(CORBEAU));
  const n = lay.n;
  const first = new Set(lay.verses.map(v => v.from));
  assert.ok(P.maskFor(lay, 1).every(m => m === 'show'));
  const m2 = P.maskFor(lay, 2);
  const hid = m2.filter(m => m === 'blank').length;
  assert.ok(Math.abs(hid - Math.round(n / 3)) <= 1, hid + ' / ' + n);
  for (const v of lay.verses) assert.equal(m2[v.to], 'blank', 'rime cachée : ' + lay.tokens[v.to].raw);
  for (const i of first) assert.equal(m2[i], 'show');
  assert.deepEqual(P.maskFor(lay, 2), m2, 'déterministe');
  const m3 = P.maskFor(lay, 3);
  lay.tokens.forEach((t, i) => assert.equal(m3[i], (t.raw.match(/\p{L}|\d/gu) || []).length <= 1 ? 'show' : 'initial'));
  const m4 = P.maskFor(lay, 4);
  lay.tokens.forEach((_, i) => assert.equal(m4[i], first.has(i) ? 'show' : 'gone'));
  assert.ok(P.maskFor(lay, 5).every(m => m === 'gone'));
});
test('morceaux d’un mot : première lettre (et après ’ ou -), ponctuation toujours visible', () => {
  const str = parts => parts.map(p => (p.hid ? '_'.repeat([...p.t].length) : p.t)).join('');
  assert.equal(str(P.wordParts('l’hiver,', 'initial')), 'l’h____,');
  assert.equal(str(P.wordParts('arc-en-ciel', 'initial')), 'a__-e_-c___');
  assert.equal(str(P.wordParts('«' + NNBSP + 'Viens', 'blank')), '«' + NNBSP + '_____');
  assert.equal(str(P.wordParts('Maître', 'show')), 'Maître');
});
test('réussite d’une étape : 85 % des mots, et pas plus d’une aide par 8 vers aux étapes par cœur', () => {
  assert.equal(P.helpsAllowed(4), 1);
  assert.equal(P.helpsAllowed(8), 1);
  assert.equal(P.helpsAllowed(9), 2);
  assert.equal(P.helpsAllowed(0), 1);
  assert.equal(P.runVerdict({ stage: 1, read: 17, total: 20, helps: 9, verses: 4 }).ok, true, 'lecture : les aides ne comptent pas');
  assert.equal(P.runVerdict({ stage: 2, read: 17, total: 20, helps: 1, verses: 4 }).ok, true);
  assert.equal(P.runVerdict({ stage: 2, read: 17, total: 20, helps: 2, verses: 4 }).ok, false);
  assert.equal(P.runVerdict({ stage: 3, read: 16, total: 20, helps: 0, verses: 4 }).ok, false);
  assert.equal(P.runVerdict({ stage: 5, read: 0, total: 0 }).ok, false);
  assert.equal(P.poemApples({ read: 20, total: 20, verses: 4 }), 4);
  assert.equal(P.poemApples({ read: 1, total: 40, verses: 8 }), 1);
  assert.equal(P.poemApples({ read: 300, total: 300, verses: 60 }), P.APPLES_MAX);
  assert.equal(P.poemApples({ read: 0, total: 10, verses: 4 }), 0);
});

/* ---------- données ---------- */
test('normalisation : poésies invalides retirées, bornes, ids uniques, étape cohérente, oov seulement si vérifié', () => {
  const list = P.normPoems([
    null, 'texte', { text: '   ' }, { text: '!!! …' },
    { id: 'po1', title: '', text: QUATRAIN, stage: 9, best: 2, runs: -3, last: 'hier', oov: ['x'] },
    { id: 'po1', title: 'Bis', text: VERLAINE, stage: 1, best: 0, lex: LEX_ID, oov: ['Oût', 'Oût', 3, ''], __proto__x: 1, futur: { a: 1 } },
    { id: 'MAUVAIS', text: CORBEAU, author: ' Jean de La Fontaine ', best: 5, done: '2026-10-01' }
  ]);
  assert.equal(list.length, 3);
  const [a, b, c] = list;
  assert.equal(a.title, 'Le petit lièvre dort dans l’herbe');
  assert.equal(a.stage, 5);
  assert.equal(a.best, 2);
  assert.equal(a.runs, 0);
  assert.equal(a.last, '');
  assert.ok(!('oov' in a) && !('lex' in a), 'oov sans lex : retiré');
  assert.notEqual(b.id, a.id);
  assert.deepEqual(b.oov, ['Oût']);
  assert.deepEqual(b.futur, { a: 1 }, 'clé inconnue conservée');
  assert.match(c.id, /^po[a-z0-9]+$/);
  assert.equal(c.author, 'Jean de La Fontaine');
  assert.equal(c.stage, 5);
  assert.equal(c.done, '2026-10-01');
  assert.deepEqual(P.normPoems(list), list, 'idempotent');
  const many = P.normPoems(Array.from({ length: 20 }, (_, i) => ({ text: 'Vers ' + i })));
  assert.equal(many.length, P.POEMS_MAX);
  assert.equal(new Set(many.map(x => x.id)).size, P.POEMS_MAX);
  assert.match(P.newPoemId(many, 1e12, () => 0.5), /^po[a-z0-9]{3,16}$/);
});
test('profil : poems normalisé, absent tant qu’aucune poésie ; voyage dans la sauvegarde du profil', () => {
  const p = defaultProfile({ id: 'p1', name: 'Léa', classe: 'CE2', today: TODAY });
  assert.ok(!('poems' in normalizeProfile(p, TODAY)));
  p.poems = [{ id: 'poabc', title: 'Le lièvre', text: QUATRAIN, created: TODAY, stage: 2, best: 1, runs: 3, last: TODAY, lex: LEX_ID, oov: [] }];
  const n = normalizeProfile(p, TODAY);
  assert.equal(n.poems.length, 1);
  assert.equal(n.poems[0].text, P.cleanPoemText(QUATRAIN));
  const { json } = exportProfile(n, { today: TODAY });
  const back = parseBackup(json, { today: TODAY });
  assert.equal(back.kind, 'profile');
  assert.deepEqual(back.payload.poems, n.poems);
});
test('fin d’un entraînement : étape suivante si réussie, rien de perdu sinon ; 🍎, minutes, série, historique sans axe', () => {
  const p = normalizeProfile(Object.assign(defaultProfile({ id: 'p1', name: 'Léa', classe: 'CE2', today: TODAY }),
    { poems: [{ id: 'poabc', title: 'Le lièvre', text: QUATRAIN, stage: 1, best: 0 }] }), TODAY);
  const apples0 = p.wallet.apples;
  const t = Date.parse(TODAY + 'T17:00:00Z');
  const lay = P.poemLayout(p.poems[0].text);
  let out = P.applyPoemRun(p, 'poabc', { stage: 1, read: lay.n, total: lay.n, helps: 0, verses: 4, ms: 90000 }, TODAY, t);
  assert.ok(out.ok && out.passed && !out.mastered);
  assert.equal(p.poems[0].stage, 2);
  assert.equal(p.poems[0].best, 1);
  assert.equal(p.poems[0].runs, 1);
  assert.equal(p.poems[0].last, TODAY);
  assert.equal(out.apples, 4);
  assert.ok(out.streakBonus > 0, 'premier jour de série');
  assert.equal(p.wallet.apples, apples0 + 4 + out.streakBonus);
  const h = p.history[p.history.length - 1];
  assert.deepEqual(h, { d: TODAY, t, g: 'course', mode: 'poesie', n: 1, ok: 1, hint: 0, ms: 90000 });
  assert.ok(!('ax' in h) && !('th' in h), 'aucun effet sur θ ni sur la balade');
  assert.equal(minutesToday(p, TODAY), 0, 'un devoir : ne compte pas dans le temps de jeu du jour (décision du parent du 08/10/2026)');
  assert.equal(p.companion.minutes, 1.5);
  assert.ok(!p.skills['fr.fluence'], 'pas de θ de fluence');
  assert.deepEqual(p.wallet.stars, {}, 'aucune étoile');
  assert.ok(!p.mclm.length, 'aucun MCLM');
  /* étape 2 ratée : on reste à l'étape 2, sans rien perdre */
  out = P.applyPoemRun(p, 'poabc', { stage: 2, read: 5, total: lay.n, helps: 3, verses: 4, ms: 60000 }, TODAY, t + 1);
  assert.ok(!out.ok && !out.passed);
  assert.equal(p.poems[0].stage, 2);
  assert.equal(p.poems[0].best, 1);
  /* relire (étape 1) ne fait jamais reculer */
  P.applyPoemRun(p, 'poabc', { stage: 1, read: lay.n, total: lay.n, verses: 4, ms: 1000 }, TODAY, t + 2);
  assert.equal(p.poems[0].stage, 2);
  /* par cœur : étapes 2 à 5 réussies → sue, date gardée */
  for (const s of [2, 3, 4]) P.applyPoemRun(p, 'poabc', { stage: s, read: lay.n, total: lay.n, helps: 1, verses: 4, ms: 1000 }, TODAY, t + 3 + s);
  out = P.applyPoemRun(p, 'poabc', { stage: 5, read: lay.n - 1, total: lay.n, helps: 0, verses: 4, ms: 1000 }, '2026-10-09', t + 9);
  assert.ok(out.mastered);
  assert.equal(p.poems[0].best, 5);
  assert.equal(p.poems[0].stage, 5);
  assert.equal(p.poems[0].done, '2026-10-09');
  assert.equal(normalizeProfile(p, TODAY).poems[0].done, '2026-10-09');
  /* aucun mot dit : rien n'est écrit */
  const before = JSON.stringify(p);
  out = P.applyPoemRun(p, 'poabc', { stage: 5, read: 0, total: lay.n, ms: 5000 }, TODAY, t + 20);
  assert.ok(out.empty && !out.ok);
  assert.equal(JSON.stringify(p), before);
  assert.equal(P.applyPoemRun(p, 'inconnu', { stage: 1, read: 3, total: 3 }, TODAY), null);
});

/* ---------- avec le moteur de la course (inchangé) ---------- */
function poemRace(text, { oov = [] } = {}) {
  const L = P.poemLayout(P.cleanPoemText(text));
  const st = E.createRace(L.engineText);
  for (const v of L.verses) if (v.to < st.target.length - 1) st.target[v.to].pause = true;
  st.proper = P.poemProper(L, oov);
  return { L, st };
}
test('moteur : une récitation entendue par Vosk (formes à apostrophe) valide toute la poésie ; un mot hors lexique passe par [unk]', () => {
  const { st } = poemRace(QUATRAIN);
  let t = 1000;
  const heard = "le petit lièvre dort dans l'herbe la lune brille au fond du pré demain matin sous le ciel superbe il ira courir et sauter";
  const words = heard.split(' ');
  for (let k = 1; k <= words.length; k++) E.processTranscript(st, words.slice(0, k).join(' '), (t += 400));
  assert.ok(st.status.every(s => s === 'read'), st.status.join(','));
  assert.ok(st.childFinished);
  const r2 = poemRace('Il fait chaud en août,\nJ’aime l’Oût suffocant.', { oov: ['l’Oût', 'suffocant'] });
  E.processTranscript(r2.st, "il fait chaud en août j'aime [unk] [unk]", 5000);
  assert.ok(r2.st.status.every(s => s === 'read'), r2.st.status.join(','));
  /* un début de vers en majuscule n'est pas validé par [unk] (pas un prénom) */
  const r3 = poemRace('Le vent souffle\nSous la lune');
  E.processTranscript(r3.st, 'le vent souffle [unk] la lune', 9000);
  assert.equal(r3.st.status[3], 'missed');
});
test('lexique sur l’appareil : la table de symboles de Gr.fst, lue au fil de l’archive, = le lexique des tests', async () => {
  assert.equal(LEX_ID, MODEL_URL.split('/').pop());
  const blob = await openAsBlob(join(root, ...MODEL_URL.split('/')));
  const words = await lexiconFromTar(blob.stream().pipeThrough(new DecompressionStream('gzip')));
  assert.equal(words.length, LEX.size);
  assert.ok(words.every(w => LEX.has(w)));
  /* table coupée → RangeError (la lecture continue alors jusqu'à la fin du fichier) */
  const fake = new Uint8Array([0, 0, 0x74, 0xfb, 0xb2, 0x7e, 3, 0, 0, 0, 0x61, 0x62]);
  assert.throws(() => parseSymbols(fake), RangeError);
  assert.throws(() => parseSymbols(new Uint8Array(64)), /introuvable/);
});

/* ---------- la course ---------- */
test('course : histoires inchangées (grammaire v11 + élisions, Zip, étoiles) ; poésies sans Zip, étoiles, question ni rapport de manche', () => {
  const src = SRC('js/games/course.js');
  assert.match(src, /grammar: \(\) => E\.grammarOf\(st\.target\)\.concat\(E\.elisionsOf\(st\.target\)\)/);
  assert.match(src, /grammar: \(\) => PO\.poemGrammar\(st\.target\)/);
  assert.match(src, /keepVoice: true/);
  const body = name => { const i = src.indexOf('function ' + name + '('); assert.ok(i > 0, name); const j = src.indexOf('\n  }\n', i); return src.slice(i, j); };
  for (const f of ['openPoemRace', 'finishPoem', 'showPoemResults', 'renderPoem', 'showVerse', 'tickPoem']) {
    const b = body(f);
    assert.doesNotMatch(b, /ctx\.report|ctx\.end\(|wallet|zipFor|starRow|showQuiz/, f);
  }
  /* rien n'est dit par Caramel pendant que le micro écoute : ni l'aide, ni le signe d'un vers bloqué, ni le rendu */
  for (const f of ['showVerse', 'tickPoem', 'renderPoem', 'scrollPoem']) assert.doesNotMatch(body(f), /voice\.say|speak/, f);
  assert.match(body('openPoemRace'), /r\.els\.fly\.remove\(\)/, 'pas de Zip');
  /* moteur et micro : jamais touchés */
  assert.doesNotMatch(SRC('js/games/course-engine.js'), /poem|poési/i);
  assert.doesNotMatch(SRC('js/core/speech.js'), /poem|poési|lexicon/i);
});
test('caractères invisibles échappés dans le code des poésies', () => {
  for (const f of ['js/content/poems.js', 'js/core/lexicon.js', 'js/ui/poems-parents.js', 'js/games/course.js']) {
    assert.doesNotMatch(SRC(f), /[\u00a0\u202f\u2000-\u200d\u2028\u2029\u2060\ufeff\uffff]/u, f);
  }
});
