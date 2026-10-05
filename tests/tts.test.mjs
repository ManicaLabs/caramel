/* Synthèse vocale (js/core/tts.js) face à un faux speechSynthesis qui imite Chromium (speaking = file non vide,
   pending = plus d'un énoncé en file) et les défauts relevés sur Chrome Android (v2.2.1, « 🔊 ne fait rien ») :
   liste des voix tardive ou vide, speak() avalé ou interrompu juste après cancel(), « start » jamais signalé,
   moteur bloqué, voix choisie en échec. Délais réduits (TIMING) pour garder le test rapide. */
import { test, assert } from './_t.mjs';
import * as tts from '../js/core/tts.js';

Object.assign(tts.TIMING, { voicesWait: 80, voicesPoll: 10, settle: 20, startCheck: 40, startMax: 120, startFirst: 160, endSlack: 30, msPerChar: 1 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => performance.now();

const FR = { name: 'Français France', lang: 'fr-FR', localService: true, voiceURI: 'fr-fr-local' };
const FR_NET = { name: 'Français réseau', lang: 'fr-FR', localService: false, voiceURI: 'fr-fr-net' };
const CA = { name: 'Français Canada', lang: 'fr_CA', localService: true, voiceURI: 'fr-ca' };
const EN = { name: 'English', lang: 'en-US', localService: true, voiceURI: 'en-us', default: true };

/* faux moteur : opts = { voices, voicesLate, voicesEvent, startDelay, noStart, incoherent, dead, swallowMs,
   interruptMs, failVoice, failAll } */
function install(opts = {}) {
  const o = Object.assign({ voices: [FR_NET, FR, CA, EN], voicesLate: 0, voicesEvent: true, startDelay: 4 }, opts);
  const log = [];
  const q = [];
  const ls = new Set();
  let list = o.voicesLate ? [] : o.voices.slice();
  let lastCancel = -1e9;
  if (o.voicesLate) setTimeout(() => { list = o.voices.slice(); if (o.voicesEvent) for (const f of ls) f(); }, o.voicesLate);
  const fire = (u, type, extra) => { const f = u['on' + type]; if (typeof f === 'function') f(Object.assign({ type }, extra || {})); };
  const S = {
    get speaking() { return o.incoherent ? false : q.length > 0; },
    get pending() { return o.incoherent ? false : q.length > 1; },
    paused: false,
    getVoices: () => list,
    addEventListener: (t, f) => { if (t === 'voiceschanged') ls.add(f); },
    removeEventListener: (t, f) => { if (t === 'voiceschanged') ls.delete(f); },
    resume() {}, pause() {},
    speak(u) {
      log.push({ k: 'speak', t: now(), text: u.text, voice: u.voice ? u.voice.voiceURI : null, lang: u.lang });
      if (o.swallowMs && now() - lastCancel < o.swallowMs) { log.push({ k: 'swallowed', t: now() }); return; }
      q.push(u);
      if (o.interruptMs && now() - lastCancel < o.interruptMs) {
        setTimeout(() => { const i = q.indexOf(u); if (i >= 0) q.splice(i, 1); log.push({ k: 'platform-interrupt' }); fire(u, 'error', { error: 'interrupted' }); run(); }, 3);
        return;
      }
      if (q.length === 1) run();
    },
    cancel() {
      log.push({ k: 'cancel', t: now() });
      lastCancel = now();
      const all = q.splice(0);
      all.forEach((u, i) => { clearTimeout(u._a); clearTimeout(u._b); fire(u, 'error', { error: i === 0 ? 'interrupted' : 'canceled' }); });
    }
  };
  function run() {
    const u = q[0];
    if (!u || o.dead || u._a) return;
    u._a = setTimeout(() => {
      if (q[0] !== u) return;
      if ((o.failVoice && u.voice && u.voice.voiceURI === o.failVoice) || o.failAll) {
        q.shift(); log.push({ k: 'error', text: u.text }); fire(u, 'error', { error: 'synthesis-failed' }); run(); return;
      }
      log.push({ k: 'start', t: now(), text: u.text });
      if (!o.noStart) fire(u, 'start');
      u._b = setTimeout(() => { if (q[0] !== u) return; q.shift(); log.push({ k: 'end', t: now(), text: u.text }); fire(u, 'end'); run(); }, u.text.length);
    }, o.startDelay);
  }
  globalThis.speechSynthesis = S;
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  tts._reset();
  return { S, log, o, set: patch => Object.assign(o, patch), revive: () => run() };
}
function uninstall() { delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance; tts._reset(); }
const said = log => log.filter(e => e.k === 'speak').map(e => e.text);

test('voix : fr-FR locale choisie, lecture complète, aucun cancel() inutile', async () => {
  const { log } = install();
  const r = await tts.speakResult('Bonjour Léa.');
  assert.deepEqual(r, { ok: true, reason: '', heard: true });
  const sp = log.filter(e => e.k === 'speak');
  assert.equal(sp.length, 1);
  assert.equal(sp[0].voice, 'fr-fr-local', 'voix locale fr-FR préférée à la voix réseau');
  assert.equal(log.filter(e => e.k === 'cancel').length, 0, 'rien à couper : pas de cancel()');
  assert.equal(await tts.speak(''), false);
  assert.equal((await tts.speakResult('  ')).reason, 'empty');
  uninstall();
});

test('voix : hauteur rehaussée par défaut (PITCH, proche de la voix d’enfant des clips), réglable', async () => {
  const m = install();
  const pitches = [];
  const speakNow = m.S.speak;
  m.S.speak = u => { pitches.push(u.pitch); speakNow(u); };
  assert.equal(tts.PITCH, 1.5);
  assert.equal(await tts.speak('Un.'), true);
  assert.equal(await tts.speak('Deux.', { pitch: 1 }), true);
  assert.deepEqual(pitches, [1.5, 1]);
  uninstall();
});

test('voix : sans API → no-api ; voix chargées sans français → no-fr-voice', async () => {
  uninstall();
  assert.equal((await tts.speakResult('Bonjour')).reason, 'no-api');
  assert.equal(tts.ttsAvailable(), false);
  install({ voices: [EN] });
  assert.equal(tts.ttsAvailable(), false);
  const r = await tts.speakResult('Bonjour');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-fr-voice');
  assert.equal(tts.diagnose().fr, 0);
  uninstall();
});

test('voix : liste tardive (événement ou simple relecture) puis liste vide pour de bon', async () => {
  let m = install({ voicesLate: 30 });
  assert.equal(tts.ttsAvailable(), true, 'liste pas encore chargée : on ne cache rien');
  assert.equal(await tts.speak('Un.'), true);
  assert.equal(m.log.find(e => e.k === 'speak').voice, 'fr-fr-local');
  m = install({ voicesLate: 30, voicesEvent: false });
  assert.equal(await tts.speak('Deux.'), true);
  assert.equal(m.log.find(e => e.k === 'speak').voice, 'fr-fr-local', 'liste relue sans « voiceschanged »');
  m = install({ voices: [], voicesLate: 0 });
  assert.equal(await tts.speak('Trois.'), true, 'aucune voix listée : lecture avec la langue seule');
  const sp = m.log.find(e => e.k === 'speak');
  assert.equal(sp.voice, null);
  assert.equal(sp.lang, 'fr-FR');
  uninstall();
});

test('voix : stopSpeaking pendant l’attente des voix, puis lecture qui en remplace une autre', async () => {
  let m = install({ voicesLate: 60 });
  const p = tts.speakResult('Jamais dit.');
  await sleep(10);
  tts.stopSpeaking();
  const r = await p;
  assert.equal(r.reason, 'cancelled');
  assert.equal(said(m.log).length, 0, 'rien confié au moteur');
  assert.equal(m.log.filter(e => e.k === 'cancel').length, 0, 'pas de cancel() : le moteur n’avait rien');
  m = install();
  const long = tts.speakResult('Une phrase assez longue pour être coupée en plein milieu, vraiment longue.');
  await sleep(15);
  const second = await tts.speakResult('La suite.');
  assert.equal((await long).reason, 'cancelled');
  assert.equal(second.ok, true);
  const c = m.log.find(e => e.k === 'cancel');
  const sp = m.log.filter(e => e.k === 'speak').pop();
  assert.ok(sp.t - c.t >= tts.TIMING.settle - 2, 'respiration après cancel() avant le speak() suivant : ' + Math.round(sp.t - c.t) + ' ms');
  uninstall();
});

test('voix (Android) : speak() avalé ou interrompu par le moteur juste après cancel() → redonné une fois', async () => {
  let m = install({ swallowMs: tts.TIMING.settle + 15 });
  tts.speak('Première phrase assez longue pour rester en cours.');
  await sleep(12);
  const r = await tts.speakResult('Deuxième.');
  assert.equal(r.ok, true, 'redonné après la respiration');
  assert.equal(m.log.filter(e => e.k === 'swallowed').length, 1);
  assert.equal(said(m.log).filter(t => t === 'Deuxième.').length, 2);
  assert.equal(m.log.filter(e => e.k === 'cancel').length, 1, 'aucun cancel() de plus pour redonner');
  m = install({ interruptMs: tts.TIMING.settle + 15 });
  tts.speak('Première phrase assez longue pour rester en cours.');
  await sleep(12);
  const r2 = await tts.speakResult('Encore.');
  assert.equal(r2.ok, true, '« interrupted » qui ne vient pas de nous : redonné');
  assert.equal(m.log.filter(e => e.k === 'platform-interrupt').length, 1);
  uninstall();
});

test('voix (Android) : « start » jamais signalé et speaking toujours faux → pas d’abandon ni de doublon', async () => {
  const m = install({ noStart: true, incoherent: true });
  assert.equal(await tts.speak('Combien font trois fois quatre ?'), true, '« end » vaut preuve');
  assert.equal(said(m.log).length, 1);
  const before = said(m.log).length;
  tts.speak('Une phrase bien longue qui dure plus longtemps que le délai de démarrage, longue, longue, longue, très longue encore.');
  await sleep(15);
  assert.equal(await tts.speak('Après un cancel.'), true);
  assert.equal(said(m.log).filter(t => t === 'Après un cancel.').length, 1, 'jamais redonnée sur cet appareil');
  assert.ok(said(m.log).length === before + 2);
  uninstall();
});

test('voix : moteur bloqué → not-started (1re lecture : attente longue), puis la lecture suivante vide la file', async () => {
  const m = install({ dead: true });
  const t0 = now();
  const r = await tts.speakResult('Rien ne sort.');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not-started');
  assert.equal(r.heard, false);
  assert.ok(now() - t0 >= tts.TIMING.startFirst - 5, '1re lecture : attente longue (voix réseau, moteur à initialiser)');
  const t1 = now();
  assert.equal((await tts.speakResult('Toujours rien.')).reason, 'not-started');
  assert.ok(now() - t1 < tts.TIMING.startFirst, 'ensuite : attente normale');
  assert.ok(m.log.some(e => e.k === 'cancel'), 'la file bloquée est vidée par la lecture suivante');
  let late = 0;
  const off = tts.onLateStart(() => { late++; });
  assert.equal((await tts.speakResult('Voix lente.')).ok, false);
  m.set({ dead: false });
  m.revive();
  await sleep(40);
  assert.equal(late, 1, 'une voix lente qui finit par parler est signalée (onLateStart)');
  off();
  uninstall();
});

test('voix : voix choisie en échec → relue sans voix imposée, puis écartée', async () => {
  const m = install({ failVoice: 'fr-fr-local' });
  assert.equal(await tts.speak('Bonjour.'), true);
  const sp = m.log.filter(e => e.k === 'speak');
  assert.equal(sp[0].voice, 'fr-fr-local');
  assert.equal(sp[1].voice, null, 'deuxième essai : le moteur choisit (langue fr-FR)');
  assert.equal(sp[1].lang, 'fr-FR');
  await tts.speak('Encore.');
  assert.notEqual(m.log.filter(e => e.k === 'speak').pop().voice, 'fr-fr-local', 'voix en échec écartée');
  install({ failAll: true });
  const r = await tts.speakResult('Rien.');
  assert.equal(r.reason, 'error:synthesis-failed');
  assert.equal(r.heard, false);
  uninstall();
});

test('voix : découpage en morceaux courts, diagnostic pour l’espace parents', () => {
  const parts = tts.chunkText('Phrase un. ' + 'mot '.repeat(60) + 'fin.');
  assert.ok(parts.length >= 2 && parts.every(p => p.length <= 160));
  install();
  const d = tts.diagnose();
  assert.equal(d.api, true);
  assert.equal(d.voices, 4);
  assert.equal(d.fr, 3);
  assert.equal(d.frLocal, 2);
  assert.equal(d.voice, 'Français France');
  uninstall();
});

test('voix du compagnon : une panne réelle rend 🔊 discret, une lecture coupée non ; l’essai des parents dit pourquoi', async () => {
  const voice = await import('../js/ui/voice.js');
  const m = install({ failAll: true });
  const r = await voice.test('Bonjour Tom !');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'error:synthesis-failed');
  assert.equal(voice.health(), 'broken');
  assert.equal(r.diag.fr, 3, 'diagnostic : voix françaises listées');
  m.set({ failAll: false });
  assert.equal((await voice.test('Encore.')).ok, true);
  assert.equal(voice.health(), 'ok', 'une lecture réussie efface la panne');
  /* lecture coupée par hush() : ni panne ni succès */
  const p = voice.test('Une phrase assez longue pour être coupée avant la fin, vraiment.');
  await sleep(15);
  voice.hush();
  const cut = await p;
  assert.equal(cut.reason, 'cancelled');
  assert.equal(voice.health(), 'ok');
  install({ voices: [EN] });
  const nofr = await voice.test('Bonjour.');
  assert.equal(nofr.reason, 'no-fr-voice');
  assert.equal(voice.health(), 'broken');
  uninstall();
});
