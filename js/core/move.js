/* ============ DÉMÉNAGEMENT VERS caramel.manica.fr (v2.4, décision du parent du 07/10/2026) ============
   Caramel quitte https://cdelalande38.github.io/caramel/ pour https://caramel.manica.fr/ (dépôt ManicaLabs/caramel).
   Les progrès vivent dans le stockage du navigateur, lié à l'ADRESSE : une simple redirection les laisserait derrière
   (et un domaine posé sur l'ancien dépôt figerait les applis installées, sans mise à jour possible). D'où un
   déménagement en deux temps, l'ancienne adresse restant en ligne :
     1. Ancienne adresse (MOVE_ON allumé une fois la nouvelle vérifiée : DNS, HTTPS, service worker) : l'écran
        « Caramel déménage ! 🏡 » (js/ui/move.js). Un toucher emballe les progrès (pack) et ouvre la nouvelle adresse avec
        le paquet APRÈS le # (moveUrl) : cette partie de l'adresse n'est jamais envoyée à un serveur, elle reste dans le
        téléphone. Rien n'est effacé ici ; MOVED_KEY retient que c'est fait (« Ouvrir Caramel ▶ » ensuite).
     2. Nouvelle adresse (toujours prête, sans danger ailleurs) : arrive(store) au démarrage lit le paquet, l'efface aussitôt
        de l'adresse (history.replaceState), puis range les progrès : appareil vide → tout de suite ; paquet déjà reçu
        (ARRIVED_KEY) → rien ; des progrès différents déjà ici → l'adulte choisit (js/main.js : kit.confirmSheet).
   Emporté (MOVE_KEYS) : les profils (caramel-v3, revus par backup.replaceAll), l'espace parents (code haché, dates des
   sauvegardes), les préférences du défi et de « Avec un copain ». Pas le reste (journal de diagnostic, caches, modèles
   du micro et de la voix : retéléchargés par le préchargement).
   Paquet : { f: 'caramel-move', v: 1, id, at, from, keys: { clé: texte brut } } en JSON, compressé (deflate-raw) si
   le navigateur sait le faire, en base64url ; préfixe « z. » (compressé) ou « j. » (JSON seul).
   Essai sans le vrai domaine : sessionStorage TEST_KEY = '{"to":"http://…/caramel/"}' fait de la page une ancienne
   adresse qui déménage vers « to » (tests de bout en bout).
   Limite connue : iPhone et iPad avec Caramel sur l'écran d'accueil — l'appli installée a son propre stockage, séparé de
   Safari : le paquet arrive dans Safari, pas dans la future appli installée. Là, une sauvegarde (espace parents) fait le
   trajet. */

export const NEW_HOME = 'https://caramel.manica.fr/';
export const OLD_HOSTS = Object.freeze(['cdelalande38.github.io']);
export const MOVE_ON = false;                      /* allumé quand caramel.manica.fr est vérifiée */
export const MOVE_KEYS = Object.freeze(['caramel-v3', 'caramel-parent', 'caramel-duel-prefs', 'caramel-battle-prefs']);
export const MOVED_KEY = 'caramel-moved';          /* ancienne adresse : { at, id } — déménagement fait (rien d'effacé) */
export const ARRIVED_KEY = 'caramel-arrived';      /* nouvelle adresse : identifiants des paquets déjà rangés */
export const LATER_KEY = 'caramel-move-later';     /* sessionStorage : « Plus tard » (l'appli marche comme avant) */
export const TEST_KEY = 'caramel-move-test';       /* sessionStorage : essai de bout en bout ({ to }) */
export const PARAM = 'demenagement';
export const FORMAT = 'caramel-move';

const G = globalThis;
const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
const sessionStore = () => { try { return G.sessionStorage || null; } catch (_) { return null; } };
const localStore = () => { try { return G.localStorage || null; } catch (_) { return null; } };
const read = (st, k) => { try { return st ? st.getItem(k) : null; } catch (_) { return null; } };
const write = (st, k, v) => { try { if (st) st.setItem(k, v); return !!st; } catch (_) { return false; } };
const parse = t => { try { return JSON.parse(t); } catch (_) { return null; } };

/* ---------- où sommes-nous ? ---------- */
function testTarget(ss = sessionStore()) {
  const t = parse(read(ss, TEST_KEY));
  return isObj(t) && typeof t.to === 'string' && /^https?:\/\//.test(t.to) ? t.to : null;
}
/* adresse à rejoindre (le vrai domaine, ou celle de l'essai) */
export const target = (ss = sessionStore()) => testTarget(ss) || NEW_HOME;
/* cette page est-elle l'ancienne maison ? */
export function isOldHome(loc = G.location, ss = sessionStore()) {
  if (testTarget(ss)) return true;
  try { return OLD_HOSTS.includes(loc.host); } catch (_) { return false; }
}
/* faut-il montrer l'écran du déménagement ? (ancienne adresse, déménagement allumé, pas « Plus tard » dans cette séance) */
export function wanted({ loc = G.location, ss = sessionStore(), on = MOVE_ON } = {}) {
  if (!isOldHome(loc, ss)) return false;
  if (!on && !testTarget(ss)) return false;
  return !read(ss, LATER_KEY);
}
export function later(ss = sessionStore()) { write(ss, LATER_KEY, '1'); }
export function moved(ls = localStore()) { const m = parse(read(ls, MOVED_KEY)); return isObj(m) ? m : null; }

