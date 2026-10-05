/* Voix enregistrée du compagnon (v2.2.2) : inventaire (js/content/voice-lines.js) ↔ manifeste ↔ fichiers audio/voix,
   couverture des phrases dites par le code, règle des prénoms, composition des nombres (0 à 1 000), et choix
   clip / synthèse du téléphone dans js/ui/voice.js face à un faux Web Audio et un faux speechSynthesis.
   Prénoms fictifs uniquement. */
import { test, assert, memoryStorage } from './_t.mjs';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import * as V from '../js/content/voice-lines.js';
import { VOICE } from '../js/content/voice-manifest.js';
import { check, hashOf, BUDGET, AUDIO_DIR } from '../tools/voix.mjs';
import { toWords } from '../js/core/numbers-fr.js';
import { fillTemplate, defaultProfile } from '../js/core/profiles.js';
import * as store from '../js/core/store.js';
import { frTypo, fmtNum } from '../js/core/util.js';
import { CHEERS } from '../js/ui/kit.js';
import { MOUNTS, FOODS } from '../js/content/companion-data.js';
import { micTrouble } from '../js/ui/game-ctx.js';
import * as TL from '../js/games/tables-logic.js';
import * as PL from '../js/games/pommes-logic.js';
import { makeRng } from '../js/core/rng.js';
import * as faits from '../js/content/maths/faits.js';
import * as proc from '../js/content/maths/procedures.js';
import * as clips from '../js/core/voice-clips.js';
import * as tts from '../js/core/tts.js';

const SRC = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const has = id => !!VOICE.clips[id];
const profile = (o = {}) => ({ id: 'p1', name: 'Léa', g: 'f', classe: 'CP', companion: { type: 'pony', name: 'Noisette' }, ...o });
const namedOf = p => V.namedLines(s => fillTemplate(s, p));
const plan = (t, p = profile()) => V.planSpeech(t, { has, named: namedOf(p) });
/* un morceau à intonation de fin de phrase n'est suivi que d'une autre phrase (silence de fin de phrase), jamais d'un mot */
const finals = r => r.clips.every((c, i) => i + 1 === r.clips.length || !V.endsSentence(V.LINE_BY_ID[c.id]) || r.clips[i + 1].gap >= V.GAP.sentence);
const ok = (t, p) => {
  const r = plan(t, p);
  assert.ok(r.ok, 'non couvert : « ' + t + ' » (manque : ' + r.missing.join(', ') + ')');
  assert.ok(finals(r), 'fin de phrase au milieu : « ' + t + ' » → ' + r.clips.map(c => c.id).join(' '));
  return r;
};

