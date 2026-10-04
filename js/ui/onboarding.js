/* ============ ARRIVÉE : nouvel enfant (#/onboarding) et bienvenue après migration (#/welcome) ============
   Mode 'new' (assistant en 5 étapes animées) :
     1. prénom + fille / garçon → 2. « Choisis ton univers » : thème visuel présélectionné selon le genre
     (defaultThemeFor : fille → Caramel, garçon → Dinosaures ; l'enfant peut en choisir n'importe quel
     autre), aperçu instantané de tout l'écran (previewTheme, jusqu'à la création du profil)
     → 3. classe (5 gros boutons : c'est SA classe, elle peut s'afficher ici)
     → 4. nom du compagnon (poney « Caramel » par défaut, aperçu) → profil créé (defaultProfile +
     settings.theme + store.addProfile, mémorisé pour la session) → 5. « Tu as ta fiche d'évaluation
     nationale ? » (un adulte la photographie → #/import?from=onboarding ; plus tard → #/home).
   Mode 'welcome' (params.mode === 'welcome' : profil migré de la v11, sans classe) :
     confettis + fanfare, « Bienvenue dans Caramel 2 ! », « Tes X 🍎 et Y ⭐ sont bien là. »
     (message doux, sans chiffres, si la sauvegarde était illisible), prénom modifiable → univers (thème
     actuel présélectionné, enregistré au toucher) → classe (setClasse via mutateProfile)
     → proposition d'import de la fiche ou plus tard → #/home. */

import { h, clear, dayStr, frTypo, loadCSS, fmtNum } from '../core/util.js';
import * as store from '../core/store.js';
import * as router from '../router.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import { CLASSES } from '../core/axes.js';
import { defaultProfile, sanitizeName, setClasse, DEFAULT_MOUNT_NAME } from '../core/profiles.js';
import { defaultThemeFor, normalizeTheme } from '../core/themes.js';
import { totalStarsOf } from '../content/stories/index.js';
import { mountReady, avatarSVG, avatarOf, setAvatar, stageOf } from './companion.js';
import { themeGrid, previewTheme, endPreview, swapTheme, cheerTheme } from './theme-picker.js';

const PICKED_KEY = 'caramel-picked';
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) {} };
const depth = () => { try { return history.state && Number.isInteger(history.state.caramel) ? history.state.caramel : 0; } catch (_) { return 0; } };

let st = null;

