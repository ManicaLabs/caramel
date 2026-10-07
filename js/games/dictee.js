/* ============ LA DICTÉE DE {N} — fr.ortho, la liste de la semaine (v2.6, décisions du parent du 07/10/2026) ============
   Les mots sont ceux de la liste tapée par un adulte (espace parents, profile.dictee ; logique : js/core/dictee.js).
   L'enfant écrit sur une feuille (ou une ardoise) ; c'est LUI qui corrige, mot par mot. Une action par écran
   (CDC §1 principe 7) :
   0. PRÉPARER : « Je prépare ta dictée… » — tout ce qui sera dit est calculé d'avance par la voix fluide (barre) ; voix
      du téléphone : rien à calculer ; aucune voix pour un mot libre : un adulte est prévenu. Puis « Prends une feuille
      et un crayon » et UN bouton « C'est parti ▶ » (le geste qui permet aussi au son de partir).
   1. ÉCOUTER : le compagnon dicte, au rythme de la classe : « maison… Je rentre à la maison… maison. » (le mot lentement,
      la phrase facultative de l'adulte, le mot) ; « 🔁 Encore » le redit (jamais compté) ; le mot n'est jamais écrit ;
      « ✍️ C'est écrit ▶ » apparaît une fois la dictée dite.
   2. COMPARER : le mot juste en grand (police de lecture, lettres espacées) ; « Regarde ta feuille : as-tu écrit
      pareil ? » → « ✓ Juste » (🍎, le compagnon saute de joie, mot suivant) ou « ✗ À revoir ».
   3. RECOPIER (après « À revoir ») : « Pas grave ! Regarde bien le mot, et recopie-le juste à côté. » → « C'est recopié ▶ »
      (🍎 aussi : se corriger soi-même, c'est le travail demandé ; l'honnêteté n'est jamais punie). Le mot passe en boîte 1
      (Leitner) et reviendra EN TÊTE de la prochaine dictée.
   Correction mot par mot plutôt qu'à la fin (choix pour les CP-CE1) : le mot est encore frais (pas de mémoire de 10 mots
   à tenir), l'enfant n'a qu'une ligne à regarder, la recopie suit l'erreur, et une dictée interrompue garde ce qui est
   fait. Bilan par la coquille : « Tu as su écrire 5 mots du premier coup ! » (praise : jamais de note ni d'erreur comptée).
   Voix : le contenu (les mots) est dit même si « Lire les consignes à voix haute » est sur Non, jamais sons coupés (🔇 :
   une phrase le dit, la dictée reprend quand le son revient) ; rien n'est dit micro ouvert (pas de micro ici). Pas de
   joker (rien à souffler dans une dictée) ; pas de « Pas encore appris ». Mouvement réduit : fondus seulement.
   Balade : 6, 8 ou 10 mots selon la séance (70 % en échauffement), à revoir d'abord ; partie libre : toute la liste. */

import { h, clear, frTypo } from '../core/util.js';
import * as store from '../core/store.js';
import * as D from '../core/dictee.js';

const START_MS = 700;          /* l'écran du mot s'installe avant que la voix parte */
const NEXT_MS = 900;           /* ✓ : mot suivant, une fois l'encouragement dit (au plus NEXT_MAX_MS) */
const NEXT_MAX_MS = 3200;
const MUTE_WRITE_MS = 6000;    /* voix en panne : « C'est écrit » apparaît quand même */
const SAY_COMPARE = 2;         /* « Regarde ta feuille… » est dit aux deux premiers mots, ensuite seulement écrit */

let inst = null;

export function praise(summary) { return D.praise(summary); }

export default {
  id: 'dictee', title: 'La dictée de {N}', icon: '📝', axes: ['fr.ortho'],
  css: 'css/games/dictee.css',
  intro: true,                                  /* se présente lui-même (écran de préparation) */
  praise,
  async mount(root, ctx) {
    if (inst) inst.destroy();
    inst = createDictee(root, ctx);
    await inst.start();
  },
  unmount() {
    if (inst) inst.destroy();
    inst = null;
  }
};

