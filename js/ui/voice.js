/* ============ LA VOIX DU COMPAGNON (CDC §1 principe 7 : « icônes et voix plutôt que lecture ») ============
   Lecture à voix haute des consignes, des indices et des phrases du compagnon, pour les petits lecteurs.
   Réglage des parents settings.readAloud (espace parents › « Lire les consignes à voix haute ») :
     'auto' (défaut) = CP et CE1 · 'on' = toujours · 'off' = jamais (anciens booléens acceptés).
   Le texte reste TOUJOURS affiché (CDC §16). Rien n'est lu : son coupé, aucune voix française sur l'appareil, avant le
   premier geste de la page (le navigateur refuserait), ni pendant que le micro écoute (le moteur vocal n'entend que
   l'enfant : js/core/speech.js n'est que LU, jamais modifié).
   API :
     readAloud(profil) → booléen (réglage résolu pour ce profil)
     voiceOn(profil) → booléen : readAloud ET une voix française possible
     speakable(texte) → texte à dire (emoji porteurs de sens en mots, × → « fois », ÷ → « divisé par »…)
     speak(texte, { force }) → Promise<boolean> : lit si c'est permis ; force = geste explicite sur 🔊 (lit même si le
       réglage est « jamais », jamais micro ouvert)
     hush() : coupe la voix (changement d'écran, réponse donnée)
     listenButton(get, { label }) → bouton 🔊 rond de 48 px qui relit get() ; classe is-speaking pendant la lecture */

import { h, frTypo } from '../core/util.js';
import * as tts from '../core/tts.js';
import * as speech from '../core/speech.js';
import * as audio from '../core/audio.js';
import { getProfile } from '../core/store.js';

export function readAloud(profile) {
  const v = profile && profile.settings && profile.settings.readAloud;
  if (v === 'on' || v === true) return true;
  if (v === 'off' || v === false) return false;
  return !!profile && (profile.classe === 'CP' || profile.classe === 'CE1');
}
export function voiceOn(profile = getProfile()) {
  try { return readAloud(profile) && tts.ttsAvailable(); } catch (_) { return false; }
}

const FIX = [[/×/g, ' fois '], [/÷/g, ' divisé par '], [/−/g, ' moins '], [/(\d)\s*\+\s*(?=\d)/g, '$1 plus '], [/ = /g, ' égale '], [/≈/g, ' environ '],
  /* « … » d'une phrase à trou (orchestre) : une courte pause au milieu de la phrase, un point à la fin */
  [/\s*…\s*(?=[\p{Ll}\d])/gu, ', '], [/…/g, '. ']];
/* les emoji qui portent le sens se disent (« 20 🍎 » → « 20 pommes »), les autres se taisent */
const EMOJI = [
  [/(\d[\d\u202f\u00a0]*)\s*🍎/gu, (m, n) => n + (Number(n.replace(/\D/g, '')) > 1 ? ' pommes' : ' pomme')],
  [/🍎/gu, ' pomme '], [/🎤/gu, ' le micro '], [/⭐/gu, ' étoiles '], [/🥕/gu, ' la carotte ']
];
export function speakable(s) {
  let t = String(s ?? '');
  for (const [re, w] of EMOJI) t = t.replace(re, w);
  t = t.replace(/[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]/gu, ' ');
  for (const [re, w] of FIX) t = t.replace(re, w);
  return t.replace(/[▸➜→✓]/g, ' ').replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1')
    .replace(/([.,!?])(?:\s*[.,])+/g, '$1').replace(/^[\s.,]+/, '').trim();
}

/* la page a-t-elle déjà reçu un geste ? (sans geste, Chrome et Safari refusent la synthèse vocale) */
const activated = () => {
  try { const ua = globalThis.navigator && globalThis.navigator.userActivation; return !ua || !!ua.hasBeenActive; } catch (_) { return true; }
};
const micOpen = () => { try { return !!speech.isListening(); } catch (_) { return false; } };

let speakingBtn = null;
let seq = 0;
export function speak(text, { force = false } = {}) {
  const t = speakable(text);
  if (!t) return Promise.resolve(false);
  if (!force && !voiceOn()) return Promise.resolve(false);
  if (audio.isMuted() && !force) return Promise.resolve(false);
  if (micOpen() || !activated()) return Promise.resolve(false);
  const my = ++seq;
  let p;
  try { p = tts.speak(t); } catch (_) { p = Promise.resolve(false); }
  return Promise.resolve(p).then(ok => (my === seq ? ok : false), () => false);
}
export function hush() {
  seq++;
  try { tts.stopSpeaking(); } catch (_) {}
  if (speakingBtn) { speakingBtn.classList.remove('is-speaking'); speakingBtn = null; }
}

/* bouton 🔊 (48 px) : relit le texte du moment ; micro ouvert → il le dit gentiment au lieu de lire */
export function listenButton(get, { label = 'Écouter' } = {}) {
  const b = h('button', { type: 'button', class: 'vx-listen', 'aria-label': label },
    h('span', { class: 'vx-wave', 'aria-hidden': 'true' }), h('span', { class: 'vx-ico', 'aria-hidden': 'true' }, '🔊'));
  b.addEventListener('click', () => {
    const text = typeof get === 'function' ? get() : '';
    if (!text) return;
    if (micOpen()) {
      import('./kit.js').then(k => k.toast(frTypo('Le micro t’écoute : coupe-le 🎤 pour m’entendre.'))).catch(() => {});
      return;
    }
    try { audio.tap(); } catch (_) {}
    if (speakingBtn && speakingBtn !== b) speakingBtn.classList.remove('is-speaking');
    speakingBtn = b;
    b.classList.add('is-speaking');
    speak(text, { force: true }).then(() => {
      if (speakingBtn === b) { b.classList.remove('is-speaking'); speakingBtn = null; }
    });
  });
  return b;
}
