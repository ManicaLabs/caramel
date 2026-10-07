/* ============ CALENDRIER DES NOTIONS : quand une notion devient « vue en classe » (v2.5) ============
   Module pur (aucun DOM, aucun stockage) : importable dans Node.
   Étude du 07/10/2026 (rapport « progression ») et décisions du parent du même jour :
     - rythme « Au rythme de la classe » par défaut pour tous les enfants (settings.rythme, réglable par enfant) ;
     - une notion devient « vue » ≈ 2 semaines après le début de sa période (LAG) ; la rentrée commence par 2 semaines
       de révisions de l'année précédente ; en été, rien de la classe suivante ;
     - bouton « 🌱 Pas encore appris » après une première erreur (jamais au CP, ni en défi, ni avec un copain) ;
     - réglage du parent par famille de notions : « Déjà vu en classe » / « Pas encore vu ».

   ---------- ÉCHELLE ----------
   Niveau absolu A (js/core/levels.js) : 0 = rentrée de CP … 4 = rentrée de CM2, + 0,1 par mois de septembre à juin.
   Périodes : P1 sept-oct (+0), P2 nov-déc (+0,2), P3 janv-fév (+0,4), P4 mars-avril (+0,6), P5 mai-juin (+0,8).
   atLevel('CE1-P3') = 1 + 0,4 = 1,4. Une date peut aussi être un nombre (seuil exact d'un générateur).

   ---------- CE QUE VOIT LE MOTEUR (js/core/manche.js) ----------
   calLevel(profil, jour) = indice de classe + avancement de l'année − LAG (+ 0,2 en « Un peu en avance » ;
   ∞ en « Selon ses réussites »). La manche demande au générateur A = min(niveau visé par θ, calLevel) : rien au-delà
   de ce qui est vu en classe à cette date, θ (radar, médailles) reste la mesure de l'enfant, inchangée.
   calState(profil, axe, jour) → { cap, locked, vu } : notions verrouillées (calendrier plus tardif que le seuil du
   générateur, reports de l'enfant, « Pas encore vu » du parent) et notions débloquées par le parent (« Déjà vu »).
   Un item est refusé si l'une de ses notions est verrouillée (item.notion, item.notions).

   ---------- NOTIONS DÉCLARÉES PAR UN GÉNÉRATEUR (extension, ex. « Missions du ranch ») ----------
   Un module de contenu (js/content/…) peut déclarer ses notions SANS modifier ce fichier :
     export const CALENDAR = {
       notions:  { '<axe>:<notion>': { at: 'CE1-P2' | 1.25, fam: '<axe>:<famille>', src: 'bo' | 'livret' | '2019'
                                       | 'annee' | 'courant' | 'caramel', note?: '…' } },
       families: { '<axe>:<famille>': { child: 'les problèmes de partage', adult: 'Problèmes de partage', icon: '🍰' } }
     };
   - id de notion et de famille : '<axe>:<nom>' (axe 'ma.problemes'…, nom en [A-Za-z0-9_.-], 40 caractères au plus) ;
   - at : période où la notion devient « vue » (voir l'échelle) ; le générateur ne doit pas la servir avant (son
     seuil interne lo ≤ A suffit si lo ≥ atLevel(at)) ;
   - child : complète « Tu n’as pas encore appris … en classe ? » (« la table de 8 », « à compter de 25 en 25 ») ;
     adult : libellé de l'espace parents ; icon : un emoji ;
   - chaque item porte item.notion (la notion la plus récente qu'il mobilise, celle qui fixe item.A) et, s'il en
     mobilise plusieurs, item.notions (toutes, la principale en premier) ;
   - facultatif : export function notionOfKey(clé Leitner) → id de notion (axes à répétition espacée).
   - facultatif : gen(A, rng, { locked }) — Set des notions verrouillées pour ce tirage (la manche le passe ; un générateur
     qui ne l'utilise pas voit ses items verrouillés retirés et tirés à nouveau).
   La manche appelle useGenerator(module) avant chaque tirage (fusion idempotente) ; l'espace parents charge les
   générateurs des familles qu'il affiche. Une notion inconnue n'est jamais verrouillée (seul le plafond s'applique).

   ---------- DONNÉES DU PROFIL (normalisées par js/core/profiles.js) ----------
   settings.rythme = 'ecole' (défaut) | 'avance' | 'libre'
   profile.cal = {                                     facultatif ; effacé au changement de classe (setClasse)
     later:  { '<famille>': { d, until, n, ex, ax } }  reports de l'enfant : depuis d, jusqu'au jour until exclu ;
                                                        n = reports de suite ; ex = exemple de question ; ax = axe
     parent: { '<famille>': { s: 'vu' | 'pasvu', d } } réglages du parent pour l'année en cours
   }
   Bouton (canPostpone / postpone) : une fois par partie (manche), après une première erreur, 3 familles en attente au
   plus, jamais plus de 2 reports de suite pour une famille (ensuite seul un parent peut : « Pas encore vu »),
   seulement pour une notion de l'année en cours (ou d'une année suivante en « Selon ses réussites »), jamais au CP,
   jamais en défi ni avec un copain. Effet : jusqu'au 1er du mois suivant, au moins 14 jours. Aucun effet sur θ, le
   radar ni les médailles : l'item n'est pas rapporté. */

import { gradeIndex, yearFrac } from '../core/levels.js';
import { CLASSES } from '../core/axes.js';
import { addDays, parseDay, dayStr, fmtNum } from '../core/util.js';

