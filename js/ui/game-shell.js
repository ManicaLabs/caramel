/* ============ COQUILLE DE JEU : route #/play/<id>?mode=balade&block=<i> (JEUX.md §1) ============
   1. profil actif requis (sinon onboarding), jeu connu et accessible à la classe (sinon accueil) ;
   2. en-tête commun tout de suite (← · pastilles · joker 💡, sur une ligne), petit écran d'attente animé si le
      chargement traîne : générateurs des axes du jeu, module du jeu, sa feuille de style ;
   3. ctx (js/ui/game-ctx.js) avec une manche neuve (createManche) → game.mount(body, ctx) ; à la 1re partie d'un jeu
      pour cet enfant (v2.2.1), le compagnon l'explique d'abord en une phrase (GAME_HELLO, « C'est parti ▶ ») ;
   4. fin : bilan en feuille centrale, UN bouton (phrase d'encouragement, UN nombre « 🍎 +N » qui grandit avec
      les bonus de série et de balade, sans le total du porte-monnaie à côté : un seul nombre à lire) ;
      jamais d'erreur comptée ni de « 7/10 », jamais de « 🍎 +0 ».
      Balade (« un seul gros bouton ») : le compagnon marche sur les pierres jusqu'à l'étape suivante et
      « Étape suivante ▶ » lance directement son jeu (sans repasser par la carte du pré) ; « 🏠 Accueil » discret.
      Dernière étape : il danse, +10 🍎, « Accueil 🏠 » (et « 🎲 Encore un jeu ? » discret) ;
   5. démontage (navigation, retour Android) : game.unmount() TOUJOURS, puis abandon doux de la manche
      si elle n'est pas finie (progrès gardés, aucun reproche). ← = retour d'où l'on vient (accueil ou carte du pré).
      Retour Android (geste ou bouton) une fois la partie commencée : « Tu t'arrêtes ? » (CloseWatcher, D1-09) ;
   6. micro impossible (course) : ctx.changeGame() — en balade, l'étape prend un autre jeu (session.swapBlock) qui se
      lance aussitôt ; en partie libre, feuille de choix d'un autre jeu (D1-01). ctx.nextStep() : après les résultats
      de la course, étape suivante (ou accueil si la balade est finie).
   Lien périmé en mode balade (bloc déjà fait, plan d'un autre jour) → la partie se joue en mode libre.
   v2.4 — temps de jeu du jour (js/core/playtime.js, js/ui/play-limit.js) : la limite se vérifie quand un jeu va
   DÉMARRER (une partie commencée se finit toujours). Limite atteinte : un lien direct ou un rechargement de #/play
   ramène à l'accueil (« {N} se repose 💤 À demain ! ») ; au bilan, « Rejouer », « Étape suivante » et « Encore un
   jeu ? » laissent la place à « Accueil 🏠 » sous la même phrase (dite après la phrase du bilan) ; les relances
   internes (replay, goStep, changeGame, pickMore, ctx.again de la course, ctx.nextStep) ramènent à l'accueil. */

import { h, clear, dayStr, frTypo, loadCSS, fmtNum } from '../core/util.js';
import * as store from '../core/store.js';
import * as router from '../router.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import * as kit from './kit.js';
import { fillTemplate, hasSeen, markSeen } from '../core/profiles.js';
import { createManche } from '../core/manche.js';
import { swapBlock } from '../core/session.js';
import { loadGenerator, hasGenerator } from '../content/index.js';
import { gamesFor, GAME_BY_ID, loadGame } from '../games/index.js';
import { buildCtx } from './game-ctx.js';
import { createHeader } from './game-header.js';
import { mountReady, avatarOf, setAvatar } from './companion.js';
import { stepInfo, launchStep, openGamePicker } from './balade.js';
import * as voice from './voice.js';
import { timeUp, restLine, restNotice } from './play-limit.js';

const FROM_KEY = 'caramel-play-from';       /* écran d'où le jeu a été lancé ('#/home', '#/balade') */
const WAIT_SHOW_MS = 160;                   /* l'écran d'attente n'apparaît que si le chargement traîne */
const ssGet = k => { try { return sessionStorage.getItem(k); } catch (_) { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) {} };
const depth = () => { try { return history.state && Number.isInteger(history.state.caramel) ? history.state.caramel : 0; } catch (_) { return 0; } };
const wideScreen = () => { try { return matchMedia('(min-width: 900px)').matches; } catch (_) { return false; } };