function createDictee(root, ctx) {
  let alive = true;
  const timers = new Set();
  const cleanups = [];
  const safe = (fn, ...a) => { try { return fn(...a); } catch (e) { console.error('dictee', e); return null; } };
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (alive) safe(fn); }, Math.max(0, ms));
    timers.add(id);
    return id;
  };
  const wait = ms => new Promise(r => later(r, ms));
  const nowMs = () => (globalThis.performance && performance.now ? performance.now() : Date.now());
  const reduced = () => { try { return !!ctx.motion.reduced(); } catch (_) { return false; } };
  const F = s => { try { return ctx.fill(String(s ?? '')); } catch (_) { return String(s ?? ''); } };
  const T = s => frTypo(F(s));
  const announce = t => safe(() => ctx.announce(String(t || '')));
  const sound = name => { try { const f = ctx.audio && ctx.audio[name]; if (typeof f === 'function') return f(); } catch (_) {} return null; };
  const cheer = kind => { try { return ctx.kit.cheer(kind); } catch (_) { return ''; } };
  const M = ctx.motion;
  const listen = (target, ev, fn, opts) => {
    if (!target || !target.addEventListener) return;
    target.addEventListener(ev, fn, opts);
    cleanups.push(() => { try { target.removeEventListener(ev, fn, opts); } catch (_) {} });
  };
  /* consigne du compagnon (lecture à voix haute des consignes) ; contenu de la dictée : sayWord */
  const say = (t, quiet = false) => {
    try { return Promise.resolve(ctx.voice.say(T(t), { quiet })).catch(() => false); } catch (_) { return Promise.resolve(false); }
  };
  const hush = () => { try { ctx.voice.hush(); } catch (_) {} };
  const contentOn = () => { try { return !!ctx.voice.contentOn; } catch (_) { return true; } };

  /* ================= DOM ================= */
  const petIn = h('div', { class: 'dc-pet-in', html: safe(() => ctx.petSVG(150, '', { expr: 'happy' })) || '' });
  const pet = h('div', { class: 'dc-pet', 'aria-hidden': 'true' }, petIn);
  const bubble = h('p', { class: 'dc-say', id: 'dc-say' });
  const top = h('div', { class: 'dc-top' }, pet, bubble);
  const mid = h('div', { class: 'dc-mid' });
  const acts = h('div', { class: 'dc-acts' });
  const box = h('div', { class: 'dc is-prep' }, top, mid, acts);
  root.appendChild(box);

  /* ================= ÉTAT ================= */
  let phase = 'init';            /* prep → ready → listen → compare → (copy) → … → end ; empty | novoice */
  let plan = [], states = [], idx = -1, cur = null, ended = false, started = false;
  let ritualSeq = 0, writeBtn = null, writeShown = false, lastOn = null;

  function setPhase(p) {
    phase = p;
    box.className = 'dc is-' + p;
  }
  function setPet(expr, mood = '') {
    petIn.innerHTML = safe(() => ctx.petSVG(150, mood, { expr })) || '';
  }
  /* bulle du compagnon : « recopie-le », « as-tu » ne se coupent pas au trait d'union */
  function setBubble(text, { hidden = false } = {}) {
    clear(bubble);
    if (text) for (const part of T(text).split(/(\p{L}+(?:-\p{L}+)+)/u)) if (part) bubble.appendChild(/-/.test(part) && /^\p{L}/u.test(part) ? h('span', { class: 'dc-nw' }, part) : document.createTextNode(part));
    bubble.classList.toggle('hidden', hidden || !text);
  }
  function focusEl(el) { if (el) { try { el.focus({ preventScroll: true }); } catch (_) {} } }
  function enter(el, from = 'bottom') { if (el && !reduced()) safe(() => M.enter(el, { from, dur: 300 })); }
  function primary(label, icon, onClick, cls = '') {
    const b = h('button', { type: 'button', class: ('btn play block dc-go ' + cls).trim() },
      h('span', null, T(label)), icon ? h('span', { class: 'btn-play-ico', 'aria-hidden': 'true' }, icon) : null);
    listen(b, 'click', () => { if (alive) onClick(); });
    return b;
  }
  function progress(i) { safe(() => ctx.progress(i, plan.length, states)); }
  function muteNote(show) {
    let n = mid.querySelector('.dc-mute');
    if (!show) { if (n) n.remove(); return; }
    if (n) { if (!reduced()) safe(() => M.pop(n, { scale: 1.05, dur: 260 })); return; }
    n = h('p', { class: 'dc-mute', role: 'status' }, T(D.LINES.muted));
    mid.appendChild(n);
    enter(n, 'fade');
  }

  /* ================= 0. PRÉPARER ================= */
  function sizeOfDictee(p) {
    let n = D.sizeFor(p, ctx.mode === 'balade' ? 'balade' : 'libre');
    try { if (ctx.mode === 'balade' && ctx.manche && ctx.manche.kind === 'echauffement') n = Math.max(3, Math.ceil(0.7 * n)); } catch (_) {}
    return n;
  }
  async function showPrep() {
    setPhase('prep');
    setPet('happy');
    clear(mid); clear(acts);
    setBubble(D.LINES.prep);
    announce(T(D.LINES.prep));
    const free = (() => { try { return ctx.voice.free; } catch (_) { return null; } })();
    if (!free) { showNoVoice(); return; }
    if (free === 'tts' || !contentOn()) { showReady(); return; }
    /* voix fluide (prête ou qui démarre) : tout est calculé avant de commencer ; pendant ce temps, l'enfant prend sa
       feuille et son crayon (l'attente sert à quelque chose) */
    const fill = h('span', { class: 'dc-bar-fill' });
    const bar = h('div', { class: 'dc-bar', role: 'progressbar', 'aria-label': 'Préparation de la dictée', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, fill);
    const pencil = h('p', { class: 'dc-prep-ico', 'aria-hidden': 'true' }, '📄✏️');
    mid.append(pencil, h('p', { class: 'dc-prep-t' }, T(D.LINES.ready)), bar);
    bar.classList.add('is-wait');                      /* la barre glisse jusqu'au premier mot prêt */
    say(D.LINES.prep + ' ' + D.LINES.ready);
    let res = null;
    try {
      /* du dernier mot au premier : si le son gardé en mémoire déborde (120 s), ce sont les derniers mots qui sont
         recalculés plus tard (pendant que l'enfant écrit), jamais le premier */
      res = await ctx.voice.prepareAll(D.prepList(plan.slice().reverse()), {
        waitMs: 15000,
        onStep: (done, total) => {
          if (!alive || phase !== 'prep' || !done) return;
          bar.classList.remove('is-wait');
          const pct = total ? Math.round(100 * done / total) : 100;
          fill.style.width = pct + '%';
          bar.setAttribute('aria-valuenow', String(pct));
        }
      });
    } catch (_) { res = null; }
    if (!alive || phase !== 'prep') return;
    fill.style.width = '100%';
    bar.setAttribute('aria-valuenow', '100');
    /* voix fluide finalement pas prête : la voix du téléphone dira la dictée en direct (sinon, personne ne peut la dire) */
    if (res && res.why === 'not-ready' && !(() => { try { return ctx.voice.free; } catch (_) { return null; } })()) { showNoVoice(); return; }
    await wait(reduced() ? 0 : 250);
    if (alive && phase === 'prep') showReady({ said: true });
  }
  function showReady({ said = false } = {}) {
    setPhase('ready');
    setPet('happy');
    clear(mid); clear(acts);
    const line = D.LINES.ready;
    setBubble(line);
    mid.appendChild(h('p', { class: 'dc-prep-ico is-big', 'aria-hidden': 'true' }, '📄✏️'));
    if (!contentOn()) muteNote(true);
    const go = primary('C’est parti', '▶', () => { sound('tap'); hush(); startWord(0); });
    go.setAttribute('aria-describedby', 'dc-say');
    acts.appendChild(go);
    enter(go);
    focusEl(go);
    announce(T(line));
    if (!said) say(line);
  }

  /* ================= 1. ÉCOUTER ================= */
  function startWord(i) {
    if (!alive || ended) return;
    if (i >= plan.length) { finish(); return; }
    const entry = plan[i];
    const item = safe(() => ctx.nextItem(undefined, { word: { w: entry.w, s: entry.s } }));
    if (!item) { finish(); return; }
    idx = i;
    cur = { entry, item, t0: nowMs(), said: false };
    writeShown = false; writeBtn = null;
    progress(i);
    setPhase('listen');
    setPet('focused');
    clear(mid); clear(acts);
    setBubble(i === 0 ? D.LINES.listen : 'Écoute bien…');
    const again = h('button', { type: 'button', class: 'btn white dc-again', 'aria-label': 'Encore : redire le mot' },
      h('span', { 'aria-hidden': 'true' }, '🔁'), h('span', null, 'Encore'));
    listen(again, 'click', () => {
      if (phase !== 'listen') return;
      sound('tap');
      if (!contentOn()) { muteNote(true); return; }
      runRitual();
    });
    /* au milieu : « Mot 3 » (pour numéroter la ligne sur la feuille), la grande oreille (elle ondule pendant la dictée,
       puis devient ✍️ : à toi d'écrire), et 🔁 Encore */
    const disc = h('div', { class: 'dc-disc', 'aria-hidden': 'true' }, h('i'), h('i'), h('span', { class: 'dc-disc-ico' }, '👂'));
    cur.disc = disc;
    mid.appendChild(h('div', { class: 'dc-listen' }, h('p', { class: 'dc-num' }, 'Mot ' + (i + 1)), disc, again));
    writeBtn = primary('C’est écrit', '▶', onWritten, 'dc-write');
    writeBtn.prepend(h('span', { class: 'dc-write-ico', 'aria-hidden': 'true' }, '✍️'));
    writeBtn.classList.add('is-hidden');
    writeBtn.setAttribute('aria-hidden', 'true');
    writeBtn.tabIndex = -1;
    acts.appendChild(writeBtn);
    announce('Mot ' + (i + 1) + ' sur ' + plan.length + '. ' + T(i === 0 ? D.LINES.listen : 'Écoute bien…'));
    if (!reduced()) safe(() => mid.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.22, 1, .36, 1)' }));
    focusEl(again);
    const go = () => { if (phase === 'listen' && cur && cur.entry === entry && !cur.begun) runRitual(); };
    /* 1er mot : la consigne d'abord (dite une fois), puis la dictée */
    if (i === 0 && contentOn()) say(D.LINES.listen).then(() => later(go, 350));
    else later(go, START_MS);
  }
  /* le rituel « mot… phrase… mot » ; un nouveau rituel (🔁) coupe le précédent */
  async function runRitual() {
    if (!cur || phase !== 'listen') return;
    const my = ++ritualSeq;
    const c = cur;
    c.begun = true;                      /* « 🔁 Encore » pendant la consigne : la dictée ne repart pas deux fois */
    hush();
    /* sons coupés : rien n'est dit ; une phrase le dit, la dictée part quand le son revient (watchSound) */
    if (!contentOn()) { box.classList.remove('is-speaking'); muteNote(true); return; }
    muteNote(false);
    box.classList.add('is-speaking');
    discIcon(c, '👂');
    const line = D.ritualText(c.entry);
    const live = () => alive && my === ritualSeq && cur === c && phase === 'listen';
    let heard = false;
    /* la voix du téléphone peut avoir besoin d'un instant après hush() */
    try { await ctx.voice.settle(); } catch (_) {}
    if (!live()) return;
    const ok = await D.playRitual(c.entry, {
      speak: (text, slow) => Promise.resolve(ctx.voice.say(text, { slow, content: true, line })).then(r => { if (r) heard = true; return r; }, () => false),
      wait,
      alive: live
    });
    if (!live()) return;
    box.classList.remove('is-speaking');
    if (!contentOn()) { muteNote(true); return; }
    /* voix en panne : le texte le dit, et l'enfant peut continuer (un adulte peut lui dicter le mot) */
    if (!heard && !ok) setBubble('Je n’arrive pas à parler 😕 Touche 🔁 pour réessayer.');
    else { setBubble(idx === 0 ? D.LINES.write : 'Écris le mot sur ta feuille.'); discIcon(c, '✍️'); }
    showWrite(heard || ok);
    /* le mot suivant est prêt (s'il a quitté le cache de la voix fluide) */
    const next = plan[idx + 1];
    if (next) safe(() => ctx.voice.prepareAll(D.prepList([next]), { waitMs: 0 }));
  }
  function discIcon(c, ico) {
    const el = c && c.disc && c.disc.querySelector('.dc-disc-ico');
    if (!el || el.textContent === ico) return;
    el.textContent = ico;
    if (!reduced()) safe(() => M.pop(c.disc, { scale: 1.08, dur: 300 }));
  }
  function showWrite(spoken) {
    if (!writeBtn || writeShown) return;
    writeShown = true;
    writeBtn.classList.remove('is-hidden');
    writeBtn.removeAttribute('aria-hidden');
    writeBtn.tabIndex = 0;
    enter(writeBtn);
    focusEl(writeBtn);
    if (spoken && idx === 0) say(D.LINES.write);
  }
  function onWritten() {
    if (phase !== 'listen' || !cur) return;
    ritualSeq++;
    hush();
    box.classList.remove('is-speaking');
    sound('tap');
    showCompare();
  }

  /* ================= 2. COMPARER ================= */
  function wordCard(c) {
    /* taille du mot selon sa longueur (jamais coupé au milieu : un groupe de mots passe à la ligne entre les mots) */
    const longest = Math.max(...c.entry.w.split(' ').map(x => x.length));
    const word = h('p', { class: 'dc-word', lang: 'fr' }, c.entry.w);
    word.style.setProperty('--n', String(Math.max(4, longest, Math.min(c.entry.w.length, 9))));
    const stamp = h('span', { class: 'dc-stamp hidden', 'aria-hidden': 'true' }, '✓');
    const card = h('div', { class: 'dc-card', role: 'group', 'aria-label': 'Le mot juste : ' + c.entry.w, tabindex: '-1' }, word, stamp);
    c.card = card; c.stamp = stamp;
    return card;
  }
  function showCompare() {
    const c = cur;
    setPhase('compare');
    setPet('focused');
    clear(mid); clear(acts);
    setBubble(D.LINES.compare);
    const card = wordCard(c);
    mid.appendChild(card);
    const yes = h('button', { type: 'button', class: 'btn dc-yes' }, h('span', { class: 'dc-mark', 'aria-hidden': 'true' }, '✓'), h('span', null, 'Juste'));
    const no = h('button', { type: 'button', class: 'btn dc-no' }, h('span', { class: 'dc-mark', 'aria-hidden': 'true' }, '✗'), h('span', null, frTypo('À revoir')));
    listen(yes, 'click', () => onRight(c));
    listen(no, 'click', () => onReview(c));
    acts.appendChild(h('div', { class: 'dc-choice', role: 'group', 'aria-label': T(D.LINES.compare) }, yes, no));
    if (!reduced()) {
      safe(() => card.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.34, 1.56, .64, 1)' }));
      safe(() => M.stagger([yes, no], b => M.enter(b, { from: 'scale', dur: 260 }), 60));
    }
    announce('Le mot juste : ' + c.entry.w + '. ' + T(D.LINES.compare));
    focusEl(card);
    if (idx < SAY_COMPARE) say(D.LINES.compare); else say(D.LINES.compare, true);
  }
  function report(c, clean) {
    const ms = Math.max(0, Math.round(nowMs() - c.t0));
    const fb = safe(() => ctx.report(c.item, clean ? { correct: true, hinted: false, ms, tries: 1 } : { correct: true, hinted: true, ms, tries: 2 })) || {};
    states[idx] = clean ? 'done' : 'helped';
    progress(idx + 1);
    if (ctx.applesEl && !reduced()) safe(() => M.flyTo(c.card || mid, ctx.applesEl, { emoji: '🍎', size: 26, dur: 600, arc: 0.3 }));
    return fb;
  }
  function onRight(c) {
    if (phase !== 'compare' || cur !== c) return;
    setPhase('right');
    hush();
    const fb = report(c, true);
    c.card.classList.add('is-right');
    c.stamp.classList.remove('hidden');
    if (!reduced()) safe(() => M.pop(c.stamp, { scale: 1.2, dur: 340 }));
    safe(() => ctx.kit.celebrateRight(c.card, fb && !fb.ignored ? (fb.streak | 0) : 0));
    setPet('delighted', 'joy');
    const msg = cheer('right');
    setBubble(msg);
    announce(msg);
    clear(acts);
    let gone = false;
    const go = () => { if (gone || cur !== c || phase !== 'right') return; gone = true; startWord(idx + 1); };
    say(msg).then(() => later(go, NEXT_MS));
    later(go, NEXT_MAX_MS);
  }

  /* ================= 3. RECOPIER ================= */
  function onReview(c) {
    if (phase !== 'compare' || cur !== c) return;
    setPhase('copy');
    hush();
    sound('tap');
    c.card.classList.add('is-copy');
    setPet('happy');
    setBubble(D.LINES.copy);
    clear(acts);
    const done = primary('C’est recopié', '▶', () => {
      if (phase !== 'copy' || cur !== c) return;
      sound('tap');
      hush();
      report(c, false);
      setPhase('copied');
      later(() => startWord(idx + 1), reduced() ? 150 : 450);
    });
    acts.appendChild(done);
    enter(done);
    focusEl(done);
    announce(T(D.LINES.copy));
    say(D.LINES.copy);
  }

  /* ================= SANS LISTE, SANS VOIX ================= */
  function blocked({ line, adult, expr = 'neutral', mood = '' }) {
    clear(mid); clear(acts);
    safe(() => ctx.progress(0, 0, []));                /* rien à compter : pas de pastilles */
    setPet(expr, mood);
    setBubble(line);
    if (adult) mid.appendChild(h('p', { class: 'dc-adult' }, h('span', { 'aria-hidden': 'true' }, '🔒 '), T(adult)));
    const other = primary('Un autre jeu', '▶', () => { sound('tap'); safe(() => ctx.changeGame()); });
    other.setAttribute('aria-label', 'Choisir un autre jeu');
    const home = h('button', { type: 'button', class: 'btn ghost dc-home' }, h('span', { 'aria-hidden': 'true' }, '🏠 '), 'Accueil');
    listen(home, 'click', () => { sound('tap'); safe(() => ctx.leave()); });
    acts.append(other, home);
    enter(other);
    focusEl(other);
    announce(T(line));
  }
  function showEmpty() {
    setPhase('empty');
    blocked({ line: D.LINES.noList, adult: 'Pour un adulte : Espace parents › La dictée de la semaine.' });
    say(D.LINES.noList);
  }
  function showNoVoice() {
    setPhase('novoice');
    blocked({
      line: D.LINES.noVoice, expr: 'neutral', mood: 'sad',
      adult: 'Pour un adulte : la dictée a besoin d’une voix. Téléchargez la voix fluide (Espace parents › Réglages › Voix fluide), ou installez une voix française dans les réglages de l’appareil (synthèse vocale).'
    });
  }

  /* ================= FIN ================= */
  function finish() {
    if (ended) return;
    ended = true;
    setPhase('end');
    hush();
    setPet('proud', 'joy');
    clear(acts);
    later(() => safe(() => ctx.end()), reduced() ? 300 : 900);
  }

  /* ================= SON COUPÉ / REMIS ================= */
  function watchSound() {
    lastOn = contentOn();
    const unsub = store.subscribe(() => {
      if (!alive) return;
      const on = contentOn();
      if (on === lastOn) return;
      lastOn = on;
      if (!on) {
        ritualSeq++;
        hush();
        box.classList.remove('is-speaking');
        if (phase === 'listen' || phase === 'ready') muteNote(true);
        return;
      }
      muteNote(false);
      if (phase === 'listen' && !writeShown) later(runRitual, 300);
    });
    cleanups.push(() => { try { unsub(); } catch (_) {} });
  }

  /* ================= CYCLE DE VIE ================= */
  async function start() {
    if (started) return;
    started = true;
    /* pas de joker dans une dictée (le bouton est masqué par css/games/dictee.css) */
    safe(() => ctx.onJoker(() => false));
    const p = ctx.profile;
    if (!D.hasList(p)) { showEmpty(); return; }
    plan = D.order(p, { limit: sizeOfDictee(p) });
    states = [];
    if (!plan.length) { showEmpty(); return; }
    progress(0);
    watchSound();
    await showPrep();
  }
  function destroy() {
    if (!alive) return;
    alive = false;
    ritualSeq++;
    hush();
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const fn of cleanups.splice(0)) fn();
    try { ctx.onJoker(() => false); } catch (_) {}
    box.remove();
  }
  return { start, destroy, get phase() { return phase; } };
}
