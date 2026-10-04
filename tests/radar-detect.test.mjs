/* Détection automatique du radar photographié (js/ui/radar-detect.js, CDC §8.3).
   Fiches synthétiques au style Repères 2026 rastérisées ici en JS (déterministes, sans dépendance) : la scène est
   décrite dans le repère du gabarit (centre en 0, cercle +++ de rayon 1, haut vers −y) et chaque pixel y est ramené par
   l'homographie inverse (rotation, perspective légère), avec anticrénelage des traits par la distance.
   Le banc d'essai navigateur (tests/harness/radar-detect.html) produit des fiches plus réalistes et des photos simulées ;
   les mesures sur 180 photos déformées (R1), 664 photos simulées et non-fiches (R2) et sur les vraies photos de fiches
   CM2 (R3, jamais versées au dépôt) sont dans les rapports de la v2.1. */
import { test, assert } from './_t.mjs';
import { detectRadar, rectify, projectPoint, thetaFromRadius, radiusFromTheta, RINGS, BAG_R } from '../js/ui/radar-detect.js';
import { ficheTemplate } from '../js/core/axes.js';
import { makeRng } from '../js/core/rng.js';

/* ---------- petite algèbre ---------- */
const mul = (A, B) => { const C = new Array(9).fill(0); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) C[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j]; return C; };
function inv(H) {
  const [a, b, c, d, e, f, g, h, i] = H;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
const ap = (H, x, y) => { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; };

/* ---------- couleurs relevées sur les maquettes DEPP ---------- */
const PAL = {
  fr: { fill: [169, 222, 226], z1: [215, 236, 239], z2: [222, 240, 242], z3: [233, 244, 246], halo: [244, 249, 250], arc: [167, 220, 224],
    outline: [75, 94, 107], ray: [143, 154, 163], ring: [108, 123, 134] },
  ma: { fill: [255, 192, 149], z1: [254, 232, 218], z2: [254, 236, 222], z3: [254, 240, 231], halo: [254, 245, 238], arc: [254, 190, 147],
    outline: [90, 85, 82], ray: [155, 149, 143], ring: [122, 116, 111] }
};
const NAVY = [46, 58, 99], PAPER = [251, 251, 249];
const frac = t => (t === null ? 0 : radiusFromTheta(t));

/* distance d'un point à un segment */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/* fiche rastérisée : { width, height, data } + vérité { center, R, rotation } */
export function renderFiche({ W = 520, H = 660, cx = 260, cy = 300, R = 160, rot = 0, tilt = [0, 0], classe = 'CM2', subject = 'fr', values, noise = 5, seed = 1, axesOn = true, rings = true,
  glyphsOn = true, cast = [1, 1, 1] }) {
  const tpl = ficheTemplate(classe, subject);
  const P = PAL[subject];
  const n = tpl.axes.length;
  const ang = tpl.axes.map(a => a.angle * Math.PI / 180);
  const vx = tpl.axes.map((a, i) => frac(values[i]) * Math.sin(ang[i])), vy = tpl.axes.map((a, i) => -frac(values[i]) * Math.cos(ang[i]));
  const c = Math.cos(rot * Math.PI / 180) * R, s = Math.sin(rot * Math.PI / 180) * R;
  const Hm = mul([c, -s, cx, s, c, cy, 0, 0, 1], [1, 0, 0, 0, 1, 0, tilt[0], tilt[1], 1]);
  const Hi = inv(Hm);
  const px = 1 / R;                                     /* taille d'un pixel dans le repère du gabarit */
  const rng = makeRng('fiche-test-' + seed);
  const data = new Uint8ClampedArray(W * H * 4);
  const glyphs = [[0, -RINGS[0]], [-0.041, -RINGS[1]], [0.041, -RINGS[1]], [-0.082, -1], [0, -1], [0.082, -1]];
  const inPoly = (x, y) => {
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      if ((vy[i] > y) !== (vy[j] > y) && x < (vx[j] - vx[i]) * (y - vy[i]) / (vy[j] - vy[i]) + vx[i]) inside = !inside;
    }
    return inside;
  };
  for (let yy = 0; yy < H; yy++) {
    for (let xx = 0; xx < W; xx++) {
      const [u, v] = ap(Hi, xx, yy);
      const r = Math.hypot(u, v);
      let col = PAPER.slice();
      const over = (k, a) => { if (a > 0) for (let q = 0; q < 3; q++) col[q] += (k[q] - col[q]) * Math.min(1, a); };
      const line = (d, w) => Math.max(0, Math.min(1, 0.5 + (w / 2 - d) / px));
      /* titre et texte de la page (hors du radar) */
      if (v < -1.55 && v > -1.75 && Math.abs(u) < 1.1 && (Math.floor((u + 2) * 9) % 3)) over(NAVY, 0.9);
      if (v > 1.5 && v < 1.95 && Math.abs(u) < 1.2 && (Math.floor((v - 1.5) * 25) % 2) && (Math.floor((u + 3) * 23) % 4)) over([90, 90, 100], 0.8);
      if (r < 1.32) {
        if (r < 1.065) over(P.halo, 1);
        if (r < 1) over(P.z3, 1);
        if (r < RINGS[1]) over(P.z2, 1);
        if (r < RINGS[0]) over(P.z1, 1);
        /* bande des familles et pictogrammes */
        if (r > 1.08 && r < 1.19 && (Math.floor((Math.atan2(u, -v) / Math.PI + 1) * 9) % 5 !== 4)) over(P.arc, 1);
        for (let i = 0; i < n; i++) {
          const d = Math.hypot(u - 1.13 * Math.sin(ang[i]), v + 1.13 * Math.cos(ang[i]));
          if (d < 0.095) over(d < 0.04 ? NAVY : P.arc, 1);
        }
        if (inPoly(u, v)) over(P.fill, 1);
        /* cercles pointillés */
        if (rings) {
          const a = Math.atan2(u, -v) + Math.PI;
          RINGS.forEach((f, j) => {
            const per = j < 2 ? 0.042 : 0.02, dash = j < 2 ? 0.024 : 0.01;
            if (((a * f) % per) < dash) over(P.ring, line(Math.abs(r - f), 0.007));
          });
        }
        /* axes (ou mention écrite le long d'un axe absent) */
        for (let i = 0; i < n && axesOn; i++) {
          const ex = Math.sin(ang[i]), ey = -Math.cos(ang[i]);
          if (values[i] === null) {
            const t = u * ex + v * ey, lat = Math.abs(u * ey - v * ex);
            if (t > 0.25 && t < 0.95 && lat < 0.014 && (Math.floor(t * 70) % 3 !== 2) && (Math.floor(t * 211) % 2)) over([74, 85, 96], 0.85);
            continue;
          }
          over(P.ray, line(segDist(u, v, 0.19 * ex, 0.19 * ey, 1.05 * ex, 1.05 * ey), 0.008));
        }
        /* contour du polygone, pastilles blanches cerclées */
        for (let i = 0; i < n; i++) { const j = (i + 1) % n; over(P.outline, line(segDist(u, v, vx[i], vy[i], vx[j], vy[j]), 0.009)); }
        for (let i = 0; i < n; i++) {
          if (values[i] === null) continue;
          const d = Math.hypot(u - vx[i], v - vy[i]);
          if (d < 0.024) { over(P.outline, line(Math.abs(d - 0.0165), 0.008)); if (d < 0.0125) over([255, 255, 255], 1); }
        }
        /* repères ⊕ */
        for (const [gx, gy] of glyphsOn ? glyphs : []) {
          const dx = u - gx, dy = v - gy, d = Math.hypot(dx, dy);
          if (d < 0.0235) over((Math.abs(dx) < 0.004 && Math.abs(dy) < 0.013) || (Math.abs(dy) < 0.004 && Math.abs(dx) < 0.013) ? [255, 255, 255] : NAVY, 1);
        }
        /* disque du cartable, cartable, étiquette du prénom */
        if (r < BAG_R) over(P.z1, 1);
        if (Math.abs(u) < 0.08 && v > -0.13 && v < 0.07) over([180, 82, 63], 1);
        if (Math.abs(u) < 0.21 && v > 0.065 && v < 0.135) over(Math.abs(u) > 0.2 || v < 0.072 || v > 0.128 ? NAVY : [255, 255, 255], 1);
      }
      const o = (yy * W + xx) * 4;
      /* lumière de la photo (dominante, exposition) : multiplie chaque canal */
      for (let q = 0; q < 3; q++) data[o + q] = col[q] * cast[q] + (rng.next() + rng.next() - 1) * noise;
      data[o + 3] = 255;
    }
  }
  const [tcx, tcy] = ap(Hm, 0, 0), [ux, uy] = ap(Hm, 0, -0.5);
  let rs = 0;
  for (let k = 0; k < 72; k++) { const a = k * 5 * Math.PI / 180; const [x, y] = ap(Hm, Math.sin(a), -Math.cos(a)); rs += Math.hypot(x - tcx, y - tcy); }
  return { image: { width: W, height: H, data }, truth: { cx: tcx, cy: tcy, R: rs / 72, rotation: Math.atan2(ux - tcx, -(uy - tcy)) * 180 / Math.PI } };
}
const templatesFor = classe => ({ fr: ficheTemplate(classe, 'fr'), ma: ficheTemplate(classe, 'ma') });
const angDiff = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
function checkReading(res, truth, values, tolTheta) {
  assert.ok(res.ok, 'radar trouvé (' + res.reason + ', ' + JSON.stringify(res.debug) + ')');
  assert.ok(Math.hypot(res.center.x - truth.cx, res.center.y - truth.cy) < 0.02 * truth.R, 'centre à moins de 2 % de R');
  assert.ok(Math.abs(res.R / truth.R - 1) < 0.02, 'R à moins de 2 %');
  assert.ok(angDiff(res.rotation, truth.rotation) < 1.5, 'rotation à 1,5° près (' + res.rotation.toFixed(1) + ' / ' + truth.rotation.toFixed(1) + ')');
  values.forEach((t, i) => {
    const got = res.axes[i].theta;
    if (t === null) assert.equal(got, null, 'axe ' + i + ' absent');
    else assert.ok(got !== null && Math.abs(got - t) <= tolTheta, 'axe ' + i + ' : lu ' + got + ', attendu ' + t);
  });
}

