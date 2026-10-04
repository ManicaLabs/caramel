/* Gabarits des fiches de restitution Repères 2026 (js/core/axes.js, ficheTemplate) : convention d'angle et ordre des
   compétences, figés d'après les documents de la DEPP. Angles en degrés, sens horaire depuis le haut ; sur les fiches,
   le haut (repères ⊕) tombe toujours entre deux axes, disposés symétriquement.
   Sources, lues libellé par libellé :
   - maquettes de fiches « Septembre 2026 » : diaporama de présentation p. 30 (CP français, CP maths), guide d'accès
     enseignant au portail p. 32 (CP français, CE1 maths, CE2 français, CM1 maths) ;
   - mini-radars des fiches descriptives pour les parents (education.gouv.fr, juillet 2026) : CE1 français, CE2 maths,
     CM1 français (et, en contrôle, CP maths et CM1 maths : même ordre que les maquettes) ;
   - CM2 : fiches réelles (gabarits « exacts », hors convention).
   Régression visée (v2.0) : 1er axe de chaque liste à +pas/2 au lieu de −pas/2 ; hors CE2 maths (dont la liste partait
   de l'axe à droite du haut), chaque valeur, saisie à la main ou lue sur la photo, était rangée sous la compétence
   voisine ; l'ordre du CP maths et du CE1 français ne suivait pas la fiche. */
import { test, assert } from './_t.mjs';
import { ficheTemplate, ficheToAxes, AXES, CLASSES } from '../js/core/axes.js';

const norm = a => ((a % 360) + 360) % 360;
const gap = (a, b) => Math.abs(((norm(a) - norm(b)) % 360 + 540) % 360 - 180);
const SUBJ = ['fr', 'ma'];
const NOT_CM2 = CLASSES.filter(c => c !== 'CM2');

/* Libellés imprimés autour du radar, dans le sens horaire, en partant de l'axe juste à gauche du haut. */
const FICHES_2026 = {
  'CP fr': ['Comprendre des phrases', 'Comprendre un texte', 'Manipuler des syllabes', 'Manipuler des phonèmes',
    'Connaître le nom des lettres', 'Connaître le son des lettres', 'Comprendre des mots'],
  'CP ma': ['Comparer des nombres', 'Lire des nombres', 'Écrire des nombres', 'Placer un nombre sur une ligne graduée',
    'Résoudre des problèmes', 'Compter des objets'],
  'CE1 fr': ['Lire à voix haute un texte', 'Comprendre des phrases lues', 'Comprendre un texte lu', 'Écrire des syllabes',
    'Comprendre des mots', 'Comprendre des phrases', 'Écrire des mots', 'Lire à voix haute des mots'],
  'CE1 ma': ['Lire des nombres', 'Écrire des nombres', 'Placer un nombre sur une ligne graduée', 'Connaître les tables d’addition',
    'Calculer rapidement', 'Résoudre des problèmes', 'Dénombrer des collections'],
  'CE2 fr': ['Comprendre un texte lu', 'Comprendre un texte et des phrases', 'Reconnaître des synonymes',
    'Reconnaître des mots de la même famille', 'Écrire des mots', 'Repérer le sujet et le verbe', 'Identifier la nature des mots',
    'Accorder le nom et l’adjectif', 'Mémoriser des temps de conjugaison', 'Lire à voix haute un texte', 'Comprendre des phrases lues'],
  'CE2 ma': ['Reconnaître des nombres', 'Placer un nombre sur une ligne graduée', 'Connaître et comprendre les fractions',
    'Poser et calculer', 'Connaître les tables d’addition', 'Calculer rapidement', 'Résoudre des problèmes',
    'Dénombrer des collections', 'Écrire des nombres'],
  'CM1 fr': ['Comprendre un texte', 'Reconnaître des synonymes', 'Reconnaître des mots de la même famille', 'Écrire des mots',
    'Repérer le sujet et le verbe', 'Identifier la nature des mots', 'Accorder le nom et l’adjectif', 'Accorder le sujet et le verbe',
    'Mémoriser des temps de conjugaison', 'Lire à voix haute un texte', 'Comprendre un texte lu'],
  'CM1 ma': ['Reconnaître des nombres', 'Placer un nombre sur une ligne graduée', 'Poser et calculer',
    'Connaître les tables de multiplication', 'Calculer rapidement', 'Résoudre des problèmes', 'Écrire des nombres']
};

/* Repères relevés sur les images (angle de l'axe imprimé, ±0,5°) : un axe en haut à gauche, un en haut à droite et,
   quand il existe, celui du bas (180°). */
