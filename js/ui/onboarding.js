/* ============ ARRIVÉE : nouvel enfant (#/onboarding) et bienvenue après migration (#/welcome) ============
   Mode 'new' (assistant en 5 étapes animées) :
     1. prénom + fille / garçon → 2. « Choisis ton univers » : thème visuel présélectionné selon le genre
     (defaultThemeFor : fille → Caramel, garçon → Dinosaures ; l'enfant peut en choisir n'importe quel
     autre), aperçu instantané de tout l'écran (previewTheme, jusqu'à la création du profil)
     → 3. classe (5 gros boutons : c'est SA classe, elle peut s'afficher ici)
     → 4. nom du compagnon (poney « Caramel » par défaut, aperçu) → profil créé (defaultProfile +
     settings.theme + store.addProfile, mémorisé pour la session ; le compagnon fête son nom sur place, puis l'étape
     suivante arrive) → 5. « Une question pour tes parents » : l'enfant montre l'écran à un adulte, qui peut prendre en
     photo la fiche des évaluations nationales (→ #/import?from=onboarding ; plus tard → #/home) ; petit lecteur
     (js/ui/voice.js) : « Une question pour tes parents. Montre cet écran à un adulte. » est dit à voix haute.
   « Suivant » n'est jamais désactivé : s'il manque le prénom ou fille / garçon, le toucher (ou la touche Entrée du
   clavier) secoue ce qui manque et une ligne d'aide dit quoi faire (lue par les lecteurs d'écran).
   Mode 'welcome' (params.mode === 'welcome' : profil migré de la v11, sans classe) :
     gerbe autour du compagnon + fanfare, « Bienvenue dans Caramel 2 ! », « Tes X 🍎 et Y ⭐ sont bien là. »
     (seulement ce qui existe ; message doux, sans chiffres, si la sauvegarde était illisible), prénom modifiable
     → univers (thème actuel présélectionné, enregistré au toucher) → classe (setClasse via mutateProfile)
     → question pour les parents (import de la fiche ou plus tard → #/home). */

