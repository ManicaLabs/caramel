/* ============ EN FAMILLE (#/famille) et CONCOURS DE COMPAGNONS (#/famille/concours) ============
   Demande du parent (03/10/2026) : plusieurs enfants sur un même appareil, des classements, un concours de
   compagnons et un défi. Règles de score et de classement : js/core/family.js (documentées en tête, testées).
   Écran principal :
     « ⚔️ Défi en famille » (gros bouton → #/battle) ;
     « 🏆 Classements de la semaine » : cinq podiums en onglets (minutes, pommes, série, étoiles de lecture, trophées
        de défi) — effort et engagement seulement, jamais le niveau ; « Bravo aussi à… », « Bravo à tous ! » ;
     « 🎪 Concours de compagnons » : aperçu des compagnons, champion de la semaine, bouton → spectacle.
   Un seul profil : invitation bienveillante à ajouter un frère, une sœur ou un copain.
   Spectacle (#/famille/concours) : rideaux, chaque compagnon défile sur la scène, trois juges lèvent leur note
   (comptes animés), puis podium 🥇🥈🥉 (le gagnant danse), un ruban pour chacun ; le gagnant de la semaine reçoit
   un trophée une seule fois par semaine (profile.trophies, economy.addTrophy). « Passer ⏭ » va droit au podium ;
   mouvement réduit : les déplacements (rideaux, entrée et sortie des compagnons) deviennent des fondus, les temps
   de lecture restent les mêmes.
   Thèmes : la page suit le thème de l'enfant actif ; la vignette de chaque enfant porte data-theme = SON thème.
   Outils partagés avec js/ui/battle.js : petReady, petHTML, putPet (vie légère), petMood, lifeOf, podiumEl, petLabel,
   plural, themeIdOf. Élision (« d’Inès ») et listes (« A, B et C ») : deNom et frList de js/core/util.js. */

import { h, clear, dayStr, frTypo, loadCSS, fmtNum, deNom, frList } from '../core/util.js';
import * as store from '../core/store.js';
import * as router from '../router.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import { MOUNTS } from '../content/companion-data.js';
import { themeOf } from '../core/themes.js';
import { addTrophy } from '../core/economy.js';
import { mountReady, avatarOf, setAvatar } from './companion.js';
import * as F from '../core/family.js';

/* ============ OUTILS PARTAGÉS ============ */
/* compagnon dessiné avec son STADE (mountSVG, opts { expr, stage } + view 'portrait' pour les avatars ronds, phase) ;
   moteur de vie léger (liven) si disponible */
let svgFn = null, life = null, petLoading = null;
export function petReady() {
  if (!petLoading) {
    petLoading = Promise.all([
      mountReady(),
      import('./mount-svg.js').then(m => { if (m && typeof m.mountSVG === 'function') svgFn = m.mountSVG; }).catch(() => {}),
      import('./companion-life.js').then(m => { if (m && typeof m.liven === 'function') life = m; }).catch(() => {})
    ]).then(() => undefined);
  }
  return petLoading;
}
export function petHTML(p, size, mood = '', expr = 'neutral', opts = {}) {
  const c = (p && p.companion) || {};
  const o = opts && typeof opts === 'object' ? opts : {};
  if (svgFn) {
    try {
      const s = svgFn(c.type, c.equip && c.equip.worn, size, mood, Object.assign({ expr, stage: F.stageOf(c) }, o));
      if (typeof s === 'string' && s.indexOf('<svg') >= 0) return s;
    } catch (e) { try { console.warn('mountSVG', e); } catch (_) {} }
  }
  return avatarOf(p, size, mood, o);
}
/* dessine le compagnon de p dans el, avec la vie LÉGÈRE de js/ui/companion-life.js (liven, posée par
   companion.setAvatar : regard, clignements, joie au toucher ; elle rejoue aussi les poses couché / tête basse) ;
   live: false pour les toutes petites vignettes ; view: 'portrait' = cadrage tête des avatars RONDS (carré rogné) ;
   phase (s) = décalage de l'attente quand plusieurs compagnons se côtoient → contrôleur de vie, ou null */
