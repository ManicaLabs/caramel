/* ============ PROBLÈMES — axe 'ma.problemes' · jeu « Les Missions du ranch » (CDC v2 §6, jeu 18) ============
   Module pur (aucun DOM). Contrat : docs/ARCHITECTURE.md §6 ; mise en scène : js/games/missions.js.
   gen(A, rng, opts) → item, déterministe pour (A, graine), pour tout A ∈ [0 ; 5,6] (core/levels.js).

   ---------- SOURCES (vérifiées le 07/10/2026 : reports/agent-programmes.md, reports/dictee-problemes.md §B) ----------
   Programme du cycle 2 (arrêté du 22/10/2024, BO n°41 du 31/10/2024, annexe 4) ; programme du cycle 3 (arrêté du
   10/04/2025, BO n°16 du 17/04/2025) ; note de service n°2018-052 (BO spécial n°3 du 26/04/2018) ; guide CP
   « Pour enseigner les nombres, le calcul et la résolution de problèmes au CP » (2020-2021) ; guide CM « La résolution
   de problèmes mathématiques au cours moyen » (janvier 2022) ; livrets d'accompagnement 2025 (CP-CE2) et 2026 (CM) ;
   guides Repères 2026 (6 propositions à entourer ; énoncé lu deux fois aux CP-CE1).
   - « Les élèves doivent traiter au moins dix problèmes par semaine » (chaque niveau).
   - Démarche explicite en quatre phases : Comprendre → Modéliser → Calculer → Répondre (data.steps).
   - Mots inducteurs : proposer « régulièrement » des énoncés où « plus » appelle une soustraction (et « moins »,
     « perdre » une addition) → ≈ 1 problème additif sur 3 à partir du CE1 est un CONTRE-EXEMPLE (data.trap).
   - Ordre de difficulté (livret CP 2025) : état final d'un retrait → partie d'un tout → transformation inconnue →
     état initial inconnu. « Plus la structure est complexe, plus le champ numérique doit être réduit. »
   - Schéma en barre écrit au programme dès le CE1 (une barre parties-tout, deux barres comparaison), jamais imposé.
   - Proportionnalité au CM par linéarité, sans tableau, ni coefficient, ni produit en croix.

   ---------- PALIERS : NOTIONS ET PÉRIODE D'ARRIVÉE (NOTIONS ci-dessous ; at → A par atLevel) ----------
   | Notion (ma.problemes:…) | arrivée | gabarits (kind)                                                     |
   |-------------------------|---------|---------------------------------------------------------------------|
   | pt                      | CP-P1   | ajout, retrait (état final), tout (parties-tout, tout inconnu)      |
   | pt.partie               | CP-P2   | partie (partie inconnue, complément)                                |
   | tr.ecart                | CP-P3   | gain (transformation inconnue)                                      |
   | deux.add                | CP-P3   | deux (additif en deux étapes, ≤ 30 au CP)                           |
   | mul.tout                | CP-P3   | groupes (valeur du tout, ≤ 30 au CP)                                |
   | tr.initial              | CP-P4   | avant (état initial inconnu : « gagné » → soustraction)             |
   | mul.partage             | CP-P4   | quotition (nombre de parts), partition (valeur d'une part)          |
   | cmp                     | CE1-P1  | plus (comparaison, référé inconnu : « de plus », « de moins »)      |
   | cmp.ecart               | CE1-P2  | ecart (comparaison, écart inconnu)                                  |
   | cmp.referent            | CE1-P3  | referent (« il en a 4 de plus que… » → soustraction)                |
   | mixte                   | CE1-P3  | prix (une étape multiplicative + une additive : rendu de monnaie)   |
   | div.reste               | CE1-P4  | reste (division avec reste en contexte, question explicite)         |
   | mul.cmp                 | CE2-P1  | fois (« fois plus », « fois moins » ; référent inconnu au CM1)      |
   | cmp.deux                | CE2-P2  | comp2 (comparaison en deux étapes)                                  |
   | prix.dec                | CE2-P2  | achats (prix à virgule)                                             |
   | cartesien               | CE2-P3  | combis (produit cartésien ; trois ensembles au CM1)                 |
   | duree                   | CE2-P3  | duree (durées en minutes ; à cheval sur l'heure au CM1)             |
   | etapes3                 | CE2-P4  | trois (trois étapes, nombres < 100 au CE2)                          |
   | fraction                | CM1-P2  | fraction (fraction d'une quantité ; non unitaire en CM1-P3)         |
   | propor                  | CM1-P3  | propor (linéarité : « 4 sachets coûtent 7 € ; 12 sachets ? »)       |
   | algebre                 | CM1-P4  | algebre (« une brosse et un seau coûtent 14 €, 3 brosses 12 € »)    |
   | propor.etapes           | CM2-P1  | propor2 (6 sachets = 4 sachets + 2 sachets)                         |
   | algebre.sd              | CM2-P2  | somdiff (somme et différence)                                       |
   Calendrier : NOTIONS et FAMILIES ci-dessous, exportés aussi en CALENDAR = { notions, families } (format de
   js/content/calendar.js, fusionné par useGenerator) ; item.notion = la notion qui fixe le niveau, item.notions =
   toutes celles que l'énoncé mobilise (la principale en premier).
   Donnée inutile (data.useless) : à partir du CE2-P2, une fois sur cinq environ (une sur trois au CM2).

   ---------- CHAMP NUMÉRIQUE (programmes 2024-2025) ----------
   Additif en une étape (le tout) : CP P1 ≤ 15, P2 ≤ 30, puis ≤ 59, ≤ 100 · CE1 ≤ 100 puis ≤ 400 (P3) et ≤ 1 000 (P4)
   · CE2 ≤ 5 000 puis ≤ 10 000 · CM1 ≤ 10 000 puis ≤ 999 999 (P3) · CM2 ≤ 999 999.
   Deux étapes et multiplicatifs : CP ≤ 30 · CE1 ≤ 100 · CE2 ≤ 1 000 (trois étapes < 100) · CM1 ≤ 10 000 · CM2 ≤ 100 000.
   Chaque CONTEXTE a ses ordres de grandeur réalistes (un poney ne mange pas 87 carottes) : au-delà, le gabarit prend
   un autre contexte (visiteurs de la fête du ranch, litres de lait de la ferme, kilos de blé, euros…).
   Nombres de l'énoncé ≥ 2, distincts ; réponse ≥ 2 (accords simples : « 1 » n'apparaît jamais devant un nom).

   ---------- ITEM ----------
   { axis, kind, notion, key: 'ma.problemes:<kind>:<nombres>:<contexte>', A, prompt (énoncé + question), answer,
     unit (ce qui s'écrit après la case : 'pommes', '€', 'cm', 'kg', 'minutes'…), choices? (6, format Repères, quand
     data.mode === 'choices'), hint (reformulation ; question intermédiaire pour les problèmes à étapes), explain
     (les quatre phases en une chaîne), leitner: false,
     data: { sentences, question, numbers (nombres de l'énoncé), useless, inter: [{ v, txt }] (résultats
       intermédiaires, jamais faux), ops: [{ a, op, b, r }], nsteps, trap, mode ('choices' | 'keypad'), decimals,
       choices (6, toujours), distractors: [{ v, why }] (why : 'inverse' | 'donnee' | 'etape' | 'inutile' | 'proche'),
       schema: { rows: [{ label?, segs: [{ v, t, q?, sub?, tone?, dots? }], total?: { v, t, q }, part? }] },
       steps: { comprendre, modeliser, calculer: [lignes], repondre }, answerText } }
   Les textes peuvent contenir les jetons du profil : {N} (le compagnon), {IlM} / {ilM} (son pronom), {P} (l'enfant),
   {El} / {el} — le jeu les remplit (ctx.fill). Jamais « de {N} », « que {N} » (élision impossible à prévoir).
   Prénoms : uniquement des noms d'animaux du ranch inventés (Noisette, Biscuit…) et des rôles (le fermier…).
   opts : avoid (Set de clés), kind (gabarit imposé ; pris à son niveau d'arrivée s'il n'est pas encore là),
          locked (Set de notions à ne pas utiliser : calendrier, « pas encore appris »), classe (non utilisée). */

import { fmtNum, frTypo } from '../../core/util.js';

export const axis = 'ma.problemes';

/* ================= CALENDRIER DES NOTIONS ================= */
/* format de reports/progression.md §3.2 : notion → { at: '<classe>-P<n>', fam, src } ; src : 'bo' (programme 2024-2025),
   'livret' (livret d'accompagnement Éduscol), 'repères' (évaluations Repères), 'caramel' (choix interne) */
export const NOTIONS = Object.freeze({
  'ma.problemes:pt':            { at: 'CP-P1',  fam: 'ma.problemes:additifs', src: 'bo' },
  'ma.problemes:pt.partie':     { at: 'CP-P2',  fam: 'ma.problemes:additifs', src: 'livret' },
  'ma.problemes:tr.ecart':      { at: 'CP-P3',  fam: 'ma.problemes:additifs', src: 'livret' },
  'ma.problemes:deux.add':      { at: 'CP-P3',  fam: 'ma.problemes:etapes', src: 'bo' },
  'ma.problemes:mul.tout':      { at: 'CP-P3',  fam: 'ma.problemes:multiplicatifs', src: 'bo' },
  'ma.problemes:tr.initial':    { at: 'CP-P4',  fam: 'ma.problemes:additifs', src: 'livret' },
  'ma.problemes:mul.partage':   { at: 'CP-P4',  fam: 'ma.problemes:partage', src: 'bo' },
  'ma.problemes:cmp':           { at: 'CE1-P1', fam: 'ma.problemes:comparaison', src: 'bo' },
  'ma.problemes:cmp.ecart':     { at: 'CE1-P2', fam: 'ma.problemes:comparaison', src: 'caramel' },
  'ma.problemes:cmp.referent':  { at: 'CE1-P3', fam: 'ma.problemes:comparaison', src: 'caramel' },
  'ma.problemes:mixte':         { at: 'CE1-P3', fam: 'ma.problemes:etapes', src: 'bo' },
  'ma.problemes:div.reste':     { at: 'CE1-P4', fam: 'ma.problemes:partage', src: 'bo' },
  'ma.problemes:mul.cmp':       { at: 'CE2-P1', fam: 'ma.problemes:fois', src: 'bo' },
  'ma.problemes:cmp.deux':      { at: 'CE2-P2', fam: 'ma.problemes:etapes', src: 'bo' },
  'ma.problemes:prix.dec':      { at: 'CE2-P2', fam: 'ma.problemes:prix', src: 'bo' },
  'ma.problemes:cartesien':     { at: 'CE2-P3', fam: 'ma.problemes:combinaisons', src: 'bo' },
  'ma.problemes:duree':         { at: 'CE2-P3', fam: 'ma.problemes:durees', src: 'bo' },
  'ma.problemes:etapes3':       { at: 'CE2-P4', fam: 'ma.problemes:etapes', src: 'bo' },
  'ma.problemes:fraction':      { at: 'CM1-P2', fam: 'ma.problemes:fractions', src: 'bo' },
  'ma.problemes:propor':        { at: 'CM1-P3', fam: 'ma.problemes:proportionnalite', src: 'bo' },
  'ma.problemes:algebre':       { at: 'CM1-P4', fam: 'ma.problemes:algebre', src: 'bo' },
  'ma.problemes:propor.etapes': { at: 'CM2-P1', fam: 'ma.problemes:proportionnalite', src: 'bo' },
  'ma.problemes:algebre.sd':    { at: 'CM2-P2', fam: 'ma.problemes:algebre', src: 'caramel' }
});
/* familles (ce que voient l'enfant et le parent) */
export const FAMILIES = Object.freeze({
  'ma.problemes:additifs':         { child: 'les problèmes pour ajouter ou enlever', adult: 'Problèmes additifs en une étape (parties-tout, transformations)', icon: '➕' },
  'ma.problemes:comparaison':      { child: 'les problèmes « de plus, de moins »', adult: 'Problèmes de comparaison additive', icon: '⚖️' },
  'ma.problemes:etapes':           { child: 'les problèmes en plusieurs étapes', adult: 'Problèmes en deux étapes et mixtes', icon: '🪜' },
  'ma.problemes:multiplicatifs':   { child: 'les problèmes de groupes', adult: 'Problèmes multiplicatifs (valeur du tout)', icon: '🧺' },
  'ma.problemes:partage':          { child: 'les problèmes de partage', adult: 'Problèmes de partage et de groupement (division)', icon: '🍰' },
  'ma.problemes:fois':             { child: 'les problèmes « fois plus, fois moins »', adult: 'Comparaison multiplicative', icon: '✖️' },
  'ma.problemes:prix':             { child: 'les prix avec une virgule', adult: 'Problèmes de prix (euros et centimes)', icon: '💶' },
  'ma.problemes:combinaisons':     { child: 'les problèmes de combinaisons', adult: 'Produit cartésien', icon: '🎀' },
  'ma.problemes:durees':           { child: 'les problèmes de durées', adult: 'Problèmes de durées (heures, minutes)', icon: '⏱️' },
  'ma.problemes:fractions':        { child: 'les fractions d’une quantité', adult: 'Fraction d’une quantité', icon: '🥧' },
  'ma.problemes:proportionnalite': { child: 'les problèmes de proportionnalité', adult: 'Proportionnalité (linéarité)', icon: '📐' },
  'ma.problemes:algebre':          { child: 'les problèmes « devinettes » avec des barres', adult: 'Problèmes algébriques (schéma en barres)', icon: '🧩' }
});
const PER = { P1: 0, P2: 0.2, P3: 0.4, P4: 0.6, P5: 0.8 };
const CL = ['CP', 'CE1', 'CE2', 'CM1', 'CM2'];
/* 'CE2-P3' → 2,4 (échelle A : classe + avancement de l'année au début de la période) */
export function atLevel(at) {
  const m = /^(CP|CE1|CE2|CM1|CM2)-(P[1-5])$/.exec(String(at || ''));
  return m ? CL.indexOf(m[1]) + PER[m[2]] : 0;
}
/* déclaration lue par js/content/calendar.js (useGenerator : format { notions, families } écrit en tête de ce fichier) */
export const CALENDAR = Object.freeze({ notions: NOTIONS, families: FAMILIES });
const LO = id => atLevel(NOTIONS['ma.problemes:' + id].at);

/* ================= OUTILS ================= */
const A_TOP = 5.6, TRIES = 40;
const NB = '\u00A0';                         /* espace insécable : « 12 pommes », « 8 € », « 14 h 05 » */
const clampA = A => { const a = Number(A); return Math.min(A_TOP, Math.max(0, Number.isFinite(a) ? a : 0)); };
const toSet = v => (v instanceof Set ? v : new Set(Array.isArray(v) ? v : []));
const r2 = x => Math.round(x * 100) / 100;
const f = n => fmtNum(n);
const cents = n => Math.round(n * 100);
const ndec = n => { const s = String(r2(n)); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };
const T = s => frTypo(s);
const Cap = s => { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); };

/* ---------- français ---------- */
const H_ASPIRE = ['haricot', 'hérisson', 'hibou', 'hangar', 'harnais', 'hamac', 'hotte'];
export function elides(w) {
  const s = String(w || '').toLowerCase();
  if (s.startsWith('h')) return !H_ASPIRE.some(x => s.startsWith(x));
  return /^[aeiouàâäéèêëîïôöùûüœæ]/.test(s);
}
/* « de pommes », « d’œufs », « d’euros » */
export const de = w => (elides(w) ? 'd’' : 'de ') + w;
/* nom : singulier, pluriel, genre ; cb = forme après « combien de » (« kilos de blé » pour « kg de blé ») */
const nm = (sg, g, pl, extra = {}) => ({ sg, g, pl: pl || sg + 's', ...extra });
const O = {
  pomme: nm('pomme', 'f'), carotte: nm('carotte', 'f'), oeuf: nm('œuf', 'm'), poney: nm('poney', 'm'),
  cheval: nm('cheval', 'm', 'chevaux'), poule: nm('poule', 'f'), mouton: nm('mouton', 'm'), chevre: nm('chèvre', 'f'),
  lapin: nm('lapin', 'm'), botte: nm('botte de foin', 'f', 'bottes de foin', { head: 'botte' }),
  sac: nm('sac de grain', 'm', 'sacs de grain', { head: 'sac' }), piquet: nm('piquet', 'm'), seau: nm('seau', 'm', 'seaux'),
  ruban: nm('ruban', 'm'), fer: nm('fer à cheval', 'm', 'fers à cheval'), boite: nm('boîte', 'f'), paquet: nm('paquet', 'm'),
  visiteur: nm('visiteur', 'm'), lait: nm('litre de lait', 'm', 'litres de lait', { head: 'litre' }),
  euro: nm('euro', 'm'), minute: nm('minute', 'f'), an: nm('an', 'm'), tour: nm('tour', 'm'), place: nm('place', 'f'),
  selle: nm('selle', 'f'), tapis: nm('tapis', 'm', 'tapis'), chapeau: nm('chapeau', 'm', 'chapeaux'), tenue: nm('tenue', 'f'),
  brosse: nm('brosse', 'f'), enclos: nm('enclos', 'm', 'enclos'), pile: nm('pile', 'f'), gateau: nm('gâteau', 'm', 'gâteaux'),
  fruit: nm('fruit', 'm'), legume: nm('légume', 'm'), gouter: nm('goûter', 'm'), chien: nm('chien', 'm'), chat: nm('chat', 'm'),
  arbre: nm('arbre', 'm'), degre: nm('degré', 'm'), poussin: nm('poussin', 'm'), cuve: nm('cuve', 'f'),
  botteC: nm('botte', 'f'), ferme: nm('ferme', 'f'), ratelier: nm('râtelier', 'm'), sachet: nm('sachet de graines', 'm', 'sachets de graines', { head: 'sachet' }),
  ble: nm('kg de blé', 'm', 'kg de blé', { cb: 'kilos de blé' }), foin: nm('kg de foin', 'm', 'kg de foin', { cb: 'kilos de foin' })
};
/* « 12 pommes » (insécable) ; 0 et 1 au singulier */
export const qn = (n, N) => f(n) + NB + (Math.abs(n) >= 2 ? N.pl : N.sg);
/* « combien de pommes », « combien d’œufs », « combien de kilos de blé » */
const combien = N => 'combien ' + de(N.cb || N.pl);
const Combien = N => Cap(combien(N));
/* « 8 € », « 2,50 € » */
export const eur = n => (Number.isInteger(r2(n)) ? f(r2(n)) : fmtNum(r2(n), 2)) + NB + '€';
const kg = n => f(n) + NB + 'kg';
const cm = n => f(n) + NB + 'cm';
/* inversion du sujet : « a-t-il », « mange-t-elle », « met-il », « vend-elle » */
export const inv = (v, pr) => (/[aeéiouy]$/.test(v) ? `${v}-t-${pr}` : `${v}-${pr}`);
/* participe passé accordé avec un complément pluriel placé avant (« combien de pommes a-t-il mangées ») */
const ppl = (base, N) => base + (N.g === 'f' ? 'e' : '') + 's';
const ADJ = {
  blanc: ['blanc', 'blanche'], noir: ['noir', 'noire'], brun: ['brun', 'brune'], roux: ['roux', 'rousse', 'roux', 'rousses'],
  gris: ['gris', 'grise', 'gris', 'grises'], rouge: ['rouge', 'rouge'], vert: ['vert', 'verte'], jaune: ['jaune', 'jaune'],
  bleu: ['bleu', 'bleue'], dore: ['doré', 'dorée']
};
/* adjectif accordé au pluriel */
const adjPl = (a, N) => { const t = ADJ[a]; return N.g === 'f' ? (t[3] || t[1] + 's') : (t[2] || t[0] + 's'); };
const chacun = N => (N.g === 'f' ? 'chacune' : 'chacun');
const unArt = N => (N.g === 'f' ? 'une ' : 'un ') + N.sg;
const leArt = N => (N.g === 'f' ? 'la ' : 'le ') + (N.head || N.sg);
const hm = (h, m) => f(h) + NB + 'h' + NB + String(m).padStart(2, '0');

