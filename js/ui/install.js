/* ============ « 📲 METS CARAMEL SUR L'ÉCRAN D'ACCUEIL » (v2.2.2, décision du parent du 04/10/2026) ============
   L'invitation à installer Caramel, proposée sans attendre qu'on la cherche : pour retrouver Caramel en un geste et
   jouer même sans internet. Logique pure (quand, comment, mémoire « plus tard » de l'appareil) : js/core/install.js ;
   l'invitation du navigateur (beforeinstallprompt) est gardée dès le démarrage par js/main.js.
     - offerSheet({ audience }) : la petite feuille — fin de la création d'un enfant (js/ui/onboarding.js, tutoiement),
       bannière de l'accueil, espace parents (audience 'adult', vouvoiement) ;
     - homeBanner({ onSheet }) : la bannière DISCRÈTE de l'accueil (js/ui/home.js, sous les boutons secondaires : elle ne
       concurrence pas « Jouer ▶ ») ; ✕ = elle revient dans 7 jours ;
     - parentsRow() : la ligne « Écran d'accueil » de la carte « Sur cet appareil » de l'espace parents (état, bouton).
   Android (Chrome, Edge, Samsung Internet), ordinateur avec Chrome ou Edge : le vrai bouton « Installer » (prompt()) ;
   iPhone / iPad (Safari, Chrome) : la marche à suivre courte et illustrée, et « C'est fait ✓ » (rien ne permet de le
   vérifier : l'invitation revient 30 jours après, et l'espace parents garde « Comment faire ? ») ; navigateur sans
   installation possible : rien. Jamais en mode installé ; appinstalled → tout disparaît.
   Jamais pendant un jeu (seuls l'accueil, la fin de la création d'un enfant et l'espace parents l'affichent), ni en
   même temps que le bandeau de mise à jour ou la visite guidée (l'accueil s'en charge, js/ui/home.js).
   Lecture à voix haute (côté enfant, js/ui/voice.js) : la feuille dit son titre et son « pourquoi » en s'ouvrant, se
   tait en se fermant ; son 🔊 (sous l'icône, comme sous le portrait de la visite guidée) redit tout, marche à suivre
   comprise ; la bannière a son 🔊 (elle ne parle jamais toute seule). Phrases enregistrées : groupe « inst » de
   js/content/voice-lines.js (kidSpeech). */
import { h, svg, frTypo, loadCSS } from '../core/util.js';
import * as install from '../core/install.js';
import * as kit from './kit.js';
import * as audio from '../core/audio.js';
import * as voice from './voice.js';

const CSS = 'css/ui/install.css';
export const cssReady = () => loadCSS(CSS);

/* ---------- état ---------- */
/* l'invitation du navigateur arrive (ou disparaît), Caramel vient d'être installé : fn() */
export const onChange = fn => install.onChange(fn);
export function method() { try { return install.installMethod(); } catch (_) { return null; } }
export function standalone() { try { return install.isStandalone(); } catch (_) { return false; } }
/* une invitation (feuille ou bannière) est-elle permise maintenant ? (appareil : installé, « plus tard », méthode) */
export function canInvite(now = Date.now()) {
  try { return install.shouldInvite({ standalone: standalone(), method: method(), prefs: install.readInstall(), now }); } catch (_) { return false; }
}
const onDesk = () => { try { const d = install.parseUA(globalThis.navigator.userAgent, globalThis.navigator); return !d.mobile; } catch (_) { return false; } };
const uaInfo = () => { try { return install.parseUA(globalThis.navigator.userAgent, globalThis.navigator); } catch (_) { return null; } };

