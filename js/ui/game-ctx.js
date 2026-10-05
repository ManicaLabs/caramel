/* ============ CONTEXTE DE JEU (ctx, contrat §7.2) ============
   Construit le ctx remis à game.mount(root, ctx) à partir d'une fabrique de manches (js/core/manche.js).
   Partagé par la coquille de jeu et par le banc d'essai : les jeux voient exactement le même ctx.
   - progression automatique : chaque rapport colore une pastille ('done' du premier coup, 'helped' sinon) ;
   - joker 💡 : le bouton d'en-tête appelle le gestionnaire du jeu (ctx.onJoker) puis débite la manche ;
   - cycle de vie : end(extra) termine la manche (bilan par la coquille, sauf extra.stay / extra.skipSummary),
     again() ouvre une nouvelle manche sans démonter le jeu (ex. « Revanche » de la course),
     leave() sort sans bilan, quit() abandonne (progrès gardés, aucun reproche).
   - compagnon (v2.1) : ctx.pet, ctx.petSVG(), ctx.petAnchors() le dessinent comme partout ailleurs, avec son espèce,
     ses accessoires portés ET son stade (petit / junior / champion selon companion.minutes : stageOf de
     js/ui/companion.js, seuils dans js/ui/companion-life.js).
   - voix (CDC §1 principe 7, js/ui/voice.js) : ctx.voice.say(texte) confie au compagnon la phrase du moment (question,
     indice, explication) : elle est lue à voix haute (réglage parent « Lire les consignes à voix haute » : Oui par
     défaut, pour tous les enfants depuis la 2.2.2 ; sons coupés : rien n'est lu) et 🔊 dans l'en-tête la relit (montré
     dès que la lecture est activée, même sons coupés ; caché si le parent a choisi Non) ; jamais micro ouvert.
     Chaque jeu choisit ce qu'il confie (aucune bulle n'est interceptée) ; ctx.voice.on dit si la voix est active ;
     ctx.voice.settle() (v2.2.1) → Promise résolue quand la voix s'est tue (à attendre avant d'ouvrir le micro).
     v2.2.2, voix fluide (js/core/voice-fluid.js) : ctx.voice.prepare(...textes) fait calculer À L'AVANCE ce qui sera sans
     doute dit (question suivante, astuce, explication) ; ctx.speech est js/core/speech.js tel quel (jamais modifié), sauf
     que ensureVosk et startListening préviennent d'abord la voix (voice.micWillStart : le moteur de la voix fluide ne
     démarre jamais en même temps que le micro, et sur un appareil à mémoire faible il est libéré).
   - micro impossible (D1-01, D4-04) : ctx.mic.trouble(code) → phrase courte pour l'enfant (tutoiement) et marche à
     suivre pour l'adulte (vouvoiement, adaptée à l'appli installée) ; ctx.mic.help(code, { onRetry }) ouvre la feuille
     de l'adulte. ctx.changeGame() : la coquille remplace l'étape de balade par un autre jeu (partie libre : choix d'un
     autre jeu) ; ctx.nextStep() : balade, étape suivante (ou accueil quand la balade est finie). */
import { h, frTypo } from '../core/util.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import * as tts from '../core/tts.js';
import * as speech from '../core/speech.js';
import * as kit from './kit.js';
import { getProfile } from '../core/store.js';
import { fillTemplate } from '../core/profiles.js';
import { MOUNTS } from '../content/companion-data.js';
import { mountSVG, mountAnchors } from './mount-svg.js';
import { stageOf } from './companion.js';
import * as voice from './voice.js';

/* compagnon d'un profil → { type, worn, stage, name } (espèce inconnue → poney ; un seul objet par emplacement :
   mountSVG s'en charge) */
function petOf(p) {
  const c = (p && p.companion) || {};
  return {
    type: MOUNTS[c.type] ? c.type : 'pony',
    worn: c.equip && Array.isArray(c.equip.worn) ? c.equip.worn.slice() : [],
    stage: stageOf(p),
    name: typeof c.name === 'string' && c.name ? c.name : 'Caramel'
  };
}

