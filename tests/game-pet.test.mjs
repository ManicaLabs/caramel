/* Compagnon dans les jeux (v2.1) : ctx.pet / ctx.petSVG / ctx.petAnchors (js/ui/game-ctx.js) dessinent le compagnon
   du profil avec son espèce, ses accessoires portés ET son stade (comme l'accueil) ; aucun jeu n'appelle mountSVG en
   direct ; la clôture vise la bouche par les ancres ; une seule ombre, toujours au sol (pommes, accueil d'un nouvel
   enfant ; sauts des tables, de la course et de la clôture, petits bonds de la marche de la balade et temps fort du
   chef d'orchestre joués sur le corps du rig ; carotte tenue qui suit la bouche) ; portraits ronds sans pose couchée ;
   poney d'un nouvel enfant au stade d'un compagnon neuf. */
import { test, assert, memoryStorage } from './_t.mjs';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import { defaultProfile } from '../js/core/profiles.js';
import { buildCtx } from '../js/ui/game-ctx.js';
import { mountAnchors } from '../js/ui/mount-svg.js';
import { STAGE_MINUTES } from '../js/ui/companion-life.js';
import { GAMES } from '../js/games/index.js';

const D = '2026-10-02';
const read = f => readFileSync(f, 'utf8');
/* profil actif fictif (Léa) et ctx d'une manche factice (le compagnon ne dépend pas de la manche) */
function setup(type, worn, minutes) {
  store.init(memoryStorage(), D);
  const p = defaultProfile({ id: 'p1', name: 'Léa', g: 'f', classe: 'CE2', today: D });
  p.companion.type = type;
  if (!p.companion.owned.includes(type)) p.companion.owned.push(type);
  p.companion.equip.owned = worn.slice();
  p.companion.equip.worn = worn.slice();
  p.companion.minutes = minutes;
  store.addProfile(p);
  const manche = { state: { index: 0, reports: 0, apples: 0 }, count: 3, hintsLeft: 2, axis: 'ma.faits', rng: null,
    nextItem: () => null, report: () => ({}), finish: () => ({}), abort: () => ({}), useHint: () => true };
  return buildCtx({ game: { id: 'essai' }, makeManche: () => manche, mode: 'libre' });
}

test('ctx.pet : espèce, accessoires portés, stade selon companion.minutes (seuils de companion-life.js)', () => {
  const cases = [[0, 1], [STAGE_MINUTES[1] - 1, 1], [STAGE_MINUTES[1], 2], [STAGE_MINUTES[2] - 1, 2], [STAGE_MINUTES[2], 3], [1000, 3]];
  for (const [min, stage] of cases) {
    const ctx = setup('dragon', ['lunettes', 'noeud'], min);
    const pet = ctx.pet;
    assert.equal(pet.type, 'dragon');
    assert.deepEqual(pet.worn, ['lunettes', 'noeud']);
    assert.equal(pet.stage, stage, min + ' min → stade ' + stage);
  }
  const unknown = setup('licorne-volante', [], 0).pet;
  assert.equal(unknown.type, 'pony', 'espèce inconnue → poney');
});

test('ctx.petSVG : accessoires et stade du profil, options de mountSVG transmises', () => {
  const ctx = setup('capy', ['echarpe', 'chapeau'], 400);
  const s = ctx.petSVG(80, 'walk');
  assert.match(s, /^<svg class="m-root c-rig sp-capy walk"/);
  assert.match(s, /data-stage="3"/);
  assert.match(s, /acc-echarpe/);
  assert.match(s, /acc-chapeau/);
  assert.match(s, /width="80" height="67"/);
  const p = ctx.petSVG(50, '', { view: 'portrait', expr: 'happy' });
  assert.match(p, /data-view="portrait"/);
  assert.match(p, /data-expr="happy"/);
  assert.match(p, /width="50" height="50"/);
  assert.match(ctx.petSVG(60, '', { phase: 2.6 }), /--c-ph:-2\.6s/);
  assert.match(ctx.petSVG(60, '', { stage: 1 }), /data-stage="1"/, 'stade forçable');
  /* sans ombre au sol : le groupe .c-shadow reste, vide */
  assert.match(ctx.petSVG(60, '', { shadow: false }), /<g class="c-shadow"><\/g>/);
  assert.doesNotMatch(ctx.petSVG(60, ''), /<g class="c-shadow"><\/g>/);
});

test('ctx.petAnchors : ancres au stade du profil (la bouche visée par la clôture)', () => {
  for (const [min, stage] of [[0, 1], [90, 2], [320, 3]]) {
    const ctx = setup('horse', [], min);
    assert.deepEqual(ctx.petAnchors().mouth, mountAnchors('horse', { stage }).mouth, 'stade ' + stage);
  }
});

