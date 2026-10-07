/* v2.5 — compagnons « oiseaux » : chouette (owl), perroquet (parrot), pingouin (penguin), poussin (chick)
   (js/ui/mount-svg.js, zone OISEAUX ; aliments de js/content/companion-data.js ; actions et miettes de
   js/ui/companion-life.js ; animations de css/ui/mount.css, zone OISEAUX).
   Le contrat commun du rig est vérifié pour toutes les espèces par tests/companion-art.test.mjs ; ici : rendu de chaque
   oiseau × expressions × humeurs × stades × accessoires sans valeur invalide, squelette d'oiseau (deux pattes, ailes
   dans .c-wings remplacées par les ailes de fée, aile gauche retournée par un groupe miroir, bec par-dessus la bouche),
   ancrages dans le cadre, portrait, régimes, miettes, actions, animations. */
import { test, assert } from './_t.mjs';
import { readFileSync } from 'node:fs';
import { mountSVG, mountAnchors, EXPRESSIONS, MOODS } from '../js/ui/mount-svg.js';
import { MOUNTS, SHOP, FOODS, FOOD_BY_ID, DIET, foodsOf, foodLine } from '../js/content/companion-data.js';
import { CRUMBS, SPECIES_ACTS, createPlanner, makeRng } from '../js/ui/companion-life.js';

const BIRDS = ['owl', 'parrot', 'penguin', 'chick'];
const IDS = SHOP.map(s => s.id);
const COMBOS = [[], ...IDS.map(id => [id]), ['ailes', 'noeud', 'selle', 'echarpe', 'couronne', 'lunettes'],
  ['ailes', 'noeud', 'selle', 'foulard', 'chapeau', 'lunettes']];
