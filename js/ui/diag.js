/* ============ ÉTAT DE CET APPAREIL (espace parents › À propos, v2.2.2, décision du parent du 04/10/2026) ============
   Pour qu'un parent envoie une capture quand quelque chose ne va pas : ce que l'appareil sait faire, en mots simples, avec
   ✓ (fonctionne) ou ✗ (bloque quelque chose), sans rien envoyer — tout est lu ici, dans le navigateur.
     - version de Caramel ; navigateur et système (lus dans l'agent utilisateur : parseUA de js/core/install.js ; sur
       Chrome, la version d'Android est précisée par navigator.userAgentData quand il la donne) ;
     - ouverture depuis l'écran d'accueil ou dans le navigateur ; hors ligne (service worker aux commandes) ;
     - son (état de l'AudioContext de js/core/audio.js) ; voix enregistrée (phrases sur l'appareil, cache
       'caramel-voix-v1', et phrases dites depuis l'ouverture : voice.stats()) ; voix fluide (v2.2.2, js/core/voice-fluid.js :
       pas téléchargée, téléchargement, prête avec sa vitesse mesurée, trop lente sur cet appareil…) ; voix du téléphone (voix françaises :
       tts.diagnose()) ; micro (navigator.mediaDevices, autorisation, micros détectés) ; reconnaissance de la voix
       (moteur intégré Vosk prêt ou téléchargé, sinon reconnaissance du navigateur, sinon aucune) ; WebAssembly ;
       stockage (sauvegarde automatique, stockage protégé : navigator.storage.persisted(), place utilisée / disponible).
   collect() → Promise<faits> (navigateur) ; describe(faits) → [{ key, label, value, ok }] (PUR, testé :
   tests/install.test.mjs) ; diagCard() → la carte (« Vérifier de nouveau », « Copier le texte »). */
import { h, clear, frTypo } from '../core/util.js';
import { parseUA } from '../core/install.js';
import * as install from '../core/install.js';
import * as audio from '../core/audio.js';
import * as tts from '../core/tts.js';
import * as speech from '../core/speech.js';
import * as clips from '../core/voice-clips.js';
import * as fluid from '../core/voice-fluid.js';
import * as store from '../core/store.js';
import * as voice from './voice.js';
import * as kit from './kit.js';

const NB = '\u00A0';
/* 1 536 → « 1,5 ko » ; 52 428 800 → « 50 Mo » */
export function fmtBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '';
  for (const [unit, k] of [['Go', 1024 ** 3], ['Mo', 1024 ** 2], ['ko', 1024]]) {
    if (n >= k) { const v = n / k; return String(v >= 10 ? Math.round(v) : Math.round(v * 10) / 10).replace('.', ',') + NB + unit; }
  }
  return Math.round(n) + NB + 'o';
}
const plural = (n, one, many) => n + NB + (n > 1 ? many : one);

/* ---------- faits → lignes (pur) ----------
   Valeurs COURTES (la carte doit tenir dans une capture d'écran de téléphone) ; une explication seulement quand ça bloque. */
