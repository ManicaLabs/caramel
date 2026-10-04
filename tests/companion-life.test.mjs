/* Moteur de vie du compagnon (js/ui/companion-life.js) — parties pures : stades, heure locale, saisons, soleil, ciel
   du diorama, hasard reproductible, planificateur des comportements d'attente (intervalles, variété, humeur, nuit,
   espèces) ; et garde-fous : module importable sans DOM, chaque action planifiée existe dans le moteur. */
import { test, assert } from './_t.mjs';
import { readFileSync } from 'node:fs';
import {
  STAGE_MINUTES, stageFor, stageProgress, isNight, seasonOf, sunTimes, skyAt, mixHex, makeRng, createPlanner,
  SPECIES_ACTS, GENERIC_ACTS, SLEEP_ACTS, SKY_COLORS, LAND_COLORS, bringToLife, liven, lifeOf, lifeStats
} from '../js/ui/companion-life.js';
import { MOUNTS } from '../js/content/companion-data.js';

const SRC = readFileSync(new URL('../js/ui/companion-life.js', import.meta.url), 'utf8');
const HEX = /^#[0-9a-f]{6}$/;
const at = (s) => new Date(s);

test('stades : seuils 60 et 300 minutes d’apprentissage', () => {
  assert.deepEqual([...STAGE_MINUTES], [0, 60, 300]);
  const cases = [[0, 1], [12.5, 1], [59.99, 1], [60, 2], [61, 2], [299.9, 2], [300, 3], [5000, 3], [-4, 1], [NaN, 1], [undefined, 1], ['75', 2]];
  for (const [m, s] of cases) assert.equal(stageFor(m), s, 'stageFor(' + m + ')');
});

test('stades : progression vers le stade suivant (fraction, minutes restantes)', () => {
  assert.deepEqual(stageProgress(0), { stage: 1, next: 2, frac: 0, left: 60 });
  assert.deepEqual(stageProgress(30), { stage: 1, next: 2, frac: 0.5, left: 30 });
  const p = stageProgress(59.4);
  assert.equal(p.stage, 1); assert.equal(p.left, 1); assert.ok(p.frac > 0.98 && p.frac < 1);
  assert.deepEqual(stageProgress(60), { stage: 2, next: 3, frac: 0, left: 240 });
  assert.deepEqual(stageProgress(180), { stage: 2, next: 3, frac: 0.5, left: 120 });
  assert.deepEqual(stageProgress(300), { stage: 3, next: null, frac: 1, left: 0 });
  assert.deepEqual(stageProgress(-10), { stage: 1, next: 2, frac: 0, left: 60 });
  /* monotone : on ne recule jamais en jouant */
  let prev = -1;
  for (let m = 0; m <= 320; m += 0.5) {
    const q = stageProgress(m), v = q.stage + q.frac * 0.999;
    assert.ok(v >= prev - 1e-9, 'progression monotone à ' + m);
    prev = v;
    assert.ok(q.left >= 0 && Number.isInteger(q.left));
  }
});

test('nuit du compagnon : 22 h → 7 h, heure locale', () => {
  assert.equal(isNight(at('2026-10-03T21:59:59')), false);
  assert.equal(isNight(at('2026-10-03T22:00:00')), true);
  assert.equal(isNight(at('2026-10-04T00:30:00')), true);
  assert.equal(isNight(at('2026-10-04T06:59:00')), true);
  assert.equal(isNight(at('2026-10-04T07:00:00')), false);
  assert.equal(isNight(at('2026-10-04T13:00:00')), false);
});

test('saisons (hémisphère nord)', () => {
  const cases = [['2026-01-10', 'winter'], ['2026-03-19', 'winter'], ['2026-03-20', 'spring'], ['2026-06-20', 'spring'],
    ['2026-06-21', 'summer'], ['2026-09-22', 'summer'], ['2026-09-23', 'autumn'], ['2026-10-03', 'autumn'],
    ['2026-12-20', 'autumn'], ['2026-12-21', 'winter'], ['2026-12-31', 'winter']];
  for (const [d, s] of cases) assert.equal(seasonOf(at(d + 'T12:00:00')), s, d);
});

test('soleil en France : lever avant coucher, journées longues l’été, courtes l’hiver, continuité', () => {
  let prev = null;
  for (let day = 0; day < 366; day++) {
    const d = new Date(2026, 0, 1 + day, 12);
    const { rise, set } = sunTimes(d);
    assert.ok(rise > 5.4 && rise < 9, 'lever plausible ' + d.toDateString() + ' : ' + rise);
    assert.ok(set > 16.5 && set < 22.3, 'coucher plausible ' + d.toDateString() + ' : ' + set);
    assert.ok(set - rise > 7.5, 'jour assez long');
    if (prev) {
      assert.ok(Math.abs(rise - prev.rise) < 0.12 && Math.abs(set - prev.set) < 0.12, 'pas de saut d’un jour à l’autre : ' + d.toDateString());
    }
    prev = { rise, set };
  }
  const june = sunTimes(at('2026-06-21T12:00:00')), dec = sunTimes(at('2026-12-21T12:00:00'));
  assert.ok(june.set - june.rise > 15.5, 'solstice d’été ≈ 16 h de jour');
  assert.ok(dec.set - dec.rise < 9, 'solstice d’hiver ≈ 8 h 20 de jour');
});

