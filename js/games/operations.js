/* ============ L’ATELIER DES OPÉRATIONS — ma.operations (docs/JEUX.md §7, contrat docs/ARCHITECTURE.md §7) ============
   Un établi en bois, une feuille de cahier à grands carreaux (Seyès) ; l'opération y est posée, une case par chiffre.
   Le générateur (js/content/maths/operations.js) fournit la grille finale et les étapes ; le moteur
   (operations-logic.js) les joue ; ce module les MET EN SCÈNE :
   - question (step.prompt) dans la bulle du compagnon, au-dessus d'un pavé compact de 10 chiffres : l'enfant tape UN
     chiffre, il se pose aussitôt (pas de ✓ : un chiffre = une réponse) ;
   - colonne courante surlignée en ambre (+ et −, addition finale du ×), cases en jeu surlignées, case attendue qui
     pulse ; retenues d'un produit partiel terminé pâlies ;
   - juste → le chiffre se pose avec un pop, note pentatonique qui monte avec la série, commentaire (step.say) ;
     1re erreur → secousse douce + indice de l'étape → nouvel essai ; 2e erreur → le chiffre est posé (en vert pointillé)
     avec l'explication, et on CONTINUE (jamais bloqué) ;
   - étapes automatiques animées en cascade, sans jamais bloquer la saisie (si l'enfant tape, tout se termine d'un coup) :
     retenue qui s'envole vers la colonne suivante, « 1 » et « +1 » de la compensation, chiffres barrés du cassage,
     0 de la règle des 0, virgule, produit à soustraire, chiffre abaissé qui glisse dans la potence, zéros pâles ;
   - fin d'une opération : ligne du résultat (ou quotient et reste) mise en valeur, célébration, 🍎 qui vole vers
     l'en-tête, explication, puis « Opération suivante ➜ ».
   Rapport (contrat §7.3) : correct = aucune étape posée d'office après deux erreurs ; hinted = une erreur, le joker ou
   le coup de pouce (item.assist) ; joker 💡 = indice de l'étape en cours. Méthode de soustraction de l'école :
   ctx.settings.subMethod → ctx.nextItem(undefined, { subMethod }). */

import { h, svg, clear } from '../core/util.js';
import * as L from './operations-logic.js';

let inst = null;

export default {
  id: 'operations', title: 'L’Atelier des opérations', icon: '🧮', axes: ['ma.operations'],
  css: 'css/games/operations.css',
  async mount(root, ctx) {
    if (inst) inst.destroy();
    inst = createAtelier(root, ctx);
    inst.start();
  },
  unmount() {
    if (inst) inst.destroy();
    inst = null;
  }
};

const EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
const EASE_POP = 'cubic-bezier(.34,1.56,.64,1)';
const STEP_GAP = 360;          /* écart entre deux étapes automatiques animées (ms) */
const GUARD_RIGHT = 160;       /* double appui involontaire ignoré après une réponse (ms) */
const GUARD_WRONG = 260;
const SAY_MAX = 170;           /* au-delà, seul le dernier commentaire est affiché */
const CHILD_TYPES = new Set(['digit', 'quotient', 'rest']);

function safe(fn) { try { return fn(); } catch (e) { console.error(e); return undefined; } }
/* texte en Fredoka : l'espace fine des milliers (U+202F) y est presque invisible (« 239079 ») ; dans les nombres, on
   la remplace par un petit espaceur visible, le nombre restant insécable (les lecteurs d'écran le lisent d'un seul
   tenant). Les espaces fines de la ponctuation (« : », « ? ») restent des caractères insécables. */
const BIG_NUM = /\d{1,3}(?:\u202f\d{3})+(?:,\d+)?/g;
function setNumText(el, text) {
  clear(el);
  const str = String(text || '');
  let last = 0;
  for (const m of str.matchAll(BIG_NUM)) {
    if (m.index > last) el.append(str.slice(last, m.index));
    const num = h('span', { class: 'op-num' });
    m[0].split('\u202f').forEach((part, i) => {
      if (i) num.append(h('span', { class: 'op-thin', 'aria-hidden': 'true' }));
      num.append(part);
    });
    el.append(num);
    last = m.index + m[0].length;
  }
  if (last < str.length) el.append(str.slice(last));
}
/* « 8 + 1 de retenue = 9 » ne se coupe pas autour d'un signe : espaces insécables de part et d'autre */
const keepMath = s => String(s || '').replace(/ ([+−×÷=<>≤≥]) /g, '\u00A0$1\u00A0');
function supportsAnim(el) { return !!(el && typeof el.animate === 'function'); }

