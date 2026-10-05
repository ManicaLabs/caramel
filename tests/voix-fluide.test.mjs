/* Voix fluide (v2.2.2, décision du parent du 04/10/2026) : la voix Piper « siwis medium » calculée sur l'appareil.
   Logique pure : texte pour Piper (fluidText / prepare), extraction du sous-ensemble français d'espeak-ng, politique de
   téléchargement, étalonnage, aiguillage (quelle voix dit quoi) ; puis js/ui/voice.js face à un faux moteur, un faux Web
   Audio et une fausse synthèse du téléphone (préparation à l'avance, 🔊 identique, hush, settle, replis) ; enfin le cycle
   de vie face à un faux cache et un faux moteur (VF-fix : « Arrêter » du parent, reprise après un jeu, ménage, veille
   pendant l'étalonnage, « Refaire l'essai de vitesse », micro sur mémoire faible) et la ligne de l'espace parents.
   Prénoms fictifs uniquement. */
import { test, assert, memoryStorage } from './_t.mjs';
import { readFileSync, statSync } from 'node:fs';
import * as V from '../js/content/voice-lines.js';
import { VOICE } from '../js/content/voice-manifest.js';
import * as F from '../js/core/voice-fluid.js';
import * as P from '../js/core/piper-tts.js';
import { packageMeta, subsetOf, extractSubset, patchGlue, phonemeIds, KEEP_FR, PARAMS, YOUTH, YOUTH_DEGREES, scalesOf, rejuvenate } from '../js/core/piper-engine.js';
import * as TV from '../tools/voix.mjs';
import * as clips from '../js/core/voice-clips.js';
import * as tts from '../js/core/tts.js';
import * as store from '../js/core/store.js';
import { defaultProfile, fillTemplate } from '../js/core/profiles.js';
import { frTypo } from '../js/core/util.js';

const SRC = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const has = id => !!VOICE.clips[id];

/* ---------- texte pour Piper ---------- */
test('texte pour Piper (fluidText = prepare) : « plusse » en calcul, « une » devant un nom féminin, nombre de calcul lu d’un bloc', () => {
  assert.equal(P.prepare, V.fluidText, 'un seul prepare(), réexporté pour le banc d’essai');
  const f = t => V.fluidText(frTypo(t));
  assert.equal(f('7 × 8 = ?'), '7 fois 8 | égale?', '« = ? » de frTypo (espace fine) lu « égale » ; « huit » entier avant « égale »');
  assert.equal(f('38 + 25 = ?'), '38 | plusse 25 | égale?', 'trente-huit | plusse : le t reste ; [plys]');
  assert.equal(f('40 + 6 = 46.'), '40 | plusse 6 | égale 46.');
  assert.equal(f('Il te manque 21 🍎.'), 'Il te manque vingt-et-une pommes.');
  assert.equal(f('Tu as trouvé 1 réponse du premier coup !'), 'Tu as trouvé une réponse du premier coup!');
  assert.equal(f('Il te manque 12 🍎.'), 'Il te manque 12 pommes.', 'pas de « une » hors de 1, 21… 81');
  assert.equal(f('Une de plus dans ta tête !'), 'Une de plusse dans ta tête!');
  assert.equal(f('Combien plus 7 égale 10 ?'), 'Combien plusse 7 | égale 10?');
  assert.equal(f('Reviens un peu plus tard !'), 'Reviens un peu plus tard!', '« plus tard » : pas de plusse');
  assert.equal(f('Le drapeau est 3 petits piquets après 40.'), 'Le drapeau est 3 petits piquets après 40.');
  assert.equal(f('9 − 4 = 5'), '9 | moins 4 | égale 5');
  assert.equal(f('6 × 7'), '6 fois 7', '« fois » : pas de coupure (« six fois » [si fwa])');
  assert.equal(f('Coucou Léa ! Moi, c’est Noisette.'), 'Coucou Léa! Moi, c’est Noisette.', 'le prénom est dit');
});

/* ---------- espeak-ng : sous-ensemble français ---------- */
test('données espeak-ng : seul le sous-ensemble français est gardé (extraction au 1er chargement, colle réécrite)', () => {
  const files = [
    ['en_dict', 0, 10], ['phontab', 10, 15], ['fr_dict', 15, 25], ['lang/roa/fr', 25, 27], ['lang/roa/it', 27, 30],
    ['intonations', 30, 33], ['phondata', 33, 40], ['phonindex', 40, 42], ['voices/!v/Annie', 42, 44]
  ].map(([n, start, end]) => ({ filename: '/espeak-ng-data/' + n, start, end, audio: 0 }));
  const glue = 'var Module;function runWithFS(){}\nloadPackage(' + JSON.stringify({ files, remote_package_size: 44 }) + ')})();\nfunction createPiperPhonemize(){}';
  const { meta } = packageMeta(glue);
  assert.equal(meta.files.length, 9);
  const sub = subsetOf(meta);
  assert.deepEqual(sub.files.map(f => f.filename.replace('/espeak-ng-data/', '')), ['phontab', 'fr_dict', 'lang/roa/fr', 'intonations', 'phondata', 'phonindex']);
  assert.equal(sub.size, 5 + 10 + 2 + 3 + 7 + 2);
  const full = Uint8Array.from({ length: 44 }, (_, i) => i);
  const part = extractSubset(full.buffer, sub);
  assert.deepEqual([...part], [10, 11, 12, 13, 14, ...Array.from({ length: 10 }, (_, i) => 15 + i), 25, 26, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41]);
  /* positions réécrites : chaque fichier gardé est à sa place dans le sous-ensemble */
  for (const f of sub.files) assert.deepEqual([...part.subarray(f.start, f.end)], [...full.subarray(f.from, f.from + f.end - f.start)], f.filename);
  const patched = packageMeta(patchGlue(glue, sub)).meta;
  assert.equal(patched.remote_package_size, sub.size);
  assert.ok(patched.files.every(f => !('from' in f)) && patched.files.length === 6);
  assert.throws(() => extractSubset(full.subarray(0, 30), sub), /incomplet/, 'paquet tronqué refusé');
  assert.throws(() => subsetOf({ files: files.filter(f => !/fr_dict/.test(f.filename)) }), /dictionnaire français/);
  assert.ok(KEEP_FR.test('/espeak-ng-data/lang/roa/fr') && !KEEP_FR.test('/espeak-ng-data/lang/roa/fr-be'));
  /* identifiants : ^ _ (phonème _)* $ */
  assert.deepEqual(phonemeIds('ab', { '^': [1], '$': [2], '_': [0], a: [5], b: [6] }), [1, 0, 5, 0, 6, 0, 2]);
});

