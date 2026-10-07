/* ============ RÉPONDRE À VOIX HAUTE PARMI DES CHOIX (v2.3, demande du parent du 07/10/2026) ============
   « Il faudrait pouvoir utiliser le micro sur les autres jeux, pas seulement les tables. » Module pur (aucun DOM),
   testé par tests/voice-answer.test.mjs ; utilisé par js/ui/voice-answer.js.
   Un choix = { value, say: [formes dites] } : « mangeais », « nous mangions », « trois quarts »… ; un choix NOMBRE
   ({ value, num }) se reconnaît par parseSpoken (js/core/numbers-fr.js) : « quatre cents », « 400 ».
   - wordsOf(texte)        : mots normalisés comme ceux de Vosk (minuscules, apostrophe droite, ponctuation retirée) ;
   - choiceGrammar(choix)  : mots de toutes les formes (+ ceux des nombres) pour la grammaire Vosk ;
   - matchChoice(texte, choix) : le choix dit EN DERNIER dans le texte (ses mots distinctifs, dans l'ordre), ou null
     si deux choix finissent au même endroit (ambigu) ;
   - createChoiceJudge(choix, { confirmMs }) : feed(texteCumulé, final, t) / tick(t) → { kind: 'none' } |
     { kind: 'heard', value, due } | { kind: 'pick', value, at } — un résultat final décide tout de suite, un
     résultat partiel quand le même choix tient confirmMs (« mange » ne vaut pas tant que l'enfant dit « mangeais »). */
import { parseSpoken, grammarFor } from './numbers-fr.js';

export const CHOICE_CONFIRM_MS = 600;

export function wordsOf(text) {
  return String(text ?? '').toLowerCase().normalize('NFC').replace(/[’`´]/g, "'")
    .replace(/[^\p{L}\p{N}'\- ]+/gu, ' ').split(/\s+/).map(w => w.replace(/^['-]+|['-]+$/g, '')).filter(Boolean);
}
const isNum = c => c && Number.isFinite(c.num);
const formsOf = c => (Array.isArray(c && c.say) ? c.say : c && c.say ? [c.say] : []).map(wordsOf).filter(f => f.length);

/* mots de la grammaire : formes dites + nombres (jusqu'au plus grand nombre proposé) */
export function choiceGrammar(choices = [], extra = []) {
  const set = new Set();
  let max = -1;
  for (const c of choices) {
    for (const f of formsOf(c)) for (const w of f) set.add(w);
    if (isNum(c)) max = Math.max(max, Math.abs(Math.round(c.num)));
  }
  if (max >= 0) for (const w of grammarFor(Math.max(10, max))) set.add(w);
  for (const w of extra) set.add(String(w));
  return [...set];
}

/* mots distinctifs d'une forme : ceux qui ne sont pas dans TOUTES les formes des autres choix (« nous » de « nous
   mangions / nous mangerons » ne départage rien) */
function distinctive(form, others) {
  if (!others.length) return form;
  const d = form.filter(w => !others.every(o => o.includes(w)));
  return d.length ? d : form;
}
/* dernière position (fin, exclue) où les mots `need` apparaissent dans l'ordre dans `words`, le dernier d'entre eux
   à cette position ; -1 sinon */
function lastEnd(words, need) {
  for (let i = words.length - 1; i >= 0; i--) {
    if (words[i] !== need[need.length - 1]) continue;
    let j = need.length - 2, k = i - 1;
    while (j >= 0 && k >= 0) { if (words[k] === need[j]) j--; k--; }
    if (j < 0) return i + 1;
  }
  return -1;
}

export function matchChoice(text, choices = []) {
  const words = wordsOf(text);
  if (!words.length) return null;
  const num = parseSpoken(String(text ?? ''));
  const forms = choices.map(formsOf);
  let best = null, bestEnd = -1, tie = false;
  choices.forEach((c, i) => {
    let end = -1;
    if (isNum(c) && num !== null && Math.abs(num - c.num) < 1e-9) end = words.length;   /* le dernier nombre dit */
    const others = forms.filter((_, k) => k !== i).flat();          /* formes (listes de mots) des autres choix */
    for (const f of forms[i]) end = Math.max(end, lastEnd(words, distinctive(f, others)));
    if (end < 0) return;
    if (end > bestEnd) { best = c; bestEnd = end; tie = false; }
    else if (end === bestEnd && best && best.value !== c.value) tie = true;
  });
  return tie || !best ? null : best;
}

export function createChoiceJudge(choices = [], { confirmMs = CHOICE_CONFIRM_MS } = {}) {
  let last = null, since = 0, done = false;
  const judge = (t, isFinal) => {
    if (!last) return { kind: 'none' };
    if (isFinal || t - since >= confirmMs) { done = true; return { kind: 'pick', value: last.value, at: since }; }
    return { kind: 'heard', value: last.value, due: since + confirmMs };
  };
  return {
    feed(text, isFinal, t) {
      if (done) return { kind: 'none' };
      const c = matchChoice(text, choices);
      if (!c) { last = null; since = 0; return { kind: 'none' }; }
      if (!last || last.value !== c.value) { last = c; since = t; }
      return judge(t, !!isFinal);
    },
    tick(t) {
      if (done || !last) return { kind: 'none' };
      const ev = judge(t, false);
      return ev.kind === 'heard' ? { kind: 'none', due: ev.due } : ev;
    },
    reset() { last = null; since = 0; done = false; },
    get done() { return done; }
  };
}
