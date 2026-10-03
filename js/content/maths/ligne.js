/* ============ LIGNE GRADUÉE — axe 'ma.ligne' · jeu « Le Chemin de la clôture » ============
   Module pur (aucun DOM). Contrat : docs/ARCHITECTURE.md §6 ; mise en scène : docs/JEUX.md §3.
   gen(A, rng, opts) → item, déterministe pour (A, graine), pour tout A ∈ [0 ; 5,6] (core/levels.js).
   Pas de fromKey : l'axe n'utilise pas Leitner (leitner: false).

   ---------- PALIERS (A → contenu) ----------
   Sources : programme du cycle 2, BO n°41 du 31/10/2024 (CP p. 98, CE1 p. 105, CE2 p. 114-115) ;
   programme du cycle 3, BO n°16 du 17/04/2025 + Exemples de réussite CM1/CM2 (Éduscol 2025) ;
   formats : guides Repères 2026 (DEPP). Synthèse : rapports de recherche du 02/10/2026
   (maths-c2 §2.2, §3.2, §4.2-4.3, §7, §9-10 ; maths-c3 §1-3, §8 ; reperes §0, §3.1, §4, §5).
   Périodes : A = classe + avancement de l'année (P1 ≈ +0 à 0,2 … P5 ≈ +0,8 à 1).
   | A           | palier          | contenu                                                                     |
   |-------------|-----------------|-----------------------------------------------------------------------------|
   | 0 – 0,35    | cp-20           | demi-droite de 1 en 1, nombres ≤ 20 (livret CP P1), portions de 10 (ou 0-20) |
   | 0,35 – 0,65 | cp-59           | de 1 en 1, ≤ 59 (BO : « au plus tard en P2 »), portions ne partant pas de 0  |
   | 0,65 – 1    | cp-100          | de 1 en 1, ≤ 100 (BO P3), deux étiquettes seulement                          |
   | 1 – 1,2     | ce1-500         | pas de 1, 10 ou 100, ≤ 500 (centaine dès P1)                                |
   | 1,2 – 2     | ce1-1000        | pas de 1, 10, 100, ≤ 1 000 ; dès 1,4 : déduire le pas de deux étiquettes     |
   |             |                 | voisines (242 et 243, 470 et 480 : BO) ; dès 1,5 : placer « à l'estime »     |
   | 2 – 2,2     | ce2-5000        | pas de 1, 10, 100, 1 000, ≤ 5 000 ; lecture saisie au pavé (Repères CE2)     |
   | 2,2 – 2,6   | ce2-10000       | idem ≤ 10 000 (BO : « au plus tard en P2 »)                                 |
   | 2,6 – 3     | ce2-fractions   | + fractions d'unité < 1 sur une règle de 0 à 1 (BO CE2 P3 : quarts,          |
   |             |                 | dixièmes, huitièmes ; dès 2,8 : demis, tiers, cinquièmes, sixièmes, douzièmes)|
   | 3 – 3,2     | cm1-p1          | entiers ≤ 9 999 (P1-P2 : au plus 4 chiffres) ; fractions (dénominateur ≤ 20, |
   |             |                 | fractions > 1 écrites 7/4 = 1 + 3/4)                                        |
   | 3,2 – 3,4   | cm1-dixiemes    | + décimaux au dixième (étude générale à partir de P2)                        |
   | 3,4 – 3,6   | cm1-grands      | entiers ≤ 999 999, graduations jusqu'à 100 000 en 100 000 (dès P3)           |
   | 3,6 – 4     | cm1-centiemes   | + centièmes (ligne en centièmes ou zoom : ER « 339,16 »)                     |
   | 4 – 4,4     | cm2-p1          | entiers ≤ 999 999 (P1-P2) ; décimaux jusqu'au millième (zoom : ER « 2,812 ») ;|
   |             |                 | pas de 0,5 (Repères CM2) ; fractions de dénominateur 2 à 12, et > 1          |
   | 4,4 – 5     | cm2-grands      | entiers ≤ 999 999 999 — jamais le milliard (6e)                             |
   | 5 – 5,6     | avance          | mêmes contenus, pas moins réguliers (2, 5, 20, 25, 50, 250, 0,25, 0,2, 0,05…)|
   |             |                 | et étiquettes espacées : le pas se déduit d'un écart                        |
   Bornes strictes : aucune fraction avant 2,6, jamais de fraction > 1 avant 3 (cycle 2) ; aucun
   décimal avant 3,2 ; ≤ 2 décimales avant 4, ≤ 3 ensuite ; entiers ≤ plafond du palier.
   Formats Repères : CP/CE1 → « lire » en QCM à 6 choix ; dès le CE2 (A ≥ 2) → « lire » au pavé
   (pas de choices) ; fractions → QCM à 6 choix. « placer » ≈ 30 % des items.

   ---------- ITEM ----------
   { axis: 'ma.ligne', kind: 'entier' | 'decimal' | 'fraction', key, A, prompt, answer (= data.value),
     choices? [{ label, value }] (fractions : + num, den), hint, explain, leitner: false, data }
   key = 'ma.ligne:<mode>:<min>-<max>:<valeur>' (nombres JS à point décimal ; fraction : 'num/den'),
         ex. 'ma.ligne:lire:40-60:47', 'ma.ligne:placer:0-2:7/4', 'ma.ligne:lire:3-4:3.47'.
   opts : avoid (Set de clés), kind ('entier' | 'decimal' | 'fraction' : imposé ; s'il n'existe pas
          encore à ce niveau, l'item est pris au premier niveau où il existe et item.A le dit),
          mode ('lire' | 'placer' : imposé).

   ---------- item.data (pour le jeu) ----------
   {
     mode: 'lire' | 'placer',
     variant,                    // forme de la ligne (indicatif) : 'pas' | 'deduire' | 'prolonger' |
                                 //   'espacees' | 'irregulier' | 'estime' | 'zoom' | 'regle'
     min, max,                   // bornes de la portion de clôture affichée (premier et dernier piquet)
     major,                      // pas des GRANDS piquets : ils sont aux multiples de major (valeurs absolues)
     minor,                      // pas des petits piquets (= major s'il n'y en a pas) ; min et max en sont
                                 //   des multiples. Piquets : min + i × minor, i = 0 … round((max − min) / minor)
                                 //   (comparer avec une marge de 1e-6 : 0,1 n'est pas exact en binaire)
     labels: [{ v, text }],      // plaquettes : valeur et écriture (fmtNum ou entier) ; ≥ 2, triées,
                                 //   espacées pour tenir sur un téléphone (≤ 12 grands intervalles, ≤ 20 petits)
     value,                      // valeur cible (le drapeau en « lire », la réponse en « placer »)
     fmt: 'int' | 'dec' | 'frac',
     num, den,                   // fraction seulement (value = num / den ; minor = 1 / den, major = 1)
     text,                       // écriture de la cible : '47', '2,8', '7/4' (jamais « 1 3/4 »)
     snap,                       // « placer » : marqueur aimanté aux piquets du plan où l'on pose
     tolerance,                  // « placer » : juste si |position − value| ≤ tolerance (unités de valeur) ;
                                 //   aimanté → une demi-graduation ; sinon 4 % de l'étendue (A < 2),
                                 //   2,5 % (A < 4), 1,5 % ensuite — étendue du plan où l'on pose
     zoom: null | { min, max, major, minor, labels }
                                 // second plan agrandi : un petit intervalle de la ligne principale
                                 //   ([zoom.min ; zoom.max], de longueur minor) ; le drapeau ou le marqueur
                                 //   est alors sur le zoom (centièmes, millièmes)
   }
   « lire » au pavé : saisie attendue fmtNum(value) (comparer parseNum(saisie) à answer, marge 1e-9).
   « placer » : answer = value ; le jeu compare la position posée avec data.tolerance. */

