/* ============ MES POÉSIES (dans la course de lecture) — module pur ============
   Demande du parent (07/10/2026) : « charger un texte libre pour renseigner leur poésie à apprendre ; on leur ferait lire et
   ça les aide à l'apprendre ». Décisions : la poésie est TAPÉE (ou collée) par l'adulte dans l'espace parents
   (js/ui/poems-parents.js) ; l'enfant la lit dans la course (js/games/course.js), le micro suit sa lecture, puis il
   l'apprend « par cœur » par étapes (le texte s'efface peu à peu) ; ni Zip, ni chrono, ni étoiles, ni MCLM, ni θ :
   c'est un entraînement, pas une compétition. Étude : rapport « dictee-problemes » partie C.

   Aucun accès au DOM ni au stockage (testé sous Node : tests/poesies.test.mjs).

   Données : profile.poems = [{ id, title, author?, text, created, stage, best, runs, last, done?, oov?, lex? }]
     text   : vers séparés par « \n », une ligne vide entre deux strophes (cleanPoemText : espaces, apostrophe ’, « … »,
              typographie française frTypo) ; ≤ TEXT_MAX caractères, ≤ LINES_MAX lignes, ≤ WORDS_MAX mots ;
     stage  : étape proposée (1-5, STAGES) ; best : meilleure étape réussie (0 = aucune ; 5 = sue par cœur, done = date) ;
     runs, last : entraînements et dernier jour ;
     oov    : mots que le micro ne connaît pas (absents du lexique du modèle Vosk), calculés par l'espace parents ;
     lex    : modèle contre lequel oov a été calculé (js/core/lexicon.js, LEX_ID) ; absent = pas encore vérifié.
   ≤ POEMS_MAX poésies (la plus récente en tête). Clés inconnues conservées (version future).

   Lecture par le moteur de la course (js/games/course-engine.js, jamais modifié) :
   - poemLayout(text) → mots affichés, vers, strophes, et texteMoteur tel que tokenize(texteMoteur) donne exactement un
     jeton par mot affiché (ponctuation seule rattachée au mot voisin, espaces fines retirées) ;
   - poemGrammar(jetons) : pour chaque mot, sa forme avec apostrophe / trait d'union (« l'hiver », « dit-elle »,
     « arc-en-ciel ») ET la forme collée de la v11 (« lhiver ») ; Vosk ignore celles qu'il ne connaît pas. Le lexique de
     vosk-model-small-fr-0.22 a les formes à apostrophe et à trait d'union, pas les formes collées : mesuré sur 4 poèmes
     du domaine public, 4,3 % de mots impossibles à entendre avec la grammaire v11, 0,8 % ainsi (étude C.2) ;
   - mot hors lexique (aucune de ses formes dans le lexique) : validable par le joker [unk], comme les noms propres
     (poemProper) — et signalé à l'adulte (oovWords).

   Étapes « par cœur » (STAGES) — repères : éduscol « Dire de mémoire » (2016 : apprendre en se testant, avec des caches,
   une aide acceptée = récitation réussie ; atelier « EFFACER » : les rimes d'abord) ; indices qui diminuent (Finley et
   al. 2011) ; se tester bat relire (Roediger & Karpicke 2006) :
     1 📖 Je lis            texte entier (la lecture de la poésie) ;
     2 🙈 Mots cachés        ≈ 1 mot sur 3 caché (les rimes d'abord, puis des mots pleins répartis), 1er mot du vers visible ;
     3 🔤 Premières lettres  seule la 1re lettre de chaque mot (et de chaque partie après ’ ou -) ;
     4 🗝️ Débuts de vers     seul le 1er mot de chaque vers ; les autres apparaissent quand l'enfant les dit ;
     5 🧠 Par cœur           plus rien : les mots apparaissent quand il les dit.
   Un mot caché reparaît dès qu'il est dit (ou sauté). Aide « montre-moi le vers » toujours possible.
   Étape réussie (runVerdict) : ≥ PASS des mots retrouvés et au plus helpsAllowed(vers) aides ; l'étape suivante s'ouvre
   (applyPoemRun). Jamais de recul : une étape ratée se refait, sans reproche. */

