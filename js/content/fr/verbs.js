/* ============ CONJUGAISON : moteur et données des verbes (axe fr.conjug) ============
   Module pur (aucun DOM, aucun stockage), importable par Node.

   conjugate(verbe, temps, personne, { g, cod }) → { form, aux?, participle?, auxVerb? } | null
     verbe     : infinitif tel qu'il s'écrit ('être', 'écouter', 'réussir'…) — liste : VERBS ;
     temps     : 'present' | 'imparfait' | 'futur' | 'passe_compose' | 'passe_simple' | 'plus_que_parfait' ;
     personne  : '1s' '2s' '3s' '1p' '2p' '3p' ;
     g         : 'm' | 'f' — genre du sujet pour l'accord du participe passé avec « être »
                 (le nombre se déduit de la personne) ;
     cod       : { g, n } — COD placé avant le verbe (auxiliaire « avoir ») : le participe s'accorde avec lui.
     form      : forme complète SANS le pronom ('sont allées', 'chantaient', 'avait fini').
   Temps composés : passé composé = auxiliaire au présent + participe passé ;
                    plus-que-parfait = auxiliaire à l'imparfait + participe passé.

   Orthographe traditionnelle courante (pas de variantes de 1990) ; verbes à double orthographe admise
   (payer, essayer, préférer…) volontairement absents. Variations du radical du 1er groupe :
     -ger   e devant a/o (nous mangeons, il mangeait, il mangea)
     -cer   ç devant a/o (nous commençons, il commençait)
     ll/tt  consonne doublée devant e muet et au futur (il appelle, il jettera)
     è      e muet → è devant e muet et au futur (il achète, il lèvera)
     -yer   y → i devant e muet et au futur (il nettoie, il essuiera) ; envoyer : futur enverr-.
   3e groupe : tables écrites à la main (présent, passé simple), radicaux de l'imparfait et du futur.
   Élision : pronoun(personne, forme, g) → « j’ » devant voyelle ou h muet (aucun h aspiré dans la liste). */

export const TENSES = ['present', 'imparfait', 'futur', 'passe_compose', 'passe_simple', 'plus_que_parfait'];
export const SIMPLE_TENSES = ['present', 'imparfait', 'futur', 'passe_simple'];
/* temps composé → temps de l'auxiliaire */
export const COMPOUND_TENSES = { passe_compose: 'present', plus_que_parfait: 'imparfait' };
export const PERSONS = ['1s', '2s', '3s', '1p', '2p', '3p'];

export const TENSE_LABEL = {
  present: 'présent', imparfait: 'imparfait', futur: 'futur', passe_compose: 'passé composé',
  passe_simple: 'passé simple', plus_que_parfait: 'plus-que-parfait'
};
/* « au présent », « à l’imparfait »… */
export const TENSE_AT = {
  present: 'au présent', imparfait: 'à l’imparfait', futur: 'au futur', passe_compose: 'au passé composé',
  passe_simple: 'au passé simple', plus_que_parfait: 'au plus-que-parfait'
};
/* « le présent », « l’imparfait »… (étiquettes des choix, comme aux Repères) */
export const TENSE_THE = {
  present: 'le présent', imparfait: 'l’imparfait', futur: 'le futur', passe_compose: 'le passé composé',
  passe_simple: 'le passé simple', plus_que_parfait: 'le plus-que-parfait'
};
export const PERSON_LABEL = {
  '1s': '1re personne du singulier', '2s': '2e personne du singulier', '3s': '3e personne du singulier',
  '1p': '1re personne du pluriel', '2p': '2e personne du pluriel', '3p': '3e personne du pluriel'
};
export const PERSON_PRONOUNS = { '1s': 'je', '2s': 'tu', '3s': 'il/elle', '1p': 'nous', '2p': 'vous', '3p': 'ils/elles' };

/* ---------- Terminaisons ---------- */
export const ENDINGS = {
  present1: ['e', 'es', 'e', 'ons', 'ez', 'ent'],
  present2: ['is', 'is', 'it', 'issons', 'issez', 'issent'],
  imparfait: ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'],
  futur: ['ai', 'as', 'a', 'ons', 'ez', 'ont'],
  ps1: ['ai', 'as', 'a', 'âmes', 'âtes', 'èrent'],
  ps2: ['is', 'is', 'it', 'îmes', 'îtes', 'irent']
};
const MUTE = new Set([0, 1, 2, 5]);            /* présent : terminaisons à e muet (-e, -es, -e, -ent) */

