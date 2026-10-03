/* ============ PRNG DÉTERMINISTE (mulberry32) ============
   Les générateurs de contenu reçoivent toujours un rng : mêmes graines → mêmes items
   (tests reproductibles). En jeu, la graine vient de l'horloge. */

/* FNV-1a 32 bits : graine stable depuis une chaîne */
export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export function makeRng(seed = Date.now()) {
  let a = (typeof seed === 'string' ? hashSeed(seed) : Math.floor(seed)) >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    /* réel dans [a ; b[ */
    float: (lo, hi) => lo + (hi - lo) * next(),
    /* entier dans [a ; b] (bornes incluses) */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
    shuffle(arr) {
      const c = arr.slice();
      for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
      return c;
    },
    /* k éléments distincts */
    sample(arr, k) { return rng.shuffle(arr).slice(0, Math.max(0, k)); },
    /* tirage pondéré : weights[i] ≥ 0 */
    weighted(items, weights) {
      const tot = weights.reduce((s, w) => s + Math.max(0, w), 0);
      if (tot <= 0) return items[Math.floor(next() * items.length)];
      let x = next() * tot;
      for (let i = 0; i < items.length; i++) { x -= Math.max(0, weights[i]); if (x < 0) return items[i]; }
      return items[items.length - 1];
    },
    /* sous-générateur indépendant et reproductible */
    fork(label = '') { return makeRng((hashSeed(String(label)) ^ Math.floor(next() * 4294967296)) >>> 0); }
  };
  return rng;
}
