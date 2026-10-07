/* ============ « EFFACER TOUTES LES DONNÉES DE CET APPAREIL » (v2.2.4, publication sur Google Play) ============
   Espace parents › Profils : un seul geste pour que Caramel ne laisse plus rien sur l'appareil (étude des stores, §5.2
   et liste §6 n° 24 : règlement « Familles » de Google Play, politique de confidentialité pages/confidentialite.html).
   Double confirmation (feuille « Tout effacer sur cet appareil ? » puis « Vraiment tout effacer ? »), jamais hors
   connexion (Caramel doit pouvoir se recharger : ses fichiers partent avec le reste).
   CE QUI EST EFFACÉ, pour Caramel seulement : l'origine (ancienne adresse cdelalande38.github.io, comme toute adresse en
   *.github.io) peut être PARTAGÉE avec les autres sites de
   projet du même compte GitHub (même localStorage, mêmes caches, mêmes bases) ; on ne vide donc jamais tout à l'aveugle :
     - localStorage et sessionStorage : les clés « caramel-… » (toutes les clés de Caramel portent ce préfixe : profils
       caramel-v3, anciennes sauvegardes v1/v11, code parent, préférences, journal de diagnostic…) ;
     - Cache Storage : caramel-* (l'appli versionnée, la voix enregistrée caramel-voix-v1), vosk-* (moteur et modèle du
       micro) et piper-tts-* (voix fluide) ;
     - IndexedDB : la base « /vosk » (modèle extrait par vosk-browser : IDB.name de js/core/speech.js) ;
     - le service worker dont la portée est celle de Caramel (réinstallé par main.js au rechargement).
   DÉROULÉ : wipeNow() efface tout ce qui peut l'être, pose WIPE_FLAG dans sessionStorage, puis reloadApp() recharge
   l'adresse de base (sans #/parents). Au démarrage suivant, main.js appelle finishWipe() AVANT store.init : la base
   « /vosk », que le worker de Vosk gardait ouverte (suppression « bloquée » tant que la page vivait), et ce que la page a
   pu réécrire en partant (journal de diagnostic au passage en arrière-plan, store en mémoire) sont effacés pour de bon.
   Pur (testé) : WIPE_FLAG, VOSK_DB, isCaramelKey, isCaramelCache, plan ; avec des globales simulées : wipeNow,
   finishWipe, pending. Interface : parentsCard({ backupFirst, say }). */
import { h, frTypo } from '../core/util.js';
import * as kit from './kit.js';
import * as audio from '../core/audio.js';

const G = globalThis;
export const WIPE_FLAG = 'caramel-wipe';          /* sessionStorage : ménage à finir au prochain démarrage */
export const VOSK_DB = '/vosk';                   /* = IDB.name de js/core/speech.js (vérifié par les tests) */
const DB_WAIT_MS = 1500;                          /* base bloquée par le worker de Vosk : on n'attend pas plus */
const FINISH_WAIT_MS = 4000;                      /* au démarrage, personne ne la tient : elle part vite */
const SIZE_LABEL = '93\u00A0Mo';                  /* voix fluide + moteur du micro (js/core/preload.js : BYTES) */

/* ---------- ce qui appartient à Caramel (pur) ---------- */
export const isCaramelKey = k => typeof k === 'string' && k.startsWith('caramel-');
export const isCaramelCache = n => typeof n === 'string' && (/^caramel-/.test(n) || /^vosk-/.test(n) || /^piper-tts-/.test(n));
/* portée de Caramel : le dossier de la page (https://…/caramel/) */
export function scopeOf(href) { try { return new URL('./', href).href; } catch (_) { return ''; } }
/* → { ls, ss, caches, regs } : clés, caches et enregistrements de service worker à supprimer */
export function plan({ lsKeys = [], ssKeys = [], cacheNames = [], regs = [], scope = '' } = {}) {
  return {
    ls: lsKeys.filter(isCaramelKey),
    ss: ssKeys.filter(isCaramelKey),
    caches: cacheNames.filter(isCaramelCache),
    regs: regs.filter(r => r && typeof r.scope === 'string' && !!scope && r.scope.startsWith(scope))
  };
}

