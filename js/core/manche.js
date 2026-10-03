/* ============ MANCHE : une série d'items d'un jeu (CDC v2 §6, §7.3 ; contrat §5.7) ============
   Une manche = 8 à 12 items (une histoire pour la course). Pour chaque item :
     θ courant → b = targetB(θ, offset + adj) → A = absLevel(classe, b) → clé Leitner due (faits,
     conjugaison) ou générateur → item.b = relLevel(classe, item.A) → item.assist (filet de sécurité).
   Chaque rapport est appliqué et persisté aussitôt (θ, Leitner, 🍎) : quitter en cours de route ne perd
   rien. finish() écrit l'historique, les minutes, la série 🔥, le bloc de balade et le snapshot hebdo.
   Une manche sans aucun rapport ne laisse aucune trace.
   Filet de sécurité (CDC §7.3) : chaque série de 2 échecs (r ≤ 0,6) → adj − 0,5 et item suivant aidé ;
   chaque série de 4 réussites (r ≥ 0,8) → adj + 0,3 ; adj ∈ [−1,5 ; 0,9]. Ainsi jamais 3 erreurs
   d'affilée sans aide (l'item aidé coupe la série).
   Pré-requis : await loadGenerator(axe) (et des axes secondaires utilisés), sauf générateurs injectés. */

import { clamp, dayStr } from './util.js';
import { makeRng } from './rng.js';
import { absLevel, relLevel } from './levels.js';
import { skillOf, scoreR, applyResult, applyFluence, targetB } from './adaptive.js';
import { review, dueKeys } from './leitner.js';
import { completeBlock, finishDay } from './session.js';
import { addApples, bumpStreak } from './economy.js';
import { snapshotIfNeeded } from './radar-model.js';
import { fillTemplate } from './profiles.js';
import { getProfile, mutateProfile } from './store.js';
import { generatorSync } from '../content/index.js';
import { GAME_BY_ID, mancheSize } from '../games/index.js';

const HINTS = 2;                                       /* jokers par manche (CDC §7.7) */
const LEITNER_AXES = ['ma.faits', 'fr.conjug'];        /* générateurs rejouant une clé (fromKey) */
const P_LEITNER = 0.4, P_LEITNER_REVISION = 0.7;
/* part des clés dues : grandit avec l'arriéré pour ne pas laisser les révisions s'accumuler (0,4 → 0,8 max) */
const pLeitner = (dueCount, revision) => Math.min(0.8, (revision ? P_LEITNER_REVISION : P_LEITNER) + dueCount / 50);
const TRIES = 5;                                       /* essais pour éviter une clé déjà vue */
const ADJ_MIN = -1.5, ADJ_MAX = 0.9, ADJ_DOWN = 0.5, ADJ_UP = 0.3, FAILS_DOWN = 2, OKS_UP = 4;
const HISTORY_MAX = 500, MCLM_MAX = 300;               /* plafonds du schéma (contrat §2) */
const TREND_SPAN = 5;                                  /* tendance = θ − θ cinq manches plus tôt */
/* temps d'apprentissage : écart entre deux rapports, plafonné (appli laissée ouverte ≠ minutes jouées) */
const ITEM_CAP_MS = 2 * 60000, RACE_CAP_MS = 15 * 60000;
const MISSED_MAX = 15;                                 /* mots ratés retenus par course (ordre du texte) */
/* mots-outils pardonnés par la course v11 (FORGIVE) : jamais des « mots à apprivoiser » */
const FUNCTION_WORDS = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux', 'et', 'en', 'y', 'a',
  'ce', 'se', 'sa', 'son', 'ses', 'ne', 'que', 'qui', 'il', 'ils', 'elle', 'ou']);

