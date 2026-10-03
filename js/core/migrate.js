/* ============ MIGRATION v1 / v11 → caramel-v3 (CDC §13, contrat §3) ============
   Module pur : le stockage est injecté (localStorage ou tout objet getItem / setItem).
   Garanties :
   - idempotent (une 2e exécution ne réécrit rien) ;
   - AUCUNE ancienne clé supprimée (caramel-save-v2, caramel-progress-v1 restent intactes en v2.0) ;
   - copie brute caramel-backup-v11 écrite une seule fois, jamais réécrite ;
   - jamais d'exception vers l'appelant : JSON corrompu → profil vierge, copies brutes conservées.
   La lecture d'une sauvegarde v11 reproduit EXACTEMENT la tolérance de loadSave() v11. */

import { safeJSON, deepClone } from './util.js';
import { MOUNTS } from '../content/companion-data.js';
import { defaultProfile, normalizeProfile, sanitizeName, toDay, DEFAULT_HERO, DEFAULT_MOUNT_NAME } from './profiles.js';
import { totalStars } from './economy.js';

export const KEY = 'caramel-v3', V11 = 'caramel-save-v2', V1 = 'caramel-progress-v1', BACKUP = 'caramel-backup-v11';
/* copie brute d'un caramel-v3 illisible, faite avant de le remplacer (écrite une seule fois) */
export const CORRUPT = 'caramel-v3-corrompu';

/* cibles de Zip (MCLM) des 27 histoires v11 — ids inchangés en v2 */
export const LEGACY_TARGETS = {
  'ce1-carotte': 30, 'ce1-bain': 33, 'ce1-verger': 36, 'ce1-nuit': 39, 'ce1-flaque': 42, 'ce1-cadeau': 45,
  pomme: 40, foret: 44, cirque: 48, plage: 50, feuilles: 52, concours: 54, tresor: 58, pluie: 60,
  neige: 62, montagne: 64, fee: 66, poulain: 68, dragon: 70, etoiles: 74, reve: 78,
  'cm1-orage': 72, 'cm1-course': 78, 'cm1-chouette': 84, 'cm1-riviere': 90, 'cm1-phare': 95, 'cm1-aurore': 100
};

const has = (o, k) => o !== null && o !== undefined && Object.prototype.hasOwnProperty.call(o, k);
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ---------- données vides (installation neuve) ---------- */
export function emptyData(today) {
  return { schema: 3, active: null, migratedFrom: null, created: toDay(today), profiles: {} };
}

/* ---------- estimation de la fluence depuis les étoiles v11 ----------
   max des cibles des histoires à 3 ⭐ ; sinon 0,85 × max des cibles des histoires à 2 ⭐ ; sinon null */
export function estimateFluence(stars) {
  if (!isObj(stars)) return null;
  let max3 = 0, max2 = 0;
  for (const [id, v] of Object.entries(stars)) {
    if (!has(LEGACY_TARGETS, id)) continue;
    const s = Math.min(3, v | 0);
    if (s >= 3) max3 = Math.max(max3, LEGACY_TARGETS[id]);
    else if (s >= 2) max2 = Math.max(max2, LEGACY_TARGETS[id]);
  }
  if (max3) return max3;
  if (max2) return Math.round(0.85 * max2);
  return null;
}

/* ---------- lecture v11 (copie fidèle de defaultSave() + loadSave()) ----------
   Seule différence : pet.last par défaut = 0 au lieu de Date.now() (module pur) ;
   équivalent pour la v11, dont petNow() lit `pet.last || now`. */
function v11Defaults() {
  return { stars: {}, apples: 0, streak: { count: 0, last: '' },
    hero: { name: DEFAULT_HERO, g: 'f' },
    mount: { type: 'pony', name: DEFAULT_MOUNT_NAME, owned: ['pony'] },
    equip: { owned: [], worn: [] },
    pet: { faim: 80, forme: 80, joie: 80, last: 0, brushLast: 0, walkDay: '' } };
}
function loadV11(j) {
  const d = v11Defaults();
  const save = {
    stars: j.stars || {}, apples: Math.max(0, j.apples | 0),
    streak: Object.assign(d.streak, j.streak || {}),
    hero: Object.assign(d.hero, j.hero || {}),
    mount: Object.assign(d.mount, j.mount || {}),
    equip: Object.assign(d.equip, j.equip || {}),
    pet: Object.assign(d.pet, j.pet || {})
  };
  if (!Array.isArray(save.mount.owned) || !save.mount.owned.length) save.mount.owned = ['pony'];
  if (!has(MOUNTS, save.mount.type)) save.mount.type = 'pony';
  return save;
}

