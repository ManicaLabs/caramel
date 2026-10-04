/* ============ EN FAMILLE : classements de la semaine, concours de compagnons, points du défi ============
   Module pur (aucun DOM, aucun stockage) : importable par Node (tests/family.test.mjs).
   Écrans : js/ui/famille.js (#/famille : classements, concours) et js/ui/battle.js (#/battle : défi à tour de rôle).

   Principes (CDC §1 et §16, demande du parent du 03/10/2026) :
   - on ne classe QUE l'effort et l'engagement (minutes, pommes, régularité, lecture, défis) — JAMAIS le niveau
     scolaire ni θ ; le défi pose à chacun des questions À SON NIVEAU (tout le monde peut gagner) ;
   - présentation positive : podiums, « Bravo à tous ! », jamais de « dernier » ; une valeur nulle ne monte pas
     sur le podium ; ex aequo partout, en rang DENSE (1, 1, 2 : après deux médailles d'or vient l'argent).

   Semaine : semaine ISO de l'appareil (util.weekKey), remise à zéro chaque lundi. Les chiffres de la semaine
   viennent de profile.stats.week = { w, minutes, apples, items } (tenu par economy.addApples / bumpWeek et la
   manche) ; un compteur d'une autre semaine vaut zéro.

   Classements (BOARDS) : ⏱️ minutes d'entraînement de la semaine · 🍎 pommes gagnées dans la semaine ·
     🔥 série en cours (vivante : dernier jour joué = aujourd'hui ou hier, ou avant-hier avec un gel) ·
     ⭐ étoiles de lecture (total) · 🏅 trophées de défi gagnés dans la semaine.

   Concours de compagnons (score d'évolution, lisible) — trois juges, trois notes :
     🌱 Croissance = 100 par stade (petit 1, junior 2, champion 3) + 1 par minute d'apprentissage (300 au plus)
     💖 Soins      = moyenne des trois jauges (faim, forme, joie, à l'instant présent) × 3       (45 à 300)
     ✨ Élégance   = 25 par accessoire possédé + 15 par compagnon possédé en plus du poney         (≤ 305)
     Stade = max(companion.stage, stade des minutes) — mêmes seuils que js/ui/companion-life.js (0, 60, 300 min).
     Un ruban pour chacun : le GRAND ruban d'un domaine où il a la meilleure note de la famille, sinon le ruban
     d'encouragement du domaine où il brille le plus (bel effort, tendresse, style) — jamais de superlatif faux.
     Le gagnant de la semaine reçoit un trophée UNE seule fois par semaine (concoursAwarded).

   Défi en famille (BATTLE) : par question, + 100 si juste, + bonus de rapidité RELATIF au seuil de l'item
     (item.autoMs, sinon seuil par axe) : 50 si la réponse arrive avant le seuil, puis décroissance linéaire jusqu'à
     0 à 3 × le seuil (arrondi à 5) ; + série : 10 par bonne réponse d'affilée au-delà de la première (30 au plus).
     Faux : 0 point (jamais de points retirés). Fin : 5 🍎 de participation pour chaque joueur qui a répondu,
     + 10 🍎 et un trophée pour le (ou les) gagnant(s) ex aequo ; un joueur qui s'arrête garde ses points et sa
     participation mais sort du classement. Personne n'a de point → pas de gagnant. */

import { clamp, addDays, daysBetween, parseDay, weekKey } from './util.js';
import { gradeIndex } from './levels.js';
import { PET, MOUNTS, SHOP } from '../content/companion-data.js';
import { totalStarsOf } from '../content/stories/index.js';
import { weekFromHistory } from './economy.js';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, def = 0) => { const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN; return Number.isFinite(n) ? n : def; };
const int = (v, def = 0) => Math.trunc(num(v, def));
const SHOP_IDS = new Set(SHOP.map(s => s.id));

/* ============ SEMAINE ============ */
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
/* '2026-10-01' → '1er octobre' ; '2026-09-28' → '28 septembre' */
export function frDayMonth(d) {
  const x = parseDay(d);
  const n = x.getDate();
  return (n === 1 ? '1er' : String(n)) + '\u00a0' + MONTHS[x.getMonth()];
}
export function frWeekday(d) { return WEEKDAYS[parseDay(d).getDay()]; }
/* semaine ISO de `today` : { w, from (lundi), to (dimanche), label : « du lundi 28 septembre au dimanche 4 octobre » } */
export function weekRange(today) {
  const x = parseDay(today);
  const from = addDays(today, -((x.getDay() + 6) % 7));
  const to = addDays(from, 6);
  return { w: weekKey(today), from, to, label: 'du lundi ' + frDayMonth(from) + ' au dimanche ' + frDayMonth(to) };
}
/* effort de la semaine de `today` ; sans compteur de cette semaine : minutes et items retrouvés dans l'historique
   des manches (semaine de la mise à jour), pommes à 0 */
