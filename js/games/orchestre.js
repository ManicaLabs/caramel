/* ============ LE CHEF D’ORCHESTRE (orchestre) — fr.conjug — docs/JEUX.md §6 ============
   Contrat : docs/ARCHITECTURE.md §7 (interface, ctx, déroulé d'un item §7.3).
   Décor : petite scène SVG (rideaux, projecteurs, plancher) et quatre musiciens en aplats — ours au tambour,
   lapin au violon, grenouille à la trompette, renard au piano — qui se balancent sur le temps ; le compagnon
   (ctx.petSVG : espèce, accessoires, stade) dirige à la baguette ; la lumière pulse sur le temps fort.
   Métronome : audio.metronome({ bpm: 72, beatsPerBar: 4, onBeat, click: false }) lancé par « C’est parti ! » ;
   les temps sont JOUÉS par l'orchestre depuis onBeat (tambour de l'ours sur le temps fort, petit « tic » sinon),
   comme les notes des musiciens : tout part du même instant, sans décalage entre clic et mélodie.
   Tempo : + 4 bpm par réussite de suite (jusqu'à 112) ; une erreur interrompt la musique en douceur (indice,
   nouvel essai) et elle reprend à 72.
   Item : phrase en police de lecture (trou, radical + tuile de terminaison, ou verbe souligné), étiquette du
   temps, sujet mis en valeur sur le temps fort (puis le trou au temps suivant : « sujet → terminaison »),
   choix qui pulsent doucement sur le temps.
   Juste : une note s'ajoute sur la portée en haut de l'écran, les musiciens jouent les dernières notes gagnées.
   Fin de manche : l'orchestre rejoue toute la mélodie gagnée (accord final), puis ctx.end().
   Répondre à voix haute (v2.3, js/ui/voice-answer.js) : 🎤 suspendu en haut de la scène, ligne 👂 posée sur son bord
   bas (la mise en page ne bouge pas) ; l'enfant dit la forme (« nous mangeons », « j’ai »), le mot entier pour une tuile (« mangeons »),
   le temps (« le futur ») ou le sujet : la voix touche le bouton du choix, le jeu réagit comme au doigt (tempo compris).
   Micro en pause quand la question ne se dit pas sans risque (homophones « mange » / « manges », mot inconnu du
   modèle : js/games/orchestre-voice.js), pendant l'explication et la mélodie finale ; compagnon discret quand le
   micro est demandé (il l'entendrait).
   Logique pure : js/games/orchestre-logic.js (tests/orchestre.test.mjs), js/games/orchestre-voice.js
   (tests/orchestre-voice.test.mjs). */

import { h, clear, frTypo } from '../core/util.js';
import { dlog } from '../core/debuglog.js';
import { createVoiceAnswer } from '../ui/voice-answer.js';
import * as L from './orchestre-logic.js';
import { voiceChoices, FILLERS } from './orchestre-voice.js';

const NS = 'http://www.w3.org/2000/svg';
const now = () => (globalThis.performance && performance.now ? performance.now() : Date.now());
const SWAY = 3.2;                               /* amplitude du balancement (degrés) */
const NEXT_AFTER_RIGHT = 700;                   /* item suivant après une bonne réponse (ms) : le temps de voir la phrase
                                                   complète ; la note et la pomme finissent leur vol en fond (D1-20) */
const LIGHT_BASE = 0.5;                         /* opacité des projecteurs au repos */
/* position du pied de chaque musicien dans la scène, et départ de ses notes (♪) */
const MUSICIANS = [
  { id: 'bear', x: 132, y: 115, s: 1.1, fx: [0, -30] },
  { id: 'rabbit', x: 190, y: 193, s: 1.3, fx: [-16, -46] },
  { id: 'frog', x: 258, y: 193, s: 1.3, fx: [32, -40] },
  { id: 'fox', x: 300, y: 115, s: 1.1, fx: [21, -33] }
];
const NOTE_CLASS = ['', 'is-rabbit', 'is-frog', 'is-fox'];

let S = null;                                   /* instance montée */

export default {
  id: 'orchestre', title: 'Le Chef d’orchestre', icon: '🎻', axes: ['fr.conjug'],
  css: 'css/games/orchestre.css',
  intro: true,                                  /* se présente lui-même (showIntro) : pas de phrase d'accueil de la coquille */

  async mount(root, ctx) {
    if (S) S.destroy();
    S = createGame(root, ctx);
  },

  unmount() {
    if (S) S.destroy();
    S = null;
  }
};

