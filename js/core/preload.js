/* ============ PRÉCHARGEMENT : VOIX ET MICRO DÈS LA PREMIÈRE OUVERTURE (v2.2.3, demande du parent du 06/10/2026) ============
   « Pendant les exercices, la première fois, on est invité à cliquer pour charger les modèles de voix etc. Il faudrait
   que tous les chargements se fassent à la première ouverture, quitte à avoir une barre de chargement le temps qu'on
   configure son profil. »
   Ce module lance en arrière-plan, une fois pour toutes, ce qui se télécharge :
     - le moteur du micro (Vosk : bibliothèque ≈ 5,8 Mo + modèle ≈ 46 Mo, puis extraction : speech.prefetch) — d'abord,
       car les jeux au micro l'attendent ;
     - la voix fluide (≈ 45 Mo : voice-fluid.download) — dès que le modèle du micro est arrivé (tout de suite s'il était
       déjà là) : elle descend pendant l'extraction. L'extraction, calcul lourd, retient le démarrage de la voix fluide
       (fluid.holdBoot : son essai de vitesse serait faussé, l'appareil jugé « trop lent » à tort).
   Qui l'appelle : la création du profil (js/ui/onboarding.js) et l'accueil (js/ui/home.js : appareils déjà configurés,
   mise à jour de l'appli) ; start() ne fait rien quand tout est prêt. La barre commune : js/ui/preload.js. Rien ne
   l'attend : la configuration du profil continue pendant le téléchargement.
   Règles :
     - Wi-Fi, câble, connexion inconnue (iPhone, iPad, ordinateur) : tout part tout seul ;
     - données mobiles ou économie de données : rien ne part tout seul ; la barre propose à l'adulte « Télécharger
       maintenant (≈ 93 Mo) » (taille de ce qui manque vraiment) → start({ by: 'parent' }) ; son accord est gardé
       (localStorage STATE_KEY) jusqu'à la fin, même si l'appli est fermée entre-temps. Ce qui ne télécharge rien
       (extraction d'un modèle déjà en cache) part tout seul ;
     - hors ligne : rien ; nouvel essai au retour du réseau ('online', changement de navigator.connection) ;
     - voix fluide : ses exclusions (non supportée, appareil modeste, trop lente pour cette version, « Supprimer ») et sa
       règle des jeux (un jeu interrompt son téléchargement, il reprend après la séance) sont dans js/core/voice-fluid.js
       (autoCheck) ;
     - un jeu qui démarre pendant le préchargement ne casse rien : ensureVosk attend le préchargement en cours, et
       js/ui/game-ctx.js donne au jeu, en attendant, le pourcentage du modèle (followVosk).
   Journal de diagnostic (js/core/debuglog.js) : catégorie « préchargement ».
   Importable dans Node : aucun accès au navigateur au chargement.
   API : start({ by: 'auto' | 'parent' }) → Promise<status> ; status() → { state, pct, parts, bytes } ; onChange(fn) ;
     followVosk(fn) → désabonnement ; micReady() ;
     pur (testé) : BYTES, sizeOf, planOf, pctOf, readState, writeState ; _setEnv (tests)
   state : 'idle' (pas encore lancé) | 'checking' | 'none' (rien à faire) | 'running' | 'ask' (l'adulte décide) |
     'wait' (hors ligne) | 'done' (tout est arrivé pendant cette ouverture) ; parts : { vosk, fluid } (dans la barre) ;
     pct : 0-99 (100 : fini), null quand rien ne se compte (extraction seule) ; bytes : ce que « Télécharger
     maintenant » ferait venir. */
import * as speechMod from './speech.js';
import * as fluidMod from './voice-fluid.js';
import { dlog } from './debuglog.js';

const G = globalThis;
export const STATE_KEY = 'caramel-prechargement';
/* octets annoncés (Mo décimaux, comme les libellés) : bibliothèque vosk-browser, modèle du micro (models/fr.tar.gz),
   voix fluide (fluid.SIZE_LABEL) ; tout : ≈ 93 Mo */
