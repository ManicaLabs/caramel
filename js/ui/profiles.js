/* ============ « QUI JOUE AUJOURD'HUI ? » : sélecteur de profils (JEUX.md §8, CDC §10.1) ============
   Grandes cartes (compagnon + prénom + 🍎), toucher → profil actif (store.setActive), mémorisé pour la
   session (sessionStorage['caramel-picked']) ; les réglages du profil (son, animations) sont réappliqués
   par main.js à chaque commit du store. « ➕ Ajouter un enfant » → #/onboarding ; dès deux enfants,
   « 🏆 En famille » → #/famille (défi, classements de la semaine, concours de compagnons). */

import { h, clear, frTypo, loadCSS, fmtNum } from '../core/util.js';
import * as store from '../core/store.js';
import * as router from '../router.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import { mountReady, avatarOf, setAvatar } from './companion.js';

const PICKED_KEY = 'caramel-picked';
const FROM_KEY = 'caramel-profiles-from';
const ssGet = k => { try { return sessionStorage.getItem(k); } catch (_) { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) {} };
const ssDel = k => { try { sessionStorage.removeItem(k); } catch (_) {} };
const depth = () => { try { return history.state && Number.isInteger(history.state.caramel) ? history.state.caramel : 0; } catch (_) { return 0; } };

let st = null;

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

    const grid = h('div', { class: 'pf-grid' + (list.length === 1 ? ' is-one' : '') });
    list.forEach((p, i) => grid.appendChild(card(p, i)));
    const add = h('button', { type: 'button', class: 'pf-add' },
      h('span', { class: 'pf-add-ico', 'aria-hidden': 'true' }, '➕'), h('span', null, 'Ajouter un enfant'));
    add.addEventListener('click', () => { audio.tap(); router.go('onboarding'); });
    /* « En famille » (dès deux enfants) : défi, classements de la semaine, concours de compagnons */
    const family = list.length >= 2 ? h('button', { type: 'button', class: 'pf-family' },
      h('span', { class: 'pf-family-ico', 'aria-hidden': 'true' }, '🏆'),
      h('span', { class: 'pf-family-txt' }, h('b', null, 'En famille'),
        h('span', null, frTypo('Défi, classements et concours de compagnons')))) : null;
    if (family) family.addEventListener('click', () => { audio.tap(); router.go('famille'); });

    const screen = h('div', { class: 'screen pf' },
      h('div', { class: 'pf-top' }, back),
      h('header', { class: 'pf-head' },
        h('h1', { class: 'title-xl pf-title' }, frTypo('Qui joue aujourd’hui ?')),
        h('p', { class: 'subtitle pf-sub' }, 'Touche ton compagnon pour commencer.')),
      grid, add, family);
    clear(root);
    root.appendChild(screen);
    motion.stagger([screen.querySelector('.pf-head'), ...grid.children, add, family].filter(Boolean),
      el => motion.enter(el, { from: el.classList.contains('pf-card') ? 'scale' : 'bottom', dur: 420 }), 70);

    function card(p, i = 0) {
      const pic = h('span', { class: 'pf-pic' });
      setAvatar(pic, avatarOf(p, 116, '', { phase: i * 1.3 }));   /* phase : les compagnons ne respirent pas en chœur */
      const apples = (p.wallet && p.wallet.apples) | 0;
      const c = h('button', { type: 'button', class: 'pf-card', 'data-id': p.id,
        'aria-label': p.name + ', ' + apples + ' pomme' + (apples > 1 ? 's' : '') },
      h('span', { class: 'pf-stage', 'aria-hidden': 'true' }, pic),
      h('span', { class: 'pf-name' }, p.name),
      h('span', { class: 'pf-info', 'aria-hidden': 'true' }, '🍎 ' + fmtNum(apples)));
      c.addEventListener('click', () => pick(p.id, c));
      return c;
    }

    function pick(id, el) {
      if (my.busy || st !== my) return;
      my.busy = true;
      store.setActive(id);                        /* commit → main.js réapplique son et animations */
      ssSet(PICKED_KEY, id);
      audio.neigh();
      const svgEl = el.querySelector('.pf-pic svg');
      const q = store.getProfile(id);
      if (svgEl && q) setAvatar(el.querySelector('.pf-pic'), avatarOf(q, 116, 'joy'));
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