/* ---------- petites icônes de la marche à suivre (celles qu'on voit dans Safari et Chrome) ---------- */
const S = { viewBox: '0 0 24 24', width: '22', height: '22', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' };
const ICONS = {
  share: () => svg('svg', S, svg('path', { d: 'M12 3.5v11' }), svg('path', { d: 'M8 7.5l4-4 4 4' }),
    svg('path', { d: 'M8.5 10.5H6.5a1.5 1.5 0 0 0-1.5 1.5v7a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-2' })),
  add: () => svg('svg', S, svg('rect', { x: '4', y: '4', width: '16', height: '16', rx: '4' }), svg('path', { d: 'M12 8.5v7M8.5 12h7' }))
};
const ico = name => h('span', { class: 'in-ico' }, ICONS[name]());

/* ---------- textes (tutoiement pour l'enfant, vouvoiement pour l'adulte) ---------- */
function words(audience, desk = onDesk()) {
  const kid = audience !== 'adult';
  return {
    kid,
    title: desk ? (kid ? 'Installe Caramel sur l’ordinateur' : 'Installer Caramel sur cet ordinateur')
      : (kid ? 'Mets Caramel sur l’écran d’accueil' : 'Mettre Caramel sur l’écran d’accueil'),
    why: desk ? (kid ? 'Tu l’ouvriras d’un clic, dans sa propre fenêtre, et tu pourras jouer même sans internet.' : 'Il s’ouvrira d’un clic, dans sa propre fenêtre, et fonctionnera même sans internet.')
      : (kid ? 'Tu le retrouveras en un geste, et tu pourras jouer même sans internet.' : 'Vous le retrouverez en un geste, en plein écran, et il fonctionnera même sans internet.'),
    touch: kid ? 'Touche' : 'Touchez',
    choose: kid ? 'Choisis' : 'Choisissez',
    install: 'Installer',
    later: 'Plus tard',
    done: 'C’est fait',
    close: 'Fermer'
  };
}
/* étapes illustrées pour iPhone et iPad : les boutons à toucher dessinés comme dans le navigateur (pastilles).
   Chrome sur iPhone et iPad : Partager, à droite de la barre d'adresse (aide de Google, support.google.com/chrome/answer/15085120 ;
   S22V-5 : le menu ⋯ n'y figure pas). Ce que la feuille en DIT (côté enfant) : KID_STEPS_SAY, plus bas. */
function iosSteps(m, w) {
  const step = (n, ...parts) => h('li', { class: 'in-step' }, h('span', { class: 'in-n', 'aria-hidden': 'true' }, String(n)), h('span', { class: 'in-step-t' }, ...parts));
  /* pastille : icône + mot, comme le bouton à toucher */
  const key = (name, label) => h('span', { class: 'in-key' + (name ? '' : ' is-word') }, name ? ico(name) : null, h('span', null, label));
  const scroll = frTypo(w.kid ? ' (fais défiler si besoin).' : ' (faites défiler si besoin).');
  const list = m === 'ios-chrome'
    ? [step(1, w.touch + ' ', key('share', 'Partager'), frTypo(' (à droite de la barre d’adresse).')),
      step(2, w.choose + ' ', key('add', 'Ajouter à l’écran d’accueil'), scroll),
      step(3, w.touch + ' ', key(null, 'Ajouter'), '.')]
    : [step(1, w.touch + ' ', key('share', 'Partager'), frTypo(w.kid ? ' (en bas de l’écran ; sur iPad, en haut). Pas de bouton ? Touche d’abord ⋯.'
      : ' (en bas de l’écran ; sur iPad, en haut). Pas de bouton ? Touchez d’abord ⋯.')),
      step(2, w.choose + ' ', key('add', 'Sur l’écran d’accueil'), scroll),
      step(3, w.touch + ' ', key(null, 'Ajouter'), '.')];
  return h('ol', { class: 'in-steps' }, list);
}
/* sur iPhone et iPad, l'appli de l'écran d'accueil ne partage pas la mémoire de Safari (WebKit, bug 181849 : voulu par
   Apple) : le profil créé dans Safari n'y est pas (S22V-2) */
const IOS_NOTE = 'Pour les parents : sur iPhone et iPad, Caramel ouvert depuis l’icône repart de zéro (sa mémoire est séparée de Safari). Ouvrez-le depuis l’icône et refaites la création de l’enfant ; ce qui a été fait ici reste dans Safari.';

/* ---------- ce que la feuille et la bannière disent (côté enfant) ----------
   Phrases enregistrées (js/content/voice-lines.js, groupe « inst ») : la marche à suivre y est dite en mots (les
   pastilles sont des mots, « ⋯ » devient « les trois petits points », « iPad » se dit « aïe-pad »). */
export const KID_STEPS_SAY = Object.freeze({
  'ios-safari': Object.freeze(['Touche Partager, en bas de l’écran ; sur iPad, en haut. Pas de bouton ? Touche d’abord les trois petits points.',
    'Choisis : Sur l’écran d’accueil. Fais défiler si besoin.', 'Touche Ajouter.']),
  'ios-chrome': Object.freeze(['Touche Partager, à droite de la barre d’adresse.', 'Choisis : Ajouter à l’écran d’accueil. Fais défiler si besoin.',
    'Touche Ajouter.'])
});
/* m : méthode (installMethod) ; desk : ordinateur → { open : dit à l'ouverture de la feuille (et par le 🔊 de la
   bannière), all : redit par le 🔊 de la feuille (marche à suivre comprise sur iPhone et iPad) } */
export function kidSpeech(m, desk = onDesk()) {
  const w = words('kid', desk);
  const open = w.title + '. ' + w.why;
  return { open, all: [open, ...(KID_STEPS_SAY[m] || [])].join(' ') };
}

/* ---------- le vrai bouton « Installer » (invitation du navigateur) ---------- */
async function runPrompt(w) {
  const r = await install.prompt();
  if (r === 'accepted') {
    try { audio.success(3); } catch (_) {}
    kit.toast(frTypo(w.kid ? 'Caramel s’installe ✓ Tu le retrouveras sur l’écran d’accueil.' : 'Caramel s’installe ✓ Vous le retrouverez sur l’écran d’accueil.'));
  } else if (r === 'dismissed') install.snooze();
  return r;
}

/* ---------- la feuille ----------
   audience 'kid' (fin de la création d'un enfant, bannière de l'accueil) ou 'adult' (espace parents) ;
   onClose(raison) : 'installed' | 'done' (iPhone : « C'est fait ») | 'later' | 'dismissed' | 'none' (rien à proposer).
   Côté enfant, la fermer sans rien faire vaut « plus tard » (7 jours). → Promise<raison> */
let openSheet = null;
export async function offerSheet({ audience = 'kid' } = {}) {
  const m = method();
  if (!m || standalone()) return 'none';
  await cssReady();
  if (openSheet) return 'none';
  const w = words(audience);
  /* lecture à voix haute (côté enfant) : dite à l'ouverture, 🔊 sous l'icône (même règle que la visite guidée) */
  const said = w.kid ? kidSpeech(m) : null;
  return new Promise(resolve => {
    let result = null;
    const fin = r => { if (!result) result = r; };
    const icon = h('img', { class: 'in-app-ico', src: 'icon-192.png', alt: '', width: '64', height: '64', decoding: 'async' });
    let listen = null;
    try { if (said && voice.listenOn()) listen = voice.listenButton(() => said.all, { label: 'Écouter encore' }); } catch (_) { listen = null; }
    const parts = [h('div', { class: 'in-head' + (listen ? ' has-listen' : '') }, icon, h('p', { class: 'in-why' }, frTypo(w.why)), listen)];
    let actions;
    if (m === 'prompt') {
      actions = [
        { label: w.later, kind: 'white', onClick: () => { fin('later'); } },
        { label: w.install, onClick: () => {
          fin('prompt');
          runPrompt(w).then(r => { if (r !== 'accepted') return; result = 'installed'; });
        } }
      ];
    } else {
      parts.push(iosSteps(m, w));
      parts.push(h('p', { class: 'in-note' }, frTypo(IOS_NOTE)));
      actions = [
        { label: w.kid ? w.later : w.close, kind: 'white', onClick: () => { fin(w.kid ? 'later' : 'dismissed'); } },
        { label: w.done + ' ✓', onClick: () => { fin('done'); install.markInstalled(); kit.toast(frTypo(w.kid ? 'Bravo ! Ouvre Caramel avec son icône ✓' : 'C’est noté ✓ Ouvrez Caramel avec son icône.')); } }
      ];
    }
    const title = h('span', { class: 'in-title' }, h('span', { 'aria-hidden': 'true' }, '📲 '), frTypo(w.title));
    let off = () => {};
    const s = kit.sheet({
      title, content: h('div', { class: 'in-sheet' }, parts), actions,
      onClose: reason => {
        off();
        openSheet = null;
        if (said) { try { voice.hush(); } catch (_) {} }
        if (!result) fin(reason === 'action' ? 'later' : 'dismissed');
        /* côté enfant, fermer sans rien faire = plus tard ; « Installer » refusé : noté par runPrompt */
        if (w.kid && (result === 'later' || result === 'dismissed')) install.snooze();
        resolve(result);
      }
    });
    if (!s || !s.el) { resolve('none'); return; }
    openSheet = s;
    if (said) { try { if (voice.voiceOn()) voice.speak(said.open); } catch (_) {} }
    /* installée pendant que la feuille est ouverte (ou invitation retirée) : elle se referme d'elle-même */
    off = install.onChange(() => {
      if (install.justInstalled()) { result = 'installed'; s.close('api'); }
    });
  });
}

/* fin de la création d'un enfant (js/ui/onboarding.js, js/ui/import-eval.js) : la petite feuille si une invitation est
   permise, puis fn() (l'accueil), quoi qu'on y ait choisi */
export function offerThen(fn) {
  let done = false;
  const go = () => { if (!done) { done = true; fn(); } };
  if (!canInvite()) { go(); return; }
  offerSheet({ audience: 'kid' }).then(go, go);
}

/* ---------- la bannière de l'accueil ----------
   → { el, show(bool) } ; el est vide tant qu'elle n'est pas montrée. onSheet(promesse) : la feuille ouverte (l'accueil
   la suit pour ne pas lancer autre chose par-dessus). Toucher : Android → l'invitation du navigateur directement (le
   vrai bouton « Installer ») ; iPhone / iPad → la feuille de la marche à suivre. ✕ : plus tard (7 jours). */
export function homeBanner({ onSheet, onHide } = {}) {
  const slot = h('div', { class: 'hm-inst-slot' });
  let shown = false, banner = null;
  const hide = () => {
    if (!shown) return;
    shown = false;
    if (banner) banner.remove();
    banner = null;
    if (onHide) onHide();
  };
  const build = () => {
    const w = words('kid');
    const go = h('button', { type: 'button', class: 'hm-inst-go' },
      h('span', { class: 'hm-inst-ico', 'aria-hidden': 'true' }, '📲'), h('span', { class: 'hm-inst-t' }, frTypo(w.title)));
    const x = h('button', { type: 'button', class: 'hm-inst-x', 'aria-label': frTypo('Plus tard : cacher cette invitation') }, h('span', { 'aria-hidden': 'true' }, '✕'));
    /* 🔊 : ce que propose la bannière, pour l'enfant qui ne lit pas encore (jamais dit tout seul) */
    let listen = null;
    try { if (voice.listenOn()) { const t = kidSpeech(method()).open; listen = voice.listenButton(() => t, { label: 'Écouter' }); } } catch (_) { listen = null; }
    go.addEventListener('click', async () => {
      try { audio.tap(); } catch (_) {}
      if (method() === 'prompt') {
        const r = await runPrompt(w);
        if (r === 'dismissed') hide();
        return;
      }
      const p = offerSheet({ audience: 'kid' });
      if (onSheet) onSheet(p);
      const r = await p;
      if (r !== 'none') hide();
    });
    x.addEventListener('click', () => {
      try { audio.tap(); } catch (_) {}
      install.snooze();
      hide();
      kit.toast(frTypo('D’accord ! On en reparle dans une semaine.'));
    });
    return h('div', { class: 'hm-inst' + (listen ? ' has-listen' : '') }, listen, go, x);
  };
  const off = install.onChange(() => { if (!canInvite()) hide(); });
  return {
    el: slot,
    get shown() { return shown; },
    show(want) {
      const ok = !!want && canInvite();
      if (ok === shown) return shown;
      if (!ok) { hide(); return false; }
      shown = true;
      banner = build();
      slot.appendChild(banner);
      return true;
    },
    destroy() { off(); hide(); }
  };
}

/* ---------- espace parents : ligne « Écran d'accueil » (carte « Sur cet appareil ») ---------- */
export function parentsRow({ say } = {}) {
  const state = h('p', { class: 'pa-dev-state' });
  const acts = h('div', { class: 'pa-dev-acts' });
  const help = h('p', { class: 'pa-help' });
  const row = h('div', { class: 'pa-row pa-install' }, h('div', { class: 'pa-row-label' }, 'Écran d’accueil'), state, acts, help);
  const w = words('adult');
  const btn = (label, onClick, white = false) => h('button', { type: 'button', class: 'btn small' + (white ? ' white' : ''), 'data-fk': 'install-btn', on: { click: onClick } },
    h('span', { class: 'pa-lbl' }, h('span', { class: 'pa-lbl-emo', 'aria-hidden': 'true' }, '📲\u00A0'), label));
  /* « Comment faire ? » : la marche à suivre de l'iPhone et de l'iPad, au vouvoiement */
  const howBtn = () => btn(frTypo('Comment faire ?'), async () => {
    try { audio.tap(); } catch (_) {}
    await offerSheet({ audience: 'adult' });
    if (row.isConnected) render();
  }, true);
  const render = () => {
    const m = method(), st = standalone(), prefs = install.readInstall();
    acts.textContent = '';
    state.classList.remove('is-on');
    if (st) {
      state.textContent = frTypo('Caramel est ouvert depuis l’écran d’accueil ✓');
      state.classList.add('is-on');
    } else if (install.justInstalled() || (prefs.done && !m)) {
      /* vérifié : appinstalled (Android, ordinateur), et plus d'invitation du navigateur depuis */
      state.textContent = frTypo('Installé sur cet appareil ✓ Ouvrez Caramel avec son icône.');
      state.classList.add('is-on');
    } else if (prefs.done && m !== 'prompt') {
      /* iPhone, iPad : « C'est fait » a été touché, rien ne le vérifie (S22V-3) : la marche à suivre reste à portée */
      state.textContent = frTypo('Noté comme installé. Pas d’icône sur l’écran d’accueil ?');
      acts.appendChild(howBtn());
    } else if (m === 'prompt') {
      state.textContent = frTypo('Pas encore installé.');
      acts.appendChild(btn('Installer Caramel', async () => {
        try { audio.tap(); } catch (_) {}
        const r = await runPrompt(w);
        if (r === 'dismissed' && say) say('Installation annulée.');
        render();
      }));
    } else if (m) {
      state.textContent = frTypo('Pas encore sur l’écran d’accueil.');
      acts.appendChild(howBtn());
    } else {
      const d = uaInfo();
      state.textContent = frTypo(d && d.inApp ? 'Caramel est ouvert dans une autre appli : ouvrez-le dans Chrome (Android) ou Safari (iPhone, iPad) pour l’installer.'
        /* Chrome Android sans invitation : déjà installé, ou pas encore proposé ; son menu le permet toujours */
        : d && d.android && d.browser === 'Chrome' ? 'Chrome ne propose pas l’installation pour l’instant. Menu ⋮ › « Installer l’appli » (ou « Ajouter à l’écran d’accueil ») ; s’il affiche « Ouvrir l’appli », Caramel est déjà installé.'
          /* Firefox, Opera, Samsung Internet… sur Android : pas d'invitation du navigateur, mais leur menu sait le faire (S22V-7) */
          : d && d.android ? 'Dans le menu du navigateur (⋮ ou ☰), choisissez « Ajouter à l’écran d’accueil » ou « Installer ». Sinon, ouvrez Caramel dans Chrome.'
            : 'Ce navigateur ne permet pas d’ajouter Caramel à l’écran d’accueil. Sur Android, ouvrez Caramel dans Chrome ; sur iPhone ou iPad, dans Safari.');
    }
    const d = uaInfo();
    help.hidden = st;
    help.textContent = frTypo(onDesk()
      ? 'Installé, Caramel s’ouvre d’un clic dans sa propre fenêtre et fonctionne même sans internet.'
      : 'Depuis son icône, Caramel s’ouvre en un geste, en plein écran, et fonctionne même sans internet.'
        + (d && d.android ? ' Les rappels quotidiens en ont besoin.' : ''));
  };
  render();
  const off = install.onChange(() => { if (row.isConnected) render(); else off(); });
  return row;
}
