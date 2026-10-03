/* ============ ESPACE PARENTS (JEUX.md §8 ; CDC §8, §9, §12) ============
   Porte : calcul du type « 47 × 6 + 18 = ? » (tiré au hasard, nouveau calcul après une erreur) sur le pavé
   du kit ; déverrouillage pour 10 minutes glissantes
   (sessionStorage 'caramel-parents-until', prolongé à chaque geste dans l'écran).
   Puis, pour le profil choisi (pastilles) :
   - vue d'ensemble (temps, parties, série, dernière séance) ;
   - radars avec valeurs (libellés officiels, fiche en pointillés) + curseur des semaines (snapshots) ;
   - détail par compétence (⊕ θ, tendance ↗ → ↘, réponses observées, dernier entraînement, jeu associé) ;
   - courbe de lecture à voix haute (MCLM) contre l'attendu de la classe et l'objectif de fin d'année ;
   - « à revoir » (Leitner, boîtes 1-2) : tables, conjugaison, mots de lecture ;
   - évaluations importées + import (photo / saisie / fichier → #/import) ;
   - réglages (mutateProfile) ; sauvegardes (backup.js) ; profils ; rappels ; version.
   Toute écriture passe par store.mutateProfile / store.mutate. Rien n'est jamais affiché à l'enfant ici. */

import { h, svg, clear, loadCSS, dayStr, daysBetween, parseDay, fmtNum, frTypo } from '../core/util.js';
import * as store from '../core/store.js';
import * as router from '../router.js';
import { radarTemplate, AXES, CLASSES, SUBJECTS } from '../core/axes.js';
import { currentValues, referenceValues, inProgress } from '../core/radar-model.js';
import { mclmExpected, mclmTarget } from '../core/levels.js';
import { weakKeys } from '../core/leitner.js';
import { setClasse, offerNextClasse, sanitizeName, SESSION_MINUTES } from '../core/profiles.js';
import { totalStars } from '../core/economy.js';
import { GAMES } from '../games/index.js';
import { MOUNTS } from '../content/companion-data.js';
import * as notifs from '../core/notifs.js';
import * as kit from './kit.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import { renderRadar, radarReady, fmtTheta, levelMarks } from './radar.js';
import * as backup from './backup.js';

/* ---------- porte ---------- */
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
/* réponses observées dans les jeux (sans le poids d'initialisation d'une fiche ou de l'estimation v11) */
function obsCount(sk) {
  if (!sk || typeof sk !== 'object') return 0;
  const init = sk.src === 'eval' ? 4 : sk.src === 'v11' ? 1 : 0;
  return Math.max(0, (Number(sk.n) || 0) - init);
}
function lastPlayed(p, axis) {
  let last = '';
  for (const e of Array.isArray(p.history) ? p.history : []) if (e && e.ax === axis && typeof e.d === 'string' && e.d > last) last = e.d.slice(0, 10);
  if (!last) {
    const sk = p.skills && p.skills[axis];
    if (sk && obsCount(sk) > 0 && typeof sk.last === 'string') last = sk.last;
  }
  return last;
}

/* ============ PORTE ============ */
function newProblem(prev) {
  let a, b, c;
  do {
    a = 23 + Math.floor(Math.random() * 67);
    b = 4 + Math.floor(Math.random() * 6);
    c = 11 + Math.floor(Math.random() * 39);
  } while (a % 10 === 0 || (prev && prev.a === a));
  return { a, b, c, answer: a * b + c };
}

