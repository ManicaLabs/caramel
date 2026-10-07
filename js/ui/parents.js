/* ============ ESPACE PARENTS (JEUX.md §8 ; CDC §8, §9, §12) ============
   PORTE — réglage d'APPAREIL, clé localStorage 'caramel-parent' (jamais exportée dans les sauvegardes) :
   - code parent à 4 chiffres, facultatif, haché (SHA-256 salé : crypto.subtle, ou le même calcul en JavaScript
     hors https) — jamais stocké en clair ; saisie masquée (••••), jamais lue à voix haute ;
   - sans code : racine carrée d'un carré de 32² à 99² (notion de 4e : hors de portée d'un CM2, qui pose pourtant
     2 chiffres × 1 chiffre sans peine ; nouveau calcul après chaque erreur). Seul « √ 9 801 = ? » s'affiche : ni le nom
     de l'opération, ni la calculatrice (l'adulte reconnaît √ et prend la sienne sans y être invité ; l'écran ne
     dit pas à l'enfant comment entrer). Le nom n'est donné qu'aux lecteurs d'écran (« Racine carrée de 9 801 ? ») ;
   - « Code oublié ? » : la même racine carrée, puis un nouveau code obligatoire ;
   - 3 erreurs de suite → attente de 30 s (doublée à chaque nouvelle série, 8 min au plus), mémorisée sur l'appareil ;
   - ouverte 10 minutes glissantes (sessionStorage 'caramel-parents-until', prolongée à chaque geste), refermée dès
     qu'on revient côté enfant (démontage de l'écran, sauf vers l'import de fiche lancé d'ici, qui y revient) et par 🔒.
   INVITATIONS (une seule à la fois, à l'entrée) : code parent (« Plus tard » : 30 jours), sinon rappels quotidiens
   (celle de l'accueil de l'enfant, déplacée ici ; « Plus tard » : préférence 'caramel-notifs').
   Un redessin (réglage, feuille refermée, profil changé) rend le focus clavier à l'élément équivalent (data-fk).
   CONTENU, pour le profil choisi (pastilles) :
   - « En bref » : où en est l'enfant (semaine, en progrès, à travailler, lecture à voix haute) et quoi faire (« à revoir
     ensemble ») — lisible en 30 s ; profil neuf : comment démarrer (import de la fiche) au lieu de radars vides ;
   - depuis le début (temps, parties, série, dernière séance) ;
   - radars avec valeurs (libellés officiels, fiche en pointillés), échelle ⊕ / ⊕⊕ / ⊕⊕⊕ de la fiche avec l'attendu de
     la classe (⊕⊕ = 2), curseur des semaines (snapshots) ; détail par compétence (replié : un clic pour l'ouvrir) ;
     courbe de lecture (MCLM) ;
   - « à revoir » (Leitner : boîte 1, et boîte 2 si déjà manqué) : tables, conjugaison, mots de lecture ;
   - évaluations importées + import (photo / saisie / fichier → #/import) ;
   - réglages : pour l'enfant (mutateProfile : thème, durée, chrono, sons, animations, soustraction, classe, prénom,
     accords ; lecture des consignes à voix haute masquée jusqu'à la 2.2, cf. READ_ALOUD_READY) et sur cet appareil
     (code parent, rappels) ;
   - sauvegardes (backup.js ; date de la dernière sauvegarde téléchargée d'ici) ; profils ; à propos (version,
     confidentialité exacte, auteur et retours) et, v2.2.2, « État de cet appareil » (js/ui/diag.js : version, navigateur
     et système, installé ou non, son, voix enregistrée, voix du téléphone, micro, reconnaissance, WebAssembly, stockage,
     ✓ / ✗, pour une capture à envoyer) ;
   - v2.2.2 : « Sur cet appareil » › « Écran d'accueil » (js/ui/install.js : état, vrai bouton « Installer » ou marche
     à suivre sur iPhone et iPad) ; « Lire les consignes à voix haute » : Oui (défaut, tous les enfants) / Non.
   Toute écriture du profil passe par store.mutateProfile / store.mutate. Rien n'est jamais affiché à l'enfant ici. */

import { h, svg, clear, loadCSS, dayStr, daysBetween, parseDay, fmtNum, frTypo, weekKey, deNom, sha256Hex } from '../core/util.js';
import * as store from '../core/store.js';
import * as router from '../router.js';
import { radarTemplate, AXES, CLASSES, SUBJECTS } from '../core/axes.js';
import { currentValues, referenceValues, inProgress } from '../core/radar-model.js';
import { mclmExpected, mclmTarget } from '../core/levels.js';
import { weakKeys } from '../core/leitner.js';
import { setClasse, offerNextClasse, sanitizeName, SESSION_MINUTES, fillTemplate, markSeen } from '../core/profiles.js';
import { totalStars } from '../core/economy.js';
import { GAMES } from '../games/index.js';
import { MOUNTS } from '../content/companion-data.js';
import * as notifs from '../core/notifs.js';
import * as kit from './kit.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import { renderRadar, radarReady, fmtTheta, levelMarks } from './radar.js';
import * as backup from './backup.js';
import { normalizeTheme, themeOf } from '../core/themes.js';
import { themeGrid, swapTheme } from './theme-picker.js';
import { mountReady, avatarOf, setAvatar } from './companion.js';
import * as voice from './voice.js';
import { parentsRow as installRow } from './install.js';
import { parentsRow as fluidRow } from './voice-fluid.js';
import { diagCard } from './diag.js';

/* crédits et retours (v11.1, déplacés de l'accueil de l'enfant : un adulte seulement sort vers LinkedIn) */
const LINKEDIN_PROFILE = 'https://www.linkedin.com/in/cedric-delalande-57bb7860/';
const FEEDBACK_URL = 'https://www.linkedin.com/posts/cedric-delalande-57bb7860_ia-edtech-aezducation-share-7485434729584902144-3tnJ/';

/* ============ RÉGLAGES D'APPAREIL : code parent, essais, dates des sauvegardes ============
   { v: 1, pin: { h, s } | null, fails, strikes, until, later, saved: { [idProfil]: { at: ISO, name } } }
   h = SHA-256(s + ':' + code) en hexadécimal, s = sel aléatoire ; until = fin de l'attente (ms) ;
   later = jour où « Plus tard » a été choisi pour l'invitation au code ; saved = dernière sauvegarde téléchargée d'ici,
   tenue par backup.js (noteSaved, lastSaved, forgetSaved) : ici, on la relit et on la réécrit telle quelle. */
export const PARENT_KEY = 'caramel-parent';
export const PIN_LEN = 4;
export const LOCK_TRIES = 3;
export const LOCK_MS = 30 * 1000;
export const LOCK_MAX_MS = 8 * 60 * 1000;
const NUDGE_DAYS = 30;
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const defaultLS = () => { try { return globalThis.localStorage || null; } catch (_) { return null; } };

export function readPrefs(st = defaultLS()) {
  let raw = null;
  try { raw = st ? JSON.parse(st.getItem(PARENT_KEY) || 'null') : null; } catch (_) { raw = null; }
  const o = isObj(raw) ? raw : {};
  const pin = isObj(o.pin) && typeof o.pin.h === 'string' && /^[0-9a-f]{64}$/.test(o.pin.h) && typeof o.pin.s === 'string' ? { h: o.pin.h, s: o.pin.s } : null;
  const n = (v, d = 0) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
  const saved = {};
  if (isObj(o.saved)) for (const [k, v] of Object.entries(o.saved)) if (isObj(v) && typeof v.at === 'string' && v.at) saved[k] = { at: v.at, name: typeof v.name === 'string' ? v.name : '' };
  return { v: 1, pin, fails: Math.floor(n(o.fails)), strikes: Math.floor(n(o.strikes)), until: n(o.until), later: typeof o.later === 'string' ? o.later : '', saved };
}
/* → true si l'écriture a réussi */
export function writePrefs(prefs, st = defaultLS()) {
  try { if (!st) return false; st.setItem(PARENT_KEY, JSON.stringify(prefs)); return true; } catch (_) { return false; }
}
function newSalt() {
  const b = new Uint8Array(16);
  try { globalThis.crypto.getRandomValues(b); } catch (_) { for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256); }
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}
export const validCode = code => typeof code === 'string' && new RegExp('^\\d{' + PIN_LEN + '}$').test(code);
export function hashCode(code, salt) { return sha256Hex(String(salt) + ':' + String(code)); }
/* choisit (ou change) le code → true s'il est bien enregistré sur l'appareil */
export async function setCode(code, st = defaultLS()) {
  if (!validCode(code)) return false;
  const s = newSalt();
  const hsh = await hashCode(code, s);
  const prefs = readPrefs(st);
  prefs.pin = { h: hsh, s };
  prefs.fails = 0; prefs.strikes = 0; prefs.until = 0;
  return writePrefs(prefs, st) && !!readPrefs(st).pin && readPrefs(st).pin.h === hsh;
}
export function clearCode(st = defaultLS()) {
  const prefs = readPrefs(st);
  prefs.pin = null;
  return writePrefs(prefs, st);
}
export async function checkCode(code, st = defaultLS()) {
  const prefs = readPrefs(st);
  if (!prefs.pin || !validCode(code)) return false;
  return (await hashCode(code, prefs.pin.s)) === prefs.pin.h;
}
/* attente restante (ms) après trop d'erreurs */
export function lockLeft(prefs, now = Date.now()) { return Math.max(0, (Number(prefs && prefs.until) || 0) - now); }
/* une erreur de plus → { prefs, locked } ; la 3e erreur de suite déclenche l'attente (30 s, puis 60 s, 120 s…) */
export function noteFail(prefs, now = Date.now()) {
  const p = { ...prefs };
  p.fails = (p.fails || 0) + 1;
  let locked = false;
  if (p.fails >= LOCK_TRIES) {
    p.until = now + Math.min(LOCK_MAX_MS, LOCK_MS * Math.pow(2, p.strikes || 0));
    p.strikes = (p.strikes || 0) + 1;
    p.fails = 0;
    locked = true;
  }
  return { prefs: p, locked };
}
export function noteSuccess(prefs) { return { ...prefs, fails: 0, strikes: 0, until: 0 }; }
/* racine carrée d'un carré parfait : n de 32 à 99, ni multiple de 5 (trop faciles), différent du précédent */
export function newChallenge(rng = Math.random, prev = null) {
  let n;
  do { n = 32 + Math.floor(rng() * 68); } while (n % 5 === 0 || (prev && prev.answer === n));
  return { square: n * n, answer: n };
}

/* ---------- porte : ouverture pour 10 minutes glissantes ---------- */
const GATE_KEY = 'caramel-parents-until';
const GATE_MS = 10 * 60 * 1000;
let memUntil = 0;                       /* repli si sessionStorage est indisponible */
/* sessionStorage fait foi quand il est lisible ; la mémoire ne sert que de repli (navigation privée stricte…) */
function gateUntil() {
  try {
    const ss = globalThis.sessionStorage;
    if (ss) { const raw = ss.getItem(GATE_KEY); return raw === null ? 0 : Number(raw) || 0; }
  } catch (_) {}
  return memUntil;
}
export function gateOpen() { return gateUntil() > Date.now(); }
export function gateRefresh() {
  memUntil = Date.now() + GATE_MS;
  try { globalThis.sessionStorage.setItem(GATE_KEY, String(memUntil)); } catch (_) {}
}
function gateClose() {
  memUntil = 0;
  try { globalThis.sessionStorage.removeItem(GATE_KEY); } catch (_) {}
}

/* ---------- état de l'écran ---------- */
let host = null;                        /* conteneur de l'écran (vue du routeur) */
let sel = null;                         /* id du profil affiché */
let cleanups = [];                      /* radars, pavé, observateurs, minuteries */
let live = null;                        /* zone aria-live de l'écran */
const later = fn => { const t = setTimeout(fn, 0); cleanups.push(() => clearTimeout(t)); };
function cleanup() {
  for (const fn of cleanups.splice(0)) { try { fn(); } catch (_) {} }
}
function say(msg) { if (live) { live.textContent = ''; setTimeout(() => { if (live) live.textContent = msg; }, 30); } }
function saved(msg = 'Enregistré ✓') { try { kit.toast(msg, 1600); } catch (_) {} say(msg); }
/* confirmation d'un réglage, seulement si l'écriture a réellement réussi (stockage plein ou bloqué : on le dit) */
function done(msg = 'Enregistré ✓') {
  if (store.storageOk()) { saved(msg); return; }
  const t = frTypo('Modifié pour cette fois, mais pas enregistré : la mémoire de l’appareil est pleine ou bloquée.');
  try { audio.soft(); } catch (_) {}
  try { kit.toast(t, 3200); } catch (_) {}
  say(t);
}

/* ---------- formats ---------- */
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_S = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const PERSONS = { '1s': 'je', '2s': 'tu', '3s': 'il', '1p': 'nous', '2p': 'vous', '3p': 'ils' };
const TENSES = { present: 'présent', imparfait: 'imparfait', futur: 'futur', passe_compose: 'passé composé',
  passe_simple: 'passé simple', plus_que_parfait: 'plus-que-parfait' };
const plural = (n, one, many) => fmtNum(n) + '\u00A0' + (n > 1 ? many : one);
const isNum = v => typeof v === 'number' && Number.isFinite(v);

function relDay(d, today) {
  if (!d) return 'jamais';
  const n = daysBetween(d, today);
  if (!Number.isFinite(n)) return 'jamais';
  if (n <= 0) return 'aujourd’hui';
  if (n === 1) return 'hier';
  if (n < 7) return 'il y a ' + n + '\u00A0jours';
  if (n < 14) return 'il y a 1\u00A0semaine';
  if (n < 31) return 'il y a ' + Math.floor(n / 7) + '\u00A0semaines';
  if (n < 60) return 'il y a 1\u00A0mois';
  return 'il y a ' + Math.floor(n / 30) + '\u00A0mois';
}
const longDate = d => { const x = parseDay(d); return (x.getDate() === 1 ? '1er' : x.getDate()) + '\u00A0' + MONTHS[x.getMonth()] + '\u00A0' + x.getFullYear(); };
function monthLabel(ym) {
  const m = /^(\d{4})-(\d{2})/.exec(String(ym || ''));
  return m ? MONTHS[Number(m[2]) - 1] + '\u00A0' + m[1] : '';
}
function duration(min) {
  const m = Math.round(Number(min) || 0);
  if (m < 60) return m + '\u00A0min';
  const hh = Math.floor(m / 60), mm = m % 60;
  return hh + '\u00A0h' + (mm ? '\u00A0' + String(mm).padStart(2, '0') : '');
}
/* libellés lisibles des clés Leitner, fournis par les générateurs (chargés à l'ouverture de l'écran) :
   faits.describeKey('ma.faits:7x8') → « 7 × 8 = 56 » ; conjug.keyLabel(…) → « prendre · présent · ils prennent » */
