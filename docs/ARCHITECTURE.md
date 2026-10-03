# Caramel 2 — Architecture & contrat des modules (v2.0)

> Document technique compagnon du **CDC v2** (`docs/CDC-v2.md`, la spec produit).
> Il fixe les **interfaces exactes** entre modules : toute personne (ou agent) qui écrit un module
> respecte ce contrat, et toute évolution d'API met ce fichier à jour dans le même commit.

## 0. Principes

- **Site statique GitHub Pages, sans build, sans backend.** ES modules natifs, imports relatifs **avec extension `.js`**. Aucune dépendance npm à l'exécution (seule exception : `vosk-browser` chargé depuis jsDelivr, comme en v11).
- **Local-first** : tout reste sur l'appareil (localStorage). Échanges uniquement par export/import de fichiers.
- **Bienveillance** (CDC §1, §7.7) : aucune perte de 🍎/⭐, aucune note, jamais de niveau scolaire affiché à l'enfant (pas de « CE2 » visible côté enfant, sauf sa propre classe dans les réglages), erreurs signalées en **orange doux** (jamais rouge), toujours un indice puis une nouvelle chance.
- **Français irréprochable** dans tous les textes affichés : accents, majuscules accentuées (À, É), apostrophe typographique `’` dans l'interface, espace fine insécable avant `; : ! ?` et après `«` / avant `»` (helper `frTypo`). **Exception** : les textes lus à voix haute (histoires de la course) n'ont **ni apostrophe ni trait d'union** (contrainte de reconnaissance vocale, CDC v11 §8).
- **Modules purs** = importables par Node pour les tests : aucun accès à `window`, `document`, `localStorage`, `navigator` **au chargement** du module. Sont purs : `js/core/{util,rng,axes,levels,profiles,migrate,economy,adaptive,leitner,session,radar-model,numbers-fr}.js`, `js/games/index.js`, `js/content/**`. `store.js` est testable avec un stockage injecté.
- **try/catch** autour de tout accès `localStorage`, `caches`, `speechSynthesis`, `AudioContext`, `navigator.*`, `Notification`.
- **Mobile d'abord** (360-430 px) : cibles tactiles ≥ 48 px, retour visuel sur `:active` (pas au `click`), survol seulement dans `@media (hover:hover) and (pointer:fine)`, `100dvh` pour les écrans plein cadre, zones sûres `env(safe-area-inset-*)`, champs de saisie ≥ 16 px, jamais `user-scalable=no`.
- **Aucune donnée nominative d'enfant dans le repo** (les `docs/profil-*.json` sont dans `.gitignore`).
- **Une version = un commit** `v2.x : …` sur `main` ; ce document et le CDC sont mis à jour à chaque déploiement.

## 1. Arborescence et responsabilités

```
index.html                    coquille : <div id="app">, polices, css/base.css, js/main.js (type=module)
manifest.webmanifest  sw.js   PWA (sw.js : cache versionné, liste ASSETS générée par tools/precache.mjs)
fonts/                        Fredoka 500/600/700 (interface), Andika 400/700 (lecture) + OFL.txt
css/base.css                  jetons, socle mobile, composants partagés (cf. §9)
css/motion.css                keyframes génériques + règles de mouvement réduit
css/ui/<écran>.css            styles d'un écran (chargés par l'écran via loadCSS)
css/games/<jeu>.css           styles d'un jeu (chargés par le shell avant mount)
js/main.js                    démarrage : store.init (migration), réglages, SW + bandeau de mise à jour, route initiale, router
js/router.js                  routeur hash (#/home, #/play/<id>?…), transitions de vue
js/core/util.js               ✅ écrit — dates, nombres FR, h()/svg(), loadCSS, download…
js/core/rng.js                ✅ écrit — PRNG seedé (makeRng)
js/core/axes.js               ✅ écrit — référentiel AXES, CLASSES, SUBJECTS, gabarits radar
js/core/levels.js             ✅ écrit — échelles b (relative) / A (absolue), MCLM attendus
js/core/store.js              singleton des données caramel-v3 (charge via migrate, persiste, notifie)
js/core/migrate.js            migration v1/v11 → v3 (pur + accès stockage injecté)
js/core/profiles.js           création/normalisation de profil, templating {P} {N}…, classe suivante
js/core/economy.js            🍎, ⭐, série 🔥 + gel, badges
js/core/adaptive.js           modèle θ (logistique), score r, mise à jour, cible b, import d'évaluation
js/core/leitner.js            répétition espacée 5 boîtes
js/core/session.js            planification de « Ma balade du jour » (pur)
js/core/manche.js             exécution d'une manche : items, rapports, indices, fin (utilise store)
js/core/radar-model.js        r(θ) et inverse, polygones, snapshots hebdo, tendances
js/core/speech.js             moteur vocal v11 (Vosk + secours Web Speech), API généralisée
js/core/numbers-fr.js         nombres ↔ mots (formes du lexique Vosk), analyse des nombres dits
js/core/tts.js                synthèse vocale fr-FR (avec texte affiché en secours)
js/core/audio.js              sons WebAudio synthétisés (aucun fichier), métronome, muet
js/core/motion.js             Web Animations API : pop, squash, flyTo, burst, countUp, shake, morphPolygon…
js/ui/kit.js                  composants de jeu : pavé numérique, QCM, toast, bulle, feuille, célébrations
js/ui/game-ctx.js             ✅ écrit — construit le ctx d'un jeu à partir d'une manche (partagé coquille / banc d'essai)
js/ui/game-header.js          ✅ écrit — en-tête commun des jeux (retour, titre, joker 💡, 🍎, pastilles)
js/ui/mount-svg.js            compagnon SVG v11 (mountSVG verbatim) + css/ui/mount.css (animations du rig)
js/ui/<écran>.js              écrans (home, profiles, onboarding, balade, game-shell, progres, parents, import-eval, backup, radar, companion)
js/games/index.js             ✅ écrit — registre des 6 jeux (chargement paresseux)
js/games/<id>.js              un fichier par jeu (interface §7)
js/content/index.js           ✅ écrit — registre paresseux des générateurs par axe
js/content/companion-data.js  MOUNTS, FOODS, SHOP, constantes du compagnon (données v11)
js/content/maths/{ligne,faits,procedures,operations}.js
js/content/fr/{conjug,verbs}.js
js/content/stories/{index,legacy,cm2,questions}.js
tests/run.mjs                 mini-harnais : exécute tests/*.test.mjs (node:assert/strict), code ≠ 0 si échec
tests/*.test.mjs              tests unitaires (Node 20)
tests/lexicon.mjs             extrait le lexique du modèle Vosk (models/fr.tar.gz) → Set de mots
tests/harness/*.html          bancs d'essai navigateur ; game.html monte un jeu avec le VRAI ctx et une sauvegarde en mémoire
                              (game.html?id=tables&classe=CM2&theta=1.2&mode=libre&count=10 ; demo-game.js = jeu de référence §7.3)
tools/precache.mjs            régénère la liste ASSETS + VERSION de sw.js
tools/check.mjs               node --check sur tous les modules + tests
docs/CDC-v2.md  docs/ARCHITECTURE.md  docs/archive/CDC-v11.md
```

