/* ============ RÉPONDRE À VOIX HAUTE DANS LES JEUX (v2.3, demande du parent du 07/10/2026) ============
   « Le micro ça va mieux. Par contre il faudrait pouvoir utiliser le micro sur les autres jeux, pas seulement les
   tables. » Le 🎤 des tables (js/games/tables.js), généralisé : un bouton micro et une ligne 👂, à brancher sur le pavé
   du kit (le 🎤 prend la case vide, à gauche du 0, comme aux tables) ou sur une grille de choix.
   La voix TAPE la réponse à la place de l'enfant : un nombre dit s'écrit dans la case et se valide (le jeu fait ses
   retours habituels), un choix dit touche le bouton du choix. Le jeu n'a rien d'autre à apprendre.
   - nombre : juge des tables (createVoiceJudge de js/games/tables-logic.js : juste dès qu'il est entendu — résultat
     final ou partiel stable 0,35 s —, autre nombre stable 1,5 s = essai faux ; jamais faux : les nombres de l'énoncé,
     la réponse précédente, « un ») ; grammaire voiceGrammar() (nombres + mots d'appoint) ;
   - choix : juge de js/core/voice-choice.js (le choix dit en dernier ; final, ou partiel stable 0,6 s), grammaire des
     formes dites des choix + mots d'appoint ; changée sans rouvrir le micro (speech.changeGrammar) ;
   - santé du micro (js/core/speech.js, onHealth) : l'oreille bat quand une voix arrive ; micro muet ou moteur en
     retard depuis 1,5 s → 🎤 barré (le toucher relance l'écoute), depuis 5 s → onProblem(phrase), une fois ;
   - le micro reste allumé d'une question à l'autre, et d'un jeu à l'autre pendant la séance (sessionStorage
     SESSION_KEY : autoStart()) ; l'enfant l'éteint d'un toucher ;
   - journal de diagnostic (catégorie « voix ») et état du micro en petit sous l'oreille (mode diagnostic).
   API : createVoiceAnswer(ctx, { onNumber(valeur, juste), onChoice(valeur), onProblem(phrase), onChange() }) →
     { el (bouton 🎤), ear (ligne 👂), dbg, supported, attachKeypad(kp), attachChoices(grille), placeIn(conteneur, avant),
       number({ answer, ignore, voice, words, touch }), choices([{ value, say, num, label }], { fillers, touch }), pause(oui, 'touch'?), autoStart(), start(),
       stop(), wanted(), destroy() } */
import { h, frTypo, fmtNum, loadCSS } from '../core/util.js';
import * as dl from '../core/debuglog.js';
import { createVoiceJudge, voiceGrammar, heardLabel, VOICE_FILLERS } from '../games/tables-logic.js';
import { createChoiceJudge, choiceGrammar } from '../core/voice-choice.js';

export const SESSION_KEY = 'caramel-micro';
const SHOW_TROUBLE_MS = 1500;
const TROUBLE_MS = 5000;
const NNBSP = '\u202F';
const G = globalThis;

let cssAsked = false;
function ensureCSS() {
  if (cssAsked || !G.document) return;
  cssAsked = true;
  try {
    if (G.document.querySelector('link[href$="css/ui/voice-answer.css"]')) return;
    loadCSS(new URL('../../css/ui/voice-answer.css', import.meta.url).href);
  } catch (_) {}
}
const session = {
  get() { try { return G.sessionStorage.getItem(SESSION_KEY) === '1'; } catch (_) { return false; } },
  set(on) { try { if (on) G.sessionStorage.setItem(SESSION_KEY, '1'); else G.sessionStorage.removeItem(SESSION_KEY); } catch (_) {} }
};
const nowMs = () => (G.performance && performance.now ? performance.now() : Date.now());

