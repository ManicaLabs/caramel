/* ============ LA VOIX DU COMPAGNON (CDC §1 principe 7 : « icônes et voix plutôt que lecture ») ============
   Lecture à voix haute des consignes, des indices et des phrases du compagnon.
   Réglage des parents settings.readAloud (espace parents › « Lire les consignes à voix haute ») : 'on' = Oui (défaut,
   pour TOUS les enfants depuis la 2.2.2 : l'ancien 'auto' des CP-CE1 et un réglage absent valent Oui) · 'off' = Non
   (anciens booléens acceptés). 🔁 « Écouter encore » (🔊 jusqu'à la 2.3 : l'enceinte est devenue le bouton du son,
   js/ui/sound-toggle.js, décision du parent du 07/10/2026) est visible quand la lecture est activée et les sons aussi
   (sons coupés : 🔇 en haut de l'écran, rien n'est lu, 🔁 disparaît) ; Non le cache partout.
   Le texte reste TOUJOURS affiché (CDC §16). Rien n'est lu : sons coupés, avant le premier geste de la page (le
   navigateur refuserait), ni pendant que le micro écoute (le moteur vocal n'entend que l'enfant : js/core/speech.js
   n'est que LU, jamais modifié). La voix se tait quand la page passe en arrière-plan.
   v2.2.2 — VOIX ENREGISTRÉE : l'inventaire (js/content/voice-lines.js : phrases fixes, phrases à prénom dites sans le
   prénom, nombres et morceaux de calcul) est joué par les clips de la voix Piper « siwis » (js/core/voice-clips.js, Web
   Audio, sans trou). Téléphone sans voix française (ou synthèse en panne) : les phrases couvertes d'un texte qui ne
   l'est pas entièrement sont jouées, les autres se taisent (le texte reste écrit). Les phrases les plus courantes sont
   mises en cache en tâche de fond quand la voix est active.
   v2.2.2 — VOIX FLUIDE (décision du parent du 04/10/2026, après écoute : les clips assemblés mot à mot sont jugés
   « saccadés ») : la même voix Piper, calculée sur l'appareil (js/core/voice-fluid.js). AIGUILLAGE (routeOf) :
     - phrases enregistrées entières (consigne, encouragement, bilan fixe, feuille d'installation) → leurs clips ;
     - phrase composée (calculs, nombres, astuces, explications) ou phrase à PRÉNOM → la voix fluide si elle est prête
       (le prénom de l'enfant est enfin dit ; dans le texte, chaque phrase qu'un clip couvre reste ce clip : même voix) ;
       sinon → la voix du téléphone (fluide, plus plate) ; sans voix du téléphone → les clips composés en dernier recours.
       Phrase à prénom qu'UN clip couvre (sans le prénom), voix fluide pas prête : ce clip (même voix que la visite).
     Replis : clip introuvable → voix fluide ou téléphone ; voix fluide en panne ou pas prête à temps (2,5 s) → téléphone,
     sinon clips ; téléphone en échec → clips. prepare(texte) calcule À L'AVANCE ce qui sera sans doute dit (question
     suivante d'un jeu, bilan, visite guidée) : la voix part sans attendre ; hush() vide la file ;
     settle() attend aussi la voix fluide ; 🔊 rejoue exactement le même son (gardé en mémoire).
   🔊 n'est jamais muet (v2.2.1) : si la lecture échoue (aucun son n'est sorti), la voix est notée « en panne » pour la
   séance : html.vx-quiet rend les 🔊 discrets ; un 🔊 touché qui échoue le dit UNE fois (toast), et l'espace parents
   propose « ▶ Tester la voix » (test()) avec la marche à suivre. Une lecture réussie efface la panne.
   API :
     readAloud(profil) → booléen (réglage résolu pour ce profil : tout sauf Non)
     voiceOn(profil) → booléen : readAloud ET sons activés ET une voix possible (clips ou voix française du téléphone) —
       la lecture AUTOMATIQUE
     listenOn(profil) → booléen : readAloud ET sons activés ET une voix possible — 🔁 « Écouter encore » est montré
     stats() → { rec, fluid, tts, partial, health } : phrases dites pendant la séance par la voix enregistrée, par la voix
       fluide, par la voix du téléphone, en lecture partielle (diagnostic de l'espace parents)
     prepare(...textes), prepareNext(...textes) : calcule à l'avance (voix fluide prête, lecture automatique active ;
       prepareNext : ce qui sera dit dans moins d'une seconde, avant le reste) ; micWillStart() : le micro
       va démarrer (js/ui/game-ctx.js) — la voix fluide ne démarre pas en même temps
     speakable(texte) → texte à dire (emoji porteurs de sens en mots, × → « fois », ÷ → « divisé par »…)
     speak(texte, { force }) → Promise<boolean> : lit si c'est permis ; force = geste explicite (🔊, « Tester la voix ») :
       lit même si le réglage est « Non » ou les sons coupés, jamais micro ouvert
     hush() : coupe la voix et vide la file de la voix fluide (changement d'écran, réponse donnée) ; settle() → Promise :
       la voix s'est tue (voix fluide comprise) et le moteur a repris son souffle (à attendre avant d'ouvrir le micro)
     health() → 'unknown' | 'ok' | 'broken' ; needsGesture() → vrai tant que la page n'a reçu aucun geste (rien ne peut
       être dit : l'appelant redit sa phrase au premier geste, ex. la visite guidée)
     test(texte?, { profile }) → Promise<{ ok, reason, diag, rec, tts }> : essai explicite pour l'espace parents — la voix
       enregistrée puis celle du téléphone (rec / tts : { ok, reason } ; diag : tts.diagnose()) ; profile : l'enfant
       nommé dans le texte (défaut : l'enfant actif)
     listenButton(get, { label }) → bouton 🔁 rond de 48 px qui relit get() ; classe is-speaking pendant la lecture */

