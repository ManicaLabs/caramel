/* ============ KIT D'INTERFACE DE JEU (contrat §7.3 et §8.2) ============
   Composants communs à tous les jeux : pavé numérique, QCM, toast, bulle, feuille du bas,
   célébrations et phrases d'encouragement (cheer).
   DOM uniquement à l'appel (module importable dans Node). Styles : css/base.css + css/ui/kit.css
   (ce dernier est chargé automatiquement au premier composant si la page ne l'a pas déjà).
   Rien n'est jamais rouge ni punitif : erreur = orange doux, secousse légère, son de bois. */

import { h, buzz, fmtNum, frTypo, loadCSS } from '../core/util.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';

const G = globalThis;
const NNBSP = '\u202F';   /* espace fine insécable (séparateur de milliers) */
const nowMs = () => (G.performance && typeof G.performance.now === 'function' ? G.performance.now() : Date.now());
const later = ms => new Promise(r => setTimeout(r, ms));

/* feuille de style du kit, résolue depuis l'emplacement de ce module (marche aussi dans les bancs d'essai) */
let cssAsked = false;
function ensureCSS() {
  if (cssAsked || !G.document) return;
  cssAsked = true;
  try {
    if (G.document.querySelector('link[href$="css/ui/kit.css"]')) return;
    loadCSS(new URL('../../css/ui/kit.css', import.meta.url).href);
  } catch (_) {}
}

/* ============ PAVÉ NUMÉRIQUE ============
   keypad({ decimal, maxLen, onSubmit(str), onChange(str), submitLabel })
   → { el, answer, value(), set(v), clear(), setState('right'|'wrong'|null), disable(bool), destroy() }
   value() = saisie brute avec virgule décimale (« 3,25 ») : la convertir avec parseNum (util.js).
   Après setState('right'|'wrong'), la touche suivante efface l'ancienne réponse (nouvel essai).
   onChange n'est appelé que pour les saisies de l'enfant (pas pour set/clear).
   Clavier physique (chiffres, « , » « . », Retour arrière, Entrée) actif tant que le pavé est dans
   la page, activé, et qu'aucune feuille n'est ouverte par-dessus ; seul le dernier pavé créé écoute. */
const KEYPADS = [];
let kbBound = false;
function onDocKey(e) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
  for (let i = KEYPADS.length - 1; i >= 0; i--) {
    const kp = KEYPADS[i];
    if (!kp.el.isConnected) continue;
    if (kp.isOff() || coveredByOverlay(kp.el)) return;
    if (kp.handleKey(e.key)) e.preventDefault();
    return;
  }
}
/* une feuille ouverte par-dessus le pavé capte le clavier (la plus haute seulement) */
function coveredByOverlay(el) {
  const all = G.document.querySelectorAll('.overlay');
  const top = all[all.length - 1];
  return !!top && !top.contains(el);
}
function bindKeys(kp) {
  /* pavés retirés de la page sans destroy() (jeu démonté) : on les oublie */
  const t = nowMs();
  for (let i = KEYPADS.length - 1; i >= 0; i--) if (!KEYPADS[i].el.isConnected && t - KEYPADS[i].born > 1000) KEYPADS.splice(i, 1);
  KEYPADS.push(kp);
  if (!kbBound && G.document) { G.document.addEventListener('keydown', onDocKey); kbBound = true; }
}
function unbindKeys(kp) {
  const i = KEYPADS.indexOf(kp);
  if (i >= 0) KEYPADS.splice(i, 1);
  if (!KEYPADS.length && kbBound && G.document) { G.document.removeEventListener('keydown', onDocKey); kbBound = false; }
}
/* « 12345,5 » → « 12 345,5 » (lecture des grands nombres) */
function pretty(raw) {
  const [ip, dp] = raw.split(',');
  const g = ip.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  return dp === undefined ? g : g + ',' + dp;
}

