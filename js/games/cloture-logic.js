/* ============ LE CHEMIN DE LA CLÔTURE — logique pure (aucun DOM) ============
   Utilisé par js/games/cloture.js ; testé par tests/cloture.test.mjs (node tests/run.mjs cloture).
   Un « plan » est une portion de ligne graduée telle que la décrit item.data (js/content/maths/ligne.js) :
   { min, max, major, minor, labels: [{ v, text }] } — la ligne principale, ou data.zoom (partie agrandie).
   - piquets : min + i × minor, i = 0 … n ; grands piquets aux multiples ABSOLUS de major (marge 1e-6) ;
   - échelle valeur ↔ x (pixels) ;
   - aimantation : aux piquets si data.snap, sinon à une grille fine d'un dixième d'intervalle
     (les cibles « à l'estime » du générateur en sont toujours des multiples) ;
   - tolérance : juste si |position − valeur| ≤ data.tolerance ;
   - saisie au pavé : parseNum(saisie) comparé à la réponse ;
   - fractions écrites « 7/4 » → morceaux pour l'écriture empilée ;
   - plaquettes : taille de police qui tient sans chevauchement ;
   - indice : les deux plaquettes (ou piquets) qui encadrent la valeur, et les petits sauts entre elles ;
   - caméra du zoom : zoom logarithmique à point fixe (la lisse ne bouge pas à l'écran) ;
   - saut en arc et marche du compagnon ;
   - répondre à voix haute (v2.3) : ce que le micro écoute pour l'item (voicePlan), formes dites des fractions et
     des décimaux (tests/cloture-voice.test.mjs). */

import { parseNum, fmtNum } from '../core/util.js';
import { toWords, spell, parseSpoken } from '../core/numbers-fr.js';
import { fracWords } from '../content/maths/ligne.js';
import { NEVER_WRONG } from './tables-logic.js';

export const EPS = 1e-6;
const NNBSP = '\u202f';
const r9 = x => Math.round(x * 1e9) / 1e9;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- piquets ---------- */
/* nombre de petits intervalles du plan */
export function intervals(plane) {
  const n = Math.round((plane.max - plane.min) / plane.minor);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
/* v est-il un multiple de step (marge relative 1e-6 : 0,1 n'est pas exact en binaire) */
export function isMultiple(v, step) {
  if (!(step > 0) || !Number.isFinite(v)) return false;
  const q = v / step;
  return Math.abs(q - Math.round(q)) < EPS;
}
export function postValue(plane, i) { return r9(plane.min + i * plane.minor); }
/* [{ i, v, major }] du premier au dernier piquet */
export function posts(plane) {
  const n = intervals(plane), out = [];
  for (let i = 0; i <= n; i++) {
    const v = postValue(plane, i);
    out.push({ i, v, major: isMultiple(v, plane.major) });
  }
  return out;
}
/* indice du piquet le plus proche de v (borné au plan) */
export function postIndex(plane, v) {
  return clamp(Math.round((v - plane.min) / plane.minor), 0, intervals(plane));
}
export function nearestPost(plane, v) { return postValue(plane, postIndex(plane, v)); }
export function sameValue(a, b) { return Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b)); }
/* plaquette posée sur la valeur v, ou null */
export function labelAt(plane, v) { return (plane.labels || []).find(l => sameValue(l.v, v)) || null; }

/* ---------- échelle valeur ↔ x ---------- */
export function makeScale(min, max, x0, x1) {
  const span = max - min || 1, k = (x1 - x0) / span;
  return { min, max, x0, x1, k, toX: v => x0 + (v - min) * k, toV: x => min + (x - x0) / k };
}

