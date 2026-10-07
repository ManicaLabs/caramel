/* Préchargement (v2.2.3, demande du parent du 06/10/2026 : « tous les chargements à la première ouverture, quitte à avoir
   une barre de chargement le temps qu'on configure son profil ») : moteur du micro et voix fluide partent dès la première
   ouverture, sous une seule barre. Politique pure (planOf, pctOf, sizeOf, barModel), puis l'orchestration face à un faux
   moteur du micro (prefetch, modelReady), la VRAIE voix fluide (js/core/voice-fluid.js) sur un faux cache et un faux
   réseau : Wi-Fi, données mobiles (l'adulte décide), hors ligne puis retour du réseau, appareil déjà configuré
   (extraction seule, tout prêt), exclusions de la voix fluide, un jeu pendant le préchargement. */
import { test, assert, memoryStorage } from './_t.mjs';
import { readFileSync } from 'node:fs';
import * as PL from '../js/core/preload.js';
import * as F from '../js/core/voice-fluid.js';
import { barModel } from '../js/ui/preload.js';
import { micTrouble } from '../js/ui/game-ctx.js';

const SRC = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const tick = ms => new Promise(r => setTimeout(r, ms));
const NN = '\u202f', NB = '\u00a0';
const ALL_BYTES = PL.BYTES.voskLib + PL.BYTES.voskModel + PL.BYTES.fluid;

/* ---------- politique (pur) ---------- */
test('politique : Wi-Fi ou inconnue → tout part ; données mobiles, économie de données → l’adulte ; hors ligne → attendre ; rien ne transite → tout seul', () => {
  const V = { bytes: PL.BYTES.voskLib + PL.BYTES.voskModel };
  const ok = { ok: true, why: 'wifi' };
  assert.deepEqual(PL.planOf({ net: 'wifi', vosk: V, fluid: ok }), { vosk: 'run', fluid: 'run', mode: 'run', bytes: 0 });
  assert.deepEqual(PL.planOf({ net: 'unknown', vosk: V, fluid: { ok: true, why: 'unknown' } }).mode, 'run', 'iPhone, iPad, ordinateur');
  for (const net of ['cellular', 'save-data']) {
    const p = PL.planOf({ net, vosk: V, fluid: { ok: false, why: net } });
    assert.deepEqual(p, { vosk: 'ask', fluid: 'ask', mode: 'ask', bytes: ALL_BYTES }, net);
    assert.equal(PL.sizeOf(p.bytes), '≈' + NB + '97' + NB + 'Mo', 'le bouton dit ce qui manque vraiment');
    assert.deepEqual(PL.planOf({ net, vosk: V, fluid: { ok: false, why: net }, consent: true }).mode, 'run', net + ' : l’adulte a dit oui');
    assert.equal(PL.planOf({ net, vosk: { bytes: 0 }, fluid: null }).vosk, 'run', 'extraction d’un modèle déjà en cache : aucune donnée');
  }
  assert.deepEqual(PL.planOf({ net: 'offline', vosk: V, fluid: { ok: false, why: 'offline' } }), { vosk: 'wait', fluid: 'wait', mode: 'wait', bytes: 0 });
  assert.equal(PL.planOf({ net: 'offline', vosk: { bytes: 0 } }).mode, 'run', 'hors ligne, l’extraction se fait quand même');
  /* voix fluide : ses exclusions la retirent du plan (le micro reste) */
  for (const why of ['unsupported', 'modest', 'removed', 'slow', 'cached']) {
    const p = PL.planOf({ net: 'cellular', vosk: V, fluid: { ok: false, why } });
    assert.deepEqual([p.fluid, p.mode, PL.sizeOf(p.bytes)], [null, 'ask', '≈' + NB + '52' + NB + 'Mo'], why);
  }
  assert.equal(PL.planOf({ net: 'wifi', vosk: null, fluid: { ok: false, why: 'in-game' } }).fluid, 'run', 'jeu en cours : elle reprendra après');
  assert.deepEqual(PL.planOf({ net: 'wifi' }), { vosk: null, fluid: null, mode: 'none', bytes: 0 }, 'tout est prêt');
  assert.deepEqual(PL.planOf({ net: 'cellular', vosk: null, fluid: { ok: false, why: 'cellular' } }).bytes, PL.BYTES.fluid);
  assert.equal(PL.sizeOf(PL.BYTES.fluid), '≈' + NB + '45' + NB + 'Mo');
  /* avancée commune */
  assert.equal(PL.pctOf([{ expect: 50, got: 25 }, { expect: 50, got: 0 }]), 25);
  assert.equal(PL.pctOf([{ expect: 3, got: 2 }]), 66, 'arrondi par défaut : 100 seulement quand tout est là');
  assert.equal(PL.pctOf([{ expect: 10, got: 99 }]), 100, 'jamais plus que prévu');
  assert.equal(PL.pctOf([{ expect: 0, got: 0 }]), null, 'rien à compter');
  assert.equal(PL.pctOf([]), null);
});