import { h, frTypo } from '../core/util.js';
import * as tts from '../core/tts.js';
import * as speech from '../core/speech.js';
import * as audio from '../core/audio.js';
import * as clips from '../core/voice-clips.js';
import * as fluid from '../core/voice-fluid.js';
import { getProfile } from '../core/store.js';
import { fillTemplate } from '../core/profiles.js';
import { speakable, bigNumbers, planSpeech, namedLines, commonIds, LINE_BY_ID, isNamed, endsSentence } from '../content/voice-lines.js';
import * as kit from './kit.js';

export { speakable };

export function readAloud(profile) {
  const v = profile && profile.settings && profile.settings.readAloud;
  return !!profile && v !== 'off' && v !== false;
}
const soundOn = profile => !(profile && profile.settings && profile.settings.sound === false);
const canSpeak = () => clips.supported() || tts.ttsAvailable();
export function voiceOn(profile = getProfile()) {
  try { return readAloud(profile) && soundOn(profile) && !audio.isMuted() && canSpeak(); } catch (_) { return false; }
}
/* 🔁 montré : la lecture est activée, les sons aussi, et une voix est possible (v2.4 : sons coupés, le 🔇 du haut de
   l'écran dit « silence » ; avant, 🔊 lisait quand même) */
export function listenOn(profile = getProfile()) {
  try { return readAloud(profile) && soundOn(profile) && canSpeak(); } catch (_) { return false; }
}

/* la page a-t-elle déjà reçu un geste ? (sans geste, Chrome et Safari refusent la synthèse vocale) */
const activated = () => {
  try { const ua = globalThis.navigator && globalThis.navigator.userActivation; return !ua || !!ua.hasBeenActive; } catch (_) { return true; }
};
const micOpen = () => { try { return !!speech.isListening(); } catch (_) { return false; } };
/* la voix fluide sait si le micro écoute (elle ne démarre jamais en même temps) */
try { fluid.setMicProbe(micOpen); } catch (_) {}
/* le micro va démarrer (js/ui/game-ctx.js, avant ensureVosk / startListening) */
export function micWillStart() { try { fluid.micWillStart(); } catch (_) {} }
/* la page attend encore son premier geste (ouverture directe de l'appli) : rien ne peut être dit avant */
export function needsGesture() { return !activated(); }

/* ---------- voix enregistrée : plan d'une phrase pour l'enfant actif (ou celui qu'on teste) ---------- */
let namedMemo = { key: null, list: [] };
function namedFor(p) {
  const c = (p && p.companion) || {};
  const key = p ? [p.id, p.name, p.g, c.name, c.type].join('|') : '';
  if (namedMemo.key !== key) {
    let list = [];
    try { list = p ? namedLines(s => fillTemplate(s, p)) : []; } catch (_) { list = []; }
    namedMemo = { key, list };
  }
  return namedMemo.list;
}
function planFor(text, profile) {
  if (!clips.supported()) return null;
  try { return planSpeech(text, { has: clips.has, named: namedFor(profile || getProfile()) }); } catch (_) { return null; }
}
/* le plan passe par une phrase à prénom (dite sans le prénom par la voix enregistrée) */
const namedIn = pl => !!(pl && pl.clips.some(c => { const e = LINE_BY_ID[c.id]; return !!(e && isNamed(e)); }));
/* phrases enregistrées entières seulement (routeOf) */
const wholeIn = pl => !!(pl && pl.ok) && pl.clips.every(c => { const e = LINE_BY_ID[c.id]; return !!e && endsSentence(e); });
const fluidOk = () => { try { return fluid.ready() && audio.audioSupported(); } catch (_) { return false; } };

