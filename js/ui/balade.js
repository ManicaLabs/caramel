/* ============ « MA BALADE DU JOUR » (JEUX.md §8, CDC §7.4) ============
   Un sentier qui serpente dans un pré, quatre pierres (échauffement 🌅, mission ⭐, révision 🔁,
   récompense 🎁) et le compagnon debout au fond de la pierre de l'étape en cours (l'emoji reste visible). Quand un bloc vient
   d'être terminé, il marche le long du sentier jusqu'à la pierre suivante ; balade finie → il danse,
   confettis, « +10 🍎 » (déjà crédité par la manche : rien n'est recrédité ici), série du jour.
   Plan : session.ensureToday via store.mutateProfile. Lancement d'une étape :
   #/play/<jeu>?mode=balade&block=<i> ; bloc récompense sans jeu → choix parmi les jeux de la classe,
   sauf celui de l'étape précédente (jamais deux fois le même jeu de suite).
   « Un seul gros bouton » : l'accueil (« Jouer ▶ ») et le bilan (« Étape suivante ▶ ») lancent directement l'étape
   en cours ; cette carte du pré reste l'aperçu de la journée (pierres = icônes des jeux, sans étiquettes) avec un
   seul bouton. Exporte STEP_KIND, stepInfo(), currentStep(), launchStep() et openGamePicker() (accueil, bilan).
   v2.4 — temps de jeu du jour (js/core/playtime.js, js/ui/play-limit.js) : une fois atteint, launchStep ne lance plus
   rien (le compagnon dit gentiment pourquoi), la feuille des jeux montre ses tuiles grisées sous « {N} se repose 💤
   À demain ! », et le bouton de cette carte devient « À demain ! 💤 » (« Encore un jeu ? » laisse place à la phrase). */

import { h, clear, dayStr, frTypo, loadCSS, svg } from '../core/util.js';
import * as store from '../core/store.js';
import * as router from '../router.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import * as kit from './kit.js';
import { fillTemplate } from '../core/profiles.js';
import { ensureToday } from '../core/session.js';
import { gamesFor, GAME_BY_ID } from '../games/index.js';
import { mountReady, avatarOf, setAvatar } from './companion.js';
import { timeUp, restLine, restNotice, restKind, REST_TEXT } from './play-limit.js';

/* étapes : libellés enfant (jamais de niveau scolaire) — JEUX.md §8 */
export const STEP_KIND = Object.freeze({
  echauffement: { label: 'Échauffement', emoji: '🌅' },
  priorite: { label: 'Mission', emoji: '⭐' },
  revision: { label: 'Révision', emoji: '🔁' },
  recompense: { label: 'Récompense', emoji: '🎁' }
});

/* l'étape i du plan → { kind, label, emoji, game, icon, title } (title templaté ; jeu libre → null) */
export function stepInfo(profile, plan, i) {
  const b = plan && Array.isArray(plan.blocks) ? plan.blocks[i] : null;
  if (!b) return null;
  const key = STEP_KIND[b.kind] ? b.kind : 'recompense';
  const g = b.game ? GAME_BY_ID[b.game] || null : null;
  return { kind: key, ...STEP_KIND[key], game: g, icon: g ? g.icon : '🎁', title: g ? fillTemplate(g.title, profile) : null, done: !!b.done };
}

/* ---------- navigation ---------- */
const FROM_KEY = 'caramel-play-from';
const POS_KEY = 'caramel-balade-pos';
const FETE_KEY = 'caramel-balade-fete';
const ssGet = k => { try { return sessionStorage.getItem(k); } catch (_) { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) {} };

/* étape en cours du plan du jour : indice du premier bloc non fait (-1 : balade finie ou absente) */
export function currentStep(profile, today = dayStr()) {
  const plan = profile && profile.today;
  if (!plan || plan.d !== today || !Array.isArray(plan.blocks) || !plan.blocks.length || plan.done) return -1;
  return plan.blocks.findIndex(b => !b.done);
}

/* feuille « Choisis ton jeu » : tuiles (icône + nom court), aucune description ; exclude = jeu(x) à éviter
   (jamais deux fois le même jeu de suite ; jeu remplacé faute de micro) ; onPick(id) appelé une fois la feuille
   refermée ; onCancel(raison) si l'enfant la referme sans choisir (croix, fond, glissé, Échap) → api de la feuille ;
   extras = tuiles en plus, sur toute la largeur après les jeux : [{ id, icon, title, label?, onPick() }] (accueil :
   « 👫 Avec un copain », js/ui/duel.js) */