/* ---------- personnages (aucun prénom réel : animaux du ranch aux noms inventés, rôles, jetons du profil) ---------- */
const who = (name, g, kind = 'pool') => ({ name, Name: Cap(name), g, il: g === 'f' ? 'elle' : 'il', Il: g === 'f' ? 'Elle' : 'Il', kind });
export const COMP = Object.freeze({ name: '{N}', Name: '{N}', g: null, il: '{ilM}', Il: '{IlM}', kind: 'comp' });
export const HERO = Object.freeze({ name: '{P}', Name: '{P}', g: null, il: '{el}', Il: '{El}', kind: 'hero' });
const FERMIER = who('le fermier', 'm', 'role'), FERMIERE = who('la fermière', 'f', 'role');
/* animaux du ranch (initiale consonne : « que Noisette », « de Biscuit » sans élision) */
export const POOL = Object.freeze([
  who('Noisette', 'f'), who('Biscuit', 'm'), who('Praline', 'f'), who('Nougat', 'm'), who('Myrtille', 'f'),
  who('Filou', 'm'), who('Cannelle', 'f'), who('Pompon', 'm'), who('Pistache', 'f'), who('Galopin', 'm')
]);
/* poules du poulailler (pondre) */
const HENS = Object.freeze([who('Noisette', 'f'), who('Praline', 'f'), who('Cannelle', 'f'), who('Pâquerette', 'f'), who('Paprika', 'f')]);
export const NAMES = Object.freeze([...new Set([...POOL, ...HENS].map(a => a.name))]);
const role = rng => (rng.chance(0.5) ? FERMIER : FERMIERE);
/* sujet d'une phrase : le compagnon, l'enfant (rarement), un animal du ranch */
function anyone(rng, { hero = true } = {}) {
  const x = rng.next();
  if (x < 0.4) return COMP;
  if (hero && x < 0.5) return HERO;
  return rng.pick(POOL);
}
/* qui achète : le compagnon, l'enfant ou un adulte du ranch (pas les poules) */
function buyer(rng) { const x = rng.next(); return x < 0.35 ? COMP : x < 0.6 ? HERO : role(rng); }
/* deux personnages différents de la réserve */
function two(rng, pool = POOL) { const [a, b] = rng.sample(pool, 2); return [a, b]; }
/* « à eux deux » / « à elles deux » */
const duo = (a, b) => (a.g === 'f' && b.g === 'f' ? { ils: 'elles', eux: 'elles' } : { ils: 'ils', eux: 'eux' });

/* ---------- tirages ---------- */
/* entier dans [lo ; hi] à peu près log-uniforme (les grands champs donnent aussi des nombres moyens) */
function draw(rng, lo, hi) {
  lo = Math.ceil(lo); hi = Math.floor(hi);
  if (hi <= lo) return lo;
  if (hi < 60 || hi / lo < 8) return rng.int(lo, hi);
  const x = Math.exp(rng.float(Math.log(lo), Math.log(hi + 1)));
  return Math.min(hi, Math.max(lo, Math.floor(x)));
}
/* nombre « rond » adapté à sa taille (grands nombres : pas toujours ronds, mais lisibles) */
function roundish(rng, n) {
  if (n < 100) return n;
  const k = n < 1000 ? 1 : n < 10000 ? (rng.chance(0.5) ? 10 : 1) : n < 100000 ? (rng.chance(0.5) ? 100 : 10) : (rng.chance(0.5) ? 1000 : 100);
  return Math.max(k, Math.round(n / k) * k);
}

/* champ numérique du tout (additif en une étape) : [min, max] */
function addRange(A) {
  if (A < 0.2) return [6, 15];
  if (A < 0.3) return [8, 20];
  if (A < 0.45) return [10, 30];
  if (A < 0.7) return [15, 59];
  if (A < 1.2) return [20, 100];
  if (A < 1.6) return [80, 400];
  if (A < 2) return [150, 1000];
  if (A < 2.3) return [400, 5000];
  if (A < 3.4) return [800, 10000];
  return [1500, 999999];
}
/* deux étapes, multiplicatifs */
function cplxMax(A) {
  if (A < 1) return 30;
  if (A < 2) return 100;
  if (A < 3) return 1000;
  if (A < 4) return 10000;
  return 100000;
}
/* niveau d'un nombre (pour item.A) */
function numLevel(n) {
  if (n <= 15) return 0;
  if (n <= 30) return 0.3;
  if (n <= 59) return 0.45;
  if (n <= 100) return 0.7;
  if (n <= 400) return 1.2;
  if (n <= 1000) return 1.6;
  if (n <= 10000) return 2;
  return 3.4;
}
/* tables de multiplication connues (livret CE1 2025 : 1-6 et 10 en P1-P2, 7 en P3, 8 en P4, 9 en P5) */
function tablesAt(A) {
  if (A < 1) return [2, 3, 4, 5, 10];               /* CP : groupes de 2, 5, 10 surtout (≤ 30) */
  if (A < 1.4) return [2, 3, 4, 5, 6, 10];
  if (A < 1.6) return [2, 3, 4, 5, 6, 7, 10];
  if (A < 1.8) return [2, 3, 4, 5, 6, 7, 8, 10];
  return [2, 3, 4, 5, 6, 7, 8, 9, 10];
}

/* ================= SCHÉMAS EN BARRES (données pures, dessinées par le jeu) ================= */
const sg = (v, t, o = {}) => ({ v, t: t === undefined ? f(v) : t, ...o });
const sq = (v, o = {}) => ({ v, t: '?', q: true, ...o });
const tot = (v, q = false, t) => ({ v, t: q ? '?' : (t === undefined ? f(v) : t), q });
/* résultat intermédiaire d'un problème à étapes : « ? » pâle (le schéma de l'indice ne donne pas l'étape) */
const mid = v => ({ v, t: '?', q: true, soft: true });
const sqm = (v, o = {}) => ({ v, t: '?', q: true, soft: true, ...o });
/* produit écrit sans être calculé : « 8 × 3 » */
const px = (n, k, money = false) => f(n) + ' × ' + (money ? eur(k) : f(k));
const row = (label, segs, total = null, extra = {}) => ({ label: label || '', segs, total, ...extra });

/* ================= GABARITS =================
   make(e) → spec | null ; e = { A, rng, range: [min, max] du tout, cmax (étapes, multiplicatifs) }
   spec = { scene, sentences, question, answer, unit, ops, schema, hint, cherche, modele, reponse, numbers,
            inter?, trap?, alt (distracteurs : [{ v, why }]), dec?, lo? (arrivée propre à une variante) } */
const KINDS = [];
function kind(id, notion, spec) {
  KINDS.push({ id, notion: 'ma.problemes:' + notion, lo: LO(notion), w: 1, ...spec,
    also: (spec.also || []).map(n => 'ma.problemes:' + n) });
}

/* a + b = t (deux parties) dans un champ [lo, hi], parties ≥ 2 */
function parts2(rng, lo, hi) {
  const t = draw(rng, Math.max(lo, 4), hi);
  const a = part(rng, t, t >= 100 ? 0.12 : 0.08, t >= 100 ? 0.88 : 0.92);
  const b = t - a;
  if (a < 2 || b < 2 || a === b) return null;
  return [a, b, t];
}
/* une partie de s entre f1·s et f2·s (au moins 2), arrondie selon sa taille */
function part(rng, s, f1 = 0.1, f2 = 0.9) {
  const lo = Math.max(2, Math.ceil(s * f1)), hi = Math.max(lo, Math.floor(s * f2));
  return roundish(rng, rng.int(lo, hi));
}
/* champ effectif d'un contexte : [min, max] ∩ [1, cap] ; null si le contexte est trop petit pour le niveau */
function fit(range, cap, minCap = 0) {
  const hi = Math.min(range[1], cap);
  const lo = Math.min(range[0], Math.floor(hi / 2));
  if (hi < Math.max(6, minCap)) return null;
  return [Math.max(4, lo), hi];
}
/* contexte dont le plafond réaliste convient au niveau (les plus grands à défaut) */
function scene(rng, list, range) {
  const ok = list.filter(s => s.cap >= range[0] * 0.6 && (s.min || 0) <= range[1]);
  const pool = ok.length ? ok : list.slice().sort((a, b) => b.cap - a.cap).slice(0, 1);
  return rng.pick(pool);
}

/* ---------- ajout : état final d'un ajout (CP-P1) ---------- */
kind('ajout', 'pt', {
  w: 1, add: true,
  make(e) {
    const { rng } = e;
    const sc = scene(rng, [
      { id: 'cueillette', cap: 60 }, { id: 'arrivee', cap: 60 }, { id: 'grange', cap: 500 },
      { id: 'cuve', cap: 60000, min: 1000 }, { id: 'compte', cap: 200000, min: 2000 }
    ], e.range);
    const R = fit(e.range, sc.cap);
    if (!R) return null;
    const p = parts2(rng, R[0], R[1]);
    if (!p) return null;
    const [a, b, t] = p;
    const base = { numbers: [a, b], answer: t, ops: [{ a, op: '+', b, r: t }],
      alt: [{ v: Math.abs(a - b), why: 'inverse' }] };
    if (sc.id === 'cueillette') {
      const X = anyone(rng);
      const [N, verb] = rng.pick([[O.pomme, 'cueille'], [O.oeuf, 'ramasse'], [O.carotte, 'récolte']]);
      return { ...base, scene: 'cueillette-' + N.sg, unit: N,
        sentences: [`${X.Name} a ${qn(a, N)} dans son panier.`, `${X.Il} en ${verb} encore ${f(b)}.`],
        question: `${Combien(N)} ${X.name} ${inv('a', X.il)} maintenant dans son panier ?`,
        reponse: `${X.Name} a maintenant ${qn(t, N)} dans son panier.`,
        hint: `Au début, il y a ${qn(a, N)} dans le panier. On en ajoute ${f(b)}. On cherche combien il y en a à la fin.`,
        cherche: `On cherche le nombre ${de(N.pl)} à la fin.`,
        modele: `Le nombre de la fin, c’est le tout : ${f(a)} au début et ${f(b)} en plus.`,
        schema: { rows: [row('', [sg(a, undefined, { sub: 'au début' }), sg(b, undefined, { sub: 'en plus', tone: 'b' })], tot(t, true))] } };
    }
    if (sc.id === 'arrivee') {
      const [N, place] = rng.pick([[O.poney, 'dans le pré'], [O.poule, 'dans la cour'], [O.mouton, 'dans le pré'], [O.cheval, 'dans le pré']]);
      if (N === O.poney || N === O.cheval) { if (t > 30) return null; }
      return { ...base, scene: 'arrivee-' + N.sg, unit: N,
        sentences: [`Il y a ${qn(a, N)} ${place}.`, `${qn(b, N)} arrivent.`],
        question: `${Combien(N)} y a-t-il maintenant ${place} ?`,
        reponse: `Il y a maintenant ${qn(t, N)} ${place}.`,
        hint: `Au début, il y a ${qn(a, N)}. ${qn(b, N)} arrivent. On cherche combien il y en a à la fin.`,
        cherche: `On cherche le nombre ${de(N.pl)} à la fin.`,
        modele: `Le nombre de la fin, c’est le tout : ${f(a)} au début et ${f(b)} qui arrivent.`,
        schema: { rows: [row('', [sg(a, undefined, { sub: 'au début' }), sg(b, undefined, { sub: 'arrivent', tone: 'b' })], tot(t, true))] } };
    }
    if (sc.id === 'grange') {
      const N = rng.pick([O.botte, O.sac]);
      const R2 = role(rng);
      return { ...base, scene: 'grange-' + (N.head || N.sg), unit: N,
        sentences: [`Dans la grange, il y a ${qn(a, N)}.`, `${R2.Name} en apporte ${f(b)} autres.`],
        question: `${Combien(N)} y a-t-il maintenant dans la grange ?`,
        reponse: `Il y a maintenant ${qn(t, N)} dans la grange.`,
        hint: `Au début, il y a ${qn(a, N)}. On en apporte ${f(b)}. On cherche combien il y en a à la fin.`,
        cherche: `On cherche le nombre ${de(N.pl)} à la fin.`,
        modele: `Le nombre de la fin, c’est le tout : ${f(a)} au début et ${f(b)} apportés.`,
        schema: { rows: [row('', [sg(a, undefined, { sub: 'au début' }), sg(b, undefined, { sub: 'apportés', tone: 'b' })], tot(t, true))] } };
    }
    if (sc.id === 'cuve') {
      return { ...base, scene: 'cuve', unit: O.lait,
        sentences: [`La cuve de la ferme contient ${qn(a, O.lait)}.`, `Le camion en apporte ${f(b)} autres.`],
        question: `${Combien(O.lait)} la cuve contient-elle maintenant ?`,
        reponse: `La cuve contient maintenant ${qn(t, O.lait)}.`,
        hint: `Au début, la cuve contient ${qn(a, O.lait)}. On en ajoute ${f(b)}. On cherche combien il y en a à la fin.`,
        cherche: 'On cherche le nombre de litres à la fin.',
        modele: `Le nombre de la fin, c’est le tout : ${f(a)} au début et ${f(b)} en plus.`,
        schema: { rows: [row('', [sg(a, undefined, { sub: 'au début' }), sg(b, undefined, { sub: 'en plus', tone: 'b' })], tot(t, true))] } };
    }
    const R2 = role(rng);
    return { ...base, scene: 'compte', unit: '€',
      sentences: [`${R2.Name} a ${eur(a)} pour la ferme.`, `${R2.Il} vend du blé et gagne ${eur(b)}.`],
      question: `Combien d’euros ${R2.name} ${inv('a', R2.il)} maintenant ?`,
      reponse: `${R2.Name} a maintenant ${eur(t)}.`,
      hint: `Au début : ${eur(a)}. On en gagne ${eur(b)}. On cherche combien il y en a à la fin.`,
      cherche: 'On cherche la somme à la fin.',
      modele: `La somme de la fin, c’est le tout : ${eur(a)} au début et ${eur(b)} gagnés.`,
      schema: { rows: [row('', [sg(a, undefined, { sub: 'au début' }), sg(b, undefined, { sub: 'gagnés', tone: 'b' })], tot(t, true))] } };
  }
});

/* ---------- retrait : état final d'un retrait (CP-P1, le plus facile selon le livret CP) ---------- */
kind('retrait', 'pt', {
  w: 1.2, add: true,
  make(e) {
    const { rng } = e;
    const sc = scene(rng, [
      { id: 'mange', cap: 20 }, { id: 'rentrent', cap: 60 }, { id: 'vend', cap: 400 },
      { id: 'laiterie', cap: 60000, min: 1000 }, { id: 'silo', cap: 500000, min: 2000 }
    ], e.range);
    const R = fit(e.range, sc.cap);
    if (!R) return null;
    const p = parts2(rng, R[0], R[1]);
    if (!p) return null;
    const [r, b, a] = p;                                 /* a − b = r */
    const base = { numbers: [a, b], answer: r, ops: [{ a, op: '−', b, r }], alt: [{ v: a + b, why: 'inverse' }] };
    const sch = (subB) => ({ rows: [row('', [sq(r, { sub: 'il reste' }), sg(b, undefined, { sub: subB, tone: 'b' })], tot(a))] });
    if (sc.id === 'mange') {
      if (b > 10) return null;                         /* un poney ne mange pas 15 carottes d'un coup */
      const X = rng.chance(0.6) ? COMP : rng.pick(POOL);
      const N = rng.pick([O.carotte, O.pomme]);
      return { ...base, scene: 'mange-' + N.sg, unit: N,
        sentences: [`${X.Name} a ${qn(a, N)}.`, `${X.Il} en mange ${f(b)}.`],
        question: `${Combien(N)} lui reste-t-il ?`,
        reponse: `Il lui reste ${qn(r, N)}.`,
        hint: `Au début, il y a ${qn(a, N)}. ${X.Il} en mange ${f(b)}. On cherche ce qui reste.`,
        cherche: `On cherche le nombre ${de(N.pl)} qui restent.`,
        modele: `Le tout, c’est ${f(a)}. Une partie est mangée : ${f(b)}. On cherche l’autre partie.`,
        schema: sch('mangées') };
    }
    if (sc.id === 'rentrent') {
      const [N, home] = rng.pick([[O.poney, 'à l’écurie'], [O.cheval, 'à l’écurie'], [O.poule, 'au poulailler'], [O.mouton, 'à la bergerie'], [O.chevre, 'à la chèvrerie']]);
      if ((N === O.poney || N === O.cheval) && a > 30) return null;
      return { ...base, scene: 'rentrent-' + N.sg, unit: N,
        sentences: [`Il y a ${qn(a, N)} dans le pré.`, `${qn(b, N)} rentrent ${home}.`],
        question: `${Combien(N)} reste-t-il dans le pré ?`,
        reponse: `Il reste ${qn(r, N)} dans le pré.`,
        hint: `Au début, il y a ${qn(a, N)} dans le pré. ${qn(b, N)} s’en vont. On cherche ce qui reste.`,
        cherche: `On cherche le nombre ${de(N.pl)} qui restent dans le pré.`,
        modele: `Le tout, c’est ${f(a)}. Une partie s’en va : ${f(b)}. On cherche l’autre partie.`,
        schema: sch(N.g === 'f' ? 'parties' : 'partis') };
    }
    if (sc.id === 'vend') {
      const R2 = role(rng);
      const N = rng.pick([O.oeuf, O.sac, O.botte]);
      return { ...base, scene: 'vend-' + (N.head || N.sg), unit: N,
        sentences: [`${R2.Name} a ${qn(a, N)}.`, `${R2.Il} en vend ${f(b)} au marché.`],
        question: `${Combien(N)} lui reste-t-il ?`,
        reponse: `Il lui reste ${qn(r, N)}.`,
        hint: `Au début, il y a ${qn(a, N)}. On en vend ${f(b)}. On cherche ce qui reste.`,
        cherche: `On cherche le nombre ${de(N.pl)} qui restent.`,
        modele: `Le tout, c’est ${f(a)}. Une partie est vendue : ${f(b)}. On cherche l’autre partie.`,
        schema: sch(N.g === 'f' ? 'vendues' : 'vendus') };
    }
    if (sc.id === 'laiterie') {
      return { ...base, scene: 'laiterie', unit: O.lait,
        sentences: [`La cuve de la ferme contient ${qn(a, O.lait)}.`, `Le camion de la laiterie en emporte ${f(b)}.`],
        question: `${Combien(O.lait)} reste-t-il dans la cuve ?`,
        reponse: `Il reste ${qn(r, O.lait)} dans la cuve.`,
        hint: `Au début, la cuve contient ${qn(a, O.lait)}. On en emporte ${f(b)}. On cherche ce qui reste.`,
        cherche: 'On cherche le nombre de litres qui restent.',
        modele: `Le tout, c’est ${f(a)}. Une partie est emportée : ${f(b)}. On cherche l’autre partie.`,
        schema: sch('emportés') };
    }
    return { ...base, scene: 'silo', unit: 'kg',
      sentences: [`Le silo de la ferme contient ${qn(a, O.ble)}.`, `Le fermier en vend ${f(b)} au moulin.`],
      question: `${Combien(O.ble)} reste-t-il dans le silo ?`,
      reponse: `Il reste ${qn(r, O.ble)} dans le silo.`,
      hint: `Au début, le silo contient ${qn(a, O.ble)}. On en vend ${f(b)}. On cherche ce qui reste.`,
      cherche: 'On cherche le nombre de kilos qui restent.',
      modele: `Le tout, c’est ${f(a)}. Une partie est vendue : ${f(b)}. On cherche l’autre partie.`,
      schema: sch('vendus') };
  }
});

/* ---------- tout : parties-tout, tout inconnu (CP-P1) ---------- */
kind('tout', 'pt', {
  w: 1, add: true,
  make(e) {
    const { rng } = e;
    const sc = scene(rng, [{ id: 'couleurs', cap: 40 }, { id: 'panier', cap: 60 }, { id: 'rubans', cap: 30 },
      { id: 'visiteurs', cap: 900000, min: 300 }, { id: 'lait', cap: 400000, min: 1000 }], e.range);
    const R = fit(e.range, sc.cap);
    if (!R) return null;
    const p = parts2(rng, R[0], R[1]);
    if (!p) return null;
    const [a, b, t] = p;
    const base = { numbers: [a, b], answer: t, ops: [{ a, op: '+', b, r: t }], alt: [{ v: Math.abs(a - b), why: 'inverse' }] };
    const sch = (la, lb) => ({ rows: [row('', [sg(a, undefined, { sub: la }), sg(b, undefined, { sub: lb, tone: 'b' })], tot(t, true))] });
    if (sc.id === 'couleurs') {
      const [N, ca, cb] = rng.pick([[O.poney, 'blanc', 'brun'], [O.poney, 'noir', 'gris'], [O.poule, 'roux', 'blanc'],
        [O.chevre, 'blanc', 'noir'], [O.mouton, 'blanc', 'noir'], [O.lapin, 'gris', 'blanc']]);
      if (N === O.poney && t > 30) return null;
      return { ...base, scene: 'couleurs-' + N.sg, unit: N,
        sentences: [`Dans le pré, il y a ${qn(a, N)} ${adjPl(ca, N)} et ${qn(b, N)} ${adjPl(cb, N)}.`],
        question: `${Combien(N)} y a-t-il dans le pré ?`,
        reponse: `Il y a ${qn(t, N)} dans le pré.`,
        hint: `Il y a deux groupes ${de(N.pl)} : ${f(a)} et ${f(b)}. On cherche combien il y en a en tout.`,
        cherche: `On cherche le nombre ${de(N.pl)} en tout.`,
        modele: `Les deux groupes sont les parties ; on cherche le tout.`,
        schema: sch(adjPl(ca, N), adjPl(cb, N)) };
    }
    if (sc.id === 'panier') {
      const [ca, cb] = rng.sample(['rouge', 'vert', 'jaune'], 2);
      return { ...base, scene: 'panier', unit: O.pomme,
        sentences: [`Dans le panier, il y a ${qn(a, O.pomme)} ${adjPl(ca, O.pomme)} et ${qn(b, O.pomme)} ${adjPl(cb, O.pomme)}.`],
        question: 'Combien de pommes y a-t-il dans le panier ?',
        reponse: `Il y a ${qn(t, O.pomme)} dans le panier.`,
        hint: `Il y a deux groupes de pommes : ${f(a)} et ${f(b)}. On cherche combien il y en a en tout.`,
        cherche: 'On cherche le nombre de pommes en tout.',
        modele: 'Les deux groupes sont les parties ; on cherche le tout.',
        schema: sch(adjPl(ca, O.pomme), adjPl(cb, O.pomme)) };
    }
    if (sc.id === 'rubans') {
      const X = anyone(rng);
      const [ca, cb] = rng.sample(['bleu', 'rouge', 'jaune', 'vert'], 2);
      return { ...base, scene: 'rubans', unit: O.ruban,
        sentences: [`${X.Name} a ${qn(a, O.ruban)} ${adjPl(ca, O.ruban)} et ${qn(b, O.ruban)} ${adjPl(cb, O.ruban)}.`],
        question: `Combien de rubans ${X.name} ${inv('a', X.il)} en tout ?`,
        reponse: `${X.Name} a ${qn(t, O.ruban)} en tout.`,
        hint: `Il y a deux groupes de rubans : ${f(a)} et ${f(b)}. On cherche combien il y en a en tout.`,
        cherche: 'On cherche le nombre de rubans en tout.',
        modele: 'Les deux groupes sont les parties ; on cherche le tout.',
        schema: sch(adjPl(ca, O.ruban), adjPl(cb, O.ruban)) };
    }
    if (sc.id === 'visiteurs') {
      const where = t > 50000 ? 'au salon de l’agriculture' : 'à la fête du ranch';
      return { ...base, scene: 'visiteurs', unit: O.visiteur,
        sentences: [`Samedi, ${qn(a, O.visiteur)} sont venus ${where}.`, `Dimanche, ${qn(b, O.visiteur)} sont venus.`],
        question: 'Combien de visiteurs sont venus en tout ?',
        reponse: `En tout, ${qn(t, O.visiteur)} sont venus.`,
        hint: `Il y a deux groupes de visiteurs : ceux du samedi et ceux du dimanche. On cherche combien il y en a en tout.`,
        cherche: 'On cherche le nombre de visiteurs en tout.',
        modele: 'Samedi et dimanche sont les parties ; on cherche le tout.',
        schema: sch('samedi', 'dimanche') };
    }
    return { ...base, scene: 'lait', unit: O.lait,
      sentences: [`En janvier, la ferme a produit ${qn(a, O.lait)}.`, `En février, elle en a produit ${f(b)}.`],
      question: `${Combien(O.lait)} la ferme a-t-elle ${ppl('produit', O.lait)} en tout ?`,
      reponse: `La ferme a produit ${qn(t, O.lait)} en tout.`,
      hint: 'Il y a deux parties : le lait de janvier et celui de février. On cherche le tout.',
      cherche: 'On cherche le nombre de litres en tout.',
      modele: 'Janvier et février sont les parties ; on cherche le tout.',
      schema: sch('janvier', 'février') };
  }
});

