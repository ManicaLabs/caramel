/* ============ GÉNÉRATEUR « CONJUGAISON ET ACCORD DU VERBE » (axe fr.conjug) ============
   Jeu : « Le Chef d’orchestre » (docs/JEUX.md §6). Module pur (aucun DOM), contrat §6.1 :
     export const axis = 'fr.conjug'
     export function gen(A, rng, opts = {}) → item        (opts.avoid : Set de clés ; opts.kind : sous-type imposé)
     export function fromKey(key, A, rng) → item | null   (rejoue une clé Leitner)
   Déterministe pour (A, graine) : tout l'aléa passe par rng.

   PALIERS (A absolu : 0 = rentrée de CP … 5 = fin de CM2 ; sources : programme de français du cycle 2,
   BO n°41 du 31-10-2024 ; programme du cycle 3, BO n°16 du 17-04-2025 ; guides Repères 2026 ;
   synthèse « research/francais.md » §A, §C, §D) :
     A < 1     CP (remédiation) : être et avoir au présent, sujets pronoms.
               « Apprendre à conjuguer être et avoir au présent de l'indicatif » (cycle 2, CP).
     1 → 2     CE1 : présent (être, avoir, 1er groupe) ; imparfait dès 1,3 ; futur dès 1,6 ;
               passé composé avec avoir dès 1,8 (« au présent, à l'imparfait, au futur PUIS au passé
               composé […] être et avoir et les verbes du premier groupe ») ; sujets collés au verbe
               (pronom, prénom, GN court), pluriel en -nt ; radical et terminaison du 1er groupe.
               Temps du verbe parmi 4 dès 1,8 (Repères début de CE2, ex. 12 : « l'imparfait, le présent,
               le futur, le passé composé »).
     2 → 3     CE2 : les 4 temps + faire, aller, dire, venir, pouvoir, voir, vouloir, prendre, dans l'ordre
               du CE1 au fil de l'année : présent 2,0, imparfait 2,25, futur 2,5, passé composé 2,75
               (pouvoir, voir, vouloir, prendre : 2e vague, + 0,1) ;
               sujet après un complément (Repères début CE2) ; GN ↔ pronom ; passage au pluriel (2,2) ;
               passé composé des verbes avec être limité au masculin singulier (pas d'accord exigé
               avant le CM1, francais.md §A.4 ; ici avant 3,5).
     3 → 4     CM1 : + 2e groupe (présent 3,0, imparfait 3,25, futur 3,5, passé composé 3,75) ; variations
               du radical (-ger et -cer 3,0, e muet → è 3,3, -eler et -eter 3,5, -yer 3,7, envoyer 3,9) ;
               accords : nom noyau d'un GN avec complément du nom (« Les chiens de la voisine »),
               plusieurs noms (« Léa et Tom »), participe passé avec être (« elles sont parties », 3,5 ;
               « Léa et Tom sont partis », masculin et féminin mêlés, 3,8) ;
               verbes de la même famille (apprendre, comprendre, devenir, revenir) dès 3,2 (présent),
               puis 3,45, 3,7 et 3,95 pour l'imparfait, le futur et le passé composé.
     4 → 5,6   CM2 : + passé simple (il/ils dès 4,0, je 4,5, tu 4,6, nous 4,8, vous 4,9 — progression
               conseillée de francais.md §A.1 ; + 0,1 hors verbes en -er, être et avoir) et
               plus-que-parfait (4,3) ; sujet inversé (lieu en tête 4,2, dialogue 4,3, question 4,4) ;
               pronom complément avant le verbe (« Ces poules, la fermière les appelle », 4,4) ;
               participe passé avec avoir et COD pronom placé avant (« Ces fleurs, je les ai
               ramassées », 4,5) et piège du COD placé après (4,7) ; « Ton frère et toi » (4,9) ;
               combinaisons inversion + complément du nom (5,0), question + complément du nom (5,2).
     Jamais : 2e groupe avant 3, passé simple / plus-que-parfait avant 4, impératif, conditionnel.
     Verbes conjugués : être, avoir, 1er et 2e groupes, les 8 irréguliers du programme et leurs
     dérivés ; partir et sortir seulement aux temps composés (seul l'auxiliaire être est conjugué) ;
     les autres verbes du 3e groupe restent dans verbs.js (hors programme « à conjuguer »).

   NIVEAU D'UN ITEM (item.A) : la notion la plus récente qu'il mobilise (temps, verbe, personne,
   construction du sujet, accord du participe, sous-type), plus un supplément d'au plus 0,3 quand la
   deuxième notion de contenu (forme du verbe, construction de la phrase, accord du participe) est
   récente et proche (ex. « Les filles du boulanger ont fini » : 2e groupe au passé composé + complément
   du nom, tous deux du CM1). item.A ≤ A toujours.
   Calibrage (revue D2-02) : chaque notion (classe de verbe, temps, personne, structure) est tirée avec
   un poids qui favorise celles dont le niveau d'arrivée est proche de A ; parmi 16 candidats, ceux de
   niveau < A − 0,6 sont écartés tant qu'il en reste ; le niveau est tiré selon exp(−(A − L)/0,25),
   puis un candidat de ce niveau. Objectif mesuré (tests) : moyenne de item.A − A ≥ −0,25 pour tout A
   de 2 à 5 (−0,16 en moyenne ; −0,64 avant ce calibrage).

   INDICES (revue D2-04 ; contrat : indice = STRATÉGIE sans la réponse, explication = solution) :
     (1) repérer le sujet et chercher le pronom qui le remplace (question posée à l'enfant) ;
     (2) rappeler le tableau COMPLET des terminaisons du temps, dans l'ordre je, tu, il, nous, vous,
         ils (« Au futur : -ai, -as, -a, -ons, -ez, -ont »), ou la règle générale (temps composés,
         participe passé). Jamais la terminaison de la personne visée seule, jamais un modèle conjugué à
         la même personne, jamais un des choix proposés (aucune forme conjuguée d'un verbe de la banque
         dans les indices : ni « est », ni « a », ni « peut »…). La terminaison précise et la forme
         juste sont dans l'explication (montrée après la 2e erreur).

   KINDS (QCM à 4 choix, format Repères) :
     forme        phrase à trou + infinitif + temps → 4 formes
     terminaison  radical affiché + 4 terminaisons en tuiles
     temps        verbe souligné → 4 noms de temps
     accord       phrase-piège (GN, complément du nom, plusieurs noms, inversion, question, pronom COD…)
     sujet        forme donnée → 4 sujets
     participe    (CM1+) 4 accords du participe passé
   Clés : 'fr.conjug:<verbe>|<temps>|<personne>' (+ '|m' / '|f' pour les verbes avec être aux temps
   composés) pour forme, terminaison, accord, sujet et participe avec être ;
   'fr.conjug:temps|<verbe>|<temps>|<personne>' pour temps ;
   'fr.conjug:cod|<verbe>|<temps>|<ms|fs|mp|fp|apres>' pour le participe avec avoir.
   leitner = true pour être, avoir et les verbes du 3e groupe. */

import { frTypo, capFirst, clamp } from '../../core/util.js';
import { A_MAX } from '../../core/levels.js';
import {
  conjugate, formOf, simpleForm, groupOf, auxOf, isEtreVerb, isPlainForm, plainForm, stemEnding, endingsFor,
  paradigm, participle, agree, pastParticiple, startsWithVowel, variantOf, hasVerb,
  TENSES, PERSONS, COMPOUND_TENSES, TENSE_LABEL, TENSE_AT, TENSE_THE, PERSON_LABEL, ENDINGS
} from './verbs.js';

export const axis = 'fr.conjug';
const KEY = axis + ':';
const NNBSP = '\u202f';

/* ---------- Niveaux d'introduction (échelle A) ---------- */
export const LEVELS = {
  kind: { forme: 0, sujet: 0, accord: 1, terminaison: 1, temps: 1.8, participe: 3.5 },
  tense: { present: 0, imparfait: 1.3, futur: 1.6, passe_compose: 1.8, passe_simple: 4.0, plus_que_parfait: 4.3 },
  /* passé simple : il/elle et ils/elles, puis je/tu, puis nous/vous (francais.md §A.1, progression conseillée) */
  psPerson: { '3s': 4.0, '3p': 4.0, '1s': 4.5, '2s': 4.6, '1p': 4.8, '2p': 4.9 },
  verb: { aux: 0, g1: 1, g1var: 3, irr: 2, g2: 3, derived: 3.2, compound: 3 },
  /* arrivée d'une classe de verbes à chaque temps, dans l'ordre du programme (présent, puis imparfait,
     puis futur, puis passé composé) : les irréguliers au fil du CE2, le 2e groupe et les dérivés au CM1 */
  verbTense: {
    irr: { present: 2, imparfait: 2.25, futur: 2.5, passe_compose: 2.75 },      /* + irrLate pour la 2e vague */
    g2: { present: 3, imparfait: 3.25, futur: 3.5, passe_compose: 3.75 },
    derived: { present: 3.2, imparfait: 3.45, futur: 3.7, passe_compose: 3.95 }
  },
  /* variations du radical du 1er groupe (formes concernées seulement ; les autres formes : 1er groupe) */
  variant: { ger: 3, cer: 3, 'è': 3.3, ll: 3.5, tt: 3.5, yer: 3.7, envoyer: 3.9 },
  /* irréguliers en deux vagues, dans l'ordre de la liste du programme : faire, aller, dire, venir, puis
     pouvoir, voir, vouloir, prendre (+ 0,1 à chaque temps du CE2) */
  irrLate: { verbs: ['pouvoir', 'voir', 'vouloir', 'prendre'], offset: 0.1 },
  /* passé simple : verbes en -er, être et avoir d'abord ; 2e groupe et irréguliers un peu plus tard */
  psLate: 0.1,
  /* passé composé avec être : masculin singulier dès le CE2 ; accord complet au CM1, après le passé composé
     avec avoir (2e moitié de l'année) */
  etreMasc: 2, etreFull: 3.5,
  struct: {
    pron: 0, name: 1, gn: 1, pre: 2, pluriel: 2.2, cdn: 3, multi: 3, multiMixed: 3.8, inv: 4.2, dial: 4.3,
    q: 4.4, codpron: 4.4, multi2: 4.9, invcdn: 5, qcdn: 5.2
  },
  cod: 4.5, codAfter: 4.7,
  /* deux notions de contenu récentes (forme du verbe, construction de la phrase, accord du participe) :
     + bonus × (1 − écart / span) pour la deuxième, si elle vaut au moins `min` (rien pour un sujet pronom
     ou un GN court) */
  combo: { bonus: 0.3, span: 0.8, min: 1.5 }
};
const KINDS = Object.keys(LEVELS.kind);
const KIND_WEIGHT = { forme: 3, accord: 2, terminaison: 1.4, sujet: 1.2, temps: 1.5, participe: 1.5 };
const isCompound = t => !!COMPOUND_TENSES[t];
const BASIC = ['present', 'imparfait', 'futur', 'passe_compose'];

/* ============ SUJETS ============ */
const gn = (t, g, n, x) => Object.freeze(Object.assign({ t, g, n }, x || {}));
const NAMES_F = ['Léa', 'Inès', 'Jade', 'Chloé', 'Zoé', 'Emma', 'Lina', 'Manon', 'Sarah', 'Alice', 'Louise', 'Rose',
  'Maya', 'Nora', 'Mila', 'Ambre', 'Clara', 'Yasmine', 'Aya', 'Julia'];
const NAMES_M = ['Tom', 'Hugo', 'Nathan', 'Malik', 'Yanis', 'Lucas', 'Noah', 'Adam', 'Victor', 'Léo', 'Jules', 'Gabriel',
  'Arthur', 'Rayan', 'Théo', 'Samy', 'Enzo', 'Mathis', 'Paul', 'Ilan'];
const NAMES = [...NAMES_F.map(t => gn(t, 'f', 's', { name: 1 })), ...NAMES_M.map(t => gn(t, 'm', 's', { name: 1 }))];

const KIDS = [
  gn('mon frère', 'm', 's', { pl: 'mes frères' }), gn('ma sœur', 'f', 's', { pl: 'mes sœurs' }),
  gn('mon cousin', 'm', 's', { pl: 'mes cousins' }), gn('ma cousine', 'f', 's', { pl: 'mes cousines' }),
  gn('mon copain', 'm', 's', { pl: 'mes copains' }), gn('ma copine', 'f', 's', { pl: 'mes copines' }),
  gn('le petit garçon', 'm', 's', { pl: 'les petits garçons' }), gn('la petite fille', 'f', 's', { pl: 'les petites filles' }),
  gn('les enfants', 'm', 'p'), gn('les élèves', 'm', 'p'), gn('mes cousins', 'm', 'p'), gn('mes cousines', 'f', 'p'),
  gn('les garçons', 'm', 'p'), gn('les filles', 'f', 'p'), gn('mes amis', 'm', 'p'), gn('mes amies', 'f', 'p'),
  gn('les jumeaux', 'm', 'p'), gn('les jumelles', 'f', 'p')
];
const ADULTS = [
  gn('le maître', 'm', 's', { pl: 'les maîtres' }), gn('la maîtresse', 'f', 's', { pl: 'les maîtresses' }),
  gn('papa', 'm', 's'), gn('maman', 'f', 's'), gn('grand-père', 'm', 's'), gn('grand-mère', 'f', 's'),
  gn('le boulanger', 'm', 's', { pl: 'les boulangers' }), gn('la boulangère', 'f', 's', { pl: 'les boulangères' }),
  gn('le facteur', 'm', 's', { pl: 'les facteurs' }), gn('la factrice', 'f', 's', { pl: 'les factrices' }),
  gn('le fermier', 'm', 's', { pl: 'les fermiers' }), gn('la fermière', 'f', 's', { pl: 'les fermières' }),
  gn('le voisin', 'm', 's', { pl: 'les voisins' }), gn('la voisine', 'f', 's', { pl: 'les voisines' }),
  gn('mon oncle', 'm', 's', { pl: 'mes oncles' }), gn('ma tante', 'f', 's', { pl: 'mes tantes' }),
  gn('le jardinier', 'm', 's', { pl: 'les jardiniers' }), gn('la directrice', 'f', 's'),
  gn('mes parents', 'm', 'p'), gn('les voisins', 'm', 'p'), gn('les fermiers', 'm', 'p'), gn('mes grands-parents', 'm', 'p'),
  gn('les pompiers', 'm', 'p'), gn('les invités', 'm', 'p'), gn('mes tantes', 'f', 'p'), gn('les voisines', 'f', 'p')
];
/* compléments du nom (sujet éloigné du verbe) : trap = nombre du nom complément (≠ nombre du noyau) */
const cdn = (t, g, n, head, trap) => gn(t, g, n, { cdn: 1, head, trap });
const KIDS_CDN = [
  cdn('les élèves de la classe', 'm', 'p', 'élèves', 's'), cdn('les enfants de la voisine', 'm', 'p', 'enfants', 's'),
  cdn('la sœur de mes amis', 'f', 's', 'sœur', 'p'), cdn('le frère des jumelles', 'm', 's', 'frère', 'p'),
  cdn('les amis de mon cousin', 'm', 'p', 'amis', 's'), cdn('la cousine de mes voisins', 'f', 's', 'cousine', 'p'),
  cdn('les filles du boulanger', 'f', 'p', 'filles', 's'), cdn('le fils des voisins', 'm', 's', 'fils', 'p')
];
const ADULTS_CDN = [
  cdn('la maîtresse des petits', 'f', 's', 'maîtresse', 'p'), cdn('les parents de mon copain', 'm', 'p', 'parents', 's'),
  cdn('le père des jumeaux', 'm', 's', 'père', 'p'), cdn('les voisins de ma tante', 'm', 'p', 'voisins', 's'),
  cdn('la mère de mes amis', 'f', 's', 'mère', 'p'), cdn('les musiciens de la fanfare', 'm', 'p', 'musiciens', 's')
];

