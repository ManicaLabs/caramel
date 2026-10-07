/* v2.5 — compagnons qui nagent (demande du parent du 07/10/2026 : « la baleine ») et noms des nouveaux compagnons dans
   la course de lecture.
   1. Baleine (js/ui/mount-svg.js) : rendu sans NaN pour expressions × humeurs × stades × accessoires, jet d'eau caché
      par défaut (montré par css/ui/mount.css), vague au premier plan, ancrages, portrait, ligne d'eau du petit.
   2. Régime (js/content/companion-data.js), miettes et action « souffle » (js/ui/companion-life.js).
   3. « Vit dans l'eau » (inWater) : dauphin et baleine ; plus aucun test codé en dur sur le dauphin là où l'eau compte
      (jeux, balade, scène de l'accueil).
   4. Course de lecture : les 8 nouveaux noms sont dans le lexique Vosk ; « ours » s'élide (« l’ours ») et la forme
      élidée rejoint la grammaire (« l'ours », connu de Vosk) et les noms propres. */
import { test, assert } from './_t.mjs';
import { readFileSync } from 'node:fs';
import { mountSVG, mountAnchors, EXPRESSIONS, MOODS } from '../js/ui/mount-svg.js';
import { MOUNTS, SHOP, FOODS, FOOD_BY_ID, foodsOf, foodLine, inWater, coatOf } from '../js/content/companion-data.js';
import { SPECIES_ACTS, CRUMBS, createPlanner, makeRng } from '../js/ui/companion-life.js';
import { tplMap, fillTemplate, defaultProfile } from '../js/core/profiles.js';
import * as E from '../js/games/course-engine.js';
import { STORIES, OOV } from '../js/content/stories/index.js';
import { loadLexicon } from './lexicon.mjs';

const SRC = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const ALL_IDS = SHOP.map(s => s.id);
const NEW8 = ['bear', 'koala', 'dog', 'whale', 'owl', 'parrot', 'penguin', 'chick'];
/* groupe (balise ouvrante + contenu) d'une classe donnée, dans la chaîne SVG */
const groupOf = (svg, cls) => {
  const i = svg.indexOf(`<g class="${cls}"`);
  if (i < 0) return '';
  let depth = 0, k = i;
  const re = /<(\/?)g\b[^>]*?(\/?)>/g;
  re.lastIndex = i;
  for (let m; (m = re.exec(svg));) {
    if (m[2]) continue;
    depth += m[1] ? -1 : 1;
    if (!depth) { k = re.lastIndex; break; }
  }
  return svg.slice(i, k);
};

/* ---------- 1. dessin ---------- */
test('baleine : expressions × humeurs × stades × accessoires, sans valeur invalide', () => {
  let n = 0;
  for (const expr of [...EXPRESSIONS, undefined]) for (const mood of ['', ...MOODS, 'joy dance', 'sad walk']) for (const stage of [1, 2, 3])
    for (const worn of [[], ['chapeau', 'foulard'], ['ailes', 'noeud', 'selle', 'echarpe', 'couronne', 'lunettes'], ALL_IDS]) {
      const svg = mountSVG('whale', worn, 120, mood, { expr, stage });
      assert.ok(!/NaN|undefined|null|Infinity|\[object/.test(svg), `${expr} ${mood} ${stage}`);
      assert.ok(svg.startsWith('<svg class="m-root c-rig sp-whale') && svg.includes('data-species="whale"'));
      n++;
    }
  assert.ok(n > 1000, n + ' combinaisons');
});

test('baleine : jet d’eau caché par défaut (montré par mount.css), vague au premier plan, nageoire', () => {
  const svg = mountSVG('whale', [], 100, '');
  const spout = groupOf(svg, 'c-spout');
  assert.ok(spout.startsWith('<g class="c-spout" display="none">'), 'jet d’eau présent mais caché sans CSS');
  assert.ok(groupOf(svg, 'c-head').includes('class="c-spout"'), 'le jet suit la tête (évent)');
  assert.ok(svg.indexOf('class="c-wave"') > svg.indexOf('class="c-all"'), 'vague au premier plan, après le corps');
  assert.ok(/<g class="m-legF"><g class="c-leg"[^>]*><rect class="c-pv"/.test(svg), 'nageoire (première .c-leg de devant)');
  /* les huit accessoires, un par emplacement */
  const set = ['ailes', 'noeud', 'selle', 'echarpe', 'couronne', 'lunettes'];
  const all = mountSVG('whale', set, 100, '');
  for (const it of set) assert.ok(all.includes('acc-' + it), it);
  for (const id of ALL_IDS) assert.ok(mountSVG('whale', [id], 100, '').includes('acc-' + id), id + ' seul');
  /* mount.css : quand le jet jaillit, et jamais en dormant ni en mangeant */
  const css = SRC('css/ui/mount.css');
  for (const sel of ['.sp-whale[data-expr="happy"] .c-spout', '.sp-whale[data-expr="delighted"] .c-spout', '.sp-whale.dance .c-spout', '.sp-whale.spout .c-spout'])
    assert.ok(css.includes(sel), sel);
  assert.ok(/\.sp-whale\.sleep \.c-spout, \.sp-whale\.eat \.c-spout \{ display: none; \}/.test(css));
  /* tête-dôme : animations en rotation seule (une translation ferait une marche à la jointure du dos) */
  for (const k of ['c-nod-w', 'c-chew-w']) {
    const m = new RegExp('@keyframes ' + k + '\\s*\\{([^]*?)\\n\\}').exec(css);
    assert.ok(m, k);
    for (const f of m[1].match(/transform:[^;}]*/g)) {
      assert.ok(f.includes('translate(var(--px), var(--py)) rotate(var(--pr))'), 'pose reprise : ' + f);
      assert.ok(!/translate(Y)?\((?!var)/.test(f.replace('translate(var(--px), var(--py))', '')), 'pas de translation propre : ' + f);
    }
  }
});

test('baleine : ancrages finis, visage tourné vers la droite, portrait carré cadré sur la tête', () => {
  for (const stage of [1, 2, 3]) {
    const a = mountAnchors('whale', { stage });
    for (const p of [a.mouth, a.top, a.neck, a.back, a.chest, a.tail, ...a.eyes]) assert.ok(p.every(Number.isFinite) && p[1] < 74, String(p));
    assert.ok(a.mouth[0] > a.eyes[0][0] && a.eyes[1][0] > a.eyes[0][0], 'tournée vers la droite');
    assert.ok(a.top[1] < a.eyes[0][1] && a.tail[0] < a.back[0] && a.back[0] < a.mouth[0]);
    const pt = mountSVG('whale', [], 48, '', { view: 'portrait', stage });
    const [x, y, w, h] = /viewBox="([^"]+)"/.exec(pt)[1].split(' ').map(Number);
    assert.ok(w === h && pt.includes('width="48" height="48"'), 'carré');
    for (const p of [a.mouth, ...a.eyes]) assert.ok(p[0] > x && p[0] < x + w && p[1] > y && p[1] < y + h, 'visage dans le portrait');
  }
});