import { fmtNum, frTypo } from '../../core/util.js';
import { spell } from '../../core/numbers-fr.js';

export const axis = 'ma.ligne';
export const KINDS = ['entier', 'decimal', 'fraction'];
export const MODES = ['lire', 'placer'];

const A_TOP = 5.6;
const U = 1000;                       /* unité interne : le millième (tous les calculs en entiers exacts) */
const MAX_MINOR = 20, MAX_MAJOR = 12; /* lisibilité sur un téléphone de 360 px */
const P_PLACER = 0.3, N_CHOICES = 6, TRIES = 12, BUILD_TRIES = 40;
const NNBSP = '\u202f';
const KIND_FROM = { entier: 0, fraction: 2.6, decimal: 3.2 };

/* ---------- paliers ---------- */
export const PALIERS = [
  { id: 'cp-20', from: 0, to: 0.35, intMax: 20, dec: 0, kinds: { entier: 1 } },
  { id: 'cp-59', from: 0.35, to: 0.65, intMax: 59, dec: 0, kinds: { entier: 1 } },
  { id: 'cp-100', from: 0.65, to: 1, intMax: 100, dec: 0, kinds: { entier: 1 } },
  { id: 'ce1-500', from: 1, to: 1.2, intMax: 500, dec: 0, kinds: { entier: 1 } },
  { id: 'ce1-1000', from: 1.2, to: 2, intMax: 1000, dec: 0, kinds: { entier: 1 } },
  { id: 'ce2-5000', from: 2, to: 2.2, intMax: 5000, dec: 0, kinds: { entier: 1 } },
  { id: 'ce2-10000', from: 2.2, to: 2.6, intMax: 10000, dec: 0, kinds: { entier: 1 } },
  { id: 'ce2-fractions', from: 2.6, to: 3, intMax: 10000, dec: 0, kinds: { entier: 0.65, fraction: 0.35 } },
  { id: 'cm1-p1', from: 3, to: 3.2, intMax: 9999, dec: 0, kinds: { entier: 0.5, fraction: 0.5 } },
  { id: 'cm1-dixiemes', from: 3.2, to: 3.4, intMax: 9999, dec: 1, kinds: { entier: 0.35, fraction: 0.3, decimal: 0.35 } },
  { id: 'cm1-grands', from: 3.4, to: 3.6, intMax: 999999, dec: 1, kinds: { entier: 0.35, fraction: 0.3, decimal: 0.35 } },
  { id: 'cm1-centiemes', from: 3.6, to: 4, intMax: 999999, dec: 2, kinds: { entier: 0.3, fraction: 0.3, decimal: 0.4 } },
  { id: 'cm2-p1', from: 4, to: 4.4, intMax: 999999, dec: 3, kinds: { entier: 0.3, fraction: 0.25, decimal: 0.45 } },
  { id: 'cm2-grands', from: 4.4, to: 5, intMax: 999999999, dec: 3, kinds: { entier: 0.3, fraction: 0.25, decimal: 0.45 } },
  { id: 'avance', from: 5, to: A_TOP, intMax: 999999999, dec: 3, kinds: { entier: 0.3, fraction: 0.3, decimal: 0.4 } }
];
export function palierOf(A) {
  const a = clampA(A);
  return PALIERS.find(p => a < p.to) || PALIERS[PALIERS.length - 1];
}

/* ---------- outils ---------- */
function clampA(A) { const a = Number(A); return Math.min(A_TOP, Math.max(0, Number.isFinite(a) ? a : 0)); }
const r3 = x => Math.round(x * 1000) / 1000;
const r6 = x => Math.round(x * 1e6) / 1e6;
const val = u => u / U;
const toU = x => Math.round(x * U);
const fu = u => fmtNum(val(u));
const visLen = s => [...String(s)].reduce((n, c) => n + (c === NNBSP ? 0.5 : 1), 0);
const gapNeeded = len => 0.035 + 0.027 * len;      /* écart minimal entre deux plaquettes (fraction de largeur) */
const tolPct = A => (A < 2 ? 0.04 : A < 4 ? 0.025 : 0.015);
const keyNum = u => String(val(u));
const toSet = v => (v instanceof Set ? v : new Set(Array.isArray(v) ? v : []));
const piquet = (n, small) => (small ? (n > 1 ? 'petits piquets' : 'petit piquet') : n > 1 ? 'piquets' : 'piquet');
const DEC_NAME = { 100: 'un dixième', 10: 'un centième', 1: 'un millième' };
const stepText = sU => (DEC_NAME[sU] ? `${fu(sU)} (${DEC_NAME[sU]})` : fu(sU));

/* « 2,8 » → « deux unités et huit dixièmes » (lecture en unités de numération) */
const fem = w => w.replace(/(^|-)un$/, '$1une');
function decWords(u) {
  const ip = Math.floor(u / U);
  let fp = u % U, d = 3;
  while (d > 0 && fp % 10 === 0) { fp /= 10; d--; }
  if (!d) return '';
  const fw = `${spell(fp)} ${['dixième', 'centième', 'millième'][d - 1]}${fp > 1 ? 's' : ''}`;
  return ip === 0 ? fw : `${fem(spell(ip))} ${ip > 1 ? 'unités' : 'unité'} et ${fw}`;
}
/* fractions en lettres : 3/4 → « trois quarts », 7/10 → « sept dixièmes », 1/2 → « un demi » */
function denWord(den, many) {
  if (den === 2) return many ? 'demis' : 'demi';
  if (den === 3) return 'tiers';
  if (den === 4) return many ? 'quarts' : 'quart';
  let w = spell(den);
  if (w.endsWith('cinq')) w += 'u';
  else if (w.endsWith('neuf')) w = w.slice(0, -1) + 'v';
  else if (w.endsWith('e')) w = w.slice(0, -1);
  return w + 'ième' + (many ? 's' : '');
}
export const fracWords = (num, den) => `${num === 1 ? 'un' : spell(num)} ${denWord(den, num > 1)}`;
const fracText = (n, d) => `${n}/${d}`;