test('échelle de la fiche : cercles mesurés (+ 0,5104, ++ 0,7553, +++ 1) et réciprocité θ ↔ rayon', () => {
  assert.equal(thetaFromRadius(RINGS[0]), 1);
  assert.equal(thetaFromRadius(RINGS[1]), 2);
  assert.equal(thetaFromRadius(1), 3);
  assert.equal(thetaFromRadius(0), 0);
  assert.equal(thetaFromRadius(1.2), 3);
  for (let t = 0; t <= 3.0001; t += 0.1) assert.ok(Math.abs(thetaFromRadius(radiusFromTheta(t)) - t) < 1e-9, 'θ = ' + t.toFixed(1));
});

test('fiche CM2 français droite : centre, rayon, matière, 9 valeurs et absences', () => {
  const values = [2.8, null, 1.6, 3, 1.2, 0.8, 2.4, null, 3];
  const { image, truth } = renderFiche({ classe: 'CM2', subject: 'fr', values });
  const res = detectRadar(image, { templates: templatesFor('CM2') });
  assert.equal(res.subject, 'fr');
  assert.equal(res.axes.length, 9);
  checkReading(res, truth, values, 0.2);
  assert.ok(res.confidence >= 0.6, 'confiance ' + res.confidence);
  assert.equal(res.template.subject, 'fr');
});