export function putPet(el, p, size, mood = '', { expr = 'neutral', live = true, view, phase } = {}) {
  const o = {};
  if (view) o.view = view;
  if (Number.isFinite(phase)) o.phase = phase;
  setAvatar(el, petHTML(p, size, mood, expr, o), { live });
  return live ? lifeOf(el) : null;
}
/* contrôleur de vie existant (célébration du gagnant…) */
export function lifeOf(el) {
  try { const svg = el && el.querySelector ? el.querySelector('svg') : null; return svg && life && life.lifeOf ? life.lifeOf(svg) : null; } catch (_) { return null; }
}
const MOODS = ['walk', 'joy', 'sad', 'dance', 'sleep', 'eat', 'hop', 'wiggle'];
/* humeurs à POSE (couché, tête basse) : mount.css les décrit avec rotate / translate, que le moteur de vie neutralise
   et rejoue lui-même d'après ce qu'il lit à sa création → un compagnon vivant est relancé après le changement */
const POSED = ['sleep', 'sad'];
/* humeur du rig (classe sur la racine du SVG) ; une humeur ponctuelle (joy, hop) est rejouée */
export function petMood(el, mood = '') {
  const svg = el && el.querySelector ? el.querySelector('svg') : null;
  if (!svg) return;
  const lf = POSED.includes(mood) || POSED.some(m => svg.classList.contains(m)) ? lifeOf(el) : null;
  if (lf) { try { lf.destroy(); } catch (_) {} }       /* rend au SVG ses classes d'origine */
  for (const m of MOODS) svg.classList.remove(m);
  if (mood) { void svg.getBoundingClientRect(); svg.classList.add(mood); }
  if (lf && life) { try { life.liven(el); } catch (_) {} }
}
export const themeIdOf = p => themeOf(p && p.settings && p.settings.theme).id;
/* « Caramel, le poney de Léa » */
export function petLabel(p) {
  const c = (p && p.companion) || {};
  const m = MOUNTS[c.type] || MOUNTS.pony;
  return (c.name || 'Caramel') + ', ' + (m.g === 'f' ? 'la ' : 'le ') + m.noun + ' ' + deNom(p.name);
}
export const plural = (n, one, many) => fmtNum(n) + '\u00a0' + (Math.abs(n) >= 2 ? many : one);
const MEDAL_NAME = { or: 'médaille d’or', argent: 'médaille d’argent', bronze: 'médaille de bronze' };

/* podium : rows = lignes classées (rank, medal ; family.js) ; byId = Map id → profil ;
   valueText(row) → texte sous le prénom ; colonnes argent · or · bronze, plusieurs enfants par marche si ex aequo */
export function podiumEl(rows, { byId, valueText, size = 64, label = 'Podium', live = true } = {}) {
  const groups = { or: [], argent: [], bronze: [] };
  for (const r of Array.isArray(rows) ? rows : []) if (r && r.medal && groups[r.medal]) groups[r.medal].push(r);
  const order = ['argent', 'or', 'bronze'].filter(m => groups[m].length);
  const el = h('div', { class: 'fm-podium cols-' + order.length, role: 'list', 'aria-label': label });
  for (const m of order) {
    const who = groups[m];
    const k = who.length;
    const sz = Math.round(size * (k >= 3 ? 0.6 : k === 2 ? 0.78 : 1) * (m === 'or' ? 1.12 : 1));
    const people = h('div', { class: 'fm-step-who' + (k > 1 ? ' is-tie' : '') });
    for (const r of who) {
      const p = byId && byId.get(r.id);
      if (!p) continue;
      const pic = h('span', { class: 'fm-who-pic' });
      putPet(pic, p, sz, '', { expr: m === 'or' ? 'proud' : 'happy', live });
      const val = typeof valueText === 'function' ? valueText(r, p) : '';
      people.appendChild(h('div', {
        class: 'fm-who', 'data-theme': themeIdOf(p), 'data-id': p.id, role: 'listitem',
        'aria-label': p.name + ' : ' + MEDAL_NAME[m] + (r.tie ? ' ex aequo' : '') + (val ? ', ' + val : '')
      }, pic, h('span', { class: 'fm-who-name', 'aria-hidden': 'true' }, p.name),
      val ? h('span', { class: 'fm-who-val', 'aria-hidden': 'true' }, val) : null));
    }
    el.appendChild(h('div', { class: 'fm-step is-' + m }, people,
      h('div', { class: 'fm-step-block', 'aria-hidden': 'true' }, h('span', { class: 'fm-step-medal' }, F.MEDAL_EMOJI[m]))));
  }
  return el;
}