/* ---------- partie : partie inconnue d'un tout (CP-P2) ---------- */
kind('partie', 'pt.partie', {
  w: 1.1, add: true,
  make(e) {
    const { rng, A } = e;
    const sc = scene(rng, [{ id: 'couleurs', cap: 40 }, { id: 'planter', cap: 300 }, { id: 'brosser', cap: 20 },
      { id: 'achat', cap: A < 0.4 ? 0 : A < 1 ? 100 : A < 2 ? 1000 : 90000, min: 0 }], e.range);
    const R = fit(e.range, sc.cap);
    if (!R) return null;
    const p = parts2(rng, R[0], R[1]);
    if (!p) return null;
    const [a, r, t] = p;                                 /* t − a = r */
    const base = { numbers: [t, a], answer: r, ops: [{ a: t, op: '−', b: a, r }], alt: [{ v: t + a, why: 'inverse' }] };
    const sch = (la, lr) => ({ rows: [row('', [sg(a, undefined, { sub: la }), sq(r, { sub: lr, tone: 'b' })], tot(t))] });
    if (sc.id === 'couleurs') {
      const [N, ca, cb] = rng.pick([[O.poney, 'blanc', 'brun'], [O.poule, 'roux', 'noir'], [O.oeuf, 'blanc', 'roux'],
        [O.chevre, 'gris', 'blanc'], [O.lapin, 'blanc', 'gris']]);
      const where = N === O.oeuf ? 'Dans le panier' : 'Dans le pré';
      if (N === O.poney && t > 30) return null;
      return { ...base, scene: 'couleurs-' + N.sg, unit: N,
        sentences: [`${where}, il y a ${qn(t, N)}.`, `${Cap(f(a))} sont ${adjPl(ca, N)}, les autres sont ${adjPl(cb, N)}.`],
        question: `${Combien(N)} sont ${adjPl(cb, N)} ?`,
        reponse: `${Cap(qn(r, N))} sont ${adjPl(cb, N)}.`,
        hint: `Le tout, c’est ${qn(t, N)}. Une partie, c’est ${f(a)} ${adjPl(ca, N)}. On cherche l’autre partie.`,
        cherche: `On cherche le nombre ${de(N.pl)} ${adjPl(cb, N)}.`,
        modele: `Le tout, c’est ${f(t)}. Une partie, c’est ${f(a)}. On cherche l’autre partie.`,
        schema: sch(adjPl(ca, N), adjPl(cb, N)) };
    }
    if (sc.id === 'planter' || sc.id === 'brosser') {
      const X = rng.chance(0.5) ? anyone(rng) : role(rng);
      const [N, v, pp] = sc.id === 'planter' ? [O.piquet, 'planter', 'planté'] : [O.poney, 'brosser', 'brossé'];
      return { ...base, scene: sc.id, unit: N,
        sentences: [`${X.Name} doit ${v} ${qn(t, N)}.`, `${X.Il} en a déjà ${pp} ${f(a)}.`],
        question: `${Combien(N)} ${X.name} ${inv('doit', X.il)} encore ${v} ?`,
        reponse: `${X.Name} doit encore ${v} ${qn(r, N)}.`,
        hint: `En tout, il y a ${qn(t, N)} à ${v}. ${Cap(f(a))} sont déjà faits. On cherche ce qui reste à faire.`,
        cherche: `On cherche le nombre ${de(N.pl)} qui restent à ${v}.`,
        modele: `Le tout, c’est ${f(t)}. Une partie est faite : ${f(a)}. On cherche l’autre partie.`,
        schema: sch('déjà faits', 'encore') };
    }
    const X = buyer(rng);
    const things = [[unArt(O.brosse), 5, 30], ['un licol', 12, 60], ['une couverture', 30, 100], ['une selle', 250, 1500],
      ['un van', 3000, 30000], ['un tracteur', 20000, 90000]];
    const ok = things.filter(([, lo, hi]) => t >= lo && t <= hi);
    if (!ok.length) return null;
    const [thing] = rng.pick(ok);
    return { ...base, scene: 'achat', unit: '€',
      sentences: [`${X.Name} veut acheter ${thing} à ${eur(t)}.`, `${X.Il} a ${eur(a)}.`],
      question: 'Combien d’euros lui manque-t-il ?',
      reponse: `Il lui manque ${eur(r)}.`,
      hint: `Le prix, c’est ${eur(t)}. ${X.Il} a déjà ${eur(a)}. On cherche ce qui manque.`,
      cherche: 'On cherche la somme qui manque.',
      modele: `Le tout, c’est le prix : ${eur(t)}. Une partie, c’est ce qu’on a déjà : ${eur(a)}. On cherche l’autre partie.`,
      schema: sch('déjà', 'il manque') };
  }
});

/* ---------- gain : transformation inconnue (CP-P3 ; « gagné » → soustraction) ---------- */
kind('gain', 'tr.ecart', {
  w: 1, add: true, trap: true,
  make(e) {
    const { rng, A } = e;
    const sc = scene(rng, [{ id: 'rubans', cap: 30 }, { id: 'tempete', cap: 300 }, { id: 'tirelire', cap: A < 1 ? 50 : 150 },
      { id: 'oeufs', cap: 120 }], e.range);
    const R = fit(e.range, sc.cap);
    if (!R) return null;
    const p = parts2(rng, R[0], R[1]);
    if (!p) return null;
    if (sc.id === 'tempete') {
      const [c, r, a] = p;                               /* avant a, après c : cassés r = a − c */
      const R2 = role(rng);
      return { scene: 'tempete', unit: O.piquet, numbers: [a, c], answer: r, ops: [{ a, op: '−', b: c, r }],
        alt: [{ v: a + c, why: 'inverse' }], trap: true,
        sentences: [`${R2.Name} a ${qn(a, O.piquet)} autour du pré.`, `Après la tempête, ${R2.il} n’en a plus que ${f(c)}.`],
        question: `Combien de piquets la tempête a-t-elle ${ppl('cassé', O.piquet)} ?`,
        reponse: `La tempête a cassé ${qn(r, O.piquet)}.`,
        hint: `Avant la tempête : ${qn(a, O.piquet)}. Après : ${f(c)}. On cherche combien sont partis.`,
        cherche: 'On cherche le nombre de piquets cassés.',
        modele: `Le tout, c’est ${f(a)} piquets avant la tempête. Une partie reste : ${f(c)}. On cherche l’autre partie.`,
        schema: { rows: [row('', [sg(c, undefined, { sub: 'il reste' }), sq(r, { sub: 'cassés', tone: 'b' })], tot(a))] } };
    }
    const [a, r, c] = p;                                 /* avant a, après c : gagné r = c − a */
    const base = { numbers: [a, c], answer: r, ops: [{ a: c, op: '−', b: a, r }], alt: [{ v: a + c, why: 'inverse' }], trap: true };
    const sch = (la, lr) => ({ rows: [row('', [sg(a, undefined, { sub: la }), sq(r, { sub: lr, tone: 'b' })], tot(c, false, f(c)), { totalSub: 'après' })] });
    if (sc.id === 'rubans') {
      const X = anyone(rng);
      return { ...base, scene: 'rubans', unit: O.ruban,
        sentences: [`Avant le concours, ${X.name} a ${qn(a, O.ruban)}.`, `Après le concours, ${X.il} en a ${f(c)}.`],
        question: `Combien de rubans ${X.name} ${inv('a', X.il)} ${ppl('gagné', O.ruban)} au concours ?`,
        reponse: `${X.Name} a gagné ${qn(r, O.ruban)} au concours.`,
        hint: `Avant : ${qn(a, O.ruban)}. Après : ${f(c)}. On cherche combien de rubans se sont ajoutés.`,
        cherche: 'On cherche le nombre de rubans gagnés.',
        modele: `Le tout, c’est ${f(c)} rubans après le concours. Une partie, c’est ${f(a)} rubans d’avant. On cherche l’autre partie.`,
        schema: sch('avant', 'gagnés') };
    }
    if (sc.id === 'tirelire') {
      const X = rng.chance(0.5) ? HERO : COMP;
      return { ...base, scene: 'tirelire', unit: '€',
        sentences: [`${X.Name} a ${eur(a)} dans sa tirelire.`, `Après son anniversaire, ${X.il} a ${eur(c)}.`],
        question: `Combien d’euros ${X.name} ${inv('a', X.il)} ${ppl('reçu', O.euro)} ?`,
        reponse: `${X.Name} a reçu ${eur(r)}.`,
        hint: `Avant : ${eur(a)}. Après : ${eur(c)}. On cherche combien d’euros se sont ajoutés.`,
        cherche: 'On cherche la somme reçue.',
        modele: `Le tout, c’est ${eur(c)} après l’anniversaire. Une partie, c’est ${eur(a)} d’avant. On cherche l’autre partie.`,
        schema: sch('avant', 'reçus') };
    }
    return { ...base, scene: 'oeufs', unit: O.oeuf,
      sentences: [`Le matin, il y a ${qn(a, O.oeuf)} dans le panier.`, `Le soir, il y en a ${f(c)}.`],
      question: `Combien d’œufs ont été ${ppl('ajouté', O.oeuf)} dans la journée ?`,
      reponse: `${Cap(qn(r, O.oeuf))} ont été ajoutés.`,
      hint: `Le matin : ${qn(a, O.oeuf)}. Le soir : ${f(c)}. On cherche combien d’œufs se sont ajoutés.`,
      cherche: 'On cherche le nombre d’œufs ajoutés.',
      modele: `Le tout, c’est ${f(c)} œufs le soir. Une partie, c’est ${f(a)} œufs du matin. On cherche l’autre partie.`,
      schema: sch('le matin', 'ajoutés') };
  }
});

/* ---------- avant : état initial inconnu (CP-P4 ; le plus difficile en une étape) ---------- */
kind('avant', 'tr.initial', {
  w: 1, add: true, trap: true,
  make(e) {
    const { rng } = e;
    const sc = scene(rng, [{ id: 'rubans', cap: 30 }, { id: 'carottes', cap: 20 }, { id: 'arrivees', cap: 60 }, { id: 'vente', cap: 400 },
      { id: 'lait', cap: 400000, min: 1000 }], e.range);
    const R = fit(e.range, sc.cap);
    if (!R) return null;
    const p = parts2(rng, R[0], R[1]);
    if (!p) return null;
    if (sc.id === 'rubans' || sc.id === 'arrivees') {
      const [r, b, c] = p;                               /* avant r, gagné b, maintenant c : r = c − b */
      const base = { numbers: [b, c], answer: r, ops: [{ a: c, op: '−', b, r }], alt: [{ v: b + c, why: 'inverse' }], trap: true };
      const sch = (lb) => ({ rows: [row('', [sq(r, { sub: 'avant' }), sg(b, undefined, { sub: lb, tone: 'b' })], tot(c), { totalSub: 'maintenant' })] });
      if (sc.id === 'rubans') {
        const X = anyone(rng);
        return { ...base, scene: 'rubans', unit: O.ruban,
          sentences: [`${X.Name} a gagné ${qn(b, O.ruban)} au concours.`, `Maintenant, ${X.il} en a ${f(c)}.`],
          question: `Combien de rubans ${X.name} ${inv('avait', X.il)} avant le concours ?`,
          reponse: `Avant le concours, ${X.name} avait ${qn(r, O.ruban)}.`,
          hint: `Maintenant, c’est le tout : ${f(c)} rubans. Les ${f(b)} rubans gagnés sont une partie. On cherche l’autre partie : les rubans d’avant.`,
          cherche: 'On cherche le nombre de rubans avant le concours.',
          modele: `Le tout, c’est ${f(c)}. Une partie, c’est ${f(b)}. On cherche l’autre partie.`,
          schema: sch('gagnés') };
      }
      const N = rng.pick([O.poney, O.poule, O.mouton, O.chevre]);
      if (N === O.poney && c > 30) return null;
      return { ...base, scene: 'arrivees-' + N.sg, unit: N,
        sentences: [`Ce matin, ${qn(b, N)} sont ${ppl('arrivé', N)} au ranch.`, `Maintenant, il y a ${qn(c, N)} au ranch.`],
        question: `${Combien(N)} y avait-il au ranch avant ?`,
        reponse: `Avant, il y avait ${qn(r, N)} au ranch.`,
        hint: `Maintenant, c’est le tout : ${qn(c, N)}. Ceux qui sont arrivés sont une partie : ${f(b)}. On cherche l’autre partie.`,
        cherche: `On cherche le nombre ${de(N.pl)} avant ce matin.`,
        modele: `Le tout, c’est ${f(c)}. Une partie, c’est ${f(b)}. On cherche l’autre partie.`,
        schema: sch(N.g === 'f' ? 'arrivées' : 'arrivés') };
    }
    const [c, b, r] = p;                                 /* mangé b, il reste c : avant r = b + c */
    const base = { numbers: [b, c], answer: r, ops: [{ a: c, op: '+', b, r }], alt: [{ v: Math.abs(c - b), why: 'inverse' }], trap: true };
    const sch = lb => ({ rows: [row('', [sg(c, undefined, { sub: 'il reste' }), sg(b, undefined, { sub: lb, tone: 'b' })], tot(r, true), { totalSub: 'au début' })] });
    if (sc.id === 'carottes') {
      if (b > 10) return null;
      const X = rng.chance(0.6) ? COMP : rng.pick(POOL);
      return { ...base, scene: 'carottes', unit: O.carotte,
        sentences: [`${X.Name} a mangé ${qn(b, O.carotte)}.`, `Il lui en reste ${f(c)}.`],
        question: `Combien de carottes ${X.name} ${inv('avait', X.il)} au début ?`,
        reponse: `Au début, ${X.name} avait ${qn(r, O.carotte)}.`,
        hint: `Le début, c’est le tout. Les ${f(b)} carottes mangées et les ${f(c)} qui restent sont les deux parties.`,
        cherche: 'On cherche le nombre de carottes au début.',
        modele: `Les parties sont ${f(b)} et ${f(c)}. On cherche le tout.`,
        schema: sch('mangées') };
    }
    if (sc.id === 'vente') {
      const R2 = role(rng);
      const N = rng.pick([O.sac, O.oeuf, O.botte]);
      return { ...base, scene: 'vente-' + (N.head || N.sg), unit: N,
        sentences: [`${R2.Name} a vendu ${qn(b, N)}.`, `Il lui en reste ${f(c)}.`],
        question: `${Combien(N)} ${R2.name} ${inv('avait', R2.il)} avant la vente ?`,
        reponse: `Avant la vente, ${R2.name} avait ${qn(r, N)}.`,
        hint: `Avant la vente, c’est le tout. Ce qui est vendu (${f(b)}) et ce qui reste (${f(c)}) sont les deux parties.`,
        cherche: `On cherche le nombre ${de(N.pl)} avant la vente.`,
        modele: `Les parties sont ${f(b)} et ${f(c)}. On cherche le tout.`,
        schema: sch(N.g === 'f' ? 'vendues' : 'vendus') };
    }
    return { ...base, scene: 'lait', unit: O.lait,
      sentences: [`La ferme a vendu ${qn(b, O.lait)} cette année.`, `Il lui en reste ${f(c)}.`],
      question: `${Combien(O.lait)} la ferme avait-elle au début ?`,
      reponse: `Au début, la ferme avait ${qn(r, O.lait)}.`,
      hint: `Le début, c’est le tout. Le lait vendu (${f(b)} litres) et le lait qui reste (${f(c)} litres) sont les deux parties.`,
      cherche: 'On cherche le nombre de litres au début.',
      modele: `Les parties sont ${f(b)} et ${f(c)}. On cherche le tout.`,
      schema: sch('vendus') };
  }
});

