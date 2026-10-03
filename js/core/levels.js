/* ============ NIVEAUX : échelle absolue CP → CM2 ============
   Module pur. Deux échelles coexistent :
   - b ∈ [0 ; 3] : difficulté RELATIVE à la classe de l'enfant (CDC §7.1) :
       2 = attendu de la classe à cette période, 1 ≈ attendu un an plus tôt, 3 = avancé ;
   - A ∈ [0 ; 5,6] : niveau ABSOLU utilisé par les générateurs de contenu :
       0 = rentrée de CP, 1 = fin de CP, 2 = fin de CE1, 3 = fin de CE2, 4 = fin de CM1, 5 = fin de CM2.
   Conversion : A = attendu(classe, date) + (b − 2), avec attendu = indice de classe + avancement de l'année. */

import { CLASSES } from './axes.js';
import { clamp, parseDay } from './util.js';

export { CLASSES };
export const A_MAX = 5.6;

/* CP = 0 … CM2 = 4 ; classe inconnue → CM2 (cible primaire) */
export function gradeIndex(classe) {
  const i = CLASSES.indexOf(classe);
  return i < 0 ? 4 : i;
}
/* avancement de l'année scolaire : 1er septembre → 0, fin juin → 1, été → 1 */
export function yearFrac(date = new Date()) {
  const d = typeof date === 'string' ? parseDay(date) : date;
  const m = d.getMonth();                         /* 0 = janvier */
  if (m === 6 || m === 7) return 1;               /* juillet, août */
  const monthsSinceSept = (m - 8 + 12) % 12;      /* sept = 0 … juin = 9 */
  return clamp((monthsSinceSept + (d.getDate() - 1) / 30) / 10, 0, 1);
}
/* niveau absolu attendu pour la classe à cette date */
export function expectedLevel(classe, date = new Date()) {
  return gradeIndex(classe) + yearFrac(date);
}
/* b (relatif) → A (absolu) */
export function absLevel(classe, b, date = new Date()) {
  return clamp(expectedLevel(classe, date) + (b - 2), 0, A_MAX);
}
/* A (absolu) → b (relatif), pour un item construit hors moteur (ex. question de compréhension) */
export function relLevel(classe, A, date = new Date()) {
  return clamp(A - expectedLevel(classe, date) + 2, 0, 3);
}

/* ---------- Fluence (MCLM) ----------
   Attendus de fin d'année des programmes 2024-2025 (confirmés) : fin de CP 30 mots/min SANS préparation
   (50 après préparation), CE1 70, CE2 90, CM1 110 (moyenne visée), CM2 120, 6e 130.
   Les Repères de rentrée fixent le seuil « satisfaisant » à l'attendu de fin de l'année précédente
   (début CM2 : ≥ 110), ce que reproduit l'interpolation ci-dessous. */
export const MCLM_END = { CP: 30, CE1: 70, CE2: 90, CM1: 110, CM2: 120 };
const MCLM_START_CP = 5;
/* MCLM attendu à cette date (interpolé entre la fin de l'année précédente et celle de la classe) */
export function mclmExpected(classe, date = new Date()) {
  const gi = gradeIndex(classe);
  const end = MCLM_END[CLASSES[gi]];
  const start = gi === 0 ? MCLM_START_CP : MCLM_END[CLASSES[gi - 1]];
  return Math.max(10, start + (end - start) * yearFrac(date));
}
/* cible de fin d'année de la classe (borne de Zip adaptatif) */
export function mclmTarget(classe) { return MCLM_END[CLASSES[gradeIndex(classe)]]; }
/* θ observé depuis un MCLM : attendu → 2 ; ±25 % → ±1 */
export function thetaFromMclm(mclm, classe, date = new Date()) {
  const exp = mclmExpected(classe, date);
  return clamp(2 + (mclm / exp - 1) / 0.25, 0, 3);
}
