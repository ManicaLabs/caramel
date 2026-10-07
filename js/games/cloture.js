/* ============ LE CHEMIN DE LA CLÔTURE — ma.ligne (docs/JEUX.md §3, contrat docs/ARCHITECTURE.md §7) ============
   Une clôture de ranch en bois sert de ligne graduée : la lisse = la droite, les grands piquets = les
   graduations principales (plaquettes numérotées sous la lisse), les petits piquets = les sous-graduations.
   Le compagnon (ctx.petSVG : espèce, accessoires et stade du profil) attend au départ, sur des bottes de foin.
   - lire   : un drapeau est planté sur un piquet → « Quel nombre se cache sous le drapeau ? » → QCM à 6 choix
              (3 colonnes, fractions en écriture empilée) ou pavé numérique (décimal si fmt 'dec') ;
   - placer : « Place 47 sur la clôture. » → toucher ou glisser la carotte 🥕 sur la lisse (aimantée aux piquets
              si data.snap, sinon à un dixième d'intervalle), loupe pendant le glisser, flèches ‹ › et clavier,
              puis « Valider ✓ » → le compagnon saute en arc jusqu'à la carotte ;
   - zoom   : vraie caméra (viewBox) qui plonge de la ligne principale dans l'intervalle agrandi (dessiné à
              l'intérieur de cet intervalle), puis mini-carte de la ligne principale reliée à la partie agrandie ;
   - juste  : le piquet s'illumine, panneau avec la valeur, paillettes, note qui monte, 🍎 qui vole ;
   - 1re erreur : secousse douce + indice (bulle + petits sauts « +10 » entre les plaquettes qui encadrent) ;
   - 2e erreur  : le compagnon marche jusqu'au bon piquet, la valeur apparaît sur un panneau, explication,
                  « J’ai compris ✓ ».
   - Répondre à voix haute (v2.3, js/ui/voice-answer.js) aux items « lire » : 🎤 dans la case vide du pavé
     (entiers), à gauche de la case réponse (pavé décimal) ou dans la pastille de la scène (QCM) ; la ligne 👂 dans
     cette pastille (dans le ciel, sinon sur l'herbe, jamais sur la clôture). La voix tape la réponse ; ce que le
     micro écoute : L.voicePlan (QCM, nombre, ou piquets de la clôture pour les décimaux) ; une réponse fausse est
     retenue jusqu'à ce que l'enfant se taise (il compte les piquets à voix haute). Micro en pause pour « placer »
     (la voix ne place rien : dire « 23 », c'est lire la consigne), pour les nombres ≥ 100 000 et pendant
     l'explication.
   Déroulé d'un item : contrat §7.3 (référence : tests/harness/demo-game.js). Logique pure : cloture-logic.js.
   Tout le dessin est en SVG à l'échelle du pixel (viewBox = taille réelle, redessiné si la largeur change). */

import { h, svg, clear, frTypo, fmtNum } from '../core/util.js';
import { fracWords } from '../content/maths/ligne.js';
import { createVoiceAnswer } from '../ui/voice-answer.js';
import { dlog } from '../core/debuglog.js';
import * as L from './cloture-logic.js';

const PAD = 8;              /* marge intérieure totale d'une plaquette (px) */
const FEET = 0.74;          /* hauteur des sabots dans le dessin du compagnon (× largeur) */
const CARROT_HALF = 8.5;    /* demi-largeur du corps de la carotte posée sur la lisse (carrotShape, échelle 1) */
const WIDE_PX = 640;        /* au-delà (largeur de scène), tailles « grand écran » */
let inst = null, seq = 0;

export default {
  id: 'cloture', title: 'Le Chemin de la clôture', icon: '📏', axes: ['ma.ligne'],
  css: 'css/games/cloture.css',
  async mount(root, ctx) {
    if (inst) inst.destroy();
    inst = createCloture(root, ctx);
    await inst.start();
  },
  unmount() {
    if (inst) inst.destroy();
    inst = null;
  }
};

/* ---------- petits outils (DOM à l'appel uniquement) ---------- */
const f2 = v => Math.round(v * 100) / 100;
function safe(fn) { try { return fn(); } catch (e) { console.error(e); return undefined; } }
function words(n, d) { try { return fracWords(n, d); } catch (_) { return n + ' sur ' + d; } }
/* fraction empilée (HTML) : numérateur, barre, dénominateur ; lue « trois quarts » */
function fracNode(n, d, cls) {
  return h('span', { class: 'cl-frac' + (cls ? ' ' + cls : '') },
    h('span', { class: 'cl-frac-n', 'aria-hidden': 'true' }, String(n)),
    h('span', { class: 'cl-frac-d', 'aria-hidden': 'true' }, String(d)),
    h('span', { class: 'sr-only' }, words(n, d)));
}
/* texte des bulles et consignes : fractions empilées, opérations insécables */
function richText(str) {
  const frag = document.createDocumentFragment();
  for (const t of L.splitFrac(str)) frag.append(t.t === 'frac' ? fracNode(t.n, t.d) : htmlNum(L.keepMath(t.s)));
  return frag;
}
/* même texte pour les lecteurs d'écran (fractions en toutes lettres) */
function spoken(str) { return L.splitFrac(str).map(t => (t.t === 'frac' ? words(t.n, t.d) : t.s)).join(''); }

/* largeur d'un libellé pour une police de 100 px (Fredoka 600), mesurée une fois */
const widths = new Map();
let c2d;
function textW(text, weight = 600) {
  const k = weight + '|' + text;
  if (widths.has(k)) return widths.get(k);
  let w = 0;
  try {
    if (c2d === undefined) c2d = document.createElement('canvas').getContext('2d') || null;
    if (c2d) { c2d.font = weight + ' 100px Fredoka, "Segoe UI", system-ui, sans-serif'; w = c2d.measureText(String(text)).width; }
  } catch (_) { w = 0; }
  if (!(w > 0)) w = L.estimateWidth100(text);
  widths.set(k, w);
  return w;
}

/* nombres : l'espace fine des milliers de Fredoka est très étroite (0,12 em) ; on l'élargit un peu
   (+0,14 em) pour que les enfants voient les classes (750 800 000) */
const GAP_EM = 0.14;
const groupsOf = text => String(text).split('\u202f');
function numW(text, weight = 600) { return textW(text, weight) + (groupsOf(text).length - 1) * GAP_EM * 100; }
function svgNum(attrs, text, fs) {
  const t = svg('text', attrs);
  groupsOf(text).forEach((p, i) => { if (i === 0) t.append(p); else t.append(svg('tspan', { dx: f2(fs * GAP_EM) }, '\u202f' + p)); });
  return t;
}
/* même chose en HTML (consignes, bulles, choix) */
function htmlNum(str) {
  const frag = document.createDocumentFragment(), s = String(str), re = /(\d)\u202f(?=\d)/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    frag.append(s.slice(last, m.index + 1), h('span', { class: 'cl-nn' }, '\u202f'));
    last = m.index + 2;
  }
  frag.append(s.slice(last));
  return frag;
}

