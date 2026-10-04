/* ============ LA COURSE DE {N} — fr.fluence (+ fr.comp_ecrit) ============
   Port fidèle de « La course de Caramel » v11.3 (index.html @ c5bd8d1) : barre micro de 72 px, piste
   thématique (décors, obstacles liés aux pauses, Zip 🦋, drapeau 🏁, étincelle de série, compagnon SVG
   avec ses accessoires), texte karaoké plein écran avec défilement automatique, sons beep/fanfare v11,
   confettis, règles v11 (chrono au premier mot ; 3 ⭐ = précision ≥ 90 % ET Zip battu, 2 ⭐ = précision
   ≥ 75 %, sinon 1 ⭐ ; ligne 👂 ; « Je ne t’entends pas » à 7 s ; wake lock ; messages d'erreur du micro ;
   repli Web Speech ; téléchargement du moteur en % dès l'ouverture de l'histoire).
   Logique de lecture (alignement, indulgence, joker [unk], pauses) : js/games/course-engine.js, code v11
   à l'identique, testé contre la v11 elle-même (tests/course-engine.test.mjs).
   Nouveautés v2 :
   - mode libre : mondes (WORLDS, jamais de classe) et cartes v11 ; mode balade : histoire choisie par
     ctx.nextItem('fr.fluence', { profile }) puis course directe ;
   - Zip adaptatif (médiane des 5 derniers MCLM × 1,05, bornée par la cible de la classe) ;
   - mots hors lexique Vosk (OOV) validables par [unk] ;
   - question de compréhension après l'arrivée (fr.comp_ecrit), avant les résultats : 1re erreur (ou
     joker) → « Relis le passage » + extrait surligné, 2e erreur → bonne réponse montrée ;
   - cycle de vie de la manche : rapport de course à l'arrivée → question → ctx.end({ stay: true }) →
     résultats → Revanche / Suite / Histoires (ctx.again) ou « Continuer la balade » (ctx.leave).
   Aucune écriture directe : tout passe par ctx.report / ctx.end (la manche persiste).
   v2.2 :
   - micro impossible (refusé, absent, hors ligne au 1er lancement, navigateur sans reconnaissance) : écran « micro »
     (compagnon, une phrase pour l'enfant, « Changer de jeu ➜ » = ctx.changeGame, « Aide pour l'adulte » = marche à
     suivre adaptée à l'appli installée, puis « Réessayer 🎤 ») ; permission déjà refusée → cet écran tout de suite
     (D1-01, D4-04). Le moteur (speech.js, course-engine.js) n'est pas touché : seul l'affichage de ses erreurs change ;
   - attente du moteur : « Je me prépare à t'écouter… » et une jauge, plus de « Téléchargement du moteur » (D1-10) ;
   - balade : après les résultats, « Étape suivante ▶ » lance l'étape suivante (comme le bilan des autres jeux).
   Styles : css/games/course.css (préfixe .cr-). */

import { h, clear, frTypo, buzz } from '../core/util.js';
import { mclmTarget } from '../core/levels.js';
import { MOUNTS } from '../content/companion-data.js';
import {
  STORIES, WORLDS, OOV, storyById, storyIndex, storiesOf, isUnlocked, totalStarsOf, classBonus, itemFor
} from '../content/stories/index.js';
import * as E from './course-engine.js';

const NNBSP = '\u202f';                                    /* espace fine insécable */
const NBSP = '\u00a0';                                     /* espace insécable */
const WIDE = '(min-width: 900px)';                         /* grand écran (tailles v11) */
/* monde où commencer la carte (affichage seulement ; même correspondance que classBonus) */
const CLASS_WORLD = { CP: 'galops', CE1: 'galops', CE2: 'trot', CM1: 'emerite', CM2: 'legende' };
const SENTENCE_END = /[.!?…»]$/;
/* bonds et trébuchement du compagnon (keyframes cr-hop / cr-hopbig / cr-stumble de la v11, mêmes hauteurs en px et
   durées) appliqués au CORPS du rig : u = unités du viewBox par px ; lift = moment où le corps est le plus haut
   (l'ombre est alors la plus petite) */
const PONY_FX = {
  hop: { ms: 300, lift: 0.5, body: u => [{ transform: 'translateY(0px)' }, { transform: `translateY(${(-16 * u).toFixed(2)}px)`, offset: 0.5 }, { transform: 'translateY(0px)' }] },
  'hop-big': { ms: 500, lift: 0.45, body: u => [{ transform: 'translateY(0px) rotate(0deg)' }, { transform: `translateY(${(-38 * u).toFixed(2)}px) rotate(-8deg)`, offset: 0.45 }, { transform: 'translateY(0px) rotate(0deg)' }] },
  stumble: { ms: 500, lift: 0, body: u => [{ transform: 'rotate(0deg) translateY(0px)' }, { transform: `rotate(-16deg) translateY(${(4 * u).toFixed(2)}px)`, offset: 0.25 }, { transform: 'rotate(12deg) translateY(0px)', offset: 0.6 }, { transform: 'rotate(0deg) translateY(0px)' }] }
};

/* libellés du micro (v11 ; points de suspension typographiques) */
const TXT = {
  idle: frTypo('Appuie sur le micro et lis !'),
  /* consigne dite aux petits lecteurs à l'ouverture d'une histoire (v2.2.1 ; 🔊 la relit jusqu'au départ du micro) */
  go: frTypo('Appuie sur le micro, puis lis l’histoire à voix haute !'),
  prep: 'Préparation du micro… 🎙️',
  on: frTypo('Je t’écoute… lis l’histoire ! 🎧'),
  deaf: frTypo('Je ne t’entends pas 🤔 Parle plus fort, tout près du téléphone !'),
  fail: frTypo('Le micro n’a pas démarré 😕 Touche-le pour réessayer.'),
  /* attente du moteur vocal (1er téléchargement, ≈ 45 Mo) : une phrase d'enfant, la jauge montre l'avancée (D1-10) */
  dl: p => (p < 99 ? frTypo('Je me prépare à t’écouter… ') + p + NNBSP + '%' : frTypo('Presque prêt…'))
};
const DL_HEAD = 'Je me prépare';
const isDlText = t => String(t).startsWith(DL_HEAD) || t === TXT.dl(100);
/* erreurs du micro sans remède pour l'enfant : écran « micro » (le réseau seulement avant le moindre mot entendu ;
   ensuite, comme en v11, le message s'affiche sous le micro et la reconnaissance se relance) */
const MIC_HARD = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'unsupported', 'language-not-supported']);
const isHard = (code, r) => MIC_HARD.has(code) || (code === 'network' && !(r && r.st && r.st.gotAnyResult));
/* statut du moteur (js/core/speech.js) en mots d'enfant : seulement pendant qu'il se prépare */
function childStatus(t) {
  const s = String(t || '');
  const m = /(\d+)\s*%/.exec(s);
  if (/téléchargement/i.test(s) && m) return TXT.dl(Number(m[1]));
  if (/chargement/i.test(s)) return frTypo('Je me prépare à t’écouter…');
  return '';
}

let inst = null;

export default {
  id: 'course', title: 'La course de {N}', icon: '🏁', axes: ['fr.fluence', 'fr.comp_ecrit'],
  css: 'css/games/course.css',
  async mount(root, ctx) {
    if (inst) inst.destroy();
    inst = createCourse(root, ctx);
    inst.start();
  },
  unmount() {
    if (inst) inst.destroy();
    inst = null;
  }
};

