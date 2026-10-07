/* ============ CAPTURE DU MICRO SUR LE FIL AUDIO (v2.2.3) ============
   Chargé par js/core/speech.js (audioWorklet.addModule) : regroupe les blocs de 128 échantillons du micro en morceaux de
   4096 (256 ms à 16 kHz, comme le ScriptProcessor de la v11) et les envoie à la page par le port du nœud. Le
   ScriptProcessor de la v11 tournait sur le fil principal : quand le jeu l'occupait (téléphone lent), le navigateur
   PERDAIT des morceaux de son (mesuré, fil principal occupé à 90 % : 1 réponse sur 8 comprise ; 8 sur 8 ici).
   Ici, le son est copié sur le fil audio, prioritaire ; les messages attendent la page sans se perdre.
   Aucun import : ce fichier vit dans l'AudioWorkletGlobalScope. */
const SIZE = 4096;

class CaramelMic extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(SIZE);
    this.n = 0;
    this.on = true;
    this.port.onmessage = e => { if (e.data === 'stop') this.on = false; };
  }
  process(inputs) {
    if (!this.on) return false;
    const ch = inputs[0] && inputs[0][0];
    /* pas d'entrée (piste coupée) : des blocs de silence, pour que la page voie le temps passer */
    const len = ch ? ch.length : 128;
    for (let i = 0; i < len; i++) {
      this.buf[this.n++] = ch ? ch[i] : 0;
      if (this.n === SIZE) {
        this.port.postMessage(this.buf, [this.buf.buffer]);
        this.buf = new Float32Array(SIZE);
        this.n = 0;
      }
    }
    return true;
  }
}

registerProcessor('caramel-mic', CaramelMic);
