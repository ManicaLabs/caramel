/* ============ VOIX FLUIDE DU COMPAGNON (v2.2.2, décision du parent du 04/10/2026) ============
   Les clips assemblés mot à mot (js/core/voice-clips.js) sont jugés « saccadés » : les phrases composées (calculs,
   nombres, astuces, explications) et les phrases à prénom sont dites d'un seul tenant par la même voix d'enfant (Piper
   « siwis medium » rajeunie, YOUTH), calculée sur l'appareil (js/core/piper-tts.js, moteur js/core/piper-engine.js dans un
   worker, qui rend le son déjà rééchantillonné : durées, cache et 🔊 n'en savent rien). Ce module
   décide QUAND télécharger, démarrer, étalonner, prépare les phrases à l'avance et les joue. L'aiguillage (quelle voix
   dit quoi) est dans js/ui/voice.js ; la ligne « Voix fluide » de l'espace parents dans js/ui/voice-fluid.js ; l'état
   apparaît dans « État de cet appareil » (js/ui/diag.js).

   Téléchargement (≈ 45 Mo, Cache Storage « piper-tts-v1 », jamais purgé par sw.js ; navigator.storage.persist()) :
     - jamais au premier lancement, jamais pendant un jeu (un téléchargement en cours s'interrompt quand un jeu démarre) ;
     - de lui-même, en tâche de fond APRÈS une séance (retour d'un jeu), quand navigator.connection dit Wi-Fi (ou câble)
       sans économie de données : Android, ordinateur (Chrome ne donne pas le type de connexion d'un ordinateur : une
       connexion d'ordinateur est tenue pour fixe) ; jamais sur un appareil modeste (≤ 2 Go annoncés) ;
     - sinon (iPhone, iPad, données mobiles, connexion inconnue, économie de données) : proposé aux PARENTS seulement, dans
       l'espace parents (« Voix fluide : ≈ 45 Mo, Wi-Fi conseillé », progression, « Supprimer ») ; un téléchargement
       demandé par un parent puis interrompu par un jeu reprend de lui-même après la séance (pas s'il l'a arrêté) ;
     - « Supprimer » (parent) : plus jamais de téléchargement automatique sur cet appareil.
   Démarrage : le moteur démarre dans un worker, en tâche de fond, quand la voix est en cache (quelques secondes après
   l'ouverture, page visible) ; jamais pendant que le micro de la course ou des tables démarre (micWillStart, appelé par
   js/ui/game-ctx.js avant ensureVosk / startListening : un démarrage en cours est abandonné et repris plus tard) ; sur un
   appareil à mémoire faible (navigator.deviceMemory ≤ 4 Go, ou inconnue : Safari, Firefox), le moteur est LIBÉRÉ quand le
   micro démarre et ne redémarre qu'à la prochaine ouverture de Caramel : Vosk, une fois chargé, reste en mémoire
   (speech.js ne le libère pas) ; le micro et la voix fluide ne coexistent jamais.
   Étalonnage, une fois par version de Caramel : une phrase d'échauffement puis une phrase d'essai ; rapport calcul ÷
   parole > 1 ou démarrage > 15 s → appareil « trop lent » pour la voix fluide : moteur libéré, on n'insiste pas avant la
   version suivante (localStorage 'caramel-voix-fluide') ; « Refaire l'essai de vitesse » (parent) : retry(). Page cachée
   ou gelée pendant le démarrage : abandonné sans verdict, repris au retour.
   Phrases : une phrase demandée est calculée phrase par phrase dans une file (urgent : ce qui va être dit ; plus tard :
   ce qui est préparé à l'avance), gardée dans un petit cache (120 s de son) : la voix part sans attendre et 🔊 rejoue
   exactement la même chose. hush() (js/ui/voice.js) vide la file. Lecture : Web Audio, contexte partagé de
   js/core/audio.js, sortie directe (comme les clips), clips et phrases calculées enchaînés sans trou.
   Importable dans Node : aucun accès au navigateur au chargement ; piper-tts.js n'est chargé qu'au besoin.
   API :
     init({ version }) ; onRoute(route) ; onChange(fn) ; status() ; refresh() → Promise<status>
     download({ by: 'parent' | 'auto' }) → Promise<boolean> ; cancelDownload({ byParent }) ; retry() ; remove() ; boot()
     ready() ; micWillStart() ; setMicProbe(fn) ; request(texte, prio) ; prepare(texte) ; cancelQueue()
     play(segments, { clipBuffer }) → Promise<{ ok, reason, heard }> ; stop() ; playing() ; settle()
     pur (testé) : supported, lowMemory, modest, connectionOf, deviceOf, autoDownload, calibrationVerdict,
       needsCalibration, sentencesOf, segmentsOf, routeOf, readState, writeState */
import { planSpeech, fluidText, speakable } from '../content/voice-lines.js';
import { parseUA } from './install.js';
import * as audio from './audio.js';

