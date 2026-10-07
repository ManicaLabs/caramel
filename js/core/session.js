/* ============ « MA BALADE DU JOUR » (CDC v2 §7.4) ============
   Module pur. Quatre blocs par jour :
     1. échauffement : un point fort (θ ≥ 2 de préférence, parmi les 3 meilleurs), plus facile (offset −0,6),
                       manche raccourcie (70 %) ; ROTATION : pas le même axe que les 2 jours précédents ;
     2. priorité     : axe de poids maximal (autre jeu que l'échauffement ; autre axe si l'échauffement est
                       un vrai point fort) ;
     3. révision     : axe non pratiqué « au niveau » (hors échauffement) depuis ≥ 6 j, sinon axe à ≥ 4 clés
                       Leitner dues (faits, conjugaison), sinon 2e poids ; ROTATION : pas l'axe révisé la veille.
                       Un axe faible pris en échauffement peut revenir ici à son vrai niveau (blocs non consécutifs) ;
     4. récompense   : la course si aucun bloc ne l'utilise, sinon jeu libre (game: null).
   Petit lecteur de CP (isPreReader : aucune lecture mesurée à 15 mots/min ou plus) : pas de lecture à voix haute
   dans sa balade (ni mission ni récompense) ; la course reste jouable en jeu libre (D1-03, jusqu'à la 2.3).
   Micro impossible (refusé, absent, hors ligne au 1er lancement) : swapBlock remplace l'étape par un autre jeu (D1-01).
   Poids = (3 − θ)^1,5 × importance × fraîcheur. Jamais deux fois le même jeu de suite.
   Course : 1 histoire en échauffement/récompense, 2 en priorité/révision (3 pour une séance de 20 min).
   Axes éligibles (choix v2.0) : axes principaux des jeux ACCESSIBLES à la classe (gamesFor, minGrade),
   même si l'axe ne figure pas sur la fiche Repères de la classe : en CP, « Calculer rapidement »
   n'est pas évalué mais Pommes express a un palier CP (+1/−1, +10 : CDC §5.1) → CP = course,
   clôture, tables, pommes ; jamais orchestre ni opérations.
   « Pratiqué » = une manche jouée (profile.history), pas un import d'évaluation.
   v2.6 : la dictée (axe fr.ortho) n'est éligible que si un adulte a tapé une liste (registre : ready(profil)) ; ses mots à
   travailler (à revoir, jamais dictés, dus : registre due(profil, jour)) comptent comme des clés Leitner dues pour la
   révision (≥ 4 → candidate, après les axes non pratiqués depuis 6 jours).
   Calendrier (v2.5, js/content/calendar.js) : les clés Leitner dues d'une notion pas encore vue en classe ou repoussée
   ne comptent pas pour choisir la révision (dès que le générateur de l'axe a été chargé une fois : notionOfKey).
   ensureToday / completeBlock / finishDay modifient le profil reçu : à appeler dans store.mutateProfile. */

import { clamp, dayStr, daysBetween } from './util.js';
import { gamesFor, mancheSize } from '../games/index.js';
import { skillOf } from './adaptive.js';
import { dueKeys } from './leitner.js';
import { addApples } from './economy.js';
import { calState, notionOfKey } from '../content/calendar.js';

export const IMPORTANCE = { 'fr.fluence': 1.3, 'ma.faits': 1.3 };

const LEITNER_AXES = ['ma.faits', 'fr.conjug'];       /* axes dont la révision espacée vaut un bloc */
const REVIEW_DAYS = 6, REVIEW_DUE = 4;
const WARM_OFFSET = -0.6, WARM_RATIO = 0.7;
const DAY_BONUS = 10;                                  /* 🍎 de balade terminée (CDC §10.2) */
const REWARD_GAME = 'course';

/* ---------- éligibilité, fraîcheur, poids ---------- */
function eligible(profile) {
  const out = [], seen = new Set();
  for (const g of gamesFor(profile && profile.classe)) {
    if (!g.primary || seen.has(g.primary)) continue;
    /* v2.6 : un jeu qui n'a de sens qu'avec un contenu de l'adulte (la dictée : une liste de mots) n'entre pas sinon */
    if (typeof g.ready === 'function' && !g.ready(profile)) continue;
    seen.add(g.primary);
    out.push(typeof g.due === 'function' ? { axis: g.primary, game: g.id, dueOf: g.due } : { axis: g.primary, game: g.id });
  }
  return out;
}
export function eligibleAxes(profile) {
  return eligible(profile).map(c => c.axis);
}

