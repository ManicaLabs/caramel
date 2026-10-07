/* ============ « 👫 AVEC UN COPAIN » (#/duel) — le même défi sur deux téléphones, sans réseau ============
   Décision du parent (07/10/2026), palier 1 de l'étude « multijoueur » : chacun sur SON téléphone, sans réseau, le même
   défi, et on compare les points à la fin en montrant son écran. Règle, code et points : js/core/duel.js (pur, testé).
   « Un seul gros bouton » (CDC §1 principe 7) : une étape par écran, une phrase, la voix du compagnon.
     #/duel                        « Avec un copain » : Je lance 📣 · Je rejoins 🔢
     #/duel?step=lance             « Quel défi ? » : les quatre défis du Défi en famille (toucher = c'est choisi) ;
                                   longueur en petit au-dessus (3 ou 5 questions, la dernière choisie est gardée)
     #/duel?step=code&role=hote    le code en GRAND, dit chiffre par chiffre par le compagnon (🔊 le redit),
           &code=4821              le défi rappelé, « C'est parti ▶ »
     #/duel?step=rejoins           « Tape le code » : quatre cases et le pavé du kit ; quatre chiffres tapés → vérifiés
                                   aussitôt (une faute de frappe est refusée gentiment, le chiffre suivant recommence)
     #/duel?step=code&role=invite  même écran que l'hôte (les deux téléphones montrent le même code : on vérifie d'un
                                   coup d'œil), « Le code marche ! », « C'est parti ▶ »
   « C'est parti ▶ » → #/battle?duel=<code>&n=<jeton> : la partie et le bilan, dans js/ui/battle.js (mode « duel » :
   un seul joueur sur cet appareil, questions à son niveau). Le jeton distingue deux parties du même code (le
   rechargement d'une page reprend la partie, ou remontre son bilan).
   Historique : les étapes se REMPLACENT (une seule entrée « Avec un copain ») ; ← revient à l'étape d'avant, le retour
   Android ramène là d'où l'on vient (accueil). Le bandeau de mise à jour ne vient pas ici (js/main.js, BUSY_ROUTES).
   Le prénom de l'enfant n'est jamais dans le code ni dit avec lui. Mémoire de l'appareil (localStorage
   'caramel-duel-prefs') : longueur choisie et dernier code donné (jamais redonné tout de suite).
   v2.4 — temps de jeu du jour (js/core/playtime.js, js/ui/play-limit.js) : l'enfant actif au bout de son temps de jeu
   ne lance ni ne rejoint de partie : #/duel le ramène à l'accueil (« {N} se repose 💤 À demain ! »). */

import { h, clear, frTypo, loadCSS } from '../core/util.js';
import * as store from '../core/store.js';
import * as router from '../router.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import * as kit from './kit.js';
import * as voice from './voice.js';
import * as D from '../core/duel.js';
import { CHALLENGES, CHALLENGE_BY_ID } from '../core/family.js';
import { makeRng } from '../core/rng.js';
import { petReady, putPet, petMood } from './famille.js';
import { timeUp, restNotice } from './play-limit.js';

const PREFS_KEY = 'caramel-duel-prefs';
const G = globalThis;
const readPrefs = () => { try { const s = G.localStorage && G.localStorage.getItem(PREFS_KEY); const v = s ? JSON.parse(s) : null; return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };
const writePrefs = v => { try { if (G.localStorage) G.localStorage.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(), ...v })); } catch (_) {} };

/* textes (écrits et dits) */
export const TEXT = Object.freeze({
  intro: 'Le même défi, chacun sur son téléphone. À la fin, on compare les points !',
  pick: 'Choisis le défi !',
  give: 'Dis ce code à ton copain.',
  giveTip: 'Ton copain touche « Je\u00a0rejoins », puis tape ce code.',
  type: 'Tape le code de ton copain.',
  short: 'Il faut 4 chiffres.',
  wrong: 'Oups, ce code ne marche pas. Regarde bien l’écran de ton copain !',
  good: 'Le code marche !'
});
/* « 🏇 Tables · 5 questions » */
export function challengeLine(d) {
  const ch = d && CHALLENGE_BY_ID[d.type];
  return ch ? ch.icon + ' ' + ch.title + ' · ' + d.rounds + ' questions' : '';
}

