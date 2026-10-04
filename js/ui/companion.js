/* ============ COMPAGNON : carte de l'accueil (diorama vivant, v2.1) + avatar partagé ============
   Carte du compagnon de l'accueil, sur le profil ACTIF : un petit DIORAMA (ciel selon l'heure réelle — aube, jour,
   crépuscule, nuit étoilée avec la lune —, soleil, nuages qui dérivent, colline, pommier, clôture, herbe fleurie,
   flaque, ou lac pour le dauphin, touche de saison : feuilles qui tombent en automne, flocons en hiver, pétales au
   printemps, lucioles les soirs d'été) où le compagnon VIT grâce au moteur js/ui/companion-life.js.
   Les soins gardent EXACTEMENT les règles v11 (port de c5bd8d1:index.html « JAUGES & HUMEUR », « ACTIONS »,
   « PANNEAUX » : prix, jauges faim / forme / joie qui baissent doucement — plancher 15, jamais de « mort » —,
   brossage toutes les 4 h, promenade une fois par jour, boutique un objet par emplacement, montures, réglages,
   mêmes sons) mais deviennent de petites scènes :
     nourrir   la nourriture vole du garde-manger jusqu'à sa bouche, il mâche (miettes), ravi ;
     brosser   une brosse passe sur son dos, paillettes, il ferme les yeux de plaisir ;
     promener  il traverse la scène (marche ou nage) et revient ;
     toucher   cœur + petit bond ; appui long = câlin (il se blottit, cœurs) ;
     boutique  il prend la pose, fier, l'accessoire brille ; nouvelle monture = apparition dans les paillettes.
   Stades (CDC §10.3) : petit → junior → champion selon companion.minutes (60 et 300 min d'apprentissage) ; libellé et
   petite jauge sous la scène ; célébration d'évolution une seule fois (mémorisée dans companion.stage).
   La nuit (22 h - 7 h), il dort ; on le réveille en le touchant (surpris puis content).
   Toute écriture passe par store.mutateProfile (profil.companion, profil.wallet.apples, profil.name / g).

   API :
     mountReady() → Promise : charge js/ui/mount-svg.js, js/ui/companion-life.js (+ css/ui/mount.css) une seule fois ;
     avatarSVG(type, worn, size, mood, opts?) → chaîne SVG (mountSVG, ou repli emoji si le module manque) ;
     avatarOf(profile, size, mood, opts?) → idem pour le compagnon d'un profil (stade selon ses minutes) ;
     stageOf(profile) → 1 | 2 | 3 ;
     setAvatar(el, html, { live = true }?) → pose le SVG et lui donne une vie LÉGÈRE (regard, clignements, joie au
       toucher : companion-life.js liven) ; la vie d'un SVG remplacé est arrêtée ;
     renderCompanionCard(container) → { destroy(), dance(), el } */

import { h, clear, dayStr, frTypo, loadCSS } from '../core/util.js';
import * as store from '../core/store.js';
import * as audio from '../core/audio.js';
import * as motion from '../core/motion.js';
import { MOUNTS, FOODS, SHOP, PET } from '../content/companion-data.js';
import { fillTemplate, sanitizeName, DEFAULT_HERO } from '../core/profiles.js';
import { addApples } from '../core/economy.js';

/* ---------- modules du compagnon (chargés à la demande, avec repli) ---------- */
let svgFn = null;          /* mountSVG */
let anchorsFn = null;      /* mountAnchors */
let life = null;           /* module companion-life.js */
let loading = null;
const ensureMountCSS = () => {
  try {
    if (document.querySelector('link[href*="css/ui/mount.css"]')) return Promise.resolve(true);
    return loadCSS('css/ui/mount.css');
  } catch (_) { return Promise.resolve(false); }
};
export function mountReady() {
  if (!loading) {
    loading = Promise.all([
      import('./mount-svg.js').then(m => {
        const fn = m && (m.mountSVG || (m.default && m.default.mountSVG) || (typeof m.default === 'function' ? m.default : null));
        if (typeof fn === 'function') svgFn = fn;
        if (m && typeof m.mountAnchors === 'function') anchorsFn = m.mountAnchors;
      }).catch(e => { try { console.warn('Compagnon SVG indisponible, repli emoji', e); } catch (_) {} }),
      import('./companion-life.js').then(m => { life = m; })
        .catch(e => { try { console.warn('Moteur de vie du compagnon indisponible', e); } catch (_) {} }),
      ensureMountCSS()
    ]).then(() => undefined);
  }
  return loading;
}
/* repli : l'emoji de la monture dans le même cadre (100 × 84) que le SVG */
function fallbackSVG(type, size, mood) {
  const m = MOUNTS[type] || MOUNTS.pony;
  const s = Math.max(16, Math.round(+size || 100));
  return '<svg class="m-root m-fallback ' + String(mood || '').replace(/[^\w -]/g, '') + '" width="' + s + '" height="' + Math.round(s * 0.84) +
    '" viewBox="0 0 100 84" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><text x="50" y="66" font-size="64" text-anchor="middle">' +
    m.em + '</text></svg>';
}
export function avatarSVG(type, worn, size, mood = '', opts) {
  const t = MOUNTS[type] ? type : 'pony';
  const w = Array.isArray(worn) ? worn : [];
  if (svgFn) {
    try {
      const out = svgFn(t, w, size, mood, opts && typeof opts === 'object' ? opts : {});
      if (typeof out === 'string' && out.indexOf('<svg') >= 0) return out;
    } catch (e) { try { console.warn('mountSVG', e); } catch (_) {} }
  }
  return fallbackSVG(t, size, mood);
}
/* stade du compagnon d'un profil (CDC §10.3 : minutes d'apprentissage cumulées, seuils 60 et 300 min) */
const stageFromMinutes = m => (life ? life.stageFor(m) : (+m >= 300 ? 3 : +m >= 60 ? 2 : 1));
export function stageOf(profile) {
  const c = (profile && profile.companion) || {};
  return stageFromMinutes(Number(c.minutes) || 0);
}
export function avatarOf(profile, size, mood = '', opts = {}) {
  const c = (profile && profile.companion) || {};
  const o = Object.assign({ stage: stageOf(profile) }, opts && typeof opts === 'object' ? opts : {});
  return avatarSVG(c.type, c.equip && c.equip.worn, size, mood, o);
}
/* le SVG renvoyé est une chaîne : on le pose dans un conteneur, masqué aux lecteurs d'écran, et on lui donne une vie
   légère (le contrôleur se nettoie seul quand l'avatar quitte la page ; celui de l'ancien SVG est arrêté ici) */
export function setAvatar(el, html, opts = {}) {
  if (!el) return null;
  try {
    const old = el.querySelector && el.querySelector('svg.c-rig');
    const l = old && life ? life.lifeOf(old) : null;
    if (l) l.destroy();
  } catch (_) {}
  el.innerHTML = html;
  const s = el.querySelector('svg');
  if (s) { s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); }
  if (s && life && opts.live !== false && s.classList.contains('c-rig')) {
    try { life.liven(el); } catch (_) {}
  }
  return s;
}

/* ---------- jauges (v11 : petNow / materializePet / petMood) ---------- */
const clampG = v => Math.max(PET.FLOOR, Math.min(PET.MAX, v));
function petNow(pet, now = Date.now()) {
  const p = pet || {};
  const dt = Math.max(0, now - (p.last || now));
  const v = k => clampG((Number.isFinite(+p[k]) ? +p[k] : PET.START) - 100 * dt / PET.DECAY[k]);
  return { faim: v('faim'), forme: v('forme'), joie: v('joie') };
}
/* fige les valeurs courantes avant toute modification (à appeler dans mutateProfile) */
function materialize(pet, now = Date.now()) {
  const g = petNow(pet, now);
  pet.faim = g.faim; pet.forme = g.forme; pet.joie = g.joie;
  pet.last = now;
}

