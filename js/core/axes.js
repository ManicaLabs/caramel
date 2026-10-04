/* ============ RÉFÉRENTIEL DE COMPÉTENCES (CDC v2 §4) ============
   Ids d'axes stables, utilisés partout : moteur, radar, import, rapports.
   Module pur (importable dans Node). */

export const CLASSES = ['CP', 'CE1', 'CE2', 'CM1', 'CM2'];
const ALL = CLASSES;
const FROM_CE1 = ['CE1', 'CE2', 'CM1', 'CM2'];

export const SUBJECTS = {
  fr: { id: 'fr', label: 'Français', emoji: '📖', stroke: '#7f9c97', fill: '#e3ebe9' },
  ma: { id: 'ma', label: 'Mathématiques', emoji: '🔢', stroke: '#e8945a', fill: '#fbe1cc' }
};

/* label = libellé adulte (espace parents) · child = libellé enfant (Mes progrès)
   grades = classes où l'axe figure sur la fiche Repères (CDC §4.1) */
export const AXES = {
  /* ---------- Français ---------- */
  'fr.phono':        { subject: 'fr', label: 'Phonologie', child: 'Jouer avec les sons', emoji: '👂', grades: ['CP', 'CE1'] },
  'fr.lettres':      { subject: 'fr', label: 'Lettres et sons', child: 'Les lettres et leurs sons', emoji: '🔤', grades: ['CP'] },
  'fr.decodage':     { subject: 'fr', label: 'Lire des mots', child: 'Lire des mots', emoji: '🧩', grades: ['CP', 'CE1'] },
  'fr.fluence':      { subject: 'fr', label: 'Lire à voix haute un texte', child: 'Lire à voix haute', emoji: '🎤', grades: ALL },
  'fr.comp_ecrit':   { subject: 'fr', label: 'Comprendre un texte lu', child: 'Comprendre ce que je lis', emoji: '🔎', grades: ALL },
  'fr.comp_oral':    { subject: 'fr', label: 'Comprendre un texte entendu', child: 'Comprendre ce que j’entends', emoji: '📻', grades: ALL },
  'fr.ecrire_syll':  { subject: 'fr', label: 'Écrire des syllabes', child: 'Écrire des syllabes', emoji: '✍️', grades: ['CP', 'CE1'] },
  'fr.ortho':        { subject: 'fr', label: 'Écrire des mots', child: 'Écrire des mots', emoji: '✏️', grades: ALL },
  'fr.vocab':        { subject: 'fr', label: 'Synonymes et familles de mots', child: 'Les mots et leurs familles', emoji: '🌳', grades: FROM_CE1 },
  'fr.constituants': { subject: 'fr', label: 'Sujet, verbe et compléments', child: 'Le sujet et le verbe', emoji: '🚂', grades: FROM_CE1 },
  'fr.classes':      { subject: 'fr', label: 'Nature des mots', child: 'Ranger les mots', emoji: '🧺', grades: FROM_CE1 },
  'fr.accord_gn':    { subject: 'fr', label: 'Accords dans le groupe nominal', child: 'Accorder les mots', emoji: '🦎', grades: FROM_CE1 },
  'fr.conjug':       { subject: 'fr', label: 'Conjugaison et accord du verbe', child: 'Conjuguer les verbes', emoji: '🎻', grades: FROM_CE1 },
  /* ---------- Mathématiques ---------- */
  'ma.denombrer':    { subject: 'ma', label: 'Dénombrer', child: 'Compter des objets', emoji: '🖐️', grades: ['CP'] },
  'ma.nombres':      { subject: 'ma', label: 'Lire et écrire des nombres', child: 'Écrire les nombres', emoji: '🔢', grades: ALL },
  'ma.repres':       { subject: 'ma', label: 'Représentations des nombres', child: 'Les formes des nombres', emoji: '🥧', grades: ALL },
  'ma.ligne':        { subject: 'ma', label: 'Placer un nombre sur une ligne graduée', child: 'La ligne des nombres', emoji: '📏', grades: ALL },
  'ma.faits':        { subject: 'ma', label: 'Faits numériques (tables)', child: 'Les tables', emoji: '🏇', grades: ALL },
  'ma.procedures':   { subject: 'ma', label: 'Calculer rapidement', child: 'Calcul rapide', emoji: '⚡', grades: FROM_CE1 },
  'ma.operations':   { subject: 'ma', label: 'Poser et calculer', child: 'Les opérations', emoji: '🧮', grades: FROM_CE1 },
  'ma.problemes':    { subject: 'ma', label: 'Résoudre des problèmes', child: 'Les problèmes', emoji: '🧠', grades: ALL }
};