/* ============ ÉCRAN ============ */
let st = null;
const TAB_SHORT = { minutes: 'Minutes', apples: 'Pommes', streak: 'Série', stars: 'Étoiles', trophies: 'Défis' };
/* texte d'une valeur de classement */
function boardValueText(id, v) {
  switch (id) {
    case 'minutes': return fmtNum(v) + '\u00a0min';
    case 'apples': return fmtNum(v) + '\u00a0🍎';
    case 'streak': return plural(v, 'jour', 'jours') + '\u00a0🔥';
    case 'stars': return fmtNum(v) + '\u00a0⭐';
    case 'trophies': return plural(v, 'trophée', 'trophées');
    default: return fmtNum(v);
  }
}
/* encouragement pour qui n'a encore rien cette semaine (jamais « dernier ») */
const ZERO_TEXT = {
  minutes: 'à toi de jouer !', apples: 'à toi de cueillir !', streak: 'une série commence aujourd’hui ?',
  stars: 'une histoire t’attend !', trophies: 'au prochain défi !'
};

export default {
  async mount(root, params) {
    await Promise.all([loadCSS('css/ui/famille.css'), petReady()]);
    if (!root.isConnected) return;
    teardown();
    const list = store.listProfiles();
    if (!list.length) { router.go('onboarding', { replace: true }); return; }
    const my = st = { root, timers: new Set(), wakers: new Set(), skip: false, unsubs: [] };
    const part = params && params.part;
    if (part === 'concours') {
      if (list.length < 2) { router.go('famille', { replace: true }); return; }
      showConcours(root, my, list);
      return;
    }
    if (part) { router.go('famille', { replace: true }); return; }
    mainScreen(root, my, list);
  },
  unmount() { teardown(); }
};

function teardown() {
  const my = st;
  st = null;
  if (!my) return;
  my.dead = true;
  for (const t of my.timers) clearTimeout(t);
  my.timers.clear();
  for (const w of my.wakers) { try { w(); } catch (_) {} }
  my.wakers.clear();
  for (const u of my.unsubs) { try { u(); } catch (_) {} }
  try { document.documentElement.classList.remove('fm-showing'); } catch (_) {}
}

function topbar(title, extra) {
  const back = h('button', { type: 'button', class: 'back', 'aria-label': 'Retour' }, '←');
  back.addEventListener('click', () => { audio.tap(); router.back(); });
  return h('div', { class: 'topbar fm-top' }, back, h('h1', { class: 'topbar-title fm-title' }, title),
    extra || h('span', { class: 'fm-top-gap', 'aria-hidden': 'true' }));
}

