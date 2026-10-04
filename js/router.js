/* ============ ROUTEUR HASH ============
   '#/play/tables?mode=balade&block=1' → { name: 'play', route: 'play/:id', params: { id: 'tables' },
   query: { mode: 'balade', block: '1' } }.
   routes = { 'home': () => import('./ui/home.js'), 'play/:id': () => import('./ui/game-shell.js'),
              'welcome': { load: () => import('./ui/onboarding.js'), params: { mode: 'welcome' } }, … }
   Un écran = export default { mount(root, params, query), unmount() } (mount peut être asynchrone).
   Chaque écran reçoit un conteneur neuf <div class="view"> dans #app : ce qu'un ancien écran écrirait
   en retard (après une navigation) tombe dans un nœud détaché, jamais dans l'écran suivant.
   Navigation interne par history.pushState avec un indice : back() ne fait jamais quitter l'appli.
   Écran monté (D2-11) : le <h1> de l'écran donne le titre d'onglet « Titre · Caramel » (sauf l'écran de repli et un
   écran qui a posé son propre titre) et reçoit le focus quand celui-ci est perdu (resté sur la page) : le lecteur
   d'écran annonce le nouvel écran. Un écran qui place lui-même le focus (onboarding, feuille) n'est pas touché. */

let table = [];                 /* [{ key, segs, name, load, params }] */
let opts = { fallback: 'home', transition: null, root: null };
let mounted = null;             /* { screen, view, hash } */
let cur = null;                 /* dernière route montée */
let token = 0;                  /* navigation la plus récente */
let started = false;
const listeners = new Set();

const MOUNT_WAIT_MS = 350;      /* part asynchrone de mount() attendue dans la transition de vue */
const TRANSITION_WAIT_MS = 1200;

/* ---------- analyse ---------- */
function clean(path) {
  return String(path ?? '').trim().replace(/^#/, '').replace(/^\/+/, '');
}
/* hash (ou chemin) → { path, name, route, params, query, hash, entry } ; entry null si aucune route */
export function parse(hash) {
  const s = clean(hash);
  const q = s.indexOf('?');
  const path = (q < 0 ? s : s.slice(0, q)).replace(/\/+$/, '');
  const query = {};
  if (q >= 0) {
    try { for (const [k, v] of new URLSearchParams(s.slice(q + 1))) query[k] = v; } catch (_) {}
  }
  let segs = [];
  try { segs = path ? path.split('/').map(decodeURIComponent) : []; } catch (_) { segs = path.split('/'); }
  for (const r of table) {
    if (r.segs.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < segs.length && ok; i++) {
      if (r.segs[i].startsWith(':')) params[r.segs[i].slice(1)] = segs[i];
      else ok = r.segs[i] === segs[i];
    }
    if (ok) return { path, name: r.name, route: r.key, params: { ...r.params, ...params }, query, hash: '#/' + s, entry: r };
  }
  return { path, name: null, route: null, params: {}, query, hash: '#/' + s, entry: null };
}

function toHash(path, query) {
  let s = clean(path);
  if (query && typeof query === 'object') {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) qs.set(k, String(v));
    const str = qs.toString();
    if (str) s += (s.includes('?') ? '&' : '?') + str;
  }
  return '#/' + s;
}
const depth = () => (history.state && Number.isInteger(history.state.caramel) ? history.state.caramel : 0);

/* ---------- API ---------- */
/* routes : { motif: chargeur | { load, params } }
   options : { fallback: 'home', transition: fn => …, root: '#app', initial: chemin imposé au démarrage } */