test('barre : « Je prépare ma voix et mes oreilles… 42 % », « presque fini », « Voix et micro prêts ✓ », un seul bouton en données mobiles, rien sinon', () => {
  const both = { vosk: true, fluid: true };
  assert.deepEqual(barModel({ state: 'running', pct: 42, parts: both }),
    { kind: 'run', text: 'Je prépare ma voix et mes oreilles… 42' + NN + '%', pct: 42, button: '', label: 'Je prépare ma voix et mes oreilles' });
  assert.equal(barModel({ state: 'running', pct: 99, parts: both }).text, 'Je prépare ma voix et mes oreilles… presque fini' + NN + '!');
  assert.equal(barModel({ state: 'running', pct: null, parts: both }).text, 'Je prépare ma voix et mes oreilles…');
  assert.equal(barModel({ state: 'running', pct: null, parts: both }).pct, null, 'rien ne se compte : trait animé');
  assert.equal(barModel({ state: 'running', pct: 7, parts: { vosk: true, fluid: false } }).text, 'Je prépare mes oreilles… 7' + NN + '%');
  assert.equal(barModel({ state: 'running', pct: 7, parts: { vosk: false, fluid: true } }).text, 'Je prépare ma voix… 7' + NN + '%');
  assert.equal(barModel({ state: 'done', pct: 100, parts: both }).text, 'Voix et micro prêts ✓');
  assert.equal(barModel({ state: 'done', pct: 100, parts: { vosk: true, fluid: false } }).text, 'Micro prêt ✓');
  assert.equal(barModel({ state: 'done', pct: 100, parts: { vosk: false, fluid: true } }).text, 'Voix prête ✓');
  const ask = barModel({ state: 'ask', bytes: ALL_BYTES, parts: both });
  assert.equal(ask.kind, 'ask');
  assert.equal(ask.button, 'Télécharger maintenant (≈' + NB + '97' + NB + 'Mo)');
  assert.equal(ask.text, '', 'le bouton, et rien d’autre');
  assert.ok(ask.label.startsWith(ask.button), 'nom accessible : commence par le texte visible');
  for (const state of ['idle', 'checking', 'none', 'wait']) assert.equal(barModel({ state }).kind, null, state + ' : pas de barre');
});