/* ---------- écran principal ---------- */
function mainScreen(root, my, list) {
  const today = dayStr();
  const byId = new Map(list.map(p => [p.id, p]));
  const top = topbar('En famille 🏆');

  if (list.length < 2) {
    const p = list[0];
    const pic = h('div', { class: 'fm-invite-pic', 'aria-hidden': 'true' });
    putPet(pic, p, 120, '', { expr: 'happy', live: true });
    const add = h('button', { type: 'button', class: 'btn big block' }, '➕ Ajouter un enfant');
    add.addEventListener('click', () => { audio.tap(); router.go('onboarding'); });
    const card = h('section', { class: 'card hero fm-invite' },
      pic,
      h('h2', { class: 'fm-invite-title' }, frTypo('C’est encore plus drôle à plusieurs !')),
      h('p', { class: 'fm-invite-txt' }, frTypo('Ajoute un frère, une sœur ou un copain : chacun aura son compagnon et sa progression, '
        + 'et vous pourrez vous lancer des défis, comparer vos efforts de la semaine et organiser un concours de compagnons.')),
      h('ul', { class: 'fm-invite-list' },
        h('li', null, h('span', { 'aria-hidden': 'true' }, '⚔️'), ' Des défis où chacun a des questions à son niveau'),
        h('li', null, h('span', { 'aria-hidden': 'true' }, '🏆'), ' Des classements de la semaine… sur l’effort'),
        h('li', null, h('span', { 'aria-hidden': 'true' }, '🎪'), ' Un grand concours de compagnons')),
      add);
    const screen = h('div', { class: 'screen fm' }, top, card);
    clear(root);
    root.appendChild(screen);
    motion.stagger([card], el => motion.enter(el, { from: 'bottom' }));
    return;
  }

  /* ----- défi ----- */
  const heroPets = h('div', { class: 'fm-hero-pets', 'aria-hidden': 'true' });
  for (const p of list.slice(0, 6)) {
    const s = h('span', { class: 'fm-hero-pet', 'data-theme': themeIdOf(p) });
    const pic = h('span', { class: 'fm-hero-pic' });
    putPet(pic, p, list.length > 3 ? 64 : 78, '', { expr: 'happy', live: true });
    s.append(pic, h('span', { class: 'fm-hero-name' }, p.name));
    heroPets.appendChild(s);
  }
  const go = h('button', { type: 'button', class: 'btn big block fm-hero-go' }, h('span', { 'aria-hidden': 'true' }, '⚔️'), 'Lancer un défi');
  go.addEventListener('click', () => { audio.tap(); router.go('battle'); });
  const hero = h('section', { class: 'card hero fm-hero', 'aria-labelledby': 'fm-hero-t' },
    h('h2', { class: 'fm-h2', id: 'fm-hero-t' }, h('span', { class: 'fm-h2-ico', 'aria-hidden': 'true' }, '⚔️'), 'Défi en famille'),
    h('p', { class: 'fm-sub' }, frTypo('Tables, calcul éclair, conjugaison… Chacun reçoit des questions à son niveau : tout le monde peut gagner !')),
    heroPets, go);

  /* ----- classements de la semaine ----- */
  const range = F.weekRange(today);
  const boards = F.weeklyBoards(list, today);
  const tabs = h('div', { class: 'fm-tabs', role: 'tablist', 'aria-label': 'Classements de la semaine' });
  const panel = h('div', { class: 'fm-board', role: 'tabpanel', id: 'fm-board', tabindex: '0' });
  const tabBtns = boards.map((b, i) => {
    const t = h('button', { type: 'button', role: 'tab', class: 'fm-tab', id: 'fm-tab-' + b.id, 'aria-controls': 'fm-board',
      'aria-selected': i === 0 ? 'true' : 'false', tabindex: i === 0 ? '0' : '-1', 'data-id': b.id },
    h('span', { class: 'fm-tab-ico', 'aria-hidden': 'true' }, b.icon), h('span', { class: 'fm-tab-txt' }, TAB_SHORT[b.id]));
    t.addEventListener('click', () => { if (my.board !== i) { audio.tap(); showBoard(i, true); } });
    return t;
  });
  tabs.append(...tabBtns);
  tabs.addEventListener('keydown', e => {
    const k = e.key;
    let j = -1;
    if (k === 'ArrowRight') j = (my.board + 1) % boards.length;
    else if (k === 'ArrowLeft') j = (my.board - 1 + boards.length) % boards.length;
    else if (k === 'Home') j = 0;
    else if (k === 'End') j = boards.length - 1;
    if (j < 0) return;
    e.preventDefault();
    showBoard(j, true);
    try { tabBtns[j].focus(); } catch (_) {}
  });
  /* balayage horizontal sur le panneau : classement suivant / précédent */
  let sx = null;
  panel.addEventListener('pointerdown', e => { sx = e.isPrimary ? { x: e.clientX, y: e.clientY } : null; });
  panel.addEventListener('pointerup', e => {
    if (!sx) return;
    const dx = e.clientX - sx.x, dy = e.clientY - sx.y;
    sx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) showBoard((my.board + (dx < 0 ? 1 : boards.length - 1)) % boards.length, true, dx < 0 ? 'right' : 'left');
  });
  panel.addEventListener('pointercancel', () => { sx = null; });

  function showBoard(i, animate, from) {
    my.board = i;
    tabBtns.forEach((t, k) => { t.setAttribute('aria-selected', k === i ? 'true' : 'false'); t.tabIndex = k === i ? 0 : -1; });
    const b = boards[i];
    panel.setAttribute('aria-labelledby', 'fm-tab-' + b.id);
    clear(panel);
    const head = h('div', { class: 'fm-board-head' },
      h('span', { class: 'fm-board-ico', 'aria-hidden': 'true' }, b.icon),
      h('div', { class: 'fm-board-txt' }, h('h3', { class: 'fm-board-title' }, b.title), h('p', { class: 'fm-board-what' }, frTypo(b.what))));
    panel.appendChild(head);
    let pod = null;
    const chip = (r, text) => {
      const p = byId.get(r.id);
      if (!p) return null;
      const pic = h('span', { class: 'fm-chip-pic', 'aria-hidden': 'true' });
      putPet(pic, p, 36, '', { expr: 'happy', live: false, view: 'portrait' });
      return h('span', { class: 'fm-chip', 'data-theme': themeIdOf(p) }, pic, h('b', null, p.name),
        text ? h('span', { class: 'fm-chip-v' }, frTypo(' : ' + text)) : null);
    };
    if (b.empty) {
      /* personne n'a encore de point : un encouragement et la ligne de départ */
      panel.appendChild(h('p', { class: 'fm-empty' }, frTypo(b.emptyText)));
      panel.appendChild(h('div', { class: 'fm-others is-start' }, b.rows.map(r => chip(r, ''))));
    } else {
      pod = podiumEl(b.podium, { byId, valueText: r => boardValueText(b.id, r.value), size: 66, label: b.title });
      panel.appendChild(pod);
      const plus = b.others.filter(r => r.value > 0), zero = b.others.filter(r => r.value <= 0);
      if (plus.length) {
        panel.appendChild(h('div', { class: 'fm-others-box' }, h('p', { class: 'fm-others-t' }, 'Bravo aussi à'),
          h('div', { class: 'fm-others' }, plus.map(r => chip(r, boardValueText(b.id, r.value))))));
      }
      if (zero.length) panel.appendChild(h('div', { class: 'fm-others' }, zero.map(r => chip(r, ZERO_TEXT[b.id]))));
    }
    panel.appendChild(h('p', { class: 'fm-bravo' }, frTypo(b.empty ? 'À vos marques… 🚀' : 'Bravo à tous ! 👏')));
    if (animate) {
      if (from) motion.enter(panel, { from, dist: 22, dur: 320 });
      if (pod) motion.stagger(pod.querySelectorAll('.fm-step'), el => motion.enter(el, { from: 'bottom', dur: 380 }), 80);
    }
    if (pod && animate !== false) {
      const gold = pod.querySelector('.fm-step.is-or .fm-who-pic');
      if (gold) {
        const t = setTimeout(() => { my.timers.delete(t); if (st === my && gold.isConnected) motion.sparkle(gold, { count: 8 }); }, 420);
        my.timers.add(t);
      }
    }
  }

  const rank = h('section', { class: 'card fm-rank', 'aria-labelledby': 'fm-rank-t' },
    h('h2', { class: 'fm-h2', id: 'fm-rank-t' }, h('span', { class: 'fm-h2-ico', 'aria-hidden': 'true' }, '🏆'), 'Classements de la semaine'),
    h('p', { class: 'fm-sub fm-week' }, frTypo('Semaine ' + range.label + ' · on repart de zéro chaque lundi.')),
    tabs, panel);

  /* ----- concours ----- */
  const w = range.w;
  const awarded = F.concoursAwarded(list, w).map(id => byId.get(id)).filter(Boolean);
  const pets = h('div', { class: 'fm-cc-pets', 'aria-hidden': 'true' });
  for (const p of list.slice(0, 6)) {
    const stg = F.stageOf(p.companion);
    const pic = h('span', { class: 'fm-cc-pic' });
    putPet(pic, p, 60, '', { expr: 'neutral' });
    pets.appendChild(h('span', { class: 'fm-cc-pet' }, pic, h('span', { class: 'fm-cc-stage is-s' + stg }, F.STAGE_NAMES[stg])));
  }
  const champ = awarded.length
    ? h('p', { class: 'fm-champ' }, h('span', { class: 'fm-champ-ico', 'aria-hidden': 'true' }, '🏆'),
      h('span', null, frTypo((awarded.length > 1 ? 'Champions de la semaine : ' : 'Champion de la semaine : ')
        + frList(awarded.map(p => petLabel(p))) + ' !')))
    : h('p', { class: 'fm-champ is-open' }, h('span', { class: 'fm-champ-ico', 'aria-hidden': 'true' }, '🎀'),
      h('span', null, frTypo('Le trophée de la semaine attend son champion !')));
  const show = h('button', { type: 'button', class: 'btn block fm-cc-go' }, h('span', { 'aria-hidden': 'true' }, '🎪'), frTypo('Lancer le concours !'));
  show.addEventListener('click', () => { audio.tap(); router.go('famille/concours'); });
  const contest = h('section', { class: 'card fm-cc', 'aria-labelledby': 'fm-cc-t' },
    h('h2', { class: 'fm-h2', id: 'fm-cc-t' }, h('span', { class: 'fm-h2-ico', 'aria-hidden': 'true' }, '🎪'), 'Concours de compagnons'),
    h('p', { class: 'fm-sub' }, frTypo('Le compagnon le plus évolué gagne ! Le jury note la croissance 🌱, les soins 💖 et l’élégance ✨.')),
    pets, champ, show);

  const colA = h('div', { class: 'fm-col' }, hero, contest);
  const colB = h('div', { class: 'fm-col' }, rank);
  const screen = h('div', { class: 'screen fm' }, top, h('div', { class: 'fm-grid' }, colA, colB));
  clear(root);
  root.appendChild(screen);
  showBoard(0, false);
  motion.stagger([hero, rank, contest], el => motion.enter(el, { from: 'bottom', dist: 14, dur: 420 }), 70);
}