test('baleine : le petit garde la même ligne d’eau (il ne s’enfonce pas sous la vague)', () => {
  for (const stage of [1, 3]) {
    const svg = mountSVG('whale', [], 100, '', { stage });
    const body = /<g class="m-body"><g transform="matrix\(([^)]+)\)">/.exec(svg);
    const all = /<g class="c-all"><g transform="matrix\(([^)]+)\)">/.exec(svg);
    assert.ok(body, 'transformation du corps au stade ' + stage);
    const [, , , d, , f] = body[1].split(' ').map(Number);
    let y = d * 63 + f;
    if (all) { const [, , , d2, , f2] = all[1].split(' ').map(Number); y = d2 * y + f2; }
    assert.ok(Math.abs(y - 63) < 1.2, `stade ${stage} : ligne d’eau ${y.toFixed(2)}`);
  }
});

/* ---------- 2. régime, miettes, action ---------- */
test('baleine : crevette, petits poissons, calamar (petit 5 🍎, moyen 10 🍎, régal 25 🍎), miettes', () => {
  assert.deepEqual(foodsOf('whale').map(f => f.id), ['crevette', 'petitspoissons', 'calamar']);
  assert.deepEqual(foodsOf('whale').map(f => [f.price, f.faim, f.joie]), [[5, 15, 0], [10, 30, 5], [25, 70, 12]]);
  assert.notDeepEqual(foodsOf('whale'), foodsOf('dolphin'), 'pas le même menu que le dauphin');
  const pp = FOOD_BY_ID.petitspoissons;
  assert.equal(pp.e, '🐠');
  assert.equal(foodLine(pp), 'Miam, des petits poissons !');
  assert.equal(FOODS.filter(f => f.e === '🐠').length, 1, 'un emoji = un aliment');
  for (const f of foodsOf('whale')) assert.ok(Array.isArray(CRUMBS[f.e]) && CRUMBS[f.e].length === 3, f.id + ' : miettes');
  assert.equal(MOUNTS.whale.g, 'f');
  assert.equal(coatOf('whale'), 'peau');
});

