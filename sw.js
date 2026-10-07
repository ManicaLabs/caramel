/* ============ CARAMEL 2 · SERVICE WORKER (contrat §8.4, CDC §13.4) ============
   - Cache versionné caramel-<VERSION>, pré-rempli avec ASSETS (liste générée : node tools/precache.mjs).
   - install : précache ; skipWaiting() immédiat SEULEMENT si le cache v11 'caramel-shell-v1' existe
     (la v11 n'a pas de bandeau de mise à jour : on bascule tout de suite) ; sinon la nouvelle version attend
     que l'enfant ou le parent touche le bandeau « Nouvelle version » (message SKIP_WAITING).
   - activate : supprime les caches caramel-* obsolètes — JAMAIS 'vosk-model-v1' (modèle de 42 Mo, v2.2.4), 'vosk-lib-v1'
     ni 'caramel-voix-v1' (voix enregistrée du compagnon, v2.2.2) ; 'piper-tts-v1' (voix fluide, ≈ 45 Mo : modèle
     models/piper/, onnxruntime-web et piper-phonemize de jsDelivr, rempli par la page : js/core/piper-tts.js) ne commence
     pas par « caramel- » : jamais touché. Ni le modèle ni le moteur ne sont dans le précache (seuls les petits modules
     js/core/piper-*.js et voice-fluid.js le sont, comme tout js/).
   - fetch : GET de même origine hors /models/ (le modèle a son propre cache) ; navigation vers l'appli →
     index.html du cache, puis réseau ; (v2.2.4) navigation vers les pages publiques pages/*.html (confidentialité,
     aide, mentions légales, licences : précachées) → cache d'abord, puis réseau, pour les lire hors ligne ; autres
     pages (bancs d'essai…) : réseau ; autres ressources : cache d'abord, puis réseau ;
     vosk.js (jsDelivr) gardé dans 'vosk-lib-v1' pour la lecture hors ligne ;
     clips de la voix (audio/voix/*.mp3?v=<empreinte>, ≈ 1,8 Mo, HORS précache) : cache dédié 'caramel-voix-v1',
     rempli à la première écoute (et en tâche de fond par la page, js/core/voice-clips.js) ; hors ligne, un clip
     absent répond 503 et la page passe à la voix du téléphone.
   - Rappels quotidiens (periodicsync 'caramel-daily', enregistré par js/core/notifs.js) et notificationclick. */