export const LAG = 0.05;                                  /* « vue » ≈ 2 semaines après le début de la période */
export const PERIOD_START = Object.freeze([0, 0.2, 0.4, 0.6, 0.8]);
export const PERIOD_MONTHS = Object.freeze(['septembre-octobre', 'novembre-décembre', 'janvier-février', 'mars-avril', 'mai-juin']);
export const RYTHMES = Object.freeze(['ecole', 'avance', 'libre']);
export const DEFAULT_RYTHME = 'ecole';
export const RYTHME_SHIFT = Object.freeze({ ecole: 0, avance: 0.2, libre: null });
export const RYTHME_LABEL = Object.freeze({ ecole: 'Au rythme de la classe', avance: 'Un peu en avance', libre: 'Selon ses réussites' });
/* bouton « Pas encore appris » : familles en attente au plus, reports de suite au plus, durée minimale, et délai après
   lequel une famille revenue sans nouveau report repart de zéro */
export const LATER = Object.freeze({ max: 3, streak: 2, minDays: 14, resetDays: 30 });
export const LATER_MODES = Object.freeze(['libre', 'balade']);
export const FAM_RE = /^[a-z]{2}\.[a-z_]+:[A-Za-z0-9_.-]{1,40}$/;

const EPS = 1e-9;
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isDay = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const r3 = x => Math.round(x * 1000) / 1000;

/* ---------- échelle ---------- */
/* 'CE1-P3' → 1,4 ; 'CM2' → 4 ; nombre → lui-même ; illisible → NaN */
export function atLevel(at) {
  if (typeof at === 'number') return Number.isFinite(at) ? at : NaN;
  const m = /^(CP|CE1|CE2|CM1|CM2)(?:-P([1-5]))?$/.exec(String(at || '').trim().toUpperCase());
  if (!m) return NaN;
  return r3(CLASSES.indexOf(m[1]) + (m[2] ? PERIOD_START[Number(m[2]) - 1] : 0));
}
/* 1,47 → { classe: 'CE1', period: 3 } (classe bornée au CM2) */
export function periodOf(level) {
  const L = Math.max(0, Number(level) || 0);
  const gi = Math.min(4, Math.floor(L + EPS));
  const f = L - gi;
  let p = 1;
  for (let i = 0; i < PERIOD_START.length; i++) if (f + EPS >= PERIOD_START[i]) p = i + 1;
  return { classe: CLASSES[gi], period: gi < Math.floor(L + EPS) ? 5 : p };
}

/* ============ CALENDRIER DE RÉFÉRENCE ============
   Sources (rapport progression-sources) : bo = date écrite dans le programme 2024-2025 (BO n°41 du 31/10/2024, cycle 2 ;
   BO n°16 du 17/04/2025, cycle 3) ; livret = livrets d'accompagnement Éduscol 2025 ; 2019 = repères annuels de 2019
   (anciens programmes, second avis) ; annee = le programme ne donne que l'année (ordre éventuel) ; courant =
   progressions de manuels ; caramel = choix interne (seuil du générateur). ✱ = date corrigée dans le générateur. */
const N = (at, fam, src, note) => ({ at, fam, src, ...(note ? { note } : {}) });