/* ---------- petit crayon posé sur la feuille (décor) ---------- */
function pencilSVG() {
  return svg('svg', { class: 'op-pencil', viewBox: '0 0 120 24', 'aria-hidden': 'true', focusable: 'false' },
    svg('rect', { x: 18, y: 4, width: 78, height: 16, rx: 3, fill: 'var(--amber-400)', stroke: 'var(--ink)', 'stroke-width': 2 }),
    svg('rect', { x: 18, y: 9.5, width: 78, height: 5, fill: 'var(--amber-300)' }),
    svg('rect', { x: 96, y: 4, width: 12, height: 16, fill: 'var(--ink-4)', stroke: 'var(--ink)', 'stroke-width': 2 }),
    svg('rect', { x: 106, y: 4, width: 11, height: 16, rx: 4, fill: 'var(--pink-200)', stroke: 'var(--ink)', 'stroke-width': 2 }),
    svg('path', { d: 'M18 4 L3 12 L18 20 Z', fill: 'var(--bg-2)', stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linejoin': 'round' }),
    svg('path', { d: 'M8 9.3 L3 12 L8 14.7 Z', fill: 'var(--ink)' }));
}

function createAtelier(root, ctx) {
  const M = ctx.motion, A = ctx.audio, K = ctx.kit;
  let alive = true;
  const timers = new Set(), anims = new Set(), clones = new Set();
  let raf = 0, ro = null;

  /* ---------- état de l'opération en cours ---------- */
  let item = null, run = null, geo = null, cw = 40, t0 = 0;
  let finished = false, ended = false, streak = 0, guardUntil = 0, itemsDone = 0, cleanRun = 0;
  let cells = new Map();        /* clé → { el, ch, cell, kind: 'main' | 'pre' | 'comma', strikeEl } */
  let lines = [];               /* { el, line } */
  let childKeys = new Set();    /* cases écrites par l'enfant (couleur « crayon ») */
  let wrongEl = null, winEls = [], pendingReport = null, nextLabel = '', appleFlying = false;

  /* ---------- DOM ---------- */
  const tag = h('div', { class: 'op-tag' });
  const head = h('div', { class: 'op-head' }, tag, pencilSVG());
  const band = h('div', { class: 'op-band', 'aria-hidden': 'true' });
  const sheet = h('div', { class: 'op-sheet', 'aria-hidden': 'true' });
  const stage = h('div', { class: 'op-stage' }, sheet);
  const paper = h('div', { class: 'op-paper', role: 'img', 'aria-label': 'Feuille de calcul' }, head, stage);
  const bench = h('div', { class: 'op-bench' }, paper);

  const ava = h('div', { class: 'op-ava', 'aria-hidden': 'true' });
  const note = h('div', { class: 'op-note' });
  const ask = h('div', { class: 'op-ask' });
  const scroller = h('div', { class: 'op-scroll' }, note, ask);
  const bubble = h('div', { class: 'op-bubble' }, scroller);
  const talk = h('div', { class: 'op-talk' }, ava, bubble);

  const keys = {};
  const pad = h('div', { class: 'op-pad', role: 'group', 'aria-label': 'Chiffres' },
    L.DIGITS.map(d => (keys[d] = h('button', { type: 'button', class: 'key op-key', 'data-d': d }, d))));
  const nextBtn = h('button', { type: 'button', class: 'btn big block op-next', tabindex: '-1' }, 'Opération suivante ➜');
  const dock = h('div', { class: 'op-dock' }, pad, nextBtn);

  const wrap = h('div', { class: 'op' }, bench, talk, dock);

  /* ---------- outils ---------- */
  const reduced = () => { try { return M.reduced(); } catch (_) { return false; } };
  function later(fn, ms) {
    const t = setTimeout(() => { timers.delete(t); if (alive) safe(fn); }, ms);
    timers.add(t);
    return t;
  }
  function track(anim, onDone) {
    if (!anim) return null;
    anims.add(anim);
    const end = () => { anims.delete(anim); if (onDone) safe(onDone); };
    anim.onfinish = end;
    anim.oncancel = end;
    return anim;
  }
  function animate(el, frames, opts) {
    if (!supportsAnim(el)) return null;
    try { return track(el.animate(frames, opts)); } catch (_) { return null; }
  }
  /* termine d'un coup toutes les animations en cours (l'enfant a tapé : rien ne le fait attendre) */
  function settle() {
    for (const a of [...anims]) { try { a.finish(); } catch (_) { try { a.cancel(); } catch (__) {} } }
    anims.clear();
    for (const c of clones) c.remove();
    clones.clear();
  }
  /* compagnon du profil (ctx.petSVG : espèce, accessoires portés, stade) */
  function drawAva(mood) {
    const big = (globalThis.innerWidth || 390) >= 900 && (globalThis.innerHeight || 800) >= 560;
    safe(() => { ava.innerHTML = ctx.petSVG(big ? 84 : 60, mood || ''); });
  }

  /* entrée animée d'un élément (case qui apparaît) : petit pop, ou fondu en mouvement réduit */
  function popIn(el, delay = 0, { dur = 340, from = 0.3 } = {}) {
    if (!el) return null;
    if (reduced()) return animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 150, delay, fill: 'backwards', easing: 'ease-out' });
    return animate(el, [
      { opacity: 0, transform: `scale(${from})` },
      { opacity: 1, transform: 'scale(1.18)', offset: 0.6 },
      { opacity: 1, transform: 'scale(1)' }
    ], { duration: dur, delay, fill: 'backwards', easing: EASE_OUT });
  }
  function fadeIn(el, delay = 0, dur = 260) {
    return animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: reduced() ? 150 : dur, delay, fill: 'backwards', easing: 'ease-out' });
  }

  /* ---------- feuille : construction ---------- */
  function buildSheet() {
    clear(sheet);
    cells = new Map();
    lines = [];
    winEls = [];
    wrongEl = null;
    sheet.append(band);
    band.classList.remove('is-on');
    const grid = item.data.grid;
    childKeys = new Set();
    for (const s of item.data.steps) if (s.ask && CHILD_TYPES.has(s.type)) for (const c of s.cells || []) childKeys.add(L.cellKey(c));
    for (const ln of geo.lines) {
      const el = h('div', { class: 'op-line op-line--' + ln.kind });
      sheet.append(el);
      lines.push({ el, line: ln });
    }
    for (const c of grid.cells) {
      if (c.role === 'rule') continue;
      const k = L.cellKey(c);
      const ch = h('span', { class: 'op-ch' }, c.ch);
      const kind = c.pos === 'avant' ? 'pre' : c.pos === 'apres' ? 'comma' : 'main';
      const cls = ['op-c', 'op-c--' + kind, 'r-' + c.role];
      if (c.small) cls.push('is-small');
      if (c.pale) cls.push('is-pale');
      if (c.zero) cls.push('is-zero');
      if (childKeys.has(k)) cls.push('by-child');
      if (kind === 'main' && c.small) cls.push('at-' + (geo.rowAnchor[c.r] || 'mid'));
      const el = h('div', { class: cls.join(' ') }, ch);
      sheet.append(el);
      cells.set(k, { el, ch, cell: c, kind, strikeEl: null });
    }
  }

  /* ---------- feuille : mise en page (taille de case, positions, carreaux alignés) ---------- */
  function relayout() {
    if (!geo || !alive) return;
    const W = Math.max(40, stage.clientWidth - 8), H = Math.max(40, stage.clientHeight - 10);
    const wide = (globalThis.innerWidth || 390) >= 900;
    cw = L.fitCell({ W, H, cols: geo.width, height: geo.height, max: wide ? 72 : 64, min: 14 });
    if (cw >= 28) cw -= cw % 4;              /* petits carreaux Seyès (cw / 4) tombant juste sur les pixels */
    laidOut = W + 'x' + H;
    const fs = L.fontSizes(cw);
    sheet.style.width = geo.width * cw + 'px';
    sheet.style.height = geo.height * cw + 'px';
    sheet.style.setProperty('--cw', cw + 'px');
    sheet.style.setProperty('--fs', fs.big + 'px');
    sheet.style.setProperty('--fss', fs.small + 'px');
    for (const [, rec] of cells) place(rec);
    for (const { el, line } of lines) {
      const x0 = line.x0 * cw, x1 = line.x1 * cw, y0 = line.y0 * cw, y1 = line.y1 * cw;
      if (line.kind === 'bar') Object.assign(el.style, { left: x0 + 'px', top: y0 + 'px', height: (y1 - y0) + 'px', width: '' });
      else Object.assign(el.style, { left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: '' });
    }
    placeBand();
    for (const w of winEls) placeBox(w.el, w.ext);
    /* grands carreaux du cahier alignés sur les cases de l'opération */
    const ox = stage.offsetLeft + sheet.offsetLeft, oy = stage.offsetTop + sheet.offsetTop;
    paper.style.setProperty('--cw', cw + 'px');
    paper.style.setProperty('--ox', ox + 'px');
    paper.style.setProperty('--oy', oy + 'px');
    /* marge rose du cahier, à gauche de l'opération quand il y a la place */
    const mx = ox - Math.max(10, Math.round(cw * 0.6));
    paper.style.setProperty('--mx', (mx >= 8 ? mx : -20) + 'px');
  }
  function place(rec) {
    const c = rec.cell, top = geo.top[c.r] * cw, x = geo.left[c.c] * cw;
    const st = rec.el.style;
    if (rec.kind === 'main') {
      st.left = x + 'px'; st.top = top + 'px'; st.width = cw + 'px'; st.height = cw + 'px';
    } else if (rec.kind === 'pre') {
      const s = Math.round(cw * 0.46);
      st.left = (x - cw * 0.06) + 'px'; st.top = (top + cw * 0.01) + 'px'; st.width = s + 'px'; st.height = s + 'px';
    } else {
      const w = Math.round(cw * 0.34);
      st.left = (x + cw - w / 2) + 'px'; st.top = top + 'px'; st.width = w + 'px'; st.height = cw + 'px';
    }
  }
  function placeBox(el, ext) {
    if (!ext) return;
    const pad = Math.round(cw * 0.06);
    Object.assign(el.style, {
      left: (ext.x0 * cw - pad) + 'px', top: (ext.y0 * cw + pad) + 'px',
      width: ((ext.x1 - ext.x0) * cw + pad * 2) + 'px', height: ((ext.y1 - ext.y0) * cw - pad * 2) + 'px'
    });
  }
  let bandCol = null;
  function placeBand() {
    band.style.width = cw + 'px';
    band.style.height = geo.height * cw + 'px';
    if (bandCol !== null) band.style.transform = `translateX(${geo.left[bandCol] * cw}px)`;
  }
  let laidOut = '';
  function scheduleLayout() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!alive || !geo) return;
      const size = Math.max(40, stage.clientWidth - 12) + 'x' + Math.max(40, stage.clientHeight - 10);
      if (size === laidOut) return;             /* rien n'a bougé : on ne touche pas aux animations en cours */
      settle();
      relayout();
    });
  }

  /* ---------- feuille : état des cases ---------- */
  function paint() {
    const v = run.view();
    const focus = new Set(v.focus);
    const brought = new Set();
    for (const [k, rec] of cells) if (rec.cell.from && run.visible.has(k)) brought.add(L.cellKey(rec.cell.from));
    for (const [k, rec] of cells) {
      const vis = run.visible.has(k), cl = rec.el.classList;
      cl.toggle('is-hidden', !vis);
      cl.toggle('is-given', run.given.has(k));
      cl.toggle('is-stale', run.isStale(k));
      cl.toggle('is-slot', !vis && run.slots.has(k));
      cl.toggle('is-target', k === v.target);
      cl.toggle('is-focus', focus.has(k) && vis);
      cl.toggle('is-brought', brought.has(k));
      const struck = run.struck.has(k);
      cl.toggle('is-struck', struck);
      if (struck && !rec.strikeEl) { rec.strikeEl = h('span', { class: 'op-strike' }); rec.el.append(rec.strikeEl); }
    }
    for (const { el, line } of lines) if (line.kind === 'sub') el.classList.toggle('is-on', line.keys.some(k => run.visible.has(k)));
    bandCol = v.band;
    band.classList.toggle('is-on', v.band !== null);
    if (v.band !== null) band.style.transform = `translateX(${geo.left[v.band] * cw}px)`;
    /* état lisible de l'extérieur (débogage, bancs d'essai) : étape attendue */
    wrap.dataset.step = run.current ? run.current.id : '';
    wrap.dataset.state = run.done ? 'done' : 'play';
  }

  /* ---------- animations des étapes ---------- */
  function centerOf(k) {
    const rec = cells.get(k);
    if (!rec) return null;
    const c = rec.cell;
    const x = geo.left[c.c] * cw;
    if (rec.kind === 'pre') return { x: x + cw * 0.17, y: geo.top[c.r] * cw + cw * 0.24 };
    if (rec.kind === 'comma') return { x: x + cw, y: geo.top[c.r] * cw + cw * 0.6 };
    return { x: x + cw / 2, y: geo.top[c.r] * cw + cw / 2 };
  }
  /* retenue : un petit chiffre jaillit de la case qu'on vient d'écrire et s'envole en arc vers sa colonne */
  function flyCarry(fromKey, toKey, delay) {
    const rec = cells.get(toKey);
    if (!rec) return 0;
    const a = fromKey && centerOf(fromKey), b = centerOf(toKey);
    if (reduced() || !a || !b || !supportsAnim(rec.ch)) { fadeIn(rec.ch, delay); return 200; }
    const dur = 480;
    const clone = h('div', { class: 'op-fly', 'aria-hidden': 'true' }, rec.cell.ch);
    clone.style.left = a.x + 'px';
    clone.style.top = a.y + 'px';
    sheet.append(clone);
    clones.add(clone);
    const fs = L.fontSizes(cw), end = fs.small / fs.big;
    const dx = b.x - a.x, dy = b.y - a.y, lift = Math.max(cw * 0.7, Math.abs(dy) * 0.22);
    const frames = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const x = dx * t, y = dy * t - 4 * lift * t * (1 - t), s = 1 + (end - 1) * t;
      frames.push({ transform: `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`, opacity: t < 0.12 ? t / 0.12 : 1 });
    }
    const anim = animate(clone, frames, { duration: dur, delay, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'both' });
    const done = () => { clone.remove(); clones.delete(clone); };
    if (anim) { anim.addEventListener('finish', done); anim.addEventListener('cancel', done); } else done();
    animate(rec.ch, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1.25)', offset: 0.55 }, { opacity: 1, transform: 'scale(1)' }],
      { duration: 240, delay: delay + dur - 30, fill: 'backwards', easing: EASE_OUT });
    return dur + 180;
  }
  /* chiffre abaissé : il glisse depuis le dividende jusqu'à sa place */
  function slideFrom(k, delay) {
    const rec = cells.get(k);
    if (!rec || !rec.cell.from) return popIn(rec && rec.ch, delay) ? 340 : 0;
    const f = rec.cell.from, c = rec.cell;
    const dx = (geo.left[f.c] - geo.left[c.c]) * cw, dy = (geo.top[f.r] - geo.top[c.r]) * cw;
    if (reduced()) { fadeIn(rec.ch, delay); return 200; }
    animate(rec.ch, [
      { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.35 },
      { transform: `translate(${dx}px, ${dy}px)`, opacity: 1, offset: 0.12 },
      { transform: 'translate(0, 0)', opacity: 1 }
    ], { duration: 520, delay, fill: 'backwards', easing: EASE_OUT });
    return 560;
  }
  function strikeIn(k, delay) {
    const rec = cells.get(k);
    if (!rec || !rec.strikeEl) return;
    if (reduced()) { fadeIn(rec.strikeEl, delay); return; }
    animate(rec.strikeEl, [{ transform: 'rotate(-30deg) scaleX(0)' }, { transform: 'rotate(-30deg) scaleX(1)' }],
      { duration: 260, delay, fill: 'backwards', easing: EASE_OUT });
  }
  function flash(keysList, delay) {
    let i = 0;
    for (const k of keysList) {
      const rec = cells.get(k);
      if (!rec || !run.visible.has(k)) continue;
      if (reduced()) continue;
      animate(rec.ch, [{ transform: 'scale(1)' }, { transform: 'scale(1.16)', offset: 0.4 }, { transform: 'scale(1)' }],
        { duration: 420, delay: delay + 45 * i++, easing: EASE_POP });
    }
  }
  /* joue l'animation d'une étape automatique à partir de delay ; → durée occupée (ms) */
  function animStep(step, delay, srcKey) {
    const ks = (step.cells || []).map(L.cellKey);
    switch (step.type) {
      case 'carry': {
        let d = 0;
        ks.forEach((k, i) => { d = Math.max(d, flyCarry(srcKey, k, delay + i * 120)); });
        later(() => A.tap(), delay + 380);
        return d;
      }
      case 'mark': {
        (step.strike || []).map(L.cellKey).forEach((k, i) => strikeIn(k, delay + i * 120));
        const base = delay + ((step.strike || []).length ? 200 + 120 * (step.strike.length - 1) : 0);
        ks.forEach((k, i) => { const rec = cells.get(k); if (rec) popIn(rec.ch, base + i * 140); });
        later(() => A.tap(), base + 60);
        return base - delay + ks.length * 140 + 260;
      }
      case 'bring': {
        let d = 0, t = delay;
        for (const k of ks) {
          const rec = cells.get(k);
          if (rec && rec.cell.from) { d = Math.max(d, t - delay + slideFrom(k, t)); t += 140; }
          else if (rec) { fadeIn(rec.ch, t, 220); t += 220; d = Math.max(d, t - delay); }
        }
        later(() => A.whoosh(), delay + 40);
        return d;
      }
      case 'pad':
        ks.forEach((k, i) => { const rec = cells.get(k); if (rec) fadeIn(rec.ch, delay + i * 90, 320); });
        return 320 + ks.length * 90;
      case 'info':
        flash((step.focus || []).map(L.cellKey), delay);
        return 260;
      default: {          /* zero, comma, product, et toute autre étape qui dévoile des cases */
        ks.forEach((k, i) => { const rec = cells.get(k); if (rec) popIn(rec.ch, delay + i * 90, { from: step.type === 'comma' ? 2.2 : 0.3 }); });
        if (ks.length) later(() => A.tap(), delay + 40);
        return 300 + ks.length * 90;
      }
    }
  }
  function animAutos(autos, srcKey, delay) {
    let t = delay;
    for (const s of autos) t += Math.min(900, animStep(s, t, srcKey)) > 0 ? STEP_GAP : 0;
    return t;
  }

  /* ---------- bulle du compagnon ---------- */
  function setNote(text, kind) {
    note.textContent = keepMath(text);
    note.className = 'op-note' + (text ? ' is-' + (kind || 'say') : '');
  }
  function setAsk(text) { setNumText(ask, keepMath(text)); }
  function showStepTalk(said) {
    const step = run.current;
    if (!step) return;
    const s = said || {};
    if (run.hintShown && step.hint) setNote(step.hint, 'hint');
    else setNote(s.text, 'say');
    setAsk(step.prompt);
    fitTalk(s.short);
  }
  /* la bulle a une hauteur fixe : si tout ne tient pas, on ne garde que le dernier commentaire, puis on resserre le
     texte ; en dernier recours la bulle défile, la question (en bas) restant visible */
  function fitTalk(shorter) {
    bubble.classList.remove('is-dense', 'is-scroll');
    const over = () => scroller.scrollHeight > scroller.clientHeight + 1;
    const kind = ['say', 'hint', 'learn'].find(k => note.classList.contains('is-' + k));
    if (over() && shorter && kind) setNote(shorter, kind);
    if (over()) bubble.classList.add('is-dense');
    if (over()) bubble.classList.add('is-scroll');
    keepAskVisible();
  }
  function keepAskVisible() { scroller.scrollTop = scroller.scrollHeight; }
  /* commentaire des étapes jouées : les deux derniers « say » (ou le dernier seul s'ils sont trop longs) */
  function sayOf(steps) {
    const two = L.sayText(steps, 2), one = L.sayText(steps, 1);
    return { text: two.length > SAY_MAX ? one : two, short: one };
  }

  /* ---------- déroulé d'une opération ---------- */
  function nextItem() {
    if (!alive) return;
    settle();
    const opts = {};
    const sm = ctx.settings && ctx.settings.subMethod;
    if (sm === 'compensation' || sm === 'cassage') opts.subMethod = sm;
    item = ctx.nextItem(undefined, opts);
    if (!item) { endManche(); return; }
    run = L.createRun(item, { assist: !!item.assist });
    geo = L.analyzeGrid(item.data.grid);
    finished = false; streak = 0; guardUntil = 0; pendingReport = null;
    setNumText(tag, item.prompt);
    paper.setAttribute('aria-label', 'Opération posée : ' + item.prompt);
    buildSheet();
    showPad();
    relayout();
    drawAva('');
    const st = run.start();
    paint();
    const intro = sayOf(st.autos);
    if (item.assist && run.current && run.current.hint) {
      setNote('Petit coup de pouce\u202f: ' + run.current.hint, 'hint');
      setAsk(run.current.prompt);
      fitTalk('');
    } else showStepTalk(intro);
    /* nouvelle feuille : elle glisse sur l'établi */
    if (reduced()) fadeIn(paper, 0, 200);
    else animate(paper, [{ opacity: 0, transform: 'translateX(26px) rotate(.8deg)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE_OUT });
    animAutos(st.autos, null, 380);
    t0 = performance.now();
    const first = run.current;
    ctx.announce('Opération : ' + item.prompt + '. ' + (intro.text ? intro.text + ' ' : '') + (first ? first.prompt : ''));
    if (run.done) complete();
  }

  function onDigit(d) {
    if (!alive || !run || finished) return;
    const now = performance.now();
    if (now < guardUntil) return;
    settle();
    clearWrong();
    const step = run.current;
    if (!step) return;
    const target = run.view().target;
    const res = run.answer(d);
    if (res.result === 'ignored') return;
    if (res.result === 'right') {
      streak++;
      guardUntil = now + GUARD_RIGHT;
      paint();
      const rec = target && cells.get(target);
      if (rec) popIn(rec.ch, 0, { dur: 380, from: 0.2 });
      else if (step.type === 'count') slotsIn();
      safe(() => A.success(Math.min(streak - 1, 9)));
      safe(() => { if (navigator.vibrate) navigator.vibrate(12); });
      const said = sayOf([step, ...res.autos]);
      animAutos(res.autos, target, 170);
      if (res.done) { setNote(said.text, 'say'); setAsk(''); fitTalk(said.short); complete(); return; }
      showStepTalk(said);
      ctx.announce(said.text + ' ' + (run.current ? run.current.prompt : ''));
    } else if (res.result === 'retry') {
      streak = 0;
      guardUntil = now + GUARD_WRONG;
      showWrong(target, d);
      setNote(K.cheer('retry', ctx.rng) + ' ' + (step.hint || ''), 'hint');
      setAsk(step.prompt);
      fitTalk(step.hint || '');
      if (!reduced()) M.squash(ava, { amount: 0.6 });
      ctx.announce(note.textContent);
    } else if (res.result === 'given') {
      streak = 0;
      guardUntil = now + GUARD_WRONG;
      showWrong(target, d, true);
      paint();
      const rec = target && cells.get(target);
      if (rec) popIn(rec.ch, 380, { dur: 420, from: 0.5 });
      else if (step.type === 'count') slotsIn();
      const learn = K.cheer('learn', ctx.rng) + ' ' + (step.say || '');
      animAutos(res.autos, target, 420);
      const more = sayOf(res.autos).short;
      setNote(learn + (more && learn.length + more.length < SAY_MAX ? ' ' + more : ''), 'learn');
      if (res.done) { setAsk(''); fitTalk(step.say || ''); complete(); return; }
      setAsk(run.current.prompt);
      fitTalk(step.say || '');
      ctx.announce(note.textContent + ' ' + run.current.prompt);
    }
  }

  /* chiffre tapé à tort : il apparaît en orange doux dans la case, la case tremble, puis il s'efface */
  function showWrong(target, d, keep) {
    const rec = target && cells.get(target);
    if (!rec) { K.gentleWrong(bubble); return; }
    const p = centerOf(target);
    wrongEl = h('div', { class: 'op-wrong', 'aria-hidden': 'true' }, d);
    Object.assign(wrongEl.style, { left: (p.x - cw / 2) + 'px', top: (p.y - cw / 2) + 'px', width: cw + 'px', height: cw + 'px' });
    sheet.append(wrongEl);
    K.gentleWrong(wrongEl);
    const el = wrongEl;
    later(() => { if (wrongEl === el) clearWrong(); }, keep ? 420 : 900);
  }
  function clearWrong() {
    if (!wrongEl) return;
    const el = wrongEl;
    wrongEl = null;
    if (reduced() || !supportsAnim(el)) { el.remove(); return; }
    const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'ease-in' });
    a.onfinish = () => el.remove();
    a.oncancel = () => el.remove();
  }
  function slotsIn() {
    let i = 0;
    for (const k of run.slots) {
      const rec = cells.get(k);
      if (rec) rec.el.style.setProperty('--i', String(i++));
    }
  }

  /* ---------- fin d'une opération ---------- */
  function complete() {
    finished = true;
    const out = run.outcome(performance.now() - t0);
    itemsDone++;
    cleanRun = out.correct && !out.hinted ? cleanRun + 1 : 0;
    const last = itemsDone >= (ctx.count || 0);
    nextLabel = !out.correct ? 'J’ai compris ✓' : last ? 'Terminer ➜' : 'Opération suivante ➜';
    let reported = false;
    const doReport = () => { if (reported) return; reported = true; pendingReport = null; safe(() => ctx.report(item, out)); };
    pendingReport = doReport;
    paint();
    const kind = !out.correct ? 'learn' : out.hinted ? 'helped' : 'right';
    const praise = K.cheer(kind, ctx.rng);
    later(() => {
      showNext();
      celebrate(out, doReport);
      setNote(item.explain || '', 'say');
      setAsk(praise);
      bubble.classList.add('is-end');
      fitTalk('');
      scroller.scrollTop = 0;
      ctx.announce(praise + ' ' + (item.explain || ''));
    }, reduced() ? 120 : 420);
    if (!out.correct) doReport();
  }

  function celebrate(out, doReport) {
    for (const w of winEls) w.el.remove();
    winEls = [];
    const add = (keysList, cls) => {
      const ext = L.extentOf(keysList, geo);
      if (!ext) return null;
      const el = h('div', { class: 'op-win' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
      sheet.insertBefore(el, sheet.firstChild.nextSibling);
      winEls.push({ el, ext });
      placeBox(el, ext);
      if (reduced()) fadeIn(el, 0, 200);
      else animate(el, [{ opacity: 0, transform: 'scaleX(.2)' }, { opacity: 1, transform: 'scaleX(1)' }], { duration: 460, easing: EASE_OUT });
      return el;
    };
    const winEl = add(geo.finalKeys, '');
    if (item.data.remainder !== null && item.data.remainder !== undefined && geo.restKeys.length) add(geo.restKeys, 'is-rest');
    /* les chiffres du résultat sautillent l'un après l'autre */
    const chars = geo.finalKeys.map(k => cells.get(k)).filter(Boolean).sort((a, b) => a.cell.c - b.cell.c);
    if (!reduced()) chars.forEach((rec, i) => animate(rec.ch, [{ transform: 'translateY(0) scale(1)' }, { transform: `translateY(${-Math.round(cw * 0.18)}px) scale(1.14)`, offset: 0.45 }, { transform: 'translateY(0) scale(1)' }],
      { duration: 460, delay: 120 + i * 70, easing: EASE_OUT }));
    drawAva('joy');
    later(() => drawAva(''), 1300);
    if (out.correct && winEl) {
      safe(() => K.celebrateRight(winEl, cleanRun));
      if (!out.hinted) later(() => A.fanfare(), 260);
      const target = ctx.applesEl;
      if (target) {
        later(() => {
          appleFlying = true;
          M.flyTo(winEl, target, { emoji: '🍎', count: 1, onArrive: () => { doReport(); if (alive) A.coin(); } })
            .then(() => { appleFlying = false; doReport(); });
        }, 200);
      } else doReport();
    } else {
      safe(() => A.success(2));
      doReport();
    }
  }

  /* ---------- pavé / bouton suivant ---------- */
  function showPad() {
    dock.classList.remove('is-done');
    bubble.classList.remove('is-end');
    nextBtn.setAttribute('tabindex', '-1');
    for (const b of Object.values(keys)) b.disabled = false;
  }
  function showNext() {
    nextBtn.textContent = nextLabel;
    dock.classList.add('is-done');
    for (const b of Object.values(keys)) b.disabled = true;
    nextBtn.removeAttribute('tabindex');
    if (!reduced()) popIn(nextBtn, 80, { from: 0.85, dur: 360 });
    safe(() => nextBtn.focus({ preventScroll: true }));
  }
  function goNext() {
    if (!alive || !finished || ended) return;
    if (pendingReport) pendingReport();
    finished = false;
    nextBtn.blur();
    if (itemsDone >= (ctx.count || 0)) { endManche(); return; }
    if (reduced()) { nextItem(); return; }
    const a = animate(paper, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-26px) rotate(-.8deg)' }],
      { duration: 200, easing: 'ease-in', fill: 'forwards' });
    if (a) a.addEventListener('finish', () => { if (alive) { safe(() => a.cancel()); nextItem(); } }, { once: true });
    else nextItem();
  }
  function endManche() {
    if (ended) return;
    ended = finished = true;
    if (pendingReport) pendingReport();
    for (const b of Object.values(keys)) b.disabled = true;
    nextBtn.disabled = true;
    safe(() => ctx.end());
  }

  /* ---------- entrées ---------- */
  pad.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('.op-key');
    if (!b || b.disabled || e.button > 0) return;
    b.classList.add('is-pressed');
    safe(() => A.tap());
  });
  const release = () => { for (const b of pad.querySelectorAll('.is-pressed')) b.classList.remove('is-pressed'); };
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) pad.addEventListener(t, release);
  pad.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.op-key');
    if (b && !b.disabled) onDigit(b.dataset.d);
  });
  nextBtn.addEventListener('click', goNext);
  function onKey(e) {
    if (!alive || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
    if (document.querySelector('.overlay')) return;
    if (finished) {
      if ((e.key === 'Enter' || e.key === ' ') && document.activeElement !== nextBtn && dock.classList.contains('is-done')) { e.preventDefault(); goNext(); }
      return;
    }
    const d = L.digitOfKey(e.key);
    if (d === null) return;
    e.preventDefault();
    const b = keys[d];
    if (b) { b.classList.add('is-pressed'); later(() => b.classList.remove('is-pressed'), 110); }
    safe(() => A.tap());
    onDigit(d);
  }

  /* joker 💡 : indice de l'étape en cours (une fois par étape ; déjà affiché → pas de joker dépensé) */
  ctx.onJoker(() => {
    if (!alive || !run || finished) return false;
    const cur = run.current;
    if (!cur || !cur.hint) return false;
    const j = run.joker();
    if (!j || !j.step) return false;
    if (j.already) {
      if (!reduced()) M.pop(note, { scale: 1.04 });
      return false;
    }
    setNote(j.step.hint, 'hint');
    setAsk(j.step.prompt);
    fitTalk('');
    if (!reduced()) M.pop(bubble, { scale: 1.03 });
    ctx.announce('Indice : ' + j.step.hint);
    return true;
  });

  return {
    start() {
      root.append(wrap);
      drawAva('');
      document.addEventListener('keydown', onKey);
      try {
        ro = new ResizeObserver(() => scheduleLayout());
        ro.observe(stage);
      } catch (_) { ro = null; }
      nextItem();
    },
    destroy() {
      if (pendingReport && alive) safe(pendingReport);
      alive = false;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      if (raf) { try { cancelAnimationFrame(raf); } catch (_) {} raf = 0; }
      settle();
      if (wrongEl) { wrongEl.remove(); wrongEl = null; }
      /* pomme encore en vol (motion.flyTo n'a pas de poignée d'arrêt) : on la retire avec le jeu */
      if (appleFlying) safe(() => { for (const el of document.querySelectorAll('.mo-fly')) el.remove(); });
      appleFlying = false;
      try { if (ro) ro.disconnect(); } catch (_) {}
      ro = null;
      document.removeEventListener('keydown', onKey);
      safe(() => ctx.onJoker(() => false));
      wrap.remove();
    }
  };
}
