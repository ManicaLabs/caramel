/* ============ « CARAMEL DÉMÉNAGE ! 🏡 » (#/demenagement, v2.4) — ancienne adresse seulement ============
   Règles et paquet : js/core/move.js. Montré sur l'ancienne adresse quand le déménagement est allumé (js/main.js
   aiguille tous les écrans ici, sauf l'espace parents ; « Plus tard » rend l'appli comme avant pour la séance).
   « Un seul gros bouton » : le compagnon parle (phrase écrite et dite), UN bouton, une note discrète pour l'adulte.
     - pas encore déménagé : « On déménage ▶ » — la nouvelle adresse doit répondre (sinon : « Il faut Internet… »,
       et « Jouer ici en attendant ») ; les progrès partent dans l'adresse (après le #), rien n'est effacé ici ;
     - déjà fait : « Ouvrir Caramel ▶ » (la nouvelle adresse), et « Renvoyer mes progrès » pour l'adulte. */
import { h, clear, frTypo, loadCSS } from '../core/util.js';
import * as store from '../core/store.js';
import * as router from '../router.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import * as voice from './voice.js';
import * as mv from '../core/move.js';
import { petReady, putPet } from './famille.js';

const G = globalThis;
export const TEXT = Object.freeze({
  go: 'Je déménage ! Viens avec moi : tes progrès et tes pommes viennent aussi.',
  done: 'Ma nouvelle maison est prête ! Viens me retrouver là-bas.',
  offline: 'Il faut Internet pour déménager. On réessaiera plus tard !',
  wait: 'Je fais mes cartons…'
});
const hostOf = u => { try { return new URL(u).host; } catch (_) { return u; } };

let st = null;
export default {
  async mount(root) {
    await Promise.all([loadCSS('css/ui/move.css'), petReady()]);
    if (!root.isConnected) return;
    teardown();
    const my = st = { root, timers: new Set(), dead: false };
    const p = store.getProfile();
    const hasData = store.listProfiles().length > 0;
    const isDone = !!mv.moved() || !hasData;
    const to = mv.target();

    const pic = h('span', { class: 'mv-pet', 'aria-hidden': 'true' });
    if (p) putPet(pic, p, 150, '', { expr: 'delighted', live: true }); else pic.textContent = '🏡';
    let said = isDone ? TEXT.done : TEXT.go;
    const line = h('p', { class: 'mv-say' }, frTypo(said));
    const listen = voice.listenOn(p) ? voice.listenButton(() => said, { label: 'Écouter' }) : null;
    const say = t => { said = t; line.textContent = frTypo(t); voice.speak(t); };

    const go = h('button', { type: 'button', class: 'btn play big block mv-go' },
      h('span', null, isDone ? 'Ouvrir Caramel' : 'On déménage'), h('span', { class: 'btn-play-ico', 'aria-hidden': 'true' }, '▶'));
    const stay = h('button', { type: 'button', class: 'btn ghost mv-later', hidden: true }, 'Jouer ici en attendant');   /* sans Internet */
    const again = h('button', { type: 'button', class: 'btn ghost mv-again', hidden: isDone && hasData ? null : true }, 'Renvoyer mes progrès');
    const later = h('button', { type: 'button', class: 'btn ghost mv-later2' }, 'Plus tard');

    async function leave(open) {
      if (go.disabled) return;
      audio.tap();
      go.disabled = true;
      const prev = said;
      if (!open) { said = TEXT.wait; line.textContent = frTypo(TEXT.wait); }
      const ok = await mv.reachable(to);
      if (my.dead) return;
      if (!ok) { go.disabled = false; stay.hidden = false; say(TEXT.offline); return; }
      const url = open ? to : await mv.leave();
      if (my.dead) return;
      if (!url) { go.disabled = false; said = prev; line.textContent = frTypo(prev); return; }
      G.location.href = url;
    }
    go.addEventListener('click', () => { motion.pop(go, { scale: 1.03 }); leave(isDone); });
    again.addEventListener('click', () => leave(false));
    const play = () => { audio.tap(); mv.later(); router.go('home', { replace: true }); };
    stay.addEventListener('click', play);
    later.addEventListener('click', play);

    const parents = h('a', { href: '#/parents', class: 'mv-parents' }, '🔒 Espace parents');
    const note = h('p', { class: 'mv-note' }, frTypo('Pour l’adulte : Caramel a une nouvelle adresse, ' + hostOf(to) +
      '. Rien n’est effacé ici. Là-bas, installez Caramel sur l’écran d’accueil (📲), puis supprimez l’ancienne icône. ' +
      'iPhone ou iPad avec Caramel sur l’écran d’accueil : faites plutôt une sauvegarde dans l’espace parents, puis ouvrez-la là-bas.'), ' ', parents);

    const screen = h('main', { class: 'mv' },
      h('h1', { class: 'sr-only' }, 'Caramel déménage'),
      h('div', { class: 'mv-scene' }, pic, h('span', { class: 'mv-house', 'aria-hidden': 'true' }, '🏡')),
      h('div', { class: 'mv-say-box' }, line, listen),
      go, stay, again, later, note);
    clear(root);
    root.appendChild(screen);
    const t = setTimeout(() => { my.timers.delete(t); if (!my.dead) voice.speak(said); }, motion.reduced() ? 120 : 380);
    my.timers.add(t);
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
  try { voice.hush(); } catch (_) {}
}