/* ---------- 1er groupe : infinitif → variante du radical ('' = régulier) ---------- */
const G1 = {
  jouer: '', chanter: '', danser: '', parler: '', aimer: '', regarder: '', marcher: '', sauter: '',
  donner: '', porter: '', chercher: '', trouver: '', écouter: '', fermer: '', dessiner: '', préparer: '',
  raconter: '', ramasser: '', grimper: '', galoper: '', briller: '', laver: '', travailler: '', apporter: '',
  crier: '', oublier: '', colorier: '', habiter: '', visiter: '', pleurer: '', souffler: '', sonner: '',
  voler: '', tourner: '', gagner: '', garder: '', siffler: '', rouler: '', planter: '', arroser: '',
  miauler: '', cuisiner: '', demander: '', chuchoter: '', pousser: '', tirer: '', brosser: '', caresser: '',
  rêver: '', arriver: '', entrer: '', tomber: '', rester: '', monter: '', rentrer: '',
  manger: 'ger', nager: 'ger', ranger: 'ger', partager: 'ger', voyager: 'ger', plonger: 'ger',
  commencer: 'cer', lancer: 'cer', avancer: 'cer', annoncer: 'cer',
  appeler: 'll', jeter: 'tt',
  acheter: 'è', lever: 'è', promener: 'è',
  nettoyer: 'yer', essuyer: 'yer', aboyer: 'yer', appuyer: 'yer', envoyer: 'envoyer'
};

/* ---------- 2e groupe ---------- */
const G2 = ['finir', 'choisir', 'grandir', 'réussir', 'remplir', 'obéir', 'rougir', 'applaudir', 'bondir',
  'ralentir', 'fleurir', 'atterrir', 'nourrir', 'franchir'];

/* ---------- 3e groupe, être et avoir : tables écrites à la main ----------
   p = présent (6 formes), i = radical de l'imparfait, f = radical du futur, s = passé simple (6 formes),
   pp = participe passé (masculin singulier) */
const IRR = {
  'être':    { p: 'suis es est sommes êtes sont', i: 'ét', f: 'ser', s: 'fus fus fut fûmes fûtes furent', pp: 'été' },
  avoir:     { p: 'ai as a avons avez ont', i: 'av', f: 'aur', s: 'eus eus eut eûmes eûtes eurent', pp: 'eu' },
  aller:     { p: 'vais vas va allons allez vont', i: 'all', f: 'ir', s: 'allai allas alla allâmes allâtes allèrent', pp: 'allé' },
  faire:     { p: 'fais fais fait faisons faites font', i: 'fais', f: 'fer', s: 'fis fis fit fîmes fîtes firent', pp: 'fait' },
  dire:      { p: 'dis dis dit disons dites disent', i: 'dis', f: 'dir', s: 'dis dis dit dîmes dîtes dirent', pp: 'dit' },
  venir:     { p: 'viens viens vient venons venez viennent', i: 'ven', f: 'viendr', s: 'vins vins vint vînmes vîntes vinrent', pp: 'venu' },
  tenir:     { p: 'tiens tiens tient tenons tenez tiennent', i: 'ten', f: 'tiendr', s: 'tins tins tint tînmes tîntes tinrent', pp: 'tenu' },
  pouvoir:   { p: 'peux peux peut pouvons pouvez peuvent', i: 'pouv', f: 'pourr', s: 'pus pus put pûmes pûtes purent', pp: 'pu' },
  voir:      { p: 'vois vois voit voyons voyez voient', i: 'voy', f: 'verr', s: 'vis vis vit vîmes vîtes virent', pp: 'vu' },
  vouloir:   { p: 'veux veux veut voulons voulez veulent', i: 'voul', f: 'voudr', s: 'voulus voulus voulut voulûmes voulûtes voulurent', pp: 'voulu' },
  prendre:   { p: 'prends prends prend prenons prenez prennent', i: 'pren', f: 'prendr', s: 'pris pris prit prîmes prîtes prirent', pp: 'pris' },
  partir:    { p: 'pars pars part partons partez partent', i: 'part', f: 'partir', s: 'partis partis partit partîmes partîtes partirent', pp: 'parti' },
  sortir:    { p: 'sors sors sort sortons sortez sortent', i: 'sort', f: 'sortir', s: 'sortis sortis sortit sortîmes sortîtes sortirent', pp: 'sorti' },
  dormir:    { p: 'dors dors dort dormons dormez dorment', i: 'dorm', f: 'dormir', s: 'dormis dormis dormit dormîmes dormîtes dormirent', pp: 'dormi' },
  mettre:    { p: 'mets mets met mettons mettez mettent', i: 'mett', f: 'mettr', s: 'mis mis mit mîmes mîtes mirent', pp: 'mis' },
  savoir:    { p: 'sais sais sait savons savez savent', i: 'sav', f: 'saur', s: 'sus sus sut sûmes sûtes surent', pp: 'su' },
  devoir:    { p: 'dois dois doit devons devez doivent', i: 'dev', f: 'devr', s: 'dus dus dut dûmes dûtes durent', pp: 'dû' },
  lire:      { p: 'lis lis lit lisons lisez lisent', i: 'lis', f: 'lir', s: 'lus lus lut lûmes lûtes lurent', pp: 'lu' },
  'écrire':  { p: 'écris écris écrit écrivons écrivez écrivent', i: 'écriv', f: 'écrir', s: 'écrivis écrivis écrivit écrivîmes écrivîtes écrivirent', pp: 'écrit' },
  courir:    { p: 'cours cours court courons courez courent', i: 'cour', f: 'courr', s: 'courus courus courut courûmes courûtes coururent', pp: 'couru' }
};
for (const v of Object.values(IRR)) { v.p = v.p.split(' '); v.s = v.s.split(' '); }
/* verbes dérivés : préfixe + verbe de base */
const PREFIXED = { devenir: ['de', 'venir'], revenir: ['re', 'venir'], apprendre: ['ap', 'prendre'], comprendre: ['com', 'prendre'] };