/* ======================================================================= */
function createGame(root, ctx) {
  const my = {
    alive: true, timers: new Set(), metro: null, bpm: L.TEMPO.start, period: L.beatMs(L.TEMPO.start),
    phase: 'intro', item: null, model: null, grid: null, tries: 0, hinted: false, hintShown: false, locked: false,
    t0: 0, slotEl: null, slotIn: null, subjEls: [], verbEl: null, notes: [], queue: [], beatN: 0,
    sway: [0, 0, 0, 0], baton: -24, flip: false, ended: false, vaShown: false, destroy
  };
  const { kit, motion, audio } = ctx;
  /* voix du compagnon (petits lecteurs, js/ui/voice.js) : la phrase, l'indice, l'explication ; le texte reste affiché ;
     micro demandé : seulement confiée à 🔊 (le micro l'entendrait) */
  const say = t => { try { return ctx.voice ? Promise.resolve(ctx.voice.say(String(t || ''), { quiet: va.wanted() })) : Promise.resolve(false); } catch (_) { return Promise.resolve(false); } };
  const hush = () => { try { if (ctx.voice) ctx.voice.hush(); } catch (_) {} };
  const reduced = () => { try { return motion.reduced(); } catch (_) { return false; } };
  const later = (fn, ms) => {
    const id = setTimeout(() => { my.timers.delete(id); if (my.alive) { try { fn(); } catch (e) { console.error(e); } } }, Math.max(0, ms));
    my.timers.add(id);
    return id;
  };
  const cancel = id => { if (id) { clearTimeout(id); my.timers.delete(id); } };
  const slots = Math.max(4, Math.min(16, ctx.count || 10));
  my.score = L.makeScore(ctx.rng, slots);

  /* ---------- squelette ---------- */
  const staff = buildStaff(slots);
  const stage = buildStage(ctx.petSVG(92, ''));
  const tempoChip = h('div', { class: 'orc-tempo', 'aria-hidden': 'true' },
    h('span', { class: 'orc-tempo-ico', html: '<svg viewBox="0 0 10 16" width="8" height="13"><ellipse cx="4" cy="12.6" rx="3.6" ry="2.7" transform="rotate(-20 4 12.6)"/><rect x="6.6" y="1" width="1.5" height="11.6" rx=".7"/></svg>' }),
    h('span', { class: 'orc-tempo-n' }, '= ' + my.bpm));
  /* répondre à voix haute (v2.3) : 🎤 suspendu en haut de la scène (sur le côté quand la scène rapetisse), ligne 👂
     posée sur le bord bas de la scène : la mise en page ne bouge pas ; le décor seul est caché aux lecteurs d'écran */
  const va = createVoiceAnswer(ctx, {
    onProblem: msg => {
      if (my.phase !== 'item' || my.locked) return;
      if (my.hintShown) kit.toast(msg);                /* l'indice reste affiché */
      else showBubble(msg, 'soft', '🎙️');
    }
  });
  const vaMic = h('div', { class: 'orc-voice-mic' });
  const vaBar = h('div', { class: 'orc-voice is-off' }, vaMic, h('div', { class: 'orc-voice-ear' }, va.ear));
  va.placeIn(vaMic);
  if (va.dbg) vaMic.appendChild(va.dbg);
  const stageBox = h('div', { class: 'orc-stage' }, h('div', { class: 'orc-stage-in', 'aria-hidden': 'true' }, stage.el, tempoChip), vaBar);
  const promptEl = h('p', { class: 'orc-prompt' });
  const tagsEl = h('div', { class: 'orc-tags' });
  const modelEl = h('p', { class: 'orc-model read' });
  const sentEl = h('p', { class: 'orc-sentence read' });
  const card = h('section', { class: 'orc-card', 'aria-label': 'Phrase à compléter' }, promptEl, tagsEl, modelEl, sentEl);
  const help = h('div', { class: 'orc-help' });
  const answers = h('div', { class: 'orc-answers' });
  const okBox = h('div', { class: 'orc-okbox' });
  const bottom = h('div', { class: 'orc-bottom' }, answers, okBox);
  /* deux colonnes sur grand écran (décor | phrase et choix) ; sur téléphone, une seule (display: contents) */
  const wrap = h('div', { class: 'orc' },
    h('div', { class: 'orc-left' }, h('div', { class: 'orc-staff', 'aria-hidden': 'true' }, staff.el), stageBox),
    h('div', { class: 'orc-right' }, card, help, bottom));
  clear(root);
  root.appendChild(wrap);

  ctx.onJoker(() => onJoker());
  /* l'intro ne revient pas à chaque partie (« Rejouer », balade) : une fois par séance et par enfant (D1-15) ;
     le son a déjà été débloqué par un geste (main.js) */
  const introKey = 'caramel-orc-intro-' + ((ctx.profile && ctx.profile.id) || '');
  let introSeen = false;
  try { introSeen = !!sessionStorage.getItem(introKey); } catch (_) {}
  if (introSeen) {
    try { audio.unlock(); } catch (_) {}
    next();
  } else {
    try { sessionStorage.setItem(introKey, '1'); } catch (_) {}
    showIntro();
  }

  /* ======================= écrans ======================= */
  function showIntro() {
    my.phase = 'intro';
    clear(promptEl); clear(tagsEl); clear(help); clear(answers);
    modelEl.hidden = true;
    card.classList.add('is-intro');
    const title = frTypo('L’orchestre t’attend ! 🎻');
    const story = frTypo(ctx.fill('{N} dirige les musiciens. À chaque bonne réponse, une note s’ajoute à ta mélodie : à la fin, l’orchestre la joue pour toi !'));
    promptEl.append(h('span', { class: 'orc-intro-title' }, title));
    clear(sentEl);
    sentEl.append(story);
    /* petits lecteurs : l'intro est dite (et 🔊 la relit) ; le texte reste affiché */
    say(title + ' ' + story);
    const go = h('button', { type: 'button', class: 'btn big block orc-go' }, frTypo('C’est parti ! 🎶'));
    go.addEventListener('click', () => {
      if (!my.alive || my.phase !== 'intro') return;
      hush();
      try { audio.unlock(); } catch (_) {}
      card.classList.remove('is-intro');
      for (const m of stage.mus) motion.pop(m.body, { scale: 1.08, dur: 320 });
      next();
    }, { once: true });
    answers.appendChild(go);
    motion.enter(card, { from: 'fade' });
    try { go.focus({ preventScroll: true }); } catch (_) {}
  }

  /* ---------- item suivant ---------- */
  function next() {
    if (!my.alive) return;
    let item = null;
    try { item = ctx.nextItem(); } catch (e) { console.error(e); item = null; }
    if (!item) { finale(); return; }
    Object.assign(my, { item, tries: 0, hinted: !!item.assist, hintShown: false, locked: false, t0: now(), phase: 'item' });
    /* micro déjà allumé dans un autre jeu de la séance : il le reste (avant la phrase dite : le compagnon se tait) */
    if (!my.vaShown) { my.vaShown = true; vaBar.classList.remove('is-off'); va.autoStart(); }
    renderItem(item);
    clear(help);
    clear(okBox);
    if (item.assist) showHint(frTypo('Petit coup de pouce : ') + item.hint);
    if (!my.metro) startMusic();
    /* dit comme affiché : consigne, étiquettes (« verbe avoir », « au présent »), phrase modèle, puis la phrase
       (V22A-2 : sans le verbe, impossible de choisir « ont » ou « sont » à l'oreille) */
    const tg = L.tagsFor(item);
    const tags = [tg.verb ? 'verbe : ' + tg.verb : '', tg.tense || ''].filter(Boolean).join(', ');
    const single = L.modelLine(item);
    const said = item.prompt + (tags ? ' ' + frTypo(tags.charAt(0).toUpperCase() + tags.slice(1) + '.') : '')
      + (single ? ' ' + frTypo('Au singulier : ') + single : '')
      + ' ' + L.sentenceText(my.model, my.model.mode === 'underline' ? '' : '…');
    const full = my.model.mode === 'underline' ? said + ' ' + frTypo('Verbe souligné : « ' + my.model.slotText + ' ».') : said;
    ctx.announce(full);
    /* petits lecteurs : la consigne et la phrase dites ; le temps d'écoute ne compte pas */
    const it = item;
    say(full + (item.assist ? ' ' + frTypo('Petit coup de pouce : ') + item.hint : ''))
      .then(ok => { if (ok && my.item === it && my.phase === 'item' && !my.tries) my.t0 = now(); });
  }

  function renderItem(item) {
    const m = my.model = L.sentenceModel(item);
    try { wrap.scrollTop = 0; } catch (_) {}
    /* consigne + étiquettes */
    clear(promptEl);
    for (const p of L.promptParts(item)) promptEl.append(p.tense ? h('span', { class: 'orc-tense' }, p.tense) : p.text);
    clear(tagsEl);
    const tg = L.tagsFor(item);
    if (tg.verb) tagsEl.append(h('span', { class: 'orc-verb' }, h('span', { class: 'orc-verb-k' }, 'verbe'), h('b', { class: 'read' }, tg.verb)));
    if (tg.tense) tagsEl.append(h('span', { class: 'orc-tense' }, tg.tense));
    tagsEl.hidden = !tg.verb && !tg.tense;
    const model = L.modelLine(item);
    clear(modelEl);
    modelEl.hidden = !model;
    if (model) modelEl.append(h('span', { class: 'orc-model-k' }, 'Au singulier'), ' ', model);
    /* phrase */
    clear(sentEl);
    my.subjEls = []; my.slotEl = null; my.slotIn = null; my.verbEl = null;
    sentEl.classList.toggle('show-subj', L.emphasisTarget(item, my.hinted) === 'subject');
    for (const p of m.parts) {
      if (p.kind === 'text') {
        if (p.subject) { const s = h('span', { class: 'orc-subj' }, p.text); my.subjEls.push(s); sentEl.append(s); }
        else sentEl.append(p.text);
      } else if (p.kind === 'verb') {
        my.verbEl = h('span', { class: 'orc-verbu' + (p.subject ? ' orc-subj' : '') }, p.text);
        if (p.subject) my.subjEls.push(my.verbEl);
        sentEl.append(my.verbEl);
      } else {
        my.slotIn = h('span', { class: 'orc-slot-in' });
        my.slotEl = h('span', { class: 'orc-slot' + (m.mode === 'ending' ? ' is-ending' : '') + (p.subject ? ' is-subject' : ''),
          role: 'img', 'aria-label': 'mot à trouver' }, my.slotIn);
        my.slotEl.style.setProperty('--len', String(L.slotLen(item)));
        if (p.stem) sentEl.append(h('span', { class: 'orc-word' }, h('span', { class: 'orc-stem' }, p.stem), my.slotEl));
        else sentEl.append(my.slotEl);
      }
    }
    card.setAttribute('aria-label', m.mode === 'underline' ? 'Phrase' : 'Phrase à compléter');
    /* choix (tuiles de terminaison, formes, temps, sujets) */
    clear(answers);
    const ch = L.choiceModel(item);
    if (ch.length < 2) { my.locked = true; va.pause(true); later(next, 0); return; }   /* item inutilisable (jamais en pratique) : on passe */
    my.grid = kit.choiceGrid(ch.map(c => ({ label: c.label, value: c.value })), { onPick: pick, cols: 2, read: true });
    my.grid.el.classList.add('orc-grid');
    if (m.mode === 'ending') my.grid.el.classList.add('is-tiles');
    answers.appendChild(my.grid.el);
    listenFor(item);
    motion.enter(card, { from: 'right', dur: 360 });
    motion.stagger(my.grid.buttons, b => motion.enter(b, { from: 'bottom', dur: 320 }), 50);
  }

  /* répondre à voix haute : les formes dites des choix (le choix dit touche son bouton) ; question qui ne se dit pas
     sans risque d'erreur injuste (homophones, mot inconnu du modèle) : micro en pause, l'enfant touche */
  function listenFor(item) {
    va.attachChoices(my.grid);
    let vc = null;
    try { vc = voiceChoices(item); } catch (e) { console.error('orchestre : voix', e); }
    if (vc && vc.list) { va.choices(vc.list, { fillers: FILLERS }); return; }
    va.choices([], { touch: true });                   /* « 👆 Ici, réponds avec le doigt » */
    try { dlog('voix', 'orchestre : question sans micro (' + ((vc && vc.why) || '?') + ')', { sous_type: item.kind }); } catch (_) {}
  }

  /* ---------- réponse ---------- */
  function pick(value, btn) {
    const item = my.item;
    if (!my.alive || my.phase !== 'item' || !item || my.locked) return;
    const ms = Math.round(now() - my.t0);
    if (L.isRight(item, value)) return right(item, value, btn, ms);
    if (my.tries === 0) return firstWrong(item, value, btn);
    return secondWrong(item, value, btn, ms);
  }

  function right(item, value, btn, ms) {
    my.locked = true;
    hush();
    const helped = my.hinted || my.tries > 0;
    my.grid.mark(value, 'right');
    my.grid.disable();
    fillSlot(item, value, 'is-right');
    const fb = ctx.report(item, { correct: true, hinted: helped, ms, tries: my.tries + 1 }) || {};
    const streak = Math.max(0, fb.streak | 0);
    kit.celebrateRight(my.slotEl || my.verbEl || btn, streak);
    /* tempo : + 4 bpm par réussite de suite ; après une aide, retour (ou maintien) à 72 */
    setTempo(L.tempoFor(helped ? 0 : streak));
    /* la note gagnée rejoint la portée ; la pomme vole vers le compteur */
    const idx = my.notes.length;
    const step = my.score[idx % my.score.length];
    my.notes.push(step);
    const note = staff.add(step, idx);
    motion.flyTo(my.slotEl || btn, note.anchor, {
      emoji: '🎵', size: 24, dur: 620, popTarget: false,
      onArrive: () => { if (my.alive) staff.show(note, !reduced()); }
    });
    later(() => motion.flyTo(btn, ctx.applesEl, { emoji: '🍎', size: 26, dur: 640 }), 110);
    /* les musiciens jouent les dernières notes de la mélodie, dès le temps suivant */
    my.queue = L.phraseOf(my.notes.map((s, i) => ({ step: s, idx: i })), 4);
    if (!my.metro) startMusic();
    const msg = kit.cheer(helped ? 'helped' : 'right', ctx.rng);
    showBubble(msg, 'good', '🎶');
    ctx.announce(msg);
    later(next, NEXT_AFTER_RIGHT);
  }

  function firstWrong(item, value, btn) {
    my.tries = 1;
    my.hinted = true;
    my.grid.mark(value, 'wrong');
    kit.gentleWrong(btn);
    interruptMusic();
    setTempo(L.TEMPO.start);
    refreshEmphasis();
    const msg = kit.cheer('retry', ctx.rng);
    showHint(msg + '\n' + item.hint);
    ctx.announce(msg + ' ' + item.hint);
    say(msg + ' ' + item.hint);
  }

  function secondWrong(item, value, btn, ms) {
    my.tries = 2;
    my.locked = true;
    my.grid.mark(value, 'wrong');
    kit.gentleWrong(btn);
    my.grid.reveal(item.answer);
    my.grid.disable();
    my.grid.el.classList.add('is-learn');          /* on ne garde que la bonne réponse : place pour l'explication */
    fillSlot(item, item.answer, 'is-shown');
    interruptMusic();
    va.pause(true);                                  /* le micro attend « J’ai compris » */
    const msg = kit.cheer('learn', ctx.rng);
    const ok = h('button', { type: 'button', class: 'btn block orc-ok' }, 'J’ai compris ✓');
    ok.addEventListener('click', () => {
      if (!my.alive || my.item !== item || my.phase !== 'item') return;
      my.phase = 'between';
      ctx.report(item, { correct: false, hinted: true, ms, tries: 2 });
      next();
    }, { once: true });
    clear(help);
    /* pastille 🤗 de l'explication, la même dans tous les jeux (D3V-M2 : l'icône était ignorée ; D4-24 : 🧐 juge) */
    help.append(kit.bubble(msg + '\n' + item.explain, 'soft'));
    clear(okBox);
    okBox.append(ok);
    keepAnswersVisible();
    ctx.announce(msg + ' ' + item.explain);
    say(msg + ' ' + item.explain);
    later(() => { try { ok.focus({ preventScroll: true }); } catch (_) {} }, 60);
  }

  /* joker 💡 : l'indice avant de répondre (l'item compte comme aidé) */
  function onJoker() {
    if (my.alive && my.phase === 'intro') { kit.toast(frTypo('Touche « C’est parti ! » pour commencer 🎶')); return false; }
    if (!my.alive || my.phase !== 'item' || !my.item || my.locked) return false;
    if (my.hintShown) {
      const b = help.querySelector('.kit-bubble');
      if (b) motion.pop(b, { scale: 1.04 });
      return false;
    }
    my.hinted = true;
    refreshEmphasis();
    showHint(my.item.hint);
    ctx.announce(my.item.hint);
    say(my.item.hint);
    return true;
  }

  /* ---------- bulles ---------- */
  function showHint(text) {
    my.hintShown = true;
    showBubble(text, 'hint', '💡');
  }
  function showBubble(text, kind, icon) {
    clear(help);
    help.append(kit.bubble(text, kind, { icon }));
    keepAnswersVisible();
  }
  /* très petit écran + longue bulle : si tout ne tient pas, on fait défiler pour garder la bulle et les choix
     à l'écran (la scène et la portée remontent ; la phrase reste accessible en remontant) */
  function keepAnswersVisible() {
    later(() => {
      try {
        if (wrap.scrollHeight > wrap.clientHeight + 2) wrap.scrollTo({ top: wrap.scrollHeight, behavior: reduced() ? 'auto' : 'smooth' });
      } catch (_) {}
    }, 30);
  }

  /* ---------- trou rempli ---------- */
  function fillSlot(item, value, cls) {
    if (!my.slotEl) { if (my.verbEl) my.verbEl.classList.add(cls); return; }   /* « temps » : le verbe souligné passe au vert */
    const c = (item.choices || []).find(x => String(x.value) === String(value));
    my.slotIn.textContent = c ? L.fillFor(item, c) : String(value);
    my.slotEl.classList.add('is-filled', cls);
    my.slotEl.removeAttribute('role');
    my.slotEl.removeAttribute('aria-label');
    motion.pop(my.slotEl, { scale: 1.1, dur: 340 });
  }

  /* l'accord se joue sur le sujet : on ne le montre qu'une fois l'indice donné */
  function refreshEmphasis() {
    if (my.item) sentEl.classList.toggle('show-subj', L.emphasisTarget(my.item, my.hinted) === 'subject');
  }

  /* ======================= musique ======================= */
  function startMusic() {
    if (my.metro || !my.alive) return;
    my.period = L.beatMs(my.bpm);
    try { my.metro = audio.metronome({ bpm: my.bpm, beatsPerBar: L.TEMPO.beatsPerBar, click: false, onBeat }); }
    catch (e) { my.metro = null; }
    stageBox.classList.add('is-playing');
  }
  function stopMusic() {
    if (my.metro) { try { my.metro.stop(); } catch (_) {} }
    my.metro = null;
    my.queue = [];
    cancel(my.eighth); my.eighth = null;
    stageBox.classList.remove('is-playing');
  }
  /* erreur : la musique s'interrompt en douceur (les musiciens se posent, la lumière baisse) */
  function interruptMusic() {
    stopMusic();
    restPose();
  }
  function setTempo(bpm) {
    const b = Math.round(bpm);
    if (b === my.bpm) return;
    const up = b > my.bpm;
    my.bpm = b;
    my.period = L.beatMs(b);
    if (my.metro) { try { my.metro.setBpm(b); } catch (_) {} }
    tempoChip.lastChild.textContent = '= ' + b;
    tempoChip.classList.toggle('is-max', b >= L.TEMPO.max);
    if (up) motion.pop(tempoChip, { scale: 1.18, dur: 320 });
  }

  /* un temps du métronome */
  function onBeat(i, strong, info) {
    if (!my.alive || !my.metro) return;
    const pos = info && Number.isInteger(info.pos) ? info.pos : i % L.TEMPO.beatsPerBar;
    my.period = L.beatMs(my.bpm);
    my.beatN++;
    beatSound(strong);
    conduct(pos);
    swayAll(strong);
    if (strong) { lights(); drumHit(); }
    if (my.phase === 'item' && !my.locked) {
      emphasize(pos);
      pulseChoices(strong);
    }
    playQueued();
  }

  /* les temps joués par l'orchestre : tambour sur le temps fort, petit tic sur les autres */
  function beatSound(strong) {
    try {
      if (strong) { audio.beep(196, 0.14, 0.12); audio.beep(392, 0.05, 0.035); }
      else audio.beep(1046.5, 0.025, 0.035);
    } catch (_) {}
  }

  /* croches : deux notes par temps (la 2e à mi-temps) */
  function playQueued() {
    if (!my.queue.length) return;
    playNote(my.queue.shift());
    if (my.queue.length) {
      cancel(my.eighth);
      my.eighth = later(() => { my.eighth = null; if (my.metro && my.queue.length) playNote(my.queue.shift()); }, my.period / 2);
    }
  }
  function playNote(n) {
    if (!n) return;
    try { audio.melody([n.step], Math.min(0.32, my.period / 2000)); } catch (_) {}
    const who = L.playerOf(n.idx);
    playAnim(who);
    noteFx(who);
    staff.glow(n.idx);
  }

  /* ---------- gestes ---------- */
  function anim(el, key, frames, opts) {
    if (!el || typeof el.animate !== 'function') return null;
    try {
      const k = '_orc_' + key;
      if (el[k]) { try { el[k].cancel(); } catch (_) {} }
      const a = el.animate(frames, opts);
      el[k] = a;
      return a;
    } catch (_) { return null; }
  }
  function conduct(pos) {
    if (reduced()) return;
    const to = L.batonAngle(pos), from = my.baton;
    my.baton = to;
    const d = my.period;
    anim(stage.baton, 'baton', [
      { rotate: from + 'deg', easing: 'cubic-bezier(.3,0,.2,1)' },
      { rotate: to + 'deg', offset: 0.32, easing: 'ease-out' },
      { rotate: (to * 0.82 + L.batonAngle(pos + 1) * 0.18) + 'deg' }
    ], { duration: d, fill: 'forwards' });
    /* temps fort : c'est le CORPS du chef qui marque le temps (.c-all du rig, composition « add » sur son attente,
       2 unités de la scène converties en unités du viewBox du rig) ; son ombre et la vague du dauphin restent sur
       l'estrade (ARCHITECTURE §8.6) */
    if (pos === 0) {
      anim(stage.body, 'bob', [{ transform: 'translateY(0px)' }, { transform: 'translateY(' + (-stage.bobH).toFixed(2) + 'px)', offset: 0.25 }, { transform: 'translateY(0px)' }],
        { duration: Math.min(420, d * 0.6), easing: 'ease-out', composite: 'add' });
    }
  }
  function swayAll(strong) {
    if (reduced()) return;
    my.flip = !my.flip;
    const d = my.period;
    stage.mus.forEach((m, k) => {
      const to = (my.flip ? 1 : -1) * (k % 2 ? -SWAY : SWAY) * (k === 0 ? 0.6 : 1);
      const from = my.sway[k];
      my.sway[k] = to;
      anim(m.body, 'sway', [{ rotate: from + 'deg' }, { rotate: to + 'deg' }], { duration: d * 0.96, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
      if (strong) anim(m.body, 'dip', [{ translate: '0 0' }, { translate: '0 1.6px', offset: 0.2 }, { translate: '0 0' }], { duration: Math.min(380, d * 0.5), easing: 'ease-out' });
    });
  }
  function restPose() {
    const d = 620;
    if (!reduced()) {
      stage.mus.forEach((m, k) => {
        anim(m.body, 'sway', [{ rotate: my.sway[k] + 'deg' }, { rotate: '0deg' }], { duration: d, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
        my.sway[k] = 0;
      });
      anim(stage.baton, 'baton', [{ rotate: my.baton + 'deg' }, { rotate: '-24deg' }], { duration: d, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
      my.baton = -24;
    }
    anim(stage.lights, 'light', [{ opacity: LIGHT_BASE }, { opacity: 0.28 }], { duration: d, easing: 'ease-out', fill: 'forwards' });
  }
  function lights() {
    const d = Math.min(760, my.period * 0.9);
    let from = LIGHT_BASE;
    try { const o = parseFloat(getComputedStyle(stage.lights).opacity); if (Number.isFinite(o)) from = o; } catch (_) {}
    anim(stage.lights, 'light', [{ opacity: from }, { opacity: 1, offset: 0.14 }, { opacity: LIGHT_BASE }], { duration: d, easing: 'ease-out', fill: 'forwards' });
  }
  function drumHit() {
    if (reduced()) return;
    anim(stage.stick, 'hit', [{ rotate: '0deg' }, { rotate: '-26deg', offset: 0.18 }, { rotate: '8deg', offset: 0.42 }, { rotate: '0deg' }], { duration: 380, easing: 'ease-out' });
    anim(stage.skin, 'skin', [{ scale: '1 1' }, { scale: '1.04 .8', offset: 0.45 }, { scale: '1 1' }], { duration: 240, easing: 'ease-out' });
  }
  function playAnim(who) {
    if (reduced()) return;
    const m = stage.mus[who];
    if (!m) return;
    anim(m.el, 'play', [{ translate: '0 0' }, { translate: '0 -3px', offset: 0.3 }, { translate: '0 0' }], { duration: 300, easing: 'ease-out' });
    if (m.extra) {
      const fr = {
        rabbit: [{ translate: '0 0' }, { translate: '-5px 2px', offset: 0.5 }, { translate: '0 0' }],
        frog: [{ rotate: '0deg' }, { rotate: '-9deg', offset: 0.35 }, { rotate: '0deg' }],
        fox: [{ translate: '0 0' }, { translate: '0 1.8px', offset: 0.3 }, { translate: '0 0' }]
      }[m.id];
      if (fr) anim(m.extra, 'extra', fr, { duration: 320, easing: 'ease-out' });
    }
  }
  /* petite note ♪ qui s'envole de l'instrument */
  function noteFx(who) {
    const m = MUSICIANS[who];
    if (!m) return;
    const x = m.x + m.fx[0] * m.s, y = m.y + m.fx[1] * m.s;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'st-fx ' + NOTE_CLASS[who]);
    g.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
    g.innerHTML = '<g class="st-fx-in"><ellipse cx="0" cy="0" rx="3.4" ry="2.5" transform="rotate(-20)"/>'
      + '<path d="M2.9 -0.8 V-11.5 q4.4 1.6 5.2 5.6" fill="none" stroke-width="1.5" stroke-linecap="round"/></g>';
    stage.fx.appendChild(g);
    const inner = g.firstChild;
    const dx = (Math.random() - 0.5) * 12;
    const frames = reduced()
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }]
      : [{ opacity: 0, translate: '0 0', scale: '.6' }, { opacity: 1, offset: 0.2, scale: '1' }, { opacity: 0, translate: dx + 'px -24px', scale: '1' }];
    let a = null;
    try { a = inner.animate(frames, { duration: 950, easing: 'ease-out', fill: 'forwards' }); } catch (_) {}
    later(() => g.remove(), 1000);
    return a;
  }

  /* temps fort : le sujet s'allume, puis le trou au temps suivant (« sujet → terminaison ») */
  function emphasize(pos) {
    const t = L.emphasisTarget(my.item, my.hinted);
    const tick = my.beatN % 2 ? 'beat-a' : 'beat-b';
    const on = els => els.forEach(el => { el.classList.remove('beat-a', 'beat-b'); el.classList.add(tick); });
    const slotFree = my.slotEl && !my.slotEl.classList.contains('is-filled');
    if (pos === 0) {
      if (t === 'subject' && my.subjEls.length) on(my.subjEls);
      else if (t === 'verb' && my.verbEl) on([my.verbEl]);
      else if (slotFree) on([my.slotEl]);
    } else if (pos === 1 && t === 'subject' && slotFree) on([my.slotEl]);
  }
  function pulseChoices(strong) {
    const tick = my.beatN % 2 ? 'beat-a' : 'beat-b';
    answers.classList.remove('beat-a', 'beat-b', 'is-strong');
    answers.classList.add(tick);
    if (strong) answers.classList.add('is-strong');
  }

  /* ======================= fin de manche ======================= */
  function finale() {
    if (!my.alive || my.phase === 'finale' || my.ended) return;
    my.phase = 'finale';
    my.item = null;
    stopMusic();
    va.pause(true);
    vaBar.classList.add('is-off');                   /* la mélodie : plus rien à dire */
    clear(help); clear(answers); clear(okBox); clear(tagsEl); clear(modelEl);
    tagsEl.hidden = true; modelEl.hidden = true;
    const melody = my.notes.length ? my.notes.slice() : [2, 3, 0];
    const fromScore = my.notes.length > 0;
    clear(promptEl);
    promptEl.append(h('span', { class: 'orc-intro-title' }, frTypo(fromScore ? 'Écoute ta mélodie ! 🎶' : 'L’orchestre te salue ! 🎻')));
    clear(sentEl);
    sentEl.append(frTypo(fromScore ? 'L’orchestre rejoue toutes les notes que tu as gagnées.' : 'Merci d’avoir joué avec les musiciens !'));
    card.classList.add('is-finale');
    motion.enter(card, { from: 'fade' });
    const skip = h('button', { type: 'button', class: 'btn white block orc-skip', 'aria-label': 'Passer la mélodie' }, 'Passer ⏭');
    skip.addEventListener('click', () => endNow(), { once: true });
    answers.appendChild(skip);
    ctx.announce(frTypo(fromScore ? 'Écoute ta mélodie !' : 'L’orchestre te salue !'));
    stageBox.classList.add('is-playing');
    const plan = L.finalePlan(melody, my.bpm);
    my.period = plan.gap;
    plan.notes.forEach(n => later(() => {
      try { audio.melody([n.step], plan.gap / 1000); } catch (_) {}
      if (n.strong) { try { audio.beep(196, 0.14, 0.1); } catch (_) {} lights(); drumHit(); }
      conduct(n.idx % 4);
      swayAll(n.strong);
      if (fromScore) staff.glow(n.idx);
      playAnim(L.playerOf(n.idx));
      noteFx(L.playerOf(n.idx));
    }, n.at + 120));
    later(() => chord(plan.chord, fromScore), plan.chordAt + 120);
    later(endNow, plan.end + 120);
  }
  function chord(steps, fromScore) {
    for (const s of steps) { try { audio.melody([s], 0.5); } catch (_) {} }
    try { audio.beep(196, 0.2, 0.12); } catch (_) {}
    if (fromScore) staff.finish();
    anim(stage.lights, 'light', [{ opacity: LIGHT_BASE }, { opacity: 1, offset: 0.1 }, { opacity: 0.85 }], { duration: 900, easing: 'ease-out', fill: 'forwards' });
    if (!reduced()) {
      stage.mus.forEach((m, k) => anim(m.el, 'play', [{ translate: '0 0' }, { translate: '0 -7px', offset: 0.35 }, { translate: '0 0' }],
        { duration: 520, delay: k * 50, easing: 'cubic-bezier(.34,1.56,.64,1)' }));
      anim(stage.baton, 'baton', [{ rotate: my.baton + 'deg' }, { rotate: '-62deg' }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' });
      my.baton = -62;
    }
    try { motion.sparkle(stage.el, { count: 10 }); } catch (_) {}
  }
  function endNow() {
    if (!my.alive || my.ended) return;
    my.ended = true;
    my.phase = 'done';
    for (const id of my.timers) clearTimeout(id);
    my.timers.clear();
    stopMusic();
    va.destroy();
    clear(answers);                                 /* plus rien à passer : le bilan de la coquille prend le relais */
    try { ctx.end(); } catch (e) { console.error(e); }
  }

  /* ======================= démontage ======================= */
  function destroy() {
    if (!my.alive) return;
    my.alive = false;
    hush();
    stopMusic();
    va.destroy();
    for (const id of my.timers) clearTimeout(id);
    my.timers.clear();
    try { ctx.onJoker(() => false); } catch (_) {}
    try { for (const a of wrap.getAnimations({ subtree: true })) a.cancel(); } catch (_) {}
    if (S && S.destroy === destroy) S = null;
  }

  return my;
}

/* ======================================================================= */
/* ---------- portée (en haut de l'écran) : clé de sol, 4/4, notes gagnées ---------- */
function buildStaff(slots) {
  const W = 360, X0 = 50, X1 = 352;
  const w = (X1 - X0) / slots;
  const y = pos => 47 - pos * 4;               /* position 0 = ligne du bas (mi4) */
  let html = '<g class="sf-lines">';
  for (let k = 0; k < 5; k++) html += '<line x1="4" x2="' + (W - 4) + '" y1="' + y(2 * k) + '" y2="' + y(2 * k) + '"/>';
  html += '</g>';
  html += '<path class="sf-clef" d="M18.5 39 C16 39 14.5 36.5 16.5 34.5 C19 32 23.5 33.5 23.5 38 C23.5 43.5 17 46 12.5 43.5 '
    + 'C7.5 40.5 9 33 14 28.5 C19 24 22.5 19 21.5 11 C21 6 18 3.5 16.5 6 C14.5 9.5 15 14 16 20 L20.5 50 C21.5 56 15.5 58 13 54.5"/>'
    + '<circle class="sf-clef-dot" cx="13.9" cy="53.4" r="2.6"/>';
  html += '<text class="sf-time" x="36" y="27.6" text-anchor="middle">4</text><text class="sf-time" x="36" y="43.6" text-anchor="middle">4</text>';
  html += '<g class="sf-bars">';
  for (let b = 4; b < slots; b += 4) html += '<line x1="' + (X0 + w * b) + '" x2="' + (X0 + w * b) + '" y1="' + y(8) + '" y2="' + y(0) + '"/>';
  html += '<line class="sf-end" x1="' + X1 + '" x2="' + X1 + '" y1="' + y(8) + '" y2="' + y(0) + '"/></g><g class="sf-notes"></g>';
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', '0 0 ' + W + ' 58');
  el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  el.setAttribute('class', 'orc-staff-svg');
  el.setAttribute('focusable', 'false');
  el.innerHTML = html;
  const layer = el.querySelector('.sf-notes');
  const notes = [];

  return {
    el,
    /* note n° idx (invisible jusqu'à son arrivée) → { g, anchor } */
    add(step, idx) {
      const pos = L.staffPos(step);
      const cx = X0 + w * (Math.min(idx, slots - 1) + 0.5), cy = y(pos);
      const up = L.stemUp(pos);
      let s = '';
      for (const p of L.ledgers(pos)) s += '<line class="sf-ledger" x1="' + (cx - 8) + '" x2="' + (cx + 8) + '" y1="' + y(p) + '" y2="' + y(p) + '"/>';
      s += '<g class="sf-note-in"><ellipse class="sf-head" cx="' + cx + '" cy="' + cy + '" rx="5" ry="3.7" transform="rotate(-20 ' + cx + ' ' + cy + ')"/>';
      s += up
        ? '<line class="sf-stem" x1="' + (cx + 4.5) + '" x2="' + (cx + 4.5) + '" y1="' + (cy - 1) + '" y2="' + (cy - 25) + '"/>'
        : '<line class="sf-stem" x1="' + (cx - 4.5) + '" x2="' + (cx - 4.5) + '" y1="' + (cy + 1) + '" y2="' + (cy + 25) + '"/>';
      s += '</g>';
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'sf-note ' + NOTE_CLASS[L.playerOf(idx)]);
      g.style.opacity = '0';
      g.innerHTML = s;
      layer.appendChild(g);
      const note = { g, anchor: g.querySelector('.sf-head'), inner: g.querySelector('.sf-note-in'), shown: false };
      notes[idx] = note;
      return note;
    },
    show(note, pop) {
      if (!note || note.shown) return;
      note.shown = true;
      note.g.style.opacity = '';
      try {
        note.inner.animate(pop
          ? [{ scale: '0', opacity: 0 }, { scale: '1.25', opacity: 1, offset: 0.6 }, { scale: '1', opacity: 1 }]
          : [{ opacity: 0 }, { opacity: 1 }], { duration: pop ? 420 : 150, easing: pop ? 'cubic-bezier(.34,1.56,.64,1)' : 'ease-out' });
      } catch (_) {}
    },
    /* la note jouée s'illumine */
    glow(idx) {
      const n = notes[idx];
      if (!n) return;
      if (!n.shown) this.show(n, false);
      n.g.classList.remove('is-glow');
      void n.g.getBoundingClientRect();
      n.g.classList.add('is-glow');
    },
    /* double barre finale */
    finish() {
      if (el.querySelector('.sf-final')) return;
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'sf-final');
      g.innerHTML = '<line x1="' + (X1 - 4) + '" x2="' + (X1 - 4) + '" y1="' + y(8) + '" y2="' + y(0) + '"/>'
        + '<rect x="' + (X1 - 1.2) + '" y="' + y(8) + '" width="3.2" height="' + (y(0) - y(8)) + '"/>';
      el.appendChild(g);
    }
  };
}

/* ---------- scène : rideaux, projecteurs, estrade, chef et musiciens (deux rangs) ---------- */
const SCENE_W = 360, SCENE_H = 214;
function buildStage(petSvg) {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', '0 0 ' + SCENE_W + ' ' + SCENE_H);
  el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  el.setAttribute('class', 'orc-scene');
  el.setAttribute('focusable', 'false');
  const beam = (x, y, w) => '<polygon points="' + (x - 5) + ',19 ' + (x + 5) + ',19 ' + (x + w) + ',' + (y + 1) + ' ' + (x - w) + ',' + (y + 1) + '"/>';
  const pool = (x, y, rx) => '<ellipse cx="' + x + '" cy="' + (y + 1) + '" rx="' + rx + '" ry="' + (rx * 0.21).toFixed(1) + '"/>';
  const spots = [{ x: 54, y: 176, s: 1.2 }, ...MUSICIANS];
  let s = '<defs>'
    + '<linearGradient id="orcWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="g-wall-a"/><stop offset="1" class="g-wall-b"/></linearGradient>'
    + '<linearGradient id="orcFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="g-floor-a"/><stop offset="1" class="g-floor-b"/></linearGradient>'
    + '<linearGradient id="orcBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="g-beam-a"/><stop offset="1" class="g-beam-b"/></linearGradient>'
    + '<clipPath id="orcClip"><rect x="0" y="0" width="' + SCENE_W + '" height="' + SCENE_H + '" rx="16"/></clipPath>'
    + '</defs><g clip-path="url(#orcClip)">';
  /* fond, guirlande */
  s += '<rect class="st-wall" x="0" y="0" width="360" height="139" fill="url(#orcWall)"/>';
  s += '<g class="st-garland">';
  for (let k = 0; k < 15; k++) {
    const x = 32 + k * 21, yy = 25 + Math.sin((k / 14) * Math.PI) * 7;
    s += '<polygon class="' + (k % 3 === 0 ? 'c-pink' : k % 3 === 1 ? 'c-amber' : 'c-sky') + '" points="' + (x - 6) + ',' + yy.toFixed(1) + ' ' + (x + 6) + ',' + yy.toFixed(1) + ' ' + x + ',' + (yy + 9).toFixed(1) + '"/>';
  }
  s += '<path class="st-string" d="M22 24 Q180 39 338 24" fill="none"/></g>';
  /* estrade du fond (2e rang) et plancher (1er rang) */
  s += '<rect class="st-riser-top" x="92" y="109" width="268" height="8"/><rect class="st-riser" x="92" y="117" width="268" height="22"/>'
    + '<g class="st-riser-lines">' + [130, 172, 214, 256, 298, 340].map(x => '<line x1="' + x + '" y1="118" x2="' + x + '" y2="138"/>').join('') + '</g>'
    + '<rect class="st-edge" x="92" y="108.5" width="268" height="1.8"/>';
  s += '<path class="st-floor" d="M0 139 H360 V214 H0 Z" fill="url(#orcFloor)"/>';
  s += '<g class="st-planks">';
  for (let k = -6; k <= 6; k++) s += '<line x1="' + (180 + k * 30) + '" y1="139" x2="' + (180 + k * 42) + '" y2="214"/>';
  s += '</g><rect class="st-edge" x="0" y="139" width="360" height="2.4"/><rect class="st-lip" x="0" y="207" width="360" height="7"/>';
  /* projecteurs (pulsent sur le temps fort) */
  s += '<g class="st-lights" opacity="' + LIGHT_BASE + '"><g class="st-beams" fill="url(#orcBeam)">' + spots.map(m => beam(m.x, m.y, 24 * m.s)).join('') + '</g>'
    + '<g class="st-pools">' + spots.map(m => pool(m.x, m.y, 23 * m.s)).join('') + '</g></g>';
  /* lampes de la rampe */
  s += '<g class="st-lamps">' + spots.map(m => '<rect x="' + (m.x - 5.5) + '" y="15.5" width="11" height="5" rx="2"/>').join('') + '</g>';
  /* estrade du chef */
  s += '<g class="st-podium"><rect class="c-podium-top" x="8" y="175" width="94" height="7" rx="3.5"/><rect class="c-podium" x="12" y="181" width="86" height="19" rx="3.5"/>'
    + '<path class="c-podium-star" d="M55 184.4 l1.9 3.9 4.3 .6 -3.1 3 .7 4.3 -3.8 -2 -3.8 2 .7 -4.3 -3.1 -3 4.3 -.6 Z"/></g>';
  /* musiciens du fond (ours, renard), puis le chef, puis le premier rang (lapin, grenouille) */
  const byId = id => MUSICIANS.find(m => m.id === id);
  s += '<g class="st-band">' + bearSVG(byId('bear')) + foxSVG(byId('fox')) + '</g>';
  s += '<g class="st-cond"><g class="st-cond-svg"></g>'
    + '<g transform="translate(74 147)"><g class="st-baton"><line class="c-baton" x1="0" y1="0" x2="34" y2="0"/><circle class="c-baton-tip" cx="34" cy="0" r="2.5"/>'
    + '<ellipse class="c-baton-grip" cx="2.6" cy="0" rx="4" ry="2.9"/></g></g></g>';
  s += '<g class="st-band">' + rabbitSVG(byId('rabbit')) + frogSVG(byId('frog')) + '</g>';
  /* rideaux */
  s += '<path class="st-curtain" d="M0 0 H22 C18 36 15 88 24 140 C16 147 7 146 0 144 Z"/>'
    + '<path class="st-curtain-fold" d="M8 4 C8 48 7 96 10 142 M15 4 C14 46 13 92 17 141" fill="none"/>'
    + '<path class="st-curtain" d="M360 0 H338 C342 36 345 88 336 140 C344 147 353 146 360 144 Z"/>'
    + '<path class="st-curtain-fold" d="M352 4 C352 48 353 96 350 142 M345 4 C346 46 347 92 343 141" fill="none"/>';
  let val = 'M0 0 H360 V9';
  for (let k = 0; k < 12; k++) val += ' q-15 11 -30 0';
  s += '<path class="st-valance" d="' + val + ' Z"/>';
  let trim = 'M360 9';
  for (let k = 0; k < 12; k++) trim += ' q-15 11 -30 0';
  s += '<path class="st-trim" d="' + trim + '" fill="none"/>';
  s += '<g class="st-fxl"></g></g>';
  el.innerHTML = s;

  /* compagnon (ctx.petSVG : espèce, accessoires, stade) posé sur l'estrade, tourné vers les musiciens */
  const condSlot = el.querySelector('.st-cond-svg');
  let body = null, bobH = 2;
  try {
    condSlot.innerHTML = petSvg;
    const m = condSlot.querySelector('svg');
    if (m) {
      m.setAttribute('x', '8'); m.setAttribute('y', '108'); m.setAttribute('aria-hidden', 'true');
      body = m.querySelector('.c-all');
      /* bob du temps fort : 2 unités de la scène = 2 / échelle du rig (viewBox 100 × 84 cadré dans width × height) */
      const k = Math.min((parseFloat(m.getAttribute('width')) || 100) / 100, (parseFloat(m.getAttribute('height')) || 84) / 84);
      if (k > 0) bobH = 2 / k;
    }
  } catch (_) {}

  const mus = MUSICIANS.map(m => {
    const g = el.querySelector('.mus-' + m.id);
    return { id: m.id, el: g, body: g.querySelector('.mus-body'), extra: g.querySelector('.mus-extra') };
  });
  return {
    el, mus,
    baton: el.querySelector('.st-baton'),
    body, bobH,
    lights: el.querySelector('.st-lights'),
    stick: el.querySelector('.bear-stick-r'),
    skin: el.querySelector('.drum-skin'),
    fx: el.querySelector('.st-fxl')
  };
}

/* ---------- musiciens (aplats, origine = pieds, y vers le haut négatif) ---------- */
const eyes = (x, y, r = 1.8) => '<circle class="c-eye" cx="' + (-x) + '" cy="' + y + '" r="' + r + '"/><circle class="c-eye" cx="' + x + '" cy="' + y + '" r="' + r + '"/>'
  + '<circle class="c-shine" cx="' + (-x + 0.6) + '" cy="' + (y - 0.7) + '" r="0.6"/><circle class="c-shine" cx="' + (x + 0.6) + '" cy="' + (y - 0.7) + '" r="0.6"/>';
const blush = (x, y, r = 2.4) => '<circle class="c-blush" cx="' + (-x) + '" cy="' + y + '" r="' + r + '"/><circle class="c-blush" cx="' + x + '" cy="' + y + '" r="' + r + '"/>';

function bearSVG(m) {
  return '<g class="mus mus-bear" transform="translate(' + m.x + ' ' + m.y + ') scale(' + m.s + ')">'
    + '<ellipse class="c-shadow" cx="0" cy="1" rx="22" ry="3.5"/>'
    + '<g class="mus-body">'
    + '<ellipse class="c-bear-d" cx="-9" cy="-4" rx="7.5" ry="5"/><ellipse class="c-bear-d" cx="9" cy="-4" rx="7.5" ry="5"/>'
    + '<ellipse class="c-bear" cx="0" cy="-23" rx="18" ry="20"/>'
    + '<ellipse class="c-bear-l" cx="0" cy="-20" rx="10.5" ry="12.5"/>'
    + '<circle class="c-bear" cx="-10.5" cy="-58" r="5.4"/><circle class="c-bear-l" cx="-10.5" cy="-58" r="2.7"/>'
    + '<circle class="c-bear" cx="10.5" cy="-58" r="5.4"/><circle class="c-bear-l" cx="10.5" cy="-58" r="2.7"/>'
    + '<circle class="c-bear" cx="0" cy="-47" r="13.5"/>'
    + '<ellipse class="c-bear-l" cx="0" cy="-42.5" rx="7" ry="5.2"/>'
    + '<ellipse class="c-nose" cx="0" cy="-45" rx="2.6" ry="1.8"/>'
    + '<path class="c-mouth" d="M-2.6 -41 q2.6 2.2 5.2 0"/>'
    + eyes(5.2, -50) + blush(8.6, -43.5)
    + '</g>'
    /* tambour */
    + '<g class="mus-drum">'
    + '<rect class="c-drum" x="-16" y="-26" width="32" height="19" rx="2"/>'
    + '<path class="c-drum-cord" d="M-14 -24 L-7 -9 L0 -24 L7 -9 L14 -24" fill="none"/>'
    + '<ellipse class="c-drum-rim" cx="0" cy="-7.5" rx="16" ry="4.6"/>'
    + '<ellipse class="c-drum-rim drum-skin" cx="0" cy="-26" rx="16" ry="4.8"/>'
    + '<ellipse class="c-drum-skin" cx="0" cy="-26.4" rx="13.4" ry="3.4"/>'
    + '</g>'
    /* baguettes (la droite frappe le temps fort) */
    + '<g transform="translate(-13 -33)"><g class="bear-stick-l"><line class="c-stick" x1="0" y1="0" x2="9" y2="6"/><circle class="c-stick-tip" cx="9" cy="6" r="1.8"/><ellipse class="c-bear" cx="0" cy="0" rx="4.4" ry="3.6"/></g></g>'
    + '<g transform="translate(14 -36)"><g class="bear-stick-r"><line class="c-stick" x1="0" y1="0" x2="-8" y2="9"/><circle class="c-stick-tip" cx="-8" cy="9" r="1.8"/><ellipse class="c-bear" cx="0" cy="0" rx="4.4" ry="3.6"/></g></g>'
    + '</g>';
}

function rabbitSVG(m) {
  return '<g class="mus mus-rabbit" transform="translate(' + m.x + ' ' + m.y + ') scale(' + m.s + ')">'
    + '<ellipse class="c-shadow" cx="0" cy="1" rx="18" ry="3.2"/>'
    + '<g class="mus-body">'
    + '<ellipse class="c-rabbit-s" cx="-7" cy="-3" rx="7.5" ry="3.8"/><ellipse class="c-rabbit-s" cx="7" cy="-3" rx="7.5" ry="3.8"/>'
    + '<ellipse class="c-rabbit" cx="0" cy="-21" rx="14.5" ry="17.5"/>'
    + '<ellipse class="c-rabbit-b" cx="0" cy="-18" rx="8.5" ry="10.5"/>'
    + '<g transform="rotate(-9 -5.5 -58)"><ellipse class="c-rabbit" cx="-5.5" cy="-66" rx="4.8" ry="14"/><ellipse class="c-rabbit-e" cx="-5.5" cy="-65" rx="2.2" ry="10"/></g>'
    + '<g transform="rotate(24 5.5 -57)"><ellipse class="c-rabbit" cx="5.5" cy="-66" rx="4.8" ry="13"/><ellipse class="c-rabbit-e" cx="5.5" cy="-65" rx="2.2" ry="9"/></g>'
    + '<circle class="c-rabbit" cx="0" cy="-45" r="12.5"/>'
    + eyes(4.6, -47, 1.7) + blush(7.8, -41.5, 2.2)
    + '<path class="c-rnose" d="M-1.9 -42.6 h3.8 l-1.9 2.2 Z"/>'
    + '<path class="c-mouth" d="M0 -40.3 v1.4 M0 -38.9 q-1.8 1.4 -3 .2 M0 -38.9 q1.8 1.4 3 .2"/>'
    + '<path class="c-whisk" d="M-4.5 -40.5 l-6 -1.2 M-4.5 -39.2 l-6 .8 M4.5 -40.5 l6 -1.2 M4.5 -39.2 l6 .8"/>'
    /* violon (sous le menton, se balance avec le lapin) */
    + '<g transform="translate(-9 -30) rotate(-38)">'
    + '<rect class="c-neck" x="-1.3" y="-21" width="2.6" height="13" rx="1"/><circle class="c-neck" cx="0" cy="-21.5" r="2"/>'
    + '<ellipse class="c-violin" cx="0" cy="5" rx="7" ry="7.5"/><ellipse class="c-violin" cx="0" cy="-4.5" rx="5.4" ry="5.6"/>'
    + '<rect class="c-violin" x="-3.8" y="-2.6" width="7.6" height="5"/>'
    + '<path class="c-fhole" d="M-2.6 -1 q-.8 2.5 0 5 M2.6 -1 q.8 2.5 0 5" fill="none"/>'
    + '<line class="c-string" x1="0" y1="-20" x2="0" y2="9"/><rect class="c-bridge" x="-2.4" y="4.6" width="4.8" height="1.4" rx=".6"/>'
    + '</g>'
    /* archet */
    + '<g class="mus-extra"><g transform="translate(-9 -28) rotate(28)"><line class="c-bow" x1="-17" y1="0" x2="15" y2="0"/><line class="c-bow-hair" x1="-15" y1="1.6" x2="13" y2="1.6"/>'
    + '<ellipse class="c-rabbit" cx="13" cy="1" rx="3.6" ry="3"/></g></g>'
    + '</g></g>';
}

function frogSVG(m) {
  return '<g class="mus mus-frog" transform="translate(' + m.x + ' ' + m.y + ') scale(' + m.s + ')">'
    + '<ellipse class="c-shadow" cx="2" cy="1" rx="22" ry="3.4"/>'
    + '<g class="mus-body">'
    + '<ellipse class="c-frog-d" cx="-13" cy="-5" rx="9" ry="5.2"/><ellipse class="c-frog-d" cx="13" cy="-5" rx="9" ry="5.2"/>'
    + '<ellipse class="c-frog" cx="0" cy="-18" rx="17.5" ry="15.5"/>'
    + '<ellipse class="c-frog-b" cx="0" cy="-14" rx="11" ry="9.5"/>'
    + '<ellipse class="c-frog" cx="0" cy="-37" rx="16.5" ry="11.5"/>'
    + '<circle class="c-frog" cx="-8.5" cy="-46.5" r="6.4"/><circle class="c-frog" cx="8.5" cy="-46.5" r="6.4"/>'
    + '<circle class="c-white" cx="-8.5" cy="-47" r="4.4"/><circle class="c-white" cx="8.5" cy="-47" r="4.4"/>'
    + '<circle class="c-eye" cx="-7.8" cy="-46.6" r="2.2"/><circle class="c-eye" cx="9.2" cy="-46.6" r="2.2"/>'
    + '<circle class="c-shine" cx="-7.1" cy="-47.5" r=".7"/><circle class="c-shine" cx="9.9" cy="-47.5" r=".7"/>'
    + '<circle class="c-frog-spot" cx="-11" cy="-34" r="1.6"/><circle class="c-frog-spot" cx="12" cy="-38" r="1.3"/><circle class="c-frog-spot" cx="-6" cy="-24" r="1.4"/>'
    + blush(10.5, -33, 2.4)
    + '<path class="c-fmouth" d="M-8.5 -33.5 q7 5 14 0"/>'
    /* trompette (part de la bouche, se lève quand elle joue) */
    + '<g class="mus-extra"><g transform="translate(4 -33)">'
    + '<rect class="c-brass" x="0" y="-1.5" width="22" height="3" rx="1.4"/>'
    + '<rect class="c-brass-d" x="6" y="-5.6" width="2.4" height="4.4" rx="1"/><rect class="c-brass-d" x="10" y="-5.6" width="2.4" height="4.4" rx="1"/><rect class="c-brass-d" x="14" y="-5.6" width="2.4" height="4.4" rx="1"/>'
    + '<path class="c-brass" d="M20 -2.2 L31 -8.5 L31 8.5 L20 2.2 Z"/><ellipse class="c-brass-l" cx="31" cy="0" rx="2.6" ry="8.5"/>'
    + '<ellipse class="c-frog" cx="9" cy="2.6" rx="3.8" ry="3"/></g></g>'
    + '</g></g>';
}

function foxSVG(m) {
  return '<g class="mus mus-fox" transform="translate(' + m.x + ' ' + m.y + ') scale(' + m.s + ')">'
    + '<ellipse class="c-shadow" cx="0" cy="1" rx="25" ry="3.5"/>'
    + '<g class="mus-body">'
    + '<ellipse class="c-fox" cx="0" cy="-36" rx="15" ry="12"/>'
    + '<ellipse class="c-white" cx="0" cy="-33" rx="7.5" ry="8"/>'
    + '<path class="c-fox" d="M-11.5 -57 L-14.5 -73 L-3.5 -62 Z"/><path class="c-fox-d" d="M-13.4 -68.6 L-14.5 -73 L-10.4 -69.2 Z"/><path class="c-fox-in" d="M-11 -60 L-12.8 -69 L-6.6 -62.6 Z"/>'
    + '<path class="c-fox" d="M11.5 -57 L14.5 -73 L3.5 -62 Z"/><path class="c-fox-d" d="M13.4 -68.6 L14.5 -73 L10.4 -69.2 Z"/><path class="c-fox-in" d="M11 -60 L12.8 -69 L6.6 -62.6 Z"/>'
    + '<path class="c-fox" d="M-15 -55 Q-15 -64 0 -64 Q15 -64 15 -55 Q15 -47 0 -40 Q-15 -47 -15 -55 Z"/>'
    + '<path class="c-white" d="M-12.5 -50 Q-6 -51 0 -44.5 Q6 -51 12.5 -50 Q8 -43 0 -40.5 Q-8 -43 -12.5 -50 Z"/>'
    + '<ellipse class="c-nose" cx="0" cy="-44" rx="2.4" ry="1.7"/>'
    + eyes(5.4, -53.5, 1.8) + blush(9.4, -47.8, 2.1)
    + '</g>'
    /* piano (devant le renard) */
    + '<g class="mus-piano">'
    + '<rect class="c-piano-d" x="-23" y="-31" width="46" height="5" rx="2"/>'
    + '<rect class="c-piano" x="-22" y="-27" width="44" height="22" rx="2.5"/>'
    + '<rect class="c-keys" x="-20" y="-26" width="40" height="8" rx="1"/>'
    + [-15, -10, -5, 0, 5, 10, 15].map(k => '<line class="c-keyline" x1="' + k + '" y1="-26" x2="' + k + '" y2="-18"/>').join('')
    + [-12.5, -7.5, 2.5, 7.5, 12.5].map(k => '<rect class="c-bkey" x="' + (k - 1.4) + '" y="-26" width="2.8" height="4.6" rx=".5"/>').join('')
    + '<circle class="c-piano-dot" cx="-12" cy="-11.5" r="1.6"/><circle class="c-piano-dot" cx="0" cy="-11.5" r="1.6"/><circle class="c-piano-dot" cx="12" cy="-11.5" r="1.6"/>'
    + '<rect class="c-piano-d" x="-20" y="-6" width="4" height="6" rx="1"/><rect class="c-piano-d" x="16" y="-6" width="4" height="6" rx="1"/>'
    + '</g>'
    /* pattes sur le clavier */
    + '<g class="mus-extra"><ellipse class="c-fox" cx="-8" cy="-26.5" rx="4.6" ry="3.2"/><ellipse class="c-white" cx="-8" cy="-25.6" rx="2.6" ry="1.6"/>'
    + '<ellipse class="c-fox" cx="8" cy="-26.5" rx="4.6" ry="3.2"/><ellipse class="c-white" cx="8" cy="-25.6" rx="2.6" ry="1.6"/></g>'
    + '</g>';
}