export const BYTES = Object.freeze({ voskLib: 5.8e6, voskModel: 42.2e6, fluid: 45e6 });   /* 2.2.4 : modèle fr-small-0.22 */
const MODEL_CACHE = 'vosk-model-v1', LIB_CACHE = 'vosk-lib-v1';      /* caches de js/core/speech.js (KEEP de sw.js) */
const NET_MS = 1200;                                                  /* changements de connexion regroupés */

/* ---------- mémoire de l'appareil : accord de l'adulte (données mobiles) ---------- */
let storage = null;                                                   /* tests : faux localStorage */
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
/* « ≈ 93 Mo » (espaces insécables : jamais coupé en fin de ligne) */
export const sizeOf = bytes => '≈\u00a0' + Math.max(1, Math.round((Number(bytes) || 0) / 1e6)) + '\u00a0Mo';
/* que faire de chaque part ? net : connectionOf ; vosk : null (rien à faire) | { bytes } (à télécharger ; 0 : extraction
   seule) ; fluid : null (rien à faire) | { ok, why } (fluid.autoCheck) ; consent : un adulte a dit oui.
   → { vosk, fluid : 'run' | 'ask' | 'wait' | null, mode : 'run' | 'ask' | 'wait' | 'none', bytes (si l'adulte dit oui) } */
export function planOf({ net = 'unknown', vosk = null, fluid = null, consent = false } = {}) {
  const metered = net === 'cellular' || net === 'save-data';
  const v = !vosk ? null
    : !(vosk.bytes > 0) ? 'run'                                         /* rien ne transite : l'extraction seule */
      : net === 'offline' ? 'wait'
        : metered && !consent ? 'ask' : 'run';
  const f = !fluid ? null
    : fluid.ok || fluid.why === 'in-game' ? 'run'                     /* jeu en cours : elle reprendra après la séance */
      : fluid.why === 'offline' ? 'wait'
        : fluid.why === 'cellular' || fluid.why === 'save-data' ? (consent ? 'run' : 'ask')
          : null;                                                       /* non supportée, modeste, trop lente, supprimée… */
  const steps = [v, f];
  const mode = steps.includes('run') ? 'run' : steps.includes('ask') ? 'ask' : steps.includes('wait') ? 'wait' : 'none';
  const bytes = (v === 'ask' ? vosk.bytes : 0) + (f === 'ask' ? BYTES.fluid : 0);
  return { vosk: v, fluid: f, mode, bytes };
}
/* avancée commune : parts = [{ expect, got }] (octets) → 0-100 (arrondi par défaut), null si rien ne se compte */
export function pctOf(parts = []) {
  let e = 0, g = 0;
  for (const p of parts) {
    const x = Math.max(0, Number(p && p.expect) || 0);
    e += x;
    g += Math.min(x, Math.max(0, Number(p && p.got) || 0));
  }
  return e > 0 ? Math.floor(100 * g / e) : null;
}

/* ---------- état ---------- */
let D = { speech: speechMod, fluid: fluidMod };
let navOf = () => G.navigator || {};
let winOf = () => G;
let cachesOf = () => { try { return G.caches || null; } catch (_) { return null; } };
let S = { state: 'idle', pct: null, parts: { vosk: false, fluid: false }, bytes: 0 };
const listeners = new Set(), pctFns = new Set();
let bound = false, checking = null, again = false, netTimer = 0, checked = false, offFluid = null;
let consent = null;                     /* accord de l'adulte (lu au premier start) */
let micOk = false, micSkip = false, voskFailed = false, fluidFailed = false;
let vjob = null;                        /* préchargement du micro en cours : { lib, model, pct, held, kicked, promise } */
let fjob = false;                       /* téléchargement de la voix fluide lancé ici, pas encore fini */
let fst = null;                         /* dernier état de la voix fluide (fluid.status) */
let plan = { vosk: null, fluid: null, mode: 'none', bytes: 0 }, fluidBy = 'auto', fluidWhy = '';
let run = null;                         /* ce qui se télécharge pendant cette ouverture : { vosk, fluid, top, over } */

