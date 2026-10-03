/* ============ COQUILLE DE JEU : route #/play/<id>?mode=balade&block=<i> (JEUX.md §1) ============
   1. profil actif requis (sinon onboarding), jeu connu et accessible à la classe (sinon accueil) ;
   2. en-tête commun tout de suite (← · icône + titre · joker 💡 · 🍎), petit écran d'attente animé si le
      chargement traîne : générateurs des axes du jeu, module du jeu, sa feuille de style ;
   3. ctx (js/ui/game-ctx.js) avec une manche neuve (createManche) → game.mount(body, ctx) ;
   4. fin : bilan en feuille centrale (compagnon joyeux, phrase d'encouragement, 🍎 qui volent vers le
      porte-monnaie, série, balade finie) ; jamais d'erreur comptée ni de « 7/10 » ;
   5. démontage (navigation, retour Android) : game.unmount() TOUJOURS, puis abandon doux de la manche
      si elle n'est pas finie (progrès gardés, aucun reproche).
   Lien périmé en mode balade (bloc déjà fait, plan d'un autre jour) → la partie se joue en mode libre. */

import { h, clear, dayStr, frTypo, loadCSS, fmtNum } from '../core/util.js';
import * as store from '../core/store.js';
import * as router from '../router.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import * as kit from './kit.js';
import { fillTemplate } from '../core/profiles.js';
import { createManche } from '../core/manche.js';
import { loadGenerator, hasGenerator } from '../content/index.js';
import { gamesFor, GAME_BY_ID, loadGame } from '../games/index.js';
import { buildCtx } from './game-ctx.js';
import { createHeader } from './game-header.js';
import { mountReady, avatarOf, setAvatar } from './companion.js';

const FROM_KEY = 'caramel-play-from';       /* écran d'où le jeu a été lancé ('#/home', '#/balade') */
const VT_NAME = 'vt-game-icon';             /* élément partagé : icône de la carte → icône de l'en-tête */
const WAIT_SHOW_MS = 160;                   /* l'écran d'attente n'apparaît que si le chargement traîne */
const ssGet = k => { try { return sessionStorage.getItem(k); } catch (_) { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) {} };
const depth = () => { try { return history.state && Number.isInteger(history.state.caramel) ? history.state.caramel : 0; } catch (_) { return 0; } };
const canVT = () => { try { return typeof document.startViewTransition === 'function' && !motion.reduced(); } catch (_) { return false; } };

let st = null;

/* phrase positive du bilan : uniquement ce qui a été réussi (g = genre du héros, pour l'accord) */
export function praise(summary, g = 'f') {
  const n = Math.max(0, summary && summary.n | 0), c = Math.max(0, summary && summary.clean | 0);
  if (n > 1 && c === n) return 'Tu as tout trouvé du premier coup, quelle star !';
  if (n === 1 && c === 1) return 'Trouvé du premier coup, bravo !';
  if (c >= 2) return 'Tu as trouvé ' + c + ' réponses du premier coup !';
  if (c === 1) return 'Tu as trouvé une réponse du premier coup !';
  return 'Tu es ' + (g === 'm' ? 'allé' : 'allée') + ' jusqu’au bout, bravo pour ta persévérance !';
}