/* ---------- santé de la voix (séance) ---------- */
let state = 'unknown';
const said = { rec: 0, fluid: 0, tts: 0, partial: 0 };   /* phrases dites jusqu'au bout pendant la séance (diagnostic) */
export function stats() { return { ...said, health: state }; }
let warned = false;                 /* « Je n'arrive pas à parler… » déjà dit (une fois par séance) */
let ttsDown = false;                /* la synthèse du téléphone vient d'échouer : les clips passent avant */
export function health() { return state; }
function setHealth(v) {
  if (state === v) return;
  state = v;
  try { globalThis.document.documentElement.classList.toggle('vx-quiet', v === 'broken'); } catch (_) {}
}
/* échec réel : rien n'est sorti, et ce n'est ni une lecture coupée par nous ni un refus faute de geste */
const failed = r => !!r && !r.ok && !r.heard && !['cancelled', 'empty', 'error:not-allowed', 'not-allowed'].includes(r.reason);
function judge(r) {
  if (r && (r.ok || r.heard)) setHealth('ok');
  else if (failed(r)) setHealth('broken');
  return r;
}
try { tts.onLateStart(() => { ttsDown = false; setHealth('ok'); }); } catch (_) {}   /* une voix lente a fini par parler */

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
/* le micro s'ouvre pendant un clip (un jeu qui n'aurait pas fait hush()) : la voix se tait aussitôt */
let micWatch = 0;
function watchMic() {
  if (micWatch) return;
  micWatch = setInterval(() => {
    if (!clips.playing() && !fluid.playing()) { clearInterval(micWatch); micWatch = 0; return; }
    if (micOpen()) hush();
  }, 120);
  try { if (micWatch.unref) micWatch.unref(); } catch (_) {}      /* Node (tests) : ne retient pas le processus */
}

/* phrases courantes mises en cache en tâche de fond (une fois par séance, voix active, pas en mode économie de données) */
let warmed = false;
function warm() {
  if (warmed || !clips.supported()) return;
  warmed = true;
  const go = () => {
    try { const c = globalThis.navigator && globalThis.navigator.connection; if (c && c.saveData) return; } catch (_) {}
    clips.prune().then(() => clips.prefetch(commonIds())).catch(() => {});
  };
  try {
    const t = typeof globalThis.requestIdleCallback === 'function'
      ? setTimeout(() => globalThis.requestIdleCallback(go, { timeout: 4000 }), 2500) : setTimeout(go, 3000);
    if (t && t.unref) t.unref();
  } catch (_) {}
}

/* crochet de test (comme game-ctx.js) : les parcours automatisés qui définissent window.__caramelDebug = {} lisent
   __caramelDebug.voice = [{ via: 'clip' | 'fluide' | 'clips' | 'partiel' | 'téléphone', text, ids }] (50 dernières phrases ;
   fluide : ids = clips gardés, « ≈ » pour une phrase calculée) */
function trace(via, text, ids) {
  try {
    const d = globalThis.__caramelDebug;
    if (!d || typeof d !== 'object') return;
    const j = d.voice || (d.voice = []);
    j.push({ via, text: String(text).slice(0, 160), ids: ids || [] });
    if (j.length > 50) j.shift();
  } catch (_) {}
}

