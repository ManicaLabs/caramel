/* Cohérence entre modules (écrits par des équipes différentes). */
import { test, assert } from './_t.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { LEGACY_TARGETS } from '../js/core/migrate.js';
import { STORIES } from '../js/content/stories/index.js';
import { GAMES, AXIS_GAME } from '../js/games/index.js';
import { hasGenerator, loadGenerator } from '../js/content/index.js';
import { AXES, CLASS_AXES, CLASSES } from '../js/core/axes.js';
import { makeRng } from '../js/core/rng.js';

test('cibles v11 de la migration = cibles des 27 histoires v11', () => {
  const ids = Object.keys(LEGACY_TARGETS);
  assert.equal(ids.length, 27);
  for (const id of ids) {
    const s = STORIES.find(x => x.id === id);
    assert.ok(s, 'histoire absente : ' + id);
    assert.equal(s.target, LEGACY_TARGETS[id], id);
  }
});
test('chaque jeu : générateur, module, CSS et identifiant cohérents', async () => {
  for (const g of GAMES) {
    assert.ok(hasGenerator(g.primary), 'générateur manquant : ' + g.primary);
    const gen = await loadGenerator(g.primary);
    assert.equal(gen.axis, g.primary);
    assert.equal(typeof gen.gen, 'function');
    const it = gen.gen(3, makeRng(1), {});
    assert.ok(it && it.axis === g.primary && it.key, g.id);
    const src = readFileSync('js/games/' + g.id + '.js', 'utf8');
    assert.match(src, new RegExp("id:\\s*'" + g.id + "'"), 'id du module ' + g.id);
    const css = /css:\s*'([^']+)'/.exec(src);
    assert.ok(css && existsSync(css[1]), 'CSS du jeu ' + g.id);
  }
  for (const [ax, id] of Object.entries(AXIS_GAME)) assert.ok(AXES[ax] && GAMES.some(g => g.id === id), ax);
});
test('axes par classe : tous connus, et chaque axe entraîné figure sur un radar', () => {
  for (const c of CLASSES) for (const s of ['fr', 'ma']) for (const ax of CLASS_AXES[c][s]) assert.ok(AXES[ax], ax);
  for (const g of GAMES) for (const c of CLASSES.slice(g.minGrade)) {
    const all = [...CLASS_AXES[c].fr, ...CLASS_AXES[c].ma];
    assert.ok(all.includes(g.primary), g.primary + ' absent du radar ' + c);
  }
});
test('écrans routés : tous les fichiers existent', () => {
  const main = readFileSync('js/main.js', 'utf8');
  for (const m of main.matchAll(/import\('\.\/(ui\/[a-z-]+\.js)'\)/g)) assert.ok(existsSync('js/' + m[1]), m[1]);
});
