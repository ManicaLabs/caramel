/* ============ TEMPS DE JEU DU JOUR (v2.4, retour du parent du 07/10/2026) ============
   « Certains enfants ont passé 3 heures sur Caramel, ça fait beaucoup d'un coup. Il faudrait mettre par défaut une limite
   d'une heure : passé la limite, les jeux sont grisés et Caramel s'endort (il fait la sieste s'il fait jour). »
   Module pur (aucun accès au navigateur), testé par tests/playtime.test.mjs.
   - Temps compté : celui des parties (manches), tel que js/core/manche.js le mesure (temps actif, plafonné par question)
     et l'enregistre dans l'historique à la fin de chaque partie (history[].ms, jour history[].d). Le temps passé avec le
     compagnon (soins, boutique) ne compte pas : seuls les jeux sont limités.
   - Limite par enfant : settings.dailyMin (minutes ; 0 = sans limite), DAILY_DEFAULT = 60 ; un parent peut accorder un
     peu plus pour la journée (profile.playBonus = { d, min }, BONUS_STEP minutes par toucher).
   - Une partie commencée se finit toujours : la limite se vérifie quand un jeu va démarrer.
   v2.6 : les devoirs (dictée, poésies) ne comptent pas et restent ouverts (HOMEWORK_GAMES, isHomeworkEntry, homeworkOpen,
   hasHomework).
   API : DAILY_OPTIONS, DAILY_DEFAULT, BONUS_STEP, NEAR_MIN, normDailyMin(v), minutesToday(profile, jour),
     bonusToday(profile, jour), playState(profile, jour) → { limit, used, bonus, left, over, near, unlimited },
     withBonus(profile, jour, minutes) → nouvelle valeur de playBonus, napOrNight(phase, nuit) → 'sieste' | 'nuit'. */

export const DAILY_OPTIONS = Object.freeze([30, 45, 60, 90, 120, 0]);   /* 0 : sans limite */
export const DAILY_DEFAULT = 60;
export const BONUS_STEP = 15;
export const NEAR_MIN = 5;                                              /* « plus que 5 minutes » */

export function normDailyMin(v) {
  /* null, '' ou un booléen (sauvegarde importée abîmée) ne valent JAMAIS « sans limite » (Number(null) = 0) */
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return DAILY_DEFAULT;
  const n = Number(v);
  return DAILY_OPTIONS.includes(n) ? n : DAILY_DEFAULT;
}
const settingsOf = p => (p && p.settings && typeof p.settings === 'object' ? p.settings : {});

/* v2.6 — DEVOIRS (décision du parent du 08/10/2026 : « les devoirs à part ») : la dictée de la semaine et les poésies ne
   comptent pas dans le temps de jeu du jour, et restent possibles quand il est atteint (ce sont des devoirs). */
export const HOMEWORK_GAMES = Object.freeze(['dictee']);
export const isHomeworkEntry = e => !!e && (HOMEWORK_GAMES.includes(e.g) || e.mode === 'poesie');
/* ce jeu peut-il démarrer comme devoir ? dictée : une liste existe ; course : des poésies existent (la course n'ouvre
   alors que les poésies, les histoires attendent demain) */
export function homeworkOpen(profile, gameId) {
  if (!profile) return false;
  if (gameId === 'dictee') return !!(profile.dictee && Array.isArray(profile.dictee.words) && profile.dictee.words.length);
  if (gameId === 'course') return Array.isArray(profile.poems) && profile.poems.length > 0;
  return false;
}
export const hasHomework = profile => homeworkOpen(profile, 'dictee') || homeworkOpen(profile, 'course');

/* minutes de jeu du jour (parties finies ou abandonnées, d'après l'historique ; devoirs exclus) */
export function minutesToday(profile, today) {
  const h = profile && Array.isArray(profile.history) ? profile.history : [];
  let ms = 0;
  for (const e of h) if (e && e.d === today && Number.isFinite(e.ms) && e.ms > 0 && !isHomeworkEntry(e)) ms += e.ms;
  return ms / 60000;
}
/* minutes accordées en plus aujourd'hui par un parent */
export function bonusToday(profile, today) {
  const b = profile && profile.playBonus;
  return b && b.d === today && Number(b.min) > 0 ? Math.floor(Number(b.min)) : 0;
}
export function playState(profile, today) {
  const limit = normDailyMin(settingsOf(profile).dailyMin);
  const used = minutesToday(profile, today);
  const bonus = bonusToday(profile, today);
  if (!limit) return { limit: 0, used, bonus, left: Infinity, over: false, near: false, unlimited: true };
  const left = Math.max(0, limit + bonus - used);
  return { limit, used, bonus, left, over: left <= 0, near: left > 0 && left <= NEAR_MIN, unlimited: false };
}
/* un parent accorde `minutes` de plus aujourd'hui (cumulable dans la journée, remis à zéro le lendemain) */
export function withBonus(profile, today, minutes = BONUS_STEP) {
  return { d: today, min: bonusToday(profile, today) + Math.max(0, Math.floor(Number(minutes) || 0)) };
}
/* le compagnon s'endort : sieste le jour, nuit sinon (phase du ciel de js/ui/companion-life.js : skyAt().phase) */
export function napOrNight(phase, night = false) {
  return night || phase === 'night' || phase === 'dusk' ? 'nuit' : 'sieste';
}