/* ---------- orchestration : faux micro, vraie voix fluide sur un faux cache ---------- */
const FEAT = { wasm: true, simd: true, shared: true, worker: true, moduleWorker: true, cacheStorage: true, deviceMemory: 8 };
const KEYS = ['ortMjs', 'ortWasm', 'model'];
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
function fakeLib(have = []) {
  const files = KEYS.map(key => ({ key, url: 'https://x.test/' + key, bytes: key === 'model' ? 30 : 10 }));
  const cached = new Set(have);
  const lib = {
    ORT_VERSION: '1.22.0', ORT_LEGACY: '1.18.0', ortFor: () => '1.22.0', features: () => FEAT, filesFor: () => files,
    cached, starts: 0, finish: null, progress: null,
    missingFiles: async fs => fs.filter(f => !cached.has(f.key)),
    ensureFiles: (fs, { signal, onProgress } = {}) => new Promise((res, rej) => {
      lib.starts++;
      const total = fs.filter(f => !cached.has(f.key)).reduce((s, f) => s + f.bytes, 0);
      lib.progress = loaded => onProgress({ loaded, total });
      lib.finish = () => { fs.forEach(f => cached.add(f.key)); res({ buffers: {} }); };
      if (signal) signal.addEventListener('abort', () => rej(Object.assign(new Error('interrompu'), { name: 'AbortError' })), { once: true });
    }),
    prune: async () => {}, clearCache: async () => { cached.clear(); },
    loadPiper: () => new Promise(() => {})                     /* le moteur ne démarre jamais ici */
  };
  return lib;
}
function fakeSpeech({ ready = false } = {}) {
  const sp = {
    MODEL_URL: 'models/fr.tar.gz', VOSK_LIB: 'https://cdn.test/vosk.js', ready, prefetches: 0, readyChecks: 0, onPct: null, end: null, opts: null,
    modelReady: async () => { sp.readyChecks++; return sp.ready; },
    prefetch(o = {}) {
      sp.prefetches++; sp.opts = o; sp.onPct = o.onPct;
      return new Promise(res => { sp.end = ok => { if (ok) sp.ready = true; res(ok); }; });
    }
  };
  return sp;
}
const fakeCaches = (have = []) => ({ open: async name => ({ match: async key => (have.includes(name + '|' + key) ? {} : undefined) }) });
function fakeNav(type, { onLine = true, saveData = false } = {}) {
  const ls = new Set();
  const connection = { type, saveData, addEventListener: (t, f) => ls.add(f), removeEventListener: (t, f) => ls.delete(f), fire: () => ls.forEach(f => f()) };
  return { userAgent: ANDROID, connection, onLine, mediaDevices: { getUserMedia() {} } };
}
function fakeWin() {
  const ls = {};
  return { addEventListener(t, f) { (ls[t] = ls[t] || new Set()).add(f); }, removeEventListener(t, f) { if (ls[t]) ls[t].delete(f); },
    fire(t) { for (const f of [...(ls[t] || [])]) f({ type: t }); } };
}
function setup({ net = 'wifi', onLine = true, saveData = false, speechReady = false, cachesHave = [], fluidHave = [], features = FEAT, fluidState = {}, store = null } = {}) {
  const nav = fakeNav(net, { onLine, saveData });
  const win = fakeWin();
  const lib = fakeLib(fluidHave);
  const sp = fakeSpeech({ ready: speechReady });
  const holds = [];
  F._setEnv({ lib, features, storage: memoryStorage({ [F.STATE_KEY]: JSON.stringify(fluidState) }), version: '2.2.3', nav });
  /* la vraie voix fluide (son init est celui de main.js : déjà fait) ; holdBoot observé */
  const fluid = { ...F, init() {}, holdBoot: p => { holds.push(p); return F.holdBoot(p); } };
  const st = store || memoryStorage();
  PL._setEnv({ speech: sp, fluid, storage: st, nav, win, caches: fakeCaches(cachesHave) });
  const seen = [];
  PL.onChange(s => seen.push(s));
  return { nav, win, lib, sp, holds, st, seen };
}
const teardown = () => { PL._setEnv(null); F._setEnv(null); };

