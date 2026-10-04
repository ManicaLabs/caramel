/* ============ ÉCONOMIE : 🍎, ⭐, série 🔥 + gel, badges (contrat §5.2) ============
   Module pur. Aucune perte de 🍎 ni de ⭐ (CDC §7.7) : seules les dépenses de la boutique
   font baisser les pommes, jamais sous 0.
   Série (règle v11 + gel) : même jour → rien ; hier → +1 ; avant-hier avec un gel → gel consommé, +1 ;
   sinon → repart à 1. Bonus du jour : 10 🍎, + 50 tous les 7 jours de série.
   En famille (v2.1, js/core/family.js) : compteur de la SEMAINE ISO (profile.stats.week, remis à zéro le lundi)
   tenu par addApples (pommes gagnées) et par la manche (minutes, items) ; trophées (profile.trophies). */

import { addDays, dayStr, weekKey } from './util.js';

export const BADGES = { bronze: 1.5, argent: 2.25, or: 2.75 };
export const STREAK_BONUS = 10;
export const WEEK_BONUS = 50;
export const TROPHY_KINDS = Object.freeze(['defi', 'concours']);
export const TROPHIES_MAX = 300;               /* plafond de profile.trophies (les plus récents gardés) */
const EPS = 1e-9;

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const toInt = v => Math.trunc(Number(v)) || 0;
/* 'AAAA-MM-JJ' (chaîne ou Date ; autre → aujourd'hui) */
const day = v => (typeof v === 'string' ? v.slice(0, 10) : dayStr(v instanceof Date ? v : new Date()));

/* Σ min(3, ⭐) sur toutes les histoires */
export function totalStars(profile) {
  const st = isObj(profile) && isObj(profile.wallet) ? profile.wallet.stars : null;
  if (!isObj(st)) return 0;
  let t = 0;
  for (const v of Object.values(st)) t += Math.min(3, Math.max(0, toInt(v)));
  return t;
}

/* ajoute n 🍎 (n < 0 : dépense) ; le solde ne descend jamais sous 0 ; renvoie le nouveau solde.
   Un GAIN (n > 0) compte aussi dans les pommes de la semaine (today : jour du gain, défaut aujourd'hui). */
export function addApples(profile, n, today) {
  if (!isObj(profile)) return 0;
  if (!isObj(profile.wallet)) profile.wallet = { apples: 0, stars: {} };
  const cur = Math.max(0, toInt(profile.wallet.apples));
  const add = Number.isFinite(Number(n)) ? Math.round(Number(n)) : 0;
  profile.wallet.apples = Math.max(0, cur + add);
  if (add > 0) bumpWeek(profile, { apples: add }, today);
  return profile.wallet.apples;
}

/* ---------- compteur de la semaine (classements « En famille ») ----------
   profile.stats.week = { w: 'AAAA-Www', minutes, apples, items } : effort de la semaine ISO de `today`.
   Absent tant que rien n'a été compté ; repart de zéro au premier ajout d'une nouvelle semaine (lundi).
   Horloge reculée (semaine enregistrée plus récente) : on continue de compter dans la semaine enregistrée. */
const pos = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
/* minutes et items des manches de la semaine w d'après profile.history (d, ms, n) : sert à démarrer un compteur
   (semaine de la mise à jour : les manches jouées avant gardent leur temps ; les pommes, elles, n'y sont pas) */
export function weekFromHistory(profile, w) {
  let ms = 0, items = 0;
  const hist = isObj(profile) && Array.isArray(profile.history) ? profile.history : [];
  for (const e of hist) {
    if (!isObj(e) || typeof e.d !== 'string' || e.d.length < 10) continue;
    if (weekKey(e.d.slice(0, 10)) !== w) continue;
    ms += pos(e.ms);
    items += Math.trunc(pos(e.n));
  }
  return { minutes: Math.round((ms / 60000) * 100) / 100, items };
}
export function weekCounter(profile, today = dayStr()) {
  if (!isObj(profile)) return null;
  if (!isObj(profile.stats)) profile.stats = { minutes: 0, sessions: 0, items: 0 };
  const w = weekKey(day(today === undefined || today === null ? dayStr() : today));
  const c = profile.stats.week;
  if (isObj(c) && typeof c.w === 'string' && c.w >= w) return c;
  const past = weekFromHistory(profile, w);
  profile.stats.week = { w, minutes: past.minutes, apples: 0, items: past.items };
  return profile.stats.week;
}
/* ajoute { minutes, apples, items } (valeurs positives seulement) à la semaine de `today` → compteur */
export function bumpWeek(profile, { minutes = 0, apples = 0, items = 0 } = {}, today = dayStr()) {
  const c = weekCounter(profile, today);
  if (!c) return null;
  c.minutes = Math.round((pos(c.minutes) + pos(minutes)) * 100) / 100;
  c.apples = Math.trunc(pos(c.apples)) + Math.round(pos(apples));
  c.items = Math.trunc(pos(c.items)) + Math.round(pos(items));
  return c;
}

