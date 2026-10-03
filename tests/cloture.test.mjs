/* Logique du jeu « Le Chemin de la clôture » (js/games/cloture-logic.js), vérifiée sur des items réels
   du générateur ma.ligne (js/content/maths/ligne.js) : piquets, échelle, aimantation, tolérance,
   saisie au pavé, fractions, plaquettes, indice, caméra du zoom, saut du compagnon. */
import { test, assert } from './_t.mjs';
import { makeRng } from '../js/core/rng.js';
import { gen } from '../js/content/maths/ligne.js';
import * as C from '../js/games/cloture-logic.js';

const NNBSP = '\u202f';
/* échantillon : 57 niveaux × 40 graines */
const ITEMS = [];
for (let ai = 0; ai <= 56; ai++) for (let s = 0; s < 40; s++) ITEMS.push(gen(ai / 10, makeRng(1000 * ai + s)));
const planeOf = d => d.zoom || d;

test('piquets : n + 1 piquets, bornes exactes, grands piquets aux multiples absolus de major', () => {
  for (const it of ITEMS) {
    for (const p of [it.data, it.data.zoom].filter(Boolean)) {
      const ps = C.posts(p);
      assert.equal(ps.length, C.intervals(p) + 1, it.key);
      assert.ok(C.sameValue(ps[0].v, p.min) && C.sameValue(ps[ps.length - 1].v, p.max), it.key);
      for (const q of ps) assert.equal(q.major, Math.abs(q.v / p.major - Math.round(q.v / p.major)) < 1e-6, it.key + ' ' + q.v);
      /* chaque plaquette est posée sur un piquet */
      for (const l of p.labels) assert.ok(ps.some(q => C.sameValue(q.v, l.v)), it.key + ' plaquette ' + l.text);
      assert.ok(ps.length <= 21, 'au plus 20 petits intervalles');
    }
  }
});

test('piquets : 0,1 et 1/3 ne dérivent pas (marge 1e-6)', () => {
  const p = { min: 3, max: 5, major: 0.5, minor: 0.1, labels: [] };
  const ps = C.posts(p);
  assert.equal(ps.length, 21);
  assert.equal(ps[7].v, 3.7);
  assert.deepEqual(ps.filter(q => q.major).map(q => q.v), [3, 3.5, 4, 4.5, 5]);
  const f = { min: 0, max: 2, major: 1, minor: 1 / 3, labels: [] };
  const fs = C.posts(f);
  assert.equal(fs.length, 7);
  assert.deepEqual(fs.filter(q => q.major).map(q => q.i), [0, 3, 6]);
  assert.ok(C.sameValue(fs[4].v, 4 / 3));
});

test('échelle : aller-retour valeur ↔ x', () => {
  const s = C.makeScale(400, 500, 68, 372);
  assert.equal(s.toX(400), 68);
  assert.equal(s.toX(500), 372);
  assert.equal(s.toX(450), 220);
  for (const v of [400, 412.5, 433, 499.99]) assert.ok(Math.abs(s.toV(s.toX(v)) - v) < 1e-9);
  const z = C.makeScale(20.91, 20.92, 0, 300);
  assert.ok(Math.abs(z.toX(20.917) - 210) < 1e-6);
});

