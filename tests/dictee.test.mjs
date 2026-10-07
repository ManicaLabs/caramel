/* La dictée de la semaine (v2.6) : saisie de l'adulte → liste, normalisation de profile.dictee, ordre « à revoir
   d'abord », rituel « mot… phrase… mot », bilan sans note, générateur fr.ortho dans une vraie manche (θ inchangé,
   Leitner, pas de filet), balade seulement avec une liste, export dans la sauvegarde, débit ralenti de la voix fluide et
   du téléphone. Prénoms fictifs uniquement. */
import { test, assert, memoryStorage } from './_t.mjs';
import { readFileSync, existsSync } from 'node:fs';
import * as D from '../js/core/dictee.js';
import * as G from '../js/content/fr/dictee.js';
import * as store from '../js/core/store.js';
import { defaultProfile, normalizeProfile } from '../js/core/profiles.js';
import { createManche } from '../js/core/manche.js';
import { eligibleAxes, planDay } from '../js/core/session.js';
import { GAME_BY_ID, AXIS_GAME, gamesFor, mancheSize } from '../js/games/index.js';
import { hasGenerator, loadGenerator } from '../js/content/index.js';
import { exportProfile, parseBackup } from '../js/ui/backup.js';
import * as F from '../js/core/voice-fluid.js';
import * as tts from '../js/core/tts.js';
import { addDays } from '../js/core/util.js';

const DAY = '2026-10-07';
const SRC = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const NNBSP = '\u202F';

/* ---------- saisie de l'adulte ---------- */
test('saisie : un mot par ligne ou séparés par des virgules, phrase facultative après « : »', () => {
  const r = D.parseList('maison : je rentre à la maison\nun chat, le chien ; la forêt\n\n  arc-en-ciel  \nvert\tLe pré est vert !\nverre - Je bois dans un verre.');
  assert.deepEqual(r.words, [
    { w: 'maison', s: 'Je rentre à la maison.' },
    { w: 'un chat' }, { w: 'le chien' }, { w: 'la forêt' },
    { w: 'arc-en-ciel' },
    { w: 'vert', s: 'Le pré est vert !' },
    { w: 'verre', s: 'Je bois dans un verre.' }
  ]);
  assert.equal(r.extra, 0);
  assert.equal(r.dup, 0);
});

test('saisie : apostrophes typographiques, puces et numéros retirés, doublons et 20 mots au plus', () => {
  const r = D.parseList("1. aujourd'hui\n- l`école\n• Maison\nmaison\n2) chat");
  assert.deepEqual(r.words.map(e => e.w), ['aujourd’hui', 'l’école', 'Maison', 'chat']);
  assert.equal(r.dup, 1, '« maison » = « Maison » (même mot en minuscules)');
  const many = D.parseList(Array.from({ length: 25 }, (_, i) => 'mot' + 'abcdefghijklmnopqrstuvwxy'[i]).join(', '));
  assert.equal(many.words.length, D.MAX_WORDS);
  assert.equal(many.extra, 5);
  assert.deepEqual(D.parseList('').words, []);
  assert.deepEqual(D.parseList('  \n , ; \n123').words, [], 'ni chiffres ni ponctuation seule');
  /* trait d'union collé : dans le mot ; tiret entouré d'espaces : séparateur de la phrase */
  assert.deepEqual(D.parseList('peut-être - Il viendra peut-être.').words, [{ w: 'peut-être', s: 'Il viendra peut-être.' }]);
  /* longueurs bornées */
  const long = D.parseList('a'.repeat(60) + ' : ' + 'b'.repeat(300));
  assert.ok(long.words[0].w.length <= D.MAX_WORD_LEN);
  assert.ok(long.words[0].s.length <= D.MAX_PHRASE_LEN + 1);
  assert.equal(long.cut, 1);
});