let describeFact = null, describeConj = null;
let labelsAsked = null;
function loadKeyLabels() {
  if (labelsAsked) return labelsAsked;
  labelsAsked = Promise.all([
    import('../content/maths/faits.js').then(m => { describeFact = typeof m.describeKey === 'function' ? m.describeKey : null; }).catch(() => {}),
    import('../content/fr/conjug.js').then(m => { describeConj = typeof m.keyLabel === 'function' ? m.keyLabel : null; }).catch(() => {})
  ]);
  return labelsAsked;
}
function factLabel(key) {
  try {
    const s = describeFact ? describeFact(key) : '';
    if (s && !/^ma\.faits:/.test(s)) return s;
  } catch (_) {}
  const c = String(key).replace(/^ma\.faits:/, '');
  let m;
  if ((m = /^(\d+)x(\d+)$/.exec(c))) return m[1] + '\u00A0×\u00A0' + m[2];
  if ((m = /^add:(\d+)\+(\d+)$/.exec(c))) return m[1] + '\u00A0+\u00A0' + m[2];
  if ((m = /^sub:(\d+)-(\d+)$/.exec(c))) return m[1] + '\u00A0−\u00A0' + m[2];
  if ((m = /^div:(\d+)[:/÷](\d+)$/.exec(c))) return m[1] + '\u00A0÷\u00A0' + m[2];
  if ((m = /^(?:double|dbl):(\d+)$/.exec(c))) return 'double de ' + m[1];
  if ((m = /^(?:moitie|half):(\d+)$/.exec(c))) return 'moitié de ' + m[1];
  if ((m = /^[a-z]+:(.+)$/.exec(c))) return m[1].replace(/x/g, '\u00A0×\u00A0').replace(/\+/g, '\u00A0+\u00A0').replace(/-/g, '\u00A0−\u00A0').replace(/\//g, '\u00A0÷\u00A0');
  return c.replace(/(\d)x(\d)/g, '$1\u00A0×\u00A0$2');
}
function conjLabel(key) {
  try {
    const s = describeConj ? describeConj(key) : '';
    if (s) return s;
  } catch (_) {}
  const [verb, tense, person] = String(key).replace(/^fr\.conjug:/, '').split('|');
  return [verb, TENSES[tense] || (tense || '').replace(/_/g, ' '), PERSONS[person] || person].filter(Boolean).join(' · ');
}
function wordLabel(p, key) {
  const e = p.leitner && p.leitner[key];
  return (e && typeof e.w === 'string' && e.w) || String(key).replace(/^fr\.fluence:/, '');
}

/* jeu qui entraîne un axe (principal d'abord, puis secondaire) */
function gameOf(axis) {
  return GAMES.find(g => g.primary === axis) || GAMES.find(g => (g.axes || []).includes(axis)) || null;
}
const TRAINED = new Set(GAMES.flatMap(g => g.axes || []));
/* réponses observées dans les jeux (sans le poids d'initialisation d'une fiche ou de l'estimation v11) */
function obsCount(sk) {
  if (!sk || typeof sk !== 'object') return 0;
  const init = sk.src === 'eval' ? 4 : sk.src === 'v11' ? 1 : 0;
  return Math.max(0, (Number(sk.n) || 0) - init);
}
/* lectures chronométrées de la course (mots lus par minute) : gardées même quand l'historique, plafonné, a oublié la partie */
const readings = p => (Array.isArray(p.mclm) ? p.mclm : []).filter(e => e && typeof e.d === 'string' && Number(e.v) > 0);
/* compétence réellement jouée : une partie dans l'historique, une lecture chronométrée (« Lire à voix haute »), ou des
   réponses observées (même règle que les médailles de Mes progrès : une nouvelle fiche importée remet n à 4 sans
   effacer ce que l'enfant a joué) */
export function playedAxis(p, axis) {
  return obsCount(p.skills && p.skills[axis]) > 0 || (Array.isArray(p.history) && p.history.some(e => e && e.ax === axis))
    || (axis === 'fr.fluence' && readings(p).length > 0);
}
/* réponses données dans les jeux : celles observées depuis la dernière fiche, ou celles des parties de l'historique
   (une lecture de la course = une réponse) si elles sont plus nombreuses : une nouvelle fiche remet le compte des
   réponses observées à zéro */
export function answerCount(p, axis) {
  let fromHistory = 0;
  for (const e of Array.isArray(p.history) ? p.history : []) if (e && e.ax === axis) fromHistory += Math.max(0, Math.round(Number(e.n) || 0));
  if (axis === 'fr.fluence') fromHistory = Math.max(fromHistory, readings(p).length);
  return Math.max(obsCount(p.skills && p.skills[axis]), fromHistory);
}
function lastPlayed(p, axis) {
  /* le plus récent : partie de l'historique, lecture chronométrée, ou dernière réponse observée depuis la fiche */
  let last = '';
  const seen = d => { if (typeof d === 'string' && d.slice(0, 10) > last) last = d.slice(0, 10); };
  for (const e of Array.isArray(p.history) ? p.history : []) if (e && e.ax === axis) seen(e.d);
  if (axis === 'fr.fluence') for (const e of readings(p)) seen(e.d);
  const sk = p.skills && p.skills[axis];
  if (sk && obsCount(sk) > 0) seen(sk.last);
  return last;
}
/* libellé d'un axe dans un gabarit (officiel au CM2) ; « Comprendre un texte » de la rubrique ORAL : « (à l'oral) » */
function axisLabel(a) {
  const def = AXES[a.id];
  let lbl = a.label || (def ? def.label : a.id);
  if (a.domain === 'ORAL' && !/entend|oral/i.test(lbl)) lbl += ' (à\u00A0l’oral)';
  return lbl;
}
/* « valeur absente sur la fiche » (null dans la référence) */
const isAbsence = (ref, id) => !!ref && Object.prototype.hasOwnProperty.call(ref, id) && ref[id] === null;
/* compagnon dessiné (portrait rond, sans vie : petites vignettes) ; l'emoji reste en attendant le dessin */
function petInto(el, p, size) {
  mountReady().then(() => {
    if (!el.isConnected) return;
    try { setAvatar(el, avatarOf(p, size, '', { view: 'portrait', expr: 'happy' }), { live: false }); } catch (_) {}
  }).catch(() => {});
  return el;
}
function petEl(p, cls, size) {
  const m = MOUNTS[p && p.companion && p.companion.type] || MOUNTS.pony;
  return petInto(h('span', { class: cls, 'aria-hidden': 'true' }, m.em), p, size);
}

/* ============ PORTE ============ */
/* Entrée sur un bouton de la porte : l'activation native du bouton, jamais la validation du pavé du calcul
   (kit.keypad écoute Entrée sur tout le document et l'avale, même quand le focus est sur un autre bouton) */
function ownEnter(b) {
  b.addEventListener('keydown', e => { if (e.key === 'Enter') e.stopPropagation(); });
  return b;
}
function backBtn() {
  return h('button', { type: 'button', class: 'back', 'aria-label': 'Retour à l’accueil', on: { click: () => { audio.tap(); router.back(); } } }, '←');
}
/* saisie du code, sans DOM : validation automatique au 4e chiffre, après une courte pause (le 4e rond a le temps de
   s'afficher). Les chiffres tapés pendant cette pause (ou pendant le « non » d'une confirmation ratée) ne sont jamais
   perdus : ils attendent en file et commencent la saisie suivante (confirmation du code) dès clear().
   → { press(k), clear(), value(), setOff(b) } ; onChange(longueur) après chaque changement visible */
export function pinEntry({ onComplete, onChange, len = PIN_LEN, wait = 140, timer = setTimeout } = {}) {
  let raw = '', off = false, pending = false;
  const queued = [];
  const changed = () => { if (typeof onChange === 'function') onChange(raw.length); };
  const api = {
    press(k) {
      if (off) return false;
      if (pending) {                              /* code complet, en cours de validation : on garde les chiffres */
        if (/^\d$/.test(k) && queued.length < len) { queued.push(k); return true; }
        return false;
      }
      if (k === 'del') raw = raw.slice(0, -1);
      else if (/^\d$/.test(k) && raw.length < len) raw += k;
      else return false;
      changed();
      if (raw.length === len) {
        pending = true;
        const code = raw;
        timer(() => { if (typeof onComplete === 'function') onComplete(code); }, wait);
      }
      return true;
    },
    /* saisie vidée (nouvel essai, confirmation) : les chiffres en attente y entrent aussitôt */
    clear() {
      raw = ''; pending = false;
      changed();
      for (const k of queued.splice(0)) api.press(k);
    },
    value: () => raw,
    setOff(b) { off = !!b; }
  };
  return api;
}
/* pavé du code : 4 ronds (jamais les chiffres), écho « 2 chiffres sur 4 » pour les lecteurs d'écran, validation
   automatique au 4e chiffre (pinEntry). Pavé propre (et non kit.keypad, qui saisit un NOMBRE : « 0123 » y deviendrait
   « 123 »), mêmes touches et mêmes styles ; clavier physique : chiffres, Retour arrière.
   → { dots, keys, clear(), wrong(), disable(b), destroy() } */
function pinPad({ onComplete } = {}) {
  const marks = Array.from({ length: PIN_LEN }, () => h('span', { class: 'pa-pin-dot' }));
  const dots = h('div', { class: 'pa-pin-dots', 'aria-hidden': 'true' }, marks);
  const echo = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  let off = false;
  const key = (k, label, aria) => h('button', { type: 'button', class: 'key' + (k === 'del' ? ' del' : ''), 'data-k': k, 'aria-label': aria || null }, label);
  const keyEls = {};
  const grid = h('div', { class: 'keypad kit-keys pa-pin-keys' },
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (keyEls[d] = key(d, d))),
    h('span', { class: 'kit-key-gap', 'aria-hidden': 'true' }),
    (keyEls['0'] = key('0', '0')), (keyEls.del = key('del', '⌫', 'Effacer')));
  const show = n => {
    marks.forEach((d, i) => d.classList.toggle('on', i < n));
    echo.textContent = n ? plural(n, 'chiffre saisi', 'chiffres saisis') + ' sur ' + PIN_LEN : '';
  };
  const entry = pinEntry({ onComplete, onChange: show });
  const press = k => entry.press(k);
  const flash = k => { const b = keyEls[k]; if (!b) return; b.classList.add('is-pressed'); setTimeout(() => b.classList.remove('is-pressed'), 110); };
  grid.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.key');
    if (!b || !grid.contains(b) || b.disabled) return;
    audio.tap();
    press(b.dataset.k);
  });
  /* clavier physique, seulement si aucune feuille ne recouvre le pavé (la plus haute capte le clavier) */
  const onKey = e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || off || !grid.isConnected) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
    const all = globalThis.document.querySelectorAll('.overlay');
    const top = all[all.length - 1];
    if (top && !top.contains(grid)) return;
    const k = e.key === 'Backspace' || e.key === 'Delete' ? 'del' : e.key;
    if (!/^(\d|del)$/.test(k)) return;
    e.preventDefault();
    audio.tap();
    flash(k);
    press(k);
  };
  globalThis.document.addEventListener('keydown', onKey);
  const api = {
    dots: h('div', { class: 'pa-pin' }, dots, echo), keys: grid,
    clear() { entry.clear(); },
    wrong() {
      motion.shake(dots, { dist: 7 });
      try { audio.soft(); } catch (_) {}
      dots.classList.add('is-wrong');
      setTimeout(() => { dots.classList.remove('is-wrong'); api.clear(); }, 520);
    },
    disable(b) { off = !!b; entry.setOff(off); Object.values(keyEls).forEach(x => { x.disabled = off; }); },
    destroy() { globalThis.document.removeEventListener('keydown', onKey); }
  };
  return api;
}

/* écran de la porte. mode : 'code' (code parent) · 'calc' (racine carrée, pas de code) · 'forgot' (code oublié :
   racine carrée) · 'new' (nouveau code obligatoire après « code oublié ») ; refocus : on vient de « Code oublié ? » ou de
   « Revenir au code » → le focus clavier reste sur ce bouton du pied de la porte (même place, mode suivant) */
