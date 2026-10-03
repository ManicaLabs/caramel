/* ============ POMMES EXPRESS — logique pure (aucun DOM) ============
   Utilisée par js/games/pommes.js, testée par tests/pommes.test.mjs (confrontée au vrai générateur
   js/content/maths/procedures.js).
   - énoncé : découpage de item.prompt en deux lignes (avant / après le signe = ou ≈) et en jetons
     (nombres, opérateurs, mots, case « … ») → la case du calcul est la zone de réponse ;
   - réponse : valeur attendue, pavé décimal ou non, largeur de la case, contrôle d'une saisie ;
   - sprint : horloge de 60 s qu'on peut mettre en pause (explication, appli en arrière-plan) ;
   - décor : silhouette de pomme (chemin SVG pour une largeur et une hauteur données), places des
     pommes dans le panier, mise en page de la scène (pomme-carte, panier, compagnon sans chevauchement). */

import { fmtNum } from '../core/util.js';

export const HOLE = '…';                 /* « … » : la case à remplir dans item.prompt */
export const NNBSP = '\u202F';               /* espace fine insécable (séparateur de milliers) */
export const NBSP = '\u00A0';
export const SPRINT_MS = 60000;               /* sprint : 60 s */
export const MAX_LEN = 11;                    /* pavé : 9 chiffres + virgule + 1 de marge (jamais la longueur exacte) */
export const BASKET_SLOTS = 12;               /* pommes visibles dans le panier (manche ≤ 12) */
export const CARD_RATIO = 1.32;               /* pomme-carte : largeur / hauteur */
export const LONG_TIP = 84;                   /* astuce longue (caractères) : bulle sans pastille ni encouragement */

const REL_RE = /\s([=≈])\s/;                  /* signe de relation (un seul par énoncé) */
const OP_SET = new Set(['+', '−', '×', '÷', '=', '≈']);