test('nettoyage : un mot garde lettres, accents, ’, trait d’union ; une phrase prend majuscule et point', () => {
  assert.equal(D.cleanWord('  Œuf  '), 'Œuf');
  assert.equal(D.cleanWord('<b>chat</b>'), 'b chat b');
  assert.equal(D.cleanWord('arc - en - ciel'), 'arc-en-ciel');
  assert.equal(D.cleanWord("presqu ' île"), 'presqu’île');
  assert.equal(D.cleanWord('\u0000\u0007'), '');
  assert.equal(D.cleanPhrase('le chat dort'), 'Le chat dort.');
  assert.equal(D.cleanPhrase('Où est le chat ?'), 'Où est le chat ?');
  assert.equal(D.cleanPhrase('{P} <script>'), 'P script.');
  assert.equal(D.cleanPhrase(' : '), '');
  assert.equal(D.keyOf('À'), 'fr.ortho:à');
  assert.notEqual(D.keyOf('a'), D.keyOf('à'), '« a » et « à » sont deux mots');
  assert.equal(D.keyOf('Maison'), D.keyOf('maison'));
});

test('liste ↔ texte modifiable : aller-retour sans perte', () => {
  const d = { words: [{ w: 'maison', s: 'Je rentre à la maison.' }, { w: 'un chat' }, { w: 'vert', s: 'Le pré est vert !' }], d: DAY };
  const txt = D.listText(d);
  assert.equal(txt, 'maison : Je rentre à la maison.\nun chat\nvert : Le pré est vert !');
  assert.deepEqual(D.parseList(txt).words, d.words);
  assert.equal(D.listText(null), '');
});

/* ---------- profil ---------- */
test('profile.dictee normalisé : borné, sans doublon, champ absent quand la liste est vide', () => {
  const p = normalizeProfile({ id: 'p1', name: 'Léa', classe: 'CE1', dictee: {
    words: [{ w: ' Maison ', s: 'je rentre à la maison' }, 'chat', { w: 'maison' }, { w: '' }, null, 42, { w: 'x'.repeat(80), s: 7 }],
    d: '2026-10-05', futur: { ok: 1 }, __proto__: { pirate: 1 } } }, DAY);
  assert.deepEqual(p.dictee.words, [{ w: 'Maison', s: 'Je rentre à la maison.' }, { w: 'chat' }, { w: 'x'.repeat(D.MAX_WORD_LEN) }]);
  assert.equal(p.dictee.d, '2026-10-05');
  assert.deepEqual(p.dictee.futur, { ok: 1 }, 'champ d’une version future gardé');
  assert.equal(p.dictee.pirate, undefined);
  const many = normalizeProfile({ id: 'p1', name: 'Léa', dictee: { words: Array.from({ length: 30 }, (_, i) => 'mot' + String.fromCharCode(97 + (i % 26)) + (i >= 26 ? 'z' : '')) } }, DAY);
  assert.equal(many.dictee.words.length, D.MAX_WORDS);
  assert.equal(many.dictee.d, DAY, 'date illisible → le jour de la normalisation');
  for (const bad of [{ words: [] }, { words: ['', '  '] }, 'maison', null, [1, 2]]) {
    const q = normalizeProfile({ id: 'p1', name: 'Léa', dictee: bad }, DAY);
    assert.ok(!('dictee' in q), 'aucune liste : ' + JSON.stringify(bad));
  }
  assert.ok(!('dictee' in normalizeProfile({ id: 'p1', name: 'Léa' }, DAY)), 'jamais ajouté d’office');
  assert.equal(D.hasList(p), true);
  assert.equal(D.hasList(normalizeProfile({ id: 'p1', name: 'Léa' }, DAY)), false);
  /* idempotent */
  assert.deepEqual(normalizeProfile(p, DAY).dictee, p.dictee);
});

test('sauvegarde : la liste voyage avec le profil (export → restauration)', () => {
  const p = normalizeProfile({ ...defaultProfile({ id: 'p1', name: 'Léa', g: 'f', classe: 'CE1', today: DAY }),
    dictee: { words: [{ w: 'maison', s: 'Je rentre à la maison.' }, { w: 'aujourd’hui' }], d: DAY } }, DAY);
  const { json, filename } = exportProfile(p, { today: DAY });
  assert.match(filename, /^caramel-lea-2026-10-07\.json$/);
  const back = parseBackup(json, { today: DAY });
  assert.equal(back.kind, 'profile');
  assert.deepEqual(back.payload.dictee, p.dictee);
});

