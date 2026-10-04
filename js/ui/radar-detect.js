/* ============ DÉTECTION AUTOMATIQUE DU RADAR PHOTOGRAPHIÉ (CDC §8.3) ============
   Module PUR : aucune dépendance au DOM (Node, page ou worker). Entrée : une image { width, height, data }
   (RGBA, Uint8ClampedArray ou Uint8Array), typiquement la photo réduite à 1600 px au plus par l'appelant.
   Coordonnées image : centres des pixels aux coordonnées entières (pixel (0, 0) centré en (0, 0)).

   detectRadar(image, { templates: { fr, ma } | template, subject?, hint?: { center }, budgetMs? }) →
     { ok, confidence (0-1), reason? ('pas-de-radar', 'axes-introuvables', 'confiance-faible'…),
       hint? ('hors-cadre' | 'trop-petit' | 'de-biais' : conseil de prise de vue quand la lecture est incertaine),
       center: { x, y }, R (rayon moyen du cercle +++, px), rotation (°, sens horaire : direction du « haut » de la fiche),
       ellipse: { cx, cy, rx, ry, angle } (cercle +++ vu en perspective), homography (3 × 3 en ligne : repère du gabarit →
       image ; le gabarit a son centre en (0, 0), le cercle +++ de rayon 1, le haut vers −y),
       subject ('fr' | 'ma' : gabarit retenu, le nombre d'axes départage les deux matières de la classe),
       subjectColor ('fr' | 'ma' | null : couleur de la bande des familles rapportée au papier), template,
       axes: [{ index, id, angle (angle du gabarit), theta (0-3 au dixième) | null (absent probable), confidence (0-1),
                r (fraction du rayon dans le repère du gabarit), x, y (sommet dans l'image) }],
       ms, debug }
   rectify(image, résultat, { size, extent }) → { width, height, data, R } : vue redressée du radar (haut en haut).
   projectPoint(résultat, f, angle) → [x, y] ; thetaFromRadius(f) ; radiusFromTheta(θ) ; subjectFromImage(image, H).

   Fiche Repères 2026 (maquettes DEPP au pixel natif, photos réelles de fiches CM2) : cercles pointillés + / ++ / +++ à
   0,5104 / 0,7553 / 1 R ; axes gris du disque du cartable (0,19 R) jusqu'à 1,05 R, terminés par une flèche ; le haut de la
   fiche est à mi-chemin entre deux axes et porte les repères ⊕ (disques bleu marine barrés d'un + blanc : 1 sur +, 2 sur ++,
   3 sur +++) ; polygone teinté à contour foncé, pastilles blanches cerclées aux sommets ; absence = sommet au centre et
   « Pas de positionnement : absence * » écrit le long de l'axe à la place du trait. Sur une vraie photo, les cercles
   pointillés sont pâles (gris sur papier teinté) : tous les seuils de « trait fin » sont rapportés au fond local.

   Étapes :
   1. image de travail (luminance moyennée, 640 px) ; chaque contour vote le long de son gradient : le centre commun des
      cercles concentriques ressort (pics ronds préférés aux crêtes du texte) ;
   2. pour chaque centre candidat : le long de 32 directions, triplets de traits aux rapports 0,5104 / 0,7553 / 1 → échelle ;
      puis trois cercles concentriques ajustés ensemble (Gauss-Newton, pondération robuste). Traits relevés sur l'image non
      lissée (cercles pâles d'une vraie photo) et, si rien de franc n'en sort, sur l'image lissée (photo granuleuse) ; la
      netteté des traits retenus est rapportée au bruit de la photo : les « cercles » que le grain fait voir à toutes les
      échelles sont relégués. Repli pour une photo de biais (centre voté décalé) : triplets à écart relatif fixe,
      (r2 − r1) / (r3 − r1) ≈ 0,5, qui ne dépend pas du décalage ;
   3. perspective : les trois cercles sont des ellipses dont le centre glisse en f² → homographie sans la rotation ; la part
      projective est ajustée pour que les axes, droites concourantes, soient les plus nets (photo de biais) ; profil angulaire
      des axes → gabarit (français / maths : la netteté des axes décide) et rotation modulo le pas ;
   4. homographie affinée par ajustement « point-droite » sur les cercles (mesures radiales) et les axes (mesures
      tangentielles) ; l'autre gabarit plausible est essayé, celui dont les axes sont réellement retrouvés l'emporte ; le
      « haut » est choisi par les repères ⊕ ; contrôles (axes retrouvés, ⊕ nets et vérifiés un à un, radar assez grand) :
      le premier candidat qui les passe est retenu, sinon le suivant (budget de temps) ;
   5. image redressée (R = 180 px) : angle réel de chaque axe et cercles relevés de part et d'autre de l'axe, assez loin de
      la pastille (règle locale) ; pastilles blanches cerclées, contour du polygone entre axes voisins, teinte intérieure /
      extérieure, mention d'absence (encre latérale à texture de lettres) → programmation dynamique sur le cycle des axes,
      marges = confiance de chaque sommet ;
   6. confiance globale (cercles vus, ajustement au pixel près, axes nets, repères ⊕, sommets) ; ok:false sinon. */

export const RINGS = [0.5104, 0.7553, 1];      /* + ++ +++ (fractions du rayon du cercle +++) */
export const BAG_R = 0.19;                      /* disque pointillé du cartable */
const THETA0_F = 0.0212;                        /* position du θ = 0 sur l'échelle officielle */
const KNOTS = [[THETA0_F, 0], [RINGS[0], 1], [RINGS[1], 2], [1, 3]];
const DEG = Math.PI / 180;
const WORK = 640;                               /* côté de l'image de travail */
const RECT_R = 180;                             /* rayon du cercle +++ dans l'image redressée (lecture) */
export const INPUT_MAX = 1600;                  /* côté maximal conseillé de l'image transmise */
const MIN_R = 110;                              /* rayon minimal (px) pour une lecture sûre : en dessous, pastilles trop petites */
const RECT_EXT = 1.34;                          /* étendue de l'image redressée (en R) */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const MIN_S = 3, MIN_S_RAY = 4;                 /* trait fin le plus pâle retenu (contraste rapporté au fond, cf. lineMaxima) */
const nowMs = () => (globalThis.performance && typeof performance.now === 'function' ? performance.now() : Date.now());

/* fraction du rayon (cercle +++ = 1) → θ sur l'échelle de la fiche (cercles mesurés), borné 0-3 */
export function thetaFromRadius(f) {
  if (!(f > KNOTS[0][0])) return 0;
  for (let k = 1; k < KNOTS.length; k++) {
    if (f <= KNOTS[k][0]) { const [f0, t0] = KNOTS[k - 1], [f1, t1] = KNOTS[k]; return t0 + (t1 - t0) * (f - f0) / (f1 - f0); }
  }
  return 3;
}
/* θ → fraction du rayon (inverse) */
export function radiusFromTheta(t) {
  t = clamp(Number(t) || 0, 0, 3);
  for (let k = 1; k < KNOTS.length; k++) {
    if (t <= KNOTS[k][1]) { const [f0, t0] = KNOTS[k - 1], [f1, t1] = KNOTS[k]; return f0 + (f1 - f0) * (t - t0) / (t1 - t0); }
  }
  return 1;
}

/* ---------- homographies (matrices 3 × 3 en ligne) ---------- */
export function applyH(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}
function invertH(H) {
  const [a, b, c, d, e, f, g, h, i] = H;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!det) return null;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
/* point du gabarit (fraction f du rayon, angle en degrés horaire depuis le haut) → pixel de l'image */
export function projectPoint(res, f, angleDeg) {
  if (!res || !res.homography) return [NaN, NaN];
  const a = angleDeg * DEG;
  return applyH(res.homography, f * Math.sin(a), -f * Math.cos(a));
}
function similarityH(cx, cy, R, rotDeg) {
  const c = Math.cos(rotDeg * DEG) * R, s = Math.sin(rotDeg * DEG) * R;
  return [c, -s, cx, s, c, cy, 0, 0, 1];
}
/* résolution d'un système linéaire dense (pivot partiel) — petites tailles */
function solveLinear(M, rhs) {
  const n = rhs.length;
  const A = M.map((r, i) => [...r, rhs[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return null;
    if (p !== c) { const t = A[c]; A[c] = A[p]; A[p] = t; }
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = A[r][c] / A[c][c];
      if (k) for (let j = c; j <= n; j++) A[r][j] -= k * A[c][j];
    }
  }
  return A.map((r, i) => r[n] / r[i]);
}
/* ---------- échantillonnage ---------- */
/* image de travail : luminance moyennée par blocs (anti-repliement : les traits fins des axes restent visibles) */
function workImage(image, maxSide) {
  const { width: W, height: H, data } = image;
  const s = Math.min(1, maxSide / Math.max(W, H));
  const w = Math.max(8, Math.round(W * s)), h = Math.max(8, Math.round(H * s));
  const acc = new Float32Array(w * h), cnt = new Float32Array(w * h);
  const xm = new Int32Array(W);
  for (let x = 0; x < W; x++) xm[x] = Math.min(w - 1, Math.floor(x * w / W));
  for (let y = 0; y < H; y++) {
    const ty = Math.min(h - 1, Math.floor(y * h / H)) * w;
    let i = y * W * 4;
    for (let x = 0; x < W; x++, i += 4) {
      const t = ty + xm[x];
      acc[t] += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; cnt[t]++;
    }
  }
  for (let k = 0; k < acc.length; k++) acc[k] = cnt[k] ? acc[k] / cnt[k] : 255;
  return { Y: acc, w, h, sx: w / W, sy: h / H };
}
/* luminance pleine résolution à la demande (interpolation bilinéaire) */
function makeLuma(image) {
  const { width: W, height: H, data } = image;
  return (x, y) => {
    if (!(x >= 0 && y >= 0 && x <= W - 1.001 && y <= H - 1.001)) return NaN;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
    const i = (y0 * W + x0) * 4, j = i + W * 4;
    const l00 = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const l10 = 0.299 * data[i + 4] + 0.587 * data[i + 5] + 0.114 * data[i + 6];
    const l01 = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
    const l11 = 0.299 * data[j + 4] + 0.587 * data[j + 5] + 0.114 * data[j + 6];
    return (l00 * (1 - fx) + l10 * fx) * (1 - fy) + (l01 * (1 - fx) + l11 * fx) * fy;
  };
}
function bilin(F, w, h, x, y) {
  if (!(x >= 0 && y >= 0 && x <= w - 1.001 && y <= h - 1.001)) return NaN;
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
  return (F[i] * (1 - fx) + F[i + 1] * fx) * (1 - fy) + (F[i + w] * (1 - fx) + F[i + w + 1] * fx) * fy;
}

function blur121(F, w, h) {
  const t = new Float32Array(w * h), o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const r = y * w;
    t[r] = (3 * F[r] + F[r + 1]) / 4; t[r + w - 1] = (3 * F[r + w - 1] + F[r + w - 2]) / 4;
    for (let x = 1; x < w - 1; x++) t[r + x] = (F[r + x - 1] + 2 * F[r + x] + F[r + x + 1]) / 4;
  }
  for (let x = 0; x < w; x++) {
    o[x] = (3 * t[x] + t[x + w]) / 4; o[(h - 1) * w + x] = (3 * t[(h - 1) * w + x] + t[(h - 2) * w + x]) / 4;
    for (let y = 1; y < h - 1; y++) o[y * w + x] = (t[(y - 1) * w + x] + 2 * t[y * w + x] + t[(y + 1) * w + x]) / 4;
  }
  return o;
}

/* ---------- 1. vote du centre (cercles concentriques) ---------- */
/* chaque contour vote le long de son gradient (des deux côtés) : le centre commun des cercles ressort.
   Image de travail légèrement lissée (les cercles pointillés fins restent visibles), votes accumulés à mi-résolution. */
