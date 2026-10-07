/* Soins du compagnon (v2.4, retours du parent du 07/10/2026) : nourrir seulement s'il a faim, brossage et promenade
   (le premier du jour gratuit, puis en pommes), aliments propres à chaque espèce (js/core/care.js,
   js/content/companion-data.js) ; miettes des aliments (js/ui/companion-life.js) ; jauges partagées avec le concours
   « En famille » ; sieste quand le temps de jeu du jour est fini (js/ui/companion.js). Prénoms fictifs uniquement. */
import { test, assert } from './_t.mjs';
import { readFileSync } from 'node:fs';
import * as C from '../js/core/care.js';
import { PET, FOODS, FOOD_BY_ID, DIET, MOUNTS, foodsOf, foodLine } from '../js/content/companion-data.js';
import { CRUMBS } from '../js/ui/companion-life.js';
import { gaugesNow, companionScore } from '../js/core/family.js';
import { defaultProfile, normalizeProfile } from '../js/core/profiles.js';
import { addDays } from '../js/core/util.js';

const SRC = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const D = '2026-10-07';
const NOW = new Date(2026, 9, 7, 15, 0, 0).getTime();
/* pet.last = NOW : les jauges valent exactement ce qu'on pose */
function kid(pet = {}, apples = 100, type = 'pony') {
  const p = defaultProfile({ id: 'p1', name: 'Léa', g: 'f', classe: 'CE1', today: '2026-09-01' });
  p.companion.type = type;
  Object.assign(p.companion.pet, { faim: 50, forme: 50, joie: 50, last: NOW }, pet);
  p.wallet.apples = apples;
  return p;
}

/* ---------- aliments par espèce ---------- */
/* version Emoji de chaque aliment (les Android anciens n'ont rien après Emoji 12) */
const EMOJI_VERSION = { '🥕': 3, '🍐': 1, '🥧': 5, '🍓': 1, '🍰': 1, '🥣': 5, '🐟': 1, '🍣': 1, '🦐': 3, '🦑': 3,
  '🍊': 1, '🥬': 11, '🍉': 1, '🍗': 1, '🥩': 5, '🍔': 1, '🌶': 1, '🍿': 1, '🍕': 1 };

test('aliments : trois par espèce (petit 5 🍎 +15, moyen 10 🍎 +30 +5 joie, régal 25 🍎 +70 +12 joie)', () => {
  assert.deepEqual(Object.keys(DIET).sort(), Object.keys(MOUNTS).sort(), 'une liste par espèce');
  for (const type of Object.keys(MOUNTS)) {
    const fs = foodsOf(type);
    assert.equal(fs.length, 3, type);
    assert.deepEqual(fs.map(f => [f.price, f.faim, f.joie]), [[5, 15, 0], [10, 30, 5], [25, 70, 12]], type);
  }
  /* sauvegardes v11 : la famille du cheval garde carotte, pomme (la Poire) et tarte */
  for (const type of ['pony', 'horse']) assert.deepEqual(DIET[type], ['carotte', 'pomme', 'tarte']);
  assert.equal(FOOD_BY_ID.pomme.name, 'Poire');
  assert.equal(FOOD_BY_ID.pomme.e, '🍐');
  /* elles ne mangent pas toutes la même chose */
  const menus = new Set(Object.values(DIET).map(d => d.join(',')));
  assert.equal(menus.size, Object.keys(DIET).length - 1, 'seuls le poney et le cheval partagent leur menu');
  assert.deepEqual(foodsOf('licorne-volante'), foodsOf('pony'), 'espèce inconnue → poney');
});

