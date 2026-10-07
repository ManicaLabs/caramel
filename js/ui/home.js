/* ============ ACCUEIL « UN SEUL GROS BOUTON » (JEUX.md §8, CDC §1 principe 7) ============
   Pensé d'abord pour un CP : le compagnon en grand (scène héros de js/ui/companion.js : vivant, câlin au toucher) et
   UN très grand bouton « Jouer ▶ » qui lance directement le jeu de l'étape en cours de la balade du jour (la suite
   s'enchaîne depuis le bilan : js/ui/game-shell.js). Tout le reste est secondaire et discret :
     - en-tête : avatar = « Qui joue ? », « Bonjour {P} ! », 🔊 / 🔇 couper le son (v2.4, js/ui/sound-toggle.js),
       🎨 « Mon univers » (CDC §10.5 : le thème se choisit sur l'accueil), 🔒 « Espace parents » (discret, toujours au
       même endroit ; la porte et son code sont dans parents.js) ;
     - sur la scène : plaque « 🌱 Caramel » (stade ; la toucher = « Mon compagnon » : son stade en clair, les prénoms),
       🍎 et 🔥, bulle de pensée 🍎 quand il a faim ; sous la scène : 4 soins en icônes (jauges en anneau, ✓ quand c'est
       déjà fait, 🛍️ dorée quand un objet nouveau est à portée de pommes) ;
     - sous le bouton : les pierres de la balade (icônes des jeux ; toucher = la carte du pré #/balade), puis
       🎲 « Jeux » (feuille de tuiles, sans description ; en bas, « 👫 Avec un copain » : le même défi sur deux
       téléphones, js/ui/duel.js) et 📈 « Mes progrès » — ce dernier seulement quand le radar a
       quelque chose à montrer (une partie jouée ou une fiche importée) : divulgation progressive.
   Balade finie : le bouton devient « 🎲 Encore un jeu ? » (couleur secondaire).
   Déplacés dans l'espace parents (js/ui/parents.js) : rappels quotidiens, crédits et liens, version, moteur vocal.
   Bandeau « Je passe en … ! » (rentrée) : inchangé.
   v2.2.2 — invitation à installer (js/ui/install.js) : bannière DISCRÈTE « 📲 Mets Caramel sur l'écran d'accueil » tout en
   bas (elle ne concurrence pas « Jouer ▶ » ; la scène du compagnon lui laisse sa place), tant que Caramel n'est pas
   installé et qu'une installation est possible ; ✕ = elle revient dans 7 jours. Une invitation à la fois : jamais avant
   ni pendant la visite guidée, ni avec le bandeau de mise à jour (html.has-update, main.js) ou celui de la rentrée, ni
   quand un panneau du compagnon est ouvert.
   v2.2.3 — voix et micro (demande du parent du 06/10/2026 : tout se télécharge à la première ouverture,
   js/core/preload.js) : appareil déjà configuré (mise à jour) ou création du profil finie avant la fin du
   téléchargement : la même petite barre que pendant la création (js/ui/preload.js) se pose sous l'en-tête jusqu'à la
   fin (« Voix et micro prêts ✓ », puis plus rien) ; la scène du compagnon lui cède sa hauteur : tout tient
   toujours sans défiler, « Jouer ▶ » à sa place. Données mobiles : la barre n'est qu'un petit bouton pour l'adulte.
   Tout est prêt : aucune barre.
   « Qui joue ? » (plusieurs enfants sur un même appareil) : toucher l'avatar ouvre une feuille avec tous les profils
   (compagnon + prénom, chaque carte aux couleurs du thème de l'enfant : la MÊME carte que l'écran #/profiles,
   kidCard de js/ui/profiles.js), « ➕ Ajouter » et, dès deux enfants, « 🏆 En famille ». Toucher un autre enfant =
   bascule immédiate : store.setActive + sessionStorage 'caramel-picked'
   (main.js réapplique son thème, son et animations), puis l'accueil est remonté pour lui dans une transition de vue.
   v2.4 — temps de jeu du jour (retour du parent du 07/10/2026 ; js/core/playtime.js, js/ui/play-limit.js) : juste avant
   la limite, une petite ligne « ⏳ Encore 5 minutes de jeu aujourd'hui » au-dessus du bouton ; limite atteinte, le
   bouton se repose (grisé, « À demain ! 💤 », 🌙 le soir) et dit gentiment pourquoi au toucher (« Tu as bien joué
   aujourd'hui ! {N} fait la sieste 💤 On rejoue demain. »), « 🎲 Jeux » s'efface ; l'écran porte .is-rest et
   data-rest="sieste" | "nuit" (le compagnon endormi sur la scène : js/ui/companion.js).
   Lecture : store.getProfile() ; écriture : store.mutateProfile uniquement (plan du jour, classe).
   Les blocs se mettent à jour en place à chaque changement du store (aucune reconstruction de l'écran). */

