/* ============ REGISTRE DES GÉNÉRATEURS DE CONTENU ============
   Chaque module de contenu exporte :
     export const axis = 'ma.ligne';
     export function gen(A, rng, opts) → item          (A = niveau absolu 0…5,6, cf. core/levels.js)
     export function fromKey(key, A, rng) → item|null  (facultatif : rejouer une clé Leitner)
   Chargement paresseux : le shell de jeu attend loadGenerator(axis) avant de monter le jeu. */

const LOADERS = {
  'ma.ligne': () => import('./maths/ligne.js'),
  'ma.faits': () => import('./maths/faits.js'),
  'ma.procedures': () => import('./maths/procedures.js'),
  'ma.operations': () => import('./maths/operations.js'),
  'ma.problemes': () => import('./maths/problemes.js'),
  'fr.conjug': () => import('./fr/conjug.js'),
  'fr.ortho': () => import('./fr/dictee.js'),          /* v2.6 : la dictée de la semaine (liste tapée par un adulte) */
  'fr.fluence': () => import('./stories/index.js')
};

const cache = new Map();
export function hasGenerator(axis) { return !!LOADERS[axis]; }
export async function loadGenerator(axis) {
  if (!LOADERS[axis]) throw new Error('Pas de générateur pour ' + axis);
  if (!cache.has(axis)) cache.set(axis, await LOADERS[axis]());
  return cache.get(axis);
}
/* accès synchrone après chargement (null si pas encore chargé) */
export function generatorSync(axis) { return cache.get(axis) || null; }
