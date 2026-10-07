/* ============ GÉNÉRATEUR « ÉCRIRE DES MOTS » (axe fr.ortho) : la dictée de la semaine (v2.6) ============
   Jeu : « La dictée de {N} » (js/games/dictee.js). Module pur, contrat §6.1, mais particulier : les mots ne sont pas
   tirés au hasard, ce sont ceux de la LISTE DE LA SEMAINE tapée par un adulte (profile.dictee, js/core/dictee.js). Le jeu
   fixe l'ordre (à revoir d'abord : order) et demande chaque mot : ctx.nextItem(undefined, { word: { w, s } }).
   Sans mot imposé, gen prend le premier mot de opts.words (ou de la liste de opts.profile) qui n'est pas dans opts.avoid
   (clés déjà servies dans la manche), sinon null.
   Item : { axis: 'fr.ortho', kind: 'dictee', key: 'fr.ortho:<mot en minuscules>', A, prompt, answer (le mot),
   leitner: true (clé Leitner : « ✓ Juste » = juste du premier coup), measure: false (θ de fr.ortho inchangé : des mots
   travaillés en classe et une auto-correction ne mesurent pas l'orthographe ; js/core/manche.js), data: { w, s } }.
   Un « palier » n'a pas de sens ici : A est rendu tel quel (le niveau ne choisit rien). Pas de notion du calendrier
   (une liste de l'école est, par définition, de saison). Liste intégrée par classe (mots fréquents, Eduscol) : plus tard. */

import { AXIS, cleanWord, cleanPhrase, keyOf, listOf } from '../../core/dictee.js';

export const axis = AXIS;

export function itemOf(entry, A = 0) {
  const w = cleanWord(entry && entry.w);
  if (!w) return null;
  const s = cleanPhrase(entry && entry.s);
  return {
    axis: AXIS, kind: 'dictee', key: keyOf(w), A: Number.isFinite(A) ? A : 0,
    prompt: w, answer: w, leitner: true, measure: false,
    data: s ? { w, s } : { w }
  };
}

export function gen(A, rng, opts = {}) {
  const o = opts && typeof opts === 'object' ? opts : {};
  if (o.word) return itemOf(o.word, A);
  const words = Array.isArray(o.words) ? o.words : listOf(o.profile);
  const avoid = o.avoid instanceof Set ? o.avoid : new Set();
  const e = words.find(x => x && cleanWord(x.w) && !avoid.has(keyOf(x.w)));
  return e ? itemOf(e, A) : null;
}
