/* Pommes express — logique pure (js/games/pommes-logic.js), confrontée au vrai générateur ma.procedures. */
import { test, assert } from './_t.mjs';
import { makeRng } from '../js/core/rng.js';
import { fmtNum } from '../js/core/util.js';
import { gen } from '../js/content/maths/procedures.js';
import {
  HOLE, NNBSP, NBSP, SPRINT_MS, MAX_LEN, BASKET_SLOTS, CARD_RATIO, LONG_TIP, APPLE_TOP,
  displayPrompt, tokenize, joinTokens, promptParts, partsText, promptAria, keepMath, explainSentences,
  answerInfo, checkTyped, checkChoice, choiceLabel, idleText, toneOf, plural,
  createSprintClock, applePath, basketSlots, sceneLayout, overlaps
} from '../js/games/pommes-logic.js';

/* échantillon large : A de 0 à 5,6 (pas 0,1) × 60 graines, plus chaque procédure imposée */
function sample() {
  const out = [];
  for (let i = 0; i <= 56; i++) {
    const rng = makeRng('pommes-' + i);
    for (let k = 0; k < 60; k++) out.push(gen(i / 10, rng));
  }
  const kinds = new Set(out.map(it => it.kind));
  for (const kind of kinds) {
    const rng = makeRng('pommes-kind-' + kind);
    for (let k = 0; k < 20; k++) out.push(gen(5.6, rng, { kind }));
  }
  return out;
}
const ITEMS = sample();
const norm = s => s.replace(/\s+/g, ' ').trim();

test('énoncé : une seule case, deux lignes coupées au signe = ou ≈, texte identique à item.prompt', () => {
  const kinds = new Set();
  for (const it of ITEMS) {
    kinds.add(it.kind);
    const parts = promptParts(it.prompt);
    const holes = parts.lines.flat().filter(t => t.k === 'hole');
    assert.equal(holes.length, 1, it.prompt);
    assert.equal(parts.lines.length, 2, 'deux lignes : ' + it.prompt);
    assert.ok(parts.holeLine === 0 || parts.holeLine === 1, it.prompt);
    assert.equal(parts.lines[1][0].k, 'op');
    assert.ok(parts.lines[1][0].rel);
    assert.equal(parts.rel, it.kind === 'estimation' ? '≈' : '=', it.prompt);
    assert.equal(norm(partsText(parts)), norm(displayPrompt(it.prompt)), it.prompt);
    /* aucun jeton vide, aucun caractère perdu */
    for (const tk of parts.lines.flat()) assert.ok(tk.t && tk.t.length, it.prompt);
  }
  assert.ok(kinds.size >= 40, 'procédures couvertes : ' + kinds.size);
});

test('énoncé : majuscule initiale, jetons (nombres à espace fine, décimaux, parenthèses collées)', () => {
  assert.equal(displayPrompt('moitié de 46 = …'), 'Moitié de 46 = …');
  assert.equal(displayPrompt('47 + 9 = …'), '47 + 9 = …');
  const t = tokenize('1' + NNBSP + '000 × 4,45');
  assert.deepEqual(t.map(x => x.k), ['num', 'op', 'num']);
  assert.equal(t[0].t, '1' + NNBSP + '000');
  assert.equal(t[2].t, '4,45');
  const p = promptParts('37 − (3 × (14 − 6)) = …');
  assert.equal(joinTokens(p.lines[0]), '37 − (3 × (14 − 6))');
  assert.equal(joinTokens(p.lines[1]), '= …');
  const q = promptParts('38 + … = 40');
  assert.equal(q.holeLine, 0);
  assert.equal(joinTokens(q.lines[0]), '38 + …');
  assert.equal(joinTokens(q.lines[1]), '= 40');
  assert.equal(tokenize(HOLE)[0].k, 'hole');
});

test('lecture à voix haute : opérateurs en mots, « combien » à la place de la case', () => {
  assert.equal(promptAria('47 + 9 = …'), '47 plus 9 égale combien ?');
  assert.equal(promptAria('38 + … = 40'), '38 plus combien égale 40 ?');
  assert.equal(promptAria('724 × 68 ≈ …'), '724 fois 68, c’est environ combien ?');
  assert.equal(promptAria('260 ÷ 8 = …'), '260 divisé par 8 égale combien ?');
  for (const it of ITEMS) {
    const a = promptAria(it.prompt);
    assert.ok(/combien/.test(a) && !a.includes(HOLE) && !/[−×÷≈]/.test(a), a);
  }
});