export function start(routes, { fallback = 'home', transition = null, root = null, initial = null, beforeSwap = null } = {}) {
  table = Object.entries(routes || {}).map(([key, val]) => {
    const segs = clean(key).split('/').filter(Boolean);
    const def = typeof val === 'function' ? { load: val } : (val || {});
    return { key: segs.join('/'), segs, name: segs[0] && !segs[0].startsWith(':') ? segs[0] : segs.join('/'),
      load: def.load, params: def.params || {} };
  });
  opts = { fallback, transition: typeof transition === 'function' ? transition : null, root,
    beforeSwap: typeof beforeSwap === 'function' ? beforeSwap : null };
  if (!started) {
    started = true;
    window.addEventListener('hashchange', () => { render(); });
  }
  let hash = initial ? toHash(initial) : location.hash;
  if (!parse(hash).entry) hash = toHash(fallback);
  setEntry(hash, true, depth());                 /* rechargement : on garde la profondeur d'historique */
  return render(true);
}

/* go('home') · go('play/tables?mode=balade') · go('play/tables', { query: { mode: 'balade' }, replace: true }) */
export function go(path, { replace = false, query = null } = {}) {
  const hash = toHash(path, query);
  if (hash === location.hash) return render(true);           /* même écran : on le remonte */
  setEntry(hash, replace, replace ? depth() : depth() + 1);
  return render();
}

/* retour dans l'appli ; depuis la première entrée : écran de repli (l'appli ne se ferme pas) */
export function back() {
  if (depth() > 0) { history.back(); return; }
  go(opts.fallback, { replace: true });
}

export function current() {
  if (!cur) return null;
  const { path, name, route, params, query, hash } = cur;
  return { path, name, route, params: { ...params }, query: { ...query }, hash };
}