export function describe(f = {}) {
  const rows = [];
  const add = (key, label, value, ok = null) => rows.push({ key, label, value: frTypo(value), ok });
  const d = parseUA(f.ua || '', { platform: f.platform || '', maxTouchPoints: f.maxTouchPoints || 0 });
  add('version', 'Version', 'Caramel ' + (f.version || '?'));
  const br = d.browser === 'inconnu' ? 'inconnu' : d.browser + (d.browserVersion ? ' ' + d.browserVersion : '');
  const host = d.browser === 'inconnu' || d.browser === 'vue web Android' ? 'intégré à une autre appli' : br + ', intégré à une autre appli';
  add('browser', 'Navigateur', d.inApp ? host + ' : ouvrez Caramel dans ' + (d.ios ? 'Safari' : 'Chrome') : br, d.inApp ? false : null);
  const osv = f.osVersion || d.osVersion;
  add('os', 'Système', d.os === 'inconnu' ? 'inconnu' : d.os + (osv ? ' ' + osv : ''));
  add('open', 'Ouvert', f.standalone ? 'depuis l’écran d’accueil' : 'dans le navigateur', f.standalone ? true : null);
  add('offline', 'Hors ligne', f.sw === true ? 'prêt' : f.sw === false ? 'pas encore prêt (rouvrez Caramel une fois)' : 'impossible ici', f.sw === true ? true : f.sw === false ? null : false);
  const a = f.audio || {};
  if (!a.supported) add('sound', 'Son', 'indisponible', false);
  else {
    const st = a.state === 'running' ? ['prêt', true] : a.state === 'suspended' ? ['en attente d’un toucher', null]
      : a.state === 'interrupted' ? ['interrompu (appel, veille)', null]
        : a.state === 'closed' ? ['arrêté : rechargez la page', false] : ['démarre au premier toucher', null];
    add('sound', 'Son', st[0] + (a.muted ? ' ; sons de l’enfant coupés' : ''), st[1]);
  }
  const r = f.rec || {};
  if (!r.supported) add('rec', 'Voix enregistrée', 'illisible ici (la voix du téléphone la remplace)', false);
  else {
    let v = Number.isFinite(r.cached) && r.cached > 0 ? r.cached + ' phrases sur ' + r.total + ' sur l’appareil' : 'téléchargée à la première écoute';
    if (r.said) v += ' ; ' + plural(r.said, 'dite', 'dites') + ' depuis l’ouverture';
    if (r.health === 'broken') v += ' ; dernière lecture en échec';
    add('rec', 'Voix enregistrée', v, r.health === 'broken' ? false : (r.cached > 0 || r.said > 0) ? true : null);
  }
  const fl = f.fluid || {};
  if (fl.state) {
    const num = x => String(Math.round(x * 10) / 10).replace('.', ',');
    const speed = !Number.isFinite(fl.rtf) || fl.rtf <= 0 ? (Number(fl.bootMs) > 15000 ? ' (démarrage de plus de 15' + NB + 's)' : '')
      : fl.rtf < 1 ? ' ; calcule ' + num(1 / fl.rtf) + ' fois plus vite qu’elle ne parle' : ' ; calcule ' + num(fl.rtf) + ' fois plus lentement qu’elle ne parle';
    const said = Number(fl.said) > 0 ? ' ; ' + plural(fl.said, 'phrase dite', 'phrases dites') + ' depuis l’ouverture' : '';
    const pct = fl.progress && fl.progress.total > 0 ? Math.floor(fl.progress.loaded / fl.progress.total * 100) : 0;
    const v = {
      ready: ['prête' + speed + said, true],
      unsupported: ['impossible sur ce navigateur', null],
      absent: [fl.removed ? 'supprimée (espace parents)' : 'pas téléchargée', null],
      downloading: ['téléchargement : ' + pct + NB + '%', null],
      paused: ['téléchargement interrompu', null],
      cached: [fl.held ? 'téléchargée, en pause pendant le micro' : fl.parked ? 'téléchargée, en pause après le micro jusqu’à la prochaine ouverture'
        : 'téléchargée, démarre en arrière-plan', null],
      starting: ['téléchargée, démarrage…', null],
      calibrating: ['téléchargée, essai de vitesse…', null],
      slow: ['trop lente sur cet appareil' + speed, null],
      error: [fl.error === 'boot' ? 'n’a pas pu démarrer' : fl.error === 'space' ? 'pas assez de place' : fl.error === 'offline' ? 'téléchargement impossible hors ligne'
        : 'téléchargement en échec', false]
    }[fl.state] || ['vérification…', null];
    add('fluid', 'Voix fluide', v[0], v[1]);
  }
  const t = f.tts || {};
  if (!t.api) add('tts', 'Voix du téléphone', 'absente', false);
  else if (!t.voices) add('tts', 'Voix du téléphone', 'aucune voix pour l’instant', null);
  else if (!t.fr) add('tts', 'Voix du téléphone', 'aucune voix française', false);
  else add('tts', 'Voix du téléphone', plural(t.fr, 'voix française', 'voix françaises') + (t.voice ? ' (' + t.voice + ')' : ''), true);
  const m = f.mic || {};
  if (!m.api) add('mic', 'Micro', 'inaccessible', false);
  else if (m.inputs === 0) add('mic', 'Micro', 'aucun micro détecté', false);
  else if (m.permission === 'denied') add('mic', 'Micro', 'bloqué pour Caramel', false);
  else if (m.permission === 'granted') add('mic', 'Micro', 'autorisé', true);
  else add('mic', 'Micro', 'demandé au premier essai', null);
  const k = f.reco || {};
  if (k.vosk === 'ready') add('reco', 'Reconnaissance', 'moteur intégré prêt', true);
  else if (k.vosk === 'downloaded') add('reco', 'Reconnaissance', 'moteur intégré téléchargé', true);
  else if (k.google) add('reco', 'Reconnaissance', 'secours du navigateur (Google)', null);
  else if (k.vosk === 'possible') add('reco', 'Reconnaissance', 'moteur intégré à télécharger (45 Mo)', null);
  else if (k.web) add('reco', 'Reconnaissance', 'celle du navigateur seulement', null);
  else add('reco', 'Reconnaissance', 'aucune (course impossible)', false);
  add('wasm', 'WebAssembly', f.wasm ? 'oui' : 'non (moteur intégré impossible)', !!f.wasm);
  const s = f.storage || {};
  if (s.ok === false) add('storage', 'Stockage', 'impossible : progrès perdus à la fermeture', false);
  else {
    let v = s.persisted === true ? 'protégé' : s.persisted === false ? 'non protégé' : 'actif';
    if (Number.isFinite(s.usage) && Number.isFinite(s.quota) && s.quota > 0) v += ' ; ' + fmtBytes(s.usage) + ' sur ' + fmtBytes(s.quota);
    add('storage', 'Stockage', v, s.persisted === true ? true : null);
  }
  return rows;
}
/* texte à copier (une ligne par fait) */
export function asText(rows, ua = '') {
  return rows.map(r => r.label + '\u202F: ' + r.value + (r.ok === true ? ' ✓' : r.ok === false ? ' ✗' : '')).join('\n') + (ua ? '\nAgent utilisateur\u202F: ' + ua : '');
}

