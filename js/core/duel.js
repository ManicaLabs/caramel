/* ============ « 👫 AVEC UN COPAIN » : LE MÊME DÉFI SUR DEUX TÉLÉPHONES, SANS RÉSEAU (palier 1) ============
   Décision du parent (07/10/2026) : deux enfants (ou 2 à 4), chacun sur SON téléphone, sans réseau, font le même défi
   et comparent leurs points à la fin. Aucune connexion pendant la partie : le Défi en famille (js/core/family.js) pose
   déjà à chacun des questions À SON NIVEAU, et ses points sont relatifs au seuil de rapidité de chaque question
   (questionPoints, speedBonus) : ils se comparent d'un niveau à l'autre. Il suffit donc de partager la RÈGLE au départ
   (un code à 4 chiffres) et de montrer ses points à l'arrivée. Étude : rapport « multijoueur » du 06/10/2026, §5-6.
   Module PUR (aucun accès au navigateur), testé par tests/duel.test.mjs.

   CODE DE PARTIE (4 chiffres, « C N N K ») :
     C  = 1 + 2 × type + manches   (type : index dans CODE_TYPES, figé ici, indépendant de l'ordre de CHALLENGES ;
          manches : 0 = 3 manches, 1 = 5) → 1 à 8. Jamais 0 en tête (le pavé du kit remplace un « 0 » initial), et
          0 et 9 restent libres pour de futurs types ;
     NN = numéro de partie, 00 à 99, tiré au hasard par l'hôte (jamais deux fois de suite le même code sur l'appareil) ;
     K  = chiffre de contrôle de Damm sur « C N N » : une faute de frappe sur UN chiffre, ou deux chiffres voisins
          inversés, donnent toujours un code refusé (gentiment : decodeCode dit pourquoi).
   Le code ne porte QUE la règle : ni prénom, ni classe, ni niveau (CDC §1.6).

   RÈGLE COMMUNE (duelRule) : liée au jour — graine hashSeed('caramel-duel|' + jour + '|' + code) (js/core/rng.js).
   Elle fixe ce qui doit être pareil sur tous les téléphones : le type de question de chaque manche (en « mélange » :
   paquets des trois types dans un ordre tiré, jamais deux fois le même type de suite). Ce que chacun reçoit dépend
   ensuite de sa classe (avant le CE1, la conjugaison devient des tables : axisForClasse, comme le Défi en famille) ;
   les questions, elles, restent tirées par le moteur adaptatif de CHAQUE enfant (θ, Leitner, graine propre).

   RÉCOMPENSES : l'économie existante, rien d'inventé — les 🍎 des bonnes réponses (la manche, comme partout) et les
   5 🍎 de participation du Défi en famille (battleRewards sans gagnant). Pas de trophée : l'appli ne sait pas qui a
   gagné (on compare en montrant son écran). Le comparatif des points (compareCards : rang dense, ex aequo) servira
   quand les résultats s'échangeront (QR, plus tard).

   CARTE DE RÉSULTAT (resultCard) : ce que le bilan montre, et plus tard ce qu'un QR transportera : le code, les points,
   le compagnon (nom, espèce, stade), le thème. JAMAIS le prénom de l'enfant. */

import { hashSeed, makeRng } from './rng.js';
import { BATTLE, CHALLENGE_BY_ID, axisForClasse, battleRanking, battleRewards, stageOf } from './family.js';
import { normalizeTheme } from './themes.js';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const int = (v, def = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : def; };

export const DUEL = Object.freeze({
  LEN: 4,                            /* chiffres du code */
  GAMES: 100,                        /* numéros de partie 00-99 */
  ROUNDS: BATTLE.ROUNDS,             /* [3, 5] manches (une question par manche et par enfant) */
  DEFAULT_ROUNDS: 5,                 /* chacun ne joue que ses questions : 5 par défaut (≈ 1 minute) */
  MIN: BATTLE.MIN, MAX: BATTLE.MAX   /* 2 à 4 enfants, comme le Défi en famille */
});
/* types de défi du code, dans un ordre FIGÉ (un code doit dire la même chose d'une version de Caramel à l'autre) */
export const CODE_TYPES = Object.freeze(['tables', 'calcul', 'conjug', 'melange']);

