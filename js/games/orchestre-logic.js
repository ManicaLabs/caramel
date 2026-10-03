/* ============ LE CHEF D’ORCHESTRE : logique pure (aucun DOM) ============
   Importable par Node (tests/orchestre.test.mjs). Utilisée par js/games/orchestre.js.
   - tempo : 72 bpm au départ, + 4 par réussite de suite (série du premier coup), plafond 112 ;
   - phrase : découpe de data.sentence (avant / trou / après, ou verbe souligné pour 'temps') en morceaux
     affichables, sujet repéré grâce à data.subjectSpan ;
   - choix et tuiles : texte posé dans le trou pour chaque choix (forme, terminaison, sujet), largeur du trou ;
   - consigne : étiquette du temps (« au futur ») isolée dans le texte de la consigne ;
   - mélodie : partition pentatonique tirée au sort (do ré mi sol la, tient sur la portée), position des notes
     sur la portée en clé de sol, plan de la mélodie rejouée en fin de manche ;
   - battue du chef (4 temps) et balancement des musiciens. */

import { TENSE_AT } from '../content/fr/verbs.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- tempo ---------- */
export const TEMPO = Object.freeze({ start: 72, step: 4, max: 112, beatsPerBar: 4 });
/* série = nombre de réussites du premier coup d'affilée (feedback.streak de la manche) */
export function tempoFor(streak) {
  const s = Math.max(0, Math.floor(+streak) || 0);
  return Math.min(TEMPO.max, TEMPO.start + TEMPO.step * s);
}
/* durée d'un temps en millisecondes */
export function beatMs(bpm) { return 60000 / clamp(+bpm || TEMPO.start, 20, 300); }

/* ---------- phrase ---------- */
/* texte posé dans le trou pour un choix : terminaison sans tiret, sujet avec sa majuscule éventuelle */
export function fillFor(item, choice) {
  if (!item || !choice) return '';
  if (item.kind === 'temps') return '';
  if (item.kind === 'sujet') return String(choice.label ?? choice.value ?? '');
  return String(choice.value ?? '');
}
export function isRight(item, value) {
  return !!item && String(value) === String(item.answer);
}
/* choix prêts pour kit.choiceGrid : { label, value, fill } */
export function choiceModel(item) {
  const list = item && Array.isArray(item.choices) ? item.choices : [];
  return list.map(c => ({ label: String(c.label ?? c.value), value: c.value, fill: fillFor(item, c) }));
}
/* longueur (en caractères) du plus long texte possible dans le trou : le trou est dimensionné sur elle,
   jamais sur la bonne réponse (sa longueur donnerait un indice) */
export function slotLen(item) {
  const fills = choiceModel(item).map(c => c.fill.length);
  return Math.max(2, ...fills, 0);
}
/* texte attendu dans le trou (bonne réponse telle qu'elle s'écrit dans la phrase) */
function answerFill(item) {
  const c = (item.choices || []).find(x => isRight(item, x.value));
  return c ? fillFor(item, c) : String(item.answer ?? '');
}

