/* ============ CARAMEL SUR L'ÉCRAN D'ACCUEIL : quand inviter, comment (v2.2.2, décision du parent du 04/10/2026) ============
   Module PUR : aucun accès implicite au navigateur (l'environnement, le stockage et la cible des événements sont passés
   en paramètres ; défauts = globalThis) : importable dans Node (tests/install.test.mjs).
   - parseUA(ua, { platform, maxTouchPoints }) → { os, osVersion, browser, browserVersion, ios, android, mobile, inApp }
     (lu dans l'agent utilisateur, rien n'est envoyé ; sert aussi au diagnostic de l'espace parents, js/ui/diag.js) ;
   - isStandalone(env) : Caramel ouvert depuis l'écran d'accueil (display-mode standalone / fullscreen / minimal-ui,
     ou navigator.standalone sur iPhone et iPad) ;
   - installMethod(env) → 'prompt' (le navigateur a proposé l'installation : beforeinstallprompt gardé, vrai bouton
     « Installer » — Chrome et Edge sur Android et ordinateur, Samsung Internet) | 'ios-safari' (Partager › Sur l'écran
     d'accueil) | 'ios-chrome' (Partager, à droite de la barre d'adresse › Ajouter à l'écran d'accueil, iOS 16.4 et plus :
     aide de Google, support.google.com/chrome/answer/15085120) | null (navigateur sans installation possible, navigateur
     intégré à une autre appli, ou déjà installé : rien à proposer) ;
   - mémoire PAR APPAREIL, localStorage 'caramel-install' (jamais dans les sauvegardes) : { v: 1, later, done } (ms) —
     « Plus tard » ou ✕ = 7 jours sans invitation (LATER_DAYS) ; done = installé (appinstalled, ou « C'est fait » sur
     iPhone et iPad) : plus d'invitation dans le navigateur ; un nouvel beforeinstallprompt prouve que Caramel n'est plus
     installé (désinstallé) : done est effacé. Sur iPhone et iPad, rien ne vérifie « C'est fait » (un enfant peut le
     toucher sans avoir installé) : 30 jours après (IOS_DONE_DAYS), toujours dans le navigateur, l'invitation revient ;
   - shouldInvite({ standalone, method, prefs, now }) : une invitation est-elle permise ? (les écrans ajoutent leurs
     propres conditions : jamais pendant un jeu, le bandeau de mise à jour ou la visite guidée — js/ui/install.js) ;
   - watch(target, storage) : garde l'invitation du navigateur (preventDefault : pas de mini-barre de Chrome, c'est
     l'appli qui choisit son moment) et note l'installation ; promptReady(), prompt() → Promise<'accepted' |
     'dismissed' | 'unavailable'>, onChange(fn) → désabonnement. js/main.js appelle watch() au tout début. */

export const INSTALL_KEY = 'caramel-install';
export const LATER_DAYS = 7;
export const IOS_DONE_DAYS = 30;
const DAY = 86400000;

const defaultLS = () => { try { return globalThis.localStorage || null; } catch (_) { return null; } };
const defaultEnv = () => {
  const G = globalThis;
  const n = G.navigator || {};
  let mm = null;
  try { if (typeof G.matchMedia === 'function') mm = q => G.matchMedia(q).matches; } catch (_) { mm = null; }
  return { ua: n.userAgent || '', platform: n.platform || '', maxTouchPoints: n.maxTouchPoints || 0, navStandalone: n.standalone === true, matchMedia: mm };
};

