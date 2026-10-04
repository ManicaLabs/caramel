/* ============ RADAR : composant SVG réutilisable (CDC §4.2, §4.3, §8.2, §9 ; JEUX.md §8) ============
   Rendu calqué sur la fiche Repères : 3 cercles pointillés à 0,5 R / 0,75 R / R (repères ⊕, ⊕⊕, ⊕⊕⊕
   sur l'axe vertical), rayons, cartable 🎒 au centre, pastilles blanches cerclées aux sommets,
   polygone actuel plein (couleur de la matière), polygone de référence en pointillés, étoiles ✨ qui
   scintillent sur les axes en progrès, libellés autour (retour à la ligne propre, jamais coupés).

   renderRadar(container, {
     template,            radarTemplate(...) ou ficheTemplate(...) de js/core/axes.js ({ axes: [{ id, angle, label }] })
     values,              { axe: θ | null } ou tableau (un θ | null par axe du gabarit) ; undefined = non renseigné
     reference,           mêmes formats (fiche officielle, pointillés) ou null
     subject,             'fr' | 'ma' (couleurs --fr / --ma ; défaut : template.subject)
     labels,              'child' (AXES[id].child + emoji) | 'official' (libellé du gabarit) | 'none'
     size,                largeur maximale en px (défaut 380)
     twinkle: [axes],     étincelles ✨ (axes en progrès)
     dim: [axes],         libellé grisé + « bientôt » (axes sans jeu en v2.0)
     nullLabel,           mention d'un axe null : chaîne ou fn(id, i) → chaîne (défaut « absent »)
     showValues,          pastille « ⊕⊕ 2,4 » sous chaque libellé (espace parents, saisie manuelle)
     bridgeNull,          axe sans valeur posé sur la corde entre ses voisins renseignés au lieu du centre
                          (radar de l'enfant : jamais de creux à zéro sous ses yeux ; défaut false)
     animate,             morphing d'ouverture de la référence (ou du centre) vers l'actuel (défaut true)
     title,               nom accessible du graphique
     interactive: false | { onChange(i, θ | null | undefined, valeurs), onSelect(i), snap: 0.1, absent: true,
                            editor: true | false | élément hôte }
   }) → { el, update(values, { morphFrom, reference, twinkle }), setTransform({ cx, cy, R, rotation, width, height }),
          getValues(), valuesById(), setValue(i, v), select(i), selected(), setInteractive(b), relayout(), destroy() }

   Deux géométries :
   - automatique (défaut) : le radar remplit la largeur du conteneur, choisit R pour que tous les libellés
     tiennent (mesure réelle, aucun mot coupé), écarte les libellés qui se chevauchent, puis fixe sa hauteur ;
   - imposée (setTransform, import photo) : viewBox = taille de la scène, centre / rayon / rotation donnés,
     pas de libellés (la photo porte les siens).
   Mode interactif : poignées déplaçables le long de leur rayon (pointer events ; touch-action: none sur la
   poignée seulement), aimantées à `snap`, θ = thetaFromFrac(distance / R) ; clavier : flèches ±0,1,
   Page ±0,5, Début / Fin, Suppr = absent. Panneau de réglage (‹ › − + Absent) pour l'axe choisi.
   Valeurs : nombre (θ 0-3), null (absent : point au centre + mention), undefined (non renseigné : poignée
   « garée » près du centre, contour pointillé).
   Notation unique, celle des repères de la fiche (disques foncés barrés d'un + blanc, cf. radar-detect.js) :
   ⊕ (θ ≥ 1), ⊕⊕ (θ ≥ 2 : attendu de la classe), ⊕⊕⊕ (θ = 3), « sous ⊕ » en dessous de 1 — sur les cercles, les
   pastilles, le tableau et la légende des parents (un « + » nu devant un nombre se lirait « plus 1,4 »). */

import { h, svg, clear, fmtNum, loadCSS } from '../core/util.js';
import { AXES } from '../core/axes.js';
import { rFrac, thetaFromFrac, polar } from '../core/radar-model.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';

const G = globalThis;
const EPS = 1e-9;
const PARK = 0.3;                       /* fraction du rayon d'une poignée non renseignée */
const RINGS = [{ t: 1, mark: '⊕' }, { t: 2, mark: '⊕⊕' }, { t: 3, mark: '⊕⊕⊕' }];
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const has = (o, k) => o !== null && o !== undefined && Object.prototype.hasOwnProperty.call(o, k);
const clampT = t => Math.min(3, Math.max(0, t));
const r1 = v => Math.round(v * 10) / 10;

/* ---------- feuille de style (résolue depuis ce module : marche aussi hors de index.html) ---------- */
let cssPromise = null;
export function radarReady() {
  if (cssPromise) return cssPromise;
  try {
    const d = G.document;
    if (!d) return (cssPromise = Promise.resolve(false));
    if (d.querySelector('link[href$="css/ui/radar.css"]')) return (cssPromise = Promise.resolve(true));
    cssPromise = loadCSS(new URL('../../css/ui/radar.css', import.meta.url).href);
  } catch (_) { cssPromise = Promise.resolve(false); }
  return cssPromise;
}

