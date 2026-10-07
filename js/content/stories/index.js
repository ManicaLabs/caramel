/* ============ HISTOIRES DE « LA COURSE DE CARAMEL » (fr.fluence) ============
   Module pur (aucun accès au DOM ni au stockage) : 27 histoires v11 + 10 histoires CM2,
   chacune avec sa question de compréhension. Générateur de l'axe fr.fluence (contrat §6.1).
   Les objets sont gelés : les ⭐ vivent dans profile.wallet.stars (plus de champ « best »
   muté comme en v11), les écrans ne modifient jamais une histoire.

   Mondes (affichés à l'enfant : JAMAIS de nom de classe), rangs dans STORIES et niveaux
   absolus A (core/levels.js : 0 = rentrée CP … 5 = fin CM2) :
     Premiers galops 🐣    0-5    lvl 1,2 → 1,7   (ex-CE1 v11)
     Petit trot 🌱         6-10   lvl 2,0 → 3,0   (ex-CE2 v11 : 15 histoires à pas régulier
     Grand galop 🐎       11-15                    sur ces trois mondes)
     Champion 🏆          16-20
     Cavalier émérite 🎖️  21-26   lvl 3,2 → 3,9   (ex-CM1 v11)
     Légende du ranch 🌟  27-36   lvl 4,0 → 4,9   (CM2, nouvelles)
   gen(A) : histoire de lvl proche de A (fenêtre ±0,35, sinon les 3 plus proches) ;
   A < 0,85 (début de CP) → les 3 histoires les plus simples. */

import { clamp } from '../../core/util.js';
import { A_MAX } from '../../core/levels.js';
import { LEGACY_STORIES } from './legacy.js';
import { CM2_STORIES } from './cm2.js';
import { QUESTIONS } from './questions.js';

export const axis = 'fr.fluence';
const KEY = axis + ':';
const WINDOW = 0.35;          /* écart de niveau toléré autour de A */
const NEAREST = 3;            /* repli : les 3 histoires les plus proches */
const RECENT_N = 3;           /* opts.profile : les 3 dernières histoires lues sont évitées */

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

export const STORIES = deepFreeze([...LEGACY_STORIES, ...CM2_STORIES]
  .map(s => ({ ...s, q: QUESTIONS[s.id] || null })));

const BY_ID = new Map(STORIES.map((s, i) => [s.id, { s, i }]));
export function storyById(id) {
  const e = BY_ID.get(id);
  return e ? e.s : null;
}
/* rang de l'histoire dans STORIES (ordre de la carte), −1 si inconnue */
export function storyIndex(id) {
  const e = BY_ID.get(id);
  return e ? e.i : -1;
}

/* label = nom + emoji, prêt à afficher */
export const WORLDS = deepFreeze([
  { id: 'galops', name: 'Premiers galops', emoji: '🐣', from: 0, to: 5 },
  { id: 'trot', name: 'Petit trot', emoji: '🌱', from: 6, to: 10 },
  { id: 'grand-galop', name: 'Grand galop', emoji: '🐎', from: 11, to: 15 },
  { id: 'champion', name: 'Champion', emoji: '🏆', from: 16, to: 20 },
  { id: 'emerite', name: 'Cavalier émérite', emoji: '🎖️', from: 21, to: 26 },
  { id: 'legende', name: 'Légende du ranch', emoji: '🌟', from: 27, to: 36 }
].map(w => ({ ...w, label: w.name + ' ' + w.emoji })));
const WORLD_BY_ID = new Map(WORLDS.map(w => [w.id, w]));

/* histoires d'un monde (id ou objet monde), dans l'ordre de la carte */
export function storiesOf(world) {
  const w = typeof world === 'string' ? WORLD_BY_ID.get(world) : world;
  return w ? STORIES.slice(w.from, w.to + 1) : [];
}

/* Mots des textes absents du lexique Vosk (forme de la grammaire : minuscules, accents
   conservés, cf. tests/lexicon.mjs) : Vosk ne peut pas les reconnaître, il renvoie [unk].
   Le jeu course les ajoute à son ensemble de noms propres (validables par [unk]) quand ils
   figurent dans le texte. Liste figée, vérifiée par tests/stories.test.mjs (les textes CM2
   n'en contiennent aucun). Le nom de monture « capybara », hors lexique lui aussi, est déjà
   couvert par la règle v11.2 (nom de la monture ajouté aux noms propres). 2.2.4 : le lexique du modèle
   vosk-model-small-fr-0.22 connaît en plus « lucioles », « géantes », « comète », « scintille », « mercis »,
   « dansantes » et « ondule ». */
export const OOV = new Set([
  'tourbillonnent', 'tambourine', 'ajustent', 'hulule'
]);