import { h, clear, dayStr, frTypo, loadCSS, fmtNum } from '../core/util.js';
import * as store from '../core/store.js';
import * as router from '../router.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import * as kit from './kit.js';
import { offerNextClasse, setClasse, fillTemplate, hasSeen, markSeen } from '../core/profiles.js';
import { ensureToday } from '../core/session.js';
import { MOUNTS } from '../content/companion-data.js';
import { themeOf } from '../core/themes.js';
import { renderCompanionCard, mountReady, avatarOf, setAvatar } from './companion.js';
import { stepInfo, currentStep, launchStep, openGamePicker } from './balade.js';
import { openThemeSheet } from './theme-picker.js';
import { stageOf } from '../core/family.js';
import { kidCard, kidActions } from './profiles.js';
import * as voice from './voice.js';
import * as inst from './install.js';
import * as preload from '../core/preload.js';
import { preloadBar, cssReady as preloadCSS } from './preload.js';
import { playNow, timeUp, restLine, restNotice, restKind, nearLine, REST_TEXT } from './play-limit.js';
import { soundButton } from './sound-toggle.js';

const FROM_KEY = 'caramel-play-from';
const ssGet = k => { try { return sessionStorage.getItem(k); } catch (_) { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) {} };

let st = null;   /* état de l'écran monté */
const PICKED_KEY = 'caramel-picked';           /* sessionStorage : profil choisi pendant cette session (main.js) */
const WHO_VT = 'hm-who-ava';                   /* élément partagé : vignette choisie → avatar de l'en-tête */

/* le radar a-t-il quelque chose à montrer ? (compétence observée en jeu, lecture de la course, ou fiche importée) */
const hasRadar = q => !!q && ((q.skills && typeof q.skills === 'object' && Object.keys(q.skills).length > 0) || (Array.isArray(q.evals) && q.evals.length > 0));

const canVT = () => { try { return typeof document.startViewTransition === 'function' && !motion.reduced(); } catch (_) { return false; } };

/* compagnon dessiné avec son stade (mountSVG, opts { expr, stage } + view 'portrait' de l'avatar rond, phase) ;
   repli : avatar du compagnon */
let svgFn = null;
const svgReady = import('./mount-svg.js').then(m => { if (m && typeof m.mountSVG === 'function') svgFn = m.mountSVG; }).catch(() => {});
function petSVG(p, size, expr = 'neutral', mood = '', opts = {}) {
  const c = (p && p.companion) || {};
  if (svgFn) {
    try {
      const s = svgFn(c.type, c.equip && c.equip.worn, size, mood, Object.assign({ expr, stage: stageOf(c) }, opts));
      if (typeof s === 'string' && s.indexOf('<svg') >= 0) return s;
    } catch (_) { /* repli ci-dessous */ }
  }
  return avatarOf(p, size, mood, opts);
}