let st = null;

/* 1re partie d'un jeu (v2.2.1) : le compagnon l'explique en UNE phrase ({N} = son nom ; dite à voix haute, toujours
   écrite), une seule fois par jeu et par enfant (profile.seen). Un jeu qui se présente lui-même (export intro: true,
   l'orchestre) n'en a pas besoin, ni un enfant qui y a déjà joué (playedBefore). */
export const GAME_HELLO = Object.freeze({
  course: 'Lis l’histoire à voix haute : à chaque mot que tu lis, j’avance !',
  cloture: 'Chaque piquet de la clôture a son nombre : aide-moi à trouver le bon, je saute jusqu’à lui !',
  tables: 'Trouve le résultat du calcul, tape-le ou dis-le avec 🎤, et je saute l’obstacle !',
  pommes: 'Calcule dans ta tête : chaque bonne réponse fait tomber une pomme dans le panier !',
  operations: 'On pose l’opération, et tu trouves les chiffres un par un, colonne par colonne.'
});
/* l'enfant a déjà joué à ce jeu : une partie dans son historique, ou pour la course une histoire déjà lue (⭐ de la v11
   comprises). Les profils d'avant la 2.2.1 n'ont pas de « déjà vu » : la phrase ne leur est pas montrée pour autant. */
export function playedBefore(profile, id) {
  if (!profile) return false;
  if (Array.isArray(profile.history) && profile.history.some(x => x && x.g === id)) return true;
  const stars = id === 'course' && profile.wallet && profile.wallet.stars;
  return !!stars && typeof stars === 'object' && Object.keys(stars).length > 0;
}

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
    /* temps de jeu du jour atteint (v2.4) : aucun nouveau jeu (lien direct, rechargement, relance) → l'accueil */
    if (timeUp(p, today)) { restNotice(p); router.go('home', { replace: true }); return; }

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

    /* balade.css : tuiles de la feuille « Choisis ton jeu » (récompense au choix, encore un jeu) */
    await Promise.all([loadCSS('css/ui/game.css'), loadCSS('css/ui/shell.css'), loadCSS('css/ui/balade.css')]);
    if (!root.isConnected) return;
    teardown();
    const my = st = { id, mode, blockIdx, ctx: null, mod: null, mounted: false, leaving: false, timers: new Set(), sheet: null, watcher: null };
    const later = (fn, ms) => { const t = setTimeout(() => { my.timers.delete(t); if (st === my) fn(); }, ms); my.timers.add(t); return t; };
    const wait = ms => new Promise(r => later(r, ms));

    /* ----- page : en-tête tout de suite (élément partagé de la transition), corps ensuite ----- */
    const body = h('div', { class: 'game-body', id: 'game-body' });
    const header = createHeader({
      icon: game.icon, title: fillTemplate(game.title, p), short: fillTemplate(game.short || game.title, p), hints: 2,
      onBack: () => { audio.tap(); if (my.ctx && !my.ctx.ended) my.ctx.quit(); else exit(); },
      onJoker: () => { if (my.ctx) my.ctx._joker(); }
    });
    const page = h('div', { class: 'screen is-full game-screen gs', 'data-game': id }, header.el, body);
    clear(root);
    root.appendChild(page);
    try { document.title = fillTemplate(game.title, p) + ' · Caramel'; } catch (_) {}

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
        onLeave: () => { if (!my.leaving && st === my) exit(); },
        onChangeGame: () => changeGame(),
        onNextStep: () => nextStep(),
        /* ctx.again() (Revanche, Suite, Histoires de la course) : pas de nouvelle partie une fois le temps atteint */
        canStart: () => !timeUp(store.getProfile() || p, today),
        onRest: () => { if (!my.leaving && st === my) restHome(); }
      });
    } catch (e) { fail(e); return; }
    my.ctx = ctx;
    header.setTitle(ctx.fill(game.title), ctx.fill(game.short || game.title));
    my.mounted = true;
    clear(body);
    let greeted = false;
    const seenBy = store.getProfile() || p;
    if (!mod.intro && GAME_HELLO[id] && !hasSeen(seenBy, 'game:' + id)) {
      if (playedBefore(seenBy, id) && !(seenBy.seen && seenBy.seen.again === true)) {
        /* déjà joué (profil d'avant la 2.2.1) : pas de phrase ni de toucher en plus, noté « déjà vu » ; sauf après
           « Revoir la visite guidée » (espace parents : seen.again) */
        try { store.mutateProfile(pp => { markSeen(pp, 'game:' + id); }); } catch (e) { console.error('Déjà vu', e); }
      } else {
        await hello(GAME_HELLO[id]);
        if (st !== my) return;
        clear(body);
        greeted = true;
      }
    }
    try {
      await mod.mount(body, ctx);
    } catch (e) {
      if (st === my) fail(e);
    }
    /* « C'est parti » a disparu avec la phrase : si le jeu n'a pas placé le focus, il va au titre du jeu (comme à
       l'arrivée sur un écran : le lecteur d'écran annonce le jeu) */
    if (greeted && st === my) {
      const a = document.activeElement;
      const t = header.el.querySelector('h1');
      if (t && (!a || a === document.body || !a.isConnected)) {
        if (!t.hasAttribute('tabindex')) t.tabIndex = -1;
        try { t.focus({ preventScroll: true }); } catch (_) {}
      }
    }

    /* la phrase du compagnon avant la 1re partie : bulle, compagnon, « C'est parti ▶ » (le jeu n'est monté qu'après :
       sa première question ne coupe pas la phrase) */
    function hello(phrase) {
      return new Promise(resolve => {
        const q = store.getProfile() || p;
        const text = frTypo(fillTemplate(phrase, q));
        const say = h('p', { class: 'gs-hello-say read', id: 'gs-hello-t' }, text);
        const pet = h('div', { class: 'gs-hello-pet', 'aria-hidden': 'true', html: ctx.petSVG(wideScreen() ? 170 : 150, '', { expr: 'happy' }) });
        /* lecteur d'écran : la phrase est la description du bouton qui reçoit le focus (lue une seule fois) */
        const go = h('button', { type: 'button', class: 'btn play block gs-hello-go', 'aria-describedby': 'gs-hello-t' },
          h('span', null, frTypo('C’est parti')), h('span', { class: 'btn-play-ico', 'aria-hidden': 'true' }, '▶'));
        const box = h('div', { class: 'gs-hello' }, say, pet, go);
        body.appendChild(box);
        motion.enter(box, { from: 'scale', dur: 340 });
        ctx.voice.say(text);
        try { go.focus({ preventScroll: true }); } catch (_) {}
        go.addEventListener('click', () => {
          if (st !== my) return;
          audio.tap();
          voice.hush();
          try { store.mutateProfile(pp => { markSeen(pp, 'game:' + id); }); } catch (e) { console.error('Déjà vu', e); }
          /* la voix coupée a repris son souffle avant le jeu (qui peut ouvrir le micro : Chrome Android) */
          voice.settle().then(resolve, resolve);
        }, { once: true });
      });
    }
    if (st === my && !ctx.ended) watchBack();

    /* retour Android (geste ou bouton) : une partie commencée ne s'arrête pas d'un coup (D1-09). Rien de joué → on sort
       comme avant ; sinon « Tu t'arrêtes ? ». Un 2e retour sans nouveau geste quitte (règle du navigateur : close sans
       cancel). Le ← de l'en-tête sort directement. Sans CloseWatcher (navigateurs anciens) : rien ne change. */
    function watchBack() {
      if (typeof globalThis.CloseWatcher !== 'function') return;
      let w = null;
      try { w = new globalThis.CloseWatcher(); } catch (_) { return; }
      my.watcher = w;
      let asking = false;
      w.oncancel = e => {
        const played = my.ctx && my.ctx.manche && my.ctx.manche.state && my.ctx.manche.state.reports > 0;
        if (!played || asking || !e.cancelable) return;
        e.preventDefault();
        asking = true;
        kit.confirmSheet(frTypo('Tu t’arrêtes ? Tes pommes sont gardées.'), { ok: frTypo('Oui, j’arrête'), cancel: 'Je continue', icon: '🐾' })
          .then(stop => { asking = false; if (stop && st === my && my.ctx && !my.ctx.ended) my.ctx.quit(); });
      };
      w.onclose = () => { if (my.watcher === w) my.watcher = null; if (st === my && my.ctx && !my.ctx.ended) my.ctx.quit(); };
    }
    function unwatchBack() {
      const w = my.watcher;
      my.watcher = null;
      if (w) { try { w.destroy(); } catch (_) {} }
    }

    /* ---------- fin de manche ---------- */
    function onEnd(summary, extra) {
      unwatchBack();
      if (my.leaving || st !== my) return summary;
      if (extra.stay) return summary;                         /* le jeu affiche lui-même ses résultats */
      /* la course a déjà montré ses résultats : en balade, la carte du pré montre le compagnon qui avance */
      if (extra.skipSummary || !summary || !summary.n) { exit(!!extra.skipSummary); return summary; }
      showSummary(summary);
      return summary;
    }

    function showSummary(s) {
      const q = store.getProfile() || p;
      const apples = Math.max(0, s.apples | 0), streakBonus = Math.max(0, s.streakBonus | 0), dayBonus = Math.max(0, s.dayBonus | 0);
      const total = apples + streakBonus + dayBonus;

      /* balade : où en est-on ? (bloc juste validé → étape suivante, ou fin de la balade) */
      const plan = mode === 'balade' && q.today && q.today.d === today && Array.isArray(q.today.blocks) ? q.today : null;
      const next = plan && !plan.done ? plan.blocks.findIndex(b => !b.done) : -1;
      const last = !!(plan && plan.done);

      /* compagnon : sur le sentier de la balade (il marche jusqu'à l'étape suivante), sinon seul et joyeux */
      const trail = plan ? trailOf(q, plan, blockIdx, next >= 0 ? next : blockIdx, last) : null;
      const pet = trail ? null : h('div', { class: 'gs-sum-pet' });
      if (pet) setAvatar(pet, avatarOf(q, 120, 'joy'));
      const gainN = h('b', { class: 'gs-gain-n' }, '0');
      /* UN nombre : les pommes de la partie, puis chaque bonus s'y ajoute sous les yeux de l'enfant ; aucune pomme
         gagnée : rien d'affiché (jamais de « +0 » géant), la phrase positive suffit */
      const gain = total > 0 ? h('p', { class: 'gs-gain', role: 'img', 'aria-label': total + ' pomme' + (total > 1 ? 's' : '') + ' gagnée' + (total > 1 ? 's' : '') },
        h('span', { class: 'gs-gain-ico', 'aria-hidden': 'true' }, '🍎'), h('span', { 'aria-hidden': 'true' }, '+'), gainN) : null;
      /* une seule phrase : la phrase positive précise (« Tu as trouvé 7 réponses du premier coup ! ») sert de titre ;
         dernière étape : l'événement, c'est la balade finie (titre), ses +10 🍎 comptent dans le grand nombre */
      const finale = mode === 'balade' && !!s.dayDone;
      const praiseTxt = frTypo(finale ? 'Ta balade du jour est finie !' : praise(s, q.g));
      const lines = h('div', { class: 'gs-lines' });
      const bonuses = [];
      /* « +10 🍎 » ne se coupe jamais (pas de pomme seule à la ligne sur un petit écran) */
      const plus = n => n ? [' ', h('span', { class: 'gs-plus', role: 'img', 'aria-label': '+' + n + (n > 1 ? ' pommes' : ' pomme') }, '+' + n + '\u00a0🍎')] : [];
      /* emoji décoratifs masqués aux lecteurs d'écran (D2-23) : « +10 pommes », pas « pomme rouge » */
      const ico = e => h('span', { 'aria-hidden': 'true' }, e + ' ');
      if (streakBonus) {
        const c = s.streakCount | 0;
        bonuses.push({ n: streakBonus, el: h('p', { class: 'gs-bonus is-fire' }, ico('🔥'),
          frTypo(c > 1 ? c + ' jours de suite :' : 'Premier jour de ta série :'), ...plus(streakBonus)) });
      }
      if (s.usedFreeze) bonuses.push({ n: 0, el: h('p', { class: 'gs-bonus is-ice' }, ico('❄️'), frTypo('Ton gel de série a protégé ta série !')) });
      if (s.dayDone && !finale) {
        bonuses.push({ n: dayBonus, el: h('p', { class: 'gs-bonus is-day' }, ico('🗺️'),
          frTypo('Ta balade du jour est finie !'), ...plus(dayBonus)) });
      }
      for (const b of bonuses) { b.el.style.opacity = '0'; lines.appendChild(b.el); }

      /* UN bouton principal ; en balade, « Accueil » reste possible mais discret.
         v2.4 : temps de jeu du jour atteint → plus de relance (Rejouer, Étape suivante, Encore un jeu ?) : « Accueil 🏠 »,
         où le compagnon se repose, sous la phrase « {N} se repose 💤 À demain ! » */
      const rest = timeUp(q, today);
      const restTxt = rest ? restLine(q) : '';
      const acts = [];
      let actions = [];
      if (rest) {
        const home = h('button', { type: 'button', class: 'btn play block gs-next is-home' }, h('span', null, 'Accueil'), h('span', { class: 'btn-play-ico', 'aria-hidden': 'true' }, '🏠'));
        home.addEventListener('click', () => { audio.tap(); closeThen(() => exitTo('home')); });
        acts.push(h('p', { class: 'gs-rest' }, restTxt), home);
      } else if (mode === 'balade' && next >= 0) {
        const nx = h('button', { type: 'button', class: 'btn play block gs-next' },
          h('span', null, frTypo('Étape suivante')), h('span', { class: 'btn-play-ico', 'aria-hidden': 'true' }, '▶'));
        const info = stepInfo(q, plan, next);
        nx.setAttribute('aria-label', frTypo('Étape suivante : ' + ((info && info.title) || 'jeu au choix')));
        nx.addEventListener('click', () => { audio.tap(); closeThen(() => goStep(next)); });
        const home = h('button', { type: 'button', class: 'btn ghost gs-home' }, h('span', { 'aria-hidden': 'true' }, '🏠'), 'Accueil');
        home.addEventListener('click', () => { audio.tap(); closeThen(() => exitTo('home')); });
        acts.push(nx, home);
      } else if (mode === 'balade') {
        const home = h('button', { type: 'button', class: 'btn play block gs-next is-home' }, h('span', null, 'Accueil'), h('span', { class: 'btn-play-ico', 'aria-hidden': 'true' }, '🏠'));
        home.addEventListener('click', () => { audio.tap(); closeThen(() => exitTo('home')); });
        const more = h('button', { type: 'button', class: 'btn ghost gs-home' }, h('span', { 'aria-hidden': 'true' }, '🎲'), frTypo('Encore un jeu ?'));
        more.addEventListener('click', () => { audio.tap(); closeThen(pickMore); });
        acts.push(home, more);
      } else {
        actions = [{ label: ['Rejouer', h('span', { 'aria-hidden': 'true' }, ' 🔄')], onClick: () => { closeThen(replay); return false; } },
          { label: ['Accueil', h('span', { 'aria-hidden': 'true' }, ' 🏠')], kind: 'white', onClick: () => { closeThen(() => exitTo('home')); return false; } }];
      }
      const content = h('div', { class: 'gs-sum' + (trail ? ' has-trail' : '') }, trail || pet, gain, lines,
        acts.length ? h('div', { class: 'gs-acts' }, ...acts) : null);

      const sh = my.sheet = kit.sheet({ title: praiseTxt, content, actions, dismissable: false, center: true });
      if (sh.el) sh.el.classList.add('gs-sheet');
      try { header.announce(praiseTxt + (total ? ' ' + total + ' pomme' + (total > 1 ? 's' : '') + ' gagnée' + (total > 1 ? 's.' : '.') : '')); } catch (_) {}
      audio.fanfare();
      /* lecture à voix haute activée : le compagnon dit la phrase du bilan (après la fanfare) ; voix fluide (v2.2.2) :
         calculée pendant la fanfare */
      const spoken = rest ? praiseTxt + ' ' + restTxt : praiseTxt;
      voice.prepareNext(spoken);
      later(() => { if (st === my && voice.voiceOn(q)) voice.speak(spoken); }, 900);
      if (s.dayDone) motion.confetti();

      /* chorégraphie : le compagnon avance sur le sentier, « 🍎 +N » compte les pommes, puis chaque bonus s'y ajoute */
      (async () => {
        await wait(380);
        if (st !== my) return;
        if (trail) trail.play();
        else motion.pop(pet.firstChild || pet, { scale: 1.08 });
        let shown = 0;
        const first = apples + (finale ? dayBonus : 0);   /* fin de balade : partie + balade d'un coup (le titre le dit) */
        if (first > 0) {
          const n = Math.min(6, first);
          for (let k = 0; k < n; k++) later(() => { if (st === my) audio.coin(); }, 90 + k * 105);
          await motion.countUp(gainN, 0, first, 650);
          shown = first;
          if (st === my) motion.pop(gain, { scale: 1.12, dur: 320 });
        }
        for (const b of bonuses) {
          if (st !== my) return;
          await wait(220);
          b.el.style.opacity = '';
          motion.enter(b.el, { from: 'scale', dur: 340 });
          if (b.n && gain) {
            audio.coin();
            const from = shown;
            shown += b.n;
            await motion.countUp(gainN, from, shown, 450);
            if (st === my) motion.pop(gain, { scale: 1.15, dur: 320 });
          }
          await wait(200);
        }
        if (st === my) gainN.textContent = fmtNum(total);
      })();
    }

    /* sentier du bilan : les pierres de la balade (icônes des jeux) ; le compagnon part de la pierre de l'étape
       qui vient d'être faite et marche jusqu'à la suivante (dernière étape : il danse) */
    function trailOf(q, plan, from, to, last) {
      const N = plan.blocks.length;
      const stones = plan.blocks.map((b, i) => h('span', { class: 'gs-stone is-' + (b.done ? 'done' : i === to ? 'now' : 'todo') },
        h('span', { class: 'gs-stone-ico' }, stepInfo(q, plan, i).icon), b.done ? h('span', { class: 'gs-stone-ok' }, '✓') : null));
      const pic = h('div', { class: 'gs-walker-pic' });
      const walker = h('div', { class: 'gs-walker' }, pic);
      const el = h('div', { class: 'gs-trail', 'aria-hidden': 'true', style: { '--n': String(N) } }, walker, h('div', { class: 'gs-stones' }, ...stones));
      const fromI = Number.isInteger(from) && from >= 0 && from < N ? from : to;
      const xOf = i => { const st = stones[i]; return st ? st.offsetLeft + st.offsetWidth / 2 : 0; };
      const place = i => { walker.style.left = xOf(i) + 'px'; };
      setAvatar(pic, avatarOf(q, 84, ''));
      requestAnimationFrame(() => place(fromI));
      el.play = () => {
        place(fromI);
        const done = () => { setAvatar(pic, avatarOf(q, 84, last ? 'joy dance' : 'joy')); motion.squash(pic, { amount: 0.8 }); };
        if (to === fromI || motion.reduced() || typeof walker.animate !== 'function') {
          place(to);
          if (to !== fromI) motion.enter(walker, { from: 'fade' });
          done();
          return;
        }
        setAvatar(pic, avatarOf(q, 84, 'walk'));
        pic.classList.toggle('is-left', xOf(to) < xOf(fromI));
        const dx = xOf(to) - xOf(fromI);
        place(to);
        let a = null;
        try {
          a = walker.animate([{ transform: 'translateX(' + (-dx) + 'px)' }, { transform: 'translateX(0)' }],
            { duration: 1100, easing: 'cubic-bezier(.45,0,.55,1)' });
          pic.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }],
            { duration: 275, iterations: 4, easing: 'ease-in-out' });
        } catch (_) { a = null; }
        let clip = null;
        try { clip = audio.clipClop(); } catch (_) {}
        const fin = () => { try { if (clip) clip.stop(); } catch (_) {} clip = null; pic.classList.remove('is-left'); if (st === my) done(); };
        if (a) a.finished.then(fin, fin); else fin();
      };
      return el;
    }
    /* enchaînement : l'étape suivante se lance directement (feuille de choix pour la récompense au choix) ;
       feuille refermée sans choisir → on ne laisse pas l'enfant sur un jeu fini : retour à l'accueil */
    const backHome = () => { if (st === my && !my.leaving) exitTo('home'); };
    function goStep(i, onCancel = backHome) {
      const s2 = launchStep(i, { from: ssGet(FROM_KEY) || '#/home', replace: true, onCancel });
      if (s2) my.sheet = s2;
    }
    /* micro impossible (D1-01) : balade → l'étape prend un autre jeu, lancé tout de suite (récompense : feuille de
       choix, sans la course ; refermée sans choisir → on reste ici) ; partie libre → feuille de choix d'un autre jeu */
    function changeGame() {
      if (my.leaving || st !== my) return;
      if (timeUp(store.getProfile() || p, today)) { restHome(); return; }
      if (mode === 'balade' && blockIdx !== null) {
        try { store.mutateProfile(q => { swapBlock(q, blockIdx, today, id); }); } catch (e) { console.error('Changer de jeu', e); }
        const q = store.getProfile();
        const b = q && q.today && q.today.d === today && Array.isArray(q.today.blocks) ? q.today.blocks[blockIdx] : null;
        if (b && !b.done && b.game !== id) { goStep(blockIdx, () => {}); return; }
      }
      const s2 = openGamePicker({ title: 'Choisis un autre jeu', exclude: [id], onPick: g => router.go('play/' + g, { replace: true }) });
      if (s2) my.sheet = s2;
    }
    /* après les résultats de la course (balade) : étape suivante, ou accueil quand la balade est finie */
    function nextStep() {
      if (my.leaving || st !== my) return;
      const q = store.getProfile();
      const plan = mode === 'balade' && q && q.today && q.today.d === today && Array.isArray(q.today.blocks) ? q.today : null;
      const next = plan && !plan.done ? plan.blocks.findIndex(b => !b.done) : -1;
      if (next >= 0 && !timeUp(q, today)) goStep(next); else exitTo('home');
    }
    /* balade finie : encore un jeu (partie libre) */
    function pickMore() {
      if (timeUp(store.getProfile() || p, today)) { restHome(); return; }
      const s2 = openGamePicker({ title: 'Encore un jeu ?', onPick: id => router.go('play/' + id, { replace: true }), onCancel: backHome });
      if (s2) my.sheet = s2;
    }
    function closeThen(fn) {
      const sh = my.sheet;
      my.sheet = null;
      if (sh) sh.close('action').then(() => { if (st === my) fn(); });
      else fn();
    }
    /* « Rejouer » : l'écran est remonté (nouvelle manche, nouveau jeu tout propre) */
    function replay() {
      if (timeUp(store.getProfile() || p, today)) { restHome(); return; }
      router.go('play/' + id, { replace: true });
    }
    /* temps de jeu du jour atteint pendant une relance : la phrase douce, puis l'accueil (le compagnon s'y repose) */
    function restHome() {
      restNotice(store.getProfile() || p);
      exitTo('home');
    }
    /* retour d'où l'on vient (accueil, ou carte du pré si le jeu a été lancé depuis elle) ; toMap : en balade, la
       carte du pré (fin de la course, qui a déjà montré ses résultats) */
    function exit(toMap) { exitTo(mode === 'balade' && (toMap || ssGet(FROM_KEY) === '#/balade') ? 'balade' : 'home'); }
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
  voice.hush();                                  /* changement d'écran : le compagnon se tait */
  if (my.watcher) { try { my.watcher.destroy(); } catch (_) {} my.watcher = null; }
  for (const t of my.timers) clearTimeout(t);
  my.timers.clear();
  try { if (my.sheet) my.sheet.close('api'); } catch (_) {}
  my.sheet = null;
  try { if (my.mod && typeof my.mod.unmount === 'function') my.mod.unmount(); } catch (e) { try { console.error('unmount du jeu', e); } catch (_) {} }
  try { if (my.ctx && !my.ctx.ended) my.ctx.quit(); } catch (e) { try { console.error('abandon de la manche', e); } catch (_) {} }
  try { document.title = 'Caramel'; } catch (_) {}
}
