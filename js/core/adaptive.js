/* ============ MODÈLE ADAPTATIF « DOUX » (CDC v2 §7) ============
   Module pur. Un θ ∈ [0 ; 3] par profil et par axe (2 = attendu de la classe à cette période).
   - probabilité de réussite logistique p = 1 / (1 + e^(−1,7(θ − b))) ;
   - mise à jour θ ← clamp(θ + K(r − p), 0, 3), K = max(0,08 ; 0,4/√(n + 1)) : prudente au début,
     de plus en plus stable avec les observations ;
   - cible p ≈ 0,8 → b = θ − 0,8 (+ décalage du bloc et du filet de sécurité) ;
   - fluence : θ observé depuis le MCLM (levels.thetaFromMclm), moyenne pondérée.
   Les skills sont { t, n, last, trend, src } ; θ est stocké arrondi à 1e-4 (JSON lisible). */

import { clamp, dayStr, monthStr, slug } from './util.js';
import { AXES } from './axes.js';
import { expectedLevel, thetaFromMclm } from './levels.js';

export const DEFAULT_THETA = 1.5;
/* seuil « automatisé » par défaut en ms (item.autoMs prime) : au-delà, juste = 0,8 au lieu de 1 */
export const SPEED_MS = { 'ma.faits': 3000, 'ma.procedures': 5000 };

const T_MIN = 0, T_MAX = 3;
const EVAL_N = 4;                                   /* poids d'une évaluation importée (CDC §7.2) */
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const r4 = v => Math.round(v * 1e4) / 1e4;

/* ---------- modèle ---------- */
export function prob(theta, b) {
  return 1 / (1 + Math.exp(-1.7 * (theta - b)));
}
export function kFactor(n) {
  return Math.max(0.08, 0.4 / Math.sqrt(Math.max(0, isNum(n) ? n : 0) + 1));
}
/* b visé : p ≈ 0,8 ; adj = décalage (échauffement −0,6, filet de sécurité…) */
export function targetB(theta, adj = 0) {
  return clamp((isNum(theta) ? theta : DEFAULT_THETA) - 0.8 + (isNum(adj) ? adj : 0), T_MIN, T_MAX);
}

/* ---------- skills ---------- */
const defaultSkill = () => ({ t: DEFAULT_THETA, n: 0, last: '', trend: 0, src: 'defaut' });

/* skill d'un axe (objet vivant s'il existe ; sinon défaut NON inséré dans le profil) */
export function skillOf(profile, axis) {
  const s = profile && profile.skills && profile.skills[axis];
  return s && typeof s === 'object' && isNum(s.t) ? s : defaultSkill();
}
/* skill vivant, inséré et complété au besoin (usage interne : avant une écriture) */
function ensureSkill(profile, axis) {
  if (!profile.skills || typeof profile.skills !== 'object') profile.skills = {};
  let s = profile.skills[axis];
  if (!s || typeof s !== 'object' || !isNum(s.t)) s = profile.skills[axis] = defaultSkill();
  s.t = clamp(s.t, T_MIN, T_MAX);
  if (!isNum(s.n) || s.n < 0) s.n = 0;
  if (typeof s.last !== 'string') s.last = '';
  if (!isNum(s.trend)) s.trend = 0;
  if (!s.src) s.src = 'defaut';
  return s;
}

/* ---------- score d'une réponse ----------
   faux → 0 ; juste mais aidé (joker, indice proactif = item.assist, 2e essai) → 0,6 ;
   juste mais lent sur un axe de vitesse → 0,8 ; sinon 1. */
export function scoreR(axis, item, outcome) {
  const o = outcome || {}, it = item || {};
  if (!o.correct) return 0;
  const hinted = !!o.hinted || (isNum(o.tries) && o.tries > 1) || !!it.assist;
  if (hinted) return 0.6;
  const limit = isNum(it.autoMs) && it.autoMs > 0 ? it.autoMs : SPEED_MS[axis || it.axis];
  if (limit && isNum(o.ms) && o.ms > limit) return 0.8;
  return 1;
}

/* θ ← clamp(θ + K(r − p), 0, 3) ; n + 1. b inconnu → item supposé « à niveau » (p = 0,5). */
export function applyResult(profile, axis, b, r, today = dayStr()) {
  const s = ensureSkill(profile, axis);
  const before = s.t;
  const bb = isNum(b) ? clamp(b, T_MIN, T_MAX) : before;
  const rr = isNum(r) ? clamp(r, 0, 1) : 0;
  const after = r4(clamp(before + kFactor(s.n) * (rr - prob(before, bb)), T_MIN, T_MAX));
  s.t = after; s.n += 1; s.last = today;
  return { before, after };
}