/* plaquettes : ajout glouton par priorité, tant que l'écart minimal est respecté */
function fitLabels(cands, minU, maxU, textOf) {
  const uniq = [...new Set(cands)].filter(t => t >= minU && t <= maxU);
  if (!uniq.length) return [];
  const g = gapNeeded(Math.max(...uniq.map(t => visLen(textOf(t)))));
  const span = maxU - minU, pos = t => (t - minU) / span;
  const out = [];
  for (const t of uniq) if (out.every(o => Math.abs(pos(o) - pos(t)) >= g - 1e-9)) out.push(t);
  return out.sort((a, b) => a - b);
}
const nearestDist = (t, labels, sU) => Math.min(...labels.map(L => Math.abs(t - L))) / sU;

/* ========== LIGNES D'ENTIERS ET DE DÉCIMAUX (valeurs en millièmes) ========== */
/* lineSpec : pas sU, sub petits intervalles par grand intervalle, n petits intervalles depuis startU.
   policy des plaquettes :
     'all'        tous les grands piquets (éclaircis s'ils ne tiennent pas)
     'all+start'  le premier piquet puis tous les grands piquets (CP débutant)
     'start+one'  le premier piquet et un grand piquet
     'two'        deux grands piquets consécutifs
     'ends'       le premier et le dernier piquet (grands)
     'adjacent'   deux piquets voisins : il faut déduire le pas (CE1 BO : 470 et 480)
     'spaced'     deux grands piquets non consécutifs (étiquettes espacées)
     'first'      les deux premiers grands piquets ; la cible est au-delà (prolonger la graduation) */
function lineSpec(rng, o) {
  const { sU, sub, n, startU, policy } = o;
  const majorU = sU * sub, endU = startU + n * sU;
  if (n > MAX_MINOR || n / sub > MAX_MAJOR || n < 2) return null;
  const ticks = [];
  for (let i = 0; i <= n; i++) ticks.push(startU + i * sU);
  const majors = ticks.filter(t => t % majorU === 0);
  let cands = null;
  if (policy === 'all') cands = majors;
  else if (policy === 'all+start') cands = [ticks[0], ...majors];
  else if (policy === 'start+one') {
    const others = majors.filter(t => t - startU >= 2 * sU);
    if (others.length) cands = [startU, rng.pick(others)];
  } else if (policy === 'two') {
    if (majors.length >= 2) { const i = rng.int(0, majors.length - 2); cands = [majors[i], majors[i + 1]]; }
  } else if (policy === 'ends') {
    if (startU % majorU === 0 && endU % majorU === 0) cands = [startU, endU];
  } else if (policy === 'adjacent') {
    const i = rng.int(0, n - 1); cands = [ticks[i], ticks[i + 1]];
  } else if (policy === 'spaced') {
    if (majors.length >= 3) {
      const i = rng.int(0, majors.length - 3), j = rng.int(i + 2, majors.length - 1);
      cands = [majors[i], majors[j]];
    }
  } else if (policy === 'first') {
    if (majors.length >= 3 && majors[0] === startU) cands = [majors[0], majors[1]];
  }
  if (!cands) return null;
  const labels = fitLabels(cands, startU, endU, fu);
  const strict = !['all', 'all+start'].includes(policy);
  if (labels.length < 2 || (strict && labels.length < new Set(cands).size)) return null;
  /* deux plaquettes sur des piquets voisins : c'est une ligne « déduire le pas » (textes adaptés) */
  const pol = labels.length === 2 && labels[1] - labels[0] === sU ? 'adjacent' : policy;
  const lab = new Set(labels), last = labels[labels.length - 1];
  const kMin = o.kMin ?? 1, kMax = o.kMax ?? n;
  const cand = ticks.filter(t => t > 0 && !lab.has(t) && (pol !== 'first' || t > last)
    && (!o.noInt || t % U !== 0) && (!o.intOnly || t % U === 0)).filter(t => {
    const d = nearestDist(t, labels, sU);
    return d >= kMin - 1e-9 && d <= kMax + 1e-9;
  });
  if (!cand.length) return null;
  return { kind: o.kind, variant: pol === 'adjacent' && o.variant === 'pas' ? 'deduire' : o.variant, sU, majorU, n,
    minU: startU, maxU: endU, labels, valueU: rng.pick(cand), policy: pol, zoom: null, estimation: false };
}
/* même chose avec un début tiré au hasard, aligné sur `align`, dans [min0 ; max − étendue] */
function regular(rng, o) {
  const sU = toU(o.s), alignU = toU(o.align ?? o.s * o.sub), spanU = o.n * sU;
  const lo = Math.ceil(toU(o.min0 || 0) / alignU), hi = Math.floor((toU(o.max) - spanU) / alignU);
  if (hi < lo) return null;
  return lineSpec(rng, { ...o, sU, startU: rng.int(lo, hi) * alignU });
}
/* placer « à l'estime » : piquets tous égaux (pas sU), cible entre deux piquets (finesse fineU) ;
   la cible est assez loin des piquets pour que la tolérance ne déborde jamais sur l'un d'eux */
function estimationSpec(rng, A, o) {
  const { sU, n, startU, fineU } = o;
  const endU = startU + n * sU;
  const ticks = [];
  for (let i = 0; i <= n; i++) ticks.push(startU + i * sU);
  const labels = fitLabels(ticks, startU, endU, fu);
  if (labels.length < 2) return null;
  const tol = Math.max(tolPct(A) * n * sU, 0.2 * sU), steps = Math.round(sU / fineU);   /* même tolérance que l'item */
  const cand = [];
  for (let i = 0; i < n; i++) for (let j = 1; j < steps; j++) {
    const v = ticks[i] + j * fineU;
    if (Math.min(j, steps - j) * fineU > tol + 0.05 * sU && (!o.noInt || v % U !== 0)) cand.push(v);
  }
  if (!cand.length) return null;
  return { kind: o.kind, variant: 'estime', sU, majorU: sU, n, minU: startU, maxU: endU, labels,
    valueU: rng.pick(cand), policy: 'all', zoom: null, estimation: true };
}
/* zoom : ligne principale de 10 petits intervalles (pas mainU) dont l'un est agrandi en 10 (pas mainU / 10) */
function zoomSpec(rng, { startU, mainU }) {
  const zU = mainU / 10;
  const endU = startU + 10 * mainU;
  const labels = fitLabels([startU, endU], startU, endU, fu);
  const t = rng.int(0, 9), zMin = startU + t * mainU, zMax = zMin + mainU;
  const zLabels = fitLabels([zMin, zMax], zMin, zMax, fu);
  if (labels.length < 2 || zLabels.length < 2) return null;
  return { kind: 'decimal', variant: 'zoom', sU: mainU, majorU: mainU * 5, n: 10, minU: startU, maxU: endU, labels,
    valueU: zMin + rng.int(1, 9) * zU, policy: 'ends', estimation: false,
    zoom: { sU: zU, majorU: zU * 5, n: 10, minU: zMin, maxU: zMax, labels: zLabels } };
}