test('fiche CM2 maths tournée de 14° et vue un peu de biais : lecture juste', () => {
  const values = [1.5, 2.2, 3, 0.9, null, 2.7, 1.9];
  const { image, truth } = renderFiche({ classe: 'CM2', subject: 'ma', values, rot: 14, tilt: [0.06, -0.05], noise: 8, seed: 2 });
  const res = detectRadar(image, { templates: templatesFor('CM2') });
  assert.equal(res.subject, 'ma');
  checkReading(res, truth, values, 0.25);
  /* l'ellipse du cercle +++ trahit la perspective */
  assert.ok(res.ellipse && res.ellipse.rx > 0 && res.ellipse.ry > 0);
});

test('CE2 : le nombre d’axes départage français (11) et maths (9), rotation −17°', () => {
  const values = [2.1, 1.4, 2.9, 0.7, 1.8, 2.5, null, 1.1, 2.2, 3, 1.6];
  const { image, truth } = renderFiche({ classe: 'CE2', subject: 'fr', values, rot: -17, seed: 3, R: 170, cy: 310 });
  const res = detectRadar(image, { templates: templatesFor('CE2') });
  assert.equal(res.subject, 'fr');
  assert.equal(res.axes.length, 11);
  checkReading(res, truth, values, 0.25);
});