export function keypad({ decimal = false, maxLen = 7, onSubmit, onChange, submitLabel = '✓' } = {}) {
  ensureCSS();
  let raw = '', state = null, off = false, lastSubmit = { v: null, t: 0 };
  const max = Math.max(1, Math.floor(+maxLen) || 7);

  const val = h('span', { class: 'kit-answer-val' });
  const ans = h('div', { class: 'answer empty kit-answer', role: 'status', 'aria-live': 'polite', 'aria-label': 'Ta réponse' }, val);
  const keys = {};
  const key = (k, label, cls, aria) =>
    (keys[k] = h('button', { type: 'button', class: 'key' + (cls ? ' ' + cls : ''), 'data-k': k, 'aria-label': aria || null }, label));
  const grid = h('div', { class: 'keypad kit-keys' },
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => key(d, d)),
    decimal ? key(',', ',', 'kit-comma', 'virgule') : h('span', { class: 'kit-key-gap', 'aria-hidden': 'true' }),
    key('0', '0'),
    key('del', '⌫', 'del', 'Effacer'),
    key('ok', submitLabel, 'ok', submitLabel === '✓' ? 'Valider' : null));
  const el = h('div', { class: 'kit-keypad' }, ans, grid);

  function render() {
    val.textContent = pretty(raw);
    ans.classList.toggle('empty', !raw);
    ans.classList.toggle('right', state === 'right');
    ans.classList.toggle('wrong', state === 'wrong');
    el.classList.toggle('is-disabled', off);
  }
  function changed() { try { if (typeof onChange === 'function') onChange(raw); } catch (e) { console.error(e); } }
  /* rien à valider, ou nombre trop long : petit signe sans son (jamais un reproche) */
  function nudge() { motion.shake(ans, { dist: 4, dur: 300 }); return true; }
  function submit() {
    const v = raw.replace(/,$/, '');
    if (!v) return nudge();
    const t = nowMs();
    if (v === lastSubmit.v && t - lastSubmit.t < 600) return true;   /* double appui sur ✓ */
    lastSubmit = { v, t };
    try { if (typeof onSubmit === 'function') onSubmit(v); } catch (e) { console.error(e); }
    return true;
  }
  /* applique une touche ('0'…'9', ',', 'del', 'ok') ; true si elle a été prise en compte */
  function press(k) {
    if (off) return false;
    if (k === 'ok') return submit();
    if (state) {                      /* après un retour, on repart d'une saisie vide */
      state = null; raw = '';
      if (k === 'del') { render(); changed(); return true; }
    }
    let next = raw;
    if (k === 'del') next = raw.slice(0, -1);
    else if (k === ',') {
      if (!decimal || raw.includes(',')) return nudge();
      next = (raw || '0') + ',';
    } else if (/^\d$/.test(k)) {
      if (raw.length >= max) return nudge();
      next = raw === '0' ? k : raw + k;
    } else return false;
    if (next !== raw) { raw = next; render(); changed(); } else render();
    return true;
  }
  /* retour visuel d'une touche (doigt ou clavier physique) */
  function flash(k) {
    const b = keys[k];
    if (!b) return;
    b.classList.add('is-pressed');
    setTimeout(() => b.classList.remove('is-pressed'), 110);
  }

  grid.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('.key');
    if (!b || off || b.disabled || e.button > 0) return;
    b.classList.add('is-pressed');
    audio.tap();
  });
  const release = () => { for (const b of grid.querySelectorAll('.key.is-pressed')) b.classList.remove('is-pressed'); };
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) grid.addEventListener(t, release);
  grid.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.key');
    if (b && grid.contains(b)) press(b.dataset.k);
  });

  const api = {
    el, answer: ans,
    value: () => raw,
    set(v) {
      raw = v === null || v === undefined ? '' : String(v).trim().replace('.', ',').replace(/\s/g, '').replace('−', '-');
      render();
    },
    clear() { raw = ''; state = null; render(); },
    setState(s) { state = s === 'right' || s === 'wrong' ? s : null; render(); },
    disable(b = true) {
      off = !!b;
      for (const k of Object.values(keys)) k.disabled = off;
      if (off) release();
      render();
    },
    destroy() { unbindKeys(handle); release(); el.remove(); }
  };
  const handle = {
    el, born: nowMs(),
    isOff: () => off,
    handleKey(k) {
      const map = { Backspace: 'del', Delete: 'del', Enter: 'ok', '.': ',', Decimal: ',' };
      const kk = map[k] || k;
      if (!/^(\d|,|del|ok)$/.test(kk)) return false;
      if (kk !== 'ok') audio.tap();
      flash(kk);
      press(kk);
      return true;
    }
  };
  bindKeys(handle);
  render();
  return api;
}