test('aliments : ids et emoji uniques, tous servis, Emoji 12 au plus, article pour la voix, miettes', () => {
  assert.equal(new Set(FOODS.map(f => f.id)).size, FOODS.length);
  assert.equal(new Set(FOODS.map(f => f.e)).size, FOODS.length, 'un emoji = un aliment (miettes)');
  const served = new Set(Object.values(DIET).flat());
  for (const f of FOODS) {
    assert.ok(served.has(f.id), f.id + ' : mangé par au moins une espèce');
    const base = f.e.replace(/️/g, '');
    assert.ok(EMOJI_VERSION[base] !== undefined && EMOJI_VERSION[base] <= 12, f.id + ' : emoji d’Emoji 12 au plus');
    assert.match(f.say, /^(un|une|du|de la|des) \p{L}/u, f.id + ' : article');
    assert.equal(foodLine(f), 'Miam, ' + f.say + ' !');
    assert.ok(Array.isArray(CRUMBS[f.e]) && CRUMBS[f.e].length === 3, f.id + ' : miettes');
    for (const c of CRUMBS[f.e]) assert.match(c, /^#[0-9a-f]{6}$/);
  }
  assert.ok(!CRUMBS['🍎'], 'plus de miettes de pomme pour la poire');
  /* caractère invisible (sélecteur d'emoji) en séquence d'échappement dans la source */
  assert.ok(/'🌶\\uFE0F'/.test(readFileSync(new URL('../js/content/companion-data.js', import.meta.url), 'utf8')));
});

/* ---------- jauges ---------- */
test('jauges : une seule fonction pour la scène et le concours (gaugesAt = gaugesNow)', () => {
  const h = 3600e3;
  for (const pet of [{ faim: 80, forme: 80, joie: 80, last: NOW - 24 * h }, { faim: 30, forme: 99, joie: 15, last: NOW - 5 * h },
    { faim: 70, forme: 50, joie: 90, last: 0 }, null, { faim: '55', forme: 'x', joie: 120, last: NOW }]) {
    assert.deepEqual(C.gaugesAt(pet, NOW), gaugesNow(pet, NOW));
  }
  assert.deepEqual(C.gaugesAt({ faim: 80, forme: 80, joie: 80, last: NOW - 24 * h }, NOW), { faim: 30, forme: 80 - 100 / 3, joie: 55 });
  const pet = { faim: 80, forme: 80, joie: 80, last: NOW - 24 * h };
  C.settle(pet, NOW);
  assert.deepEqual(pet, { faim: 30, forme: 80 - 100 / 3, joie: 55, last: NOW });
  assert.ok(!/function gaugesNow[\s\S]{0,200}PET\.DECAY/.test(SRC('js/core/family.js')), 'plus de copie dans family.js');
  assert.ok(/gaugesAt/.test(SRC('js/ui/companion.js')) && !/PET\.DECAY/.test(SRC('js/ui/companion.js')), 'la scène aussi');
});

test('un soin sert : jauge sous 90 et au moins la moitié du gain utile', () => {
  assert.equal(PET.FULL, 90);
  assert.equal(C.fits(89.4, 15), true);
  assert.equal(C.fits(90, 15), false);
  assert.equal(C.fits(89.9999, 15), false, 'jauge arrondie comme l’enfant la voit (90 tout juste remonté)');
  assert.equal(C.fits(65, 70), true);
  assert.equal(C.fits(65.6, 70), false);
  assert.equal(C.fits(85, 30), true);
  assert.equal(C.fits(85.5, 30), false);
  assert.equal(C.fits(87.4, 25), true);
  assert.equal(C.fits(88, 25), false);
});

/* ---------- nourrir ---------- */
test('nourrir : seulement s’il a faim ; aliment trop gros refusé ; rien de dépensé quand c’est refusé', () => {
  const p = kid({ faim: 92 });
  for (const f of foodsOf('pony')) {
    const o = C.feed(p, f.id, NOW);
    assert.equal(o.ok, false); assert.equal(o.why, 'full', f.id);
  }
  assert.equal(p.wallet.apples, 100);
  assert.equal(p.companion.pet.faim, 92);
  /* faim 80 : la carotte et la poire, pas la tarte */
  const q = kid({ faim: 80 });
  assert.equal(C.foodOffer(q, 'tarte', NOW).why, 'big');
  assert.equal(C.foodOffer(q, 'pomme', NOW).ok, true);
  assert.equal(C.feed(q, 'tarte', NOW).ok, false);
  assert.equal(q.wallet.apples, 100);
  /* faim 60 : la tarte passe (40 points utiles sur 70), la jauge plafonne à 100 */
  const r = kid({ faim: 60, joie: 95 });
  const o = C.feed(r, 'tarte', NOW);
  assert.equal(o.ok, true);
  assert.equal(r.wallet.apples, 75);
  assert.equal(r.companion.pet.faim, 100);
  assert.equal(r.companion.pet.joie, 100);
  assert.equal(r.companion.pet.last, NOW);
  /* puis il n'a plus faim : on ne peut plus le nourrir à l'infini */
  assert.equal(C.feed(r, 'carotte', NOW).why, 'full');
  /* remonté à 90 tout juste : rassasié, même une milliseconde plus tard */
  const t = kid({ faim: 75 }, 100, 'cat');
  assert.equal(C.feed(t, 'croquettes', NOW).ok, true);
  assert.equal(C.foodOffer(t, 'croquettes', NOW + 1).why, 'full');
  assert.equal(r.wallet.apples, 75);
});

test('nourrir : pommes manquantes (rien de dépensé), aliment d’une autre espèce, aliment inconnu', () => {
  const p = kid({ faim: 20 }, 7, 'cat');
  const o = C.feed(p, 'poisson', NOW);
  assert.deepEqual([o.ok, o.why, o.missing], [false, 'short', 3]);
  assert.equal(p.wallet.apples, 7);
  assert.equal(C.feed(p, 'croquettes', NOW).ok, true);
  assert.equal(p.wallet.apples, 2);
  assert.equal(p.companion.pet.faim, 35);
  assert.equal(C.foodOffer(p, 'licorne', NOW).why, 'unknown');
  assert.equal(C.foodOffer({}, 'carotte', NOW).why, 'unknown');
  /* le jour : faim d'après pet.last (décroissance douce) */
  const q = kid({ faim: 100, last: NOW - 12 * 3600e3 });
  assert.equal(C.foodOffer(q, 'carotte', NOW).ok, true, 'faim 75 douze heures plus tard');
});

/* ---------- brossage, promenade ---------- */
test('brossage : le premier du jour gratuit (même tout beau), puis 5 🍎 s’il sert, refusé sinon sans rien coûter', () => {
  const p = kid({ joie: 100 });
  let o = C.careOffer(p, 'brush', D, NOW);
  assert.deepEqual([o.ok, o.free, o.price, o.full], [true, true, 0, true]);
  o = C.doCare(p, 'brush', D, NOW);
  assert.equal(o.ok, true);
  assert.equal(p.wallet.apples, 100, 'gratuit');
  assert.deepEqual(p.companion.pet.care, { d: D, brush: 1, walk: 0 });
  assert.equal(p.companion.pet.brushLast, NOW);
  /* déjà tout beau : le 2e est refusé, rien n'est dépensé */
  o = C.doCare(p, 'brush', D, NOW);
  assert.deepEqual([o.ok, o.why, o.free, o.price], [false, 'full', false, 5]);
  assert.equal(p.wallet.apples, 100);
  assert.equal(p.companion.pet.care.brush, 1);
  /* la joie a baissé : 5 🍎, +15 joie */
  p.companion.pet.joie = 60;
  o = C.doCare(p, 'brush', D, NOW);
  assert.deepEqual([o.ok, o.price], [true, 5]);
  assert.equal(p.wallet.apples, 95);
  assert.equal(p.companion.pet.joie, 75);
  assert.deepEqual(p.companion.pet.care, { d: D, brush: 2, walk: 0 });
  /* plus de délai de 4 h : il peut être brossé tout de suite s'il en a besoin */
  assert.equal(C.careOffer(p, 'brush', D, NOW + 2000).ok, true);
  /* le lendemain, le premier est de nouveau gratuit */
  const next = C.careOffer(p, 'brush', addDays(D, 1), NOW + 86400e3);
  assert.deepEqual([next.free, next.price, next.count], [true, 0, 0]);
});

test('promenade : la première du jour gratuite, puis 10 🍎 ; pommes manquantes → ce qu’il manque', () => {
  const p = kid({ forme: 40, joie: 40 }, 12);
  let o = C.doCare(p, 'walk', D, NOW);
  assert.deepEqual([o.ok, o.free], [true, true]);
  assert.equal(p.companion.pet.forme, 65);
  assert.equal(p.companion.pet.joie, 48);
  assert.equal(p.companion.pet.walkDay, D);
  o = C.doCare(p, 'walk', D, NOW);
  assert.deepEqual([o.ok, o.price], [true, 10]);
  assert.equal(p.wallet.apples, 2);
  assert.equal(p.companion.pet.forme, 90);
  /* en pleine forme : refusé */
  assert.equal(C.careOffer(p, 'walk', D, NOW).why, 'full');
  /* forme 50, 2 🍎 : il en manque 8 */
  p.companion.pet.forme = 50;
  o = C.doCare(p, 'walk', D, NOW);
  assert.deepEqual([o.ok, o.why, o.missing], [false, 'short', 8]);
  assert.equal(p.wallet.apples, 2);
  assert.deepEqual(p.companion.pet.care, { d: D, brush: 0, walk: 2 });
  /* brossage et promenade comptés séparément */
  assert.equal(C.careOffer(p, 'brush', D, NOW).free, true);
  assert.equal(C.careOffer(p, 'nage', D, NOW).why, 'unknown');
});

test('soins du jour : profil d’avant la 2.4 (brushLast, walkDay d’aujourd’hui = soin gratuit déjà pris), normalisation', () => {
  const p = kid({ brushLast: NOW - 3600e3, walkDay: D });
  delete p.companion.pet.care;
  assert.deepEqual(C.careToday(p.companion.pet, D), { brush: 1, walk: 1 });
  assert.equal(C.careOffer(p, 'walk', D, NOW).free, false);
  assert.deepEqual(C.careToday(p.companion.pet, addDays(D, 1)), { brush: 0, walk: 0 });
  /* compteur d'un autre jour : remis à zéro */
  p.companion.pet.care = { d: addDays(D, -1), brush: 4, walk: 3 };
  p.companion.pet.brushLast = 0; p.companion.pet.walkDay = '';
  assert.deepEqual(C.careToday(p.companion.pet, D), { brush: 0, walk: 0 });
  /* le compteur traverse la normalisation du profil (js/core/profiles.js normCare) */
  C.doCare(p, 'brush', D, NOW);
  const n = normalizeProfile(JSON.parse(JSON.stringify(p)), D);
  assert.deepEqual(n.companion.pet.care, { d: D, brush: 1, walk: 0 });
  assert.equal(C.careOffer(n, 'brush', D, NOW).free, false);
});

test('anti-hardcore : les pommes ne baissent que par un soin choisi, jamais sous 0', () => {
  const p = kid({ faim: 15, forme: 15, joie: 15 }, 3);
  for (const id of ['carotte', 'pomme', 'tarte']) C.feed(p, id, NOW);
  for (let i = 0; i < 5; i++) { C.doCare(p, 'brush', D, NOW); C.doCare(p, 'walk', D, NOW); }
  assert.equal(p.wallet.apples, 3, 'trop cher : rien de dépensé (seuls les soins gratuits passent)');
  assert.deepEqual(p.companion.pet.care, { d: D, brush: 1, walk: 1 });
  assert.ok(p.wallet.apples >= 0);
});

test('concours « En famille » : soins payants ou non, la note des soins plafonne à 300', () => {
  const rich = kid({ faim: 50, forme: 50, joie: 50 }, 500);
  for (let i = 0; i < 20; i++) {
    for (const f of foodsOf('pony')) C.feed(rich, f.id, NOW);
    C.doCare(rich, 'brush', D, NOW); C.doCare(rich, 'walk', D, NOW);
  }
  const s = companionScore(rich, NOW);
  assert.ok(s.notes.care <= 300, 'note des soins ' + s.notes.care);
  assert.ok(Object.values(s.gauges).every(v => v <= PET.MAX));
  assert.ok(rich.wallet.apples > 400, 'rassasié, il ne mange plus : pas de dépense sans fin (' + rich.wallet.apples + ')');
});

/* ---------- écran (source) ---------- */
test('scène du compagnon : garde-manger de SON espèce, refus doux, étiquettes gratuit / prix, sieste en fin de temps de jeu', () => {
  const js = SRC('js/ui/companion.js');
  assert.ok(/foodsOf\(p\.companion\.type\)/.test(js), 'garde-manger de l’espèce');
  assert.ok(!/for \(const f of FOODS\)/.test(js), 'plus la liste commune');
  for (const t of ['{N} n’a plus faim 😊', 'C’est trop pour {N} : choisis plus petit 😊', '{N} est déjà en pleine forme ! 🚶',
    'Chut… {N} fait la sieste 💤 À demain pour jouer !', 'Chut… {N} fait de beaux rêves 🌙 À demain pour jouer !']) {
    assert.ok(js.includes(t), t);
  }
  assert.ok(/'gratuit'/.test(js) && /\.cc-act-price/.test(js), 'étiquette gratuit / prix');
  assert.ok(/playState\(p, dayStr\(\)\)\.over/.test(js) && /napOrNight\(/.test(js), 'temps de jeu du jour');
  assert.ok(/sleep: napKind && !doze \? true : null/.test(js), 'sieste : sommeil imposé au moteur de vie');
  assert.ok(!/cooldown/.test(js) && !/walkDay === today/.test(js), 'plus de délai de 4 h ni de promenade unique');
  const life = SRC('js/ui/companion-life.js');
  assert.ok(/o\.sleep === true \|\| o\.sleep === false/.test(life), 'bringToLife({ sleep })');
  const css = SRC('css/ui/companion.css');
  assert.ok(/\.cc\.is-hero \.cc-act-price\.is-free \{[^}]*color: var\(--ok-ink\)/.test(css), '« gratuit » au contraste plein');
  assert.ok(/\.cc-item\.full \.cc-item-ico/.test(css), 'aliment grisé');
});