export function openGamePicker({ title = 'Choisis ton jeu', exclude = null, onPick, onCancel, extras = null } = {}) {
  const q = store.getProfile();
  if (!q) return null;
  const skip = new Set([].concat(exclude || []).filter(Boolean));
  const list = gamesFor(q.classe).filter(g => !skip.has(g.id));
  const grid = h('div', { class: 'bl-pick' });
  /* temps de jeu du jour atteint (v2.4, js/ui/play-limit.js) : tuiles grisées, une petite phrase au-dessus ; toucher
     une tuile la fait juste remuer et redit la phrase (aucun jeu ne démarre) */
  const rest = timeUp(q);
  const restTxt = rest ? restLine(q) : '';
  let s = null;
  const tile = (t, label, go) => {
    if (rest) {
      t.classList.add('is-rest');
      t.setAttribute('aria-disabled', 'true');
      t.setAttribute('aria-label', label + ' : ' + restTxt);
      t.appendChild(h('span', { class: 'bl-pick-zz', 'aria-hidden': 'true' }, '💤'));
      t.addEventListener('click', () => restNotice(q, { el: t }));
      return;
    }
    t.addEventListener('click', () => {
      audio.tap();
      if (s) s.close('action').then(go); else go();
    });
  };
  for (const g of list) {
    const label = fillTemplate(g.title, q);
    const t = h('button', { type: 'button', class: 'bl-pick-tile', 'aria-label': label },
      h('span', { class: 'bl-pick-ico', 'aria-hidden': 'true' }, g.icon),
      h('span', { class: 'bl-pick-t', 'aria-hidden': 'true' }, fillTemplate(g.short || g.title, q)));
    t.style.setProperty('--tint', 'var(--tile-' + g.id + ', ' + (g.tint || 'var(--card)') + ')');
    tile(t, label, () => { if (typeof onPick === 'function') onPick(g.id); });
    grid.appendChild(t);
  }
  for (const x of Array.isArray(extras) ? extras : []) {
    if (!x || typeof x.onPick !== 'function') continue;
    const label = frTypo(x.label || x.title);
    const t = h('button', { type: 'button', class: 'bl-pick-tile is-wide', 'data-id': x.id || null, 'aria-label': label },
      h('span', { class: 'bl-pick-ico', 'aria-hidden': 'true' }, x.icon),
      h('span', { class: 'bl-pick-t', 'aria-hidden': 'true' }, frTypo(x.title)));
    tile(t, label, () => { try { x.onPick(); } catch (e) { console.error(e); } });
    grid.appendChild(t);
  }
  const content = rest ? h('div', { class: 'bl-pick-wrap' }, h('p', { class: 'bl-rest' }, restTxt), grid) : grid;
  s = kit.sheet({
    title: frTypo(title), content, label: 'Choisis ton jeu',
    onClose: reason => { if (!['action', 'nav', 'api'].includes(reason) && typeof onCancel === 'function') onCancel(reason); }
  });
  if (s && s.el) motion.stagger(grid.children, el => motion.enter(el, { from: 'scale', dur: 320 }), 40);
  return s;
}

/* lance l'étape i de la balade du jour (jeu imposé, ou feuille de choix pour la récompense « au choix ») ;
   from = écran de retour (#/home, #/balade) ; replace = remplacer l'entrée d'historique (enchaînement depuis le bilan)
   → api de la feuille de choix, ou null */
export function launchStep(i, { from = '#/home', replace = false, onCancel = null, el = null } = {}) {
  const q = store.getProfile();
  const plan = q && q.today;
  const b = plan && Array.isArray(plan.blocks) ? plan.blocks[i] : null;
  if (!b || b.done) return null;
  /* temps de jeu du jour atteint (v2.4) : l'étape attendra demain ; on le dit gentiment (el = ce qui a été touché) */
  if (timeUp(q)) {
    restNotice(q, { el, kind: 'why' });
    if (typeof onCancel === 'function') onCancel('rest');
    return null;
  }
  const go = id => {
    ssSet(FROM_KEY, from);
    router.go('play/' + id, { query: { mode: 'balade', block: i }, replace });
  };
  if (!b.game) {
    const prev = i > 0 && plan.blocks[i - 1] ? plan.blocks[i - 1].game : null;
    return openGamePicker({ title: 'Choisis ton jeu 🎁', exclude: [prev, b.swapped], onPick: go, onCancel });
  }
  audio.whoosh();
  go(b.game);
  return null;
}
const depth = () => { try { return history.state && Number.isInteger(history.state.caramel) ? history.state.caramel : 0; } catch (_) { return 0; } };
function leaveHome() {
  if (depth() > 0) router.back();
  else router.go('home', { replace: true });
}