export function createVoiceAnswer(ctx, { onNumber = null, onChoice = null, onProblem = null, onChange = null } = {}) {
  ensureCSS();
  let alive = true;
  const S = {
    wanted: false, on: false, starting: false, pct: null, engine: null, mode: null, target: null, list: [], judge: null,
    paused: false, heard: null, timer: 0, health: null, troubleKind: '', troubleSince: 0, troubleSaid: '', err: '',
    offHealth: null, grammarKey: '', kp: null, grid: null, prev: null, touch: false, fillers: null
  };
  let supported = false;
  try { supported = !!(ctx.speech && ctx.speech.speechSupported()); } catch (_) { supported = false; }

  const btn = h('button', { type: 'button', class: 'va-mic', 'aria-pressed': 'false', 'aria-label': 'Répondre à voix haute' },
    h('span', { class: 'va-mic-ico', 'aria-hidden': 'true' }, '🎤'));
  const ear = h('p', { class: 'va-ear is-hidden', 'aria-hidden': 'true' });
  const dbg = dl.enabled() ? h('p', { class: 'va-dbg', 'aria-hidden': 'true' }) : null;
  btn.addEventListener('click', () => {
    if (S.wanted && troubled()) { log('🎤 barré touché : écoute relancée'); stop({ byChild: false }); start(); }
    else if (S.wanted) stop({ byChild: true });
    else start();
  });

  const log = (m, d) => { try { dl.dlog('voix', m, d); } catch (_) {} };
  const safe = fn => { try { return fn(); } catch (e) { console.error('voix', e); return null; } };
  const hush = () => safe(() => ctx.voice && ctx.voice.hush());
  const announce = t => safe(() => ctx.announce && ctx.announce(String(t || '')));
  const changed = () => { if (typeof onChange === 'function') safe(onChange); };
  const cancelTimer = () => { if (S.timer) { clearTimeout(S.timer); S.timer = 0; } };
  const later = (fn, ms) => { S.timer = setTimeout(() => { S.timer = 0; if (alive) safe(fn); }, Math.max(0, ms)); };

  /* ---------- question en cours ---------- */
  function grammarNow() {
    if (S.mode === 'choices') return choiceGrammar(S.list, S.fillers || VOICE_FILLERS);
    const extra = S.target && S.target.words ? S.target.words : [];
    return extra.length ? [...new Set(voiceGrammar().concat(extra))] : voiceGrammar();
  }
  const grammarKeyNow = () => (S.mode === 'choices' ? 'c:' + S.list.map(c => String(c.value)).join('|') + '/' + (S.fillers || []).join(',')
    : 'n:' + (S.target && S.target.words ? S.target.words.join(',') : ''));
  function newJudge() {
    cancelTimer();
    S.heard = null;
    if (S.mode === 'number' && S.target && S.target.voice) {
      S.judge = createVoiceJudge({ answer: S.target.answer, ignore: S.target.ignore || [] });
    } else if (S.mode === 'choices' && S.list.length) {
      S.judge = createChoiceJudge(S.list);
    } else S.judge = null;
    if (S.on) safe(() => ctx.speech.resetTranscript());
  }
  /* grammaire de la question : changée sans rouvrir le micro (choix), la même pour tous les nombres */
  function syncGrammar() {
    if (!S.on || S.engine !== 'vosk') return;
    const key = grammarKeyNow();
    if (key === S.grammarKey) return;
    const ok = safe(() => ctx.speech.changeGrammar && ctx.speech.changeGrammar(grammarNow()));
    if (ok) S.grammarKey = key;
  }
  /* words : mots de plus pour la grammaire (ceux que l'enfant dit autour du nombre : « retiens », « chiffres »… ; sans eux,
     Vosk les changerait en nombres) — mots du lexique du modèle seulement */
  /* touch : question qui ne se dit pas (décimale, trop longue…) : « 👆 Ici, réponds avec le doigt » plutôt que « Micro en pause » */
  function number({ answer, ignore = [], voice = true, words = [], touch = false } = {}) {
    const v = Number(answer);
    /* la réponse de la question précédente ne compte jamais faux : l'enfant la répète pendant que la suivante arrive */
    const prev = S.target && S.mode === 'number' && Number.isFinite(S.target.answer) ? S.target.answer : null;
    S.mode = 'number';
    S.target = { answer: v, ignore: (ignore || []).filter(Number.isFinite).concat(prev === null || prev === v ? [] : [prev]),
      voice: !!voice && Number.isFinite(v), words: Array.isArray(words) ? words.map(String).filter(Boolean) : [] };
    S.list = [];
    S.paused = !S.target.voice;
    S.touch = S.paused && !!touch;
    syncGrammar();
    newJudge();
    render();
  }
  /* fillers : mots d'appoint de la grammaire (défaut : ceux des tables) — un jeu de phrases retire ceux qui avalent ses mots
     (« c'est », « sais » mangeaient « tu es », « tu as » : le Chef d'orchestre) ; touch : comme number */
  function choices(list = [], { fillers = null, touch = false } = {}) {
    S.mode = 'choices';
    S.list = (Array.isArray(list) ? list : []).filter(c => c && ('value' in c));
    S.fillers = Array.isArray(fillers) ? fillers.map(String) : null;
    S.target = null;
    S.paused = !S.list.length;
    S.touch = S.paused && !!touch;
    syncGrammar();
    newJudge();
    render();
  }
  function pause(p = true, how = '') {
    S.paused = !!p;
    S.touch = !!p && how === 'touch';
    if (!p) newJudge(); else cancelTimer();
    render();
  }

  /* ---------- ce que la voix a entendu ---------- */
  function onText(text, isFinal) {
    if (!alive || !S.on || S.paused || !S.judge) return;
    handle(S.judge.feed(text, isFinal, nowMs()));
  }
  function handle(ev) {
    if (!ev || S.paused) return;
    if (ev.kind === 'right' || ev.kind === 'wrong') {
      log('voix : ' + (ev.kind === 'right' ? 'juste' : 'faux'), { valeur: ev.value });
      S.heard = ev.value; render();
      cancelTimer();
      const v = ev.value, right = ev.kind === 'right';
      /* l'essai suivant repart d'une oreille neuve (après un faux, l'enfant peut redire) */
      if (S.judge && S.judge.reset) S.judge.reset();
      safe(() => ctx.speech.resetTranscript());
      if (typeof onNumber === 'function') safe(() => onNumber(v, right));
      else typeInto(v);
      return;
    }
    if (ev.kind === 'pick') {
      log('voix : choix', { valeur: ev.value });
      S.heard = ev.value; render();
      cancelTimer();
      const v = ev.value;
      if (S.judge && S.judge.reset) S.judge.reset();
      safe(() => ctx.speech.resetTranscript());
      if (typeof onChoice === 'function') safe(() => onChoice(v));
      else pressChoice(v);
      return;
    }
    if (ev.kind === 'heard' && ev.value !== S.heard) {
      log('voix : entendu', { valeur: ev.value, ignoré: !!ev.ignored });
      S.heard = ev.value; render();
    }
    if (ev.due) {
      cancelTimer();
      later(() => { if (S.on && S.judge && !S.paused) handle(S.judge.tick(nowMs())); }, ev.due - nowMs() + 10);
    }
  }
  /* par défaut : la voix tape le nombre dans le pavé et valide (le jeu juge comme une saisie) */
  function typeInto(v) {
    const kp = S.kp;
    if (!kp) return;
    safe(() => kp.set(fmtNum(v).replace(/\s/g, '')));
    const ok = kp.el && kp.el.querySelector('[data-k="ok"]');
    if (ok) ok.click();
  }
  function pressChoice(v) {
    const g = S.grid;
    const b = g && (g.button ? g.button(v) : null);
    if (b && !b.disabled) b.click();
  }
  function labelOf(v) {
    if (S.mode === 'number') return heardLabel(v);
    const c = S.list.find(x => x.value === v || String(x.value) === String(v));
    if (!c) return String(v);
    if (typeof c.label === 'string' && c.label) return c.label;
    return Array.isArray(c.say) ? c.say[0] : c.say ? String(c.say) : String(v);
  }

  /* ---------- santé du micro ---------- */
  function troubled() {
    return S.on && S.troubleKind && S.troubleSince && nowMs() - S.troubleSince >= SHOW_TROUBLE_MS ? S.troubleKind : '';
  }
  function onHealth(hh) {
    if (!alive || !S.on || !hh) return;
    const prev = S.health;
    S.health = hh;
    const kind = hh.state === 'deaf' || hh.state === 'slow' ? hh.state : '';
    const wasBad = troubled();
    if (kind !== S.troubleKind) { S.troubleKind = kind; S.troubleSince = kind ? nowMs() : 0; }
    if (!kind) S.troubleSaid = '';
    const bad = troubled();
    if (bad !== wasBad) log(bad ? '🎤 barré (' + bad + ')' : '🎤 de nouveau normal');
    if (kind && S.troubleSaid !== kind && nowMs() - S.troubleSince >= TROUBLE_MS) {
      S.troubleSaid = kind;
      problem(kind === 'deaf' ? frTypo('Le micro ne m’entend plus 😕 Touche 🎤 pour réessayer, ou réponds avec les doigts.')
        : frTypo('Ton téléphone est un peu lent pour m’écouter 🐢 Tu peux aussi répondre avec les doigts.'));
    }
    if (dbg) dbg.textContent = hh.state + ' · son ' + Math.round(hh.level * 100) + (hh.voice ? ' ●' : ' ○') + ' · retard ' +
      (hh.lagMs / 1000).toFixed(1) + ' s · sautés ' + hh.dropped + (hh.reopens ? ' · rouvert ' + hh.reopens : '');
    if (!prev || prev.voice !== hh.voice || bad !== wasBad || prev.state !== hh.state) render();
  }
  function problem(msg) {
    S.err = msg;
    announce(msg);
    if (typeof onProblem === 'function') safe(() => onProblem(msg));
  }

  /* ---------- allumer / éteindre ---------- */
  async function start() {
    if (!supported || S.wanted || !alive) return;
    hush();                                          /* le micro n'entend que l'enfant : le compagnon se tait */
    S.wanted = true; S.starting = true; S.pct = null; S.err = '';
    session.set(true);
    render();
    try { ctx.speech.ensureVosk(p => { if (alive && S.starting) { S.pct = p; render(); } }); } catch (_) {}
    try { if (ctx.voice && ctx.voice.settle) await ctx.voice.settle(); } catch (_) {}
    if (!alive || !S.wanted) { S.starting = false; render(); return; }
    let r = null;
    const key0 = grammarKeyNow();                   /* grammaire donnée au démarrage (la question peut changer pendant) */
    try { r = await ctx.speech.startListening({ grammar: grammarNow(), onText, onError }); }
    catch (e) { console.error('voix : micro', e); }
    if (!alive) return;
    S.starting = false;
    if (!S.wanted) { render(); return; }
    if (!r || !r.engine) {
      S.wanted = false; S.on = false;
      safe(() => ctx.speech.stopListening());
      if (!S.err) problem(frTypo('Le micro n’a pas démarré 😕 Touche 🎤 pour réessayer, ou réponds avec les doigts.'));
      render(); changed();
      return;
    }
    S.on = true; S.engine = r.engine; S.grammarKey = key0;
    syncGrammar();                                   /* question changée pendant le démarrage : la bonne grammaire */
    hush();
    S.health = null; S.troubleSince = 0; S.troubleKind = ''; S.troubleSaid = '';
    newJudge();
    try { if (ctx.speech.onHealth) S.offHealth = ctx.speech.onHealth(onHealth); } catch (_) {}
    render(); changed();
    announce('Le micro t’écoute.');
    log('micro allumé', { moteur: r.engine, mode: S.mode });
  }
  function onError(code, msg) {
    if (!alive) return;
    const t = safe(() => ctx.mic && ctx.mic.trouble(code));
    const text = t && t.hard ? t.title + ' ' + frTypo('Réponds avec les doigts.') : frTypo(msg || 'Le micro n’a pas démarré 😕');
    log('erreur du micro : ' + code);
    if (S.err === text) return;
    stop({ byChild: false });
    problem(text);
  }
  function stop({ byChild = false } = {}) {
    if (byChild) { session.set(false); log('micro éteint par l’enfant'); }
    const was = S.wanted || S.on || S.starting;
    S.wanted = false; S.on = false; S.starting = false; S.pct = null; S.heard = null; S.engine = null;
    if (S.offHealth) { safe(S.offHealth); S.offHealth = null; }
    S.health = null; S.troubleSince = 0; S.troubleKind = '';
    if (dbg) dbg.textContent = '';
    cancelTimer();
    if (was) safe(() => ctx.speech.stopListening());
    render(); changed();
  }
  /* micro déjà allumé dans un autre jeu de la séance : il le reste */
  function autoStart() { if (supported && session.get() && !S.wanted) start(); }

  /* ---------- affichage ---------- */
  function render() {
    if (!alive) return;
    const bad = troubled();
    const ready = S.on && !S.paused && !!S.judge;
    btn.classList.toggle('is-on', S.on);
    btn.classList.toggle('is-starting', S.starting);
    btn.classList.toggle('is-paused', S.on && !ready);
    btn.classList.toggle('is-trouble', !!bad);
    btn.setAttribute('aria-pressed', S.wanted ? 'true' : 'false');
    btn.setAttribute('aria-label', bad ? 'Relancer le micro' : S.wanted ? 'Arrêter le micro' : 'Répondre à voix haute');
    ear.classList.toggle('is-hearing', !!(ready && !bad && S.health && S.health.voice));
    let text = '';
    if (S.starting) {
      text = S.pct === null ? 'Préparation du micro… 🎙️'
        : S.pct < 99 ? frTypo('Je me prépare à t’écouter… ') + S.pct + NNBSP + '%' : frTypo('Presque prêt…');
    } else if (S.on) {
      if (!ready) text = S.touch ? frTypo('👆 Ici, réponds avec le doigt') : '🎤 Micro en pause';
      else if (bad === 'deaf') text = frTypo('🎤 Je ne t’entends plus… touche 🎤');
      else if (bad === 'slow') text = frTypo('🐢 J’écoute… ton téléphone est un peu lent');
      else if (S.heard !== null) text = '👂 ' + labelOf(S.heard);
      else text = S.mode === 'choices' ? frTypo('👂 Je t’écoute… dis ta réponse') : frTypo('👂 Je t’écoute…');
    }
    if (ear.textContent !== text) ear.textContent = text;
    ear.classList.toggle('is-hidden', !text);
  }

  /* ---------- branchements ---------- */
  /* le 🎤 dans la case vide du pavé (à gauche du 0) ; pavé décimal (la virgule y est) : rien → false */
  function attachKeypad(kp) {
    S.kp = kp || null;
    if (!supported || !kp || !kp.el) return false;
    const gap = kp.el.querySelector('.kit-key-gap');
    if (!gap) return btn.isConnected && kp.el.contains(btn);
    gap.replaceWith(btn);
    btn.classList.add('va-in-keypad');
    return true;
  }
  function attachChoices(grid) { S.grid = grid || null; return supported; }
  /* le 🎤 ailleurs (au-dessus d'une grille de choix) : s'il était dans un pavé, la case vide y est remise (rien ne bouge) */
  function placeIn(container, before = null) {
    if (!supported || !container) return false;
    const pad = btn.parentNode;
    if (pad && pad !== container && btn.classList.contains('va-in-keypad')) {
      pad.insertBefore(h('span', { class: 'kit-key-gap', 'aria-hidden': 'true' }), btn);
    }
    btn.classList.remove('va-in-keypad');
    if (before && before.parentNode === container) container.insertBefore(btn, before);
    else container.appendChild(btn);
    return true;
  }

  function destroy() {
    if (!alive) return;
    if (S.wanted || S.on || S.starting) safe(() => ctx.speech.stopListening());
    if (S.offHealth) { safe(S.offHealth); S.offHealth = null; }
    cancelTimer();
    alive = false;
    S.on = S.wanted = S.starting = false;
    S.judge = null;
  }

  render();
  return {
    el: btn, ear, dbg, supported,
    attachKeypad, attachChoices, placeIn, number, choices, pause, autoStart, start, stop: () => stop({ byChild: false }),
    wanted: () => S.wanted, listening: () => S.on, destroy
  };
}
