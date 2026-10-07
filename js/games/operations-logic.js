/* ============ L’ATELIER DES OPÉRATIONS — logique pure (aucun DOM) ============
   Moteur d'étapes du jeu js/games/operations.js (docs/JEUX.md §7). Le générateur ma.operations
   (js/content/maths/operations.js, contrat complet en tête de fichier) fournit la grille FINALE et la suite
   des étapes ; ce module les JOUE :
   - analyzeGrid(grid) : géométrie de la feuille en unités de case (lignes repliées, traits, potence) ;
   - fitCell(...)      : taille de case qui fait tout tenir (largeur ET hauteur), jamais de défilement ;
   - createRun(item)   : progression d'une opération — étapes automatiques jouées d'un coup jusqu'à la prochaine
                         question, attente d'UN chiffre, 1re erreur → indice, 2e erreur → chiffre posé et on
                         continue (on ne bloque jamais), joker, coup de pouce (item.assist), état des cases
                         (visibles, barrées, données, retenues pâlies, emplacements du quotient), surlignage
                         (case attendue, cases en jeu, colonne courante) et comptage des aides → outcome.
   - voiceTarget / voiceVerdict / voiceTotalNote : répondre à voix haute (v2.3), voir en fin de fichier.
   Une case est désignée par sa clé « r,c » ou « r,c,pos » (annotation collée à un chiffre). */

import { CONFIRM_MS, STABLE_MS, heardLabel } from './tables-logic.js';
import { frTypo } from '../core/util.js';

/* ---------- clés de case ---------- */
export const cellKey = c => c.r + ',' + c.c + (c.pos ? ',' + c.pos : '');
export const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/* ---------- géométrie ----------
   Toutes les colonnes ont la même largeur (1 unité = 1 grand carreau Seyès), sauf la colonne du trait vertical de la
   potence, de largeur 0 : comme sur le cahier, le trait est tracé SUR une ligne du quadrillage, entre le dividende et
   le diviseur. Chaque ligne occupe un carreau entier (retenues et marques s'y écrivent en petit), sauf :
   - les lignes 'rule' (trait de l'opération) : hauteur 0, le trait est tracé sur la ligne du cahier ;
   - les lignes sans aucune case (ex. retenues d'une ligne de produit qui n'en a pas) : repliées.
   → { rows, cols, colUnits[c] (0 | 1), left[c] (unités), width, units[r] (0 | 1), top[r] (unités), height,
       potence: { c, r } | null,
       lines: [{ kind: 'rule' | 'bar' | 'barH' | 'sub', x0, x1, y0, y1, r, keys }],
       finalKeys (résultat ou quotient), restKeys (reste final d'une division euclidienne),
       quotientKeys (chiffres du quotient, de gauche à droite), rowAnchor[r] ('bottom' | 'top' | 'mid') } */