/* ---------- géométrie du pré (unités du viewBox) ---------- */
const VW = 360, VH = 560;
/* le compagnon se tient au FOND de la pierre de l'étape (pieds LIFT unités au-dessus de son centre) : l'emoji de
   l'étape (🌅 ⭐ 🔁 🎁, haut de l'emoji ≈ 11 unités au-dessus du centre) reste entièrement visible devant ses pattes,
   ombre comprise ; même décalage pendant la marche d'une pierre à l'autre */
const LIFT = 15;
function layoutFor(n) {
  const top = 112, bottom = 492;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const y = n > 1 ? top + (i * (bottom - top)) / (n - 1) : (top + bottom) / 2;
    pts.push({ x: i % 2 ? 252 : 108, y });
  }
  /* segments : entrée depuis l'horizon, puis S d'une pierre à l'autre (tangentes verticales), puis sortie */
  const segs = [];
  const C = (a, b) => {
    const k = (b.y - a.y) * 0.5;
    return 'C ' + a.x + ' ' + (a.y + k) + ', ' + b.x + ' ' + (b.y - k) + ', ' + b.x + ' ' + b.y;
  };
  const start = { x: 196, y: 58 };
  const first = pts[0] || { x: 180, y: 300 };
  const lead = 'M ' + start.x + ' ' + start.y + ' C ' + start.x + ' ' + (start.y + 26) + ', ' + first.x + ' ' + (first.y - 46) + ', ' + first.x + ' ' + first.y;
  for (let i = 0; i + 1 < pts.length; i++) segs.push('M ' + pts[i].x + ' ' + pts[i].y + ' ' + C(pts[i], pts[i + 1]));
  const last = pts[pts.length - 1] || first;
  const tail = 'M ' + last.x + ' ' + last.y + ' C ' + last.x + ' ' + (last.y + 40) + ', ' + (last.x - 30) + ' ' + (VH - 10) + ', ' + (last.x - 44) + ' ' + (VH + 30);
  const full = lead + ' ' + segs.map(s => s.replace(/^M [\d.]+ [\d.]+ /, '')).join(' ') + ' ' + tail.replace(/^M [\d.]+ [\d.]+ /, '');
  return { pts, segs, full };
}