/* ---------- accès au navigateur (tolérants : navigation privée, API absente) ---------- */
const storeOf = (g, name) => { try { return g[name] || null; } catch (_) { return null; } };
function keysOf(st) {
  const out = [];
  try { for (let i = 0; i < st.length; i++) { const k = st.key(i); if (k !== null) out.push(k); } } catch (_) {}
  return out;
}
function dropKeys(st, keys) {
  let n = 0;
  for (const k of keys) { try { st.removeItem(k); n++; } catch (_) {} }
  return n;
}
/* suppression d'une base → 'ok' | 'blocked' (ouverte ailleurs : elle partira quand on la lâchera) | 'error' | 'timeout' | 'none' */
function deleteDb(idb, name, ms, timer = setTimeout) {
  return new Promise(res => {
    let done = false;
    const fin = v => { if (!done) { done = true; res(v); } };
    if (!idb || typeof idb.deleteDatabase !== 'function') { fin('none'); return; }
    let r;
    try { r = idb.deleteDatabase(name); } catch (_) { fin('error'); return; }
    r.onsuccess = () => fin('ok');
    r.onerror = () => fin('error');
    r.onblocked = () => fin('blocked');
    timer(() => fin('timeout'), ms);
  });
}

/* efface tout ce qui peut l'être maintenant, pose WIPE_FLAG → bilan { ls, ss, caches, db, sw } */
export async function wipeNow(g = G, { timer = setTimeout } = {}) {
  const ls = storeOf(g, 'localStorage'), ss = storeOf(g, 'sessionStorage');
  const nav = g.navigator || {};
  const sw = nav.serviceWorker && typeof nav.serviceWorker.getRegistrations === 'function' ? nav.serviceWorker : null;
  let cacheNames = [], regs = [];
  try { if (g.caches) cacheNames = await g.caches.keys(); } catch (_) {}
  try { if (sw) regs = await sw.getRegistrations(); } catch (_) {}
  const p = plan({ lsKeys: ls ? keysOf(ls) : [], ssKeys: ss ? keysOf(ss) : [], cacheNames, regs, scope: scopeOf(g.location && g.location.href) });
  const out = { ls: ls ? dropKeys(ls, p.ls) : 0, ss: ss ? dropKeys(ss, p.ss) : 0, caches: 0, db: 'none', sw: 0 };
  for (const n of p.caches) { try { if (await g.caches.delete(n)) out.caches++; } catch (_) {} }
  for (const r of p.regs) { try { if (await r.unregister()) out.sw++; } catch (_) {} }
  out.db = await deleteDb(storeOf(g, 'indexedDB'), VOSK_DB, DB_WAIT_MS, timer);
  /* en dernier : le ménage reprendra au démarrage (ce que la page réécrit en partant, base encore tenue) */
  try { if (ss) ss.setItem(WIPE_FLAG, '1'); } catch (_) {}
  return out;
}

export function pending(g = G) {
  try { const ss = storeOf(g, 'sessionStorage'); return !!(ss && ss.getItem(WIPE_FLAG)); } catch (_) { return false; }
}
/* au démarrage (main.js, avant store.init) : retire le drapeau, les clés réécrites et la base « /vosk » → bilan */
export async function finishWipe(g = G, { timer = setTimeout } = {}) {
  const ls = storeOf(g, 'localStorage'), ss = storeOf(g, 'sessionStorage');
  const out = {
    ls: ls ? dropKeys(ls, keysOf(ls).filter(isCaramelKey)) : 0,
    ss: ss ? dropKeys(ss, keysOf(ss).filter(isCaramelKey)) : 0,
    db: await deleteDb(storeOf(g, 'indexedDB'), VOSK_DB, FINISH_WAIT_MS, timer)
  };
  return out;
}

