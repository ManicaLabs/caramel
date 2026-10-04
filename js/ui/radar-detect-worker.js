/* ============ WORKER (module) : DÉTECTION DU RADAR HORS DU FIL PRINCIPAL ============
   Reçoit { id, width, height, buffer (RGBA transféré), opts: { templates, subject, viewSize, viewExtent } }
   → renvoie { id, res, view: { width, height, R, extent, buffer } | null } (vue redressée pour l'affichage), ou { id, error }.
   L'animation « Je cherche le radar… » reste fluide pendant l'analyse (jusqu'à ~1 s sur un téléphone moyen).
   La photo ne quitte jamais l'appareil : tout se passe en mémoire, rien n'est enregistré. */

import { detectRadar, rectify } from './radar-detect.js';

self.onmessage = e => {
  const msg = e.data || {};
  const { id, width, height, buffer } = msg;
  const opts = msg.opts || {};
  try {
    const image = { width, height, data: new Uint8ClampedArray(buffer) };
    const res = detectRadar(image, opts);
    let view = null;
    if (res && res.homography && opts.viewSize > 0) {
      const extent = opts.viewExtent || 1.3;
      const v = rectify(image, res, { size: Math.round(opts.viewSize), extent });
      view = { width: v.width, height: v.height, R: v.R, extent, buffer: v.data.buffer };
    }
    /* les gabarits reviennent tels quels (copie structurée) ; la vue est transférée sans copie */
    self.postMessage({ id, res, view }, view ? [view.buffer] : []);
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