/* ---------- ordre de la dictée ---------- */
function withLeitner(entries) {
  const words = ['maison', 'chat', 'forêt', 'vert', 'loup', 'école'].map(w => ({ w }));
  return { id: 'p1', settings: { sessionMin: 15 }, dictee: { words, d: DAY }, leitner: entries };
}
test('ordre : les mots à revoir d’abord, puis jamais dictés, puis ceux dont la révision est due, puis les autres', () => {
  const p = withLeitner({
    'fr.ortho:vert': { b: 1, due: addDays(DAY, 1), seen: 1, ok: 0, last: DAY },            /* raté hier soir : à revoir */
    'fr.ortho:maison': { b: 3, due: addDays(DAY, -1), seen: 3, ok: 3, last: '2026-10-02' },  /* due */
    'fr.ortho:loup': { b: 2, due: addDays(DAY, 2), seen: 1, ok: 1, last: DAY },               /* à jour, due dans 2 j */
    'fr.ortho:chat': { b: 4, due: addDays(DAY, 6), seen: 4, ok: 4, last: DAY },               /* à jour, due dans 6 j */
    'fr.ortho:école': { b: 1, due: DAY, seen: 2, ok: 1, last: DAY },                          /* à revoir */
    'ma.faits:7x8': { b: 1, due: DAY, seen: 1, ok: 0, last: DAY }
  });
  const o = D.order(p, { today: DAY });
  assert.deepEqual(o.map(e => e.w), ['vert', 'école', 'forêt', 'maison', 'loup', 'chat']);
  assert.deepEqual(o.map(e => e.st), ['revoir', 'revoir', 'new', 'due', 'ok', 'ok']);
  assert.deepEqual(D.order(p, { today: DAY, limit: 3 }).map(e => e.w), ['vert', 'école', 'forêt']);
  assert.deepEqual(D.toReview(p, DAY), ['vert', 'école']);
  /* aucune trace : l'ordre de la liste */
  assert.deepEqual(D.order(withLeitner({}), { today: DAY }).map(e => e.w), ['maison', 'chat', 'forêt', 'vert', 'loup', 'école']);
  assert.deepEqual(D.order({}, { today: DAY }), []);
});

test('taille : balade 6, 8 ou 10 mots selon la séance, partie libre toute la liste', () => {
  const words = Array.from({ length: 14 }, (_, i) => ({ w: 'mot' + String.fromCharCode(97 + i) }));
  const p = min => ({ settings: { sessionMin: min }, dictee: { words, d: DAY } });
  assert.deepEqual([10, 15, 20].map(m => D.sizeFor(p(m), 'balade')), [6, 8, 10]);
  assert.equal(D.sizeFor(p(15), 'libre'), 14);
  assert.equal(D.sizeFor({ settings: { sessionMin: 20 }, dictee: { words: words.slice(0, 4), d: DAY } }, 'balade'), 4);
});

/* ---------- rituel ---------- */
test('rituel de la classe : « mot… phrase… mot », le mot lentement ; sans phrase, le mot deux fois', () => {
  const r = D.ritual({ w: 'maison', s: 'Je rentre à la maison.' });
  assert.deepEqual(r, [
    { say: 'maison.', slow: D.WORD_SLOW }, { pause: D.PAUSE_MS }, { say: 'Je rentre à la maison.', slow: D.PHRASE_SLOW },
    { pause: D.PAUSE_MS }, { say: 'maison.', slow: D.WORD_SLOW }]);
  assert.ok(D.WORD_SLOW > D.PHRASE_SLOW && D.PHRASE_SLOW >= 1 && D.WORD_SLOW <= 1.6, 'au-delà de ≈ 1,6 le son traîne');
  assert.deepEqual(D.ritual({ w: 'chat' }), [{ say: 'chat.', slow: D.WORD_SLOW }, { pause: D.PAUSE_ALONE_MS }, { say: 'chat.', slow: D.WORD_SLOW }]);
  assert.deepEqual(D.ritual({ w: '' }), []);
  assert.equal(D.ritualText({ w: 'maison', s: 'Je rentre à la maison.' }), 'maison… Je rentre à la maison… maison.');
  assert.equal(D.ritualText({ w: 'chat' }), 'chat… chat.');
  /* à préparer : chaque texte une fois (le mot n'est calculé qu'une fois pour ses deux passages) */
  assert.deepEqual(D.prepList([{ w: 'maison', s: 'Je rentre à la maison.' }, { w: 'chat' }, { w: 'maison' }]), [
    { text: 'maison.', slow: D.WORD_SLOW }, { text: 'Je rentre à la maison.', slow: D.PHRASE_SLOW }, { text: 'chat.', slow: D.WORD_SLOW }]);
});