/* ---------- deux : additif en deux étapes (CP-P3, ≤ 30 au CP) ---------- */
kind('deux', 'deux.add', {
  w: 1, add: true, steps: 2,
  make(e) {
    const { rng, A } = e;
    const max = Math.min(e.cmax, A < 2 ? e.cmax : 1000);
    /* contextes et plafonds réalistes : poules de la cour ≤ 60, pommes ≤ 80, chevaux de l'écurie ≤ 40, bottes ≤ 500,
       camion de lait (grands nombres) */
    const sc = scene(rng, [{ id: 'cour', cap: 60 }, { id: 'pommes', cap: 80 }, { id: 'ecurie', cap: 40, min: A < 1 ? 0 : 99 },
      { id: 'bottes', cap: 500, min: A < 1 ? 99 : 0 }, { id: 'camion', cap: 30000, min: 1000 }], [Math.min(max / 3, e.range[0]), max]);
    const cap = Math.min(max, sc.cap);
    const t = draw(rng, Math.max(10, Math.min(cap / 3, e.range[0])), cap);
    const v = { cour: 0, pommes: 1, ecurie: 2, bottes: 3, camion: 4 }[sc.id];
    if (v === 0 || v === 1) {
      /* a + b − c (poules) ou a + b − c (pommes) ; intermédiaire a + b ≤ t */
      const s = t;
      const a = part(rng, s, 0.2, 0.8), b = s - a;
      const c = part(rng, s, 0.15, 0.75);
      const r = s - c;
      if (a < 2 || b < 2 || c < 2 || r < 2 || new Set([a, b, c]).size < 3) return null;
      const ops = [{ a, op: '+', b, r: s }, { a: s, op: '−', b: c, r }];
      const alt = [{ v: s, why: 'etape' }, { v: a + b + c, why: 'inverse' }, { v: Math.abs(a - b) + c, why: 'inverse' }];
      if (v === 0) {
        if (s > 60) return null;
        return { scene: 'cour', unit: O.poule, numbers: [a, b, c], answer: r, ops, alt, inter: [{ v: s, txt: `c’est le nombre de poules après l’arrivée` }],
          sentences: [`Il y a ${qn(a, O.poule)} dans la cour.`, `${qn(b, O.poule)} arrivent, puis ${qn(c, O.poule)} s’en vont.`],
          question: 'Combien de poules y a-t-il maintenant dans la cour ?',
          reponse: `Il y a maintenant ${qn(r, O.poule)} dans la cour.`,
          hint: `D’abord : combien de poules y a-t-il quand les ${f(b)} poules sont arrivées ?`,
          cherche: 'On cherche le nombre de poules à la fin.',
          modele: `Étape 1 : ${f(a)} et ${f(b)}, c’est le tout de départ. Étape 2 : on enlève les ${f(c)} poules qui s’en vont.`,
          schema: { rows: [row('', [sg(a), sg(b, undefined, { tone: 'b' })], mid(s)), row('', [sq(r, { sub: 'à la fin' }), sg(c, undefined, { sub: 'parties', tone: 'c' })], mid(s))] } };
      }
      const X = anyone(rng);
      const [Y] = rng.sample(POOL.filter(y => y.name !== X.name), 1);
      if (s > 60 && A < 2) return null;
      return { scene: 'pommes', unit: O.pomme, numbers: [a, b, c], answer: r, ops, alt, inter: [{ v: s, txt: `c’est le nombre de pommes après la cueillette` }],
        sentences: [`${X.Name} a ${qn(a, O.pomme)}.`, `${X.Il} en cueille ${f(b)}, puis ${X.il} en donne ${f(c)} à ${Y.name}.`],
        question: `Combien de pommes ${X.name} ${inv('a', X.il)} maintenant ?`,
        reponse: `${X.Name} a maintenant ${qn(r, O.pomme)}.`,
        hint: `D’abord : combien de pommes ${X.name} ${inv('a', X.il)} après la cueillette ?`,
        cherche: 'On cherche le nombre de pommes à la fin.',
        modele: `Étape 1 : ${f(a)} et ${f(b)}, c’est le tout après la cueillette. Étape 2 : on enlève les ${f(c)} pommes données.`,
        schema: { rows: [row('', [sg(a), sg(b, undefined, { tone: 'b' })], mid(s)), row('', [sq(r, { sub: 'à la fin' }), sg(c, undefined, { sub: 'données', tone: 'c' })], mid(s))] } };
    }
    /* trois parties : t − a − b (chevaux, bottes, lait du camion) */
    const a = part(rng, t, 0.12, 0.45);
    const b = part(rng, t, 0.12, 0.45);
    const r = t - a - b;
    if (r < 2 || new Set([a, b, r, t]).size < 4) return null;
    const ops = [{ a, op: '+', b, r: a + b }, { a: t, op: '−', b: a + b, r }];
    const alt = [{ v: a + b, why: 'etape' }, { v: t - a, why: 'etape' }, { v: t + a + b, why: 'inverse' }];
    if (v === 2) {
      return { scene: 'ecurie', unit: O.cheval, numbers: [t, a, b], answer: r, ops, alt,
        inter: [{ v: a + b, txt: 'c’est le nombre de chevaux noirs ou blancs' }, { v: t - a, txt: 'c’est le nombre de chevaux qui ne sont pas noirs' }, { v: t - b, txt: 'c’est le nombre de chevaux qui ne sont pas blancs' }],
        sentences: [`Dans l’écurie, il y a ${qn(t, O.cheval)}.`, `${Cap(f(a))} sont noirs, ${f(b)} sont blancs et les autres sont bruns.`],
        question: 'Combien de chevaux sont bruns ?',
        reponse: `${Cap(qn(r, O.cheval))} sont bruns.`,
        hint: 'D’abord : combien de chevaux sont noirs ou blancs ?',
        cherche: 'On cherche le nombre de chevaux bruns.',
        modele: `Le tout, c’est ${f(t)}. Il y a trois parties : ${f(a)} noirs, ${f(b)} blancs, et les bruns.`,
        schema: { rows: [row('', [sg(a, undefined, { sub: 'noirs' }), sg(b, undefined, { sub: 'blancs', tone: 'b' }), sq(r, { sub: 'bruns', tone: 'c' })], tot(t))] } };
    }
    if (v === 4) {
      return { scene: 'camion', unit: O.lait, numbers: [t, a, b], answer: r, ops, alt,
        inter: [{ v: a + b, txt: 'c’est le nombre de litres livrés' }, { v: t - a, txt: 'c’est ce qui reste après la fromagerie' }, { v: t - b, txt: 'c’est ce qui reste après la laiterie' }],
        sentences: [`Le camion de la coopérative transporte ${qn(t, O.lait)}.`, `Il en livre ${f(a)} à la fromagerie et ${f(b)} à la laiterie.`],
        question: `${Combien(O.lait)} reste-t-il dans le camion ?`,
        reponse: `Il reste ${qn(r, O.lait)} dans le camion.`,
        hint: 'D’abord : combien de litres de lait sont livrés en tout ?',
        cherche: 'On cherche le nombre de litres qui restent dans le camion.',
        modele: `Le tout, c’est ${f(t)}. Il y a trois parties : ${f(a)} pour la fromagerie, ${f(b)} pour la laiterie, et ce qui reste.`,
        schema: { rows: [row('', [sg(a, undefined, { sub: 'fromagerie' }), sg(b, undefined, { sub: 'laiterie', tone: 'b' }), sq(r, { sub: 'reste', tone: 'c' })], tot(t))] } };
    }
    const R2 = role(rng);
    return { scene: 'bottes', unit: O.botte, numbers: [t, a, b], answer: r, ops, alt,
      inter: [{ v: a + b, txt: 'c’est le nombre de bottes données' }, { v: t - a, txt: 'c’est ce qui reste après les chevaux' }, { v: t - b, txt: 'c’est ce qui reste après les moutons' }],
      sentences: [`${R2.Name} a ${qn(t, O.botte)}.`, `${R2.Il} en donne ${f(a)} aux chevaux et ${f(b)} aux moutons.`],
      question: 'Combien de bottes de foin lui reste-t-il ?',
      reponse: `Il lui reste ${qn(r, O.botte)}.`,
      hint: 'D’abord : combien de bottes de foin sont données en tout ?',
      cherche: 'On cherche le nombre de bottes de foin qui restent.',
      modele: `Le tout, c’est ${f(t)}. Il y a trois parties : ${f(a)} pour les chevaux, ${f(b)} pour les moutons, et ce qui reste.`,
      schema: { rows: [row('', [sg(a, undefined, { sub: 'chevaux' }), sg(b, undefined, { sub: 'moutons', tone: 'b' }), sq(r, { sub: 'reste', tone: 'c' })], tot(t))] } };
  }
});

/* ---------- groupes : multiplicatif, valeur du tout (CP-P3, ≤ 30 au CP) ---------- */
kind('groupes', 'mul.tout', {
  w: 1, mul: true,
  make(e) {
    const { rng, A } = e;
    const tabs = tablesAt(A);
    const max = e.cmax;
    const v = rng.int(0, A < 1 ? 2 : 4);
    let n, k;
    const pickNK = (kList, nMax) => {
      k = rng.pick(kList);
      const hi = Math.min(nMax, Math.floor(max / k));
      if (hi < 2) return false;
      n = draw(rng, 2, hi);
      return n * k >= 6;
    };
    if (v === 1) {                                         /* fers à cheval : 4 par poney */
      if (!pickNK([4], A < 2 ? 25 : 60)) return null;
      const r = n * k;
      return { scene: 'fers', unit: O.fer, numbers: [n, 4], answer: r, ops: [{ a: n, op: '×', b: 4, r }],
        alt: [{ v: n + 4, why: 'inverse' }],
        sentences: [`Le maréchal-ferrant ferre ${qn(n, O.poney)}.`, 'Il pose 4 fers à cheval à chaque poney.'],
        question: 'Combien de fers à cheval pose-t-il en tout ?',
        reponse: `Il pose ${qn(r, O.fer)} en tout.`,
        hint: `Il y a ${qn(n, O.poney)}, et 4 fers pour chaque poney. On cherche le nombre de fers en tout.`,
        cherche: 'On cherche le nombre de fers à cheval en tout.',
        modele: `Il y a ${f(n)} groupes de 4 fers : c’est ${f(n)} fois 4.`,
        schema: groupsSchema(n, 4, r, { each: true, total: false, label: 'poney' }) };
    }
    if (v === 2) {                                         /* boîtes d'œufs */
      if (!pickNK(A < 1 ? [6, 10] : [6, 10, 12], 30)) return null;
      const X = anyone(rng);
      const r = n * k;
      return { scene: 'boites', unit: O.oeuf, numbers: [n, k], answer: r, ops: [{ a: n, op: '×', b: k, r }],
        alt: [{ v: n + k, why: 'inverse' }],
        sentences: [`${X.Name} remplit ${qn(n, O.boite)} d’œufs.`, `Dans chaque boîte, ${X.il} met ${qn(k, O.oeuf)}.`],
        question: `Combien d’œufs ${X.name} ${inv('met', X.il)} en tout ?`,
        reponse: `${X.Name} met ${qn(r, O.oeuf)} en tout.`,
        hint: `Il y a ${qn(n, O.boite)}, avec ${qn(k, O.oeuf)} dans chacune. On cherche le nombre d’œufs en tout.`,
        cherche: 'On cherche le nombre d’œufs en tout.',
        modele: `Il y a ${f(n)} boîtes de ${f(k)} œufs : c’est ${f(n)} fois ${f(k)}.`,
        schema: groupsSchema(n, k, r, { each: true, total: false, label: 'boîte' }) };
    }
    if (v === 3) {                                         /* achat à prix unitaire (CE1+) */
      const N = rng.pick([O.brosse, O.sac, O.seau, O.botte]);
      const pMax = N === O.sac ? 30 : N === O.botte ? 8 : 15;
      k = rng.pick(tabs.filter(x => x <= pMax).concat(A >= 2 ? [rng.int(11, pMax + 10)] : []));
      const hi = Math.min(A < 2 ? 9 : 25, Math.floor(max / k));
      if (hi < 2) return null;
      n = A < 2 ? rng.pick(tabs.filter(x => x <= hi).concat([2])) : draw(rng, 2, hi);
      const r = n * k;
      const X = buyer(rng);
      return { scene: 'achat-' + (N.head || N.sg), unit: '€', numbers: [n, k], answer: r, ops: [{ a: n, op: '×', b: k, r }],
        alt: [{ v: n + k, why: 'inverse' }],
        sentences: [`${X.Name} achète ${qn(n, N)} à ${eur(k)} ${chacun(N)}.`],
        question: `Combien ${X.name} ${inv('paie', X.il)} ?`,
        reponse: `${X.Name} paie ${eur(r)}.`,
        hint: `Il y a ${qn(n, N)}, et ${chacun(N)} coûte ${eur(k)}. On cherche le prix de tout l’achat.`,
        cherche: 'On cherche le prix à payer.',
        modele: `C’est ${f(n)} fois ${eur(k)}.`,
        schema: groupsSchema(n, k, r, { each: true, total: false, label: N.head || N.sg }) };
    }
    if (v === 4) {                                         /* enclos de moutons (CE1+) */
      if (!pickNK(tabs.filter(x => x >= 3), 12)) return null;
      const r = n * k;
      return { scene: 'enclos', unit: O.mouton, numbers: [n, k], answer: r, ops: [{ a: n, op: '×', b: k, r }],
        alt: [{ v: n + k, why: 'inverse' }],
        sentences: [`Le ranch a ${qn(n, O.enclos)}.`, `Dans chaque enclos, il y a ${qn(k, O.mouton)}.`],
        question: 'Combien de moutons y a-t-il en tout ?',
        reponse: `Il y a ${qn(r, O.mouton)} en tout.`,
        hint: `Il y a ${qn(n, O.enclos)}, avec ${qn(k, O.mouton)} dans chacun. On cherche le nombre de moutons en tout.`,
        cherche: 'On cherche le nombre de moutons en tout.',
        modele: `Il y a ${f(n)} groupes de ${f(k)} moutons : c’est ${f(n)} fois ${f(k)}.`,
        schema: groupsSchema(n, k, r, { each: true, total: false, label: 'enclos' }) };
    }
    if (!pickNK(tabs.filter(x => x <= 10), 10)) return null;
    const R2 = role(rng);
    const r = n * k;
    return { scene: 'seaux', unit: O.carotte, numbers: [n, k], answer: r, ops: [{ a: n, op: '×', b: k, r }],
      alt: [{ v: n + k, why: 'inverse' }],
      sentences: [`${R2.Name} remplit ${qn(n, O.seau)}.`, `${R2.Il} met ${qn(k, O.carotte)} dans chaque seau.`],
      question: `Combien de carottes ${R2.name} ${inv('met', R2.il)} en tout ?`,
      reponse: `${R2.Name} met ${qn(r, O.carotte)} en tout.`,
      hint: `Il y a ${qn(n, O.seau)}, avec ${qn(k, O.carotte)} dans chacun. On cherche le nombre de carottes en tout.`,
      cherche: 'On cherche le nombre de carottes en tout.',
      modele: `Il y a ${f(n)} groupes de ${f(k)} carottes : c’est ${f(n)} fois ${f(k)}.`,
      schema: groupsSchema(n, k, r, { each: true, total: false, label: 'seau' }) };
  }
});
/* n cases égales de k ; each/total : connus ? ; plus de 8 groupes : quelques cases puis « … » */
function groupsSchema(n, k, total, { each = true, total: totalKnown = false, count = true } = {}) {
  /* nombre de groupes inconnu (quotition, reste) : deux cases puis « … » (sinon le dessin donnerait la réponse) */
  const show = !count ? Math.min(2, n) : n <= 8 ? n : 4;
  const segs = [];
  for (let i = 0; i < show; i++) segs.push(each ? sg(k) : sq(k, { soft: i > 0 }));
  if (show < n) segs.push({ v: k, t: '…', dots: true });
  return { rows: [row('', segs, tot(total, !totalKnown), { n: { v: n, t: count ? f(n) : '?', q: !count } })], groups: n };
}

/* ---------- quotition (nombre de parts) et partition (valeur d'une part) : CP-P4, ≤ 30 au CP ---------- */
kind('quotition', 'mul.partage', {
  w: 0.8, mul: true,
  make(e) {
    const { rng, A } = e;
    const tabs = tablesAt(A);
    const v = rng.int(0, 2);
    const k = v === 2 ? rng.pick(A < 1 ? [6, 10] : [6, 10, 12]) : rng.pick(tabs.filter(x => x <= 10));
    const hi = Math.min(A < 2 ? 10 : 30, Math.floor(e.cmax / k));
    if (hi < 2) return null;
    const r = draw(rng, 2, hi), t = r * k;
    const base = { numbers: [t, k], answer: r, ops: [{ a: t, op: '÷', b: k, r }],
      alt: [{ v: t - k, why: 'inverse' }, { v: t + k, why: 'inverse' }] };
    const sch = groupsSchema(r, k, t, { each: true, total: true, count: false });
    if (v === 0) {
      const R2 = role(rng);
      return { ...base, scene: 'seaux', unit: O.seau,
        sentences: [`${R2.Name} a ${qn(t, O.carotte)}.`, `${R2.Il} en met ${f(k)} dans chaque seau.`],
        question: `Combien de seaux ${R2.name} ${inv('peut', R2.il)} remplir ?`,
        reponse: `${R2.Name} peut remplir ${qn(r, O.seau)}.`,
        hint: `On fait des groupes de ${qn(k, O.carotte)} avec les ${f(t)} carottes. On cherche le nombre de groupes.`,
        cherche: 'On cherche le nombre de seaux.',
        modele: `Dans ${f(t)}, combien de fois ${f(k)} ?`,
        schema: sch };
    }
    if (v === 1) {
      const X = anyone(rng);
      return { ...base, scene: 'paquets', unit: O.paquet,
        sentences: [`${X.Name} a ${qn(t, O.pomme)}.`, `${X.Il} fait des paquets de ${qn(k, O.pomme)}.`],
        question: `Combien de paquets ${X.name} ${inv('peut', X.il)} faire ?`,
        reponse: `${X.Name} peut faire ${qn(r, O.paquet)}.`,
        hint: `On fait des paquets de ${f(k)} avec les ${f(t)} pommes. On cherche le nombre de paquets.`,
        cherche: 'On cherche le nombre de paquets.',
        modele: `Dans ${f(t)}, combien de fois ${f(k)} ?`,
        schema: sch };
    }
    const R2 = role(rng);
    return { ...base, scene: 'boites', unit: O.boite,
      sentences: [`${R2.Name} range ${qn(t, O.oeuf)} dans des boîtes de ${f(k)}.`],
      question: `Combien de boîtes ${R2.name} ${inv('remplit', R2.il)} ?`,
      reponse: `${R2.Name} remplit ${qn(r, O.boite)}.`,
      hint: `On fait des boîtes de ${qn(k, O.oeuf)} avec les ${f(t)} œufs. On cherche le nombre de boîtes.`,
      cherche: 'On cherche le nombre de boîtes.',
      modele: `Dans ${f(t)}, combien de fois ${f(k)} ?`,
      schema: sch };
  }
});
kind('partition', 'mul.partage', {
  w: 0.8, mul: true,
  make(e) {
    const { rng, A } = e;
    const tabs = tablesAt(A);
    const v = A >= 2 ? rng.int(0, 3) : rng.int(0, 1);
    if (v === 0) {                                     /* des animaux se partagent leur goûter (petites quantités) */
      const N = rng.pick([O.poney, O.lapin, O.chevre]);
      const F = N === O.lapin ? O.carotte : rng.pick([O.pomme, O.carotte]);
      const n = rng.pick(tabs.filter(x => x <= (A < 1 ? 5 : 8)));
      const r = rng.int(2, A < 1 ? 6 : 8), t = n * r;
      if (t > e.cmax || n === r) return null;
      return { scene: 'partage-' + N.sg, unit: F, numbers: [n, t], answer: r, ops: [{ a: t, op: '÷', b: n, r }],
        alt: [{ v: t - n, why: 'inverse' }, { v: t + n, why: 'inverse' }],
        sentences: [`${Cap(qn(n, N))} se partagent ${qn(t, F)} en parts égales.`],
        question: `${Combien(F)} chaque ${N.sg} ${inv('reçoit', N.g === 'f' ? 'elle' : 'il')} ?`,
        reponse: `Chaque ${N.sg} reçoit ${qn(r, F)}.`,
        hint: `On partage ${qn(t, F)} en ${f(n)} parts égales. On cherche une part.`,
        cherche: `On cherche le nombre ${de(F.pl)} de chaque ${N.sg}.`,
        modele: `${f(t)} partagé en ${f(n)} parts égales.`,
        schema: shareSchema(n, r, t) };
    }
    if (v === 1) {                                     /* des œufs rangés dans des boîtes (6, 10 ou 12 par boîte) */
      const r = rng.pick(A < 1 ? [6, 10] : [6, 10, 12]);
      const hi = Math.min(A < 2 ? 9 : 30, Math.floor(e.cmax / r));
      if (hi < 2) return null;
      const n = rng.int(2, hi), t = n * r;
      if (n === r) return null;
      const R2 = role(rng);
      return { scene: 'boites', unit: O.oeuf, numbers: [t, n], answer: r, ops: [{ a: t, op: '÷', b: n, r }],
        alt: [{ v: t - n, why: 'inverse' }, { v: t + n, why: 'inverse' }],
        sentences: [`${R2.Name} range ${qn(t, O.oeuf)} dans ${qn(n, O.boite)}.`, `${R2.Il} met le même nombre d’œufs dans chaque boîte.`],
        question: `Combien d’œufs ${R2.name} ${inv('met', R2.il)} dans chaque boîte ?`,
        reponse: `${R2.Name} met ${qn(r, O.oeuf)} dans chaque boîte.`,
        hint: `On partage ${qn(t, O.oeuf)} en ${f(n)} boîtes égales. On cherche ce qu’il y a dans une boîte.`,
        cherche: 'On cherche le nombre d’œufs dans une boîte.',
        modele: `${f(t)} partagé en ${f(n)} parts égales.`,
        schema: shareSchema(n, r, t) };
    }
    const n = rng.int(2, 9);
    if (v === 2) {                                     /* les fermes du village se partagent une somme (CE2+) */
      const r = roundish(rng, draw(rng, 20, Math.max(25, Math.floor(e.cmax / n))));
      const t = n * r;
      if (n === r || t > e.cmax * 1.2) return null;
      return { scene: 'fermes', unit: '€', numbers: [n, t], answer: r, ops: [{ a: t, op: '÷', b: n, r }],
        alt: [{ v: t - n, why: 'inverse' }, { v: t * n, why: 'inverse' }],
        sentences: [`Les ${qn(n, O.ferme)} du village se partagent ${eur(t)} en parts égales.`],
        question: 'Combien d’euros chaque ferme reçoit-elle ?',
        reponse: `Chaque ferme reçoit ${eur(r)}.`,
        hint: `On partage ${eur(t)} en ${f(n)} parts égales. On cherche une part.`,
        cherche: 'On cherche la part de chaque ferme.',
        modele: `${eur(t)} partagés en ${f(n)} parts égales.`,
        schema: shareSchema(n, r, t, true) };
    }
    const r = rng.int(5, 40), t = n * r;               /* du foin réparti dans des râteliers (CE2+) */
    if (n === r) return null;
    const R2 = role(rng);
    return { scene: 'rateliers', unit: 'kg', numbers: [t, n], answer: r, ops: [{ a: t, op: '÷', b: n, r }],
      alt: [{ v: t - n, why: 'inverse' }, { v: t * n, why: 'inverse' }],
      sentences: [`${R2.Name} répartit ${kg(t)} de foin dans ${qn(n, O.ratelier)}.`, `${R2.Il} en met autant dans chaque râtelier.`],
      question: `Combien de kilos de foin ${R2.name} ${inv('met', R2.il)} dans chaque râtelier ?`,
      reponse: `${R2.Name} met ${kg(r)} de foin dans chaque râtelier.`,
      hint: `On partage ${kg(t)} en ${f(n)} parts égales. On cherche une part.`,
      cherche: 'On cherche le foin d’un râtelier.',
      modele: `${kg(t)} partagés en ${f(n)} parts égales.`,
      schema: shareSchema(n, r, t) };
  }
});
/* n parts égales inconnues, total connu */
function shareSchema(n, r, t, money = false) {
  const segs = [];
  const show = Math.min(n, 8);
  for (let i = 0; i < show; i++) segs.push(sq(r, { soft: i > 0 }));
  return { rows: [row(f(n) + ' parts', segs, tot(t, false, money ? eur(t) : undefined))], groups: n };
}

