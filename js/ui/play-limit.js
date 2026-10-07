/* ============ TEMPS DE JEU DU JOUR : CÔTÉ ÉCRANS (v2.4, retour du parent du 07/10/2026) ============
   « Certains enfants ont passé 3 heures sur Caramel. Il faudrait mettre par défaut une limite d'une heure : passé la
   limite, les jeux sont grisés et Caramel s'endort (il fait la sieste s'il fait jour). »
   Règle et calcul (temps des parties du jour, limite par enfant, minutes accordées par un parent) : js/core/playtime.js.
   Ici : les textes (enfant : tutoiement, doux, jamais un reproche ; parents : vouvoiement) et les décisions partagées
   par les écrans qui lancent un jeu. La limite se vérifie quand un jeu va DÉMARRER : une partie commencée se finit
   toujours (accueil, feuille des jeux, carte de la balade, coquille #/play, défi en famille, « Avec un copain »).
   Importable par Node (tests/playtime.test.mjs) : aucun accès au DOM au chargement ; restNotice() seul touche l'écran.
   Le compagnon endormi sur la scène de l'accueil (sieste le jour, nuit sinon) : js/ui/companion.js. */

import { dayStr, frTypo, frList, deNom } from '../core/util.js';
import { fillTemplate } from '../core/profiles.js';
import { playState, napOrNight, BONUS_STEP, homeworkOpen, hasHomework } from '../core/playtime.js';
export { homeworkOpen, hasHomework };
import { skyAt, isNight } from './companion-life.js';
import * as store from '../core/store.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import * as kit from './kit.js';
import * as voice from './voice.js';

/* ---------- textes de l'enfant ({N} = nom du compagnon) ---------- */
export const REST_TEXT = Object.freeze({
  /* tuiles grisées, bilan, retour à l'accueil */
  line: '{N} se repose 💤 À demain !',
  /* le gros bouton de l'accueil (ou de la carte du pré) touché quand le temps de jeu du jour est atteint */
  sieste: 'Tu as bien joué aujourd’hui ! {N} fait la sieste 💤 On rejoue demain.',
  nuit: 'Tu as bien joué aujourd’hui ! {N} dort 🌙 On rejoue demain.',
  /* le gros bouton lui-même */
  button: 'À demain !'
});

/* ---------- décisions ---------- */
/* où en est l'enfant aujourd'hui ? (playState de js/core/playtime.js) ; aucun profil → sans limite */
export function playNow(profile = store.getProfile(), today = dayStr()) {
  if (!profile) return { limit: 0, used: 0, bonus: 0, left: Infinity, over: false, near: false, unlimited: true };
  return playState(profile, today);
}
/* le temps de jeu du jour est-il atteint ? (un nouveau jeu ne démarre plus) */
export function timeUp(profile = store.getProfile(), today = dayStr()) {
  return !!profile && playNow(profile, today).over;
}
/* sieste (le jour) ou nuit (crépuscule, nuit, 22 h - 7 h) : ciel de js/ui/companion-life.js */
export function restKind(date = new Date()) {
  let phase = 'day', night = false;
  try { phase = skyAt(date).phase; night = isNight(date); } catch (_) {}
  return napOrNight(phase, night);
}
/* enfants qui peuvent encore jouer aujourd'hui */
export function awake(profiles, today = dayStr()) {
  return (Array.isArray(profiles) ? profiles : []).filter(p => p && !timeUp(p, today));
}

/* ---------- textes ---------- */
const fill = (t, p) => frTypo(fillTemplate(t, p));
/* « Noisette se repose 💤 À demain ! » */
export function restLine(profile) { return fill(REST_TEXT.line, profile); }
/* pourquoi le bouton ne lance rien : « Tu as bien joué aujourd'hui ! Noisette fait la sieste 💤 On rejoue demain. » */
export function restWhy(profile, kind = restKind()) { return fill(kind === 'nuit' ? REST_TEXT.nuit : REST_TEXT.sieste, profile); }
/* avertissement doux avant la limite (playState.near) : « Encore 5 minutes de jeu aujourd'hui » ; sinon '' */
export function nearLine(state) {
  if (!state || !state.near || !(state.left > 0)) return '';
  const n = Math.max(1, Math.ceil(state.left));
  return frTypo('Encore ' + n + (n > 1 ? ' minutes' : ' minute') + ' de jeu aujourd’hui');
}
/* défi en famille : les enfants au bout de leur temps de jeu, par leur compagnon (prénoms de l'enfant : deux
   compagnons s'appellent souvent tous les deux « Caramel ») → « Le compagnon de Léa se repose 💤 » ;
   « Les compagnons d'Inès et Hugo se reposent 💤 » ; personne → '' */