/* ASSETS:START */
const VERSION = '2.3.0';
const ASSETS = [
  'index.html',
  'manifest.webmanifest',
  'favicon-32.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png',
  'icon-monochrome-512.png',
  'icon.svg',
  'fonts/andika-400.woff2',
  'fonts/andika-700.woff2',
  'fonts/fredoka-500.woff2',
  'fonts/fredoka-600.woff2',
  'fonts/fredoka-700.woff2',
  'css/base.css',
  'css/games/cloture.css',
  'css/games/course.css',
  'css/games/operations.css',
  'css/games/orchestre.css',
  'css/games/pommes.css',
  'css/games/tables.css',
  'css/motion.css',
  'css/themes.css',
  'css/ui/backup.css',
  'css/ui/balade.css',
  'css/ui/battle.css',
  'css/ui/companion.css',
  'css/ui/duel.css',
  'css/ui/famille.css',
  'css/ui/game.css',
  'css/ui/home.css',
  'css/ui/import.css',
  'css/ui/install.css',
  'css/ui/kit.css',
  'css/ui/mount.css',
  'css/ui/onboarding.css',
  'css/ui/parents.css',
  'css/ui/preload.css',
  'css/ui/profiles.css',
  'css/ui/progres.css',
  'css/ui/radar.css',
  'css/ui/shell.css',
  'js/content/companion-data.js',
  'js/content/fr/conjug.js',
  'js/content/fr/verbs.js',
  'js/content/index.js',
  'js/content/maths/faits.js',
  'js/content/maths/ligne.js',
  'js/content/maths/operations.js',
  'js/content/maths/procedures.js',
  'js/content/stories/cm2.js',
  'js/content/stories/index.js',
  'js/content/stories/legacy.js',
  'js/content/stories/questions.js',
  'js/content/voice-lines.js',
  'js/content/voice-manifest.js',
  'js/core/adaptive.js',
  'js/core/audio.js',
  'js/core/axes.js',
  'js/core/debuglog.js',
  'js/core/duel.js',
  'js/core/economy.js',
  'js/core/family.js',
  'js/core/install.js',
  'js/core/leitner.js',
  'js/core/levels.js',
  'js/core/manche.js',
  'js/core/mic-worklet.js',
  'js/core/migrate.js',
  'js/core/motion.js',
  'js/core/notifs.js',
  'js/core/numbers-fr.js',
  'js/core/piper-engine.js',
  'js/core/piper-tts.js',
  'js/core/piper-worker.js',
  'js/core/preload.js',
  'js/core/profiles.js',
  'js/core/radar-model.js',
  'js/core/rng.js',
  'js/core/session.js',
  'js/core/speech.js',
  'js/core/store.js',
  'js/core/themes.js',
  'js/core/tts.js',
  'js/core/util.js',
  'js/core/voice-clips.js',
  'js/core/voice-fluid.js',
  'js/games/cloture-logic.js',
  'js/games/cloture.js',
  'js/games/course-engine.js',
  'js/games/course.js',
  'js/games/index.js',
  'js/games/operations-logic.js',
  'js/games/operations.js',
  'js/games/orchestre-logic.js',
  'js/games/orchestre.js',
  'js/games/pommes-logic.js',
  'js/games/pommes.js',
  'js/games/tables-logic.js',
  'js/games/tables.js',
  'js/main.js',
  'js/router.js',
  'js/ui/backup.js',
  'js/ui/balade.js',
  'js/ui/battle.js',
  'js/ui/companion-life.js',
  'js/ui/companion.js',
  'js/ui/diag.js',
  'js/ui/duel.js',
  'js/ui/famille.js',
  'js/ui/game-ctx.js',
  'js/ui/game-header.js',
  'js/ui/game-shell.js',
  'js/ui/home.js',
  'js/ui/import-eval.js',
  'js/ui/install.js',
  'js/ui/kit.js',
  'js/ui/mount-svg.js',
  'js/ui/onboarding.js',
  'js/ui/parents.js',
  'js/ui/preload.js',
  'js/ui/profiles.js',
  'js/ui/progres.js',
  'js/ui/radar-detect-worker.js',
  'js/ui/radar-detect.js',
  'js/ui/radar.js',
  'js/ui/theme-picker.js',
  'js/ui/voice-fluid.js',
  'js/ui/voice.js',
  'js/ui/wipe.js'
];
/* ASSETS:END */

const CACHE = 'caramel-' + VERSION;
const LEGACY_CACHE = 'caramel-shell-v1';     /* cache de la v11 */
const MODEL_CACHE = 'vosk-model-v1';         /* modèle Vosk, rempli par la page (js/core/speech.js) */
const LIB_CACHE = 'vosk-lib-v1';             /* bibliothèque vosk-browser */
const VOICE_CACHE = 'caramel-voix-v1';       /* voix enregistrée du compagnon (clips MP3 versionnés par ?v=) */
const KEEP = [MODEL_CACHE, LIB_CACHE, VOICE_CACHE];   /* jamais supprimés, quelle que soit la version */
const VOSK_LIB = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';
const SHELL_URL = new URL('index.html', self.location).href;

const MSGS = [
  'Ton compagnon s’ennuie sans toi 🐴 Une petite balade\u202f?',
  'Ta balade du jour t’attend 🌟 Quelques minutes suffisent\u202f!',
  'Zip le papillon s’entraîne déjà… 🦋 Tu viens lire avec lui\u202f?',
  'Cinq minutes ensemble, et ton compagnon est tout content 🍎',
  'Une histoire, quelques tables, et hop\u202f! On y va\u202f? 🎻',
  'Tes pommes 🍎 et tes étoiles ⭐ t’attendent au ranch\u202f!',
  'Un petit jeu au ranch aujourd’hui\u202f? Ton compagnon t’attend 🎁'
];