/* ============ QCM ============
   choiceGrid(choices, { onPick(value, btn), cols = 2, read = false })
   → { el, buttons, mark(value, 'right'|'wrong'|null), reveal(value), dimOthers(value), disable(), enable(), reset() }
   choices = [{ label, value }] (label : texte ou nœud) ou valeurs simples (nombres affichés à la française).
   read = police de lecture (Andika) pour les phrases. Un choix déjà marqué ne se rejoue pas ;
   un double appui accidentel (< 350 ms) est ignoré. */
export function choiceGrid(choices, { onPick, cols = 2, read = false } = {}) {
  ensureCSS();
  const items = (Array.isArray(choices) ? choices : []).map(c =>
    (c && typeof c === 'object' && 'value' in c) ? c : { label: typeof c === 'number' ? fmtNum(c) : String(c), value: c });
  const el = h('div', { class: 'choices kit-choices', role: 'group' });
  const n = Math.max(1, Math.min(4, Math.floor(+cols) || 2));
  if (n !== 2) el.style.gridTemplateColumns = 'repeat(' + n + ', minmax(0, 1fr))';
  const buttons = items.map((it, i) => {
    const label = it.label === undefined || it.label === null ? String(it.value) : it.label;
    const long = typeof label === 'string' && label.length > 18;
    return h('button', { type: 'button', class: ['choice', read && 'read', long && 'is-long'], 'data-i': i }, label);
  });
  el.append(...buttons);
  let off = false, lastPick = 0;
  const same = (a, b) => a === b || String(a) === String(b);
  const btnsOf = v => buttons.filter((b, i) => same(items[i].value, v));

  el.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.choice');
    if (!b || !el.contains(b) || off || b.disabled) return;
    if (b.classList.contains('right') || b.classList.contains('wrong')) return;
    const t = nowMs();
    if (t - lastPick < 350) return;
    lastPick = t;
    try { if (typeof onPick === 'function') onPick(items[+b.dataset.i].value, b); } catch (err) { console.error(err); }
  });

  return {
    el, buttons,
    button: v => btnsOf(v)[0] || null,
    mark(v, kind) {
      for (const b of btnsOf(v)) {
        b.classList.remove('right', 'wrong', 'revealed');
        if (kind === 'right' || kind === 'wrong') b.classList.add(kind);
        b.setAttribute('aria-disabled', kind ? 'true' : 'false');
      }
    },
    /* bonne réponse montrée après la 2e erreur : vert + pastille ✓ + petit pop */
    reveal(v) {
      for (const b of btnsOf(v)) {
        b.classList.remove('wrong', 'dim');
        b.classList.add('right', 'revealed');
        b.setAttribute('aria-disabled', 'true');
        motion.pop(b, { scale: 1.06 });
      }
    },
    dimOthers(v) { buttons.forEach((b, i) => b.classList.toggle('dim', !same(items[i].value, v))); },
    disable() { off = true; for (const b of buttons) b.disabled = true; },
    enable() { off = false; for (const b of buttons) b.disabled = false; },
    reset() {
      off = false;
      for (const b of buttons) { b.disabled = false; b.classList.remove('right', 'wrong', 'dim', 'revealed'); b.removeAttribute('aria-disabled'); }
    }
  };
}

/* ============ TOAST ============
   toast(message, ms) : bandeau éphémère en bas de l'écran (un seul à la fois : le suivant remplace le
   précédent). Il ne capte pas les touches (le pavé dessous reste utilisable). → l'élément */