/* décor du pré : ciel, collines, soleil, nuages, buissons, fleurs, mare, clôture (aplats de la palette) */
function scenery(n) {
  const S = svg;
  const g = S('g', { class: 'bl-deco', 'aria-hidden': 'true' });
  const defs = S('defs', null,
    S('linearGradient', { id: 'bl-sky', x1: '0', y1: '0', x2: '0', y2: '1' },
      S('stop', { offset: '0', 'stop-color': '#bae6fd' }), S('stop', { offset: '1', 'stop-color': '#e0f2fe' })),
    S('linearGradient', { id: 'bl-grass', x1: '0', y1: '0', x2: '0', y2: '1' },
      S('stop', { offset: '0', 'stop-color': '#86efac' }), S('stop', { offset: '1', 'stop-color': '#4ade80' })));
  g.append(defs,
    S('rect', { x: 0, y: 0, width: VW, height: 76, fill: 'url(#bl-sky)' }),
    S('circle', { cx: 318, cy: 30, r: 15, fill: '#fcd34d' }),
    S('circle', { cx: 318, cy: 30, r: 21, fill: '#fde68a', opacity: '.45' }),
    cloud(64, 30, 1), cloud(214, 20, 0.8),
    S('ellipse', { cx: 70, cy: 80, rx: 120, ry: 26, fill: '#bbf7d0' }),
    S('ellipse', { cx: 290, cy: 82, rx: 130, ry: 24, fill: '#bbf7d0' }),
    S('rect', { x: 0, y: 70, width: VW, height: VH - 70, fill: 'url(#bl-grass)' }),
    /* clôture au loin */
    fence(18, 74, 6), fence(262, 74, 5),
    /* mare */
    S('ellipse', { cx: 300, cy: 176, rx: 34, ry: 13, fill: '#7dd3fc' }),
    S('ellipse', { cx: 292, cy: 173, rx: 14, ry: 4, fill: '#e0f2fe', opacity: '.8' }),
    /* buissons */
    bush(30, 300), bush(334, 330), bush(36, 470), bush(330, 548), bush(176, 538),
    /* arbre */
    tree(42, 196), tree(322, 420));
  const flowers = [[150, 168, '#f472b6'], [178, 312, '#fbbf24'], [206, 186, '#fff'], [66, 362, '#f472b6'],
    [300, 266, '#fbbf24'], [196, 438, '#f472b6'], [86, 532, '#fff'], [272, 456, '#fff'], [146, 96, '#fbbf24']];
  for (const [x, y, c] of flowers) g.append(flower(x, y, c));
  return g;

  function cloud(x, y, s) {
    return S('g', { class: 'bl-cloud', transform: 'translate(' + x + ' ' + y + ') scale(' + s + ')', fill: '#fff' },
      S('ellipse', { cx: 0, cy: 6, rx: 24, ry: 9 }), S('circle', { cx: -8, cy: 0, r: 10 }), S('circle', { cx: 8, cy: -2, r: 12 }));
  }
  function fence(x, y, posts) {
    const f = S('g', { fill: '#fff7ed', stroke: '#4a2c1a', 'stroke-opacity': '.35', 'stroke-width': '1' });
    const w = (posts - 1) * 14;
    f.append(S('rect', { x, y: y - 9, width: w + 6, height: 3, rx: 1.5 }), S('rect', { x, y: y - 3, width: w + 6, height: 3, rx: 1.5 }));
    for (let i = 0; i < posts; i++) f.append(S('rect', { x: x + i * 14, y: y - 14, width: 6, height: 17, rx: 2 }));
    return f;
  }
  function bush(x, y) {
    return S('g', null,
      S('ellipse', { cx: x, cy: y + 9, rx: 24, ry: 6, fill: '#16a34a', opacity: '.18' }),
      S('circle', { cx: x - 12, cy: y, r: 11, fill: '#22c55e' }), S('circle', { cx: x + 10, cy: y + 1, r: 12, fill: '#22c55e' }),
      S('circle', { cx: x, cy: y - 7, r: 13, fill: '#4ade80' }), S('circle', { cx: x - 4, cy: y - 11, r: 4, fill: '#bbf7d0', opacity: '.7' }));
  }
  function tree(x, y) {
    return S('g', null,
      S('ellipse', { cx: x, cy: y + 30, rx: 22, ry: 6, fill: '#16a34a', opacity: '.2' }),
      S('rect', { x: x - 5, y: y + 4, width: 10, height: 26, rx: 4, fill: '#b45309' }),
      S('circle', { cx: x, cy: y - 8, r: 22, fill: '#22c55e' }), S('circle', { cx: x - 12, cy: y + 2, r: 13, fill: '#4ade80' }),
      S('circle', { cx: x + 12, cy: y + 1, r: 14, fill: '#4ade80' }), S('circle', { cx: x - 7, cy: y - 16, r: 6, fill: '#bbf7d0', opacity: '.75' }),
      S('circle', { cx: x + 8, cy: y - 4, r: 3, fill: '#f472b6' }), S('circle', { cx: x - 10, cy: y + 4, r: 3, fill: '#f472b6' }));
  }
  function flower(x, y, c) {
    const f = S('g', { transform: 'translate(' + x + ' ' + y + ')' });
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      f.append(S('circle', { cx: (Math.cos(a) * 3.6).toFixed(2), cy: (Math.sin(a) * 3.6).toFixed(2), r: 2.8, fill: c }));
    }
    f.append(S('circle', { cx: 0, cy: 0, r: 2.2, fill: c === '#fbbf24' ? '#fff7ed' : '#fbbf24' }));
    return f;
  }
}

/* ---------- écran ---------- */
let st = null;