const HOME = {
  /* opts.switching : remontage pendant la bascule « Qui joue ? » (pas d'entrée en cascade, avatar partagé) */
  async mount(root, params, query, opts = {}) {
    const today = dayStr();
    let p = store.getProfile();
    if (!p) { router.go(store.listProfiles().length ? 'profiles' : 'onboarding', { replace: true }); return; }
    if (!p.classe) { router.go('welcome', { replace: true }); return; }
    /* balade.css : tuiles de la feuille « Choisis ton jeu » ; profiles.css : cartes de la feuille « Qui joue ? » */
    await Promise.all([loadCSS('css/ui/home.css'), loadCSS('css/ui/companion.css'), loadCSS('css/ui/balade.css'),
      loadCSS('css/ui/profiles.css'), inst.cssReady(), preloadCSS(), mountReady(), svgReady]);
    if (!root.isConnected) return;
    teardown();
    p = store.getProfile();
    if (!p || !p.classe) return;
    const my = st = { root, timers: new Set(), unsubs: [], card: null, sheet: null, today, switching: false, tour: null, inst: null, bar: null };

    /* plan du jour (recalculé s'il manque, date d'un autre jour ou n'est plus valable) */
    try { store.mutateProfile(pp => { ensureToday(pp, today); }); } catch (e) { console.error('Balade du jour', e); }

    /* ----- en-tête : qui joue · bonjour · univers · espace parents ----- */
    const ava = h('span', { class: 'hm-ava', 'aria-hidden': 'true' });
    const sticker = h('span', { class: 'hm-sticker', 'aria-hidden': 'true' });       /* pastille du thème (🦖, 👑…) */
    const avaWrap = h('button', { type: 'button', class: 'hm-ava-wrap hm-ava-btn', 'aria-haspopup': 'dialog' }, ava, sticker);
    avaWrap.addEventListener('click', () => openWho());
    const hello = h('h1', { class: 'hm-hello' });
    const themeBtn = h('button', { type: 'button', class: 'hm-icon-btn hm-theme-btn', 'aria-haspopup': 'dialog' },
      h('span', { 'aria-hidden': 'true' }, '🎨'));
    themeBtn.addEventListener('click', () => openTheme());
    const lockBtn = h('button', { type: 'button', class: 'hm-icon-btn hm-lock-btn', 'aria-label': 'Espace parents' },
      h('span', { 'aria-hidden': 'true' }, '🔒'));
    lockBtn.addEventListener('click', () => { if (my.switching || sheetOpen()) return; audio.tap(); router.go('parents'); });
    const soundBtn = soundButton({ cls: 'hm-icon-btn hm-sound-btn' });      /* 🔊 / 🔇 (v2.4) : couper le son, d'un toucher */
    const head = h('header', { class: 'hm-head' }, avaWrap, hello, soundBtn, themeBtn, lockBtn);

    /* ----- bandeau « Je passe en … ! » ----- */
    const nextBox = h('div', { class: 'hm-next-slot' });

    /* ----- trésor posé sur le ciel de la scène : 🍎 (et 🔥 dès le premier jour de série) ----- */
    const coin = (icon, cls) => {
      const n = h('b', { class: 'hm-coin-n', 'aria-hidden': 'true' }, '0');
      const sr = h('span', { class: 'sr-only' });
      return { el: h('span', { class: 'hm-coin ' + cls }, h('span', { class: 'hm-coin-ico', 'aria-hidden': 'true' }, icon), n, sr), n, sr };
    };
    const W = { apples: coin('🍎', 'is-apples'), streak: coin('🔥', 'is-streak') };
    const hud = h('div', { class: 'cc-hud hm-purse', role: 'group', 'aria-label': 'Ton trésor' }, W.apples.el, W.streak.el);

    /* ----- compagnon (scène héros) ----- */
    const petBox = h('div', { class: 'hm-pet' });

    /* ----- LE bouton, et les pierres de la balade dessous ----- */
    const goTxt = h('span', { class: 'hm-go-t' });
    const goIco = h('span', { class: 'btn-play-ico hm-go-ico', 'aria-hidden': 'true' });
    const go = h('button', { type: 'button', class: 'btn play block hm-go' }, goTxt, goIco);
    go.addEventListener('click', onGo);
    const pebs = h('span', { class: 'hm-pebs', 'aria-hidden': 'true' });
    const path = h('button', { type: 'button', class: 'hm-path' }, pebs);
    path.addEventListener('click', () => { audio.tap(); router.go('balade'); });
    /* v2.4 : « Encore 5 minutes de jeu aujourd'hui » juste avant la limite du jour (petit, doux, au-dessus du bouton) */
    const near = h('p', { class: 'hm-near', hidden: true },
      h('span', { class: 'hm-near-ico', 'aria-hidden': 'true' }, '⏳'), h('span', { class: 'hm-near-t' }));
    const play = h('section', { class: 'hm-play', 'aria-label': 'Ma balade du jour' }, near, go, path);

    /* ----- secondaire : jeux libres, progrès ----- */
    const gamesBtn = h('button', { type: 'button', class: 'hm-alt-btn hm-games-btn' },
      h('span', { class: 'hm-alt-ico', 'aria-hidden': 'true' }, '🎲'), h('span', null, 'Jeux'));
    gamesBtn.addEventListener('click', () => { audio.tap(); openGames(frTypo('Choisis ton jeu')); });
    const progressBtn = h('button', { type: 'button', class: 'hm-alt-btn hm-progress' },
      h('span', { class: 'hm-alt-ico', 'aria-hidden': 'true' }, '📈'), h('span', null, 'Mes progrès'));
    progressBtn.addEventListener('click', () => { audio.tap(); router.go('progres'); });
    const alt = h('nav', { class: 'hm-alt', 'aria-label': 'Autres activités' }, gamesBtn, progressBtn);

    /* ----- invitation à installer (v2.2.2) : tout en bas, discrète ----- */
    const instBan = my.inst = inst.homeBanner({ onHide: () => screen.classList.remove('has-inst') });

    /* ----- voix et micro en cours de téléchargement (v2.2.3) : sous l'en-tête, discrète ----- */
    const bar = my.bar = preloadBar();

    /* colonne de droite sur grand écran couché (le bouton, les pierres, Jeux / Mes progrès, l'invitation à installer) :
       un seul bloc centré face à la scène ; sur téléphone et tablette debout, display: contents — rien ne change (v2.5.3) */
    const side = h('div', { class: 'hm-side' }, play, alt, instBan.el);
    const screen = h('div', { class: 'screen hm' }, head, bar.el, nextBox, petBox, side);
    clear(root);
    root.appendChild(screen);
    preload.start().catch(() => {});

    /* ----- rendus en place ----- */
    let shownLook = '';
    function renderHead() {
      const q = store.getProfile(); if (!q) return;
      hello.textContent = frTypo('Bonjour ' + q.name + ' !');
      const look = [q.id, q.companion.type, q.companion.equip.worn.join(','), stageOf(q.companion)].join('|');
      if (look !== shownLook) { shownLook = look; setAvatar(ava, petSVG(q, 54, 'neutral', '', { view: 'portrait' })); }
      const th = themeOf(q.settings && q.settings.theme);
      if (sticker.textContent !== th.sticker) sticker.textContent = th.sticker;
      sticker.hidden = !th.sticker;
      themeBtn.setAttribute('aria-label', frTypo('Mon univers : ' + th.name));
      const many = store.listProfiles().length >= 2;
      avaWrap.setAttribute('aria-label', frTypo('Qui joue ? En ce moment : ' + q.name + (many ? '. Touche pour changer d’enfant.' : '. Touche pour ajouter un enfant.')));
      const apples = q.wallet.apples, streak = q.streak.count;
      setCoin(W.apples, apples, apples + ' pomme' + (apples > 1 ? 's' : ''));
      setCoin(W.streak, streak, streak + ' jour' + (streak > 1 ? 's' : '') + ' de suite');
      W.streak.el.hidden = !(streak > 0);
      fitPlate();
    }
    /* la plaque du nom s'arrête avant le trésor (V22B-05 : nom long à 360 px ; largeur lue par css/ui/companion.css) */
    function fitPlate() {
      try { if (hud.isConnected) petBox.style.setProperty('--hud-w', hud.offsetWidth + 'px'); } catch (_) {}
    }
    function setCoin(c, v, label) {
      const s = fmtNum(v);
      if (c.n.textContent !== s) {
        const was = c.n.textContent;
        c.n.textContent = s;
        if (was !== '0' && was !== '' && my.ready) motion.pop(c.el, { scale: 1.12, dur: 320 });
      }
      c.sr.textContent = label;
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
        if (!ok) { ssSet('caramel-next-later-' + q.id, today); renderNext(); renderInstall(); return; }
        store.mutateProfile(pp => { setClasse(pp, next, today); ensureToday(pp, today); });
        motion.confetti();
        audio.fanfare();
        kit.toast(frTypo('Bienvenue en ' + next + ' ! 🎉'));
        renderNext(); renderPlay(); renderInstall();
      });
      nextBox.appendChild(box);
      if (my.ready) motion.enter(box, { from: 'top' });
    }

    /* le bouton : étape en cours de la balade, ou « encore un jeu ? » quand elle est finie */
    function renderPlay() {
      const q = store.getProfile(); if (!q) return;
      const plan = q.today && q.today.d === today ? q.today : null;
      const blocks = plan && Array.isArray(plan.blocks) ? plan.blocks : [];
      const N = blocks.length;
      const cur = currentStep(q, today);
      const done = !!(plan && plan.done);
      clear(pebs);
      blocks.forEach((b, i) => {
        const info = stepInfo(q, plan, i);
        const state = b.done ? 'done' : i === cur ? 'now' : 'todo';
        pebs.appendChild(h('span', { class: 'hm-peb is-' + state },
          h('span', { class: 'hm-peb-ico' }, info.icon), b.done ? h('span', { class: 'hm-peb-ok' }, '✓') : null));
      });
      path.hidden = !N;
      const doneN = blocks.filter(b => b.done).length;
      path.setAttribute('aria-label', done ? 'Ma balade du jour est finie : voir le chemin'
        : 'Ma balade du jour, étape ' + (cur + 1) + ' sur ' + N + (doneN ? ' (' + doneN + ' faite' + (doneN > 1 ? 's' : '') + ')' : '') + ' : voir le chemin');
      /* v2.4 — temps de jeu du jour (js/core/playtime.js) : atteint → le bouton se repose (« À demain ! 💤 », grisé, il
         dit pourquoi au toucher) et 🎲 Jeux s'efface ; presque atteint → « Encore 5 minutes de jeu aujourd'hui » */
      const ps = playNow(q, today);
      const rest = ps.over;
      const nearTxt = rest ? '' : nearLine(ps);
      near.lastChild.textContent = nearTxt;
      near.hidden = !nearTxt;
      /* le compagnon de la scène s'endort ou se réveille aussitôt (js/ui/companion.js, napCheck : même sieste / nuit) */
      if (my.card && typeof my.card.napCheck === 'function' && rest !== screen.classList.contains('is-rest')) {
        try { my.card.napCheck(); } catch (_) {}
      }
      const kind = rest ? (my.card && my.card.nap) || restKind() : '';
      screen.classList.toggle('is-rest', rest);
      if (rest) screen.setAttribute('data-rest', kind); else screen.removeAttribute('data-rest');
      go.classList.toggle('is-rest', rest);
      if (rest) go.setAttribute('aria-disabled', 'true'); else go.removeAttribute('aria-disabled');
      go.classList.toggle('is-done', !rest && (done || !N));
      gamesBtn.hidden = rest || done || !N;             /* le gros bouton fait déjà « encore un jeu ? » */
      progressBtn.hidden = !hasRadar(q);                /* enfant tout neuf : rien à voir encore, « Jouer ▶ » suffit */
      alt.hidden = gamesBtn.hidden && progressBtn.hidden;
      if (rest) {
        goTxt.textContent = frTypo(REST_TEXT.button);
        goIco.textContent = kind === 'nuit' ? '🌙' : '💤';
        go.setAttribute('aria-label', restLine(q));
      } else if (done || !N) {
        goTxt.textContent = frTypo('Encore un jeu ?');
        goIco.textContent = '🎲';
        go.setAttribute('aria-label', frTypo(done ? 'Balade finie, bravo ! Encore un jeu ?' : 'Choisir un jeu'));
      } else {
        const info = stepInfo(q, plan, cur);
        goTxt.textContent = 'Jouer';
        goIco.textContent = '▶';
        go.setAttribute('aria-label', 'Jouer : ' + (info.title || 'jeu au choix') + ', étape ' + (cur + 1) + ' sur ' + N);
      }
    }
    /* invitation à installer : une invitation à la fois, jamais avant ni pendant la visite guidée (premier accueil d'un
       enfant), ni avec le bandeau de la rentrée ; le bandeau de mise à jour la range (css/ui/install.css) */
    function renderInstall() {
      const q = store.getProfile();
      const want = !!q && my === st && !my.switching && !my.tour && hasSeen(q, 'tour') && !nextBox.firstChild;
      const was = instBan.shown;
      instBan.show(want);
      screen.classList.toggle('has-inst', instBan.shown);
      if (instBan.shown && !was && my.ready) motion.enter(instBan.el, { from: 'bottom', dist: 10, dur: 360 });
    }
    my.unsubs.push(inst.onChange(() => { if (my === st) renderInstall(); }));

    /* une feuille est-elle ouverte ? (les feuilles des autres modules ne préviennent pas de leur fermeture) */
    const sheetOpen = () => !!(my.sheet && my.sheet.el && my.sheet.el.isConnected);
    function onGo() {
      const q = store.getProfile(); if (!q || sheetOpen()) return;
      /* temps de jeu du jour atteint : rien ne démarre, le compagnon dit gentiment pourquoi (v2.4) */
      if (timeUp(q, today)) { renderPlay(); restNotice(q, { el: go, kind: 'why' }); return; }
      audio.tap();
      const cur = currentStep(q, today);
      if (cur < 0) { openGames(frTypo('Encore un jeu ?')); return; }
      const s = launchStep(cur, { from: '#/home' });
      if (s) my.sheet = s;
    }
    /* partie libre (hors balade) ; en bas de la feuille, « 👫 Avec un copain » (chacun sur son téléphone, js/ui/duel.js) */
    function openGames(title) {
      if (sheetOpen()) return;
      const duel = { id: 'duel', icon: '👫', title: 'Avec un copain', label: 'Avec un copain : le même défi, chacun sur son téléphone',
        onPick: () => router.go('duel') };
      const s = openGamePicker({ title, onPick: id => { ssSet(FROM_KEY, '#/home'); router.go('play/' + id); }, extras: [duel] });
      if (s) my.sheet = s;
    }

    /* ----- 🎨 « Mon univers » : le choix du thème (feuille de theme-picker.js) ----- */
    function openTheme() {
      if (my !== st || my.switching || sheetOpen()) return;
      audio.tap();
      const q = store.getProfile(); if (!q) return;
      const s = openThemeSheet({ profileId: q.id });
      if (s && s.el) my.sheet = s;
    }

    /* ----- « Qui joue ? » : tous les enfants de l'appareil, bascule en un geste ----- */
    function openWho() {
      if (my !== st || my.switching || sheetOpen()) return;
      audio.tap();
      const list = store.listProfiles();
      const cur = store.getProfile();
      if (!cur) return;
      const grid = h('div', { class: 'kid-grid' + (list.length === 1 ? ' is-one' : ''), role: 'group', 'aria-label': 'Les enfants' });
      list.forEach((q, i) => {
        const current = q.id === cur.id;
        grid.appendChild(kidCard(q, {
          current, index: i, size: 96,
          onPick: (card, pic) => {
            if (current) { audio.tap(); closeWhoThen(() => {}); return; }
            switchTo(q.id, card, pic);
          }
        }));
      });
      const actions = kidActions(list.length, {
        onAdd: () => { audio.tap(); closeWhoThen(() => router.go('onboarding')); },
        onFamily: () => { audio.tap(); closeWhoThen(() => router.go('famille')); }
      });
      const content = h('div', { class: 'kid-sheet' }, grid, actions);
      const s = kit.sheet({
        title: frTypo('Qui joue ?'), content,
        onClose: () => { if (my.sheet === s) my.sheet = null; }
      });
      if (!s || !s.el) return;
      my.sheet = s;
      motion.stagger(grid.children, el => motion.enter(el, { from: 'scale', dur: 360 }), 60);
    }
    function closeWhoThen(fn) {
      const s = my.sheet;
      my.sheet = null;
      if (s) s.close('action').then(() => { if (my === st) fn(); }); else fn();
    }
    /* bascule : profil actif + session, thème appliqué par main.js, accueil remonté pour l'enfant choisi */
    function switchTo(id, card, pic) {
      if (my.switching || my !== st) return;
      const q = store.getProfile(id);
      if (!q) return;
      my.switching = true;
      audio.neigh();
      motion.pop(card, { scale: 1.06 });
      for (const c of card.parentNode ? card.parentNode.children : []) if (c !== card) c.classList.add('is-dim');
      const html = document.documentElement;
      const run = async () => {
        const s = my.sheet;
        my.sheet = null;
        if (s) { try { s.close('nav'); } catch (_) {} }            /* retrait immédiat : la transition fait le reste */
        store.setActive(id);                                        /* commit → main.js : thème, son, animations */
        ssSet(PICKED_KEY, id);
        if (!q.classe) { router.go('welcome', { replace: true }); return; }
        await HOME.mount(root, params, query, { switching: true });
      };
      const later = setTimeout(() => {
        my.timers.delete(later);
        if (my !== st) return;
        let vt = null;
        if (canVT()) {
          try {
            if (pic) pic.style.viewTransitionName = WHO_VT;
            html.classList.add('who-swap');
            vt = document.startViewTransition(run);
          } catch (_) { vt = null; }
        }
        if (!vt) { html.classList.remove('who-swap'); run().catch(e => console.error('Qui joue ?', e)); return; }
        const done = () => html.classList.remove('who-swap');
        if (vt.ready) vt.ready.catch(() => {});
        (vt.finished || Promise.resolve()).then(done, done);
      }, motion.reduced() ? 60 : 220);
      my.timers.add(later);
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

    /* ----- visite guidée (v2.2.1) : une fois par enfant, au premier accueil (profils existants compris : l'accueil a
       changé en 2.2). UNE chose à la fois : le compagnon (bonjour), « Jouer ▶ », les soins. Grand lecteur (CM1-CM2) :
       deux étapes, sans « coucou ». Jamais pendant le bandeau de mise à jour (main.js), une feuille, un panneau du
       compagnon, ni la bascule « Qui joue ? ». La voix dit chaque étape (lecture à voix haute activée : tous les enfants
       par défaut depuis la 2.2.2, CM1-CM2 compris, avec la voix enregistrée), le texte reste ; 🔁 la relit. */
    const barShown = () => { const b = document.querySelector('.update-bar'); return !!(b && !b.hidden); };
    const busy = () => my !== st || my.switching || sheetOpen() || barShown() || document.documentElement.classList.contains('kit-lock')
      || !!petBox.querySelector('.cc.has-panel') || document.visibilityState === 'hidden';
    function tourSteps(q) {
      const f = t => frTypo(fillTemplate(t, q));
      const stage = () => petBox.querySelector('.cc-stage-wrap');
      const care = () => petBox.querySelector('.cc-actions');
      const again = go.classList.contains('is-done');
      if (q.classe === 'CM1' || q.classe === 'CM2') {
        return [
          { target: go, text: f(again ? 'Ta balade du jour est finie : ce bouton te propose un autre jeu.' : 'Le bouton Jouer lance l’étape du jour de ta balade.') },
          { target: care, text: f('Ici, tu prends soin de {N} : repas, brossage, promenade, et la boutique pour dépenser tes pommes.') }
        ];
      }
      return [
        { target: stage, text: f('Coucou {P} ! Moi, c’est {N}.'), greet: true },
        { target: go, text: f(again ? 'Pour jouer encore, touche ce gros bouton !' : 'Pour jouer, touche le gros bouton Jouer !') },
        { target: care, text: f('Ici, tu t’occupes de moi : à manger, un coup de brosse, une promenade… et la boutique !') }
      ];
    }
    function startTour() {
      const q = store.getProfile();
      if (!q || hasSeen(q, 'tour') || my.tour || busy()) return;
      const steps = tourSteps(q);
      instBan.show(false);                        /* une invitation à la fois */
      let said = '', waiting = '', waitingGreet = false;
      const who = h('span', { class: 'hm-tour-who' });
      setAvatar(who, petSVG(q, 60, 'happy', '', { view: 'portrait' }));
      const listen = voice.listenOn(q) ? voice.listenButton(() => said, { label: 'Écouter encore' }) : null;
      /* appli ouverte directement sur l'accueil : le navigateur refuse la voix avant le premier geste. 🔁 se signale
         doucement ; la phrase est dite au premier toucher. Si ce toucher passe à l'étape suivante, celle-ci est dite,
         précédée du bonjour s'il n'a pas pu l'être ; si c'est 🔁, il la dit lui-même */
      const calm = () => { waiting = ''; waitingGreet = false; if (listen) listen.classList.remove('is-call'); };
      const onGesture = ev => {
        if (!waiting || voice.needsGesture()) return;
        if (listen && ev && listen.contains(ev.target)) { calm(); return; }
        const t = waiting;
        setTimeout(() => { if (my.tour && waiting === t) { calm(); voice.speak(t); } }, 0);
      };
      document.addEventListener('pointerup', onGesture, true);
      document.addEventListener('keydown', onGesture, true);
      const unGesture = () => { document.removeEventListener('pointerup', onGesture, true); document.removeEventListener('keydown', onGesture, true); };
      my.tour = kit.tour({
        steps, avatar: who, listen,
        labels: { next: 'Suivant', last: frTypo('J’ai compris'), skip: 'Passer' },
        guard: () => my === st && !barShown(),
        returnFocus: () => go,
        onStep: (i, stp) => {
          said = stp.text;
          if (stp.greet && my.card && my.card.greet && !motion.reduced()) my.card.greet();
          if (listen && voice.voiceOn(q) && voice.needsGesture()) { waiting = stp.text; waitingGreet = !!stp.greet; listen.classList.add('is-call'); return; }
          const lead = waiting && waitingGreet ? waiting + ' ' : '';
          calm();
          voice.speak(lead + stp.text);
        },
        onEnd: reason => {
          my.tour = null;
          unGesture();
          voice.hush();
          if (reason === 'done' || reason === 'skip') {
            try { store.mutateProfile(pp => { markSeen(pp, 'tour'); }, q.id); } catch (e) { console.error('Visite guidée', e); }
            /* l'invitation à installer attend la fin de la visite, puis un court instant */
            const t = setTimeout(() => { my.timers.delete(t); if (my === st) renderInstall(); }, motion.reduced() ? 200 : 900);
            my.timers.add(t);
          }
        }
      });
      if (!my.tour || !my.tour.el) { my.tour = null; unGesture(); }
    }
    function scheduleTour(ms) {
      const q = store.getProfile();
      if (!q || hasSeen(q, 'tour')) return;
      /* voix fluide (v2.2.2) : les étapes (le bonjour avec le prénom) sont calculées pendant l'attente */
      try { const tx = tourSteps(q).map(s => s.text); voice.prepareNext(tx[0]); voice.prepare(tx.slice(1)); } catch (_) {}
      const t = setTimeout(() => { my.timers.delete(t); if (my === st) startTour(); }, motion.reduced() ? Math.min(ms, 400) : ms);
      my.timers.add(t);
    }

    renderHead(); renderNext(); renderPlay(); renderInstall();
    my.card = renderCompanionCard(petBox, { hero: true, hud });
    fitPlate();                                   /* trésor posé sur la scène : sa largeur est connue */
    try { document.fonts.ready.then(() => { if (my === st) fitPlate(); }); } catch (_) {}
    try { sessionStorage.removeItem('caramel-vt-game'); } catch (_) {}

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
        renderHead(); renderPlay();
      });
    }));

    /* entrée en cascade, discrète — sauf pendant la bascule « Qui joue ? » : la transition de vue s'en charge */
    if (opts && opts.switching) {
      if (canVT()) {
        ava.style.viewTransitionName = WHO_VT;
        const t = setTimeout(() => { my.timers.delete(t); ava.style.viewTransitionName = ''; }, 1000);
        my.timers.add(t);
      } else {
        motion.enter(screen, { from: 'fade', dur: 300 });
      }
      const t2 = setTimeout(() => {
        my.timers.delete(t2);
        if (my !== st) return;
        motion.pop(avaWrap, { scale: 1.12 });
        motion.sparkle(avaWrap, { count: 8 });
      }, motion.reduced() ? 0 : 560);
      my.timers.add(t2);
      try { kit.toast(frTypo('À toi de jouer, ' + p.name + ' ! ' + (MOUNTS[p.companion.type] || MOUNTS.pony).em)); } catch (_) {}
      scheduleTour(1400);
    } else {
      const blocks = [head, bar.shown ? bar.el : null, nextBox.firstChild, petBox, play, alt, instBan.shown ? instBan.el : null].filter(Boolean);
      motion.stagger(blocks, el => motion.enter(el, { from: 'bottom', dist: 14, dur: 420 }), 60);
      scheduleTour(900);
    }
    my.ready = true;
  },

  unmount() { teardown(); }
};
export default HOME;

function teardown() {
  const my = st;
  st = null;
  if (!my) return;
  for (const t of my.timers) clearTimeout(t);
  for (const u of my.unsubs) { try { u(); } catch (_) {} }
  try { if (my.sheet) my.sheet.close('api'); } catch (_) {}
  try { if (my.tour) my.tour.close('nav'); } catch (_) {}
  try { if (my.card) my.card.destroy(); } catch (_) {}
  try { if (my.inst) my.inst.destroy(); } catch (_) {}
  try { if (my.bar) my.bar.destroy(); } catch (_) {}
}