const BUILTIN_NOTIONS = {
  /* ---------- ma.faits (Galop des tables) ---------- */
  'ma.faits:add.s9': N('CP-P1', 'ma.faits:add', 'bo', 'sommes ≤ 9 (tables réintroduites en P1-P2)'),
  'ma.faits:c10': N('CP-P1', 'ma.faits:add', 'bo', 'compléments à 10'),
  'ma.faits:add.s13': N('CP-P2', 'ma.faits:add', 'bo', 'sommes ≤ 13, + 0'),
  'ma.faits:add.passage': N('CP-P4', 'ma.faits:add', 'bo', 'passage de la dizaine (8 + 5)'),
  'ma.faits:dbl.cp1': N('CP-P1', 'ma.faits:doubles', 'bo', 'doubles 1-5, moitiés 2-10'),
  'ma.faits:dbl.cp2': N('CP-P2', 'ma.faits:doubles', 'bo', 'doubles 6-10, moitiés 12-20 (au plus tard P2)'),
  'ma.faits:dbl.cp4': N('CP-P4', 'ma.faits:doubles', 'bo', 'doubles 20-50, moitiés 40-100'),
  'ma.faits:dbl.ce1': N('CE1-P1', 'ma.faits:doubles', 'livret', 'doubles 11-15, 25-45, 100-500 ; moitiés 22-30, 50-90, 200-1\u202f000'),
  'ma.faits:dbl.ce2': N('CE2-P1', 'ma.faits:doubles', 'bo', 'doubles 16-20, 60, 75, 400, 600 ; moitiés 32-40, 120…'),
  'ma.faits:half.cm2': N('CM2-P1', 'ma.faits:doubles', 'bo', 'moitiés des impairs (4,5)'),
  /* tables de multiplication : livret CE1 2025 (1 à 6 et 10 en P1-P2, 7 en P3, 8 en P4, toutes en P5) */
  'ma.faits:t1': N('CE1-P1', 'ma.faits:t1', 'livret'),
  'ma.faits:t2': N('CE1-P1', 'ma.faits:t2', 'livret'),
  'ma.faits:t5': N('CE1-P1', 'ma.faits:t5', 'livret'),
  'ma.faits:t10': N('CE1-P1', 'ma.faits:t10', 'livret'),
  'ma.faits:t3': N('CE1-P2', 'ma.faits:t3', 'livret'),
  'ma.faits:t4': N('CE1-P2', 'ma.faits:t4', 'livret'),
  'ma.faits:t6': N('CE1-P2', 'ma.faits:t6', 'livret'),
  'ma.faits:t0': N('CE1-P2', 'ma.faits:t0', 'caramel'),
  'ma.faits:t7': N('CE1-P3', 'ma.faits:t7', 'livret'),
  'ma.faits:t8': N('CE1-P4', 'ma.faits:t8', 'livret'),
  'ma.faits:t9': N('CE1-P5', 'ma.faits:t9', 'livret', 'toutes les tables en P5'),
  'ma.faits:x25': N('CE1-P3', 'ma.faits:x25', 'bo', '25 × 1 à 4 (attendu de fin de CE1)'),
  'ma.faits:facteur': N('CE1-P3', 'ma.faits:facteur', 'bo', 'tables « dans les deux sens » (7 × … = 56)'),
  'ma.faits:dec60': N('CE2-P2', 'ma.faits:dec60', 'bo', 'décompositions de 60 (fin de CE2)'),
  'ma.faits:div': N('CM1-P1', 'ma.faits:div', 'bo', 'quotients associés aux tables (56 ÷ 8)'),
  'ma.faits:p10': N('CM1-P1', 'ma.faits:p10', 'bo', 'entier × 10, 100, 1\u202f000'),
  'ma.faits:p10.dec': N('CM1-P2', 'ma.faits:p10', 'bo', 'décimal × et ÷ 10 (décimaux dès la P2 du CM1)'),
  'ma.faits:p10.dec3': N('CM2-P1', 'ma.faits:p10', 'bo', 'décimal × et ÷ 100, 1\u202f000 (millièmes)'),

  /* ---------- ma.ligne (Chemin de la clôture) ---------- */
  'ma.ligne:n20': N('CP-P1', 'ma.ligne:n100', 'livret', 'nombres ≤ 20'),
  'ma.ligne:n59': N('CP-P2', 'ma.ligne:n100', 'bo', 'nombres ≤ 59 « au plus tard en période 2 »'),
  'ma.ligne:n100': N('CP-P3', 'ma.ligne:n100', 'bo', '✱ nombres ≤ 100 « au plus tard en période 3 » (était P4)'),
  'ma.ligne:n500': N('CE1-P1', 'ma.ligne:n1000', 'bo', 'centaine « dès le début de la période 1 »'),
  'ma.ligne:n1000': N('CE1-P2', 'ma.ligne:n1000', 'bo', 'mille « au plus tard en période 2 »'),
  'ma.ligne:n5000': N('CE2-P1', 'ma.ligne:n10000', 'bo', 'nombres > 1\u202f000 dès la période 1'),
  'ma.ligne:n10000': N('CE2-P2', 'ma.ligne:n10000', 'bo', '10\u202f000 « au plus tard en période 2 »'),
  'ma.ligne:frac': N('CE2-P4', 'ma.ligne:fractions', 'bo', 'fractions d’unité (quarts, dixièmes, huitièmes), à partir de P3'),
  'ma.ligne:frac2': N('CE2-P5', 'ma.ligne:fractions', 'caramel', 'demis, tiers, cinquièmes, sixièmes, douzièmes'),
  'ma.ligne:frac.sup1': N('CM1-P1', 'ma.ligne:fractions', 'bo', 'fractions > 1 dès la période 1'),
  'ma.ligne:dec1': N('CM1-P2', 'ma.ligne:decimaux', 'bo', 'dixièmes (décimaux dès la période 2)'),
  'ma.ligne:n999999': N('CM1-P3', 'ma.ligne:grands', 'bo', 'nombres à 5 et 6 chiffres à partir de P3'),
  'ma.ligne:dec2': N('CM1-P4', 'ma.ligne:decimaux', 'courant', 'centièmes'),
  'ma.ligne:dec3': N('CM2-P1', 'ma.ligne:decimaux', 'bo', 'millièmes, pas de 0,5'),
  'ma.ligne:n1e9': N('CM2-P3', 'ma.ligne:grands', 'bo', 'millions et milliards (6 chiffres au plus en P1-P2)'),

  /* ---------- ma.operations (Atelier des opérations) ---------- */
  'ma.operations:add.cp': N('CP-P4', 'ma.operations:add', 'bo', 'addition posée « en période 4 ou 5 » (jeu dès le CE1)'),
  'ma.operations:add.ce1': N('CE1-P1', 'ma.operations:add', 'bo', 'addition posée dès le début de l’année'),
  'ma.operations:add.ce2': N('CE2-P1', 'ma.operations:add', 'bo', '+ jusqu’à 9 999'),
  'ma.operations:sub': N('CE1-P3', 'ma.operations:sub', 'bo', 'soustraction posée « en période 3 au plus tard »'),
  'ma.operations:sub.retenue': N('CE1-P4', 'ma.operations:sub', 'caramel', 'avec retenue, zéro à traverser'),
  'ma.operations:sub.ce2': N('CE2-P1', 'ma.operations:sub', 'bo', '− jusqu’à 9 999'),
  'ma.operations:add.euros': N('CE2-P2', 'ma.operations:euros', 'bo', '✱ addition de montants « au plus tard en période 2 » (était P3)'),
  'ma.operations:sub.euros': N('CE2-P4', 'ma.operations:euros', 'bo', 'soustraction de montants « au plus tard en période 4 »'),
  'ma.operations:mul': N('CE2-P4', 'ma.operations:mul', 'bo', 'multiplication posée « en période 4 au plus tard »'),
  'ma.operations:mul.cm1': N('CM1-P1', 'ma.operations:mul', 'bo', 'multiplications posées dès le début de l’année'),
  'ma.operations:div': N('CM1-P2', 'ma.operations:div', 'courant', 'division euclidienne posée (BO : année ; 2019 : P3)'),
  'ma.operations:dec': N('CM1-P2', 'ma.operations:decimaux', 'bo', 'décimaux en colonnes, décimal × entier < 10'),
  'ma.operations:grands': N('CM1-P3', 'ma.operations:grands', 'bo', 'nombres à 5 et 6 chiffres'),
  'ma.operations:dec.cm2': N('CM2-P1', 'ma.operations:decimaux', 'bo', 'décimal × entier, millièmes (dès le début de l’année)'),
  'ma.operations:divdec': N('CM2-P2', 'ma.operations:divdec', '2019', '✱ quotient décimal de deux entiers « dès la période 2 » (était P1)'),
  'ma.operations:divdec.dec': N('CM2-P3', 'ma.operations:divdec', '2019', '✱ dividende décimal « dès la période 3 » (était P2)'),
  'ma.operations:grands.cm2': N('CM2-P3', 'ma.operations:grands', 'bo', 'au-delà du million'),

  /* ---------- fr.conjug (Chef d'orchestre) : le programme ne donne que l'année ; ordre écrit au CE1 ---------- */
  'fr.conjug:present.cp': N('CP-P1', 'fr.conjug:present', 'bo', 'être et avoir au présent'),
  'fr.conjug:present': N('CE1-P1', 'fr.conjug:present', 'bo', 'présent du 1er groupe'),
  'fr.conjug:imparfait': N('CE1-P3', 'fr.conjug:imparfait', 'annee', '✱ « présent, imparfait, futur puis passé composé » (était P2)'),
  'fr.conjug:futur': N('CE1-P4', 'fr.conjug:futur', 'annee'),
  'fr.conjug:passe_compose': N('CE1-P5', 'fr.conjug:passe_compose', 'annee'),
  'fr.conjug:temps': N('CE1-P5', 'fr.conjug:temps', 'annee', 'reconnaître le temps parmi 4 (Repères début de CE2)'),
  'fr.conjug:present.irr': N('CE2-P1', 'fr.conjug:present', 'annee', 'faire, aller, dire, venir, pouvoir, voir, vouloir, prendre'),
  'fr.conjug:imparfait.irr': N('CE2-P2', 'fr.conjug:imparfait', 'annee'),
  'fr.conjug:futur.irr': N('CE2-P3', 'fr.conjug:futur', 'annee'),
  'fr.conjug:passe_compose.irr': N('CE2-P4', 'fr.conjug:passe_compose', 'annee'),
  'fr.conjug:present.g2': N('CM1-P1', 'fr.conjug:present', 'annee', '2e groupe et verbes de la même famille'),
  'fr.conjug:imparfait.g2': N('CM1-P2', 'fr.conjug:imparfait', 'annee'),
  'fr.conjug:futur.g2': N('CM1-P3', 'fr.conjug:futur', 'annee'),
  'fr.conjug:passe_compose.g2': N('CM1-P4', 'fr.conjug:passe_compose', 'annee'),
  'fr.conjug:radical': N('CM1-P1', 'fr.conjug:radical', 'annee', 'variations du radical (-ger, -cer, -eler, -eter, -yer)'),
  'fr.conjug:participe.etre': N('CM1-P3', 'fr.conjug:participe', 'annee', 'accord du participe passé avec être'),
  'fr.conjug:passe_simple': N('CM2-P2', 'fr.conjug:passe_simple', 'courant', '✱ il, ils (était P1)'),
  'fr.conjug:passe_simple.pers': N('CM2-P3', 'fr.conjug:passe_simple', 'courant', 'je, tu, nous, vous : de P3 à P5'),
  'fr.conjug:plus_que_parfait': N('CM2-P3', 'fr.conjug:plus_que_parfait', 'courant', '✱ après le passé simple (était P2)'),
  'fr.conjug:participe.cod': N('CM2-P3', 'fr.conjug:participe', 'annee', 'avec avoir et le COD placé avant'),
  'fr.conjug:sujet.ce1': N('CE1-P1', 'fr.conjug:sujet', 'bo', 'prénom, groupe nominal court'),
  'fr.conjug:sujet.ce2': N('CE2-P1', 'fr.conjug:sujet', 'caramel', 'sujet après un complément, passage au pluriel'),
  'fr.conjug:sujet.cm1': N('CM1-P1', 'fr.conjug:sujet', 'annee', 'complément du nom, plusieurs noms'),
  'fr.conjug:sujet.cm2': N('CM2-P2', 'fr.conjug:sujet', 'caramel', 'sujet inversé, dialogue, question, pronom complément')
};

