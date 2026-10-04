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
     js/ui/companion.js, seuils dans js/ui/companion-life.js). */
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

/* makeManche() → nouvelle manche ; onEnd(summary, extra) ; onQuit(summary|null) ; onLeave(summary|null) */
export function buildCtx({ game, makeManche, manche: first, mode = 'libre', header, onEnd, onQuit, onLeave }) {
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
    motion, audio, tts, speech, kit,

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
      if (manche.hintsLeft <= 0) { kit.toast('Plus de joker pour cette manche… tu peux y arriver ! 💪'); return; }
      if (!jokerHandler) { kit.toast('Pas d’indice pour l’instant 🙂'); return; }
      const shown = jokerHandler(current);
      if (shown !== false) { manche.useHint(current); if (header) header.setHints(manche.hintsLeft); }
    },
    /* pastilles gérées à la main (course, sprint) : désactive l'automatique */
    progress(i, n, st) { autoProgress = false; if (header) header.setProgress(i, n, st || []); },
    setTitle(t) { if (header) header.setTitle(t); },
    announce(t) { if (header && header.announce) header.announce(t); },
    get applesEl() { return header ? header.applesEl : null; },

    /* termine la manche ; extra.stay : la coquille ne montre rien et ne navigue pas (le jeu affiche ses résultats) */
    async end(extra) {
      if (ended) return lastSummary;
      ended = true;
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
      if (!ended) { ended = true; lastSummary = manche.abort(); }
      if (onQuit) onQuit(lastSummary);
    }
  };
  resetHeader();
  return ctx;
}