export const axisSubject = id => (AXES[id] ? AXES[id].subject : id.split('.')[0]);

/* Axes internes affichés sur le radar « Mes progrès » de chaque classe :
   axes des fiches Repères 2026 (regroupés sur nos ids) + axes entraînés par un jeu dès cette classe. */
export const CLASS_AXES = {
  CP:  { fr: ['fr.comp_oral', 'fr.phono', 'fr.lettres', 'fr.fluence'],
         ma: ['ma.denombrer', 'ma.nombres', 'ma.repres', 'ma.ligne', 'ma.faits', 'ma.procedures', 'ma.problemes'] },
  CE1: { fr: ['fr.comp_ecrit', 'fr.comp_oral', 'fr.decodage', 'fr.fluence', 'fr.ecrire_syll', 'fr.ortho', 'fr.conjug'],
         ma: ['ma.nombres', 'ma.ligne', 'ma.faits', 'ma.procedures', 'ma.operations', 'ma.problemes', 'ma.denombrer'] },
  CE2: { fr: ['fr.comp_ecrit', 'fr.comp_oral', 'fr.vocab', 'fr.ortho', 'fr.constituants', 'fr.classes', 'fr.accord_gn', 'fr.conjug', 'fr.fluence'],
         ma: ['ma.ligne', 'ma.repres', 'ma.operations', 'ma.faits', 'ma.procedures', 'ma.problemes', 'ma.denombrer', 'ma.nombres'] },
  CM1: { fr: ['fr.comp_oral', 'fr.vocab', 'fr.ortho', 'fr.constituants', 'fr.classes', 'fr.accord_gn', 'fr.conjug', 'fr.fluence', 'fr.comp_ecrit'],
         ma: ['ma.repres', 'ma.ligne', 'ma.operations', 'ma.faits', 'ma.procedures', 'ma.problemes', 'ma.nombres'] },
  CM2: { fr: ['fr.comp_oral', 'fr.vocab', 'fr.ortho', 'fr.constituants', 'fr.classes', 'fr.accord_gn', 'fr.conjug', 'fr.fluence', 'fr.comp_ecrit'],
         ma: ['ma.repres', 'ma.faits', 'ma.procedures', 'ma.operations', 'ma.problemes', 'ma.nombres', 'ma.ligne'] }
};
export const axesFor = (classe, subject) =>
  ((CLASS_AXES[classe] || CLASS_AXES.CM2)[subject] || []).slice();
/* AXES[id].grades est dérivé de CLASS_AXES (une seule source de vérité) */
for (const id of Object.keys(AXES)) {
  AXES[id].grades = CLASSES.filter(c => CLASS_AXES[c].fr.includes(id) || CLASS_AXES[c].ma.includes(id));
}

/* ---------- Gabarits radar (CDC §4.3) ----------
   angle en degrés, sens horaire depuis le haut. label = libellé officiel de la fiche,
   domain = rubrique imprimée autour du radar sur la fiche officielle. */
