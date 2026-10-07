/* ============ VOIX FLUIDE : LIGNE DE L'ESPACE PARENTS (v2.2.2) ============
   Espace parents › Réglages › « Sur cet appareil » › « Voix fluide » (vouvoiement) : ce qu'elle apporte, son poids
   (≈ 45 Mo, Wi-Fi conseillé), son état sur CET appareil (js/core/voice-fluid.js) et les gestes possibles :
   Télécharger, Arrêter / Reprendre, ▶ Écouter (une phrase au prénom de l'enfant actif), Refaire l'essai de vitesse (trop
   lente), Supprimer (confirmation).
   Aucune fenêtre côté enfant : la voix fluide se télécharge d'elle-même dès la première ouverture (v2.2.3,
   js/core/preload.js), sauf en données mobiles (l'adulte la lance ici, ou par « Télécharger maintenant » de la barre de
   l'accueil), sur un appareil modeste ou après « Supprimer » (ici seulement). L'état s'affiche sans être annoncé ; seul
   le résultat d'un geste du parent l'est (say).
   La barre de progression (<progress>, nommée) n'est pas une zone annoncée : pas de bavardage à chaque pour cent.
   rowModel(status) → { text, on, buttons, note, pct } (PUR, testé) ; parentsRow({ say, saved }) → la ligne. */
import { h, clear, frTypo } from '../core/util.js';
import * as fluid from '../core/voice-fluid.js';
import * as audio from '../core/audio.js';
import { getProfile } from '../core/store.js';
import { fillTemplate } from '../core/profiles.js';
import * as kit from './kit.js';
import * as voice from './voice.js';

const NB = '\u00a0';
export const HELP = 'Le compagnon dit d’un seul tenant les calculs, les explications et le prénom de l’enfant, avec la même voix. '
  + 'Téléchargée une fois (' + fluid.SIZE_LABEL + ', Wi-Fi conseillé), elle fonctionne ensuite sans internet.';
const OTHER_VOICES = 'le compagnon garde sa voix enregistrée et celle du téléphone';

/* état → ce que la ligne montre (pur) */
export function rowModel(st = {}) {
  const pct = st.progress && st.progress.total > 0 ? Math.max(0, Math.min(100, Math.floor(st.progress.loaded / st.progress.total * 100))) : 0;
  const m = (text, buttons = [], extra = {}) => ({ text: frTypo(text), buttons, on: false, note: '', pct, ...extra });
  switch (st.state) {
    case 'unsupported':
      return m('Ce navigateur ne peut pas la faire fonctionner : ' + OTHER_VOICES + '.'
        + (st.device === 'ios' ? ' Sur iPhone et iPad, il faut iOS 16.4 ou plus récent.' : ''));
    case 'absent': {
      const note = st.net === 'cellular' ? 'Données mobiles détectées : mieux vaut attendre le Wi-Fi.'
        : st.net === 'save-data' ? 'Économie de données activée : mieux vaut attendre le Wi-Fi.'
          : st.net === 'offline' ? 'Pas de connexion internet pour l’instant.' : '';
      return m(st.removed ? 'Supprimée de cet appareil.' : 'Pas encore téléchargée.', ['download'], { note: frTypo(note) });
    }
    case 'downloading':
      return m('Téléchargement… ' + pct + NB + '%', ['stop'], { progress: true, note: frTypo('Il continue si vous quittez cet écran ; un jeu l’interrompt.') });
    case 'paused':
      return m('Téléchargement interrompu.', ['resume', 'remove']);
    case 'cached':
      return m(st.held ? 'Téléchargée ✓ En pause pendant que le micro écoute.'
        : st.parked ? 'Téléchargée ✓ En pause : le micro occupe la mémoire de cet appareil. Elle revient à la prochaine ouverture de Caramel.'
          : 'Téléchargée ✓ Elle se met en route en arrière-plan.', ['remove'], { on: true });
    case 'starting':
      return m('Téléchargée ✓ Mise en route…', ['remove'], { on: true });
    case 'calibrating':
      return m('Téléchargée ✓ Essai de vitesse sur cet appareil…', ['remove'], { on: true });
    case 'ready':
      return m('Prête ✓', ['listen', 'remove'], { on: true });
    case 'slow':
      return m('Trop lente sur cet appareil : ' + OTHER_VOICES + '. Nouvel essai automatique à la prochaine version de Caramel.', ['recheck', 'remove']);
    case 'error': {
      const e = st.error;
      if (e === 'offline') return m('Pas de connexion internet. Réessayez une fois connecté.', ['retry']);
      if (e === 'space') return m('Pas assez de place sur cet appareil : libérez environ 200' + NB + 'Mo, puis réessayez.', ['retry']);
      if (e === 'storage') return m('Ce navigateur ne peut pas la garder (navigation privée ?).', []);
      if (e === 'boot') return m('Elle n’a pas pu démarrer sur cet appareil.', ['retry', 'remove']);
      return m('Le téléchargement a échoué. Vérifiez la connexion, puis réessayez.', ['retry']);
    }
    default:
      return m('Vérification…', []);
  }
}

const label = (emo, text) => h('span', { class: 'pa-lbl' }, emo ? h('span', { class: 'pa-lbl-emo', 'aria-hidden': 'true' }, emo + NB) : null, text);
/* phrase d'essai : le prénom de l'enfant actif et un calcul, d'un seul tenant */
const sample = () => {
  const q = getProfile();
  return frTypo(q ? fillTemplate('Bonjour {P} ! 38 + 25 = 63.', q) : 'Bonjour ! 38 + 25 = 63.');
};