test('inventaire ↔ manifeste ↔ fichiers : chaque phrase a son clip à jour, rien d’orphelin, ≤ BUDGET (1,9 Mo)', () => {
  const ids = V.LINES.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
  for (const id of ids) assert.match(id, /^[a-z0-9][a-z0-9.-]*$/, 'nom de fichier sûr : ' + id);
  const r = check();
  assert.deepEqual(r.problems, [], 'node tools/voix.mjs --check');
  assert.equal(Object.keys(VOICE.clips).length, V.LINES.length);
  for (const e of V.LINES) {
    assert.equal(VOICE.clips[e.id][1], hashOf(e), e.id + ' : empreinte du texte lu');
    assert.ok(VOICE.clips[e.id][0] >= 150 && VOICE.clips[e.id][0] <= 9000, e.id + ' : durée plausible');
  }
  let bytes = 0;
  for (const f of readdirSync(new URL('../' + AUDIO_DIR, import.meta.url))) {
    const b = readFileSync(new URL('../' + AUDIO_DIR + '/' + f, import.meta.url));
    bytes += b.length;
    assert.ok(b.length > 300, f + ' : pas vide');
    /* MPEG-2 couche III, 22,05 kHz, mono : en-tête FFF3 (ou FFF2), fréquence 00, mode canal 11 */
    const i = b.indexOf(0xff);
    assert.ok(i >= 0 && (b[i + 1] & 0xfe) === 0xf2 && ((b[i + 2] >> 2) & 3) === 0 && (b[i + 3] >> 6) === 3, f + ' : MP3 mono 22,05 kHz');
  }
  assert.ok(bytes <= BUDGET, 'poids total ' + Math.round(bytes / 1024) + ' Ko');
  assert.equal(bytes, r.bytes);
  /* hors du précache du service worker (budget 2,5 Mo) */
  assert.ok(!/'audio\//.test(SRC('sw.js')));
});

test('ce que Piper lit : français des clips (prononciation, emoji muets, ni prénom ni jeton)', () => {
  for (const e of V.LINES) {
    const t = V.synthText(e);
    assert.ok(t.length > 0, e.id);
    assert.doesNotMatch(t, /[{}]|\p{Extended_Pictographic}/u, e.id + ' : ni jeton ni emoji');
    assert.doesNotMatch(t, /'/, e.id + ' : apostrophe typographique');
    assert.doesNotMatch(t, /\b\d+(e|re|er)\b/, e.id + ' : ordinaux en lettres (« troisième »)');
  }
  /* « plus » des calculs : [plys] (espeak lit « plus » [ply]) */
  assert.equal(V.synthText(V.LINE_BY_ID['m.plus']), 'plusse');
  /* … et partout où « plus » ajoute : « combien plus 7 », « 2 plus combien », « Une de plus » [plys] ; « un peu plus
     tard » garde [ply] */
  for (const e of V.LINES) {
    if (!/\bplus\b/.test(e.text)) continue;
    if (/plus tard/.test(e.text)) assert.match(V.synthText(e), /plus tard/, e.id);
    else assert.doesNotMatch(V.synthText(e), /\bplus\b/, e.id + ' : « plusse »');
  }
  assert.equal(V.synthText(V.LINE_BY_ID['m.combien-plus']), 'combien plusse');
  assert.equal(V.synthText(V.LINE_BY_ID['m.plus-combien-f']), 'plusse combien ?');
  assert.equal(V.synthText(V.LINE_BY_ID['appris.une-de-plus-dans-ta-tete']), 'Une de plusse dans ta tête !');
  assert.equal(V.synthText(V.LINE_BY_ID['course.belle']), 'Très belle lecture ! Bats Zip pour la troisième étoile.');
  /* une phrase sans ponctuation entre deux phrases (emoji retiré) en retrouve une */
  assert.match(V.synthText(V.LINE_BY_ID['course.micro-ko']), /démarré\. Touche-le/);
  assert.equal(V.synthText(V.LINE_BY_ID['n47']), 'quarante-sept');
  assert.equal(V.synthText(V.LINE_BY_ID['n7-f']), 'sept.');
  assert.equal(V.synthText(V.LINE_BY_ID['n21-une']), 'vingt-et-une');
});

test('prénoms : variante sans prénom jouée seulement si la phrase affichée correspond à l’enfant actif', () => {
  const named = V.LINES.filter(V.isNamed);
  assert.ok(named.length >= 20);
  for (const e of named) {
    assert.ok(e.say, e.id + ' : variante sans prénom');
    assert.doesNotMatch(e.say, /[{}]|Caramel|Noisette/, e.id);
  }
  const lea = profile();
  const coucou = frTypo(fillTemplate('Coucou {P} ! Moi, c’est {N}.', lea));
  assert.deepEqual(ok(coucou).clips.map(c => c.id), ['tour.coucou']);
  assert.equal(V.LINE_BY_ID['tour.coucou'].say, 'Coucou ! C’est moi, ton compagnon !');
  /* une autre enfant, un autre compagnon : la phrase n'est pas reconnue (voix du téléphone) */
  assert.equal(plan(frTypo('Coucou Inès ! Moi, c’est Noisette.'), lea).ok, false);
  assert.equal(plan(frTypo('Coucou Léa ! Moi, c’est Biscotte.'), lea).ok, false);
  /* prénom composé, accents ; compagnon féminin (licorne) : accords */
  const zl = profile({ name: 'Zoé-Lou', companion: { type: 'unicorn', name: 'Étoile' } });
  ok(frTypo(fillTemplate('Coucou {P} ! Moi, c’est {N}.', zl)) + ' ' + frTypo('Pour jouer, touche le gros bouton Jouer !'), zl);
  assert.deepEqual(ok(frTypo(fillTemplate('{N} est déjà toute belle ✨ Reviens un peu plus tard !', zl)), zl).clips.map(c => c.id), ['soin.belle']);
  assert.deepEqual(ok(frTypo(fillTemplate('🎉 Course parfaite ! {N} est super fière de toi !', zl)), zl).clips.map(c => c.id), ['course.parfaite-f']);
  /* la ponctuation qui suit la phrase reconnue sépare bien la suivante */
  const two = ok(coucou + ' ' + frTypo('Pour jouer, touche le gros bouton Jouer !'));
  assert.deepEqual(two.clips.map(c => c.gap), [0, V.GAP.sentence]);
});

test('couverture : 1re partie, visite, bilans, course, encouragements, soins et boutique, consignes', () => {
  const p = profile();
  /* GAME_HELLO (lu dans la source, comme tests/voix.test.mjs) */
  const m = /export const GAME_HELLO = Object\.freeze\((\{[\s\S]*?\})\);/.exec(SRC('js/ui/game-shell.js'));
  for (const t of Object.values(Function('return ' + m[1])())) ok(frTypo(fillTemplate(t, p)));
  ok(frTypo('L’orchestre t’attend ! 🎻') + ' ' + frTypo(fillTemplate('{N} dirige les musiciens. À chaque bonne réponse, une note s’ajoute à ta mélodie : à la fin, l’orchestre la joue pour toi !', p)));
  /* visite guidée : toutes les étapes du CP au CE2 (CM1-CM2 : grands lecteurs, voix du téléphone) */
  const steps = [...SRC('js/ui/home.js').matchAll(/text: f\((?:again \? )?'([^']+)'(?: : '([^']+)')?\)/g)].flatMap(x => x.slice(1).filter(Boolean));
  const small = steps.filter(t => !/^(Le bouton Jouer|Ta balade du jour est finie :|Ici, tu prends soin)/.test(t));
  assert.ok(small.length >= 4, 'étapes trouvées');
  for (const t of small) ok(frTypo(fillTemplate(t, p)));
  /* bilan : praise() lue dans la source */
  const pr = /export function praise\(summary, g = 'f'\) \{([\s\S]*?)\n\}/.exec(SRC('js/ui/game-shell.js'));
  const praise = Function('summary', 'g', pr[1]);
  for (const g of ['f', 'm']) for (let n = 1; n <= 20; n++) for (const c of [0, 1, 2, n]) ok(frTypo(praise({ n, clean: Math.min(c, n) }, g)));
  ok(frTypo('Ta balade du jour est finie !'));
  /* encouragements dits : retry (devant l'astuce), learn (devant l'explication, et la bonne réponse de la course) */
  for (const t of [...CHEERS.retry, ...CHEERS.learn]) ok(t);
  for (const t of CHEERS.learn) ok(t + ' ' + frTypo('Voici la bonne réponse ✓ Elle se cachait dans le passage surligné.'));
  /* course : consignes, résultats (accord du compagnon), micro impossible */
  for (const t of ['Choisis une histoire !', 'Appuie sur le micro, puis lis l’histoire à voix haute !', 'Le micro n’a pas démarré 😕 Touche-le pour réessayer.',
    'Relis le passage, la réponse s’y cache !', '💪 Très belle lecture ! Bats Zip pour la 3e étoile.', '🌱 Bon début ! Relis cette histoire pour rattraper Zip.']) ok(frTypo(t));
  for (const fem of [true, false]) ok(frTypo('🎉 Course parfaite ! Noisette est super ' + (fem ? 'fière' : 'fier') + ' de toi !'));
  for (const code of ['not-allowed', 'audio-capture', 'network', 'unsupported']) {
    const t = micTrouble(code);
    ok(t.title.replace(/[\s\u202F]*[\p{Extended_Pictographic}\uFE0F]+$/u, '') + '. ' + t.sub);   /* course */
    ok(t.title + ' ' + frTypo('Tape la réponse avec les touches.'));                                 /* tables */
  }
  /* soins et boutique (js/ui/companion.js), pour chaque compagnon */
  for (const [type, M] of Object.entries(MOUNTS)) {
    const q = profile({ companion: { type, name: 'Noisette' } });
    const say = s => frTypo(fillTemplate(s, q));
    const fem = M.g === 'f';
    for (const f of FOODS) ok(say('{N} croque ' + f.e + ' avec appétit. Miam !'), q);
    ok(say('{N} est déjà ' + (fem ? 'toute belle' : 'tout beau') + ' ✨ Reviens un peu plus tard !'), q);
    const coat = M.kind === 'dolphin' ? 'quelle peau toute douce !' : M.kind === 'dragon' ? 'quelles belles écailles !' : 'quel beau poil !';
    ok(say('{N} adore le brossage, ' + coat + ' ✨'), q);
    for (const s of ['{N} a déjà eu sa promenade du jour 🚶 À demain !', '{N} part en promenade, quel bonheur ! 🚶', '{N} est en promenade… attends son retour ! 🚶',
      'C’est à toi ! {N} est trop chic ! ✨', '{N} est trop chic ! ✨']) ok(say(s), q);
    ok(frTypo('Et en ' + M.noun + ' ? ' + M.em), q);
    ok(frTypo('C’est à toi ! ' + M.em), q);
  }
  const items = ['le foulard', 'le nœud', 'le chapeau', 'les lunettes', 'l’écharpe', 'la selle dorée', 'la couronne', 'les ailes de fée'];
  for (const a of items) {
    ok(frTypo(fillTemplate('{N} essaie ' + a + ' ✨', p)));
    const pl = /^les /.test(a), cap = a.charAt(0).toUpperCase() + a.slice(1);
    ok(frTypo(cap + (pl ? ' retournent' : ' retourne') + ' dans le coffre.'));
    for (const b of items) if (b !== a) ok(frTypo(cap + (pl ? ' remplacent ' : ' remplace ') + b + ' ✨'));
  }
  /* « six pommes » [si] : variantes enregistrées pour 6, 8, 10, 18 ; 26, 28, 36… 98 pommes : voix du téléphone */
  const noPc = new Set([26, 28, 36, 38, 46, 48, 56, 58, 66, 68, 70, 78, 86, 88, 90, 98]);
  for (let n = 1; n <= 300; n++) {
    const t = frTypo('Il te manque ' + n + '\u00A0🍎. Tu les gagnes en jouant !');
    if (noPc.has(n % 100)) assert.deepEqual(plan(t).sentences.map(x => x.ok), [false, true], t);
    else ok(t);
  }
  /* consignes des jeux, premiers pas, essai des parents */
  for (const t of ['Tape la réponse sur le pavé.', 'Tape la réponse, ou touche 🎤 et dis-la.', 'Pour ce calcul, tape la réponse.',
    'Dis ta réponse, ou tape-la sur le pavé.', 'Calcule dans ta tête, puis tape ta réponse.', 'Touche la clôture pour poser la carotte, puis valide.',
    'Quel nombre se cache sous le drapeau ?', 'Une question pour tes parents. Montre cet écran à un adulte.']) ok(frTypo(t));
  ok(frTypo(fillTemplate('Bonjour {P} ! Je suis {N}, et je lis les consignes à voix haute.', p)));
});

test('nombres : 0 à 1 000 (et au-delà) composés, mots justes, intonation, « une » devant un nom féminin', () => {
  const words = id => V.synthText(V.LINE_BY_ID[id]).replace(/\.$/, '');
  const norm = s => s.replace(/-/g, ' ').replace(/\b(cent|vingt)s\b/g, '$1').replace(/\s+/g, ' ').trim();
  const pick = id => (has(id) ? id : /-f$/.test(id) && has(id.slice(0, -2)) ? id.slice(0, -2) : null);
  for (let n = 0; n <= 1000; n++) {
    for (const end of ['c', 'f']) {
      const ids = V.numberClips(String(n), { end }).map(pick);
      assert.ok(ids.every(Boolean), n + ' : clips présents');
      assert.equal(norm(ids.map(words).join(' ')), norm(toWords(n)), n + ' (' + end + ')');
    }
  }
  for (const n of [1001, 1234, 20000, 99999, 123456, 999999, 1000000, 2500000]) {
    const ids = V.numberClips(String(n)).map(pick);
    assert.equal(norm(ids.map(words).join(' ')), norm(toWords(n)), String(n));
    ok(fmtNum(n) + ' plus 1 égale combien ?');
  }
  /* décimaux : « 3,05 » → trois virgule zéro cinq */
  assert.deepEqual(V.numberClips('3,05', { end: 'f' }), ['n3', 'virgule', 'n0', 'n5-f']);
  assert.deepEqual(V.numberClips('0,5', { end: 'c' }), ['n0', 'virgule', 'n5']);
  /* intonation : fin de phrase descendante (variante -f jusqu'à 20), question montante, « une » */
  assert.deepEqual(ok('4 plus 3 égale 7.').clips.map(c => c.id).slice(-1), ['n7-f']);
  assert.deepEqual(ok('Combien fois 8 égale 56 ?').clips.map(c => c.id).slice(-1), ['n56']);
  assert.deepEqual(ok('Il te manque 1\u00A0🍎. Tu les gagnes en jouant !').clips.map(c => c.id).slice(0, 3), ['m.il-te-manque', 'n1-une', 'm.pomme-f']);
  assert.ok(ok('Il te manque 21\u00A0🍎.').clips.some(c => c.id === 'n21-une'));
  assert.ok(ok('Il te manque 11\u00A0🍎.').clips.some(c => c.id === 'n11'), 'onze : pas d’accord');
  ok('Il te manque 101\u00A0🍎.');
  /* silences entre morceaux : rien, virgule, deux-points, phrase */
  const g = ok('Le double de 4, c’est 4 + 4.').clips.map(c => c.gap);
  assert.deepEqual(g, [0, V.GAP.word, V.GAP.comma, V.GAP.word, V.GAP.word, V.GAP.word]);
});

test('questions de calcul composées : tables, pommes, clôture, opérations (CP-CE1 : toutes)', () => {
  for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) {
    ok(`${a} fois ${b} égale combien\u202F?`);
    ok(`${a} plus ${b} égale combien\u202F?`);
    ok(`combien plus ${a} égale ${a + b}\u202F?`);
  }
  for (const A of [0, 0.5, 1, 1.5, 2]) {
    const rng = makeRng(11 + A * 10);
    for (let i = 0; i < 60; i++) {
      const it = faits.gen(A, rng, {});
      ok(TL.promptAria(TL.promptParts(it)) + ' ' + frTypo('Dis ta réponse, ou tape-la sur le pavé.'));
      const pi = proc.gen(A, rng, {});
      ok(PL.promptAria(pi.prompt));
    }
  }
  for (let n = 0; n <= 1000; n += 7) ok(`Place ${n} sur la clôture. Touche la clôture pour poser la carotte, puis valide.`);
  ok('Unités : 7 plus 5. Quel chiffre écris-tu ?');
  ok('Dizaines : 4 plus 3 plus 1 de retenue. Quel chiffre écris-tu ?');
  ok('Presque ! Le double de 4, c’est 4 plus 4.');
  /* ce qui n'est pas enregistré part à la voix du téléphone : question de compréhension d'une histoire */
  assert.equal(plan('Petite question : Où Léa a-t-elle caché la clé ?').ok, false);
});