test('vue redressée et projection : le sommet lu tombe sur la pastille', () => {
  const values = [3, 2, 1, 2.5, 1.5, 3, 2];
  const { image } = renderFiche({ classe: 'CM2', subject: 'ma', values, seed: 4 });
  const res = detectRadar(image, { templates: templatesFor('CM2') });
  assert.ok(res.ok);
  const v = rectify(image, res, { size: 300, extent: 1.3 });
  assert.equal(v.width, 300);
  assert.equal(v.data.length, 300 * 300 * 4);
  assert.ok(Math.abs(v.R - 300 / 2.6) < 1e-9);
  /* centre de la vue : disque clair du cartable (pas le papier blanc du bord) */
  const c = (150 * 300 + 150) * 4;
  assert.ok(v.data[c + 3] === 255);
  /* le sommet de l'axe 0 (θ = 3) est sur le cercle +++ : la projection du gabarit y conduit */
  const [x, y] = projectPoint(res, res.axes[0].r, res.axes[0].angle);
  assert.ok(Math.hypot(x - res.axes[0].x, y - res.axes[0].y) < 1.5);
});

test('ce qui n’est pas une fiche : échec propre (ok:false), jamais d’exception', () => {
  const W = 400, H = 400;
  const blank = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4).fill(240) };
  const rng = makeRng('bruit');
  const noisy = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4).map(() => Math.floor(rng.next() * 256)) };
  for (const img of [blank, noisy]) {
    const res = detectRadar(img, { templates: templatesFor('CM2') });
    assert.equal(res.ok, false);
    assert.equal(typeof res.reason, 'string');
  }
  /* trois cercles pointillés aux bons rapports, mais ni axes ni polygone : pas une fiche */
  const { image } = renderFiche({ classe: 'CM2', subject: 'fr', values: Array(9).fill(null), axesOn: false, seed: 5 });
  assert.equal(detectRadar(image, { templates: templatesFor('CM2') }).ok, false);
  /* entrées invalides */
  assert.equal(detectRadar(null, { templates: templatesFor('CM2') }).ok, false);
  assert.equal(detectRadar(blank, {}).reason, 'gabarit');
});

