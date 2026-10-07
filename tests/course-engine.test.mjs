/* La course : moteur de lecture (js/games/course-engine.js) = code v11 (index.html @ c5bd8d1), comportement inchangé.
   1. Statique : FORGIVE, normalize, tokenize, computeProper, median, isMatch, levenshtein recopiés caractère
      pour caractère.
   2. Dynamique : les fonctions v11 elles-mêmes (openStory, processTranscript, finishExercise, minuteur de Zip,
      grammaire de startVoskEngine, ligne 👂 d'ingest) sont extraites de git et exécutées dans un bac à sable
      (vm) avec un DOM factice qui enregistre sons, sauts, chutes, défilements… ; le moteur v2 reçoit
      exactement les mêmes lectures simulées (mots sautés, mots-outils avalés, [unk], fautes, bruit, résultats
      partiels révisés, pauses longues ou courtes) et doit produire le même état et les mêmes effets, dans
      le même ordre.
   3. Ajouts v2 : mots OOV validés par [unk], Zip adaptatif, repérage du passage des questions. */
import { test, assert } from './_t.mjs';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import * as E from '../js/games/course-engine.js';
import { STORIES, OOV } from '../js/content/stories/index.js';
import { defaultProfile, fillTemplate } from '../js/core/profiles.js';
import { MOUNTS } from '../js/content/companion-data.js';
import { makeRng } from '../js/core/rng.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const V11_COMMIT = 'c5bd8d1';
const mine = readFileSync(join(root, 'js', 'games', 'course-engine.js'), 'utf8');
let v11 = null;
try { v11 = execFileSync('git', ['-C', root, 'show', V11_COMMIT + ':index.html'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 }); }
catch (_) { console.log('  (course-engine : historique git indisponible, comparaison à la v11 ignorée)'); }

/* corps d'une fonction de premier niveau (de « function nom(» jusqu'à l'accolade fermante en colonne 0) */
function fnText(code, name) {
  const m = code.match(new RegExp('(?:^|\\n)((?:export )?(?:async )?function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\})'));
  return m ? m[1] : null;
}

/* ---------- profils et textes de test ---------- */
const PROFILES = [
  ['Léa', 'f', 'pony', 'Caramel'], ['Tom', 'm', 'unicorn', 'Plume'], ['Élise', 'f', 'capy', 'Noisette'],
  ['Jean-Paul', 'm', 'dragon', 'Flamme'], ['Zoé', 'f', 'cat', 'Mistigri'], ['Inès', 'f', 'dolphin', 'Bulle']
].map(([name, g, type, mname]) => {
  const p = defaultProfile({ id: 'p1', name, g, classe: 'CM2', today: '2026-10-02' });
  p.companion.type = type; p.companion.name = mname;
  return p;
});
const SYNTH = [
  'Il dit : « Bonjour ! » Puis il part… Léa sourit ; Caramel aussi !',
  'Le chat, la souris et le chien. Ils jouent ! Pourquoi ? Parce que.',
  '« Oui » répond Léa. — Non ! dit Tom. Léa rit, Tom aussi.',
  'Bonjour.',
  'Il a 3 pommes et 12 poires, puis 7 prunes.',
  '« Allons-y ! » crie Jean-Paul. L’enfant n’a pas peur : il court , vite !',
  'Un, deux, trois, quatre, cinq, six, sept, huit, neuf, dix, onze, douze. Fin.'
];
function corpus() {
  const out = [];
  for (const s of STORIES) for (const p of PROFILES.slice(0, 3)) out.push({ text: fillTemplate(s.text, p), noun: MOUNTS[p.companion.type].noun, id: s.id, target: s.target });
  for (const p of PROFILES.slice(3)) for (const s of STORIES.filter((_, i) => i % 6 === 0)) out.push({ text: fillTemplate(s.text, p), noun: MOUNTS[p.companion.type].noun, id: s.id, target: s.target });
  for (const t of SYNTH) out.push({ text: t, noun: 'licorne', id: 'synth', target: 40 });
  return out;
}
/* version allégée pour les simulations (chaque histoire une fois, profils en rotation) */
function corpusSmall() {
  const out = STORIES.map((s, i) => {
    const p = PROFILES[i % PROFILES.length];
    return { text: fillTemplate(s.text, p), noun: MOUNTS[p.companion.type].noun, id: s.id, target: s.target, long: s.lvl >= 3.1 };
  }).filter((c, i) => !c.long || i % 3 === 0);          /* textes longs : un sur trois (temps d'exécution) */
  for (const t of SYNTH) out.push({ text: t, noun: 'licorne', id: 'synth', target: 40, long: false });
  return out;
}