test('1re ouverture en Wi-Fi : le micro d’abord, la voix fluide dès que son modèle est arrivé (retenue pendant l’extraction), une seule barre jusqu’à « prêts »', async () => {
  const E = setup();
  try {
    assert.equal(PL.status().state, 'idle');
    const s0 = await PL.start();
    assert.equal(s0.state, 'running');
    assert.deepEqual(s0.parts, { vosk: true, fluid: true });
    assert.equal(s0.pct, 0);
    assert.equal(E.sp.prefetches, 1, 'moteur du micro lancé');
    assert.equal(E.sp.opts.extract, true, 'extrait une fois pour toutes');
    assert.equal(E.lib.starts, 0, 'la voix fluide attend le modèle du micro (le micro sert aux jeux)');
    assert.equal(F.status().state, 'absent');
    E.sp.onPct(50);
    assert.equal(PL.status().pct, Math.floor(100 * (PL.BYTES.voskLib + PL.BYTES.voskModel / 2) / ALL_BYTES), '29 % : bibliothèque + moitié du modèle');
    assert.equal(E.holds.length, 0, 'téléchargement : pas de calcul lourd');
    E.sp.onPct(99);
    await tick(5);
    assert.equal(E.holds.length, 1, 'extraction : la voix fluide ne démarre ni ne s’étalonne');
    assert.equal(F.status().state, 'downloading', 'la voix fluide descend pendant l’extraction');
    assert.equal(F.readState().want == null, true, 'téléchargement automatique, pas « demandé par un adulte »');
    await tick(260);
    E.lib.progress(25);
    assert.equal(PL.status().pct, Math.floor(100 * (PL.BYTES.voskLib + PL.BYTES.voskModel * 0.99 + PL.BYTES.fluid / 2) / ALL_BYTES));
    E.sp.end(true);
    await tick(5);
    assert.equal(PL.micReady(), true);
    assert.equal(PL.status().state, 'running', 'la voix fluide n’a pas fini');
    E.lib.finish();
    await tick(5);
    const s = PL.status();
    assert.deepEqual([s.state, s.pct, s.parts], ['done', 100, { vosk: true, fluid: true }]);
    assert.equal(barModel(s).text, 'Voix et micro prêts ✓');
    const pcts = E.seen.filter(x => x.state === 'running' && x.pct !== null).map(x => x.pct);
    assert.deepEqual(pcts, [...pcts].sort((a, b) => a - b), 'la barre ne recule jamais : ' + pcts.join(', '));
    assert.ok(pcts.every(p => p <= 99), '100 % seulement quand tout est là');
    /* accueil remonté ensuite : rien n'est revérifié, rien ne repart */
    const n = E.sp.readyChecks;
    assert.equal((await PL.start()).state, 'done');
    assert.equal(E.sp.readyChecks, n);
    assert.equal(E.sp.prefetches, 1);
  } finally { teardown(); }
});

test('données mobiles : rien ne part tout seul ; « Télécharger maintenant (≈ 97 Mo) » pour l’adulte ; son accord tient jusqu’à la fin, même après une fermeture', async () => {
  const st = memoryStorage();
  let E = setup({ net: 'cellular', store: st });
  try {
    const s = await PL.start();
    assert.deepEqual([s.state, s.bytes, s.parts], ['ask', ALL_BYTES, { vosk: true, fluid: true }]);
    assert.equal(barModel(s).button, 'Télécharger maintenant (≈' + NB + '97' + NB + 'Mo)');
    assert.equal(E.sp.prefetches, 0, 'rien de lancé');
    assert.equal(F.status().state, 'absent');
    assert.equal(E.lib.starts, 0);
    /* l'adulte touche le bouton */
    const s2 = await PL.start({ by: 'parent' });
    assert.equal(s2.state, 'running');
    assert.equal(E.sp.prefetches, 1);
    assert.equal(PL.readState(st).consent, true);
    E.sp.onPct(99);
    await tick(5);
    assert.equal(F.status().state, 'downloading');
    assert.equal(F.readState().want, 'parent', 'demandée par un adulte : reprend d’elle-même après un jeu, même en données mobiles');
  } finally { teardown(); }
  /* appli fermée avant la fin : à la réouverture, l'accord tient */
  E = setup({ net: 'cellular', store: st });
  try {
    assert.equal((await PL.start()).state, 'running', 'accord gardé');
    assert.equal(E.sp.prefetches, 1);
    E.sp.end(true);
    await tick(10);
    assert.equal(F.status().state, 'downloading');
    E.lib.finish();
    await tick(5);
    assert.equal(PL.status().state, 'done');
    assert.equal(PL.readState(st).consent, null, 'fini : l’accord est oublié (une autre fois, on redemandera)');
  } finally { teardown(); }
  /* économie de données : pareil */
  E = setup({ net: 'wifi', saveData: true });
  try {
    assert.equal((await PL.start()).state, 'ask');
    assert.equal(E.sp.prefetches, 0);
  } finally { teardown(); }
});