/* ---------- formats partagés (espace parents, import) ---------- */
/* θ à une décimale, à la française : 2.4 → « 2,4 » */
export function fmtTheta(t) { return isNum(t) ? fmtNum(r1(clampT(t)), 1) : '—'; }
/* repères de la fiche : ⊕ (θ ≥ 1), ⊕⊕ (θ ≥ 2), ⊕⊕⊕ (θ = 3) ; sous ⊕ → '' */
export function levelMarks(t) {
  if (!isNum(t)) return '';
  const v = r1(clampT(t));
  return v >= 3 - EPS ? '⊕⊕⊕' : v >= 2 - EPS ? '⊕⊕' : v >= 1 - EPS ? '⊕' : '';
}
/* « ⊕⊕ 2,4 » · « sous ⊕ 0,7 » (affichage) */
export function levelText(t) {
  if (!isNum(t)) return '';
  const m = levelMarks(t);
  return (m || 'sous\u00A0⊕') + '\u00A0' + fmtTheta(t);
}
/* même valeur pour un lecteur d'écran : « 2,4 sur 3 » (les symboles ⊕ se lisent mal) */
export function levelSpeech(t) { return isNum(t) ? fmtTheta(t) + ' sur 3' : ''; }
/* icône d'un axe : celle du référentiel js/core/axes.js (« Les tables » : 🏇, l'icône du Galop des tables) */
export function axisEmoji(id) {
  const def = AXES[id];
  return (def && def.emoji) || '';
}

/* intersection du rayon [C → U] (U : bout du rayon d'un axe) et du segment [A, B] (sommets voisins) → [x, y] ou null
   (parallèles, ou intersection hors du rayon / du segment). Sert à bridgeNull : C + t·u = A + s·(B − A). */
export function chordPoint(C, A, B, U) {
  const u = [U[0] - C[0], U[1] - C[1]], d = [B[0] - A[0], B[1] - A[1]], w = [A[0] - C[0], A[1] - C[1]];
  const det = d[0] * u[1] - u[0] * d[1];
  if (Math.abs(det) <= 1e-9) return null;
  const t = (d[0] * w[1] - w[0] * d[1]) / det;
  const s = (u[0] * w[1] - u[1] * w[0]) / det;
  if (t > 0 && t <= 1 + 1e-9 && s >= -1e-9 && s <= 1 + 1e-9) return [C[0] + t * u[0], C[1] + t * u[1]];
  return null;
}

/* valeur lue → θ borné, null (absent) ou undefined (non renseigné / illisible) */
function normVal(x) {
  if (x === null) return null;
  if (x === undefined) return undefined;
  const n = typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x.trim().replace(',', '.')) : NaN;
  return Number.isFinite(n) ? clampT(n) : undefined;
}
/* { axe: θ } ou tableau → tableau aligné sur les axes du gabarit */
function toArray(axes, v) {
  if (Array.isArray(v)) return axes.map((a, i) => normVal(v[i]));
  if (v && typeof v === 'object') return axes.map(a => (has(v, a.id) ? normVal(v[a.id]) : undefined));
  return axes.map(() => undefined);
}