/* verbes conjugués avec « être » aux temps composés (emplois intransitifs) */
const ETRE_AUX = new Set(['aller', 'arriver', 'entrer', 'tomber', 'rester', 'monter', 'rentrer', 'partir', 'sortir',
  'venir', 'devenir', 'revenir']);

export const VERBS = [...Object.keys(IRR), ...Object.keys(PREFIXED), ...G2, ...Object.keys(G1)];
const KNOWN = new Set(VERBS);

const isP = p => PERSONS.includes(p);
const pIdx = p => PERSONS.indexOf(p);

/* ---------- Informations ---------- */
/* groupe : 0 = être/avoir (auxiliaires), 1, 2, 3 (aller compris) */
export function groupOf(verb) {
  if (verb === 'être' || verb === 'avoir') return 0;
  if (verb in G1) return 1;
  if (G2.includes(verb)) return 2;
  if (verb in IRR || verb in PREFIXED) return 3;
  return null;
}
export function auxOf(verb) { return ETRE_AUX.has(verb) ? 'être' : 'avoir'; }
export function isEtreVerb(verb) { return ETRE_AUX.has(verb); }
export function hasVerb(verb) { return KNOWN.has(verb); }
/* variante du radical d'un verbe du 1er groupe ('' régulier, null hors 1er groupe) */
export function variantOf(verb) { return verb in G1 ? G1[verb] : null; }

export function verbInfo(verb) {
  if (!KNOWN.has(verb)) return null;
  const group = groupOf(verb);
  return {
    inf: verb, group, aux: auxOf(verb), pp: pastParticiple(verb),
    variant: group === 1 ? G1[verb] : null,
    irregular: group === 0 || group === 3
  };
}

/* ---------- Élision ---------- */
const VOWEL = /^[aeiouyàâäéèêëîïôöùûüœæh]/i;       /* h muet : aucun verbe à h aspiré dans la liste */
export function startsWithVowel(word) { return VOWEL.test(String(word || '')); }
/* pronom sujet adapté à la forme : « j’ » devant voyelle ou h muet */
export function pronoun(person, form, g = 'm') {
  switch (person) {
    case '1s': return startsWithVowel(form) ? 'j’' : 'je';
    case '2s': return 'tu';
    case '3s': return g === 'f' ? 'elle' : 'il';
    case '1p': return 'nous';
    case '2p': return 'vous';
    case '3p': return g === 'f' ? 'elles' : 'ils';
    default: return '';
  }
}
/* « j’ai chanté », « je suis allée », « elles finissent » */
export function withPronoun(person, form, g = 'm') {
  const p = pronoun(person, form, g);
  return p.endsWith('’') ? p + form : p + ' ' + form;
}