function voteCenter(B, w, h) {
  const n = w * h;
  const gx = new Float32Array(n), gy = new Float32Array(n), mag = new Float32Array(n);
  const hist = new Uint32Array(1024);
  let cnt = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const sx = (B[i - w + 1] + 2 * B[i + 1] + B[i + w + 1]) - (B[i - w - 1] + 2 * B[i - 1] + B[i + w - 1]);
      const sy = (B[i + w - 1] + 2 * B[i + w] + B[i + w + 1]) - (B[i - w - 1] + 2 * B[i - w] + B[i - w + 1]);
      gx[i] = sx; gy[i] = sy;
      const m = Math.sqrt(sx * sx + sy * sy);
      mag[i] = m;
      if (m > 2) { hist[Math.min(1023, m | 0)]++; cnt++; }
    }
  }
  if (cnt < 50) return [];
  /* seuil relatif au contraste de l'image (les cercles pointillés, gris clair sur fond teinté, doivent voter) */
  let acc = 0, p95 = 40;
  for (let k = 0; k < 1024; k++) { acc += hist[k]; if (acc >= cnt * 0.95) { p95 = k; break; } }
  const thr = Math.max(8, 0.22 * p95);
  let count = 0;
  for (let i = 0; i < n; i++) if (mag[i] > thr) count++;
  const stride = Math.max(1, Math.round(count / 15000));
  const w2 = w >> 1, h2 = h >> 1, A = new Float32Array(w2 * h2);
  const m0 = Math.min(w, h);
  const rmin = Math.max(5, 0.03 * m0), rmax = 0.44 * Math.max(w, h), vs = 2.5;
  const nSteps = Math.ceil((rmax - rmin) / vs);
  let seen = 0;
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x, m = mag[i];
      if (m <= thr || (seen++ % stride)) continue;
      const dx = gx[i] / m, dy = gy[i] / m, ux = dx * vs * 0.5, uy = dy * vs * 0.5;
      /* coordonnées à mi-résolution (+0,5 : arrondi) */
      let px = (x + dx * rmin) * 0.5 + 0.5, py = (y + dy * rmin) * 0.5 + 0.5;
      for (let t = 0; t < nSteps; t++) {
        const ix = px | 0, iy = py | 0;
        if (px < 0 || py < 0 || ix >= w2 || iy >= h2) break;
        A[iy * w2 + ix]++;
        px += ux; py += uy;
      }
      px = (x - dx * rmin) * 0.5 + 0.5; py = (y - dy * rmin) * 0.5 + 0.5;
      for (let t = 0; t < nSteps; t++) {
        const ix = px | 0, iy = py | 0;
        if (px < 0 || py < 0 || ix >= w2 || iy >= h2) break;
        A[iy * w2 + ix]++;
        px -= ux; py -= uy;
      }
    }
  }
  const S = blur121(blur121(A, w2, h2), w2, h2);
  /* pics ronds (centre commun de cercles) plutôt que crêtes (traits droits du texte) :
     on classe les maxima locaux par la plus petite courbure (valeur propre de la hessienne, à l'échelle de 3 cellules) */
  const peaks = [];
  const q = 3;
  for (let y = q + 1; y < h2 - q - 1; y++) {
    for (let x = q + 1; x < w2 - q - 1; x++) {
      const i = y * w2 + x, v = S[i];
      if (v <= 0 || v < S[i - 1] || v < S[i + 1] || v < S[i - w2] || v < S[i + w2] || v < S[i - w2 - 1] || v < S[i + w2 + 1] || v < S[i - w2 + 1] || v < S[i + w2 - 1]) continue;
      const hxx = (2 * v - S[i - q] - S[i + q]) / (q * q), hyy = (2 * v - S[i - q * w2] - S[i + q * w2]) / (q * q);
      const hxy = (S[i + q * w2 + q] + S[i - q * w2 - q] - S[i + q * w2 - q] - S[i - q * w2 + q]) / (4 * q * q);
      const tr = hxx + hyy, det = hxx * hyy - hxy * hxy;
      const lmin = tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - det));
      if (lmin <= 0) continue;
      /* rondeur : rapport des courbures (1 = pic rond, 0 = crête) */
      const lmax = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det));
      peaks.push({ x, y, v: v * (0.4 + Math.min(1, lmin / (lmax || 1))), raw: v });
    }
  }
  peaks.sort((a, b) => b.v - a.v);
  const out = [], rad = Math.max(3, 0.025 * m0);
  for (const p of peaks) {
    if (out.some(q => Math.hypot(q.hx - p.x, q.hy - p.y) < rad)) continue;
    let sx = 0, sy = 0, sw = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const v = S[(p.y + dy) * w2 + p.x + dx]; sx += v * dx; sy += v * dy; sw += v; }
    /* retour à la résolution de travail : centre de la cellule (2x, 2y) → 2x + 0,5 */
    out.push({ hx: p.x, hy: p.y, x: 2 * (p.x + sx / sw) + 0.5, y: 2 * (p.y + sy / sw) + 0.5, v: p.v });
    if (out.length >= 10) break;
  }
  return out;
}

/* bruit de la réponse « trait fin » (même mesure que lineMaxima, directions et positions tirées au hasard, graine fixe) :
   écart type robuste (médiane des valeurs absolues / 0,6745) */
function lineNoise(F, w, h) {
  const v = [];
  let seed = 12345;
  const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  for (let k = 0; k < 6000; k++) {
    const x = 2 + rnd() * (w - 4), y = 2 + rnd() * (h - 4), a = rnd() * Math.PI, dx = Math.cos(a), dy = Math.sin(a);
    const v0 = bilin(F, w, h, x, y), v1 = bilin(F, w, h, x - 1.25 * dx, y - 1.25 * dy), v2 = bilin(F, w, h, x + 1.25 * dx, y + 1.25 * dy);
    if (!(v0 === v0 && v1 === v1 && v2 === v2)) continue;
    const bg = (v1 + v2) / 2;
    v.push(Math.abs((bg - v0) * 230 / Math.max(50, bg)));
  }
  if (!v.length) return 1;
  v.sort((p, q) => p - q);
  return Math.max(0.05, v[v.length >> 1] / 0.6745);
}

/* maxima locaux de la réponse « trait fin » le long de plusieurs droites parallèles proches (on garde, à chaque
   position, la meilleure des droites : les pointillés sont ainsi enjambés) → [{ t, s }] */
let LM_BUF = new Float32Array(2048);
function lineMaxima(sample, lines, t0, t1, step, d, minS) {
  const nT = Math.max(3, Math.floor((t1 - t0) / step) + 1);
  if (LM_BUF.length < nT) LM_BUF = new Float32Array(nT * 2);
  const vals = LM_BUF.subarray(0, nT).fill(-Infinity);
  for (const [x0, y0, dx, dy] of lines) {
    for (let i = 0; i < nT; i++) {
      const t = t0 + i * step, x = x0 + t * dx, y = y0 + t * dy;
      const v0 = sample(x, y), v1 = sample(x - d * dx, y - d * dy), v2 = sample(x + d * dx, y + d * dy);
      if (v0 === v0 && v1 === v1 && v2 === v2) {
        const bg = (v1 + v2) / 2;
        /* contraste du trait rapporté au fond local (insensible à l'éclairage : photo sombre, ombre, dégradé) */
        const L = (bg - v0) * 230 / Math.max(50, bg);
        if (L > vals[i]) vals[i] = L;
      }
    }
  }
  const out = [];
  for (let i = 1; i < nT - 1; i++) {
    const v = vals[i];
    if (v >= minS && v >= vals[i - 1] && v > vals[i + 1]) {
      const den = vals[i - 1] - 2 * v + vals[i + 1];
      out.push({ t: t0 + (i + (den < 0 ? 0.5 * (vals[i - 1] - vals[i + 1]) / den : 0)) * step, s: v });
    }
  }
  return out;
}
/* meilleur triplet (+, ++, +++) le long d'une direction : maxima près des positions attendues, rapports cohérents */
function bestTriple(M, pred, tol) {
  let best = null;
  const opts = M.map((list, j) => list.filter(m => Math.abs(m.t - pred[j]) <= tol[j]));
  if (opts.some(o => !o.length)) return null;
  for (const a of opts[0]) for (const b of opts[1]) for (const c of opts[2]) {
    const e = Math.abs(a.t / c.t - pred[0] / pred[2]) + Math.abs(b.t / c.t - pred[1] / pred[2]);
    const sc = (Math.min(a.s, 40) + Math.min(b.s, 40) + Math.min(c.s, 40)) * Math.exp(-(e / 0.03) * (e / 0.03));
    if (!best || sc > best.sc) best = { sc, r: [a.t, b.t, c.t], s: [a.s, b.s, c.s], e };
  }
  return best;
}
/* échelles candidates : le long de 48 directions, triplets de traits aux rapports 0,5104 / 0,7553 / 1 → vote sur R
   (peu sensible à une erreur de quelques pixels sur le centre) */
function scaleVotes(B, w, h, cx, cy, Rmin, Rmax) {
  const sample = (x, y) => bilin(B, w, h, x, y);
  const nb = Math.ceil(Rmax * 1.05) + 4, hist = new Float32Array(nb);
  const ND = 32;
  for (let a = 0; a < ND; a++) {
    const ang = 2 * Math.PI * (a + 0.25) / ND;
    const lines = [-0.007, 0.007].map(da => [cx, cy, Math.sin(ang + da), -Math.cos(ang + da)]);
    const M = lineMaxima(sample, lines, Math.max(3, RINGS[0] * Rmin * 0.9), Rmax * 1.03, 0.6, 1.25, MIN_S);
    for (const m3 of M) {
      const r3 = m3.t;
      if (r3 < Rmin * 0.97 || r3 > Rmax * 1.03) continue;
      const tol = 0.02 * r3 + 1.5;
      let b1 = null, b2 = null;
      for (const m of M) {
        if (Math.abs(m.t - RINGS[0] * r3) <= tol && (!b1 || m.s > b1.s)) b1 = m;
        if (Math.abs(m.t - RINGS[1] * r3) <= tol && (!b2 || m.s > b2.s)) b2 = m;
      }
      if (!b1 || !b2) continue;
      const wv = Math.min(m3.s, b1.s, b2.s, 30);
      const k = Math.round(r3);
      if (k >= 1 && k < nb - 1) { hist[k] += wv; hist[k - 1] += wv * 0.5; hist[k + 1] += wv * 0.5; }
    }
  }
  const out = [];
  for (let k = 2; k < nb - 2; k++) {
    const v = hist[k];
    if (v > 0 && v >= hist[k - 1] && v >= hist[k + 1] && v >= hist[k - 2] && v >= hist[k + 2]) out.push({ R: k, v });
  }
  out.sort((p, q) => q.v - p.v);
  const res = [];
  for (const o of out) { if (res.every(r => Math.abs(r.R - o.R) > 0.06 * o.R)) res.push(o); if (res.length >= 3) break; }
  return res;
}
/* repli robuste (centre approché, photo de biais) : le long d'une direction issue d'un centre APPROCHÉ, les trois cercles
   tombent à r_j ≈ f_j·s + δ (δ : décalage du centre dans cette direction) ; l'écart relatif (r2 − r1) / (r3 − r1) ≈ 0,5
   ne dépend ni de s ni de δ (ni, au premier ordre, de la perspective) → triplets, vote sur s, puis les δ de chaque
   direction donnent le vrai centre (δ ≈ Δ·u). → [{ x, y, R, pts, nFrac }] */
function ringTriplesSR(B, w, h, cx, cy, Rmin, Rmax) {
  const sample = (x, y) => bilin(B, w, h, x, y);
  const ND = 48, K = (RINGS[1] - RINGS[0]) / (RINGS[2] - RINGS[0]), SPAN = RINGS[2] - RINGS[0];
  /* histogramme logarithmique de s (pas de 1 %) */
  const L0 = Math.log(Rmin * 0.85), NB = Math.ceil((Math.log(Rmax * 1.15) - L0) / 0.01) + 1;
  const hist = new Float32Array(NB);
  const dirs = [];
  for (let a = 0; a < ND; a++) {
    const ang = 2 * Math.PI * (a + 0.5) / ND, ux = Math.sin(ang), uy = -Math.cos(ang);
    const lines = [-0.01, 0, 0.01].map(da => [cx, cy, Math.sin(ang + da), -Math.cos(ang + da)]);
    const M = lineMaxima(sample, lines, Math.max(3, 0.3 * Rmin), Rmax * 1.3, 0.5, 1.25, MIN_S);
    const trip = [];
    for (let i = 0; i < M.length; i++) {
      for (let k = i + 2; k < M.length; k++) {
        const A = M[i], C = M[k], d = C.t - A.t, sc = d / SPAN;
        if (sc < Rmin * 0.85) continue;
        if (sc > Rmax * 1.15) break;
        const delta = A.t - RINGS[0] * sc;
        if (Math.abs(delta) > 0.25 * sc) continue;
        const tb = A.t + K * d, tol = 0.035 * d + 0.8;
        let Bm = null;
        for (let j = i + 1; j < k; j++) if (Math.abs(M[j].t - tb) <= tol && (!Bm || M[j].s > Bm.s)) Bm = M[j];
        if (!Bm) continue;
        const wv = Math.min(A.s, Bm.s, C.s, 30) * (1 - 0.5 * Math.abs(Bm.t - tb) / tol);
        trip.push({ s: sc, delta, t: [A.t, Bm.t, C.t], wv });
      }
    }
    dirs.push({ ux, uy, trip });
    /* une voix par direction et par case (la meilleure) */
    const best = new Map();
    for (const t of trip) { const b = Math.round((Math.log(t.s) - L0) / 0.01); if (!(best.get(b) >= t.wv)) best.set(b, t.wv); }
    for (const [b, wv] of best) if (b >= 0 && b < NB) hist[b] += wv;
  }
  /* lissage ±4 % (les directions d'une photo de biais n'ont pas toutes la même échelle) */
  const Hs = new Float32Array(NB);
  for (let b = 0; b < NB; b++) { let v = 0; for (let d = -4; d <= 4; d++) { const q = b + d; if (q >= 0 && q < NB) v += hist[q] * (5 - Math.abs(d)) / 5; } Hs[b] = v; }
  const peaks = [];
  for (let b = 1; b < NB - 1; b++) if (Hs[b] > 0 && Hs[b] >= Hs[b - 1] && Hs[b] > Hs[b + 1]) peaks.push({ b, v: Hs[b] });
  peaks.sort((p, q) => q.v - p.v);
  const out = [];
  for (const pk of peaks.slice(0, 3)) {
    if (pk.v < 0.3 * peaks[0].v) break;
    const s0 = Math.exp(L0 + pk.b * 0.01);
    /* meilleur triplet de chaque direction proche de s0 → décalage du centre (moindres carrés δ = Δ·u) */
    const sel = [];
    for (const d of dirs) {
      let bt = null;
      for (const t of d.trip) if (Math.abs(t.s / s0 - 1) < 0.08 && (!bt || t.wv > bt.wv)) bt = t;
      if (bt) sel.push({ d, t: bt });
    }
    if (sel.length < 0.3 * ND) continue;
    let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
    for (const { d, t } of sel) { a11 += d.ux * d.ux; a12 += d.ux * d.uy; a22 += d.uy * d.uy; b1 += t.delta * d.ux; b2 += t.delta * d.uy; }
    const det = a11 * a22 - a12 * a12;
    if (!(Math.abs(det) > 1e-9)) continue;
    const Dx = (a22 * b1 - a12 * b2) / det, Dy = (a11 * b2 - a12 * b1) / det;
    const pts = [];
    for (const { d, t } of sel) t.t.forEach((r, j) => pts.push({ x: cx + r * d.ux, y: cy + r * d.uy, f: RINGS[j], w: 1 }));
    out.push({ x: cx + Dx, y: cy + Dy, R: s0, pts, nFrac: sel.length / ND, votes: pk.v });
  }
  return out;
}