export function weekStats(profile, today) {
  const w = weekKey(today);
  const c = isObj(profile) && isObj(profile.stats) && isObj(profile.stats.week) ? profile.stats.week : null;
  if (!c || c.w !== w) { const past = weekFromHistory(profile, w); return { w, minutes: past.minutes, apples: 0, items: past.items }; }
  return { w, minutes: Math.max(0, num(c.minutes)), apples: Math.max(0, int(c.apples)), items: Math.max(0, int(c.items)) };
}
/* série EN COURS : vivante si le dernier jour joué est aujourd'hui ou hier (ou avant-hier avec un gel en réserve) */
export function liveStreak(profile, today) {
  const s = isObj(profile) && isObj(profile.streak) ? profile.streak : null;
  const count = s ? Math.max(0, int(s.count)) : 0;
  if (!count || typeof s.last !== 'string' || !s.last) return 0;
  const gap = daysBetween(s.last, today);
  if (!Number.isFinite(gap)) return 0;
  if (gap <= 1) return count;
  if (gap === 2 && int(s.freezes) > 0) return count;
  return 0;
}
/* trophées d'un profil (kind : 'defi' | 'concours' | null = tous ; week : 'AAAA-Www' | null = toutes) */
export function trophiesOf(profile, kind = null, week = null) {
  const list = isObj(profile) && Array.isArray(profile.trophies) ? profile.trophies : [];
  return list.filter(t => isObj(t) && (!kind || t.k === kind) && (!week || t.w === week));
}

/* ============ CLASSEMENTS ============ */
export const MEDALS = Object.freeze(['or', 'argent', 'bronze']);
export const MEDAL_EMOJI = Object.freeze({ or: '🥇', argent: '🥈', bronze: '🥉' });
export const BOARDS = Object.freeze([
  { id: 'minutes', icon: '⏱️', title: 'Les plus entraînés', what: 'minutes d’entraînement cette semaine',
    emptyText: 'La semaine commence : à vos marques, prêts, jouez !' },
  { id: 'apples', icon: '🍎', title: 'La belle cueillette', what: 'pommes gagnées cette semaine',
    emptyText: 'Pas encore de pomme cueillie cette semaine… à vous de jouer !' },
  { id: 'streak', icon: '🔥', title: 'Les plus réguliers', what: 'jours de suite en ce moment',
    emptyText: 'Pas de série en cours : on en commence une aujourd’hui ?' },
  { id: 'stars', icon: '⭐', title: 'Les lecteurs étoilés', what: 'étoiles de lecture en tout',
    emptyText: 'Pas encore d’étoile de lecture : une histoire vous attend !' },
  { id: 'trophies', icon: '🏅', title: 'Les champions des défis', what: 'trophées de défi cette semaine',
    emptyText: 'Pas encore de défi cette semaine : qui lance le premier ?' }
].map(b => Object.freeze(b)));
export const BOARD_BY_ID = Object.freeze(Object.fromEntries(BOARDS.map(b => [b.id, b])));

/* valeur entière affichée (et classée) d'un profil pour un classement */
export function boardValue(profile, id, today) {
  switch (id) {
    case 'minutes': return Math.round(weekStats(profile, today).minutes);
    case 'apples': return weekStats(profile, today).apples;
    case 'streak': return liveStreak(profile, today);
    case 'stars': return totalStarsOf(profile);
    case 'trophies': return trophiesOf(profile, 'defi', weekKey(today)).length;
    default: return 0;
  }
}

/* rang DENSE : rows = [{ id, value, … }] (ordre d'arrivée = départage d'affichage) →
   copie triée (valeur décroissante) avec rank (1, 1, 2…), tie (ex aequo) et medal ('or' | 'argent' | 'bronze' | null :
   seulement si value > 0 et rank ≤ 3). Jamais de « dernier » : le rang ne sert qu'au podium. */
