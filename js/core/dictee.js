/* ============ LA DICTÉE DE LA SEMAINE — logique pure (v2.6, décisions du parent du 07/10/2026) ============
   La liste de mots de la semaine (souvent recopiée à la main par l'enfant dans son cahier) est TAPÉE par un adulte dans
   l'espace parents (ni photo ni lecture automatique) ; le compagnon la dicte lentement, au rythme de la classe
   « mot… phrase… mot » (phrase facultative) ; l'enfant écrit sur papier puis se corrige LUI-MÊME : le mot juste
   s'affiche, il compare et touche « ✓ Juste » ou « ✗ À revoir » (aucune reconnaissance d'écriture : non fiable en 2026,
   étude dictee-problemes §A.3). Module pur (importable sous Node) : js/core/profiles.js (normalisation),
   js/content/fr/dictee.js (générateur fr.ortho), js/games/dictee.js (le jeu), js/ui/parents.js (la carte adulte).

   profile.dictee (facultatif, absent = aucune liste) = { words: [{ w, s? }], d }
     w = le mot (ou un petit groupe : « un chat », « aujourd’hui »), tel que l'adulte l'a tapé : lettres, ’, trait
         d'union, espaces ; ≤ 40 caractères ;
     s = phrase facultative qui l'emploie (« Je rentre à la maison. »), ≤ 160 caractères, majuscule et point ajoutés ;
     d = jour de la saisie ou de la dernière modification (AAAA-MM-JJ) ;
   1 à 20 mots, sans doublon (même mot en minuscules) ; une liste vide n'existe pas (le champ disparaît).
   Exporté dans les sauvegardes avec le reste du profil ; jamais dans « Avec un copain » ni le Défi.

   Répétition espacée (CDC §7.5 : « mots de dictée ») : clé Leitner 'fr.ortho:<mot en minuscules>' (accents gardés :
   « a » et « à » sont deux mots). « ✓ Juste » = juste du premier coup ; « ✗ À revoir » → boîte 1. La fois suivante, les
   mots à revoir passent EN TÊTE (order), puis les mots jamais dictés, puis ceux dont la révision est due, puis les autres.
   La liste de la semaine ne bouge PAS θ de fr.ortho (item.measure === false, js/core/manche.js) : ses mots ont été
   travaillés en classe et l'enfant se corrige seul — ce n'est pas une mesure de l'orthographe (étude §A.4). */

import { dayStr, clamp } from './util.js';

export const AXIS = 'fr.ortho';
export const MAX_WORDS = 20;
export const MAX_WORD_LEN = 40;
export const MAX_PHRASE_LEN = 160;
/* rituel de la classe : mot · silence · phrase · silence · mot ; débit (length_scale × lenteur de la voix fluide, et
   vitesse 0,95 / lenteur pour la voix du téléphone) — à faire écouter au parent, comme le degré de rajeunissement */