/* ---------- trophées (défi en famille, concours de compagnons) ----------
   profile.trophies = [{ k: 'defi' | 'concours', d: 'AAAA-MM-JJ', w: 'AAAA-Www', … }] (absent tant qu'aucun trophée) ;
   extra : champs propres au trophée (n = participants, pts = points, type = défi joué, score…). → l'entrée ajoutée */
export function addTrophy(profile, kind, today = dayStr(), extra = {}) {
  if (!isObj(profile) || !TROPHY_KINDS.includes(kind)) return null;
  const d = day(today === undefined || today === null ? dayStr() : today);
  const entry = { ...(isObj(extra) ? extra : {}), k: kind, d, w: weekKey(d) };
  if (!Array.isArray(profile.trophies)) profile.trophies = [];
  profile.trophies.push(entry);
  if (profile.trophies.length > TROPHIES_MAX) profile.trophies.splice(0, profile.trophies.length - TROPHIES_MAX);
  return entry;
}

function ensureStreak(profile) {
  if (!isObj(profile.streak)) profile.streak = { count: 0, last: '', freezes: 1, freezeWeek: '' };
  const s = profile.streak;
  s.count = Math.max(0, toInt(s.count));
  s.freezes = Math.max(0, toInt(s.freezes));
  if (typeof s.last !== 'string') s.last = '';
  if (typeof s.freezeWeek !== 'string') s.freezeWeek = '';
  return s;
}

/* 1 gel offert par semaine ISO : au premier appel d'une nouvelle semaine, freezes = max(freezes, 1).
   Renvoie true si la semaine vient d'être (re)créditée. */
export function refreshFreeze(profile, today = dayStr()) {
  if (!isObj(profile)) return false;
  const s = ensureStreak(profile);
  const w = weekKey(day(today));
  if (s.freezeWeek === w) return false;
  s.freezes = Math.max(s.freezes, 1);
  s.freezeWeek = w;
  return true;
}

/* à appeler à la première manche terminée du jour (manche.finish) ; crédite le bonus en 🍎.
   → { bonus, count, usedFreeze } */
export function bumpStreak(profile, today = dayStr()) {
  if (!isObj(profile)) return { bonus: 0, count: 0, usedFreeze: false };
  today = day(today);
  const s = ensureStreak(profile);
  refreshFreeze(profile, today);                 /* le gel de la semaine est disponible dès aujourd'hui */
  if (s.last === today) return { bonus: 0, count: s.count, usedFreeze: false };
  if (s.last && s.last > today) {
    /* horloge de l'appareil reculée : on garde la série, sans bonus (ni remise à 1 injuste) */
    s.last = today;
    return { bonus: 0, count: s.count, usedFreeze: false };
  }
  let usedFreeze = false;
  if (s.last && s.last === addDays(today, -1)) s.count += 1;
  else if (s.last && s.last === addDays(today, -2) && s.freezes > 0) {
    s.freezes -= 1;
    usedFreeze = true;
    s.count += 1;
  } else s.count = 1;
  s.last = today;
  let bonus = STREAK_BONUS;
  if (s.count % 7 === 0) bonus += WEEK_BONUS;
  addApples(profile, bonus, today);
  return { bonus, count: s.count, usedFreeze };
}

/* badge de compétence d'un axe : bronze θ ≥ 1,5 · argent ≥ 2,25 · or ≥ 2,75 */
export function badgeOf(theta) {
  if (theta === null || theta === undefined || theta === '') return null;
  const t = Number(theta);
  if (!Number.isFinite(t)) return null;
  if (t >= BADGES.or - EPS) return 'or';
  if (t >= BADGES.argent - EPS) return 'argent';
  if (t >= BADGES.bronze - EPS) return 'bronze';
  return null;
}