const P = {
  horse: { gn: [gn('le cheval', 'm', 's', { pl: 'les chevaux' }), gn('la jument', 'f', 's', { pl: 'les juments' }),
    gn('le poney', 'm', 's', { pl: 'les poneys' }), gn('le poulain', 'm', 's', { pl: 'les poulains' }),
    gn('les chevaux', 'm', 'p'), gn('les juments', 'f', 'p'), gn('les poneys', 'm', 'p'), gn('les poulains', 'm', 'p')],
    cdn: [cdn('les chevaux du fermier', 'm', 'p', 'chevaux', 's'), cdn('la jument des voisins', 'f', 's', 'jument', 'p'),
      cdn('le poney de mes cousins', 'm', 's', 'poney', 'p'), cdn('les poneys du club', 'm', 'p', 'poneys', 's')] },
  dog: { gn: [gn('le chien', 'm', 's', { pl: 'les chiens' }), gn('la chienne', 'f', 's', { pl: 'les chiennes' }),
    gn('le chiot', 'm', 's', { pl: 'les chiots' }), gn('les chiens', 'm', 'p'), gn('les chiots', 'm', 'p'), gn('les chiennes', 'f', 'p')],
    cdn: [cdn('les chiens de la voisine', 'm', 'p', 'chiens', 's'), cdn('le chien des voisins', 'm', 's', 'chien', 'p'),
      cdn('les chiots de ma tante', 'm', 'p', 'chiots', 's'), cdn('la chienne des fermiers', 'f', 's', 'chienne', 'p')] },
  cat: { gn: [gn('le chat', 'm', 's', { pl: 'les chats' }), gn('le chaton', 'm', 's', { pl: 'les chatons' }),
    gn('les chats', 'm', 'p'), gn('les chatons', 'm', 'p')],
    cdn: [cdn('le chat des voisins', 'm', 's', 'chat', 'p'), cdn('les chats de la ferme', 'm', 'p', 'chats', 's'),
      cdn('le chaton de mes cousines', 'm', 's', 'chaton', 'p'), cdn('les chatons de la voisine', 'm', 'p', 'chatons', 's')] },
  bird: { gn: [gn('l’oiseau', 'm', 's', { pl: 'les oiseaux' }), gn('le merle', 'm', 's', { pl: 'les merles' }),
    gn('la mésange', 'f', 's', { pl: 'les mésanges' }), gn('les oiseaux', 'm', 'p'), gn('les hirondelles', 'f', 'p'),
    gn('les moineaux', 'm', 'p'), gn('le rossignol', 'm', 's', { pl: 'les rossignols' })],
    cdn: [cdn('les oiseaux de grand-père', 'm', 'p', 'oiseaux', 's'), cdn('le merle des voisins', 'm', 's', 'merle', 'p')] },
  hen: { gn: [gn('la poule', 'f', 's', { pl: 'les poules' }), gn('le coq', 'm', 's', { pl: 'les coqs' }),
    gn('le poussin', 'm', 's', { pl: 'les poussins' }), gn('les poules', 'f', 'p'), gn('les poussins', 'm', 'p')],
    cdn: [cdn('les poules de la fermière', 'f', 'p', 'poules', 's'), cdn('le coq des voisins', 'm', 's', 'coq', 'p')] },
  cow: { gn: [gn('la vache', 'f', 's', { pl: 'les vaches' }), gn('le veau', 'm', 's', { pl: 'les veaux' }),
    gn('les vaches', 'f', 'p'), gn('les veaux', 'm', 'p')],
    cdn: [cdn('les vaches du fermier', 'f', 'p', 'vaches', 's'), cdn('le veau des voisins', 'm', 's', 'veau', 'p')] },
  sheep: { gn: [gn('le mouton', 'm', 's', { pl: 'les moutons' }), gn('la brebis', 'f', 's', { pl: 'les brebis' }),
    gn('les moutons', 'm', 'p'), gn('les agneaux', 'm', 'p'), gn('l’agneau', 'm', 's', { pl: 'les agneaux' })],
    cdn: [cdn('les moutons du berger', 'm', 'p', 'moutons', 's'), cdn('l’agneau des voisins', 'm', 's', 'agneau', 'p')] },
  rabbit: { gn: [gn('le lapin', 'm', 's', { pl: 'les lapins' }), gn('la lapine', 'f', 's', { pl: 'les lapines' }),
    gn('les lapins', 'm', 'p'), gn('les lapereaux', 'm', 'p')],
    cdn: [cdn('les lapins de mon cousin', 'm', 'p', 'lapins', 's'), cdn('le lapin des jumelles', 'm', 's', 'lapin', 'p')] },
  duck: { gn: [gn('le canard', 'm', 's', { pl: 'les canards' }), gn('la cane', 'f', 's', { pl: 'les canes' }),
    gn('les canards', 'm', 'p'), gn('les canetons', 'm', 'p'), gn('les oies', 'f', 'p')],
    cdn: [cdn('les canards du fermier', 'm', 'p', 'canards', 's'), cdn('la cane des voisins', 'f', 's', 'cane', 'p')] },
  frog: { gn: [gn('la grenouille', 'f', 's', { pl: 'les grenouilles' }), gn('le crapaud', 'm', 's', { pl: 'les crapauds' }),
    gn('les grenouilles', 'f', 'p')] },
  squirrel: { gn: [gn('l’écureuil', 'm', 's', { pl: 'les écureuils' }), gn('les écureuils', 'm', 'p')] },
  fox: { gn: [gn('le renard', 'm', 's', { pl: 'les renards' }), gn('la renarde', 'f', 's'), gn('les renards', 'm', 'p'),
    gn('les renardeaux', 'm', 'p')] },
  dolphin: { gn: [gn('le dauphin', 'm', 's', { pl: 'les dauphins' }), gn('les dauphins', 'm', 'p')] },
  bee: { gn: [gn('l’abeille', 'f', 's', { pl: 'les abeilles' }), gn('les abeilles', 'f', 'p')],
    cdn: [cdn('les abeilles du jardinier', 'f', 'p', 'abeilles', 's')] },
  fish: { gn: [gn('le poisson rouge', 'm', 's', { pl: 'les poissons rouges' }), gn('les poissons', 'm', 'p')] },
  monkey: { gn: [gn('le singe', 'm', 's', { pl: 'les singes' }), gn('les singes', 'm', 'p')] },
  goat: { gn: [gn('la chèvre', 'f', 's', { pl: 'les chèvres' }), gn('le chevreau', 'm', 's'), gn('les chèvres', 'f', 'p')] },
  parrot: { gn: [gn('le perroquet', 'm', 's', { pl: 'les perroquets' }), gn('les perroquets', 'm', 'p')] },
  baby: { gn: [gn('le bébé', 'm', 's', { pl: 'les bébés' }), gn('les bébés', 'm', 'p')] },
  tadpole: { gn: [gn('le têtard', 'm', 's', { pl: 'les têtards' }), gn('les têtards', 'm', 'p')] },
  caterpillar: { gn: [gn('la chenille', 'f', 's', { pl: 'les chenilles' }), gn('les chenilles', 'f', 'p')] },
  /* choses */
  sky: { gn: [gn('le soleil', 'm', 's'), gn('la lune', 'f', 's'), gn('les étoiles', 'f', 'p'), gn('l’étoile', 'f', 's', { pl: 'les étoiles' })] },
  lights: { gn: [gn('les lampions', 'm', 'p'), gn('la lanterne', 'f', 's', { pl: 'les lanternes' }), gn('les lanternes', 'f', 'p'),
    gn('le phare', 'm', 's')],
    cdn: [cdn('les yeux du chat', 'm', 'p', 'yeux', 's'), cdn('les lumières de la ville', 'f', 'p', 'lumières', 's'),
      cdn('la lanterne des bergers', 'f', 's', 'lanterne', 'p')] },
  wind: { gn: [gn('le vent', 'm', 's', { pl: 'les vents' }), gn('la tempête', 'f', 's'), gn('les vents', 'm', 'p')] },
  bell: { gn: [gn('la cloche', 'f', 's', { pl: 'les cloches' }), gn('les cloches', 'f', 'p')],
    cdn: [cdn('les cloches de l’église', 'f', 'p', 'cloches', 's')] },
  clock: { gn: [gn('le réveil', 'm', 's', { pl: 'les réveils' }), gn('les réveils', 'm', 'p'), gn('le téléphone', 'm', 's', { pl: 'les téléphones' })] },
  train: { gn: [gn('le train', 'm', 's', { pl: 'les trains' }), gn('les trains', 'm', 'p'), gn('la locomotive', 'f', 's', { pl: 'les locomotives' }),
    gn('les wagons', 'm', 'p')] },
  bus: { gn: [gn('le bus', 'm', 's'), gn('le car', 'm', 's', { pl: 'les cars' }), gn('les cars', 'm', 'p')] },
  boat: { gn: [gn('le bateau', 'm', 's', { pl: 'les bateaux' }), gn('les bateaux', 'm', 'p'), gn('le voilier', 'm', 's', { pl: 'les voiliers' })] },
  car: { gn: [gn('la voiture', 'f', 's', { pl: 'les voitures' }), gn('les voitures', 'f', 'p'), gn('le camion', 'm', 's', { pl: 'les camions' }),
    gn('les camions', 'm', 'p'), gn('le tracteur', 'm', 's', { pl: 'les tracteurs' })],
    cdn: [cdn('les voitures du voisin', 'f', 'p', 'voitures', 's'), cdn('le tracteur des fermiers', 'm', 's', 'tracteur', 'p')] },
  plane: { gn: [gn('l’avion', 'm', 's', { pl: 'les avions' }), gn('les avions', 'm', 'p'), gn('l’hélicoptère', 'm', 's')] },
  balloon: { gn: [gn('la montgolfière', 'f', 's', { pl: 'les montgolfières' }), gn('les montgolfières', 'f', 'p')] },
  fall: { gn: [gn('les feuilles', 'f', 'p'), gn('la feuille', 'f', 's', { pl: 'les feuilles' }), gn('les pommes', 'f', 'p'),
    gn('les flocons', 'm', 'p'), gn('la neige', 'f', 's'), gn('la pluie', 'f', 's'), gn('les marrons', 'm', 'p')],
    cdn: [cdn('les feuilles de l’arbre', 'f', 'p', 'feuilles', 's'), cdn('les pommes du pommier', 'f', 'p', 'pommes', 's')] },
  flower: { gn: [gn('les roses', 'f', 'p'), gn('le cerisier', 'm', 's', { pl: 'les cerisiers' }), gn('les tulipes', 'f', 'p'),
    gn('la lavande', 'f', 's'), gn('les pommiers', 'm', 'p'), gn('le rosier', 'm', 's', { pl: 'les rosiers' })],
    cdn: [cdn('les rosiers de grand-mère', 'm', 'p', 'rosiers', 's'), cdn('le cerisier des voisins', 'm', 's', 'cerisier', 'p')] },
  plant: { gn: [gn('le tournesol', 'm', 's', { pl: 'les tournesols' }), gn('les tournesols', 'm', 'p'), gn('la plante', 'f', 's', { pl: 'les plantes' }),
    gn('les plantes', 'f', 'p'), gn('les arbres', 'm', 'p'), gn('le sapin', 'm', 's', { pl: 'les sapins' })] },
  fruit: { gn: [gn('les tomates', 'f', 'p'), gn('les fraises', 'f', 'p'), gn('la pomme', 'f', 's', { pl: 'les pommes' }),
    gn('les cerises', 'f', 'p'), gn('la tomate', 'f', 's', { pl: 'les tomates' })] },
  wheel: { gn: [gn('la roue', 'f', 's', { pl: 'les roues' }), gn('les roues', 'f', 'p'), gn('le manège', 'm', 's', { pl: 'les manèges' }),
    gn('la toupie', 'f', 's', { pl: 'les toupies' })],
    cdn: [cdn('les ailes du moulin', 'f', 'p', 'ailes', 's'), cdn('les roues du vélo', 'f', 'p', 'roues', 's')] },
  show: { gn: [gn('le film', 'm', 's', { pl: 'les films' }), gn('le spectacle', 'm', 's'), gn('la récréation', 'f', 's'),
    gn('les vacances', 'f', 'p'), gn('le match', 'm', 's', { pl: 'les matchs' }), gn('la fête', 'f', 's')] }
};
/* groupes humains */
const HUMAN = { K: { gn: KIDS, cdn: KIDS_CDN, names: true }, A: { gn: ADULTS, cdn: ADULTS_CDN, names: false } };
HUMAN.H = { gn: [...KIDS, ...ADULTS], cdn: [...KIDS_CDN, ...ADULTS_CDN], names: true };

/* ============ BANQUE DE CADRES (originale) ============
   s : groupe de sujets (K enfants, A adultes, H tous, ou espèces/choses) ; c : compléments après le verbe
   (chaîne ou { s, p } selon le nombre du sujet) ; l : compléments de lieu (après le verbe, en tête avec
   virgule, ou en tête avec inversion si inv) ; n : nombre imposé ; once : évènement ponctuel (pas
   d'indicateur d'habitude) ; d : paroles rapportées (dialogue). Aucun possessif lié au sujet. */