const envNow = () => { const n = navOf(); return { connection: n.connection || null, onLine: n.onLine }; };
const netNow = () => { try { return D.fluid.connectionOf(envNow()); } catch (_) { return 'unknown'; } };
const log = (msg, data) => { try { dlog('préchargement', msg, data); } catch (_) {} };
/* le micro intégré peut-il servir ici ? (WebAssembly + micro) : sinon, rien à télécharger pour lui */
function micPossible() {
  try {
    const md = navOf().mediaDevices;
    return typeof G.WebAssembly === 'object' && !!(md && typeof md.getUserMedia === 'function');
  } catch (_) { return false; }
}
/* ce qui manque pour le micro (octets) : modèle et bibliothèque déjà en cache ? */
async function voskNeed() {
  const has = async (name, key) => {
    try { const c = cachesOf(); if (!c) return false; return !!(await (await c.open(name)).match(key)); } catch (_) { return false; }
  };
  const model = (await has(MODEL_CACHE, D.speech.MODEL_URL)) ? 0 : BYTES.voskModel;
  const lib = (await has(LIB_CACHE, D.speech.VOSK_LIB)) ? 0 : BYTES.voskLib;
  return { model, lib, bytes: model + lib };
}

export function status() { return { ...S, parts: { ...S.parts } }; }
export function onChange(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}
/* le modèle du micro est-il extrait sur cet appareil ? (vérifié pendant cette ouverture) */
export function micReady() { return micOk; }
/* pourcentage du modèle du micro pendant le préchargement (0-99), pour un jeu qui attend le micro (js/ui/game-ctx.js) :
   fn reçoit l'avancée actuelle puis chaque changement, jusqu'à la fin du préchargement → désabonnement */
export function followVosk(fn) {
  if (typeof fn !== 'function' || !vjob) return () => {};
  pctFns.add(fn);
  if (vjob.pct !== null) { try { fn(vjob.pct); } catch (_) {} }
  return () => pctFns.delete(fn);
}

/* ---------- état dérivé ---------- */
const READY = ['cached', 'starting', 'calibrating', 'ready'];
function voskStep() {
  if (vjob) return 'run';
  if (micOk || micSkip || voskFailed) return null;
  return plan.vosk;
}
function fluidStep() {
  const s = fst && fst.state;
  if (s === 'downloading') return 'run';
  if (fluidFailed || !(s === 'absent' || s === 'paused')) return null;
  return plan.fluid;                    /* 'run' : en attente du modèle du micro, ou interrompu par un jeu */
}
function ensureRun() {
  if (!run || run.over) run = { vosk: null, fluid: null, top: 0, over: false };
  return run;
}
function pctNow(done) {
  if (!run) return null;
  const parts = [];
  if (run.vosk) {
    const v = run.vosk, all = v.lib + v.model;
    parts.push({ expect: all, got: v.done ? all : v.pct === null ? 0 : v.lib + v.model * v.pct / 100 });
  }
  if (run.fluid) parts.push({ expect: BYTES.fluid, got: BYTES.fluid * (run.fluid.done ? 1 : run.fluid.frac) });
  const p = pctOf(parts);
  if (p === null) return null;
  if (done) return 100;
  run.top = Math.max(run.top, Math.min(99, p));                       /* jamais en arrière */
  return run.top;
}
function emit() {
  const v = voskStep(), f = fluidStep(), steps = [v, f];
  let state;
  if (steps.includes('run')) state = 'running';
  else if (steps.includes('ask')) state = 'ask';
  else if (steps.includes('wait')) state = 'wait';
  else if (checking && !checked) state = 'checking';
  else state = run ? 'done' : 'none';
  if (state === 'done' && !run.over) {
    run.over = true;
    if (consent) { consent = false; writeState({ consent: null }); }
    log('fini', { micro: !!run.vosk, voix: !!run.fluid });
  }
  if (state === 'none' && consent && checked) { consent = false; writeState({ consent: null }); }
  const parts = state === 'running' || state === 'done'
    ? { vosk: !!(run && run.vosk), fluid: !!(run && run.fluid) }
    : { vosk: v === 'ask' || v === 'wait', fluid: f === 'ask' || f === 'wait' };
  const next = { state, pct: state === 'running' || state === 'done' ? pctNow(state === 'done') : null, parts,
    bytes: state === 'ask' ? plan.bytes : 0 };
  const same = next.state === S.state && next.pct === S.pct && next.bytes === S.bytes
    && next.parts.vosk === S.parts.vosk && next.parts.fluid === S.parts.fluid;
  S = next;
  if (same) return;
  for (const fn of listeners) { try { fn(status()); } catch (_) {} }
}