test('les six jeux dessinent le compagnon par ctx.petSVG, jamais par mountSVG en direct', () => {
  for (const g of GAMES) {
    const src = read('js/games/' + g.id + '.js');
    assert.ok(!/\bmountSVG\s*\(/.test(src), g.id + ' appelle mountSVG');
    assert.ok(/ctx\.petSVG\(/.test(src), g.id + ' : ctx.petSVG');
  }
});

test('clôture : carotte tenue et atterrissage visent la bouche (ancres), des deux côtés', () => {
  const src = read('js/games/cloture.js');
  assert.ok(/ctx\.petAnchors\(\)/.test(src), 'ancres du compagnon');
  assert.ok(!/lay\.S \* 0\.84 \* 0\.3|0\.42 \* S/.test(src), 'plus de position fixe de la bouche');
  assert.ok(/function mountXY\(p, dir = facing\)/.test(src), 'place sur la lisse selon le sens du regard');
});

test('une seule ombre au sol : pommes, accueil d’un nouvel enfant, balade et concours n’ajoutent plus la leur', () => {
  assert.ok(!/pm-shadow/.test(read('js/games/pommes.js') + read('css/games/pommes.css')), 'pommes : pm-shadow');
  assert.ok(!/ob-shadow/.test(read('js/ui/onboarding.js') + read('css/ui/onboarding.css')), 'onboarding : ob-shadow');
  assert.ok(!/bl-buddy-pic svg \{[^}]*drop-shadow/.test(read('css/ui/balade.css')), 'balade : filtre d’ombre');
  assert.ok(!/fm-walker svg \{[^}]*drop-shadow/.test(read('css/ui/famille.css')), 'concours : filtre d’ombre');
  /* orchestre : les règles des musiciens ne touchent plus les groupes homonymes du rig */
  const orc = read('css/games/orchestre.css');
  for (const c of ['c-shadow', 'c-eye', 'c-nose']) assert.ok(!new RegExp('\\.orc-scene \\.' + c + '\\b').test(orc), 'orchestre.css : .' + c + ' non préfixé');
});

test('mouvement réduit dès l’écran d’attente : cache « caramel-motion » lu par index.html, écrit par main.js', () => {
  const html = read('index.html');
  const css = html.indexOf('href="css/base.css"');
  const at = html.indexOf("localStorage.getItem('caramel-motion')");
  assert.ok(at > 0 && at < css, 'lu dans le script de tête');
  assert.ok(/html\.motion-soft \.boot-horse \{ animation: none; \}/.test(html), 'petit cheval immobile');
  assert.ok(/setItem\('caramel-motion', mode\)/.test(read('js/main.js')), 'écrit par main.js');
  const cc = read('css/ui/companion.css');
  assert.ok(/html\.motion-soft \.cc \.cc-gfill, html\.motion-soft \.cc \.cc-grow-fill \{ transition: none; \}/.test(cc), 'jauges');
});

test('sauts : le CORPS du rig saute (.c-all, composition add), l’ombre et la vague du dauphin restent au sol', () => {
  /* tables : saut et trébuchement sur .c-all, plus sur le conteneur .tb-hero */
  const tb = read('js/games/tables.js');
  assert.ok(/querySelector\('\.c-all'\)/.test(tb), 'tables : corps du rig');
  assert.ok(!/animate\(hero,/.test(tb), 'tables : le conteneur (ombre comprise) ne saute plus');
  assert.ok((tb.match(/composite: 'add'/g) || []).length >= 2, 'tables : saut et trébuchement s’ajoutent au galop');
  /* course : bonds v11 sur .c-all (course.js), plus aucune animation du conteneur .cr-pony */
  const crJs = read('js/games/course.js'), crCss = read('css/games/course.css');
  assert.ok(/PONY_FX/.test(crJs) && /querySelector\('\.c-all'\)/.test(crJs), 'course : corps du rig');
  assert.ok(!/\.cr-pony\.(hop|hop-big|stumble)[^{]*\{[^}]*animation/.test(crCss), 'course : le conteneur ne bondit plus');
  assert.ok(!/@keyframes cr-(hop|hopbig|stumble)\b/.test(crCss), 'course : keyframes du conteneur retirées');
  /* clôture : le conteneur suit la droite du sol, l'arc est joué par le corps (et la carotte tenue) */
  const cl = read('js/games/cloture.js');
  assert.ok(/function arcLift\(/.test(cl) && /querySelector\('\.c-all'\)/.test(cl), 'clôture : arc sur le corps');
  assert.ok(!/pts\.map\(q => \(\{ transform: tf\(q\) \}\)\)/.test(cl), 'clôture : le conteneur ne fait plus l’arc');
  /* clôture : la carotte tenue suit le bond de joie du corps (images clés de l'animation CSS rejouées sur la carotte) */
  assert.ok(/function carrotWithBody\(/.test(cl) && /carrotWithBody\(\);/.test(cl), 'clôture : carotte tenue pendant la joie');
  /* changement de classe d'humeur pendant un saut « add » : style recalculé aussitôt (sinon Chrome perd une image) */
  assert.ok(/svgRoot\.classList\.remove\(cls\); void svgRoot\.getBoundingClientRect\(\);/.test(cl), 'clôture : recalcul à la fin de l’humeur');
  assert.ok(/svgRoot\.classList\.add\(cls\);\s*void svgRoot\.getBoundingClientRect\(\);/.test(cl), 'clôture : recalcul au début de l’humeur');
  assert.ok(/heroSvg\.classList\.toggle\('walk', running\); void heroSvg\.getBoundingClientRect\(\);/.test(tb), 'tables : recalcul à la bascule du galop');
});

test('balade et orchestre : les bonds de la marche et le temps fort du chef sont joués par le corps, jamais par un conteneur', () => {
  /* balade : plus de conteneur qui sautille (il emportait l'ombre au sol et la vague du dauphin) ; bonds sur .c-all */
  const bl = read('js/ui/balade.js');
  assert.ok(!/bl-buddy-hop/.test(bl + read('css/ui/balade.css')), 'balade : conteneur .bl-buddy-hop');
  assert.ok(!/buddy\.firstChild\.animate|(buddy|buddyPic)\.animate\(\[[^\]]*translateY/.test(bl), 'balade : translateY sur le compagnon entier');
  assert.ok(/function walkHops\(rig, dur\)/.test(bl) && /rig && rig\.querySelector\('\.c-all'\)/.test(bl), 'balade : bonds sur le corps du rig');
  assert.ok(/\{ \.\.\.timing, composite: 'add' \}/.test(bl), 'balade : les bonds s’ajoutent au pas de la marche');
  assert.ok(/const rig = drawBuddy\('walk'\);/.test(bl) && /walkHops\(rig, dur\)/.test(bl), 'balade : bonds sur le SVG de la marche');
  /* orchestre : le temps fort ne déplace plus tout le SVG du chef (.st-cond-svg), seulement son corps */
  const orc = read('js/games/orchestre.js');
  assert.ok(!/stage\.cond\b/.test(orc), 'orchestre : SVG entier du chef animé');
  assert.ok(/body = m\.querySelector\('\.c-all'\)/.test(orc), 'orchestre : corps du rig');
  assert.ok(/anim\(stage\.body, 'bob', [^;]*composite: 'add' \}\)/.test(orc), 'orchestre : temps fort sur le corps, en composition add');
  assert.ok(!/st-cond-svg \{[^}]*transform/.test(read('css/games/orchestre.css')), 'orchestre : pivot du SVG entier inutile');
});

test('portraits ronds (view: portrait) : jamais avec la pose couchée (humeur sleep), qui sortirait la tête du rond', () => {
  for (const f of ['js/ui/battle.js', 'js/ui/famille.js', 'js/ui/home.js', 'js/ui/progres.js', 'js/ui/parents.js']) {
    const lines = read(f).split('\n').filter(l => /view: 'portrait'/.test(l));
    for (const l of lines) assert.ok(!/'sleep'/.test(l), f + ' : ' + l.trim());
  }
  assert.ok(/expr: pl\.abandoned \? 'sleepy'/.test(read('js/ui/battle.js')), 'défi : yeux fermés pour qui s’est reposé');
});

test('clôture : demi-tour sans transition en mouvement réduit et en « animations douces »', () => {
  const css = read('css/games/cloture.css');
  assert.ok(/html\.motion-soft \.cl-mount-flip \{ transition: none; \}/.test(css), 'animations douces');
  assert.ok(/@media \(prefers-reduced-motion: reduce\) \{[^@]*\.cl-mount-flip \{ transition: none !important; \}/.test(css), 'préférence système');
  assert.ok(/function fadeMove\(to, turn\)/.test(read('js/games/cloture.js')), 'demi-tour pendant le fondu');
});

test('accueil d’un nouvel enfant : le poney montré est au stade d’un compagnon neuf (petit), comme à l’accueil', () => {
  const src = read('js/ui/onboarding.js');
  assert.ok(!/avatarSVG\('pony', \[\], \d+, 'joy'\)/.test(src), 'plus de poney sans stade (junior par défaut)');
  assert.ok(/stage: stageOf\(\{ companion: \{ minutes: 0 \} \}\)/.test(src), 'stade d’un compagnon neuf');
  assert.equal(defaultProfile({ id: 'p9', name: 'Zoé', g: 'f', classe: 'CP', today: D }).companion.minutes, 0, 'profil neuf : 0 min');
});
