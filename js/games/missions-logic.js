/* ============ LES MISSIONS DU RANCH — logique pure (aucun DOM) ============
   Utilisée par js/games/missions.js, testée par tests/missions.test.mjs (confrontée au vrai générateur
   js/content/maths/problemes.js).
   - énoncé : phrases en morceaux (texte / nombre mis en valeur), texte dit à voix haute ;
   - réponse : mode (6 choix ou pavé), valeur attendue, contrôle d'une saisie ou d'un choix, résultat intermédiaire
     (« jamais faux » : Bien ! Et maintenant ?) ;
   - voix : ce que le micro écoute (nombres de l'énoncé jamais faux), verdict d'un nombre entendu ;
   - aide : schéma en barres (dès le CE1), géométrie du dessin SVG (rectangles, accolades, textes), schéma complété ;
   - explication en quatre phases du programme : Comprendre → Modéliser → Calculer → Répondre. */

import { fmtNum } from '../core/util.js';

export const NBSP = '\u00A0';
export const NNBSP = '\u202F';
export const MAX_LEN = 10;                      /* pavé : 999 999 999 + marge */
export const VOICE_MAX = 99999;                 /* au-delà, on répond avec le doigt (comme Pommes express) */
export const INTRO = 'Je pars en mission au ranch ! Écoute bien, puis aide-moi à trouver la réponse.';
export const SCHEMA_SAY = 'Regarde le dessin : le point d’interrogation, c’est ce qu’on cherche.';
export const STEP_TITLES = Object.freeze([
  { key: 'comprendre', icon: '🔎', title: 'Comprendre' },
  { key: 'modeliser', icon: '✏️', title: 'Modéliser' },
  { key: 'calculer', icon: '🧮', title: 'Calculer' },
  { key: 'repondre', icon: '💬', title: 'Répondre' }
]);

const same = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