/* centre et rayon : trois cercles concentriques à rapports fixes, points relevés le long de 72 directions */
function fitCenter(B, w, h, cx, cy, R) {
  const sample = (x, y) => bilin(B, w, h, x, y);
  let X = cx, Y = cy, Rc = R, sol = null;
  for (let round = 0; round < 3; round++) {
    const pts = [];
    const NA = round === 0 ? 48 : 72, tolF = round === 0 ? 0.07 : 0.035, st = round === 0 ? 0.5 : 0.3;
    for (let a = 0; a < NA; a++) {
      const ang = 2 * Math.PI * (a + 0.5) / NA;
      const lines = [-0.012, 0, 0.012].map(da => [X, Y, Math.sin(ang + da), -Math.cos(ang + da)]);
      const M = RINGS.map(f => lineMaxima(sample, lines, f * Rc * (1 - tolF) - 2, f * Rc * (1 + tolF) + 2, st, 1.25, MIN_S));
      const tr = bestTriple(M, RINGS.map(f => f * Rc), RINGS.map(f => f * Rc * tolF + 2));
      if (!tr || tr.e > 0.05) continue;
      tr.r.forEach((r, j) => pts.push({ x: X + r * Math.sin(ang), y: Y - r * Math.cos(ang), f: RINGS[j], w: 1, s: tr.s[j] }));
    }
    if (pts.length < (round === 0 ? 0.25 * 3 * NA : 60)) return sol;
    /* Gauss-Newton sur (cx, cy, R) : |p − c| = f·R */
    for (let it = 0; it < 6; it++) {
      const M3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b3 = [0, 0, 0];
      let ss = 0, sw = 0;
      for (const p of pts) {
        const dx = p.x - X, dy = p.y - Y, d = Math.hypot(dx, dy) || 1;
        const res = d - p.f * Rc;
        const J = [-dx / d, -dy / d, -p.f];
        for (let i = 0; i < 3; i++) { b3[i] -= p.w * J[i] * res; for (let k = 0; k < 3; k++) M3[i][k] += p.w * J[i] * J[k]; }
        ss += p.w * res * res; sw += p.w;
      }
      const s = solveLinear(M3, b3);
      if (!s) break;
      X += s[0]; Y += s[1]; Rc += s[2];
      const rms = Math.sqrt(ss / (sw || 1)), k = Math.max(0.7, 1.5 * rms);
      for (const p of pts) { const e = Math.abs(Math.hypot(p.x - X, p.y - Y) - p.f * Rc); p.w = e > 4 * k ? 0 : e > k ? k / e : 1; }
      sol = { x: X, y: Y, R: Rc, rms, n: pts.length, nFrac: pts.length / (3 * NA) };
      /* force médiane des traits retenus (un cercle imprimé ressort nettement du bruit de la photo) */
      const sv = pts.filter(p => p.w > 0).map(p => p.s).sort((p, q) => p - q);
      sol.sMed = sv.length ? sv[sv.length >> 1] : 0;
    }
    /* rapports libres (contrôle) : rayon moyen de chaque cercle */
    const rr = [0, 0, 0], cnt = [0, 0, 0];
    for (const p of pts) { if (!p.w) continue; const j = RINGS.indexOf(p.f); rr[j] += Math.hypot(p.x - X, p.y - Y); cnt[j]++; }
    if (sol && cnt.every(c => c > 5)) sol.ratios = [rr[0] / cnt[0] / (rr[2] / cnt[2]), rr[1] / cnt[1] / (rr[2] / cnt[2])];
    if (sol) sol.pts = pts;
  }
  return sol;
}

/* vue en perspective des trois cercles : ellipses semblables dont le centre glisse en f² (effet de perspective),
   a x² + 2b xy + d y² + (e + e'f²) x + (g + g'f²) y + h_j = f²  (coordonnées centrées-réduites, linéaire)
   → homographie H (repère du gabarit sans rotation → image) : H(v) = c0 + M v / (1 + kᵀv), k = −2 M⁻¹ d */
function fitConcentric(pts, cx0, cy0, R0) {
  /* (p − c_j)ᵀ Q (p − c_j) = λ f_j², c_j = c0 + f_j² δ : linéaire en (Q à trace 2, u = Q c0, v = Q δ, κ_j) */
  const NP = 9;
  const N = Array.from({ length: NP }, () => new Array(NP).fill(0)), b = new Array(NP).fill(0);
  let used = 0;
  const row = new Array(NP);
  for (const p of pts) {
    if (!(p.w > 0)) continue;
    const x = (p.x - cx0) / R0, y = (p.y - cy0) / R0, f2 = p.f * p.f, j = RINGS.indexOf(p.f);
    row.fill(0);
    row[0] = x * x - y * y; row[1] = 2 * x * y; row[2] = -2 * x; row[3] = -2 * y; row[4] = -2 * f2 * x; row[5] = -2 * f2 * y; row[6 + j] = 1;
    const t = -2 * y * y;
    for (let i = 0; i < NP; i++) { if (!row[i]) continue; b[i] += p.w * row[i] * t; for (let k = 0; k < NP; k++) if (row[k]) N[i][k] += p.w * row[i] * row[k]; }
    used++;
  }
  if (used < 40) return null;
  for (let i = 0; i < NP; i++) N[i][i] += 1e-9;
  const sol = solveLinear(N, b);
  if (!sol) return null;
  const qa = sol[0], qb = sol[1], qd = 2 - qa;
  let det = qa * qd - qb * qb;
  if (!(qa > 0) || !(det > 0)) return null;
  const solveQ = (vx, vy) => [(qd * vx - qb * vy) / det, (-qb * vx + qa * vy) / det];
  const [c0x, c0y] = solveQ(sol[2], sol[3]), [dx, dy] = solveQ(sol[4], sol[5]);
  /* échelle λ : c_jᵀ Q c_j − κ_j = λ f_j² */
  let lam = 0, lw = 0;
  const lams = [];
  for (let j = 0; j < 3; j++) {
    const f2 = RINGS[j] * RINGS[j];
    const cx = c0x + f2 * dx, cy = c0y + f2 * dy;
    const val = (qa * cx * cx + 2 * qb * cx * cy + qd * cy * cy - sol[6 + j]) / f2;
    lams.push(val); lam += val * f2; lw += f2;
  }
  lam /= lw;
  if (!(lam > 0)) return null;
  /* Q réel = Q / λ ; M = Q_réel^(−1/2) */
  const A = qa / lam, Bq = qb / lam, Dq = qd / lam;
  det = A * Dq - Bq * Bq;
  const tr = A + Dq, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
  if (!(l2 > 0)) return null;
  let vx = Bq, vy = l1 - A;
  if (Math.abs(vx) + Math.abs(vy) < 1e-12) { vx = 1; vy = 0; }
  const vn = Math.hypot(vx, vy); vx /= vn; vy /= vn;
  const s1 = 1 / Math.sqrt(l1), s2 = 1 / Math.sqrt(l2);
  const m11 = s1 * vx * vx + s2 * vy * vy, m12 = (s1 - s2) * vx * vy, m22 = s1 * vy * vy + s2 * vx * vx;
  /* glissement du centre (par unité de f²) δ = −M k / 2 → k = −2 M⁻¹ δ */
  const mdet = m11 * m22 - m12 * m12;
  const k0 = -2 * (m22 * dx - m12 * dy) / mdet, k1 = -2 * (-m12 * dx + m11 * dy) / mdet;
  /* homographie en pixels de travail : x = R0·(c0 + M v / (1 + kᵀv)) + (cx0, cy0) */
  const C0x = cx0 + c0x * R0, C0y = cy0 + c0y * R0;
  const H = [m11 * R0 + C0x * k0, m12 * R0 + C0x * k1, C0x, m12 * R0 + C0y * k0, m22 * R0 + C0y * k1, C0y, k0, k1, 1];
  const spread = Math.max(...lams) / Math.min(...lams);
  return { H, cx: C0x, cy: C0y, ratio: Math.sqrt(l2 / l1), tilt: Math.hypot(k0, k1), spread };
}
/* profil angulaire des axes dans le repère redressé : réponse « trait fin » perpendiculaire, 40e centile sur les rayons */
function angularProfileH(B, w, h, H, nAng) {
  const radii = [];
  for (let f = 0.26; f <= 0.98; f += 0.03) if (!RINGS.some(q => Math.abs(q - f) < 0.035)) radii.push(f);
  const Q = new Float32Array(nAng), tmp = new Float32Array(radii.length);
  const [ox, oy] = applyH(H, 0, 0), [rx, ry] = applyH(H, 1, 0);
  const Reff = Math.hypot(rx - ox, ry - oy);
  const d = Math.max(1.3, 0.012 * Reff);
  for (let a = 0; a < nAng; a++) {
    const ang = 2 * Math.PI * a / nAng, sn = Math.sin(ang), cs = Math.cos(ang);
    const sn2 = Math.sin(ang + 0.01), cs2 = Math.cos(ang + 0.01);
    let c = 0;
    for (let k = 0; k < radii.length; k++) {
      const f = radii[k];
      const [x, y] = applyH(H, f * sn, -f * cs), [x2, y2] = applyH(H, f * sn2, -f * cs2);
      let tx = x2 - x, ty = y2 - y; const tn = Math.hypot(tx, ty) || 1; tx /= tn; ty /= tn;
      const v0 = bilin(B, w, h, x, y), v1 = bilin(B, w, h, x - d * tx, y - d * ty), v2 = bilin(B, w, h, x + d * tx, y + d * ty);
      if (v0 !== v0 || v1 !== v1 || v2 !== v2) continue;
      const bg = (v1 + v2) / 2;
      tmp[c++] = (bg - v0) * 230 / Math.max(50, bg);
    }
    if (c < 4) { Q[a] = 0; continue; }
    const arr = Array.from(tmp.subarray(0, c)).sort((x, y) => x - y);
    /* 30e centile : un axe est un trait présent sur presque toute la longueur (0,26 → 0,98 R), pas un bout de texte ou de contour */
    Q[a] = arr[Math.floor(c * 0.3)];
  }
  return Q;
}
function mulH(A, B) {
  const C = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) C[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j];
  return C;
}
/* cercles revus à travers le modèle en perspective (ellipses) : points relevés le long des droites issues du centre projeté,
   triplets aux rapports attendus, nouvel ajustement (pondération robuste) → modèle affiné et part des directions vues */
function ringRefine(B, w, h, rings, R) {
  const sample = (x, y) => bilin(B, w, h, x, y);
  let cur = rings, nFrac = 0;
  for (let it = 0; it < 2; it++) {
    const H = cur.H;
    const C0 = applyH(H, 0, 0);
    const pts = [];
    let hits = 0, tries = 0;
    for (let phi = 2.5; phi < 360; phi += 5) {
      const a = phi * DEG;
      const P = RINGS.map(f => applyH(H, f * Math.sin(a), -f * Math.cos(a)));
      let dx = P[2][0] - C0[0], dy = P[2][1] - C0[1];
      const L3 = Math.hypot(dx, dy) || 1; dx /= L3; dy /= L3;
      const pred = P.map(q => Math.hypot(q[0] - C0[0], q[1] - C0[1]));
      const lines = [-0.011, 0, 0.011].map(da => { const c = Math.cos(da), s2 = Math.sin(da); return [C0[0], C0[1], dx * c - dy * s2, dx * s2 + dy * c]; });
      const tol = 0.03 * R + 1.5;
      const M = pred.map(r => lineMaxima(sample, lines, r - tol, r + tol, 0.25, 1.25, MIN_S));
      tries++;
      const tr = bestTriple(M, pred, pred.map(() => tol));
      if (!tr || tr.e > 0.04) continue;
      hits++;
      tr.r.forEach((r, k) => pts.push({ x: C0[0] + r * dx, y: C0[1] + r * dy, f: RINGS[k], w: 1 }));
    }
    nFrac = hits / (tries || 1);
    if (pts.length < 60) break;
    let nr = fitConcentric(pts, C0[0], C0[1], R);
    if (!nr) break;
    /* pondération robuste : écart géométrique au cercle du gabarit après redressement */
    const Hi = invertH(nr.H);
    if (Hi) {
      const errs = pts.map(q => { const [u, v] = applyH(Hi, q.x, q.y); return Math.abs(Math.hypot(u, v) - q.f); });
      const med = errs.slice().sort((x, y) => x - y)[errs.length >> 1] || 0.002;
      pts.forEach((q, k) => { q.w = errs[k] > 4 * Math.max(med, 0.002) ? 0 : 1; });
      nr = fitConcentric(pts, C0[0], C0[1], R) || nr;
    }
    if (nr.ratio < 0.55 || nr.tilt > 0.6 || nr.spread > 1.15) break;
    cur = nr;
  }
  return { rings: cur, nFrac };
}

/* ---------- 3. axes et rotation ---------- */
function qAt(Q, deg) {
  const n = Q.length;
  let k = ((deg % 360) + 360) % 360 * n / 360;
  const k0 = Math.floor(k) % n, k1 = (k0 + 1) % n, t = k - Math.floor(k);
  return Q[k0] * (1 - t) + Q[k1] * t;
}
function fitRotation(Q, angles) {
  const n = angles.length;
  let best = -Infinity;
  const F = new Float32Array(1440);
  for (let i = 0; i < 1440; i++) {
    const rho = i * 0.25;
    let s = 0;
    for (const a of angles) s += Math.max(0, qAt(Q, a + rho));
    F[i] = s / n;
    if (F[i] > best) best = F[i];
  }
  /* maxima locaux proches du meilleur */
  const cands = [];
  for (let i = 0; i < 1440; i++) {
    const v = F[i];
    if (v < best * 0.6) continue;
    let isMax = true;
    for (let d = -6; d <= 6 && isMax; d++) if (d && F[(i + d + 1440) % 1440] > v) isMax = false;
    if (isMax) cands.push({ rho: i * 0.25, v });
  }
  /* qualité : axes vs mi-chemins */
  const mean = Array.from(Q).reduce((s, v) => s + v, 0) / Q.length;
  const sd = Math.sqrt(Array.from(Q).reduce((s, v) => s + (v - mean) * (v - mean), 0) / Q.length) || 1;
  return { cands: cands.sort((a, b) => b.v - a.v), best, z: (best - mean) / sd };
}