/* ---------- entiers par palier ---------- */
function entierSpec(rng, A, pal, estimate) {
  const max = pal.intMax;
  if (estimate) {
    /* pas des piquets ≥ 10 (on vise entre deux piquets) ; peu d'intervalles pour une tolérance juste */
    const steps = [10, 100, 1000, 10000, 100000, 1000000, 10000000].filter(s => s * 4 <= max && (A >= 2 || s <= 100));
    const sU = toU(rng.pick(steps)), n = rng.int(4, A < 2 ? 6 : 8);
    const lo = 0, hi = Math.floor((toU(max) - n * sU) / sU);
    if (hi < lo) return null;
    return estimationSpec(rng, A, { kind: 'entier', sU, n, startU: rng.int(lo, hi) * sU, fineU: sU / 10 });
  }
  if (A < 1) {                                            /* CP : de 1 en 1 */
    if (A < 0.35) {
      const n = rng.weighted([10, 15, 20], [0.6, 0.25, 0.15]);
      const start = n === 20 ? 0 : rng.chance(0.5) ? rng.pick([0, 5, 10].filter(x => x + n <= max)) : rng.int(1, max - n);
      return lineSpec(rng, { kind: 'entier', variant: 'pas', sU: U, sub: 5, n, startU: start * U,
        policy: A < 0.2 ? 'all+start' : 'start+one', kMax: 4 });
    }
    const n = rng.chance(0.5) ? 10 : 20, sub = n === 10 ? 5 : rng.pick([5, 10]);
    const start = rng.chance(0.85) ? rng.int(1, max - n) : 0;
    return lineSpec(rng, { kind: 'entier', variant: 'pas', sU: U, sub, n, startU: start * U,
      policy: A < 0.65 ? 'start+one' : 'two', kMax: 6 });
  }
  if (A < 2) {                                            /* CE1 : pas de 1, 10, 100 */
    const v = rng.weighted(['pas1', 'pas10', 'pas100', 'deduire'], [0.3, 0.37, 0.18, A >= 1.4 ? 0.2 : 0]);
    if (v === 'pas1') {
      const n = rng.pick([10, 20]), sub = n === 10 ? rng.pick([5, 10]) : 10;
      return regular(rng, { kind: 'entier', variant: 'pas', s: 1, sub, n, max, align: rng.chance(0.6) ? sub : 1,
        policy: n === 20 ? 'all' : 'two', kMax: 8 });
    }
    if (v === 'pas10') {
      const n = rng.pick([10, 20]), sub = rng.pick([5, 10]);
      return regular(rng, { kind: 'entier', variant: 'pas', s: 10, sub, n, max, policy: rng.chance(0.6) ? 'all' : 'two', kMax: 8 });
    }
    if (v === 'pas100') {
      const n = Math.min(10, max / 100), sub = n === 10 ? rng.pick([1, 5]) : 1;
      return regular(rng, { kind: 'entier', variant: 'pas', s: 100, sub, n, max, align: 100,
        policy: sub === 1 ? (A >= 1.4 ? rng.pick(['adjacent', 'ends']) : 'ends') : 'all', kMin: 1, kMax: 8 });
    }
    return deduireSpec(rng, rng.pick([1, 10, 100]), max);
  }
  if (A < 3 || max < 100000) {                            /* CE2 et CM1 P1-P2 : pas de 1 à 1 000 */
    const v = rng.weighted(['pas1', 'pas10', 'pas100', 'pas1000', 'deduire'], [0.15, 0.25, 0.25, 0.15, 0.2]);
    if (v === 'deduire') return deduireSpec(rng, rng.pick([1, 10, 100, 1000]), max);
    if (v === 'pas1000') {
      const n = Math.min(10, Math.floor(max / 1000)), sub = n >= 10 ? rng.pick([1, 5]) : 1;
      return regular(rng, { kind: 'entier', variant: 'pas', s: 1000, sub, n, max, align: 1000,
        policy: sub === 1 ? rng.pick(['adjacent', 'ends']) : 'all', kMax: 9 });
    }
    const s = { pas1: 1, pas10: 10, pas100: 100 }[v];
    const n = rng.pick([10, 20]), sub = n === 20 ? 10 : rng.pick([5, 10]);
    return regular(rng, { kind: 'entier', variant: 'pas', s, sub, n, max, min0: s === 1 ? 1000 : 0,
      policy: rng.chance(0.75) ? 'all' : 'two', kMax: 9 });
  }
  if (A < 5) {                                            /* CM1 P3 → CM2 : grands nombres */
    const big = max > 1e6;
    const v = rng.weighted(['pas', 'fin', 'deduire', 'prolonger'], [0.45, 0.2, 0.2, 0.15]);
    const pows = big ? [10000, 100000, 1000000, 10000000, 100000000] : [1000, 10000, 100000];
    if (v === 'deduire') return deduireSpec(rng, rng.pick([1000, 10000]), 999999);   /* plaquettes voisines : ≤ 6 chiffres */
    if (v === 'fin') {
      /* petit pas sur un grand nombre : [347 200 ; 347 400] de 10 en 10 */
      const s = big ? rng.pick([100, 1000]) : rng.pick([10, 100]);
      return regular(rng, { kind: 'entier', variant: 'pas', s, sub: 10, n: 20, max, min0: big ? 1e6 : 10000,
        policy: 'all', kMax: 9 });
    }
    const s = rng.pick(pows);
    if (v === 'prolonger') {
      return regular(rng, { kind: 'entier', variant: 'prolonger', s: s / 10 >= 1 ? s / 10 : s, sub: 5, n: 20, max,
        align: (s / 10 >= 1 ? s / 10 : s) * 5, policy: 'first', kMax: 7 });
    }
    if (s * 10 > max) {                                   /* 100 000 en 100 000 (CM1) : [0 ; 900 000] */
      const sub = rng.pick([1, 5]), n = sub === 5 ? rng.int(5, 9) : rng.int(4, 9);
      return regular(rng, { kind: 'entier', variant: 'pas', s, sub, n, max, align: sub === 5 ? s * 5 : s,
        policy: sub === 5 ? 'two' : 'ends', kMax: 8 });
    }
    const n = rng.pick([10, 20]), sub = n === 20 ? 10 : rng.pick([5, 10]);
    return regular(rng, { kind: 'entier', variant: 'pas', s: s / 10 >= 1 ? s / 10 : s, sub, n, max,
      policy: rng.chance(0.7) ? 'all' : 'two', kMax: 9 });
  }
  /* avancé : pas irréguliers et étiquettes espacées */
  if (rng.chance(0.6)) {
    const [s, sub] = rng.weighted(IRREG_INT, IRREG_INT.map(([s]) => (String(s).startsWith('25') ? 2 : 1)));
    const n = sub === 2 ? rng.pick([12, 16, 20]) : sub === 4 ? rng.pick([12, 16, 20]) : rng.pick([15, 20]);
    /* grandeurs naturelles : au plus trois chiffres significatifs au-dessus du grand pas (437 000 de 500 en 500) */
    return regular(rng, { kind: 'entier', variant: 'irregulier', s, sub, n, max: Math.min(max, s * sub * 1000), policy: 'spaced', kMin: 2, kMax: n });
  }
  const s = rng.pick([1000, 10000, 100000, 1000000, 10000000]);
  const sub = rng.pick([2, 5]);
  return regular(rng, { kind: 'entier', variant: 'espacees', s, sub, n: 20, max: Math.min(max, s * sub * 1000), policy: 'spaced',
    kMin: 2, kMax: 20 });
}
const IRREG_INT = [[2, 5], [5, 2], [20, 5], [25, 4], [50, 2], [200, 5], [250, 4], [500, 2], [2000, 5], [2500, 4],
  [5000, 2], [25000, 4], [50000, 2], [250000, 4], [2500000, 4], [25000000, 4]];
