/* ============ LES MISSIONS DU RANCH — ma.problemes (CDC v2 §6 jeu 18, contrat §7) ============
   Un problème du ranch par écran, une action à la fois (CDC §1 principe 7) :
   1. LIRE : la carte de mission (énoncé en police de lecture, nombres mis en valeur, question à part) est dite phrase
      par phrase par le compagnon (la phrase dite se surligne ; 🔊 de l'en-tête relit tout) → « J’ai compris ▶ ».
   2. RÉPONDRE : 6 choix au format Repères (CP-CE1, problèmes à étapes jusqu'au CE2, coup de pouce) ou le pavé, la case
      réponse posée dans la carte avec son unité (« … carottes ») ; 🎤 (js/ui/voice-answer.js) : la voix tape la réponse
      comme le doigt ; les nombres de l'énoncé ne comptent jamais faux. « 📊 Dessin » (dès le CE1) : schéma en barres.
   - Juste : tampon « Mission réussie ! », le compagnon sautille, 🍎 vers le compteur ; la phrase-réponse est dite
     (« Il lui reste 7 carottes. ») ; « Mission suivante ▶ » (ou tout seul, la phrase dite).
   - Résultat intermédiaire d'un problème à étapes : jamais faux — « Bien ! 18, c’est … Et maintenant ? ».
   - 1re erreur : secousse douce, l'indice (reformulation ; question intermédiaire pour les étapes) et le schéma avec
     ses « ? » ; 🌱 « Pas encore appris » quand la coquille le propose (ctx.later).
   - 2e erreur : la réponse montrée, l'explication en quatre phases (Comprendre → Modéliser → Calculer → Répondre) avec
     le schéma complété → « J’ai compris ✓ ».
   - Joker 💡 : l'indice et le schéma avant de répondre (l'item compte comme aidé) ; item.assist : coup de pouce d'emblée
     et 6 choix.
   - Le jeu se présente lui-même (intro: true) : à la première mission de la séance, le compagnon dit en une phrase ce
     qu'on va faire.
   Logique pure : js/games/missions-logic.js (tests/missions.test.mjs). Générateur : js/content/maths/problemes.js. */

import { h, svg, clear, frTypo } from '../core/util.js';
import { createVoiceAnswer } from '../ui/voice-answer.js';
import * as L from './missions-logic.js';

const NEXT_MIN_MS = 1600;     /* juste → mission suivante au plus tôt (la phrase-réponse a le temps d'être lue) */
const NEXT_MAX_MS = 6000;     /* … et au plus tard, voix muette ou lente */
const WRONG_CLEAR_MS = 650;   /* la saisie fausse reste visible, puis la case se vide */
const REVEAL_MS = 420;        /* 2e erreur : la réponse s'écrit après la secousse */
const FINALE_MS = 900;
const INTRO_KEY = 'caramel-missions-intro-';
const INV_RE = /(\p{L}+-t-(?:il|elle|ils|elles|on)|\p{L}+-(?:il|elle|ils|elles|on))(?![\p{L}])/u;

let inst = null;

export default {
  id: 'missions', title: 'Les Missions du ranch', icon: '🧭', axes: ['ma.problemes'],
  css: 'css/games/missions.css',
  intro: true,                                  /* se présente lui-même (une phrase à la 1re mission de la séance) */
  async mount(root, ctx) {
    if (inst) inst.destroy();
    inst = createMissions(root, ctx);
    await inst.start();
  },
  unmount() {
    if (inst) inst.destroy();
    inst = null;
  }
};

