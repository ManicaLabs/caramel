/* Générateur factice (banc d'essai) : produits des tables, avec clé Leitner. */
export const axis = 'ma.faits';
export function gen(A, rng, opts = {}) {
  for (let i = 0; i < 20; i++) {
    const a = rng.int(2, 9), b = rng.int(2, 9);
    const it = make(a, b, A);
    if (!opts.avoid || !opts.avoid.has(it.key)) return it;
  }
  return make(rng.int(2, 9), rng.int(2, 9), A);
}
export function fromKey(key, A) {
  const m = /^ma\.faits:(\d+)x(\d+)$/.exec(key);
  return m ? make(Number(m[1]), Number(m[2]), A) : null;
}
function make(a, b, A) {
  return {
    axis, kind: 'mul', key: 'ma.faits:' + Math.min(a, b) + 'x' + Math.max(a, b), A,
    prompt: a + ' × ' + b + ' = …', answer: a * b,
    hint: 'Pense à la table de ' + b + ' : compte de ' + b + ' en ' + b + '.',
    explain: a + ' × ' + b + ' = ' + (a * b) + '.',
    autoMs: 3000, leitner: true
  };
}
