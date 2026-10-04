/* ============ LE GALOP DES TABLES — logique pure (aucun DOM) ============
   Importable par Node (tests/tables.test.mjs). Utilisé par js/games/tables.js.
   - promptParts(item)  : énoncé en jetons selon data.op / data.hole / data.reversed (la case « … » devient
                          la zone de réponse du panneau) ; promptText / promptAria / shownNumbers ;
   - answerInfo(item)   : réponse décimale ? voix possible ? ; checkTyped(saisie, item) : validation du pavé ;
   - createVoiceJudge() : décision de la voix — juste dès qu'il est entendu (résultat final, ou partiel resté
                          le même CONFIRM_MS : « quarante » ne vaut pas tant que l'enfant dit « quarante-cinq »),
                          un autre nombre stable STABLE_MS = essai faux, nombres de l'énoncé ignorés (l'enfant relit
                          souvent le calcul à voix haute : « sept fois huit… ») ;
   - hintVisual(item)   : petit dessin d'indice (quadrillage de points groupé selon la stratégie, boîtes de 10) ;
   - cruiseRate / brakeRate / rushRate : vitesse du monde (1 = galop normal) pendant l'approche de l'obstacle. */

import { parseSpoken, spell, grammarFor } from '../core/numbers-fr.js';
import { fmtNum, parseNum } from '../core/util.js';

export const HOLE = '\u{2026}';                  /* « … » de l'énoncé */
export const VOICE_MAX = 1000;                 /* voix possible : réponse entière ≤ 1 000 (cf. faits.js, data.voice) */
export const STABLE_MS = 1500;                 /* autre nombre entendu, stable 1,5 s → essai faux */
export const CONFIRM_MS = 350;                 /* bonne réponse sur un résultat partiel : stable 0,35 s */
export const GROUND_SPEED = 160;               /* px/s du sol à la vitesse 1 (galop) */
export const BRAKE_PX = 56;                    /* distance de freinage devant le compagnon */
export const EPS = 1e-9;

/* grammaire Vosk du jeu : EXACTEMENT les mots de grammarFor (formes du lexique, sans re-normalisation) */
export function voiceGrammar() { return grammarFor(VOICE_MAX); }

/* ---------- énoncé ---------- */
const num = v => ({ k: 'num', text: fmtNum(v), value: v });
const HOLE_PART = Object.freeze({ k: 'hole' });

/* item → [{ k: 'num', text, value } | { k: 'op', text } | { k: 'eq', text: '=' } | { k: 'word', text } | { k: 'hole' }]
   « 7 × 8 = … », « 7 × … = 56 », « 56 = 7 × … », « 56 ÷ 8 = … », « 7 + … = 10 », « 3,5 × 100 = … » ;
   double / moitié : « Le double de 8 est … », « La moitié de 16 est … » (format des fiches d'école). */
export function promptParts(item) {
  const d = item && item.data;
  if (!d || !d.op) return partsFromPrompt(item && item.prompt);
  if (d.op === 'double' || d.op === 'moitié') {
    return [{ k: 'word', text: d.op === 'double' ? 'Le double de' : 'La moitié de' }, num(d.a), { k: 'word', text: 'est' }, HOLE_PART];
  }
  const t = { a: num(d.a), b: num(d.b), c: num(d.c) };
  t[d.hole === 'a' || d.hole === 'b' ? d.hole : 'c'] = HOLE_PART;
  const op = { k: 'op', text: d.op }, eq = { k: 'eq', text: '=' };
  return d.reversed ? [t.c, eq, t.a, op, t.b] : [t.a, op, t.b, eq, t.c];
}
/* secours (item sans data) : découpe de item.prompt ; sans « … », la case est ajoutée après « = » */
function partsFromPrompt(prompt) {
  const s = String(prompt || '').trim();
  if (!s) return [HOLE_PART];
  const out = [];
  for (const tok of s.split(/ (?=[+×÷=−])|(?<=[+×÷=−]) /)) {
    const w = tok.trim();
    if (!w) continue;
    if (w === HOLE || w === '...' || w === '?') out.push(HOLE_PART);
    else if (w === '=') out.push({ k: 'eq', text: '=' });
    else if (/^[+×÷−]$/.test(w)) out.push({ k: 'op', text: w });
    else {
      const v = parseNum(w);
      out.push(Number.isFinite(v) ? { k: 'num', text: w, value: v } : { k: 'word', text: w });
    }
  }
  if (!out.some(p => p.k === 'hole')) out.push({ k: 'eq', text: '=' }, HOLE_PART);
  return out;
}
/* texte de l'énoncé reconstruit (la case = « … ») */
export function promptText(parts) {
  return parts.map(p => (p.k === 'hole' ? HOLE : p.text)).join(' ');
}
/* phrase pour les lecteurs d'écran : « 7 fois 8 égale combien ? » */
const ARIA_OP = { '+': 'plus', '×': 'fois', '÷': 'divisé par', '−': 'moins', '=': 'égale' };
export function promptAria(parts) {
  const words = parts.map(p => (p.k === 'hole' ? 'combien' : p.k === 'op' || p.k === 'eq' ? (ARIA_OP[p.text] || p.text) : p.text));
  return words.join(' ').replace(/\s+/g, ' ').trim() + '\u{202f}?';
}
/* nombres écrits sur le panneau (hors case) */
export function shownNumbers(parts) {
  return parts.filter(p => p.k === 'num' && Number.isFinite(p.value)).map(p => p.value);
}

