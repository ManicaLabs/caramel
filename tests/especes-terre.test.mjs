/* v2.5 — compagnons « terre » : ours (bear), koala (koala), chien (dog) (js/ui/mount-svg.js, zone TERRE ; aliments de
   js/content/companion-data.js ; actions et miettes de js/ui/companion-life.js ; animations de css/ui/mount.css).
   Le contrat commun du rig est vérifié pour toutes les espèces par tests/companion-art.test.mjs ; ici : rendu de chaque
   espèce × expressions × humeurs × stades × accessoires sans valeur invalide, traits propres (langue du chien, queue
   pompon de l'ours, oreilles duveteuses du koala), ancrages dans le cadre, portrait, régime, miettes, actions. */
import { test, assert } from './_t.mjs';
import { readFileSync } from 'node:fs';
import { mountSVG, mountAnchors, EXPRESSIONS, MOODS } from '../js/ui/mount-svg.js';
import { MOUNTS, SHOP, FOODS, FOOD_BY_ID, DIET, foodsOf, foodLine } from '../js/content/companion-data.js';
import { CRUMBS, SPECIES_ACTS, GENERIC_ACTS, createPlanner, makeRng } from '../js/ui/companion-life.js';

const TERRE = ['bear', 'koala', 'dog'];
const IDS = SHOP.map(s => s.id);
const COMBOS = [[], ...IDS.map(id => [id]), ['ailes', 'noeud', 'selle', 'echarpe', 'couronne', 'lunettes'],
  ['ailes', 'noeud', 'selle', 'foulard', 'chapeau', 'lunettes']];
const BAD = /NaN|undefined|null|Infinity|\[object/;

test('terre : les trois espèces existent (MOUNTS, dessin propre, pas un repli)', () => {
  for (const t of TERRE) {
    assert.ok(MOUNTS[t], t + ' dans MOUNTS');
    const svg = mountSVG(t, [], 100, '');
    assert.ok(svg.includes('sp-' + t) && svg.includes(`data-species="${t}"`), t + ' : pas de repli sur le poney');
  }
  /* trois dessins distincts entre eux et des espèces dont ils partent (chat, lion, capybara) */
  const all = [...TERRE, 'cat', 'lion', 'capy'].map(t => mountSVG(t, [], 100, '').replace(/sp-\w+|data-species="\w+"/g, ''));
  assert.equal(new Set(all).size, all.length, 'six dessins différents');
});

test('terre : espèce × expression × humeur × stade × accessoires — SVG valide', () => {
  let n = 0;
  for (const t of TERRE) for (const stage of [1, 2, 3]) {
    for (const expr of EXPRESSIONS) for (const mood of ['', ...MOODS]) {
      const svg = mountSVG(t, [], 120, mood, { expr, stage });
      assert.ok(!BAD.test(svg), `${t} ${expr} ${mood} stade ${stage} : valeur invalide`);
      assert.ok(svg.includes(`data-expr="${expr}"`) && svg.includes(`data-stage="${stage}"`));
      n++;
    }
    for (const worn of COMBOS) {
      const svg = mountSVG(t, worn, 100, 'walk', { stage });
      assert.ok(!BAD.test(svg), `${t} ${worn} : valeur invalide`);
      for (const id of worn) if (worn.length === 1) assert.ok(svg.includes('acc-' + id), `${t} : accessoire ${id}`);
      n++;
    }
  }
  assert.ok(n > 700, n + ' rendus');
});

test('terre : traits propres (langue du chien masquée sans CSS, visages de toutes les expressions)', () => {
  for (const t of TERRE) {
    const svg = mountSVG(t, [], 100, '');
    for (const ex of [...EXPRESSIONS, 'sad']) assert.ok(svg.includes(`class="c-x x-${ex}"`), `${t} : visage ${ex}`);
    /* pas d'id, pas de transform sur les groupes animés : vérifié pour toutes les espèces par companion-art */
    assert.ok(svg.length < 11500, `${t} : ${svg.length} octets`);
  }
  const dog = mountSVG('dog', [], 100, '');
  assert.ok(/<g class="c-tongue" display="none">/.test(dog), 'langue du chien : masquée par défaut (rendu sans CSS)');
  for (const t of ['bear', 'koala']) assert.ok(!mountSVG(t, [], 100, '').includes('c-tongue'), t + ' : pas de langue pendante');
});

test('terre : ancrages dans le cadre, bouche devant les yeux, sol à 74, portrait centré sur le visage', () => {
  for (const t of TERRE) for (const stage of [1, 2, 3]) {
    const a = mountAnchors(t, { stage });
    for (const p of [a.mouth, a.top, a.neck, a.back, a.chest, a.tail, ...a.eyes]) {
      assert.ok(p.every(Number.isFinite), `${t} : ${p}`);
      assert.ok(p[0] > 2 && p[0] < 98 && p[1] > 0 && p[1] < 74, `${t} stade ${stage} : point hors cadre ${p}`);
    }
    assert.ok(a.mouth[0] > Math.max(...a.eyes.map(e => e[0])) - 8, `${t} : bouche sous les yeux, vers l'avant`);
    assert.ok(a.top[1] < Math.min(...a.eyes.map(e => e[1])), `${t} : sommet au-dessus des yeux`);
    /* quadrupèdes : dos au-dessus du poitrail ; ours debout : dos derrière lui (à gauche), poitrail sous la tête */
    if (t === 'bear') assert.ok(a.back[0] < a.chest[0] && a.chest[1] > a.mouth[1], 'bear : dos à l’arrière, médaille sous le menton');
    else assert.ok(a.back[1] < a.chest[1], `${t} : dos au-dessus du poitrail`);
    assert.ok(a.tail[0] < a.chest[0], `${t} : queue à l'arrière`);
    assert.ok(Math.abs(a.ground - 74) < 0.5);
    for (const size of [48, 96]) {
      const svg = mountSVG(t, [], size, '', { view: 'portrait', stage });
      const [x, y, w, h] = /viewBox="([^"]+)"/.exec(svg)[1].split(' ').map(Number);
      assert.ok(w === h && w > 25 && w < 60, `${t} : portrait carré ${w}`);
      for (const p of [a.mouth, ...a.eyes]) assert.ok(p[0] > x + 3 && p[0] < x + w - 3 && p[1] > y + 3 && p[1] < y + h - 3, `${t} : visage dans le portrait`);
      assert.ok(svg.includes(`width="${size}" height="${size}"`));
    }
  }
});