let st = null;

export default {
  async mount(root, params, query = {}) {
    await Promise.all([loadCSS('css/ui/battle.css'), loadCSS('css/ui/duel.css'), petReady()]);
    if (!root.isConnected) return;
    teardown();
    const p = store.getProfile();
    if (!p || !p.classe) { router.go('home', { replace: true }); return; }
    /* temps de jeu du jour atteint (v2.4) : pas de nouvelle partie aujourd'hui → l'accueil, où le compagnon se repose */
    if (timeUp(p)) { restNotice(p); router.go('home', { replace: true }); return; }
    const wrap = h('div', { class: 'bt du' });
    clear(root);
    root.appendChild(wrap);
    const my = st = { root, wrap, timers: new Set(), kp: null, dead: false };
    const step = String(query.step || '');
    if (step === 'lance') pickScreen(my, p);
    else if (step === 'rejoins') joinScreen(my, p);
    else if (step === 'code') {
      const d = D.decodeCode(query.code);
      if (!d.ok) { router.go('duel', { replace: true }); return; }
      codeScreen(my, p, d, query.role === 'invite' ? 'invite' : 'hote');
    } else entryScreen(my, p);
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
  if (my.kp) { try { my.kp.destroy(); } catch (_) {} my.kp = null; }
  try { voice.hush(); } catch (_) {}
}
function later(my, fn, ms) {
  const t = setTimeout(() => { my.timers.delete(t); if (st === my && !my.dead) fn(); }, ms);
  my.timers.add(t);
  return t;
}
/* étape suivante (ou précédente) : remplace l'entrée d'historique */
const toStep = (step, extra = {}) => router.go('duel', { query: step ? { step, ...extra } : null, replace: true });

function topbar(title, onBack, extra) {
  const back = h('button', { type: 'button', class: 'back', 'aria-label': 'Retour' }, '←');
  back.addEventListener('click', () => { audio.tap(); onBack(); });
  return h('div', { class: 'topbar bt-top du-top' }, back, h('h1', { class: 'topbar-title' }, title),
    extra || h('span', { class: 'bt-top-gap', 'aria-hidden': 'true' }));
}
/* le compagnon qui parle : son portrait vivant, la phrase écrite (et dite), 🔊 pour la réentendre */
function speaker(p, text, { size = 96, expr = 'happy', say = text, live = false } = {}) {
  const pic = h('span', { class: 'du-pet', 'aria-hidden': 'true' });
  putPet(pic, p, size, '', { expr, live: true });
  const line = h('p', { class: 'du-say', 'aria-live': live ? 'polite' : null }, frTypo(text));
  let current = say;
  const listen = voice.listenOn(p) ? voice.listenButton(() => current, { label: 'Écouter' }) : null;
  const el = h('div', { class: 'du-speaker' }, pic, h('div', { class: 'du-say-box' }, line, listen));
  return {
    el, pic,
    set(t, s = t) { line.textContent = frTypo(t); current = s; },
    speak() { if (current) voice.speak(current); }
  };
}
/* la voix part une fois l'écran posé (transition de vue) */
function sayLater(my, sp, ms = 380) { later(my, () => sp.speak(), motion.reduced() ? 120 : ms); }

/* ---------- 1. « Avec un copain » : je lance, ou je rejoins ---------- */
function entryScreen(my, p) {
  const sp = speaker(p, TEXT.intro, { size: 150, expr: 'delighted' });
  const choice = (icon, title, sub, fn, cls) => {
    const b = h('button', { type: 'button', class: 'du-choice ' + cls },
      h('span', { class: 'du-choice-ico', 'aria-hidden': 'true' }, icon),
      h('span', { class: 'du-choice-txt' }, h('b', null, title), h('span', null, frTypo(sub))));
    b.addEventListener('click', () => { audio.tap(); motion.pop(b, { scale: 1.04 }); fn(); });
    return b;
  };
  const host = choice('📣', 'Je lance', 'Je choisis le défi', () => toStep('lance'), 'is-host');
  const guest = choice('🔢', 'Je rejoins', 'J’ai un code', () => toStep('rejoins'), 'is-guest');
  const screen = h('div', { class: 'screen du-screen du-entry' },
    topbar('Avec un copain', () => router.back()),
    sp.el, h('div', { class: 'du-choices', role: 'group', 'aria-label': 'Je lance ou je rejoins ?' }, host, guest));
  clear(my.wrap);
  my.wrap.appendChild(screen);
  motion.stagger([sp.el, host, guest], el => motion.enter(el, { from: 'bottom', dist: 14, dur: 380 }), 70);
  later(my, () => petMood(sp.pic, 'hop'), 420);
  sayLater(my, sp);
}

/* ---------- 2. « Quel défi ? » (l'hôte) ---------- */
function pickScreen(my, p) {
  const prefs = readPrefs();
  let rounds = D.DUEL.ROUNDS.includes(prefs.rounds) ? prefs.rounds : D.DUEL.DEFAULT_ROUNDS;
  const seg = h('div', { class: 'seg du-len', role: 'group', 'aria-label': 'Combien de questions ?' });
  const lenBtns = D.DUEL.ROUNDS.map(n => {
    const b = h('button', { type: 'button', 'data-n': String(n), 'aria-pressed': 'false' }, n + ' questions');
    b.addEventListener('click', () => { if (rounds !== n) { rounds = n; audio.tap(); writePrefs({ rounds }); refresh(); } });
    seg.appendChild(b);
    return b;
  });
  function refresh() {
    for (const b of lenBtns) {
      const on = Number(b.dataset.n) === rounds;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  refresh();
  const grid = h('div', { class: 'bt-types du-types', role: 'group', 'aria-label': 'Quel défi ?' });
  let picked = false;
  for (const c of CHALLENGES) {
    if (!D.CODE_TYPES.includes(c.id)) continue;
    const b = h('button', { type: 'button', class: 'bt-type du-type', 'data-id': c.id },
      h('span', { class: 'bt-type-ico', 'aria-hidden': 'true' }, c.icon),
      h('span', { class: 'bt-type-title' }, c.title), h('span', { class: 'bt-type-blurb' }, frTypo(c.blurb)));
    b.addEventListener('click', () => {
      if (picked) return;
      picked = true;
      audio.tap();
      motion.pop(b, { scale: 1.05 });
      const last = readPrefs().last || '';
      const code = D.newCode({ type: c.id, rounds }, makeRng((Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0), last);
      writePrefs({ rounds, last: code });
      later(my, () => toStep('code', { code, role: 'hote' }), motion.reduced() ? 0 : 160);
    });
    grid.appendChild(b);
  }
  const sp = speaker(p, TEXT.pick, { size: 72, expr: 'happy' });
  const screen = h('div', { class: 'screen du-screen du-pick' },
    topbar('Quel défi ?', () => toStep('')),
    sp.el, h('div', { class: 'du-len-row' }, seg), grid);
  clear(my.wrap);
  my.wrap.appendChild(screen);
  motion.stagger([sp.el, seg, ...grid.children], el => motion.enter(el, { from: 'bottom', dist: 12, dur: 340 }), 50);
  sayLater(my, sp);
}

/* ---------- 3. le code, en grand (l'hôte le donne, l'invité vérifie qu'il a le même) ---------- */
function codeBoxes(code, { label = true } = {}) {
  const digits = D.codeDigits(code);
  const el = h('div', { class: 'du-code', role: label ? 'img' : null, 'aria-label': label ? 'Code : ' + digits.join(' ') : null },
    ...digits.map(d => h('span', { class: 'du-digit', 'aria-hidden': label ? 'true' : null }, d)));
  return el;
}
function codeScreen(my, p, d, role) {
  const host = role === 'hote';
  const sayCode = (host ? TEXT.give : TEXT.good) + ' ' + D.spokenCode(d.code);
  const sp = speaker(p, host ? TEXT.give : TEXT.good, { size: 80, expr: host ? 'happy' : 'delighted', say: host ? sayCode : TEXT.good });
  const chip = h('p', { class: 'du-chip' }, frTypo(challengeLine(d)));
  const code = codeBoxes(d.code);
  const go = h('button', { type: 'button', class: 'btn play block du-go' },
    h('span', null, frTypo('C’est parti')), h('span', { class: 'btn-play-ico', 'aria-hidden': 'true' }, '▶'));
  let gone = false;
  go.addEventListener('click', () => {
    if (gone) return;
    gone = true;
    audio.tap();
    voice.hush();
    router.go('battle', { query: { duel: d.code, n: Date.now().toString(36) }, replace: true });
  });
  const tip = host ? h('p', { class: 'du-tip' }, frTypo(TEXT.giveTip)) : null;
  const screen = h('div', { class: 'screen du-screen du-code-screen' + (host ? ' is-host' : ' is-guest') },
    topbar(host ? 'Ton code' : frTypo(TEXT.good), () => toStep(host ? 'lance' : 'rejoins')),
    sp.el, h('div', { class: 'du-code-card' }, chip, code, tip), go);
  clear(my.wrap);
  my.wrap.appendChild(screen);
  motion.stagger([sp.el, chip, ...code.children, go], el => motion.enter(el, { from: 'scale', dur: 340 }), 70);
  if (!host) later(my, () => { petMood(sp.pic, 'joy'); audio.success(2); }, 300);
  sayLater(my, sp, 520);
}

/* ---------- 4. « Je rejoins » : le code du copain, au pavé ---------- */
function joinScreen(my, p) {
  const sp = speaker(p, TEXT.type, { size: 72, expr: 'happy', live: true });
  const boxes = h('div', { class: 'du-code is-input', 'aria-hidden': 'true' },
    ...Array.from({ length: D.DUEL.LEN }, () => h('span', { class: 'du-digit' })));
  const sr = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  let checking = false;
  const show = raw => {
    [...boxes.children].forEach((b, i) => {
      b.textContent = raw[i] || '';
      b.classList.toggle('is-now', i === raw.length && !checking);
    });
    sr.textContent = raw ? 'Code : ' + raw.split('').join(' ') : '';
  };
  const check = raw => {
    const r = D.decodeCode(raw);
    if (r.ok) {
      checking = true;
      kp.disable(true);
      kp.setState('right');
      boxes.classList.add('is-right');
      audio.success(1);
      motion.pop(boxes, { scale: 1.06 });
      later(my, () => toStep('code', { code: r.code, role: 'invite' }), motion.reduced() ? 150 : 520);
      return;
    }
    const msg = r.reason === 'short' || r.reason === 'empty' ? TEXT.short : TEXT.wrong;
    sp.set(msg);
    sp.speak();
    audio.soft();
    motion.shake(boxes, { dist: 6, dur: 320 });
    if (r.reason !== 'short' && r.reason !== 'empty') {
      kp.setState('wrong');                       /* le chiffre suivant recommence la saisie */
      boxes.classList.add('is-wrong');
    }
  };
  const kp = my.kp = kit.keypad({
    maxLen: D.DUEL.LEN,
    onChange: raw => {
      boxes.classList.remove('is-wrong');
      show(raw);
      if (raw.length === D.DUEL.LEN) later(my, () => { if (my.kp === kp && kp.value() === raw && !checking) check(raw); }, 160);
      else if (sp && raw.length === 1) sp.set(TEXT.type);
    },
    onSubmit: raw => { if (!checking) check(raw); }
  });
  show('');
  const screen = h('div', { class: 'screen is-full du-screen du-join' },
    topbar('Le code', () => toStep('')),
    sp.el, h('div', { class: 'du-code-card' }, boxes, sr), h('div', { class: 'du-keys' }, kp.el));
  clear(my.wrap);
  my.wrap.appendChild(screen);
  motion.stagger([sp.el, boxes, kp.el], el => motion.enter(el, { from: 'bottom', dist: 12, dur: 340 }), 60);
  sayLater(my, sp);
}
