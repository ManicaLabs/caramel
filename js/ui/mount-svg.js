/* ============ COMPAGNON : RIG SVG « KAWAII FLAT » (v2.1) ============
   mountSVG(type, worn, size, moodClass, opts = {}) → chaîne SVG (module pur : aucun accès au DOM au chargement).
     type      : clé de MOUNTS (pony horse cat capy dolphin lion unicorn dragon ; v2.5 : bear koala dog whale owl parrot
                 penguin chick ; inconnue → poney)
     worn      : ids d'accessoires portés (SHOP), un par emplacement (head face neck back tail wings)
     size      : largeur en px ; hauteur = round(0,84 × largeur) (viewBox 0 0 100 84, comme la v11)
     moodClass : classes d'humeur posées sur la racine : walk joy sad dance sleep eat hop wiggle ('' = repos)
     opts.expr : expression initiale (EXPRESSIONS, défaut 'neutral') ; opts.stage : 1 petit, 2 junior, 3 champion
     opts.shadow : false → pas d'ombre au sol (l'hôte dessine la sienne ; le groupe .c-shadow reste, vide)
     opts.phase : décalage (s) des boucles d'attente (respiration, regard, clignements) quand plusieurs compagnons
                  se côtoient (variable --c-ph sur la racine ; chaque espèce a déjà sa propre phase)
     opts.view : 'portrait' → SVG carré (largeur = hauteur = size) cadré sur la tête, rogné (avatars ronds)
   Dessin : tourné vers la DROITE, sabots / pattes posés sur la ligne y = 74 (cloture.js : FEET = 0,74), marge en
   haut pour chapeau et couronne. Style commun aux 16 espèces : contour brun chaud #4a2c1a (≈ 3 px à l'écran : il
   s'affine au-delà de 140 px), aplats + une ombre + un reflet, grands yeux brillants à deux reflets, joues rosées.
   Révision v2.1 (critique A2) : dauphin (rostre court, front bombé, sourire, aileron courbé, nageoire sur le flanc,
   caudale à deux lobes, vague AU PREMIER PLAN .c-wave hors de .c-all), dragon (turquoise, museau à narines, cornes
   courbées vers l'arrière dessinées par-dessus chapeau et couronne, collerettes, ailes de chauve-souris à doigts),
   capybara (tonneau, tête carrée dans le prolongement du dos, nez sombre, petites oreilles rondes) ; dauphin et
   capybara sont « d'un seul tenant » (merged) : la tête se fond dans le corps, les stades gardent la même échelle.
   Rig (classes, cf. docs/ARCHITECTURE.md) :
     racine  svg.m-root.c-rig.sp-<type>[data-species][data-expr]
     .c-shadow (ombre au sol, hors du corps) · .c-all (tout le corps : sauts)
     .m-tail (pivot à la base) > .c-tail-tip (bout, traîne) · .m-legB / .m-legF > 2 × .c-leg (dauphin : nageoires)
     .m-body (torse, respiration) · .c-wings (dragon) · .c-head (pivot au cou) > .m-ear.c-ear-l / .c-ear-r (gauche /
     droite À L'ÉCRAN), .c-mane, .c-face > .c-cheek, .c-eyes > .c-eye > .c-pupil + .m-lid, .c-x.x-<expression>
     (yeux et bouche propres à l'expression, bouche dans .m-mouth ; .x-sad = visage de l'humeur triste), .c-nose ·
     accessoires .c-acc.acc-<id> · .c-zz (deux « z » du sommeil) · .c-glint (éclat du champion) · .c-wave (nageurs :
     dauphin, baleine — MOUNTS[type].water) · v2.5 : .c-tongue (langue du chien, montrée par la CSS quand il est
     joyeux), jet d'eau de la baleine ; oiseaux : bec en deux pièces (mandibule dans la tête, bec supérieur = .c-nose,
     dessiné après les calques d'expression : la bouche s'ouvre entre les deux).
   Les pivots de .c-head et .m-tail sont posés en ligne (transform-origin en % de la boîte de remplissage, rendue
   stable par un cadre invisible .c-pv) ; les animations sont dans css/ui/mount.css (chargé une seule fois).
   mountAnchors(type, opts) → points d'ancrage au repos (bouche, yeux, sommet de tête, cou, dos, queue…) dans les
   unités du viewBox, pour poser un objet sur le compagnon (carotte, miettes, cœurs). Aucun id dans le SVG :
   plusieurs compagnons peuvent cohabiter sur une page ; même entrée → même chaîne. */

import { MOUNTS, SHOP } from '../content/companion-data.js';
import { loadCSS } from '../core/util.js';

export const EXPRESSIONS = Object.freeze(['neutral', 'happy', 'delighted', 'proud', 'surprised', 'sleepy', 'hungry', 'focused']);
export const MOODS = Object.freeze(['walk', 'joy', 'sad', 'dance', 'sleep', 'eat', 'hop', 'wiggle']);

let cssPromise = null;
/* charge css/ui/mount.css une seule fois (résolu depuis ce module : marche aussi sous un sous-chemin GitHub Pages et
   dans les bancs d'essai) ; déjà présent dans la page → rien à faire. → Promise<boolean> */
export function ensureMountCSS() {
  if (cssPromise) return cssPromise;
  const d = globalThis.document;
  if (!d) return Promise.resolve(false);
  try {
    if (d.querySelector('link[href$="css/ui/mount.css"]')) return (cssPromise = Promise.resolve(true));
    cssPromise = loadCSS(new URL('../../css/ui/mount.css', import.meta.url).href);
  } catch (_) { cssPromise = Promise.resolve(false); }
  return cssPromise;
}

/* ---------- constantes de style ---------- */
const INK = '#4a2c1a';          /* contour brun chaud */
const EYE = '#2b1810';          /* yeux */
const MOUTH = '#8c3b30';        /* intérieur de bouche */
const TONGUE = '#ff8fa3';
const BLUSH = '#ff8fa0';
const GOLD = '#f6c344', GOLD_D = '#d99a1e', GOLD_L = '#fff0b3';
const SW = 2.3;                 /* contour principal (unités du viewBox) */
const GROUND = 72.9;            /* bas géométrique des pieds : avec le contour, le dessin touche y ≈ 74 */

/* couleurs du dessin : robe / crins / ventre + détails (MOUNTS[type].look, js/content/companion-data.js),
   avec des valeurs de repli calculées si un champ manque */
function colors(M) {
  const c = { ...M, ...(M.look || {}) };
  c.body = c.body || '#c8863f'; c.mane = c.mane || dark(c.body, 0.35); c.belly = c.belly || mix(c.body, '#ffffff', 0.55);
  c.inner = c.inner || mix(c.body, '#ff9fb0', 0.45);
  c.hoof = c.hoof || dark(c.mane, 0.3);
  c.mane2 = c.mane2 || c.mane; c.mane3 = c.mane3 || c.mane2;
  c.blaze = c.blaze || '#fffaf0'; c.nose = c.nose || dark(c.body, 0.6); c.wave = c.wave || '#bfe6ff';
  c.spike = c.spike || c.mane; c.wing = c.wing || mix(c.body, '#ffffff', 0.3); c.horn = c.horn || '#fff3d6';
  c.muzzle = c.muzzle || mix(c.body, c.belly, 0.4); c.fin = c.fin || dark(c.body, 0.1); c.frill = c.frill || c.wing;
  return c;
}

/* nombre à une décimale, sans zéro initial (« .5 ») : SVG plus léger */
const r1 = v => String(Math.round(v * 10) / 10).replace(/^(-?)0\./, '$1.');
const pts = a => a.map(r1).join(',');
/* éléments SVG en chaîne (attributs déjà formatés) */
const P = (d, fill, x = '') => `<path d="${d}" fill="${fill}"${x}/>`;
const E = (cx, cy, rx, ry, fill, x = '') => `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${fill}"${x}/>`;
const C = (cx, cy, r, fill, x = '') => `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${fill}"${x}/>`;
const G = (cls, inner, x = '') => `<g class="${cls}"${x}>${inner}</g>`;
/* la racine porte stroke=INK et stroke-width=0 : un élément sans attribut de trait n'a pas de contour */
const st = (w, c = INK) => (c === INK ? '' : ` stroke="${c}"`) + ` stroke-width="${w}"`;
const LINE = (d, w, c = INK, x = '') => `<path d="${d}" fill="none"${st(w, c)}${x}/>`;
const OUT = st(SW);             /* attributs de contour principal */
const op = v => ` opacity="${v}"`;
/* reflet : ellipse blanche translucide (rotation ignorée sous 10° : invisible à cette taille, SVG plus léger) */
const HL = (cx, cy, rx, ry, rot = 0) => E(cx, cy, rx, ry, '#fff', op('.45') + (Math.abs(rot) >= 10 ? ` transform="rotate(${rot} ${r1(cx)} ${r1(cy)})"` : ''));

/* mélange de couleurs #rrggbb (k = part de b) */
function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}
const dark = (c, k = 0.16) => mix(c, '#3a2010', k);

/* origine de transformation (fill-box) d'un groupe muni d'un cadre invisible [x, y, w, h] */
const pv = (f, x, y) => ` style="transform-origin:${r1((x - f[0]) / f[2] * 100)}% ${r1((y - f[1]) / f[3] * 100)}%"`;
const FRAME = f => `<rect class="c-pv" x="${f[0]}" y="${f[1]}" width="${f[2]}" height="${f[3]}" fill="none"/>`;

/* patte générique : un seul contour (paint-order stroke : le trait est à l'extérieur, les couleurs du pied tombent
   pile dedans), sabot / chaussette / pied coloré ; far = patte du fond (ombrée, sans détails) */
const PO = ` stroke-width="${SW * 2}" paint-order="stroke"`;
function leg(x, top, w, c, far, foot) {
  const g = GROUND - SW / 2, coat = far ? c.shade || dark(c.body, 0.2) : c.body;
  const X = r1(x), W = r1(x + w), T = r1(top), Y = r1(g);
  const sh = (col, k) => (far ? dark(col, k) : col);
  let s;
  if (foot === 'hoof') {
    s = P(`M${X},${T}V${r1(g - 1.8)}Q${X},${Y} ${r1(x + 1.8)},${Y}H${r1(x + w - 1.8)}Q${W},${Y} ${W},${r1(g - 1.8)}V${T}Z`, coat, PO);
    if (c.sock) s += P(`M${X},${r1(g - 8.4)}H${W}V${r1(g - 3.4)}H${X}Z`, sh(c.sock, 0.1));
    s += P(`M${X},${r1(g - 3.4)}H${W}V${r1(g - 1.8)}Q${W},${Y} ${r1(x + w - 1.8)},${Y}H${r1(x + 1.8)}Q${X},${Y} ${X},${r1(g - 1.8)}Z`, sh(c.hoof, 0.1), st(1.1));
  } else {
    const tx = r1(x + w + 1.5);
    s = P(`M${X},${T}V${r1(g - 2.2)}Q${X},${Y} ${r1(x + 2.2)},${Y}H${r1(x + w + 0.6)}Q${tx},${Y} ${tx},${r1(g - 1.8)}Q${tx},${r1(g - 3.6)} ${W},${r1(g - 3.8)}V${T}Z`, coat, PO);
    if (c.paw) s += P(`M${X},${r1(g - 3.2)}H${W}V${r1(g - 3.8)}Q${tx},${r1(g - 3.6)} ${tx},${r1(g - 1.8)}Q${tx},${Y} ${r1(x + w + 0.6)},${Y}H${r1(x + 2.2)}Q${X},${Y} ${X},${r1(g - 2.2)}Z`, sh(c.paw, 0.08));
    if (!far && foot === 'claw') s += P(`M${r1(x + w + 0.4)},${Y}l1,1.3l.8,-1.3zM${r1(x + w - 1.8)},${Y}l1,1.3l.8,-1.3z`, c.horn || '#fff8e6', st(0.7));
    else if (!far) s += LINE(`M${r1(x + w - 1.2)},${r1(g - 2.6)}v2M${r1(x + w + 0.4)},${r1(g - 2.4)}v1.7`, 0.9);
  }
  return G('c-leg', s);
}
/* tube (queue fine) : contour puis aplat ; dash = anneaux */
const tube = (d, w, col, ring) => LINE(d, w + 2.4) + LINE(d, w, col) + (ring ? LINE(d, w, ring, ' stroke-dasharray="2.2 3.4" stroke-linecap="butt"') : '');

/* ================= ESPÈCES =================
   Chaque fonction reçoit les couleurs c et renvoie les pièces du dessin (stade junior) :
   tail {tip, base, base0, pivot, frame, tipO}, legsB / legsF [fond, devant], body, wings, head {earL, earR, maneB,
   base, maneF, extra, post (par-dessus l'accessoire de tête), earsOver (oreilles après la crinière)}, face {eyes
   [[x,y,k]…], lid, cheeks, nose, mouth [x,y,w,style], blush / blushO (joues)}, headPivot, headFrame, anchors (top,
   neck, back, tail, wings, chest : [x, y, rotation, échelle, angle du pan pour le cou]), hip / bx (stades), shadow,
   et en option : order (ordre de tail / legsB / legsF / body), front (premier plan, hors du corps), merged (tête
   fondue dans le corps). */