let speakingBtn = null;
let seq = 0;
const stopFluid = () => { try { fluid.stop(); } catch (_) {} };
function viaTts(t) {
  trace('téléphone', t);
  clips.stop();
  stopFluid();
  let p;
  try { p = tts.speakResult(bigNumbers(t)); } catch (_) { p = Promise.resolve({ ok: false, reason: 'error:speak', heard: false }); }   /* « 1 000 » → « mille » */
  return Promise.resolve(p).then(r => { ttsDown = failed(r); if (r && r.ok) said.tts++; return r; });
}
/* clips (un seul, composés, ou phrases couvertes seules) */
function viaClips(pl, via, t) {
  try { if (tts.isSpeaking()) tts.stopSpeaking(); } catch (_) {}
  stopFluid();
  trace(via, t, pl.clips.map(c => c.id));
  const p = clips.play(pl.clips);
  watchMic();
  return p.then(r => { if (r.ok) said[via === 'partiel' ? 'partial' : 'rec']++; return r; });
}
/* voix fluide : chaque phrase qu'un clip couvre reste ce clip, les autres sont calculées (ou déjà prêtes) */
function viaFluid(text, t) {
  try { if (tts.isSpeaking()) tts.stopSpeaking(); } catch (_) {}
  clips.stop();
  let segs = [];
  try { segs = fluid.segmentsOf(text, { has: clips.has, clipsOk: clips.supported() }); } catch (_) { segs = []; }
  trace('fluide', t, segs.map(sg => (sg.kind === 'clip' ? sg.id : '≈')));
  try { fluid.cancelQueue({ keepLater: true }); } catch (_) {}      /* la phrase d'avant, coupée, ne passe plus devant */
  const p = fluid.play(segs, { clipBuffer: clips.buffer });
  watchMic();
  return p.then(r => { if (r.ok) said.fluid++; return r; });
}
const stopped = r => !!r && (r.ok || r.reason === 'cancelled');
const NO = { ok: false, reason: 'cancelled', heard: false };
/* → Promise<résultat { ok, reason, heard } | null> (null : rien n'a été tenté) */
function attempt(text, { force = false } = {}) {
  const t = speakable(text);
  if (!t) return Promise.resolve(null);
  if (!force && !voiceOn()) return Promise.resolve(null);
  if (micOpen() || !activated()) return Promise.resolve(null);
  watchPage();
  const my = ++seq;
  const pl = planFor(text);
  if (force ? voiceOn() : true) warm();                 /* lecture à voix haute active (un 🔊 d'un grand lecteur : non) */
  const ttsOk = () => { try { return tts.ttsAvailable() && !ttsDown; } catch (_) { return false; } };
  const how = fluid.routeOf({ plan: pl, named: namedIn(pl), fluid: fluidOk(), tts: ttsOk(), whole: wholeIn(pl) });
  const live = () => my === seq && !micOpen();
  /* sans voix du téléphone : les clips (composés, ou les phrases couvertes seules), sinon un dernier essai du téléphone */
  const lastResort = () => (pl && pl.ok ? viaClips(pl, 'clips', t) : pl && pl.clips.length ? viaClips(pl, 'partiel', t) : viaTts(t));
  let run;
  if (how === 'clip') {
    /* clip introuvable (hors ligne, jamais entendu) : la voix fluide le calcule (même voix), sinon le téléphone */
    const tel = r => (stopped(r) || my !== seq ? r : !live() ? NO : viaTts(t));
    run = viaClips(pl, 'clip', t).then(r => (stopped(r) || my !== seq ? r : !live() ? NO : fluidOk() ? viaFluid(text, t).then(tel) : viaTts(t)));
  } else if (how === 'fluid') {
    run = viaFluid(text, t).then(r => (stopped(r) || my !== seq ? r : !live() ? NO : ttsOk() ? viaTts(t) : lastResort()));
  } else if (how === 'tts') {
    run = viaTts(t).then(r => (!failed(r) || !live() || !pl || !pl.clips.length ? r : viaClips(pl, pl.ok ? 'clips' : 'partiel', t)));
  } else {
    run = viaClips(pl, how === 'partial' ? 'partiel' : 'clips', t).then(r => (stopped(r) || my !== seq ? r : !live() ? NO
      : how === 'clips' ? viaTts(t) : r));                 /* clip introuvable : la voix du téléphone, si elle revient */
  }
  return run.then(judge, () => null);
}
export function speak(text, opts) {
  const my = seq + 1;
  return attempt(text, opts).then(r => !!(r && r.ok && my === seq));
}
export function hush() {
  seq++;
  try { clips.stop(); } catch (_) {}
  try { fluid.stop(); fluid.cancelQueue(); } catch (_) {}
  try { tts.stopSpeaking(); } catch (_) {}
  if (speakingBtn) { speakingBtn.classList.remove('is-speaking'); speakingBtn = null; }
}
/* la voix s'est tue (clips arrêtés ou finis) et la synthèse a repris son souffle */
export function settle() {
  let a, b, c;
  try { a = Promise.resolve(tts.settle()); } catch (_) { a = Promise.resolve(); }
  try { b = clips.settle(); } catch (_) { b = Promise.resolve(); }
  try { c = fluid.settle(); } catch (_) { c = Promise.resolve(); }
  return Promise.all([a, b, c]).then(() => {}, () => {});
}

/* « ▶ Écouter » de la ligne « Voix fluide » (espace parents) : la phrase par la voix fluide seule (geste explicite)
   → Promise<{ ok, reason }> ; reason : 'mic' | 'no-gesture' | 'not-ready' | celles de la lecture */
