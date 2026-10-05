/* ============ DÉMARRAGE DE L'APPLI ============
   1. store.init() (migration v1/v11 → v3) ;
   2. réglages du profil actif : son (audio.setMuted), mouvement (motion.setMode + html.motion-soft),
      thème visuel (js/ui/theme-picker.js : html[data-theme] + <meta name="theme-color">),
      ré-appliqués à chaque changement du store ;
   3. service worker + bandeau « Nouvelle version » (rechargement UNIQUEMENT après un geste) ;
   4. déverrouillage du son au premier geste ;
   5. route initiale (contrat §8.3) puis routeur.
   0. (v2.2.2) dès le chargement du module : l'invitation du navigateur à installer Caramel (beforeinstallprompt, Chrome
      Android) est gardée pour le vrai bouton « Installer », et l'installation notée (appinstalled) — js/core/install.js.
   6. (v2.2.2) voix fluide (js/core/voice-fluid.js) : le moteur démarre en tâche de fond s'il est en cache ; chaque
      changement d'écran lui est signalé (aucun téléchargement pendant un jeu ; après une séance, téléchargement
      automatique s'il est permis).
   Les modules d'autres équipes sont chargés dynamiquement : s'il en manque un (écran, son, mouvement…),
   l'appli démarre quand même et le routeur affiche son écran de secours. */
import * as router from './router.js';
import { watch as watchInstall } from './core/install.js';

window.__caramelBooted = true;          /* pour le chien de garde de index.html : le JS moderne tourne */
/* l'invitation à installer arrive tôt, parfois avant la fin du démarrage : gardée tout de suite (js/ui/install.js) */
try { watchInstall(window); } catch (e) { console.error('Installation', e); }

const PICKED_KEY = 'caramel-picked';    /* sessionStorage : profil choisi pendant cette session */

const ROUTES = {
  'home': () => import('./ui/home.js'),
  'profiles': () => import('./ui/profiles.js'),
  'onboarding': () => import('./ui/onboarding.js'),
  'welcome': { load: () => import('./ui/onboarding.js'), params: { mode: 'welcome' } },
  'balade': () => import('./ui/balade.js'),
  'play/:id': () => import('./ui/game-shell.js'),
  'progres': () => import('./ui/progres.js'),
  'parents': () => import('./ui/parents.js'),
  'import': () => import('./ui/import-eval.js'),
  'famille': () => import('./ui/famille.js'),                  /* En famille : classements de la semaine, concours */
  'famille/:part': () => import('./ui/famille.js'),            /* #/famille/concours : spectacle du concours */
  'battle': () => import('./ui/battle.js')                     /* défi en famille, à tour de rôle sur un appareil */
};

const load = path => import(path).catch(e => { console.error('Module indisponible : ' + path, e); return null; });

/* ---------- réglages du profil actif ---------- */
let applied = '';
function applySettings(store, audio, motion, themes) {
  let s = {};
  try { const p = store && store.getProfile(); s = (p && p.settings) || {}; } catch (_) {}
  const sound = s.sound !== false;
  const mode = s.motion === 'soft' ? 'soft' : 'full';
  const theme = typeof s.theme === 'string' ? s.theme : '';      /* aucun profil → thème par défaut (Caramel) */
  const sig = sound + '|' + mode + '|' + theme;
  if (sig === applied) return;
  applied = sig;
  try { if (audio && audio.setMuted) audio.setMuted(!sound); } catch (e) { console.error(e); }
  try { if (motion && motion.setMode) motion.setMode(mode); } catch (e) { console.error(e); }
  document.documentElement.classList.toggle('motion-soft', mode === 'soft');
  /* cache lu par index.html avant le premier affichage (écran d'attente immobile en « animations douces ») */
  try { globalThis.localStorage.setItem('caramel-motion', mode); } catch (_) {}
  try { if (themes && themes.applyTheme) themes.applyTheme(theme); } catch (e) { console.error(e); }
}

/* ---------- son : déverrouillage au premier geste ----------
   pointerdown d'abord ; sur écran tactile, l'activation utilisateur n'est acquise qu'au relâchement :
   on réessaie donc jusqu'au premier pointerup / touchend / click / keydown. */
function unlockOnGesture(audio, tts) {
  const EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
  let warmed = false;
  const handler = ev => {
    try { if (audio && audio.unlock) audio.unlock(); } catch (_) {}
    if (ev.type !== 'pointerdown') {
      if (!warmed) { warmed = true; try { if (tts && tts.warmUp) tts.warmUp(); } catch (_) {} }
      EVENTS.forEach(t => window.removeEventListener(t, handler, true));
    }
  };
  EVENTS.forEach(t => window.addEventListener(t, handler, { capture: true, passive: true }));
}