const SIMPLE_PLACE = ['present', 'imparfait', 'futur'];          /* « être » + lieu : pas aux temps composés ni au passé simple */
const FR = {
  'être': [
    { s: 'H', c: ['à l’école', 'au parc', 'à la piscine', 'à la maison', 'dans le jardin', 'au marché', 'à la bibliothèque',
      'sur la plage', 'au gymnase'], t: SIMPLE_PLACE },
    { s: 'H', c: ['en retard', 'en avance', 'à l’heure', 'de bonne humeur', 'en forme'] },
    { s: 'H', c: ['en vacances'], once: 1 },
    { s: 'horse', c: ['dans le pré', 'à l’écurie', 'au bord de la rivière'], t: SIMPLE_PLACE },
    { s: 'cat', c: ['sur le canapé', 'sous la table', 'dans le panier'], t: SIMPLE_PLACE },
    { s: 'dog', c: ['dans la niche', 'dans le jardin', 'devant la porte'], t: SIMPLE_PLACE },
    { s: ['train', 'bus'], c: ['en panne', 'en retard', 'à l’heure'] },
    { s: 'car', c: ['en panne'] }
  ],
  avoir: [
    { s: 'H', c: ['faim', 'soif', 'froid', 'chaud', 'sommeil', 'de la chance', 'une idée', 'mal au ventre', 'peur de l’orage'] },
    { s: 'H', c: ['un vélo rouge', 'un chat', 'un chien', 'un ballon', 'un cadeau', 'une surprise', 'un nouveau cartable'], once: 1, state: 1 },
    { s: ['horse', 'dog', 'cat'], c: ['faim', 'soif', 'froid', 'peur de l’orage', 'sommeil'] },
    { s: 'bird', c: ['froid', 'faim'] }
  ],
  /* ----- 1er groupe ----- */
  jouer: [
    { s: 'K', c: ['au ballon', 'aux billes', 'à cache-cache', 'au football', 'aux cartes', 'à la marelle', 'aux échecs'],
      l: ['dans la cour', 'au parc', 'dans le jardin'] },
    { s: 'H', c: ['de la guitare', 'du piano', 'du violon', 'de la flûte', 'du tambour'] },
    { s: 'cat', c: ['avec une pelote de laine', 'avec une balle'], l: ['sur le tapis', 'dans le salon'] },
    { s: 'dolphin', l: ['dans les vagues', 'près du bateau'], inv: 1 },
    { s: 'dog', c: ['avec un bâton', 'avec une balle'], l: ['dans le jardin', 'sur la plage'] }
  ],
  chanter: [
    { s: 'H', c: ['une chanson', 'une berceuse', 'une comptine', 'très fort', 'tout doucement'],
      l: ['à la chorale', 'sous la douche', 'dans la voiture'] },
    { s: 'bird', l: ['dans les arbres', 'sur les branches', 'dans le jardin'], inv: 1 },
    { s: [gn('le coq', 'm', 's', { pl: 'les coqs' }), gn('les coqs', 'm', 'p')], c: ['très tôt', 'très fort'], l: ['dans la cour de la ferme'] }
  ],
  danser: [
    { s: 'H', c: ['la valse', 'le tango', 'en rond', 'avec grâce'], l: ['sur la scène', 'dans le salon', 'sur la place', 'au bal'], inv: 1 },
    { s: 'bee', l: ['autour des fleurs', 'au-dessus de la ruche'], inv: 1 }
  ],
  parler: [
    { s: 'H', c: ['à voix basse', 'très fort', 'trop vite', 'anglais', 'au téléphone', 'du match', 'de la fête'] },
    { s: 'parrot', c: ['très fort', 'sans arrêt'] }
  ],
  aimer: [
    { s: 'H', c: ['les fraises', 'le chocolat', 'les histoires de pirates', 'la musique', 'les crêpes', 'la mer', 'les chevaux', 'la neige'], once: 1, state: 1 },
    { s: 'cat', c: ['le lait', 'les caresses', 'le soleil'], once: 1, state: 1 },
    { s: 'dog', c: ['les promenades', 'les caresses', 'la neige'], once: 1, state: 1 },
    { s: 'horse', c: ['les carottes', 'les pommes', 'le foin'], once: 1, state: 1 }
  ],
  regarder: [
    { s: 'H', c: ['un dessin animé', 'les étoiles', 'la télévision', 'un film', 'les nuages', 'le match', 'les photos'] },
    { s: 'cat', c: ['les oiseaux', 'la pluie', 'les poissons rouges'], l: ['par la fenêtre'] }
  ],
  marcher: [
    { s: 'H', c: ['vite', 'lentement', 'pieds nus'], l: ['dans la forêt', 'sur la plage', 'le long de la rivière', 'dans la neige'] },
    { s: ['duck', 'hen'], n: 'p', c: ['en file indienne'], l: ['dans la cour', 'au bord de l’étang'] }
  ],
  sauter: [
    { s: 'K', c: ['à la corde', 'dans les flaques', 'très haut', 'sur le trampoline', 'par-dessus le ruisseau'] },
    { s: 'horse', c: ['par-dessus la barrière', 'très haut', 'l’obstacle'] },
    { s: ['frog', 'rabbit'], c: ['très haut', 'de pierre en pierre'], l: ['dans l’herbe', 'près de la mare'], inv: 1 }
  ],
  donner: [
    { s: 'H', c: ['une pomme au cheval', 'du pain aux canards', 'des graines aux oiseaux', 'un os au chien', 'une carotte au lapin', 'à manger aux poules'] }
  ],
  porter: [
    { s: 'H', c: ['un gros sac', 'un chapeau de paille', 'des bottes', 'un panier de pommes', 'un parapluie', 'une écharpe', 'des lunettes'] },
    { s: 'horse', c: ['un cavalier', 'une selle neuve', 'des sacoches'] }
  ],
  chercher: [
    { s: 'H', c: ['un trésor', 'la clé', 'un crayon', 'des champignons', 'le chat', 'la sortie', 'des coquillages'], once: 1 },
    { s: 'dog', c: ['un os', 'la balle', 'le bâton'], l: ['dans le jardin'] },
    { s: 'squirrel', c: ['des noisettes', 'des glands'], l: ['sous les feuilles', 'dans la forêt'] },
    { s: 'hen', c: ['des graines', 'des vers'], l: ['dans la cour'] }
  ],
  trouver: [
    { s: 'H', c: ['un trésor', 'une pièce', 'la réponse', 'un trèfle à quatre feuilles', 'un nid', 'des champignons', 'un coquillage'], once: 1 },
    { s: 'squirrel', c: ['une noisette', 'des glands'], once: 1 },
    { s: 'dog', c: ['un os', 'la balle'], once: 1 }
  ],
  'écouter': [
    { s: 'H', c: ['une histoire', 'de la musique', 'la radio', 'le chant des oiseaux', 'la pluie', 'les vagues', 'un conte'] }
  ],
  fermer: [
    { s: 'H', c: ['la porte', 'la fenêtre', 'les volets', 'le portail', 'les yeux', 'la boîte', 'le livre'] }
  ],
  dessiner: [
    { s: 'H', c: ['un cheval', 'une maison', 'des fleurs', 'un arc-en-ciel', 'un bateau', 'une carte au trésor', 'un dragon'] }
  ],
  'préparer': [
    { s: 'H', c: ['un gâteau', 'des crêpes', 'une surprise', 'le goûter', 'une salade de fruits', 'un spectacle', 'la valise'] }
  ],
  raconter: [
    { s: 'H', c: ['une histoire', 'une blague', 'un conte', 'un secret', 'une aventure', 'la fin du film'] }
  ],
  ramasser: [
    { s: 'H', c: ['des feuilles', 'des coquillages', 'des châtaignes', 'des fleurs', 'des pommes', 'des marrons', 'les papiers', 'des cailloux'] },
    { s: 'squirrel', c: ['des noisettes', 'des glands'] }
  ],
  grimper: [
    { s: 'K', c: ['à l’arbre', 'à la corde', 'sur le mur', 'à l’échelle'] },
    { s: ['cat', 'squirrel', 'monkey'], c: ['à l’arbre', 'sur le toit', 'au sommet du chêne'] },
    { s: 'goat', c: ['sur les rochers'] }
  ],
  galoper: [
    { s: 'horse', l: ['dans le pré', 'sur la plage', 'au bord de la rivière', 'dans la prairie'], inv: 1 }
  ],
  briller: [
    { s: 'sky', l: ['dans le ciel', 'au-dessus de la mer'], inv: 1 },
    { s: 'lights', l: ['dans la nuit', 'dans le noir'], inv: 1 }
  ],
  laver: [
    { s: 'H', c: ['la voiture', 'la vaisselle', 'le chien', 'les carreaux', 'les légumes', 'le linge'] }
  ],
  travailler: [
    { s: 'H', c: ['beaucoup', 'en silence', 'avec soin'], l: ['dans le jardin', 'à la ferme', 'à la bibliothèque'] },
    { s: 'bee', c: ['sans arrêt'], l: ['dans la ruche'], inv: 1 }
  ],
  apporter: [
    { s: 'H', c: ['un gâteau', 'des fleurs', 'le goûter', 'un ballon', 'des bonbons', 'le pain', 'une bonne nouvelle'] },
    { s: 'dog', c: ['la balle', 'le journal', 'un bâton'] }
  ],
  crier: [
    { s: 'H', c: ['très fort', 'de joie'], d: ['« Au secours ! »', '« Attention ! »', '« Hourra ! »', '« Bravo ! »', '« Au loup ! »'] }
  ],
  oublier: [
    { s: 'H', c: ['la clé', 'le pain', 'un parapluie', 'le rendez-vous', 'le code', 'le ballon'], once: 1 }
  ],
  colorier: [
    { s: 'K', c: ['un dessin', 'une carte', 'un papillon', 'une étoile', 'un mandala'] }
  ],
  habiter: [
    { s: 'H', l: ['à la campagne', 'près de la mer', 'dans une grande maison', 'au bord du lac', 'en ville', 'à côté de l’école'], once: 1, state: 1, nopre: 1 },
    { s: 'squirrel', l: ['dans le grand chêne'], inv: 1, once: 1, state: 1 },
    { s: 'fox', l: ['dans un terrier', 'au fond du bois'], inv: 1, once: 1, state: 1 },
    { s: 'bee', l: ['dans la ruche'], inv: 1, once: 1, state: 1 }
  ],
  visiter: [
    { s: 'H', c: ['le château', 'un musée', 'la ferme', 'le zoo', 'une grotte', 'le phare'], once: 1 }
  ],
  pleurer: [
    { s: 'baby', l: ['dans le berceau', 'dans la poussette'] },
    { s: 'K', c: ['de rire', 'de joie'] }
  ],
  souffler: [
    { s: 'wind', c: ['très fort'], l: ['sur la plage', 'dans les arbres', 'sur la montagne'], inv: 1 },
    { s: 'H', c: ['les bougies', 'sur la soupe', 'dans un ballon'] }
  ],
  sonner: [
    { s: 'bell', c: ['très fort', 'à toute volée'], l: ['au loin', 'dans le village'], inv: 1 },
    { s: 'clock', c: ['très fort', 'sans arrêt'], l: ['dans la maison', 'dans la chambre'] }
  ],
  voler: [
    { s: 'bird', l: ['au-dessus du lac', 'dans le ciel', 'au-dessus des toits'], inv: 1 },
    { s: 'bee', l: ['au-dessus des fleurs', 'autour de la ruche'], inv: 1 },
    { s: 'plane', l: ['dans le ciel', 'au-dessus des nuages'], inv: 1 }
  ],
  tourner: [
    { s: 'H', c: ['à gauche', 'à droite', 'la page', 'en rond'] },
    { s: 'wheel', c: ['très vite', 'lentement', 'sans bruit'] }
  ],
  gagner: [
    { s: 'H', c: ['la course', 'le match', 'un prix', 'la partie'], once: 1 }
  ],
  garder: [
    { s: 'H', c: ['le secret', 'les moutons', 'la monnaie'] },
    { s: 'dog', c: ['la maison', 'le troupeau', 'la ferme'] }
  ],
  siffler: [
    { s: 'H', c: ['un air joyeux', 'très fort'] },
    { s: 'train', c: ['en entrant en gare'], l: ['au loin'] }
  ],
  rouler: [
    { s: ['car', 'bus'], c: ['très vite', 'lentement', 'sans bruit'], l: ['sur la route', 'sur le pont'], inv: 1 },
    { s: 'train', c: ['très vite', 'lentement'], l: ['sur les rails', 'sur le pont'], inv: 1 },
    { s: 'K', c: ['à vélo', 'en trottinette', 'en rollers'] }
  ],
  planter: [
    { s: 'H', c: ['des tulipes', 'un arbre', 'des graines', 'des tomates', 'des carottes'], l: ['dans le jardin', 'dans le potager'] }
  ],
  arroser: [
    { s: 'H', c: ['les fleurs', 'le jardin', 'les tomates', 'les plantes', 'la pelouse'] }
  ],
  miauler: [
    { s: 'cat', c: ['très fort', 'devant la porte'], l: ['dans le jardin', 'sur le toit'], inv: 1 }
  ],
  cuisiner: [
    { s: 'H', c: ['une soupe', 'des pâtes', 'un plat délicieux', 'une tarte aux pommes'] }
  ],
  demander: [
    { s: 'H', c: ['de l’aide', 'la permission', 'le chemin'], d: ['« Où est le chat ? »', '« Qui veut du gâteau ? »', '« Quelle heure est-il ? »'] }
  ],
  chuchoter: [
    { s: 'H', c: ['un secret', 'tout bas'], d: ['« Chut ! »', '« Écoute bien ! »'] }
  ],
  pousser: [
    { s: 'H', c: ['la brouette', 'le chariot', 'la balançoire', 'la porte'] }
  ],
  tirer: [
    { s: 'horse', c: ['la charrette', 'la calèche', 'la carriole'] },
    { s: 'H', c: ['la corde', 'le traîneau', 'les rideaux'] }
  ],
  brosser: [
    { s: 'K', c: ['le poney', 'la jument', 'le chien', 'le chat'] }
  ],
  caresser: [
    { s: 'H', c: ['le chat', 'le poney', 'les lapins', 'le chien'] }
  ],
  'rêver': [
    { s: 'H', c: ['de vacances', 'd’un poney', 'de voyages', 'de la mer'] }
  ],
  /* 1er groupe conjugués avec être */
  arriver: [
    { s: 'H', c: ['à l’heure', 'en retard', 'en avance'], l: ['à l’école', 'à la gare', 'au stade', 'à la ferme'], nopre: 1 },
    { s: 'train', c: ['à l’heure', 'en retard'], l: ['à la gare'], inv: 1, nopre: 1 },
    { s: 'bus', c: ['à l’heure', 'en retard'], l: ['à l’arrêt'], nopre: 1 },
    { s: 'boat', c: ['à l’heure', 'en retard'], l: ['au port'], inv: 1, nopre: 1 }
  ],
  entrer: [
    { s: 'H', l: ['dans la classe', 'dans la maison', 'dans le magasin', 'dans la cuisine', 'dans le musée'], nopre: 1 },
    { s: 'horse', l: ['dans l’écurie', 'dans le manège'], nopre: 1 },
    { s: 'cat', c: ['par la fenêtre'] }
  ],
  tomber: [
    { s: 'fall', l: ['dans le jardin', 'sur le chemin', 'sur le sol'], inv: 1 },
    { s: 'K', c: ['dans la boue', 'de vélo', 'dans une flaque', 'du toboggan'], once: 1 }
  ],
  rester: [
    { s: 'H', l: ['à la maison', 'au lit', 'au chaud', 'dans la cabane', 'sur le quai', 'en classe'], nopre: 1 },
    { s: 'horse', l: ['à l’écurie', 'dans le pré'], nopre: 1 },
    { s: 'cow', l: ['dans l’étable', 'dans le pré'], nopre: 1 }
  ],
  monter: [
    { s: 'H', l: ['dans le train', 'dans le bus', 'au grenier', 'sur la scène', 'sur le manège'], nopre: 1 },
    { s: 'cat', c: ['sur le toit', 'sur la table', 'sur l’armoire'] }
  ],
  rentrer: [
    { s: 'K', c: ['de l’école', 'du parc', 'de la piscine'], l: ['à la maison'], nopre: 1 },
    { s: 'A', c: ['du travail', 'du marché', 'tard'] },
    { s: 'sheep', l: ['à la bergerie'], nopre: 1 },
    { s: 'hen', l: ['au poulailler'], nopre: 1 }
  ],
  /* 1er groupe : variations du radical */
  manger: [
    { s: 'H', c: ['une pomme', 'des crêpes', 'une soupe', 'du pain', 'une glace', 'des fraises'] },
    { s: 'horse', c: ['des carottes', 'du foin', 'une pomme'] },
    { s: 'rabbit', c: ['de la salade', 'une carotte'] },
    { s: 'hen', c: ['des graines', 'du maïs'] },
    { s: ['cow', 'sheep', 'goat'], c: ['de l’herbe'], l: ['dans le pré'] }
  ],
  nager: [
    { s: 'K', c: ['vite', 'sous l’eau', 'la brasse'], l: ['dans la piscine', 'dans le lac', 'dans la mer'] },
    { s: 'fish', l: ['dans la rivière', 'dans l’aquarium'], inv: 1 },
    { s: 'dolphin', l: ['près du bateau', 'dans les vagues'], inv: 1 },
    { s: 'duck', l: ['sur l’étang', 'sur la rivière'], inv: 1 }
  ],
  ranger: [
    { s: 'H', c: ['les jouets', 'la chambre', 'les livres', 'la vaisselle', 'les crayons', 'le garage'] }
  ],
  partager: [
    { s: 'H', c: ['un gâteau', 'le goûter', 'les bonbons', 'une pizza', 'un secret'] }
  ],
  voyager: [
    { s: 'H', c: ['en train', 'en avion', 'en bateau', 'à vélo'], l: ['autour du monde'], nopre: 1 }
  ],
  plonger: [
    { s: 'K', c: ['du grand plongeoir', 'sans hésiter'], l: ['dans la piscine', 'dans le lac'] },
    { s: 'dolphin', l: ['dans les vagues'], inv: 1 },
    { s: 'duck', c: ['la tête sous l’eau'] }
  ],
  commencer: [
    { s: 'H', c: ['un puzzle', 'un nouveau livre', 'la partie', 'le spectacle', 'un dessin'] }
  ],
  lancer: [
    { s: 'H', c: ['le ballon', 'la balle au chien', 'des confettis', 'le dé', 'des cailloux dans l’eau'] }
  ],
  avancer: [
    { s: 'H', c: ['lentement', 'vers la porte', 'pas à pas', 'dans la file'] },
    { s: 'horse', c: ['au pas', 'lentement'] },
    { s: ['car', 'train', 'bus'], c: ['lentement', 'tout doucement'] }
  ],
  annoncer: [
    { s: 'H', c: ['une bonne nouvelle', 'le départ', 'la fin du jeu'], d: ['« Le goûter est prêt ! »', '« Le spectacle va commencer ! »'] }
  ],
  appeler: [
    { s: 'H', c: ['le chien', 'le chat', 'le docteur', 'un taxi', 'les poules'] }
  ],
  jeter: [
    { s: 'H', c: ['les papiers à la poubelle', 'du pain aux canards', 'une pièce dans la fontaine', 'un caillou dans l’eau', 'le ballon'] }
  ],
  acheter: [
    { s: 'H', c: ['du pain', 'des pommes', 'un cadeau', 'une glace', 'des bonbons', 'un livre'] }
  ],
  lever: [
    { s: 'K', c: ['le doigt', 'la main', 'les bras'] }
  ],
  promener: [
    { s: 'H', c: ['le chien', 'le bébé', 'les chevaux'] }
  ],
  nettoyer: [
    { s: 'H', c: ['la cuisine', 'les vitres', 'la cage du lapin', 'l’écurie', 'les bottes', 'le tableau'] }
  ],
  essuyer: [
    { s: 'H', c: ['la vaisselle', 'la table', 'les verres', 'les bottes'] }
  ],
  aboyer: [
    { s: 'dog', c: ['très fort', 'contre le facteur'], l: ['dans le jardin', 'derrière le portail'], inv: 1 }
  ],
  appuyer: [
    { s: 'H', c: ['sur le bouton', 'sur la sonnette', 'sur l’interrupteur'] }
  ],
  envoyer: [
    { s: 'H', c: ['une lettre', 'une carte postale', 'un colis', 'un message', 'le ballon'] }
  ],
  /* ----- 2e groupe ----- */
  finir: [
    { s: 'H', c: ['le puzzle', 'un dessin', 'le goûter', 'la course', 'un livre', 'le travail'] },
    { s: 'show', c: ['tard', 'très tard'], state: 1 }
  ],
  choisir: [
    { s: 'H', c: ['un livre', 'une glace à la fraise', 'un poney', 'le bleu', 'un jeu', 'une couleur'], once: 1 }
  ],
  grandir: [
    { s: 'K', c: ['vite', 'beaucoup'] },
    { s: 'plant', c: ['vite', 'au soleil'], l: ['dans le jardin'] },
    { s: [gn('le poulain', 'm', 's', { pl: 'les poulains' }), gn('les poulains', 'm', 'p'), gn('le chiot', 'm', 's', { pl: 'les chiots' }),
      gn('les chiots', 'm', 'p')], c: ['vite', 'beaucoup'] }
  ],
  'réussir': [
    { s: 'H', c: ['le gâteau', 'un tour de magie', 'l’exercice', 'la course', 'un beau dessin'], once: 1 }
  ],
  remplir: [
    { s: 'H', c: ['le seau', 'la bouteille', 'le panier', 'les verres', 'l’arrosoir'] }
  ],
  'obéir': [
    { s: 'K', c: ['à la maîtresse', 'au maître', 'à maman', 'à papa'] },
    { s: 'dog', c: ['au fermier', 'au berger'] },
    { s: 'horse', c: ['à la cavalière', 'au cavalier'] }
  ],
  rougir: [
    { s: 'H', c: ['de plaisir', 'de joie'] },
    { s: 'fruit', c: ['au soleil'], l: ['dans le jardin'] }
  ],
  applaudir: [
    { s: 'H', c: ['les acrobates', 'le clown', 'très fort', 'le spectacle', 'les danseurs'] }
  ],
  bondir: [
    { s: 'K', c: ['de joie'] },
    { s: 'frog', l: ['dans la mare'], inv: 1 },
    { s: 'rabbit', c: ['hors du terrier'], l: ['dans l’herbe'] },
    { s: 'cat', c: ['sur la souris', 'sur le canapé'] },
    { s: 'fox', c: ['hors du bois', 'sur la poule'] }
  ],
  ralentir: [
    { s: 'car', c: ['au virage', 'devant l’école'] },
    { s: 'train', c: ['au virage', 'près de la gare'] },
    { s: 'bus', c: ['devant l’école', 'près de l’arrêt'] }
  ],
  fleurir: [
    { s: 'flower', l: ['dans le jardin', 'au bord du chemin'], inv: 1 }
  ],
  atterrir: [
    { s: 'plane', c: ['en douceur'], l: ['sur la piste'], inv: 1 },
    { s: 'balloon', c: ['en douceur'], l: ['dans le champ'], inv: 1 }
  ],
  nourrir: [
    { s: 'H', c: ['les poules', 'les lapins', 'le poisson rouge', 'les canards'] }
  ],
  franchir: [
    { s: 'horse', c: ['l’obstacle', 'la rivière', 'la barrière'] },
    { s: 'K', c: ['la ligne d’arrivée', 'le ruisseau'] }
  ],
  /* ----- 3e groupe (programme) ----- */
  faire: [
    { s: 'H', c: ['un gâteau', 'du vélo', 'un dessin', 'une cabane', 'du bruit', 'la cuisine', 'un puzzle', 'du cheval', 'un bonhomme de neige'] },
    { s: 'cat', c: ['la sieste'], l: ['sur le canapé', 'au soleil'] },
    { s: 'dog', c: ['des bêtises', 'le beau'] }
  ],
  aller: [
    { s: 'H', l: ['à l’école', 'à la piscine', 'au marché', 'au cinéma', 'chez le dentiste', 'à la plage', 'au zoo', 'à la ferme', 'au stade'], nopre: 1 },
    { s: 'horse', l: ['au pré', 'à l’écurie'], nopre: 1 }
  ],
  dire: [
    { s: 'H', c: ['bonjour', 'merci', 'la vérité', 'au revoir', 'un poème', 'bonne nuit'],
      d: ['« Bonne nuit ! »', '« Merci beaucoup ! »', '« Quelle belle journée ! »', '« C’est l’heure du goûter ! »'] }
  ],
  venir: [
    { s: 'H', l: ['à la fête', 'au spectacle', 'à la maison', 'au parc', 'à la piscine'], nopre: 1 },
    { s: 'bird', c: ['manger des graines'], l: ['sur le balcon'] }
  ],
  pouvoir: [
    { s: 'H', c: ['nager sans bouée', 'entrer', 'jouer dehors', 'gagner la course', 'monter à cheval', 'voir la mer'] },
    { s: 'bird', c: ['voler très haut'] }
  ],
  voir: [
    { s: 'H', c: ['un arc-en-ciel', 'la mer', 'un écureuil', 'des étoiles filantes', 'un château', 'les montagnes', 'un renard'] },
    { s: 'cat', c: ['une souris', 'un oiseau'] }
  ],
  vouloir: [
    { s: 'H', c: ['jouer dehors', 'aller à la plage', 'gagner'] },
    { s: 'H', c: ['un chaton', 'une glace', 'un vélo neuf'], once: 1 },
    { s: 'dog', c: ['sortir', 'une caresse', 'jouer'] }
  ],
  prendre: [
    { s: 'H', c: ['le bus', 'le train', 'une photo', 'un parapluie', 'le goûter', 'un bain'] },
    { s: 'cat', c: ['un bain de soleil'] }
  ],
  apprendre: [
    { s: 'K', c: ['une poésie', 'à nager', 'les tables de multiplication', 'une chanson', 'à lire', 'à faire du vélo'] }
  ],
  comprendre: [
    { s: 'H', c: ['la consigne', 'la règle du jeu', 'l’exercice', 'le problème', 'la blague'], once: 1 }
  ],
  devenir: [
    { s: 'caterpillar', c: [{ s: 'un papillon', p: 'des papillons' }], nocue: 1 },
    { s: 'tadpole', c: [{ s: 'une grenouille', p: 'des grenouilles' }], nocue: 1 },
    { s: [gn('le poulain', 'm', 's', { pl: 'les poulains' }), gn('les poulains', 'm', 'p')], c: [{ s: 'un beau cheval', p: 'de beaux chevaux' }], nocue: 1 }
  ],
  revenir: [
    { s: 'H', c: ['de la plage', 'du marché', 'de vacances', 'à la maison'] },
    { s: [gn('les hirondelles', 'f', 'p'), gn('l’hirondelle', 'f', 's', { pl: 'les hirondelles' })], l: ['dans le jardin', 'sous le toit'], inv: 1 }
  ],
  /* temps composés seulement (accord du participe avec être) */
  partir: [
    { s: 'H', c: ['en vacances', 'en voyage', 'tôt'], l: ['à la mer', 'à la montagne'], nopre: 1 },
    { s: ['train', 'boat', 'bus'], c: ['à l’heure', 'en retard'] }
  ],
  sortir: [
    { s: 'H', l: ['dans le jardin', 'du magasin', 'de la piscine', 'de la classe'], nopre: 1 },
    { s: 'horse', l: ['de l’écurie'], nopre: 1 },
    { s: 'fox', l: ['du terrier', 'de la forêt'], nopre: 1 }
  ]
};
/* questions avec sujet inversé (CM2) : sujet = GN ou prénom à la 3e personne */
const QUESTIONS = [
  { v: 'aller', q: 'Où', s: 'H' }, { v: 'faire', q: 'Que', s: 'H' }, { v: 'arriver', q: 'Quand', s: 'H' },
  { v: 'habiter', q: 'Où', s: 'H' }, { v: 'jouer', q: 'Avec qui', s: 'K' }, { v: 'chanter', q: 'Que', s: 'bird' },
  { v: 'nager', q: 'Où', s: 'duck' }, { v: 'venir', q: 'Quand', s: 'H' }, { v: 'dire', q: 'Que', s: 'H' },
  { v: 'voir', q: 'Que', s: 'H' }, { v: 'vouloir', q: 'Que', s: 'H' }, { v: 'prendre', q: 'Quel chemin', s: 'H' },
  { v: 'manger', q: 'Que', s: ['horse', 'rabbit'] }, { v: 'chercher', q: 'Que', s: ['dog', 'squirrel'] },
  { v: 'finir', q: 'Quand', s: 'show' }, { v: 'galoper', q: 'Où', s: 'horse' }, { v: 'habiter', q: 'Où', s: 'squirrel' },
  { v: 'commencer', q: 'Quand', s: 'show' }, { v: 'regarder', q: 'Que', s: 'H' }, { v: 'préparer', q: 'Que', s: 'A' },
  { v: 'apporter', q: 'Que', s: 'A' }, { v: 'choisir', q: 'Quel livre', s: 'K' }, { v: 'rentrer', q: 'Quand', s: 'H' },
  { v: 'arriver', q: 'À quelle heure', s: ['train', 'bus'] }
];
/* COD (participe passé avec avoir, pronom complément avant le verbe) :
   o = [GN démonstratif, genre, nombre, GN indéfini (COD placé après)] */
