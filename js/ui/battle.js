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
   Tests automatisés : window.__caramelDebug (s'il existe) reçoit { item, game: 'battle', player }.
   MODE « AVEC UN COPAIN » (#/battle?duel=<code>&n=<jeton>, lancé par js/ui/duel.js) : le même moteur pour UN joueur, l'enfant
   actif, sur son téléphone ; règle du code (js/core/duel.js : défi, nombre de manches, type de question de chaque
   manche en « mélange ») ; pas d'écran de passage de main (la question suivante vient tout de suite) ; « Question i sur n »
   en haut ; manche en mode 'duel' (historique). Fin : bilan en TRÈS GROS (le compagnon, les points, le défi et son
   code) à montrer au copain pour comparer — sans le prénom de l'enfant (resultCard) ; récompenses de l'économie
   existante (🍎 des bonnes réponses + 5 🍎 de participation, pas de trophée : l'appli ne sait pas qui a gagné) ;
   la place d'un QR du résultat est prévue (plus tard). État gardé pour l'onglet (sessionStorage 'caramel-duel', même
   code et même jeton) : un rechargement reprend la partie, ou remontre le bilan sans redonner les pommes.
   RÉPONDRE À VOIX HAUTE (v2.3, demande du parent du 07/10/2026 ; js/ui/voice-answer.js, plan de chaque question :
   js/core/battle-voice.js) : la voix TAPE la réponse, comme un doigt (un seul essai, mêmes points). Pavé : 🎤 dans la case
   vide (pas de 🎤 dans un pavé décimal) et la ligne 👂 en pastille sur le bas de la carte ; voix jusqu'à 999 ; nombres de
   l'énoncé, réponse d'avant et morceaux de la réponse (« cent » mal entendu) jamais comptés faux. Choix : 🎤 rond et 👂 au-dessus de la grille ; temps et sujets se disent, les formes du
   verbe se touchent (« Ici, c'est l'écriture qui compte ») ; choix qui se disent pareil → au doigt. Le défi n'est pas
   monté par la coquille des jeux : son ctx de voix (voiceCtx) est fait comme celui de js/ui/game-ctx.js.
   Défi en famille : le micro suit CHAQUE joueur (my.micWant : ce qu'il a laissé à la fin de sa question ; au départ,
   allumé pour l'enfant actif s'il l'était dans un autre jeu de la séance, éteint pour les autres) ; écran de passage
   de main : micro en pause (rien n'est tapé), fermé si le joueur suivant répond au doigt, ouvert d'avance s'il parle ;
   la grammaire change d'une question à l'autre (nombres / mots des choix) sans rouvrir le micro. « Avec un copain » :
   le micro reste allumé d'une question à l'autre (séance). Retour, bilan, départ : micro en pause puis fermé. */

import { h, clear, dayStr, frTypo, loadCSS, fmtNum, deNom, frList } from '../core/util.js';
import * as store from '../core/store.js';
import * as router from '../router.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import * as kit from './kit.js';
import { createManche } from '../core/manche.js';
import { loadGenerator } from '../content/index.js';
import { addApples, addTrophy } from '../core/economy.js';
import * as F from '../core/family.js';
import * as D from '../core/duel.js';
import * as voice from './voice.js';
import { petReady, putPet, petMood, podiumEl, themeIdOf, plural, lifeOf } from './famille.js';
import * as TL from '../games/tables-logic.js';
import * as PL from '../games/pommes-logic.js';
import * as OL from '../games/orchestre-logic.js';
import * as speech from '../core/speech.js';
import * as preload from '../core/preload.js';
import { micTrouble } from './game-ctx.js';
import { createVoiceAnswer, SESSION_KEY as MIC_KEY } from './voice-answer.js';
import * as BV from '../core/battle-voice.js';

const SS_KEY = 'caramel-battle';               /* défi en cours (cet onglet) */
const DUEL_KEY = 'caramel-duel';               /* partie « Avec un copain » en cours ou finie (cet onglet) */
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
  async mount(root, params, query = {}) {
    const duel = query && typeof query.duel === 'string' ? query.duel : null;
    await Promise.all([loadCSS('css/ui/famille.css'), loadCSS('css/ui/battle.css'), duel !== null ? loadCSS('css/ui/duel.css') : null, petReady()]);
    if (!root.isConnected) return;
    teardown();
    if (duel !== null) { mountDuel(root, duel, query.n); return; }
    const list = store.listProfiles();
    if (list.length < 2) { router.go('famille', { replace: true }); return; }
    const wrap = h('div', { class: 'bt' });
    clear(root);
    root.appendChild(wrap);
    const me = store.getProfile();
    const my = st = { root, wrap, timers: new Set(), players: [], cfg: null, phase: 'setup', dead: false, kp: null, micFirst: me ? me.id : null };
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
  dropVoice(my);
  for (const pl of my.players) {
    try { if (pl.manche && !pl.manche.closed) pl.manche.abort(); } catch (e) { try { console.error('défi : abandon', e); } catch (_) {} }
  }
  try { document.documentElement.classList.remove('bt-swap'); } catch (_) {}
  try { if (G.__caramelDebug) { G.__caramelDebug.item = null; G.__caramelDebug.player = null; } } catch (_) {}
  if (my.duel) { try { voice.hush(); } catch (_) {} }
}
function later(my, fn, ms) {
  const t = setTimeout(() => { my.timers.delete(t); if (st === my && !my.dead) fn(); }, ms);
  my.timers.add(t);
  return t;
}
function dropKeypad(my) {
  if (my.kp) { try { my.kp.destroy(); } catch (_) {} my.kp = null; }
}

/* ============ RÉPONDRE À VOIX HAUTE ============ */
/* ctx de voix du défi, sur le modèle de js/ui/game-ctx.js : le micro prévient la voix fluide avant de démarrer
   (voice.micWillStart) et suit le préchargement du modèle (pourcentage « Je me prépare à t'écouter… ») */
const speechCtx = Object.freeze(Object.assign({}, speech, {
  ensureVosk(...a) {
    voice.micWillStart();
    const p = speech.ensureVosk(...a);
    const off = preload.followVosk(a[0]);
    Promise.resolve(p).then(off, off);
    return p;
  },
  startListening(...a) { voice.micWillStart(); return speech.startListening(...a); }
}));
function micEnv() {
  let standalone = false, ios = false, host = '', voskReady = false;
  try { standalone = !!(G.matchMedia && G.matchMedia('(display-mode: standalone)').matches) || G.navigator.standalone === true; } catch (_) {}
  try { const n = G.navigator; ios = /iPad|iPhone|iPod/.test(n.userAgent) || (n.platform === 'MacIntel' && n.maxTouchPoints > 1); } catch (_) {}
  try { host = G.location.host; } catch (_) {}
  try { voskReady = preload.micReady(); } catch (_) {}
  return { standalone, host, ios, voskReady };
}
const sessionMic = () => { try { return G.sessionStorage.getItem(MIC_KEY) === '1'; } catch (_) { return false; } };
const NOTE = {
  number: '✋ Celui-là, tape-le avec les doigts.',
  written: '✍️ Ici, c’est l’écriture qui compte : touche ta réponse.',
  same: '👆 Elles se disent presque pareil : touche la bonne.',
  unheard: '👆 Ici, touche ta réponse.'
};

/* micro du défi (un par écran de jeu) : 🎤, ligne 👂 et petite note ; la voix tape comme un doigt */
function setupVoice(my) {
  dropVoice(my);
  if (!my.micWant) my.micWant = new Map();
  let va = null;
  const ctx = {
    speech: speechCtx,
    voice: { hush: () => voice.hush(), settle: () => voice.settle() },
    mic: { trouble: code => micTrouble(code, micEnv()) },
    announce: t => { if (st === my && my.live && my.phase === 'question') my.live.textContent = t; }
  };
  va = createVoiceAnswer(ctx, {
    /* nombre entendu : écrit dans la case et validé, seulement pendant la question (jamais au passage de main) */
    onNumber: v => {
      if (st !== my || my.phase !== 'question' || my.locked || !my.kp) return;
      my.via = 'voix';
      my.kp.set(fmtNum(v).replace(/\s/g, ''));
      const ok = my.kp.el.querySelector('[data-k="ok"]');
      if (ok) ok.click();
    },
    onChoice: v => {
      if (st !== my || my.phase !== 'question' || my.locked || !my.grid) return;
      const b = my.grid.button(v);
      if (!b || b.disabled) return;
      my.via = 'voix';
      b.click();
    },
    onProblem: msg => { if (st === my) kit.toast(msg, 4200); },
    onChange: () => {
      if (st !== my || !my.va) return;
      const on = my.va.listening();
      /* micro ouvert d'avance au passage de main, prêt après le début de la question : il a démarré avec la grammaire
         « sourde » ; la question est reprise (nouvelle grammaire, nouveau reconnaisseur) */
      if (on && !my.vOn && my.vPre && my.phase === 'question') voiceApply(my, true);
      if (on) { my.vPre = false; my.vEngine = engineNow(); }
      my.vOn = on;
      voiceNote(my);
    }
  });
  if (!va.supported) { va.destroy(); return; }
  const note = h('p', { class: 'bt-vnote', hidden: true });
  my.va = va;
  my.vnote = note;
}
function dropVoice(my) {
  if (!my || !my.va) return;
  try { my.va.destroy(); } catch (_) {}
  for (const el of [my.va.el, my.va.ear, my.va.dbg, my.vnote]) { if (el && el.parentNode) el.remove(); }
  my.va = null; my.vnote = null; my.vbox = null; my.vplan = null; my.vOn = false; my.vPre = false;
}
/* le joueur veut-il le micro ? ce qu'il a laissé à la fin de sa dernière question ; au départ : l'enfant actif le garde
   s'il était allumé dans un autre jeu de la séance, les autres commencent au doigt */
function wantMic(my, pl) {
  if (my.micWant && my.micWant.has(pl.id)) return my.micWant.get(pl.id);
  return pl.id === my.micFirst && my.micSession;
}
/* passage de main : la voix ne tape rien ; micro fermé si le joueur suivant répond au doigt, ouvert d'avance (en pause)
   s'il répond à voix haute — il est prêt quand l'enfant touche « Je suis prêt » */
function voiceHandover(my, pl) {
  const va = my.va;
  if (!va) return;
  voiceDeaf(my);
  if (my.vbox && my.vbox.parentNode) my.vbox.remove();
  const want = wantMic(my, pl);
  /* reconnaissance de secours du navigateur (Web Speech) : pas de grammaire, donc pas d'oreille sourde → micro fermé
     pendant le passage de main, rouvert à la question */
  const deafOk = my.vEngine !== 'webspeech';
  if (va.wanted() && (!want || !deafOk)) va.stop();
  else if (want && deafOk && !va.wanted()) { my.vPre = true; va.start(); }
}
const engineNow = () => { try { return speech.health().engine || null; } catch (_) { return null; } };
/* entre deux questions, micro allumé : en pause et SOURD (grammaire des seuls mots d'appoint : aucun nombre, aucun
   choix) ; la question suivante change de grammaire, donc de reconnaisseur : ce qui a été dit avant (un frère qui crie
   un nombre pendant le passage de main) arrive à l'ancien reconnaisseur et n'est jamais tapé */
function voiceDeaf(my) {
  if (!my.va) return;
  my.va.pause(true);
  my.va.choices([]);
}
/* question : plan de la voix (js/core/battle-voice.js), 🎤 et 👂 à leur place, micro allumé si le joueur le veut */
function voiceQuestion(my, pl, item, { card, zone }) {
  const va = my.va;
  if (!va) return;
  const plan = my.vplan = BV.voicePlan(item);
  my.vbox = null;
  if (plan.mode === 'number' && my.kp) {
    /* 🎤 dans la case vide du pavé ; 👂 en pastille sur le bas de la carte (rien ne bouge quand elle paraît) */
    const box = my.vbox = h('div', { class: 'bt-vpill' }, va.ear, my.vnote, va.dbg);
    card.appendChild(box);
    va.attachKeypad(my.kp);
  } else if (plan.mode === 'choices' && my.grid) {
    /* 🎤 rond et 👂 au-dessus de la grille (la place est prise dès la question : rien ne saute) */
    const box = my.vbox = h('div', { class: 'va-row bt-vrow' }, va.ear, my.vnote, va.dbg);
    zone.insertBefore(box, my.grid.el);
    va.placeIn(box, va.ear);
    va.attachChoices(my.grid);
  }
  voiceApply(my, false);
  if (wantMic(my, pl) && !va.wanted()) va.start();
  voiceNote(my);
}
/* la question pour la voix : grammaire (nombres ou mots des choix), juge neuf ; flip : repasse d'abord par la grammaire
   sourde (reconnaisseur neuf même si la grammaire de la question était déjà là) */
function voiceApply(my, flip) {
  const va = my.va, plan = my.vplan;
  if (!va || !plan) return;
  if (flip) va.choices([]);
  if (plan.mode === 'number' && my.kp) {
    const prev = Number.isFinite(my.prevAnswer) ? [my.prevAnswer] : [];
    va.number({ answer: plan.answer, ignore: plan.ignore.concat(prev), voice: plan.voice });
  } else if (plan.mode === 'choices' && my.grid) {
    va.choices(plan.list);
    if (!plan.voice) va.pause(true);
  } else va.pause(true);
}
/* question que la voix ne peut pas juger, micro allumé : une petite note à la place de « Micro en pause » */
function voiceNote(my) {
  const va = my.va, note = my.vnote, plan = my.vplan;
  if (!va || !note) return;
  let why = '';
  if (my.phase === 'question' && plan && va.listening()) {
    if (plan.mode === 'number' && !plan.voice) why = 'number';
    else if (plan.mode === 'choices' && !plan.voice) why = plan.why || 'same';
  }
  const text = why ? frTypo(NOTE[why] || NOTE.unheard) : '';
  if (note.textContent !== text) note.textContent = text;
  note.hidden = !text;
  if (my.vbox) my.vbox.classList.toggle('is-note', !!text);
}
/* fin de la question : la voix ne tape plus rien ; ce que le joueur a laissé est retenu pour son prochain tour */
function voiceDone(my, pl, item) {
  const va = my.va;
  if (!va) return;
  voiceDeaf(my);
  my.micWant.set(pl.id, va.wanted());
  const v = Number(item && item.answer);
  my.prevAnswer = Number.isFinite(v) ? v : null;
  /* masquée sans être retirée : la carte, le pavé et la grille ne bougent pas pendant le retour */
  if (my.vbox) my.vbox.classList.add('is-done');
  my.vbox = null;
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
  dropVoice(my);
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
function saveState(my, done = false) {
  if (!my.cfg) return;
  writeJSON('sessionStorage', my.duel ? DUEL_KEY : SS_KEY, {
    v: 1, d: my.today, cfg: my.cfg, turn: my.turn, ...(my.duel ? { duel: my.duel.code, n: my.duel.n, done } : {}),
    players: my.players.map(p => ({ id: p.id, points: p.points, streak: p.streak, answered: p.answered, correct: p.correct, abandoned: p.abandoned,
      ...(done ? { gained: p.gained } : {}) }))
  });
}
/* type de question de la manche `round` pour un joueur : règle du code (« Avec un copain ») ou du Défi en famille */
const axisAt = (my, round, classe) => (my.rule ? D.duelAxis(my.rule, round, classe) : F.battleAxis(my.cfg.type, round, classe));

/* ============ 2. DÉROULÉ ============ */
async function startBattle(my, cfg, resume = null) {
  if (my.busy) return;
  my.busy = true;
  const today = dayStr();
  const solo = !!cfg.duel;                       /* « Avec un copain » : un seul joueur sur cet appareil */
  const profiles = cfg.ids.map(id => store.getProfile(id)).filter(Boolean);
  if (profiles.length < (solo ? 1 : F.BATTLE.MIN)) { my.busy = false; if (solo) router.go('duel', { replace: true }); else setupScreen(my); return; }
  if (!solo) writeJSON('localStorage', PREFS_KEY, { ids: profiles.map(p => p.id), type: cfg.type, rounds: cfg.rounds });
  my.rule = solo ? D.duelRule(cfg.duel, today) : null;
  /* générateurs des axes du défi (chargement paresseux, une seule fois) */
  const axes = solo ? [...new Set(profiles.flatMap(p => D.duelAxes(my.rule, p.classe)))] : F.battleAxes(cfg.type, cfg.rounds, profiles.map(p => p.classe));
  const waitBox = h('div', { class: 'bt-wait', role: 'status' }, h('span', { class: 'bt-wait-ico', 'aria-hidden': 'true' }, solo ? '👫' : '⚔️'),
    frTypo(solo ? 'On prépare la partie…' : 'On prépare le défi…'));
  const showWait = later(my, () => { clear(my.wrap); my.wrap.appendChild(h('div', { class: 'screen bt-setup' }, waitBox)); }, 180);
  try {
    await Promise.all(axes.map(ax => loadGenerator(ax)));
  } catch (e) {
    try { console.error('défi : générateurs', e); } catch (_) {}
    my.busy = false;
    if (st !== my) return;
    kit.toast(frTypo('Oups, le défi n’a pas pu se préparer. Vérifie la connexion, puis réessaie.'), 3600);
    if (solo) router.back(); else setupScreen(my, { cfg });
    return;
  }
  clearTimeout(showWait);
  my.timers.delete(showWait);
  if (st !== my || my.dead) return;
  my.busy = false;
  for (const pl of my.players) { try { if (pl.manche && !pl.manche.closed) pl.manche.abort(); } catch (_) {} }
  my.cfg = { ids: profiles.map(p => p.id), type: cfg.type, rounds: cfg.rounds, ...(solo ? { duel: cfg.duel } : {}) };
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
        pl.manche = createManche({ gameId: 'battle', axis: axisAt(my, pl.answered + 1, p.classe), count: left + REDRAW,
          mode: solo ? 'duel' : 'battle', profileId: p.id, today, seed: Date.now() + '|' + p.id + '|' + Math.random() });
      } catch (e) { try { console.error('défi : manche', e); } catch (_) {} pl.abandoned = true; }
    }
    return pl;
  });
  my.shown = new Set();
  my.turn = resume ? resume.turn : 0;
  my.micSession = sessionMic();
  my.prevAnswer = null;
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
      h('span', { class: 'bt-lane-name' }, my.duel ? D.resultCard(store.getProfile(pl.id)).pet.name : pl.name),
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
  setupVoice(my);
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
  swap(my, () => (my.duel ? soloTurn(my, nx.pl, nx.round) : showIntro(my, nx.pl, nx.round)));
}
/* « Avec un copain » : un seul joueur, pas de passage de main — la question vient tout de suite */
function soloTurn(my, pl, round) {
  my.phase = 'intro';
  dropKeypad(my);
  my.wrap.setAttribute('data-theme', pl.theme);
  my.roundEl.textContent = 'Question ' + round + ' sur ' + my.cfg.rounds;
  showQuestion(my, pl, round);
}

/* ----- passage de main : « À toi, Léa ! » ----- */
function showIntro(my, pl, round) {
  my.phase = 'intro';
  dropKeypad(my);
  voiceHandover(my, pl);
  my.wrap.setAttribute('data-theme', pl.theme);
  my.roundEl.textContent = 'Manche ' + round + ' / ' + my.cfg.rounds;
  for (const p of my.players) p.ui.lane.classList.toggle('is-turn', p === pl);
  const p = store.getProfile(pl.id);
  const ch = F.CHALLENGE_BY_ID[my.cfg.type];
  const axis = axisAt(my, round, pl.classe);
  /* nom et icône du type de défi, tels que le choix des réglages les montre (js/core/family.js CHALLENGES) */
  const chIco = id => (F.CHALLENGE_BY_ID[id] && F.CHALLENGE_BY_ID[id].icon) || '';
  const what = { 'ma.faits': 'Tables ' + chIco('tables'), 'ma.procedures': 'Calcul éclair ' + chIco('calcul'), 'fr.conjug': 'Conjugaison ' + chIco('conjug') }[axis] || ch.title;
  const pic = h('div', { class: 'bt-intro-pic', 'aria-hidden': 'true' });
  putPet(pic, p, 150, '', { expr: 'delighted', live: true });
  const alone = active(my).length === 1 && my.lastPlayer === pl.id;
  const title = h('h2', { class: 'bt-intro-title' }, frTypo((alone ? 'Encore à toi, ' : 'À toi, ') + pl.name + ' !'));
  const goBtn = h('button', { type: 'button', class: 'btn big block bt-ready' }, frTypo('Je suis ' + ready(pl) + ' ! ▶'));
  goBtn.addEventListener('click', () => { audio.tap(); showQuestion(my, pl, round); });
  const stop = h('button', { type: 'button', class: 'btn ghost bt-stop' }, frTypo('Je m’arrête là 💤'));
  stop.addEventListener('click', () => askAbandon(my, pl));
  /* micro allumé pour ce joueur : il le sait avant de prendre l'appareil */
  const mic = my.va && wantMic(my, pl) ? h('p', { class: 'bt-intro-mic' }, h('span', { 'aria-hidden': 'true' }, '🎤 '), frTypo('Tu pourras dire ta réponse.')) : null;
  const card = h('div', { class: 'bt-intro' },
    pic, title,
    h('p', { class: 'bt-intro-sub' }, frTypo('Manche ' + round + ' sur ' + my.cfg.rounds + ' · ' + what)),
    h('p', { class: 'bt-intro-hint' }, frTypo(my.turn === 0 && round === 1
      ? 'Passe l’appareil à ' + pl.name + '. Une question chacun à son tour : réponds juste, et vite pour les points bonus ⚡'
      : 'Prends l’appareil, et touche le bouton quand tu es ' + ready(pl) + '.')),
    mic, goBtn, stop);
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
  const axis = axisAt(my, round, pl.classe);
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
  my.grid = null;
  my.via = 'doigt';
  const whoPts = my.duel ? null : h('span', null, frTypo(' · ' + plural(pl.points, 'point', 'points')));
  const who = my.duel ? null : h('div', { class: 'bt-who' }, h('b', null, pl.name), whoPts);
  my.whoPts = whoPts;
  const card = h('div', { class: 'bt-qcard' });
  const zone = h('div', { class: 'bt-answer' });
  const assist = item.assist && item.hint ? kit.bubble(frTypo('Petit coup de pouce : ' + item.hint), 'hint') : null;
  clear(my.main);
  my.main.append(h('div', { class: 'bt-q' }, who, assist, card), zone);
  const done = (correct, rightText, after) => answer(my, pl, item, { correct, rightText, card, zone, after });

  if (item.axis === 'fr.conjug') {
    my.grid = renderConjug(item, card, zone, done);
  } else {
    my.grid = renderMaths(my, item, card, zone, done);
  }
  voiceQuestion(my, pl, item, { card, zone });
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
    return grid;
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
  return null;
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
  return grid;
}

/* ----- réponse : points, progression du joueur, retour doux ----- */
function answer(my, pl, item, { correct, rightText, card, zone, after }) {
  if (my.locked || my.phase !== 'question') return;
  my.locked = true;
  my.phase = 'feedback';
  voiceDone(my, pl, item);
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
  try { if (G.__caramelDebug) { G.__caramelDebug.item = null; G.__caramelDebug.last = { correct: !!correct, via: my.via, ms, player: pl.id, t: nowMs() }; } } catch (_) {}

  /* retour */
  const fbBox = h('div', { class: 'bt-fb' + (correct ? ' is-right' : ' is-learn'), role: 'status', 'aria-live': 'polite' });
  const nx = peekTurn(my, my.turn);
  const next = h('button', { type: 'button', class: 'btn big block bt-next' },
    nx ? frTypo((nx.pl === pl ? 'Question suivante' : 'Au tour ' + deNom(nx.pl.name)) + ' ➜') : frTypo(my.duel ? 'Voir mes points 🏆' : 'Voir les résultats 🏆'));
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
  /* la feuille de confirmation couvre la question : la voix ne tape rien derrière elle */
  const held = my.va && my.phase === 'question';
  if (held) my.va.pause(true);
  const ok = await confirmIn(my.wrap.getAttribute('data-theme'),
    frTypo(my.duel ? 'Arrêter la partie ? Tes progrès sont gardés.' : 'Arrêter le défi ? Les progrès de chacun sont gardés.'),
    { ok: 'Arrêter', cancel: 'Continuer', icon: my.duel ? '👫' : '⚔️' });
  if (held && st === my && my.va && my.phase === 'question' && !ok) voiceApply(my, false);
  if (!ok || st !== my) return;
  removeKey('sessionStorage', my.duel ? DUEL_KEY : SS_KEY);
  for (const pl of my.players) { try { if (pl.manche && !pl.manche.closed) pl.summary = pl.manche.abort(); } catch (_) {} }
  router.back();
}

/* ============ 3. RÉSULTATS ============ */
function results(my) {
  if (my.phase === 'results') return;
  my.phase = 'results';
  dropKeypad(my);
  dropVoice(my);
  const today = my.today;
  for (const pl of my.players) {
    if (pl.manche && !pl.manche.closed) {
      try { pl.summary = pl.abandoned ? pl.manche.abort() : pl.manche.finish(); } catch (_) {}
    }
  }
  if (my.duel) { duelResults(my); return; }
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
  const names = list => frList(list.map(p => p.name));
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

/* ============ 4. « AVEC UN COPAIN » (#/battle?duel=<code>&n=<jeton>) ============ */
/* partie de ce code et de ce jeton gardée pour l'onglet (même jour, même enfant) → état, sinon null */
function readDuel(id, code, n) {
  const s = readJSON('sessionStorage', DUEL_KEY);
  if (!s || s.v !== 1 || s.d !== dayStr() || s.duel !== code || String(s.n || '') !== n || !s.cfg || s.cfg.duel !== code) return null;
  if (!Array.isArray(s.players) || s.players.length !== 1 || !s.players[0] || s.players[0].id !== id) return null;
  return s;
}
function mountDuel(root, code, nonce) {
  const me = store.getProfile();
  const d = D.decodeCode(code);
  if (!me || !me.classe || !d.ok) { router.go(me && me.classe ? 'duel' : 'home', { replace: true }); return; }
  const wrap = h('div', { class: 'bt du is-duel' });
  clear(root);
  root.appendChild(wrap);
  const n = String(nonce || '');
  const my = st = { root, wrap, timers: new Set(), players: [], cfg: null, phase: 'setup', dead: false, kp: null, duel: { code: d.code, n }, micFirst: me.id };
  const saved = readDuel(me.id, d.code, n);
  if (saved && saved.done) {                    /* rechargement après la fin : le bilan, sans redonner les pommes */
    const s0 = saved.players[0];
    my.cfg = saved.cfg;
    my.today = saved.d;
    my.rewarded = true;
    my.players = [{ id: me.id, name: me.name, g: me.g, theme: themeIdOf(me), classe: me.classe, points: Math.max(0, Math.round(Number(s0.points) || 0)),
      answered: Math.max(0, s0.answered | 0), correct: Math.max(0, s0.correct | 0), gained: Math.max(0, s0.gained | 0), abandoned: false, manche: null }];
    showDuelResults(my, { replay: true });
    return;
  }
  startBattle(my, { ids: [me.id], type: d.type, rounds: d.rounds, duel: d.code }, saved);
}
function duelResults(my) {
  const pl = my.players[0];
  if (pl && !my.rewarded) {
    my.rewarded = true;
    const rw = D.duelRewards(pl);              /* participation ; jamais de trophée (l'appli ne sait pas qui a gagné) */
    if (rw.apples) store.mutateProfile(q => { addApples(q, rw.apples, my.today); }, pl.id);
    const s = pl.summary || {};
    pl.gained = Math.max(0, (s.apples | 0) + (s.streakBonus | 0)) + rw.apples;
  }
  saveState(my, true);
  swap(my, () => showDuelResults(my));
}
/* le bilan à MONTRER : le compagnon et les points en très gros, le défi et son code (les deux écrans doivent avoir le
   même) ; jamais le prénom (resultCard) ; une place est gardée pour le QR du résultat (plus tard) */
function showDuelResults(my, { replay = false } = {}) {
  my.phase = 'results';
  dropKeypad(my);
  dropVoice(my);
  my.wrap.removeAttribute('data-theme');
  const pl = my.players[0];
  const p = pl && store.getProfile(pl.id);
  if (!pl || !p) { router.back(); return; }
  const card = D.resultCard(p, { code: my.duel.code, points: pl.points, answered: pl.answered, correct: pl.correct, apples: pl.gained });
  const d = D.decodeCode(card.code);
  const ch = F.CHALLENGE_BY_ID[card.type];
  const pic = h('span', { class: 'du-res-pic', 'aria-hidden': 'true' });
  putPet(pic, p, 168, '', { expr: 'proud' });
  const stage = h('div', { class: 'du-res-stage' }, pic, h('span', { class: 'du-res-name' }, card.pet.name));
  const pts = h('b', { class: 'du-res-pts' }, replay ? fmtNum(card.points) : '0');
  const score = h('p', { class: 'du-res-score' }, h('span', { class: 'sr-only' }, card.pet.name + ' : '), pts, h('span', { class: 'du-res-unit' }, card.points >= 2 ? 'points' : 'point'));
  const meta = h('p', { class: 'du-res-meta' },
    ch ? h('span', { class: 'du-chip' }, frTypo(ch.icon + ' ' + ch.title + ' · ' + card.rounds + ' questions')) : null,
    h('span', { class: 'du-res-code' }, h('span', { class: 'du-res-code-l' }, 'code'), ' ', d.ok ? D.codeDigits(d.code).join('\u2009') : ''));
  const extra = h('p', { class: 'du-res-extra' },
    frTypo('✅ ' + plural(card.correct, 'bonne réponse', 'bonnes réponses')), card.apples ? h('span', { class: 'du-res-apples' }, '🍎\u00a0+' + card.apples) : null);
  const showText = 'Montre ton écran à ton copain : qui a le plus de points ?';
  const show = h('p', { class: 'du-res-show' }, h('span', { 'aria-hidden': 'true' }, '👫 '), frTypo(showText));
  /* QR du résultat (palier suivant) : il viendra ici, fabriqué depuis `card` (resultCard, sans prénom) */
  const share = h('div', { class: 'du-res-share', hidden: true, 'data-card': JSON.stringify(card) });
  const again = h('button', { type: 'button', class: 'btn big block du-again' }, frTypo('Encore une partie 👫'));
  again.addEventListener('click', () => { audio.tap(); removeKey('sessionStorage', DUEL_KEY); router.go('duel', { replace: true }); });
  const done = h('button', { type: 'button', class: 'btn white block' }, 'Terminé ✓');
  done.addEventListener('click', () => { audio.tap(); removeKey('sessionStorage', DUEL_KEY); router.back(); });
  const top = topbar(h('h1', { class: 'topbar-title' }, frTypo('Bravo ! 🎉')), () => { removeKey('sessionStorage', DUEL_KEY); router.back(); });
  const screen = h('div', { class: 'screen du-results' }, top,
    h('div', { class: 'du-res' }, stage, score, meta, extra, show, share),
    h('div', { class: 'du-res-btns' }, again, done));
  clear(my.wrap);
  my.wrap.appendChild(screen);
  my.live = null;
  if (replay) return;
  motion.stagger([stage, score, meta, extra, show], el => motion.enter(el, { from: 'bottom', dist: 18, dur: 420 }), 90);
  later(my, () => {
    motion.countUp(pts, 0, card.points, 1100, v => fmtNum(Math.round(v)));
    audio.fanfare();
    if (card.points > 0) motion.confetti();
    petMood(pic, 'dance');
    const lf = lifeOf(pic);
    if (lf && lf.react) { try { lf.react('celebrate'); } catch (_) {} }
    voice.speak(frTypo('Bravo ! Tu as ' + plural(card.points, 'point', 'points') + '. Montre ton écran à ton copain !'));
  }, 420);
  later(my, () => petMood(pic, 'joy'), 4200);
}