/* contraste des axes (meilleur gabarit, meilleure rotation) pour une homographie donnée */
function axesContrast(B, w, h, H, templates, nAng) {
  const Q = angularProfileH(B, w, h, H, nAng);
  let best = -Infinity;
  for (const tpl of templates) {
    const angles = tpl.axes.map(a => Number(a.angle) || 0), step = 360 / angles.length;
    const fit = fitRotation(Q, angles);
    for (const cnd of fit.cands.slice(0, 3)) {
      let off = 0;
      for (const a of angles) off += Math.max(0, qAt(Q, a + cnd.rho + step / 2));
      best = Math.max(best, cnd.v - off / angles.length);
    }
  }
  return best;
}
/* même modèle de cercles, autre part projective k : le centre de l'ellipse +++ (bien mesurée) reste fixe, le centre
   PROJETÉ (où concourent les axes) se déplace. H = [L + c kᵀ | c ; kᵀ 1], L = R0·M ; ellipse +++ ≈ c − L k / 2 */
function withK(H, k0, k1) {
  const cx = H[2], cy = H[5], ka = H[6], kb = H[7];
  const L = [H[0] - cx * ka, H[1] - cx * kb, H[3] - cy * ka, H[4] - cy * kb];
  const ex = cx - (L[0] * ka + L[1] * kb) / 2, ey = cy - (L[2] * ka + L[3] * kb) / 2;
  const nx = ex + (L[0] * k0 + L[1] * k1) / 2, ny = ey + (L[2] * k0 + L[3] * k1) / 2;
  return [L[0] + nx * k0, L[1] + nx * k1, nx, L[2] + ny * k0, L[3] + ny * k1, ny, k0, k1, 1];
}
/* photo prise de biais (≥ 10°) : la perspective déduite des seuls cercles place mal le centre projeté et les axes,
   tracés à travers elle, s'étalent. On cherche la part projective qui rend les axes les plus nets (droites concourantes). */
function searchK(B, w, h, H0, templates) {
  let best = { H: H0, c: axesContrast(B, w, h, H0, templates, 360), k0: H0[6], k1: H0[7] };
  const start = best.c;
  if (start >= 5) return { ...best, start, evals: 1 };
  let evals = 1;
  const tryK = (k0, k1) => {
    const H = withK(H0, k0, k1);
    const c = axesContrast(B, w, h, H, templates, 360);
    evals++;
    if (c > best.c + 1e-6) best = { H, c, k0, k1 };
  };
  const c0 = best.k0, c1 = best.k1;
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (a || b) tryK(c0 + a * 0.05, c1 + b * 0.05);
  for (const st of [0.025, 0.0125]) {
    const b0 = best.k0, b1 = best.k1;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (a || b) tryK(b0 + a * st, b1 + b * st);
  }
  return { ...best, start, evals };
}

/* repères ⊕ (disques sombres) au haut de la fiche, pour une rotation candidate */
const GLYPHS = [[0, -RINGS[0]], [-0.041, -RINGS[1]], [0.041, -RINGS[1]], [-0.082, -1], [0, -1], [0.082, -1]];
/* disque bleu marine (rayon ≈ 0,0235 R) barré d'un « + » blanc : on mesure le disque sur ses diagonales (hors des branches du +) */
function glyphScore(sample, H) {
  let s = 0, cnt = 0;
  for (const [u, v] of GLYPHS) {
    let inner = 0, outer = 0, ni = 0, no = 0;
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2;
      const [x1, y1] = applyH(H, u + 0.0145 * Math.cos(a), v + 0.0145 * Math.sin(a));
      const l1 = sample(x1, y1); if (l1 === l1) { inner += l1; ni++; }
    }
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + 0.39;
      const [x2, y2] = applyH(H, u + 0.038 * Math.cos(a), v + 0.038 * Math.sin(a));
      const l2 = sample(x2, y2); if (l2 === l2) { outer += l2; no++; }
    }
    if (!ni || !no) continue;
    s += Math.max(0, outer / no - inner / ni); cnt++;
  }
  return cnt ? s / GLYPHS.length : 0;
}

/* contrôle des repères ⊕ pour l'homographie retenue : chacun est cherché autour de sa place
   (±0,024 R : papier plié ou ondulé, résidu de perspective) puis mesuré : disque sombre (alentours − diagonales) et « + » blanc (centre et branches − diagonales) → [{ disk, cross }] */
function glyphAt(sample, H, u, v) {
  let diag = 0, nd = 0, outer = 0, no = 0, cross = 0, nc = 0;
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2;
    const [x1, y1] = applyH(H, u + 0.0145 * Math.cos(a), v + 0.0145 * Math.sin(a));
    const l1 = sample(x1, y1); if (l1 === l1) { diag += l1; nd++; }
    const b = k * Math.PI / 2;
    const [x3, y3] = applyH(H, u + 0.009 * Math.cos(b), v + 0.009 * Math.sin(b));
    const l3 = sample(x3, y3); if (l3 === l3) { cross += l3; nc++; }
  }
  const [xc, yc] = applyH(H, u, v);
  const lc = sample(xc, yc); if (lc === lc) { cross += 2 * lc; nc += 2; }
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 + 0.39;
    const [x2, y2] = applyH(H, u + 0.038 * Math.cos(a), v + 0.038 * Math.sin(a));
    const l2 = sample(x2, y2); if (l2 === l2) { outer += l2; no++; }
  }
  if (!nd || !no || !nc) return { disk: 0, cross: 0 };
  return { disk: outer / no - diag / nd, cross: cross / nc - diag / nd };
}
function glyphDetail(sample, H) {
  return GLYPHS.map(([u, v]) => {
    let best = null;
    for (let du = -0.024; du <= 0.0241; du += 0.006) {
      for (let dv = -0.024; dv <= 0.0241; dv += 0.006) {
        const g = glyphAt(sample, H, u + du, v + dv);
        const sc = Math.min(g.disk, 2 * g.cross);
        if (!best || sc > best.sc) best = { ...g, sc, du, dv };
      }
    }
    return best;
  });
}
/* nombre de repères ⊕ nets : disque bien sombre (comparé au plus net) barré d'un + nettement plus clair */
function glyphCount(det) {
  const mx = Math.max(...det.map(g => g.disk));
  return mx > 0 ? det.filter(g => g.disk > 0.4 * mx && g.cross > 0.15 * g.disk).length : 0;
}

/* ---------- 4. homographie affinée sur les cercles et les axes ---------- */
/* ajustement « point-droite » : chaque observation ne contraint que sa direction de mesure n (radiale pour un cercle,
   tangentielle pour un axe) ; le point du gabarit apparié est recalculé à chaque passe (glissement le long du cercle
   ou de l'axe), ce qui évite de figer l'angle initial. Résidu : nᵀ (H(q) − p). Linéaire en h (h33 = 1). */
function fitHLine(obs, H, projective, keepK) {
  let mx = 0, my = 0, sw = 0;
  for (const o of obs) { mx += o.w * o.x; my += o.w * o.y; sw += o.w; }
  if (sw <= 0) return null;
  mx /= sw; my /= sw;
  let sd = 0;
  for (const o of obs) sd += o.w * Math.hypot(o.x - mx, o.y - my);
  const sc = sd / sw || 1;
  const Hi = invertH(H);
  if (!Hi) return null;
  const np = projective ? 8 : 6;
  const N = Array.from({ length: np }, () => new Array(np).fill(0)), bb = new Array(np).fill(0);
  const row = new Array(np);
  /* passes « affines » : la part projective de H est gardée telle quelle (et non remise à zéro : photo de biais) */
  const g6 = !projective && keepK ? H[6] / H[8] : 0, g7 = !projective && keepK ? H[7] / H[8] : 0;
  for (const o of obs) {
    if (!(o.w > 0)) continue;
    /* point du gabarit apparié */
    let [u, v] = applyH(Hi, o.x, o.y);
    if (o.kind === 0) { const r = Math.hypot(u, v) || 1; u *= o.f / r; v *= o.f / r; }
    else { const t = u * o.ax + v * o.ay; u = t * o.ax; v = t * o.ay; }
    o.u = u; o.v = v;
    const X = (o.x - mx) / sc, Y = (o.y - my) / sc, c = o.nx * X + o.ny * Y;
    row[0] = o.nx * u; row[1] = o.nx * v; row[2] = o.nx; row[3] = o.ny * u; row[4] = o.ny * v; row[5] = o.ny;
    if (projective) { row[6] = -c * u; row[7] = -c * v; }
    const rhs = projective ? c : c * (1 + g6 * u + g7 * v);
    for (let i = 0; i < np; i++) { bb[i] += o.w * row[i] * rhs; for (let k = 0; k < np; k++) N[i][k] += o.w * row[i] * row[k]; }
  }
  for (let i = 0; i < np; i++) N[i][i] += 1e-9;
  const h = solveLinear(N, bb);
  if (!h) return null;
  const h31 = projective ? h[6] : g6, h32 = projective ? h[7] : g7;
  return [sc * h[0] + mx * h31, sc * h[1] + mx * h32, sc * h[2] + mx, sc * h[3] + my * h31, sc * h[4] + my * h32, sc * h[5] + my, h31, h32, 1];
}
function refineH(sample, H0, angles, Rimg, keepK = false) {
  let H = H0.slice();
  const step = Math.max(0.3, Rimg / 500);
  const d = Math.max(1.2, 0.008 * Rimg);
  let stats = { ring: 0, ray: 0, rms: 0, n: 0 };
  for (let it = 0; it < 4; it++) {
    const obs = [];
    const C0 = applyH(H, 0, 0);
    let ringHits = 0, ringTries = 0, rayHits = 0, rayTries = 0;
    const tolF = it === 0 ? 0.05 : 0.03;
    /* cercles : maxima le long de la droite image passant par le centre projeté, triplet cohérent */
    for (let phi = 3.75; phi < 360; phi += 7.5) {
      if (angles.some(a => Math.abs(((phi - a + 540) % 360) - 180) < 2.5)) continue;
      const a = phi * DEG;
      const P = RINGS.map(f => applyH(H, f * Math.sin(a), -f * Math.cos(a)));
      let dx = P[2][0] - C0[0], dy = P[2][1] - C0[1];
      const L3 = Math.hypot(dx, dy) || 1; dx /= L3; dy /= L3;
      const pred = P.map(p => Math.hypot(p[0] - C0[0], p[1] - C0[1]));
      const lines = [-0.011, 0, 0.011].map(da => {
        const c = Math.cos(da), s = Math.sin(da);
        return [C0[0], C0[1], dx * c - dy * s, dx * s + dy * c];
      });
      const M = pred.map(r => lineMaxima(sample, lines, r - tolF * Rimg - 2, r + tolF * Rimg + 2, step, d, MIN_S));
      ringTries++;
      const tr = bestTriple(M, pred, pred.map(() => tolF * Rimg + 2));
      if (!tr || tr.e > 0.05) continue;
      ringHits++;
      const glyphZone = Math.abs(((phi + 180) % 360) - 180) < 7;
      tr.r.forEach((r, j) => {
        if (glyphZone && j > 0) return;
        obs.push({ kind: 0, f: RINGS[j], x: C0[0] + r * dx, y: C0[1] + r * dy, nx: dx, ny: dy, w: Math.min(1, tr.s[j] / 20) });
      });
    }
    /* axes : trait le plus proche de la position attendue, recherche tangentielle */
    angles.forEach(ang => {
      const a = ang * DEG, ax = Math.sin(a), ay = -Math.cos(a);
      for (const f of [0.3, 0.38, 0.45, 0.6, 0.66, 0.84, 0.9, 0.95]) {
        const [px, py] = applyH(H, f * ax, f * ay);
        const [qx, qy] = applyH(H, f * Math.sin(a + 0.02), -f * Math.cos(a + 0.02));
        let dx = qx - px, dy = qy - py;
        const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
        const span = (it === 0 ? 0.04 : 0.025) * Rimg;
        const M = lineMaxima(sample, [[px, py, dx, dy]], -span, span, step, d, MIN_S_RAY);
        rayTries++;
        if (!M.length) continue;
        let bm = null;
        for (const m of M) { const sc = Math.min(m.s, 40) * Math.exp(-((m.t / (0.4 * span)) ** 2)); if (!bm || sc > bm.sc) bm = { ...m, sc }; }
        rayHits++;
        obs.push({ kind: 1, ax, ay, x: px + bm.t * dx, y: py + bm.t * dy, nx: dx, ny: dy, w: Math.min(1, bm.s / 20) });
      }
    });
    if (obs.length < 24) break;
    const projective = it >= 2;
    for (let pass = 0; pass < 3; pass++) {
      const Hn = fitHLine(obs, H, projective, keepK);
      if (!Hn) break;
      let ss = 0, sw = 0;
      for (const o of obs) {
        if (!(o.w > 0)) continue;
        const [x, y] = applyH(Hn, o.u, o.v);
        o.e = Math.abs(o.nx * (x - o.x) + o.ny * (y - o.y)); ss += o.w * o.e * o.e; sw += o.w;
      }
      const rms = Math.sqrt(ss / (sw || 1));
      const k = Math.max(0.8, 1.5 * rms);
      for (const o of obs) if (o.w > 0) o.w *= o.e > 4 * k ? 0 : o.e > k ? k / o.e : 1;
      H = Hn;
      stats = { ring: ringHits / (ringTries || 1), ray: rayHits / (rayTries || 1), rms, n: obs.length };
    }
  }
  return { H, stats };
}

