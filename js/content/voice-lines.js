/* ============ PHRASES ENREGISTRÉES DU COMPAGNON (v2.2.2) ============
   Module PUR (aucun accès au navigateur) : l'inventaire de ce que le compagnon dit, enregistré une fois pour toutes avec
   la voix neuronale libre Piper « fr_FR-siwis-medium » (tools/voix.mjs → audio/voix/<id>.mp3 + js/content/voice-manifest.js),
   et le planificateur qui transforme une phrase à dire en suite de clips. Lecture : js/ui/voice.js (Web Audio) ; ce qui
   n'est pas couvert passe par la synthèse du téléphone, comme en 2.2.1.

   Inventaire : LINES = [{ id, text, say?, cut? }]
     text : le texte AFFICHÉ (source exacte, avant frTypo) ; c'est lui qui sert à reconnaître la phrase ;
     say  : ce que Piper lit, quand il diffère de speakable(text) (prononciation : « plusse », « troisième » ; emoji
            muets remplacés par un vrai point) — et la VARIANTE SANS PRÉNOM des phrases à {P} / {N} ;
     cut  : 'carrier' = enregistré dans la phrase porteuse « … : la. » puis coupé avant « la » (intonation de
            continuation, pour un morceau suivi d'autre chose) ; sinon lu tel quel.
   Règle des prénoms (testée) : une entrée qui contient {P} (prénom de l'enfant) ou {N} (nom du compagnon) n'est
   reconnue que dans le texte affiché, jetons remplis pour l'enfant actif (namedLines(fill)) ; c'est alors sa variante
   `say`, sans prénom, qui est jouée (« Coucou Léa ! Moi, c'est Caramel. » → « Coucou ! C'est moi, ton compagnon ! ») ;
   le texte affiché garde le prénom. Un prénom hors de ces entrées → la phrase entière part à la voix du téléphone.

   Nombres : 0 à 100 enregistrés en entier (n<k> : intonation de continuation, coupé d'une phrase porteuse ; n<k>-f :
   fin de phrase, de 0 à 20 et 100 — au-delà, la continuation sert aussi en fin de phrase), au-delà composés
   (« trois cent » + « quarante-sept », « mille », « millions », « virgule ») ; « une » devant un nom féminin
   (1, 21… 81 : « Il te manque 1 🍎 » → « une pomme »). Devant le nom qu'il compte (« six pommes », « dix petits
   piquets », « huit fois ») et devant « mille » ou « millions », un nombre qui finit par six, huit ou dix perd sa
   dernière consonne : variantes n<k>-pc (6, 8, 10, 18, enregistrées « si », « hui »…). Les autres (26, 28… 98, sauf
   devant « fois ») et les liaisons devant une voyelle (« trois unités ») ne sont pas enregistrés : la phrase part à la
   voix du téléphone.

   planSpeech(texte, { has, named }) → { ok, sentences: [{ ok }], clips: [{ id, gap }], missing } — gap : silence en ms
   avant le clip (GAP : rien, virgule, deux-points, fin de phrase). Le texte est couvert (ok) si chacun de ses mots
   l'est ; sinon clips ne garde que les phrases (« . ! ? … ») entièrement couvertes : js/ui/voice.js ne s'en sert
   que sans voix française sur le téléphone. Un symbole inconnu (€, %, /, <, °…) n'est jamais tu : c'est un mot que
   l'inventaire n'a pas, la phrase part à la voix du téléphone, qui sait le lire. Un morceau à intonation de fin de
   phrase n'est joué qu'en fin de phrase. */

import { toWords, MAX as NUM_MAX } from '../core/numbers-fr.js';
import { FOODS } from './companion-data.js';        /* aliments du compagnon (module pur, comme celui-ci) */

/* ---------- texte à dire (repris de js/ui/voice.js 2.2.1 ; v2.2.2 : emoji entre deux phrases → point) ---------- */
const FIX = [[/×/g, ' fois '], [/÷/g, ' divisé par '], [/−/g, ' moins '], [/(\d)\s*\+\s*(?=\d)/g, '$1 plus '], [/ = /g, ' égale '], [/≈/g, ' environ '],
  /* « … » d'une phrase à trou (orchestre) : une courte pause au milieu de la phrase, un point à la fin */
  [/\s*…\s*(?=[\p{Ll}\d])/gu, ', '], [/…/g, '. ']];
/* les emoji qui portent le sens se disent (« 20 🍎 » → « 20 pommes »), les autres se taisent */
const EMOJI = [
  [/(\d[\d\u202F\u00A0]*)\s*🍎/gu, (m, n) => n + (Number(n.replace(/\D/g, '')) > 1 ? ' pommes' : ' pomme')],
  [/🍎/gu, ' pomme '], [/🎤/gu, ' le micro '], [/⭐/gu, ' étoiles '], [/🥕/gu, ' la carotte ']
];
export function speakable(s) {
  let t = String(s ?? '');
  for (const [re, w] of EMOJI) t = t.replace(re, w);
  /* un emoji qui sépare deux phrases (« Le micro est bloqué 🔒 Tape la réponse… ») vaut un point : une pause, et
     l'intonation de fin de phrase reste à sa place (v2.2.2) */
  t = t.replace(/(\p{L})\s*[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]+\s+(?=\p{Lu})/gu, '$1. ');
  t = t.replace(/[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]/gu, ' ');
  for (const [re, w] of FIX) t = t.replace(re, w);
  return t.replace(/[▸➜→✓›]/g, ' ').replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1')
    .replace(/([.,!?])(?:\s*[.,])+/g, '$1').replace(/^[\s.,]+/, '').trim();
}

/* ---------- grands nombres pour les voix calculées (v2.4, retour du parent du 07/10/2026) ----------
   « Lorsqu'il y a 1 000, il dit 1 zéro zéro zéro au lieu de mille. » Les nombres s'écrivent avec une espace fine entre
   les tranches (« 1 000 », « 54 014 ») : la voix du téléphone et la voix fluide lisaient « un… zéro zéro zéro »,
   « cinquante-quatre… zéro quatorze ». On recolle les tranches, puis tout entier à partir de 1 000 est écrit en lettres
   (toWords de js/core/numbers-fr.js : « mille quatre cent soixante-quatorze », « deux cent cinquante mille », « un
   million ») : chaque voix dit la même chose. Un nombre à virgule garde ses chiffres, recollés (« 1250,50 »). Les clips
   n'en ont pas besoin : planSpeech recolle déjà les tranches et compose mille, centaines… (intClips). */
export function bigNumbers(text) {
  return String(text ?? '')
    .replace(/(\d)[ \u00A0\u202F\u2009\u2007](?=\d{3}(?!\d))/g, '$1')
    .replace(/(^|[^\d,.])(\d{4,})(?!\d|,\d)/g, (m, pre, d) => {
      const n = Number(d);
      return d.length > 1 && d[0] === '0' || !(n <= NUM_MAX) ? m : pre + toWords(n);
    });
}

/* ---------- texte pour la voix fluide (Piper calculé sur l'appareil, js/core/voice-fluid.js) ----------
   texte affiché → ce que Piper lit : speakable(), puis les corrections de prononciation du prototype (PT-proto, phonèmes
   vérifiés) — sans elles, espeak dirait « plus » [ply], « un pomme », « trente-hui(t) plus », [siz eɡal] */
export function fluidText(text) {
  /* « 7 × 8 = ? » passé par frTypo s'écrit « = ? » avec une espace fine insécable : speakable() (règle / = /) ne le
     lirait plus « égale » ; on remet des espaces ordinaires autour du signe */
  let t = speakable(String(text ?? '').replace(/[\s\u00A0\u202F]*=[\s\u00A0\u202F]*/g, ' = '));
  /* accords et liaisons : « une pomme », « un‿œuf », « neuf‿ans » (v2.5.1, agree) */
  t = agree(t);
  /* « plus » de calcul : [plys] — entre deux nombres, avec « combien », « une de plus » */
  t = t.replace(/(\d|\bcombien)\s+plus\b(?=\s+(?:\d|combien))/giu, '$1 plusse');
  t = t.replace(/\bde plus(?=\s+dans\b|\s*[.!?,]|$)/giu, 'de plusse');
  /* calcul : un nombre suivi d'un signe (sauf « fois ») est lu seul, sans enchaînement : « trente-huit | plusse »
     garde son t, « six | égale » se dit [sis] ; « huit fois » reste [ɥi fwa] (« | » : js/core/piper-engine.js) */
  t = t.replace(/(\d)\s+(?=(?:plusse|moins|égale|divisé)\b)/giu, '$1 | ');
  return bigNumbers(t);                               /* « 1 000 » → « mille » (en dernier : les règles voient les chiffres) */
}

/* ---------- réglages de l'enchaînement (mesurés : tools/voix.mjs --mesure) ---------- */
export const GAP = Object.freeze({ word: 0, comma: 220, colon: 260, sentence: 480 });
export const NUM_WHOLE = 100;                 /* 0 à 100 : un clip par nombre */
/* v2.5.1 (retour du parent du 07/10/2026 : « 1 pomme = une pomme et pas un pomme ; fais aussi attention aux liaisons ») :
   noms comptés après un nombre, relevés dans les générateurs, les phrases et l'interface (tests/accords-voix.test.mjs
   vérifie que chaque nom qui suit un nombre dans les exercices est classé ici ou est sans enjeu). Le pluriel est déduit
   (+ s, sauf -s -x -z ; -eau → -eaux). */
const plurals = list => list.flatMap(w => [w, /[sxz]$/.test(w) ? w : /eau$/.test(w) ? w + 'x' : w + 's']);
/* noms féminins comptés : « une pomme », « vingt-et-une réponses » (aussi js/core/piper-tts.js, prepare) */
export const FEM_WORDS = new Set(plurals(['pomme', 'étoile', 'réponse', 'dizaine', 'centaine', 'unité', 'minute', 'seconde',
  'heure', 'carotte', 'fraction', 'retenue', 'part', 'botte', 'poule', 'boîte', 'brosse', 'chèvre', 'barre', 'pile', 'ligne',
  'colonne', 'tenue', 'place', 'ferme', 'selle', 'question', 'partie', 'étape', 'mission', 'semaine', 'notion', 'famille',
  'histoire', 'phrase', 'série', 'médaille', 'carte', 'erreur', 'chenille', 'abeille', 'vache', 'graine', 'oie', 'poire',
  'fraise', 'tarte', 'voiture', 'maison', 'fleur', 'patte', 'plume', 'roue', 'pièce', 'bille', 'bougie', 'crêpe', 'tomate',
  'banane', 'cerise', 'noisette', 'noix', 'feuille', 'branche', 'pousse', 'glace', 'sucette', 'souris', 'table', 'chaise',
  'classe', 'fille', 'sœur', 'journée', 'année', 'nuit', 'saison', 'personne', 'équipe', 'course', 'balade', 'promenade',
  'image', 'photo', 'bouteille', 'assiette', 'tasse', 'mangue', 'saucisse', 'crevette', 'mandarine', 'salade', 'pastèque',
  'pizza', 'tranche', 'tablette', 'case', 'marche', 'lettre', 'syllabe', 'page', 'chanson', 'note', 'fourmi', 'coccinelle',
  'grenouille', 'brebis', 'jument', 'lapine', 'cane', 'dinde', 'licorne', 'baleine', 'chouette', 'girafe', 'tortue', 'porte',
  'fenêtre', 'pierre', 'perle', 'rose', 'tulipe', 'plante', 'olive', 'orange', 'prune', 'figue', 'framboise', 'pêche',
  'clémentine', 'citrouille', 'châtaigne', 'gaufre', 'galette', 'brioche', 'madeleine', 'balle', 'raquette', 'toupie', 'poupée',
  'caisse', 'cage', 'ruche', 'niche', 'grange', 'écurie', 'cuve', 'brouette', 'charrette', 'calèche', 'remorque', 'cabane',
  'tente', 'échelle', 'corde', 'chaussette', 'chaussure', 'robe', 'casquette', 'écharpe', 'couronne', 'aile', 'corne', 'dent',
  'oreille', 'planche', 'lampe', 'guirlande', 'enveloppe', 'brochette', 'chèvre', 'vitre', 'bûche', 'gourde', 'gomme',
  'règle', 'trousse', 'craie', 'cartouche', 'framboise', 'myrtille', 'noisette', 'part', 'portion', 'parcelle', 'rangée',
  'haie', 'clôture', 'barrière', 'mare', 'rivière', 'montagne', 'colline', 'forêt', 'île', 'école', 'ville', 'rue', 'piste',
  'semence', 'récolte', 'citerne', 'tonne', 'livre', 'centime',
  /* adjectifs des énoncés (« 7 sont rousses » : « une rousse ») */ 'rousse', 'grise', 'blanche', 'noire', 'brune']));