/* ----- poney / licorne (trapu, tête ronde, museau rond) ----- */
const PONY_BODY = 'M27.4,47.4C31,43.2 40,43 47.5,43.2C51,43.3 52.6,38.2 55.5,33L64.5,37C66.4,41.6 66.6,46.6 64.8,51C62.8,58.4 58,62.6 50,63C42,63.4 35,63.4 30.6,62.2C24.4,59.8 23.4,51.4 27.4,47.4Z';
const PONY_SNOUT = 'M70.4,31.6C66.2,30.6 65.2,35 65.4,37.6C65.8,42.4 69.6,44.2 75,44.2C80.6,44.2 84.6,41.2 84.6,37C84.6,32.6 80.6,29.8 75.4,29.8C73.4,29.8 71.8,30.4 70.4,31.6Z';
function ponyLike(c, uni) {
  const s = {};
  s.hip = 55; s.bx = 44;
  s.shadow = E(45, 74.2, 24, 2.8, INK, op('.16'));
  if (uni) {
    s.tail = {
      tip: P('M16.8,57.5C13,61.5 12.4,67 15,71.2C16.3,69.6 17.6,68.6 19.2,68.4C19.3,70.4 20.3,71.7 22,72.4C22.6,66.5 22.4,61 20.8,57Z', c.mane2, OUT)
        + P('M19.6,59.4C17.8,62.6 17.6,66.4 19.4,69.4C19.8,67.8 20.6,66.8 21.6,66.4C21.2,63.8 20.6,61.4 19.6,59.4Z', c.mane3, st(1.2)),
      base: P('M27.5,47.5C21,44.5 14.5,48 13.5,55.5C13,59.5 14.2,62.5 16.5,64.5C18,59.8 21,56.2 26.5,54.2Z', c.mane, OUT)
        + LINE('M24.2,49.6C19.8,49.8 17.2,52.8 16.6,57', 2, c.mane2)
    };
  } else {
    s.tail = {
      tip: P('M16.8,57.5C13,61.5 12.4,67 15,71.2C16.3,69.6 17.6,68.6 19.2,68.4C19.3,70.4 20.3,71.7 22,72.4C22.6,66.5 22.4,61 20.8,57Z', c.mane, OUT),
      base: P('M27.5,47.5C21,44.5 14.5,48 13.5,55.5C13,59.5 14.2,62.5 16.5,64.5C18,59.8 21,56.2 26.5,54.2Z', c.mane, OUT)
        + LINE('M24,49.5C19.5,50 17,53.2 16.6,57.5', 1.1, dark(c.mane, 0.3))
    };
  }
  s.tail.pivot = [27, 48]; s.tail.frame = [2, 38, 32, 40]; s.tail.tipO = '55% 0%';
  const L = (x, far) => leg(x + 1.2, 54, 5.0, c, far, 'hoof');
  s.legsB = [L(27.4, 1), L(33.4, 0)];
  s.legsF = [L(48.2, 1), L(54.4, 0)];
  s.body = P(PONY_BODY, c.body, OUT) + E(46.5, 58.8, 10, 2.8, c.belly) + HL(37, 46.4, 6, 1.6, -4);
  if (uni) s.body += P('M32,51.2l.9,2 2.2.2-1.7,1.4.5,2.1-1.9-1.1-1.9,1.1.5-2.1-1.7-1.4 2.2-.2z', '#f9a8d4', st(0.8));
  const earL = P('M54.6,23.5C52.6,18.4 53.4,13.6 56.2,10.6C60,12.6 62.4,16.8 61.6,22.4Z', c.body, OUT)
    + P('M56.6,21C55.7,17.6 56,15.2 57.1,13.7C58.8,15.2 59.7,17.4 59.6,20.4Z', c.inner);
  const earR = P('M64.4,21.6C64.6,16.6 66.6,12.6 69.8,10.4C72,13.6 72.2,17.6 71,22Z', c.body, OUT)
    + P('M66.4,20.2C66.7,17 67.8,14.8 69.3,13.4C70.3,15.6 70.3,18 69.6,20.4Z', c.inner);
  let maneB, maneF;
  if (uni) {
    maneB = P('M57.4,19.4C51.4,19.4 47.2,23.6 47.8,29C44.6,31.2 43.6,35.2 45.2,38.4C42.6,40.6 41.8,44.6 43.4,47.6C44.2,49 45.8,49.4 46.8,48.6C46,47.4 46.2,45.8 47.4,44.8C50.4,42.6 51.8,39.8 52,37.2C54.8,35 56.4,31.6 56.8,28.4Z', c.mane, OUT)
      + P('M57.8,22.8C54,23.2 51.6,26.2 51.8,29.6C49.6,31.6 48.8,34.8 49.8,37.6C48.2,39.4 47.8,42.2 49,44.6C49.6,45.6 50.8,45.8 51.4,45.2C50.8,44.2 51,43 51.8,42.2C53.6,40.6 54.4,38.6 54.4,36.6C56.4,34.6 57.4,32 57.8,29.4Z', c.mane2, OUT)
      + P('M58.6,26.6C56.4,27.4 55.2,29.6 55.4,32C54,33.6 53.6,36 54.4,38.2C53.4,39.6 53.4,41.6 54.4,43.2C55,44 56,44 56.4,43.4C55.9,42.6 56.1,41.6 56.8,41C58,39.6 58.4,37.8 58.2,36.2C59.6,34.4 60,32 59.8,29.8Z', c.mane3, OUT)
      + LINE('M51.6,24.8C49.6,27 49.6,30 50.2,32', 1, '#fff', op('.6'));
    maneF = P('M54.4,22.4C55.4,15 63.6,12.4 69.8,15.6C73.6,17.6 74.4,21.6 72.4,24.8C71.4,22.6 69.6,21.4 67.4,21.4C67.4,24 65.4,26.2 62.4,26.6C63.4,24.8 63.2,22.8 61.8,21.8C60,24.2 57.2,24.6 54.4,22.4Z', c.mane, OUT)
      + P('M57.6,20.6C59.6,17.4 63.6,16 67.4,17C64.6,17.8 62.4,19.6 61.6,22.2C60.4,21.4 59,21 57.6,20.6Z', c.mane2)
      + P('M64.4,20.6C66.4,18.8 69.4,18.6 71.6,20.2C70.2,20.2 68.8,20.6 67.6,21.4C66.6,20.8 65.6,20.6 64.4,20.6Z', c.mane3)
      + LINE('M58.8,17.6C61,15.8 63.6,15.2 66.2,15.4', 1, '#fff', op('.6'));
  } else {
    maneB = P('M57,20.5C52,21 48.8,25 49.6,29.6C47,31 45.8,34.6 47,37.6C45,39 44.6,42 46,44C49.6,44.4 52.6,41.4 53.6,38C55,34 56.6,30.4 58.6,27Z', c.mane, OUT)
      + LINE('M52.6,26.4C51,28.6 50.6,31 51.2,33.2', 1, dark(c.mane, 0.3));
    maneF = P('M55,22C56.5,15.5 64,13.2 69.6,16.4C72.8,18.2 73.2,21.6 71.2,24C70.4,21.8 68.6,20.4 66.2,20.4C65.8,22.6 63.6,24.4 61,24.6C61.8,23 61.6,21.4 60.4,20.6C58.6,22.4 56.6,23 55,22Z', c.mane, OUT)
      + LINE('M60.4,17.4C62.6,16.2 65.4,16 67.6,16.8', 1, '#fff', op('.35'));
  }
  const base = C(63.5, 29.5, 12.6, c.body, OUT) + P(PONY_SNOUT, c.belly) + LINE('M68.2,41.6C70.2,43.6 72.4,44.2 75,44.2C80.6,44.2 84.6,41.2 84.6,37C84.6,32.6 80.6,29.8 76.2,29.8', SW)
    + HL(73, 32.4, 3, 1.2, -6);
  s.head = { earL, earR, maneB, base, maneF, extra: '' };
  if (uni) {
    s.head.extra = P('M62.6,17.2L67.4,1.2L68.6,17.6Z', GOLD, st(1.6))
      + LINE('M63.6,14L68.1,12.4M64.6,10.4L68,9.2M65.6,6.8L67.8,6', 1, GOLD_D)
      + G('c-spark', P('M75.4,8.4l.7,1.8 1.8.7-1.8.7-.7,1.8-.7-1.8-1.8-.7 1.8-.7z', '#fff', st(0.8, '#e7a6c9')));
  }
  s.face = {
    eyes: [[59.4, 28.6, 1], [68.4, 28, 0.9]], lid: c.body,
    cheeks: [[56, 33.6, 1], [64.2, 32.4, 0.72]],
    nose: E(78.6, 35.4, 1, 1.35, dark(c.belly, 0.72), ' transform="rotate(18 78.6 35.4)"') + E(82.8, 35.2, 0.85, 1.15, dark(c.belly, 0.72), ' transform="rotate(14 82.8 35.2)"'),
    mouth: [78, 40.2, 5.4, 's']
  };
  s.headPivot = [58.5, 40]; s.headFrame = [36, -14, 66, 72];
  s.anchors = {
    top: [63.2, 18.4, -6, 0.7], neck: [61, 44.4, 12, 1], back: [40, 43.4, -3, 1], tail: [23.6, 48.6, -28, 0.95],
    wings: [43, 44.5, 0, 1], chest: [59.6, 52.4]
  };
  return s;
}

/* ----- cheval (élancé, tête allongée, liste blanche, bai aux crins noirs) ----- */
function horse(c) {
  const s = {};
  s.hip = 50; s.bx = 43;
  s.shadow = E(44, 74.2, 24, 2.7, INK, op('.16'));
  s.tail = {
    tip: P('M14.4,53C10.6,58.6 10.2,65 12.2,70.6C13.8,68.6 15.2,67.6 16.6,67.6C17,69.6 18.2,71 19.8,71.8C20.2,64.6 19.6,58 18,52.4Z', c.mane, OUT),
    base: P('M26,40.5C19.5,38.5 13.8,43 12.6,51C12,56 12.8,60 14.6,63C16.4,57 19.4,52 25,48.6Z', c.mane, OUT)
      + LINE('M22.6,43C17.8,44 15.4,48 15,53', 1.1, '#5a3a28'),
    pivot: [25.6, 41], frame: [0, 32, 34, 46], tipO: '55% 0%'
  };
  const L = (x, far) => leg(x + 1.2, 49, 4.2, c, far, 'hoof');
  s.legsB = [L(26.4, 1), L(32, 0)];
  s.legsF = [L(47.6, 1), L(53.4, 0)];
  s.body = P('M25,40.5C29,36.2 38,35.6 46,36C50,36.2 52,29.6 55.4,23.6L63.4,27.6C65,33.4 64.8,39.6 62.4,45C60,53 55,57.8 47,58C39,58.2 32,58.2 27.6,56.8C21.4,54 21,45 25,40.5Z', c.body, OUT)
    + HL(36, 39.4, 6, 1.5, -4);
  const earL = P('M56,12.4C54.4,7.4 55.2,3 58,.4C61.2,2.8 62.8,7 62,11.6Z', c.body, OUT)
    + P('M57.8,10.6C57,7.6 57.4,5 58.4,3.6C59.9,5.2 60.6,7.4 60.4,10.2Z', c.inner);
  const earR = P('M64.4,9.6C65,5 67,1.8 70,.2C71.8,3.2 71.8,7 70.6,10.4Z', c.body, OUT)
    + P('M66.2,8.6C66.6,5.6 67.8,3.6 69.2,2.6C70,4.6 70,6.8 69.4,8.8Z', c.inner);
  const maneB = P('M58.4,13.6C51.2,14 47.4,19.6 47.4,25.6C46.2,29.6 44.2,33.4 41.6,37.8C45.6,38.4 48.2,37.2 50,35C50.4,37.4 52,38.6 54,38.8C54,35.6 55,32.8 56.8,30.2C57.6,32.4 59.2,33.6 61,33.6C60,29.6 60.2,25.6 61.6,22Z', c.mane, OUT)
    + LINE('M53.4,20C51.6,23.4 51.2,27.6 52,31', 1, '#5a3a28');
  const base = P('M56,20.4C54.4,13.2 58.8,8.2 64.6,8C69.6,7.8 73,10.4 74.8,13.8C76.8,17.4 79.6,19.6 82.8,21.4C86.8,23.6 88.4,27.6 86.8,30.8C85.2,34 80.6,34.8 76.8,33.8C73.6,33 71.2,31.4 68.4,31C63.8,30.4 57.8,27.6 56,20.4Z', c.body, OUT)
    + P('M64.2,11.6C65.8,10.8 67.6,11.2 68.2,12.8L72.6,23.4C73.2,25 72.2,26.2 70.8,25.8C69.8,25.6 69.2,24.8 68.8,23.8L64,13.8C63.6,12.8 63.6,12 64.2,11.6Z', c.blaze)
    + P('M74.6,30.6C74.2,25.6 77.6,21.8 82.4,21.2C86.4,22.8 88.6,27.2 86.8,30.8C85.2,34 80.6,34.8 76.8,33.8C75.6,33.2 74.8,32 74.6,30.6Z', c.belly, OUT)
    + HL(80.6, 24.2, 2.6, 1, 20);
  const maneF = P('M59.4,10.8C61.4,6.4 67.4,5.8 70.4,9.2C68.4,9.6 67,10.8 66.2,12.8C65.2,11.4 63.6,10.8 61.8,11.2C62,10.8 61,10.6 59.4,10.8Z', c.mane, OUT);
  s.head = { earL, earR, maneB, base, maneF, extra: '' };
  s.face = {
    eyes: [[61, 17.4, 0.92], [72, 16.4, 0.8]], lid: c.body,
    cheeks: [[59, 23.4, 0.9], [72.6, 22.6, 0.65]],
    nose: E(82.8, 25.6, 0.9, 1.25, dark(c.belly, 0.6), ' transform="rotate(28 82.8 25.6)"') + E(86, 27, 0.75, 1.05, dark(c.belly, 0.6), ' transform="rotate(28 86 27)"'),
    mouth: [81.4, 31.2, 4.6, 's']
  };
  s.headPivot = [58, 30]; s.headFrame = [34, -22, 70, 64];
  s.anchors = {
    top: [64.4, 10.6, -10, 0.68], neck: [61.4, 41.4, 22, 0.95], back: [39, 36.4, -3, 1], tail: [22.4, 41.6, -30, 0.95],
    wings: [42, 37.6, 0, 1], chest: [58, 45]
  };
  return s;
}

/* ----- chat (tigré, queue relevée et recourbée) ----- */
const CAT_BODY = 'M28,48.6C32,44.6 42,44 50,44.4C56,44.6 62,46.2 63.6,51.4C65,56.6 62.8,61.4 56.8,62.6C49,64 36,64 30.2,62.8C24.6,61.4 23.6,52.8 28,48.6Z';
function cat(c) {
  const s = {};
  s.hip = 55; s.bx = 44;
  s.shadow = E(45, 74.2, 23, 2.7, INK, op('.16'));
  const tb = 'M28.4,52.6C21,53 15.6,49 15.8,41.4';
  const tt = 'M15.8,41.8C15.8,35.4 18.8,31.4 22.6,32.2C25.2,32.8 25.6,36 23.4,37';
  s.tail = {
    base0: LINE(tb, 7.6),
    tip: tube(tt, 5.2, c.body, c.mane),
    base: LINE(tb, 5.2, c.body) + LINE('M24.8,52.9C20.6,52.6 17.6,50.4 16.4,46.4', 5.2, c.mane, ' stroke-dasharray="2.2 3.6" stroke-linecap="butt"'),
    pivot: [28.4, 52.6], frame: [6, 24, 26, 34], tipO: '40% 100%'
  };
  const L = (x, far) => leg(x + 1.2, 55, 4.4, c, far, 'paw');
  s.legsB = [L(29.4, 1), L(34, 0)];
  s.legsF = [L(50.6, 1), L(55.4, 0)];
  const stripe = x => P(`M${pts([x + 0.6, 44.9])}C${pts([x + 2, 47.2])} ${pts([x + 1.6, 50.2])} ${pts([x - 0.2, 52.4])}C${pts([x - 0.4, 50])} ${pts([x - 0.2, 47.2])} ${pts([x - 1.2, 45])}Z`, c.mane);
  s.body = P(CAT_BODY, c.body, OUT) + E(46, 59.4, 10.6, 2.7, c.belly) + stripe(35.4) + stripe(41.6) + stripe(47.8)
    + HL(38.6, 47.4, 4.4, 1.2, -4);
  const earL = P('M52.4,28.4L52.6,15.6C52.7,14.2 54,13.6 55,14.4L63.2,21.8Z', c.body, OUT)
    + P('M54.6,25.4L54.8,18.2L60.4,23Z', c.inner);
  const earR = P('M66.4,20.8L74.2,14.6C75.2,13.8 76.4,14.4 76.4,15.6L76.6,28Z', c.body, OUT)
    + P('M69,21.8L74.2,17.8L74.4,25.2Z', c.inner);
  const base = P('M51,33.4C50.4,24.4 57,19 65,19C73,19 79.4,24.8 79.2,33C79.2,35.4 78.6,37.4 77.6,39.2C79.2,40.4 79.2,42 77.8,42.6C76,43.4 73.6,45.8 65.4,45.8C57.6,45.8 54.4,43.8 52.6,42.6C51.2,42 51.2,40.4 52.6,39.4C51.6,37.6 51,35.6 51,33.4Z', c.body, OUT)
    + LINE('M61.2,20.8L62,24.4M65.2,20.2L65.2,24M69.2,20.8L68.4,24.4', 1.7, c.mane)
    + E(69.6, 39.8, 6, 3.6, c.belly)
    + HL(57.6, 25, 2.6, 1.3, -40);
  s.head = { earL, earR, maneB: '', base, maneF: '', extra: '' };
  s.face = {
    eyes: [[60.2, 32.2, 1], [71, 31.8, 0.94]], lid: c.body,
    cheeks: [[56.4, 37.6, 1], [75.6, 37.2, 0.85]],
    nose: P('M67.8,36.4L71.4,36.4C71.6,36.4 71.7,36.7 71.5,36.9L69.9,38.7C69.7,38.9 69.5,38.9 69.3,38.7L67.7,36.9C67.5,36.7 67.6,36.4 67.8,36.4Z', TONGUE, st(1))
      + LINE('M74.4,38L81.4,36.4M74.8,40L81.8,40.6M64.6,38.2L58.6,37M64.6,40.2L58.8,40.8', 0.8, INK, op('.75')),
    mouth: [69.6, 39.4, 5, 'c']
  };
  s.headPivot = [60, 44]; s.headFrame = [38, -10, 62, 70];
  s.anchors = {
    top: [65, 18.8, -8, 0.9], neck: [60, 46.6, 6, 0.95], back: [41, 45, -2, 0.96], tail: [17.6, 47, 60, 0.85],
    wings: [43, 46.4, 0, 0.95], chest: [58.6, 53.6]
  };
  return s;
}

/* ----- lion (crinière ronde festonnée, houppe au bout de la queue) ----- */
function lion(c) {
  const s = cat(c);
  const tb = 'M28.2,53.4C21,54.4 16.8,58.6 16.4,64';
  const tt = 'M16.4,63.6C16.2,66.6 17,68.4 18.8,68.8';
  s.tail = {
    base0: LINE(tb, 5.8),
    tip: tube(tt, 3.4, c.body) + P('M18.4,66.2C22,64.8 24.6,67.2 23.6,70.4C22.8,72.8 19.4,73.6 17.4,71.8C15.8,70.2 16.4,67.2 18.4,66.2Z', c.mane, OUT),
    base: LINE(tb, 3.4, c.body),
    pivot: [28.2, 53.4], frame: [8, 44, 24, 34], tipO: '20% 0%'
  };
  const L = (x, far) => leg(x + 1.2, 55, 5.6, c, far, 'paw');
  s.legsB = [L(28.6, 1), L(33.6, 0)];
  s.legsF = [L(50, 1), L(55, 0)];
  s.body = P('M27,48.2C31,43.6 42,43 50.4,43.4C57,43.6 62.8,45.4 64.4,51C65.8,56.6 63.4,61.6 57.2,62.8C49,64.2 36,64.2 30,62.8C24,61.2 22.6,52.6 27,48.2Z', c.body, OUT)
    + E(46, 59.6, 10.6, 2.6, c.belly) + HL(37.6, 46.8, 5, 1.3, -4);
  /* crinière : festons de tailles variées (pas une fleur), deux mèches qui débordent sur le poitrail */
  let d = '';
  const cx = 64.6, cy = 31.6, N = 13, RR = [16.2, 15, 16.8, 15.4, 16.4, 15, 17, 15.6, 16, 15.2, 16.8, 15.4, 16.2];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2 + 0.1, R = RR[i % N];
    const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a), ra = i % 3 === 1 ? 5.4 : i % 3 === 2 ? 4.2 : 4.8;
    d += i ? `A${ra},${ra} 0 0 1 ${pts([x, y])}` : `M${pts([x, y])}`;
  }
  const maneB = P('M56.4,42.6C54.6,46.6 55.2,50.6 57.8,53.6C58.4,50.8 59.8,48.6 61.8,47.2ZM63.4,45.6C62.4,49.6 63.6,52.8 66.2,55C66.4,52 67.6,49.6 69.6,48Z', c.mane, OUT)
    + P(d + 'Z', c.mane, OUT) + C(cx, cy, 12.6, mix(c.mane, c.body, 0.35))
    + LINE('M51.4,24.6C50.6,26.6 50.4,28.6 50.8,30.6M77.8,24.2C78.8,26 79.2,28 79,30.2M60.8,46C62.6,46.8 65,46.8 67,46', 1, dark(c.mane, 0.3), op('.55'));
  /* oreilles dessinées APRÈS la crinière (sinon elle les cache), sur son bord haut */
  const earL = C(55.2, 20.2, 3.9, c.body, OUT) + C(55.4, 20.6, 2, c.inner);
  const earR = C(73.8, 19.6, 3.7, c.body, OUT) + C(73.6, 20, 1.9, c.inner);
  const base = P('M52.6,32.6C52.4,25 58,20.8 64.8,20.8C71.6,20.8 77,25.6 76.8,32.4C76.6,39.4 71.6,43.8 64.8,43.8C58,43.8 52.8,39.6 52.6,32.6Z', c.body, OUT)
    + P('M63.6,37.6C63.6,34.6 66.6,33.6 69.6,33.6C72.6,33.6 75.4,34.8 75.4,37.6C75.4,40.6 72.6,42.2 69.6,42.2C66.6,42.2 63.6,40.6 63.6,37.6Z', c.belly)
    + HL(58.4, 25.6, 2.6, 1.2, -40);
  s.head = { earL, earR, maneB, base, maneF: '', extra: '', earsOver: true };
  s.face = {
    eyes: [[60.4, 30.4, 0.95], [70.8, 30, 0.9]], lid: c.body,
    cheeks: [[57, 35.6, 0.95], [75.2, 35.2, 0.75]],
    nose: P('M67.2,34.4C67.2,33.4 72.2,33.4 72.2,34.4C72.2,35.6 70.4,37 69.7,37C69,37 67.2,35.6 67.2,34.4Z', c.nose, st(1)),
    mouth: [69.7, 37.8, 5, 'c']
  };
  s.anchors = {
    top: [64.4, 15, -6, 0.8], neck: [60.6, 47, 6, 1], back: [41, 44.4, -2, 0.96], tail: [21.8, 56.4, 40, 0.85],
    wings: [43, 46, 0, 0.95], chest: [58.6, 53.6]
  };
  return s;
}

