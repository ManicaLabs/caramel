/* Voix et premiers pas (v2.2.1, retour d'un parent sur Android : « 🔊 ne fait rien », « une voix qui explique
   l'interface dès le début ») : champ « déjà vu » des profils, phrase du compagnon à la 1re partie de chaque jeu,
   visite guidée de l'accueil, 🔊 de la course, « Tester la voix » des parents. Prénoms fictifs uniquement. */
import { test, assert } from './_t.mjs';
import { readFileSync } from 'node:fs';
import { normalizeProfile, hasSeen, markSeen } from '../js/core/profiles.js';
import { GAMES } from '../js/games/index.js';
import { frTypo } from '../js/core/util.js';
import { speakable, FAIL_TOAST } from '../js/ui/voice.js';

const SRC = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const code = p => SRC(p).replace(/\/\*[\s\S]*?\*\//g, '');

test('« déjà vu » : absent = rien vu (profils d’avant la 2.2.1 compris), normalisé, jamais une clé dangereuse', () => {
  const p = normalizeProfile({ id: 'p1', name: 'Tom', classe: 'CP' });
  assert.equal('seen' in p, false, 'champ facultatif : pas ajouté d’office');
  assert.equal(hasSeen(p, 'tour'), false);
  assert.equal(hasSeen(p, 'game:pommes'), false);
  markSeen(p, 'tour');
  markSeen(p, 'game:pommes');
  markSeen(p, 'game:__proto__');
  markSeen(p, 'game:Mauvais Id');
  assert.deepEqual(p.seen, { tour: true, games: { pommes: true } });
  assert.equal(hasSeen(p, 'tour'), true);
  assert.equal(hasSeen(p, 'game:pommes'), true);
  assert.equal(hasSeen(p, 'game:cloture'), false);
  markSeen(p, 'tour', false);
  markSeen(p, 'game:pommes', false);
  assert.deepEqual(p.seen, { tour: false, games: {} });
  const q = normalizeProfile({ id: 'p2', name: 'Inès', classe: 'CM2', seen: { tour: 'oui', games: { course: true, tables: 1, 'x y': true }, futur: 3 } });
  assert.deepEqual(q.seen, { tour: false, games: { course: true }, futur: 3 }, 'valeurs illisibles ignorées, clés futures gardées');
  assert.equal(hasSeen(null, 'tour'), false);
  assert.equal(hasSeen({ seen: [] }, 'tour'), false);
});

/* GAME_HELLO lu dans la source (game-shell.js touche au DOM) */
function hellos() {
  const m = /export const GAME_HELLO = Object\.freeze\((\{[\s\S]*?\})\);/.exec(SRC('js/ui/game-shell.js'));
  assert.ok(m, 'GAME_HELLO introuvable');
  return Function('return ' + m[1])();
}
test('1re partie : une phrase du compagnon pour chaque jeu qui ne se présente pas lui-même', () => {
  const H = hellos();
  const own = GAMES.filter(g => /intro:\s*true/.test(code('js/games/' + g.id + '.js'))).map(g => g.id);
  assert.deepEqual(own, ['orchestre'], 'l’orchestre a sa propre intro (une fois par séance)');
  for (const g of GAMES) {
    if (own.includes(g.id)) { assert.equal(H[g.id], undefined, g.id); continue; }
    const t = H[g.id];
    assert.ok(typeof t === 'string' && t.length > 20 && t.length <= 110, g.id + ' : phrase courte');
    assert.equal(t.match(/[.!?…]/g).length, 1, g.id + ' : UNE phrase');
    assert.match(t, /[.!]$/, g.id);
    assert.doesNotMatch(t, /'/, g.id + ' : apostrophe typographique');
    assert.doesNotMatch(t, /\bvous\b/, g.id + ' : tutoiement côté enfant');
    if (/[:!?]/.test(t)) assert.match(frTypo(t), /\u202f[:!?]/, g.id + ' : espace fine avant « : » et « ! » (frTypo)');
  }
  const shell = code('js/ui/game-shell.js');
  assert.match(shell, /!mod\.intro && GAME_HELLO\[id\] && !hasSeen\(seenBy, 'game:' \+ id\)/);
  assert.match(shell, /markSeen\(pp, 'game:' \+ id\)/, 'mémorisé au toucher de « C’est parti »');
  assert.match(shell, /if \(playedBefore\(seenBy, id\) && !\(seenBy\.seen && seenBy\.seen\.again === true\)\) \{\s*try \{ store\.mutateProfile\(pp => \{ markSeen\(pp, 'game:' \+ id\); \}\)/,
    'déjà joué : pas de phrase, noté « déjà vu » (sauf après « Revoir la visite guidée »)');
  assert.match(code('js/games/orchestre.js'), /say\(title \+ ' ' \+ story\)/, 'l’intro de l’orchestre est dite');
});

test('1re partie : pas de phrase pour un enfant qui a déjà joué au jeu (profils d’avant la 2.2.1)', () => {
  const m = /export function playedBefore\(profile, id\) \{([\s\S]*?)\n\}/.exec(SRC('js/ui/game-shell.js'));
  assert.ok(m, 'playedBefore introuvable');
  const playedBefore = Function('profile', 'id', m[1]);
  const zoe = normalizeProfile({ id: 'p1', name: 'Zoé', classe: 'CM2',
    history: [{ d: '2026-09-12', t: 1, g: 'tables', ax: 'ma.faits', n: 10, ok: 9, hint: 1 }] });
  assert.equal(hasSeen(zoe, 'game:tables'), false, 'pas de « déjà vu » : profil d’avant la 2.2.1');
  assert.equal(playedBefore(zoe, 'tables'), true);
  assert.equal(playedBefore(zoe, 'pommes'), false, 'autre jeu : la phrase reste');
  assert.equal(playedBefore(zoe, 'course'), false);
  const lea = normalizeProfile({ id: 'p2', name: 'Léa', classe: 'CE1', wallet: { apples: 3, stars: { pomme: 2 } } });
  assert.equal(playedBefore(lea, 'course'), true, 'une histoire déjà lue (⭐, v11 comprise)');
  assert.equal(playedBefore(lea, 'tables'), false);
  assert.equal(playedBefore(normalizeProfile({ id: 'p3', name: 'Tom', classe: 'CP' }), 'course'), false, 'nouvel enfant');
  assert.equal(playedBefore(null, 'tables'), false);
  assert.equal(playedBefore({ history: [null, 3] }, 'tables'), false);
  /* « Revoir la visite guidée » (parents) : seen.again, gardé seulement s'il vaut true */
  const parents = code('js/ui/parents.js');
  assert.match(parents, /markSeen\(q, 'tour', false\);\s*for \(const g of [^\n]+markSeen\(q, 'game:' \+ g, false\);\s*q\.seen\.again = true;/);
  markSeen(zoe, 'tour', false);
  zoe.seen.again = true;
  const z2 = normalizeProfile(zoe);
  assert.deepEqual(z2.seen, { tour: false, games: {}, again: true });
  assert.deepEqual(normalizeProfile({ id: 'p4', name: 'Tom', seen: { tour: true, games: {}, again: 'oui' } }).seen, { tour: true, games: {}, again: false });
  assert.equal('again' in normalizeProfile({ id: 'p5', name: 'Tom', seen: { tour: true } }).seen, false, 'absent : pas ajouté');
});

test('visite guidée : 3 étapes au plus, une chose à la fois, mémorisée par enfant, jamais pendant le bandeau', () => {
  const home = code('js/ui/home.js');
  const steps = [...home.matchAll(/\{ target: [^,]+, text: f\((?:again \? )?'([^']+)'/g)].map(m => m[1]);
  assert.ok(steps.length >= 4, 'étapes trouvées');
  assert.ok(steps.some(t => /^Coucou \{P\} ! Moi, c’est \{N\}\.$/.test(t)), 'le compagnon se présente');
  assert.match(home, /markSeen\(pp, 'tour'\)/);
  assert.match(home, /reason === 'done' \|\| reason === 'skip'/, 'Passer compte comme vue ; fermée par la navigation : elle reviendra');
  assert.match(home, /barShown\(\)/, 'bandeau de mise à jour surveillé');
  assert.match(home, /guard: \(\) => my === st && !barShown\(\)/);
  assert.match(home, /voice\.needsGesture\(\)/, 'phrase dite au premier geste quand l’appli s’ouvre directement sur l’accueil');
  const kit = code('js/ui/kit.js');
  assert.match(kit, /export function tour\(/);
  assert.match(kit, /role: 'dialog', 'aria-modal': 'true'/);
  assert.match(kit, /e\.key === 'Escape'/);
  assert.match(SRC('css/ui/kit.css'), /@media \(prefers-reduced-motion: reduce\) \{\n  \.kit-tour\.is-ready \.kit-tour-hole/);
});

test('🔊 jamais muet : la course pose sa consigne et sa question, se tait pendant la lecture ; panne dite une fois', () => {
  const c = code('js/games/course.js');
  assert.match(c, /ctx\.voice\.say\(TXT\.go\)/, 'consigne à l’ouverture d’une histoire');
  assert.match(c, /ctx\.voice\.hush\(\)\);[^\n]*\n\s*safe\(\(\) => ctx\.voice\.say\(''\)\);/, '🔊 caché dès que le micro démarre');
  assert.match(c, /ctx\.voice\.say\(frTypo\('Petite question : '/);
  assert.equal(speakable('Coucou Tom ! Moi, c’est Caramel.'), 'Coucou Tom! Moi, c’est Caramel.');
  assert.equal(speakable(frTypo('Paramètres › Accessibilité')), 'Paramètres Accessibilité');
  assert.match(FAIL_TOAST, /^Je n’arrive pas à parler sur cet appareil/);
  assert.match(FAIL_TOAST, /espace parents/);
  const v = code('js/ui/voice.js');
  assert.match(v, /if \(my !== seq \|\| !failed\(r\) \|\| warned\) return;\s*warned = true;/, 'toast une seule fois par séance');
});

test('espace parents : « ▶ Tester la voix » à côté du réglage, marche à suivre Android, « Revoir la visite guidée »', () => {
  const p = code('js/ui/parents.js');
  assert.match(p, /voiceTest\(p\)\)\);\n  card\.appendChild\(tourRow\(p\)\);/);
  assert.match(SRC('js/ui/parents.js'), /Paramètres › Accessibilité › Synthèse vocale/);
  assert.match(p, /'Tester la voix'/);
  assert.match(p, /'Revoir la visite guidée'/);
  assert.match(p, /La voix fonctionne ✓/);
  assert.match(p, /markSeen\(q, 'tour', false\)/);
});