const BAD = /NaN|undefined|null|Infinity|\[object/;
/* groupe ouvrant d'une classe → contenu jusqu'à sa fermeture */
function groupOf(svg, cls) {
  const i = svg.indexOf(`<g class="${cls}`);
  if (i < 0) return null;
  let depth = 0;
  const re = /<(\/?)g\b[^>]*>/g;
  re.lastIndex = i;
  let m;
  while ((m = re.exec(svg))) {
    depth += m[1] ? -1 : 1;
    if (!depth) return svg.slice(i, re.lastIndex);
  }
  return null;
}

test('oiseaux : les quatre espèces existent (MOUNTS, dessin propre, pas un repli sur le chat)', () => {
  for (const t of BIRDS) {
    assert.ok(MOUNTS[t], t + ' dans MOUNTS');
    assert.equal(MOUNTS[t].coat, 'plumes', t + ' : le brossage complimente les plumes');
    for (const k of ['beak', 'feet']) assert.match(MOUNTS[t].look[k], /^#[0-9a-f]{6}$/, t + ' : look.' + k);
    const svg = mountSVG(t, [], 100, '');
    assert.ok(svg.includes('sp-' + t) && svg.includes(`data-species="${t}"`), t + ' : pas de repli sur le poney');
  }
  const all = [...BIRDS, 'cat'].map(t => mountSVG(t, [], 100, '').replace(/sp-\w+|data-species="\w+"/g, ''));
  assert.equal(new Set(all).size, all.length, 'cinq dessins différents');
});

test('oiseaux : espèce × expression × humeur × stade × accessoires — SVG valide', () => {
  let n = 0;
  for (const t of BIRDS) for (const stage of [1, 2, 3]) {
    for (const expr of EXPRESSIONS) for (const mood of ['', ...MOODS]) {
      const svg = mountSVG(t, [], 120, mood, { expr, stage });
      assert.ok(!BAD.test(svg), `${t} ${expr} ${mood} stade ${stage} : valeur invalide`);
      assert.ok(svg.includes(`data-expr="${expr}"`) && svg.includes(`data-stage="${stage}"`));
      n++;
    }
    for (const worn of COMBOS) for (const view of [undefined, 'portrait']) {
      const svg = mountSVG(t, worn, 100, 'walk', { stage, view });
      assert.ok(!BAD.test(svg), `${t} ${worn} ${view || ''} : valeur invalide`);
      n++;
    }
  }
  assert.ok(n > 1000, n + ' rendus');
});

test('oiseaux : squelette — deux pattes, deux ailes (l\'aile gauche retournée), ailes de fée à leur place', () => {
  for (const t of BIRDS) for (const stage of [1, 2, 3]) {
    const svg = mountSVG(t, [], 100, '', { stage });
    /* une vraie patte par groupe (le second .c-leg est vide), toutes deux dessinées */
    for (const grp of ['m-legB', 'm-legF']) {
      const g = groupOf(svg, grp);
      assert.ok(g && (g.match(/class="c-leg"/g) || []).length === 2, `${t} : .${grp} a deux .c-leg`);
      assert.ok(/<path /.test(g), `${t} : .${grp} dessine une patte`);
    }
    /* ailes : la lointaine, puis la proche dans un groupe miroir sans classe (une rotation négative lève les deux) */
    const wings = groupOf(svg, 'c-wings');
    assert.equal((wings.match(/class="c-wing /g) || []).length, 2, t + ' : deux ailes');
    assert.ok(wings.indexOf('c-wing-far') < wings.indexOf('c-wing-near'), t + ' : aile lointaine d\'abord');
    assert.match(wings, /<g transform="matrix\(-1 0 0 1 [\d.]+ 0\)"><g class="c-wing c-wing-near"/, t + ' : aile gauche retournée');
    assert.ok(!/class="c-wing[^"]*"[^>]*transform=/.test(wings), t + ' : les ailes animées ne portent pas de transform');
    /* les ailes de fée remplacent les ailes de l'oiseau */
    const fairy = mountSVG(t, ['ailes'], 100, '', { stage });
    assert.ok(fairy.includes('acc-ailes'), t + ' : ailes de fée');
    assert.ok(!/class="c-wing /.test(groupOf(fairy, 'c-wings')), t + ' : plus d\'ailes d\'oiseau sous les ailes de fée');
  }
});

test('oiseaux : bec par-dessus la bouche, aigrettes et houppette, yeux de la chouette les plus grands', () => {
  for (const t of BIRDS) {
    const svg = mountSVG(t, [], 100, '');
    const iNose = svg.indexOf('class="c-nose"'), iLastX = svg.lastIndexOf('class="c-x ');
    assert.ok(iNose > iLastX, t + ' : la mandibule supérieure (.c-nose) est dessinée après les expressions');
    assert.ok(groupOf(svg, 'c-nose').includes(`fill="${MOUNTS[t].look.beak}"`), t + ' : bec de la couleur look.beak');
  }
  /* « oreilles » : aigrettes de la chouette, houppette du poussin (vides pour le perroquet et le pingouin) */
  for (const t of ['owl', 'chick']) for (const ear of ['c-ear-l', 'c-ear-r']) assert.ok(/<path /.test(groupOf(mountSVG(t, [], 100, ''), 'm-ear ' + ear)), t + ' : .' + ear + ' dessinée');
  assert.ok(/<path /.test(groupOf(mountSVG('chick', [], 100, ''), 'c-mane c-mane-b')), 'poussin : plume du milieu de la houppette');
  const eyeR = t => +/<ellipse cx="[\d.]+" cy="[\d.]+" rx="([\d.]+)" ry="[\d.]+" fill="#2b1810"/.exec(mountSVG(t, [], 100, ''))[1];
  for (const t of ['parrot', 'penguin', 'chick', 'cat']) assert.ok(eyeR('owl') > eyeR(t) * 1.3, 'chouette : très grands yeux (' + t + ')');
});

test('oiseaux : ancrages dans le cadre, pieds au sol, bouche devant les yeux, portrait carré sur le visage', () => {
  for (const t of BIRDS) for (const stage of [1, 2, 3]) {
    const a = mountAnchors(t, { stage });
    for (const p of [a.mouth, a.top, a.neck, a.back, a.chest, a.tail, ...a.eyes]) {
      assert.ok(p.every(Number.isFinite), `${t} : ${p}`);
      assert.ok(p[0] > 2 && p[0] < 98 && p[1] > 4 && p[1] < 74, `${t} stade ${stage} : point hors cadre ${p}`);
    }
    assert.ok(Math.abs(a.ground - 74) < 0.5);
    assert.ok(a.mouth[0] > a.eyes[0][0], t + ' : bec à droite de l\'œil proche');
    assert.ok(a.top[1] < Math.min(...a.eyes.map(e => e[1])) - 6, t + ' : sommet de tête au-dessus des yeux');
    assert.ok(a.tail[0] < a.chest[0] && a.back[0] < a.chest[0], t + ' : queue et dos à gauche, poitrail à droite');
    for (const size of [48, 96]) {
      const svg = mountSVG(t, ['chapeau'], size, '', { view: 'portrait', stage });
      assert.ok(svg.includes(`width="${size}" height="${size}"`), t + ' : portrait carré ' + size);
      const [x, y, w, h] = /viewBox="([^"]+)"/.exec(svg)[1].split(' ').map(Number);
      assert.ok(w === h && w > 25 && w < 60, `${t} : cadre ${w}`);
      for (const p of [a.mouth, ...a.eyes]) assert.ok(p[0] > x + 2 && p[0] < x + w - 2 && p[1] > y + 2 && p[1] < y + h - 2, t + ' : visage dans le portrait');
    }
  }
});

test('oiseaux : régimes (petit, moyen, régal), « Miam, … ! », un emoji par aliment, emoji d\'Emoji 12 au plus', () => {
  const TIERS = [[5, 15, 0], [10, 30, 5], [25, 70, 12]];
  /* emoji d'Emoji 13 et plus, absents des Android anciens (myrtille, ver de terre, scarabée, poivron, bubble tea…) */
  const NEW = new Set([0x1FAD0, 0x1FAD1, 0x1FAD2, 0x1FAD3, 0x1FAD4, 0x1FAD5, 0x1FAD6, 0x1FAB1, 0x1FAB2, 0x1FAB3, 0x1FAB4, 0x1F9CB, 0x1F9AB, 0x1F9AC, 0x1F9A3, 0x1F9A4, 0x1F9AD, 0x1FAB6]);
  for (const t of BIRDS) {
    const ids = DIET[t];
    assert.equal(ids.length, 3, t + ' : trois aliments');
    assert.equal(new Set(ids).size, 3, t + ' : trois aliments différents');
    foodsOf(t).forEach((f, i) => {
      assert.ok(f && FOOD_BY_ID[f.id] === f, t + ' : aliment connu ' + ids[i]);
      assert.deepEqual([f.price, f.faim, f.joie], TIERS[i], `${t} : ${f.id} au rang ${i + 1}`);
      assert.match(f.id, /^[a-z]+$/, 'id sans accent : ' + f.id);
      assert.match(foodLine(f), /^Miam, (un|une|des|du|de la|de l’) [^!]+ !$/, 'phrase : ' + foodLine(f));
      const cp = f.e.codePointAt(0);
      assert.ok(cp < 0x1FA96 && !NEW.has(cp), f.id + ' : emoji d\'Emoji 12 au plus');
      const crumbs = CRUMBS[f.e];
      assert.ok(Array.isArray(crumbs) && crumbs.length === 3 && crumbs.every(c => /^#[0-9a-f]{6}$/.test(c)), f.id + ' : trois couleurs de miettes');
    });
  }
  /* chaque oiseau a son menu à lui (seuls le poney et le cheval partagent le leur) */
  for (const t of BIRDS) for (const o of Object.keys(DIET)) if (o !== t) assert.notEqual(DIET[t].join(), DIET[o].join(), t + ' : même menu que ' + o);
  /* un emoji = un seul aliment, ids uniques (clips de voix) */
  assert.equal(new Set(FOODS.map(f => f.e)).size, FOODS.length, 'emoji uniques');
  assert.equal(new Set(FOODS.map(f => f.id)).size, FOODS.length, 'ids uniques');
  /* rien de mignon ni de souris au menu */
  for (const t of BIRDS) for (const f of foodsOf(t)) assert.ok(!/souris|lapin|oiseau|poussin|grenouille/i.test(f.name + f.say), 'menu : ' + f.say);
});

test('oiseaux : actions spontanées (méthodes existantes ; le pingouin ne s\'envole pas)', () => {
  const SRC = readFileSync(new URL('../js/ui/companion-life.js', import.meta.url), 'utf8');
  for (const t of BIRDS) {
    const acts = SPECIES_ACTS[t];
    assert.ok(Array.isArray(acts) && new Set(acts).size >= 3, t + ' : au moins trois actions différentes');
    for (const a of acts) assert.ok(SRC.includes('async _act' + a.charAt(0).toUpperCase() + a.slice(1) + '('), t + ' : action ' + a);
    const p = createPlanner({ species: t, stage: 2, rng: makeRng(t.length * 17) });
    const seen = new Set();
    for (let i = 0; i < 300; i++) seen.add(p.action({ mood: 'ok' }).name);
    for (const a of acts) assert.ok(seen.has(a), t + ' : ' + a + ' tirée');
  }
  assert.ok(!SPECIES_ACTS.penguin.includes('flap'), 'pingouin : pas de vol');
  for (const t of ['owl', 'parrot', 'chick']) assert.ok(SPECIES_ACTS[t].includes('flap'), t + ' : bat des ailes');
  assert.ok(SPECIES_ACTS.chick.includes('sniff'), 'poussin : il picore');
});

test('oiseaux : animations (mount.css) — sautillement et dandinement par les keyframes « step », sommeil assis', () => {
  const css = readFileSync(new URL('../css/ui/mount.css', import.meta.url), 'utf8');
  const zone = css.slice(css.indexOf('v2.5 — OISEAUX'), css.indexOf('fin OISEAUX'));
  assert.ok(zone.length > 500, 'zone OISEAUX remplie');
  for (const t of BIRDS) {
    assert.ok(new RegExp('\\.sp-' + t + '\\b[^{]*\\{[^}]*--c-sit:').test(zone), t + ' : --c-sit (pattes courtes)');
    assert.ok(new RegExp('\\.sp-' + t + '\\.walk \\.c-all[^{]*\\{[^}]*animation: step ').test(zone), t + ' : marche propre (keyframes « step »)');
    assert.ok(new RegExp('\\.sp-' + t + '\\.sleep\\s*\\{[^}]*--c-hr').test(zone), t + ' : tête rentrée pour dormir');
    assert.ok(new RegExp('\\.sp-' + t + ' \\.c-wing').test(zone), t + ' : ailes au repos');
  }
  assert.ok(/\.sp-penguin\.walk \.c-all \{ animation: step [^}]*--sa: -\d+deg; --sb: \d+deg/.test(zone), 'pingouin : roulis (dandinement)');
  assert.ok(/\.sp-chick\.walk \.c-all \{[^}]*--sy1: -[\d.]+px/.test(zone), 'poussin : il sautille');
  /* aucune pose rotate / translate sur la tête, le torse ou la queue (Chrome ne les dessine pas sous une animation) */
  for (const [, sel, body] of zone.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/\.(c-head|m-body|m-tail)\b/.test(sel)) assert.ok(!/(^|;|\s)(rotate|translate)\s*:/.test(body), 'pose interdite : ' + sel.trim());
  }
});