export const WORD_SLOW = 1.35;
export const PHRASE_SLOW = 1.1;
export const PAUSE_MS = 1400;            /* entre le mot et la phrase */
export const PAUSE_ALONE_MS = 1700;      /* entre les deux mots, sans phrase */
/* taille d'une dictée de balade (séance de 10, 15, 20 min) ; partie libre : toute la liste */
export const BALADE_WORDS = Object.freeze({ 10: 6, 15: 8, 20: 10 });

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const APOS = /['\u2018\u02BC\u0060\u00B4]/g;          /* ' ‘ ʼ ` ´ → ’ (apostrophe typographique de l'interface) */
const CTRL = /[\u0000-\u001f\u007f-\u009f]/g;
const CTRL_LINE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;   /* la tabulation sépare le mot de sa phrase */

/* ---------- nettoyage d'un mot, d'une phrase ---------- */
/* lettres (accents compris), ’, trait d'union, espaces ; puces et numéros de liste retirés (« 1. maison », « - chat ») */
export function cleanWord(v) {
  let t = String(v ?? '').normalize('NFC').replace(CTRL, ' ').replace(APOS, '’').replace(/[\u2010-\u2015\u2212]/g, '-');
  t = t.replace(/[^\p{L}\p{M}’\- ]+/gu, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^[’\-\s]+|[’\-\s]+$/g, '').replace(/\s*-\s*/g, '-').replace(/\s*’\s*/g, '’');
  if (t.length > MAX_WORD_LEN) t = t.slice(0, MAX_WORD_LEN).replace(/[’\-\s]+$/, '');
  return t;
}
/* phrase : texte libre (sans < > { } ni caractères de contrôle), majuscule initiale, point final ajouté s'il manque */
export function cleanPhrase(v) {
  let t = String(v ?? '').normalize('NFC').replace(CTRL, ' ').replace(APOS, '’').replace(/[<>{}\\]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  t = t.replace(/^[,;:.!?…\-–—\s]+/, '');
  if (!t) return '';
  if (t.length > MAX_PHRASE_LEN) t = t.slice(0, MAX_PHRASE_LEN).replace(/[\s,;:’-]+$/, '');
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.!?…»"]$/.test(t)) t += '.';
  return t;
}
/* clé Leitner (et de déduplication) d'un mot : minuscules, accents gardés */
export const wordId = w => cleanWord(w).toLocaleLowerCase('fr');
export const keyOf = w => AXIS + ':' + wordId(w);

/* ---------- saisie de l'adulte → liste ----------
   Un mot par ligne, ou plusieurs séparés par des virgules (ou points-virgules). Phrase facultative après « : » (ou une
   tabulation, ou un tiret entouré d'espaces) : « maison : Je rentre à la maison. » Le trait d'union collé reste dans le
   mot (« arc-en-ciel »). → { words: [{ w, s? }], extra (mots au-delà de 20, ignorés), dup (doublons retirés),
   cut (mots ou phrases raccourcis) } */
const SEP = /\s*(?::|\t|\s[-–—]\s)\s*/;
export function parseList(text) {
  const words = [], seen = new Set();
  let extra = 0, dup = 0, cut = 0;
  const add = (rawW, rawS) => {
    const w = cleanWord(rawW);
    if (!w) return;
    const id = w.toLocaleLowerCase('fr');
    if (seen.has(id)) { dup++; return; }
    if (words.length >= MAX_WORDS) { extra++; return; }
    seen.add(id);
    const e = { w };
    const s = cleanPhrase(rawS);
    if (s) e.s = s;
    if (String(rawW).trim().length > MAX_WORD_LEN + 4 || String(rawS ?? '').trim().length > MAX_PHRASE_LEN + 1) cut++;
    words.push(e);
  };
  for (const raw of String(text ?? '').split(/\r?\n|\r/)) {
    const line = raw.replace(CTRL_LINE, ' ').trim();
    if (!line) continue;
    const m = SEP.exec(line);
    if (m && m.index > 0) add(line.slice(0, m.index).replace(/[,;]/g, ' '), line.slice(m.index + m[0].length));
    else for (const part of line.split(/[,;]/)) add(part, '');
  }
  return { words, extra, dup, cut };
}
/* liste → texte modifiable (« mot » ou « mot : phrase », une ligne par mot) */
export function listText(dictee) {
  const d = normDictee(dictee);
  if (!d) return '';
  return d.words.map(e => (e.s ? e.w + ' : ' + e.s : e.w)).join('\n');
}

/* ---------- normalisation (js/core/profiles.js) ---------- */
/* → { words, d } (champs inconnus du haut gardés, pour une version future) ou null (aucun mot : pas de liste) */
export function normDictee(v, today) {
  if (!isObj(v)) return null;
  const words = [], seen = new Set();
  for (const e of Array.isArray(v.words) ? v.words : []) {
    const src = isObj(e) ? e : typeof e === 'string' ? { w: e } : null;
    if (!src || typeof src.w !== 'string') continue;
    const w = cleanWord(src.w);
    if (!w) continue;
    const id = w.toLocaleLowerCase('fr');
    if (seen.has(id)) continue;
    seen.add(id);
    const o = { w };
    const s = typeof src.s === 'string' ? cleanPhrase(src.s) : '';
    if (s) o.s = s;
    words.push(o);
    if (words.length >= MAX_WORDS) break;
  }
  if (!words.length) return null;
  const out = { words, d: isDay(v.d) ? v.d : isDay(today) ? today : dayStr() };
  for (const k of Object.keys(v)) {
    if (k in out || k === '__proto__' || k === 'constructor' || k === 'prototype' || v[k] === undefined) continue;
    try { out[k] = JSON.parse(JSON.stringify(v[k])); } catch (_) {}
  }
  return out;
}
export function hasList(profile) {
  const d = isObj(profile) ? profile.dictee : null;
  return !!(isObj(d) && Array.isArray(d.words) && d.words.some(e => isObj(e) && cleanWord(e.w)));
}
/* la liste du profil (normalisée) ou [] */
export function listOf(profile) {
  const d = normDictee(isObj(profile) ? profile.dictee : null);
  return d ? d.words : [];
}

/* ---------- état d'un mot (Leitner) et ordre de la dictée ---------- */
/* 'revoir' (raté la dernière fois : boîte 1) | 'new' (jamais dicté) | 'due' (révision due) | 'ok' */
export function wordState(profile, w, today = dayStr()) {
  const L = isObj(profile) && isObj(profile.leitner) ? profile.leitner : null;
  const e = L ? L[keyOf(w)] : null;
  if (!isObj(e)) return 'new';
  if (Math.round(Number(e.b) || 1) <= 1) return 'revoir';
  return typeof e.due === 'string' && e.due <= today ? 'due' : 'ok';
}
const RANK = { revoir: 0, new: 1, due: 2, ok: 3 };
/* mots dans l'ordre de la dictée : à revoir d'abord, puis jamais dictés, puis dus, puis les autres (échéance la plus
   proche d'abord) ; à égalité, l'ordre de la liste. limit : nombre de mots (0 ou absent : tous) */
export function order(profile, { today = dayStr(), limit = 0 } = {}) {
  const L = isObj(profile) && isObj(profile.leitner) ? profile.leitner : {};
  const list = listOf(profile).map((e, i) => {
    const st = wordState(profile, e.w, today);
    const x = L[keyOf(e.w)];
    return { ...e, i, st, due: isObj(x) && typeof x.due === 'string' ? x.due : '' };
  });
  list.sort((a, b) => RANK[a.st] - RANK[b.st] || (a.st === 'ok' && a.due !== b.due ? (a.due < b.due ? -1 : 1) : 0) || a.i - b.i);
  const n = Number(limit) > 0 ? Math.min(list.length, Math.floor(limit)) : list.length;
  return list.slice(0, n).map(({ w, s, st }) => (s ? { w, s, st } : { w, st }));
}
/* nombre de mots d'une dictée : balade → selon la durée de séance (6, 8, 10), partie libre → toute la liste */
export function sizeFor(profile, mode = 'libre') {
  const n = listOf(profile).length;
  if (mode !== 'balade') return n;
  const min = isObj(profile) && isObj(profile.settings) ? Number(profile.settings.sessionMin) : 15;
  return Math.min(n, BALADE_WORDS[min] || BALADE_WORDS[15]);
}
/* mots à travailler (à revoir, jamais dictés, révision due) : la balade en fait un bloc de révision dès 4 mots,
   comme les clés Leitner dues des tables et de la conjugaison (js/core/session.js) */
export function toWork(profile, today = dayStr()) {
  return listOf(profile).filter(e => wordState(profile, e.w, today) !== 'ok').length;
}
/* mots « à revoir » de la liste (espace parents) */
export function toReview(profile, today = dayStr()) {
  return listOf(profile).filter(e => wordState(profile, e.w, today) === 'revoir').map(e => e.w);
}

/* ---------- rituel « mot… phrase… mot » ----------
   → morceaux à dire dans l'ordre : { say, slow } (texte, lenteur) ou { pause } (ms). Le mot est dit avec un point
   (intonation de fin de phrase, pas de question). */
export function ritual(entry) {
  const w = cleanWord(entry && entry.w);
  if (!w) return [];
  const word = { say: w + '.', slow: WORD_SLOW };
  const s = cleanPhrase(entry && entry.s);
  return s ? [word, { pause: PAUSE_MS }, { say: s, slow: PHRASE_SLOW }, { pause: PAUSE_MS }, { ...word }]
    : [word, { pause: PAUSE_ALONE_MS }, { ...word }];
}
/* texte du rituel d'un seul tenant (🔁 de l'en-tête, lecteurs d'écran) */
export function ritualText(entry) {
  return ritual(entry).filter(p => p.say).map(p => p.say.replace(/\.$/, '…')).join(' ').replace(/…$/, '.');
}
/* textes (et lenteurs) à calculer à l'avance pour une dictée : chaque texte une seule fois */
export function prepList(entries) {
  const out = [], seen = new Set();
  for (const e of Array.isArray(entries) ? entries : []) {
    for (const p of ritual(e)) {
      if (!p.say) continue;
      const k = p.slow + '|' + p.say;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ text: p.say, slow: p.slow });
    }
  }
  return out;
}
/* joue le rituel : speak(texte, lenteur) → Promise ; wait(ms) → Promise ; alive() → false pour tout arrêter
   (« 🔁 Encore », changement d'écran) → Promise<boolean> (vrai : tout a été dit) */
export async function playRitual(entry, { speak, wait, alive = () => true } = {}) {
  let all = true;
  for (const p of ritual(entry)) {
    if (!alive()) return false;
    if (p.pause) { await wait(p.pause); continue; }
    let ok = false;
    try { ok = !!(await speak(p.say, p.slow)); } catch (_) { ok = false; }
    if (!ok) all = false;
  }
  return all && alive();
}

/* ---------- textes ---------- */
/* phrase du bilan : seulement ce qui a été réussi (jamais d'erreur comptée ni de note) */
export function praise(summary) {
  const n = Math.max(0, (summary && summary.n) | 0), c = clamp(Math.max(0, (summary && summary.clean) | 0), 0, n || 0);
  if (n > 1 && c === n) return 'Tu as su écrire tous tes mots du premier coup, bravo !';
  if (n === 1 && c === 1) return 'Tu as su écrire ton mot du premier coup, bravo !';
  if (c >= 2) return 'Tu as su écrire ' + c + ' mots du premier coup !';
  if (c === 1) return 'Tu as su écrire un mot du premier coup !';
  return 'Tu as bien comparé tes mots avec le modèle, bravo !';
}
/* phrases fixes du jeu (à enregistrer en clips : rapport dictee-impl) */
export const LINES = Object.freeze({
  prep: 'Je prépare ta dictée…',
  ready: 'Prends une feuille et un crayon.',
  listen: 'Écoute bien, puis écris le mot sur ta feuille.',
  write: 'Écris le mot, puis touche « C’est écrit ».',
  compare: 'Regarde ta feuille : as-tu écrit pareil ?',
  copy: 'Pas grave ! Regarde bien le mot, et recopie-le juste à côté.',
  noList: 'Pour la dictée, un adulte doit d’abord taper ta liste de mots.',
  noVoice: 'Je n’arrive pas à parler sur ce téléphone. Demande à un adulte de t’aider.',
  muted: 'Le son est coupé : touche 🔇 en haut pour m’entendre.'
});