/* ---------- voix fluide : suivi ---------- */
function onFluid(st) {
  fst = st;
  if (st && st.state === 'downloading') {
    const r = ensureRun();
    if (!r.fluid) { r.fluid = { first: 0, frac: 0, done: false }; r.top = 0; }
    const p = st.progress;
    if (p && p.total > 0) {
      /* reprise après un jeu : seuls les fichiers manquants sont comptés (total plus petit) */
      if (p.total > r.fluid.first) r.fluid.first = p.total;
      r.fluid.frac = Math.max(r.fluid.frac, Math.min(1, (r.fluid.first - p.total + p.loaded) / r.fluid.first));
    }
  } else if (st && run && run.fluid && READY.includes(st.state)) run.fluid.done = true;
  emit();
}
function startFluid() {
  if (fjob || (fst && fst.state === 'downloading')) return;
  const r = ensureRun();
  if (!r.fluid) { r.fluid = { first: 0, frac: 0, done: false }; r.top = 0; }
  fjob = true;
  log('voix fluide : téléchargement', { par: fluidBy });
  let p;
  try { p = D.fluid.download({ by: fluidBy }); } catch (_) { p = false; }
  Promise.resolve(p).then(ok => !!ok, () => false).then(ok => {
    fjob = false;
    let st = null;
    try { st = D.fluid.status(); } catch (_) {}
    if (st) fst = st;
    if (!ok && st && st.state === 'error') { fluidFailed = true; log('voix fluide : échec', { erreur: st.error }); }
    if (ok && run && run.fluid) run.fluid.done = true;
    emit();
  });
}
/* la voix fluide part quand le modèle du micro est arrivé (ou s'il n'avait pas à venir) */
const fluidMayStart = () => !vjob || vjob.model === 0 || (vjob.pct !== null && vjob.pct >= 99);
function kickFluid() {
  if (plan.fluid === 'run' && fluidWhy !== 'in-game' && !fluidFailed && fluidMayStart() && fst && (fst.state === 'absent' || fst.state === 'paused')) startFluid();
}

/* ---------- micro ---------- */
function startVosk(need) {
  const job = vjob = { lib: need.lib, model: need.model, pct: null, held: false, kicked: false, promise: null };
  const r = ensureRun();
  r.vosk = { lib: need.lib, model: need.model, pct: null, done: false };
  r.top = 0;
  log('micro : préchargement', { octets: need.bytes });
  /* extraction (calcul lourd) : la voix fluide ne démarre pas, ne s'étalonne pas en même temps */
  const hold = () => { if (job.held) return; job.held = true; try { D.fluid.holdBoot(job.promise); } catch (_) {} };
  const onPct = pc => {
    if (vjob !== job) return;
    job.pct = pc;
    if (run && run.vosk) run.vosk.pct = pc;
    for (const fn of pctFns) { try { fn(pc); } catch (_) {} }
    if (pc >= 99) { hold(); if (!job.kicked) { job.kicked = true; kickFluid(); } }
    emit();
  };
  let p;
  try { p = D.speech.prefetch({ onPct, extract: true }); } catch (_) { p = false; }
  job.promise = Promise.resolve(p).then(ok => !!ok, () => false);
  if (!need.model) hold();
  job.promise.then(ok => {
    if (vjob !== job) return;
    vjob = null;
    pctFns.clear();
    if (ok) { micOk = true; if (run && run.vosk) run.vosk.done = true; }
    else { voskFailed = true; if (run) run.vosk = null; }
    log('micro : ' + (ok ? 'prêt' : 'échec'));
    reconcile();
  });
}