/* noms masculins qui commencent par une voyelle ou un h muet : « un‿œuf », « un‿euro » (la liaison en [n] ne se fait que
   si « un » est écrit en lettres ; jamais devant un h aspiré : hibou, haricot, hamburger, hérisson… ne sont pas ici) */
export const MASC_VOWEL = new Set(plurals(['œuf', 'euro', 'enclos', 'âne', 'an', 'arbre', 'oiseau', 'objet', 'enfant', 'élève',
  'escargot', 'éléphant', 'agneau', 'abricot', 'ananas', 'aigle', 'avion', 'arrosoir', 'oignon', 'ours', 'os', 'orage',
  'épi', 'étage', 'insecte', 'outil', 'ordinateur', 'ami', 'animal', 'anniversaire', 'atelier', 'élastique', 'écureuil',
  'homme', 'hôtel', 'hectare', 'oursin', 'ouvrier', 'exercice', 'essai', 'écran', 'étui', 'igloo', 'iceberg', 'accessoire',
  'aliment', 'arc-en-ciel', 'autocollant', 'album', 'abri', 'arbuste', 'épouvantail', 'entrepôt', 'avocat', 'éclair']));
const FEM_ONE = new Set([1, 21, 31, 41, 51, 61, 81]);
/* « neuf ans », « neuf heures » : [nœv] (le phonémiseur ne le fait qu'avec le mot écrit) */
const NEUF_V = /^(ans?|heures?)$/;
/* accords et liaisons du nombre qui précède un nom (voix du téléphone, voix fluide) : 1, 21… 81 → « une » devant un nom
   féminin, « un » écrit en lettres devant un nom masculin à voyelle (liaison [n]) ; 9, 19… 99 devant « ans » / « heures » en
   lettres ([nœv]). Le reste garde ses chiffres (les voix lisent bien « deux œufs », « dix euros », « cent euros »). */
