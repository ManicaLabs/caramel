/* ============ EN-TÊTE COMMUN DES JEUX ============
   ← retour · icône + titre · joker 💡 (compteur) · 🍎 gagnées dans la manche · pastilles de progression.
   Utilisé par la coquille de jeu (js/ui/game-shell.js) et par le banc d'essai (tests/harness/game.html). */
import { h, clear } from '../core/util.js';
import * as motion from '../core/motion.js';

export function createHeader({ icon = '🎲', title = '', short = '', hints = 2, onBack, onJoker } = {}) {
  const back = h('button', { class: 'back', type: 'button', 'aria-label': 'Retour', on: { click: () => onBack && onBack() } }, '←');
  /* titre complet ; titre court (registre : game.short) affiché sur les écrans étroits (css/ui/game.css) */
  const titleText = h('span', { class: 'gh-text gh-long' }, title);
  const shortText = h('span', { class: 'gh-text gh-short' }, short || title);
  const titleEl = h('div', { class: 'gh-title' }, h('span', { class: 'gh-icon', 'aria-hidden': 'true' }, icon), titleText, shortText);
  const jokerN = h('span', { class: 'gh-badge', 'aria-hidden': 'true' }, String(hints));
  const joker = h('button', { class: 'gh-joker', type: 'button', 'aria-label': 'Joker : demander un indice',
    on: { click: () => onJoker && onJoker() } }, h('span', { 'aria-hidden': 'true' }, '💡'), jokerN);
  const applesN = h('span', { class: 'gh-apples-n' }, '0');
  const apples = h('div', { class: 'gh-apples', role: 'status', 'aria-label': 'Pommes gagnées dans cette manche' },
    h('span', { 'aria-hidden': 'true' }, '🍎'), applesN);
  const dots = h('div', { class: 'dots gh-dots', 'aria-hidden': 'true' });
  const counter = h('div', { class: 'gh-counter hidden' });
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite' });
  const el = h('header', { class: 'game-header' },
    h('div', { class: 'gh-row' }, back, titleEl, joker, apples), dots, counter, live);

  let shownApples = 0;
  return {
    el, applesEl: apples, jokerEl: joker,
    setTitle(t, sh) { titleText.textContent = t; shortText.textContent = sh || t; },
    setHints(n) {
      jokerN.textContent = String(Math.max(0, n));
      joker.classList.toggle('empty', n <= 0);
      joker.setAttribute('aria-disabled', n <= 0 ? 'true' : 'false');
    },
    setApples(n) {
      if (n === shownApples) return;
      motion.countUp(applesN, shownApples, n, 300);
      shownApples = n;
    },
    /* i = item en cours (0…n−1, ou n quand tout est fini) ; states[k] = 'done' | 'helped' pour les items terminés */
    setProgress(i, n, states = []) {
      if (n === 0 && !states.filter(Boolean).length) {   /* aucune pastille (course…) : tout masquer */
        dots.classList.add('hidden'); counter.classList.add('hidden');
        return;
      }
      if (!n || n > 16) {                    /* sprint ou manche ouverte : simple compteur */
        dots.classList.add('hidden');
        counter.classList.remove('hidden');
        counter.textContent = n > 16 ? (Math.min(i + 1, n) + ' / ' + n) : String(states.filter(Boolean).length);
        return;
      }
      counter.classList.add('hidden');
      dots.classList.remove('hidden');
      clear(dots);
      for (let k = 0; k < n; k++) {
        dots.appendChild(h('span', { class: ['dot', states[k], k === i ? 'now' : ''].filter(Boolean).join(' ') }));
      }
    },
    announce(text) { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); },
    destroy() {}
  };
}