/* ---------- réponse ---------- */
export function answerInfo(item) {
  const value = Number(item && item.answer);
  const ok = Number.isFinite(value);
  const decimal = ok && !Number.isInteger(value);
  const text = ok ? fmtNum(value) : '';
  const len = text.replace(/\s/g, '').length;
  const voice = ok && !decimal && value >= 0 && value <= VOICE_MAX && !(item.data && item.data.voice === false);
  return { value, decimal, text, len, voice };
}
/* saisie du pavé (« 56 », « 3,5 ») → { valid, ok, value } */
export function checkTyped(str, item) {
  const v = parseNum(str);
  if (!Number.isFinite(v)) return { valid: false, ok: false, value: NaN };
  return { valid: true, ok: Math.abs(v - Number(item.answer)) < EPS, value: v };
}
/* largeur de la case en caractères (place pour la réponse attendue et un chiffre de plus) */
export function holeChars(item) {
  const { len } = answerInfo(item);
  return Math.min(8, Math.max(2, len + 1));
}

/* ---------- voix ---------- */
/* « 👂 cinquante-six » : écriture du nombre entendu (orthographe rectifiée, celle des programmes) */
export function heardLabel(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '';
  if (Number.isInteger(v) && v >= 0 && v <= 999999999999) { try { return spell(v); } catch (_) { /* repli */ } }
  return fmtNum(v);
}

/* Juge de la voix (un par item). feed(texteCumulé, final, t) et tick(t) → événement :
   { kind: 'none' } | { kind: 'heard', value, ignored?, due? } | { kind: 'right', value, at } | { kind: 'wrong', value, at }
   due = instant où rappeler tick() ; at = instant où le nombre a été entendu pour la première fois. */
export function createVoiceJudge({ answer, ignore = [], confirmMs = CONFIRM_MS, stableMs = STABLE_MS } = {}) {
  const target = Number(answer);
  const ign = new Set((ignore || []).filter(Number.isFinite));
  let last = null, since = 0, done = false;
  const isRight = v => v !== null && Number.isFinite(target) && Math.abs(v - target) < EPS;
  const judge = (t, isFinal) => {
    if (isRight(last)) {
      if (isFinal || t - since >= confirmMs) { done = true; return { kind: 'right', value: last, at: since }; }
      return { kind: 'heard', value: last, due: since + confirmMs };
    }
    if (ign.has(last)) return { kind: 'heard', value: last, ignored: true };
    if (t - since >= stableMs) {
      const v = last, at = since;
      last = null; since = 0;
      return { kind: 'wrong', value: v, at };
    }
    return { kind: 'heard', value: last, due: since + stableMs };
  };
  return {
    feed(text, isFinal, t) {
      if (done) return { kind: 'none' };
      const v = parseSpoken(String(text ?? ''));
      if (v === null) return { kind: 'none' };
      if (v !== last) { last = v; since = t; }
      return judge(t, !!isFinal);
    },
    tick(t) {
      if (done || last === null) return { kind: 'none' };
      const ev = judge(t, false);
      return ev.kind === 'heard' ? { kind: 'none', due: ev.due } : ev;
    },
    reset() { last = null; since = 0; done = false; },
    get value() { return last; },
    get done() { return done; }
  };
}

/* ---------- indice visuel ---------- */
/* colonnes groupées comme la stratégie de l'indice (faits.js : × 8 = double de × 4, × 9 = × 10 moins une fois…) */
const COL_GROUPS = { 2: [1, 1], 3: [2, 1], 4: [2, 2], 5: [5], 6: [5, 1], 7: [5, 2], 8: [4, 4], 9: [5, 4], 10: [5, 5] };
const GHOST = { 5: 5, 9: 1 };                  /* colonnes « fantômes » : × 5 = moitié de × 10, × 9 = × 10 − 1 */
const STRATEGY_ORDER = [1, 10, 2, 5, 9, 4, 3, 8, 6, 7];   /* même ordre que mulStrategy (faits.js) */
const small = v => Number.isInteger(v) && v >= 2 && v <= 10;