/* ---------- ma.procedures (Pommes express) : 46 procédures, chacune datée par son seuil dans le générateur
   (programmes 2024-2025 ; « le plafond suffit », rapport §3.3) ; une notion par procédure ET par année où elle
   s'entraîne : 'ma.procedures:plus9.ce1' (+ 19, + 29 au CE1). Année d'arrivée : la date du générateur ; années
   suivantes : leur période 1. ---------- */
const PROC = {
  plus1: [0, 'pm12'], moins1: [0, 'pm12'], plus2: [0.05, 'pm12'], moins2: [0.05, 'pm12'],
  plus10: [0.15, 'dizaines'], moins10: [0.15, 'dizaines'], plusDiz: [0.3, 'dizaines'], moinsDiz: [0.3, 'dizaines'],
  plusCent: [1, 'dizaines'], moinsCent: [1, 'dizaines'],
  plusPetit: [0.2, 'petits'], moinsPetit: [1.1, 'petits'], plusPassage: [0.45, 'petits'], moinsPassage: [1.4, 'petits'],
  dizMoins: [0.5, 'petits'],
  complDiz: [0.25, 'complements'], compl100: [2.4, 'complements'],
  plus9: [0.55, 'pm9'], moins9: [1.35, 'pm9'], plus8: [2.1, 'pm9'], moins8: [3, 'pm9'],
  deuxNombres: [0.6, 'deux'], moitie: [0.7, 'moitie'],
  fois10: [1.15, 'fois10'], fois100: [2.1, 'fois10'], fois1000: [3.2, 'fois10'], foisDiz: [2.2, 'fois10'],
  foisCent: [3.1, 'fois10'], produitRonds: [4.1, 'fois10'],
  distri: [1.4, 'distri'], fois4: [2.4, 'fois48'], fois8: [2.6, 'fois48'], fois5: [3.3, 'fois5'], fois50: [4.5, 'fois5'],
  decPlus: [3.3, 'decimaux'], decMoins: [3.35, 'decimaux'], decRetenue: [4.2, 'decimaux'], decFois: [3.3, 'decimaux'],
  decDiv: [3.4, 'decimaux'], sommeDec: [4, 'decimaux'], doubleDec: [4.2, 'decimaux'], moitieDec: [4.3, 'decimaux'],
  div4: [4.2, 'div48'], div8: [4.4, 'div48'], estimation: [3.5, 'estimation'], parentheses: [3.6, 'parentheses']
};
export const PROC_KINDS = Object.freeze(Object.keys(PROC));
const CLS = ['cp', 'ce1', 'ce2', 'cm1', 'cm2'];
/* notion d'un item de calcul rapide : procédure + année de son niveau réel (jamais avant l'année d'arrivée) */
export function procNotion(kind, lo) {
  const d = PROC[kind];
  if (!d) return null;
  const y = Math.min(4, Math.max(Math.floor(d[0] + EPS), Math.floor((Number(lo) || 0) + EPS)));
  return `ma.procedures:${kind}.${CLS[y]}`;
}
for (const [kind, [from, fam]] of Object.entries(PROC)) {
  for (let y = Math.floor(from + EPS); y <= 4; y++) {
    BUILTIN_NOTIONS[`ma.procedures:${kind}.${CLS[y]}`] = N(y === Math.floor(from + EPS) ? from : y, 'ma.procedures:' + fam, 'caramel');
  }
}

