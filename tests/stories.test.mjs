/* Histoires de « La course de Caramel » (js/content/stories/) — contrat §6.3.
   Le templating est vérifié avec une COPIE MINIMALE du dictionnaire v11 (tplMap) :
   ce test ne dépend pas de js/core/profiles.js. */
import { test, assert } from './_t.mjs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadLexicon, normalizeForGrammar } from './lexicon.mjs';
import { makeRng } from '../js/core/rng.js';
import {
  STORIES, WORLDS, OOV, axis, gen, itemFor, storyById, storyIndex, storiesOf,
  classBonus, totalStarsOf, isUnlocked
} from '../js/content/stories/index.js';
import { LEGACY_STORIES } from '../js/content/stories/legacy.js';
import { CM2_STORIES } from '../js/content/stories/cm2.js';
import { QUESTIONS } from '../js/content/stories/questions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const V11_COMMIT = 'c5bd8d1';            /* v11.3, dernière version monofichier en production */
const NNBSP = '\u202f';

/* ---------- copie minimale du templating v11 ---------- */
const MOUNTS = {
  pony: ['poney', 'm'], horse: ['cheval', 'm'], cat: ['chat', 'm'], capy: ['capybara', 'm'],
  dolphin: ['dauphin', 'm'], lion: ['lion', 'm'], unicorn: ['licorne', 'f'], dragon: ['dragon', 'm']
};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function tplMap(profile) {
  const [noun, mg] = MOUNTS[profile.companion.type] || MOUNTS.pony;
  const mf = mg === 'f', hf = profile.g === 'f';
  const le = mf ? 'la' : 'le', son = mf ? 'sa' : 'son', du = mf ? 'de la' : 'du';
  return {
    P: profile.name, N: profile.companion.name,
    El: hf ? 'Elle' : 'Il', el: hf ? 'elle' : 'il', fiere: hf ? 'fière' : 'fier',
    leM: le + ' ' + noun, LeM: cap(le) + ' ' + noun, sonM: son + ' ' + noun, SonM: cap(son) + ' ' + noun,
    duM: du + ' ' + noun, IlM: mf ? 'Elle' : 'Il', ilM: mf ? 'elle' : 'il',
    contentM: mf ? 'contente' : 'content', surprisM: mf ? 'surprise' : 'surpris',
    legerM: mf ? 'légère' : 'léger', rassureM: mf ? 'rassurée' : 'rassuré', fascineM: mf ? 'fascinée' : 'fasciné',
    /* v2 : accords du duo (féminin si héroïne ET monture féminine) et de la monture */
    ils: hf && mf ? 'elles' : 'ils', Ils: hf && mf ? 'Elles' : 'Ils', eux: hf && mf ? 'elles' : 'eux',
    tousD: hf && mf ? 'toutes' : 'tous', assisD: hf && mf ? 'assises' : 'assis',
    premiersD: hf && mf ? 'premières' : 'premiers', herosD: hf && mf ? 'héroïnes' : 'héros',
    pleinM: mf ? 'pleine' : 'plein', toutM: mf ? 'toute' : 'tout', douxM: mf ? 'douce' : 'doux'
  };
}
const fill = (str, profile) => {
  const map = tplMap(profile);
  return String(str).replace(/\{(\w+)\}/g, (all, k) => (map[k] !== undefined ? map[k] : all));
};
const profileOf = (g, type) => ({ name: 'Léa', g, companion: { type, name: 'Caramel' } });
const COMBOS = ['f', 'm'].flatMap(g => Object.keys(MOUNTS).map(type => profileOf(g, type)));
const TOKENS = new Set(Object.keys(tplMap(profileOf('f', 'pony'))));
/* jetons d'accord ajoutés en v2 → forme v11 (masculine) pour la comparaison de parité */
const V2_TOKENS = { ils: 'ils', Ils: 'Ils', eux: 'eux', tousD: 'tous', assisD: 'assis', premiersD: 'premiers', herosD: 'héros', pleinM: 'plein', toutM: 'tout', douxM: 'doux' };
/* reformulations v2 (élisions impossibles devant un prénom : « de Inès », « de Éclair ») → texte v11 */
const V2_REWRITES = [
  ['Elle touche doucement {N} sur la tête avec sa baguette magique.', 'Elle touche la tête de {N} avec sa baguette magique.'],
  ['dans le pré, et {N} se couche tout près.', 'dans le pré, tout près de {N}.'],
  ['Le gardien serre la main à {P},', 'Le gardien serre la main de {P},']
];
const V11_FORMS = t => V2_REWRITES.reduce((x, [v2, v11]) => x.replace(v2, v11), t)
  .replace(/\{(\w+)\}/g, (all, k) => (k in V2_TOKENS ? V2_TOKENS[k] : all));

