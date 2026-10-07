/* Cycle d'écoute de js/core/speech.js avec de faux moteurs (aucun navigateur) :
   - Vosk : texte cumulé identique à la v11 sans resetTranscript (la course) ; resetTranscript oublie les mots déjà entendus
     de la phrase en cours SANS la couper (pas de retrieveFinalResult) et garde la suite (2.2.3 : réponse enchaînée sans
     pause) ; AudioContext du micro suspendu par le système → relancé ;
   - santé du micro (2.2.3) : moteur en retard → blancs non envoyés, voix toujours (puis plus rien au-delà de ≈ 4 s,
     jusqu'au rattrapage) ; micro muet → rouvert (même reconnaisseur), 3 fois par minute au plus ;
   - Web Speech (secours) : oubli des résultats déjà reçus, même finals (Chrome Android renvoie toute la liste) ;
     relance après « onend » (fin de session Android, « no-speech », « aborted »), erreurs bloquantes remontées. */
import { test, assert } from './_t.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEYS = ['window', 'navigator', 'document', 'AudioContext', 'webkitAudioContext', 'Vosk', 'fetch', 'caches',
  'SpeechRecognition', 'webkitSpeechRecognition'];

/* ---------- faux navigateur ---------- */
const F = { recs: [], ctxs: [], srs: [], gum: 0, scriptFails: false, model: null };
/* faux modèle de vosk-browser : postMessage (compté par speech.js) et worker (réponses rendues par le test : reply()) */
function fakeModel() {
  const M = { sent: [], listeners: [], KaldiRecognizer: FakeRec };
  M.postMessage = m => { M.sent.push(m); };
  M.worker = { addEventListener: (ev, fn) => { if (ev === 'message') M.listeners.push(fn); } };
  M.reply = (n = 1) => { for (let i = 0; i < n; i++) M.listeners.forEach(fn => fn({ data: { event: 'partialresult', recognizerId: 'r' } })); };
  F.model = M;
  return M;
}
class FakeRec {
  constructor(sampleRate, grammar) { this.sampleRate = sampleRate; this.grammar = grammar; this.h = {}; this.finals = 0; this.waves = 0; F.recs.push(this); }
  on(ev, fn) { this.h[ev] = fn; }
  acceptWaveform() { this.waves++; if (F.model) F.model.postMessage({ action: 'audioChunk', recognizerId: 'r' }); }
  retrieveFinalResult() { this.finals++; }
  remove() { this.removed = true; }
  partial(p) { this.h.partialresult({ result: { partial: p } }); }
  result(t) { this.h.result({ result: { text: t } }); }
}
const node = () => ({ connect() {}, disconnect() {}, gain: { value: 1 }, onaudioprocess: null });
class FakeCtx {
  constructor(o = {}) { this.sampleRate = o.sampleRate || 48000; this.state = 'suspended'; this.l = []; this.resumes = 0; this.destination = {}; F.ctxs.push(this); }
  addEventListener(ev, fn) { if (ev === 'statechange') this.l.push(fn); }
  set(st) { this.state = st; this.l.forEach(fn => fn()); }
  resume() { this.resumes++; if (this.state !== 'closed') this.set('running'); return Promise.resolve(); }
  suspend() { this.set('suspended'); return Promise.resolve(); }
  close() { this.set('closed'); return Promise.resolve(); }
  createMediaStreamSource() { return node(); }
  createScriptProcessor() { return (this.sp = node()); }
  createGain() { return node(); }
}
class FakeSR {
  constructor() { this.starts = 0; F.srs.push(this); }
  start() { this.starts++; }
  stop() { this.stopped = true; }
  /* résultats façon Chrome : [{ transcript }] + isFinal */
  send(resultIndex, list) {
    const results = list.map(([t, fin]) => Object.assign([{ transcript: t }], { isFinal: fin }));
    this.onresult({ resultIndex, results });
  }
}
function install() {
  const saved = {};
  for (const k of KEYS) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
  const set = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  set('window', globalThis);
  set('navigator', { mediaDevices: { getUserMedia: async () => { F.gum++; return { getTracks: () => [{ stop() {}, readyState: 'live' }] }; } } });
  set('document', {
    createElement: () => ({}),
    head: { appendChild: s => setTimeout(() => { if (F.scriptFails) s.onerror(); else { set('Vosk', { createModel: async () => fakeModel() }); s.onload(); } }, 0) }
  });
  set('AudioContext', FakeCtx);
  set('fetch', async () => ({ ok: true, headers: { get: () => null }, body: null, blob: async () => new Blob(['modele']) }));
  set('caches', undefined);
  set('SpeechRecognition', FakeSR);
  F.recs = []; F.ctxs = []; F.srs = []; F.gum = 0;
  if (F.model) { F.model.sent = []; }
  return () => {
    for (const k of KEYS) {
      if (saved[k]) Object.defineProperty(globalThis, k, saved[k]);
      else delete globalThis[k];
    }
  };
}
/* une instance du module par moteur (état propre) : ?vosk et ?web */
async function withSpeech(tag, fn) {
  const restore = install();
  let S = null;
  const err = console.error;
  console.error = () => {};                               /* « Vosk indisponible » attendu côté Web Speech */
  try {
    S = await import('../js/core/speech.js?' + tag);
    const texts = [], errors = [];
    const start = (grammar = ['un', 'deux']) => S.startListening({ grammar, onText: (t, f) => texts.push([t, f]), onError: (c) => errors.push(c) });
    await fn({ S, texts, errors, start, last: () => texts[texts.length - 1] });
  } finally {
    try { if (S) S.stopListening(); } catch (_) {}         /* un test raté ne laisse pas un micro « allumé » derrière lui */
    console.error = err;
    restore();
  }
}