/* ctx.speech : js/core/speech.js tel quel, mais le micro prévient la voix avant de démarrer (voix fluide, v2.2.2) */
const speechCtx = Object.freeze(Object.assign({}, speech, {
  ensureVosk(...a) { voice.micWillStart(); return speech.ensureVosk(...a); },
  startListening(...a) { voice.micWillStart(); return speech.startListening(...a); }
}));

/* ---------- micro impossible : textes (D1-01, D4-04) ----------
   code (js/core/speech.js, onError) : 'not-allowed' | 'service-not-allowed' | 'audio-capture' | 'network' |
   'unsupported' | 'language-not-supported' ; env = { standalone (appli installée), host, ios }.
   → { code, hard (rien à faire sans un adulte), title et sub (enfant), adultTitle, adult (adulte, vouvoiement) } */
const MIC_HARD = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'unsupported', 'language-not-supported']);
export function micTrouble(code, { standalone = false, host = '', ios = false } = {}) {
  const c = String(code || '');
  const sub = frTypo('Demande à un adulte de t’aider.');
  const retry = frTypo(' Revenez ensuite dans Caramel et touchez 🎤.');
  let title, adultTitle, adult;
  if (c === 'not-allowed') {
    title = frTypo('Le micro est bloqué 🔒');
    adultTitle = 'Autoriser le micro';
    adult = ios
      ? frTypo('Caramel n’a pas le droit d’utiliser le micro. Ouvrez Réglages › Safari › Micro et choisissez « Autoriser ».') + retry
      : standalone
        ? frTypo('Caramel n’a pas le droit d’utiliser le micro. Ouvrez l’appli Chrome › ⋮ › Paramètres › Paramètres des sites › Micro, touchez « ') +
          String(host || '') + frTypo(' » puis « Autoriser ».') + retry
        : frTypo('Caramel n’a pas le droit d’utiliser le micro. Touchez l’icône à gauche de l’adresse › Autorisations › Micro › Autoriser, puis touchez 🎤. Si rien ne change, rechargez la page.');
  } else if (c === 'audio-capture') {
    title = frTypo('Je ne trouve pas de micro 🎙️');
    adultTitle = 'Aucun micro détecté';
    adult = frTypo('Aucun micro n’est détecté sur cet appareil. Branchez un casque avec micro, ou utilisez un téléphone ou une tablette.') + retry;
  } else if (c === 'network') {
    title = frTypo('Il me faut internet pour t’écouter 📶');
    adultTitle = 'Connexion nécessaire';
    adult = frTypo('Pour écouter la lecture, Caramel télécharge une seule fois son moteur vocal (environ 45 Mo). Connectez l’appareil à internet, en Wi-Fi de préférence.') + retry;
  } else {
    title = frTypo('Ici, je ne peux pas t’écouter 😕');
    adultTitle = 'Reconnaissance vocale indisponible';
    adult = c === 'service-not-allowed'
      ? frTypo('La reconnaissance de la voix est bloquée dans cette fenêtre. Ouvrez Caramel directement dans Chrome à jour (pas depuis une autre appli).')
      : frTypo('Ce navigateur ne sait pas reconnaître la voix en français. Ouvrez Caramel dans Chrome à jour (Android, ordinateur) ou dans Safari (iPhone, iPad).');
  }
  return { code: c, hard: MIC_HARD.has(c), title, sub, adultTitle, adult };
}
function micEnv() {
  const G = globalThis;
  let standalone = false, ios = false, host = '';
  try { standalone = !!(G.matchMedia && G.matchMedia('(display-mode: standalone)').matches) || G.navigator.standalone === true; } catch (_) {}
  try { const n = G.navigator; ios = /iPad|iPhone|iPod/.test(n.userAgent) || (n.platform === 'MacIntel' && n.maxTouchPoints > 1); } catch (_) {}
  try { host = G.location.host; } catch (_) {}
  return { standalone, host, ios };
}

/* makeManche() → nouvelle manche ; onEnd(summary, extra) ; onQuit(summary|null) ; onLeave(summary|null) ;
   onChangeGame() : changer de jeu (micro impossible) ; onNextStep() : balade, étape suivante */
