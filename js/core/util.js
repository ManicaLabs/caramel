/* ============ UTILITAIRES PARTAGÉS ============
   Aucune dépendance. Importable dans Node : aucun accès à window/document au chargement
   (les helpers DOM n'y touchent qu'à l'appel). */

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const round1 = v => Math.round(v * 10) / 10;
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const now = () => Date.now();

/* ---------- Dates locales (AAAA-MM-JJ, comme dayStr v11) ---------- */
const pad2 = n => String(n).padStart(2, '0');
export function dayStr(d = new Date()) {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
export function monthStr(d = new Date()) { return dayStr(d).slice(0, 7); }
/* minuit local du jour donné */
export function parseDay(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function addDays(s, n) {
  const d = parseDay(s);
  d.setDate(d.getDate() + n);
  return dayStr(d);
}
/* nombre de jours de a vers b (b − a), en jours calendaires locaux */
export function daysBetween(a, b) {
  if (!a || !b) return Infinity;
  return Math.round((parseDay(b) - parseDay(a)) / 86400000);
}
/* semaine ISO : '2026-W40' */
export function weekKey(s = dayStr()) {
  const d = parseDay(typeof s === 'string' ? s : dayStr(s));
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = t.getUTCDay() || 7;                 /* lundi = 1 … dimanche = 7 */
  t.setUTCDate(t.getUTCDate() + 4 - dow);         /* jeudi de la même semaine */
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return t.getUTCFullYear() + '-W' + pad2(week);
}

/* ---------- Nombres à la française ---------- */
const NNBSP = '\u202f';   /* espace fine insécable */
/* 1234567.5 → '1 234 567,5' ; decimals = nombre fixe de décimales (sinon minimal) */
export function fmtNum(n, decimals) {
  if (typeof n !== 'number' || !isFinite(n)) return String(n);
  let s = decimals === undefined ? String(Math.round(n * 1e6) / 1e6) : n.toFixed(decimals);
  let neg = s.startsWith('-'); if (neg) s = s.slice(1);
  let [ip, dp] = s.split('.');
  ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  return (neg ? '−' : '') + ip + (dp ? ',' + dp : '');
}
/* '3,25' | '3.25' | '1 000' → nombre (NaN si invalide) */
export function parseNum(str) {
  const s = String(str).trim().replace(/[\s\u00a0\u202f]/g, '').replace(',', '.').replace('−', '-');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}
/* typographie française : espace fine insécable avant ; : ! ? » et après « */
export function frTypo(s) {
  return String(s)
    .replace(/\s*([!?;:»])/g, NNBSP + '$1')
    .replace(/«\s*/g, '«' + NNBSP);
}

/* ---------- Divers ---------- */
export function uid(prefix = 'p') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
export function safeJSON(str, fallback = null) {
  try { const v = JSON.parse(str); return v === undefined ? fallback : v; } catch (_) { return fallback; }
}
export function deepClone(o) {
  try { return structuredClone(o); } catch (_) { return JSON.parse(JSON.stringify(o)); }
}
export function median(arr) {
  if (!arr || !arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
export function capFirst(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
/* prénom → fragment de nom de fichier ASCII ('Léa Martin' → 'lea-martin') */
export function slug(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'profil';
}

/* ---------- DOM (uniquement à l'appel) ---------- */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const SVG_NS = 'http://www.w3.org/2000/svg';
function build(el, attrs, children) {
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
      else if (k === 'html') el.innerHTML = v;        /* contenu de confiance uniquement */
      else if (k === 'text') el.textContent = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  const add = c => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) return c.forEach(add);
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return el;
}
/* h('button', { class:'btn', on:{ click: fn } }, 'Texte', h('span', null, '🍎')) */
export function h(tag, attrs, ...children) { return build(document.createElement(tag), attrs, children); }
export function svg(tag, attrs, ...children) { return build(document.createElementNS(SVG_NS, tag), attrs, children); }
export const $ = (sel, root) => (root || document).querySelector(sel);
export const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
export function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }

const cssLoaded = new Map();
/* charge une feuille de style une seule fois ; résout quand elle est appliquée */
export function loadCSS(href) {
  if (cssLoaded.has(href)) return cssLoaded.get(href);
  const p = new Promise(res => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    l.onload = () => res(true); l.onerror = () => res(false);
    document.head.appendChild(l);
  });
  cssLoaded.set(href, p);
  return p;
}
/* téléchargement d'un fichier (Blob + a[download]) */
export function download(filename, content, mime = 'application/json') {
  try {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (_) { return false; }
}
/* vibration courte si disponible (retour haptique doux) */
export function buzz(ms = 30) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {} }