test('rituel joué : dans l’ordre, avec les silences ; « 🔁 Encore » (alive faux) l’arrête net', async () => {
  const log = [];
  const ok = await D.playRitual({ w: 'maison', s: 'Je rentre à la maison.' }, {
    speak: async (t, slow) => { log.push(['dit', t, slow]); return true; },
    wait: async ms => { log.push(['silence', ms]); }
  });
  assert.equal(ok, true);
  assert.deepEqual(log, [['dit', 'maison.', D.WORD_SLOW], ['silence', D.PAUSE_MS], ['dit', 'Je rentre à la maison.', D.PHRASE_SLOW],
    ['silence', D.PAUSE_MS], ['dit', 'maison.', D.WORD_SLOW]]);
  let n = 0, live = true;
  const cut = await D.playRitual({ w: 'chat' }, { speak: async () => { n++; live = false; return true; }, wait: async () => {}, alive: () => live });
  assert.equal(cut, false);
  assert.equal(n, 1);
  const mute = await D.playRitual({ w: 'chat' }, { speak: async () => false, wait: async () => {} });
  assert.equal(mute, false, 'voix muette : le jeu le sait');
});

/* ---------- bilan ---------- */
test('bilan : on compte les réussites, jamais d’erreur ni de note', () => {
  const cases = [[{ n: 8, clean: 8 }, 'Tu as su écrire tous tes mots du premier coup, bravo !'], [{ n: 1, clean: 1 }, 'Tu as su écrire ton mot du premier coup, bravo !'],
    [{ n: 8, clean: 5 }, 'Tu as su écrire 5 mots du premier coup !'], [{ n: 8, clean: 1 }, 'Tu as su écrire un mot du premier coup !'],
    [{ n: 8, clean: 0 }, 'Tu as bien comparé tes mots avec le modèle, bravo !']];
  for (const [s, want] of cases) {
    const t = D.praise(s);
    assert.equal(t, want);
    assert.doesNotMatch(t, /\/|sur \d|faute|erreur|raté|faux/i);
  }
  assert.equal(D.praise(null), 'Tu as bien comparé tes mots avec le modèle, bravo !');
  for (const t of Object.values(D.LINES)) assert.ok(t.length <= 90 && !/\d/.test(t), 'une phrase courte, sans chiffre : ' + t);
});

/* ---------- générateur, registre, jeu ---------- */
test('générateur fr.ortho : le mot demandé, clé Leitner, pas une mesure de l’axe', async () => {
  assert.ok(hasGenerator('fr.ortho'));
  const mod = await loadGenerator('fr.ortho');
  assert.equal(mod.axis, 'fr.ortho');
  const it = G.gen(1.2, null, { word: { w: 'Forêt', s: 'le loup vit dans la forêt' } });
  assert.deepEqual(it, { axis: 'fr.ortho', kind: 'dictee', key: 'fr.ortho:forêt', A: 1.2, prompt: 'Forêt', answer: 'Forêt',
    leitner: true, measure: false, data: { w: 'Forêt', s: 'Le loup vit dans la forêt.' } });
  const words = [{ w: 'maison' }, { w: 'chat' }];
  assert.equal(G.gen(0, null, { words, avoid: new Set(['fr.ortho:maison']) }).prompt, 'chat');
  assert.equal(G.gen(0, null, { words, avoid: new Set(['fr.ortho:maison', 'fr.ortho:chat']) }), null);
  assert.equal(G.gen(0, null, { profile: { dictee: { words } } }).prompt, 'maison');
  assert.equal(G.gen(0, null, {}), null);
});

