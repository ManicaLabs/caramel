/* Écrans de l'enfant (v2.2, constats de l'audit design) : accords de la boutique du compagnon, icône des tables,
   élision et listes partagées (util.js), arrivée d'un nouvel enfant (« Suivant » jamais muet, question des parents),
   carte enfant unique pour « Qui joue ? ». Prénoms fictifs uniquement. */
import { test, assert } from './_t.mjs';
import { readFileSync } from 'node:fs';
import { accorde, deNom, frList } from '../js/core/util.js';
import { AXES } from '../js/core/axes.js';
import { axisEmoji } from '../js/ui/radar.js';
import { SHOP, MOUNTS } from '../js/content/companion-data.js';
import { wornWord, chosenWord } from '../js/ui/companion.js';

const SRC = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const code = p => SRC(p).replace(/\/\*[\s\S]*?\*\//g, '');

test('accorde : participe accordé en genre et en nombre', () => {
  assert.equal(accorde('porté'), 'porté');
  assert.equal(accorde('porté', { f: true }), 'portée');
  assert.equal(accorde('porté', { pl: true }), 'portés');
  assert.equal(accorde('porté', { f: true, pl: true }), 'portées');
  assert.equal(accorde('choisi', { f: true }), 'choisie');
  assert.equal(accorde(undefined), '');
});

test('boutique du compagnon : « porté ✓ » s’accorde avec chaque accessoire, « choisi ✓ » avec chaque animal', () => {
  const want = { foulard: 'porté', noeud: 'porté', chapeau: 'porté', lunettes: 'portées', echarpe: 'portée', selle: 'portée', couronne: 'portée', ailes: 'portées' };
  for (const it of SHOP) assert.equal(wornWord(it.id), want[it.id], it.name + ' : ' + wornWord(it.id));
  assert.equal(Object.keys(want).length, SHOP.length, 'un accord prévu pour chaque objet de la boutique');
  for (const [t, m] of Object.entries(MOUNTS)) assert.equal(chosenWord(t), m.g === 'f' ? 'choisie' : 'choisi', m.label);
  assert.equal(chosenWord('unicorn'), 'choisie');
});

test('boutique : même sens du cadre vert qu’au garde-manger (« tu peux te l’offrir »), pas de porte-monnaie en double', () => {
  const js = code('js/ui/companion.js');
  assert.ok(/tried \? 'trying' : can \? 'can' : 'cant'/.test(js), 'objets : can / cant');
  assert.equal((js.match(/can \? 'can' : 'cant'/g) || []).length, 2, 'habits et animaux');
  assert.ok(/withPurse && !hero \? walletPill\(\) : null/.test(js), 'scène héros : le trésor de la scène suffit');
  assert.ok(!/h\('h3'/.test(js), 'titres des panneaux en h2 (sous le h1 de l’accueil)');
  const css = code('css/ui/companion.css');
  assert.ok(/\.cc-item\.can \{ border-color: var\(--ok-300\); \}/.test(css) && /\.cc-item\.owned \{ border-style: dashed; \}/.test(css), 'cadres');
  assert.ok(!/\.cc-item\.cant \{ opacity/.test(css), 'texte au contraste plein sur un objet trop cher');
});

test('« Les tables » : 🏇 dans le référentiel, plus de surcharge côté radar, aucun ✖️ dans les axes', () => {
  assert.equal(AXES['ma.faits'].emoji, '🏇');
  for (const [id, a] of Object.entries(AXES)) {
    assert.notEqual(a.emoji, '✖️', id);
    assert.equal(axisEmoji(id), a.emoji, id + ' : icône du référentiel');
  }
  assert.ok(!/CHILD_EMOJI/.test(SRC('js/ui/radar.js')), 'surcharge retirée');
});

test('élision et listes : famille, défi et import utilisent deNom et frList de util.js', () => {
  assert.equal(deNom('Inès'), 'd’Inès');
  assert.equal(deNom('Hugo'), 'de Hugo');
  assert.equal(frList(['Léa', 'Zoé', 'Inès']), 'Léa, Zoé et Inès');
  for (const f of ['js/ui/famille.js', 'js/ui/battle.js', 'js/ui/import-eval.js']) {
    const js = code(f);
    assert.ok(!/const (deName|deNom) =/.test(js), f + ' : copie locale de deNom');
    assert.ok(!/join\(' et '\)/.test(js), f + ' : liste « A et B et C »');
    assert.ok(!/' de ' \+ p\.name/.test(js), f + ' : « de » + prénom sans élision');
  }
});

test('arrivée d’un nouvel enfant : « Suivant » jamais désactivé, Entrée répond toujours, question posée aux parents', () => {
  const js = code('js/ui/onboarding.js');
  assert.ok(!/\.disabled\s*=/.test(js), 'pas de bouton désactivé sans explication');
  assert.ok(!/if \(!next\.disabled\)/.test(js), 'Entrée : submit() dans tous les cas');
  assert.ok(/class: 'ob-help', 'aria-live': 'polite'/.test(js), 'ligne d’aide annoncée');
  assert.ok(/Choisis « une fille » ou « un garçon »/.test(js) && /Écris ton prénom/.test(js), 'ce qui manque, en mots d’enfant');
  assert.ok(/title\('Une question pour tes parents'\)/.test(js) && /Montre cet écran à un adulte/.test(js), 'étape des parents');
  assert.ok(/avez-vous la fiche des évaluations nationales/.test(js), 'les parents sont vouvoyés');
  /* plus de confettis plein écran au passage vers la question de la fiche */
  const buddy = js.slice(js.indexOf('buddy() {'), js.indexOf('fiche: ficheStep'));
  assert.ok(buddy.length > 100 && !/motion\.confetti/.test(buddy), 'la fête du compagnon reste sur son étape');
  const css = code('css/ui/onboarding.css');
  assert.ok(/\.ob-next\[aria-disabled="true"\]/.test(css) && !/\.ob-next:disabled/.test(css), 'aspect « pas encore prêt »');
  assert.ok(/\.ob-g\.on::before \{ content: '✓\\00a0'; content: '✓\\00a0' \/ '';/.test(css), 'choix fille / garçon : ✓ hors du nom accessible');
});

test('« Qui joue ? » : une seule carte enfant pour l’écran #/profiles et la feuille de l’accueil', () => {
  const home = code('js/ui/home.js'), prof = code('js/ui/profiles.js');
  assert.ok(/export function kidCard\(/.test(prof) && /export function kidActions\(/.test(prof), 'composant exporté');
  assert.ok(/import \{ kidCard, kidActions \} from '\.\/profiles\.js'/.test(home), 'réutilisé par l’accueil');
  assert.ok(/loadCSS\('css\/ui\/profiles\.css'\)/.test(home), 'styles chargés par l’accueil');
  assert.ok(!/hw-card|pf-card/.test(home + prof + SRC('css/ui/home.css') + SRC('css/ui/profiles.css')), 'anciens sélecteurs retirés');
  assert.ok(!/#bae6fd|#86efac/.test(SRC('css/ui/profiles.css')), 'plus de pré recopié en dur');
});
