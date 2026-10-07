/* ============ BARRE DE PRÉCHARGEMENT « Je prépare ma voix et mes oreilles… 42 % » (v2.2.3) ============
   La petite barre commune, simple et discrète, de js/core/preload.js (demande du parent du 06/10/2026 : tout se
   télécharge à la première ouverture, une barre le temps qu'on configure le profil) : pendant la création du profil
   (js/ui/onboarding.js, sous les pastilles d'étapes) puis sur l'accueil (js/ui/home.js, sous l'en-tête) tant que ce
   n'est pas fini. L'adulte configure, l'enfant regarde : une ligne de texte et un trait de progression, rien à toucher.
     - en cours : « Je prépare ma voix et mes oreilles… 42 % » (« … presque fini ! » quand tout est arrivé et que le
       moteur du micro s'installe ; « ma voix » ou « mes oreilles » seules quand une seule part se télécharge) ; montrée
       seulement si ça dure (SHOW_DELAY_MS : pas d'éclair quand il ne reste qu'un petit travail) ;
     - fini (vu en cours ici) : « Voix et micro prêts ✓ » quelques secondes (dit une fois aux lecteurs d'écran), puis
       plus rien ;
     - données mobiles, économie de données : UN bouton pour l'adulte, « Télécharger maintenant (≈ 97 Mo) » ;
     - hors ligne, rien à faire : rien.
   La progression n'est pas une zone annoncée (pas de bavardage à chaque pour cent).
   barModel(status) → { kind: 'run' | 'ask' | 'done' | null, text, pct, button, label } (PUR, testé) ;
   preloadBar() → { el, shown, destroy() } ; cssReady(). L'accueil fait sa place à la barre en CSS (:has). */
import { h, frTypo, loadCSS } from '../core/util.js';
import * as preload from '../core/preload.js';
import * as audio from '../core/audio.js';

const CSS = 'css/ui/preload.css';
export const cssReady = () => loadCSS(CSS);
const NNBSP = '\u202f';
export const SHOW_DELAY_MS = 700;
export const DONE_MS = 3500;

/* état du préchargement → ce que la barre montre (pur) */
export function barModel(st = {}) {
  const p = st.parts || {};
  const both = !!p.vosk === !!p.fluid;                                 /* les deux (ou rien de précis) */
  const none = { kind: null, text: '', pct: null, button: '', label: '' };
  switch (st.state) {
    case 'running': {
      const what = both ? 'ma voix et mes oreilles' : p.fluid ? 'ma voix' : 'mes oreilles';
      const pct = Number.isFinite(st.pct) ? Math.max(0, Math.min(99, Math.floor(st.pct))) : null;
      const tail = pct === null ? '' : pct >= 99 ? ' presque fini !' : ' ' + pct + NNBSP + '%';
      return { ...none, kind: 'run', text: frTypo('Je prépare ' + what + '…' + tail), pct,
        label: frTypo('Je prépare ' + what) };
    }
    case 'done':
      return { ...none, kind: 'done', pct: 100, text: frTypo(both ? 'Voix et micro prêts ✓' : p.fluid ? 'Voix prête ✓' : 'Micro prêt ✓') };
    case 'ask': {
      const button = 'Télécharger maintenant (' + preload.sizeOf(st.bytes) + ')';
      const what = both ? 'la voix et le micro' : p.fluid ? 'la voix' : 'le micro';
      return { ...none, kind: 'ask', button, label: button + ' : ' + what + ' de Caramel, une seule fois' };
    }
    default:
      return none;
  }
}

/* la barre (vide et cachée tant qu'il n'y a rien à montrer) */
export function preloadBar() {
  const text = h('span', { class: 'pl-t' });
  const fill = h('span', { class: 'pl-fill' });
  const track = h('span', { class: 'pl-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, fill);
  const btn = h('button', { type: 'button', class: 'btn small white pl-btn', hidden: true });
  const sr = h('span', { class: 'sr-only', role: 'status' });
  const el = h('div', { class: 'pl', hidden: true }, text, track, btn, sr);
  let shown = false, seen = false, kind = null, showTimer = 0, doneTimer = 0, outTimer = 0, alive = true;

  btn.addEventListener('click', () => {
    try { audio.tap(); } catch (_) {}
    btn.disabled = true;                                                /* un seul geste ; la barre passe en cours */
    preload.start({ by: 'parent' }).catch(() => {}).then(() => { btn.disabled = false; });
  });

  const toggle = v => {
    if (v === shown) return;
    shown = v;
    el.hidden = !v;
    if (!v) el.classList.remove('is-out');
  };
  const hideSoon = () => {
    clearTimeout(doneTimer);
    doneTimer = setTimeout(() => {
      if (!alive || kind !== 'done') return;
      el.classList.add('is-out');
      outTimer = setTimeout(() => { if (alive && kind === 'done') toggle(false); }, 420);
    }, DONE_MS);
  };
  function paint(m) {
    el.className = 'pl' + (m.kind ? ' is-' + m.kind : '') + (m.kind === 'run' && m.pct === null ? ' is-busy' : '');
    text.hidden = m.kind === 'ask';
    track.hidden = m.kind === 'ask';
    btn.hidden = m.kind !== 'ask';
    text.textContent = m.text;
    if (m.kind === 'ask') {
      btn.textContent = m.button;
      btn.setAttribute('aria-label', frTypo(m.label));
    }
    if (m.kind === 'run' || m.kind === 'done') {
      fill.style.width = m.pct === null ? '' : m.pct + '%';
      track.setAttribute('aria-label', m.kind === 'done' ? m.text : m.label);
      if (m.pct === null) { track.removeAttribute('aria-valuenow'); track.removeAttribute('aria-valuetext'); }
      else { track.setAttribute('aria-valuenow', String(m.pct)); track.setAttribute('aria-valuetext', m.pct + NNBSP + '%'); }
    }
  }
  function render(st, first = false) {
    if (!alive) return;
    const m = barModel(st);
    const was = kind;
    kind = m.kind;
    clearTimeout(outTimer);
    if (m.kind !== 'done') { clearTimeout(doneTimer); sr.textContent = ''; }
    if (m.kind === 'run' || m.kind === 'ask') {
      paint(m);
      if (shown) { el.classList.remove('is-out'); return; }
      /* déjà en cours à l'arrivée de l'écran (la même barre qui continue), ou l'adulte a la main : tout de suite ;
         sinon seulement si ça dure */
      if (first || m.kind === 'ask') { seen = true; toggle(true); return; }
      if (!showTimer) {
        showTimer = setTimeout(() => {
          showTimer = 0;
          if (alive && (kind === 'run' || kind === 'ask')) { seen = true; toggle(true); }
        }, SHOW_DELAY_MS);
      }
      return;
    }
    clearTimeout(showTimer); showTimer = 0;
    if (m.kind === 'done' && seen && shown) {
      paint(m);
      if (was !== 'done') { sr.textContent = m.text; hideSoon(); }
      return;
    }
    toggle(false);
  }
  render(preload.status(), true);
  const off = preload.onChange(st => render(st));
  return {
    el,
    get shown() { return shown; },
    destroy() {
      alive = false;
      off();
      clearTimeout(showTimer); clearTimeout(doneTimer); clearTimeout(outTimer);
    }
  };
}