test('réponse : pavé décimal seulement pour une réponse décimale, QCM pour les estimations, case assez large', () => {
  let dec = 0, choice = 0;
  for (const it of ITEMS) {
    const info = answerInfo(it);
    assert.equal(info.value, Number(it.answer));
    assert.equal(info.choice, it.kind === 'estimation', it.prompt);
    if (!info.choice) assert.equal(info.decimal, !Number.isInteger(it.answer) || it.data.decimals > 0, it.prompt);
    else assert.equal(info.decimal, false);
    if (info.decimal) dec++;
    if (info.choice) choice++;
    assert.equal(info.text, fmtNum(it.answer));
    assert.ok(!/\s/.test(info.raw), info.raw);
    assert.ok(info.len <= 10, 'réponse trop longue pour le pavé : ' + info.raw);
    assert.ok(info.maxLen >= MAX_LEN && info.maxLen > info.len, it.prompt);
    assert.ok(info.holeCh >= Math.max(2, info.text.length), it.prompt);
    /* la réponse tapée telle qu'affichée est juste */
    assert.ok(checkTyped(info.raw, it).ok, it.prompt + ' ← ' + info.raw);
  }
  assert.ok(dec > 50 && choice > 20, `décimaux ${dec}, estimations ${choice}`);
});

test('saisie : virgule, espaces, zéros inutiles ; jamais juste à côté de la réponse', () => {
  const it = { answer: 8.2 };
  assert.ok(checkTyped('8,2', it).ok);
  assert.ok(checkTyped('8,20', it).ok);
  assert.ok(checkTyped('8.2', it).ok);
  assert.ok(!checkTyped('8,3', it).ok);
  assert.ok(!checkTyped('82', it).ok);
  assert.ok(checkTyped('1' + NNBSP + '000', { answer: 1000 }).ok);
  assert.ok(checkTyped('1 000', { answer: 1000 }).ok);
  assert.ok(checkTyped('12,', { answer: 12 }).ok);
  assert.equal(checkTyped('', it).valid, false);
  assert.equal(checkTyped('abc', it).valid, false);
  assert.equal(checkTyped(',', it).valid, false);
  for (const x of ITEMS.slice(0, 2000)) {
    if (answerInfo(x).choice) continue;
    const near = Number.isInteger(x.answer) ? x.answer + 1 : Math.round((x.answer + 0.1) * 1000) / 1000;
    assert.equal(checkTyped(fmtNum(near), x).ok, false, x.prompt);
  }
});

test('QCM d’estimation : une seule bonne réponse parmi les 4 choix, étiquettes à la française', () => {
  let n = 0;
  for (const it of ITEMS.filter(x => x.kind === 'estimation')) {
    n++;
    assert.equal(it.choices.length, 4);
    assert.equal(it.choices.filter(c => checkChoice(c.value, it)).length, 1, it.prompt);
    assert.equal(choiceLabel(it, it.answer), it.choices.find(c => c.value === it.answer).label);
    assert.equal(choiceLabel({}, 3000), '3' + NNBSP + '000');
  }
  assert.ok(n > 20);
  assert.match(idleText(ITEMS.find(x => x.kind === 'estimation')), /plus proche/);
  assert.match(idleText(ITEMS.find(x => x.kind !== 'estimation')), /tape ta réponse/);
});

test('explication : une phrase par ligne, rien de perdu, conclusion « Donc … » repérée', () => {
  let concl = 0;
  for (const it of ITEMS) {
    const ss = explainSentences(it.explain);
    assert.ok(ss.length >= 1);
    assert.equal(ss.map(s => s.t).join(' '), it.explain.trim(), it.explain);
    if (/\. Donc /.test(it.explain)) { assert.ok(ss[ss.length - 1].conclusion, it.explain); concl++; }
    assert.ok(ss.slice(0, -1).every(s => !s.conclusion), it.explain);
  }
  assert.ok(concl > ITEMS.length * 0.9);
  assert.deepEqual(explainSentences(''), []);
});