/* ---------- accords (genre grammatical de la monture) ---------- */
const mountOf = p => MOUNTS[p && p.companion && p.companion.type] || MOUNTS.pony;
const fem = p => mountOf(p).g === 'f';
const say = (p, str) => frTypo(fillTemplate(str, p));

function moodOf(p, g) {
  const f = fem(p), kind = mountOf(p).kind;
  const avg = (g.faim + g.forme + g.joie) / 3;
  if (avg < 40) {
    if (g.faim <= g.forme && g.faim <= g.joie) return { cls: 'sad', msg: say(p, '{N} a un petit creux 🍎') };
    if (g.forme <= g.joie) {
      return { cls: 'sad', msg: say(p, kind === 'dolphin' ? '{N} aimerait bien faire un petit tour 🚶' : '{N} aimerait bien se dégourdir les pattes 🚶') };
    }
    return { cls: 'sad', msg: say(p, '{N} a envie de câlins 💛 (touche la scène !)') };
  }
  if (avg >= 80) return { cls: '', msg: say(p, '{N} est en pleine forme, ' + (f ? 'prête' : 'prêt') + ' à jouer avec toi ! 🌟') };
  return { cls: '', msg: say(p, '{N} est bien {contentM} de te voir 😊') };
}

/* articles des accessoires (messages de la boutique) */
const ITEM_WORDS = {
  foulard: ['le foulard', false], noeud: ['le nœud', false], chapeau: ['le chapeau', false], lunettes: ['les lunettes', true],
  echarpe: ['l’écharpe', false], selle: ['la selle dorée', false], couronne: ['la couronne', false], ailes: ['les ailes de fée', true]
};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const SLOT_ITEM = id => SHOP.find(o => o.id === id) || null;
const NBSP = '\u00a0';
/* durée de jeu lisible : « 25 min », « 3 h 40 », « 4 h » (espaces insécables) */
function fmtMinutes(m) {
  const n = Math.max(1, Math.round(+m || 0));
  if (n < 60) return n + NBSP + 'min';
  const hh = Math.floor(n / 60), mm = n % 60;
  return hh + NBSP + 'h' + (mm ? NBSP + String(mm).padStart(2, '0') : '');
}
const STAGE_ICON = ['🌱', '🌿', '🏆'];