export function analyzeGrid(grid) {
  const rows = grid.rows | 0, cols = grid.cols | 0;
  const info = grid.rowInfo || [];
  const byRow = Array.from({ length: rows }, () => []);
  for (const c of grid.cells) if (c.r >= 0 && c.r < rows) byRow[c.r].push(c);
  const corner = grid.cells.find(c => c.ch === '├') || null;
  const potence = corner ? { c: corner.c, r: corner.r } : null;
  const roleOf = r => (info[r] && info[r].role) || '';

  const colUnits = new Array(cols).fill(1), left = [];
  if (potence && potence.c >= 0 && potence.c < cols) colUnits[potence.c] = 0;
  let x = 0;
  for (let c = 0; c < cols; c++) { left[c] = x; x += colUnits[c]; }
  const width = x;
  const right = c => left[c] + colUnits[c];

  const units = [], top = [];
  let y = 0;
  for (let r = 0; r < rows; r++) {
    const ruleRow = roleOf(r) === 'rule' && byRow[r].every(c => c.role === 'rule');
    units[r] = ruleRow || byRow[r].length === 0 ? 0 : 1;
    top[r] = y;
    y += units[r];
  }
  const height = y;

  /* première et dernière ligne « nombres » (hors retenues/marques) : sert à placer les petites annotations */
  const isBig = r => ['operand', 'partial', 'result', 'sub', 'rest'].includes(roleOf(r));
  let firstBig = -1;
  for (let r = 0; r < rows; r++) if (isBig(r) && units[r]) { firstBig = r; break; }
  const rowAnchor = [];
  for (let r = 0; r < rows; r++) {
    const role = roleOf(r);
    /* retenues au-dessus des nombres (et marques du cassage) : collées en bas, contre le chiffre qu'elles annotent ;
       « +1 » de la compensation, sous le nombre du bas : collé en haut */
    if (role === 'carry' || (role === 'mark' && (firstBig < 0 || r < firstBig))) rowAnchor[r] = 'bottom';
    else if (role === 'mark') rowAnchor[r] = 'top';
    else rowAnchor[r] = 'mid';
  }

  const lines = [];
  /* traits horizontaux des + − × : segments contigus d'une ligne 'rule' */
  for (let r = 0; r < rows; r++) {
    const rc = byRow[r].filter(c => c.role === 'rule' && c.ch === '─').map(c => c.c).sort((a, b) => a - b);
    if (!rc.length || (potence && r === potence.r)) continue;
    let s = rc[0], p = rc[0];
    for (let i = 1; i <= rc.length; i++) {
      if (i < rc.length && rc[i] === p + 1) { p = rc[i]; continue; }
      lines.push({ kind: 'rule', r, x0: left[s], x1: right(p), y0: top[r], y1: top[r] });
      if (i < rc.length) { s = p = rc[i]; }
    }
  }
  if (potence) {
    const vr = grid.cells.filter(c => c.c === potence.c && (c.ch === '│' || c.ch === '├')).map(c => c.r);
    const r0 = Math.min(...vr), r1 = Math.max(...vr);
    const xb = Math.max(0, left[potence.c] - 0.1);   /* un peu à gauche de la ligne : place pour le quotient */
    lines.push({ kind: 'bar', x0: xb, x1: xb, y0: top[r0] + 0.06, y1: top[r1] + units[r1] - 0.06 });
    const hc = byRow[potence.r].filter(c => c.role === 'rule' && c.ch === '─').map(c => c.c);
    const xEnd = hc.length ? right(Math.max(...hc)) : width;
    const yh = top[potence.r] + units[potence.r] / 2;
    lines.push({ kind: 'barH', x0: xb, x1: xEnd - 0.08, y0: yh, y1: yh });
    /* soustractions de la potence : on souligne le produit (signe compris) */
    for (let r = 0; r < rows; r++) {
      if (roleOf(r) !== 'sub') continue;
      const cs = byRow[r].filter(c => (c.role === 'sub' || c.role === 'sign') && c.c < potence.c && !c.pos);
      if (!cs.length) continue;
      const xs = cs.map(c => c.c);
      lines.push({ kind: 'sub', r, x0: left[Math.min(...xs)] + 0.08, x1: right(Math.max(...xs)) - 0.08, y0: top[r] + units[r], y1: top[r] + units[r],
        keys: cs.filter(c => c.role === 'sub').map(cellKey) });
    }
  }

  /* cases mises en valeur à la fin : ligne du résultat, ou quotient (+ reste final d'une division euclidienne) */
  let finalKeys = [], restKeys = [], quotientKeys = [];
  if (potence) {
    const q = grid.cells.filter(c => c.role === 'quotient' && !c.pos).sort((a, b) => a.c - b.c);
    quotientKeys = q.map(cellKey);
    finalKeys = grid.cells.filter(c => (c.role === 'quotient' || (c.role === 'comma' && c.c > potence.c))).map(cellKey);
    let last = -1;
    for (let r = rows - 1; r >= 0; r--) if (byRow[r].some(c => c.role === 'rest' && c.c < potence.c)) { last = r; break; }
    if (last >= 0) restKeys = byRow[last].filter(c => c.role === 'rest' && c.c < potence.c).map(cellKey);
  } else {
    for (let r = 0; r < rows; r++) if (roleOf(r) === 'result') finalKeys.push(...byRow[r].filter(c => c.role !== 'rule').map(cellKey));
  }
  return { rows, cols, colUnits, left, width, units, top, height, potence, lines, finalKeys, restKeys, quotientKeys, rowAnchor };
}

