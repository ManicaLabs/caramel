/* ============ LE GALOP DES TABLES — ma.faits (docs/JEUX.md §4, contrat §7) ============
   Course de profil en parallaxe (nuages, collines, clôture, herbe : couches SVG animées en CSS, vitesse pilotée
   par le playbackRate des animations), compagnon au galop (ctx.petSVG, classe walk), obstacle (botte de foin ou
   rondin) qui arrive de la droite, calcul écrit sur un panneau en bois (la case « … » du panneau EST la zone
   de réponse du pavé du kit).
   - Zen (défaut) : l'obstacle freine et s'arrête devant le compagnon, qui attend.
   - Chrono (settings.timers) : l'obstacle approche en 2 × autoMs avec une jauge douce ; s'il arrive, le
     compagnon s'arrête et attend (jamais d'échec).
   - Juste : saut en arc par-dessus l'obstacle, combo « ⚡ 3 » (🔥 = jours de suite), note qui monte (celebrateRight),
     🍎 qui vole ; le calcul suivant arrive dès la réception (D1-20).
   - Faux : petit trébuchement, bulle d'indice (stratégie item.hint) + panneau de points pour les petits faits,
     nouvel essai ; 2e erreur : réponse dans la case + explication + « J’ai compris ✓ » (contrat §7.3).
   - Voix (bouton 🎤 dans la case libre du pavé) : grammaire L.voiceGrammar() (nombres + mots d'appoint), parseSpoken ;
     juste dès qu'il est entendu, autre nombre stable 1,5 s = essai faux (« J’ai entendu 54… ») ; jamais faux : les
     nombres de l'énoncé, la réponse du calcul précédent (l'enfant la répète pendant que le suivant arrive), « un »
     (hésitations) ; coupée pour les réponses décimales ou > 1 000 (data.voice) ; resetTranscript à chaque item ;
     « 🎤 Micro en pause » tant que la réponse montrée attend « J’ai compris » ; écoute coupée au démontage.
     v2.2.3 (retour terrain : « le micro écoute, l'enfant parle et il se passe rien ») : santé du micro (js/core/speech.js,
     onHealth) : l'oreille 👂 bat quand une voix arrive ; micro muet (le moteur le rouvre lui-même) ou moteur en retard
     (téléphone lent) qui dure → 🎤 barré et une phrase (TROUBLE_MS) ; toucher le 🎤 barré relance l'écoute (l'ancienne
     relance automatique, sur 3 s sans résultat, s'empilait derrière le retard du moteur) ; journal de diagnostic.
   - Micro impossible (refusé, absent, hors ligne) : une phrase d'enfant (ctx.mic.trouble), le pavé reste là (D4-04).
   Logique pure (énoncé, saisie, juge de la voix, vitesses) : js/games/tables-logic.js (tests/tables.test.mjs). */

import { h, svg, clear, fmtNum, frTypo } from '../core/util.js';
import * as dl from '../core/debuglog.js';
import * as L from './tables-logic.js';

const JUMP_MS = 660;            /* saut (élan, envol, réception) */
const LEAP_RATE = 2;            /* vitesse du monde pendant le saut : l'obstacle passe sous le compagnon */
const NEXT_AFTER_LEAP = 0;      /* l'item suivant arrive à la réception (D1-20 : 240 ms de moins entre deux calculs) */
const WRONG_CLEAR_MS = 650;     /* la saisie fausse reste visible, puis la case se vide */
const REVEAL_MS = 420;          /* 2e erreur : la bonne réponse apparaît après la petite secousse */
const SOFT_NEXT_MS = 900;       /* mouvement réduit : délai avant l'item suivant */
const VIS_SCALE = 1.45;        /* dessin d'indice : taille naturelle des points (1 unité = 1,45 px) */
const SHOW_TROUBLE_MS = 1500;   /* micro muet ou moteur en retard depuis 1,5 s : 🎤 barré */
const TROUBLE_MS = 5000;        /* depuis 5 s : une phrase pour l'enfant (une fois par épisode) */
const NNBSP = '\u{202f}';

let inst = null;

export default {
  id: 'tables', title: 'Le Galop des tables', icon: '🏇', axes: ['ma.faits'],
  css: 'css/games/tables.css',
  async mount(root, ctx) {
    if (inst) inst.destroy();
    inst = createTables(root, ctx);
    await inst.start();
  },
  unmount() {
    if (inst) inst.destroy();
    inst = null;
  }
};