const words = text => text.split(/\s+/).map(normalizeForGrammar).filter(Boolean);
const stripTokens = text => text.replace(/\{\w+\}/g, ' ');
const countWords = text => text.split(/\s+/).filter(w => /\p{L}/u.test(w)).length;
const FORBIDDEN = /['’‘"«»‹›“”\-‐‑‒–—―0-9]/u;   /* apostrophes, guillemets, traits d'union, tirets, chiffres */

/* ---------- structure ---------- */
test('37 histoires : 27 v11 puis 10 CM2, ids uniques, champs complets', () => {
  assert.equal(LEGACY_STORIES.length, 27);
  assert.equal(CM2_STORIES.length, 10);
  assert.equal(STORIES.length, 37);
  assert.equal(new Set(STORIES.map(s => s.id)).size, 37);
  assert.deepEqual(STORIES.map(s => s.id), [...LEGACY_STORIES, ...CM2_STORIES].map(s => s.id));
  for (const s of STORIES) {
    for (const k of ['id', 'emoji', 'title', 'target', 'need', 'lvl', 'world', 'theme', 'text', 'q'])
      assert.ok(s[k] !== undefined && s[k] !== null && s[k] !== '', `${s.id}.${k}`);
    assert.ok(!('best' in s), s.id + ' : le champ v11 best ne doit plus exister');
    assert.ok(Number.isInteger(s.target) && Number.isInteger(s.need), s.id);
    assert.ok(Object.isFrozen(s) && Object.isFrozen(s.theme), s.id + ' gelée');
    const th = s.theme;
    assert.ok(th.sky.length === 2 && th.ground.length === 2, s.id + ' sky/ground');
    for (const c of [...th.sky, ...th.ground]) assert.match(c, /^#[0-9a-f]{6}$/, s.id);
    assert.ok(typeof th.obstacle === 'string' && th.obstacle.length > 0, s.id + ' obstacle');
    assert.ok(th.decos.length >= 4 && th.decos.length <= 5, s.id + ' decos');
    for (const d of th.decos) {
      assert.ok(d.e && typeof d.s === 'number', s.id + ' deco');
      assert.ok(d.top !== undefined || d.bot !== undefined, s.id + ' deco top/bot');
      assert.ok(d.x !== undefined || d.drift !== undefined, s.id + ' deco x/drift');
    }
  }
  assert.equal(axis, 'fr.fluence');
});

test('niveaux lvl, mondes, cibles et paliers', () => {
  const lv = STORIES.map(s => s.lvl);
  for (let i = 1; i < lv.length; i++) assert.ok(lv[i] > lv[i - 1], `lvl croissant (${STORIES[i].id})`);
  assert.deepEqual(lv.slice(0, 6), [1.2, 1.3, 1.4, 1.5, 1.6, 1.7]);
  const mid = lv.slice(6, 21);
  assert.equal(mid[0], 2); assert.equal(mid[14], 3);
  for (let k = 0; k < 15; k++) assert.ok(Math.abs(mid[k] - (2 + k / 14)) < 0.006, 'régulier : ' + mid[k]);
  assert.deepEqual(lv.slice(21, 27), [3.2, 3.34, 3.48, 3.62, 3.76, 3.9]);
  assert.deepEqual(lv.slice(27), [4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9]);
  const worldAt = i => (i <= 5 ? 'galops' : i <= 10 ? 'trot' : i <= 15 ? 'grand-galop' : i <= 20 ? 'champion' : i <= 26 ? 'emerite' : 'legende');
  STORIES.forEach((s, i) => assert.equal(s.world, worldAt(i), s.id));
  assert.deepEqual(CM2_STORIES.map(s => s.target), [102, 104, 106, 108, 110, 112, 114, 116, 118, 120]);
  assert.deepEqual(CM2_STORIES.map(s => s.need), [60, 62, 64, 67, 70, 73, 76, 79, 82, 85]);
  for (const s of CM2_STORIES) assert.match(s.id, /^cm2-[a-z]+$/);
});

test('mondes : noms, emojis, bornes, jamais de classe', () => {
  assert.deepEqual(WORLDS.map(w => [w.id, w.name, w.emoji]), [
    ['galops', 'Premiers galops', '🐣'], ['trot', 'Petit trot', '🌱'], ['grand-galop', 'Grand galop', '🐎'],
    ['champion', 'Champion', '🏆'], ['emerite', 'Cavalier émérite', '🎖️'], ['legende', 'Légende du ranch', '🌟']
  ]);
  let next = 0;
  for (const w of WORLDS) {
    assert.equal(w.from, next, w.id);
    assert.ok(w.to >= w.from);
    next = w.to + 1;
    assert.equal(w.label, w.name + ' ' + w.emoji);
    assert.doesNotMatch(w.name + ' ' + w.label, /\b(CP|CE1|CE2|CM1|CM2)\b/);
    for (const s of storiesOf(w.id)) assert.equal(s.world, w.id);
    assert.equal(storiesOf(w).length, w.to - w.from + 1);
  }
  assert.equal(next, STORIES.length);
  assert.deepEqual(storiesOf('inconnu'), []);
});

test('storyById, storyIndex, itemFor', () => {
  assert.equal(storyById('pomme').title, '{N} {leM}');
  assert.equal(storyById('nope'), null);
  assert.equal(storyIndex('cm2-lanternes'), 36);
  assert.equal(storyIndex('nope'), -1);
  assert.deepEqual(itemFor('cm2-pie'), {
    axis: 'fr.fluence', kind: 'story', key: 'fr.fluence:cm2-pie', storyId: 'cm2-pie', A: 4.2,
    prompt: 'La voleuse de trésors', answer: null, leitner: false, data: { storyId: 'cm2-pie' }
  });
  assert.equal(itemFor('nope'), null);
});

/* ---------- parité v11 ---------- */
function v11Stories() {
  let html;
  try {
    html = execFileSync('git', ['show', V11_COMMIT + ':index.html'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 << 20 });
  } catch (_) { return null; }
  const block = html.slice(html.indexOf('const STORIES = ['), html.indexOf('const LEVELS'));
  const re = /\{ id:'([^']+)', emoji:'([^']+)', title:'([^']*)', target:(\d+), need:(\d+), best:0,\s*theme:(\{[\s\S]*?\}),\s*text:"([^"]*)" \}/g;
  return [...block.matchAll(re)].map(m => ({
    id: m[1], emoji: m[2], title: m[3], target: +m[4], need: +m[5],
    theme: new Function('return (' + m[6] + ');')(), text: m[7]
  }));
}
test('27 histoires v11 copiées verbatim (ids, titres, cibles, paliers, décors, textes)', () => {
  const v11 = v11Stories();
  if (!v11) { console.log(`  ⚠ git show ${V11_COMMIT}:index.html indisponible : parité v11 non vérifiée`); return; }
  assert.equal(v11.length, 27, 'extraction v11');
  assert.deepEqual(LEGACY_STORIES.map(s => s.id), v11.map(s => s.id));
  v11.forEach((o, i) => {
    const s = LEGACY_STORIES[i];
    for (const k of ['emoji', 'title', 'target', 'need']) assert.strictEqual(s[k], o[k], `${o.id}.${k}`);
    /* v2 : seuls les jetons d'accord ajoutés diffèrent ; revenus à leur forme v11, le texte est identique */
    assert.strictEqual(V11_FORMS(s.text), o.text, `${o.id}.text`);
    assert.deepEqual(JSON.parse(JSON.stringify(s.theme)), o.theme, o.id + '.theme');
  });
});

/* ---------- contraintes de lecture à voix haute ---------- */
test('textes : ni apostrophe, ni trait d’union, ni chiffre, ni guillemet, ni tiret', () => {
  for (const s of STORIES) {
    const bad = [...s.text].filter(c => FORBIDDEN.test(c));
    assert.deepEqual(bad, [], s.id);
    assert.ok(!/\bunk\b/i.test(s.text), s.id + ' : mot réservé unk');
    assert.equal(s.text, s.text.trim(), s.id);
    assert.ok(!/\s{2,}|[\t\n]/.test(s.text), s.id + ' : espaces');
    assert.match(s.text, /[.!?]$/, s.id + ' : ponctuation finale');
    assert.ok(!/'/.test(s.title), s.id + ' : apostrophe droite dans le titre');
  }
});

test('CM2 : au moins 150 mots, jamais « ils » ni « ranch », aucune élision manquante', () => {
  for (const s of CM2_STORIES) {
    assert.ok(countWords(s.text) >= 150, `${s.id} : ${countWords(s.text)} mots`);
    assert.ok(countWords(fill(s.text, profileOf('f', 'pony'))) >= 150, s.id);
    const B = '(?<![\\p{L}])', E = '(?![\\p{L}])';
    /* le duo fille + licorne serait « elles » : jamais de pronom pluriel genré pour le héros et sa monture */
    assert.doesNotMatch(s.text, new RegExp(B + '(ils|eux|tous les deux|amis|visiteurs|sauveteurs|héros|aventuriers|compagnons|explorateurs|ranch)' + E, 'iu'), s.id);
    /* mot élidable devant une voyelle, un h muet probable ou un jeton (prénom à voyelle possible) */
    assert.doesNotMatch(s.text, new RegExp(B + '(de|que|si|ne|se|le|la|je|me|te|lorsque|puisque|jusque)\\s+(\\{|[aeiouyéèêàâîïôûœ])', 'iu'), s.id);
    /* rien ne suppose un cheval */
    assert.doesNotMatch(s.text, /sabot|crini|henn|galop|selle|écurie|patte|queue|oreille/iu, s.id);
  }
});

test('jetons de template valides partout (textes, titres, questions)', () => {
  for (const s of STORIES) {
    const parts = [s.text, s.title, s.q.q, s.q.cite, ...s.q.choices];
    for (const p of parts) {
      for (const m of p.matchAll(/\{(\w+)\}/g)) assert.ok(TOKENS.has(m[1]), `${s.id} : jeton inconnu {${m[1]}}`);
      assert.ok(!/[{}]/.test(p.replace(/\{\w+\}/g, '')), `${s.id} : accolade isolée`);
    }
  }
});

test('templating : 2 genres × 8 montures, aucune accolade restante', () => {
  assert.equal(COMBOS.length, 16);
  for (const p of COMBOS) {
    for (const s of STORIES) {
      for (const part of [s.text, s.title, s.q.q, s.q.cite, ...s.q.choices]) {
        const out = fill(part, p);
        assert.ok(!/[{}]/.test(out), `${s.id} (${p.g}/${p.companion.type}) : ${out}`);
      }
      assert.ok(fill(s.text, p).includes(fill(s.q.cite, p)), s.id + ' : cite après templating');
    }
  }
  const t = fill(storyById('cm2-grotte').text, profileOf('m', 'unicorn'));
  assert.ok(t.includes('Caramel admire ce spectacle, fascinée.'), 'accord monture féminine');
  assert.ok(fill('{El} {fiere}', profileOf('m', 'dragon')) === 'Il fier');
});

/* ---------- lexique Vosk ---------- */
test('lexique : 0 mot hors lexique en CM2, OOV exact pour les textes v11', () => {
  const lex = loadLexicon();
  for (const s of CM2_STORIES) {
    const oov = [...new Set(words(stripTokens(s.text)).filter(w => !lex.has(w)))];
    assert.deepEqual(oov, [], s.id + ' : mots hors lexique');
  }
  const all = new Set();
  for (const s of STORIES) for (const w of words(stripTokens(s.text))) if (!lex.has(w)) all.add(w);
  assert.deepEqual([...OOV].sort(), [...all].sort(), 'OOV doit lister exactement les mots hors lexique');
  assert.equal(OOV.size, 4, '2.2.4 : 4 mots hors du lexique de vosk-model-small-fr-0.22 (11 avec le modèle v11)');
  for (const w of OOV) {
    assert.equal(w, normalizeForGrammar(w), w + ' : forme de la grammaire');
    assert.ok(STORIES.some(s => words(s.text).includes(w)), w + ' : présent dans un texte');
  }
});

test('lexique après templating : seul le nom de monture « capybara » manque (couvert par la règle v11.2)', () => {
  const lex = loadLexicon();
  for (const p of COMBOS) {
    const noun = MOUNTS[p.companion.type][0];
    for (const s of STORIES) {
      const miss = words(fill(s.text, p)).filter(w => !lex.has(w) && !OOV.has(w) && w !== noun);
      assert.deepEqual(miss, [], `${s.id} (${p.g}/${p.companion.type})`);
    }
  }
  assert.ok(!lex.has('capybara') && lex.has('licorne'));
});

/* ---------- questions ---------- */
test('37 questions bien formées (4 choix distincts, réponse valide, passage cité)', () => {
  assert.deepEqual(Object.keys(QUESTIONS).sort(), STORIES.map(s => s.id).sort());
  const types = { explicite: 0, inference: 0, vocabulaire: 0 }, pos = [0, 0, 0, 0];
  for (const s of STORIES) {
    const q = s.q;
    assert.equal(q, QUESTIONS[s.id]);
    assert.ok(q.type in types, s.id + ' type');
    types[q.type]++;
    assert.ok(typeof q.q === 'string' && q.q.length > 8, s.id);
    assert.ok(q.q.endsWith(NNBSP + '?') || q.q.endsWith(NNBSP + ':'), s.id + ' : ? ou : final (espace fine)');
    assert.equal(q.choices.length, 4, s.id);
    assert.equal(new Set(q.choices).size, 4, s.id + ' : choix distincts');
    for (const c of q.choices) assert.ok(typeof c === 'string' && c.trim().length > 0, s.id);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, s.id + ' answer');
    pos[q.answer]++;
    assert.ok(s.text.includes(q.cite), s.id + ' : cite doit être un extrait exact du texte');
    for (const t of [q.q, ...q.choices]) {
      assert.ok(!t.includes("'"), s.id + ' : apostrophe typographique attendue');
      assert.doesNotMatch(t, / [?!:;»]|« /, s.id + ' : espace fine attendue');
      assert.doesNotMatch(t, /\b(de|que|à) \{(P|N)\}/, s.id + ' : élision impossible devant un prénom');
    }
  }
  for (const k of Object.keys(types)) assert.ok(types[k] >= 5, 'type ' + k);
  for (const n of pos) assert.ok(n >= 7, 'bonnes réponses réparties : ' + pos);
  /* CM1 + CM2 : majorité d'inférences */
  const cm = STORIES.filter(s => s.world === 'emerite' || s.world === 'legende');
  assert.ok(cm.filter(s => s.q.type === 'inference').length > cm.length / 2);
});

/* ---------- générateur ---------- */
const nearest = (A, n = 3) => STORIES.slice().sort((x, y) => Math.abs(x.lvl - A) - Math.abs(y.lvl - A) || x.lvl - y.lvl).slice(0, n).map(s => s.id);

test('gen : item conforme, déterministe', () => {
  const it = gen(2.5, makeRng(7));
  assert.equal(it.axis, 'fr.fluence');
  assert.equal(it.kind, 'story');
  assert.equal(it.key, 'fr.fluence:' + it.storyId);
  assert.equal(it.A, storyById(it.storyId).lvl);
  assert.equal(it.prompt, storyById(it.storyId).title);
  assert.equal(it.answer, null);
  assert.equal(it.leitner, false);
  assert.deepEqual(it.data, { storyId: it.storyId });
  for (let A = 0; A <= 5.6; A += 0.1)
    for (let seed = 1; seed <= 6; seed++)
      assert.deepEqual(gen(A, makeRng(seed)), gen(A, makeRng(seed)), `A=${A} seed=${seed}`);
  /* sans rng : l'histoire la plus proche (repli défensif, déterministe) */
  assert.equal(gen(2.5, null).storyId, 'pluie');
  assert.equal(gen(4.04, undefined, { avoid: ['fr.fluence:cm2-abeilles'] }).storyId, 'cm2-moulin');
});

test('gen : histoire proche de A sur toute la plage 0 → 5,6', () => {
  for (let i = 0; i <= 112; i++) {
    const A = i * 0.05;
    for (let seed = 1; seed <= 8; seed++) {
      const s = storyById(gen(A, makeRng(seed * 31 + i)).storyId);
      const ok = Math.abs(s.lvl - A) <= 0.35 + 1e-9 || nearest(A).includes(s.id);
      assert.ok(ok, `A=${A.toFixed(2)} → ${s.id} (lvl ${s.lvl})`);
    }
  }
  /* extrêmes : textes les plus simples / les plus longs */
  for (let seed = 1; seed <= 20; seed++) {
    assert.ok(['ce1-carotte', 'ce1-bain', 'ce1-verger'].includes(gen(0, makeRng(seed)).storyId));
    assert.ok(['cm2-lanternes', 'cm2-neige', 'cm2-grotte'].includes(gen(5.6, makeRng(seed)).storyId));
  }
  assert.ok(gen(NaN, makeRng(1)).storyId, 'A invalide → item quand même');
  /* de la variété dans la fenêtre */
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) seen.add(gen(2.5, makeRng(seed)).storyId);
  assert.ok(seen.size >= 4, 'variété : ' + [...seen]);
});