export function buildCtx({ game, makeManche, manche: first, mode = 'libre', header, onEnd, onQuit, onLeave, onChangeGame, onNextStep }) {
  let manche = first || makeManche();
  let states = [], current = null, jokerHandler = null, autoProgress = true, ended = false, lastSummary = null;
  const refresh = () => {
    if (autoProgress && header) header.setProgress(Math.min(manche.state.index - (current ? 1 : 0), manche.count), manche.count, states);
  };
  const resetHeader = () => {
    if (!header) return;
    header.setHints(manche.hintsLeft);
    header.setApples(0);
    refresh();
  };

  const ctx = {
    game, mode,
    get profile() { return getProfile(); },
    get classe() { const p = getProfile(); return p ? p.classe : null; },
    get settings() { const p = getProfile(); return (p && p.settings) || {}; },
    fill: str => fillTemplate(str, getProfile()),
    /* compagnon du profil actif : { type, worn, stage, name } (relu à chaque appel : stade et accessoires à jour) */
    get pet() { return petOf(getProfile()); },
    /* SVG du compagnon (mountSVG) avec ses accessoires et son stade ; opts de mountSVG : expr, shadow (false quand le
       jeu pose sa propre ombre au sol), phase, view ; stage peut être forcé */
    petSVG(size, mood = '', opts = {}) {
      const m = petOf(getProfile());
      return mountSVG(m.type, m.worn, size, mood, Object.assign({ stage: m.stage }, opts && typeof opts === 'object' ? opts : {}));
    },
    /* ancres du compagnon au repos, à son stade (mountAnchors : bouche, yeux, sommet de tête… en unités du viewBox
       100 × 84 ; × taille / 100 pour des px) — pour viser la bouche, poser un objet sur lui */
    petAnchors(opts = {}) {
      const m = petOf(getProfile());
      return mountAnchors(m.type, Object.assign({ stage: m.stage }, opts && typeof opts === 'object' ? opts : {}));
    },
    get axis() { return manche.axis; },
    get count() { return manche.count; },
    get rng() { return manche.rng; },
    get manche() { return manche; },
    get ended() { return ended; },
    motion, audio, tts, speech: speechCtx, kit,

    nextItem(axis, opts) {
      if (ended) return null;
      const it = manche.nextItem(axis, opts);
      current = it;
      /* crochet de test : les parcours automatisés définissent window.__caramelDebug = {} pour lire l'item en cours */
      try { if (globalThis.__caramelDebug) { globalThis.__caramelDebug.item = it; globalThis.__caramelDebug.game = game && game.id; } } catch (_) {}
      refresh();
      return it;
    },
    report(item, outcome) {
      if (ended) return { ignored: true };
      const fb = manche.report(item, outcome);
      if (fb && !fb.ignored && !(outcome && outcome.kind === 'race')) {
        const k = manche.state.reports - 1;
        states[k] = (outcome && outcome.correct && !outcome.hinted && !(item && item.assist)) ? 'done' : 'helped';
      }
      if (item === current) current = null;
      if (header) header.setApples(manche.state.apples);
      refresh();
      return fb;
    },
    hints: {
      left: () => manche.hintsLeft,
      use: item => { const ok = manche.useHint(item); if (header) header.setHints(manche.hintsLeft); return ok; }
    },
    /* le jeu enregistre ce qui se passe quand l'enfant touche 💡 : fn(itemCourant) → false si aucun indice n'a pu être montré */
    onJoker(fn) { jokerHandler = fn; },
    /* appelé par l'en-tête */
    _joker() {
      if (ended) return;
      if (manche.hintsLeft <= 0) { kit.toast(frTypo('Plus de joker pour cette partie… tu peux y arriver ! 💪')); return; }
      if (!jokerHandler) { kit.toast(frTypo('Pas d’indice pour l’instant 🙂')); return; }
      const shown = jokerHandler(current);
      if (shown !== false) { manche.useHint(current); if (header) header.setHints(manche.hintsLeft); }
    },
    /* pastilles gérées à la main (course, sprint) : désactive l'automatique */
    progress(i, n, st) { autoProgress = false; if (header) header.setProgress(i, n, st || []); },
    setTitle(t) { if (header) header.setTitle(t); },
    announce(t) { if (header && header.announce) header.announce(t); },
    /* la phrase du moment, dite par le compagnon (lecture à voix haute activée ; le texte reste affiché par le jeu) */
    voice: {
      get on() { return voice.voiceOn(getProfile()); },
      /* → Promise<boolean> : true quand la phrase a été dite jusqu'au bout ; quiet : la phrase est seulement confiée à
         🔊 (le micro est demandé : le compagnon se tait) */
      say(text, { quiet = false } = {}) {
        const q = getProfile();
        const on = voice.voiceOn(q);
        if (header && header.setLine) header.setLine(text, voice.listenOn(q));
        return on && !quiet ? voice.speak(text) : Promise.resolve(false);
      },
      hush() { voice.hush(); },
      /* → Promise : la voix s'est tue et le moteur a repris son souffle (v2.2.1) — à attendre après hush() avant d'ouvrir
         le micro (Chrome Android : synthèse et reconnaissance se disputent le son juste après un cancel()) */
      settle() { return voice.settle(); },
      /* v2.2.2 : calcul à l'avance par la voix fluide (sans effet si elle n'est pas prête ou si la lecture est coupée) ;
         canPrepare : la voix fluide est prête et la lecture automatique active (sinon, rien à préparer) */
      prepare(...texts) { voice.prepare(...texts); },
      /* ce qui sera dit dans moins d'une seconde (la question suivante) : calculé avant les astuces */
      prepareNext(...texts) { voice.prepareNext(...texts); },
      get canPrepare() { return voice.canPrepare(); }
    },
    get applesEl() { return header ? header.applesEl : null; },
    /* micro impossible : textes (enfant, adulte) et feuille d'aide pour l'adulte (onRetry : « Réessayer 🎤 ») */
    mic: {
      trouble: code => micTrouble(code, micEnv()),
      help(code, { onRetry, onClose } = {}) {
        const t = micTrouble(code, micEnv());
        const actions = [];
        if (typeof onRetry === 'function') {
          actions.push({ label: ['Réessayer', h('span', { 'aria-hidden': 'true' }, ' 🎤')], onClick: () => { onRetry(); } });
        }
        actions.push({ label: 'Fermer', kind: 'white' });
        return kit.sheet({ title: t.adultTitle, content: h('div', { class: 'gx-adult' }, h('p', null, t.adult)), actions, onClose });
      }
    },
    /* micro impossible : un autre jeu à la place (balade : l'étape change de jeu ; libre : choix d'un autre jeu) */
    changeGame() {
      voice.hush();
      if (onChangeGame) onChangeGame();
    },
    /* balade, après des résultats affichés par le jeu (course) : étape suivante, ou accueil si la balade est finie */
    nextStep() {
      voice.hush();
      if (!ended) { ended = true; lastSummary = manche.abort(); }
      if (onNextStep) onNextStep(lastSummary); else if (onLeave) onLeave(lastSummary);
    },

    /* termine la manche ; extra.stay : la coquille ne montre rien et ne navigue pas (le jeu affiche ses résultats) */
    async end(extra) {
      if (ended) return lastSummary;
      ended = true;
      voice.hush();
      lastSummary = manche.finish(extra);
      return onEnd ? onEnd(lastSummary, extra || {}) : lastSummary;
    },
    /* nouvelle manche, même jeu, même mode (le jeu reste monté) */
    again() {
      if (!ended) manche.abort();
      manche = makeManche();
      states = []; current = null; ended = false; lastSummary = null; autoProgress = true;
      resetHeader();
    },
    /* sortir sans bilan (après end({ stay:true }) en général) */
    leave() {
      if (!ended) { ended = true; lastSummary = manche.abort(); }
      if (onLeave) onLeave(lastSummary); else if (onQuit) onQuit(lastSummary);
    },
    /* abandon doux (bouton ← / retour Android) */
    quit() {
      voice.hush();
      if (!ended) { ended = true; lastSummary = manche.abort(); }
      if (onQuit) onQuit(lastSummary);
    }
  };
  resetHeader();
  return ctx;
}