test('Vosk : sans resetTranscript, texte cumulé identique à la v11 (la course)', () => withSpeech('vosk', async ({ S, texts, start }) => {
  const r = await start(['le', 'poney']);
  assert.equal(r.engine, 'vosk');
  assert.equal(S.isListening(), true);
  const rec = F.recs[F.recs.length - 1];
  assert.equal(rec.sampleRate, 16000);
  assert.equal(rec.grammar, JSON.stringify(['le', 'poney', '[unk]']));
  rec.partial('le');
  rec.result('le poney');
  rec.partial('mange');
  rec.partial('');
  assert.deepEqual(texts, [[' le', false], ['le poney ', true], ['le poney  mange', false], ['le poney  ', false]]);
  assert.equal(rec.finals, 0);
  S.stopListening();
  assert.equal(S.isListening(), false);
}));

test('Vosk : resetTranscript oublie les mots déjà entendus, garde la suite, sans couper la phrase', () => withSpeech('vosk', async ({ S, texts, start, last }) => {
  await start();
  const rec = F.recs[F.recs.length - 1];
  rec.partial('quarante-huit');
  S.resetTranscript();                                  /* bonne réponse : calcul suivant */
  assert.equal(rec.finals, 0, 'pas de retrieveFinalResult : la phrase n’est pas coupée au milieu d’un mot');
  rec.partial('quarante-huit');                         /* même phrase, rien de neuf */
  assert.deepEqual(last(), [' ', false]);
  rec.partial('quarante-huit vingt-sept');              /* réponse suivante dite SANS pause : entendue (2.2.1 la perdait) */
  assert.deepEqual(last(), [' vingt-sept', false]);
  S.resetTranscript();                                  /* deuxième oubli dans la même phrase */
  rec.partial('quarante-huit vingt-sept');
  assert.deepEqual(last(), [' ', false]);
  rec.result('quarante-huit vingt-sept soixante');      /* fin naturelle : seule la suite compte */
  assert.deepEqual(last(), ['soixante ', true]);
  rec.partial('soixante-quatre');                       /* nouvelle phrase : entendue en entier */
  assert.deepEqual(last(), ['soixante  soixante-quatre', false]);
  S.resetTranscript();
  rec.result('soixante-quatre');                        /* sa fin : déjà entendue, oubliée */
  assert.deepEqual(last(), ['', true]);
  /* oubli dans le silence (aucune phrase en cours) : la phrase suivante est entendue en entier */
  S.resetTranscript();
  rec.partial('neuf');
  assert.deepEqual(last(), [' neuf', false]);
  assert.equal(rec.finals, 0);
  assert.ok(texts.length > 0);
  S.stopListening();
}));

