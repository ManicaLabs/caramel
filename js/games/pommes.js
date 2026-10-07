/* ============ POMMES EXPRESS — ma.procedures (docs/JEUX.md §5, contrat §7) ============
   Verger du ranch : pommier en haut (feuillage en aplats, pommes qui se balancent), le calcul est écrit sur une
   grosse POMME-CARTE suspendue à l'arbre, compagnon à gauche (ctx.petSVG), PANIER à droite qui se remplit (compteur).
   La case « … » de l'énoncé EST la zone de réponse du pavé du kit (kp.answer déplacé dans la pomme).
   - Cueillette tranquille (défaut) : les calculs de la manche, à son rythme (« série » = jours de suite, D4-12).
   - Sprint 60 s : proposé à l'écran d'accueil du jeu SEULEMENT si settings.timers ; jauge douce en haut de la
     scène, en pause pendant une explication ou quand l'appli passe en arrière-plan ; à 60 s, l'item en cours se
     termine tranquillement (jamais d'échec), puis la manche s'arrête (ou plus tôt, à la fin de la manche).
   - Juste : pop + paillettes (kit.celebrateRight), la pomme-carte rétrécit et une petite pomme s'envole dans le
     panier (motion.flyTo) → audio.coin, compteur +1, le compagnon sautille, puis une 🍎 vole vers ctx.applesEl.
   - Faux : petite secousse + son de bois (kit.gentleWrong), bulle « Astuce : » (item.hint = la stratégie),
     nouvel essai ; 2e erreur : la réponse s'écrit dans la case, item.explain (le calcul détaillé) + « J’ai compris ✓ »,
     la pomme remonte dans l'arbre.
   - Estimation (item.choices) : kit.choiceGrid à la place du pavé (même hauteur : rien ne saute).
   - Joker 💡 : l'astuce avant de répondre (l'item compte comme aidé) ; item.assist : coup de pouce d'emblée.
   - Voix (petits lecteurs, ctx.voice, comme les tables et la clôture) : le calcul (et, au premier, comment répondre),
     l'astuce, l'explication ; silence dès la bonne réponse et au démontage ; le temps d'écoute ne compte pas.
   - Répondre à voix haute (v2.3, js/ui/voice-answer.js) : 🎤 dans la case vide du pavé (nombres entiers ; pas pour les
     réponses décimales), ou rond au-dessus des choix d'estimation ; la voix tape la réponse (même retour qu'au
     doigt) ; les nombres de l'énoncé ne comptent jamais faux ; micro en pause pendant l'explication.
   Logique pure (énoncé, réponse, horloge du sprint, silhouette de pomme, panier, mise en page) :
   js/games/pommes-logic.js (tests/pommes.test.mjs). */

import { h, svg, clear, frTypo } from '../core/util.js';
import { createVoiceAnswer } from '../ui/voice-answer.js';
import * as L from './pommes-logic.js';

const CELEBRATE_MS = 200;     /* la bonne réponse reste visible (verte) avant que la pomme s'envole */
const NEXT_MS = 400;          /* juste → pomme suivante (le pavé revit : jamais plus de 400 ms sans saisie) */
const WRONG_CLEAR_MS = 650;   /* la saisie fausse reste visible, puis la case se vide */
const REVEAL_MS = 420;        /* 2e erreur : la réponse s'écrit après la petite secousse */
const AFTER_LEARN_MS = 300;   /* « J’ai compris ✓ » → pomme suivante */
const IDLE_AFTER_MS = 1700;   /* le « Bravo ! » reste un moment, puis la ligne d'aide revient */
const FINALE_MS = 1150;       /* fin de manche : la dernière pomme atterrit, puis le bilan */
const FLY_MS = 640;           /* vol de la pomme vers le panier */
const NNBSP = '\u202F';

let inst = null;

export default {
  id: 'pommes', title: 'Pommes express', icon: '🍎', axes: ['ma.procedures'],
  css: 'css/games/pommes.css',
  async mount(root, ctx) {
    if (inst) inst.destroy();
    inst = createPommes(root, ctx);
    await inst.start();
  },
  unmount() {
    if (inst) inst.destroy();
    inst = null;
  }
};