/* ---------- familles : ce que voient l'enfant (« Tu n’as pas encore appris … en classe ? ») et le parent ---------- */
const F = (child, adult, icon) => ({ child, adult, icon });
const BUILTIN_FAMILIES = {
  'ma.faits:add': F('les additions de petits nombres', 'Tables d’addition', '➕'),
  'ma.faits:doubles': F('les doubles et les moitiés', 'Doubles et moitiés', '✌️'),
  'ma.faits:t0': F('à multiplier par 0', 'Multiplier par 0', '🏇'),
  'ma.faits:t1': F('la table de 1', 'Table de 1', '🏇'),
  'ma.faits:t2': F('la table de 2', 'Table de 2', '🏇'),
  'ma.faits:t3': F('la table de 3', 'Table de 3', '🏇'),
  'ma.faits:t4': F('la table de 4', 'Table de 4', '🏇'),
  'ma.faits:t5': F('la table de 5', 'Table de 5', '🏇'),
  'ma.faits:t6': F('la table de 6', 'Table de 6', '🏇'),
  'ma.faits:t7': F('la table de 7', 'Table de 7', '🏇'),
  'ma.faits:t8': F('la table de 8', 'Table de 8', '🏇'),
  'ma.faits:t9': F('la table de 9', 'Table de 9', '🏇'),
  'ma.faits:t10': F('la table de 10', 'Table de 10', '🏇'),
  'ma.faits:x25': F('à compter de 25 en 25', 'Multiples de 25 (25 × 1 à 4)', '🪙'),
  'ma.faits:facteur': F('les multiplications à trou', 'Tables dans les deux sens (7 × … = 56)', '🧩'),
  'ma.faits:dec60': F('les décompositions de 60', 'Décompositions de 60 (… × 12 = 60)', '🕐'),
  'ma.faits:div': F('les divisions des tables', 'Divisions des tables (56 ÷ 8)', '➗'),
  'ma.faits:p10': F('à multiplier et diviser par 10, 100, 1\u202f000', '× et ÷ par 10, 100, 1\u202f000', '🔟'),

  'ma.ligne:n100': F('les nombres jusqu’à 100', 'Nombres jusqu’à 100 sur la ligne', '📏'),
  'ma.ligne:n1000': F('les nombres jusqu’à 1\u202f000', 'Nombres jusqu’à 1\u202f000 sur la ligne', '📏'),
  'ma.ligne:n10000': F('les nombres jusqu’à 10\u202f000', 'Nombres jusqu’à 10\u202f000 sur la ligne', '📏'),
  'ma.ligne:grands': F('les grands nombres', 'Grands nombres sur la ligne', '📏'),
  'ma.ligne:fractions': F('les fractions', 'Fractions sur la ligne graduée', '🥧'),
  'ma.ligne:decimaux': F('les nombres à virgule', 'Nombres décimaux sur la ligne', '📏'),

  'ma.operations:add': F('l’addition posée', 'Addition posée', '🧮'),
  'ma.operations:sub': F('la soustraction posée', 'Soustraction posée', '🧮'),
  'ma.operations:mul': F('la multiplication posée', 'Multiplication posée', '🧮'),
  'ma.operations:div': F('la division posée', 'Division posée (euclidienne)', '🧮'),
  'ma.operations:divdec': F('la division avec une virgule', 'Division posée à quotient décimal', '🧮'),
  'ma.operations:euros': F('les opérations avec des euros', 'Opérations sur des montants en euros', '💶'),
  'ma.operations:decimaux': F('les opérations avec des nombres à virgule', 'Opérations posées sur des décimaux', '🧮'),
  'ma.operations:grands': F('les opérations avec de grands nombres', 'Opérations sur de grands nombres', '🧮'),

  'ma.procedures:pm12': F('à ajouter ou enlever 1 ou 2', 'Ajouter, retrancher 1 ou 2', '⚡'),
  'ma.procedures:dizaines': F('à ajouter ou enlever des dizaines', 'Ajouter, retrancher des dizaines, des centaines', '⚡'),
  'ma.procedures:petits': F('à ajouter ou enlever un petit nombre', 'Ajouter, retrancher un nombre à un chiffre', '⚡'),
  'ma.procedures:complements': F('à compléter à la dizaine ou à 100', 'Compléments à la dizaine, à 100', '⚡'),
  'ma.procedures:pm9': F('à ajouter ou enlever 9, 19, 29…', 'Ajouter, retrancher 8, 9, 19, 29…', '⚡'),
  'ma.procedures:deux': F('à additionner deux nombres de tête', 'Somme de deux nombres à deux chiffres', '⚡'),
  'ma.procedures:moitie': F('à calculer la moitié', 'Moitié d’un nombre', '⚡'),
  'ma.procedures:fois10': F('à multiplier par 10, 100 ou 1\u202f000', 'Multiplier par 10, 100, 1\u202f000, par des dizaines', '⚡'),
  'ma.procedures:distri': F('à multiplier en décomposant', 'Multiplier en décomposant (13 × 7)', '⚡'),
  'ma.procedures:fois48': F('à multiplier par 4 ou par 8', 'Multiplier par 4, par 8', '⚡'),
  'ma.procedures:fois5': F('à multiplier par 5 ou par 50', 'Multiplier par 5, par 50', '⚡'),
  'ma.procedures:decimaux': F('à calculer avec des nombres à virgule', 'Calcul mental sur les décimaux', '⚡'),
  'ma.procedures:div48': F('à diviser par 4 ou par 8', 'Diviser par 4, par 8', '⚡'),
  'ma.procedures:estimation': F('les ordres de grandeur', 'Ordres de grandeur', '⚡'),
  'ma.procedures:parentheses': F('les parenthèses', 'Calculs avec parenthèses', '⚡'),

  'fr.conjug:present': F('le présent', 'Présent', '🎻'),
  'fr.conjug:imparfait': F('l’imparfait', 'Imparfait', '🎻'),
  'fr.conjug:futur': F('le futur', 'Futur', '🎻'),
  'fr.conjug:passe_compose': F('le passé composé', 'Passé composé', '🎻'),
  'fr.conjug:passe_simple': F('le passé simple', 'Passé simple', '🎻'),
  'fr.conjug:plus_que_parfait': F('le plus-que-parfait', 'Plus-que-parfait', '🎻'),
  'fr.conjug:temps': F('à reconnaître le temps d’un verbe', 'Reconnaître le temps d’un verbe', '🎻'),
  'fr.conjug:radical': F('les verbes comme manger ou appeler', 'Variations du radical (manger, appeler, nettoyer…)', '🎻'),
  'fr.conjug:participe': F('l’accord du participe passé', 'Accord du participe passé', '🎻'),
  'fr.conjug:sujet': F('à trouver le sujet du verbe', 'Accord du verbe avec son sujet', '🎻')
};