const CM2_FR = [
  { id: 'fr.comp_oral',    angle: 20,  label: 'Comprendre un texte', domain: 'ORAL' },
  { id: 'fr.vocab',        angle: 60,  label: 'Reconnaître des synonymes et des mots de la même famille', domain: 'VOCABULAIRE' },
  { id: 'fr.ortho',        angle: 100, label: 'Écrire des mots', domain: 'VOCABULAIRE' },
  { id: 'fr.constituants', angle: 140, label: 'Repérer le sujet, le verbe et le complément', domain: 'GRAMMAIRE ET ORTHOGRAPHE' },
  { id: 'fr.classes',      angle: 180, label: 'Identifier la nature des mots', domain: 'GRAMMAIRE ET ORTHOGRAPHE' },
  { id: 'fr.accord_gn',    angle: 220, label: 'Accorder le nom et l’adjectif', domain: 'GRAMMAIRE ET ORTHOGRAPHE' },
  { id: 'fr.conjug',       angle: 260, label: 'Maîtriser l’accord du verbe conjugué', domain: 'GRAMMAIRE ET ORTHOGRAPHE' },
  { id: 'fr.fluence',      angle: 300, label: 'Lire à voix haute un texte', domain: 'LECTURE' },
  { id: 'fr.comp_ecrit',   angle: 340, label: 'Comprendre un texte lu', domain: 'LECTURE' }
];
const STEP7 = 360 / 7;
const CM2_MA = [
  { id: 'ma.repres',     angle: STEP7 / 2,           label: 'Utiliser différentes représentations des nombres', domain: 'NOMBRES' },
  { id: 'ma.faits',      angle: STEP7 / 2 + STEP7,   label: 'Connaître les tables de multiplication', domain: 'CALCUL MENTAL' },
  { id: 'ma.procedures', angle: STEP7 / 2 + 2 * STEP7, label: 'Calculer rapidement', domain: 'CALCUL MENTAL' },
  { id: 'ma.operations', angle: 180,                 label: 'Poser et calculer', domain: 'OPÉRATIONS' },
  { id: 'ma.problemes',  angle: STEP7 / 2 + 4 * STEP7, label: 'Résoudre des problèmes', domain: 'RÉSOLUTION DE PROBLÈMES' },
  { id: 'ma.nombres',    angle: STEP7 / 2 + 5 * STEP7, label: 'Écrire des nombres', domain: 'NOMBRES' },
  { id: 'ma.ligne',      angle: STEP7 / 2 + 6 * STEP7, label: 'Placer un nombre sur une ligne graduée', domain: 'NOMBRES' }
];
export const OFFICIAL_TEMPLATES = { CM2: { fr: CM2_FR, ma: CM2_MA } };

/* ---------- Fiches de restitution Repères 2026 (import : saisie manuelle et photo) ----------
   CONVENTION D'ANGLE. Sur les fiches, le haut (repères ⊕ / ⊕⊕ / ⊕⊕⊕) tombe toujours ENTRE deux axes, disposés
   symétriquement. Chaque liste ci-dessous suit la fiche dans le sens horaire en partant de l'axe situé JUSTE À GAUCHE
   du haut : l'axe i est à (i − ½) × pas (pas = 360 / nombre d'axes), soit −pas/2 pour le 1er (334,3° sur une fiche à
   7 axes), +pas/2 pour le 2e (25,7°), etc. Les angles restent croissants, de −pas/2 à 360 − 3·pas/2, sans être ramenés
   dans [0 ; 360[ : radar-detect.js prend le milieu de deux axes consécutifs. Au CM2, angles relevés sur des fiches
   réelles (OFFICIAL_TEMPLATES, gabarits « exacts »).
   ORDRE lu libellé par libellé sur des documents DEPP 2026 (tests/fiches.test.mjs le fige) :
   - maquettes de fiches : diaporama de présentation, p. 30 (CP français, CP maths) ; guide d'accès enseignant au
     portail, p. 32 (CP français, CE1 maths, CE2 français, CM1 maths) ;
   - mini-radars des fiches descriptives pour les parents (education.gouv.fr, juillet 2026) : CE1 français (« Lire à
     voix haute des mots »), CE2 maths (« Placer un nombre sur une ligne graduée »), CM1 français (« Accorder le nom et
     l’adjectif »), et en contrôle CP maths (« Compter des objets ») et CM1 maths (« Reconnaître des nombres »).
   Un axe officiel peut correspondre au même axe interne qu'un autre axe officiel
   (ex. CM1 : « synonymes » et « mots de la même famille » → fr.vocab) : l'import en fait la moyenne. */
