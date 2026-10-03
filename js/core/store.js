/* ============ STORE : données caramel-v3 (singleton en mémoire, contrat §4) ============
   init() charge via migrate (v1 / v11 → v3), puis chaque commit() écrit le JSON de façon synchrone
   (try/catch) et notifie les abonnés. Les écrans lisent getProfile() et écrivent UNIQUEMENT via
   mutateProfile / la manche. Écriture impossible (quota, navigation privée) → l'app continue en mémoire.
   Testable sous Node avec un stockage injecté (tests/_t.mjs : memoryStorage). */

import { dayStr } from './util.js';
import { migrate, normalizeData, emptyData, KEY } from './migrate.js';
import { normalizeProfile, newProfileId } from './profiles.js';

let storage = null;          /* stockage injecté (localStorage par défaut) ou null */
let data = null;             /* objet caramel-v3 vivant */
let readOnly = false;        /* stockage illisible au démarrage : on n'écrase rien */
let lastWrite = null;        /* résultat de la dernière écriture (null = aucune encore) */
const subs = new Set();

const has = (o, k) => o !== null && o !== undefined && Object.prototype.hasOwnProperty.call(o, k);

/* localStorage peut lever une SecurityError rien qu'à l'accès (cookies bloqués) */
function defaultStorage() {
  try { return globalThis.localStorage || null; } catch (_) { return null; }
}

/* démarrage : migration puis données en mémoire → { data, report } */
export function init(st = defaultStorage(), today = dayStr()) {
  const res = migrate(st, today);
  storage = st || null;
  data = res.data;
  readOnly = !!res.report.readOnly;
  lastWrite = null;
  return res;
}

/* appel avant init() : données vides en mémoire (jamais d'exception) */
export function getData() {
  if (!data) data = emptyData(dayStr());
  return data;
}

export function getProfile(id = getData().active) {
  const d = getData();
  return id !== null && id !== undefined && has(d.profiles, id) ? d.profiles[id] : null;
}

/* ordre de création (puis numéro d'id : p1, p2…) */
function sortedIds(d) {
  const numOf = id => { const m = /^p(\d+)$/.exec(id); return m ? Number(m[1]) : Infinity; };
  return Object.keys(d.profiles).sort((a, b) => {
    const ca = d.profiles[a].created || '', cb = d.profiles[b].created || '';
    if (ca !== cb) return ca < cb ? -1 : 1;
    return (numOf(a) - numOf(b)) || (a < b ? -1 : a > b ? 1 : 0);
  });
}
export function listProfiles() {
  const d = getData();
  return sortedIds(d).map(id => d.profiles[id]);
}

/* profil actif (id existant uniquement) → true si accepté */
export function setActive(id) {
  const d = getData();
  if (!has(d.profiles, id)) return false;
  if (d.active !== id) { d.active = id; commit(); }
  return true;
}

/* notification des abonnés : une erreur d'abonné n'empêche pas les autres ;
   un commit déclenché pendant la notification relance un tour (borné) */
let notifying = false, again = false;
function notify() {
  if (notifying) { again = true; return; }
  notifying = true;
  try {
    let rounds = 0;
    do {
      again = false;
      for (const fn of [...subs]) { try { fn(data); } catch (e) { try { console.error('store : abonné', e); } catch (_) {} } }
    } while (again && ++rounds < 10);
  } finally { notifying = false; again = false; }
}

/* persiste (try/catch) puis notifie → true si l'écriture a réussi */
export function commit() {
  const d = getData();
  let ok = false;
  if (storage && !readOnly) {
    try { storage.setItem(KEY, JSON.stringify(d)); ok = true; } catch (_) { ok = false; }
  }
  lastWrite = ok;
  notify();
  return ok;
}

/* fn(data) puis commit (même si fn lève : l'exception est relancée après) ; renvoie le résultat de fn */
export function mutate(fn) {
  const d = getData();
  let r;
  try { r = fn(d); } finally { commit(); }
  return r;
}

/* fn(profil) puis commit ; aucun profil → rien (undefined) */
export function mutateProfile(fn, id = getData().active) {
  const p = getProfile(id);
  if (!p) return undefined;
  let r;
  try { r = fn(p); } finally { commit(); }
  return r;
}

/* ajoute une copie normalisée du profil, qui devient actif → id (relire via getProfile(id)) */
export function addProfile(profile) {
  const d = getData();
  const wanted = profile && typeof profile.id === 'string' ? profile.id : '';
  const id = /^p\d+$/.test(wanted) && !has(d.profiles, wanted) ? wanted : newProfileId(d);
  const p = normalizeProfile({ ...(profile && typeof profile === 'object' ? profile : {}), id }, dayStr());
  p.id = id;
  d.profiles[id] = p;
  d.active = id;
  commit();
  return id;
}

/* supprime un profil ; l'actif passe au premier profil restant, ou null */
export function removeProfile(id) {
  const d = getData();
  if (!has(d.profiles, id)) return false;
  delete d.profiles[id];
  if (d.active === id || !has(d.profiles, d.active)) d.active = sortedIds(d)[0] || null;
  commit();
  return true;
}

/* import « remplacer tout » : objet caramel-v3 normalisé ; refusé (false) s'il n'a pas de profils */
export function replaceData(newData) {
  const ok = newData && typeof newData === 'object' && !Array.isArray(newData) &&
             newData.profiles && typeof newData.profiles === 'object' && !Array.isArray(newData.profiles);
  if (!ok) return false;
  data = normalizeData(newData, dayStr());
  commit();
  return true;
}

export function subscribe(fn) {
  if (typeof fn !== 'function') return () => {};
  subs.add(fn);
  return () => { subs.delete(fn); };
}

/* état du stockage (bandeau « sauvegarde impossible » côté parents) :
   false si aucun stockage, lecture impossible au démarrage, ou dernière écriture en échec */
export function storageOk() {
  return !!storage && !readOnly && lastWrite !== false;
}