/* touffe de poil hirsute sur un contour : (x, y) = point du contour, a = direction vers l'extérieur (degrés, 0 = droite,
   -90 = haut) ; un triangle couleur robe masque le trait du contour, ses deux bords extérieurs sont cernés */
function tuft(x, y, a, col, k = 1) {
  const r = a * Math.PI / 180, ux = Math.cos(r), uy = Math.sin(r), vx = -uy, vy = ux;
  const p = (u, v) => [x + ux * u * k + vx * v * k, y + uy * u * k + vy * v * k];
  return P(`M${pts(p(-1.7, 1.9))}L${pts(p(1.2, 1.5))}L${pts(p(2.1, -0.5))}L${pts(p(1.2, -1.5))}L${pts(p(-1.7, -1.9))}Z`, col)
    + LINE(`M${pts(p(0, 1.6))}L${pts(p(2.1, -0.5))}L${pts(p(0, -1.6))}`, SW);
}
/* applique une transformation affine aux paires « x,y » d'un chemin écrit en commandes absolues (M L C Q Z) */
const mapPath = (d, f) => d.replace(/(-?[\d.]+),(-?[\d.]+)/g, (_, x, y) => pts(f(+x, +y)));
const affine = (ox, oy, k, deg) => {
  const a = deg * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
  return (x, y) => [ox + k * (x * co - y * si), oy + k * (x * si + y * co)];
};

/* ----- capybara (corps en tonneau, grosse tête carrée au museau très haut, petites oreilles rondes, nez noir) ----- */
function capy(c) {
  const s = {};
  s.hip = 60; s.bx = 44; s.merged = true;
  s.shadow = E(46, 74.2, 26.5, 2.8, INK, op('.16'));
  s.tail = { tip: '', base: '', pivot: [22, 50], frame: [2, 36, 34, 40], tipO: '50% 0%' };
  const L = (x, far) => leg(x + 1.2, 59, 6, c, far, 'paw');
  s.legsB = [L(25.6, 1), L(31, 0)];
  s.legsF = [L(49.6, 1), L(55, 0)];
  s.body = P('M21.4,47.6C21,38.4 26.6,32.6 34.6,32.6C42.6,32.6 50.4,34.4 56,36.8C62,39.2 66.6,45 66.4,52C66.2,57.4 63.6,61.2 59.6,63.6C52.6,67.4 36,67.8 27.6,65.2C21.6,63 21,55.4 21.4,47.6Z', c.body, OUT)
    + E(45, 63.6, 12.6, 3, c.belly)
    + LINE('M29.6,46.6l1.4,1.8M35.6,43.4l1.2,2M41.8,42.4l1,2.1M47.8,42.8l.8,2.1', 1, dark(c.body, 0.3), op('.6'))
    + tuft(24.6, 37.6, -130, c.body) + tuft(32, 33.2, -100, c.body) + tuft(21.4, 49, -175, c.body, 0.8) + tuft(44, 34, -84, c.body, 0.8)
    + HL(34.6, 37, 6.4, 1.6, -4);
  const earL = E(60.8, 34, 2.3, 2.7, c.body, OUT) + E(60.9, 34.3, 1.1, 1.4, c.inner);
  const earR = E(66.6, 33.2, 2.2, 2.6, c.body, OUT) + E(66.7, 33.5, 1, 1.3, c.inner);
  const HEAD = 'M51.4,35.1Q53.8,35.8 56,36.8C58,34.2 61.4,32.8 66.4,32.8L83.6,32.8C88.6,32.8 91.2,35.4 91.2,39.8L91.4,46.2C91.4,50.6 89,53.2 84.4,53.4C78.4,53.8 71.4,53.6 66.4,52';
  const base = P(HEAD + 'L58.6,47.6Z', c.body)
    + P('M81.4,32.8L83.6,32.8C88.6,32.8 91.2,35.4 91.2,39.8L91.4,46.2C91.4,50.6 89,53.2 84.4,53.4L82.4,53.5C80,46.8 79.6,39.4 81.4,32.8Z', c.muzzle)
    + LINE(HEAD, SW) + tuft(68.4, 52.6, 100, c.body, 0.9)
    + HL(70, 35.2, 4.4, 1.1, -2);
  s.head = { earL, earR, maneB: '', base, maneF: '', extra: '' };
  s.face = {
    eyes: [[70.8, 38.4, 0.76], [79.4, 38, 0.7]], lid: c.body, sleepy: 0.34,
    cheeks: [[68.2, 43.8, 0.95], [78.8, 43.4, 0.78]],
    nose: P('M83.2,35.8C83.4,34.3 84.6,33.6 86.4,33.6L88.8,33.6C90.4,33.6 91.2,34.6 91.2,36.2L91,38C90.8,39.4 89.6,40.2 87.8,40.2L86.2,40.2C84.4,40.2 83.2,39.2 83.2,37.6Z', c.nose, st(1))
      + P('M84.6,38.4C85,37.2 85.9,36.6 86.8,36.8C86.6,37.7 85.8,38.4 84.6,38.4ZM89.8,38.3C89.4,37.1 88.5,36.5 87.6,36.7C87.8,37.6 88.6,38.3 89.8,38.3Z', '#140b07') + E(86.2, 34.9, 1.4, 0.55, '#fff', op('.3'))
      + LINE('M87.1,40.2L87.1,43.6', 1.1),
    mouth: [87.1, 45.4, 4.6, 'c']
  };
  s.headPivot = [60.4, 47]; s.headFrame = [40, -10, 62, 66];
  s.anchors = {
    top: [78, 32.6, 0, 0.8], neck: [65.4, 52.4, 56, 1.25], back: [40.6, 35, -2, 1.05], tail: [21.8, 47.2, -55, 0.95],
    wings: [44, 37, 0, 1], chest: [62.4, 57]
  };
  s.mandarin = C(75.4, 29, 3.6, '#ffa33a', st(1.4)) + P('M75.6,25.6C77,24 79.4,24 80.4,25C79.2,26.4 77.2,26.6 75.6,25.6Z', '#5fbf6a', st(1)) + HL(74, 27.8, 1.2, 0.7, -30);
  return s;
}

/* ----- dauphin (front bombé, rostre court et arrondi, sourire, aileron courbé vers l'arrière, une nageoire couchée sur
   le flanc, caudale horizontale à deux lobes ; il nage : une vague au premier plan cache le bas du ventre) ----- */
function dolphin(c) {
  const s = {};
  s.hip = 50; s.bx = 54; s.merged = true;
  s.order = ['legsB', 'body', 'tail', 'legsF'];
  /* eau : surface derrière (ombre) et vague devant (premier plan, hors du corps : il saute hors de l'eau) */
  s.shadow = E(54, 73.6, 30, 2, c.wave, op('.9'));
  s.front = P('M17,68.6C19.6,68.2 21.6,66.6 23.4,64.8C25.8,62.6 29.2,62.4 31.6,64.2C33.8,65.8 36.4,65.8 38.6,64.2C41.6,61.8 45.6,61.6 48.4,64C50.6,65.8 53.4,65.8 55.6,64C58.6,61.4 62.8,61.4 65.6,64C67.8,66 70.6,66 72.8,64.2C75.6,62 79.4,62.2 81.6,64.8C83.2,66.6 85.4,68 88,68.6C90.4,69.2 91.2,71.2 90,72.6C82,75.4 26,75.4 18,72.6C16,71.6 15.4,69.4 17,68.6Z', c.wave, op('.96'))
    + LINE('M15.6,70.4C17,69 18.8,68.6 20.4,68C22,67.4 22.8,65.8 23.4,64.8C25.8,62.6 29.2,62.4 31.6,64.2C33.8,65.8 36.4,65.8 38.6,64.2C41.6,61.8 45.6,61.6 48.4,64C50.6,65.8 53.4,65.8 55.6,64C58.6,61.4 62.8,61.4 65.6,64C67.8,66 70.6,66 72.8,64.2C75.6,62 79.4,62.2 81.6,64.8C82.4,65.8 84,67.4 86.4,68C88.6,68.6 90.4,69.2 91.4,70.6', 1.6, '#5aa6cf')
    + LINE('M26.6,65.6C28.6,64.4 30.4,64.6 31.8,66M41.6,65.4C44,63.8 46.2,63.8 48,65.4M58.6,65.2C61,63.4 63.4,63.4 65.4,65.2M74.4,65.4C76.6,64 78.6,64.2 80,65.8', 1.2, '#fff', op('.95'))
    + C(20.6, 62.6, 1, '#fff', st(0.8, '#5aa6cf')) + C(87.6, 63.6, 1.3, '#fff', st(0.8, '#5aa6cf')) + C(84.6, 60.4, 0.8, '#fff', st(0.7, '#5aa6cf'));
  /* caudale (au-dessus du corps : elle masque le bout du pédoncule) */
  s.tail = {
    tip: P('M17.4,30.6C17.2,28.6 16.4,27 14.6,25.8C11.6,25.4 8.8,23.6 7.2,20.6C10.4,19.2 14.8,19.6 17.8,21.8L19.6,23.2L21.4,21.8C24.4,19.6 28.8,19.2 32,20.6C30.4,23.6 27.6,25.4 24.6,25.8C22.8,27 22,28.6 21.8,30.4Z', c.body)
      + LINE('M17.4,30.6C17.2,28.6 16.4,27 14.6,25.8C11.6,25.4 8.8,23.6 7.2,20.6C10.4,19.2 14.8,19.6 17.8,21.8L19.6,23.2L21.4,21.8C24.4,19.6 28.8,19.2 32,20.6C30.4,23.6 27.6,25.4 24.6,25.8C22.8,27 22,28.6 21.8,30.4', SW)
      + HL(12.6, 22.2, 2.4, 0.8, 20) + HL(26.6, 22, 2.4, 0.8, -20),
    base: '',
    pivot: [19.6, 30], frame: [2, 10, 36, 30], tipO: '50% 100%'
  };
  s.legsB = [G('c-leg', ''), G('c-leg', '')];
  const pf = [54, 44, 17, 13];
  s.legsF = [G('c-leg', FRAME(pf) + P('M68.8,48.2C66.2,51.6 62.2,54 57.6,54.8C56.4,55 56,54 56.8,53.4C59.8,51 62.6,48.6 65.6,47Z', c.fin, OUT), pv(pf, 67.4, 48)), G('c-leg', '')];
  const BODY = 'M62.4,30.6C56.6,32.4 49.6,36.8 43.4,40.6C37.6,44 31,43.6 26.6,40.2C22.4,37 19.4,33 17.4,28.4L21.8,28.2C23.4,33 26.4,38.4 31.4,44C36.4,49.6 42.6,57.4 50.4,61.6C58,65.4 67,61 72.6,53.6C76,49.6 74,38 70,33.4Z';
  s.body = P('M56.4,35.6C52.4,31.6 47.8,28.4 43.2,27.4C45.4,30.2 46.2,34.8 45.8,40.4Z', c.fin, OUT)
    + P(BODY, c.body)
    + P('M72.6,53.6C67,61 58,65.4 50.4,61.6C42.6,57.4 36.4,49.6 31.4,44C37.4,48.4 45.4,52.4 53.6,53.6C61,54.6 67.6,53.6 72.6,50.6Z', c.belly)
    + HL(50, 39.6, 6, 1.4, -26) + HL(30, 39.4, 2.4, 0.9, -40) + LINE(BODY, SW);
  const HEAD = 'M57.9,32.4Q60.2,31.4 62.4,30.6C66.4,28.8 70.4,21.8 77,21.8C84.4,21.8 89,26.6 89,32.8C89,34.6 88.6,35.8 87.8,37C90.4,37.4 93.8,38.4 94.8,40.6C95.6,42.6 93.8,44.6 90.6,44.8C87.2,45 84.6,47.6 81,49.8C78,51.6 75,53 72.6,53.6Q71.4,55.3 69.9,56.7';
  /* remplissage refermé au bord haut du ventre blanc (72.6, 50.6) : il ne déborde pas sur la gorge */
  const base = P(HEAD + 'L72.6,50.6Z', c.body)
    + P('M94.4,42.6C94,44 92.6,44.8 90.6,44.8C87.2,45 84.6,47.6 81,49.8C78,51.6 75,53 72.6,53.6L71,53.4L71.2,51.3C74.4,50.2 77.8,48.4 81.6,45.6C82.6,44.8 83.6,44 84.8,43.4C88,42.6 91.4,42.4 94.4,42.6Z', c.belly)
    + LINE(HEAD, SW) + LINE('M87.6,37.2C86.8,37.8 86.2,38.4 85.9,39.2', 1.1, INK, op('.45'))
    + HL(80, 25.6, 4.4, 1.4, 10) + HL(91.4, 39.2, 1.4, 0.6, 10);
  s.head = { earL: '', earR: '', maneB: '', base, maneF: '', extra: '' };
  s.face = {
    eyes: [[76.6, 35.4, 0.96], [85, 33.4, 0.78]], lid: c.body,
    cheeks: [[73.2, 41.4, 0.95], [86.2, 39.4, 0.66]],
    nose: LINE('M68.4,28C69.4,27.1 70.8,27.1 71.6,27.8', 1.1),
    mouth: [86.8, 42.6, 8, 'b']
  };
  s.headPivot = [68, 46]; s.headFrame = [50, 0, 52, 58];
  s.anchors = {
    top: [77.4, 21.8, 10, 0.86], neck: [70, 52.4, 67, 1.25, 50], back: [55, 34.6, -22, 0.9], tail: [21.4, 31.6, -70, 0.9],
    wings: [50, 38, 0, 0.92], chest: [68.6, 53.6]
  };
  return s;
}

/* ----- dragon (turquoise, museau arrondi à narines, petites cornes courbées vers l'arrière, crête, collerettes palmées,
   ailes de chauve-souris à trois doigts, ventre crème écaillé, queue en pointe de flèche) ----- */
/* aile de chauve-souris : épaule en (0, 0) dans le repère local, bras (bord d'attaque) jusqu'au poignet griffu, trois
   doigts, membrane festonnée ; posée en (ox, oy) à l'échelle k, tournée de deg */