/* étendue (en unités) d'un ensemble de cases : { x0, x1, y0, y1 } ou null */
export function extentOf(keys, geo) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const k of keys) {
    const [r, c] = k.split(',').map(Number);
    if (!(r >= 0) || !(c >= 0)) continue;
    const lx = geo.left ? geo.left[c] : c, w = geo.colUnits ? geo.colUnits[c] : 1;
    x0 = Math.min(x0, lx); x1 = Math.max(x1, lx + Math.max(w, 1));
    y0 = Math.min(y0, geo.top[r]); y1 = Math.max(y1, geo.top[r] + Math.max(geo.units[r], 1));
  }
  return x0 === Infinity ? null : { x0, x1, y0, y1 };
}

/* taille de case (px) pour faire tenir cols × height carreaux dans W × H (cols = geo.width) ; bornée [min ; max] ;
   jamais plus large que la place disponible (min ne l'emporte pas sur la largeur : pas de défilement horizontal) */
export function fitCell({ W, H, cols, height, max = 56, min = 14 }) {
  const byW = cols > 0 ? W / cols : max;
  const byH = height > 0 ? H / height : max;
  let cw = Math.floor(Math.min(max, byW, Math.max(byH, min)));
  if (cols > 0 && cw * cols > W) cw = Math.floor(W / cols);
  return Math.max(1, cw);
}

/* tailles de police (px) d'une case de cw px : chiffre, annotation. Les petites cases (grandes opérations sur
   téléphone) prennent un corps relativement plus grand : un chiffre Fredoka ne fait que 0,6 em de large. */
export function fontSizes(cw) {
  const k = cw <= 24 ? 0.84 : cw >= 40 ? 0.7 : 0.84 - (cw - 24) * (0.14 / 16);
  return { big: Math.round(cw * k), small: Math.max(11, Math.round(cw * (cw <= 24 ? 0.54 : 0.46))) };
}

/* ---------- moteur d'étapes ----------
   createRun(item, { assist }) → run :
     run.start()       → { autos: [étapes jouées], done }  (étapes automatiques jusqu'à la première question)
     run.answer(d)     → { result: 'right' | 'retry' | 'given' | 'ignored', step, autos, done, tries }
                          right : chiffre posé ; retry : 1re erreur (montrer step.hint, nouvel essai) ;
                          given : 2e erreur, le chiffre attendu est posé, on continue
     run.joker()       → { step, already } | null   (indice de l'étape en cours)
     run.current       → étape attendue (ask) ou null (terminé)
     run.view()        → { target, focus, band, step } : case attendue, cases en jeu, colonne courante
     run.hintShown     → l'indice de l'étape en cours est montré (erreur, joker ou coup de pouce)
     run.visible / struck / given / slots : Set de clés ; run.isStale(clé) : retenue d'une ligne terminée
     run.outcome(ms)   → { correct, hinted, ms, tries } (rapport de l'item, contrat §7.3)
     run.stats         → { errors, given, jokers, asked, answered } */
