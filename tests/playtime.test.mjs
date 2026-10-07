/* Temps de jeu du jour (v2.4, retour du parent du 07/10/2026 : « une limite d'une heure par défaut ; passé la limite,
   les jeux sont grisés et Caramel s'endort ») : calcul (js/core/playtime.js), textes et décisions des écrans
   (js/ui/play-limit.js), garde-fous à chaque endroit qui lance un jeu. Prénoms fictifs uniquement. */
import { test, assert } from './_t.mjs';
import { readFileSync } from 'node:fs';
import {
  DAILY_OPTIONS, DAILY_DEFAULT, BONUS_STEP, NEAR_MIN, normDailyMin, minutesToday, bonusToday, playState, withBonus, napOrNight
} from '../js/core/playtime.js';
import {
  REST_TEXT, playNow, timeUp, restKind, awake, restLine, restWhy, nearLine, restingPets, familyRest, durLabel, dailyLabel,
  BONUS_LABEL, parentLine
} from '../js/ui/play-limit.js';
import { defaultProfile, normalizeProfile } from '../js/core/profiles.js';

const SRC = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const code = p => SRC(p).replace(/\/\*[\s\S]*?\*\//g, '');
const TODAY = '2026-10-07';
const MIN = 60000;
const NNBSP = '\u202F';

/* un enfant avec ses parties du jour (minutes) ; autres jours, bonus et réglages au choix */
function kid({ name = 'Léa', pet = 'Noisette', today = [], other = [], dailyMin, bonus } = {}) {
  const p = defaultProfile({ id: 'p' + name, name, classe: 'CE2', today: TODAY });
  p.companion.name = pet;
  p.history = [
    ...other.map((m, i) => ({ d: '2026-10-06', t: i, g: 'tables', ax: 'ma.faits', n: 10, ok: 8, hint: 0, ms: m * MIN, th: 1.5, mode: 'libre' })),
    ...today.map((m, i) => ({ d: TODAY, t: 100 + i, g: 'tables', ax: 'ma.faits', n: 10, ok: 8, hint: 0, ms: m * MIN, th: 1.5, mode: 'libre' }))
  ];
  if (dailyMin !== undefined) p.settings.dailyMin = dailyMin;
  if (bonus) p.playBonus = bonus;
  return p;
}

test('réglage : 30, 45, 60, 90, 120 min ou sans limite (0) ; 1 h par défaut, toute autre valeur → 1 h', () => {
  assert.deepEqual([...DAILY_OPTIONS], [30, 45, 60, 90, 120, 0]);
  assert.equal(DAILY_DEFAULT, 60);
  assert.equal(BONUS_STEP, 15);
  assert.equal(NEAR_MIN, 5);
  for (const v of DAILY_OPTIONS) assert.equal(normDailyMin(v), v);
  assert.equal(normDailyMin('90'), 90, 'nombre écrit en texte');
  for (const v of [undefined, 'abc', 61, -30, 999, NaN, {}, true]) assert.equal(normDailyMin(v), 60, String(v));
  /* profil neuf, profil d'avant la 2.4 (réglage absent), valeur inconnue : 1 h */
  assert.equal(defaultProfile({ id: 'p1', name: 'Léa', today: TODAY }).settings.dailyMin, 60);
  const old = defaultProfile({ id: 'p1', name: 'Léa', today: TODAY });
  delete old.settings.dailyMin;
  assert.equal(normalizeProfile(old, TODAY).settings.dailyMin, 60);
  old.settings.dailyMin = 37;
  assert.equal(normalizeProfile(old, TODAY).settings.dailyMin, 60);
  old.settings.dailyMin = 0;
  assert.equal(normalizeProfile(old, TODAY).settings.dailyMin, 0, 'sans limite gardé');
});

test('minutes du jour : seulement les parties d’aujourd’hui (history[].ms), jamais une valeur folle', () => {
  assert.equal(minutesToday(kid({ today: [12, 18.5], other: [200] }), TODAY), 30.5);
  assert.equal(minutesToday(kid({ other: [200] }), TODAY), 0, 'la veille ne compte pas');
  const p = kid({ today: [10] });
  p.history.push({ d: TODAY, ms: -5 * MIN }, { d: TODAY, ms: NaN }, { d: TODAY }, null, { d: TODAY, ms: Infinity });
  assert.equal(minutesToday(p, TODAY), 10, 'négatif, NaN, absent, infini ignorés');
  for (const bad of [null, undefined, {}, { history: 'x' }]) assert.equal(minutesToday(bad, TODAY), 0);
  /* le contrat de la manche : chaque partie finie ou abandonnée écrit d, ms dans l'historique */
  assert.match(code('js/core/manche.js'), /p\.history\.push\(\{ d: today, t, g: gameId,[^}]*ms: s\.ms/);
});

test('limite : 1 h par défaut ; atteinte à 60 min pile ; « presque » à 5 min de la fin', () => {
  let s = playState(kid({ today: [20, 20] }), TODAY);
  assert.deepEqual(s, { limit: 60, used: 40, bonus: 0, left: 20, over: false, near: false, unlimited: false });
  s = playState(kid({ today: [55] }), TODAY);
  assert.equal(s.near, true);
  assert.equal(s.over, false);
  assert.equal(s.left, 5);
  s = playState(kid({ today: [54.9] }), TODAY);
  assert.equal(s.near, false, '5,1 min restantes : pas encore');
  s = playState(kid({ today: [60] }), TODAY);
  assert.equal(s.over, true);
  assert.equal(s.near, false, 'atteint : plus « presque »');
  assert.equal(s.left, 0);
  s = playState(kid({ today: [45, 40] }), TODAY);
  assert.equal(s.over, true);
  assert.equal(s.left, 0, 'jamais négatif');
  /* une partie commencée se finit : le temps dépassé n'est jamais retiré au lendemain */
  assert.equal(playState(kid({ other: [180] }), TODAY).over, false);
  /* réglage du parent */
  assert.equal(playState(kid({ today: [31] , dailyMin: 30 }), TODAY).over, true);
  assert.equal(playState(kid({ today: [100], dailyMin: 120 }), TODAY).left, 20);
});

test('sans limite : jamais atteint, jamais « presque »', () => {
  const s = playState(kid({ today: [180, 200], dailyMin: 0 }), TODAY);
  assert.equal(s.unlimited, true);
  assert.equal(s.over, false);
  assert.equal(s.near, false);
  assert.equal(s.left, Infinity);
  assert.equal(s.used, 380);
  assert.equal(timeUp(kid({ today: [500], dailyMin: 0 }), TODAY), false);
});

test('« Encore 15 minutes aujourd’hui » : cumulable dans la journée, oublié le lendemain', () => {
  const p = kid({ today: [60] });
  assert.equal(playState(p, TODAY).over, true);
  p.playBonus = withBonus(p, TODAY);
  assert.deepEqual(p.playBonus, { d: TODAY, min: 15 });
  let s = playState(p, TODAY);
  assert.equal(s.over, false);
  assert.equal(s.bonus, 15);
  assert.equal(s.left, 15);
  p.playBonus = withBonus(p, TODAY);
  assert.deepEqual(p.playBonus, { d: TODAY, min: 30 }, 'deuxième toucher : cumulé');
  assert.equal(playState(p, TODAY).left, 30);
  /* le lendemain : le bonus de la veille ne compte plus et repart de zéro */
  assert.equal(bonusToday(p, '2026-10-08'), 0);
  assert.deepEqual(withBonus(p, '2026-10-08'), { d: '2026-10-08', min: 15 });
  /* valeurs folles */
  assert.deepEqual(withBonus(p, TODAY, -10), { d: TODAY, min: 30 });
  assert.deepEqual(withBonus(p, TODAY, 'x'), { d: TODAY, min: 30 });
  assert.equal(bonusToday({ playBonus: { d: TODAY, min: 12.8 } }, TODAY), 12);
  assert.equal(bonusToday({ playBonus: { d: TODAY, min: -4 } }, TODAY), 0);
  assert.equal(bonusToday({}, TODAY), 0);
  /* le profil garde playBonus (normalisé), un profil d'avant la 2.4 n'en a pas */
  const n = normalizeProfile(Object.assign(kid(), { playBonus: { d: TODAY, min: 15.6 } }), TODAY);
  assert.deepEqual(n.playBonus, { d: TODAY, min: 15 });
  assert.equal('playBonus' in normalizeProfile(kid(), TODAY), false);
});

test('le compagnon s’endort : la sieste le jour, la nuit au crépuscule et la nuit', () => {
  assert.equal(napOrNight('day'), 'sieste');
  assert.equal(napOrNight('dawn'), 'sieste');
  assert.equal(napOrNight('dusk'), 'nuit');
  assert.equal(napOrNight('night'), 'nuit');
  assert.equal(napOrNight('day', true), 'nuit', '22 h - 7 h : la nuit du compagnon');
  /* ciel de companion-life.js (heure locale) */
  assert.equal(restKind(new Date(2026, 9, 7, 14, 0)), 'sieste');
  assert.equal(restKind(new Date(2026, 9, 7, 10, 30)), 'sieste');
  assert.equal(restKind(new Date(2026, 9, 7, 21, 0)), 'nuit');
  assert.equal(restKind(new Date(2026, 9, 7, 23, 30)), 'nuit');
  assert.equal(restKind(new Date(2026, 9, 7, 6, 0)), 'nuit');
});

test('textes de l’enfant : doux, sans reproche, typographie française, le nom du compagnon', () => {
  const p = kid({ today: [60] });
  assert.equal(restLine(p), 'Noisette se repose 💤 À demain' + NNBSP + '!');
  assert.equal(restWhy(p, 'sieste'), 'Tu as bien joué aujourd’hui' + NNBSP + '! Noisette fait la sieste 💤 On rejoue demain.');
  assert.equal(restWhy(p, 'nuit'), 'Tu as bien joué aujourd’hui' + NNBSP + '! Noisette dort 🌙 On rejoue demain.');
  for (const t of Object.values(REST_TEXT)) {
    assert.doesNotMatch(t, /\b(trop|interdit|puni|fini pour toi|plus le droit|stop|assez)\b/i, 'jamais un reproche : ' + t);
  }
  for (const t of [restLine(p), restWhy(p, 'sieste'), restWhy(p, 'nuit')]) assert.doesNotMatch(t, /[{}]/, 'jeton laissé : ' + t);
  /* avant la limite */
  assert.equal(nearLine(playNow(kid({ today: [55] }), TODAY)), 'Encore 5 minutes de jeu aujourd’hui');
  assert.equal(nearLine(playNow(kid({ today: [57.5] }), TODAY)), 'Encore 3 minutes de jeu aujourd’hui', 'arrondi au-dessus');
  assert.equal(nearLine(playNow(kid({ today: [59.5] }), TODAY)), 'Encore 1 minute de jeu aujourd’hui', 'singulier');
  assert.equal(nearLine(playNow(kid({ today: [30] }), TODAY)), '', 'loin de la limite : rien');
  assert.equal(nearLine(playNow(kid({ today: [60] }), TODAY)), '', 'atteinte : plus d’avertissement');
  assert.equal(nearLine(playNow(kid({ today: [58], dailyMin: 0 }), TODAY)), '', 'sans limite');
  assert.equal(nearLine(null), '');
});

test('décisions : temps atteint, enfants éveillés, aucun profil = aucune limite', () => {
  const lea = kid({ name: 'Léa', today: [60] }), ines = kid({ name: 'Inès', today: [10] }), hugo = kid({ name: 'Hugo', today: [61] });
  assert.equal(timeUp(lea, TODAY), true);
  assert.equal(timeUp(ines, TODAY), false);
  assert.equal(timeUp(null, TODAY), false);
  assert.equal(playNow(null, TODAY).unlimited, true);
  assert.deepEqual(awake([lea, ines, hugo, null], TODAY).map(p => p.name), ['Inès']);
});

test('défi en famille : qui se repose (élision, listes), « Lancer un défi » seulement à deux enfants éveillés', () => {
  const lea = kid({ name: 'Léa', today: [60] }), ines = kid({ name: 'Inès', today: [70] }), hugo = kid({ name: 'Hugo', today: [5] }), zoe = kid({ name: 'Zoé' });
  assert.equal(restingPets([lea]), 'Le compagnon de Léa se repose 💤');
  assert.equal(restingPets([ines]), 'Le compagnon d’Inès se repose 💤');
  assert.equal(restingPets([ines, lea]), 'Les compagnons d’Inès et Léa se reposent 💤');
  assert.equal(restingPets([]), '');
  assert.equal(familyRest([hugo, zoe, lea], TODAY), '', 'deux enfants éveillés : le défi reste possible');
  assert.equal(familyRest([lea, hugo], TODAY), 'Le compagnon de Léa se repose 💤 Un défi demain' + NNBSP + '?');
  assert.equal(familyRest([lea, ines, hugo], TODAY), 'Les compagnons de Léa et Inès se reposent 💤 Un défi demain' + NNBSP + '?');
  assert.equal(familyRest([lea, ines], TODAY), 'Tous les compagnons se reposent 💤 Un défi demain' + NNBSP + '?');
});

test('espace parents : libellés des durées, temps joué aujourd’hui, bouton des 15 minutes (vouvoiement, pas de prénom réel)', () => {
  assert.deepEqual(DAILY_OPTIONS.map(dailyLabel), ['30\u00A0min', '45\u00A0min', '1\u00A0h', '1\u00A0h\u00A030', '2\u00A0h', 'Sans limite']);
  assert.equal(durLabel(62), '1\u00A0h\u00A002');
  assert.equal(durLabel(0.4), '0\u00A0min');
  assert.equal(BONUS_LABEL, 'Encore 15 minutes aujourd’hui');
  assert.equal(parentLine(kid(), TODAY), 'Aujourd’hui' + NNBSP + ': pas encore de jeu sur 1\u00A0h, encore 1\u00A0h.');
  assert.equal(parentLine(kid({ today: [42] }), TODAY), 'Aujourd’hui' + NNBSP + ': 42\u00A0min de jeu sur 1\u00A0h, encore 18\u00A0min.');
  assert.equal(parentLine(kid({ today: [62] }), TODAY), 'Aujourd’hui' + NNBSP + ': 1\u00A0h\u00A002 de jeu sur 1\u00A0h. Temps atteint' + NNBSP + ': les jeux sont grisés jusqu’à demain.');
  assert.equal(parentLine(kid({ today: [62], bonus: { d: TODAY, min: 15 } }), TODAY),
    'Aujourd’hui' + NNBSP + ': 1\u00A0h\u00A002 de jeu sur 1\u00A0h\u00A015 (dont 15\u00A0min accordées aujourd’hui), encore 13\u00A0min.');
  assert.equal(parentLine(kid({ today: [95], dailyMin: 0 }), TODAY), 'Aujourd’hui' + NNBSP + ': 1\u00A0h\u00A035 de jeu (sans limite).');
  /* l'écran des parents : réglage par enfant près de la durée de la balade, temps du jour, bonus via withBonus */
  const pa = code('js/ui/parents.js');
  assert.match(pa, /card\.appendChild\(playTimeRow\(p, set\)\);/);
  assert.ok(pa.indexOf("'Durée de la balade du jour'") < pa.indexOf('card.appendChild(playTimeRow(p, set))'), 'juste après la durée de la balade');
  assert.match(pa, /seg\(DAILY_OPTIONS\.map\(m => \[m, dailyLabel\(m\)\]\), normDailyMin\(/);
  assert.match(pa, /q\.playBonus = withBonus\(q, dayStr\(\), BONUS_STEP\)/);
  assert.match(pa, /Vous pouvez accorder un peu plus de temps pour la journée\./);
});

test('garde-fous : chaque endroit qui lance un jeu vérifie le temps du jour (une partie commencée se finit)', () => {
  /* feuille des jeux : tuiles grisées, rien ne démarre */
  const bl = code('js/ui/balade.js');
  assert.match(bl, /const rest = timeUp\(q\);/);
  assert.match(bl, /t\.classList\.add\('is-rest'\);\s*t\.setAttribute\('aria-disabled', 'true'\);/);
  assert.match(bl, /t\.addEventListener\('click', \(\) => restNotice\(q, \{ el: t \}\)\);\s*return;/);
  /* étape de balade (accueil, carte du pré, bilan, Mes progrès) */
  assert.match(bl, /if \(!b \|\| b\.done\) return null;\s*if \(timeUp\(q\)\) \{\s*restNotice\(q, \{ el, kind: 'why' \}\);/);
  /* accueil : le gros bouton ne lance rien et dit pourquoi */
  const hm = code('js/ui/home.js');
  assert.match(hm, /if \(timeUp\(q, today\)\) \{ renderPlay\(\); restNotice\(q, \{ el: go, kind: 'why' \}\); return; \}\s*audio\.tap\(\);\s*const cur = currentStep/);
  assert.match(hm, /gamesBtn\.hidden = rest \|\| done \|\| !N;/);
  /* coquille : lien direct ou rechargement → l'accueil, avant toute manche ; relances internes */
  const gs = code('js/ui/game-shell.js');
  const guard = gs.indexOf('if (timeUp(p, today)) { restNotice(p); router.go(\'home\', { replace: true }); return; }');
  assert.ok(guard > 0 && guard < gs.indexOf('createManche({'), 'garde-fou avant la manche');
  for (const fn of ['changeGame', 'pickMore', 'replay']) {
    assert.match(gs, new RegExp('function ' + fn + '\\(\\) \\{[\\s\\S]{0,80}timeUp\\(store\\.getProfile\\(\\) \\|\\| p, today\\)\\) \\{ restHome\\(\\); return; \\}'), fn);
  }
  assert.match(gs, /if \(next >= 0 && !timeUp\(q, today\)\) goStep\(next\); else exitTo\('home'\);/, 'nextStep (course en balade)');
  assert.match(gs, /canStart: \(\) => !timeUp\(/, 'ctx.again() de la course');
  /* bilan : Rejouer / Étape suivante / Encore un jeu ? remplacés par Accueil sous la phrase */
  assert.match(gs, /const rest = timeUp\(q, today\);[\s\S]{0,200}if \(rest\) \{[\s\S]{0,400}acts\.push\(h\('p', \{ class: 'gs-rest' \}, restTxt\), home\);/);
  /* contexte de jeu : again() refusé, la course propose l'accueil */
  assert.match(code('js/ui/game-ctx.js'), /again\(\) \{\s*if \(ctx\.timeUp\) \{ voice\.hush\(\); if \(onRest\) onRest\(\); return false; \}/);
  const cr = code('js/games/course.js');
  assert.match(cr, /const rest = !more && !!ctx\.timeUp;/);
  assert.equal((cr.match(/if \(ctx\.again\(\) !== false\)/g) || []).length, 3, 'Revanche, Suite, Histoires');
  /* famille, défi, avec un copain */
  const fm = code('js/ui/famille.js');
  assert.match(fm, /const restTxt = familyRest\(list, today, F\.BATTLE\.MIN\);/);
  assert.match(fm, /if \(timeUp\(me\)\) \{\s*b\.setAttribute\('aria-disabled', 'true'\);/);
  const bt = code('js/ui/battle.js');
  assert.match(bt, /if \(awake\(list\)\.length < F\.BATTLE\.MIN && !readSaved\(list\)\) \{/, 'mount');
  assert.match(bt, /const resting = new Set\(list\.filter\(p => timeUp\(p, today\)\)\.map\(p => p\.id\)\);/, 'réglages');
  assert.match(bt, /const profiles = resume \? all : all\.filter\(p => !timeUp\(p, today\)\);/, 'startBattle : la reprise se finit');
  assert.match(bt, /if \(!saved && timeUp\(me\)\) \{ restNotice\(me\); router\.go\('home', \{ replace: true \}\); return; \}/, 'avec un copain');
  assert.match(code('js/ui/duel.js'), /if \(timeUp\(p\)\) \{ restNotice\(p\); router\.go\('home', \{ replace: true \}\); return; \}/);
});

test('sources : aucun caractère invisible littéral dans les fichiers du temps de jeu', () => {
  for (const f of ['js/core/playtime.js', 'js/ui/play-limit.js']) {
    assert.ok(!/[\u00A0\u202F\u200B\u2009̀-ͯ]/.test(SRC(f)), 'caractère invisible littéral dans ' + f);
  }
});

test('normDailyMin : une valeur vide ou abîmée ne lève jamais la limite', async () => {
  const P = await import('../js/core/playtime.js');
  for (const v of [null, undefined, '', true, false, 'abc', 17]) assert.equal(P.normDailyMin(v), P.DAILY_DEFAULT, String(v));
  assert.equal(P.normDailyMin(0), 0, '0 explicite : sans limite (choisi par un parent)');
  assert.equal(P.normDailyMin('90'), 90);
});