/* ---------- 5. image redressée ---------- */
/* image redressée du radar : carré `size`, cercle +++ de rayon size / (2·extent), haut de la fiche en haut */
export function rectify(image, res, { size = 2 * Math.round(RECT_R * RECT_EXT), extent = RECT_EXT, H = null } = {}) {
  const Hm = H || (res && res.homography);
  const out = new Uint8ClampedArray(size * size * 4);
  if (!Hm) return { width: size, height: size, data: out, R: size / (2 * extent) };
  const { width: W, height: Hh, data } = image;
  const Rr = size / (2 * extent), c = size / 2;
  for (let y = 0; y < size; y++) {
    const v = (y - c) / Rr;
    for (let x = 0; x < size; x++) {
      const u = (x - c) / Rr;
      const w = Hm[6] * u + Hm[7] * v + Hm[8];
      const sx = (Hm[0] * u + Hm[1] * v + Hm[2]) / w, sy = (Hm[3] * u + Hm[4] * v + Hm[5]) / w;
      const o = (y * size + x) * 4;
      /* hors de la photo : blanc transparent (alpha 0) — la lecture le sait, l'affichage montre le fond */
      if (!(sx >= 0 && sy >= 0 && sx < W - 1 && sy < Hh - 1)) { out[o] = out[o + 1] = out[o + 2] = 255; out[o + 3] = 0; continue; }
      const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
      const i = (y0 * W + x0) * 4, j = i + W * 4;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      out[o] = data[i] * w00 + data[i + 4] * w10 + data[j] * w01 + data[j + 4] * w11;
      out[o + 1] = data[i + 1] * w00 + data[i + 5] * w10 + data[j + 1] * w01 + data[j + 5] * w11;
      out[o + 2] = data[i + 2] * w00 + data[i + 6] * w10 + data[j + 2] * w01 + data[j + 6] * w11;
      out[o + 3] = 255;
    }
  }
  return { width: size, height: size, data: out, R: Rr };
}