/* ---------- placer : aimantation, flèches, tolérance ---------- */
/* pas des déplacements : un piquet si aimanté, sinon un dixième de petit intervalle */
export function fineStep(plane, snap) { return snap ? plane.minor : plane.minor / 10; }
/* position posable la plus proche de v (bornée au plan) */
export function quantize(plane, v, snap) {
  const s = fineStep(plane, snap);
  const n = Math.round((plane.max - plane.min) / s);
  const i = clamp(Math.round((v - plane.min) / s), 0, n);
  return r9(plane.min + i * s);
}
/* flèches ‹ › et clavier : dir = −1 | +1 ; rien de posé → la carotte arrive au premier piquet */
export function nudge(plane, v, dir, snap) {
  if (v === null || v === undefined || !Number.isFinite(v)) return plane.min;
  return quantize(plane, v + dir * fineStep(plane, snap), snap);
}
export function isCorrectPlace(data, pos) {
  if (pos === null || pos === undefined || !Number.isFinite(pos)) return false;
  return Math.abs(pos - data.value) <= data.tolerance + 1e-9;
}
/* texte accessible de la position (sans donner le nombre : c'est l'exercice) */
export function positionText(plane, v, snap) {
  if (v === null || v === undefined) return 'Carotte pas encore posée';
  if (snap) return 'Carotte sur le piquet ' + (postIndex(plane, v) + 1) + ' sur ' + (intervals(plane) + 1);
  const pct = Math.round(100 * (v - plane.min) / (plane.max - plane.min));
  return 'Carotte à ' + pct + NNBSP + '% de la clôture';
}

/* ---------- lire : saisie au pavé ---------- */
export function answerMatches(str, answer) {
  const x = parseNum(str), a = Number(answer);
  return Number.isFinite(x) && Number.isFinite(a) && Math.abs(x - a) <= 1e-9 * Math.max(1, Math.abs(a));
}
/* longueur de saisie à autoriser (chiffres + virgule + marge) */
export function keypadLen(answer) { return Math.max(4, String(answer).replace('.', ',').length + 2); }

/* ---------- fractions : écriture empilée ---------- */
/* « Compte 3 petits piquets : 3/4. » → [{ t: 'txt', s }, { t: 'frac', n: 3, d: 4 }, { t: 'txt', s }] */
export function splitFrac(str) {
  const s = String(str ?? ''), out = [], re = /(\d+)\/(\d+)/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: 'txt', s: s.slice(last, m.index) });
    out.push({ t: 'frac', n: Number(m[1]), d: Number(m[2]) });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ t: 'txt', s: s.slice(last) });
  return out;
}
/* opérations dans les bulles : le signe reste collé au nombre qui le suit (« = 48 » ne se sépare jamais),
   la ligne peut se couper avant le signe ; jamais à l'intérieur d'un nombre (espaces fines insécables) */
