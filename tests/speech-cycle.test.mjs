/* Cycle d'écoute de js/core/speech.js avec de faux moteurs (aucun navigateur) :
   - Vosk : texte cumulé identique à la v11 sans resetTranscript (la course) ; resetTranscript ignore la phrase en cours
     jusqu'à sa fin naturelle SANS la couper (pas de retrieveFinalResult), la coupe seulement au bout de SKIP_MAX_MS ;
     AudioContext du micro suspendu par le système → relancé ;
   - Web Speech (secours) : oubli des résultats déjà reçus, même finals (Chrome Android renvoie toute la liste) ;
     relance après « onend » (fin de session Android, « no-speech », « aborted »), erreurs bloquantes remontées. */
import { test, assert } from './_t.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEYS = ['window', 'navigator', 'document', 'AudioContext', 'webkitAudioContext', 'Vosk', 'fetch', 'caches',
  'SpeechRecognition', 'webkitSpeechRecognition'];

/* ---------- faux navigateur ---------- */
const F = { recs: [], ctxs: [], srs: [], gum: 0, scriptFails: false };
class FakeRec {
  constructor(sampleRate, grammar) { this.sampleRate = sampleRate; this.grammar = grammar; this.h = {}; this.finals = 0; F.recs.push(this); }
  on(ev, fn) { this.h[ev] = fn; }
  acceptWaveform() {}
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
  createScriptProcessor() { return node(); }
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
  set('navigator', { mediaDevices: { getUserMedia: async () => { F.gum++; return { getTracks: () => [{ stop() {} }] }; } } });
  set('document', {
    createElement: () => ({}),
    head: { appendChild: s => setTimeout(() => { if (F.scriptFails) s.onerror(); else { set('Vosk', { createModel: async () => ({ KaldiRecognizer: FakeRec }) }); s.onload(); } }, 0) }
  });
  set('AudioContext', FakeCtx);
  set('fetch', async () => ({ ok: true, headers: { get: () => null }, body: null, blob: async () => new Blob(['modele']) }));
  set('caches', undefined);
  set('SpeechRecognition', FakeSR);
  F.recs = []; F.ctxs = []; F.srs = []; F.gum = 0;
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
  const err = console.error;
  console.error = () => {};                               /* « Vosk indisponible » attendu côté Web Speech */
  try {
    const S = await import('../js/core/speech.js?' + tag);
    const texts = [], errors = [];
    const start = (grammar = ['un', 'deux']) => S.startListening({ grammar, onText: (t, f) => texts.push([t, f]), onError: (c) => errors.push(c) });
    await fn({ S, texts, errors, start, last: () => texts[texts.length - 1] });
  } finally {
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

test('Vosk : resetTranscript ignore la phrase en cours jusqu’à sa fin, sans la couper', () => withSpeech('vosk', async ({ S, texts, start, last }) => {
  await start();
  const rec = F.recs[F.recs.length - 1];
  rec.partial('quarante-huit');
  S.resetTranscript();                                  /* bonne réponse : calcul suivant */
  assert.equal(rec.finals, 0, 'pas de retrieveFinalResult : la phrase n’est plus coupée au milieu d’un mot');
  rec.partial('quarante-huit quarante');                /* l’enfant répète : même phrase */
  assert.deepEqual(last(), ['', false]);
  S.resetTranscript();                                  /* deuxième oubli (arrivée du calcul) : sans effet de plus */
  rec.partial('quarante-huit quarante-huit');
  assert.deepEqual(last(), ['', false]);
  rec.result('quarante-huit quarante-huit');            /* fin naturelle de la phrase : ignorée */
  assert.deepEqual(last(), ['', true]);
  rec.partial('soixante');                              /* nouvelle phrase : entendue */
  assert.deepEqual(last(), [' soixante', false]);
  rec.result('soixante-quatre');
  assert.deepEqual(last(), ['soixante-quatre ', true]);
  /* oubli dans le silence (aucune phrase en cours) : la phrase suivante est entendue tout de suite */
  S.resetTranscript();
  rec.partial('neuf');
  assert.deepEqual(last(), [' neuf', false]);
  assert.equal(rec.finals, 0);
  assert.ok(texts.length > 0);
  S.stopListening();
}));

test('Vosk : une phrase oubliée qui ne finit pas est coupée au bout de 2,5 s, une seule fois', () => withSpeech('vosk', async ({ S, start, last }) => {
  await start();
  const rec = F.recs[F.recs.length - 1];
  const realNow = Date.now;
  let t = realNow();
  Date.now = () => t;
  try {
    rec.partial('bruit');
    S.resetTranscript();
    t += 2400; rec.partial('bruit bruit');
    assert.equal(rec.finals, 0, 'avant 2,5 s : on attend la fin naturelle');
    t += 200; rec.partial('bruit bruit bruit');
    assert.equal(rec.finals, 1, 'au-delà : coupée');
    t += 300; rec.partial('bruit');
    assert.equal(rec.finals, 1, 'une seule coupe');
    rec.result('bruit bruit bruit');                    /* le résultat de la coupe est ignoré */
    assert.deepEqual(last(), ['', true]);
    rec.partial('douze');
    assert.deepEqual(last(), [' douze', false]);
  } finally { Date.now = realNow; }
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