## 2. Données — clé `caramel-v3`

```js
{
  schema: 3,
  active: 'p1',                 // id du profil actif, ou null
  migratedFrom: 'v11',          // 'v11' | 'v1' | 'v11-corrompu' | null (installation neuve)
  created: '2026-10-02',
  profiles: {
    p1: {
      id: 'p1',
      name: 'Léa',              // prénom = jeton {P} ; sanitizeName (≤ 14 car., sans { })
      g: 'f',                   // 'f' | 'm' (accords du héros)
      classe: 'CM2',            // 'CP'|'CE1'|'CE2'|'CM1'|'CM2' ; null → écran de bienvenue (migration)
      classeSince: '2026-10-02',
      created: '2026-10-02',
      companion: {
        type: 'pony', name: 'Caramel', owned: ['pony'],
        equip: { owned: [], worn: [] },
        pet: { faim: 80, forme: 80, joie: 80, last: 0, brushLast: 0, walkDay: '' },
        stage: 1,               // v2.2 (stades) — conservé, non utilisé en 2.0
        minutes: 0              // minutes d'apprentissage cumulées (pour les stades)
      },
      wallet: { apples: 0, stars: { pomme: 3 } },        // ⭐ par id d'histoire (0-3, meilleur score)
      streak: { count: 0, last: '', freezes: 1, freezeWeek: '' },
      skills: { 'fr.fluence': { t: 1.5, n: 0, last: '', trend: 0, src: 'defaut' } },
      evals: [ { src: 'reperes', date: '2026-09', classe: 'CM2', fr: {}, ma: {}, added: '2026-10-02', precision: '' } ],
      snapshots: [ { w: '2026-W40', d: '2026-10-02', s: { 'fr.fluence': 1.3 } } ],   // ≤ 104
      leitner: { 'ma.faits:7x8': { b: 1, due: '2026-10-03', seen: 3, ok: 2, last: '2026-10-02' } },
      history: [ { d: '2026-10-02', t: 1759400000000, g: 'tables', ax: 'ma.faits', n: 10, ok: 8, hint: 1, ms: 180000, th: 1.62, mode: 'balade' } ],   // ≤ 500
      mclm: [ { d: '2026-10-02', t: 1759400000000, s: 'pomme', v: 92, p: 95, z: 88 } ],   // ≤ 300 ; s = histoire, v = MCLM, p = précision %, z = vitesse de Zip
      today: null,              // plan de la balade du jour (§5.6) ou null
      legacy: null,             // { from: 'v11', mclm: 78, stars: 45 } : estimation de fluence en attente de la classe
      settings: { sessionMin: 15, timers: false, sound: true, motion: 'full', subMethod: 'compensation' },   // motion : 'full' | 'soft' ; subMethod : technique de soustraction posée de l'école, 'compensation' | 'cassage' (BO n°41 2024 : un seul algorithme par école, CE1→CM2)
      stats: { minutes: 0, sessions: 0, items: 0 }
    }
  }
}
```

Invariants (garantis par `normalizeProfile`) : nombres finis et bornés (jauges 15-100, θ 0-3, 🍎 ≥ 0 entier), `companion.type` ∈ MOUNTS, `owned` contient `pony` et le type courant, `worn` ⊆ `equip.owned` avec un seul objet par emplacement, tableaux plafonnés (history 500, mclm 300, snapshots 104).

Autres clés localStorage : `caramel-save-v2` (v11) et `caramel-progress-v1` (v1-v10) **jamais supprimées en v2.0** ; `caramel-backup-v11` (copie brute, écrite une seule fois) ; `caramel-notifs` (préférence d'appareil, héritée de v11, inchangée) ; `sessionStorage['caramel-picked']` (profil choisi pendant cette session d'utilisation).