export function createRun(item, { assist = false } = {}) {
  const data = (item && item.data) || {};
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const grid = data.grid || { rows: 0, cols: 0, rowInfo: [], cells: [] };
  const cellByKey = new Map(grid.cells.map(c => [cellKey(c), c]));
  const visible = new Set(grid.cells.filter(c => !c.hidden).map(cellKey));
  const struck = new Set(), given = new Set(), slots = new Set();
  const hintedSteps = new Set();
  const carryRow = new Map();                      /* retenue → ligne qu'elle sert (pour la pâlir ensuite) */
  let index = 0, tries = 0, errors = 0, givenCount = 0, jokers = 0, answered = 0, done = steps.length === 0;
  let lastRow = -1;                                 /* ligne de la dernière case visée (retenues actives) */
  const asked = steps.filter(s => s.ask).length;

  /* ligne visée par la prochaine question à partir de l'étape i (case de l'étape ask suivante) */
  const nextTargetRow = new Array(steps.length + 1).fill(-1);
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    nextTargetRow[i] = s.ask && s.cells && s.cells.length ? s.cells[0].r : nextTargetRow[i + 1];
  }
  const quotient = grid.cells.filter(c => c.role === 'quotient' && !c.pos).sort((a, b) => a.c - b.c).map(cellKey);
  const isPotence = grid.cells.some(c => c.ch === '├');   /* potence : pas de bande de colonne, les cases en jeu suffisent */

  function apply(step, i) {
    for (const c of step.cells || []) {
      const k = cellKey(c);
      visible.add(k);
      if (step.type === 'carry' || (cellByKey.get(k) && cellByKey.get(k).role === 'carry')) carryRow.set(k, nextTargetRow[i + 1]);
    }
    for (const c of step.strike || []) struck.add(cellKey(c));
    if (step.type === 'count') {
      const n = Math.max(0, Math.min(quotient.length, parseInt(step.expect, 10) || 0));
      for (const k of quotient.slice(0, n)) slots.add(k);
    }
  }
  function enter() {                               /* une nouvelle question devient l'étape en cours */
    tries = 0;
    if (done) return;
    const s = steps[index];
    if (s.cells && s.cells.length) lastRow = s.cells[0].r;
    if (assist) hintedSteps.add(index);
  }
  function runAutos() {
    const played = [];
    while (index < steps.length && !steps[index].ask) {
      apply(steps[index], index);
      played.push(steps[index]);
      index++;
    }
    done = index >= steps.length;
    enter();
    return played;
  }
  let started = false;
  function start() {
    if (started) return { autos: [], done };
    started = true;
    return { autos: runAutos(), done };
  }

  const run = {
    item, steps, grid,
    visible, struck, given, slots,
    get index() { return index; },
    get done() { return done; },
    get current() { return done ? null : steps[index] || null; },
    get tries() { return tries; },
    get hintShown() { return !done && hintedSteps.has(index); },
    get stats() { return { errors, given: givenCount, jokers, asked, answered }; },
    cell: k => cellByKey.get(k) || null,
    start,
    answer(d) {
      if (!started) start();
      const step = run.current;
      if (!step || !step.ask) return { result: 'ignored', step: null, autos: [], done };
      const digit = String(d).trim();
      if (!/^\d$/.test(digit)) return { result: 'ignored', step, autos: [], done };
      const i = index;
      if (digit === String(step.expect)) {
        const t = tries + 1;
        apply(step, i);
        answered++;
        index++;
        const autos = runAutos();
        return { result: 'right', step, tries: t, autos, done };
      }
      errors++;
      if (tries === 0) {
        tries = 1;
        hintedSteps.add(i);
        return { result: 'retry', step, tries: 1, autos: [], done };
      }
      /* 2e erreur : le chiffre attendu est posé (montré comme « donné ») et on continue */
      givenCount++;
      apply(step, i);
      for (const c of step.cells || []) given.add(cellKey(c));
      index++;
      const autos = runAutos();
      return { result: 'given', step, tries: 2, autos, done };
    },
    joker() {
      if (!started) start();
      if (done) return null;
      const step = steps[index];
      if (hintedSteps.has(index)) return { step, already: true };
      hintedSteps.add(index);
      jokers++;
      return { step, already: false };
    },
    /* surlignage de l'étape en cours : case attendue (pulse), cases en jeu, colonne courante (bande ambre) */
    view() {
      if (done) return { target: null, focus: [], band: null, step: null };
      const step = steps[index];
      const cells = step.cells || [];
      const target = step.ask && cells.length ? cellKey(cells[0]) : null;
      const focus = [...new Set((step.focus || []).map(cellKey))].filter(k => k !== target);
      let band = null;
      if (target && cells.length && !isPotence) {
        const c = cells[0].c;
        if ((step.focus || []).every(f => f.c === c)) band = c;
      }
      return { target, focus, band, step };
    },
    /* retenue d'une ligne de calcul terminée (multiplication : retenues d'un produit partiel fini) */
    isStale(k) {
      if (!carryRow.has(k) || !visible.has(k)) return false;
      const row = carryRow.get(k);
      return row >= 0 && lastRow >= 0 && row !== lastRow;
    },
    outcome(ms) {
      return {
        correct: givenCount === 0,
        hinted: !!assist || jokers > 0 || errors > 0,
        ms: Math.max(0, Math.round(Number(ms) || 0)),
        tries: errors > 0 ? 2 : 1
      };
    }
  };
  return run;
}