/* ---------- 6. lecture du polygone dans l'image redressée ---------- */
function readPolygon(rect, angles0) {
  const S = rect.width, Rr = rect.R, c0 = S / 2, D = rect.data;
  const n = angles0.length;
  /* blanc du papier : 85e centile par canal dans la couronne 1,24 → 1,32 R */
  const ch = [[], [], []];
  for (let k = 0; k < 720; k++) {
    const a = k * 0.5 * DEG;
    for (const f of [1.25, 1.28, 1.31]) {
      const x = Math.round(c0 + f * Rr * Math.sin(a)), y = Math.round(c0 - f * Rr * Math.cos(a));
      if (x < 0 || y < 0 || x >= S || y >= S) continue;
      const i = (y * S + x) * 4;
      ch[0].push(D[i]); ch[1].push(D[i + 1]); ch[2].push(D[i + 2]);
    }
  }
  const paper = ch.map(a => { a.sort((x, y) => x - y); return Math.max(60, a[Math.floor(a.length * 0.85)] || 255); });
  /* plans normalisés (balance des blancs) : luminance et teinte (1 − min/max) */
  const N = S * S;
  const L = new Float32Array(N), T = new Float32Array(N);
  for (let p = 0, i = 0; p < N; p++, i += 4) {
    const r = Math.min(1.1, D[i] / paper[0]), g = Math.min(1.1, D[i + 1] / paper[1]), b = Math.min(1.1, D[i + 2] / paper[2]);
    L[p] = 255 * (0.299 * r + 0.587 * g + 0.114 * b);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    T[p] = mx > 0.05 ? 1 - mn / mx : 0;
  }
  const at = (F, u, v) => bilin(F, S, S, c0 + u * Rr, c0 + v * Rr);   /* (u, v) en unités de R, v vers le bas */
  const ux = a => Math.sin(a * DEG), uy = a => -Math.cos(a * DEG);
  /* étiquette du prénom sous le cartable (rectangle blanc à texte) : ignorée */
  const inLabel = (u, v) => Math.abs(u) < 0.25 && v > 0.04 && v < 0.16;

  /* niveaux de référence : encre (contour) et fond du disque, pour normaliser les contrastes */
  const lumVals = [];
  for (let k = 0; k < 2500; k++) {
    const a = (k * 137.508) % 360, f = 0.22 + 0.76 * ((k * 0.618034) % 1);
    const v = at(L, f * ux(a), f * uy(a));
    if (v === v) lumVals.push(v);
  }
  lumVals.sort((x, y) => x - y);
  const bg = lumVals[Math.floor(lumVals.length * 0.7)] || 220;
  const ink = lumVals[Math.floor(lumVals.length * 0.01)] || 90;
  const C = Math.max(30, bg - ink);

  /* --- 0. axes réels (petite correction d'angle : résidu de perspective) et cercles relevés le long de chaque axe --- */
  const lineAcross = (x, y, tx, ty, e) => (at(L, x + e * tx, y + e * ty) + at(L, x - e * tx, y - e * ty)) / 2 - at(L, x, y);
  const angles = angles0.map(a => {
    let bd = 0, bs = -Infinity, s0 = -Infinity;
    for (let d = -4; d <= 4.0001; d += 0.25) {
      const an = (a + d) * DEG, sn = Math.sin(an), cs = Math.cos(an);
      const vals = [];
      for (let f = 0.28; f <= 0.96; f += 0.04) {
        if (RINGS.some(q => Math.abs(q - f) < 0.03)) continue;
        const v = lineAcross(f * sn, -f * cs, cs, sn, 0.009);
        if (v === v) vals.push(v);
      }
      vals.sort((p1, p2) => p1 - p2);
      const sc = vals.length ? vals[Math.floor(vals.length * 0.5)] : -Infinity;
      if (Math.abs(d) < 1e-9) s0 = sc;
      if (sc > bs + 1e-9 || (Math.abs(sc - bs) < 1e-9 && Math.abs(d) < Math.abs(bd))) { bs = sc; bd = d; }
    }
    /* trait net et nettement mieux placé qu'à l'angle nominal */
    return bs > 0.1 * C && bs > s0 + 0.02 * C ? a + bd : a;
  });
  const knots = angles.map(a => {
    const r = RINGS.map(f0 => {
      const est = [];
      /* sondes assez loin de l'axe pour ne pas voir la pastille ni le contour qui en part (aimantation vers le cercle) */
      for (const d of [-5.5, -4.5, -3.5, -2.6, -1.7, 1.7, 2.6, 3.5, 4.5, 5.5]) {
        const an = (a + d) * DEG, sn = Math.sin(an), cs = Math.cos(an);
        let bf = f0, bv = -Infinity;
        for (let f = f0 - 0.02; f <= f0 + 0.02 + 1e-9; f += 0.0025) {
          const v = lineAcross(f * sn, -f * cs, sn, -cs, 0.007);
          if (v > bv) { bv = v; bf = f; }
        }
        if (bv > 0.08 * C) est.push(bf);
      }
      if (est.length < 2) return f0;
      est.sort((p1, p2) => p1 - p2);
      return (est[(est.length - 1) >> 1] + est[est.length >> 1]) / 2;
    });
    return [[THETA0_F * r[2], 0], [r[0], 1], [r[1], 2], [r[2], 3]];
  });
  const thetaAt = (k, f) => {
    const K = knots[k];
    if (!(f > K[0][0])) return 0;
    for (let q = 1; q < 4; q++) if (f <= K[q][0]) return K[q - 1][1] + (f - K[q - 1][0]) / (K[q][0] - K[q - 1][0]);
    return 3;
  };

  /* --- a. pastille blanche cerclée : centre clair, anneau sombre COMPLET, alentours plus clairs que l'anneau --- */
  const F0 = 0.13, F1 = 1.035, FS = 0.004;
  const NF = Math.round((F1 - F0) / FS) + 1;
  const fOf = i => F0 + i * FS;
  const iOf = f => clamp(Math.round((f - F0) / FS), 0, NF - 1);
  const RING_RADII = [0.012, 0.016, 0.02];
  const CS12 = [], SN12 = [], CS8 = [], SN8 = [];
  for (let q = 0; q < 12; q++) { CS12.push(Math.cos(q * Math.PI / 6)); SN12.push(Math.sin(q * Math.PI / 6)); }
  for (let q = 0; q < 8; q++) { CS8.push(Math.cos(q * Math.PI / 4 + 0.2)); SN8.push(Math.sin(q * Math.PI / 4 + 0.2)); }
  const k2 = Rr;           /* unités de R → pixels de l'image redressée */
  function dotAt(x, y) {
    const X = c0 + x * k2, Y = c0 + y * k2, e = 0.004 * k2;
    const cen = (2 * bilin(L, S, S, X, Y) + bilin(L, S, S, X + e, Y) + bilin(L, S, S, X - e, Y) + bilin(L, S, S, X, Y + e) + bilin(L, S, S, X, Y - e)) / 6;
    if (cen !== cen) return 0;
    let best = 0;
    for (const rr of RING_RADII) {
      const r = rr * k2, ro = (rr + 0.016) * k2;
      /* 3e plus clair de l'anneau (= 10e plus sombre sur 12) et moyenne */
      let m1 = -1, m2 = -1, m3 = -1, mean = 0;
      for (let q = 0; q < 12; q++) {
        const v = bilin(L, S, S, X + r * CS12[q], Y + r * SN12[q]);
        mean += v;
        if (v > m1) { m3 = m2; m2 = m1; m1 = v; } else if (v > m2) { m3 = m2; m2 = v; } else if (v > m3) m3 = v;
      }
      mean /= 12;
      let o = 0;
      for (let q = 0; q < 8; q++) o += bilin(L, S, S, X + ro * CS8[q], Y + ro * SN8[q]);
      o /= 8;
      const sc = Math.min(cen - m3, o - mean + 0.25 * C, cen - mean) / C;
      if (sc > best) best = sc;
    }
    return best;
  }
  const dot = angles.map(() => new Float32Array(NF));
  angles.forEach((a, k) => {
    const ex = ux(a), ey = uy(a), px = -ey, py = ex;
    for (let i = 0; i < NF; i++) {
      const f = fOf(i);
      /* tri rapide : un point clair entouré d'un anneau plus sombre ? */
      const bx = c0 + f * ex * k2, by = c0 + f * ey * k2, lx = 0.006 * px * k2, ly = 0.006 * py * k2;
      const cmax = Math.max(bilin(L, S, S, bx, by), bilin(L, S, S, bx + lx, by + ly), bilin(L, S, S, bx - lx, by - ly));
      let rm = 0;
      for (let q = 0; q < 8; q++) rm += bilin(L, S, S, bx + 0.021 * k2 * CS8[q], by + 0.021 * k2 * SN8[q]);
      if (!(cmax - rm / 8 > 0.12 * C)) { dot[k][i] = 0; continue; }
      let best = 0;
      for (const o of [-0.006, 0, 0.006]) {
        const x = f * ex + o * px, y = f * ey + o * py;
        if (inLabel(x, y) || x * x + y * y < (BAG_R - 0.01) * (BAG_R - 0.01)) continue;
        const v = dotAt(x, y);
        if (v > best) best = v;
      }
      dot[k][i] = best;
    }
  });
  /* pastille la plus nette près de f (recherche fine 2D) → { f, s } */
  function refineDot(k, f) {
    const a = angles[k], ex = ux(a), ey = uy(a), px = -ey, py = ex;
    let bf = f, bs = -1;
    for (let df = -0.02; df <= 0.02 + 1e-9; df += 0.00125) {
      for (const o of [-0.009, -0.006, -0.003, 0, 0.003, 0.006, 0.009]) {
        const ff = f + df, x = ff * ex + o * px, y = ff * ey + o * py;
        if (ff < BAG_R || inLabel(x, y)) continue;
        const v = dotAt(x, y);
        if (v > bs) { bs = v; bf = ff; }
      }
    }
    return { f: bf, s: bs };
  }

  /* --- visibilité : part de l'axe (et de ses abords) qui est bien dans la photo --- */
  const visible = angles.map(a => {
    let ok = 0, tot = 0;
    for (let f = 0.2; f <= 1.04; f += 0.04) {
      for (const da of [-0.06, 0, 0.06]) {
        const x = Math.round(c0 + f * Rr * Math.sin(a * DEG + da)), y = Math.round(c0 - f * Rr * Math.cos(a * DEG + da));
        tot++;
        if (x >= 0 && y >= 0 && x < S && y < S && D[(y * S + x) * 4 + 3] > 0) ok++;
      }
    }
    return tot ? ok / tot : 0;
  });

  /* texture le long d'une direction : des lettres (mots, espaces) font varier l'encre ; un trait, même épaissi par le flou,
     non. Écart moyen (÷ C) entre le minimum transversal (±0,006 R) et sa moyenne glissante (±0,01 R), de 0,3 à 0,92 R. */
  const texture = a => {
    const ex = ux(a), ey = uy(a), px = -ey, py = ex;
    const prof = [];
    for (let f = 0.3; f <= 0.92; f += 0.0025) {
      if (RINGS.some(q => Math.abs(q - f) < 0.022)) { prof.push(NaN); continue; }
      let m = Infinity;
      for (const o of [-0.006, 0, 0.006]) { const v = at(L, f * ex + o * px, f * ey + o * py); if (v < m) m = v; }
      prof.push(m);
    }
    let tex = 0, nt = 0;
    for (let i = 4; i < prof.length - 4; i++) {
      let sm = 0, ns = 0;
      for (let j = -4; j <= 4; j++) { const v = prof[i + j]; if (v === v) { sm += v; ns++; } }
      if (prof[i] === prof[i] && ns >= 7) { tex += Math.abs(prof[i] - sm / ns); nt++; }
    }
    return nt ? tex / nt / C : 0;
  };
  /* référence : même mesure entre les axes (papier, bruit de la photo) */
  const texBg = (() => {
    const v = angles.map((a, k) => texture((a + angles[(k + 1) % n] + (k === n - 1 ? 360 : 0)) / 2)).sort((p1, p2) => p1 - p2);
    return v[v.length >> 1] || 0;
  })();

  /* --- b. trait de l'axe ou mention « Pas de positionnement : absence » écrite le long de l'axe --- */
  const LAT = [-0.03, -0.024, -0.018, -0.012, -0.006, 0, 0.006, 0.012, 0.018, 0.024, 0.03];
  const lat = new Float32Array(LAT.length);
  const axisInfo = angles.map(a => {
    const ex = ux(a), ey = uy(a), px = -ey, py = ex;
    let line = 0, text = 0, tot = 0, cont = 0;
    for (let f = 0.34; f <= 0.92; f += 0.005) {
      if (RINGS.some(q => Math.abs(q - f) < 0.022)) continue;
      const x = f * ex, y = f * ey;
      let m1 = -1, m2 = -1, bad = false;
      for (let q = 0; q < LAT.length; q++) {
        const v = at(L, x + LAT[q] * px, y + LAT[q] * py);
        if (v !== v) { bad = true; break; }
        lat[q] = v;
        if (v > m1) { m2 = m1; m1 = v; } else if (v > m2) m2 = v;
      }
      if (bad) continue;
      /* encre = nettement plus sombre que le fond LOCAL (ombre portée, aplat du polygone : non) */
      const thr = m2 - 0.35 * C;
      tot++;
      const center = Math.min(lat[4], lat[5], lat[6]) < thr;
      const lateral = lat[1] < thr || lat[2] < thr || lat[3] < thr || lat[7] < thr || lat[8] < thr || lat[9] < thr;
      if (center && !lateral) line++;
      if (lateral) text++;
      if (center) cont++;
    }
    const tx = texture(a);
    /* mention écrite : encre de part et d'autre de l'axe ET texture de lettres (nettement plus marquée qu'entre les axes) —
       un trait d'axe épaissi par le flou de bougé ou noyé dans le bruit d'une photo sombre n'est pas une mention */
    const textEv = (tot ? text / tot : 0) > 0.3 && tx > 1.6 * texBg + 0.02;
    return { line: tot ? line / tot : 0, text: tot ? text / tot : 0, cont: tot ? cont / tot : 0, tex: tx, textEv };
  });

  /* --- c. teinte de part et d'autre de l'axe : polygone (teinté) → fond --- */
  const tint = angles.map(a => {
    const arr = new Float32Array(NF);
    for (let i = 0; i < NF; i++) {
      const f = fOf(i);
      let s = 0, c = 0;
      for (const side of [-1, 1]) {
        const da = side * Math.min(0.5, 0.035 / Math.max(0.1, f));
        const x = f * Math.sin(a * DEG + da), y = -f * Math.cos(a * DEG + da);
        const v = at(T, x, y), l = at(L, x, y);
        if (v === v) { s += v - 0.0012 * (l - bg); c++; }
      }
      arr[i] = c ? s / c : 0;
    }
    return arr;
  });

  /* --- d. candidats par axe : pics de pastille, grille, sommet au centre --- */
  const cand = angles.map((a, k) => {
    const list = new Map();
    const add = (f, why) => { const key = Math.round(f / 0.006); if (!list.has(key) || why === 'dot') list.set(key, { f, why }); };
    for (let f = 0.2; f <= 1.0001; f += 0.06) add(f, 'grid');
    add(1, 'grid');
    const Dk = dot[k], pk = [];
    for (let i = 2; i < NF - 2; i++) if (Dk[i] > 0.2 && Dk[i] >= Dk[i - 1] && Dk[i] >= Dk[i + 1] && Dk[i] >= Dk[i - 2] && Dk[i] >= Dk[i + 2]) pk.push(i);
    pk.sort((p, q) => Dk[q] - Dk[p]).slice(0, 5).forEach(i => add(fOf(i), 'dot'));
    const arr = [...list.values()].sort((p, q) => p.f - q.f);
    arr.unshift({ f: 0.02, why: 'center' });
    return arr;
  });

  /* --- e. contour entre axes voisins : trait sombre le long du segment + intérieur plus teinté que l'extérieur --- */
  function edgeScore(fa, aa, fb, ab) {
    const ax = fa * ux(aa), ay = fa * uy(aa), bx = fb * ux(ab), by = fb * uy(ab);
    let dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 0.03) return 0;
    dx /= len; dy /= len;
    let nx = -dy, ny = dx;
    if (nx * (ax + bx) + ny * (ay + by) < 0) { nx = -nx; ny = -ny; }      /* normale vers l'extérieur */
    let s = 0, c = 0;
    const m = 8;
    for (let q = 0; q < m; q++) {
      const t = 0.08 + 0.84 * (q + 0.5) / m;
      const x = ax + t * (bx - ax), y = ay + t * (by - ay);
      if (Math.hypot(x, y) < BAG_R + 0.02 || inLabel(x, y)) continue;
      const v0 = Math.min(at(L, x, y), at(L, x + 0.004 * nx, y + 0.004 * ny), at(L, x - 0.004 * nx, y - 0.004 * ny));
      const v1 = at(L, x + 0.014 * nx, y + 0.014 * ny), v2 = at(L, x - 0.014 * nx, y - 0.014 * ny);
      const ti = at(T, x - 0.032 * nx, y - 0.032 * ny), to = at(T, x + 0.032 * nx, y + 0.032 * ny);
      const li = at(L, x - 0.032 * nx, y - 0.032 * ny), lo = at(L, x + 0.032 * nx, y + 0.032 * ny);
      if (v0 !== v0 || v1 !== v1 || v2 !== v2 || ti !== ti || to !== to) continue;
      const line = clamp(((v1 + v2) / 2 - v0) / C, -0.3, 0.7);
      const side = clamp((ti - to) * 4 + (lo - li) / C * 0.5, -0.4, 0.5);
      s += line + 0.6 * side; c++;
    }
    return c >= 3 ? s / c : 0;
  }

  /* --- f. termes unaires --- */
  const unary = (k, cd) => {
    const info = axisInfo[k];
    const txt = info.textEv ? info.text : 0;
    if (cd.why === 'center') {
      let mx = 0; for (let i = iOf(BAG_R + 0.02); i < NF; i++) mx = Math.max(mx, dot[k][i]);
      /* mention écrite le long de l'axe : absence quasi certaine ; trait continu sans pastille : sommet caché sous le cartable */
      const hidden = !info.textEv && info.cont >= 0.85 ? 0.25 : 0;
      return 0.15 + 1.2 * clamp(txt - 0.2, 0, 0.5) + hidden - 0.6 * clamp(info.line - 0.5, 0, 0.5) - 0.5 * mx;
    }
    const i = iOf(cd.f);
    let dv = 0; for (let d = -1; d <= 1; d++) dv = Math.max(dv, dot[k][clamp(i + d, 0, NF - 1)]);
    const tb = tint[k][clamp(i - 8, 0, NF - 1)], ta = tint[k][clamp(i + 8, 0, NF - 1)];
    return 0.9 * dv + clamp((tb - ta) * 3, -0.3, 0.4) - 0.4 * clamp(txt - 0.25, 0, 0.5);
  };
  const U = cand.map((list, k) => list.map(cd => unary(k, cd)));
  const WE = 1.6;

  /* --- g. programmation dynamique sur le cycle : pour chaque valeur du 1er axe, passes avant / arrière
         → meilleure lecture et, pour chaque axe et chaque candidat, le meilleur total qui le contient (marges) --- */
  const K = cand.map(c => c.length);
  const Uf = U.map(u => Float64Array.from(u));
  /* contour entre l'axe k et le suivant, pour chaque paire de candidats (tableau à plat) */
  const Ef = angles.map((a, k) => {
    const k2 = (k + 1) % n, o = new Float64Array(K[k] * K[k2]);
    for (let i = 0; i < K[k]; i++) for (let j = 0; j < K[k2]; j++) o[i * K[k2] + j] = WE * edgeScore(cand[k][i].f, a, cand[k2][j].f, angles[k2]);
    return o;
  });
  const MM = K.map(kk => new Float64Array(kk).fill(-Infinity));
  const Fw = K.map(kk => new Float64Array(kk)), Bw = K.map(kk => new Float64Array(kk));
  let bestTot = -Infinity, bestC0 = 0;
  for (let c0 = 0; c0 < K[0]; c0++) {
    Fw[0].fill(-Infinity); Fw[0][c0] = Uf[0][c0];
    for (let k = 1; k < n; k++) {
      const Kp = K[k - 1], Kc = K[k], Ep = Ef[k - 1], Fp = Fw[k - 1], Fc = Fw[k], Uc = Uf[k];
      for (let j = 0; j < Kc; j++) {
        let b = -Infinity;
        for (let i = 0; i < Kp; i++) { const v = Fp[i] + Ep[i * Kc + j]; if (v > b) b = v; }
        Fc[j] = b + Uc[j];
      }
    }
    const El = Ef[n - 1], Kl = K[n - 1], K0 = K[0];
    let tot = -Infinity;
    for (let j = 0; j < Kl; j++) { const v = Fw[n - 1][j] + El[j * K0 + c0]; if (v > tot) tot = v; Bw[n - 1][j] = El[j * K0 + c0]; }
    if (tot > bestTot) { bestTot = tot; bestC0 = c0; }
    if (tot > MM[0][c0]) MM[0][c0] = tot;
    for (let k = n - 2; k >= 1; k--) {
      const Kc = K[k], Kn = K[k + 1], Ec = Ef[k], Bn = Bw[k + 1], Un = Uf[k + 1], Bc = Bw[k];
      for (let j = 0; j < Kc; j++) {
        let b = -Infinity;
        for (let i = 0; i < Kn; i++) { const v = Ec[j * Kn + i] + Un[i] + Bn[i]; if (v > b) b = v; }
        Bc[j] = b;
      }
    }
    for (let k = 1; k < n; k++) for (let j = 0; j < K[k]; j++) { const v = Fw[k][j] + Bw[k][j]; if (v > MM[k][j]) MM[k][j] = v; }
  }
  if (bestTot === -Infinity) return null;
  /* chemin optimal (premier axe fixé à bestC0) */
  const path = new Int32Array(n);
  {
    const back = [];
    Fw[0].fill(-Infinity); Fw[0][bestC0] = Uf[0][bestC0];
    for (let k = 1; k < n; k++) {
      const Kp = K[k - 1], Kc = K[k], Ep = Ef[k - 1], Fp = Fw[k - 1], Fc = Fw[k], bk = new Int32Array(Kc);
      for (let j = 0; j < Kc; j++) {
        let b = -Infinity, bi = 0;
        for (let i = 0; i < Kp; i++) { const v = Fp[i] + Ep[i * Kc + j]; if (v > b) { b = v; bi = i; } }
        Fc[j] = b + Uf[k][j]; bk[j] = bi;
      }
      back.push(bk);
    }
    let bj = 0, bv = -Infinity;
    for (let j = 0; j < K[n - 1]; j++) { const v = Fw[n - 1][j] + Ef[n - 1][j * K[0] + bestC0]; if (v > bv) { bv = v; bj = j; } }
    path[n - 1] = bj;
    for (let k = n - 1; k >= 1; k--) path[k - 1] = back[k - 1][path[k]];
    path[0] = bestC0;
  }

  /* --- h. affinage (pastille la plus nette à ±0,02 R) et marge de chaque sommet --- */
  const out = angles.map((a, k) => {
    const cd = cand[k][path[k]];
    let f = cd.f, refined = false;
    if (cd.why !== 'center') {
      const r = refineDot(k, f);
      if (r.s > 0.3) { f = r.f; refined = true; }
    }
    let alt = -Infinity;
    cand[k].forEach((c2, j) => {
      if (Math.abs(c2.f - f) < 0.07 && (c2.why === 'center') === (cd.why === 'center')) return;
      if (MM[k][j] > alt) alt = MM[k][j];
    });
    return { k, f, angle: angles[k], theta: thetaAt(k, f), center: cd.why === 'center', refined, margin: bestTot - alt, dot: cd.why === 'center' ? 0 : Math.max(dot[k][iOf(f)], refined ? 0.3 : 0), line: axisInfo[k].line, text: axisInfo[k].text, cont: axisInfo[k].cont, tex: axisInfo[k].tex, textEv: axisInfo[k].textEv, visible: visible[k] };
  });
  return { axes: out, paper, C, bg, total: bestTot, texBg, knots: knots.map(K => K.slice(1).map(q => Math.round(q[0] * 10000) / 10000)) };
}

/* matière d'après la couleur de la bande des familles (1,10-1,17 R), rapportée au blanc du papier voisin (1,25-1,32 R) :
   orange franc → maths ; gris-vert, turquoise ou presque neutre → français (photo sous lumière chaude : le papier est
   lui-même orangé, d'où la comparaison au papier et non à l'absolu) → { subject, sat, hue } */