/* ---------- spectacle du concours ---------- */
function showConcours(root, my, list) {
  const today = dayStr();
  const w = F.weekRange(today).w;
  const byId = new Map(list.map(p => [p.id, p]));
  const results = F.concoursResults(list, Date.now());
  const resById = new Map(results.map(r => [r.id, r]));
  const soft = () => motion.reduced();
  const OPEN = 84;                               /* rideaux ouverts : un pan reste visible de chaque côté */
  const dead = () => st !== my || my.dead;
  /* attente interrompue par « Passer » ou le démontage ; mouvement réduit : mêmes temps de lecture (seuls les
     déplacements deviennent des fondus) */
  const wait = ms => new Promise(res => {
    if (my.skip || dead()) { res(); return; }
    const fin = () => { clearTimeout(t); my.timers.delete(t); my.wakers.delete(fin); res(); };
    const t = setTimeout(fin, ms);
    my.timers.add(t);
    my.wakers.add(fin);
  });

  const skip = h('button', { type: 'button', class: 'btn ghost fm-skip' }, 'Passer ⏭');
  const top = topbar('Le grand concours 🎪', skip);
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const curtainL = h('div', { class: 'fm-curtain is-l', 'aria-hidden': 'true' });
  const curtainR = h('div', { class: 'fm-curtain is-r', 'aria-hidden': 'true' });
  const banner = h('p', { class: 'fm-banner' }, frTypo('Le grand concours des compagnons !'));
  const walker = h('div', { class: 'fm-walker', 'aria-hidden': 'true' });
  const plate = h('p', { class: 'fm-plate' });
  const judges = F.JURY.map(j => {
    const n = h('b', { class: 'fm-card-n' }, '0');
    const card = h('div', { class: 'fm-card' }, h('span', { class: 'fm-card-ico', 'aria-hidden': 'true' }, j.icon), n);
    const el = h('div', { class: 'fm-judge' },
      h('span', { class: 'fm-judge-ico', 'aria-hidden': 'true' }, j.judge), card,
      h('span', { class: 'fm-judge-name' }, j.title));
    return { j, el, card, n };
  });
  const totalN = h('b', { class: 'fm-total-n' }, '0');
  const total = h('p', { class: 'fm-total' }, frTypo('Total :') + ' ', totalN, '\u00a0points');
  const jury = h('div', { class: 'fm-jury' }, judges.map(x => x.el));
  const floor = h('div', { class: 'fm-floor', 'aria-hidden': 'true' }, h('div', { class: 'fm-spot' }), walker);
  const scene = h('div', { class: 'fm-scene' }, banner, floor, plate, jury, total);
  const stage = h('div', { class: 'fm-stage' }, h('div', { class: 'fm-lights', 'aria-hidden': 'true' }),
    h('div', { class: 'fm-bulbs', 'aria-hidden': 'true' }), scene, curtainL, curtainR);
  const page = h('div', { class: 'screen is-full fm-show' }, top, stage, live);
  clear(root);
  root.appendChild(page);
  document.documentElement.classList.add('fm-showing');

  skip.addEventListener('click', () => {
    if (my.skip) return;
    audio.tap();
    my.skip = true;
    for (const fin of [...my.wakers]) fin();
  });

  /* compagnon aussi grand que la scène le permet (largeur 100 → hauteur 84) */
  const walkerSize = () => {
    const fw = floor.clientWidth || 300, fh = floor.clientHeight || 220;
    return Math.round(Math.min(280, Math.max(120, Math.min(fw * 0.62, (fh * 0.86) / 0.84))));
  };
  function hideCards() {
    for (const x of judges) { x.card.classList.remove('is-up'); x.n.textContent = '0'; }
    total.classList.remove('is-up');
    plate.classList.remove('is-up');
  }
  async function parade(p, idx) {
    const r = resById.get(p.id);
    hideCards();
    try { walker.getAnimations().forEach(an => an.cancel()); } catch (_) {}   /* la sortie du précédent (fill: forwards) */
    putPet(walker, p, walkerSize(), soft() ? '' : 'walk', { expr: 'happy' });
    plate.textContent = '';
    if (!soft()) {
      audio.whoosh();
      try { walker.animate([{ transform: 'translateX(-115vw)' }, { transform: 'translateX(0)' }], { duration: 1150, easing: motion.EASE.out, fill: 'backwards' }); } catch (_) {}
      await wait(1150);
    } else {
      motion.enter(walker, { from: 'fade', dur: 300 });
      await wait(450);
    }
    if (dead() || my.skip) return;
    petMood(walker, 'joy');
    plate.textContent = frTypo((idx === 0 ? 'Voici ' : 'Et voici ') + petLabel(p) + ' !');
    plate.classList.add('is-up');
    live.textContent = plate.textContent;
    await wait(700);
    for (let i = 0; i < judges.length; i++) {
      if (dead() || my.skip) return;
      const x = judges[i];
      const v = r.score.notes[x.j.id];
      x.card.classList.add('is-up');
      motion.pop(x.card, { scale: 1.12, dur: 360 });
      motion.countUp(x.n, 0, v, soft() ? 0 : 520);
      audio.success(2 + i * 2);
      await wait(620);
    }
    if (dead() || my.skip) return;
    total.classList.add('is-up');
    motion.countUp(totalN, 0, r.total, soft() ? 0 : 600);
    motion.pop(total, { scale: 1.08 });
    audio.coin();
    live.textContent = frTypo(petLabel(p) + ' : croissance ' + r.score.notes.growth + ', soins ' + r.score.notes.care
      + ', élégance ' + r.score.notes.style + ' ; total ' + r.total + ' points.');
    await wait(1500);
    if (dead() || my.skip) return;
    if (!soft()) {
      petMood(walker, 'walk');
      try { walker.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(115vw)' }], { duration: 950, easing: motion.EASE.in, fill: 'forwards' }); } catch (_) {}
      await wait(950);
    } else {
      try { walker.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: 'ease-in', fill: 'forwards' }); } catch (_) {}
      await wait(260);
    }
  }

  async function run() {
    if (!soft()) {
      audio.whoosh();
      try {
        curtainL.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + -OPEN + '%)' }], { duration: 900, delay: 250, easing: motion.EASE.inOut, fill: 'forwards' });
        curtainR.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + OPEN + '%)' }], { duration: 900, delay: 250, easing: motion.EASE.inOut, fill: 'forwards' });
      } catch (_) {}
      motion.enter(banner, { from: 'scale', delay: 700 });
      await wait(1250);
    } else {
      curtainL.style.transform = 'translateX(' + -OPEN + '%)';
      curtainR.style.transform = 'translateX(' + OPEN + '%)';
      await wait(700);                             /* le temps de lire la bannière */
    }
    for (let i = 0; i < list.length; i++) {
      if (dead() || my.skip) break;
      await parade(list[i], i);
    }
    if (dead()) return;
    finale();
  }

  function finale() {
    skip.hidden = true;
    curtainL.style.transform = 'translateX(' + -OPEN + '%)';
    curtainR.style.transform = 'translateX(' + OPEN + '%)';
    try { curtainL.getAnimations().forEach(a => a.cancel()); curtainR.getAnimations().forEach(a => a.cancel()); } catch (_) {}
    clear(scene);
    /* trophée de la semaine : une seule fois par semaine */
    const fresh = F.concoursWinnersToAward(results, store.listProfiles(), w);
    for (const id of fresh) {
      const r = resById.get(id);
      store.mutateProfile(q => { addTrophy(q, 'concours', today, { score: r.total, n: list.length }); }, id);
    }
    const winners = results.filter(r => r.rank === 1).map(r => byId.get(r.id)).filter(Boolean);
    const pod = podiumEl(results, { byId, valueText: r => fmtNum(r.total) + '\u00a0pts', size: 92, label: 'Podium du concours', live: true });
    const title = h('h2', { class: 'fm-final-title' }, frTypo('Bravo à tous les compagnons !'));
    const ribbons = h('ul', { class: 'fm-ribbons', 'aria-label': 'Un ruban pour chacun' });
    for (const p of list) {
      const r = resById.get(p.id);
      const pic = h('span', { class: 'fm-rib-pic', 'aria-hidden': 'true' });
      putPet(pic, p, 52, '', { expr: 'happy', view: 'portrait' });
      ribbons.appendChild(h('li', { class: 'fm-rib', 'data-theme': themeIdOf(p) }, pic,
        h('span', { class: 'fm-rib-txt' },
          h('b', null, frTypo(petLabel(p))),
          h('span', { class: 'fm-rib-lab' }, h('span', { 'aria-hidden': 'true' }, r.ribbon.best ? '🏵️ ' : '🎀 '), r.ribbon.label),
          h('span', { class: 'fm-rib-pts' }, fmtNum(r.total) + ' points'))));
    }
    let trophyText;
    if (fresh.length) {
      trophyText = 'Trophée de la semaine pour ' + frList(fresh.map(id => petLabel(byId.get(id)))) + ' !';
    } else {
      const already = F.concoursAwarded(store.listProfiles(), w).map(id => store.getProfile(id)).filter(Boolean);
      trophyText = already.length
        ? 'Le trophée de cette semaine est déjà dans la vitrine ' + frList(already.map(p => deNom(p.name))) + '. Un nouveau trophée sera à gagner lundi !'
        : 'Bravo à tous pour ce beau spectacle !';
    }
    const trophy = h('p', { class: 'fm-trophy' + (fresh.length ? ' is-new' : '') },
      h('span', { class: 'fm-trophy-ico', 'aria-hidden': 'true' }, '🏆'), h('span', null, frTypo(trophyText)));
    const again = h('button', { type: 'button', class: 'btn white' }, 'Revoir 🔄');
    again.addEventListener('click', () => { audio.tap(); router.go('famille/concours', { replace: true }); });
    const done = h('button', { type: 'button', class: 'btn' }, 'Terminé ✓');
    done.addEventListener('click', () => { audio.tap(); router.back(); });
    const final = h('div', { class: 'fm-final' }, title, pod, trophy, ribbons, h('div', { class: 'fm-final-btns' }, again, done));
    scene.appendChild(final);
    scene.classList.add('is-final');
    live.textContent = frTypo('Résultats : ' + frList(winners.map(p => petLabel(p))) + (winners.length > 1 ? ' gagnent ex aequo' : ' gagne')
      + ' le concours. ' + trophyText);
    /* chorégraphie : bronze, argent, puis or ; le gagnant danse */
    const steps = [...pod.querySelectorAll('.fm-step')];
    const orderIdx = el => (el.classList.contains('is-bronze') ? 0 : el.classList.contains('is-argent') ? 1 : 2);
    steps.sort((a, b) => orderIdx(a) - orderIdx(b));
    steps.forEach((el, i) => {
      motion.enter(el, { from: 'bottom', dist: 40, dur: 520, delay: 250 + i * 420 });
      const t = setTimeout(() => { my.timers.delete(t); if (st === my) audio.success(2 + i * 3); }, 250 + i * 420);
      my.timers.add(t);
    });
    motion.stagger([title], el => motion.enter(el, { from: 'scale' }));
    motion.stagger([trophy, ribbons, final.querySelector('.fm-final-btns')], el => motion.enter(el, { from: 'bottom', delay: 250 + steps.length * 420 }), 120);
    const t = setTimeout(() => {
      my.timers.delete(t);
      if (st !== my) return;
      audio.fanfare();
      motion.confetti();
      for (const el of pod.querySelectorAll('.fm-step.is-or .fm-who-pic')) {
        petMood(el, 'dance');
        const lf = lifeOf(el);
        if (lf && lf.react) { try { lf.react('celebrate'); } catch (_) {} }
        motion.burst(el, { count: 16, spread: 90 });
      }
      if (fresh.length) motion.pop(trophy, { scale: 1.08 });
    }, 250 + steps.length * 420);
    my.timers.add(t);
  }

  run().catch(e => { try { console.error('concours', e); } catch (_) {} if (!dead()) finale(); });
}
