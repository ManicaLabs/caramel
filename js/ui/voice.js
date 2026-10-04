/* ============ LA VOIX DU COMPAGNON (CDC §1 principe 7 : « icônes et voix plutôt que lecture ») ============
   Lecture à voix haute des consignes, des indices et des phrases du compagnon, pour les petits lecteurs.
   Réglage des parents settings.readAloud (espace parents › « Lire les consignes à voix haute ») :
     'auto' (défaut) = CP et CE1 · 'on' = toujours · 'off' = jamais (anciens booléens acceptés).
   Le texte reste TOUJOURS affiché (CDC §16). Rien n'est lu : sons coupés, aucune voix française sur l'appareil, avant le
   premier geste de la page (le navigateur refuserait), ni pendant que le micro écoute (le moteur vocal n'entend que
   l'enfant : js/core/speech.js n'est que LU, jamais modifié). La voix se tait quand la page passe en arrière-plan.
   🔊 n'est jamais muet (v2.2.1) : si la synthèse échoue (aucun son n'est sorti), la voix est notée « en panne » pour la
   séance : html.vx-quiet rend les 🔊 discrets ; un 🔊 touché qui échoue le dit UNE fois (toast), et l'espace parents
   propose « ▶ Tester la voix » (test()) avec la marche à suivre. Une lecture réussie efface la panne.
   API :
     readAloud(profil) → booléen (réglage résolu pour ce profil)
     voiceOn(profil) → booléen : readAloud ET sons activés ET une voix française possible
     speakable(texte) → texte à dire (emoji porteurs de sens en mots, × → « fois », ÷ → « divisé par »…)
     speak(texte, { force }) → Promise<boolean> : lit si c'est permis ; force = geste explicite (🔊, « Tester la voix ») :
       lit même si le réglage est « jamais » ou les sons coupés, jamais micro ouvert
     hush() : coupe la voix (changement d'écran, réponse donnée) ; settle() → Promise : la voix s'est tue et le moteur a
       repris son souffle (à attendre avant d'ouvrir le micro)
     health() → 'unknown' | 'ok' | 'broken' ; needsGesture() → vrai tant que la page n'a reçu aucun geste (rien ne peut
       être dit : l'appelant redit sa phrase au premier geste, ex. la visite guidée)
     test(texte?) → Promise<{ ok, reason, diag }> : essai explicite pour l'espace parents (diag : tts.diagnose())
     listenButton(get, { label }) → bouton 🔊 rond de 48 px qui relit get() ; classe is-speaking pendant la lecture */

import { h, frTypo } from '../core/util.js';
import * as tts from '../core/tts.js';
import * as speech from '../core/speech.js';
import * as audio from '../core/audio.js';
import { getProfile } from '../core/store.js';
import * as kit from './kit.js';

export function readAloud(profile) {
  const v = profile && profile.settings && profile.settings.readAloud;
  if (v === 'on' || v === true) return true;
  if (v === 'off' || v === false) return false;
  return !!profile && (profile.classe === 'CP' || profile.classe === 'CE1');
}
const soundOn = profile => !(profile && profile.settings && profile.settings.sound === false);
export function voiceOn(profile = getProfile()) {
  try { return readAloud(profile) && soundOn(profile) && !audio.isMuted() && tts.ttsAvailable(); } catch (_) { return false; }
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
  return t.replace(/[▸➜→✓›]/g, ' ').replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1')
    .replace(/([.,!?])(?:\s*[.,])+/g, '$1').replace(/^[\s.,]+/, '').trim();
}

/* la page a-t-elle déjà reçu un geste ? (sans geste, Chrome et Safari refusent la synthèse vocale) */
const activated = () => {
  try { const ua = globalThis.navigator && globalThis.navigator.userActivation; return !ua || !!ua.hasBeenActive; } catch (_) { return true; }
};
const micOpen = () => { try { return !!speech.isListening(); } catch (_) { return false; } };
/* la page attend encore son premier geste (ouverture directe de l'appli) : rien ne peut être dit avant */
export function needsGesture() { return !activated(); }