test('hors ligne : rien (pas de barre) ; au retour du réseau, tout part ; passage du réseau mobile au Wi-Fi : tout part', async () => {
  let E = setup({ onLine: false });
  try {
    const s = await PL.start();
    assert.equal(s.state, 'wait');
    assert.equal(barModel(s).kind, null, 'aucune barre');
    assert.equal(E.sp.prefetches, 0);
    E.nav.onLine = true;
    E.win.fire('online');
    await tick(1300);
    await tick(20);
    assert.equal(PL.status().state, 'running');
    assert.equal(E.sp.prefetches, 1);
  } finally { teardown(); }
  E = setup({ net: 'cellular' });
  try {
    assert.equal((await PL.start()).state, 'ask');
    E.nav.connection.type = 'wifi';
    E.nav.connection.fire();
    await tick(1300);
    await tick(20);
    assert.equal(PL.status().state, 'running');
    assert.equal(E.sp.prefetches, 1);
  } finally { teardown(); }
});

test('appareil déjà configuré (mise à jour) : modèle du micro en cache → extraction seule, même en données mobiles, voix fluide retenue ; tout prêt → aucune barre', async () => {
  const E = setup({ net: 'cellular', cachesHave: ['vosk-model-v1|models/fr.tar.gz', 'vosk-lib-v1|https://cdn.test/vosk.js'], fluidHave: KEYS });
  try {
    const s = await PL.start();
    assert.equal(s.state, 'running', 'rien ne transite : pas besoin de l’adulte');
    assert.deepEqual(s.parts, { vosk: true, fluid: false });
    assert.equal(s.pct, null, 'rien à compter');
    assert.equal(barModel(s).text, 'Je prépare mes oreilles…');
    assert.equal(E.holds.length, 1, 'la voix fluide (déjà là) ne s’étalonne pas pendant l’extraction');
    E.sp.end(true);
    await tick(5);
    assert.equal(PL.status().state, 'done');
    assert.equal(barModel(PL.status()).text, 'Micro prêt ✓');
  } finally { teardown(); }
  const E2 = setup({ speechReady: true, fluidHave: KEYS });
  try {
    const s = await PL.start();
    assert.equal(s.state, 'none');
    assert.equal(barModel(s).kind, null, 'aucune barre');
    assert.deepEqual([E2.sp.prefetches, E2.lib.starts], [0, 0]);
    assert.equal(PL.micReady(), true);
  } finally { teardown(); }
  /* le modèle est prêt, la voix fluide manque (Wi-Fi) : elle seule */
  const E3 = setup({ speechReady: true });
  try {
    const s = await PL.start();
    await tick(5);
    assert.deepEqual([s.state, s.parts], ['running', { vosk: false, fluid: true }]);
    assert.equal(F.status().state, 'downloading', 'sans attendre');
    assert.equal(E3.sp.prefetches, 0);
  } finally { teardown(); }
});

test('voix fluide : ses exclusions tiennent (appareil modeste, « Supprimer », trop lente, non supportée) — le micro seul, ≈ 52 Mo', async () => {
  for (const [name, o] of [['modeste', { features: { ...FEAT, deviceMemory: 2 } }], ['supprimée', { fluidState: { removed: true } }],
    ['trop lente', { fluidState: { v: '2.2.3', verdict: 'slow' } }], ['non supportée', { features: { ...FEAT, simd: false } }]]) {
    const E = setup({ net: 'cellular', ...o });
    try {
      const s = await PL.start();
      assert.deepEqual([s.state, s.parts, PL.sizeOf(s.bytes)], ['ask', { vosk: true, fluid: false }, '≈' + NB + '52' + NB + 'Mo'], name);
      await PL.start({ by: 'parent' });
      E.sp.end(true);
      await tick(10);
      assert.equal(E.lib.starts, 0, name + ' : jamais téléchargée');
      assert.equal(F.readState().want == null, true, name + ' : « Supprimer » du parent respecté');
      assert.equal(PL.status().state, 'done', name);
    } finally { teardown(); }
  }
});