/* ============ REGISTRE (référence + notions déclarées par les générateurs) ============ */
const NOTIONS = new Map(), FAMILIES = new Map(), KEY_MAPPERS = new Map(), SEEN_DECL = new WeakSet();
const axisOfId = id => String(id).split(':')[0];
function addNotion(id, def) {
  const at = atLevel(def && def.at);
  if (!FAM_RE.test(id) || !Number.isFinite(at)) return false;
  const fam = def.fam && FAM_RE.test(def.fam) ? def.fam : id;
  NOTIONS.set(id, Object.freeze({ id, at: def.at, level: at, fam, src: String(def.src || 'caramel'), axis: axisOfId(id),
    ...(def.note ? { note: String(def.note) } : {}) }));
  return true;
}
function addFamily(id, def) {
  if (!FAM_RE.test(id) || !isObj(def) || typeof def.child !== 'string' || !def.child) return false;
  FAMILIES.set(id, Object.freeze({ id, child: def.child, adult: typeof def.adult === 'string' && def.adult ? def.adult : def.child,
    icon: typeof def.icon === 'string' && def.icon ? def.icon : '🌱', axis: axisOfId(id) }));
  return true;
}
for (const [id, d] of Object.entries(BUILTIN_NOTIONS)) addNotion(id, d);
for (const [id, d] of Object.entries(BUILTIN_FAMILIES)) addFamily(id, d);

/* fusion d'une déclaration { notions, families } (format en tête de fichier) ; une notion de référence n'est jamais
   remplacée → nombre de notions ajoutées */
export function declare(decl) {
  if (!isObj(decl)) return 0;
  let n = 0;
  if (isObj(decl.families)) for (const [id, d] of Object.entries(decl.families)) if (!BUILTIN_FAMILIES[id]) addFamily(id, d);
  if (isObj(decl.notions)) for (const [id, d] of Object.entries(decl.notions)) if (!BUILTIN_NOTIONS[id] && addNotion(id, d)) n++;
  return n;
}
/* module de contenu (générateur) : sa déclaration CALENDAR (ou NOTIONS + FAMILIES) et son notionOfKey ; idempotent */
export function useGenerator(G) {
  if (!G || (typeof G !== 'object' && typeof G !== 'function') || SEEN_DECL.has(G)) return;
  SEEN_DECL.add(G);
  try {
    if (isObj(G.CALENDAR)) declare(G.CALENDAR);
    else if (isObj(G.NOTIONS)) declare({ notions: G.NOTIONS, families: isObj(G.FAMILIES) ? G.FAMILIES : {} });
    if (typeof G.notionOfKey === 'function' && typeof G.axis === 'string') KEY_MAPPERS.set(G.axis, G.notionOfKey);
  } catch (_) {}
}
export function notion(id) { return NOTIONS.get(id) || null; }
export function family(id) { return FAMILIES.get(id) || null; }
export function allNotions(axis) { return [...NOTIONS.values()].filter(n => !axis || n.axis === axis); }
export function allFamilies(axis) { return [...FAMILIES.values()].filter(f => !axis || f.axis === axis); }
/* notion d'une clé Leitner (générateur déclaré) ou null */
export function notionOfKey(key) {
  const k = String(key || '');
  const fn = KEY_MAPPERS.get(k.split(':')[0]);
  if (!fn) return null;
  try { const id = fn(k); return typeof id === 'string' && NOTIONS.has(id) ? id : null; } catch (_) { return null; }
}
/* notions connues d'un item (principale en premier) */
export function notionsOfItem(item) {
  if (!item || typeof item !== 'object') return [];
  const list = Array.isArray(item.notions) && item.notions.length ? item.notions : [item.notion];
  const out = [];
  for (const id of [item.notion, ...list]) if (typeof id === 'string' && NOTIONS.has(id) && !out.includes(id)) out.push(id);
  return out;
}

