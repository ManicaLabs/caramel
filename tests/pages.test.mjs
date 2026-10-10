/* Publication sur Google Play (v2.2.4) : pages publiques (pages/), liens de l'espace parents, icônes du manifeste
   (« any », « maskable » et « monochrome » séparées) et visuels des stores (store/visuels, store/captures) : présents,
   aux bonnes tailles, sans transparence là où les stores l'interdisent. */
import { test, assert } from './_t.mjs';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { INFO_PAGES } from '../js/ui/parents.js';
import { MODEL_URL } from '../js/core/speech.js';

const url = p => new URL('../' + p, import.meta.url);
const SRC = p => readFileSync(url(p), 'utf8');
/* en-tête PNG : largeur, hauteur, type de couleur (2 = RVB sans alpha, 6 = RVBA) */
function png(p) {
  const b = readFileSync(url(p));
  assert.equal(b.toString('latin1', 1, 4), 'PNG', p + ' : pas un PNG');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: b[25] };
}
const PAGES = ['confidentialite', 'mentions-legales', 'aide', 'licences'];

test('pages publiques : présentes, en français, au style de Caramel, reliées entre elles', () => {
  assert.deepEqual(INFO_PAGES.map(([href]) => href).sort(), PAGES.map(p => 'pages/' + p + '.html').sort(), 'liens de l’espace parents');
  for (const p of PAGES) {
    const f = 'pages/' + p + '.html', s = SRC(f);
    assert.match(s, /^<!DOCTYPE html>\n<html lang="fr">/, f);
    assert.match(s, /<meta name="viewport" content="width=device-width, initial-scale=1/, f);
    assert.match(s, /<title>[^<]+ · Caramel<\/title>/, f);
    for (const dep of ['../css/base.css', 'pages.css', 'pages.js', '../icon.svg']) assert.ok(s.includes('"' + dep + '"'), f + ' → ' + dep);
    assert.match(s, /<a class="pg-back" href="\.\.\/">/, f + ' : retour à Caramel');
    for (const q of PAGES) assert.ok(s.includes('href="' + q + '.html"'), f + ' → ' + q);
    assert.ok(s.includes('href="' + p + '.html" aria-current="page"'), f + ' : page courante signalée');
    assert.ok(!/[\u00A0\u202f\u200B\u2009\u0300-\u036F]/.test(s), f + ' : caractère invisible littéral (écrire &#8239; / &nbsp;)');
    const text = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '');
    assert.ok(!/[ \t\n][;:!?»]/.test(text.replace(/&#8239;|&nbsp;/g, '')), f + ' : espace ordinaire avant ; : ! ? »');
    assert.ok(!/«[ \t\n]/.test(text), f + ' : espace ordinaire après «');
  }
  assert.ok(existsSync(url('pages/pages.css')) && existsSync(url('pages/pages.js')));
});

test('pages publiques : la confidentialité dit tout (micro, secours de Google, hébergeurs, effacement, enfants, CNIL)', () => {
  const s = SRC('pages/confidentialite.html');
  for (const w of ['jamais enregistré', 'serveurs de Google', 'GitHub', 'jsDelivr', 'adresse IP', 'Effacer toutes les données de cet appareil', '6 à 11 ans', 'CNIL', 'Google Play'])
    assert.ok(s.includes(w), 'confidentialité : « ' + w + ' »');
  /* crédits : le modèle de reconnaissance vocale réellement chargé (js/core/speech.js) */
  const lic = SRC('pages/licences.html');
  const m = /fr-small-(\d+\.\d+)/.exec(MODEL_URL);
  assert.ok(m, 'MODEL_URL : ' + MODEL_URL);
  assert.ok(lic.includes('vosk-model-small-fr-' + m[1]) && lic.includes('Apache 2.0'), 'licences : modèle ' + m[1]);
  assert.ok(!/pguyot/.test(lic.replace(/<!--[\s\S]*?-->/g, '')), 'ancien modèle CC BY-NC-SA encore crédité');
  for (const w of ['vosk-browser', 'onnxruntime-web', 'Piper', 'SIWIS', 'CC BY 4.0', 'eSpeak NG', 'GPL-3.0', 'Fredoka', 'Andika', 'OFL'])
    assert.ok(lic.includes(w), 'licences : « ' + w + ' »');
});

test('manifeste : icônes « any », « maskable » et « monochrome » séparées, fichiers aux bonnes tailles', () => {
  const man = JSON.parse(SRC('manifest.webmanifest'));
  assert.equal(man.id, './', 'id inchangé : sinon les applis déjà installées deviennent une autre appli');
  const by = purpose => man.icons.filter(i => (i.purpose || 'any') === purpose);
  assert.ok(!man.icons.some(i => /\s/.test(i.purpose || '')), 'jamais « any maskable » : la même image ne sert pas aux deux');
  for (const [purpose, min] of [['any', 512], ['maskable', 512], ['monochrome', 512]]) {
    const list = by(purpose);
    assert.ok(list.some(i => i.sizes === min + 'x' + min), purpose + ' ' + min);
    for (const i of list) {
      const d = png(i.src);
      assert.equal(d.w + 'x' + d.h, i.sizes, i.src);
      if (purpose === 'maskable') assert.notEqual(d.type, 4, i.src);
    }
  }
  assert.ok(Array.isArray(man.categories) && man.categories.includes('education'));
  for (const s of man.screenshots || []) {
    assert.ok(existsSync(url(s.src)), s.src);
    assert.ok(['narrow', 'wide'].includes(s.form_factor), s.src + ' : form_factor');
  }
});

test('visuels des stores : icône Play 512, présentation 1024 × 500 et icône iOS 1024 sans transparence ; captures', () => {
  assert.deepEqual(png('store/visuels/icone-play-512.png').w, 512);
  const ios = png('store/visuels/icone-ios-1024.png');
  assert.deepEqual([ios.w, ios.h, ios.type], [1024, 1024, 2], 'App Store : 1024 × 1024 sans canal alpha');
  const fg = png('store/visuels/presentation-play-1024x500.png');
  assert.deepEqual([fg.w, fg.h, fg.type], [1024, 500, 2], 'Play : 1024 × 500, PNG 24 bits sans alpha');
  /* captures Play : PNG 24 bits, côtés entre 320 et 3 840 px, au plus 2 fois plus longues que larges, 9:16 ou 16:9 */
  const dir = 'store/captures/';
  const shots = existsSync(url(dir)) ? readdirSync(url(dir)).filter(f => f.endsWith('.png')) : [];
  for (const kind of ['telephone', 'tablette-7', 'tablette-10']) assert.ok(shots.filter(f => f.startsWith(kind + '-')).length >= 2, 'au moins 2 captures ' + kind);
  for (const f of shots) {
    const d = png(dir + f), lo = Math.min(d.w, d.h), hi = Math.max(d.w, d.h);
    assert.equal(d.type, 2, f + ' : sans alpha');
    assert.ok(lo >= 320 && hi <= 3840 && hi <= 2 * lo, f + ' : ' + d.w + ' × ' + d.h);
    assert.ok(Math.abs(hi / lo - 16 / 9) < 0.01, f + ' : 16:9 ou 9:16');
    if (f.startsWith('telephone-')) assert.ok(lo >= 1080, f + ' : 1080 px au moins (mise en avant)');
    if (f.startsWith('tablette-10-')) assert.ok(lo >= 1080, f + ' : tablette 10" : 1080 px au moins');
  }
});