test('jamais faux : symbole inconnu → téléphone, « six pommes » [si], liaisons, intonation de fin en fin de phrase seulement', () => {
  const ids = (t, p) => ok(t, p).clips.map(c => c.id);
  /* un symbole que l'inventaire n'a pas n'est jamais tu (2.2.1 : le téléphone disait « euros ») */
  for (const t of ['4,56 € + 1 €.', '4,56 € + 15,30 € = 19,86 €.', 'La moitié de 50 %.', 'Place 3/4 sur la clôture.', '7 < 8.', 'Il fait 20 °.']) {
    const r = plan(t);
    assert.equal(r.ok, false, t);
    assert.ok(r.missing.some(w => /^[^\p{L}\d]$/u.test(w)), t + ' : ' + r.missing.join(' '));
  }
  assert.deepEqual(ids('La prochaine fois, ce sera la bonne ! 519,43 plus 265,33 égale 784,76.').slice(0, 1), ['appris.la-prochaine-fois-ce-sera-la-bonne']);
  const cm2 = plan(frTypo('La prochaine fois, ce sera la bonne ! 519,43\u202F€ + 265,33\u202F€ = 784,76\u202F€. Vérifie : 784,76\u202F€ − 265,33\u202F€ = 519,43\u202F€.'));
  assert.deepEqual(cm2.sentences.map(x => x.ok), [true, false, false], 'sans voix française : seul l’encouragement');
  /* six, huit, dix devant le nom qu'ils comptent : [si] [ɥi] [di] (« six fois sept » comme Piper le lit d'une traite) */
  assert.deepEqual(ids('6 fois 7 égale combien\u202F?'), ['n6-pc', 'm.fois', 'n7', 'm.egale-combien-f']);
  assert.deepEqual(ids('7 fois 6 égale combien\u202F?'), ['n7', 'm.fois', 'n6', 'm.egale-combien-f']);
  assert.deepEqual(ids('Tu as trouvé 6 réponses du premier coup !'), ['m.tu-as-trouve', 'n6-pc', 'm.reponses-du-premier-coup-f']);
  assert.deepEqual(ids('Il te manque 8\u00A0🍎.'), ['m.il-te-manque', 'n8-pc', 'm.pommes-f']);
  assert.deepEqual(ids('Il te manque 118\u00A0🍎.'), ['m.il-te-manque', 'n100', 'n18-pc', 'm.pommes-f']);
  assert.deepEqual(ids('Entre 0 et 10, il y a 10 petits intervalles : chaque petit piquet vaut 1.'),
    ['m.entre', 'n0', 'm.et', 'n10', 'm.il-y-a', 'n10-pc', 'm.petits-intervalles', 'm.chaque-petit-piquet-vaut', 'n1-f']);
  assert.deepEqual(ids('Place 6 sur la clôture.'), ['m.place', 'n6', 'm.sur-la-cloture-f'], 'pas un nom : [sis]');
  assert.deepEqual(V.numberClips('6000'), ['n6-pc', 'mille-f']);
  assert.deepEqual(V.numberClips('10000', { end: 'c' }), ['n10-pc', 'mille']);
  assert.deepEqual(V.numberClips('26000'), ['n26', 'mille-f'], 'pas de variante : inchangé');
  for (const [id, said] of [['n6-pc', 'si'], ['n8-pc', 'hui'], ['n10-pc', 'di'], ['n18-pc', 'dix-hui']]) {
    assert.equal(V.synthText(V.LINE_BY_ID[id]), said);
    assert.ok(V.commonIds().includes(id), id + ' : préchargé avec les nombres courants');
  }
  /* 26, 28… 98 devant un nom, liaison devant une voyelle (« trois unités ») : non enregistrés → téléphone */
  for (const t of ['Il te manque 26\u00A0🍎.', 'Le drapeau est 70 petits piquets après 100.', '2 dizaines et 3 unités.', 'Il y a 2 unités.', 'Il y a 20 unités.', 'Il y a 300 unités.']) {
    assert.equal(plan(t).ok, false, t);
  }
  ids('2 dizaines et 4 unités.');
  ids('Il y a 8 unités.');
  ids('Il te manque 1\u00A0🍎.');
  /* intonation : un morceau de fin de phrase n'est joué qu'en fin de phrase */
  assert.equal(plan('Ajouter 1, c’est trouver le nombre qui vient juste après 7.').ok, false);
  assert.deepEqual(ids('Ajouter 1, c’est trouver le nombre qui vient juste après.'), ['m.ajouter', 'n1', 'm.trouver-apres-f']);
  for (const A of [0, 0.5, 1, 1.5, 2]) {
    const rng = makeRng(29 + A * 10);
    for (let i = 0; i < 80; i++) {
      for (const t of [proc.gen(A, rng, {}), faits.gen(A, rng, {})].flatMap(it => [it.hint, it.explain])) {
        const r = plan(String(t || ''));
        if (r.ok) assert.ok(finals(r), t);
      }
    }
  }
});