const F = (label, domain, id) => ({ label, domain, id });
const FICHES = {
  CM1: {
    fr: [F('Comprendre un texte', 'ORAL', 'fr.comp_oral'), F('Reconnaître des synonymes', 'VOCABULAIRE', 'fr.vocab'),
      F('Reconnaître des mots de la même famille', 'VOCABULAIRE', 'fr.vocab'), F('Écrire des mots', 'VOCABULAIRE', 'fr.ortho'),
      F('Repérer le sujet et le verbe', 'GRAMMAIRE ET ORTHOGRAPHE', 'fr.constituants'), F('Identifier la nature des mots', 'GRAMMAIRE ET ORTHOGRAPHE', 'fr.classes'),
      F('Accorder le nom et l’adjectif', 'GRAMMAIRE ET ORTHOGRAPHE', 'fr.accord_gn'), F('Accorder le sujet et le verbe', 'GRAMMAIRE ET ORTHOGRAPHE', 'fr.conjug'),
      F('Mémoriser des temps de conjugaison', 'GRAMMAIRE ET ORTHOGRAPHE', 'fr.conjug'), F('Lire à voix haute un texte', 'LECTURE', 'fr.fluence'),
      F('Comprendre un texte lu', 'LECTURE', 'fr.comp_ecrit')],
    ma: [F('Reconnaître des nombres', 'NOMBRES', 'ma.repres'), F('Placer un nombre sur une ligne graduée', 'NOMBRES', 'ma.ligne'),
      F('Poser et calculer', 'OPÉRATIONS', 'ma.operations'), F('Connaître les tables de multiplication', 'CALCUL MENTAL', 'ma.faits'),
      F('Calculer rapidement', 'CALCUL MENTAL', 'ma.procedures'), F('Résoudre des problèmes', 'RÉSOLUTION DE PROBLÈMES', 'ma.problemes'),
      F('Écrire des nombres', 'NOMBRES', 'ma.nombres')]
  },
  CE2: {
    fr: [F('Comprendre un texte lu', 'LECTURE', 'fr.comp_ecrit'), F('Comprendre un texte et des phrases', 'ORAL', 'fr.comp_oral'),
      F('Reconnaître des synonymes', 'VOCABULAIRE', 'fr.vocab'), F('Reconnaître des mots de la même famille', 'VOCABULAIRE', 'fr.vocab'),
      F('Écrire des mots', 'VOCABULAIRE', 'fr.ortho'), F('Repérer le sujet et le verbe', 'GRAMMAIRE ET ORTHOGRAPHE', 'fr.constituants'),
      F('Identifier la nature des mots', 'GRAMMAIRE ET ORTHOGRAPHE', 'fr.classes'), F('Accorder le nom et l’adjectif', 'GRAMMAIRE ET ORTHOGRAPHE', 'fr.accord_gn'),
      F('Mémoriser des temps de conjugaison', 'GRAMMAIRE ET ORTHOGRAPHE', 'fr.conjug'), F('Lire à voix haute un texte', 'LECTURE', 'fr.fluence'),
      F('Comprendre des phrases lues', 'LECTURE', 'fr.comp_ecrit')],
    ma: [F('Reconnaître des nombres', 'NOMBRES', 'ma.repres'), F('Placer un nombre sur une ligne graduée', 'NOMBRES', 'ma.ligne'),
      F('Connaître et comprendre les fractions', 'FRACTIONS', 'ma.repres'), F('Poser et calculer', 'OPÉRATIONS', 'ma.operations'),
      F('Connaître les tables d’addition', 'CALCUL MENTAL', 'ma.faits'), F('Calculer rapidement', 'CALCUL MENTAL', 'ma.procedures'),
      F('Résoudre des problèmes', 'PROBLÈMES', 'ma.problemes'), F('Dénombrer des collections', 'NOMBRES', 'ma.denombrer'),
      F('Écrire des nombres', 'NOMBRES', 'ma.nombres')]
  },
  CE1: {
    fr: [F('Lire à voix haute un texte', 'LECTURE', 'fr.fluence'), F('Comprendre des phrases lues', 'LECTURE', 'fr.comp_ecrit'),
      F('Comprendre un texte lu', 'LECTURE', 'fr.comp_ecrit'), F('Écrire des syllabes', 'ÉCRITURE', 'fr.ecrire_syll'),
      F('Comprendre des mots', 'ORAL', 'fr.comp_oral'), F('Comprendre des phrases', 'ORAL', 'fr.comp_oral'),
      F('Écrire des mots', 'VOCABULAIRE', 'fr.ortho'), F('Lire à voix haute des mots', 'LECTURE', 'fr.decodage')],
    ma: [F('Lire des nombres', 'NOMBRES', 'ma.nombres'), F('Écrire des nombres', 'NOMBRES', 'ma.nombres'),
      F('Placer un nombre sur une ligne graduée', 'NOMBRES', 'ma.ligne'), F('Connaître les tables d’addition', 'CALCUL MENTAL', 'ma.faits'),
      F('Calculer rapidement', 'CALCUL MENTAL', 'ma.procedures'), F('Résoudre des problèmes', 'RÉSOLUTION DE PROBLÈMES', 'ma.problemes'),
      F('Dénombrer des collections', 'NOMBRES', 'ma.denombrer')]
  },
  CP: {
    fr: [F('Comprendre des phrases', 'ORAL', 'fr.comp_oral'), F('Comprendre un texte', 'ORAL', 'fr.comp_oral'),
      F('Manipuler des syllabes', 'LECTURE', 'fr.phono'), F('Manipuler des phonèmes', 'LECTURE', 'fr.phono'),
      F('Connaître le nom des lettres', 'LECTURE', 'fr.lettres'), F('Connaître le son des lettres', 'LECTURE', 'fr.lettres'),
      F('Comprendre des mots', 'ORAL', 'fr.comp_oral')],
    ma: [F('Comparer des nombres', 'NOMBRES', 'ma.repres'), F('Lire des nombres', 'NOMBRES', 'ma.nombres'),
      F('Écrire des nombres', 'NOMBRES', 'ma.nombres'), F('Placer un nombre sur une ligne graduée', 'NOMBRES', 'ma.ligne'),
      F('Résoudre des problèmes', 'RÉSOLUTION DE PROBLÈMES', 'ma.problemes'), F('Compter des objets', 'NOMBRES', 'ma.denombrer')]
  }
};
/* gabarit de la FICHE officielle (import) : { classe, subject, exact, axes: [{ id, angle, label, domain }] }.
   exact : angles relevés sur des fiches réelles (CM2) ; sinon axe i à (i − ½) × pas (convention ci-dessus). */