export function agree(text) {
  return String(text ?? '').replace(/(^|[^\d,.\u00A0\u202F])(\d{1,2})(?=[ \u00A0\u202F]+(\p{L}[\p{L}’'-]*))/gu, (m, pre, d, w) => {
    const n = Number(d), lw = w.toLowerCase();
    if (FEM_ONE.has(n) && FEM_WORDS.has(lw)) return pre + word100(n).replace(/un$/, 'une');
    if (FEM_ONE.has(n) && MASC_VOWEL.has(lw)) return pre + word100(n);
    if (n % 10 === 9 && NEUF_V.test(lw)) return pre + word100(n);
    return m;
  });
}
/* devant une consonne, « six », « huit », « dix » se disent [si] [ɥi] [di] : variantes enregistrées (graphie phonétique,
   vérifiée au phonémiseur de Piper : « si » [si], « hui » [ɥi], « di » [di], « dix-hui » [dizɥi]) */
const PC = new Map([[6, 'si'], [8, 'hui'], [10, 'di'], [18, 'dix-hui']]);

/* ---------- nombres ---------- */
const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
const TEENS = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
/* 0 ≤ n ≤ 100 en lettres (orthographe de 1990, comme js/core/numbers-fr.js) */
export function word100(n) {
  if (n === 100) return 'cent';
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 70) { const t = Math.floor(n / 10), u = n % 10; return TENS[t] + (u === 0 ? '' : u === 1 ? '-et-un' : '-' + UNITS[u]); }
  if (n < 80) return n === 71 ? 'soixante-et-onze' : 'soixante-' + TEENS[n - 70];
  if (n === 80) return 'quatre-vingts';
  return 'quatre-vingt-' + (n < 90 ? UNITS[n - 80] : TEENS[n - 90]);
}
const femWord = n => word100(n).replace(/un$/, 'une');
/* les nombres en lettres jusqu'à 100 (« deux tiers », « un demi ») valent leurs chiffres */
const WORD_NUM = new Map();
for (let n = 0; n <= NUM_WHOLE; n++) WORD_NUM.set(word100(n), n);
WORD_NUM.set('une', 1);

/* clips nécessaires pour dire un entier n ≥ 0 (end : 'c' continuation | 'f' fin ; fem : devant un nom féminin) */
export function intClips(n, { end = 'f', fem = false } = {}) {
  if (!Number.isInteger(n) || n < 0 || n > 999999999999) return null;
  const out = [];
  const last = (id, v) => out.push(v === 'f' ? id + '-f' : id);
  /* groupe de 1 à 999 ; tail : ce groupe termine le nombre */
  const group = (g, tail, femHere) => {
    const h = Math.floor(g / 100), r = g % 100;
    const v = tail ? end : 'c';
    if (h > 0) {
      const hid = h === 1 ? 'n100' : 'c' + h;
      if (r === 0) { last(hid, v); return; }
      out.push(hid);
    }
    if (r > 0 || h === 0) {
      if (femHere && FEM_ONE.has(r)) out.push('n' + r + '-une');
      else if (!tail && PC.has(r)) out.push('n' + r + '-pc');      /* « six mille », « dix millions » */
      else last('n' + r, v);
    }
  };
  if (n <= NUM_WHOLE) {
    if (fem && FEM_ONE.has(n)) out.push('n' + n + '-une');
    else last('n' + n, end);
    return out;
  }
  const mds = Math.floor(n / 1e9), mns = Math.floor(n / 1e6) % 1000, ths = Math.floor(n / 1000) % 1000, rest = n % 1000;
  const after = (...xs) => xs.some(x => x > 0);
  if (mds) { group(mds, false, false); last(mds > 1 ? 'milliards' : 'milliard', after(mns, ths, rest) ? 'c' : end); }
  if (mns) { group(mns, false, false); last(mns > 1 ? 'millions' : 'million', after(ths, rest) ? 'c' : end); }
  if (ths) {
    if (ths > 1) group(ths, false, false);
    last('mille', rest > 0 ? 'c' : end);
  }
  if (rest) group(rest, true, fem);
  return out;
}
/* « 3,05 » → trois virgule zéro cinq ; « 12 » → douze */
export function numberClips(str, opts = {}) {
  const s = String(str).replace(/[\s\u202F\u00A0]/g, '');
  const m = /^(\d+)(?:,(\d+))?$/.exec(s);
  if (!m) return null;
  if (!m[2]) return intClips(Number(m[1]), opts);
  const ip = intClips(Number(m[1]), { end: 'c' });
  const zeros = /^0*/.exec(m[2])[0].length;
  const tail = m[2].slice(zeros);
  const dp = [];
  for (let i = 0; i < zeros; i++) dp.push(i === zeros - 1 && !tail ? (opts.end === 'c' ? 'n0' : 'n0-f') : 'n0');
  if (tail) { const t = intClips(Number(tail), { end: opts.end || 'f' }); if (!t) return null; dp.push(...t); }
  return ip ? [...ip, 'virgule', ...dp] : null;
}

/* ---------- inventaire ---------- */
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[’']/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
/* groupe d'entrées : chaîne = phrase fixe ; objet = { text, say?, id?, cut? } ; préfixe d'identifiant */
function grp(prefix, list) {
  return list.map(x => {
    const e = typeof x === 'string' ? { text: x } : { ...x };
    e.id = prefix + '.' + (e.id || slug(e.text));
    return e;
  });
}
/* morceaux de phrase (composition) : lus dans la phrase porteuse, sauf s'ils finissent une phrase */
const frag = list => grp('m', list.map(x => {
  const e = typeof x === 'string' ? { text: x } : { ...x };
  if (!/[.!?…]$/.test(e.text) && !e.cut) e.cut = 'carrier';
  else if (!e.id) e.id = slug(e.text) + '-f';         /* fin de phrase : « dizaines. » ≠ « dizaines » */
  return e;
}));

/* prononciation de Piper (phonèmes vérifiés) : « steak » [stɛk] et non [steɪk], « pizza » [pidza], « hamburger » [ɑ̃buʁɡœʁ] */
const FOOD_SAY = { steak: 'un stèque !', pizza: 'de la pidza !', burger: 'un hambourgueur !' };

const SRC = [
  /* 1re partie d'un jeu (js/ui/game-shell.js, GAME_HELLO) */
  ...grp('hello', [
    { id: 'course', text: 'Lis l’histoire à voix haute : à chaque mot que tu lis, j’avance !' },
    { id: 'cloture', text: 'Chaque piquet de la clôture a son nombre : aide-moi à trouver le bon, je saute jusqu’à lui !' },
    { id: 'tables', text: 'Trouve le résultat du calcul, tape-le ou dis-le avec 🎤, et je saute l’obstacle !', say: 'Trouve le résultat du calcul, tape-le ou dis-le avec le micro, et je saute l’obstacle !' },
    { id: 'pommes', text: 'Calcule dans ta tête : chaque bonne réponse fait tomber une pomme dans le panier !' },
    { id: 'operations', text: 'On pose l’opération, et tu trouves les chiffres un par un, colonne par colonne.' },
    /* l'orchestre se présente lui-même (js/games/orchestre.js) */
    { id: 'orchestre', text: 'L’orchestre t’attend ! 🎻' },
    { id: 'orchestre-n', text: '{N} dirige les musiciens. À chaque bonne réponse, une note s’ajoute à ta mélodie : à la fin, l’orchestre la joue pour toi !',
      say: 'Je dirige les musiciens. À chaque bonne réponse, une note s’ajoute à ta mélodie : à la fin, l’orchestre la joue pour toi !' }
  ]),
  /* visite guidée de l'accueil (js/ui/home.js) */
  ...grp('tour', [
    { id: 'coucou', text: 'Coucou {P} ! Moi, c’est {N}.', say: 'Coucou ! C’est moi, ton compagnon !' },
    { id: 'jouer', text: 'Pour jouer, touche le gros bouton Jouer !' },
    { id: 'encore', text: 'Pour jouer encore, touche ce gros bouton !' },
    { id: 'soins', text: 'Ici, tu t’occupes de moi : à manger, un coup de brosse, une promenade… et la boutique !' },
    /* CM1-CM2 (v2.2.2 : la lecture à voix haute est activée pour tous les enfants) : deux étapes, sans « coucou » */
    { id: 'cm-jouer', text: 'Le bouton Jouer lance l’étape du jour de ta balade.' },
    { id: 'cm-encore', text: 'Ta balade du jour est finie : ce bouton te propose un autre jeu.' },
    { id: 'cm-soins', text: 'Ici, tu prends soin de {N} : repas, brossage, promenade, et la boutique pour dépenser tes pommes.',
      say: 'Ici, tu prends soin de moi : repas, brossage, promenade, et la boutique pour dépenser tes pommes.' }
  ]),
  /* bilan d'une partie (js/ui/game-shell.js, praise) */
  ...grp('bilan', [
    'Tu as tout trouvé du premier coup, quelle star !',
    'Trouvé du premier coup, bravo !',
    'Tu as trouvé une réponse du premier coup !',
    'Tu es allé jusqu’au bout, bravo pour ta persévérance !',
    'Tu es allée jusqu’au bout, bravo pour ta persévérance !',
    'Ta balade du jour est finie !'
  ]),
  /* course (js/games/course.js, js/ui/game-ctx.js micTrouble) */
  ...grp('course', [
    'Choisis une histoire !',
    'Appuie sur le micro, puis lis l’histoire à voix haute !',
    { id: 'micro-ko', text: 'Le micro n’a pas démarré 😕 Touche-le pour réessayer.', say: 'Le micro n’a pas démarré. Touche-le pour réessayer.' },
    'Relis le passage, la réponse s’y cache !',
    { id: 'reponse', text: 'Voici la bonne réponse ✓ Elle se cachait dans le passage surligné.', say: 'Voici la bonne réponse. Elle se cachait dans le passage surligné.' },
    { id: 'parfaite-f', text: '🎉 Course parfaite ! {N} est super fière de toi !', say: 'Course parfaite ! Je suis super fière de toi !' },
    { id: 'parfaite-m', text: '🎉 Course parfaite ! {N} est super fier de toi !', say: 'Course parfaite ! Je suis super fier de toi !' },
    { id: 'belle', text: '💪 Très belle lecture ! Bats Zip pour la 3e étoile.', say: 'Très belle lecture ! Bats Zip pour la troisième étoile.' },
    { id: 'debut', text: '🌱 Bon début ! Relis cette histoire pour rattraper Zip.' },
    { id: 'bloque', text: 'Le micro est bloqué 🔒', say: 'Le micro est bloqué.' },
    { id: 'pas-de-micro', text: 'Je ne trouve pas de micro 🎙️', say: 'Je ne trouve pas de micro.' },
    { id: 'internet', text: 'Il me faut internet pour t’écouter 📶', say: 'Il me faut internet pour t’écouter.' },
    { id: 'ici', text: 'Ici, je ne peux pas t’écouter 😕', say: 'Ici, je ne peux pas t’écouter.' },
    'Demande à un adulte de t’aider.'
  ]),
  /* tables (js/games/tables.js) */
  ...grp('tables', [
    'Tape la réponse sur le pavé.',
    { id: 'tape-ou-micro', text: 'Tape la réponse, ou touche 🎤 et dis-la.' },
    'Pour ce calcul, tape la réponse.',
    'Dis ta réponse, ou tape-la sur le pavé.',
    /* « Le micro n’a pas démarré 😕 Touche 🎤 pour réessayer… », « Le micro ne m’entend plus… » : rares, voix du téléphone */
    { id: 'micro-ko-seul', text: 'Le micro n’a pas démarré 😕', say: 'Le micro n’a pas démarré.' },
    'Tape la réponse avec les touches.'
  ]),
  /* pommes (js/games/pommes.js, js/games/pommes-logic.js) */
  ...grp('pommes', [
    'Calcule dans ta tête, puis tape ta réponse.'
    /* estimations (« Calcule un ordre de grandeur… », CE2-CM2) et choix du sprint (chronomètre des parents) : voix du téléphone */
  ]),
  /* clôture (js/games/cloture.js, js/content/maths/ligne.js) */
  ...grp('cloture', [
    'Touche la clôture pour poser la carotte, puis valide.',
    'Quel nombre se cache sous le drapeau ?',
    'Quelle fraction se cache sous le drapeau ?'
  ]),
  /* compagnon de l'accueil : soins, boutique (js/ui/companion.js, sayOut) ; v2.4 : les aliments de chaque espèce
     (js/content/companion-data.js FOODS) — il dit « Miam, du poisson ! » : « Miam, » (continuation) puis l'aliment, la
     virgule laissant une pause naturelle entre les deux clips (19 aliments : ≈ 3 Ko chacun au lieu de ≈ 6 Ko pour une
     phrase entière, budget) ; refus doux (rassasié, aliment trop gros, déjà en forme) */
  ...grp('soin', [
    { id: 'miam', text: 'Miam,', cut: 'carrier' },
    ...FOODS.map(f => ({ id: f.id === 'pomme' ? 'poire' : f.id, text: f.say + ' !', ...(FOOD_SAY[f.id] ? { say: FOOD_SAY[f.id] } : {}) })),
    { id: 'plus-faim', text: '{N} n’a plus faim 😊', say: 'Je n’ai plus faim, merci !' },
    { id: 'trop', text: 'C’est trop pour {N} : choisis plus petit 😊', say: 'C’est trop pour moi : choisis plus petit !' },
    { id: 'belle', text: '{N} est déjà toute belle ✨ Reviens un peu plus tard !', say: 'Je suis déjà toute belle ! Reviens un peu plus tard !' },
    { id: 'beau', text: '{N} est déjà tout beau ✨ Reviens un peu plus tard !', say: 'Je suis déjà tout beau ! Reviens un peu plus tard !' },
    { id: 'brosse-poil', text: '{N} adore le brossage, quel beau poil ! ✨', say: 'J’adore le brossage, quel beau poil !' },
    { id: 'brosse-peau', text: '{N} adore le brossage, quelle peau toute douce ! ✨', say: 'J’adore le brossage, quelle peau toute douce !' },
    { id: 'brosse-ecailles', text: '{N} adore le brossage, quelles belles écailles ! ✨', say: 'J’adore le brossage, quelles belles écailles !' },
    { id: 'brosse-plumes', text: '{N} adore le brossage, quelles belles plumes ! ✨', say: 'J’adore le brossage, quelles belles plumes !' },   /* v2.5 : oiseaux */
    { id: 'en-forme', text: '{N} est déjà en pleine forme ! 🚶', say: 'Je suis déjà en pleine forme !' },
    { id: 'promenade', text: '{N} part en promenade, quel bonheur ! 🚶', say: 'Je pars en promenade, quel bonheur !' },
    { id: 'en-promenade', text: '{N} est en promenade… attends son retour ! 🚶', say: 'Je suis en promenade… attends mon retour !' },
    'Tu les gagnes en jouant !'
  ]),
  /* v2.4 : temps de jeu du jour atteint (js/ui/play-limit.js) — le compagnon se repose, sans reproche */
  ...grp('repos', [
    { id: 'tuile', text: '{N} se repose 💤 À demain !', say: 'Je me repose. À demain !' },
    { id: 'sieste', text: 'Tu as bien joué aujourd’hui ! {N} fait la sieste 💤 On rejoue demain.', say: 'Tu as bien joué aujourd’hui ! Je fais la sieste. On rejoue demain.' },
    { id: 'nuit', text: 'Tu as bien joué aujourd’hui ! {N} dort 🌙 On rejoue demain.', say: 'Tu as bien joué aujourd’hui ! Je vais dormir. On rejoue demain.' },
    'Tous les compagnons se reposent 💤 Un défi demain ?'
  ]),
  /* v2.6 : la dictée de la semaine (js/core/dictee.js : LINES, bilanLine) — les mots de la liste, eux, sont dits par la voix
     fluide (ou celle du téléphone) ; « le son est coupé » n'est jamais dit (sons coupés) */
  ...grp('dictee', [
    { id: 'prep', text: 'Je prépare ta dictée…' },
    { id: 'pret', text: 'Prends une feuille et un crayon.' },
    { id: 'ecoute', text: 'Écoute bien, puis écris le mot sur ta feuille.' },
    { id: 'ecris', text: 'Écris le mot, puis touche « C’est écrit ».' },
    { id: 'compare', text: 'Regarde ta feuille : as-tu écrit pareil ?' },
    { id: 'recopie', text: 'Pas grave ! Regarde bien le mot, et recopie-le juste à côté.' },
    { id: 'sans-liste', text: 'Pour la dictée, un adulte doit d’abord taper ta liste de mots.' },
    { id: 'sans-voix', text: 'Je n’arrive pas à parler sur ce téléphone. Demande à un adulte de t’aider.' },
    { id: 'tous', text: 'Tu as su écrire tous tes mots du premier coup, bravo !' },
    { id: 'ton-mot', text: 'Tu as su écrire ton mot du premier coup, bravo !' },
    { id: 'un-mot', text: 'Tu as su écrire un mot du premier coup !' },
    { id: 'compare-bravo', text: 'Tu as bien comparé tes mots avec le modèle, bravo !' }
  ]),
  /* v2.6 : les poésies dans la course (js/content/poems.js : STAGES ; js/games/course.js : POEM) — le titre et les vers ne
     sont jamais dits ; « Je t'écoute… » non plus (le micro écoute) */
  ...grp('poesie', [
    { id: 'choisis', text: 'Choisis ta poésie ou une histoire !' },
    { id: 'e1', text: 'Lis ta poésie à voix haute !' },
    { id: 'e2', text: 'Des mots se cachent : dis-les quand même !' },
    { id: 'e3', text: 'Il ne reste que la première lettre des mots !' },
    { id: 'e4', text: 'Seul le premier mot de chaque vers est écrit !' },
    { id: 'e5', text: 'Plus rien n’est écrit : récite de mémoire !' },
    { id: 'micro-lis', text: 'Appuie sur le micro et lis !' },
    { id: 'micro-recite', text: 'Appuie sur le micro et récite !' },
    { id: 'sue', text: 'Tu la sais par cœur ! Récite-la encore pour ne pas l’oublier.' },
    { id: 'rythme', text: 'Lis à ton rythme, tout le texte est là 📖' },
    { id: 'lue', text: '📖 Bravo, tu as lu toute ta poésie !' },
    { id: 'etape', text: '🎉 Étape réussie, bravo !' },
    { id: 'par-coeur', text: '🏆 Tu sais ta poésie par cœur !' },
    { id: 'entrainement', text: '💪 Bel entraînement ! Chaque fois, ta poésie rentre un peu mieux.' },
    { id: 'moins-aide', text: '💪 Bravo ! La prochaine fois, essaie avec un peu moins d’aide.' },
    { id: 'refait', text: 'On refait cette étape quand tu veux.' },
    { id: 'pas-entendu', text: 'Je ne t’ai pas entendu… On réessaie ? Parle bien fort ! 🎤' },
    { id: 'suite-e2', text: 'Prochaine étape : 🙈 mots cachés' },
    { id: 'suite-e3', text: 'Prochaine étape : 🔤 premières lettres' },
    { id: 'suite-e4', text: 'Prochaine étape : 🗝️ débuts de vers' },
    { id: 'suite-e5', text: 'Prochaine étape : 🧠 par cœur' }
  ]),
  /* v2.4 : « Caramel déménage ! 🏡 » (js/ui/move.js, TEXT) — ancienne adresse */
  ...grp('move', [
    { id: 'go', text: 'Je déménage ! Viens avec moi : tes progrès et tes pommes viennent aussi.' },
    { id: 'done', text: 'Ma nouvelle maison est prête ! Viens me retrouver là-bas.' },
    { id: 'offline', text: 'Il faut Internet pour déménager. On réessaiera plus tard !' },
    { id: 'wait', text: 'Je fais mes cartons…' }
  ]),
  /* v2.4 : « 🌱 Pas encore appris » (js/ui/game-ctx.js : laterAsk, LATER_OK) — une question par famille proposable
     (CE1 → CM2, js/content/calendar.js et les familles des générateurs déclarés ; liste vérifiée par tests/calendar.test.mjs).
     Les quatre familles à « 1 000 » (« jusqu’à 10 000 », « par 10, 100 ou 1 000 »…) passent par la voix fluide : une phrase à nombres n'a pas de
     clip entier */
  ...grp('later', [
    { id: 'ok', text: 'D’accord ! On le garde pour le mois prochain.' },
    { id: 'les-doubles-et-les-moities', text: 'Tu n’as pas encore appris les doubles et les moitiés en classe ?' },
    { id: 'la-table-de-1', text: 'Tu n’as pas encore appris la table de 1 en classe ?' },
    { id: 'la-table-de-2', text: 'Tu n’as pas encore appris la table de 2 en classe ?' },
    { id: 'la-table-de-5', text: 'Tu n’as pas encore appris la table de 5 en classe ?' },
    { id: 'la-table-de-10', text: 'Tu n’as pas encore appris la table de 10 en classe ?' },
    { id: 'la-table-de-3', text: 'Tu n’as pas encore appris la table de 3 en classe ?' },
    { id: 'la-table-de-4', text: 'Tu n’as pas encore appris la table de 4 en classe ?' },
    { id: 'la-table-de-6', text: 'Tu n’as pas encore appris la table de 6 en classe ?' },
    { id: 'a-multiplier-par-0', text: 'Tu n’as pas encore appris à multiplier par 0 en classe ?' },
    { id: 'la-table-de-7', text: 'Tu n’as pas encore appris la table de 7 en classe ?' },
    { id: 'la-table-de-8', text: 'Tu n’as pas encore appris la table de 8 en classe ?' },
    { id: 'la-table-de-9', text: 'Tu n’as pas encore appris la table de 9 en classe ?' },
    { id: 'a-compter-de-25-en-25', text: 'Tu n’as pas encore appris à compter de 25 en 25 en classe ?' },
    { id: 'les-multiplications-a-trou', text: 'Tu n’as pas encore appris les multiplications à trou en classe ?' },
    { id: 'les-decompositions-de-60', text: 'Tu n’as pas encore appris les décompositions de 60 en classe ?' },
    { id: 'les-divisions-des-tables', text: 'Tu n’as pas encore appris les divisions des tables en classe ?' },
    { id: 'les-fractions', text: 'Tu n’as pas encore appris les fractions en classe ?' },
    { id: 'les-nombres-a-virgule', text: 'Tu n’as pas encore appris les nombres à virgule en classe ?' },
    { id: 'les-grands-nombres', text: 'Tu n’as pas encore appris les grands nombres en classe ?' },
    { id: 'l-addition-posee', text: 'Tu n’as pas encore appris l’addition posée en classe ?' },
    { id: 'la-soustraction-posee', text: 'Tu n’as pas encore appris la soustraction posée en classe ?' },
    { id: 'les-operations-avec-des-euros', text: 'Tu n’as pas encore appris les opérations avec des euros en classe ?' },
    { id: 'la-multiplication-posee', text: 'Tu n’as pas encore appris la multiplication posée en classe ?' },
    { id: 'la-division-posee', text: 'Tu n’as pas encore appris la division posée en classe ?' },
    { id: 'les-operations-avec-des-nombres-a-vi', text: 'Tu n’as pas encore appris les opérations avec des nombres à virgule en classe ?' },
    { id: 'les-operations-avec-de-grands-nombre', text: 'Tu n’as pas encore appris les opérations avec de grands nombres en classe ?' },
    { id: 'la-division-avec-une-virgule', text: 'Tu n’as pas encore appris la division avec une virgule en classe ?' },
    { id: 'le-present', text: 'Tu n’as pas encore appris le présent en classe ?' },
    { id: 'l-imparfait', text: 'Tu n’as pas encore appris l’imparfait en classe ?' },
    { id: 'le-futur', text: 'Tu n’as pas encore appris le futur en classe ?' },
    { id: 'le-passe-compose', text: 'Tu n’as pas encore appris le passé composé en classe ?' },
    { id: 'a-reconnaitre-le-temps-d-un-verbe', text: 'Tu n’as pas encore appris à reconnaître le temps d’un verbe en classe ?' },
    { id: 'les-verbes-comme-manger-ou-appeler', text: 'Tu n’as pas encore appris les verbes comme manger ou appeler en classe ?' },
    { id: 'l-accord-du-participe-passe', text: 'Tu n’as pas encore appris l’accord du participe passé en classe ?' },
    { id: 'le-passe-simple', text: 'Tu n’as pas encore appris le passé simple en classe ?' },
    { id: 'le-plus-que-parfait', text: 'Tu n’as pas encore appris le plus-que-parfait en classe ?' },
    { id: 'a-trouver-le-sujet-du-verbe', text: 'Tu n’as pas encore appris à trouver le sujet du verbe en classe ?' },
    { id: 'a-ajouter-ou-enlever-1-ou-2', text: 'Tu n’as pas encore appris à ajouter ou enlever 1 ou 2 en classe ?' },
    { id: 'a-ajouter-ou-enlever-des-dizaines', text: 'Tu n’as pas encore appris à ajouter ou enlever des dizaines en classe ?' },
    { id: 'a-ajouter-ou-enlever-un-petit-nombre', text: 'Tu n’as pas encore appris à ajouter ou enlever un petit nombre en classe ?' },
    { id: 'a-completer-a-la-dizaine-ou-a-100', text: 'Tu n’as pas encore appris à compléter à la dizaine ou à 100 en classe ?' },
    { id: 'a-ajouter-ou-enlever-9-19-29', text: 'Tu n’as pas encore appris à ajouter ou enlever 9, 19, 29… en classe ?' },
    { id: 'a-additionner-deux-nombres-de-tete', text: 'Tu n’as pas encore appris à additionner deux nombres de tête en classe ?' },
    { id: 'a-calculer-la-moitie', text: 'Tu n’as pas encore appris à calculer la moitié en classe ?' },
    { id: 'a-multiplier-en-decomposant', text: 'Tu n’as pas encore appris à multiplier en décomposant en classe ?' },
    { id: 'a-multiplier-par-4-ou-par-8', text: 'Tu n’as pas encore appris à multiplier par 4 ou par 8 en classe ?' },
    { id: 'a-multiplier-par-5-ou-par-50', text: 'Tu n’as pas encore appris à multiplier par 5 ou par 50 en classe ?' },
    { id: 'a-calculer-avec-des-nombres-a-virgul', text: 'Tu n’as pas encore appris à calculer avec des nombres à virgule en classe ?' },
    { id: 'a-diviser-par-4-ou-par-8', text: 'Tu n’as pas encore appris à diviser par 4 ou par 8 en classe ?' },
    { id: 'les-ordres-de-grandeur', text: 'Tu n’as pas encore appris les ordres de grandeur en classe ?' },
    { id: 'les-parentheses', text: 'Tu n’as pas encore appris les parenthèses en classe ?' },
    { id: 'les-problemes-de-plus-de-moins', text: 'Tu n’as pas encore appris les problèmes « de plus, de moins » en classe ?', say: 'Tu n’as pas encore appris les problèmes de plusse, de moins, en classe ?' },
    { id: 'les-problemes-en-plusieurs-etapes', text: 'Tu n’as pas encore appris les problèmes en plusieurs étapes en classe ?' },
    { id: 'les-problemes-de-partage', text: 'Tu n’as pas encore appris les problèmes de partage en classe ?' },
    { id: 'les-problemes-fois-plus-fois-moins', text: 'Tu n’as pas encore appris les problèmes « fois plus, fois moins » en classe ?', say: 'Tu n’as pas encore appris les problèmes fois plusse, fois moins en classe ?' },
    { id: 'les-prix-avec-une-virgule', text: 'Tu n’as pas encore appris les prix avec une virgule en classe ?' },
    { id: 'les-problemes-de-combinaisons', text: 'Tu n’as pas encore appris les problèmes de combinaisons en classe ?' },
    { id: 'les-problemes-de-durees', text: 'Tu n’as pas encore appris les problèmes de durées en classe ?' },
    { id: 'les-fractions-d-une-quantite', text: 'Tu n’as pas encore appris les fractions d’une quantité en classe ?' },
    { id: 'les-problemes-de-proportionnalite', text: 'Tu n’as pas encore appris les problèmes de proportionnalité en classe ?' },
    { id: 'les-problemes-devinettes-avec-des-ba', text: 'Tu n’as pas encore appris les problèmes « devinettes » avec des barres en classe ?' }
  ]),
  /* v2.4 : « Les Missions du ranch » (js/games/missions-logic.js : INTRO, SCHEMA_SAY) et les questions et indices sans
     nombre ni prénom des énoncés (js/content/maths/problemes.js), dits phrase par phrase : les plus fréquents d'abord */
  ...grp('missions', [
    { id: 'intro', text: 'Je pars en mission au ranch ! Écoute bien, puis aide-moi à trouver la réponse.' },
    { id: 'schema', text: 'Regarde le dessin : le point d’interrogation, c’est ce qu’on cherche.' },
    { id: 'combien-de-piquets-la-tempet-1miiy', text: 'Combien de piquets la tempête a-t-elle cassés ?' },
    { id: 'combien-de-litres-de-lait-la-38h6t', text: 'Combien de litres de lait la ferme avait-elle au début ?' },
    { id: 'combien-la-marchande-lui-ren-1b5qc', text: 'Combien la marchande lui rend-elle ?' },
    { id: 'combien-de-litres-de-lait-la-exe8v', text: 'Combien de litres de lait la ferme a-t-elle produits l’an dernier ?' },
    { id: 'combien-d-euros-lui-manque-t-1h8c5', text: 'Combien d’euros lui manque-t-il ?' },
    { id: 'on-cherche-le-prix-des-deux-160ao', text: 'On cherche le prix des deux achats ensemble : euros avec euros, centimes avec centimes.' },
    { id: 'combien-de-bottes-de-foin-lu-5ra08', text: 'Combien de bottes de foin lui reste-t-il ?' },
    { id: 'combien-de-litres-de-lait-la-1eixc', text: 'Combien de litres de lait la ferme a-t-elle produits cette année ?' },
    { id: 'combien-de-bottes-de-foin-re-asuee', text: 'Combien de bottes de foin reste-t-il dans la grange ?' },
    { id: 'd-abord-combien-de-bottes-de-12o2b', text: 'D’abord : combien de bottes de foin y a-t-il mercredi soir ?' },
    { id: 'combien-de-litres-de-lait-re-xesmf', text: 'Combien de litres de lait reste-t-il dans la cuve ?' },
    { id: 'combien-de-litres-de-lait-la-4jgr2', text: 'Combien de litres de lait la ferme a-t-elle produits de plus cette année ?', say: 'Combien de litres de lait la ferme a-t-elle produits de plusse cette année ?' },
    { id: 'on-compare-deux-annees-on-ch-q2kge', text: 'On compare deux années : on cherche l’écart.' },
    { id: 'combien-coute-le-seau-jmaig', text: 'Combien coûte le seau ?' },
    { id: 'd-abord-combien-coute-une-br-y4mbl', text: 'D’abord : combien coûte une brosse ?' },
    { id: 'combien-pese-le-cheval-6ad0m', text: 'Combien pèse le cheval ?' },
    { id: 'd-abord-combien-coutent-les-k9voo', text: 'D’abord : combien coûtent les deux achats ensemble ?' },
    { id: 'combien-de-litres-de-lait-la-1gd8g', text: 'Combien de litres de lait la ferme a-t-elle produits en tout ?' },
    { id: 'il-y-a-deux-parties-le-lait-1enqw', text: 'Il y a deux parties : le lait de janvier et celui de février. On cherche le tout.' },
    { id: 'combien-pese-le-poney-nkaqi', text: 'Combien pèse le poney ?' },
    { id: 'd-abord-combien-de-bottes-de-uvfis', text: 'D’abord : combien de bottes de foin sont données en tout ?' },
    { id: 'combien-de-visiteurs-sont-ve-12bth', text: 'Combien de visiteurs sont venus en tout ?' },
    { id: 'il-y-a-deux-groupes-de-visit-1ff7k', text: 'Il y a deux groupes de visiteurs : ceux du samedi et ceux du dimanche. On cherche combien il y en a en tout.' },
    { id: 'combien-coute-le-van-1m4tu', text: 'Combien coûte le van ?' },
    { id: 'combien-de-pommes-y-a-t-il-d-1dqu5', text: 'Combien de pommes y a-t-il dans le panier ?' },
    { id: 'combien-de-fers-a-cheval-pos-1tz6v', text: 'Combien de fers à cheval pose-t-il en tout ?' },
    { id: 'combien-de-kilos-de-ble-rest-1ptnt', text: 'Combien de kilos de blé reste-t-il dans le silo ?' },
    { id: 'combien-de-kilos-le-cheval-p-1xiju', text: 'Combien de kilos le cheval pèse-t-il de plus que le poney ?', say: 'Combien de kilos le cheval pèse-t-il de plusse que le poney ?' },
    { id: 'on-compare-deux-poids-on-che-1064u', text: 'On compare deux poids : on cherche l’écart.' },
    { id: 'combien-pese-le-sac-de-grain-16rqt', text: 'Combien pèse le sac de grain ?' },
    { id: 'd-abord-combien-pese-un-seau-18gg4', text: 'D’abord : combien pèse un seau d’eau ?' },
    { id: 'combien-de-poules-y-a-t-il-m-1ytkk', text: 'Combien de poules y a-t-il maintenant dans la cour ?' },
    { id: 'combien-de-litres-de-lait-re-1tt43', text: 'Combien de litres de lait reste-t-il dans le camion ?' },
    { id: 'd-abord-combien-de-litres-de-hdm0n', text: 'D’abord : combien de litres de lait sont livrés en tout ?' },
    { id: 'combien-coute-le-licol-6f24x', text: 'Combien coûte le licol ?' },
    { id: 'combien-de-tours-la-caleche-19s45', text: 'Combien de tours la calèche doit-elle faire pour que tous les visiteurs montent ?' },
    { id: 'combien-d-ufs-le-fermier-ven-16jqh', text: 'Combien d’œufs le fermier vend-il au marché ?' },
    { id: 'combien-coute-le-tracteur-mjoza', text: 'Combien coûte le tracteur ?' },
    { id: 'elle-met-le-meme-nombre-d-uf-1sqi0', text: 'Elle met le même nombre d’œufs dans chaque boîte.' },
    { id: 'combien-d-ufs-la-fermiere-me-w44rq', text: 'Combien d’œufs la fermière met-elle dans chaque boîte ?' },
    { id: 'combien-pese-le-petit-sac-y2uas', text: 'Combien pèse le petit sac ?' },
    { id: 'combien-de-litres-de-lait-la-1ukep', text: 'Combien de litres de lait la cuve contient-elle maintenant ?' },
    { id: 'combien-de-sacs-de-grain-y-a-kyypq', text: 'Combien de sacs de grain y a-t-il maintenant dans la grange ?' },
    { id: 'combien-d-ufs-la-fermiere-ve-13ypg', text: 'Combien d’œufs la fermière vend-elle au marché ?' },
    { id: 'combien-de-bottes-de-foin-y-uzhbc', text: 'Combien de bottes de foin y a-t-il maintenant dans la grange ?' },
    { id: 'combien-de-sacs-de-grain-lui-nh3po', text: 'Combien de sacs de grain lui reste-t-il ?' },
    { id: 'combien-de-carottes-la-fermi-1mm9n', text: 'Combien de carottes la fermière met-elle en tout ?' },
    { id: 'il-met-le-meme-nombre-d-ufs-14i1j', text: 'Il met le même nombre d’œufs dans chaque boîte.' },
    { id: 'combien-d-ufs-le-fermier-met-10kgu', text: 'Combien d’œufs le fermier met-il dans chaque boîte ?' },
    { id: 'combien-de-moutons-les-deux-b12l0', text: 'Combien de moutons les deux fermes ont-elles en tout ?' },
    { id: 'd-abord-combien-de-moutons-l-1hshb', text: 'D’abord : combien de moutons la ferme du Moulin a-t-elle ?' },
    { id: 'combien-d-ufs-ont-ete-ajoute-w7mtk', text: 'Combien d’œufs ont été ajoutés dans la journée ?' },
    { id: 'combien-la-fermiere-paie-t-e-uaj8w', text: 'Combien la fermière paie-t-elle en tout ?' },
    { id: 'combien-de-chevaux-sont-brun-1u2pn', text: 'Combien de chevaux sont bruns ?' },
    { id: 'd-abord-combien-de-chevaux-s-805q7', text: 'D’abord : combien de chevaux sont noirs ou blancs ?' },
    { id: 'combien-de-moutons-y-a-t-il-15rkk', text: 'Combien de moutons y a-t-il en tout ?' },
    { id: 'combien-le-fermier-paie-t-il-9bd5l', text: 'Combien le fermier paie-t-il en tout ?' },
    { id: 'combien-de-poules-les-deux-f-j7bhn', text: 'Combien de poules les deux fermes ont-elles en tout ?' },
    { id: 'd-abord-combien-de-poules-la-op11y', text: 'D’abord : combien de poules la ferme du Moulin a-t-elle ?' },
    { id: 'combien-d-euros-le-tracteur-1g78w', text: 'Combien d’euros le tracteur coûte-t-il de plus que le van ?', say: 'Combien d’euros le tracteur coûte-t-il de plusse que le van ?' },
    { id: 'on-compare-deux-prix-on-cher-12np0', text: 'On compare deux prix : on cherche l’écart.' },
    { id: 'combien-de-seaux-la-fermiere-2nq7p', text: 'Combien de seaux la fermière peut-elle remplir ?' },
    { id: 'combien-de-seaux-le-fermier-og7k4', text: 'Combien de seaux le fermier peut-il remplir ?' },
    { id: 'combien-de-boites-le-fermier-1141h', text: 'Combien de boîtes le fermier remplit-il ?' },
    { id: 'combien-d-ufs-lui-reste-t-il-f56tw', text: 'Combien d’œufs lui reste-t-il ?' },
    { id: 'combien-de-boites-pleines-la-1pngw', text: 'Combien de boîtes pleines la fermière peut-elle remplir ?' },
    { id: 'combien-de-centimetres-le-ch-1ycmd', text: 'Combien de centimètres le cheval mesure-t-il de plus que le poney ?', say: 'Combien de centimètres le cheval mesure-t-il de plusse que le poney ?' },
    { id: 'on-compare-deux-tailles-on-c-1gjjf', text: 'On compare deux tailles : on cherche l’écart.' },
    { id: 'combien-de-carottes-lui-rest-thu0y', text: 'Combien de carottes lui reste-t-il ?' },
    { id: 'combien-de-carottes-le-fermi-1kjiu', text: 'Combien de carottes le fermier met-il en tout ?' },
    { id: 'combien-de-boites-pleines-le-wvo2u', text: 'Combien de boîtes pleines le fermier peut-il remplir ?' },
    { id: 'combien-de-rubans-ont-ils-a-189oe', text: 'Combien de rubans ont-ils à eux deux ?' },
    { id: 'combien-de-kilos-de-foin-le-1t4jh', text: 'Combien de kilos de foin le poney mange-t-il par jour ?' },
    { id: 'attention-c-est-le-cheval-qu-nen87', text: 'Attention : c’est le cheval qui mange le plus. Le poney mange moins.', say: 'Attention : c’est le cheval qui mange le plusse. Le poney mange moins.' },
    { id: 'combien-de-boites-la-fermier-l3q9u', text: 'Combien de boîtes la fermière remplit-elle ?' },
    { id: 'combien-de-carottes-ont-ils-18pat', text: 'Combien de carottes ont-ils à eux deux ?' },
    { id: 'combien-de-bottes-de-foin-y-137u3', text: 'Combien de bottes de foin y a-t-il en tout ?' },
    { id: 'd-abord-combien-de-bottes-de-w4z5i', text: 'D’abord : combien de bottes de foin y a-t-il dans les piles ?' },
    { id: 'combien-d-euros-la-fermiere-hugay', text: 'Combien d’euros la fermière a-t-elle maintenant ?' },
    { id: 'combien-de-moutons-reste-t-i-5v3qb', text: 'Combien de moutons reste-t-il dans le pré ?' },
    { id: 'combien-mesure-le-poney-16r76', text: 'Combien mesure le poney ?' },
    { id: 'combien-mesure-le-cheval-1vfbg', text: 'Combien mesure le cheval ?' },
    { id: 'combien-de-pommes-lui-reste-r2vka', text: 'Combien de pommes lui reste-t-il ?' },
    { id: 'combien-de-poneys-y-a-t-il-d-9m357', text: 'Combien de poneys y a-t-il dans le pré ?' },
    { id: 'combien-de-sacs-de-grain-y-a-b6vf9', text: 'Combien de sacs de grain y a-t-il en tout ?' },
    { id: 'd-abord-combien-de-sacs-de-g-1l6rk', text: 'D’abord : combien de sacs de grain y a-t-il dans les piles ?' },
    { id: 'combien-d-euros-chaque-ferme-1921r', text: 'Combien d’euros chaque ferme reçoit-elle ?' },
    { id: 'combien-de-minutes-dure-la-b-1yinl', text: 'Combien de minutes dure la balade à poney ?' },
    { id: 'combien-de-moutons-y-a-t-il-1b7n1', text: 'Combien de moutons y a-t-il maintenant dans le pré ?' },
    { id: 'combien-de-piquets-la-fermie-i4ztb', text: 'Combien de piquets la fermière doit-elle encore planter ?' },
    { id: 'combien-de-carottes-chaque-l-1k51f', text: 'Combien de carottes chaque lapin reçoit-il ?' },
    { id: 'combien-de-bottes-completes-myqw4', text: 'Combien de bottes complètes le fermier peut-il faire ?' },
    { id: 'combien-de-piquets-le-fermie-lj6m4', text: 'Combien de piquets le fermier doit-il encore planter ?' },
    { id: 'combien-de-bottes-completes-vzrv8', text: 'Combien de bottes complètes la fermière peut-elle faire ?' },
    { id: 'combien-de-pommes-ont-ils-a-gs7ff', text: 'Combien de pommes ont-ils à eux deux ?' },
    { id: 'combien-de-chevres-reste-t-i-1w31c', text: 'Combien de chèvres reste-t-il dans le pré ?' },
    { id: 'combien-d-euros-le-fermier-a-12vqn', text: 'Combien d’euros le fermier a-t-il maintenant ?' },
    { id: 'combien-de-poules-reste-t-il-v353d', text: 'Combien de poules reste-t-il dans le pré ?' },
    { id: 'combien-de-minutes-dure-la-r-mf32q', text: 'Combien de minutes dure la randonnée ?' },
    { id: 'combien-de-poneys-y-a-t-il-m-r203d', text: 'Combien de poneys y a-t-il maintenant dans le pré ?' },
    { id: 'combien-de-minutes-dure-le-s-5nv73', text: 'Combien de minutes dure le soin des chevaux ?' },
    { id: 'd-abord-combien-coutent-les-1vm9y', text: 'D’abord : combien coûtent les sacs ? Puis les bottes ?' },
    { id: 'on-compare-deux-nombres-d-uf-18pz3', text: 'On compare deux nombres d’œufs : on cherche l’écart.' },
    { id: 'il-en-met-autant-dans-chaque-156bm', text: 'Il en met autant dans chaque râtelier.' },
    { id: 'combien-de-kilos-de-foin-le-12257', text: 'Combien de kilos de foin le fermier met-il dans chaque râtelier ?' },
    { id: 'combien-de-sacs-de-grain-le-1d9lm', text: 'Combien de sacs de grain le fermier avait-il avant la vente ?' },
    { id: 'elle-en-met-autant-dans-chaq-1p97k', text: 'Elle en met autant dans chaque râtelier.' },
    { id: 'combien-de-kilos-de-foin-la-5t3hu', text: 'Combien de kilos de foin la fermière met-elle dans chaque râtelier ?' },
    { id: 'combien-de-minutes-dure-le-c-1imx4', text: 'Combien de minutes dure le cours d’équitation ?' },
    { id: 'combien-de-chevres-sont-blan-174ig', text: 'Combien de chèvres sont blanches ?' },
    { id: 'combien-de-lapins-y-a-t-il-d-gtrba', text: 'Combien de lapins y a-t-il dans le pré ?' },
    { id: 'combien-de-chevaux-reste-t-i-pte8v', text: 'Combien de chevaux reste-t-il dans le pré ?' },
    { id: 'combien-d-ufs-sont-roux-1c94w', text: 'Combien d’œufs sont roux ?' },
    { id: 'combien-de-carottes-chaque-c-5grz4', text: 'Combien de carottes chaque chèvre reçoit-elle ?' },
    { id: 'combien-de-poneys-reste-t-il-1n3jx', text: 'Combien de poneys reste-t-il dans le pré ?' },
    { id: 'combien-de-moutons-y-a-t-il-isc9d', text: 'Combien de moutons y a-t-il dans le pré ?' },
    { id: 'on-compare-deux-nombres-de-p-1yfqe', text: 'On compare deux nombres de pommes : on cherche l’écart.' },
    { id: 'combien-de-poneys-la-fermier-10bel', text: 'Combien de poneys la fermière doit-elle encore brosser ?' },
    { id: 'combien-de-lapins-sont-gris-1wmbs', text: 'Combien de lapins sont gris ?' },
    { id: 'combien-d-ufs-la-fermiere-av-b52au', text: 'Combien d’œufs la fermière avait-elle avant la vente ?' },
    { id: 'combien-de-carottes-chaque-p-1xab9', text: 'Combien de carottes chaque poney reçoit-il ?' },
    { id: 'combien-de-bottes-de-foin-le-1yw8i', text: 'Combien de bottes de foin le fermier avait-il avant la vente ?' },
    { id: 'combien-de-poules-y-avait-il-m0c7s', text: 'Combien de poules y avait-il au ranch avant ?' },
    { id: 'combien-de-poneys-le-fermier-1jmdm', text: 'Combien de poneys le fermier doit-il encore brosser ?' },
    { id: 'il-en-vend-le-dixieme-au-mar-1p5r8', text: 'Il en vend le dixième au marché.' },
    { id: 'combien-de-pommes-chaque-pon-mapiq', text: 'Combien de pommes chaque poney reçoit-il ?' },
    { id: 'combien-de-pommes-chaque-che-wnamp', text: 'Combien de pommes chaque chèvre reçoit-elle ?' },
    { id: 'combien-de-sacs-de-grain-la-p4ui2', text: 'Combien de sacs de grain la fermière avait-elle avant la vente ?' },
    { id: 'il-en-vend-le-tiers-au-march-v4nd8', text: 'Il en vend le tiers au marché.' },
    { id: 'elle-en-vend-le-quart-au-mar-vvudy', text: 'Elle en vend le quart au marché.' },
    { id: 'combien-de-moutons-y-avait-i-1c73v', text: 'Combien de moutons y avait-il au ranch avant ?' },
    { id: 'combien-d-ufs-le-fermier-ava-1oeee', text: 'Combien d’œufs le fermier avait-il avant la vente ?' },
    { id: 'combien-de-pommes-ont-elles-166qu', text: 'Combien de pommes ont-elles à elles deux ?' },
    { id: 'combien-de-rubans-ont-elles-1ysla', text: 'Combien de rubans ont-elles à elles deux ?' },
    { id: 'combien-de-chevaux-y-a-t-il-tjbbh', text: 'Combien de chevaux y a-t-il maintenant dans le pré ?' },
    { id: 'combien-de-poules-y-a-t-il-d-1s8ab', text: 'Combien de poules y a-t-il dans le pré ?' },
    { id: 'combien-de-poules-sont-noire-1vafo', text: 'Combien de poules sont noires ?' },
    { id: 'combien-la-fermiere-paie-t-e-1xgbi', text: 'Combien la fermière paie-t-elle ?' },
    { id: 'combien-le-fermier-paie-t-il-1sau7', text: 'Combien le fermier paie-t-il ?' },
    { id: 'elle-en-vend-la-moitie-au-ma-hukof', text: 'Elle en vend la moitié au marché.' },
    { id: 'elle-en-vend-les-deux-cinqui-jlqu7', text: 'Elle en vend les deux cinquièmes au marché.' },
    { id: 'combien-de-poneys-sont-bruns-xczmt', text: 'Combien de poneys sont bruns ?' },
    { id: 'combien-de-bottes-de-foin-la-uj13q', text: 'Combien de bottes de foin la fermière avait-elle avant la vente ?' },
    { id: 'elle-en-vend-le-cinquieme-au-1ncz4', text: 'Elle en vend le cinquième au marché.' },
    { id: 'elle-en-vend-le-dixieme-au-m-1m03f', text: 'Elle en vend le dixième au marché.' },
    { id: 'il-en-vend-la-moitie-au-marc-wnsis', text: 'Il en vend la moitié au marché.' },
    { id: 'il-en-vend-le-quart-au-march-dpn78', text: 'Il en vend le quart au marché.' },
    { id: 'elle-en-vend-les-deux-tiers-2d5iu', text: 'Elle en vend les deux tiers au marché.' },
    { id: 'combien-de-chevres-y-a-t-il-1ei4e', text: 'Combien de chèvres y a-t-il dans le pré ?' },
    { id: 'combien-de-chevres-y-avait-i-g2cvb', text: 'Combien de chèvres y avait-il au ranch avant ?' },
    { id: 'il-en-vend-les-trois-quarts-pv86c', text: 'Il en vend les trois quarts au marché.' },
    { id: 'il-en-vend-les-trois-dixieme-1sd7z', text: 'Il en vend les trois dixièmes au marché.' },
    { id: 'combien-de-carottes-ont-elle-r3roa', text: 'Combien de carottes ont-elles à elles deux ?' },
    { id: 'il-en-vend-les-deux-tiers-au-1kyd1', text: 'Il en vend les deux tiers au marché.' },
    { id: 'il-en-vend-les-deux-cinquiem-1u0uv', text: 'Il en vend les deux cinquièmes au marché.' },
    { id: 'elle-en-vend-le-tiers-au-mar-k4g05', text: 'Elle en vend le tiers au marché.' },
    { id: 'elle-en-vend-les-trois-dixie-1diom', text: 'Elle en vend les trois dixièmes au marché.' },
    { id: 'il-en-vend-le-cinquieme-au-m-17amj', text: 'Il en vend le cinquième au marché.' },
    { id: 'combien-de-poneys-y-avait-il-1a6xr', text: 'Combien de poneys y avait-il au ranch avant ?' },
    { id: 'elle-en-vend-les-trois-quart-s53jn', text: 'Elle en vend les trois quarts au marché.' }
  ]),
  ...grp('boutique', [
    ...['poney', 'cheval', 'chat', 'capybara', 'dauphin', 'lion', 'licorne', 'dragon',
      'ours', 'koala', 'chien', 'baleine', 'chouette', 'perroquet', 'pingouin', 'poussin'].map(n => 'Et en ' + n + ' ?'),   /* v2.5 : 8 de plus */
    ...[['foulard', 'le foulard'], ['noeud', 'le nœud'], ['chapeau', 'le chapeau'], ['lunettes', 'les lunettes'], ['echarpe', 'l’écharpe'],
      ['selle', 'la selle dorée'], ['couronne', 'la couronne'], ['ailes', 'les ailes de fée']]
      .map(([id, w]) => ({ id: 'essaie-' + id, text: '{N} essaie ' + w + ' ✨', say: 'J’essaie ' + w + ' !' })),
    { id: 'a-toi-chic', text: 'C’est à toi ! {N} est trop chic ! ✨', say: 'C’est à toi ! Je suis trop chic !' },
    { id: 'chic', text: '{N} est trop chic ! ✨', say: 'Je suis trop chic !' },
    'C’est à toi !'
  ]),
  /* premiers pas, espace parents, essai de la voix */
  ...grp('divers', [
    'Une question pour tes parents. Montre cet écran à un adulte.',
    { id: 'test', text: 'Bonjour {P} ! Je suis {N}, et je lis les consignes à voix haute.', say: 'Bonjour ! Je suis ton compagnon, et je lis les consignes à voix haute.' }
  ]),
  /* « 📲 Mets Caramel sur l'écran d'accueil » côté enfant (js/ui/install.js, kidSpeech) : titre et « pourquoi » (dits à
     l'ouverture de la feuille, et par le 🔊 de la bannière), ordinateur compris ; marche à suivre de l'iPhone et de l'iPad
     (KID_STEPS_SAY, 🔊 de la feuille : les pastilles y sont des mots ; « iPad » se dit « aïe-pad ») */
  ...grp('inst', [
    { id: 'titre', text: 'Mets Caramel sur l’écran d’accueil.' },
    { id: 'pourquoi', text: 'Tu le retrouveras en un geste, et tu pourras jouer même sans internet.' },
    { id: 'titre-pc', text: 'Installe Caramel sur l’ordinateur.' },
    { id: 'pourquoi-pc', text: 'Tu l’ouvriras d’un clic, dans sa propre fenêtre, et tu pourras jouer même sans internet.' },
    { id: 'safari-1', text: 'Touche Partager, en bas de l’écran ; sur iPad, en haut. Pas de bouton ? Touche d’abord les trois petits points.',
      say: 'Touche Partager, en bas de l’écran ; sur aïe-pad, en haut. Pas de bouton ? Touche d’abord les trois petits points.' },
    { id: 'safari-2', text: 'Choisis : Sur l’écran d’accueil. Fais défiler si besoin.' },
    { id: 'chrome-1', text: 'Touche Partager, à droite de la barre d’adresse.' },
    { id: 'chrome-2', text: 'Choisis : Ajouter à l’écran d’accueil. Fais défiler si besoin.' },
    { id: 'ajouter', text: 'Touche Ajouter.' }
  ]),
  /* encouragements (js/ui/kit.js, CHEERS) : « retry » devant l'astuce, « learn » devant l'explication et la bonne
     réponse de la course. « right » et « helped » ne sont dits qu'avec l'explication de l'atelier des opérations, et
     « end » jamais : voix du téléphone (poids). */
  ...grp('retry', ['Presque !', 'Tu y es presque !', 'Pas tout à fait !', 'Pas encore !', 'Encore un essai !',
    'Tu chauffes !', 'Courage !', 'On réessaie ?', 'Tu vas trouver !', 'Bien essayé !']),
  ...grp('appris', ['Maintenant, tu sais !', 'La prochaine fois, ce sera la bonne !', 'C’est comme ça qu’on apprend.',
    'Retiens bien, ça va resservir !', 'Pas de souci, on reverra ça bientôt.', 'Tu sauras la prochaine fois !',
    'On apprend en essayant !', 'Chaque essai te fait progresser !', 'Bien regardé, on continue !',
    { text: 'Une de plus dans ta tête !', say: 'Une de plusse dans ta tête !' }, 'Garde ça en tête, et on avance !', 'Tu l’auras la prochaine fois !',
    'On continue, tu progresses !']),

  /* ----- morceaux pour composer -----
     Questions de calcul (tables, pommes, opérations posées, clôture) et phrases à nombre (« Il te manque 5 🍎 »,
     « Tu as trouvé 7 réponses du premier coup ! », « Le chapeau remplace le foulard »), puis les astuces et
     explications les plus fréquentes du CP et du CE1, choisies par ordre de phrases couvertes par octet (échantillon de
     24 000 phrases des générateurs, A = 0 à 2,1) dans le budget de 1,5 Mo : 87 % des phrases de l'échantillon sont
     dites par la voix enregistrée ; les autres astuces (pommes, tables) passent par la voix du téléphone. */
  ...frag([
    /* calcul */
    { text: 'plus', say: 'plusse' }, 'moins', 'fois', 'divisé par', 'égale', 'font', 'et', 'c’est', 'est', 'car', 'puis',
    'égale combien ?', 'est combien ?', 'combien égale', { text: 'plus combien ?', say: 'plusse combien ?' },
    { text: 'plus combien égale', say: 'plusse combien égale' }, 'fois combien égale', 'fois combien ?',
    { text: 'combien plus', say: 'combien plusse' }, 'combien fois', 'combien moins', 'moins combien égale', 'Combien font',
    'Le double de', 'La moitié de', 'Double de', 'Moitié de',
    /* phrases à nombre */
    'Il te manque', 'pommes.', 'pomme.', 'pommes', 'pomme', 'Tu as trouvé', 'réponses du premier coup !', 'J’ai entendu',
    /* v2.6 : bilan de la dictée « Tu as su écrire 5 mots du premier coup ! » */ 'Tu as su écrire', 'mots du premier coup !',
    'Petit coup de pouce :', 'Petit coup de pouce !', 'Astuce :', 'Place', 'sur la clôture.',
    /* boutique : « Le chapeau remplace le foulard », « Les lunettes retournent dans le coffre » */
    'le foulard', 'le nœud', 'le chapeau', 'les lunettes', 'l’écharpe', 'la selle dorée', 'la couronne', 'les ailes de fée',
    'remplace', 'remplacent', 'retourne dans le coffre.', 'retournent dans le coffre.',
    /* opérations posées : consigne de chaque étape (js/games/operations-logic.js) */
    'Quel chiffre écris-tu ?', 'Unités :', 'Dizaines :', 'Centaines :', 'Milliers :', 'de retenue.', 'de retenue égale', 'en bas,',
    'il n’y a que', 'rien à enlever.', 'rien à ajouter.', 'je pose', 'et je retiens', 'Vérifie :', 'Le total dépasse',
    'écris seulement son chiffre des unités et garde les dizaines en retenue.',
    'N’oublie pas la retenue écrite en haut de la colonne.', 'Ajoute les chiffres de la colonne.',
    /* tables : astuces et explications (js/content/maths/faits.js) */
    'Pense à tes dix doigts : lève-en', 'Combien en reste-t-il de baissés ?', 'donc le nombre qui manque est', 'De', 'à',
    'c’est le double', 'c’est le double de', 'il y a', 'Donc', 'dizaines.', 'unités.', 'dizaines et',
    /* pommes : « Ajouter 1, c'est trouver le nombre qui vient juste après. » (js/content/maths/procedures.js) */
    'Ajouter', 'Enlever', { id: 'trouver-apres-f', text: 'c’est trouver le nombre qui vient juste après.' },
    { id: 'trouver-avant-f', text: 'c’est trouver le nombre qui vient juste avant.' }, 'Juste après', 'Juste avant', 'vient',
    /* clôture : astuces et explications (js/content/maths/ligne.js) */
    'Entre', 'petits intervalles :', 'chaque petit piquet vaut', 'Le drapeau est', 'petits piquets après', 'petit piquet après',
    'petits piquets avant', 'piquets après', 'est entre', 'il faut avancer de', 'petits piquets font'
  ])
];

/* nombres : 0 à 100 (continuation ; fin de 0 à 20 et 100), « une », devant une consonne (-pc), centaines, mille, millions,
   virgule (milliards : voix du téléphone) */
function numberEntries() {
  const out = [];
  for (let n = 0; n <= NUM_WHOLE; n++) {
    const w = word100(n);
    out.push({ id: 'n' + n, text: String(n), say: w, cut: 'carrier', num: true });
    if (n <= 20 || n === 100) out.push({ id: 'n' + n + '-f', text: String(n), say: w + '.', num: true });
    if (FEM_ONE.has(n)) out.push({ id: 'n' + n + '-une', text: String(n), say: femWord(n), cut: 'carrier', num: true });
    if (PC.has(n)) out.push({ id: 'n' + n + '-pc', text: String(n), say: PC.get(n), cut: 'carrier', num: true });
  }
  for (let h = 2; h <= 9; h++) {
    out.push({ id: 'c' + h, text: String(h * 100), say: UNITS[h] + ' cent', cut: 'carrier', num: true });
  }
  for (const [id, w] of [['mille', 'mille'], ['million', 'million'], ['millions', 'millions']]) {
    out.push({ id, text: w, say: w, cut: 'carrier', num: true });
    out.push({ id: id + '-f', text: w, say: w + '.', num: true });
  }
  out.push({ id: 'virgule', text: 'virgule', say: 'virgule', cut: 'carrier', num: true });
  return out;
}

export const LINES = Object.freeze([...SRC, ...numberEntries()].map(e => Object.freeze(e)));
export const LINE_BY_ID = Object.freeze(Object.fromEntries(LINES.map(e => [e.id, e])));
const NAMED = /\{[PN]\}/;
export const isNamed = e => NAMED.test(e.text);

/* phrases les plus courantes, mises en cache en tâche de fond quand la voix est active (js/ui/voice.js) : visite,
   1re partie, bilans, mots doux (« Presque ! »), consignes des jeux, nombres de 0 à 20 et morceaux des questions de
   calcul (≈ 115 clips, 555 Ko). Les autres (soins, boutique, micro en panne, grands nombres, astuces, explications)
   arrivent dans le cache à leur première écoute. */
const COMMON_FRAG = ['plus', 'moins', 'fois', 'egale', 'egale-combien-f', 'est-combien-f', 'plus-combien-f', 'plus-combien-egale',
  'combien-plus', 'le-double-de', 'la-moitie-de', 'c-est', 'et', 'donc', 'astuce', 'petit-coup-de-pouce', 'petit-coup-de-pouce-f',
  'il-te-manque', 'pommes', 'pommes-f', 'tu-as-trouve', 'reponses-du-premier-coup-f', 'place', 'sur-la-cloture-f'].map(s => 'm.' + s);
const COMMON_SKIP = /^course\.(micro-ko|bloque|pas-de-micro|internet|ici|demande)|^tables\.(micro|tape-la-reponse-avec)/;
export function commonIds() {
  const order = ['tour.', 'hello.', 'bilan.', 'n', 'm.', 'retry.', 'tables.', 'pommes.', 'cloture.', 'course.'];
  const rank = id => order.findIndex(p => id.startsWith(p));
  return LINES.filter(e => (e.num ? /^n(\d|1\d|20)(-f|-une|-pc)?$/.test(e.id) : rank(e.id) >= 0 && (!e.id.startsWith('m.') || COMMON_FRAG.includes(e.id))))
    .map(e => e.id).filter(id => !COMMON_SKIP.test(id)).sort((x, y) => rank(x) - rank(y));
}

/* ce que Piper lit pour une entrée (sans la phrase porteuse : tools/voix.mjs l'ajoute pour cut === 'carrier') */
export function synthText(e) {
  return String(e.say || speakable(e.text)).replace(/\s+/g, ' ').trim();
}

/* ---------- reconnaissance ---------- */
const PE = '\uE000', PF = '\uE001';           /* repère d'une phrase à prénom reconnue (caractères privés) */
/* texte affiché normalisé (espaces, apostrophes, espaces fines de frTypo) */
export function rawNorm(s) {
  return String(s ?? '').normalize('NFC').replace(/[\u202F\u00A0\u2009\u2007]/g, ' ').replace(/[‘’ʼ']/g, '’')
    .replace(/\uFE0F/g, '').replace(/\s+([!?:;»])/g, '$1').replace(/«\s+/g, '«').replace(/\s+/g, ' ').trim();
}
const PUNCT = { ',': 1, ';': 2, ':': 2, '(': 1, ')': 1, '—': 1, '–': 1, '«': 1, '»': 1, '“': 1, '”': 1, '"': 1, '.': 3, '!': 3, '?': 3, '…': 3 };
/* texte à dire → jetons { w (mot en minuscules | chiffres), num, mark, pb (ponctuation avant : 0 rien, 1 virgule,
   2 deux-points, 3 fin de phrase), q (la phrase finit par « ? ») } ; tout autre signe (€, %, /, <, °…) est un mot
   à part entière, que l'inventaire n'a pas : il n'est jamais tu */
export function tokens(spoken) {
  const out = [];
  let pb = 0;
  const re = /\uE000(\d+)\uE001|(\d+(?:,\d+)?)(?![\p{L}\d])|([\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*)|([,;:()—–«»“”".!?…+=−-])|([^\s’'])/gu;
  let m;
  while ((m = re.exec(spoken))) {
    if (m[1] !== undefined) { out.push({ mark: Number(m[1]), pb }); pb = 0; continue; }
    if (m[2] !== undefined) { out.push({ w: m[2], num: true, pb }); pb = 0; continue; }
    if (m[3] !== undefined) {
      const w = m[3].toLowerCase().replace(/'/g, '’');
      const n = WORD_NUM.get(w);
      out.push(n !== undefined && !/^(un|une)$/.test(w) ? { w: String(n), num: true, word: w, pb } : { w, pb });
      pb = 0; continue;
    }
    if (m[5] !== undefined) { out.push({ w: m[5], pb }); pb = 0; continue; }
    const p = m[4];
    if (p === '+') { out.push({ w: 'plus', pb }); pb = 0; continue; }
    if (p === '=') { out.push({ w: 'égale', pb }); pb = 0; continue; }
    if (p === '−' || (p === '-' && /\d/.test(spoken[re.lastIndex] || ''))) { out.push({ w: 'moins', pb }); pb = 0; continue; }
    pb = Math.max(pb, PUNCT[p] || 0);
    if (p === '?' && out.length) out[out.length - 1].q = true;
  }
  return out;
}
export const voiceKey = s => tokens(speakable(s)).map(t => t.w).join(' ');

/* dictionnaire des morceaux : clé (mots en minuscules) → { c, f } : variante de continuation (lue dans la phrase
   porteuse, ou sans ponctuation finale) et variante de fin de phrase ; entrées sans prénom ni nombre */
const DICT = new Map();
let MAXL = 1;
export const endsSentence = e => /[.!?…]$/.test(synthText(e)) && e.cut !== 'carrier';
for (const e of LINES) {
  if (e.num || isNamed(e)) continue;
  const k = voiceKey(e.text);
  if (!k) continue;
  const v = DICT.get(k) || {};
  const slot = endsSentence(e) ? 'f' : 'c';
  if (!v[slot]) v[slot] = e.id;
  DICT.set(k, v);
  MAXL = Math.max(MAXL, k.split(' ').length);
}
export const DICT_SIZE = DICT.size;
/* variante : en fin de phrase 'f' (à défaut 'c') ; au milieu d'une phrase 'c' seulement : un morceau à intonation de
   fin (« … juste après. ») suivi d'un mot de la même phrase ferait tomber la voix trop tôt */
const pickVariant = (v, atEnd, has) => {
  if (!atEnd) return v.c && has(v.c) ? v.c : null;
  return [v.f, v.c].find(id => id && has(id)) || null;
};

/* phrases à prénom remplies pour l'enfant actif : fill(texte) → texte affiché (fillTemplate de js/core/profiles.js) */
export function namedLines(fill) {
  const out = [];
  for (const e of LINES) {
    if (!isNamed(e)) continue;
    let t = '';
    try { t = rawNorm(fill(e.text)); } catch (_) { t = ''; }
    if (t && !NAMED.test(t)) out.push({ id: e.id, filled: t });
  }
  return out.sort((a, b) => b.filled.length - a.filled.length);
}

/* plan de lecture d'une suite de jetons → { cost, steps: [{ i, len, ids }], skipped: Set } ; programmation dynamique :
   le moins de clips possible (les morceaux les plus longs, donc les plus naturels), un mot non couvert coûtant SKIP.
   Un morceau peut enjamber une fin de phrase (« Très belle lecture ! Bats Zip… » est UN clip). */
const SKIP = 1000;
/* nombre suivi du nom qu'il compte (même groupe, sans ponctuation entre eux) : les clips des nombres sont enregistrés
   seuls (« six » [sis]) ; devant une consonne, six, huit, dix → variante -pc (« six pommes » [si]) ; devant une voyelle,
   la liaison (« trois unités » [z], « vingt euros » [t], « un intervalle » [n]) n'est pas enregistrée → téléphone */
const NOUN_C = /^(pommes?|réponses?|dizaines?|centaines?|milliers?|petits?|piquets?|doigts|minutes?|secondes?|carottes?|fractions?)$/;
const NOUN_V = /^(unités?|intervalles?|euros?|étoiles?|heures?|ans)$/;
const END_C = /(^|[\s-])(six|huit|dix)$/;
const END_V = /(^|[\s-])(un|deux|trois|six|dix|vingts?|cents?)$/;
const saidOf = id => { const e = LINE_BY_ID[id]; return e ? synthText(e).replace(/[\s.]+$/, '') : ''; };
/* « fois » (calcul) : « six fois sept » [si] avec la variante ; sans variante (« cinquante-huit fois dix »), le nombre
   entier reste ([ɥit] devant « fois » est courant) : les questions de calcul ne quittent pas la voix enregistrée */
function beforeNoun(ids, noun) {
  if (!noun || !ids.every(Boolean)) return ids;
  const k = ids.length - 1, said = saidOf(ids[k]);
  if ((NOUN_C.test(noun) || noun === 'fois') && END_C.test(said)) {
    const pc = ids[k] + '-pc';
    if (LINE_BY_ID[pc]) return [...ids.slice(0, k), pc];
    return noun === 'fois' ? ids : [null];
  }
  if (NOUN_V.test(noun) && END_V.test(said)) return [null];
  return ids;
}
function planTokens(tk, has) {
  const n = tk.length;
  const memo = new Array(n + 1);
  memo[n] = { cost: 0, steps: [] };
  const endAt = j => j >= n || tk[j].pb >= 3;                 /* fin de phrase juste avant le jeton j */
  for (let i = n - 1; i >= 0; i--) {
    let best = null;
    const t = tk[i];
    const take = (len, ids, skip = false) => {
      const rest = memo[i + len];
      const cost = (skip ? SKIP : ids.length) + rest.cost;
      if (!best || cost < best.cost) best = { cost, steps: [{ i, len, ids, skip }, ...rest.steps] };
    };
    if (t.mark !== undefined) take(1, [t.id]);
    else {
      let key = '';
      for (let L = 1; L <= MAXL && i + L <= n; L++) {
        const u = tk[i + L - 1];
        if (u.mark !== undefined) break;
        key = L === 1 ? u.w : key + ' ' + u.w;
        const v = DICT.get(key);
        const id = v && pickVariant(v, endAt(i + L), has);
        if (id) take(L, [id]);
      }
      if (t.num) {
        /* intonation : fin de phrase descendante, sauf question ; devant un nom féminin : « une » ; variante de fin
           absente (au-delà de 20) : celle de continuation */
        const nx = endAt(i + 1) ? null : tk[i + 1];
        const end = !nx && !t.ask ? 'f' : 'c';
        const fem = !!(nx && FEM_WORDS.has(nx.w)) || t.word === 'une';
        const ids = beforeNoun(numberClips(t.w, { end, fem }) || [null], nx && !nx.pb && nx.w).map(id => (id && has(id) ? id : id && /-f$/.test(id) && has(id.slice(0, -2)) ? id.slice(0, -2) : null));
        if (ids.every(Boolean)) take(1, ids);
      }
    }
    take(1, [], true);
    memo[i] = best;
  }
  return memo[0];
}
const gapOf = pb => (pb >= 3 ? GAP.sentence : pb === 2 ? GAP.colon : pb === 1 ? GAP.comma : GAP.word);

/* texte affiché → plan de lecture. has(id) : le clip existe (manifeste) ; named : namedLines(fill) de l'enfant actif */
export function planSpeech(text, { has = () => true, named = [] } = {}) {
  let raw = rawNorm(text).replace(/(\d) (?=\d{3}(?!\d))/g, '$1');
  const marks = [];
  for (const nl of named) {
    if (!nl.filled || !raw.includes(nl.filled) || !has(nl.id)) continue;
    /* la ponctuation finale reste après le repère : elle sépare la phrase suivante */
    const tail = (/[.!?…]+$/.exec(nl.filled.replace(/[\s\p{Extended_Pictographic}\uFE0F\u200D]+$/u, '')) || [''])[0];
    raw = raw.split(nl.filled).join(' ' + PE + marks.length + PF + tail + ' ');
    marks.push(nl.id);
  }
  const tk = tokens(speakable(raw)).map(t => (t.mark !== undefined ? { ...t, id: marks[t.mark] } : t));
  /* phrases (au sens « . ! ? … ») : numéro de chaque jeton, question ou non */
  let sn = 0;
  tk.forEach((t, i) => { if (i && t.pb >= 3) sn++; t.s = sn; });
  const ask = new Set(tk.filter((t, i) => t.q && (i + 1 === tk.length || tk[i + 1].pb >= 3)).map(t => t.s));
  tk.forEach(t => { t.ask = ask.has(t.s); });
  if (!tk.length) return { ok: false, sentences: [], clips: [], missing: [] };
  const r = planTokens(tk, has);
  const bad = new Set(), missing = [];
  for (const st of r.steps) if (st.skip) { bad.add(tk[st.i].s); missing.push(tk[st.i].w); }
  const sentences = Array.from({ length: sn + 1 }, (_, k) => ({ ok: !bad.has(k) }));
  /* clips : tous si tout est couvert ; sinon ceux des phrases entièrement couvertes (lecture partielle) */
  const clips = [];
  let prev = 0;
  for (const st of r.steps) {
    if (st.skip) continue;
    const s0 = tk[st.i].s, s1 = tk[st.i + st.len - 1].s;
    let okSpan = true;
    for (let k = s0; k <= s1; k++) if (bad.has(k)) okSpan = false;
    if (!okSpan) continue;
    st.ids.forEach((id, j) => {
      /* silence avant le clip : ponctuation qui le précède ; après une phrase sautée, une fin de phrase */
      const gap = !clips.length ? 0 : j > 0 ? GAP.word : prev === st.i ? gapOf(tk[st.i].pb) : GAP.sentence;
      clips.push({ id, gap });
    });
    prev = st.i + st.len;
  }
  return { ok: bad.size === 0, sentences, clips, missing };
}