/* ---------- décor du diorama (SVG statiques, couleurs par variables CSS posées selon l'heure) ---------- */
const INK = '#4a2c1a';
/* paysage (repère 400 × 200, rogné en largeur selon la carte, aligné en bas) ; gid = identifiant unique du dégradé */
function landSVG(gid) {
  const leaves = [[62, 92, 22], [43, 103, 14], [81, 102, 15], [70, 79, 12]];
  const ring = leaves.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 2}"/>`).join('');
  const fill = leaves.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
  const posts = [258, 281, 304, 327, 350].map(x => `<rect x="${x}" y="118" width="7" height="30" rx="2.5"/>`).join('');
  return `<svg class="cc-land-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" focusable="false" aria-hidden="true">`
    + `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--cc-grass-top)"/><stop offset="1" style="stop-color:var(--cc-grass-bot)"/></linearGradient></defs>`
    + '<path class="l-hill-far" d="M-10,126C30,103 74,97 118,111C152,121 180,107 216,97C260,85 312,91 352,106C374,114 392,116 410,112V200H-10Z"/>'
    + '<path class="l-hill-near" d="M-10,144C40,127 94,125 142,137C190,149 238,131 288,127C332,123 372,131 410,137V200H-10Z"/>'
    /* pommier */
    + `<path class="l-trunk" d="M57,136C58.5,126 58.5,118 56.5,108L66.5,108C64.5,118 64.5,126 66,136Z" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`
    + `<g class="l-canopy-o" fill="${INK}">${ring}</g><g class="l-canopy">${fill}</g>`
    + '<path class="l-leaf-hi" d="M47,90C50,80 60,74 70,77" fill="none" stroke-width="3.2" stroke-linecap="round"/>'
    + `<g class="l-apples" stroke="${INK}" stroke-width="1.2"><circle cx="50" cy="100" r="3.3"/><circle cx="73" cy="92" r="3.3"/><circle cx="84" cy="106" r="3"/><circle cx="60" cy="108" r="2.8"/></g>`
    /* clôture du ranch */
    + `<g class="l-fence" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"><rect x="252" y="124" width="112" height="5" rx="2.5"/><rect x="252" y="135" width="112" height="5" rx="2.5"/>${posts}</g>`
    /* pré */
    + `<path class="l-grass" fill="url(#${gid})" d="M-10,154C70,146 150,150 200,149C262,148 330,142 410,150V200H-10Z"/>`
    + '<ellipse class="l-clear" cx="200" cy="187" rx="98" ry="12"/>'
    + `<g class="l-tufts" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"><path d="M104,175l-2.5,-6M107,175l0,-8M110,175l2.5,-6"/><path d="M292,180l-2.5,-6M295,180l0,-8M298,180l2.5,-6"/><path d="M150,196l-2,-5M152.5,196l0,-7M155,196l2,-5"/><path d="M28,168l-2,-5M30.5,168l0,-7M33,168l2,-5"/></g>`
    /* flaque (toutes les espèces sauf le dauphin) */
    + `<g class="l-puddle"><ellipse class="l-water" cx="328" cy="184" rx="31" ry="7.5" stroke="${INK}" stroke-width="1.6"/><path class="l-water-hi" d="M310,182.5C316,181 324,180.6 332,181" fill="none" stroke-width="1.8" stroke-linecap="round"/></g>`
    /* lac du dauphin */
    + `<g class="l-lake"><path class="l-water" d="M-10,166C60,160 140,164 200,162C270,160 340,164 410,161V200H-10Z" stroke="${INK}" stroke-width="1.8"/>`
    + '<path class="l-water-hi" d="M24,176q8,-3 16,0M92,184q8,-3 16,0M300,178q8,-3 16,0M352,188q8,-3 16,0M150,192q8,-3 16,0" fill="none" stroke-width="2" stroke-linecap="round"/></g>'
    + '</svg>';
}
const SUN_SVG = '<svg viewBox="-24 -24 48 48" focusable="false" aria-hidden="true"><g class="cc-rays" stroke="#ffcf4a" stroke-width="3" stroke-linecap="round">'
  + [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M0,-15V-20" transform="rotate(${a})"/>`).join('')
  + `</g><circle r="11" fill="#ffd95a" stroke="#f0a92e" stroke-width="1.6"/><circle cx="-3.6" cy="-3.6" r="3.4" fill="#fff" opacity=".55"/></svg>`;
const MOON_SVG = '<svg viewBox="-14 -14 28 28" focusable="false" aria-hidden="true"><path d="M2,-10.8A10.8,10.8 0 1 0 2,10.8A8,10.8 0 1 1 2,-10.8Z" fill="#fff5cf" stroke="#e8cf86" stroke-width="1"/>'
  + '<circle cx="-5.4" cy="-1.4" r="1.7" fill="#f1e1a8"/><circle cx="-2.8" cy="5" r="1.1" fill="#f1e1a8"/></svg>';
const CLOUD_SVG = '<svg viewBox="0 0 64 30" focusable="false" aria-hidden="true"><path d="M12,27C5,27 2,22.5 3.5,18C5,14 9,12.5 12.5,13.5C13.5,7.5 19,4 25,5.5C28.5,1.5 36,1 40.5,5C45,3 52,5.5 53,11.5C58.5,11.5 62,15.5 61,20.5C60.2,24.5 57,27 53,27Z" fill="var(--cc-cloud)" stroke="var(--cc-cloud-line)" stroke-width="1.6" stroke-linejoin="round"/><path d="M15,18.5C16,15.5 19.5,14.5 22,15.5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".8"/></svg>';
const STAR_SVG = '<svg viewBox="-5 -5 10 10" focusable="false" aria-hidden="true"><path d="M0,-4.5L1.1,-1.1 4.5,0 1.1,1.1 0,4.5 -1.1,1.1 -4.5,0 -1.1,-1.1Z" fill="#fff8d6"/></svg>';
const DAISY_SVG = `<svg viewBox="-12 -12 24 34" focusable="false" aria-hidden="true"><path d="M0,4V21" stroke="#4fae5f" stroke-width="2.4" stroke-linecap="round"/><path d="M0,15C3,11 7,11 8,12C6,15 3,16 0,15Z" fill="#6cc47c" stroke="${INK}" stroke-width="1"/>`
  + [0, 60, 120, 180, 240, 300].map(a => `<ellipse cx="0" cy="-6" rx="3" ry="5" transform="rotate(${a})" fill="#fff" stroke="${INK}" stroke-width="1.1"/>`).join('')
  + `<circle r="3.6" fill="#ffc93c" stroke="${INK}" stroke-width="1.1"/></svg>`;
const TULIP_SVG = `<svg viewBox="-12 -14 24 36" focusable="false" aria-hidden="true"><path d="M0,0V21" stroke="#4fae5f" stroke-width="2.4" stroke-linecap="round"/><path d="M0,13C-4,8 -8,9 -9,10C-7,14 -3,15 0,14Z" fill="#6cc47c" stroke="${INK}" stroke-width="1"/>`
  + `<path d="M-7,-9C-7,-1 -4,3 0,3C4,3 7,-1 7,-9L3.5,-5.5L0,-11L-3.5,-5.5Z" fill="#ff8fb3" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><path d="M-4.5,-5C-4.5,-2 -3,0 -1.5,0.6" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".7"/></svg>`;
/* particules de saison */
const SEASON_SVG = {
  autumn: c => `<svg viewBox="-7 -7 14 14" focusable="false" aria-hidden="true"><path d="M0,-6C4,-3 5,2 0,6C-5,2 -4,-3 0,-6Z" fill="${c}" stroke="${INK}" stroke-width=".9" stroke-linejoin="round"/><path d="M0,-4.5V4.5" stroke="${INK}" stroke-width=".7" opacity=".55"/></svg>`,
  winter: () => '<svg viewBox="-6 -6 12 12" focusable="false" aria-hidden="true"><circle r="4.2" fill="#fff" stroke="#b9d7f2" stroke-width="1"/></svg>',
  spring: c => `<svg viewBox="-6 -6 12 12" focusable="false" aria-hidden="true"><path d="M0,-4.5C3,-4.5 4.5,-1 3,2C1.5,4.5 -1.5,4.5 -3,2C-4.5,-1 -3,-4.5 0,-4.5Z" fill="${c}" stroke="#e58fb0" stroke-width=".8"/></svg>`,
  summer: () => '<svg viewBox="-6 -6 12 12" focusable="false" aria-hidden="true"><circle r="2.2" fill="#fff6a8"/><circle r="4.6" fill="#fff3a0" opacity=".35"/></svg>'
};
const SEASON_COLORS = { autumn: ['#f2a03d', '#e2643a', '#f6c445', '#c9773a'], spring: ['#ffc4d9', '#ffd9e6', '#ffb0cb'], winter: [''], summer: [''] };

/* ============ CARTE ============ */
let cardSeq = 0;
export function renderCompanionCard(container) {
  const uid = 'cc' + (++cardSeq);
  const timers = new Set();
  let destroyed = false, clip = null, walking = false, openPanel = null, evolving = false;
  let shownSig = '', lastMoodCls = null, minuteTimer = 0, ctl = null, svgEl = null;
  let pendingLook = false, seasonShown = '', evoScheduled = false, swapping = false;
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!destroyed) fn(); }, ms); timers.add(t); return t; };
  const profile = () => store.getProfile();
  const isWide = () => { try { return matchMedia('(min-width: 900px)').matches; } catch (_) { return false; } };
  const petSize = () => (isWide() ? 176 : 138);
  const reduced = () => { try { return motion.reduced(); } catch (_) { return false; } };

  /* ----- scène ----- */
  const sky = h('div', { class: 'cc-sky', 'aria-hidden': 'true' });
  const stars = h('div', { class: 'cc-stars', 'aria-hidden': 'true' });
  for (let i = 0; i < 14; i++) {
    const s = h('span', { class: 'cc-star', html: STAR_SVG });
    /* positions fixes et variées (suite pseudo-aléatoire déterministe) */
    const r = k => ((Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
    s.style.left = (3 + r(1) * 94).toFixed(1) + '%';
    s.style.top = (4 + r(2) * 46).toFixed(1) + '%';
    s.style.setProperty('--d', (2 + r(3) * 3).toFixed(2) + 's');
    s.style.setProperty('--dl', (-r(4) * 5).toFixed(2) + 's');
    s.style.setProperty('--k', (0.55 + r(5) * 0.7).toFixed(2));
    stars.appendChild(s);
  }
  stars.appendChild(h('span', { class: 'cc-shoot' }));
  const sun = h('div', { class: 'cc-sun', 'aria-hidden': 'true', html: SUN_SVG });
  const moon = h('div', { class: 'cc-moon', 'aria-hidden': 'true', html: MOON_SVG });
  const clouds = h('div', { class: 'cc-clouds', 'aria-hidden': 'true' },
    h('span', { class: 'cc-cloud c1', html: CLOUD_SVG }), h('span', { class: 'cc-cloud c2', html: CLOUD_SVG }), h('span', { class: 'cc-cloud c3', html: CLOUD_SVG }));
  const land = h('div', { class: 'cc-land', 'aria-hidden': 'true', html: landSVG(uid + '-grass') });
  const glow = h('div', { class: 'cc-glow', 'aria-hidden': 'true' });
  const holder = h('div', { class: 'cc-holder' });
  const walker = h('div', { class: 'cc-walker' }, holder);
  const front = h('div', { class: 'cc-front', 'aria-hidden': 'true' },
    h('span', { class: 'cc-flower f1', html: DAISY_SVG }), h('span', { class: 'cc-flower f2', html: TULIP_SVG }), h('span', { class: 'cc-flower f3', html: DAISY_SVG }));
  const season = h('div', { class: 'cc-season', 'aria-hidden': 'true' });
  const sparkLayer = h('div', { class: 'cc-fx', 'aria-hidden': 'true' });
  const stage = h('div', { class: 'cc-stage', role: 'button', tabindex: '0' },
    sky, stars, sun, moon, clouds, land, glow, walker, front, season, sparkLayer);
  const nameTag = h('span', { class: 'cc-name' });

  /* ----- stade : libellé + petite jauge vers le stade suivant ----- */
  const growIco = h('span', { class: 'cc-grow-ico', 'aria-hidden': 'true' });
  const growTxt = h('span', { class: 'cc-grow-txt' });
  const growSub = h('span', { class: 'cc-grow-sub' });
  const growFill = h('span', { class: 'cc-grow-fill' });
  const growNext = h('span', { class: 'cc-grow-next', 'aria-hidden': 'true' });
  const growBar = h('span', { class: 'cc-grow-bar', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '100' }, growFill);
  const grow = h('div', { class: 'cc-grow' }, growIco, h('span', { class: 'cc-grow-col' }, growTxt, growSub), h('span', { class: 'cc-grow-gauge' }, growBar, growNext));

  const mood = h('p', { class: 'cc-mood', role: 'status', 'aria-live': 'polite' });

  const gauge = (key, label, icon) => {
    const fill = h('div', { class: 'cc-gfill' });
    const bar = h('div', { class: 'cc-gbar', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': label }, fill);
    return { el: h('div', { class: 'cc-gauge g-' + key }, h('div', { class: 'cc-glbl' }, h('span', { 'aria-hidden': 'true' }, icon), ' ' + label), bar), fill, bar };
  };
  const G = { faim: gauge('faim', 'Faim', '🍎'), forme: gauge('forme', 'Forme', '🎾'), joie: gauge('joie', 'Joie', '💛') };

  const panels = {};
  const act = (key, icon, label, panel) => {
    const b = h('button', { type: 'button', class: 'cc-act', 'data-act': key },
      h('span', { class: 'cc-act-ico', 'aria-hidden': 'true' }, icon), h('span', { class: 'cc-act-txt' }, label));
    if (panel) { b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', uid + '-' + panel); }
    return b;
  };
  const btns = {
    food: act('food', '🥕', 'Nourrir', 'food'),
    brush: act('brush', '🪮', 'Brosser'),
    walk: act('walk', '🚶', 'Promener'),
    shop: act('shop', '🛍️', 'Boutique', 'shop'),
    settings: act('settings', '⚙️', 'Réglages', 'settings')
  };

  /* panneaux */
  const walletPill = () => h('span', { class: 'cc-purse' }, h('span', { 'aria-hidden': 'true' }, '🍎'), h('span', { class: 'cc-purse-n' }, '0'));
  const panelHead = (title, withPurse) => h('div', { class: 'cc-panel-head' }, h('h3', { class: 'cc-panel-title' }, frTypo(title)), withPurse ? walletPill() : null);
  const foodGrid = h('div', { class: 'cc-grid' });
  const shopGrid = h('div', { class: 'cc-grid' });
  const mountGrid = h('div', { class: 'cc-grid cc-grid-mounts' });
  panels.food = h('div', { class: 'cc-panel', id: uid + '-food', hidden: true },
    panelHead('🥕 Le garde-manger', true), foodGrid);
  panels.shop = h('div', { class: 'cc-panel', id: uid + '-shop', hidden: true },
    panelHead('🛍️ La boutique — habille ton compagnon !', true), shopGrid,
    h('h3', { class: 'cc-panel-title cc-sub' }, '🐎 Montures'), mountGrid);

  /* réglages : prénom du héros, fille / garçon, nom du compagnon */
  const heroIn = h('input', { class: 'input', type: 'text', id: uid + '-hero', maxlength: '14', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', enterkeyhint: 'next' });
  const mountIn = h('input', { class: 'input', type: 'text', id: uid + '-mount', maxlength: '14', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', enterkeyhint: 'done' });
  let gSel = 'f';
  const segF = h('button', { type: 'button', 'aria-pressed': 'true' }, 'une fille');
  const segM = h('button', { type: 'button', 'aria-pressed': 'false' }, 'un garçon');
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Tu es' }, segF, segM);
  const saveBtn = h('button', { type: 'button', class: 'btn small cc-save' }, '✓ Enregistrer');
  panels.settings = h('div', { class: 'cc-panel', id: uid + '-settings', hidden: true },
    panelHead('⚙️ Réglages', false),
    h('div', { class: 'cc-set' },
      h('div', { class: 'field' }, h('label', { for: uid + '-hero' }, 'Ton prénom'), heroIn),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Tu es'), seg),
      h('div', { class: 'field' }, h('label', { for: uid + '-mount' }, 'Nom de ton compagnon'), mountIn),
      saveBtn));

  const el = h('section', { class: 'card cc', 'aria-label': 'Ton compagnon' },
    h('div', { class: 'cc-stage-wrap' }, stage, nameTag),
    grow,
    mood,
    h('div', { class: 'cc-gauges' }, G.faim.el, G.forme.el, G.joie.el),
    h('div', { class: 'cc-actions' }, btns.food, btns.brush, btns.walk, btns.shop, btns.settings),
    panels.food, panels.shop, panels.settings);
  clear(container);
  container.appendChild(el);

  /* ----- ciel, heure, saison ----- */
  function renderSeason(name, phase) {
    const key = name + '|' + (name === 'summer' ? (phase === 'night' ? 'n' : 'd') : '');
    if (key === seasonShown) return;
    seasonShown = key;
    clear(season);
    season.setAttribute('data-kind', name === 'summer' ? (phase === 'night' ? 'fireflies' : 'none') : name);
    if (name === 'summer' && phase !== 'night') return;            /* été, en journée : rien qui tombe */
    const n = name === 'winter' ? 9 : name === 'summer' ? 6 : 5;
    const cols = SEASON_COLORS[name] || [''];
    for (let i = 0; i < n; i++) {
      const r = k => ((Math.sin((i + 3) * 91.17 + k * 47.3) * 24634.6345) % 1 + 1) % 1;
      const p = h('span', { class: 'cc-part' }, h('span', { class: 'cc-part-in', html: SEASON_SVG[name](cols[i % cols.length]) }));
      p.style.left = (4 + ((i + r(1) * 0.8) / n) * 92).toFixed(1) + '%';
      p.style.setProperty('--d', ((name === 'winter' ? 11 : name === 'summer' ? 6 : 9) + r(2) * 6).toFixed(2) + 's');
      p.style.setProperty('--dl', (-r(3) * 14).toFixed(2) + 's');
      p.style.setProperty('--sw', (1.8 + r(4) * 1.6).toFixed(2) + 's');
      p.style.setProperty('--k', (0.75 + r(5) * 0.6).toFixed(2));
      season.appendChild(p);
    }
  }
  function updateSky() {
    if (!life) return;
    const d = new Date();
    const k = life.skyAt(d);
    const st = stage.style;
    st.setProperty('--cc-sky-top', k.sky.top);
    st.setProperty('--cc-sky-bot', k.sky.bot);
    for (const [name, v] of Object.entries(k.land)) st.setProperty('--cc-' + name.replace(/[A-Z]/g, c => '-' + c.toLowerCase()), v);
    st.setProperty('--cc-night', k.night.toFixed(3));
    st.setProperty('--cc-glow', k.glow.toFixed(3));
    st.setProperty('--cc-cloud-line', k.night > 0.5 ? 'rgba(160, 170, 220, .55)' : 'rgba(110, 160, 205, .45)');
    sun.hidden = !k.sun.on || k.night > 0.92;
    moon.hidden = !k.moon.on;
    stars.hidden = k.night < 0.03;
    sun.style.left = (k.sun.x / 4).toFixed(2) + '%';
    sun.style.top = (k.sun.y / 2).toFixed(2) + '%';
    moon.style.left = (k.moon.x / 4).toFixed(2) + '%';
    moon.style.top = (k.moon.y / 2).toFixed(2) + '%';
    stage.setAttribute('data-phase', k.phase);
    renderSeason(life.seasonOf(d), k.phase);
  }

  /* ----- rendu ----- */
  /* ce qui est dessiné : profil, monture, accessoires portés, stade (l'humeur se règle sans redessiner) */
  function lookOf(p) {
    const c = (p && p.companion) || {};
    return [p && p.id, c.type, ((c.equip && c.equip.worn) || []).join(','), stageOf(p)].join('|');
  }
  function shownStage(p) {
    /* pendant une évolution pas encore fêtée, on garde l'ancien stade jusqu'à la célébration */
    const c = (p && p.companion) || {};
    const s = stageOf(p);
    return evolving ? Math.min(s, Math.max(1, +c.stage || 1)) : s;
  }
  function onLife(type, detail) {
    if (destroyed) return;
    if (type === 'pause') stage.classList.add('is-paused');
    else if (type === 'resume') { stage.classList.remove('is-paused'); updateSky(); refresh(); }
    else if (type === 'sleep') { stage.classList.add('is-asleep'); refresh(true); }
    else if (type === 'wake') {
      stage.classList.remove('is-asleep');
      const p = profile();
      if (p) tell(say(p, 'Oh ! {N} se réveille… Coucou {P} ! 👋'));
    } else if (type === 'tap') petTap(detail);
    else if (type === 'hug') petHug(detail);
  }
  /* (re)dessine le compagnon et lui donne vie ; stageOverride : stade imposé (évolution) */
  function drawSVG(p, stageOverride) {
    if (walking) { pendingLook = true; return; }
    pendingLook = false;
    const night = life ? life.isNight(new Date()) : false;
    /* réveillé en pleine nuit (on vient de le toucher) : le nouveau dessin reste éveillé */
    const awake = night && !!ctl && !ctl.state.sleeping;
    if (ctl) { try { ctl.destroy(); } catch (_) {} ctl = null; }
    const g = petNow(p.companion && p.companion.pet);
    const m = moodOf(p, g);
    const st = stageOverride || shownStage(p);
    const cls = [night && !awake ? 'sleep' : '', m.cls].filter(Boolean).join(' ');
    svgEl = setAvatar(holder, avatarOf(p, petSize(), cls, { stage: st }), { live: false });
    shownSig = lookOf(p);
    stage.setAttribute('data-species', (p.companion && p.companion.type) || 'pony');
    if (life && svgEl && svgEl.classList.contains('c-rig')) {
      ctl = life.bringToLife(svgEl, {
        species: p.companion.type, stage: st, interactive: true, hitEl: stage,
        greet: !night, awake, mood: g, onEvent: onLife
      });
    }
    stage.classList.toggle('is-asleep', !!(ctl && ctl.state.sleeping));
  }
  function renderGauges(g) {
    for (const k of ['faim', 'forme', 'joie']) {
      const v = Math.round(g[k]);
      G[k].fill.style.width = v + '%';
      G[k].bar.setAttribute('aria-valuenow', String(v));
      G[k].bar.setAttribute('aria-valuetext', v + ' sur 100');
      G[k].el.classList.toggle('is-low', v < 35);
    }
  }
  function renderPurse(p) {
    const n = p && p.wallet ? p.wallet.apples : 0;
    for (const e of el.querySelectorAll('.cc-purse-n')) e.textContent = String(n);
    for (const e of el.querySelectorAll('.cc-purse')) e.setAttribute('aria-label', 'Tu as ' + n + ' pommes');
  }
  function renderName(p) {
    const m = mountOf(p);
    nameTag.textContent = m.em + ' ' + ((p && p.companion && p.companion.name) || m.label);
    stage.setAttribute('aria-label', say(p, 'Faire un câlin à {N}'));
  }
  function renderGrowth(p) {
    const c = (p && p.companion) || {};
    const minutes = Math.max(0, Number(c.minutes) || 0);
    const pr = life ? life.stageProgress(minutes) : { stage: stageOf(p), next: null, frac: 1, left: 0 };
    const s = evolving ? shownStage(p) : pr.stage;
    const f = fem(p);
    growIco.textContent = STAGE_ICON[s - 1];
    grow.setAttribute('data-stage', String(s));
    if (s === 1) growTxt.textContent = say(p, '{N} est encore ' + (f ? 'petite' : 'petit'));
    else if (s === 2) growTxt.textContent = say(p, '{N} est junior');
    else growTxt.textContent = say(p, '{N} est ' + (f ? 'championne' : 'champion') + ' !');
    const nextName = s === 1 ? 'junior' : f ? 'championne' : 'champion';
    if (s < 3 && pr.stage === s) {
      growSub.textContent = frTypo('Encore ' + fmtMinutes(pr.left) + ' de jeu pour grandir');
      growFill.style.width = Math.round(pr.frac * 100) + '%';
      growBar.setAttribute('aria-valuenow', String(Math.round(pr.frac * 100)));
      growBar.setAttribute('aria-valuetext', frTypo('Encore ' + fmtMinutes(pr.left) + ' d’apprentissage pour devenir ' + nextName));
      growBar.setAttribute('aria-label', 'Vers le stade ' + nextName);
      growNext.textContent = STAGE_ICON[s];
    } else if (s < 3) {                                    /* évolution en attente de célébration */
      growSub.textContent = frTypo('Il se passe quelque chose…');
      growFill.style.width = '100%';
      growBar.setAttribute('aria-valuenow', '100');
      growBar.setAttribute('aria-valuetext', 'Prêt à grandir');
      growNext.textContent = STAGE_ICON[s];
    } else {
      growSub.textContent = frTypo('Le plus grand des stades : bravo !');
      growFill.style.width = '100%';
      growBar.setAttribute('aria-valuenow', '100');
      growBar.setAttribute('aria-valuetext', 'Stade champion atteint');
      growBar.setAttribute('aria-label', 'Stade champion');
      growNext.textContent = '⭐';
    }
  }
  /* message d'humeur (la nuit : il dort) */
  function moodMsg(p, g) {
    if (ctl && ctl.state.sleeping) return say(p, 'Chut… {N} fait de beaux rêves 🌙');
    return moodOf(p, g).msg;
  }
  /* v11 renderPet : compagnon, message d'humeur, jauges */
  function renderPet() {
    const p = profile();
    if (!p) return;
    const g = petNow(p.companion && p.companion.pet);
    lastMoodCls = moodOf(p, g).cls;
    drawSVG(p);
    tell(moodMsg(p, g));
    renderGauges(g);
    renderName(p);
    renderPurse(p);
    renderGrowth(p);
  }
  /* rafraîchit jauges, humeur et message sans redessiner (force : remplace le message du moment) */
  function refresh(force) {
    const p = profile();
    if (!p) return;
    const g = petNow(p.companion && p.companion.pet);
    const m = moodOf(p, g);
    if (ctl) ctl.setMood(g);
    if (force || m.cls !== lastMoodCls) tell(moodMsg(p, g));
    lastMoodCls = m.cls;
    renderGauges(g);
    renderName(p);
    renderPurse(p);
    renderGrowth(p);
  }
  function tell(text) { mood.textContent = text; }

  /* ----- grilles des panneaux ----- */
  const item = (cls, icon, name, price, label, onTap, pressed) => {
    const b = h('button', { type: 'button', class: 'cc-item ' + cls, 'aria-label': label },
      h('span', { class: 'cc-item-ico', 'aria-hidden': 'true' }, icon),
      h('span', { class: 'cc-item-name' }, name),
      h('span', { class: 'cc-item-price' }, price));
    if (pressed !== undefined) b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    b.addEventListener('click', () => onTap(b));
    return b;
  };
  function renderFood() {
    const p = profile(); if (!p) return;
    const apples = p.wallet.apples;
    clear(foodGrid);
    for (const f of FOODS) {
      const ok = apples >= f.price;
      foodGrid.appendChild(item(ok ? 'can' : 'cant', f.e, f.name, f.price + ' 🍎',
        f.name + ', ' + f.price + ' pommes' + (ok ? '' : ' (pas assez de pommes)'), b => feedPet(f.id, b)));
    }
  }
  function renderShop() {
    const p = profile(); if (!p) return;
    const eq = p.companion.equip;
    clear(shopGrid);
    for (const it of SHOP) {
      const owned = eq.owned.includes(it.id), worn = eq.worn.includes(it.id);
      const price = worn ? 'porté ✓' : owned ? 'à porter' : it.price + ' 🍎';
      const label = it.name + (worn ? ', porté : touche pour l’enlever' : owned ? ', à porter' : ', ' + it.price + ' pommes');
      shopGrid.appendChild(item(worn ? 'worn' : owned ? 'owned' : '', it.e, it.name, price, label, () => shopTap(it.id), worn));
    }
  }
  function renderMounts() {
    const p = profile(); if (!p) return;
    const c = p.companion;
    clear(mountGrid);
    Object.keys(MOUNTS).forEach((t, i) => {
      const m = MOUNTS[t];
      const owned = c.owned.includes(t), sel = c.type === t;
      const price = sel ? 'choisi ✓' : owned ? 'choisir' : m.price + ' 🍎';
      const label = m.label + (sel ? ', choisi' : owned ? ', à choisir' : ', ' + m.price + ' pommes');
      const ico = h('span', { class: 'cc-mount-pic' });
      /* phase : les montures de la liste ne respirent pas en même temps */
      setAvatar(ico, avatarSVG(t, c.equip.worn, 58, '', { stage: stageOf(p), phase: i * 1.3 }), { live: false });
      mountGrid.appendChild(item(sel ? 'worn' : owned ? 'owned' : '', ico, m.label, price, label, () => mountTap(t), sel));
    });
  }
  function fillSettings() {
    const p = profile(); if (!p) return;
    heroIn.value = p.name || '';
    mountIn.value = (p.companion && p.companion.name) || '';
    setGender(p.g, true);
  }
  function setGender(g, silent) {
    gSel = g === 'm' ? 'm' : 'f';
    segF.classList.toggle('on', gSel === 'f'); segF.setAttribute('aria-pressed', String(gSel === 'f'));
    segM.classList.toggle('on', gSel === 'm'); segM.setAttribute('aria-pressed', String(gSel === 'm'));
    if (!silent) audio.beep(660, 0.05, 0.06);
  }

  /* v11 togglePanel : un seul panneau ouvert à la fois */
  function togglePanel(key) {
    for (const k of Object.keys(panels)) {
      const open = k === key ? panels[k].hidden : false;
      panels[k].hidden = !open;
      if (btns[k]) { btns[k].setAttribute('aria-expanded', String(open)); btns[k].classList.toggle('on', open); }
    }
    openPanel = key && !panels[key].hidden ? key : null;
    if (!openPanel) return;
    if (key === 'food') renderFood();
    if (key === 'shop') { renderShop(); renderMounts(); }
    if (key === 'settings') fillSettings();
    renderPurse(profile());
    const pan = panels[key];
    motion.enter(pan, { from: 'top', dist: 10, dur: 300 });
    later(() => {
      try {
        const r = pan.getBoundingClientRect();
        if (r.bottom > innerHeight - 8) pan.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
      } catch (_) {}
    }, 60);
  }

  /* ----- effets HTML (cœurs au bout du doigt) ----- */
  function addFx(char, x, y, delay = 0) {
    const s = h('span', { class: 'cc-heart' }, char);
    s.style.left = x + 'px'; s.style.top = y + 'px';
    if (delay) s.style.animationDelay = delay + 's';
    sparkLayer.appendChild(s);
    later(() => s.remove(), 1300 + delay * 1000 + 300);
  }
  function fxAt(pt, char, delay) {
    const r = stage.getBoundingClientRect();
    const cx = pt && Number.isFinite(pt.x) && pt.x ? pt.x : r.left + r.width / 2;
    const cy = pt && Number.isFinite(pt.y) && pt.y ? pt.y : r.top + r.height / 2;
    addFx(char, Math.max(6, Math.min(r.width - 24, cx - r.left - 10)), Math.max(6, Math.min(r.height - 30, cy - r.top - 12)), delay);
  }
  /* point de l'écran où se trouve la bouche du compagnon (cible de la nourriture) */
  function mouthPoint() {
    if (!svgEl) return null;
    try {
      const r = svgEl.getBoundingClientRect();
      if (!r.width) return null;
      const p = profile();
      const a = anchorsFn ? anchorsFn(p.companion.type, { stage: shownStage(p) }) : null;
      const m = a && a.mouth ? a.mouth : [78, 40];
      return { x: r.left + (m[0] / 100) * r.width, y: r.top + (m[1] / 84) * r.height };
    } catch (_) { return null; }
  }
  const centerOf = e => { try { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; } catch (_) { return null; } };

  /* ----- soins (règles v11 à l'identique : mêmes valeurs, mêmes sons) ----- */
  /* caresse : +2 joie (geste reconnu par le moteur sur la scène, ou Entrée / Espace au clavier) */
  function petTap(pt) {
    const p = profile(); if (!p) return;
    store.mutateProfile(pp => {
      materialize(pp.companion.pet);
      pp.companion.pet.joie = Math.min(PET.MAX, pp.companion.pet.joie + PET.TAP.joie);
    });
    fxAt(pt, '❤️');
    audio.neigh();
    refresh();
  }
  /* câlin (appui long) : même gain qu'une caresse, des cœurs et trois notes douces */
  const HUGS = ['{N} adore les câlins ! 💛', 'Un gros câlin pour {N} ! 🤗', '{N} se blottit contre toi 💛'];
  let hugIdx = 0;
  function petHug(pt) {
    const p = profile(); if (!p) return;
    store.mutateProfile(pp => {
      materialize(pp.companion.pet);
      pp.companion.pet.joie = Math.min(PET.MAX, pp.companion.pet.joie + PET.TAP.joie);
    });
    for (let i = 0; i < 3; i++) fxAt(pt, i === 1 ? '💛' : '❤️', i * 0.22);
    audio.beep(523, 0.12, 0.07); later(() => audio.beep(659, 0.14, 0.07), 150); later(() => audio.beep(784, 0.2, 0.06), 320);
    refresh();
    tell(say(p, HUGS[hugIdx++ % HUGS.length]));
  }
  /* la nuit, il dort : on le réveille d'abord (surpris puis content), la scène suit */
  const asleep = () => !!(ctl && ctl.state.sleeping);
  function whenAwake(fn) {
    if (asleep()) { ctl.react('wake'); later(fn, 1000); return 1000; }
    fn();
    return 0;
  }
  function busyWalking() {
    if (!walking) return false;
    const p = profile();
    if (p) tell(say(p, '{N} est en promenade… attends son retour ! 🚶'));
    return true;
  }
  function feedPet(id, srcBtn) {
    const f = FOODS.find(o => o.id === id);
    const p = profile();
    if (!f || !p) return;
    if (busyWalking()) return;
    if (p.wallet.apples < f.price) {
      tell(frTypo('Pas assez de 🍎… Gagne des pommes en jouant !'));
      motion.shake(mood, { dist: 4 });
      return;
    }
    /* point de départ relevé AVANT de redessiner le garde-manger (le bouton touché va être remplacé) */
    const from = srcBtn && srcBtn.isConnected ? centerOf(srcBtn) : null;
    store.mutateProfile(pp => {
      materialize(pp.companion.pet);
      addApples(pp, -f.price);
      pp.companion.pet.faim = Math.min(PET.MAX, pp.companion.pet.faim + f.faim);
      pp.companion.pet.joie = Math.min(PET.MAX, pp.companion.pet.joie + (f.joie || 0));
    });
    audio.beep(660, 0.08, 0.1); later(() => audio.beep(880, 0.1, 0.1), 110);
    renderFood(); refresh();
    /* la nourriture vole du garde-manger jusqu'à sa bouche ; il la voit venir, l'attrape et mâche */
    whenAwake(() => {
      const to = mouthPoint();
      const flight = !reduced() && to && from ? 720 : 0;
      if (ctl) ctl.react('eat', { food: f.e, from, flightMs: flight });
      if (flight) {
        motion.flyTo(from, to, { emoji: f.e, size: 30, dur: flight, arc: 0.4, popTarget: false });
        later(() => audio.tap(), flight + 260); later(() => audio.tap(), flight + 780); later(() => audio.tap(), flight + 1300);
      }
      tell(say(profile(), '{N} croque ' + f.e + ' avec appétit. Miam !'));
    });
  }
  function brushPet() {
    const p = profile(); if (!p) return;
    if (busyWalking()) return;
    const now = Date.now();
    if (now - (p.companion.pet.brushLast || 0) < PET.BRUSH.cooldown) {
      tell(say(p, '{N} est déjà ' + (fem(p) ? 'toute belle' : 'tout beau') + ' ✨ Reviens un peu plus tard !'));
      return;
    }
    store.mutateProfile(pp => {
      materialize(pp.companion.pet, now);
      pp.companion.pet.brushLast = now;
      pp.companion.pet.joie = Math.min(PET.MAX, pp.companion.pet.joie + PET.BRUSH.joie);
    });
    audio.beep(880, 0.08, 0.08);
    refresh();
    const kind = mountOf(profile()).kind;
    const coat = kind === 'dolphin' ? 'quelle peau toute douce !' : kind === 'dragon' ? 'quelles belles écailles !' : 'quel beau poil !';
    whenAwake(() => {
      if (ctl) ctl.react('brush').then(ok => { if (ok && !destroyed && svgEl) motion.sparkle(svgEl, { count: 8 }); });
      tell(say(profile(), '{N} adore le brossage, ' + coat + ' ✨'));
    });
  }
  function walkPet() {
    const p = profile(); if (!p) return;
    const today = dayStr();
    if (p.companion.pet.walkDay === today) {
      tell(say(p, '{N} a déjà eu sa promenade du jour 🚶 À demain !'));
      return;
    }
    if (walking) return;
    store.mutateProfile(pp => {
      materialize(pp.companion.pet);
      pp.companion.pet.walkDay = today;
      pp.companion.pet.forme = Math.min(PET.MAX, pp.companion.pet.forme + PET.WALK.forme);
      pp.companion.pet.joie = Math.min(PET.MAX, pp.companion.pet.joie + PET.WALK.joie);
    });
    refresh();
    const ms = 4200;
    walking = true;
    stage.classList.add('is-walking');
    const delay = whenAwake(() => {
      try { if (clip) clip.stop(); } catch (_) {}
      clip = audio.clipClop();
      if (ctl) ctl.react('walk', { ms: ms - 500 });
      walkPath(ms);
      tell(say(profile(), '{N} part en promenade, quel bonheur ! 🚶'));
    });
    later(() => {
      walking = false; clip = null;
      stage.classList.remove('is-walking');
      if (pendingLook) { const q = profile(); if (q) drawSVG(q); }
    }, delay + ms + 120);
  }
  /* promenade : il sort de la scène par la droite, fait demi-tour hors champ et revient au centre (4,2 s) */
  function walkPath(ms) {
    if (reduced() || typeof walker.animate !== 'function') return;
    const w = stage.clientWidth || 340, out = w / 2 + petSize() * 0.62;
    try {
      walker.animate([
        { transform: 'translateX(0) scaleX(1)', offset: 0, easing: 'cubic-bezier(.45,0,.75,.6)' },
        { transform: 'translateX(' + out + 'px) scaleX(1)', offset: 0.42 },
        { transform: 'translateX(' + out + 'px) scaleX(-1)', offset: 0.47, easing: 'cubic-bezier(.25,.4,.35,1)' },
        { transform: 'translateX(0) scaleX(-1)', offset: 0.9, easing: 'ease-in-out' },
        { transform: 'translateX(0) scaleX(.2)', offset: 0.94, easing: 'ease-out' },
        { transform: 'translateX(0) scaleX(1)', offset: 1 }
      ], { duration: ms });
    } catch (_) {}
  }
  /* changement d'apparence : nouveau SVG (accessoire, monture, stade) avec une petite mise en scène */
  async function swapLook(kind, extra) {
    const p = profile();
    if (!p || walking) { swapping = false; if (p) pendingLook = true; return; }
    const r = !reduced() && typeof holder.animate === 'function';
    if (kind === 'mount' && r && svgEl) {
      /* l'ancien compagnon s'efface en rapetissant… */
      try { await holder.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.55)', opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' }).finished; } catch (_) {}
      if (destroyed) return;
    }
    swapping = false;
    drawSVG(profile() || p);
    if (kind === 'mount') {
      /* …le nouveau apparaît dans une gerbe de paillettes */
      if (r) {
        try { holder.getAnimations().forEach(a => a.cancel()); } catch (_) {}
        try { holder.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }], { duration: 560, easing: motion.EASE.pop }); } catch (_) {}
        const c = centerOf(holder);
        if (c) motion.burst(c.x, c.y, { count: 16, colors: ['#ffd95a', '#ffb3cf', '#ffffff', '#b9e3ff'], spread: 70 });
      }
      if (ctl) ctl.react('appear');
    } else if (kind === 'wear' && ctl) ctl.react('proud', { acc: extra });
    else if (kind === 'unwear' && ctl) ctl.react('surprise');
  }
  function shopTap(id) {
    const it = SLOT_ITEM(id);
    const p = profile();
    if (!it || !p) return;
    const eq = p.companion.equip;
    if (!eq.owned.includes(id) && p.wallet.apples < it.price) {
      audio.beep(180, 0.1, 0.06);
      tell(frTypo('Pas assez de 🍎… Gagne des pommes en jouant !'));
      return;
    }
    let bought = false, wornNow = false, replaced = null;
    swapping = true;                                  /* la scène redessine elle-même le compagnon */
    store.mutateProfile(pp => {
      const e = pp.companion.equip;
      if (!e.owned.includes(id)) { addApples(pp, -it.price); e.owned.push(id); bought = true; }
      /* un seul équipement porté par emplacement */
      if (e.worn.includes(id)) {
        e.worn = e.worn.filter(x => x !== id);
      } else {
        replaced = e.worn.find(x => { const o = SLOT_ITEM(x); return o && o.slot === it.slot; }) || null;
        e.worn = e.worn.filter(x => { const o = SLOT_ITEM(x); return o && o.slot !== it.slot; });
        e.worn.push(id);
        wornNow = true;
      }
    });
    if (bought) audio.fanfare();
    if (wornNow) audio.beep(760, 0.08, 0.1);
    renderShop(); renderMounts(); refresh();
    swapLook(wornNow ? 'wear' : 'unwear', id);
    const [art, pl] = ITEM_WORDS[id] || [it.name.toLowerCase(), false];
    if (wornNow && replaced && ITEM_WORDS[replaced]) tell(frTypo(cap(art) + (pl ? ' remplacent ' : ' remplace ') + ITEM_WORDS[replaced][0] + ' ✨'));
    else if (wornNow) tell(say(profile(), '{N} est trop chic ! ✨'));
    else tell(frTypo(cap(art) + (pl ? ' retournent' : ' retourne') + ' dans le coffre.'));
  }
  function mountTap(t) {
    const m = MOUNTS[t];
    const p = profile();
    if (!m || !p) return;
    if (!p.companion.owned.includes(t) && p.wallet.apples < m.price) {
      audio.beep(180, 0.1, 0.06);
      tell(frTypo('Pas assez de 🍎… Gagne des pommes en jouant !'));
      return;
    }
    const same = p.companion.type === t;
    let bought = false;
    if (!same) swapping = true;                       /* la scène redessine elle-même le compagnon */
    store.mutateProfile(pp => {
      if (!pp.companion.owned.includes(t)) { addApples(pp, -m.price); pp.companion.owned.push(t); bought = true; }
      pp.companion.type = t;
    });
    if (bought) { audio.fanfare(); motion.confetti(); }
    renderMounts(); renderShop(); refresh();
    if (same) { if (ctl) ctl.react('tap'); } else swapLook('mount');
  }
  function saveSettings() {
    const p = profile(); if (!p) return;
    store.mutateProfile(pp => {
      pp.name = sanitizeName(heroIn.value, pp.name || DEFAULT_HERO);
      pp.g = gSel === 'm' ? 'm' : 'f';
      pp.companion.name = sanitizeName(mountIn.value, mountOf(pp).label);
    });
    fillSettings();
    refresh();
    if (ctl) ctl.react('tap');
    const q = profile(), f = fem(q);
    tell(say(q, (f ? 'Enchantée' : 'Enchanté') + ' {P} ! {N} est ' + (f ? 'ravie' : 'ravi') + ' de faire équipe avec toi 💛'));
    audio.beep(760, 0.1, 0.1);
    motion.pop(saveBtn, { scale: 1.08 });
  }

  /* ----- évolution (stade atteint : fêtée une seule fois, mémorisée dans companion.stage) ----- */
  const evolutionDue = p => !!p && stageOf(p) > Math.max(1, +p.companion.stage || 1);
  function checkEvolution() {
    const p = profile();
    if (!p || evoScheduled || destroyed || !evolutionDue(p)) return;
    evolving = true; evoScheduled = true;
    renderGrowth(p);
    later(() => celebrateEvolution(stageOf(p)), ctl && ctl.state.sleeping ? 300 : 1600);
  }
  async function celebrateEvolution(st) {
    const p = profile();
    if (!p || destroyed) { evolving = false; evoScheduled = false; return; }
    if (walking) { later(() => celebrateEvolution(st), 800); return; }
    const f = fem(p);
    if (ctl && ctl.state.sleeping) await ctl.react('wake');
    if (destroyed) return;
    glow.classList.add('is-on');
    if (ctl) await ctl.react('celebrate');
    if (destroyed) return;
    /* il grandit : nouveau stade, dans un éclat de lumière */
    evolving = false; evoScheduled = false;
    store.mutateProfile(pp => { pp.companion.stage = st; });
    drawSVG(profile(), st);
    if (!reduced() && typeof holder.animate === 'function') {
      try { holder.animate([{ transform: 'scale(.86)', filter: 'brightness(1.8)' }, { transform: 'scale(1.06)', filter: 'brightness(1.25)', offset: 0.55 }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 760, easing: 'ease-out' }); } catch (_) {}
    }
    motion.confetti();
    audio.fanfare();
    if (ctl) ctl.react('appear');
    const what = st === 2 ? 'junior' : f ? 'championne' : 'champion';
    tell(say(profile(), 'Waouh ! {N} a grandi : {ilM} est ' + what + ' ! 🌟'));
    /* nouvelle jauge : elle repart de zéro sans « redescendre » sous les yeux de l'enfant */
    growFill.style.transition = 'none';
    renderGrowth(profile());
    try { void growFill.offsetWidth; } catch (_) {}
    growFill.style.transition = '';
    later(() => glow.classList.remove('is-on'), 1800);
  }

  /* ----- écouteurs ----- */
  stage.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      petTap(null);
      if (ctl) ctl.react('tap');
    }
  });
  btns.food.addEventListener('click', () => togglePanel('food'));
  btns.brush.addEventListener('click', brushPet);
  btns.walk.addEventListener('click', walkPet);
  btns.shop.addEventListener('click', () => togglePanel('shop'));
  btns.settings.addEventListener('click', () => togglePanel('settings'));
  segF.addEventListener('click', () => setGender('f'));
  segM.addEventListener('click', () => setGender('m'));
  saveBtn.addEventListener('click', saveSettings);
  for (const inp of [heroIn, mountIn]) inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveSettings(); } });

  /* changements venus d'ailleurs (autre écran, autre profil) : on suit sans écraser le message du moment */
  const unsub = store.subscribe(() => {
    if (destroyed) return;
    const p = profile();
    if (!p) return;
    if (shownSig.split('|')[0] !== String(p.id)) {          /* autre enfant : tout est redessiné */
      if (openPanel) togglePanel(null);
      walking = false; stage.classList.remove('is-walking');
      try { walker.getAnimations().forEach(a => a.cancel()); } catch (_) {}
      evoScheduled = false;
      evolving = evolutionDue(p);
      renderPet();
      checkEvolution();
      return;
    }
    if (lookOf(p) !== shownSig && !evolving && !swapping) {
      /* stade atteint pendant que l'accueil est affiché : on le fête au lieu de redessiner */
      if (evolutionDue(p)) checkEvolution();
      else if (!walking) drawSVG(p);
      else pendingLook = true;
    }
    refresh();
    if (openPanel === 'food') renderFood();
  });

  /* v11 : setInterval(renderPet, 60000) — jauges, humeur, ciel (le SVG n'est jamais redessiné pour l'humeur) */
  minuteTimer = setInterval(() => {
    if (destroyed) return;
    updateSky();
    if (!walking) refresh();
  }, 60000);

  /* premier rendu (le SVG et le moteur de vie arrivent dès qu'ils sont chargés) */
  updateSky();
  const wasReady = !!svgFn && !!life;
  evolving = evolutionDue(profile());          /* l'ancien stade reste affiché jusqu'à la célébration */
  renderPet();
  checkEvolution();
  if (!wasReady) {
    mountReady().then(() => {
      if (destroyed) return;
      updateSky();
      const p = profile();
      if (p && !walking) { drawSVG(p); renderGrowth(p); tell(moodMsg(p, petNow(p.companion.pet))); }
      checkEvolution();
    });
  }

  return {
    el,
    /* fin de balade : le compagnon danse, confettis, fanfare */
    dance() {
      if (destroyed) return;
      if (ctl) ctl.react('celebrate');
      motion.confetti();
      audio.fanfare();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearInterval(minuteTimer);
      for (const t of timers) clearTimeout(t);
      timers.clear();
      try { if (clip) clip.stop(); } catch (_) {}
      clip = null;
      try { unsub(); } catch (_) {}
      try { if (ctl) ctl.destroy(); } catch (_) {}
      ctl = null;
      try { walker.getAnimations().forEach(a => a.cancel()); holder.getAnimations().forEach(a => a.cancel()); } catch (_) {}
      el.remove();
    }
  };
}
