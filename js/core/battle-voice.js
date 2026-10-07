/* ============ RÉPONDRE À VOIX HAUTE DANS LE DÉFI (v2.3, demande du parent du 07/10/2026) ============
   « Il faudrait pouvoir utiliser le micro sur les autres jeux, pas seulement les tables. » Module pur (aucun DOM) :
   importable par Node (tests/battle-voice.test.mjs). Écran : js/ui/battle.js (Défi en famille et « Avec un copain »),
   qui confie la question à js/ui/voice-answer.js : number({ answer, ignore, voice }) ou choices([{ value, say, num, label }]).
   - voicePlan(item) → ce que la voix peut faire pour CETTE question :
       { mode: 'number', answer, ignore, voice }        pavé (tables, calcul éclair) ; ignore = nombres de l'énoncé et
                                                         morceaux de la réponse (answerPieces : « cent » mal entendu),
                                                         jamais comptés faux ; voice = false : réponse décimale ou trop
                                                         grande (la voix se tait, le pavé reste) ;
       { mode: 'choices', list, voice, why }            grille (estimation, conjugaison) ; voice = false quand deux choix
                                                         se disent pareil ou presque (why 'same'), ou quand la notion se
                                                         juge à l'écrit (why 'written' : formes du verbe, terminaisons,
                                                         participes — le micro ne départage pas « mangeais / mangeait ») ;
       { mode: 'none' }                                 rien à dire (question inconnue).
     Un seul essai au défi : la voix n'est proposée que là où elle ne peut pas juger injustement.
   - soundOf(texte, { verb }) : clé sonore APPROCHÉE d'un texte français (lettres muettes finales retirées, é / è / ai
     confondus, o / au / eau, nasales, c / ç / s…). Deux choix de même clé « se disent pareil » ; verb : les « -ent »
     finaux sont muets (« mangent »).
   - tooClose(a, b) : clés égales, ou l'une est le début de l'autre mot pour mot (« quatre » / « quatre cents » : un
     résultat partiel donnerait le premier).
   Conjugaison : seules les questions « À quel temps… ? » (noms des temps) et « Choisis le sujet » (pronoms, prénoms,
   groupes du nom) se disent ; leurs mots sont tous dans le lexique du modèle Vosk (vérifié par les tests :
   loadLexicon de tests/lexicon.mjs). Les formes conjuguées, terminaisons et participes restent au doigt : le petit
   modèle ne connaît pas une forme sur trois (« chanterai », « finîtes »…) et la plupart se disent comme une autre. */
import { wordsOf, matchChoice } from './voice-choice.js';
import { spell } from './numbers-fr.js';
import * as TL from '../games/tables-logic.js';
import * as PL from '../games/pommes-logic.js';

/* au défi, UN seul essai : la voix s'arrête à 999 (Pommes express va jusqu'à 99 999, avec deux essais). Banc d'essai
   (voix d'enfant de synthèse) : à 4 chiffres, 3 réponses justes sur 8 jugées fausses (un mot avalé : « neuf mille [deux]
   cent quatre-vingt-cinq » → 9 185) ; au-delà, le pavé. */
export const NUMBER_VOICE_MAX = 999;
/* estimation : des nombres ronds bien distincts (40 / 400 / 4 000), reconnus sans peine */
export const CHOICE_VOICE_MAX = 99999;

/* noms des temps dits par l'enfant (TENSE_LABEL de js/content/fr/verbs.js, vérifié par les tests) */
export const TENSE_SAY = Object.freeze({
  present: ['présent'], imparfait: ['imparfait'], futur: ['futur'], passe_compose: ['passé composé'],
  passe_simple: ['passé simple'], plus_que_parfait: ['plus-que-parfait', 'plus que parfait']
});
/* types de questions de conjugaison qui se disent ; les autres se jugent à l'écrit */
export const SPOKEN_CONJ = Object.freeze(['temps', 'sujet']);
/* mots des sujets du générateur absents du lexique du modèle (jamais reconnus : la question reste au doigt) — liste
   tenue à jour par tests/battle-voice.test.mjs */
export const UNHEARD = Object.freeze(['lapereaux', 'renardeaux']);