const COD = [
  { v: 'ramasser', s: 'H', o: [['ces feuilles', 'f', 'p', 'des feuilles'], ['ces marrons', 'm', 'p', 'des marrons'], ['ces coquillages', 'm', 'p', 'des coquillages'],
    ['cette pomme', 'f', 's', 'une pomme'], ['ce caillou', 'm', 's', 'un caillou'], ['ces châtaignes', 'f', 'p', 'des châtaignes']],
    l: ['dans le jardin', 'sur la plage', 'dans la forêt'] },
  { v: 'préparer', s: 'H', o: [['ces crêpes', 'f', 'p', 'des crêpes'], ['ce gâteau', 'm', 's', 'un gâteau'], ['cette tarte', 'f', 's', 'une tarte'],
    ['ces sandwichs', 'm', 'p', 'des sandwichs'], ['cette surprise', 'f', 's', 'une surprise']] },
  { v: 'dessiner', s: 'H', o: [['ces fleurs', 'f', 'p', 'des fleurs'], ['ce cheval', 'm', 's', 'un cheval'], ['cette maison', 'f', 's', 'une maison'],
    ['ces bateaux', 'm', 'p', 'des bateaux']] },
  { v: 'ranger', s: 'H', o: [['ces jouets', 'm', 'p', 'des jouets'], ['ces affaires', 'f', 'p', 'des affaires'], ['cette chambre', 'f', 's', 'une chambre'],
    ['ce placard', 'm', 's', 'un placard']] },
  { v: 'laver', s: 'H', o: [['ces assiettes', 'f', 'p', 'des assiettes'], ['ce pull', 'm', 's', 'un pull'], ['ces bottes', 'f', 'p', 'des bottes'],
    ['cette voiture', 'f', 's', 'une voiture']] },
  { v: 'trouver', s: 'H', o: [['ces clés', 'f', 'p', 'des clés'], ['ce trésor', 'm', 's', 'un trésor'], ['cette pièce', 'f', 's', 'une pièce'],
    ['ces champignons', 'm', 'p', 'des champignons']] },
  { v: 'oublier', s: 'H', o: [['ces lunettes', 'f', 'p', 'des lunettes'], ['ce parapluie', 'm', 's', 'un parapluie'], ['cette écharpe', 'f', 's', 'une écharpe'],
    ['ces gants', 'm', 'p', 'des gants']] },
  { v: 'apporter', s: 'H', o: [['ces fleurs', 'f', 'p', 'des fleurs'], ['ce gâteau', 'm', 's', 'un gâteau'], ['cette tarte', 'f', 's', 'une tarte'],
    ['ces cadeaux', 'm', 'p', 'des cadeaux']] },
  { v: 'manger', s: 'H', o: [['ces fraises', 'f', 'p', 'des fraises'], ['cette pomme', 'f', 's', 'une pomme'], ['ce croissant', 'm', 's', 'un croissant'],
    ['ces bonbons', 'm', 'p', 'des bonbons']] },
  { v: 'acheter', s: 'H', o: [['ces pommes', 'f', 'p', 'des pommes'], ['ce livre', 'm', 's', 'un livre'], ['cette glace', 'f', 's', 'une glace'],
    ['ces crayons', 'm', 'p', 'des crayons']] },
  { v: 'regarder', s: 'H', o: [['ces photos', 'f', 'p', 'des photos'], ['ce film', 'm', 's', 'un film'], ['ces étoiles', 'f', 'p', 'des étoiles'],
    ['cette émission', 'f', 's', 'une émission']] },
  { v: 'écouter', s: 'H', o: [['ces chansons', 'f', 'p', 'des chansons'], ['cette histoire', 'f', 's', 'une histoire'], ['ce conte', 'm', 's', 'un conte'],
    ['ces disques', 'm', 'p', 'des disques']] },
  { v: 'planter', s: 'H', o: [['ces tulipes', 'f', 'p', 'des tulipes'], ['ces arbres', 'm', 'p', 'des arbres'], ['cette graine', 'f', 's', 'une graine'],
    ['ce rosier', 'm', 's', 'un rosier']] },
  { v: 'arroser', s: 'H', o: [['ces fleurs', 'f', 'p', 'des fleurs'], ['ces tomates', 'f', 'p', 'des tomates'], ['ce rosier', 'm', 's', 'un rosier'],
    ['cette plante', 'f', 's', 'une plante']] },
  { v: 'nettoyer', s: 'H', o: [['ces bottes', 'f', 'p', 'des bottes'], ['ce tableau', 'm', 's', 'un tableau'], ['cette cage', 'f', 's', 'une cage'],
    ['ces vitres', 'f', 'p', 'des vitres']] },
  { v: 'envoyer', s: 'H', o: [['ces lettres', 'f', 'p', 'des lettres'], ['cette carte postale', 'f', 's', 'une carte postale'], ['ce colis', 'm', 's', 'un colis'],
    ['ces messages', 'm', 'p', 'des messages']] },
  { v: 'appeler', s: 'H', o: [['ces poules', 'f', 'p', 'des poules'], ['ce chien', 'm', 's', 'un chien'], ['cette jument', 'f', 's', 'une jument'],
    ['ces chats', 'm', 'p', 'des chats']] },
  { v: 'choisir', s: 'H', o: [['ces couleurs', 'f', 'p', 'des couleurs'], ['ce livre', 'm', 's', 'un livre'], ['cette robe', 'f', 's', 'une robe'],
    ['ces jeux', 'm', 'p', 'des jeux']] },
  { v: 'finir', s: 'H', o: [['ces crêpes', 'f', 'p', 'des crêpes'], ['ce puzzle', 'm', 's', 'un puzzle'], ['cette histoire', 'f', 's', 'une histoire'],
    ['ces exercices', 'm', 'p', 'des exercices']] },
  { v: 'remplir', s: 'H', o: [['ces bouteilles', 'f', 'p', 'des bouteilles'], ['ce seau', 'm', 's', 'un seau'], ['cette caisse', 'f', 's', 'une caisse'],
    ['ces paniers', 'm', 'p', 'des paniers']] },
  { v: 'faire', s: 'H', o: [['ces gâteaux', 'm', 'p', 'des gâteaux'], ['cette tarte', 'f', 's', 'une tarte'], ['ces crêpes', 'f', 'p', 'des crêpes'],
    ['ce dessin', 'm', 's', 'un dessin']] },
  { v: 'prendre', s: 'H', o: [['ces photos', 'f', 'p', 'des photos'], ['ce chemin', 'm', 's', 'un chemin'], ['cette route', 'f', 's', 'une route'],
    ['ces bonbons', 'm', 'p', 'des bonbons']] },
  { v: 'voir', s: 'H', o: [['ces étoiles', 'f', 'p', 'des étoiles'], ['ce film', 'm', 's', 'un film'], ['cette maison', 'f', 's', 'une maison'],
    ['ces oiseaux', 'm', 'p', 'des oiseaux']] },
  { v: 'dire', s: 'H', o: [['ces mots', 'm', 'p', 'des mots'], ['cette phrase', 'f', 's', 'une phrase'], ['ces paroles', 'f', 'p', 'des paroles'],
    ['ce poème', 'm', 's', 'un poème']] }
];

/* ============ INDICATEURS DE TEMPS ============ */
const CUES = {
  present: ['Maintenant', 'En ce moment', 'Aujourd’hui'],
  presentH: ['Chaque matin', 'Tous les jours', 'Le mercredi', 'D’habitude', 'Le dimanche'],
  imparfait: ['Autrefois', 'Il y a longtemps', 'À cette époque'],
  futur: ['Demain', 'Plus tard', 'La semaine prochaine', 'L’été prochain', 'Bientôt', 'Dans deux jours'],
  passe_compose: ['Hier', 'Hier soir', 'La semaine dernière', 'Dimanche dernier', 'L’an dernier'],
  passe_simple: ['Ce jour-là', 'Soudain', 'Tout à coup', 'Un matin', 'Le lendemain', 'Ce soir-là'],
  plus_que_parfait: ['La veille', 'Quelques jours plus tôt', 'Un peu plus tôt']
};
const PAST = ['imparfait', 'passe_compose', 'passe_simple', 'plus_que_parfait'];
/* temps compatibles avec chaque indicateur : un distracteur d'un autre temps n'est proposé que si
   l'indicateur l'exclut (la phrase avec le distracteur serait fausse même sans l'étiquette du temps) */
const CUE_OK = {
  'Maintenant': ['present', 'passe_compose'], 'En ce moment': ['present'], 'Aujourd’hui': ['present', 'passe_compose', 'futur'],
  'Chaque matin': ['present', 'imparfait', 'futur'], 'Tous les jours': ['present', 'imparfait', 'futur'],
  'Le mercredi': ['present', 'imparfait', 'futur'], 'D’habitude': ['present', 'imparfait'], 'Le dimanche': ['present', 'imparfait', 'futur'],
  'Autrefois': PAST, 'Il y a longtemps': PAST, 'À cette époque': ['imparfait', 'passe_simple', 'plus_que_parfait', 'passe_compose'],
  'Demain': ['futur', 'present'], 'Plus tard': ['futur'], 'La semaine prochaine': ['futur', 'present'],
  'L’été prochain': ['futur', 'present'], 'Bientôt': ['futur', 'present'], 'Dans deux jours': ['futur', 'present'],
  'Hier': PAST, 'Hier soir': PAST, 'La semaine dernière': PAST, 'Dimanche dernier': PAST, 'L’an dernier': PAST,
  'Ce jour-là': PAST, 'Soudain': ['passe_simple', 'passe_compose', 'present'], 'Tout à coup': ['passe_simple', 'passe_compose', 'present'],
  'Un matin': ['passe_simple', 'passe_compose', 'imparfait'], 'Le lendemain': [...PAST, 'futur'], 'Ce soir-là': PAST,
  'La veille': PAST, 'Quelques jours plus tôt': PAST, 'Un peu plus tôt': PAST
};

/* ============ CLASSES DE VERBES ============ */
const CLASS = {
  aux: ['être', 'avoir'],
  g1: ['jouer', 'chanter', 'danser', 'parler', 'aimer', 'regarder', 'marcher', 'sauter', 'donner', 'porter', 'chercher', 'trouver',
    'écouter', 'fermer', 'dessiner', 'préparer', 'raconter', 'ramasser', 'grimper', 'galoper', 'briller', 'laver', 'travailler',
    'apporter', 'crier', 'oublier', 'colorier', 'habiter', 'visiter', 'pleurer', 'souffler', 'sonner', 'voler', 'tourner', 'gagner',
    'garder', 'siffler', 'rouler', 'planter', 'arroser', 'miauler', 'cuisiner', 'demander', 'chuchoter', 'pousser', 'tirer',
    'brosser', 'caresser', 'rêver', 'arriver', 'entrer', 'tomber', 'rester', 'monter', 'rentrer'],
  g1var: ['manger', 'nager', 'ranger', 'partager', 'voyager', 'plonger', 'commencer', 'lancer', 'avancer', 'annoncer', 'appeler',
    'jeter', 'acheter', 'lever', 'promener', 'nettoyer', 'essuyer', 'aboyer', 'appuyer', 'envoyer'],
  irr: ['faire', 'aller', 'dire', 'venir', 'pouvoir', 'voir', 'vouloir', 'prendre'],
  g2: ['finir', 'choisir', 'grandir', 'réussir', 'remplir', 'obéir', 'rougir', 'applaudir', 'bondir', 'ralentir', 'fleurir',
    'atterrir', 'nourrir', 'franchir'],
  derived: ['apprendre', 'comprendre', 'devenir', 'revenir'],
  compound: ['partir', 'sortir']
};
const CLASS_OF = {};
for (const [c, list] of Object.entries(CLASS)) for (const v of list) CLASS_OF[v] = c;
const CLASS_WEIGHT = { aux: 1, g1: 1.6, g1var: 0.9, irr: 1.5, g2: 1.1, derived: 0.4, compound: 0.4 };
export const GEN_VERBS = Object.freeze(Object.keys(CLASS_OF));
const isLeitnerVerb = v => { const g = groupOf(v); return g === 0 || g === 3; };
const ETRE_PART_VERBS = GEN_VERBS.filter(v => isEtreVerb(v));

/* ============ OUTILS ============ */
const pickW = (rng, items, wf) => rng.weighted(items, items.map(wf));
const cap = s => capFirst(s);
const q = s => '« ' + s + ' »';
const uniq = arr => [...new Set(arr)];
const pronOfSubj = s => s.pron || (s.n === 'p' ? (s.g === 'f' ? 'elles' : 'ils') : (s.g === 'f' ? 'elle' : 'il'));
const personOf = s => s.p || (s.n === 'p' ? '3p' : '3s');
/* clé « sonore » : lettres muettes finales retirées (homophones joue/joues/jouent, allé/allées…) */
function soundKey(form, person) {
  return String(form).split(' ').map((w, i, a) => {
    let x = w;
    if (i === 0 && person === '3p' && a.length === 1 && x.endsWith('ent') && x.length > 4) x = x.slice(0, -3);
    x = x.replace(/[stxd]+$/, '');
    if (x.length > 2) x = x.replace(/e$/, '');
    return x;
  }).join(' ');
}
/* choix final entre candidats : très pointu (un item d'un demi-niveau trop facile pèse e^−2 ≈ 0,14) */
const levelW = (A, L) => (L > A + 1e-9 ? 0 : Math.exp(-(A - L) / 0.25));
/* tirage d'une notion (classe de verbe, temps, personne, structure) : favorise les notions qui arrivent
   près de A sans exclure les plus anciennes (plancher : variété, révisions) */
const W_NOTION = { floor: 0.15, tau: 0.45 }, W_CLASS = { floor: 0.3, tau: 0.6 }, W_STRUCT = { floor: 0.2, tau: 0.5 };
const nearW = (A, L, w = W_NOTION) => (L > A + 1e-9 ? 0 : w.floor + Math.exp(-(A - L) / w.tau));
/* candidats : 16 par tirage ; ceux de niveau < A − 0,6 sont écartés tant qu'il en reste */
const N_CANDIDATES = 16, NEAR_SPAN = 0.6;

/* ---------- groupes de sujets d'un cadre ---------- */
function poolOf(spec) {
  if (typeof spec === 'string' && HUMAN[spec]) return { humans: true, key: spec, gn: HUMAN[spec].gn, cdn: HUMAN[spec].cdn, names: HUMAN[spec].names };
  const keys = Array.isArray(spec) ? spec : [spec];
  const out = { humans: false, gn: [], cdn: [], names: false };
  for (const k of keys) {
    if (typeof k === 'string' && P[k]) { out.gn.push(...P[k].gn); if (P[k].cdn) out.cdn.push(...P[k].cdn); }
    else if (k && typeof k === 'object' && k.t) out.gn.push(k);
  }
  return out;
}
/* personnes possibles avec ce cadre */
function framePersons(frame) {
  const pool = poolOf(frame.s);
  /* adultes (A) : jamais « je » ni « tu » (c'est l'enfant qui lit) */
  const ps = pool.humans && pool.key !== 'A' ? PERSONS.slice() : ['3s', '3p'];
  return ps.filter(p => !frame.n || (frame.n === 'p' ? p.endsWith('p') : p.endsWith('s')))
    .filter(p => p.startsWith('3') ? pool.gn.some(x => x.n === p[1]) || pool.humans : true);
}

/* ---------- niveaux ---------- */
/* niveau d'arrivée de la forme d'un verbe (classe, temps, personne, variation du radical) */
function verbLevel(verb, tense, person) {
  const c = CLASS_OF[verb];
  if (!c) return Infinity;
  if (c === 'compound') return isCompound(tense) ? LEVELS.verb.compound : Infinity;
  if (c === 'g1var') {
    return isPlainForm(verb, tense, person) ? LEVELS.verb.g1 : Math.max(LEVELS.verb.g1var, LEVELS.variant[variantOf(verb)] || 0);
  }
  const vt = LEVELS.verbTense[c];
  if (!vt) return LEVELS.verb[c];
  const t = tense === 'plus_que_parfait' ? 'passe_compose' : tense;
  if (t === 'passe_simple' && verb !== 'aller') return Math.max(...Object.values(vt), LEVELS.psPerson[person] + LEVELS.psLate);
  const late = c === 'irr' && LEVELS.irrLate.verbs.includes(verb) ? LEVELS.irrLate.offset : 0;
  return Math.max(LEVELS.verb[c], (t in vt ? vt[t] : Math.max(...Object.values(vt))) + late);
}
function tenseLevel(tense, person) {
  return tense === 'passe_simple' ? LEVELS.psPerson[person] : LEVELS.tense[tense];
}
/* accord du participe avec être : masculin singulier dès le CE2, accord complet au CM1 */
function etreLevel(verb, tense, person, g) {
  if (!isEtreVerb(verb) || !isCompound(tense)) return 0;
  if (!person.startsWith('3')) return Infinity;            /* je/tu/nous/vous : genre inconnu → jamais */
  return person === '3s' && g !== 'f' ? LEVELS.etreMasc : LEVELS.etreFull;
}
/* niveau réel d'un item à partir de ses notions : forme du verbe (morph), construction de la phrase
   (syntax), accord du participe (agree), sous-type (task). Les deux notions de contenu les plus récentes
   se combinent (bonus si la deuxième est proche de la première). Arrondi par défaut au centième : item.A ≤ A. */