export function restingPets(profiles) {
  const names = (Array.isArray(profiles) ? profiles : []).filter(Boolean).map(p => p.name);
  if (!names.length) return '';
  return frTypo(names.length > 1 ? 'Les compagnons ' + deNom(frList(names)) + ' se reposent 💤' : 'Le compagnon ' + deNom(names[0]) + ' se repose 💤');
}
/* « Lancer un défi » impossible (moins de deux enfants éveillés) → la phrase sous le bouton ; sinon '' */
export function familyRest(profiles, today = dayStr(), min = 2) {
  const list = (Array.isArray(profiles) ? profiles : []).filter(Boolean);
  const up = awake(list, today);
  if (up.length >= min) return '';
  if (!up.length) return frTypo('Tous les compagnons se reposent 💤 Un défi demain ?');
  return restingPets(list.filter(p => !up.includes(p))) + frTypo(' Un défi demain ?');
}

/* ---------- textes des parents (vouvoiement) ---------- */
/* 30 → « 30 min », 60 → « 1 h », 90 → « 1 h 30 », 62 → « 1 h 02 », 0 → « Sans limite » */
export function durLabel(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  if (m < 60) return m + '\u00A0min';
  const hh = Math.floor(m / 60), mm = m % 60;
  return hh + '\u00A0h' + (mm ? '\u00A0' + String(mm).padStart(2, '0') : '');
}
export const dailyLabel = min => (Number(min) > 0 ? durLabel(min) : 'Sans limite');
/* « Encore 15 minutes aujourd'hui » */
export const BONUS_LABEL = frTypo('Encore ' + BONUS_STEP + ' minutes aujourd’hui');
/* où en est l'enfant aujourd'hui, pour l'espace parents : « Aujourd'hui : 42 min de jeu sur 1 h, encore 18 min. » */
export function parentLine(profile, today = dayStr()) {
  const s = playNow(profile, today);
  const used = s.used >= 0.5 ? durLabel(s.used) + ' de jeu' : 'pas encore de jeu';
  if (s.unlimited) return frTypo('Aujourd’hui : ' + used + ' (sans limite).');
  const room = durLabel(s.limit + s.bonus) + (s.bonus ? ' (dont ' + durLabel(s.bonus) + ' accordées aujourd’hui)' : '');
  if (s.over) return frTypo('Aujourd’hui : ' + used + ' sur ' + room + '. Temps atteint : les jeux sont grisés jusqu’à demain.');
  return frTypo('Aujourd’hui : ' + used + ' sur ' + room + ', encore ' + durLabel(Math.max(1, Math.ceil(s.left))) + '.');
}

/* ---------- à l'écran ---------- */
/* un jeu ne peut pas démarrer : son doux, petite secousse de ce qui a été touché, la phrase (écrite et dite) ;
   kind : 'line' (« Noisette se repose 💤 À demain ! ») ou 'why' (gros bouton : « Tu as bien joué aujourd'hui !… ») */
export function restNotice(profile = store.getProfile(), { el = null, kind = 'line' } = {}) {
  const text = kind === 'why' ? restWhy(profile) : restLine(profile);
  try { audio.soft(); } catch (_) {}
  if (el) { try { motion.shake(el, { dist: 3, dur: 300 }); } catch (_) {} }
  try { kit.toast(text, 3600); } catch (_) {}
  try { if (voice.voiceOn(profile)) voice.speak(text); } catch (_) {}
  return text;
}