const G = globalThis;
export const STATE_KEY = 'caramel-voix-fluide';
export const SIZE_LABEL = '≈ 45 Mo';
export const LIMITS = Object.freeze({
  rtf: 1,                    /* calcul ÷ parole au-delà duquel l'appareil est trop lent (voix d'enfant : × 1,33) */
  bootMs: 15000,             /* démarrage au-delà duquel l'appareil est trop lent (étalonnage) */
  bootHangMs: 45000,         /* démarrage abandonné (appareil déjà étalonné) */
  lowMemGb: 4,               /* navigator.deviceMemory ≤ 4 : le micro et la voix fluide ne coexistent jamais */
  modestGb: 2,               /* ≤ 2 Go : pas de téléchargement automatique */
  freeBytes: 150 * 1048576,  /* place libre exigée avant de télécharger */
  firstWaitMs: 2500,         /* 1re phrase pas prête à temps : repli sur une autre voix */
  nextWaitMs: 15000,
  cacheSec: 120,             /* son gardé en mémoire (≈ 10 Mo) */
  laterIdleMs: 1200,         /* « peut-être » (astuce, explication) : calculé seulement 1,2 s après le dernier calcul urgent */
  laterRtf: 0.6,             /* appareil juste assez rapide (rapport > 0,6) : rien de « peut-être », la file reste libre */
  bootDelayMs: 4000          /* démarrage après l'ouverture de l'appli */
});
/* étalonnage : une phrase d'échauffement (la 1re synthèse est 5 à 15 % plus lente), puis la phrase mesurée */
export const CALIBRATION = Object.freeze({ warm: 'Bonjour !', test: '38 + 25 = 63. Le drapeau est 3 petits piquets après 40.' });
const GAME_ROUTES = ['play', 'battle'];
const SILENCE = 0.35;        /* s entre deux phrases (PARAMS.sentence_silence de Piper) */
const LEAD = 0.03;