function createCourse(root, ctx) {
  let alive = true;
  let race = null;              /* course ouverte (puis question et résultats de cette course) */
  let sheet = null;             /* feuille ouverte (« le passage », aide pour l'adulte) */
  let micSaid = false;          /* l'écran « micro » a confié sa phrase à la voix (🔊 à vider ensuite) */
  const timers = new Set();     /* minuteries de l'instance (vidées au démontage) */
  const cleanups = new Set();   /* nettoyage de la vue courante (écouteurs) */
  const box = h('div', { class: 'cr' });
  root.appendChild(box);

  /* ---------- petits outils ---------- */
  const prof = () => { try { return ctx.profile || null; } catch (_) { return null; } };
  const fill = s => { try { return ctx.fill(String(s ?? '')); } catch (_) { return String(s ?? ''); } };
  const wide = () => { try { return globalThis.matchMedia(WIDE).matches; } catch (_) { return false; } };
  const reduced = () => { try { return !!ctx.motion.reduced(); } catch (_) { return false; } };
  const nowMs = () => (globalThis.performance && performance.now ? performance.now() : Date.now());
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms);
    timers.add(id);
    return id;
  };
  const drop = id => { if (id) { clearTimeout(id); timers.delete(id); } return 0; };
  const safe = (fn, ...a) => { try { return fn(...a); } catch (e) { console.error('course', e); return null; } };
  const mountOf = p => {
    const c = (p && p.companion) || {};
    const type = MOUNTS[c.type] ? c.type : 'pony';
    const worn = c.equip && Array.isArray(c.equip.worn) ? c.equip.worn : [];
    return { type, M: MOUNTS[type], worn, name: typeof c.name === 'string' && c.name ? c.name : 'Caramel' };
  };
  const starsOf = (p, s) => {
    const v = p && p.wallet && p.wallet.stars ? Number(p.wallet.stars[s.id]) : 0;
    return v > 0 ? Math.min(3, Math.floor(v)) : 0;
  };
  /* Zip adaptatif : MCLM du profil, sinon cible de l'histoire ; borné par la cible de fin d'année de la classe */
  const zipFor = (s, p = prof()) => E.adaptiveZip(p && p.mclm, s.target, mclmTarget(p && p.classe));
  const zipText = z => frTypo('🦋 Zip : ') + z + ' mots/min';
  const ico = e => h('span', { 'aria-hidden': 'true' }, e);
  const starsLabel = n => (n === 0 ? 'pas encore d’étoile' : n === 1 ? '1 étoile sur 3' : n + ' étoiles sur 3');
  /* trois étoiles de même forme : les éteintes sont grisées en CSS (D3-18) */
  const starRow = (n, cls) => h('span', { class: cls, 'aria-hidden': 'true' },
    [0, 1, 2].map(i => h('span', { class: i < n ? 'on' : 'off' }, '⭐')));
  const worldOf = id => { const i = storyIndex(id); return WORLDS.find(w => i >= w.from && i <= w.to) || null; };

  function setView(kind) {
    for (const fn of cleanups) safe(fn);
    cleanups.clear();
    closeSheet();
    clear(box);
    box.dataset.view = kind;
    const v = h('section', { class: 'cr-view cr-' + kind });
    box.appendChild(v);
    return v;
  }
  function closeSheet() {
    const s = sheet;
    sheet = null;
    if (s) safe(() => s.close('api'));
  }

  /* ======================= CARTE DES HISTOIRES (mode libre) ======================= */
  function showList(focusId) {
    endRace();
    const v = setView('list');
    const p = prof();
    ctx.setTitle(fill('La course de {N}'));
    ctx.onJoker(() => { ctx.kit.toast(frTypo('Choisis d’abord une histoire 📚')); return false; });
    safe(() => ctx.voice.say(frTypo('Choisis une histoire !')));                 /* v2.2.1 : 🔊 jamais muet */

    const total = totalStarsOf(p);
    const have = total + classBonus(p && p.classe);
    const adaptive = !!(p && Array.isArray(p.mclm) && p.mclm.length);

    const intro = h('div', { class: 'cr-intro' },
      h('span', { class: 'cr-intro-mount', 'aria-hidden': 'true', html: ctx.petSVG(wide() ? 84 : 66, '') }),
      h('div', { class: 'cr-intro-txt' },
        h('p', { class: 'cr-intro-title' }, frTypo('Lis une histoire à voix haute et bats Zip le papillon 🦋 !')),
        h('div', { class: 'cr-chips' },
          h('span', { class: 'cr-chip', role: 'img', 'aria-label': total + (total > 1 ? ' étoiles gagnées' : ' étoile gagnée') }, '⭐ ' + total),
          adaptive ? h('span', { class: 'cr-chip is-zip', role: 'img', 'aria-label': 'Zip le papillon court à ' + zipFor(STORIES[0], p) + ' mots par minute' },
            zipText(zipFor(STORIES[0], p))) : null)));

    const navBtns = new Map();
    const nav = h('nav', { class: 'cr-nav', 'aria-label': 'Les mondes' });
    const sections = new Map();
    const cards = new Map();
    const worlds = WORLDS.map(w => {
      const list = storiesOf(w);
      const got = list.reduce((a, s) => a + starsOf(p, s), 0);
      const open = list.some(s => isUnlocked(s, p));
      const btn = h('button', { type: 'button', class: 'cr-nav-btn' + (open ? '' : ' is-locked'), 'aria-label': w.name, title: w.name,
        on: { click: () => jumpTo(w) } }, h('span', { 'aria-hidden': 'true' }, w.emoji));
      navBtns.set(w.id, btn);
      nav.appendChild(btn);
      const grid = h('div', { class: 'cr-cards' }, list.map(s => {
        const c = storyCard(s, p, have, adaptive);
        cards.set(s.id, c);
        return c;
      }));
      const sec = h('section', { class: 'cr-world', 'data-world': w.id, 'aria-label': w.name },
        h('div', { class: 'cr-world-head' },
          h('h2', { class: 'cr-world-title' }, w.name, ' ', ico(w.emoji)),
          h('span', { class: 'cr-world-stars', role: 'img', 'aria-label': got + (got > 1 ? ' étoiles gagnées' : ' étoile gagnée') + ' sur ' + list.length * 3 },
            '⭐ ' + got + ' / ' + list.length * 3)),
        grid);
      sections.set(w.id, sec);
      return sec;
    });
    const status = h('p', { class: 'cr-engine' });
    const navWrap = h('div', { class: 'cr-nav-wrap' }, nav);
    const scroller = h('div', { class: 'cr-list-scroll' }, intro, navWrap, worlds, status);
    v.appendChild(scroller);

    /* statut du moteur vocal en mots d'enfant, seulement pendant qu'il se prépare (rempli dès qu'une histoire a été
       ouverte) ; l'état détaillé du moteur est dans l'espace parents */
    const off = safe(() => ctx.speech.onStatus(t => { status.textContent = childStatus(t); }));
    if (typeof off === 'function') cleanups.add(off);

    /* monde courant mis en évidence dans la barre des mondes */
    const navH = () => navWrap.offsetHeight || 64;
    /* défilement qui pose l'en-tête du monde juste sous la barre des mondes (1er monde : tout en haut) */
    const topOf = w => (w === WORLDS[0] ? 0 : Math.max(0, sections.get(w.id).offsetTop - navH() - 6));
    let raf = 0;
    const spy = () => {
      raf = 0;
      let cur = WORLDS[0].id;
      for (const w of WORLDS) if (sections.get(w.id).offsetTop - scroller.scrollTop <= navH() + 24) cur = w.id;
      for (const [id, b] of navBtns) { b.classList.toggle('on', id === cur); b.setAttribute('aria-current', id === cur ? 'true' : 'false'); }
      navWrap.classList.toggle('is-stuck', scroller.scrollTop > intro.offsetTop + intro.offsetHeight - 2);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(spy); };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    cleanups.add(() => { scroller.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); raf = 0; });
    function jumpTo(w) {
      if (!sections.get(w.id)) return;
      const top = topOf(w);
      try { scroller.scrollTo({ top, behavior: reduced() ? 'auto' : 'smooth' }); } catch (_) { scroller.scrollTop = top; }
      ctx.audio.tap();
    }

    /* point de départ : l'histoire qu'on vient de lire, sinon la dernière lue, sinon le monde de sa classe */
    const last = p && Array.isArray(p.mclm) && p.mclm.length ? p.mclm[p.mclm.length - 1].s : null;
    const fw = (focusId && worldOf(focusId)) || (last && worldOf(last)) || WORLDS.find(w => w.id === CLASS_WORLD[p && p.classe]) || WORLDS[0];
    if (fw && fw !== WORLDS[0]) scroller.scrollTop = topOf(fw);
    spy();
    /* entrée en cascade des cartes visibles ; l'histoire qu'on vient de lire fait un petit « pop » */
    const visible = [...cards.values()].filter(c => {
      const t = c.offsetTop - scroller.scrollTop;
      return t > -40 && t < scroller.clientHeight + 40;
    }).slice(0, 8);
    ctx.motion.stagger(visible, el => ctx.motion.enter(el, { from: 'bottom', dist: 14, dur: 380 }), 45);
    if (focusId && cards.get(focusId)) later(() => ctx.motion.pop(cards.get(focusId), { scale: 1.04 }), 420);
  }

  /* adaptive : Zip suit déjà la vitesse de l'enfant (même allure pour toutes les histoires, dite une fois en haut) →
     la ligne Zip n'est répétée sur les cartes que tant qu'aucune lecture n'a été mesurée (D1-23) */
  function storyCard(s, p, have, adaptive) {
    const title = fill(s.title);
    if (isUnlocked(s, p)) {
      const n = starsOf(p, s);
      return h('button', { type: 'button', class: 'cr-card' + (n === 3 ? ' is-done' : ''), 'data-id': s.id,
        'aria-label': title + ', ' + starsLabel(n),
        on: { click: () => { ctx.audio.tap(); openStory(s); } } },
        h('span', { class: 'cr-card-emoji', 'aria-hidden': 'true' }, s.emoji),
        h('span', { class: 'cr-card-mid' },
          h('span', { class: 'cr-card-title' }, title),
          adaptive ? null : h('span', { class: 'cr-card-sub' }, zipText(zipFor(s, p)))),
        starRow(n, 'cr-card-stars'));
    }
    const need = Math.max(1, s.need - have);
    const card = h('div', { class: 'cr-card is-locked', role: 'button', tabindex: '0', 'aria-disabled': 'true', 'data-id': s.id,
      'aria-label': title + ' : encore ' + need + (need > 1 ? ' étoiles' : ' étoile') + ' pour débloquer',
      on: { click: () => { ctx.motion.shake(card, { dist: 4, dur: 320 }); ctx.audio.soft(); } } },
      h('span', { class: 'cr-card-emoji', 'aria-hidden': 'true' }, s.emoji),
      h('span', { class: 'cr-card-mid' },
        h('span', { class: 'cr-card-title' }, title),
        h('span', { class: 'cr-card-sub' }, 'Encore ' + need + NBSP + '⭐ pour débloquer')),
      h('span', { class: 'cr-card-lock', 'aria-hidden': 'true' }, '🔒'));
    return card;
  }

  /* ======================= LA COURSE (écran de lecture v11) ======================= */
  function openStory(s, item) {
    endRace();
    const p = prof();
    if (!s || !p) { showList(); return; }
    const m = mountOf(p);
    const text = fill(s.text);
    const st = E.createRace(text, { mountNoun: m.M.noun, oov: OOV });
    if (!st.target.length) { showList(); return; }
    const v = setView('race');
    micSaid = false;
    safe(() => ctx.voice.say(TXT.go));                /* la consigne (v2.2.1) : 🔊 la relit tant que la lecture n'a pas commencé */
    const r = race = {
      s, text, st, item: item || itemFor(s), zip: zipFor(s, p), m, size: wide() ? 72 : 46,
      timers: { race: 0, noResult: 0, finish: 0, quiz: 0 }, wake: null, starting: false, done: false,
      dlShown: false, els: {}, wordEls: [], hurdleEls: {}, view: v
    };
    ctx.setTitle(fill(s.title));
    ctx.progress(0, 0);
    ctx.onJoker(() => {
      if (!r.done) ctx.kit.toast(frTypo('Lis à ton rythme : le joker t’aidera pour la petite question 🔎'));
      return false;
    });

    /* barre du micro */
    const mic = h('button', { type: 'button', class: 'cr-mic', 'aria-label': 'Micro : commencer à lire', 'aria-pressed': 'false',
      on: { click: () => micTap(r) } }, h('span', { 'aria-hidden': 'true' }, '🎤'));
    const label = h('p', { class: 'cr-mic-label' }, TXT.idle);
    /* jauge du 1er téléchargement du moteur (D1-10) : visible seulement pendant l'attente */
    const dlFill = h('span', { class: 'cr-dl-fill' });
    const dlBar = h('span', { class: 'cr-dl', role: 'progressbar', 'aria-label': 'Je me prépare à t’écouter', 'aria-valuemin': '0', 'aria-valuemax': '100', hidden: true }, dlFill);
    const heard = h('p', { class: 'cr-heard', 'aria-hidden': 'true' });
    const change = ctx.mode === 'balade' ? null
      : h('button', { type: 'button', class: 'cr-change', on: { click: () => { ctx.audio.tap(); showList(s.id); } } },
        h('span', { 'aria-hidden': 'true' }, '📚'), 'Changer d’histoire');
    if (change) heard.hidden = true;
    const bar = h('div', { class: 'cr-bar' }, mic, h('div', { class: 'cr-bar-txt' }, label, dlBar, heard, change));

    /* piste, infos, texte */
    const track = buildTrack(r);
    /* combo ⚡ (mots lus d'affilée) : 🔥 est réservé aux jours de suite (D4-12) */
    const streak = h('span', { class: 'cr-streak', role: 'img', 'aria-label': 'Combo : 0' }, '⚡ 0');
    const timer = h('span', { class: 'cr-timer' }, '⏱ 0' + NNBSP + 's');
    const zip = h('span', { class: 'cr-zip' }, zipText(r.zip));
    const info = h('div', { class: 'cr-info' }, streak, timer, zip);
    const textEl = h('div', { class: 'cr-text read' + (st.target.length > 120 ? ' is-long' : ''), tabindex: '0', role: 'region',
      'aria-label': 'Texte de l’histoire' });
    r.wordEls = st.target.map(w => {
      const sp = h('span', { class: 'cr-word pending' }, w.raw);
      textEl.append(sp, ' ');
      return sp;
    });
    const done = h('button', { type: 'button', class: 'btn cr-done', hidden: true, on: { click: () => finishRace(r) } }, 'J’ai fini ✓');
    const textWrap = h('div', { class: 'cr-textwrap' }, textEl, done);
    v.append(bar, track, info, textWrap);
    Object.assign(r.els, { mic, label, dlBar, dlFill, heard, change, track, streak, timer, zip, text: textEl, done });

    /* le moteur se prépare dès l'ouverture de l'histoire (v11 : openStory → ensureVosk) */
    try {
      const pr = ctx.speech.ensureVosk(pct => {
        if (!alive || race !== r || r.st.running) return;
        r.dlShown = true;
        setLabel(r, TXT.dl(pct));
        showDl(r, pct);
      });
      if (pr && typeof pr.then === 'function') pr.then(() => {
        if (!alive || race !== r) return;
        showDl(r, null);
        if (r.dlShown && !r.st.running && !r.starting && !r.done) setLabel(r, TXT.idle);
      }, () => { if (alive && race === r) showDl(r, null); });
    } catch (_) {}
    /* permission du micro déjà refusée, ou aucune reconnaissance possible ici : l'écran « micro » tout de suite */
    precheckMic().then(code => { if (code && alive && race === r && !r.st.running && !r.starting && !r.done) showMicProblem(r, code); });

    renderText(r);
    scrollToCurrent(r, false);
    moveActor(r, 'pony', 0);
    moveActor(r, 'fly', 0);
    ctx.motion.enter(v, { from: 'fade', dur: 260 });
    ctx.announce(frTypo(fill(s.title) + '. Touche le micro, puis lis l’histoire à voix haute.'));
  }

  /* décor thématique de la piste (applyTheme v11) + obstacles + acteurs */
  function buildTrack(r) {
    const th = r.s.theme || {};
    const track = h('div', { class: 'cr-track', 'aria-hidden': 'true' });
    if (Array.isArray(th.sky) && Array.isArray(th.ground)) {
      track.style.background = 'linear-gradient(180deg, ' + th.sky[0] + ' 0%, ' + th.sky[1] +
        ' 46%, ' + th.ground[0] + ' 46%, ' + th.ground[1] + ' 100%)';
    }
    for (const d of Array.isArray(th.decos) ? th.decos : []) {
      const el = h('span', { class: 'cr-deco' + (d.drift ? ' drifting' : '') }, d.e);
      let css = 'font-size:' + d.s + 'rem;';
      if (d.top !== undefined) css += 'top:' + d.top + '%;';
      if (d.bot !== undefined) css += 'bottom:' + d.bot + '%;';
      if (!d.drift && d.x !== undefined) css += 'left:' + d.x + '%;';
      if (d.drift) css += 'animation-duration:' + d.drift + 's;';
      el.style.cssText += css;
      track.appendChild(el);
    }
    const n = r.st.target.length;
    for (const k of r.st.hurdles) {
      const hd = h('span', { class: 'cr-hurdle' }, th.obstacle || '🌿');
      hd.style.left = E.hurdleLeft(k, n) + '%';
      track.appendChild(hd);
      r.hurdleEls[k] = hd;
    }
    const fly = h('span', { class: 'cr-fly' }, '🦋');
    const spark = h('span', { class: 'cr-spark' }, '✨');
    const pony = h('span', { class: 'cr-pony', html: ctx.petSVG(r.size, '') });
    const finish = h('span', { class: 'cr-finish' }, '🏁');
    track.append(fly, spark, pony, finish);
    Object.assign(r.els, { fly, spark, pony, finish });
    return track;
  }

  /* jauge du téléchargement : pct 0-100, null = masquée */
  function showDl(r, pct) {
    const bar = r.els.dlBar;
    if (!bar) return;
    if (pct === null || r.st.running) { bar.hidden = true; return; }
    const v = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    bar.hidden = false;
    bar.setAttribute('aria-valuenow', String(v));
    r.els.dlFill.style.transform = 'scaleX(' + (v / 100).toFixed(3) + ')';
  }
  function setLabel(r, t) {
    const l = r.els.label;
    if (!l) return;
    l.textContent = t;
    l.classList.toggle('is-long', String(t).length > 44);
  }
  function moveActor(r, which, pct) {
    const el = r.els[which];
    if (!el) return;
    const left = E.actorLeft(pct) + '%';
    el.style.left = left;
    if (which === 'pony' && r.els.spark) r.els.spark.style.left = left;
  }
  function scrollToCurrent(r, smooth = true) {
    const el = r.wordEls[Math.min(r.st.progress, r.wordEls.length - 1)];
    const boxEl = r.els.text;
    if (!el || !boxEl) return;
    const top = el.offsetTop - boxEl.clientHeight / 2 + el.clientHeight / 2;
    try { boxEl.scrollTo({ top, behavior: smooth && !reduced() ? 'smooth' : 'auto' }); } catch (_) { boxEl.scrollTop = top; }
  }
  function renderText(r) {
    const st = r.st;
    for (let i = 0; i < st.target.length; i++) {
      let cls = 'cr-word ' + st.status[i];
      if (i === st.progress && st.running) cls += ' current';
      if (st.pauseResults[i] === 'ok') cls += ' pause-ok';
      else if (st.pauseResults[i] === 'fast') cls += ' pause-fast';
      const w = r.wordEls[i];
      if (w.className !== cls) w.className = cls;
    }
  }
  /* v2.1 : le compagnon TROTTE quand il avance (classe walk du rig : pattes, tête, queue) au lieu de glisser ;
     il s'arrête si l'enfant marque une pause (900 ms sans nouveau mot) ; à l'arrivée, son SVG est remplacé (joie) */
  function trot(r) {
    const s = r.els.pony && r.els.pony.querySelector('svg');
    if (!s) return;
    s.classList.add('walk');
    r.trot = drop(r.trot);
    r.trot = later(() => {
      r.trot = 0;
      const s2 = r.els.pony && r.els.pony.querySelector('svg');
      if (s2) s2.classList.remove('walk');
    }, 900);
  }
  /* animation du compagnon : on retire, on force un reflow, on remet (v11) ; v2.1 : la classe reste un repère, c'est le
     CORPS du rig (.c-all) qui bondit ou trébuche (mêmes hauteurs et durées que la v11, converties en unités du viewBox :
     100 unités = largeur du compagnon), en composition « add » sur le trot ; son ombre reste au sol (elle rétrécit
     pendant un bond) et la vague du dauphin dans l'eau */
  function ponyAnim(r, cls) {
    const pony = r.els.pony;
    if (!pony) return;
    pony.classList.remove('hop', 'hop-big', 'stumble');
    void pony.offsetWidth;
    pony.classList.add(cls);
    if (reduced()) return;
    const s = pony.querySelector('svg.c-rig'), body = s && s.querySelector('.c-all'), fx = PONY_FX[cls];
    if (!body || !fx) return;
    for (const a of r.ponyFx || []) { try { a.cancel(); } catch (_) {} }
    const u = 100 / (r.size || 100);
    const ease = k => k.map(f => Object.assign({ easing: 'ease' }, f));
    r.ponyFx = [];
    try { r.ponyFx.push(body.animate(ease(fx.body(u)), { duration: fx.ms, composite: 'add' })); } catch (_) {}
    const sh = fx.lift && s.getAttribute('data-species') !== 'dolphin' ? s.querySelector('.c-shadow') : null;
    if (sh) {
      try {
        r.ponyFx.push(sh.animate(ease([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.7)', opacity: 0.6, offset: fx.lift },
          { transform: 'scale(1)', opacity: 1 }]), { duration: fx.ms }));
      } catch (_) {}
    }
  }

  /* ---------- démarrage de la lecture (micTap v11) ---------- */
  async function micTap(r) {
    if (!alive || race !== r || r.done || r.st.running || r.starting) return;
    r.starting = true;
    r.micErr = '';
    safe(() => ctx.voice.hush());                     /* le micro n'entend que l'enfant : le compagnon se tait */
    safe(() => ctx.voice.say(''));                    /* la course elle-même ne parle pas : 🔊 caché pendant la lecture */
    ctx.audio.beep(660, 0.06);
    setLabel(r, TXT.prep);
    r.els.mic.setAttribute('aria-busy', 'true');
    let res = null;
    try {
      res = await ctx.speech.startListening({
        grammar: E.grammarOf(r.st.target),
        onText: t => ingest(r, t),
        onError: (code, msg) => {
          if (!alive || race !== r) return;
          r.micErr = String(code || '');
          /* micro impossible : écran « micro » (au démarrage, une fois startListening revenu) */
          if (isHard(r.micErr, r)) {
            if (r.st.running) { stopAll(r); showMicProblem(r, r.micErr); }
            return;
          }
          const t = msg ? frTypo(msg) : TXT.fail;
          if (r.els.label.textContent !== t) { setLabel(r, t); ctx.announce(t); }
        }
      });
    } catch (e) { console.error('course : micro', e); }
    r.starting = false;
    if (!alive || race !== r) return;
    r.els.mic.removeAttribute('aria-busy');
    if (!res || !res.engine) {
      if (r.micErr && isHard(r.micErr, r)) { showMicProblem(r, r.micErr); return; }
      const t = r.els.label.textContent;
      if (t === TXT.prep || t === TXT.idle || isDlText(t)) { setLabel(r, TXT.fail); ctx.announce(TXT.fail); safe(() => ctx.voice.say(TXT.fail)); }
      return;
    }
    showDl(r, null);
    r.st.running = true;
    setLabel(r, TXT.on);
    ctx.announce(TXT.on);
    r.view.classList.add('is-on');
    r.els.mic.classList.add('listening');
    r.els.mic.setAttribute('aria-pressed', 'true');
    r.els.mic.setAttribute('aria-label', 'Micro : lecture en cours');
    r.els.done.hidden = false;
    if (r.els.change) { r.els.change.remove(); r.els.change = null; }
    r.els.heard.hidden = false;
    lockWake(r);
    r.timers.noResult = setTimeout(() => {
      r.timers.noResult = 0;
      if (alive && race === r && r.st.running && !r.st.gotAnyResult) { setLabel(r, TXT.deaf); ctx.announce(TXT.deaf); }
    }, 7000);
    r.timers.race = setInterval(() => tickZip(r), 250);
    renderText(r);
    ctx.motion.enter(r.els.done, { from: 'scale', dur: 300 });
  }

  /* ======================= MICRO IMPOSSIBLE (D1-01, D4-04) =======================
     Refusé, absent, hors ligne au 1er lancement, navigateur sans reconnaissance : rien que l'enfant puisse réparer.
     UN écran simple : le compagnon, une phrase (dite aux petits lecteurs), « Changer de jeu ➜ » (balade : l'étape prend
     un autre jeu ; libre : choix d'un autre jeu), « Aide pour l'adulte » (marche à suivre, vouvoiement, puis
     « Réessayer 🎤 »). */
  async function precheckMic() {
    try { if (ctx.speech && typeof ctx.speech.speechSupported === 'function' && !ctx.speech.speechSupported()) return 'unsupported'; } catch (_) {}
    try {
      const pm = globalThis.navigator && globalThis.navigator.permissions;
      if (!pm || typeof pm.query !== 'function') return '';
      const st = await pm.query({ name: 'microphone' });
      return st && st.state === 'denied' ? 'not-allowed' : '';
    } catch (_) { return ''; }
  }
  function showMicProblem(r, code) {
    if (!alive || !r) return;
    const s = r.s, item = r.item;
    if (race === r) endRace();
    const v = setView('nomic');
    const t = ctx.mic.trouble(code);
    ctx.setTitle(fill(s.title));
    ctx.onJoker(() => { ctx.kit.toast(t.sub); return false; });
    const pet = h('div', { class: 'cr-mic-pet', 'aria-hidden': 'true', html: ctx.petSVG(wide() ? 132 : 112, 'sad') });
    const go = h('button', { type: 'button', class: 'btn play block cr-mic-go' },
      h('span', null, 'Changer de jeu'), h('span', { class: 'btn-play-ico', 'aria-hidden': 'true' }, '➜'));
    go.addEventListener('click', () => { ctx.audio.tap(); ctx.changeGame(); });
    const adult = h('button', { type: 'button', class: 'btn white block cr-mic-adult' }, ico('🧑'), ' Aide pour l’adulte');
    adult.addEventListener('click', () => {
      ctx.audio.tap();
      closeSheet();
      const api = ctx.mic.help(code, {
        onRetry: () => { if (!alive) return; openStory(s, item); if (race) micTap(race); },
        onClose: () => { if (sheet === api) sheet = null; }
      });
      sheet = api;
    });
    const card = h('div', { class: 'cr-mic-card', role: 'group', 'aria-labelledby': 'cr-mic-title' },
      pet,
      h('h2', { class: 'cr-mic-title', id: 'cr-mic-title' }, t.title),
      h('p', { class: 'cr-mic-sub' }, t.sub),
      h('div', { class: 'cr-mic-btns' }, go, adult));
    v.appendChild(card);
    ctx.motion.enter(card, { from: 'scale', dur: 320 });
    ctx.audio.soft();
    /* dit et annoncé sans l'emoji du titre, avec un vrai point entre les deux phrases */
    const spoken = t.title.replace(/[\s\u202f]*[\p{Extended_Pictographic}\uFE0F]+$/u, '') + '. ' + t.sub;
    ctx.announce(spoken);
    micSaid = true;
    safe(() => ctx.voice.say(spoken));
    safe(() => go.focus({ preventScroll: true }));
    /* l'adulte autorise le micro dans les réglages : au retour, l'histoire revient toute seule, prête à lire */
    if (code === 'not-allowed') {
      try {
        const pm = globalThis.navigator && globalThis.navigator.permissions;
        if (pm && typeof pm.query === 'function') {
          pm.query({ name: 'microphone' }).then(perm => {
            if (!alive || !perm || box.dataset.view !== 'nomic' || typeof perm.addEventListener !== 'function') return;
            const back = () => { if (perm.state !== 'denied' && alive && box.dataset.view === 'nomic') openStory(s, item); };
            perm.addEventListener('change', back);
            cleanups.add(() => { try { perm.removeEventListener('change', back); } catch (_) {} });
          }, () => {});
        }
      } catch (_) {}
    }
  }

  /* ---------- ce que le moteur entend (ingest v11) ---------- */
  function ingest(r, allText) {
    if (!alive || race !== r || !r.st.running || closedUnderUs(r)) return;
    /* v2 : seul un texte non vide compte comme « entendu » (Vosk envoie des résultats partiels vides sur
       le silence : en v11, « Je ne t’entends pas » ne s'affichait donc jamais avec Vosk) */
    if (String(allText ?? '').trim()) {
      r.st.gotAnyResult = true;
      if (r.timers.noResult) { clearTimeout(r.timers.noResult); r.timers.noResult = 0; }
      if (r.els.label.textContent === TXT.deaf) setLabel(r, TXT.on);
    }
    const tail = E.heardTail(allText);
    r.els.heard.textContent = tail ? '👂 ' + tail : '';
    applyFx(r, E.processTranscript(r.st, String(allText ?? ''), Date.now()));
  }
  /* effets du moteur, dans l'ordre de la v11 */
  function applyFx(r, fx) {
    for (const f of fx) {
      switch (f.t) {
        case 'streak':
          r.els.streak.textContent = '⚡ ' + f.n;
          r.els.streak.setAttribute('aria-label', 'Combo : ' + f.n);
          r.els.spark.style.display = f.n >= 5 ? 'block' : 'none';
          break;
        case 'move': moveActor(r, 'pony', f.pct); trot(r); break;
        case 'pony': ponyAnim(r, f.cls); break;
        case 'beep': ctx.audio.beep(f.f, f.d, f.g); break;
        case 'scroll': scrollToCurrent(r); break;
        case 'hurdle': {
          const hd = r.hurdleEls[f.k];
          if (hd) { if (f.cls === 'jumped') hd.textContent = '✨'; hd.classList.add(f.cls); }
          break;
        }
        case 'vibrate': buzz(f.ms); break;
        case 'render': renderText(r); break;
        case 'finish':
          if (!r.timers.finish) r.timers.finish = later(() => finishRace(r), 500);
          break;
        default: break;
      }
    }
  }
  /* manche close sans arrivée (← / retour Android : ctx.quit) → micro coupé même si la coquille tarde à démonter */
  function closedUnderUs(r) {
    if (r.done || !ctx.ended) return false;
    stopAll(r);
    r.done = true;                                     /* plus de relance du micro sur une manche close */
    r.els.done.hidden = true;
    return true;
  }
  /* Zip le papillon + chronomètre (toutes les 250 ms, v11) */
  function tickZip(r) {
    if (!alive || race !== r || closedUnderUs(r)) return;
    const z = E.zipTick(r.st, Date.now(), r.zip);
    if (!z) return;
    r.els.timer.textContent = '⏱ ' + z.secs + NNBSP + 's';
    moveActor(r, 'fly', z.flyPct);
  }

  /* ---------- arrêt du micro (stopAll v11) ---------- */
  function stopAll(r) {
    if (!r) return;
    r.st.running = false;
    r.starting = false;
    safe(() => ctx.speech.stopListening());
    if (r.timers.race) { clearInterval(r.timers.race); r.timers.race = 0; }
    if (r.timers.noResult) { clearTimeout(r.timers.noResult); r.timers.noResult = 0; }
    releaseWake(r);
    if (r.view) r.view.classList.remove('is-on');
    if (r.els.mic) {
      r.els.mic.classList.remove('listening');
      r.els.mic.setAttribute('aria-pressed', 'false');
      r.els.mic.removeAttribute('aria-busy');
    }
  }
  /* on quitte cette course (autre histoire, carte, démontage) */
  function endRace() {
    const r = race;
    if (!r) return;
    stopAll(r);
    r.timers.finish = drop(r.timers.finish);
    r.timers.quiz = drop(r.timers.quiz);
    race = null;
  }
  function lockWake(r) {
    try {
      const wl = globalThis.navigator && navigator.wakeLock;
      if (!wl || typeof wl.request !== 'function') return;
      wl.request('screen').then(w => {
        if (!alive || race !== r || !r.st.running) { Promise.resolve(w.release()).catch(() => {}); return; }
        r.wake = w;
      }).catch(() => {});
    } catch (_) {}
  }
  function releaseWake(r) {
    if (!r || !r.wake) return;
    const w = r.wake;
    r.wake = null;
    try { Promise.resolve(w.release()).catch(() => {}); } catch (_) {}
  }

  /* ---------- arrivée (finishExercise v11) : rapport de course, puis la petite question ---------- */
  function finishRace(r) {
    if (!alive || race !== r || !r.st.running) return;
    stopAll(r);
    r.done = true;
    r.timers.finish = drop(r.timers.finish);
    const res = r.res = E.raceResult(r.st, Date.now());
    const p = prof();
    const before = STORIES.map(s => isUnlocked(s, p));
    r.raceFb = safe(() => ctx.report(r.item, {
      kind: 'race', storyId: r.s.id, mclm: res.mclm, precision: res.precision, stars: res.stars, beatZip: res.beatFly,
      ms: res.elapsedMs, missed: res.missedNorm, read: res.readNorm, textA: r.s.lvl, zip: r.zip
    })) || {};
    const p2 = prof();
    r.newly = STORIES.filter((s, i) => !before[i] && isUnlocked(s, p2));

    renderText(r);
    r.els.done.hidden = true;
    setLabel(r, frTypo('🏁 Arrivée !'));
    r.els.heard.textContent = '';
    r.trot = drop(r.trot);
    r.els.pony.innerHTML = ctx.petSVG(r.size, 'joy');
    const ribbon = h('div', { class: 'cr-arrival' }, h('span', null, frTypo('Arrivée !')));
    r.els.track.appendChild(ribbon);
    r.view.classList.add('is-done');
    ctx.audio.success(4);
    ctx.announce(frTypo('Arrivée ! Petite question.'));
    r.timers.quiz = later(() => showQuiz(r), reduced() ? 600 : 1400);
  }

  /* ======================= LA PETITE QUESTION (fr.comp_ecrit) ======================= */
  function showQuiz(r) {
    if (!alive || race !== r) return;
    r.timers.quiz = 0;
    const q = r.s.q;
    const ok = q && Array.isArray(q.choices) && q.choices.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length;
    if (!ok) { showResults(r); return; }
    const v = setView('quiz');
    const item = { axis: 'fr.comp_ecrit', kind: 'question', key: 'fr.comp_ecrit:' + r.s.id, A: r.s.lvl, leitner: false,
      prompt: fill(q.q), answer: q.answer };
    const Q = r.quiz = { item, tries: 0, hinted: false, hintShown: false, reported: false, fb: null, t0: nowMs() };
    const range = E.citeRange(r.text, fill(q.cite));
    let order = q.choices.map((_, i) => i);
    try { if (ctx.rng && typeof ctx.rng.shuffle === 'function') order = ctx.rng.shuffle(order); } catch (_) {}
    const labels = order.map(i => fill(q.choices[i]));
    const cols = labels.some(l => l.length > 22) ? 1 : 2;

    const card = h('div', { class: 'cr-q-card' },
      h('div', { class: 'cr-q-head' }, h('span', { class: 'cr-q-kicker' }, 'Petite question 🔎')),
      h('p', { class: 'cr-q-text read', id: 'cr-q-text' }, fill(q.q)));
    /* le compagnon réfléchit avec l'enfant (masqué dès qu'une aide occupe la place) */
    const buddy = h('div', { class: 'cr-q-buddy', 'aria-hidden': 'true' },
      h('div', { class: 'cr-q-buddy-in' },
        h('span', { class: 'cr-q-think' }, '💭'),
        h('span', { class: 'cr-q-pet', html: ctx.petSVG(wide() ? 130 : 112, '') })));
    const help = h('div', { class: 'cr-help' });
    const grid = ctx.kit.choiceGrid(order.map((i, k) => ({ label: labels[k], value: i })), {
      read: true, cols, onPick: (val, btn) => pick(val, btn)
    });
    grid.el.setAttribute('aria-labelledby', 'cr-q-text');
    grid.el.classList.add('cr-q-choices');
    const prompt = h('p', { class: 'cr-q-prompt', 'aria-hidden': 'true' }, 'Choisis la bonne réponse 👇');
    v.append(card, buddy, help, prompt, grid.el);        /* indice sous la question, choix en bas (pouce) */

    ctx.onJoker(() => {
      if (Q.reported || !alive || race !== r) return false;
      if (Q.hintShown) { openPassage(r); return false; }   /* indice déjà donné : le texte entier, sans débiter */
      Q.hinted = true;
      showHint();
      return true;
    });

    ctx.motion.enter(card, { from: 'scale', dur: 360 });
    ctx.motion.stagger(grid.buttons, el => ctx.motion.enter(el, { from: 'bottom', dist: 12, dur: 340 }), 60);
    ctx.announce(frTypo('Petite question : ' + fill(q.q)));
    safe(() => ctx.voice.say(frTypo('Petite question : ' + fill(q.q))));        /* la question dite, pas les choix */

    function report(outcome) {
      if (Q.reported) return;
      Q.reported = true;
      Q.fb = safe(() => ctx.report(item, outcome));
    }
    function reveal(target) {
      v.classList.add('has-help');
      later(() => safe(() => (target || help).scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' })), 60);
    }
    /* l'extrait (phrase d'avant, passage surligné, phrase d'après) + accès au texte entier */
    function excerpt() {
      return range ? h('div', { class: 'cr-excerpt' }, passageNode(r, contextOf(r, range), range)) : null;
    }
    function textBtn() {
      return h('button', { type: 'button', class: 'btn white cr-alltext', on: { click: () => openPassage(r) } },
        h('span', { 'aria-hidden': 'true' }, '📖'), 'Tout le texte');
    }
    function showHint() {
      if (Q.hintShown) { const ex = help.querySelector('.cr-excerpt'); if (ex) ctx.motion.pop(ex, { scale: 1.03 }); reveal(); return; }
      Q.hintShown = true;
      clear(help);
      const msg = frTypo('Relis le passage, la réponse s’y cache !');
      help.append(ctx.kit.bubble(msg, 'hint', { icon: '🔎' }), excerpt(), h('div', { class: 'cr-help-row' }, textBtn()));
      ctx.announce(msg);
      safe(() => ctx.voice.say(msg));
      reveal();
    }
    function pick(val, btn) {
      if (Q.reported || !alive || race !== r) return;
      const ms = Math.round(nowMs() - Q.t0);
      if (val === q.answer) {
        grid.mark(val, 'right');
        grid.disable();
        const helped = Q.tries > 0 || Q.hinted;
        report({ correct: true, hinted: helped, ms, tries: Q.tries + 1 });
        safe(() => ctx.voice.hush());
        ctx.kit.celebrateRight(btn, helped ? 0 : 2);
        if (ctx.applesEl) ctx.motion.flyTo(btn, ctx.applesEl, { emoji: '🍎', count: 1, onArrive: () => ctx.audio.coin() });
        const msg = ctx.kit.cheer(helped ? 'helped' : 'right', ctx.rng);
        clear(help);
        help.append(ctx.kit.bubble(msg, 'good', { icon: '🌟' }));
        ctx.announce(msg);
        reveal();
        later(() => showResults(r), reduced() ? 1000 : 1700);
      } else if (Q.tries === 0) {
        Q.tries = 1;
        Q.hinted = true;
        grid.mark(val, 'wrong');
        ctx.kit.gentleWrong(btn);
        showHint();
      } else {
        Q.tries = 2;
        grid.mark(val, 'wrong');
        ctx.kit.gentleWrong(btn);
        grid.reveal(q.answer);
        grid.dimOthers(q.answer);
        grid.disable();
        report({ correct: false, hinted: true, ms, tries: 2 });
        const learn = ctx.kit.cheer('learn', ctx.rng);
        const msg = learn + ' ' + frTypo('Voici la bonne réponse ✓ Elle se cachait dans le passage surligné.');
        clear(help);
        help.append(ctx.kit.bubble(msg, 'soft', { icon: '📖' }), excerpt(),
          h('div', { class: 'cr-help-row' }, textBtn(),
            h('button', { type: 'button', class: 'btn cr-understood', on: { click: () => { ctx.audio.tap(); showResults(r); } } }, 'J’ai compris ✓')));
        ctx.announce(msg);
        safe(() => ctx.voice.say(msg));
        reveal(grid.button(q.answer));
      }
    }
  }

  /* extrait autour d'un passage : sa (ses) phrase(s), plus la phrase d'avant et celle d'après tant que
     l'ensemble reste court (≤ 34 mots) → [premier, dernier] mot */
  function contextOf(r, range) {
    const T = r.st.target, n = T.length, MAX = 34;
    const ends = i => SENTENCE_END.test(T[i].raw);
    let s = range[0];
    while (s > 0 && !ends(s - 1)) s--;
    let e = range[1];
    while (e < n - 1 && !ends(e)) e++;
    if (e - s + 1 < 24) {
      if (s > 0) { let ps = s - 1; while (ps > 0 && !ends(ps - 1)) ps--; if (e - ps + 1 <= MAX) s = ps; }
      if (e < n - 1) { let ne = e + 1; while (ne < n - 1 && !ends(ne)) ne++; if (ne - s + 1 <= MAX) e = ne; }
    }
    return [s, e];
  }
  /* paragraphe des mots [from, to] du texte, passage [a, b] surligné (<mark>) */
  function passageNode(r, [from, to], range) {
    const T = r.st.target;
    const para = h('p', { class: 'cr-passage read' });
    let mark = null;
    if (from > 0) para.append('…' + NBSP);
    for (let i = from; i <= to; i++) {
      const inside = range && i >= range[0] && i <= range[1];
      if (inside && i === range[0]) { mark = h('mark', { class: 'cr-cite' }); para.append(mark); }
      (inside ? mark : para).append(T[i].raw);
      if (i < to) (inside && i < range[1] ? mark : para).append(' ');
    }
    if (to < T.length - 1) para.append(NBSP + '…');
    return para;
  }

  /* le texte entier de l'histoire, passage de la question surligné */
  function openPassage(r) {
    closeSheet();
    const q = r.s.q || {};
    const range = E.citeRange(r.text, fill(q.cite));
    const para = passageNode(r, [0, r.st.target.length - 1], range);
    const mark = para.querySelector('mark');
    ctx.audio.tap();
    const api = ctx.kit.sheet({
      title: '📖 Le passage', content: para,
      actions: [{ label: 'J’ai relu ✓' }],
      onClose: () => { if (sheet === api) sheet = null; }
    });
    sheet = api;
    if (mark) later(() => safe(() => mark.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' })), 300);
  }

  /* ======================= RÉSULTATS (écran v11) ======================= */
  async function showResults(r) {
    if (!alive || race !== r || r.resultsShown) return;
    r.resultsShown = true;
    closeSheet();
    const balade = ctx.mode === 'balade';
    /* balade : un bloc de lecture prioritaire compte 2 ou 3 histoires → la manche n'est close qu'après la dernière */
    const more = balade && !!ctx.manche && ctx.manche.state.index < ctx.count;
    let summary = null;
    if (!more) {
      try {
        summary = await ctx.end({ stay: true });
        /* une coquille qui ne renverrait pas le bilan : un second appel rend celui de la manche close */
        if (!summary || typeof summary !== 'object') summary = await ctx.end({ stay: true });
      } catch (e) { console.error('course : fin de manche', e); }
    }
    if (balade && ctx.count > 1 && ctx.manche) {
      const done = Math.min(ctx.manche.state.index, ctx.count);
      safe(() => ctx.progress(done, ctx.count, Array(done).fill('done')));
    }
    if (!alive || race !== r) return;
    summary = summary && typeof summary === 'object' ? summary : {};
    const res = r.res;
    const v = setView('res');
    const m = r.m;
    const fem = m.M.g === 'f';
    const stars = res.stars;
    ctx.onJoker(() => { ctx.kit.toast(frTypo('Tu as fini cette course, bravo ! 🎉')); return false; });

    const starsEl = h('div', { class: 'cr-res-stars', role: 'img', 'aria-label': stars + (stars > 1 ? ' étoiles' : ' étoile') + ' sur 3' },
      [0, 1, 2].map(i => h('span', { class: i < stars ? 'on' : 'off', 'aria-hidden': 'true' }, '⭐')));
    const msgTxt = stars === 3 ? frTypo('🎉 Course parfaite ! ' + m.name + ' est super ' + (fem ? 'fière' : 'fier') + ' de toi !')
      : stars === 2 ? frTypo('💪 Très belle lecture ! Bats Zip pour la 3e étoile.')
        : frTypo('🌱 Bon début ! Relis cette histoire pour rattraper Zip.');
    const msg = stars === 2
      ? [frTypo('💪 Très belle lecture ! Bats Zip pour la 3'), h('sup', null, 'e'), ' étoile.']
      : msgTxt;
    const raceTxt = res.beatFly
      ? frTypo('🏁 ' + m.name + ' est arrivé' + (fem ? 'e' : '') + ' avant Zip le papillon !')
      : balade ? frTypo('🦋 Zip est arrivé le premier cette fois… la prochaine fois, ce sera toi !')
        : frTypo('🦋 Zip est arrivé le premier cette fois… revanche ?');
    const raceApples = Number.isFinite(r.raceFb && r.raceFb.apples) ? r.raceFb.apples : stars * 10;
    const qApples = r.quiz && r.quiz.fb && Number.isFinite(r.quiz.fb.apples) ? r.quiz.fb.apples : 0;
    const gain = raceApples + qApples;
    let applesTxt = '🍎 +' + gain + (gain > 1 ? ' pommes' : ' pomme');
    /* série : même formule que le bilan des autres jeux (« 1 j » était opaque : D1-25, D4-09) */
    const bonus = Math.max(0, Math.trunc(Number(summary.streakBonus)) || 0);
    if (bonus) {
      const c = Number.isFinite(summary.streakCount) ? summary.streakCount : 0;
      applesTxt += ' · ' + (c > 1 ? '🔥 ' + c + ' jours de suite : +' : '🔥 Premier jour de ta série : +') + bonus + NBSP + '🍎';
    }
    const dayBonus = Math.max(0, Math.trunc(Number(summary.dayBonus)) || 0);
    const dayTxt = summary.dayDone ? frTypo('🗺️ Ta balade du jour est finie !' + (dayBonus ? ' +' + dayBonus + ' 🍎' : '')) : '';
    const mclmV = h('div', { class: 'cr-stat-v' }, '0');
    const stat = (val, lbl) => h('div', { class: 'cr-stat' }, val, h('div', { class: 'cr-stat-l' }, lbl));
    /* ce qui a été réussi, jamais une note (ni pourcentage ni « 4 / 6 ») : CDC §16, D4-09 */
    const stats = h('div', { class: 'cr-stats' },
      stat(mclmV, 'mots / minute'),
      res.correct > 0 ? stat(h('div', { class: 'cr-stat-v' }, String(res.correct)), res.correct > 1 ? 'mots bien lus' : 'mot bien lu') : null,
      res.okp > 0 ? stat(h('div', { class: 'cr-stat-v' }, ico('⏸'), String(res.okp)), res.okp > 1 ? 'pauses bien placées' : 'pause bien placée') : null);
    const pauses = res.pausesMsg === 'expressive' ? frTypo('🎭 Lecture expressive, bravo !')
      : res.pausesMsg === 'astuce' ? frTypo('Astuce : respire aux virgules et aux points pour sauter les obstacles 😊') : '';
    const newly = r.newly || [];
    const unlock = newly.length
      ? frTypo('🔓 ' + (newly.length > 1 ? 'Nouvelles histoires débloquées : ' : 'Nouvelle histoire débloquée : ')) +
        newly.map(s => s.emoji + ' ' + fill(s.title)).join(' · ')
      : '';
    const clean = w => String(w).replace(/^[^\p{L}0-9]+|[^\p{L}0-9]+$/gu, '') || String(w);
    const missed = res.missed.length
      ? [frTypo('Mots à apprivoiser : '), h('b', null, res.missed.slice(0, 6).map(clean).join(' · '))]
      : frTypo('💯 Tu as lu tous les mots !');

    const boxEl = h('div', { class: 'cr-res-box', tabindex: '-1', role: 'group', 'aria-label': 'Résultats de la course' },
      h('div', { class: 'cr-res-mount', 'aria-hidden': 'true', html: ctx.petSVG(wide() ? 120 : 84, 'joy') }),
      starsEl,
      h('p', { class: 'cr-res-msg' }, msg),
      h('p', { class: 'cr-res-race' }, raceTxt),
      h('p', { class: 'cr-res-apples' }, frTypo(applesTxt)),
      dayTxt ? h('p', { class: 'cr-res-day' }, dayTxt) : null,
      stats,
      pauses ? h('p', { class: 'cr-res-pauses' }, pauses) : null,
      unlock ? h('p', { class: 'cr-res-unlock' }, unlock) : null,
      h('p', { class: 'cr-res-missed read' }, missed));

    let actions;
    if (balade && more) {
      actions = [h('button', { type: 'button', class: 'btn big wide', on: { click: () => { ctx.audio.tap(); nextBaladeStory(); } } },
        frTypo('Histoire suivante ➜'))];
    } else if (balade) {
      /* comme le bilan des autres jeux : « Étape suivante ▶ » lance l'étape suivante ; balade finie → « Accueil 🏠 » */
      const q = prof();
      const plan = q && q.today && Array.isArray(q.today.blocks) ? q.today : null;
      const goOn = !summary.dayDone && !!plan && !plan.done && plan.blocks.some(b => b && !b.done);
      actions = [h('button', { type: 'button', class: 'btn play wide cr-next', on: { click: () => { ctx.audio.tap(); ctx.nextStep(); } } },
        h('span', null, goOn ? 'Étape suivante' : 'Accueil'), h('span', { class: 'btn-play-ico', 'aria-hidden': 'true' }, goOn ? '▶' : '🏠'))];
    } else {
      const next = nextUnlocked(r.s);
      actions = [
        h('button', { type: 'button', class: 'btn' + (next ? '' : ' wide'), on: { click: () => { ctx.audio.tap(); ctx.again(); openStory(r.s); } } }, '🔄 Revanche'),
        next ? h('button', { type: 'button', class: 'btn', on: { click: () => { ctx.audio.tap(); ctx.again(); openStory(next); } } }, '➡️ Suite') : null,
        h('button', { type: 'button', class: 'btn pink wide', on: { click: () => { ctx.audio.tap(); ctx.again(); showList(r.s.id); } } }, '📚 Histoires')
      ];
    }
    v.append(boxEl, h('div', { class: 'cr-actions' }, actions));

    /* chorégraphie : la boîte monte, les étoiles tombent une à une, le compteur défile ; fanfare v11 */
    ctx.motion.enter(boxEl, { from: 'bottom', dist: 16, dur: 420 });
    ctx.motion.stagger([...starsEl.children], el => ctx.motion.enter(el, { from: 'scale', dur: 460 }), 170);
    later(() => ctx.motion.countUp(mclmV, 0, res.mclm, 700), 260);
    if (stars === 3 || newly.length || summary.dayDone) { ctx.audio.fanfare(); ctx.motion.confetti(); }
    else ctx.audio.beep(784, 0.2, 0.12);
    ctx.announce(stars + (stars > 1 ? ' étoiles' : ' étoile') + ' sur 3. ' + msgTxt);
    safe(() => ctx.voice.say(msgTxt));
    safe(() => boxEl.focus({ preventScroll: true }));
  }

  /* balade : histoire suivante du bloc (choisie par le moteur parmi les histoires débloquées) */
  function nextBaladeStory() {
    let item = null;
    try { item = ctx.nextItem('fr.fluence', { profile: prof() }); } catch (e) { console.error('course : histoire du jour', e); }
    const s = item && storyById(item.storyId || (item.data && item.data.storyId));
    if (s) { openStory(s, item); return true; }
    return false;
  }

  function nextUnlocked(s) {
    const p = prof();
    const i = storyIndex(s.id);
    for (let k = i + 1; k < STORIES.length; k++) if (isUnlocked(STORIES[k], p)) return STORIES[k];
    return null;
  }

  /* ======================= cycle de vie ======================= */
  return {
    start() {
      safe(() => ctx.progress(0, ctx.mode === 'balade' && ctx.count > 1 ? ctx.count : 0));
      if (ctx.mode === 'balade' && nextBaladeStory()) return;
      showList();
    },
    destroy() {
      if (!alive) return;
      endRace();
      alive = false;
      closeSheet();
      for (const fn of cleanups) safe(fn);
      cleanups.clear();
      for (const id of timers) clearTimeout(id);
      timers.clear();
      safe(() => ctx.onJoker(null));
      box.remove();
    }
  };
}