function createPommes(root, ctx) {
  let alive = true;
  const timers = new Set();
  const cleanups = [];
  const anims = new Set();
  const uid = 'pm' + Math.random().toString(36).slice(2, 8);

  /* ---------- petits outils ---------- */
  const safe = (fn, ...a) => { try { return fn(...a); } catch (e) { console.error('pommes', e); return null; } };
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (alive) safe(fn); }, Math.max(0, ms));
    timers.add(id);
    return id;
  };
  const cancel = id => { if (id) { clearTimeout(id); timers.delete(id); } return 0; };
  const nowMs = () => (globalThis.performance && performance.now ? performance.now() : Date.now());
  const reduced = () => { try { return !!ctx.motion.reduced(); } catch (_) { return false; } };
  const settings = () => { try { return ctx.settings || {}; } catch (_) { return {}; } };
  const listen = (target, ev, fn, opts) => {
    if (!target || !target.addEventListener) return;
    target.addEventListener(ev, fn, opts);
    cleanups.push(() => { try { target.removeEventListener(ev, fn, opts); } catch (_) {} });
  };
  const track = a => {
    if (a) { anims.add(a); try { a.addEventListener('finish', () => anims.delete(a)); a.addEventListener('cancel', () => anims.delete(a)); } catch (_) {} }
    return a;
  };
  const animate = (el, frames, opts) => { try { return el && el.animate ? track(el.animate(frames, opts)) : null; } catch (_) { return null; } };
  const announce = t => safe(() => ctx.announce(String(t || '')));
  const cheer = kind => { try { return ctx.kit.cheer(kind); } catch (_) { return ''; } };
  /* voix du compagnon (petits lecteurs, js/ui/voice.js) : le texte reste affiché */
  const say = t => { try { return ctx.voice ? Promise.resolve(ctx.voice.say(String(t || ''), { quiet: va.wanted() })) : Promise.resolve(false); } catch (_) { return Promise.resolve(false); } };
  const hush = () => { try { if (ctx.voice) ctx.voice.hush(); } catch (_) {} };
  const sound = name => { try { const f = ctx.audio && ctx.audio[name]; if (typeof f === 'function') return f(); } catch (_) {} return null; };
  const M = ctx.motion;
  const r1 = v => Math.round(v * 10) / 10;
  /* vols (motion.flyTo) : on garde leurs éléments pour les retirer si le jeu est démonté en plein vol */
  const flying = new Set();
  const fly = (from, to, opts) => {
    let before = null;
    try { before = new Set(document.querySelectorAll('.mo-fly')); } catch (_) {}
    const p = safe(() => M.flyTo(from, to, opts));
    try { for (const n of document.querySelectorAll('.mo-fly')) if (!before || !before.has(n)) flying.add(n); } catch (_) {}
    if (p && p.then) p.then(() => { for (const n of flying) if (!n.isConnected) flying.delete(n); });
    return p;
  };

  /* ================= DÉCOR ================= */

  /* petite pomme (décor, panier, pomme qui vole) centrée en (0, 0), rayon r */
  function appleGlyph(r, tone, cls = '') {
    const w = 2.16 * r, hh = 2 * r;
    return svg('g', { class: ('pm-a ' + cls).trim() + ' tone-' + tone },
      svg('path', { class: 'pm-a-stem', d: `M ${r1(0.02 * r)} ${r1(-0.66 * r)} q ${r1(0.08 * r)} ${r1(-0.32 * r)} ${r1(0.3 * r)} ${r1(-0.56 * r)}` }),
      svg('path', { class: 'pm-a-leaf', d: `M ${r1(0.12 * r)} ${r1(-0.86 * r)} q ${r1(0.5 * r)} ${r1(-0.5 * r)} ${r1(0.95 * r)} ${r1(-0.22 * r)} q ${r1(-0.45 * r)} ${r1(0.38 * r)} ${r1(-0.95 * r)} ${r1(0.22 * r)} Z` }),
      svg('path', { class: 'pm-a-body', d: L.applePath(w, hh, 0), transform: `translate(${r1(-w / 2)} ${r1(-hh / 2)})` }),
      svg('ellipse', { class: 'pm-a-shine', cx: r1(-0.46 * r), cy: r1(-0.22 * r), rx: r1(0.2 * r), ry: r1(0.36 * r), transform: `rotate(18 ${r1(-0.46 * r)} ${r1(-0.22 * r)})` }));
  }
  /* pomme qui s'envole vers le panier (nœud cloné par motion.flyTo, hors de .pm : classes globales pm-fly-*) */
  function miniApple(tone) {
    return svg('svg', { class: 'pm-fly tone-' + tone, viewBox: '-13 -15 26 28', width: '100%', height: '100%', 'aria-hidden': 'true', focusable: 'false' },
      appleGlyph(11, tone));
  }

  const bg = svg('svg', { class: 'pm-bg', 'aria-hidden': 'true', focusable: 'false' });
  const twigs = h('div', { class: 'pm-twigs', 'aria-hidden': 'true' });

  /* ---------- panier (viewBox 0 -16 120 116) ---------- */
  const SLOTS = L.basketSlots();
  const slotApples = SLOTS.map(s => {
    const inner = svg('g', { class: 'pb-apple-in' }, appleGlyph(s.r, 'rose'));
    const g = svg('g', { class: 'pb-apple', transform: `translate(${s.x} ${s.y}) rotate(${s.tilt})` }, inner);
    return { g, inner };
  });
  const basketSvg = svg('svg', { class: 'pm-basket-svg', viewBox: '0 -16 120 116', 'aria-hidden': 'true', focusable: 'false' },
    svg('ellipse', { class: 'pb-shadow', cx: '60', cy: '96', rx: '50', ry: '4' }),
    svg('path', { class: 'pb-handle-out', d: 'M 15 34 C 12 -17, 108 -17, 105 34' }),
    svg('path', { class: 'pb-handle', d: 'M 15 34 C 12 -17, 108 -17, 105 34' }),
    svg('ellipse', { class: 'pb-inside', cx: '60', cy: '34', rx: '53', ry: '11' }),
    svg('g', { class: 'pb-apples' }, slotApples.map(a => a.g)),
    svg('path', { class: 'pb-body', d: 'M 7 34 C 9 62, 14 86, 25 93 L 95 93 C 106 86, 111 62, 113 34 C 96 47, 24 47, 7 34 Z' }),
    svg('path', { class: 'pb-weave', d: 'M 12 58 C 40 66, 80 66, 108 58 M 16 74 C 42 81, 78 81, 104 74' }),
    svg('path', { class: 'pb-weave v', d: 'M 26 48 L 30 92 M 43 50 L 45 93 M 60 51 L 60 93 M 77 50 L 75 93 M 94 48 L 90 92' }),
    svg('path', { class: 'pb-rim-out', d: 'M 7 34 C 22 48, 98 48, 113 34' }),
    svg('path', { class: 'pb-rim', d: 'M 7 34 C 22 48, 98 48, 113 34' }));
  const badge = h('span', { class: 'pm-badge', 'aria-hidden': 'true' }, '0');
  const basket = h('div', { class: 'pm-basket', role: 'img', 'aria-label': frTypo('Panier : aucune pomme') }, basketSvg, badge);

  /* ---------- compagnon ---------- */
  /* compagnon du profil (espèce, accessoires, stade) ; son ombre au sol est celle du rig (une seule ombre) */
  const heroIn = h('div', { class: 'pm-hero-in', html: safe(() => ctx.petSVG(100, '')) || '' });
  const hero = h('div', { class: 'pm-hero', 'aria-hidden': 'true' }, heroIn);
  const heroSvg = heroIn.querySelector('svg');

  /* ---------- jauge du sprint ---------- */
  const sprintFill = h('div', { class: 'pm-sprint-fill' });
  const sprintTxt = h('span', { class: 'pm-sprint-txt hidden' });
  const sprintBar = h('div', { class: 'pm-sprint-bar' }, sprintFill);
  const sprintEl = h('div', { class: 'pm-sprint is-hidden', 'aria-hidden': 'true' },
    h('span', { class: 'pm-sprint-ico' }, '⏱️'), sprintBar, sprintTxt);

  const slot = h('div', { class: 'pm-slot' });
  const scene = h('div', { class: 'pm-scene' }, bg, twigs, slot, hero, basket, sprintEl);
  const helpIn = h('div', { class: 'pm-help-in' });
  const help = h('div', { class: 'pm-help' }, helpIn);
  const pad = h('div', { class: 'pm-pad' });
  /* répondre à voix haute (v2.3) : la ligne 👂 (et le 🎤 des choix) dans une pastille au bas de la scène */
  const va = createVoiceAnswer(ctx, {
    onProblem: msg => { if (cur && !cur.resolved && !cur.locked) showBubble(msg, 'soft', '🎙️'); },
    onChange: () => { if (helpIn.querySelector('.pm-idle')) showIdle(); }     /* « dis ou tape ta réponse » */
  });
  const vaBar = h('div', { class: 'va-row pm-voice' }, va.ear, va.dbg);
  scene.appendChild(vaBar);                          /* pastille posée sur l'herbe : le pavé garde sa hauteur */
  const box = h('div', { class: 'pm' }, scene, help, pad);
  root.appendChild(box);

  /* ================= ÉTAT ================= */
  let lay = null;
  let phase = 'init';                 /* init → modes (si chrono) → play → end */
  let cur = null;                     /* { item, info, parts, tries, hinted, resolved, locked, t0, hintShown, tone, card, eq, textEl, hole } */
  let ended = false, started = false, index = 0, picked = 0, shownPicked = 0, cheerShown = false, idleTimer = 0;
  let kp = null, kpDecimal = null, grid = null, learnEl = null, modesEl = null;
  const sp = { on: false, clock: null, anim: null, check: 0, over: false, learning: false, hidden: false };

  /* ================= MISE EN PAGE ================= */
  const place = (el, r) => { el.style.left = r.x + 'px'; el.style.top = r.y + 'px'; el.style.width = r.w + 'px'; el.style.height = r.h + 'px'; };
  function layout() {
    const W = Math.round(scene.clientWidth), H = Math.round(scene.clientHeight);
    if (!W || !H) return;
    if (lay && lay.W === W && lay.H === H) return;
    lay = L.sceneLayout(W, H);
    drawBg(lay);
    place(hero, lay.hero);
    place(basket, lay.basket);
    place(slot, lay.card);
    if (cur && cur.card) { drawCardShape(cur); fitCard(cur); }
  }

  /* fond : collines, tronc, herbe, ombres, feuillage et pommes qui se balancent (repère = pixels de la scène) */
  function drawBg(l) {
    const { W, H, canopyH: C, grassH: G } = l;
    clear(bg);
    bg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    bg.setAttribute('width', String(W));
    bg.setAttribute('height', String(H));
    const gid = uid + '-grass';
    bg.appendChild(svg('defs', null,
      svg('linearGradient', { id: gid, x1: '0', y1: '0', x2: '0', y2: '1' },
        svg('stop', { offset: '0', class: 'pm-g1' }), svg('stop', { offset: '1', class: 'pm-g2' }))));
    const yG = H - G;
    /* collines lointaines */
    bg.appendChild(svg('path', { class: 'pm-hill', d:
      `M 0 ${r1(yG - H * 0.05)} C ${r1(W * 0.16)} ${r1(yG - H * 0.13)}, ${r1(W * 0.36)} ${r1(yG - H * 0.1)}, ${r1(W * 0.52)} ${r1(yG - H * 0.04)} ` +
      `C ${r1(W * 0.7)} ${r1(yG - H * 0.14)}, ${r1(W * 0.88)} ${r1(yG - H * 0.11)}, ${W} ${r1(yG - H * 0.06)} L ${W} ${yG + 8} L 0 ${yG + 8} Z` }));
    /* tronc (au centre : la pomme-carte pend devant ; on voit sa base entre le compagnon et le panier) */
    const tw = Math.max(18, Math.min(W * 0.07, 42)), tx = W / 2, tTop = C * 0.5, tBot = yG + G * 0.32;
    const trunk = `M ${r1(tx - tw * 0.42)} ${r1(tTop)} C ${r1(tx - tw * 0.46)} ${r1((tTop + tBot) / 2)}, ${r1(tx - tw * 0.5)} ${r1(tBot - tw * 0.7)}, ${r1(tx - tw * 1.05)} ${r1(tBot)} ` +
      `L ${r1(tx + tw * 1.05)} ${r1(tBot)} C ${r1(tx + tw * 0.5)} ${r1(tBot - tw * 0.7)}, ${r1(tx + tw * 0.46)} ${r1((tTop + tBot) / 2)}, ${r1(tx + tw * 0.42)} ${r1(tTop)} Z`;
    /* deux branches qui partent dans le feuillage (on les voit quand aucune pomme-carte ne pend) */
    const by = Math.min(tTop + C * 0.78, tBot - tw * 2);
    const branches = `M ${r1(tx - tw * 0.1)} ${r1(by)} Q ${r1(tx - tw * 1.1)} ${r1(by - tw * 1.1)} ${r1(tx - tw * 2.6)} ${r1(C * 0.86)} ` +
      `M ${r1(tx + tw * 0.1)} ${r1(by + tw * 0.5)} Q ${r1(tx + tw * 1.0)} ${r1(by - tw * 0.6)} ${r1(tx + tw * 2.3)} ${r1(C * 0.84)}`;
    bg.appendChild(svg('path', { class: 'pm-branch-out', d: branches, 'stroke-width': r1(tw * 0.42 + 4.4) }));
    bg.appendChild(svg('path', { class: 'pm-branch', d: branches, 'stroke-width': r1(tw * 0.42) }));
    bg.appendChild(svg('path', { class: 'pm-trunk', d: trunk }));
    bg.appendChild(svg('path', { class: 'pm-bark', d:
      `M ${r1(tx - tw * 0.12)} ${r1(tBot - G * 0.9)} q ${r1(tw * 0.08)} ${r1(-G * 0.5)} 0 ${r1(-G)} M ${r1(tx + tw * 0.18)} ${r1(tBot - G * 0.35)} q ${r1(-tw * 0.06)} ${r1(-G * 0.4)} 0 ${r1(-G * 0.8)}` }));
    /* herbe ondulée */
    let gd = `M 0 ${r1(yG + 4)}`;
    const waves = Math.max(3, Math.round(W / 90));
    for (let i = 0; i < waves; i++) {
      const x0 = (W * i) / waves, x1 = (W * (i + 1)) / waves;
      gd += ` Q ${r1((x0 + x1) / 2)} ${r1(yG - 7 - (i % 2) * 4)} ${r1(x1)} ${r1(yG + 4)}`;
    }
    gd += ` L ${W} ${H} L 0 ${H} Z`;
    bg.appendChild(svg('path', { class: 'pm-grass', d: gd, fill: `url(#${gid})` }));
    /* touffes et fleurs (pas sous le panier ni sous le compagnon) */
    const free = x => x > l.hero.x + l.hero.w + 6 && x < l.basket.x - 10;
    const tufts = [], flowers = [];
    for (let i = 0; i < 9; i++) {
      const x = ((i * 0.137 + 0.06) % 1) * W, y = yG + G * (0.35 + ((i * 7) % 5) * 0.11);
      if (i % 3 === 2 && free(x)) flowers.push([x, y]);
      else tufts.push(`M ${r1(x - 5)} ${r1(y)} l 3 -7 l 2 6 l 3 -8 l 2 9`);
    }
    bg.appendChild(svg('path', { class: 'pm-tuft', d: tufts.join(' ') }));
    for (const [x, y] of flowers) {
      bg.appendChild(svg('g', { class: 'pm-flower', transform: `translate(${r1(x)} ${r1(y)})` },
        [0, 72, 144, 216, 288].map(a => svg('circle', { class: 'pm-petal', cx: r1(Math.cos(a * Math.PI / 180) * 3.4), cy: r1(Math.sin(a * Math.PI / 180) * 3.4), r: '2.6' })),
        svg('circle', { class: 'pm-heart', r: '2' })));
    }
    /* feuillage : couche du fond, lobes de devant, reflets */
    const R0 = C * 0.42, R1 = C * 0.35;
    const back = svg('g', { class: 'pm-leaf-back' }, svg('rect', { x: '-2', y: '-2', width: String(W + 4), height: r1(C * 0.42) }));
    const nB = Math.max(3, Math.ceil(W / (R0 * 1.25)) + 1);
    for (let i = 0; i < nB; i++) {
      const x = -R0 * 0.3 + (i * (W + R0 * 0.6)) / (nB - 1);
      back.appendChild(svg('circle', { cx: r1(x), cy: r1(C * 0.36 + ((i * 5) % 3) * C * 0.03), r: r1(R0 * (0.92 + ((i * 7) % 4) * 0.04)) }));
    }
    bg.appendChild(back);
    const front = svg('g', { class: 'pm-leaf-front' }), shine = svg('g', { class: 'pm-leaf-hi' });
    const nF = Math.max(3, Math.ceil(W / (R1 * 1.35)) + 1);
    for (let i = 0; i < nF; i++) {
      const x = (i * W) / (nF - 1) + ((i % 2) ? R1 * 0.12 : -R1 * 0.12);
      const y = C * 0.6 + ((i * 3) % 4) * C * 0.035, rr = R1 * (0.9 + ((i * 5) % 3) * 0.06);
      front.appendChild(svg('circle', { cx: r1(x), cy: r1(y), r: r1(rr) }));
      shine.appendChild(svg('circle', { cx: r1(x - rr * 0.36), cy: r1(y - rr * 0.4), r: r1(rr * 0.3) }));
    }
    bg.append(front, shine);
    /* pommes du pommier : petits éléments à part, balancés en CSS (animation composée par le GPU : le grand
       décor SVG n'est jamais repeint) ; plus bas sur les côtés si la pomme-carte laisse la place */
    clear(twigs);
    const ar = Math.max(6.5, Math.min(C * 0.085, 13));
    const cx0 = l.card.x - ar - 6, cx1 = l.card.x + l.card.w + ar + 6;
    [0.06, 0.2, 0.34, 0.66, 0.8, 0.94].forEach((fx, i) => {
      const x = fx * W, low = x < cx0 || x > cx1;
      const y = low ? C * 0.8 + (i % 2) * C * 0.06 : C * (0.16 + (i % 3) * 0.05);
      const tw = 2.4 * ar, th = 2.65 * ar;
      const pic = svg('svg', { viewBox: `${r1(-1.2 * ar)} ${r1(-1.55 * ar)} ${r1(tw)} ${r1(th)}`, width: r1(tw), height: r1(th), focusable: 'false' },
        svg('path', { class: 'pm-a-twig', d: `M 0 ${r1(-1.55 * ar)} L 0 ${r1(-0.7 * ar)}` }),
        appleGlyph(ar, i === 4 ? 'doree' : 'rose'));
      const twig = h('span', { class: 'pm-twig' + (i % 2 ? ' b' : '') }, pic);
      Object.assign(twig.style, { left: r1(x - tw / 2) + 'px', top: r1(y - 1.55 * ar) + 'px', width: r1(tw) + 'px', height: r1(th) + 'px', animationDelay: -(i * 0.73).toFixed(2) + 's' });
      twigs.appendChild(twig);
    });
  }

  /* ================= POMME-CARTE ================= */
  let cardSeq = 0;
  function buildCard(c) {
    const card = h('div', { class: 'pm-card tone-' + c.tone, role: 'group' });
    const cardSvg = svg('svg', { class: 'pm-card-svg', 'aria-hidden': 'true', focusable: 'false' });
    const textEl = h('div', { class: 'pm-card-text' });
    const eq = h('div', { class: 'pm-eq' });
    textEl.appendChild(eq);
    card.append(cardSvg, textEl);
    c.card = card; c.cardSvg = cardSvg; c.textEl = textEl; c.eq = eq; c.gid = uid + '-c' + (++cardSeq);
    /* énoncé : deux lignes (avant le signe = / ≈, puis le signe et la suite) ; la case = zone de réponse */
    c.lines = c.parts.lines.map(tokens => {
      const line = h('span', { class: 'pm-line' });
      tokens.forEach((tk, i) => {
        const prev = tokens[i - 1];
        const glue = i === 0 || (prev && prev.k === 'par' && prev.t === '(') || (tk.k === 'par' && tk.t === ')');
        let el;
        if (tk.k === 'hole') el = c.hole;
        else if (tk.k === 'num') {
          /* espace des milliers un peu plus visible (l'espace fine est très étroite en Fredoka) */
          const groups = tk.t.split(NNBSP);
          el = h('span', { class: 'pm-n' }, groups.map((g, gi) => (gi ? [h('span', { class: 'pm-nn' }, NNBSP), g] : g)));
        } else {
          const cls = { op: tk.rel ? 'pm-op pm-rel' : 'pm-op', par: 'pm-par', word: 'pm-w' }[tk.k] || 'pm-w';
          el = h('span', { class: cls }, tk.t);
        }
        el.classList.toggle('g', !!glue);
        line.appendChild(el);
      });
      eq.appendChild(line);
      return line;
    });
    card.setAttribute('aria-label', L.promptAria(c.item.prompt));
    c.hole.style.setProperty('--pm-hole-ch', String(c.info.holeCh));
    drawCardShape(c);
    return card;
  }
  /* silhouette de la pomme à la taille de la carte (bord coloré cerné de brun, reflet, queue et feuille) */
  function drawCardShape(c) {
    if (!lay || !c.cardSvg) return;
    const w = lay.card.w, hh = lay.card.h, s = lay.card.stem, p = 5;
    const S = c.cardSvg;
    clear(S);
    S.setAttribute('viewBox', `0 0 ${w} ${hh}`);
    S.setAttribute('width', String(w));
    S.setAttribute('height', String(hh));
    const d = L.applePath(w, hh, p);
    const top = p + L.APPLE_TOP * (hh - 2 * p);
    const sx = w / 2, sw = Math.max(4, w * 0.017);
    const stem = `M ${r1(sx)} ${r1(top + 6)} C ${r1(sx)} ${r1(top - s * 0.3)}, ${r1(sx + 1)} ${r1(-s * 0.35)}, ${r1(sx + w * 0.022)} ${r1(-s)}`;
    const lx = sx + 2, ly = r1(top - s * 0.62);
    const P = (u, v) => r1(p + u * (w - 2 * p)) + ' ' + r1(p + v * (hh - 2 * p));
    const gloss = `M ${P(0.25, 0.012)} C ${P(0.09, 0.035)}, ${P(0, 0.2)}, ${P(0, 0.43)}`;   /* reflet sur le bord gauche */
    const leaf = `M ${r1(lx)} ${ly} C ${r1(lx + w * 0.05)} ${r1(ly - hh * 0.1)}, ${r1(lx + w * 0.14)} ${r1(ly - hh * 0.08)}, ${r1(lx + w * 0.19)} ${r1(ly - hh * 0.03)} ` +
      `C ${r1(lx + w * 0.13)} ${r1(ly + hh * 0.035)}, ${r1(lx + w * 0.05)} ${r1(ly + hh * 0.04)}, ${r1(lx)} ${ly} Z`;
    S.append(
      svg('defs', null, svg('linearGradient', { id: c.gid, x1: '0.15', y1: '0', x2: '0.85', y2: '1' },
        svg('stop', { offset: '0', class: 'pc-s1' }), svg('stop', { offset: '0.55', class: 'pc-s2' }), svg('stop', { offset: '1', class: 'pc-s3' }))),
      svg('path', { class: 'pc-stem-out', d: stem, 'stroke-width': r1(sw + 3.5) }),
      svg('path', { class: 'pc-stem', d: stem, 'stroke-width': r1(sw) }),
      svg('path', { class: 'pc-leaf', d: leaf }),
      svg('path', { class: 'pc-vein', d: `M ${r1(lx + 2)} ${r1(ly - 1)} Q ${r1(lx + w * 0.09)} ${r1(ly - hh * 0.05)} ${r1(lx + w * 0.17)} ${r1(ly - hh * 0.03)}` }),
      svg('path', { class: 'pc-out', d }),
      svg('path', { class: 'pc-skin', d, fill: `url(#${c.gid})` }),
      svg('path', { class: 'pc-rim', d }),
      svg('path', { class: 'pc-gloss', d: gloss, pathLength: '100' }));
  }
  /* le calcul tient dans la pomme : grand corps, réduit seulement si besoin (sur 2 lignes au besoin) */
  function fitCard(c) {
    if (!c || !c.eq || !lay) return;
    const maxW = c.textEl.clientWidth, maxH = c.textEl.clientHeight;
    if (!maxW || !maxH) return;
    let fs = Math.max(20, Math.min(lay.card.h * 0.2, lay.card.w * 0.15, 64));
    const min = Math.max(15, Math.min(fs, 24) * 0.66);
    for (let i = 0; i < 24; i++) {
      c.eq.style.fontSize = fs.toFixed(1) + 'px';
      const over = c.lines.some(l => l.offsetWidth > maxW + 0.5) || c.eq.offsetHeight > maxH + 0.5;
      if (!over || fs <= min) break;
      fs = Math.max(min, fs - Math.max(1, fs * 0.06));
    }
    c.fs = fs;
  }
  /* la case grandit pendant la saisie : on vérifie que la ligne tient encore */
  function refitIfNeeded(c) {
    if (!c || !c.lines) return;
    const maxW = c.textEl.clientWidth;
    if (c.lines.some(l => l.offsetWidth > maxW + 0.5)) fitCard(c);
  }

  /* la pomme pousse sur la branche (ou apparaît en fondu) */
  function showCard(c) {
    clearOldCards();
    slot.appendChild(c.card);
    if (reduced()) { animate(c.card, [{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' }); return; }
    animate(c.card, [
      { transform: 'translateY(-10%) scale(.32)', opacity: 0 },
      { transform: 'translateY(2%) scale(1.04)', opacity: 1, offset: 0.62 },
      { transform: 'none', opacity: 1 }
    ], { duration: 460, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    animate(c.card, [{ rotate: '0deg' }, { rotate: '2.6deg', offset: 0.3 }, { rotate: '-1.6deg', offset: 0.62 }, { rotate: '0.6deg', offset: 0.85 }, { rotate: '0deg' }],
      { duration: 1100, delay: 280, easing: 'ease-in-out' });
  }
  /* cartes qui finissent de partir : retirées dès qu'une nouvelle arrive (jamais deux énoncés lisibles) */
  function clearOldCards() {
    for (const el of Array.from(slot.children)) if (el.classList.contains('is-leaving')) el.remove();
  }
  /* la carte qui s'en va garde une copie figée de sa case (le vrai affichage du pavé sert à la suivante) */
  function freezeHole(c) {
    if (!c || !c.card || c.frozen) return;
    c.frozen = true;
    c.card.setAttribute('aria-hidden', 'true');
    c.card.classList.add('is-leaving');
    if (kp && c.hole === kp.answer && kp.answer.parentNode) {
      const ghost = kp.answer.cloneNode(true);
      ghost.removeAttribute('role'); ghost.removeAttribute('aria-live');
      kp.answer.replaceWith(ghost);
    }
  }

  /* ================= PANIER ================= */
  function slotPoint(k) {
    const r = basketSvg.getBoundingClientRect();
    const s = SLOTS[Math.min(k, SLOTS.length - 1)] || { x: 60, y: 20 };
    const sx = k < SLOTS.length ? s.x : 60, sy = k < SLOTS.length ? s.y : 18;
    return { x: r.left + (sx / 120) * r.width, y: r.top + ((sy + 16) / 116) * r.height };
  }
  function setBasketCount(n) {
    badge.textContent = String(n);
    basket.setAttribute('aria-label', frTypo(n ? 'Panier : ' + n + ' ' + L.plural(n, 'pomme', 'pommes') : 'Panier : aucune pomme'));
  }
  function basketArrive(k, tone) {
    if (!alive) return;
    sound('coin');
    shownPicked++;
    setBasketCount(shownPicked);
    const a = slotApples[k];
    if (a) {
      a.g.setAttribute('class', 'pb-apple is-in');
      const glyph = a.inner.firstChild;
      if (glyph) glyph.setAttribute('class', 'pm-a tone-' + tone);
      if (!reduced()) animate(a.inner, [{ transform: 'translateY(-9px) scale(.8)', opacity: 0.4 }, { transform: 'translateY(1px) scale(1.06)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }],
        { duration: 300, easing: 'ease-out' });
    }
    safe(() => M.pop(badge, { scale: 1.3, dur: 320 }));
    safe(() => M.squash(basketSvg, { amount: 0.5, dur: 420 }));
    hop();
    /* la pomme gagnée rejoint le compteur 🍎 de l'en-tête */
    const to = ctx.applesEl;
    if (to) fly(badge, to, { emoji: '🍎', size: 26, dur: 560, arc: 0.3 });
  }
  /* bonds du compagnon par les humeurs du rig (hop : un saut, joy : deux) : le corps saute, son ombre reste au sol
     et rétrécit ; la classe est retirée après coup (sinon l'oreille cesse de frémir au repos) */
  let moodT = 0;
  function heroMood(cls, ms) {
    if (!heroSvg || reduced()) return;
    moodT = cancel(moodT);
    heroSvg.classList.remove('hop', 'joy');
    void heroSvg.getBoundingClientRect();
    heroSvg.classList.add(cls);
    moodT = later(() => { moodT = 0; heroSvg.classList.remove(cls); }, ms);
  }
  function hop() { heroMood('hop', 600); }
  function heroJoy() { heroMood('joy', 1050); }

  /* ================= BULLES ================= */
  function showBubble(content, kind, icon) {
    idleTimer = cancel(idleTimer);
    clear(helpIn);
    const b = safe(() => ctx.kit.bubble(content, kind, { icon }));
    if (b) helpIn.appendChild(b);
    cheerShown = false;
    return b;
  }
  function showIdle() {
    idleTimer = cancel(idleTimer);
    cheerShown = false;
    clear(helpIn);
    if (!cur) return;
    const idle = L.idleText(cur.item);
    helpIn.appendChild(h('p', { class: 'pm-idle' }, frTypo(va.wanted() ? idle.replace('tape ta réponse', 'dis ou tape ta réponse')
      .replace('choisis le nombre', 'dis ou touche le nombre') : idle)));
  }
  /* « Astuce : » + la stratégie (après une 1re erreur, au joker, ou d'emblée en coup de pouce) */
  function showTip(why) {
    const c = cur;
    if (!c) return;
    c.hintShown = true;
    /* astuce longue : sans la phrase d'encouragement ni la pastille, pour qu'elle couvre le moins possible la scène */
    const long = c.item.hint.length > L.LONG_TIP;
    const head = why === 'retry' ? (long ? '' : cheer('retry')) : why === 'assist' ? frTypo('Petit coup de pouce !') : '';
    const tip = L.keepMath(c.item.hint);
    const node = h('span', null, head ? head + ' ' : null, h('b', { class: 'pm-tip' }, frTypo('Astuce :') + ' '), tip);
    const b = showBubble(node, 'hint', long ? '' : '💡');
    if (b && long) b.classList.add('is-long');
    announce((head ? head + ' ' : '') + frTypo('Astuce : ') + c.item.hint);
    if (why !== 'assist') say((head ? head + ' ' : '') + frTypo('Astuce : ') + c.item.hint);   /* coup de pouce : dit avec le calcul */
  }

  /* ================= SAISIE ================= */
  function ensureKeypad(decimal) {
    if (kp && kpDecimal === decimal) return;
    if (kp) {
      const old = kp.answer;
      safe(() => kp.destroy());
      if (old && old.parentNode) old.remove();
    }
    kp = ctx.kit.keypad({ decimal, maxLen: L.MAX_LEN, onSubmit: onTyped, onChange: onTypedChange });
    kpDecimal = decimal;
    kp.answer.classList.add('pm-hole');
    kp.el.classList.add('pm-keypad');
    pad.prepend(kp.el);
  }
  function dropGrid() { if (grid) { grid.el.remove(); grid = null; } }
  /* pavé (décimal si besoin) ou QCM d'estimation → la case de la pomme */
  function setInput(c) {
    if (c.info.choice) {
      if (kp) { kp.disable(true); kp.el.classList.add('hidden'); }
      dropGrid();
      const choices = c.item.choices.map(ch => ({ label: typeof ch.label === 'string' ? numNode(ch.label) : ch.label, value: ch.value }));
      grid = ctx.kit.choiceGrid(choices, { onPick });
      grid.el.classList.add('pm-choices');
      pad.appendChild(grid.el);
      va.placeIn(vaBar, va.ear);
      va.attachChoices(grid);
      va.choices(c.item.choices.map(ch => ({ value: ch.value, num: Number.isFinite(Number(ch.value)) ? Number(ch.value) : undefined,
        label: L.choiceLabel(c.item, ch.value) })));
      safe(() => M.stagger(grid.buttons, b => M.enter(b, { from: 'scale', dur: 300 }), 50));
      c.hole = h('div', { class: 'answer pm-hole empty', role: 'status', 'aria-live': 'polite', 'aria-label': 'Ta réponse' }, h('span', { class: 'pm-hole-val' }));
    } else {
      dropGrid();
      ensureKeypad(c.info.decimal);
      kp.el.classList.remove('hidden');
      kp.clear(); kp.setState(null); kp.disable(false);
      kp.answer.classList.remove('pm-revealed');
      c.hole = kp.answer;
      va.attachKeypad(kp);
      const v = c.info.value;
      va.number({ answer: v, ignore: promptNumbers(c.item.prompt), voice: !c.info.decimal && Number.isInteger(v) && v >= 0 && v <= 99999 });
    }
  }
  /* nombres écrits dans l'énoncé : jamais comptés faux à la voix (l'enfant relit souvent le calcul) */
  function promptNumbers(prompt) {
    return (String(prompt || '').match(/\d+(?:[\s\u00A0\u202F]\d{3})*(?:,\d+)?/g) || [])
      .map(x => Number(x.replace(/[\s\u00A0\u202F]/g, '').replace(',', '.'))).filter(Number.isFinite);
  }
  /* nombre affiché avec une espace des milliers un peu plus visible (« 3 400 ») */
  const numNode = text => {
    const groups = String(text).split(NNBSP);
    return h('span', null, groups.map((g, gi) => (gi ? [h('span', { class: 'pm-nn' }, NNBSP), g] : g)));
  };
  /* case du QCM : texte et état */
  function setChoiceHole(c, label, state) {
    if (!c || !c.hole || c.info.choice !== true) return;
    const v = c.hole.firstChild;
    clear(v);
    if (label) v.appendChild(numNode(label));
    c.hole.classList.toggle('empty', !label);
    c.hole.classList.toggle('right', state === 'right');
    c.hole.classList.toggle('wrong', state === 'wrong');
    refitIfNeeded(c);
  }

  function onTypedChange() {
    const c = cur;
    if (!c || c.resolved) return;
    if (cheerShown) showIdle();
    refitIfNeeded(c);
  }
  function onTyped(str) {
    const c = cur;
    if (!c || c.resolved || c.locked || c.info.choice) return;
    const res = L.checkTyped(str, c.item);
    if (!res.valid) return;
    if (res.ok) onRight(c);
    else onWrong(c, res.value);
  }
  function onPick(value) {
    const c = cur;
    if (!c || c.resolved || c.locked || !c.info.choice) return;
    if (L.checkChoice(value, c.item)) onRight(c, value);
    else onWrong(c, value);
  }

  /* ---------- juste ---------- */
  function onRight(c, value) {
    if (c.resolved) return;
    c.resolved = true;
    hush();
    idleTimer = cancel(idleTimer);
    const ms = Math.max(0, Math.round(nowMs() - c.t0));
    const hinted = !!(c.hinted || c.tries > 0);
    if (c.info.choice) {
      grid.mark(value, 'right'); grid.disable();
      setChoiceHole(c, L.choiceLabel(c.item, value), 'right');
    } else { kp.setState('right'); kp.disable(true); }
    const fb = safe(() => ctx.report(c.item, { correct: true, hinted, ms, tries: c.tries + 1 })) || {};
    const streak = fb && !fb.ignored ? (fb.streak | 0) : 0;
    peekNext();
    safe(() => ctx.kit.celebrateRight(c.hole, streak));
    const msg = cheer(hinted ? 'helped' : 'right');
    showBubble(msg, 'good', '🌟');
    cheerShown = true;
    announce(msg);
    const k = picked++;                      /* place dans le panier réservée tout de suite (fin de sprint pendant le vol) */
    later(() => pickApple(c, k), CELEBRATE_MS);
    later(nextItem, NEXT_MS);
  }
  /* la pomme-carte rétrécit, une petite pomme s'envole dans le panier */
  function pickApple(c, k) {
    const card = c.card;
    if (!card) return;
    const target = slotPoint(k);
    let landed = false;
    const land = () => { if (!landed) { landed = true; basketArrive(k, c.tone); } };
    if (!reduced()) {
      const size = Math.round(Math.max(40, Math.min(lay ? lay.card.h * 0.4 : 60, 92)));
      fly(card, target, { emoji: miniApple(c.tone), size, dur: FLY_MS, arc: 0.28, popTarget: false, onArrive: land });
      later(land, FLY_MS + 700);             /* filet : si le vol n'a pas pu partir, la pomme arrive quand même */
    }
    freezeHole(c);
    const a = animate(card, reduced() ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ transform: 'none', transformOrigin: '50% 58%', opacity: 1 }, { transform: 'scale(.3)', transformOrigin: '50% 58%', opacity: 0 }],
    { duration: reduced() ? 150 : NEXT_MS - CELEBRATE_MS, easing: 'cubic-bezier(.55, 0, .85, .45)', fill: 'forwards' });
    const gone = () => { if (card.parentNode) card.remove(); };
    if (a) a.finished.then(gone, gone); else gone();
    if (reduced()) land();
  }

  /* ---------- faux ---------- */
  function onWrong(c, value) {
    if (c.resolved || c.locked) return;
    c.tries++;
    c.hinted = true;
    if (c.info.choice) { grid.mark(value, 'wrong'); setChoiceHole(c, L.choiceLabel(c.item, value), 'wrong'); }
    else kp.setState('wrong');
    safe(() => ctx.kit.gentleWrong(c.card));
    if (c.tries === 1) {
      showTip('retry');
      later(() => {
        if (cur !== c || c.resolved || c.locked) return;
        if (c.info.choice) setChoiceHole(c, '', null);
        else if (kp.answer.classList.contains('wrong')) { kp.clear(); kp.setState(null); }
      }, WRONG_CLEAR_MS);
      return;
    }
    /* 2e erreur : la réponse s'écrit dans la case, puis le calcul détaillé (le micro attend « J’ai compris ») */
    c.locked = true;
    va.pause(true);
    if (c.info.choice) grid.disable(); else kp.disable(true);
    sprintPause('learn');
    later(() => {
      if (cur !== c) return;
      if (c.info.choice) {
        grid.reveal(c.item.answer); grid.dimOthers(c.item.answer);
        setChoiceHole(c, L.choiceLabel(c.item, c.item.answer), null);
      } else { kp.set(c.info.raw); kp.setState(null); }
      c.hole.classList.add('pm-revealed');
      refitIfNeeded(c);
      safe(() => M.pop(c.hole, { scale: 1.1, dur: 360 }));
      showLearn(c);
    }, REVEAL_MS);
  }
  function showLearn(c) {
    removeLearn();
    clear(helpIn);
    cheerShown = false;
    const head = cheer('learn');
    const lines = L.explainSentences(c.item.explain);
    const node = h('span', null, h('span', { class: 'pm-learn-head' }, head),
      lines.map(l => ['\n', l.conclusion ? h('b', { class: 'pm-learn-end' }, L.keepMath(l.t)) : L.keepMath(l.t)]));
    const text = head + ' ' + c.item.explain;
    const ok = h('button', { type: 'button', class: 'btn big block pm-learn-ok' }, 'J’ai compris ✓');
    /* même pastille 🤗 que les autres jeux pour l'explication (D4-24) */
    learnEl = h('div', { class: 'pm-learn' }, ctx.kit.bubble(node, 'soft'), ok);
    listen(ok, 'click', () => learnDone(c));
    pad.classList.add('is-learning');
    pad.appendChild(learnEl);
    animate(learnEl, reduced() ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: reduced() ? 150 : 300, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    announce(text);
    say(text);
    try { ok.focus({ preventScroll: true }); } catch (_) {}
  }
  function removeLearn() {
    if (learnEl) { learnEl.remove(); learnEl = null; }
    pad.classList.remove('is-learning');
  }
  function learnDone(c) {
    if (cur !== c || c.resolved) return;
    c.resolved = true;
    safe(() => ctx.report(c.item, { correct: false, hinted: true, ms: Math.max(0, Math.round(nowMs() - c.t0)), tries: 2 }));
    peekNext();
    removeLearn();
    sprintResume('learn');
    /* la pomme remonte dans l'arbre : on la retrouvera une autre fois */
    const card = c.card;
    freezeHole(c);
    const a = animate(card, reduced() ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-34%) scale(.55)', opacity: 0 }],
    { duration: reduced() ? 150 : AFTER_LEARN_MS - 10, easing: 'cubic-bezier(.55, 0, .85, .45)', fill: 'forwards' });
    const gone = () => { if (card && card.parentNode) card.remove(); };
    if (a) a.finished.then(gone, gone); else gone();
    later(nextItem, AFTER_LEARN_MS);
  }

  /* ---------- joker 💡 : l'astuce avant de répondre (l'item compte comme aidé) ---------- */
  safe(() => ctx.onJoker(() => {
    const c = cur;
    if (!alive) return false;
    /* rien à expliquer pour l'instant : on montre doucement où regarder (aucun joker dépensé) */
    if (phase === 'modes' && modesEl) { safe(() => M.pop(modesEl, { scale: 1.03, dur: 300 })); return false; }
    if (learnEl) { const lb = learnEl.querySelector('.kit-bubble'); if (lb) safe(() => M.pop(lb, { scale: 1.03, dur: 300 })); return false; }
    if (phase !== 'play' || !c || c.resolved || c.locked) return false;
    if (c.hintShown) {
      const b = helpIn.querySelector('.kit-bubble');
      if (b) safe(() => M.pop(b, { scale: 1.04, dur: 300 }));
      else showTip('joker');
      return false;
    }
    c.hinted = true;
    showTip('joker');
    return true;
  }));

  /* ================= ITEM ================= */
  /* v2.2.2, voix fluide (ctx.voice.canPrepare) : l'item suivant est tiré dès que celui-ci est rapporté, et son calcul
     calculé pendant que la pomme s'envole ; sans voix fluide, rien ne change */
  let upcoming = null;
  const lineFor = (item, n) => L.promptAria(item.prompt) + (item.assist ? ' ' + frTypo('Petit coup de pouce ! Astuce : ') + item.hint : n <= 1 ? ' ' + L.idleText(item) : '');
  function peekNext() {
    if (upcoming || !alive || ended || (sp.on && sp.over) || !ctx.voice || !ctx.voice.canPrepare) return;
    const item = safe(() => ctx.nextItem());
    upcoming = { item };
    if (item) safe(() => ctx.voice.prepareNext(lineFor(item, index + 1)));
  }
  function nextItem() {
    if (!alive || ended) return;
    if (sp.on && sp.over) { finish(); return; }
    const item = upcoming ? upcoming.item : safe(() => ctx.nextItem());
    upcoming = null;
    if (!item) { finish(); return; }
    index++;
    const c = {
      item, info: L.answerInfo(item), parts: L.promptParts(item.prompt), tone: L.toneOf(index - 1),
      tries: 0, hinted: !!item.assist, resolved: false, locked: false, t0: nowMs(), hintShown: false
    };
    cur = c;
    removeLearn();
    setInput(c);
    buildCard(c);
    showCard(c);
    fitCard(c);
    if (item.assist) showTip('assist');
    else if (cheerShown) { idleTimer = cancel(idleTimer); idleTimer = later(() => { idleTimer = 0; if (cur === c && cheerShown) showIdle(); }, IDLE_AFTER_MS); }
    else showIdle();
    announce(L.promptAria(item.prompt));
    if (sp.on && sp.clock && !sp.clock.started) sprintBegin();
    c.t0 = nowMs();
    /* petits lecteurs : le calcul dit à voix haute (au premier, comment répondre ; coup de pouce : l'astuce) */
    const line = lineFor(item, index);
    say(line).then(ok => { if (ok && cur === c && !c.resolved && c.tries === 0) c.t0 = nowMs(); });
    /* voix fluide : ni l'astuce ni l'explication ne sont calculées d'avance (elles retarderaient la pomme suivante) ;
       après une erreur, l'encouragement enregistré (instantané) couvre l'essentiel de leur calcul */
  }

  /* ================= SPRINT ================= */
  function sprintSetup() {
    sp.on = true;
    sp.clock = L.createSprintClock(L.SPRINT_MS);
    sprintEl.classList.remove('is-hidden');
    sprintFill.style.transform = 'scaleX(1)';
    if (!reduced()) animate(sprintEl, [{ opacity: 0, transform: 'translate(-50%, -8px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 300, easing: 'cubic-bezier(.22, 1, .36, 1)' });
  }
  function sprintBegin() {
    const t = nowMs();
    sp.clock.start(t);
    try {
      sp.anim = sprintFill.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: L.SPRINT_MS, easing: 'linear', fill: 'forwards' });
      track(sp.anim);
    } catch (_) { sp.anim = null; }
    if (sp.hidden) sprintPause('hidden');
    else sprintSchedule();
    announce(frTypo('Sprint : une minute pour remplir le panier !'));
  }
  function sprintSchedule() {
    sp.check = cancel(sp.check);
    if (!sp.on || sp.over || !sp.clock || !sp.clock.running) return;
    sp.check = later(sprintTick, sp.clock.remaining(nowMs()) + 30);
  }
  function sprintTick() {
    sp.check = 0;
    if (!sp.on || sp.over) return;
    if (sp.clock.done(nowMs())) sprintOver();
    else sprintSchedule();
  }
  function sprintPause(why) {
    if (why === 'learn') sp.learning = true;
    if (why === 'hidden') sp.hidden = true;
    if (!sp.on || sp.over || !sp.clock || !sp.clock.running) return;
    sp.clock.pause(nowMs());
    sp.check = cancel(sp.check);
    if (sp.anim) { try { sp.anim.pause(); sp.anim.currentTime = sp.clock.elapsed(nowMs()); } catch (_) {} }
  }
  function sprintResume(why) {
    if (why === 'learn') sp.learning = false;
    if (why === 'hidden') sp.hidden = false;
    if (!sp.on || sp.over || !sp.clock || !sp.clock.started || sp.clock.running || sp.learning || sp.hidden) return;
    const t = nowMs();
    sp.clock.resume(t);
    if (sp.anim) { try { sp.anim.currentTime = sp.clock.elapsed(t); sp.anim.play(); } catch (_) {} }
    sprintSchedule();
  }
  /* 60 s écoulées : on finit tranquillement la pomme en cours, puis c'est le bilan */
  function sprintOver() {
    if (sp.over) return;
    sp.over = true;
    sp.check = cancel(sp.check);
    if (sp.anim) { try { sp.anim.finish(); } catch (_) {} }
    sprintBar.classList.add('hidden');
    sprintTxt.textContent = frTypo(cur && !cur.resolved ? 'Dernière pomme !' : 'Fini !');
    sprintTxt.classList.remove('hidden');
    sprintEl.classList.add('is-over');
    safe(() => M.pop(sprintEl, { scale: 1.08, dur: 360 }));
    announce(frTypo(cur && !cur.resolved ? 'Le temps du sprint est écoulé : termine cette pomme !' : 'Le temps du sprint est écoulé.'));
    if (!cur || cur.resolved) later(() => { if (!ended && (!cur || cur.resolved)) finish(); }, 120);
  }
  function sprintStop() {
    sp.check = cancel(sp.check);
    if (sp.anim) { try { sp.anim.pause(); } catch (_) {} }
  }

  /* ================= ÉCRAN D'ACCUEIL DU JEU (chrono permis par les parents) ================= */
  function showModes() {
    phase = 'modes';
    const mode = (cls, ico, title, sub) => h('button', { type: 'button', class: 'pm-mode ' + cls },
      h('span', { class: 'pm-mode-ico', 'aria-hidden': 'true' }, ico),
      h('span', { class: 'pm-mode-txt' }, h('b', null, title), h('small', null, sub)));
    const calm = mode('is-calm', '🧺', 'Cueillette tranquille', 'À ton rythme, sans chrono');
    const fast = mode('is-sprint', '⏱️', 'Sprint 60' + NNBSP + 's', 'Une minute pour remplir le panier');
    modesEl = h('div', { class: 'pm-modes', role: 'group', 'aria-label': 'Choisis ta façon de jouer' }, calm, fast);
    pad.appendChild(modesEl);
    showBubble(frTypo('Comment veux-tu cueillir les pommes ?'), 'hint', '🍎');
    announce(frTypo('Comment veux-tu cueillir les pommes ? Cueillette tranquille, ou sprint d’une minute.'));
    say(frTypo('Comment veux-tu cueillir les pommes ? Cueillette tranquille, ou sprint d’une minute ?'));
    safe(() => M.stagger([calm, fast], b => M.enter(b, { from: 'bottom', dur: 360 }), 80));
    listen(calm, 'click', () => begin(false));
    listen(fast, 'click', () => begin(true));
  }
  function begin(sprint) {
    if (phase === 'play' || ended || !alive) return;
    phase = 'play';
    sound('tap');
    if (modesEl) { modesEl.remove(); modesEl = null; }
    if (sprint) sprintSetup();
    nextItem();
    va.autoStart();                                    /* micro déjà allumé dans un autre jeu de la séance */
  }

  /* ================= FIN DE MANCHE ================= */
  function finish() {
    if (ended) return;
    ended = true;
    phase = 'end';
    sprintStop();
    idleTimer = cancel(idleTimer);
    if (kp) kp.disable(true);
    if (grid) grid.disable();
    removeLearn();
    heroJoy();
    if (sp.on && sp.over) sprintTxt.textContent = frTypo('Fini !');
    const n = picked, apples = n + NNBSP + L.plural(n, 'pomme', 'pommes');
    let msg;
    if (sp.on && sp.over) msg = n ? 'Le sprint est fini : ' + apples + ' dans ton panier !' : 'Le sprint est fini, bravo pour ta persévérance !';
    else if (sp.on) msg = n ? 'Cueillette finie avant la fin du chrono : ' + apples + ' dans ton panier !' : 'Cueillette finie avant la fin du chrono, bravo pour ta persévérance !';
    else msg = n ? 'Quelle belle récolte : ' + apples + ' dans ton panier !' : 'Bravo pour ta persévérance !';
    msg = frTypo(msg);
    showBubble(msg, 'good', '🧺');
    announce(msg);
    safe(() => M.pop(basket, { scale: 1.08, dur: 420 }));
    if (n && !reduced()) safe(() => M.sparkle(basket, { count: 9 }));
    const extra = sp.on ? { sprint: { picked: n, timeUp: sp.over } } : undefined;
    later(() => safe(() => ctx.end(extra)), FINALE_MS);
  }

  /* ================= CYCLE DE VIE ================= */
  async function start() {
    if (started) return;
    started = true;
    setBasketCount(0);
    /* attend une image : styles appliqués, mesures fiables */
    await new Promise(res => { try { requestAnimationFrame(() => res()); } catch (_) { setTimeout(res, 16); } });
    if (!alive) return;
    layout();
    try {
      const ro = new ResizeObserver(() => { if (alive) layout(); });
      ro.observe(scene);
      cleanups.push(() => { try { ro.disconnect(); } catch (_) {} });
    } catch (_) { listen(globalThis, 'resize', layout); }
    listen(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') sprintPause('hidden'); else sprintResume('hidden');
    });
    /* les polices arrivent parfois après le premier calcul : on réajuste la pomme */
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (alive && cur) fitCard(cur); }); } catch (_) {}
    if (settings().timers) showModes();
    else begin(false);
  }

  function destroy() {
    if (!alive) return;
    alive = false;
    hush();
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const a of anims) { try { a.cancel(); } catch (_) {} }
    anims.clear();
    for (const fn of cleanups.splice(0)) fn();
    for (const n of flying) { try { n.remove(); } catch (_) {} }
    flying.clear();
    try { ctx.onJoker(() => false); } catch (_) {}
    va.destroy();
    if (kp) { try { kp.destroy(); } catch (_) {} kp = null; }
    dropGrid();
    box.remove();
  }

  return { start, destroy };
}