/* ---------- lecture : faux Web Audio, faux speechSynthesis ---------- */
function fakeAudio({ failFetch = () => false } = {}) {
  const log = [];
  const store = new Map();
  const ac = {
    state: 'running', currentTime: 0, destination: {},
    resume: async () => {},
    decodeAudioData(data) {
      const id = new TextDecoder().decode(data);
      const ms = (VOICE.clips[id] || [500])[0];
      const n = Math.round(22050 * (ms + 100) / 1000);
      const d = new Float32Array(n);
      for (let i = 1100; i < n - 1100; i++) d[i] = 0.3;         /* ≈ 50 ms de silence de tête et de queue (décodeur) */
      return Promise.resolve({ id, duration: n / 22050, sampleRate: 22050, getChannelData: () => d });
    },
    createBufferSource() {
      const s = {
        buffer: null, onended: null, connect() {}, disconnect() {},
        start(t, off, dur) { log.push({ k: 'start', id: s.buffer.id, t, off, dur }); setTimeout(() => { if (!s.stopped && s.onended) s.onended(); }, 15); },
        stop() { s.stopped = true; log.push({ k: 'stop', id: s.buffer.id }); }
      };
      return s;
    }
  };
  const caches = {
    async open() {
      return {
        async match(u) { return store.has(u) ? new Response(store.get(u)) : undefined; },
        async put(u, res) { store.set(u, new Uint8Array(await res.arrayBuffer())); },
        async keys() { return [...store.keys()].map(u => ({ url: 'https://exemple.test/caramel/' + u })); },
        async delete(r) { return store.delete(String(r.url).replace('https://exemple.test/caramel/', '')); }
      };
    }
  };
  const fetches = [];
  const fetch = async url => {
    fetches.push(url);
    if (failFetch(url)) throw new TypeError('hors ligne');
    const id = /audio\/voix\/([^?]+)\.mp3/.exec(url)[1];
    return new Response(new TextEncoder().encode(id), { status: 200 });
  };
  clips._setBackend({ context: () => ac, fetch, caches });
  return { ac, log, store, fetches };
}
function fakeTts({ voices = [{ name: 'Français', lang: 'fr-FR', localService: true, voiceURI: 'fr' }] } = {}) {
  const said = [];
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  globalThis.speechSynthesis = {
    speaking: false, pending: false, paused: false,
    getVoices: () => voices, addEventListener() {}, removeEventListener() {}, resume() {}, cancel() {},
    speak(u) { said.push(u.text); setTimeout(() => { u.onstart && u.onstart(); u.onend && u.onend(); }, 5); }
  };
  tts._reset();
  return said;
}
function cleanup() {
  clips._setBackend(null);
  delete globalThis.speechSynthesis;
  delete globalThis.SpeechSynthesisUtterance;
  tts._reset();
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* v2.2.2 (décision du parent du 04/10/2026) : une phrase composée part à la voix fluide, sinon à la voix du téléphone ;
   les clips composés ne sont plus que le dernier recours, sans voix française sur le téléphone */
test('lecture sans voix du téléphone : phrase composée → clips enchaînés (silences de tête retirés, écarts voulus)', async () => {
  const voice = await import('../js/ui/voice.js');
  const a = fakeAudio(), said = fakeTts({ voices: [{ name: 'English', lang: 'en-US', localService: true, voiceURI: 'en' }] });
  try {
    assert.equal(await voice.speak('7 fois 8 égale combien\u202F?', { force: true }), true);
    const st = a.log.filter(e => e.k === 'start');
    assert.deepEqual(st.map(e => e.id), ['n7', 'm.fois', 'n8', 'm.egale-combien-f']);
    assert.deepEqual(said, [], 'synthèse du téléphone jamais appelée');
    for (let i = 1; i < st.length; i++) {
      const gap = st[i].t - (st[i - 1].t + st[i - 1].dur);
      assert.ok(Math.abs(gap - V.GAP.word / 1000) < 1e-6, 'écart ' + gap);
    }
    assert.ok(st.every(e => e.off > 0.04 && e.off < 0.06), 'silence de tête du décodeur retiré');
    assert.equal(voice.health(), 'ok');
    /* mis en cache à la première écoute, puis servi sans réseau */
    const n = a.fetches.length;
    assert.equal(n, 4);
    clips._setBackend({ context: () => a.ac, fetch: async () => { throw new TypeError('hors ligne'); }, caches: { open: async () => ({ match: async u => (a.store.has(u) ? new Response(a.store.get(u)) : undefined), put: async () => {} }) } });
    assert.equal(await voice.speak('7 fois 8 égale combien\u202F?', { force: true }), true, 'hors ligne : depuis le cache');
  } finally { cleanup(); }
});

test('lecture : non couverte → synthèse ; clip introuvable hors ligne → synthèse ; pas de voix française → phrases couvertes seules', async () => {
  const voice = await import('../js/ui/voice.js');
  let a = fakeAudio(), said = fakeTts();
  try {
    assert.equal(await voice.speak('Petite question : où Léa a-t-elle caché la clé ?', { force: true }), true);
    assert.equal(said.length, 1, 'voix du téléphone');
    assert.equal(a.log.length, 0, 'aucun clip');
    /* hors ligne, jamais entendu : la synthèse prend le relais */
    a = fakeAudio({ failFetch: () => true });
    said.length = 0;
    assert.equal(await voice.speak('9 plus 3 égale combien\u202F?', { force: true }), true);
    assert.deepEqual(said, ['9 plus 3 égale combien?']);
    /* téléphone sans voix française : les phrases couvertes sont dites, les autres se taisent (texte affiché) */
    a = fakeAudio();
    const none = fakeTts({ voices: [{ name: 'English', lang: 'en-US', localService: true, voiceURI: 'en' }] });
    assert.equal(voice.voiceOn({ classe: 'CP', settings: {} }), true, 'la voix enregistrée suffit');
    await voice.speak('Presque ! Pars de 12 et compte jusqu’à 15 : combien de pas fais-tu ?', { force: true });
    assert.deepEqual(a.log.filter(e => e.k === 'start').map(e => e.id), ['retry.presque']);
    assert.deepEqual(none, []);
  } finally { cleanup(); }
});

test('visite guidée des CM1-CM2 (v2.2.2, lecture pour tous) : chaque étape dite par la voix enregistrée, sans le prénom', () => {
  const home = SRC('js/ui/home.js');
  const at = home.indexOf('return [', home.indexOf("if (q.classe === 'CM1' || q.classe === 'CM2')"));
  assert.ok(at > 0);
  const cm = home.slice(at, home.indexOf('];', at));
  const texts = [...cm.matchAll(/'([^'\n]{20,})'/g)].map(m => m[1]);
  assert.equal(texts.length, 3, 'Jouer, Encore un jeu, soins');
  for (const comp of [{ type: 'pony', name: 'Noisette' }, { type: 'unicorn', name: 'Étoile' }, { type: 'dragon', name: 'Jean-Paul' }]) {
    const zoe = profile({ name: 'Zoé', classe: 'CM2', companion: comp });
    for (const t of texts) assert.equal(ok(frTypo(fillTemplate(t, zoe)), zoe).clips.length, 1, t);
  }
  assert.equal(V.LINE_BY_ID['tour.cm-soins'].say.includes('moi'), true, 'le compagnon parle de lui sans son nom');
  assert.ok(V.commonIds().includes('tour.cm-jouer'), 'préchargée avec la visite');
});

test('« 📲 Mets Caramel sur l’écran d’accueil » côté enfant : titre, pourquoi et marche à suivre dits par la voix enregistrée', async () => {
  const I = await import('../js/ui/install.js');
  for (const [m, desk] of [['ios-safari', false], ['ios-chrome', false], ['prompt', false], ['prompt', true]]) {
    const s = I.kidSpeech(m, desk);
    const open = ok(s.open), all = ok(s.all);
    assert.equal(open.clips.length, 2, m + ' : titre puis pourquoi');
    assert.ok(all.clips.every(c => c.id.startsWith('inst.')), m + ' : ' + all.clips.map(c => c.id).join(' '));
    assert.equal(all.clips.length, m.startsWith('ios') ? 5 : 2, m + ' : la marche à suivre sur iPhone et iPad seulement');
    assert.ok(s.all.startsWith(s.open));
  }
  /* la phrase dite suit la pastille affichée (Partager, Sur l'écran d'accueil / Ajouter à l'écran d'accueil, Ajouter) */
  const src = SRC('js/ui/install.js');
  for (const [m, labels] of [['ios-safari', ['Partager', 'Sur l’écran d’accueil', 'Ajouter']], ['ios-chrome', ['Partager', 'Ajouter à l’écran d’accueil', 'Ajouter']]]) {
    labels.forEach((l, i) => {
      assert.ok(I.KID_STEPS_SAY[m][i].includes(l), m + ' pas ' + (i + 1) + ' : « ' + l + ' »');
      assert.ok(src.includes(`'${l}')`), 'pastille « ' + l + ' » affichée');
    });
  }
  assert.ok(!V.commonIds().some(id => id.startsWith('inst.')), 'pas de préchargement : dite une fois par appareil');
  /* VE-fix : voix fluide pas prête (1er lancement, iPhone), voix française du téléphone disponible → ses clips, pas le
     téléphone (avant : seule une phrase d'UN clip restait un clip) */
  const voice = await import('../js/ui/voice.js');
  const a = fakeAudio(), said = fakeTts();
  try {
    for (const [m, ids] of [['prompt', ['inst.titre', 'inst.pourquoi']], ['ios-safari', ['inst.titre', 'inst.pourquoi', 'inst.safari-1', 'inst.safari-2', 'inst.ajouter']]]) {
      a.log.length = 0;
      assert.equal(await voice.speak(I.kidSpeech(m, false).all, { force: true }), true, m);
      assert.deepEqual(a.log.filter(e => e.k === 'start').map(e => e.id), ids, m);
    }
    assert.deepEqual(said, [], 'voix du téléphone jamais appelée');
  } finally { cleanup(); }
});

test('lecture à voix haute pour tous (v2.2.2) : CM2 et ancien « automatique » → activée ; Non → ni voix ni 🔊 ; sons coupés → 🔊 seul', async () => {
  const voice = await import('../js/ui/voice.js');
  fakeAudio();
  fakeTts();
  try {
    const cm2 = { classe: 'CM2', settings: {} };
    assert.equal(voice.readAloud(cm2), true, 'CM2, réglage absent');
    assert.equal(voice.readAloud({ classe: 'CM1', settings: { readAloud: 'auto' } }), true, 'ancien automatique (CP-CE1)');
    assert.equal(voice.voiceOn(cm2), true, 'lecture automatique');
    assert.equal(voice.listenOn(cm2), true, '🔊 montré');
    const no = { classe: 'CP', settings: { readAloud: 'off' } };
    assert.equal(voice.readAloud(no), false);
    assert.equal(voice.voiceOn(no), false, 'Non : rien n’est lu');
    assert.equal(voice.listenOn(no), false, 'Non : 🔊 caché');
    assert.equal(voice.listenOn({ classe: 'CE2', settings: { readAloud: false } }), false, 'ancien booléen faux');
    const mute = { classe: 'CM2', settings: { sound: false } };
    assert.equal(voice.voiceOn(mute), false, 'sons coupés : rien n’est lu tout seul');
    assert.equal(voice.listenOn(mute), true, 'sons coupés : 🔊 reste (un toucher est un geste explicite)');
    assert.equal(voice.readAloud(null), false, 'aucun profil');
    const n = voice.stats();
    assert.equal(await voice.speak('Trouvé du premier coup, bravo\u202F!', { force: true }), true);
    assert.equal(voice.stats().rec, n.rec + 1, 'phrase comptée pour le diagnostic');
  } finally { cleanup(); }
});

test('lecture : hush() coupe les clips, settle() attend leur fin ; une nouvelle phrase remplace la précédente', async () => {
  const voice = await import('../js/ui/voice.js');
  const a = fakeAudio();
  fakeTts();
  try {
    const p = voice.speak('Lis l’histoire à voix haute : à chaque mot que tu lis, j’avance\u202F!', { force: true });
    await sleep(2);
    voice.hush();
    assert.equal(await p, false);
    assert.equal(clips.playing(), false);
    await voice.settle();
    /* settle sans hush : attend la fin des clips */
    const q = voice.speak('Presque !', { force: true });
    await sleep(1);
    const t0 = Date.now();
    await voice.settle();
    assert.equal(await q, true);
    assert.ok(Date.now() - t0 >= 0);
    /* deux phrases de suite : la 1re est coupée */
    const r1 = voice.speak('Courage !', { force: true });
    const r2 = voice.speak('Tu chauffes !', { force: true });
    assert.equal(await r1, false);
    assert.equal(await r2, true);
    assert.ok(a.log.some(e => e.k === 'stop'));
  } finally { cleanup(); }
});

test('« Tester la voix » : la voix enregistrée (sans prénom) puis celle du téléphone, chacune avec son résultat', async () => {
  const voice = await import('../js/ui/voice.js');
  const a = fakeAudio(), said = fakeTts();
  try {
    const r = await voice.test(frTypo('Bonjour Léa ! Je suis Noisette, et je lis les consignes à voix haute.'));
    /* sans profil actif (tests) : la phrase à prénom n'est pas reconnue ; la voix du téléphone la dit */
    assert.equal(r.rec.ok, false);
    assert.equal(r.rec.reason, 'not-covered');
    assert.equal(r.tts.ok, true);
    assert.equal(said.length, 1);
    const r2 = await voice.test('Courage !');
    assert.equal(r2.rec.ok, true);
    assert.equal(r2.tts.ok, true);
    assert.equal(r2.ok, true);
    assert.deepEqual(a.log.filter(e => e.k === 'start').map(e => e.id), ['retry.courage']);
  } finally { cleanup(); }
});

test('« Tester la voix » d’un enfant qui n’est pas l’enfant actif : sa phrase à prénom est reconnue', async () => {
  const voice = await import('../js/ui/voice.js');
  const a = fakeAudio(), said = fakeTts();
  const D = '2026-10-04';
  store.init(memoryStorage(), D);
  try {
    store.addProfile({ ...defaultProfile({ id: 'p1', name: 'Léa', g: 'f', classe: 'CP', today: D }), companion: { type: 'pony', name: 'Noisette' } });
    store.addProfile({ ...defaultProfile({ id: 'p2', name: 'Tom', g: 'm', classe: 'CE1', today: D }), companion: { type: 'unicorn', name: 'Perle' } });
    store.setActive('p1');
    const tom = store.getProfile('p2');
    const text = frTypo(fillTemplate('Bonjour {P} ! Je suis {N}, et je lis les consignes à voix haute.', tom));
    assert.match(text, /Tom/);
    /* 2.2.2 : le plan était fait pour l'enfant actif (Léa) → « not-covered » */
    assert.equal((await voice.test(text)).rec.reason, 'not-covered');
    a.log.length = 0;
    said.length = 0;
    const r = await voice.test(text, { profile: tom });
    assert.equal(r.rec.ok, true);
    assert.equal(r.ok, true);
    assert.deepEqual(a.log.filter(e => e.k === 'start').map(e => e.id), ['divers.test']);
    assert.deepEqual(said, [frTypo('Bonjour Tom ! Je suis Perle, et je lis les consignes à voix haute.').replace(/\u202F/g, '\u202F')].map(t => voice.speakable(t)));
    /* l'enfant actif, sans option : inchangé */
    const lea = store.getProfile('p1');
    assert.equal((await voice.test(frTypo(fillTemplate('Bonjour {P} ! Je suis {N}, et je lis les consignes à voix haute.', lea)))).rec.ok, true);
  } finally { cleanup(); store.init(memoryStorage(), D); }
});

test('cache de la voix : préchargement en tâche de fond (phrases courantes), anciennes versions retirées', async () => {
  const a = fakeAudio();
  try {
    const ids = V.commonIds();
    assert.ok(ids.length >= 100 && ids.includes('tour.coucou') && ids.includes('n7') && ids.includes('m.egale-combien-f'));
    assert.ok(ids.every(has));
    const kb = ids.reduce((s, id) => s + statSync(new URL('../' + AUDIO_DIR + '/' + id + '.mp3', import.meta.url)).size, 0) / 1024;
    /* 600 Ko avant la voix d'enfant ; coupure MP3 relevée de 7 à 9,3 kHz (les « s » montés de 1,33) : ≈ +12 % */
    assert.ok(kb < 700, 'préchargement raisonnable : ' + Math.round(kb) + ' Ko');
    assert.ok(!ids.some(id => /^(soin|boutique)\./.test(id)), 'soins et boutique : à la première écoute');
    assert.equal(await clips.prefetch(ids.slice(0, 5), { gapMs: 0 }), 5);
    assert.equal(await clips.prefetch(ids.slice(0, 6), { gapMs: 0 }), 1, 'déjà en cache : pas de nouveau téléchargement');
    a.store.set('audio/voix/n7.mp3?v=00000000', new Uint8Array([1]));
    a.store.set('audio/voix/retire.mp3?v=12345678', new Uint8Array([1]));
    assert.equal(await clips.prune(), 2);
    assert.equal(a.store.size, 6);
    assert.equal(clips.urlOf('n7'), 'audio/voix/n7.mp3?v=' + VOICE.clips.n7[1]);
  } finally { cleanup(); }
});

test('règles inchangées : micro, son coupé, geste, arrière-plan ; course et moteur vocal non touchés', () => {
  const v = SRC('js/ui/voice.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(v, /if \(!force && !voiceOn\(\)\) return Promise\.resolve\(null\);\s*if \(micOpen\(\) \|\| !activated\(\)\) return Promise\.resolve\(null\);/);
  assert.match(v, /if \(micOpen\(\)\) hush\(\);/, 'micro ouvert pendant un clip : silence');
  assert.match(v, /visibilitychange[\s\S]*?hush\(\)/);
  /* v2.2.2 : hush() coupe aussi la voix fluide et vide sa file */
  assert.match(v, /export function hush\(\) \{\s*seq\+\+;\s*try \{ clips\.stop\(\); \} catch \(_\) \{\}\s*try \{ fluid\.stop\(\); fluid\.cancelQueue\(\); \} catch \(_\) \{\}\s*try \{ tts\.stopSpeaking\(\); \} catch \(_\) \{\}/);
  assert.match(v, /if \(!clips\.playing\(\) && !fluid\.playing\(\)\)/, 'micro ouvert pendant la voix fluide : silence aussi');
  assert.match(v, /const canSpeak = \(\) => clips\.supported\(\) \|\| tts\.ttsAvailable\(\);/);
  assert.match(v, /readAloud\(profile\) && soundOn\(profile\) && !audio\.isMuted\(\) && canSpeak\(\)/);
  assert.doesNotMatch(SRC('js/core/speech.js'), /voice-clips|voice-lines|voice-fluid|piper/);
  assert.doesNotMatch(SRC('js/games/course-engine.js'), /voice-clips|voice-lines|voice-fluid|piper/);
});