const REPERES = {
  'CM1 ma': [['Reconnaître des nombres', 334.29], ['Placer un nombre sur une ligne graduée', 25.71], ['Calculer rapidement', 180],
    ['Écrire des nombres', 282.86]],
  'CE1 ma': [['Lire des nombres', 334.29], ['Écrire des nombres', 25.71], ['Calculer rapidement', 180]],
  'CP fr': [['Comprendre des phrases', 334.29], ['Comprendre un texte', 25.71], ['Connaître le nom des lettres', 180]],
  'CP ma': [['Comparer des nombres', 330], ['Lire des nombres', 30], ['Écrire des nombres', 90], ['Compter des objets', 270]],
  'CE2 fr': [['Comprendre un texte lu', 343.64], ['Comprendre un texte et des phrases', 16.36], ['Identifier la nature des mots', 180]],
  'CE2 ma': [['Reconnaître des nombres', 340], ['Placer un nombre sur une ligne graduée', 20], ['Calculer rapidement', 180]],
  'CE1 fr': [['Lire à voix haute un texte', 337.5], ['Comprendre des phrases lues', 22.5], ['Lire à voix haute des mots', 292.5]],
  'CM1 fr': [['Comprendre un texte', 343.64], ['Reconnaître des synonymes', 16.36], ['Accorder le nom et l’adjectif', 180]]
};

test('fiches hors CM2 : axe i à (i − ½) × pas, 1er axe juste à gauche du haut', () => {
  for (const c of NOT_CM2) for (const s of SUBJ) {
    const t = ficheTemplate(c, s), n = t.axes.length, step = 360 / n;
    assert.equal(t.exact, false, c + s);
    t.axes.forEach((a, i) => assert.ok(Math.abs(a.angle - (i - 0.5) * step) < 1e-9, `${c} ${s} axe ${i} : ${a.angle}`));
    /* angles croissants, sans retour à 0 (radar-detect.js prend le milieu de deux axes consécutifs) */
    for (let i = 1; i < n; i++) assert.ok(t.axes[i].angle > t.axes[i - 1].angle, c + s);
    assert.ok(Math.abs(t.axes[0].angle + step / 2) < 1e-9 && t.axes[n - 1].angle < 360 - step);
    /* le haut tombe entre deux axes, disposés symétriquement de part et d'autre */
    for (const a of t.axes) {
      assert.ok(gap(a.angle, 0) > step / 2 - 1e-6, `${c} ${s} : axe à ${a.angle}° trop près du haut`);
      assert.ok(t.axes.some(b => gap(b.angle, -a.angle) < 1e-6), `${c} ${s} : pas de symétrique pour ${a.angle}°`);
    }
  }
});

test('ordre des compétences : celui des fiches 2026, pour les 8 fiches de CP à CM1', () => {
  assert.deepEqual(Object.keys(FICHES_2026).sort(), NOT_CM2.flatMap(c => SUBJ.map(s => c + ' ' + s)).sort());
  for (const [key, labels] of Object.entries(FICHES_2026)) {
    const [c, s] = key.split(' ');
    assert.deepEqual(ficheTemplate(c, s).axes.map(a => a.label), labels, key);
  }
});

test('repères relevés sur les images : chaque libellé sur son axe (CM1 maths : 334,3° et 25,7°)', () => {
  for (const [key, expected] of Object.entries(REPERES)) {
    const [c, s] = key.split(' ');
    const t = ficheTemplate(c, s);
    for (const [label, angle] of expected) {
      const a = t.axes.find(x => x.label === label);
      assert.ok(a, `${key} : « ${label} » absent du gabarit`);
      assert.ok(gap(a.angle, angle) < 0.05, `${key} : « ${label} » à ${norm(a.angle).toFixed(2)}°, attendu ${angle}°`);
    }
  }
  /* repères cités dans le rapport de bogue : CM1 maths, 1er axe ≈ 334,3°, « Placer un nombre » ≈ 25,7° */
  const cm1 = ficheTemplate('CM1', 'ma');
  assert.ok(gap(cm1.axes[0].angle, 334.3) < 0.05 && cm1.axes[0].label === 'Reconnaître des nombres');
  assert.ok(gap(cm1.axes[1].angle, 25.7) < 0.05 && cm1.axes[1].label === 'Placer un nombre sur une ligne graduée');
});

test('CP maths : ordre de la fiche, axes internes et angles', () => {
  const t = ficheTemplate('CP', 'ma');
  assert.deepEqual(t.axes.map(a => a.label), ['Comparer des nombres', 'Lire des nombres', 'Écrire des nombres',
    'Placer un nombre sur une ligne graduée', 'Résoudre des problèmes', 'Compter des objets']);
  assert.deepEqual(t.axes.map(a => a.id), ['ma.repres', 'ma.nombres', 'ma.nombres', 'ma.ligne', 'ma.problemes', 'ma.denombrer']);
  assert.deepEqual(t.axes.map(a => Math.round(norm(a.angle))), [330, 30, 90, 150, 210, 270]);
});

