/* Port du moteur vocal v11 → js/core/speech.js (CDC v11 §4 : ne pas régresser).
   1. Test statique : constantes, paramètres et fonctions v11 retrouvés À L'IDENTIQUE, ERR_MSG compris,
      en comparant au fichier de la v11 lu dans git (commit c5bd8d1 = v11.3, dernière version monofichier).
   2. Comportement : API généralisée avec des API navigateur simulées (installées pendant ces tests seulement). */
import { test, assert } from './_t.mjs';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as speech from '../js/core/speech.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const V11_COMMIT = 'c5bd8d1';
const src = readFileSync(join(root, 'js', 'core', 'speech.js'), 'utf8');
const srcLines = new Set(src.split('\n').map(l => l.trim()).filter(Boolean));

/* seuls textes d'état retouchés depuis la v11 (2.2, typographie) : tout autre écart reste une régression */
const V22_TEXTS = [["'🎙 Moteur vocal : chargement...'", "'🎙 Moteur vocal : chargement\\u2026'"]];
const retext = l => V22_TEXTS.reduce((t, [a, b]) => t.replace(a, b), l);

let v11 = null;
try { v11 = execFileSync('git', ['-C', root, 'show', V11_COMMIT + ':index.html'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
catch (_) { console.log('  (speech-port : historique git indisponible, comparaison à la v11 ignorée)'); }

/* corps d'une fonction de premier niveau (de « function nom(» jusqu'à l'accolade fermante en colonne 0) */
function fnText(code, name) {
  const m = code.match(new RegExp('(?:^|\\n)((?:export )?(?:async )?function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\})'));
  return m ? m[1] : null;
}
const objLiteral = (code, re) => { const m = code.match(re); return m ? new Function('return ' + m[1])() : null; };

test('constantes et paramètres clés de la v11', () => {
  for (const s of [
    "export const VOSK_LIB = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';",
    "export const MODEL_URL = 'models/fr.tar.gz';",
    "cache = await caches.open('vosk-model-v1');",
    'audio: { echoCancellation:true, noiseSuppression:true, channelCount:1 }',
    'try{ audio.ctx = new Ctx({ sampleRate: 16000 }); }',
    'catch(_){ audio.ctx = new Ctx(); }',
    'try{ await audio.ctx.resume(); }catch(_){}',
    "const grammar = JSON.stringify(vocab.concat(['[unk]']));",
    'try{ rec = new voskModel.KaldiRecognizer(audio.ctx.sampleRate, grammar); }',
    'audio.node = audio.ctx.createScriptProcessor(4096, 1, 1);',
    'audio.gain.gain.value = 0;',
    'audio.gain.connect(audio.ctx.destination);',
    "webRecognition.lang = 'fr-FR';",
    'webRecognition.continuous = true;',
    'webRecognition.interimResults = true;',
    'setTimeout(()=>{ try{ webRecognition.start(); }catch(_){} }, 200);'
  ]) assert.ok(src.includes(s), 'absent de speech.js : ' + s);
  assert.equal(speech.VOSK_LIB, 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js');
  assert.equal(speech.MODEL_URL, 'models/fr.tar.gz');
});

test('ERR_MSG identique à la v11', () => {
  if (!v11) return;
  const ref = objLiteral(v11, /\nconst ERR_MSG = (\{[\s\S]*?\n\});/);
  assert.ok(ref && Object.keys(ref).length === 5, 'ERR_MSG introuvable dans la v11');
  assert.deepEqual({ ...speech.ERR_MSG }, ref);
  assert.deepEqual(objLiteral(src, /\nexport const ERR_MSG = (\{[\s\S]*?\n\});/), ref);
  /* et le bloc source lui-même, caractère pour caractère (échappements ’ compris) */
  const block = v11.match(/\nconst ERR_MSG = \{[\s\S]*?\n\};/)[0];
  assert.ok(src.includes('\nexport ' + block.slice(1)), 'bloc ERR_MSG modifié');
});

test('constantes v11 (VOSK_LIB, MODEL_URL) et messages de statut identiques', () => {
  if (!v11) return;
  assert.ok(v11.includes("const VOSK_LIB = '" + speech.VOSK_LIB + "';"));
  assert.ok(v11.includes("const MODEL_URL = '" + speech.MODEL_URL + "';"));
  for (const m of v11.match(/setVoiceStatus\('[^\n]*?'(?: \+ p \+ '[^\n]*?')?\);/g)) assert.ok(src.includes(retext(m)), m);
});

test('fonctions v11 recopiées caractère pour caractère', () => {
  if (!v11) return;
  for (const name of ['loadScript', 'getModelBlob', 'stopVoskEngine', 'stopWebSpeech']) {
    const ref = fnText(v11, name);
    assert.ok(ref, name + ' introuvable dans la v11');
    assert.equal(fnText(src, name), ref, name);
  }
});

test('fonctions v11 généralisées : toutes les autres lignes sont intactes', () => {
  if (!v11) return;
  /* lignes v11 remplacées par la généralisation (interface, grammaire en paramètre, ingest → emit) */
  const CHANGED = [/^(async )?function (ensureVosk|startVoskEngine)\(/, /document\.getElementById/, /^if\(l && !state\.running\)/,
    /state\.target/, /^\.filter\(Boolean\);$/, /^\/\* Grammaire/, /ingest\(/, /showCompat/];
  const rename = l => l.replace(/state\.running/g, 'running').replace(/state\.finalTranscript/g, 'finalTranscript');
  for (const name of ['ensureVosk', 'startVoskEngine', 'startWebSpeech']) {
    const ref = fnText(v11, name);
    assert.ok(ref, name + ' introuvable dans la v11');
    for (const raw of ref.split('\n').map(l => l.trim()).filter(Boolean)) {
      if (CHANGED.some(re => re.test(raw))) continue;
      assert.ok(srcLines.has(retext(rename(raw))), name + ' : ligne v11 absente → ' + raw);
    }
  }
  /* choix du moteur de micTap() */
  const mic = fnText(v11, 'micTap');
  for (const l of ["if(err && (err.name==='NotAllowedError' || err.name==='SecurityError')){", "if(err && err.name==='NotFoundError'){",
    "console.error('vosk start', err);", "if(startWebSpeech()) engine = 'webspeech';", 'const voskOk = await ensureVosk();']) {
    assert.ok(mic.includes(l), 'v11 : ' + l);
    assert.ok(srcLines.has(l), 'speech.js : ' + l);
  }
  /* ingest(…) → emit(…) avec les mêmes textes cumulés */
  assert.ok(/emit\(finalTranscript, true\);/.test(src));
  assert.ok(/emit\(finalTranscript \+ ' ' \+ p, false\);/.test(src));
  assert.ok(/emit\(finalTranscript \+ ' ' \+ interim, /.test(src));
});

/* ---------- comportement, avec des API navigateur simulées ---------- */
const saved = new Map();
const sim = { log: null, gumError: null, scriptDelay: 0 };
function define(k, v) {
  if (!saved.has(k)) saved.set(k, Object.getOwnPropertyDescriptor(globalThis, k));
  Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
}
function undefine(k) {
  if (!saved.has(k)) saved.set(k, Object.getOwnPropertyDescriptor(globalThis, k));
  delete globalThis[k];
}
const node = kind => ({ kind, to: [], connect(x) { this.to.push(x); }, disconnect() { this.to = []; } });
class FakeRec {
  constructor(...args) { this.args = args; this.h = {}; this.waves = 0; this.finals = 0; this.removed = false; sim.log.recs.push(this); }
  on(ev, fn) { this.h[ev] = fn; }
  acceptWaveform() { this.waves++; }
  retrieveFinalResult() { this.finals++; }
  remove() { this.removed = true; }
  fire(ev, result) { if (this.h[ev]) this.h[ev]({ result }); }
}
class FakeCtx {
  constructor(opts) { this.sampleRate = (opts && opts.sampleRate) || 48000; this.closed = false; this.destination = { kind: 'dest' }; sim.log.ctx.push(this); }
  resume() { return Promise.resolve(); }
  createMediaStreamSource() { return (this.src = node('source')); }
  createScriptProcessor(...a) { this.spArgs = a; return (this.sp = node('sp')); }
  createGain() { const n = node('gain'); n.gain = { value: 1 }; return (this.gainNode = n); }
  close() { this.closed = true; return Promise.resolve(); }
}
class FakeSR { constructor() { this.starts = 0; this.stopped = false; sim.log.sr.push(this); } start() { this.starts++; } stop() { this.stopped = true; } }
const lastRec = () => sim.log.recs[sim.log.recs.length - 1];
const lastCtx = () => sim.log.ctx[sim.log.ctx.length - 1];
const wait = ms => new Promise(r => setTimeout(r, ms));
const quiet = async fn => { const e = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = e; } };

test('simulation : installation des API navigateur', () => {
  sim.log = { gum: [], recs: [], ctx: [], sr: [], scripts: [], models: [], tracks: [] };
  const store = new Map();
  define('window', globalThis);
  define('document', {
    createElement: tag => ({ tag }),
    head: { appendChild(s) { sim.log.scripts.push(s.src); setTimeout(() => { define('Vosk', { createModel: async url => { sim.log.models.push(url); return { KaldiRecognizer: FakeRec }; } }); s.onload(); }, sim.scriptDelay); } }
  });
  define('caches', { open: async name => ({ match: async k => store.get(name + '|' + k), put: async (k, r) => { store.set(name + '|' + k, r); } }) });
  sim.cache = store;
  define('fetch', async () => {
    const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(4)); c.enqueue(new Uint8Array(4)); c.close(); } });
    return new Response(body, { headers: { 'content-length': '8' } });
  });
  define('navigator', { mediaDevices: { getUserMedia: async c => {
    sim.log.gum.push(c);
    if (sim.gumError) throw sim.gumError;
    const track = { stopped: false, stop() { this.stopped = true; } };
    sim.log.tracks.push(track);
    return { getTracks: () => [track] };
  } } });
  define('AudioContext', FakeCtx);
  undefine('SpeechRecognition'); undefine('webkitSpeechRecognition');
  assert.ok(speech.speechSupported());
});

test('arrêt pendant le chargement du modèle : le micro ne s’ouvre pas', async () => {
  sim.scriptDelay = 30;
  const statuses = [], pcts = [];
  const off = speech.onStatus(s => statuses.push(s));
  const loading = speech.ensureVosk(p => pcts.push(p));
  const p = speech.startListening({ grammar: ['bonjour'] });
  speech.stopListening();
  assert.deepEqual(await p, { engine: null });
  assert.equal(await loading, true);
  assert.equal(sim.log.gum.length, 0);
  assert.equal(speech.isListening(), false);
  assert.deepEqual(sim.log.scripts, [speech.VOSK_LIB]);
  assert.ok(sim.log.models[0].startsWith('blob:'), 'modèle chargé depuis le blob');
  assert.ok(sim.cache.has('vosk-model-v1|' + speech.MODEL_URL), 'modèle mis en cache vosk-model-v1');
  assert.deepEqual(pcts, [50, 99]);
  assert.deepEqual(statuses, ['', '🎙 Moteur vocal : chargement\u2026', '🎙 Moteur vocal : téléchargement 50 % (1re fois seulement)',
    '🎙 Moteur vocal : téléchargement 99 % (1re fois seulement)', '🎙 Moteur vocal prêt ✓ — la voix reste sur l’appareil']);
  assert.equal(speech.statusText(), '🎙 Moteur vocal prêt ✓ — la voix reste sur l’appareil');
  off();
  assert.equal(await speech.ensureVosk(), true);       /* promesse unique */
  assert.equal(sim.log.scripts.length, 1);
});

test('Vosk : grammaire + [unk], capture v11 et texte cumulé comme la v11', async () => {
  const texts = [];
  const r = await speech.startListening({ grammar: ['bonjour', 'caramel', 'bonjour', ''], onText: (t, f) => texts.push([t, f]) });
  assert.deepEqual(r, { engine: 'vosk' });
  assert.equal(speech.isListening(), true);
  assert.deepEqual(sim.log.gum.at(-1), { audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  const rec = lastRec(), ctx = lastCtx();
  assert.deepEqual(rec.args, [16000, '["bonjour","caramel","[unk]"]']);
  assert.deepEqual(ctx.spArgs, [4096, 1, 1]);
  assert.equal(ctx.gainNode.gain.value, 0);
  assert.deepEqual([ctx.src.to[0].kind, ctx.sp.to[0].kind, ctx.gainNode.to[0].kind], ['sp', 'gain', 'dest']);
  ctx.sp.onaudioprocess({ inputBuffer: {} });
  assert.equal(rec.waves, 1);
  rec.fire('partialresult', { partial: 'bonjour' });
  rec.fire('result', { text: 'bonjour' });
  rec.fire('result', { text: '' });
  rec.fire('partialresult', { partial: 'caramel' });
  assert.deepEqual(texts, [[' bonjour', false], ['bonjour ', true], ['bonjour ', true], ['bonjour  caramel', false]]);
  /* double appui : pas de second micro */
  assert.deepEqual(await speech.startListening({ grammar: ['x'] }), { engine: 'vosk' });
  assert.equal(sim.log.gum.length, 1);
});

test('resetTranscript : la fin de la phrase en cours ne revient pas', () => {
  const texts = [];
  const rec = lastRec();
  rec.h = {};
  /* on rebranche un collecteur en relançant proprement */
  speech.stopListening();
  return speech.startListening({ grammar: ['cinquante-six', 'quarante-deux'], onText: t => texts.push(t) }).then(() => {
    const r2 = lastRec();
    r2.fire('partialresult', { partial: 'cinquante-six' });
    speech.resetTranscript();
    assert.equal(r2.finals, 1, 'FinalResult demandé à Kaldi');
    r2.fire('partialresult', { partial: 'cinquante-six' });   /* morceau audio d'avant le reset */
    r2.fire('result', { text: 'cinquante-six' });            /* clôture de la phrase oubliée */
    r2.fire('partialresult', { partial: 'quarante-deux' });
    r2.fire('result', { text: 'quarante-deux' });
    assert.deepEqual(texts.map(t => t.trim()), ['cinquante-six', '', '', 'quarante-deux', 'quarante-deux']);
    speech.resetTranscript();                                  /* hors phrase : rien à ignorer */
    assert.equal(r2.finals, 1);
    r2.fire('partialresult', { partial: 'cinquante-six' });
    assert.equal(texts.at(-1).trim(), 'cinquante-six');
  });
});

test('stopListening libère micro, contexte audio et reconnaisseur', () => {
  const rec = lastRec(), ctx = lastCtx(), track = sim.log.tracks.at(-1);
  speech.stopListening();
  assert.equal(speech.isListening(), false);
  assert.ok(rec.removed && ctx.closed && track.stopped);
  assert.equal(ctx.sp.onaudioprocess, null);
});

test('grammaire null : reconnaissance libre', async () => {
  assert.deepEqual(await speech.startListening({ grammar: null }), { engine: 'vosk' });
  assert.deepEqual(lastRec().args, [16000]);
  speech.stopListening();
});

test('micro refusé ou absent : codes v11 et messages ERR_MSG', async () => {
  for (const [name, code] of [['NotAllowedError', 'not-allowed'], ['SecurityError', 'not-allowed'], ['NotFoundError', 'audio-capture']]) {
    sim.gumError = { name };
    const errors = [];
    const r = await speech.startListening({ grammar: ['a'], onError: (c, m) => errors.push([c, m]) });
    assert.deepEqual(r, { engine: null }, name);
    assert.deepEqual(errors, [[code, speech.ERR_MSG[code]]], name);
    assert.equal(speech.isListening(), false);
  }
  sim.gumError = null;
});

test('autre erreur Vosk → secours Web Speech (fr-FR, relance onend à 200 ms)', async () => {
  sim.gumError = { name: 'AbortError' };
  define('SpeechRecognition', FakeSR);
  const texts = [];
  const r = await quiet(() => speech.startListening({ grammar: ['a'], onText: (t, f) => texts.push([t, f]) }));
  assert.deepEqual(r, { engine: 'webspeech' });
  assert.equal(speech.statusText(), '🎙 Moteur intégré indisponible → reconnaissance Google en secours', 'statut (2.2) : la voix passe par Google');
  assert.ok(lastCtx().closed, 'Vosk arrêté avant le secours');
  const sr = sim.log.sr.at(-1);
  assert.equal(sr.lang, 'fr-FR'); assert.equal(sr.continuous, true); assert.equal(sr.interimResults, true);
  assert.equal(sr.starts, 1);
  const res = (isFinal, transcript) => Object.assign([{ transcript }], { isFinal });
  sr.onresult({ resultIndex: 0, results: [res(false, 'cinquante')] });
  speech.resetTranscript();
  sr.onresult({ resultIndex: 0, results: [res(true, 'cinquante six'), res(false, 'quarante')] });
  sr.onresult({ resultIndex: 1, results: [res(true, 'cinquante six'), res(true, 'quarante deux')] });
  assert.deepEqual(texts.map(([t, f]) => [t.trim(), f]), [['cinquante', false], ['quarante', false], ['quarante deux', true]]);
  sr.onend();
  await wait(260);
  assert.equal(sr.starts, 2, 'relance après onend');
  speech.stopListening();
  assert.ok(sr.stopped);
  sr.onend();
  await wait(260);
  assert.equal(sr.starts, 2, 'pas de relance après stopListening');
  sim.gumError = null;
});

test('aucun moteur disponible → onError(unsupported, COMPAT_MSG)', async () => {
  sim.gumError = { name: 'AbortError' };
  undefine('SpeechRecognition');
  const errors = [];
  const r = await quiet(() => speech.startListening({ grammar: ['a'], onError: (c, m) => errors.push([c, m]) }));
  assert.deepEqual(r, { engine: null });
  assert.deepEqual(errors, [['unsupported', speech.COMPAT_MSG]]);
  sim.gumError = null;
});

test('simulation : nettoyage des API navigateur', () => {
  speech.stopListening();
  for (const [k, d] of saved) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
  saved.clear();
  assert.equal(typeof globalThis.document, 'undefined');
});