test('gen : avoid, recent, stars, allowed, profile', () => {
  const A = 4.45;                                   /* fenêtre 4,1 → 4,8 */
  const inWin = STORIES.filter(s => Math.abs(s.lvl - A) <= 0.35 + 1e-9).map(s => s.id);
  assert.deepEqual(inWin, ['cm2-moulin', 'cm2-pie', 'cm2-phoque', 'cm2-chevreau', 'cm2-brouillard', 'cm2-citrouille', 'cm2-grotte', 'cm2-neige']);
  const keep = 'cm2-grotte';
  const avoid = new Set(inWin.filter(id => id !== keep).map(id => 'fr.fluence:' + id));
  const recent = inWin.filter(id => id !== keep);
  const stars = Object.fromEntries(inWin.filter(id => id !== keep).map(id => [id, 3]));
  for (let seed = 1; seed <= 25; seed++) {
    assert.equal(gen(A, makeRng(seed), { avoid }).storyId, keep, 'avoid');
    assert.equal(gen(A, makeRng(seed), { recent }).storyId, keep, 'recent');
    assert.equal(gen(A, makeRng(seed), { stars }).storyId, keep, 'stars < 3 préférées');
    assert.equal(gen(A, makeRng(seed), { allowed: ['pomme'] }).storyId, 'pomme', 'allowed (liste)');
    assert.equal(gen(A, makeRng(seed), { allowed: s => s.id === 'reve' }).storyId, 'reve', 'allowed (fonction)');
    const all = new Set(STORIES.map(s => 'fr.fluence:' + s.id));
    assert.ok(storyById(gen(A, makeRng(seed), { avoid: all }).storyId), 'tout évité → item quand même');
    /* toutes à 3 ⭐ : on rejoue quand même une histoire de la fenêtre */
    const all3 = Object.fromEntries(STORIES.map(s => [s.id, 3]));
    assert.ok(inWin.includes(gen(A, makeRng(seed), { stars: all3 }).storyId));
  }
  /* profil CM2 sans ⭐ : seules les histoires débloquées (need ≤ 60) sont proposées */
  const cm2 = { classe: 'CM2', wallet: { stars: {} }, mclm: [] };
  for (let seed = 1; seed <= 25; seed++) {
    const id = gen(4.9, makeRng(seed), { profile: cm2 }).storyId;
    assert.ok(['cm2-abeilles', 'cm1-aurore', 'cm1-phare'].includes(id), id);
  }
  /* profil : les 3 dernières histoires lues sont évitées */
  const reader = { classe: 'CM2', wallet: { stars: {} }, mclm: [{ s: 'cm1-phare' }, { s: 'cm1-aurore' }, { s: 'cm1-riviere' }] };
  for (let seed = 1; seed <= 25; seed++) {
    const id = gen(3.9, makeRng(seed), { profile: reader }).storyId;
    assert.ok(!['cm1-phare', 'cm1-aurore', 'cm1-riviere'].includes(id), id);
  }
});

