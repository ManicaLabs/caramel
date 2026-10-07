/* ============ JOURNAL DE DIAGNOSTIC (v2.2.3, demande du parent du 06/10/2026) ============
   « Prévois un mode débug : si je l'active, ça enregistre ce qu'il se passe et je peux exporter des logs. »
   Activé par un parent (espace parents › État de cet appareil), pour CET appareil seulement (localStorage
   FLAG_KEY) : chaque module y note ses événements (micro : démarrage, santé, ce qui a été entendu ; jeux : décisions ;
   erreurs JavaScript), gardés entre deux ouvertures (LOG_KEY, borné à MAX_ENTRIES événements et MAX_CHARS caractères :
   les plus anciens partent d'abord). Jamais de son, jamais de photo ; les prénoms des profils sont masqués à
   l'export (exportText({ names })). Désactivé : dlog() ne coûte qu'une lecture de variable.
   Importable dans Node : aucun accès au navigateur au chargement (les tests passent un faux stockage).
   API : enabled() ; setEnabled(on) ; dlog(catégorie, message, données?) ; entries() ; clear() ;
     exportText({ names, header }) → texte ; fileName(date) ; scrub(texte, names) (pur) ; _setStorage(st) (tests) */

const G = globalThis;
export const FLAG_KEY = 'caramel-debug';
export const LOG_KEY = 'caramel-debug-log';
export const MAX_ENTRIES = 4000;
export const MAX_CHARS = 600000;                     /* ≈ 1,2 Mo dans le localStorage (UTF-16) : la sauvegarde des profils reste à l'aise */
const SAVE_MS = 1500;

let storage = null;
let on = null, buf = null, saveTimer = 0, hooked = false, size = 0;

const ls = () => { if (storage) return storage; try { return G.localStorage || null; } catch (_) { return null; } };
export function _setStorage(st) { storage = st; on = null; buf = null; size = 0; }

export function enabled() {
  if (on === null) { try { const st = ls(); on = !!st && st.getItem(FLAG_KEY) === '1'; } catch (_) { on = false; } }
  return on;
}

function load() {
  if (buf) return buf;
  buf = [];
  try {
    const raw = ls() && ls().getItem(LOG_KEY);
    const v = raw ? JSON.parse(raw) : [];
    if (Array.isArray(v)) buf = v.filter(e => e && typeof e.t === 'number');
  } catch (_) { buf = []; }
  size = buf.reduce((n, e) => n + lineSize(e), 0);
  return buf;
}
const lineSize = e => 40 + String(e.m || '').length + (e.d ? JSON.stringify(e.d).length : 0);

function save() {
  saveTimer = 0;
  if (!buf) return;
  try { const st = ls(); if (st) st.setItem(LOG_KEY, JSON.stringify(buf)); }
  catch (_) {
    /* stockage plein : on garde la moitié la plus récente */
    buf = buf.slice(Math.floor(buf.length / 2));
    size = buf.reduce((n, e) => n + lineSize(e), 0);
    try { const st = ls(); if (st) st.setItem(LOG_KEY, JSON.stringify(buf)); } catch (_) {}
  }
}
function schedule() {
  if (saveTimer) return;
  try { saveTimer = setTimeout(save, SAVE_MS); } catch (_) { save(); }
}
/* page cachée (appli fermée, écran éteint) : le journal est écrit tout de suite */
function flush() { if (saveTimer) { try { clearTimeout(saveTimer); } catch (_) {} } save(); }

/* données : nombres arrondis, textes raccourcis, rien de lourd */
function tidy(d, depth = 0) {
  if (d === null || d === undefined) return d;
  if (typeof d === 'number') return Number.isFinite(d) ? Math.round(d * 1000) / 1000 : String(d);
  if (typeof d === 'string') return d.length > 300 ? d.slice(0, 300) + '…' : d;
  if (typeof d === 'boolean') return d;
  if (depth > 3) return '…';
  if (Array.isArray(d)) return d.slice(0, 40).map(x => tidy(x, depth + 1));
  if (typeof d === 'object') {
    const o = {};
    for (const k of Object.keys(d).slice(0, 40)) { const v = tidy(d[k], depth + 1); if (v !== undefined) o[k] = v; }
    return o;
  }
  return String(d);
}