/* ============ DATE ET PLAFOND ============ */
export function rythmeOf(profile) {
  const r = profile && profile.settings ? profile.settings.rythme : null;
  return RYTHMES.includes(r) ? r : DEFAULT_RYTHME;
}
const monthOf = day => Number(String(day).slice(5, 7));
/* été (juillet-août) après un passage dans la classe suivante (classe choisie depuis le 1er juillet) */
export function summerNewClass(profile, day) {
  const d = dayStr(day), m = monthOf(d);
  if (m !== 7 && m !== 8) return false;
  const since = profile && isDay(profile.classeSince) ? profile.classeSince : '';
  return !!since && since >= d.slice(0, 4) + '-07-01';
}
/* jour de référence de l'échelle des niveaux (levels.absLevel / relLevel) : le 1er septembre pendant l'été qui suit un
   passage dans la classe suivante (l'attendu reste le début de la nouvelle classe, pas sa fin), sinon le jour même */
export function levelDay(profile, day) {
  const d = dayStr(day);
  return summerNewClass(profile, d) ? d.slice(0, 4) + '-09-01' : d;
}
/* avancement de l'année « vue en classe » : 0 en été après un passage de classe, sinon yearFrac */
export function calYearFrac(profile, day) {
  return summerNewClass(profile, day) ? 0 : yearFrac(dayStr(day));
}
/* plafond « vu en classe » à cette date (échelle A) ; Infinity en « Selon ses réussites ».
   Été (même classe) : toute l'année est vue, sans délai, sans avance (rien de la classe suivante). */
export function calLevel(profile, day) {
  const r = rythmeOf(profile);
  if (RYTHME_SHIFT[r] === null) return Infinity;
  const d = dayStr(day), m = monthOf(d);
  const gi = gradeIndex(profile && profile.classe);
  if ((m === 7 || m === 8) && !summerNewClass(profile, d)) return gi + 1;
  return r3(gi + calYearFrac(profile, d) - LAG + RYTHME_SHIFT[r]);
}