export function rankRows(rows) {
  const list = (Array.isArray(rows) ? rows : []).map((r, i) => ({ ...r, value: num(r && r.value), order: i }));
  list.sort((a, b) => (b.value - a.value) || (a.order - b.order));
  let rank = 0, prev = null;
  for (const r of list) {
    if (prev === null || r.value !== prev) { rank++; prev = r.value; }
    r.rank = rank;
  }
  const byRank = new Map();
  for (const r of list) byRank.set(r.rank, (byRank.get(r.rank) || 0) + 1);
  for (const r of list) {
    r.tie = byRank.get(r.rank) > 1;
    r.medal = r.value > 0 && r.rank <= MEDALS.length ? MEDALS[r.rank - 1] : null;
    delete r.order;
  }
  return list;
}

/* les cinq classements de la semaine : [{ …board, rows, podium, others, empty }]
   podium = lignes médaillées (valeur > 0) ; others = les autres (« Bravo aussi à… ») ; empty = tout le monde à 0
   (board.emptyText : message d'encouragement à afficher alors) */
export function weeklyBoards(profiles, today) {
  const list = (Array.isArray(profiles) ? profiles : []).filter(isObj);
  return BOARDS.map(b => {
    const rows = rankRows(list.map(p => ({ id: p.id, value: boardValue(p, b.id, today) })));
    return { ...b, rows, podium: rows.filter(r => r.medal), others: rows.filter(r => !r.medal), empty: rows.every(r => r.value <= 0) };
  });
}

/* ============ CONCOURS DE COMPAGNONS ============ */
export const STAGE_MINUTES = Object.freeze([0, 60, 300]);      /* = js/ui/companion-life.js (stageFor), vérifié par les tests */
export const STAGE_NAMES = Object.freeze({ 1: 'petit', 2: 'junior', 3: 'champion' });
export const CONCOURS = Object.freeze({ STAGE: 100, MINUTE: 1, MINUTES_MAX: 300, CARE: 3, ACCESSORY: 25, MOUNT: 15 });
/* le jury : une note chacun */
/* ribbon : grand ruban (meilleure note de la famille dans ce domaine) ; soft : ruban d'encouragement (sinon) */
export const JURY = Object.freeze([
  { id: 'growth', judge: '🦉', name: 'Madame Chouette', title: 'Croissance', icon: '🌱',
    ribbon: 'Grand ruban de la croissance', soft: 'Ruban du bel effort' },
  { id: 'care', judge: '🐰', name: 'Monsieur Lapin', title: 'Soins', icon: '💖',
    ribbon: 'Grand ruban des soins', soft: 'Ruban de la tendresse' },
  { id: 'style', judge: '🦚', name: 'Monsieur Paon', title: 'Élégance', icon: '✨',
    ribbon: 'Grand ruban de l’élégance', soft: 'Ruban du style' }
].map(j => Object.freeze(j)));

/* stade du compagnon (1 petit, 2 junior, 3 champion) : le plus avancé entre companion.stage et les minutes */
export function stageOf(companion) {
  const c = isObj(companion) ? companion : {};
  const m = Math.max(0, num(c.minutes));
  const byMinutes = m >= STAGE_MINUTES[2] ? 3 : m >= STAGE_MINUTES[1] ? 2 : 1;
  return Math.max(clamp(int(c.stage, 1), 1, 3), byMinutes);
}
/* jauges à l'instant `now` (décroissance douce depuis pet.last, plancher 15 : mêmes règles que la carte du compagnon) */
export function gaugesNow(pet, now = Date.now()) {
  const p = isObj(pet) ? pet : {};
  const last = num(p.last, 0);
  const dt = last > 0 ? Math.max(0, now - last) : 0;
  const g = k => clamp(num(p[k], PET.START) - (100 * dt) / PET.DECAY[k], PET.FLOOR, PET.MAX);
  return { faim: g('faim'), forme: g('forme'), joie: g('joie') };
}
/* score d'évolution d'un compagnon → { stage, minutes, gauges, accessories, mounts, notes: { growth, care, style }, total } */
export function companionScore(profile, now = Date.now()) {
  const c = isObj(profile) && isObj(profile.companion) ? profile.companion : {};
  const stage = stageOf(c);
  const minutes = Math.max(0, num(c.minutes));
  const gauges = gaugesNow(c.pet, now);
  const avg = (gauges.faim + gauges.forme + gauges.joie) / 3;
  const eq = isObj(c.equip) && Array.isArray(c.equip.owned) ? c.equip.owned : [];
  const accessories = new Set(eq.filter(id => SHOP_IDS.has(id))).size;
  const owned = Array.isArray(c.owned) ? c.owned : [];
  const mounts = new Set(owned.filter(t => typeof t === 'string' && t !== 'pony' && Object.prototype.hasOwnProperty.call(MOUNTS, t))).size;
  const notes = {
    growth: CONCOURS.STAGE * stage + CONCOURS.MINUTE * Math.min(CONCOURS.MINUTES_MAX, Math.floor(minutes)),
    care: Math.round(avg * CONCOURS.CARE),
    style: CONCOURS.ACCESSORY * accessories + CONCOURS.MOUNT * mounts
  };
  return { stage, minutes, gauges, accessories, mounts, notes, total: notes.growth + notes.care + notes.style };
}
/* résultats du concours : [{ id, score, total, rank, tie, medal, ribbon: { id, icon, label, best } }] (rang dense).
   Un ruban pour chacun : le GRAND ruban d'un domaine si ce compagnon y a la meilleure note de la famille (ex aequo
   compris ; premier domaine dans l'ordre du jury) ; sinon le ruban d'encouragement du domaine où il brille le plus
   (note rapportée à la meilleure). Jamais de superlatif faux. */