/* ---------- comparaison : référé inconnu (CE1-P1), écart inconnu (CE1-P2), référent inconnu (CE1-P3) ---------- */
/* contextes : rubans, pommes, œufs pondus (poules), âges ; tailles (cm), poids (kg), prix des engins (€) ; lait de la ferme */
const CMP_SCENES = [
  { id: 'rubans', cap: 40 }, { id: 'pommes', cap: 60 }, { id: 'oeufs', cap: 60 }, { id: 'age', cap: 30 },
  { id: 'taille', cap: 180, min: 150 }, { id: 'poids', cap: 700, min: 300 }, { id: 'engins', cap: 90000, min: 20000 },
  { id: 'lait', cap: 400000, min: 800 }
];
/* deux objets de tailles différentes : le grand et le petit, un verbe, une unité */
const DUOS = {
  taille: { big: 'le cheval', small: 'le poney', verb: 'mesure', fmt: n => cm(n), unit: 'cm', hi: [150, 175], lo: [100, 145], ecartQ: 'Combien de centimètres', what: 'taille', whats: 'tailles' },
  poids: { big: 'le cheval', small: 'le poney', verb: 'pèse', fmt: n => kg(n), unit: 'kg', hi: [450, 700], lo: [150, 350], ecartQ: 'Combien de kilos', what: 'poids', whats: 'poids' },
  engins: { big: 'le tracteur', small: 'le van', verb: 'coûte', fmt: n => eur(n), unit: '€', hi: [20000, 90000], lo: [5000, 35000], ecartQ: 'Combien d’euros', what: 'prix', whats: 'prix' }
};
const bare = s => s.replace(/^(le|la) /, '');
function cmpSetup(rng, e, { allowComp = true } = {}) {
  const s = scene(rng, CMP_SCENES, e.range);
  if (s.id === 'oeufs') { const [A1, B1] = two(rng, HENS); return { v: s.id, cap: s.cap, A1, B1, B: B1 }; }
  const [A1, B1] = two(rng);
  return { v: s.id, cap: s.cap, A1, B1, B: allowComp && (s.id === 'rubans' || s.id === 'pommes') && rng.chance(0.4) ? COMP : B1 };
}
/* grand et petit d'un duo (arrondis aux centaines pour les engins) */
function duoNums(rng, D) {
  const r = n => (D.unit === '€' ? Math.round(n / 100) * 100 : n);
  const big = r(rng.int(D.hi[0], D.hi[1])), small = r(rng.int(D.lo[0], D.lo[1]));
  return [big, small, big - small];
}
/* t dans le champ du niveau, au plafond réaliste du contexte */
const cmpTotal = (rng, e, cap) => { const hi = Math.min(e.range[1], cap); return hi < 8 ? null : draw(rng, Math.max(6, Math.min(e.range[0], hi / 2)), hi); };

kind('plus', 'cmp', {
  w: 1.1, add: true, cmp: true,
  make(e) {
    const { rng } = e;
    const s = cmpSetup(rng, e);
    const more = rng.chance(0.55);
    if (DUOS[s.v]) {
      const D = DUOS[s.v];
      const [big, small, d] = duoNums(rng, D);
      if (d < 2 || big === d || small === d) return null;
      const lb = bare(D.big), ls = bare(D.small);
      if (more) {
        return { scene: s.v, unit: D.unit, numbers: [small, d], answer: big, ops: [{ a: small, op: '+', b: d, r: big }],
          alt: [{ v: Math.abs(small - d), why: 'inverse' }],
          sentences: [`${Cap(D.small)} ${D.verb} ${D.fmt(small)}.`, `${Cap(D.big)} ${D.verb} ${D.fmt(d)} de plus que ${D.small}.`],
          question: `Combien ${D.verb} ${D.big} ?`,
          reponse: `${Cap(D.big)} ${D.verb} ${D.fmt(big)}.`,
          hint: `On compare deux ${D.whats} : ${D.big} a ${D.fmt(d)} de plus.`,
          cherche: `On cherche le ${D.what} ${D.big.startsWith('le') ? 'du ' + lb : 'de la ' + lb}.`,
          modele: `Deux barres : ${ls} (${D.fmt(small)}) et ${lb}, plus longue de ${D.fmt(d)}.`,
          schema: cmpSchema(ls, small, lb, big, d, 'b') };
      }
      return { scene: s.v, unit: D.unit, numbers: [big, d], answer: small, ops: [{ a: big, op: '−', b: d, r: small }],
        alt: [{ v: big + d, why: 'inverse' }],
        sentences: [`${Cap(D.big)} ${D.verb} ${D.fmt(big)}.`, `${Cap(D.small)} ${D.verb} ${D.fmt(d)} de moins que ${D.big}.`],
        question: `Combien ${D.verb} ${D.small} ?`,
        reponse: `${Cap(D.small)} ${D.verb} ${D.fmt(small)}.`,
        hint: `On compare deux ${D.whats} : ${D.small} a ${D.fmt(d)} de moins.`,
        cherche: `On cherche le ${D.what} du ${ls}.`,
        modele: `Deux barres : ${lb} (${D.fmt(big)}) et ${ls}, plus courte de ${D.fmt(d)}.`,
        schema: cmpSchema(lb, big, ls, small, d, 'b') };
    }
    const t = cmpTotal(rng, e, s.cap);
    if (!t) return null;
    const d = part(rng, t, 0.08, 0.5);
    const a = more ? t - d : t, r = more ? t : t - d;
    if (a < 2 || d < 2 || r < 2 || a === d) return null;
    const base = { numbers: [a, d], answer: r, ops: [{ a, op: more ? '+' : '−', b: d, r }],
      alt: [{ v: more ? Math.abs(a - d) : a + d, why: 'inverse' }] };
    const mot = more ? 'de plus' : 'de moins';
    if (s.v === 'age') {
      const { A1, B1 } = s;
      return { ...base, scene: 'age', unit: O.an,
        sentences: [`${A1.Name} a ${qn(a, O.an)}.`, `${B1.Name} a ${f(d)} ans ${mot} que ${A1.name}.`],
        question: `Quel âge a ${B1.name} ?`,
        reponse: `${B1.Name} a ${qn(r, O.an)}.`,
        hint: `On compare deux âges : ${B1.name} a ${f(d)} ans ${mot} que ${A1.name}.`,
        cherche: `On cherche l’âge de ${B1.name}.`,
        modele: `Deux barres : ${A1.name} (${f(a)} ans) et ${B1.name}, ${f(d)} ans ${mot}.`,
        schema: cmpSchema(A1.name, a, B1.name, r, d, 'b') };
    }
    if (s.v === 'lait') {
      return { ...base, scene: 'lait', unit: O.lait,
        sentences: [`L’an dernier, la ferme a produit ${qn(a, O.lait)}.`, `Cette année, elle en a produit ${f(d)} ${mot}.`],
        question: `${Combien(O.lait)} la ferme a-t-elle ${ppl('produit', O.lait)} cette année ?`,
        reponse: `Cette année, la ferme a produit ${qn(r, O.lait)}.`,
        hint: `On compare deux années : cette année, la ferme a produit ${f(d)} litres ${mot} que l’an dernier.`,
        cherche: 'On cherche le lait produit cette année.',
        modele: `Deux barres : l’an dernier (${f(a)}) et cette année, ${f(d)} ${mot}.`,
        schema: cmpSchema('l’an dernier', a, 'cette année', r, d, 'b') };
    }
    if (s.v === 'oeufs') {
      const { A1, B1 } = s;
      return { ...base, scene: 'oeufs', unit: O.oeuf,
        sentences: [`${A1.Name} a pondu ${qn(a, O.oeuf)}.`, `${B1.Name} en a pondu ${f(d)} ${mot} que ${A1.name}.`],
        question: `Combien d’œufs ${B1.name} ${inv('a', B1.il)} ${ppl('pondu', O.oeuf)} ?`,
        reponse: `${B1.Name} a pondu ${qn(r, O.oeuf)}.`,
        hint: `On compare les œufs de deux poules : ${B1.name} en a ${f(d)} ${mot} que ${A1.name}.`,
        cherche: `On cherche le nombre d’œufs de ${B1.name}.`,
        modele: `Deux barres : ${A1.name} (${f(a)}) et ${B1.name}, ${f(d)} ${mot}.`,
        schema: cmpSchema(A1.name, a, B1.name, r, d, 'b') };
    }
    const N = s.v === 'rubans' ? O.ruban : O.pomme;
    const { A1, B } = s;
    return { ...base, scene: s.v, unit: N,
      sentences: [`${A1.Name} a ${qn(a, N)}.`, `${B.Name} en a ${f(d)} ${mot} que ${A1.name}.`],
      question: `${Combien(N)} ${B.name} ${inv('a', B.il)} ?`,
      reponse: `${B.Name} a ${qn(r, N)}.`,
      hint: `On compare deux nombres ${de(N.pl)} : ${B.name} en a ${f(d)} ${mot} que ${A1.name}.`,
      cherche: `On cherche le nombre ${de(N.pl)} de ${B.kind === 'comp' ? 'ton compagnon' : B.name}.`,
      modele: `Deux barres : ${A1.name} (${f(a)}) et ${B.name}, ${f(d)} ${mot}.`,
      schema: cmpSchema(A1.name, a, B.name, r, d, 'b') };
  }
});
/* deux barres alignées à gauche : la plus longue = la plus courte + l'écart ; unk : 'a' (première), 'b' (deuxième),
   'd' (écart) */
function cmpSchema(la, a, lb, b, d, unk, softUnk = false) {
  const small = Math.min(a, b);
  const aBig = a >= b;
  const mk = (isBig, label, val, unknown) => {
    if (isBig) {
      return row(label, [sg(small, '', { same: true }), unk === 'd' ? sq(d, { tone: 'b', diff: true }) : sg(d, undefined, { tone: 'b', diff: true })],
        unknown && softUnk ? mid(val) : tot(val, unknown));
    }
    return row(label, [unknown ? (softUnk ? sqm(val) : sq(val)) : sg(val)], null);
  };
  const ua = unk === 'a', ub = unk === 'b';
  /* la valeur de la plus courte est écrite dans sa barre ; la plus longue porte son total à droite */
  return { rows: [mk(aBig, la, a, ua), mk(!aBig, lb, b, ub)], cmp: true };
}
kind('ecart', 'cmp.ecart', {
  also: ['cmp'],
  w: 1, add: true, cmp: true,
  make(e) {
    const { rng } = e;
    const s = cmpSetup(rng, e, { allowComp: false });
    if (DUOS[s.v]) {
      const D = DUOS[s.v];
      const [big, small, d] = duoNums(rng, D);
      if (d < 2 || big === d || small === d) return null;
      const lb = bare(D.big), ls = bare(D.small);
      return { scene: s.v, unit: D.unit, numbers: [big, small], answer: d, ops: [{ a: big, op: '−', b: small, r: d }],
        alt: [{ v: big + small, why: 'inverse' }],
        sentences: [`${Cap(D.big)} ${D.verb} ${D.fmt(big)}.`, `${Cap(D.small)} ${D.verb} ${D.fmt(small)}.`],
        question: `${D.ecartQ} ${D.big} ${inv(D.verb, 'il')} de plus que ${D.small} ?`,
        reponse: `${Cap(D.big)} ${D.verb} ${D.fmt(d)} de plus que ${D.small}.`,
        hint: `On compare deux ${D.whats} : on cherche l’écart.`,
        cherche: 'On cherche l’écart entre les deux.',
        modele: `Deux barres : ${D.fmt(big)} et ${D.fmt(small)}. On cherche le morceau en plus.`,
        schema: cmpSchema(lb, big, ls, small, d, 'd') };
    }
    const b = cmpTotal(rng, e, s.cap);
    if (!b) return null;
    const a = part(rng, b, 0.2, 0.9);
    const d = Math.abs(a - b);
    if (a < 2 || d < 2 || a === b || a === d) return null;
    const base = { numbers: [a, b], answer: d, ops: [{ a: b, op: '−', b: a, r: d }], alt: [{ v: a + b, why: 'inverse' }] };
    if (s.v === 'age') {
      const { A1, B1 } = s;
      return { ...base, scene: 'age', unit: O.an,
        sentences: [`${A1.Name} a ${qn(a, O.an)}.`, `${B1.Name} a ${qn(b, O.an)}.`],
        question: `Combien d’années ${B1.name} ${inv('a', B1.il)} de plus que ${A1.name} ?`,
        reponse: `${B1.Name} a ${qn(d, O.an)} de plus que ${A1.name}.`,
        hint: 'On compare deux âges : on cherche l’écart.',
        cherche: 'On cherche l’écart entre les deux âges.',
        modele: `Deux barres : ${f(b)} et ${f(a)}. On cherche le morceau en plus.`,
        schema: cmpSchema(A1.name, a, B1.name, b, d, 'd') };
    }
    if (s.v === 'lait') {
      return { ...base, scene: 'lait', unit: O.lait,
        sentences: [`L’an dernier, la ferme a produit ${qn(a, O.lait)}.`, `Cette année, elle en a produit ${f(b)}.`],
        question: `${Combien(O.lait)} la ferme a-t-elle ${ppl('produit', O.lait)} de plus cette année ?`,
        reponse: `Cette année, la ferme a produit ${qn(d, O.lait)} de plus.`,
        hint: 'On compare deux années : on cherche l’écart.',
        cherche: 'On cherche l’écart entre les deux années.',
        modele: `Deux barres : ${f(b)} et ${f(a)}. On cherche le morceau en plus.`,
        schema: cmpSchema('l’an dernier', a, 'cette année', b, d, 'd') };
    }
    const { A1, B1 } = s;
    const egg = s.v === 'oeufs';
    const N = egg ? O.oeuf : s.v === 'rubans' ? O.ruban : O.pomme;
    const verb = egg ? 'a pondu' : 'a';
    const moreQ = rng.chance(0.65);
    const [S1, S2] = moreQ ? [B1, A1] : [A1, B1];
    const pp = egg ? ' ' + ppl('pondu', N) : '';
    return { ...base, scene: s.v, unit: N,
      sentences: [`${A1.Name} ${verb} ${qn(a, N)}.`, `${B1.Name} en ${verb} ${f(b)}.`],
      question: `${Combien(N)} ${S1.name} ${inv('a', S1.il)}${pp} de ${moreQ ? 'plus' : 'moins'} que ${S2.name} ?`,
      reponse: `${S1.Name} ${verb} ${qn(d, N)} de ${moreQ ? 'plus' : 'moins'} que ${S2.name}.`,
      hint: `On compare deux nombres ${de(N.pl)} : on cherche l’écart.`,
      cherche: 'On cherche l’écart entre les deux nombres.',
      modele: `Deux barres : ${f(b)} et ${f(a)}. On cherche le morceau en plus.`,
      schema: cmpSchema(A1.name, a, B1.name, b, d, 'd') };
  }
});
kind('referent', 'cmp.referent', {
  also: ['cmp'],
  w: 1, add: true, cmp: true, trap: true,
  make(e) {
    const { rng } = e;
    const s = cmpSetup(rng, e);
    const more = rng.chance(0.55);                     /* « de plus » → soustraction ; « de moins » → addition */
    if (DUOS[s.v]) {
      const D = DUOS[s.v];
      const [big, small, d] = duoNums(rng, D);
      if (d < 2 || big === d || small === d) return null;
      const lb = bare(D.big), ls = bare(D.small);
      if (more) {                                      /* le grand est donné : « c’est d de plus que le petit » */
        return { scene: s.v, unit: D.unit, numbers: [big, d], answer: small, ops: [{ a: big, op: '−', b: d, r: small }], trap: true,
          alt: [{ v: big + d, why: 'inverse' }],
          sentences: [`${Cap(D.big)} ${D.verb} ${D.fmt(big)}.`, `C’est ${D.fmt(d)} de plus que ${D.small}.`],
          question: `Combien ${D.verb} ${D.small} ?`,
          reponse: `${Cap(D.small)} ${D.verb} ${D.fmt(small)}.`,
          hint: `Attention : c’est ${D.big} qui a ${D.fmt(d)} de plus. ${Cap(D.small)} a donc moins.`,
          cherche: `On cherche le ${D.what} du ${ls}.`,
          modele: `Deux barres : ${lb} (${D.fmt(big)}) et ${ls}, plus courte de ${D.fmt(d)}.`,
          schema: cmpSchema(lb, big, ls, small, d, 'b') };
      }
      return { scene: s.v, unit: D.unit, numbers: [small, d], answer: big, ops: [{ a: small, op: '+', b: d, r: big }], trap: true,
        alt: [{ v: Math.abs(small - d), why: 'inverse' }],
        sentences: [`${Cap(D.small)} ${D.verb} ${D.fmt(small)}.`, `C’est ${D.fmt(d)} de moins que ${D.big}.`],
        question: `Combien ${D.verb} ${D.big} ?`,
        reponse: `${Cap(D.big)} ${D.verb} ${D.fmt(big)}.`,
        hint: `Attention : c’est ${D.small} qui a ${D.fmt(d)} de moins. ${Cap(D.big)} a donc plus.`,
        cherche: `On cherche le ${D.what} du ${lb}.`,
        modele: `Deux barres : ${ls} (${D.fmt(small)}) et ${lb}, plus longue de ${D.fmt(d)}.`,
        schema: cmpSchema(ls, small, lb, big, d, 'b') };
    }
    const t = cmpTotal(rng, e, s.cap);
    if (!t) return null;
    const d = part(rng, t, 0.08, 0.5);
    const b = more ? t : t - d, r = more ? t - d : t;
    if (b < 2 || d < 2 || r < 2 || b === d) return null;
    const base = { numbers: [b, d], answer: r, ops: [{ a: b, op: more ? '−' : '+', b: d, r }], trap: true,
      alt: [{ v: more ? b + d : Math.abs(b - d), why: 'inverse' }] };
    const mot = more ? 'de plus' : 'de moins';
    if (s.v === 'age') {
      const { A1, B1 } = s;
      return { ...base, scene: 'age', unit: O.an,
        sentences: [`${B1.Name} a ${qn(b, O.an)}.`, `${B1.Il} a ${f(d)} ans ${mot} que ${A1.name}.`],
        question: `Quel âge a ${A1.name} ?`,
        reponse: `${A1.Name} a ${qn(r, O.an)}.`,
        hint: `Attention : c’est ${B1.name} qui a ${f(d)} ans ${mot}. Qui est le plus âgé ?`,
        cherche: `On cherche l’âge de ${A1.name}.`,
        modele: `Deux barres : ${B1.name} (${f(b)} ans) et ${A1.name}. La barre de ${B1.name} est ${more ? 'la plus longue' : 'la plus courte'}.`,
        schema: cmpSchema(B1.name, b, A1.name, r, d, 'b') };
    }
    if (s.v === 'lait') {
      return { ...base, scene: 'lait', unit: O.lait,
        sentences: [`Cette année, la ferme a produit ${qn(b, O.lait)}.`, `C’est ${f(d)} litres ${mot} que l’an dernier.`],
        question: `${Combien(O.lait)} la ferme a-t-elle ${ppl('produit', O.lait)} l’an dernier ?`,
        reponse: `L’an dernier, la ferme a produit ${qn(r, O.lait)}.`,
        hint: `Attention : c’est cette année qu’il y a ${f(d)} litres ${mot}. Quelle année a le plus de lait ?`,
        cherche: 'On cherche le lait produit l’an dernier.',
        modele: `Deux barres : cette année (${f(b)}) et l’an dernier. La barre de cette année est ${more ? 'la plus longue' : 'la plus courte'}.`,
        schema: cmpSchema('cette année', b, 'l’an dernier', r, d, 'b') };
    }
    const egg = s.v === 'oeufs';
    const N = egg ? O.oeuf : s.v === 'rubans' ? O.ruban : O.pomme;
    const { A1, B } = s;
    const verb = egg ? 'a pondu' : 'a';
    return { ...base, scene: s.v, unit: N,
      sentences: [`${B.Name} ${verb} ${qn(b, N)}.`, `${B.Il} en ${verb} ${f(d)} ${mot} que ${A1.name}.`],
      question: egg ? `${Combien(N)} ${A1.name} ${inv('a', A1.il)} ${ppl('pondu', N)} ?` : `${Combien(N)} ${A1.name} ${inv('a', A1.il)} ?`,
      reponse: `${A1.Name} ${verb} ${qn(r, N)}.`,
      hint: `Attention : c’est ${B.name} qui en a ${f(d)} ${mot}. Qui en a le plus ?`,
      cherche: `On cherche le nombre ${de(N.pl)} de ${A1.name}.`,
      modele: `Deux barres : ${B.name} (${f(b)}) et ${A1.name}, ${more ? 'plus courte' : 'plus longue'} de ${f(d)}.`,
      schema: cmpSchema(B.name, b, A1.name, r, d, 'b') };
  }
});