/* dernier jour de pratique d'un axe (manche jouée), '' si jamais */
function lastPracticed(profile, axis) {
  const h = profile && Array.isArray(profile.history) ? profile.history : [];
  let last = '';
  for (const e of h) if (e && e.ax === axis && typeof e.d === 'string' && e.d > last) last = e.d;
  return last;
}
function daysUnseen(profile, axis, today) {
  const d = daysBetween(lastPracticed(profile, axis), today);
  return Number.isFinite(d) ? d : Infinity;
}
/* jours depuis la dernière pratique AU NIVEAU (hors bloc d'échauffement, plus facile) */
function daysUnseenAtLevel(profile, axis, today) {
  const h = profile && Array.isArray(profile.history) ? profile.history : [];
  let last = '';
  for (const e of h) if (e && e.ax === axis && e.k !== 'echauffement' && typeof e.d === 'string' && e.d > last) last = e.d;
  const d = daysBetween(last, today);
  return Number.isFinite(d) ? d : Infinity;
}
/* jamais pratiqué ou ≥ 7 j → 2 ; aujourd'hui → 0,5 ; sinon 1 + jours/7 */
function freshness(profile, axis, today) {
  const d = daysUnseen(profile, axis, today);
  if (!(d < 7)) return 2;
  if (d <= 0) return 0.5;
  return 1 + d / 7;
}
export function axisWeight(profile, axis, today = dayStr()) {
  const t = clamp(skillOf(profile, axis).t, 0, 3);
  return Math.pow(3 - t, 1.5) * (IMPORTANCE[axis] || 1) * freshness(profile, axis, today);
}

/* ---------- plan ---------- */
const desc = (a, b) => (a === b ? 0 : a > b ? -1 : 1);
const asc = (a, b) => -desc(a, b);
/* meilleur candidat du premier filtre non vide (filtres du plus strict au plus permissif) */
function choose(cands, filters, cmp) {
  for (const f of filters) {
    const pool = cands.filter(f);
    if (pool.length) return pool.sort(cmp)[0];
  }
  return null;
}

const STRONG = 2;                                      /* « vrai » point fort : au moins l'attendu de la classe */
const COURSE_STORIES = { echauffement: 1, recompense: 1, priorite: 2, revision: 2 };
const PRE_READER_MCLM = 15;                            /* mots/min : en dessous, un CP ne lit pas encore seul */

/* taille d'un bloc : histoires pour la course, sinon items (échauffement raccourci à 70 %) */
function blockCount(kind, game, sessionMin) {
  if (game === REWARD_GAME) return (COURSE_STORIES[kind] || 1) + (sessionMin >= 20 && COURSE_STORIES[kind] > 1 ? 1 : 0);
  const size = mancheSize(game, sessionMin);
  return kind === 'echauffement' ? Math.ceil(WARM_RATIO * size) : size;
}

/* clés Leitner dues d'un axe, sans celles d'une notion verrouillée (pas encore vue en classe, repoussée) */
function dueCount(profile, axis, today) {
  const keys = dueKeys(profile, axis, today, Infinity);
  if (!keys.length) return 0;
  const st = calState(profile, axis, today);
  if (!st.locked.size) return keys.length;
  return keys.filter(k => { const n = notionOfKey(k); return !n || !st.locked.has(n); }).length;
}

/* CP qui ne lit pas encore : aucune lecture mesurée à 15 mots/min ou plus (course, ni v11 importée) */
export function isPreReader(profile) {
  if (!profile || profile.classe !== 'CP') return false;
  const log = Array.isArray(profile.mclm) ? profile.mclm : [];
  if (log.some(m => Number(m && m.v) >= PRE_READER_MCLM)) return false;
  return !(Number(profile.legacy && profile.legacy.mclm) >= PRE_READER_MCLM);
}