import { tokenize, normalize, FORGIVE } from '../games/course-engine.js';
import { frTypo } from '../core/util.js';
import { addApples, bumpWeek, bumpStreak } from '../core/economy.js';

export const POEMS_MAX = 12;          /* poésies gardées par enfant (≈ une année d'école) */
export const TITLE_MAX = 60;
export const AUTHOR_MAX = 40;
export const TEXT_MAX = 3000;         /* caractères (« Le loup et l'agneau » ≈ 1 200) */
export const LINES_MAX = 60;          /* lignes, vides comprises */
export const WORDS_MAX = 400;
export const OOV_MAX = 60;
export const STAGE_MAX = 5;
export const PASS = 0.85;             /* part des mots retrouvés pour réussir une étape */
export const APPLES_MAX = 10;         /* 🍎 d'effort par entraînement (≈ 1 par vers) */
export const RUN_CAP_MS = 15 * 60000; /* temps compté par entraînement (appli laissée ouverte ≠ minutes d'apprentissage) */
const HISTORY_MAX = 500;
const ID_RE = /^po[a-z0-9]{1,16}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const LEX_RE = /^[\w.-]{1,80}$/;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const NNBSP = '\u202f', NBSP = '\u00a0';

/* étapes : emoji (Emoji ≤ 12), nom court (enfant, parent), phrase pour l'enfant (dite par le compagnon : clips à
   enregistrer), consigne du micro */
export const STAGES = Object.freeze([
  { n: 1, emoji: '📖', label: 'Je lis', kid: 'Lis ta poésie à voix haute !', mic: 'Appuie sur le micro et lis !' },
  { n: 2, emoji: '🙈', label: 'Mots cachés', kid: 'Des mots se cachent : dis-les quand même !', mic: 'Appuie sur le micro et récite !' },
  { n: 3, emoji: '🔤', label: 'Premières lettres', kid: 'Il ne reste que la première lettre des mots !', mic: 'Appuie sur le micro et récite !' },
  { n: 4, emoji: '🗝️', label: 'Débuts de vers', kid: 'Seul le premier mot de chaque vers est écrit !', mic: 'Appuie sur le micro et récite !' },
  { n: 5, emoji: '🧠', label: 'Par cœur', kid: 'Plus rien n’est écrit : récite de mémoire !', mic: 'Appuie sur le micro et récite !' }
].map(s => Object.freeze(s)));
export const stageOf = n => STAGES[Math.min(STAGE_MAX, Math.max(1, Math.trunc(Number(n)) || 1)) - 1];

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isDay = v => typeof v === 'string' && DAY_RE.test(v);
function int(v, def) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round2 = v => Math.round(v * 100) / 100;
/* coupe sans casser un emoji (paire de substitution) */
function cut(s, max) {
  let t = String(s).slice(0, max);
  if (/[\ud800-\udbff]$/.test(t)) t = t.slice(0, -1);
  return t;
}

/* ---------- nettoyage du texte (saisie ou copier-coller de l'adulte) ---------- */
const CTRL = /[\u0000-\u0008\u000b-\u001f\u007f\u200b-\u200d\u2060\ufeff]/g;
const SPACES = /[\t\u00a0\u202f\u2000-\u200a\u3000]/g;
function cleanLine(line) {
  let l = String(line).replace(/ {2,}/g, ' ').trim();
  if (!l) return '';
  l = l.replace(/\.{3,}/g, '…')
    .replace(/(\p{L})['‘ʼ´`](?=\p{L})/gu, '$1’')                  /* apostrophe typographique (jamais autour d'une espace : « 'oui' ») */
    .replace(/(^|[\s(])"(?=\S)/g, '$1« ').replace(/(\S)"(?=$|[\s.,;:!?)…])/g, '$1 »')   /* "guillemets" → « » */
    .replace(/[‐‑]/g, '-')
    .replace(/(\S) +(?=[,.…)])/g, '$1');                          /* jamais d'espace avant , . … ) */
  return frTypo(l).replace(/ {2,}/g, ' ').trim();
}
/* texte en vers propre : une ligne = un vers, une seule ligne vide entre deux strophes ; bornes appliquées en fin de
   vers (jamais au milieu d'un mot). Idempotent. */