/* deux piquets voisins étiquetés, tous les piquets égaux : il faut déduire le pas */
function deduireSpec(rng, s, max) {
  const sU = toU(s);
  let n = rng.int(6, 10);
  const hi = Math.floor((toU(max) - n * sU) / sU);
  if (hi < 0) return null;
  const startU = rng.int(0, hi) * sU;
  /* deux plaquettes voisines doivent tenir côte à côte : moins d'intervalles pour les longs nombres */
  while (n > 4 && 1 / n < gapNeeded(visLen(fu(startU + n * sU)))) n--;
  return lineSpec(rng, { kind: 'entier', variant: 'deduire', sU, sub: 1, n, startU, policy: 'adjacent', kMin: 2, kMax: n });
}

/* ---------- décimaux ---------- */
function decimalSpec(rng, A, pal, estimate) {
  const dec = pal.dec;
  const ip = () => (A < 3.8 ? (rng.chance(0.7) ? rng.int(0, 9) : rng.int(10, 20))
    : rng.weighted([() => rng.int(0, 20), () => rng.int(21, 99), () => rng.int(100, 999)], [0.65, 0.25, 0.1])());
  if (estimate && dec >= 2) {
    const sU = dec >= 3 && rng.chance(0.4) ? 10 : 100;     /* viser les centièmes entre deux dixièmes… */
    const n = rng.int(4, 8);
    const startU = ip() * U + (sU === 10 ? rng.int(0, 9) * 100 : 0);
    return estimationSpec(rng, A, { kind: 'decimal', sU, n, startU, fineU: sU / 10, noInt: true });
  }
  const variants = ['dixiemes', 'prolonger'];
  const weights = [dec === 1 ? 0.8 : 0.25, 0.2];
  if (dec >= 2) { variants.push('centZoom', 'cent'); weights.push(0.3, 0.2); }
  if (dec >= 3) { variants.push('milZoom', 'mil', 'demi'); weights.push(0.25, 0.15, 0.12); }
  if (A >= 5) { variants.push('irregulier'); weights.push(0.8); }
  const v = rng.weighted(variants, weights);
  const a = ip();
  if (v === 'dixiemes') {
    const n = rng.pick([10, 20]);
    return lineSpec(rng, { kind: 'decimal', variant: 'pas', sU: 100, sub: 10, n, startU: a * U,
      policy: A >= 5 && n === 20 ? 'ends' : 'all', noInt: true, kMax: 9 });
  }
  if (v === 'prolonger') {
    return lineSpec(rng, { kind: 'decimal', variant: 'prolonger', sU: 100, sub: 5, n: 20, startU: a * U,
      policy: 'first', noInt: true, kMax: 7 });
  }
  if (v === 'centZoom') return zoomSpec(rng, { startU: a * U, mainU: 100 });
  if (v === 'cent') {
    return lineSpec(rng, { kind: 'decimal', variant: 'pas', sU: 10, sub: 10, n: 20, startU: a * U + rng.int(0, 8) * 100,
      policy: A >= 5 ? 'ends' : 'all', noInt: true, kMax: 9 });
  }
  if (v === 'milZoom') return zoomSpec(rng, { startU: a * U + rng.int(0, 9) * 100, mainU: 10 });
  if (v === 'mil') {
    return lineSpec(rng, { kind: 'decimal', variant: 'pas', sU: 1, sub: 10, n: 20,
      startU: a * U + rng.int(0, 9) * 100 + rng.int(0, 8) * 10, policy: A >= 5 ? 'ends' : 'all', noInt: true, kMax: 9 });
  }
  if (v === 'demi') {                                     /* pas de 0,5 (Repères CM2) */
    return lineSpec(rng, { kind: 'decimal', variant: 'pas', sU: 500, sub: 2, n: 10, startU: a * U,
      policy: rng.pick(['two', 'all']), noInt: true, kMax: 6 });
  }
  /* avancé : 0,2 · 0,25 · 0,5 · 0,05 · 0,02 · 0,025, étiquettes espacées */
  const [sU, sub, n] = rng.pick([[200, 5, 20], [250, 4, 20], [250, 4, 16], [500, 2, 16], [50, 2, 20], [20, 5, 20],
    [25, 4, 20], [25, 4, 16]]);
  const startU = sU >= 200 ? a * U : a * U + rng.int(0, 5) * 100;
  return lineSpec(rng, { kind: 'decimal', variant: 'irregulier', sU, sub, n, startU, policy: 'spaced', noInt: true,
    kMin: 2, kMax: n });
}

/* ---------- fractions ---------- */
function fractionSpec(rng, A) {
  let den, startI = 0, m = 1, policy = 'all';
  if (A < 3) {                                            /* CE2 : règle de 0 à 1, fractions < 1 */
    den = A < 2.8 ? rng.pick([4, 8, 10]) : rng.weighted([4, 8, 10, 2, 3, 5, 6, 12], [3, 3, 3, 1, 1.5, 1.5, 1.5, 1.5]);
  } else {
    const cm1 = A < 4;
    m = rng.weighted([1, 2, 3, 4], cm1 ? [0.3, 0.35, 0.2, 0.15] : [0.25, 0.35, 0.25, 0.15]);
    const dens = cm1 ? [2, 3, 4, 5, 6, 8, 10, 12, 15, 20] : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const ok = dens.filter(d => d * m <= MAX_MINOR);
    den = rng.weighted(ok, ok.map(d => ([7, 9, 11, 15].includes(d) ? 0.4 : d === 20 ? 0.5 : 1)));
    if ((A >= 3.5 || !cm1) && rng.chance(0.25)) startI = rng.int(1, 2);
    if (A >= 5 && m >= 2 && rng.chance(0.7)) policy = 'spaced';
    else if (A >= 3.5 && m >= 2 && rng.chance(0.25)) policy = 'first';
  }
  const ints = [];
  for (let i = startI; i <= startI + m; i++) ints.push(i);
  let labels;
  if (policy === 'spaced') {
    const i = rng.int(0, ints.length - 3), j = rng.int(i + 2, ints.length - 1);
    labels = [ints[i], ints[j]];
  } else if (policy === 'first') labels = [ints[0], ints[1]];
  else labels = ints;
  const lo = startI * den + 1, hi = (startI + m) * den - 1;
  const nums = [];
  for (let k = lo; k <= hi; k++) if (k % den !== 0 && (policy !== 'first' || k > labels[1] * den)) nums.push(k);
  if (!nums.length) return null;
  /* CM : au moins une fois sur deux une fraction > 1 quand la ligne le permet (nouveauté du CM1) */
  const big = nums.filter(k => k > den);
  const num = A >= 3 && big.length && rng.chance(0.6) ? rng.pick(big) : rng.pick(nums);
  return { kind: 'fraction', variant: A < 3 ? 'regle' : policy === 'spaced' ? 'espacees' : policy === 'first' ? 'prolonger' : 'pas',
    den, startI, m, labels, num, policy };
}