export function dlog(cat, msg, data) {
  if (!enabled()) return;
  const b = load();
  const e = { t: Date.now(), c: String(cat || '').slice(0, 20), m: String(msg || '').slice(0, 400) };
  if (data !== undefined) e.d = tidy(data);
  b.push(e);
  size += lineSize(e);
  while (b.length > MAX_ENTRIES || (size > MAX_CHARS && b.length > 1)) size -= lineSize(b.shift());
  schedule();
}

function hookErrors() {
  if (hooked || !G.addEventListener) return;
  hooked = true;
  try {
    G.addEventListener('error', ev => dlog('erreur', String((ev && (ev.message || (ev.error && ev.error.message))) || 'erreur'),
      ev && ev.filename ? { où: String(ev.filename).split('/').slice(-2).join('/') + ':' + ev.lineno } : undefined));
    G.addEventListener('unhandledrejection', ev => dlog('erreur', 'promesse rejetée : ' + String(ev && ev.reason && (ev.reason.message || ev.reason))));
    const doc = G.document;
    if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', () => { dlog('appli', doc.hidden ? 'page cachée' : 'page visible'); if (doc.hidden) flush(); });
    /* console.error des modules (« tables », « speech onText »…) */
    const c = G.console;
    if (c && typeof c.error === 'function') {
      const orig = c.error.bind(c);
      c.error = (...a) => { try { if (enabled()) dlog('console', a.map(x => (x && x.message) || String(x)).join(' ').slice(0, 400)); } catch (_) {} orig(...a); };
    }
  } catch (_) {}
}
/* au chargement de l'appli (js/main.js) : branche les erreurs si le mode est déjà actif */
export function init() { if (enabled()) hookErrors(); }

export function setEnabled(v) {
  const st = ls();
  on = !!v;
  try { if (st) { if (on) st.setItem(FLAG_KEY, '1'); else st.removeItem(FLAG_KEY); } } catch (_) {}
  if (on) { hookErrors(); dlog('appli', 'mode diagnostic activé'); }
  else { flush(); }
  return on;
}

export function entries() { return load().slice(); }
export function clear() {
  buf = []; size = 0;
  try { const st = ls(); if (st) st.removeItem(LOG_KEY); } catch (_) {}
  if (enabled()) dlog('appli', 'journal effacé');
}

/* prénoms → « ‹prénom› » (mots entiers, sans tenir compte de la casse ni des accents écrits pareil) */
export function scrub(text, names = []) {
  let s = String(text || '');
  for (const n of names) {
    const w = String(n || '').trim();
    if (w.length < 2) continue;
    const re = new RegExp('(^|[^\\p{L}])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}])', 'giu');
    s = s.replace(re, '$1‹prénom›');
  }
  return s;
}

const pad = (n, w = 2) => String(n).padStart(w, '0');
function stamp(t) {
  const d = new Date(t);
  return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + pad(d.getMilliseconds(), 3);
}
export function fileName(date = new Date()) {
  return 'caramel-journal-' + date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + '-' +
    pad(date.getHours()) + 'h' + pad(date.getMinutes()) + '.txt';
}

/* le journal en texte : en-tête (appareil, version…) puis une ligne par événement, jour par jour */
export function exportText({ names = [], header = {} } = {}) {
  const lines = ['Journal de diagnostic de Caramel', ''];
  for (const [k, v] of Object.entries(header)) lines.push(k + ' : ' + (typeof v === 'string' ? v : JSON.stringify(v)));
  lines.push('');
  let day = '';
  for (const e of load()) {
    const d = new Date(e.t);
    const dd = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    if (dd !== day) { day = dd; lines.push('— ' + dd + ' —'); }
    lines.push(stamp(e.t) + ' [' + e.c + '] ' + e.m + (e.d !== undefined ? ' ' + JSON.stringify(e.d) : ''));
  }
  if (!load().length) lines.push('(journal vide)');
  return scrub(lines.join('\n'), names);
}