test('lumière chaude (photo sous une lampe) : la matière est lue dans le radar, rapportée au blanc du papier', () => {
  /* sur les vraies photos, la teinte de la photo entière désignait les maths pour une fiche de français */
  const warm = [1.08, 0.93, 0.72];
  const vf = [2.3, 2.3, 2.0, 3, 3, 2.3, 1.5, 1.3, 1.8];
  const fr = renderFiche({ classe: 'CM2', subject: 'fr', values: vf, cast: warm, seed: 6 });
  const rf = detectRadar(fr.image, { templates: templatesFor('CM2') });
  assert.equal(rf.subject, 'fr');
  assert.equal(rf.subjectColor, 'fr');
  checkReading(rf, fr.truth, vf, 0.2);
  const vm = [1.4, 1.3, 1.5, 1.5, 1.8, 3, 0.7];
  const ma = renderFiche({ classe: 'CM2', subject: 'ma', values: vm, cast: warm, seed: 7 });
  const rm = detectRadar(ma.image, { templates: templatesFor('CM2') });
  assert.equal(rm.subject, 'ma');
  assert.equal(rm.subjectColor, 'ma');
});

test('photo sombre (exposition × 0,45) : traits rapportés au fond local, lecture juste', () => {
  const values = [2.5, 2.4, 1.4, 2.7, 3, 3, 1.8];
  const { image, truth } = renderFiche({ classe: 'CM2', subject: 'ma', values, cast: [0.45, 0.45, 0.45], noise: 3, seed: 8, rot: -6 });
  const res = detectRadar(image, { templates: templatesFor('CM2') });
  checkReading(res, truth, values, 0.2);
});

test('fiche de français à quatre absences : bon gabarit (9 axes), absences reconnues, sommet posé sur un cercle lu sans aimantation', () => {
  /* disposition d'une vraie fiche CM2 (valeurs seules) : 4 mentions « absence » le long des axes, un sommet sur le cercle ++ */
  const values = [null, null, 2.5, null, null, 2.34, 2, 0.97, 2.58];
  const { image, truth } = renderFiche({ classe: 'CM2', subject: 'fr', values, seed: 9, rot: 3 });
  const res = detectRadar(image, { templates: templatesFor('CM2') });
  assert.equal(res.subject, 'fr');
  assert.equal(res.axes.length, 9);
  checkReading(res, truth, values, 0.15);
  assert.ok(Math.abs(res.axes[6].theta - 2) <= 0.05, 'sommet sur le cercle ++ : lu ' + res.axes[6].theta);
});

test('radar sans repères ⊕ (graphique radar ordinaire aux mêmes cercles) : jamais lu comme une fiche', () => {
  const values = [2.1, 1.4, 2.9, 0.7, 1.8, 2.5, 1.2];
  const { image } = renderFiche({ classe: 'CM2', subject: 'ma', values, glyphsOn: false, seed: 10 });
  const res = detectRadar(image, { templates: templatesFor('CM2') });
  assert.equal(res.ok, false);
});


test('photo granuleuse, petit radar : les « cercles » que le grain fait voir partout ne l’emportent pas', () => {
  /* grand cliché très bruité (lumière faible, JPEG compressé) : le cercle imprimé ressort du grain, les triplets de
     « cercles » trouvés dans le bruit non (ils s'ajustent pourtant très bien) ; budget de temps levé : test déterministe */
  const cases = [
    ['fr', [2.3, 2.3, 2.0, 3, 3, 2.3, 1.5, 1.3, 1.8], 60, 34],
    ['ma', [2.5, 2.4, 1.4, 2.7, 3, 3, 1.8], 80, 39]
  ];
  for (const [subject, values, noise, seed] of cases) {
    const { image, truth } = renderFiche({ W: 1200, H: 1600, cx: 560, cy: 760, R: 170, rot: 5, tilt: [0.03, -0.02], classe: 'CM2', subject, values, noise, seed });
    const res = detectRadar(image, { templates: templatesFor('CM2'), budgetMs: 60000 });
    assert.equal(res.subject, subject);
    checkReading(res, truth, values, 0.3);
  }
});