/* ========== TEXTES (indice, explication) ========== */
/* plaquettes encadrant v (ou les deux plus proches) */
function bracket(labels, v) {
  for (let i = 0; i + 1 < labels.length; i++) if (labels[i] <= v && v <= labels[i + 1]) return [labels[i], labels[i + 1]];
  return v < labels[0] ? [labels[0], labels[1]] : [labels[labels.length - 2], labels[labels.length - 1]];
}
/* plaquette de départ du comptage : la plus proche (à égalité, celle de gauche) ; au CP, celle de gauche
   si elle est à 6 piquets ou moins (compter en avançant est plus naturel) */
function anchorOf(labels, v, sU, A) {
  const left = labels.filter(L => L < v).pop();
  if (A < 1 && left !== undefined && (v - left) / sU <= 6) return left;
  return labels.reduce((best, L) => {
    const d = Math.abs(v - L), bd = Math.abs(v - best);
    return d < bd - 1e-9 || (Math.abs(d - bd) < 1e-9 && L < best) ? L : best;
  });
}
/* les piquets franchis de L (exclu) à v (inclus) sont-ils tous petits ? */
function allSmall(plane, from, to) {
  if (plane.majorU === plane.sU) return false;
  const step = from < to ? plane.sU : -plane.sU;
  for (let t = from + step; from < to ? t <= to : t >= to; t += step) if (t % plane.majorU === 0) return false;
  return true;
}
const prefixZoom = (spec, s) => (spec.zoom ? `Dans la partie agrandie, ${s.charAt(0).toLowerCase()}${s.slice(1)}` : s);

/* étiquettes espacées : le pas se déduit d'un partage */
function stepSentence(plane) {
  const L1 = plane.labels[0], L2 = plane.labels[plane.labels.length - 1];
  const m = Math.round((L2 - L1) / plane.sU);
  const gap = L1 === 0 ? '' : `, et ${fu(L2)} − ${fu(L1)} = ${fu(L2 - L1)}`;
  return `Entre ${fu(L1)} et ${fu(L2)}, il y a ${m} petits intervalles${gap} : chaque petit piquet vaut ${fu(L2 - L1)} ÷ ${m} = ${fu(plane.sU)}.`;
}
function hintRead(spec) {
  const plane = spec.zoom || spec, v = spec.valueU;
  if (spec.policy === 'adjacent') {
    const [L1, L2] = plane.labels;
    return `Calcule l’écart entre ${fu(L1)} et ${fu(L2)}, écrits sur deux piquets voisins : c’est le pas d’un piquet au suivant. Compte ensuite les piquets jusqu’au drapeau.`;
  }
  if (spec.policy === 'spaced') {
    const L1 = plane.labels[0], L2 = plane.labels[plane.labels.length - 1];
    const m = Math.round((L2 - L1) / plane.sU);
    const gap = L1 === 0 ? fu(L2) : `l’écart ${fu(L2)} − ${fu(L1)}`;
    return `Entre ${fu(L1)} et ${fu(L2)}, il y a ${m} petits intervalles : partage ${gap} en ${m} pour trouver ce que vaut chaque petit piquet.`;
  }
  const [L1, L2] = bracket(plane.labels, v);
  const m = Math.round((L2 - L1) / plane.sU);
  if (plane.majorU === plane.sU) return prefixZoom(spec, `Entre ${fu(L1)} et ${fu(L2)}, il y a ${m} intervalles : d’un piquet au suivant, on avance de ${stepText(plane.sU)}.`);
  return prefixZoom(spec, `Entre ${fu(L1)} et ${fu(L2)}, il y a ${m} petits intervalles : chaque petit piquet vaut ${stepText(plane.sU)}.`);
}
/* « Le drapeau est 3 petits piquets après 40 : 40 + 3 = 43. » (placer : « 47 = 40 + 7 : il faut avancer… ») */
function countSentence(plane, L, v, placer) {
  const sU = plane.sU, k = Math.round(Math.abs(v - L) / sU), after = v > L;
  const small = allSmall(plane, L, v), w = piquet(k, small);
  const D = k * sU, op = after ? '+' : '−';
  const stepIs = small ? `chaque petit piquet vaut ${fu(sU)}` : `on avance de ${fu(sU)} à chaque piquet`;
  if (placer) {
    if (L === 0) return `Il faut avancer de ${k} ${w} après 0` + (sU === U ? '.' : k === 1 ? ` (${stepIs}).` : ` : ${k} ${w} font ${fu(D)} (${stepIs}).`);
    const move = after ? `avancer de ${k} ${w} après ${fu(L)}` : `reculer de ${k} ${w} avant ${fu(L)}`;
    return `${fu(v)} = ${fu(L)} ${op} ${fu(D)} : il faut ${move}` + (sU === U ? '.' : ` (${stepIs}).`);
  }
  const where = `Le drapeau est ${k} ${w} ${after ? 'après' : 'avant'} ${fu(L)}`;
  if (L === 0) {
    /* compter depuis 0 : « 0 + 200 = 200 » n'apprend rien ; on dit ce que font les piquets */
    if (sU === U) return `${where} : c’est le nombre ${fu(v)}.`;
    if (k === 1) return `${where}, et ${stepIs} : c’est le nombre ${fu(v)}.`;
    const St0 = stepIs.charAt(0).toUpperCase() + stepIs.slice(1);
    return `${where}. ${St0}, donc ${k} ${w} font ${fu(D)} : c’est le nombre ${fu(v)}.`;
  }
  if (sU === U) return `${where} : ${fu(L)} ${op} ${k} = ${fu(v)}.`;
  if (k === 1) return `${where}, et ${stepIs} : ${fu(L)} ${op} ${fu(sU)} = ${fu(v)}.`;
  const St = stepIs.charAt(0).toUpperCase() + stepIs.slice(1);
  return `${where}. ${St}, donc ${k} ${w} font ${fu(D)} : ${fu(L)} ${op} ${fu(D)} = ${fu(v)}.`;
}
function explainRead(spec, A) {
  const plane = spec.zoom || spec, v = spec.valueU;
  const L = anchorOf(plane.labels, v, plane.sU, A);
  const parts = [];
  if (spec.policy === 'adjacent') {
    const [L1, L2] = plane.labels;
    parts.push(`${fu(L2)} − ${fu(L1)} = ${fu(L2 - L1)} : d’un piquet au suivant, on avance de ${fu(L2 - L1)}.`);
  } else if (spec.policy === 'spaced') parts.push(stepSentence(plane));
  parts.push(prefixZoom(spec, countSentence(plane, L, v, false)));
  const s = parts.join(' ');
  /* lecture en unités de numération (CM1 : « quatre unités et dix-sept centièmes »), si elle reste courte */
  return spec.kind === 'decimal' && v < 100 * U ? s.replace(/\.$/, '') + ` (${decWords(v)}).` : s;
}
function hintPlace(spec) {
  const plane = spec.zoom || spec, v = spec.valueU, labels = plane.labels;
  const step = plane.majorU === plane.sU ? `On avance de ${stepText(plane.sU)} à chaque piquet.` : `Chaque petit piquet vaut ${stepText(plane.sU)}.`;
  if (spec.estimation) {
    const g1 = Math.floor((v - plane.minU) / plane.sU) * plane.sU + plane.minU;
    return `${step} Trouve les piquets ${fu(g1)} et ${fu(g1 + plane.sU)} : ${fu(v)} est entre les deux.`;
  }
  const below = labels.filter(L => L < v).pop(), above = labels.find(L => L > v);
  let where;
  if (below !== undefined && above !== undefined) where = `${fu(v)} est entre ${fu(below)} et ${fu(above)}.`;
  else if (below !== undefined) where = `${fu(v)} est plus grand que ${fu(below)} : continue après ${fu(below)}.`;
  else where = `${fu(v)} est plus petit que ${fu(above)} : cherche avant ${fu(above)}.`;
  let how = step;
  if (spec.policy === 'adjacent') how = `Calcule l’écart entre ${fu(labels[0])} et ${fu(labels[1])}, écrits sur deux piquets voisins : c’est le pas d’un piquet au suivant.`;
  else if (spec.policy === 'spaced') {
    const L1 = labels[0], L2 = labels[labels.length - 1], m = Math.round((L2 - L1) / plane.sU);
    how = `Entre ${fu(L1)} et ${fu(L2)}, il y a ${m} petits intervalles : partage ${L1 === 0 ? fu(L2) : `l’écart ${fu(L2)} − ${fu(L1)}`} en ${m} pour trouver le pas.`;
  }
  return prefixZoom(spec, `${where} ${how}`);
}
function explainPlace(spec, A) {
  const plane = spec.zoom || spec, v = spec.valueU;
  if (spec.estimation) {
    const g1 = Math.floor((v - plane.minU) / plane.sU) * plane.sU + plane.minU, g2 = g1 + plane.sU, mid = (g1 + g2) / 2;
    const base = `${fu(v)} est entre ${fu(g1)} et ${fu(g2)}. Le milieu de ces deux piquets vaut ${fu(mid)}`;
    if (v === mid) return `${base} : ${fu(v)} est juste au milieu.`;
    return v < mid ? `${base} : ${fu(v)} est un peu avant le milieu, plus près de ${fu(g1)}.`
      : `${base} : ${fu(v)} est un peu après le milieu, plus près de ${fu(g2)}.`;
  }
  const L = anchorOf(plane.labels, v, plane.sU, A);
  const parts = [];
  if (spec.policy === 'adjacent') {
    const [L1, L2] = plane.labels;
    parts.push(`${fu(L2)} − ${fu(L1)} = ${fu(L2 - L1)} : d’un piquet au suivant, on avance de ${fu(L2 - L1)}.`);
  } else if (spec.policy === 'spaced') parts.push(stepSentence(plane));
  parts.push(prefixZoom(spec, countSentence(plane, L, v, true)));
  return parts.join(' ');
}