export function cleanPoemText(raw) {
  const lines = String(raw ?? '').normalize('NFC').replace(/\r\n?|[\u2028\u2029]/g, '\n').replace(CTRL, '').replace(SPACES, ' ')
    .split('\n').map(cleanLine);
  const out = [];
  let chars = 0, words = 0;
  for (const l of lines) {
    if (!l) { if (out.length && out[out.length - 1] !== '') out.push(''); continue; }
    const w = l.split(' ').filter(p => normalize(p)).length;
    if (out.length >= LINES_MAX || chars + l.length + 1 > TEXT_MAX || words + w > WORDS_MAX) break;
    out.push(l);
    chars += l.length + 1;
    words += w;
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}
/* titre, auteur : une ligne, typographie française, sans jetons de template */
export function cleanLabel(v, max = TITLE_MAX) {
  const s = String(v ?? '').normalize('NFC').replace(CTRL, '').replace(/[\r\n\u2028\u2029]+/g, ' ').replace(SPACES, ' ')
    .replace(/[{}]/g, '').replace(/ {2,}/g, ' ').trim();
  return s ? cut(cleanLine(s), max).trim() : '';
}
/* premier vers, raccourci (titre par défaut) */
export function firstVerse(text, max = 40) {
  const l = String(text ?? '').split('\n').find(x => x.trim()) || '';
  const t = l.replace(/[\s,;:.!?…»«\u202f\u00a0-]+$/u, '');
  return t.length > max ? cut(t, max - 1).replace(/\s+\S*$/, '') + '…' : t;
}

/* ---------- mise en page : vers, strophes, mots ----------
   → { tokens: [{ raw, eng, verse }], verses: [{ from, to, stanza, stanzaEnd }], engineText, n }
   raw : mot affiché (ponctuation voisine comprise, espaces insécables) ; eng : le même sans espace (un seul jeton pour
   tokenize) ; « — Bonjour » : le tiret de dialogue reste devant le mot. */
export function poemLayout(text) {
  const tokens = [], verses = [];
  let stanza = 0;
  for (const line of String(text ?? '').split('\n')) {
    if (!line.trim()) { if (verses.length && verses[verses.length - 1].stanza === stanza) stanza++; continue; }
    const from = tokens.length;
    let lead = '';
    for (const part of line.split(/ +/)) {
      if (!part) continue;
      if (!normalize(part)) {                       /* ponctuation seule : au mot d'avant, sinon devant le suivant */
        if (tokens.length > from) tokens[tokens.length - 1].raw += NBSP + part;
        else lead += part + NBSP;
        continue;
      }
      tokens.push({ raw: lead + part, verse: verses.length });
      lead = '';
    }
    if (tokens.length === from) continue;           /* ligne sans aucun mot */
    verses.push({ from, to: tokens.length - 1, stanza });
  }
  verses.forEach((v, i) => { v.stanzaEnd = i === verses.length - 1 || verses[i + 1].stanza !== v.stanza; });
  for (const t of tokens) t.eng = t.raw.replace(/[\s\u00a0\u202f]+/g, '');
  const engineText = verses.map(v => tokens.slice(v.from, v.to + 1).map(t => t.eng).join(' ')).join('\n');
  return { tokens, verses, engineText, n: tokens.length };
}
/* les jetons du moteur correspondent-ils un à un aux mots affichés ? (garde-fou : sinon, pas de mise en vers) */
export function layoutMatches(layout, target) {
  return !!layout && Array.isArray(target) && target.length === layout.n
    && target.every((t, i) => t.norm === normalize(layout.tokens[i].eng));
}

/* ---------- grammaire Vosk ---------- */
/* forme collée de la v11 (grammarOf de course-engine.js) */
export const flatForm = raw => String(raw ?? '').toLowerCase().replace(/[^\p{L}0-9]/gu, '');
/* forme avec apostrophe droite et traits d'union, comme les écrit le lexique Vosk (« l'hiver », « arc-en-ciel ») */
export function fullForm(raw) {
  return String(raw ?? '').toLowerCase().replace(/[’‘ʼ´`]/g, "'").replace(/[‐‑]/g, '-')
    .replace(/[^\p{L}0-9'-]/gu, '').replace(/^['-]+|['-]+$/g, '').replace(/(['-])['-]+/g, '$1');
}
/* mots (jetons du moteur ou de la mise en page : champ raw) → liste sans doublon pour startListening({ grammar }) */
export function poemGrammar(tokens) {
  const out = new Set();
  for (const t of Array.isArray(tokens) ? tokens : []) {
    const raw = t && typeof t === 'object' ? (t.eng ?? t.raw) : t;
    const f = fullForm(raw), c = flatForm(raw);
    if (f) out.add(f);
    if (c) out.add(c);
  }
  return [...out];
}
/* le micro peut-il entendre ce mot ? (has : lexique du modèle, ex. Set.prototype.has) */
export function wordKnown(raw, has) {
  if (typeof has !== 'function') return true;
  const f = fullForm(raw), c = flatForm(raw);
  return (!!f && !!has(f)) || (!!c && !!has(c));
}
/* mot affichable : sans la ponctuation autour (« l’Oût, » → « l’Oût ») */
export const bareWord = raw => String(raw ?? '').replace(/^[^\p{L}0-9]+|[^\p{L}0-9]+$/gu, '');
/* mots que le micro ne connaît pas, dans l'ordre du texte, sans doublon (même mot normalisé) */
export function oovWords(text, has) {
  const out = [], seen = new Set();
  for (const t of poemLayout(text).tokens) {
    const w = bareWord(t.raw), k = normalize(t.raw);
    if (!w || seen.has(k)) continue;
    seen.add(k);
    if (!wordKnown(t.raw, has)) out.push(w);
  }
  return out.slice(0, OOV_MAX);
}

/* noms propres d'une poésie (computeProper de la v11, mais un début de vers compte comme un début de phrase, et une
   majuscule de début de vers ou de phrase ne compte jamais, même répétée : « Dans le pré… / Dans le bois… » n'est pas
   un prénom) ∪ mots hors lexique → Set de formes normalisées (joker [unk]) */
export function poemProper(layout, oov = []) {
  const lowSeen = new Set(), midCap = new Set();
  const toks = layout && Array.isArray(layout.tokens) ? layout.tokens : [];
  const starts = new Set((layout && layout.verses || []).map(v => v.from));
  toks.forEach((t, idx) => {
    const m = String(t.raw).replace(/^[^\p{L}]+/u, '').match(/^[A-Za-zÀ-ÖØ-öø-ÿŒœ]+/);
    if (!m) return;
    const norm = normalize(t.raw);
    if (/^[a-zà-öø-ÿœ]/.test(m[0])) lowSeen.add(norm);
    else {
      const sentStart = idx === 0 || starts.has(idx) || /[.!?…:]["»\u00a0\u202f]*$/.test(toks[idx - 1].raw);
      if (!sentStart) midCap.add(norm);
    }
  });
  const set = new Set();
  for (const nrm of midCap) if (!lowSeen.has(nrm)) set.add(nrm);
  for (const w of Array.isArray(oov) ? oov : []) { const k = normalize(String(w)); if (k) set.add(k); }
  return set;
}

/* ---------- étapes : ce qui est montré de chaque mot ----------
   'show' : tout ; 'blank' : lettres cachées (la place du mot reste) ; 'initial' : 1re lettre seule ; 'gone' : rien
   (le mot apparaît quand il est dit). → tableau, un par mot. */
export function maskFor(layout, stage) {
  const toks = layout && Array.isArray(layout.tokens) ? layout.tokens : [];
  const verses = layout && Array.isArray(layout.verses) ? layout.verses : [];
  const n = toks.length;
  const s = stageOf(stage).n;
  const firstOf = new Set(verses.map(v => v.from));
  if (s === 1) return new Array(n).fill('show');
  if (s === 3) return toks.map(t => (letters(t.raw) <= 1 ? 'show' : 'initial'));
  if (s === 4) return toks.map((_, i) => (firstOf.has(i) ? 'show' : 'gone'));
  if (s === 5) return new Array(n).fill('gone');
  /* étape 2 : ≈ 1 mot sur 3 ; les rimes (dernier mot du vers) d'abord, puis des mots pleins répartis dans le texte */
  const out = new Array(n).fill('show');
  const target = Math.round(n / 3);
  const ok = i => !firstOf.has(i) && normalize(toks[i].raw).length >= 2;
  let hidden = 0;
  for (const v of verses) if (hidden < target && v.to > v.from && ok(v.to)) { out[v.to] = 'blank'; hidden++; }
  const content = [];
  for (let i = 0; i < n; i++) {
    const w = normalize(toks[i].raw);
    if (out[i] === 'show' && ok(i) && w.length >= 3 && !FORGIVE.has(w)) content.push(i);
  }
  const need = Math.min(content.length, target - hidden);
  if (need > 0) {
    const step = content.length / need;
    for (let k = 0; k < need; k++) out[content[Math.min(content.length - 1, Math.floor(k * step + step / 2))]] = 'blank';
  }
  return out;
}
const letters = raw => (String(raw).match(/\p{L}|\d/gu) || []).length;
/* morceaux d'un mot pour l'affichage : [{ t, hid }] — 'blank' cache lettres et chiffres (la ponctuation reste),
   'initial' garde la 1re lettre et celle qui suit une apostrophe ou un trait d'union (« l’h____ », « a__-e_-c___ ») */
export function wordParts(raw, mode) {
  const s = String(raw ?? '');
  if (mode !== 'blank' && mode !== 'initial') return [{ t: s, hid: false }];
  const out = [];
  let startOfPart = true;
  for (const ch of s) {
    const isL = /[\p{L}\d]/u.test(ch);
    const hid = isL && !(mode === 'initial' && startOfPart);
    if (isL) startOfPart = false;
    else if (/['’‘ʼ-]/.test(ch)) startOfPart = true;
    const last = out[out.length - 1];
    if (last && last.hid === hid) last.t += ch; else out.push({ t: ch, hid });
  }
  return out;
}

/* ---------- réussite d'une étape ---------- */
/* aides permises : une pour 8 vers (au moins une) — « une récitation avec une aide acceptée est réussie » */
export const helpsAllowed = verses => Math.max(1, Math.ceil((Math.trunc(Number(verses)) || 0) / 8));
/* { stage, read, total, helps, verses } → { ok, ratio } (read : mots retrouvés, total : mots du texte) */
export function runVerdict({ stage = 1, read = 0, total = 0, helps = 0, verses = 0 } = {}) {
  const tot = Math.max(0, Math.trunc(Number(total)) || 0);
  const ratio = tot ? clamp((Math.trunc(Number(read)) || 0) / tot, 0, 1) : 0;
  const s = stageOf(stage).n;
  const ok = tot > 0 && ratio >= PASS && (s === 1 || (Math.trunc(Number(helps)) || 0) <= helpsAllowed(verses));
  return { ok, ratio };
}
/* 🍎 d'effort : ≈ 1 par vers dit (proportion de mots retrouvés), au moins 1 dès qu'un mot a été dit, au plus APPLES_MAX */
export function poemApples({ read = 0, total = 0, verses = 0 } = {}) {
  const r = Math.trunc(Number(read)) || 0, tot = Math.trunc(Number(total)) || 0;
  if (r <= 0 || tot <= 0) return 0;
  return clamp(Math.round((Math.trunc(Number(verses)) || 0) * Math.min(1, r / tot)), 1, APPLES_MAX);
}

/* ---------- normalisation (js/core/profiles.js) ---------- */
function hash36(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function cleanOov(arr) {
  const out = [], seen = new Set();
  for (const w of Array.isArray(arr) ? arr : []) {
    if (typeof w !== 'string') continue;
    const t = cut(bareWord(w.replace(CTRL, '').replace(SPACES, ' ').trim()), 30);
    const k = normalize(t);
    if (!t || !k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= OOV_MAX) break;
  }
  return out;
}
/* une poésie → poésie normalisée, ou null (pas un objet, aucun mot) */
export function normPoem(v) {
  if (!isObj(v)) return null;
  const text = cleanPoemText(v.text);
  if (!poemLayout(text).n) return null;
  const best = clamp(int(v.best, 0), 0, STAGE_MAX);
  const out = {
    id: typeof v.id === 'string' && ID_RE.test(v.id) ? v.id : 'po' + hash36(text).slice(0, 12),
    title: cleanLabel(v.title, TITLE_MAX) || firstVerse(text) || 'Ma poésie',
    text,
    created: isDay(v.created) ? v.created : '',
    stage: Math.max(clamp(int(v.stage, 1), 1, STAGE_MAX), Math.min(STAGE_MAX, best + 1)),
    best,
    runs: clamp(int(v.runs, 0), 0, 99999),
    last: isDay(v.last) ? v.last : ''
  };
  const author = cleanLabel(v.author, AUTHOR_MAX);
  if (author) out.author = author;
  if (best >= STAGE_MAX && isDay(v.done)) out.done = v.done;
  if (typeof v.lex === 'string' && LEX_RE.test(v.lex)) { out.lex = v.lex; out.oov = cleanOov(v.oov); }
  for (const k of Object.keys(v)) {
    if (k in out || BAD_KEYS.has(k) || v[k] === undefined || ['author', 'done', 'lex', 'oov'].includes(k)) continue;
    try { out[k] = JSON.parse(JSON.stringify(v[k])); } catch (_) { /* valeur non clonable : ignorée */ }
  }
  return out;
}
/* liste → au plus POEMS_MAX poésies valides, ids uniques (ordre gardé : la plus récente en tête) */
export function normPoems(arr) {
  const out = [], ids = new Set();
  for (const v of Array.isArray(arr) ? arr : []) {
    if (out.length >= POEMS_MAX) break;
    const p = normPoem(v);
    if (!p) continue;
    let id = p.id, k = 2;
    while (ids.has(id)) id = p.id.slice(0, 15) + (k++).toString(36);
    p.id = id;
    ids.add(id);
    out.push(p);
  }
  return out;
}
/* nouvel identifiant (horodatage + hasard, base 36) */
export function newPoemId(list = [], now = Date.now(), rnd = Math.random) {
  const used = new Set((Array.isArray(list) ? list : []).map(p => p && p.id));
  let id;
  do { id = 'po' + Math.floor(now).toString(36).slice(-8) + Math.floor(rnd() * 1296).toString(36).padStart(2, '0'); now++; }
  while (used.has(id));
  return id;
}
export const poemsOf = profile => (isObj(profile) && Array.isArray(profile.poems) ? profile.poems.filter(isObj) : []);
export const poemById = (profile, id) => poemsOf(profile).find(p => p.id === id) || null;

/* ---------- fin d'un entraînement (à appeler dans store.mutateProfile) ----------
   run = { stage, read, total, helps, verses, ms } ; écrit la progression de la poésie, les 🍎 d'effort, le temps
   (compagnon, statistiques, semaine, série 🔥) et une entrée d'historique SANS axe ni θ :
   { d, t, g: 'course', mode: 'poesie', n: 1, ok, hint, ms } (temps de jeu du jour, « Cette semaine » des parents).
   Aucun mot dit → rien n'est écrit (empty: true) ; série 🔥 seulement si au moins la moitié des mots ont été dits.
   → { ok, ratio, apples, streakBonus, streakCount, stage, best, passed (étape franchie), mastered (sue par cœur) } | null */
export function applyPoemRun(profile, id, run, today, t = Date.now()) {
  const poem = poemById(profile, id);
  if (!poem) return null;
  const r = isObj(run) ? run : {};
  const s = stageOf(r.stage).n;
  const v = runVerdict({ ...r, stage: s });
  const prevBest = clamp(int(poem.best, 0), 0, STAGE_MAX);
  /* aucun mot dit (micro muet, « J'ai fini » tout de suite) : rien n'est compté */
  if ((Math.trunc(Number(r.read)) || 0) <= 0) {
    return { ok: false, ratio: 0, apples: 0, streakBonus: 0, streakCount: null, stage: poem.stage, best: poem.best, passed: false, mastered: false, empty: true };
  }
  poem.runs = clamp(int(poem.runs, 0) + 1, 0, 99999);
  poem.last = today;
  if (v.ok) {
    poem.best = Math.max(prevBest, s);
    poem.stage = Math.min(STAGE_MAX, Math.max(clamp(int(poem.stage, 1), 1, STAGE_MAX), s + 1));
    if (poem.best >= STAGE_MAX && !isDay(poem.done)) poem.done = today;
  }
  const apples = poemApples(r);
  if (apples) addApples(profile, apples, today);
  const ms = clamp(Math.round(Number(r.ms) || 0), 0, RUN_CAP_MS);
  const min = ms / 60000;
  bumpWeek(profile, { minutes: min, items: 1 }, today);
  if (!isObj(profile.stats)) profile.stats = { minutes: 0, sessions: 0, items: 0 };
  profile.stats.minutes = round2((Number(profile.stats.minutes) || 0) + min);
  profile.stats.items = (Math.trunc(Number(profile.stats.items)) || 0) + 1;
  if (isObj(profile.companion)) profile.companion.minutes = round2((Number(profile.companion.minutes) || 0) + min);
  /* série 🔥 (comme une partie finie) : seulement pour un vrai essai (au moins la moitié des mots) */
  const st = v.ratio >= 0.5 ? bumpStreak(profile, today) || {} : {};
  if (!Array.isArray(profile.history)) profile.history = [];
  profile.history.push({ d: today, t, g: 'course', mode: 'poesie', n: 1, ok: v.ok ? 1 : 0, hint: (Math.trunc(Number(r.helps)) || 0) > 0 ? 1 : 0, ms });
  if (profile.history.length > HISTORY_MAX) profile.history.splice(0, profile.history.length - HISTORY_MAX);
  return {
    ok: v.ok, ratio: v.ratio, apples, streakBonus: Math.max(0, Math.trunc(Number(st.bonus)) || 0),
    streakCount: Number.isFinite(st.count) ? st.count : null,
    stage: poem.stage, best: poem.best, passed: v.ok && s > prevBest, mastered: v.ok && s === STAGE_MAX
  };
}

/* ---------- pour l'espace parents ---------- */
/* phrase de suivi : « Étape 3 sur 5 · 4 entraînements · dernier : 2026-10-07 » est composée par l'écran ; ici, l'état */
export function progressOf(poem) {
  const best = clamp(int(poem && poem.best, 0), 0, STAGE_MAX);
  const stage = clamp(int(poem && poem.stage, 1), 1, STAGE_MAX);
  return { best, stage, mastered: best >= STAGE_MAX, runs: clamp(int(poem && poem.runs, 0), 0, 99999), last: poem && isDay(poem.last) ? poem.last : '' };
}
/* tokenize de la v11 sur le texte moteur : un jeton par mot affiché (vérifié par les tests) */
export const engineTokens = layout => tokenize(layout ? layout.engineText : '');
export { NNBSP };
