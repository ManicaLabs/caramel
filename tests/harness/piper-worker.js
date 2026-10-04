/* ============ VOIX PIPER : WORKER (prototype PT-proto) ============
   Fait tourner le moteur (piper-engine.js) hors du fil principal : une synthèse de 0,2 à 3 s ne fige pas l'écran.
   Messages reçus : { type: 'init', files } puis { type: 'synth', id, text, params? }.
   Messages envoyés : 'log', 'ready' { timings, sampleRate }, 'sentence' { id, index, count, phonemes, pcm, … } (une par
   phrase, dès qu'elle est prête : la lecture commence avant la fin du calcul), 'done' { id }, 'error' { id, message }. */
import { boot, PARAMS } from './piper-engine.js';

let engine = null;
const log = text => postMessage({ type: 'log', text });
/* une erreur hors promesse attendue (colle emscripten) ne doit pas laisser la page attendre pour rien */
self.addEventListener('unhandledrejection', e => postMessage({ type: 'error', message: 'rejet non géré : ' + ((e.reason && e.reason.message) || e.reason) }));
self.addEventListener('error', e => postMessage({ type: 'error', message: 'erreur : ' + (e.message || e) }));

self.onmessage = async ({ data: m }) => {
  try {
    if (m.type === 'init') {
      engine = await boot(m.files, log);
      postMessage({ type: 'ready', timings: engine.timings, sampleRate: engine.sampleRate });
    } else if (m.type === 'synth') {
      if (!engine) throw new Error('moteur non chargé');
      for await (const s of engine.sentences(m.text, m.params || PARAMS)) {
        postMessage({ type: 'sentence', id: m.id, ...s }, [s.pcm.buffer]);
      }
      postMessage({ type: 'done', id: m.id });
    }
  } catch (e) {
    postMessage({ type: 'error', id: m.id, message: (e && e.message) || String(e) });
  }
};