export function parentsRow({ say = () => {}, saved = null } = {}) {
  const state = h('p', { class: 'pa-dev-state' });
  const bar = h('progress', { class: 'pa-vf-prog', max: '100', value: '0', 'aria-label': 'Téléchargement de la voix fluide', hidden: true });
  const acts = h('div', { class: 'pa-dev-acts' });
  const note = h('p', { class: 'pa-help pa-vf-note', hidden: true });
  const help = h('p', { class: 'pa-help' }, frTypo(HELP));
  const row = h('div', { class: 'pa-row pa-vfluid' }, h('div', { class: 'pa-row-label' }, 'Voix fluide'), state, bar, acts, note, help);
  const tell = msg => { try { (saved || say)(msg); } catch (_) {} };
  let prev = null, listening = false;

  const BTN = {
    download: () => btn('download', label('⬇', 'Télécharger (' + fluid.SIZE_LABEL + ')'), false, () => {
      say(frTypo('Téléchargement de la voix fluide lancé.'));
      fluid.download({ by: 'parent' });
    }),
    resume: () => btn('resume', label('⬇', 'Reprendre le téléchargement'), false, () => {
      say(frTypo('Téléchargement de la voix fluide repris.'));
      fluid.download({ by: 'parent' });
    }),
    retry: () => btn('retry', label('🔄', 'Réessayer'), false, () => { fluid.retry(); }),
    recheck: () => btn('recheck', label('🔄', 'Refaire l’essai de vitesse'), false, () => { fluid.retry(); }),
    stop: () => btn('stop', label('', 'Arrêter le téléchargement'), true, () => { fluid.cancelDownload({ byParent: true }); say(frTypo('Téléchargement arrêté.')); }),
    listen: () => btn('listen', label('▶', 'Écouter'), true, async () => {
      if (listening) return;
      listening = true;
      let r = null;
      try { r = await voice.testFluid(sample()); } catch (_) { r = null; }
      listening = false;
      if (!r || !r.ok) {
        const why = r && r.reason === 'mic' ? 'Le micro écoute en ce moment : la voix attend qu’il s’arrête.'
          : 'La voix fluide n’a pas pu parler. Montez le volume, puis réessayez.';
        try { kit.toast(frTypo(why), 2600); } catch (_) {}
        say(frTypo(why));
      }
    }),
    remove: () => btn('remove', 'Supprimer', 'ghost', async () => {
      const ok = await kit.confirmSheet(frTypo('Supprimer la voix fluide ? Cela libère environ 45' + NB + 'Mo ; ' + OTHER_VOICES
        + '. Vous pourrez la retélécharger ici.'), { ok: 'Supprimer', cancel: 'Garder', icon: '🗑️' });
      if (!ok) return;
      await fluid.remove();
      tell('Voix fluide supprimée');
      /* le bouton touché a disparu : le focus va au geste suivant (« Télécharger »), une fois la feuille refermée */
      setTimeout(() => {
        if (!row.isConnected || row.contains(document.activeElement)) return;
        const next = acts.querySelector('button');
        if (next) { try { next.focus({ preventScroll: true }); } catch (_) {} }
      }, 400);
    })
  };
  function btn(fk, content, kind, onClick) {
    const cls = 'btn small' + (kind === 'ghost' ? ' ghost' : kind ? ' white' : '');
    const b = h('button', { type: 'button', class: cls, 'data-fk': 'vfluid-' + fk }, content);
    b.addEventListener('click', () => { try { audio.tap(); } catch (_) {} onClick(); });
    return b;
  }

  function render(st) {
    const mo = rowModel(st);
    /* le focus clavier reste sur le bouton équivalent ; s'il disparaît, il passe sur l'état (qui dit la suite) */
    const had = row.contains(document.activeElement) ? document.activeElement.getAttribute('data-fk') : null;
    state.textContent = mo.text;
    state.classList.toggle('is-on', mo.on);
    bar.hidden = !mo.progress;
    if (mo.progress) bar.value = mo.pct;
    note.hidden = !mo.note;
    note.textContent = mo.note || '';
    const keys = mo.buttons.join(',');
    if (acts.getAttribute('data-keys') !== keys) {
      clear(acts);
      for (const k of mo.buttons) acts.appendChild(BTN[k]());
      acts.setAttribute('data-keys', keys);
      if (had) {
        const same = acts.querySelector('[data-fk="' + had + '"]');
        if (same) { try { same.focus({ preventScroll: true }); } catch (_) {} }
        else { state.tabIndex = -1; try { state.focus({ preventScroll: true }); } catch (_) {} }
      }
    }
    /* résultats d'un téléchargement suivi ici : annoncés une fois */
    if (prev === 'downloading' && st.state !== 'downloading') {
      if (['cached', 'starting', 'calibrating', 'ready'].includes(st.state)) tell('Voix fluide téléchargée ✓');
      else if (st.state === 'error') say(mo.text);
    }
    if (prev && prev !== 'ready' && st.state === 'ready' && prev !== 'downloading') say(frTypo('Voix fluide prête ✓'));
    if (prev && prev !== 'slow' && st.state === 'slow') say(mo.text);
    prev = st.state;
  }
  render(fluid.status());
  /* abonnement : jusqu'à ce que la ligne, une fois affichée, quitte l'écran */
  let mounted = false;
  const off = fluid.onChange(st => {
    if (row.isConnected) mounted = true;
    else if (mounted) { off(); return; }
    render(st);
  });
  fluid.refresh().then(render).catch(() => {});
  return row;
}
