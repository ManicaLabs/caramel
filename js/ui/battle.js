/* ============ DÉFI EN FAMILLE (#/battle) — à tour de rôle sur un seul appareil ============
   Demande du parent (03/10/2026) : « un mode battle avec les compagnons et des exercices entre les participants ;
   celui qui fait le plus de points gagne ». Règles (points, ex aequo, récompenses) : js/core/family.js.
   1. Réglages : participants (2 à 4 profils), type de défi (Tables · Calcul éclair · Conjugaison · Mélange),
      nombre de manches (3 ou 5) ; « Chacun reçoit des questions à son niveau : tout le monde peut gagner ! ».
      Les derniers réglages sont retenus sur l'appareil (localStorage 'caramel-battle-prefs').
   2. Déroulé : à chaque tour, écran de passage de main (« À toi, Léa ! », son compagnon, toucher pour commencer)
      aux couleurs du thème DE CE JOUEUR, puis UNE question générée À SON NIVEAU (une manche par participant :
      createManche({ profileId, mode: 'battle' }) ; avant le CE1, pas de conjugaison écrite → tables) ; réponse au
      pavé (décimal si besoin) ou au QCM (conjugaison : la phrase, choix en police de lecture) ; une seule réponse
      (pas de joker en défi). Juste : + 100, + rapidité relative au seuil de l'item (≤ + 50), + série ; faux : la
      bonne réponse est montrée gentiment, 0 point, aucun reproche. Chaque réponse fait progresser le joueur
      (rapport de SA manche : θ, Leitner, 🍎 ; historique mode 'battle' à la fin).
   3. En haut, l'ARÈNE : une piste par joueur, le compagnon avance avec les points (arrivée = manches × 150 pts).
   4. Fin : podium animé (le gagnant danse), trophée au gagnant (profile.trophies), 🍎 de participation pour tous
      (+ 5) et bonus au gagnant (+ 10), ex aequo gérés ; « Revanche » (un autre enfant commence).
   Bienveillance : un enfant peut s'arrêter à son tour (« Je m'arrête là 💤 ») : sa manche est abandonnée
   proprement (progrès gardés), ses points restent affichés, les autres continuent ; jamais de « dernier ».
   Reprise : l'état du défi est gardé pour l'onglet (sessionStorage 'caramel-battle') : après un rechargement ou un
   retour arrière, « Reprendre le défi » repart du tour suivant (les réponses déjà données sont enregistrées).
   Tests automatisés : window.__caramelDebug (s'il existe) reçoit { item, game: 'battle', player }. */

import { h, clear, dayStr, frTypo, loadCSS, fmtNum } from '../core/util.js';
import * as store from '../core/store.js';
import * as router from '../router.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import * as kit from './kit.js';
import { createManche } from '../core/manche.js';
import { loadGenerator } from '../content/index.js';
import { addApples, addTrophy } from '../core/economy.js';
import * as F from '../core/family.js';
import { petReady, putPet, petMood, podiumEl, themeIdOf, plural, lifeOf } from './famille.js';
import * as TL from '../games/tables-logic.js';
import * as PL from '../games/pommes-logic.js';
import * as OL from '../games/orchestre-logic.js';

const SS_KEY = 'caramel-battle';               /* défi en cours (cet onglet) */
const REDRAW = 2;                              /* questions de réserve par manche (question déjà vue par un autre) */
const PREFS_KEY = 'caramel-battle-prefs';      /* derniers réglages (cet appareil) */
const G = globalThis;
const nowMs = () => (G.performance && typeof G.performance.now === 'function' ? G.performance.now() : Date.now());
const readJSON = (stor, k) => { try { const s = G[stor] && G[stor].getItem(k); return s ? JSON.parse(s) : null; } catch (_) { return null; } };
const writeJSON = (stor, k, v) => { try { if (G[stor]) G[stor].setItem(k, JSON.stringify(v)); } catch (_) {} };
const removeKey = (stor, k) => { try { if (G[stor]) G[stor].removeItem(k); } catch (_) {} };
const canVT = () => { try { return typeof document.startViewTransition === 'function' && !motion.reduced(); } catch (_) { return false; } };
const fem = pl => pl && pl.g !== 'm';
const ready = pl => (fem(pl) ? 'prête' : 'prêt');

let st = null;

export default {
  async mount(root) {
    await Promise.all([loadCSS('css/ui/famille.css'), loadCSS('css/ui/battle.css'), petReady()]);
    if (!root.isConnected) return;
    teardown();
    const list = store.listProfiles();
    if (list.length < 2) { router.go('famille', { replace: true }); return; }
    const wrap = h('div', { class: 'bt' });
    clear(root);
    root.appendChild(wrap);
    const my = st = { root, wrap, timers: new Set(), players: [], cfg: null, phase: 'setup', dead: false, kp: null };
    setupScreen(my, { entering: true });
  },
  unmount() { teardown(); }
};

/* démontage : manches en cours abandonnées en douceur (progrès gardés) ; l'état reste repris possible */
function teardown() {
  const my = st;
  st = null;
  if (!my) return;
  my.dead = true;
  for (const t of my.timers) clearTimeout(t);
  my.timers.clear();
  dropKeypad(my);
  for (const pl of my.players) {
    try { if (pl.manche && !pl.manche.closed) pl.manche.abort(); } catch (e) { try { console.error('défi : abandon', e); } catch (_) {} }
  }
  try { document.documentElement.classList.remove('bt-swap'); } catch (_) {}
  try { if (G.__caramelDebug) { G.__caramelDebug.item = null; G.__caramelDebug.player = null; } } catch (_) {}
}
function later(my, fn, ms) {
  const t = setTimeout(() => { my.timers.delete(t); if (st === my && !my.dead) fn(); }, ms);
  my.timers.add(t);
  return t;
}
function dropKeypad(my) {
  if (my.kp) { try { my.kp.destroy(); } catch (_) {} my.kp = null; }
}
/* changement de tour : fondu enchaîné (transition de vue) — les couleurs passent au thème du joueur */
function swap(my, fn) {
  const html = document.documentElement;
  if (canVT()) {
    try {
      html.classList.add('bt-swap');
      const vt = document.startViewTransition(() => { if (!my.dead) fn(); });
      const done = () => html.classList.remove('bt-swap');
      if (vt.ready) vt.ready.catch(() => {});
      (vt.finished || Promise.resolve()).then(done, done);
      return;
    } catch (_) { html.classList.remove('bt-swap'); }
  }
  fn();
}
function topbar(title, onBack, extra) {
  const back = h('button', { type: 'button', class: 'back', 'aria-label': 'Retour' }, '←');
  back.addEventListener('click', () => { audio.tap(); onBack(); });
  return h('div', { class: 'topbar bt-top' }, back, title, extra || h('span', { class: 'bt-top-gap', 'aria-hidden': 'true' }));
}