/* ---------- textes de la bulle ----------
   Commentaire après une réponse ou des étapes automatiques : les « say » joués, au plus les deux derniers
   (le plus récent est le plus utile : retenue qui monte, virgule, chiffre abaissé…). */
export function sayText(steps, max = 2) {
  const says = (steps || []).map(s => (s && s.say ? String(s.say).trim() : '')).filter(Boolean);
  return says.slice(-Math.max(1, max)).join(' ');
}

/* clé physique (clavier) → chiffre, ou null */
export function digitOfKey(k) {
  if (typeof k !== 'string') return null;
  if (/^\d$/.test(k)) return k;
  const m = /^(?:Numpad|Digit)(\d)$/.exec(k);
  return m ? m[1] : null;
}

/* ---------- répondre à voix haute (v2.3, js/ui/voice-answer.js) ----------
   Le juge des tables (juste dès qu'il est entendu, autre nombre stable 1,5 s = essai faux, « un » jamais faux) entend
   la phrase ; l'atelier décide (onNumber). Chaque question attend UN chiffre : l'enfant dit le chiffre de la case
   (« sept », « deux fois », « il reste trois », « huit, je retiens un » : la retenue s'envole toute seule, il n'a pas à
   la dire). Mesuré (Vosk, grammaire des tables, voix Piper adulte et enfant) : « retiens » est entendu « vingt-et-un »
   ou « vingt », « chiffres » « six », « il y va deux fois » « vingt-deux fois », un « cinq » « cent ». D'où :
   - jamais faux : les nombres de la question et de l'opération (l'enfant relit : « 8 + 6… »), le chiffre et la
     retenue de la question précédente, « six » à « combien de chiffres ? » (sauf si c'est la réponse), « un » ;
   - un nombre de deux chiffres ou plus n'est JAMAIS un essai faux (une case = un chiffre) : le total juste de la
     colonne (« quinze ») est salué, la question reste posée (voiceTotalNote), les autres restent affichés dans 👂 ;
   - débordement : la fin d'une phrase arrive sur la question suivante (resetTranscript garde la suite). Entendue
     moins de VOICE_BLEED_MS après la réponse précédente, elle est oubliée si elle vaut la retenue annoncée ou un
     nombre de deux chiffres ; moins de VOICE_REPEAT_MS après, si elle répète le chiffre précédent (« cinq… cinq »).
   voiceTarget(step, { item, prev }) → { answer, ignore, total, carry, voice } ; prev = { expect, carry } de la
     question précédente (null au début d'une opération).
   voiceVerdict(valeur, juste, { target, last, now }) → 'right' (le chiffre attendu) | 'digit' (un autre chiffre :
     essai faux, comme au doigt) | 'total' (total juste de la colonne) | 'other' (autre nombre : rien) | 'drop'
     (débordement : oublié) ; last = { at, expect, carry } de la dernière réponse (performance.now()). */
