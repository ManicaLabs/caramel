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

/* ---------- Français : élision et listes (ajouts v2.1) ---------- */
/* « de » + nom, élidé devant une voyelle : deNom('Inès') → 'd’Inès', deNom('Zoé') → 'de Zoé',
   deNom('octobre 2026') → 'd’octobre 2026'. Y suivi d'une voyelle se prononce comme une consonne
   (« de Yanis ») ; jamais d'élision devant h (« de Hugo » reste correct, h muet ou aspiré).
   Uniquement pour les textes lus à l'écran : les textes lus à voix haute n'élident pas (CDC §16). */
const VOWEL = 'aeiouàâäéèêëîïôöùûüœæ';
export function deNom(s) {
  const t = String(s ?? '').trim();
  const c0 = t.charAt(0).toLowerCase(), c1 = t.charAt(1).toLowerCase();
  const elide = VOWEL.includes(c0) || (c0 === 'y' && c1 !== '' && !VOWEL.includes(c1));
  return (elide && c0 ? 'd’' : 'de ') + t;
}
/* « a », « a et b », « a, b et c » */
export function frList(items) {
  const a = (Array.isArray(items) ? items : []).filter(x => x !== null && x !== undefined && x !== '').map(String);
  if (a.length <= 1) return a.join('');
  return a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1];
}
/* accord d'un participe ou d'un adjectif régulier (ajout v2.2) : accorde('porté', { f: true }) → 'portée',
   accorde('porté', { f: true, pl: true }) → 'portées', accorde('choisi', { f: true }) → 'choisie' */
export function accorde(mot, { f = false, pl = false } = {}) {
  return String(mot ?? '') + (f ? 'e' : '') + (pl ? 's' : '');
}

/* ---------- SHA-256 (ajout v2.1 : code parent haché, jamais en clair) ---------- */
const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];
const H256 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
const ror32 = (x, n) => (x >>> n) | (x << (32 - n));
const utf8 = s => new TextEncoder().encode(String(s ?? ''));
/* calcul en JavaScript (repli quand crypto.subtle manque : page hors https) → hexadécimal */
export function sha256HexSync(input) {
  const msg = input instanceof Uint8Array ? input : utf8(input);
  const len = msg.length;
  const buf = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  buf.set(msg);
  buf[len] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(buf.length - 4, (len * 8) >>> 0);
  dv.setUint32(buf.length - 8, Math.floor(len / 0x20000000));
  const H = H256.slice();
  const W = new Uint32Array(64);
  for (let off = 0; off < buf.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = W[i - 15], b = W[i - 2];
      W[i] = (W[i - 16] + (ror32(a, 7) ^ ror32(a, 18) ^ (a >>> 3)) + W[i - 7] + (ror32(b, 17) ^ ror32(b, 19) ^ (b >>> 10))) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (ror32(e, 6) ^ ror32(e, 11) ^ ror32(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + W[i]) >>> 0;
      const t2 = ((ror32(a, 2) ^ ror32(a, 13) ^ ror32(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return H.map(x => x.toString(16).padStart(8, '0')).join('');
}
/* SHA-256 d'une chaîne (UTF-8) → Promise<hexadécimal> : crypto.subtle quand il existe, sinon le calcul
   ci-dessus (même résultat : un code choisi en https se vérifie aussi hors https) */
export async function sha256Hex(str) {
  const bytes = utf8(str);
  try {
    const subtle = globalThis.crypto && globalThis.crypto.subtle;
    if (subtle && typeof subtle.digest === 'function') {
      const out = new Uint8Array(await subtle.digest('SHA-256', bytes));
      return Array.from(out, x => x.toString(16).padStart(2, '0')).join('');
    }
  } catch (_) { /* repli ci-dessous */ }
  return sha256HexSync(bytes);
}