/* ---------- fractions : textes ---------- */
function fracHint(spec, mode) {
  const { den, labels, num } = spec;
  const [L1, L2] = spec.policy === 'spaced' ? [labels[0], labels[labels.length - 1]] : bracket(labels, num / den);
  const m = (L2 - L1) * den;
  const unit = L2 - L1 === 1
    ? `Entre ${L1} et ${L2}, il y a ${m} petits intervalles : l’unité est partagée en ${den} parts égales, donc chaque petit piquet vaut 1/${den}.`
    : `Entre ${L1} et ${L2}, il y a ${m} petits intervalles : chaque unité est partagée en ${den} parts égales, donc chaque petit piquet vaut 1/${den}.`;
  if (mode === 'lire') return unit;
  if (num < den) return `${unit} Compte ${num} ${piquet(num, true)} à partir de 0.`;
  if (spec.startI === 0) return `${unit} Compte ${num} piquets à partir de 0.`;
  const E = Math.floor(num / den);
  return `${unit} ${den}/${den} = 1, donc ${fracText(num, den)} = ${E} + ${fracText(num - E * den, den)}.`;
}
function fracExplain(spec, mode) {
  const { den, num, labels } = spec;
  const E = Math.floor(num / den), k = num - E * den, words = fracWords(num, den);
  const pre = E > 0 && !labels.includes(E) ? `Les grands piquets marquent les nombres entiers : celui juste avant vaut ${E}. ` : '';
  if (mode === 'placer') {
    if (E === 0) return `${fracText(num, den)} (${words}), c’est ${num} fois 1/${den} : il faut avancer de ${num} ${piquet(num, true)} après 0.`;
    return `${pre}${fracText(num, den)} = ${E} + ${fracText(k, den)} : il faut avancer de ${k} ${piquet(k, true)} après ${E}.`;
  }
  if (E === 0) return `Le drapeau est ${num} ${piquet(num, true)} après 0 : c’est ${fracText(num, den)} (${words}).`;
  return `${pre}Le drapeau est ${k} ${piquet(k, true)} après ${E} : ${E} + ${fracText(k, den)} = ${fracText(num, den)} (${words}).`;
}