test('fichiers : modèle float16 du dépôt (< 50 Mo), rien de GPL hébergé, versions figées, cache dédié jamais purgé', () => {
  const files = P.filesFor();
  const model = files.find(f => f.key === 'model');
  assert.match(model.url, /models\/piper\/fr_FR-siwis-medium-f16\.onnx\?v=[0-9a-f]{8}$/);
  const onDisk = statSync(new URL('../models/piper/fr_FR-siwis-medium-f16.onnx', import.meta.url)).size;
  assert.equal(onDisk, P.VOICES.medium.bytes);
  assert.ok(onDisk < 50 * 1024 * 1024, 'GitHub : moins de 50 Mo par fichier');
  const cfg = JSON.parse(SRC('models/piper/fr_FR-siwis-medium-f16.onnx.json'));
  assert.equal(cfg.audio.sample_rate, 22050);
  assert.equal(cfg.espeak.voice, 'fr');
  /* espeak-ng (GPL) : téléchargé depuis jsDelivr, version figée ; seul le sous-ensemble français est gardé */
  const esp = files.find(f => f.key === 'espeak');
  assert.match(esp.url, /^https:\/\/cdn\.jsdelivr\.net\/npm\/@diffusionstudio\/piper-wasm@1\.0\.0\/build\/piper_phonemize\.data$/);
  assert.ok(esp.subset && esp.cacheKey !== esp.url);
  for (const f of files) {
    if (f.key === 'model' || f.key === 'config') continue;
    assert.match(f.url, /^https:\/\/cdn\.jsdelivr\.net\/npm\/(onnxruntime-web@1\.22\.0|@diffusionstudio\/piper-wasm@1\.0\.0)\//, 'jsDelivr, version figée : ' + f.url);
  }
  assert.ok(P.filesFor({ ort: P.ORT_LEGACY }).every(f => !/onnxruntime-web@1\.22/.test(f.url)), 'repli 1.18.0');
  assert.equal(P.ortFor({ shared: false }), '1.18.0');
  assert.equal(P.ortFor({ shared: true }), '1.22.0');
  /* aucun fichier d'espeak-ng dans le dépôt */
  assert.doesNotMatch(SRC('sw.js'), /piper_phonemize|espeak/);
  assert.equal(P.CACHE, 'piper-tts-v1');
  assert.ok(!P.CACHE.startsWith('caramel-'), 'sw.js ne purge que caramel-*');
  /* ni le modèle ni le moteur dans le précache ; models/ jamais intercepté par le service worker */
  const sw = SRC('sw.js');
  assert.doesNotMatch(sw.slice(sw.indexOf('ASSETS:START'), sw.indexOf('ASSETS:END')), /models\/|\.onnx|\.wasm/);
  assert.match(sw, /url\.pathname\.includes\('\/models\/'\)\) return;/);
  /* crédits */
  assert.match(SRC('js/ui/parents.js'), /espeak-ng \(licence GPL-3\.0 ou ultérieure/);
  /* CC BY 4.0 : la modification de la voix est signalée là où les familles lisent les crédits (VE-fix) */
  assert.match(SRC('js/ui/parents.js'), /CC BY 4\.0[\s\S]{0,160}rajeunie en voix d’enfant \(hauteur et timbre relevés de 5\\u00A0demi-tons\)/);
  assert.match(SRC('js/ui/parents.js'), /la même voix siwis rajeunie/);
  assert.match(SRC('README.md'), /voix rajeunie : hauteur et timbre relevés de 5 demi-tons/);
  assert.match(SRC('README.md'), /espeak-ng[\s\S]{0,200}GPL-3\.0/);
  assert.match(SRC('README.md'), /float16/);
  assert.ok(Math.abs(P.DOWNLOAD_BYTES / 1e6 - 44) < 1.5, 'annoncé ≈ 45 Mo : ' + Math.round(P.DOWNLOAD_BYTES / 1e6) + ' Mo');
});

/* ---------- politique de téléchargement ---------- */
const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  pc: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0'
};
const FEAT = { wasm: true, simd: true, shared: true, worker: true, moduleWorker: true, cacheStorage: true, deviceMemory: 8 };
const auto = (o = {}) => F.autoDownload({
  env: { ua: UA.android, connection: { type: 'wifi', saveData: false }, onLine: true, ...(o.env || {}) },
  features: o.features || FEAT, state: { launches: 3, ...(o.state || {}) }, cached: !!o.cached, version: '2.2.2',
  inGame: !!o.inGame, afterSession: o.afterSession !== false
});
test('quand télécharger : jamais au 1er lancement ni pendant un jeu ; tout seul après une séance en Wi-Fi (Android, ordinateur) ; sinon les parents', () => {
  assert.deepEqual(auto(), { ok: true, why: 'wifi' }, 'Android en Wi-Fi, après une séance');
  assert.equal(auto({ state: { launches: 1 } }).why, 'first-launch');
  assert.equal(auto({ inGame: true }).why, 'in-game');
  assert.equal(auto({ afterSession: false }).why, 'no-session');
  assert.equal(auto({ env: { connection: { type: 'cellular' } } }).why, 'cellular');
  assert.equal(auto({ env: { connection: { type: 'wifi', saveData: true } } }).why, 'save-data');
  assert.equal(auto({ env: { connection: { type: 'ethernet' } } }).ok, true);
  assert.equal(auto({ env: { onLine: false } }).why, 'offline');
  assert.equal(auto({ env: { ua: UA.iphone, connection: null } }).why, 'ios', 'iPhone : les parents seulement');
  assert.equal(auto({ env: { ua: UA.iphone, connection: { type: 'wifi' } } }).why, 'ios');
  assert.equal(auto({ env: { ua: UA.pc, connection: { effectiveType: '4g' } } }).why, 'desktop', 'Chrome d’ordinateur : connexion fixe');
  assert.equal(auto({ env: { ua: UA.firefox, connection: null } }).why, 'unknown', 'connexion inconnue : les parents');
  assert.equal(auto({ env: { ua: UA.android, connection: { effectiveType: '4g' } } }).why, 'unknown', 'Android sans type : les parents');
  assert.equal(auto({ cached: true }).why, 'cached');
  assert.equal(auto({ state: { removed: true } }).why, 'removed', '« Supprimer » : plus jamais tout seul');
  assert.equal(auto({ state: { v: '2.2.2', verdict: 'slow' } }).why, 'slow');
  assert.equal(auto({ state: { v: '2.2.1', verdict: 'slow' } }).ok, true, 'nouvel essai à la version suivante');
  assert.equal(auto({ features: { ...FEAT, deviceMemory: 2 } }).why, 'modest');
  assert.equal(auto({ features: { ...FEAT, simd: false } }).why, 'unsupported');
  assert.equal(auto({ features: { ...FEAT, moduleWorker: false } }).why, 'unsupported');
  /* demandé par un parent puis interrompu par un jeu : reprend tout seul après la séance, même en données mobiles */
  assert.deepEqual(auto({ state: { want: 'parent' }, env: { ua: UA.iphone, connection: { type: 'cellular' } } }), { ok: true, why: 'parent' });
  assert.equal(auto({ state: { want: 'parent' }, inGame: true }).why, 'in-game');
  assert.equal(F.connectionOf({ connection: { type: 'none' } }), 'offline');
  assert.equal(F.deviceOf({ ua: UA.pc }), 'desktop');
  assert.equal(F.deviceOf({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 }), 'ios', 'iPad');
});