function itemLevel({ morph = 0, syntax = 0, agree = 0, task = 0 }) {
  const C = LEVELS.combo;
  const [top, second] = [morph, syntax, agree].sort((x, y) => y - x);
  const content = second >= C.min - 1e-9 ? top + C.bonus * clamp(1 - (top - second) / C.span, 0, 1) : top;
  return Math.floor(Math.max(content, task) * 100 + 1e-6) / 100;
}
/* notions d'un item ordinaire (partir et sortir : leur niveau tient à l'accord du participe) */
function levelParts(kind, verb, tense, person, struct, subj) {
  const compoundVerb = CLASS_OF[verb] === 'compound';
  return {
    morph: Math.max(tenseLevel(tense, person), compoundVerb ? 0 : verbLevel(verb, tense, person),
      kind === 'terminaison' && groupOf(verb) !== 1 ? LEVELS.verb.irr : 0),
    /* « Léa et Tom » : masculin et féminin mêlés, difficulté propre à l'accord du participe avec être */
    syntax: (LEVELS.struct[struct] || 0)
      + (subj && subj.mixed && isEtreVerb(verb) && isCompound(tense) ? LEVELS.struct.multiMixed - LEVELS.struct.multi : 0),
    agree: Math.max(etreLevel(verb, tense, person, subj ? subj.g : 'm'), compoundVerb ? LEVELS.verb.compound : 0),
    task: LEVELS.kind[kind]
  };
}
const specLevel = (kind, verb, tense, person, struct, subj) => itemLevel(levelParts(kind, verb, tense, person, struct, subj));
/* niveaux que peut atteindre la forme d'un verbe d'une classe pour un sous-type (calculés une fois) ;
   'terminaison' : seulement les temps et personnes découpables en tuiles */
const below = (xs, A) => xs.reduce((m, x) => (x <= A + 1e-9 && x > m ? x : m), 0);
const CLASS_LEVELS = new Map();
function classLevels(c, kind) {
  const k = c + '|' + (kind === 'terminaison' ? 't' : '*');
  if (!CLASS_LEVELS.has(k)) {
    const out = new Set();
    for (const v of CLASS[c]) for (const t of TENSES) for (const p of PERSONS) {
      if (kind === 'terminaison' && !stemEnding(v, t, p)) continue;
      const L = c === 'compound' ? (isCompound(t) ? Math.max(LEVELS.verb.compound, tenseLevel(t, p)) : Infinity)
        : Math.max(tenseLevel(t, p), verbLevel(v, t, p));
      if (Number.isFinite(L)) out.add(L);
    }
    CLASS_LEVELS.set(k, [...out].sort((x, y) => x - y));
  }
  return CLASS_LEVELS.get(k);
}
/* niveau le plus récent (≤ A) qu'atteint une classe de verbes pour ce sous-type */
const classTop = (c, A, kind) => below(classLevels(c, kind), A);
/* niveau le plus récent (≤ A) d'un verbe à un temps, toutes personnes confondues (−∞ si aucune) */
function tenseTop(verb, tense, A) {
  const compoundVerb = CLASS_OF[verb] === 'compound';
  let best = -Infinity;
  for (const p of PERSONS) {
    const L = Math.max(tenseLevel(tense, p), compoundVerb ? 0 : verbLevel(verb, tense, p));
    if (L <= A + 1e-9 && L > best) best = L;
  }
  return best;
}

/* ============ PHRASES ============ */
/* complément adapté au nombre */
const compText = (c, n) => (c && typeof c === 'object' ? (n === 'p' ? c.p : c.s) : c);
/* GN singulier → pluriel (passage au pluriel) */
function pluralOf(s) {
  if (s.kind === 'pron') return s.t === 'il' ? 'ils' : s.t === 'elle' ? 'elles' : s.t === 'je' ? 'nous' : s.t === 'tu' ? 'vous' : null;
  return s.pl || null;
}

/* construit un sujet : struct ∈ pron | name | gn | cdn | multi | multi2 ; person imposée */
function makeSubject(rng, frame, person, struct, opts = {}) {
  const pool = poolOf(frame.s);
  const wantN = person.endsWith('p') ? 'p' : 's';
  if (struct === 'pron' || !person.startsWith('3') && struct !== 'multi2') {
    if (!person.startsWith('3')) {
      const t = { '1s': 'je', '2s': 'tu', '1p': 'nous', '2p': 'vous' }[person];
      return { t, p: person, g: opts.g || (rng.chance(0.5) ? 'f' : 'm'), n: wantN, kind: 'pron', pron: t };
    }
    /* il/elle/ils/elles : genre d'un référent possible du groupe */
    const refs = pool.humans ? null : pool.gn.filter(x => x.n === wantN);
    let g = opts.g;
    if (!g) g = refs && refs.length ? rng.pick(refs).g : (rng.chance(0.5) ? 'f' : 'm');
    if (refs && !refs.some(x => x.g === g)) return null;
    const t = wantN === 'p' ? (g === 'f' ? 'elles' : 'ils') : (g === 'f' ? 'elle' : 'il');
    return { t, p: person, g, n: wantN, kind: 'pron', pron: t };
  }
  if (struct === 'name') {
    if (!pool.humans || !pool.names || wantN !== 's') return null;
    const cand = NAMES.filter(x => !opts.g || x.g === opts.g);
    const x = rng.pick(cand);
    return { t: x.t, p: person, g: x.g, n: 's', kind: 'name' };
  }
  if (struct === 'gn') {
    const cand = pool.gn.filter(x => x.n === wantN && (!opts.g || x.g === opts.g) && (!opts.needPl || x.pl));
    if (!cand.length) return null;
    const x = rng.pick(cand);
    return { t: x.t, p: person, g: x.g, n: x.n, kind: 'gn', pl: x.pl };
  }
  if (struct === 'cdn') {
    const cand = pool.cdn.filter(x => x.n === wantN && x.trap !== x.n && (!opts.g || x.g === opts.g));
    if (!cand.length) return null;
    const x = rng.pick(cand);
    return { t: x.t, p: person, g: x.g, n: x.n, kind: 'cdn', head: x.head, trap: x.trap };
  }
  if (struct === 'multi') {
    if (person !== '3p') return null;
    let a, b;
    if (pool.humans && pool.names && rng.chance(0.65)) {
      const pair = rng.sample(NAMES, 2);
      [a, b] = pair;
    } else {
      const sing = pool.gn.filter(x => x.n === 's');
      if (sing.length < 2) return null;
      [a, b] = rng.sample(sing, 2);
    }
    if (a.t === b.t) return null;
    const g = a.g === 'f' && b.g === 'f' ? 'f' : 'm';
    if (opts.g && opts.g !== g) return null;
    return { t: a.t + ' et ' + b.t, p: '3p', g, n: 'p', kind: 'multi', mixed: a.g !== b.g, parts: [a, b] };
  }
  if (struct === 'multi2') {
    if (!pool.humans || pool.key === 'A' || (person !== '1p' && person !== '2p')) return null;
    const other = rng.chance(0.5) ? rng.pick(NAMES) : rng.pick(KIDS.filter(x => x.n === 's'));
    const me = person === '1p' ? 'moi' : 'toi';
    const t = person === '1p' || rng.chance(0.5) ? other.t + ' et ' + me : me + ' et ' + other.t;      /* « Maya et moi » */
    return { t, p: person, g: 'm', n: 'p', kind: 'multi2', pron: person === '1p' ? 'nous' : 'vous' };
  }
  return null;
}