/* ---------- énoncé ---------- */
/* nombre écrit à la française, suivi éventuellement de son unité collée (« 12 € », « 14 h 05 », « 163 cm ») */
const NUM_RE = /(\d+(?:\u202F\d{3})*(?:,\d+)?(?:\u00A0h\u00A0\d{2})?(?:\u00A0(?:€|kg|cm|h))?)/gu;
/* une phrase → morceaux { k: 'txt' | 'num', t } (les nombres sont mis en valeur à l'écran) */
export function chunks(text) {
  const s = String(text || '');
  const out = [];
  let last = 0;
  for (const m of s.matchAll(NUM_RE)) {
    if (m.index > last) out.push({ k: 'txt', t: s.slice(last, m.index) });
    out.push({ k: 'num', t: m[0] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ k: 'txt', t: s.slice(last) });
  return out;
}
/* phrases dites l'une après l'autre (la phrase dite se surligne), puis la question */
export function readLines(item) {
  const d = item && item.data ? item.data : {};
  return [...(d.sentences || []), d.question].filter(Boolean);
}
/* tout l'énoncé (🔊 de l'en-tête, lecteurs d'écran) */
export const fullText = item => readLines(item).join(' ');

/* ---------- mode de réponse ----------
   6 choix (format Repères) quand le générateur le demande (CP-CE1, problèmes à étapes jusqu'au CE2), et pour un
   problème donné en « coup de pouce » (deux échecs de suite : item.assist) ; sinon le pavé */
export function answerMode(item) {
  const d = item && item.data ? item.data : {};
  if (d.mode === 'choices') return 'choices';
  if (item && item.assist && Array.isArray(d.choices) && d.choices.length === 6) return 'choices';
  return 'keypad';
}
export function choicesOf(item) {
  const d = item && item.data ? item.data : {};
  const list = Array.isArray(item && item.choices) && item.choices.length ? item.choices : d.choices || [];
  return list.map(c => ({ label: c.label, value: c.value }));
}
/* → { value, decimal, decimals, text (affiché), raw (tapé), unit, maxLen } */
export function answerInfo(item) {
  const value = Number(item && item.answer);
  const decimals = item && item.data && item.data.decimals ? 2 : 0;
  const decimal = decimals > 0 || !Number.isInteger(value);
  const text = decimal ? fmtNum(value, 2) : fmtNum(value);
  const raw = text.replace(/[\s\u00A0\u202F]/g, '');
  return { value, decimal, decimals: decimal ? 2 : 0, text, raw, unit: String(item && item.unit || ''), maxLen: Math.max(MAX_LEN, raw.length + 1) };
}
/* résultat intermédiaire d'un problème à étapes (jamais compté faux) → { v, txt } | null */
export function stepOf(item, v) {
  const inter = item && item.data && Array.isArray(item.data.inter) ? item.data.inter : [];
  return inter.find(x => same(Number(v), Number(x.v))) || null;
}
/* chaîne tapée (« 8,2 », « 1 000 ») → { valid, ok, value, step } */
export function checkTyped(str, item) {
  const s = String(str ?? '').trim().replace(/[\s\u00A0\u202F]/g, '').replace(',', '.');
  if (!/^\d+(\.\d*)?$/.test(s)) return { valid: false, ok: false, value: NaN, step: null };
  const v = Number(s.replace(/\.$/, ''));
  const ok = same(v, Number(item && item.answer));
  return { valid: Number.isFinite(v), ok, value: v, step: ok ? null : stepOf(item, v) };
}
export function checkChoice(value, item) {
  const v = Number(value);
  const ok = same(v, Number(item && item.answer));
  return { ok, value: v, step: ok ? null : stepOf(item, v) };
}
/* « Bien ! 18, c’est le nombre de poules après l’arrivée. Et maintenant ? » */
export function stepMessage(item, step) {
  if (!step) return '';
  const n = item && item.data && item.data.decimals ? fmtNum(Number(step.v), 2) : fmtNum(Number(step.v));
  return 'Bien ! ' + n + ', ' + step.txt + '. Et maintenant ?';
}
/* ligne d'aide au repos, au-dessus de la réponse */
export function idleText(mode, mic = false) {
  if (mode === 'choices') return mic ? 'Dis ou touche la bonne réponse.' : 'Touche la bonne réponse.';
  return mic ? 'Calcule, puis dis ou tape ta réponse.' : 'Calcule, puis tape ta réponse.';
}

/* ---------- voix ---------- */
/* ce que le micro écoute : un nombre ; jamais faux : les nombres de l'énoncé (l'enfant relit), la donnée inutile, les
   nombres dits en mots (« le quart »), la réponse d'avant ; voix coupée pour les réponses à virgule ou trop grandes */
export function voicePlan(item, { prev = null } = {}) {
  const info = answerInfo(item);
  const d = item && item.data ? item.data : {};
  const ignore = [...(d.numbers || []), ...(d.useless !== null && d.useless !== undefined ? [d.useless] : []), ...(d.consts || []), prev]
    .filter(v => typeof v === 'number' && Number.isFinite(v) && !same(v, info.value));
  const voice = !info.decimal && Number.isInteger(info.value) && info.value >= 0 && info.value <= VOICE_MAX;
  return { answer: info.value, ignore: [...new Set(ignore)], voice, touch: !voice };
}
/* nombre entendu → 'right' | 'step' (résultat intermédiaire) | 'wrong' | 'skip' (rien : un nombre de l'énoncé, ou aux
   6 choix un nombre qui n'est pas proposé) */
export function voiceVerdict(v, item, mode, plan = null) {
  const x = Number(v);
  if (!Number.isFinite(x)) return 'skip';
  if (same(x, Number(item && item.answer))) return 'right';
  if (stepOf(item, x)) return 'step';
  const p = plan || voicePlan(item);
  if (!p.voice) return 'skip';                    /* réponse à virgule ou trop grande : on répond avec le doigt */
  if (p.ignore.some(y => same(y, x))) return 'skip';
  if (mode === 'choices') return choicesOf(item).some(c => same(Number(c.value), x)) ? 'wrong' : 'skip';
  return 'wrong';
}

/* ---------- aide : schéma en barres (programme : dès le CE1, jamais imposé) ---------- */
export function schemaAllowed(classe, item) {
  const s = item && item.data && item.data.schema;
  return !!s && classe !== 'CP';
}
/* schéma complété (explication) : chaque « ? » prend sa valeur, marqué found */
export function solvedSchema(schema, item) {
  if (!schema) return null;
  const money = String(item && item.unit) === '€' && item.data && item.data.decimals;
  const fmt = v => (money ? fmtNum(Number(v), 2) : fmtNum(Number(v)));
  const fix = o => (o && o.q ? { ...o, t: fmt(o.v), q: false, soft: false, found: true } : o);
  const out = { ...schema };
  if (schema.brace) out.brace = fix(schema.brace);
  if (schema.rows) out.rows = schema.rows.map(r => ({ ...r, segs: r.segs.map(fix), total: fix(r.total), n: r.n && r.n.q ? { ...r.n, t: fmtNum(r.n.v), q: false, found: true } : r.n }));
  return out;
}

/* géométrie du dessin (pixels) : W = largeur disponible ; → { w, h, items }
   items : { type: 'seg', x, y, w, h, t, q, found, tone, same, diff, dots, soft } · { type: 'label', x, y, t, w }
           { type: 'brace', x1, x2, y, t, q, found, soft } (accolade au-dessus d'une barre ; soft : « ? » pâle d'une étape) · { type: 'sub', x, y, t }
           { type: 'vbrace', x, y1, y2, t, q } (accolade à droite de toutes les barres) · grille : { type: 'cell', … } */
export const SCHEMA_FONT = 16;
const CH = 0.56;                                /* largeur moyenne d'un caractère (Fredoka) en fraction du corps */
const textW = (t, fs = SCHEMA_FONT) => String(t || '').length * fs * CH;
export function schemaLayout(schema, W, { font = SCHEMA_FONT } = {}) {
  W = Math.max(200, Math.round(+W || 0));
  const items = [];
  if (!schema) return { w: W, h: 0, items };
  if (schema.grid) return gridLayout(schema.grid, W, font);
  const rows = schema.rows || [];
  const pad = 4, barH = Math.round(font * 2.1), braceH = Math.round(font * 1.55), subH = Math.round(font * 0.95), gap = Math.round(font * 0.6);
  /* colonne des noms (Noisette, poney…) et des « 4 × » */
  const labels = rows.map(r => (r.n ? r.n.t + ' ×' : r.label || ''));
  const hasLabel = labels.some(Boolean);
  const labelW = hasLabel ? Math.min(Math.round(W * 0.3), Math.max(...labels.map(t => textW(t, font * 0.85))) + 10) : 0;
  const vb = schema.braceAll && schema.brace;
  const rightW = vb ? Math.max(44, textW(vb.t, font) + 22) : 6;
  const x0 = pad + labelW, bw = W - x0 - rightW - pad;
  const minSeg = Math.max(30, Math.round(font * 2));
  const dotW = Math.round(font * 1.8);
  const sumOf = r => r.segs.reduce((a, g) => a + (g.dots ? 0 : g.v), 0);
  const fixedOf = r => r.segs.filter(g => g.dots).length * dotW;
  const maxSum = Math.max(1e-9, ...rows.map(sumOf));
  const maxFixed = Math.max(0, ...rows.map(fixedOf));
  let scale = Math.max(0, (bw - maxFixed) / maxSum);
  let y = pad;
  const yRows = [];
  rows.forEach((r, i) => {
    if (r.total && !vb) {
      y += braceH;
    }
    /* largeurs : proportionnelles, avec un minimum lisible ; une barre trop longue est resserrée */
    let ws = r.segs.map(g => (g.dots ? dotW : Math.max(minSeg, Math.max(textW(g.t, font) + 10, g.v * scale))));
    const tot = ws.reduce((a, b) => a + b, 0);
    if (tot > bw) ws = ws.map(w => w * bw / tot);
    let x = x0;
    r.segs.forEach((g, k) => {
      items.push({ type: 'seg', x: Math.round(x), y, w: Math.round(ws[k]), h: barH, t: g.t, q: !!g.q, found: !!g.found,
        tone: g.tone || 'a', same: !!g.same, diff: !!g.diff, dots: !!g.dots, soft: !!g.soft });
      /* légende sous la case : elle peut déborder un peu d'une case étroite (« par terre ») */
      if (g.sub) items.push({ type: 'sub', x: Math.round(x + ws[k] / 2), y: y + barH + subH - 3, t: g.sub, w: Math.round(Math.max(ws[k], Math.min(80, ws[k] * 2))) });
      x += ws[k];
    });
    const rowEnd = x;
    if (labels[i]) items.push({ type: 'label', x: pad, y: y + barH / 2, t: labels[i], w: labelW - 8, q: !!(r.n && r.n.q), found: !!(r.n && r.n.found) });
    if (r.total && !vb) items.push({ type: 'brace', x1: x0, x2: Math.round(rowEnd), y: y - 4, t: r.total.t, q: !!r.total.q, found: !!r.total.found, soft: !!r.total.soft });
    yRows.push([y, y + barH]);
    y += barH + (r.segs.some(g => g.sub) ? subH : 0) + gap;
  });
  if (vb) items.push({ type: 'vbrace', x: W - rightW + 4, y1: yRows[0][0], y2: yRows[yRows.length - 1][1], t: vb.t, q: !!vb.q, found: !!vb.found });
  return { w: W, h: Math.round(y - gap + pad), items };
}
function gridLayout(g, W, font) {
  const items = [];
  const n = Math.min(g.n, 6), m = Math.min(g.m, 6);
  const head = Math.round(font * 1.4);
  const cell = Math.max(18, Math.min(34, Math.floor((W - 90) / m)));
  const x0 = Math.round((W - m * cell) / 2), y0 = head + 6;
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) items.push({ type: 'cell', x: x0 + j * cell, y: y0 + i * cell, w: cell - 4, h: cell - 4 });
  items.push({ type: 'label', x: x0, y: head / 2 + 2, t: fmtNum(g.m) + ' ' + g.cols, w: W - x0 - 4, top: true });
  items.push({ type: 'label', x: 4, y: y0 + (n * cell) / 2, t: fmtNum(g.n) + ' ' + g.rows, w: x0 - 10, vertical: true });
  if (g.times) items.push({ type: 'sub', x: Math.round(W / 2), y: y0 + n * cell + font, t: '× ' + fmtNum(g.times), w: W });
  return { w: W, h: y0 + n * cell + (g.times ? font * 1.6 : 6), items, grid: true };
}

/* ---------- explication : les quatre phases ---------- */
export function explainSteps(item) {
  const s = item && item.data && item.data.steps ? item.data.steps : {};
  return STEP_TITLES.map(x => ({ ...x, text: x.key === 'calculer' ? (s.calculer || []).join('\n') : String(s[x.key] || '') }));
}
/* ce que dit le compagnon pendant l'explication (calcul en mots simples : le compagnon lit « 12 − 5 = 7 ») */
export const explainSpeech = item => explainSteps(item).map(x => x.text.replace(/\n/g, ' ; ')).join(' ');