test('typographie : les égalités ne se coupent pas en fin de ligne ; astuces et textes du jeu', () => {
  assert.equal(keepMath('47 + 10 = 57, puis 57 − 1 = 56.'), `47${NBSP}+${NBSP}10${NBSP}=${NBSP}57, puis 57${NBSP}−${NBSP}1${NBSP}=${NBSP}56.`);
  assert.equal(keepMath('(2 × 6) + (7 × 5)'), `(2${NBSP}×${NBSP}6)${NBSP}+${NBSP}(7${NBSP}×${NBSP}5)`);
  assert.equal(keepMath(keepMath('3 + 4 = 7')), keepMath('3 + 4 = 7'));
  for (const it of ITEMS) {
    assert.ok(!/'/.test(it.hint + it.explain), 'apostrophe droite : ' + it.hint);
    assert.ok(it.hint.length > 0 && it.hint.length < 200);
  }
  assert.ok(LONG_TIP > 60 && LONG_TIP < 120);
  assert.equal(plural(1, 'pomme', 'pommes'), 'pomme');
  assert.equal(plural(0, 'pomme', 'pommes'), 'pomme');
  assert.equal(plural(2, 'pomme', 'pommes'), 'pommes');
  assert.deepEqual([0, 1, 2, 3, 4].map(toneOf), ['rose', 'doree', 'rose', 'corail', 'rose']);
});

test('sprint : 60 s, en pause pendant l’explication, jamais de temps négatif', () => {
  assert.equal(SPRINT_MS, 60000);
  const c = createSprintClock();
  assert.equal(c.started, false);
  assert.equal(c.done(0), false);
  c.start(1000);
  assert.equal(c.elapsed(11000), 10000);
  c.pause(11000);
  assert.equal(c.running, false);
  assert.equal(c.elapsed(50000), 10000, 'pause : le temps ne court plus');
  c.pause(52000);
  assert.equal(c.elapsed(52000), 10000);
  c.resume(50000);
  assert.equal(c.elapsed(60000), 20000);
  c.start(0);                                  /* déjà démarré : sans effet */
  assert.equal(c.elapsed(60000), 20000);
  assert.equal(c.done(99999), false);
  assert.equal(c.done(100000), true);
  assert.equal(c.remaining(200000), 0);
  assert.equal(c.fraction(200000), 1);
  c.pause(100000);
  c.resume(110000);                            /* fini : on ne repart pas */
  assert.equal(c.running, false);
  assert.equal(c.elapsed(500000), 60000);
});

test('silhouette de pomme : chemin fermé, symétrique, dans sa boîte', () => {
  for (const [w, hh, p] of [[302, 229, 5], [80, 60, 0], [470, 356, 5], [26, 24, 0]]) {
    const d = applePath(w, hh, p);
    assert.match(d, /^M [\d. ]+( C [\d., ]+)+ Z$/);
    const nums = d.replace(/[MCZ,]/g, ' ').trim().split(/\s+/).map(Number);
    for (let i = 0; i < nums.length; i += 2) {
      assert.ok(nums[i] >= p - 0.6 && nums[i] <= w - p + 0.6, `x ${nums[i]} hors de [${p} ; ${w - p}]`);
      assert.ok(nums[i + 1] >= p - 0.6 && nums[i + 1] <= hh - p + hh * 0.012 + 0.6, `y ${nums[i + 1]}`);
    }
    /* symétrie gauche / droite : le premier point (creux du haut) est au milieu */
    assert.ok(Math.abs(nums[0] - w / 2) < 0.11);
    assert.ok(Math.abs(nums[1] - (p + APPLE_TOP * (hh - 2 * p))) < 0.11);
  }
});

test('panier : 12 places distinctes dans l’ouverture du panier', () => {
  const s = basketSlots();
  assert.equal(s.length, BASKET_SLOTS);
  assert.equal(new Set(s.map(p => p.x + ':' + p.y)).size, s.length);
  for (const p of s) {
    assert.ok(p.x - p.r >= 0 && p.x + p.r <= 120, 'x ' + p.x);
    assert.ok(p.y >= -16 + p.r && p.y <= 34, 'y ' + p.y);
    assert.ok(p.r > 8 && Math.abs(p.tilt) <= 15);
  }
  assert.equal(basketSlots(3).length, 3);
  assert.equal(basketSlots(99).length, BASKET_SLOTS);
});

test('scène : la pomme-carte ne recouvre ni le panier ni le compagnon, tient dans la scène, garde ses proportions', () => {
  for (let W = 160; W <= 820; W += 20) {
    for (let H = 160; H <= 820; H += 20) {
      const l = sceneLayout(W, H);
      const c = l.card;
      assert.ok(!overlaps(c, l.basket), `${W}×${H} : panier`);
      assert.ok(!overlaps(c, l.hero), `${W}×${H} : compagnon`);
      assert.ok(c.x >= 0 && c.x + c.w <= W, `${W}×${H} : largeur`);
      assert.ok(c.y - c.stem >= 0 && c.y + c.h <= H, `${W}×${H} : hauteur`);
      assert.ok(Math.abs(c.w / c.h - CARD_RATIO) < 0.03, `${W}×${H} : proportions`);
      assert.ok(l.basket.x + l.basket.w <= W && l.basket.y + l.basket.h <= H && l.hero.x >= 0 && l.hero.y >= 0);
    }
  }
  /* téléphone de référence (390 × 844 : scène ≈ 356 × 353) : grande pomme */
  const ph = sceneLayout(356, 353);
  assert.ok(ph.card.w >= 280, 'pomme-carte ' + ph.card.w);
});