/* ---------- déblocage ---------- */
test('classBonus, totalStarsOf, isUnlocked', () => {
  assert.deepEqual(['CP', 'CE1', 'CE2', 'CM1', 'CM2'].map(classBonus), [0, 0, 0, 33, 60]);
  assert.equal(classBonus(null), 0);
  assert.equal(classBonus('6e'), 0);
  assert.equal(classBonus('CM1'), storiesOf('emerite')[0].need);
  assert.equal(totalStarsOf(null), 0);
  assert.equal(totalStarsOf({}), 0);
  assert.equal(totalStarsOf({ wallet: { stars: { pomme: 5, foret: 2, inconnue: 3, neige: 'x', plage: -1, cirque: 2.7 } } }), 7);
  const full = { wallet: { stars: Object.fromEntries(STORIES.map(s => [s.id, 3])) } };
  assert.equal(totalStarsOf(full), 111);

  const cm2 = stars => ({ classe: 'CM2', wallet: { stars } });
  assert.ok(isUnlocked('cm2-abeilles', cm2({})));
  assert.ok(!isUnlocked('cm2-moulin', cm2({})));
  assert.ok(isUnlocked(storyById('cm2-moulin'), cm2({ pomme: 2 })));
  assert.ok(STORIES.slice(0, 28).every(s => isUnlocked(s, cm2({}))), 'CM2 : tout le v11 + la 1re légende');
  const cm1 = { classe: 'CM1', wallet: { stars: {} } };
  assert.ok(isUnlocked('cm1-orage', cm1) && !isUnlocked('cm1-course', cm1));
  const ce1 = stars => ({ classe: 'CE1', wallet: { stars } });
  assert.ok(isUnlocked('pomme', ce1({})) && !isUnlocked('plage', ce1({})));
  assert.ok(isUnlocked('plage', ce1({ 'ce1-bain': 2 })));
  /* une histoire déjà étoilée reste ouverte, même si le total ne suffit plus */
  assert.ok(isUnlocked('cm1-aurore', ce1({ 'cm1-aurore': 1 })));
  assert.ok(!isUnlocked('nope', ce1({})));
  assert.ok(!isUnlocked('cm2-lanternes', null));
  assert.ok(isUnlocked('ce1-carotte', null));
  /* toutes les histoires sont atteignables sans bonus de classe */
  let stars = {};
  for (const s of STORIES) {
    assert.ok(isUnlocked(s, { classe: 'CP', wallet: { stars } }), s.id + ' atteignable');
    stars = { ...stars, [s.id]: 3 };
  }
});

test('aucune élision manquante devant un prénom (« de Inès », « que Éclair ») dans les histoires et les questions', () => {
  const bad = /(?<![\p{L}])(de|que|si|ne|se|le|la|je|me|te|lorsque|puisque|jusque)\s+\{(P|N)\}/iu;
  for (const s of STORIES) for (const part of [s.text, s.title, s.q.q, s.q.cite, ...s.q.choices]) assert.doesNotMatch(part, bad, s.id + ' : ' + part);
});