test('mémoire faible (≤ 4 Go ou inconnue) : le micro et la voix fluide ne coexistent jamais', () => {
  assert.equal(F.lowMemory({ deviceMemory: 4 }), true);
  assert.equal(F.lowMemory({ deviceMemory: 2 }), true);
  assert.equal(F.lowMemory({ deviceMemory: 8 }), false);
  assert.equal(F.lowMemory({}), true, 'Safari, Firefox : prudence');
  assert.equal(F.modest({ deviceMemory: 2 }), true);
  assert.equal(F.modest({}), false);
  /* branchement : ensureVosk et startListening préviennent la voix ; speech.js et course-engine.js ne sont pas touchés */
  const ctx = SRC('js/ui/game-ctx.js');
  assert.match(ctx, /ensureVosk\(\.\.\.a\) \{ voice\.micWillStart\(\); return speech\.ensureVosk\(\.\.\.a\); \}/);
  assert.match(ctx, /startListening\(\.\.\.a\) \{ voice\.micWillStart\(\); return speech\.startListening\(\.\.\.a\); \}/);
  assert.match(ctx, /speech: speechCtx/);
  const fl = SRC('js/core/voice-fluid.js');
  assert.match(fl, /else if \(engine && isLowMem\(\)\) \{ release\(\); set\(\{ state: 'cached' \}\); \}/);
  assert.match(fl, /if \(booting\) \{ abortBoot\(\);/, 'jamais de démarrage pendant que le micro démarre');
});

/* ---------- étalonnage ---------- */
test('étalonnage : rapport > 1 ou démarrage > 15 s → trop lent ; une fois par version', () => {
  assert.equal(F.calibrationVerdict({ bootMs: 2400, rtf: 0.37 }), 'ok', 'PC (prototype)');
  assert.equal(F.calibrationVerdict({ bootMs: 9300, rtf: 0.99 }), 'ok');
  assert.equal(F.calibrationVerdict({ bootMs: 9300, rtf: 1.52 }), 'slow', 'CPU ×4 (prototype)');
  assert.equal(F.calibrationVerdict({ bootMs: 13700, rtf: 2.29 }), 'slow', 'CPU ×6 (prototype)');
  assert.equal(F.calibrationVerdict({ bootMs: 15001, rtf: 0.5 }), 'slow', 'démarrage trop long');
  assert.equal(F.calibrationVerdict({ bootMs: 2000, rtf: NaN }), 'slow');
  assert.equal(F.calibrationVerdict({ bootMs: 2000 }), 'slow', 'pas de mesure : on n’insiste pas');
  assert.equal(F.needsCalibration({}, '2.2.2'), true);
  assert.equal(F.needsCalibration({ v: '2.2.2', verdict: 'ok' }, '2.2.2'), false);
  assert.equal(F.needsCalibration({ v: '2.2.2', verdict: 'slow' }, '2.2.2'), false, 'trop lent : pas avant la version suivante');
  assert.equal(F.needsCalibration({ v: '2.2.1', verdict: 'slow' }, '2.2.2'), true);
  const st = memoryStorage();
  F.writeState({ v: '2.2.2', verdict: 'slow', rtf: 1.52 }, st);
  F.writeState({ launches: 4 }, st);
  assert.deepEqual(F.readState(st), { v: '2.2.2', verdict: 'slow', rtf: 1.52, launches: 4 });
  assert.deepEqual(F.readState(memoryStorage({ [F.STATE_KEY]: 'pas du json' })), {});
});

/* ---------- aiguillage ---------- */
const lea = { id: 'p1', name: 'Léa', g: 'f', classe: 'CP', companion: { type: 'pony', name: 'Noisette' } };
const named = V.namedLines(s => fillTemplate(s, lea));
const planOf = t => V.planSpeech(t, { has, named });
const namedIn = pl => pl.clips.some(c => V.isNamed(V.LINE_BY_ID[c.id]));
const route = (t, o) => { const pl = planOf(t); return F.routeOf({ plan: pl, named: namedIn(pl), ...o }); };
test('aiguillage : UN clip → clip ; composé ou prénom → voix fluide (prête), sinon téléphone, sinon clips composés', () => {
  const single = frTypo('Tu as tout trouvé du premier coup, quelle star !');
  const calc = frTypo('7 × 8 = ?');
  const hello = frTypo(fillTemplate('Coucou {P} ! Moi, c’est {N}.', lea));
  const free = frTypo('Petite question : où Léa a-t-elle caché la clé ?');
  for (const fluid of [true, false]) for (const t of [true, false]) assert.equal(route(single, { fluid, tts: t }), 'clip', 'phrase fixe : ' + fluid + ' ' + t);
  assert.equal(route(calc, { fluid: true, tts: true }), 'fluid');
  assert.equal(route(calc, { fluid: false, tts: true }), 'tts', 'composé : la voix du téléphone avant les clips assemblés');
  assert.equal(route(calc, { fluid: false, tts: false }), 'clips', 'sans voix du téléphone : clips composés en dernier recours');
  assert.equal(planOf(hello).clips.length, 1, 'la phrase à prénom a son clip (sans le prénom)');
  assert.equal(route(hello, { fluid: true, tts: true }), 'fluid', 'prénom : voix fluide (le prénom est dit)');
  assert.equal(route(hello, { fluid: false, tts: true }), 'clip', 'voix fluide pas prête : la variante enregistrée (même voix que la visite)');
  assert.equal(route(hello, { fluid: false, tts: false }), 'clip');
  const helloMore = frTypo(fillTemplate('Coucou {P} ! Moi, c’est {N}. Tu as trouvé 7 réponses du premier coup !', lea));
  assert.equal(route(helloMore, { fluid: false, tts: true }), 'tts', 'phrase à prénom dans un texte composé : téléphone');
  assert.equal(route(free, { fluid: true, tts: true }), 'fluid');
  assert.equal(route(free, { fluid: false, tts: true }), 'tts');
  assert.equal(route(frTypo('Presque ! Petite question : où Léa a-t-elle caché la clé ?'), { fluid: false, tts: false }), 'partial');
  assert.equal(F.routeOf({ plan: null, fluid: false, tts: false }), 'tts', 'clips impossibles : dernier essai du téléphone');
});
/* whole : calculé comme dans js/ui/voice.js (wholeIn) — chaque clip du plan finit une phrase */
const wholeIn = pl => !!(pl && pl.ok) && pl.clips.every(c => { const e = V.LINE_BY_ID[c.id]; return !!e && V.endsSentence(e); });
const routeW = (t, o) => { const pl = planOf(t); return F.routeOf({ plan: pl, named: namedIn(pl), whole: wholeIn(pl), ...o }); };
test('aiguillage : une suite de phrases fixes enregistrées entières → ses clips, même sans voix fluide (feuille d’installation)', async () => {
  const I = await import('../js/ui/install.js');
  for (const [m, desk] of [['prompt', false], ['prompt', true], ['ios-safari', false], ['ios-chrome', false]]) {
    const s = I.kidSpeech(m, desk);
    for (const t of [s.open, s.all]) {
      assert.ok(planOf(t).clips.length >= 2, 'plusieurs clips : ' + t);
      for (const fluid of [false, true]) for (const tt of [true, false]) assert.equal(routeW(t, { fluid, tts: tt }), 'clip', m + ' ' + fluid + ' ' + tt + ' : ' + t);
      assert.equal(route(t, { fluid: false, tts: true }), 'tts', 'sans whole : l’ancien aiguillage (VE-verif) — ' + t);
    }
  }
  /* jamais pour un texte composé : nombres, calculs, astuces, explications restent à la voix du téléphone (ou fluide) */
  for (const raw of ['Tu as trouvé 7 réponses du premier coup !', '7 × 8 = ?', 'Le double de 5, c’est 10.',
    'Presque ! Pense à tes dix doigts : lève-en 7.', 'Place 7 sur la clôture.', 'Combien font 7 × 8 ?']) {
    const t = frTypo(raw);
    assert.equal(wholeIn(planOf(t)), false, raw);
    assert.equal(routeW(t, { fluid: false, tts: true }), 'tts', raw);
    assert.equal(routeW(t, { fluid: true, tts: true }), 'fluid', raw);
  }
  /* deux phrases fixes enregistrées : ses deux clips */
  const two = frTypo('Presque ! Tu as tout trouvé du premier coup, quelle star !');
  assert.equal(planOf(two).clips.length, 2);
  assert.equal(routeW(two, { fluid: false, tts: true }), 'clip');
  /* prénom : la règle ne change pas (voix fluide prête → le prénom est dit) */
  const helloTwo = frTypo(fillTemplate('Coucou {P} ! Moi, c’est {N}. Tu as tout trouvé du premier coup, quelle star !', lea));
  assert.equal(wholeIn(planOf(helloTwo)), true, helloTwo);
  assert.equal(routeW(helloTwo, { fluid: true, tts: true }), 'fluid', 'prénom : voix fluide prête');
  assert.equal(routeW(helloTwo, { fluid: false, tts: true }), 'clip', 'voix fluide pas prête : les clips (même voix que la visite)');
  assert.ok(SRC('js/ui/voice.js').includes('whole: wholeIn(pl)'), 'voice.js passe whole à routeOf');
});

test('voix fluide : chaque phrase qu’un clip couvre reste ce clip, les autres sont calculées (prénom compris)', () => {
  const seg = t => F.segmentsOf(frTypo(t), { has });
  assert.deepEqual(seg('Presque !\nPense à tes dix doigts : lève-en 7.').map(s => s.kind + ':' + (s.id || s.text)),
    ['clip:retry.presque', 'piper:Pense à tes dix doigts : lève-en 7.']);
  assert.deepEqual(seg('Coucou Léa ! Moi, c’est Noisette.').map(s => s.kind + ':' + (s.id || s.text)),
    ['piper:Coucou Léa!', 'piper:Moi, c’est Noisette.'], 'jamais la variante sans le prénom');
  assert.deepEqual(seg('7 × 8 = ? Tape la réponse, ou touche 🎤 et dis-la.').map(s => s.kind + ':' + (s.id || s.text)),
    ['piper:7 fois 8 | égale?', 'clip:tables.tape-ou-micro']);
  assert.deepEqual(seg('Tu as trouvé 7 réponses du premier coup !').map(s => s.kind), ['piper'], 'bilan à nombre : d’un seul tenant');
  assert.deepEqual(F.segmentsOf(frTypo('Presque ! Astuce : 5 + 5 = 10.'), { has, clipsOk: false }).map(s => s.kind), ['piper', 'piper'], 'sans Web Audio pour les clips');
  assert.deepEqual(F.sentencesOf(frTypo('Le micro est bloqué 🔒 Tape la réponse.')), ['Le micro est bloqué.', 'Tape la réponse.']);
  /* une phrase coupée pareil, seule ou après un encouragement : ce qui est préparé à l'avance resservira */
  const hint = frTypo('Pense à tes dix doigts : lève-en 7. Combien en reste-t-il de baissés ?');
  const alone = F.segmentsOf(hint, { has }).filter(s => s.kind === 'piper').map(s => s.text);
  const after = F.segmentsOf(frTypo('Tu y es presque !') + '\n' + hint, { has }).filter(s => s.kind === 'piper').map(s => s.text);
  assert.deepEqual(after, alone);
});

/* ---------- lecture : faux moteur, faux Web Audio ---------- */
function fakeEngine({ block = false } = {}) {
  const calls = [];
  const gates = [];
  const eng = {
    alive: true, calls, gates,
    synth(text) {
      calls.push(text);
      const n = 22050 * Math.max(0.3, Math.min(4, text.length / 18)) | 0;
      const pcm = new Float32Array(n);
      for (let i = 800; i < n - 800; i++) pcm[i] = 0.3;
      const r = { sentences: [{ pcm, sampleRate: 22050 }], synthMs: 5, audioSec: n / 22050, rtf: 0.2 };
      if (!block) return new Promise(res => setTimeout(() => res(r), 3));
      return new Promise(res => gates.push(() => res(r)));
    },
    dispose() { eng.alive = false; }
  };
  return eng;
}
function fakeContext() {
  const log = [];
  const ac = {
    state: 'running', currentTime: 0, destination: {}, log,
    resume: async () => {},
    createBuffer(ch, n, rate) { const d = new Float32Array(n); return { kind: 'pcm', length: n, sampleRate: rate, duration: n / rate, getChannelData: () => d }; },
    decodeAudioData(data) {
      const id = new TextDecoder().decode(data);
      const n = Math.round(22050 * ((VOICE.clips[id] || [500])[0] + 100) / 1000);
      const d = new Float32Array(n);
      for (let i = 1100; i < n - 1100; i++) d[i] = 0.3;
      return Promise.resolve({ kind: 'clip', id, duration: n / 22050, sampleRate: 22050, getChannelData: () => d });
    },
    createBufferSource() {
      const s = {
        buffer: null, onended: null, connect() {}, disconnect() {},
        start(t, off, dur) { log.push({ k: 'start', what: s.buffer.kind === 'clip' ? s.buffer.id : 'piper', t, off, dur }); setTimeout(() => { if (!s.stopped && s.onended) s.onended(); }, 12); },
        stop() { s.stopped = true; log.push({ k: 'stop' }); }
      };
      return s;
    }
  };
  return ac;
}
function setup({ engine = fakeEngine(), frVoice = true } = {}) {
  const ac = fakeContext();
  const store_ = new Map();
  clips._setBackend({
    context: () => ac,
    fetch: async url => new Response(new TextEncoder().encode(/audio\/voix\/([^?]+)\.mp3/.exec(url)[1]), { status: 200 }),
    caches: { open: async () => ({ match: async u => (store_.has(u) ? new Response(store_.get(u)) : undefined), put: async (u, r) => { store_.set(u, new Uint8Array(await r.arrayBuffer())); } }) }
  });
  F._setEnv({ context: ac, engine, storage: memoryStorage(), version: '2.2.2' });
  const said = [];
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  globalThis.speechSynthesis = {
    speaking: false, pending: false, paused: false,
    getVoices: () => [frVoice ? { name: 'Français', lang: 'fr-FR', localService: true, voiceURI: 'fr' } : { name: 'English', lang: 'en-US', localService: true, voiceURI: 'en' }],
    addEventListener() {}, removeEventListener() {}, resume() {}, cancel() {},
    speak(u) { said.push(u.text); setTimeout(() => { u.onstart && u.onstart(); u.onend && u.onend(); }, 5); }
  };
  tts._reset();
  globalThis.AudioContext = globalThis.AudioContext || function FakeAudioContext() {};
  globalThis.__caramelDebug = {};
  return { ac, said, engine };
}
function teardown() {
  clips._setBackend(null);
  F._setEnv(null);
  delete globalThis.speechSynthesis;
  delete globalThis.SpeechSynthesisUtterance;
  delete globalThis.AudioContext;
  delete globalThis.__caramelDebug;
  tts._reset();
}
const starts = ac => ac.log.filter(e => e.k === 'start').map(e => e.what);
const tick = ms => new Promise(r => setTimeout(r, ms));

test('lecture fluide : calcul d’un seul tenant, prénom dit, clip gardé pour la phrase fixe, jamais la voix du téléphone', async () => {
  const voice = await import('../js/ui/voice.js');
  const D = '2026-10-04';
  store.init(memoryStorage(), D);
  const { ac, said, engine } = setup();
  try {
    store.addProfile({ ...defaultProfile({ id: 'p1', name: 'Léa', g: 'f', classe: 'CP', today: D }), companion: { type: 'pony', name: 'Noisette' } });
    store.setActive('p1');
    assert.equal(await voice.speak(frTypo('7 × 8 = ?'), { force: true }), true);
    assert.deepEqual(engine.calls, ['7 fois 8 | égale?']);
    assert.deepEqual(starts(ac), ['piper']);
    assert.deepEqual(said, [], 'voix du téléphone jamais appelée');
    assert.equal(globalThis.__caramelDebug.voice.at(-1).via, 'fluide');
    /* phrase fixe : le clip, même quand la voix fluide est prête */
    ac.log.length = 0;
    assert.equal(await voice.speak(frTypo('Trouvé du premier coup, bravo !'), { force: true }), true);
    assert.equal(engine.calls.length, 1);
    assert.deepEqual(starts(ac), ['bilan.trouve-du-premier-coup-bravo']);
    /* visite guidée : le prénom est enfin dit */
    ac.log.length = 0;
    assert.equal(await voice.speak(frTypo(fillTemplate('Coucou {P} ! Moi, c’est {N}.', store.getProfile())), { force: true }), true);
    assert.deepEqual(engine.calls.slice(1), ['Coucou Léa!', 'Moi, c’est Noisette.']);
    assert.deepEqual(starts(ac), ['piper', 'piper']);
    /* encouragement (clip) puis astuce (calculée) : enchaînés, une pause de fin de phrase entre les deux */
    ac.log.length = 0;
    assert.equal(await voice.speak(frTypo('Presque !\nPense à tes dix doigts : lève-en 7.'), { force: true }), true);
    const st = ac.log.filter(e => e.k === 'start');
    assert.deepEqual(st.map(e => e.what), ['retry.presque', 'piper']);
    assert.ok(Math.abs(st[1].t - (st[0].t + st[0].dur) - 0.35) < 1e-6, 'silence de 0,35 s entre les phrases');
    assert.equal(voice.stats().fluid, 3);
  } finally { teardown(); store.init(memoryStorage(), D); }
});

test('préparé à l’avance : la phrase part sans calcul, 🔊 rejoue exactement le même son ; hush vide la file ; settle attend la voix fluide', async () => {
  const voice = await import('../js/ui/voice.js');
  const D = '2026-10-04';
  store.init(memoryStorage(), D);
  const { ac, engine } = setup();
  try {
    store.addProfile({ ...defaultProfile({ id: 'p1', name: 'Léa', g: 'f', classe: 'CP', today: D }), companion: { type: 'pony', name: 'Noisette' } });
    store.setActive('p1');
    assert.equal(voice.canPrepare(), true);
    voice.prepareNext(frTypo('38 + 25 = ?'), frTypo('Trouvé du premier coup, bravo !'));
    await tick(20);
    assert.deepEqual(engine.calls, ['38 | plusse 25 | égale?'], 'phrase fixe : rien à calculer');
    assert.deepEqual(F.queueInfo().ready, ['38 | plusse 25 | égale?']);
    /* « peut-être » (astuce) : attend que la file soit calme depuis 1,2 s, pour laisser le moteur libre à la question suivante */
    voice.prepare(frTypo('Pense à tes dix doigts : lève-en 7.'));
    await tick(300);
    assert.equal(engine.calls.length, 1, 'pas tout de suite');
    await tick(1100);
    assert.deepEqual(engine.calls.slice(1), ['Pense à tes dix doigts : lève-en 7.'], 'puis calculée');
    assert.equal(await voice.speak(frTypo('38 + 25 = ?'), { force: true }), true);
    assert.equal(engine.calls.length, 2, 'déjà prête : aucun nouveau calcul');
    const first = ac.log.find(e => e.k === 'start');
    assert.equal(await voice.speak(frTypo('38 + 25 = ?'), { force: true }), true, '🔊');
    assert.equal(engine.calls.length, 2, '🔊 : le même son, pas un nouveau tirage');
    assert.equal(ac.log.filter(e => e.k === 'start')[1].dur, first.dur);
    /* file : un calcul en cours, deux en attente → hush() les retire */
    const slow = fakeEngine({ block: true });
    const st = memoryStorage();
    F._setEnv({ context: ac, engine: slow, storage: st, version: '2.2.2' });
    voice.prepareNext(frTypo('9 + 6 = ?'), frTypo('Il te manque 13 🍎.'), frTypo('12 − 5 = ?'));
    await tick(5);
    assert.equal(slow.calls.length, 1);
    assert.equal(F.queueInfo().queued.length, 2);
    voice.hush();
    assert.equal(F.queueInfo().queued.length, 0, 'hush : file vidée');
    slow.gates.forEach(g => g());
    await tick(5);
    assert.equal(slow.calls.length, 1, 'rien d’autre n’est calculé');
    /* appareil juste assez rapide (rapport > 0,6) : rien de « peut-être » ; la question suivante, si */
    F.writeState({ v: '2.2.2', verdict: 'ok', rtf: 0.8 }, st);
    voice.prepare(frTypo('Pars de 5 et compte jusqu’à 7 : combien de pas fais-tu ?'));
    assert.equal(F.queueInfo().queued.length, 0);
    voice.prepareNext(frTypo('7 + 5 = ?'));
    assert.equal(F.queueInfo().queued.length + (F.queueInfo().inflight ? 1 : 0), 1);
    voice.hush();
    slow.gates.forEach(g => g());
    await tick(5);
    /* settle : attend la fin de la phrase fluide */
    const p = voice.speak(frTypo('9 + 6 = ?'), { force: true });
    await tick(5);
    slow.gates.forEach(g => g());
    let settled = false;
    await tick(5);
    const s = voice.settle().then(() => { settled = true; });
    assert.equal(F.playing(), true);
    assert.equal(settled, false);
    assert.equal(await p, true);
    await s;
    assert.equal(settled, true);
  } finally { teardown(); store.init(memoryStorage(), D); }
});

test('replis : voix fluide en panne → téléphone ; pas prête → téléphone ; sans voix du téléphone → clips composés', async () => {
  const voice = await import('../js/ui/voice.js');
  let env = setup({ engine: { alive: true, calls: [], synth: async () => { throw new Error('panne'); }, dispose() {} } });
  try {
    assert.equal(await voice.speak(frTypo('7 × 8 = ?'), { force: true }), true);
    assert.deepEqual(env.said, ['7 fois 8 =?'], 'la voix du téléphone prend le relais');
    teardown();
    env = setup({ engine: null });
    assert.equal(F.ready(), false);
    assert.equal(await voice.speak(frTypo('7 × 8 = ?'), { force: true }), true);
    assert.equal(env.said.length, 1, 'pas de voix fluide : téléphone');
    assert.deepEqual(starts(env.ac), []);
    teardown();
    env = setup({ engine: null, frVoice: false });
    assert.equal(await voice.speak(frTypo('7 × 8 = ?'), { force: true }), true);
    assert.deepEqual(starts(env.ac), ['n7', 'm.fois', 'n8', 'm.egale'], 'clips composés (dernier recours)');
    assert.deepEqual(env.said, []);
    voice.prepare(frTypo('7 × 8 = ?'));
    assert.equal(F.queueInfo().queued.length, 0, 'voix fluide pas prête : rien à préparer');
  } finally { teardown(); }
});

test('branchements : jeux, bilan, visite guidée préparent à l’avance ; sans voix fluide, le déroulé des jeux ne change pas', () => {
  const tb = SRC('js/games/tables.js'), pm = SRC('js/games/pommes.js');
  for (const [name, g] of [['tables', tb], ['pommes', pm]]) {
    assert.match(g, /if \(upcoming \|\| !alive \|\| ended[^\n]*\|\| !ctx\.voice \|\| !ctx\.voice\.canPrepare\) return;/, name + ' : item suivant tiré seulement si la voix fluide est prête');
    assert.match(g, /const item = upcoming \? upcoming\.item : safe\(\(\) => ctx\.nextItem\(\)\);\s*upcoming = null;/, name);
    assert.equal((g.match(/peekNext\(\);/g) || []).length, 2, name + ' : après un rapport (juste, ou « J’ai compris »)');
  }
  assert.match(tb, /ctx\.voice\.prepareNext\(lineFor\(item, index \+ 1\)\)/, 'la question suivante passe avant les astuces');
  assert.match(pm, /ctx\.voice\.prepareNext\(lineFor\(item, index \+ 1\)\)/);
  /* astuce et explication jamais calculées d'avance : un calcul en cours ne s'interrompt pas, il retarderait la question
     suivante (mesuré : jusqu'à 2 s en CM2) ; l'encouragement enregistré couvre leur calcul */
  for (const g of [tb, pm, SRC('js/games/cloture.js')]) assert.doesNotMatch(g, /ctx\.voice\.prepare\(/);
  assert.match(SRC('js/ui/game-shell.js'), /voice\.prepareNext\(praiseTxt\);\s*later\(\(\) => \{ if \(st === my && voice\.voiceOn\(q\)\) voice\.speak\(praiseTxt\); \}, 900\);/);
  assert.match(SRC('js/ui/home.js'), /voice\.prepareNext\(tx\[0\]\); voice\.prepare\(tx\.slice\(1\)\);/);
  assert.match(SRC('js/main.js'), /fluid\.init\(\);\s*fluid\.onRoute\(router\.current\(\)\);\s*router\.onChange\(\(\) => fluid\.onRoute\(router\.current\(\)\)\);/);
  /* le banc d'essai s'appuie sur le même moteur (pas de copie) */
  assert.match(SRC('tests/harness/piper.html'), /from '\.\/js\/core\/piper-tts\.js'/);
  assert.match(SRC('js/core/piper-worker.js'), /from '\.\/piper-engine\.js'/);
});

/* ---------- téléchargement, étalonnage, micro : faux cache, faux moteur (VF-fix, 05/10/2026) ---------- */
function fakeLib(have = []) {
  const files = ['ortMjs', 'ortWasm', 'model'].map(key => ({ key, url: 'https://x.test/' + key, bytes: 10 }));
  const cached = new Set(have);
  const lib = {
    ORT_VERSION: '1.22.0', ORT_LEGACY: '1.18.0', ortFor: () => '1.22.0', features: () => FEAT, filesFor: () => files,
    cached, pruned: 0, boots: 0, finish: null, go: null,
    missingFiles: async fs => fs.filter(f => !cached.has(f.key)),
    ensureFiles: (fs, { signal } = {}) => new Promise((res, rej) => {
      lib.finish = () => { fs.forEach(f => cached.add(f.key)); res({ buffers: {} }); };
      if (signal) signal.addEventListener('abort', () => rej(Object.assign(new Error('interrompu'), { name: 'AbortError' })), { once: true });
    }),
    prune: async () => { lib.pruned++; },
    clearCache: async () => { cached.clear(); },
    loadPiper: ({ signal } = {}) => new Promise((res, rej) => {
      lib.boots++;
      lib.go = () => res({ alive: true, info: { bootMs: 2400 }, synth: async () => ({ rtf: 0.38, sentences: [] }), dispose() {} });
      if (signal) signal.addEventListener('abort', () => rej(Object.assign(new Error('interrompu'), { name: 'AbortError' })), { once: true });
    })
  };
  return lib;
}
const CELL = { ua: UA.android, connection: { type: 'cellular' }, onLine: true };
const navOf = env => ({ userAgent: env.ua, connection: env.connection, onLine: env.onLine });
const autoNow = env => F.autoDownload({ env, features: FEAT, state: F.readState(), version: '2.2.2', afterSession: true });
const ALL = ['ortMjs', 'ortWasm', 'model'];

test('téléchargement : « Arrêter » du parent oublie la reprise d’office (un jeu la garde) ; fini → plus de reprise d’office ; fichiers du banc d’essai → « pas téléchargée »', async () => {
  const st = memoryStorage({ [F.STATE_KEY]: JSON.stringify({ launches: 3 }) });
  const lib = fakeLib();
  F._setEnv({ lib, features: FEAT, storage: st, version: '2.2.2', nav: navOf(CELL) });
  try {
    /* VFV-1 : le parent arrête, en données mobiles */
    let p = F.download({ by: 'parent' });
    await tick(5);
    assert.equal(F.status().state, 'downloading');
    assert.equal(F.readState().want, 'parent');
    assert.equal(F.readState().started, true);
    F.cancelDownload({ byParent: true });
    assert.equal(await p, false);
    assert.equal(F.status().state, 'paused', 'téléchargement interrompu (reprise possible par le parent)');
    assert.equal(F.readState().want, null);
    assert.deepEqual(autoNow(CELL), { ok: false, why: 'cellular' }, 'pas de reprise d’office en données mobiles');
    /* un jeu interrompt le téléchargement du parent : la reprise après la séance est gardée */
    p = F.download({ by: 'parent' });
    await tick(5);
    F.onRoute({ name: 'play' });
    assert.equal(await p, false);
    assert.equal(F.readState().want, 'parent');
    assert.deepEqual(autoNow(CELL), { ok: true, why: 'parent' });
    F.onRoute({ name: 'home' });
    /* VFV-2 : fini → want et started effacés ; cache perdu ensuite (nouveau modèle) : les règles ordinaires */
    p = F.download({ by: 'parent' });
    await tick(5);
    lib.finish();
    assert.equal(await p, true);
    assert.equal(F.status().state, 'cached');
    assert.equal(F.readState().want, null);
    assert.equal(F.readState().started, null);
    lib.cached.clear();
    assert.equal((await F.refresh()).state, 'absent');
    assert.deepEqual(autoNow(CELL), { ok: false, why: 'cellular' });
    assert.equal(autoNow({ ...CELL, ua: UA.iphone, connection: { type: 'wifi' } }).why, 'ios');
    /* VFV-6 : fichiers laissés par le banc d'essai (rien commencé ici) → « pas téléchargée », ménage ; commencé ici →
       « interrompu » ; supprimé → « pas téléchargée » */
    F._setEnv({ lib: fakeLib(['ortMjs', 'ortWasm']), features: FEAT, storage: memoryStorage({ [F.STATE_KEY]: JSON.stringify({ launches: 1 }) }), version: '2.2.2', nav: navOf(CELL) });
    const before = (await F.refresh()).state;
    assert.equal(before, 'absent');
    F.writeState({ started: true });
    assert.equal((await F.refresh()).state, 'paused');
    F.writeState({ started: null, want: 'parent' });
    assert.equal((await F.refresh()).state, 'paused');
    F.writeState({ removed: true });
    assert.equal((await F.refresh()).state, 'absent');
  } finally { F._setEnv(null); }
  const lib2 = fakeLib(['model']);
  F._setEnv({ lib: lib2, features: FEAT, storage: memoryStorage(), version: '2.2.2', nav: navOf(CELL) });
  try {
    await F.refresh();
    await tick(1);
    assert.equal(lib2.pruned, 1, 'ménage du cache (modèle du banc d’essai, autre version) quand rien ne se télécharge');
  } finally { F._setEnv(null); }
});

test('étalonnage : page cachée ou gelée → abandon sans verdict ; Supprimer oublie le verdict ; « Refaire l’essai de vitesse »', async () => {
  const doc = {
    visibilityState: 'visible', ls: {},
    addEventListener(t, f) { (doc.ls[t] = doc.ls[t] || new Set()).add(f); },
    removeEventListener(t, f) { if (doc.ls[t]) doc.ls[t].delete(f); },
    fire(t) { for (const f of [...(doc.ls[t] || [])]) f({ type: t }); }
  };
  globalThis.document = doc;
  const st = memoryStorage({ [F.STATE_KEY]: JSON.stringify({ launches: 5 }) });
  const lib = fakeLib(ALL);
  F._setEnv({ lib, features: FEAT, storage: st, version: '2.2.2', nav: navOf(CELL) });
  try {
    assert.equal((await F.refresh()).state, 'cached');
    for (const how of ['hidden', 'freeze']) {
      const b = F.boot();
      await tick(1);
      assert.equal(F.status().state, 'starting');
      if (how === 'hidden') { doc.visibilityState = 'hidden'; doc.fire('visibilitychange'); } else doc.fire('freeze');
      assert.equal(await b, false, how);
      assert.equal(F.status().state, 'cached', how + ' : repris au retour');
      assert.equal(F.readState().verdict, undefined, how + ' : aucun verdict');
      assert.equal((doc.ls.visibilitychange || new Set()).size + (doc.ls.freeze || new Set()).size, 0, 'écouteurs retirés');
      doc.visibilityState = 'visible';
    }
    /* un vrai essai : prête, verdict gardé */
    let b = F.boot();
    await tick(1);
    lib.go();
    assert.equal(await b, true);
    assert.equal(F.status().state, 'ready');
    assert.equal(F.readState().verdict, 'ok');
    /* VFV-3 : « Supprimer » oublie le verdict (un nouveau téléchargement refait l'essai) */
    F.writeState({ verdict: 'slow', want: 'parent', started: true });
    await F.remove();
    const s = F.readState();
    assert.deepEqual([s.removed, s.want, s.started, s.v, s.verdict, s.rtf, s.bootMs], [true, null, null, null, null, null, null]);
    assert.equal(F.status().state, 'absent');
    /* « trop lente » : refaire l'essai sans retélécharger */
    lib.cached.clear(); ALL.forEach(k => lib.cached.add(k));
    F.writeState({ removed: false, v: '2.2.2', verdict: 'slow', rtf: null, bootMs: 15001 });
    assert.equal((await F.refresh()).state, 'slow');
    b = F.retry();
    await tick(5);
    assert.equal(F.status().state, 'starting');
    lib.go();
    assert.equal(await b, true);
    assert.equal(F.status().state, 'ready');
    assert.equal(F.status().verdict, 'ok');
  } finally { F._setEnv(null); delete globalThis.document; }
});

test('micro, mémoire faible : la voix fluide attend la prochaine ouverture (Vosk reste chargé) ; 8 Go : elle revient', async () => {
  const lib = fakeLib(ALL);
  F._setEnv({ engine: fakeEngine(), features: { ...FEAT, deviceMemory: 4 }, storage: memoryStorage(), version: '2.2.2', lib });
  try {
    F.micWillStart();
    assert.equal(F.ready(), false, 'moteur libéré quand le micro démarre');
    assert.deepEqual([F.status().state, F.status().held, F.status().parked], ['cached', true, true]);
  } finally { F._setEnv(null); }
  for (const mem of [4, 8]) {
    const l = fakeLib(ALL);
    F._setEnv({ lib: l, features: { ...FEAT, deviceMemory: mem }, storage: memoryStorage({ [F.STATE_KEY]: JSON.stringify({ v: '2.2.2', verdict: 'ok', rtf: 0.4 }) }), version: '2.2.2', micUsed: true });
    try {
      assert.equal((await F.refresh()).state, 'cached');
      assert.equal(F.status().parked, mem === 4);
      const b = F.boot();
      await tick(1);
      if (l.go) l.go();
      assert.equal(await b, mem === 8, mem + ' Go');
      assert.equal(l.boots, mem === 8 ? 1 : 0);
    } finally { F._setEnv(null); }
  }
  /* tables : la question suivante n'est pas calculée d'avance quand le micro est voulu (elle ne sera pas dite) */
  assert.match(SRC('js/games/tables.js'), /if \(upcoming \|\| !alive \|\| ended \|\| micWanted\(\) \|\| !ctx\.voice \|\| !ctx\.voice\.canPrepare\) return;/);
});

test('ligne « Voix fluide » (espace parents) et « État de cet appareil » : supprimée, trop lente, en pause après le micro', async () => {
  const { rowModel } = await import('../js/ui/voice-fluid.js');
  const { describe } = await import('../js/ui/diag.js');
  assert.equal(rowModel({ state: 'absent' }).text, 'Pas encore téléchargée.');
  assert.equal(rowModel({ state: 'absent', removed: true }).text, 'Supprimée de cet appareil.', 'VFV-7');
  assert.deepEqual(rowModel({ state: 'absent', removed: true }).buttons, ['download']);
  assert.deepEqual(rowModel({ state: 'slow' }).buttons, ['recheck', 'remove'], 'recours du parent');
  assert.match(rowModel({ state: 'slow' }).text, /Nouvel essai automatique à la prochaine version de Caramel\.$/);
  assert.match(rowModel({ state: 'cached', parked: true }).text, /prochaine ouverture de Caramel\.$/);
  assert.match(rowModel({ state: 'cached', held: true, parked: true }).text, /pendant que le micro écoute\.$/);
  assert.match(rowModel({ state: 'cached' }).text, /arrière-plan\.$/);
  const fl = f => describe({ fluid: f }).find(r => r.key === 'fluid').value;
  assert.equal(fl({ state: 'absent', removed: true }), 'supprimée (espace parents)');
  assert.equal(fl({ state: 'cached', parked: true }), 'téléchargée, en pause après le micro jusqu’à la prochaine ouverture');
  const ui = SRC('js/ui/voice-fluid.js');
  assert.match(ui, /fluid\.cancelDownload\(\{ byParent: true \}\)/, '« Arrêter » : arrêt du parent');
  assert.match(ui, /recheck: \(\) => btn\('recheck', label\('🔄', 'Refaire l’essai de vitesse'\), false, \(\) => \{ fluid\.retry\(\); \}\)/);
});

test('« État de cet appareil » : relue quand la voix fluide change d’état ou de dizaine de %, pas sans changement, plus une fois la carte retirée (VE-fix)', async () => {
  const { diagCard } = await import('../js/ui/diag.js');
  let runs = 0;                                   /* chaque lecture commence par aria-busy="true" sur la liste */
  const el = tag => ({ tag, attrs: {}, children: [], style: {}, dataset: {}, textContent: '',
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'aria-busy' && String(v) === 'true') runs++; },
    appendChild(c) { this.children.push(c); return c; }, addEventListener() {} });
  const had = Object.getOwnPropertyDescriptor(globalThis, 'document');
  globalThis.document = { createElement: el, createElementNS: (ns, t) => el(t), createTextNode: t => ({ text: String(t) }), querySelector: () => null };
  const lib = fakeLib();
  let onP = null;                                 /* progression du téléchargement, donnée à la main */
  const ens = lib.ensureFiles;
  lib.ensureFiles = (fs, o = {}) => { onP = o.onProgress; return ens(fs, o); };
  F._setEnv({ lib, features: FEAT, storage: memoryStorage({ [F.STATE_KEY]: JSON.stringify({ launches: 3 }) }), version: '2.2.2', nav: navOf(CELL) });
  let card = null;
  try {
    assert.equal((await F.refresh()).state, 'absent');
    card = diagCard();
    await tick(30);
    const r0 = runs;
    card.isConnected = true;                      /* affichée */
    await F.refresh();
    await tick(30);
    assert.equal(runs, r0, 'même état : rien à relire');
    const p = F.download({ by: 'parent' });
    await tick(5);
    assert.equal(F.status().state, 'downloading');
    assert.equal(runs, r0 + 1, 'téléchargement : relue');
    await tick(260); onP({ loaded: 5, total: 100 }); await tick(5);
    assert.equal(F.status().progress.loaded, 5);
    assert.equal(runs, r0 + 1, '5 % : même dizaine, rien à relire');
    await tick(260); onP({ loaded: 37, total: 100 }); await tick(5);
    assert.equal(runs, r0 + 2, '37 % : relue');
    lib.finish();
    assert.equal(await p, true);
    await tick(30);
    assert.notEqual(F.status().state, 'downloading');
    const r1 = runs;
    assert.ok(r1 >= r0 + 3, 'téléchargée : relue (' + F.status().state + ')');
    card.isConnected = false;                     /* l'écran a changé : plus d'abonnement */
    await F.remove();
    await tick(30);
    assert.equal(F.status().state, 'absent');
    assert.equal(runs, r1, 'carte retirée : plus relue');
  } finally {
    if (card) card.isConnected = false;
    F._setEnv(null);
    if (had) Object.defineProperty(globalThis, 'document', had); else delete globalThis.document;
  }
});

