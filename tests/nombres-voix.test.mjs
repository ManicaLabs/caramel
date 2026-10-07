/* Grands nombres dits par les voix calculées (v2.4.1, retour du parent du 07/10/2026 sur la tablette d'une de ses filles :
   « Lorsqu'il y a 1 000, il dit 1 zéro zéro zéro au lieu de mille. Apprends-lui à dire les milliers et centaines. »).
   Les nombres s'écrivent avec une espace fine entre les tranches ; la voix du téléphone les coupait en deux. */
import { test, assert } from './_t.mjs';
import { readFileSync } from 'node:fs';
import { bigNumbers, fluidText, speakable, planSpeech } from '../js/content/voice-lines.js';
import { frTypo } from '../js/core/util.js';

const SRC = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const phone = s => bigNumbers(speakable(frTypo(s)));

test('milliers et centaines en lettres pour la voix du téléphone et la voix fluide', () => {
  assert.equal(phone('Il y a 1 000 moutons.'), 'Il y a mille moutons.');
  assert.equal(phone('Le silo contient 6 496 kg de blé.'), 'Le silo contient six mille quatre cent quatre-vingt-seize kg de blé.');
  assert.equal(phone('Le tracteur coûte 54 014 €.'), 'Le tracteur coûte cinquante-quatre mille quatorze €.');
  assert.equal(phone('Il y a 250 000 visiteurs.'), 'Il y a deux cent cinquante mille visiteurs.');
  assert.equal(phone('2 300 000 habitants'), 'deux millions trois cent mille habitants');
  assert.equal(phone('Il en a 21 000.'), 'Il en a vingt-et-un mille.');
  assert.equal(phone('Le cheval pèse 591 kg.'), 'Le cheval pèse 591 kg.', 'sous 1 000 : les chiffres (toutes les voix les lisent bien)');
  assert.equal(phone('Il paie 1 250,50 €.'), 'Il paie 1250,50 €.', 'nombre à virgule : chiffres recollés');
  assert.equal(phone('Il paie 3,125 €.'), 'Il paie 3,125 €.', 'partie décimale intacte');
  /* la voix fluide : les règles de calcul voient encore les chiffres (« plusse », pause avant le signe) */
  assert.equal(fluidText(frTypo('Combien font 1 000 + 250 ?')), 'Combien font mille | plusse 250?');
  assert.equal(fluidText(frTypo('Il y a 1 000 moutons.')), 'Il y a mille moutons.');
  /* les clips n'en ont pas besoin : planSpeech recolle et compose « mille » */
  assert.deepEqual(planSpeech(frTypo('Combien font 1 000 + 250 ?')).clips.map(c => c.id).slice(0, 2), ['m.combien-font', 'mille']);
});

test('branché : voix du téléphone (viaTts) et voix fluide (fluidText)', () => {
  assert.match(SRC('js/ui/voice.js'), /tts\.speakResult\(bigNumbers\(agree\(t\)\)(?:, opts)?\)/);
  assert.match(SRC('js/content/voice-lines.js'), /return bigNumbers\(t\);/);
});
