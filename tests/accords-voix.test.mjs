/* Accords et liaisons des nombres dits à voix haute (v2.5.1, retour du parent du 07/10/2026 : « 1 pomme = une pomme et pas
   un pomme ; fais aussi attention aux liaisons »). agree() (js/content/voice-lines.js) sert la voix du téléphone et la voix
   fluide ; la voix enregistrée choisit ses clips « une » avec la même liste FEM_WORDS. Prénoms fictifs uniquement. */
import { test, assert } from './_t.mjs';
import { readFileSync } from 'node:fs';
import { agree, bigNumbers, fluidText, speakable, FEM_WORDS, MASC_VOWEL } from '../js/content/voice-lines.js';
import { frTypo } from '../js/core/util.js';
import { makeRng } from '../js/core/rng.js';

const SRC = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const phone = s => bigNumbers(agree(speakable(frTypo(s))));

test('« une pomme », « un‿œuf », « neuf‿ans » : accords et liaisons pour la voix du téléphone et la voix fluide', () => {
  const cases = [
    ['Il te manque 1 🍎', 'Il te manque une pomme'],
    ['Il te manque 21 🍎', 'Il te manque vingt-et-une pommes'],
    ['Il a 1 botte de foin.', 'Il a une botte de foin.'],
    ['Il reste 1 heure.', 'Il reste une heure.'],
    ['Il y a 41 chèvres.', 'Il y a quarante-et-une chèvres.'],
    ['Tu as trouvé 1 réponse du premier coup !', 'Tu as trouvé une réponse du premier coup!'],
    ['Il a 1 œuf.', 'Il a un œuf.'],
    ['Il a 1 euro.', 'Il a un euro.'],
    ['Il y a 31 arbres.', 'Il y a trente-et-un arbres.'],
    ['Il a 9 ans.', 'Il a neuf ans.'],
    ['Il est 19 heures.', 'Il est dix-neuf heures.'],
    /* ce qui ne change pas : les voix le lisent bien en chiffres */
    ['Il a 2 œufs.', 'Il a 2 œufs.'], ['Il a 10 euros.', 'Il a 10 euros.'], ['Il a 1 chat.', 'Il a 1 chat.'],
    ['1 × 7 = ?', '1 fois 7 =?'], ['1 et 2', '1 et 2'], ['Il a 9 œufs.', 'Il a 9 œufs.'],
    ['Il pèse 2,1 kg.', 'Il pèse 2,1 kg.'], ['Il y a 21 000 pommes.', 'Il y a vingt-et-un mille pommes.'],
    ['Il y a 1 000 abeilles.', 'Il y a mille abeilles.']
  ];
  for (const [s, want] of cases) assert.equal(phone(s), want, s);
  assert.equal(fluidText(frTypo('Il te manque 1 🍎')), 'Il te manque une pomme');
  assert.equal(fluidText(frTypo('Il a 1 œuf.')), 'Il a un œuf.');
  assert.equal(fluidText(frTypo('Combien font 1 + 1 ?')), 'Combien font 1 | plusse 1?', 'calcul intact');
  assert.ok(!MASC_VOWEL.has('hibou') && !MASC_VOWEL.has('haricot') && !MASC_VOWEL.has('hamburger'), 'h aspiré : pas de liaison');
});

test('branché : voix du téléphone (agree puis bigNumbers) et voix fluide (agree dans fluidText)', () => {
  assert.match(SRC('js/ui/voice.js'), /tts\.speakResult\(bigNumbers\(agree\(t\)\)(?:, opts)?\)/);
  assert.match(SRC('js/content/voice-lines.js'), /t = agree\(t\);/);
});

/* mots relevés après un nombre dans les exercices (07/10/2026) qui ne sont ni féminins ni masculins à voyelle : noms
   masculins à consonne (rien à changer) et mots qui ne sont pas des noms. Un mot NOUVEAU fait échouer le test : le
   ranger dans FEM_WORDS, MASC_VOWEL ou ici. */
const OTHER = new Set(('et petits fois en pour litres kg est le piquets jusqu’à sachets monte à dixièmes devient sous écrit sur ' +
  'chiffres plus chevaux petit rubans sacs au centièmes poneys milliers moutons moins visiteurs aux h seaux cm de vaut gâteaux ' +
  'millier degrés ne chiens chats la fers dixième sont groupes autres font partagé vient paquets lapins puis millièmes apportés ' +
  'pas devant tours mardi mercredi tapis avec centième dans intervalles qui chiffre sachet blancs légumes goûters noirs piquet ' +
  'fruits millième râteliers chapeaux visiteur million faut-il ou millions').split(' '));

test('chaque nom qui suit un nombre dans les exercices est classé (féminin, masculin à voyelle, ou sans enjeu)', async () => {
  const files = { 'ma.ligne': 'maths/ligne.js', 'ma.faits': 'maths/faits.js', 'ma.procedures': 'maths/procedures.js',
    'ma.operations': 'maths/operations.js', 'ma.problemes': 'maths/problemes.js', 'fr.conjug': 'fr/conjug.js' };
  const seen = new Map();
  const add = (txt, ax) => {
    for (const m of String(txt).matchAll(/(?<![\p{L}\d,])\d+(?:[\s  ]\d{3})*[\s  ]+(?:de |d’)?(\p{L}[\p{L}’'-]*)/gu)) {
      const w = m[1].toLowerCase();
      if (!seen.has(w)) seen.set(w, ax + ' : « ' + m[0] + ' »');
    }
  };
  const walk = (o, ax, d = 0) => { if (d > 5 || o == null) return; if (typeof o === 'string') add(o, ax); else if (Array.isArray(o)) o.forEach(x => walk(x, ax, d + 1)); else if (typeof o === 'object') for (const v of Object.values(o)) walk(v, ax, d + 1); };
  for (const [ax, f] of Object.entries(files)) {
    const G = await import('../js/content/' + f);
    for (let i = 0; i < 1500; i++) { let it; try { it = G.gen((i % 57) / 10, makeRng(ax + i)); } catch (_) { continue; } walk(it, ax); }
  }
  const unknown = [...seen].filter(([w]) => !FEM_WORDS.has(w) && !MASC_VOWEL.has(w) && !OTHER.has(w)).map(([w, ex]) => w + ' (' + ex + ')');
  assert.deepEqual(unknown, [], 'mots à classer');
});