/* → { type: 'array', rows, cols, groups, ghost, caption } | { type: 'frames', parts: [{ n, kind }], total, caption } | null */
export function hintVisual(item) {
  const d = item && item.data;
  if (!d) return null;
  if (item.kind === 'mul' && d.op === '×' && small(d.a) && small(d.b)) {
    const x = Math.min(d.a, d.b), y = Math.max(d.a, d.b);
    const t = STRATEGY_ORDER.find(k => k === x || k === y) || y;
    const n = t === x ? y : x;
    return { type: 'array', rows: n, cols: t, groups: COL_GROUPS[t], ghost: GHOST[t] || 0, caption: `${n} rangées de ${t}` };
  }
  if (item.kind === 'facteur' && d.op === '×' && (d.hole === 'a' || d.hole === 'b')) {
    const k = d.hole === 'a' ? d.b : d.a, ans = d.hole === 'a' ? d.a : d.b;
    if (!small(k) || !small(ans)) return null;
    return { type: 'array', rows: ans, cols: k, groups: COL_GROUPS[k], ghost: 0, caption: `Combien de rangées de ${k}\u{202f}?` };
  }
  if (item.kind === 'div' && d.op === '÷' && small(d.b) && small(d.c)) {
    return { type: 'array', rows: d.c, cols: d.b, groups: COL_GROUPS[d.b], ghost: 0, caption: `Combien de rangées de ${d.b}\u{202f}?` };
  }
  if ((item.kind === 'add' || item.kind === 'c10') && d.op === '+' && Number.isInteger(d.c) && d.c >= 2 && d.c <= 20) {
    if (d.hole === 'c') {
      if (d.a === 0 || d.b === 0) return null;
      return { type: 'frames', parts: [{ n: d.a, kind: 'a' }, { n: d.b, kind: 'b' }], total: d.c,
        caption: d.c > 10 ? 'Remplis d’abord la boîte de 10' : 'Compte tous les points' };
    }
    const known = d.hole === 'a' ? d.b : d.a, miss = d.c - known;
    if (known <= 0 || miss <= 0) return null;
    return { type: 'frames', parts: [{ n: known, kind: 'a' }, { n: miss, kind: 'missing' }], total: d.c,
      caption: 'Combien de ronds pointillés\u{202f}?' };
  }
  if (item.kind === 'double' && Number.isInteger(d.a) && d.a >= 1 && d.a <= 10) {
    return { type: 'frames', parts: [{ n: d.a, kind: 'a' }, { n: d.a, kind: 'b' }], total: 2 * d.a, caption: `${d.a} et encore ${d.a}` };
  }
  return null;
}
/* cellules d'une boîte de 10 (2 rangées de 5) ou de deux : [{ kind: 'a'|'b'|'missing'|'empty' }] par boîte */
export function frameCells(vis) {
  const boxes = vis.total > 10 ? 2 : 1;
  const cells = [];
  for (const p of vis.parts) for (let i = 0; i < p.n; i++) cells.push(p.kind);
  while (cells.length < boxes * 10) cells.push('empty');
  return Array.from({ length: boxes }, (_, b) => cells.slice(b * 10, b * 10 + 10));
}

/* ---------- vitesse du monde ---------- */
/* vitesse de croisière pendant l'approche : zen → 1 ; chrono → arrivée en 2 × autoMs (freinage compris) */
export function cruiseRate({ timers = false, distance = 0, autoMs = 3000, speed = GROUND_SPEED, brake = BRAKE_PX } = {}) {
  if (!timers) return 1;
  const T = Math.max(1, 2 * (Number(autoMs) || 3000) / 1000);
  const r = (Math.max(0, distance) + Math.max(0, brake)) / (speed * T);
  return Math.min(1, Math.max(0.08, r));
}
/* freinage « en racine » : vitesse ∝ √(distance restante) → arrêt doux et pile devant le compagnon */
export function brakeRate(remaining, cruise = 1, brake = BRAKE_PX) {
  if (!(remaining > 0.5)) return 0;
  if (remaining >= brake) return cruise;
  return Math.max(0.04, cruise * Math.sqrt(remaining / brake));
}
/* bonne réponse avant l'arrivée de l'obstacle : on accélère pour le rejoindre en ≈ 0,35 s */
export function rushRate(remaining, speed = GROUND_SPEED) {
  return Math.min(4, Math.max(1.6, Math.max(0, remaining) / (speed * 0.35)));
}
/* durée (s) estimée de l'approche avec freinage, pour la jauge du chrono */
export function approachSeconds(distance, cruise = 1, speed = GROUND_SPEED, brake = BRAKE_PX) {
  const d = Math.max(0, distance), b = Math.min(brake, d);
  return ((d - b) + 2 * b) / (speed * Math.max(0.01, cruise));
}

/* combo affiché à partir de 2 réussites de suite : « ⚡ 3 » (🔥 est réservé aux jours de suite, D4-12) */
export function comboLabel(streak) {
  const s = Math.floor(Number(streak) || 0);
  return s >= 2 ? '\u{26A1}\u{a0}' + s : '';
}