let toastEl = null, toastTimer = 0;
export function toast(msg, ms = 2200) {
  ensureCSS();
  const d = G.document;
  if (!d || !d.body) return null;
  const fresh = !toastEl || !toastEl.isConnected;
  if (fresh) {
    toastEl = h('div', { class: 'toast kit-toast', role: 'status', 'aria-live': 'polite' });
    d.body.appendChild(toastEl);
  }
  const t = toastEl;
  t.classList.remove('is-out');
  t.textContent = String(msg ?? '');
  if (!fresh) motion.pop(t, { scale: 1.05, dur: 260 });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.add('is-out');
    setTimeout(() => {
      if (!t.classList.contains('is-out')) return;
      t.remove();
      if (toastEl === t) toastEl = null;
    }, 240);
  }, Math.max(600, +ms || 2200));
  return t;
}

/* ============ BULLE ============
   bubble(texte, kind = 'hint' | 'soft' | 'good', { icon }) → élément à insérer
   Bulle de dialogue avec une petite pastille (emoji du compagnon, 💡…) ; texte ou nœud ;
   les retours à la ligne du texte sont conservés. icon = chaîne, nœud, ou '' pour aucune. */
const BUBBLE_ICON = { hint: '💡', soft: '🤗', good: '🌟' };
/* « 24 + 24 = 48 » ne se coupe pas en fin de ligne : espaces insécables autour des opérateurs */
const keepMath = s => s.replace(/ ([+−×÷=<>≈]) (?=[\d(…]|$)/g, ' $1\u00A0');   /* insécable APRÈS l'opérateur seulement : jamais un nombre coupé */
export function bubble(text, kind = 'hint', { icon } = {}) {
  ensureCSS();
  const k = BUBBLE_ICON[kind] ? kind : 'hint';
  const ic = icon === undefined ? BUBBLE_ICON[k] : icon;
  const ava = ic ? h('span', { class: 'kit-bubble-ava', 'aria-hidden': 'true' }, ic) : null;
  const body = h('div', { class: 'bubble ' + k + ' kit-bubble-body' }, typeof text === 'string' ? keepMath(text) : text);
  return h('div', { class: 'kit-bubble kit-bubble--' + k + (ava ? '' : ' no-ava'), role: 'status', 'aria-live': 'polite' }, ava, body);
}

/* ============ FEUILLE DU BAS ============
   sheet({ title, content, actions: [{ label, kind, onClick }], dismissable = true, onClose, center })
   → { el, close() }   (close() → Promise résolue quand la feuille a disparu)
   kind = classes de bouton de base.css ('' = ambre, 'pink', 'white', 'ghost', 'big'…).
   onClick(event, api) ; la feuille se ferme ensuite, sauf si onClick renvoie false.
   dismissable : fermeture au fond, par Échap, par la croix ou en glissant vers le bas.
   onClose(raison) : 'action' | 'backdrop' | 'escape' | 'x' | 'swipe' | 'api'.
   center : fenêtre centrée (bilan) au lieu d'une feuille du bas. label : nom accessible si pas de titre.
   Focus piégé dans la feuille, rendu à l'élément d'origine à la fermeture ;
   le reste de l'appli (#app) est inerte pendant ce temps. */
let openSheets = 0, sheetSeq = 0;
const liveSheets = new Set();           /* feuilles ouvertes (fermées d'office à chaque changement d'écran) */
function lockPage(delta) {
  openSheets = Math.max(0, openSheets + delta);
  try {
    G.document.documentElement.classList.toggle('kit-lock', openSheets > 0);
    const app = G.document.getElementById('app');
    if (app) {
      if (openSheets > 0 && !app.hasAttribute('inert')) { app.setAttribute('inert', ''); app.dataset.kitInert = '1'; }
      else if (openSheets === 0 && app.dataset.kitInert) { app.removeAttribute('inert'); delete app.dataset.kitInert; }
    }
  } catch (_) {}
}
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function sheet({ title, content, actions = [], dismissable = true, onClose, center = false, label } = {}) {
  ensureCSS();
  const d = G.document;
  if (!d || !d.body) return { el: null, close: () => Promise.resolve() };
  const prevFocus = d.activeElement;
  const tid = 'kit-sheet-' + ++sheetSeq;
  let closing = null;

  const titleEl = title ? h('h2', { class: 'kit-sheet-title', id: tid }, title) : null;
  const grab = dismissable && !center ? h('div', { class: 'kit-sheet-grab', 'aria-hidden': 'true' }) : null;
  const xBtn = dismissable ? h('button', { type: 'button', class: 'kit-sheet-x', 'aria-label': 'Fermer' }, '✕') : null;
  const body = content === undefined || content === null ? null : h('div', { class: 'kit-sheet-body' }, content);
  const list = (Array.isArray(actions) ? actions : []).filter(Boolean);
  const pair = list.length === 2 && list.every(a => typeof a.label !== 'string' || a.label.length <= 16);
  const acts = list.length ? h('div', { class: 'kit-sheet-actions' + (pair ? ' is-pair' : '') }) : null;
  /* en-tête collant : poignée, croix et titre restent visibles quand le contenu défile */
  const head = grab || xBtn || titleEl ? h('div', { class: 'kit-sheet-head' + (grab ? '' : ' no-grab') + (titleEl ? '' : ' no-title') }, grab, xBtn, titleEl) : null;
  const panel = h('div', {
    class: 'sheet kit-sheet' + (center ? ' is-center' : ''), role: 'dialog', 'aria-modal': 'true',
    'aria-labelledby': titleEl ? tid : null, 'aria-label': !titleEl && label ? String(label) : null, tabindex: '-1'
  }, head, body, acts);
  const ov = h('div', { class: 'overlay kit-overlay' + (center ? ' middle' : '') }, panel);

  const api = { el: panel, close: reason => close(reason) };
  liveSheets.add(api);
  for (const a of list) {
    const kind = a.kind === 'primary' ? '' : a.kind || '';
    const b = h('button', { type: 'button', class: 'btn ' + (pair ? '' : 'block ') + kind }, a.label);
    b.addEventListener('click', ev => {
      if (closing) return;
      let r;
      try { r = typeof a.onClick === 'function' ? a.onClick(ev, api) : undefined; } catch (e) { console.error(e); }
      if (r !== false) close('action');
    });
    acts.appendChild(b);
  }
  if (xBtn) xBtn.addEventListener('click', () => close('x'));

  /* fond : ne ferme que si l'appui a commencé ET fini sur le fond (pas une glissade depuis la feuille) */
  let downOnBackdrop = false;
  ov.addEventListener('pointerdown', e => { downOnBackdrop = e.target === ov; });
  ov.addEventListener('click', e => { if (dismissable && e.target === ov && downOnBackdrop) close('backdrop'); downOnBackdrop = false; });

  const isTop = () => { const all = d.querySelectorAll('.overlay'); return all[all.length - 1] === ov; };
  const onKey = e => {
    if (closing || !isTop()) return;
    if (e.key === 'Escape' && dismissable) { e.preventDefault(); close('escape'); return; }
    if (e.key === 'Tab') {                    /* focus piégé dans la feuille */
      const f = [...panel.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null);
      if (!f.length) { e.preventDefault(); panel.focus(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (d.activeElement === first || d.activeElement === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  d.addEventListener('keydown', onKey, true);

  /* glisser vers le bas pour fermer (poignée et titre) */
  let drag = null;
  const dragZone = t => dismissable && !center && ((grab && grab.contains(t)) || (titleEl && titleEl.contains(t)));
  panel.addEventListener('pointerdown', e => {
    if (closing || !dragZone(e.target)) return;
    drag = { id: e.pointerId, y0: e.clientY, t0: nowMs(), dy: 0 };
    try { panel.setPointerCapture(e.pointerId); } catch (_) {}
  });
  panel.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dy = Math.max(0, e.clientY - drag.y0);
    panel.style.transform = 'translateY(' + drag.dy + 'px)';
  });
  const endDrag = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dy, t0 } = drag;
    drag = null;
    const v = dy / Math.max(1, nowMs() - t0);
    if (dy > 90 || (dy > 24 && v > 0.6)) { close('swipe'); return; }
    panel.style.transform = '';
    if (dy > 0) {
      try { panel.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'translateY(0)' }], { duration: 220, easing: motion.EASE.out }); } catch (_) {}
    }
  };
  panel.addEventListener('pointerup', endDrag);
  panel.addEventListener('pointercancel', endDrag);

  /* ouverture */
  d.body.appendChild(ov);
  lockPage(+1);
  try {
    if (motion.reduced()) {
      ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: motion.DUR.fast, easing: 'ease-out' });
    } else {
      ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
      panel.animate(center
        ? [{ opacity: 0, transform: 'translateY(16px) scale(.94)' }, { opacity: 1, transform: 'none' }]
        : [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }],
      { duration: center ? 340 : 380, easing: center ? motion.EASE.pop : motion.EASE.out });
    }
  } catch (_) {}
  try { panel.focus({ preventScroll: true }); } catch (_) {}

  function close(reason = 'api') {
    if (closing) return closing;
    liveSheets.delete(api);
    d.removeEventListener('keydown', onKey, true);
    closing = (async () => {
      if (reason !== 'nav') try {   /* changement d'écran : retrait immédiat, sans animation */
        const cur = panel.style.transform || 'translateY(0)';
        const anims = motion.reduced()
          ? [ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: motion.DUR.fast, fill: 'forwards' })]
          : [
            ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' }),
            panel.animate(center
              ? [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(12px) scale(.96)' }]
              : [{ transform: cur }, { transform: 'translateY(100%)' }],
            { duration: 220, easing: motion.EASE.in, fill: 'forwards' })
          ];
        await Promise.race([Promise.all(anims.map(a => a.finished.catch(() => {}))), later(400)]);
      } catch (_) {}
      ov.remove();
      lockPage(-1);
      try { if (prevFocus && prevFocus.isConnected && typeof prevFocus.focus === 'function') prevFocus.focus({ preventScroll: true }); } catch (_) {}
      try { if (typeof onClose === 'function') onClose(reason); } catch (e) { console.error(e); }
    })();
    return closing;
  }
  return api;
}