test('placer : chaque cible est atteignable (aimant ou grille fine) et jugée juste', () => {
  let n = 0;
  for (const it of ITEMS) {
    const d = it.data;
    if (d.mode !== 'placer') continue;
    n++;
    const p = planeOf(d);
    const q = C.quantize(p, d.value, d.snap);
    assert.ok(C.sameValue(q, d.value), it.key + ' : ' + q + ' ≠ ' + d.value);
    assert.ok(C.isCorrectPlace(d, q), it.key);
    /* à partir du début, les flèches atteignent la cible exactement */
    let v = C.nudge(p, null, +1, d.snap), steps = 0;
    assert.equal(v, p.min);
    while (!C.sameValue(v, d.value) && steps < 400) { v = C.nudge(p, v, +1, d.snap); steps++; }
    assert.ok(C.sameValue(v, d.value), it.key + ' inatteignable aux flèches');
    /* aimanté : le piquet voisin est faux ; à l'estime : une grille fine plus loin que la tolérance est fausse */
    if (d.snap) {
      for (const w of [d.value - p.minor, d.value + p.minor]) {
        if (w >= p.min - 1e-9 && w <= p.max + 1e-9) assert.ok(!C.isCorrectPlace(d, C.quantize(p, w, true)), it.key + ' voisin ' + w);
      }
    } else {
      const far = d.value + d.tolerance + C.fineStep(p, false);
      if (far <= p.max) assert.ok(!C.isCorrectPlace(d, C.quantize(p, far, false)), it.key + ' estime trop loin');
    }
  }
  assert.ok(n > 300, 'assez d’items « placer » : ' + n);
});

test('placer : aimantation et bornes', () => {
  const p = { min: 400, max: 500, major: 100, minor: 10, labels: [] };
  assert.equal(C.quantize(p, 433, true), 430);
  assert.equal(C.quantize(p, 436, true), 440);
  assert.equal(C.quantize(p, 433, false), 433);
  assert.equal(C.quantize(p, 9999, true), 500);
  assert.equal(C.quantize(p, -3, false), 400);
  assert.equal(C.nudge(p, 500, +1, true), 500);
  assert.equal(C.nudge(p, 430, -1, false), 429);
  const f = { min: 0, max: 2, major: 1, minor: 0.125, labels: [] };
  assert.ok(C.sameValue(C.quantize(f, 1.4, true), 11 / 8));
  assert.ok(C.isCorrectPlace({ value: 11 / 8, tolerance: 0.0625 }, C.quantize(f, 1.4, true)));
  assert.ok(!C.isCorrectPlace({ value: 11 / 8, tolerance: 0.0625 }, 1.5));
  assert.ok(!C.isCorrectPlace({ value: 1, tolerance: 0.1 }, null));
  assert.equal(C.positionText(p, null, true), 'Carotte pas encore posée');
  assert.equal(C.positionText(p, 430, true), 'Carotte sur le piquet 4 sur 11');
  assert.equal(C.positionText(p, 425, false), 'Carotte à 25' + NNBSP + '% de la clôture');
});

test('lire : saisie au pavé comparée à la réponse (virgule, espaces, zéros)', () => {
  assert.ok(C.answerMatches('430', 430));
  assert.ok(C.answerMatches('1,2', 1.2));
  assert.ok(C.answerMatches('20,917', 20.917));
  assert.ok(C.answerMatches('12,50', 12.5));
  assert.ok(C.answerMatches('750' + NNBSP + '810' + NNBSP + '000', 750810000));
  assert.ok(C.answerMatches('0,3', 0.1 + 0.2));
  assert.ok(!C.answerMatches('43', 430));
  assert.ok(!C.answerMatches('', 0));
  assert.ok(!C.answerMatches('1,2,3', 1.23));
  for (const it of ITEMS) {
    if (it.data.mode !== 'lire' || it.choices) continue;
    assert.ok(C.answerMatches(it.data.text.replace(/\u202f/g, ''), it.answer), it.key);
    assert.ok(C.keypadLen(it.answer) >= it.data.text.replace(/\u202f/g, '').length, it.key);
  }
});

test('lire : QCM — la réponse est parmi les choix, une seule fois', () => {
  for (const it of ITEMS) {
    if (!it.choices) continue;
    const hits = it.choices.filter(c => Math.abs(c.value - it.answer) < 1e-9);
    assert.equal(hits.length, 1, it.key);
    if (it.data.fmt === 'frac') for (const c of it.choices) assert.ok(Number.isInteger(c.num) && Number.isInteger(c.den), it.key);
  }
});