function createMissions(root, ctx) {
  let alive = true;
  const timers = new Set();
  const cleanups = [];
  const safe = (fn, ...a) => { try { return fn(...a); } catch (e) { console.error('missions', e); return null; } };
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (alive) safe(fn); }, Math.max(0, ms));
    timers.add(id);
    return id;
  };
  const cancel = id => { if (id) { clearTimeout(id); timers.delete(id); } return 0; };
  const nowMs = () => (globalThis.performance && performance.now ? performance.now() : Date.now());
  const reduced = () => { try { return !!ctx.motion.reduced(); } catch (_) { return false; } };
  const listen = (target, ev, fn, opts) => {
    if (!target || !target.addEventListener) return;
    target.addEventListener(ev, fn, opts);
    cleanups.push(() => { try { target.removeEventListener(ev, fn, opts); } catch (_) {} });
  };
  const F = s => { try { return ctx.fill(String(s ?? '')); } catch (_) { return String(s ?? ''); } };
  const announce = t => safe(() => ctx.announce(String(t || '')));
  const cheer = kind => { try { return ctx.kit.cheer(kind); } catch (_) { return ''; } };
  const sound = name => { try { const f = ctx.audio && ctx.audio[name]; if (typeof f === 'function') return f(); } catch (_) {} return null; };
  const M = ctx.motion;
  /* voix du compagnon : jamais micro ouvert (la phrase est alors confiée au 🔊) */
  const say = (t, quiet = false) => {
    try { return ctx.voice ? Promise.resolve(ctx.voice.say(F(t), { quiet: quiet || va.wanted() })).catch(() => false) : Promise.resolve(false); }
    catch (_) { return Promise.resolve(false); }
  };
  const hush = () => { try { if (ctx.voice) ctx.voice.hush(); } catch (_) {} };
  const classe = () => { try { return ctx.classe || (ctx.profile && ctx.profile.classe) || ''; } catch (_) { return ''; } };

  /* ================= DOM ================= */
  const petIn = h('div', { class: 'mi-pet-in', html: safe(() => ctx.petSVG(64, '')) || '' });
  const pet = h('div', { class: 'mi-pet', 'aria-hidden': 'true' }, petIn);
  const petSvg = petIn.querySelector('svg');
  const title = h('p', { class: 'mi-title' });
  const drawBtn = h('button', { type: 'button', class: 'mi-draw hidden', 'aria-pressed': 'false' },
    h('span', { 'aria-hidden': 'true' }, '📊'), h('span', null, 'Dessin'));
  const head = h('div', { class: 'mi-head' }, pet, title);
  const sayEl = h('p', { class: 'mi-say hidden' });
  const textEl = h('div', { class: 'mi-text' });
  const schemaEl = h('div', { class: 'mi-schema hidden' });
  const bodyEl = h('div', { class: 'mi-body' }, sayEl, textEl, schemaEl);
  const unitEl = h('span', { class: 'mi-unit' });
  const ansLine = h('div', { class: 'mi-ansline hidden' }, unitEl);
  const stamp = h('div', { class: 'mi-stamp hidden', 'aria-hidden': 'true' }, h('span', null, '⭐'), h('b', null, 'Mission réussie !'));
  const card = h('div', { class: 'mi-card', role: 'group', 'aria-label': 'Mission' }, head, bodyEl, ansLine, stamp);
  const helpIn = h('div', { class: 'mi-help-in' });
  const help = h('div', { class: 'mi-help' }, helpIn);
  const pad = h('div', { class: 'mi-pad' });
  const va = createVoiceAnswer(ctx, {
    onNumber: (v, right) => voiceHeard(v, right),
    onProblem: msg => { if (cur && phase === 'answer' && !cur.resolved && !cur.locked) showBubble(msg, 'soft', '🎙️'); },
    onChange: () => { if (helpIn.querySelector('.mi-idle')) showIdle(); }
  });
  /* rangée d'outils de la réponse (hauteur fixe) : 📊 Dessin, 🎤 des choix, ligne 👂 */
  const vaBar = h('div', { class: 'va-row mi-voice' }, drawBtn, va.ear, va.dbg);
  /* pendant la réponse : le compagnon attend sur l'herbe, entre la carte et les réponses (il saute de joie au juste) */
  const stagePet = h('div', { class: 'mi-stage-pet', html: safe(() => ctx.petSVG(120, '')) || '' });
  const stage = h('div', { class: 'mi-stage', 'aria-hidden': 'true' }, h('div', { class: 'mi-meadow' }), stagePet);
  const stageSvg = stagePet.querySelector('svg');
  const box = h('div', { class: 'mi is-read' }, card, stage, vaBar, help, pad);
  root.appendChild(box);

  /* ================= ÉTAT ================= */
  let phase = 'init';               /* read → answer → (learn) → done ; end */
  let cur = null, ended = false, started = false, index = 0, readSeq = 0, nextTimer = 0, upcoming = null;
  let kp = null, kpDecimal = null, grid = null, learnEl = null, readBtn = null, nextBtn = null;
  let prevAnswer = null, plan = null, introSaid = false;
  try { introSaid = !!globalThis.sessionStorage.getItem(INTRO_KEY + ((ctx.profile && ctx.profile.id) || '')); } catch (_) { introSaid = false; }

  /* ================= CARTE ================= */
  function renderText(c) {
    clear(textEl);
    c.lines = [];
    const lines = L.readLines(c.item);
    lines.forEach((line, i) => {
      const isQ = i === lines.length - 1;
      const p = h('p', { class: isQ ? 'mi-q' : 'mi-s' });
      for (const ch of L.chunks(F(line))) {
        if (ch.k === 'num') { p.appendChild(h('b', { class: 'mi-n' }, ch.t)); continue; }
        /* « a-t-elle », « met-il » ne se coupent pas au trait d'union */
        for (const part of ch.t.split(INV_RE)) if (part) p.appendChild(INV_RE.test(part) ? h('span', { class: 'mi-nw' }, part) : document.createTextNode(part));
      }
      textEl.appendChild(p);
      c.lines.push(p);
    });
    card.setAttribute('aria-label', F('Mission ' + index + ' : ' + L.fullText(c.item)));
  }
  function highlight(i) {
    if (!cur || !cur.lines) return;
    cur.lines.forEach((p, k) => p.classList.toggle('is-saying', k === i));
    const p = cur.lines[i];
    if (p) { try { p.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); } catch (_) {} }
  }

  /* ---------- schéma en barres ---------- */
  function drawSchema(c, solved = false) {
    const schema = solved ? L.solvedSchema(c.item.data.schema, c.item) : c.item.data.schema;
    clear(schemaEl);
    if (!schema) return;
    const W = Math.max(220, Math.round(textEl.clientWidth || bodyEl.clientWidth - 24));
    const font = W < 330 ? 14 : 15;
    const lay = L.schemaLayout(schema, W, { font });
    const S = svg('svg', { class: 'mi-svg' + (reduced() ? '' : ' is-drawing'), viewBox: `0 0 ${lay.w} ${lay.h}`, width: String(lay.w), height: String(lay.h),
      role: 'img', 'aria-label': solved ? 'Le dessin du problème, complété' : 'Le dessin du problème : le point d’interrogation, c’est ce qu’on cherche' });
    let k = 0;
    const clip = (t, w, fs) => { t = F(t); const max = Math.max(2, Math.floor(w / (fs * 0.55))); return t.length > max ? t.slice(0, max - 1) + '…' : t; };
    for (const it of lay.items) {
      if (it.type === 'seg') {
        const cls = ['mi-seg', 'tone-' + it.tone, it.q && 'is-q', it.found && 'is-found', it.same && 'is-same', it.dots && 'is-dots', it.soft && 'is-soft', it.diff && 'is-diff'].filter(Boolean).join(' ');
        const g = svg('g', { class: cls, style: `--mi-d:${(k++) * 90}ms` },
          svg('rect', { x: it.x + 1.5, y: it.y, width: Math.max(4, it.w - 3), height: it.h, rx: 8 }),
          it.t ? svg('text', { x: it.x + it.w / 2, y: it.y + it.h / 2 + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, clip(it.t, it.w - 6, font)) : null);
        S.appendChild(g);
      } else if (it.type === 'sub') {
        S.appendChild(svg('text', { class: 'mi-sub', x: it.x, y: it.y, 'text-anchor': 'middle' }, clip(it.t, it.w - 2, 11)));
      } else if (it.type === 'label') {
        const fs = font * 0.85;
        S.appendChild(svg('text', { class: 'mi-lab' + (it.q ? ' is-q' : '') + (it.found ? ' is-found' : '') + (it.vertical ? ' is-vert' : ''), x: it.x, y: it.y,
          'dominant-baseline': 'central' }, clip(it.t, it.w, fs)));
      } else if (it.type === 'brace') {
        const { x1, x2, y } = it, m = (x1 + x2) / 2, top = y - 7;
        const d = `M ${x1 + 2} ${y} q 0 -7 7 -7 H ${m - 7} q 5 0 7 -6 q 2 6 7 6 H ${x2 - 9} q 7 0 7 7`;
        const st = (it.q ? ' is-q' : '') + (it.found ? ' is-found' : '') + (it.soft ? ' is-soft' : '');
        S.append(svg('path', { class: 'mi-brace' + st, d }),
          svg('text', { class: 'mi-tot' + st, x: m, y: top - 9, 'text-anchor': 'middle' }, F(it.t)));
      } else if (it.type === 'vbrace') {
        const { x, y1, y2 } = it, m = (y1 + y2) / 2;
        const d = `M ${x} ${y1} q 7 0 7 7 V ${m - 6} q 0 5 6 6 q -6 1 -6 6 V ${y2 - 7} q 0 7 -7 7`;
        const st = (it.q ? ' is-q' : '') + (it.found ? ' is-found' : '');
        S.append(svg('path', { class: 'mi-brace' + st, d }),
          svg('text', { class: 'mi-tot' + st, x: x + 16, y: m, 'dominant-baseline': 'central' }, F(it.t)));
      } else if (it.type === 'cell') {
        S.appendChild(svg('rect', { class: 'mi-cell', x: it.x, y: it.y, width: it.w, height: it.h, rx: 4 }));
      }
    }
    schemaEl.appendChild(S);
    schemaEl.classList.remove('hidden');
    c.schemaOpen = true;
    c.schemaSolved = solved;
    drawBtn.setAttribute('aria-pressed', 'true');
    drawBtn.classList.add('is-on');
    later(() => { try { schemaEl.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); } catch (_) {} }, 60);
  }
  function hideSchema(c) {
    clear(schemaEl);
    schemaEl.classList.add('hidden');
    if (c) c.schemaOpen = false;
    drawBtn.setAttribute('aria-pressed', 'false');
    drawBtn.classList.remove('is-on');
  }
  listen(drawBtn, 'click', () => {
    const c = cur;
    if (!c || phase !== 'answer' || !L.schemaAllowed(classe(), c.item)) return;
    sound('tap');
    if (c.schemaOpen && !c.schemaSolved) { hideSchema(c); return; }
    drawSchema(c);
    say(L.SCHEMA_SAY);
  });

  /* ================= BULLES ================= */
  function showBubble(content, kind, icon) {
    clear(helpIn);
    const b = safe(() => ctx.kit.bubble(content, kind, { icon }));
    if (b) helpIn.appendChild(b);
    return b;
  }
  function showIdle() {
    clear(helpIn);
    if (!cur || phase !== 'answer') return;
    helpIn.appendChild(h('p', { class: 'mi-idle' }, frTypo(L.idleText(cur.mode, va.wanted()))));
  }
  /* indice : reformulation (et question intermédiaire pour les étapes) ; schéma avec ses « ? » dès le CE1 */
  function showHint(why) {
    const c = cur;
    if (!c) return;
    c.hintShown = true;
    const headTxt = why === 'retry' ? cheer('retry') : why === 'assist' ? frTypo('Petit coup de pouce !') : '';
    const hint = F(c.item.hint);
    const node = h('span', null, headTxt ? headTxt + ' ' : null, hint);
    const b = showBubble(node, 'hint', '💡');
    const withSchema = L.schemaAllowed(classe(), c.item);
    if (withSchema) drawSchema(c);
    /* 🌱 « Pas encore appris » (coquille v2.5) : seulement après une première erreur */
    if (why === 'retry' && typeof ctx.later === 'function' && b) {
      const pill = safe(() => ctx.later(c.item, { onSkip: res => skipItem(c, res) }));
      if (pill) { b.classList.add('has-later'); helpIn.appendChild(h('div', { class: 'mi-later' }, pill)); }
    }
    const line = (headTxt ? headTxt + ' ' : '') + hint + (withSchema ? ' ' + L.SCHEMA_SAY : '');
    announce(line);
    say(line);
  }
  /* l'enfant n'a pas encore appris cette notion : la coquille repousse la famille ; on passe à la mission suivante */
  function skipItem(c, res) {
    if (cur !== c || c.resolved) return;
    c.resolved = true; c.locked = true;
    va.pause(true);
    if (grid) grid.disable();
    if (kp) kp.disable(true);
    showBubble(F(res && res.line ? res.line : ''), 'good', '🌱');
    const done = res && res.done && res.done.then ? res.done : Promise.resolve(true);
    done.then(() => { if (alive && cur === c) nextItem(); });
  }

  /* ================= SAISIE ================= */
  function ensureKeypad(decimal) {
    if (kp && kpDecimal === decimal) return;
    if (kp) { const old = kp.answer; safe(() => kp.destroy()); if (old && old.parentNode) old.remove(); }
    kp = ctx.kit.keypad({ decimal, maxLen: L.MAX_LEN, onSubmit: onTyped, onChange: () => { if (cur && !cur.resolved && helpIn.querySelector('.kit-bubble--good')) showIdle(); } });
    kpDecimal = decimal;
    kp.answer.classList.add('mi-box');
    kp.el.classList.add('mi-keypad');
    ansLine.insertBefore(kp.answer, unitEl);
    pad.appendChild(kp.el);
  }
  function dropGrid() { if (grid) { grid.el.remove(); grid = null; } }
  function setInput(c) {
    const info = c.info;
    if (c.mode === 'choices') {
      if (kp) { kp.disable(true); kp.el.classList.add('hidden'); }
      ansLine.classList.add('hidden');
      dropGrid();
      grid = ctx.kit.choiceGrid(L.choicesOf(c.item).map(ch => ({ label: ch.label, value: ch.value })), { onPick, cols: 3 });
      grid.el.classList.add('mi-choices');
      pad.appendChild(grid.el);
      va.placeIn(vaBar, va.ear);
      va.attachChoices(grid);
      safe(() => M.stagger(grid.buttons, b => M.enter(b, { from: 'scale', dur: 260 }), 40));
    } else {
      dropGrid();
      ensureKeypad(info.decimal);
      kp.el.classList.remove('hidden');
      kp.clear(); kp.setState(null); kp.disable(false);
      kp.answer.classList.remove('mi-revealed');
      unitEl.textContent = F(info.unit);
      ansLine.classList.remove('hidden');
      if (!va.attachKeypad(kp)) va.placeIn(vaBar, va.ear);
    }
    plan = L.voicePlan(c.item, { prev: prevAnswer });
    va.number({ answer: plan.answer, ignore: plan.ignore, voice: plan.voice, touch: plan.touch });
  }
  /* nombre entendu (le juge des tables a déjà écarté les nombres de l'énoncé) */
  function voiceHeard(v, right) {
    const c = cur;
    if (!c || phase !== 'answer' || c.resolved || c.locked) return;
    const verdict = right ? 'right' : L.voiceVerdict(v, c.item, c.mode, plan);
    if (verdict === 'skip') return;
    if (verdict === 'step') { const st = L.stepOf(c.item, v); if (c.mode === 'keypad') safe(() => kp.set(String(v))); onStep(c, Number(v), st); return; }
    if (c.mode === 'choices') { onPick(Number(v)); return; }
    safe(() => kp.set(String(v)));
    onTyped(String(v));
  }
  function onTyped(str) {
    const c = cur;
    if (!c || phase !== 'answer' || c.resolved || c.locked || c.mode !== 'keypad') return;
    const res = L.checkTyped(str, c.item);
    if (!res.valid) return;
    if (res.ok) onRight(c, res.value);
    else if (res.step) onStep(c, res.value, res.step);
    else onWrong(c, res.value);
  }
  function onPick(value) {
    const c = cur;
    if (!c || phase !== 'answer' || c.resolved || c.locked || c.mode !== 'choices') return;
    const btn = grid && grid.button(value);
    if (!btn || btn.classList.contains('mi-step') || btn.classList.contains('wrong')) return;
    const res = L.checkChoice(value, c.item);
    if (res.ok) onRight(c, value);
    else if (res.step) onStep(c, value, res.step);
    else onWrong(c, value);
  }

  /* ---------- juste ---------- */
  function onRight(c, value) {
    if (c.resolved) return;
    c.resolved = true;
    hush();
    va.pause(true);
    const ms = Math.max(0, Math.round(nowMs() - c.t0));
    const hinted = !!(c.hinted || c.tries > 0);
    let target = c.mode === 'choices' && grid ? grid.button(value) : kp && kp.answer;
    if (c.mode === 'choices' && grid) { grid.mark(value, 'right'); grid.disable(); }
    else if (kp) { kp.setState('right'); kp.disable(true); }
    const fb = safe(() => ctx.report(c.item, { correct: true, hinted, ms, tries: c.tries + 1 })) || {};
    prevAnswer = Number(c.item.answer);
    peekNext();
    safe(() => ctx.kit.celebrateRight(target || card, fb && !fb.ignored ? (fb.streak | 0) : 0));
    /* la phrase-réponse, avec son unité (« Répondre » du programme) */
    const msg = cheer(hinted ? 'helped' : 'right');
    const answerTxt = F(c.item.data.answerText);
    showBubble(h('span', null, msg + ' ', h('b', null, answerTxt)), 'good', '🌟');
    announce(msg + ' ' + answerTxt);
    showStamp();
    heroMood('joy', 1050);
    if (ctx.applesEl && !reduced()) safe(() => M.flyTo(stage.offsetHeight > 40 ? stagePet : stamp, ctx.applesEl, { emoji: '🍎', size: 26, dur: 600, arc: 0.3 }));
    phase = 'done';
    if (c.schemaOpen) drawSchema(c, true);
    showNext(c);
    const t0 = nowMs();
    say(msg + ' ' + answerTxt).then(() => {
      if (cur !== c || phase !== 'done') return;
      const wait = Math.max(250, NEXT_MIN_MS - (nowMs() - t0));
      nextTimer = cancel(nextTimer);
      nextTimer = later(() => { if (cur === c && phase === 'done') nextItem(); }, wait);
    });
    nextTimer = later(() => { if (cur === c && phase === 'done') nextItem(); }, NEXT_MAX_MS);
  }
  function showStamp() {
    stamp.classList.remove('hidden');
    if (!reduced()) safe(() => M.pop(stamp, { scale: 1.15, dur: 380 }));
  }
  /* « Mission suivante ▶ » à la place des réponses (toucher = tout de suite) */
  function showNext(c) {
    if (grid) grid.el.classList.add('is-done');
    nextBtn = h('button', { type: 'button', class: 'btn big block mi-next' }, 'Mission suivante ▶');
    listen(nextBtn, 'click', () => { if (cur === c && phase === 'done') { sound('tap'); nextItem(); } });
    const wrap = h('div', { class: 'mi-nextwrap' }, nextBtn);
    pad.classList.add('is-next');
    pad.appendChild(wrap);
  }

  /* ---------- résultat intermédiaire : jamais faux ---------- */
  function onStep(c, value, step) {
    if (c.resolved || c.locked) return;
    c.hinted = true;
    if (c.mode === 'choices' && grid) {
      const b = grid.button(value);
      if (b) { b.classList.add('mi-step'); b.setAttribute('aria-disabled', 'true'); }
    } else if (kp) {
      later(() => { if (cur === c && !c.resolved) { kp.clear(); kp.setState(null); } }, 900);
    }
    sound('tap');
    const msg = frTypo(F(L.stepMessage(c.item, step)));
    showBubble(msg, 'hint', '🪜');
    announce(msg);
    say(msg);
  }

  /* ---------- faux ---------- */
  function onWrong(c, value) {
    if (c.resolved || c.locked) return;
    c.tries++;
    c.hinted = true;
    if (c.mode === 'choices' && grid) grid.mark(value, 'wrong');
    else if (kp) kp.setState('wrong');
    safe(() => ctx.kit.gentleWrong(card));
    if (c.tries === 1) {
      showHint('retry');
      later(() => {
        if (cur !== c || c.resolved || c.locked) return;
        if (c.mode === 'keypad' && kp && kp.answer.classList.contains('wrong')) { kp.clear(); kp.setState(null); }
      }, WRONG_CLEAR_MS);
      return;
    }
    /* 2e erreur : la réponse s'écrit, puis l'explication en quatre phases */
    c.locked = true;
    va.pause(true);
    if (grid) grid.disable(); else if (kp) kp.disable(true);
    later(() => {
      if (cur !== c) return;
      if (c.mode === 'choices' && grid) { grid.reveal(c.item.answer); grid.dimOthers(c.item.answer); }
      else if (kp) { kp.set(c.info.raw); kp.setState(null); kp.answer.classList.add('mi-revealed'); }
      showLearn(c);
    }, REVEAL_MS);
  }
  function showLearn(c) {
    phase = 'learn';
    clear(helpIn);
    removeLearn();
    if (L.schemaAllowed(classe(), c.item) || c.schemaOpen) drawSchema(c, true);
    const head = cheer('learn');
    const steps = L.explainSteps(c.item);
    const list = h('ol', { class: 'mi-steps' }, steps.map(s => h('li', { class: 'mi-step-row is-' + s.key },
      h('span', { class: 'mi-step-ico', 'aria-hidden': 'true' }, s.icon),
      h('span', { class: 'mi-step-txt' }, h('b', null, s.title), h('span', null, F(s.text))))));
    const ok = h('button', { type: 'button', class: 'btn big block mi-learn-ok' }, 'J’ai compris ✓');
    learnEl = h('div', { class: 'mi-learn' }, h('p', { class: 'mi-learn-head' }, head), list, ok);
    listen(ok, 'click', () => learnDone(c));
    box.classList.add('is-learning');
    pad.appendChild(learnEl);
    if (!reduced()) safe(() => learnEl.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.22, 1, .36, 1)' }));
    const text = head + ' ' + F(L.explainSpeech(c.item));
    announce(text);
    say(text);
    try { ok.focus({ preventScroll: true }); } catch (_) {}
  }
  function removeLearn() {
    if (learnEl) { learnEl.remove(); learnEl = null; }
    box.classList.remove('is-learning');
  }
  function learnDone(c) {
    if (cur !== c || c.resolved) return;
    c.resolved = true;
    hush();
    safe(() => ctx.report(c.item, { correct: false, hinted: true, ms: Math.max(0, Math.round(nowMs() - c.t0)), tries: 2 }));
    prevAnswer = Number(c.item.answer);
    peekNext();
    sound('tap');
    nextItem();
  }

  /* ---------- joker 💡 : l'indice (et le schéma) avant de répondre ---------- */
  safe(() => ctx.onJoker(() => {
    const c = cur;
    if (!alive || !c) return false;
    if (phase === 'read') { if (readBtn) safe(() => M.pop(readBtn, { scale: 1.05, dur: 300 })); return false; }
    if (phase === 'learn' && learnEl) { safe(() => M.pop(learnEl, { scale: 1.02, dur: 300 })); return false; }
    if (phase !== 'answer' || c.resolved || c.locked) return false;
    if (c.hintShown) {
      const b = helpIn.querySelector('.kit-bubble');
      if (b) safe(() => M.pop(b, { scale: 1.04, dur: 300 })); else showHint('joker');
      return false;
    }
    c.hinted = true;
    showHint('joker');
    return true;
  }));

  /* ================= DÉROULÉ D'UNE MISSION ================= */
  /* voix fluide (ctx.voice.canPrepare) : la mission suivante est tirée dès le rapport, son énoncé préparé */
  function peekNext() {
    if (upcoming || !alive || ended || !ctx.voice || !ctx.voice.canPrepare) return;
    const item = safe(() => ctx.nextItem());
    upcoming = { item };
    if (item) {
      const lines = L.readLines(item).map(F);
      safe(() => ctx.voice.prepareNext(lines[0]));
      if (lines.length > 1) safe(() => ctx.voice.prepare(...lines.slice(1)));
    }
  }
  function resetCard() {
    stamp.classList.add('hidden');
    hideSchema(null);
    removeLearn();
    pad.classList.remove('is-next');
    if (nextBtn && nextBtn.parentNode) nextBtn.parentNode.remove();
    nextBtn = null;
    nextTimer = cancel(nextTimer);
    clear(helpIn);
  }
  function nextItem() {
    if (!alive || ended) return;
    hush();
    readSeq++;
    const item = upcoming ? upcoming.item : safe(() => ctx.nextItem());
    upcoming = null;
    if (!item) { finish(); return; }
    index++;
    resetCard();
    const c = { item, mode: L.answerMode(item), info: L.answerInfo(item), tries: 0, hinted: !!item.assist,
      resolved: false, locked: false, t0: nowMs(), hintShown: false, schemaOpen: false, lines: [] };
    cur = c;
    title.textContent = 'Mission ' + index;
    renderText(c);
    try { bodyEl.scrollTop = 0; } catch (_) {}
    showRead(c);
  }
  /* 1. lire : l'énoncé dit phrase par phrase, puis « J’ai compris ▶ » */
  function showRead(c) {
    phase = 'read';
    box.classList.add('is-read');
    box.classList.remove('is-answer');
    drawBtn.classList.add('hidden');
    ansLine.classList.add('hidden');
    dropGrid();
    if (kp) { kp.disable(true); kp.el.classList.add('hidden'); }
    if (va.wanted()) va.stop();                       /* le compagnon lit : le micro se tait (il revient pour répondre) */
    va.pause(true);
    readBtn = h('button', { type: 'button', class: 'btn big block mi-read-ok' }, 'J’ai compris ▶');
    listen(readBtn, 'click', () => understood(c));
    const wrap = h('div', { class: 'mi-readwrap' }, readBtn);
    pad.appendChild(wrap);
    c.readWrap = wrap;
    if (!reduced()) safe(() => card.animate([{ opacity: 0, transform: 'translateY(10px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.22, 1, .36, 1)' }));
    announce(F(L.fullText(c.item)));
    readAloud(c);
  }
  async function readAloud(c) {
    const token = readSeq;
    const lines = L.readLines(c.item).map(F);
    if (!introSaid) {
      introSaid = true;
      try { globalThis.sessionStorage.setItem(INTRO_KEY + ((ctx.profile && ctx.profile.id) || ''), '1'); } catch (_) {}
      sayEl.textContent = frTypo(F(L.INTRO));
      sayEl.classList.remove('hidden');
      safe(() => ctx.voice && ctx.voice.prepare(...lines));
      await say(L.INTRO);
      if (token !== readSeq || !alive) return;
    } else {
      sayEl.classList.add('hidden');
      safe(() => ctx.voice && lines.length > 1 && ctx.voice.prepare(...lines.slice(1)));
    }
    for (let i = 0; i < lines.length; i++) {
      if (token !== readSeq || !alive || phase !== 'read' || cur !== c) return;
      highlight(i);
      const ok = await say(lines[i]);
      if (!ok) break;
    }
    if (token !== readSeq || cur !== c) return;
    highlight(-1);
    say(L.fullText(c.item), true);                 /* 🔊 de l'en-tête relit tout l'énoncé */
  }
  /* 2. répondre */
  function understood(c) {
    if (cur !== c || phase !== 'read') return;
    readSeq++;
    hush();
    highlight(-1);
    sound('tap');
    sayEl.classList.add('hidden');
    if (c.readWrap) c.readWrap.remove();
    readBtn = null;
    phase = 'answer';
    box.classList.remove('is-read');
    box.classList.add('is-answer');
    drawBtn.classList.toggle('hidden', !L.schemaAllowed(classe(), c.item));
    setInput(c);
    va.autoStart();                                   /* micro allumé dans la séance : il revient */
    say(L.fullText(c.item), true);
    if (c.item.assist) showHint('assist'); else showIdle();
    c.t0 = nowMs();
    try { bodyEl.scrollTop = 0; } catch (_) {}         /* les nombres en haut ; la question reste collée en bas */
  }

  /* ================= COMPAGNON ================= */
  let moodT = 0;
  function heroMood(cls, ms) {
    const pets = [petSvg, stageSvg].filter(Boolean);
    if (!pets.length || reduced()) return;
    moodT = cancel(moodT);
    for (const p of pets) { p.classList.remove('hop', 'joy'); void p.getBoundingClientRect(); p.classList.add(cls); }
    moodT = later(() => { moodT = 0; for (const p of pets) p.classList.remove(cls); }, ms);
  }

  /* ================= FIN ================= */
  function finish() {
    if (ended) return;
    ended = true;
    phase = 'end';
    va.pause(true);
    heroMood('joy', 1050);
    later(() => safe(() => ctx.end()), FINALE_MS);
  }

  /* ================= CYCLE DE VIE ================= */
  async function start() {
    if (started) return;
    started = true;
    await new Promise(res => { try { requestAnimationFrame(() => res()); } catch (_) { setTimeout(res, 16); } });
    if (!alive) return;
    try {
      let lastW = 0;
      const ro = new ResizeObserver(() => {
        const w = Math.round(bodyEl.clientWidth);
        if (!alive || !cur || !cur.schemaOpen || Math.abs(w - lastW) < 2) return;
        lastW = w;
        drawSchema(cur, !!cur.schemaSolved);
      });
      ro.observe(bodyEl);
      cleanups.push(() => { try { ro.disconnect(); } catch (_) {} });
    } catch (_) {}
    nextItem();
  }
  function destroy() {
    if (!alive) return;
    alive = false;
    readSeq++;
    hush();
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const fn of cleanups.splice(0)) fn();
    try { ctx.onJoker(() => false); } catch (_) {}
    va.destroy();
    if (kp) { try { kp.destroy(); } catch (_) {} kp = null; }
    dropGrid();
    box.remove();
  }
  return { start, destroy };
}