export function ficheTemplate(classe, subject) {
  const off = OFFICIAL_TEMPLATES[classe] && OFFICIAL_TEMPLATES[classe][subject];
  if (off) return { classe, subject, exact: true, axes: off.map(a => ({ ...a })) };
  const list = (FICHES[classe] || FICHES.CM1)[subject];
  const step = 360 / list.length;
  return { classe, subject, exact: false, axes: list.map((a, i) => ({ ...a, angle: (i - 0.5) * step })) };
}
/* valeurs d'une fiche (une par axe officiel, null = absence) → valeurs par axe interne (moyenne) */
export function ficheToAxes(template, values) {
  const acc = {};
  template.axes.forEach((a, i) => {
    const v = values[i];
    if (!acc[a.id]) acc[a.id] = [];
    if (v !== null && v !== undefined && isFinite(v)) acc[a.id].push(v);
  });
  const out = {};
  for (const [id, arr] of Object.entries(acc)) out[id] = arr.length ? Math.round(10 * arr.reduce((s, x) => s + x, 0) / arr.length) / 10 : null;
  return out;
}

/* gabarit du radar « Mes progrès » : officiel au CM2, sinon axes internes de la classe répartis régulièrement
   (ils ne reproduisent pas la fiche : la convention d'angle de ficheTemplate ne s'applique pas ici) */
export function radarTemplate(classe, subject) {
  const off = OFFICIAL_TEMPLATES[classe] && OFFICIAL_TEMPLATES[classe][subject];
  if (off) return { classe, subject, official: true, axes: off.map(a => ({ ...a })) };
  const ids = axesFor(classe, subject);
  const step = 360 / ids.length;
  return {
    classe, subject, official: false,
    axes: ids.map((id, i) => ({ id, angle: step / 2 + i * step, label: AXES[id].label, domain: '' }))
  };
}