export function subjectFromImage(image, H) {
  const { width: W, height: Hh, data } = image;
  const px = (u, v) => {
    const [x, y] = applyH(H, u, v);
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= W || yi >= Hh) return null;
    const i = (yi * W + xi) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const paper = [[], [], []], band = [];
  for (let k = 0; k < 240; k++) {
    const a = (k + 0.5) * 1.5 * DEG, sn = Math.sin(a), cs = Math.cos(a);
    for (const f of [1.25, 1.28, 1.31]) { const c = px(f * sn, -f * cs); if (c) for (let q = 0; q < 3; q++) paper[q].push(c[q]); }
    for (const f of [1.11, 1.135, 1.16]) { const c = px(f * sn, -f * cs); if (c) band.push(c); }
  }
  if (paper[0].length < 60 || band.length < 60) return { subject: null, sat: 0, hue: 0 };
  const pw = paper.map(a => { a.sort((x, y) => x - y); return Math.max(40, a[Math.floor(a.length * 0.85)]); });
  /* pixels colorés de la bande (ni papier, ni pictogrammes sombres) : teinte et saturation relatives */
  const sats = [], hx = [], hy = [];
  for (const c of band) {
    const r = c[0] / pw[0], g = c[1] / pw[1], b = c[2] / pw[2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx < 0.5 || mx > 1.25) continue;
    const sat = mx > 0 ? 1 - mn / mx : 0;
    sats.push(sat);
    if (sat < 0.03) continue;
    const d = mx - mn;
    let hue = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
    if (hue < 0) hue += 360;
    hx.push(Math.cos(hue * DEG) * sat); hy.push(Math.sin(hue * DEG) * sat);
  }
  if (sats.length < 40) return { subject: null, sat: 0, hue: 0 };
  sats.sort((x, y) => x - y);
  /* 60e centile : la bande colorée, pas ses interstices */
  const sat = sats[Math.floor(sats.length * 0.6)];
  const hue = hx.length ? ((Math.atan2(hy.reduce((a, b) => a + b, 0), hx.reduce((a, b) => a + b, 0)) / DEG) + 360) % 360 : 0;
  let subject = null;
  if (sat > 0.12 && hue >= 5 && hue <= 50) subject = 'ma';
  else if (sat < 0.09 || (hue >= 120 && hue <= 250)) subject = 'fr';
  return { subject, sat: Math.round(sat * 1000) / 1000, hue: Math.round(hue) };
}