/* confirmation simple → Promise<boolean> (fermer la feuille = non) */
/* ferme toutes les feuilles ouvertes (appelé par le routeur avant chaque changement d'écran) */
export function closeAllSheets(reason = 'nav') {
  for (const s of [...liveSheets]) { try { s.close(reason); } catch (_) {} }
}

export function confirmSheet(text, { ok = 'Oui', cancel = 'Non', title, icon } = {}) {
  return new Promise(resolve => {
    let done = false;
    const fin = v => { if (!done) { done = true; resolve(v); } };
    const content = h('div', { class: 'kit-confirm' },
      icon ? h('div', { class: 'kit-confirm-ico', 'aria-hidden': 'true' }, icon) : null,
      h('p', { class: 'kit-confirm-text' }, text));
    const s = sheet({
      title, content, dismissable: true, label: typeof text === 'string' ? text : null,
      actions: [{ label: cancel, kind: 'white', onClick: () => fin(false) }, { label: ok, onClick: () => fin(true) }],
      onClose: () => fin(false)
    });
    if (!s.el) fin(false);
  });
}

/* ============ CÉLÉBRATIONS ============ */
/* bonne réponse : pop + paillettes + note qui monte avec la série + vibration 20 ms ;
   tous les 5 de suite, une petite gerbe en plus. → Promise résolue après le pop (≈ 340 ms) */