export const VOICE_BLEED_MS = 2000;
export const VOICE_REPEAT_MS = 1000;
const COUNT_HEARD_SIX = 6;                      /* « chiffres » entendu « six » (mesuré, voix d'enfant) */

/* v2.3 : mots que l'enfant dit autour du chiffre, ajoutés à la grammaire du micro (js/ui/voice-answer.js, number({ words })) :
   sans eux, Vosk changeait « retiens » en « vingt-et-un » et « chiffres » en « six » (mesuré au banc) ; tous dans le lexique */
export const VOICE_WORDS = Object.freeze(['retiens', 'retenue', 'chiffre', 'chiffres', 'rien', 'reste', 'case', 'unités', 'dizaines', 'centaines']);

/* nombres écrits dans un texte (« 9 456 ÷ 7 », « Dans 52, combien de fois 9 ? », « 4,56 € ») */
export function textNumbers(text) {
  return (String(text || '').match(/\d+(?:[\u00A0\u202F]\d{3})*(?:,\d+)?/g) || [])
    .map(x => Number(x.replace(/[\u00A0\u202F]/g, '').replace(',', '.'))).filter(Number.isFinite);
}
export function voiceTarget(step, { item = null, prev = null } = {}) {
  const none = { answer: null, ignore: [], total: null, carry: null, voice: false };
  if (!step || !step.ask || !/^\d$/.test(String(step.expect))) return none;
  const answer = Number(step.expect);
  const ign = new Set([...textNumbers(step.prompt), ...textNumbers(item && item.prompt)]);
  if (prev) for (const v of [prev.expect, prev.carry]) if (Number.isFinite(v)) ign.add(v);
  if (step.type === 'count') ign.add(COUNT_HEARD_SIX);
  ign.delete(answer);
  /* « 5 + 9 = 14 : je pose 4 et je retiens 1. » ; « 7 × 7 = 49, et 49 + 6 = 55 : je pose 5 et je retiens 5. » */
  const say = String(step.say || '');
  const t = /=\s*(\d+)\s*:\s*je pose/.exec(say), c = /je retiens\s+(\d+)/.exec(say);
  const total = t && Number(t[1]) >= 10 ? Number(t[1]) : null;
  return { answer, ignore: [...ign].sort((a, b) => a - b), total, carry: c ? Number(c[1]) : null, voice: true };
}
export function voiceVerdict(value, right, { target = null, last = null, now = 0 } = {}) {
  const v = Number(value);
  if (value === null || value === undefined || !Number.isFinite(v)) return 'drop';
  /* instant où le nombre a été entendu : le juge confirme une bonne réponse 0,35 s après, un essai faux 1,5 s après */
  const heardAt = now - (right ? CONFIRM_MS : STABLE_MS);
  if (last && Number.isFinite(last.at)) {
    const since = heardAt - last.at;
    if (since < VOICE_BLEED_MS && (v >= 10 || v === last.carry)) return 'drop';
    if (since < VOICE_REPEAT_MS && v === last.expect) return 'drop';
  }
  if (right) return 'right';
  if (Number.isInteger(v) && v >= 0 && v <= 9) return 'digit';
  if (target && target.total !== null && v === target.total) return 'total';
  return 'other';
}
/* « Quinze, c'est juste ! Mais dans la case, on n'écrit qu'un chiffre. » (la question reste affichée dessous) */
export function voiceTotalNote(v) {
  const w = heardLabel(v);
  return frTypo((w ? w[0].toUpperCase() + w.slice(1) : String(v)) + ', c’est juste ! Mais dans la case, on n’écrit qu’un chiffre.');   /* frTypo : espaces fines */
}