/* adresse de base, sans #/parents : l'appli repart de zéro (création d'un enfant) */
export function reloadApp(g = G) {
  try { g.location.replace(scopeOf(g.location.href)); } catch (_) { try { g.location.reload(); } catch (__) {} }
}

/* ---------- interface : carte de la rubrique « Profils » de l'espace parents (vouvoiement) ---------- */
const offline = () => { try { return G.navigator && G.navigator.onLine === false; } catch (_) { return false; } };

export function parentsCard({ backupFirst = null, say = () => {} } = {}) {
  const btn = h('button', { type: 'button', class: 'btn white block pa-wipe-btn', 'data-fk': 'wipe-all' },
    h('span', { class: 'pa-lbl' }, h('span', { class: 'pa-lbl-emo', 'aria-hidden': 'true' }, '🗑️\u00A0'), 'Effacer toutes les données de cet appareil'));
  btn.addEventListener('click', () => { try { audio.tap(); } catch (_) {} askFirst({ backupFirst, say }); });
  return h('div', { class: 'card pa-card pa-wipe' },
    h('p', { class: 'pa-note' }, frTypo('Tout ce que Caramel garde ici : profils, progrès, réglages, code parent, voix et moteur vocal téléchargés. Rien n’est gardé ailleurs.')),
    btn);
}

/* 1re confirmation : ce qui part, la sauvegarde d'abord */
function askFirst({ backupFirst, say }) {
  if (offline()) {
    kit.sheet({ title: frTypo('Pas de connexion Internet'), actions: [{ label: 'J’ai compris', kind: 'white' }],
      content: h('p', { class: 'pa-sheet-p' }, frTypo('Après l’effacement, Caramel se recharge depuis Internet. Reconnectez-vous, puis réessayez.')) });
    return;
  }
  const list = h('ul', { class: 'pa-wipe-list' },
    h('li', null, frTypo('les profils de tous les enfants : prénoms, compagnons, progrès, évaluations ;')),
    h('li', null, frTypo('les réglages et le code parent ;')),
    h('li', null, frTypo('la voix et le moteur vocal téléchargés (environ ' + SIZE_LABEL + ').')));
  const content = h('div', { class: 'pa-wipe-sheet' },
    h('p', { class: 'pa-sheet-p' }, frTypo('Caramel va effacer de cet appareil :')), list,
    h('p', { class: 'pa-sheet-p' }, frTypo('Puis Caramel redémarrera comme au premier jour. C’est définitif : pensez à télécharger une sauvegarde avant.')),
    typeof backupFirst === 'function'
      ? h('button', { type: 'button', class: 'btn white small', on: { click: () => { try { audio.tap(); } catch (_) {} backupFirst(); } } },
        h('span', { class: 'pa-lbl' }, h('span', { class: 'pa-lbl-emo', 'aria-hidden': 'true' }, '⬇️\u00A0'), 'Télécharger d’abord une sauvegarde'))
      : null);
  kit.sheet({
    title: frTypo('Tout effacer sur cet appareil ?'), content,
    actions: [
      { label: 'Annuler', kind: 'white' },
      { label: 'Continuer', kind: 'pink', onClick: () => { setTimeout(() => askAgain({ say }), 260); return true; } }
    ]
  });
}

/* 2e confirmation, puis effacement et rechargement */
function askAgain({ say }) {
  let busy = false;
  const msg = h('p', { class: 'pa-sheet-p', 'aria-live': 'polite' }, frTypo('Dernière vérification : sans sauvegarde, rien ne pourra être récupéré.'));
  kit.sheet({
    title: frTypo('Vraiment tout effacer ?'), content: msg, center: true,
    actions: [
      { label: 'Annuler', kind: 'white', onClick: () => !busy },
      { label: 'Oui, tout effacer', kind: 'pink', onClick: () => {
        if (busy) return false;
        busy = true;
        msg.textContent = frTypo('Effacement en cours…');
        try { say('Effacement en cours'); } catch (_) {}
        wipeNow().catch(() => null).then(() => reloadApp());
        return false;                         /* la feuille reste jusqu'au rechargement */
      } }
    ]
  });
}