test('fractions : morceaux pour l’écriture empilée', () => {
  assert.deepEqual(C.splitFrac('7/4'), [{ t: 'frac', n: 7, d: 4 }]);
  assert.deepEqual(C.splitFrac('c’est 3/4 (trois quarts).'), [
    { t: 'txt', s: 'c’est ' }, { t: 'frac', n: 3, d: 4 }, { t: 'txt', s: ' (trois quarts).' }]);
  assert.deepEqual(C.splitFrac('1 + 2/4 = 6/4'), [
    { t: 'txt', s: '1 + ' }, { t: 'frac', n: 2, d: 4 }, { t: 'txt', s: ' = ' }, { t: 'frac', n: 6, d: 4 }]);
  assert.deepEqual(C.splitFrac('Place 47 sur la clôture.'), [{ t: 'txt', s: 'Place 47 sur la clôture.' }]);
  assert.equal(C.keepMath('400 + 30 = 430'), '400 +\u00A030 =\u00A0430');
  assert.equal(C.keepMath('c’est 2 + '), 'c’est 2 +\u00A0');          /* une fraction suit */
  assert.equal(C.keepMath('Entre 1 et 2, il y a'), 'Entre 1 et 2, il y a');
});

test('plaquettes : la police tient sans chevauchement (et reste lisible)', () => {
  const xs = [68, 96, 234];
  const w = ['9', '10', '15'].map(C.estimateWidth100);
  const f = C.fitLabelFont(xs, w);
  assert.ok(f >= 11 && f <= 17);
  for (let i = 1; i < xs.length; i++) {
    const half = j => (w[j] * f / 100 + 8) / 2;
    assert.ok(xs[i] - xs[i - 1] >= half(i) + half(i - 1) + 3 - 1e-9 || f === 11);
  }
  assert.equal(C.fitLabelFont([0, 300], [100, 100]), 17);
  assert.equal(C.fitLabelFont([0, 10], [400, 400]), 11);
  /* lignes réelles sur une clôture de 300 px : jamais sous 11 px */
  for (const it of ITEMS) {
    for (const p of [it.data, it.data.zoom].filter(Boolean)) {
      const s = C.makeScale(p.min, p.max, 0, 300);
      const g = C.fitLabelFont(p.labels.map(l => s.toX(l.v)), p.labels.map(l => C.estimateWidth100(l.text)), { min: 0 });
      assert.ok(g >= 11, it.key + ' police ' + g);
    }
  }
});

test('indice : plaquettes encadrantes, au-delà de la dernière, piquets à l’estime', () => {
  const p = { min: 9, max: 19, major: 5, minor: 1, labels: [{ v: 9, text: '9' }, { v: 10, text: '10' }, { v: 15, text: '15' }] };
  assert.deepEqual(C.hintSpan(p, 13, true), { a: 10, b: 15 });
  assert.deepEqual(C.hintSpan(p, 17, true), { a: 10, b: 15 });
  assert.equal(C.hopsBetween(p, 10, 15, true).length, 5);
  const e = { min: 900, max: 960, major: 10, minor: 10, labels: [] };
  assert.deepEqual(C.hintSpan(e, 933, false), { a: 930, b: 940 });
  assert.equal(C.hopsBetween(e, 930, 940, false).length, 6);
  assert.deepEqual(C.stepLabel({ minor: 0.01 }, 'dec'), { text: '+0,01' });
  assert.deepEqual(C.stepLabel({ minor: 1000 }, 'int'), { text: '+1' + NNBSP + '000' });
  assert.deepEqual(C.stepLabel({ minor: 1 / 6 }, 'frac'), { n: 1, d: 6 });
  for (const it of ITEMS) {
    const d = it.data, pl = planeOf(d);
    const { a, b } = C.hintSpan(pl, d.value, d.snap);
    assert.ok(a < b, it.key);
    if (!d.snap) assert.ok(a <= d.value && d.value <= b, it.key);
    const hops = C.hopsBetween(pl, a, b, d.snap);
    assert.ok(hops.length >= 1 && hops.length <= 20, it.key + ' ' + hops.length);
  }
});

