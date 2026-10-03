/* ============ ÉCONOMIE : 🍎, ⭐, série 🔥 + gel, badges (contrat §5.2) ============
   Module pur. Aucune perte de 🍎 ni de ⭐ (CDC §7.7) : seules les dépenses de la boutique
   font baisser les pommes, jamais sous 0.
   Série (règle v11 + gel) : même jour → rien ; hier → +1 ; avant-hier avec un gel → gel consommé, +1 ;
   sinon → repart à 1. Bonus du jour : 10 🍎, + 50 tous les 7 jours de série. */

import { addDays, dayStr, weekKey } from './util.js';

export const BADGES = { bronze: 1.5, argent: 2.25, or: 2.75 };
export const STREAK_BONUS = 10;
export const WEEK_BONUS = 50;
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

/* ajoute n 🍎 (n < 0 : dépense) ; le solde ne descend jamais sous 0 ; renvoie le nouveau solde */
export function addApples(profile, n) {
  if (!isObj(profile)) return 0;
  if (!isObj(profile.wallet)) profile.wallet = { apples: 0, stars: {} };
  const cur = Math.max(0, toInt(profile.wallet.apples));
  const add = Number.isFinite(Number(n)) ? Math.round(Number(n)) : 0;
  profile.wallet.apples = Math.max(0, cur + add);
  return profile.wallet.apples;
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
  addApples(profile, bonus);
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
