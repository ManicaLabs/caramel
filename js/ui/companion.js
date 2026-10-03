/* ============ COMPAGNON : carte de l'accueil (port de la carte v11) + avatar partagé ============
   Port fidèle de la carte v11 (c5bd8d1:index.html, « COMPAGNON : JAUGES & HUMEUR », « ACTIONS »,
   « PANNEAUX ») sur le profil ACTIF : jauges faim / forme / joie qui baissent doucement avec le temps
   (plancher 15, jamais de « mort »), caresse (cœur + joie), nourrir (garde-manger), brosser (une fois
   toutes les 4 h), promener (une fois par jour), boutique (accessoires, un seul par emplacement),
   montures, réglages (prénom, fille / garçon, nom du compagnon). Mêmes valeurs, mêmes sons que la v11.
   Toute écriture passe par store.mutateProfile (profil.companion, profil.wallet.apples, profil.name / g).
   Différences voulues avec la v11 (textes seulement) : accords selon le genre de la monture (« toute
   belle », « prête », « ravie » pour la licorne), « en jouant » au lieu de « en lisant des histoires »,
   typographie française (…, ’, espaces fines), messages pour la boutique (remplacement d'un accessoire).

   API :
     mountReady() → Promise : charge js/ui/mount-svg.js (+ css/ui/mount.css) une seule fois ;
     avatarSVG(type, worn, size, mood) → chaîne SVG (mountSVG, ou repli emoji si le module manque) ;
     avatarOf(profile, size, mood) → idem pour le compagnon d'un profil ;
     renderCompanionCard(container) → { destroy(), dance(), el } */

import { h, clear, dayStr, frTypo, loadCSS } from '../core/util.js';
import * as store from '../core/store.js';
import * as audio from '../core/audio.js';
import * as motion from '../core/motion.js';
import { MOUNTS, FOODS, SHOP, PET } from '../content/companion-data.js';
import { fillTemplate, sanitizeName, DEFAULT_HERO } from '../core/profiles.js';
import { addApples } from '../core/economy.js';

/* ---------- compagnon SVG (module de l'équipe G1, chargé à la demande, avec repli) ---------- */
let svgFn = null;
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
      }).catch(e => { try { console.warn('Compagnon SVG indisponible, repli emoji', e); } catch (_) {} }),
      ensureMountCSS()
    ]).then(() => undefined);
  }
  return loading;
}
/* repli : l'emoji de la monture dans le même cadre (100 × 84) que le SVG v11 */
function fallbackSVG(type, size, mood) {
  const m = MOUNTS[type] || MOUNTS.pony;
  const s = Math.max(16, Math.round(+size || 100));
  return '<svg class="m-root m-fallback ' + (mood || '') + '" width="' + s + '" height="' + Math.round(s * 0.84) +
    '" viewBox="0 0 100 84" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><text x="50" y="66" font-size="64" text-anchor="middle">' +
    m.em + '</text></svg>';
}
export function avatarSVG(type, worn, size, mood = '') {
  const t = MOUNTS[type] ? type : 'pony';
  const w = Array.isArray(worn) ? worn : [];
  if (svgFn) {
    try {
      const out = svgFn(t, w, size, mood);
      if (typeof out === 'string' && out.indexOf('<svg') >= 0) return out;
    } catch (e) { try { console.warn('mountSVG', e); } catch (_) {} }
  }
  return fallbackSVG(t, size, mood);
}
export function avatarOf(profile, size, mood = '') {
  const c = (profile && profile.companion) || {};
  return avatarSVG(c.type, c.equip && c.equip.worn, size, mood);
}
/* le SVG renvoyé est une chaîne : on le pose dans un conteneur, masqué aux lecteurs d'écran */
export function setAvatar(el, html) {
  if (!el) return;
  el.innerHTML = html;
  const s = el.querySelector('svg');
  if (s) { s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); }
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