function renderGate(mode, refocus = false) {
  if (!host) return;                    /* écran démonté (rappel tardif d'une feuille, d'une minuterie) */
  lastFk = null;
  cleanup();
  clear(host);
  const prefs0 = readPrefs();
  if (!mode || (mode === 'code' && !prefs0.pin)) mode = prefs0.pin ? 'code' : 'calc';
  const ask = h('p', { class: 'pa-gate-ask' });
  const zone = h('div', { class: 'pa-gate-zone' });
  const note = h('p', { class: 'pa-gate-note', role: 'status', 'aria-live': 'polite' });
  const wait = h('p', { class: 'pa-gate-wait', 'aria-hidden': 'true', hidden: true });
  const foot = h('div', { class: 'pa-gate-foot' });
  const pad = h('div', { class: 'pa-gate-pad' });
  const card = h('div', { class: 'pa-gate-card card' },
    h('div', { class: 'pa-gate-lock', 'aria-hidden': 'true' }, '🔒'),
    h('p', { class: 'pa-gate-lead' }, frTypo(mode === 'new' ? 'Nouveau code parent' : 'Espace réservé aux adultes.')),
    ask, zone, note, wait);
  const box = h('div', { class: 'screen pa-gate' },
    h('div', { class: 'topbar' }, ownEnter(backBtn()), h('h1', { class: 'topbar-title' }, 'Espace parents'), h('span', { class: 'pa-gap', 'aria-hidden': 'true' })),
    card, foot, pad);
  host.appendChild(box);
  motion.enter(card, { from: 'scale' });

  const enter = msg => {
    writePrefs(noteSuccess(readPrefs()));
    audio.success(4);
    gateRefresh();
    setTimeout(() => {
      if (!host) return;
      renderContent({ entering: true, nudge: !readPrefs().pin });
      if (msg) saved(msg);
    }, motion.reduced() ? 60 : 380);
  };
  /* attente après trop d'erreurs : pavé désactivé, compte à rebours visible (annoncé une fois au début et à la fin) */
  let ctl = null, lockTimer = 0;
  const lockIfNeeded = () => {
    const left = lockLeft(readPrefs());
    if (left <= 0) return false;
    if (ctl) ctl.disable(true);
    if (lockTimer) return true;                 /* attente déjà affichée */
    note.textContent = frTypo('Trop d’essais : patientez un peu avant de réessayer.');
    wait.hidden = false;
    const tick = () => {
      const ms = lockLeft(readPrefs());
      if (ms <= 0) {
        clearInterval(t);
        lockTimer = 0;
        wait.hidden = true;
        if (ctl) ctl.disable(false);
        note.textContent = 'Vous pouvez réessayer.';
        return;
      }
      const s = Math.ceil(ms / 1000);
      wait.textContent = s >= 60 ? Math.floor(s / 60) + '\u00A0min ' + String(s % 60).padStart(2, '0') + '\u00A0s' : s + '\u00A0s';
    };
    const t = lockTimer = setInterval(tick, 250);
    cleanups.push(() => clearInterval(t));
    tick();
    return true;
  };
  const fail = () => {
    const r = noteFail(readPrefs());
    writePrefs(r.prefs);
    return r.locked;
  };

  if (mode === 'code' || mode === 'new') {
    let first = '';
    const setAsk = () => {
      ask.textContent = mode === 'code' ? 'Saisissez le code parent.'
        : first ? 'Retapez-le pour confirmer.' : 'Choisissez un nouveau code à 4\u00A0chiffres.';
    };
    setAsk();
    const pp = pinPad({
      onComplete: async code => {
        if (mode === 'new') {
          if (!first) { first = code; pp.clear(); note.textContent = ''; setAsk(); return; }
          if (code !== first) {
            first = '';
            pp.wrong();
            note.textContent = 'Les deux codes ne correspondent pas. Recommencez.';
            setAsk();
            return;
          }
          pp.disable(true);
          const ok = await setCode(code);
          if (!host) return;
          if (ok) { enter('Nouveau code enregistré ✓'); return; }
          note.textContent = frTypo('Le code n’a pas pu être enregistré sur cet appareil.');
          enter();
          return;
        }
        pp.disable(true);
        const ok = await checkCode(code);
        if (!host) return;
        if (ok) { enter(); return; }
        fail();
        pp.wrong();
        note.textContent = 'Code incorrect.';
        setTimeout(() => { if (host && !lockIfNeeded()) pp.disable(false); }, 560);
      }
    });
    ctl = pp;
    cleanups.push(() => pp.destroy());
    zone.appendChild(pp.dots);
    pad.appendChild(pp.keys);
    if (mode === 'code') {
      foot.appendChild(ownEnter(h('button', { type: 'button', class: 'btn ghost pa-forgot', on: { click: () => { audio.tap(); renderGate('forgot', true); } } }, 'Code oublié ?')));
    }
  } else {
    /* calcul d'adulte : racine carrée (programme de 4e) */
    let ch = newChallenge();
    ask.textContent = frTypo(mode === 'forgot' ? 'Code oublié ? Pour en choisir un nouveau, calculez :' : 'Pour entrer, calculez :');
    const shown = h('span', { 'aria-hidden': 'true' });
    const spoken = h('span', { class: 'sr-only' });
    const expr = h('div', { class: 'pa-gate-expr num' }, shown, spoken);
    const showCh = () => {
      shown.textContent = '√ ' + fmtNum(ch.square) + ' = ?';
      spoken.textContent = 'Racine carrée de ' + fmtNum(ch.square) + ' ?';
    };
    showCh();
    zone.append(expr);
    const kp = kit.keypad({
      maxLen: 3,
      submitLabel: 'Entrer ✓',
      onSubmit: v => {
        if (Number(v) === ch.answer) {
          kp.setState('right');
          kp.disable(true);
          if (mode === 'forgot') {
            writePrefs(noteSuccess(readPrefs()));
            audio.success(3);
            setTimeout(() => { if (host) renderGate('new'); }, motion.reduced() ? 60 : 380);
          } else enter();
          return;
        }
        const locked = fail();
        kp.setState('wrong');
        kit.gentleWrong(kp.answer);
        note.textContent = frTypo('Ce n’est pas le bon résultat. Voici un autre calcul.');
        ch = newChallenge(Math.random, ch);
        setTimeout(() => {
          if (!host) return;
          showCh(); motion.pop(expr, { scale: 1.06 }); kp.clear();
          if (locked) lockIfNeeded();
        }, 650);
      }
    });
    kp.answer.setAttribute('aria-label', 'Votre réponse');
    ctl = kp;
    cleanups.push(() => kp.destroy());
    pad.appendChild(kp.el);
    if (mode === 'forgot') {
      foot.appendChild(ownEnter(h('button', { type: 'button', class: 'btn ghost pa-forgot', on: { click: () => { audio.tap(); renderGate('code', true); } } }, 'Revenir au code')));
    }
  }
  lockIfNeeded();
  if (refocus) { const b = foot.querySelector('.pa-forgot'); if (b) { try { b.focus({ preventScroll: true }); } catch (_) {} } }
}

/* ============ CONTENU ============ */
function profileList() { return store.listProfiles(); }
function current() {
  const list = profileList();
  if (!list.length) return null;
  if (!sel || !store.getProfile(sel)) sel = (store.getProfile() || list[0]).id;
  return store.getProfile(sel);
}

function section(id, title, ...children) {
  return h('section', { class: 'pa-sec', id: 'pa-' + id, 'aria-labelledby': 'pa-' + id + '-t' },
    h('h2', { class: 'section-title pa-sec-title', id: 'pa-' + id + '-t', tabindex: '-1', 'data-fk': 'sec-' + id }, title), ...children);
}
/* défilement vers un élément (sous la barre collante), puis focus sur son titre */
function goTo(el, focusEl) {
  if (!el) return;
  try { el.scrollIntoView({ behavior: motion.reduced() ? 'auto' : 'smooth', block: 'start' }); } catch (_) { el.scrollIntoView(); }
  if (focusEl) { try { focusEl.focus({ preventScroll: true }); } catch (_) {} }
}
/* libellé de bouton « emoji + texte » d'un seul tenant : sur deux lignes, l'emoji suit le texte au lieu de rester
   seul à gauche (l'emoji est décoratif, hors du nom accessible) */
function iconLabel(emo, text) {
  return h('span', { class: 'pa-lbl' }, h('span', { class: 'pa-lbl-emo', 'aria-hidden': 'true' }, emo + '\u00A0'), text);
}

/* un redessin ne doit pas perdre le focus clavier : il revient à l'élément équivalent (même data-fk), ou à son repli.
   lastFk : dernier élément de l'écran qui a eu le focus (celui qui a ouvert une feuille, quand le focus y est encore).
   Tant qu'une feuille est ouverte, #app est inerte (kit) : on attend sa fermeture, sans voler un focus déjà repris. */
const FOCUS_FALLBACK = { 'nudge-code': 'sec-progres', 'code-del': 'code-set' };
let lastFk = null;
function focusKey(fk, tries = 0) {
  if (!fk || !host) return;
  const d = globalThis.document;
  const app = d.getElementById('app');
  if (app && app.hasAttribute('inert')) { if (tries < 40) setTimeout(() => focusKey(fk, tries + 1), 30); return; }
  const a = d.activeElement;
  if (tries > 0 && a && a !== d.body && a.isConnected) return;
  const find = k => [...host.querySelectorAll('[data-fk]')].find(x => x.getAttribute('data-fk') === k);
  const el = find(fk) || (FOCUS_FALLBACK[fk] ? find(FOCUS_FALLBACK[fk]) : null);
  if (el) { try { el.focus({ preventScroll: true }); } catch (_) {} }
}
function renderContent({ entering = false, keepScroll = false, nudge = false, focus = null } = {}) {
  if (!host) return;
  const y = keepScroll ? (globalThis.scrollY || 0) : 0;
  let fk = focus;
  if (!fk && !entering) {
    try {
      const a = globalThis.document.activeElement;
      if (a && host.contains(a)) {
        const k = a.closest ? a.closest('[data-fk]') : null;
        fk = k ? k.getAttribute('data-fk') : null;
      } else fk = lastFk;                         /* focus dans une feuille (ou perdu) : l'élément qui l'a ouverte */
    } catch (_) {}
  }
  cleanup();
  clear(host);
  const p = current();
  live = h('div', { class: 'sr-only', 'aria-live': 'polite' });
  const lock = h('button', { type: 'button', class: 'btn-icon pa-lock', 'aria-label': 'Verrouiller l’espace parents',
    on: { click: () => { audio.tap(); gateClose(); renderGate(); } } }, '🔒');
  const screen = h('div', { class: 'screen pa-screen' },
    h('div', { class: 'topbar' }, backBtn(), h('h1', { class: 'topbar-title' }, 'Espace parents'), lock), live);
  host.appendChild(screen);

  if (!p) {
    screen.appendChild(h('div', { class: 'card pa-empty' },
      h('p', null, frTypo('Aucun profil sur cet appareil pour l’instant.')),
      h('div', { class: 'pa-actions' },
        h('button', { type: 'button', class: 'btn', on: { click: () => router.go('onboarding') } }, 'Ajouter un enfant ➕'),
        h('button', { type: 'button', class: 'btn white', on: { click: () => importBackup() } }, 'Restaurer une sauvegarde'))));
    return;
  }

  /* pastilles des profils (compagnon dessiné) + navigation dans la page */
  const pills = h('div', { class: 'pa-pills', role: 'group', 'aria-label': 'Profil affiché' },
    profileList().map(q => h('button', { type: 'button', class: ['chip', 'pa-pill', q.id === p.id && 'on'], 'aria-pressed': q.id === p.id ? 'true' : 'false', 'data-fk': 'pill-' + q.id,
      on: { click: () => { if (q.id === sel) return; audio.tap(); sel = q.id; renderContent(); } } },
    petEl(q, 'pa-pill-ava', 30), q.name, q.classe ? h('span', { class: 'pa-pill-cl' }, q.classe) : null)));
  const navBox = h('nav', { class: 'pa-nav', 'aria-label': 'Rubriques' },
    /* boutons (et non ancres #pa-…) : le routeur hash ne doit jamais voir ces cibles ; « À revoir », seule partie qui
       propose quoi faire, juste après « Progrès » */
    [['progres', 'Progrès'], ['revoir', 'À revoir'], ['evals', 'Évaluations'], ['reglages', 'Réglages'], ['sauvegardes', 'Sauvegardes'], ['profils', 'Profils'], ['apropos', 'À propos']]
      .map(([id, label]) => h('button', { type: 'button', class: 'pa-nav-a', 'aria-controls': 'pa-' + id, 'data-fk': 'nav-' + id, on: { click: () => {
        audio.tap();
        const t = globalThis.document.getElementById('pa-' + id);
        goTo(t, t && t.querySelector('.pa-sec-title, .pa-h3'));
      } } }, label)));
  /* bandeau qui défile : fondu à droite tant qu'il reste des rubriques cachées */
  const fade = () => {
    const more = navBox.scrollWidth - navBox.clientWidth - navBox.scrollLeft > 4;
    navBox.classList.toggle('has-more', more);
  };
  navBox.addEventListener('scroll', fade, { passive: true });
  later(fade);
  try { const ro = new ResizeObserver(fade); ro.observe(navBox); cleanups.push(() => ro.disconnect()); } catch (_) {}
  screen.append(pills, navBox);

  if (!store.storageOk()) {
    screen.appendChild(h('div', { class: 'banner pa-warn', role: 'alert' },
      h('span', { class: 'pa-warn-emo', 'aria-hidden': 'true' }, '⚠️'),
      h('div', { class: 'pa-warn-txt' },
        h('strong', null, 'La sauvegarde automatique ne fonctionne pas sur cet appareil.'),
        h('span', null, frTypo(' Navigation privée ou stockage plein : les progrès seront perdus à la fermeture. Téléchargez une sauvegarde pour les garder.'))),
      h('button', { type: 'button', class: 'btn small', on: { click: () => exportAllNow() } }, 'Télécharger')));
  }
  /* invitation au code parent, juste après le calcul (rien si un code existe ou si « Plus tard » date de moins de 30 jours) */
  const prefs = readPrefs();
  let invited = false;
  if (nudge && !prefs.pin && !(prefs.later && daysBetween(prefs.later, dayStr()) < NUDGE_DAYS)) {
    invited = true;
    const banner = h('div', { class: 'banner pa-nudge' },
      h('span', { class: 'pa-nudge-emo', 'aria-hidden': 'true' }, '🔐'),
      h('div', { class: 'pa-nudge-txt' },
        h('strong', null, 'Un code parent ?'),
        h('span', null, frTypo(' Quatre chiffres à taper au lieu du calcul, à garder pour vous.'))),
      h('div', { class: 'pa-nudge-acts' },
        h('button', { type: 'button', class: 'btn small', 'data-fk': 'nudge-code', on: { click: () => { audio.tap(); openCodeSheet(); } } }, 'Choisir un code'),
        h('button', { type: 'button', class: 'btn ghost', on: { click: () => {
          audio.tap();
          const q = readPrefs(); q.later = dayStr(); writePrefs(q);
          banner.remove();
          say('Invitation masquée pour 30\u00A0jours.');
        } } }, 'Plus tard')));
    screen.appendChild(banner);
  }
  /* invitation aux rappels quotidiens (celle que montrait l'accueil de l'enfant), à l'entrée seulement et jamais en même
     temps que celle du code : une invitation à la fois ; « Plus tard » la range pour de bon (préférence 'caramel-notifs') */
  if (entering && !invited && notifs.shouldOffer()) {
    const inv = h('div', { class: 'banner pa-nudge pa-invite' },
      h('span', { class: 'pa-nudge-emo', 'aria-hidden': 'true' }, '🔔'),
      h('div', { class: 'pa-nudge-txt' },
        h('strong', null, 'Un rappel chaque jour ?'),
        h('span', null, frTypo(' Une notification pour ne pas oublier la balade du jour et garder la série 🔥.'))),
      h('div', { class: 'pa-nudge-acts' },
        h('button', { type: 'button', class: 'btn small', on: { click: async () => {
          audio.tap();
          await enableReminders();
          later(() => renderContent({ keepScroll: true, focus: 'sec-progres' }));
        } } }, 'Activer les rappels'),
        h('button', { type: 'button', class: 'btn ghost', on: { click: () => {
          audio.tap();
          notifs.dismiss();
          inv.remove();
          say('Invitation masquée. Les rappels restent disponibles dans les réglages.');
        } } }, 'Plus tard')));
    screen.appendChild(inv);
  }

  const blocks = [
    section('progres', 'Progrès ' + deNom(p.name), ...progressBlocks(p)),
    section('evals', 'Évaluations', evalsCard(p)),
    section('reglages', 'Réglages', settingsCard(p), deviceCard()),
    section('sauvegardes', 'Sauvegardes', backupCard(p)),
    section('profils', 'Profils', profilesCard()),
    section('apropos', 'À propos', aboutCard(), diagCard())
  ];
  screen.append(...blocks);

  /* fenêtre de 10 minutes prolongée à chaque geste */
  const touch = () => gateRefresh();
  screen.addEventListener('pointerdown', touch, { passive: true });
  screen.addEventListener('keydown', touch);
  const onScroll = () => { if (!gateOpen()) return; gateRefresh(); };
  globalThis.addEventListener('scroll', onScroll, { passive: true });
  cleanups.push(() => globalThis.removeEventListener('scroll', onScroll));
  const check = setInterval(() => { if (!gateOpen()) renderGate(); }, 20000);
  cleanups.push(() => clearInterval(check));

  if (entering) {
    motion.stagger([...screen.querySelectorAll('.pa-pills, .pa-nav, .pa-nudge, .pa-sec')].slice(0, 4), el => motion.enter(el, { from: 'bottom' }), 70);
  }
  if (keepScroll) { try { globalThis.scrollTo(0, y); } catch (_) {} }
  lastFk = null;
  if (fk) later(() => focusKey(fk));
}