/* ---------- Déblocage ---------- */
/* monde de référence d'une classe : les ⭐ offertes = need de sa 1re histoire */
const CLASS_WORLD = { CP: 'galops', CE1: 'galops', CE2: 'trot', CM1: 'emerite', CM2: 'legende' };
export function classBonus(classe) {
  const w = WORLD_BY_ID.get(CLASS_WORLD[classe]);
  return w ? STORIES[w.from].need : 0;
}
/* nombre de ⭐ (0-3) d'une histoire dans un objet { id: ⭐ } ; valeurs invalides → 0 */
function starsIn(stars, id) {
  const v = stars ? Number(stars[id]) : 0;
  return v > 0 ? Math.min(3, Math.floor(v)) : 0;
}
const walletStars = profile => (profile && profile.wallet && profile.wallet.stars) || null;
/* Σ min(3, ⭐) sur les histoires connues (les ids inconnus sont ignorés) */
export function totalStarsOf(profile) {
  const stars = walletStars(profile);
  if (!stars) return 0;
  let n = 0;
  for (const s of STORIES) n += starsIn(stars, s.id);
  return n;
}
/* need ≤ ⭐ totales + bonus de classe ; une histoire déjà étoilée reste toujours ouverte
   (bienveillance : un changement de classe ne reprend jamais rien) */
export function isUnlocked(story, profile) {
  const s = typeof story === 'string' ? storyById(story) : story;
  if (!s) return false;
  if (starsIn(walletStars(profile), s.id) > 0) return true;
  return s.need <= totalStarsOf(profile) + classBonus(profile && profile.classe);
}

/* ---------- Générateur (contrat §6.1) ---------- */
/* item d'une histoire (aussi utile en mode libre, quand l'enfant choisit lui-même) */
export function itemFor(story) {
  const s = typeof story === 'string' ? storyById(story) : story;
  if (!s) return null;
  return {
    axis, kind: 'story', key: KEY + s.id, storyId: s.id, A: s.lvl,
    prompt: s.title, answer: null, leitner: false, data: { storyId: s.id }
  };
}

const toSet = v => (v instanceof Set ? v : new Set(Array.isArray(v) ? v : []));
/* ids des RECENT_N dernières histoires lues (profile.mclm, plus récente en dernier) */
function recentOf(profile) {
  const out = new Set();
  const log = profile && Array.isArray(profile.mclm) ? profile.mclm : [];
  for (let i = log.length - 1; i >= 0 && out.size < RECENT_N; i--) if (log[i] && log[i].s) out.add(log[i].s);
  return out;
}
function allowedTest(opts) {
  const a = opts.allowed;
  if (typeof a === 'function') return a;
  if (a instanceof Set || Array.isArray(a)) { const set = toSet(a); return s => set.has(s.id); }
  if (opts.profile) return s => isUnlocked(s, opts.profile);
  return null;
}

/* gen(A, rng, opts) → item. Déterministe : mêmes (A, graine, opts) → même histoire.
   opts (tous facultatifs) :
     avoid   : Set|Array de clés 'fr.fluence:<id>' à éviter (déjà vues dans la manche) ;
     recent  : Set|Array d'ids d'histoires lues récemment (évitées si possible) ;
     stars   : { id: ⭐ } → préfère les histoires à moins de 3 ⭐ ;
     allowed : Set|Array d'ids ou fonction (story) → booléen (ex. histoires débloquées) ;
     profile : raccourci → stars = wallet.stars, allowed = isUnlocked, recent = 3 dernières
               histoires de profile.mclm (chaque option explicite reste prioritaire).
   Les filtres se relâchent dans l'ordre recent → avoid → allowed si plus rien ne passe :
   gen renvoie toujours un item. */
export function gen(A, rng, opts = {}) {
  opts = opts || {};
  const a = clamp(Number.isFinite(+A) ? +A : 0, 0, A_MAX);
  const avoid = toSet(opts.avoid);
  const recent = opts.recent !== undefined ? toSet(opts.recent) : recentOf(opts.profile);
  const stars = opts.stars || walletStars(opts.profile);
  const allowed = allowedTest(opts);

  const ok = s => !allowed || allowed(s);
  const fresh = s => !avoid.has(KEY + s.id);
  const tiers = [
    s => ok(s) && fresh(s) && !recent.has(s.id),
    s => ok(s) && fresh(s),
    s => ok(s),
    s => fresh(s),
    () => true
  ];
  let pool = STORIES;
  for (const t of tiers) {
    const p = STORIES.filter(t);
    if (p.length) { pool = p; break; }
  }

  /* fenêtre de niveau, sinon les plus proches (à distance égale : la plus facile d'abord) */
  const dist = s => Math.abs(s.lvl - a);
  let cands = pool.filter(s => dist(s) <= WINDOW + 1e-9);
  if (!cands.length) cands = pool.slice().sort((x, y) => dist(x) - dist(y) || x.lvl - y.lvl).slice(0, NEAREST);
  /* préférence douce : une histoire pas encore réussie à 3 ⭐ */
  if (stars) {
    const todo = cands.filter(s => starsIn(stars, s.id) < 3);
    if (todo.length) cands = todo;
  }
  /* tirage pondéré : plus l'histoire est proche de A, plus elle a de chances
     (sans rng valide : la plus proche, pour rester déterministe) */
  const story = rng && typeof rng.weighted === 'function'
    ? rng.weighted(cands, cands.map(s => 1 / (0.1 + dist(s))))
    : cands.slice().sort((x, y) => dist(x) - dist(y) || x.lvl - y.lvl)[0];
  return itemFor(story);
}