/* ============ CARTE ============ */
let cardSeq = 0;
export function renderCompanionCard(container) {
  const uid = 'cc' + (++cardSeq);
  const timers = new Set();
  let destroyed = false, clip = null, walking = false, openPanel = null;
  let shownSig = '', lastMoodCls = null, minuteTimer = 0;
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!destroyed) fn(); }, ms); timers.add(t); return t; };
  const profile = () => store.getProfile();
  const isWide = () => { try { return matchMedia('(min-width: 900px)').matches; } catch (_) { return false; } };
  const stageSize = () => (isWide() ? 190 : 135);

  /* ----- squelette ----- */
  const holder = h('div', { class: 'cc-holder' });
  const sparkLayer = h('div', { class: 'cc-fx', 'aria-hidden': 'true' });
  const stage = h('div', {
    class: 'cc-stage', role: 'button', tabindex: '0'
  },
  h('div', { class: 'cc-sky', 'aria-hidden': 'true' },
    h('span', { class: 'cc-sun' }, '☀️'),
    h('span', { class: 'cc-cloud' }, '☁️'),
    h('span', { class: 'cc-cloud cc-cloud-2' }, '☁️')),
  h('div', { class: 'cc-hill', 'aria-hidden': 'true' }),
  h('div', { class: 'cc-fence', 'aria-hidden': 'true' }),
  h('span', { class: 'cc-flower cc-flower-1', 'aria-hidden': 'true' }, '🌼'),
  h('span', { class: 'cc-flower cc-flower-2', 'aria-hidden': 'true' }, '🌷'),
  h('div', { class: 'cc-shadow', 'aria-hidden': 'true' }),
  holder, sparkLayer);
  const nameTag = h('span', { class: 'cc-name' });
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
    mood,
    h('div', { class: 'cc-gauges' }, G.faim.el, G.forme.el, G.joie.el),
    h('div', { class: 'cc-actions' }, btns.food, btns.brush, btns.walk, btns.shop, btns.settings),
    panels.food, panels.shop, panels.settings);
  clear(container);
  container.appendChild(el);

  /* ----- rendu ----- */
  /* ce qui est dessiné : profil, monture, accessoires portés (la classe d'humeur à part) */
  function lookOf(p) {
    const c = (p && p.companion) || {};
    return [p && p.id, c.type, ((c.equip && c.equip.worn) || []).join(',')].join('|');
  }
  function drawSVG(p, cls) {
    if (walking) return;                       /* la promenade garde son SVG « walk » jusqu'au retour */
    setAvatar(holder, avatarOf(p, stageSize(), cls));
    shownSig = lookOf(p);
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
  /* v11 renderPet(extraClass) : compagnon (humeur + classe en plus), message d'humeur, jauges */
  function renderPet(extra) {
    const p = profile();
    if (!p) return;
    const g = petNow(p.companion && p.companion.pet);
    const m = moodOf(p, g);
    lastMoodCls = m.cls;
    drawSVG(p, [m.cls, extra].filter(Boolean).join(' '));
    mood.textContent = m.msg;
    renderGauges(g);
    renderName(p);
    renderPurse(p);
  }
  function tell(text) { mood.textContent = text; }

  /* ----- grilles des panneaux ----- */
  const item = (cls, icon, name, price, label, onTap, pressed) => {
    const b = h('button', { type: 'button', class: 'cc-item ' + cls, 'aria-label': label },
      h('span', { class: 'cc-item-ico', 'aria-hidden': 'true' }, icon),
      h('span', { class: 'cc-item-name' }, name),
      h('span', { class: 'cc-item-price' }, price));
    if (pressed !== undefined) b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    b.addEventListener('click', onTap);
    return b;
  };
  function renderFood() {
    const p = profile(); if (!p) return;
    const apples = p.wallet.apples;
    clear(foodGrid);
    for (const f of FOODS) {
      const ok = apples >= f.price;
      foodGrid.appendChild(item(ok ? 'can' : 'cant', f.e, f.name, f.price + ' 🍎',
        f.name + ', ' + f.price + ' pommes' + (ok ? '' : ' (pas assez de pommes)'), () => feedPet(f.id)));
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
    for (const t of Object.keys(MOUNTS)) {
      const m = MOUNTS[t];
      const owned = c.owned.includes(t), sel = c.type === t;
      const price = sel ? 'choisi ✓' : owned ? 'choisir' : m.price + ' 🍎';
      const label = m.label + (sel ? ', choisi' : owned ? ', à choisir' : ', ' + m.price + ' pommes');
      const ico = h('span', { class: 'cc-mount-pic' });
      setAvatar(ico, avatarSVG(t, c.equip.worn, 58, ''));
      mountGrid.appendChild(item(sel ? 'worn' : owned ? 'owned' : '', ico, m.label, price, label, () => mountTap(t), sel));
    }
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
        if (r.bottom > innerHeight - 8) pan.scrollIntoView({ block: 'nearest', behavior: motion.reduced() ? 'auto' : 'smooth' });
      } catch (_) {}
    }, 60);
  }

  /* ----- actions (v11 à l'identique : mêmes valeurs, mêmes sons) ----- */
  function addFx(char, x, y, delay = 0) {
    const s = h('span', { class: 'cc-heart' }, char);
    s.style.left = x + 'px'; s.style.top = y + 'px';
    if (delay) s.style.animationDelay = delay + 's';
    sparkLayer.appendChild(s);
    later(() => s.remove(), 1300 + delay * 1000 + 300);
  }
  function petTap(ev) {
    const p = profile(); if (!p) return;
    store.mutateProfile(pp => {
      materialize(pp.companion.pet);
      pp.companion.pet.joie = Math.min(PET.MAX, pp.companion.pet.joie + PET.TAP.joie);
    });
    const r = stage.getBoundingClientRect();
    const cx = ev && Number.isFinite(ev.clientX) && ev.clientX ? ev.clientX : r.left + r.width / 2;
    const cy = ev && Number.isFinite(ev.clientY) && ev.clientY ? ev.clientY : r.top + r.height / 2;
    addFx('❤️', Math.max(6, Math.min(r.width - 24, cx - r.left - 10)), Math.max(6, Math.min(r.height - 30, cy - r.top - 12)));
    audio.neigh();
    renderPet('joy');
  }
  function feedPet(id) {
    const f = FOODS.find(o => o.id === id);
    const p = profile();
    if (!f || !p) return;
    if (p.wallet.apples < f.price) {
      tell(frTypo('Pas assez de 🍎… Gagne des pommes en jouant !'));
      motion.shake(mood, { dist: 4 });
      return;
    }
    store.mutateProfile(pp => {
      materialize(pp.companion.pet);
      addApples(pp, -f.price);
      pp.companion.pet.faim = Math.min(PET.MAX, pp.companion.pet.faim + f.faim);
      pp.companion.pet.joie = Math.min(PET.MAX, pp.companion.pet.joie + (f.joie || 0));
    });
    audio.beep(660, 0.08, 0.1); later(() => audio.beep(880, 0.1, 0.1), 110);
    renderFood(); renderPet('joy');
    const r = holder.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    for (let i = 0; i < 3; i++) addFx(f.e, r.left - sr.left + r.width * (0.55 + 0.12 * i), r.top - sr.top + r.height * 0.15, i * 0.12);
    tell(say(profile(), '{N} croque ' + f.e + ' avec appétit. Miam !'));
  }
  function brushPet() {
    const p = profile(); if (!p) return;
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
    const sr = stage.getBoundingClientRect();
    for (let i = 0; i < 5; i++) addFx('✨', sr.width * (0.3 + Math.random() * 0.4), sr.height * (0.3 + Math.random() * 0.4), i * 0.12);
    audio.beep(880, 0.08, 0.08);
    renderPet('joy');
    const kind = mountOf(profile()).kind;
    const coat = kind === 'dolphin' ? 'quelle peau toute douce !' : kind === 'dragon' ? 'quelles belles écailles !' : 'quel beau poil !';
    tell(say(profile(), '{N} adore le brossage, ' + coat + ' ✨'));
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
    renderPet('walk');
    walking = true;
    holder.classList.add('walking');
    try { if (clip) clip.stop(); } catch (_) {}
    clip = audio.clipClop();
    walkAnim();
    later(() => { walking = false; holder.classList.remove('walking'); clip = null; renderPet(); }, 4100);
    tell(say(profile(), '{N} part en promenade, quel bonheur ! 🚶'));
  }
  /* v11 walkmove (4 s : gauche, droite, retour au centre) ; en plus : le compagnon se retourne */
  function walkAnim() {
    if (motion.reduced() || typeof holder.animate !== 'function') return;
    const w = stage.clientWidth || 300, d = Math.min(120, w * 0.3);
    try {
      holder.animate([
        { transform: 'translateX(0) scaleX(1)', offset: 0 },
        { transform: 'translateX(0) scaleX(-1)', offset: 0.03 },
        { transform: 'translateX(' + (-d) + 'px) scaleX(-1)', offset: 0.25 },
        { transform: 'translateX(' + (-d) + 'px) scaleX(1)', offset: 0.28 },
        { transform: 'translateX(' + d + 'px) scaleX(1)', offset: 0.72 },
        { transform: 'translateX(' + d + 'px) scaleX(-1)', offset: 0.75 },
        { transform: 'translateX(0) scaleX(-1)', offset: 0.97 },
        { transform: 'translateX(0) scaleX(1)', offset: 1 }
      ], { duration: 4000, easing: 'ease-in-out' });
    } catch (_) {}
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
    renderShop(); renderMounts(); renderPet('joy');
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
    let bought = false;
    store.mutateProfile(pp => {
      if (!pp.companion.owned.includes(t)) { addApples(pp, -m.price); pp.companion.owned.push(t); bought = true; }
      pp.companion.type = t;
    });
    if (bought) { audio.fanfare(); motion.confetti(); }
    renderMounts(); renderShop(); renderPet('joy');
  }
  function saveSettings() {
    const p = profile(); if (!p) return;
    store.mutateProfile(pp => {
      pp.name = sanitizeName(heroIn.value, pp.name || DEFAULT_HERO);
      pp.g = gSel === 'm' ? 'm' : 'f';
      pp.companion.name = sanitizeName(mountIn.value, mountOf(pp).label);
    });
    fillSettings();
    renderPet('joy');
    const q = profile(), f = fem(q);
    tell(say(q, (f ? 'Enchantée' : 'Enchanté') + ' {P} ! {N} est ' + (f ? 'ravie' : 'ravi') + ' de faire équipe avec toi 💛'));
    audio.beep(760, 0.1, 0.1);
    motion.pop(saveBtn, { scale: 1.08 });
  }

  /* ----- écouteurs ----- */
  stage.addEventListener('click', petTap);
  stage.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); petTap(null); }
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
      walking = false; holder.classList.remove('walking');
      renderPet();
      return;
    }
    const g = petNow(p.companion.pet);
    const m = moodOf(p, g);
    if (lookOf(p) !== shownSig || m.cls !== lastMoodCls) { lastMoodCls = m.cls; drawSVG(p, m.cls); }
    renderGauges(g); renderName(p); renderPurse(p);
    if (openPanel === 'food') renderFood();
  });

  /* v11 : setInterval(renderPet, 60000) — jauges, humeur ; le SVG n'est redessiné que si l'humeur change */
  minuteTimer = setInterval(() => {
    if (destroyed || walking) return;
    const p = profile(); if (!p) return;
    const g = petNow(p.companion.pet);
    const m = moodOf(p, g);
    if (m.cls !== lastMoodCls) { lastMoodCls = m.cls; drawSVG(p, m.cls); }
    mood.textContent = m.msg;
    renderGauges(g);
  }, 60000);

  /* SVG pas encore chargé : on redessine dès qu'il l'est */
  const wasReady = !!svgFn;
  renderPet();
  if (!wasReady) mountReady().then(() => { if (!destroyed && !walking) { const p = profile(); if (p) drawSVG(p, lastMoodCls || ''); } });

  return {
    el,
    /* fin de balade : le compagnon danse, confettis, fanfare */
    dance() {
      if (destroyed) return;
      const p = profile(); if (!p) return;
      walking = false; holder.classList.remove('walking');
      drawSVG(p, 'joy dance');
      const svgEl = holder.querySelector('svg');
      let animated = false;
      try { animated = !!svgEl && getComputedStyle(svgEl).animationName !== 'none'; } catch (_) {}
      if (!animated) { holder.classList.remove('anim-dance'); void holder.offsetWidth; holder.classList.add('anim-dance'); }
      motion.confetti();
      audio.fanfare();
      later(() => { holder.classList.remove('anim-dance'); drawSVG(profile() || p, lastMoodCls || ''); }, 1600);
    },
    destroy() {
      destroyed = true;
      clearInterval(minuteTimer);
      for (const t of timers) clearTimeout(t);
      timers.clear();
      try { if (clip) clip.stop(); } catch (_) {}
      clip = null;
      try { unsub(); } catch (_) {}
      el.remove();
    }
  };
}