function createTables(root, ctx) {
  let alive = true;
  const timers = new Set();
  const cleanups = [];
  const anims = new Set();
  const uid = 'tb' + Math.random().toString(36).slice(2, 8);

  /* ---------- petits outils ---------- */
  const safe = (fn, ...a) => { try { return fn(...a); } catch (e) { console.error('tables', e); return null; } };
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (alive) safe(fn); }, Math.max(0, ms));
    timers.add(id);
    return id;
  };
  const cancel = id => { if (id) { clearTimeout(id); timers.delete(id); } return 0; };
  const nowMs = () => (globalThis.performance && performance.now ? performance.now() : Date.now());
  const reduced = () => { try { return !!ctx.motion.reduced(); } catch (_) { return false; } };
  const settings = () => { try { return ctx.settings || {}; } catch (_) { return {}; } };
  const listen = (target, ev, fn, opts) => {
    if (!target || !target.addEventListener) return;
    target.addEventListener(ev, fn, opts);
    cleanups.push(() => { try { target.removeEventListener(ev, fn, opts); } catch (_) {} });
  };
  const track = a => { if (a) { anims.add(a); a.addEventListener && a.addEventListener('finish', () => anims.delete(a)); } return a; };
  const animate = (el, frames, opts) => { try { return el && el.animate ? track(el.animate(frames, opts)) : null; } catch (_) { return null; } };
  const announce = t => safe(() => ctx.announce(String(t || '')));
  const cheer = kind => { try { return ctx.kit.cheer(kind); } catch (_) { return ''; } };
  /* voix du compagnon (petits lecteurs, js/ui/voice.js) : la question, l'indice, l'explication ; le texte reste affiché.
     Micro demandé (préparation comprise) : rien n'est dit, 🔊 garde la phrase (V22A-4 : le micro n'entend que l'enfant) */
  const micWanted = () => { try { return !!voice.wanted; } catch (_) { return false; } };
  const say = t => { try { return ctx.voice ? Promise.resolve(ctx.voice.say(String(t || ''), { quiet: micWanted() })) : Promise.resolve(false); } catch (_) { return Promise.resolve(false); } };
  const hush = () => { try { if (ctx.voice) ctx.voice.hush(); } catch (_) {} };
  const sound = name => { try { const f = ctx.audio && ctx.audio[name]; if (typeof f === 'function') return f(); } catch (_) {} return null; };

  /* ---------- décor ---------- */

  const layer = (cls, tile, height, shapes) => {
    const id = uid + '-' + cls;
    const pat = svg('pattern', { id, width: String(tile), height: String(height), patternUnits: 'userSpaceOnUse' }, shapes);
    const el = svg('svg', { class: 'tb-layer ' + cls, height: String(height), 'aria-hidden': 'true', focusable: 'false' },
      svg('defs', null, pat), svg('rect', { width: '100%', height: '100%', fill: 'url(#' + id + ')' }));
    el.style.setProperty('--tile', tile + 'px');
    return el;
  };
  const cloud = (x, y, s, cls = 'tb-cloud') => svg('g', { class: cls, transform: `translate(${x} ${y}) scale(${s})` },
    svg('circle', { cx: '18', cy: '20', r: '14' }), svg('circle', { cx: '38', cy: '13', r: '17' }),
    svg('circle', { cx: '58', cy: '21', r: '12' }), svg('rect', { x: '6', y: '20', width: '62', height: '14', rx: '7' }));

  const clouds = layer('tb-clouds', 460, 96, [cloud(30, 14, 1), cloud(250, 44, 0.72), cloud(372, 8, 0.55)]);
  const hillsFar = layer('tb-hills-far', 380, 120, [
    svg('path', { class: 'tb-hill-far', d: 'M0 84 C45 84 72 30 132 30 C192 30 206 70 252 70 C292 70 322 84 380 84 L380 120 L0 120 Z' })]);
  /* collines proches + un pommier (tout reste dans la tuile : un motif SVG coupe ce qui dépasse) */
  const hillsNear = layer('tb-hills-near', 300, 100, [
    svg('path', { class: 'tb-hill-near', d: 'M0 70 C38 70 58 40 106 40 C152 40 166 66 206 66 C240 66 262 70 300 70 L300 100 L0 100 Z' }),
    svg('rect', { class: 'tb-tree-trunk', x: '102', y: '24', width: '6', height: '20', rx: '2' }),
    svg('circle', { class: 'tb-tree-top', cx: '105', cy: '21', r: '13' }),
    svg('circle', { class: 'tb-tree-apple', cx: '99', cy: '18', r: '2.3' }),
    svg('circle', { class: 'tb-tree-apple', cx: '110', cy: '25', r: '2.3' }),
    svg('circle', { class: 'tb-tree-apple', cx: '108', cy: '13', r: '2' })]);
  const fence = layer('tb-fence', 84, 46, [
    svg('rect', { class: 'tb-rail', x: '0', y: '14', width: '84', height: '6', rx: '2' }),
    svg('rect', { class: 'tb-rail', x: '0', y: '28', width: '84', height: '6', rx: '2' }),
    svg('rect', { class: 'tb-post', x: '10', y: '6', width: '9', height: '40', rx: '3' }),
    svg('rect', { class: 'tb-post-cap', x: '10', y: '6', width: '9', height: '4', rx: '2' })]);
  const ground = layer('tb-ground', 64, 48, [
    svg('rect', { class: 'tb-soil', x: '0', y: '6', width: '64', height: '42' }),
    svg('rect', { class: 'tb-turf', x: '0', y: '6', width: '64', height: '5' }),
    svg('path', { class: 'tb-blade', d: 'M4 8 L7 0 L9 8 Z M22 8 L24 2 L27 8 Z M40 8 L44 -1 L46 8 Z M54 8 L57 3 L59 8 Z' }),
    svg('path', { class: 'tb-blade-d', d: 'M12 22 l3 -5 l2 5 Z M34 32 l3 -5 l2 5 Z M50 20 l2 -4 l2 4 Z' }),
    svg('circle', { class: 'tb-flower', cx: '31', cy: '16', r: '2.2' }),
    svg('circle', { class: 'tb-flower b', cx: '58', cy: '38', r: '1.8' })]);

  /* couches de décor agrandies sur les grandes scènes (tablette, ordinateur) : le motif est mis à l'échelle */
  const SCALED = [[clouds, 460, 96], [hillsFar, 380, 120], [hillsNear, 300, 100], [fence, 84, 46]];

  const heroBob = h('div', { class: 'tb-hero-bob', html: ctx.petSVG(100, '') });
  const hero = h('div', { class: 'tb-hero', 'aria-hidden': 'true' }, heroBob);
  const heroSvg = heroBob.querySelector('svg');
  /* saut et trébuchement : c'est le CORPS du rig qui bouge (.c-all) ; son ombre (.c-shadow) reste au sol et la vague
     du dauphin (.c-wave, hors de .c-all) dans l'eau — une seule ombre, toujours au sol (JEUX §0) */
  const heroBody = heroSvg && heroSvg.querySelector('.c-all');
  const heroShadow = heroSvg && heroSvg.getAttribute('data-species') !== 'dolphin' ? heroSvg.querySelector('.c-shadow') : null;
  /* px de l'écran → unités du viewBox du rig (100 unités = largeur du compagnon ; offsetWidth : insensible aux animations) */
  const unit = () => 100 / (hero.offsetWidth || 100);

  const baleSvg = () => svg('svg', { class: 'tb-ob-svg', viewBox: '0 0 64 50', 'aria-hidden': 'true', focusable: 'false' },
    svg('ellipse', { class: 'tb-ob-shadow', cx: '32', cy: '47', rx: '30', ry: '3' }),
    svg('rect', { class: 'tb-bale-body', x: '2', y: '8', width: '60', height: '38', rx: '9' }),
    svg('rect', { class: 'tb-bale-dark', x: '2', y: '34', width: '60', height: '12', rx: '6' }),
    svg('path', { class: 'tb-bale-straw', d: 'M8 16 h8 M27 14 h9 M48 18 h8 M7 26 h7 M26 27 h11 M49 26 h7 M9 38 h7 M28 39 h8 M48 38 h7' }),
    svg('rect', { class: 'tb-bale-band', x: '17', y: '8', width: '5', height: '38' }),
    svg('rect', { class: 'tb-bale-band', x: '42', y: '8', width: '5', height: '38' }),
    svg('rect', { class: 'tb-bale-shine', x: '9', y: '11', width: '46', height: '3.5', rx: '1.75' }),
    svg('path', { class: 'tb-bale-tuft', d: 'M5 10 l2 -6 l3 6 M30 9 l3 -6 l2 6 M56 10 l3 -5 l1 5' }));
  const logSvg = () => svg('svg', { class: 'tb-ob-svg', viewBox: '0 0 64 50', 'aria-hidden': 'true', focusable: 'false' },
    svg('ellipse', { class: 'tb-ob-shadow', cx: '32', cy: '47', rx: '30', ry: '3' }),
    svg('rect', { class: 'tb-log-body', x: '3', y: '16', width: '56', height: '30', rx: '15' }),
    svg('path', { class: 'tb-log-bark', d: 'M12 24 h14 M18 35 h16 M33 22 h9' }),
    svg('rect', { class: 'tb-log-shine', x: '10', y: '19', width: '34', height: '3.5', rx: '1.75' }),
    svg('ellipse', { class: 'tb-log-end', cx: '52', cy: '31', rx: '9', ry: '15' }),
    svg('ellipse', { class: 'tb-log-ring', cx: '52', cy: '31', rx: '5.5', ry: '9.5' }),
    svg('ellipse', { class: 'tb-log-core', cx: '52', cy: '31', rx: '2', ry: '3.5' }),
    svg('path', { class: 'tb-log-leaf', d: 'M24 16 q4 -9 11 -8 q-3 7 -11 8 Z' }));
  const bale = h('div', { class: 'tb-ob is-gone', 'aria-hidden': 'true' });

  const combo = h('div', { class: 'tb-combo is-hidden', 'aria-hidden': 'true' });
  const board = h('div', { class: 'tb-hintboard is-hidden', 'aria-hidden': 'true' });
  const ear = h('p', { class: 'tb-ear is-hidden', 'aria-hidden': 'true' });
  /* mode diagnostic (espace parents) : état du micro en petit sous l'oreille */
  const dbg = dl.enabled() ? h('p', { class: 'tb-dbg', 'aria-hidden': 'true' }) : null;

  const eq = h('div', { class: 'tb-eq' });
  const gaugeFill = h('div', { class: 'tb-gauge-fill' });
  const gauge = h('div', { class: 'tb-gauge is-hidden', 'aria-hidden': 'true' }, gaugeFill);
  const signBoard = h('div', { class: 'tb-sign-board' }, eq, ear, dbg, gauge);
  const sign = h('div', { class: 'tb-sign', role: 'group' },
    h('span', { class: 'tb-rope l', 'aria-hidden': 'true' }), h('span', { class: 'tb-rope r', 'aria-hidden': 'true' }), signBoard, combo);

  const stage = h('div', { class: 'tb-stage' },
    h('div', { class: 'tb-sky', 'aria-hidden': 'true' }),
    h('div', { class: 'tb-sun', 'aria-hidden': 'true' }),
    clouds, hillsFar, hillsNear, fence, ground,
    hero, bale, board, sign);

  const help = h('div', { class: 'tb-help' });
  const pad = h('div', { class: 'tb-pad' });
  const box = h('div', { class: 'tb' }, stage, help, pad);
  root.appendChild(box);

  /* ---------- voix ---------- */
  const voice = { supported: false, wanted: false, on: false, starting: false, pct: null, heard: null, judge: null, timer: 0, err: '',
    engine: null, health: null, troubleSince: 0, troubleKind: '', troubleSaid: '', offHealth: null };
  try { voice.supported = !!(ctx.speech && ctx.speech.speechSupported()); } catch (_) { voice.supported = false; }
  const micBtn = h('button', { type: 'button', class: 'tb-mic', 'aria-pressed': 'false', 'aria-label': 'Répondre à voix haute' },
    h('span', { class: 'tb-mic-ico', 'aria-hidden': 'true' }, '🎤'));
  listen(micBtn, 'click', () => {
    if (voice.wanted && troubled()) { dl.dlog('tables', '🎤 barré touché : écoute relancée'); stopVoice(); startVoice(); }   /* 🎤 barré : on relance */
    else if (voice.wanted) stopVoice();
    else startVoice();
  });

  /* ---------- pavé (la case « … » du panneau est son affichage) ---------- */
  let kp = null, kpDecimal = null;
  function ensureKeypad(decimal) {
    if (kp && kpDecimal === decimal) return;
    if (kp) { const old = kp.answer; kp.destroy(); if (old && old.parentNode) old.remove(); }
    kp = ctx.kit.keypad({ decimal, maxLen: 8, onSubmit: onTyped });
    kpDecimal = decimal;
    kp.answer.classList.add('tb-hole');
    if (voice.supported && !decimal) {
      const gap = kp.el.querySelector('.kit-key-gap');
      if (gap) gap.replaceWith(micBtn);
    }
    kp.el.classList.add('tb-keypad');
    pad.prepend(kp.el);
  }

  /* ---------- état de l'item ---------- */
  let cur = null;               /* { item, parts, info, tries, hinted, resolved, locked, t0, hintShown, boardShown } */
  let ended = false, started = false, firstGallop = true, clip = null, index = 0;
  let prevAnswer = null;        /* réponse du calcul précédent : jamais comptée fausse sur le suivant (répétition, écho) */

  /* ---------- monde : vitesse, obstacle, saut ---------- */
  const world = { rate: 0, applied: -1, raf: 0, last: 0, inLoop: false, phase: 'idle', cruise: 1, x: 0, visible: false, layers: [], legs: null };
  const geo = { W: 0, H: 0, waitX: 0, spawnX: 0, baleW: 56, jumpH: 56, k: 1 };

  function collectLayers() {
    world.layers = [];
    for (const el of stage.querySelectorAll('.tb-layer')) {
      let list = [];
      try { list = el.getAnimations ? el.getAnimations() : []; } catch (_) { list = []; }
      const floor = el.classList.contains('tb-clouds') ? 0.3 : 0;
      for (const a of list) world.layers.push({ a, floor });
    }
    world.applied = -1;
  }
  function applyRate(r) {
    if (Math.abs(r - world.applied) < 0.025 && !(r === 0 && world.applied !== 0)) return;
    world.applied = r;
    for (const { a, floor } of world.layers) { try { a.playbackRate = Math.max(floor, r); } catch (_) {} }
    const running = r > 0.05 && !reduced();
    stage.classList.toggle('is-running', running && r > 0.25);
    if (heroSvg) {
      const had = heroSvg.classList.contains('walk');
      /* style recalculé aussitôt : sinon Chrome perd, pendant une image, le saut ou le trébuchement joué en composition
         « add » sur .c-all quand l'animation CSS du corps change (galop ↔ attente) */
      if (had !== running) { heroSvg.classList.toggle('walk', running); void heroSvg.getBoundingClientRect(); world.legs = null; }
      if (running) {
        if (!world.legs) { try { world.legs = heroSvg.getAnimations({ subtree: true }).filter(a => a.animationName === 'step'); } catch (_) { world.legs = []; } }
        for (const a of world.legs) { try { a.playbackRate = Math.min(1.7, Math.max(0.55, r)); } catch (_) {} }
      }
    }
  }
  /* mesures en coordonnées de la scène (offset* : insensibles aux animations en cours) */
  const signBottom = () => sign.offsetTop + signBoard.offsetTop + signBoard.offsetHeight;
  function layout() {
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!W) return;
    geo.W = W; geo.H = H;
    const k = Math.round(Math.max(1, Math.min(1.7, H / 360)) * 20) / 20;
    if (k !== geo.k) {
      geo.k = k;
      for (const [el, tile, hgt] of SCALED) {
        const pat = el.querySelector('pattern');
        if (pat) pat.setAttribute('patternTransform', k === 1 ? '' : `scale(${k})`);
        el.style.height = Math.round(hgt * k) + 'px';
        el.style.setProperty('--tile', (tile * k) + 'px');
      }
    }
    const hw = hero.offsetWidth, hh = hero.offsetHeight;
    geo.baleW = bale.offsetWidth || Math.round(hw * 0.6) || 56;
    geo.waitX = Math.round(hero.offsetLeft + hw + 2);
    geo.spawnX = Math.round(W + 8);
    const room = hero.offsetTop - signBottom() - 6;
    geo.jumpH = Math.round(Math.max(30, Math.min(room, hh * 0.92, 120)));
    stage.style.setProperty('--tb-jump', geo.jumpH + 'px');
    if (world.phase === 'wait' && world.visible) { world.x = geo.waitX; placeBale(); }
    placeBoard();
  }
  function placeBale() { bale.style.transform = `translate3d(${world.x.toFixed(1)}px, 0, 0)`; }
  function ease(cur0, target, dt, tau) { return cur0 + (target - cur0) * (1 - Math.exp(-dt / tau)); }
  function loop(ts) {
    world.raf = 0;
    if (!alive) return;
    world.inLoop = true;
    let again = false;
    try { again = step(ts); } catch (e) { console.error('tables : animation', e); } finally { world.inLoop = false; }
    if (again && alive) world.raf = requestAnimationFrame(loop);
  }
  /* une image : vitesse du monde selon la phase, position de l'obstacle → true s'il faut continuer */
  function step(ts) {
    const dt = Math.min(0.05, Math.max(0, (ts - (world.last || ts)) / 1000));
    world.last = ts;
    let r = world.rate;
    switch (world.phase) {
      case 'approach': {
        r = L.brakeRate(world.x - geo.waitX, world.cruise);
        if (r === 0) { world.x = geo.waitX; placeBale(); arrive(); }
        break;
      }
      case 'rush': {
        const rem = world.x - geo.waitX;
        if (rem <= 3) { r = LEAP_RATE; leapNow(); } else r = L.rushRate(rem);
        break;
      }
      case 'leap': r = ease(r, LEAP_RATE, dt, 0.08); break;
      case 'run': r = ease(r, 1, dt, 0.25); break;
      default: r = ease(r, 0, dt, 0.12); if (r < 0.01) r = 0;
    }
    world.rate = r;
    if (world.visible && world.phase !== 'wait') {
      world.x -= L.GROUND_SPEED * r * dt;
      if ((world.phase === 'approach' || world.phase === 'rush') && world.x < geo.waitX) world.x = geo.waitX;
      placeBale();
      if (world.x < -geo.baleW - 12) hideBale();
    }
    applyRate(r);
    return !((world.phase === 'wait' || world.phase === 'idle') && r === 0);
  }
  /* relance la boucle si elle dort (jamais deux boucles : appelée depuis la boucle, elle ne fait rien) */
  function kick() {
    if (!alive || world.raf || world.inLoop || reduced()) return;
    world.last = 0;
    try { world.raf = requestAnimationFrame(loop); } catch (_) { world.raf = 0; }
  }
  function hideBale() { world.visible = false; bale.classList.add('is-gone'); }
  function spawnBale() {
    clear(bale);
    const isLog = index % 3 === 2;
    bale.appendChild(isLog ? logSvg() : baleSvg());
    bale.classList.toggle('is-log', isLog);
    bale.classList.remove('is-gone');
    world.visible = true;
    const timersOn = !!settings().timers;
    const autoMs = (cur && cur.item.autoMs) || 3000;
    if (reduced()) {
      world.phase = 'wait'; world.rate = 0; world.x = geo.waitX; placeBale(); applyRate(0);
      animate(bale, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
      if (timersOn) startGauge(2 * autoMs);
      return;
    }
    world.x = geo.spawnX; placeBale();
    world.cruise = L.cruiseRate({ timers: timersOn, distance: geo.spawnX - geo.waitX, autoMs });
    world.phase = 'approach';
    if (timersOn) startGauge(L.approachSeconds(geo.spawnX - geo.waitX, world.cruise) * 1000);
    if (firstGallop) {
      firstGallop = false;
      if (!voice.wanted) clip = sound('clipClop');
    }
    kick();
  }
  function arrive() {
    world.phase = 'wait';
    stopClip();
    endGauge();
  }
  function stopClip() { if (clip && clip.stop) { try { clip.stop(); } catch (_) {} } clip = null; }

  /* jauge douce du chrono : se vide pendant l'approche. Animation Web (pas une transition CSS) : le mouvement réduit
     du système, qui raccourcit les transitions, ne la vide plus d'un coup (D2-06) ; c'est une information, pas un effet */
  let gaugeAnim = null;
  function stopGaugeAnim() { if (gaugeAnim) { try { gaugeAnim.cancel(); } catch (_) {} gaugeAnim = null; } }
  function startGauge(ms) {
    stopGaugeAnim();
    gauge.classList.remove('is-hidden', 'is-out');
    gaugeFill.style.transition = 'none';
    gaugeFill.style.transform = 'scaleX(1)';
    gaugeAnim = animate(gaugeFill, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
      { duration: Math.max(1, Math.round(ms)), easing: 'linear', fill: 'forwards' });
    if (!gaugeAnim) {                                  /* navigateur sans animations Web : transition CSS */
      void gaugeFill.offsetWidth;
      gaugeFill.style.transition = `transform ${Math.round(ms)}ms linear`;
      gaugeFill.style.transform = 'scaleX(0)';
    }
  }
  function endGauge() { gauge.classList.add('is-out'); }
  function hideGauge() { stopGaugeAnim(); gauge.classList.add('is-hidden'); gaugeFill.style.transition = 'none'; }

  /* saut : l'obstacle passe sous le compagnon (monde accéléré pendant l'envol) */
  let leapCb = null;
  function leap(after) {
    leapCb = after;
    stopClip();
    hideGauge();
    if (reduced() || !world.visible) {
      if (world.visible) {
        const a = animate(bale, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-in', fill: 'forwards' });
        later(() => { hideBale(); if (a) try { a.cancel(); } catch (_) {} }, 280);
      }
      const cb = leapCb; leapCb = null;
      later(() => cb && cb(), reduced() ? SOFT_NEXT_MS : 300);
      return;
    }
    if (world.x - geo.waitX > 3) { world.phase = 'rush'; kick(); }
    else leapNow();
  }
  function leapNow() {
    world.phase = 'leap';
    kick();
    sound('whoosh');
    const u = unit(), H = geo.jumpH * u, f = v => (v * u).toFixed(2);
    /* composition « add » : le saut s'ajoute au pas du galop (keyframes step du rig), comme le moteur de vie */
    animate(heroBody, [
      { transform: 'translateY(0px) rotate(0deg) scale(1, 1)', easing: 'ease-out' },
      { transform: `translateY(${f(2)}px) rotate(2deg) scale(1.06, .9)`, offset: 0.13, easing: 'cubic-bezier(.2, .75, .35, 1)' },
      { transform: `translateY(${(-H).toFixed(2)}px) rotate(-10deg) scale(.97, 1.05)`, offset: 0.5, easing: 'cubic-bezier(.55, 0, .85, .45)' },
      { transform: 'translateY(0px) rotate(3deg) scale(1.06, .92)', offset: 0.86, easing: 'ease-out' },
      { transform: 'translateY(0px) rotate(0deg) scale(1, 1)' }
    ], { duration: JUMP_MS, composite: 'add' });
    /* l'ombre reste au sol et suit la hauteur du corps (mêmes temps) : un peu plus large à l'élan et à la réception,
       plus petite et plus pâle en l'air (la flaque du dauphin, elle, ne change pas : mount.css) */
    animate(heroShadow, [
      { transform: 'scale(1)', opacity: 1, easing: 'ease-out' },
      { transform: 'scale(1.04)', opacity: 1, offset: 0.13, easing: 'cubic-bezier(.2, .75, .35, 1)' },
      { transform: 'scale(.55)', opacity: 0.5, offset: 0.5, easing: 'cubic-bezier(.55, 0, .85, .45)' },
      { transform: 'scale(1.04)', opacity: 1, offset: 0.86, easing: 'ease-out' },
      { transform: 'scale(1)', opacity: 1 }
    ], { duration: JUMP_MS });
    later(() => {
      if (world.phase === 'leap') { world.phase = 'run'; kick(); }
      const cb = leapCb; leapCb = null;
      later(() => cb && cb(), NEXT_AFTER_LEAP);
    }, JUMP_MS);
  }
  function stumble() {
    if (reduced()) return;
    const u = unit(), f = v => (v * u).toFixed(2);
    animate(heroBody, [
      { transform: 'translate(0px, 0px) rotate(0deg)' },
      { transform: `translate(${f(3)}px, ${f(2)}px) rotate(7deg)`, offset: 0.28 },
      { transform: `translate(${f(-2)}px, 0px) rotate(-3deg)`, offset: 0.62 },
      { transform: 'translate(0px, 0px) rotate(0deg)' }
    ], { duration: 440, easing: 'ease-out', composite: 'add' });
  }

  /* ---------- panneau ---------- */
  function renderSign(parts) {
    clear(eq);
    for (const p of parts) {
      if (p.k === 'hole') {
        kp.answer.style.setProperty('--tb-hole-ch', String(L.holeChars(cur.item)));
        eq.appendChild(kp.answer);
      } else if (p.k === 'num') eq.appendChild(h('span', { class: 'tb-n' }, p.text));
      else if (p.k === 'word') eq.appendChild(h('span', { class: 'tb-w' }, p.text));
      else eq.appendChild(h('span', { class: 'tb-op' }, p.text));
    }
    sign.setAttribute('aria-label', L.promptAria(parts));
    fitSign();
    if (!reduced()) {
      animate(signBoard, [
        { transform: 'rotate(-2.5deg) translateY(-6px)', opacity: 0.4 },
        { transform: 'rotate(1.2deg) translateY(0)', opacity: 1, offset: 0.55 },
        { transform: 'rotate(0deg) translateY(0)', opacity: 1 }
      ], { duration: 520, easing: 'cubic-bezier(.34, 1.56, .64, 1)' });
    }
  }
  /* le calcul tient sur une ligne : on réduit le corps si besoin */
  function fitSign() {
    eq.style.removeProperty('--tb-fs-k');
    const maxW = signBoard.clientWidth - 16;
    let k = 1;
    for (let i = 0; i < 7 && eq.scrollWidth > maxW && k > 0.55; i++) {
      k -= 0.07;
      eq.style.setProperty('--tb-fs-k', k.toFixed(2));
    }
  }

  /* ---------- bulles ---------- */
  function idleText() {
    return frTypo(!voice.supported ? 'Tape la réponse sur le pavé.'
      : !voice.on ? 'Tape la réponse, ou touche 🎤 et dis-la.'
        : cur && !cur.info.voice ? 'Pour ce calcul, tape la réponse.'
          : 'Dis ta réponse, ou tape-la sur le pavé.');
  }
  function idleLine() { return h('p', { class: 'tb-idle' }, idleText()); }
  const refreshIdle = () => { if (help.querySelector('.tb-idle')) showIdle(); };
  function showBubble(text, kind, icon) {
    clear(help);
    help.appendChild(ctx.kit.bubble(text, kind, { icon }));
  }
  /* « comment répondre » : au premier calcul seulement (divulgation progressive, CDC §1 principe 7) ; ensuite la zone
     d'aide reste vide jusqu'à une bulle (sa hauteur est réservée : rien ne bouge), le pavé et 🎤 suffisent */
  function showIdle() { clear(help); if (index <= 1) help.appendChild(idleLine()); }

  /* ---------- indice visuel (petits faits) ---------- */
  function drawVisual(v) {
    if (v.type === 'array') {
      const P = 11, R = 4, G = 7;
      const cols = v.cols + (v.ghost || 0);
      const nGroups = v.groups.length + (v.ghost ? 1 : 0);
      const W = cols * P + (nGroups - 1) * G, Hh = v.rows * P;
      const s = svg('svg', { class: 'tb-vis', viewBox: `0 0 ${W} ${Hh}`, 'aria-hidden': 'true', focusable: 'false' });
      s.style.width = Math.round(W * VIS_SCALE * geo.k) + 'px';
      let x0 = 0;
      const groups = v.groups.map((n, gi) => ({ n, cls: gi % 2 ? 'g2' : 'g1' }));
      if (v.ghost) groups.push({ n: v.ghost, cls: 'ghost' });
      for (const g of groups) {
        for (let c = 0; c < g.n; c++) {
          for (let r = 0; r < v.rows; r++) {
            s.appendChild(svg('circle', { class: 'tb-dot ' + g.cls, cx: String(x0 + c * P + P / 2), cy: String(r * P + P / 2), r: String(R) }));
          }
        }
        x0 += g.n * P + G;
      }
      return s;
    }
    const boxes = L.frameCells(v);
    const C = 16, PAD = 3, BW = 5 * C + 2 * PAD, BH = 2 * C + 2 * PAD, GAP = 6;
    const Hh = boxes.length * BH + (boxes.length - 1) * GAP;
    const s = svg('svg', { class: 'tb-vis', viewBox: `0 0 ${BW} ${Hh}`, 'aria-hidden': 'true', focusable: 'false' });
    s.style.width = Math.round(BW * VIS_SCALE * geo.k) + 'px';
    boxes.forEach((cells, b) => {
      const y0 = b * (BH + GAP);
      s.appendChild(svg('rect', { class: 'tb-frame', x: '1', y: String(y0 + 1), width: String(BW - 2), height: String(BH - 2), rx: '5' }));
      for (let i = 1; i < 5; i++) s.appendChild(svg('line', { class: 'tb-frame-line', x1: String(PAD + i * C), y1: String(y0 + PAD), x2: String(PAD + i * C), y2: String(y0 + BH - PAD) }));
      s.appendChild(svg('line', { class: 'tb-frame-line', x1: String(PAD), y1: String(y0 + PAD + C), x2: String(BW - PAD), y2: String(y0 + PAD + C) }));
      cells.forEach((kind, i) => {
        if (kind === 'empty') return;
        const cx = PAD + (i % 5) * C + C / 2, cy = y0 + PAD + Math.floor(i / 5) * C + C / 2;
        s.appendChild(svg('circle', { class: 'tb-cell ' + kind, cx: String(cx), cy: String(cy), r: kind === 'missing' ? '5' : '5.5' }));
      });
    });
    return s;
  }
  function showBoard() {
    if (!cur || cur.boardShown) return;
    const v = L.hintVisual(cur.item);
    if (!v) return;
    clear(board);
    board.append(drawVisual(v), h('p', { class: 'tb-vis-cap' }, frTypo(v.caption)));
    cur.boardShown = true;
    board.classList.remove('is-hidden');
    combo.classList.add('is-hidden');
    placeBoard();
    if (board.classList.contains('is-hidden')) return;
    animate(board, reduced() ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'translateY(10px) scale(.92)' }, { opacity: 1, transform: 'none' }],
    { duration: reduced() ? 150 : 320, easing: 'cubic-bezier(.22, 1, .36, 1)' });
  }
  /* le panneau d'indice se plante dans le pré, à droite de l'obstacle, sous le panneau du calcul */
  function placeBoard() {
    if (!cur || !cur.boardShown) return;
    /* le sol est un <svg> : pas d'offsetHeight (→ NaN : panneau d'indice mal placé à 360 × 740, D1-04) */
    const groundH = Math.max(20, (ground.getBoundingClientRect().height || 26) - 6);
    const left = geo.waitX + geo.baleW + 14;
    const width = Math.min(geo.W - left - 10, 260);
    const maxH = Math.floor((geo.H - groundH - 8) - (signBottom() + 10));
    if (width < 104 || maxH < 72) { board.classList.add('is-hidden'); return; }
    board.classList.remove('is-hidden');
    board.style.left = left + 'px';
    board.style.maxWidth = width + 'px';
    board.style.maxHeight = maxH + 'px';
    board.style.setProperty('--tb-vis-max', Math.max(40, maxH - 40) + 'px');
  }
  function hideBoard() { board.classList.add('is-hidden'); clear(board); if (cur) cur.boardShown = false; }

  function showHint(prefix, kind = 'hint') {
    if (!cur) return;
    cur.hintShown = true;
    showBubble((prefix || '') + cur.item.hint, kind, '💡');
    showBoard();
  }

  /* ---------- combo ---------- */
  function showCombo(streak) {
    const label = L.comboLabel(streak);
    if (!label) { combo.classList.add('is-hidden'); return; }
    combo.textContent = label;
    combo.classList.remove('is-hidden');
    safe(() => ctx.motion.pop(combo, { scale: 1.3, dur: 420 }));
  }

  /* ---------- item ---------- */
  /* v2.2.2, voix fluide (ctx.voice.canPrepare) : l'item suivant est tiré dès que celui-ci est rapporté, et sa question
     calculée pendant le saut ; sans voix fluide, ou micro voulu (question pas dite), rien ne change (l'item est tiré à la
     réception) */
  let upcoming = null;
  const lineFor = (item, n) => L.promptAria(L.promptParts(item)) + (item.assist ? ' ' + frTypo('Petit coup de pouce : ') + item.hint : n <= 1 ? ' ' + idleText() : '');
  function peekNext() {
    if (upcoming || !alive || ended || micWanted() || !ctx.voice || !ctx.voice.canPrepare) return;
    const item = safe(() => ctx.nextItem());
    upcoming = { item };
    if (item) safe(() => ctx.voice.prepareNext(lineFor(item, index + 1)));
  }
  function nextItem() {
    if (!alive || ended) return;
    const item = upcoming ? upcoming.item : safe(() => ctx.nextItem());
    upcoming = null;
    if (!item) { finish(); return; }
    prevAnswer = cur && Number.isFinite(cur.info.value) ? cur.info.value : null;
    index++;
    const parts = L.promptParts(item);
    const info = L.answerInfo(item);
    cur = { item, parts, info, tries: 0, hinted: !!item.assist, resolved: false, locked: false, t0: nowMs(), hintShown: false, boardShown: false };
    ensureKeypad(info.decimal);
    removeLearn();
    kp.clear(); kp.setState(null); kp.disable(false);
    kp.answer.classList.remove('tb-revealed');
    hideBoard();
    renderSign(parts);
    if (item.assist) showHint(frTypo('Petit coup de pouce :') + '\n');
    else showIdle();
    resetVoiceForItem();
    renderVoice();
    dl.dlog('tables', 'calcul ' + index, { clé: item.key, réponse: info.value, voix: !!info.voice });
    spawnBale();
    announce(L.promptAria(parts));
    cur.t0 = nowMs();
    /* petits lecteurs : le compagnon dit le calcul (et, au premier, comment répondre) ; le temps d'écoute ne compte
       pas dans la vitesse de réponse */
    const c = cur;
    const line = lineFor(item, index);
    say(line).then(ok => { if (ok && cur === c && !c.resolved && c.tries === 0) c.t0 = nowMs(); });
    /* voix fluide : ni l'astuce ni l'explication ne sont calculées d'avance — un calcul en cours ne s'interrompt pas et
       retarderait la question suivante quand la réponse est juste (mesuré : jusqu'à 2 s en CM2) ; après une erreur,
       l'encouragement enregistré (instantané) couvre l'essentiel de leur calcul */
  }

  function onTyped(str) {
    if (!cur || cur.resolved || cur.locked) return;
    const res = L.checkTyped(str, cur.item);
    if (!res.valid) return;
    dl.dlog('tables', 'tapé ' + str, { juste: !!res.ok });
    if (res.ok) onRight({ ms: nowMs() - cur.t0 });
    else onWrong({ via: 'pad', value: res.value });
  }

  function onRight({ ms }) {
    const c = cur;
    if (!c || c.resolved) return;
    c.resolved = true;
    hush();
    cancelVoiceTimer();
    const hinted = !!(c.hinted || c.tries > 0);
    kp.setState('right');
    kp.disable(true);
    const fb = safe(() => ctx.report(c.item, { correct: true, hinted, ms: Math.max(0, Math.round(ms)), tries: c.tries + 1 })) || {};
    const streak = fb && !fb.ignored ? (fb.streak | 0) : 0;
    peekNext();
    safe(() => ctx.kit.celebrateRight(kp.answer, streak));
    flyApple();
    hideBoard();
    showCombo(hinted ? 0 : streak);
    const msg = cheer(hinted ? 'helped' : 'right');
    showBubble(msg, 'good', '🌟');
    announce(msg);
    resetTranscript();
    leap(() => nextItem());
  }

  function onWrong({ via, value }) {
    const c = cur;
    if (!c || c.resolved || c.locked) return;
    c.tries++;
    c.hinted = true;
    resetVoiceAfterTry();
    if (via === 'voice' && Number.isFinite(value)) kp.set(fmtNum(value).replace(/\s/g, ''));
    kp.setState('wrong');
    safe(() => ctx.kit.gentleWrong(kp.answer));
    stumble();
    if (c.tries === 1) {
      /* la bulle : un mot doux (1 à 3 mots, kit.cheer) puis l'astuce ; dite aux petits lecteurs */
      const head = via === 'voice' ? frTypo('J’ai entendu ' + fmtNum(value) + '…') + '\n' : cheer('retry') + '\n';
      showHint(head);
      announce(head + c.item.hint);
      say(head + c.item.hint);
      later(() => { if (cur === c && !c.resolved && !c.locked) { kp.clear(); kp.setState(null); } }, WRONG_CLEAR_MS);
      return;
    }
    /* 2e erreur : la bonne réponse est montrée, avec l'explication (la jauge du chrono s'efface) ; la voix attend
       « J’ai compris » (« 🎤 Micro en pause » : l'oreille ne dit plus « Je t’écoute ») */
    c.locked = true;
    renderVoice();
    kp.disable(true);
    hideGauge();
    later(() => {
      if (cur !== c) return;
      kp.set(fmtNum(c.info.value).replace(/\s/g, ''));
      kp.setState(null);
      kp.answer.classList.add('tb-revealed');
      safe(() => ctx.motion.pop(kp.answer, { scale: 1.08, dur: 360 }));
      showLearn(c);
    }, REVEAL_MS);
  }

  let learnEl = null;
  function showLearn(c) {
    removeLearn();
    showBoard();                                  /* le dessin d'indice reste (ou apparaît) pour appuyer l'explication */
    clear(help);
    const text = cheer('learn') + '\n' + c.item.explain;
    const ok = h('button', { type: 'button', class: 'btn big block tb-learn-ok' }, frTypo('J’ai compris ✓'));
    learnEl = h('div', { class: 'tb-learn' }, ctx.kit.bubble(text, 'soft'), ok);
    listen(ok, 'click', () => {
      if (cur !== c || c.resolved) return;
      c.resolved = true;
      safe(() => ctx.report(c.item, { correct: false, hinted: true, ms: Math.max(0, Math.round(nowMs() - c.t0)), tries: 2 }));
      peekNext();
      showCombo(0);
      removeLearn();
      hideBoard();
      showIdle();
      leap(() => nextItem());
    });
    if (kp) kp.el.classList.add('is-masked');
    pad.appendChild(learnEl);
    say(text);
    animate(learnEl, reduced() ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: reduced() ? 150 : 300, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    announce(text);
    try { ok.focus({ preventScroll: true }); } catch (_) {}
  }
  function removeLearn() {
    if (learnEl) { learnEl.remove(); learnEl = null; }
    if (kp) kp.el.classList.remove('is-masked');
  }

  function flyApple() {
    const to = ctx.applesEl;
    if (!to || !kp) return;
    safe(() => ctx.motion.flyTo(kp.answer, to, { emoji: '🍎', count: 1, size: 30, onArrive: () => sound('coin') }));
  }

  /* joker 💡 : indice avant de répondre (l'item compte comme aidé) */
  safe(() => ctx.onJoker(() => {
    if (!alive || !cur || cur.resolved || cur.locked) return false;
    if (cur.hintShown) {
      const b = help.querySelector('.kit-bubble');
      if (b) safe(() => ctx.motion.pop(b, { scale: 1.04, dur: 300 }));
      return false;
    }
    cur.hinted = true;
    showHint('');
    announce(cur.item.hint);
    say(cur.item.hint);
    return true;
  }));

  /* ---------- voix ---------- */
  function resetTranscript() { if (voice.on) { try { ctx.speech.resetTranscript(); } catch (_) {} } }
  function cancelVoiceTimer() { voice.timer = cancel(voice.timer); }
  function resetVoiceForItem() {
    cancelVoiceTimer();
    voice.heard = null;
    const ignore = L.shownNumbers(cur ? cur.parts : []).concat(prevAnswer === null ? [] : [prevAnswer]);
    voice.judge = cur && cur.info.voice ? L.createVoiceJudge({ answer: cur.info.value, ignore }) : null;
    resetTranscript();
  }
  function resetVoiceAfterTry() {
    cancelVoiceTimer();
    voice.heard = null;
    if (voice.judge) voice.judge.reset();
    resetTranscript();
    renderVoice();
  }
  function renderVoice() {
    const voiceOk = !!(cur && cur.info.voice && !cur.locked);
    const bad = troubled();
    micBtn.classList.toggle('is-on', voice.on);
    micBtn.classList.toggle('is-starting', voice.starting);
    micBtn.classList.toggle('is-paused', voice.on && !voiceOk);
    micBtn.classList.toggle('is-trouble', !!bad);
    ear.classList.toggle('is-hearing', !!(voice.on && voiceOk && !bad && voice.health && voice.health.voice));
    micBtn.setAttribute('aria-pressed', voice.wanted ? 'true' : 'false');
    micBtn.setAttribute('aria-label', bad ? 'Relancer le micro' : voice.wanted ? 'Arrêter le micro' : 'Répondre à voix haute');
    let text = '';
    /* attente du moteur vocal : une phrase d'enfant, plus de « Téléchargement du moteur » (D1-10) */
    if (voice.starting) {
      text = voice.pct === null ? 'Préparation du micro… 🎙️'
        : voice.pct < 99 ? frTypo('Je me prépare à t’écouter… ') + voice.pct + NNBSP + '%' : frTypo('Presque prêt…');
    }
    else if (voice.on) {
      if (!voiceOk) text = '🎤 Micro en pause';
      else if (bad === 'deaf') text = frTypo('🎤 Je ne t’entends plus… touche 🎤');
      else if (bad === 'slow') text = frTypo('🐢 J’écoute… ton téléphone est un peu lent');
      else if (voice.heard !== null) text = '👂 ' + L.heardLabel(voice.heard);
      else text = frTypo('👂 Je t’écoute…');
    }
    const was = !ear.classList.contains('is-hidden');
    ear.textContent = text;
    ear.classList.toggle('is-hidden', !text);
    if (was !== !!text && started) layout();      /* le panneau change de hauteur : hauteur du saut à revoir */
  }
  async function startVoice(revive = false) {
    if (!voice.supported || voice.wanted || !alive) return;
    hush();                                       /* le micro n'entend que l'enfant : le compagnon se tait */
    voice.wanted = true; voice.starting = true; voice.pct = null; voice.err = '';
    stopClip();
    renderVoice();
    try { ctx.speech.ensureVosk(p => { if (alive && voice.starting) { voice.pct = p; renderVoice(); } }); } catch (_) {}
    /* Android : la voix du compagnon et le micro se disputent le son ; on attend qu'elle se soit tue (v2.2.1) */
    try { if (ctx.voice && ctx.voice.settle) await ctx.voice.settle(); } catch (_) {}
    if (!alive || !voice.wanted) { voice.starting = false; renderVoice(); return; }
    let r = null;
    try {
      r = await ctx.speech.startListening({ grammar: L.voiceGrammar(), onText: onVoiceText, onError: onVoiceError });
    } catch (e) { console.error('tables : micro', e); }
    if (!alive) return;
    voice.starting = false;
    if (!voice.wanted) { renderVoice(); return; }
    if (!r || !r.engine) {
      voice.wanted = false; voice.on = false;
      try { ctx.speech.stopListening(); } catch (_) {}
      if (!voice.err) showVoiceProblem(frTypo('Le micro n’a pas démarré 😕 Touche 🎤 pour réessayer, ou tape la réponse.'));
      renderVoice();
      return;
    }
    voice.on = true;
    voice.engine = r.engine;
    hush();                                       /* au cas où une phrase courrait encore : le micro écoute */
    /* le temps de chargement du micro ne compte pas dans la vitesse de réponse */
    if (cur && !cur.resolved && cur.tries === 0) cur.t0 = nowMs();
    resetVoiceForItem();
    voice.health = null; voice.troubleSince = 0; voice.troubleKind = ''; voice.troubleSaid = '';
    try { if (ctx.speech.onHealth) voice.offHealth = ctx.speech.onHealth(onHealth); } catch (_) {}
    renderVoice();
    refreshIdle();
    if (!revive) announce('Le micro t’écoute.');
    dl.dlog('tables', 'micro allumé', { moteur: r.engine });
  }
  /* santé du micro (js/core/speech.js) : 4 fois par seconde tant qu'il écoute */
  function troubled() {
    return voice.on && voice.troubleKind && voice.troubleSince && nowMs() - voice.troubleSince >= SHOW_TROUBLE_MS ? voice.troubleKind : '';
  }
  function onHealth(hh) {
    if (!alive || !voice.on || !hh) return;
    const prev = voice.health;
    voice.health = hh;
    const kind = hh.state === 'deaf' || hh.state === 'slow' ? hh.state : '';
    const wasBad = troubled();
    if (kind !== voice.troubleKind) { voice.troubleKind = kind; voice.troubleSince = kind ? nowMs() : 0; }
    if (!kind) voice.troubleSaid = '';
    const bad = troubled();
    if (bad !== wasBad) dl.dlog('tables', bad ? '🎤 barré (' + bad + ')' : '🎤 de nouveau normal');
    /* le souci dure : une phrase, une fois par épisode */
    if (kind && voice.troubleSaid !== kind && nowMs() - voice.troubleSince >= TROUBLE_MS) {
      voice.troubleSaid = kind;
      showVoiceProblem(kind === 'deaf' ? frTypo('Le micro ne m’entend plus 😕 Touche 🎤 pour réessayer, ou tape la réponse.')
        : frTypo('Ton téléphone est un peu lent pour m’écouter 🐢 Tu peux aussi taper la réponse.'));
    }
    if (dbg) dbg.textContent = hh.state + ' · son ' + Math.round(hh.level * 100) + (hh.voice ? ' ●' : ' ○') + ' · retard ' +
      (hh.lagMs / 1000).toFixed(1) + ' s · sautés ' + hh.dropped + (hh.reopens ? ' · rouvert ' + hh.reopens : '');
    if (!prev || prev.voice !== hh.voice || bad !== wasBad || prev.state !== hh.state) renderVoice();
  }
  function stopVoice() {
    voice.wanted = false; voice.on = false; voice.starting = false; voice.pct = null; voice.heard = null; voice.engine = null;
    if (voice.offHealth) { try { voice.offHealth(); } catch (_) {} voice.offHealth = null; }
    voice.health = null; voice.troubleSince = 0; voice.troubleKind = '';
    if (dbg) dbg.textContent = '';
    cancelVoiceTimer();
    try { ctx.speech.stopListening(); } catch (_) {}
    renderVoice();
    refreshIdle();
  }
  function showVoiceProblem(msg) {
    voice.err = msg;
    if (cur && !cur.resolved && !cur.locked && !cur.hintShown) { showBubble(msg, 'soft', '🎙️'); say(msg); }
  }
  /* micro impossible (refusé, absent, hors ligne…) : une phrase pour l'enfant, le pavé reste là (D4-04) ; la marche
     à suivre pour l'adulte est dans la course (aide pour l'adulte) */
  function onVoiceError(code, msg) {
    if (!alive) return;
    const t = safe(() => ctx.mic.trouble(code));
    const text = t && t.hard ? t.title + ' ' + frTypo('Tape la réponse avec les touches.') : frTypo(msg || 'Le micro n’a pas démarré 😕');
    if (voice.err === text) return;
    stopVoice();
    showVoiceProblem(text);
  }
  function onVoiceText(text, isFinal) {
    if (!alive || !voice.on || !cur || cur.resolved || cur.locked || !voice.judge) return;
    handleVoice(voice.judge.feed(text, isFinal, nowMs()));
  }
  function handleVoice(ev) {
    if (!ev || !cur || cur.resolved || cur.locked) return;
    if (ev.kind === 'right') {
      dl.dlog('tables', 'voix : juste', { valeur: ev.value });
      voice.heard = ev.value; renderVoice();
      kp.set(fmtNum(ev.value).replace(/\s/g, ''));
      onRight({ ms: (ev.at || nowMs()) - cur.t0 });
      return;
    }
    if (ev.kind === 'wrong') {
      dl.dlog('tables', 'voix : faux', { valeur: ev.value });
      voice.heard = ev.value; renderVoice();
      onWrong({ via: 'voice', value: ev.value });
      return;
    }
    if (ev.kind === 'heard' && ev.value !== voice.heard) { dl.dlog('tables', 'voix : entendu', { valeur: ev.value, ignoré: !!ev.ignored }); voice.heard = ev.value; renderVoice(); }
    if (ev.due) {
      cancelVoiceTimer();
      voice.timer = later(() => {
        voice.timer = 0;
        if (voice.on && voice.judge && cur && !cur.resolved && !cur.locked) handleVoice(voice.judge.tick(nowMs()));
      }, ev.due - nowMs() + 10);
    }
  }

  /* ---------- fin de manche ---------- */
  function finish() {
    if (ended) return;
    ended = true;
    stopVoice();
    stopClip();
    world.phase = 'idle'; kick();
    if (heroSvg) { heroSvg.classList.remove('walk'); if (!reduced()) heroSvg.classList.add('joy'); }
    if (kp) kp.disable(true);
    safe(() => ctx.end());
  }

  /* ---------- cycle de vie ---------- */
  async function start() {
    if (started) return;
    started = true;
    ensureKeypad(false);
    showIdle();
    /* attend une image : styles appliqués, animations CSS créées, mesures fiables */
    await new Promise(res => { try { requestAnimationFrame(() => res()); } catch (_) { setTimeout(res, 16); } });
    if (!alive) return;
    collectLayers();
    applyRate(0);
    layout();
    let ro = null;
    try {
      ro = new ResizeObserver(() => { if (alive) { layout(); if (cur) fitSign(); } });
      ro.observe(stage);
      cleanups.push(() => { try { ro.disconnect(); } catch (_) {} });
    } catch (_) { listen(globalThis, 'resize', () => { layout(); if (cur) fitSign(); }); }
    listen(document, 'visibilitychange', () => { world.last = 0; });
    nextItem();
  }

  function destroy() {
    if (!alive) return;
    alive = false;
    hush();
    for (const id of timers) clearTimeout(id);
    timers.clear();
    if (world.raf) { try { cancelAnimationFrame(world.raf); } catch (_) {} world.raf = 0; }
    for (const a of anims) { try { a.cancel(); } catch (_) {} }
    anims.clear();
    for (const fn of cleanups.splice(0)) fn();
    stopClip();
    if (voice.wanted || voice.on || voice.starting) { try { ctx.speech.stopListening(); } catch (_) {} }
    if (voice.offHealth) { try { voice.offHealth(); } catch (_) {} voice.offHealth = null; }
    voice.on = voice.wanted = voice.starting = false;
    voice.judge = null;
    try { ctx.onJoker(() => false); } catch (_) {}
    if (kp) { try { kp.destroy(); } catch (_) {} kp = null; }
    world.layers = [];
    box.remove();
  }

  return { start, destroy };
}