/* ---------- base64url ---------- */
function toB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return G.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s) {
  const b = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = G.atob(b + '='.repeat((4 - (b.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function through(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}
const canZip = () => typeof G.CompressionStream === 'function' && typeof G.DecompressionStream === 'function' && typeof G.Response === 'function';

/* ---------- paquet ---------- */
const newId = () => {
  try { const a = new Uint8Array(6); G.crypto.getRandomValues(a); return toB64url(a); } catch (_) { return Math.random().toString(36).slice(2, 10); }
};
/* clés à emporter → objet paquet (pur) */
export function bundle(entries, { now = new Date(), from = '', id = newId() } = {}) {
  const keys = {};
  for (const k of MOVE_KEYS) if (typeof entries[k] === 'string' && entries[k]) keys[k] = entries[k];
  return { f: FORMAT, v: 1, id, at: now.toISOString(), from, keys };
}
/* paquet → texte pour l'adresse (« z.… » compressé, sinon « j.… ») */
export async function pack(obj, { zip = canZip() } = {}) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (zip) { try { return 'z.' + toB64url(await through(bytes, new G.CompressionStream('deflate-raw'))); } catch (_) {} }
  return 'j.' + toB64url(bytes);
}
/* texte de l'adresse → paquet vérifié, ou null (abîmé, tronqué, autre format) */
export async function unpack(text) {
  try {
    const m = /^([zj])\.([A-Za-z0-9_-]+)$/.exec(String(text || ''));
    if (!m) return null;
    let bytes = fromB64url(m[2]);
    if (m[1] === 'z') { if (!canZip()) return null; bytes = await through(bytes, new G.DecompressionStream('deflate-raw')); }
    const o = JSON.parse(new TextDecoder().decode(bytes));
    if (!isObj(o) || o.f !== FORMAT || o.v !== 1 || typeof o.id !== 'string' || !isObj(o.keys)) return null;
    const keys = {};
    for (const k of MOVE_KEYS) if (typeof o.keys[k] === 'string' && isObj(parse(o.keys[k]))) keys[k] = o.keys[k];
    return keys['caramel-v3'] ? { ...o, keys } : null;
  } catch (_) { return null; }
}
export const moveUrl = (payload, to = target()) => to + '#' + PARAM + '=' + payload;
/* « #demenagement=… » → le texte du paquet, ou null */
export function readHash(hash = G.location ? G.location.hash : '') {
  const m = new RegExp('^#' + PARAM + '=([zj]\\.[A-Za-z0-9_-]+)$').exec(String(hash || ''));
  return m ? m[1] : null;
}

/* ---------- ancienne adresse : emballer et partir ---------- */
/* la nouvelle adresse répond-elle ? (réponse opaque : seule une panne de réseau échoue) */
export function reachable(to = target(), ms = 5000) {
  if (typeof G.fetch !== 'function') return Promise.resolve(true);
  return new Promise(res => {
    const t = setTimeout(() => res(false), ms);
    G.fetch(new URL('manifest.webmanifest', to).href, { mode: 'no-cors', cache: 'no-store' })
      .then(() => { clearTimeout(t); res(true); }, () => { clearTimeout(t); res(false); });
  });
}
export async function leave({ ls = localStore(), loc = G.location, now = new Date() } = {}) {
  const entries = {};
  for (const k of MOVE_KEYS) { const v = read(ls, k); if (v) entries[k] = v; }
  const b = bundle(entries, { now, from: (() => { try { return new URL('./', loc.href).href; } catch (_) { return ''; } })() });
  if (!b.keys['caramel-v3']) return null;
  const url = moveUrl(await pack(b));
  write(ls, MOVED_KEY, JSON.stringify({ at: b.at, id: b.id }));
  return url;
}

/* ---------- nouvelle adresse : ranger ce qui arrive ---------- */
const arrivedIds = ls => { const a = parse(read(ls, ARRIVED_KEY)); return Array.isArray(a) ? a.filter(x => typeof x === 'string') : []; };
function noteArrived(ls, id) { write(ls, ARRIVED_KEY, JSON.stringify([...arrivedIds(ls).filter(x => x !== id), id].slice(-10))); }
/* range le paquet (les profils passent par backup.replaceAll : normalisés, jamais vides) → true si c'est fait */
export function settle(store, backup, pkt, { ls = localStore() } = {}) {
  const d = backup.replaceAll(parse(pkt.keys['caramel-v3']));
  if (!d || !store.replaceData(d)) return false;
  for (const k of MOVE_KEYS) if (k !== 'caramel-v3' && pkt.keys[k]) write(ls, k, pkt.keys[k]);
  noteArrived(ls, pkt.id);
  return true;
}
/* au démarrage, après store.init : → null (rien n'arrive) | { status: 'arrived' | 'already' | 'broken' | 'choose', pkt,
   here: [prénoms d'ici], there: [prénoms qui arrivent], take() } — l'adresse est nettoyée dans tous les cas */
export async function arrive(store, backup, { loc = G.location, hist = G.history, ls = localStore() } = {}) {
  const text = readHash(loc && loc.hash);
  if (!text) return null;
  try { hist.replaceState(null, '', loc.pathname + loc.search + '#/'); } catch (_) {}
  const pkt = await unpack(text);
  if (!pkt) return { status: 'broken' };
  if (arrivedIds(ls).includes(pkt.id)) return { status: 'already', pkt };
  const here = store.listProfiles().map(p => p.name);
  const incoming = parse(pkt.keys['caramel-v3']);
  const there = isObj(incoming) && isObj(incoming.profiles) ? Object.values(incoming.profiles).map(p => (isObj(p) ? p.name : '')).filter(Boolean) : [];
  const take = () => settle(store, backup, pkt, { ls });
  if (!here.length) return { status: take() ? 'arrived' : 'broken', pkt, here, there };
  if (JSON.stringify(store.getData()) === JSON.stringify((backup.replaceAll(incoming)) || null)) { noteArrived(ls, pkt.id); return { status: 'already', pkt }; }
  return { status: 'choose', pkt, here, there, take };
}