/* étoiles : ids conservés tels quels, valeurs 0-3 (Math.min(3, v|0) comme la v11) */
function starsOf(stars) {
  const out = {};
  if (!isObj(stars)) return out;
  for (const [id, v] of Object.entries(stars)) {
    if (!id || BAD_KEYS.has(id)) continue;
    out[id] = Math.max(0, Math.min(3, v | 0));
  }
  return out;
}
const list = v => (Array.isArray(v) ? v.slice() : []);

function fromV11(s, d) {
  /* genre : celui que la v11 affichait (tplMap v11 : hero.g === 'f' → féminin, sinon masculin) */
  const p = defaultProfile({ id: 'p1', name: s.hero.name, g: s.hero.g === 'f' ? 'f' : 'm', classe: null, today: d });
  const c = p.companion;
  c.type = s.mount.type;
  c.name = sanitizeName(s.mount.name, DEFAULT_MOUNT_NAME);
  c.owned = list(s.mount.owned);                              /* ids filtrés par normalizeProfile */
  c.equip = { owned: list(s.equip.owned), worn: list(s.equip.worn) };
  c.pet = { faim: s.pet.faim, forme: s.pet.forme, joie: s.pet.joie,
            last: s.pet.last, brushLast: s.pet.brushLast, walkDay: s.pet.walkDay };
  p.wallet = { apples: s.apples, stars: starsOf(s.stars) };
  /* série reprise + 1 gel offert */
  p.streak = { count: Math.max(0, s.streak.count | 0),
               last: typeof s.streak.last === 'string' && DAY_RE.test(s.streak.last) ? s.streak.last : '',
               freezes: 1, freezeWeek: '' };
  p.legacy = { from: 'v11', mclm: estimateFluence(p.wallet.stars), stars: totalStars(p) };
  return p;
}

function validV1(v1) { return isObj(v1) && isObj(v1.stars); }

function fromV1(v1, d) {
  const p = defaultProfile({ id: 'p1', classe: null, today: d });
  p.wallet.stars = starsOf(v1.stars);
  const tot = totalStars(p);
  p.wallet.apples = tot * 10;                                 /* rétro-crédit v11 : 10 🍎 par étoile */
  p.streak.freezes = 1;
  p.legacy = { from: 'v1', mclm: estimateFluence(p.wallet.stars), stars: tot };
  return p;
}

/* ---------- construction pure depuis les anciennes sauvegardes ----------
   v11 / v1 : objets déjà parsés ou null. v11 fait foi s'il est valide (la v11 avait déjà migré v1).
   Aucune source valide → profil vierge, migratedFrom = corrupt + '-corrompu' ('v11' par défaut). */
export function buildFromLegacy({ v11 = null, v1 = null, today, corrupt = 'v11' } = {}) {
  const d = toDay(today);
  let from, p;
  if (isObj(v11)) { from = 'v11'; p = fromV11(loadV11(v11), d); }
  else if (validV1(v1)) { from = 'v1'; p = fromV1(v1, d); }
  else { from = (corrupt === 'v1' ? 'v1' : 'v11') + '-corrompu'; p = defaultProfile({ id: 'p1', today: d }); }
  const p1 = normalizeProfile(p, d);
  p1.id = 'p1';
  return { schema: 3, active: 'p1', migratedFrom: from, created: d, profiles: { p1 } };
}

/* ---------- normalisation d'un objet caramel-v3 complet (chargement, import « remplacer tout ») ---------- */
function firstByCreated(profiles) {
  const ids = Object.keys(profiles);
  if (!ids.length) return null;
  const numOf = id => { const m = /^p(\d+)$/.exec(id); return m ? Number(m[1]) : Infinity; };
  ids.sort((a, b) => {
    const ca = profiles[a].created || '', cb = profiles[b].created || '';
    if (ca !== cb) return ca < cb ? -1 : 1;
    return (numOf(a) - numOf(b)) || (a < b ? -1 : a > b ? 1 : 0);
  });
  return ids[0];
}
export function normalizeData(data, today) {
  const d = toDay(today);
  const src = isObj(data) ? data : {};
  const profiles = {};
  if (isObj(src.profiles)) {
    for (const [id, p] of Object.entries(src.profiles)) {
      if (!id || BAD_KEYS.has(id) || !isObj(p)) continue;
      const np = normalizeProfile(p, d);
      np.id = id;                                             /* la clé fait foi */
      profiles[id] = np;
    }
  }
  const active = typeof src.active === 'string' && has(profiles, src.active) ? src.active : firstByCreated(profiles);
  const out = {
    schema: 3,
    active,
    migratedFrom: typeof src.migratedFrom === 'string' ? src.migratedFrom : null,
    created: typeof src.created === 'string' && DAY_RE.test(src.created) ? src.created : d,
    profiles
  };
  for (const k of Object.keys(src)) {                         /* clés inconnues conservées */
    if (has(out, k) || BAD_KEYS.has(k) || src[k] === undefined) continue;
    try { out[k] = deepClone(src[k]); } catch (_) { /* valeur non clonable : ignorée */ }
  }
  return out;
}

