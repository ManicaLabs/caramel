/* ============ 🔊 / 🔇 : COUPER ET REMETTRE LE SON (v2.4, retour du parent du 07/10/2026) ============
   « Il faudrait avoir l'icône de la petite enceinte toujours accessible afin de pouvoir couper / remettre le son de
   l'application. » Décision du parent : 🔊 / 🔇 en haut de l'accueil (js/ui/home.js) et de chaque jeu
   (js/ui/game-header.js), toujours à la même place ; « Écouter encore » prend l'icône 🔁 (js/ui/voice.js) pour ne pas
   confondre les deux enceintes.
   Un toucher bascule settings.sound de l'enfant actif : le même réglage que « Sons » de l'espace parents, gardé d'une
   fois sur l'autre ; js/main.js l'applique (audio.setMuted, à chaque écriture du store). Sons coupés : tout se tait
   tout de suite, la voix comprise, et 🔁 disparaît (voice.listenOn). Aucun enfant actif : le bouton reste caché.
   API : soundOn(profil?) → booléen ; toggleSound() → nouvel état ; soundButton({ cls, onChange }) → bouton qui se
   redessine à chaque écriture du store (onChange(on) quand l'état change) et se désabonne une fois retiré de la page. */
import { h } from '../core/util.js';
import * as store from '../core/store.js';
import * as audio from '../core/audio.js';
import { hush } from './voice.js';

export const soundOn = (p = store.getProfile()) => !(p && p.settings && p.settings.sound === false);

export function toggleSound() {
  const p = store.getProfile();
  if (!p) return true;
  const on = !soundOn(p);
  if (!on) hush();                                     /* la voix en cours se tait avec le reste */
  try { audio.setMuted(!on); } catch (_) {}            /* tout de suite (main.js le refait à l'écriture) */
  store.mutateProfile(q => { if (!q.settings || typeof q.settings !== 'object') q.settings = {}; q.settings.sound = on; });
  if (on) { try { audio.tap(); } catch (_) {} }       /* le son revient : on l'entend */
  return on;
}

export function soundButton({ cls = '', onChange } = {}) {
  const ico = h('span', { class: 'snd-ico', 'aria-hidden': 'true' });
  const b = h('button', { type: 'button', class: ('snd-btn ' + cls).trim() }, ico);
  let shown = null, seen = false, unsub = null;
  const paint = () => {
    if (b.isConnected) seen = true;
    else if (seen) { if (unsub) unsub(); unsub = null; return; }
    const p = store.getProfile();
    b.hidden = !p;
    const on = soundOn(p);
    if (on === shown) return;
    shown = on;
    ico.textContent = on ? '🔊' : '🔇';
    b.setAttribute('aria-label', on ? 'Couper le son' : 'Remettre le son');
    b.classList.toggle('is-off', !on);
    if (onChange) { try { onChange(on); } catch (e) { console.error(e); } }
  };
  b.addEventListener('click', () => { toggleSound(); paint(); });
  unsub = store.subscribe(paint);
  paint();
  return b;
}