function batWing(c, ox, oy, k, deg, far) {
  const f = affine(ox, oy, k, deg), m = d => mapPath(d, f);
  const mem = far ? dark(c.wing, 0.12) : c.wing, bone = far ? dark(c.body, 0.18) : c.body;
  return P(m('M0,0C-1.6,-7.6 -4.6,-14.6 -8.4,-20.6C-12.6,-21.4 -17.6,-20.6 -21.6,-17.6Q-17.8,-13.6 -19.6,-8.4Q-15.4,-5.8 -13,-1.2Q-8,-2.6 -3.4,1.8Z'), mem, OUT)
    + LINE(m('M-8.4,-20.6L-20.8,-17.8M-8.4,-20.6L-18.8,-8.6M-8.4,-20.6L-12.6,-1.8'), 1.1 * k, dark(mem, 0.3), op('.8'))
    + LINE(m('M-.6,-.6C-2.2,-7.6 -4.8,-14.2 -8.2,-19.8'), 2.2 * k, bone)
    + P(m('M-9.4,-20.4L-8.8,-23.6L-7.2,-20.6Z'), c.horn, st(0.8));
}
function dragon(c) {
  const s = {};
  s.hip = 55; s.bx = 44;
  s.shadow = E(45, 74.2, 24, 2.8, INK, op('.16'));
  s.tail = {
    tip: P('M16.8,63.4C13.6,62 10.2,61.6 7.4,62.6C6.8,64.6 7.2,67.4 9,69.8C10.8,71.8 13.2,72.2 14.6,71.6C14.4,69.4 14.8,67.2 16.4,66.2Z', c.spike, OUT)
      + LINE('M8.6,64.4C10.6,65.4 12.4,66.8 13.6,69.4', 0.9, dark(c.spike, 0.3), op('.6')),
    base: P('M29.4,52.4C23.4,53.4 18.4,56.6 15.4,62.2C14.8,63.6 15.6,65.2 17.2,65.2C20,61.6 24.4,59.6 30,59.4Z', c.body, OUT)
      + P('M23,54.4l-.6,-3.6 3.2,1.6zM18.2,58.2l-1.6,-3 3.4,.8z', c.spike, st(1)),
    pivot: [29.4, 55.6], frame: [2, 44, 32, 32], tipO: '75% 15%'
  };
  const L = (x, far) => leg(x + 1.2, 55, 5.4, c, far, 'claw');
  s.legsB = [L(29, 1), L(33.8, 0)];
  s.legsF = [L(50.6, 1), L(55.4, 0)];
  const fw = [18, 27, 28, 22], nw = [20, 20, 31, 30];
  s.wings = G('c-wing c-wing-far', FRAME(fw) + batWing(c, 43.4, 43.8, 0.8, -28, true), pv(fw, 43.4, 43.8))
    + G('c-wing c-wing-near', FRAME(nw) + batWing(c, 47.4, 44.6, 1, -12, false), pv(nw, 47.4, 44.6));
  const BODY = 'M27,48.4C30.6,44.2 39,43.6 46,43.8C50.4,43.9 52.6,40.4 54.8,36.6L64.6,38.4C66.4,42.6 66.4,47.4 64.6,51.4C62.4,58.6 57.6,62.6 50,63C42,63.4 35,63.4 30.6,62.2C24.4,59.8 22.8,52.2 27,48.4Z';
  s.body = P('M29.4,48l1.4,-4.6 3,3.6zM35.4,45l1.8,-4.8 2.8,4.4zM42,44.2l2,-4.6 2.6,4.4zM48.8,43l2.4,-4 1.8,4.6zM52.6,39.4l2.8,-3.4 1,4.8z', c.spike, st(1.4))
    + P(BODY, c.body)
    + P('M36,62.9C35,58.2 41,54.6 48,54.4C52.4,54.3 56.4,51 58.4,46.4C59.8,43 62.4,41 64.4,40.6C66.6,44.6 66.4,48.4 64.6,51.4C62.4,58.6 57.6,62.6 50,63C44,63.4 39,63.4 36,62.9Z', c.belly)
    + LINE('M40.6,58.4C45,57.2 52,57.2 57.6,58.8M39.6,61.2C45,60.2 53,60.2 59,61.4M58.8,53.6C60.6,54.2 62.6,55 64,56M61,48.6C62.6,49 64.2,49.6 65.4,50.4M62.6,43.8C63.8,44.2 65,44.8 65.8,45.4', 0.9, dark(c.belly, 0.25))
    + HL(38, 47.4, 4.6, 1.3, -4) + LINE(BODY, SW);
  /* collerettes palmées couchées vers l'arrière (à la place d'oreilles : elles frémissent comme des oreilles) */
  const frill = (x, y, k) => P(mapPath('M0,0C-2.4,-2.8 -5.6,-4.4 -8.6,-4.6Q-7.2,-2.6 -8.8,-.6Q-6.8,.6 -7.6,3Q-4.4,3 -1.4,3.4Z', (a, b) => [x + a * k, y + b * k]), c.frill, OUT)
    + LINE(mapPath('M-.6,.4L-7.6,-3.8M-.6,.6L-7.8,-.6M-.4,1.2L-6.6,2.6', (a, b) => [x + a * k, y + b * k]), 0.8 * k, dark(c.frill, 0.3), op('.75'));
  const earL = frill(55.4, 24.4, 0.72);
  const earR = frill(54.4, 31.6, 1.15);
  const HEAD = 'M52.2,30.4C51.6,22.4 57,17.2 63.4,17.2C68.4,17.2 72,19.8 73.4,23.2C76.8,23.4 80.6,24.2 83,25.8C86.2,27.8 87,31.6 85.2,34.6C83.4,37.4 79.4,38.4 75.2,38.2C72.6,38.6 70.4,39.8 67.8,40.2C59.4,40.8 52.8,37.4 52.2,30.4Z';
  const base = P(HEAD, c.body, OUT)
    + P('M84.8,35.2C83,37.4 79.2,38.4 75.2,38.2C72.6,38.6 70.4,39.8 67.8,40.2C69.4,38.2 72.4,36.6 76,36.2C79.4,35.8 82.4,35.6 84.8,35.2Z', c.belly)
    + HL(57.8, 21.6, 2.8, 1.3, -40) + HL(79.6, 26.2, 2.6, 0.8, 8);
  const horns = P('M55.4,21.6C54,18.4 52.6,16 50.6,13.6C54.4,14.2 57.8,16.4 60,19.4Z', c.horn, st(1.5))
    + P('M61.8,18.2C61,14.8 60.6,12 59.4,9.2C63.4,10.8 66.2,14.2 67,18.6Z', c.horn, st(1.5))
    + LINE('M53.4,17.6L55.2,16.8M61.6,13.6L63.4,13.4', 0.9, dark(c.horn, 0.3), op('.7'));
  s.head = { earL, earR, maneB: '', base, maneF: '', extra: '', post: horns };
  s.face = {
    eyes: [[60.4, 27.6, 1], [68.8, 26.8, 0.9]], lid: c.body, blush: '#ff7d92', blushO: '.75',
    cheeks: [[57.2, 33.2, 0.95], [67.6, 32.8, 0.78]],
    nose: E(81.2, 27.6, 0.95, 0.7, dark(c.body, 0.65), ' transform="rotate(20 81.2 27.6)"') + E(84.4, 29.4, 0.8, 0.62, dark(c.body, 0.65), ' transform="rotate(35 84.4 29.4)"'),
    mouth: [79.4, 33.6, 6.2, 'd']
  };
  s.headPivot = [59, 40]; s.headFrame = [36, -12, 64, 70];
  s.anchors = {
    top: [64, 18.4, -8, 0.82], neck: [60.4, 45.6, 8, 0.95], back: [41, 45, -2, 0.96], tail: [19.6, 59.4, -30, 0.9],
    wings: [46, 46, 0, 0.9], chest: [58.6, 53.6]
  };
  return s;
}

/* ===== v2.5 — TERRE : ours, koala, chien (zone de l'agent « terre ») =====
   Trois quadrupèdes « peluche » sur le gabarit du chat (tête ronde de trois quarts tournée vers la droite, pattes sur
   y = 74). Ours brun : tout rond, oreilles rondes sur le haut de la tête, museau clair en ovale, truffe sombre, queue
   pompon. Koala : gris, très grosse tête, grandes oreilles duveteuses (festons, blanc dedans), gros nez noir ovale,
   corps court et trapu au dessous blanc qui remonte au poitrail, une touffe en guise de queue, pieds gris foncé.
   Chien (chiot beagle / golden) : oreilles tombantes (le lobe .m-ear pend derrière la tête, pivot à la racine dans
   mount.css), liste et museau crème, truffe noire au bout du museau, tache sur le dos, queue relevée et effilée au bout
   blanc (elle remue : mount.css), langue qui pend quand il est content (groupe .c-tongue de la tête, display="none"
   sans CSS, montré par mount.css avec les expressions joyeuses, masqué quand il mange ou dort). */

/* cercle duveteux : n festons de rayon ra posés sur un cercle de rayon R (sens horaire : bosses vers l'extérieur) */
function fluff(cx, cy, R, n, ra, a0 = -90) {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + (i * 360) / n) * Math.PI) / 180;
    d += (i ? `A${r1(ra)},${r1(ra)} 0 0 1 ` : 'M') + pts([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
  }
  return d + 'Z';
}

/* bande effilée le long d'une courbe de Bézier cubique p (4 points), largeur w0 → w1, de t0 à t1 (n segments par
   côté), bout arrondi si cap : queues du chien */
function taper(p, w0, w1, t0, t1, n, cap) {
  const at = (t, d) => [0, 1].map(i => {
    const u = 1 - t;
    return d ? 3 * u * u * (p[1][i] - p[0][i]) + 6 * u * t * (p[2][i] - p[1][i]) + 3 * t * t * (p[3][i] - p[2][i])
      : u * u * u * p[0][i] + 3 * u * u * t * p[1][i] + 3 * u * t * t * p[2][i] + t * t * t * p[3][i];
  });
  const A = [], B = [];
  for (let k = 0; k <= n; k++) {
    const t = t0 + ((t1 - t0) * k) / n, [x, y] = at(t), [dx, dy] = at(t, 1), m = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * t) / 2;
    A.push([x - (dy / m) * w, y + (dx / m) * w]); B.push([x + (dy / m) * w, y - (dx / m) * w]);
  }
  const we = r1((w0 + (w1 - w0) * t1) / 2);
  return 'M' + A.map(pts).join('L') + (cap ? `A${we},${we} 0 0 0 ` : 'L') + B.reverse().map(pts).join('L') + 'Z';
}

/* ----- ours brun (en peluche : tout rond, oreilles rondes en haut de la tête, museau clair, queue pompon) ----- */
const BEAR_BODY = 'M25.8,51C25.2,43.2 31.6,39.4 39.6,39.4C47.4,39.4 54.6,40 58.8,41.8C64,44 66.8,48.6 66.4,53.8C66,59.2 62.4,63.2 56,63.8C48,64.4 37.6,64.4 31.4,63.6C26.6,62.8 26.2,57.4 25.8,51Z';
function bear(c) {
  const s = {};
  s.hip = 57; s.bx = 45;
  s.shadow = E(46, 74.2, 24.5, 2.8, INK, op('.16'));
  s.tail = {
    tip: C(25.2, 48.4, 3.5, c.body, OUT) + HL(24, 47, 1.3, 0.7, -30),
    base: '', pivot: [27.6, 49.4], frame: [12, 36, 22, 22], tipO: '80% 60%'
  };
  const L = (x, far) => leg(x + 1.2, 57, 6.2, c, far, 'paw');
  s.legsB = [L(27.4, 1), L(33, 0)];
  s.legsF = [L(50.6, 1), L(56.2, 0)];
  s.body = P(BEAR_BODY, c.body, OUT) + E(47, 59.6, 11.6, 3.2, c.belly) + HL(36, 44.2, 6, 1.6, -4);
  const earL = C(54.4, 21, 5, c.body, OUT) + C(54.6, 21.4, 2.8, c.inner);
  const earR = C(74.6, 20.6, 4.7, c.body, OUT) + C(74.4, 21, 2.6, c.inner);
  const base = P('M50.8,32.4C50.6,23.6 57,18.4 64.6,18.4C72.4,18.4 78.6,23.8 78.4,32C78.2,40.4 72.4,45.2 64.6,45.2C57,45.2 51,40.6 50.8,32.4Z', c.body, OUT)
    + E(70.4, 38.8, 6.8, 4.8, c.muzzle) + HL(57.8, 24.4, 2.8, 1.3, -40);
  s.head = { earL, earR, maneB: '', base, maneF: '', extra: '' };
  s.face = {
    eyes: [[59.8, 30.6, 1], [70.8, 30.2, 0.92]], lid: c.body,
    cheeks: [[56.2, 36.4, 1], [75.8, 34.8, 0.62]],
    nose: P('M67.6,35.6C67.6,34 73.6,34 73.6,35.6C73.6,37.2 71.4,38.6 70.6,38.6C69.8,38.6 67.6,37.2 67.6,35.6Z', c.nose, st(1))
      + E(69.4, 35.1, 1.1, 0.5, '#fff', op('.45')),
    mouth: [70.6, 39.8, 5, 'c']
  };
  s.headPivot = [60, 45.6]; s.headFrame = [36, -12, 64, 72];
  s.anchors = {
    top: [64.6, 18.8, -4, 0.92], neck: [60.4, 47.4, 6, 1], back: [42, 41, -2, 1], tail: [24.4, 47.4, -20, 0.8],
    wings: [44, 42.6, 0, 0.95], chest: [59.8, 55]
  };
  return s;
}

/* ----- koala (gris, grosse tête, grandes oreilles duveteuses, gros nez noir, trapu) ----- */
const KOALA_BODY = 'M30.6,51.4C30.2,43.8 35.2,40.2 41.6,40.2C48,40.2 53.8,41.2 57.8,43C62.6,45.2 65,49.6 64.6,54.6C64.2,59.8 60.6,63.4 55.2,63.8C48.6,64.4 40.6,64.4 35.4,63.6C31.4,62.8 30.8,57.4 30.6,51.4Z';
function koala(c) {
  const s = {};
  s.hip = 58; s.bx = 47;
  s.shadow = E(47.4, 74.2, 20.5, 2.8, INK, op('.16'));
  s.tail = {
    tip: P(fluff(30.8, 50.6, 2.3, 6, 1.5), c.body, OUT),
    base: '', pivot: [32.2, 51.2], frame: [17, 38, 22, 22], tipO: '80% 50%'
  };
  const L = (x, far) => leg(x + 1.2, 58, 6.4, c, far, 'paw');
  s.legsB = [L(31, 1), L(36.4, 0)];
  s.legsF = [L(49.4, 1), L(54.8, 0)];
  s.body = P(KOALA_BODY, c.body)
    + P('M35.4,63.2C40,59.6 48,58 55.4,56.4C59.6,55.6 62.2,52.4 63,47.6C64.8,49.8 65,52.6 64.6,55.2C64.2,59.8 60.6,63.4 55.2,63.8C48.6,64.4 40.6,64.4 35.4,63.2Z', c.belly)
    + HL(40, 44.8, 5, 1.5, -4) + LINE(KOALA_BODY, SW);
  const ear = (x, y, R, k) => P(fluff(x, y, R, 9, R * 0.42), c.body, OUT) + P(fluff(x + k, y + 0.4, R * 0.56, 7, R * 0.26), c.inner);
  /* oreille du fond un peu rentrée (trois quarts) : le portrait rond la garde presque entière */
  const earL = ear(50.2, 22.8, 6.9, -0.8);
  const earR = ear(78.6, 21.4, 6, 0.8);
  const base = P('M49.6,32.8C49.4,23.8 56.4,17.8 65.2,17.8C74,17.8 81,23.6 80.8,32.4C80.6,40.8 73.8,45.4 65.2,45.4C56.6,45.4 49.8,41.2 49.6,32.8Z', c.body, OUT)
    + HL(57.4, 23.6, 3, 1.4, -40);
  s.head = { earL, earR, maneB: '', base, maneF: '', extra: '' };
  s.face = {
    eyes: [[58.8, 30.8, 0.95], [75.8, 30.4, 0.86]], lid: c.body,
    cheeks: [[55.2, 37, 1], [77.2, 36.6, 0.72]],
    nose: P('M64.8,31.8C64.8,28.6 66.8,27.6 68.8,27.6C70.8,27.6 72.8,28.6 72.8,31.8C72.8,35.8 71.2,38.6 68.8,38.6C66.4,38.6 64.8,35.8 64.8,31.8Z', c.nose, st(1.2))
      + E(67, 30.4, 1.1, 1.7, '#fff', op('.4')),
    mouth: [68.8, 40.6, 4.4, 'c']
  };
  s.headPivot = [60.4, 46]; s.headFrame = [32, -12, 68, 72];
  s.anchors = {
    top: [65.2, 18, -2, 0.95], neck: [60.2, 47.8, 6, 1], back: [44, 42, -2, 0.94], tail: [30.2, 49.8, -20, 0.72],
    wings: [45.6, 43.4, 0, 0.9], chest: [59.6, 55.4]
  };
  return s;
}