/* ---------- accès au stockage (try/catch partout) ---------- */
function makeIO(storage) {
  const io = {
    readFailed: false,
    get(k) {
      if (!storage) return null;
      try { const v = storage.getItem(k); return v === undefined ? null : v; }
      catch (_) { io.readFailed = true; return null; }
    },
    /* aucune écriture si une lecture a échoué : on ne remplace pas ce qu'on n'a pas pu lire */
    set(k, v) {
      if (!storage || io.readFailed) return false;
      try { storage.setItem(k, v); return true; } catch (_) { return false; }
    },
    setOnce(k, v) { return io.get(k) === null ? io.set(k, v) : false; }
  };
  return io;
}

/* ---------- migration au démarrage ----------
   → { data, report: { from, backedUp, wrote, readOnly? } }
   from : 'v3' | 'none' | 'v11' | 'v1' | 'v11-corrompu' | 'v1-corrompu' | 'erreur'
   readOnly : le stockage n'a pas pu être lu (ou erreur imprévue) → le store ne doit pas écrire. */
export function migrate(storage, today) {
  const d = toDay(today);
  const report = { from: 'none', backedUp: false, wrote: false };
  let io = null, raw3 = null, parsed = null;
  try {
    io = makeIO(storage);
    raw3 = io.get(KEY);

    /* 1. caramel-v3 lisible : normalisation seulement (aucune écriture si rien ne change) */
    parsed = raw3 === null ? null : safeJSON(raw3, null);
    if (isObj(parsed) && parsed.schema === 3) {
      const data = normalizeData(parsed, d);
      const out = JSON.stringify(data);
      if (out !== raw3) {
        /* un profil illisible va disparaître : copie brute d'abord */
        const lost = !isObj(parsed.profiles) || Object.keys(parsed.profiles).length > Object.keys(data.profiles).length;
        if (lost) io.setOnce(CORRUPT, raw3);
        report.wrote = io.set(KEY, out);
      }
      report.from = 'v3';
      if (io.readFailed) report.readOnly = true;
      return { data, report };
    }
    /* caramel-v3 présent mais illisible : copie brute avant de le reconstruire */
    if (raw3 !== null) io.setOnce(CORRUPT, raw3);

    /* 2. anciennes sauvegardes (chaînes brutes) */
    const rawV11 = io.get(V11), rawV1 = io.get(V1);
    let data;
    if (rawV11 === null && rawV1 === null) {
      data = emptyData(d);                                    /* installation neuve */
      report.from = 'none';
    } else {
      /* 3. copie brute, écrite une seule fois */
      if (io.get(BACKUP) === null) {
        report.backedUp = io.set(BACKUP, JSON.stringify({ savedAt: d, [V11]: rawV11, [V1]: rawV1 }));
      }
      /* 4-6. source : v11 valide, sinon v1 valide, sinon profil vierge */
      const v11 = rawV11 === null ? null : safeJSON(rawV11, null);
      const v1 = rawV1 === null ? null : safeJSON(rawV1, null);
      data = buildFromLegacy({ v11: isObj(v11) ? v11 : null, v1, today: d, corrupt: rawV11 !== null ? 'v11' : 'v1' });
      report.from = data.migratedFrom;
    }
    /* 7. écriture de caramel-v3 (aucune ancienne clé supprimée) */
    report.wrote = io.set(KEY, JSON.stringify(data));
    if (io.readFailed) report.readOnly = true;
    return { data, report };
  } catch (e) {
    /* filet de sécurité (ne devrait jamais servir) : démarrage garanti, rien n'est perdu.
       caramel-v3 lisible → servi tel quel (l'enfant retrouve ses données) ; sinon données vides
       en lecture seule (aucune écriture : la migration sera retentée au prochain démarrage). */
    try { if (io && raw3 !== null) io.setOnce(CORRUPT, raw3); } catch (_) {}
    const error = String((e && e.message) || e);
    if (isObj(parsed) && parsed.schema === 3 && isObj(parsed.profiles)) {
      return { data: parsed, report: { from: 'erreur', backedUp: false, wrote: false, error } };
    }
    return { data: emptyData(d), report: { from: 'erreur', backedUp: report.backedUp, wrote: false, readOnly: true, error } };
  }
}