export function renderRadar(container, opts = {}) {
  radarReady();
  const template = opts.template && Array.isArray(opts.template.axes) ? opts.template : { axes: [] };
  const axes = template.axes.map(a => ({ ...a, angle: Number(a.angle) || 0 }));
  const n = axes.length;
  const subject = opts.subject === 'ma' || opts.subject === 'fr' ? opts.subject : (template.subject === 'ma' ? 'ma' : 'fr');
  const labelMode = opts.labels === 'official' || opts.labels === 'none' ? opts.labels : 'child';
  const maxSize = Math.max(200, Number(opts.size) || 380);
  const dimSet = new Set(Array.isArray(opts.dim) ? opts.dim : []);
  let twinkleSet = new Set(Array.isArray(opts.twinkle) ? opts.twinkle : []);
  const showValues = !!opts.showValues;
  const nullLabelOf = typeof opts.nullLabel === 'function' ? opts.nullLabel
    : (() => (typeof opts.nullLabel === 'string' ? opts.nullLabel : 'absent'));
  let inter = opts.interactive && typeof opts.interactive === 'object' ? { snap: 0.1, absent: true, ...opts.interactive } : null;
  const snap = inter && Number(inter.snap) > 0 ? Number(inter.snap) : 0.1;

  const st = {
    W: 0, H: 0, cx: 0, cy: 0, R: 0, rot: 0,
    fixed: false,                      /* géométrie imposée (setTransform) */
    vals: toArray(axes, opts.values),
    ref: opts.reference ? toArray(axes, opts.reference) : null,
    last: [],                          /* dernière valeur numérique de chaque axe (bouton « absent ») */
    sel: -1, lastW: -1, laidOut: false, dotsShown: !(opts.animate !== false), destroyed: false,
    morphing: false, morphGen: 0, hitR: 0, cssReady: false
  };
  st.vals.forEach((v, i) => { st.last[i] = isNum(v) ? v : undefined; });

  /* ---------- DOM ---------- */
  const root = h('div', {
    class: ['radar', 'radar--' + subject, 'radar--' + labelMode, inter && 'is-interactive']
  });
  /* propriété personnalisée : Object.assign(style) ne la poserait pas */
  try { root.style.setProperty('--radar-max', maxSize + 'px'); } catch (_) {}
  const stage = h('div', { class: 'radar-stage' });
  const title = opts.title ? String(opts.title) : 'Radar';
  const vb = svg('svg', { class: 'radar-svg', role: inter ? 'group' : 'img', 'aria-label': title, focusable: 'false' });
  const gGrid = svg('g', { class: 'radar-grid', 'aria-hidden': 'true' });
  const rings = RINGS.map((r, k) => svg('circle', { class: 'radar-ring r' + (k + 1) }));
  const marks = RINGS.map(r => svg('text', { class: 'radar-mark' }, r.mark));
  const ticks = RINGS.map(() => svg('line', { class: 'radar-tick' }));
  const scale = svg('line', { class: 'radar-scale' });               /* axe gradué vertical de la fiche */
  const rays = axes.map(() => svg('line', { class: 'radar-ray' }));
  gGrid.append(...rays, ...rings);
  /* l'axe gradué passe au-dessus de l'aplat : ses repères restent lisibles */
  const gScale = svg('g', { class: 'radar-scale-g', 'aria-hidden': 'true' }, scale, ...ticks, ...marks);
  /* polygone actuel en deux couches : l'aplat sous la référence, le contour au-dessus
     (là où rien n'a bougé, le trait plein recouvre les pointillés de la fiche) */
  const polyFill = svg('polygon', { class: 'radar-cur-fill', 'aria-hidden': 'true' });
  const polyCur = svg('polygon', { class: 'radar-cur', 'aria-hidden': 'true' });
  const polyRef = svg('polygon', { class: 'radar-ref', 'aria-hidden': 'true' });
  const gDots = svg('g', { class: 'radar-dots', 'aria-hidden': 'true' });
  const dots = axes.map(() => svg('circle', { class: 'radar-dot', r: '4.5' }));
  gDots.append(...dots);
  const gStars = svg('g', { class: 'radar-stars', 'aria-hidden': 'true' });
  const stars = axes.map(() => svg('text', { class: 'radar-star', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, '✨'));
  gStars.append(...stars);
  const bag = svg('g', { class: 'radar-bag', 'aria-hidden': 'true' },
    svg('circle', { class: 'radar-bag-disc' }),
    svg('text', { class: 'radar-bag-emo', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, '🎒'));
  const gHandles = svg('g', { class: 'radar-handles' });
  const handles = axes.map((a, i) => {
    const hit = svg('circle', { class: 'radar-hit' });
    const knob = svg('circle', { class: 'radar-knob', r: '9' });
    const g = svg('g', { class: 'radar-handle', 'data-i': String(i), tabindex: '0', role: 'slider',
      'aria-valuemin': '0', 'aria-valuemax': '3' }, hit, knob);
    return { g, hit, knob };
  });
  gHandles.append(...handles.map(x => x.g));
  vb.append(gGrid, polyFill, gScale, polyRef, polyCur, gDots, gStars, bag, gHandles);

  const labelsBox = h('div', { class: 'radar-labels' });
  const labels = axes.map((a, i) => buildLabel(a, i));
  labelsBox.append(...labels.map(l => l.el));
  stage.append(vb, labelsBox);
  root.append(stage);

  /* description accessible (lecteurs d'écran) : une ligne par axe */
  const desc = h('ul', { class: 'sr-only' });
  root.append(desc);

  let editor = null;
  if (container) container.appendChild(root);

  function axisName(i) {
    const a = axes[i], def = AXES[a.id];
    if (labelMode === 'child' && def) return def.child;
    return a.label || (def ? def.label : a.id);
  }
  function statusText(i) {
    const v = st.vals[i];
    if (isNum(v)) return levelText(v);
    if (v === null) return nullLabelOf(axes[i].id, i);
    return inter ? 'à placer' : nullLabelOf(axes[i].id, i);
  }

  function buildLabel(a, i) {
    const def = AXES[a.id];
    const emo = labelMode === 'child' && def && axisEmoji(a.id) ? h('span', { class: 'rl-emo', 'aria-hidden': 'true' }, axisEmoji(a.id)) : null;
    const txt = h('span', { class: 'rl-txt' }, labelMode === 'child' && def ? def.child : (a.label || (def ? def.label : a.id)));
    const chip = h('span', { class: 'rl-chip' });
    const el = h(inter ? 'button' : 'div', {
      class: ['radar-label', dimSet.has(a.id) && 'is-dim'], 'data-i': String(i),
      type: inter ? 'button' : null, 'aria-hidden': inter ? null : 'true', tabindex: inter ? '-1' : null
    }, emo, txt, chip);
    if (inter) el.addEventListener('click', () => { select(i); focusHandle(i); });
    return { el, chip, dx: 0, dy: 0, fx: 0.5, fy: 0.5, ax: 0, ay: 0 };
  }

  /* contenu variable des libellés : mention absent / bientôt / valeur, sélection */
  function refreshLabels() {
    let changed = false;
    labels.forEach((l, i) => {
      const a = axes[i], v = st.vals[i];
      let chip = '', kind = '';
      if (dimSet.has(a.id)) { chip = 'bientôt'; kind = 'soon'; }
      else if (showValues || inter) { chip = statusText(i); kind = isNum(v) ? 'val' : v === null ? 'null' : 'unset'; }
      else if (v === null || v === undefined) { chip = nullLabelOf(a.id, i); kind = 'null'; }
      if (l.chip.textContent !== chip) { l.chip.textContent = chip; changed = true; }
      l.chip.hidden = !chip;
      l.chip.className = 'rl-chip' + (kind ? ' is-' + kind : '');
      l.el.classList.toggle('is-selected', i === st.sel);
      l.el.classList.toggle('is-null', v === null || (v === undefined && !inter));
    });
    clear(desc);
    axes.forEach((a, i) => {
      const extra = dimSet.has(a.id) ? ' (bientôt)' : '';
      const rf = st.ref && isNum(st.ref[i]) ? ' ; fiche : ' + levelSpeech(st.ref[i]) : '';
      const v = st.vals[i];
      /* côté enfant (ni valeurs ni saisie) : jamais de niveau ni de note, seulement « tu progresses » (étincelles) */
      const cur = isNum(v) ? (showValues || inter ? levelSpeech(v) : twinkleSet.has(a.id) && !dimSet.has(a.id) ? 'tu progresses' : 'sur ton radar')
        : statusText(i);
      desc.appendChild(h('li', null, axisName(i) + ' : ' + cur + (showValues || inter ? rf : '') + extra));
    });
    return changed;
  }

  /* ---------- géométrie ---------- */
  const rad = d => d * Math.PI / 180;
  function pt(i, frac, extra = 0) {
    return polar(st.cx, st.cy, 1, axes[i].angle + st.rot, st.R * frac + extra);
  }
  function fracOf(v, handle) {
    if (isNum(v)) return rFrac(v);
    if (v === undefined && handle && inter) return PARK;
    return 0;
  }
  const ptsStr = arr => arr.map(p => (Math.round(p[0] * 100) / 100) + ',' + (Math.round(p[1] * 100) / 100)).join(' ');
  function polyPts(vals) {
    const pts = axes.map((a, i) => pt(i, fracOf(vals ? vals[i] : undefined, false)));
    return opts.bridgeNull && !inter ? bridge(vals, pts) : pts;
  }
  /* bridgeNull : un sommet sans valeur (absent, non renseigné) se pose à l'intersection de son rayon et du segment
     qui relie ses voisins renseignés (précédent et suivant, en boucle) ; à défaut, à la moyenne de leurs rayons.
     Le nombre de sommets ne change pas (le morphing reste point à point). */
  function bridge(vals, pts) {
    const num = axes.map((a, i) => isNum(vals ? vals[i] : undefined));
    if (num.filter(Boolean).length < 2) return pts;
    const C = [st.cx, st.cy];
    return pts.map((P, i) => {
      if (num[i]) return P;
      let p = i, q = i;
      do { p = (p - 1 + n) % n; } while (!num[p]);
      do { q = (q + 1) % n; } while (!num[q]);
      const X = chordPoint(C, pts[p], pts[q], pt(i, 1));
      return X || pt(i, (rFrac(vals[p]) + rFrac(vals[q])) / 2);
    });
  }

  function renderGeom({ morphFrom = null, dur = 900 } = {}) {
    if (!st.R) return Promise.resolve();
    st.hitR = 0;
    vb.setAttribute('viewBox', '0 0 ' + Math.round(st.W * 100) / 100 + ' ' + Math.round(st.H * 100) / 100);
    if (!st.fixed) { vb.setAttribute('width', String(st.W)); vb.setAttribute('height', String(st.H)); }
    /* grille : cercles + axe gradué vertical (« + », « ++ », « +++ ») qui tourne avec le gabarit */
    const rotT = 'rotate(' + Math.round(st.rot * 100) / 100 + ' ' + st.cx + ' ' + st.cy + ')';
    scale.setAttribute('x1', st.cx); scale.setAttribute('y1', st.cy);
    scale.setAttribute('x2', st.cx); scale.setAttribute('y2', st.cy - st.R);
    scale.setAttribute('transform', rotT);
    RINGS.forEach((r, k) => {
      const rr = Math.max(0, st.R * rFrac(r.t));
      rings[k].setAttribute('cx', st.cx); rings[k].setAttribute('cy', st.cy);
      rings[k].setAttribute('r', rr);
      ticks[k].setAttribute('x1', st.cx - 3); ticks[k].setAttribute('x2', st.cx + 3);
      ticks[k].setAttribute('y1', st.cy - rr); ticks[k].setAttribute('y2', st.cy - rr);
      ticks[k].setAttribute('transform', rotT);
      marks[k].setAttribute('x', String(st.cx + 5));
      marks[k].setAttribute('y', String(Math.round((st.cy - rr + (k === 2 ? -3 : 9)) * 10) / 10));
      marks[k].setAttribute('transform', rotT);
    });
    axes.forEach((a, i) => {
      const [x, y] = pt(i, 1);
      rays[i].setAttribute('x1', st.cx); rays[i].setAttribute('y1', st.cy);
      rays[i].setAttribute('x2', x); rays[i].setAttribute('y2', y);
      rays[i].classList.toggle('is-sel', !!inter && i === st.sel);
    });
    /* cartable */
    const br = Math.max(9, Math.min(15, st.R * 0.11));
    const disc = bag.firstChild, emo = bag.lastChild;
    disc.setAttribute('cx', st.cx); disc.setAttribute('cy', st.cy); disc.setAttribute('r', String(br));
    emo.setAttribute('x', st.cx); emo.setAttribute('y', String(st.cy + br * 0.06));
    emo.setAttribute('font-size', String(Math.round(br * 1.15)));
    /* référence */
    if (st.ref) { polyRef.setAttribute('points', ptsStr(polyPts(st.ref))); polyRef.removeAttribute('display'); }
    else polyRef.setAttribute('display', 'none');
    /* sommets, étoiles, poignées */
    axes.forEach((a, i) => {
      const v = st.vals[i];
      const [x, y] = pt(i, fracOf(v, false));
      dots[i].setAttribute('cx', x); dots[i].setAttribute('cy', y);
      dots[i].setAttribute('display', isNum(v) && !inter ? 'inline' : 'none');
      const tw = isNum(v) && twinkleSet.has(a.id) && !dimSet.has(a.id);
      if (tw) {
        const [sx, sy] = pt(i, rFrac(v), 13);
        stars[i].setAttribute('x', sx); stars[i].setAttribute('y', sy);
        stars[i].setAttribute('display', 'inline');
        stars[i].style.animationDelay = (i * 0.23).toFixed(2) + 's';
      } else stars[i].setAttribute('display', 'none');
      const hd = handles[i];
      if (inter) {
        const [hx, hy] = pt(i, fracOf(v, true));
        hd.hit.setAttribute('cx', hx); hd.hit.setAttribute('cy', hy); hd.hit.setAttribute('r', String(hitRadius()));
        hd.knob.setAttribute('cx', hx); hd.knob.setAttribute('cy', hy);
        hd.g.classList.toggle('is-null', v === null);
        hd.g.classList.toggle('is-unset', v === undefined);
        hd.g.classList.toggle('is-sel', i === st.sel);
        hd.g.setAttribute('aria-label', axisName(i));
        hd.g.setAttribute('aria-valuenow', isNum(v) ? String(r1(v)) : '0');
        hd.g.setAttribute('aria-valuetext', isNum(v) ? levelSpeech(v) : statusText(i));
      }
    });
    gHandles.setAttribute('display', inter ? 'inline' : 'none');
    gDots.classList.toggle('is-hidden', !st.dotsShown);
    /* polygone actuel (éventuellement animé : aplat et contour bougent ensemble) */
    const to = polyPts(st.vals);
    const both = (from, d) => Promise.all([motion.morphPolygon(polyFill, from, to, d), motion.morphPolygon(polyCur, from, to, d)]);
    if (morphFrom) {
      const s0 = ptsStr(morphFrom);
      polyFill.setAttribute('points', s0); polyCur.setAttribute('points', s0);
      const gen = ++st.morphGen;
      st.morphing = true;
      return both(morphFrom, dur).then(() => { if (gen === st.morphGen) st.morphing = false; });
    }
    /* géométrie changée pendant une animation : on la rejoint en douceur au lieu de la laisser finir ailleurs */
    if (st.morphing) {
      const gen = ++st.morphGen;
      return both(null, 250).then(() => { if (gen === st.morphGen) st.morphing = false; });
    }
    const s1 = ptsStr(to);
    polyFill.setAttribute('points', s1); polyCur.setAttribute('points', s1);
    return Promise.resolve();
  }

  /* rayon de la zone tactile d'une poignée, en unités du viewBox (24 px à l'écran) */
  function hitRadius() {
    if (st.hitR) return st.hitR;
    let k = 1;
    try { const w = vb.getBoundingClientRect().width; if (w > 0 && st.W > 0) k = st.W / w; } catch (_) {}
    return (st.hitR = Math.round(24 * k * 10) / 10);
  }

  /* ---------- mise en page automatique ---------- */
  function stageBox() { return stage.getBoundingClientRect(); }
  function placeLabel(l, i, W) {
    const a = rad(axes[i].angle);
    const s = Math.sin(a), c = Math.cos(a);
    const gap = W < 340 ? 8 : 10, pad = 3;
    const ax = st.cx + (st.R + gap) * s, ay = st.cy - (st.R + gap) * c;
    const fx = 0.5 - 0.5 * s, fy = 0.5 + 0.5 * c;
    let avail = Infinity;
    if (fx > 0.002) avail = Math.min(avail, (ax - pad) / fx);
    if (fx < 0.998) avail = Math.min(avail, (W - pad - ax) / (1 - fx));
    const maxW = Math.max(36, Math.min(avail, W * 0.46, 200));
    Object.assign(l, { ax, ay, fx, fy, dx: 0, dy: 0, maxW });
    l.el.style.maxWidth = Math.floor(maxW) + 'px';
    l.el.style.left = ax + 'px';
    l.el.style.top = ay + 'px';
    l.el.style.textAlign = s > 0.3 ? 'left' : s < -0.3 ? 'right' : 'center';
    l.el.classList.toggle('al-left', s > 0.3);
    l.el.classList.toggle('al-right', s < -0.3);
    applyShift(l);
  }
  function applyShift(l) {
    l.el.style.transform = 'translate(' + (-l.fx * 100).toFixed(2) + '%, ' + (-l.fy * 100).toFixed(2) + '%)' +
      (l.dx || l.dy ? ' translate(' + l.dx.toFixed(1) + 'px, ' + l.dy.toFixed(1) + 'px)' : '');
  }
  function measure(l, sb) {
    const r = l.el.getBoundingClientRect();
    return { l, x0: r.left - sb.left, x1: r.right - sb.left, y0: r.top - sb.top, y1: r.bottom - sb.top };
  }
  /* un libellé déborde-t-il (mot trop long pour sa largeur, ou sortie du cadre) ? */
  function horizOverflow(W) {
    const sb = stageBox();
    return labels.some(l => {
      const b = measure(l, sb);
      return l.el.scrollWidth > l.el.clientWidth + 1 || b.x0 < -0.5 || b.x1 > W + 0.5;
    });
  }
  /* écarte les libellés qui se chevauchent (déplacement minimal, vertical de préférence) et les garde
     hors du disque du radar (cercle +++ et ses repères) */
  function relax(W) {
    const sb = stageBox();
    const boxes = labels.map(l => measure(l, sb));
    const M = 3, keep = st.R + 5;
    /* obstacle fixe : le repère « +++ » au-dessus du cercle extérieur */
    const obst = [{ x0: st.cx - 3, x1: st.cx + 30, y0: st.cy - st.R - 17, y1: st.cy - st.R + 2 }];
    for (let pass = 0; pass < 60; pass++) {
      let moved = false;
      for (const b of boxes) {
        for (const o of obst) {
          const ox = Math.min(b.x1, o.x1) - Math.max(b.x0, o.x0) + M;
          const oy = Math.min(b.y1, o.y1) - Math.max(b.y0, o.y0) + M;
          if (ox <= 0 || oy <= 0) continue;
          moved = true;
          if (oy <= ox) shift(b, 0, (b.y0 + b.y1 < o.y0 + o.y1 ? -1 : 1) * oy);
          else shift(b, (b.x0 + b.x1 < o.x0 + o.x1 ? -1 : 1) * ox, 0, W);
        }
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const A = boxes[i], B = boxes[j];
          const ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) + M;
          const oy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) + M;
          if (ox <= 0 || oy <= 0) continue;
          moved = true;
          if (oy <= ox * 1.2) {
            const [up, dn] = (A.y0 + A.y1) <= (B.y0 + B.y1) ? [A, B] : [B, A];
            shift(up, 0, -oy / 2); shift(dn, 0, oy / 2);
          } else {
            const [lf, rt] = (A.x0 + A.x1) <= (B.x0 + B.x1) ? [A, B] : [B, A];
            shift(lf, -ox / 2, 0, W); shift(rt, ox / 2, 0, W);
          }
        }
      }
      for (const b of boxes) {
        const nx = Math.min(Math.max(st.cx, b.x0), b.x1), ny = Math.min(Math.max(st.cy, b.y0), b.y1);
        let vx = nx - st.cx, vy = ny - st.cy;
        const d = Math.hypot(vx, vy);
        if (d >= keep) continue;
        moved = true;
        if (d < 0.5) {                               /* centre dans la boîte : on suit l'axe */
          const a = rad(axes[labels.indexOf(b.l)].angle);
          vx = Math.sin(a); vy = -Math.cos(a);
        } else { vx /= d; vy /= d; }
        const need = keep - d + 0.5;
        const want = vx * need, before = b.x0;
        shift(b, want, 0, W);
        let dy = vy * need;
        /* poussée horizontale bloquée par le bord : on complète verticalement, en s'éloignant du centre */
        const lack = Math.abs(want) - Math.abs(b.x0 - before);
        if (lack > 0.5) dy += (dy < 0 || (dy === 0 && (b.y0 + b.y1) / 2 < st.cy) ? -1 : 1) * lack;
        shift(b, 0, dy);
      }
      if (!moved) break;
    }
    boxes.forEach(b => applyShift(b.l));
    return boxes;
  }
  function shift(b, dx, dy, W) {
    if (dx && W) {                                  /* jamais hors du cadre */
      if (b.x0 + dx < 0) dx = -b.x0;
      if (b.x1 + dx > W) dx = W - b.x1;
    }
    b.x0 += dx; b.x1 += dx; b.y0 += dy; b.y1 += dy;
    b.l.dx += dx; b.l.dy += dy;
  }

  function layoutAuto() {
    const W = Math.round(stage.clientWidth || 0);
    if (W < 120) return false;                      /* conteneur masqué : on attendra sa taille */
    st.W = W;
    root.classList.toggle('is-narrow', W < 340);
    st.rot = 0;
    st.cx = W / 2;
    if (labelMode === 'none' || !n) {
      st.R = Math.min(W * 0.44, maxSize * 0.44);
      st.cy = st.R + 18;
      st.H = 2 * st.R + 30;
    } else {
      labelsBox.hidden = false;
      st.cy = 0;
      /* plus grand R pour lequel tous les libellés tiennent (recherche par dichotomie) */
      const Rmax = Math.min(W * 0.37, 158), Rmin = W * 0.2;
      /* largeur naturelle (sur une ligne) de chaque libellé : un libellé court ne doit pas être haché en
         colonne d'un mot par ligne pour gagner quelques pixels de rayon */
      const lmin = Math.max(56, Math.min(120, W * 0.2));
      labels.forEach(l => { l.el.style.maxWidth = 'none'; });
      const natW = labels.map(l => Math.ceil(l.el.getBoundingClientRect().width));
      const roomy = () => labels.every((l, i) => l.maxW + 0.5 >= Math.min(natW[i], lmin));
      const fits = R => { st.R = R; labels.forEach((l, i) => placeLabel(l, i, W)); return !horizOverflow(W) && roomy(); };
      let R = Rmax;
      if (!fits(Rmax)) {
        let lo = Rmin, hi = Rmax;
        for (let k = 0; k < 8 && hi - lo > 1; k++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
        R = lo;
        fits(R);
      }
      const boxes = relax(W);
      let top = st.cy - st.R - 16, bot = st.cy + st.R + 10;
      for (const b of boxes) { top = Math.min(top, b.y0); bot = Math.max(bot, b.y1); }
      const off = 6 - top;
      st.cy += off;
      labels.forEach(l => { l.ay += off; l.el.style.top = l.ay + 'px'; });
      st.H = Math.ceil(bot - top + 12);
    }
    stage.style.height = st.H + 'px';
    st.lastW = W;
    st.laidOut = true;
    return true;
  }

  /* ---------- rendu complet ---------- */
  function relayout(anim) {
    if (st.destroyed) return Promise.resolve();
    refreshLabels();
    if (!st.fixed && !layoutAuto()) return Promise.resolve();
    if (st.fixed) labelsBox.hidden = true;
    return renderGeom(anim || {});
  }

  /* ouverture : la fiche (ou le centre) se transforme en polygone actuel, puis les pastilles apparaissent */
  let opened = false;
  function openAnim() {
    if (opened || !st.R) return;
    opened = true;
    if (opts.animate === false || inter) { st.dotsShown = true; renderGeom(); return; }
    const from = st.ref ? polyPts(st.ref) : axes.map((a, i) => pt(i, 0));
    st.dotsShown = false;
    renderGeom({ morphFrom: from, dur: motion.reduced() ? 0 : 900 }).then(() => {
      if (st.destroyed) return;
      st.dotsShown = true;
      gDots.classList.remove('is-hidden');
      if (!motion.reduced()) motion.stagger(dots.filter(d => d.getAttribute('display') !== 'none'), d => motion.enter(d, { from: 'scale', dur: 320 }), 45);
    });
  }

  /* ---------- interaction ---------- */
  function emit(i) {
    if (!inter) return;
    try { if (typeof inter.onChange === 'function') inter.onChange(i, st.vals[i], st.vals.slice()); } catch (e) { console.error(e); }
  }
  function select(i) {
    if (!inter || i < 0 || i >= n) return;
    if (st.sel === i) return;
    st.sel = i;
    refreshLabels();
    renderGeom();
    renderEditor();
    try { if (typeof inter.onSelect === 'function') inter.onSelect(i); } catch (e) { console.error(e); }
  }
  function focusHandle(i) { try { handles[i].g.focus({ preventScroll: true }); } catch (_) {} }
  let lastTick = 0;
  function setVal(i, v, { sound = true, pop = false } = {}) {
    if (i < 0 || i >= n) return;
    const nv = v === null ? null : v === undefined ? undefined : clampT(r1(Math.round(v / snap) * snap));
    const old = st.vals[i];
    if (nv === old || (isNum(nv) && isNum(old) && Math.abs(nv - old) < EPS)) return;
    st.vals[i] = nv;
    if (isNum(nv)) st.last[i] = nv;
    /* les pastilles de valeur ont une largeur fixe (CSS) : pas de remise en page pendant un glisser */
    refreshLabels();
    renderGeom();
    renderEditor();
    const t = Date.now();
    if (sound && t - lastTick > 45) { lastTick = t; try { audio.tap(); } catch (_) {} }
    if (pop) motion.pop(handles[i].knob, { scale: 1.35, dur: 300 });
    emit(i);
  }

  /* glisser une poignée : on prend la poignée la plus proche du doigt (les zones tactiles se recouvrent
     près du centre), puis θ suit la projection du doigt sur le rayon de l'axe */
  let drag = null;
  function toLocal(e) {
    try {
      const m = vb.getScreenCTM();
      if (m) {
        const p = vb.createSVGPoint();
        p.x = e.clientX; p.y = e.clientY;
        const q = p.matrixTransform(m.inverse());
        return [q.x, q.y];
      }
    } catch (_) {}
    const r = vb.getBoundingClientRect();
    return [(e.clientX - r.left) * (st.W / (r.width || 1)), (e.clientY - r.top) * (st.H / (r.height || 1))];
  }
  function nearest(x, y, fallback) {
    let best = fallback, bd = Infinity;
    const lim = hitRadius() * 1.25;
    axes.forEach((a, i) => {
      const [hx, hy] = pt(i, fracOf(st.vals[i], true));
      const d = Math.hypot(hx - x, hy - y) - (i === st.sel ? 4 : 0);
      if (d < bd && d <= lim) { bd = d; best = i; }
    });
    return best;
  }
  function valueAt(i, x, y) {
    const a = rad(axes[i].angle + st.rot);
    const proj = (x - st.cx) * Math.sin(a) - (y - st.cy) * Math.cos(a);
    const frac = Math.min(1, Math.max(0, proj / (st.R || 1)));
    return thetaFromFrac(frac);
  }
  function onDown(e) {
    if (!inter || (e.button !== undefined && e.button > 0)) return;
    const g = e.target.closest && e.target.closest('.radar-handle');
    if (!g) return;
    e.preventDefault();
    const [x, y] = toLocal(e);
    const i = nearest(x, y, Number(g.dataset.i));
    select(i);
    drag = { i, id: e.pointerId, moved: false, x0: x, y0: y, g: handles[i].g };
    try { drag.g.setPointerCapture(e.pointerId); } catch (_) {}
    root.classList.add('is-dragging');
    focusHandle(i);
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    const [x, y] = toLocal(e);
    if (!drag.moved && Math.hypot(x - drag.x0, y - drag.y0) < 3) return;
    drag.moved = true;
    setVal(drag.i, valueAt(drag.i, x, y));
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    try { drag.g.releasePointerCapture(e.pointerId); } catch (_) {}
    drag = null;
    root.classList.remove('is-dragging');
  }
  function onKey(e) {
    const g = e.target.closest && e.target.closest('.radar-handle');
    if (!g || !inter) return;
    const i = Number(g.dataset.i);
    const v = st.vals[i];
    const base = isNum(v) ? v : 2;
    const k = e.key;
    let nv;
    if (k === 'ArrowUp' || k === 'ArrowRight') nv = isNum(v) ? base + snap : base;
    else if (k === 'ArrowDown' || k === 'ArrowLeft') nv = isNum(v) ? base - snap : base;
    else if (k === 'PageUp') nv = base + 0.5;
    else if (k === 'PageDown') nv = base - 0.5;
    else if (k === 'Home') nv = 0;
    else if (k === 'End') nv = 3;
    else if ((k === 'Delete' || k === 'Backspace') && inter.absent !== false) { e.preventDefault(); toggleAbsent(i); return; }
    else return;
    e.preventDefault();
    select(i);
    setVal(i, nv, { pop: true });
  }
  function onFocus(e) {
    const g = e.target.closest && e.target.closest('.radar-handle');
    if (g) select(Number(g.dataset.i));
  }
  function toggleAbsent(i) {
    if (st.vals[i] === null) setVal(i, isNum(st.last[i]) ? st.last[i] : undefined);
    else setVal(i, null);
  }
  vb.addEventListener('pointerdown', onDown);
  vb.addEventListener('pointermove', onMove);
  vb.addEventListener('pointerup', onUp);
  vb.addEventListener('pointercancel', onUp);
  vb.addEventListener('lostpointercapture', onUp);
  vb.addEventListener('keydown', onKey);
  vb.addEventListener('focusin', onFocus);

  /* ---------- panneau de réglage de l'axe choisi ---------- */
  function buildEditor() {
    const prev = h('button', { type: 'button', class: 're-nav', 'aria-label': 'Compétence précédente' }, '‹');
    const next = h('button', { type: 'button', class: 're-nav', 'aria-label': 'Compétence suivante' }, '›');
    const idx = h('span', { class: 're-idx' });
    const name = h('span', { class: 're-name' });
    const minus = h('button', { type: 'button', class: 're-step', 'aria-label': 'Baisser d’un cran' }, '−');
    const plus = h('button', { type: 'button', class: 're-step', 'aria-label': 'Monter d’un cran' }, '+');
    const out = h('output', { class: 're-val', 'aria-live': 'polite' });
    const abs = inter.absent !== false ? h('button', { type: 'button', class: 're-absent', 'aria-pressed': 'false' }, 'Absent') : null;
    const el = h('div', { class: 'radar-editor', role: 'group', 'aria-label': 'Réglage de la compétence choisie' },
      h('div', { class: 're-head' }, prev, h('div', { class: 're-title' }, idx, name), next),
      h('div', { class: 're-row' }, minus, out, plus, abs));
    const step = d => {
      const i = st.sel; if (i < 0) return;
      const v = st.vals[i];
      setVal(i, isNum(v) ? v + d : 2, { pop: true });
    };
    prev.addEventListener('click', () => { select((st.sel - 1 + n) % n); audio.tap(); });
    next.addEventListener('click', () => { select((st.sel + 1) % n); audio.tap(); });
    minus.addEventListener('click', () => step(-snap));
    plus.addEventListener('click', () => step(snap));
    if (abs) abs.addEventListener('click', () => { if (st.sel >= 0) toggleAbsent(st.sel); });
    editor = { el, idx, name, out, abs, minus, plus };
    const host = inter.editor && inter.editor.nodeType === 1 ? inter.editor : root;
    host.appendChild(el);
  }
  function renderEditor() {
    if (!editor || st.sel < 0) return;
    const i = st.sel, v = st.vals[i];
    editor.idx.textContent = (i + 1) + '/' + n;
    editor.name.textContent = axisName(i);
    editor.out.textContent = isNum(v) ? levelText(v) : v === null ? 'absent' : 'à placer';
    editor.out.className = 're-val' + (isNum(v) ? '' : v === null ? ' is-null' : ' is-unset');
    if (editor.abs) {
      editor.abs.setAttribute('aria-pressed', v === null ? 'true' : 'false');
      editor.abs.classList.toggle('on', v === null);
    }
    editor.minus.disabled = isNum(v) && v <= EPS;
    editor.plus.disabled = isNum(v) && v >= 3 - EPS;
  }
  function setInteractive(b) {
    if (b && !inter) inter = { snap: 0.1, absent: true, ...(opts.interactive || {}) };
    if (!b && inter) { inter = null; }
    root.classList.toggle('is-interactive', !!inter);
    if (inter && !editor && inter.editor !== false) buildEditor();
    if (editor) editor.el.hidden = !inter;
    if (inter && st.sel < 0) {
      const first = st.vals.findIndex(v => v === undefined);
      st.sel = first >= 0 ? first : 0;
    }
    refreshLabels();
    renderGeom();
    renderEditor();
  }
  if (inter) setInteractive(true);

  /* ---------- redimensionnement, polices ---------- */
  let ro = null, raf = 0;
  const schedule = () => {
    if (raf || st.destroyed) return;
    const go = () => {
      raf = 0;
      if (st.fixed || !st.cssReady) return;
      const W = Math.round(stage.clientWidth || 0);
      if (W === st.lastW && st.laidOut) return;
      relayout().then(() => { if (!opened) openAnim(); });
    };
    raf = typeof G.requestAnimationFrame === 'function' ? G.requestAnimationFrame(go) : setTimeout(go, 16);
  };
  try { if (typeof G.ResizeObserver === 'function') { ro = new G.ResizeObserver(schedule); ro.observe(stage); } } catch (_) { ro = null; }
  const onWin = () => schedule();
  if (!ro) { try { G.addEventListener('resize', onWin); } catch (_) {} }
  try {
    if (G.document && G.document.fonts && G.document.fonts.ready) {
      G.document.fonts.ready.then(() => { if (!st.destroyed && !st.fixed) { st.lastW = -1; schedule(); } }).catch(() => {});
    }
  } catch (_) {}
  /* premier rendu quand la feuille de style est là (sinon les libellés seraient mesurés sans style) */
  radarReady().then(() => {
    st.cssReady = true;
    if (st.destroyed || st.fixed) return;
    st.lastW = -1;
    if (root.isConnected && stage.clientWidth >= 120) { relayout().then(() => {}); openAnim(); }
    else schedule();
  });

  /* ---------- API ---------- */
  return {
    el: root,
    update(values, { morphFrom = null, reference, twinkle } = {}) {
      const prevPts = polyPts(st.vals);
      if (reference !== undefined) st.ref = reference ? toArray(axes, reference) : null;
      if (Array.isArray(twinkle)) twinkleSet = new Set(twinkle);
      if (values !== undefined) {
        st.vals = toArray(axes, values);
        st.vals.forEach((v, i) => { if (isNum(v)) st.last[i] = v; });
      }
      const sizeChanged = refreshLabels();
      if (sizeChanged && !st.fixed) layoutAuto();
      let from = null;
      if (morphFrom === 'reference') from = st.ref ? polyPts(st.ref) : null;
      else if (morphFrom === 'center') from = axes.map((a, i) => pt(i, 0));
      else if (morphFrom === 'current' || morphFrom === true) from = prevPts;
      else if (morphFrom) from = polyPts(toArray(axes, morphFrom));
      renderEditor();
      return renderGeom({ morphFrom: from, dur: 600 });
    },
    /* géométrie imposée (scène photo) : px du conteneur */
    setTransform({ cx, cy, R, rotation = 0, width, height } = {}) {
      st.fixed = true;
      st.W = Number(width) || stage.clientWidth || st.W || maxSize;
      st.H = Number(height) || stage.clientHeight || st.H || maxSize;
      st.cx = Number(cx) || 0; st.cy = Number(cy) || 0;
      st.R = Math.max(1, Number(R) || 1);
      st.rot = Number(rotation) || 0;
      root.classList.add('is-fixed');
      labelsBox.hidden = true;
      stage.style.height = '';
      st.dotsShown = true; opened = true;
      refreshLabels();
      return renderGeom();
    },
    getValues: () => st.vals.slice(),
    valuesById() {
      const out = {};
      axes.forEach((a, i) => { if (!has(out, a.id)) out[a.id] = st.vals[i]; });
      return out;
    },
    setValue(i, v) { setVal(i, v === null ? null : v === undefined ? undefined : Number(v), { sound: false }); },
    select,
    selected: () => st.sel,
    setInteractive,
    relayout: () => { st.lastW = -1; return relayout(); },
    destroy() {
      st.destroyed = true;
      try { if (ro) ro.disconnect(); } catch (_) {}
      try { G.removeEventListener('resize', onWin); } catch (_) {}
      if (raf) { try { G.cancelAnimationFrame(raf); } catch (_) {} }
      root.remove();
      if (editor && editor.el.isConnected) editor.el.remove();
    }
  };
}