function renderGate() {
  if (!host) return;                    /* écran démonté (rappel tardif d'une feuille, d'une minuterie) */
  cleanup();
  clear(host);
  let prob = newProblem();
  const back = h('button', { type: 'button', class: 'back', 'aria-label': 'Retour à l’accueil', on: { click: () => { audio.tap(); router.back(); } } }, '←');
  const expr = h('div', { class: 'pa-gate-expr num', 'aria-live': 'polite' });
  const note = h('p', { class: 'pa-gate-note', role: 'status', 'aria-live': 'polite' });
  const showProb = () => { expr.textContent = prob.a + '\u00A0×\u00A0' + prob.b + '\u00A0+\u00A0' + prob.c + '\u00A0=\u00A0?'; };
  showProb();
  const kp = kit.keypad({
    maxLen: 4,
    submitLabel: 'Entrer ✓',
    onSubmit: v => {
      if (Number(v) === prob.answer) {
        kp.setState('right');
        kp.disable(true);
        audio.success(4);
        gateRefresh();
        setTimeout(() => { if (host) renderContent({ entering: true }); }, motion.reduced() ? 60 : 380);
      } else {
        kp.setState('wrong');
        kit.gentleWrong(kp.answer);
        note.textContent = frTypo('Ce n’est pas le bon résultat. Voici un autre calcul.');
        prob = newProblem(prob);
        setTimeout(() => { showProb(); motion.pop(expr, { scale: 1.06 }); kp.clear(); }, 650);
      }
    }
  });
  cleanups.push(() => kp.destroy());
  const box = h('div', { class: 'screen pa-gate' },
    h('div', { class: 'topbar' }, back, h('h1', { class: 'topbar-title' }, 'Espace parents'), h('span', { class: 'pa-gap', 'aria-hidden': 'true' })),
    h('div', { class: 'pa-gate-card card' },
      h('div', { class: 'pa-gate-lock', 'aria-hidden': 'true' }, '🔒'),
      h('p', { class: 'pa-gate-lead' }, frTypo('Cet espace est réservé aux grands.')),
      h('p', { class: 'pa-gate-ask' }, frTypo('Pour entrer, calculez :')),
      expr, note),
    h('div', { class: 'pa-gate-pad' }, kp.el));
  host.appendChild(box);
  motion.enter(box.querySelector('.pa-gate-card'), { from: 'scale' });
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
    h('h2', { class: 'section-title pa-sec-title', id: 'pa-' + id + '-t', tabindex: '-1' }, title), ...children);
}

function renderContent({ entering = false, keepScroll = false } = {}) {
  if (!host) return;
  const y = keepScroll ? (globalThis.scrollY || 0) : 0;
  cleanup();
  clear(host);
  const p = current();
  live = h('div', { class: 'sr-only', 'aria-live': 'polite' });
  const back = h('button', { type: 'button', class: 'back', 'aria-label': 'Retour à l’accueil', on: { click: () => { audio.tap(); router.back(); } } }, '←');
  const lock = h('button', { type: 'button', class: 'btn-icon pa-lock', 'aria-label': 'Verrouiller l’espace parents',
    on: { click: () => { audio.tap(); gateClose(); renderGate(); } } }, '🔒');
  const screen = h('div', { class: 'screen pa-screen' },
    h('div', { class: 'topbar' }, back, h('h1', { class: 'topbar-title' }, 'Espace parents'), lock), live);
  host.appendChild(screen);

  if (!p) {
    screen.appendChild(h('div', { class: 'card pa-empty' },
      h('p', null, frTypo('Aucun profil sur cet appareil pour l’instant.')),
      h('div', { class: 'pa-actions' },
        h('button', { type: 'button', class: 'btn', on: { click: () => router.go('onboarding') } }, 'Ajouter un enfant ➕'),
        h('button', { type: 'button', class: 'btn white', on: { click: () => importBackup() } }, 'Restaurer une sauvegarde'))));
    return;
  }

  /* pastilles des profils + navigation dans la page */
  const pills = h('div', { class: 'pa-pills', role: 'group', 'aria-label': 'Profil affiché' },
    profileList().map(q => {
      const m = MOUNTS[q.companion && q.companion.type] || MOUNTS.pony;
      return h('button', { type: 'button', class: ['chip', 'pa-pill', q.id === p.id && 'on'], 'aria-pressed': q.id === p.id ? 'true' : 'false',
        on: { click: () => { if (q.id === sel) return; audio.tap(); sel = q.id; renderContent(); } } },
      h('span', { class: 'pa-pill-emo', 'aria-hidden': 'true' }, m.em), q.name, q.classe ? h('span', { class: 'pa-pill-cl' }, q.classe) : null);
    }));
  const nav = h('nav', { class: 'pa-nav', 'aria-label': 'Rubriques' },
    /* boutons (et non ancres #pa-…) : le routeur hash ne doit jamais voir ces cibles */
    [['progres', 'Progrès'], ['evals', 'Évaluations'], ['reglages', 'Réglages'], ['sauvegardes', 'Sauvegardes'], ['profils', 'Profils']]
      .map(([id, label]) => h('button', { type: 'button', class: 'pa-nav-a', 'aria-controls': 'pa-' + id, on: { click: () => {
        audio.tap();
        const t = globalThis.document.getElementById('pa-' + id);
        if (!t) return;
        try { t.scrollIntoView({ behavior: motion.reduced() ? 'auto' : 'smooth', block: 'start' }); } catch (_) { t.scrollIntoView(); }
        const ttl = t.querySelector('.pa-sec-title');
        if (ttl) { try { ttl.focus({ preventScroll: true }); } catch (_) {} }
      } } }, label)));
  screen.append(pills, nav);

  if (!store.storageOk()) {
    screen.appendChild(h('div', { class: 'banner pa-warn', role: 'alert' },
      h('span', { class: 'pa-warn-emo', 'aria-hidden': 'true' }, '⚠️'),
      h('div', { class: 'pa-warn-txt' },
        h('strong', null, 'La sauvegarde automatique ne fonctionne pas sur cet appareil.'),
        h('span', null, frTypo(' Navigation privée ou stockage plein : les progrès seront perdus à la fermeture. Exportez une sauvegarde pour les garder.'))),
      h('button', { type: 'button', class: 'btn small', on: { click: () => exportAllNow() } }, 'Exporter')));
  }

  const blocks = [
    section('progres', 'Progrès de ' + p.name, overview(p), radarsCard(p), axisTable(p), mclmCard(p), reviewCard(p)),
    section('evals', 'Évaluations', evalsCard(p)),
    section('reglages', 'Réglages de ' + p.name, settingsCard(p)),
    section('sauvegardes', 'Sauvegardes', backupCard(p)),
    section('profils', 'Profils', profilesCard(p)),
    section('rappels', 'Rappels', remindersCard()),
    section('apropos', 'À propos', aboutCard())
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
    motion.stagger([...screen.querySelectorAll('.pa-pills, .pa-nav, .pa-sec')].slice(0, 4), el => motion.enter(el, { from: 'bottom' }), 70);
  }
  if (keepScroll) { try { globalThis.scrollTo(0, y); } catch (_) {} }
}

