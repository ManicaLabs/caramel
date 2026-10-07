/* 🔊 / 🔇 : couper et remettre le son d'un toucher (v2.4, retour du parent du 07/10/2026 : « l'icône de la petite
   enceinte toujours accessible afin de pouvoir couper / remettre le son »). Décision : en haut de l'accueil et de chaque
   jeu ; « Écouter encore » passe à 🔁. Prénoms fictifs uniquement. */
import { test, assert, memoryStorage } from './_t.mjs';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import * as audio from '../js/core/audio.js';
import { soundOn, toggleSound } from '../js/ui/sound-toggle.js';
import { listenOn } from '../js/ui/voice.js';

const SRC = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('🔊 / 🔇 : un toucher bascule le réglage « Sons » de l’enfant actif (gardé), coupe tout de suite, et 🔁 suit', () => {
  store.init(memoryStorage(), '2026-10-07');
  store.addProfile({ name: 'Léa', classe: 'CE1' });
  assert.equal(soundOn(), true, 'sons activés par défaut');
  assert.equal(toggleSound(), false);
  assert.equal(store.getProfile().settings.sound, false, 'le même réglage que l’espace parents');
  assert.equal(audio.isMuted(), true, 'muet tout de suite');
  assert.equal(listenOn(), false, 'sons coupés : 🔁 caché');
  assert.equal(toggleSound(), true);
  assert.equal(store.getProfile().settings.sound, true);
  assert.equal(audio.isMuted(), false);
  store.init(memoryStorage(), '2026-10-07');
  assert.equal(toggleSound(), true, 'aucun enfant actif : rien ne change');
});

test('🔊 / 🔇 posé en haut de l’accueil et de chaque jeu ; « Écouter encore » est 🔁', () => {
  assert.match(SRC('js/ui/home.js'), /h\('header', \{ class: 'hm-head' \}, avaWrap, hello, soundBtn, themeBtn, lockBtn\)/);
  assert.match(SRC('js/ui/game-header.js'), /h\('div', \{ class: 'gh-row' \}, back, mid, listen, joker, sound\)/);
  assert.match(SRC('js/ui/voice.js'), /class: 'vx-ico', 'aria-hidden': 'true' \}, '🔁'\)/);
  assert.match(SRC('js/ui/game-ctx.js'), /header\.setLine\((?:line \|\| )?text, voice\.readAloud\(q\)\)/, '🔁 revient quand le son revient');
});
