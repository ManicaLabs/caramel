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

/* ---------- réglages de l'enchaînement (mesurés : tools/voix.mjs --mesure) ---------- */
export const GAP = Object.freeze({ word: 0, comma: 220, colon: 260, sentence: 480 });
export const NUM_WHOLE = 100;                 /* 0 à 100 : un clip par nombre */
const FEM_WORDS = new Set(['pomme', 'pommes', 'étoile', 'étoiles', 'réponse', 'réponses', 'dizaine', 'dizaines', 'centaine',
  'centaines', 'unité', 'unités', 'minute', 'minutes', 'seconde', 'secondes', 'carotte', 'carottes', 'fraction', 'fractions']);
const FEM_ONE = new Set([1, 21, 31, 41, 51, 61, 81]);
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
  /* compagnon de l'accueil : soins, boutique (js/ui/companion.js, sayOut) */
  ...grp('soin', [
    { id: 'carotte', text: '{N} croque 🥕 avec appétit. Miam !', say: 'Je croque la carotte avec appétit. Miam !' },
    { id: 'poire', text: '{N} croque 🍐 avec appétit. Miam !', say: 'Je croque la poire avec appétit. Miam !' },
    { id: 'tarte', text: '{N} croque 🥧 avec appétit. Miam !', say: 'Je croque la tarte avec appétit. Miam !' },
    { id: 'belle', text: '{N} est déjà toute belle ✨ Reviens un peu plus tard !', say: 'Je suis déjà toute belle ! Reviens un peu plus tard !' },
    { id: 'beau', text: '{N} est déjà tout beau ✨ Reviens un peu plus tard !', say: 'Je suis déjà tout beau ! Reviens un peu plus tard !' },
    { id: 'brosse-poil', text: '{N} adore le brossage, quel beau poil ! ✨', say: 'J’adore le brossage, quel beau poil !' },
    { id: 'brosse-peau', text: '{N} adore le brossage, quelle peau toute douce ! ✨', say: 'J’adore le brossage, quelle peau toute douce !' },
    { id: 'brosse-ecailles', text: '{N} adore le brossage, quelles belles écailles ! ✨', say: 'J’adore le brossage, quelles belles écailles !' },
    { id: 'promenade-faite', text: '{N} a déjà eu sa promenade du jour 🚶 À demain !', say: 'J’ai déjà eu ma promenade du jour. À demain !' },
    { id: 'promenade', text: '{N} part en promenade, quel bonheur ! 🚶', say: 'Je pars en promenade, quel bonheur !' },
    { id: 'en-promenade', text: '{N} est en promenade… attends son retour ! 🚶', say: 'Je suis en promenade… attends mon retour !' },
    'Tu les gagnes en jouant !'
  ]),
  ...grp('boutique', [
    ...['poney', 'cheval', 'chat', 'capybara', 'dauphin', 'lion', 'licorne', 'dragon'].map(n => 'Et en ' + n + ' ?'),
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