/* ---------- formes SVG ---------- */
function postPath(x, top, w, bottom) {
  const r = w / 2;
  return `M${f2(x - r)} ${f2(bottom)}V${f2(top + r)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(x + r)} ${f2(top + r)}V${f2(bottom)}Z`;
}
/* carotte pointe en bas, pointe en (0, 0) */
function carrotShape(c = 1) {
  const p = (...a) => a.map(v => f2(v * c)).join(' ');
  return svg('g', { class: 'cl-carrot-s' },
    svg('path', { class: 'cl-leaf', d: `M${p(0, -24)}C${p(-10, -29)} ${p(-12, -37)} ${p(-7, -41)}C${p(-4, -35)} ${p(-2, -30)} ${p(0, -26)}Z` }),
    svg('path', { class: 'cl-leaf', d: `M${p(0, -24)}C${p(10, -29)} ${p(12, -37)} ${p(7, -41)}C${p(4, -35)} ${p(2, -30)} ${p(0, -26)}Z` }),
    svg('path', { class: 'cl-leaf is-mid', d: `M${p(0, -24)}C${p(-3, -32)} ${p(-1, -41)} ${p(2, -44)}C${p(4, -37)} ${p(3, -30)} ${p(0, -25)}Z` }),
    svg('path', { class: 'cl-carrot-body', d: `M${p(0, 0)}C${p(-3, -7)} ${p(-8.5, -17)} ${p(-8, -22)}C${p(-7.5, -27.5)} ${p(7.5, -27.5)} ${p(8, -22)}C${p(8.5, -17)} ${p(3, -7)} ${p(0, 0)}Z` }),
    svg('path', { class: 'cl-carrot-line', d: `M${p(-5.5, -18)}l${p(4, 1.2)}M${p(1.5, -12.5)}l${p(3.2, -1)}M${p(-3.2, -7.5)}l${p(2.8, 0.9)}M${p(2, -21)}l${p(3.4, -0.6)}` }));
}
/* petite carotte tenue dans la bouche du compagnon (pointe vers l'avant) */
function mouthCarrot() {
  return svg('svg', { class: 'cl-mouth-svg', viewBox: '-46 -11 50 22', width: 40, height: 18, 'aria-hidden': 'true', focusable: 'false' },
    svg('g', { transform: 'rotate(-90)' }, carrotShape(1)));
}
function chevron(dir) {
  return svg('svg', { viewBox: '0 0 24 24', width: 26, height: 26, 'aria-hidden': 'true', focusable: 'false' },
    svg('path', { d: dir < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7', fill: 'none', stroke: 'currentColor', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}
/* fraction empilée en SVG, centrée en (x, y) */
function svgFrac(x, y, n, d, fs, cls) {
  const w = Math.max(String(n).length, String(d).length) * fs * 0.62 + fs * 0.3;
  return svg('g', { class: cls },
    svg('text', { x: f2(x), y: f2(y - fs * 0.56), 'font-size': fs, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, String(n)),
    svg('line', { class: 'cl-fbar', x1: f2(x - w / 2), x2: f2(x + w / 2), y1: f2(y), y2: f2(y), 'stroke-width': Math.max(1.4, fs / 9) }),
    svg('text', { x: f2(x), y: f2(y + fs * 0.62), 'font-size': fs, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, String(d)));
}

/* ======================================================================================== */
function createCloture(root, ctx) {
  /* voix du compagnon (petits lecteurs, js/ui/voice.js) : la consigne, l'indice, l'explication ; le texte reste affiché */
  const say = t => { try { return ctx.voice ? Promise.resolve(ctx.voice.say(String(t || ''), { quiet: va.wanted() })) : Promise.resolve(false); } catch (_) { return Promise.resolve(false); } };
  const hush = () => { try { if (ctx.voice) ctx.voice.hush(); } catch (_) {} };
  let placeN = 0;            /* carottes à placer déjà proposées dans la manche : la ligne du geste n'est montrée qu'à la 1re */
  const M = ctx.motion, K = ctx.kit, AU = ctx.audio;
  const uid = 'cl' + (++seq);
  let alive = true, token = 0;

  /* ---------- tout ce qu'il faut nettoyer au démontage ---------- */
  const timers = new Set(), rafs = new Set(), anims = new Set(), offs = [];
  let clip = null, ro = null, kp = null, grid = null, resizeRaf = 0, repeat = null;
  const later = (fn, ms) => {
    const t = setTimeout(() => { timers.delete(t); if (alive) safe(fn); }, ms);
    timers.add(t);
    return t;
  };
  /* minuterie propre à l'item en cours (ignorée si l'item a changé) */
  const laterItem = (fn, ms) => { const tok = token; return later(() => { if (tok === token) fn(); }, ms); };
  const raf = fn => {
    const r = requestAnimationFrame(ts => { rafs.delete(r); if (alive) safe(() => fn(ts)); });
    rafs.add(r);
    return r;
  };
  const keep = a => {
    if (a) {
      anims.add(a);
      const done = () => anims.delete(a);
      try { a.finished.then(done, done); } catch (_) {}
    }
    return a;
  };
  const anim = (el, kf, opts) => { try { return keep(el.animate(kf, opts)); } catch (_) { return null; } };
  const on = (el, type, fn, opts) => { el.addEventListener(type, fn, opts); offs.push(() => el.removeEventListener(type, fn, opts)); };
  const stopClip = () => { if (clip) { safe(() => clip.stop()); clip = null; } };
  const finished = (a, ms) => new Promise(res => {
    let ok = false;
    const go = () => { if (!ok) { ok = true; res(); } };
    if (a && a.finished) a.finished.then(go, go);
    later(go, ms + 80);
  });

  /* ---------- DOM ---------- */
  const promptEl = h('div', { class: 'cl-prompt' });
  const subEl = h('div', { class: 'cl-sub' });
  const head = h('div', { class: 'cl-head' }, promptEl, subEl);
  const bg = svg('svg', { class: 'cl-bg', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMinYMin slice' });
  const fence = svg('svg', { class: 'cl-fence', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMinYMin slice' });
  const mountIn = h('div', { class: 'cl-mount-in' });
  const mouth = h('div', { class: 'cl-mouth hidden' }, mouthCarrot());
  const mountFlip = h('div', { class: 'cl-mount-flip' }, mountIn, mouth);
  const mountBox = h('div', { class: 'cl-mount', 'aria-hidden': 'true' }, mountFlip);
  const floatEl = h('div', { class: 'cl-float' });          /* bulle posée sur l'herbe, sous la clôture */
  const scene = h('div', { class: 'cl-scene' }, bg, fence, mountBox, floatEl);
  const help = h('div', { class: 'cl-help' });
  const answer = h('div', { class: 'cl-answer' });
  const wrap = h('div', { class: 'cl' }, head, scene, help, answer);
  /* répondre à voix haute (v2.3) : la ligne 👂 (et le 🎤 des choix) dans une pastille posée sur la scène (placeVoiceBar) :
     rien ne bouge quand le micro s'allume ; un toucher sur la pastille ne pose pas la carotte */
  const va = createVoiceAnswer(ctx, {
    onNumber: (v, right) => voiceAnswer(v, right ? 'now' : L.voiceVerdict(v, item && item.answer, heldV, voiceRule), 0),
    onChoice: v => voiceAnswer(v, L.voiceVerdict(v, item && item.answer, heldV, voiceRule), L.VOICE_HOLD_MS),
    onProblem: msg => { if (alive && phase === 'answer') { if (bubbleEl) K.toast(msg); else setBubble(msg, 'soft', '🎙️'); } },
    onChange: () => syncVoiceBar()
  });
  const vaBar = h('div', { class: 'va-row cl-voice' }, va.ear, va.dbg);
  scene.append(vaBar);
  for (const type of ['pointerdown', 'keydown']) on(vaBar, type, e => e.stopPropagation());

  /* ancres du compagnon (bouche…) à son stade, en unités du viewBox (× S / 100 pour des px) */
  const anchors = (() => { try { return ctx.petAnchors(); } catch (_) { return null; } })();
  const mouthUnits = () => (anchors && Array.isArray(anchors.mouth) ? anchors.mouth : [78, 40.2]);

  /* ---------- état ---------- */
  let item = null, D = null;
  let phase = 'idle';            /* 'answer' | 'busy' | 'learn' | 'end' */
  let tries = 0, hinted = false, hintShown = false, t0 = 0;
  let marker = null, lastWrong = null, revealed = false, stepHint = false, showMid = false, ghost = null;
  let zoomDone = true, diving = false;
  let W = 0, H = 0, wide = false, lay = null, keepLift = null, compact = false, wrapH = 0;
  let scMain = null, scAct = null, fontMain = 13, fontAct = 13, cam = null;
  let act = null, gMain = null, world = null, gHops = null, gFlag = null, gCarrot = null, gSign = null, loupe = null, loupeUse = null;
  let svgRoot = null, mountS = 0, mpos = { kind: 'bale' }, facing = 1;
  const arcAnims = [];           /* saut en cours : corps, carotte tenue, ombre (arcLift) */
  let dragging = null, lastTick = 0, okBtn = null, prevBtn = null, nextBtn = null;
  /* voix : réponse de l'item précédent, réponse fausse retenue (minuterie, valeur, instant), dernière voix entendue */
  let prevAnswer = null, held = 0, heldV = null, heldAt = 0, voiceRule = {}, lastVoiceAt = 0, offVoice = null;
  let voiceKind = 'pause', forgot = true, lastTap = 0;

  const mainPlane = () => D;
  const actPlane = () => (D && D.zoom ? D.zoom : D);
  const placing = () => D && D.mode === 'placer';
  const canPlace = () => alive && placing() && phase === 'answer' && zoomDone && !diving;

  /* ================= MISE EN PAGE ET DESSIN ================= */
  function measure() {
    W = Math.round(scene.clientWidth);
    H = Math.round(scene.clientHeight);
    wide = W >= WIDE_PX;
  }
  function planeFont(plane, sc) {
    return L.fitLabelFont(plane.labels.map(l => sc.toX(l.v)), plane.labels.map(l => numW(l.text)),
      { pad: PAD, gap: 3, min: 11, max: wide ? 21 : 18 });
  }
  /* bornes de la clôture : départ après la place du compagnon ; les plaquettes des bouts restent dans la scène */
  function scalesFor(planes) {
    const edge = 2;                                /* une plaquette ne sort jamais de la scène (elle peut passer devant le foin) */
    /* téléphone : la dernière graduation à 28 px du bord, loin du geste « retour » d'Android (D1-09) */
    let x0 = lay.left, x1 = W - (wide ? 22 : 28);
    for (let pass = 0; pass < 3; pass++) {
      let over = 0, under = 0;
      for (const p of planes) {
        const sc = L.makeScale(p.min, p.max, x0, x1), f = planeFont(p, sc);
        for (const l of p.labels) {
          const half = (numW(l.text) * f / 100 + PAD) / 2, x = sc.toX(l.v);
          over = Math.max(over, x + half + 4 - W);
          under = Math.max(under, edge + 3 - (x - half));
        }
      }
      if (over <= 0.5 && under <= 0.5) break;
      if (over > 0.5) x1 -= over;
      if (under > 0.5) x0 += under;
    }
    return planes.map(p => { const sc = L.makeScale(p.min, p.max, x0, x1); return { sc, f: planeFont(p, sc) }; });
  }
  function renderAll() {
    measure();
    if (!D || W < 40 || H < 40) return;
    lay = L.sceneLayout(W, H, { zoom: !!D.zoom, wide, lift: keepLift, compact });
    keepLift = lay.lift;
    if (D.zoom) {
      const [a, b] = scalesFor([D, D.zoom]);
      scMain = a.sc; fontMain = a.f; scAct = b.sc; fontAct = b.f;
      cam = L.camera({ W, H, x0: scAct.x0, x1: scAct.x1, X1: scMain.toX(D.zoom.min), X2: scMain.toX(D.zoom.max), yRail: lay.yRail });
    } else {
      const [a] = scalesFor([D]);
      scMain = scAct = a.sc; fontMain = fontAct = a.f; cam = null;
    }
    ensureMount();
    drawBg();
    drawWorld();
    placeMount();
    if (bubbleEl) placeBubble();
    else placeVoiceBar();
  }

  /* ---------- décor : soleil, nuages, collines, pré, fleurs, bottes de foin ---------- */
  function drawBg() {
    clear(bg);
    bg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const gid = uid + '-grass';
    bg.append(svg('defs', null, svg('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
      svg('stop', { offset: '0', class: 'cl-g1' }), svg('stop', { offset: '1', class: 'cl-g2' }))));
    const sx = W - (wide ? 58 : 36), sy = wide ? 34 : 24;
    bg.append(svg('circle', { class: 'cl-sun-halo', cx: sx, cy: sy, r: wide ? 32 : 23 }),
      svg('circle', { class: 'cl-sun', cx: sx, cy: sy, r: wide ? 20 : 14 }));
    const cloud = (x, y, s, i) => svg('g', { transform: `translate(${f2(x)} ${f2(y)}) scale(${s})` },
      svg('g', { class: 'cl-cloud cl-cloud-' + i },
        svg('ellipse', { cx: 0, cy: 0, rx: 22, ry: 9 }), svg('circle', { cx: -8, cy: -6, r: 9 }), svg('circle', { cx: 7, cy: -8, r: 11 })));
    bg.append(cloud(W * 0.16, lay.A + 18 + lay.lift * 0.15, wide ? 1.2 : 0.9, 1), cloud(W * 0.58, lay.A + 40 + lay.lift * 0.45, wide ? 0.95 : 0.7, 2));
    if (lay.lift > 70) bg.append(cloud(W * 0.8, lay.A + 26 + lay.lift * 0.75, wide ? 0.8 : 0.6, 3));
    const yh = lay.yRail - 4;
    bg.append(
      svg('path', { class: 'cl-hill-2', d: `M0 ${f2(yh + 26)}C${f2(W * 0.18)} ${f2(yh - 10)} ${f2(W * 0.42)} ${f2(yh - 8)} ${f2(W * 0.62)} ${f2(yh + 24)}L${f2(W * 0.62)} ${H}L0 ${H}Z` }),
      svg('path', { class: 'cl-hill', d: `M${f2(W * 0.34)} ${f2(yh + 32)}C${f2(W * 0.55)} ${f2(yh - 16)} ${f2(W * 0.84)} ${f2(yh - 20)} ${W} ${f2(yh + 6)}L${W} ${H}L${f2(W * 0.34)} ${H}Z` }));
    const ym = lay.yRail + (wide ? 50 : 44);
    bg.append(svg('path', { fill: `url(#${gid})`, d: `M0 ${f2(ym + 6)}C${f2(W * 0.25)} ${f2(ym - 5)} ${f2(W * 0.5)} ${f2(ym + 8)} ${f2(W * 0.75)} ${f2(ym)}S${W} ${f2(ym + 2)} ${W} ${f2(ym + 2)}L${W} ${H}L0 ${H}Z` }));
    /* le chemin de terre qui part des bottes de foin et descend vers nous */
    const deep = H - lay.yGround;
    if (deep > 46) {
      const sx = lay.left - 6, sy = lay.yGround + 6, ex = W * (wide ? 0.62 : 0.6), ey = H + 6;
      const we = Math.min(wide ? 150 : 96, W * 0.26);
      const c1 = { x: W * 0.36, y: lay.yGround + 12 }, c2 = { x: W * 0.3, y: H - deep * 0.3 };
      bg.append(svg('path', { class: 'cl-path',
        d: `M${f2(sx - 2)} ${f2(sy - 3)}C${f2(c1.x - 6)} ${f2(c1.y - 6)} ${f2(c2.x - we * 0.42)} ${f2(c2.y)} ${f2(ex - we / 2)} ${f2(ey)}` +
           `L${f2(ex + we / 2)} ${f2(ey)}C${f2(c2.x + we * 0.5)} ${f2(c2.y - 4)} ${f2(c1.x + 10)} ${f2(c1.y + 8)} ${f2(sx + 2)} ${f2(sy + 4)}Z` }));
      for (let i = 0; i < 5; i++) {
        const t = (i + 0.6) / 5.4, x = sx + (ex - sx) * t + (i % 2 ? -1 : 1) * we * 0.12 * t, y = sy + (ey - sy) * t * t;
        if (y < H - 4) bg.append(svg('ellipse', { class: 'cl-pebble', cx: f2(x), cy: f2(y), rx: f2(2 + 3 * t), ry: f2(1.3 + 1.8 * t) }));
      }
    }
    /* touffes d'herbe */
    for (let i = 0; i < Math.round(W / 70); i++) {
      const x = ((i * 0.381966 + 0.05) % 1) * (W - 30) + 15, y = lay.yGround + 14 + ((i * 0.7548 + 0.2) % 1) * Math.max(0, deep - 24);
      if (y > H - 4 || x < lay.left) continue;
      bg.append(svg('path', { class: 'cl-tuft', d: `M${f2(x - 6)} ${f2(y)}q2 -7 4 -1q2 -9 4 0q2 -7 4 1` }));
    }
    /* un pommier au premier plan quand le pré est grand */
    if (deep >= 230) {
      const tx = W - (wide ? 90 : 50), base = H - 10, k = wide ? 1.25 : 1;
      bg.append(svg('g', { class: 'cl-tree' },
        svg('ellipse', { class: 'cl-bale-shadow', cx: tx, cy: base, rx: 30 * k, ry: 5 }),
        svg('rect', { class: 'cl-trunk', x: f2(tx - 5 * k), y: f2(base - 40 * k), width: f2(10 * k), height: f2(40 * k), rx: 3 }),
        svg('circle', { class: 'cl-crown', cx: tx, cy: f2(base - 66 * k), r: f2(27 * k) }),
        svg('circle', { class: 'cl-crown', cx: f2(tx - 21 * k), cy: f2(base - 50 * k), r: f2(18 * k) }),
        svg('circle', { class: 'cl-crown', cx: f2(tx + 21 * k), cy: f2(base - 50 * k), r: f2(18 * k) }),
        svg('circle', { class: 'cl-crown-hi', cx: f2(tx - 8 * k), cy: f2(base - 76 * k), r: f2(9 * k) }),
        ...[[-12, -60], [10, -72], [16, -48], [-22, -44], [2, -52]].map(([dx, dy]) =>
          svg('circle', { class: 'cl-apple', cx: f2(tx + dx * k), cy: f2(base + dy * k), r: f2(3.6 * k) }))));
    }
    /* fleurs (positions fixes) */
    const n = Math.round(W / 38), top = lay.yGround + 8, bottom = H - 7;
    if (bottom > top + 4) {
      for (let i = 0; i < n; i++) {
        const x = ((i * 0.61803 + 0.17) % 1) * (W - 20) + 10;
        if (x < lay.left - 4) continue;
        const y = top + (((i * 0.4142 + 0.3) % 1) * (bottom - top));
        const c = i % 3 === 0 ? 'w' : '';
        const r = wide ? 3 : 2.4;
        bg.append(svg('g', { class: 'cl-flower' },
          ...[[0, -r], [r, 0], [0, r], [-r, 0]].map(([dx, dy]) => svg('circle', { class: 'cl-fl-p ' + c, cx: f2(x + dx), cy: f2(y + dy), r })),
          svg('circle', { class: 'cl-fl-c', cx: f2(x), cy: f2(y), r: r * 0.8 })));
      }
    }
    /* bottes de foin du départ (le compagnon se tient dessus) */
    const bx = 4, bw = lay.left - 14, yTop = lay.yRail - 4, yBot = lay.yGround + 6;
    const h1 = Math.round((yBot - yTop) * 0.5);
    const bale = (x, y, w, hh) => svg('g', { class: 'cl-bale-g' },
      svg('rect', { class: 'cl-bale', x, y, width: w, height: hh, rx: 7 }),
      svg('path', { class: 'cl-straw', d: `M${x + 7} ${y + hh * 0.3}h${w * 0.22}M${x + w * 0.55} ${y + hh * 0.42}h${w * 0.25}M${x + 9} ${y + hh * 0.7}h${w * 0.3}M${x + w * 0.6} ${y + hh * 0.78}h${w * 0.2}` }),
      svg('rect', { class: 'cl-twine', x: x + w * 0.3 - 1.5, y: y + 1, width: 3, height: hh - 2 }),
      svg('rect', { class: 'cl-twine', x: x + w * 0.7 - 1.5, y: y + 1, width: 3, height: hh - 2 }));
    bg.append(svg('ellipse', { class: 'cl-bale-shadow', cx: bx + bw / 2, cy: yBot, rx: bw / 2 + 4, ry: 4 }),
      bale(bx, yTop + h1 - 2, bw, yBot - yTop - h1 + 2), bale(bx + 4, yTop, bw - 8, h1));
  }

  /* ---------- une portion de clôture : lisses, piquets, plaquettes ---------- */
  function drawPlane(plane, sc, font, zband) {
    const g = svg('g', { class: 'cl-plane' });
    const ps = L.posts(plane);
    const xa = sc.toX(plane.min) - 9, xb = sc.toX(plane.max) + 9, rh = lay.railH;
    g.append(svg('rect', { class: 'cl-shadow', x: f2(xa), y: lay.yGround - 2.5, width: f2(xb - xa), height: 5, rx: 2.5 }),
      svg('rect', { class: 'cl-rail2', x: f2(xa + 3), y: lay.yRail2 - 3.5, width: f2(xb - xa - 6), height: 7, rx: 3.5 }));
    const postEls = [];
    for (const p of ps) {
      const el = svg('path', { class: 'cl-post' + (p.major ? ' is-major' : ''),
        d: postPath(sc.toX(p.v), p.major ? lay.bigTop : lay.smallTop, p.major ? lay.bigW : lay.smallW, lay.yGround) });
      postEls.push(el);
      g.append(el);
    }
    g.append(svg('rect', { class: 'cl-rail', x: f2(xa), y: lay.yRail - rh / 2, width: f2(xb - xa), height: rh, rx: rh / 2 }),
      svg('rect', { class: 'cl-rail-hi', x: f2(xa + 5), y: lay.yRail - rh / 2 + 2, width: f2(Math.max(0, xb - xa - 10)), height: 2, rx: 1 }));
    if (zband) {
      const X1 = sc.toX(zband.min), X2 = sc.toX(zband.max);
      g.append(svg('rect', { class: 'cl-zband', x: f2(X1 - 3), y: lay.bigTop - 7, width: f2(X2 - X1 + 6), height: lay.yRail2 - lay.bigTop + 12, rx: 6 }));
    }
    const gl = svg('g', { class: 'cl-labels' }), labelEls = new Map();
    for (const l of plane.labels) {
      const x = sc.toX(l.v), bw = numW(l.text) * font / 100 + PAD, bh = font + 9;
      const lg = svg('g', { class: 'cl-label' },
        svg('rect', { class: 'cl-board', x: f2(x - bw / 2), y: f2(lay.yLabel - bh / 2), width: f2(bw), height: bh, rx: 4 }),
        svgNum({ class: 'cl-board-t', x: f2(x), y: f2(lay.yLabel + 0.5), 'font-size': font, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, l.text, font));
      labelEls.set(L.postIndex(plane, l.v), lg);
      gl.append(lg);
    }
    g.append(gl);
    return { g, ps, postEls, labelEls, plane, sc };
  }
  const topOf = v => (L.isMultiple(v, actPlane().major) ? lay.bigTop : lay.smallTop);

  function drawWorld() {
    clear(fence);
    fence.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const lw = loupeW(), lh = loupeH();
    fence.append(svg('defs', null,
      svg('filter', { id: uid + '-glow', x: '-200%', y: '-60%', width: '500%', height: '220%' },
        svg('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: 3.4, result: 'b' }),
        svg('feFlood', { class: 'cl-glow-flood', result: 'c' }),
        svg('feComposite', { in: 'c', in2: 'b', operator: 'in', result: 'g' }),
        svg('feMerge', null, svg('feMergeNode', { in: 'g' }), svg('feMergeNode', { in: 'g' }), svg('feMergeNode', { in: 'SourceGraphic' }))),
      svg('clipPath', { id: uid + '-lc' }, svg('rect', { x: -lw / 2 + 1.5, y: -lh / 2 + 1.5, width: lw - 3, height: lh - 3, rx: lh / 2 - 1.5 }))));
    if (D.zoom && zoomDone) fence.append(drawMini());
    world = svg('g', { id: uid + '-world' });
    gMain = null;
    if (D.zoom && !zoomDone) {
      gMain = drawPlane(D, scMain, fontMain, D.zoom).g;
      world.append(gMain);
    }
    act = drawPlane(actPlane(), scAct, fontAct, null);
    if (D.zoom && !zoomDone) {
      act.g.setAttribute('transform', `translate(${f2(cam.sub.tx)} ${f2(cam.sub.ty)}) scale(${cam.sub.s})`);
      act.g.style.opacity = '0';
    }
    world.append(act.g);
    gHops = svg('g', { class: 'cl-hops' });
    act.g.append(gHops);
    if (stepHint) drawHops(false);
    if (showMid) drawMid();
    gFlag = gCarrot = gSign = null;
    if (D.mode === 'lire') drawFlag();
    else drawCarrot();
    if (revealed) { drawSign(false); glowAt(D.value, true); }
    fence.append(world);
    /* loupe (glisser de la carotte) : une lentille large, car c'est la position horizontale qui compte */
    loupeUse = svg('use', { href: '#' + uid + '-world' });
    const pill = (cls, dy = 0, inset = 0) => svg('rect', { class: cls, x: -lw / 2 + inset, y: -lh / 2 + inset + dy, width: lw - 2 * inset, height: lh - 2 * inset, rx: lh / 2 - inset });
    loupe = svg('g', { class: 'cl-loupe', opacity: 0 },
      pill('cl-loupe-shadow', 3), pill('cl-loupe-bg'),
      svg('g', { 'clip-path': `url(#${uid}-lc)` }, loupeUse),
      pill('cl-loupe-ring', 0, 1.5),
      svg('path', { class: 'cl-loupe-tip', d: `M-7 ${f2(lh / 2 - 1)}L0 ${f2(lh / 2 + 7)}L7 ${f2(lh / 2 - 1)}Z` }));
    fence.append(loupe);
    describe();
  }

  /* ---------- mini-carte de la ligne principale (après le zoom) ---------- */
  function drawMini() {
    const g = svg('g', { class: 'cl-mini' });
    const mp = mainPlane(), z = D.zoom;
    const mx0 = W * (wide ? 0.3 : 0.24), mx1 = W * (wide ? 0.7 : 0.76);
    const ms = L.makeScale(mp.min, mp.max, mx0, mx1);
    const ym = Math.round(lay.A * 0.38 + lay.lift * 0.5);
    const X1 = ms.toX(z.min), X2 = ms.toX(z.max), yb = lay.bigTop - 6;
    g.append(svg('path', { class: 'cl-beam', d: `M${f2(X1)} ${ym + 7}L${f2(X2)} ${ym + 7}L${f2(scAct.x1)} ${yb}L${f2(scAct.x0)} ${yb}Z` }),
      svg('path', { class: 'cl-beam-e', d: `M${f2(X1)} ${ym + 7}L${f2(scAct.x0)} ${yb}M${f2(X2)} ${ym + 7}L${f2(scAct.x1)} ${yb}` }),
      svg('rect', { class: 'cl-mini-rail', x: f2(mx0 - 5), y: ym - 2.5, width: f2(mx1 - mx0 + 10), height: 5, rx: 2.5 }));
    for (const p of L.posts(mp)) {
      const x = ms.toX(p.v), t = p.major ? 6.5 : 4;
      g.append(svg('line', { class: 'cl-mini-tick', x1: f2(x), x2: f2(x), y1: ym - t, y2: ym + t }));
    }
    g.append(svg('rect', { class: 'cl-mini-band', x: f2(X1 - 1.5), y: ym - 8, width: f2(X2 - X1 + 3), height: 16, rx: 3 }));
    for (const l of mp.labels) {
      g.append(svgNum({ class: 'cl-mini-t', x: f2(ms.toX(l.v)), y: ym + 17, 'font-size': wide ? 14 : 12, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, l.text, wide ? 14 : 12));
    }
    return g;
  }

  /* ---------- drapeau (lire) ---------- */
  function drawFlag() {
    const x = scAct.toX(D.value), base = topOf(D.value), top = lay.flagTop;
    const s = wide ? 1.2 : 1;
    const cloth = svg('g', { class: 'cl-cloth-g' },
      svg('path', { class: 'cl-cloth', d: `M${f2(x + 1)} ${f2(top + 2 * s)}C${f2(x + 12 * s)} ${f2(top - 1 * s)} ${f2(x + 22 * s)} ${f2(top + 5 * s)} ${f2(x + 31 * s)} ${f2(top + 11 * s)}C${f2(x + 22 * s)} ${f2(top + 16 * s)} ${f2(x + 12 * s)} ${f2(top + 19 * s)} ${f2(x + 1)} ${f2(top + 22 * s)}Z` }),
      svg('text', { class: 'cl-cloth-q', x: f2(x + 12 * s), y: f2(top + 11.5 * s), 'font-size': 14 * s, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, '?'));
    gFlag = svg('g', { class: 'cl-flag' + (revealed ? ' is-done' : '') },
      svg('line', { class: 'cl-pole', x1: f2(x), x2: f2(x), y1: f2(base + 2), y2: f2(top) }),
      svg('circle', { class: 'cl-knob', cx: f2(x), cy: f2(top - 1), r: 3.2 * s }),
      cloth);
    act.g.append(gFlag);
  }

  /* ---------- carotte (placer) ---------- */
  const tipY = () => lay.tipY;
  function drawCarrot() {
    const len = lay.yRail - lay.railH / 2 - tipY();
    gCarrot = svg('g', { class: 'cl-carrot' + (marker === null ? ' hidden' : '') },
      svg('line', { class: 'cl-needle', x1: 0, x2: 0, y1: 2, y2: f2(len) }),
      svg('circle', { class: 'cl-needle-dot', cx: 0, cy: f2(len), r: 2.4 }),
      svg('g', { class: 'cl-carrot-in' }, carrotShape(wide ? 1.2 : 1)));
    if (ghost !== null) {
      act.g.append(svg('g', { class: 'cl-ghost', transform: `translate(${f2(scAct.toX(ghost))} ${f2(tipY())})` }, carrotShape(wide ? 1.2 : 1)));
    }
    act.g.append(gCarrot);
    if (marker !== null) moveCarrot(marker);
    mouth.classList.toggle('hidden', !(marker === null && !revealed && phase !== 'learn'));
  }
  function moveCarrot(v) {
    if (!gCarrot) return;
    gCarrot.setAttribute('transform', `translate(${f2(scAct.toX(v))} ${f2(tipY())})`);
    if (D.snap && act) {
      const i = L.postIndex(actPlane(), v);
      act.postEls.forEach((el, k) => el.classList.toggle('is-sel', k === i && !revealed));
    }
  }

  /* ---------- panneau de la valeur (réponse montrée ou trouvée) ---------- */
  function drawSign(animate) {
    if (gSign) gSign.remove();
    const x = scAct.toX(D.value), yPost = topOf(D.value);
    const fs = wide ? 22 : 18, frac = D.fmt === 'frac';
    const tw = frac ? Math.max(String(D.num).length, String(D.den).length) * fs * 0.62 + fs * 0.3 : numW(D.text, 700) * fs / 100;
    const bw = tw + (wide ? 26 : 20), bh = frac ? fs * 2 + 14 : fs + 14;
    const ySign = lay.signY - (frac ? 6 : 0);
    const bx = L.clamp(x, bw / 2 + 4, W - bw / 2 - 4);
    const board = svg('g', { class: 'cl-sign-board' },
      svg('rect', { class: 'cl-sign-b', x: f2(bx - bw / 2), y: f2(ySign - bh / 2), width: f2(bw), height: f2(bh), rx: 8 }),
      frac ? svgFrac(bx, ySign, D.num, D.den, fs, 'cl-sign-t')
        : svgNum({ class: 'cl-sign-t', x: f2(bx), y: f2(ySign + 0.5), 'font-size': fs, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, D.text, fs));
    gSign = svg('g', { class: 'cl-sign' },
      svg('line', { class: 'cl-pole', x1: f2(x), x2: f2(x), y1: f2(yPost + 2), y2: f2(ySign + bh / 2 - 1) }), board);
    act.g.append(gSign);
    if (gFlag) gFlag.classList.add('is-done');
    if (animate) M.enter(board, { from: 'scale', dur: 420 });
    return board;
  }
  function glowAt(v, on2) {
    if (!act) return null;
    const i = L.postIndex(actPlane(), v), el = act.postEls[i];
    if (!el) return null;
    el.classList.toggle('is-glow', !!on2);
    if (on2) el.setAttribute('filter', `url(#${uid}-glow)`); else el.removeAttribute('filter');
    return el;
  }

  /* ---------- indice : petits sauts « +10 » entre les plaquettes qui encadrent ---------- */
  function drawHops(animate) {
    if (!gHops) return;
    clear(gHops);
    const pl = actPlane(), sc = scAct;
    const { a, b } = L.hintSpan(pl, D.value, D.snap);
    const hops = L.hopsBetween(pl, a, b, D.snap);
    const lab = L.stepLabel(pl, D.fmt);
    const ia = L.postIndex(pl, a), ib = L.postIndex(pl, b);
    for (const [i, lg] of act.labelEls) lg.classList.toggle('is-hint', i === ia || i === ib);
    if (!D.snap) {
      gHops.append(svg('rect', { class: 'cl-span', x: f2(sc.toX(a)), y: lay.yRail - lay.railH / 2 - 3, width: f2(sc.toX(b) - sc.toX(a)), height: lay.railH + 6, rx: lay.railH / 2 + 3 }));
      for (const v of [a, b]) { const el = act.postEls[L.postIndex(pl, v)]; if (el) el.classList.add('is-hint'); }
    }
    const fs = wide ? 13 : 11.5;
    const lw = lab.text ? numW(lab.text, 700) * fs / 100 : fs * 1.1;
    const dx0 = hops.length ? sc.toX(hops[0][1]) - sc.toX(hops[0][0]) : 0;
    /* une étiquette par saut si elle tient largement (nombres) ; sinon sur le premier saut seulement */
    const every = !!lab.text && lw + 8 <= dx0 && hops.length <= 12;
    const y0 = lay.smallTop - 3;
    const side = v => (L.isMultiple(v, pl.major) ? lay.bigW / 2 + 1 : 1.5);
    /* étiquette unique : sur le saut le plus éloigné du compagnon (premier ou dernier) */
    let only = 0;
    if (!every && hops.length > 1 && mpos.kind === 'v' && lay) {
      const mx = mountXY(mpos).x, d = k => Math.abs((sc.toX(hops[k][0]) + sc.toX(hops[k][1])) / 2 - mx);
      if (d(hops.length - 1) > d(0)) only = hops.length - 1;
    }
    hops.forEach(([v, w], i) => {
      const xa = sc.toX(v) + side(v), xb = sc.toX(w) - side(w);
      const hgt = L.clamp((xb - xa) * 0.34, 5, 13), apex = y0 - hgt, cy = 2 * apex - y0;
      const path = svg('path', { class: 'cl-hop' + (animate && !M.reduced() ? ' is-new' : ''), pathLength: 1,
        d: `M${f2(xa)} ${f2(y0)}Q${f2((xa + xb) / 2)} ${f2(cy)} ${f2(xb)} ${f2(y0)}` });
      if (animate) path.style.animationDelay = (i * 45) + 'ms';
      gHops.append(path);
      if (every || i === only) {
        const xm = (xa + xb) / 2;
        const t = lab.text
          ? svgNum({ class: 'cl-hop-t', x: f2(xm), y: f2(apex - 6), 'font-size': fs, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, lab.text, fs)
          : svgFrac(xm, apex - 14, lab.n, lab.d, fs - 1, 'cl-hop-t');
        if (animate && !M.reduced()) { t.classList.add('is-new'); t.style.animationDelay = (i * 45 + 120) + 'ms'; }
        gHops.append(t);
      }
    });
  }
  /* explication à l'estime : le milieu des deux piquets */
  function drawMid() {
    const pl = actPlane(), { a, b } = L.hintSpan(pl, D.value, false);
    const m = (a + b) / 2, x = scAct.toX(m), fs = wide ? 13 : 11;
    const txt = fmtNum(Math.round(m * 1e9) / 1e9), bw = numW(txt) * fs / 100 + 8, y = lay.yRail2 + 15;
    act.g.append(svg('g', { class: 'cl-mid' },
      svg('line', { class: 'cl-mid-l', x1: f2(x), x2: f2(x), y1: lay.yRail + lay.railH / 2, y2: y - fs / 2 - 3 }),
      svg('rect', { class: 'cl-mid-b', x: f2(x - bw / 2), y: f2(y - (fs + 7) / 2), width: f2(bw), height: fs + 7, rx: 4 }),
      svgNum({ class: 'cl-mid-t', x: f2(x), y: f2(y + 0.5), 'font-size': fs, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, txt, fs)));
  }

  /* ---------- description accessible de la scène ---------- */
  function describe() {
    const pl = actPlane();
    const labs = pl.labels.map(l => l.text).join(', ');
    const where = D.zoom ? 'Partie agrandie de la clôture' : 'Clôture graduée';
    const base = frTypo(`${where} de ${pl.labels.length ? pl.labels[0].text : fmtNum(pl.min)} à ${pl.labels.length ? pl.labels[pl.labels.length - 1].text : fmtNum(pl.max)} ; plaquettes : ${labs}.`);
    if (placing()) {
      scene.setAttribute('role', 'slider');
      scene.setAttribute('tabindex', '0');
      scene.setAttribute('aria-label', base + ' Pose la carotte avec les flèches.');
      scene.setAttribute('aria-valuemin', '0');
      scene.setAttribute('aria-valuemax', String(D.snap ? L.intervals(pl) : 100));
      scene.setAttribute('aria-valuenow', String(marker === null ? 0 : D.snap ? L.postIndex(pl, marker) : Math.round(100 * (marker - pl.min) / (pl.max - pl.min))));
      scene.setAttribute('aria-valuetext', L.positionText(pl, marker, D.snap));
    } else {
      scene.setAttribute('role', 'img');
      scene.removeAttribute('tabindex');
      for (const a of ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext']) scene.removeAttribute(a);
      scene.setAttribute('aria-label', base + ' Un drapeau est planté sur un piquet.');
    }
  }

  /* ================= COMPAGNON ================= */
  function ensureMount() {
    if (mountS === lay.S && svgRoot) return;
    mountS = lay.S;
    mountIn.innerHTML = ctx.petSVG(lay.S, '');
    svgRoot = mountIn.querySelector('svg');
    /* carotte tenue À LA BOUCHE (ancre de l'espèce et du stade) : bout des fanes au coin de la bouche, axe de la
       carotte à sa hauteur (le petit SVG fait 18 px de haut, axe à 9 px) */
    const [mx, my] = mouthUnits();
    mouth.style.left = Math.round(lay.S * mx / 100 + 1) + 'px';
    mouth.style.top = Math.round(lay.S * my / 100 - 9) + 'px';
  }
  /* distance du centre du compagnon à la valeur visée quand sa bouche touche la carotte plantée sur la lisse */
  const reach = () => (mouthUnits()[0] / 100 - 0.5) * lay.S + CARROT_HALF * (wide ? 1.2 : 1);
  /* place du compagnon : sur les bottes de foin, ou sur la lisse, la bouche contre la valeur visée (carotte,
     drapeau) du côté où il regarde (dir : 1 vers la droite, −1 vers la gauche) */
  function mountXY(p, dir = facing) {
    const S = lay.S;
    if (!p || p.kind === 'bale') return { x: (lay.left - 10) / 2 + 3, y: lay.yRail - 4 };
    const x = scAct.toX(p.v) - (dir < 0 ? -1 : 1) * reach();
    return { x: L.clamp(x, S / 2 + 2, W - S / 2 - 2), y: lay.yRail - lay.railH / 2 + 1 };
  }
  /* sens du déplacement vers p depuis le point from : vers la valeur visée (il la regarde en arrivant) */
  const dirTo = (p, from) => (p && p.kind === 'v' ? (scAct.toX(p.v) >= from.x ? 1 : -1) : (mountXY(p).x >= from.x ? 1 : -1));
  const tf = ({ x, y }) => `translate(${f2(x - lay.S / 2)}px, ${f2(y - FEET * lay.S)}px)`;
  function placeMount() {
    if (!lay) return;
    for (const a of (mountBox.getAnimations ? mountBox.getAnimations() : [])) safe(() => a.cancel());
    for (const a of arcAnims.splice(0)) safe(() => a.cancel());
    mountBox.style.transform = tf(mountXY(mpos));
    face(mpos.kind === 'bale' ? 1 : facing);
  }
  function face(dir) { facing = dir < 0 ? -1 : 1; mountFlip.classList.toggle('is-left', facing < 0); }
  /* saut en arc : le conteneur glisse AU SOL (l'ombre du rig et la vague du dauphin y restent) ; le CORPS du rig
     (.c-all, en unités du viewBox, composition « add ») et la carotte tenue à la bouche montent par-dessus ;
     l'ombre rétrécit quand il s'élève (sauf la flaque du dauphin, mount.css) */
  function arcLift(pts, from, to, dur, easing) {
    const body = svgRoot && svgRoot.querySelector('.c-all');
    const up = pts.map(q => q.y - (from.y + (to.y - from.y) * q.t));        /* px, ≤ 0 : hauteur au-dessus du sol */
    const top = Math.min(-1, ...up);
    const u = 100 / (lay.S || 100);
    const opts = { duration: dur, easing };
    for (const a of arcAnims.splice(0)) safe(() => a.cancel());
    const add = a => { if (a) arcAnims.push(a); };
    if (body) add(anim(body, up.map(v => ({ transform: `translateY(${f2(v * u)}px)` })), { ...opts, composite: 'add' }));
    if (!mouth.classList.contains('hidden')) add(anim(mouth, up.map(v => ({ translate: `0px ${f2(v)}px` })), { ...opts, composite: 'add' }));
    const sh = svgRoot && svgRoot.getAttribute('data-species') !== 'dolphin' ? svgRoot.querySelector('.c-shadow') : null;
    if (sh) add(anim(sh, up.map(v => { const k = v / top; return { transform: `scale(${f2(1 - 0.45 * k)})`, opacity: f2(1 - 0.5 * k) }; }), opts));
  }
  /* humeur ponctuelle du rig ; le style est recalculé AUSSITÔT après chaque changement de classe : sinon Chrome perd,
     pendant une image, le saut joué en composition « add » sur .c-all (arcLift) quand l'animation CSS du corps change */
  function moodOnce(cls, ms) {
    if (!svgRoot || M.reduced()) return;
    svgRoot.classList.remove(cls);
    void svgRoot.getBoundingClientRect();
    svgRoot.classList.add(cls);
    void svgRoot.getBoundingClientRect();
    carrotWithBody();
    later(() => { if (svgRoot) { svgRoot.classList.remove(cls); void svgRoot.getBoundingClientRect(); } }, ms);
  }
  /* la carotte tenue suit la bouche pendant un bond d'humeur du rig (joie : animation CSS finie de .c-all, mount.css) :
     mêmes images clés, même horloge, appliquées au point de la bouche autour de l'origine du corps (unités du viewBox
     → px), en composition « add » sur un éventuel saut en cours (arcLift) */
  function carrotWithBody() {
    if (!svgRoot || mouth.classList.contains('hidden')) return;
    const body = svgRoot.querySelector('.c-all');
    const css = safe(() => body.getAnimations().find(a => a.animationName && isFinite(a.effect.getTiming().iterations)));
    if (!css) return;
    safe(() => {
      const bb = body.getBBox(), o = getComputedStyle(body).transformOrigin.split(' ').map(parseFloat);
      const ox = bb.x + (o[0] || 0), oy = bb.y + (o[1] || 0), [mx, my] = mouthUnits(), k = lay.S / 100;
      const kf = css.effect.getKeyframes().map(f => {
        const p = new DOMMatrix(f.transform || 'none').transformPoint(new DOMPoint(mx - ox, my - oy));
        return { offset: f.computedOffset, easing: f.easing, translate: `${f2((p.x + ox - mx) * k)}px ${f2((p.y + oy - my) * k)}px` };
      });
      const t = css.effect.getTiming();
      const a = anim(mouth, kf, { duration: t.duration, iterations: t.iterations, composite: 'add' });
      if (a) css.ready.then(() => safe(() => { a.startTime = css.startTime; }), () => {});
    });
  }
  /* fondu (mouvement réduit) : le compagnon disparaît puis réapparaît à destination, déjà tourné vers où il va
     (turn : le demi-tour se fait pendant qu'il est invisible, sans aucun mouvement) */
  function fadeMove(to, turn) {
    const a = anim(mountBox, [{ opacity: 1 }, { opacity: 0 }], { duration: 110, fill: 'forwards' });
    return finished(a, 110).then(() => {
      if (!alive) return;
      if (a) safe(() => a.cancel());
      if (turn) face(turn);
      mountBox.style.transform = tf(to);
      return finished(anim(mountBox, [{ opacity: 0 }, { opacity: 1 }], { duration: 140 }), 140);
    });
  }
  /* sens du regard pour un déplacement vers p : vers la valeur visée, sinon dans le sens de la marche (0 : inchangé) */
  const turnFor = (p, dir, dx) => (p && p.kind === 'v' ? dir : Math.abs(dx) > 1 ? dx : 0);
  /* saut en arc (≤ 400 ms) ; fromPx : point de départ déjà calculé (changement de mise en page) ;
     quiet : sans souffle (retour aux bottes de foin entre deux items) */
  function jumpTo(p, fromPx, quiet) {
    const from = fromPx || mountXY(mpos), dir = dirTo(p, from), to = mountXY(p, dir);
    mpos = p;
    const dx = to.x - from.x, turn = turnFor(p, dir, dx);
    if (Math.abs(dx) < 2 && Math.abs(to.y - from.y) < 2) { if (turn) face(turn); mountBox.style.transform = tf(to); return Promise.resolve(); }
    /* sur les bottes de foin, il regarde toujours la clôture (placeMount) */
    if (M.reduced()) return fadeMove(to, p && p.kind === 'bale' ? 1 : turn);
    if (turn) face(turn);
    const pts = L.arcPoints(from.x, from.y, to.x, to.y, L.jumpHeight(dx), 14);
    const dur = L.jumpMs(dx), easing = 'cubic-bezier(.4,.1,.6,1)';
    mountBox.style.transform = tf(to);
    /* le conteneur suit la droite du sol (départ → arrivée) ; le corps fait l'arc par-dessus (arcLift) */
    const a = anim(mountBox, pts.map(q => ({ transform: tf({ x: q.x, y: from.y + (to.y - from.y) * q.t }) })), { duration: dur, easing });
    arcLift(pts, from, to, dur, easing);
    if (!quiet) AU.whoosh();
    return finished(a, dur).then(() => { if (alive) M.squash(mountIn, { amount: 0.7, dur: 360 }); });
  }
  /* marche (explication) : pattes qui trottent + sabots */
  function walkTo(p) {
    const from = mountXY(mpos), dir = dirTo(p, from), to = mountXY(p, dir);
    mpos = p;
    const dx = to.x - from.x, turn = turnFor(p, dir, dx);
    if (Math.abs(dx) < 2) { if (turn) face(turn); mountBox.style.transform = tf(to); return Promise.resolve(); }
    if (M.reduced()) return fadeMove(to, turn);
    if (turn) face(turn);
    const dur = L.walkMs(dx);
    if (svgRoot) svgRoot.classList.add('walk');
    stopClip();
    clip = safe(() => AU.clipClop()) || null;
    mountBox.style.transform = tf(to);
    const a = anim(mountBox, [{ transform: tf(from) }, { transform: tf(to) }], { duration: dur, easing: 'linear' });
    return finished(a, dur).then(() => {
      stopClip();
      if (svgRoot) svgRoot.classList.remove('walk');
    });
  }

  /* ================= ZOOM : PLONGÉE DE LA CAMÉRA ================= */
  function startDive() {
    if (!alive || !D || !D.zoom || zoomDone || diving || !cam) return;
    diving = true;
    const tok = token;
    const band = gMain && gMain.querySelector('.cl-zband');
    if (band) band.classList.add('is-pulse');
    if (M.reduced()) {
      later(() => { if (tok === token) endDive(true); }, 420);
      return;
    }
    AU.whoosh();
    const dur = 950, t1 = performance.now() + 120;
    const sm = (e, a, b) => { const x = L.clamp((e - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
    const step = now => {
      if (tok !== token || !diving) return;
      const t = L.clamp((now - t1) / dur, 0, 1), e = L.easeInOut(t);
      fence.setAttribute('viewBox', cam.at(e).map(v => v.toFixed(3)).join(' '));
      if (gMain) gMain.style.opacity = String(1 - sm(e, 0.14, 0.56));
      act.g.style.opacity = String(sm(e, 0.04, 0.4));
      if (t < 1) raf(step); else endDive(false);
    };
    raf(step);
  }
  function endDive(fade) {
    if (!diving && zoomDone) return;
    diving = false;
    zoomDone = true;
    drawWorld();
    placeMount();
    const mini = fence.querySelector('.cl-mini');
    if (mini) M.enter(mini, { from: 'fade', dur: 360 });
    if (fade) M.enter(world, { from: 'fade' });
    if (D.mode === 'lire' && gFlag) M.pop(gFlag, { scale: 1.08 });
    if (stepHint) drawHops(true);
    if (!compact) subEl.textContent = frTypo(`🔍 La partie entre ${D.zoom.labels[0].text} et ${D.zoom.labels[D.zoom.labels.length - 1].text} est agrandie.`);
    ctx.announce(frTypo(`La clôture est agrandie entre ${D.zoom.labels[0].text} et ${D.zoom.labels[D.zoom.labels.length - 1].text}.`));
    if (placing()) setSub();
  }

  /* ================= CONSIGNE ET ZONE DE RÉPONSE ================= */
  function buildPrompt() {
    clear(promptEl);
    if (D.mode === 'placer') {
      const target = D.fmt === 'frac' ? fracNode(D.num, D.den, 'cl-frac-big') : h('span', { class: 'num' }, htmlNum(D.text));
      promptEl.append('Place ', h('span', { class: 'cl-target' }, target), ' sur la clôture.');
    } else {
      promptEl.append(item.prompt);
    }
  }
  function setSub() {
    subEl.classList.remove('hidden');
    if (placing()) {
      /* le geste n'est écrit qu'à la 1re carotte de la manche (hauteur gardée : rien ne bouge) ; le lecteur d'écran
         l'entend à chaque fois (annonce de next) */
      subEl.textContent = placeN > 1 ? '' : marker === null ? frTypo('Touche la clôture pour poser la carotte 🥕')
        : frTypo('Glisse la carotte pour l’ajuster, puis valide.');
    } else if (D.zoom && !compact) {
      subEl.textContent = frTypo('🔍 On regarde de plus près…');
    } else {
      subEl.textContent = '';
      subEl.classList.add('hidden');
    }
  }
  function buildAnswer() {
    if (kp) { safe(() => kp.destroy()); kp = null; }
    grid = null; okBtn = prevBtn = nextBtn = null;
    clear(answer);
    answer.className = 'cl-answer';
    if (D.mode === 'lire' && Array.isArray(item.choices) && item.choices.length) {
      const frac = D.fmt === 'frac';
      const choices = item.choices.map(c => ({
        value: c.value,
        label: frac && Number.isInteger(c.num) ? fracNode(c.num, c.den, 'cl-frac-big') : h('span', null, htmlNum(c.label))
      }));
      grid = K.choiceGrid(choices, { cols: choices.length > 4 ? 3 : 2, onPick: (v, b) => onChoice(v, b) });
      grid.el.classList.add('cl-choices');
      answer.classList.add('is-qcm');
      answer.append(grid.el);
    } else if (D.mode === 'lire') {
      kp = K.keypad({ decimal: D.fmt === 'dec', maxLen: L.keypadLen(item.answer), onSubmit: s => onKeypad(s) });
      answer.classList.add('is-keypad');
      answer.append(kp.el);
    } else {
      prevBtn = h('button', { class: 'btn-icon cl-nudge', type: 'button', 'aria-label': 'Reculer la carotte' }, chevron(-1));
      nextBtn = h('button', { class: 'btn-icon cl-nudge', type: 'button', 'aria-label': 'Avancer la carotte' }, chevron(1));
      okBtn = h('button', { class: 'btn big cl-ok', type: 'button', 'aria-disabled': 'true' }, 'Valider ✓');
      on(okBtn, 'click', () => validate());
      for (const [b, dir] of [[prevBtn, -1], [nextBtn, 1]]) bindNudge(b, dir);
      answer.classList.add('is-place');
      answer.append(h('div', { class: 'cl-place' }, prevBtn, okBtn, nextBtn));
    }
  }

  /* ---------- répondre à voix haute (v2.3) ---------- */
  /* ce que le micro écoute pour l'item, et où se met le 🎤 (rien ne bouge : case vide du pavé, à gauche de la case
     réponse du pavé décimal, ou pastille de la scène) */
  function setVoice() {
    dropHeld();
    const plan = L.voicePlan(item, { prev: prevAnswer });
    voiceRule = { never: plan.never || [], only: plan.only || null };
    voiceKind = plan.kind;
    if (!offVoice && plan.kind !== 'pause') offVoice = safe(() => ctx.speech.onHealth(onVoiceHealth)) || null;
    if (plan.kind === 'number') {
      if (!va.attachKeypad(kp)) va.placeIn(vaBar, va.ear);
      va.number({ answer: plan.answer, ignore: plan.ignore });
    } else if (plan.kind === 'choices') {
      if (grid) { va.placeIn(vaBar, va.ear); va.attachChoices(grid); }
      else if (kp && !va.attachKeypad(kp)) va.placeIn(kp.el, kp.answer);
      va.choices(plan.list);
    } else {
      if (!(kp && va.attachKeypad(kp))) va.placeIn(vaBar, va.ear);   /* grand nombre : le 🎤 (en pause) reste au pavé */
      va.pause(true);
    }
    syncVoiceBar();
  }
  /* placer ou explication, micro éteint : pas de pastille (la voix n'y sert à rien) ; micro allumé : « en pause »,
     éteignable d'un toucher */
  function syncVoiceBar() {
    if (!alive) return;
    const off = !!D && (placing() || phase === 'learn') && !va.wanted();
    vaBar.classList.toggle('is-off', off);
    placeVoiceBar();
  }
  /* pastille : en haut du ciel si elle y tient (au-dessus du drapeau, du panneau et des sauts du compagnon ; zoom :
     sous la mini-carte), sinon au bas du pré (sous la bulle posée sur l'herbe), sinon cachée (petit écran et indice
     sous la scène : le 🎤 du pavé reste à sa place) — jamais sur la clôture ni ses plaquettes ; le ciel d'abord :
     elle ne saute pas quand la bulle d'indice arrive sur l'herbe */
  function placeVoiceBar() {
    if (!alive || !lay) return;
    const ph = va.el.parentNode === vaBar ? 62 : 30;
    let ground = lay.yGround + 8;
    if (bubbleEl && bubbleEl.parentNode === floatEl) ground = Math.max(ground, floatEl.offsetTop + bubbleEl.offsetHeight + 6);
    const skyTop = D && D.zoom ? Math.round(lay.A * 0.38 + lay.lift * 0.5) + 26 : 0;
    const skyBottom = lay.yRail - (wide ? 112 : 106);
    const where = skyBottom - skyTop - 8 >= ph ? 'high' : H - 8 - ground >= ph ? 'low' : '';
    vaBar.classList.toggle('is-high', where === 'high');
    vaBar.classList.toggle('is-squeezed', !where);
    vaBar.style.top = where === 'high' ? (skyTop + 8) + 'px' : '';
  }
  const vlog = (m, d) => { try { dlog('voix', m, d); } catch (_) {} };
  function dropHeld() {
    if (held) { clearTimeout(held); timers.delete(held); vlog('voix : retenu, annulé', { valeur: heldV }); }
    held = 0; heldV = null;
  }
  /* réponse entendue : juste → tapée ; fausse → retenue jusqu'à ce que l'enfant se taise (il compte souvent les
     piquets à voix haute : la suivante l'annule ; redite → tapée) ; « un », début de la réponse → rien */
  function voiceAnswer(v, verdict, holdMs) {
    if (!alive || !item || phase !== 'answer') return;
    dropHeld();
    if (verdict === 'now') { typeVoice(v); return; }
    if (verdict !== 'hold') return;
    heldV = v; heldAt = Date.now();
    vlog('voix : retenu', { valeur: v });
    const tick = () => {
      held = 0;
      if (!alive || phase !== 'answer') { heldV = null; return; }
      const now = Date.now();
      if (L.holdDue({ pickAt: heldAt, lastVoiceAt, now, holdMs })) {
        heldV = null;
        vlog('voix : retenu, tapé', { valeur: v, après: now - heldAt, silence: now - lastVoiceAt });
        typeVoice(v);
      } else held = laterItem(tick, 150);
    };
    held = laterItem(tick, Math.max(150, holdMs));
  }
  /* santé du micro : quand l'enfant parle (réponse retenue) ; en mode choix, un long silence fait oublier le texte */
  function onVoiceHealth(hh) {
    if (!alive || !hh) return;
    const now = Date.now();
    if (hh.voice) { lastVoiceAt = now; forgot = false; return; }
    if (!forgot && voiceKind === 'choices' && phase === 'answer' && !held && now - lastVoiceAt >= L.VOICE_FORGET_MS) {
      forgot = true;
      vlog('voix : silence, texte oublié');
      safe(() => ctx.speech.resetTranscript());
    }
  }
  /* la voix tape la réponse : bouton du choix, ou nombre écrit dans le pavé puis ✓ (mêmes retours qu'au doigt) ;
     la grille ignore un 2e toucher à moins de 350 ms : la bonne réponse dite juste après un choix faux attend */
  function typeVoice(v) {
    if (!alive || phase !== 'answer') return;
    if (grid) {
      const wait = lastTap + 380 - Date.now();
      if (wait > 0) { laterItem(() => typeVoice(v), wait); return; }
      const b = grid.button(v);
      if (b && !b.disabled) b.click();
    } else if (kp) {
      kp.set(fmtNum(Number(v)).replace(/\s/g, ''));
      const ok = kp.el.querySelector('[data-k="ok"]');
      if (ok && !ok.disabled) ok.click();
    }
  }
  /* flèches : un appui = un pas ; appui long = répétition */
  function bindNudge(b, dir) {
    const stop = () => { if (repeat) { clearTimeout(repeat.t); timers.delete(repeat.t); repeat = null; } };
    on(b, 'pointerdown', e => {
      if (e.button > 0) return;
      stop();
      const tick = first => {
        if (repeat) timers.delete(repeat.t);
        if (!alive || !canPlace()) { stop(); return; }
        setMarker(L.nudge(actPlane(), marker, dir, D.snap), { sound: true });
        repeat = { t: setTimeout(() => tick(false), first ? 380 : 85) };
        timers.add(repeat.t);
      };
      tick(true);
    });
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) on(b, t, stop);
    on(b, 'click', e => { if (e.detail === 0 && canPlace()) setMarker(L.nudge(actPlane(), marker, dir, D.snap), { sound: true }); });
  }
  /* bulle d'aide : sur l'herbe sous la clôture si elle y tient, sinon sous la scène */
  let bubbleEl = null;
  function setBubble(text, kind, icon) {
    clearBubble();
    bubbleEl = K.bubble(richText(text), kind, { icon });
    if (kind !== 'good') bubbleEl.classList.add('cl-read');     /* indice et explication : police de lecture */
    placeBubble();
    return bubbleEl;
  }
  /* bulle d'aide : 1) sur l'herbe sous la clôture si elle y tient ; 2) sous la scène si tout tient encore
     dans l'écran ; 3) sinon (petit écran + pavé numérique), à la place de la consigne */
  function placeBubble() {
    const b = bubbleEl;
    if (!b) return;
    const wasIn = b.parentNode;
    head.classList.remove('has-bubble');
    b.classList.remove('is-tight', 'is-tighter');
    if (lay) {
      const top = lay.yGround + (wide ? 14 : 10);
      const room = scene.clientHeight + (wasIn === help ? help.offsetHeight : 0) + (wasIn === head ? b.offsetHeight : 0) - top - 8;
      floatEl.style.top = top + 'px';
      if (b.parentNode !== floatEl) floatEl.append(b);
      if (b.offsetHeight <= room) { placeVoiceBar(); return; }
    }
    if (b.parentNode !== help) help.append(b);
    if (answer.getBoundingClientRect().bottom <= wrap.getBoundingClientRect().bottom + 1) { placeVoiceBar(); return; }
    head.append(b);
    head.classList.add('has-bubble');
    for (const cls of ['is-tight', 'is-tighter']) {       /* indice très long sur un tout petit écran */
      if (answer.getBoundingClientRect().bottom <= wrap.getBoundingClientRect().bottom + 1) break;
      b.classList.add(cls);
    }
    placeVoiceBar();
  }
  function clearBubble() {
    bubbleEl = null;
    clear(help);
    clear(floatEl);
    for (const n of head.querySelectorAll('.kit-bubble')) n.remove();
    head.classList.remove('has-bubble');
    placeVoiceBar();
  }

  /* ================= DÉROULÉ D'UN ITEM (contrat §7.3) ================= */
  function next(first) {
    if (!alive) return;
    token++;
    stopClip();
    hideLoupe();
    dragging = null;
    const it = ctx.nextItem();
    if (!it) { phase = 'end'; dropHeld(); va.pause(true); ctx.end(); return; }
    prevAnswer = item && item.data && item.data.mode === 'lire' ? Number(item.answer) : null;
    item = it; D = it.data;
    tries = 0; hinted = !!it.assist; hintShown = false;
    marker = null; lastWrong = null; ghost = null; revealed = false; stepHint = false; showMid = false;
    zoomDone = !D.zoom; diving = false;
    phase = 'answer';
    keepLift = null;
    if (placing()) placeN++;
    setCompact();
    buildPrompt();
    buildAnswer();
    setVoice();
    setSub();
    clearBubble();
    setSceneMin();
    scene.classList.toggle('is-placing', placing());
    /* le compagnon revient sur ses bottes de foin pendant que la nouvelle portion de clôture arrive */
    const fromPx = mpos.kind !== 'bale' && lay && scAct ? mountXY(mpos) : null;
    const oldRail = lay ? lay.yRail : null;
    mpos = { kind: 'bale' };
    renderAll();
    if (fromPx && lay) jumpTo({ kind: 'bale' }, fromPx, true).then(() => { if (alive) face(1); });
    if (!first && world) M.enter(world, { from: 'right', dist: 26, dur: 380 });
    if (!first && lay && oldRail !== null && Math.abs(oldRail - lay.yRail) > 2) M.enter(bg, { from: 'fade', dur: 300 });
    if (gFlag) { M.enter(gFlag, { from: 'top', dist: 26, delay: first ? 120 : 200, dur: 420 }); laterItem(() => AU.tap(), first ? 400 : 480); }
    if (placing() && !M.reduced()) laterItem(() => moodOnce('joy', 1100), 300);
    if (it.assist) showHint('assist');
    if (D.zoom) laterItem(startDive, first ? 520 : 560);
    t0 = performance.now();
    const intro = placing()
      ? spoken(`Place ${D.text} sur la clôture. Touche la clôture pour poser la carotte, puis valide.`)
      : spoken(item.prompt);
    ctx.announce(frTypo(intro));
    /* petits lecteurs : le compagnon dit la consigne (le geste seulement à la 1re carotte) et le coup de pouce */
    const told = placing() && placeN > 1 ? spoken(`Place ${D.text} sur la clôture.`) : intro;
    say(frTypo(told) + (it.assist ? ' ' + spoken(frTypo('Petit coup de pouce : ') + item.hint) : ''));
  }
  /* petit écran (hauteur utile < 660 px) avec pavé numérique : consigne et bandes resserrées */
  function setCompact() {
    wrapH = wrap.clientHeight;
    compact = wrapH > 0 && wrapH < 660 && D && D.mode === 'lire' && !(Array.isArray(item.choices) && item.choices.length);
    wrap.classList.toggle('is-compact', compact);
  }
  /* hauteur minimale de la scène (en dessous, seuls les pieds des piquets seraient coupés) */
  function setSceneMin() {
    const ref = L.sceneLayout(0, 0, { zoom: !!D.zoom, wide: scene.clientWidth >= WIDE_PX, lift: 0, compact });
    scene.style.setProperty('--cl-min', ref.minH + 'px');
  }

  function showHint(kind) {
    hintShown = true;
    stepHint = true;
    /* la bulle : un mot doux (1 à 3 mots, kit.cheer) puis l'astuce ; dite aux petits lecteurs (sauf le coup de pouce
       d'arrivée : next() le dit avec la consigne) */
    const pre = kind === 'assist' ? frTypo('Petit coup de pouce : ') : kind === 'retry' ? K.cheer('retry', ctx.rng) + ' ' : '';
    setBubble(pre + item.hint, 'hint', '💡');
    drawHops(true);
    ctx.announce(spoken(pre + item.hint));
    if (kind !== 'assist') say(spoken(pre + item.hint));
  }
  function onJoker(cur) {
    if (!alive || !item || phase !== 'answer' || (cur && cur !== item)) return false;
    if (hintShown) {
      if (bubbleEl) M.pop(bubbleEl, { scale: 1.04 });
      K.toast(frTypo('L’indice est déjà affiché 💡'));
      return false;
    }
    hinted = true;
    showHint('joker');
    return true;
  }

  /* ---------- réponses ---------- */
  function onChoice(v, btn) {
    if (!alive || phase !== 'answer') return;
    lastTap = Date.now();
    dropHeld();                                   /* un choix touché (au doigt ou à la voix) annule le choix retenu */
    if (Math.abs(v - item.answer) < 1e-9) { grid.mark(v, 'right'); grid.disable(); onRight(btn); }
    else { grid.mark(v, 'wrong'); onWrong(btn); }
  }
  function onKeypad(str) {
    if (!alive || phase !== 'answer') return;
    dropHeld();
    if (L.answerMatches(str, item.answer)) { kp.setState('right'); kp.disable(true); onRight(kp.answer); }
    else {
      kp.setState('wrong');
      onWrong(kp.answer);
      if (phase === 'answer') laterItem(() => { if (kp && phase === 'answer') { kp.clear(); kp.setState(null); } }, 650);
    }
  }
  function validate() {
    if (!alive || phase !== 'answer') return;
    if (!canPlace()) return;
    if (marker === null) {
      M.shake(okBtn, { dist: 4, dur: 300 });
      M.pop(subEl, { scale: 1.05 });
      return;
    }
    if (lastWrong !== null && L.sameValue(marker, lastWrong)) {
      K.toast(frTypo('Déplace d’abord la carotte, puis valide 🥕'));
      return;
    }
    const ok = L.isCorrectPlace(D, marker);
    const tok = token;
    phase = 'busy';
    setControls(false);
    jumpTo({ kind: 'v', v: marker }).then(() => {
      if (!alive || tok !== token) return;
      if (ok) onRight(null);
      else onWrong(gCarrot ? gCarrot.querySelector('.cl-carrot-in') : okBtn);
    });
  }
  function report(correct) {
    const ms = Math.round(performance.now() - t0);
    return ctx.report(item, correct
      ? { correct: true, hinted: hinted || tries > 0, ms, tries: tries + 1 }
      : { correct: false, hinted: true, ms, tries: 2 });
  }
  function onRight(el) {
    phase = 'busy';
    hush();
    const tok = token;
    const fb = report(true) || {};
    const streak = fb.streak || 0;
    const msg = K.cheer(tries || hinted ? 'helped' : 'right', ctx.rng);
    setBubble(msg, 'good', '🌟');
    ctx.announce(spoken(msg + ' C’est ' + D.text + '.'));
    if (placing()) {
      setControls(false);
      eatCarrot();
      const board = reveal(true);
      safe(() => K.celebrateRight(board || okBtn, streak));
      flyApple(board);
      moodOnce('joy', 1100);
      laterItem(() => next(false), 1100);
    } else {
      safe(() => K.celebrateRight(el, streak));
      laterItem(() => {
        jumpTo({ kind: 'v', v: D.value }).then(() => {
          if (!alive || tok !== token) return;
          const board = reveal(true);
          if (board) M.sparkle(board);
          flyApple(board);
          moodOnce('joy', 1100);
        });
      }, 120);
      laterItem(() => next(false), 1150);         /* saut (≤ 400 ms) + valeur montrée, puis la suite (D1-20) */
    }
  }
  function onWrong(el) {
    if (tries === 0) {
      tries = 1;
      hinted = true;
      if (placing()) { lastWrong = marker; setControls(true); }
      safe(() => K.gentleWrong(el));
      phase = 'answer';
      showHint('retry');
      offerLater();
      if (placing()) setSub();
      return;
    }
    tries = 2;
    phase = 'learn';
    safe(() => K.gentleWrong(el));
    learn();
  }
  /* « 🌱 Pas encore appris » (v2.5, ctx.later) : sous l'astuce de la 1re erreur ; confirmé → l'item n'est pas rapporté,
     le compagnon le dit, puis la portion de clôture suivante arrive (elle remplace celle-ci dans la partie) */
  function offerLater() {
    const tok = token, it = item;
    const chip = safe(() => ctx.later && ctx.later(it, { onSkip: s => skipItem(tok, s) }));
    if (chip && bubbleEl) { (bubbleEl.querySelector('.kit-bubble-body') || bubbleEl).appendChild(chip); placeBubble(); }
  }
  function skipItem(tok, s) {
    if (!alive || tok !== token || phase !== 'answer') return;
    phase = 'busy';
    dropHeld();
    va.pause(true);
    if (grid) grid.disable();
    if (kp) kp.disable(true);
    if (placing()) setControls(false);
    setBubble(s.line, 'good', '🌱');
    ctx.announce(s.line);
    s.done.then(() => { if (alive && tok === token) next(false); });
  }
  /* 2e erreur : la réponse est montrée (le compagnon marche jusqu'au bon piquet) + explication */
  function learn() {
    const tok = token;
    dropHeld();
    va.placeIn(vaBar, va.ear);                    /* le pavé s'en va : le 🎤 (en pause) passe dans la pastille */
    va.pause(true);                               /* le micro attend « J’ai compris ✓ » */
    syncVoiceBar();
    if (grid) { grid.reveal(item.answer); grid.dimOthers(item.answer); grid.disable(); }
    if (kp) kp.disable(true);
    stepHint = true;
    if (!D.snap) showMid = true;
    if (placing()) {
      ghost = marker;               /* là où l'enfant avait posé la carotte : on compare */
      setControls(false);
    }
    drawWorld();
    placeMount();
    if (showMid) { const m = fence.querySelector('.cl-mid'); if (m) M.enter(m, { from: 'fade' }); }
    const learnTxt = K.cheer('learn', ctx.rng) + ' ' + item.explain;
    const btn = h('button', { class: 'btn block cl-next', type: 'button' }, 'J’ai compris ✓');
    on(btn, 'click', () => {
      if (!alive || phase !== 'learn' || tok !== token) return;
      phase = 'busy';
      report(false);
      next(false);
    });
    if (kp) { safe(() => kp.destroy()); kp = null; clear(answer); }
    if (placing()) clear(answer);
    answer.append(btn);
    M.enter(btn, { from: 'bottom', dist: 10, dur: 300 });
    setBubble(learnTxt, 'soft');                  /* pastille 🤗, la même dans tous les jeux (D4-24) */
    ctx.announce(spoken(learnTxt));
    say(spoken(learnTxt));
    later(() => { if (tok === token && btn.isConnected) safe(() => btn.focus({ preventScroll: true })); }, 60);
    const target = { kind: 'v', v: D.value };
    if (placing() && gCarrot) {
      const from = marker !== null ? scAct.toX(marker) : scAct.x0, to = scAct.toX(D.value);
      marker = D.value;
      moveCarrot(D.value);
      gCarrot.classList.remove('hidden');
      if (!M.reduced()) anim(gCarrot, [{ translate: `${f2(from - to)}px 0px` }, { translate: '0px 0px' }], { duration: L.walkMs(to - from), easing: 'linear' });
    }
    walkTo(target).then(() => {
      if (!alive || tok !== token) return;
      reveal(true);
    });
  }
  /* panneau de la valeur + piquet illuminé */
  function reveal(animate) {
    revealed = true;
    const post = glowAt(D.value, true);
    if (act) act.postEls.forEach(el => el.classList.remove('is-sel'));
    const board = drawSign(animate);
    if (animate && post) M.sparkle(post, { count: 6 });
    mouth.classList.add('hidden');
    return board;
  }
  function eatCarrot() {
    if (!gCarrot) return;
    const c = gCarrot.querySelector('.cl-carrot-in');
    if (M.reduced()) { gCarrot.classList.add('hidden'); return; }
    const a = anim(c, [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '0.2' }], { duration: 260, easing: 'ease-in', fill: 'forwards' });
    AU.tap();
    later(() => AU.tap(), 120);
    finished(a, 260).then(() => { if (gCarrot) gCarrot.classList.add('hidden'); });
  }
  function flyApple(from) {
    const src = from || okBtn || scene;
    if (!ctx.applesEl || !src) return;
    safe(() => M.flyTo(src, ctx.applesEl, { emoji: '🍎', onArrive: () => AU.coin() }));
  }
  function setControls(enabled) {
    for (const b of [prevBtn, nextBtn]) if (b) b.disabled = !enabled;
    if (okBtn) okBtn.setAttribute('aria-disabled', enabled && marker !== null ? 'false' : 'true');
  }

  /* ================= PLACER : TOUCHER, GLISSER, LOUPE ================= */
  function setMarker(v, { sound = false } = {}) {
    if (v === null || !Number.isFinite(v)) return;
    const firstTime = marker === null;
    const changed = firstTime || !L.sameValue(v, marker);
    marker = v;
    if (!gCarrot) return;
    if (firstTime) {
      gCarrot.classList.remove('hidden');
      mouth.classList.add('hidden');
      moveCarrot(v);
      M.enter(gCarrot.querySelector('.cl-carrot-in'), { from: 'top', dist: 14, dur: 260 });
      AU.tap();
      setSub();
      if (okBtn) okBtn.setAttribute('aria-disabled', 'false');
    } else if (changed) {
      moveCarrot(v);
      const t = performance.now();
      if (sound && t - lastTick > 55) { lastTick = t; AU.tap(); }
    }
    updateLoupe();
    describe();
  }
  function valueAtClientX(cx) {
    const r = fence.getBoundingClientRect();
    const x = (cx - r.left) * (W / Math.max(1, r.width));
    return L.quantize(actPlane(), scAct.toV(x), D.snap);
  }
  function onDown(e) {
    if (!canPlace() || (e.button !== undefined && e.button > 0)) return;
    dragging = { id: e.pointerId };
    try { scene.setPointerCapture(e.pointerId); } catch (_) {}
    setMarker(valueAtClientX(e.clientX), { sound: true });
    showLoupe();
    e.preventDefault();
  }
  function onMove(e) {
    if (!dragging || e.pointerId !== dragging.id) return;
    if (!canPlace()) { endDrag(e); return; }
    setMarker(valueAtClientX(e.clientX), { sound: true });
  }
  function endDrag(e) {
    if (!dragging || (e && e.pointerId !== dragging.id)) return;
    dragging = null;
    hideLoupe();
  }
  function showLoupe() { if (loupe) { updateLoupe(); loupe.classList.add('is-on'); } }
  function hideLoupe() { if (loupe) loupe.classList.remove('is-on'); }
  const loupeW = () => (wide ? 156 : 128), loupeH = () => (wide ? 70 : 58);
  function updateLoupe() {
    if (!loupe || marker === null || !lay) return;
    const lw = loupeW(), lh = loupeH(), z = 2;
    const x = scAct.toX(marker), cy = lay.yRail - (wide ? 12 : 10);
    const lx = L.clamp(x, lw / 2 + 4, W - lw / 2 - 4), ly = lay.loupeY;
    loupe.setAttribute('transform', `translate(${f2(lx)} ${f2(ly)})`);
    loupeUse.setAttribute('transform', `translate(${f2(x - lx)} 0) scale(${z}) translate(${f2(-x)} ${f2(-cy)})`);
    const tip = loupe.querySelector('.cl-loupe-tip');
    if (tip) tip.setAttribute('transform', `translate(${f2(L.clamp(x - lx, -lw / 2 + 14, lw / 2 - 14))} 0)`);
  }
  function onKey(e) {
    if (!canPlace()) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowDown') setMarker(L.nudge(actPlane(), marker, -1, D.snap), { sound: true });
    else if (k === 'ArrowRight' || k === 'ArrowUp') setMarker(L.nudge(actPlane(), marker, 1, D.snap), { sound: true });
    else if (k === 'Home') setMarker(actPlane().min, { sound: true });
    else if (k === 'End') setMarker(actPlane().max, { sound: true });
    else if (k === 'Enter' || k === ' ') validate();
    else return;
    e.preventDefault();
  }

  /* ================= REDIMENSIONNEMENT ================= */
  function onResize() {
    if (resizeRaf || !alive) return;
    resizeRaf = raf(() => {
      resizeRaf = 0;
      if (!D) return;
      const w = Math.round(scene.clientWidth), hh = Math.round(scene.clientHeight);
      if (!w || !hh) return;
      if (Math.abs(wrap.clientHeight - wrapH) > 40 && !diving) { setCompact(); setSceneMin(); keepLift = null; renderAll(); return; }
      if (w !== W || (w >= WIDE_PX) !== wide || !lay) {
        if (diving) { diving = false; zoomDone = true; }
        keepLift = null;
        renderAll();
      } else if (hh !== H) {
        H = hh;
        /* la scène rapetisse au point de couper les plaquettes : la clôture remonte juste ce qu'il faut */
        if (lay && hh < lay.yRail + 44 && keepLift > 0 && !diving) {
          keepLift = Math.max(0, keepLift - (lay.yRail + 44 - hh));
          renderAll();
          return;
        }
        lay = L.sceneLayout(W, H, { zoom: !!D.zoom, wide, lift: keepLift, compact });
        drawBg();
        if (!diving) fence.setAttribute('viewBox', `0 0 ${W} ${H}`);
        if (bubbleEl && bubbleEl.parentNode === help) placeBubble();
        else placeVoiceBar();
      }
    });
  }

  /* ================= CYCLE DE VIE ================= */
  async function start() {
    root.append(wrap);
    try {
      if (document.fonts && document.fonts.load) {
        await Promise.race([document.fonts.load('600 16px Fredoka'), new Promise(r => setTimeout(r, 1200))]);
        widths.clear();
      }
    } catch (_) {}
    if (!alive) return;
    try { ro = new ResizeObserver(onResize); ro.observe(scene); } catch (_) { on(window, 'resize', onResize); }
    on(scene, 'pointerdown', onDown);
    on(scene, 'pointermove', onMove);
    on(scene, 'pointerup', endDrag);
    on(scene, 'pointercancel', endDrag);
    on(scene, 'lostpointercapture', endDrag);
    on(scene, 'keydown', onKey);
    ctx.onJoker(onJoker);
    next(true);
    va.autoStart();                               /* micro déjà allumé dans un autre jeu de la séance */
  }
  function destroy() {
    if (!alive) return;
    alive = false;
    hush();
    token++;
    for (const t of timers) clearTimeout(t);
    timers.clear();
    if (repeat) { clearTimeout(repeat.t); repeat = null; }
    for (const r of rafs) cancelAnimationFrame(r);
    rafs.clear();
    for (const a of anims) safe(() => a.cancel());
    anims.clear();
    for (const off of offs) safe(off);
    offs.length = 0;
    stopClip();
    if (ro) safe(() => ro.disconnect());
    ro = null;
    if (kp) safe(() => kp.destroy());
    kp = null;
    safe(() => va.destroy());
    if (offVoice) safe(offVoice);
    offVoice = null;
    safe(() => ctx.onJoker(null));
    safe(() => wrap.remove());
  }
  return { start, destroy };
}