/* ---------- voix d'enfant : Siwis « rajeunie » (décision du parent du 05/10/2026 : degré 4, r = 1,33) ---------- */
test('voix d’enfant : un seul réglage (YOUTH) pour les clips, la voix fluide et le banc d’essai', () => {
  assert.equal(YOUTH, 1.33, 'degré 4 retenu par le parent (+5 demi-tons)');
  assert.deepEqual([...YOUTH_DEGREES], [1, 1.12, 1.19, 1.26, 1.33], 'degrés écoutés, 0 = Siwis telle quelle');
  assert.equal(PARAMS.youth, YOUTH);
  assert.equal(TV.PARAMS, PARAMS, 'tools/voix.mjs : les réglages de la voix fluide, pas une copie');
  assert.equal(TV.YOUTH, YOUTH);
  assert.equal(TV.YOUTH_FILTER, 'asetrate=29327,aresample=22050', 'clips : relus 1,33 fois plus vite, ramenés à 22 050 Hz');
  assert.equal(VOICE.youth, YOUTH, 'le manifeste dit le réglage de ses clips');
  assert.equal(P.PARAMS, PARAMS);
  assert.equal(P.YOUTH_DEGREES, YOUTH_DEGREES);
  const [ns, ls, nw] = scalesOf(PARAMS);
  assert.deepEqual([ns, nw], [0.75, 0.9]);
  assert.ok(Math.abs(ls - 1.3965) < 1e-9, 'Piper parle 1,33 fois plus lentement (1,05 × 1,33)');
  assert.equal(scalesOf({ ...PARAMS, youth: 1 })[1], 1.05, 'degré 0 : la voix de Siwis');
  assert.equal(scalesOf({ length_scale: 1.05, noise_scale: 0.75, noise_w: 0.9 })[1], 1.05, 'sans youth : telle quelle');
  const page = SRC('tests/harness/piper.html');
  assert.match(page, /YOUTH_DEGREES\.forEach/, 'le banc d’essai propose les degrés 0 à 4');
  assert.match(page, /piper\.speak\(text, \{ params: params\(\) \}\) : piper\.synth\(text, \{ params: params\(\) \}\)/, 'lecture, WAV et mesures au degré choisi');
});