/* ---------- Participe passé ---------- */
export function pastParticiple(verb) {
  if (verb in IRR) return IRR[verb].pp;
  if (verb in PREFIXED) { const [pre, base] = PREFIXED[verb]; return pre + IRR[base].pp; }
  if (G2.includes(verb)) return verb.slice(0, -1);              /* finir → fini */
  if (verb in G1) return verb.slice(0, -2) + 'é';
  return null;
}
/* accord du participe : g 'm'|'f', n 's'|'p' */
export function agree(pp, g = 'm', n = 's') {
  if (!pp || pp === 'été') return pp;                            /* été : toujours invariable */
  if (pp === 'dû') return g === 'f' ? (n === 'p' ? 'dues' : 'due') : (n === 'p' ? 'dus' : 'dû');
  if (g === 'f') return pp + (n === 'p' ? 'es' : 'e');
  return n === 'p' && !pp.endsWith('s') ? pp + 's' : pp;
}
export function participle(verb, g = 'm', n = 's') { return agree(pastParticiple(verb), g, n); }

/* ---------- 1er groupe : radicaux ---------- */
const lastEtoGrave = s => { const i = s.lastIndexOf('e'); return i < 0 ? s : s.slice(0, i) + 'è' + s.slice(i + 1); };
/* radical du futur d'un verbe du 1er groupe (avec ses variations) */
function futStem1(verb, variant) {
  const base = verb.slice(0, -2);
  switch (variant) {
    case 'll': case 'tt': return base + base.slice(-1) + 'er';           /* appeller, jetter */
    case 'è': return lastEtoGrave(base) + 'er';                          /* achèter, lèver */
    case 'yer': return base.slice(0, -1) + 'ier';                        /* nettoier, essuier */
    case 'envoyer': return 'enverr';
    default: return verb;                                                /* chanter, manger */
  }
}
/* forme simple d'un verbe du 1er groupe ; plain = sans aucune variation du radical */
function form1(verb, tense, i, plain = false) {
  const v = plain ? '' : G1[verb];
  const base = verb.slice(0, -2);
  if (tense === 'futur') return (plain ? verb : futStem1(verb, v)) + ENDINGS.futur[i];
  const end = tense === 'present' ? ENDINGS.present1[i] : tense === 'imparfait' ? ENDINGS.imparfait[i] : ENDINGS.ps1[i];
  let stem = base;
  const soft = /^[aâo]/.test(end);
  if (v === 'ger' && soft) stem = base + 'e';
  else if (v === 'cer' && soft) stem = base.slice(0, -1) + 'ç';
  else if (tense === 'present' && MUTE.has(i)) {
    if (v === 'll' || v === 'tt') stem = base + base.slice(-1);
    else if (v === 'è') stem = lastEtoGrave(base);
    else if (v === 'yer' || v === 'envoyer') stem = base.slice(0, -1) + 'i';
  }
  return stem + end;
}
function form2(verb, tense, i) {
  const base = verb.slice(0, -2);
  if (tense === 'present') return base + ENDINGS.present2[i];
  if (tense === 'imparfait') return base + 'iss' + ENDINGS.imparfait[i];
  if (tense === 'futur') return verb + ENDINGS.futur[i];
  return base + ENDINGS.ps2[i];
}
function formIrr(t, tense, i) {
  if (tense === 'present') return t.p[i];
  if (tense === 'imparfait') return t.i + ENDINGS.imparfait[i];
  if (tense === 'futur') return t.f + ENDINGS.futur[i];
  return t.s[i];
}
/* forme d'un temps simple (sans pronom) */
export function simpleForm(verb, tense, person) {
  const i = pIdx(person);
  if (i < 0 || !SIMPLE_TENSES.includes(tense)) return null;
  if (verb in IRR) return formIrr(IRR[verb], tense, i);
  if (verb in PREFIXED) { const [pre, base] = PREFIXED[verb]; return pre + formIrr(IRR[base], tense, i); }
  if (G2.includes(verb)) return form2(verb, tense, i);
  if (verb in G1) return form1(verb, tense, i);
  return null;
}

/* ---------- Conjugaison ---------- */
export function conjugate(verb, tense, person, opts = {}) {
  if (!KNOWN.has(verb) || !isP(person) || !TENSES.includes(tense)) return null;
  const o = opts || {};
  if (SIMPLE_TENSES.includes(tense)) return { form: simpleForm(verb, tense, person) };
  const auxVerb = auxOf(verb);
  const aux = simpleForm(auxVerb, COMPOUND_TENSES[tense], person);
  let pp;
  if (auxVerb === 'être') pp = participle(verb, o.g === 'f' ? 'f' : 'm', person.endsWith('p') ? 'p' : 's');
  else if (o.cod && typeof o.cod === 'object') pp = participle(verb, o.cod.g === 'f' ? 'f' : 'm', o.cod.n === 'p' ? 'p' : 's');
  else pp = pastParticiple(verb);
  return { form: aux + ' ' + pp, aux, participle: pp, auxVerb };
}
/* raccourci : la forme seule (ou null) */
export function formOf(verb, tense, person, opts) {
  const r = conjugate(verb, tense, person, opts);
  return r ? r.form : null;
}