test('dropWords, modelDir, staleKeys (pur)', () => withSpeech('pur', async ({ S }) => {
  assert.equal(S.dropWords('quarante-huit  vingt-sept soixante ', 2), 'soixante');
  assert.equal(S.dropWords('un deux', 5), '');
  assert.equal(S.dropWords('un deux', 0), 'un deux');
  const dir = S.modelDir('https://exemple.fr/caramel/models/fr.tar.gz');
  assert.equal(dir, '/vosk/https___exemple_fr_caramel_models_fr_tar_gz', 'même chemin que le worker de vosk-browser');
  const keys = ['/vosk/blob_https___exemple_fr_1', '/vosk/blob_https___exemple_fr_1/final.mdl', dir, dir + '/extracted.ok', dir + '/am/final.mdl'];
  assert.deepEqual(S.staleKeys(keys, dir), keys.slice(0, 2), 'copies des ouvertures précédentes');
}));

const chunk = amp => ({ getChannelData: () => { const d = new Float32Array(4096); for (let i = 0; i < d.length; i++) d[i] = amp * Math.sin(i / 3); return d; } });
test('santé : moteur en retard → blancs non envoyés, voix toujours ; au-delà de 4 s, plus rien jusqu’au rattrapage', () => withSpeech('retard', async ({ S, start }) => {
  await start();
  const rec = F.recs[F.recs.length - 1], sp = F.ctxs[F.ctxs.length - 1].sp, M = F.model;
  const realNow = Date.now;
  let t = realNow();
  Date.now = () => t;
  try {
    const feed = amp => { t += 256; sp.onaudioprocess({ inputBuffer: chunk(amp) }); };
    for (let i = 0; i < 6; i++) { feed(0.001); M.reply(1); }   /* bruit de fond : le moteur suit, tout est envoyé */
    assert.equal(rec.waves, 6);
    for (let i = 0; i < 4; i++) feed(0.2);              /* voix, sans réponse du moteur : 4 en attente */
    assert.equal(rec.waves, 10);
    assert.equal(S.health().pending, 4);
    feed(0.001); feed(0.001); feed(0.001);              /* blanc juste après la voix (0,8 s) : encore envoyé, pour finir la phrase */
    assert.equal(rec.waves, 13);
    feed(0.001); feed(0.001);                           /* blancs suivants : gardés */
    assert.equal(rec.waves, 13);
    feed(0.2);                                          /* la voix revient : envoyée */
    assert.equal(rec.waves, 14);
    while (S.health().pending < 16) feed(0.2);          /* la voix continue, le moteur ne répond plus : 16 en attente (≈ 4 s) */
    const w = rec.waves;
    feed(0.2); feed(0.2);
    assert.equal(rec.waves, w, 'au-delà de 4 s de retard : plus rien, même la voix');
    M.reply(S.health().pending - 4);                    /* le moteur rattrape : 4 en attente */
    feed(0.2);
    assert.equal(rec.waves, w + 1, 'rattrapé : la voix repart');
    assert.ok(S.health().dropped >= 4);
  } finally { Date.now = realNow; }
  S.stopListening();
  assert.equal(S.health().state, 'off');
}));

test('santé : keepVoice (la course) → la voix part toujours, même très en retard ; les blancs restent écartés', () => withSpeech('garde', async ({ S }) => {
  await S.startListening({ grammar: ['le', 'poney'], keepVoice: true });
  const rec = F.recs[F.recs.length - 1], sp = F.ctxs[F.ctxs.length - 1].sp;
  const realNow = Date.now;
  let t = realNow();
  Date.now = () => t;
  try {
    const feed = amp => { t += 256; sp.onaudioprocess({ inputBuffer: chunk(amp) }); };
    for (let i = 0; i < 24; i++) feed(0.2);              /* lecture continue, moteur muet : 24 en attente (> 16) */
    assert.equal(rec.waves, 24, 'aucun mot lu écarté');
    feed(0.001); feed(0.001); feed(0.001); feed(0.001); feed(0.001);
    assert.equal(rec.waves, 27, 'blancs : 0,8 s envoyés pour finir la phrase, puis écartés');
  } finally { Date.now = realNow; }
  S.stopListening();
}));