export function planDay(profile, today = dayStr()) {
  const sessionMin = (profile && profile.settings && profile.settings.sessionMin) || 15;
  /* plan précédent (autre jour) : mémoire courte pour faire tourner échauffement et révision */
  const prev = profile && profile.today && typeof profile.today === 'object' && profile.today.d !== today ? profile.today : null;
  const recentWarm = prev && Array.isArray(prev.recentWarm) ? prev.recentWarm.slice(0, 2) : [];
  const prevRev = prev && typeof prev.prevRev === 'string' ? prev.prevRev
    : (prev && Array.isArray(prev.blocks) ? ((prev.blocks.find(b => b && b.kind === 'revision') || {}).axis || '') : '');
  /* petit lecteur de CP : pas de lecture à voix haute imposée (la course reste en jeu libre) */
  const pre = isPreReader(profile);
  const cands = eligible(profile).filter(c => !(pre && c.game === REWARD_GAME)).map((c, i) => ({
    ...c, i,
    theta: clamp(skillOf(profile, c.axis).t, 0, 3),
    w: axisWeight(profile, c.axis, today),
    unseen: daysUnseen(profile, c.axis, today),
    unseenLevel: daysUnseenAtLevel(profile, c.axis, today),
    due: LEITNER_AXES.includes(c.axis) ? dueCount(profile, c.axis, today) : c.dueOf ? Math.max(0, Number(c.dueOf(profile, today)) || 0) : 0
  }));
  const byWeight = (a, b) => desc(a.w, b.w) || asc(a.theta, b.theta) || a.i - b.i;
  const block = (kind, c, offset = 0) =>
    ({ kind, game: c ? c.game : null, axis: c ? c.axis : null, count: c ? blockCount(kind, c.game, sessionMin) : null, offset, done: false, result: null });
  const any = () => true;

  /* 1. échauffement : parmi les 3 meilleurs θ (de préférence ≥ 2), pas un axe des 2 derniers jours ;
        à égalité, on garde la course pour la récompense */
  const top = cands.slice().sort((a, b) => desc(a.theta, b.theta) || a.i - b.i).slice(0, 3);
  const warmCmp = (a, b) => desc(a.theta >= STRONG, b.theta >= STRONG) || desc(a.theta, b.theta)
    || (a.game === REWARD_GAME) - (b.game === REWARD_GAME) || a.i - b.i;
  const c1 = choose(top, [c => !recentWarm.includes(c.axis), any], warmCmp) || choose(cands, [any], warmCmp);
  /* 2. priorité : poids maximal, jamais le jeu de l'échauffement (blocs consécutifs) ;
        autre axe seulement si l'échauffement est un vrai point fort */
  const c2 = c1 && choose(cands, [c => c.game !== c1.game && (c1.theta < STRONG || c.axis !== c1.axis), c => c.game !== c1.game, any], byWeight);
  /* 3. révision : jamais le jeu de la priorité ; pas l'axe de la priorité ; pas l'axe révisé la veille si possible */
  let c3 = null;
  if (c2) {
    const base = c => c.axis !== c2.axis && c.game !== c2.game && (c1.theta < STRONG || c.axis !== c1.axis);
    const fresh = c => base(c) && c.axis !== prevRev;
    c3 = choose(cands, [c => fresh(c) && c.unseenLevel >= REVIEW_DAYS, c => base(c) && c.unseenLevel >= REVIEW_DAYS],
        (a, b) => desc(a.unseenLevel, b.unseenLevel) || byWeight(a, b))
      || choose(cands, [c => fresh(c) && c.due >= REVIEW_DUE], (a, b) => desc(a.due, b.due) || byWeight(a, b))
      || choose(cands, [fresh, base, c => c.game !== c2.game, any], byWeight);
  }
  const blocks = [];
  if (c1) blocks.push(block('echauffement', c1, WARM_OFFSET));
  if (c2) blocks.push(block('priorite', c2));
  if (c3) blocks.push(block('revision', c3));
  /* 4. récompense : la course si elle n'a pas encore été jouée dans la balade, sinon jeu libre */
  const course = cands.find(c => c.game === REWARD_GAME);
  const courseUsed = blocks.some(b => b.game === REWARD_GAME);
  if (blocks.length) blocks.push(block('recompense', course && !courseUsed ? course : null));
  return {
    d: today, idx: 0, done: false, rewarded: false, blocks,
    recentWarm: c1 ? [c1.axis, ...recentWarm].slice(0, 3) : recentWarm,
    prevRev: c3 ? c3.axis : ''
  };
}