/* ---------- rubrique « Progrès » ---------- */
function progressBlocks(p) {
  const classe = p.classe || 'CM2';
  const playedAny = Object.keys(isObj(p.skills) ? p.skills : {}).some(id => obsCount(p.skills[id]) > 0)
    || (Array.isArray(p.history) && p.history.length > 0) || readings(p).length > 0;
  const hasEval = (Array.isArray(p.evals) ? p.evals : []).some(e => e && (isObj(e.fr) || isObj(e.ma)));
  const fresh = !playedAny && !hasEval;
  const out = [briefCard(p, { fresh, playedAny, classe })];
  if (playedAny || (Number(p.stats && p.stats.sessions) || 0) > 0) out.push(statsCard(p));
  if (!fresh) out.push(radarsCard(p), axisTable(p));
  out.push(mclmCard(p), reviewCard(p));
  return out;
}

/* série encore vivante aujourd'hui (jouée hier ou aujourd'hui, ou avant-hier avec un gel disponible) */
function liveStreak(p, today) {
  const s = p.streak || {};
  const n = Number(s.count) || 0;
  if (!n || typeof s.last !== 'string' || !s.last) return 0;
  const gap = daysBetween(s.last, today);
  return gap <= 1 || (gap === 2 && (Number(s.freezes) || 0) > 0) ? n : 0;
}

/* « En bref » : en 30 s, où en est l'enfant et quoi faire */
function briefCard(p, { fresh, playedAny, classe }) {
  const today = dayStr();
  const meta = [p.classe ? 'Classe de ' + p.classe : 'Classe non choisie',
    fmtNum((p.wallet && p.wallet.apples) || 0) + '\u00A0🍎', fmtNum(totalStars(p)) + '\u00A0⭐'].join(' · ');
  const head = h('div', { class: 'pa-brief-head' },
    petEl(p, 'pa-who-ava', 56),
    h('div', { class: 'pa-who-txt' },
      h('h3', { class: 'pa-brief-t' }, 'En bref'),
      h('div', { class: 'pa-who-meta' }, meta)));
  const card = h('div', { class: 'card pa-card pa-brief' }, head);

  if (fresh) {
    card.append(
      h('p', { class: 'pa-brief-p' }, frTypo(p.name + ' n’a pas encore joué : ses radars se rempliront au fil des parties (la balade du jour se lance depuis l’accueil).')),
      h('p', { class: 'pa-brief-p' }, frTypo('Pour démarrer au bon niveau, importez la fiche des évaluations nationales (Repères) reçue à la rentrée.')),
      h('button', { type: 'button', class: 'btn pa-brief-go', on: { click: () => { audio.tap(); router.go('import', { query: { from: 'parents', method: 'photo', profile: p.id } }); } } },
        iconLabel('📷', 'Photographier la fiche')));
    return card;
  }

  const rows = [];
  const row = (label, value) => rows.push(h('div', { class: 'pa-brief-row' }, h('dt', null, label), h('dd', null, value)));
  const items = list => h('ul', { class: 'pa-brief-items' }, list.map(x => h('li', null, x)));
  /* semaine en cours (lundi → dimanche), d'après l'historique des parties */
  const wk = weekKey(today);
  let ms = 0;
  const days = new Set();
  for (const e of Array.isArray(p.history) ? p.history : []) {
    if (!e || typeof e.d !== 'string') continue;
    const d = e.d.slice(0, 10);
    if (weekKey(d) !== wk) continue;
    ms += Number(e.ms) || 0;
    days.add(d);
  }
  row('Cette semaine', days.size
    ? frTypo(duration(ms / 60000) + ' sur ' + plural(days.size, 'jour', 'jours'))
    : 'pas encore de partie');
  /* compétences : en progrès (tendance) et à travailler (sous ⊕⊕, l'attendu de la classe) ; mêmes libellés que le
     détail par compétence (officiels au CM2) */
  const tpls = ['fr', 'ma'].map(s => radarTemplate(classe, s));
  const axesAll = tpls.flatMap(t => t.axes.map(a => ({ ...a, label: axisLabel(t.official ? a : { ...a, label: AXES[a.id] ? AXES[a.id].label : a.label }) })));
  const vals = Object.assign({}, ...tpls.map(t => currentValues(p, t)));
  const sk = id => (p.skills && p.skills[id]) || null;
  const played = axesAll.filter(a => playedAxis(p, a.id));
  const name = a => a.label;
  /* en progrès : comme les étincelles ✨ des radars (inProgress), sans ce qui recule en ce moment (tendance ↘ du tableau) */
  const trendOf = a => Number((sk(a.id) || {}).trend) || 0;
  const upAll = played.filter(a => inProgress(p, a.id, today) && trendOf(a) >= 0).sort((x, y) => trendOf(y) - trendOf(x));
  const upIds = new Set(upAll.map(a => a.id));
  const upShown = new Set(upAll.slice(0, 2).map(a => a.id));
  if (playedAny) {
    const shown = upAll.slice(0, 2).map(name);
    if (upAll.length > 2) shown.push(frTypo('et ' + (upAll.length - 2) + (upAll.length - 2 > 1 ? ' autres' : ' autre') + ' (✨ sur les radars)'));
    row('En progrès', shown.length ? items(shown) : 'pas de progression nette pour l’instant');
  }
  let weak = played.filter(a => isNum(vals[a.id]) && vals[a.id] < 2 - 1e-9);
  let fromFiche = false;
  if (!played.length) { weak = axesAll.filter(a => TRAINED.has(a.id) && isNum(vals[a.id]) && vals[a.id] < 2 - 1e-9); fromFiche = true; }
  weak = weak.sort((x, y) => vals[x.id] - vals[y.id]).slice(0, 2);
  const lvl = a => h('span', { class: 'pa-brief-lvl' }, h('span', { 'aria-hidden': 'true' }, levelMarks(vals[a.id]) || 'sous\u00A0⊕'), '\u00A0' + fmtTheta(vals[a.id]),
    h('span', { class: 'sr-only' }, ' sur 3'));
  /* « (en progrès) » seulement si la compétence n'est pas déjà citée juste au-dessus ; repère de l'attendu sous la liste */
  row(fromFiche ? 'À travailler (d’après la fiche)' : 'À travailler', weak.length
    ? [items(weak.map(a => [name(a) + ' ', lvl(a), upIds.has(a.id) && !upShown.has(a.id) ? h('span', { class: 'pa-brief-up' }, ' (en progrès)') : null])),
      h('span', { class: 'pa-brief-ref' }, h('span', { 'aria-hidden': 'true' }, frTypo('attendu de la classe : ⊕⊕\u00A02')), h('span', { class: 'sr-only' }, 'attendu de la classe : 2 sur 3'))]
    : frTypo(fromFiche ? 'rien sous l’attendu de la classe sur la fiche ✓' : 'tout ce qui a été travaillé est au niveau attendu ✓'));
  /* lecture à voix haute : dernière lecture comparée à l'attendu du moment */
  const reads = readings(p)
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : (Number(a.t) || 0) - (Number(b.t) || 0)));
  if (reads.length) {
    const lastV = Math.round(Number(reads[reads.length - 1].v));
    row('Lecture à voix haute', frTypo(lastV + '\u00A0mots/min (attendu en ce moment : environ ' + Math.round(mclmExpected(classe, today)) + ')'));
  }
  card.appendChild(h('dl', { class: 'pa-brief-list' }, rows));
  /* quoi faire : les éléments à revoir, ensemble */
  const nRev = ['ma.faits', 'fr.conjug', 'fr.fluence'].reduce((s, k) => s + weakKeys(p, k, 12).length, 0);
  if (nRev) {
    card.appendChild(h('button', { type: 'button', class: 'btn white pa-brief-go', on: { click: () => {
      audio.tap();
      const t = globalThis.document.getElementById('pa-revoir');
      goTo(t, t && t.querySelector('.pa-h3'));
    } } }, iconLabel('🔁', frTypo('À revoir ensemble (' + nRev + ')')), h('span', { 'aria-hidden': 'true' }, '➜')));
  }
  return card;
}

/* ---------- depuis le début ---------- */
function tile(label, value, sub) {
  return h('div', { class: 'pa-tile' },
    h('div', { class: 'pa-tile-label' }, label),
    h('div', { class: 'pa-tile-value' }, value),
    sub ? h('div', { class: 'pa-tile-sub' }, sub) : null);
}
function statsCard(p) {
  const today = dayStr();
  const st = p.stats || {};
  let last = '';
  for (const e of p.history || []) if (e && typeof e.d === 'string' && e.d > last) last = e.d.slice(0, 10);
  const streak = liveStreak(p, today);
  return h('div', { class: 'card pa-card pa-overview' },
    h('h3', { class: 'pa-h3 pa-overview-t' }, 'Depuis le début'),
    h('div', { class: 'pa-tiles' },
      tile('Temps d’apprentissage', duration(st.minutes)),
      tile('Parties terminées', fmtNum(st.sessions || 0)),
      tile('Série en cours', streak ? [plural(streak, 'jour', 'jours'), h('span', { 'aria-hidden': 'true' }, ' 🔥')] : '—'),
      tile('Dernière séance', last ? relDay(last, today) : 'pas encore')));
}