test('santé : micro muet → rouvert sans perdre le reconnaisseur, 3 fois par minute au plus', () => withSpeech('muet', async ({ S, start }) => {
  await start();
  const rec = F.recs[F.recs.length - 1];
  const states = [];
  const off = S.onHealth(h => { if (states[states.length - 1] !== h.state) states.push(h.state); });
  const realNow = Date.now;
  let t = realNow();
  Date.now = () => t;
  try {
    for (let k = 1; k <= 4; k++) {
      t += 2500;                                        /* plus aucun son depuis 2,5 s */
      await sleep(320);                                 /* une vérification (250 ms) */
      await sleep(20);
      assert.equal(F.gum, 1 + Math.min(k, 3), 'réouverture ' + k);
    }
    assert.equal(F.recs.length, 1, 'même reconnaisseur');
    assert.equal(F.recs[0], rec);
    assert.ok(states.includes('deaf'), 'état « sourd » publié : ' + states.join(' → '));
    const sp = F.ctxs[F.ctxs.length - 1].sp;
    sp.onaudioprocess({ inputBuffer: chunk(0.2) });    /* le son revient */
    await sleep(300);
    assert.equal(S.health().state, 'ok');
  } finally { Date.now = realNow; off(); }
  S.stopListening();
}));

test('Vosk : AudioContext du micro suspendu par le système → relancé ; plus rien après l’arrêt', () => withSpeech('vosk', async ({ S, start }) => {
  await start();
  const ctx = F.ctxs[F.ctxs.length - 1];
  assert.equal(ctx.sampleRate, 16000);
  assert.equal(ctx.state, 'running');
  const n = ctx.resumes;
  ctx.suspend();                                        /* Android : focus audio perdu, appel, veille */
  assert.equal(ctx.state, 'running', 'repris aussitôt');
  assert.equal(ctx.resumes, n + 1);
  ctx.set('interrupted');
  assert.equal(ctx.state, 'running');
  S.stopListening();
  assert.equal(ctx.state, 'closed');
  ctx.set('suspended');
  assert.equal(ctx.state, 'suspended', 'micro arrêté : pas de reprise');
  /* redémarrage : nouveau flux, nouveau contexte (le moteur reste chargé) */
  const gum = F.gum;
  await start();
  assert.equal(F.gum, gum + 1);
  assert.notEqual(F.ctxs[F.ctxs.length - 1], ctx);
  S.stopListening();
}));

test('Web Speech (secours) : oubli des résultats reçus, même finals ; relance après onend', () => withSpeech('web', async ({ S, texts, errors, start, last }) => {
  F.scriptFails = true;                                  /* Vosk indisponible → reconnaissance Google */
  try {
    const r = await start();
    assert.equal(r.engine, 'webspeech');
    const sr = F.srs[F.srs.length - 1];
    assert.equal(sr.starts, 1);
    assert.equal(sr.continuous, true);
    sr.send(0, [['cinquante six', false]]);
    assert.deepEqual(last(), [' cinquante six ', false]);
    sr.send(0, [['cinquante six', true]]);
    assert.deepEqual(last(), ['cinquante six  ', true]);
    S.resetTranscript();                                 /* dernier résultat final : oublié quand même */
    sr.send(0, [['cinquante six', true], ['quarante', false]]);   /* Chrome Android : toute la liste, depuis 0 */
    assert.deepEqual(last(), [' quarante ', false], 'la réponse précédente ne revient pas');
    S.resetTranscript();                                 /* phrase en cours : ignorée jusqu’à sa fin */
    sr.send(1, [['cinquante six', true], ['quarante deux', true]]);
    assert.deepEqual(last(), [' ', true]);
    sr.send(2, [['cinquante six', true], ['quarante deux', true], ['sept', true]]);
    assert.deepEqual(last(), ['sept  ', true]);
    /* fin de session (Android après chaque phrase, « no-speech », « aborted ») : relance */
    sr.onerror({ error: 'no-speech' });
    sr.onerror({ error: 'aborted' });
    assert.deepEqual(errors, [], 'erreurs bénignes : rien à afficher');
    sr.onend();
    await sleep(260);
    assert.equal(sr.starts, 2, 'relancée');
    sr.send(0, [['huit', true]]);                        /* nouvelle session : indices repartis de 0 */
    assert.deepEqual(last(), ['sept huit  ', true]);
    sr.onerror({ error: 'network' });
    assert.deepEqual(errors, ['network'], 'erreur bloquante remontée au jeu');
    S.stopListening();
    assert.equal(sr.stopped, true);
    const n = sr.starts;
    sr.onend();
    await sleep(260);
    assert.equal(sr.starts, n, 'arrêtée : plus de relance');
    assert.ok(texts.length > 0);
  } finally { F.scriptFails = false; }
}));