/* ============ CHOIX ============ */
/* formes d'un même temps pour d'autres personnes (avec le genre g pour les verbes avec être) */
function otherPersonForms(verb, tense, person, g) {
  const out = [];
  for (const p of PERSONS) {
    if (p === person) continue;
    const f = formOf(verb, tense, p, { g });
    if (f) out.push({ f, p, why: 'personne' });
  }
  return out;
}
/* homophones de la réponse parmi d'autres formes { f, p } */
function homophonesOf(answer, person, list) {
  const k = soundKey(answer, person);
  return list.filter(x => soundKey(x.f, x.p) === k).map(x => x.f);
}
/* fautes typiques (jamais une vraie forme du verbe) */
const CURATED = {
  faire: { present: [0, 0, 0, 0, 'faisez', 'faisent'], futur: ['fairai', 'fairas', 'faira', 'fairons', 'fairez', 'fairont'],
    passe_simple: [0, 0, 'faisa', 0, 0, 'faisèrent'] },
  dire: { present: [0, 0, 0, 0, 'disez', 0], passe_simple: [0, 0, 'disa', 0, 0, 'disèrent'] },
  aller: { present: [0, 0, 0, 0, 0, 'allent'], futur: ['allerai', 'alleras', 'allera', 'allerons', 'allerez', 'alleront'] },
  venir: { present: [0, 0, 0, 0, 0, 'venent'], futur: ['venirai', 'veniras', 'venira', 'venirons', 'venirez', 'veniront'],
    passe_simple: [0, 0, 'venit', 0, 0, 'venirent'] },
  pouvoir: { present: [0, 0, 0, 0, 0, 'pouvent'], futur: ['pouverai', 'pouveras', 'pouvera', 'pouverons', 'pouverez', 'pouveront'] },
  voir: { present: [0, 0, 0, 0, 0, 'voyent'], futur: ['voirai', 'voiras', 'voira', 'voirons', 'voirez', 'voiront'],
    passe_simple: [0, 0, 'voya', 0, 0, 'voyèrent'] },
  vouloir: { present: [0, 0, 0, 0, 0, 'voulent'], futur: ['voulerai', 'vouleras', 'voulera', 'voulerons', 'voulerez', 'vouleront'],
    passe_simple: [0, 0, 'voula', 0, 0, 'voulèrent'] },
  prendre: { present: [0, 0, 0, 'prendons', 'prendez', 'prendent'], passe_simple: [0, 0, 'prena', 0, 0, 'prenèrent'] }
};
const PP_ERR = { prendre: ['prit', 'pri'], faire: ['fais'], dire: ['dis'], pouvoir: ['pouvu'], apprendre: ['apprit'], comprendre: ['comprit'] };
function errorForms(verb, tense, person, g, A) {
  const out = [];
  const real = paradigm(verb);
  const add = (f, why) => { if (f && !real.has(f) && !out.some(o => o.f === f)) out.push({ f, why }); };
  const i = PERSONS.indexOf(person);
  const grp = groupOf(verb);
  if (!isCompound(tense)) {
    if (grp === 1 && variantOf(verb) && A >= LEVELS.verb.g1var) add(plainForm(verb, tense, person), 'radical');
    if (grp === 2 && A >= LEVELS.verb.g2) {
      const base = verb.slice(0, -2);
      if (tense === 'present' && i >= 3) add(base + ['', '', '', 'ons', 'ez', 'ent'][i], 'iss');
      if (tense === 'imparfait') add(base + ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'][i], 'iss');
      if (tense === 'passe_simple') add(base + ['ai', 'as', 'a', 'âmes', 'âtes', 'èrent'][i], 'ps');
    }
    const base3 = CURATED[verb] || null;
    if (base3 && base3[tense] && A >= LEVELS.verb.irr && (tense !== 'passe_simple' || A >= LEVELS.tense.passe_simple)) add(base3[tense][i] || null, 'irregulier');
    if (verb === 'apprendre' || verb === 'comprendre') {
      const pre = verb === 'apprendre' ? 'ap' : 'com';
      const b = CURATED.prendre[tense];
      if (b && b[i] && A >= LEVELS.verb.derived) add(pre + b[i], 'irregulier');
    }
  } else {
    const auxT = COMPOUND_TENSES[tense];
    const aux = simpleForm(auxOf(verb), auxT, person);
    const pp = pastParticiple(verb);
    if (isEtreVerb(verb) && A >= LEVELS.etreMasc) add(simpleForm('avoir', auxT, person) + ' ' + pp, 'auxiliaire');
    if (isEtreVerb(verb) && A >= LEVELS.etreFull && (g === 'f' || person.endsWith('p'))) add(aux + ' ' + pp, 'accord');
    if (grp === 1 && !isEtreVerb(verb) && A >= LEVELS.tense.passe_compose) add(aux + ' ' + verb, 'infinitif');
    if (PP_ERR[verb] && A >= LEVELS.verb.irr) for (const e of PP_ERR[verb]) add(aux + ' ' + e, 'participe');
  }
  return out;
}

/* choisit 3 distracteurs dans des réservoirs ordonnés ; contraintes : distincts, ≠ réponse, même
   classe d'élision que la réponse si besoin */
function pickDistractors(rng, answer, pools, opts = {}) {
  const chosen = [];
  /* « j’ai », « qu’ont », « l’appelle » : avec une réponse élidée, les distracteurs doivent l'être aussi */
  const ok = f => f && f !== answer && !chosen.includes(f) && (!opts.sameInitial || !startsWithVowel(answer) || startsWithVowel(f))
    && (!opts.exclude || !opts.exclude.has(f));
  for (const { list, max } of pools) {
    const cand = rng.shuffle(uniq(list.filter(ok)));
    for (const f of cand) {
      if (chosen.length >= 3) break;
      if (chosen.filter(c => list.includes(c)).length >= max) break;
      if (ok(f)) chosen.push(f);
    }
    if (chosen.length >= 3) break;
  }
  return chosen;
}
function shuffleChoices(rng, answer, distractors, labelOf = x => x) {
  return rng.shuffle([answer, ...distractors]).map(v => ({ label: frTypo(labelOf(v)), value: v }));
}

/* ============ TEXTES D'AIDE ============ */
const MODEL2 = ['grandir', 'finir', 'choisir'];
const modelVerb = (verb, list) => list.find(m => m !== verb);
const ENDINGS_PS1 = ['ai', 'as', 'a', 'âmes', 'âtes', 'èrent'];
const ENDINGS_PS2 = ['is', 'is', 'it', 'îmes', 'îtes', 'irent'];
const ENDINGS_IMP = ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'];
const ENDINGS_FUT = ['ai', 'as', 'a', 'ons', 'ez', 'ont'];
const PRON_OF = (person, g) => ({ '1s': 'je', '2s': 'tu', '3s': g === 'f' ? 'elle' : 'il', '1p': 'nous', '2p': 'vous',
  '3p': g === 'f' ? 'elles' : 'ils' }[person]);
/* pronom prêt à coller devant une forme (« j’ », « il »…) */
function pronounFor(person, g, form) {
  const p = person === '1s' ? (startsWithVowel(form) ? 'j’' : 'je') : PRON_OF(person, g);
  return p.endsWith('’') ? p : p + ' ';
}
/* ---------- indices : une STRATÉGIE en deux temps, jamais la réponse (revue D2-04) ----------
   (1) repérer le sujet et chercher le pronom qui le remplace (la question est posée à l'enfant) ;
   (2) rappeler le tableau COMPLET des terminaisons du temps, dans l'ordre je, tu, il, nous, vous, ils,
       ou la règle générale (temps composés, participe passé).
   Jamais la terminaison de la personne visée seule, jamais un modèle conjugué, jamais un des choix :
   aucun mot des indices n'est une forme conjuguée d'un verbe de la banque (« est », « a », « peut »,
   « trouve »…). La terminaison précise et la forme juste sont dans l'explication (endingFact). */
const dashList = ends => ends.map(e => '-' + e).join(', ');
const ASK_PRONOUN = 'Quel pronom le remplace ?';
const HEAD_RULE = 'Quel pronom remplace son mot principal ?';           /* complément du nom : le noyau commande l'accord */
/* (1) le sujet, selon la construction de la phrase ; codpron : { pro, cod } */
function subjectStep(spec, extra = {}) {
  const { subj, struct } = spec;
  const s = q(subj.t);
  const ask = subj.kind === 'pron' ? '' : ' ' + (subj.kind === 'cdn' ? HEAD_RULE : ASK_PRONOUN);
  switch (struct) {
    case 'inv': case 'invcdn': return 'Ici, le sujet se cache après le verbe : ' + s + '.' + ask;
    case 'q': case 'qcdn': return 'Dans cette question, le sujet se cache après le verbe : ' + s + '.' + ask;
    case 'dial': return 'Repère qui parle : le sujet se cache après le verbe (' + s + ').' + ask;
    case 'pluriel': return 'Au pluriel, ' + (spec.model.kind === 'pron' ? '' : 'le sujet ') + q(spec.model.t) + ' se transforme en ' + s + '.' + ask;
    case 'codpron': return 'Piège : ' + q(extra.pro) + ' remplace ' + q(extra.cod.t) + ', pas le sujet. Repère le sujet : ' + s + '.' + ask;
    default: return (subj.kind === 'multi' || subj.kind === 'multi2' ? 'Repère tout le sujet : ' : 'Repère le sujet : ') + s + '.' + ask;
  }
}
/* marques du présent d'un verbe irrégulier quand elles suivent le modèle -s/-x, -s/-x, -t/-d, -ons, -ez,
   -ent (prendre : -s, -s, -d, -ons, -ez, -ent) ; null sinon (être, avoir, aller, faire, dire : à réciter) */
const PRESENT_MARKS = [['s', 'x'], ['s', 'x'], ['t', 'd'], ['ons'], ['ez'], ['ent']];
function presentMarks(verb) {
  const marks = PERSONS.map((p, i) => PRESENT_MARKS[i].find(m => String(simpleForm(verb, 'present', p)).endsWith(m)) || null);
  return marks.every(Boolean) ? marks : null;
}
/* passé simple : -a (verbes en -er et aller), -i (2e groupe, faire, dire, voir, prendre…), -u, -in */
const ENDINGS_PS_U = ['us', 'us', 'ut', 'ûmes', 'ûtes', 'urent'];
const ENDINGS_PS_IN = ['ins', 'ins', 'int', 'înmes', 'întes', 'inrent'];
function psMarks(verb) {
  if (groupOf(verb) === 1 || verb === 'aller') return ENDINGS_PS1;
  if (['venir', 'devenir', 'revenir'].includes(verb)) return ENDINGS_PS_IN;
  if (['être', 'avoir', 'pouvoir', 'vouloir'].includes(verb)) return ENDINGS_PS_U;
  return ENDINGS_PS2;
}
/* tableau des terminaisons d'un temps simple pour ce verbe, dans l'ordre des personnes (null : à réciter) */
function endingTable(verb, tense) {
  const grp = groupOf(verb);
  if (tense === 'futur') return ENDINGS_FUT;
  if (tense === 'imparfait') return ENDINGS_IMP;
  if (tense === 'present') return grp === 1 ? ENDINGS.present1 : grp === 2 ? ENDINGS.present2 : presentMarks(verb);
  if (tense === 'passe_simple') return psMarks(verb);
  return null;
}
/* (2) le tableau complet du temps (« Au futur : -ai, -as, -a, -ons, -ez, -ont. ») ou la règle générale */
function tableStep(verb, tense, A) {
  if (isCompound(tense)) {
    const tn = tense === 'passe_compose' ? 'Au passé composé' : 'Au plus-que-parfait';
    const auxT = tense === 'passe_compose' ? 'au présent' : 'à l’imparfait';
    return tn + ' : auxiliaire ' + q(auxOf(verb)) + ' ' + auxT + ' + participe passé'
      + (isEtreVerb(verb) && A >= LEVELS.etreFull - 1e-9 ? ', accordé avec le sujet.' : '.');
  }
  const table = endingTable(verb, tense);
  if (!table) return q(cap(verb)) + ', verbe irrégulier : récite son ' + TENSE_LABEL[tense]
    + ' dans ta tête (je…, tu…, il…) et arrête-toi à la bonne personne.';
  const grp = groupOf(verb);
  const who = tense === 'futur' || tense === 'imparfait' ? ''
    : grp === 1 || (tense === 'passe_simple' && verb === 'aller') ? ', verbes en -er'
    : grp === 2 ? ', verbes comme ' + q(modelVerb(verb, MODEL2)) : ', ' + q(verb);
  return cap(TENSE_AT[tense]) + who + ' : ' + dashList(table) + '.';
}
/* futur à radical irrégulier (aller → ir-, faire → fer-, venir → viendr-…) : signalé, jamais donné */
function futurStemStep(verb, tense) {
  const grp = groupOf(verb);
  if (tense !== 'futur' || (grp !== 0 && grp !== 3)) return '';
  const st = simpleForm(verb, 'futur', '1s').slice(0, -2);
  return st !== (verb.endsWith('re') ? verb.slice(0, -1) : verb) ? ' Attention : au futur, ' + q(verb) + ' change de radical.' : '';
}
/* règle de variation du radical (CM1), rappelée pour le verbe à ce temps quelle que soit la personne */
function variantStep(verb, tense, A) {
  if (A < LEVELS.verb.g1var - 1e-9 || !variantOf(verb) || isCompound(tense) || PERSONS.every(p => isPlainForm(verb, tense, p))) return '';
  switch (variantOf(verb)) {
    case 'ger': return ' Verbes en -ger : on écrit ge devant a ou o (son « je »).';
    case 'cer': return ' Verbes en -cer : on écrit ç devant a ou o (son « se »).';
    case 'll': case 'tt': return ' ' + q(cap(verb)) + ' double sa consonne devant un e muet et au futur.';
    case 'è': return ' Le e du radical se change en è devant un e muet et au futur.';
    case 'yer': return ' Le y se change en i devant un e muet et au futur.';
    case 'envoyer': return tense === 'futur' ? ' Attention : au futur, ' + q('envoyer') + ' change de radical.' : ' Le y se change en i devant un e muet.';
    default: return '';
  }
}
/* indice des sous-types 'forme' et 'accord' */
function formHint(spec, A, extra) {
  const { verb, tense } = spec;
  return frTypo(subjectStep(spec, extra) + ' ' + tableStep(verb, tense, A) + futurStemStep(verb, tense) + variantStep(verb, tense, A));
}
/* explication : le lien sujet → pronom et la terminaison précise de la personne visée */
function pronounBridge(subj) {
  return subj.kind === 'pron' ? '' : ' ' + q(cap(subj.t)) + ', c’est ' + q(pronOfSubj(subj)) + '.';
}
function endingFact(verb, tense, person, g) {
  const pr = q(PRON_OF(person, g));
  if (isCompound(tense)) {                          /* temps composé : la forme précise de l'auxiliaire */
    const r = conjugate(verb, tense, person, { g });
    return ' Avec ' + pr + ', l’auxiliaire ' + q(auxOf(verb)) + ' ' + (tense === 'passe_compose' ? 'au présent' : 'à l’imparfait')
      + ' donne ' + q(r.aux) + '.';
  }
  const table = endingTable(verb, tense);
  if (!table) return '';
  return ' ' + cap(TENSE_AT[tense]) + ', avec ' + pr + ', le verbe se termine par -' + table[PERSONS.indexOf(person)] + '.';
}
/* explication des variations du radical (CM1) */
function variantNote(verb, tense, person) {
  if (isPlainForm(verb, tense, person)) return '';
  switch (variantOf(verb)) {
    case 'ger': return ' Avec les verbes en -ger, on ajoute un e devant a ou o pour garder le son « je ».';
    case 'cer': return ' Avec les verbes en -cer, on met une cédille sous le c devant a ou o pour garder le son « se ».';
    case 'll': case 'tt': return ' Devant un e muet (et au futur), ' + q(verb) + ' double sa consonne.';
    case 'è': return ' Devant un e muet (et au futur), le e du radical devient è.';
    case 'yer': return ' Devant un e muet (et au futur), le y devient i.';
    case 'envoyer': return tense === 'futur' ? ' Au futur, ' + q('envoyer') + ' devient ' + q('enverr-') + '.' : ' Devant un e muet, le y devient i.';
    default: return '';
  }
}
/* forme irrégulière à retenir (3e groupe, être, avoir) */
function isIrregularForm(verb, tense, person) {
  const grp = groupOf(verb);
  if (isCompound(tense) || grp === 1 || grp === 2) return false;
  if (tense === 'futur' || tense === 'imparfait') return false;
  const i = PERSONS.indexOf(person);
  const f = simpleForm(verb, tense, person);
  if (tense === 'present') return !([/[sx]$/, /[sx]$/, /[td]$/, /ons$/, /ez$/, /ent$/][i].test(f));
  return false;
}
/* « Les enfants joueront », « J’ai mangé », « La fermière les appelle » */
function clause(s, form, verbPre = '') {
  let st = s.t;
  const head = verbPre || form;
  if (st === 'je' && startsWithVowel(head)) st = 'j’';
  const sp = st.endsWith('’') ? '' : ' ';
  const vp = verbPre ? (verbPre.endsWith('’') ? verbPre : verbPre + ' ') : '';
  return cap(st + sp + vp + form);
}

/* ============ TIRAGE DU CONTENU ============ */
/* une « spec » décrit le contenu d'un item ; L = niveau réel (max des niveaux d'introduction) */
function availableKinds(A) { return KINDS.filter(k => LEVELS.kind[k] <= A + 1e-9); }

function tensesFor(verb, kind, A) {
  return TENSES.filter(t => {
    if (CLASS_OF[verb] === 'compound' && !isCompound(t)) return false;
    if (LEVELS.tense[t] > A + 1e-9) return false;
    if (tenseTop(verb, t, A) === -Infinity) return false;     /* ex. irréguliers au futur avant 2,5 */
    if (kind === 'terminaison') {
      if (t === 'plus_que_parfait') return false;
      return PERSONS.some(p => stemEnding(verb, t, p));
    }
    if (kind === 'participe') return isCompound(t);
    return true;
  });
}
const STRUCTS = {
  forme: ['pron', 'name', 'gn', 'pre', 'multi', 'dial', 'multi2'],
  terminaison: ['pron', 'name', 'gn', 'pre', 'multi2'],
  temps: ['pron', 'name', 'gn', 'pre', 'cdn', 'inv', 'dial'],
  accord: ['gn', 'name', 'pron', 'pre', 'pluriel', 'cdn', 'multi', 'inv', 'dial', 'multi2', 'invcdn'],
  sujet: ['pron', 'name', 'gn', 'pre', 'multi'],
  participe: ['pron', 'name', 'gn', 'multi', 'pre', 'cdn']
};
const DIAL_TENSES = ['present', 'imparfait', 'passe_simple', 'passe_compose'];   /* « … » dit-il / disait-il / a-t-il dit */
const hasObjComp = frame => (frame.c || []).some(c => c && typeof c === 'object');
function structOk(struct, frame, person) {
  const pool = poolOf(frame.s);
  const third = person.startsWith('3');
  const nn = person[1];
  switch (struct) {
    case 'pron': return true;
    case 'name': return pool.humans && pool.names && person === '3s';
    case 'gn': return third && pool.gn.some(x => x.n === nn);
    case 'pre': return !!(frame.l && frame.l.length) && !frame.nopre;
    case 'pluriel': return person === '3p' && !hasObjComp(frame) && (pool.humans || pool.gn.some(x => x.n === 's' && x.pl));
    case 'cdn': return third && pool.cdn.some(x => x.n === nn && x.trap !== x.n);
    case 'multi': return person === '3p' && (pool.humans ? pool.names : pool.gn.filter(x => x.n === 's').length >= 2);
    case 'inv': return third && !!frame.inv && !!(frame.l && frame.l.length) && (pool.gn.some(x => x.n === nn) || (pool.names && nn === 's'));
    case 'invcdn': return third && !!frame.inv && !!(frame.l && frame.l.length) && pool.cdn.some(x => x.n === nn && x.trap !== x.n);
    case 'dial': return third && !!(frame.d && frame.d.length);       /* temps limités dans randomSpec */
    case 'multi2': return pool.humans && pool.key !== 'A' && (person === '1p' || person === '2p');
    default: return false;
  }
}

function randomSpec(A, rng, kind) {
  if (kind === 'participe') return participeSpec(A, rng);
  if (kind === 'accord' && A >= LEVELS.struct.codpron - 1e-9 && rng.chance(0.12)) return codSpec(A, rng, 'codpron');
  if ((kind === 'accord' || kind === 'temps') && A >= LEVELS.struct.q - 1e-9 && rng.chance(0.14)) return questionSpec(A, rng, kind);
  const structs = STRUCTS[kind];
  /* classe de verbe, puis verbe */
  const classes = Object.keys(CLASS).filter(c => {
    if (A < 1 - 1e-9) return c === 'aux';
    if (c === 'compound') return A >= LEVELS.verb.compound - 1e-9 && kind !== 'terminaison' && kind !== 'sujet';
    if (c === 'g1var') return true;                       /* formes régulières dès le CE1, variations au CM1 */
    return LEVELS.verb[c] <= A + 1e-9;
  });
  if (!classes.length) return null;
  /* chaque notion est tirée en favorisant celles qui arrivent près de A (calibrage, revue D2-02) */
  const cls = pickW(rng, classes, c => CLASS_WEIGHT[c] * (c === 'g1var' && A < LEVELS.verb.g1var ? 0.5 : 1)
    * (c === 'aux' && A >= LEVELS.verb.irr ? 0.6 : 1) * nearW(A, classTop(c, A, kind), W_CLASS));
  const verb = cls === 'g1var' && A >= LEVELS.verb.g1var - 1e-9
    ? pickW(rng, CLASS.g1var, v => nearW(A, below([LEVELS.verb.g1, LEVELS.variant[variantOf(v)]], A), W_CLASS))
    : rng.pick(CLASS[cls]);
  const frames = FR[verb] || [];
  if (!frames.length) return null;
  const frame = rng.pick(frames);
  const tenses = tensesFor(verb, kind, A).filter(t => !frame.t || frame.t.includes(t));
  if (!tenses.length) return null;
  const tense = pickW(rng, tenses, t => nearW(A, tenseTop(verb, t, A)));
  let persons = framePersons(frame).filter(p => tenseLevel(tense, p) <= A + 1e-9 && verbLevel(verb, tense, p) <= A + 1e-9);
  if (isEtreVerb(verb) && isCompound(tense)) persons = persons.filter(p => p.startsWith('3') && (A >= LEVELS.etreFull - 1e-9 || p === '3s'));
  if (kind === 'terminaison') {
    /* CE1 : radical et terminaison du 1er groupe ; CE2 : « d'un verbe conjugué au programme » */
    if (groupOf(verb) !== 1 && A < LEVELS.verb.irr - 1e-9) return null;
    persons = persons.filter(p => stemEnding(verb, tense, p));
  }
  if (!persons.length) return null;
  const person = pickW(rng, persons, p => (p === '3p' ? 1.5 : p === '3s' ? 1.3 : 1)
    * nearW(A, Math.max(tenseLevel(tense, p), verbLevel(verb, tense, p))));
  /* structure de la phrase */
  let cand = structs.filter(s => LEVELS.struct[s] <= A + 1e-9 && structOk(s, frame, person)
    && (s !== 'dial' || DIAL_TENSES.includes(tense)));
  if (A < 1 - 1e-9) cand = cand.filter(s => s === 'pron');
  if (!cand.length) return null;
  const struct = pickW(rng, cand, s => (kind === 'accord' && s === 'pron' ? 0.5 : 1) * nearW(A, LEVELS.struct[s], W_STRUCT));
  /* participe avec être avant le CM1 : masculin singulier seulement */
  const gOpt = isEtreVerb(verb) && isCompound(tense) && A < LEVELS.etreFull - 1e-9 ? 'm' : null;
  let subj, model = null;
  if (struct === 'pluriel') {
    model = makeSubject(rng, frame, '3s', rng.chance(0.25) ? 'pron' : (poolOf(frame.s).humans && rng.chance(0.3) ? 'gn' : 'gn'), { g: gOpt, needPl: true });
    const pt = model ? pluralOf(model) : null;
    if (!pt) return null;
    subj = { t: pt, p: '3p', g: model.g, n: 'p', kind: model.kind === 'pron' ? 'pron' : 'gn', pron: model.kind === 'pron' ? pt : undefined };
  } else if (struct === 'invcdn') subj = makeSubject(rng, frame, person, 'cdn', { g: gOpt });
  else if (struct === 'inv' || struct === 'dial') {
    const pool = poolOf(frame.s);
    const useName = person === '3s' && pool.humans && pool.names && (rng.chance(0.3) || !pool.gn.some(x => x.n === 's'));
    subj = makeSubject(rng, frame, person, useName ? 'name' : 'gn', { g: gOpt });
  } else subj = makeSubject(rng, frame, person, struct, { g: gOpt });
  if (!subj) return null;
  const realPerson = personOf(subj);
  if (tenseLevel(tense, realPerson) > A + 1e-9 || verbLevel(verb, tense, realPerson) > A + 1e-9) return null;
  if (isEtreVerb(verb) && isCompound(tense) && !realPerson.startsWith('3')) return null;
  const L = specLevel(kind, verb, tense, realPerson, struct, subj);
  if (!(L <= A + 1e-9)) return null;
  return { kind, verb, tense, person: realPerson, g: subj.g, frame, struct, subj, model, L };
}

/* participe passé : avec être (CM1) ou avec avoir et COD (CM2) */
function participeSpec(A, rng) {
  if (A >= LEVELS.cod - 1e-9 && rng.chance(0.5)) return codSpec(A, rng, 'participe');
  const verb = rng.pick(ETRE_PART_VERBS);
  const frames = FR[verb].filter(f => framePersons(f).some(p => p.startsWith('3')) && !f.t);
  if (!frames.length) return null;
  const frame = rng.pick(frames);
  const tenses = ['passe_compose', 'plus_que_parfait'].filter(t => LEVELS.tense[t] <= A + 1e-9 && tenseTop(verb, t, A) > -Infinity);
  if (!tenses.length) return null;
  const tense = pickW(rng, tenses, t => nearW(A, tenseTop(verb, t, A)));
  const person = rng.pick(framePersons(frame).filter(p => p.startsWith('3')));
  const cand = STRUCTS.participe.filter(s => LEVELS.struct[s] <= A + 1e-9 && structOk(s, frame, person));
  if (!cand.length) return null;
  const struct = pickW(rng, cand, s => nearW(A, LEVELS.struct[s], W_STRUCT));
  const subj = makeSubject(rng, frame, person, struct);
  if (!subj) return null;
  if (subj.mixed && A < LEVELS.struct.multiMixed - 1e-9) return null;
  const parts = levelParts('participe', verb, tense, person, struct, subj);
  const L = itemLevel(Object.assign(parts, { agree: Math.max(parts.agree, LEVELS.kind.participe) }));
  if (!(L <= A + 1e-9)) return null;
  return { kind: 'participe', verb, tense, person, g: subj.g, frame, struct, subj, L, mode: 'etre' };
}

function questionSpec(A, rng, kind) {
  const Q = rng.pick(QUESTIONS);
  const verb = Q.v;
  const tenses = tensesFor(verb, kind, A);
  if (!tenses.length) return null;
  const tense = pickW(rng, tenses, t => nearW(A, tenseTop(verb, t, A)));
  const frame = { s: Q.s };
  const pool = poolOf(Q.s);
  const persons = ['3s', '3p'].filter(p => (pool.gn.some(x => x.n === p[1]) || (p === '3s' && pool.names))
    && tenseLevel(tense, p) <= A + 1e-9 && verbLevel(verb, tense, p) <= A + 1e-9);
  if (!persons.length) return null;
  const person = rng.pick(persons);
  const useCdn = A >= LEVELS.struct.qcdn - 1e-9 && rng.chance(0.4) && pool.cdn.some(x => x.n === person[1] && x.trap !== x.n);
  const struct = useCdn ? 'qcdn' : 'q';
  const useName = person === '3s' && pool.names && (rng.chance(0.35) || !pool.gn.some(x => x.n === 's'));
  const subj = makeSubject(rng, frame, person, useCdn ? 'cdn' : useName ? 'name' : 'gn');
  if (!subj) return null;
  const L = specLevel(kind, verb, tense, person, struct, subj);
  if (!(L <= A + 1e-9)) return null;
  return { kind, verb, tense, person, g: subj.g, frame, struct, subj, L, question: Q };
}

/* participe avec avoir (mode 'participe') ou pronom COD avant le verbe (mode 'codpron', accord) */
function codSpec(A, rng, mode, fixed = null) {
  const C = fixed ? fixed.C : rng.pick(COD);
  const verb = C.v;
  const o = fixed ? fixed.o : rng.pick(C.o);
  const frame = { s: C.s, l: C.l };
  if (mode === 'participe') {
    const tense = fixed ? fixed.tense
      : pickW(rng, ['passe_compose', 'plus_que_parfait'].filter(t => LEVELS.tense[t] <= A + 1e-9), t => nearW(A, LEVELS.tense[t]));
    const after = fixed ? fixed.after : A >= LEVELS.codAfter - 1e-9 && rng.chance(0.35);
    const person = after ? rng.pick(['3s', '3p']) : rng.pick(PERSONS);
    const st = person.startsWith('3') ? rng.pick(['pron', 'gn', 'gn', 'name']) : 'pron';
    const subj = makeSubject(rng, frame, person, st) || makeSubject(rng, frame, person, 'pron');
    if (!subj) return null;
    if (after && !(subj.g === 'f' || subj.n === 'p')) return null;      /* piège : sujet féminin ou pluriel */
    const p = personOf(subj);
    /* la place du COD est la construction de la phrase ; la forme du verbe, le temps de l'auxiliaire */
    const L = itemLevel({ morph: Math.max(tenseLevel(tense, p), verbLevel(verb, tense, p)), syntax: after ? LEVELS.codAfter : LEVELS.cod,
      task: LEVELS.kind.participe });
    if (!fixed && !(L <= A + 1e-9)) return null;
    return { kind: 'participe', verb, tense, person: p, g: subj.g, frame, struct: 'cod', subj, L, mode: after ? 'apres' : 'cod',
      cod: { t: o[0], g: o[1], n: o[2], indef: o[3] } };
  }
  /* codpron : temps simples, sujet de nombre opposé au COD */
  const person = o[2] === 'p' ? '3s' : '3p';
  const tenses = ['present', 'imparfait', 'futur'].filter(t => LEVELS.tense[t] <= A + 1e-9 && verbLevel(verb, t, person) <= A + 1e-9);
  if (!tenses.length) return null;
  const tense = pickW(rng, tenses, t => nearW(A, Math.max(LEVELS.tense[t], verbLevel(verb, t, person))));
  const subj = makeSubject(rng, frame, person, person === '3s' && rng.chance(0.4) ? 'name' : 'gn');
  if (!subj) return null;
  const L = itemLevel({ morph: Math.max(tenseLevel(tense, person), verbLevel(verb, tense, person)), syntax: LEVELS.struct.codpron,
    task: LEVELS.kind.accord });
  if (!(L <= A + 1e-9)) return null;
  return { kind: 'accord', verb, tense, person, g: subj.g, frame, struct: 'codpron', subj, L, cod: { t: o[0], g: o[1], n: o[2] } };
}

/* ============ CONSTRUCTION DES ITEMS ============ */
function keyOf(spec) {
  if (spec.kind === 'participe' && (spec.mode === 'cod' || spec.mode === 'apres')) {
    return KEY + 'cod|' + spec.verb + '|' + spec.tense + '|' + (spec.mode === 'apres' ? 'apres' : spec.cod.g + spec.cod.n);
  }
  const gPart = isEtreVerb(spec.verb) && isCompound(spec.tense) ? '|' + (spec.g === 'f' ? 'f' : 'm') : '';
  return KEY + (spec.kind === 'temps' ? 'temps|' : '') + spec.verb + '|' + spec.tense + '|' + spec.person + gPart;
}

/* indicateur de temps (ou null) */
function pickCue(rng, spec, prob) {
  if (spec.frame.nocue) return null;
  if (!['pron', 'name', 'gn', 'cdn', 'multi', 'multi2', 'pluriel'].includes(spec.struct)) return null;
  if (!rng.chance(prob)) return null;
  const t = spec.tense;
  let list = (CUES[t] || []).slice();
  if (t === 'present' && !spec.frame.once) list = list.concat(CUES.presentH);
  if (!list.length) return null;
  /* verbe d'état : pas d'évènement soudain */
  if (spec.frame.state) list = list.filter(c => !['Soudain', 'Tout à coup', 'Un matin'].includes(c)).concat(t === 'passe_simple' ? ['À cette époque'] : []);
  /* passé simple : de préférence un indicateur qui exclut l'imparfait (la confusion à travailler) */
  else if (t === 'passe_simple' && rng.chance(0.6)) list = ['Soudain', 'Tout à coup'];
  return list.length ? rng.pick(list) : null;
}

/* description de la phrase (avant typographie) : ordre sujet-verbe ('sv') ou verbe-sujet ('vs') */
function buildSentence(rng, spec, cue) {
  const { subj, frame } = spec;
  const s = { subjTxt: subj.t, subjElide: subj.t === 'je' ? 'j’' : null, order: 'sv', lead: '', after: '', end: '.', dial: null };
  if (spec.struct === 'q' || spec.struct === 'qcdn') {
    Object.assign(s, { order: 'vs', head: spec.question.q, elideHead: spec.question.q === 'Que' ? 'Qu’' : null, end: ' ?' });
    return s;
  }
  if (spec.struct === 'inv' || spec.struct === 'invcdn') {
    Object.assign(s, { order: 'vs', head: cap(rng.pick(frame.l)) });
    return s;
  }
  if (spec.struct === 'dial') {
    const quote = rng.pick(frame.d);
    Object.assign(s, { order: 'vs', head: quote, dial: quote });
    return s;
  }
  const n = subj.n;
  const cs = (frame.c || []).map(c => compText(c, n)).filter(Boolean);
  const ls = frame.l || [];
  if (spec.struct === 'pre' && ls.length) {
    s.lead = cap(rng.pick(ls)) + ',';
    if (cs.length) s.after = rng.pick(cs);
    return s;
  }
  const c = cs.length ? rng.pick(cs) : '';
  const l = ls.length ? rng.pick(ls) : '';
  s.after = c && l ? (rng.chance(0.35) ? c + ' ' + l : c) : (c || l);
  if (cue) s.lead = cue + ',';
  return s;
}
/* typographie + capitale initiale */
function finalize(before, after) {
  return { before: frTypo(before ? cap(before) : ''), after: frTypo(after) };
}
/* phrase → { before, after } avec le trou sur le verbe ; verbPre = texte collé avant le trou
   (auxiliaire pour le participe et les tuiles du passé composé) */
function verbSlot(sent, form, verbPre = '') {
  if (sent.order === 'vs') {
    const head = sent.elideHead && startsWithVowel(verbPre || form) ? sent.elideHead : sent.head + ' ';
    return finalize(head + (verbPre ? verbPre + ' ' : ''), ' ' + sent.subjTxt + (sent.after ? ' ' + sent.after : '') + sent.end);
  }
  const lead = sent.lead ? sent.lead + ' ' : '';
  let st = sent.subjTxt;
  if (sent.subjElide && startsWithVowel(verbPre || form)) st = sent.subjElide;
  const sep = st.endsWith('’') ? '' : ' ';
  const pre = verbPre ? (verbPre.endsWith('’') ? verbPre : verbPre + ' ') : '';
  return finalize(lead + st + sep + pre, (sent.after ? ' ' + sent.after : '') + sent.end);
}
/* position du sujet dans la phrase complète */
function subjSpan(full, subj, from = 0) {
  for (const t of uniq([subj.t, subj.t === 'je' ? 'j’' : null].filter(Boolean))) {
    const i = full.toLowerCase().indexOf(t.toLowerCase(), from);
    if (i >= 0) return [i, i + t.length];
  }
  return null;
}
function baseData(spec, sentence, extra = {}) {
  return Object.assign({
    sentence, verb: spec.verb, tense: spec.tense, tenseLabel: TENSE_LABEL[spec.tense], person: spec.person,
    subject: spec.subj.t, g: spec.g, structure: spec.struct, level: spec.L,
    cue: '(' + spec.verb + ', ' + TENSE_LABEL[spec.tense] + ')'
  }, extra);
}
function itemBase(spec) {
  return { axis, kind: spec.kind, key: keyOf(spec), A: Math.round(clamp(spec.L, 0, A_MAX) * 100) / 100, leitner: isLeitnerVerb(spec.verb) };
}
/* réservoirs de distracteurs communs : autres personnes (homophones d'abord), genre, fautes typiques */
function formPools(verb, tense, person, g, answer, A) {
  const others = otherPersonForms(verb, tense, person, g);
  return {
    same: others.map(x => x.f),
    homo: homophonesOf(answer, person, others),
    gender: isEtreVerb(verb) && isCompound(tense) && A >= LEVELS.etreFull - 1e-9 ? [formOf(verb, tense, person, { g: g === 'f' ? 'm' : 'f' })] : [],
    errs: errorForms(verb, tense, person, g, A)
  };
}

/* ---------- forme ---------- */
function buildForme(rng, spec, A) {
  const { verb, tense, person, g, subj } = spec;
  const answer = formOf(verb, tense, person, { g });
  const cue = pickCue(rng, spec, 0.65);
  const sent = buildSentence(rng, spec, cue);
  const pools = formPools(verb, tense, person, g, answer, A);
  const cueOk = cue ? CUE_OK[cue] : [tense];
  const otherT = TENSES.filter(t => t !== tense && !cueOk.includes(t) && tenseLevel(t, person) <= A + 1e-9
    && verbLevel(verb, t, person) <= A + 1e-9 && !(isEtreVerb(verb) && isCompound(t) && etreLevel(verb, t, person, g) > A + 1e-9))
    .map(t => formOf(verb, t, person, { g }));
  const errs = pools.errs.map(x => x.f);
  const needInitial = (sent.order === 'sv' && subj.t === 'je') || !!sent.elideHead;
  const distract = pickDistractors(rng, answer, [
    { list: pools.homo, max: 2 }, { list: pools.gender, max: 1 }, { list: errs, max: 1 }, { list: otherT, max: 1 },
    { list: pools.same, max: 3 }, { list: [...otherT, ...errs], max: 3 }
  ], { sameInitial: needInitial });
  if (distract.length < 3) return null;
  const sentence = verbSlot(sent, answer);
  const full = sentence.before + answer + sentence.after;
  const choices = shuffleChoices(rng, answer, distract);
  const hint = formHint(spec, A);
  const r = conjugate(verb, tense, person, { g });
  const comp = isCompound(tense) ? ' (auxiliaire ' + q(auxOf(verb)) + ' ' + (tense === 'passe_compose' ? 'au présent' : 'à l’imparfait')
    + ' + participe passé ' + q(r.participle) + ')' : '';
  const note = isIrregularForm(verb, tense, person) ? ' C’est une forme irrégulière à retenir.' : variantNote(verb, tense, person);
  const explain = frTypo(clause(subj, answer) + ' : ' + q(verb) + ' ' + TENSE_AT[tense] + ', ' + PERSON_LABEL[person] + comp + '.'
    + pronounBridge(subj) + endingFact(verb, tense, person, g) + note);
  return Object.assign(itemBase(spec), {
    prompt: frTypo('Conjugue le verbe ' + TENSE_AT[tense] + '.'), answer, choices, hint, explain,
    data: baseData(spec, sentence, { form: answer, full, indicator: cue, dialogue: sent.dial,
      subjectSpan: subjSpan(full, subj, sent.order === 'vs' ? sentence.before.length + answer.length : 0) })
  });
}

/* ---------- terminaison ---------- */
function buildTerminaison(rng, spec, A) {
  const { verb, tense, person, g, subj } = spec;
  const se = stemEnding(verb, tense, person);
  if (!se) return null;
  const form = formOf(verb, tense, person, { g });
  const cue = pickCue(rng, spec, 0.6);
  const sent = buildSentence(rng, spec, cue);
  const answer = se.ending;
  const compound = isCompound(tense);
  const grp = groupOf(verb);
  let distract, aux = '';
  if (compound) {
    aux = conjugate(verb, tense, person, { g }).aux;
    distract = grp === 1
      ? pickDistractors(rng, answer, [{ list: ['er', 'ez'], max: 2 }, { list: ['ait', 'ais', 'ent'], max: 3 }])
      : pickDistractors(rng, answer, [{ list: ['is', 'it'], max: 2 }, { list: ['ir', 'issent'], max: 3 }]);
  } else {
    const ends = endingsFor(verb, tense);
    const i = PERSONS.indexOf(person);
    const others = ends.map((e, j) => ({ f: se.stem + e, p: PERSONS[j], e })).filter((x, j) => j !== i && x.e !== answer);
    const homo = homophonesOf(form, person, others).map(f => f.slice(se.stem.length));
    distract = pickDistractors(rng, answer, [{ list: homo, max: 2 }, { list: others.map(x => x.e), max: 3 }]);
  }
  if (distract.length < 3) return null;
  /* le jeu affiche : avant + radical + [terminaison] + après */
  const sentence = verbSlot(sent, form, aux);
  const full = sentence.before + se.stem + answer + sentence.after;
  const choices = rng.shuffle([answer, ...distract]).map(v => ({ label: '-' + v, value: v }));
  /* indice : jamais la tuile juste ni un modèle conjugué ; temps simples : sujet + tableau complet */
  const hint = compound
    ? 'Après l’auxiliaire ' + q(aux) + ', on écrit le participe passé (pas l’infinitif). ' + (grp === 1
      ? 'Astuce : remplace le verbe par ' + q('vendre') + ' ou ' + q('vendu') + ' : lequel convient ?'
      : 'Astuce : mets-le au féminin dans ta tête ; entends-tu un « s » ou un « t » à la fin ?')
    : subjectStep(spec) + ' ' + tableStep(verb, tense, A);
  const explain = clause(subj, form) + ' : on écrit ' + q(se.stem) + ' + ' + q('-' + answer) + ' (' + q(verb) + ' ' + TENSE_AT[tense] + ', '
    + PERSON_LABEL[person] + ').';
  return Object.assign(itemBase(spec), {
    prompt: frTypo('Choisis la bonne terminaison ' + TENSE_AT[tense] + '.'), answer, choices, hint: frTypo(hint), explain: frTypo(explain),
    data: baseData(spec, sentence, { form, stem: se.stem, ending: answer, aux: aux || null, full, indicator: cue, subjectSpan: subjSpan(full, subj) })
  });
}

/* ---------- temps ---------- */
const CONFUSABLE = {
  present: ['futur', 'imparfait', 'passe_compose', 'passe_simple'], imparfait: ['passe_simple', 'present', 'plus_que_parfait', 'passe_compose'],
  futur: ['present', 'imparfait', 'passe_simple', 'passe_compose'], passe_compose: ['plus_que_parfait', 'present', 'imparfait', 'passe_simple'],
  passe_simple: ['imparfait', 'passe_compose', 'present', 'futur'], plus_que_parfait: ['passe_compose', 'imparfait', 'passe_simple', 'present']
};
function buildTemps(rng, spec, A) {
  const { verb, tense, person, g, subj } = spec;
  const form = formOf(verb, tense, person, { g });
  const known = TENSES.filter(t => LEVELS.tense[t] <= A + 1e-9);
  let names;
  if (known.length <= 4) names = BASIC.slice();
  else {
    const pool = CONFUSABLE[tense].filter(t => known.includes(t));
    names = [tense, ...rng.shuffle(pool.slice(0, 3)).slice(0, 3)];
    for (const t of rng.shuffle(known)) if (names.length < 4 && !names.includes(t)) names.push(t);
  }
  if (!names.includes(tense) || names.length !== 4) return null;
  /* la forme ne doit correspondre qu'à un seul des temps proposés (ex. « il finit » : présent ou passé simple) */
  for (const t of names) if (t !== tense && formOf(verb, t, person, { g }) === form) return null;
  const sent = buildSentence(rng, spec, null);
  const parts = verbSlot(sent, form);
  const text = parts.before + form + parts.after;
  const underline = [parts.before.length, parts.before.length + form.length];
  const choices = rng.shuffle(names).map(t => ({ label: TENSE_THE[t], value: t }));
  let hint;
  if (isCompound(tense)) hint = 'Le verbe souligné est en deux mots : un auxiliaire (' + q('avoir') + ' ou ' + q('être') + ') et un participe passé. '
    + 'Regarde à quel temps est l’auxiliaire.';
  else if (names.includes('passe_simple') && (tense === 'passe_simple' || tense === 'imparfait'))
    hint = 'Le verbe est en un seul mot et il parle du passé. À l’imparfait, on trouve -ais, -ait, -aient… ; au passé simple, -a, -it, -ut, -èrent, -irent…';
  else hint = 'Le verbe est en un seul mot. Essaie de commencer la phrase par ' + q('Hier') + ', ' + q('Aujourd’hui') + ' ou ' + q('Demain') + ' : lequel va le mieux ?';
  const i = PERSONS.indexOf(person);
  const why = {
    present: 'le verbe ' + q(verb) + ' est conjugué au présent',
    imparfait: 'la terminaison -' + ENDINGS_IMP[i] + ' est la marque de l’imparfait',
    futur: 'on entend le r du futur, et la terminaison est -' + ENDINGS_FUT[i],
    passe_compose: 'auxiliaire ' + q(auxOf(verb)) + ' au présent + participe passé : c’est le passé composé',
    passe_simple: 'c’est une terminaison du passé simple',
    plus_que_parfait: 'auxiliaire ' + q(auxOf(verb)) + ' à l’imparfait + participe passé : c’est le plus-que-parfait'
  }[tense];
  const explain = q(form) + ' : ' + why + ' (verbe ' + q(verb) + ', ' + PERSON_LABEL[person] + ').';
  const sentence = { before: parts.before, after: parts.after, text, underline };
  return Object.assign(itemBase(spec), {
    prompt: frTypo('À quel temps est conjugué le verbe souligné ?'), answer: tense, choices, hint: frTypo(hint), explain: frTypo(explain),
    data: baseData(spec, sentence, { form, full: text, cue: null, tenses: names,
      subjectSpan: subjSpan(text, subj, sent.order === 'vs' ? underline[1] : 0) })
  });
}

/* ---------- accord ---------- */
function buildAccord(rng, spec, A) {
  if (spec.struct === 'codpron') return buildCodpron(rng, spec, A);
  const { verb, tense, person, g, subj } = spec;
  const answer = formOf(verb, tense, person, { g });
  const cue = pickCue(rng, spec, 0.4);
  const sent = buildSentence(rng, spec, cue);
  /* forme « piège » : accord avec le mauvais nom (complément du nom, dernier nom, nombre opposé…) */
  const traps = [];
  if (subj.kind === 'cdn') traps.push(formOf(verb, tense, subj.trap === 'p' ? '3p' : '3s', { g }));
  if (['multi', 'q', 'qcdn', 'inv', 'invcdn', 'pluriel', 'dial'].includes(subj.kind) || ['q', 'qcdn', 'inv', 'invcdn', 'pluriel', 'dial'].includes(spec.struct))
    traps.push(formOf(verb, tense, person === '3p' ? '3s' : '3p', { g }));
  if (subj.kind === 'multi2') traps.push(formOf(verb, tense, '3p', { g }), formOf(verb, tense, person === '1p' ? '1s' : '2s', { g }));
  if (person.startsWith('3')) traps.push(formOf(verb, tense, person === '3p' ? '3s' : '3p', { g }));
  const pools = formPools(verb, tense, person, g, answer, A);
  const errs = pools.errs.filter(x => x.why !== 'infinitif').map(x => x.f);
  const needInitial = (sent.order === 'sv' && subj.t === 'je') || !!sent.elideHead;
  const distract = pickDistractors(rng, answer, [
    { list: traps, max: 2 }, { list: pools.homo, max: 2 }, { list: pools.gender, max: 1 }, { list: errs, max: 1 }, { list: pools.same, max: 3 }
  ], { sameInitial: needInitial });
  if (distract.length < 3) return null;
  const sentence = verbSlot(sent, answer);
  const full = sentence.before + answer + sentence.after;
  const choices = shuffleChoices(rng, answer, distract);
  const hint = formHint(spec, A);
  let trapNote = '';
  if (subj.kind === 'cdn') trapNote = ' Le groupe ' + q(subj.t.slice(subj.t.indexOf(subj.head) + subj.head.length).trim()) + ' complète le nom '
    + q(subj.head) + ' : ce n’est pas lui qui commande l’accord.';
  else if (subj.kind === 'multi') trapNote = ' Deux noms reliés par ' + q('et') + ' : le verbe est au pluriel.';
  else if (subj.kind === 'multi2') trapNote = ' ' + q(cap(subj.t)) + ' peut être remplacé par ' + q(pronOfSubj(subj)) + '.';
  if (spec.struct === 'q' || spec.struct === 'qcdn') trapNote += ' Dans une question, le sujet peut être placé après le verbe.';
  else if (spec.struct === 'inv' || spec.struct === 'invcdn' || spec.struct === 'dial') trapNote += ' Ici, le sujet est placé après le verbe.';
  const fact = endingFact(verb, tense, person, g);
  const explain = frTypo(clause(subj, answer) + ' : le verbe s’accorde avec ' + q(subj.t) + (subj.kind === 'pron' ? '' : ' (' + pronOfSubj(subj) + ')')
    + (fact && !isCompound(tense) ? '.' : ', ' + TENSE_AT[tense] + '.') + trapNote + fact + variantNote(verb, tense, person));
  let model = null;
  if (spec.struct === 'pluriel') {
    const mForm = formOf(verb, tense, '3s', { g });
    const mParts = verbSlot(Object.assign({}, sent, { subjTxt: spec.model.t, subjElide: null }), mForm);
    model = mParts.before + mForm + mParts.after;
  }
  return Object.assign(itemBase(spec), {
    prompt: frTypo(spec.struct === 'pluriel' ? 'Mets la phrase au pluriel : choisis la bonne forme du verbe.' : 'Choisis le verbe bien accordé avec son sujet.'),
    answer, choices, hint, explain,
    data: baseData(spec, sentence, { form: answer, full, indicator: cue, model, dialogue: sent.dial,
      subjectSpan: subjSpan(full, subj, sent.order === 'vs' ? sentence.before.length + answer.length : 0) })
  });
}
/* « Ces poules, la fermière les appelle. » */
function buildCodpron(rng, spec, A) {
  const { verb, tense, person, g, subj, cod } = spec;
  const answer = formOf(verb, tense, person, { g });
  const pro = cod.n === 'p' ? 'les' : (startsWithVowel(answer) ? 'l’' : (cod.g === 'f' ? 'la' : 'le'));
  const trap = formOf(verb, tense, cod.n === 'p' ? '3p' : '3s', { g });
  const pools = formPools(verb, tense, person, g, answer, A);
  const distract = pickDistractors(rng, answer, [{ list: [trap], max: 1 }, { list: pools.homo, max: 2 }, { list: pools.errs.map(x => x.f), max: 1 },
    { list: pools.same, max: 3 }], { sameInitial: true });
  if (distract.length < 3) return null;
  const sentence = finalize(cap(cod.t) + ', ' + subj.t + ' ' + (pro.endsWith('’') ? pro : pro + ' '), '.');
  const full = sentence.before + answer + sentence.after;
  const choices = shuffleChoices(rng, answer, distract);
  const hint = formHint(spec, A, { pro, cod });
  const explain = frTypo(clause(subj, answer, pro) + ' : le verbe s’accorde avec le sujet ' + q(subj.t) + ' (' + pronOfSubj(subj) + '), pas avec '
    + q(pro) + ', qui est un pronom complément.' + endingFact(verb, tense, person, g) + variantNote(verb, tense, person));
  return Object.assign(itemBase(spec), {
    prompt: frTypo('Choisis le verbe bien accordé avec son sujet.'), answer, choices, hint, explain,
    data: baseData(spec, sentence, { form: answer, full, cod: { text: cod.t, g: cod.g, n: cod.n }, pronoun: pro,
      subjectSpan: subjSpan(full, subj, cod.t.length) })
  });
}

/* ---------- sujet ---------- */
function buildSujet(rng, spec, A) {
  const { verb, tense, person, g, subj, frame } = spec;
  const form = formOf(verb, tense, person, { g });
  if (person === '1s' && startsWithVowel(form)) return null;          /* « j’ » ne se propose pas seul */
  const cue = pickCue(rng, spec, 0.45);
  const sent = buildSentence(rng, spec, cue);
  if (sent.order !== 'sv') return null;
  const atStart = !sent.lead;
  const pool = poolOf(frame.s);
  const cands = [];
  const addC = s => { if (s && s.t !== subj.t && !cands.some(c => c.t === s.t)) cands.push(s); };
  for (const p of rng.shuffle(pool.humans ? PERSONS.slice() : ['3s', '3p'])) {
    for (let k = 0; k < 3; k++) {
      const st = !p.startsWith('3') || A < 1 ? 'pron' : rng.pick(['pron', 'gn', 'gn', pool.humans && pool.names && p === '3s' ? 'name' : 'gn']);
      addC(makeSubject(rng, frame, p, st));
    }
  }
  if (A >= LEVELS.struct.multi - 1e-9 && pool.humans) addC(makeSubject(rng, frame, '3p', 'multi'));
  const etreEarly = isEtreVerb(verb) && isCompound(tense) && A < LEVELS.etreFull - 1e-9;
  const valid = cands.filter(c => {
    const f = formOf(verb, tense, personOf(c), { g: c.g });
    if (f === form) return false;
    if (personOf(c) === '1s' && startsWithVowel(f)) return false;
    /* avant l'accord du participe avec être (milieu du CM1) : pas de distracteur de même personne */
    if (etreEarly && personOf(c) === person) return false;
    return A >= 1 || c.kind === 'pron';
  });
  const chosen = [];
  const take = list => { for (const c of rng.shuffle(list)) if (!chosen.includes(c)) { chosen.push(c); return; } };
  take(valid.filter(c => c.kind === 'pron'));
  take(valid.filter(c => c.kind !== 'pron'));
  while (chosen.length < 3 && chosen.length < valid.length) take(valid.filter(c => !chosen.includes(c)));
  if (chosen.length < 3) return null;
  const labelOf = s => (atStart ? cap(s.t) : s.t);
  const four = rng.shuffle([subj, ...chosen.slice(0, 3)]);
  const choices = four.map(s => ({ label: frTypo(labelOf(s)), value: s.t }));
  const sentence = { before: frTypo(sent.lead ? cap(sent.lead) + ' ' : ''), after: frTypo(' ' + form + (sent.after ? ' ' + sent.after : '') + sent.end) };
  const full = sentence.before + labelOf(subj) + sentence.after;
  const withGN = A >= LEVELS.struct.pre - 1e-9 && four.some(c => c.kind !== 'pron');
  /* indice : la marque de personne à observer et le tableau du temps, sans citer aucun sujet proposé */
  let look;
  if (isCompound(tense)) look = 'Regarde bien l’auxiliaire ' + q(conjugate(verb, tense, person, { g }).aux) + ' : sa forme change selon la personne.';
  else if (endingTable(verb, tense)) look = 'La fin du verbe ' + q(form) + ' indique la personne. ' + tableStep(verb, tense, A);
  else look = 'La forme ' + q(form) + ' indique la personne : récite la conjugaison du verbe ' + q(verb) + ' ' + TENSE_AT[tense] + ' dans ta tête.';
  const hint = frTypo(look + ' Essaie chaque sujet devant le verbe.' + (withGN ? ' Pour un groupe de mots, pense au pronom qui le remplace.' : ''));
  const explain = frTypo(q(form) + ' va avec ' + q(subj.t) + (subj.kind !== 'pron' ? ' (' + pronOfSubj(subj) + ')' : '') + ' : '
    + q(verb) + ' ' + TENSE_AT[tense] + ', ' + PERSON_LABEL[person] + '.' + endingFact(verb, tense, person, g));
  return Object.assign(itemBase(spec), {
    prompt: frTypo('Choisis le sujet qui va avec le verbe.'), answer: subj.t, choices, hint, explain,
    data: baseData(spec, sentence, { form, full, indicator: cue, cue: null,
      subjects: four.map(s => ({ text: s.t, person: personOf(s), g: s.g })),
      subjectSpan: [sentence.before.length, sentence.before.length + subj.t.length] })
  });
}

/* ---------- participe ---------- */
function buildParticipe(rng, spec, A) {
  if (spec.mode === 'cod' || spec.mode === 'apres') return buildParticipeCod(rng, spec, A);
  const { verb, tense, person, g, subj } = spec;
  const r = conjugate(verb, tense, person, { g });
  const answer = r.participle;
  const pp = pastParticiple(verb);
  const distract = pickDistractors(rng, answer, [{ list: [agree(pp, 'm', 's'), agree(pp, 'f', 's'), agree(pp, 'm', 'p'), agree(pp, 'f', 'p')], max: 3 }]);
  if (distract.length < 3) return null;
  const cue = pickCue(rng, spec, 0.5);
  const sent = buildSentence(rng, spec, cue);
  const sentence = verbSlot(sent, answer, r.aux);
  const full = sentence.before + answer + sentence.after;
  const choices = shuffleChoices(rng, answer, distract);
  const gTxt = (subj.g === 'f' ? 'féminin' : 'masculin') + ' ' + (subj.n === 'p' ? 'pluriel' : 'singulier');
  const add = answer === pp ? 'le participe passé ne change pas' : 'on ajoute ' + q('-' + answer.slice(pp.length));
  /* indice : (1) le sujet et ses questions ; (2) la règle générale de l'accord avec être, jamais le participe */
  const who = (subj.kind === 'multi' ? 'Repère tout le sujet : ' : 'Repère le sujet : ') + q(subj.t) + '.'
    + (subj.kind === 'cdn' ? ' Son mot principal commande l’accord.' : '');
  const hint = frTypo(who + ' Masculin ou féminin ? Singulier ou pluriel ? Avec l’auxiliaire ' + q('être')
    + ', le participe passé s’accorde avec le sujet (féminin : on ajoute -e ; pluriel : -s).');
  const headNote = subj.kind === 'cdn' ? ' Le groupe ' + q(subj.t.slice(subj.t.indexOf(subj.head) + subj.head.length).trim())
    + ' complète le nom ' + q(subj.head) + ' : ce n’est pas lui qui commande l’accord.' : '';
  const explain = frTypo(clause(subj, answer, r.aux) + ' : avec ' + q('être') + ', le participe passé s’accorde avec le sujet ' + q(subj.t) + ' ('
    + gTxt + (subj.mixed ? ' : un nom masculin et un nom féminin donnent le masculin pluriel' : '') + ') : ' + add + '.' + headNote);
  return Object.assign(itemBase(spec), {
    prompt: frTypo('Choisis le participe passé bien accordé.'), answer, choices, hint, explain,
    data: baseData(spec, sentence, { form: r.form, aux: r.aux, participle: answer, full, indicator: cue, subjectSpan: subjSpan(full, subj) })
  });
}
/* « Ces fleurs, je les ai ramassées. » / « Mes cousines ont ramassé des fleurs. » */
const AVOIR_RULE = 'Avec l’auxiliaire « avoir », le participe passé ne s’accorde jamais avec le sujet, mais avec le COD placé avant le verbe.';
function buildParticipeCod(rng, spec, A) {
  const { verb, tense, person, subj, cod } = spec;
  const pp = pastParticiple(verb);
  const variants = uniq([agree(pp, 'm', 's'), agree(pp, 'f', 's'), agree(pp, 'm', 'p'), agree(pp, 'f', 'p'), ...(PP_ERR[verb] || []).slice(0, 1)]);
  const loc = spec.frame.l && rng.chance(0.4) ? ' ' + rng.pick(spec.frame.l) : '';
  let r, answer, sentence, hint, explain;
  if (spec.mode === 'cod') {
    r = conjugate(verb, tense, person, { cod: { g: cod.g, n: cod.n } });
    answer = r.participle;
    const pro = cod.n === 'p' ? 'les' : 'l’';
    const lead = cap(cod.t) + ', ' + subj.t + ' ' + (pro === 'les' ? 'les ' : 'l’') + r.aux + ' ';
    sentence = finalize(lead, loc + '.');
    const gTxt = (cod.g === 'f' ? 'féminin' : 'masculin') + ' ' + (cod.n === 'p' ? 'pluriel' : 'singulier');
    hint = AVOIR_RULE + ' Ici, ' + q(pro) + ' remplace ' + q(cod.t) + ' : masculin ou féminin ? Singulier ou pluriel ?';
    explain = lead.trim() + ' ' + answer + ' : le COD ' + q(pro) + ' (' + cod.t + ', ' + gTxt + ') est placé avant le verbe, donc le participe passé s’accorde avec lui'
      + (answer === pp ? ' (au masculin singulier, il ne change pas).' : ' : on ajoute ' + q('-' + answer.slice(pp.length)) + '.');
  } else {
    r = conjugate(verb, tense, person, {});
    answer = r.participle;
    sentence = finalize((subj.t === 'je' ? 'j’' : subj.t + ' ') + r.aux + ' ', ' ' + cod.indef + loc + '.');
    hint = AVOIR_RULE + ' Ici, où se place le COD ?';
    explain = clause(subj, r.form) + ' ' + cod.indef + ' : avec ' + q('avoir') + ', on n’accorde pas avec le sujet, et le COD ' + q(cod.indef)
      + ' est placé après le verbe : le participe passé ne s’accorde pas.';
  }
  const distract = pickDistractors(rng, answer, [{ list: variants, max: 3 }]);
  if (distract.length < 3) return null;
  const full = sentence.before + answer + sentence.after;
  const choices = shuffleChoices(rng, answer, distract);
  return Object.assign(itemBase(spec), {
    prompt: frTypo('Choisis le participe passé bien accordé.'), answer, choices, hint: frTypo(hint), explain: frTypo(explain),
    data: baseData(spec, sentence, { form: r.form, aux: r.aux, participle: answer, full,
      cod: { text: spec.mode === 'apres' ? cod.indef : cod.t, g: cod.g, n: cod.n }, codAfter: spec.mode === 'apres',
      subjectSpan: subjSpan(full, subj, spec.mode === 'cod' ? cod.t.length : 0) })
  });
}

const BUILD = { forme: buildForme, terminaison: buildTerminaison, temps: buildTemps, accord: buildAccord, sujet: buildSujet, participe: buildParticipe };

/* ============ API ============ */
const toSet = v => (v instanceof Set ? v : new Set(Array.isArray(v) ? v : []));
const MAX_ROUNDS = 30;
function tryBuild(spec, rng, A) {
  try { return spec ? BUILD[spec.kind](rng, spec, A) : null; } catch (e) { return null; }
}

/* gen(A, rng, { avoid, kind }) : item du niveau A (un sous-type imposé au-dessus de son niveau
   d'introduction est servi à ce niveau minimal, ex. 'temps' → 1,8) */
export function gen(A, rng, opts = {}) {
  const o = opts || {};
  let a = clamp(Number.isFinite(+A) ? +A : 0, 0, A_MAX);
  const avoid = toSet(o.avoid);
  const forced = typeof o.kind === 'string' && KINDS.includes(o.kind) ? o.kind : null;
  if (forced && LEVELS.kind[forced] > a) a = LEVELS.kind[forced];
  const kinds = availableKinds(a);
  let last = null;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const kind = forced || pickW(rng, kinds, k => KIND_WEIGHT[k]);
    const specs = [];
    for (let i = 0; i < N_CANDIDATES * 3 && specs.length < N_CANDIDATES; i++) {
      const s = randomSpec(a, rng, kind);
      if (s && s.L <= a + 1e-9) specs.push(s);
    }
    if (!specs.length) continue;
    const fresh = specs.filter(s => !avoid.has(keyOf(s)));
    let pool = fresh.length ? fresh : specs;
    /* calibrage : on écarte les candidats trop faciles tant qu'il en reste, on tire le NIVEAU (très
       pointu autour de A, quel que soit le nombre de candidats qui le partagent), puis un candidat */
    const near = pool.filter(s => s.L >= a - NEAR_SPAN - 1e-9);
    if (near.length) pool = near;
    const level = pickW(rng, uniq(pool.map(s => s.L)), L => levelW(a, L));
    const item = tryBuild(rng.pick(pool.filter(s => s.L === level)), rng, a);
    if (!item) continue;
    last = item;
    if (!avoid.has(item.key)) return item;
  }
  return last || fallbackItem(rng);
}
/* filet de sécurité (jamais atteint en pratique) : « Nous avons un chat. » */
function fallbackItem(rng) {
  const spec = { kind: 'forme', verb: 'avoir', tense: 'present', person: '1p', g: 'm', frame: { s: 'H', c: ['un chat'] }, struct: 'pron',
    subj: { t: 'nous', p: '1p', g: 'm', n: 'p', kind: 'pron', pron: 'nous' }, L: 0 };
  return buildForme(rng, spec, 0);
}

