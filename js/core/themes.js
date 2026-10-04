/* ============ THÈMES VISUELS (CDC v2 §15, version 2.1) ============
   Module pur (aucun accès au DOM au chargement : importable dans Node).
   Un thème habille l'INTERFACE (fonds, encres, titres, boutons, bordures, pastilles, motif de fond discret,
   emojis de fête) ; les décors naturels des jeux (ciel, herbe, bois, eau, animaux, piste) ne changent pas.
   Les COULEURS vivent dans css/themes.css (jetons surchargés par [data-theme="…"]) : ce module ne porte que
   ce dont le JavaScript a besoin (nom, emoji, couleur de la barre d'état, emojis de fête, autocollant).
   Réglage par profil : profile.settings.theme (normalizeTheme dans profiles.js), appliqué par main.js
   (html[data-theme] + <meta name="theme-color">, via js/ui/theme-picker.js).
   Aucun thème n'est réservé à un genre : defaultThemeFor ne fait que PRÉSÉLECTIONNER à la création. */

export const DEFAULT_THEME = 'caramel';

/* id · nom (neutre) · emoji · blurb (aria, réglages parents) · bar = couleur de la barre d'état (= --bg-1)
   · party = emojis des confettis (motion.confetti par défaut) · sticker = pastille sur l'avatar de l'accueil */
export const THEMES = Object.freeze([
  { id: 'caramel', name: 'Caramel', emoji: '🐴', blurb: 'Crème, rose et miel', bar: '#fff1f5',
    party: ['🎉', '⭐', '✨', '💛', '🌸'], sticker: '' },
  { id: 'licorne', name: 'Licorne', emoji: '🦄', blurb: 'Lavande, rose et arc-en-ciel', bar: '#fbf4ff',
    party: ['🦄', '🌈', '✨', '💖', '⭐'], sticker: '🦄' },
  { id: 'princesse', name: 'Princesse', emoji: '👑', blurb: 'Violet, fuchsia et or', bar: '#fbf3ff',
    party: ['👑', '💎', '✨', '💜', '🌟'], sticker: '👑' },
  { id: 'superheros', name: 'Super-héros', emoji: '🦸', blurb: 'Bleu roi, rouge et éclairs', bar: '#eff5ff',
    party: ['⚡', '💥', '⭐', '🌟', '💫'], sticker: '⚡' },
  { id: 'dinosaures', name: 'Dinosaures', emoji: '🦖', blurb: 'Feuillages, terre et volcans', bar: '#f3f9ea',
    party: ['🦖', '🦕', '🌿', '🌋', '⭐'], sticker: '🦖' },
  { id: 'bolides', name: 'Bolides', emoji: '🏎️', blurb: 'Bleu course, rouge et damier', bar: '#f1f4f8',
    party: ['🏎️', '🏁', '🏆', '⭐', '💨'], sticker: '🏁' },
  { id: 'espace', name: 'Espace', emoji: '🚀', blurb: 'Nuit douce, étoiles et planètes', bar: '#f2f0ff',
    party: ['🚀', '🪐', '⭐', '🌟', '☄️'], sticker: '🚀' },
  { id: 'ocean', name: 'Océan', emoji: '🐳', blurb: 'Turquoise, sable et corail', bar: '#ecfbfd',
    party: ['🐳', '🐠', '🐚', '🌊', '⭐'], sticker: '🐚' }
].map(t => Object.freeze({ ...t, party: Object.freeze(t.party) })));

export const THEME_IDS = Object.freeze(THEMES.map(t => t.id));
const BY_ID = new Map(THEMES.map(t => [t.id, t]));

/* id lisible → id connu ; tout le reste (absent, inconnu, mauvais type) → 'caramel' */
export function normalizeTheme(id) {
  const k = typeof id === 'string' ? id.trim().toLowerCase() : '';
  return BY_ID.has(k) ? k : DEFAULT_THEME;
}
export const isTheme = id => typeof id === 'string' && BY_ID.has(id);

/* fiche du thème (toujours un thème valide) */
export function themeOf(id) { return BY_ID.get(normalizeTheme(id)); }

/* présélection à la création d'un profil : fille → Caramel, garçon → Dinosaures (l'enfant choisit ensuite librement) */
export function defaultThemeFor(g) {
  return g === 'm' ? 'dinosaures' : DEFAULT_THEME;
}