export function keepMath(s) { return String(s).replace(/ ([+−×÷=<>]) (?=[\d(]|$)/g, ' $1\u00A0'); }

/* ---------- plaquettes ---------- */
/* largeur estimée d'un libellé pour une police de 100 px (Fredoka 600 : chiffres ≈ 0,58 em) */
export function estimateWidth100(text) {
  return [...String(text)].reduce((w, c) => w + (c === NNBSP || c === ' ' ? 24 : c === ',' ? 26 : c === '/' ? 40 : 58), 0);
}
/* taille de police commune à toutes les plaquettes d'une ligne, sans chevauchement :
   xs = abscisses (px, triées), w100 = largeurs des libellés à 100 px ; pad = marge intérieure totale
   d'une plaquette, gap = écart minimal entre deux plaquettes. */
export function fitLabelFont(xs, w100, { pad = 8, gap = 3, min = 11, max = 17 } = {}) {
  let f = max;
  for (let i = 1; i < xs.length; i++) {
    const room = xs[i] - xs[i - 1] - pad - gap;
    const need = (w100[i] + w100[i - 1]) / 200;
    if (need > 0) f = Math.min(f, room / need);
  }
  return clamp(Math.floor(f * 2) / 2, min, max);
}

/* ---------- indice : ce qui encadre la valeur ----------
   aimanté → les deux plaquettes qui encadrent la valeur (au-delà de la dernière : les deux dernières) ;
   à l'estime → les deux piquets qui l'encadrent. → { a, b } (valeurs) */
export function hintSpan(plane, value, snap) {
  if (!snap) {
    const i = clamp(Math.floor((value - plane.min) / plane.minor + EPS), 0, intervals(plane) - 1);
    return { a: postValue(plane, i), b: postValue(plane, i + 1) };
  }
  const L = [...(plane.labels || [])].sort((x, y) => x.v - y.v);
  if (L.length < 2) return { a: plane.min, b: plane.max };
  for (let i = 0; i < L.length - 1; i++) {
    if (L[i].v - EPS <= value && value <= L[i + 1].v + EPS) return { a: L[i].v, b: L[i + 1].v };
  }
  return value < L[0].v ? { a: L[0].v, b: L[1].v } : { a: L[L.length - 2].v, b: L[L.length - 1].v };
}
/* petits sauts à dessiner pour l'indice : [[v, v + minor], …] entre a et b (à l'estime : tous) */
export function hopsBetween(plane, a, b, snap) {
  const out = [];
  const lo = snap ? Math.min(a, b) : plane.min, hi = snap ? Math.max(a, b) : plane.max;
  const n = intervals(plane);
  for (let i = 0; i < n; i++) {
    const v = postValue(plane, i), w = postValue(plane, i + 1);
    if (v >= lo - EPS && w <= hi + EPS) out.push([v, w]);
  }
  return out;
}
/* valeur d'un petit saut : { text: '+10' } ou, pour une fraction, { n: 1, d: 4 } */
export function stepLabel(plane, fmt) {
  if (fmt === 'frac') return { n: 1, d: Math.round(1 / plane.minor) };
  return { text: '+' + fmtNum(r9(plane.minor)) };
}

/* ---------- caméra du zoom (viewBox) ----------
   La partie agrandie est dessinée DANS son intervalle [X1 ; X2] de la ligne principale, à l'échelle 1/k
   (k = (x1 − x0) / (X2 − X1)), sa lisse posée sur la lisse principale. La caméra passe de la vue
   complète V0 = (0, 0, W, H) à V1 = (vx, vy, W/k, H/k) où la partie agrandie occupe tout l'écran,
   en zoom logarithmique autour du point fixe P (la lisse reste à la même hauteur à l'écran).
   → { k, sub: { tx, ty, s } (transformation du groupe agrandi), at(e) → [x, y, w, h] pour e ∈ [0 ; 1] } */
export function camera({ W, H, x0, x1, X1, X2, yRail }) {
  const k = (x1 - x0) / (X2 - X1);
  const vx = X1 - x0 / k, vy = yRail * (1 - 1 / k);
  const P = { x: k * vx / (k - 1), y: k * vy / (k - 1) };
  return {
    k, P, sub: { tx: vx, ty: vy, s: 1 / k },
    at(e) {
      const s = Math.pow(k, -clamp(e, 0, 1));
      return [P.x * (1 - s), P.y * (1 - s), W * s, H * s];
    }
  };
}
export function easeInOut(t) { const x = clamp(t, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

/* ---------- compagnon : saut en arc et marche ---------- */
/* points d'une parabole de (xa, ya) à (xb, yb), sommet « height » px au-dessus du segment */
export function arcPoints(xa, ya, xb, yb, height, n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push({ x: xa + (xb - xa) * t, y: ya + (yb - ya) * t - 4 * height * t * (1 - t), t });
  }
  return out;
}
/* durées (ms) : un saut ne bloque jamais plus de 400 ms ; la marche dépend de la distance */
export function jumpMs(dx) { return Math.round(clamp(240 + Math.abs(dx) * 0.5, 300, 400)); }
export function jumpHeight(dx) { return clamp(18 + Math.abs(dx) * 0.18, 22, 56); }
export function walkMs(dx) { return Math.round(clamp(Math.abs(dx) * 3.4, 420, 1500)); }

/* ---------- mise en page verticale de la scène (px) ----------
   A : bande du haut (mini-carte du zoom), above : bande au-dessus de la lisse (drapeau, compagnon,
   panneau, loupe), puis plaquettes entre les deux lisses et le pré. Ancrage EN HAUT : quand la scène
   rapetisse (bulle trop haute pour le pré, posée sous la scène), seul le pré se raccourcit. */
export function sceneLayout(W, H, { zoom = false, wide = false, lift = null, compact = false } = {}) {
  const S = wide ? 72 : 60;                         /* largeur du compagnon (≈ 64 px) */
  /* compact : petit écran avec pavé numérique (≈ 360 × 740) → bandes resserrées */
  const A = zoom ? (compact ? 48 : wide ? 66 : 60) : 12;
  const above = compact ? 76 : wide ? 98 : 88;
  const ideal = A + above + 62 + 20;
  const extra = Math.max(0, H - ideal);
  /* la clôture descend vers le milieu quand la scène est haute, en gardant ~90 px de pré sous les piquets
     (place de la bulle d'indice, posée sur l'herbe) */
  const lifted = lift === null ? clamp(Math.min(extra * 0.42, extra - 92), 0, wide ? 170 : 150) : lift;
  const yRail = A + lifted + above;
  return {
    W, H, S, wide, zoom, A, lift: lifted, yRail,
    railH: wide ? 12 : 10,
    bigTop: yRail - (wide ? 26 : 22), smallTop: yRail - (wide ? 14 : 12),
    bigW: wide ? 10 : 8, smallW: wide ? 5.5 : 4.5,
    yLabel: yRail + (wide ? 30 : 27),
    yRail2: yRail + (wide ? 52 : 47),
    yGround: yRail + (wide ? 70 : 62),
    left: wide ? 92 : 68,                           /* début de la clôture : place du compagnon à gauche */
    flagTop: yRail - (compact ? 64 : wide ? 86 : 74),   /* haut du mât du drapeau */
    signY: yRail - (compact ? 56 : wide ? 82 : 66),     /* centre du panneau de la valeur */
    tipY: yRail - (wide ? 31 : 26),                     /* pointe de la carotte */
    loupeY: yRail - (compact ? 58 : wide ? 76 : 66),    /* centre de la loupe */
    minH: A + above + 44,                           /* en dessous, les pieds des piquets sont coupés */
    ideal
  };
}

/* ---------- répondre à voix haute (v2.3, js/ui/voice-answer.js) ----------
   voicePlan(item, { prev }) → ce que le micro écoute pour l'item :
   - { kind: 'pause' }                   placer : la voix ne place rien (dire « 23 » donnerait la réponse : c'est le
                                         nombre de la consigne) ; pavé entier ≥ 100 000 (comme Pommes express ;
                                         mesuré, enfant simulé : 2 justes sur 6 et 3 faux injustes à six chiffres,
                                         « sept cent cinquante-quatre mille six cents » entendu « … mille cents ») ;
   - { kind: 'number', answer, ignore }  pavé entier ≤ 99 999 ; jamais comptés faux : les plaquettes
                                         (deux plans), les débuts du nombre dit (« trois mille… » en route vers
                                         3 290 : l'enfant reprend son souffle), la réponse précédente ; only : seul un
                                         piquet de la clôture compte faux (le reste : morceau ou erreur d'écoute) ;
   - { kind: 'choices', list }           QCM : entiers par { num }, fractions par leurs formes dites (« trois
                                         quarts ») ; pavé décimal : les PIQUETS de la clôture (≤ 21 valeurs ; la
                                         grammaire des nombres du module commun n'a pas « virgule », celle des
                                         choix l'a), forme « deux virgule huit » ; sans les plaquettes, ni les
                                         entiers d'une ligne décimale, ni ce qui se lit DANS la réponse dite (sinon
                                         « deux virgule huit… » vaudrait 2,8 en route vers 2,812) ; un « témoin »
                                         fait reconnaître chaque piquet à sa forme entière (VOICE_WITNESS).
   voiceVerdict(v, réponse, retenu) : une réponse dite JUSTE est tapée tout de suite ; FAUSSE, elle est retenue
   (l'enfant compte souvent les piquets à voix haute : « un quart… deux quarts… trois quarts » ; le nombre suivant
   l'annule), redite → tapée ; « un » n'est jamais faux (hésitations).
   holdDue : la réponse fausse retenue est tapée quand l'enfant s'est tu (VOICE_QUIET_MS sans voix d'après la santé
   du micro, vue toutes les 250 ms : un enfant qui compte « trois dixièmes… quatre dixièmes » se tait 1 s entre deux
   piquets — mesuré, enfant simulé : à 1,2 s, le faux tombait 40 ms avant le piquet suivant) et au moins
   VOICE_HOLD_MS après qu'elle a été entendue (choix ;
   0 pour les nombres, déjà stables 1,5 s), au plus tard VOICE_HOLD_MAX_MS après (bruit continu ; 10 s : un enfant
   qui compte cinq piquets parle plus de 4 s — mesuré).
   VOICE_FORGET_MS : en mode choix, après ce silence, le texte entendu repart de zéro (un début abandonné, « six… »,
   ne se combine plus avec la réponse dite ensuite, « cinq dixièmes », pour donner un autre choix) ; 3 s : « huit
   virgule… » (il compte les petits piquets en silence) « …sept » reste une seule réponse. */
export const VOICE_NUMBER_MAX = 99999;
export const VOICE_HOLD_MS = 900;
export const VOICE_QUIET_MS = 1800;
export const VOICE_HOLD_MAX_MS = 10000;
export const VOICE_FORGET_MS = 3000;
/* ordinaux (dénominateurs ≤ 20) dont le PLURIEL est au lexique du modèle ; sinon le singulier (même son) */
const PLURAL_OK = new Set([2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 17]);
export const FRAC_SAY_MAX_DEN = 20;

/* « trois quarts », « trois quart » (homophones : Vosk rend l'un ou l'autre), « un demi », « une demie » ;
   dénominateur > 20 (distracteurs de CM2) ou n/1 : aucune forme (le choix se touche au doigt) */
export function fracSay(n, d) {
  if (!Number.isInteger(n) || !Number.isInteger(d) || n < 1 || d < 2 || d > FRAC_SAY_MAX_DEN) return [];
  const den = k => fracWords(k, d).split(' ').slice(1).join(' ');
  const one = den(1), many = den(2);
  const dens = PLURAL_OK.has(d) ? (n > 1 ? [many, one] : [one, many]) : [one];
  const out = dens.map(w => (n === 1 ? 'un' : toWords(n)) + ' ' + w);
  if (n === 1 && d === 2) out.push('une demie', 'une demi');
  return [...new Set(out)];
}

/* 2,812 → { ip: 2, fp: '812' } (trois décimales au plus, zéros de fin retirés) */
function decParts(v) {
  const [ip, fp = ''] = Math.abs(v).toFixed(3).replace(/\.?0+$/, '').split('.');
  return { ip: Number(ip), fp };
}
/* « deux virgule huit cent douze », « trois virgule zéro cinq » ; entier → son écriture.
   Pas de « deux unités et huit dixièmes » : mêlée aux formes « virgule », elle fausse les mots distinctifs du juge
   des choix (js/core/voice-choice.js : « trois virgule trois » ne garderait que « virgule », « trois unités et cinq
   dixièmes » serait à égalité avec « trois unités et trois dixièmes ») */
export function decSay(v) {
  if (!Number.isFinite(v) || v < 0) return [];
  const { ip, fp } = decParts(v);
  if (!fp) return [toWords(ip)];
  const z = fp.length - fp.replace(/^0+/, '').length;
  return [toWords(ip) + ' virgule ' + [...Array(z).fill('zéro'), toWords(Number(fp))].join(' ')];
}

/* nombres entendus en route vers n, mot après mot : 3 290 → 3, 3 000, 3 002, 3 200 */
export function spokenPrefixes(n) {
  if (!Number.isInteger(n) || n < 0) return [];
  const w = toWords(n).split(' '), out = [];
  for (let k = 1; k < w.length; k++) {
    const v = parseSpoken(w.slice(0, k).join(' '));
    if (v !== null && v !== n && !out.includes(v)) out.push(v);
  }
  return out;
}

const labelValues = data => [...(data.labels || []), ...((data.zoom && data.zoom.labels) || [])].map(l => l.v);
/* « témoin » des piquets décimaux : un choix qu'on ne dit pas (mots d'appoint déjà dans la grammaire, dans un ordre
   que personne ne dit) et qui ne partage aucun mot avec les autres. Le juge des choix ne garde d'une forme que ses
   mots « distinctifs » (absents d'au moins une forme des autres choix) : sans témoin, « trois » et « virgule »,
   communs à tous les piquets entre 3 et 4, disparaîtraient — « trois virgule trois » ne garderait rien de plus
   que « trois virgule » (souffle repris → 3,3), et 3,5 sur une ligne de demis se réduirait à « trois ». Avec lui,
   chaque piquet se reconnaît à sa forme entière. Valeur non numérique : voiceVerdict → 'skip'. */
export const VOICE_WITNESS = Object.freeze({ value: '·', say: ['zut oups zut oups'], label: '…' });

/* piquets de la partie où se trouve le drapeau → choix dits (pavé décimal) */
export function postChoices(data) {
  const pl = data.zoom || data, answer = Number(data.value);
  const lab = labelValues(data);
  const sayOf = decSay;
  const ans = sayOf(answer).map(f => f.split(' '));
  /* forme contenue (mots dans l'ordre) dans celle de la réponse : un début (« deux virgule huit » de 2,812), ou
     « six virgule un » dans « six virgule zéro un » — le juge les mettrait à égalité avec la réponse dite */
  const inAnswer = v => sayOf(v).some(f => {
    const w = f.split(' ');
    return ans.some(a => {
      if (a.length <= w.length) return false;
      let k = 0;
      for (const x of a) if (k < w.length && x === w[k]) k++;
      return k === w.length;
    });
  });
  const entry = v => ({ value: v, say: decSay(v), label: fmtNum(v) });
  const out = [];
  for (const p of posts(pl)) {
    if (sameValue(p.v, answer)) { out.push(entry(answer)); continue; }
    if (lab.some(x => sameValue(x, p.v)) || Number.isInteger(p.v) || inAnswer(p.v)) continue;
    out.push(entry(p.v));
  }
  if (!out.some(c => c.value === answer)) out.push(entry(answer));
  out.push(VOICE_WITNESS);
  return out;
}

export function voicePlan(item, { prev = null } = {}) {
  const d = item && item.data;
  if (!d || d.mode !== 'lire') return { kind: 'pause' };
  const answer = Number(item.answer);
  if (!Number.isFinite(answer)) return { kind: 'pause' };
  if (Array.isArray(item.choices) && item.choices.length) {
    /* « quatre cents… » en route vers 470 : jamais un essai faux, même si 400 est proposé */
    const never = d.fmt === 'frac' || !Number.isInteger(answer) ? [] : spokenPrefixes(answer);
    return { kind: 'choices', never, list: item.choices.map(c => {
      const v = Number(c.value);
      if (d.fmt === 'frac') return { value: c.value, say: fracSay(c.num, c.den), label: Number.isInteger(c.num) && Number.isInteger(c.den) ? fracWords(c.num, c.den) : String(c.label) };
      if (Number.isInteger(v) && v >= 0) return { value: c.value, num: v, label: spell(v) };
      return { value: c.value, say: decSay(v), label: fmtNum(v) };
    }) };
  }
  if (d.fmt === 'int' && Number.isInteger(answer) && answer >= 0 && answer <= VOICE_NUMBER_MAX) {
    const ignore = [...new Set([...labelValues(d), ...spokenPrefixes(answer), prev])]
      .filter(v => typeof v === 'number' && Number.isFinite(v) && !sameValue(v, answer));
    /* faux par la voix : seulement un piquet de la clôture (la lecture d'un voisin, d'une autre graduation) ; tout
       autre nombre est un morceau de phrase ou une erreur d'écoute (voix d'enfant simulée : « neuf cents » entendu
       « neuf cinq » → 5, « trois cent vingt-trois » → « trois vingt-trois » → 23, « deux cents » → « dix ») */
    const only = [...posts(d), ...(d.zoom ? posts(d.zoom) : [])].map(p => p.v);
    return { kind: 'number', answer, ignore, only };
  }
  if (d.fmt === 'dec') return { kind: 'choices', never: [], list: postChoices(d) };
  return { kind: 'pause' };
}

/* réponse entendue → 'now' (taper), 'hold' (retenir) ou 'skip' (rien) ; never : jamais faux (début de la réponse
   dite) ; only : seules ces valeurs peuvent compter faux (piquets de la clôture) */
export function voiceVerdict(v, answer, held = null, { never = [], only = null } = {}) {
  const x = Number(v);
  if (!Number.isFinite(x)) return 'skip';
  if (sameValue(x, Number(answer))) return 'now';
  if (NEVER_WRONG.concat(never || []).some(y => sameValue(y, x))) return 'skip';
  if (Array.isArray(only) && !only.some(y => sameValue(y, x))) return 'skip';
  if (held !== null && held !== undefined && sameValue(x, Number(held))) return 'now';
  return 'hold';
}

export function holdDue({ pickAt, lastVoiceAt = 0, now, holdMs = VOICE_HOLD_MS }) {
  const since = now - pickAt;
  if (!(since >= 0)) return false;
  if (since >= VOICE_HOLD_MAX_MS) return true;
  return since >= holdMs && now - (lastVoiceAt || 0) >= VOICE_QUIET_MS;
}