test('voix d’enfant : rejuvenate() lit le son 1,33 fois plus vite (hauteur et timbre × 1,33), sans repliement', () => {
  const sr = 22050;
  const sine = (f, n = sr) => Float32Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * f * i / sr));
  const freq = x => { let c = 0; for (let i = 1; i < x.length; i++) if ((x[i - 1] < 0) !== (x[i] < 0)) c++; return c / 2 / (x.length / sr); };
  const rms = x => Math.sqrt(x.subarray(500, -500).reduce((a, v) => a + v * v, 0) / (x.length - 1000));
  const x = sine(200);
  assert.equal(rejuvenate(x, 1), x, 'degré 0 : le même son');
  const y = rejuvenate(x);
  assert.equal(y.length, Math.floor(sr / 1.33), 'durée ÷ 1,33 (Piper a parlé 1,33 fois plus lentement)');
  assert.ok(Math.abs(freq(y) - 266) < 1.5, 'hauteur : 200 Hz → 266 Hz (' + freq(y) + ')');
  assert.ok(Math.abs(rms(y) - rms(x)) < 0.002, 'volume inchangé');
  const z = rejuvenate(sine(3000));
  assert.ok(Math.abs(freq(z) - 3990) < 6, 'timbre : 3 000 Hz → 3 990 Hz');
  assert.ok(rms(rejuvenate(sine(10000))) < 0.003, '10 kHz → 13,3 kHz, au-delà de 11 025 Hz : filtré, pas replié');
  assert.equal(rejuvenate(new Float32Array(0)).length, 0);
});
