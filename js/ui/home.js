/* ============ ACCUEIL (JEUX.md §8) ============
   En-tête (compagnon, « Bonjour {P} ! », changer d'enfant, porte-monnaie ⭐ 🍎 🔥) · bandeau « Je passe en … ! »
   · carte du compagnon (js/ui/companion.js) · carte « Ma balade du jour » · grille « Mes jeux »
   · « Mes progrès 📈 » · rappels quotidiens · pied (espace parents, crédits v11, version, moteur vocal).
   Lecture : store.getProfile() ; écriture : store.mutateProfile uniquement (plan du jour, classe).
   Les blocs se mettent à jour en place à chaque changement du store (aucune reconstruction de l'écran). */

import { h, clear, dayStr, frTypo, loadCSS } from '../core/util.js';
import * as store from '../core/store.js';
import * as router from '../router.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import * as kit from './kit.js';
import * as notifs from '../core/notifs.js';
import * as speech from '../core/speech.js';
import { fillTemplate, offerNextClasse, setClasse } from '../core/profiles.js';
import { ensureToday } from '../core/session.js';
import { gamesFor, GAME_BY_ID } from '../games/index.js';
import { totalStarsOf } from '../content/stories/index.js';
import { MOUNTS } from '../content/companion-data.js';
import { renderCompanionCard, mountReady, avatarOf, setAvatar } from './companion.js';
import { stepInfo } from './balade.js';

/* liens v11 (crédits) */
const LINKEDIN_PROFILE = 'https://www.linkedin.com/in/cedric-delalande-57bb7860/';
const FEEDBACK_URL = 'https://www.linkedin.com/posts/cedric-delalande-57bb7860_ia-edtech-aezducation-share-7485434729584902144-3tnJ/';

const VT_NAME = 'vt-game-icon';
const FROM_KEY = 'caramel-play-from';
const ssGet = k => { try { return sessionStorage.getItem(k); } catch (_) { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) {} };

let st = null;   /* état de l'écran monté */

function version() {
  try { const m = document.querySelector('meta[name="caramel-version"]'); return (m && m.content) || ''; } catch (_) { return ''; }
}
const canVT = () => { try { return typeof document.startViewTransition === 'function' && !motion.reduced(); } catch (_) { return false; } };