/* ---------- radars ---------- */
/* échelle de la fiche, dessinée : 0 → 3, repères ⊕ / ⊕⊕ / ⊕⊕⊕, attendu de la classe sous ⊕⊕ */
function scaleKey() {
  const pos = v => 'calc(14px + (100% - 28px) * ' + (v / 3).toFixed(4) + ')';
  const tick = (v, mark) => h('span', { class: 'pa-scale-t', style: { left: pos(v) } },
    h('span', { class: 'pa-scale-m' }, mark), h('span', { class: 'pa-scale-tk' }), h('span', { class: 'pa-scale-n' }, String(v)));
  return h('div', { class: 'pa-scale' },
    h('div', { class: 'pa-scale-t0' }, 'Échelle des fiches Repères'),
    h('div', { class: 'pa-scale-bar', 'aria-hidden': 'true' },
      h('span', { class: 'pa-scale-track' }),
      tick(0, ''), tick(1, '⊕'), tick(2, '⊕⊕'), tick(3, '⊕⊕⊕'),
      /* flèche juste sous le repère 2, libellé centré dessous */
      h('span', { class: 'pa-scale-exp', style: { left: pos(2) } }, h('span', { class: 'pa-scale-arrow' }, '▲'), h('span', null, 'attendu de la classe'))),
    h('p', { class: 'sr-only' }, 'Échelle de 0 à 3 : un repère à 1, deux repères à 2, trois repères à 3. 2 correspond au niveau attendu de la classe à cette période de l’année. En dessous de 1 : à consolider.'),
    h('ul', { class: 'pa-scale-notes' },
      h('li', null, frTypo('⊕⊕ (2) : niveau attendu de la classe à cette période de l’année ; sous ⊕ (moins de 1) : à\u00A0consolider.')),
      h('li', null, frTypo('« absence » : compétence non évaluée sur la fiche (élève absent ce jour-là).'))));
}
function radarsCard(p) {
  const today = dayStr();
  const classe = p.classe || 'CM2';
  const wrap = h('div', { class: 'pa-radars' });
  const card = h('div', { class: 'card pa-card pa-radar-card' });
  const refs = {}, tpls = {}, radars = {};
  const evDate = (p.evals || []).reduce((best, e) => (e && typeof e.date === 'string' && e.date > best ? e.date : best), '');
  const twinkles = {};
  let anyTwinkle = false;
  for (const subject of ['fr', 'ma']) {
    const base = radarTemplate(classe, subject);
    tpls[subject] = { ...base, axes: base.axes.map(a => ({ ...a, label: axisLabel(a) })) };
    twinkles[subject] = tpls[subject].axes.filter(a => inProgress(p, a.id, today)).map(a => a.id);
    if (twinkles[subject].length) anyTwinkle = true;
  }
  const legend = h('div', { class: 'pa-legend' },
    evDate ? h('span', { class: 'pa-legend-item' }, h('span', { class: 'pa-key pa-key--ref', 'aria-hidden': 'true' }), 'Fiche ' + deNom(monthLabel(evDate))) : null,
    h('span', { class: 'pa-legend-item' }, h('span', { class: 'pa-key pa-key--cur', 'aria-hidden': 'true' }), 'Maintenant'),
    anyTwinkle ? h('span', { class: 'pa-legend-item' }, h('span', { 'aria-hidden': 'true' }, '✨'), 'En progrès') : null);
  card.append(legend, wrap);
  for (const subject of ['fr', 'ma']) {
    const tpl = tpls[subject];
    const ref = refs[subject] = referenceValues(p, subject);
    const values = currentValues(p, tpl);
    const holder = h('div', { class: 'pa-radar' });
    wrap.appendChild(h('div', { class: 'pa-radar-col' },
      h('h3', { class: 'pa-h3' }, h('span', { 'aria-hidden': 'true' }, SUBJECTS[subject].emoji + ' '), subject === 'fr' ? 'Français' : 'Mathématiques'), holder));
    later(() => {
      if (!holder.isConnected) return;
      const r = renderRadar(holder, {
        template: tpl, values, reference: ref, subject, labels: 'official', showValues: true, twinkle: twinkles[subject], size: 470,
        nullLabel: id => (isAbsence(ref, id) ? 'absence' : 'non observé'),
        title: 'Radar de ' + (subject === 'fr' ? 'français' : 'mathématiques') + ' ' + deNom(p.name)
      });
      radars[subject] = r;
      cleanups.push(() => r.destroy());
    });
  }
  /* curseur des semaines (snapshots hebdomadaires) */
  const snaps = (Array.isArray(p.snapshots) ? p.snapshots : []).filter(s => s && s.s && typeof s.d === 'string' && s.d);
  if (snaps.length) {
    const n = snaps.length;
    const out = h('output', { class: 'pa-time-out', 'aria-live': 'polite' }, 'Maintenant');
    const range = h('input', { type: 'range', class: 'pa-range', min: '0', max: String(n), step: '1', value: String(n),
      'aria-label': 'Semaine affichée sur les radars', 'aria-valuetext': 'Maintenant' });
    const valuesAt = (subject, k) => {
      const tpl = tpls[subject];
      if (k >= n) return currentValues(p, tpl);
      const s = snaps[k].s, ref = refs[subject] || {};
      const out2 = {};
      for (const a of tpl.axes) out2[a.id] = Object.prototype.hasOwnProperty.call(s, a.id) ? s[a.id] : (Object.prototype.hasOwnProperty.call(ref, a.id) ? ref[a.id] : null);
      return out2;
    };
    const apply = () => {
      const k = Number(range.value);
      const label = k >= n ? 'Maintenant' : 'Semaine du ' + longDate(weekMonday(snaps[k].d));
      out.textContent = label;
      range.setAttribute('aria-valuetext', label);
      for (const subject of ['fr', 'ma']) if (radars[subject]) radars[subject].update(valuesAt(subject, k), { morphFrom: 'current', twinkle: k >= n ? undefined : [] });
      audio.tap();
    };
    range.addEventListener('input', apply);
    card.appendChild(h('div', { class: 'pa-time' },
      h('label', { class: 'pa-time-lbl' }, h('span', null, 'Remonter le temps'), out),
      range));
  }
  card.appendChild(scaleKey());
  return card;
}
/* lundi de la semaine d'un jour */
function weekMonday(d) {
  const x = parseDay(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}

/* un <details> ouvert le reste quand l'écran se redessine (réglage enregistré, retour d'une feuille) */
const openDetails = new Set();
function keepOpen(el, key) {
  if (openDetails.has(key)) el.open = true;
  el.addEventListener('toggle', () => { if (el.open) openDetails.add(key); else openDetails.delete(key); });
  return el;
}
/* ---------- détail par compétence ---------- */
function axisTable(p) {
  const today = dayStr();
  const classe = p.classe || 'CM2';
  const card = h('details', { class: 'card pa-card pa-axes' },
    h('summary', { class: 'pa-axes-sum' },
      h('span', { class: 'pa-axes-t' }, 'Détail par compétence'),
      h('span', { class: 'pa-axes-sub' }, 'niveau, tendance, réponses, jeu')),
    h('p', { class: 'pa-note pa-axes-note' }, frTypo('« fiche » : valeur de l’évaluation, pas encore travaillée dans un jeu.')));
  keepOpen(card, 'axes');
  for (const subject of ['fr', 'ma']) {
    const tpl = radarTemplate(classe, subject);
    const vals = currentValues(p, tpl);
    const ref = referenceValues(p, subject) || {};
    const head = h('div', { role: 'row', class: 'pa-tr pa-thead' },
      ['Compétence', 'Niveau', 'Tendance', 'Réponses', 'Dernier entraînement', 'Jeu'].map((t, i) =>
        h('span', { role: 'columnheader', class: 'pa-th c' + i }, t)));
    const rows = tpl.axes.map(a => {
      const v = vals[a.id];
      const sk = p.skills && p.skills[a.id];
      const obs = answerCount(p, a.id);
      const last = lastPlayed(p, a.id);
      const g = gameOf(a.id);
      const played = obs > 0 || !!last;
      const tr = sk && Number(sk.trend);
      const trend = !played || !isNum(tr) ? null
        : tr > 0.05 ? { s: '↗', t: 'progresse', k: 'up' } : tr < -0.05 ? { s: '↘', t: 'recule un peu', k: 'down' } : { s: '→', t: 'stable', k: 'flat' };
      /* valeur venue de la fiche (pas encore observée dans un jeu) : petite mention « fiche » */
      const fromFiche = isNum(v) && !played;
      const level = isNum(v)
        ? h('span', { class: 'pa-lvl' }, h('span', { class: 'pa-lvl-m', 'aria-hidden': 'true' }, levelMarks(v) || 'sous\u00A0⊕'), ' ', h('b', { class: 'num' }, fmtTheta(v)),
          h('span', { class: 'sr-only' }, ' sur 3'), fromFiche ? h('span', { class: 'pa-lvl-src' }, 'fiche') : null)
        : h('span', { class: 'pa-lvl is-none' }, isAbsence(ref, a.id) ? 'pas évaluée (absence)' : 'non observé');
      const none = (sr) => [h('span', { 'aria-hidden': 'true' }, '—'), h('span', { class: 'sr-only' }, sr)];
      return h('div', { role: 'row', class: ['pa-tr', !g && 'is-soon', !played && 'is-unplayed'] },
        h('span', { role: 'cell', class: 'pa-td c0' }, axisLabel(tpl.official ? a : { ...a, label: AXES[a.id] ? AXES[a.id].label : a.label })),
        h('span', { role: 'cell', class: 'pa-td c1' }, level),
        /* sur téléphone, les quatre colonnes suivantes forment une seule ligne de détails */
        h('div', { class: 'pa-meta' },
          h('span', { role: 'cell', class: 'pa-td c2 pa-trend' + (trend ? ' is-' + trend.k : '') },
            trend ? [h('span', { 'aria-hidden': 'true' }, trend.s), ' ' + trend.t] : none('pas encore de tendance')),
          h('span', { role: 'cell', class: 'pa-td c3' }, played ? plural(obs, 'réponse', 'réponses') : none('aucune réponse')),
          h('span', { role: 'cell', class: 'pa-td c4' }, last ? [h('span', { class: 'pa-mpre' }, 'entraînée '), relDay(last, today)] : 'jamais'),
          h('span', { role: 'cell', class: 'pa-td c5' }, g ? h('span', { class: 'pa-game' }, h('span', { 'aria-hidden': 'true' }, g.icon + ' '), g.short)
            : h('span', { class: 'pa-soon' }, 'jeu bientôt'))));
    });
    card.appendChild(h('div', { class: 'pa-table', role: 'table', 'aria-label': (subject === 'fr' ? 'Français' : 'Mathématiques') + ' : détail par compétence' },
      h('div', { class: 'pa-caption', 'aria-hidden': 'true' }, SUBJECTS[subject].emoji + ' ' + (subject === 'fr' ? 'Français' : 'Mathématiques')),
      head, ...rows));
  }
  return card;
}

/* ---------- courbe de lecture à voix haute (MCLM) ---------- */
const dayNum = d => Math.round(parseDay(d).getTime() / 86400000);
const fromNum = n => { const x = new Date(n * 86400000); return dayStrLocal(x); };
function dayStrLocal(x) {
  /* n × 86400000 = minuit UTC : on relit la date du calendrier sans décalage de fuseau */
  const d = new Date(x.getTime() + x.getTimezoneOffset() * 60000 + 12 * 3600000);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function mclmCard(p) {
  const classe = p.classe || 'CM2';
  const today = dayStr();
  const target = mclmTarget(classe);
  const expNow = Math.round(mclmExpected(classe, today));
  const pts = (Array.isArray(p.mclm) ? p.mclm : [])
    .filter(e => e && typeof e.d === 'string' && Number.isFinite(Number(e.v)) && Number(e.v) > 0)
    .map(e => ({ d: e.d.slice(0, 10), t: Number(e.t) || 0, v: Math.round(Number(e.v)), pr: Number.isFinite(Number(e.p)) ? Math.round(Number(e.p)) : null }))
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.t - b.t));
  const card = h('div', { class: 'card pa-card pa-mclm' },
    h('h3', { class: 'pa-h3' }, h('span', { 'aria-hidden': 'true' }, '🎤 '), 'Lecture à voix haute'),
    h('p', { class: 'pa-note' }, frTypo('Mots lus correctement en une minute (MCLM) pendant les courses, comparés à l’attendu de la classe de ' + classe + ' à chaque période. Objectif de fin d’année : ' + target + ' mots/min.')));
  if (!pts.length) {
    card.appendChild(h('div', { class: 'pa-empty-chart' },
      h('span', { class: 'pa-empty-emo', 'aria-hidden': 'true' }, '📈'),
      h('p', null, frTypo('Pas encore de lecture enregistrée : la courbe apparaîtra après la première course. Attendu en ce moment : environ ' + expNow + ' mots/min.'))));
    return card;
  }
  const legend = h('div', { class: 'pa-legend pa-legend--left' },
    h('span', { class: 'pa-legend-item' }, h('span', { class: 'pa-key pa-key--line', 'aria-hidden': 'true' }), 'Lectures ' + deNom(p.name)),
    h('span', { class: 'pa-legend-item' }, h('span', { class: 'pa-key pa-key--dash', 'aria-hidden': 'true' }), 'Attendu en ' + classe));
  const box = h('div', { class: 'pa-chart', tabindex: '0', role: 'img' });
  const tip = h('div', { class: 'pa-tip', 'aria-hidden': 'true' });
  const chartWrap = h('div', { class: 'pa-chart-wrap' }, box, tip);
  const last = pts[pts.length - 1];
  box.setAttribute('aria-label', plural(pts.length, 'lecture', 'lectures') + ' du ' + longDate(pts[0].d) + ' au ' + longDate(last.d) +
    ' ; dernière : ' + last.v + ' mots par minute ; attendu aujourd’hui : environ ' + expNow + ' ; objectif de fin d’année : ' + target + '. Flèches gauche et droite pour parcourir les lectures.');
  const table = keepOpen(h('details', { class: 'pa-details' },
    h('summary', null, 'Voir toutes les lectures'),
    h('table', { class: 'pa-mini-table' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Date'), h('th', { scope: 'col' }, 'Mots/min'), h('th', { scope: 'col' }, 'Précision'), h('th', { scope: 'col' }, 'Attendu'))),
      h('tbody', null, pts.slice().reverse().map(x => h('tr', null,
        h('td', null, longDate(x.d)), h('td', { class: 'num' }, fmtNum(x.v)), h('td', { class: 'num' }, x.pr !== null ? x.pr + '\u00A0%' : '—'),
        h('td', { class: 'num' }, fmtNum(Math.round(mclmExpected(classe, x.d))))))))), 'mclm');
  card.append(legend, chartWrap, table);

  let sel = pts.length - 1;
  let geo = null;
  function draw() {
    const W = Math.round(box.clientWidth || 0);
    if (W < 120) return;
    const H = W < 500 ? 236 : 276;
    const m = { l: 36, r: W < 420 ? 64 : 76, t: 26, b: 30 };
    const tn = dayNum(today);
    /* fenêtre : de la première lecture à aujourd'hui, au moins 4 semaines (la courbe s'allonge au fil de l'année) */
    const x1 = Math.max(tn, dayNum(last.d)) + 2;
    const x0 = Math.min(dayNum(pts[0].d) - 2, x1 - 28);
    const span = x1 - x0;
    const expAt = n => mclmExpected(classe, fromNum(n));
    const vals = pts.map(q => q.v);
    const vmin = Math.min(...vals, expAt(x0)), vmax = Math.max(...vals, expAt(x1), target);
    const y0 = Math.max(0, Math.floor((vmin - 8) / 20) * 20), y1 = Math.ceil((vmax + 8) / 20) * 20;
    const X = n => m.l + (n - x0) / Math.max(1, span) * (W - m.l - m.r);
    const Y = v => m.t + (1 - (v - y0) / Math.max(1, y1 - y0)) * (H - m.t - m.b);
    const P = q => q[0].toFixed(1) + ',' + q[1].toFixed(1);
    geo = { X, Y, W, H, m };
    const g = [];
    /* grille horizontale + graduations */
    for (let v = y0; v <= y1; v += 20) {
      g.push(svg('line', { class: 'pa-grid', x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }));
      g.push(svg('text', { class: 'pa-tick', x: m.l - 6, y: Y(v) + 4, 'text-anchor': 'end' }, String(v)));
    }
    /* temps : lundis (fenêtre courte) ou débuts de mois */
    const ticks = [];
    const d = parseDay(fromNum(x0));
    if (span <= 84) {
      const dow = (d.getDay() + 6) % 7;
      if (dow) d.setDate(d.getDate() + 7 - dow);
      for (; dayNum(dayStr(d)) < x1; d.setDate(d.getDate() + 7)) ticks.push({ n: dayNum(dayStr(d)), label: d.getDate() + '\u00A0' + MONTHS_S[d.getMonth()] });
    } else {
      d.setDate(1); d.setMonth(d.getMonth() + 1);
      for (; dayNum(dayStr(d)) < x1; d.setMonth(d.getMonth() + 1)) ticks.push({ n: dayNum(dayStr(d)), label: MONTHS_S[d.getMonth()] });
    }
    let lastX = -Infinity;
    for (const t of ticks) {
      const x = X(t.n);
      g.push(svg('line', { class: 'pa-xtick', x1: x, x2: x, y1: H - m.b, y2: H - m.b + 4 }));
      if (x - lastX >= 52 && x + 22 <= W) { g.push(svg('text', { class: 'pa-tick', x, y: H - m.b + 17, 'text-anchor': 'middle' }, t.label)); lastX = x; }
    }
    g.push(svg('line', { class: 'pa-axis', x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b }));
    /* objectif de fin d'année : ligne fine + étiquette à droite */
    const ty = Y(target);
    g.push(svg('line', { class: 'pa-goal', x1: m.l, x2: W - m.r, y1: ty, y2: ty }));
    g.push(svg('text', { class: 'pa-label', x: W - m.r + 7, y: ty + 4 }, '🎯\u00A0' + target));
    g.push(svg('text', { class: 'pa-label pa-label-s', x: W - m.r + 7, y: ty + 17 }, 'en juin'));
    /* attendu de la classe à chaque date (pointillés) */
    const exp = [];
    for (let n = x0; n < x1; n += 3) exp.push([X(n), Y(expAt(n))]);
    exp.push([X(x1), Y(expAt(x1))]);
    g.push(svg('polyline', { class: 'pa-exp', points: exp.map(P).join(' ') }));
    const ey = Y(expAt(x1));
    if (Math.abs(ey - ty) > 30) g.push(svg('text', { class: 'pa-label pa-label-s', x: W - m.r + 7, y: ey + 4 }, 'attendu ' + Math.round(expAt(x1))));
    /* aujourd'hui */
    g.push(svg('line', { class: 'pa-today', x1: X(tn), x2: X(tn), y1: m.t - 8, y2: H - m.b }));
    g.push(svg('text', { class: 'pa-tick pa-today-t', x: X(tn) - 4, y: m.t - 12, 'text-anchor': 'end' }, 'aujourd’hui'));
    /* lectures */
    const lp = pts.map(q => [X(dayNum(q.d)), Y(q.v)]);
    if (lp.length > 1) g.push(svg('polyline', { class: 'pa-line', points: lp.map(P).join(' ') }));
    const cross = svg('line', { class: 'pa-cross', y1: m.t, y2: H - m.b });
    g.push(cross);
    lp.forEach((q, i) => g.push(svg('circle', { class: 'pa-dot' + (i === sel ? ' is-sel' : ''), cx: q[0], cy: q[1], r: i === sel ? 6 : 4.5, 'data-i': String(i) })));
    /* étiquette directe : dernière lecture */
    const lq = lp[lp.length - 1];
    const above = lq[1] - 12 > m.t + 4;
    g.push(svg('text', { class: 'pa-label pa-label-v', x: lq[0], y: above ? lq[1] - 12 : lq[1] + 22, 'text-anchor': lq[0] > W - m.r - 14 ? 'end' : 'middle' }, String(last.v)));
    const s = svg('svg', { class: 'pa-chart-svg', viewBox: '0 0 ' + W + ' ' + H, width: String(W), height: String(H), 'aria-hidden': 'true' }, ...g);
    clear(box);
    box.appendChild(s);
    geo.lp = lp; geo.cross = cross;
    showTip(false);
  }
  function showTip(visible = true) {
    if (!geo || !geo.lp) return;
    const q = geo.lp[sel], x = pts[sel];
    box.querySelectorAll('.pa-dot').forEach((c, i) => { c.classList.toggle('is-sel', i === sel); c.setAttribute('r', i === sel ? '6' : '4.5'); });
    geo.cross.setAttribute('x1', q[0]); geo.cross.setAttribute('x2', q[0]);
    geo.cross.style.opacity = visible ? '1' : '0';
    if (!visible) { tip.classList.remove('on'); return; }
    clear(tip);
    tip.append(h('b', null, x.v + '\u00A0mots/min'), h('span', null, longDate(x.d)),
      h('span', null, frTypo('attendu : ') + Math.round(mclmExpected(classe, x.d)) + (x.pr !== null ? ' · précision ' + x.pr + '\u00A0%' : '')));
    tip.classList.add('on');
    const bw = box.clientWidth, tw = tip.offsetWidth || 160;
    tip.style.left = Math.max(4, Math.min(bw - tw - 4, q[0] - tw / 2)) + 'px';
    tip.style.top = Math.max(0, q[1] - (tip.offsetHeight || 54) - 14) + 'px';
  }
  const pick = e => {
    if (!geo) return;
    const r = box.getBoundingClientRect();
    const x = (e.clientX - r.left) * (geo.W / (r.width || 1));
    let best = 0, bd = Infinity;
    geo.lp.forEach((q, i) => { const d = Math.abs(q[0] - x); if (d < bd) { bd = d; best = i; } });
    sel = best;
    showTip(true);
  };
  box.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') pick(e); });
  box.addEventListener('pointerdown', pick);
  box.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') showTip(false); });
  box.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      sel = Math.max(0, Math.min(pts.length - 1, sel + (e.key === 'ArrowLeft' ? -1 : 1)));
      showTip(true);
      say(pts[sel].v + ' mots par minute le ' + longDate(pts[sel].d));
    } else if (e.key === 'Escape') showTip(false);
  });
  box.addEventListener('blur', () => showTip(false));
  let ro = null, lastW = 0;
  later(() => {
    draw();
    lastW = box.clientWidth;
    try {
      ro = new ResizeObserver(() => { if (Math.abs(box.clientWidth - lastW) > 2) { lastW = box.clientWidth; draw(); } });
      ro.observe(box);
      cleanups.push(() => ro.disconnect());
    } catch (_) {}
  });
  return card;
}