/* ---------- mémoire de l'appareil (localStorage) ---------- */
let storage = null;          /* tests : faux localStorage */
const ls = () => { if (storage) return storage; try { return G.localStorage || null; } catch (_) { return null; } };
export function readState(st = ls()) {
  try { const v = st && JSON.parse(st.getItem(STATE_KEY) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; }
}
export function writeState(patch, st = ls()) {
  const v = { ...readState(st), ...patch };
  try { if (st) st.setItem(STATE_KEY, JSON.stringify(v)); } catch (_) {}
  return v;
}

/* ---------- politique (pur) ---------- */
/* tout ce qu'il faut pour faire tourner le moteur (features() de piper-tts.js) */
export function supported(f) { return !!(f && f.wasm && f.simd && f.worker && f.moduleWorker && f.cacheStorage); }
/* mémoire faible : ≤ 4 Go annoncés, ou inconnue (Safari, Firefox : prudence) */
export function lowMemory(f) { const m = Number(f && f.deviceMemory); return !(m > LIMITS.lowMemGb); }
export function modest(f) { const m = Number(f && f.deviceMemory); return m > 0 && m <= LIMITS.modestGb; }
/* env : { connection (navigator.connection), onLine } → 'wifi' | 'cellular' | 'save-data' | 'offline' | 'unknown' */
export function connectionOf(env = {}) {
  if (env.onLine === false) return 'offline';
  const c = env.connection;
  if (!c) return 'unknown';
  if (c.saveData) return 'save-data';
  const t = String(c.type || '');
  if (t === 'wifi' || t === 'ethernet') return 'wifi';
  if (t === 'cellular' || t === 'bluetooth' || t === 'wimax') return 'cellular';
  if (t === 'none') return 'offline';
  return 'unknown';
}
/* env : { ua, platform, maxTouchPoints } → 'ios' | 'android' | 'mobile' | 'desktop' */
export function deviceOf(env = {}) {
  const d = parseUA(env.ua || '', { platform: env.platform || '', maxTouchPoints: env.maxTouchPoints || 0 });
  return d.ios ? 'ios' : d.android ? 'android' : d.mobile ? 'mobile' : 'desktop';
}
/* téléchargement automatique ? → { ok, why } (why : la raison, pour le diagnostic et les tests) */
export function autoDownload({ env = {}, features = null, state = {}, cached = false, version = '', inGame = false, afterSession = false } = {}) {
  const no = why => ({ ok: false, why });
  if (!supported(features)) return no('unsupported');
  if (cached) return no('cached');
  if (state.removed) return no('removed');
  if (state.verdict === 'slow' && state.v === version) return no('slow');
  if ((state.launches || 0) < 2) return no('first-launch');
  if (inGame) return no('in-game');
  if (!afterSession) return no('no-session');
  const net = connectionOf(env);
  if (net === 'offline') return no('offline');
  if (net === 'save-data') return no('save-data');
  if (state.want === 'parent') return { ok: true, why: 'parent' };       /* demandé par un parent, interrompu par un jeu */
  if (modest(features)) return no('modest');
  const dev = deviceOf(env);
  if (dev === 'ios') return no('ios');
  if (net === 'wifi') return { ok: true, why: 'wifi' };
  if (net === 'unknown' && dev === 'desktop' && env.connection) return { ok: true, why: 'desktop' };
  return no(net === 'cellular' ? 'cellular' : 'unknown');
}
/* étalonnage → 'ok' | 'slow' */
export function calibrationVerdict({ bootMs = 0, rtf = Infinity } = {}) {
  return bootMs > LIMITS.bootMs || !(rtf <= LIMITS.rtf) ? 'slow' : 'ok';
}
export const needsCalibration = (state = {}, version = '') => !(state.v === version && (state.verdict === 'ok' || state.verdict === 'slow'));

/* ---------- aiguillage (pur) ---------- */
/* phrases d'un texte affiché (texte dit, coupé après . ! ? …) */
export function sentencesOf(text) {
  return speakable(text).replace(/([.!?…])\s+(?=\S)/gu, '$1\u0000').split('\u0000').map(s => s.trim()).filter(Boolean);
}
/* texte → morceaux de la voix fluide : chaque phrase qu'UN clip couvre reste ce clip (instantané, même voix) ; les
   autres sont calculées (texte pour Piper : fluidText). has(id) : le clip existe ; clipsOk : les clips sont jouables */
export function segmentsOf(text, { has = () => false, clipsOk = true } = {}) {
  const out = [];
  for (const s of sentencesOf(text)) {
    let pl = null;
    if (clipsOk) { try { pl = planSpeech(s, { has }); } catch (_) { pl = null; } }
    if (pl && pl.ok && pl.clips.length === 1) out.push({ kind: 'clip', id: pl.clips[0].id, text: s });
    else { const t = fluidText(s); if (t) out.push({ kind: 'piper', text: t }); }
  }
  return out;
}
/* quelle voix ? plan : planSpeech de la phrase (null : clips impossibles) ; named : le plan passe par une phrase à prénom ;
   fluid : la voix fluide est prête ; tts : la voix du téléphone est utilisable ; whole : chaque clip finit une phrase.
   → 'clip' (UN clip, ou des phrases entières, couvrent tout) | 'fluid' | 'tts' | 'clips' (composés, dernier recours) |
   'partial' (phrases couvertes seules) — décision du parent du 04/10/2026. Une phrase à prénom qu'UN clip couvre (sa
   variante sans le prénom) passe à la voix fluide quand elle est prête (le prénom est dit) ; sinon elle reste ce clip :
   même voix que le reste de la visite guidée, sans « saccade », plutôt que la voix du téléphone au milieu des clips */
export function routeOf({ plan = null, named = false, fluid = false, tts = false, whole = false } = {}) {
  if (plan && plan.ok && (plan.clips.length === 1 || whole) && !(named && fluid)) return 'clip';
  if (fluid) return 'fluid';
  if (tts) return 'tts';
  if (plan && plan.ok) return 'clips';
  if (plan && plan.clips.length) return 'partial';
  return 'tts';                          /* dernier essai : la synthèse se rétablit parfois */
}

/* ---------- état ---------- */
let lib = null, libP = null;           /* js/core/piper-tts.js, chargé au besoin */
let feat = null;
let VERSION = '';
let inited = false, inGame = false, afterSession = false;
let engine = null, booting = null, dl = null, bootTimer = 0, autoTimer = 0;
let micHold = false, micUsed = false, micTimer = 0, micProbe = () => false;
let ctxOf = () => audio.context();     /* tests : faux contexte */
let navOf = () => G.navigator || {};
let S = { state: 'unknown', progress: null, error: '', why: '' };
const listeners = new Set();

function loadLib() {
  if (lib) return Promise.resolve(lib);
  if (!libP) libP = import('./piper-tts.js').then(m => (lib = m), () => { libP = null; return null; });
  return libP;
}
function set(patch) {
  S = { ...S, ...patch };
  for (const fn of listeners) { try { fn(status()); } catch (_) {} }
}
export function onChange(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const envNow = () => {
  const n = navOf();
  return { ua: n.userAgent || '', platform: n.platform || '', maxTouchPoints: n.maxTouchPoints || 0, connection: n.connection || null, onLine: n.onLine };
};
const debugMain = () => { try { return new URLSearchParams(G.location.search).get('piper') === 'main'; } catch (_) { return false; } };
const visible = () => { try { return !G.document || G.document.visibilityState !== 'hidden'; } catch (_) { return true; } };
const ortChoice = () => {
  if (!lib) return null;
  const s = readState();
  return s.ortFailed === lib.ORT_VERSION ? lib.ORT_LEGACY : lib.ortFor(feat);
};
const isLowMem = () => lowMemory(feat || {});
/* mémoire faible, le micro a servi (Vosk reste chargé) : pas de moteur avant la prochaine ouverture */
const parked = () => micUsed && isLowMem();
const idle = (fn, ms) => {
  const t = setTimeout(() => {
    try { if (typeof G.requestIdleCallback === 'function') { G.requestIdleCallback(fn, { timeout: 3000 }); return; } } catch (_) {}
    fn();
  }, ms);
  try { if (t && t.unref) t.unref(); } catch (_) {}
  return t;
};

export function status() {
  const s = readState();
  const mine = s.v === VERSION;
  return {
    state: S.state, progress: S.progress, error: S.error, why: S.why,
    verdict: mine ? s.verdict || null : null, rtf: mine && Number.isFinite(s.rtf) ? s.rtf : null,
    bootMs: mine && Number.isFinite(s.bootMs) ? s.bootMs : null, ort: s.ort || null,
    removed: !!s.removed, want: s.want || null, lowMem: feat ? isLowMem() : null,
    net: connectionOf(envNow()), device: deviceOf(envNow()), held: micHold, parked: parked()
  };
}
export function ready() { return S.state === 'ready' && !!engine && engine.alive !== false; }

/* état réel de l'appareil (fichiers en cache ?) ; ne dérange rien de ce qui est en cours */
export async function refresh() {
  if (['downloading', 'starting', 'calibrating', 'ready'].includes(S.state)) return status();
  const P = await loadLib();
  if (!P) { set({ state: 'unsupported' }); return status(); }
  if (!feat) { try { feat = P.features(); } catch (_) { feat = {}; } }
  if (!supported(feat)) { set({ state: 'unsupported' }); return status(); }
  let miss = [], files = [];
  try { files = P.filesFor({ ort: ortChoice() }); miss = await P.missingFiles(files); } catch (_) { miss = files; }
  const s = readState();
  /* ménage hors téléchargement : fichiers d'une autre version, du banc d'essai */
  if (!dl && files.length) Promise.resolve(files).then(P.prune).catch(() => {});
  if (!miss.length) set({ state: s.v === VERSION && s.verdict === 'slow' ? 'slow' : S.state === 'error' ? 'error' : 'cached', progress: null });
  /* « interrompu » : seulement un téléchargement commencé ici (pas des fichiers laissés par le banc d'essai) */
  else set({ state: miss.length < files.length && (s.want || s.started) && !s.removed ? 'paused' : 'absent', progress: null });
  return status();
}

/* au démarrage de l'appli (js/main.js) */
export function init({ version = '' } = {}) {
  if (inited) return;
  inited = true;
  VERSION = version || (() => { try { return G.document.querySelector('meta[name="caramel-version"]').content || ''; } catch (_) { return ''; } })();
  const s = readState();
  writeState({ launches: (s.launches || 0) + 1 });
  refresh().then(() => { if (S.state === 'cached') scheduleBoot(LIMITS.bootDelayMs); }).catch(() => {});
  const wake = () => { if (visible() && S.state === 'cached' && !engine && !booting) scheduleBoot(LIMITS.bootDelayMs); };
  try { for (const t of ['visibilitychange', 'resume']) G.document.addEventListener(t, wake); } catch (_) {}
}

/* changement d'écran (js/main.js, routeur) : un jeu commence → aucun téléchargement ; on revient d'un jeu → après une
   séance : téléchargement automatique s'il est permis, démarrage du moteur s'il attendait la fin du jeu */
export function onRoute(route) {
  const name = route && route.name;
  const was = inGame;
  inGame = GAME_ROUTES.includes(name);
  if (inGame) { clearTimeout(autoTimer); if (dl) cancelDownload(); return; }
  if (was) {
    afterSession = true;
    clearTimeout(autoTimer);
    autoTimer = idle(maybeAuto, 3000);
    if (S.state === 'cached' && !micHold && !parked()) scheduleBoot(2500);
  }
}
async function maybeAuto() {
  if (inGame || dl || !visible()) return;
  const st = await refresh();
  if (st.state !== 'absent' && st.state !== 'paused') return;
  const r = autoDownload({ env: envNow(), features: feat, state: readState(), cached: false, version: VERSION, inGame, afterSession });
  set({ why: r.why });
  if (r.ok) download({ by: 'auto' });
}

/* ---------- téléchargement ---------- */
async function freeSpace() {
  try {
    const sto = navOf().storage;
    if (!sto || typeof sto.estimate !== 'function') return Infinity;
    const e = await sto.estimate();
    return Number(e.quota) - Number(e.usage);
  } catch (_) { return Infinity; }
}
export function download({ by = 'parent' } = {}) {
  if (dl) return dl.promise;
  if (ready()) return Promise.resolve(true);
  if (by === 'parent') writeState({ want: 'parent', removed: false });
  const my = dl = { ctrl: typeof G.AbortController === 'function' ? new G.AbortController() : null, by };
  my.promise = (async () => {
    const P = await loadLib();
    if (!P) { set({ state: 'unsupported' }); return false; }
    if (!feat) { try { feat = P.features(); } catch (_) { feat = {}; } }
    if (!supported(feat)) { set({ state: 'unsupported' }); return false; }
    if (inGame) { set({ state: 'paused' }); return false; }
    if (connectionOf(envNow()) === 'offline') { set({ state: 'error', error: 'offline' }); return false; }
    const files = P.filesFor({ ort: ortChoice() });
    const miss = await P.missingFiles(files);
    const need = miss.reduce((s, f) => s + (f.cachedBytes || f.bytes || 0), 0);
    if (need && (await freeSpace()) < need + LIMITS.freeBytes) { set({ state: 'error', error: 'space' }); return false; }
    writeState({ started: true });
    set({ state: 'downloading', progress: { loaded: 0, total: 1 }, error: '' });
    /* progression : au plus 4 fois par seconde (chaque bloc reçu n'a pas à redessiner l'espace parents) */
    let last = 0;
    const onProgress = p => {
      const t = tnow();
      if (dl !== my || (t - last < 250 && p.loaded < p.total)) return;
      last = t;
      set({ progress: { loaded: p.loaded, total: p.total } });
    };
    try {
      const r = await P.ensureFiles(files, { signal: my.ctrl && my.ctrl.signal, onProgress });
      if (Object.keys(r.buffers || {}).length) { set({ state: 'error', error: 'storage', progress: null }); return false; }
      try { await P.prune(files); } catch (_) {}
      /* fini : want ne sert qu'à reprendre un téléchargement du parent interrompu par un jeu ; un retéléchargement
         (nouveau modèle, cache effacé) suit les règles ordinaires (Wi-Fi, ou les parents) */
      writeState({ want: null, started: null });
      set({ state: 'cached', progress: null, error: '' });
      scheduleBoot(800);
      return true;
    } catch (e) {
      const aborted = (e && (e.name === 'AbortError' || e.code === 'aborted')) || (my.ctrl && my.ctrl.signal.aborted);
      set({ state: aborted ? 'paused' : 'error', error: aborted ? '' : (connectionOf(envNow()) === 'offline' ? 'offline' : 'network'), progress: null });
      return false;
    } finally { if (dl === my) dl = null; }
  })();
  return my.promise;
}
/* « Réessayer » (parent) : après une panne de démarrage, un nouvel essai ; sinon le téléchargement. « Refaire l'essai de
   vitesse » (trop lente) : verdict oublié, nouvel étalonnage sans retélécharger */
export async function retry() {
  if (S.state === 'error') set({ state: 'unknown', error: '' });
  if (S.state === 'slow') writeState({ v: null, verdict: null });
  const st = await refresh();
  if (st.state === 'cached') { clearTimeout(bootTimer); return boot(); }
  if (st.state === 'absent' || st.state === 'paused') return download({ by: 'parent' });
  return false;
}
/* « Arrêter le téléchargement » (parent : byParent) : pas de reprise d'office après la séance ; un jeu (onRoute) la garde */
export function cancelDownload({ byParent = false } = {}) {
  if (byParent) writeState({ want: null });
  const d = dl;
  if (d && d.ctrl) { try { d.ctrl.abort(); } catch (_) {} }
}
/* « Supprimer » (parent) : rend la place ; plus de téléchargement automatique sur cet appareil ; verdict oublié (un
   nouveau téléchargement refait l'essai de vitesse) */
export async function remove() {
  cancelDownload();
  abortBoot();
  release();
  const P = await loadLib();
  if (P) { try { await P.clearCache(); } catch (_) {} }
  writeState({ removed: true, want: null, started: null, v: null, verdict: null, rtf: null, bootMs: null });
  set({ state: 'absent', progress: null, error: '' });
}

/* ---------- démarrage et étalonnage ---------- */
function scheduleBoot(ms) {
  clearTimeout(bootTimer);
  bootTimer = idle(() => { boot().catch(() => {}); }, ms);
}
function abortBoot() {
  clearTimeout(bootTimer);
  const b = booting;
  if (!b) return;
  booting = null;
  b.aborted = true;
  if (b.ctrl) { try { b.ctrl.abort(); } catch (_) {} }
  if (b.piper) { try { b.piper.dispose(); } catch (_) {} }
}
function release() {
  stop();
  cancelQueue();
  const e = engine;
  engine = null;
  if (e) { try { e.dispose(); } catch (_) {} }
}
export async function boot() {
  if (engine || booting || S.state !== 'cached' || micHold || parked() || !visible()) return false;
  const my = booting = { aborted: false, ctrl: typeof G.AbortController === 'function' ? new G.AbortController() : null, piper: null };
  const P = await loadLib();
  if (!P || my.aborted || !visible()) { if (booting === my) booting = null; return false; }
  const s = readState();
  const calib = needsCalibration(s, VERSION);
  if (!calib && s.verdict === 'slow') { booting = null; set({ state: 'slow' }); return false; }
  const ort = ortChoice();
  /* page cachée ou gelée (écran verrouillé, autre appli) : abandon sans verdict, le délai et le rapport compteraient la
     veille ; repris au retour (init) */
  const hide = e => { if (booting === my && (e.type === 'freeze' || !visible())) { abortBoot(); set({ state: 'cached' }); } };
  const ears = k => { try { for (const t of ['visibilitychange', 'freeze']) G.document[k + 'EventListener'](t, hide); } catch (_) {} };
  ears('add');
  set({ state: 'starting', error: '' });
  try {
    const p = my.piper = await P.loadPiper({ mode: debugMain() ? 'main' : 'worker', ort, download: false, signal: my.ctrl && my.ctrl.signal,
      bootTimeoutMs: calib ? LIMITS.bootMs : LIMITS.bootHangMs });
    if (my.aborted) { try { p.dispose(); } catch (_) {} return false; }
    if (calib) {
      set({ state: 'calibrating' });
      await p.synth(fluidText(CALIBRATION.warm));
      const r = await p.synth(fluidText(CALIBRATION.test));
      if (my.aborted) { try { p.dispose(); } catch (_) {} return false; }
      const verdict = calibrationVerdict({ bootMs: p.info.bootMs, rtf: r.rtf });
      writeState({ v: VERSION, verdict, rtf: Math.round(r.rtf * 100) / 100, bootMs: p.info.bootMs, ort, at: Date.now() });
      if (verdict === 'slow') { try { p.dispose(); } catch (_) {} set({ state: 'slow' }); return false; }
    }
    engine = p;
    set({ state: 'ready' });
    return true;
  } catch (e) {
    if (my.aborted) return false;
    const code = e && e.code;
    if (code === 'boot-timeout' && calib) {
      writeState({ v: VERSION, verdict: 'slow', rtf: null, bootMs: LIMITS.bootMs + 1, ort, at: Date.now() });
      set({ state: 'slow' });
    } else if (code === 'absent') {
      set({ state: 'absent' });
      refresh().catch(() => {});
    } else {
      if (ort === P.ORT_VERSION && code !== 'boot-timeout') writeState({ ortFailed: P.ORT_VERSION, started: true });
      set({ state: 'error', error: 'boot' });
    }
    return false;
  } finally { ears('remove'); if (booting === my) booting = null; }
}

/* ---------- micro ---------- */
/* js/ui/voice.js : le micro écoute-t-il ? (js/core/speech.js n'est que lu) */
export function setMicProbe(fn) { micProbe = typeof fn === 'function' ? fn : () => false; }
/* le micro va démarrer (js/ui/game-ctx.js) : aucun démarrage du moteur en même temps ; mémoire faible : moteur libéré */
export function micWillStart() {
  micHold = micUsed = true;
  if (booting) { abortBoot(); set({ state: 'cached' }); }
  else if (engine && isLowMem()) { release(); set({ state: 'cached' }); }
  clearTimeout(bootTimer);
  clearInterval(micTimer);
  let seen = false, quiet = 0;
  micTimer = setInterval(() => {
    let on = false;
    try { on = !!micProbe(); } catch (_) {}
    if (on) { seen = true; quiet = 0; return; }
    quiet++;
    /* le micro s'est tu depuis 3 s (ou n'a jamais démarré en 20 s) */
    if ((seen && quiet >= 3) || quiet >= 20) {
      clearInterval(micTimer); micTimer = 0; micHold = false;
      /* mémoire faible : le moteur attend la prochaine ouverture (parked) */
      if (S.state === 'cached' && !parked()) scheduleBoot(3000);
    }
  }, 1000);
  try { if (micTimer.unref) micTimer.unref(); } catch (_) {}
}

/* ---------- phrases calculées : file et cache ---------- */
/* priorités de la file : NOW (va être dit), NEXT (la question suivante, le bilan : dans moins d'une seconde), LATER
   (astuce, explication : peut-être). Un calcul en cours ne s'interrompt pas (une phrase longue de CM2 : 1 à 3 s sur un
   PC) : un LATER ne démarre qu'une fois la file calme depuis 1,2 s (l'enfant réfléchit ; une réponse rapide trouve le
   moteur libre pour la question suivante) et jamais sur un appareil juste assez rapide. Découper les phrases aux
   virgules aurait raccourci ces calculs, mais chaque morceau repart sur une intonation neuve (sauts de hauteur
   mesurés) : c'est ce que le parent reproche aux clips — écarté. */
export const NOW = 0, NEXT = 1, LATER = 2;
const items = new Map();              /* texte → { text, prio, seq, promise, done, pcm, rate, a, b, dur } (ordre d'usage) */
const queue = [];
let inflight = null, n = 0, keptSec = 0, made = 0, lastUrgent = 0, laterTimer = 0;
const cancelled = () => Object.assign(new Error('annulé'), { code: 'cancelled' });
/* bornes de la voix (comme les clips : 6 ms avant, 12 ms après) */
function bounds(pcm, rate) {
  const thr = 0.004;
  let a = 0, b = pcm.length - 1;
  while (a < pcm.length && Math.abs(pcm[a]) < thr) a++;
  while (b > a && Math.abs(pcm[b]) < thr) b--;
  if (a >= pcm.length) return { a: 0, b: 0 };
  return { a: Math.max(0, a - Math.round(0.006 * rate)) / rate, b: Math.min(pcm.length, b + 1 + Math.round(0.012 * rate)) / rate };
}
function joinPcm(sentences) {
  const rate = sentences[0].sampleRate, gap = Math.round(SILENCE * rate);
  const out = new Float32Array(sentences.reduce((k, s) => k + s.pcm.length, 0) + gap * (sentences.length - 1));
  let o = 0;
  sentences.forEach((s, i) => { out.set(s.pcm, o); o += s.pcm.length + (i < sentences.length - 1 ? gap : 0); });
  return out;
}
function trim() {
  for (const [k, it] of items) {
    if (keptSec <= LIMITS.cacheSec) break;
    if (!it.done) continue;
    items.delete(k);
    keptSec -= it.dur || 0;
  }
}
/* crochet de test (comme js/ui/voice.js) : __caramelDebug.fluid = [{ text, prio, asked, start, done, ms }] (temps de la page) */
const dbg = () => { try { const d = G.__caramelDebug; return d && typeof d === 'object' ? (d.fluid || (d.fluid = [])) : null; } catch (_) { return null; } };
const tnow = () => { try { return Math.round(G.performance.now()); } catch (_) { return Date.now(); } };
function pump() {
  if (inflight || !engine || !queue.length) return;
  queue.sort((x, y) => x.prio - y.prio || x.seq - y.seq);
  if (queue[0].prio === LATER) {
    const wait = lastUrgent + LIMITS.laterIdleMs - tnow();
    if (wait > 0) { clearTimeout(laterTimer); laterTimer = setTimeout(pump, wait + 5); return; }
  }
  const it = inflight = queue.shift();
  const p = engine;
  it.start = tnow();
  Promise.resolve().then(() => p.synth(it.text)).then(r => {
    if (!r.sentences.length) throw new Error('rien à dire');
    it.pcm = joinPcm(r.sentences);
    it.rate = r.sentences[0].sampleRate;
    Object.assign(it, bounds(it.pcm, it.rate));
    it.dur = it.pcm.length / it.rate;
    it.ms = r.synthMs;
    it.done = true;
    made++;
    const d = dbg();
    if (d) { d.push({ text: it.text, prio: it.prio, asked: it.asked, start: it.start, done: tnow(), ms: r.synthMs, sec: Math.round(it.dur * 100) / 100 }); if (d.length > 80) d.shift(); }
    keptSec += it.dur;
    trim();
    it.resolve(it);
  }, e => { if (items.get(it.text) === it) items.delete(it.text); it.reject(e); })
    .then(() => { if (inflight === it) inflight = null; if (it.prio !== LATER) lastUrgent = tnow(); pump(); });
}
/* texte pour Piper (fluidText) → Promise<morceau calculé> ; NOW : va être dit ; LATER : préparé à l'avance */
export function request(text, prio = NOW) {
  let it = items.get(text);
  if (it) {
    items.delete(text); items.set(text, it);              /* le plus récent en dernier */
    if (!it.done && prio < it.prio) it.prio = prio;
    if (prio !== LATER) lastUrgent = tnow();
    pump();
    return it.promise;
  }
  if (!engine) return Promise.reject(Object.assign(new Error('voix fluide pas prête'), { code: 'fluid' }));
  it = { text, prio, seq: ++n, done: false, asked: tnow() };
  it.promise = new Promise((res, rej) => { it.resolve = res; it.reject = rej; });
  it.promise.catch(() => {});
  items.set(text, it);
  queue.push(it);
  if (prio !== LATER) lastUrgent = tnow();
  pump();
  return it.promise;
}
export function prepare(text, prio = LATER) {
  if (!ready() || !text) return;
  if (prio !== NEXT) {
    const s = readState();
    if (Number(s.rtf) > LIMITS.laterRtf) return;
  }
  request(text, prio === NEXT ? NEXT : LATER);
}
/* vide la file (hush, changement d'écran) ; keepLater : garde ce qui est préparé à l'avance */
export function cancelQueue({ keepLater = false } = {}) {
  for (let i = queue.length - 1; i >= 0; i--) {
    const it = queue[i];
    if (keepLater && it.prio !== NOW) continue;
    queue.splice(i, 1);
    if (items.get(it.text) === it) items.delete(it.text);
    it.reject(cancelled());
  }
}
/* diagnostic et tests : ce qui est prêt, en attente */
export function queueInfo() {
  return { queued: queue.map(it => ({ text: it.text, prio: it.prio })), inflight: inflight ? inflight.text : null,
    ready: [...items.values()].filter(it => it.done).map(it => it.text), keptSec: Math.round(keptSec * 10) / 10, made };
}

/* ---------- lecture ---------- */
let job = null;
const settleFns = new Set();
const R = (ok, reason = '', heard = ok) => ({ ok, reason, heard: !!heard });
function within(p, ms) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(Object.assign(new Error('pas prête à temps'), { code: 'late' })), ms);
    p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); });
  });
}
function resumeCtx(ac) {
  if (ac.state === 'running') return Promise.resolve(true);
  return new Promise(res => {
    let done = false;
    const fin = () => { if (!done) { done = true; res(ac.state === 'running'); } };
    try { const p = audio.unlock(); if (p && typeof p.then === 'function') p.then(fin, fin); } catch (_) {}
    try { const p = ac.resume && ac.resume(); if (p && typeof p.then === 'function') p.then(fin, fin); } catch (_) {}
    setTimeout(fin, 400);
  });
}
function bufferOf(ac, it) {
  if (it.buf) return it.buf;
  const b = ac.createBuffer(1, it.pcm.length, it.rate);
  b.getChannelData(0).set(it.pcm);
  it.buf = b;
  return b;
}
function stopSources(j) {
  for (const s of j.srcs) {
    try { s.onended = null; } catch (_) {}
    try { s.stop(); } catch (_) {}
    try { s.disconnect(); } catch (_) {}
  }
  j.srcs = [];
}
const heardOf = j => { try { return !!(j.ac && j.srcs.length && j.ac.currentTime > j.t0 + 0.05); } catch (_) { return false; } };
/* segments (segmentsOf) → lecture enchaînée ; clipBuffer(id) → Promise<{ buf, a, b }> (js/core/voice-clips.js).
   → Promise<{ ok, reason, heard }> ; reason : '' | 'cancelled' | 'late' (1re phrase pas prête à temps) | 'fluid' (moteur
   en panne) | 'no-audio' | 'not-allowed' */