test('terre : régime de chaque espèce (petit, moyen, régal), aliments bien formés', () => {
  const TIERS = [[5, 15, 0], [10, 30, 5], [25, 70, 12]];
  for (const t of TERRE) {
    const d = DIET[t];
    assert.ok(Array.isArray(d) && d.length === 3 && new Set(d).size === 3, t + ' : trois aliments différents');
    foodsOf(t).forEach((f, i) => {
      assert.ok(f && FOOD_BY_ID[f.id] === f, `${t} : aliment ${d[i]} connu`);
      assert.deepEqual([f.price, f.faim, f.joie], TIERS[i], `${t} : ${f.id} au palier ${i + 1}`);
      assert.match(f.say, /^(un|une|du|de la|des) \p{L}/u, `${f.id} : l'aliment avec son article`);
      assert.match(foodLine(f), /^Miam, .+ !$/);
      assert.ok(!/[\u00a0\u202f]/.test(f.say), f.id + ' : pas d’espace insécable dans la phrase dite');
    });
  }
  assert.deepEqual(DIET.bear, ['cerises', 'poisson', 'miel']);
  assert.deepEqual(DIET.koala, ['pousse', 'feuilles', 'eucalyptus']);
  assert.deepEqual(DIET.dog, ['croquettes', 'saucisse', 'os']);
});

test('aliments : liste sans trou, ids et emoji uniques (un emoji = un aliment), emoji d’Emoji 12 au plus', () => {
  /* chaque zone v2.5 ajoute ses entrées en commençant par une virgule : une virgule de trop laisserait un trou */
  assert.ok(FOODS.every(f => f && typeof f === 'object'), 'FOODS sans trou');
  assert.equal(new Set(FOODS.map(f => f.id)).size, FOODS.length, 'ids uniques');
  assert.equal(new Set(FOODS.map(f => f.e)).size, FOODS.length, 'emoji uniques');
  for (const f of FOODS) assert.match(f.id, /^[a-z]+$/, 'id sans accent : ' + f.id);
  /* les emoji de la zone terre et leur version (Emoji 1.0 à 11.0 : Android 9 et plus) */
  const V = { '🍒': 1, '🍯': 1, '🌱': 1, '🍃': 1, '🌿': 1, '🌭': 1, '🦴': 11, '🥣': 5, '🐟': 1 };
  for (const t of TERRE) for (const f of foodsOf(t)) assert.ok(V[f.e] && V[f.e] <= 12, f.id + ' : emoji ancien');
});