/* ---------- faits (navigateur) ---------- */
const G = globalThis;
const safe = async (fn, def = null) => { try { return await fn(); } catch (_) { return def; } };
const within = (p, ms, def = null) => Promise.race([p, new Promise(r => setTimeout(() => r(def), ms))]);
export async function collect() {
  const n = G.navigator || {};
  const f = { ua: n.userAgent || '', platform: n.platform || '', maxTouchPoints: n.maxTouchPoints || 0 };
  f.version = await safe(() => G.document.querySelector('meta[name="caramel-version"]').content, '');
  f.standalone = await safe(() => install.isStandalone(), false);
  f.sw = 'serviceWorker' in n ? !!(n.serviceWorker && n.serviceWorker.controller) : null;
  /* version précise d'Android (l'agent utilisateur de Chrome la fige à « 10 ») */
  f.osVersion = await within(safe(async () => {
    const u = n.userAgentData;
    if (!u || typeof u.getHighEntropyValues !== 'function' || !/Android/i.test(u.platform || '')) return '';
    const v = await u.getHighEntropyValues(['platformVersion']);
    return String((v && v.platformVersion) || '').replace(/(\.0)+$/, '');
  }, ''), 800, '');
  const ctx = await safe(() => audio.context(), null);
  f.audio = { supported: await safe(() => audio.audioSupported(), false), state: ctx ? ctx.state : null, muted: await safe(() => audio.isMuted(), false) };
  const st = voice.stats();
  f.rec = { supported: await safe(() => clips.supported(), false), total: await safe(() => clips.count(), 0), said: (st.rec || 0) + (st.partial || 0), health: st.health, cached: null };
  f.rec.cached = await within(safe(async () => {
    if (!G.caches) return null;
    if (!(await G.caches.has(clips.CACHE))) return 0;
    const c = await G.caches.open(clips.CACHE);
    return (await c.keys()).length;
  }, null), 1500, null);
  f.fluid = await within(safe(async () => ({ ...(await fluid.refresh()), said: st.fluid || 0 }), null), 2000, null);
  f.tts = await safe(() => tts.diagnose(), { api: false });
  const md = n.mediaDevices;
  f.mic = { api: !!(md && typeof md.getUserMedia === 'function'), permission: null, inputs: null };
  f.mic.permission = await within(safe(async () => (await n.permissions.query({ name: 'microphone' })).state, null), 800, null);
  f.mic.inputs = await within(safe(async () => {
    if (!md || typeof md.enumerateDevices !== 'function') return null;
    return (await md.enumerateDevices()).filter(x => x.kind === 'audioinput').length;
  }, null), 800, null);
  f.wasm = await safe(() => typeof WebAssembly === 'object' && WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])), false);
  const status = String(await safe(() => speech.statusText(), '') || '');
  const web = !!(G.SpeechRecognition || G.webkitSpeechRecognition);
  let vosk = f.wasm && f.mic.api ? 'possible' : 'no';
  if (/prêt/i.test(status)) vosk = 'ready';
  else if (vosk === 'possible') {
    const got = await within(safe(async () => {
      if (!G.caches || !(await G.caches.has('vosk-model-v1'))) return false;
      return !!(await (await G.caches.open('vosk-model-v1')).match(speech.MODEL_URL));
    }, false), 1500, false);
    if (got) vosk = 'downloaded';
  }
  f.reco = { vosk, web, google: /Google/i.test(status) };
  f.storage = { ok: await safe(() => store.storageOk(), true), persisted: null, usage: null, quota: null };
  const sto = n.storage;
  if (sto) {
    f.storage.persisted = await within(safe(() => (typeof sto.persisted === 'function' ? sto.persisted() : null), null), 800, null);
    const e = await within(safe(() => (typeof sto.estimate === 'function' ? sto.estimate() : null), null), 800, null);
    if (e) { f.storage.usage = Number(e.usage); f.storage.quota = Number(e.quota); }
  }
  return f;
}

