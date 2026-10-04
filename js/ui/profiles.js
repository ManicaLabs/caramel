/* ============ « QUI JOUE AUJOURD'HUI ? » : sélecteur de profils (JEUX.md §8, CDC §10.1) ============
   Un seul geste attendu : toucher son compagnon. Grandes cartes (compagnon + prénom, rien d'autre à lire),
   toucher → profil actif (store.setActive), mémorisé pour la session (sessionStorage['caramel-picked']) ;
   les réglages du profil (son, animations) sont réappliqués par main.js à chaque commit du store.
   En bas, discrets : « ➕ Ajouter » → #/onboarding ; dès deux enfants, « 🏆 En famille » → #/famille.
   UN SEUL composant « carte enfant » (kidCard, kidActions, styles dans css/ui/profiles.css) pour cet écran et pour la
   feuille « Qui joue ? » de l'accueil (js/ui/home.js) : compagnon + prénom aux couleurs du thème DE L'ENFANT
   (data-theme, pastille du thème), « ✓ En jeu » sur l'enfant actif de la feuille, mêmes boutons discrets. */

import { h, clear, frTypo, loadCSS } from '../core/util.js';
import * as store from '../core/store.js';
import * as router from '../router.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import { mountReady, avatarOf, setAvatar } from './companion.js';
import { themeOf } from '../core/themes.js';

const PICKED_KEY = 'caramel-picked';
const FROM_KEY = 'caramel-profiles-from';
const ssGet = k => { try { return sessionStorage.getItem(k); } catch (_) { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) {} };
const ssDel = k => { try { sessionStorage.removeItem(k); } catch (_) {} };
const depth = () => { try { return history.state && Number.isInteger(history.state.caramel) ? history.state.caramel : 0; } catch (_) { return 0; } };

let st = null;

/* ---------- carte enfant (partagée avec la feuille « Qui joue ? » de l'accueil) ---------- */
/* compagnon + prénom, rien d'autre à lire ; la carte prend les couleurs du thème de l'enfant (data-theme) ;
   current : enfant actif (« ✓ En jeu », sur le bord haut de la carte : il ne cache jamais les oreilles, la corne ou la
   couronne d'un grand compagnon) ; onPick(carte, élément du compagnon) */
export function kidCard(q, { current = false, index = 0, size = 96, onPick } = {}) {
  const th = themeOf(q && q.settings && q.settings.theme);
  const pic = h('span', { class: 'kid-pic' });
  /* phase : les compagnons ne respirent pas en chœur */
  setAvatar(pic, avatarOf(q, size, '', { expr: current ? 'happy' : 'neutral', phase: index * 1.3 }));
  const card = h('button', {
    type: 'button', class: 'kid-card' + (current ? ' is-current' : ''), 'data-theme': th.id, 'data-id': q.id,
    'aria-current': current ? 'true' : null, 'aria-label': q.name + (current ? ', en train de jouer' : '')
  },
  current ? h('span', { class: 'kid-now', 'aria-hidden': 'true' }, '✓ En jeu') : null,
  h('span', { class: 'kid-stage', 'aria-hidden': 'true' }, pic, th.sticker ? h('span', { class: 'kid-sticker' }, th.sticker) : null),
  h('span', { class: 'kid-name', 'aria-hidden': 'true' }, q.name));
  if (typeof onPick === 'function') card.addEventListener('click', () => onPick(card, pic));
  return card;
}
/* boutons discrets sous les cartes : « ➕ Ajouter » (un enfant) et, dès deux enfants, « 🏆 En famille » */
export function kidActions(count, { onAdd, onFamily } = {}) {
  const btn = (icon, text, name, fn) => {
    const b = h('button', { type: 'button', class: 'kid-act', 'aria-label': frTypo(name) },
      h('span', { class: 'kid-act-ico', 'aria-hidden': 'true' }, icon), h('span', { 'aria-hidden': 'true' }, text));
    if (typeof fn === 'function') b.addEventListener('click', fn);
    return b;
  };
  return h('div', { class: 'kid-actions' },
    btn('➕', 'Ajouter', 'Ajouter un enfant', onAdd),
    count >= 2 ? btn('🏆', 'En famille', 'En famille : défi, classements et concours de compagnons', onFamily) : null);
}

export default {
  async mount(root) {
    await Promise.all([loadCSS('css/ui/profiles.css'), mountReady()]);
    if (!root.isConnected) return;
    const list = store.listProfiles();
    if (!list.length) { router.go('onboarding', { replace: true }); return; }
    const my = st = { busy: false, timer: 0 };
    const fromHome = ssGet(FROM_KEY) === '#/home' && depth() > 0;

    const back = h('button', { type: 'button', class: 'back pf-back', 'aria-label': 'Retour' }, '←');
    back.addEventListener('click', () => { audio.tap(); ssDel(FROM_KEY); router.back(); });
    back.hidden = !fromHome;

    const grid = h('div', { class: 'kid-grid is-screen' + (list.length === 1 ? ' is-one' : ''), role: 'group', 'aria-label': 'Les enfants' });
    list.forEach((p, i) => grid.appendChild(kidCard(p, { index: i, size: 112, onPick: c => pick(p.id, c) })));
    const more = kidActions(list.length, {
      onAdd: () => { audio.tap(); router.go('onboarding'); },
      onFamily: () => { audio.tap(); router.go('famille'); }      /* défi, classements de la semaine, concours */
    });
    const screen = h('div', { class: 'screen pf' },
      h('div', { class: 'pf-top' }, back),
      h('header', { class: 'pf-head' },
        h('h1', { class: 'title-xl pf-title' }, frTypo('Qui joue ?'))),
      grid, more);
    clear(root);
    root.appendChild(screen);
    motion.stagger([screen.querySelector('.pf-head'), ...grid.children, more].filter(Boolean),
      el => motion.enter(el, { from: el.classList.contains('kid-card') ? 'scale' : 'bottom', dur: 420 }), 70);

    function pick(id, el) {
      if (my.busy || st !== my) return;
      my.busy = true;
      store.setActive(id);                        /* commit → main.js réapplique son et animations */
      ssSet(PICKED_KEY, id);
      audio.neigh();
      const svgEl = el.querySelector('.kid-pic svg');
      const q = store.getProfile(id);
      if (svgEl && q) setAvatar(el.querySelector('.kid-pic'), avatarOf(q, 112, 'joy'));
      motion.pop(el, { scale: 1.06 });
      for (const other of grid.children) if (other !== el) other.classList.add('is-dim');
      const target = q && !q.classe ? 'welcome' : 'home';
      my.timer = setTimeout(() => {
        my.timer = 0;
        if (st !== my) return;
        if (target === 'home' && fromHome) { ssDel(FROM_KEY); router.back(); }
        else router.go(target, { replace: true });
      }, motion.reduced() ? 120 : 420);
    }
  },

  unmount() {
    const my = st;
    st = null;
    if (my && my.timer) clearTimeout(my.timer);
  }
};