const isNum = v => typeof v === 'number' && Number.isFinite(v);
/* nombre ou chaîne numérique (paramètres lus dans l'URL du jeu) → nombre, sinon NaN */
const toNum = v => (isNum(v) ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const posInt = v => { const n = toNum(v); return Number.isFinite(n) && n >= 1 ? Math.round(n) : 0; };
const round2 = v => Math.round(v * 100) / 100;
const round3 = v => Math.round(v * 1000) / 1000;
/* normalisation des mots de la course v11 : minuscules, sans accents, lettres et chiffres */
const normWord = w => String(w ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const keepWord = w => w.length >= 2 && !FUNCTION_WORDS.has(w);
function uniqWords(list) {
  const out = [], seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const w = normWord(raw);
    if (!keepWord(w) || seen.has(w)) continue;
    seen.add(w); out.push(w);
  }
  return out;
}
/* mots d'un texte : forme normalisée → forme affichable (accents gardés ; minuscule si le mot
   apparaît au moins une fois en minuscule, sinon majuscule conservée : nom propre) */
function textWords(text) {
  const display = new Map();
  for (const tok of String(text).split(/\s+/)) {
    const form = tok.replace(/^[^\p{L}0-9]+|[^\p{L}0-9]+$/gu, '');
    const w = normWord(form);
    if (!keepWord(w)) continue;
    const prev = display.get(w);
    if (prev === undefined || (prev !== prev.toLowerCase() && form === form.toLowerCase())) display.set(w, form);
  }
  return display;
}

/* createManche({ gameId, axis, count, mode, blockIdx, offset, today, seed, generators?, clock? })
   axis   : défaut = axe principal du jeu ; count : défaut = bloc de balade, sinon mancheSize ;
   offset : défaut = celui du bloc de balade, sinon 0 ;
   generators : { axe: module } injectés (tests), sinon generatorSync(axe) ;
   clock  : horloge en ms (tests), défaut Date.now. */
export function createManche({
  gameId, axis, count, mode = 'libre', blockIdx = null, offset, today = dayStr(), seed,
  generators = null, clock = Date.now
} = {}) {
  const p0 = getProfile();
  if (!p0) throw new Error('createManche : aucun profil actif');
  const pid = p0.id;
  const game = GAME_BY_ID[gameId] || null;
  const mainAxis = axis || (game ? game.primary : null);
  if (!mainAxis) throw new Error('createManche : axe inconnu pour le jeu « ' + gameId + ' »');
  const balade = mode === 'balade';
  const bi = blockIdx === null || blockIdx === undefined || blockIdx === '' ? NaN : Number(blockIdx);
  const bIdx = balade && Number.isInteger(bi) && bi >= 0 ? bi : null;
  const plan = p0.today;
  const block = bIdx !== null && plan && plan.d === today && Array.isArray(plan.blocks) ? plan.blocks[bIdx] || null : null;
  const kind = block ? block.kind : null;
  const sessionMin = (p0.settings && p0.settings.sessionMin) || 15;
  const off = Number.isFinite(toNum(offset)) ? toNum(offset) : block && isNum(block.offset) ? block.offset : 0;
  const total = posInt(count) || (block && posInt(block.count)) || mancheSize(gameId, sessionMin);
  const rng = makeRng(seed === undefined || seed === null ? clock() : seed);
  const rngLeitner = rng.fork('leitner');              /* tirages Leitner indépendants des items */
  const gameRng = rng.fork('jeu');                     /* aléa propre au jeu (ctx.rng) */
  const startedAt = clock();
  const thetaBefore = skillOf(p0, mainAxis).t;

  let index = 0, reports = 0, nCorrect = 0, nClean = 0, nHinted = 0, apples = 0;
  let hints = HINTS, adj = 0, okRun = 0, failRun = 0, assistNext = false;
  let current = null, closed = false, summary = null, lastRace = null;
  let activeMs = 0, mark = startedAt;
  const seen = new Set();                              /* clés servies dans la manche */
  const feedbacks = new WeakMap();                     /* item déjà rapporté → son retour */
  const jokered = new WeakSet();                       /* items sur lesquels un joker a servi */

  const genFor = ax => (generators && generators[ax]) || generatorSync(ax);
  const tick = cap => { const t = clock(); activeMs += clamp(t - mark, 0, cap); mark = t; return t; };
  const walletNow = () => { const p = getProfile(pid); return p && p.wallet ? p.wallet.apples : 0; };
  /* écriture via le store (une seule persistance) ; profil disparu ou erreur → { ok: false } */
  function write(fn) {
    if (!getProfile(pid)) return { ok: false };
    let out, ok = false;
    try { mutateProfile(p => { out = fn(p); }, pid); ok = true; }
    catch (e) { try { console.warn('[manche] écriture impossible', e); } catch (_) {} }
    return { ok, out };
  }
  /* retour sans effet (rapport tardif après la fin, item absent) */
  function neutral(item, o) {
    const t = skillOf(getProfile(pid), (item && item.axis) || mainAxis).t;
    return { r: 0, correct: !!(o && o.correct), streak: okRun, fails: failRun, apples: 0, assistNext,
      thetaBefore: t, thetaAfter: t, hinted: false, wallet: walletNow(), ignored: true };
  }

  /* ---------- item suivant ---------- */
  function nextItem(axisOverride, opts) {
    if (closed || index >= total) return null;
    const p = getProfile(pid);
    if (!p) return null;
    const ax = axisOverride || mainAxis;
    const G = genFor(ax);
    if (!G || typeof G.gen !== 'function') throw new Error('Générateur non chargé pour ' + ax + ' (await loadGenerator)');
    const o = opts && typeof opts === 'object' ? opts : {};
    const b = targetB(skillOf(p, ax).t, off + adj);
    const A = absLevel(p.classe, b, today);
    let item = null, fromLeitner = false;
    /* 1) clé Leitner due (jamais juste après deux échecs : l'item suivant doit être plus facile) */
    if (!assistNext && o.leitner !== false && typeof G.fromKey === 'function' && LEITNER_AXES.includes(ax)) {
      const backlog = dueKeys(p, ax, today, Infinity).length;          /* arriéré complet (pas limité à 20) */
      const due = dueKeys(p, ax, today).filter(k => !seen.has(k));
      if (due.length && rngLeitner.chance(pLeitner(backlog, kind === 'revision'))) {
        for (const k of due) {
          let it = null;
          try { it = G.fromKey(k, A, rng); } catch (_) { it = null; }
          if (it && (!o.kind || it.kind === o.kind)) { item = it; fromLeitner = true; break; }
        }
      }
    }
    /* 2) générateur, en évitant les clés déjà vues dans la manche */
    if (!item) {
      const genOpts = { classe: p.classe, ...o, avoid: new Set([...seen, ...(o.avoid ? [...o.avoid] : [])]) };   /* classe : affinage du générateur */
      delete genOpts.leitner;
      for (let i = 0; i < TRIES; i++) {
        const it = G.gen(A, rng, genOpts);
        if (!it) continue;
        item = it;
        if (!it.key || !seen.has(it.key)) break;
      }
    }
    if (!item) return null;
    item = { ...item };                                /* copie : l'objet du générateur reste intact */
    if (!item.axis) item.axis = ax;
    if (fromLeitner) item.fromLeitner = true;
    item.b = relLevel(p.classe, isNum(item.A) ? item.A : A, today);
    item.assist = assistNext;
    assistNext = false;
    if (item.key) seen.add(item.key);
    index++;
    current = item;
    return item;
  }

  /* ---------- rapport d'un item ---------- */
  function report(item, outcome) {
    const o = outcome && typeof outcome === 'object' ? outcome : {};
    if (!item || typeof item !== 'object' || closed) return neutral(item, o);
    if (feedbacks.has(item)) return feedbacks.get(item);           /* double rapport : sans effet */
    if (!getProfile(pid)) return neutral(item, o);
    const fb = o.kind === 'race' ? raceReport(item, o) : itemReport(item, o);
    feedbacks.set(item, fb);
    if (item === current) current = null;
    return fb;
  }

  function itemReport(item, o) {
    tick(ITEM_CAP_MS);
    const ax = item.axis || mainAxis;
    const correct = !!o.correct;
    const hinted = !!o.hinted || (isNum(o.tries) && o.tries > 1) || !!item.assist || jokered.has(item);
    const r = scoreR(ax, item, { ...o, correct, hinted });
    const res = write(p => {
      const b = isNum(item.b) ? item.b
        : isNum(item.A) ? relLevel(p.classe, item.A, today) : targetB(skillOf(p, ax).t, off + adj);
      const th = applyResult(p, ax, b, r, today);
      if (item.leitner && item.key) review(p, item.key, correct && !hinted, today);
      if (correct) addApples(p, 1);
      return th;
    });
    const th = res.ok ? res.out : (t => ({ before: t, after: t }))(skillOf(getProfile(pid), ax).t);
    reports++;
    if (correct) { nCorrect++; apples++; }
    if (correct && !hinted) nClean++;
    if (hinted) nHinted++;
    if (r >= 0.8) {
      okRun++; failRun = 0;
      if (okRun % OKS_UP === 0) adj = clamp(adj + ADJ_UP, ADJ_MIN, ADJ_MAX);
    } else {
      failRun++; okRun = 0;
      if (failRun % FAILS_DOWN === 0) { adj = clamp(adj - ADJ_DOWN, ADJ_MIN, ADJ_MAX); assistNext = true; }
    }
    return { r, correct, streak: okRun, fails: failRun, apples: correct ? 1 : 0, assistNext,
      thetaBefore: th.before, thetaAfter: th.after, hinted, wallet: walletNow() };
  }

  /* course : { storyId, mclm, precision, stars, beatZip, ms, missed, textA, zip } (+ read facultatif) */
  function raceReport(item, o) {
    const t = tick(RACE_CAP_MS);
    const storyId = String(o.storyId || item.storyId || '');
    const stars = clamp(Math.round(Number(o.stars) || 0), 0, 3);
    const gained = stars * 10;
    const correct = stars >= 2;
    const res = write(p => {
      if (!p.wallet || typeof p.wallet !== 'object') p.wallet = { apples: 0, stars: {} };
      if (!p.wallet.stars || typeof p.wallet.stars !== 'object') p.wallet.stars = {};
      const prev = clamp(Math.round(Number(p.wallet.stars[storyId]) || 0), 0, 3);
      const best = Math.max(prev, stars);
      if (storyId) p.wallet.stars[storyId] = best;                  /* ⭐ : meilleur score, jamais perdu */
      if (gained) addApples(p, gained);
      if (isNum(o.mclm) && o.mclm > 0) {                            /* MCLM nul = micro muet : non retenu */
        if (!Array.isArray(p.mclm)) p.mclm = [];
        p.mclm.push({ d: today, t, s: storyId, v: Math.round(o.mclm),
          p: isNum(o.precision) ? Math.round(o.precision) : 0, z: isNum(o.zip) ? Math.round(o.zip) : 0 });
        if (p.mclm.length > MCLM_MAX) p.mclm.splice(0, p.mclm.length - MCLM_MAX);
      }
      const fl = applyFluence(p, { mclm: o.mclm, textA: isNum(o.textA) ? o.textA : item.A, classe: p.classe, today });
      /* Leitner : mots ratés (boîte 1) ; mots déjà suivis et bien lus cette fois → boîte suivante.
         w = forme affichable du mot (accents), pour la liste « mots à revoir » des parents. */
      const words = storyWords(p, storyId);
      const missed = uniqWords(o.missed);
      for (const w of missed.slice(0, MISSED_MAX)) {
        const e = review(p, 'fr.fluence:' + w, false, today);
        if (!e.w && words.has(w)) e.w = words.get(w);
      }
      const missedSet = new Set(missed);
      const read = Array.isArray(o.read) ? uniqWords(o.read) : [...words.keys()];
      for (const w of read) {
        const k = 'fr.fluence:' + w;
        if (!missedSet.has(w) && p.leitner && p.leitner[k]) review(p, k, true, today);
      }
      return { prev, best, fl };
    });
    const theta = skillOf(getProfile(pid), 'fr.fluence').t;
    const { prev = 0, best = stars, fl = { before: theta, after: theta, obs: null } } = res.ok ? res.out : {};
    reports++;
    if (correct) { nCorrect++; nClean++; }
    apples += gained;
    lastRace = { storyId, stars, best, newBest: best > prev, apples: gained,
      mclm: isNum(o.mclm) ? Math.round(o.mclm) : null, precision: isNum(o.precision) ? Math.round(o.precision) : null,
      beatZip: !!o.beatZip };
    return { r: null, correct, streak: okRun, fails: failRun, apples: gained, assistNext,
      thetaBefore: fl.before, thetaAfter: fl.after, obs: fl.obs, hinted: false,
      stars, best, newBest: best > prev, wallet: walletNow() };
  }

  /* mots du texte de l'histoire (templaté pour ce profil) : normalisé → forme affichable.
     Sans outcome.read, mots bien lus = texte − mots ratés (sémantique v11 : « ratés » = tous les
     mots non lus, y compris ceux que l'enfant n'a pas atteints). */
  function storyWords(p, storyId) {
    const G = genFor('fr.fluence');
    let story = null;
    try { story = G && typeof G.storyById === 'function' ? G.storyById(storyId) : null; } catch (_) { story = null; }
    if (!story || typeof story.text !== 'string') return new Map();
    let text = story.text;
    try { text = fillTemplate(text, p); } catch (_) {}
    return textWords(text);
  }

  /* ---------- jokers ---------- */
  function useHint(item) {
    if (closed) return false;
    const it = item || current;
    if (it && jokered.has(it)) return true;            /* déjà payé pour cet item */
    if (hints <= 0) return false;
    hints--;
    if (it) jokered.add(it);
    return true;
  }

  /* ---------- fin ---------- */
  function settle(finished, extra) {
    const s = {
      gameId, axis: mainAxis, mode, blockIdx: bIdx, n: reports, correct: nCorrect, clean: nClean, hinted: nHinted,
      apples, streakBonus: 0, streakCount: null, usedFreeze: false, dayBonus: 0,
      thetaBefore, thetaAfter: thetaBefore, ms: Math.round(activeMs), dayDone: false, aborted: !finished, race: lastRace
    };
    if (extra !== undefined) s.extra = extra;
    if (!reports) return s;                            /* aucune trace */
    const t = clock();
    write(p => {
      s.thetaAfter = skillOf(p, mainAxis).t;
      if (!Array.isArray(p.history)) p.history = [];
      p.history.push({ d: today, t, g: gameId, ax: mainAxis, n: reports, ok: nCorrect, hint: nHinted,
        ms: s.ms, th: round2(s.thetaAfter), mode, ...(kind ? { k: kind } : {}) });   /* k : type de bloc de balade */
      if (p.history.length > HISTORY_MAX) p.history.splice(0, p.history.length - HISTORY_MAX);
      /* tendance de l'axe : θ après cette manche − θ cinq manches plus tôt (au début : depuis la 1re) */
      const sk = p.skills && p.skills[mainAxis];
      if (sk && typeof sk === 'object') {
        const h = p.history.filter(e => e && e.ax === mainAxis && isNum(e.th));
        const ref = h.length > TREND_SPAN ? h[h.length - 1 - TREND_SPAN].th : h.length > 1 ? h[0].th : thetaBefore;
        sk.trend = round3(s.thetaAfter - ref);
      }
      /* temps d'apprentissage (stades du compagnon : minutes, jamais le score) */
      const min = activeMs / 60000;
      if (!p.stats || typeof p.stats !== 'object') p.stats = { minutes: 0, sessions: 0, items: 0 };
      p.stats.minutes = round2((Number(p.stats.minutes) || 0) + min);
      p.stats.items = (Math.trunc(Number(p.stats.items)) || 0) + reports;
      if (finished) p.stats.sessions = (Math.trunc(Number(p.stats.sessions)) || 0) + 1;
      if (p.companion && typeof p.companion === 'object') p.companion.minutes = round2((Number(p.companion.minutes) || 0) + min);
      if (finished) {
        /* série : bonus seulement à la première manche terminée du jour (bumpStreak crédite les 🍎) */
        const st = bumpStreak(p, today) || {};
        s.streakBonus = Math.max(0, Math.trunc(Number(st.bonus)) || 0);
        s.streakCount = isNum(st.count) ? st.count : null;
        s.usedFreeze = !!st.usedFreeze;
        /* balade : bloc validé, +10 🍎 quand les 4 blocs sont faits */
        const day = p.today;
        if (balade && bIdx !== null && day && day.d === today && Array.isArray(day.blocks) && day.blocks[bIdx]) {
          const wasDone = !!day.done;
          completeBlock(p, bIdx, { g: gameId, ax: mainAxis, n: reports, ok: nCorrect, hint: nHinted, ms: s.ms });
          if (day.done) { s.dayBonus = finishDay(p); s.dayDone = !wasDone; }
        }
      }
      snapshotIfNeeded(p, today);
    });
    return s;
  }
  function finish(extra) {
    if (closed) return summary;
    closed = true;
    summary = settle(true, extra);
    return summary;
  }
  /* quitter : progrès déjà enregistrés gardés (historique, minutes), ni série ni bloc validé */
  function abort() {
    if (closed) return summary;
    closed = true;
    summary = reports ? settle(false) : null;
    return summary;
  }

  return {
    gameId, axis: mainAxis, mode, blockIdx: bIdx, kind, count: total, offset: off, today, rng: gameRng,
    nextItem, report, useHint, finish, abort,
    get hintsLeft() { return hints; },
    get adj() { return adj; },
    get closed() { return closed; },
    get state() {
      return { index, count: total, reports, correct: nCorrect, clean: nClean, hinted: nHinted, apples, startedAt };
    }
  };
}