/* fn(current()) après chaque écran monté → désabonnement */
export function onChange(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setEntry(hash, replace, idx) {
  try {
    if (replace) history.replaceState({ caramel: idx }, '', hash);
    else history.pushState({ caramel: idx }, '', hash);
  } catch (_) { location.hash = hash; }
}

/* ---------- rendu ---------- */
function rootEl() {
  return (opts.root && (typeof opts.root === 'string' ? document.querySelector(opts.root) : opts.root))
    || document.getElementById('app') || document.body;
}

async function render(force = false) {
  const r = parse(location.hash);
  if (!r.entry) {
    if (parse(opts.fallback).entry) return go(opts.fallback, { replace: true });
    return swap(view => oops(view, r), r, ++token);           /* même le repli manque : écran de secours */
  }
  if (!force && mounted && mounted.hash === r.hash && mounted.view.isConnected) return;
  const my = ++token;
  let screen = null, error = null;
  try {
    const mod = await r.entry.load();
    screen = mod && mod.default ? mod.default : mod;
    if (!screen || typeof screen.mount !== 'function') throw new Error('écran sans mount() : ' + r.route);
  } catch (e) { error = e; }
  if (my !== token) return;                                   /* une navigation plus récente a pris la main */
  await swap(async view => {
    if (error) throw error;
    mounted.screen = screen;
    await mountWithin(screen, view, r);
  }, r, my);
  if (my !== token) return;
  cur = r;
  listeners.forEach(fn => { try { fn(current()); } catch (e) { console.error(e); } });
}

/* démonte l'écran courant, vide #app, monte le suivant — dans une transition de vue si elle est fournie */
async function swap(fill, r, my) {
  let updating = null;
  const update = () => {
    if (!updating) updating = my === token ? doUpdate() : Promise.resolve();
    return updating;
  };
  async function doUpdate() {
    if (typeof opts.beforeSwap === 'function') { try { opts.beforeSwap(r); } catch (e) { console.error('beforeSwap', e); } }
    unmountCurrent();
    const host = rootEl();
    while (host.firstChild) host.removeChild(host.firstChild);
    const view = document.createElement('div');
    view.className = 'view';
    host.appendChild(view);
    mounted = { screen: null, view, hash: r.hash };
    try { document.title = 'Caramel'; } catch (_) {}
    try {
      await fill(view);
    } catch (e) {
      console.error('Écran « ' + (r.route || r.path) + ' » :', e);
      safeUnmount(mounted && mounted.view === view ? mounted.screen : null);
      if (mounted && mounted.view === view) mounted.screen = null;
      oops(view, r);
    }
    try { window.scrollTo(0, 0); } catch (_) {}
    settle(view, r, my);
  }
  if (opts.transition) {
    try {
      const res = opts.transition(update);
      /* la transition peut appeler update plus tard (startViewTransition) : on l'attend, sans s'y fier */
      await Promise.race([
        Promise.resolve(res && res.updateCallbackDone ? res.updateCallbackDone : res).catch(() => {}),
        new Promise(ok => setTimeout(ok, TRANSITION_WAIT_MS))
      ]);
    } catch (e) { console.error('transition', e); }
  }
  await update();
}

async function mountWithin(screen, view, r) {
  let waiting = true, settled = false;
  const p = Promise.resolve().then(() => screen.mount(view, { ...r.params }, { ...r.query }));
  p.then(() => { settled = true; }, err => {
    settled = true;
    if (waiting) return;                                      /* erreur précoce : relancée plus bas */
    if (mounted && mounted.view === view) {                   /* erreur tardive : écran de secours */
      console.error('Écran « ' + (r.route || r.path) + ' » :', err);
      safeUnmount(screen);
      mounted.screen = null;
      oops(view, r);
    }
  });
  /* on n'attend qu'un court instant la fin d'un mount asynchrone (la transition ne doit pas figer l'écran) */
  await Promise.race([p.catch(() => {}), new Promise(ok => setTimeout(ok, MOUNT_WAIT_MS))]);
  waiting = false;
  if (settled) await p;
}

/* titre lisible d'un <h1> : sans ses emoji décoratifs (aria-hidden) */
function headingText(t) {
  const c = t.cloneNode(true);
  for (const n of c.querySelectorAll('[aria-hidden="true"]')) n.remove();
  return c.textContent.replace(/\s+/g, ' ').trim();
}
function settle(view, r, my) {
  const run = () => {
    if (my !== token || !view.isConnected) return true;
    const t = view.querySelector('h1');
    if (!t) return false;
    try {
      const name = headingText(t);
      if (name && r.name !== opts.fallback && document.title === 'Caramel') document.title = name + ' · Caramel';
    } catch (_) {}
    const a = document.activeElement;
    if (!a || a === document.body || !a.isConnected) {
      if (!t.hasAttribute('tabindex')) t.tabIndex = -1;
      try { t.focus({ preventScroll: true }); } catch (_) {}
    }
    return true;
  };
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : f => setTimeout(f, 16);
  raf(() => { if (!run()) setTimeout(run, MOUNT_WAIT_MS); });   /* écran encore en cours de montage : un 2e essai */
}

function safeUnmount(screen) {
  try { if (screen && typeof screen.unmount === 'function') screen.unmount(); }
  catch (e) { console.error('unmount', e); }
}
function unmountCurrent() {
  if (!mounted) return;
  safeUnmount(mounted.screen);
  mounted = null;
}

/* écran de secours lisible (« Oups… ») : l'appli ne plante jamais */
function oops(view, r) {
  while (view.firstChild) view.removeChild(view.firstChild);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  const box = el('div', 'screen oops');
  box.setAttribute('role', 'alert');
  const emoji = el('div', 'oops-emoji', '🐴');
  emoji.setAttribute('aria-hidden', 'true');
  const retry = el('button', 'btn', 'Réessayer 🔄');
  retry.type = 'button';
  /* un module qui n'a pas pu se charger reste en échec jusqu'au rechargement de la page */
  retry.addEventListener('click', () => { try { location.reload(); } catch (_) {} });
  const home = el('button', 'btn white', 'Retour à l’accueil 🏠');
  home.type = 'button';
  home.addEventListener('click', () => go(opts.fallback, { replace: true }));
  if (!r || r.name === opts.fallback || !parse(opts.fallback).entry) home.hidden = true;
  const actions = el('div', 'oops-actions');
  actions.append(retry, home);
  box.append(emoji, el('h1', 'title', 'Oups…'),
    el('p', 'subtitle', 'Cet écran n’a pas pu s’ouvrir. Vérifie la connexion, puis réessaie.'), actions);
  view.appendChild(box);
}