/* ---------- bac à sable v11 : DOM factice qui enregistre les effets ---------- */
function makeV11() {
  if (!v11) return null;
  const names = ['normalize', 'tokenize', 'computeProper', 'median', 'isMatch', 'levenshtein', 'processTranscript', 'openStory', 'finishExercise'];
  const srcs = names.map(n => { const t = fnText(v11, n); if (!t) throw new Error(n + ' introuvable dans la v11'); return t; });
  const forgive = v11.match(/\nconst FORGIVE = new Set\(\[[\s\S]*?\]\);/)[0];
  const vocabLine = v11.match(/\n\s*(const vocab = \[\.\.\.new Set\(state\.target\.map\([\s\S]*?\.filter\(Boolean\);)/)[1];
  const timerBody = v11.match(/raceTimer = setInterval\(\(\)=>\{([\s\S]*?)\n  \}, 250\);/)[1];
  const tailLine = v11.match(/\n\s*(const tail = allText\.trim\(\)[^\n]*;)/)[1];
  const sb = { rec: [], clock: 0, els: {}, story: null, mount: { type: 'pony', name: 'Caramel' } };
  const el = (id) => {
    const e = {
      id, _text: '', innerHTML: '', style: {}, offsetWidth: 0, children: [],
      classList: {
        add: c => { if (e.k !== undefined) sb.rec.push({ t: 'hurdle', k: e.k, cls: c }); else if (id === 'pony') sb.rec.push({ t: 'pony', cls: c }); },
        remove: () => {}, toggle: () => {}, contains: () => false
      },
      appendChild: c => { e.children.push(c); return c; }, remove: () => {}
    };
    Object.defineProperty(e, 'textContent', {
      get: () => e._text,
      set: v => { e._text = String(v); if (id === 'streak') sb.rec.push({ t: 'streak', n: Number(String(v).replace('🔥 série : ', '')) }); }
    });
    Object.defineProperty(e.style, 'display', {
      get: () => e._disp, set: v => { e._disp = v; if (id === 'spark') sb.rec.push({ t: 'spark', on: v === 'block' }); }, configurable: true
    });
    return e;
  };
  const getEl = id => sb.els[id] || (sb.els[id] = el(id));
  const context = {
    sb, state: {}, wordEls: [], currentIdx: 0, console,
    Date: { now: () => sb.clock },
    navigator: { vibrate: ms => sb.rec.push({ t: 'vibrate', ms }) },
    document: {
      getElementById: getEl,
      createElement: () => el(null),
      createTextNode: () => ({}),
      querySelector: () => getEl('track'),
      querySelectorAll: () => []
    },
    setTimeout: (fn, ms) => { if (fn === context.finishExercise) sb.rec.push({ t: 'finish', ms }); return 0; },
    beep: (f, d, g) => sb.rec.push({ t: 'beep', f, d, g }),
    moveActor: (id, pct) => sb.rec.push({ t: 'move', id, pct }),
    scrollToCurrent: () => sb.rec.push({ t: 'scroll' }),
    renderText: () => sb.rec.push({ t: 'render' }),
    stopAll: () => { context.state.running = false; },
    ensureVosk: () => {}, applyTheme: () => {}, show: () => {}, mountSVG: () => '<svg></svg>', raceSize: () => 46,
    fanfare: () => {}, confetti: () => {}, persist: () => {}, bumpStreak: () => 0,
    isUnlocked: () => true, fillTemplate: s => s,
    get STORIES() { return [sb.story]; },
    get MOUNTS() { return { [sb.mount.type]: { noun: sb.mount.noun, g: sb.mount.g || 'm' } }; },
    get save() { return sb.save; }
  };
  vm.createContext(context);
  vm.runInContext(forgive.replace('const FORGIVE', 'var FORGIVE') + '\n' + srcs.join('\n') +
    '\nfunction __vocab(){ ' + vocabLine + ' return vocab; }' +
    '\nfunction __timer(){' + timerBody + '\n}' +
    '\nfunction __tail(allText){ ' + tailLine + ' return tail; }', context);
  /* openStory v11 sur un texte déjà templaté */
  context.open = (text, noun, target = 40) => {
    sb.story = { text, title: 't', emoji: '🙂', target, best: 0, theme: { sky: ['#000', '#000'], ground: ['#000', '#000'], obstacle: '🌿', decos: [] } };
    sb.mount = { type: 'pony', name: 'Caramel', noun };
    sb.save = { stars: {}, apples: 0, streak: { count: 0, last: '' }, mount: { type: 'pony', name: 'Caramel' }, equip: { worn: [] } };
    sb.els = {};
    context.openStory(0);
    for (const [k, h] of Object.entries(context.state.hurdleEls)) h.k = Number(k);
    context.state.running = true;
    sb.rec = [];
  };
  return context;
}

/* état comparable (v11 : hurdleEls ; v2 : hurdles) */
function snap(st) {
  return JSON.stringify({
    status: st.status, progress: st.progress, startTime: st.startTime, wordTime: st.wordTime, gaps: st.gaps,
    pauseResults: st.pauseResults, streak: st.streak, childFinished: st.childFinished, flyDone: st.flyDone
  });
}
/* effets v11 enregistrés → format du moteur (l'étincelle suit la série) */
function v11Effects(rec) {
  const out = [];
  let lastStreak = null;
  for (const r of rec) {
    if (r.t === 'spark') { assert.equal(r.on, lastStreak >= 5, 'étincelle incohérente'); continue; }
    if (r.t === 'streak') lastStreak = r.n;
    if (r.t === 'move') { assert.equal(r.id, 'pony'); out.push({ t: 'move', pct: r.pct }); continue; }
    if (r.t === 'finish') { assert.equal(r.ms, 500); out.push({ t: 'finish' }); continue; }
    out.push(r);
  }
  return out;
}

/* ---------- lectures simulées ---------- */
const NOISE = ['euh', 'alors', 'bon', 'ah', 'hum', 'et', 'la', 'chat', 'maison'];
function misspell(w, rng) {
  if (w.length < 3) return w + 'e';
  const i = rng.int(0, w.length - 1);
  const ops = [() => w.slice(0, i) + w.slice(i + 1), () => w.slice(0, i) + 'x' + w.slice(i + 1), () => w.slice(0, i) + 'a' + w.slice(i)];
  let s = rng.pick(ops)();
  if (w.length >= 8 && rng.chance(0.4)) { const j = rng.int(0, s.length - 1); s = s.slice(0, j) + 'z' + s.slice(j + 1); }
  return s;
}
/* → liste d'émissions { text, t } : texte cumulé (final + partiel) et instant, comme le moteur vocal */
function simulate(race, rng, style) {
  const toks = race.target;
  const said = [];             /* [mot, instant] */
  let t = 1000 + rng.int(0, 500);
  const wordMs = style.wordMs;
  for (let k = 0; k < toks.length; k++) {
    const w = toks[k];
    const form = w.raw.toLowerCase().replace(/[^\p{L}0-9]/gu, '');
    if (rng.chance(style.noise)) { said.push([rng.pick(NOISE), t]); t += wordMs; }
    const r = rng.next();
    if (race.proper.has(w.norm) && rng.chance(style.unk)) said.push(['[unk]', t]);
    else if (r < style.skip) { /* mot avalé */ }
    else if (r < style.skip + style.typo) said.push([misspell(form, rng), t]);
    else said.push([form, t]);
    if (rng.chance(style.repeat)) said.push([form, t + 40]);
    t += wordMs + rng.int(-60, 90);
    if (w.pause) t += rng.chance(style.longPause) ? rng.int(500, 1900) : rng.int(0, 250);
  }
  /* résultats : phrases coupées aux silences ; partiels qui grandissent (parfois avec un dernier mot révisé), puis final */
  const out = [];
  let final = '';
  let i = 0;
  while (i < said.length) {
    let j = i + 1;
    while (j < said.length && said[j][1] - said[j - 1][1] < 700 && j - i < 14) j++;
    const utt = said.slice(i, j);
    for (let m = 1; m <= utt.length; m++) {
      const words = utt.slice(0, m).map(x => x[0]);
      if (rng.chance(style.revise) && m < utt.length) words[words.length - 1] = misspell(words[words.length - 1], rng);
      out.push({ text: final + ' ' + words.join(' '), t: utt[m - 1][1] + rng.int(80, 260) });
      if (rng.chance(0.25)) out.push({ text: final + ' ' + words.join(' '), t: utt[m - 1][1] + rng.int(300, 420) });
    }
    final += utt.map(x => x[0]).join(' ') + ' ';
    out.push({ text: final, t: utt[utt.length - 1][1] + rng.int(300, 600) });
    i = j;
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}
const STYLES = [
  { name: 'fluide', wordMs: 330, skip: 0, typo: 0, unk: 1, noise: 0, repeat: 0, longPause: 1, revise: 0 },
  { name: 'pressé', wordMs: 220, skip: 0.02, typo: 0.03, unk: 0.8, noise: 0, repeat: 0, longPause: 0.1, revise: 0.1 },
  { name: 'hésitant', wordMs: 520, skip: 0.06, typo: 0.08, unk: 0.6, noise: 0.05, repeat: 0.05, longPause: 0.6, revise: 0.2 },
  { name: 'difficile', wordMs: 600, skip: 0.18, typo: 0.18, unk: 0.4, noise: 0.12, repeat: 0.08, longPause: 0.5, revise: 0.3 },
  { name: 'bruit', wordMs: 300, skip: 0.45, typo: 0.3, unk: 0.2, noise: 0.35, repeat: 0.1, longPause: 0.3, revise: 0.4 }
];

/* ---------- 1. statique ---------- */
test('FORGIVE, normalize, tokenize, computeProper, median, isMatch, levenshtein : copie caractère pour caractère de la v11', () => {
  if (!v11) return;
  for (const name of ['normalize', 'tokenize', 'computeProper', 'median', 'isMatch', 'levenshtein']) {
    const ref = fnText(v11, name);
    assert.ok(ref, name + ' introuvable dans la v11');
    assert.equal(fnText(mine, name), 'export ' + ref, name + ' diffère de la v11');
  }
  const forgive = v11.match(/\nconst FORGIVE = new Set\(\[[\s\S]*?\]\);/)[0];
  assert.ok(mine.includes('\nexport ' + forgive.slice(1)), 'FORGIVE diffère de la v11');
  assert.deepEqual([...E.FORGIVE], ['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux', 'et', 'en', 'y', 'a',
    'ce', 'se', 'sa', 'son', 'ses', 'ne', 'que', 'qui', 'il', 'ils', 'elle', 'ou']);
});

test('module pur : aucun accès à window, document, navigator, localStorage', () => {
  const code = mine.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const g of ['window', 'document', 'navigator', 'localStorage', 'setTimeout', 'setInterval']) assert.ok(!new RegExp('\\b' + g + '\\b').test(code), g);
});

/* ---------- 2. dynamique ---------- */
test('openStory v11 ↔ createRace : tokens, noms propres (+ monture), obstacles, grammaire Vosk', () => {
  const V = makeV11();
  if (!V) return;
  for (const c of corpus()) {
    V.open(c.text, c.noun, c.target);
    const r = E.createRace(c.text, { mountNoun: c.noun });
    assert.deepEqual(r.target, JSON.parse(JSON.stringify(V.state.target)), 'tokens : ' + c.text.slice(0, 40));
    assert.deepEqual([...r.proper].sort(), [...V.state.proper].sort(), 'noms propres : ' + c.text.slice(0, 40));
    assert.deepEqual([...r.hurdles], Object.keys(V.state.hurdleEls).map(Number), 'obstacles : ' + c.text.slice(0, 40));
    assert.deepEqual(E.grammarOf(r.target), [...V.__vocab()], 'grammaire : ' + c.text.slice(0, 40));
    assert.equal(snap(r), snap(V.state), 'état initial');
    for (const k of r.hurdles) assert.ok(E.hurdleLeft(k, r.target.length) < 85.0001);
  }
});

test('processTranscript v11 ↔ moteur : même état et mêmes effets sur des milliers de lectures simulées', () => {
  const V = makeV11();
  if (!V) return;
  const rng = makeRng(20261002);
  let emissions = 0, finished = 0, pausesSeen = new Set(), unkUsed = 0, fxKinds = new Set();
  const texts = corpusSmall();
  for (let ci = 0; ci < texts.length; ci++) {
    const c = texts[ci];
    const styles = c.long ? [STYLES[ci % STYLES.length]] : ci % 3 === 0 ? STYLES : [STYLES[ci % STYLES.length], STYLES[(ci + 2) % STYLES.length]];
    for (const style of styles) {
      V.open(c.text, c.noun, c.target);
      const mineSt = E.createRace(c.text, { mountNoun: c.noun });
      const seq = simulate(mineSt, rng, style);
      seq.push({ text: seq.length ? seq[seq.length - 1].text + ' fin' : 'fin', t: (seq.length ? seq[seq.length - 1].t : 0) + 200 });
      for (const em of seq) {
        V.sb.clock = em.t; V.sb.rec = [];
        V.processTranscript(em.text);
        const fx = E.processTranscript(mineSt, em.text, em.t);
        assert.equal(snap(mineSt), snap(V.state), `[${style.name}] état différent après « ${em.text.slice(-60)} »`);
        assert.deepEqual(fx, v11Effects(V.sb.rec), `[${style.name}] effets différents après « ${em.text.slice(-60)} »`);
        for (const f of fx) fxKinds.add(f.t + (f.cls ? ':' + f.cls : ''));
        if (/\[unk\]/.test(em.text)) unkUsed++;
        emissions++;
      }
      if (mineSt.childFinished) finished++;
      for (const pr of mineSt.pauseResults) if (pr) pausesSeen.add(pr);
    }
  }
  /* la simulation couvre bien tous les cas */
  assert.ok(emissions > 3000, 'émissions : ' + emissions);
  assert.ok(finished > 20, 'courses terminées : ' + finished);
  for (const p of ['ok', 'fast', 'skip']) assert.ok(pausesSeen.has(p), 'pause ' + p + ' jamais rencontrée');
  for (const k of ['streak', 'move', 'pony:hop', 'pony:hop-big', 'pony:stumble', 'beep', 'scroll', 'hurdle:jumped', 'hurdle:crushed', 'vibrate', 'render', 'finish']) {
    assert.ok(fxKinds.has(k), 'effet jamais produit : ' + k);
  }
  assert.ok(unkUsed > 100, '[unk] : ' + unkUsed);
});

test('cas écrits à la main : [unk], mots-outils pardonnés, fenêtre de 4 mots, fautes tolérées, pauses', () => {
  const st = E.createRace('Léa ouvre la porte, Caramel attend le petit déjeuner. Puis il mange.', { mountNoun: 'poney' });
  assert.ok(st.proper.has('lea') === false);              /* Léa en début de phrase, une seule fois : pas un nom propre (règle v11) */
  assert.ok(st.proper.has('caramel') && st.proper.has('poney'));
  E.processTranscript(st, '[unk] ouvre porte', 1000);     /* [unk] ne valide pas « Léa » (pas nom propre) ; « la » pardonné */
  assert.deepEqual(st.status.slice(0, 4), ['missed', 'read', 'read', 'read']);
  assert.equal(st.progress, 4);
  E.processTranscript(st, '[unk] ouvre porte [unk] atend', 2600);   /* « atend » : Levenshtein 1 ; [unk] → Caramel */
  assert.deepEqual(st.status.slice(4, 6), ['read', 'read']);
  assert.equal(st.pauseResults[3], 'ok', 'pause après « porte, » : 1,6 s ≥ 800 ms');
  assert.equal(st.startTime, 1000);
  const fx = E.processTranscript(st, '[unk] ouvre porte [unk] atend dejeuner puis il mange', 3000);
  assert.equal(st.status[6], 'read', '« le » pardonné');
  assert.equal(st.status[7], 'missed', '« petit » sauté');
  assert.equal(st.pauseResults[8], 'fast', 'point sans pause (680 ms attendues)');
  assert.deepEqual([...st.hurdles], [3, 8]);
  assert.ok(st.childFinished && fx.some(f => f.t === 'finish'));
  assert.ok(fx.some(f => f.t === 'pony' && f.cls === 'stumble'), 'mot manqué → trébuche');
  /* au-delà de la fenêtre de 4 mots : rien n'est validé */
  const st2 = E.createRace('un deux trois quatre cinq six');
  E.processTranscript(st2, 'cinq', 10);
  assert.equal(st2.progress, 0, '« cinq » est hors de la fenêtre de 4 mots');
  E.processTranscript(st2, 'quatre', 10);
  assert.equal(st2.progress, 4);
  assert.deepEqual(st2.status, ['read', 'missed', 'missed', 'read', 'pending', 'pending'], '« un » (mot-outil) pardonné');
});

test('finishExercise v11 ↔ raceResult : MCLM, précision, étoiles, sauts d’obstacles, message des pauses, mots à apprivoiser', () => {
  const V = makeV11();
  if (!V) return;
  const rng = makeRng(42);
  const texts = corpusSmall().filter((c, i) => !c.long || i % 2 === 0);
  let starsSeen = new Set(), msgs = new Set();
  for (let ci = 0; ci < texts.length; ci++) {
    const c = texts[ci];
    for (const style of [STYLES[ci % 2 ? 0 : 2], STYLES[ci % 2 ? 3 : 4]]) {
      for (const flyDone of [false, true]) {
        V.open(c.text, c.noun, c.target);
        const st = E.createRace(c.text, { mountNoun: c.noun });
        const seq = simulate(st, rng, style);
        const cut = rng.chance(0.3) ? Math.max(1, Math.floor(seq.length * rng.next())) : seq.length;   /* « J’ai fini ✓ » avant la fin */
        let tEnd = 0;
        for (const em of seq.slice(0, cut)) { E.processTranscript(st, em.text, em.t); tEnd = em.t; }
        /* état de fin de lecture (alignement déjà prouvé identique au test précédent) recopié côté v11 */
        for (const k of ['status', 'progress', 'startTime', 'wordTime', 'gaps', 'pauseResults', 'streak', 'childFinished']) V.state[k] = JSON.parse(JSON.stringify(st[k]));
        V.state.flyDone = flyDone; st.flyDone = flyDone;
        V.state.running = true;
        const now = tEnd + 500;
        V.sb.clock = now;
        V.finishExercise();
        const r = E.raceResult(st, now);
        const out = id => V.sb.els[id];
        assert.equal(String(r.mclm), out('res-mclm').textContent, 'MCLM');
        assert.equal(r.precision + ' %', out('res-prec').textContent, 'précision');
        assert.equal('⭐'.repeat(r.stars) + '☆'.repeat(3 - r.stars), out('res-stars').textContent, 'étoiles');
        assert.equal(r.evald ? (r.okp + ' / ' + r.evald) : '—', out('res-pausesv').textContent, 'sauts');
        const ptxt = { expressive: '🎭 Lecture expressive, bravo !', astuce: 'Astuce : respire aux virgules et aux points pour sauter les obstacles 😊', '': '' }[r.pausesMsg];
        assert.equal(ptxt, out('res-pauses').textContent, 'message des pauses');
        assert.equal(r.missed.length ? 'Mots à apprivoiser : <b>' + r.missed.slice(0, 6).join(' · ') + '</b>' : '💯 Tu as lu tous les mots !',
          out('missed-words').innerHTML, 'mots à apprivoiser');
        assert.equal(r.beatFly, /avant Zip/.test(out('res-race').textContent), 'course contre Zip');
        assert.equal(r.missedNorm.length + r.readNorm.length, st.target.length);
        starsSeen.add(r.stars); msgs.add(r.pausesMsg);
      }
    }
  }
  assert.deepEqual([...starsSeen].sort(), [1, 2, 3]);
  assert.deepEqual([...msgs].sort(), ['', 'astuce', 'expressive']);
});

test('minuteur de Zip v11 ↔ zipTick ; ligne 👂 v11 ↔ heardTail', () => {
  const V = makeV11();
  if (!V) return;
  for (const c of corpusSmall()) {
    V.open(c.text, c.noun, c.target);
    const st = E.createRace(c.text, { mountNoun: c.noun });
    V.sb.rec = [];
    V.sb.clock = 500; V.__timer();
    assert.equal(E.zipTick(st, 500, c.target), null, 'avant le premier mot : rien');
    V.state.startTime = st.startTime = 1000;
    for (let t = 1000; t < 200000; t += 3250) {
      V.sb.clock = t; V.sb.rec = [];
      V.__timer();
      const z = E.zipTick(st, t, c.target);
      assert.equal('⏱ ' + z.secs + ' s', V.sb.els.timer.textContent);
      const mv = V.sb.rec.find(r => r.t === 'move');
      assert.equal(mv.id, 'fly'); assert.equal(z.flyPct, mv.pct);
      assert.equal(st.flyDone, V.state.flyDone);
    }
  }
  for (const s of ['', '  ', 'un', 'un deux trois quatre cinq six sept', '[unk] ouvre la grande porte de', '  a  b ']) {
    assert.equal(E.heardTail(s), V.__tail(s).replace(/\[unk\]/g, '…'));
  }
});

/* ---------- 3. ajouts v2 ---------- */
test('OOV (v2) : les mots hors lexique du texte deviennent validables par [unk]', () => {
  /* « hulule » : hors du lexique des deux modèles (« lucioles », l'exemple de la v2.0, est connu de vosk-model-small-fr-0.22) */
  const s = STORIES.find(x => /hulule/.test(x.text));
  assert.ok(s, 'une histoire contient « hulule »');
  const text = fillTemplate(s.text, PROFILES[0]);
  const plain = E.createRace(text, { mountNoun: 'poney' });
  const v2 = E.createRace(text, { mountNoun: 'poney', oov: OOV });
  assert.ok(!plain.proper.has('hulule') && v2.proper.has('hulule'));
  for (const w of OOV) {
    const inText = v2.target.some(t => t.raw.toLowerCase().replace(/[^\p{L}0-9]/gu, '') === w);
    if (inText) assert.ok(v2.proper.has(E.normalize(w)), w);
  }
  /* lecture où Vosk renvoie [unk] pour « hulule » */
  const k = v2.target.findIndex(t => t.norm === 'hulule');
  const said = v2.target.slice(0, k + 1).map(t => (t.norm === 'hulule' ? '[unk]' : t.raw.toLowerCase().replace(/[^\p{L}0-9]/gu, '')));
  E.processTranscript(v2, said.join(' '), 5000);
  E.processTranscript(plain, said.join(' '), 5000);
  assert.equal(v2.status[k], 'read', 'v2 : [unk] valide « hulule »');
  assert.equal(v2.progress, k + 1);
  assert.notEqual(plain.status[k], 'read', 'v11 : « hulule » restait non lu');
  /* les noms propres v11 restent là */
  for (const n of E.computeProper(v2.target)) assert.ok(v2.proper.has(n));
});

test('Zip adaptatif : médiane des 5 derniers MCLM × 1,05, bornée [20 ; cible de la classe] ; sinon min(histoire, classe)', () => {
  assert.equal(E.adaptiveZip([], 30, 120), 30);
  assert.equal(E.adaptiveZip(null, 140, 120), 120);
  assert.equal(E.adaptiveZip([{ v: 80 }], 30, 120), 84);
  assert.equal(E.adaptiveZip([{ v: 200 }, { v: 10 }, { v: 90 }, { v: 95 }, { v: 100 }, { v: 105 }], 30, 120), 100);   /* 5 derniers : 10 90 95 100 105 → 95 × 1,05 = 99,75 */
  assert.equal(E.adaptiveZip([{ v: 5 }], 30, 120), 20);
  assert.equal(E.adaptiveZip([{ v: 200 }], 30, 110), 110);
  assert.equal(E.adaptiveZip([{ v: 60 }, { v: 80 }], 30, 120), 84, 'médiane v11 (élément du milieu haut)');
  assert.equal(E.adaptiveZip([{ v: 0 }, { v: 'x' }, null], 45, 120), 45, 'MCLM illisibles ignorés');
});

test('passage des questions : citeRange retrouve chaque extrait dans le texte templaté (37 histoires × 6 profils)', () => {
  for (const s of STORIES) {
    for (const p of PROFILES) {
      const text = fillTemplate(s.text, p), cite = fillTemplate(s.q.cite, p);
      const toks = E.tokenize(text);
      const r = E.citeRange(text, cite);
      assert.ok(r, s.id + ' : passage introuvable');
      const joined = toks.slice(r[0], r[1] + 1).map(t => t.raw).join(' ');
      const words = cite.split(/\s+/).map(E.normalize).filter(Boolean);
      const got = toks.slice(r[0], r[1] + 1).map(t => t.norm);
      assert.ok(words.every(w => got.some(g => g.includes(w) || w.includes(g))), s.id + ' : « ' + cite + ' » ≠ « ' + joined + ' »');
      assert.ok(r[1] - r[0] + 1 <= words.length + 1);
    }
  }
  assert.deepEqual(E.citeRange('Il dit : « oui » !', 'oui'), [2, 2]);
  assert.deepEqual(E.citeRange('Il dit : « oui » ! Puis rien.', 'oui'), [2, 2]);
  assert.deepEqual(E.citeRange('« Bonjour » dit Léa.', 'dit Léa'), [1, 2]);
  assert.equal(E.citeRange('abc', 'zzz'), null);
  assert.equal(E.citeRange('abc', ''), null);
});

test('états limites : texte d’un mot, transcription vide, bruit seul', () => {
  const st = E.createRace('Bonjour.');
  assert.equal(st.hurdles.size, 0);
  let fx = E.processTranscript(st, '', 100);
  assert.equal(st.progress, 0);
  assert.ok(!fx.some(f => f.t === 'finish'));
  fx = E.processTranscript(st, 'chat chien bonjour', 200);
  assert.ok(st.childFinished && fx.some(f => f.t === 'finish'));
  const r = E.raceResult(st, 1200);
  assert.equal(r.precision, 100);
  assert.equal(r.stars, 3);
  const st2 = E.createRace('Le petit chat dort.');
  E.processTranscript(st2, 'euh hum bof', 100);
  assert.equal(st2.progress, 0);
  assert.equal(st2.startTime, null);
  const r2 = E.raceResult(st2, 5000);
  assert.deepEqual([r2.mclm, r2.precision, r2.stars], [0, 0, 1], 'v11 : une étoile même sans lecture');
});