/* ---------- chiffre de contrôle de Damm (quasi-groupe d'ordre 10, anti-symétrique) ---------- */
const DAMM = [
  [0, 3, 1, 7, 5, 9, 8, 6, 4, 2], [7, 0, 9, 2, 1, 5, 4, 8, 6, 3], [4, 2, 0, 6, 8, 7, 1, 3, 5, 9], [1, 7, 5, 0, 9, 8, 3, 4, 2, 6],
  [6, 1, 2, 3, 0, 4, 5, 9, 7, 8], [3, 6, 7, 4, 2, 0, 9, 5, 8, 1], [5, 8, 6, 9, 7, 2, 0, 1, 3, 4], [8, 9, 4, 5, 3, 6, 2, 0, 1, 7],
  [9, 4, 3, 8, 6, 1, 7, 2, 0, 5], [2, 5, 8, 1, 4, 3, 6, 7, 9, 0]
];
function damm(digits) {
  let s = 0;
  for (const ch of digits) s = DAMM[s][ch.charCodeAt(0) - 48];
  return s;
}

/* ---------- code ↔ réglages ---------- */
/* saisie → chiffres seuls (espaces, espaces fines, tirets et points tolérés) ; null si autre chose s'y glisse */
export function cleanCode(v) {
  const s = String(v ?? '').replace(/[\s\u00A0\u202F.\-·]/g, '');
  return /^\d*$/.test(s) ? s : null;
}
/* { type, rounds, game } → '4821' ; null si un réglage est inconnu */
export function encodeCode({ type, rounds, game } = {}) {
  const t = CODE_TYPES.indexOf(type);
  const r = DUEL.ROUNDS.indexOf(int(rounds, -1));
  const g = int(game, -1);
  if (t < 0 || r < 0 || !(g >= 0 && g < DUEL.GAMES)) return null;
  const head = String(1 + 2 * t + r) + String(g).padStart(2, '0');
  return head + String(damm(head));
}
/* '4821' → { ok: true, code, type, rounds, game } ou { ok: false, reason, code }
   reason : 'empty' (rien) | 'short' (moins de 4 chiffres) | 'long' | 'digits' (autre chose que des chiffres)
            | 'check' (faute de frappe : le chiffre de contrôle ne correspond pas) | 'kind' (type de défi inconnu) */
export function decodeCode(v) {
  const s = cleanCode(v);
  if (s === null) return { ok: false, reason: 'digits', code: '' };
  if (!s) return { ok: false, reason: 'empty', code: '' };
  if (s.length < DUEL.LEN) return { ok: false, reason: 'short', code: s };
  if (s.length > DUEL.LEN) return { ok: false, reason: 'long', code: s };
  if (damm(s) !== 0) return { ok: false, reason: 'check', code: s };
  const c = s.charCodeAt(0) - 48;
  const t = Math.floor((c - 1) / 2);
  if (c < 1 || t >= CODE_TYPES.length || !CHALLENGE_BY_ID[CODE_TYPES[t]]) return { ok: false, reason: 'kind', code: s };
  return { ok: true, code: s, type: CODE_TYPES[t], rounds: DUEL.ROUNDS[(c - 1) % 2], game: Number(s.slice(1, 3)) };
}
export const isCode = v => decodeCode(v).ok;
/* nouveau code pour un défi (rng : js/core/rng.js ; avoid : dernier code de l'appareil, jamais redonné tout de suite) */
export function newCode({ type, rounds } = {}, rng = makeRng(), avoid = '') {
  const r = DUEL.ROUNDS.includes(int(rounds, -1)) ? int(rounds) : DUEL.DEFAULT_ROUNDS;
  const t = CODE_TYPES.includes(type) ? type : CODE_TYPES[0];
  let code = null;
  for (let k = 0; k < 8 && (!code || code === avoid); k++) code = encodeCode({ type: t, rounds: r, game: rng.int(0, DUEL.GAMES - 1) });
  if (code === avoid) {                       /* hasard obstiné : le numéro suivant */
    const d = decodeCode(code);
    code = encodeCode({ type: t, rounds: r, game: (d.game + 1) % DUEL.GAMES });
  }
  return code;
}
/* chiffres du code, pour l'affichage en grandes cases */
export const codeDigits = code => (cleanCode(code) || '').split('');
/* le code à dire, chiffre par chiffre, chaque chiffre en phrase à lui (voix enregistrée : un clip par chiffre, avec
   l'intonation de fin ; il reste dit même sans voix du téléphone, js/ui/voice.js) : '4821' → '4. 8. 2. 1.' */