test('un jeu pendant le préchargement : le micro continue et le jeu reçoit son pourcentage ; la voix fluide s’interrompt, puis reprend au retour à l’accueil', async () => {
  const E = setup();
  try {
    await PL.start();
    E.sp.onPct(40);
    const got = [];
    const off = PL.followVosk(p => got.push(p));
    assert.deepEqual(got, [40], 'le jeu voit tout de suite où en est le modèle');
    E.sp.onPct(99);
    await tick(5);
    assert.deepEqual(got, [40, 99]);
    assert.equal(F.status().state, 'downloading');
    F.onRoute({ name: 'play' });
    await tick(5);
    assert.equal(F.status().state, 'paused', 'un jeu interrompt la voix fluide (la connexion va au micro)');
    E.sp.end(true);
    await tick(10);
    off();
    assert.equal(PL.micReady(), true);
    assert.equal(PL.status().state, 'running', 'pas fini : la voix fluide reprendra');
    assert.notEqual(F.status().state, 'downloading', 'rien ne repart pendant le jeu');
    assert.equal(E.lib.starts, 1);
    F.onRoute({ name: 'home' });
    await PL.start();                                           /* l'accueil remonte */
    await tick(5);
    assert.equal(F.status().state, 'downloading', 'reprise');
    E.lib.finish();
    await tick(5);
    assert.equal(PL.status().state, 'done');
    let late = 0;
    PL.followVosk(() => late++);
    assert.equal(late, 0, 'préchargement fini : plus rien à suivre');
  } finally { teardown(); }
  /* le jeu commence AVANT l'arrivée du modèle : la voix fluide, refusée pendant le jeu, part au retour (vu dans Chrome :
     un refus laissait un téléchargement fantôme qui bloquait toute reprise) */
  const E2 = setup();
  try {
    await PL.start();
    F.onRoute({ name: 'play' });
    E2.sp.onPct(99);
    await tick(10);
    assert.notEqual(F.status().state, 'downloading', 'refusée pendant le jeu');
    E2.sp.end(true);
    await tick(10);
    assert.equal(PL.status().state, 'running');
    F.onRoute({ name: 'home' });
    await PL.start();
    await tick(10);
    assert.equal(F.status().state, 'downloading', 'au retour à l’accueil');
    E2.lib.finish();
    await tick(5);
    assert.equal(PL.status().state, 'done');
  } finally { teardown(); }
});

/* ---------- branchements ---------- */
test('branchements : création du profil et accueil lancent le préchargement sans l’attendre ; les jeux n’invitent plus à télécharger quand le moteur est là', () => {
  const ob = SRC('js/ui/onboarding.js'), home = SRC('js/ui/home.js'), ctx = SRC('js/ui/game-ctx.js');
  assert.match(ob, /later\(\(\) => \{ preload\.start\(\)\.catch\(\(\) => \{\}\); \}, 600\);/, 'onboarding : lancé en arrière-plan');
  assert.match(home, /preload\.start\(\)\.catch\(\(\) => \{\}\);/);
  for (const [name, s] of [['onboarding', ob], ['home', home]]) {
    assert.doesNotMatch(s, /await preload\.start/, name + ' : la configuration n’attend jamais');
    assert.match(s, /preloadBar\(\)/, name + ' : la même barre');
    assert.match(s, /my\.bar\.destroy\(\)/, name);
  }
  assert.match(ctx, /const off = preload\.followVosk\(onPct\);/, 'le jeu qui attend reçoit le pourcentage du préchargement');
  const adult = r => micTrouble('network', { voskReady: r }).adult;
  assert.doesNotMatch(adult(true), /télécharge/i, 'moteur déjà sur l’appareil : aucune invitation à télécharger');
  assert.match(adult(false), /télécharge une seule fois/);
  assert.equal(micTrouble('network', { voskReady: true }).title, micTrouble('network').title, 'ce que l’enfant voit ne change pas');
  assert.doesNotMatch(SRC('js/ui/parents.js'), /à la première partie où l’enfant parle au micro/);
  assert.match(SRC('js/ui/parents.js'), /se téléchargent une seule fois, en arrière-plan, dès la première ouverture de Caramel/);
  assert.match(SRC('css/ui/preload.css'), /\.hm:has\(> \.pl:not\(\[hidden\]\)\) \.cc\.is-hero \.cc-stage/, 'accueil : la scène cède sa place, « Jouer » ne bouge pas');
});