/* ---------- santé de la voix (séance) ---------- */
let state = 'unknown';
let warned = false;                 /* « Je n'arrive pas à parler… » déjà dit (une fois par séance) */
export function health() { return state; }
function setHealth(v) {
  if (state === v) return;
  state = v;
  try { globalThis.document.documentElement.classList.toggle('vx-quiet', v === 'broken'); } catch (_) {}
}
/* échec réel : rien n'est sorti, et ce n'est ni une lecture coupée par nous ni un refus faute de geste */
const failed = r => !!r && !r.ok && !r.heard && !['cancelled', 'empty', 'error:not-allowed'].includes(r.reason);
function judge(r) {
  if (r && (r.ok || r.heard)) setHealth('ok');
  else if (failed(r)) setHealth('broken');
  return r;
}
try { tts.onLateStart(() => setHealth('ok')); } catch (_) {}   /* une voix lente a fini par parler */

/* la page passe en arrière-plan : le compagnon se tait (abonnement au premier usage, rien au chargement du module) */
let watching = false;
function watchPage() {
  if (watching) return;
  watching = true;
  try {
    const d = globalThis.document;
    d.addEventListener('visibilitychange', () => { if (d.visibilityState === 'hidden') hush(); });
  } catch (_) {}
}

let speakingBtn = null;
let seq = 0;
/* → Promise<résultat de tts.speakResult | null> (null : rien n'a été tenté) */
function attempt(text, { force = false } = {}) {
  const t = speakable(text);
  if (!t) return Promise.resolve(null);
  if (!force && !voiceOn()) return Promise.resolve(null);
  if (micOpen() || !activated()) return Promise.resolve(null);
  watchPage();
  ++seq;
  let p;
  try { p = tts.speakResult(t); } catch (_) { p = Promise.resolve({ ok: false, reason: 'error:speak', heard: false }); }
  return Promise.resolve(p).then(judge, () => null);
}
export function speak(text, opts) {
  const my = seq + 1;
  return attempt(text, opts).then(r => !!(r && r.ok && my === seq));
}
export function hush() {
  seq++;
  try { tts.stopSpeaking(); } catch (_) {}
  if (speakingBtn) { speakingBtn.classList.remove('is-speaking'); speakingBtn = null; }
}
export function settle() { try { return Promise.resolve(tts.settle()); } catch (_) { return Promise.resolve(); } }

/* essai explicite (espace parents) : la phrase est dite même si le réglage ou les sons de l'enfant l'interdisent */
export async function test(text = 'Bonjour ! Je suis la voix de Caramel.') {
  hush();
  if (micOpen()) return { ok: false, reason: 'mic', diag: tts.diagnose() };
  const r = await attempt(text, { force: true });
  let diag = null;
  try { diag = tts.diagnose(); } catch (_) {}
  return { ok: !!(r && (r.ok || r.heard)), reason: r ? r.reason : 'no-gesture', diag };
}

/* bouton 🔊 (48 px) : relit le texte du moment ; micro ouvert → il le dit gentiment au lieu de lire ; voix en panne →
   le dit une fois (le bouton reste là, discret : un autre essai peut marcher) */
export const FAIL_TOAST = frTypo('Je n’arrive pas à parler sur cet appareil 😕 Un adulte peut tester la voix dans l’espace parents 🔒.');
const toast = msg => { try { kit.toast(msg); } catch (_) {} };
export function listenButton(get, { label = 'Écouter' } = {}) {
  try { kit.ensureStyles(); } catch (_) {}
  const b = h('button', { type: 'button', class: 'vx-listen', 'aria-label': label },
    h('span', { class: 'vx-wave', 'aria-hidden': 'true' }), h('span', { class: 'vx-ico', 'aria-hidden': 'true' }, '🔊'));
  b.addEventListener('click', () => {
    const text = typeof get === 'function' ? get() : '';
    if (!text) return;
    if (micOpen()) { toast(frTypo('Le micro t’écoute : coupe-le 🎤 pour m’entendre.')); return; }
    try { audio.tap(); } catch (_) {}
    if (speakingBtn && speakingBtn !== b) speakingBtn.classList.remove('is-speaking');
    speakingBtn = b;
    b.classList.add('is-speaking');
    const my = seq + 1;
    attempt(text, { force: true }).then(r => {
      if (speakingBtn === b) { b.classList.remove('is-speaking'); speakingBtn = null; }
      if (my !== seq || !failed(r) || warned) return;
      warned = true;
      toast(FAIL_TOAST);
    });
  });
  return b;
}