/* ========== CHOIX (QCM à 6) ========== */
function swapDigits(n) {
  const s = String(n);
  if (s.length < 2) return null;
  const t = s.slice(0, -2) + s.slice(-1) + s.slice(-2, -1);
  return t === s || t.startsWith('0') ? null : Number(t);
}
function intChoices(rng, spec, A) {
  const plane = spec, v = spec.valueU, sU = plane.sU, M = plane.majorU;
  const L = anchorOf(plane.labels, v, sU, A), k = Math.round((v - L) / sU);
  const prio = [v + sU, v - sU];
  if (sU !== U) prio.push(L + k * U);                    /* compter les piquets comme des unités */
  if (M !== sU) prio.push(v + M, v - M);                 /* confondre petit et grand pas */
  else if (sU === U) prio.push(v + 10 * U, v - 10 * U);
  const sw = swapDigits(val(v));
  if (sw !== null) prio.push(toU(sw));                   /* chiffres inversés */
  prio.push(v + 2 * sU, v - 2 * sU);
  /* distracteurs : jamais la valeur d'une plaquette (personne ne la choisirait), dans la portion d'abord */
  const lab = new Set(plane.labels);
  const ok = u => u >= 0 && u !== v && u % U === 0 && !lab.has(u);
  const inside = u => u >= plane.minU && u <= plane.maxU;
  const out = [];
  const take = u => { if (out.length < N_CHOICES - 1 && ok(u) && !out.includes(u)) out.push(u); };
  prio.filter(inside).forEach(take);
  const ticks = [];
  for (let t = plane.minU; t <= plane.maxU; t += sU) ticks.push(t);
  rng.shuffle(ticks).forEach(take);
  prio.forEach(take);
  for (let j = 3; out.length < N_CHOICES - 1 && j < 60; j++) { take(v + j * sU); take(v - j * sU); }
  return rng.shuffle([v, ...out]).map(u => ({ label: fu(u), value: val(u) }));
}
function fracChoices(rng, spec, A) {
  const { num, den, m } = spec, v = num / den, cycle2 = A < 3;
  const maxDen = cycle2 ? 12 : A < 4 ? 20 : 60;          /* dénominateurs du programme (CE2 ≤ 12, CM1 ≤ 20, CM2 ≤ 60) */
  const E = Math.floor(num / den), k = num - E * den;
  const cands = [[num + 1, den], [num - 1, den], [num, den + 1]];
  if (E >= 1) cands.push([k, den]);                      /* oublier les unités entières */
  if (!cycle2) cands.push([den, num]);                   /* fraction renversée */
  if (num < den) cands.push([den - num, den]);           /* compter depuis l'autre bout */
  if (m > 1) cands.push([num, m * den]);                 /* toute la ligne comme dénominateur */
  if (den > 2) cands.push([num, den - 1]);
  if (!cycle2 && num > 1) cands.push([num, 1]);          /* « 3/1 » (Repères CM2) */
  cands.push([num + 2, den], [num - 2, den], [1, den], [num, 2 * den]);
  const out = [], seenV = [v];
  const take = ([n, d]) => {
    if (out.length >= N_CHOICES - 1 || n < 1 || d < 1 || d > maxDen || (n === 1 && d === 1) || (cycle2 && (d < 2 || n >= d))) return;
    const x = n / d;
    if (seenV.some(y => Math.abs(y - x) < 1e-9)) return;
    seenV.push(x); out.push([n, d]);
  };
  cands.forEach(take);
  const extra = [];
  for (let d = 2; d <= 12; d++) for (let n = 1; n <= (cycle2 ? d - 1 : 3 * d); n++) extra.push([n, d]);
  rng.shuffle(extra).forEach(take);
  return rng.shuffle([[num, den], ...out]).map(([n, d]) => ({ label: fracText(n, d), value: n / d, num: n, den: d }));
}

/* ========== ASSEMBLAGE DE L'ITEM ========== */
function itemFromLine(spec, A, mode, rng) {
  const plane = spec.zoom || spec, v = spec.valueU;
  const snap = !spec.estimation;
  /* à l'estime : tolérance progressive, mais jamais moins de ±2 dixièmes d'intervalle (5 positions posables
     sur la grille fine du jeu) : une estimation juste n'est jamais refusée au doigt (revue D2-05) */
  const tolerance = r6(snap ? val(plane.sU) / 2 : Math.max(tolPct(A) * val(plane.maxU - plane.minU), 0.2 * val(plane.sU)));
  const planeData = p => ({ min: val(p.minU), max: val(p.maxU), major: val(p.majorU), minor: val(p.sU),
    labels: p.labels.map(L => ({ v: val(L), text: fu(L) })) });
  const text = fu(v);
  const data = { mode, variant: spec.variant, ...planeData(spec), value: val(v), fmt: spec.kind === 'decimal' ? 'dec' : 'int',
    text, snap, tolerance, zoom: spec.zoom ? planeData(spec.zoom) : null };
  const item = {
    axis, kind: spec.kind, key: `${axis}:${mode}:${keyNum(spec.minU)}-${keyNum(spec.maxU)}:${keyNum(v)}`, A: r3(A),
    prompt: mode === 'lire' ? frTypo('Quel nombre se cache sous le drapeau ?') : `Place ${text} sur la clôture.`,
    answer: val(v),
    hint: frTypo(mode === 'lire' ? hintRead(spec) : hintPlace(spec)),
    explain: frTypo(mode === 'lire' ? explainRead(spec, A) : explainPlace(spec, A)),
    leitner: false, data
  };
  if (mode === 'lire' && A < 2 && spec.kind === 'entier' && !spec.zoom) item.choices = intChoices(rng, spec, A);
  return item;
}
function itemFromFraction(spec, A, mode, rng) {
  const { den, num, startI, m, labels } = spec;
  const text = fracText(num, den);
  const data = { mode, variant: spec.variant, min: startI, max: startI + m, major: 1, minor: 1 / den,
    labels: labels.map(i => ({ v: i, text: String(i) })), value: num / den, fmt: 'frac', num, den, text,
    snap: true, tolerance: r6(1 / den / 2), zoom: null };
  const item = {
    axis, kind: 'fraction', key: `${axis}:${mode}:${startI}-${startI + m}:${text}`, A: r3(A),
    prompt: mode === 'lire' ? frTypo('Quelle fraction se cache sous le drapeau ?') : `Place ${text} sur la clôture.`,
    answer: num / den,
    hint: frTypo(fracHint(spec, mode)),
    explain: frTypo(fracExplain(spec, mode)),
    leitner: false, data
  };
  if (mode === 'lire') item.choices = fracChoices(rng, spec, A);
  return item;
}

function build(A, rng, opts) {
  const pal = palierOf(A);
  const kinds = Object.keys(pal.kinds);
  const kind = KINDS.includes(opts.kind) ? opts.kind : rng.weighted(kinds, kinds.map(k => pal.kinds[k]));
  const mode = MODES.includes(opts.mode) ? opts.mode : rng.chance(P_PLACER) ? 'placer' : 'lire';
  for (let i = 0; i < BUILD_TRIES; i++) {
    if (kind === 'fraction') {
      const spec = fractionSpec(rng, A);
      if (spec) return itemFromFraction(spec, A, mode, rng);
      continue;
    }
    const estimate = mode === 'placer' && A >= 1.5 && (kind === 'entier' || pal.dec >= 2) && rng.chance(0.35);
    const spec = kind === 'decimal' ? decimalSpec(rng, A, pal, estimate) : entierSpec(rng, A, pal, estimate);
    if (spec) return itemFromLine(spec, A, mode, rng);
  }
  /* filet (jamais atteint en pratique) : une ligne de 1 en 1 */
  return itemFromLine(lineSpec(rng, { kind: 'entier', variant: 'pas', sU: U, sub: 5, n: 10, startU: 0, policy: 'all', kMax: 10 }),
    A, mode, rng);
}

/* gen(A, rng, opts) : opts.avoid (Set de clés), opts.kind, opts.mode */
export function gen(A, rng, opts = {}) {
  const o = opts || {};
  let a = clampA(A);
  if (KINDS.includes(o.kind)) a = Math.max(a, KIND_FROM[o.kind]);   /* sous-type pas encore au programme → premier niveau où il l'est */
  const avoid = toSet(o.avoid);
  let item = null;
  for (let i = 0; i < TRIES; i++) {
    item = build(a, rng, o);
    if (!avoid.has(item.key)) break;
  }
  return item;
}
