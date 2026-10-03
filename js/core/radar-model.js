/* ============ RADAR : modèle pur (CDC §4.2, §9 ; contrat §5.8) ============
   Échelle radiale des fiches officielles : r(θ) = θ/2 si θ ≤ 1, sinon 0,5 + 0,25 (θ − 1)
   → les cercles ⊕ / ⊕⊕ / ⊕⊕⊕ tombent à 0,5 R / 0,75 R / R.
   Valeurs : skill observé (n > 0) sinon évaluation officielle de référence sinon null (absence).
   Snapshots hebdomadaires (1 par semaine ISO, 104 au plus) pour le curseur temporel des parents. */

import { addDays, dayStr, weekKey } from './util.js';
import { axisSubject } from './axes.js';

export const SNAPSHOT_CAP = 104;
const EPS = 1e-9;
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const clampT = t => Math.min(3, Math.max(0, t));
const round = (v, k) => Math.round(v * k) / k;
const day = v => (typeof v === 'string' ? v.slice(0, 10) : dayStr(v instanceof Date ? v : new Date()));

/* θ (0-3) → fraction du rayon (0-1) */
export function rFrac(theta) {
  const t = clampT(Number(theta) || 0);
  return t <= 1 ? t / 2 : 0.5 + 0.25 * (t - 1);
}
/* fraction du rayon → θ (inverse de rFrac, borné 0-3) : saisie guidée sur la photo */
export function thetaFromFrac(f) {
  const x = Number(f);
  if (!Number.isFinite(x) || x <= 0) return 0;
  return clampT(x <= 0.5 ? 2 * x : 1 + (x - 0.5) / 0.25);
}
/* point du radar : angle en degrés, sens horaire depuis le haut ; frac = fraction du rayon R */
export function polar(cx, cy, R, angleDeg, frac) {
  const a = (Number(angleDeg) || 0) * Math.PI / 180;
  const r = (Number(R) || 0) * (Number(frac) || 0);
  /* arrondi au millionième : pas de « 1e-16 » dans les attributs SVG */
  return [round(cx + r * Math.sin(a), 1e6) + 0, round(cy - r * Math.cos(a), 1e6) + 0];
}

/* skill observé (n > 0) → θ, sinon undefined */
function observed(profile, axis) {
  const sk = isObj(profile) && isObj(profile.skills) ? profile.skills[axis] : null;
  if (!isObj(sk) || !(Number(sk.n) > 0)) return undefined;
  const t = Number(sk.t);
  return Number.isFinite(t) ? clampT(t) : undefined;
}

/* évaluation de référence d'une matière : la plus récente (date, puis date d'ajout, puis ordre)
   parmi celles qui renseignent cette matière */
function latestEval(profile, subject) {
  const evals = isObj(profile) && Array.isArray(profile.evals) ? profile.evals : [];
  let best = null, bk = null;
  evals.forEach((e, i) => {
    if (!isObj(e) || !isObj(e[subject]) || !Object.keys(e[subject]).length) return;
    const k = [String(e.date || ''), String(e.added || ''), i];
    const newer = !bk || k[0] > bk[0] || (k[0] === bk[0] && (k[1] > bk[1] || (k[1] === bk[1] && k[2] > bk[2])));
    if (newer) { best = e; bk = k; }
  });
  return best;
}

/* { axe: θ | null } de la dernière évaluation officielle de la matière, ou null s'il n'y en a pas */
export function referenceValues(profile, subject) {
  const ev = latestEval(profile, subject);
  if (!ev) return null;
  const out = {};
  for (const [axis, v] of Object.entries(ev[subject])) {
    const n = v === null || v === '' ? NaN : Number(v);
    out[axis] = Number.isFinite(n) ? clampT(n) : null;
  }
  return out;
}