/* ---------- prix : mixte en deux étapes (CE1-P3) ---------- */
kind('prix', 'mixte', {
  also: ['mul.tout'],
  w: 1, steps: 2, mul: true,
  make(e) {
    const { rng, A } = e;
    const tabs = tablesAt(A);
    const v = rng.int(0, 2);
    if (v === 0) {                                     /* rendu de monnaie : B − n × p */
      const N = rng.pick([O.sac, O.botte, O.seau, O.brosse]);
      const p = rng.pick(tabs.filter(x => x <= 10));
      const n = rng.int(2, A < 2 ? 6 : 9);
      const s = n * p;
      const bills = [10, 20, 50, 100].concat(A >= 2 ? [200] : []).filter(x => x > s);
      if (!bills.length) return null;
      const Bv = rng.pick(bills.slice(0, 2));
      const r = Bv - s;
      if (r < 2 || [n, p, Bv].includes(r)) return null;
      const X = buyer(rng);
      return { scene: 'rendu-' + (N.head || N.sg), unit: '€', numbers: [n, p, Bv], answer: r,
        ops: [{ a: n, op: '×', b: p, r: s }, { a: Bv, op: '−', b: s, r }],
        inter: [{ v: s, txt: `c’est le prix des ${N.pl}` }],
        alt: [{ v: s, why: 'etape' }, { v: Bv - n - p, why: 'inverse' }, { v: Bv - p, why: 'etape' }],
        sentences: [`${X.Name} achète ${qn(n, N)} à ${eur(p)} ${leArt(N)}.`, `${X.Il} paie avec un billet de ${eur(Bv)}.`],
        question: 'Combien la marchande lui rend-elle ?',
        reponse: `La marchande lui rend ${eur(r)}.`,
        hint: `D’abord : combien coûtent les ${qn(n, N)} ?`,
        cherche: 'On cherche la monnaie rendue.',
        modele: `Étape 1 : le prix, c’est ${f(n)} fois ${eur(p)}. Étape 2 : le billet, c’est le tout ; le prix est une partie.`,
        schema: { rows: [row('', Array.from({ length: Math.min(n, 8) }, () => sg(p)).concat(n > 8 ? [{ v: p, t: '…', dots: true }] : []), mid(s)),
          row('', [sqm(s, { sub: 'prix' }), sq(r, { sub: 'rendu', tone: 'b' })], tot(Bv))] } };
    }
    if (v === 1) {                                     /* n × p + q */
      const N = rng.pick([O.brosse, O.sac, O.seau]);
      const p = rng.pick(tabs.filter(x => x <= 10));
      const n = rng.int(2, A < 2 ? 5 : 9);
      const [thing, q] = rng.pick([[unArt(O.selle), rng.int(A < 2 ? 40 : 120, A < 2 ? 80 : 400)], ['un licol', rng.int(12, 40)], ['une couverture', rng.int(25, 70)]]);
      const s = n * p, r = s + q;
      if (r > (A < 2 ? 100 : 1000) || new Set([n, p, q]).size < 3) return null;
      const X = buyer(rng);
      return { scene: 'achats-' + (N.head || N.sg), unit: '€', numbers: [n, p, q], answer: r,
        ops: [{ a: n, op: '×', b: p, r: s }, { a: s, op: '+', b: q, r }],
        inter: [{ v: s, txt: `c’est le prix des ${N.pl}` }],
        alt: [{ v: s, why: 'etape' }, { v: n + p + q, why: 'inverse' }, { v: p + q, why: 'etape' }],
        sentences: [`${X.Name} achète ${qn(n, N)} à ${eur(p)} ${chacun(N)}.`, `${X.Il} achète aussi ${thing} à ${eur(q)}.`],
        question: `Combien ${X.name} ${inv('paie', X.il)} en tout ?`,
        reponse: `${X.Name} paie ${eur(r)} en tout.`,
        hint: `D’abord : combien coûtent les ${qn(n, N)} ?`,
        cherche: 'On cherche le prix de tout l’achat.',
        modele: `Étape 1 : ${f(n)} fois ${eur(p)}. Étape 2 : on ajoute le prix ${thing.startsWith('une') ? 'de la' : 'du'} ${thing.split(' ').slice(1).join(' ')}.`,
        schema: { rows: [row('', [sg(s, px(n, p, true), { sub: N.pl }), sg(q, undefined, { sub: thing.split(' ').slice(1).join(' '), tone: 'b' })], tot(r, true))] } };
    }
    /* piles : n × k + c */
    const N = rng.pick([O.botte, O.sac]);
    const k = rng.pick(tabs.filter(x => x >= 3 && x <= 10));
    const n = rng.int(2, A < 2 ? 6 : 9);
    const c = rng.int(2, Math.max(3, k - 1));
    const s = n * k, r = s + c;
    if (r > e.cmax || new Set([n, k, c]).size < 3) return null;
    return { scene: 'piles-' + N.head, unit: N, numbers: [n, k, c], answer: r,
      ops: [{ a: n, op: '×', b: k, r: s }, { a: s, op: '+', b: c, r }],
      inter: [{ v: s, txt: `c’est le nombre ${de(N.pl)} des piles` }],
      alt: [{ v: s, why: 'etape' }, { v: n + k + c, why: 'inverse' }, { v: n * (k + c), why: 'etape' }],
      sentences: [`Dans la grange, il y a ${qn(n, O.pile)} de ${qn(k, N)}.`, `Il y a aussi ${f(c)} ${N.pl} ${N.g === 'f' ? 'posées' : 'posés'} par terre.`],
      question: `${Combien(N)} y a-t-il en tout ?`,
      reponse: `Il y a ${qn(r, N)} en tout.`,
      hint: `D’abord : combien ${de(N.pl)} y a-t-il dans les piles ?`,
      cherche: `On cherche le nombre ${de(N.pl)} en tout.`,
      modele: `Étape 1 : ${f(n)} piles de ${f(k)}, c’est ${f(n)} fois ${f(k)}. Étape 2 : on ajoute les ${f(c)} ${N.pl} par terre.`,
      schema: { rows: [row('', [sg(s, px(n, k), { sub: 'piles' }), sg(c, undefined, { sub: 'par terre', tone: 'b' })], tot(r, true))] } };
  }
});

/* ---------- reste : division avec reste en contexte (CE1-P4 ; arrondi au-dessus au CE2) ---------- */
kind('reste', 'div.reste', {
  also: ['mul.partage'],
  w: 0.8, mul: true,
  make(e) {
    const { rng, A } = e;
    const up = A >= 2 && rng.chance(0.5);
    const carrots = !up && rng.chance(0.4);            /* bottes de carottes (4, 5 ou 8) ; boîtes d'œufs (6, 10 ou 12) */
    const k = up ? rng.pick([4, 6, 8, 9, 12]) : carrots ? rng.pick([4, 5, 8]) : rng.pick([6, 10, 12]);
    const q = rng.int(2, A < 2 ? 9 : 15);
    const rest = rng.int(1, k - 1);
    const t = q * k + rest;
    if (t > e.cmax) return null;
    if (carrots) {
      const R2 = role(rng);
      return { scene: 'bottes', unit: O.botteC, numbers: [t, k], answer: q, ops: [{ a: t, op: '÷', b: k, r: q, rest }],
        alt: [{ v: q + 1, why: 'proche' }, { v: rest, why: 'etape' }, { v: t - k, why: 'inverse' }],
        sentences: [`${R2.Name} a ${qn(t, O.carotte)}.`, `${R2.Il} fait des bottes de ${f(k)} carottes pour le marché.`],
        question: `Combien de bottes complètes ${R2.name} ${inv('peut', R2.il)} faire ?`,
        reponse: `${R2.Name} peut faire ${qn(q, O.botteC)} ${q >= 2 ? 'complètes' : 'complète'}.`,
        hint: `On fait des groupes de ${f(k)} avec ${f(t)} carottes. Attention : seules les bottes complètes comptent.`,
        cherche: 'On cherche le nombre de bottes complètes.',
        modele: `Dans ${f(t)}, combien de fois ${f(k)} ? Il reste ${f(rest)} ${rest >= 2 ? 'carottes' : 'carotte'} en trop.`,
        schema: groupsSchema(q, k, t, { each: true, total: true, count: false }) };
    }
    if (!up) {
      const R2 = role(rng);
      return { scene: 'boites', unit: O.boite, numbers: [t, k], answer: q, ops: [{ a: t, op: '÷', b: k, r: q, rest }],
        alt: [{ v: q + 1, why: 'proche' }, { v: rest, why: 'etape' }, { v: t - k, why: 'inverse' }],
        sentences: [`${R2.Name} a ${qn(t, O.oeuf)}.`, `${R2.Il} les range dans des boîtes de ${f(k)}.`],
        question: `Combien de boîtes pleines ${R2.name} ${inv('peut', R2.il)} remplir ?`,
        reponse: `${R2.Name} peut remplir ${qn(q, O.boite)} ${q >= 2 ? 'pleines' : 'pleine'}.`,
        hint: `On fait des groupes de ${f(k)} avec ${f(t)} œufs. Attention : seules les boîtes pleines comptent.`,
        cherche: 'On cherche le nombre de boîtes pleines.',
        modele: `Dans ${f(t)}, combien de fois ${f(k)} ? Il reste ${f(rest)} ${rest >= 2 ? 'œufs' : 'œuf'} en trop.`,
        schema: groupsSchema(q, k, t, { each: true, total: true, count: false }) };
    }
    const r = q + 1;
    return { scene: 'caleche', unit: O.tour, numbers: [t, k], answer: r, ops: [{ a: t, op: '÷', b: k, r: q, rest }, { a: q, op: '+', b: 1, r }],
      inter: [{ v: q, txt: 'c’est le nombre de tours pleins : il reste encore des visiteurs' }],
      alt: [{ v: q, why: 'etape' }, { v: rest, why: 'etape' }, { v: t - k, why: 'inverse' }],
      sentences: [`${qn(t, O.visiteur)} veulent faire un tour de calèche.`, `Dans la calèche, il y a ${qn(k, O.place)}.`],
      question: 'Combien de tours la calèche doit-elle faire pour que tous les visiteurs montent ?',
      reponse: `La calèche doit faire ${qn(r, O.tour)}.`,
      hint: `Chaque tour emmène ${qn(k, O.visiteur)}. Attention : personne ne doit rester à terre !`,
      cherche: 'On cherche le nombre de tours de calèche.',
      modele: `Dans ${f(t)}, combien de fois ${f(k)} ? Il reste ${f(rest)} ${rest >= 2 ? 'visiteurs' : 'visiteur'} : il faut un tour de plus.`,
      schema: groupsSchema(q, k, t, { each: true, total: true, count: false }) };
  }
});

/* ---------- fois : comparaison multiplicative (CE2-P1 ; référent inconnu au CM1) ---------- */
kind('fois', 'mul.cmp', {
  w: 1, mul: true,
  make(e) {
    const { rng, A } = e;
    const v = rng.int(0, A >= 3 ? 3 : 2);
    const k = rng.int(2, A < 3 ? 5 : 9);
    if (v === 0) {                                     /* fois plus : référé inconnu */
      const egg = rng.chance(0.5);
      const [A1, B1] = egg ? two(rng, HENS) : two(rng);
      const B = !egg && rng.chance(0.4) ? COMP : B1;
      const N = egg ? O.oeuf : rng.pick([O.ruban, O.pomme]);
      const a = rng.int(2, Math.max(2, Math.min(egg ? 12 : 25, Math.floor(e.cmax / k))));
      const r = a * k;
      if (a === k) return null;
      return { scene: 'foisplus-' + N.sg, unit: N, numbers: [a, k], answer: r, ops: [{ a, op: '×', b: k, r }],
        alt: [{ v: a + k, why: 'inverse' }],
        sentences: egg ? [`Cette semaine, ${A1.name} a pondu ${qn(a, N)}.`, `${B.Name} en a pondu ${f(k)} fois plus.`]
          : [`${A1.Name} a ${qn(a, N)}.`, `${B.Name} en a ${f(k)} fois plus.`],
        question: egg ? `${Combien(N)} ${B.name} ${inv('a', B.il)} ${ppl('pondu', N)} ?` : `${Combien(N)} ${B.name} ${inv('a', B.il)} ?`,
        reponse: egg ? `${B.Name} a pondu ${qn(r, N)}.` : `${B.Name} a ${qn(r, N)}.`,
        hint: `« ${f(k)} fois plus », ce n’est pas « ${f(k)} de plus » : on répète ${f(k)} fois la barre de ${A1.name}.`,
        cherche: `On cherche le nombre ${de(N.pl)} de ${B.kind === 'comp' ? 'ton compagnon' : B.name}.`,
        modele: `Une barre pour ${A1.name} (${f(a)}), ${f(k)} barres pareilles pour ${B.name}.`,
        schema: mulCmpSchema(A1.name, a, B.name, k, 'big') };
    }
    if (v === 1 || v === 2) {                          /* fois moins : un poids, un prix */
      /* un sac de grain pèse au plus 60 kg ; une couverture coûte au plus quelques centaines d'euros */
      const r = v === 1 ? rng.int(2, Math.max(2, Math.floor(60 / k))) : rng.int(2, A < 3 ? 12 : 40);
      const a = r * k;
      if (a > e.cmax || (v === 1 && a > 60)) return null;
      if (v === 1) {
        return { scene: 'sacs', unit: 'kg', numbers: [a, k], answer: r, ops: [{ a, op: '÷', b: k, r }],
          alt: [{ v: a - k, why: 'inverse' }, { v: a * k, why: 'inverse' }],
          sentences: [`Le grand sac de grain pèse ${kg(a)}.`, `Le petit sac pèse ${f(k)} fois moins.`],
          question: 'Combien pèse le petit sac ?',
          reponse: `Le petit sac pèse ${kg(r)}.`,
          hint: `« ${f(k)} fois moins » : le grand sac, c’est ${f(k)} petits sacs.`,
          cherche: 'On cherche le poids du petit sac.',
          modele: `La barre du grand sac (${kg(a)}) est faite de ${f(k)} barres du petit sac.`,
          schema: mulCmpSchema('petit sac', r, 'grand sac', k, 'small') };
      }
      return { scene: 'licol', unit: '€', numbers: [a, k], answer: r, ops: [{ a, op: '÷', b: k, r }],
        alt: [{ v: a - k, why: 'inverse' }, { v: a * k, why: 'inverse' }],
        sentences: [`Au marché, une couverture pour cheval coûte ${eur(a)}.`, `Un licol coûte ${f(k)} fois moins cher.`],
        question: 'Combien coûte le licol ?',
        reponse: `Le licol coûte ${eur(r)}.`,
        hint: `« ${f(k)} fois moins cher » : le prix de la couverture, c’est ${f(k)} fois le prix du licol.`,
        cherche: 'On cherche le prix du licol.',
        modele: `La barre de la couverture (${eur(a)}) est faite de ${f(k)} barres du licol.`,
        schema: mulCmpSchema('licol', r, 'couverture', k, 'small') };
    }
    /* référent inconnu (CM1) : « c’est 3 fois plus que le poney » → division */
    const r = rng.pick([3, 4, 5, 6]);
    const kk = rng.int(2, 4);
    const b = r * kk;
    return { scene: 'foin', unit: 'kg', numbers: [b, kk], answer: r, ops: [{ a: b, op: '÷', b: kk, r }], trap: true,
      alt: [{ v: b * kk, why: 'inverse' }, { v: b - kk, why: 'inverse' }],
      sentences: [`Le cheval mange ${kg(b)} de foin par jour.`, `C’est ${f(kk)} fois plus que le poney.`],
      question: 'Combien de kilos de foin le poney mange-t-il par jour ?',
      reponse: `Le poney mange ${kg(r)} de foin par jour.`,
      hint: 'Attention : c’est le cheval qui mange le plus. Le poney mange moins.',
      cherche: 'On cherche ce que mange le poney.',
      modele: `La barre du cheval (${kg(b)}) est faite de ${f(kk)} barres du poney.`,
      schema: mulCmpSchema('poney', r, 'cheval', kk, 'small') };
  }
});
/* comparaison multiplicative : une case pour le petit, k cases pour le grand ; unk : 'big' (total du grand) | 'small' */
function mulCmpSchema(lSmall, small, lBig, k, unk) {
  const segsBig = [];
  const show = Math.min(k, 8);
  for (let i = 0; i < show; i++) segsBig.push(unk === 'small' ? sq(small, { soft: true }) : sg(small, '', { same: true }));
  if (k > show) segsBig.push({ v: small, t: '…', dots: true });
  return { rows: [row(lSmall, [unk === 'small' ? sq(small) : sg(small)]),
    row(lBig, segsBig, tot(small * k, unk === 'big'))], cmp: true, times: k };
}

/* ---------- comp2 : comparaison en deux étapes (CE2-P2) ---------- */
kind('comp2', 'cmp.deux', {
  also: ['cmp'],
  w: 0.9, add: true, steps: 2, cmp: true,
  make(e) {
    const { rng, A } = e;
    const farms = A >= 2.6 && rng.chance(0.6);       /* grands nombres : deux fermes (un animal n'a pas 134 pommes) */
    const [A1, B1] = farms ? [who('la ferme des Saules', 'f', 'role'), who('la ferme du Moulin', 'f', 'role')] : two(rng);
    const N = farms ? rng.pick([O.mouton, O.poule]) : rng.pick([O.pomme, O.ruban, O.carotte]);
    const hi = farms ? Math.min(A < 3 ? 400 : 1000, e.cmax) : 60;
    const a = draw(rng, farms ? 40 : 5, Math.floor(hi / 2));
    const d = farms ? part(rng, a, 0.1, 0.5) : roundish(rng, draw(rng, 2, Math.max(2, Math.floor(a / 2))));
    const more = rng.chance(0.6);
    const b = more ? a + d : a - d;
    if (b < 2 || a === d) return null;
    const r = a + b;
    const { ils, eux } = duo(A1, B1);
    const mot = more ? 'de plus' : 'de moins';
    if (farms) {
      return { scene: 'fermes-' + N.sg, unit: N, numbers: [a, d], answer: r,
        ops: [{ a, op: more ? '+' : '−', b: d, r: b }, { a, op: '+', b, r }],
        inter: [{ v: b, txt: `c’est le nombre ${de(N.pl)} de ${B1.name}` }],
        alt: [{ v: b, why: 'etape' }, { v: a + d, why: more ? 'etape' : 'inverse' }, { v: 2 * a, why: 'etape' }],
        sentences: [`${A1.Name} a ${qn(a, N)}.`, `${B1.Name} en a ${f(d)} ${mot} que ${A1.name}.`],
        question: `${Combien(N)} les deux fermes ont-elles en tout ?`,
        reponse: `Les deux fermes ont ${qn(r, N)} en tout.`,
        hint: `D’abord : ${combien(N)} ${B1.name} a-t-elle ?`,
        cherche: `On cherche le nombre ${de(N.pl)} des deux fermes ensemble.`,
        modele: `Étape 1 : la barre de ${B1.name}, c’est ${f(a)} ${more ? 'plus' : 'moins'} ${f(d)}. Étape 2 : on met les deux barres bout à bout.`,
        schema: { ...cmpSchema('Saules', a, 'Moulin', b, d, 'b', true), brace: tot(r, true), braceAll: true } };
    }
    return { scene: 'duo-' + N.sg, unit: N, numbers: [a, d], answer: r,
      ops: [{ a, op: more ? '+' : '−', b: d, r: b }, { a, op: '+', b, r }],
      inter: [{ v: b, txt: `c’est le nombre ${de(N.pl)} de ${B1.name}` }],
      alt: [{ v: b, why: 'etape' }, { v: a + d, why: more ? 'etape' : 'inverse' }, { v: 2 * a, why: 'etape' }],
      sentences: [`${A1.Name} a ${qn(a, N)}.`, `${B1.Name} en a ${f(d)} ${mot} que ${A1.name}.`],
      question: `${Combien(N)} ${inv('ont', ils)} à ${eux} deux ?`,
      reponse: `À ${eux} deux, ${ils} ont ${qn(r, N)}.`,
      hint: `D’abord : ${combien(N)} ${B1.name} ${inv('a', B1.il)} ?`,
      cherche: `On cherche le nombre ${de(N.pl)} de ${A1.name} et ${B1.name} ensemble.`,
      modele: `Étape 1 : la barre de ${B1.name}, c’est ${f(a)} ${more ? 'plus' : 'moins'} ${f(d)}. Étape 2 : on met les deux barres bout à bout.`,
      schema: { ...cmpSchema(A1.name, a, B1.name, b, d, 'b', true), brace: tot(r, true), braceAll: true } };
  }
});