export default {
  async mount(root) {
    const today = dayStr();
    let p = store.getProfile();
    if (!p) { router.go(store.listProfiles().length ? 'profiles' : 'onboarding', { replace: true }); return; }
    if (!p.classe) { router.go('welcome', { replace: true }); return; }
    await Promise.all([loadCSS('css/ui/balade.css'), mountReady()]);
    if (!root.isConnected) return;
    if (st) teardown();
    const my = st = { timers: new Set(), sheet: null, clip: null, anims: [], unsubs: [] };
    const later = (fn, ms) => { const t = setTimeout(() => { my.timers.delete(t); if (st === my) fn(); }, ms); my.timers.add(t); return t; };

    try { store.mutateProfile(pp => { ensureToday(pp, today); }); } catch (e) { console.error('Balade du jour', e); }
    p = store.getProfile();
    const plan = p.today;
    const blocks = plan && Array.isArray(plan.blocks) ? plan.blocks : [];
    const N = blocks.length;

    /* ----- barre du haut ----- */
    const back = h('button', { type: 'button', class: 'back', 'aria-label': 'Retour à l’accueil' }, '←');
    back.addEventListener('click', () => { audio.tap(); leaveHome(); });
    /* un seul titre : la durée (réglage des parents) ne sert pas à l'enfant */
    const top = h('div', { class: 'topbar bl-top' }, back,
      h('h1', { class: 'topbar-title' }, 'Ma balade du jour'),
      h('span', { class: 'bl-top-gap', 'aria-hidden': 'true' }));

    const screen = h('div', { class: 'screen bl' }, top);
    clear(root);
    root.appendChild(screen);

    if (!N) {
      screen.append(h('div', { class: 'card bl-empty' },
        h('p', { class: 'bl-empty-ico', 'aria-hidden': 'true' }, '🌤️'),
        h('p', { class: 'subtitle' }, frTypo('Pas de balade pour aujourd’hui : choisis un jeu sur l’accueil !')),
        h('button', { type: 'button', class: 'btn block', on: { click: leaveHome } }, 'Retour à l’accueil')));
      return;
    }

    /* ----- pré, sentier, pierres ----- */
    const L = layoutFor(N);
    const map = svg('svg', { class: 'bl-map', viewBox: '0 0 ' + VW + ' ' + VH, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true', focusable: 'false' });
    map.append(scenery(N),
      svg('path', { d: L.full, class: 'bl-path-edge' }),
      svg('path', { d: L.full, class: 'bl-path' }),
      svg('path', { d: L.full, class: 'bl-path-dots' }));
    const curIdx = plan.done ? N - 1 : Math.max(0, blocks.findIndex(b => !b.done));
    const stones = L.pts.map((pt, i) => {
      const info = stepInfo(p, plan, i);
      const state = blocks[i].done ? 'done' : (!plan.done && i === curIdx) ? 'now' : 'todo';
      const g = svg('g', { class: 'bl-stone is-' + state, transform: 'translate(' + pt.x + ' ' + pt.y + ')' },
        svg('ellipse', { class: 'bl-stone-halo', cx: 0, cy: 2, rx: 40, ry: 28 }),
        svg('ellipse', { class: 'bl-stone-shadow', cx: 0, cy: 7, rx: 31, ry: 19 }),
        svg('ellipse', { class: 'bl-stone-top', cx: 0, cy: 0, rx: 31, ry: 21 }),
        svg('ellipse', { class: 'bl-stone-shine', cx: -9, cy: -8, rx: 10, ry: 4.5 }),
        /* icône du jeu (la même que sous le bouton de l'accueil) ; ✓ quand l'étape est faite */
        svg('text', { class: 'bl-stone-emo', x: 0, y: 9, 'text-anchor': 'middle' }, blocks[i].done ? '✓' : info.icon));
      map.append(g);
      return g;
    });

    /* pierres : un petit jeu au toucher (HTML transparent par-dessus le pré, positions en % du viewBox), aucune
       étiquette à lire ; une pierre à venir ou déjà faite remue doucement, celle du jour lance l'étape comme « Jouer ▶ ».
       Hors du clavier et des lecteurs d'écran : « Jouer ▶ » reste LA seule action de l'écran, et la liste des étapes
       est lue une fois (stepsList, visuellement masquée) */
    const stepText = [];
    const labels = L.pts.map((pt, i) => {
      const info = stepInfo(p, plan, i);
      const b = blocks[i];
      const state = b.done ? 'done' : (!plan.done && i === curIdx) ? 'now' : 'todo';
      stepText.push('Étape ' + (i + 1) + ', ' + info.label + ' : ' + (info.title || 'jeu au choix') +
        (b.done ? ', terminée' : state === 'now' ? ', à faire maintenant' : ', plus tard'));
      const el = h('span', {
        class: 'bl-hit is-' + state, 'aria-hidden': 'true',
        style: { left: (pt.x / VW * 100).toFixed(2) + '%', top: (pt.y / VH * 100).toFixed(2) + '%' }
      });
      if (state === 'now') el.addEventListener('click', () => start(i));
      else el.addEventListener('click', () => {
        audio.tap();
        motion.shake(b.done ? el : (labels[curIdx] || el), { dist: 3, dur: 300 });
        if (!b.done) motion.squash(buddyPic, { amount: 0.8 });
      });
      return el;
    });

    const buddyPic = h('div', { class: 'bl-buddy-pic' });
    const buddy = h('div', { class: 'bl-buddy', 'aria-hidden': 'true' }, buddyPic);
    const scene = h('div', { class: 'bl-scene' }, map, ...labels, buddy);
    const stepsList = h('ol', { class: 'sr-only', 'aria-label': 'Les étapes de ta balade' }, ...stepText.map(t => h('li', null, frTypo(t))));

    /* ----- carte d'action ----- */
    const cta = h('section', { class: 'card bl-cta', 'aria-live': 'polite' });
    const layout = h('div', { class: 'bl-layout' }, scene, stepsList, cta);
    screen.appendChild(layout);

    const wide = () => { try { return matchMedia('(min-width: 900px)').matches; } catch (_) { return false; } };
    const buddySize = () => (wide() ? 86 : 66);
    const drawBuddy = mood => setAvatar(buddyPic, avatarOf(store.getProfile() || p, buddySize(), mood || ''));
    const placeBuddy = (i, face) => {
      const pt = L.pts[Math.max(0, Math.min(N - 1, i))];
      buddy.style.left = (pt.x / VW * 100) + '%';
      buddy.style.top = ((pt.y - LIFT) / VH * 100) + '%';
      if (face) buddyPic.classList.toggle('is-left', face < 0);
    };

    /* carte d'action : UN bouton (« Jouer ▶ ») ; balade finie : les deux récompenses, Accueil, et « encore un jeu ? » discret */
    function renderCta() {
      clear(cta);
      const q = store.getProfile() || p;
      /* temps de jeu du jour atteint (v2.4) : plus de nouveau jeu aujourd'hui, le compagnon se repose */
      const rest = timeUp(q);
      if (plan.done) {
        const streak = q.streak && q.streak.count ? q.streak.count : 0;
        cta.classList.add('is-done');
        cta.append(
          h('p', { class: 'bl-cta-kick' }, frTypo('Balade terminée ! 🎉')),
          h('div', { class: 'bl-prizes' },
            plan.rewarded ? h('span', { class: 'bl-prize' }, h('span', { 'aria-hidden': 'true' }, '🍎'), ' +10') : null,
            streak ? h('span', { class: 'bl-prize is-fire' }, h('span', { 'aria-hidden': 'true' }, '🔥 '),
              streak > 1 ? streak + ' jours de suite' : 'Premier jour de ta série') : null),
          h('div', { class: 'bl-cta-btns' },
            h('button', { type: 'button', class: 'btn play block bl-home', on: { click: () => { audio.tap(); leaveHome(); } } }, h('span', null, 'Accueil'), h('span', { class: 'btn-play-ico', 'aria-hidden': 'true' }, '🏠')),
            rest ? h('p', { class: 'bl-rest' }, restLine(q))
              : h('button', { type: 'button', class: 'btn ghost bl-more', on: { click: () => { audio.tap(); pickFree(); } } }, h('span', { 'aria-hidden': 'true' }, '🎲'), frTypo('Encore un jeu ?'))));
        return;
      }
      if (rest) {
        /* le gros bouton se repose aussi : grisé, « À demain ! », et dit pourquoi au toucher */
        const zz = h('button', { type: 'button', class: 'btn play block bl-go is-rest', 'aria-disabled': 'true', 'aria-label': restLine(q) },
          h('span', null, frTypo(REST_TEXT.button)), h('span', { class: 'btn-play-ico', 'aria-hidden': 'true' }, restKind() === 'nuit' ? '🌙' : '💤'));
        zz.addEventListener('click', () => restNotice(store.getProfile() || q, { el: zz, kind: 'why' }));
        cta.append(zz);
        return;
      }
      const go = h('button', { type: 'button', class: 'btn play block bl-go' },
        h('span', null, 'Jouer'), h('span', { class: 'btn-play-ico', 'aria-hidden': 'true' }, '▶'));
      go.addEventListener('click', () => start(curIdx));
      cta.append(go);
    }

    /* lancer l'étape i (jeu imposé, ou feuille de choix pour la récompense « au choix ») ; temps de jeu du jour
       atteint : launchStep le dit gentiment, rien ne démarre */
    function start(i) {
      const b = blocks[i];
      if (!b || b.done) return;
      if (!timeUp(store.getProfile() || p)) audio.tap();
      const s = launchStep(i, { from: '#/balade', el: labels[i] || null });
      if (s) my.sheet = s;
    }
    /* « encore un jeu ? » (balade finie) : partie libre, retour sur cette carte */
    function pickFree() {
      my.sheet = openGamePicker({ title: 'Encore un jeu ?', onPick: id => { ssSet(FROM_KEY, '#/balade'); router.go('play/' + id); } });
    }

    /* ----- position du compagnon, marche après un bloc terminé, fête ----- */
    let seen = null;
    try { seen = JSON.parse(ssGet(POS_KEY) || 'null'); } catch (_) { seen = null; }
    const target = plan.done ? N - 1 : curIdx;
    const from = seen && seen.p === p.id && seen.d === plan.d && Number.isInteger(seen.i) && seen.i < target ? seen.i : target;
    ssSet(POS_KEY, JSON.stringify({ p: p.id, d: plan.d, i: target }));
    const feteKey = p.id + '|' + plan.d;
    const party = plan.done && ssGet(FETE_KEY) !== feteKey;
    if (party) ssSet(FETE_KEY, feteKey);

    renderCta();
    /* temps de jeu du jour atteint (v2.4) : le compagnon dort sur sa pierre */
    const sleepy = () => timeUp(store.getProfile() || p);
    drawBuddy(sleepy() ? 'sleep' : '');
    placeBuddy(from, L.pts[Math.min(from + 1, N - 1)].x >= L.pts[from].x ? 1 : -1);
    motion.stagger([top, scene, cta], el => motion.enter(el, { from: 'bottom', dist: 12, dur: 400 }), 60);

    if (from < target) later(() => walk(from, target).then(arrived), 520);
    else later(arrived, 380);

    /* petit écran : la pierre du compagnon ne doit pas rester cachée sous la carte d'action collée en bas */
    function revealBuddy() {
      try {
        if (getComputedStyle(cta).position !== 'sticky') return;
        const over = buddy.getBoundingClientRect().bottom + 10 - cta.getBoundingClientRect().top;
        if (over > 0) window.scrollBy({ top: over, behavior: motion.reduced() ? 'auto' : 'smooth' });
      } catch (_) {}
    }
    function arrived() {
      if (st !== my) return;
      revealBuddy();
      if (plan.done && party) { dance(); return; }
      drawBuddy(sleepy() ? 'sleep' : plan.done ? 'joy' : '');
      motion.squash(buddyPic, { amount: 0.8 });
    }
    function dance() {
      drawBuddy('joy dance');
      const s = buddyPic.querySelector('svg');
      let animated = false;
      try { animated = !!s && getComputedStyle(s).animationName !== 'none'; } catch (_) {}
      if (!animated) { buddyPic.classList.remove('anim-dance'); void buddyPic.offsetWidth; buddyPic.classList.add('anim-dance'); }
      motion.confetti();
      audio.fanfare();
      const r = buddy.getBoundingClientRect();
      motion.burst(r.left + r.width / 2, r.top, { count: 22, spread: 90 });
      later(() => { buddyPic.classList.remove('anim-dance'); drawBuddy(sleepy() ? 'sleep' : 'joy'); }, 1700);
    }

    /* marche le long du sentier, de pierre en pierre (motion réduit : simple fondu à l'arrivée) */
    function walk(a, b) {
      return new Promise(resolve => {
        if (motion.reduced() || typeof buddy.animate !== 'function') {
          placeBuddy(b);
          motion.enter(buddy, { from: 'fade' });
          resolve();
          return;
        }
        const probe = svg('path', { d: '' });
        map.appendChild(probe);
        const frames = [];
        for (let k = a; k < b; k++) {
          probe.setAttribute('d', L.segs[k]);
          let len = 0;
          try { len = probe.getTotalLength(); } catch (_) { len = 0; }
          const steps = 18;
          for (let s = (k === a ? 0 : 1); s <= steps; s++) {
            let pt = null;
            try { pt = probe.getPointAtLength((len * s) / steps); } catch (_) { pt = null; }
            if (pt) frames.push({ left: (pt.x / VW * 100).toFixed(3) + '%', top: ((pt.y - LIFT) / VH * 100).toFixed(3) + '%' });
          }
        }
        probe.remove();
        if (frames.length < 2) { placeBuddy(b); resolve(); return; }
        const dur = 1300 * (b - a);
        const rig = drawBuddy('walk');
        buddyPic.classList.toggle('is-left', L.pts[b].x < L.pts[a].x);
        try { if (my.clip) my.clip.stop(); } catch (_) {}
        my.clip = audio.clipClop();
        let anim = null;
        try {
          anim = buddy.animate(frames, { duration: dur, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
          my.anims.push(anim, ...walkHops(rig, dur));
        } catch (_) {}
        const done = () => {
          if (st !== my) return;
          try { if (my.clip) my.clip.stop(); } catch (_) {}
          my.clip = null;
          placeBuddy(b);
          try { if (anim) anim.cancel(); } catch (_) {}
          buddyPic.classList.toggle('is-left', false);
          resolve();
        };
        if (anim) anim.finished.then(done, done); else done();
        later(done, dur + 600);
      });
    }
    /* petits bonds de la marche (7 px à l'écran, 330 ms) : c'est le CORPS du rig qui bondit (.c-all, composition « add »
       sur le pas de l'humeur walk, en unités du viewBox : 100 unités = largeur du compagnon), jamais un conteneur qui
       emporterait l'ombre et la vague ; l'ombre reste sur le sentier et rétrécit en l'air (comme au petit saut du rig),
       la vague du dauphin reste dans l'eau (ARCHITECTURE §8.6, JEUX §0) */
    function walkHops(rig, dur) {
      const body = rig && rig.querySelector('.c-all');
      if (!body || typeof body.animate !== 'function') return [];
      const H = (7 * 100) / buddySize(), k = Math.min(1, H / 11);
      const timing = { duration: 330, iterations: Math.max(1, Math.round(dur / 330)), easing: 'ease-in-out' };
      const hops = [body.animate([{ transform: 'translateY(0px)' }, { transform: 'translateY(' + (-H).toFixed(2) + 'px)' }, { transform: 'translateY(0px)' }],
        { ...timing, composite: 'add' })];
      const shadow = rig.getAttribute('data-species') !== 'dolphin' ? rig.querySelector('.c-shadow') : null;
      if (shadow) {
        hops.push(shadow.animate([{ transform: 'scale(1)', opacity: 1 },
          { transform: 'scale(' + (1 - 0.3 * k).toFixed(2) + ')', opacity: +(1 - 0.4 * k).toFixed(2) },
          { transform: 'scale(1)', opacity: 1 }], timing));
      }
      return hops;
    }

    /* redimensionnement (tablette tournée, fenêtre PC) : taille du compagnon */
    let wasWide = wide();
    const onResize = () => { if (wide() !== wasWide) { wasWide = wide(); drawBuddy(sleepy() ? 'sleep' : plan.done ? 'joy' : ''); } };
    window.addEventListener('resize', onResize);
    my.unsubs.push(() => window.removeEventListener('resize', onResize));
  },

  unmount() { teardown(); }
};

function teardown() {
  const my = st;
  st = null;
  if (!my) return;
  for (const t of my.timers) clearTimeout(t);
  for (const a of my.anims) { try { a.cancel(); } catch (_) {} }
  try { if (my.clip) my.clip.stop(); } catch (_) {}
  try { if (my.sheet) my.sheet.close('api'); } catch (_) {}
  for (const u of my.unsubs) { try { u(); } catch (_) {} }
}