const isObsolete = key => key.startsWith('caramel-') && key !== CACHE && !KEEP.includes(key);

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    /* cache: 'reload' : jamais une copie périmée du cache HTTP (GitHub Pages : max-age 10 min) */
    await cache.addAll(ASSETS.map(u => new Request(new URL(u, self.location).href, { cache: 'reload' })));
    if (await caches.has(LEGACY_CACHE)) await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(isObsolete).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* la coquille de l'appli : la racine de la portée ou index.html (pas les autres pages, ex. bancs d'essai) */
function isShell(url) {
  const base = new URL(self.registration.scope).pathname;
  return url.pathname === base || url.pathname === base + 'index.html';
}

/* v2.2.4 : pages publiques de pages/ (précachées : lisibles hors ligne depuis l'espace parents) */
function isInfoPage(url) {
  const base = new URL(self.registration.scope).pathname;
  return url.pathname.startsWith(base + 'pages/') && url.pathname.endsWith('.html');
}

async function shell(req) {
  try {
    const hit = await (await caches.open(CACHE)).match(SHELL_URL);
    if (hit) return hit;
  } catch (_) {}
  try { return await fetch(req); } catch (_) {}
  return new Response('<!DOCTYPE html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Caramel</title><p style="font-family:system-ui,sans-serif;text-align:center;margin:30vh 20px 0;color:#5b3a29;font-size:1.2rem">' +
    '🐴 Caramel n’arrive pas à se charger hors ligne. Reconnecte-toi, puis réessaie.</p></html>',
  { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function fromCache(e) {
  const req = e.request;
  let cache = null;
  try {
    cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
  } catch (_) {}
  const res = await fetch(req);
  if (cache && res && res.ok && res.type === 'basic') e.waitUntil(cache.put(req, res.clone()).catch(() => {}));
  return res;
}

/* clip de la voix : cache dédié d'abord (l'URL porte l'empreinte du texte : une nouvelle version est un autre clip),
   puis réseau ; seule une réponse complète (200) est gardée ; hors ligne → 503 (la page prend la voix du téléphone) */
async function voiceClip(e) {
  const req = e.request;
  let cache = null;
  try {
    cache = await caches.open(VOICE_CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
  } catch (_) {}
  try {
    const res = await fetch(req);
    if (cache && res && res.status === 200 && res.type === 'basic') e.waitUntil(cache.put(req, res.clone()).catch(() => {}));
    return res;
  } catch (_) {
    return new Response('', { status: 503, statusText: 'hors ligne' });
  }
}

async function voskLib(e) {
  let cache = null;
  try {
    cache = await caches.open(LIB_CACHE);
    const hit = await cache.match(VOSK_LIB);
    if (hit) return hit;
  } catch (_) {}
  try {
    /* requête CORS (jsDelivr l'autorise) : on connaît le vrai statut avant de mettre en cache */
    const res = await fetch(VOSK_LIB, { mode: 'cors', credentials: 'omit' });
    if (cache && res.ok) e.waitUntil(cache.put(VOSK_LIB, res.clone()).catch(() => {}));
    return res;
  } catch (_) {
    return fetch(e.request);
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.href === VOSK_LIB) { e.respondWith(voskLib(e)); return; }
  if (url.origin !== location.origin) return;
  if (url.pathname.includes('/models/')) return; /* le gros modele a deja son propre cache */
  if (url.pathname.includes('/audio/voix/')) { e.respondWith(voiceClip(e)); return; }
  if (req.mode === 'navigate') {
    if (isShell(url)) e.respondWith(shell(req));
    else if (isInfoPage(url)) e.respondWith(fromCache(e));
    return;
  }
  e.respondWith(fromCache(e));
});

self.addEventListener('periodicsync', e => {
  if (e.tag === 'caramel-daily') {
    e.waitUntil(self.registration.showNotification('Caramel 🐴', {
      body: MSGS[new Date().getDate() % MSGS.length],
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: 'caramel-daily'
    }));
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return clients.openWindow('./');
  }));
});