/* ============ DÉTECTION ============ */
export function detectRadar(image, opts = {}) {
  const t0 = nowMs();
  const tm = {};
  const mark = k => { tm[k] = Math.round(nowMs() - t0); };
  const fail = (reason, extra = {}, hint = null) => ({ ok: false, confidence: 0, reason, hint, center: null, R: 0, rotation: 0, ellipse: null,
    homography: null, subject: null, template: null, axes: [], ms: nowMs() - t0, debug: extra });
  try {
    if (!image || !(image.width > 16) || !(image.height > 16) || !image.data || image.data.length < image.width * image.height * 4) return fail('image');
    const templates = [];
    if (opts.templates) for (const g of ['fr', 'ma']) if (opts.templates[g] && opts.templates[g].axes && opts.templates[g].axes.length >= 3) templates.push(opts.templates[g]);
    if (opts.template && opts.template.axes && opts.template.axes.length >= 3) templates.push(opts.template);
    if (!templates.length) return fail('gabarit');
    const sample = makeLuma(image);

    /* 1. image de travail (640 px), légèrement lissée ; vote du centre */
    const wk = workImage(image, opts.work || WORK);
    const { w, h } = wk;
    const B = blur121(wk.Y, w, h);
    /* cercles pointillés (traits pâles, 1 à 2 px) : relevés sur l'image de travail NON lissée (contraste ×2,5) */
    const BR = wk.Y;
    mark('work');
    let peaks = voteCenter(blur121(B, w, h), w, h);
    if (opts.hint && opts.hint.center) {
      const hx = (opts.hint.center.x + 0.5) * wk.sx - 0.5, hy = (opts.hint.center.y + 0.5) * wk.sy - 0.5;
      peaks = [{ x: hx, y: hy, v: Infinity }, ...peaks.filter(p => Math.hypot(p.x - hx, p.y - hy) > 6)];
    }
    mark('vote');
    if (!peaks.length) return fail('aucun-cercle');

    /* 2. vérification de chaque candidat : motif des trois cercles (0,51 / 0,755 / 1), centre et échelle affinés */
    const m0 = Math.min(w, h), M0 = Math.max(w, h);
    const Rmin = Math.max(16, 0.08 * m0), Rmax = Math.min(0.6 * M0, 0.72 * m0 + 0.2 * M0);
    /* deux images : non lissée (cercles pâles d'une vraie photo) et lissée (photo bruitée : grain, JPEG très compressé,
       où le bruit fait voir des triplets de « cercles » à toutes les échelles) ; le meilleur ajustement l'emporte */
    const cands = [];
    const noiseOf = new Map([[BR, lineNoise(BR, w, h)], [B, lineNoise(B, w, h)]]);
    const clean = c => c.snr >= 4 && ((c.nFrac > 0.7 && c.rmsRel < 0.008) || (c.nFrac > 0.55 && c.ratioErr < 0.02 && c.rmsRel < 0.012));
    for (const p of peaks.slice(0, 6)) {
      for (const img of [BR, B]) {
        /* image lissée : seulement si l'image nette n'a rien donné de franc (photo granuleuse) */
        if (img === B && cands.some(clean)) break;
        const hyp = scaleVotes(img, w, h, p.x, p.y, Rmin, Rmax);
        for (const hy of hyp.slice(0, 3)) {
          if (hy.v < 0.3 * (hyp[0].v || 1)) continue;
          const fc = fitCenter(img, w, h, p.x, p.y, hy.R);
          if (!fc || Math.hypot(fc.x - p.x, fc.y - p.y) > 0.2 * hy.R || Math.abs(fc.R / hy.R - 1) > 0.12) continue;
          const ratioErr = fc.ratios ? Math.abs(fc.ratios[0] - RINGS[0]) + Math.abs(fc.ratios[1] - RINGS[1]) : 0.2;
          const rmsRel = fc.rms / fc.R;
          /* qualité : part des directions où les trois cercles sont vus aux bons rapports, régularité, rapports */
          const score = 10 * fc.nFrac - 300 * rmsRel - 50 * ratioErr;
          if (fc.nFrac < 0.2 || rmsRel > 0.032 || ratioErr > 0.05) continue;
          /* netteté des traits retenus rapportée au bruit de la photo : un cercle imprimé ressort du grain, les « triplets »
             trouvés dans le bruit d'une photo granuleuse non (ils s'ajustent pourtant très bien, faute de contrainte) */
          const snr = fc.sMed / noiseOf.get(img);
          const cand = { x: fc.x, y: fc.y, R: fc.R, nFrac: fc.nFrac, rmsRel, ratios: fc.ratios, ratioErr, score, pts: fc.pts, img, snr, sMed: fc.sMed };
          /* même cercle vu dans les deux images : la géométrie la plus nette est gardée, avec la meilleure netteté de trait */
          const dup = cands.findIndex(c => Math.hypot(c.x - fc.x, c.y - fc.y) < 0.05 * fc.R && Math.abs(c.R / fc.R - 1) < 0.05);
          if (dup >= 0) {
            const d = cands[dup];
            if (d.score < score) cands[dup] = { ...cand, snr: Math.max(snr, d.snr) }; else d.snr = Math.max(snr, d.snr);
            continue;
          }
          cands.push(cand);
        }
      }
      if (cands.some(clean)) break;
    }
    /* rang : qualité géométrique, pénalisée quand les traits se distinguent mal du bruit (pas de prime au-delà) */
    for (const c of cands) c.rank = c.score - 3 * clamp(Math.log2(6 / c.snr), 0, 3);
    cands.sort((c1, c2) => c2.rank - c1.rank);
    mark('verify');

    /* 3-4. chaque candidat, du meilleur au moins bon : modèle des cercles en perspective, axes (gabarit, rotation),
       homographie affinée, « haut » par les repères ⊕. Le premier qui passe tous les contrôles est retenu ; sinon le
       meilleur essai sert au calage pré-rempli du plan B. */
    const sx = wk.sx, sy = wk.sy;
    /* passage en pleine résolution : x_f = (x_w + 0,5) / s − 0,5 */
    const toFullH = [1 / sx, 0, 0.5 / sx - 0.5, 0, 1 / sy, 0.5 / sy - 0.5, 0, 0, 1];
    const rotH = rho => { const c = Math.cos(rho * DEG), s2 = Math.sin(rho * DEG); return [c, -s2, 0, s2, c, 0, 0, 0, 1]; };
    const attempt = cand => {
      const { x: cx, y: cy, R } = cand;
      let rings = cand.rings || (cand.pts ? fitConcentric(cand.pts, cx, cy, R) : null);
      let nFrac = cand.nFrac;
      if (!cand.rings) {
        if (!rings || rings.ratio < 0.55 || rings.tilt > 0.6 || rings.spread > 1.15 || Math.hypot(rings.cx - cx, rings.cy - cy) > 0.15 * R) rings = { H: similarityH(cx, cy, R, 0), ratio: 1, tilt: 0 };
        /* nouveau relevé des cercles à travers le modèle en perspective : retenu seulement s'il en voit davantage */
        const rr = opts.noRingRefine ? { rings, nFrac: 0 } : ringRefine(cand.img || BR, w, h, rings, R);
        if (rr.nFrac > cand.nFrac + 0.05) rings = rr.rings;
        nFrac = Math.max(cand.nFrac, rr.nFrac);
      }
      /* géométrie approchée du candidat (pleine résolution) : sert au conseil de prise de vue en cas d'échec */
      const geo = { x: (cx + 0.5) / sx - 0.5, y: (cy + 0.5) / sy - 0.5, R: R / ((sx + sy) / 2), ratio: rings.ratio || 1, nFrac };
      if (nFrac < 0.35) return { fail: 'pas-de-radar', nFrac };
      let kInfo = null;
      {
        const sk = searchK(B, w, h, rings.H, templates);
        kInfo = { start: +sk.start.toFixed(2), end: +sk.c.toFixed(2), evals: sk.evals };
        if (sk.c > sk.start) rings = { ...rings, H: sk.H };
      }
      const Q = angularProfileH(B, w, h, rings.H, 720);
      const Hf = mulH(toFullH, rings.H);
      const baseH = rho => mulH(Hf, rotH(rho));
      /* a priori de matière : couleur DANS le radar (bande des familles rapportée au papier), sinon celle fournie */
      const col = subjectFromImage(image, Hf);
      const prior = col.subject || opts.subject || null;
      let pk = null;
      const byTpl = [];
      for (const tpl of templates) {
        const angles = tpl.axes.map(a => Number(a.angle) || 0);
        const fit = fitRotation(Q, angles);
        /* contrôle : les mi-chemins entre axes ne doivent pas ressembler à des axes */
        const step = 360 / angles.length;
        let bt = null;
        for (const cnd of fit.cands.slice(0, angles.length + 2)) {
          let off = 0;
          for (const a of angles) off += Math.max(0, qAt(Q, a + cnd.rho + step / 2));
          off /= angles.length;
          const contrast = cnd.v - off;
          const g = glyphScore(sample, baseH(cnd.rho));
          const tilt = Math.abs(((cnd.rho + 180) % 360 + 360) % 360 - 180);
          const pb = tpl.subject && prior && tpl.subject === prior ? 0.6 : 0;
          const score = contrast * 2 + g * 0.35 - tilt * 0.02 + pb;
          const c2 = { tpl, angles, rho: cnd.rho, v: cnd.v, contrast, glyph: g, z: fit.z, score, tilt };
          if (!bt || score > bt.score) bt = c2;
        }
        if (bt) {
          byTpl.push(bt);
          /* entre gabarits : la netteté des axes décide (les repères ⊕ ne dépendent que de la rotation, pas du gabarit) ;
             l'a priori de matière ne fait que départager deux profils voisins */
          const key = c2 => c2.contrast * (1 + (c2.tpl.subject && prior && c2.tpl.subject === prior ? 0.05 : 0));
          if (!pk || key(bt) > key(pk)) pk = bt;
        }
      }
      if (!pk || pk.contrast < 2.5) return { fail: 'axes-introuvables', nFrac, contrast: pk && pk.contrast, geo };
      const pick = pk;
      /* autres gabarits plausibles (le choix par le seul profil angulaire est serré entre 7 et 9 axes) */
      const alts = byTpl.filter(c2 => c2 !== pk && c2.contrast >= 2.5);
      const Rf = R / ((sx + sy) / 2);
      const [Cx, Cy] = applyH(Hf, 0, 0);
      pick.rho = ((pick.rho + 180) % 360 + 360) % 360 - 180;
      const H0 = baseH(pick.rho);
      let { H, stats } = refineH(sample, H0, pick.angles, Rf, true);
      /* photo de biais : la part projective du modèle des cercles est gardée pendant les premières passes ; si l'ajustement
         n'est pas net, on reprend sans elle (passes affines puis projectives, comme pour une photo de face) */
      if (!(stats.ray >= 0.6 && stats.rms / Rf <= 0.008)) {
        const r0 = refineH(sample, H0, pick.angles, Rf, false);
        if (r0.stats.ray - 20 * r0.stats.rms / Rf > stats.ray - 20 * stats.rms / Rf) ({ H, stats } = r0);
      }
      /* gabarit : celui dont les axes sont RÉELLEMENT retrouvés le long de leur tracé (part des sondes qui voient un trait),
         pas seulement le meilleur profil angulaire — sinon une fiche de français peut être lue avec le gabarit de maths */
      for (const alt of alts) {
        alt.rho = ((alt.rho + 180) % 360 + 360) % 360 - 180;
        const r2 = refineH(sample, baseH(alt.rho), alt.angles, Rf, true);
        if (r2.stats.ray > stats.ray + 0.15) {
          Object.assign(pick, { tpl: alt.tpl, angles: alt.angles, rho: alt.rho, v: alt.v, contrast: alt.contrast, glyph: alt.glyph, z: alt.z, score: alt.score, tilt: alt.tilt, swapped: true });
          H = r2.H; stats = r2.stats;
        }
      }
      /* départage du « haut » parmi les rotations équivalentes : repères ⊕ (sinon photo à peu près droite) */
      {
        const n = pick.angles.length, step = 360 / n;
        const regular = pick.angles.every((a, i) => Math.abs(((a - pick.angles[0] - i * step) % 360 + 540) % 360 - 180) < 0.6);
        if (regular) {
          const options = [];
          for (let j = 0; j < n; j++) {
            const Hj = mulH(H, rotH(j * step));
            const [ox, oy] = applyH(Hj, 0, 0), [ux, uy] = applyH(Hj, 0, -0.5);
            const rot = Math.atan2(ux - ox, -(uy - oy)) / DEG;
            options.push({ j, H: Hj, g: glyphScore(sample, Hj), tilt: Math.abs(((rot + 180) % 360 + 360) % 360 - 180) });
          }
          const byG = options.slice().sort((p1, p2) => p2.g - p1.g);
          const top = byG[0], second = byG[1] || { g: 0 };
          const upright = options.slice().sort((p1, p2) => p1.tilt - p2.tilt)[0];
          let chosen;
          if (top.g > 12 && top.g > 1.6 * second.g) { chosen = top; pick.up = 'glyphs'; }
          else { chosen = upright; pick.up = 'prior'; }
          pick.glyph = top.g; pick.glyph2 = second.g;
          if (chosen.j) H = chosen.H;
        }
      }
      /* contrôles de cohérence de l'homographie */
      const Cimg = applyH(H, 0, 0);
      let rs = 0, rmin = Infinity, rmax = 0;
      for (let k = 0; k < 72; k++) {
        const a = k * 5 * DEG;
        const [x, y] = applyH(H, Math.sin(a), -Math.cos(a));
        const r = Math.hypot(x - Cimg[0], y - Cimg[1]);
        rs += r; rmin = Math.min(rmin, r); rmax = Math.max(rmax, r);
      }
      const Rimg = rs / 72;
      if (!(Rimg > 0) || rmax / rmin > 1.6 || Math.hypot(Cimg[0] - Cx, Cimg[1] - Cy) > 0.25 * Rf || Math.abs(Rimg / Rf - 1) > 0.25) {
        return { fail: 'perspective-incoherente', stats, geo };
      }
      const [ux, uy] = applyH(H, 0, -0.5);
      const rotation = Math.atan2(ux - Cimg[0], -(uy - Cimg[1])) / DEG;
      const rmsRel = stats.rms / (Rimg || 1);
      /* garde-fous : axes réellement retrouvés, « haut » trouvé sans ambiguïté par les repères ⊕ (une vraie fiche les porte ;
         un graphique radar ordinaire, une horloge ou une cible, non), radar assez grand pour lire les pastilles */
      const gDet = glyphDetail(sample, H), nGlyphs = glyphCount(gDet);
      /* contraste de référence de la photo dans le radar (encre la plus sombre ↔ papier), pour juger les repères ⊕ */
      const lv = [];
      for (let k = 0; k < 600; k++) {
        const a = (k * 137.508) % 360 * DEG, f = 0.2 + 0.85 * ((k * 0.618034) % 1);
        const [x, y] = applyH(H, f * Math.sin(a), -f * Math.cos(a));
        const v = sample(x, y); if (v === v) lv.push(v);
      }
      lv.sort((p1, p2) => p1 - p2);
      const cref = lv.length > 100 ? Math.max(20, lv[Math.floor(lv.length * 0.97)] - lv[Math.floor(lv.length * 0.03)]) : 100;
      const gRel = pick.glyph / cref;
      const guards = stats.ray >= 0.6 && pick.up === 'glyphs' && pick.glyph >= 2.2 * (pick.glyph2 || 0) && nGlyphs >= 5 && Rimg >= MIN_R && gRel >= 0.3;
      const pass = stats.ring >= 0.8 && rmsRel <= 0.012 && (guards || !!opts.noGuards);
      return { pass, best: { ...cand, nFrac, kInfo }, pick, H, stats, Cimg, Rimg, rotation, rmsRel, gDet, nGlyphs, guards, col, gRel,
        rank: (pass ? 10 : 0) + stats.ray + (pick.up === 'glyphs' ? 1 : 0) + nGlyphs / 6 - 30 * rmsRel };
    };
    let A = null, fallbackA = null, lastFail = null;
    const tried = [];
    /* budget de temps : sur un téléphone lent, on renonce plus tôt aux candidats douteux (plan B) */
    const budget = opts.budgetMs > 0 ? opts.budgetMs : 2500;
    const runList = list => {
      for (const cand of list) {
        if (tried.length && nowMs() - t0 > budget) break;
        if (tried.some(c => Math.hypot(c.x - cand.x, c.y - cand.y) < 0.03 * cand.R && Math.abs(c.R / cand.R - 1) < 0.04)) continue;
        tried.push(cand);
        const a = attempt(cand);
        if (a.fail) { lastFail = a; continue; }
        if (a.pass) { A = a; return; }
        if (!fallbackA || a.rank > fallbackA.rank) fallbackA = a;
      }
    };
    runList(cands.slice(0, 3));
    mark('attempts');
    /* repli : centre approché (photo de biais) → triplets à écart relatif fixe, modèle des cercles en perspective */
    if (!A && nowMs() - t0 < 0.6 * budget) {
      const extra = [];
      for (const p of peaks.slice(0, 3)) {
        for (const hy of ringTriplesSR(BR, w, h, p.x, p.y, Rmin, Rmax)) {
          const rg = fitConcentric(hy.pts, hy.x, hy.y, hy.R);
          if (!rg || rg.ratio < 0.55 || rg.tilt > 0.6 || rg.spread > 1.15) continue;
          const rr = ringRefine(BR, w, h, rg, hy.R);
          if (rr.nFrac < 0.4) continue;
          const [ox, oy] = applyH(rr.rings.H, 0, 0), [qx, qy] = applyH(rr.rings.H, 1, 0);
          const Rr = Math.hypot(qx - ox, qy - oy);
          if (extra.some(c => Math.hypot(c.x - ox, c.y - oy) < 0.05 * Rr && Math.abs(c.R / Rr - 1) < 0.05)) continue;
          extra.push({ x: ox, y: oy, R: Rr, nFrac: rr.nFrac, rmsRel: 0.01, ratios: RINGS.slice(0, 2), ratioErr: 0, score: 10 * rr.nFrac, pts: null, rings: rr.rings, sr: true });
        }
      }
      extra.sort((c1, c2) => c2.score - c1.score);
      runList(extra.slice(0, 3));
    }
    mark('sr');
    /* calage pré-rempli du plan B : seulement pour un radar vraisemblable (cercles et axes bien vus, ou repères ⊕) */
    if (!A && fallbackA) {
      const f = fallbackA, st = f.stats;
      if (!((f.pick.up === 'glyphs' && st.ray >= 0.6 && st.ring >= 0.7) || (st.ray >= 0.85 && st.ring >= 0.9 && f.rmsRel <= 0.008))) fallbackA = null;
    }
    if (!A) A = fallbackA;
    if (!A) {
      /* radar entrevu sans lecture : conseil de prise de vue d'après le meilleur candidat */
      let hint = null;
      const g = lastFail && lastFail.geo;
      if (g && g.nFrac >= 0.7) {
        const W = image.width, Hh = image.height, e = 1.2 * g.R;
        if (g.x - e < 0 || g.y - e < 0 || g.x + e > W - 1 || g.y + e > Hh - 1) hint = 'hors-cadre';
        else if (g.R < 1.15 * MIN_R) hint = 'trop-petit';
        else if (g.ratio < 0.93) hint = 'de-biais';
      }
      return fail(lastFail ? lastFail.fail : 'pas-de-radar', lastFail || {}, hint);
    }
    const { best, pick, stats, Cimg, Rimg, rotation, gDet, nGlyphs, guards, gRel } = A;
    const H = A.H;
    mark('H');
    /* 5-6. image redressée et lecture du polygone */
    const rect = rectify(image, null, { H, size: 2 * Math.round(RECT_R * RECT_EXT), extent: RECT_EXT });
    mark('rect');
    const poly = readPolygon(rect, pick.angles);
    mark('poly');
    if (!poly) return fail('polygone', { stats });
    const subj = subjectFromImage(image, H);

    /* ellipse du cercle +++ (moindres carrés sur 72 points projetés) */
    const ellipse = ellipseOf(H);

    /* lecture et confiance par axe */
    const axes = poly.axes.map((p, k) => {
      let theta, conf;
      if (p.center || p.f < BAG_R - 0.005) {
        /* sommet au centre : absence si la mention « Pas de positionnement : absence » est écrite le long de l'axe ;
           trait de l'axe bien visible → valeur très basse cachée par le cartable ; ni l'un ni l'autre (axe caché,
           hors cadre, illisible) → « absent » à vérifier */
        if (p.textEv) { theta = null; conf = clamp(0.55 + 0.25 * Math.tanh(p.margin / 0.5) + 0.5 * clamp(p.text - 0.3, 0, 0.4), 0, 1); }
        else if (p.line >= 0.45 || p.cont >= 0.85) { theta = 0.3; conf = 0.3; }
        else { theta = null; conf = 0.35; }
      } else {
        theta = Math.round(clamp(p.theta, 0, 3) * 10) / 10;
        conf = clamp(0.3 + 0.35 * Math.tanh(p.margin / 0.5) + 0.35 * clamp(p.dot / 0.6, 0, 1), 0, 1);
        if (!p.refined) conf = Math.min(conf, 0.55);
        /* pastille faible sur un axe où une mention est écrite : sans doute une lettre (« o », « e »…) → à vérifier */
        if (p.textEv && p.dot < 0.6) conf = Math.min(conf, 0.5);
      }
      /* axe en partie hors de la photo : lecture à vérifier */
      if (p.visible < 0.95) conf = Math.min(conf, 0.35);
      const [x, y] = applyH(H, p.f * Math.sin(p.angle * DEG), -p.f * Math.cos(p.angle * DEG));
      return { index: k, id: pick.tpl.axes[k].id, angle: pick.angles[k], theta, confidence: Math.round(conf * 100) / 100, r: Math.round(p.f * 1000) / 1000, x, y };
    });

    /* confiance globale : cercles vus, ajustement serré des cercles et des axes (une vraie fiche s'ajuste au pixel près),
       axes nets, « haut » trouvé par les repères ⊕, puis lecture des sommets */
    const rmsRel = stats.rms / (Rimg || 1);
    const geo = 0.25 * clamp((best.nFrac - 0.35) / 0.5, 0, 1) + 0.2 * clamp((stats.ring - 0.6) / 0.4, 0, 1) +
      0.2 * clamp(1 - (rmsRel - 0.004) / 0.008, 0, 1) + 0.15 * clamp((pick.contrast - 2.5) / 6, 0, 1) + (pick.up === 'glyphs' ? 0.2 : 0.06);
    const meanAx = axes.reduce((s, a) => s + a.confidence, 0) / (axes.length || 1);
    const confidence = Math.round(clamp(0.6 * geo + 0.4 * meanAx, 0, 1) * 100) / 100;
    const ok = confidence >= 0.6 && A.pass;
    /* conseil de prise de vue (lecture incertaine ou points à vérifier) : radar coupé, trop petit, photo de biais */
    let hint = null;
    if (poly.axes.some(a => a.visible < 0.95) || gDet.some(g => !(g.disk > 0))) hint = 'hors-cadre';
    else if (Rimg < 1.15 * MIN_R) hint = 'trop-petit';
    else if (ellipse.rx > 0 && ellipse.ry / ellipse.rx < 0.93) hint = 'de-biais';
    return {
      ok, confidence, reason: ok ? undefined : 'confiance-faible', hint,
      center: { x: Cimg[0], y: Cimg[1] }, R: Rimg, rotation, ellipse, homography: H,
      subject: pick.tpl.subject || subj.subject, subjectColor: subj.subject, template: pick.tpl,
      axes, ms: nowMs() - t0,
      debug: { gRel: Math.round(gRel * 1000) / 1000, snr: best.snr && Math.round(best.snr * 10) / 10, img: best.img === B ? 'B' : 'BR', color: subj, kInfo: best.kInfo, glyphs: gDet.map(g => [Math.round(g.disk), Math.round(g.cross), Math.round(g.du * 1000), Math.round(g.dv * 1000)]), nGlyphs, swapped: !!pick.swapped, guards, rmsRel, t: tm, ringFrac: best.nFrac, ringRms: best.rmsRel, ratios: best.ratios, rayContrast: pick.contrast, glyph: pick.glyph, glyph2: pick.glyph2, up: pick.up, stats,
        dots: poly.axes.map(a => Math.round(a.dot * 100) / 100), margins: poly.axes.map(a => Math.round(a.margin * 100) / 100),
        line: poly.axes.map(a => Math.round(a.line * 100) / 100), text: poly.axes.map(a => Math.round(a.text * 100) / 100), cont: poly.axes.map(a => Math.round(a.cont * 100) / 100), tex: poly.axes.map(a => Math.round(a.tex * 1000) / 1000), texBg: Math.round(poly.texBg * 1000) / 1000, knots: poly.knots, fs: poly.axes.map(a => Math.round(a.f * 10000) / 10000) }
    };
  } catch (e) {
    return fail('erreur', { error: String(e && e.message || e) });
  }
}

/* ellipse image du cercle +++ : centre, demi-axes, orientation (°) par moments des points projetés */
function ellipseOf(H) {
  const pts = [];
  for (let k = 0; k < 120; k++) { const a = k * 3 * DEG; pts.push(applyH(H, Math.sin(a), -Math.cos(a))); }
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
  sxx /= pts.length; syy /= pts.length; sxy /= pts.length;
  const tr = sxx + syy, det = sxx * syy - sxy * sxy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
  return { cx: mx, cy: my, rx: Math.sqrt(2 * l1), ry: Math.sqrt(2 * Math.max(0, l2)), angle: 0.5 * Math.atan2(2 * sxy, sxx - syy) / DEG };
}
/* outils internes exposés aux tests */
export const __test = { fitConcentric, readPolygon, workImage, voteCenter, fitCenter, ringTriplesSR, blur121, lineMaxima, bilin };