/* ---------- achats : prix à virgule (CE2-P2) ---------- */
kind('achats', 'prix.dec', {
  also: ['pt'],
  w: 1, add: true,
  make(e) {
    const { rng, A } = e;
    const things = [['une brosse', 2, 9], ['un licol', 8, 25], ['un sac de carottes', 3, 9], ['un seau', 3, 12], ['une étrille', 2, 8], ['un tapis de selle', 15, 45]];
    const [t1, t2] = rng.sample(things, 2);
    const price = ([, lo, hi]) => r2(rng.int(lo * 20, hi * 20) / 20);       /* multiples de 5 centimes */
    const p = price(t1), q = price(t2);
    if (Number.isInteger(p) && Number.isInteger(q)) return null;
    const X = buyer(rng);
    const s = r2(p + q);
    if (A >= 2.6 && rng.chance(0.5)) {
      const Bv = [10, 20, 50, 100].find(x => x > s + 0.5);
      if (!Bv) return null;
      const r = r2(Bv - s);
      return { scene: 'rendu', unit: '€', numbers: [p, q, Bv], answer: r, dec: 2,
        ops: [{ a: p, op: '+', b: q, r: s }, { a: Bv, op: '−', b: s, r }],
        inter: [{ v: s, txt: 'c’est le prix des deux achats' }],
        alt: [{ v: s, why: 'etape' }, { v: r2(Bv - p), why: 'etape' }, { v: r2(r + 1), why: 'proche' }],
        sentences: [`${X.Name} achète ${t1[0]} à ${eur(p)} et ${t2[0]} à ${eur(q)}.`, `${X.Il} paie avec un billet de ${eur(Bv)}.`],
        question: 'Combien la marchande lui rend-elle ?',
        reponse: `La marchande lui rend ${eur(r)}.`,
        hint: 'D’abord : combien coûtent les deux achats ensemble ?',
        cherche: 'On cherche la monnaie rendue.',
        modele: 'Étape 1 : on ajoute les deux prix. Étape 2 : le billet, c’est le tout ; le prix est une partie.',
        schema: { rows: [row('', [sg(p, eur(p)), sg(q, eur(q), { tone: 'b' })], mid(s)), row('', [sqm(s, { sub: 'prix' }), sq(r, { sub: 'rendu', tone: 'c' })], tot(Bv, false, eur(Bv)))] } };
    }
    return { scene: 'total', unit: '€', numbers: [p, q], answer: s, dec: 2, ops: [{ a: p, op: '+', b: q, r: s }],
      alt: [{ v: r2(Math.abs(p - q)), why: 'inverse' }, { v: r2(s + 1), why: 'proche' }, { v: r2(Math.floor(p) + Math.floor(q) + (cents(p) % 100 + cents(q) % 100) / 1000), why: 'proche' }],
      sentences: [`${X.Name} achète ${t1[0]} à ${eur(p)} et ${t2[0]} à ${eur(q)}.`],
      question: `Combien ${X.name} ${inv('paie', X.il)} en tout ?`,
      reponse: `${X.Name} paie ${eur(s)} en tout.`,
      hint: 'On cherche le prix des deux achats ensemble : euros avec euros, centimes avec centimes.',
      cherche: 'On cherche le prix total.',
      modele: 'Les deux prix sont les parties ; le prix total est le tout.',
      schema: { rows: [row('', [sg(p, eur(p)), sg(q, eur(q), { tone: 'b' })], tot(s, true))] } };
  }
});

/* ---------- combis : produit cartésien (CE2-P3 ; trois ensembles au CM1) ---------- */
kind('combis', 'cartesien', {
  w: 0.7, mul: true,
  make(e) {
    const { rng, A } = e;
    const X = anyone(rng);
    const n = rng.int(2, 5), m = rng.int(2, 6);
    if (n === m) return null;
    if (A >= 3.2 && rng.chance(0.4)) {
      const p = rng.int(2, 4);
      if (new Set([n, m, p]).size < 3) return null;
      const r = n * m * p;
      return { scene: 'tenues3', unit: O.tenue, numbers: [n, m, p], answer: r,
        ops: [{ a: n, op: '×', b: m, r: n * m }, { a: n * m, op: '×', b: p, r }],
        inter: [{ v: n * m, txt: 'c’est le nombre de façons de choisir la selle et le tapis' }],
        alt: [{ v: n + m + p, why: 'inverse' }, { v: n * m, why: 'etape' }, { v: n * m + p, why: 'etape' }],
        sentences: [`Pour le défilé, ${X.name} choisit une selle, un tapis et un chapeau.`, `Il y a ${qn(n, O.selle)}, ${qn(m, O.tapis)} et ${qn(p, O.chapeau)}.`],
        question: `Combien de tenues différentes ${X.name} ${inv('peut', X.il)} faire ?`,
        reponse: `${X.Name} peut faire ${qn(r, O.tenue)} différentes.`,
        hint: `D’abord : combien de façons de choisir la selle et le tapis ? Puis chaque façon va avec chacun des ${f(p)} chapeaux.`,
        cherche: 'On cherche le nombre de tenues différentes.',
        modele: `Chaque selle va avec chaque tapis, puis avec chaque chapeau : ${f(n)} × ${f(m)} × ${f(p)}.`,
        schema: { grid: { n, m, rows: 'selles', cols: 'tapis', times: p } } };
    }
    const r = n * m;
    const [S1, S2, lab, Q] = rng.chance(0.5)
      ? [O.selle, O.tapis, 'une selle et un tapis', 'tenues']
      : [O.fruit, O.legume, 'un fruit et un légume', 'goûters'];
    const unitN = Q === 'tenues' ? O.tenue : O.gouter;
    return { scene: 'combis-' + Q, unit: unitN, numbers: [n, m], answer: r, ops: [{ a: n, op: '×', b: m, r }],
      alt: [{ v: n + m, why: 'inverse' }],
      sentences: Q === 'tenues'
        ? [`Pour le défilé, ${X.name} choisit ${lab}.`, `Il y a ${qn(n, S1)} et ${qn(m, S2)}.`]
        : [`Au goûter, ${X.name} choisit ${lab}.`, `Il y a ${qn(n, S1)} et ${qn(m, S2)}.`],
      question: `Combien de ${Q} ${Q === 'tenues' ? 'différentes' : 'différents'} ${X.name} ${inv('peut', X.il)} faire ?`,
      reponse: `${X.Name} peut faire ${qn(r, unitN)} ${unitN.g === 'f' ? 'différentes' : 'différents'}.`,
      hint: `Chaque ${S1.sg} peut aller avec chacun des ${qn(m, S2)}. Fais un tableau !`,
      cherche: `On cherche le nombre de ${Q} ${Q === 'tenues' ? 'différentes' : 'différents'}.`,
      modele: `Un tableau : ${f(n)} lignes (${S1.pl}) et ${f(m)} colonnes (${S2.pl}). Chaque case est un choix.`,
      schema: { grid: { n, m, rows: S1.pl, cols: S2.pl } } };
  }
});

/* ---------- duree : durées (CE2-P3 ; à cheval sur l'heure au CM1 ; heures en minutes au CM2) ---------- */
kind('duree', 'duree', {
  w: 0.8,
  make(e) {
    const { rng, A } = e;
    const v = A >= 4 && rng.chance(0.35) ? 2 : rng.chance(0.5) ? 0 : 1;
    if (v === 0) {
      const h = rng.int(9, 16);
      const cross = A >= 3;                            /* CM : on passe l'heure pile (CM2 : plus d'une heure) */
      let m1, d;
      if (cross) {
        m1 = rng.int(6, 11) * 5;
        d = rng.int(Math.ceil((65 - m1) / 5), A >= 4 ? 22 : 11) * 5;
      } else {
        m1 = rng.int(0, 9) * 5;
        d = rng.int(2, Math.floor((55 - m1) / 5)) * 5;
      }
      const end = h * 60 + m1 + d;
      const h2 = Math.floor(end / 60), m2 = end % 60;
      if (d < 10 || m1 === m2 || (cross && h2 === h)) return null;
      const what = rng.pick(['La balade à poney', 'Le cours d’équitation', 'Le soin des chevaux']);
      return { scene: 'duree', unit: O.minute, numbers: [...new Set([h, m1, h2, m2])].filter(x => x >= 2), answer: d,
        ops: [{ a: h2 * 60 + m2, op: '−', b: h * 60 + m1, r: d, time: [hm(h, m1), hm(h2, m2)] }],
        alt: [{ v: Math.abs(m2 - m1), why: 'inverse' }, { v: m1 + m2, why: 'inverse' }, { v: d + 10, why: 'proche' }, { v: d + 40, why: 'inverse' }],
        sentences: [`${what} commence à ${hm(h, m1)} et se termine à ${hm(h2, m2)}.`],
        question: `Combien de minutes dure ${what.charAt(0).toLowerCase() + what.slice(1)} ?`,
        reponse: `${what} dure ${qn(d, O.minute)}.`,
        hint: h2 > h ? `Compte de ${hm(h, m1)} jusqu’à ${hm(h + 1, 0)}, puis jusqu’à ${hm(h2, m2)}.` : `Compte les minutes de ${hm(h, m1)} jusqu’à ${hm(h2, m2)}.`,
        cherche: 'On cherche une durée, en minutes.',
        modele: h2 > h ? `On avance jusqu’à l’heure pile, puis jusqu’à la fin.` : `On avance de ${hm(h, m1)} jusqu’à ${hm(h2, m2)}.`,
        schema: { rows: [row('', h2 > h
          ? [sqm(60 - m1, { sub: 'jusqu’à ' + f(h + 1) + ' h' })].concat(Array.from({ length: h2 - h - 1 }, () => sg(60, '1 h', { tone: 'b' })), m2 > 0 ? [sqm(m2, { tone: 'c', sub: 'après' })] : [])
          : [sq(d, { sub: 'durée' })], tot(d, true))], timeline: true } };
    }
    if (v === 1) {
      const n = rng.int(2, A < 3 ? 6 : 9), k = rng.pick([5, 10, 15, 20, 12]);
      const r = n * k;
      const X = anyone(rng);
      return { scene: 'brosser', unit: O.minute, numbers: [n, k], answer: r, ops: [{ a: n, op: '×', b: k, r }],
        alt: [{ v: n + k, why: 'inverse' }],
        sentences: [`${X.Name} brosse ${qn(n, O.poney)}.`, `${X.Il} met ${qn(k, O.minute)} pour chaque poney.`],
        question: `Combien de minutes ${X.name} ${inv('met', X.il)} en tout ?`,
        reponse: `${X.Name} met ${qn(r, O.minute)} en tout.`,
        hint: `${Cap(qn(n, O.poney))}, et ${qn(k, O.minute)} pour chacun.`,
        cherche: 'On cherche la durée totale, en minutes.',
        modele: `${f(n)} fois ${f(k)} minutes.`,
        schema: groupsSchema(n, k, r, { each: true, total: false }) };
    }
    const h = rng.int(2, 3), m = rng.int(1, 11) * 5;
    const r = h * 60 + m;
    return { scene: 'rando', unit: O.minute, numbers: [h, m].filter(x => x >= 2), answer: r,
      ops: [{ a: h, op: '×', b: 60, r: h * 60 }, { a: h * 60, op: '+', b: m, r }],
      inter: [{ v: h * 60, txt: `c’est le nombre de minutes dans ${h >= 2 ? f(h) + ' heures' : 'une heure'}` }],
      alt: [{ v: h * 100 + m, why: 'inverse' }, { v: h + m, why: 'inverse' }, { v: h * 60, why: 'etape' }],
      sentences: [`La randonnée à cheval dure ${f(h)}${NB}h${NB}${String(m).padStart(2, '0')}.`],
      question: 'Combien de minutes dure la randonnée ?',
      reponse: `La randonnée dure ${qn(r, O.minute)}.`,
      hint: 'Attention : une heure, c’est 60 minutes (et pas 100).',
      cherche: 'On cherche la durée en minutes.',
      modele: `${f(h)} ${h >= 2 ? 'heures' : 'heure'}, c’est ${f(h)} fois 60 minutes ; on ajoute ${f(m)} minutes.`,
      schema: { rows: [row('', Array.from({ length: h }, () => sg(60, '1 h')).concat([sg(m, f(m), { tone: 'b', sub: 'minutes' })]), tot(r, true))] } };
  }
});

/* ---------- trois : trois étapes (CE2-P4, nombres < 100 ; prix au CM1) ---------- */
kind('trois', 'etapes3', {
  also: ['deux.add'],
  w: 0.9, add: true, steps: 3,
  make(e) {
    const { rng, A } = e;
    if (A < 3 || rng.chance(0.5)) {
      const a = rng.int(15, 60), b = rng.int(5, 25), c = rng.int(5, 25);
      const s1 = a + b, s2 = s1 + c, d = rng.int(10, Math.min(s2 - 5, 70));
      const r = s2 - d;
      if (r < 2 || new Set([a, b, c, d]).size < 4) return null;
      const R2 = role(rng);
      return { scene: 'semaine', unit: O.botte, numbers: [a, b, c, d], answer: r,
        ops: [{ a, op: '+', b, r: s1 }, { a: s1, op: '+', b: c, r: s2 }, { a: s2, op: '−', b: d, r }],
        inter: [{ v: s1, txt: 'c’est le nombre de bottes mardi soir' }, { v: s2, txt: 'c’est le nombre de bottes mercredi soir' }],
        alt: [{ v: s2, why: 'etape' }, { v: a + b + c + d, why: 'inverse' }, { v: s1 - d, why: 'etape' }],
        sentences: [`Lundi, il y a ${qn(a, O.botte)} dans la grange.`, `${R2.Name} en apporte ${f(b)} mardi et ${f(c)} mercredi.`, `Jeudi, les chevaux en mangent ${f(d)}.`],
        question: 'Combien de bottes de foin reste-t-il dans la grange ?',
        reponse: `Il reste ${qn(r, O.botte)} dans la grange.`,
        hint: 'D’abord : combien de bottes de foin y a-t-il mercredi soir ?',
        cherche: 'On cherche le nombre de bottes de foin à la fin.',
        modele: `Étapes 1 et 2 : on ajoute ${f(b)} puis ${f(c)}. Étape 3 : on enlève ${f(d)}.`,
        schema: { rows: [row('', [sg(a), sg(b, undefined, { tone: 'b' }), sg(c, undefined, { tone: 'b' })], mid(s2)), row('', [sq(r, { sub: 'il reste' }), sg(d, undefined, { sub: 'mangées', tone: 'c' })], mid(s2))] } };
    }
    const n = rng.int(2, 6), p = rng.int(3, 15), m = rng.int(2, 6), q = rng.int(2, 9);
    const s1 = n * p, s2 = m * q, s = s1 + s2;
    const Bv = [20, 50, 100, 200].find(x => x > s + 1);
    if (!Bv || new Set([n, p, m, q]).size < 4) return null;
    const r = Bv - s;
    const X = buyer(rng);
    return { scene: 'marche', unit: '€', numbers: [n, p, m, q, Bv], answer: r,
      ops: [{ a: n, op: '×', b: p, r: s1 }, { a: m, op: '×', b: q, r: s2 }, { a: s1, op: '+', b: s2, r: s }, { a: Bv, op: '−', b: s, r }],
      inter: [{ v: s1, txt: 'c’est le prix des sacs' }, { v: s2, txt: 'c’est le prix des bottes' }, { v: s, txt: 'c’est le prix de tout l’achat' }],
      alt: [{ v: s, why: 'etape' }, { v: Bv - s1, why: 'etape' }, { v: Bv - n - p - m - q, why: 'inverse' }],
      sentences: [`${X.Name} achète ${qn(n, O.sac)} à ${eur(p)} le sac et ${qn(m, O.botte)} à ${eur(q)} la botte.`, `${X.Il} paie avec un billet de ${eur(Bv)}.`],
      question: 'Combien la marchande lui rend-elle ?',
      reponse: `La marchande lui rend ${eur(r)}.`,
      hint: 'D’abord : combien coûtent les sacs ? Puis les bottes ?',
      cherche: 'On cherche la monnaie rendue.',
      modele: 'Étapes 1 et 2 : le prix des sacs, puis celui des bottes. Étape 3 : le prix total. Étape 4 : le billet moins le prix.',
      schema: { rows: [row('', [sg(s1, px(n, p, true), { sub: 'sacs' }), sg(s2, px(m, q, true), { sub: 'bottes', tone: 'b' }), sq(r, { sub: 'rendu', tone: 'c' })], tot(Bv, false, eur(Bv)))] } };
  }
});

/* ---------- fraction d'une quantité (CM1-P2 ; non unitaire en CM1-P3) ---------- */
const FRAC = [[1, 2, 'la moitié'], [1, 3, 'le tiers'], [1, 4, 'le quart'], [1, 5, 'le cinquième'], [1, 10, 'le dixième'],
  [2, 3, 'les deux tiers'], [3, 4, 'les trois quarts'], [2, 5, 'les deux cinquièmes'], [3, 10, 'les trois dixièmes']];
kind('fraction', 'fraction', {
  w: 1, mul: true,
  make(e) {
    const { rng, A } = e;
    const ok = FRAC.filter(([k]) => k === 1 || A >= 3.4);
    const [k, dd, txt] = rng.pick(ok);
    const unitPart = rng.int(2, A < 4 ? 15 : 60);
    const t = unitPart * dd, r = unitPart * k;
    if (r < 2) return null;
    const ops = k === 1 ? [{ a: t, op: '÷', b: dd, r }] : [{ a: t, op: '÷', b: dd, r: unitPart }, { a: unitPart, op: '×', b: k, r }];
    const inter = k === 1 ? [] : [{ v: unitPart, txt: `c’est une part sur ${f(dd)}` }];
    const segs = Array.from({ length: dd }, (_, i) => (i < k ? sq(unitPart, { tone: 'b', soft: i > 0 }) : sg(unitPart, '', { same: true })));
    const sch = { rows: [row('', segs, tot(t))], frac: { k, d: dd } };
    const base = { numbers: [t], consts: [dd, k], answer: r, ops, inter, alt: [{ v: t - r, why: 'etape' }, { v: unitPart, why: 'etape' }, { v: t * k, why: 'inverse' }, { v: dd, why: 'donnee' }] };
    if (rng.chance(0.5)) {
      const R2 = role(rng);
      return { ...base, scene: 'oeufs', unit: O.oeuf, fracTxt: txt,
        sentences: [`${R2.Name} a ${qn(t, O.oeuf)}.`, `${R2.Il} en vend ${txt} au marché.`],
        question: `Combien d’œufs ${R2.name} ${inv('vend', R2.il)} au marché ?`,
        reponse: `${R2.Name} vend ${qn(r, O.oeuf)} au marché.`,
        hint: `Partage les ${f(t)} œufs en ${f(dd)} parts égales${k > 1 ? `, puis prends-en ${f(k)}` : ''}.`,
        cherche: 'On cherche le nombre d’œufs vendus.',
        modele: `La barre des ${f(t)} œufs est coupée en ${f(dd)} parts égales ; on en prend ${f(k)}.`,
        schema: sch };
    }
    const X = anyone(rng);
    const [Y] = rng.sample(POOL.filter(y => y.name !== X.name), 1);
    return { ...base, scene: 'carottes', unit: O.carotte, fracTxt: txt,
      sentences: [`${X.Name} a ${qn(t, O.carotte)}.`, `${X.Il} en donne ${txt} à ${Y.name}.`],
      question: `Combien de carottes ${X.name} ${inv('donne', X.il)} à ${Y.name} ?`,
      reponse: `${X.Name} donne ${qn(r, O.carotte)} à ${Y.name}.`,
      hint: `Partage les ${f(t)} carottes en ${f(dd)} parts égales${k > 1 ? `, puis prends-en ${f(k)}` : ''}.`,
      cherche: `On cherche le nombre de carottes données à ${Y.name}.`,
      modele: `La barre des ${f(t)} carottes est coupée en ${f(dd)} parts égales ; on en prend ${f(k)}.`,
      schema: sch };
  }
});

