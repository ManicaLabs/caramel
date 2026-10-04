/* ============ THÈMES : application à la page + sélecteur réutilisable ============
   Application (appelée par main.js à chaque changement du profil actif ou de ses réglages) :
     applyTheme(id)              thème du profil : html[data-theme], <meta name="theme-color">, emojis des
                                 confettis (motion.setTheme), mémorisé pour le prochain démarrage
                                 (localStorage 'caramel-theme' = 'id|#couleur', lu par index.html avant
                                 le premier affichage : pas d'éclair de l'ancien thème)
     previewTheme(id) / endPreview()   aperçu temporaire (nouvel enfant pas encore créé) ; endPreview rend
                                 le thème du profil
     swapTheme(fn, animate)      exécute fn (qui change le thème) dans un fondu enchaîné de tout l'écran
                                 (transition de vue), ou directement en mouvement réduit
   Sélecteur :
     themeGrid({ value, onPick(id, card), compact, label }) → { el, set(id), value() }
        8 cartes d'aperçu ; chaque carte porte data-theme="…" et s'habille donc de SES jetons
        (fond, motif, bouton, pastille, titre), quel que soit le thème de la page.
        Groupe radio accessible (flèches, Origine/Fin), cibles ≥ 48 px.
     openThemeSheet({ profileId }) → feuille du kit « Choisis ton univers » : toucher une carte change tout
        de suite le thème du profil (store.mutateProfile → main.js l'applique), avec des confettis du thème.
   Les couleurs vivent dans css/themes.css ; le catalogue (noms, emojis) dans js/core/themes.js. */

import { h, frTypo } from '../core/util.js';
import * as store from '../core/store.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import * as kit from './kit.js';
import { THEMES, DEFAULT_THEME, normalizeTheme, themeOf } from '../core/themes.js';

const CACHE_KEY = 'caramel-theme';
const G = globalThis;

let base = null;        /* thème du profil actif */
let preview = null;     /* aperçu en cours (onboarding), prioritaire */
let shown = null;       /* thème réellement affiché */

function paint(id) {
  const t = themeOf(id);
  if (shown === t.id) return t.id;
  shown = t.id;
  const d = G.document;
  if (!d) return t.id;
  try { d.documentElement.setAttribute('data-theme', t.id); } catch (_) {}
  try { const m = d.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t.bar); } catch (_) {}
  try { motion.setTheme({ confetti: t.party }); } catch (_) {}
  return t.id;
}

/* thème du profil actif (main.js) → id appliqué */
export function applyTheme(id) {
  base = normalizeTheme(id);
  try { G.localStorage.setItem(CACHE_KEY, base + '|' + themeOf(base).bar); } catch (_) {}
  paint(preview || base);
  return base;
}
/* aperçu (sans rien enregistrer) */
export function previewTheme(id, { animate = true } = {}) {
  preview = normalizeTheme(id);
  swapTheme(() => paint(preview), animate);
  return preview;
}
export function endPreview() {
  if (preview === null) return;
  preview = null;
  paint(base || DEFAULT_THEME);
}
export function shownTheme() { return shown || base || DEFAULT_THEME; }

/* fondu enchaîné de tout l'écran autour d'un changement de thème */
export function swapTheme(fn, animate = true) {
  const d = G.document;
  let vt = null;
  try {
    if (animate && d && typeof d.startViewTransition === 'function' && !motion.reduced() && d.visibilityState !== 'hidden') {
      d.documentElement.classList.add('theme-swap');
      vt = d.startViewTransition(() => { fn(); });
    }
  } catch (_) { vt = null; }
  if (!vt) {
    try { if (d) d.documentElement.classList.remove('theme-swap'); } catch (_) {}
    fn();
    return Promise.resolve();
  }
  const done = () => { try { d.documentElement.classList.remove('theme-swap'); } catch (_) {} };
  if (vt.ready) vt.ready.catch(() => {});
  const fin = vt.finished ? vt.finished.catch(() => {}) : Promise.resolve();
  fin.then(done, done);
  return vt.updateCallbackDone ? vt.updateCallbackDone.catch(() => {}) : Promise.resolve();
}