/* ---------- vue d'ensemble ---------- */
function tile(label, value, sub) {
  return h('div', { class: 'pa-tile' },
    h('div', { class: 'pa-tile-label' }, label),
    h('div', { class: 'pa-tile-value' }, value),
    sub ? h('div', { class: 'pa-tile-sub' }, sub) : null);
}
function overview(p) {
  const today = dayStr();
  const st = p.stats || {};
  let last = '';
  for (const e of p.history || []) if (e && typeof e.d === 'string' && e.d > last) last = e.d.slice(0, 10);
  const streak = p.streak && p.streak.count ? p.streak.count : 0;
  const m = MOUNTS[p.companion && p.companion.type] || MOUNTS.pony;
  const head = h('div', { class: 'pa-who' },
    h('span', { class: 'pa-who-ava', 'aria-hidden': 'true' }, m.em),
    h('div', { class: 'pa-who-txt' },
      h('div', { class: 'pa-who-name' }, p.name),
      h('div', { class: 'pa-who-meta' }, [p.classe ? 'Classe de ' + p.classe : 'Classe non choisie',
        fmtNum((p.wallet && p.wallet.apples) || 0) + '\u00A0🍎', fmtNum(totalStars(p)) + '\u00A0⭐'].join(' · '))));
  return h('div', { class: 'card pa-card pa-overview' }, head,
    h('div', { class: 'pa-tiles' },
      tile('Temps d’apprentissage', duration(st.minutes)),
      tile('Parties terminées', fmtNum(st.sessions || 0)),
      tile('Série en cours', streak ? plural(streak, 'jour', 'jours') + ' 🔥' : '—'),
      tile('Dernière séance', last ? relDay(last, today) : 'pas encore')));
}