## 3. Migration v1 / v11 → v3 (`js/core/migrate.js`) — CDC §13

```js
export const KEY = 'caramel-v3', V11 = 'caramel-save-v2', V1 = 'caramel-progress-v1', BACKUP = 'caramel-backup-v11';
export const LEGACY_TARGETS = { 'ce1-carotte': 30, …, 'cm1-aurore': 100 };   // cibles Zip des 27 histoires v11
export function migrate(storage, today) → { data, report: { from, backedUp, wrote } }
export function buildFromLegacy({ v11, v1, today }) → data        // pur : v11 / v1 = objets déjà parsés ou null
export function estimateFluence(stars) → number | null            // MCLM estimé depuis les étoiles
export function emptyData(today) → data                           // installation neuve : profiles = {}, active = null
```

`migrate(storage, today)` :
1. Si `caramel-v3` existe et se parse en objet `schema === 3` → normaliser chaque profil, renvoyer `{ from: 'v3' }` (aucune écriture si rien n'a changé).
2. Sinon lire les chaînes brutes `caramel-save-v2` et `caramel-progress-v1`. Si les deux sont absentes → `emptyData` (installation neuve, `from: 'none'`), écrire v3.
3. Sinon : si `caramel-backup-v11` est absente, y écrire `JSON.stringify({ savedAt: today, 'caramel-save-v2': brutV11 | null, 'caramel-progress-v1': brutV1 | null })` — **jamais réécrite ensuite**.
4. Parser : v11 valide → source v11 (si v1 existe aussi, v11 fait foi : la v11 avait déjà migré v1) ; v11 corrompue → v1 si valide, sinon profil vierge (`migratedFrom: 'v11-corrompu'`) ; v1 seule → source v1.
5. Créer `p1` : `name/g` ← `hero` (défaut v11 « Léa »/f) ; `companion` ← `mount` + `equip` + `pet` (valeurs bornées, ids filtrés) ; `wallet` ← `apples` + `stars` (ids conservés tels quels, valeurs 0-3) ; `streak` ← `{count, last}` + `freezes: 1` ; **v1 seule : `apples = Σ min(3, ⭐) × 10`** (règle v11) ; `classe: null`.
6. `legacy = { from, mclm: estimateFluence(stars), stars: Σ⭐ }` ; `skills` vide. Quand la classe est choisie (`profiles.setClasse`), si `legacy.mclm` et pas de fluence observée → `skills['fr.fluence'] = { t: thetaFromMclm(mclm, classe, today), n: 1, src: 'v11' }`.
7. `active = 'p1'`, écrire `caramel-v3`. Ne supprimer **aucune** ancienne clé.

`estimateFluence(stars)` : max des cibles `LEGACY_TARGETS` des histoires à 3 ⭐ ; sinon 0,85 × max des histoires à ≥ 2 ⭐ ; sinon null.
Idempotent, try/catch partout ; un JSON corrompu ne fait jamais planter le démarrage.
**Fixtures obligatoires** (`tests/migrate.test.mjs`) : vide · v1 seul · v11 seul · v1 + v11 · v11 corrompu (+ v1 valide, et sans v1) · v11 licorne équipée (couronne + ailes) et série de 12 jours · v3 déjà présent (aucune réécriture) · double exécution (idempotence, backup inchangé). Assertions : pommes, étoiles, monture, accessoires portés, jauges, série (+1 gel), backup brut intact, anciennes clés intactes.

## 4. Store (`js/core/store.js`)

```js
export function init(storage = globalThis.localStorage, today = dayStr()) → { data, report }   // appelle migrate
export function getData() → data
export function getProfile(id = getData().active) → profile | null
export function listProfiles() → profile[]                  // tri par created
export function setActive(id)
export function commit()                                     // persiste (try/catch) puis notifie les abonnés
export function mutate(fn)                                   // fn(data) ; commit()
export function mutateProfile(fn, id = active)               // fn(profile) ; commit()
export function addProfile(profile) → id                     // devient actif
export function removeProfile(id)                            // active ← autre profil ou null
export function replaceData(newData)                         // import « remplacer tout » (normalisé)
export function subscribe(fn) → unsubscribe
```
Le store garde l'objet en mémoire ; les écrans lisent `getProfile()` et écrivent **uniquement** via `mutateProfile` / la manche. En cas d'échec d'écriture (quota, navigation privée), l'app continue en mémoire.

## 5. Cœur pédagogique

### 5.1 Profils (`js/core/profiles.js`)
```js
export function defaultProfile({ id, name, g = 'f', classe = null, today }) → profile complet
export function normalizeProfile(p, today) → profile        // complète et borne tout (cf. invariants §2)
export function sanitizeName(v, fallback)                   // v11 : retire { }, trim, ≤ 14 car.
export function tplMap(profile) → { P, N, El, el, fiere, leM, LeM, sonM, SonM, duM, IlM, ilM, contentM, surprisM, legerM, rassureM, fascineM }
export function fillTemplate(str, profile)                  // remplace \{(\w+)\} via tplMap (jeton inconnu laissé tel quel)
export function setClasse(profile, classe, today)           // + classeSince, + initialisation fluence depuis legacy
export function nextClasse(classe) → classe | null          // CM2 → null
export function offerNextClasse(profile, today) → classe | null   // juillet-septembre si classeSince < 1er juillet de l'année
export function newProfileId(data) → 'p2', 'p3'…
```
`tplMap` reprend **exactement** le dictionnaire v11 (`MOUNTS[type].g` pour le genre de la monture, `profile.g` pour le héros, `companion.name` pour `{N}`, `name` pour `{P}`).

### 5.2 Économie (`js/core/economy.js`)
```js
export const BADGES = { bronze: 1.5, argent: 2.25, or: 2.75 };
export function totalStars(profile) → Σ min(3, ⭐)
export function addApples(profile, n)
export function bumpStreak(profile, today) → { bonus, count, usedFreeze }
export function refreshFreeze(profile, today)               // 1 gel offert par semaine ISO (freezes = max(freezes, 1))
export function badgeOf(theta) → null | 'bronze' | 'argent' | 'or'
```
Série (règle v11 + gel) : même jour → rien (bonus 0) ; dernier jour = hier → count + 1 ; dernier jour = avant-hier et `freezes > 0` → gel consommé, count + 1 ; sinon count = 1. Bonus = 10 🍎, + 50 si `count % 7 === 0`. Appelée à la **première manche terminée du jour** (par `manche.finish`).

### 5.3 Modèle adaptatif (`js/core/adaptive.js`) — CDC §7
```js
export const DEFAULT_THETA = 1.5;
export const SPEED_MS = { 'ma.faits': 3000, 'ma.procedures': 5000 };   // seuil « automatisé » par défaut (item.autoMs prime)
export function prob(theta, b) → 1 / (1 + e^(−1,7(θ − b)))
export function kFactor(n) → max(0,08 ; 0,4 / √(n + 1))
export function skillOf(profile, axis) → skill (défaut { t: 1.5, n: 0, last: '', trend: 0, src: 'defaut' }, non inséré)
export function scoreR(axis, item, outcome) → 0 | 0.6 | 0.8 | 1
export function applyResult(profile, axis, b, r, today) → { before, after }   // θ ← clamp(θ + K(r − p), 0, 3), n + 1
export function applyFluence(profile, { mclm, textA, classe, today }) → { before, after, obs }
export function targetB(theta, adj = 0) → clamp(θ − 0,8 + adj, 0, 3)
export function applyEval(profile, evaluation, today) → { applied: [axes], absent: [axes] }
```
- `scoreR` : faux → 0 ; juste mais aidé (`hinted` : joker, indice proactif ou 2e essai) → 0,6 ; juste sur un axe de vitesse avec `ms > autoMs` → 0,8 ; sinon 1.
- `applyFluence` : MCLM corrigé de la facilité du texte `mclm × clamp(1 − 0,05 × max(0, attendu − textA), 0,8, 1)` → `obs = thetaFromMclm(…)` ; poids `w = n === 0 ? 1 : max(0,3 ; 1/(n+1))` ; θ ← θ + w(obs − θ).
- `applyEval` : pour chaque axe non nul de `fr` et `ma` → `{ t: valeur, n: 4, last: today, src: 'eval' }` ; ajoute l'évaluation à `profile.evals` (la plus récente = référence du radar) ; les `null` sont listés dans `absent` (Grand check-up en v2.1).
- `trend` d'un skill = θ après la manche − θ cinq manches plus tôt (mis à jour par `manche.finish`).

### 5.4 Échelles de niveau (`js/core/levels.js`, ✅ écrit)
`b` (relatif, 0-3, 2 = attendu de la classe **à cette période de l'année**) ↔ `A` (absolu, 0 = rentrée CP, 1 = fin CP … 5 = fin CM2, 5,6 max) : `A = gradeIndex + yearFrac(date) + (b − 2)`. Les **générateurs ne voient que A** ; `relLevel(classe, A)` refait le chemin inverse. Remédiation invisible (CDC §7.6) = conséquence directe : θ bas → b bas → A d'une classe inférieure.

### 5.5 Répétition espacée (`js/core/leitner.js`)
```js
export const INTERVALS = [1, 2, 4, 8, 16];                   // jours, boîtes 1 → 5
export function review(profile, key, correct, today) → entry
export function dueKeys(profile, prefix, today, limit = 20) → keys   // due ≤ today, boîte basse puis plus ancienne d'abord
export function weakKeys(profile, prefix, limit = 12) → keys         // boîtes 1-2 (« à revoir » côté parents)
export function stats(profile, prefix) → { total, byBox: [n1…n5], due }
```
Nouvelle clé : juste → boîte 2 (due + 2 j) ; faux → boîte 1 (due + 1 j). Clé existante : juste → boîte + 1 (max 5), due + INTERVALS **seulement si la révision était due et pas déjà faite le jour même** (sinon boîte et échéance inchangées) ; faux → boîte 1, due + 1 j. **Juste = du premier coup sans aide.** Dans une manche, part des clés dues = min(0,8 ; 0,4 + arriéré/50) (0,7 + arriéré/50 en bloc révision).
Clés : `<axe>:<contenu>` — `ma.faits:7x8` (facteurs triés, `a ≤ b`), `ma.faits:add:7+8`, `fr.conjug:prendre|present|3p`, `fr.fluence:<mot normalisé>`.

### 5.6 Balade du jour (`js/core/session.js`, pur) — CDC §7.4
```js
export const IMPORTANCE = { 'fr.fluence': 1.3, 'ma.faits': 1.3 };
export function eligibleAxes(profile) → axes ayant un jeu pour la classe (v2.0 : primaires des 6 jeux)
export function axisWeight(profile, axis, today) → (3 − θ)^1,5 × importance × fraîcheur
export function planDay(profile, today) → plan
export function ensureToday(profile, today) → plan       // replanifie si plan absent ou d'un autre jour
export function completeBlock(profile, idx, result)       // done = true, idx suivant, plan.done si tout est fait
export function finishDay(profile) → bonus               // +10 🍎 une seule fois (rewarded)
```
Fraîcheur : jamais pratiqué ou ≥ 7 j → 2 ; pratiqué aujourd'hui → 0,5 ; sinon 1 + jours/7.
Plan : `{ d, idx: 0, done: false, rewarded: false, blocks: [ { kind, game, axis, count, offset, done: false, result: null } ] }` avec 4 blocs :
1. `echauffement` : axe de θ le plus haut (point fort), `offset −0,6`, `count = ceil(0,7 × mancheSize)` ;
2. `priorite` : poids maximal (autre axe, autre jeu) ;
3. `revision` : axe non vu depuis ≥ 6 j, sinon axe à ≥ 4 clés Leitner dues (faits, conjugaison), sinon 2e poids ;
4. `recompense` : `course` si aucun bloc ne l'utilise, sinon `game: null` (jeu libre au choix de l'enfant).
Jamais deux fois le même jeu de suite. `count = mancheSize(game, settings.sessionMin)` ; course : 1 histoire en échauffement/récompense, 2 en priorité/révision (3 pour 20 min).
Rotation (v2.0) : échauffement parmi les 3 meilleurs θ (de préférence ≥ 2), jamais l'axe des 2 jours précédents (`plan.recentWarm`) ; priorité et révision excluent l'axe d'échauffement seulement s'il est un vrai point fort (θ ≥ 2) ; révision : pas l'axe révisé la veille (`plan.prevRev`) ; « non vu depuis ≥ 6 j » compte la pratique **au niveau** (entrées `history[].k` ≠ 'echauffement'). La manche transmet `classe` aux générateurs (`opts.classe`).

### 5.7 Manche (`js/core/manche.js`)
```js
export function createManche({ gameId, axis, count, mode = 'libre', blockIdx = null, offset = 0, today = dayStr(), seed })
  → manche   // pré-requis : await loadGenerator(axis) (et des axes secondaires utilisés)
manche.nextItem(axisOverride?, opts?) → item | null        // null quand count est atteint
manche.report(item, outcome) → feedback
manche.useHint() → boolean                                 // 2 jokers par manche
manche.hintsLeft → number
manche.finish(extra?) → summary                            // persiste, série, balade, snapshot
manche.abort() → summary | null                            // quitter : progrès gardés, bloc non validé
manche.state → { index, count, reports, correct, clean, hinted, apples, startedAt }
```
`nextItem` : θ courant → `b = targetB(θ, offset + adj)` → `A = absLevel(classe, b, today)` → item Leitner dû (si le générateur a `fromKey`, axe `ma.faits` ou `fr.conjug`, probabilité 0,4, 0,7 en bloc `revision`) sinon `gen(A, rng, { avoid })` (jusqu'à 5 essais pour éviter une clé déjà vue dans la manche) → `item.b = relLevel(classe, item.A ?? A, today)` → `item.assist = true` si deux échecs de suite viennent d'arriver.
`report(item, outcome)` : `r = scoreR` → `applyResult` → Leitner si `item.leitner` (juste = `correct && !hinted`) → +1 🍎 si `correct` → filet de sécurité : 2 échecs (r ≤ 0,6) de suite → `adj −= 0,5`, prochain item `assist` ; 4 réussites (r ≥ 0,8) de suite → `adj += 0,3` (adj borné [−1,5 ; 0,9]) → persistance.
Rapport de **course** (`outcome.kind === 'race'`) : `{ storyId, mclm, precision, stars, beatZip, ms, missed: [mots normalisés], textA, zip }` → ⭐ max par histoire, + ⭐ × 10 🍎, entrée `mclm`, `applyFluence`, Leitner des mots ratés.
`finish` : entrée `history` (plafond 500), `stats`, `companion.minutes`, `bumpStreak` (première manche du jour), `completeBlock` (mode balade), `snapshotIfNeeded`, `trend` → `summary = { gameId, axis, n, correct, clean, hinted, apples, streakBonus, thetaBefore, thetaAfter, ms, dayDone }`.

### 5.8 Radar (`js/core/radar-model.js`, pur) — CDC §4.2, §9
```js
export function rFrac(theta) → θ ≤ 1 ? θ/2 : 0,5 + 0,25(θ − 1)        // ⊕ = 0,5 R, ⊕⊕ = 0,75 R, ⊕⊕⊕ = R
export function thetaFromFrac(f) → inverse (borné 0-3)
export function polar(cx, cy, R, angleDeg, frac) → [x, y]              // angle horaire depuis le haut
export function currentValues(profile, template) → { axe: θ | null }   // skill observé (n > 0) sinon valeur d'évaluation sinon null
export function referenceValues(profile, subject) → { axe: θ | null } | null   // dernière évaluation officielle
export function snapshotIfNeeded(profile, today)                       // 1 par semaine ISO, plafond 104
export function axisTrend(profile, axis, today, days = 14) → Δθ
export function inProgress(profile, axis, today) → boolean            // θ − évaluation ≥ 0,2 ou tendance > 0,1
```

## 6. Contenu

### 6.1 Contrat des générateurs
```js
export const axis = 'ma.ligne';
export function gen(A, rng, opts = {}) → item       // opts.avoid : Set de clés à éviter ; opts.kind : sous-type imposé
export function fromKey(key, A, rng) → item | null  // facultatif (Leitner)
```
**Déterministe** : même `(A, graine)` → même item. **Pur** (aucun DOM). Chaque générateur couvre **tout A de 0 à 5,6** (pour la remédiation), découpé en paliers documentés en tête de fichier (repris du CDC §5 et des programmes).

### 6.2 Item (commun à tous les axes)
```js
{
  axis: 'ma.faits', kind: 'mul',     // kind = sous-type propre au générateur
  key: 'ma.faits:7x8',               // clé stable du contenu (déduplication, Leitner)
  A: 3.2,                            // niveau absolu réel de l'item
  b: 1.4,                            // posé par la manche
  prompt: '7 × 8',                   // énoncé court affichable
  answer: 56,                        // réponse attendue (nombre, chaîne ou index)
  choices: [{ label: '56', value: 56 }, …],   // QCM éventuel : 4 choix (6 pour les fractions de la ligne graduée, comme aux Repères), réponse incluse, ordre mélangé
  hint: '7 × 8, c’est le double de 7 × 4.',          // indice (après 1re erreur ou joker)
  explain: '7 × 8 = 56 : …',         // explication montrée après la 2e erreur
  autoMs: 3000,                      // facultatif : seuil de vitesse
  leitner: true,                     // enregistrer dans Leitner
  data: { … }                        // charge utile propre au jeu (graduations, grille d'opération…)
}
```
Nombres affichés avec `fmtNum` (virgule, espaces fines). Signes : `×`, `÷`, `−` (U+2212), `+`, `=`.
Références officielles des paliers : rapports de recherche du 02/10/2026 (programmes BO n°41 du 31/10/2024 et BO n°16 du 17/04/2025, guides Repères 2026) — synthèse reportée dans le CDC v2 §5.

### 6.3 Histoires (`js/content/stories/`)
`legacy.js` (27 histoires v11, textes **verbatim**), `cm2.js` (10 nouvelles, ≥ 150 mots), `questions.js` (1 QCM de compréhension par histoire, templaté), `index.js` :
```js
export const STORIES     // 37 : { id, emoji, title, target, need, lvl, world, theme, text, q }
export const WORLDS      // [{ id, name, emoji, from, to }] — noms de mondes, JAMAIS de classe
export const OOV         // Set des mots des textes absents du lexique Vosk (validés par le joker [unk])
export function storyById(id)
export function classBonus(classe) → ⭐ offertes pour le déblocage (= need de la 1re histoire du monde de sa classe)
export function isUnlocked(story, profile)        // need ≤ totalStars + classBonus
export const axis = 'fr.fluence'
export function gen(A, rng, opts) → item { kind: 'story', storyId, key: 'fr.fluence:<id>', A: story.lvl }
```
Ids v11 **inchangés** (les ⭐ migrées y sont attachées). Mondes : « Premiers galops 🐣 », « Petit trot 🌱 », « Grand galop 🐎 », « Champion 🏆 », « Cavalier émérite 🎖️ », « Légende du ranch 🌟 ».

## 7. Jeux

### 7.1 Interface d'un jeu
```js
export default {
  id: 'tables', title: 'Le Galop des tables', icon: '🏇', axes: ['ma.faits'],
  css: 'css/games/tables.css',       // chargé par le shell avant mount
  async mount(root, ctx) { … },      // construit son DOM dans root, pilote la manche
  unmount() { … }                    // stoppe minuteries, écouteurs, sons, micro
}
```

### 7.2 Contexte `ctx` (fourni par `js/ui/game-shell.js`)
```js
ctx = {
  game, mode,                    // entrée du registre ; 'balade' | 'libre'
  profile, classe, settings,     // profil vivant (lecture seule par convention)
  fill(str),                     // fillTemplate(str, profile)
  axis, count,
  nextItem(axis?, opts?) → item | null,
  report(item, outcome) → feedback,     // feedback = { r, correct, streak, fails, apples, assistNext, thetaBefore, thetaAfter }
  hints: { left() → n, use() → boolean },
  progress(i, n, states?),       // pastilles d'en-tête (states : 'done' | 'helped' par item)
  setTitle(text),
  end(extra?) → Promise<summary>,// termine la manche → bilan par la coquille → retour ; extra.skipSummary : retour direct ;
                                 // extra.stay : la coquille ne fait RIEN (le jeu affiche ses résultats, ex. la course)
  again(),                       // nouvelle manche, même jeu, jeu toujours monté (« Revanche », « Suite »)
  leave(),                       // sortir sans bilan (balade → #/balade, libre → #/home)
  quit(),                        // abandon doux (← / retour Android) : manche.abort() puis sortie
  motion, audio, tts, speech, kit,
  rng,
  onJoker(fn),                   // fn(itemCourant) appelé quand l'enfant touche 💡 ; renvoyer false si aucun indice montré
  announce(text),                // annonce aria-live (lecteurs d'écran)
  applesEl                       // élément 🍎 de l'en-tête (cible de motion.flyTo)
}
```
`outcome` = `{ correct, hinted, ms, tries }` (course : cf. §5.7). Les pastilles se mettent à jour **automatiquement** à chaque `report` ('done' du premier coup sans aide, sinon 'helped') ; un jeu qui appelle `ctx.progress(...)` reprend la main. Implémentation : `js/ui/game-ctx.js`.
Extensions d'API constatées en phase 1 (compatibles) : voir les rapports d'agents ; notamment `manche.useHint(item?)`, `report` → `{ …, hinted, wallet }` (course : `stars`, `best`, `newBest`, `obs`), bilan → `{ …, streakCount, usedFreeze, dayBonus, aborted, race }`, `speech.startListening` → `onText(texte, final)`, `kit.keypad(...).answer` (élément d'affichage), `kit.cheer('learn')`, `audio.melody(steps)`, `motion.flyTo(..., { onArrive })`.

### 7.3 Déroulé d'un item (identique dans tous les jeux)
1. `item = ctx.nextItem()` ; `null` → `ctx.end()`.
2. Si `item.assist` → bulle d'indice affichée d'emblée (« Petit coup de pouce : … »), l'item compte comme aidé.
3. Réponse juste du 1er coup → célébration (pop + paillettes + note qui monte avec la série) → `report({ correct: true, hinted: false })`.
4. 1re erreur → secousse douce + son « bois » + **indice** → 2e essai. Juste → `report({ correct: true, hinted: true, tries: 2 })`.
5. 2e erreur → la bonne réponse est montrée avec `item.explain` → bouton « J’ai compris ✓ » → `report({ correct: false, hinted: true, tries: 2 })`.
6. Joker 💡 (2 par manche, en-tête) → indice avant de répondre, l'item compte comme aidé.
Aucun chronomètre affiché sauf si `settings.timers` (réglage parent) — et alors sous forme de jauge douce, sans échec au temps écoulé.

### 7.4 Les six jeux (v2.0)
| id | Jeu | Axe | Points clés |
|---|---|---|---|
| `course` | La course de {N} | fr.fluence (+ fr.comp_ecrit, item `kind: 'question'`) | moteur v11 **verbatim** ; Zip adaptatif = médiane des 5 derniers MCLM × 1,05, borné à `mclmTarget(classe)` (défaut : cible de l'histoire) ; question de compréhension après la course ; mode libre = liste des mondes ; mode balade = histoires choisies par `gen(A, rng, { profile })`, enchaînées jusqu'à `count` (« Histoire suivante ➜ »), manche close après la dernière (`end({ stay: true })` puis `leave()`) ; rapport de course avec `read` (mots lus) |
| `cloture` | Le Chemin de la clôture | ma.ligne | clôture graduée SVG ; lire le nombre pointé (QCM à 6 choix en CP/CE1 et pour les fractions, pavé sinon) ou placer un nombre (toucher, flèches, clavier ; aimantation aux piquets ou grille d'un dixième d'intervalle à l'estime, tolérance ≥ ±2 dixièmes) ; saut en arc du compagnon ; zoom (caméra viewBox + mini-carte) |
| `tables` | Le Galop des tables | ma.faits | coureur rythmique ; Leitner par fait ; pavé **ou voix** (micro dans la case libre du pavé, grammaire `grammarFor(1000)`, juge vocal dans `tables-logic.js`) ; mode zen par défaut ; en CM1-CM2, ~10 % de faits additifs |
| `pommes` | Pommes express | ma.procedures | série calme ; sprint 60 s seulement si `settings.timers` (jauge en pause pendant les explications, fin après l'item en cours, `ctx.end({ sprint })`) ; estimations en QCM ; stratégie montrée après erreur |
| `orchestre` | Le Chef d’orchestre | fr.conjug | métronome ; conjuguer en rythme, accord sujet-verbe, temps du verbe parmi 4 ; tempo progressif |
| `operations` | L’Atelier des opérations | ma.operations | grille posée interactive colonne par colonne (pavé de 10 chiffres à saisie immédiate), retenues guidées, règle des 0, potence ; `ctx.nextItem(undefined, { subMethod })` ; `item.data` documenté en tête de `js/content/maths/operations.js` |

## 8. Plateforme

### 8.1 Moteur vocal (`js/core/speech.js`) — CDC v11 §4, **ne pas régresser**
Code v11 déplacé **à l'identique** (chargement Vosk + cache `vosk-model-v1` avec progression, capture `getUserMedia` → `AudioContext({sampleRate:16000})` → `ScriptProcessor(4096)` → gain 0, `KaldiRecognizer(sampleRate, grammar)` avec repli sans grammaire, secours Web Speech avec relance `onend`, `ERR_MSG`). Seule généralisation : la grammaire et la destination du texte sont des paramètres.
```js
export const VOSK_LIB, MODEL_URL, ERR_MSG
export function onStatus(fn) → unsubscribe ; export function statusText() → string
export function ensureVosk(onPct?) → Promise<boolean>
export async function startListening({ grammar, onText, onError }) → { engine: 'vosk' | 'webspeech' | null }
   // grammar : string[] déjà normalisé (+ '[unk]' ajouté par le moteur) ou null (reco libre)
   // onText(texteCumulé) à chaque résultat partiel ou final (finalTranscript + ' ' + partiel, comme v11)
export function stopListening() ; export function resetTranscript() ; export function isListening()
export function speechSupported() → boolean
```
L'alignement mot à mot (tokenize, computeProper, FORGIVE, isMatch, levenshtein, pauses, joker `[unk]`) reste **dans le jeu course**, copié à l'identique. Amélioration v2 : les mots de `OOV` présents dans le texte rejoignent l'ensemble des noms propres (validables par `[unk]`).

### 8.2 Autres modules
- `numbers-fr.js` : `toWords(n)` (formes du lexique : « quarante-deux », « vingt-et-un », « soixante-et-onze », « quatre-vingts »…), `grammarFor(max)`, `parseSpoken(texte) → nombre | null` (chiffres ou mots, traits d'union ou espaces, « et »).
- `tts.js` : `speak(texte, opts) → Promise<boolean>` (false si aucune voix fr : l'appelant affiche déjà le texte), `stopSpeaking()`, `ttsAvailable()`.
- `audio.js` : `unlock()`, `setMuted(b)`, `isMuted()`, `beep(f, dur, gain)` (compatible v11), `success(step)` (pentatonique montante), `soft()` (bois doux), `tap()`, `coin()`, `fanfare()`, `whoosh()`, `neigh()`, `clipClop()`, `metronome({ bpm, beatsPerBar, onBeat }) → { stop(), setBpm() }`.
- `motion.js` : `EASE`, `DUR`, `setMode('full'|'soft')`, `reduced()`, `pop`, `squash`, `shake` (6 px), `enter`, `stagger`, `flyTo(from, to, { emoji, count })`, `burst(x, y, opts)`, `sparkle(el)`, `countUp(el, from, to, dur)`, `morphPolygon(poly, fromPts, toPts, dur)`, `confetti()`, `viewTransition(fn)`. Mouvement réduit (préférence système ou réglage « animations douces ») → fondus uniquement.
- `kit.js` : `keypad(opts)`, `choiceGrid(choices, opts)`, `toast(msg)`, `bubble(text, kind)`, `sheet(opts)`, `confirmSheet(text, opts)`, `celebrateRight(el, streak)`, `gentleWrong(el)`, `cheer(kind, rng)` (phrases d'encouragement variées).

### 8.3 Routeur et écrans
Routes : `#/home`, `#/profiles`, `#/onboarding`, `#/welcome`, `#/balade`, `#/play/<id>?mode=balade&block=<i>` (sinon libre), `#/progres`, `#/parents`, `#/import?from=…`. Un écran = `export default { async mount(root, params, query), unmount() }`.
Démarrage (`main.js`) : `store.init()` → réglages du profil actif (son, mouvement) → SW + bandeau → route initiale : aucun profil → `#/onboarding` ; profil actif sans classe → `#/welcome` ; ≥ 2 profils et pas encore choisi dans cette session → `#/profiles` ; sinon `#/home`.

### 8.4 Service worker (`sw.js`) — CDC §13.4
Cache `caramel-<VERSION>` pré-rempli avec `ASSETS` (liste générée). `install` : précache ; `skipWaiting()` immédiat **seulement** si l'ancien cache v11 `caramel-shell-v1` existe (bascule v11 → v2 sans bandeau). `activate` : supprime les caches `caramel-*` obsolètes (**jamais** `vosk-model-v1` ni `vosk-lib-v1`), `clients.claim()`. `message {type:'SKIP_WAITING'}` → `skipWaiting()`. `fetch` : GET même origine hors `/models/` → navigation servie par `index.html` du cache (repli réseau) ; ressources cache d'abord puis réseau ; `VOSK_LIB` (jsDelivr) mis en cache `vosk-lib-v1`. Rappels quotidiens `periodicsync caramel-daily` + `notificationclick` conservés.
Page : nouvelle version en attente → bandeau « Nouvelle version — touche pour mettre à jour » → `SKIP_WAITING` → rechargement au `controllerchange` (seulement après ce geste).

## 9. Design system (`css/base.css`, ✅ écrit)
Jetons : `--bg-*`, `--ink…--ink-5`, `--title`, `--pink-*`, `--amber-*`, `--ok*`, `--soft*` (erreur douce), `--fr`/`--ma`, `--r-s/m/l/pill`, `--shadow-1/2/btn`, `--font-ui` (Fredoka), `--font-read` (Andika), `--ease-out`, `--ease-pop`, `--dur-1/2/3` (150/300/600 ms), `--safe-*`.
Classes : `.screen` (`.is-full` plein cadre), `.stack`, `.row`, `.grid-2`, `.title`, `.title-xl`, `.subtitle`, `.section-title`, `.read`, `.num`, `.muted`, `.small`, `.topbar`/`.back`/`.topbar-title`, `.btn` (`.pink` `.white` `.ghost` `.big` `.small` `.block`), `.btn-icon`, `.card` (`.tap` `.dashed` `.hero` `.locked`), `.chip`, `.wallet`, `.badge`, `.dots`/`.dot` (`.done` `.helped` `.now`), `.gauge`, `.choices`/`.choice` (`.right` `.wrong` `.dim`), `.answer`, `.keypad`/`.key` (`.ok` `.del`), `.bubble` (`.hint` `.soft` `.good`), `.banner`, `.toast`, `.overlay`/`.sheet`, `.field`/`.input`/`.seg`/`.switch`.
Chaque écran/jeu ajoute son CSS dans `css/ui/` ou `css/games/` et **réutilise les jetons** (aucune couleur en dur hors palette).

## 10. Tests et validation
- `node tests/run.mjs` : tous les `tests/*.test.mjs` (migration, store, profils/templating sur 2 genres × 8 montures, économie, adaptatif, Leitner, session, radar-model, numbers-fr, chaque générateur — déterminisme, bornes, réponses justes, ≥ 200 items distincts par palier —, conjugaison, histoires — ni apostrophe ni trait d'union, lexique Vosk, ≥ 150 mots en CM2 —, cohérence `sw.js`/fichiers).
- `node tools/check.mjs` : `node --check` sur chaque module + tests.
- Bancs d'essai navigateur (`tests/harness/`) + parcours de bout en bout en Chrome headless avant chaque push (capture en 390 × 844).
- Avant push : `node tools/precache.mjs` (liste ASSETS + VERSION à jour).