/* forme « sans variation du radical » (règle générale du 1er groupe) : sert à repérer les formes
   qui demandent une variation (programme de CM1) */
export function isPlainForm(verb, tense, person) {
  if (!(verb in G1) || !G1[verb]) return true;
  const i = pIdx(person);
  const t = COMPOUND_TENSES[tense] ? null : tense;
  if (!t) return true;                                   /* temps composés : participe régulier */
  return form1(verb, t, i, true) === form1(verb, t, i);
}
/* la forme « fautive » que donnerait la règle générale sans variation (ex. 'mangons', 'aboyent') */
export function plainForm(verb, tense, person) {
  if (!(verb in G1) || !SIMPLE_TENSES.includes(tense) || !isP(person)) return null;
  return form1(verb, tense, pIdx(person), true);
}

/* radical + terminaison affichables pour les tuiles (temps simples à radical constant sur les
   six personnes ; passé composé : radical du participe + é / i). null si le découpage n'a pas
   de sens pour ce verbe à ce temps. */
export function stemEnding(verb, tense, person) {
  const i = pIdx(person);
  if (i < 0) return null;
  const g = groupOf(verb);
  if (tense === 'passe_compose' || tense === 'plus_que_parfait') {
    if (auxOf(verb) !== 'avoir') return null;
    if (g === 1) return { stem: verb.slice(0, -2), ending: 'é' };
    if (g === 2) return { stem: verb.slice(0, -2), ending: 'i' };
    return null;
  }
  if (tense === 'futur') {
    const f = simpleForm(verb, 'futur', person);
    return { stem: f.slice(0, f.length - ENDINGS.futur[i].length), ending: ENDINGS.futur[i] };
  }
  if (tense === 'imparfait') {
    if (g === 1 && G1[verb] !== '' && !['ll', 'tt', 'è', 'yer', 'envoyer'].includes(G1[verb])) return null;  /* -ger, -cer */
    const f = simpleForm(verb, 'imparfait', person);
    return { stem: f.slice(0, f.length - ENDINGS.imparfait[i].length), ending: ENDINGS.imparfait[i] };
  }
  if (tense === 'present') {
    if (g === 1 && G1[verb] === '') return { stem: verb.slice(0, -2), ending: ENDINGS.present1[i] };
    if (g === 2) return { stem: verb.slice(0, -2), ending: ENDINGS.present2[i] };
    return null;
  }
  if (tense === 'passe_simple') {
    if (g === 1 && G1[verb] === '') return { stem: verb.slice(0, -2), ending: ENDINGS.ps1[i] };
    if (g === 2) return { stem: verb.slice(0, -2), ending: ENDINGS.ps2[i] };
    return null;
  }
  return null;
}
/* terminaisons d'un temps pour le découpage de stemEnding (même ordre que PERSONS) */
export function endingsFor(verb, tense) {
  const g = groupOf(verb);
  if (tense === 'futur') return ENDINGS.futur;
  if (tense === 'imparfait') return ENDINGS.imparfait;
  if (tense === 'present') return g === 2 ? ENDINGS.present2 : ENDINGS.present1;
  if (tense === 'passe_simple') return g === 2 ? ENDINGS.ps2 : ENDINGS.ps1;
  return null;
}

/* toutes les formes réelles d'un verbe (tous temps, personnes, genres, participes, infinitif) :
   sert à vérifier qu'une « faute typique » n'est pas une vraie forme */
const paradigmCache = new Map();
export function paradigm(verb) {
  if (paradigmCache.has(verb)) return paradigmCache.get(verb);
  const set = new Set();
  if (KNOWN.has(verb)) {
    set.add(verb);
    for (const t of TENSES) for (const p of PERSONS) for (const g of ['m', 'f']) {
      set.add(conjugate(verb, t, p, { g }).form);
      if (auxOf(verb) === 'avoir' && COMPOUND_TENSES[t]) {
        for (const n of ['s', 'p']) set.add(conjugate(verb, t, p, { cod: { g, n } }).form);
      }
    }
    for (const g of ['m', 'f']) for (const n of ['s', 'p']) set.add(participle(verb, g, n));
  }
  paradigmCache.set(verb, set);
  return set;
}
