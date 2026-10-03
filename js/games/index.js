/* ============ REGISTRE DES JEUX (v2.0 : 6 jeux) ============
   Module pur (aucun import de jeu au chargement : chaque jeu est chargé à la demande).
   title peut contenir des jetons de template ({N} = nom du compagnon) → fillTemplate. */

import { gradeIndex } from '../core/levels.js';

export const GAMES = [
  { id: 'course', title: 'La course de {N}', short: 'La course', icon: '🏁',
    blurb: 'Lis une histoire à voix haute et bats Zip !', axes: ['fr.fluence', 'fr.comp_ecrit'],
    primary: 'fr.fluence', minGrade: 0, tint: '#fce7f3', manche: { 10: 1, 15: 1, 20: 1 } },
  { id: 'cloture', title: 'Le Chemin de la clôture', short: 'La clôture', icon: '🪵',
    blurb: 'Saute de piquet en piquet sur la ligne des nombres.', axes: ['ma.ligne'],
    primary: 'ma.ligne', minGrade: 0, tint: '#fef3c7', manche: { 10: 6, 15: 8, 20: 10 } },
  { id: 'tables', title: 'Le Galop des tables', short: 'Les tables', icon: '🏇',
    blurb: 'Réponds vite et saute les obstacles !', axes: ['ma.faits'],
    primary: 'ma.faits', minGrade: 0, tint: '#dcfce7', manche: { 10: 8, 15: 10, 20: 12 } },
  { id: 'pommes', title: 'Pommes express', short: 'Pommes express', icon: '🍎',
    blurb: 'Calcule de tête et remplis le panier.', axes: ['ma.procedures'],
    primary: 'ma.procedures', minGrade: 0, tint: '#fee2e2', manche: { 10: 8, 15: 10, 20: 12 } },
  { id: 'orchestre', title: 'Le Chef d’orchestre', short: 'L’orchestre', icon: '🎻',
    blurb: 'Conjugue en rythme avec les musiciens.', axes: ['fr.conjug'],
    primary: 'fr.conjug', minGrade: 1, tint: '#ede9fe', manche: { 10: 8, 15: 10, 20: 12 } },
  { id: 'operations', title: 'L’Atelier des opérations', short: 'Les opérations', icon: '🧮',
    blurb: 'Pose et calcule, colonne par colonne.', axes: ['ma.operations'],
    primary: 'ma.operations', minGrade: 1, tint: '#e0f2fe', manche: { 10: 2, 15: 3, 20: 4 } }
];

export const GAME_BY_ID = Object.fromEntries(GAMES.map(g => [g.id, g]));
/* axe → jeu qui l'entraîne (axe principal) */
export const AXIS_GAME = Object.fromEntries(GAMES.map(g => [g.primary, g.id]));

/* jeux accessibles pour une classe */
export function gamesFor(classe) {
  const gi = gradeIndex(classe);
  return GAMES.filter(g => gi >= g.minGrade);
}
/* nombre d'items d'une manche selon la durée de séance (10/15/20 min) ; jeu libre = 15 */
export function mancheSize(gameId, sessionMin = 15) {
  const g = GAME_BY_ID[gameId];
  if (!g) return 10;
  return g.manche[sessionMin] || g.manche[15];
}

const LOADERS = {
  course: () => import('./course.js'),
  cloture: () => import('./cloture.js'),
  tables: () => import('./tables.js'),
  pommes: () => import('./pommes.js'),
  orchestre: () => import('./orchestre.js'),
  operations: () => import('./operations.js')
};
/* charge le module du jeu → son export default { id, title, axes, css?, mount, unmount } */
export async function loadGame(id) {
  const m = await LOADERS[id]();
  return m.default;
}