/* ---------- la carte ---------- */
export function diagCard() {
  const list = h('ul', { class: 'pa-diag-list', 'aria-busy': 'true' });
  const uaLine = h('p', { class: 'pa-diag-ua' });
  const again = h('button', { type: 'button', class: 'btn small white', 'data-fk': 'diag-again' },
    h('span', { class: 'pa-lbl' }, h('span', { class: 'pa-lbl-emo', 'aria-hidden': 'true' }, '🔄' + NB), 'Vérifier de nouveau'));
  const copy = h('button', { type: 'button', class: 'btn small white', 'data-fk': 'diag-copy' },
    h('span', { class: 'pa-lbl' }, h('span', { class: 'pa-lbl-emo', 'aria-hidden': 'true' }, '📋' + NB), 'Copier le texte'));
  const card = h('div', { class: 'card pa-card pa-diag' },
    h('h3', { class: 'pa-h3' }, 'État de cet appareil'),
    h('p', { class: 'pa-help pa-diag-intro' }, frTypo('Un souci ? Envoyez une capture d’écran de cette carte avec votre message. Tout est vérifié ici, rien n’est envoyé.')),
    list, uaLine, h('div', { class: 'pa-dev-acts pa-diag-acts' }, again, copy));
  let text = '', seq = 0;
  const render = rows => {
    clear(list);
    for (const r of rows) {
      const mark = r.ok === true ? '✓' : r.ok === false ? '✗' : '';
      list.appendChild(h('li', { class: 'pa-diag-row' + (r.ok === false ? ' is-ko' : r.ok === true ? ' is-ok' : '') },
        h('span', { class: 'pa-diag-k' }, r.label),
        h('span', { class: 'pa-diag-v' }, r.value,
          mark ? h('span', { class: 'pa-diag-mark', 'aria-hidden': 'true' }, NB + mark) : null,
          r.ok === false ? h('span', { class: 'sr-only' }, ' (problème)') : null)));
    }
  };
  const run = async () => {
    const my = ++seq;
    list.setAttribute('aria-busy', 'true');
    const f = await collect();
    if (my !== seq) return;
    const rows = describe(f);
    render(rows);
    uaLine.textContent = 'Agent utilisateur\u202F: ' + f.ua;
    text = asText(rows, f.ua);
    list.setAttribute('aria-busy', 'false');
  };
  again.addEventListener('click', () => { try { audio.tap(); } catch (_) {} run().then(() => { try { kit.toast('Vérifié ✓', 1400); } catch (_) {} }); });
  copy.addEventListener('click', async () => {
    try { audio.tap(); } catch (_) {}
    let ok = false;
    try { if (text && G.navigator.clipboard) { await G.navigator.clipboard.writeText(text); ok = true; } } catch (_) { ok = false; }
    try { kit.toast(ok ? 'Texte copié ✓' : frTypo('La copie n’est pas possible ici : faites plutôt une capture d’écran.'), 2200); } catch (_) {}
  });
  /* la voix du téléphone arrive parfois après coup (liste des voix chargée en différé) : une seconde lecture */
  run().then(() => setTimeout(() => { if (card.isConnected) run(); }, 1500));
  /* voix fluide : relue à chaque état, et par dizaine de % (montage : comme parentsRow) */
  const key = (st, p = st.progress) => st.state + (p && p.total ? p.loaded * 10 / p.total | 0 : '');
  let mounted = false, last = key(fluid.status());
  const off = fluid.onChange(st => {
    if (card.isConnected) mounted = true;
    else if (mounted) { off(); return; }
    if (key(st) !== last) { last = key(st); run(); }
  });
  return card;
}