export function concoursResults(profiles, now = Date.now()) {
  const list = (Array.isArray(profiles) ? profiles : []).filter(isObj);
  const scores = new Map(list.map(p => [p.id, companionScore(p, now)]));
  const best = {};
  for (const j of JURY) best[j.id] = Math.max(1, ...list.map(p => scores.get(p.id).notes[j.id]));
  const ranked = rankRows(list.map(p => ({ id: p.id, value: scores.get(p.id).total })));
  return ranked.map(r => {
    const score = scores.get(r.id);
    const top = JURY.find(j => score.notes[j.id] > 0 && score.notes[j.id] >= best[j.id] - 1e-9);
    let pick = top || JURY[0];
    if (!top) {
      let f0 = -1;
      for (const j of JURY) {
        const f = score.notes[j.id] / best[j.id];
        if (f > f0 + 1e-9) { f0 = f; pick = j; }
      }
    }
    return { ...r, score, total: score.total, ribbon: { id: pick.id, icon: pick.icon, label: top ? pick.ribbon : pick.soft, best: !!top } };
  });
}
/* ids des gagnants du concours de la semaine `w` déjà récompensés (trophée 'concours') */
export function concoursAwarded(profiles, w) {
  return (Array.isArray(profiles) ? profiles : []).filter(p => trophiesOf(p, 'concours', w).length).map(p => p.id);
}
/* gagnants à récompenser : rang 1 avec un score > 0, seulement si personne ne l'a encore été cette semaine */
export function concoursWinnersToAward(results, profiles, w) {
  if (concoursAwarded(profiles, w).length) return [];
  return (Array.isArray(results) ? results : []).filter(r => r.rank === 1 && r.total > 0).map(r => r.id);
}

/* ============ DÉFI EN FAMILLE ============ */
export const BATTLE = Object.freeze({
  BASE: 100, SPEED: 50, SPEED_SPAN: 3, STREAK_STEP: 10, STREAK_MAX: 30,
  PARTICIPATION: 5, WINNER: 10, ROUNDS: Object.freeze([3, 5]), MIN: 2, MAX: 4,
  TRACK: 150                 /* ligne d'arrivée de la piste = manches × 150 points */
});
export const CHALLENGES = Object.freeze([
  { id: 'tables', icon: '✖️', title: 'Tables', blurb: 'Tables et petits calculs', axes: ['ma.faits'] },
  { id: 'calcul', icon: '⚡', title: 'Calcul éclair', blurb: 'Du calcul mental malin', axes: ['ma.procedures'] },
  { id: 'conjug', icon: '🎻', title: 'Conjugaison', blurb: 'Le bon verbe dans la phrase', axes: ['fr.conjug'] },
  { id: 'melange', icon: '🎲', title: 'Mélange', blurb: 'Un peu de tout !', axes: ['ma.faits', 'ma.procedures', 'fr.conjug'] }
].map(c => Object.freeze({ ...c, axes: Object.freeze(c.axes) })));
export const CHALLENGE_BY_ID = Object.freeze(Object.fromEntries(CHALLENGES.map(c => [c.id, c])));
/* axe de la question d'une manche (round = 1, 2…) pour un joueur ; mélange : tous les joueurs d'une même manche ont le
   même type de question. Avant le CE1, pas de conjugaison écrite (le Chef d'orchestre commence au CE1) → tables. */