/* span [début, fin[ valide dans le texte, sinon null */
function validSpan(span, len) {
  if (!Array.isArray(span) || span.length !== 2) return null;
  const a = Math.floor(+span[0]), b = Math.floor(+span[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b > len || b <= a) return null;
  return [a, b];
}

/* modèle de la phrase :
   { mode, parts, full, slotText, stem }
     mode = 'slot' (forme, accord, participe) | 'ending' (terminaison : radical + tuile) |
            'subject' (sujet : le trou est le sujet) | 'underline' (temps : verbe souligné, pas de trou)
     parts = [{ kind: 'text', text, subject } | { kind: 'slot', stem, subject } | { kind: 'verb', text, subject }]
     full = phrase complète (trou rempli par la bonne réponse) ; la concaténation des morceaux (trou rempli)
     redonne exactement full. */
export function sentenceModel(item) {
  const d = (item && item.data) || {};
  const s = d.sentence || {};
  const before = String(s.before ?? ''), after = String(s.after ?? '');
  let mode = 'slot', stem = '', slotText = '';
  if (item && item.kind === 'temps') {
    mode = 'underline';
    const text = typeof s.text === 'string' ? s.text : before + String(d.form ?? '') + after;
    const u = validSpan(s.underline, text.length);
    const a = u ? u[0] : before.length;
    const b = u ? u[1] : before.length + String(d.form ?? '').length;
    return split(text, a, b, 'verb', d.subjectSpan, { mode, stem, slotText: text.slice(a, b) });
  }
  if (item && item.kind === 'terminaison') { mode = 'ending'; stem = String(d.stem ?? ''); }
  else if (item && item.kind === 'sujet') mode = 'subject';
  slotText = answerFill(item || {});
  const full = before + stem + slotText + after;
  return split(full, before.length, before.length + stem.length + slotText.length, 'slot', d.subjectSpan, { mode, stem, slotText });
}
/* découpe full en morceaux autour de [a, b[ (trou ou verbe) et du sujet */
function split(full, a, b, midKind, span, extra) {
  const sp = validSpan(span, full.length);
  const cuts = [...new Set([0, a, b, full.length, ...(sp || [])])].filter(x => x >= 0 && x <= full.length).sort((x, y) => x - y);
  const parts = [];
  let mid = null;
  for (let k = 0; k < cuts.length - 1; k++) {
    const x = cuts[k], y = cuts[k + 1];
    if (y <= x) continue;
    const subject = !!sp && x >= sp[0] && y <= sp[1];
    if (x >= a && y <= b) {
      if (!mid) {
        mid = midKind === 'slot' ? { kind: 'slot', stem: extra.stem, subject: false } : { kind: 'verb', text: full.slice(a, b), subject: false };
        parts.push(mid);
      }
      if (subject || (sp && sp[0] < b && sp[1] > a)) mid.subject = true;
      continue;
    }
    const prev = parts[parts.length - 1];
    if (prev && prev.kind === 'text' && prev.subject === subject) prev.text += full.slice(x, y);
    else parts.push({ kind: 'text', text: full.slice(x, y), subject });
  }
  if (!mid) {                                /* trou vide (jamais en pratique) : inséré à sa place */
    mid = midKind === 'slot' ? { kind: 'slot', stem: extra.stem, subject: false } : { kind: 'verb', text: '', subject: false };
    let pos = 0, at = parts.length;
    for (let k = 0; k < parts.length; k++) {
      if (pos >= a) { at = k; break; }
      const len = parts[k].text.length;
      if (pos + len > a) {                   /* coupe le morceau de texte qui chevauche la position du trou */
        const p = parts[k], cut = a - pos;
        parts.splice(k, 1, { ...p, text: p.text.slice(0, cut) }, { ...p, text: p.text.slice(cut) });
        at = k + 1;
        break;
      }
      pos += len;
    }
    parts.splice(at, 0, mid);
  }
  return { mode: extra.mode, parts, full, slotText: extra.slotText, stem: extra.stem };
}
/* phrase reconstituée avec un texte quelconque dans le trou (tests, lecteurs d'écran) */
export function sentenceText(model, fill) {
  return model.parts.map(p => (p.kind === 'text' ? p.text : p.kind === 'verb' ? p.text : (p.stem || '') + (fill ?? ''))).join('');
}

/* ---------- consigne ---------- */
/* consigne découpée autour de l'étiquette du temps (« au futur ») : [{ text } | { tense }] */
export function promptParts(item) {
  const prompt = String((item && item.prompt) || '');
  const t = item && item.data && item.data.tense;
  const label = t && TENSE_AT[t];
  if (!label || item.kind === 'temps') return prompt ? [{ text: prompt }] : [];
  const i = prompt.indexOf(label);
  if (i < 0) return prompt ? [{ text: prompt }] : [];
  const out = [];
  if (i > 0) out.push({ text: prompt.slice(0, i) });
  out.push({ tense: label });
  if (i + label.length < prompt.length) out.push({ text: prompt.slice(i + label.length) });
  return out;
}
/* étiquettes sous la consigne : infinitif (forme, terminaison, participe) et temps quand la consigne
   ne le dit pas déjà (accord, participe) ; jamais pour 'temps' (ce serait la réponse) ni 'sujet' */
export function tagsFor(item) {
  const d = (item && item.data) || {};
  const k = item && item.kind;
  const tense = d.tense && TENSE_AT[d.tense] ? TENSE_AT[d.tense] : null;
  const inPrompt = !!tense && promptParts(item).some(p => p.tense);
  const verb = ['forme', 'terminaison', 'participe'].includes(k) && d.verb ? String(d.verb) : null;
  const showTense = ['forme', 'terminaison', 'accord', 'participe'].includes(k) && !inPrompt ? tense : null;
  return { verb, tense: showTense };
}
/* phrase modèle (passage au pluriel) */
export function modelLine(item) {
  const m = item && item.data && item.data.model;
  return typeof m === 'string' && m ? m : null;
}

/* ce qui s'allume sur le temps fort :
   'subject' (le sujet, puis le trou au temps suivant : « sujet → terminaison »),
   'slot' (le trou : sujet à trouver, ou accord tant qu'aucun indice n'a été donné — repérer le sujet est
   justement l'exercice), 'verb' (temps : le verbe souligné) */
export function emphasisTarget(item, hinted = false) {
  const k = item && item.kind;
  if (k === 'sujet') return 'slot';
  if (k === 'temps') return 'verb';
  if (k === 'accord' && !hinted) return 'slot';
  return 'subject';
}

/* ---------- mélodie ---------- */
/* notes de la partition : pas pentatoniques d'audio.pentatonic (0 do5, 1 ré5, 2 mi5, 3 sol5, 4 la5) */
export const SCORE_MAX = 4;
const STABLE = [0, 2, 3];                    /* do, mi, sol : notes de repos en fin de mesure */
const nearestStable = s => STABLE.reduce((b, x) => (Math.abs(x - s) < Math.abs(b - s) ? x : b), STABLE[0]);
/* partition de n notes : mouvements conjoints surtout, quelques sauts, jamais trois fois la même note,
   chaque fin de mesure (4e note) sur do, mi ou sol ; déterministe pour un même rng */
export function makeScore(rng, n = 12) {
  const next = rng && typeof rng.next === 'function' ? () => rng.next() : typeof rng === 'function' ? rng : Math.random;
  const N = clamp(Math.floor(+n) || 0, 0, 64);
  const MOVES = [-2, -1, -1, 0, 1, 1, 2];
  const out = [];
  let cur = STABLE[Math.floor(next() * STABLE.length) % STABLE.length];
  for (let i = 0; i < N; i++) {
    if (i > 0) {
      let s = cur;
      for (let k = 0; k < 12; k++) {
        const d = MOVES[Math.floor(next() * MOVES.length) % MOVES.length];
        const t = cur + d;
        if (t < 0 || t > SCORE_MAX) continue;
        if (d === 0 && out.length >= 2 && out[out.length - 2] === cur) continue;
        s = t;
        break;
      }
      if (s === cur && out.length >= 2 && out[out.length - 2] === cur) s = cur > 0 ? cur - 1 : cur + 1;
      cur = s;
    }
    if (i % 4 === 3 && !STABLE.includes(cur)) {
      const st = nearestStable(cur);
      cur = (out.length >= 2 && out[out.length - 1] === st && out[out.length - 2] === st) ? (st === 0 ? 2 : 0) : st;
    }
    out.push(cur);
  }
  return out;
}
/* petite phrase jouée par les musiciens après une bonne réponse : les dernières notes gagnées */
export function phraseOf(notes, k = 4) {
  const list = Array.isArray(notes) ? notes : [];
  return list.slice(Math.max(0, list.length - k));
}

/* portée en clé de sol : position 0 = ligne du bas (mi4), 1 = interligne (fa4)… 8 = ligne du haut (fa5) */
const DEGREE = [0, 1, 2, 4, 5];              /* do ré mi sol la → degrés de la gamme de do */
export function staffPos(step) {
  const s = clamp(Math.floor(+step) || 0, 0, 14);
  return 5 + 7 * Math.floor(s / 5) + DEGREE[s % 5];  /* do5 = 3e interligne (position 5) */
}
/* lignes supplémentaires nécessaires (positions paires hors de la portée) */
export function ledgers(pos) {
  const out = [];
  for (let p = 10; p <= pos; p += 2) out.push(p);
  for (let p = -2; p >= pos; p -= 2) out.push(p);
  return out;
}
/* hampe vers le haut sous la ligne du milieu (si4, position 4), vers le bas sinon */
export const stemUp = pos => pos < 4;

/* mélodie rejouée en fin de manche : une note par croche pointée environ, au tempo atteint (borné),
   un temps fort toutes les 4 notes, puis l'accord final (do mi sol) → { notes: [{ at, step, idx, strong }], gap, chordAt, end } */
export function finalePlan(notes, bpm = TEMPO.start) {
  const list = Array.isArray(notes) ? notes : [];
  const gap = Math.round(clamp(beatMs(clamp(+bpm || TEMPO.start, TEMPO.start, TEMPO.max)) * 0.55, 300, 460));
  const out = list.map((step, idx) => ({ at: idx * gap, step, idx, strong: idx % 4 === 0 }));
  const chordAt = list.length ? list.length * gap + Math.round(gap * 0.6) : 0;
  return { notes: out, gap, chordAt, chord: [0, 2, 3], end: chordAt + 1400 };
}

/* ---------- gestes ---------- */
/* battue à 4 temps du chef : angle de la baguette (degrés, 0 = horizontale vers les musiciens, négatif = vers le haut) */
export const BATON = Object.freeze([38, -6, 22, -46]);
export function batonAngle(pos) { return BATON[((Math.floor(+pos) || 0) % 4 + 4) % 4]; }
/* balancement des musiciens : d'un côté puis de l'autre, extrême atteint sur chaque temps */
export function swayAngle(i, amp = 4) { return ((Math.floor(+i) || 0) % 2 === 0 ? -1 : 1) * amp; }
/* musicien qui joue la note n° idx (lapin, grenouille, renard ; l'ours tient le tambour) */
export const MELODY_PLAYERS = Object.freeze([1, 2, 3]);
export function playerOf(idx) { return MELODY_PLAYERS[((Math.floor(+idx) || 0) % 3 + 3) % 3]; }