/* ---------- clé sonore ---------- */
const SAID_FINAL = { sept: 'sEt', huit: 'yit', six: 'sis', dix: 'dis', est: 'E', es: 'E', et: 'E', ai: 'E', les: 'lE', des: 'dE',
  mes: 'mE', tes: 'tE', ses: 'sE', ces: 'sE', hier: 'jEr', mer: 'mEr', fer: 'fEr', hiver: 'ivEr', cher: 'SEr', ver: 'vEr', super: 'sypEr',
  fils: 'fis', ours: 'urs', bus: 'bys', mars: 'mars', os: 'os', tennis: 'tenis', sens: 'sAs' };
const V = 'aeiouyàâäéèêëîïôöùûüœ';
const isV = ch => !!ch && V.includes(ch);

function soundWord(raw, verb) {
  let w = String(raw).toLowerCase().normalize('NFC').replace(/['’\-]/g, '');
  if (!w) return '';
  if (SAID_FINAL[w]) return SAID_FINAL[w];
  /* fins muettes ; la consonne d'avant un « e » muet se prononce (achètent, voisines) : le « e » reste jusqu'à phon */
  if (/aient$/.test(w)) w = w.slice(0, -4) + 'i';                              /* mangeaient → mangeai */
  else if (verb && /[vt]ient$/.test(w)) w = w.slice(0, -4) + 'iin';            /* vient, tient → « viin » (nasale) */
  else if (verb && w.length > 4 && /ent$/.test(w)) w = w.slice(0, -2);          /* mangent → mange */
  if (w.length > 3 && /er$/.test(w)) w = w.slice(0, -2) + 'é';                 /* manger → mangé */
  w = w.replace(/ez$/, 'é');
  if (w.length > 3 && /es$/.test(w)) w = w.slice(0, -1);                        /* manges → mange */
  if (!/e$/.test(w)) w = w.replace(/[sxtdpz]+$/, '');                           /* finis, finit → fini ; prends → pren */
  const k = phon(w);
  const base = k.replace(/@+$/, '');                                            /* « e » final muet, sauf seule voyelle (je, le) */
  return base !== k && /[aiyEOU2@~]/.test(base) ? base : k;
}

/* graphies → sons (approché ; majuscules : E = é/è/ai, O = o/au, U = ou, 2 = eu, A~ O~ E~ = nasales, S = ch, j = ge/gi) */
function phon(w) {
  let out = '';
  for (let i = 0; i < w.length;) {
    const r = w.slice(i);
    const prev = w[i - 1] || '';
    const take = (n, s) => { out += s; i += n; };
    let m;
    if ((m = /^(eaux|eau|au|ô|ö)/.exec(r))) { take(m[0].length, 'O'); continue; }
    if ((m = /^(oin)(?![aeiouyàâéèêëîïôûn])/.exec(r))) { take(3, 'wE~'); continue; }
    if ((m = /^(oi|oî|oy)/.exec(r))) { take(m[0].length, 'wa'); continue; }
    if ((m = /^(ou|où|oû)/.exec(r))) { take(m[0].length, 'U'); continue; }
    if ((m = /^(œu|oeu|eu|œ)/.exec(r))) { take(m[0].length, '2'); continue; }
    if ((m = /^(ain|ein|aim)(?![aeiouyàâéèêëîïôûnm])/.exec(r))) { take(3, 'E~'); continue; }
    if ((m = /^(ai|aî|ei|è|ê|ë|é)/.exec(r))) { take(m[0].length, 'E'); continue; }
    if ((m = /^(iin)$/.exec(r))) { take(3, 'jE~'); continue; }
    if ((m = /^(ien)(?![aeiouyàâéèêëîïôûn])/.exec(r))) { take(3, 'jE~'); continue; }
    if ((m = /^(an|am|en|em)(?![aeiouyàâéèêëîïôûnm])/.exec(r))) { take(2, 'A~'); continue; }
    if ((m = /^(on|om)(?![aeiouyàâéèêëîïôûnm])/.exec(r))) { take(2, 'O~'); continue; }
    if ((m = /^(in|im|yn|un|um)(?![aeiouyàâéèêëîïôûnm])/.exec(r))) { take(2, 'E~'); continue; }
    if (r.startsWith('ch')) { take(2, /^ch[lr]/.test(r) ? 'k' : 'S'); continue; }   /* Chloé, chrome */
    if (r.startsWith('ph')) { take(2, 'f'); continue; }
    if (r.startsWith('th')) { take(2, 't'); continue; }
    if (r.startsWith('qu')) { take(2, 'k'); continue; }
    if (r.startsWith('gn')) { take(2, 'nj'); continue; }
    if (/^gu[eiéèêy]/.test(r)) { take(2, 'g'); continue; }
    if (/^ge[aoâôu]/.test(r)) { take(2, 'j'); continue; }                        /* mangeons, mangeais */
    if (/^g[eiéèêïîy]/.test(r)) { take(1, 'j'); continue; }
    if (/^c[eiéèêïîy]/.test(r) || r[0] === 'ç') { take(1, 's'); continue; }
    if (r[0] === 'c') { take(r[1] === 'c' ? 2 : 1, 'k'); continue; }
    if (isV(prev) && /^ill/.test(r)) { take(3, 'j'); continue; }                  /* travaille */
    if (/^ill/.test(r)) { take(3, 'ij'); continue; }                              /* fille */
    if (r.startsWith('ss')) { take(2, 's'); continue; }
    if (r[0] === 's' && isV(prev) && isV(r[1])) { take(1, 'z'); continue; }       /* prise, maison */
    if (r[0] === 'x') { take(1, 'ks'); continue; }
    if (r[0] === 'h') { take(1, ''); continue; }
    if (r[0] === 'y') { take(1, 'i'); continue; }
    if (/^[àâä]/.test(r)) { take(1, 'a'); continue; }
    if (/^[îï]/.test(r)) { take(1, 'i'); continue; }
    if (/^[ùûü]/.test(r)) { take(1, 'y'); continue; }
    if (r[0] === 'u') { take(1, 'y'); continue; }
    if (r[0] === 'o') { take(1, 'O'); continue; }
    /* e : ouvert devant deux consonnes ou une consonne finale (elle, est, sec), muet sinon */
    if (r[0] === 'e') { const nx = r.slice(1); take(1, /^[^aeiouyàâéèêëîïôûœ]{2}/.test(nx) || /^[^aeiouyàâéèêëîïôûœ]$/.test(nx) ? 'E' : '@'); continue; }
    if (r.length > 1 && r[0] === r[1] && !isV(r[0])) { take(2, r[0]); continue; } /* consonnes doubles */
    take(1, r[0]);
  }
  return out;
}

export function soundOf(text, { verb = false } = {}) {
  return wordsOf(text).map(w => soundWord(w, verb)).filter(Boolean).join(' ');
}

/* deux formes dites trop proches pour la voix : même clé, ou l'une commence l'autre mot pour mot */
export function tooClose(a, b, opts = {}) {
  const ka = soundOf(a, opts).split(' ').filter(Boolean), kb = soundOf(b, opts).split(' ').filter(Boolean);
  if (!ka.length || !kb.length) return true;
  const [s, l] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  return s.every((w, i) => w === l[i]);
}
/* formes dites d'un choix (texte) */
const saysOf = c => (Array.isArray(c.say) ? c.say : c.say ? [c.say] : c.num !== undefined && Number.isFinite(c.num) ? [spell(Math.round(c.num) === c.num ? c.num : 0)] : []);
/* une liste de choix se dit-elle sans confusion ? (toutes les paires de formes de choix différents ; et chaque forme,
   dite seule, désigne bien son choix : « ma sœur » ne se distingue pas de « mon frère et ma sœur ») */
export function choicesDistinct(list, opts = {}) {
  for (const c of list) for (const f of saysOf(c)) {
    const m = matchChoice(f, list);
    if (!m || String(m.value) !== String(c.value)) return false;
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (String(list[i].value) === String(list[j].value)) continue;
      for (const a of saysOf(list[i])) for (const b of saysOf(list[j])) if (tooClose(a, b, opts)) return false;
    }
  }
  return true;
}

/* ---------- plan d'une question ---------- */
/* nombres écrits dans un énoncé (« 3 400 », « 2,5 ») : jamais comptés faux à la voix */
export function promptNumbers(prompt) {
  return (String(prompt || '').match(/\d+(?:[\s\u00A0\u202F]\d{3})*(?:,\d+)?/g) || [])
    .map(x => Number(x.replace(/[\s\u00A0\u202F]/g, '').replace(',', '.'))).filter(Number.isFinite);
}
const uniqNums = a => [...new Set(a.filter(Number.isFinite))];
/* « cent » mal entendu (banc d'essai : « cent soixante-douze » → « cinq soixante-douze », « cinq cents » → « cinq cinq »,
   « huit cent six » → « huit cinquante-six ») : le texte se lit alors comme un MORCEAU de la réponse — sa fin (172 → 72,
   3 471 → 71 ou 471), son premier chiffre (500 → 5, 3 471 → 3) ou « cinquante- » + son dernier chiffre (806 → 56). Ces
   morceaux ne comptent jamais faux (un seul essai au défi) : l'enfant redit, ou tape. */
export function answerPieces(v) {
  if (!Number.isInteger(v) || v < 100) return [];
  const out = new Set();
  for (const p of [100, 1000, 10000, 100000]) if (v > p && v % p) out.add(v % p);
  const hundreds = Math.floor(v / 100) % 10;
  if (hundreds) out.add(hundreds);
  if (v >= 1000) out.add(Math.floor(v / 1000));
  out.add(50 + (v % 10));
  out.delete(v);
  return [...out].sort((a, b) => a - b);
}

function numberPlan(item) {
  const faits = item.axis === 'ma.faits';
  if (faits) {
    const info = TL.answerInfo(item);
    return { mode: 'number', answer: info.value, ignore: uniqNums([...TL.shownNumbers(TL.promptParts(item)), ...answerPieces(info.value)]), voice: !!info.voice };
  }
  const info = PL.answerInfo(item);
  const v = info.value;
  return { mode: 'number', answer: v, ignore: uniqNums([...promptNumbers(item.prompt), ...answerPieces(v)]),
    voice: !info.decimal && Number.isInteger(v) && v >= 0 && v <= NUMBER_VOICE_MAX };
}
/* estimation (calcul éclair) : des nombres ronds (40 / 400 / 4 000) */
function estimatePlan(item) {
  const list = item.choices.map(c => {
    const n = Number(c.value);
    const num = Number.isFinite(n) ? n : undefined;
    return { value: c.value, num, label: PL.choiceLabel(item, c.value) };
  });
  const sayable = list.every(c => Number.isInteger(c.num) && c.num >= 0 && c.num <= CHOICE_VOICE_MAX);
  const ok = sayable && choicesDistinct(list);
  return { mode: 'choices', list, voice: ok, why: ok ? '' : 'same' };
}
/* conjugaison : choix { label, value } de OL.choiceModel / item.choices */
function conjPlan(item) {
  const raw = Array.isArray(item.choices) ? item.choices : [];
  const kind = item.kind;
  const label = c => String(c.label ?? c.value);
  if (!SPOKEN_CONJ.includes(kind)) {
    return { mode: 'choices', list: raw.map(c => ({ value: c.value, say: [String(c.value)], label: label(c) })), voice: false, why: 'written' };
  }
  const list = raw.map(c => ({
    value: c.value,
    say: kind === 'temps' ? (TENSE_SAY[c.value] || [String(c.value)]).slice() : [String(c.value)],
    label: label(c)
  }));
  if (list.some(c => c.say.some(s => wordsOf(s).some(w => UNHEARD.includes(w))))) return { mode: 'choices', list, voice: false, why: 'unheard' };
  const ok = list.length > 1 && list.every(c => c.say.length && c.say.every(s => wordsOf(s).length)) && choicesDistinct(list);
  return { mode: 'choices', list, voice: ok, why: ok ? '' : 'same' };
}

export function voicePlan(item) {
  if (!item || typeof item !== 'object') return { mode: 'none' };
  if (item.axis === 'fr.conjug') return conjPlan(item);
  if (item.axis === 'ma.faits' || item.axis === 'ma.procedures') {
    if (Array.isArray(item.choices) && item.choices.length) return estimatePlan(item);
    return numberPlan(item);
  }
  return { mode: 'none' };
}