/* ----- chien (chiot beagle / golden : oreilles tombantes, museau crème, truffe noire, queue au bout blanc) ----- */
const DOG_BODY = 'M27.2,49.2C30.8,44.8 40.6,44 48.8,44.2C55.6,44.4 61.8,46.2 63.6,51.4C65.2,56.6 62.8,61.4 56.8,62.6C48.8,64 36,64 30,62.8C24.4,61.4 23,53.4 27.2,49.2Z';
const DOG_HEAD = 'M51.4,31.6C51.2,23.4 57,18.4 64.2,18.4C71.2,18.4 76.6,22.8 77.2,29.2C80.8,29.6 84,32.2 84,36.2C84,40.6 80.6,43.6 76,43.6C72.8,45 68.6,45.4 64.8,45.2C57,45 51.6,39.6 51.4,31.6Z';
function dog(c) {
  const s = {};
  s.hip = 55; s.bx = 44;
  s.shadow = E(45, 74.2, 23, 2.7, INK, op('.16'));
  /* queue relevée et effilée : base (croupe → milieu ; contour dessous, base0) et bout au bout blanc, qui traîne ;
     contour « à l'extérieur » (paint-order, comme les pattes) : la jointure ne se voit pas */
  const TP = [[32, 50], [25.4, 48.6], [19.6, 43.6], [21, 35]];
  const TB = taper(TP, 6.8, 3, 0, 0.5, 10, false), TT = taper(TP, 6.8, 3, 0.4, 1, 12, true);
  s.tail = {
    base0: P(TB, c.body, PO),
    tip: P(TT, c.body, PO) + P(taper(TP, 6.8, 3, 0.75, 1, 5, true), c.blaze),
    base: P(TB, c.body),
    pivot: [29.6, 48.6], frame: [8, 26, 26, 30], tipO: '85% 95%'
  };
  const L = (x, far) => leg(x + 1.2, 55, 4.8, c, far, 'paw');
  s.legsB = [L(29.2, 1), L(34.2, 0)];
  s.legsF = [L(50.2, 1), L(55.2, 0)];
  s.body = P(DOG_BODY, c.body)
    + P('M30.6,47.2C35.6,44.4 43,43.6 50,43.8C50.4,47.8 47.4,50.8 42.6,51C37.4,51.2 32.4,49.8 30.6,47.2Z', c.mane)
    + P('M32.6,63C37.6,60 46.6,58.8 54.6,57.2C58.6,56.4 61.4,53.4 62,48.4L63.6,51.4C65.2,56.6 62.8,61.4 56.8,62.6C48.8,64 38,64 32.6,63Z', c.belly)
    + HL(37.6, 46.4, 4.6, 1.2, -4) + LINE(DOG_BODY, SW);
  const earL = P('M57.6,20.2C52.4,19 47.8,23 46.6,29.8C45.8,34.6 46.8,39.4 49.6,40.6C52.2,41.6 54.4,39 55,35C55.6,30.4 57.6,26 60.2,23.2Z', c.mane, OUT);
  const earR = P('M71.4,20.4C75.2,19.6 78.6,22 79.6,26.2C80.2,28.8 79.6,31 78,31.4C76.4,31.8 75.2,30 74.6,27.8C74,25.4 73,23.2 71.4,21.6Z', c.mane, OUT);
  const base = P(DOG_HEAD, c.body)
    + P('M64.4,19.2C65.6,18.9 66.6,19.5 66.9,20.6L67.6,29.4C66.8,30.2 66,31 65.4,32L63.6,21.2C63.4,20.2 63.7,19.4 64.4,19.2Z', c.belly)
    + P('M66.6,39C67.2,33.4 71.4,29.4 77.2,29.2C80.8,29.6 84,32.2 84,36.2C84,40.6 80.6,43.6 76,43.6C72.8,45 68.6,45.4 66.8,44.6C66,43 66.2,40.8 66.6,39Z', c.belly)
    + LINE(DOG_HEAD, SW) + HL(57.6, 24.6, 2.6, 1.2, -40) + HL(79, 31.6, 2.2, 0.8, 10);
  const tongue = G('c-tongue', P('M79.4,40.4C78.8,41.4 78.6,42.6 78.6,43.6C78.6,45 79.4,45.8 80.6,45.8C81.8,45.8 82.6,45 82.6,43.6C82.6,42.6 82.4,41.4 81.8,40.4Z', TONGUE, st(1.1))
    + LINE('M80.6,41.6V44', 0.8, '#e0607a'), ' display="none"');
  s.head = { earL, earR, maneB: '', base, maneF: '', extra: tongue };
  s.face = {
    eyes: [[59.8, 29.6, 1], [70.6, 29.2, 0.92]], lid: c.body,
    cheeks: [[56.4, 35.4, 1], [73.4, 35.6, 0.72]],
    nose: P('M78.6,32.8C78.6,30.9 84.2,30.7 84.6,32.6C85,34.6 82.8,36 81.6,36C80.2,36 78.6,34.6 78.6,32.8Z', c.nose, st(1))
      + E(80.4, 32, 1.2, 0.55, '#fff', op('.5')) + LINE('M81.6,36L80.8,38.4', 1.1),
    mouth: [80.6, 39, 4.6, 'c']
  };
  s.headPivot = [59.6, 44.6]; s.headFrame = [36, -12, 64, 72];
  s.anchors = {
    top: [64.2, 18.6, -6, 0.86], neck: [60, 46.8, 6, 0.95], back: [41, 44.6, -2, 0.96], tail: [22.8, 43.6, -50, 0.75],
    wings: [43, 45.8, 0, 0.95], chest: [58.8, 53.8]
  };
  return s;
}
/* ===== fin TERRE ===== */

/* ===== v2.5 — EAU : baleine (zone de l'agent « eau ») ===== */
/* ----- baleine (🐳 : grosse tête ronde, gorge claire à rainures, petite nageoire, caudale à deux lobes levée, jet
   d'eau au-dessus de la tête quand elle est joyeuse ; elle nage dans la même eau que le dauphin : même vague devant,
   même surface derrière). La tête est un DÔME (ellipse presque ronde de centre WH_C, rayons WH_R) et le pivot de
   .c-head est son centre : les rotations de la tête (regard, tête penchée, sommeil, fierté) font glisser le visage sur
   le dôme sans casser le contour. Le trait du corps prolonge celui du dôme sur 32° au-delà de la jointure du dos, et
   celui du dôme commence 16° après elle : ni trou ni trait en trop tant que la tête tourne de moins de 16° (de même
   sous le ventre, caché par la vague sauf quand elle saute). Le jet
   d'eau (.c-spout, caché par défaut) est montré par css/ui/mount.css (joie, ravie, danse, action « souffle »). ----- */
const WH_C = [67.6, 45.2], WH_R = [24.4, 22.6];
/* point du dôme à l'angle deg (0 = devant, -90 = sommet) ; k = retrait (bord intérieur du trait) */
const whPt = (deg, k = 0) => { const a = deg * Math.PI / 180; return pts([WH_C[0] + (WH_R[0] - k) * Math.cos(a), WH_C[1] + (WH_R[1] - k) * Math.sin(a)]); };
const whArc = (k, large, sweep, deg) => `A${r1(WH_R[0] - k)},${r1(WH_R[1] - k)} 0 ${large} ${sweep} ${whPt(deg, k)}`;
function whale(c) {
  const s = {};
  /* hip : le petit (stade 1) garde la même ligne d'eau au lieu de s'enfoncer */
  s.hip = 84; s.bx = 54; s.merged = true;
  s.order = ['legsB', 'body', 'tail', 'legsF'];
  const water = dolphin(c);
  s.shadow = water.shadow; s.front = water.front;
  const k0 = SW / 2;                                       /* aplat du dôme : jusqu'au bord intérieur du trait */
  /* caudale horizontale à deux lobes relevés, encoche au milieu (au-dessus du pédoncule) */
  const FLUKE = 'M18,29.6C17.4,27 15,25.2 11.8,24.6C9,24 6.8,22.2 5.6,19C9.4,17.6 14.6,18.2 18.6,21L20.7,22.6L22.8,21C26.8,18.2 32,17.6 35.8,19C34.6,22.2 32.4,24 29.6,24.6C26.4,25.2 24,27 23.4,29.6Z';
  s.tail = {
    tip: P(FLUKE, c.body, OUT) + LINE('M20.7,23.4V27.4', 1, INK, op('.35')) + HL(11.4, 21, 2.6, 0.8, 18) + HL(30, 21, 2.6, 0.8, -18),
    base: '',
    pivot: [20.7, 29.4], frame: [2, 12, 38, 22], tipO: '50% 100%'
  };
  /* nageoire pectorale, juste derrière le dôme (elle pagaie quand elle nage) */
  const pf = [28, 48, 19, 15];
  s.legsB = [G('c-leg', ''), G('c-leg', '')];
  s.legsF = [G('c-leg', FRAME(pf) + P('M44.8,53.6C41.8,57 37.6,59.8 33.4,60.8C32.2,61.1 31.7,60 32.5,59.4C35.8,57 39,54 41.6,51.6Z', c.fin, OUT), pv(pf, 43.4, 52.8)), G('c-leg', '')];
  /* corps : dos, pédoncule qui remonte vers la caudale, croupe arrondie, ventre (sous la vague) ; l'aplat passe sous
     le dôme, le trait part du dôme */
  const J1 = whPt(-106), J2 = whPt(112);
  const BACK = `C52.4,25.7 42.6,29 35.6,32.6C31,35 27,35 25.2,31.6L24,28.4L17.4,28.8C16.2,34.6 17.4,41.4 21,46.6C25.6,53 33,57.4 42,60.4C48,62.4 54,64.6 ${J2}`;
  s.body = P(`M${J1}${BACK}${whArc(0, 1, 0, -106)}Z`, c.body)
    + P('M18.6,36.4C18.8,42 22.4,48.6 29,53.4C34.4,57.2 40.4,59.6 46,62.2C38.6,61.2 30,58.6 24.4,54.2C19.4,50.2 17,43.6 18.6,36.4Z', dark(c.body, 0.12))
    + HL(38.4, 33.4, 4.6, 1.2, -22) + LINE(`M${whPt(-74)}${whArc(0, 0, 0, -106)}${BACK}${whArc(0, 0, 0, 96)}`, SW);
  /* dôme : aplat, gorge claire (son bord est la bouche) à rainures, reflet, trait extérieur (16° après la jointure) */
  const base = E(WH_C[0], WH_C[1], WH_R[0] - k0, WH_R[1] - k0, c.body)
    + P(`M${whPt(6, k0)}C85,52.6 74.4,56.4 63.4,58.8C60.4,59.4 58.2,60.8 ${whPt(124, k0)}${whArc(k0, 0, 0, 6)}Z`, c.belly)
    + LINE('M88,51.8C82,55.6 73.6,58.6 65.4,60.2M85.4,55.2C80,58.2 73,60.6 66.6,61.8', 1.1, mix(c.belly, c.body, 0.5))
    + HL(60.4, 30.4, 5, 1.5, -40) + HL(87, 32.4, 2.2, 0.9, 45)
    + LINE(`M${whPt(-90)}${whArc(0, 1, 1, 116)}`, SW);
  /* jet d'eau : tige qui monte de l'évent, gerbe qui retombe des deux côtés, gouttes (origine : l'évent) */
  const sp = (x, y) => [63.4 + x, 22.9 + y];
  const spout = P(mapPath('M-1.4,0C-1.8,-4.6 -2.4,-9.6 -3.2,-12.2C-5.2,-13.4 -8.2,-12.6 -10.2,-9.6C-10.8,-8.6 -12,-8.8 -11.8,-10C-10.8,-14.8 -5.6,-17.6 0,-17.6C5.6,-17.6 10.8,-14.8 11.8,-10C12,-8.8 10.8,-8.6 10.2,-9.6C8.2,-12.6 5.2,-13.4 3.2,-12.2C2.4,-9.6 1.8,-4.6 1.4,0Z', sp), '#bfe9ff', st(1.2, '#4f9fd0'))
    + LINE(mapPath('M-.3,-1.8C-.5,-5.6 -.9,-9.2 -1.5,-11.8M-6.4,-14.6C-4.4,-15.6 -2,-16 .4,-15.8', sp), 0.9, '#fff')
    + [[-12.2, -5.4, 1.2], [12.2, -5.6, 1.1], [-6.6, -20.4, 0.95], [6.4, -20.8, 0.85], [0, -21.4, 0.7]].map(([x, y, r]) => C(...sp(x, y), r, '#bfe9ff', st(0.8, '#4f9fd0'))).join('');
  s.head = { earL: '', earR: '', maneB: '', base, maneF: '', extra: G('c-spout', spout, ' display="none"') };
  s.face = {
    eyes: [[76.2, 42.4, 1.06], [86.4, 40.6, 0.84]], lid: c.body,
    cheeks: [[72.4, 48.4, 0.95], [88.6, 46.6, 0.66]],
    /* l'évent (narine de la baleine), au sommet du dôme */
    nose: LINE('M61.8,25.4C62.6,24.3 64.2,23.9 65.4,24.3', 1.1),
    mouth: [84.8, 50.2, 8, 'b']
  };
  s.headPivot = WH_C; s.headFrame = [36, -6, 66, 80];
  s.anchors = {
    top: [76, 24.2, 16, 0.88], neck: [75, 54.4, -16, 1.15, 4], back: [41.4, 29.6, -18, 0.95], tail: [20.7, 30.6, 0, 0.8],
    wings: [45, 28.6, 0, 0.95], chest: [38.6, 45.4]
  };
  return s;
}
/* ===== fin EAU ===== */

/* ===== v2.5 — OISEAUX : chouette, perroquet, pingouin, poussin (zone de l'agent « oiseaux ») ===== */
/* Squelette d'oiseau commun : debout, vu de trois quarts face, tourné vers la droite ; grosse tête ronde posée sur un
   corps en œuf (la tête recouvre le haut du corps : air « chibi », le cou ne se voit jamais quand elle bouge).
   - Pattes : une patte d'oiseau par groupe (.m-legB = celle du fond, ombrée ; .m-legF = celle de devant), le second
     .c-leg de chaque groupe est vide : la marche alterne les deux pattes (mount.css). Tige et doigts en tubes : tous
     les contours, puis tous les aplats (une seule silhouette, contour plus fin que celui du corps).
   - Ailes : dans .c-wings, donc DERRIÈRE le corps (l'aile proche dépasse à gauche, la lointaine à droite, comme un
     poussin vu de face) ; l'aile de gauche est dessinée à l'endroit puis retournée par un groupe miroir sans classe :
     une rotation négative (battement « flap » du dragon, companion-life.js) lève alors les deux ailes. Les ailes de fée
     les remplacent (assemblage commun).
   - Bec en deux pièces : la mandibule inférieure est dans la tête (sous la bouche), la supérieure dans .c-nose,
     dessinée APRÈS les expressions : la bouche commune (sourire, bouche ouverte et langue, « o » de surprise…) se
     loge entre les deux, comme un bec qui s'ouvre.
   - « Oreilles » .c-ear-l / .c-ear-r : aigrettes (chouette), houppette (poussin), vides (perroquet, pingouin).
   look : beak (bec), beak2 (mandibule inférieure), feet (pattes), wing (ailes), disk (disque facial de la chouette,
   masque du pingouin), head (tête du perroquet), face (joue blanche du perroquet), tail2 (plumes de queue). */
const BEAK_OUT = st(1.5);
/* couleurs de repli (look incomplet) */
const birdC = c => ({ ...c, beak: c.beak || '#ffa94d', feet: c.feet || c.beak || '#ffa94d', beak2: c.beak2 || dark(c.beak || '#ffa94d', 0.16),
  disk: c.disk || c.belly, head: c.head || c.body, face: c.face || '#fffaf0', tail2: c.tail2 || c.belly });
/* patte d'oiseau : tige, cheville, doigts en éventail au sol vers la droite (zygo : deux doigts devant, deux derrière) */
function birdLeg(x, top, c, far, zygo) {
  const col = far ? dark(c.feet, 0.2) : c.feet, w = 1.7, ow = w + 2.6, gy = GROUND + SW / 2 - ow / 2, an = gy - 2;
  const d = zygo
    ? `M${pts([x, top])}V${r1(an)}L${pts([x + 3.4, gy])}M${pts([x - 2.6, gy])}L${pts([x, an])}L${pts([x + 1.4, gy])}M${pts([x, an])}L${pts([x - 1, gy])}`
    : `M${pts([x, top])}V${r1(an)}L${pts([x + 3.8, gy])}M${pts([x - 2.2, gy])}L${pts([x, an])}L${pts([x + 1.4, gy])}`;
  return G('c-leg', LINE(d, ow) + LINE(d, w, col));
}
/* aile : chemin local (épaule en 0,0, l'aile pend vers la droite et le bas), posée en (x, y) à l'échelle k, tournée de
   deg ; mirror : retournée autour de l'épaule (aile de gauche) ; fr = cadre invisible [x, y, l, h] (repère non retourné) */
function birdWing(cls, x, y, k, deg, mirror, draw) {
  const f = affine(x, y, k, deg), fr = [r1(x - 6 * k), r1(y - 8 * k), r1(30 * k), r1(34 * k)];
  const g = G('c-wing ' + cls, FRAME(fr) + draw(d => mapPath(d, f), f), pv(fr, x, y));
  return mirror ? `<g transform="matrix(-1 0 0 1 ${r1(2 * x)} 0)">${g}</g>` : g;
}
/* deux ailes : la lointaine (droite) puis la proche (gauche, retournée) */
const birdWings = (far, near, draw) => birdWing('c-wing-far', far[0], far[1], far[2], far[3], false, (m, f) => draw(m, true, f))
  + birdWing('c-wing-near', near[0], near[1], near[2], near[3], true, (m, f) => draw(m, false, f));
/* bec : mandibule supérieure (dans .c-nose) et reflet */
const beakTop = (d, c, hl) => P(d, c.beak, BEAK_OUT) + (hl ? HL(hl[0], hl[1], hl[2], hl[3], hl[4] || 0) : '');