/* ---------- décision ---------- */
async function check() {
  const net = netNow();
  let vosk = null;
  if (!vjob && !micOk && !micSkip && !voskFailed) {
    if (!micPossible()) micSkip = true;
    else {
      let ready = false;
      try { ready = await D.speech.modelReady(); } catch (_) { ready = false; }
      if (ready) micOk = true; else vosk = await voskNeed();
    }
  }
  let fl = null;
  try { D.fluid.init(); } catch (_) {}
  try { fst = await D.fluid.refresh(); } catch (_) { fst = null; }
  if (!fluidFailed && fst && (fst.state === 'absent' || fst.state === 'paused')) {
    try { fl = D.fluid.autoCheck(); } catch (_) { fl = null; }
  }
  plan = planOf({ net, vosk, fluid: fl, consent: !!consent });
  fluidBy = fl && fl.ok && fl.why !== 'parent' ? 'auto' : 'parent';
  fluidWhy = fl ? fl.why : '';
  checked = true;
  if (plan.mode !== 'none') log('plan', { réseau: net, micro: plan.vosk, voix: plan.fluid, voixPourquoi: fl && fl.why, accord: !!consent });
  if (plan.vosk === 'run' && !vjob) startVosk(vosk);
  if (plan.fluid === 'run') {
    const r = ensureRun();
    if (!r.fluid) { r.fluid = { first: 0, frac: 0, done: false }; r.top = 0; }
    kickFluid();
  }
}
function reconcile() {
  if (checking) { again = true; return checking; }
  checking = (async () => {
    do {
      again = false;
      try { await check(); } catch (e) { log('erreur : ' + String((e && e.message) || e)); }
    } while (again);
  })().finally(() => { checking = null; emit(); });
  emit();
  return checking;
}
/* réseau revenu ou changé : nouvel essai (les échecs de cette ouverture sont oubliés) */
function onNet() {
  clearTimeout(netTimer);
  netTimer = setTimeout(() => { voskFailed = false; fluidFailed = false; reconcile(); }, NET_MS);
  try { if (netTimer && netTimer.unref) netTimer.unref(); } catch (_) {}
}
function bind() {
  if (bound) return;
  bound = true;
  try { offFluid = D.fluid.onChange(onFluid); } catch (_) {}
  try { winOf().addEventListener('online', onNet); } catch (_) {}
  try { const c = navOf().connection; if (c && c.addEventListener) c.addEventListener('change', onNet); } catch (_) {}
}

/* création du profil, accueil : tout ce qui manque (rien si tout est prêt) ; by 'parent' : l'adulte a touché
   « Télécharger maintenant » (données mobiles) */
export function start({ by = 'auto' } = {}) {
  if (consent === null) consent = !!readState().consent;
  if (by === 'parent') { consent = true; writeState({ consent: true }); log('accord de l’adulte'); }
  bind();
  if (by !== 'parent' && checked && !checking && (S.state === 'none' || S.state === 'done')) return Promise.resolve(status());
  return reconcile().then(() => status());
}

/* ---------- tests ---------- */
/* { speech, fluid, storage, nav, win, caches } ; null : tout remettre à zéro */
export function _setEnv(e) {
  const x = e || {};
  try { if (offFluid) offFluid(); } catch (_) {}
  try { winOf().removeEventListener('online', onNet); } catch (_) {}
  try { const c = navOf().connection; if (c && c.removeEventListener) c.removeEventListener('change', onNet); } catch (_) {}
  clearTimeout(netTimer);
  D = { speech: x.speech || speechMod, fluid: x.fluid || fluidMod };
  storage = x.storage || null;
  navOf = x.nav ? () => x.nav : () => G.navigator || {};
  winOf = x.win ? () => x.win : () => G;
  cachesOf = 'caches' in x ? () => x.caches : () => { try { return G.caches || null; } catch (_) { return null; } };
  S = { state: 'idle', pct: null, parts: { vosk: false, fluid: false }, bytes: 0 };
  listeners.clear(); pctFns.clear();
  bound = false; checking = null; again = false; netTimer = 0; checked = false; offFluid = null;
  consent = null; micOk = false; micSkip = false; voskFailed = false; fluidFailed = false;
  vjob = null; fjob = false; fst = null; plan = { vosk: null, fluid: null, mode: 'none', bytes: 0 }; fluidBy = 'auto'; fluidWhy = ''; run = null;
}