/* ---------- à revoir (Leitner : boîte 1, et boîte 2 si déjà manqué ; leitner.weakKeys) ---------- */
function reviewCard(p) {
  const groups = [
    { title: 'Tables et calculs', keys: weakKeys(p, 'ma.faits', 12), fmt: k => factLabel(k) },
    { title: 'Conjugaison', keys: weakKeys(p, 'fr.conjug', 12), fmt: k => conjLabel(k) },
    { title: 'Mots de lecture', keys: weakKeys(p, 'fr.fluence', 12), fmt: k => wordLabel(p, k), read: true }
  ];
  const any = groups.some(g => g.keys.length);
  const card = h('div', { class: 'card pa-card pa-review', id: 'pa-revoir' },
    h('h3', { class: 'pa-h3', tabindex: '-1' }, h('span', { 'aria-hidden': 'true' }, '🔁 '), 'À revoir'),
    h('p', { class: 'pa-note' }, any
      ? frTypo('Ce que ' + p.name + ' a eu du mal à retrouver ces derniers jours. Ces éléments reviennent tout seuls dans les jeux (répétition espacée) ; vous pouvez aussi les reprendre ensemble.')
      : frTypo('Rien à revoir pour l’instant. Les tables, formes verbales et mots difficiles apparaîtront ici au fil des parties.')));
  for (const g of groups) {
    if (!g.keys.length) continue;
    card.appendChild(h('div', { class: 'pa-rev' },
      h('h4', { class: 'pa-rev-t' }, g.title),
      h('ul', { class: 'pa-chips' }, g.keys.map(k => h('li', { class: 'pa-chip' + (g.read ? ' read' : '') }, g.fmt(k))))));
  }
  return card;
}

/* ---------- évaluations ---------- */
/* « 📖 Français : 9 compétences (2 absences) » / « 🔢 Maths : 7 compétences » */
function evalLines(e) {
  const lines = [];
  for (const [g, label] of [['fr', 'Français'], ['ma', 'Maths']]) {
    const vals = Object.values(e && e[g] && typeof e[g] === 'object' ? e[g] : {});
    if (!vals.length) continue;
    const abs = vals.filter(v => v === null).length;
    lines.push(h('div', { class: 'pa-eval-s' }, h('span', { 'aria-hidden': 'true' }, SUBJECTS[g].emoji + ' '),
      frTypo(label + ' : ' + plural(vals.length, 'compétence', 'compétences') + (abs ? ' (' + plural(abs, 'absence', 'absences') + ')' : ''))));
  }
  return lines.length ? lines : h('div', { class: 'pa-eval-s' }, 'aucune compétence');
}
function evalsCard(p) {
  const list = (Array.isArray(p.evals) ? p.evals : []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.added || '').localeCompare(String(a.added || '')));
  const card = h('div', { class: 'card pa-card pa-evals' });
  if (list.length) {
    card.appendChild(h('ul', { class: 'pa-eval-list' }, list.map(e => {
      const src = e.src === 'reperes' ? 'Repères' : e.src || 'Évaluation';
      return h('li', { class: 'pa-eval' },
        h('div', { class: 'pa-eval-t' }, [src, monthLabel(e.date) || 'date inconnue', e.classe].filter(Boolean).join(' · ')),
        evalLines(e),
        e.precision || e.added ? h('div', { class: 'pa-eval-m' }, [e.precision, e.added ? 'importée le ' + longDate(e.added) : ''].filter(Boolean).join(' · ')) : null);
    })));
    card.appendChild(h('p', { class: 'pa-note' }, frTypo('Ajouter une autre évaluation (mi-CP, année suivante…) : elle devient la nouvelle référence du radar.')));
  } else {
    card.appendChild(h('p', { class: 'pa-note' }, frTypo('Aucune évaluation importée. Avec la fiche des évaluations nationales (Repères) reçue à la rentrée, Caramel démarre directement au bon niveau.')));
  }
  const go = method => { audio.tap(); router.go('import', { query: { from: 'parents', method, profile: p.id } }); };
  card.appendChild(h('div', { class: 'pa-import' },
    h('button', { type: 'button', class: 'btn pa-imp', on: { click: () => go('photo') } }, iconLabel('📷', 'Photographier la fiche')),
    h('button', { type: 'button', class: 'btn white pa-imp', on: { click: () => go('manual') } }, iconLabel('✋', 'Saisir à la main')),
    h('button', { type: 'button', class: 'btn white pa-imp', on: { click: () => go('file') } }, iconLabel('📄', 'Fichier d’évaluation (.json)'))));
  return card;
}

/* ---------- réglages ---------- */
/* groupe radio : un seul arrêt de tabulation (le choix courant), flèches / Origine / Fin pour changer (et appliquer),
   état choisi marqué d'un ✓ et d'un bord foncé (pas seulement une teinte) */
function seg(options, value, onPick, label) {
  const box = h('div', { class: 'seg pa-seg', role: 'radiogroup', 'aria-label': label });
  let cur = value;
  const btns = options.map(([v, text]) => h('button', { type: 'button', role: 'radio', 'data-v': String(v), 'data-fk': 'seg-' + label + '-' + v }, text));
  const mark = v => {
    const any = btns.some(b => b.dataset.v === String(v));
    btns.forEach((b, i) => {
      const on = b.dataset.v === String(v);
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on || (!any && i === 0) ? 0 : -1;
    });
  };
  mark(cur);
  box.append(...btns);
  const pick = b => {
    const v = options.find(o => String(o[0]) === b.dataset.v)[0];
    if (String(v) === String(cur)) return;
    Promise.resolve(onPick(v)).then(ok => {
      if (ok === false) { mark(cur); return; }
      cur = v;
      mark(v);
    });
  };
  box.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b && box.contains(b)) pick(b);
  });
  box.addEventListener('keydown', e => {
    const i = btns.indexOf(globalThis.document.activeElement);
    if (i < 0) return;
    let j = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % btns.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + btns.length) % btns.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = btns.length - 1;
    if (j < 0) return;
    e.preventDefault();
    try { btns[j].focus(); } catch (_) {}
    pick(btns[j]);
  });
  return box;
}
function switchRow(label, help, checked, onToggle) {
  const id = 'pa-sw-' + Math.random().toString(36).slice(2, 8);
  const sw = h('span', { class: 'switch', 'aria-hidden': 'true' });
  const btn = h('button', { type: 'button', class: 'pa-switch-row', role: 'switch', 'aria-checked': checked ? 'true' : 'false', 'aria-describedby': help ? id : null, 'data-fk': 'sw-' + label },
    h('span', { class: 'pa-row-label' }, label), sw);
  sw.setAttribute('aria-checked', checked ? 'true' : 'false');
  btn.addEventListener('click', () => {
    const on = btn.getAttribute('aria-checked') !== 'true';
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
    sw.setAttribute('aria-checked', on ? 'true' : 'false');
    onToggle(on);
  });
  return h('div', { class: 'pa-row' }, btn, help ? h('p', { class: 'pa-help', id }, frTypo(help)) : null);
}
const SUB_HELP = {
  compensation: 'Par compensation : quand le chiffre du haut est trop petit, on lui ajoute 10 et on ajoute 1 au chiffre du bas de la colonne suivante ; l’écart entre les deux nombres ne change pas.',
  cassage: 'Par cassage : on « casse » une dizaine (ou une centaine) du nombre du haut ; on barre le chiffre de la colonne suivante et on écrit au-dessus ce chiffre moins 1, et le chiffre du haut gagne 10.'
};
/* lecture des consignes à voix haute (contrat partagé avec les jeux) : 'on' (Oui, défaut) · 'off' (Non). v2.2.2 (décision
   du parent, 04/10/2026) : activée pour TOUS les enfants, CM1-CM2 compris ; l'ancien « Automatique (CP-CE1) » vaut Oui,
   un « Jamais » choisi par un parent reste Non (js/core/profiles.js). Affiché depuis la 2.2 : la voix (js/ui/voice.js,
   ctx.voice) lit la question, l'indice et le bilan (constat d'audit D1-02) ; en 2.1 il était masqué, faute de lecture
   dans les jeux (tests/parents.test.mjs le vérifie). */
const READ_ALOUD_READY = true;
const readAloudOf = s => (s && (s.readAloud === 'off' || s.readAloud === false) ? 'off' : 'on');
/* « ▶ Tester la voix » (v2.2.1, retour d'un parent : « 🔊 ne fait rien » sur un Android) : la phrase est dite, puis le
   résultat s'affiche — « La voix fonctionne ✓ » (et ce qui, dans les réglages de l'enfant, la ferait taire), ou ce qui
   ne va pas et la marche à suivre pour CET appareil. v2.2.2 : la voix enregistrée du compagnon (sans le prénom) PUIS
   celle du téléphone (les phrases non enregistrées), chacune avec son résultat. */
const VOICE_FIX = {
  android: 'Sur Android : Paramètres › Accessibilité › Synthèse vocale (ou cherchez « synthèse vocale » dans les Paramètres). Choisissez le moteur Google, la langue Français (France), et téléchargez la voix si on vous le propose. Revenez ensuite ici et touchez ▶ Tester la voix.',
  ios: 'Sur iPhone ou iPad : Réglages › Accessibilité › Contenu énoncé › Voix › Français, puis téléchargez une voix. Revenez ensuite ici et touchez ▶ Tester la voix.',
  other: 'Installez une voix française dans les réglages de langue (synthèse vocale) de l’appareil, puis touchez ▶ Tester la voix. Sinon, ouvrez Caramel dans Chrome ou Safari à jour.'
};
function devicePlatform() {
  try {
    const n = globalThis.navigator;
    if (/Android/i.test(n.userAgent)) return 'android';
    if (/iP(hone|ad|od)/.test(n.userAgent) || (n.platform === 'MacIntel' && n.maxTouchPoints > 1)) return 'ios';
  } catch (_) {}
  return 'other';
}
function voiceTest(p) {
  const id = p.id;
  const out = h('div', { class: 'pa-voice-out', role: 'status' });
  const btn = h('button', { type: 'button', class: 'btn small white pa-voice-btn', 'data-fk': 'voice-test' },
    h('span', { 'aria-hidden': 'true' }, '▶'), 'Tester la voix');
  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    btn.setAttribute('aria-busy', 'true');
    clear(out);
    out.className = 'pa-voice-out is-wait';
    out.append(h('p', { class: 'pa-voice-res' }, frTypo('Écoutez…')));
    const q = store.getProfile(id) || p;
    let r = { ok: false, reason: 'error', rec: { ok: false, reason: 'error' }, tts: { ok: false, reason: 'error' } };
    /* l'enfant affiché (pas forcément l'enfant actif) : la phrase à son prénom est reconnue par la voix enregistrée */
    try { r = await voice.test(frTypo(fillTemplate('Bonjour {P} ! Je suis {N}, et je lis les consignes à voix haute.', q)), { profile: q }); } catch (_) {}
    busy = false;
    btn.removeAttribute('aria-busy');
    if (!out.isConnected) return;
    clear(out);
    const qs = (store.getProfile(id) || q).settings || {};
    const notes = [];
    if (r.ok) {
      out.className = 'pa-voice-out is-ok';
      out.append(h('p', { class: 'pa-voice-res' }, frTypo('La voix fonctionne ✓')));
      notes.push('Rien entendu ? Montez le volume des médias de l’appareil.');
      if (qs.sound === false) notes.push('Les sons ' + deNom(q.name) + ' sont coupés : la voix se tait tant qu’ils le sont.');
      if (!voice.readAloud(store.getProfile(id) || q)) {
        const que = (deNom(q.name).startsWith('d’') ? 'qu’' : 'que ') + q.name;     /* même élision que deNom */
        notes.push('« Lire les consignes à voix haute » est sur « Non » pour ' + q.name + ' : choisissez « Oui » pour ' + que + ' l’entende.');
      }
    } else {
      out.className = 'pa-voice-out is-ko';
      const why = r.reason === 'no-api' ? 'Ce navigateur ne sait pas lire à voix haute.'
        : r.reason === 'no-fr-voice' ? 'Aucune voix française n’est installée sur cet appareil.'
          : r.reason === 'mic' ? 'Le micro écoute en ce moment : la voix attend qu’il s’arrête.'
            : 'La voix n’a pas pu parler sur cet appareil.';
      out.append(h('p', { class: 'pa-voice-res' }, frTypo(why)));
      if (r.reason === 'no-api') notes.push('Ouvrez Caramel dans Chrome (Android, ordinateur) ou dans Safari (iPhone, iPad), à jour.');
    }
    /* v2.2.2 : les deux voix, chacune avec son résultat ; la marche à suivre quand la voix du téléphone manque */
    const rec = r.rec || {}, tv = r.tts || {};
    if (r.reason !== 'mic') {
      out.append(h('p', { class: 'pa-help pa-voice-two' }, frTypo('Voix enregistrée du compagnon (consignes, encouragements) : '
        + (rec.ok ? 'elle fonctionne ✓' : rec.reason === 'load' ? 'pas encore téléchargée : elle se télécharge à la première écoute, une connexion est nécessaire.'
          : rec.reason === 'no-audio' ? 'ce navigateur ne sait pas la jouer.' : 'elle n’a pas pu jouer.'))));
      out.append(h('p', { class: 'pa-help pa-voice-two' }, frTypo('Voix du téléphone (calculs, explications, quand la voix fluide n’est pas prête) : '
        + (tv.ok ? 'elle fonctionne ✓' : tv.reason === 'no-api' ? 'ce navigateur n’en a pas.'
          : tv.reason === 'no-fr-voice' ? 'aucune voix française n’est installée.' : 'elle n’a pas pu parler.'))));
      if (!tv.ok && tv.reason !== 'no-api') notes.push(VOICE_FIX[devicePlatform()]);
    }
    for (const n of notes) out.append(h('p', { class: 'pa-help' }, frTypo(n)));
  });
  return h('div', { class: 'pa-voice' }, btn, out);
}
/* « Revoir la visite guidée » : la visite de l'accueil (et la phrase du compagnon à la 1re partie de chaque jeu)
   revient à la prochaine ouverture de l'accueil de cet enfant */