export default {
  async mount(root, params) {
    const welcome = !!(params && params.mode === 'welcome');
    await Promise.all([loadCSS('css/ui/onboarding.css'), mountReady()]);
    if (!root.isConnected) return;
    if (welcome) {
      const p = store.getProfile();
      if (!p) { router.go(store.listProfiles().length ? 'profiles' : 'onboarding', { replace: true }); return; }
      if (p.classe) { router.go('home', { replace: true }); return; }
    }
    const my = st = { timers: new Set() };
    const later = (fn, ms) => { const t = setTimeout(() => { my.timers.delete(t); if (st === my) fn(); }, ms); my.timers.add(t); return t; };

    /* ----- squelette commun : retour, pastilles d'étapes, scène de l'étape ----- */
    const back = h('button', { type: 'button', class: 'back ob-back', 'aria-label': 'Étape précédente' }, '←');
    const dots = h('div', { class: 'ob-dots', 'aria-hidden': 'true' });
    const stepBox = h('div', { class: 'ob-step' });
    const screen = h('div', { class: 'screen ob' + (welcome ? ' is-welcome' : '') },
      h('div', { class: 'ob-top' }, back, dots, h('span', { class: 'ob-top-gap' })), stepBox);
    clear(root);
    root.appendChild(screen);

    const steps = welcome ? ['hello', 'theme', 'classe', 'fiche'] : ['name', 'theme', 'classe', 'buddy', 'fiche'];
    /* theme : univers choisi ; themePicked : touché par l'enfant (sinon il suit la présélection du genre) */
    const data = { name: '', g: null, classe: null, buddy: DEFAULT_MOUNT_NAME, createdId: null, theme: null, themePicked: false };
    if (welcome) {
      const p = store.getProfile();
      data.name = p.name || '';
      data.g = p.g;
      data.classe = null;
      data.theme = normalizeTheme(p.settings && p.settings.theme);
    }
    let cur = -1;

    back.addEventListener('click', () => {
      audio.tap();
      if (cur > 0) go(cur - 1, -1);
      else leaveNew();
    });

    function leaveNew() {
      if (depth() > 0) router.back();
      else router.go(store.listProfiles().length ? 'profiles' : 'onboarding', { replace: true });
    }

    function go(i, dir = 1) {
      cur = i;
      clear(dots);
      steps.forEach((_, k) => dots.appendChild(h('span', { class: 'ob-dot' + (k < i ? ' done' : k === i ? ' now' : '') })));
      /* pas de retour au tout début d'une première installation, ni sur l'écran de bienvenue */
      const noBack = welcome ? i === 0 : (i === 0 && !store.listProfiles().length);
      back.classList.toggle('is-off', noBack);
      back.tabIndex = noBack ? -1 : 0;
      if (noBack) back.setAttribute('aria-hidden', 'true'); else back.removeAttribute('aria-hidden');
      clear(stepBox);
      const el = STEP[steps[i]]();
      stepBox.appendChild(el);
      motion.enter(el, { from: dir < 0 ? 'left' : 'right', dur: 380 });
      const parts = el.querySelectorAll('.ob-anim');
      motion.stagger(parts, p => motion.enter(p, { from: 'bottom', dist: 10, dur: 380 }), 60);
      later(() => {
        const f = el.querySelector('[data-autofocus]') || el.querySelector('h1');
        try { if (f) f.focus({ preventScroll: true }); } catch (_) {}
      }, 60);
      try { window.scrollTo(0, 0); } catch (_) {}
    }

    /* ----- briques ----- */
    /* poney d'un enfant qui arrive, au stade d'un compagnon NEUF (0 min d'apprentissage : petit) : le même qu'à
       l'accueil juste après, pas le junior par défaut du dessin */
    const newPony = size => avatarSVG('pony', [], size, 'joy', { stage: stageOf({ companion: { minutes: 0 } }) });
    /* petite scène : le compagnon y porte sa propre ombre au sol (rig du compagnon) — pas d'ombre en plus */
    const stage = (html, cls = '') => {
      const pic = h('div', { class: 'ob-pic' });
      setAvatar(pic, html);
      return h('div', { class: 'ob-stage ob-anim ' + cls, 'aria-hidden': 'true' }, pic);
    };
    const title = text => h('h1', { class: 'title-xl ob-title ob-anim', tabindex: '-1' }, frTypo(text));
    const sub = text => h('p', { class: 'subtitle ob-sub ob-anim' }, frTypo(text));
    const nameInput = (value, label, id) => h('input', {
      class: 'input ob-input', type: 'text', id, maxlength: '14', value, autocomplete: 'off', autocapitalize: 'words',
      spellcheck: 'false', enterkeyhint: 'next', 'aria-label': label, 'data-autofocus': ''
    });
    const nextBtn = (label, onClick, extra = '') => {
      const b = h('button', { type: 'button', class: 'btn big block ob-next ob-anim ' + extra }, frTypo(label));
      b.addEventListener('click', onClick);
      return b;
    };
    const genderSeg = onPick => {
      const f = h('button', { type: 'button', class: 'ob-g', 'aria-pressed': String(data.g === 'f') }, h('span', { 'aria-hidden': 'true' }, '👧'), ' une fille');
      const m = h('button', { type: 'button', class: 'ob-g', 'aria-pressed': String(data.g === 'm') }, h('span', { 'aria-hidden': 'true' }, '👦'), ' un garçon');
      const sync = () => {
        f.classList.toggle('on', data.g === 'f'); f.setAttribute('aria-pressed', String(data.g === 'f'));
        m.classList.toggle('on', data.g === 'm'); m.setAttribute('aria-pressed', String(data.g === 'm'));
      };
      f.addEventListener('click', () => { data.g = 'f'; sync(); audio.beep(660, 0.05, 0.06); onPick(); });
      m.addEventListener('click', () => { data.g = 'm'; sync(); audio.beep(660, 0.05, 0.06); onPick(); });
      sync();
      return h('div', { class: 'ob-gs', role: 'group', 'aria-label': 'Tu es' }, f, m);
    };
    const classGrid = onPick => {
      const grid = h('div', { class: 'ob-classes ob-anim', role: 'group', 'aria-label': 'Ta classe' });
      for (const c of CLASSES) {
        const b = h('button', { type: 'button', class: 'ob-class' + (data.classe === c ? ' on' : ''), 'aria-pressed': String(data.classe === c) }, c);
        b.addEventListener('click', () => {
          for (const x of grid.children) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }
          data.classe = c;
          audio.success(CLASSES.indexOf(c));
          motion.pop(b, { scale: 1.12 });
          onPick(c);
        });
        grid.appendChild(b);
      }
      return grid;
    };
    const ficheStep = () => {
      const yes = h('button', { type: 'button', class: 'btn big block ob-anim' },
        h('span', { 'aria-hidden': 'true' }, '📷'), frTypo('Oui, je l’ai !'));
      const no = h('button', { type: 'button', class: 'btn white big block ob-anim' }, 'Plus tard');
      yes.addEventListener('click', () => { audio.tap(); router.go('import', { query: { from: 'onboarding' }, replace: true }); });
      no.addEventListener('click', () => { audio.tap(); audio.whoosh(); router.go('home', { replace: true }); });
      const q = store.getProfile();
      return h('div', { class: 'ob-card' },
        h('div', { class: 'ob-fiche ob-anim', 'aria-hidden': 'true' }, h('span', null, '📄'), h('span', { class: 'ob-fiche-star' }, '✨')),
        title('Tu as ta fiche d’évaluation nationale ?'),
        sub('Avec la fiche « Repères » de la rentrée, ' + ((q && q.companion && q.companion.name) || DEFAULT_MOUNT_NAME) + ' choisit les jeux qui t’aideront le plus.'),
        h('p', { class: 'ob-adult ob-anim' }, frTypo('Pour les parents : prenez la fiche en photo, elle reste sur l’appareil et n’est jamais envoyée.')),
        h('div', { class: 'ob-actions' }, yes, no));
    };

    /* ----- étapes ----- */
    const STEP = {
      /* nouvel enfant, 1 : prénom + fille / garçon */
      name() {
        const input = nameInput(data.name, 'Ton prénom', 'ob-name');
        const next = nextBtn('Suivant ➜', submit);
        const check = () => { const ok = !!input.value.trim() && !!data.g; next.disabled = !ok; next.setAttribute('aria-disabled', String(!ok)); };
        function submit() {
          const v = sanitizeName(input.value, '');
          if (!v) { motion.shake(input); input.focus(); return; }
          if (!data.g) { motion.shake(segBox); return; }
          data.name = v;
          audio.tap();
          go(cur + 1);
        }
        input.addEventListener('input', check);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (!next.disabled) submit(); } });
        const segBox = genderSeg(check);
        check();
        return h('div', { class: 'ob-card' },
          stage(newPony(132)),
          title('Bonjour ! Comment tu t’appelles ?'),
          h('div', { class: 'ob-field ob-anim' }, h('label', { class: 'ob-label', for: 'ob-name' }, 'Ton prénom'), input),
          h('div', { class: 'ob-field ob-anim' }, h('span', { class: 'ob-label' }, 'Tu es…'), segBox),
          next);
      },
      /* univers (les deux modes) : présélection, aperçu instantané au toucher */
      theme() {
        if (!welcome && !data.themePicked) data.theme = defaultThemeFor(data.g);
        if (!welcome) previewTheme(data.theme, { animate: false });    /* l'entrée de l'étape suffit comme mouvement */
        const grid = themeGrid({
          value: data.theme,
          label: 'Ton univers',
          onPick: (id, card) => {
            data.theme = id;
            data.themePicked = true;
            if (welcome) swapTheme(() => store.mutateProfile(p => { p.settings.theme = id; }));
            else previewTheme(id);
            cheerTheme(id, card);
          }
        });
        const next = nextBtn('C’est mon univers ! ➜', () => { audio.tap(); go(cur + 1); });
        return h('div', { class: 'ob-card ob-card--theme' },
          title('Choisis ton univers'),
          sub('Touche une carte pour l’essayer. Tu pourras en changer quand tu veux avec le bouton 🎨.'),
          h('div', { class: 'ob-themes ob-anim' }, grid.el),
          next);
      },
      /* classe (les deux modes) */
      classe() {
        const who = data.name ? ', ' + data.name : '';
        const grid = classGrid(c => {
          if (welcome) {
            store.mutateProfile(p => { setClasse(p, c, dayStr()); });
            ssSet(PICKED_KEY, store.getProfile() ? store.getProfile().id : '');
          }
          const at = cur;
          later(() => { if (cur === at) go(at + 1); }, 380);       /* deux touchers rapides : une seule étape */
        });
        return h('div', { class: 'ob-card' },
          h('div', { class: 'ob-school ob-anim', 'aria-hidden': 'true' }, '🎒'),
          title('Tu es en quelle classe' + who + ' ?'),
          sub('C’est ta classe à l’école, cette année.'),
          grid);
      },
      /* nouvel enfant, 4 : nom du compagnon → le profil est créé */
      buddy() {
        const input = nameInput(data.buddy, 'Nom de ton compagnon', 'ob-buddy');
        input.setAttribute('enterkeyhint', 'done');
        const next = nextBtn('C’est mon compagnon ! ➜', submit);
        const pic = stage(newPony(150), 'is-big');
        function submit() {
          data.buddy = sanitizeName(input.value, DEFAULT_MOUNT_NAME);
          createOrUpdate();
          audio.neigh();
          motion.confetti({ count: 16 });
          go(cur + 1);
        }
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
        pic.addEventListener('click', () => { audio.neigh(); const s = pic.querySelector('.ob-pic'); setAvatar(s, newPony(150)); });
        pic.removeAttribute('aria-hidden');
        pic.setAttribute('role', 'img');
        pic.setAttribute('aria-label', 'Ton poney');
        return h('div', { class: 'ob-card' },
          title('Voici ton compagnon !'),
          pic,
          sub('C’est un petit poney. Comment veux-tu l’appeler ?'),
          h('div', { class: 'ob-field ob-anim' }, h('label', { class: 'ob-label', for: 'ob-buddy' }, 'Son nom'), input),
          next);
      },
      fiche: ficheStep,
      /* bienvenue (profil migré), 1 : fête, trésor intact, prénom modifiable */
      hello() {
        const p = store.getProfile();
        const corrupt = /-corrompu$/.test(String(store.getData().migratedFrom || ''));
        const apples = (p.wallet && p.wallet.apples) | 0, stars = totalStarsOf(p);
        let msg;
        if (corrupt) msg = '{N} t’attendait avec impatience pour de nouvelles aventures !';
        else if (apples || stars) {
          msg = 'Tes ' + fmtNum(apples) + ' 🍎 et ' + fmtNum(stars) + ' ⭐ sont bien là.';
        } else msg = '{N} t’attendait avec impatience !';
        msg = msg.replace('{N}', (p.companion && p.companion.name) || DEFAULT_MOUNT_NAME);
        const input = nameInput(data.name, 'Ton prénom', 'ob-hello-name');
        const next = nextBtn('C’est bien moi ! ➜', submit);
        const check = () => { const ok = !!input.value.trim(); next.disabled = !ok; next.setAttribute('aria-disabled', String(!ok)); };
        function submit() {
          const v = sanitizeName(input.value, '');
          if (!v) { motion.shake(input); input.focus(); return; }
          data.name = v;
          store.mutateProfile(pp => { pp.name = v; });
          audio.tap();
          go(cur + 1);
        }
        input.addEventListener('input', check);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (!next.disabled) submit(); } });
        check();
        const pic = stage(avatarOf(p, 150, 'joy'), 'is-big');
        later(() => { motion.confetti(); audio.fanfare(); }, 350);
        return h('div', { class: 'ob-card' },
          pic,
          title('Bienvenue dans Caramel 2 !'),
          h('p', { class: 'ob-treasure ob-anim' }, frTypo(msg)),
          h('div', { class: 'ob-field ob-anim' }, h('label', { class: 'ob-label', for: 'ob-hello-name' }, 'Ton prénom'), input),
          next);
      }
    };

    /* profil du nouvel enfant : créé à la fin de l'étape 4 (compagnon), mis à jour si l'on revient en arrière */
    function createOrUpdate() {
      const today = dayStr();
      const theme = normalizeTheme(data.theme || defaultThemeFor(data.g));
      if (!data.createdId || !store.getProfile(data.createdId)) {
        const p = defaultProfile({ name: data.name, g: data.g || 'f', classe: data.classe, today });
        p.companion.name = data.buddy;
        p.settings.theme = theme;
        data.createdId = store.addProfile(p);        /* devient le profil actif (commit → réglages et thème appliqués) */
      } else {
        store.mutateProfile(pp => {
          pp.name = sanitizeName(data.name, pp.name);
          pp.g = data.g === 'm' ? 'm' : 'f';
          setClasse(pp, data.classe, today);
          pp.companion.name = data.buddy;
          pp.settings.theme = theme;
        }, data.createdId);
        store.setActive(data.createdId);
      }
      ssSet(PICKED_KEY, data.createdId);
    }

    go(0);
  },

  unmount() {
    endPreview();                     /* aperçu d'un thème non enregistré : retour au thème du profil actif */
    const my = st;
    st = null;
    if (!my) return;
    for (const t of my.timers) clearTimeout(t);
  }
};