test('registre : « La dictée de {N} », axe fr.ortho, dès le CP, plafond de 20 mots, jeu qui se présente lui-même', async () => {
  const g = GAME_BY_ID.dictee;
  assert.ok(g);
  assert.equal(g.title, 'La dictée de {N}');
  assert.equal(g.primary, 'fr.ortho');
  assert.equal(AXIS_GAME['fr.ortho'], 'dictee');
  assert.ok(gamesFor('CP').some(x => x.id === 'dictee'));
  assert.deepEqual([10, 15, 20].map(m => mancheSize('dictee', m)), [20, 20, 20]);
  assert.equal(typeof g.ready, 'function');
  assert.equal(g.ready({}), false);
  assert.equal(g.ready({ dictee: { words: [{ w: 'chat' }] } }), true);
  const src = SRC('js/games/dictee.js');
  assert.match(src, /intro: true/);
  assert.match(src, /ctx\.petSVG\(/);
  assert.doesNotMatch(src, /\bmountSVG\s*\(/);
  assert.doesNotMatch(src, /startListening|createVoiceAnswer/, 'pas de micro dans la dictée');
  assert.ok(existsSync(new URL('../css/games/dictee.css', import.meta.url)));
  const game = (await import('../js/games/dictee.js')).default;
  assert.equal(game.id, 'dictee');
  assert.equal(game.css, 'css/games/dictee.css');
  assert.equal(typeof game.praise, 'function', 'la coquille dit le bilan avec les mots de la dictée');
  assert.equal(game.praise({ n: 3, clean: 2 }), 'Tu as su écrire 2 mots du premier coup !');
  assert.match(SRC('js/ui/game-shell.js'), /my\.mod\.praise/);
  /* caractères invisibles échappés dans le code (jamais tels quels) */
  for (const f of ['js/core/dictee.js', 'js/games/dictee.js', 'js/ui/dictee-parents.js', 'js/content/fr/dictee.js']) {
    assert.doesNotMatch(SRC(f), /[\u00a0\u202F\u2009\u200B\u2060]/, f);
  }
});

/* ---------- dans une vraie manche ---------- */
function setupStore({ dictee = null, classe = 'CE1', skills = {} } = {}) {
  store.init(memoryStorage(), DAY);
  const p = defaultProfile({ id: 'p1', name: 'Léa', g: 'f', classe, today: DAY });
  for (const [ax, t] of Object.entries(skills)) p.skills[ax] = { t, n: 4, last: '', trend: 0, src: 'eval' };
  if (dictee) p.dictee = dictee;
  store.addProfile(p);
  return () => store.getProfile();
}
test('manche : ✓ Juste → 🍎 et Leitner +1 ; ✗ À revoir puis recopié → 🍎, boîte 1, en tête la fois suivante ; θ inchangé, pas de filet', () => {
  const words = [{ w: 'maison', s: 'Je rentre à la maison.' }, { w: 'chat' }, { w: 'forêt' }, { w: 'vert' }];
  const P = setupStore({ dictee: { words, d: DAY }, skills: { 'fr.ortho': 2.2 } });
  let t = 1759800000000;
  const clock = () => (t += 15000);
  const m = createManche({ gameId: 'dictee', today: DAY, clock, generators: { 'fr.ortho': G } });
  assert.equal(m.axis, 'fr.ortho');
  const plan = D.order(P(), { today: DAY });
  const apples0 = P().wallet.apples;
  const out = [];
  for (const [i, e] of plan.entries()) {
    const item = m.nextItem(undefined, { word: e });
    assert.equal(item.key, D.keyOf(e.w));
    assert.equal(item.assist, false, 'jamais d’item « aidé » imposé (la liste est fixée)');
    const clean = i === 0 || i === 3;
    out.push(m.report(item, clean ? { correct: true, hinted: false, ms: 9000, tries: 1 } : { correct: true, hinted: true, ms: 12000, tries: 2 }));
  }
  const q = P();
  assert.equal(q.wallet.apples - apples0, 4, 'une 🍎 par mot : la recopie compte aussi');
  assert.equal(q.skills['fr.ortho'].t, 2.2, 'θ de fr.ortho inchangé');
  assert.equal(q.skills['fr.ortho'].n, 4);
  assert.equal(q.leitner['fr.ortho:maison'].b, 2);
  assert.equal(q.leitner['fr.ortho:chat'].b, 1);
  assert.equal(q.leitner['fr.ortho:forêt'].b, 1);
  assert.equal(q.leitner['fr.ortho:vert'].b, 2);
  assert.ok(out.every(fb => fb.thetaBefore === 2.2 && fb.thetaAfter === 2.2));
  const s = m.finish();
  assert.deepEqual([s.n, s.clean, s.gameId, s.axis], [4, 2, 'dictee', 'fr.ortho']);
  const h = P().history.at(-1);
  assert.deepEqual([h.g, h.ax, h.n, h.ok], ['dictee', 'fr.ortho', 4, 4]);
  assert.ok(h.ms > 0, 'minutes comptées (temps de jeu, croissance du compagnon)');
  assert.equal(D.praise(s), 'Tu as su écrire 2 mots du premier coup !');
  /* le lendemain : les mots à revoir passent en tête */
  assert.deepEqual(D.order(P(), { today: addDays(DAY, 1) }).map(e => e.w), ['chat', 'forêt', 'maison', 'vert']);
  /* sans θ observé : l'axe n'est pas créé */
  const P2 = setupStore({ dictee: { words, d: DAY } });
  const m2 = createManche({ gameId: 'dictee', today: DAY, clock, generators: { 'fr.ortho': G } });
  m2.report(m2.nextItem(undefined, { word: words[1] }), { correct: true, hinted: false, ms: 5000 });
  assert.equal(P2().skills['fr.ortho'], undefined);
  m2.abort();
});

test('balade : la dictée n’entre que si un adulte a tapé une liste ; ses mots à travailler en font une révision', () => {
  const P = setupStore({ classe: 'CE2' });
  assert.ok(!eligibleAxes(P()).includes('fr.ortho'));
  for (let k = 0; k < 6; k++) assert.ok(!planDay(P(), addDays(DAY, k)).blocks.some(b => b.game === 'dictee'));
  const words = ['maison', 'chat', 'forêt', 'vert', 'loup'].map(w => ({ w }));
  const P2 = setupStore({ classe: 'CE2', dictee: { words, d: DAY } });
  const axes = eligibleAxes(P2());
  assert.ok(axes.includes('fr.ortho'));
  /* tout a été pratiqué hier (aucun axe oublié depuis 6 jours) : la révision va à la dictée, qui a 5 mots à travailler */
  const y = addDays(DAY, -1);
  store.mutateProfile(q => {
    for (const ax of axes) q.history.push({ d: y, t: 1, g: AXIS_GAME[ax], ax, n: 8, ok: 6, hint: 0, ms: 60000, mode: 'libre' });
  });
  assert.equal(D.toWork(P2(), DAY), 5);
  const plan = planDay(P2(), DAY);
  assert.ok(plan.blocks.some(b => b.game === 'dictee'), JSON.stringify(plan.blocks.map(b => b.game)));
  /* tous les mots réussis récemment : plus rien de dû, la dictée laisse la place */
  store.mutateProfile(q => { for (const e of words) q.leitner[D.keyOf(e.w)] = { b: 3, due: addDays(DAY, 3), seen: 2, ok: 2, last: y }; });
  assert.equal(D.toWork(P2(), DAY), 0);
  const plan2 = planDay(P2(), DAY);
  assert.ok(!plan2.blocks.some(b => b.kind === 'revision' && b.game === 'dictee'));
});

/* ---------- voix : lenteur, contenu ---------- */
test('voix fluide : un texte dit lentement est un autre son (length_scale × lenteur), calculé une seule fois', async () => {
  const calls = [];
  const engine = {
    alive: true,
    synth(text, opts) {
      calls.push({ text, opts });
      const pcm = new Float32Array(4000);
      for (let i = 500; i < 3500; i++) pcm[i] = 0.3;
      return Promise.resolve({ sentences: [{ pcm, sampleRate: 22050 }], synthMs: 3 });
    },
    dispose() {}
  };
  const PARAMS = { length_scale: 1.05, noise_scale: 0.75, noise_w: 0.9, sentence_silence: 0.35, volume: 0.9, youth: 1.33 };
  F._setEnv({ engine, lib: { PARAMS }, storage: memoryStorage(), version: 't' });
  try {
    await F.request('maison.', F.NOW, D.WORD_SLOW);
    await F.request('maison.', F.NOW);
    await F.request('maison.', F.NEXT, D.WORD_SLOW);
    assert.equal(calls.length, 2, 'lent et normal : deux sons ; le lent déjà prêt n’est pas recalculé');
    assert.ok(Math.abs(calls[0].opts.params.length_scale - 1.05 * D.WORD_SLOW) < 1e-9);
    assert.equal(calls[0].opts.params.youth, 1.33, 'la voix d’enfant est gardée');
    assert.equal(calls[1].opts, undefined, 'débit normal : réglages du moteur');
    assert.deepEqual(F.queueInfo().ready.sort(), ['maison.', 'maison.']);
  } finally { F._setEnv(null); }
});

test('voix du téléphone : la dictée est dite plus lentement, même si « Lire les consignes » est sur Non ; jamais sons coupés', async () => {
  const voice = await import('../js/ui/voice.js');
  const said = [];
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  globalThis.speechSynthesis = {
    speaking: false, pending: false, paused: false,
    getVoices: () => [{ name: 'Français', lang: 'fr-FR', localService: true, voiceURI: 'fr' }],
    addEventListener() {}, removeEventListener() {}, resume() {}, cancel() {},
    speak(u) { said.push({ text: u.text, rate: u.rate }); setTimeout(() => { u.onstart && u.onstart(); u.onend && u.onend(); }, 5); }
  };
  tts._reset();
  F._setEnv({ storage: memoryStorage(), version: 't' });
  const P = setupStore({ dictee: { words: [{ w: 'maison' }], d: DAY } });
  try {
    store.mutateProfile(q => { q.settings.readAloud = 'off'; });
    assert.equal(voice.contentOn(P()), true);
    assert.equal(voice.freeVoice(), 'tts');
    assert.equal(await voice.speak('Écoute bien.'), false, 'consigne : le réglage Non est respecté');
    assert.equal(await voice.speak('maison.', { slow: D.WORD_SLOW, content: true }), true);
    assert.equal(said.at(-1).text, 'maison.');
    assert.ok(Math.abs(said.at(-1).rate - 0.95 / D.WORD_SLOW) < 1e-9, 'plus lent');
    const r = await voice.prepareAll(D.prepList([{ w: 'maison' }]), { waitMs: 0 });
    assert.equal(r.why, 'not-ready', 'sans voix fluide : rien à préparer, le téléphone parle en direct');
    store.mutateProfile(q => { q.settings.sound = false; });
    assert.equal(voice.contentOn(P()), false);
    const n = said.length;
    assert.equal(await voice.speak('maison.', { slow: D.WORD_SLOW, content: true }), false, 'sons coupés : rien');
    assert.equal(said.length, n);
  } finally {
    F._setEnv(null);
    delete globalThis.speechSynthesis;
    delete globalThis.SpeechSynthesisUtterance;
    tts._reset();
    store.init(memoryStorage(), DAY);
  }
});

test('espace parents : la carte de la dictée est une fonction à part, appelée une fois', () => {
  const src = SRC('js/ui/parents.js');
  assert.equal((src.match(/dicteeCard\(/g) || []).length, 1);
  assert.match(src, /import \{ dicteeCard \} from '\.\/dictee-parents\.js';/);
  const card = SRC('js/ui/dictee-parents.js');
  assert.match(card, /voice\.speak\(t, \{ force: true, slow \}\)/, '« ▶ » : le mot comme dans la dictée');
  assert.match(card, /autocapitalize: 'none'/, 'le clavier du téléphone ne met pas de majuscule d’office');
  assert.doesNotMatch(card, /\btu\b|\bton\b|\bta\b/i, 'vouvoiement');
});