/* ---------- radars ---------- */
function radarsCard(p) {
  const today = dayStr();
  const classe = p.classe || 'CM2';
  const wrap = h('div', { class: 'pa-radars' });
  const card = h('div', { class: 'card pa-card pa-radar-card' });
  const refs = {}, tpls = {}, radars = {};
  const evDate = (p.evals || []).reduce((best, e) => (e && typeof e.date === 'string' && e.date > best ? e.date : best), '');
  const legend = h('div', { class: 'pa-legend' },
    evDate ? h('span', { class: 'pa-legend-item' }, h('span', { class: 'pa-key pa-key--ref', 'aria-hidden': 'true' }), 'Fiche de ' + monthLabel(evDate)) : null,
    h('span', { class: 'pa-legend-item' }, h('span', { class: 'pa-key pa-key--cur', 'aria-hidden': 'true' }), 'Maintenant'),
    h('span', { class: 'pa-legend-item' }, h('span', { 'aria-hidden': 'true' }, '✨'), 'En progrès'));
  card.append(legend, wrap);
  for (const subject of ['fr', 'ma']) {
    const tpl = tpls[subject] = radarTemplate(classe, subject);
    const ref = refs[subject] = referenceValues(p, subject);
    const values = currentValues(p, tpl);
    const twinkle = tpl.axes.filter(a => inProgress(p, a.id, today)).map(a => a.id);
    const holder = h('div', { class: 'pa-radar' });
    wrap.appendChild(h('div', { class: 'pa-radar-col' },
      h('h3', { class: 'pa-h3' }, h('span', { 'aria-hidden': 'true' }, SUBJECTS[subject].emoji + ' '), subject === 'fr' ? 'Français' : 'Mathématiques'), holder));
    later(() => {
      if (!holder.isConnected) return;
      const r = renderRadar(holder, {
        template: tpl, values, reference: ref, subject, labels: 'official', showValues: true, twinkle, size: 470,
        nullLabel: id => (ref && Object.prototype.hasOwnProperty.call(ref, id) && ref[id] === null ? 'absent' : 'non observé'),
        title: 'Radar de ' + (subject === 'fr' ? 'français' : 'mathématiques') + ' de ' + p.name
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
  card.appendChild(h('p', { class: 'pa-note' }, frTypo('Échelle des fiches officielles : sous ⊕ = à consolider, ⊕ = 1, ⊕⊕ = 2, ⊕⊕⊕ = 3. Les compétences pas encore entraînées par un jeu gardent la valeur de la fiche.')));
  return card;
}
/* lundi de la semaine d'un jour */
function weekMonday(d) {
  const x = parseDay(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}

/* ---------- détail par compétence ---------- */
function axisTable(p) {
  const today = dayStr();
  const classe = p.classe || 'CM2';
  const card = h('div', { class: 'card pa-card pa-axes' });
  for (const subject of ['fr', 'ma']) {
    const tpl = radarTemplate(classe, subject);
    const vals = currentValues(p, tpl);
    const ref = referenceValues(p, subject) || {};
    const head = h('div', { role: 'row', class: 'pa-tr pa-thead' },
      ['Compétence', 'Niveau', 'Tendance', 'Réponses', 'Dernier entraînement', 'Jeu'].map((t, i) =>
        h('span', { role: 'columnheader', class: 'pa-th c' + i }, t)));
    const rows = tpl.axes.map(a => {
      const def = AXES[a.id];
      const v = vals[a.id];
      const sk = p.skills && p.skills[a.id];
      const obs = obsCount(sk);
      const last = lastPlayed(p, a.id);
      const g = gameOf(a.id);
      const played = obs > 0 || !!last;
      const tr = sk && Number(sk.trend);
      const trend = !played || !isNum(tr) ? null
        : tr > 0.05 ? { s: '↗', t: 'progresse', k: 'up' } : tr < -0.05 ? { s: '↘', t: 'recule un peu', k: 'down' } : { s: '→', t: 'stable', k: 'flat' };
      /* valeur venue de la fiche (pas encore observée dans un jeu) : petite mention « fiche » */
      const fromFiche = isNum(v) && !played;
      const level = isNum(v)
        ? h('span', { class: 'pa-lvl' }, h('span', { class: 'pa-lvl-m' }, levelMarks(v) || 'sous ⊕'), ' ', h('b', { class: 'num' }, fmtTheta(v)),
          fromFiche ? h('span', { class: 'pa-lvl-src' }, 'fiche') : null)
        : h('span', { class: 'pa-lvl is-none' }, Object.prototype.hasOwnProperty.call(ref, a.id) && ref[a.id] === null ? 'absent' : 'non observé');
      const none = (sr) => [h('span', { 'aria-hidden': 'true' }, '—'), h('span', { class: 'sr-only' }, sr)];
      return h('div', { role: 'row', class: ['pa-tr', !g && 'is-soon', !played && 'is-unplayed'] },
        h('span', { role: 'cell', class: 'pa-td c0' }, tpl.official || !def ? a.label : def.label),
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
    h('span', { class: 'pa-legend-item' }, h('span', { class: 'pa-key pa-key--line', 'aria-hidden': 'true' }), 'Lectures de ' + p.name),
    h('span', { class: 'pa-legend-item' }, h('span', { class: 'pa-key pa-key--dash', 'aria-hidden': 'true' }), 'Attendu en ' + classe));
  const box = h('div', { class: 'pa-chart', tabindex: '0', role: 'img' });
  const tip = h('div', { class: 'pa-tip', 'aria-hidden': 'true' });
  const chartWrap = h('div', { class: 'pa-chart-wrap' }, box, tip);
  const last = pts[pts.length - 1];
  box.setAttribute('aria-label', plural(pts.length, 'lecture', 'lectures') + ' du ' + longDate(pts[0].d) + ' au ' + longDate(last.d) +
    ' ; dernière : ' + last.v + ' mots par minute ; attendu aujourd’hui : environ ' + expNow + ' ; objectif de fin d’année : ' + target + '. Flèches gauche et droite pour parcourir les lectures.');
  const table = h('details', { class: 'pa-details' },
    h('summary', null, 'Voir toutes les lectures'),
    h('table', { class: 'pa-mini-table' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Date'), h('th', { scope: 'col' }, 'Mots/min'), h('th', { scope: 'col' }, 'Précision'), h('th', { scope: 'col' }, 'Attendu'))),
      h('tbody', null, pts.slice().reverse().map(x => h('tr', null,
        h('td', null, longDate(x.d)), h('td', { class: 'num' }, fmtNum(x.v)), h('td', { class: 'num' }, x.pr !== null ? x.pr + '\u00A0%' : '—'),
        h('td', { class: 'num' }, fmtNum(Math.round(mclmExpected(classe, x.d)))))))));
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
    tip.append(h('b', null, x.v + ' mots/min'), h('span', null, longDate(x.d)),
      h('span', null, 'attendu\u00A0: ' + Math.round(mclmExpected(classe, x.d)) + (x.pr !== null ? ' · précision ' + x.pr + '\u00A0%' : '')));
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

/* ---------- à revoir (Leitner, boîtes 1-2) ---------- */
function reviewCard(p) {
  const groups = [
    { title: 'Tables et calculs', emo: '✖️', keys: weakKeys(p, 'ma.faits', 12), fmt: k => factLabel(k) },
    { title: 'Conjugaison', emo: '🎻', keys: weakKeys(p, 'fr.conjug', 12), fmt: k => conjLabel(k) },
    { title: 'Mots de lecture', emo: '📖', keys: weakKeys(p, 'fr.fluence', 12), fmt: k => wordLabel(p, k) }
  ];
  const any = groups.some(g => g.keys.length);
  const card = h('div', { class: 'card pa-card pa-review' },
    h('h3', { class: 'pa-h3' }, h('span', { 'aria-hidden': 'true' }, '🔁 '), 'À revoir'),
    h('p', { class: 'pa-note' }, any
      ? frTypo('Ce que ' + p.name + ' a eu du mal à retrouver ces derniers jours. Ces éléments reviennent tout seuls dans les jeux (répétition espacée) ; vous pouvez aussi les reprendre ensemble.')
      : frTypo('Rien à revoir pour l’instant 🎉 Les tables, formes verbales et mots difficiles apparaîtront ici au fil des parties.')));
  for (const g of groups) {
    if (!g.keys.length) continue;
    card.appendChild(h('div', { class: 'pa-rev' },
      h('h4', { class: 'pa-rev-t' }, g.title),
      h('ul', { class: 'pa-chips' }, g.keys.map(k => h('li', { class: 'pa-chip' + (g.title === 'Mots de lecture' ? ' read' : '') }, g.fmt(k))))));
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
  } else {
    card.appendChild(h('p', { class: 'pa-note' }, frTypo('Aucune évaluation importée. Avec la fiche Repères de septembre, Caramel démarre directement au bon niveau.')));
  }
  const go = method => { audio.tap(); router.go('import', { query: { from: 'parents', method, profile: p.id } }); };
  card.appendChild(h('div', { class: 'pa-import' },
    h('button', { type: 'button', class: 'btn pa-imp', on: { click: () => go('photo') } }, h('span', { 'aria-hidden': 'true' }, '📷'), 'Photo de la fiche'),
    h('button', { type: 'button', class: 'btn white pa-imp', on: { click: () => go('manual') } }, h('span', { 'aria-hidden': 'true' }, '✋'), 'Saisie manuelle'),
    h('button', { type: 'button', class: 'btn white pa-imp', on: { click: () => go('file') } }, h('span', { 'aria-hidden': 'true' }, '📄'), 'Fichier')));
  return card;
}

/* ---------- réglages ---------- */
function seg(options, value, onPick, label) {
  const box = h('div', { class: 'seg pa-seg', role: 'radiogroup', 'aria-label': label });
  const btns = options.map(([v, text]) => h('button', { type: 'button', role: 'radio', class: v === value ? 'on' : null, 'aria-checked': v === value ? 'true' : 'false', 'data-v': String(v) }, text));
  box.append(...btns);
  box.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || !box.contains(b)) return;
    const v = options.find(o => String(o[0]) === b.dataset.v)[0];
    Promise.resolve(onPick(v)).then(ok => {
      if (ok === false) return;
      btns.forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); });
    });
  });
  return box;
}
function switchRow(label, help, checked, onToggle) {
  const id = 'pa-sw-' + Math.random().toString(36).slice(2, 8);
  const sw = h('span', { class: 'switch', 'aria-hidden': 'true' });
  const btn = h('button', { type: 'button', class: 'pa-switch-row', role: 'switch', 'aria-checked': checked ? 'true' : 'false', 'aria-describedby': help ? id : null },
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
function settingsCard(p) {
  const id = p.id;
  const s = p.settings || {};
  const set = (fn, msg) => { store.mutateProfile(q => { if (!q.settings || typeof q.settings !== 'object') q.settings = {}; fn(q.settings, q); }, id); audio.tap(); saved(msg); };
  const card = h('div', { class: 'card pa-card pa-settings' });

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

  card.appendChild(switchRow('Chronomètre dans les jeux', 'Une jauge de temps douce s’affiche dans certains jeux (tables, pommes). Jamais d’échec quand le temps est écoulé.',
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
    h('p', { class: 'pa-help' }, frTypo('Choisissez la méthode de l’école : un seul algorithme est enseigné du CE1 au CM2.'))));

  /* classe (« … passe en … ! » de juillet à septembre, comme le bandeau de l'accueil) */
  const next = offerNextClasse(p, dayStr());
  const changeClasse = async cl => {
    if (cl === p.classe) return true;
    const ok = await kit.confirmSheet(frTypo('Passer ' + p.name + ' en ' + cl + ' ? Les jeux, la balade du jour et le radar s’adapteront à cette classe.'),
      { ok: 'Oui, en ' + cl, cancel: 'Annuler', icon: '🎒' });
    if (!ok) return false;
    store.mutateProfile(q => { setClasse(q, cl, dayStr()); }, id);
    audio.success(3);
    saved(frTypo('Classe : ' + cl + ' ✓'));
    later(() => renderContent({ keepScroll: true }));
    return true;
  };
  card.appendChild(h('div', { class: 'pa-row' },
    h('div', { class: 'pa-row-label' }, 'Classe'),
    seg(CLASSES.map(c => [c, c]), p.classe, changeClasse, 'Classe'),
    next ? h('button', { type: 'button', class: 'btn small pink pa-next', on: { click: () => changeClasse(next) } }, frTypo(p.name + ' passe en ' + next + ' !')) : null));

  /* prénom */
  const input = h('input', { class: 'input', type: 'text', maxlength: '14', value: p.name, autocomplete: 'off', 'aria-labelledby': 'pa-name-l', enterkeyhint: 'done' });
  const saveName = () => {
    const v = sanitizeName(input.value, p.name);
    input.value = v;
    if (v === store.getProfile(id).name) { saved('Prénom inchangé'); return; }
    store.mutateProfile(q => { q.name = v; }, id);
    audio.tap();
    saved('Prénom enregistré ✓');
    later(() => renderContent({ keepScroll: true }));
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } });
  card.appendChild(h('div', { class: 'pa-row' },
    h('label', { class: 'pa-row-label', id: 'pa-name-l' }, 'Prénom'),
    h('div', { class: 'pa-inline' }, input, h('button', { type: 'button', class: 'btn small', on: { click: saveName } }, 'Enregistrer'))));

  card.appendChild(h('div', { class: 'pa-row' },
    h('div', { class: 'pa-row-label' }, 'Accords des histoires'),
    seg([['f', 'Fille'], ['m', 'Garçon']], p.g === 'm' ? 'm' : 'f', v => set((x, q) => { q.g = v; }), 'Fille ou garçon'),
    h('p', { class: 'pa-help' }, frTypo('Pour accorder les histoires de la course (« elle est fière » ou « il est fier »).'))));
  return card;
}

/* ---------- sauvegardes ---------- */
function exportProfileNow(p) {
  const f = backup.exportProfile(p);
  if (backup.downloadExport(f)) saved('Sauvegarde de ' + p.name + ' téléchargée ✓');
  else kit.toast('Le téléchargement n’a pas pu démarrer.');
}
function exportAllNow() {
  const f = backup.exportAll(store.getData());
  if (backup.downloadExport(f)) saved('Sauvegarde complète téléchargée ✓');
  else kit.toast('Le téléchargement n’a pas pu démarrer.');
}
async function importBackup() {
  const file = await backup.pickFile();
  if (!file) return;
  let text = '';
  try { text = await backup.readFileText(file); } catch (_) { kit.toast('Ce fichier n’a pas pu être lu.'); return; }
  const parsed = backup.parseBackup(text);
  if (parsed.errors.length) {
    audio.soft();
    kit.sheet({ title: 'Import impossible', content: h('p', { class: 'pa-sheet-p' }, frTypo(parsed.errors.join(' '))), actions: [{ label: 'Compris' }] });
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
  const r = await backup.shareExport(backup.exportProfile(p), { title: 'Sauvegarde Caramel de ' + p.name });
  if (r === 'shared') saved('Sauvegarde partagée ✓');
  else if (r === 'downloaded') saved(frTypo('Partage indisponible : sauvegarde téléchargée ✓'));
  else if (r === 'failed') kit.toast('Le partage n’a pas pu se faire.');
}
function canWebShare() {
  try { const n = globalThis.navigator; return !!n && typeof n.share === 'function' && typeof n.canShare === 'function'; } catch (_) { return false; }
}
function backupCard(p) {
  return h('div', { class: 'card pa-card pa-backup' },
    h('p', { class: 'pa-note' }, frTypo('Tout reste sur cet appareil, rien n’est envoyé sur Internet. Exportez une sauvegarde de temps en temps, et avant de changer de téléphone.')),
    h('div', { class: 'pa-actions' },
      h('button', { type: 'button', class: 'btn', on: { click: () => { audio.tap(); exportProfileNow(store.getProfile(p.id) || p); } } }, h('span', { 'aria-hidden': 'true' }, '⬇️'), 'Exporter le profil de ' + p.name),
      h('button', { type: 'button', class: 'btn white', on: { click: () => { audio.tap(); exportAllNow(); } } }, h('span', { 'aria-hidden': 'true' }, '⬇️'), 'Exporter tous les profils'),
      h('button', { type: 'button', class: 'btn white', on: { click: () => { audio.tap(); importBackup(); } } }, h('span', { 'aria-hidden': 'true' }, '⬆️'), 'Importer une sauvegarde'),
      canWebShare() ? h('button', { type: 'button', class: 'btn white', on: { click: () => { audio.tap(); shareNow(store.getProfile(p.id) || p); } } }, h('span', { 'aria-hidden': 'true' }, '📤'), 'Partager la sauvegarde') : null));
}

/* ---------- profils ---------- */
function deleteProfile(q) {
  const input = h('input', { class: 'input', type: 'text', autocomplete: 'off', 'aria-label': 'Prénom à recopier', placeholder: q.name, enterkeyhint: 'done' });
  const content = h('div', { class: 'pa-del' },
    h('p', { class: 'pa-sheet-p' }, frTypo('Tous les progrès de ' + q.name + ' (radar, pommes, étoiles, compagnon) seront effacés de cet appareil. Pensez à exporter une sauvegarde avant.')),
    h('button', { type: 'button', class: 'btn white small', on: { click: () => exportProfileNow(q) } }, h('span', { 'aria-hidden': 'true' }, '⬇️'), 'Exporter d’abord'),
    h('label', { class: 'pa-del-l' }, frTypo('Pour confirmer, recopiez le prénom « ' + q.name + ' » :'), input));
  const okName = () => input.value.trim().toLocaleLowerCase('fr') === q.name.trim().toLocaleLowerCase('fr');
  const s = kit.sheet({
    title: frTypo('Supprimer le profil de ' + q.name + ' ?'), content,
    actions: [
      { label: 'Annuler', kind: 'white' },
      { label: 'Supprimer', kind: 'pink', onClick: () => {
        if (!okName()) { kit.gentleWrong(input); input.focus(); return false; }
        const wasSel = q.id === sel;
        store.removeProfile(q.id);
        audio.soft();
        kit.toast('Profil de ' + q.name + ' supprimé');
        if (!store.listProfiles().length) { router.go('onboarding'); return true; }
        if (wasSel) sel = null;
        later(() => renderContent({ keepScroll: true }));
        return true;
      } }
    ]
  });
  setTimeout(() => { try { input.focus(); } catch (_) {} }, 350);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const b = s.el && s.el.querySelector('.btn.pink'); if (b) b.click(); } });
}
function profilesCard() {
  const list = profileList();
  return h('div', { class: 'card pa-card pa-profiles' },
    h('ul', { class: 'pa-prof-list' }, list.map(q => {
      const m = MOUNTS[q.companion && q.companion.type] || MOUNTS.pony;
      return h('li', { class: 'pa-prof' },
        h('span', { class: 'pa-prof-ava', 'aria-hidden': 'true' }, m.em),
        h('div', { class: 'pa-prof-txt' },
          h('div', { class: 'pa-prof-name' }, q.name),
          h('div', { class: 'pa-prof-meta' }, [q.classe || 'classe à choisir', (q.companion && q.companion.name) ? 'avec ' + q.companion.name : ''].filter(Boolean).join(' · '))),
        h('button', { type: 'button', class: 'btn ghost pa-prof-del', 'aria-label': 'Supprimer le profil de ' + q.name, on: { click: () => { audio.tap(); deleteProfile(q); } } }, 'Supprimer'));
    })),
    h('button', { type: 'button', class: 'btn white block', on: { click: () => { audio.tap(); router.go('onboarding'); } } }, h('span', { 'aria-hidden': 'true' }, '➕'), 'Ajouter un enfant'));
}

/* ---------- rappels ---------- */
function remindersCard() {
  const status = h('p', { class: 'pa-note', role: 'status' }, 'Vérification…');
  const btn = h('button', { type: 'button', class: 'btn white', hidden: true }, h('span', { 'aria-hidden': 'true' }, '🔔'), 'Activer les rappels');
  const card = h('div', { class: 'card pa-card pa-remind' },
    h('p', { class: 'pa-note' }, frTypo('Un petit rappel par jour pour garder la série 🔥 (sur Android, une fois Caramel installé sur l’écran d’accueil).')),
    status, btn);
  const refresh = async () => {
    let st = null;
    try { st = await notifs.status(); } catch (_) { st = null; }
    if (!card.isConnected && !host) return;
    if (!st || !st.supported) { status.textContent = frTypo('Les notifications ne sont pas disponibles sur cet appareil.'); btn.hidden = true; return; }
    if (st.permission === 'denied') { status.textContent = frTypo('Les notifications sont bloquées dans les réglages du navigateur pour Caramel.'); btn.hidden = true; return; }
    if (st.permission === 'granted') {
      status.textContent = st.daily ? 'Rappels quotidiens activés ✓' : frTypo('Notifications autorisées. Le rappel automatique demande d’installer Caramel sur l’écran d’accueil.');
      btn.hidden = !!st.daily;
      return;
    }
    status.textContent = 'Rappels désactivés.';
    btn.hidden = false;
  };
  btn.addEventListener('click', async () => {
    audio.tap();
    let r = 'unsupported';
    try { r = await notifs.enable(); } catch (_) {}
    if (r === 'daily') saved('Rappels quotidiens activés ✓');
    else if (r === 'on') saved('Notifications activées ✓');
    else if (r === 'denied') kit.toast('Les notifications ont été refusées.');
    refresh();
  });
  later(refresh);
  return card;
}

/* ---------- à propos ---------- */
function aboutCard() {
  let v = '2.0.0';
  try { const m = globalThis.document.querySelector('meta[name="caramel-version"]'); if (m && m.content) v = m.content; } catch (_) {}
  const ok = store.storageOk();
  return h('div', { class: 'card pa-card pa-about' },
    h('div', { class: 'pa-about-row' }, h('span', null, 'Version'), h('b', null, 'Caramel ' + v)),
    h('div', { class: 'pa-about-row' }, h('span', null, 'Sauvegarde automatique'), h('b', { class: ok ? 'pa-ok' : 'pa-ko' }, ok ? 'active ✓' : 'impossible ⚠️')),
    h('p', { class: 'pa-note' }, frTypo('Caramel n’a pas de compte ni de serveur : la voix, les photos et les résultats ne quittent jamais l’appareil. Caramel n’établit aucun diagnostic.')));
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
    this._off = () => globalThis.document.removeEventListener('visibilitychange', onVis);
  },
  unmount() {
    cleanup();
    if (this._off) { this._off(); this._off = null; }
    host = null;
    live = null;
    closeSheets();
  }
};