export async function testFluid(text) {
  hush();
  if (micOpen()) return { ok: false, reason: 'mic', heard: false };
  if (!activated()) return { ok: false, reason: 'no-gesture', heard: false };
  if (!fluidOk()) return { ok: false, reason: 'not-ready', heard: false };
  watchPage();
  ++seq;
  try { return await viaFluid(text, speakable(text)); } catch (_) { return { ok: false, reason: 'fluid', heard: false }; }
}
/* la voix fluide est prête et la lecture automatique active : préparer à l'avance a un sens */
export function canPrepare() { try { return fluidOk() && voiceOn(); } catch (_) { return false; } }
/* calcule À L'AVANCE ce qui sera sans doute dit (voix fluide prête, lecture automatique active) : astuce, explication,
   étapes suivantes de la visite. Ce qu'un clip couvre n'a rien à calculer. prepareNext : ce qui va être dit dans moins
   d'une seconde (la question suivante d'un jeu, le bilan), calculé avant le reste */
function prep(texts, prio) {
  try {
    if (!fluidOk() || !voiceOn()) return;
    for (const text of texts.flat()) {
      if (!text) continue;
      const pl = planFor(text);
      if (fluid.routeOf({ plan: pl, named: namedIn(pl), fluid: true, tts: true }) !== 'fluid') continue;
      for (const sg of fluid.segmentsOf(text, { has: clips.has, clipsOk: clips.supported() })) if (sg.kind === 'piper') fluid.prepare(sg.text, prio);
    }
  } catch (_) {}
}
export function prepare(...texts) { prep(texts, fluid.LATER); }
export function prepareNext(...texts) { prep(texts, fluid.NEXT); }

/* essai explicite (espace parents) : la phrase est dite même si le réglage ou les sons de l'enfant l'interdisent —
   d'abord par la voix enregistrée (sans le prénom), puis par la voix du téléphone. profile : l'enfant dont le prénom et
   le compagnon remplissent la phrase (l'enfant affiché dans l'espace parents, pas forcément l'enfant actif) */
const pause = ms => new Promise(r => setTimeout(r, ms));
export async function test(text = 'Bonjour ! Je suis la voix de Caramel.', { profile } = {}) {
  hush();
  let diag = null;
  try { diag = tts.diagnose(); } catch (_) {}
  const no = reason => ({ ok: false, reason, heard: false });
  if (micOpen()) return { ok: false, reason: 'mic', diag, rec: no('mic'), tts: no('mic') };
  if (!activated()) return { ok: false, reason: 'no-gesture', diag, rec: no('no-gesture'), tts: no('no-gesture') };
  watchPage();
  const my = ++seq;
  let rec;
  const pl = planFor(text, profile);
  if (!clips.supported()) rec = no('no-audio');
  else if (!pl || !pl.ok) rec = no('not-covered');
  else { rec = await clips.play(pl.clips); if (rec.ok || rec.heard) await pause(350); }
  let r;
  if (my !== seq) r = no('cancelled');                      /* coupé (hush, changement d'écran) */
  else if (micOpen()) r = no('mic');
  else {
    try { r = await tts.speakResult(speakable(text)); } catch (_) { r = no('error:speak'); }
    ttsDown = failed(r);
  }
  try { diag = tts.diagnose(); } catch (_) {}
  const recOk = !!(rec.ok || rec.heard), ttsOk = !!(r.ok || r.heard);
  if (rec.ok) said.rec++;
  if (r.ok) said.tts++;
  judge(recOk ? rec : r);
  return { ok: recOk || ttsOk, reason: r.reason || '', diag, rec: { ok: recOk, reason: rec.reason || '' }, tts: { ok: ttsOk, reason: r.reason || '' } };
}

/* bouton 🔊 (48 px) : relit le texte du moment ; micro ouvert → il le dit gentiment au lieu de lire ; voix en panne →
   le dit une fois (le bouton reste là, discret : un autre essai peut marcher) */
export const FAIL_TOAST = frTypo('Je n’arrive pas à parler sur cet appareil 😕 Un adulte peut tester la voix dans l’espace parents 🔒.');
const toast = msg => { try { kit.toast(msg); } catch (_) {} };
export function listenButton(get, { label = 'Écouter' } = {}) {
  try { kit.ensureStyles(); } catch (_) {}
  const b = h('button', { type: 'button', class: 'vx-listen', 'aria-label': label },
    h('span', { class: 'vx-wave', 'aria-hidden': 'true' }), h('span', { class: 'vx-ico', 'aria-hidden': 'true' }, '🔁'));
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
