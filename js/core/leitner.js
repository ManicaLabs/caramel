/* ============ RÉPÉTITION ESPACÉE : LEITNER À 5 BOÎTES (CDC v2 §7.5) ============
   Module pur. profile.leitner = { '<axe>:<contenu>': { b, due, seen, ok, last } } ;
   clés : 'ma.faits:7x8' (facteurs triés), 'ma.faits:add:7+8', 'fr.conjug:prendre|present|3p',
   'fr.fluence:<mot normalisé>'.
   Boîte b → prochaine révision dans INTERVALS[b − 1] jours. « Juste » = du premier coup, sans aide :
   nouvelle clé juste → boîte 2, fausse → boîte 1 ; clé connue juste → boîte + 1 (max 5), fausse → boîte 1. */

import { addDays, dayStr } from './util.js';

export const INTERVALS = [1, 2, 4, 8, 16];          /* jours, boîtes 1 → 5 */
const BOXES = INTERVALS.length;

const boxOf = e => Math.min(BOXES, Math.max(1, Math.round(Number(e && e.b) || 1)));
const dueOf = e => (e && typeof e.due === 'string' ? e.due : '');      /* date illisible → due tout de suite */
const cnt = v => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/* préfixe : un id d'axe ('ma.faits') vise ses clés 'ma.faits:…' ; un préfixe contenant « : »
   ('ma.faits:add:', 'fr.conjug:prendre') est pris tel quel ; vide → toutes les clés. */
function matcher(prefix) {
  if (!prefix) return () => true;
  const p = String(prefix);
  const head = p.includes(':') ? p : p + ':';
  return k => k.startsWith(head);
}
function entries(profile, prefix) {
  const L = profile && profile.leitner;
  if (!L || typeof L !== 'object') return [];
  const ok = matcher(prefix);
  return Object.entries(L).filter(([k, e]) => e && typeof e === 'object' && ok(k));
}

/* enregistre une révision et renvoie l'entrée à jour (champs supplémentaires conservés, ex. w = forme
   affichable d'un mot de fluence) */
export function review(profile, key, correct, today = dayStr()) {
  if (!profile.leitner || typeof profile.leitner !== 'object') profile.leitner = {};
  const prev = profile.leitner[key];
  const known = !!(prev && typeof prev === 'object');
  /* une clé ne monte que si sa révision était due et pas déjà faite aujourd'hui : un après-midi de
     bachotage ne repousse pas un fait fragile à plus tard (une erreur la ramène toujours en boîte 1) */
  const promote = known && correct && prev.last !== today && dueOf(prev) <= today;
  const b = !known ? (correct ? 2 : 1) : (!correct ? 1 : promote ? Math.min(BOXES, boxOf(prev) + 1) : boxOf(prev));
  const keepDue = known && correct && !promote;
  const entry = {
    ...(known ? prev : {}),
    b,
    due: keepDue ? dueOf(prev) : addDays(today, INTERVALS[b - 1]),
    seen: (known ? cnt(prev.seen) : 0) + 1,
    ok: (known ? cnt(prev.ok) : 0) + (correct ? 1 : 0),
    last: today
  };
  profile.leitner[key] = entry;
  return entry;
}

/* clés dues (due ≤ today) : boîte basse d'abord, puis la plus en retard, puis la moins récemment vue */
export function dueKeys(profile, prefix, today = dayStr(), limit = 20) {
  return entries(profile, prefix)
    .filter(([, e]) => dueOf(e) <= today)
    .sort(([ka, a], [kb, b]) => boxOf(a) - boxOf(b) || cmpStr(dueOf(a), dueOf(b))
      || cmpStr(String(a.last || ''), String(b.last || '')) || cmpStr(ka, kb))
    .slice(0, Math.max(0, limit))
    .map(([k]) => k);
}

/* « à revoir » (espace parents) : boîte 1 (dernière réponse fausse ou aidée) et boîte 2 seulement si l'élément a déjà
   été manqué (ok < seen) — une clé juste du premier coup entre directement en boîte 2 sans avoir posé de difficulté ;
   les plus fragiles d'abord (boîte, taux de réussite, nombre de rencontres) */
export function weakKeys(profile, prefix, limit = 12) {
  const rate = e => (cnt(e.seen) ? cnt(e.ok) / cnt(e.seen) : 0);
  return entries(profile, prefix)
    .filter(([, e]) => boxOf(e) === 1 || (boxOf(e) === 2 && cnt(e.ok) < cnt(e.seen)))
    .sort(([ka, a], [kb, b]) => boxOf(a) - boxOf(b) || rate(a) - rate(b)
      || cnt(b.seen) - cnt(a.seen) || cmpStr(ka, kb))
    .slice(0, Math.max(0, limit))
    .map(([k]) => k);
}

/* bilan d'un préfixe ; today (facultatif, extension du contrat) sert au décompte des dues */
export function stats(profile, prefix, today = dayStr()) {
  const byBox = [0, 0, 0, 0, 0];
  let due = 0;
  const list = entries(profile, prefix);
  for (const [, e] of list) {
    byBox[boxOf(e) - 1]++;
    if (dueOf(e) <= today) due++;
  }
  return { total: list.length, byBox, due };
}