function tourRow(p) {
  const btn = h('button', { type: 'button', class: 'btn small white pa-tour-btn', 'data-fk': 'tour-replay' },
    h('span', { 'aria-hidden': 'true' }, '🔁'), 'Revoir la visite guidée');
  btn.addEventListener('click', () => {
    store.mutateProfile(q => {
      markSeen(q, 'tour', false);
      for (const g of Object.keys((q.seen && q.seen.games) || {})) markSeen(q, 'game:' + g, false);
      q.seen.again = true;          /* les phrases reviennent aussi pour les jeux déjà joués (game-shell.js, playedBefore) */
    }, p.id);
    audio.tap();
    done(frTypo('La visite guidée reviendra à la prochaine ouverture de l’accueil ✓'));
  });
  return h('div', { class: 'pa-row' },
    h('div', { class: 'pa-row-label' }, 'Visite guidée'),
    btn,
    h('p', { class: 'pa-help' }, frTypo('Le compagnon présente l’accueil à ' + p.name + ' (et chaque jeu, à la première partie), une seule fois. Ce bouton la fait revenir à la prochaine ouverture de l’accueil.')));
}
function settingsCard(p) {
  const id = p.id;
  const s = p.settings || {};
  const set = (fn, msg) => { store.mutateProfile(q => { if (!q.settings || typeof q.settings !== 'object') q.settings = {}; fn(q.settings, q); }, id); audio.tap(); done(msg); };
  const card = h('div', { class: 'card pa-card pa-settings' },
    h('h3', { class: 'pa-h3 pa-set-t' }, 'Pour ' + p.name));

  /* thème visuel : toucher une carte l'enregistre ; l'écran change aussitôt si c'est l'enfant actif */
  const themes = themeGrid({
    value: normalizeTheme(s.theme), compact: true, label: 'Thème ' + deNom(p.name),
    onPick: v => {
      const active = store.getProfile();
      const apply = () => set(x => { x.theme = v; }, frTypo('Thème : ' + themeOf(v).name + ' ✓'));
      if (active && active.id === id) swapTheme(apply); else apply();
    }
  });
  card.appendChild(h('div', { class: 'pa-row' },
    h('div', { class: 'pa-row-label' }, 'Thème (couleurs de l’appli)'),
    themes.el,
    h('p', { class: 'pa-help' }, frTypo('Huit univers au choix pour ' + p.name + ', qui peut aussi en changer depuis l’accueil avec le bouton 🎨. Seule l’interface change : les décors des jeux restent les mêmes.'))));

  card.appendChild(h('div', { class: 'pa-row' },
    h('div', { class: 'pa-row-label', id: 'pa-dur' }, 'Durée de la balade du jour'),
    seg(SESSION_MINUTES.map(m => [m, m + '\u00A0min']), SESSION_MINUTES.includes(s.sessionMin) ? s.sessionMin : 15,
      v => set((x, q) => {
        x.sessionMin = v;
        /* balade du jour pas encore commencée : recalculée à la nouvelle durée */
        const plan = q.today;
        if (plan && !(Array.isArray(plan.blocks) && plan.blocks.some(b => b && b.done))) q.today = null;
      }), 'Durée de la balade du jour'),
    h('p', { class: 'pa-help' }, frTypo('Environ 10, 15 ou 20 minutes : quatre petites étapes, la dernière est un jeu au choix.'))));

  if (READ_ALOUD_READY) card.appendChild(h('div', { class: 'pa-row' },
    h('div', { class: 'pa-row-label' }, 'Lire les consignes à voix haute'),
    seg([['on', 'Oui'], ['off', 'Non']], readAloudOf(s),
      v => set(x => { x.readAloud = v; }, frTypo(v === 'on' ? 'Lecture à voix haute : oui ✓' : 'Lecture à voix haute : non ✓')), 'Lire les consignes à voix haute'),
    h('p', { class: 'pa-help' }, frTypo('Oui (conseillé, dans toutes les classes) : le compagnon lit les consignes, les indices et la visite guidée quand les sons sont activés, et le bouton 🔊 relit la phrase ; le texte reste affiché. Non : rien n’est lu et 🔊 disparaît.')),
    voiceTest(p)));
  card.appendChild(tourRow(p));

  card.appendChild(switchRow('Chronomètre dans les jeux', 'Une jauge de temps douce s’affiche dans certains jeux (Galop des tables, Pommes express). Jamais d’échec quand le temps est écoulé.',
    !!s.timers, on => set(x => { x.timers = on; })));
  card.appendChild(switchRow('Sons', null, s.sound !== false, on => set(x => { x.sound = on; })));
  card.appendChild(switchRow('Animations douces', 'Moins de mouvements à l’écran : des fondus à la place des rebonds et des confettis.',
    s.motion === 'soft', on => set(x => { x.motion = on ? 'soft' : 'full'; })));

  const sub = s.subMethod === 'cassage' ? 'cassage' : 'compensation';
  const subHelp = h('p', { class: 'pa-help' }, frTypo(SUB_HELP[sub]));
  card.appendChild(h('div', { class: 'pa-row' },
    h('div', { class: 'pa-row-label' }, 'Soustraction posée'),
    seg([['compensation', 'par compensation'], ['cassage', 'par cassage']], sub, v => {
      set(x => { x.subMethod = v; });
      subHelp.textContent = frTypo(SUB_HELP[v]);
    }, 'Méthode de soustraction posée'),
    subHelp,
    h('p', { class: 'pa-help' }, frTypo('Choisissez la méthode apprise à l’école : une seule est enseignée du CE1 au CM2.'))));

  /* classe (« … passe en … ! » de juillet à septembre, comme le bandeau de l'accueil) */
  const next = offerNextClasse(p, dayStr());
  const changeClasse = async cl => {
    if (cl === p.classe) return true;
    const ok = await kit.confirmSheet(frTypo('Passer ' + p.name + ' en ' + cl + ' ? Les jeux, la balade du jour et le radar s’adapteront à cette classe.'),
      { ok: 'Oui, en ' + cl, cancel: 'Annuler', icon: '🎒' });
    if (!ok) return false;
    store.mutateProfile(q => { setClasse(q, cl, dayStr()); }, id);
    audio.success(3);
    done(frTypo('Classe : ' + cl + ' ✓'));
    later(() => renderContent({ keepScroll: true }));
    return true;
  };
  card.appendChild(h('div', { class: 'pa-row' },
    h('div', { class: 'pa-row-label' }, 'Classe'),
    seg(CLASSES.map(c => [c, c]), p.classe, changeClasse, 'Classe'),
    next ? h('button', { type: 'button', class: 'btn small pink pa-next', 'data-fk': 'class-next', on: { click: () => changeClasse(next) } }, frTypo(p.name + ' passe en ' + next + ' !')) : null));

  /* prénom */
  const input = h('input', { class: 'input', type: 'text', maxlength: '14', value: p.name, autocomplete: 'off', 'aria-labelledby': 'pa-name-l', enterkeyhint: 'done', 'data-fk': 'name-input' });
  const saveName = () => {
    const v = sanitizeName(input.value, p.name);
    input.value = v;
    if (v === store.getProfile(id).name) { saved('Prénom inchangé'); return; }
    store.mutateProfile(q => { q.name = v; }, id);
    audio.tap();
    done('Prénom enregistré ✓');
    later(() => renderContent({ keepScroll: true }));
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } });
  card.appendChild(h('div', { class: 'pa-row' },
    h('label', { class: 'pa-row-label', id: 'pa-name-l' }, 'Prénom'),
    h('div', { class: 'pa-inline' }, input, h('button', { type: 'button', class: 'btn small', 'data-fk': 'name-save', on: { click: saveName } }, 'Enregistrer'))));

  card.appendChild(h('div', { class: 'pa-row' },
    h('div', { class: 'pa-row-label' }, 'Fille ou garçon (accords des histoires)'),
    seg([['f', 'Fille'], ['m', 'Garçon']], p.g === 'm' ? 'm' : 'f', v => set((x, q) => { q.g = v; }), 'Fille ou garçon'),
    h('p', { class: 'pa-help' }, frTypo('Pour accorder les histoires de la course (« elle est fière » ou « il est fier »).'))));
  return card;
}

/* ---------- sur cet appareil : code parent, écran d'accueil (v2.2.2), voix fluide (v2.2.2), rappels ---------- */
function deviceCard() {
  const card = h('div', { class: 'card pa-card pa-device' },
    h('h3', { class: 'pa-h3 pa-set-t' }, 'Sur cet appareil'));
  /* code parent */
  const has = !!readPrefs().pin;
  card.appendChild(h('div', { class: 'pa-row' },
    h('div', { class: 'pa-row-label' }, 'Code parent'),
    h('p', { class: 'pa-dev-state' + (has ? ' is-on' : '') }, has
      ? frTypo('Activé ✓ : la porte demande le code.')
      : frTypo('Aucun code : la porte pose un calcul d’adulte (racine carrée).')),
    h('div', { class: 'pa-dev-acts' },
      h('button', { type: 'button', class: 'btn small' + (has ? ' white' : ''), 'data-fk': 'code-set', on: { click: () => { audio.tap(); openCodeSheet(); } } }, has ? 'Changer le code' : 'Choisir un code'),
      has ? h('button', { type: 'button', class: 'btn ghost', 'data-fk': 'code-del', on: { click: () => { audio.tap(); removeCode(); } } }, 'Supprimer le code') : null),
    h('p', { class: 'pa-help' }, frTypo('Quatre chiffres, propres à cet appareil, jamais inclus dans les sauvegardes. En cas d’oubli, « Code oublié ? » sur la porte propose le calcul d’adulte, puis un nouveau code.'))));
  /* v2.2.2 : Caramel sur l'écran d'accueil (état, vrai bouton « Installer » ou marche à suivre : js/ui/install.js) */
  card.appendChild(installRow({ say }));
  /* v2.2.2 : voix fluide (≈ 45 Mo, proposée ici aux parents : js/ui/voice-fluid.js) */
  card.appendChild(fluidRow({ say, saved }));
  card.appendChild(remindersRow());
  return card;
}
/* choisir ou changer le code : saisie puis confirmation, dans une feuille */
function openCodeSheet() {
  let first = '';
  const step = h('p', { class: 'pa-sheet-p pa-code-step' }, 'Choisissez 4\u00A0chiffres.');
  const msg = h('p', { class: 'pa-code-msg', 'aria-live': 'polite' });
  let s = null;
  const pp = pinPad({
    onComplete: async code => {
      if (!first) { first = code; pp.clear(); msg.textContent = ''; step.textContent = 'Retapez-les pour confirmer.'; return; }
      if (code !== first) { first = ''; pp.wrong(); step.textContent = 'Choisissez 4\u00A0chiffres.'; msg.textContent = 'Les deux codes ne correspondent pas. Recommencez.'; return; }
      pp.disable(true);
      const ok = await setCode(code);
      if (!ok) { msg.textContent = frTypo('Le code n’a pas pu être enregistré sur cet appareil.'); pp.disable(false); pp.clear(); first = ''; step.textContent = 'Choisissez 4\u00A0chiffres.'; return; }
      audio.success(3);
      if (s) await s.close('action');
      saved('Code parent enregistré ✓');
      later(() => renderContent({ keepScroll: true }));
    }
  });
  s = kit.sheet({
    title: 'Code parent',
    content: h('div', { class: 'pa-code-sheet' }, step, pp.dots, msg, pp.keys),
    onClose: () => { try { pp.destroy(); } catch (_) {} }
  });
}
async function removeCode() {
  const ok = await kit.confirmSheet(frTypo('Supprimer le code parent ? La porte posera de nouveau un calcul d’adulte.'), { ok: 'Supprimer le code', cancel: 'Annuler', icon: '🔐' });
  if (!ok) return;
  if (clearCode()) saved('Code parent supprimé');
  else kit.toast(frTypo('Le code n’a pas pu être supprimé sur cet appareil.'));
  later(() => renderContent({ keepScroll: true, focus: 'code-set' }));
}
/* « Activer les rappels » (réglages ou invitation) : le résultat est dit, jamais l'état initial */
async function enableReminders() {
  let r = 'unsupported';
  try { r = await notifs.enable(); } catch (_) {}
  if (r === 'daily') saved('Rappels quotidiens activés ✓');
  else if (r === 'on') saved('Notifications activées ✓');
  else if (r === 'denied') { kit.toast('Les notifications ont été refusées.'); say('Les notifications ont été refusées.'); }
  else { const t = frTypo('Les notifications ne sont pas disponibles sur cet appareil.'); kit.toast(t); say(t); }
  return r;
}
/* Caramel ouvert depuis l'écran d'accueil (appli installée) : seul cas où le rappel quotidien peut s'enregistrer */
function installedApp() {
  try { return !!(globalThis.matchMedia && globalThis.matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches); }
  catch (_) { return false; }
}
/* rappels quotidiens : l'état s'affiche sans être annoncé ; seul le résultat d'un geste du parent l'est */
function remindersRow() {
  const status = h('p', { class: 'pa-dev-state' }, 'Vérification…');
  const btn = h('button', { type: 'button', class: 'btn small white', hidden: true }, iconLabel('🔔', 'Activer les rappels'));
  const row = h('div', { class: 'pa-row pa-remind' },
    h('div', { class: 'pa-row-label' }, 'Rappels quotidiens'),
    status,
    h('div', { class: 'pa-dev-acts' }, btn),
    h('p', { class: 'pa-help' }, frTypo('Un petit rappel par jour pour garder la série 🔥, au moment choisi par Chrome (sur Android, une fois Caramel installé sur l’écran d’accueil).')));
  const refresh = async () => {
    let st = null;
    try { st = await notifs.status(); } catch (_) { st = null; }
    if (!row.isConnected && !host) return '';
    let txt;
    if (!st || !st.supported) { txt = frTypo('Les notifications ne sont pas disponibles sur cet appareil.'); btn.hidden = true; }
    else if (st.permission === 'denied') {
      const site = (() => { try { return globalThis.location.host || 'ce site'; } catch (_) { return 'ce site'; } })();
      txt = frTypo('Les notifications sont bloquées. Pour les autoriser : Paramètres d’Android › Applications › Caramel › Notifications (appli installée), ou Chrome › ⋮ › Paramètres › Paramètres des sites › Notifications › ' + site + '.');
      btn.hidden = true;
    } else if (st.permission === 'granted') {
      /* sans rappel quotidien enregistré : les mots de la notification de confirmation (notifs.NO_DAILY). « Activer »
         ne reste proposé que dans l'appli installée : ailleurs, un nouvel essai donnerait le même résultat */
      txt = st.daily ? 'Activés ✓' : frTypo(notifs.NO_DAILY);
      btn.hidden = !!st.daily || !installedApp();
    } else { txt = 'Désactivés.'; btn.hidden = false; }
    status.textContent = txt;
    return txt;
  };
  btn.addEventListener('click', async () => {
    audio.tap();
    await enableReminders();
    const hadFocus = document.activeElement === btn;
    await refresh();
    /* bouton retiré (rien de plus à faire ici) : le focus passe sur l'état, qui dit la suite */
    if (hadFocus && btn.hidden) { status.tabIndex = -1; try { status.focus({ preventScroll: true }); } catch (_) {} }
  });
  later(refresh);
  return row;
}