/* ---------- agent utilisateur ---------- */
const pick = (u, re) => { const m = re.exec(u); return m ? m[1] : ''; };
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Snapchat|musical_ly|TikTok|Twitter|Line\/|MicroMessenger|Pinterest|GSA\//;
export function parseUA(ua = '', { platform = '', maxTouchPoints = 0 } = {}) {
  const u = String(ua || '');
  /* iPadOS 13 et plus : Safari se présente comme un Mac ; l'écran tactile le trahit */
  const ipadDesk = /Macintosh/.test(u) && !/iPhone|iPad|iPod/.test(u) && (platform === 'MacIntel' || platform === 'iPad' || !platform) && maxTouchPoints > 1;
  const ios = /iPhone|iPad|iPod/.test(u) || ipadDesk;
  const android = /Android/.test(u);
  let os = 'inconnu', osVersion = '';
  if (ios) {
    os = /iPad/.test(u) || ipadDesk ? 'iPadOS' : 'iOS';
    osVersion = pick(u, /OS (\d+(?:_\d+)*) like Mac OS X/).replace(/_/g, '.') || (ipadDesk ? pick(u, /Version\/(\d+(?:\.\d+)*)/) : '');
    /* Safari 26 et plus : la version d'iOS est figée dans l'agent utilisateur (« 18_6 », puis « 18_6_2 », « 18_7 ») ;
       seule Version/ suit la vraie (celle de Safari = celle d'iOS). Chrome, Firefox, Edge et Opera sur iOS donnent la vraie */
    const sv = pick(u, /Version\/(\d+(?:\.\d+)*)/);
    if (sv && Number(sv.split('.')[0]) >= 26 && /Safari\//.test(u) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(u)) osVersion = sv;
  } else if (android) { os = 'Android'; osVersion = pick(u, /Android (\d+(?:\.\d+)*)/); }
  else if (/CrOS/.test(u)) os = 'ChromeOS';
  else if (/Windows/.test(u)) os = 'Windows';
  else if (/Macintosh|Mac OS X/.test(u)) os = 'macOS';
  else if (/Linux/.test(u)) os = 'Linux';
  /* navigateur (ordre : les dérivés de Chrome avant Chrome) */
  let browser = 'inconnu', browserVersion = '';
  const B = [
    ['Chrome', /CriOS\/(\d+)/], ['Firefox', /FxiOS\/(\d+)/], ['Edge', /EdgiOS\/(\d+)/], ['Opera', /OPiOS\/(\d+)/],
    ['Edge', /Edg(?:A)?\/(\d+)/], ['Opera', /OPR\/(\d+)/], ['Samsung Internet', /SamsungBrowser\/(\d+)/],
    ['Firefox', /Firefox\/(\d+)/], ['Chrome', /Chrome\/(\d+)/], ['Safari', /Version\/(\d+(?:\.\d+)?).*Safari\//]
  ];
  for (const [name, re] of B) {
    const v = pick(u, re);
    if (v) { browser = name; browserVersion = v; break; }
  }
  /* navigateur intégré à une autre appli (Facebook, Instagram…, vue web d'Android, appli Google sur iPhone) : on ne
     peut pas y installer Caramel */
  const webview = android && /; wv\)/.test(u);
  const iosShell = ios && !/Safari\//.test(u);              /* vue web d'une appli iOS : pas de jeton Safari */
  const inApp = IN_APP.test(u) || webview || iosShell;
  if (inApp && browser === 'Chrome' && webview) browser = 'vue web Android';
  const mobile = ios || android || /Mobile/.test(u);
  return { os, osVersion, browser, browserVersion, ios, android, mobile, inApp };
}
/* « 16.4 » ≥ « 16.4 » : comparaison de versions numériques */
export function atLeast(v, min) {
  const a = String(v || '').split('.').map(Number), b = String(min).split('.').map(Number);
  if (!a.length || !Number.isFinite(a[0]) || !String(v || '')) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return true;
}

/* ---------- appli installée ? ---------- */
export function isStandalone(env = defaultEnv()) {
  if (env.navStandalone) return true;
  try {
    return !!(env.matchMedia && (env.matchMedia('(display-mode: standalone)') || env.matchMedia('(display-mode: fullscreen)')
      || env.matchMedia('(display-mode: minimal-ui)')));
  } catch (_) { return false; }
}

/* ---------- comment installer ici ? ---------- */
export function installMethod(env = defaultEnv(), { prompt = promptReady() } = {}) {
  if (isStandalone(env)) return null;
  if (prompt) return 'prompt';
  const d = parseUA(env.ua, env);
  if (!d.ios || d.inApp) return null;
  if (d.browser === 'Safari') return 'ios-safari';
  /* Chrome sur iPhone / iPad : l'ajout à l'écran d'accueil existe depuis iOS 16.4 */
  if (d.browser === 'Chrome' && (!d.osVersion || atLeast(d.osVersion, '16.4'))) return 'ios-chrome';
  return null;
}

/* ---------- mémoire de l'appareil ---------- */
export function readInstall(st = defaultLS()) {
  let o = null;
  try { o = JSON.parse((st && st.getItem(INSTALL_KEY)) || 'null'); } catch (_) { o = null; }
  const n = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
  return { v: 1, later: n(o && o.later), done: n(o && o.done) };
}
export function writeInstall(prefs, st = defaultLS()) {
  try { if (st) st.setItem(INSTALL_KEY, JSON.stringify({ v: 1, later: prefs.later || 0, done: prefs.done || 0 })); return true; } catch (_) { return false; }
}
/* « Plus tard » ou ✕ : 7 jours sans invitation */
export function snooze(st = defaultLS(), now = Date.now()) { const p = readInstall(st); p.later = now; writeInstall(p, st); return p; }
export function markInstalled(st = defaultLS(), now = Date.now()) { const p = readInstall(st); p.done = now; p.later = 0; writeInstall(p, st); return p; }
export function clearInstalled(st = defaultLS()) { const p = readInstall(st); if (!p.done) return p; p.done = 0; writeInstall(p, st); return p; }
export function snoozed(prefs, now = Date.now()) {
  const t = prefs && prefs.later;
  return !!t && now >= t && now - t < LATER_DAYS * DAY;
}

/* « C'est fait » touché sur iPhone ou iPad il y a 30 jours ou plus, et toujours dans le navigateur : rien ne l'a vérifié */
export function doneExpired(prefs, method, now = Date.now()) {
  const t = prefs && prefs.done;
  return !!t && String(method || '').startsWith('ios') && now - t >= IOS_DONE_DAYS * DAY;
}

/* ---------- quand inviter ---------- */
export function shouldInvite({ standalone = false, method = null, prefs = { later: 0, done: 0 }, now = Date.now() } = {}) {
  if (standalone || !method) return false;
  if (prefs && prefs.done && !doneExpired(prefs, method, now)) return false;
  return !snoozed(prefs, now);
}

/* ---------- l'invitation du navigateur (beforeinstallprompt), gardée pour le bouton « Installer » ---------- */
let deferred = null;
let installedNow = false;
const fns = new Set();
function emit() { for (const fn of [...fns]) { try { fn(); } catch (_) {} } }
let watched = null;
export function watch(target = globalThis, st = defaultLS()) {
  if (!target || typeof target.addEventListener !== 'function' || watched === target) return;
  watched = target;
  target.addEventListener('beforeinstallprompt', e => {
    try { e.preventDefault(); } catch (_) {}
    deferred = e;
    installedNow = false;
    clearInstalled(st);
    emit();
  });
  target.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    markInstalled(st);
    emit();
  });
}
export function promptReady() { return !!deferred; }
/* installée pendant cette séance (appinstalled) : tout disparaît */
export function justInstalled() { return installedNow; }
export async function prompt() {
  const e = deferred;
  if (!e || typeof e.prompt !== 'function') return 'unavailable';
  deferred = null;                          /* une invitation du navigateur ne sert qu'une fois */
  emit();
  try {
    await e.prompt();
    const c = await e.userChoice;
    return c && c.outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch (_) { return 'unavailable'; }
}
export function onChange(fn) {
  if (typeof fn !== 'function') return () => {};
  fns.add(fn);
  return () => fns.delete(fn);
}
/* tests : remet l'état à zéro */
export function _reset() { deferred = null; installedNow = false; watched = null; fns.clear(); }