test('caméra du zoom : départ = vue complète, arrivée = partie agrandie plein écran, lisse immobile', () => {
  const W = 390, H = 260, x0 = 68, x1 = 372, yRail = 160;
  const s = C.makeScale(1, 2, x0, x1);
  const X1 = s.toX(1.3), X2 = s.toX(1.4);
  const cam = C.camera({ W, H, x0, x1, X1, X2, yRail });
  assert.ok(Math.abs(cam.k - 10) < 1e-9);
  assert.deepEqual(cam.at(0).map(v => +v.toFixed(9)), [0, 0, W, H]);
  const [vx, vy, vw, vh] = cam.at(1);
  assert.ok(Math.abs(vw - W / 10) < 1e-9 && Math.abs(vh - H / 10) < 1e-9);
  /* un point (sx, sy) de la partie agrandie, placé dans le monde par sub, retombe en (sx, sy) à l'écran */
  for (const [sx, sy] of [[x0, yRail], [x1, yRail], [200, 40], [300, 230]]) {
    const wx = cam.sub.tx + sx * cam.sub.s, wy = cam.sub.ty + sy * cam.sub.s;
    assert.ok(Math.abs((wx - vx) * W / vw - sx) < 1e-6 && Math.abs((wy - vy) * H / vh - sy) < 1e-6);
  }
  /* la lisse (y = yRail) reste à la même hauteur à l'écran pendant tout le zoom */
  for (const e of [0, 0.2, 0.5, 0.8, 1]) {
    const [, y, , h] = cam.at(e);
    assert.ok(Math.abs((yRail - y) * H / h - yRail) < 1e-6);
  }
  /* zoom logarithmique : à mi-course, ×√10 */
  assert.ok(Math.abs(W / cam.at(0.5)[2] - Math.sqrt(10)) < 1e-9);
  assert.equal(C.easeInOut(0), 0);
  assert.equal(C.easeInOut(1), 1);
  assert.ok(Math.abs(C.easeInOut(0.5) - 0.5) < 1e-12);
});

test('compagnon : saut en arc et durées bornées', () => {
  const pts = C.arcPoints(30, 100, 230, 100, 40, 16);
  assert.equal(pts.length, 17);
  assert.deepEqual([pts[0].x, pts[0].y], [30, 100]);
  assert.deepEqual([pts[16].x, pts[16].y], [230, 100]);
  assert.ok(Math.abs(Math.min(...pts.map(p => p.y)) - 60) < 1e-9, 'sommet 40 px plus haut');
  for (const dx of [0, 10, 200, 1200]) {
    assert.ok(C.jumpMs(dx) >= 300 && C.jumpMs(dx) <= 400);
    assert.ok(C.walkMs(dx) >= 420 && C.walkMs(dx) <= 1500);
    assert.ok(C.jumpHeight(dx) >= 22 && C.jumpHeight(dx) <= 56);
  }
});

test('mise en page : ancrée en haut, place pour la mini-carte du zoom', () => {
  const a = C.sceneLayout(390, 230), b = C.sceneLayout(390, 300);
  assert.ok(b.yRail >= a.yRail);
  assert.equal(C.sceneLayout(390, 200, { lift: 10 }).yRail, C.sceneLayout(390, 400, { lift: 10 }).yRail);
  const z = C.sceneLayout(390, 260, { zoom: true, lift: 0 }), n = C.sceneLayout(390, 260, { lift: 0 });
  assert.ok(z.yRail - n.yRail >= 40);
  for (const L of [a, b, z]) {
    assert.ok(L.bigTop < L.smallTop && L.smallTop < L.yRail && L.yRail < L.yLabel && L.yLabel < L.yRail2 && L.yRail2 < L.yGround);
  }
});