/* ============ REPORTS (« Pas encore appris ») ET RÉGLAGES DU PARENT ============ */
const calOf = profile => (profile && isObj(profile.cal) ? profile.cal : null);
const laterOf = profile => { const c = calOf(profile); return c && isObj(c.later) ? c.later : {}; };
const parentOf = profile => { const c = calOf(profile); return c && isObj(c.parent) ? c.parent : {}; };
function ensureCal(profile) {
  if (!isObj(profile.cal)) profile.cal = {};
  if (!isObj(profile.cal.later)) profile.cal.later = {};
  if (!isObj(profile.cal.parent)) profile.cal.parent = {};
  return profile.cal;
}
/* retour d'une famille repoussée le jour d : 1er du mois suivant, et au moins 14 jours plus tard */
export function laterUntil(day) {
  const d = parseDay(dayStr(day));
  const first = dayStr(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const min = addDays(dayStr(day), LATER.minDays);
  return first > min ? first : min;
}
const isActive = (e, day) => isObj(e) && isDay(e.until) && dayStr(day) < e.until;
/* familles repoussées encore en attente → [{ fam, d, until, n, ex, ax }] (les plus récentes d'abord) */
export function activeLater(profile, day) {
  return Object.entries(laterOf(profile)).filter(([, e]) => isActive(e, day))
    .map(([fam, e]) => ({ fam, ...e })).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
}
/* familles repoussées deux fois de suite (à regarder ensemble), en attente ou revenues depuis peu */
export function laterStreak(profile, fam, day) {
  const e = laterOf(profile)[fam];
  if (!isObj(e)) return 0;
  if (!isActive(e, day) && isDay(e.until) && addDays(e.until, LATER.resetDays) <= dayStr(day)) return 0;
  return Math.max(0, Math.trunc(Number(e.n)) || 0);
}
export function parentState(profile, fam) {
  const e = parentOf(profile)[fam];
  return isObj(e) && (e.s === 'vu' || e.s === 'pasvu') ? e.s : null;
}

/* notions verrouillées et débloquées pour un axe à cette date → { cap, locked: Set, vu: Set } */
export function calState(profile, axis, day) {
  const d = dayStr(day);
  const cap = calLevel(profile, d);
  const gi = gradeIndex(profile && profile.classe);
  const later = laterOf(profile), parent = parentOf(profile);
  const locked = new Set(), vu = new Set();
  for (const n of NOTIONS.values()) {
    if (axis && n.axis !== axis) continue;
    const year = Math.floor(n.level + EPS);
    const ps = isObj(parent[n.fam]) ? parent[n.fam].s : null;
    if (year === gi && ps === 'pasvu') { locked.add(n.id); continue; }
    if (year >= gi && isActive(later[n.fam], d)) { locked.add(n.id); continue; }
    if (n.level > cap + EPS) {
      if (year === gi && ps === 'vu') vu.add(n.id);
      else locked.add(n.id);
    }
  }
  return { cap, locked, vu };
}
/* l'item mobilise-t-il une notion verrouillée ? */
export function isBlocked(state, item) {
  if (!state || !state.locked || !state.locked.size) return false;
  return notionsOfItem(item).some(id => state.locked.has(id));
}

/* le bouton peut-il être proposé pour cet item ? ctx = { mode, used (déjà utilisé dans la partie), clean (Set des
   familles déjà réussies du premier coup dans la partie) } → { ok, why, fam, label, until } */
export function canPostpone(profile, item, day, ctx = {}) {
  const no = why => ({ ok: false, why });
  if (!profile || !isObj(item)) return no('item');
  const classe = profile.classe;
  if (!classe || classe === 'CP') return no('cp');
  if (!LATER_MODES.includes(ctx.mode || 'libre')) return no('mode');
  if (ctx.used) return no('once');
  const id = notionsOfItem(item)[0];
  const n = id ? NOTIONS.get(id) : null;
  const fam = n ? FAMILIES.get(n.fam) : null;
  if (!n || !fam) return no('notion');
  if (Math.floor(n.level + EPS) < gradeIndex(classe)) return no('passee');
  if (ctx.clean && ctx.clean.has(n.fam)) return no('reussie');
  const d = dayStr(day);
  if (activeLater(profile, d).filter(e => e.fam !== n.fam).length >= LATER.max) return no('max');
  if (laterStreak(profile, n.fam, d) >= LATER.streak) return no('streak');
  return { ok: true, why: '', fam: n.fam, notion: n.id, label: fam.child, adult: fam.adult, icon: fam.icon, until: laterUntil(d) };
}
/* exemple court de la question repoussée (espace parents) */
function exampleOf(item) {
  const d = item.data || {};
  let s = '';
  const sent = d.sentence;
  if (typeof sent === 'string' && sent) s = sent;
  else if (sent && typeof sent === 'object' && typeof sent.before === 'string' && typeof sent.after === 'string') {
    s = sent.before + '…' + sent.after + (d.cue ? ' ' + d.cue : '');      /* « À cette époque, les trains … en retard. (être, imparfait) » */
  } else if (typeof d.text === 'string' && d.text && Number.isFinite(d.min) && Number.isFinite(d.max)) {
    s = (d.mode === 'placer' ? 'placer ' : 'lire ') + d.text + ' sur une ligne de ' + fmtNum(d.min) + ' à ' + fmtNum(d.max);
  } else if (typeof item.prompt === 'string') s = item.prompt;
  s = s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > 80 ? s.slice(0, 79) + '…' : s;
}
/* report de la famille de l'item (à appeler dans store.mutateProfile, après canPostpone) → l'entrée */
export function postpone(profile, item, day) {
  const d = dayStr(day);
  const id = notionsOfItem(item)[0];
  const n = id ? NOTIONS.get(id) : null;
  if (!n) return null;
  const cal = ensureCal(profile);
  const streak = laterStreak(profile, n.fam, d);
  const entry = { d, until: laterUntil(d), n: Math.min(9, streak + 1), ex: exampleOf(item), ax: n.axis };
  cal.later[n.fam] = entry;
  return { fam: n.fam, ...entry };
}
/* « Remettre maintenant » (parent) : la famille revient dès aujourd'hui (le compte des reports de suite est gardé) */
export function release(profile, fam, day) {
  const e = laterOf(profile)[fam];
  if (!isObj(e)) return false;
  e.until = dayStr(day);
  return true;
}
/* réglage du parent pour une famille : 'vu' | 'pasvu' | null (selon le calendrier) ; « Pas encore vu » met aussi fin à un
   report de l'enfant (le parent a pris la main), « Déjà vu » aussi */
export function setParentFamily(profile, fam, s, day) {
  if (!FAM_RE.test(String(fam || ''))) return false;
  const cal = ensureCal(profile);
  if (s === 'vu' || s === 'pasvu') cal.parent[fam] = { s, d: dayStr(day) };
  else delete cal.parent[fam];
  const e = cal.later[fam];
  if (isObj(e) && isActive(e, day)) e.until = dayStr(day);
  return true;
}

/* ============ ESPACE PARENTS : le programme de l'année ============ */
/* familles de l'année de la classe, avec leurs notions de l'année, leur date et leur état à ce jour :
   [{ fam, child, adult, icon, axis, level, at, notions, state: 'vu' | 'bientot' | 'later' | 'pasvu' | 'force',
      parent: 'vu'|'pasvu'|null, later: entry|null }] (ordre : date, puis axe) */
export function yearFamilies(profile, day, axes = null) {
  const d = dayStr(day);
  const gi = gradeIndex(profile && profile.classe);
  const cap = calLevel(profile, d);
  const byFam = new Map();
  for (const n of NOTIONS.values()) {
    if (Math.floor(n.level + EPS) !== gi || (axes && !axes.includes(n.axis))) continue;
    const f = FAMILIES.get(n.fam);
    if (!f) continue;
    const cur = byFam.get(n.fam) || { fam: n.fam, child: f.child, adult: f.adult, icon: f.icon, axis: f.axis, level: Infinity, notions: [] };
    cur.level = Math.min(cur.level, n.level);
    cur.notions.push(n.id);
    byFam.set(n.fam, cur);
  }
  const later = laterOf(profile);
  const out = [];
  for (const x of byFam.values()) {
    const ps = parentState(profile, x.fam);
    const le = isActive(later[x.fam], d) ? { fam: x.fam, ...later[x.fam] } : null;
    const seen = x.level <= cap + EPS;
    x.at = periodOf(x.level);
    x.parent = ps;
    x.later = le;
    x.state = ps === 'pasvu' ? 'pasvu' : le ? 'later' : ps === 'vu' && !seen ? 'force' : seen ? 'vu' : 'bientot';
    out.push(x);
  }
  return out.sort((a, b) => a.level - b.level || (a.axis < b.axis ? -1 : a.axis > b.axis ? 1 : 0)
    || a.adult.localeCompare(b.adult, 'fr', { numeric: true }));
}