/* ---------- proportionnalité par linéarité (CM1-P3) ; en plusieurs étapes (CM2-P1) ---------- */
function proporScene(rng, A) {
  return rng.pick([
    { id: 'sachets', N: O.sachet, money: true },
    { id: 'foin', N: O.cheval, kgPer: 12 },
    { id: 'gateaux', N: O.gateau, carrots: true }
  ]);
}
kind('propor', 'propor', {
  w: 1.1, mul: true, steps: 2,
  make(e) {
    const { rng, A } = e;
    const sc = proporScene(rng, A);
    const a = rng.int(2, 6), k = rng.pick([2, 3, 4, 5, 10]);
    const b = a * k;
    let q;
    if (sc.money) q = rng.int(2 * a, 5 * a) + (A >= 4 && rng.chance(0.4) ? 0.5 : 0);   /* 2 à 5 € le sachet */
    else if (sc.kgPer) q = a * sc.kgPer;
    else q = a * rng.int(2, 4);
    const r = r2(q * k);
    if (a === k || b === q) return null;
    const what = sc.N.head ? sc.N.head + 's' : sc.N.pl;
    const base = { numbers: [a, q, b], answer: r, ops: [{ a: b, op: '÷', b: a, r: k }, { a: q, op: '×', b: k, r }],
      inter: [{ v: k, txt: `${f(b)} ${what}, c’est ${f(k)} fois ${f(a)} ${what}` }],
      alt: [{ v: r2(q + b - a), why: 'inverse' }, { v: r2(q * b), why: 'inverse' }, { v: r2(q + k), why: 'inverse' }], dec: ndec(r) };
    const sch = { rows: [row(f(a) + ' ' + (sc.N.head ? sc.N.head + 's' : sc.N.pl), [sg(q, sc.money ? eur(q) : undefined)]),
      row(f(b) + ' ' + (sc.N.head ? sc.N.head + 's' : sc.N.pl), Array.from({ length: Math.min(k, 8) }, () => sg(q, '', { same: true })).concat(k > 8 ? [{ v: q, t: '…', dots: true }] : []), tot(r, true))], cmp: true, times: k };
    if (sc.id === 'sachets') {
      return { ...base, scene: 'sachets', unit: '€',
        sentences: [`${Cap(qn(a, O.sachet))} coûtent ${eur(q)}.`],
        question: `Combien coûtent ${qn(b, O.sachet)} ?`,
        reponse: `${Cap(qn(b, O.sachet))} coûtent ${eur(r)}.`,
        hint: `${f(b)} sachets, c’est combien de fois ${f(a)} sachets ?`,
        cherche: `On cherche le prix de ${qn(b, O.sachet)}.`,
        modele: `${f(b)} sachets, c’est ${f(k)} fois ${f(a)} sachets : le prix est ${f(k)} fois plus grand.`,
        schema: sch };
    }
    if (sc.id === 'foin') {
      return { ...base, scene: 'foin', unit: 'kg',
        sentences: [`Pour nourrir ${qn(a, O.cheval)} pendant une journée, il faut ${kg(q)} de foin.`],
        question: `Combien de kilos de foin faut-il pour nourrir ${qn(b, O.cheval)} ?`,
        reponse: `Il faut ${kg(r)} de foin.`,
        hint: `${f(b)} chevaux, c’est combien de fois ${f(a)} chevaux ?`,
        cherche: `On cherche le foin pour ${qn(b, O.cheval)}.`,
        modele: `${f(b)} chevaux, c’est ${f(k)} fois ${f(a)} chevaux : il faut ${f(k)} fois plus de foin.`,
        schema: sch };
    }
    return { ...base, scene: 'gateaux', unit: O.carotte,
      sentences: [`Pour faire ${qn(a, O.gateau)} aux carottes, il faut ${qn(q, O.carotte)}.`],
      question: `Combien de carottes faut-il pour faire ${qn(b, O.gateau)} ?`,
      reponse: `Il faut ${qn(r, O.carotte)}.`,
      hint: `${f(b)} gâteaux, c’est combien de fois ${f(a)} gâteaux ?`,
      cherche: `On cherche les carottes pour ${qn(b, O.gateau)}.`,
      modele: `${f(b)} gâteaux, c’est ${f(k)} fois ${f(a)} gâteaux : il faut ${f(k)} fois plus de carottes.`,
      schema: sch };
  }
});
kind('propor2', 'propor.etapes', {
  also: ['propor'],
  w: 1, mul: true, steps: 2,
  make(e) {
    const { rng } = e;
    const a = rng.pick([2, 4, 6, 8, 10]);
    const half = a / 2;
    const k = rng.int(1, 3);
    const b = a * k + half;                             /* ex. 6 = 4 + 2 ; 10 = 2 × 4 + 2 */
    const pu = half * rng.int(2, 5);                    /* prix d’un « demi-lot » (½ a sachets, 2 à 5 € le sachet) */
    const q = pu * 2, r = q * k + pu;
    if (b === q || b === a) return null;
    const ops = [{ a: q, op: '÷', b: 2, r: pu, by: `${f(half)}, c’est la moitié de ${f(a)}` }];
    if (k > 1) ops.push({ a: q, op: '×', b: k, r: q * k });
    ops.push({ a: q * k, op: '+', b: pu, r });
    return { scene: 'sachets2', unit: '€', numbers: [a, q, b], consts: [k], answer: r, ops,
      inter: [{ v: pu, txt: `c’est le prix de ${qn(half, O.sachet)}` }].concat(k > 1 ? [{ v: q * k, txt: `c’est le prix de ${qn(a * k, O.sachet)}` }] : []),
      alt: [{ v: q + b - a, why: 'inverse' }, { v: q * b, why: 'inverse' }, { v: pu, why: 'etape' }, { v: q * (k + 1), why: 'proche' }],
      sentences: [`${Cap(qn(a, O.sachet))} coûtent ${eur(q)}.`],
      question: `Combien coûtent ${qn(b, O.sachet)} ?`,
      reponse: `${Cap(qn(b, O.sachet))} coûtent ${eur(r)}.`,
      hint: `${f(b)} sachets, c’est ${k > 1 ? f(k) + ' fois ' + f(a) + ' sachets' : f(a) + ' sachets'} et encore ${f(half)} ${half >= 2 ? 'sachets' : 'sachet'}. Combien coûte${half >= 2 ? 'nt' : ''} ${qn(half, O.sachet)} ?`,
      cherche: `On cherche le prix de ${qn(b, O.sachet)}.`,
      modele: `${f(b)} = ${k > 1 ? f(k) + ' × ' + f(a) : f(a)} + ${f(half)} ; ${qn(half, O.sachet)}, c’est la moitié de ${f(a)} sachets.`,
      schema: { rows: [row(f(a) + ' sachets', [sg(q, eur(q))]), row(f(b) + ' sachets', Array.from({ length: k }, () => sg(q, eur(q), { same: true })).concat([sq(pu, { tone: 'b', sub: 'moitié' })]), tot(r, true))], cmp: true } };
  }
});

/* ---------- algèbre : schéma en barres (CM1-P4) ; somme et différence (CM2-P2) ---------- */
kind('algebre', 'algebre', {
  also: ['mul.partage'],
  w: 1, mul: true, steps: 2,
  make(e) {
    const { rng } = e;
    const k = rng.int(2, 4);
    const money = rng.chance(0.6);
    const u = money ? rng.int(2, 9) : rng.int(3, 12);                   /* brosse (€) ou seau d'eau (kg) */
    const x = money ? rng.int(5, 25) : rng.int(15, 40);                 /* seau (€) ou sac de grain (kg) */
    const s = u + x, ku = k * u;
    if (new Set([s, ku, k, x, u]).size < 5) return null;
    const ops = [{ a: ku, op: '÷', b: k, r: u }, { a: s, op: '−', b: u, r: x }];
    const alt = [{ v: s - ku, why: 'etape' }, { v: u, why: 'etape' }, { v: s - k, why: 'inverse' }, { v: s + u, why: 'inverse' }];
    if (money) {
      return { scene: 'brosse', unit: '€', numbers: [s, k, ku], answer: x, ops, alt,
        inter: [{ v: u, txt: 'c’est le prix d’une brosse' }],
        sentences: [`Une brosse et un seau coûtent ${eur(s)} ensemble.`, `${Cap(qn(k, O.brosse))} coûtent ${eur(ku)}.`],
        question: 'Combien coûte le seau ?',
        reponse: `Le seau coûte ${eur(x)}.`,
        hint: 'D’abord : combien coûte une brosse ?',
        cherche: 'On cherche le prix du seau.',
        modele: `Une barre « brosse + seau » = ${eur(s)} ; une barre de ${f(k)} brosses = ${eur(ku)}.`,
        schema: { rows: [row('', [sg(u, '', { sub: 'brosse', same: true }), sq(x, { sub: 'seau', tone: 'b' })], tot(s, false, eur(s))),
          row('', Array.from({ length: k }, () => sg(u, '', { sub: 'brosse', same: true })), tot(ku, false, eur(ku)))] } };
    }
    return { scene: 'poids', unit: 'kg', numbers: [s, k, ku], answer: x, ops, alt,
      inter: [{ v: u, txt: 'c’est le poids d’un seau d’eau' }],
      sentences: [`Un seau d’eau et un sac de grain pèsent ${kg(s)} ensemble.`, `${Cap(f(k))} seaux d’eau pèsent ${kg(ku)}.`],
      question: 'Combien pèse le sac de grain ?',
      reponse: `Le sac de grain pèse ${kg(x)}.`,
      hint: 'D’abord : combien pèse un seau d’eau ?',
      cherche: 'On cherche le poids du sac de grain.',
      modele: `Une barre « seau + sac » = ${kg(s)} ; une barre de ${f(k)} seaux = ${kg(ku)}.`,
      schema: { rows: [row('', [sg(u, '', { sub: 'seau', same: true }), sq(x, { sub: 'sac', tone: 'b' })], tot(s, false, kg(s))),
        row('', Array.from({ length: k }, () => sg(u, '', { sub: 'seau', same: true })), tot(ku, false, kg(ku)))] } };
  }
});
kind('somdiff', 'algebre.sd', {
  also: ['cmp'],
  w: 0.9, add: true, steps: 3,
  make(e) {
    const { rng } = e;
    const [A1, B1] = two(rng);
    const N = rng.pick([O.pomme, O.ruban, O.carotte]);
    const small = rng.int(4, 40), d = rng.int(2, 20);
    const big = small + d, t = small + big;
    if (small === d) return null;
    const { eux } = duo(A1, B1);
    return { scene: 'duo-' + N.sg, unit: N, numbers: [t, d], answer: small,
      ops: [{ a: t, op: '−', b: d, r: t - d }, { a: t - d, op: '÷', b: 2, r: small }],
      inter: [{ v: t - d, txt: 'c’est deux fois la part de ' + A1.name }, { v: big, txt: `c’est le nombre ${de(N.pl)} de ${B1.name}` }],
      alt: [{ v: big, why: 'etape' }, { v: t - d, why: 'etape' }, { v: Math.round(t / 2), why: 'inverse' }, { v: t + d, why: 'inverse' }],
      sentences: [`${A1.Name} et ${B1.name} ont ${qn(t, N)} à ${eux} deux.`, `${B1.Name} en a ${f(d)} de plus que ${A1.name}.`],
      question: `${Combien(N)} ${A1.name} ${inv('a', A1.il)} ?`,
      reponse: `${A1.Name} a ${qn(small, N)}.`,
      hint: `Si on enlève les ${f(d)} ${N.pl} en plus de ${B1.name}, les deux barres sont pareilles.`,
      cherche: `On cherche le nombre ${de(N.pl)} de ${A1.name}.`,
      modele: `Deux barres : celle de ${B1.name} a ${f(d)} de plus. Sans ce morceau, il reste deux barres égales.`,
      schema: { rows: [row(A1.name, [sq(small)]), row(B1.name, [sg(small, '', { same: true }), sg(d, undefined, { tone: 'b', diff: true })])], cmp: true, brace: tot(t), braceAll: true } };
  }
});

/* ================= DONNÉE INUTILE (CE2-P2 et après) ================= */
function useless(rng, used) {
  for (let i = 0; i < 6; i++) {
    const v = rng.int(0, 3);
    const x = v === 0 ? rng.int(2, 9) : v === 1 ? rng.int(12, 28) : v === 2 ? rng.int(3, 15) : rng.int(8, 40);
    if (used.some(u => Math.abs(u - x) < 1e-9)) continue;
    const s = v === 0 ? `Au ranch, il y a ${qn(x, O.chien)}.`
      : v === 1 ? `Aujourd’hui, il fait ${qn(x, O.degre)}.`
      : v === 2 ? `Le ranch a ${qn(x, O.chat)}.`
      : `Dans le verger du ranch, il y a ${qn(x, O.arbre)}.`;
    return { v: x, s };
  }
  return null;
}

/* ================= CHOIX (format Repères : 6 propositions) ================= */
function makeChoices(ans, alt, rng, { dec = 0, useless: u = null, numbers = [] } = {}) {
  const ok = v => Number.isFinite(v) && v > 0 && Math.abs(v - ans) > 1e-9 && (dec ? Math.abs(cents(v) - v * 100) < 1e-6 : Number.isInteger(v));
  const out = [];
  const add = (v, why) => { v = dec ? r2(v) : Math.round(v); if (ok(v) && !out.some(o => Math.abs(o.v - v) < 1e-9) && out.length < 5) out.push({ v, why }); };
  for (const a of alt) add(a.v, a.why);
  if (u !== null) { add(ans + u, 'inutile'); add(Math.abs(ans - u), 'inutile'); }
  for (const n of numbers) add(n, 'donnee');
  const near = dec ? [1, -1, 0.1, -0.1, 0.5, 10] : ans >= 100 ? [10, -10, 100, -100, 1, -1, 1000] : [1, -1, 2, -2, 10, -10, 3];
  for (const d of near) add(ans + d, 'proche');
  for (let i = 2; out.length < 5 && i < 40; i++) add(ans + (dec ? i / 10 : i), 'proche');
  /* l'ordre importe peu : on garde au plus 5 distracteurs, puis on range du plus petit au plus grand */
  const choices = [{ v: ans, why: 'juste' }, ...out.slice(0, 5)].sort((a, b) => a.v - b.v);
  return { choices, distractors: out.slice(0, 5) };
}

/* ================= ASSEMBLAGE ================= */
const OPS_TXT = { '+': '+', '−': '−', '×': '×', '÷': '÷' };
const fmtOpNum = (n, money) => (money ? eur(n) : f(n));
function opLine(o, unit) {
  const money = unit === '€' && (!Number.isInteger(o.a) || !Number.isInteger(o.r) || !Number.isInteger(o.b));
  if (o.time) return `De ${o.time[0]} à ${o.time[1]} : ${f(o.r)} minutes`;
  const line = `${fmtOpNum(o.a, money)} ${OPS_TXT[o.op]} ${fmtOpNum(o.b, money && o.op !== '×' && o.op !== '÷')} = ${fmtOpNum(o.r, money)}`;
  return o.rest ? `${line}, et il reste ${f(o.rest)}` : line;
}
function unitText(unit, n) {
  if (!unit) return '';
  if (typeof unit === 'string') return unit;
  return Math.abs(n) >= 2 ? unit.pl : unit.sg;
}

function build(K, spec, A, rng, opts) {
  const sentences = spec.sentences.slice();
  let use = null;
  if (A >= 2.2 && !spec.noUseless && rng.chance(A >= 4 ? 0.33 : 0.2)) {
    use = useless(rng, spec.numbers.concat([spec.answer]));
    if (use) sentences.unshift(use.s);              /* en tête : les pronoms de l'énoncé gardent leur sens */
  }
  const numbers = spec.numbers.slice();
  const nsteps = spec.ops.length;
  const dec = spec.dec || 0;
  const { choices, distractors } = makeChoices(spec.answer, spec.alt || [], rng, { dec, useless: use ? use.v : null, numbers });
  const mode = choiceMode(A, nsteps, dec);
  const unit = unitText(spec.unit, spec.answer);
  const steps = {
    comprendre: T(spec.cherche),
    modeliser: T(spec.modele),
    calculer: spec.ops.map(o => T(opLine(o, spec.unit))),
    repondre: T(spec.reponse)
  };
  const S = sentences.map(T), Q = T(spec.question);
  const inter = (spec.inter || []).filter(x => Math.abs(x.v - spec.answer) > 1e-9).map(x => ({ v: x.v, txt: T(x.txt) }));
  /* niveau réel : arrivée de la notion, champ numérique, décimaux et donnée inutile (CE2-P2) */
  const lvl = Math.max(K.lo, Math.min(A, numLevel(Math.max(...numbers, spec.answer)) + 1), dec || use ? 2.2 : 0);
  const keyNums = numbers.map(n => String(r2(n))).join('-');
  const slug = String(spec.scene).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/œ/g, 'oe').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const item = {
    axis, kind: K.id, notion: K.notion, notions: [K.notion, ...K.also],
    key: `${axis}:${K.id}:${keyNums}:${slug}`,
    A: Math.round(Math.min(A_TOP, lvl) * 100) / 100,
    prompt: S.concat([Q]).join(' '),
    answer: spec.answer,
    unit,
    hint: T(spec.hint),
    explain: T(`Comprendre : ${spec.cherche} Modéliser : ${spec.modele} Calculer : ${spec.ops.map(o => opLine(o, spec.unit)).join(' ; ')}. Répondre : ${spec.reponse}`),
    leitner: false,
    data: {
      sentences: S, question: Q, numbers, useless: use ? use.v : null, uselessText: use ? T(use.s) : null,
      inter, ops: spec.ops.map(o => ({ ...o })), nsteps, trap: !!spec.trap, mode, decimals: dec,
      choices: choices.map(c => ({ label: dec ? fmtNum(c.v, 2) : f(c.v), value: c.v })),
      distractors, schema: spec.schema || null, steps, answerText: T(spec.reponse), scene: spec.scene,
      consts: (spec.consts || []).slice(),         /* nombres dits en mots (« le quart » : 4) */
      fracTxt: spec.fracTxt || null
    }
  };
  if (mode === 'choices') item.choices = item.data.choices.map(c => ({ ...c }));
  return item;
}
/* 6 choix (format Repères) en CP-CE1 et pour les problèmes à étapes jusqu'au milieu du CE2 ; pavé ensuite */
export function choiceMode(A, nsteps = 1, dec = 0) {
  if (A < 2) return 'choices';
  if (nsteps >= 2 && A < 2.5) return 'choices';
  if (dec && A < 3) return 'choices';
  return 'keypad';
}

/* ================= TIRAGE ================= */
const BY_ID = Object.fromEntries(KINDS.map(k => [k.id, k]));
export const KIND_IDS = Object.freeze(KINDS.map(k => k.id));
export const KIND_INFO = Object.freeze(Object.fromEntries(KINDS.map(k => [k.id, Object.freeze({ notion: k.notion, lo: k.lo, trap: !!k.trap, add: !!k.add, steps: k.steps || 1 })])));

function pickKind(A, rng, locked) {
  const ok = KINDS.filter(k => k.lo <= A + 1e-9 && !locked.has(k.notion));
  if (!ok.length) return null;
  const top = Math.max(...ok.map(k => k.lo));
  const weight = k => {
    let w = k.w;
    if (A - k.lo < 0.6) w *= 1.7;                       /* notion qui vient d'arriver */
    else if (A - k.lo > 2.2) w *= 0.45;                  /* notion ancienne : de temps en temps */
    if (k.lo === top) w *= 1.2;
    return w;
  };
  /* contre-exemples aux mots inducteurs : ≈ 1 problème additif sur 3 à partir du CE1 (part τ parmi les additifs :
     p = τq / (1 − τ + τq), q = part des additifs parmi les autres gabarits) */
  const traps = ok.filter(k => k.trap && k.add);
  const rest = ok.filter(k => !(k.trap && k.add));
  const tau = A >= 1 ? 0.32 : A >= 0.6 ? 0.2 : 0;
  const wRest = rest.reduce((s, k) => s + weight(k), 0);
  const q = wRest > 0 ? rest.filter(k => k.add).reduce((s, k) => s + weight(k), 0) / wRest : 1;
  const pTrap = tau > 0 ? (tau * q) / (1 - tau + tau * q) : 0;
  if (traps.length && rng.chance(pTrap)) return rng.weighted(traps, traps.map(weight));
  return rng.weighted(rest, rest.map(weight));
}

export function gen(A, rng, opts = {}) {
  const a = clampA(A);
  const o = opts && typeof opts === 'object' ? opts : {};
  const avoid = toSet(o.avoid), locked = toSet(o.locked);
  const forced = o.kind && BY_ID[o.kind] ? BY_ID[o.kind] : null;
  let last = null;
  for (let i = 0; i < TRIES; i++) {
    let K = forced || pickKind(a, rng, locked);
    if (!K) K = pickKind(a, rng, new Set());          /* tout est verrouillé : on ignore le verrou pour ce tirage */
    if (!K) K = BY_ID.retrait;
    const aa = Math.max(a, K.lo);
    const e = { A: aa, rng, range: addRange(aa), cmax: cplxMax(aa) };
    let spec = null;
    try { spec = K.make(e); } catch (err) { spec = null; }
    if (!spec || !valid(spec)) continue;
    const item = build(K, spec, aa, rng, o);
    last = item;
    if (!avoid.has(item.key)) return item;
  }
  if (last) return last;
  /* filet de sécurité */
  for (let i = 0; i < 200; i++) {
    const spec = BY_ID.retrait.make({ A: 0, rng, range: addRange(0), cmax: 30 });
    if (spec && valid(spec)) return build(BY_ID.retrait, spec, 0, rng, o);
  }
  throw new Error('problemes : aucun énoncé');
}
/* garde-fous communs : réponse ≥ 2 (≥ 0,05 € pour un prix), nombres de l'énoncé ≥ 2 et distincts, calcul cohérent */
function valid(s) {
  if (!s || !Array.isArray(s.ops) || !s.ops.length) return false;
  const ans = s.answer;
  if (!Number.isFinite(ans) || ans < (s.dec ? 0.05 : 2)) return false;
  if (!s.dec && !Number.isInteger(ans)) return false;
  const nums = s.numbers;
  if (nums.some(n => !Number.isFinite(n) || n < (s.dec ? 0.05 : 2))) return false;
  if (new Set(nums.map(n => r2(n))).size !== nums.length) return false;
  if (nums.some(n => Math.abs(n - ans) < 1e-9)) return false;
  const last = s.ops[s.ops.length - 1];
  if (Math.abs(last.r - ans) > 1e-9) return false;
  for (const o of s.ops) {
    const v = o.op === '+' ? o.a + o.b : o.op === '−' ? o.a - o.b : o.op === '×' ? o.a * o.b : Math.floor(o.a / o.b + 1e-9);
    if (Math.abs(r2(v) - r2(o.r)) > 1e-9) return false;
    if (o.op === '÷' && !o.rest && Math.abs(o.a / o.b - o.r) > 1e-9) return false;
    if (o.r <= 0) return false;
  }
  return true;
}