/* fromKey(key, A, rng) : item de même clé ('forme' pour une clé de forme, 'temps' pour une clé
   'temps|…', 'participe' pour une clé 'cod|…') ; null si la clé est inconnue ou invalide */
export function fromKey(key, A, rng) {
  if (typeof key !== 'string' || !key.startsWith(KEY) || !rng) return null;
  const parts = key.slice(KEY.length).split('|');
  const a = clamp(Number.isFinite(+A) ? +A : 0, 0, A_MAX);
  if (parts[0] === 'cod') return fromCodKey(key, parts.slice(1), a, rng);
  let kind = 'forme';
  if (parts[0] === 'temps') { kind = 'temps'; parts.shift(); }
  if (parts.length < 3 || parts.length > 4) return null;
  const [verb, tense, person, gk] = parts;
  if (!FR[verb] || !TENSES.includes(tense) || !PERSONS.includes(person)) return null;
  const needG = isEtreVerb(verb) && isCompound(tense);
  if (needG ? !(gk === 'm' || gk === 'f') || !person.startsWith('3') : gk !== undefined) return null;
  if (CLASS_OF[verb] === 'compound' && !isCompound(tense)) return null;
  const frames = FR[verb].filter(f => framePersons(f).includes(person) && (!f.t || f.t.includes(tense)));
  if (!frames.length) return null;
  for (let k = 0; k < 24; k++) {
    const frame = rng.pick(frames);
    const st = rng.pick((person.startsWith('3') ? ['pron', 'gn', 'name'] : ['pron']).filter(s => structOk(s, frame, person)));
    if (!st) continue;
    const subj = makeSubject(rng, frame, person, st, { g: needG ? gk : null });
    if (!subj || personOf(subj) !== person) continue;
    const L = specLevel(kind, verb, tense, person, st, subj);
    if (!Number.isFinite(L)) return null;
    const spec = { kind, verb, tense, person, g: subj.g, frame, struct: st, subj, L };
    /* distracteurs au niveau de l'enfant (jamais sous le niveau de la clé) */
    const item = tryBuild(spec, rng, Math.max(a, L));
    if (item && item.key === key) return Object.assign(item, { fromKey: true });
  }
  return null;
}
function fromCodKey(key, parts, a, rng) {
  if (parts.length !== 3) return null;
  const [verb, tense, k] = parts;
  const C = COD.find(c => c.v === verb);
  if (!C || !isCompound(tense)) return null;
  const after = k === 'apres';
  const os = after ? C.o : C.o.filter(o => o[1] + o[2] === k);
  if (!os.length) return null;
  for (let t = 0; t < 24; t++) {
    const spec = codSpec(A_MAX, rng, 'participe', { C, o: rng.pick(os), tense, after });
    if (!spec) continue;
    const item = tryBuild(spec, rng, Math.max(a, spec.L));
    if (item && item.key === key) return Object.assign(item, { fromKey: true });
  }
  return null;
}

