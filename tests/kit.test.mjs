/* Kit d'interface (js/ui/kit.js) : logique pure, sans DOM — durée des toasts selon la longueur (lecteur débutant),
   terminaisons « -ent » insécables dans les bulles, vocabulaire des encouragements. */
import { test, assert } from './_t.mjs';
import { toastMs, keepSuffix, CHEERS } from '../js/ui/kit.js';

test('toast : durée selon la longueur du message (2,5 à 7 s), durée imposée respectée', () => {
  assert.equal(toastMs('Ok'), 2500, 'plancher de 2,5 s');
  assert.equal(toastMs('x'.repeat(60)), 3600, '60 ms par caractère');
  assert.equal(toastMs('x'.repeat(500)), 7000, 'plafond de 7 s');
  assert.equal(toastMs(''), 2500);
  assert.equal(toastMs(null), 2500);
  assert.equal(toastMs('x'.repeat(500), 1500), 1500, 'durée passée par l’appelant');
  assert.equal(toastMs('Bravo', 100), 600, 'jamais moins de 0,6 s');
  assert.equal(toastMs('Bravo', 'abc'), 2500, 'durée illisible : durée selon la longueur');
});

test('bulles : une terminaison ne se coupe pas après son tiret, les mots composés restent intacts', () => {
  const WJ = '\u2060';
  assert.equal(keepSuffix('les terminaisons -ent et -ais'), 'les terminaisons -' + WJ + 'ent et -' + WJ + 'ais');
  assert.equal(keepSuffix('-ons'), '-' + WJ + 'ons', 'en début de texte');
  assert.equal(keepSuffix('(-ez)'), '(-' + WJ + 'ez)', 'après une parenthèse');
  assert.equal(keepSuffix('«\u202F-ent\u202F»'), '«\u202F-' + WJ + 'ent\u202F»', 'après une espace fine');
  assert.equal(keepSuffix('peut-être, arc-en-ciel'), 'peut-être, arc-en-ciel', 'tirets entre deux lettres');
  assert.equal(keepSuffix('12 - 3 = 9'), '12 - 3 = 9', 'pas de lettre après le tiret');
  assert.equal(keepSuffix(keepSuffix('-ent')), keepSuffix('-ent'), 'idempotent');
});

test('encouragements : « partie » côté enfant, jamais « faux » ni « raté », mots doux courts', () => {
  for (const [k, list] of Object.entries(CHEERS)) {
    for (const s of list) {
      assert.ok(!/\bmanche\b/i.test(s), k + ' : « manche » → « partie » : ' + s);
      assert.ok(!/\b(faux|fausse|raté|erreur)\b/i.test(s), k + ' : ' + s);
    }
  }
  for (const s of CHEERS.retry) assert.ok(s.replace(/[^\p{L}’' -]/gu, '').trim().split(/\s+/).length <= 4, 'mot doux court (4 mots au plus) : ' + s);
});