export const spokenCode = code => codeDigits(code).map(d => d + '.').join(' ');

/* ---------- règle commune ---------- */
/* type de question de chaque manche (avant l'ajustement à la classe) : un seul type, ou en « mélange » des paquets de
   tous les types dans un ordre tiré, sans jamais deux fois le même type de suite */
function planOf(axes, rounds, rng) {
  if (axes.length < 2) return Array.from({ length: rounds }, () => axes[0]);
  const plan = [];
  while (plan.length < rounds) {
    let pack = rng.shuffle(axes);
    if (plan.length && pack[0] === plan[plan.length - 1]) pack = pack.slice(1).concat(pack[0]);
    plan.push(...pack);
  }
  return plan.slice(0, rounds);
}
/* code + jour ('AAAA-MM-JJ') → { code, type, rounds, game, day, seed, plan: [axe de la manche 1, 2…] } ou null */
export function duelRule(code, day) {
  const d = decodeCode(code);
  if (!d.ok) return null;
  const seed = hashSeed('caramel-duel|' + String(day || '') + '|' + d.code);
  const ch = CHALLENGE_BY_ID[d.type];
  return Object.freeze({ code: d.code, type: d.type, rounds: d.rounds, game: d.game, day: String(day || ''), seed,
    plan: Object.freeze(planOf(ch.axes.slice(), d.rounds, makeRng(seed))) });
}
/* axe de la question de la manche `round` (1, 2…) pour un enfant de cette classe */
export function duelAxis(rule, round, classe) {
  if (!rule || !Array.isArray(rule.plan) || !rule.plan.length) return 'ma.faits';
  const r = Math.min(rule.plan.length, Math.max(1, int(round, 1)));
  return axisForClasse(rule.plan[r - 1], classe);
}
/* axes à charger (loadGenerator) pour cet enfant */
export function duelAxes(rule, classe) {
  const out = new Set();
  for (let r = 1; r <= (rule && rule.rounds ? rule.rounds : 0); r++) out.add(duelAxis(rule, r, classe));
  return [...out];
}

/* ---------- fin de partie ---------- */
/* récompenses de cet enfant : { apples, trophy } — participation seulement (aucun gagnant connu de l'appli) */
export function duelRewards(player) {
  const p = isObj(player) ? player : {};
  return battleRewards([{ id: 'me', answered: p.answered }], { winners: [] }).me;
}
/* carte de résultat : ce que montre le bilan (et transportera un QR plus tard) — jamais le prénom de l'enfant */
export function resultCard(profile, { code, points, answered, correct, apples } = {}) {
  const d = decodeCode(code);
  const c = isObj(profile) && isObj(profile.companion) ? profile.companion : {};
  const s = isObj(profile) && isObj(profile.settings) ? profile.settings : {};
  const n = v => Math.max(0, int(v));
  return {
    code: d.ok ? d.code : '', type: d.ok ? d.type : null, rounds: d.ok ? d.rounds : 0,
    points: n(points), answered: n(answered), correct: n(correct), apples: n(apples),
    pet: { name: typeof c.name === 'string' && c.name.trim() ? c.name.trim() : 'Caramel', type: typeof c.type === 'string' ? c.type : 'pony', stage: stageOf(c) },
    theme: normalizeTheme(s.theme)
  };
}
/* comparer des cartes (même code) : rang dense, ex aequo, gagnants — battleRanking du Défi en famille ;
   cartes d'un AUTRE code ignorées (ce n'était pas la même partie) */
export function compareCards(cards, code = null) {
  const list = (Array.isArray(cards) ? cards : []).filter(isObj);
  const ref = code ? cleanCode(code) : list.length ? list[0].code : '';
  const same = list.map((c, i) => ({ c, i })).filter(x => x.c.code === ref);
  const ranking = battleRanking(same.map(x => ({ id: String(x.i), points: x.c.points })));
  return { code: ref, ...ranking, rows: ranking.rows.map(r => ({ ...r, card: list[Number(r.id)] })),
    others: list.filter(c => c.code !== ref) };
}