test('mixHex : mélange de couleurs', () => {
  assert.equal(mixHex('#000000', '#ffffff', 0), '#000000');
  assert.equal(mixHex('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(mixHex('#ff0000', '#0000ff', 2), '#0000ff');      /* borné */
  assert.equal(mixHex('oops', '#ffffff', 0.5), 'oops');          /* entrée invalide : inchangée */
});

test('ciel du diorama : jour, nuit, aube, crépuscule, astres, couleurs valides et sans à-coups', () => {
  const noon = skyAt(at('2026-10-03T13:30:00'));
  assert.equal(noon.phase, 'day'); assert.equal(noon.night, 0);
  assert.ok(noon.sun.on && noon.sun.y < 50, 'soleil haut à midi');
  assert.equal(noon.moon.on, false);
  const mid = skyAt(at('2026-10-03T23:30:00'));
  assert.equal(mid.phase, 'night'); assert.equal(mid.night, 1);
  assert.ok(mid.moon.on, 'lune la nuit');
  assert.ok(!mid.sun.on || mid.night > 0.92, 'pas de soleil la nuit');
  const { rise, set } = sunTimes(at('2026-10-03T12:00:00'));
  const hm = h => { const H = Math.floor(h), M = Math.floor((h - H) * 60); return '2026-10-03T' + String(H).padStart(2, '0') + ':' + String(M).padStart(2, '0') + ':00'; };
  assert.equal(skyAt(at(hm(rise))).phase, 'dawn', 'aube au lever du soleil');
  assert.equal(skyAt(at(hm(set))).phase, 'dusk', 'crépuscule au coucher du soleil');
  /* une journée entière minute par minute : couleurs valides, astres dans le cadre, aucune transition brutale */
  let prev = null;
  for (let m = 0; m < 24 * 60; m++) {
    const d = new Date(2026, 9, 3, 0, m);
    const k = skyAt(d);
    assert.ok(HEX.test(k.sky.top) && HEX.test(k.sky.bot), 'couleurs du ciel');
    for (const v of Object.values(k.land)) assert.ok(HEX.test(v), 'couleur du décor ' + v);
    assert.deepEqual(Object.keys(k.land).sort(), Object.keys(LAND_COLORS).sort());
    assert.ok(k.night >= 0 && k.night <= 1 && k.warm >= 0 && k.warm <= 1);
    for (const a of [k.sun, k.moon]) assert.ok(a.x >= 0 && a.x <= 400 && a.y >= 0 && a.y <= 200, 'astre dans le cadre');
    assert.ok(['night', 'dawn', 'day', 'dusk'].includes(k.phase));
    if (prev) assert.ok(Math.abs(k.night - prev.night) < 0.05, 'nuit progressive à ' + d.toTimeString().slice(0, 5));
    prev = k;
  }
  assert.ok(HEX.test(SKY_COLORS.warmTop) && HEX.test(SKY_COLORS.warmBot));
});

test('hasard reproductible : même graine, même suite, valeurs dans [0, 1[', () => {
  const a = makeRng(42), b = makeRng(42), c = makeRng(43);
  const sa = Array.from({ length: 50 }, a), sb = Array.from({ length: 50 }, b), sc = Array.from({ length: 50 }, c);
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  for (const v of sa) assert.ok(v >= 0 && v < 1);
});

test('planificateur : clignements irréguliers (2,5-6 s, parfois doubles) et regards variés', () => {
  const p = createPlanner({ species: 'pony', rng: makeRng(7) });
  let doubles = 0;
  const waits = new Set();
  for (let i = 0; i < 2000; i++) {
    const b = p.blink();
    assert.ok(b.wait >= 2500 && b.wait <= 6000, 'intervalle de clignement ' + b.wait);
    if (b.double) doubles++;
    waits.add(Math.round(b.wait / 100));
  }
  assert.ok(doubles > 2000 * 0.1 && doubles < 2000 * 0.28, 'doubles clignements ≈ 18 % : ' + doubles);
  assert.ok(waits.size > 25, 'intervalles variés (jamais mécaniques)');
  let run = 1, last = '';
  for (let i = 0; i < 2000; i++) {
    const g = p.glance();
    assert.ok(g.wait >= 1300 && g.wait <= 4200);
    assert.ok(Math.abs(g.x) <= 1 && Math.abs(g.y) <= 1);
    assert.ok(['around', 'child', 'ahead', 'up'].includes(g.kind));
    run = g.kind === last ? run + 1 : 1; last = g.kind;
    assert.ok(run <= 2, 'jamais trois fois le même regard de suite');
  }
  for (let i = 0; i < 500; i++) {
    const m = p.micro();
    assert.ok(m.wait >= 3800 && m.wait <= 9500 && ['ear', 'tail', 'nod'].includes(m.kind) && ['l', 'r'].includes(m.side));
  }
});

test('planificateur : actions spontanées (8-20 s), propres à l’espèce, jamais l’une des deux dernières', () => {
  for (const species of Object.keys(MOUNTS)) {
    const acts = SPECIES_ACTS[species];
    assert.ok(Array.isArray(acts) && acts.length >= 2, 'actions pour ' + species);
    const p = createPlanner({ species, stage: 2, rng: makeRng(species.length * 31) });
    const first = p.action({ first: true });
    assert.ok(first.wait >= 3500 && first.wait <= 6000, 'première action plus tôt');
    const seen = new Set();
    const recent = [first.name];
    for (let i = 0; i < 400; i++) {
      const a = p.action({ mood: 'ok' });
      assert.ok(a.wait >= 8000 && a.wait <= 20000, 'intervalle ' + a.wait);
      assert.ok(acts.includes(a.name) || GENERIC_ACTS.includes(a.name), species + ' : action inconnue ' + a.name);
      assert.ok(!recent.slice(0, 2).includes(a.name), species + ' : répétition de ' + a.name);
      recent.unshift(a.name);
      seen.add(a.name);
    }
    for (const a of acts) assert.ok(seen.has(a), species + ' : « ' + a + ' » jamais tirée');
    const own = [...seen].filter(a => acts.includes(a)).length;
    assert.equal(own, new Set(acts).size, 'l’espèce s’exprime');
  }
});

test('planificateur : humeur basse → soupirs, petit creux, bâillements ; nuit → mouvements de sommeil', () => {
  const p = createPlanner({ species: 'cat', stage: 2, rng: makeRng(5) });
  const low = new Map();
  for (let i = 0; i < 600; i++) {
    const a = p.action({ mood: 'low', hungry: true, tired: true });
    low.set(a.name, (low.get(a.name) || 0) + 1);
    assert.ok(!['hop', 'wiggle', 'proudPose'].includes(a.name), 'pas de bond quand ça ne va pas : ' + a.name);
  }
  assert.ok(low.get('sigh') > 60 && low.get('hungry') > 60 && low.get('yawn') > 30, JSON.stringify([...low]));
  for (let i = 0; i < 200; i++) {
    const a = p.action({ night: true });
    assert.ok(SLEEP_ACTS.includes(a.name), 'la nuit : ' + a.name);
    assert.ok(a.wait >= 6000 && a.wait <= 14000);
  }
  /* stades : le petit sautille plus, le champion prend la pose */
  const count = (stage, name) => { const q = createPlanner({ species: 'pony', stage, rng: makeRng(9) }); let n = 0; for (let i = 0; i < 1500; i++) if (q.action({ mood: 'happy' }).name === name) n++; return n; };
  assert.equal(count(1, 'proudPose'), 0);
  assert.ok(count(3, 'proudPose') > 40);
  assert.ok(count(1, 'hop') > count(2, 'hop'), 'petit = plus joueur');
});

test('moteur : chaque action planifiable a sa chorégraphie', () => {
  const names = new Set([...Object.values(SPECIES_ACTS).flat(), ...GENERIC_ACTS, ...SLEEP_ACTS]);
  for (const n of names) {
    const m = '_act' + n.charAt(0).toUpperCase() + n.slice(1) + '(';
    assert.ok(SRC.includes('async ' + m), 'méthode ' + m + ' manquante');
  }
  for (const r of ['tap', 'hug', 'eat', 'brush', 'walk', 'celebrate', 'proud', 'surprise', 'yawn', 'appear']) {
    assert.ok(SRC.includes("case '" + r + "'"), 'réaction ' + r);
  }
});

test('module importable sans DOM : rien ne démarre, aucun minuteur', () => {
  assert.equal(bringToLife(null), null);
  assert.equal(bringToLife({}), null);
  assert.equal(liven(null), null);
  assert.equal(lifeOf(null), null);
  assert.deepEqual(lifeStats(), { lives: 0, tasks: 0, timer: false, bound: false });
  /* aucun caractère invisible littéral dans le source (séquences \u… exigées) */
  assert.ok(!/[\u00a0\u202f\u200b]/.test(SRC), 'caractère invisible littéral');
});