/* ============ GRILLE DES 8 THÈMES ============ */
export function themeGrid({ value, onPick, compact = false, label = 'Thèmes' } = {}) {
  let cur = normalizeTheme(value);
  const grid = h('div', { class: 'tp-grid' + (compact ? ' is-compact' : ''), role: 'radiogroup', 'aria-label': label });
  const cards = THEMES.map(t => h('button', {
    type: 'button', role: 'radio', class: 'tp-card', 'data-theme': t.id, 'data-theme-id': t.id,
    'aria-checked': 'false', 'aria-label': t.name + ' : ' + t.blurb, title: t.blurb
  },
  h('span', { class: 'tp-swatch', 'aria-hidden': 'true' },
    h('span', { class: 'tp-emoji' }, t.emoji),
    h('span', { class: 'tp-mock' },
      h('i', { class: 'tp-mock-line' }), h('i', { class: 'tp-mock-chip' }), h('i', { class: 'tp-mock-btn' }))),
  h('span', { class: 'tp-name', 'aria-hidden': 'true' }, t.name),
  h('span', { class: 'tp-check', 'aria-hidden': 'true' }, '✓')));
  grid.append(...cards);

  function set(id) {
    cur = normalizeTheme(id);
    for (const c of cards) {
      const on = c.dataset.themeId === cur;
      c.setAttribute('aria-checked', on ? 'true' : 'false');
      c.tabIndex = on ? 0 : -1;
    }
  }
  function pick(card) {
    const id = card.dataset.themeId;
    const was = cur;
    set(id);
    motion.pop(card, { scale: 1.06 });
    if (id !== was) {
      try { if (typeof onPick === 'function') onPick(id, card); } catch (e) { console.error(e); }
    }
  }
  grid.addEventListener('click', e => {
    const c = e.target.closest && e.target.closest('.tp-card');
    if (c && grid.contains(c)) pick(c);
  });
  /* groupe radio : les flèches déplacent le choix (et l'appliquent), Origine / Fin aux extrémités */
  grid.addEventListener('keydown', e => {
    const i = cards.findIndex(c => c.dataset.themeId === cur);
    let j = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % cards.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + cards.length) % cards.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = cards.length - 1;
    if (j < 0) return;
    e.preventDefault();
    try { cards[j].focus(); } catch (_) {}
    pick(cards[j]);
  });
  set(cur);
  return { el: grid, set, value: () => cur };
}

/* petite fête aux couleurs du thème choisi */
export function cheerTheme(id, card) {
  const t = themeOf(id);
  try { audio.success(3); } catch (_) {}
  try { if (card) motion.burst(card, { emojis: t.party.slice(0, 3), count: 10, spread: 70, dur: 800 }); } catch (_) {}
}

/* ============ FEUILLE « CHOISIS TON UNIVERS » (accueil) ============ */
export function openThemeSheet({ profileId } = {}) {
  const p = store.getProfile(profileId);
  if (!p) return null;
  const pid = p.id;
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const grid = themeGrid({
    value: p.settings && p.settings.theme,
    label: 'Choisis ton univers',
    onPick: (id, card) => {
      swapTheme(() => store.mutateProfile(q => {
        if (!q.settings || typeof q.settings !== 'object') q.settings = {};
        q.settings.theme = id;
      }, pid));
      cheerTheme(id, card);
      live.textContent = 'Thème ' + themeOf(id).name;
    }
  });
  const content = h('div', { class: 'tp-sheet' },
    h('p', { class: 'tp-sub' }, frTypo('Touche une carte : tout Caramel change de couleurs. Tu peux en changer quand tu veux !')),
    grid.el, live);
  return kit.sheet({
    title: frTypo('Choisis ton univers 🎨'), content,
    actions: [{ label: frTypo('C’est parfait ! ✓') }]
  });
}