import { h, clear, dayStr, frTypo, loadCSS, fmtNum, frList } from '../core/util.js';
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
import { readAloud, speak as voiceSpeak, hush as voiceHush } from './voice.js';

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
    /* ligne d'aide sous « Suivant » : vide tant que tout va bien, dit ce qui manque quand on touche trop tôt */
    const helpLine = () => h('p', { class: 'ob-help', 'aria-live': 'polite' });
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
    /* dernière étape : une question pour les PARENTS (la fiche des évaluations nationales est un document d'adulte) ;
       l'enfant est invité à montrer l'écran, le texte des parents les vouvoie */
    const ficheStep = () => {
      const yes = h('button', { type: 'button', class: 'btn big block ob-anim' },
        h('span', { 'aria-hidden': 'true' }, '📷'), frTypo('Prendre la fiche en photo'));
      const no = h('button', { type: 'button', class: 'btn white big block ob-anim' }, 'Plus tard');
      yes.addEventListener('click', () => { audio.tap(); router.go('import', { query: { from: 'onboarding' }, replace: true }); });
      no.addEventListener('click', () => { audio.tap(); audio.whoosh(); router.go('home', { replace: true }); });
      const q = store.getProfile();
      const buddy = (q && q.companion && q.companion.name) || DEFAULT_MOUNT_NAME;
      /* petit lecteur (CP, CE1, ou réglage des parents) : la consigne de l'enfant est dite à voix haute */
      later(() => { try { if (readAloud(store.getProfile())) voiceSpeak('Une question pour tes parents. Montre cet écran à un adulte.'); } catch (_) {} }, 450);
      return h('div', { class: 'ob-card' },
        h('div', { class: 'ob-fiche ob-anim', 'aria-hidden': 'true' }, h('span', null, '📄'), h('span', { class: 'ob-fiche-star' }, '✨')),
        title('Une question pour tes parents'),
        sub('Montre cet écran à un adulte.'),
        h('p', { class: 'ob-adult ob-anim' }, h('b', null, 'Pour les parents : '),
          frTypo('avez-vous la fiche des évaluations nationales « Repères » reçue à la rentrée ? Prise en photo, elle aide '
            + buddy + ' à proposer les bons jeux dès le départ. La photo reste sur l’appareil, elle n’est jamais envoyée.')),
        h('div', { class: 'ob-actions' }, yes, no));
    };

    /* ----- étapes ----- */
    const STEP = {
      /* nouvel enfant, 1 : prénom + fille / garçon */
      name() {
        const input = nameInput(data.name, 'Ton prénom', 'ob-name');
        const next = nextBtn('Suivant ➜', submit);
        const help = helpLine();
        const check = () => {
          const ok = !!input.value.trim() && !!data.g;
          next.setAttribute('aria-disabled', String(!ok));
          if (ok || (help.dataset.miss === 'name' && input.value.trim()) || (help.dataset.miss === 'g' && data.g)) say('');
        };
        const say = (text, miss = '') => { help.textContent = text ? frTypo(text) : ''; help.dataset.miss = miss; };
        function submit() {
          const v = sanitizeName(input.value, '');
          if (!v) { say('Écris ton prénom 😊', 'name'); motion.shake(input); input.focus(); return; }
          if (!data.g) { say('Choisis « une fille » ou « un garçon » 😊', 'g'); motion.shake(segBox); return; }
          data.name = v;
          audio.tap();
          go(cur + 1);
        }
        input.addEventListener('input', check);
        /* « Suivant » du clavier : toujours une réponse ; s'il manque fille / garçon, le clavier se ferme pour qu'on voie
           les deux boutons secoués */
        input.addEventListener('keydown', e => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (!data.g && input.value.trim()) input.blur();
          submit();
        });
        const segBox = genderSeg(check);
        check();
        return h('div', { class: 'ob-card' },
          stage(newPony(132)),
          title('Bonjour ! Comment tu t’appelles ?'),
          h('div', { class: 'ob-field ob-anim' }, h('label', { class: 'ob-label', for: 'ob-name' }, 'Ton prénom'), input),
          h('div', { class: 'ob-field ob-anim' }, h('span', { class: 'ob-label' }, 'Tu es…'), segBox),
          next, help);
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
        let leaving = false;
        function submit() {
          if (leaving) return;                       /* deux touchers rapides : une seule fête, une seule étape */
          leaving = true;
          data.buddy = sanitizeName(input.value, DEFAULT_MOUNT_NAME);
          createOrUpdate();
          audio.neigh();
          /* la fête a lieu ici, autour du poney qu'on vient de nommer ; l'étape suivante arrive ensuite, sans rien
             par-dessus sa question */
          try { input.blur(); } catch (_) {}
          const at = cur;
          const pony = pic.querySelector('.ob-pic') || pic;
          motion.pop(pony, { scale: 1.12 });
          motion.burst(pony, { count: 16, spread: 110 });
          later(() => { if (cur === at) go(at + 1); }, motion.reduced() ? 250 : 900);
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
          /* seulement ce qui existe (jamais « 0 ⭐ ») ; une seule pomme ou une seule étoile : au singulier */
          if (apples + stars === 1) msg = apples ? 'Ta pomme 🍎 est bien là.' : 'Ton étoile ⭐ est bien là.';
          else msg = 'Tes ' + frList([apples ? fmtNum(apples) + ' 🍎' : '', stars ? fmtNum(stars) + ' ⭐' : '']) + ' sont bien là.';
        } else msg = '{N} t’attendait avec impatience !';
        msg = msg.replace('{N}', (p.companion && p.companion.name) || DEFAULT_MOUNT_NAME);
        const input = nameInput(data.name, 'Ton prénom', 'ob-hello-name');
        const next = nextBtn('C’est bien moi ! ➜', submit);
        const help = helpLine();
        const check = () => {
          const ok = !!input.value.trim();
          next.setAttribute('aria-disabled', String(!ok));
          if (ok) help.textContent = '';
        };
        function submit() {
          const v = sanitizeName(input.value, '');
          if (!v) { help.textContent = frTypo('Écris ton prénom 😊'); motion.shake(input); input.focus(); return; }
          data.name = v;
          store.mutateProfile(pp => { pp.name = v; });
          audio.tap();
          go(cur + 1);
        }
        input.addEventListener('input', check);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
        check();
        const pic = stage(avatarOf(p, 150, 'joy'), 'is-big');
        /* la fête jaillit autour du compagnon retrouvé, sans pluie de confettis sur le champ du prénom */
        later(() => { motion.burst(pic.querySelector('.ob-pic') || pic, { count: 22, spread: 120 }); audio.fanfare(); }, 350);
        return h('div', { class: 'ob-card' },
          pic,
          title('Bienvenue dans Caramel 2 !'),
          h('p', { class: 'ob-treasure ob-anim' }, frTypo(msg)),
          h('div', { class: 'ob-field ob-anim' }, h('label', { class: 'ob-label', for: 'ob-hello-name' }, 'Ton prénom'), input),
          next, help);
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
    try { voiceHush(); } catch (_) {}
    const my = st;
    st = null;
    if (!my) return;
    for (const t of my.timers) clearTimeout(t);
  }
};