/* ============ 1. RÉGLAGES ============ */
function setupScreen(my, { entering = false, cfg = null } = {}) {
  my.phase = 'setup';
  my.wrap.removeAttribute('data-theme');
  dropKeypad(my);
  const list = store.listProfiles();
  const prefs = cfg || readJSON('localStorage', PREFS_KEY) || {};
  let chosen = (Array.isArray(prefs.ids) ? prefs.ids : []).filter(id => list.some(p => p.id === id)).slice(0, F.BATTLE.MAX);
  if (chosen.length < F.BATTLE.MIN) chosen = list.slice(0, F.BATTLE.MAX).map(p => p.id);
  let type = F.CHALLENGE_BY_ID[prefs.type] ? prefs.type : 'tables';
  let rounds = F.BATTLE.ROUNDS.includes(prefs.rounds) ? prefs.rounds : F.BATTLE.ROUNDS[0];

  /* ----- participants ----- */
  const picks = h('div', { class: 'bt-picks', role: 'group', 'aria-label': 'Participants' });
  const pickBtns = list.map(p => {
    const pic = h('span', { class: 'bt-pick-pic', 'aria-hidden': 'true' });
    putPet(pic, p, 70, '', { expr: 'happy' });
    const b = h('button', { type: 'button', class: 'bt-pick', 'data-theme': themeIdOf(p), 'data-id': p.id, 'aria-pressed': 'false' },
      h('span', { class: 'bt-pick-stage' }, pic), h('span', { class: 'bt-pick-name' }, p.name),
      h('span', { class: 'bt-pick-check', 'aria-hidden': 'true' }, '✓'));
    b.addEventListener('click', () => {
      const on = chosen.includes(p.id);
      if (on) chosen = chosen.filter(x => x !== p.id);
      else if (chosen.length >= F.BATTLE.MAX) { audio.soft(); kit.toast(frTypo('Quatre joueurs au maximum : retire d’abord quelqu’un.')); return; }
      else chosen = list.filter(q => q.id === p.id || chosen.includes(q.id)).map(q => q.id);
      audio.tap();
      if (!on) { motion.pop(b, { scale: 1.06 }); petMood(pic, 'hop'); }
      refresh();
    });
    picks.appendChild(b);
    return b;
  });

  /* ----- type de défi ----- */
  const types = h('div', { class: 'bt-types', role: 'radiogroup', 'aria-label': 'Type de défi' });
  const typeBtns = F.CHALLENGES.map(c => {
    const b = h('button', { type: 'button', role: 'radio', class: 'bt-type', 'data-id': c.id, 'aria-checked': 'false' },
      h('span', { class: 'bt-type-ico', 'aria-hidden': 'true' }, c.icon),
      h('span', { class: 'bt-type-title' }, c.title), h('span', { class: 'bt-type-blurb' }, frTypo(c.blurb)));
    b.addEventListener('click', () => { if (type !== c.id) { type = c.id; audio.tap(); motion.pop(b, { scale: 1.05 }); refresh(); } });
    types.appendChild(b);
    return b;
  });
  types.addEventListener('keydown', e => {
    const i = F.CHALLENGES.findIndex(c => c.id === type);
    let j = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % F.CHALLENGES.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + F.CHALLENGES.length) % F.CHALLENGES.length;
    if (j < 0) return;
    e.preventDefault();
    type = F.CHALLENGES[j].id;
    refresh();
    try { typeBtns[j].focus(); } catch (_) {}
  });

  /* ----- manches ----- */
  const seg = h('div', { class: 'seg bt-seg', role: 'group', 'aria-label': 'Nombre de manches' });
  const roundBtns = F.BATTLE.ROUNDS.map(n => {
    const b = h('button', { type: 'button', 'aria-pressed': 'false', 'data-n': String(n) }, n + ' manches');
    b.addEventListener('click', () => { if (rounds !== n) { rounds = n; audio.tap(); refresh(); } });
    seg.appendChild(b);
    return b;
  });

  const tip = h('p', { class: 'bt-tip' }, h('span', { class: 'bt-tip-ico', 'aria-hidden': 'true' }, '💬'),
    h('span', null, frTypo('Chacun reçoit des questions à son niveau : tout le monde peut gagner !')));
  const rules = h('ul', { class: 'bt-rules', 'aria-label': 'Les points' },
    h('li', null, h('span', { 'aria-hidden': 'true' }, '✅'), frTypo(' Bonne réponse : 100 points')),
    h('li', null, h('span', { 'aria-hidden': 'true' }, '⚡'), frTypo(' Rapide : jusqu’à 50 points de plus')),
    h('li', null, h('span', { 'aria-hidden': 'true' }, '🔥'), frTypo(' Série : 10 points de plus par bonne réponse d’affilée')));
  const go = h('button', { type: 'button', class: 'btn big block bt-go' }, h('span', { 'aria-hidden': 'true' }, '⚔️'), frTypo('C’est parti !'));
  const need = h('p', { class: 'bt-need', 'aria-live': 'polite' });
  go.addEventListener('click', () => {
    if (chosen.length < F.BATTLE.MIN) { audio.soft(); motion.shake(picks); return; }
    audio.tap();
    removeKey('sessionStorage', SS_KEY);
    startBattle(my, { ids: chosen.slice(), type, rounds });
  });

  /* ----- défi en cours (rechargement, retour arrière) ----- */
  const saved = readSaved(list);
  let resume = null;
  if (saved) {
    const N = saved.players.length;
    const r = Math.min(saved.cfg.rounds, Math.floor(saved.turn / N) + 1);
    const yes = h('button', { type: 'button', class: 'btn small' }, 'Reprendre ▶');
    const no = h('button', { type: 'button', class: 'btn ghost' }, 'Non merci');
    resume = h('div', { class: 'banner bt-resume', role: 'status' },
      h('span', { class: 'bt-resume-ico', 'aria-hidden': 'true' }, '⏸️'),
      h('span', { class: 'bt-resume-txt' }, frTypo('Un défi est en cours (manche ' + r + ' sur ' + saved.cfg.rounds + ').')),
      h('span', { class: 'bt-resume-btns' }, yes, no));
    yes.addEventListener('click', () => { audio.tap(); startBattle(my, saved.cfg, saved); });
    no.addEventListener('click', () => { audio.tap(); removeKey('sessionStorage', SS_KEY); resume.remove(); });
  }

  const top = topbar(h('h1', { class: 'topbar-title' }, 'Défi en famille ⚔️'), () => router.back());
  const sec = (title, sub, ...kids) => h('section', { class: 'bt-sec' },
    h('h2', { class: 'bt-sec-title' }, title, sub ? h('span', { class: 'bt-sec-sub' }, sub) : null), ...kids);
  const screen = h('div', { class: 'screen bt-setup' }, top, resume,
    sec(frTypo('Qui participe ?'), frTypo('2 à 4 joueurs'), picks),
    sec(frTypo('Quel défi ?'), null, types),
    sec(frTypo('Combien de manches ?'), frTypo('une question par joueur et par manche'), seg),
    tip, rules, go, need);
  clear(my.wrap);
  my.wrap.appendChild(screen);

  function refresh() {
    pickBtns.forEach(b => {
      const on = chosen.includes(b.dataset.id);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('is-on', on);
    });
    typeBtns.forEach(b => {
      const on = b.dataset.id === type;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    roundBtns.forEach(b => {
      const on = Number(b.dataset.n) === rounds;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const n = chosen.length;
    go.disabled = n < F.BATTLE.MIN;
    need.textContent = n < F.BATTLE.MIN ? frTypo('Choisis au moins deux joueurs.') : frTypo(plural(n, 'joueur', 'joueurs') + ' · ' + plural(rounds, 'manche', 'manches'));
  }
  refresh();
  if (entering) motion.stagger(screen.querySelectorAll('.bt-sec, .bt-tip, .bt-rules, .bt-go'), el => motion.enter(el, { from: 'bottom', dist: 14, dur: 400 }), 60);
  else motion.enter(screen, { from: 'fade', dur: 260 });
}

/* défi en cours, lisible et compatible avec les profils actuels → état sauvegardé, sinon null */
function readSaved(list) {
  const s = readJSON('sessionStorage', SS_KEY);
  if (!s || s.v !== 1 || s.d !== dayStr() || !s.cfg || !Array.isArray(s.players) || s.players.length < F.BATTLE.MIN) return null;
  if (!F.CHALLENGE_BY_ID[s.cfg.type] || !F.BATTLE.ROUNDS.includes(s.cfg.rounds)) return null;
  if (!s.players.every(p => p && list.some(q => q.id === p.id))) return null;
  const N = s.players.length;
  if (!(s.turn >= 0) || s.turn >= N * s.cfg.rounds) return null;
  if (!s.players.some(p => !p.abandoned && p.answered < s.cfg.rounds)) return null;
  return s;
}
function saveState(my) {
  if (!my.cfg) return;
  writeJSON('sessionStorage', SS_KEY, {
    v: 1, d: my.today, cfg: my.cfg, turn: my.turn,
    players: my.players.map(p => ({ id: p.id, points: p.points, streak: p.streak, answered: p.answered, correct: p.correct, abandoned: p.abandoned }))
  });
}

/* ============ 2. DÉROULÉ ============ */
async function startBattle(my, cfg, resume = null) {
  if (my.busy) return;
  my.busy = true;
  const today = dayStr();
  const profiles = cfg.ids.map(id => store.getProfile(id)).filter(Boolean);
  if (profiles.length < F.BATTLE.MIN) { my.busy = false; setupScreen(my); return; }
  writeJSON('localStorage', PREFS_KEY, { ids: profiles.map(p => p.id), type: cfg.type, rounds: cfg.rounds });
  /* générateurs des axes du défi (chargement paresseux, une seule fois) */
  const waitBox = h('div', { class: 'bt-wait', role: 'status' }, h('span', { class: 'bt-wait-ico', 'aria-hidden': 'true' }, '⚔️'), frTypo('On prépare le défi…'));
  const showWait = later(my, () => { clear(my.wrap); my.wrap.appendChild(h('div', { class: 'screen bt-setup' }, waitBox)); }, 180);
  try {
    await Promise.all(F.battleAxes(cfg.type, cfg.rounds, profiles.map(p => p.classe)).map(ax => loadGenerator(ax)));
  } catch (e) {
    try { console.error('défi : générateurs', e); } catch (_) {}
    my.busy = false;
    if (st !== my) return;
    kit.toast(frTypo('Oups, le défi n’a pas pu se préparer. Vérifie la connexion, puis réessaie.'), 3600);
    setupScreen(my, { cfg });
    return;
  }
  clearTimeout(showWait);
  my.timers.delete(showWait);
  if (st !== my || my.dead) return;
  my.busy = false;
  for (const pl of my.players) { try { if (pl.manche && !pl.manche.closed) pl.manche.abort(); } catch (_) {} }
  my.cfg = { ids: profiles.map(p => p.id), type: cfg.type, rounds: cfg.rounds };
  my.today = today;
  my.rewarded = false;
  my.players = profiles.map(p => {
    const s = resume ? resume.players.find(x => x.id === p.id) || {} : {};
    const pl = {
      id: p.id, name: p.name, g: p.g, theme: themeIdOf(p), classe: p.classe,
      points: Math.max(0, Math.round(Number(s.points) || 0)), streak: Math.max(0, s.streak | 0),
      answered: Math.max(0, s.answered | 0), correct: Math.max(0, s.correct | 0), abandoned: !!s.abandoned,
      manche: null, summary: null, gained: 0
    };
    const left = cfg.rounds - pl.answered;
    if (!pl.abandoned && left > 0) {
      try {
        /* graine propre à chaque joueur (deux enfants du même niveau n'ont pas la même suite de questions) ;
           count + marge : une question déjà vue par un autre joueur peut être retirée (cf. showQuestion) */
        pl.manche = createManche({ gameId: 'battle', axis: F.battleAxis(cfg.type, pl.answered + 1, p.classe), count: left + REDRAW,
          mode: 'battle', profileId: p.id, today, seed: Date.now() + '|' + p.id + '|' + Math.random() });
      } catch (e) { try { console.error('défi : manche', e); } catch (_) {} pl.abandoned = true; }
    }
    return pl;
  });
  my.shown = new Set();
  my.turn = resume ? resume.turn : 0;
  saveState(my);
  buildPlay(my);
  nextTurn(my);
}

/* ----- écran de jeu : arène + zone du tour ----- */
function buildPlay(my) {
  my.phase = 'play';
  const round = h('h1', { class: 'topbar-title bt-round', 'aria-live': 'polite' });
  const top = topbar(round, () => askQuit(my));
  const lanes = h('ol', { class: 'bt-lanes', 'aria-label': 'La piste du défi' });
  for (const pl of my.players) {
    const pic = h('span', { class: 'bt-runner-pic' });
    putPet(pic, store.getProfile(pl.id), 46, '', { expr: 'happy' });
    const runner = h('span', { class: 'bt-runner' }, pic);
    const pts = h('b', { class: 'bt-lane-pts' }, fmtNum(pl.points));
    const fire = h('span', { class: 'bt-lane-fire', 'aria-hidden': 'true' });
    const lane = h('li', { class: 'bt-lane', 'data-theme': pl.theme, 'data-id': pl.id },
      h('span', { class: 'bt-lane-name' }, pl.name),
      h('span', { class: 'bt-track', 'aria-hidden': 'true' }, runner),
      h('span', { class: 'bt-lane-score' }, pts, fire));
    pl.ui = { lane, runner, pic, pts, fire };
    lanes.appendChild(lane);
    placeRunner(my, pl, false);
    if (pl.abandoned) rest(pl); else laneLabel(pl);
  }
  const arena = h('div', { class: 'bt-arena' }, lanes);
  const main = h('div', { class: 'bt-main' });
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const screen = h('div', { class: 'screen is-full bt-play n' + my.players.length }, top, arena, main, live);
  Object.assign(my, { roundEl: round, main, live, arena });
  clear(my.wrap);
  my.wrap.appendChild(screen);
  motion.stagger(lanes.children, el => motion.enter(el, { from: 'left', dur: 380 }), 70);
}
function placeRunner(my, pl, animate = true) {
  const f = F.trackFrac(pl.points, my.cfg.rounds);
  const r = pl.ui.runner;
  if (!animate || motion.reduced()) {
    r.style.setProperty('--x', String(f));
    if (animate) motion.enter(r, { from: 'fade', dur: 300 });   /* mouvement réduit : il apparaît à sa nouvelle place */
    return;
  }
  petMood(pl.ui.pic, 'walk');
  r.style.setProperty('--x', String(f));
  later(my, () => { if (!pl.abandoned) petMood(pl.ui.pic, f >= 1 ? 'joy' : ''); }, 950);
}
function rest(pl) {
  pl.ui.lane.classList.add('is-resting');
  petMood(pl.ui.pic, 'sleep');
  pl.ui.fire.textContent = '💤';
  pl.ui.lane.setAttribute('aria-label', pl.name + ' se repose, ' + plural(pl.points, 'point', 'points'));
}
function laneLabel(pl) {
  pl.ui.lane.setAttribute('aria-label', pl.name + ' : ' + plural(pl.points, 'point', 'points') + (pl.streak >= 2 ? ', série de ' + pl.streak : ''));
  pl.ui.fire.textContent = pl.abandoned ? '💤' : pl.streak >= 2 ? '🔥' + pl.streak : '';
}
const active = my => my.players.filter(p => !p.abandoned && p.answered < my.cfg.rounds && p.manche);

/* tour suivant (les joueurs au repos ou qui ont fini sont sautés) ; plus personne → résultats */
function peekTurn(my, from) {
  const N = my.players.length, total = N * my.cfg.rounds;
  for (let t = from; t < total; t++) {
    const pl = my.players[t % N];
    if (!pl.abandoned && pl.manche && pl.answered < my.cfg.rounds) return { t, pl, round: Math.floor(t / N) + 1 };
  }
  return null;
}
function nextTurn(my) {
  const nx = peekTurn(my, my.turn);
  if (!nx) { results(my); return; }
  my.turn = nx.t;
  saveState(my);
  swap(my, () => showIntro(my, nx.pl, nx.round));
}

/* ----- passage de main : « À toi, Léa ! » ----- */
function showIntro(my, pl, round) {
  my.phase = 'intro';
  dropKeypad(my);
  my.wrap.setAttribute('data-theme', pl.theme);
  my.roundEl.textContent = 'Manche ' + round + ' / ' + my.cfg.rounds;
  for (const p of my.players) p.ui.lane.classList.toggle('is-turn', p === pl);
  const p = store.getProfile(pl.id);
  const ch = F.CHALLENGE_BY_ID[my.cfg.type];
  const axis = F.battleAxis(my.cfg.type, round, pl.classe);
  const what = { 'ma.faits': 'Tables ✖️', 'ma.procedures': 'Calcul éclair ⚡', 'fr.conjug': 'Conjugaison 🎻' }[axis] || ch.title;
  const pic = h('div', { class: 'bt-intro-pic', 'aria-hidden': 'true' });
  putPet(pic, p, 150, '', { expr: 'delighted', live: true });
  const alone = active(my).length === 1 && my.lastPlayer === pl.id;
  const title = h('h2', { class: 'bt-intro-title' }, frTypo((alone ? 'Encore à toi, ' : 'À toi, ') + pl.name + ' !'));
  const goBtn = h('button', { type: 'button', class: 'btn big block bt-ready' }, frTypo('Je suis ' + ready(pl) + ' ! ▶'));
  goBtn.addEventListener('click', () => { audio.tap(); showQuestion(my, pl, round); });
  const stop = h('button', { type: 'button', class: 'btn ghost bt-stop' }, frTypo('Je m’arrête là 💤'));
  stop.addEventListener('click', () => askAbandon(my, pl));
  const card = h('div', { class: 'bt-intro' },
    pic, title,
    h('p', { class: 'bt-intro-sub' }, frTypo('Manche ' + round + ' sur ' + my.cfg.rounds + ' · ' + what)),
    h('p', { class: 'bt-intro-hint' }, frTypo(my.turn === 0 && round === 1
      ? 'Passe l’appareil à ' + pl.name + '. Une question chacun à son tour : réponds juste, et vite pour les points bonus ⚡'
      : 'Prends l’appareil, et touche le bouton quand tu es ' + ready(pl) + '.')),
    goBtn, stop);
  clear(my.main);
  my.main.appendChild(card);
  my.live.textContent = frTypo('À toi, ' + pl.name + ' ! Manche ' + round + ' sur ' + my.cfg.rounds + '.');
  try { goBtn.focus({ preventScroll: true }); } catch (_) {}
  if (!canVT()) motion.enter(card, { from: 'fade', dur: 260 });
  audio.whoosh();
  later(my, () => { petMood(pic, 'hop'); }, 380);
}

/* ----- question au niveau du joueur ----- */
function showQuestion(my, pl, round) {
  if (my.phase !== 'intro') return;
  my.phase = 'question';
  const axis = F.battleAxis(my.cfg.type, round, pl.classe);
  let item = null;
  try {
    /* jamais la question qu'un autre joueur vient de voir (il connaîtrait la réponse) */
    item = pl.manche.nextItem(axis, { avoid: my.shown });
    for (let k = 0; k < REDRAW && item && item.key && my.shown.has(item.key); k++) item = pl.manche.nextItem(axis, { avoid: my.shown, leitner: false });
  } catch (e) { try { console.error('défi : question', e); } catch (_) {} item = null; }
  if (item && item.key) my.shown.add(item.key);
  if (!item) {                                    /* aucune question possible : le tour passe, sans pénalité */
    pl.answered++;
    my.turn++;
    nextTurn(my);
    return;
  }
  try { if (G.__caramelDebug) { G.__caramelDebug.item = item; G.__caramelDebug.game = 'battle'; G.__caramelDebug.player = pl.id; } } catch (_) {}
  my.item = item;
  my.locked = false;
  const whoPts = h('span', null, frTypo(' · ' + plural(pl.points, 'point', 'points')));
  const who = h('div', { class: 'bt-who' }, h('b', null, pl.name), whoPts);
  my.whoPts = whoPts;
  const card = h('div', { class: 'bt-qcard' });
  const zone = h('div', { class: 'bt-answer' });
  const assist = item.assist && item.hint ? kit.bubble(frTypo('Petit coup de pouce : ' + item.hint), 'hint') : null;
  clear(my.main);
  my.main.append(h('div', { class: 'bt-q' }, who, assist, card), zone);
  const done = (correct, rightText, after) => answer(my, pl, item, { correct, rightText, card, zone, after });

  if (item.axis === 'fr.conjug') {
    renderConjug(item, card, zone, done);
  } else {
    renderMaths(my, item, card, zone, done);
  }
  motion.enter(card, { from: 'scale', dur: 320 });
  my.live.textContent = frTypo(pl.name + ', à toi : ' + (card.getAttribute('aria-label') || card.textContent || ''));
  my.t0 = nowMs();
}

/* énoncé de calcul (tables ou calcul éclair) + pavé décimal si besoin, ou QCM (ordres de grandeur) */
function renderMaths(my, item, card, zone, done) {
  const faits = item.axis === 'ma.faits';
  let toks = [], aria = '';
  if (faits) {
    const parts = TL.promptParts(item);
    toks = parts.map(p => ({ k: p.k, text: p.text }));
    aria = TL.promptAria(parts);
  } else {
    const parts = PL.promptParts(item.prompt);
    parts.lines.forEach((line, i) => {
      if (i) toks.push({ k: 'br' });
      for (const t of line) toks.push({ k: t.k, text: t.t });
    });
    aria = PL.promptAria(item.prompt);
  }
  const hole = h('span', { class: 'bt-hole' });
  const line = h('div', { class: 'bt-math', role: 'img', 'aria-label': aria });
  for (const t of toks) {
    if (t.k === 'hole') line.appendChild(hole);
    else if (t.k === 'br') line.appendChild(h('span', { class: 'bt-br', 'aria-hidden': 'true' }));
    else line.appendChild(h('span', { class: 'bt-tok is-' + t.k, 'aria-hidden': 'true' }, t.text));
  }
  if (!toks.some(t => t.k === 'hole')) line.append(h('span', { class: 'bt-tok is-eq', 'aria-hidden': 'true' }, '='), hole);
  card.setAttribute('aria-label', aria);
  card.appendChild(line);
  const answerText = () => fmtNum(Number(item.answer));

  if (!faits && Array.isArray(item.choices) && item.choices.length) {
    card.appendChild(h('p', { class: 'bt-qhelp' }, frTypo(PL.idleText(item))));
    const rightChoice = item.choices.find(c => PL.checkChoice(c.value, item));
    const grid = kit.choiceGrid(item.choices, {
      onPick: value => {
        const ok = PL.checkChoice(value, item);
        grid.disable();
        hole.textContent = PL.choiceLabel(item, value);
        hole.classList.add('is-filled');
        grid.mark(value, ok ? 'right' : 'wrong');
        if (!ok) grid.reveal(rightChoice ? rightChoice.value : item.answer);
        done(ok, PL.choiceLabel(item, item.answer), () => {
          hole.textContent = PL.choiceLabel(item, item.answer);
          hole.classList.add('is-right');
        });
      }
    });
    zone.appendChild(grid.el);
    return;
  }
  const info = faits ? TL.answerInfo(item) : PL.answerInfo(item);
  const kp = my.kp = kit.keypad({
    decimal: !!info.decimal, maxLen: faits ? 8 : Math.max(8, info.maxLen || 8),
    onChange: raw => { hole.textContent = raw; hole.classList.toggle('is-filled', !!raw); },
    onSubmit: raw => {
      if (my.locked) return;
      const res = faits ? TL.checkTyped(raw, item) : PL.checkTyped(raw, item);
      if (!res.valid) { motion.shake(hole, { dist: 4, dur: 300 }); return; }
      kp.disable(true);
      kp.setState(res.ok ? 'right' : 'wrong');
      hole.textContent = raw;
      hole.classList.add(res.ok ? 'is-right' : 'is-wrong');
      done(res.ok, answerText(), () => {
        if (res.ok) return;
        hole.classList.remove('is-wrong');
        hole.textContent = answerText();
        hole.classList.add('is-right');
        motion.pop(hole, { scale: 1.1 });
      });
    }
  });
  zone.appendChild(kp.el);
}

/* conjugaison : consigne (temps mis en valeur), phrase à trou en police de lecture, 4 choix */
function renderConjug(item, card, zone, done) {
  const model = OL.sentenceModel(item);
  const choices = OL.choiceModel(item);
  const prompt = h('p', { class: 'bt-consigne' });
  for (const part of OL.promptParts(item)) {
    if (part.tense) prompt.appendChild(h('b', { class: 'bt-tense' }, part.tense));
    else prompt.appendChild(document.createTextNode(part.text));
  }
  const tags = OL.tagsFor(item);
  const tagRow = tags.verb || tags.tense ? h('p', { class: 'bt-tags' },
    tags.verb ? h('span', { class: 'bt-tag' }, 'verbe\u00a0', h('b', null, tags.verb)) : null,
    tags.tense ? h('span', { class: 'bt-tag' }, tags.tense) : null) : null;
  const longest = Math.max(4, ...choices.map(c => c.fill.length));
  const slot = h('span', { class: 'bt-slot', style: { minWidth: Math.min(12, longest * 0.62 + 1.2) + 'em' } });
  const sentence = h('p', { class: 'bt-sentence read' });
  for (const part of model.parts) {
    if (part.kind === 'text') sentence.appendChild(document.createTextNode(part.text));
    else if (part.kind === 'verb') sentence.appendChild(h('u', { class: 'bt-verb' }, part.text));
    else {
      if (part.stem) sentence.appendChild(document.createTextNode(part.stem));
      sentence.appendChild(slot);
    }
  }
  const aria = String(item.prompt || '') + ' ' + OL.sentenceText(model, model.mode === 'underline' ? null : '…');
  card.setAttribute('aria-label', aria);
  card.classList.add('is-conj');
  card.append(...[prompt, tagRow, sentence].filter(Boolean));
  const right = choices.find(c => OL.isRight(item, c.value));
  const cols = choices.some(c => c.label.length > 14) ? 1 : 2;
  const grid = kit.choiceGrid(choices.map(c => ({ label: c.label, value: c.value })), {
    read: true, cols,
    onPick: value => {
      const ok = OL.isRight(item, value);
      const c = choices.find(x => String(x.value) === String(value));
      grid.disable();
      grid.mark(value, ok ? 'right' : 'wrong');
      if (model.mode !== 'underline' && c) { slot.textContent = c.fill; slot.classList.add('is-filled'); }
      if (!ok && right) grid.reveal(right.value);
      done(ok, right ? right.label : String(item.answer), () => {
        if (model.mode !== 'underline' && right) { slot.textContent = right.fill; slot.classList.add('is-right'); }
      });
    }
  });
  zone.appendChild(grid.el);
}

/* ----- réponse : points, progression du joueur, retour doux ----- */
function answer(my, pl, item, { correct, rightText, card, zone, after }) {
  if (my.locked || my.phase !== 'question') return;
  my.locked = true;
  my.phase = 'feedback';
  const ms = Math.max(0, Math.round(nowMs() - my.t0));
  try { pl.manche.report(item, { correct: !!correct, hinted: !!item.assist, ms, tries: 1 }); } catch (e) { try { console.error('défi : rapport', e); } catch (_) {} }
  pl.answered++;
  if (correct) { pl.streak++; pl.correct++; } else pl.streak = 0;
  const pts = F.questionPoints({ correct, ms, autoMs: F.autoMsOf(item), streak: pl.streak });
  const before = pl.points;
  pl.points += pts.total;
  my.lastPlayer = pl.id;
  my.turn++;
  if (pl.answered >= my.cfg.rounds && pl.manche && !pl.manche.closed) {
    try { pl.summary = pl.manche.finish(); } catch (e) { try { console.error('défi : fin de manche', e); } catch (_) {} }
  }
  saveState(my);
  try { if (G.__caramelDebug) G.__caramelDebug.item = null; } catch (_) {}

  /* retour */
  const fbBox = h('div', { class: 'bt-fb' + (correct ? ' is-right' : ' is-learn'), role: 'status', 'aria-live': 'polite' });
  const nx = peekTurn(my, my.turn);
  const next = h('button', { type: 'button', class: 'btn big block bt-next' },
    nx ? frTypo((nx.pl === pl ? 'Question suivante' : 'Au tour ' + deNom(nx.pl.name)) + ' ➜') : frTypo('Voir les résultats 🏆'));
  next.addEventListener('click', () => { audio.tap(); nextTurn(my); });
  const prof = store.getProfile(pl.id);
  const pet = h('span', { class: 'bt-fb-pet', 'aria-hidden': 'true' });
  if (correct) {
    putPet(pet, prof, 84, 'joy', { expr: 'delighted' });
    const gainN = h('b', { class: 'bt-gain-n' }, '+0');
    const chips = h('div', { class: 'bt-chips' },
      h('span', { class: 'bt-chip' }, frTypo('✅ Juste +' + pts.base)),
      pts.speed ? h('span', { class: 'bt-chip is-speed' }, frTypo('⚡ Rapide +' + pts.speed)) : null,
      pts.streak ? h('span', { class: 'bt-chip is-streak' }, frTypo('🔥 Série +' + pts.streak)) : null);
    fbBox.append(h('div', { class: 'bt-fb-top' }, pet,
      h('p', { class: 'bt-gain' }, h('span', { class: 'bt-gain-cheer' }, kit.cheer('right')), gainN, h('span', { class: 'bt-gain-u' }, ' points'))), chips);
    kit.celebrateRight(card, Math.max(0, pl.streak - 1));
    motion.countUp(gainN, 0, pts.total, 600, v => '+' + fmtNum(Math.round(v)));
    my.live.textContent = frTypo('Bravo ' + pl.name + ' ! ' + pts.total + ' points. ' + plural(pl.points, 'point', 'points') + ' en tout.');
  } else {
    /* le compagnon montre gentiment la bonne réponse : aucun reproche, 0 point */
    putPet(pet, prof, 40, '', { expr: 'happy', view: 'portrait' });
    fbBox.append(h('div', { class: 'bt-learn' },
      kit.bubble(frTypo('La bonne réponse : ' + rightText + '. ' + kit.cheer('learn')), 'soft', { icon: pet })));
    audio.soft();
    my.live.textContent = frTypo('La bonne réponse était ' + rightText + '.');
  }
  if (my.whoPts) my.whoPts.textContent = frTypo(' · ' + plural(pl.points, 'point', 'points'));
  if (typeof after === 'function') { try { after(); } catch (_) {} }
  fbBox.appendChild(next);
  /* la zone de réponse cède la place au retour (le pavé disparaît, la question reste lisible) */
  later(my, () => {
    dropKeypad(my);
    clear(zone);
    zone.appendChild(fbBox);
    motion.enter(fbBox, { from: 'bottom', dist: 12, dur: 320 });
    try { next.focus({ preventScroll: true }); } catch (_) {}
    /* le compagnon avance sur la piste */
    if (pts.total) {
      placeRunner(my, pl, true);
      motion.countUp(pl.ui.pts, before, pl.points, 800);
      later(my, () => { audio.coin(); motion.pop(pl.ui.pts, { scale: 1.25 }); }, 420);
    }
    laneLabel(pl);
  }, correct ? 650 : 900);
}
const deNom = name => (/^[aeiouàâäéèêëîïôöùûü]/i.test(name) ? 'd’' : 'de ') + name;

/* ----- s'arrêter (un joueur) ----- */
/* confirmation dans les couleurs du joueur dont c'est le tour (la feuille vit hors de .bt) */
function confirmIn(theme, text, { ok, cancel, icon }) {
  return new Promise(resolve => {
    let done = false;
    const fin = v => { if (!done) { done = true; resolve(v); } };
    const content = h('div', { class: 'kit-confirm' },
      icon ? h('div', { class: 'kit-confirm-ico', 'aria-hidden': 'true' }, icon) : null, h('p', { class: 'kit-confirm-text' }, text));
    const s = kit.sheet({
      content, label: text,
      actions: [{ label: cancel, kind: 'white', onClick: () => fin(false) }, { label: ok, onClick: () => fin(true) }],
      onClose: () => fin(false)
    });
    if (!s || !s.el) { fin(false); return; }
    if (theme && s.el.parentNode) s.el.parentNode.setAttribute('data-theme', theme);
  });
}
async function askAbandon(my, pl) {
  audio.tap();
  const ok = await confirmIn(pl.theme, frTypo('Tu veux t’arrêter là, ' + pl.name + ' ? Tes points restent au tableau, et les autres continuent.'),
    { ok: 'Je m’arrête', cancel: 'Je continue', icon: '💤' });
  if (!ok || st !== my || my.phase !== 'intro') return;
  pl.abandoned = true;
  if (pl.manche && !pl.manche.closed) { try { pl.summary = pl.manche.abort(); } catch (_) {} }
  rest(pl);
  my.turn++;
  saveState(my);
  kit.toast(frTypo('Repose-toi bien, ' + pl.name + ' ! 💤'));
  later(my, () => nextTurn(my), 500);
}
/* ----- arrêter le défi (tout le monde) ----- */
async function askQuit(my) {
  const ok = await confirmIn(my.wrap.getAttribute('data-theme'), frTypo('Arrêter le défi ? Les progrès de chacun sont gardés.'),
    { ok: 'Arrêter', cancel: 'Continuer', icon: '⚔️' });
  if (!ok || st !== my) return;
  removeKey('sessionStorage', SS_KEY);
  for (const pl of my.players) { try { if (pl.manche && !pl.manche.closed) pl.summary = pl.manche.abort(); } catch (_) {} }
  router.back();
}

/* ============ 3. RÉSULTATS ============ */
function results(my) {
  if (my.phase === 'results') return;
  my.phase = 'results';
  dropKeypad(my);
  const today = my.today;
  for (const pl of my.players) {
    if (pl.manche && !pl.manche.closed) {
      try { pl.summary = pl.abandoned ? pl.manche.abort() : pl.manche.finish(); } catch (_) {}
    }
  }
  const ranking = F.battleRanking(my.players);
  const rewards = F.battleRewards(my.players, ranking);
  if (!my.rewarded) {
    my.rewarded = true;
    for (const pl of my.players) {
      const rw = rewards[pl.id] || { apples: 0, trophy: false };
      if (rw.apples || rw.trophy) {
        store.mutateProfile(q => {
          if (rw.apples) addApples(q, rw.apples, today);
          if (rw.trophy) addTrophy(q, 'defi', today, { n: my.players.length, pts: pl.points, type: my.cfg.type, rounds: my.cfg.rounds });
        }, pl.id);
      }
      const s = pl.summary || {};
      pl.gained = Math.max(0, (s.apples | 0) + (s.streakBonus | 0)) + rw.apples;
      pl.trophy = rw.trophy;
    }
    removeKey('sessionStorage', SS_KEY);
  }
  swap(my, () => showResults(my, ranking));
}

function showResults(my, ranking) {
  my.wrap.removeAttribute('data-theme');
  const byId = new Map(my.players.map(p => [p.id, store.getProfile(p.id)]).filter(([, p]) => !!p));
  const plById = new Map(my.players.map(p => [p.id, p]));
  const winners = ranking.winners.map(id => plById.get(id)).filter(Boolean);
  const names = list => list.map(p => p.name).join(list.length > 2 ? ', ' : ' et ').replace(/, ([^,]*)$/, ' et $1');
  const headline = winners.length > 1 ? 'Ex aequo ! ' + names(winners) + ' gagnent le défi !'
    : winners.length ? names(winners) + ' gagne le défi !'
      : 'Le défi est fini : bravo d’avoir joué !';
  const title = h('h1', { class: 'bt-res-title' }, frTypo('Bravo à tous ! 🎉'));
  const head = h('p', { class: 'bt-res-head' }, winners.length ? h('span', { class: 'bt-res-cup', 'aria-hidden': 'true' }, '🏆') : null, frTypo(headline));
  const pod = ranking.rows.some(r => r.medal)
    ? podiumEl(ranking.rows, { byId, valueText: r => plural(r.value, 'point', 'points'), size: 86, label: 'Podium du défi', live: true })
    : null;
  /* tableau : chacun ses points et ses pommes ; jamais de rang affiché hors podium */
  const rows = h('ul', { class: 'bt-res-list', 'aria-label': 'Les points de chacun' });
  const order = [...ranking.rows.map(r => r.id), ...ranking.resting];
  for (const id of order) {
    const pl = plById.get(id);
    const p = byId.get(id);
    if (!pl || !p) continue;
    const row = ranking.rows.find(r => r.id === id);
    const pic = h('span', { class: 'bt-res-pic', 'aria-hidden': 'true' });
    /* rond cadré sur la tête (portrait) : celui qui s'est reposé garde la tête droite, les yeux fermés (expression
       sleepy) ; la pose couchée (humeur sleep) baisserait sa tête hors du rond. Le badge 💤 dit qu'il dort. */
    putPet(pic, p, 52, '', { expr: pl.abandoned ? 'sleepy' : pl.trophy ? 'proud' : 'happy', view: 'portrait' });
    const pts = h('b', { class: 'bt-res-pts' }, '0');
    const badge = pl.trophy ? '🏆' : row && row.medal ? F.MEDAL_EMOJI[row.medal] : pl.abandoned ? '💤' : '🎀';
    rows.appendChild(h('li', { class: 'bt-res-row' + (pl.trophy ? ' is-win' : ''), 'data-theme': pl.theme },
      h('span', { class: 'bt-res-badge', 'aria-hidden': 'true' }, badge), pic,
      h('span', { class: 'bt-res-name' }, h('b', null, pl.name),
        h('span', null, pl.abandoned ? frTypo(fem(pl) ? 's’est reposée' : 's’est reposé') : frTypo(plural(pl.correct, 'bonne réponse', 'bonnes réponses')))),
      h('span', { class: 'bt-res-score' }, pts, h('span', { class: 'bt-res-unit' }, ' pts'),
        pl.gained ? h('span', { class: 'bt-res-apples' }, '🍎\u00a0+' + pl.gained) : null)));
    motion.countUp(pts, 0, pl.points, 900);
  }
  const again = h('button', { type: 'button', class: 'btn big block' }, 'Revanche 🔄');
  again.addEventListener('click', () => {
    audio.tap();
    const ids = F.rotate(my.cfg.ids, 1);
    startBattle(my, { ids, type: my.cfg.type, rounds: my.cfg.rounds });
  });
  const other = h('button', { type: 'button', class: 'btn white' }, 'Autre défi ⚙️');
  other.addEventListener('click', () => { audio.tap(); setupScreen(my, { cfg: my.cfg }); });
  const done = h('button', { type: 'button', class: 'btn white' }, 'Terminé ✓');
  done.addEventListener('click', () => { audio.tap(); router.back(); });
  const top = topbar(h('h2', { class: 'topbar-title' }, 'Résultats du défi'), () => router.back());
  /* téléphone : une colonne ; grand écran (tablette posée sur la table) : podium à gauche, scores et boutons à droite */
  const screen = h('div', { class: 'screen bt-results' }, top,
    h('div', { class: 'bt-res-grid' },
      h('div', { class: 'bt-res-a' }, title, head, pod),
      h('div', { class: 'bt-res-b' }, rows,
        h('p', { class: 'bt-res-note' }, frTypo('🍎 5 pommes pour chaque participant, 10 de plus pour le gagnant — et chaque réponse a fait progresser son joueur.')),
        h('div', { class: 'bt-res-btns' }, again, h('div', { class: 'bt-res-pair' }, other, done)))));
  clear(my.wrap);
  my.wrap.appendChild(screen);
  my.live = null;
  /* chorégraphie : podium, fanfare, confettis ; le gagnant danse (plusieurs fois) */
  if (pod) motion.stagger(pod.querySelectorAll('.fm-step'), el => motion.enter(el, { from: 'bottom', dist: 36, dur: 520 }), 260);
  motion.stagger([title, head], el => motion.enter(el, { from: 'scale', dur: 380 }), 90);
  motion.stagger(rows.children, el => motion.enter(el, { from: 'bottom', dur: 360 }), 80);
  later(my, () => {
    audio.fanfare();
    if (winners.length) motion.confetti();
    const pics = pod ? [...pod.querySelectorAll('.fm-step.is-or .fm-who-pic')] : [];
    const dance = k => {
      for (const el of pics) {
        if (!el.isConnected) continue;
        petMood(el, 'dance');
        if (k === 0) {
          const lf = lifeOf(el);
          if (lf && lf.react) { try { lf.react('celebrate'); } catch (_) {} }
          motion.burst(el, { count: 16, spread: 90 });
        }
      }
      if (k < 2) later(my, () => dance(k + 1), 1900);
    };
    if (pics.length) dance(0);
  }, pod ? 700 : 300);
}