test('terre : miettes de chaque aliment (trois couleurs #rrggbb)', () => {
  for (const t of TERRE) for (const f of foodsOf(t)) {
    const c = CRUMBS[f.e];
    assert.ok(Array.isArray(c) && c.length === 3 && c.every(x => /^#[0-9a-f]{6}$/.test(x)), f.id + ' : miettes ' + f.e);
  }
  assert.equal(Object.keys(CRUMBS).length, new Set(Object.keys(CRUMBS)).size);
});

test('terre : actions spontanées propres à l’espèce, toutes chorégraphiées', () => {
  const SRC = readFileSync(new URL('../js/ui/companion-life.js', import.meta.url), 'utf8');
  for (const t of TERRE) {
    const acts = SPECIES_ACTS[t];
    assert.ok(Array.isArray(acts) && new Set(acts).size >= 3, t + ' : au moins trois actions');
    for (const a of acts) assert.ok(SRC.includes('async _act' + a.charAt(0).toUpperCase() + a.slice(1) + '('), t + ' : ' + a);
    const p = createPlanner({ species: t, stage: 2, rng: makeRng(7) });
    const seen = new Set();
    for (let i = 0; i < 300; i++) seen.add(p.action({ mood: 'ok' }).name);
    for (const a of acts) assert.ok(seen.has(a), t + ' : ' + a + ' tirée');
    for (const a of seen) assert.ok(acts.includes(a) || GENERIC_ACTS.includes(a));
  }
});

test('mount.css (zone terre) : queue du chien qui remue (pose reprise), langue, oreilles', () => {
  const css = readFileSync(new URL('../css/ui/mount.css', import.meta.url), 'utf8');
  const a = css.indexOf('v2.5 — TERRE'), b = css.indexOf('fin TERRE');
  assert.ok(a > 0 && b > a, 'zone terre');
  const z = css.slice(a, b);
  for (const k of ['c-wag', 'c-wag-fast']) {
    const m = new RegExp('@keyframes ' + k + '\\s*\\{([^]*?)\\n\\}').exec(z);
    assert.ok(m, 'keyframes ' + k);
    const frames = m[1].match(/transform:[^;}]*/g) || [];
    assert.ok(frames.length >= 2 && frames.every(f => f.includes('translate(var(--px), var(--py)) rotate(var(--pr))')), 'pose reprise dans ' + k);
  }
  assert.ok(/\.sp-dog \.m-tail\s*\{[^}]*animation:\s*c-wag\b/.test(z), 'queue du chien au repos');
  assert.ok(/\.sp-dog\.walk \.m-tail\s*\{[^}]*animation:\s*step\b/.test(z), 'au trot : keyframes « step » (vitesse réglée par tables.js)');
  assert.ok(z.includes('.sp-dog[data-expr="happy"] .c-tongue') && z.includes('.sp-dog.eat[data-expr] .c-tongue'), 'langue : contente oui, en mangeant non');
  assert.ok(/\.sp-dog \.c-ear-l\s*\{[^}]*transform-origin/.test(z), 'oreilles tombantes : pivot à la racine');
  /* pas de pose rotate / translate sur la tête, le torse ou la queue (Chrome ne les dessine pas sous une animation) */
  for (const [, sel, body] of z.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/\.(c-head|m-body|m-tail)\b/.test(sel) && !/%/.test(sel)) assert.ok(!/(^|;|\s)(rotate|translate)\s*:/.test(body), sel.trim());
  }
});

test('ours debout (v2.5.1) : une jambe et un bras par groupe, bras proche devant le torse, poses de mount.css', () => {
  for (const stage of [1, 2, 3]) for (const mood of ['', ...MOODS]) {
    const svg = mountSVG('bear', ['selle', 'foulard', 'ailes'], 120, mood, { stage });
    const legsB = svg.slice(svg.indexOf('class="m-legB"'), svg.indexOf('class="m-legF"'));
    assert.equal((legsB.match(/class="c-leg[ "]/g) || []).length, 2, 'm-legB : jambe + bras');
    assert.ok(legsB.includes('c-leg c-arm c-arm-f'), 'bras du fond dans m-legB');
    const iBody = svg.indexOf('class="m-body"'), iF = svg.indexOf('class="m-legF"'), iHead = svg.indexOf('class="c-head"');
    assert.ok(iBody < iF && iF < iHead, 'jambe et bras proches dessinés après le torse (devant la selle, le foulard), avant la tête');
    const legsF = svg.slice(iF, iHead);
    assert.equal((legsF.match(/class="c-leg[ "]/g) || []).length, 2, 'm-legF : jambe + bras');
    assert.match(legsF, /class="c-leg c-arm c-arm-n" style="transform-origin:[\d.]+% [\d.]+%"/, 'bras proche : pivot à l’épaule');
    assert.ok(svg.includes('acc-selle') && svg.includes('acc-foulard') && svg.includes('acc-ailes'));
  }
  /* la tête domine (ourson en peluche) et il tient debout : pieds sur le sol, tête au-dessus du corps */
  const a = mountAnchors('bear');
  assert.ok(a.top[1] < 16 && a.mouth[1] < 40 && a.chest[1] > 44, JSON.stringify(a));
  const css = readFileSync(new URL('../css/ui/mount.css', import.meta.url), 'utf8');
  const z = css.slice(css.indexOf('v2.5 — TERRE'), css.indexOf('fin TERRE'));
  for (const sel of ['.sp-bear.walk .c-all', '.sp-bear.walk .c-arm', '.sp-bear.joy .c-arm-n', '.sp-bear.eat .c-arm-n', '.sp-bear.sleep .c-arm-n', '.sp-bear .c-arm'])
    assert.ok(z.includes(sel), 'mount.css : ' + sel);
  assert.ok(/\.sp-bear\.walk \.c-all\s*\{[^}]*animation:\s*step\b/.test(z), 'dandinement : keyframes « step » (vitesse réglée par tables.js)');
  for (const k of ['c-bear-eat-n', 'c-bear-eat-f']) {
    const m = new RegExp('@keyframes ' + k + '\\s*\\{([^]*?)\\n\\}').exec(z);
    assert.ok(m && (m[1].match(/transform:[^;}]*/g) || []).every(f => f.includes('translate(var(--px), var(--py)) rotate(var(--pr))')), k);
  }
});