/* Fluence : MCLM corrigé de la facilité du texte (−5 % par niveau sous l'attendu, au plus −20 %),
   θ observé = thetaFromMclm ; θ ← θ + w(obs − θ), w = 1 la première fois puis max(0,3 ; 1/(n+1)).
   MCLM absent ou nul (micro muet, course vide) → aucune mise à jour, obs = null. */
export function applyFluence(profile, { mclm, textA, classe, today = dayStr() } = {}) {
  if (!isNum(mclm) || mclm <= 0) {
    const t = skillOf(profile, 'fr.fluence').t;
    return { before: t, after: t, obs: null };
  }
  const s = ensureSkill(profile, 'fr.fluence');
  const cl = classe || profile.classe;
  const before = s.t;
  const ease = isNum(textA) ? clamp(1 - 0.05 * Math.max(0, expectedLevel(cl, today) - textA), 0.8, 1) : 1;
  const obs = thetaFromMclm(mclm * ease, cl, today);
  const w = s.n === 0 ? 1 : Math.max(0.3, 1 / (s.n + 1));
  const after = r4(clamp(before + w * (obs - before), T_MIN, T_MAX));
  s.t = after; s.n += 1; s.last = today;
  return { before, after, obs };
}

/* ---------- import d'une évaluation (CDC §8.5, annexe A) ----------
   evaluation = { src | source, date, classe, fr: { axe: θ | null }, ma: { … }, precision }.
   Chaque valeur numérique → skill { t, n: 4, last, trend: 0, src: 'eval' } ; null → absent (Grand
   check-up en v2.1) ; clés inconnues ignorées (un axe connu rangé dans la mauvaise matière est
   reclassé). L'évaluation rejoint profile.evals en dernière position (= référence du radar) ;
   une évaluation de même source, date et classe est complétée (import français puis maths,
   une photo par matière) au lieu d'être dupliquée. */
export function applyEval(profile, evaluation, today = dayStr()) {
  const ev = evaluation && typeof evaluation === 'object' ? evaluation : {};
  const applied = [], absent = [];
  const vals = { fr: {}, ma: {} };
  for (const group of ['fr', 'ma']) {
    const src = ev[group];
    if (!src || typeof src !== 'object') continue;
    for (const [axis, v] of Object.entries(src)) {
      const def = AXES[axis];
      if (!def || applied.includes(axis) || absent.includes(axis)) continue;
      if (v === null) { vals[def.subject][axis] = null; absent.push(axis); continue; }
      const num = typeof v === 'number' ? v
        : typeof v === 'string' && v.trim() !== '' ? Number(v.trim().replace(',', '.')) : NaN;
      if (!Number.isFinite(num)) continue;
      const t = r4(clamp(num, T_MIN, T_MAX));
      vals[def.subject][axis] = t;
      if (!profile.skills || typeof profile.skills !== 'object') profile.skills = {};
      profile.skills[axis] = { t, n: EVAL_N, last: today, trend: 0, src: 'eval' };
      applied.push(axis);
    }
  }
  if (!applied.length && !absent.length) return { applied, absent };

  const entry = {
    src: ev.src ? String(ev.src) : ev.source ? slug(ev.source) : 'reperes',
    date: ev.date ? String(ev.date) : monthStr(today),
    classe: normClasse(ev.classe) || normClasse(profile.classe) || null,
    fr: vals.fr, ma: vals.ma, added: today,
    precision: ev.precision ? String(ev.precision) : ''
  };
  if (!Array.isArray(profile.evals)) profile.evals = [];
  const i = profile.evals.findIndex(e => e && e.src === entry.src && e.date === entry.date && e.classe === entry.classe);
  if (i >= 0) {
    const old = profile.evals.splice(i, 1)[0];
    entry.fr = { ...(old.fr || {}), ...entry.fr };
    entry.ma = { ...(old.ma || {}), ...entry.ma };
    if (!entry.precision && old.precision) entry.precision = old.precision;
  }
  profile.evals.push(entry);
  /* un plan du jour pas encore entamé est recalculé avec les nouveaux θ (session.ensureToday) */
  const plan = profile.today;
  if (applied.length && plan && !(Array.isArray(plan.blocks) && plan.blocks.some(b => b && b.done))) profile.today = null;
  return { applied, absent };
}

/* classe d'une évaluation : 'cm2' → 'CM2' ; inconnue → null (cohérent avec normalizeProfile) */
function normClasse(c) {
  const u = String(c || '').trim().toUpperCase();
  return ['CP', 'CE1', 'CE2', 'CM1', 'CM2'].includes(u) ? u : null;
}