test('baleine : elle souffle (action « spout »), saute et fait des bulles', () => {
  assert.deepEqual([...new Set(SPECIES_ACTS.whale)].sort(), ['bubbles', 'jump', 'spout']);
  const life = SRC('js/ui/companion-life.js');
  assert.ok(life.includes('async _actSpout('), 'chorégraphie du souffle');
  assert.ok(/_pulse\('spout'/.test(life), 'classe spout posée sur la racine (mount.css montre le jet)');
  const p = createPlanner({ species: 'whale', stage: 2, rng: makeRng(7) });
  const seen = new Map();
  for (let i = 0; i < 600; i++) { const a = p.action({ mood: 'ok' }).name; seen.set(a, (seen.get(a) || 0) + 1); }
  assert.ok((seen.get('spout') || 0) > (seen.get('bubbles') || 0), 'elle souffle plus souvent : ' + JSON.stringify([...seen]));
});

/* ---------- 3. l'eau ---------- */
test('inWater : le dauphin et la baleine nagent, les autres non ; seuls les nageurs ont une vague', () => {
  assert.deepEqual(Object.keys(MOUNTS).filter(inWater).sort(), ['dolphin', 'whale']);
  assert.equal(inWater('licorne-volante'), false);
  assert.equal(inWater(undefined), false);
  for (const t of Object.keys(MOUNTS)) assert.equal(mountSVG(t, [], 100, '').includes('class="c-wave"'), inWater(t), t + ' : vague ⇔ inWater');
});

test('plus de test codé en dur sur le dauphin là où l’eau compte (jeux, balade, scène de l’accueil)', () => {
  for (const f of ['js/games/course.js', 'js/games/cloture.js', 'js/games/tables.js', 'js/ui/balade.js']) {
    const s = SRC(f);
    assert.ok(!/['"]dolphin['"]/.test(s), f + ' : « dolphin » codé en dur');
    assert.ok(/!inWater\(\w+\.getAttribute\('data-species'\)\)/.test(s), f + ' : inWater');
  }
  const css = SRC('css/ui/companion.css');
  assert.ok(!/dolphin/.test(css), 'companion.css : plus de [data-species="dolphin"]');
  for (const sel of ['.cc-stage:has(.c-wave) .l-lake', '.cc-stage:has(.c-wave) .l-puddle', '.cc-stage:has(.c-wave) .cc-walker', '.cc-stage:has(.c-wave) .cc-flower'])
    assert.ok(css.includes(sel), sel);
});

/* ---------- 4. course de lecture ---------- */
test('course : les 8 nouveaux noms sont dans le lexique Vosk', () => {
  const lex = loadLexicon();
  for (const t of NEW8) assert.ok(lex.has(MOUNTS[t].noun), MOUNTS[t].noun);
  assert.ok(lex.has("l'ours"), 'forme élidée connue de Vosk');
});

test('course : « l’ours » (élision) dans les histoires, la grammaire et les noms propres', () => {
  const p = defaultProfile({ id: 'p1', name: 'Léa', g: 'f', classe: 'CE1', today: '2026-10-07' });
  p.companion.type = 'bear'; p.companion.name = 'Noisette';
  assert.equal(tplMap(p).leM, 'l’ours');
  const lex = loadLexicon();
  let elided = 0;
  for (const s of STORIES) {
    const text = fillTemplate(s.text, p);
    assert.ok(!/\b(le|du) ours\b/i.test(text), s.id + ' : ' + text.slice(0, 60));
    const r = E.createRace(text, { mountNoun: MOUNTS.bear.noun, oov: OOV });
    const el = E.elisionsOf(r.target);
    for (const w of el) assert.ok(lex.has(w), w + ' : forme du lexique');
    for (const t of r.target) {
      if (!/^\p{L}['’]/u.test(t.raw)) continue;
      elided++;
      assert.ok(r.proper.has(t.norm), t.raw + ' : validable par [unk] (monture)');
      assert.ok(el.includes(t.raw.toLowerCase().replace(/’/g, "'").replace(/[^\p{L}']/gu, '')), t.raw + ' : dans la grammaire');
    }
  }
  assert.ok(elided > 10, elided + ' formes élidées');
  /* la grammaire v11 ne change pas (textes sans apostrophe) */
  const plain = E.createRace('Le poney court vite. Il saute !', { mountNoun: 'poney' });
  assert.deepEqual(E.elisionsOf(plain.target), []);
  assert.deepEqual([...plain.proper], ['poney']);
});

test('course : chaque mot des histoires, avec chaque nouveau compagnon, est reconnaissable par Vosk', () => {
  const lex = loadLexicon();
  for (const t of NEW8) for (const g of ['f', 'm']) {
    const p = defaultProfile({ id: 'p1', name: 'Léa', g, classe: 'CE1', today: '2026-10-07' });
    p.companion.type = t; p.companion.name = 'Noisette';
    for (const s of STORIES) {
      const r = E.createRace(fillTemplate(s.text, p), { mountNoun: MOUNTS[t].noun, oov: OOV });
      const ok = new Set(E.elisionsOf(r.target).map(w => w.replace(/'/g, '')));
      const miss = E.grammarOf(r.target).filter(w => !lex.has(w) && !OOV.has(w) && !ok.has(w) && w !== 'noisette' && w !== 'léa');
      assert.deepEqual(miss, [], `${t}/${g}/${s.id}`);
    }
  }
});