export function celebrateRight(el, streak = 0) {
  const s = Math.max(0, Math.floor(+streak) || 0);
  motion.pop(el, { scale: 1.12 });
  motion.sparkle(el);
  audio.success(s);
  buzz(20);
  if (s >= 5 && s % 5 === 0) motion.burst(el, { count: 14, spread: 70, dur: 700 });
  return later(340);
}
/* erreur : secousse douce + son de bois, jamais de rouge → Promise résolue après la secousse */
export function gentleWrong(el) {
  motion.shake(el);
  audio.soft();
  return later(400);
}

/* ============ ENCOURAGEMENTS ============
   cheer(kind, rng) → phrase au hasard, jamais deux fois la même de suite pour un même type.
   kind : 'right' (juste du premier coup) · 'retry' (après une 1re erreur, avant le nouvel essai) ·
          'helped' (juste avec un indice, le joker ou au 2e essai) · 'learn' (après la bonne réponse
          montrée) · 'end' (fin de manche). rng : objet de makeRng, fonction () → [0 ; 1[, ou rien.
   Formulations neutres en genre ; jamais « faux » ni « raté ». */
const CHEER_SRC = {
  right: [
    'Bravo !', 'Exactement !', 'Tu assures !', 'Super !', 'Génial !', 'Bien joué !', 'Parfait !',
    'C’est ça !', 'Excellent !', 'Dans le mille !', 'Impeccable !', 'Quelle star !', 'Trop bien !',
    'Tu gères !', 'Waouh, bravo !', 'Bonne réponse !'
  ],
  retry: [
    'Presque ! Regarde l’indice…', 'Tu y es presque !', 'Pas tout à fait… Essaie encore !',
    'Bien essayé ! L’indice va t’aider.', 'Tu chauffes ! Encore un petit essai.', 'Prends ton temps, tu vas trouver.',
    'Regarde bien l’indice, tu vas y arriver !', 'Encore un essai, je crois en toi !', 'Pas encore, mais ça vient !',
    'Respire un grand coup et réessaie.', 'Ouvre l’œil, l’indice est là !', 'On réessaie ensemble ?',
    'Ça arrive à tout le monde ! Encore un essai.', 'Courage, tu es sur la bonne piste !'
  ],
  helped: [
    'Voilà, tu as trouvé !', 'Bien rattrapé !', 'Tu vois, tu as réussi !', 'Bravo, tu n’as rien lâché !',
    'Avec l’indice, c’est gagné !', 'Joli rattrapage !', 'Et voilà le travail !', 'Un petit coup de pouce, et hop !',
    'C’est en essayant qu’on apprend !', 'Bien vu, c’est la bonne !', 'Tu as trouvé la bonne piste !',
    'Ça y est, tu l’as !', 'Et hop, c’est trouvé !', 'Bien joué avec l’indice !', 'Belle persévérance !'
  ],
  learn: [
    'Maintenant, tu sais !', 'La prochaine fois, ce sera la bonne !', 'C’est comme ça qu’on apprend.',
    'Retiens bien, ça va resservir !', 'Pas de souci, on reverra ça bientôt.', 'Tu sauras la prochaine fois !',
    'On apprend en essayant !', 'Chaque essai te fait progresser !', 'Bien regardé, on continue !',
    'Une de plus dans ta tête !', 'Garde ça en tête, et on avance !', 'Tu l’auras la prochaine fois !',
    'On continue, tu progresses !'
  ],
  end: [
    'Quelle belle manche !', 'Tu as bien travaillé !', 'Bravo pour cette partie !', 'Mission accomplie !',
    'Belle partie, bravo !', 'Ton cerveau a bien travaillé !', 'Encore une manche dans la poche !',
    'Tu progresses à chaque partie !', 'Super boulot !', 'C’était chouette de jouer avec toi !',
    'Tu as fait du beau travail !', 'Waouh, quelle énergie !', 'Bien joué, tu as tout donné !',
    'Une manche de plus, bravo !', 'Quel beau travail !'
  ]
};
/* typographie française appliquée une fois pour toutes (espaces fines avant ! ? ; :) */
export const CHEERS = Object.freeze(Object.fromEntries(
  Object.entries(CHEER_SRC).map(([k, list]) => [k, Object.freeze(list.map(frTypo))])));
const lastCheer = {};
export function cheer(kind = 'right', rng) {
  const k = CHEERS[kind] ? kind : 'right';
  const list = CHEERS[k];
  const r = typeof rng === 'function' ? rng
    : rng && typeof rng.next === 'function' ? () => rng.next()
      : Math.random;
  const n = list.length;
  let i = Math.min(n - 1, Math.floor(r() * n));
  if (n > 1 && i === lastCheer[k]) i = (i + 1 + Math.min(n - 2, Math.floor(r() * (n - 1)))) % n;
  lastCheer[k] = i;
  return list[i];
}