/* ---------- énoncé ---------- */
/* « moitié de 46 = … » → « Moitié de 46 = … » (début de phrase) */
export function displayPrompt(prompt) {
  const s = String(prompt || '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/* une ligne de texte → jetons { k: 'num' | 'op' | 'par' | 'word' | 'hole', t }.
   Les espaces ordinaires séparent les jetons (ils ne sont pas gardés) ; l'espace fine des milliers
   reste dans le nombre (« 1 000 »). */
export function tokenize(text) {
  const out = [];
  const re = /(\d[\d\u202F,]*)|([+\u2212\u00D7\u00F7=\u2248])|([()])|(\u2026)|([^\s\d()+\u2212\u00D7\u00F7=\u2248\u2026]+)/gu;
  let m;
  while ((m = re.exec(String(text || '')))) {
    if (m[1]) out.push({ k: 'num', t: m[1] });
    else if (m[2]) out.push({ k: 'op', t: m[2] });
    else if (m[3]) out.push({ k: 'par', t: m[3] });
    else if (m[4]) out.push({ k: 'hole', t: HOLE });
    else if (m[5]) out.push({ k: 'word', t: m[5] });
  }
  return out;
}

/* jetons → texte (espaces entre jetons, sauf à l'intérieur des parenthèses) */
export function joinTokens(tokens) {
  let s = '';
  tokens.forEach((tk, i) => {
    const prev = tokens[i - 1];
    const glue = i === 0 || (prev && prev.k === 'par' && prev.t === '(') || (tk.k === 'par' && tk.t === ')');
    s += (glue ? '' : ' ') + tk.t;
  });
  return s;
}

/* énoncé → { lines: [jetons avant le signe, jetons du signe et après], rel, holeLine }
   « 47 + 9 = … »  → [47 + 9] [= …]      « 38 + … = 40 » → [38 + …] [= 40]
   Sans signe reconnu : une seule ligne. */
export function promptParts(prompt) {
  const s = displayPrompt(prompt);
  const m = REL_RE.exec(s);
  let lines;
  if (m) {
    const left = s.slice(0, m.index), right = s.slice(m.index + m[0].length);
    lines = [tokenize(left), [{ k: 'op', t: m[1], rel: true }, ...tokenize(right)]];
  } else lines = [tokenize(s)];
  const holeLine = lines.findIndex(l => l.some(t => t.k === 'hole'));
  return { lines, rel: m ? m[1] : null, holeLine };
}

/* texte affiché (pour les tests et les lecteurs d'écran) : redonne l'énoncé */
export function partsText(parts) { return parts.lines.map(joinTokens).join(' '); }

/* lecture à voix haute (aria-label) : « 47 plus 9 égale combien ? » */
export function promptAria(prompt) {
  const words = { '+': 'plus', '\u2212': 'moins', '\u00D7': 'fois', '\u00F7': 'divisé par', '=': 'égale', '\u2248': ', c’est environ' };
  const parts = promptParts(prompt);
  const toks = parts.lines.flat();
  const s = toks.map(t => (t.k === 'op' ? words[t.t] || t.t : t.k === 'hole' ? 'combien' : t.t)).join(' ')
    .replace(/\(\s/g, '(').replace(/\s\)/g, ')').replace(/ ,/g, ',');
  return s.replace(/\u202F/g, ' ') + ' ?';
}

/* « 24 + 24 = 48 » ne se coupe pas en fin de ligne (espaces insécables autour des opérateurs) */
export function keepMath(text) {
  return String(text || '').replace(/(\d|\)) ([+−×÷=≈<>]) (?=[\d(])/g, '$1' + NBSP + '$2' + NBSP);
}

/* explication du générateur → phrases (une par ligne à l'écran ; la conclusion « Donc … » est mise en valeur) */
export function explainSentences(text) {
  const s = String(text || '').trim();
  if (!s) return [];
  return s.split(/(?<=[.!?])\s+(?=[A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜ0-9(])/u).map(t => ({ t, conclusion: /^Donc\b/.test(t) }));
}

/* ---------- réponse ---------- */
const decimalsOf = n => { const s = String(n); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };

/* → { value, decimal, choice, text, raw, len, holeCh, maxLen } */
export function answerInfo(item) {
  const value = Number(item && item.answer);
  const dataDec = item && item.data && Number(item.data.decimals) > 0 ? Number(item.data.decimals) : 0;
  const choice = !!(item && Array.isArray(item.choices) && item.choices.length);
  const decimal = !choice && (dataDec > 0 || !Number.isInteger(value));
  const text = Number.isFinite(value) ? fmtNum(value) : String(item && item.answer);
  const raw = text.replace(/[\s\u00A0\u202F]/g, '');
  /* la case laisse un peu de place en plus (on ne devine pas le nombre de chiffres) */
  const holeCh = Math.max(2, text.length);
  return { value, decimal, decimals: Math.max(dataDec, decimalsOf(value)), choice, text, raw, len: raw.length, holeCh, maxLen: Math.max(MAX_LEN, raw.length + 1) };
}

/* chaîne tapée (« 8,2 », « 1 000 ») → { valid, ok, value } */
export function checkTyped(str, item) {
  const s = String(str ?? '').trim().replace(/[\s\u00A0\u202F]/g, '').replace(',', '.').replace('\u2212', '-');
  if (!/^-?\d+(\.\d*)?$/.test(s)) return { valid: false, ok: false, value: NaN };
  const v = Number(s.replace(/\.$/, ''));
  if (!Number.isFinite(v)) return { valid: false, ok: false, value: NaN };
  const want = Number(item && item.answer);
  const ok = Number.isFinite(want) && Math.abs(v - want) <= 1e-9 * Math.max(1, Math.abs(want));
  return { valid: true, ok, value: v };
}

/* QCM : le choix touché est-il la bonne réponse ? */
export function checkChoice(value, item) {
  const v = Number(value), want = Number(item && item.answer);
  if (Number.isFinite(v) && Number.isFinite(want)) return Math.abs(v - want) <= 1e-9 * Math.max(1, Math.abs(want));
  return String(value) === String(item && item.answer);
}
/* étiquette d'un choix (pour l'afficher dans la case) */
export function choiceLabel(item, value) {
  const c = item && Array.isArray(item.choices) ? item.choices.find(x => checkValue(x.value, value)) : null;
  if (c && typeof c.label === 'string') return c.label;
  return typeof value === 'number' ? fmtNum(value) : String(value);
}
const checkValue = (a, b) => a === b || String(a) === String(b);

/* ligne d'aide affichée au repos sous la pomme */
export function idleText(item) {
  if (item && Array.isArray(item.choices) && item.choices.length) return 'Calcule un ordre de grandeur, puis choisis le nombre le plus proche.';
  return 'Calcule dans ta tête, puis tape ta réponse.';
}

/* variétés de pommes (couleur du bord de la pomme-carte) : rose le plus souvent */
const TONES = ['rose', 'doree', 'rose', 'corail'];
export function toneOf(index) { return TONES[((index | 0) % TONES.length + TONES.length) % TONES.length]; }

/* « pomme » / « pommes » */
export const plural = (n, one, many) => (Math.abs(n) >= 2 ? many : one);

/* ---------- sprint : horloge de 60 s qu'on peut mettre en pause ---------- */
export function createSprintClock(total = SPRINT_MS) {
  const T = Math.max(1, +total || SPRINT_MS);
  let started = false, running = false, acc = 0, since = 0;
  const el = t => Math.min(T, acc + (running ? Math.max(0, t - since) : 0));
  return {
    total: T,
    get started() { return started; },
    get running() { return running; },
    start(t) { if (started) return; started = true; running = true; acc = 0; since = t; },
    pause(t) { if (!running) return; acc = el(t); running = false; },
    resume(t) { if (!started || running || acc >= T) return; running = true; since = t; },
    elapsed: t => el(t),
    remaining: t => Math.max(0, T - el(t)),
    fraction: t => el(t) / T,                       /* 0 → 1 */
    done: t => started && el(t) >= T
  };
}

/* ---------- silhouette de pomme (pomme-carte, pommes du décor) ----------
   Chemin fermé pour une boîte w × h (marge p pour le trait) : deux lobes en haut avec un creux où
   s'attache la queue, flancs arrondis, petit creux en bas. Coordonnées arrondies au dixième. */
const APPLE = [
  ['M', 0.5, 0.14],
  ['C', 0.43, 0.035, 0.34, 0.0, 0.25, 0.012],
  ['C', 0.09, 0.035, 0.0, 0.2, 0.0, 0.43],
  ['C', 0.0, 0.71, 0.13, 0.965, 0.3, 0.995],
  ['C', 0.39, 1.01, 0.45, 0.975, 0.5, 0.965],
  ['C', 0.55, 0.975, 0.61, 1.01, 0.7, 0.995],
  ['C', 0.87, 0.965, 1.0, 0.71, 1.0, 0.43],
  ['C', 1.0, 0.2, 0.91, 0.035, 0.75, 0.012],
  ['C', 0.66, 0.0, 0.57, 0.035, 0.5, 0.14]
];
export const APPLE_TOP = 0.14;                 /* creux du haut (point d'attache de la queue), en fraction de h */
export function applePath(w, h, p = 0) {
  const W = Math.max(1, w - 2 * p), H = Math.max(1, h - 2 * p);
  const r = v => Math.round(v * 10) / 10;
  const pt = (u, v) => r(p + u * W) + ' ' + r(p + v * H);
  return APPLE.map(([c, ...a]) => {
    const pts = [];
    for (let i = 0; i < a.length; i += 2) pts.push(pt(a[i], a[i + 1]));
    return c + ' ' + pts.join(' ');
  }).join(' ') + ' Z';
}
/* boîte intérieure où s'écrit le calcul (fractions de la pomme-carte) */
export const APPLE_INNER = { left: 0.1, right: 0.1, top: 0.2, bottom: 0.1 };

/* ---------- panier : places des pommes (repère du dessin : viewBox 0 -16 120 116) ----------
   Rangée du fond (posée sur le bord avant), puis tas de plus en plus haut ; k-ième pomme → { x, y, r, tilt } */
export function basketSlots(n = BASKET_SLOTS) {
  const rows = [
    { y: 30, xs: [25, 48, 71, 95] },
    { y: 17, xs: [36, 59, 83] },
    { y: 19, xs: [14, 106] },
    { y: 4, xs: [47, 71] },
    { y: -4, xs: [59] }
  ];
  const out = [];
  for (const row of rows) for (const x of row.xs) out.push({ x, y: row.y, r: 11.6, tilt: ((out.length * 37) % 31) - 15 });
  return out.slice(0, Math.max(0, Math.min(n, out.length)));
}

/* ---------- mise en page de la scène (px) ----------
   W × H = taille intérieure de la scène. Feuillage en haut, pomme-carte suspendue au milieu, herbe en bas
   avec le compagnon (à gauche) et le panier (à droite). La pomme-carte ne recouvre jamais le panier ni
   le compagnon ; elle garde son rapport largeur / hauteur (CARD_RATIO). */
export function sceneLayout(W, H) {
  W = Math.max(160, +W || 0); H = Math.max(160, +H || 0);
  const R = Math.round;
  const canopyH = R(Math.max(70, Math.min(H * 0.3, W * 0.42, 230)));
  const grassH = R(Math.max(34, Math.min(H * 0.17, 90)));
  const margin = R(Math.max(6, Math.min(W * 0.03, 16)));
  const basketW = R(Math.max(58, Math.min(W * 0.23, H * 0.27, 128)));
  const basketH = R(basketW * 116 / 120);                  /* anse comprise (viewBox 120 × 116) */
  const heroW = R(Math.max(54, Math.min(basketW * 1.02, 132)));
  const heroH = R(heroW * 0.84);
  const basket = { w: basketW, h: basketH, x: W - margin - basketW, y: H - basketH - R(grassH * 0.1) };
  const hero = { w: heroW, h: heroH, x: margin, y: H - heroH - R(grassH * 0.16) };
  const gap = 8;
  const cardTop = R(Math.max(canopyH * 0.36, 30));
  const maxW = Math.min(W - 2 * margin, 470);
  const fit = (availW, bottom) => {
    const availH = Math.max(40, bottom - cardTop);
    const w = Math.max(80, Math.floor(Math.min(availW, availH * CARD_RATIO)));
    return { w, h: R(w / CARD_RATIO), bottom };
  };
  /* deux possibilités : carte au-dessus du compagnon et du panier (pleine largeur),
     ou carte centrée entre les deux (descend jusqu'à l'herbe) — on garde la plus grande */
  const a = fit(maxW, Math.min(basket.y, hero.y) - gap);
  const half = Math.min(W / 2 - (hero.x + hero.w + gap), basket.x - gap - W / 2);
  const b = half * 2 > 120 ? fit(Math.min(Math.floor(half * 2), maxW), H - R(grassH * 0.45)) : { w: 0 };
  const pick = b.w > a.w ? b : a;
  /* place en trop sous la carte : on la descend un peu (au plus d'un tiers de l'écart) */
  const slack = Math.max(0, pick.bottom - cardTop - pick.h);
  const top = R(cardTop + Math.min(slack / 3, H * 0.06));
  return {
    W, H, canopyH, grassH, margin,
    card: { w: pick.w, h: pick.h, x: R((W - pick.w) / 2), y: top, stem: R(pick.h * 0.12) },
    basket, hero,
    beside: pick === b
  };
}

/* deux rectangles { x, y, w, h } se chevauchent-ils ? */
export function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