export default {
  async mount(root, params, query) {
    const today = dayStr();
    let p = store.getProfile();
    if (!p) { router.go(store.listProfiles().length ? 'profiles' : 'onboarding', { replace: true }); return; }
    if (!p.classe) { router.go('welcome', { replace: true }); return; }
    await Promise.all([loadCSS('css/ui/home.css'), loadCSS('css/ui/companion.css'), mountReady()]);
    if (!root.isConnected) return;                    /* on est déjà reparti ailleurs pendant le chargement */
    teardown();
    p = store.getProfile();
    if (!p || !p.classe) return;
    const my = st = { root, timers: new Set(), unsubs: [], card: null, sheet: null, today };

    /* plan du jour (recalculé s'il manque, date d'un autre jour ou n'est plus valable) */
    try { store.mutateProfile(pp => { ensureToday(pp, today); }); } catch (e) { console.error('Balade du jour', e); }

    /* ----- en-tête ----- */
    const ava = h('span', { class: 'hm-ava', 'aria-hidden': 'true' });
    const hello = h('h1', { class: 'hm-hello' });
    const sub = h('p', { class: 'hm-sub' });
    const switchBtn = h('button', { type: 'button', class: 'chip hm-switch', 'aria-label': 'Changer d’enfant', title: 'Changer d’enfant' },
      h('span', { class: 'hm-switch-ico', 'aria-hidden': 'true' }, '👥'), h('span', { class: 'hm-switch-txt', 'aria-hidden': 'true' }, 'Changer d’enfant'));
    switchBtn.addEventListener('click', () => { audio.tap(); ssSet('caramel-profiles-from', '#/home'); router.go('profiles'); });
    const coin = (icon, cls) => {
      const n = h('b', { class: 'hm-coin-n' }, '0');
      return { el: h('span', { class: 'hm-coin ' + cls }, h('span', { class: 'hm-coin-ico', 'aria-hidden': 'true' }, icon), n), n };
    };
    const W = { stars: coin('⭐', 'is-stars'), apples: coin('🍎', 'is-apples'), streak: coin('🔥', 'is-streak') };
    const purse = h('div', { class: 'hm-purse', role: 'group', 'aria-label': 'Ton trésor' }, W.stars.el, W.apples.el, W.streak.el);
    const head = h('header', { class: 'hm-head' },
      h('div', { class: 'hm-head-row' }, ava, h('div', { class: 'hm-head-txt' }, hello, sub), switchBtn),
      purse);

    /* ----- bandeau « Je passe en … ! » ----- */
    const nextBox = h('div', { class: 'hm-next-slot' });

    /* ----- compagnon ----- */
    const petBox = h('div', { class: 'hm-pet' });

    /* ----- balade du jour ----- */
    const bTitle = h('h2', { class: 'hm-b-title', id: 'hm-b-title' }, 'Ma balade du jour');
    const bDur = h('span', { class: 'hm-b-dur' });
    const bSub = h('p', { class: 'hm-b-sub' });
    const bSteps = h('ol', { class: 'hm-steps', 'aria-label': 'Les étapes de ta balade' });
    const bGo = h('button', { type: 'button', class: 'btn big block hm-b-go' });
    bGo.addEventListener('click', () => { audio.tap(); router.go('balade'); });
    const balade = h('section', { class: 'card hero hm-balade', 'aria-labelledby': 'hm-b-title' },
      h('div', { class: 'hm-b-top' }, h('span', { class: 'hm-b-badge', 'aria-hidden': 'true' }, '🗺️'), bTitle, bDur),
      bSub, bSteps, bGo);

    /* ----- mes jeux ----- */
    const gamesTitle = h('h2', { class: 'section-title hm-games-title' }, 'Mes jeux');
    const games = h('div', { class: 'hm-games' });

    /* ----- progrès, rappels, pied ----- */
    const progress = h('button', { type: 'button', class: 'btn white block hm-progress' },
      h('span', null, 'Mes progrès'), h('span', { 'aria-hidden': 'true' }, '📈'));
    progress.addEventListener('click', () => { audio.tap(); router.go('progres'); });
    const notifSlot = h('div', { class: 'hm-notif-slot' });
    const voice = h('span', { class: 'hm-voice' });
    const parentsBtn = h('button', { type: 'button', class: 'btn white small hm-parents' },
      h('span', null, 'Espace parents'), h('span', { 'aria-hidden': 'true' }, '🔒'));
    parentsBtn.addEventListener('click', () => { audio.tap(); router.go('parents'); });
    const ver = version();
    const foot = h('footer', { class: 'hm-foot' },
      parentsBtn,
      h('p', null, 'Créé avec ❤️ par ', h('a', { href: LINKEDIN_PROFILE, target: '_blank', rel: 'noopener' }, 'Cédric Delalande')),
      h('p', null, frTypo('💡 Une idée pour améliorer le jeu ? '), h('a', { href: FEEDBACK_URL, target: '_blank', rel: 'noopener' }, 'Dis-le-moi sur LinkedIn')),
      h('p', { class: 'hm-meta' }, ver ? 'Caramel ' + ver : 'Caramel', voice));

    const main = h('div', { class: 'hm-main' }, petBox, balade);
    const screen = h('div', { class: 'screen hm' }, head, nextBox, main, gamesTitle, games, progress, notifSlot, foot);
    clear(root);
    root.appendChild(screen);

    /* ----- rendus en place ----- */
    let shownLook = '';
    function renderHead() {
      const q = store.getProfile(); if (!q) return;
      hello.textContent = frTypo('Bonjour ' + q.name + ' !');
      const plan = q.today;
      const f = q.g !== 'm';
      sub.textContent = frTypo(plan && plan.done ? 'Bravo, ta balade du jour est faite !'
        : plan && plan.blocks && plan.blocks.some(b => b.done) ? 'On continue la balade ?'
          : (f ? 'Prête' : 'Prêt') + ' pour ta balade du jour ?');
      const look = [q.id, q.companion.type, q.companion.equip.worn.join(',')].join('|');
      if (look !== shownLook) { shownLook = look; setAvatar(ava, avatarOf(q, 50, '')); }
      switchBtn.hidden = store.listProfiles().length < 2;
      const stars = totalStarsOf(q), apples = q.wallet.apples, streak = q.streak.count;
      setCoin(W.stars, stars, stars + ' étoile' + (stars > 1 ? 's' : ''));
      setCoin(W.apples, apples, apples + ' pomme' + (apples > 1 ? 's' : ''));
      setCoin(W.streak, streak + ' j', 'Série de ' + streak + ' jour' + (streak > 1 ? 's' : ''));
    }
    function setCoin(c, v, label) {
      const s = String(v);
      if (c.n.textContent !== s) {
        const was = c.n.textContent;
        c.n.textContent = s;
        if (was !== '0' && was !== '' && my.ready) motion.pop(c.el, { scale: 1.12, dur: 320 });
      }
      c.el.setAttribute('aria-label', label);
    }

    function renderNext() {
      clear(nextBox);
      const q = store.getProfile(); if (!q) return;
      const next = offerNextClasse(q, today);
      if (!next || ssGet('caramel-next-later-' + q.id) === today) return;
      const btn = h('button', { type: 'button', class: 'btn small hm-next-btn' }, frTypo('Je passe en ' + next + ' !'));
      const box = h('div', { class: 'banner hm-next' },
        h('span', { class: 'hm-next-ico', 'aria-hidden': 'true' }, '🎒'),
        h('span', { class: 'hm-next-txt' }, frTypo('C’est la rentrée ?')), btn);
      btn.addEventListener('click', async () => {
        audio.tap();
        const ok = await askNext(next);
        if (my !== st) return;
        if (!ok) { ssSet('caramel-next-later-' + q.id, today); renderNext(); return; }
        store.mutateProfile(pp => { setClasse(pp, next, today); ensureToday(pp, today); });
        motion.confetti();
        audio.fanfare();
        kit.toast(frTypo('Bienvenue en ' + next + ' ! 🎉'));
        renderNext(); renderGames(); renderBalade();
      });
      nextBox.appendChild(box);
      if (my.ready) motion.enter(box, { from: 'top' });
    }

    /* confirmation « Tu entres en … ? » (feuille suivie : refermée si l'on quitte l'accueil) */
    function askNext(next) {
      return new Promise(resolve => {
        let done = false;
        const fin = v => { if (!done) { done = true; resolve(v); } };
        const text = frTypo('Tu entres en ' + next + ' cette année ?');
        const content = h('div', { class: 'kit-confirm' },
          h('div', { class: 'kit-confirm-ico', 'aria-hidden': 'true' }, '🎒'), h('p', { class: 'kit-confirm-text' }, text));
        const s = kit.sheet({
          content, label: text,
          actions: [{ label: 'Pas encore', kind: 'white', onClick: () => fin(false) }, { label: frTypo('Oui !'), onClick: () => fin(true) }],
          onClose: () => { if (my.sheet === s) my.sheet = null; fin(false); }
        });
        if (!s || !s.el) { fin(false); return; }
        my.sheet = s;
      });
    }

    function renderBalade() {
      const q = store.getProfile(); if (!q) return;
      const plan = q.today && q.today.d === today ? q.today : null;
      const blocks = plan && Array.isArray(plan.blocks) ? plan.blocks : [];
      const min = (q.settings && q.settings.sessionMin) || 15;
      bDur.textContent = '≈ ' + min + ' min';
      bDur.setAttribute('aria-label', 'Environ ' + min + ' minutes');
      clear(bSteps);
      const doneN = blocks.filter(b => b.done).length;
      const curIdx = plan && !plan.done ? blocks.findIndex(b => !b.done) : -1;
      blocks.forEach((b, i) => {
        const info = stepInfo(q, plan, i);
        const state = b.done ? 'done' : i === curIdx ? 'now' : 'todo';
        bSteps.appendChild(h('li', {
          class: 'hm-step is-' + state,
          'aria-label': 'Étape ' + (i + 1) + ', ' + info.label + ' : ' + (info.title || 'jeu au choix') +
            (b.done ? ', terminée' : i === curIdx ? ', à faire maintenant' : '')
        },
        h('span', { class: 'hm-step-ico', 'aria-hidden': 'true' }, info.icon,
          b.done ? h('span', { class: 'hm-step-ok' }, '✓') : null),
        h('span', { class: 'hm-step-k', 'aria-hidden': 'true' }, info.label)));
      });
      const N = blocks.length;
      balade.classList.toggle('is-done', !!(plan && plan.done));
      if (!N) {
        bSub.textContent = frTypo('Ta balade se prépare…');
        bGo.textContent = 'Voir la balade';
      } else if (plan.done) {
        bSub.textContent = frTypo('Bravo, toutes les étapes sont faites !');
        bGo.textContent = frTypo('Balade terminée ✓ — encore un jeu ?');
      } else if (doneN) {
        const info = stepInfo(q, plan, curIdx);
        bSub.textContent = frTypo('Étape ' + (curIdx + 1) + ' sur ' + N + ' : ' + info.label.toLowerCase() + ' ' + info.emoji);
        bGo.textContent = 'Continuer ➜';
      } else {
        const m = MOUNTS[q.companion.type] || MOUNTS.pony;
        bSub.textContent = frTypo(N + ' petites étapes avec ' + q.companion.name + ' ' + m.em);
        bGo.textContent = frTypo('C’est parti !');
      }
      bGo.classList.toggle('is-long', !!(plan && plan.done));
      bGo.classList.toggle('pink', !!(plan && plan.done));
    }

    function renderGames() {
      const q = store.getProfile(); if (!q) return;
      const list = gamesFor(q.classe);
      const have = [...games.children].map(c => c.dataset.id).join(',');
      if (have === list.map(g => g.id).join(',')) {          /* déjà là : seuls les titres changent ({N}) */
        for (const c of games.children) {
          const g = GAME_BY_ID[c.dataset.id];
          const t = c.querySelector('.hm-game-title');
          const txt = fillTemplate(g.title, q);
          if (t && t.textContent !== txt) t.textContent = txt;
        }
        return;
      }
      clear(games);
      for (const g of list) {
        const ico = h('span', { class: 'hm-game-ico', 'aria-hidden': 'true' }, g.icon);
        const card = h('button', { type: 'button', class: 'hm-game', 'data-id': g.id },
          ico,
          h('span', { class: 'hm-game-title' }, fillTemplate(g.title, q)),
          h('span', { class: 'hm-game-blurb' }, frTypo(g.blurb)));
        if (g.tint) card.style.setProperty('--tint', g.tint);     /* propriété personnalisée : pas via style.x */
        card.addEventListener('click', () => {
          audio.tap();
          if (canVT()) ico.style.viewTransitionName = VT_NAME;
          ssSet(FROM_KEY, '#/home');
          ssSet('caramel-vt-game', g.id);
          router.go('play/' + g.id);
        });
        games.appendChild(card);
      }
    }

    function renderNotif() {
      clear(notifSlot);
      if (!notifs.shouldOffer()) return;
      const on = h('button', { type: 'button', class: 'btn small' }, 'Activer');
      const later = h('button', { type: 'button', class: 'btn ghost' }, 'Plus tard');
      const box = h('div', { class: 'banner hm-notif' },
        h('span', { class: 'hm-notif-txt' }, frTypo('🔔 Un petit rappel chaque jour ?')), h('span', { class: 'hm-notif-btns' }, on, later));
      on.addEventListener('click', async () => {
        on.disabled = true;
        let r = 'unsupported';
        try { r = await notifs.enable(); } catch (_) {}
        if (my !== st) return;
        clear(notifSlot);
        if (r === 'on' || r === 'daily') kit.toast(frTypo('Rappels activés ! 🌟'));
      });
      later.addEventListener('click', () => { notifs.dismiss(); clear(notifSlot); });
      notifSlot.appendChild(box);
    }

    renderHead(); renderNext(); renderBalade(); renderGames(); renderNotif();
    my.card = renderCompanionCard(petBox);

    /* retour d'un jeu : l'icône de l'en-tête revient se poser sur sa carte (transition de vue) */
    const back = ssGet('caramel-vt-game');
    if (back && canVT()) {
      const c = games.querySelector('[data-id="' + back + '"] .hm-game-ico');
      if (c) {
        c.style.viewTransitionName = VT_NAME;
        const t = setTimeout(() => { c.style.viewTransitionName = ''; }, 900);
        my.timers.add(t);
      }
    }
    try { sessionStorage.removeItem('caramel-vt-game'); } catch (_) {}

    /* statut du moteur vocal (rempli après le premier chargement de Vosk), ou message de compatibilité */
    my.unsubs.push(speech.onStatus(txt => {
      let t = txt || '';
      if (!t && !speech.speechSupported()) t = speech.COMPAT_MSG;
      voice.textContent = t ? ' · ' + t : '';
    }));

    /* mises à jour en place (compagnon renommé, pommes dépensées, classe changée…) */
    let queued = false;
    my.unsubs.push(store.subscribe(() => {
      if (queued || my !== st) return;
      queued = true;
      Promise.resolve().then(() => {
        queued = false;
        if (my !== st) return;
        const q = store.getProfile();
        if (!q) { router.go('profiles', { replace: true }); return; }
        if (!q.classe) { router.go('welcome', { replace: true }); return; }
        renderHead(); renderBalade(); renderGames();
      });
    }));

    /* entrée en cascade, discrète */
    const blocks = [head, nextBox.firstChild, petBox, balade, gamesTitle, ...games.children, progress, notifSlot.firstChild, foot].filter(Boolean);
    motion.stagger(blocks, el => motion.enter(el, { from: 'bottom', dist: 14, dur: 420 }), 45);
    my.ready = true;
  },

  unmount() { teardown(); }
};

function teardown() {
  const my = st;
  st = null;
  if (!my) return;
  for (const t of my.timers) clearTimeout(t);
  for (const u of my.unsubs) { try { u(); } catch (_) {} }
  try { if (my.sheet) my.sheet.close('api'); } catch (_) {}
  try { if (my.card) my.card.destroy(); } catch (_) {}
}