/* ----- poussin : petite boule jaune duveteuse, houppette, bec orange, tout petits ailerons ----- */
function chick(c0) {
  const c = birdC(c0), s = {};
  s.hip = 66; s.bx = 46;
  s.shadow = E(46.5, 74.2, 17.5, 2.5, INK, op('.16'));
  s.tail = {
    tip: P('M31.4,52.2C28,51.4 25.4,48.6 25.2,45.2C27.4,45.8 29.2,47.2 30.2,48.6C29.8,46 30.6,43.4 32.6,41.8C33.6,44.4 33.6,47.4 32.8,50Z', c.mane, OUT),
    base: '', pivot: [32, 52], frame: [18, 34, 20, 24], tipO: '85% 90%'
  };
  s.legsB = [birdLeg(51.6, 66, c, 1), G('c-leg', '')];
  s.legsF = [birdLeg(42.4, 66, c, 0), G('c-leg', '')];
  s.wings = birdWings([61, 49.6, 1, -28], [31.4, 50.6, 1, -28], (m, far) =>
    P(m('M-1,-1C3,-1.6 6.6,1 7.6,5C8,7.2 7.2,8.8 5.8,9C5.6,8 5,7.4 4.2,7.6C4,6.6 3.2,6 2.2,6.2C1,4.4 -.6,2.6 -1,-1Z'), far ? dark(c.wing, 0.1) : c.wing, OUT));
  const BODY = 'M28.6,55.6C28.6,46.6 36,41 46,41C56,41 63.6,47 63.6,55.8C63.6,64.8 56,70.4 46,70.4C36,70.4 28.6,64.6 28.6,55.6Z';
  s.body = P(BODY, c.body) + P('M29.6,60.4C32,66.6 38.4,70.2 46,70.2C40.2,68.4 34.8,65.2 32,59Z', dark(c.body, 0.1))
    + E(52, 60.2, 9.4, 7.6, c.belly) + HL(36.6, 46.8, 5, 1.6, -28) + LINE(BODY, SW)
    + tuft(29, 51.6, -165, c.body, 0.62) + tuft(62.8, 51, -15, c.body, 0.62) + tuft(38, 69.6, 110, c.body, 0.55);
  const earL = P('M53.8,23.4C52,20.8 49.8,19 47.2,18.6C49.6,16.8 53.4,17.4 56,20.4Z', c.mane, OUT);
  const earR = P('M58.6,22.8C59.4,19.8 61.2,17.4 64,16.6C63.8,19.4 62.6,21.8 61,23.4Z', c.mane, OUT);
  const maneB = P('M55.2,22.8C54.4,18.6 55.4,14.4 58.4,11.6C59.4,14.6 59.4,18.8 58.6,22.8Z', c.mane, OUT);
  const base = C(57, 34.4, 13.4, c.body, OUT) + tuft(44.2, 31, -170, c.body, 0.55)
    + P('M57.8,39C60,39.6 62.4,39.6 64.4,39C63.6,41 62,42 60.6,42C59.2,42 58,40.8 57.8,39Z', c.beak2, BEAK_OUT)
    + HL(50.6, 26.6, 3.2, 1.5, -40);
  s.head = { earL, earR, maneB, base, maneF: '', extra: '' };
  s.face = {
    eyes: [[53.4, 32.6, 1.04], [64.4, 32, 0.94]], lid: c.body,
    cheeks: [[50.6, 38.4, 1], [67.6, 37.4, 0.8]],
    nose: beakTop('M57.2,39C57.6,37.2 59,36.4 60.6,36.4C62.4,36.4 64.4,37.6 66.2,39.2C63.4,39.8 59.6,39.8 57.2,39Z', c, [60.4, 37.6, 1.3, 0.5]),
    mouth: [60.8, 39.2, 3.6, 's']
  };
  s.headPivot = [56, 46]; s.headFrame = [36, -12, 62, 70];
  s.anchors = {
    top: [57, 21.4, -4, 0.74], neck: [64.6, 47.6, -14, 0.8], back: [38.6, 43.4, -16, 0.8], tail: [30.6, 49.2, -40, 0.7],
    wings: [38, 46, 0, 0.82], chest: [53.6, 58.4]
  };
  return s;
}

/* ----- chouette : ronde, aigrettes, disque facial clair, très grands yeux, petit bec crochu, chevrons sur le ventre ----- */
function owl(c0) {
  const c = birdC(c0), s = {};
  s.hip = 66; s.bx = 46;
  s.shadow = E(46.5, 74.2, 18.5, 2.6, INK, op('.16'));
  s.tail = {
    tip: P('M34.6,61.2C30.6,60.8 26.6,61.6 23.6,63.6C25,64.8 26.8,65.2 28.4,65C26.8,66.4 25.8,68.4 25.6,70.4C27.6,70.6 29.4,69.8 30.8,68.6C30.8,70 31.4,71.4 32.4,72.2C34.6,69.6 36,66 36,62.6Z', c.mane, OUT)
      + LINE('M33.4,63.4L27.4,63.4M33.6,64.8L29,68.6', 1, c.belly, op('.6')),
    base: '', pivot: [34, 63], frame: [18, 52, 22, 24], tipO: '90% 20%'
  };
  s.legsB = [birdLeg(51.4, 66, c, 1), G('c-leg', '')];
  s.legsF = [birdLeg(42.2, 66, c, 0), G('c-leg', '')];
  s.wings = birdWings([59.6, 41, 1, -14], [33.2, 41.6, 1, -14], (m, far) =>
    P(m('M-1.4,-1C4,-1.6 8.2,3 8.6,9.4C8.8,13.6 7.6,17.2 5.6,20C4.8,18.6 3.6,18.2 2.6,19C2.4,17.4 1.4,16.6 .2,17C-1,12 -2,5 -1.4,-1Z'), far ? dark(c.wing, 0.12) : c.wing, OUT)
    + LINE(m('M3,4.6L5.6,7M3.6,9.4L6.4,11.6M3.4,14L5.8,15.6'), 1.1, c.belly, op('.7')));
  const BODY = 'M29.6,55C29.6,43 37,34.6 46.4,34.6C55.8,34.6 62.8,43 62.8,54.4C62.8,65 55.6,71.6 46.2,71.6C36.8,71.6 29.6,65.4 29.6,55Z';
  let chev = '';
  for (const [x, y] of [[46.4, 50], [53.4, 49.6], [49.8, 55.2], [56.6, 54.8], [46.2, 60.4], [53.2, 60.2], [49.6, 65.2]]) chev += `M${pts([x - 1.5, y - 0.8])}L${pts([x, y + 0.6])}L${pts([x + 1.5, y - 0.8])}`;
  s.body = P(BODY, c.body) + P('M30.4,60.4C32.6,67 38.6,71.4 46.2,71.4C40,69.6 34.6,66 32.4,59Z', dark(c.body, 0.12))
    + E(50.6, 57, 9.8, 12.6, c.belly) + LINE(chev, 1.1, c.mane, op('.8'))
    + HL(36.6, 44, 4.6, 1.5, -40) + LINE(BODY, SW);
  const earL = P('M41,24.6C39.4,20.6 38,16.6 36.4,12.2C38.6,13 40.2,14.6 41.2,16.2C41.6,14.6 42.4,13.4 43.6,12.6C44.8,16.4 46,19.8 47.6,22.4Z', c.body, OUT)
    + LINE('M41.4,21.4C40.8,19.4 40.2,17.6 39.2,15.6M42.8,20.6C42.6,18.8 42.8,17 43.2,15.6', 1, c.mane);
  const earR = P('M62.4,21.4C64.6,17.6 67,14 70.6,10.6C70.6,12.4 70.2,13.8 69.6,15C71,14.4 72.4,14.2 73.6,14.6C72.4,18.4 70.8,21.6 68.6,24.4Z', c.body, OUT)
    + LINE('M65.4,20.4C66.6,18.4 67.8,16.4 69.2,14.6M67.2,21.6C68.6,19.8 70,18.2 71.6,16.8', 1, c.mane);
  const HEAD = 'M37.6,30C37.4,21 45,15.6 54.6,15.6C64.2,15.6 71.6,21 71.6,29.6C71.6,37.8 64.4,42.6 54.6,42.6C44.8,42.6 37.8,38 37.6,30Z';
  const base = P(HEAD, c.body, OUT)
    + C(49.4, 29.8, 8.6, c.mane) + C(62.2, 29.2, 7.8, c.mane) + C(49.4, 29.8, 7.6, c.disk) + C(62.2, 29.2, 6.8, c.disk)
    + LINE('M53.6,21.4L55.6,24.2L57.4,21.2', 1.2, c.mane, op('.7'))
    + HL(43.4, 20.4, 3, 1.3, -30);
  s.head = { earL, earR, maneB: '', base, maneF: '', extra: '' };
  s.face = {
    eyes: [[49.4, 29.8, 1.52], [62.2, 29.2, 1.34]], lid: c.disk,
    cheeks: [[45.8, 36, 0.92], [65.4, 35.4, 0.76]],
    nose: beakTop('M54.2,32.4C54.4,30.8 58.6,30.8 58.8,32.4C58.8,34 57.6,35.4 56.5,35.9C55.4,35.4 54.2,34 54.2,32.4Z', c, [55.4, 32.2, 0.9, 0.5]),
    mouth: [56.5, 36.1, 3.4, 's']
  };
  s.headPivot = [54.6, 41]; s.headFrame = [34, -12, 64, 70];
  s.anchors = {
    top: [54.6, 16.2, 0, 0.86], neck: [64.2, 43.4, -12, 0.84], back: [32.4, 46.8, -54, 0.8], tail: [31.4, 64.4, 40, 0.68],
    wings: [37, 45, 0, 0.86], chest: [55.6, 54]
  };
  return s;
}

/* ----- pingouin (le manchot des enfants) : debout, dos sombre, ventre et masque blancs, ailerons, bec et pieds orange ----- */
function penguinFoot(x, c, far) {
  const col = far ? dark(c.feet, 0.2) : c.feet, g = GROUND - SW / 2;
  return G('c-leg', P(`M${pts([x - 2.6, g])}H${r1(x + 5.6)}C${pts([x + 7.4, g])} ${pts([x + 7.6, g - 2])} ${pts([x + 6, g - 2.4])}C${pts([x + 5.8, g - 3.4])} ${pts([x + 4.4, g - 3.6])} ${pts([x + 3.6, g - 3.2])}C${pts([x + 2.4, g - 4])} ${pts([x, g - 4])} ${pts([x - 2.4, g - 2.4])}C${pts([x - 3.4, g - 1.6])} ${pts([x - 3.4, g])} ${pts([x - 2.6, g])}Z`, col, PO));
}
function penguin(c0) {
  const c = birdC(c0), s = {};
  s.hip = 68; s.bx = 47;
  s.shadow = E(47.5, 74.2, 19, 2.6, INK, op('.16'));
  s.tail = {
    tip: P('M33,64.6C29.8,66 27,68.6 25.8,71.8C28.6,72.4 31.6,71.6 34.4,69.4Z', c.mane, OUT),
    base: '', pivot: [34, 66], frame: [18, 54, 22, 22], tipO: '90% 20%'
  };
  s.legsB = [penguinFoot(51.4, c, 1), G('c-leg', '')];
  s.legsF = [penguinFoot(40.4, c, 0), G('c-leg', '')];
  s.wings = birdWings([61, 43.4, 1, -22], [33, 43.4, 1, -22], (m, far, f) =>
    P(m('M-1.6,-1.4C3,-1.6 6.6,2.4 8,8.6C9,13.4 8.6,17.4 7,19.2C5.6,20.6 3.6,18.6 2.6,14.6C1.6,10.4 -.4,5.6 -1.6,-1.4Z'), far ? dark(c.body, 0.18) : c.body, OUT)
    + HL(...f(4.4, 6), 1.2, 3, -20));
  const BODY = 'M30,57C29.4,44.6 37,34.4 47,34.4C57,34.4 64,44.6 63.6,57C63.4,66 56.6,71.6 46.8,71.6C37,71.6 30.4,66 30,57Z';
  s.body = P(BODY, c.body)
    + P('M41.6,58.4C41.2,49.6 45.8,43.6 51.6,43.6C57.6,43.6 61.8,49.6 61.4,58.2C61,65.2 56.8,69.8 51.4,69.8C45.8,69.8 42,65.2 41.6,58.4Z', c.belly)
    + P('M42.4,62.6C44,67.2 47.4,69.8 51.4,69.8C49,68.4 46.6,66.2 45.4,62.4Z', dark(c.belly, 0.08))
    + HL(37.2, 44.6, 4.6, 1.5, -40) + LINE(BODY, SW);
  const base = C(52.4, 29.6, 14.2, c.body, OUT)
    + P('M44.2,32C43.8,26.6 47,23.8 50.4,25C52.4,25.8 53.6,27 54.8,27C56,27 57.6,25.2 59.8,25C63.4,24.8 65.6,28 65.2,32.2C64.8,38 60.2,41.8 54.8,41.8C49.2,41.8 44.6,37.8 44.2,32Z', c.belly)
    + P('M56.2,35.4C58.4,36.2 61,36.2 62.8,35.6C62.2,37.4 60.6,38.6 59,38.6C57.6,38.6 56.4,37.2 56.2,35.4Z', c.beak2, BEAK_OUT)
    + HL(44.8, 21.8, 3.2, 1.5, -40);
  s.head = { earL: '', earR: '', maneB: '', base, maneF: '', extra: '' };
  s.face = {
    eyes: [[49.6, 31, 1], [60.4, 30.6, 0.9]], lid: c.belly,
    cheeks: [[47, 36.4, 0.9], [62.4, 36, 0.72]],
    nose: beakTop('M55,35.4C55.8,33.4 58.2,32.8 60.6,33.2C62.8,33.6 64.6,34.6 66,35.8C63.2,36.6 58.6,36.6 55,35.4Z', c, [58.4, 34, 1.4, 0.5]),
    mouth: [59.2, 35.8, 4, 's']
  };
  s.headPivot = [52.4, 42]; s.headFrame = [32, -12, 64, 70];
  s.anchors = {
    top: [52.4, 15.8, 0, 0.84], neck: [62.4, 45.4, -16, 0.84], back: [32.8, 46.6, -54, 0.8], tail: [30, 68.4, 30, 0.66],
    wings: [37, 44, 0, 0.86], chest: [53, 53.6]
  };
  return s;
}

/* ----- perroquet : très coloré (corps vert, tête rouge, ailes bleues), joue blanche, gros bec crochu, longue queue ----- */
function parrot(c0) {
  const c = birdC(c0), s = {};
  s.hip = 64; s.bx = 45;
  s.shadow = E(42, 74.2, 22, 2.6, INK, op('.16'));
  s.tail = {
    tip: P('M33.2,60.8C27,63.6 19.6,67.4 12.6,71.8C11.8,72.4 12.2,73.4 13.2,73.2C20.6,71.4 27.6,68.4 34.4,64.8Z', c.wing, OUT)
      + P('M34,62.6C27,67.2 19.8,70.4 13.8,73.2L35.6,66Z', c.tail2)
      + P('M32.8,58.6C26.2,60 18.6,62.4 11.6,65.6C10.8,66 11,67.2 12,67.2C19.6,66.6 27,65 34.2,62.4Z', c.mane, OUT),
    base: '', pivot: [35, 62], frame: [4, 50, 36, 28], tipO: '95% 40%'
  };
  s.legsB = [birdLeg(49.4, 63, c, 1, 1), G('c-leg', '')];
  s.legsF = [birdLeg(41.6, 63, c, 0, 1), G('c-leg', '')];
  s.wings = birdWings([56, 41.4, 0.86, -10], [33.4, 41, 1.05, -12], (m, far) => {
    const w = far ? dark(c.wing, 0.12) : c.wing;
    return P(m('M-1.6,-1.2C4,-1.8 9,2.6 9.6,9.6C10,14 8.4,18.4 5.6,21.6C4.6,19.8 3.2,19.4 2,20.2C1.8,18.4 .8,17.4 -.6,17.6C-1.6,12.6 -2.4,5.6 -1.6,-1.2Z'), w, OUT)
      + P(m('M-1,9.4C1.6,10.4 5,10.2 9.4,8.6C9.6,12.4 8.4,16.4 5.6,21.6C4.6,19.8 3.2,19.4 2,20.2C1.8,18.4 .8,17.4 -.6,17.6Z'), dark(w, 0.22))
      + LINE(m('M-1,9.4C1.6,10.4 5,10.2 9.4,8.6'), 1.1, INK, op('.5')) + P(m('M-1.2,1C2,.6 5.2,2.4 6.4,5.2C3.6,5.6 1,5 -1,4Z'), c.belly, op('.85'));
  });
  const BODY = 'M30.6,54.4C29.4,43.6 35.8,34.6 45.4,33.8C54.4,33 60,39.8 59.4,49C58.8,59.4 52.6,67 43.6,67.4C36.4,67.8 31.4,62 30.6,54.4Z';
  s.body = P(BODY, c.body) + P('M31.6,58.8C33.6,64.4 38,67.4 43.6,67.4C39.4,66 35.6,62.6 34,57.6Z', dark(c.body, 0.14))
    + P('M47.8,64.8C53.6,62 57.6,56 58.6,48.6C59,44.4 58,40.6 55.4,38.2C53.4,44 49.4,50.4 47,56.6C45.8,59.6 46.2,62.8 47.8,64.8Z', c.belly)
    + HL(36.4, 43.4, 4.6, 1.5, -40) + LINE(BODY, SW);
  const base = C(55.4, 27.6, 12.8, c.head, OUT)
    + P('M47.6,37C50.8,40 55.4,41 59.4,39.6C57.4,42 54.4,43 51,42.6Z', c.body)
    + E(52.6, 27, 5, 5.2, c.face) + E(63.6, 25.2, 3.6, 4.4, c.face)
    + P('M59,33.8L66.4,35.2C67.6,36.8 67,39.2 64.8,40C62.2,40.8 59.6,38.6 59,33.8Z', c.beak2, BEAK_OUT)
    + HL(48.6, 20.4, 3, 1.4, -40);
  s.head = { earL: '', earR: '', maneB: '', base, maneF: '', extra: '' };
  s.face = {
    eyes: [[52.8, 26.6, 0.96], [63.4, 25, 0.8]], lid: c.face,
    cheeks: [[49.6, 32, 0.85], [66.6, 29.6, 0.5]],
    nose: beakTop('M57.4,31.2C57.4,28.8 59.4,27.4 62,27.4C67,27.4 70.6,30.6 70.8,35C70.8,37.6 69.8,39.6 68,40.4C68.2,38.4 67.6,36.4 66,35.6L58.6,34.2C57.8,33.4 57.4,32.4 57.4,31.2Z', c, [64.6, 29.4, 2.2, 0.8, 15])
      + E(61, 29.6, 0.5, 0.7, dark(c.beak, 0.6)),
    mouth: [62.6, 34.8, 4.6, 's']
  };
  s.headPivot = [55, 39]; s.headFrame = [34, -12, 66, 70];
  s.anchors = {
    top: [55.4, 15.4, -6, 0.82], neck: [60.4, 41.6, -24, 0.82], back: [36.8, 39.6, -34, 0.8], tail: [30.4, 62, 60, 0.7],
    wings: [37.6, 42, 0, 0.86], chest: [53.6, 51]
  };
  return s;
}
/* ===== fin OISEAUX ===== */