/* étape i impossible à jouer ici (D1-01 : micro refusé ou absent, hors ligne au 1er lancement → la course) : elle prend
   un autre jeu de la classe, jamais celui de l'étape remplacée ni des étapes voisines (jamais deux fois le même jeu de
   suite), de préférence un axe absent du plan, au plus grand poids ; même taille que si le plan l'avait choisi, offset
   gardé. La récompense devient « au choix ». b.swapped garde le jeu remplacé (la feuille de choix ne le propose pas).
   Étape déjà « au choix » : failed = le jeu choisi qui n'a pas pu se lancer ; il devient b.swapped (V22A-1 : sans lui, la
   feuille repropose la course sans fin).
   Modifie le profil (store.mutateProfile) → id du nouveau jeu, null (récompense au choix), undefined si rien n'a changé
   (plan d'un autre jour, étape faite, déjà au choix sans jeu en échec, aucun autre jeu possible). */
export function swapBlock(profile, i, today = dayStr(), failed = null) {
  const plan = profile && profile.today;
  const blocks = plan && plan.d === today && Array.isArray(plan.blocks) ? plan.blocks : null;
  const b = blocks && Number.isInteger(i) ? blocks[i] : null;
  if (!b || typeof b !== 'object' || b.done) return undefined;
  if (!b.game) {
    if (typeof failed !== 'string' || !failed || b.swapped === failed) return undefined;
    b.swapped = failed;
    return null;
  }
  const from = b.game;
  if (b.kind === 'recompense') {
    Object.assign(b, { game: null, axis: null, count: null, swapped: from });
    return null;
  }
  const sessionMin = (profile.settings && profile.settings.sessionMin) || 15;
  const near = new Set([from, blocks[i - 1] && blocks[i - 1].game, blocks[i + 1] && blocks[i + 1].game].filter(Boolean));
  const used = new Set(blocks.filter((x, k) => k !== i && x && x.axis).map(x => x.axis));
  const cands = eligible(profile).map((c, k) => ({ ...c, i: k, w: axisWeight(profile, c.axis, today) })).filter(c => !near.has(c.game));
  const c = choose(cands, [x => !used.has(x.axis), () => true], (a, z) => desc(a.w, z.w) || a.i - z.i);
  if (!c) return undefined;
  Object.assign(b, { game: c.game, axis: c.axis, count: blockCount(b.kind, c.game, sessionMin), swapped: from });
  return c.game;
}

/* plan valide pour ce profil (jeux toujours accessibles, 4 blocs bien formés) */
function validPlan(plan, profile) {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.blocks) || !plan.blocks.length) return false;
  const ok = new Set(gamesFor(profile.classe).map(g => g.id));
  return plan.blocks.every(b => b && typeof b === 'object' && typeof b.kind === 'string' && (b.game === null || ok.has(b.game)));
}

/* plan du jour (recalculé si absent, d'un autre jour ou devenu invalide, ex. changement de classe) */
export function ensureToday(profile, today = dayStr()) {
  if (!validPlan(profile.today, profile) || profile.today.d !== today) profile.today = planDay(profile, today);
  return profile.today;
}

/* bloc terminé : done, résultat, idx = premier bloc restant (blocks.length si tout est fait) */
export function completeBlock(profile, idx, result = null) {
  const plan = profile && profile.today;
  const b = plan && Array.isArray(plan.blocks) ? plan.blocks[idx] : null;
  if (!b) return null;
  b.done = true;
  b.result = result === undefined ? null : result;
  const next = plan.blocks.findIndex(x => !x.done);
  plan.idx = next < 0 ? plan.blocks.length : next;
  plan.done = next < 0;
  return plan;
}

/* balade terminée : +10 🍎, une seule fois par plan → bonus versé (0 sinon) */
export function finishDay(profile) {
  const plan = profile && profile.today;
  if (!plan || !plan.done || plan.rewarded) return 0;
  plan.rewarded = true;
  addApples(profile, DAY_BONUS);
  return DAY_BONUS;
}