export function play(segments, { clipBuffer = null } = {}) {
  stop();
  const list = Array.isArray(segments) ? segments.filter(Boolean) : [];
  const my = job = { cancelled: false, srcs: [], t0: 0, ac: null, done: false, timer: 0, finish: null };
  return new Promise(resolve => {
    my.finish = r => {
      if (my.done) return;
      my.done = true;
      clearTimeout(my.timer);
      if (job === my) job = null;
      resolve(r);
      if (!job) { for (const fn of settleFns) { try { fn(); } catch (_) {} } settleFns.clear(); }
    };
    (async () => {
      if (!list.length) { my.finish(R(false, 'fluid')); return; }
      const ac = ctxOf();
      if (!ac) { my.finish(R(false, 'no-audio')); return; }
      my.ac = ac;
      /* tout est demandé d'un coup, TOUT DE SUITE (avant ce que l'appelant prépare ensuite) : la file calcule dans l'ordre
         pendant que le début joue */
      const calc = txt => request(txt, NOW).then(it => ({ buf: bufferOf(ac, it), a: it.a, b: it.b }));
      /* un clip introuvable (hors ligne, jamais entendu) : sa phrase est calculée */
      const parts = list.map(sg => (sg.kind === 'clip'
        ? Promise.resolve().then(() => clipBuffer(sg.id)).catch(() => calc(fluidText(sg.text)))
        : calc(sg.text)));
      parts.forEach(p => p.catch(() => {}));
      if (!await resumeCtx(ac)) { my.finish(R(false, 'not-allowed')); return; }
      if (my.cancelled) return;
      let t = 0;
      for (let i = 0; i < parts.length; i++) {
        let p;
        try { p = await within(parts[i], i === 0 ? LIMITS.firstWaitMs : LIMITS.nextWaitMs); }
        catch (e) {
          if (my.cancelled) return;
          if (!my.srcs.length) { my.finish(R(false, e && e.code === 'late' ? 'late' : 'fluid')); return; }
          break;                                  /* la suite manque : on s'arrête après ce qui est programmé */
        }
        if (my.cancelled) return;
        const now = ac.currentTime;
        const start = !my.srcs.length ? now + LEAD : Math.max(t + SILENCE, now + LEAD);
        const len = Math.max(0.01, p.b - p.a);
        try {
          const s = ac.createBufferSource();
          s.buffer = p.buf;
          s.connect(ac.destination);
          s.start(start, p.a, len);
          if (!my.srcs.length) my.t0 = start;
          my.srcs.push(s);
        } catch (_) { if (!my.srcs.length) { my.finish(R(false, 'no-audio')); return; } break; }
        t = start + len;
      }
      const last = my.srcs[my.srcs.length - 1];
      last.onended = () => my.finish(R(true));
      /* filet : « ended » perdu (contexte suspendu par le système…) */
      my.timer = setTimeout(() => my.finish(R(true)), Math.max(0, (t - ac.currentTime) * 1000) + 800);
    })().catch(() => my.finish(R(false, 'fluid')));
  });
}
export function stop() {
  const j = job;
  if (!j) return;
  job = null;
  j.cancelled = true;
  const heard = heardOf(j);
  stopSources(j);
  if (j.finish) j.finish(R(false, 'cancelled', heard));
}
export function playing() { return !!job; }
export function settle() {
  if (!job) return Promise.resolve();
  return new Promise(res => settleFns.add(res));
}

/* ---------- tests ---------- */
/* { storage, nav, context, lib, features, version, engine, micUsed } ; null : tout remettre à zéro */
export function _setEnv(e) {
  stop(); cancelQueue();
  items.clear(); queue.length = 0; inflight = null; keptSec = 0; made = 0; lastUrgent = 0; clearTimeout(laterTimer);
  clearTimeout(bootTimer); clearTimeout(autoTimer); clearInterval(micTimer);
  engine = null; booting = null; dl = null; micHold = false; inGame = false; afterSession = false; inited = false;
  S = { state: 'unknown', progress: null, error: '', why: '' };
  const x = e || {};
  micUsed = !!x.micUsed;
  storage = x.storage || null;
  navOf = x.nav ? () => x.nav : () => G.navigator || {};
  ctxOf = x.context ? () => x.context : () => audio.context();
  lib = x.lib || null; libP = null;
  feat = x.features || null;
  VERSION = x.version || '';
  if (x.engine) { engine = x.engine; S.state = 'ready'; }
}