const SPECIES = {
  pony: c => ponyLike(c, false),
  unicorn: c => ponyLike(c, true),
  horse, cat, lion, capy, dolphin, dragon,
  bear, koala, dog, whale, owl, parrot, penguin, chick
};

/* ================= EXPRESSIONS (communes) ================= */
function eyesOpen(f) {
  let s = '';
  for (const [x, y, k] of f.eyes) {
    const rx = 2.7 * k, ry = 3.4 * k;
    let e = E(x, y, rx, ry, EYE) + C(x - 0.95 * k, y - 1.25 * k, 1.12 * k, '#fff') + C(x + 0.95 * k, y + 1.25 * k, 0.5 * k, '#fff');
    let lid = E(x, y, rx + 0.7, ry + 0.7, f.lid) + LINE(`M${pts([x - rx - 0.5, y + 0.6])}Q${pts([x, y + ry + 1.7])} ${pts([x + rx + 0.5, y + 0.6])}`, 1.3);
    let cap = f.sleepy ? G('c-cap', halfLid(x, y, k, f.sleepy, f.lid, true)) : '';
    s += G('c-eye', G('c-pupil', e) + cap + G('m-lid', lid, ' transform="scale(1 0)"'));
  }
  return G('c-eyes', s);
}
/* paupière mi-close (fixe) : capuchon de la couleur du visage au-dessus de l'œil + ligne de cils */
function halfLid(x, y, k, level, color, arch) {
  const rx = 2.7 * k + 0.7, ry = 3.4 * k + 0.7;
  const yl = y - ry + 2 * ry * level;
  const dx = rx * Math.sqrt(Math.max(0, 1 - ((yl - y) / ry) ** 2));
  const droop = (arch ? -0.9 : 0.9) * k;
  /* arch (capybara serein) : paupière douce sans trait ; sinon ligne de cils */
  return P(`M${pts([x - dx, yl])}A${r1(rx)},${r1(ry)} 0 0 1 ${pts([x + dx, yl])}Q${pts([x, yl + droop])} ${pts([x - dx, yl])}Z`, color)
    + (arch ? LINE(`M${pts([x - dx + 0.9, yl + droop * 0.35])}Q${pts([x, yl + droop * 1.2])} ${pts([x + dx - 0.9, yl + droop * 0.35])}`, 0.8, INK, op('.55'))
      : LINE(`M${pts([x - dx - 0.2, yl])}Q${pts([x, yl + droop])} ${pts([x + dx + 0.2, yl])}`, 1.3));
}
const arcUp = (x, y, k) => `M${pts([x - 2.5 * k, y + 0.9 * k])}Q${pts([x, y - 3.4 * k])} ${pts([x + 2.5 * k, y + 0.9 * k])}`;
const arcDown = (x, y, k) => `M${pts([x - 2.6 * k, y - 0.2 * k])}Q${pts([x, y + 2.6 * k])} ${pts([x + 2.6 * k, y - 0.2 * k])}`;
/* sourcils, bien au-dessus de l'œil (y − 6k) : up = étonnés (arc), sad = attristés (bout intérieur relevé, accent
   circonflexe), worry = inquiets (même forme, plus doux) */
function brows(f, kind, slope = 0.9) {
  let d = '';
  f.eyes.forEach(([x, y, k], i) => {
    const t = y - (kind === 'sad' ? 6.6 : 6) * k, w = 2.3 * k;
    if (kind === 'up') d += `M${pts([x - w, t + 0.2])}Q${pts([x, t - 1.6 * k])} ${pts([x + w, t + 0.2])}`;
    else {
      const inner = i === 0 ? 1 : -1;          /* côté du nez : vers la droite pour l'œil gauche */
      const dy = slope * k;
      d += `M${pts([x - w * inner, t + dy])}Q${pts([x, t + dy * 0.2])} ${pts([x + w * inner, t - dy])}`;
    }
  });
  return LINE(d, 1.4);
}
/* yeux rieurs : paupière basse remontée en arc (les joues poussent), joues plus rouges */
function happyEyes(f) {
  let lid = '', line = '';
  for (const [x, y, k] of f.eyes) {
    const rx = 2.7 * k + 0.8, ry = 3.4 * k;
    lid += `M${pts([x - rx, y + ry * 0.72])}Q${pts([x, y - ry * 0.1])} ${pts([x + rx, y + ry * 0.72])}L${pts([x + rx, y + ry + 1])}L${pts([x - rx, y + ry + 1])}Z`;
    line += `M${pts([x - rx + 0.6, y + ry * 0.64])}Q${pts([x, y - ry * 0.06])} ${pts([x + rx - 0.6, y + ry * 0.64])}`;
  }
  return P(lid, f.lid) + LINE(line, 1.2) + f.cheeks.map(([x, y, k]) => E(x, y - 0.3, 3 * k, 1.9 * k, f.blush || BLUSH, op('.4'))).join('');
}
/* yeux humides de la tristesse : grand reflet et larme retenue en bas de l'œil (pupille levée de .3, -.6 par mount.css) */
function wetEyes(f) {
  return f.eyes.map(([x, y, k]) => C(x - 0.6 * k, y - 1.65 * k, 1.35 * k, '#fff')).join('')
    + LINE(f.eyes.map(([x, y, k]) => `M${pts([x - 1.9 * k, y + 1.6 * k])}Q${pts([x + 0.3, y + 3.3 * k])} ${pts([x + 2 * k, y + 1.4 * k])}`).join(''), 0.9, '#fff', op('.9'));
}
/* bulle de pensée « petit creux » : une pomme, en haut à droite de la tête */
function foodBubble(f) {
  const [x0, y0, k0] = f.eyes[f.eyes.length - 1];
  const x = x0 + 7.4 * k0, y = y0 - 10.4 * k0;
  return C(x - 4.6, y + 6.2, 0.7, '#fff', st(0.8)) + C(x - 3, y + 3.8, 1.1, '#fff', st(0.9))
    + C(x, y, 3.9, '#fff', st(1.1))
    + C(x, y + 0.4, 2, '#f05a5a', st(0.8)) + P(`M${pts([x + 0.3, y - 2])}c.8,-1 2,-1 2.4,-.6c-.6,.8 -1.6,1 -2.4,.6z`, '#5fbf6a', st(0.6));
}
/* bouches : style s (museau), c (chat ω), b (bec du dauphin), d (dragon) */
function mouth(f, expr) {
  const [x, y, w, sty] = f.mouth;
  const h = w / 2;
  const tongueTip = (tx, ty) => P(`M${pts([tx - 1.3, ty - 0.2])}C${pts([tx - 1.3, ty + 2.2])} ${pts([tx + 1.5, ty + 2.2])} ${pts([tx + 1.5, ty - 0.2])}Z`, TONGUE, st(1));
  const open = (k, tongue = true) => {
    const ww = h * k, dd = w * 0.62 * k;
    return P(`M${pts([x - ww, y - 0.3])}Q${pts([x, y + 0.2])} ${pts([x + ww, y - 0.3])}Q${pts([x + ww * 0.6, y + dd])} ${pts([x, y + dd])}Q${pts([x - ww * 0.6, y + dd])} ${pts([x - ww, y - 0.3])}Z`, MOUTH, st(1.3))
      + (tongue ? E(x + 0.2, y + dd * 0.62, ww * 0.42, dd * 0.24, TONGUE) : '');
  };
  const smile = (k = 1) => sty === 'c'
    ? `M${pts([x - h, y - 0.4])}Q${pts([x - h / 2, y + 1.6 * k])} ${pts([x, y - 0.2])}Q${pts([x + h / 2, y + 1.6 * k])} ${pts([x + h, y - 0.4])}`
    : sty === 'b'
      ? `M${pts([x - h, y - 1.6 * k])}Q${pts([x - h * 0.55, y + 1.2 * k])} ${pts([x, y + 0.5])}Q${pts([x + h * 0.6, y + 0.2])} ${pts([x + h, y - 0.3])}`
      : `M${pts([x - h, y - 0.3])}Q${pts([x, y + 1.9 * k])} ${pts([x + h, y - 0.3])}`;
  const fang = sty === 'd' ? P(`M${pts([x + h * 0.3, y + 0.3])}l1,1.8l1,-1.6z`, '#fff', st(0.8)) : '';
  switch (expr) {
    case 'neutral': return LINE(smile(), 1.5) + fang;
    case 'happy': return open(1) + fang;
    case 'delighted': return open(1.35);
    case 'proud': return LINE(`M${pts([x - h - 0.4, y - 0.8])}Q${pts([x, y + 2.8])} ${pts([x + h + 0.4, y - 0.8])}`, 1.6) + fang;
    case 'surprised': return E(x, y + 0.9, w * 0.17, w * 0.24, MOUTH, st(1.2));
    case 'sleepy': return E(x, y + 0.6, w * 0.12, w * 0.15, MOUTH, st(1.1));
    /* petit creux : sourire gourmand, la langue lèche la lèvre (coin droit) */
    case 'hungry': return LINE(smile(0.8), 1.5)
      + P(`M${pts([x + h * 0.25, y + 0.5])}C${pts([x + h * 0.3, y + 2.6])} ${pts([x + h + 1.6, y + 1.6])} ${pts([x + h + 1.2, y - 1.4])}C${pts([x + h + 0.4, y - 0.4])} ${pts([x + h * 0.6, y - 0.1])} ${pts([x + h * 0.25, y + 0.5])}Z`, TONGUE, st(1));
    /* concentré : bouche appliquée, bout de langue au coin (regard baissé par mount.css, sans froncement) */
    case 'focused': return LINE(`M${pts([x - h * 0.7, y + 0.6])}Q${pts([x, y + 1])} ${pts([x + h * 0.5, y + 0.4])}`, 1.5) + tongueTip(x + h * 0.6, y + 0.5);
    /* tristesse (humeur sad) : petite bouche tombante */
    case 'sad': return sty === 'c' ? LINE(`M${pts([x - h * 0.45, y + 2.6])}Q${pts([x, y + 0.9])} ${pts([x + h * 0.45, y + 2.6])}`, 1.4)
      : LINE(`M${pts([x - h * 0.55, y + 1.5])}Q${pts([x, y - 0.6])} ${pts([x + h * 0.55, y + 1.5])}`, 1.5);
    default: return '';
  }
}
const arcProud = (x, y, k) => `M${pts([x - 2.6 * k, y + 0.7 * k])}Q${pts([x, y - 2 * k])} ${pts([x + 2.6 * k, y + 0.7 * k])}`;
const sparkle = (x, y, k) => P(`M${pts([x, y - 2.2 * k])}l${r1(0.6 * k)},${r1(1.6 * k)} ${r1(1.6 * k)},${r1(0.6 * k)}-${r1(1.6 * k)},${r1(0.6 * k)}-${r1(0.6 * k)},${r1(1.6 * k)}-${r1(0.6 * k)}-${r1(1.6 * k)}-${r1(1.6 * k)}-${r1(0.6 * k)} ${r1(1.6 * k)}-${r1(0.6 * k)}z`, GOLD_L, st(0.8, GOLD_D));
/* calques d'expression ; « sad » n'est pas une expression du contrat (EXPRESSIONS) : c'est le visage de l'humeur
   triste, affiché par mount.css quand l'expression est neutre */
const LAYERS = [...EXPRESSIONS, 'sad'];
function expressions(f, extra) {
  let s = '';
  for (const ex of LAYERS) {
    let g = '';
    if (ex === 'happy') g += happyEyes(f);
    if (ex === 'delighted') g += LINE(f.eyes.map(([x, y, k]) => arcUp(x, y, k)).join(''), 1.7);
    if (ex === 'sleepy') g += LINE(f.eyes.map(([x, y, k]) => arcDown(x, y, k)).join(''), 1.6);
    if (ex === 'proud') {
      g += LINE(f.eyes.map(([x, y, k]) => arcProud(x, y, k)).join(''), 1.7);
      const [x0, y0, k0] = f.eyes[f.eyes.length - 1];
      g += sparkle(x0 + 5.6 * k0, y0 - 6.4 * k0, 1);
    }
    if (ex === 'hungry') g += foodBubble(f);
    if (ex === 'surprised') g += brows(f, 'up');
    if (ex === 'sad') g += brows(f, 'sad', 1.1) + wetEyes(f);
    g += G('m-mouth', mouth(f, ex));
    if (extra && extra[ex]) g += extra[ex];
    s += G('c-x x-' + ex, g, ex === 'neutral' ? '' : ' display="none"');
  }
  return s;
}

/* ================= ACCESSOIRES ================= */
const at = a => ` transform="translate(${r1(a[0])} ${r1(a[1])})${a[2] ? ` rotate(${a[2]})` : ''}${a[3] && a[3] !== 1 ? ` scale(${a[3]})` : ''}"`;
const ACC = {
  /* chapeau de paille à ruban (origine : centre du bord) */
  chapeau: () => P('M-13,0C-13,-3.4 13,-3.4 13,0C13,3.2 -13,3.2 -13,0Z', '#f2cf73', st(1.6))
    + P('M-7,-.6C-7.4,-6.2 -4,-9.8 0,-9.8C4,-9.8 7.4,-6.2 7,-.6Z', '#f7db8c', st(1.6))
    + P('M-7.1,-3C-2.6,-1.6 2.6,-1.6 7.1,-3L7,-.6C2.6,.8 -2.6,.8 -7,-.6Z', '#f472b6', st(1.2))
    + C(4.6, -1.9, 1.7, '#fff', st(1)) + C(4.6, -1.9, 0.7, GOLD)
    + LINE('M-10.4,.8L-8.8,-1M10.4,.8L8.8,-1M-4.6,-6.6L-3.4,-4.6', 0.8, '#c99b3c'),
  /* couronne dorée à joyaux (origine : milieu du bas) */
  couronne: () => P('M-7,0L-7.8,-7.6L-3.6,-3.8L0,-9.6L3.6,-3.8L7.8,-7.6L7,0Z', GOLD, st(1.5))
    + `<rect x="-7.4" y="-2.6" width="14.8" height="3.2" rx="1.2" fill="${GOLD_D}" stroke-width="1.2"/>`
    + C(0, -1, 1.2, '#f05a6e', st(0.8)) + C(-4.4, -1, 0.85, '#5aa9f0', st(0.7)) + C(4.4, -1, 0.85, '#4cc38a', st(0.7))
    + C(-7.8, -7.8, 1, GOLD_L, st(0.8)) + C(0, -9.9, 1.1, GOLD_L, st(0.8)) + C(7.8, -7.8, 1, GOLD_L, st(0.8))
    + P('M-5,-5.2L-4.4,-2.8', 'none', st(0.9, '#fff7d1')),
  /* foulard rouge noué (origine : nœud, devant le cou) ; la pointe reste verticale (contre-rotation) */
  foulard: (r, fl) => '<g transform="scale(1.25)">' + P('M-10.6,-3.2C-6.8,-.6 -2.4,.4 1.6,-.6L2.4,2.6C-2.6,3.8 -7.8,2.6 -11.6,-.4Z', '#e8504f', st(1.3))
    + C(-6.4, 0.6, 0.6, '#fff') + C(-3.2, 1.4, 0.5, '#fff')
    + `<g transform="rotate(${r1(fl - r)} 1.6 1)">` + P('M-1.8,1.4L5.4,1.4L1.8,9.6Z', '#e8504f', st(1.3))
    + C(1.6, 4, 0.7, '#fff') + C(3.2, 2.6, 0.5, '#fff') + C(0.2, 2.6, 0.5, '#fff') + C(1.6, 6.4, 0.5, '#fff') + C(1.6, 1, 1.9, '#d43c3c', st(1.1)) + '</g></g>',
  /* écharpe arc-en-ciel (origine : devant le cou) ; le pan retombe toujours droit */
  echarpe: (r, fl) => LINE('M-11.6,-2.4C-7,1 -1.8,1.8 3,.4', 6.4)
    + LINE('M-11.6,-2.4C-7,1 -1.8,1.8 3,.4', 4.2, '#ff7a7a') + LINE('M-11.4,-1.2C-7,2 -1.8,2.8 3,1.6', 1.3, '#ffd45c') + LINE('M-11.8,-3.6C-7,-.2 -1.8,.6 3,-.8', 1.3, '#6cc4ff')
    + `<g transform="rotate(${r1(fl - r)} 1.8 .8)">`
    + `<rect x="-.4" y=".4" width="4.6" height="10.6" rx="1.4" fill="#ff7a7a" stroke-width="1.3"/>`
    + LINE('M.2,3.4h3.8M.2,5.8h3.8M.2,8.2h3.8', 1.3, '#ffd45c') + LINE('M.6,11.2v1.4M1.9,11.2v1.6M3.3,11.2v1.4', 0.9) + '</g>',
  /* selle dorée (origine : centre de l'assise, sur le dos) */
  selle: () => P('M-8.4,-1.6Q0,-3.8 8.4,-1.6L7.6,4.8Q0,6.8 -7.6,4.8Z', '#f472b6', st(1.4))
    + LINE('M-7.8,3.4Q0,5.2 7.8,3.4', 1, GOLD)
    + P('M-6.6,-2C-6.8,-5.6 -3.8,-4.4 -1.4,-3.8C1.2,-3.3 3.4,-3.8 5,-5.8C6.8,-4.4 7,-1.8 5.4,-.8C2,.4 -3,.4 -6.6,-2Z', GOLD, st(1.4))
    + LINE('M.8,.6V7.4', 1.3) + P('M-.8,7.2H2.4L2,9.4H-.4Z', GOLD_D, st(1.1))
    + LINE('M-3.6,-3C-1.4,-2.4 1.2,-2.4 3.2,-3.2', 0.9, GOLD_L),
  /* nœud rose (origine : centre du nœud) */
  noeud: () => '<g transform="scale(1.32)">' + P('M0,0C-2,-4.2 -7.4,-5 -7.4,-1C-7.4,2.4 -3,2.2 0,0Z', '#f472b6', st(1.1))
    + P('M0,0C2,-4.2 7.4,-5 7.4,-1C7.4,2.4 3,2.2 0,0Z', '#f472b6', st(1.1))
    + P('M-.6,.6L-3.2,6.4L-1.4,5.8L-.4,7.2Z', '#e0458f', st(0.9)) + P('M.6,.6L3.2,6.4L1.4,5.8L.4,7.2Z', '#e0458f', st(0.9))
    + C(0, 0, 1.6, '#e0458f', st(1)) + P('M-5.6,-1.8C-4.8,-3 -3.2,-3 -2.4,-2', 'none', st(0.8, '#ffd1e6')) + '</g>',
  /* ailes de fée translucides (origine : attache sur le dos) — deux paires, celle du fond plus pâle */
  ailes: () => {
    const wing = (k, o) => wrap(k ? `translate(${k} ${r1(-k * 0.6)}) scale(.86)` : '', G('c-fw', P('M0,0C-2.4,-9.6 -14.6,-15.4 -16.2,-7C-17.2,-.6 -6.6,1 0,0Z', '#c6e6ff', st(1.1, '#5f9fd8') + op(o))
      + P('M0,0C-4.2,2 -11.6,7.4 -8.6,10.6C-5.4,12.6 -1,5.4 0,0Z', '#f1c9ff', st(1.1, '#b07ad8') + op(o))
      + P('M-2.6,-2.4C-6,-6.4 -10,-8.6 -13.4,-8.4', 'none', st(0.8, '#fff') + op(o))
      + C(-11.4, -5.4, 1, '#fff', op(o)) + C(-6.4, 6.6, 0.8, '#fff', op(o))));
    return `<g transform="scale(1.3)">${wing(3.2, '.6') + wing(0, '.85')}</g>`;
  }
};