/* libellé lisible d'une clé (espace parents, « à revoir ») : « prendre · présent · ils prennent » */
export function keyLabel(key) {
  if (typeof key !== 'string' || !key.startsWith(KEY)) return '';
  const parts = key.slice(KEY.length).split('|');
  if (parts[0] === 'cod') {
    const [, verb, tense, k] = parts;
    if (!hasVerb(verb) || !TENSE_LABEL[tense] || !k) return '';
    const what = k === 'apres' ? 'COD placé après le verbe'
      : 'COD ' + (k[0] === 'f' ? 'féminin' : 'masculin') + ' ' + (k[1] === 'p' ? 'pluriel' : 'singulier') + ' placé avant le verbe';
    return frTypo(verb + ' · ' + TENSE_LABEL[tense] + ' · participe passé avec avoir (' + what + ')');
  }
  let prefix = '';
  if (parts[0] === 'temps') { parts.shift(); prefix = 'reconnaître le temps : '; }
  const [verb, tense, person, gk] = parts;
  const f = formOf(verb, tense, person, { g: gk === 'f' ? 'f' : 'm' });
  if (!f) return '';
  return frTypo(prefix + verb + ' · ' + TENSE_LABEL[tense] + ' · ' + pronounFor(person, gk, f) + f);
}

/* données exposées pour les tests (lecture seule) */
export const _internals = Object.freeze({ FR, QUESTIONS, COD, CUES, CUE_OK, CLASS, P, NAMES, KIDS, ADULTS, soundKey, errorForms, LEVELS,
  hintParts: { subjectStep, tableStep, endingTable, presentMarks, psMarks, endingFact }, itemLevel });
