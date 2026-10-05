/* ============ EN-TÊTE COMMUN DES JEUX ============
   « Un seul gros bouton » : UNE ligne, rien à lire — ← retour · pastilles de progression (au centre) · 🔊 · joker 💡.
   🔊 (js/ui/voice.js) : relit la dernière chose que le compagnon a dite (la question, l'indice, l'explication) ; caché
   tant que le jeu ne lui a rien confié (setLine) et quand la lecture à voix haute est réglée sur Non (voice.listenOn).
   Le titre du jeu reste le titre de la page (h1 masqué, lu par les lecteurs d'écran ; la scène dit le jeu).
   Les 🍎 gagnées ne s'affichent plus ici (le bilan les compte) : la pomme d'une bonne réponse vole dans la
   pastille de la question (applesEl), qui devient verte.
   Utilisé par la coquille de jeu (js/ui/game-shell.js) et par le banc d'essai (tests/harness/game.html). */
import { h, clear } from '../core/util.js';
import { listenButton } from './voice.js';

export function createHeader({ icon = '🎲', title = '', short = '', hints = 2, onBack, onJoker } = {}) {
  const back = h('button', { class: 'back', type: 'button', 'aria-label': 'Retour', on: { click: () => onBack && onBack() } }, '←');
  /* titre : masqué à l'écran (gh-long / gh-short gardés pour les écrans qui voudraient l'afficher) */
  const titleText = h('span', { class: 'gh-text gh-long' }, title);
  const shortText = h('span', { class: 'gh-text gh-short' }, short || title);
  const titleEl = h('h1', { class: 'gh-title sr-only' }, h('span', { class: 'gh-icon', 'aria-hidden': 'true' }, icon), titleText);
  const jokerN = h('span', { class: 'gh-badge', 'aria-hidden': 'true' }, String(hints));
  const joker = h('button', { class: 'gh-joker', type: 'button', 'aria-label': 'Joker : demander un indice',
    on: { click: () => onJoker && onJoker() } }, h('span', { 'aria-hidden': 'true' }, '💡'), jokerN);
  /* compteur de la partie : gardé (masqué) pour l'API setApples ; lu d'un seul tenant (« 3 pommes gagnées »), sans
     zone d'annonce : chaque retour est déjà annoncé une fois par le jeu (D2-09) */
  const applesN = h('span', { class: 'gh-apples-n', 'aria-hidden': 'true' }, '0');
  const apples = h('div', { class: 'gh-apples sr-only', role: 'img', 'aria-label': 'Aucune pomme gagnée dans cette partie' },
    h('span', { 'aria-hidden': 'true' }, '🍎'), applesN);
  const dots = h('div', { class: 'dots gh-dots', role: 'img', 'aria-label': '' });
  const counter = h('div', { class: 'gh-counter hidden' });
  const sink = h('span', { class: 'gh-sink', 'aria-hidden': 'true' });      /* cible des 🍎 quand il n'y a pas de pastilles */
  const mid = h('div', { class: 'gh-mid' }, dots, counter, sink);
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite' });
  let line = '';
  const listen = listenButton(() => line, { label: 'Écouter encore' });
  listen.classList.add('gh-listen');
  listen.hidden = true;
  const el = h('header', { class: 'game-header' },
    h('div', { class: 'gh-row' }, back, mid, listen, joker), titleEl, apples, live);

  let shownApples = 0;
  const shown = e => { try { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; } catch (_) { return false; } };
  return {
    el, jokerEl: joker,
    /* cible des 🍎 qui volent : la pastille qui vient d'être remplie (les jeux font voler la pomme juste après
       ctx.report), sinon celle de la question en cours, sinon le centre de l'en-tête */
    get applesEl() {
      const d = [...dots.querySelectorAll('.dot.done, .dot.helped')].pop() || dots.querySelector('.dot.now');
      if (d && shown(d)) return d;
      return shown(counter) ? counter : sink;
    },
    setTitle(t, sh) { titleText.textContent = t; shortText.textContent = sh || t; },
    setHints(n) {
      jokerN.textContent = String(Math.max(0, n));
      joker.classList.toggle('empty', n <= 0);
      joker.setAttribute('aria-disabled', n <= 0 ? 'true' : 'false');
    },
    setApples(n) {
      if (n === shownApples) return;
      applesN.textContent = String(n);
      apples.setAttribute('aria-label', n > 0 ? n + (n > 1 ? ' pommes gagnées' : ' pomme gagnée') + ' dans cette partie' : 'Aucune pomme gagnée dans cette partie');
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
      dots.setAttribute('aria-label', 'Question ' + Math.min(i + 1, n) + ' sur ' + n);
      clear(dots);
      for (let k = 0; k < n; k++) {
        dots.appendChild(h('span', { class: ['dot', states[k], k === i ? 'now' : ''].filter(Boolean).join(' ') }));
      }
    },
    announce(text) { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); },
    /* phrase que 🔊 relit ; show = la lecture à voix haute est activée pour cet enfant (sinon le bouton reste caché) */
    setLine(text, show) {
      line = String(text || '');
      listen.hidden = !(show && line);
      el.classList.toggle('has-listen', !listen.hidden);      /* pastilles resserrées : tout tient sur une ligne */
    },
    destroy() {}
  };
}