/* lunettes rondes : calées sur les yeux de l'espèce */
function glasses(f) {
  const [[x1, y1, k1], [x2, y2, k2]] = f.eyes;
  const g1 = 3.9 * k1, g2 = 3.7 * k2;
  return C(x1, y1, g1, '#dff2ff', st(1.3, '#3d2a20') + ' fill-opacity=".28"')
    + C(x2, y2, g2, '#dff2ff', st(1.3, '#3d2a20') + ' fill-opacity=".28"')
    + LINE(`M${pts([x1 + g1, y1 - 0.4])}Q${pts([(x1 + x2) / 2, Math.min(y1, y2) - 2])} ${pts([x2 - g2, y2 - 0.4])}`, 1.4, '#3d2a20')
    + LINE(`M${pts([x1 - g1, y1 - 0.6])}L${pts([x1 - g1 - 4.6, y1 - 2.4])}`, 1.4, '#3d2a20')
    + LINE(`M${pts([x1 - g1 * 0.5, y1 - g1 * 0.4])}Q${pts([x1 - g1 * 0.2, y1 - g1 * 0.75])} ${pts([x1 + g1 * 0.25, y1 - g1 * 0.72])}`, 0.9, '#fff');
}

/* médaille de champion (stade 3) : ruban en V (bleu et rouge) et médaille dorée étoilée, origine = centre de la médaille */
const rosette = a => G('c-rosette', P('M-4.6,-8.4L-1.2,-2.4L1.6,-3.6L-1.2,-9.4Z', '#5aa9f0', st(1)) + P('M4.6,-8.4L1.2,-2.4L-1.6,-3.6L1.2,-9.4Z', '#f05a6e', st(1))
  + C(0, 0, 3.8, GOLD, st(1.2)) + C(0, 0, 2.6, GOLD_L)
  + P('M0,-2L.6,-.7L2,-.6L.9,.3L1.3,1.7L0,.9L-1.3,1.7L-.9,.3L-2,-.6L-.6,-.7Z', GOLD_D) + HL(-1.4, -1.6, 1, 0.5, -30), at([a[0], a[1] + 1.6, 0, 1]));
/* éclat doré du champion (scintille, au-dessus de la tête) */
const glint = (x, y) => G('c-glint', P(`M${pts([x, y - 2.8])}L${pts([x + 0.8, y - 0.8])}L${pts([x + 2.8, y])}L${pts([x + 0.8, y + 0.8])}L${pts([x, y + 2.8])}L${pts([x - 0.8, y + 0.8])}L${pts([x - 2.8, y])}L${pts([x - 0.8, y - 0.8])}Z`, GOLD_L, st(0.8, GOLD_D)));

/* ================= STADES ================= */
const STAGES = {
  1: { leg: 0.74, body: 0.86, head: 1.16, all: 0.92, tilt: 0, eye: 1.14, tail: 0.92 },
  2: { leg: 1, body: 1, head: 1, all: 1, tilt: 0, eye: 1, tail: 1 },
  3: { leg: 1.04, body: 1.03, head: 1.02, all: 1, tilt: -4, eye: 1, tail: 1.14 }
};
const mat = (a, d, e, f) => `matrix(${r1n(a)} 0 0 ${r1n(d)} ${r1(e)} ${r1(f)})`;
const r1n = v => String(Math.round(v * 1000) / 1000).replace(/^(-?)0\./, '$1.');
const wrap = (tf, inner) => (tf ? `<g transform="${tf}">${inner}</g>` : inner);

/* géométrie des stades : transformations statiques (groupes sans classe) et projection d'un point du dessin junior */
function stageGeo(S, stage) {
  const K = STAGES[stage];
  /* silhouette d'un seul tenant (dauphin, capybara : la tête se fond dans le corps) : la tête suit l'échelle du corps,
     sans inclinaison, sinon la jointure se verrait */
  const legK = K.leg, bodyK = K.body, headK = S.merged ? K.body : K.head, tiltA = S.merged ? 0 : K.tilt;
  const drop = (1 - legK) * (GROUND - S.hip);
  const fx = p => [bodyK * (p[0] - S.bx) + S.bx, bodyK * (p[1] - S.hip) + S.hip + drop];
  const N = S.headPivot, N2 = fx(N);
  const a = (tiltA * Math.PI) / 180;
  const rot = p => [N[0] + (p[0] - N[0]) * Math.cos(a) - (p[1] - N[1]) * Math.sin(a), N[1] + (p[0] - N[0]) * Math.sin(a) + (p[1] - N[1]) * Math.cos(a)];
  const fh = p => { const q = rot(p); return [N2[0] + headK * (q[0] - N[0]), N2[1] + headK * (q[1] - N[1])]; };
  const fa = p => [50 + K.all * (p[0] - 50), GROUND + K.all * (p[1] - GROUND)];
  const same = stage === 2;
  return {
    N, fx, fh, fa,
    bodyTf: same ? '' : mat(bodyK, bodyK, S.bx * (1 - bodyK), S.hip * (1 - bodyK) + drop),
    headTf: same ? '' : mat(headK, headK, N2[0] - headK * N[0], N2[1] - headK * N[1]),
    legTf: same ? '' : mat(1, legK, 0, GROUND * (1 - legK)),
    allTf: K.all === 1 ? '' : mat(K.all, K.all, 50 * (1 - K.all), GROUND * (1 - K.all)),
    tilt: tiltA ? `rotate(${tiltA} ${r1(N[0])} ${r1(N[1])})` : ''
  };
}

/* points d'ancrage (unités du viewBox 100 × 84, × taille / 100 pour des px), au repos, pour placer un objet à la bouche
   (carotte, miettes), au-dessus de la tête (cœurs, « z »)… → { ground, mouth, eyes, top, neck, back, tail, chest } */
export function mountAnchors(type, opts = {}) {
  const t = MOUNTS[type] && SPECIES[type] ? type : 'pony';
  const o = opts && typeof opts === 'object' ? opts : {};
  const stage = STAGES[o.stage] ? +o.stage : 2;
  const S = SPECIES[t](colors(MOUNTS[t]));
  const g = stageGeo(S, stage);
  const R = p => p.map(v => Math.round(v * 10) / 10);
  const head = p => R(g.fa(g.fh(p))), body = p => R(g.fa(g.fx(p)));
  const A = S.anchors, f = S.face;
  return {
    ground: GROUND + SW / 2,
    mouth: head(f.mouth.slice(0, 2)),
    eyes: f.eyes.map(e => head(e.slice(0, 2))),
    top: head(A.top.slice(0, 2)),
    neck: body(A.neck.slice(0, 2)), back: body(A.back.slice(0, 2)), chest: body(A.chest.slice(0, 2)),
    tail: body(A.tail.slice(0, 2))
  };
}

/* ================= ASSEMBLAGE ================= */
export function mountSVG(type, worn, size, moodClass, opts = {}) {
  ensureMountCSS();
  const t = MOUNTS[type] && SPECIES[type] ? type : 'pony';
  const M = colors(MOUNTS[t]);
  const o = opts && typeof opts === 'object' ? opts : {};
  const expr = EXPRESSIONS.includes(o.expr) ? o.expr : 'neutral';
  const stage = STAGES[o.stage] ? +o.stage : 2;
  const w = Array.isArray(worn) ? worn : [];
  const S = SPECIES[t](M);
  const f = S.face;
  /* un seul objet par emplacement (ordre de SHOP, comme la v11) */
  const items = {};
  for (const it of SHOP) if (w.includes(it.id) && !items[it.slot]) items[it.slot] = it.id;
  const acc = (slot, a) => (items[slot] && ACC[items[slot]] ? G('c-acc acc-' + items[slot], ACC[items[slot]](a[2] || 0, a[4] || 0), at(a)) : '');

  const { bodyTf, headTf, legTf, allTf, tilt, N } = stageGeo(S, stage);
  const K = STAGES[stage], eyeK = S.merged && K.eye !== 1 ? K.eye * 1.08 : K.eye;
  if (eyeK !== 1) f.eyes = f.eyes.map(([x, y, k]) => [x, y, k * eyeK]);

  /* queue */
  const T = S.tail;
  const tailIn = (T.base0 || '') + G('c-tail-tip', T.tip, ` style="transform-origin:${T.tipO}"`) + T.base + acc('tail', S.anchors.tail);
  const tailK = K.tail, tailTf = tailK === 1 ? '' : mat(tailK, tailK, T.pivot[0] * (1 - tailK), T.pivot[1] * (1 - tailK));
  const tail = G('m-tail', wrap(bodyTf, FRAME(T.frame) + wrap(tailTf, tailIn)), pv(T.frame, T.pivot[0], T.pivot[1]));
  /* pattes */
  const legsB = G('m-legB', wrap(legTf, S.legsB.join('')));
  const legsF = G('m-legF', wrap(legTf, S.legsF.join('')));
  /* ailes (dragon) et ailes de fée (accessoire, derrière le corps) */
  const wings = G('c-wings', items.wings ? '' : wrap(bodyTf, S.wings || ''));
  const fairy = items.wings ? wrap(bodyTf, acc('wings', S.anchors.wings)) : '';
  /* torse */
  /* col (foulard, écharpe) : sur le torse ; espèces d'un seul tenant : dans la tête, par-dessus la jointure */
  const neck = acc('neck', S.anchors.neck);
  let bodyIn = S.body + acc('back', S.anchors.back) + (S.merged ? '' : neck);
  if (stage === 3) bodyIn += rosette(S.anchors.chest);
  const body = G('m-body', wrap(bodyTf, bodyIn));
  /* tête */
  const H = S.head;
  const extra = t === 'capy' && !items.head ? { happy: S.mandarin, delighted: S.mandarin } : null;
  const face = G('c-face', G('c-cheek', f.cheeks.map(([x, y, k]) => E(x, y, 2.6 * k, 1.6 * k, f.blush || BLUSH, op(f.blushO || '.55'))).join(''))
    + eyesOpen(f) + expressions(f, extra) + G('c-nose', f.nose)
    + (items.face ? G('c-acc acc-' + items.face, glasses(f)) : ''));
  /* « z » du sommeil : deux, de tailles différentes, qui montent l'un après l'autre (mount.css) */
  const tp = S.anchors.top;
  const zz = G('c-zz', LINE(`M${pts([tp[0] + 7, tp[1] - 2.6])}h5.4l-5.4,6h5.4`, 1.8, INK, op('.75')), ' display="none"')
    + G('c-zz', LINE(`M${pts([tp[0] + 14, tp[1] - 10])}h3.8l-3.8,4.2h3.8`, 1.5, INK, op('.65')), ' display="none"');
  const ears = G('m-ear c-ear-l', H.earL) + G('m-ear c-ear-r', H.earR), maneB = G('c-mane c-mane-b', H.maneB);
  const headIn = (H.earsOver ? maneB + ears : ears + maneB) + H.base + (S.merged ? neck : '') + G('c-mane c-mane-f', H.maneF)
    + H.extra + face + acc('head', S.anchors.top) + (H.post || '') + (stage === 3 ? glint(tp[0] + 9, tp[1] - 3) : '') + zz;
  const head = G('c-head', wrap(headTf, FRAME(S.headFrame) + wrap(tilt, headIn)), pv(S.headFrame, N[0], N[1]));

  const parts = { tail, legsB, legsF, body };
  const order = S.order || ['tail', 'legsB', 'legsF', 'body'];
  const all = G('c-all', wrap(allTf, fairy + wings + order.map(k => parts[k]).join('') + head));
  const shadow = G('c-shadow', o.shadow === false ? '' : wrap(allTf, S.shadow));
  const front = S.front ? G('c-wave', wrap(allTf, S.front)) : '';
  const mood = String(moodClass || '').replace(/[^\w -]/g, '').trim();
  const sz = Math.max(1, Math.round(+size || 100));
  /* cadrage : corps entier (100 × 84, comme la v11) ou portrait (carré centré sur la tête, pour les avatars ronds) */
  let vb = '0 0 100 84', hgt = Math.round(sz * 0.84);
  if (o.view === 'portrait') {
    /* carré qui contient la tête : des oreilles (ancre top) à la bouche, de l'œil du fond au bout du museau */
    const A = mountAnchors(t, { stage }), [mx, my] = A.mouth, [ex] = A.eyes[0], ty = A.top[1];
    const half = Math.max((my - ty) / 2 + 10, (mx - ex) / 2 + 11) * (K.head > 1 ? 1.04 : 1);
    vb = `${r1((ex + mx) / 2 - 1 - half)} ${r1((ty + my) / 2 + 1 - half)} ${r1(half * 2)} ${r1(half * 2)}`; hgt = sz;
  }
  /* phase de l'attente (s) : décale respiration, regard, clignements… quand plusieurs compagnons se côtoient */
  const ph = Number.isFinite(+o.phase) && o.phase !== null && o.phase !== '' ? ` style="--c-ph:${r1(-Math.abs(+o.phase) % 30)}s"` : '';
  let out = shadow + all + front;
  /* au-delà de 140 px, le contour principal s'affine pour rester vers 3 px à l'écran (JEUX §0 : 2-3 px) */
  const ow = Math.max(0.6, Math.min(1, 140 / (o.view === 'portrait' ? sz * 0.45 : sz)));
  if (ow < 1) out = out.replace(/stroke-width="(2\.3|4\.6)"/g, (_, v) => `stroke-width="${r1(+v * ow)}"`);
  return `<svg class="m-root c-rig sp-${t}${mood ? ' ' + mood : ''}" data-species="${t}" data-expr="${expr}" data-stage="${stage}"${o.view === 'portrait' ? ' data-view="portrait"' : ''}${ph} width="${sz}" height="${hgt}" viewBox="${vb}" overflow="${o.view === 'portrait' ? 'hidden' : 'visible'}" stroke="${INK}" stroke-width="0" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">`
    + out + '</svg>';
}