export default {
  async mount(root, params, query) {
    const id = String((params && params.id) || '');
    const today = dayStr();
    const p = store.getProfile();
    if (!p) { router.go(store.listProfiles().length ? 'profiles' : 'onboarding', { replace: true }); return; }
    if (!p.classe) { router.go('welcome', { replace: true }); return; }
    const game = GAME_BY_ID[id];
    if (!game || !gamesFor(p.classe).some(g => g.id === id)) { router.go('home', { replace: true }); return; }

    /* mode et bloc de balade (vérifiés : un lien périmé devient une partie libre) */
    let mode = query && query.mode === 'balade' ? 'balade' : 'libre';
    let blockIdx = null;
    if (mode === 'balade') {
      const bi = Number(query.block);
      const plan = p.today;
      const b = plan && plan.d === today && Array.isArray(plan.blocks) && Number.isInteger(bi) ? plan.blocks[bi] : null;
      if (b && !b.done && (b.game === id || (b.game === null && b.kind === 'recompense'))) blockIdx = bi;
      else mode = 'libre';
    }

    await Promise.all([loadCSS('css/ui/game.css'), loadCSS('css/ui/shell.css')]);
    if (!root.isConnected) return;
    teardown();
    const my = st = { id, mode, blockIdx, ctx: null, mod: null, mounted: false, leaving: false, timers: new Set(), sheet: null };
    const later = (fn, ms) => { const t = setTimeout(() => { my.timers.delete(t); if (st === my) fn(); }, ms); my.timers.add(t); return t; };
    const wait = ms => new Promise(r => later(r, ms));

    /* ----- page : en-tête tout de suite (élément partagé de la transition), corps ensuite ----- */
    const body = h('main', { class: 'game-body', id: 'game-body' });
    const header = createHeader({
      icon: game.icon, title: fillTemplate(game.title, p), short: fillTemplate(game.short || game.title, p), hints: 2,
      onBack: () => { audio.tap(); if (my.ctx && !my.ctx.ended) my.ctx.quit(); else exit(); },
      onJoker: () => { if (my.ctx) my.ctx._joker(); }
    });
    const page = h('div', { class: 'screen is-full game-screen gs', 'data-game': id }, header.el, body);
    clear(root);
    root.appendChild(page);
    try { document.title = 'Caramel — ' + fillTemplate(game.title, p); } catch (_) {}
    const ico = header.el.querySelector('.gh-icon');
    if (ico && canVT()) ico.style.viewTransitionName = VT_NAME;

    /* ----- écran d'attente (seulement si le chargement dure) ----- */
    const waitPic = h('div', { class: 'gs-wait-pic' });
    const waitBox = h('div', { class: 'gs-wait', role: 'status' }, waitPic,
      h('p', { class: 'gs-wait-txt' }, frTypo(fillTemplate('{N} prépare le jeu…', p))),
      h('span', { class: 'gs-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')));
    later(() => {
      if (my.mounted || !body.isConnected) return;
      mountReady().then(() => { if (st === my && !my.mounted) setAvatar(waitPic, avatarOf(store.getProfile() || p, 96, 'walk')); });
      clear(body);
      body.appendChild(waitBox);
      motion.enter(waitBox, { from: 'fade', dur: 260 });
    }, WAIT_SHOW_MS);

    /* ----- chargements ----- */
    let mod = null;
    try {
      const gens = (game.axes || []).filter(hasGenerator).map(ax => loadGenerator(ax));
      [mod] = await Promise.all([loadGame(id), ...gens, mountReady()]);
      if (!mod || typeof mod.mount !== 'function') throw new Error('module de jeu sans mount()');
      if (mod.css) await loadCSS(mod.css);
    } catch (e) {
      if (st === my) fail(e);
      return;
    }
    if (st !== my) return;
    my.mod = mod;

    /* ----- contexte et manche ----- */
    let ctx = null;
    try {
      ctx = buildCtx({
        game, mode, header,
        makeManche: () => createManche({ gameId: id, mode, blockIdx }),
        onEnd: (summary, extra) => onEnd(summary, extra || {}),
        onQuit: () => { if (!my.leaving && st === my) exit(); },
        onLeave: () => { if (!my.leaving && st === my) exit(); }
      });
    } catch (e) { fail(e); return; }
    my.ctx = ctx;
    header.setTitle(ctx.fill(game.title), ctx.fill(game.short || game.title));
    my.mounted = true;
    clear(body);
    try {
      await mod.mount(body, ctx);
    } catch (e) {
      if (st === my) fail(e);
    }

    /* ---------- fin de manche ---------- */
    function onEnd(summary, extra) {
      if (my.leaving || st !== my) return summary;
      if (extra.stay) return summary;                         /* le jeu affiche lui-même ses résultats */
      if (extra.skipSummary || !summary || !summary.n) { exit(); return summary; }
      showSummary(summary);
      return summary;
    }

    function showSummary(s) {
      const q = store.getProfile() || p;
      const apples = Math.max(0, s.apples | 0), streakBonus = Math.max(0, s.streakBonus | 0), dayBonus = Math.max(0, s.dayBonus | 0);
      const end = Math.max(0, (q.wallet && q.wallet.apples) | 0);
      let shown = Math.max(0, end - apples - streakBonus - dayBonus);

      const purseN = h('b', { class: 'gs-purse-n' }, fmtNum(shown));
      const purse = h('div', { class: 'gs-purse', role: 'img', 'aria-label': 'Tu as ' + end + ' pommes' },
        h('span', { 'aria-hidden': 'true' }, '🍎'), purseN);
      const pet = h('div', { class: 'gs-sum-pet' });
      setAvatar(pet, avatarOf(q, 120, 'joy'));
      const gainN = h('b', { class: 'gs-gain-n' }, '0');
      const gain = h('p', { class: 'gs-gain', 'aria-label': apples + ' pomme' + (apples > 1 ? 's' : '') + ' gagnée' + (apples > 1 ? 's' : '') },
        h('span', { class: 'gs-gain-ico', 'aria-hidden': 'true' }, '🍎'), h('span', { 'aria-hidden': 'true' }, '+'), gainN);
      const lines = h('div', { class: 'gs-lines' }, h('p', { class: 'gs-praise' }, frTypo(praise(s, q.g))));
      const bonuses = [];
      if (streakBonus) {
        const c = s.streakCount | 0;
        bonuses.push({ n: streakBonus, el: h('p', { class: 'gs-bonus is-fire' },
          frTypo((c > 1 ? '🔥 ' + c + ' jours de suite : ' : '🔥 Premier jour de ta série : ') + '+' + streakBonus + ' 🍎')) });
      }
      if (s.usedFreeze) bonuses.push({ n: 0, el: h('p', { class: 'gs-bonus is-ice' }, frTypo('❄️ Ton gel de série a protégé ta série !')) });
      if (s.dayDone) {
        bonuses.push({ n: dayBonus, el: h('p', { class: 'gs-bonus is-day' },
          frTypo('🗺️ Ta balade du jour est finie !' + (dayBonus ? ' +' + dayBonus + ' 🍎' : ''))) });
      }
      for (const b of bonuses) { b.el.style.opacity = '0'; lines.appendChild(b.el); }
      const content = h('div', { class: 'gs-sum' }, purse, pet, gain, lines);

      const actions = mode === 'balade'
        ? [{ label: frTypo('Continuer la balade ➜'), kind: 'big', onClick: () => { closeThen(exit); return false; } }]
        : [{ label: 'Rejouer 🔄', onClick: () => { closeThen(replay); return false; } },
          { label: 'Accueil 🏠', kind: 'white', onClick: () => { closeThen(() => exitTo('home')); return false; } }];
      const cheerTxt = kit.cheer('end');
      const sh = my.sheet = kit.sheet({ title: cheerTxt, content, actions, dismissable: false, center: true });
      if (sh.el) sh.el.classList.add('gs-sheet');
      try { header.announce(cheerTxt + ' ' + praise(s, q.g) + (apples ? ' ' + apples + ' pomme' + (apples > 1 ? 's' : '') + ' gagnée' + (apples > 1 ? 's.' : '.') : '')); } catch (_) {}
      audio.fanfare();
      if (s.dayDone) motion.confetti();

      /* chorégraphie : les pommes gagnées volent vers le porte-monnaie, puis les bonus */
      (async () => {
        await wait(380);
        if (st !== my) return;
        motion.pop(pet.firstChild || pet, { scale: 1.08 });
        if (apples > 0) {
          motion.countUp(gainN, 0, apples, 650);
          const n = Math.min(8, apples);
          let k = 0;
          const base = shown;
          await motion.flyTo(gain, purse, {
            count: n, gap: 85, size: 28,
            onArrive: () => { if (st !== my) return; k++; audio.coin(); shown = base + Math.round((apples * k) / n); purseN.textContent = fmtNum(shown); }
          });
        } else {
          gainN.textContent = '0';
        }
        for (const b of bonuses) {
          if (st !== my) return;
          await wait(160);
          b.el.style.opacity = '';
          motion.enter(b.el, { from: 'scale', dur: 340 });
          if (b.n) {
            audio.coin();
            const from = shown;
            shown += b.n;
            motion.countUp(purseN, from, shown, 450);
            motion.pop(purse, { scale: 1.15, dur: 320 });
          }
          await wait(260);
        }
        purseN.textContent = fmtNum(end);
      })();
    }
    function closeThen(fn) {
      const sh = my.sheet;
      my.sheet = null;
      if (sh) sh.close('action').then(() => { if (st === my) fn(); });
      else fn();
    }
    /* « Rejouer » : l'écran est remonté (nouvelle manche, nouveau jeu tout propre) */
    function replay() {
      router.go('play/' + id, { replace: true });
    }
    function exit() { exitTo(mode === 'balade' ? 'balade' : 'home'); }
    function exitTo(dest) {
      if (dest === 'home') ssSet('caramel-vt-game', id);
      const from = ssGet(FROM_KEY);
      if (from === '#/' + dest && depth() > 0) router.back();
      else router.go(dest, { replace: true });
    }

    /* ---------- échec de chargement : message doux ---------- */
    function fail(e) {
      try { console.error('Jeu « ' + id + ' » :', e); } catch (_) {}
      my.mounted = true;
      clear(body);
      const retry = h('button', { type: 'button', class: 'btn block' }, 'Réessayer 🔄');
      retry.addEventListener('click', () => { try { location.reload(); } catch (_) {} });
      const backBtn = h('button', { type: 'button', class: 'btn white block' }, mode === 'balade' ? 'Retour à la balade' : 'Retour à l’accueil');
      backBtn.addEventListener('click', exit);
      const pic = h('div', { class: 'gs-fail-pic', 'aria-hidden': 'true' });
      const drawPic = () => setAvatar(pic, avatarOf(store.getProfile() || p, 110, 'sad'));
      drawPic();
      mountReady().then(() => { if (st === my) drawPic(); });   /* l'échec a pu arriver avant le dessin SVG */
      page.classList.add('is-failed');                      /* joker et 🍎 de l'en-tête n'ont plus de sens */
      const box = h('div', { class: 'gs-fail', role: 'alert' },
        pic,
        h('p', { class: 'gs-fail-title' }, frTypo('Oups, ce jeu n’a pas pu s’ouvrir.')),
        h('p', { class: 'gs-fail-sub' }, frTypo('Vérifie la connexion, puis réessaie.')),
        h('div', { class: 'gs-fail-btns' }, retry, backBtn));
      body.appendChild(box);
      motion.enter(box, { from: 'scale' });
    }
  },

  unmount() { teardown(); }
};

/* démontage : jeu démonté quoi qu'il arrive, manche abandonnée en douceur si elle n'est pas finie */
function teardown() {
  const my = st;
  st = null;
  if (!my) return;
  my.leaving = true;
  for (const t of my.timers) clearTimeout(t);
  my.timers.clear();
  try { if (my.sheet) my.sheet.close('api'); } catch (_) {}
  my.sheet = null;
  try { if (my.mod && typeof my.mod.unmount === 'function') my.mod.unmount(); } catch (e) { try { console.error('unmount du jeu', e); } catch (_) {} }
  try { if (my.ctx && !my.ctx.ended) my.ctx.quit(); } catch (e) { try { console.error('abandon de la manche', e); } catch (_) {} }
  try { document.title = 'Caramel'; } catch (_) {}
}