test('rubriques et axes internes : cohérents sur toutes les fiches', () => {
  const DOMAINS = { fr: ['ORAL', 'LECTURE', 'ÉCRITURE', 'VOCABULAIRE', 'GRAMMAIRE ET ORTHOGRAPHE'],
    ma: ['NOMBRES', 'FRACTIONS', 'OPÉRATIONS', 'CALCUL MENTAL', 'RÉSOLUTION DE PROBLÈMES', 'PROBLÈMES'] };
  for (const c of CLASSES) for (const s of SUBJ) {
    const t = ficheTemplate(c, s);
    assert.equal(new Set(t.axes.map(a => a.label)).size, t.axes.length, c + s);
    for (const a of t.axes) {
      assert.ok(AXES[a.id] && AXES[a.id].subject === s, `${c} ${s} : ${a.id}`);
      assert.ok(DOMAINS[s].includes(a.domain), `${c} ${s} : rubrique « ${a.domain} »`);
    }
    /* une rubrique occupe des axes voisins (arc continu sur la fiche) */
    const runs = t.axes.map(a => a.domain).filter((d, i, arr) => d !== arr[(i + arr.length - 1) % arr.length]);
    assert.equal(runs.length, new Set(runs).size, `${c} ${s} : rubrique coupée en deux (${runs.join(', ')})`);
  }
});

test('CM2 : gabarits exacts (fiches réelles) inchangés', () => {
  const fr = ficheTemplate('CM2', 'fr'), ma = ficheTemplate('CM2', 'ma');
  assert.ok(fr.exact && ma.exact);
  assert.deepEqual(fr.axes.map(a => a.angle), [20, 60, 100, 140, 180, 220, 260, 300, 340]);
  const at = (t, label) => norm(t.axes.find(a => a.label === label).angle);
  assert.equal(at(fr, 'Comprendre un texte'), 20);
  assert.equal(at(fr, 'Comprendre un texte lu'), 340);
  assert.ok(gap(at(ma, 'Utiliser différentes représentations des nombres'), 25.71) < 0.05);
  assert.equal(at(ma, 'Poser et calculer'), 180);
  assert.ok(gap(at(ma, 'Placer un nombre sur une ligne graduée'), 334.29) < 0.05);
});

/* Valeurs relevées sur les maquettes, axe par axe (angle de l'axe imprimé → θ). Un lecteur de photo lit chaque axe à
   l'angle du gabarit : la valeur doit arriver sous le libellé IMPRIMÉ sur cet axe. */
const MOCK_VALUES = {
  'CM1 ma': { 334.29: 2.26, 25.71: 2.17, 77.14: 2.34, 128.57: 2.08, 180: 2.06, 231.43: 2.26, 282.86: 2.5 },
  'CP fr': { 334.29: 1, 25.71: 1.99, 77.14: 3, 128.57: 1, 180: 3, 231.43: 2, 282.86: 2 }
};
const readByAngle = (t, byAngle) => t.axes.map(a => {
  const k = Object.keys(byAngle).find(x => gap(Number(x), a.angle) < 0.5);
  return k === undefined ? undefined : byAngle[k];
});

test('lecture d’une maquette par angle : chaque valeur sous sa compétence', () => {
  const cm1 = ficheTemplate('CM1', 'ma');
  const v1 = readByAngle(cm1, MOCK_VALUES['CM1 ma']);
  const lab1 = Object.fromEntries(cm1.axes.map((a, i) => [a.label, v1[i]]));
  assert.equal(lab1['Reconnaître des nombres'], 2.26);
  assert.equal(lab1['Placer un nombre sur une ligne graduée'], 2.17);
  assert.equal(lab1['Écrire des nombres'], 2.5);
  assert.deepEqual(ficheToAxes(cm1, v1), { 'ma.repres': 2.3, 'ma.ligne': 2.2, 'ma.operations': 2.3, 'ma.faits': 2.1,
    'ma.procedures': 2.1, 'ma.problemes': 2.3, 'ma.nombres': 2.5 });

  const cp = ficheTemplate('CP', 'fr');
  const v2 = readByAngle(cp, MOCK_VALUES['CP fr']);
  const lab2 = Object.fromEntries(cp.axes.map((a, i) => [a.label, v2[i]]));
  /* v2.0 : « Manipuler des syllabes » recevait 1,0 (la valeur des phonèmes) au lieu de 3,0 */
  assert.equal(lab2['Manipuler des syllabes'], 3);
  assert.equal(lab2['Manipuler des phonèmes'], 1);
  assert.equal(lab2['Comprendre des phrases'], 1);
  assert.deepEqual(ficheToAxes(cp, v2), { 'fr.comp_oral': 1.7, 'fr.phono': 2, 'fr.lettres': 2.5 });
});