/* ---------- route initiale (contrat §8.3) ---------- */
function picked() {
  try { return !!globalThis.sessionStorage.getItem(PICKED_KEY); } catch (_) { return false; }
}
function initialRoute(store, hash = location.hash) {
  const name = String(hash || '').replace(/^#\/?/, '').split(/[/?]/)[0];
  let profiles = [], active = null;
  try { profiles = store ? store.listProfiles() : []; active = store ? store.getProfile() : null; } catch (_) {}
  if (!profiles.length) return name === 'onboarding' || name === 'import' ? null : 'onboarding';
  if (!active) return 'profiles';
  if (!active.classe) return name === 'import' ? null : 'welcome';
  if (profiles.length >= 2 && !picked()) return 'profiles';
  if (name === 'welcome') return 'home';
  return null;                            /* garder le lien courant (rechargement) s'il est valide, sinon l'accueil */
}

/* ---------- service worker + bandeau de mise à jour (contrat §8.4) ---------- */
let pendingUpdate = null;                 /* geste à faire pour basculer sur la nouvelle version */
let bar = null;

/* jamais pendant un jeu, un défi, l'arrivée d'un enfant ni la saisie d'une fiche : le bandeau, inséré en haut de la page,
   décalerait l'écran sous le doigt (l'espace parents le garde : c'est l'adulte qui accepte la mise à jour) */
const BUSY_ROUTES = ['play', 'battle', 'onboarding', 'welcome', 'import'];
function renderBar() {
  const route = router.current();
  const show = !!pendingUpdate && !(route && BUSY_ROUTES.includes(route.name));
  document.documentElement.classList.toggle('has-update', show);   /* l'accueil range son invitation à installer */
  if (!show) { if (bar) bar.hidden = true; return; }
  if (!bar) {
    bar = document.createElement('button');
    bar.type = 'button';
    bar.className = 'update-bar';
    bar.textContent = '✨ Nouvelle version de Caramel — touche pour mettre à jour';
    bar.addEventListener('click', () => { if (pendingUpdate) pendingUpdate(); });
    document.body.insertBefore(bar, document.body.firstChild);
  }
  bar.hidden = false;
}
function hideBar() { pendingUpdate = null; renderBar(); }

function registerSW() {
  let sw = null;
  try { sw = navigator.serviceWorker; } catch (_) {}
  if (!sw) return;
  let asked = false, reloading = false, lastCheck = 0, offered = null, switched = false;
  const hadController = !!sw.controller;
  /* session démarrée sous la v11 (son cache existe) : la v2 s'active d'elle-même (skipWaiting), sans bandeau */
  const legacy = (async () => { try { return await caches.has('caramel-shell-v1'); } catch (_) { return false; } })();
  const reload = () => { if (!reloading) { reloading = true; location.reload(); } };
  sw.addEventListener('controllerchange', async () => {
    if (asked) { reload(); return; }                     /* l'utilisateur a touché le bandeau */
    offered = null;
    hideBar();
    if (!hadController) return;                          /* première installation : rien à recharger */
    if ((await legacy) && !switched) { switched = true; return; }   /* bascule v11 → v2 : déjà la bonne page */
    /* une autre fenêtre a activé une nouvelle version : cette page tourne encore l'ancienne → on propose */
    pendingUpdate = () => { asked = true; reload(); };
    renderBar();
  });
  const offer = async w => {
    if (!w || !sw.controller || offered === w) return;   /* première visite : rien à mettre à jour */
    if ((await legacy) && !switched) return;
    if (w.state !== 'installed') return;
    offered = w;
    w.addEventListener('statechange', () => {
      if (w.state === 'redundant' && offered === w && !asked) { offered = null; hideBar(); }   /* remplacée ou échouée */
    });
    pendingUpdate = () => {
      if (asked) return;
      asked = true;
      if (bar) { bar.textContent = '✨ Mise à jour de Caramel…'; bar.disabled = true; }
      try { w.postMessage({ type: 'SKIP_WAITING' }); } catch (_) {}
      setTimeout(reload, 5000);                          /* filet de sécurité si controllerchange n'arrive pas */
    };
    renderBar();
  };
  const track = w => { if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); }); };
  sw.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    if (reg.waiting) offer(reg.waiting);
    /* installation déjà lancée par le navigateur (contrôle à la navigation) : updatefound est passé */
    if (reg.installing) track(reg.installing);
    reg.addEventListener('updatefound', () => track(reg.installing));
    /* retour au premier plan : on regarde s'il y a du neuf (au plus toutes les 30 s) */
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck < 30000) return;
      lastCheck = Date.now();
      reg.update().catch(() => {});
    });
  }).catch(e => console.warn('Service worker non enregistré :', e));
}

/* ---------- démarrage ---------- */
async function boot() {
  const [store, audio, motion, tts, themes] = await Promise.all([
    load('./core/store.js'), load('./core/audio.js'), load('./core/motion.js'), load('./core/tts.js'), load('./ui/theme-picker.js')
  ]);
  if (store) {
    try { store.init(); } catch (e) { console.error('store.init', e); }
  }
  applySettings(store, audio, motion, themes);
  try { if (store && store.subscribe) store.subscribe(() => applySettings(store, audio, motion, themes)); } catch (_) {}
  unlockOnGesture(audio, tts);
  registerSW();
  router.onChange(renderBar);
  const vt = motion && typeof motion.viewTransition === 'function' ? fn => motion.viewTransition(fn) : null;
  const kit = await load('./ui/kit.js');
  const beforeSwap = () => { try { if (kit && kit.closeAllSheets) kit.closeAllSheets('nav'); } catch (_) {} };
  await router.start(ROUTES, { fallback: 'home', transition: vt, initial: initialRoute(store), beforeSwap });
  document.documentElement.classList.add('booted');
  const fluid = await load('./core/voice-fluid.js');
  if (fluid) {
    try {
      fluid.init();
      fluid.onRoute(router.current());
      router.onChange(() => fluid.onRoute(router.current()));
    } catch (e) { console.error('Voix fluide', e); }
  }
}

boot().catch(e => {
  console.error('Démarrage', e);
  try { router.start(ROUTES, { fallback: 'home' }); } catch (_) {}
});