/* identifiants d'axes d'un gabarit : radarTemplate(...) ({ axes }), tableau d'objets { id } ou d'ids */
function axisIds(template) {
  const arr = Array.isArray(template) ? template : (isObj(template) && Array.isArray(template.axes) ? template.axes : []);
  return arr.map(a => (typeof a === 'string' ? a : isObj(a) ? a.id : null)).filter(id => typeof id === 'string' && id);
}

/* { axe: θ | null } pour chaque axe du gabarit (polygone actuel) */
export function currentValues(profile, template) {
  const out = {}, refs = {};
  for (const axis of axisIds(template)) {
    const t = observed(profile, axis);
    if (t !== undefined) { out[axis] = t; continue; }
    const subj = axisSubject(axis);
    if (!has(refs, subj)) refs[subj] = referenceValues(profile, subj);
    const v = refs[subj] ? refs[subj][axis] : undefined;
    out[axis] = typeof v === 'number' ? v : null;
  }
  return out;
}

/* photo de la semaine ISO (θ observés, arrondis au centième) : 1 par semaine, 104 au plus.
   → le snapshot créé, ou null (déjà fait cette semaine, ou aucun axe observé) */
export function snapshotIfNeeded(profile, today = dayStr()) {
  if (!isObj(profile)) return null;
  const d = day(today);
  if (!Array.isArray(profile.snapshots)) profile.snapshots = [];
  const w = weekKey(d);
  if (profile.snapshots.some(x => isObj(x) && x.w === w)) return null;
  const s = {};
  for (const axis of Object.keys(isObj(profile.skills) ? profile.skills : {})) {
    const t = observed(profile, axis);
    if (t !== undefined) s[axis] = round(t, 100);
  }
  if (!Object.keys(s).length) return null;
  const snap = { w, d, s };
  profile.snapshots.push(snap);
  profile.snapshots.sort((a, b) => (a.w < b.w ? -1 : a.w > b.w ? 1 : 0));
  if (profile.snapshots.length > SNAPSHOT_CAP) profile.snapshots.splice(0, profile.snapshots.length - SNAPSHOT_CAP);
  return snap;
}

/* tendance d'un axe : Δθ sur les `days` derniers jours, d'après profile.history[] (ax, th = θ après la manche).
   Base = dernier θ connu avant la fenêtre, sinon première manche de la fenêtre. Aucune manche récente → 0. */
export function axisTrend(profile, axis, today = dayStr(), days = 14) {
  const d = day(today);
  const hist = isObj(profile) && Array.isArray(profile.history) ? profile.history : [];
  const pts = [];
  hist.forEach((e, i) => {
    if (!isObj(e) || e.ax !== axis || typeof e.d !== 'string' || e.d.slice(0, 10) > d) return;
    const th = e.th === null || e.th === '' ? NaN : Number(e.th);
    if (Number.isFinite(th)) pts.push({ d: e.d.slice(0, 10), t: Number(e.t) || 0, i, th: clampT(th) });
  });
  if (!pts.length) return 0;
  pts.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : (a.t - b.t) || (a.i - b.i)));
  const start = addDays(d, -(Number(days) || 14));           /* fenêtre : ]aujourd'hui − days ; aujourd'hui] */
  const win = pts.filter(p => p.d > start);
  if (!win.length) return 0;
  const before = pts.filter(p => p.d <= start);
  const base = before.length ? before[before.length - 1].th : win[0].th;
  return round(win[win.length - 1].th - base, 1000) + 0;
}

/* axe « en progrès » (étoile qui scintille) : θ − évaluation ≥ 0,2 ou tendance > 0,1 */
export function inProgress(profile, axis, today = dayStr()) {
  const t = observed(profile, axis);
  if (t !== undefined) {
    const ref = referenceValues(profile, axisSubject(axis));
    const ev = ref ? ref[axis] : null;
    if (typeof ev === 'number' && t - ev >= 0.2 - EPS) return true;
  }
  return axisTrend(profile, axis, today) > 0.1 + EPS;
}