/* ---------- sauvegardes ---------- */
function exportProfileNow(p) {
  const f = backup.exportProfile(p);
  if (backup.downloadExport(f)) { backup.noteSaved([p]); saved('Sauvegarde ' + deNom(p.name) + ' téléchargée ✓'); return true; }
  kit.toast('Le téléchargement n’a pas pu démarrer.');
  return false;
}
function exportAllNow() {
  const f = backup.exportAll(store.getData());
  if (backup.downloadExport(f)) { backup.noteSaved(profileList()); saved('Sauvegarde de tous les profils téléchargée ✓'); return true; }
  kit.toast('Le téléchargement n’a pas pu démarrer.');
  return false;
}
async function importBackup() {
  const file = await backup.pickFile();
  if (!file) return;
  let text = '';
  try { text = await backup.readFileText(file); } catch (_) { kit.toast('Ce fichier n’a pas pu être lu.'); return; }
  const parsed = backup.parseBackup(text);
  if (parsed.errors.length) {
    audio.soft();
    kit.sheet({ title: 'Restauration impossible', content: h('p', { class: 'pa-sheet-p' }, frTypo(parsed.errors.join(' '))), actions: [{ label: 'Compris' }] });
    return;
  }
  if (parsed.kind === 'eval') {
    backup.stashEval(parsed);
    router.go('import', { query: { from: 'parents', method: 'file', profile: sel || '' } });
    return;
  }
  const res = await backup.restoreFlow(parsed, { store, kit });
  if (!res) return;
  audio.success(3);
  if (res.ids && res.ids.length && (res.mode !== 'all' || !store.getProfile(sel))) sel = res.ids[0];
  renderContent({ keepScroll: true });
}
async function shareNow(p) {
  const r = await backup.shareExport(backup.exportProfile(p), { title: 'Sauvegarde Caramel ' + deNom(p.name) });
  if (r === 'shared' || r === 'downloaded') backup.noteSaved([p]);
  if (r === 'shared') saved('Sauvegarde partagée ✓');
  else if (r === 'downloaded') saved(frTypo('Partage indisponible : sauvegarde téléchargée ✓'));
  else if (r === 'failed') kit.toast('Le partage n’a pas pu se faire.');
}
function canWebShare() {
  try { const n = globalThis.navigator; return !!n && typeof n.share === 'function' && typeof n.canShare === 'function'; } catch (_) { return false; }
}
function backupCard(p) {
  const iso = backup.lastSaved(p);
  const when = iso ? relDay(dayStr(new Date(iso)), dayStr()) : '';
  return h('div', { class: 'card pa-card pa-backup' },
    h('p', { class: 'pa-note' }, frTypo('Les progrès restent sur cet appareil : Caramel ne les envoie nulle part. Téléchargez une sauvegarde de temps en temps, et avant de changer de téléphone.')),
    h('p', { class: 'pa-backup-last' + (when ? '' : ' is-never') }, frTypo(when
      ? 'Dernière sauvegarde ' + deNom(p.name) + ' téléchargée d’ici : ' + when + '.'
      : 'Aucune sauvegarde ' + deNom(p.name) + ' téléchargée depuis cet appareil pour l’instant.')),
    h('div', { class: 'pa-actions' },
      h('button', { type: 'button', class: 'btn', 'data-fk': 'bk-one', on: { click: () => { audio.tap(); if (exportProfileNow(store.getProfile(p.id) || p)) later(() => renderContent({ keepScroll: true })); } } },
        iconLabel('⬇️', 'Télécharger la sauvegarde ' + deNom(p.name))),
      h('button', { type: 'button', class: 'btn white', 'data-fk': 'bk-all', on: { click: () => { audio.tap(); if (exportAllNow()) later(() => renderContent({ keepScroll: true })); } } },
        iconLabel('⬇️', 'Télécharger tous les profils')),
      h('button', { type: 'button', class: 'btn white', 'data-fk': 'bk-restore', on: { click: () => { audio.tap(); importBackup(); } } }, iconLabel('⬆️', 'Restaurer une sauvegarde')),
      canWebShare() ? h('button', { type: 'button', class: 'btn white', on: { click: () => { audio.tap(); shareNow(store.getProfile(p.id) || p); } } }, iconLabel('📤', 'Partager la sauvegarde')) : null));
}

/* ---------- profils ---------- */
/* prénom recopié : sans tenir compte des accents ni des majuscules (« Ines » = « Inès ») */
const normName = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036F]/g, '').trim().toLocaleLowerCase('fr');
/* supprime un profil de l'appareil, et la date de sa dernière sauvegarde : son identifiant pourra resservir à un autre
   enfant (nouveau profil, restauration), qui ne doit jamais hériter de cette date → true si le profil a été supprimé */
export function dropProfile(id, { st } = {}) {
  const ok = store.removeProfile(id);
  backup.forgetSaved([id], { st });
  return ok;
}
function deleteProfile(q) {
  const errId = 'pa-del-err-' + q.id;
  const input = h('input', { class: 'input', type: 'text', autocomplete: 'off', placeholder: q.name, enterkeyhint: 'done', 'aria-describedby': errId });
  const err = h('p', { class: 'pa-del-msg', id: errId, 'aria-live': 'polite' });
  const content = h('div', { class: 'pa-del' },
    h('p', { class: 'pa-sheet-p' }, frTypo('Tous les progrès ' + deNom(q.name) + ' (radar, pommes, étoiles, compagnon) seront effacés de cet appareil. C’est définitif : pensez à télécharger une sauvegarde avant.')),
    h('button', { type: 'button', class: 'btn white small', on: { click: () => exportProfileNow(q) } }, iconLabel('⬇️', 'Télécharger d’abord')),
    h('label', { class: 'pa-del-l' }, frTypo('Pour confirmer, recopiez le prénom « ' + q.name + ' » :'), input),
    err);
  const okName = () => normName(input.value) !== '' && normName(input.value) === normName(q.name);
  const s = kit.sheet({
    title: frTypo('Supprimer le profil ' + deNom(q.name) + ' ?'), content,
    actions: [
      { label: 'Annuler', kind: 'white' },
      { label: 'Supprimer', kind: 'pink', onClick: () => {
        if (!okName()) {
          input.setAttribute('aria-invalid', 'true');
          err.textContent = frTypo(input.value.trim() ? 'Le prénom ne correspond pas : recopiez « ' + q.name + ' ».' : 'Recopiez « ' + q.name + ' » pour confirmer.');
          kit.gentleWrong(input);
          input.focus();
          return false;
        }
        const wasSel = q.id === sel;
        dropProfile(q.id);
        audio.soft();
        kit.toast('Profil ' + deNom(q.name) + ' supprimé');
        if (!store.listProfiles().length) { router.go('onboarding'); return true; }
        if (wasSel) sel = null;
        later(() => renderContent({ keepScroll: true, focus: 'sec-profils' }));
        return true;
      } }
    ]
  });
  /* bouton « Supprimer » grisé (aria-disabled) tant que le prénom ne correspond pas ; message effacé à la saisie */
  const del = s.el && s.el.querySelector('.kit-sheet-actions .btn.pink');
  const sync = () => { if (del) del.setAttribute('aria-disabled', okName() ? 'false' : 'true'); };
  sync();
  input.addEventListener('input', () => { input.removeAttribute('aria-invalid'); err.textContent = ''; sync(); });
  setTimeout(() => { try { input.focus(); } catch (_) {} }, 350);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (del) del.click(); } });
}
function profilesCard() {
  const list = profileList();
  return h('div', { class: 'card pa-card pa-profiles' },
    h('ul', { class: 'pa-prof-list' }, list.map(q => h('li', { class: 'pa-prof' },
      petEl(q, 'pa-prof-ava', 44),
      h('div', { class: 'pa-prof-txt' },
        h('div', { class: 'pa-prof-name' }, q.name),
        h('div', { class: 'pa-prof-meta' }, [q.classe || 'classe à choisir', (q.companion && q.companion.name) ? 'avec ' + q.companion.name : ''].filter(Boolean).join(' · '))),
      h('button', { type: 'button', class: 'btn ghost pa-prof-del', 'aria-label': 'Supprimer le profil ' + deNom(q.name), 'data-fk': 'del-' + q.id, on: { click: () => { audio.tap(); deleteProfile(q); } } }, 'Supprimer')))),
    h('button', { type: 'button', class: 'btn white block', 'data-fk': 'add-child', on: { click: () => { audio.tap(); router.go('onboarding'); } } }, iconLabel('➕', 'Ajouter un enfant')));
}

/* ---------- à propos (l'état du moteur vocal, du son et des voix : « État de cet appareil », js/ui/diag.js) ---------- */
function aboutCard() {
  let v = '2.0.0';
  try { const m = globalThis.document.querySelector('meta[name="caramel-version"]'); if (m && m.content) v = m.content; } catch (_) {}
  const link = (href, text) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text, h('span', { class: 'sr-only' }, ' (nouvel onglet)'));
  return h('div', { class: 'card pa-card pa-about' },
    h('div', { class: 'pa-about-row' }, h('span', null, 'Version'), h('b', null, 'Caramel ' + v)),
    h('p', { class: 'pa-note' }, frTypo('Pas de compte ni de serveur Caramel : les résultats et les photos restent sur cet appareil.')),
    h('p', { class: 'pa-note' }, frTypo('La voix de l’enfant est reconnue sur l’appareil par le moteur vocal intégré. S’il ne peut pas se charger, Caramel utilise la reconnaissance vocale du navigateur : dans Chrome, la voix passe alors par les serveurs de Google.')),
    h('p', { class: 'pa-note' }, frTypo('Le moteur vocal (environ 48\u00A0Mo) et la voix fluide (environ 45\u00A0Mo) se téléchargent une seule fois, en arrière-plan, dès la première ouverture de Caramel. En données mobiles ou en économie de données, rien ne part sans votre accord : « Télécharger maintenant », sur l’accueil.')),
    h('p', { class: 'pa-note' }, frTypo('Caramel n’établit aucun diagnostic.')),
    h('p', { class: 'pa-note pa-credits' }, frTypo('Voix du compagnon : Piper (Rhasspy, licence MIT), voix siwis — SIWIS French Speech Synthesis Database, CC BY 4.0 ('),
      link('https://datashare.is.ed.ac.uk/handle/10283/2353', 'datashare.is.ed.ac.uk'), frTypo('), rajeunie en voix d’enfant (hauteur et timbre relevés de 5\u00A0demi-tons).')),
    /* v2.2.2 : voix fluide — rien de GPL n'est hébergé par Caramel : espeak-ng vient de jsDelivr (paquet
       @diffusionstudio/piper-wasm), seule sa partie française est gardée sur l'appareil */
    h('p', { class: 'pa-note pa-credits' }, frTypo('Voix fluide, calculée sur l’appareil : la même voix siwis rajeunie, poids convertis en float16 ; onnxruntime-web (Microsoft, licence MIT) ; piper-phonemize (licence MIT) et espeak-ng (licence GPL-3.0 ou ultérieure, '),
      link('https://github.com/rhasspy/espeak-ng', 'code source'), frTypo('), téléchargés depuis jsDelivr.')),
    h('p', { class: 'pa-note pa-credits' }, 'Créé par ', link(LINKEDIN_PROFILE, 'Cédric Delalande'), frTypo('. Une idée, un souci ? '),
      link(FEEDBACK_URL, 'Écrivez-moi sur LinkedIn'), '.'));
}

/* retour Android pendant qu'une feuille est ouverte : on la referme (Échap = fermeture propre du kit) */
function closeSheets() {
  try {
    if (globalThis.document.querySelector('.kit-overlay')) {
      globalThis.document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
  } catch (_) {}
}

/* ============ ÉCRAN ============ */
export default {
  async mount(root, params = {}, query = {}) {
    host = root;
    /* retour de l'écran d'import : il indique le profil qui vient de recevoir la fiche */
    let handed = '';
    try { handed = globalThis.sessionStorage.getItem('caramel-parents-sel') || ''; globalThis.sessionStorage.removeItem('caramel-parents-sel'); } catch (_) {}
    if (query && query.profile && store.getProfile(query.profile)) sel = query.profile;
    else if (handed && store.getProfile(handed)) sel = handed;
    else if (!sel || !store.getProfile(sel)) sel = null;
    await Promise.race([Promise.all([loadCSS('css/ui/parents.css'), radarReady(), loadKeyLabels()]), new Promise(r => setTimeout(r, 1200))]);
    if (host !== root) return;
    try { document.title = 'Espace parents · Caramel'; } catch (_) {}
    if (gateOpen()) { gateRefresh(); renderContent(); }
    else renderGate();
    const onVis = () => { if (globalThis.document.visibilityState === 'visible' && host && !gateOpen() && !host.querySelector('.pa-gate')) renderGate(); };
    globalThis.document.addEventListener('visibilitychange', onVis);
    const onFocusIn = e => {
      const k = e.target && e.target.closest ? e.target.closest('[data-fk]') : null;
      if (k && root.contains(k)) lastFk = k.getAttribute('data-fk');
    };
    root.addEventListener('focusin', onFocusIn);
    this._off = () => { globalThis.document.removeEventListener('visibilitychange', onVis); root.removeEventListener('focusin', onFocusIn); };
  },
  unmount() {
    cleanup();
    if (this._off) { this._off(); this._off = null; }
    host = null;
    live = null;
    lastFk = null;
    closeSheets();
    /* retour côté enfant : la porte se referme (le routeur a déjà posé le hash de destination) ; l'import de fiche
       lancé d'ici revient dans l'espace parents sans nouveau calcul */
    let to = '';
    try { to = String(globalThis.location.hash || ''); } catch (_) {}
    if (!/^#\/(import|parents)(?=$|[/?])/.test(to)) gateClose();
  }
};