export function battleAxis(challengeId, round, classe) {
  const ch = CHALLENGE_BY_ID[challengeId] || CHALLENGES[0];
  const r = Math.max(1, int(round, 1));
  const ax = ch.axes[(r - 1) % ch.axes.length];
  return ax === 'fr.conjug' && gradeIndex(classe) < 1 ? 'ma.faits' : ax;
}
/* axes à charger (loadGenerator) pour un défi et des classes */
export function battleAxes(challengeId, rounds, classes) {
  const out = new Set();
  for (const cl of Array.isArray(classes) ? classes : [classes]) {
    for (let r = 1; r <= Math.max(1, int(rounds, 1)); r++) out.add(battleAxis(challengeId, r, cl));
  }
  return [...out];
}
/* seuil de rapidité d'un item (ms) : item.autoMs, sinon seuil de l'axe (la conjugaison demande de lire la phrase) */
export const AUTO_MS = Object.freeze({ 'ma.faits': 3000, 'ma.procedures': 5000, 'fr.conjug': 9000 });
export function autoMsOf(item) {
  const a = num(item && item.autoMs, 0);
  if (a > 0) return a;
  return AUTO_MS[item && item.axis] || 6000;
}
/* bonus de rapidité : 50 jusqu'au seuil, puis linéaire jusqu'à 0 à 3 × le seuil ; arrondi à 5 */
export function speedBonus(ms, autoMs) {
  const t = num(ms, Infinity), a = Math.max(1, num(autoMs, 6000));
  if (!(t >= 0)) return 0;
  if (t <= a) return BATTLE.SPEED;
  const f = clamp(1 - (t - a) / ((BATTLE.SPEED_SPAN - 1) * a), 0, 1);
  return Math.round((BATTLE.SPEED * f) / 5) * 5;
}
/* points d'une question ; streak = bonnes réponses d'affilée du joueur, celle-ci comprise (1 = première) */
export function questionPoints({ correct, ms, autoMs, streak = 1 } = {}) {
  if (!correct) return { base: 0, speed: 0, streak: 0, total: 0 };
  const base = BATTLE.BASE;
  const speed = speedBonus(ms, autoMs);
  const series = Math.min(BATTLE.STREAK_MAX, BATTLE.STREAK_STEP * Math.max(0, int(streak, 1) - 1));
  return { base, speed, streak: series, total: base + speed + series };
}
/* classement final : players = [{ id, points, abandoned }] → { rows (joueurs restés, rang dense), resting (ceux qui se
   sont arrêtés), winners (ids : rang 1 avec des points), tie (plusieurs gagnants) } */
export function battleRanking(players) {
  const list = (Array.isArray(players) ? players : []).filter(isObj);
  const rows = rankRows(list.filter(p => !p.abandoned).map(p => ({ id: p.id, value: Math.max(0, num(p.points)) })));
  const winners = rows.filter(r => r.rank === 1 && r.value > 0).map(r => r.id);
  return { rows, resting: list.filter(p => p.abandoned).map(p => p.id), winners, tie: winners.length > 1 };
}
/* récompenses de fin : { id: { apples, trophy } } — participation si le joueur a répondu au moins une fois */
export function battleRewards(players, ranking) {
  const out = {};
  const win = new Set(ranking && Array.isArray(ranking.winners) ? ranking.winners : []);
  for (const p of (Array.isArray(players) ? players : []).filter(isObj)) {
    const played = int(p.answered) > 0;
    const winner = win.has(p.id);
    out[p.id] = { apples: (played ? BATTLE.PARTICIPATION : 0) + (winner ? BATTLE.WINNER : 0), trophy: winner };
  }
  return out;
}
/* position sur la piste (0 → 1) : points / (manches × 150), plafonnée à l'arrivée */
export function trackFrac(points, rounds) {
  return clamp(num(points) / (BATTLE.TRACK * Math.max(1, int(rounds, 3))), 0, 1);
}
/* ordre de passage de la revanche : on décale d'un cran (un autre enfant commence) */
export function rotate(ids, k = 1) {
  const a = Array.isArray(ids) ? ids.slice() : [];
  if (a.length < 2) return a;
  const s = ((int(k, 1) % a.length) + a.length) % a.length;
  return a.slice(s).concat(a.slice(0, s));
}
