# Caramel 2 — Architecture & contrat des modules (v2.2.2)

> Document technique compagnon du **CDC v2** (`docs/CDC-v2.md`, la spec produit).
> Il fixe les **interfaces exactes** entre modules : toute personne (ou agent) qui écrit un module
> respecte ce contrat, et toute évolution d'API met ce fichier à jour dans le même commit.

## 0. Principes

- **Site statique GitHub Pages, sans build, sans backend.** ES modules natifs, imports relatifs **avec extension `.js`**. Aucune dépendance npm à l'exécution (seule exception : `vosk-browser` chargé depuis jsDelivr, comme en v11 ; v2.2.2 : la voix fluide, téléchargée à part, prend `onnxruntime-web` 1.22.0 — repli 1.18.0 — et `@diffusionstudio/piper-wasm` 1.0.0 sur jsDelivr, versions figées, jamais copiés dans le dépôt, §8.8).
- **Local-first** : tout reste sur l'appareil (localStorage). Échanges uniquement par export/import de fichiers.
- **Bienveillance** (CDC §1, §7.7) : aucune perte de 🍎/⭐, aucune note, jamais de niveau scolaire affiché à l'enfant (pas de « CE2 » visible côté enfant, sauf sa propre classe dans les réglages), erreurs signalées en **orange doux** (jamais rouge), toujours un indice puis une nouvelle chance.
- **Français irréprochable** dans tous les textes affichés : accents, majuscules accentuées (À, É), apostrophe typographique `’` dans l'interface, espace fine insécable avant `; : ! ?` et après `«` / avant `»` (helper `frTypo`). **Exception** : les textes lus à voix haute (histoires de la course) n'ont **ni apostrophe ni trait d'union** (contrainte de reconnaissance vocale, CDC v11 §8).
- **Modules purs** = importables par Node pour les tests : aucun accès à `window`, `document`, `localStorage`, `navigator` **au chargement** du module. Sont purs : `js/core/{util,rng,axes,levels,profiles,migrate,economy,adaptive,leitner,session,radar-model,numbers-fr,themes,family}.js`, `js/games/index.js`, `js/content/**`. `store.js` est testable avec un stockage injecté. Importables par Node sans toucher au DOM au chargement (v2.1) : `js/ui/companion-life.js` (planificateur, ciel, stades) et `js/ui/radar-detect.js` (traitement d'image sur des tableaux RGBA) ; v2.2.2 : `js/core/install.js` (pur : environnement, stockage et cible des événements passés en paramètres), `js/core/voice-clips.js` (`_setBackend` : faux Web Audio), `js/core/voice-fluid.js` (`_setEnv`), `js/core/piper-tts.js` et `js/core/piper-engine.js`.
- **try/catch** autour de tout accès `localStorage`, `caches`, `speechSynthesis`, `AudioContext`, `navigator.*`, `Notification`.
- **Mobile d'abord** (360-430 px) : cibles tactiles ≥ 48 px, retour visuel sur `:active` (pas au `click`), survol seulement dans `@media (hover:hover) and (pointer:fine)`, `100dvh` pour les écrans plein cadre, zones sûres `env(safe-area-inset-*)`, champs de saisie ≥ 16 px, jamais `user-scalable=no`.
- **Aucune donnée nominative d'enfant dans le repo** (les `docs/profil-*.json` sont dans `.gitignore`).
- **Une version = un commit** `v2.x : …` sur `main` ; ce document et le CDC sont mis à jour à chaque déploiement.

## 1. Arborescence et responsabilités

```
index.html                    coquille : <main id="app"> (v2.2, seul repère « main »), polices, css/base.css, js/main.js (type=module)
manifest.webmanifest  sw.js   PWA (sw.js : cache versionné, liste ASSETS générée par tools/precache.mjs)
fonts/                        Fredoka 500/600/700 (interface), Andika 400/700 (lecture) + OFL.txt
audio/voix/<id>.mp3           v2.2.2 — voix enregistrée du compagnon : 358 clips, ≈ 1,8 Mo, HORS précache (générés par tools/voix.mjs)
models/piper/                 v2.2.2 — voix fluide : fr_FR-siwis-medium-f16.onnx (32 Mo, poids float16) + .onnx.json + LISEZMOI.txt
models/fr-small-0.22.tar.gz   v2.2.4 — modèle Vosk vosk-model-small-fr-0.22 (Apache 2.0, 42 Mo) + models/LISEZMOI.txt (origine, empreinte) et LICENSE-Apache-2.0.txt
pages/                        v2.3 — pages publiques statiques (confidentialité, mentions légales, aide, licences ; pages.css, pages.js) :
                              préparées pour Google Play, publiées et liées depuis l'espace parents quand les mentions légales
                              de Manica Labs seront complètes (PAGES_READY de js/ui/parents.js)
store/                        v2.3 — publication sur les stores (jamais précaché) : README (pas à pas Linux), fiche-play.md, twa/
                              (Bubblewrap), visuels/, captures/, sources/, outils/ (visuels.sh, captures.mjs)
                              (origine, empreintes, licences) ; hors précache, jamais intercepté par sw.js (comme le modèle Vosk)
css/base.css                  jetons (thème Caramel), socle mobile, composants partagés (cf. §9)
css/themes.css                v2.1 — les 7 autres thèmes visuels : jetons redéfinis sous [data-theme="<id>"] (cf. §8.5)
css/motion.css                keyframes génériques + règles de mouvement réduit
css/ui/<écran>.css            styles d'un écran (chargés par l'écran via loadCSS)
css/games/<jeu>.css           styles d'un jeu (chargés par le shell avant mount)
js/main.js                    démarrage : store.init (migration), réglages, SW + bandeau de mise à jour, route initiale, router
js/router.js                  routeur hash (#/home, #/play/<id>?…), transitions de vue
js/core/util.js               ✅ écrit — dates, nombres FR, h()/svg(), loadCSS, download…
js/core/rng.js                ✅ écrit — PRNG seedé (makeRng)
js/core/axes.js               ✅ écrit — référentiel AXES, CLASSES, SUBJECTS, gabarits radar et gabarits des fiches Repères (§8.7)
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
js/core/themes.js             v2.1 — catalogue des 8 thèmes visuels (pur)
js/core/family.js             v2.1 — « En famille » (pur) : classements de la semaine, concours de compagnons, points du défi
js/core/duel.js               v2.3 — « 👫 Avec un copain » (pur) : code de partie à 4 chiffres, règle commune liée au jour, carte de résultat (§5.9 bis)
js/ui/duel.js                 v2.3 — « Avec un copain » (#/duel) : je lance / je rejoins, code en très grand (+ css/ui/duel.css)
js/ui/wipe.js                 v2.3 — « Effacer toutes les données de cet appareil » (espace parents, §8.13)
js/ui/voice-answer.js         v2.3 — répondre à voix haute dans les jeux (🎤 + ligne 👂, nombres ou choix ; §8.15) (+ css/ui/voice-answer.css)
js/core/voice-choice.js       v2.3 — juge des choix dits (pur) : wordsOf, choiceGrammar, matchChoice, createChoiceJudge
js/core/battle-voice.js       v2.3 — voix du Défi en famille et d'Avec un copain (pur) : voicePlan(item)
js/games/orchestre-voice.js   v2.3 — formes dites des choix du Chef d'orchestre, clé sonore, mots hors du lexique (VOICE_OOV)
js/core/speech.js             moteur vocal v11 (Vosk + secours Web Speech), API généralisée
js/core/numbers-fr.js         nombres ↔ mots (formes du lexique Vosk), analyse des nombres dits
js/core/tts.js                synthèse vocale fr-FR (avec texte affiché en secours) : la « voix du téléphone »
js/core/voice-clips.js        v2.2.2 — lecture des clips de la voix enregistrée (Web Audio, cache 'caramel-voix-v1'), §8.8
js/core/voice-fluid.js        v2.2.2 — voix fluide : quand télécharger, démarrer, étalonner ; file des phrases ; aiguillage pur (§8.8)
js/core/piper-tts.js          v2.2.2 — voix fluide : fichiers, cache 'piper-tts-v1', chargement du moteur (page ou worker)
js/core/piper-engine.js       v2.2.2 — moteur Piper : phonèmes (piper-phonemize + espeak-ng) → onnxruntime-web → son ; PARAMS, YOUTH (voix d'enfant)
js/core/piper-worker.js       v2.2.2 — worker module qui fait tourner le moteur hors du fil principal
js/core/install.js            v2.2.2 — invitation à installer (pur) : navigateur, méthode, mémoire 'caramel-install', §8.9
js/core/audio.js              sons WebAudio synthétisés (aucun fichier), métronome, muet ; context() (v2.2.2) : contexte partagé avec les voix
js/core/motion.js             Web Animations API : pop, squash, flyTo, burst, countUp, shake, morphPolygon…
js/ui/kit.js                  composants de jeu : pavé numérique, QCM, toast, bulle, feuille, célébrations
js/ui/game-ctx.js             ✅ écrit — construit le ctx d'un jeu à partir d'une manche (partagé coquille / banc d'essai)
js/ui/game-header.js          ✅ écrit — en-tête commun des jeux (retour, titre, joker 💡, 🍎, pastilles)
js/ui/mount-svg.js            v2.1 — compagnon SVG redessiné (8 espèces, rig commun, expressions, stades) + css/ui/mount.css (animations du rig)
js/ui/companion-life.js       v2.1 — moteur de vie du compagnon (attente, regard, sommeil, réactions aux soins) + ciel jour/nuit/saisons
js/ui/voice.js                v2.2 — voix du compagnon (lecture à voix haute, 🔊) ; v2.2.2 : aiguillage entre les trois voix, cf. §8.8
js/ui/voice-fluid.js          v2.2.2 — ligne « Voix fluide » de l'espace parents (rowModel pur, parentsRow)
js/ui/install.js              v2.2.2 — « 📲 Mets Caramel sur l'écran d'accueil » : feuille, bannière, ligne parents (+ css/ui/install.css), §8.9
js/ui/diag.js                 v2.2.2 — carte « État de cet appareil » (espace parents › À propos), §8.10
js/ui/theme-picker.js         v2.1 — application du thème (html[data-theme], theme-color), grille de choix, feuille « Choisis ton univers »
js/ui/radar-detect.js         v2.1 — détection automatique du radar photographié (+ radar-detect-worker.js, Web Worker)
js/ui/<écran>.js              écrans (home, profiles, onboarding, balade, game-shell, progres, parents, import-eval, backup, radar, companion,
                              famille et battle en v2.1)
js/games/index.js             ✅ écrit — registre des 6 jeux (chargement paresseux)
js/games/<id>.js              un fichier par jeu (interface §7)
js/content/index.js           ✅ écrit — registre paresseux des générateurs par axe
js/content/companion-data.js  MOUNTS, FOODS, SHOP, constantes du compagnon (données v11)
js/content/maths/{ligne,faits,procedures,operations}.js
js/content/fr/{conjug,verbs}.js
js/content/stories/{index,legacy,cm2,questions}.js
js/content/voice-lines.js     v2.2.2 — inventaire des phrases enregistrées (LINES), plan d'une phrase en clips, texte de la voix fluide
js/content/voice-manifest.js  v2.2.2 — GÉNÉRÉ par tools/voix.mjs : id → [durée ms, empreinte] (VOICE.clips, VOICE.base)
tests/run.mjs                 mini-harnais : exécute tests/*.test.mjs (node:assert/strict), code ≠ 0 si échec
tests/*.test.mjs              tests unitaires (Node 20)
tests/lexicon.mjs             extrait le lexique du modèle Vosk (MODEL_URL : models/fr-small-0.22.tar.gz) → Set de mots
tests/harness/*.html          bancs d'essai navigateur ; game.html monte un jeu avec le VRAI ctx et une sauvegarde en mémoire
                              (game.html?id=tables&classe=CM2&theta=1.2&mode=libre&count=10&theme=dinosaures ; demo-game.js = jeu de
                              référence §7.3) ; companion.html = planche du compagnon ; radar-detect.html = banc de la détection ;
                              piper.html (v2.2.2) = banc d'essai de la voix fluide (importe js/core/piper-tts.js)
tools/precache.mjs            régénère la liste ASSETS + VERSION de sw.js
tools/check.mjs               node --check sur tous les modules + tests
tools/voix.mjs                v2.2.2 — génère les clips (Piper + ffmpeg) et le manifeste ; --check, --force, --only=<préfixe>
tools/piper-modele.py         v2.2.2 — convertit les poids du modèle Piper en float16 → models/piper/ (déterministe)
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
        stage: 1,               // dernier stade FÊTÉ (1-3) ; le stade affiché vient des minutes (§8.6)
        minutes: 0              // minutes d'apprentissage cumulées : stades petit < 60 ≤ junior < 300 ≤ champion
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
      settings: { sessionMin: 15, timers: false, sound: true, motion: 'full', subMethod: 'compensation', theme: 'caramel', readAloud: 'on' },   // motion : 'full' | 'soft' ; subMethod : technique de soustraction posée de l'école, 'compensation' | 'cassage' (BO n°41 2024 : un seul algorithme par école, CE1→CM2) ; theme : thème visuel (§8.5, id inconnu → 'caramel') ; readAloud (v2.2) : lecture des consignes à voix haute, v2.2.2 : 'on' (Oui, défaut, TOUS les enfants) | 'off' (Non) ; l'ancien 'auto' (CP-CE1), un réglage absent ou inconnu → 'on' ; false → 'off' (§8.8)
      stats: { minutes: 0, sessions: 0, items: 0,
               week: { w: '2026-W40', minutes: 12.5, apples: 40, items: 30 } },   // v2.1, facultatif : effort de la semaine ISO (§5.2)
      trophies: [ { k: 'defi', d: '2026-10-03', w: '2026-W40', n: 3, pts: 640 } ],    // v2.1, facultatif, ≤ 300 : 'defi' | 'concours'
      medals: { 'ma.faits': 'or', 'fr.vocab': 'argent' },  // v2.1 : meilleure médaille déjà montrée par axe, JAMAIS retirée ; absent = profil d'avant la 2.1 → legacyMedals (règle v2.0)
      seen: { tour: true, games: { tables: true } }        // v2.2.1, facultatif : « déjà vu » (§5.1) — visite guidée de l'accueil, phrase du compagnon à la 1re partie de chaque jeu ; again: true après « Revoir la visite guidée »
    }
  }
}
```

Invariants (garantis par `normalizeProfile`) : nombres finis et bornés (jauges 15-100, θ 0-3, 🍎 ≥ 0 entier), `companion.type` ∈ MOUNTS, `owned` contient `pony` et le type courant, `worn` ⊆ `equip.owned` avec un seul objet par emplacement, tableaux plafonnés (history 500, mclm 300, snapshots 104).

Clés v2.3 : `caramel-duel-prefs` (appareil : `{ rounds, last }`, longueur choisie et dernier code donné), `sessionStorage['caramel-duel']` (partie « Avec un copain » en cours ou finie, par code et jeton : reprise, bilan sans double gain), `sessionStorage['caramel-app']` (`'android'` : appli Google Play, cf. §8.14), `sessionStorage['caramel-wipe']` (effacement à finir au démarrage, §8.13) ; v2.2.3 : `caramel-debug`, `caramel-debug-log` (§8.11), `caramel-prechargement` (§8.12).

Autres clés localStorage : `caramel-save-v2` (v11) et `caramel-progress-v1` (v1-v10) **jamais supprimées en v2.0** ; `caramel-backup-v11` (copie brute, écrite une seule fois) ; `caramel-notifs` (préférence d'appareil, héritée de v11, inchangée) ; `caramel-theme` (v2.1 : `'<id>|#<couleur>'`, cache d'affichage du thème du profil actif, lu par le petit script en ligne d'`index.html` avant le premier rendu pour éviter un éclair des couleurs Caramel) ; `sessionStorage['caramel-picked']` (profil choisi pendant cette session d'utilisation) ; `caramel-parent` (v2.1, réglages d'APPAREIL de l'espace parents, jamais exportés : `{ v: 1, pin: { h, s } | null, fails, strikes, until, later, saved: { idProfil: { at: ISO, name } } }` — code parent facultatif à 4 chiffres stocké **haché**, jamais en clair : `h` = SHA-256(`s` + ':' + code) en hexadécimal, `s` = sel aléatoire, crypto.subtle ou le même calcul en JavaScript hors https (`util.sha256Hex`) ; `fails` / `strikes` / `until` = 3 erreurs de suite → attente de 30 s doublée à chaque série (8 min au plus) ; `later` = jour du « Plus tard » de l'invitation au code ; `saved` = date de la dernière sauvegarde téléchargée d'ici, par profil, avec le prénom de ce moment-là (`backup.noteSaved` / `lastSaved` / `forgetSaved`) : oubliée quand le profil est supprimé ou réécrit par une restauration (toutes pour « Tout remplacer »), et jamais montrée si le prénom ne correspond plus, car un identifiant de profil peut resservir à un autre enfant) ; `sessionStorage['caramel-parents-until']` (porte des parents ouverte jusqu'à cette heure, 10 minutes glissantes, effacée dès qu'on quitte l'espace parents sauf vers l'import de fiche). v2.2.2, mémoires d'APPAREIL jamais exportées : `caramel-install` (`{ v: 1, later, done }` en ms : « Plus tard » ou ✕ = 7 jours sans invitation, `done` = installé, §8.9) ; `caramel-voix-fluide` (voix fluide, §8.8 : `launches` (ouvertures de l'appli), `want: 'parent'` (téléchargement demandé par un parent, à reprendre après un jeu), `started`, `removed` (« Supprimer »), `v` / `verdict` ('ok' | 'slow') / `rtf` / `bootMs` / `ort` / `at` (étalonnage de la version `v`), `ortFailed`). Cache Storage (§8.4) : `caramel-voix-v1` (clips) et `piper-tts-v1` (voix fluide), gardés à chaque mise à jour.

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
export const DEFAULT_SETTINGS   // { sessionMin: 15, timers: false, sound: true, motion: 'full', theme: 'caramel', readAloud: 'on' }
export const READ_ALOUD_MODES   // v2.2.2 : ['on', 'off'] ('auto' d'avant la 2.2.2 → 'on')
export function hasSeen(profile, key) → boolean             // v2.2.1 : key = 'tour' | 'game:<id>'
export function markSeen(profile, key, on = true)           // v2.2.1 : dans store.mutateProfile ; on = false oublie
```
v2.1 : `settings.theme` normalisé par `normalizeTheme` ; `stats.week` gardé seulement si sa semaine est lisible (`AAAA-Www`) ; `trophies` normalisés (types connus, ≤ 300).
v2.2.1 : **« déjà vu »** `profile.seen = { tour, games: { <id>: true }, again? }` — la visite guidée de l'accueil (§8.6 bis) et la phrase du compagnon à la 1re partie de chaque jeu (§7.1, `GAME_HELLO`) ne viennent qu'une fois par enfant. Champ facultatif, jamais ajouté d'office : absent = rien vu. Un profil d'avant la 2.2.1 voit donc la visite une fois (l'accueil a changé en 2.2), mais pas la phrase d'un jeu auquel il a déjà joué (`playedBefore` de `js/ui/game-shell.js` : une partie dans `history`, ou pour la course une histoire dans `wallet.stars`, v11 comprise) ; le jeu est alors noté vu sans rien montrer. Normalisation : `tour` booléen, `games` ne garde que les valeurs `true` dont l'id suit `/^[a-z][a-z0-9_-]{0,23}$/` (jamais `__proto__`), `again` gardé seulement s'il était présent (booléen), clés inconnues conservées. « 🔁 Revoir la visite guidée » (espace parents) remet `tour` et `games` à zéro et pose `again: true` : les phrases reviennent alors aussi pour les jeux déjà joués.
`tplMap` reprend **exactement** le dictionnaire v11 (`MOUNTS[type].g` pour le genre de la monture, `profile.g` pour le héros, `companion.name` pour `{N}`, `name` pour `{P}`).

### 5.2 Économie (`js/core/economy.js`)
```js
export const BADGES = { bronze: 1.5, argent: 2.25, or: 2.75 };
export function totalStars(profile) → Σ min(3, ⭐)
export function addApples(profile, n)
export function bumpStreak(profile, today) → { bonus, count, usedFreeze }
export function refreshFreeze(profile, today)               // 1 gel offert par semaine ISO (freezes = max(freezes, 1))
export function badgeOf(theta) → null | 'bronze' | 'argent' | 'or'
// v2.1 — « En famille »
export function addApples(profile, n, today)                // un GAIN compte aussi dans les pommes de la semaine
export function weekCounter(profile, today) → { w, minutes, apples, items }   // crée ou reprend le compteur de la semaine ISO
export function bumpWeek(profile, { minutes, apples, items }, today) → compteur
export function weekFromHistory(profile, w) → { minutes, items }   // amorce d'un compteur neuf depuis history
export const TROPHY_KINDS = ['defi', 'concours'], TROPHIES_MAX = 300
export function addTrophy(profile, kind, today, extra) → entrée { …extra, k, d, w }
```
Série (règle v11 + gel) : même jour → rien (bonus 0) ; dernier jour = hier → count + 1 ; dernier jour = avant-hier et `freezes > 0` → gel consommé, count + 1 ; sinon count = 1. Bonus = 10 🍎, + 50 si `count % 7 === 0`. Appelée à la **première manche terminée du jour** (par `manche.finish`).
Compteur de la semaine (v2.1) : remis à zéro au premier ajout d'une nouvelle semaine ISO (lundi) ; horloge reculée → on continue dans la semaine enregistrée ; amorcé depuis `history` (minutes et items des manches de la semaine, les pommes n'y étant pas).

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
export function weakKeys(profile, prefix, limit = 12) → keys         // boîte 1, et boîte 2 si déjà manqué (ok < seen) : « à revoir » côté parents
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
export function createManche({ gameId, axis, count, mode = 'libre', blockIdx = null, offset = 0, today = dayStr(), seed, profileId })
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
`profileId` (v2.1, défi en famille) : la manche lit et écrit **ce** profil, même si le profil actif change pendant la manche (défaut : profil actif).
`finish` : entrée `history` (plafond 500), `stats`, compteur de la semaine (`bumpWeek` : minutes actives et items, compté **avant** l'ajout à l'historique), `companion.minutes`, `bumpStreak` (première manche du jour), `completeBlock` (mode balade), `snapshotIfNeeded`, `trend` → `summary = { gameId, axis, n, correct, clean, hinted, apples, streakBonus, thetaBefore, thetaAfter, ms, dayDone }`.

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

### 5.9 En famille (`js/core/family.js`, pur) — v2.1, CDC §10.4
Plusieurs enfants sur un même appareil : classements de la semaine, concours de compagnons, défi à tour de rôle. **On ne classe que l'effort et l'engagement** (minutes, pommes, régularité, lecture, défis), **jamais le niveau ni θ** ; le défi pose à chacun des questions **à son niveau** ; rangs denses (1, 1, 2), ex aequo partout, jamais de « dernier », une valeur nulle ne monte pas sur le podium.
```js
export function weekRange(today) → { w, from, to, label }     // « du lundi 28 septembre au dimanche 4 octobre »
export function weekStats(profile, today) → { w, minutes, apples, items }   // compteur d'une autre semaine → depuis history
export function liveStreak(profile, today) → n                // série vivante : dernier jour = aujourd'hui, hier (ou avant-hier + gel)
export function trophiesOf(profile, kind?, week?) → trophées
export const BOARDS, BOARD_BY_ID                              // ⏱️ minutes · 🍎 pommes de la semaine · 🔥 série · ⭐ étoiles (total) · 🏅 défis gagnés
export function boardValue(profile, id, today) → entier
export function rankRows(rows) → [{ …row, rank, tie, medal: 'or'|'argent'|'bronze'|null }]
export function weeklyBoards(profiles, today) → [{ …board, rows, podium, others, empty }]
export const STAGE_MINUTES = [0, 60, 300], STAGE_NAMES, CONCOURS, JURY   // 🦉 croissance · 🐰 soins · 🦚 élégance
export function stageOf(companion) → 1|2|3                    // max(companion.stage, stade des minutes)
export function gaugesNow(pet, now) → { faim, forme, joie }   // mêmes règles de décroissance que la carte du compagnon
export function companionScore(profile, now) → { stage, minutes, gauges, accessories, mounts, notes: { growth, care, style }, total }
export function concoursResults(profiles, now) → [{ id, score, total, rank, tie, medal, ribbon: { id, icon, label, best } }]
export function concoursAwarded(profiles, w) ; concoursWinnersToAward(results, profiles, w)   // un trophée 'concours' par semaine
export const BATTLE, CHALLENGES, CHALLENGE_BY_ID, AUTO_MS      // défis : tables, calcul, conjug, mélange ; 2 à 4 joueurs ; 3 ou 5 manches
export function battleAxis(challengeId, round, classe) ; battleAxes(challengeId, rounds, classes)   // avant le CE1 : pas de conjugaison
export function autoMsOf(item) ; speedBonus(ms, autoMs) ; questionPoints({ correct, ms, autoMs, streak }) → { base, speed, streak, total }
export function battleRanking(players) → { rows, resting, winners, tie } ; battleRewards(players, ranking) → { id: { apples, trophy } }
export function trackFrac(points, rounds) ; rotate(ids, k)    // piste de la course ; ordre de passage de la revanche
```
Concours : croissance = 100 par stade + 1 par minute (300 au plus) ; soins = moyenne des jauges × 3 ; élégance = 25 par accessoire + 15 par compagnon en plus du poney. Chacun reçoit un ruban (grand ruban s'il a la meilleure note d'un domaine, sinon ruban d'encouragement). Défi : + 100 si juste, + 50 de rapidité avant le seuil de l'item puis décroissance jusqu'à 3 × le seuil, + 10 par bonne réponse d'affilée (30 au plus) ; faux = 0, jamais de points retirés ; fin : 5 🍎 de participation, + 10 🍎 et un trophée pour le ou les gagnants. Chaque question est une vraie manche du joueur (`createManche({ profileId })`) : θ, Leitner, pommes et compteur de la semaine du bon enfant.

### 5.9 bis Avec un copain (`js/core/duel.js`, pur) — v2.3, CDC §10.4
Décision du parent du 07/10/2026 (palier 1 de l'étude multijoueur : le Bluetooth web ne peut pas faire se trouver deux téléphones, et rien ne le peut dans une PWA). 2 à 4 enfants, chacun sur SON téléphone, sans réseau : le même défi, chacun ses questions à son niveau, les points se comparent (barème du Défi en famille, `axisForClasse`, `questionPoints`…).
```js
export const DUEL = { LEN: 4, GAMES: 100, ROUNDS: [3, 5], DEFAULT_ROUNDS: 5, MIN: 2, MAX: 4 }, CODE_TYPES   // tables, calcul, conjug, melange
export function encodeCode({ type, rounds, game }) → '4821' | null ; decodeCode(v) → { ok, code, type, rounds, game } | { ok: false, reason, code }
   // reason : 'empty' | 'short' | 'long' | 'digits' | 'check' (faute de frappe) | 'kind' (0 ou 9 en tête)
export function newCode({ type, rounds }, rng, avoid) ; isCode ; cleanCode ; codeDigits ; spokenCode(code) → '4. 8. 2. 1.'
export function duelRule(code, jour) → { code, type, rounds, game, day, seed, plan: [axe par manche] } | null
export function duelAxis(rule, round, classe) ; duelAxes(rule, classe)
export function duelRewards(player) → { apples: 5 si une réponse, trophy: false } ; resultCard(profile, { code, points, answered, correct, apples })
export function compareCards(cards, code?) → { code, rows (rang dense, card), winners, tie, resting, others }
```
Code « C NN K » : C = 1 + 2 × type + (5 manches ? 1 : 0) (jamais 0 : le pavé efface un 0 en tête), NN = n° de partie 00-99, K = chiffre de contrôle de Damm (toute faute d'un chiffre, toute inversion de deux voisins refusée : testé sur les 800 codes). Règle : graine `hashSeed('caramel-duel|' + jour + '|' + code)` ; en mélange, paquets des trois types sans répétition consécutive ; avant le CE1, conjugaison → tables. Récompenses : 🍎 des bonnes réponses + 5 de participation, jamais de trophée (l'appli ne sait pas qui a gagné). `resultCard` ne contient jamais le prénom (QR à venir). `history[].mode` peut valoir `'duel'` (manche du duel, `g: 'battle'`). Écrans : `js/ui/duel.js` (`#/duel?step=lance|rejoins|code&code=…&role=hote|invite`), partie et bilan dans `js/ui/battle.js` (`#/battle?duel=<code>&n=<jeton>`, un seul joueur), entrée par la feuille « 🎲 Jeux » de l'accueil (`openGamePicker({ extras })` de `js/ui/balade.js`) et par « En famille ». Tests : `tests/duel.test.mjs`.

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
  intro: true,                       // v2.2.1, facultatif : le jeu se présente lui-même (l'orchestre)
  async mount(root, ctx) { … },      // construit son DOM dans root, pilote la manche
  unmount() { … }                    // stoppe minuteries, écouteurs, sons, micro
}
```
1re partie (v2.2.1, `js/ui/game-shell.js`) : avant `mount`, le compagnon présente le jeu en UNE phrase (`GAME_HELLO[id]`, tutoiement, `{N}` = son nom) avec « C'est parti ▶ », une seule fois par jeu et par enfant (`profile.seen`, §5.1) ; la phrase est toujours écrite, et dite quand la lecture à voix haute est active (§8.8 ; tous les enfants par défaut depuis la 2.2.2). Le jeu n'est monté qu'au toucher, une fois la voix tue (`voice.hush()` puis `voice.settle()` : le jeu peut ouvrir le micro aussitôt). Pas de phrase pour un jeu qui exporte `intro: true`, ni pour un enfant qui y a déjà joué (`playedBefore`, sauf après « Revoir la visite guidée »). Un nouveau jeu sans `intro` ajoute sa phrase à `GAME_HELLO` (`tests/voix.test.mjs` le vérifie).

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
  motion, audio, tts, kit,
  speech,                        // js/core/speech.js tel quel ; v2.2.2 : ensureVosk et startListening appellent d'abord voice.micWillStart()
  voice,                         // v2.2 : { on, say(texte, { quiet }) → Promise<boolean>, hush(), settle() → Promise (v2.2.1),
                                 //   v2.2.2 : prepare(...textes), prepareNext(...textes), canPrepare } — §8.8
  mic,                           // v2.2 : { trouble(code) → { code, hard, title, sub, adultTitle, adult }, help(code, { onRetry, onClose }) } — micro impossible (D1-01, D4-04)
  changeGame(), nextStep(),      // v2.2 : balade — remplacer l'étape par un autre jeu (micro impossible) ; étape suivante après les résultats de la course
  rng,
  onJoker(fn),                   // fn(itemCourant) appelé quand l'enfant touche 💡 ; renvoyer false si aucun indice montré
  announce(text),                // annonce aria-live (lecteurs d'écran)
  applesEl,                      // élément 🍎 de l'en-tête (cible de motion.flyTo)
  pet,                           // v2.1 : compagnon du profil actif → { type, worn, stage, name } (stade : stageOf de js/ui/companion.js)
  petSVG(size, mood?, opts?),    // v2.1 : SVG du compagnon avec ses accessoires ET son stade (mountSVG ; opts : expr, shadow, phase, view)
  petAnchors(opts?)              // v2.1 : mountAnchors du compagnon à son stade (bouche, yeux, sommet… unités du viewBox 100 × 84)
}
```
`ctx.voice.say(texte)` confie au compagnon la phrase du moment (question, indice, explication) : le 🔊 de l'en-tête la relit (v2.2.2 : il apparaît dès que la lecture à voix haute est activée et qu'une voix est possible, sons coupés compris — `voice.listenOn`), elle est dite si la lecture automatique est active (`ctx.voice.on`), jamais micro ouvert ; `{ quiet: true }` la confie au 🔊 sans la dire (micro demandé). `ctx.voice.settle()` (v2.2.1) se résout quand la voix s'est tue et que le moteur a repris son souffle (≈ 250 ms après un `cancel()` ; v2.2.2 : clips et voix fluide compris) : à attendre après `hush()` avant d'ouvrir le micro (Chrome Android : synthèse et reconnaissance se disputent le son).
v2.2.2 : `ctx.voice.prepareNext(texte)` fait calculer par la voix fluide, avant le reste, ce qui sera dit dans moins d'une seconde (la question suivante) ; `ctx.voice.prepare(texte)` ce qui sera peut-être dit (file « plus tard ») ; `ctx.voice.canPrepare` est vrai quand la voix fluide est prête et la lecture automatique active : sinon, rien à préparer (un jeu ne tire pas l'item suivant à l'avance pour rien). Ce qu'un clip couvre n'est jamais calculé.
Les jeux ne dessinent le compagnon que par `ctx.petSVG` (jamais `mountSVG` en direct) : espèce, accessoires et stade (petit / junior / champion) sont ainsi les mêmes qu'à l'accueil ; un jeu qui pose sa propre ombre au sol passe `{ shadow: false }`.
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
   // onText(texteCumulé, final) à chaque résultat partiel ou final (finalTranscript + ' ' + partiel, comme v11)
export function stopListening() ; export function resetTranscript() ; export function isListening()
export function speechSupported() → boolean
```
Ajouts hors v11 (commentés `AJOUT` / `CHANGÉ` dans le code ; seule la relance de l'`AudioContext` concerne aussi la course, `resetTranscript` n'étant appelé que par les tables ; toute modification de ce module se vérifie par la recette Piper « La carotte du matin » : 38/38 mots, 6/6 pauses, 3 ⭐) :
- `resetTranscript()` (v2.2, dictée des tables) oublie aussi la phrase en cours, pour enchaîner des réponses courtes. **v2.2.1** : elle n'est plus coupée net (`retrieveFinalResult` au milieu d'un mot faisait reconnaître la fin seule, « …vingt-un » → « quatre-vingts », jugée sur le calcul suivant). **v2.2.3** : Vosk oublie les mots **déjà entendus** de la phrase en cours (`cutN` mots du résultat partiel, `dropWords`) et garde la suite ; la 2.2.1 ignorait toute la phrase jusqu'au prochain silence, et une réponse dite sans pause après la précédente était perdue (« l'enfant parle et il se passe rien »). Web Speech oublie aussi les résultats finals déjà reçus (`wsSkip = wsLen` : Chrome Android renvoie parfois toute la liste depuis l'indice 0).
- **v2.2.1** : un `AudioContext` du micro suspendu par le système (Android : focus audio, appel, veille ; état `suspended` ou `interrupted`) est relancé aussitôt (`statechange` → `resume()`).
- Statut « reconnaissance Google en secours » aussi quand Vosk est prêt mais ne démarre pas et que Web Speech prend le relais (l'espace parents le signale) ; un double appui pendant le chargement partage le même démarrage ; `stopListening()` pendant le démarrage annule proprement. Tests : `tests/speech-cycle.test.mjs` (faux moteurs Vosk et Web Speech, texte cumulé de la course identique à la v11, santé du micro).
- **v2.2.3, retour terrain du 06/10/2026** (« le micro écoute, l'enfant parle et il se passe rien ; passé 3-4 étapes il a beaucoup de mal »), mesuré sur un banc « enfant simulé » (voix Piper jouée dans un faux micro, jeu des tables réel, processeur bridé par `systemd-run -p CPUQuota=20%`) :
  - **Modèle extrait une fois** (`seedModel`, `modelDir`, `staleKeys`) : vosk-browser range le modèle extrait dans IndexedDB (IDBFS, base `/vosk`) sous un chemin tiré de l'adresse passée à `createModel` ; l'adresse `blob:` de la v11 changeait à chaque ouverture → extraction refaite, **≈ 54 Mo de plus à chaque ouverture** (3 ouvertures = 206 Mo mesurés) et toutes les copies rechargées en mémoire au démarrage du micro. Désormais : adresse fixe (`MODEL_URL` absolue), archive du cache `vosk-model-v1` déposée dans IDBFS (`downloaded.tar.gz` + `downloaded.ok`, `IDB` = base, magasin, version 21 et modes POSIX de l'IDBFS de vosk-browser 0.0.8) : vosk-browser l'extrait sans réseau, une fois ; les copies des anciennes ouvertures sont supprimées (mesuré : 206 → 99 Mo, chargement 3,8 s puis 2,0 s). Repli : la voie v11 du blob. `openModel` borne le chargement (`LOAD_MS`) : la promesse de `createModel` ne finissait jamais si le chargement échouait (« Préparation du micro… » à vie).
  - **Capture sur le fil audio** (`openWorklet`, `js/core/mic-worklet.js`, AudioWorklet) : le `ScriptProcessor` de la v11 tourne sur le fil principal ; quand le jeu l'occupe, le navigateur perd des morceaux de son (fil principal occupé à 90 % : 1 réponse sur 8 comprise, son haché ; 8 sur 8 avec l'AudioWorklet). Repli : le `ScriptProcessor` de la v11.
  - **Santé du micro** (`health()`, `onHealth(fn)`, réglages `TUNING`) : son reçu, niveau, voix, retard du moteur (requêtes en attente dans le worker de vosk-browser, qui traite chaque morceau dans l'ordre sans jamais en sauter : bridé, le retard montait à **28 s**, 0 réponse comprise sur 10, et chaque relance du micro attendait derrière). Au-delà de ≈ 1 s de retard (`softPending`), les blancs ne sont plus envoyés (la voix toujours, 0,8 s de blanc après elle pour finir la phrase, et le morceau d'avant pour l'attaque du mot) ; au-delà de ≈ 4 s (`hardPending`), plus rien jusqu'au rattrapage. Micro muet (plus de son depuis 2 s, ou 4 s de zéros) → micro **rouvert** sans perdre le reconnaisseur (`reopenAudio`, 3 fois par minute au plus). États publiés : `off`, `starting`, `ok`, `slow`, `deaf` ; les jeux barrent le 🎤 (tables, course).
  - **Journal de diagnostic** (`js/core/debuglog.js`, `dlog`) : chargement, écoute, santé toutes les 2 s, résultats partiels et finals, réouvertures.
  - **v2.2.4 — modèle `vosk-model-small-fr-0.22`** (Alpha Cephei, Apache 2.0, `models/fr-small-0.22.tar.gz`, 42 Mo ; décision du parent du 07/10/2026) à la place de `vosk-model-small-fr-pguyot-0.3` (CC BY-NC-SA 4.0, incompatible avec les stores). Mesuré (banc, grammaire des tables) : voix d'enfant simulée 13 sur 14 aux tables (9 sur 14 avant) ; 8 voix × 50 nombres : 320/400 (311 avant) ; hésitations prises pour un nombre : 12/192 (27 avant) ; course « La carotte du matin » 100 %, 3 ⭐ ; lexique de 135 774 mots (nombres, mots d'appoint, et 7 mots des histoires de plus : `OOV` passe de 11 à 4 mots) ; calcul 66 % plus long (fil principal occupé à 90 % : 8 sur 8, 2,9 s). Nouvelle adresse : l'ancien modèle quitte le cache `vosk-model-v1` (`pruneModelCache`) et IndexedDB (`staleKeys`) dès que le nouveau est installé (mesuré : 92 Mo au total).
  - **Préchargement** : `prefetch({ onPct, extract })` (bibliothèque mise en cache même sans service worker, modèle, extraction par un worker aussitôt libéré) et `modelReady()`, pour tout préparer à la première ouverture.
L'alignement mot à mot (tokenize, computeProper, FORGIVE, isMatch, levenshtein, pauses, joker `[unk]`) reste **dans le jeu course**, copié à l'identique. Amélioration v2 : les mots de `OOV` présents dans le texte rejoignent l'ensemble des noms propres (validables par `[unk]`).

### 8.2 Autres modules
- `numbers-fr.js` : `toWords(n)` (formes du lexique : « quarante-deux », « vingt-et-un », « soixante-et-onze », « quatre-vingts »…), `grammarFor(max)`, `parseSpoken(texte) → nombre | null` (chiffres ou mots, traits d'union ou espaces, « et »).
- `tts.js` : `speak(texte, opts) → Promise<boolean>` (false si rien n'a pu être dit : l'appelant affiche toujours le texte) ; `speakResult(texte, opts) → Promise<{ ok, reason, heard }>` (`reason` : `''` | `'cancelled'` (coupée par une autre lecture ou `stopSpeaking`) | `'empty'` | `'no-api'` | `'no-fr-voice'` | `'not-started'` | `'error:<code de SpeechSynthesisErrorEvent>'` ; `heard` : un son est bien sorti) ; `stopSpeaking()` ; `settle() → Promise` (fin de la respiration qui suit un `cancel()`, à attendre avant d'ouvrir le micro) ; `isSpeaking()` ; `ttsAvailable()` ; `diagnose() → { api, voices, fr, frLocal, voice }` (« Tester la voix ») ; `warmUp()` (au premier geste, `js/main.js` : charge la liste des voix ; sur iPhone et iPad, une lecture vide débloque la synthèse) ; `onLateStart(fn) → désabonnement` (une lecture déclarée `'not-started'` a fini par se faire entendre) ; `TIMING`, `chunkText` (morceaux de 160 caractères au plus : Chrome coupe les longues lectures) ; v2.2.2 : `PITCH` (hauteur par défaut, 1,5 : voix d'enfant, §8.8). Voix française de préférence locale (hors ligne). **Robustesse v2.2.1** (retour d'un parent sur Chrome Android : « 🔊 ne fait rien ») : liste des voix vide au début → attente de `voiceschanged` en relisant la liste (l'événement manque sur certains Android), puis lecture quand même en `fr-FR` (voix par défaut) ; `cancel()` seulement si quelque chose est en cours, suivi d'une respiration (`TIMING.settle`, 250 ms) car Chrome Android avale un `speak()` trop proche ; énoncé disparu sans aucun événement → redonné une fois ; « start » jamais déclenché : `boundary` et `end` valent preuve, et jamais de `cancel()` d'une lecture peut-être audible ; 1re lecture de la séance : attente plus longue de son démarrage (8 s : moteur à initialiser, voix réseau) ; voix choisie en échec → nouvel essai sans l'imposer, voix écartée pour la séance. Tests : `tests/tts.test.mjs` (faux `speechSynthesis` qui reproduit ces défauts).
- `audio.js` : `unlock()`, `setMuted(b)`, `isMuted()`, `beep(f, dur, gain)` (compatible v11), `success(step)` (pentatonique montante), `soft()` (bois doux), `tap()`, `coin()`, `fanfare()`, `whoosh()`, `neigh()`, `clipClop()`, `metronome({ bpm, beatsPerBar, onBeat }) → { stop(), setBpm() }`, `audioSupported()` ; v2.2.2 : `context()` (l'`AudioContext` des sons, `null` avant le premier geste, partagé par les clips et la voix fluide, qui y jouent en sortie directe, hors du muet des sons : `js/ui/voice.js` décide).
- `motion.js` : `EASE`, `DUR`, `setMode('full'|'soft')`, `reduced()`, `pop`, `squash`, `shake` (6 px), `enter`, `stagger`, `flyTo(from, to, { emoji, count })`, `burst(x, y, opts)`, `sparkle(el)`, `countUp(el, from, to, dur)`, `morphPolygon(poly, fromPts, toPts, dur)`, `confetti()` (emojis du thème par défaut), `setTheme({ confetti })` (v2.1), `viewTransition(fn)`. Mouvement réduit (préférence système ou réglage « animations douces ») → fondus uniquement.
- `kit.js` : `keypad(opts)`, `choiceGrid(choices, opts)`, `toast(msg)`, `bubble(text, kind)`, `sheet(opts)`, `confirmSheet(text, opts)`, `celebrateRight(el, streak)`, `gentleWrong(el)`, `cheer(kind, rng)` (phrases d'encouragement variées). v2.2 : durée des toasts selon la longueur (≈ 60 ms par caractère, 2,5 à 7 s ; une durée imposée est gardée ; en haut de l'écran quand une feuille est ouverte) ; `bubble(…, { live })` (pas de zone annoncée par défaut : les jeux annoncent par `ctx.announce`, une seule fois) ; terminaisons « -ent », « -ais » jamais coupées par la césure ; focus gardé sur le choix touché d'un QCM puis porté sur le premier choix de la question suivante ; Entrée sur un bouton focalisé hors du pavé l'active ; `sheet()` se ferme au **retour Android** (CloseWatcher, raison `'back'`) au lieu de quitter l'appli ; `cheer('retry')` = mots doux de 1 à 3 mots (« Presque ! », « Tu chauffes ! »…) devant l'astuce. v2.2.1 : `tour({ steps, avatar, listen, labels, onStep, onEnd, guard, returnFocus }) → { el, close(raison), index() }` (visite guidée « projecteur », §8.6 bis : `steps = [{ target: élément | () => élément, text }]`, une chose à la fois ; `onEnd(raison)` : `'done'` | `'skip'` (Passer, Échap, retour Android) | `'api'` (`close()`, ou `guard()` devenu faux) ; dialogue modal, Tab piégé, reste de l'appli inerte ; mouvement réduit : fondus) ; `ensureStyles()` (feuille du kit chargée d'avance, pour le 🔊 de `voice.js` posé avant tout autre composant).

### 8.3 Routeur et écrans
Routes (v2.3 : + `#/duel`, `#/battle?duel=<code>&n=<jeton>`, §5.9 bis ; `duel` est aussi un écran sans bandeau de mise à jour) : `#/home`, `#/profiles`, `#/onboarding`, `#/welcome`, `#/balade`, `#/play/<id>?mode=balade&block=<i>` (sinon libre), `#/progres`, `#/parents`, `#/import?from=…`, et en v2.1 `#/famille` (classements, concours), `#/famille/concours` (spectacle du concours), `#/battle` (défi en famille). Un écran = `export default { async mount(root, params, query), unmount() }`.
Démarrage (`main.js`) : (v2.2.2, au chargement du module) `install.watch(window)` garde l'invitation du navigateur (§8.9) → `store.init()` → réglages du profil actif (son, mouvement, thème via `theme-picker.applyTheme`, réappliqués à chaque changement du store) → SW + bandeau (v2.2.2 : `html.has-update` tant qu'il est affiché) → route initiale : aucun profil → `#/onboarding` ; profil actif sans classe → `#/welcome` ; ≥ 2 profils et pas encore choisi dans cette session → `#/profiles` ; sinon `#/home` → (v2.2.2) voix fluide : `fluid.init()`, puis `fluid.onRoute(route)` à chaque changement d'écran (§8.8).

### 8.4 Service worker (`sw.js`) — CDC §13.4
v2.3 : la navigation vers `pages/*.html` est servie cache d'abord (pages précachées par `tools/precache.mjs`, qui liste aussi `pages/*.css|js`, jamais `store/`), pour les lire hors ligne ; les autres pages (bancs d'essai) restent au réseau.
Cache `caramel-<VERSION>` pré-rempli avec `ASSETS` (liste générée). `install` : précache ; `skipWaiting()` immédiat **seulement** si l'ancien cache v11 `caramel-shell-v1` existe (bascule v11 → v2 sans bandeau). `activate` : supprime les caches `caramel-*` obsolètes (**jamais** ceux de `KEEP` : `vosk-model-v1`, `vosk-lib-v1` et, v2.2.2, `caramel-voix-v1` ; `piper-tts-v1`, la voix fluide, ne commence pas par « caramel- » : jamais touché), `clients.claim()`. `message {type:'SKIP_WAITING'}` → `skipWaiting()`. `fetch` : GET même origine hors `/models/` (modèles Vosk et Piper : la page les range dans leur propre cache) → navigation servie par `index.html` du cache (repli réseau) ; ressources cache d'abord puis réseau ; `VOSK_LIB` (jsDelivr) mis en cache `vosk-lib-v1` ; v2.2.2 : clips `audio/voix/*.mp3?v=<empreinte>` → `voiceClip()` : cache `caramel-voix-v1` d'abord, puis réseau (seules les réponses 200 sont gardées) ; hors ligne, un clip absent répond 503 et la page passe à une autre voix. Rappels quotidiens `periodicsync caramel-daily` + `notificationclick` conservés.
Précache (v2.2.2) : 118 fichiers, 2 560 Ko le 05/10/2026, sous l'alerte de `tools/precache.mjs`, relevée de 2,5 à 3 Mo à la publication de la 2.2.2 (≈ 0,9 Mo compressé) ; il contient les petits modules `js/core/piper-*.js` et `voice-fluid.js` (nécessaires hors ligne), jamais les clips (≈ 1,8 Mo, téléchargés à la première écoute ou en tâche de fond), le modèle ni le moteur de la voix fluide (≈ 45 Mo, téléchargés à part).
Changement d'écran (v2.2) : titre d'onglet « titre de l'écran · Caramel » (l'accueil garde « Caramel ») et focus sur le `h1` de l'écran pour les lecteurs d'écran.
Page : nouvelle version en attente → bandeau « Nouvelle version — touche pour mettre à jour » (jamais pendant un jeu, un défi, l'arrivée d'un enfant ni la saisie d'une fiche) → `SKIP_WAITING` → rechargement au `controllerchange` (seulement après ce geste).

### 8.5 Thèmes visuels (`js/core/themes.js` pur, `js/ui/theme-picker.js`, `css/themes.css`) — v2.1, CDC §10.5
```js
export const DEFAULT_THEME = 'caramel', THEMES, THEME_IDS   // caramel, licorne, princesse, superheros, dinosaures, bolides, espace, ocean
export function normalizeTheme(id) → id connu sinon 'caramel' ; isTheme(id) ; themeOf(id) → { id, name, emoji, blurb, bar, party, sticker }
export function defaultThemeFor(g) → 'dinosaures' si 'm', sinon 'caramel'   // présélection à la création seulement
// theme-picker.js
applyTheme(id) ; previewTheme(id, { animate }) ; endPreview() ; shownTheme() ; swapTheme(fn, animate)
themeGrid({ value, onPick, compact, label }) → { el, set(id), value() }   // groupe radio, chaque carte porte son propre data-theme
cheerTheme(id, card) ; openThemeSheet({ profileId }) → feuille « Choisis ton univers 🎨 » (enregistre et applique)
```
Un thème = des **jetons** surchargés sous `[data-theme="<id>"]` (sur `<html>` ou sur n'importe quel sous-arbre pour un aperçu) : fonds `--bg-*` et motif `--bg-pattern`, encres, `--pink-*` (famille secondaire), `--amber-*` (famille principale), `--shade`, `--accent`, `--focus`, `--panel-*`, `--ava-ring`, `--tile-<jeu>`. Invariants dans tous les thèmes : `--card`, `--ok*`, `--soft*` (erreur douce), `--sky`/`--grass`, `--fr`/`--ma` (radars officiels) et les décors naturels des jeux. Contrastes ≥ 4,5:1 vérifiés par `tests/themes.test.mjs`, ainsi que (v2.2) l'anneau de focus ≥ 4,5:1 sur les fonds et la règle « l'habillage d'un thème reste loin de l'orange de l'erreur douce (ΔE ≥ 30) et n'est jamais rouge » (Dinosaures : boutons ocre ; Océan : bordures bleues ; Bolides : bordures grises ; focus Caramel #78350f). Aucune marque (thème « Super-héros » générique). Choix : création du profil (présélection), accueil (« 🎨 Mon thème »), espace parents.

### 8.6 Compagnon (`js/ui/mount-svg.js`, `css/ui/mount.css`, `js/ui/companion-life.js`) — v2.1, CDC §10.3
- `mountSVG(type, worn, size, moodClass, { expr, stage, shadow = true, phase, view })` → chaîne SVG (`width = size`, `height = round(size × 0,84)`, viewBox `0 0 100 84`, type inconnu → poney ; `shadow: false` = sans ombre au sol quand l'écran pose la sienne ; `phase` (s) = décalage de l'attente pour désynchroniser plusieurs compagnons ; `view: 'portrait'` = cadrage tête pour les avatars ronds ; contour affiné au-delà de 140 px) ; `EXPRESSIONS`, `MOODS`, `ensureMountCSS()`, `mountAnchors(type, opts)` → `{ ground, mouth, eyes, top, neck, back, chest, tail }` (unités du viewBox, à utiliser pour viser la bouche, poser un objet…).
- **Contrat du rig** (utilisé par le moteur de vie, ne pas casser) : racine `svg.m-root.c-rig.sp-<type>` avec `data-species`, `data-expr`, `data-stage` ; groupes `.c-shadow`, `.c-all`, `.m-body`, `.m-legF`/`.m-legB` > `.c-leg`, `.m-tail` > `.c-tail-tip`, `.c-wings`, `.c-head` > `.m-ear.c-ear-l`/`.c-ear-r`, `.c-mane`, `.c-face`, `.c-eyes` > `.c-eye` > `.c-pupil` + `.m-lid`, `.c-x.x-<expr>` (+ `.x-sad`, visage triste de l'humeur `sad`), `.c-nose`, accessoires `.c-acc.acc-<id>`, `.c-wave` (vague du dauphin, hors de `.c-all` : elle reste quand il saute), `.c-glint` (éclat du champion). Expressions : neutral, happy, delighted, proud, surprised, sleepy, hungry, focused. Humeurs (classes) : walk, joy, sad, dance, sleep, eat, hop, wiggle. `transform-box: fill-box` partout. **Poses** (couché, tête basse, menton levé) : variables `--c-hr`, `--c-hy`, `--c-by`, `--c-tr`, `--c-ty` déclarées en `@property` sur `.c-rig` (transition 0,6 s) et reprises par les keyframes — Chrome n'affiche pas `rotate`/`translate` sur un groupe SVG dont `transform` est animé en CSS (v2.1).
- `bringToLife(svg, { species, stage, interactive, onEvent, hitEl, greet, light, awake, mood })` → `ctl` : `setExpression(nom, ms?)`, `react('tap'|'hug'|'eat'|'brush'|'walk'|'celebrate'|'proud'|'surprise'|'yawn'|'wake'|'appear', opts)`, `lookAt(x, y)`, `setMood({ faim, forme, joie })`, `sleep(true|false|null)` (automatique de 22 h à 7 h), `pause()`, `resume()`, `destroy()`, `state`. `liven(el)` = vie légère (regard, clignements, oreilles, joie au toucher) pour les avatars ; `lifeOf(svg)`, `lifeStats()` (exposé dans `__caramelDebug.life`).
- Pur (testé) : `STAGE_MINUTES = [0, 60, 300]`, `stageFor(min)`, `stageProgress(min)`, `isNight`, `seasonOf`, `sunTimes` (France), `skyAt(date)` (ciel du diorama), `createPlanner({ species, stage, rng })`.
- `js/ui/companion.js` : `avatarSVG`, `avatarOf(profile, size, mood, opts)` (stade du profil), `stageOf(profile)`, `setAvatar(el, html, { live })`, `renderCompanionCard(container)` (diorama jour/nuit/saisons, évolution fêtée une seule fois).
- Intégration dans les écrans (v2.1) : les jeux passent par `ctx.petSVG` / `ctx.petAnchors` (§7.2) ; avatars ronds (en-tête de l'accueil, pastilles et rubans de la famille, résultats et bulle « la bonne réponse » du défi) en `view: 'portrait'` ; listes de compagnons côte à côte (montures de la boutique, « Qui joue ? », profils) avec `phase: i × 1,3` ; **une seule ombre au sol**, celle du rig (aucun écran n'ajoute d'ellipse ni de filtre `drop-shadow` ; `shadow: false` s'il pose la sienne). La vague du dauphin fait partie du dessin (elle cache le bas de son corps) : elle le suit partout, y compris sur la botte de foin de la clôture. **Sauts et bonds** (tables, course, clôture, petits bonds de la marche de la balade, temps fort du chef d'orchestre) : on anime le corps `.c-all` (WAAPI, `composite: 'add'` sur le pas ou l'attente du rig, translations en unités du viewBox = px × 100 / largeur du SVG), jamais un conteneur qui emporterait l'ombre et la vague ; l'ombre `.c-shadow` rétrécit en l'air (pas la flaque du dauphin) ; un objet tenu suit la bouche (clôture : la carotte rejoue les images clés de l'humeur du corps). Changer une classe d'humeur (`walk`, `joy`…) pendant un tel saut : recalculer le style aussitôt (`getBoundingClientRect()`), sinon Chrome perd une image de l'effet « add ». Avatars ronds (`view: 'portrait'`) : jamais l'humeur `sleep` (la pose couchée sort la tête du cadrage) ; l'expression `sleepy` dit qu'il dort.
- Planche contact : `tests/harness/companion.html` (espèces × expressions × humeurs × stades, silhouettes noires).

### 8.6 bis Accueil « un seul gros bouton » (v2.2, `js/ui/home.js`, `js/ui/companion.js` en scène héros) — CDC §1 principe 7
Accueil sur un seul écran : en-tête (avatar = « Qui joue ? », « Bonjour {P} ! », 🎨 thème, 🔒 espace parents), la scène du compagnon en grand (plaque « Mon compagnon » : stade et prénoms ; pastilles 🍎 et 🔥 ; bulle de pensée 🍎 quand il a faim, qui ouvre le garde-manger), 4 soins en icônes dont l'anneau est la jauge (🥕 ventre, 🧽 joie, 🚶 forme ; ✓ quand un soin est déjà fait ; 🛍️ cerclée d'or quand un objet nouveau est à portée de pommes), UN bouton « Jouer ▶ » qui lance l'étape du jour (« 🎲 Encore un jeu ? » quand la balade est finie), les 4 pierres de la balade, « 🎲 Jeux » et « 📈 Mes progrès » (dès qu'il y a quelque chose à montrer). Boutique en deux rayons (👒 Habits, 🐾 Animaux) avec **cabine d'essayage** : toucher un objet le fait essayer, « Acheter » l'achète (« Il te manque N 🍎 » sinon). La balade s'enchaîne depuis le bilan (« Étape suivante ▶ »). Spécification complète : rapport de synthèse S9 (jury de 3 pistes), reprise dans `docs/JEUX.md` §1 et §8.

**Visite guidée (v2.2.1, retour d'un parent : « une voix qui leur explique l'interface dès le début »)** : au premier accueil de chaque enfant (profils existants compris, l'accueil ayant changé en 2.2 ; `profile.seen.tour`, §5.1), `kit.tour` (§8.2) éclaire UNE chose à la fois, le reste de l'écran atténué, avec la bulle du compagnon (portrait), « Suivant ▶ » (« J'ai compris ✓ » à la fin) et un petit « Passer ». Du CP au CE2 : le compagnon (« Coucou {P} ! Moi, c'est {N}. » ; il salue d'un cœur et d'un petit bond, sans son, sauf en mouvement réduit où il reste immobile), le bouton « Jouer ▶ », les soins ; en CM1 et CM2, deux étapes sans « coucou » (« Jouer ▶ », les soins). La voix dit chaque étape aux petits lecteurs (le texte reste écrit, 🔊 « Écouter encore » la relit) ; appli ouverte directement sur l'accueil : le navigateur refuse la voix avant le premier geste, 🔊 se signale doucement et la phrase est dite au premier toucher. Jamais pendant le bandeau de mise à jour, une feuille, un panneau du compagnon ni la bascule « Qui joue ? ». « Passer » ou « J'ai compris » la marquent vue ; fermée par la navigation, elle reviendra. Espace parents : « 🔁 Revoir la visite guidée » (la visite et les phrases des jeux reviennent, §5.1).

### 8.7 Détection du radar photographié (`js/ui/radar-detect.js` + `radar-detect-worker.js`) — v2.1, CDC §8.3
```js
export const RINGS = [0.5104, 0.7553, 1], BAG_R = 0.19, INPUT_MAX = 1600
detectRadar(image /* { width, height, data RGBA } */, { templates: { fr, ma } | template, subject?, hint?: { center }, budgetMs = 2500 })
  → { ok, confidence, reason?, hint? ('hors-cadre' | 'trop-petit' | 'de-biais' : conseil de prise de vue), center, R, rotation,
      ellipse, homography, subject (gabarit retenu : le nombre d'axes décide), subjectColor ('fr' | 'ma' | null : bande des familles
      rapportée au papier), template, axes: [{ index, id, angle, theta | null, confidence, r, x, y }], ms }
rectify(image, res, { size, extent }) → vue redressée ; projectPoint(res, f, angleDeg) ; thetaFromRadius(f) ; radiusFromTheta(θ) ; applyH(H, x, y)
```
Tout se fait sur l'appareil, dans un Web Worker (message `{ id, width, height, buffer, opts }` → `{ id, res, view }`) ; la photo n'est jamais stockée. Les cercles ⊕ / ⊕⊕ / ⊕⊕⊕ (rapports 0,51 / 0,76 / 1) donnent le centre, l'échelle et la perspective ; le nombre d'axes départage français et mathématiques ; chaque axe est lu par la pastille blanche cerclée, le contour du polygone et la teinte, « Pas de positionnement : absence » donne `theta: null`. Garde-fous de succès (axes réellement retrouvés, « haut » sans ambiguïté par les repères ⊕, au moins 5 repères sur 6) : aucune image qui n'est pas une fiche n'est acceptée. Échec ou confiance faible → plan B : alignement et réglage manuels (`js/ui/import-eval.js`), toujours proposés pour corriger un point, avec le conseil de prise de vue (`hint`) et « 📷 Reprendre la photo » ; les points incertains sont entourés d'orange et portent `aria-description="à vérifier"`. Mesures v2.1 : 4 vraies photos de fiches CM2 lues sans réglage (32 axes sur 32, sommets à ±0,05), 432 sur 496 photos simulées, 0 non-fiche acceptée sur 172.

**Gabarits des fiches** (`ficheTemplate(classe, matière)` de `js/core/axes.js`, communs à la saisie manuelle et à la photo) : `{ classe, subject, exact, axes: [{ id, angle, label, domain }] }`, angles en degrés, sens horaire depuis le haut ; la valeur lue ou saisie sur l'axe `i` va à `axes[i].id` (`ficheToAxes` fait la moyenne quand deux axes de la fiche partagent un axe interne). Au CM2, angles relevés sur des fiches réelles (`exact: true`). Du CP au CM1, convention : sur la fiche, le haut (repères ⊕) tombe entre deux axes disposés symétriquement ; la liste part de l'axe juste à gauche du haut et l'axe `i` est à (i − ½) × pas, pas = 360 / nombre d'axes (1er axe à −pas/2, soit 334,3° sur une fiche à 7 axes ; 2e à +pas/2, soit 25,7°). Les angles restent croissants, sans être ramenés dans [0 ; 360[ (le détecteur prend le milieu de deux axes consécutifs). L'ordre des compétences a été lu libellé par libellé sur les maquettes DEPP 2026 (diaporama de présentation, guide d'accès enseignant au portail) et sur les mini-radars des fiches descriptives pour les parents (CE1 français, CE2 maths, CM1 français) ; `tests/fiches.test.mjs` le fige. En v2.0, le 1er axe était à +pas/2 et l'ordre du CP maths et du CE1 français ne suivait pas la fiche : du CP au CM1, sauf en CE2 maths, chaque valeur tombait sous une autre compétence que celle imprimée.

### 8.8 Voix du compagnon (`js/ui/voice.js`) — v2.2 ; trois voix en v2.2.2
```js
readAloud(profile) → boolean        // settings.readAloud : tout sauf 'off' (v2.2.2 : Oui par défaut, pour TOUS les enfants) ; anciens booléens acceptés
voiceOn(profile) → boolean          // lecture AUTOMATIQUE : readAloud ET sons activés ET une voix possible (clips ou voix française du téléphone)
listenOn(profile) → boolean         // v2.2.2 : 🔊 montré : readAloud ET une voix possible (sons coupés compris : toucher 🔊 est un geste)
speakable(texte) → texte à dire     // « × » → « fois », « 20 🍎 » → « 20 pommes », « … » → pause, emojis muets (js/content/voice-lines.js)
speak(texte, { force }) → Promise<boolean>   // aiguillage ci-dessous ; force = geste explicite (🔊, « Tester la voix ») : lit même
                                    // si le réglage est « Non » ou les sons coupés, jamais micro ouvert
hush()                              // se tait et vide la file de la voix fluide (changement d'écran, bonne réponse, micro)
settle() → Promise                  // v2.2.1 : la voix s'est tue (v2.2.2 : clips et voix fluide compris) et le moteur a repris son souffle
needsGesture() → boolean            // v2.2.1 : aucun geste encore sur la page (rien ne peut être dit)
health() → 'unknown' | 'ok' | 'broken'   // v2.2.1 : santé de la voix pour la séance
stats() → { rec, fluid, tts, partial, health }   // v2.2.2 : phrases dites pendant la séance, par voix (État de cet appareil, §8.10)
test(texte?, { profile }) → Promise<{ ok, reason, diag, rec, tts }>   // essai de l'espace parents : voix enregistrée PUIS voix du
                                    // téléphone (rec / tts : { ok, reason } ; diag = tts.diagnose()) ; profile : l'enfant affiché
testFluid(texte) → Promise<{ ok, reason }>   // v2.2.2 : « ▶ Écouter » de la ligne « Voix fluide » (voix fluide seule)
prepare(...textes) ; prepareNext(...textes) ; canPrepare() → boolean   // v2.2.2 : calcul à l'avance par la voix fluide (ci-dessous)
micWillStart()                      // v2.2.2 : le micro va démarrer (ctx.speech, §7.2) : la voix fluide ne démarre pas en même temps
listenButton(get, { label }) → bouton 🔊 de 48 px qui relit get() (classe is-speaking pendant la lecture)
FAIL_TOAST                          // v2.2.1 : « Je n'arrive pas à parler sur cet appareil 😕 Un adulte peut tester la voix… »
// jeux : ctx.voice = { on, say(texte, { quiet }), hush(), settle(), prepare(), prepareNext(), canPrepare } (js/ui/game-ctx.js, §7.2)
```
Rien n'est lu automatiquement quand le son est coupé, sans voix possible sur l'appareil, avant le premier geste de la page, ni **pendant que le micro écoute** ; le texte reste toujours affiché (CDC §16) ; la voix se tait quand la page passe en arrière-plan. La voix dit la question, la consigne au premier calcul, le mot doux et l'astuce, l'explication, la phrase du bilan, les réactions du compagnon, la phrase de la 1re partie d'un jeu (§7.1), les étapes de la visite guidée (§8.6 bis) et (v2.2.2) l'invitation à installer côté enfant (§8.9). La course (v2.2.1) dit sa consigne (« Choisis une histoire ! », puis « Appuie sur le micro, puis lis l'histoire à voix haute ! », que 🔊 relit jusqu'au départ du micro), ce qui empêche le micro, la question de compréhension (pas les choix) et ses aides, puis le message des résultats ; elle se tait dès que le micro s'ouvre (🔊 caché pendant la lecture) : son moteur vocal n'est pas concerné. **v2.2.2 : la lecture à voix haute vaut pour tous les enfants** (décision du parent du 04/10/2026 ; « Lire les consignes à voix haute » : Oui par défaut, ou Non, qui cache aussi les 🔊).

**Les trois voix (v2.2.2)** — les deux premières sont la même voix neuronale libre, Piper « fr_FR-siwis-medium », choisie par le parent :
1. **Voix enregistrée** (clips) : `js/content/voice-lines.js` (pur) tient l'inventaire `LINES` (`{ id, text, say?, cut? }` : phrases fixes, phrases à prénom dites sans le prénom — `namedLines` —, nombres de 0 à 100 et morceaux de calculs — `numberClips`, `intClips`) et `planSpeech(texte, { has, named })` → `{ ok, clips: [{ id, gap }] }` (les plus longs morceaux d'abord, silences `GAP`) ; clips MP3 mono 22,05 kHz, LAME V9, passe-bas 9,3 kHz (7 kHz × `YOUTH`) ; `js/core/voice-clips.js` joue le plan par Web Audio, sans trou (clips décodés AVANT le départ, programmés à l'échantillon près, silences du décodeur MP3 retirés) ; `prefetch(commonIds())` met les phrases courantes en cache en tâche de fond (une fois par séance, pas en économie de données) et `prune()` retire les clips d'anciennes versions. Un signe sans clip (€, %, /…), un nombre de 26 à 98 finissant par 6 ou 8 et suivi d'un nom (pas de variante enregistrée) ou une liaison devant voyelle font passer la phrase à une autre voix ; 6, 8, 10 et 18 devant un nom à consonne ont leurs variantes (« si », « hui », « di », « dix-hui ») ; « plus » se lit « plusse » (sauf « plus tard ») ; une fin de phrase n'est jamais prise au milieu d'une phrase.
2. **Voix fluide** : la même voix calculée sur l'appareil (`js/core/voice-fluid.js` ; `js/core/piper-tts.js` ; moteur `js/core/piper-engine.js` dans le worker `js/core/piper-worker.js`) : phrases composées et prénom de l'enfant dits d'un seul tenant (« 7 × 8 = ? » : 1,0 s sans pause, contre 1,7 s et 2 pauses en clips assemblés). Texte pour Piper : `fluidText` (`voice-lines.js` : « plusse », « une » devant un nom féminin de `FEM_WORDS`, nombre de calcul lu d'un bloc).
3. **Voix du téléphone** : `js/core/tts.js` (`speechSynthesis`, voix française de l'appareil), fluide mais plus plate ; dernier recours avant les clips composés.

**Voix d'enfant (degré 4, décision du parent du 05/10/2026, après écoute)** : Siwis « rajeunie » d'un facteur r = 1,33 (+5 demi-tons). Réglage partagé `YOUTH` de `js/core/piper-engine.js` (`PARAMS.youth`, importés aussi par `tools/voix.mjs` ; `YOUTH_DEGREES` = les degrés écoutés, pour le banc d'essai) : synthèse avec `length_scale` × r (1,05 × 1,33 ≈ 1,3965), puis son relu r fois plus vite, rééchantillonné : hauteur ET timbre montent de r, le débit redevient celui de Siwis, à ≈ 5 % près (Piper arrondit ses durées ; échantillon validé : `piper --length_scale 1.3965`, puis `ffmpeg -af asetrate=22050*1.33,aresample=22050`). Clips régénérés ainsi par `tools/voix.mjs` (filtre `YOUTH_FILTER` compris dans l'empreinte : nouvelles adresses, `prune()` retire les anciennes du cache) ; voix fluide : `rejuvenate(pcm, r)` dans le worker (le son arrive prêt : durées, cache et 🔊 inchangés) ; voix du téléphone rehaussée : `PITCH` (1,5) de `js/core/tts.js`, hauteur par défaut de `speak` (chaque moteur l'interprète à sa façon : Android `setPitch`, iPhone `pitchMultiplier`).

**Aiguillage d'une phrase** (`routeOf` et `segmentsOf`, purs, `js/core/voice-fluid.js` ; décision du parent du 04/10/2026) :

| La phrase | Voix |
|---|---|
| des clips de phrases entières la couvrent (consigne, encouragement, bilan fixe, feuille d'installation) : un seul clip, ou chaque clip finit une phrase (`whole`, `endsSentence`) | ces clips, instantanés |
| composée (calculs, nombres, astuces, explications) ou à prénom | voix fluide si elle est prête ; sinon voix du téléphone ; sans voix du téléphone, clips composés (`'clips'`), ou à défaut les seules phrases couvertes (`'partial'`) |
| à prénom, que des clips de phrases entières couvrent (sa variante sans le prénom), voix fluide pas prête | ces clips : même voix que le reste de la visite guidée (choix à valider par le parent : une ligne de `routeOf`) |

Dans un texte dit par la voix fluide, chaque phrase qu'un clip couvre reste ce clip (même voix, départ immédiat : « Presque ! » est le clip, puis l'astuce est calculée). Replis : clip introuvable (hors ligne, jamais entendu) → voix fluide, sinon téléphone ; voix fluide en panne ou pas prête 2,5 s après la demande (`LIMITS.firstWaitMs`) → téléphone, sinon clips ; téléphone en échec → clips. Parcours automatisés : `__caramelDebug.voice` = 50 dernières phrases `{ via: 'clip' | 'fluide' | 'clips' | 'partiel' | 'téléphone', text, ids }`.

**Préparé à l'avance** : la voix fluide calcule phrase par phrase dans une file à trois priorités, `NOW` (ce qui va être dit), `NEXT` (`prepareNext` : dans moins d'une seconde), `LATER` (`prepare` : peut-être ; seulement 1,2 s après le dernier calcul urgent, jamais sur un appareil juste assez rapide, rapport > 0,6) ; `hush()` la vide. Sont préparés : la question suivante des tables et de Pommes express (item suivant tiré dès le rapport, seulement si `ctx.voice.canPrepare` ; jamais quand le micro des tables est voulu), la phrase du bilan (pendant la fanfare), les étapes de la visite guidée. Ne sont **pas** préparées : les astuces et les explications (une synthèse en cours ne s'interrompt pas : les préparer retardait la question suivante jusqu'à 2 s en CM2 ; l'encouragement enregistré part aussitôt). Le son calculé est gardé 120 s en mémoire (`LIMITS.cacheSec`) : 🔊 rejoue exactement le même son, sans nouveau calcul.

**Téléchargement de la voix fluide** (`autoDownload`, pur → `{ ok, why }`) : ≈ 44 Mo transférés, ≈ 45 Mo gardés dans le Cache Storage `piper-tts-v1` (modèle `models/piper/` 32 Mo ; onnxruntime-web 1.22.0 ; piper-phonemize et espeak-ng de `@diffusionstudio/piper-wasm` 1.0.0, dont seul le sous-ensemble français d'espeak-ng, 711 Ko, est gardé) ; `navigator.storage.persist()` ; 150 Mo libres exigés en plus.
- **Jamais tout seul** : au 1er lancement (`launches`), pendant un jeu (`play`, `battle` : un téléchargement en cours s'interrompt), sur un appareil modeste (≤ 2 Go annoncés), après « Supprimer », ni sur un appareil jugé trop lent pour cette version.
- **Tout seul, après une séance** (retour d'un jeu), sans économie de données : en Wi-Fi ou par câble (`navigator.connection.type`, Android) ; sur un ordinateur avec Chrome, qui ne donne pas le type (connexion tenue pour fixe).
- **Sinon, les parents seulement** (iPhone, iPad, données mobiles, connexion inconnue) : ligne « Voix fluide » d'Espace parents › Réglages › Sur cet appareil (`js/ui/voice-fluid.js`, `rowModel` pur) : « ⬇ Télécharger (≈ 45 Mo) », « Wi-Fi conseillé », barre `<progress>` nommée, « Arrêter le téléchargement » / « Reprendre le téléchargement », « ▶ Écouter » (une phrase au prénom de l'enfant actif), « Supprimer » (confirmation « Garder » / « Supprimer ») ; focus gardé quand un bouton disparaît. Un téléchargement demandé par un parent puis interrompu par un jeu reprend tout seul après la séance (`want: 'parent'`) ; « Arrêter » (`cancelDownload({ byParent: true })`) efface `want` (un jeu appelle `cancelDownload()` sans argument) ; un succès efface `want` et `started` ; `refresh()` range le cache (`prune`) quand rien ne se télécharge (fichiers de la page de test retirés).
- **Repli onnxruntime 1.18.0** (sans mémoire partagée) : si `new WebAssembly.Memory({ shared: true, maximum: 65536 })` est refusé (Safari possible), ou après une panne de démarrage avec la 1.22 (`ortFailed`). SIMD et workers modules obligatoires (iOS ≥ 16.4), sinon « Ce navigateur ne peut pas la faire fonctionner ».

**Démarrage, étalonnage, micro** : `boot()` démarre le moteur dans un worker, 4 s après l'ouverture (page visible) quand la voix est en cache, ou 2,5 s après une séance ; le worker relit lui-même le cache (la page ne garde pas les 32 Mo). Une fois par version de Caramel (`needsCalibration`) : une phrase d'échauffement puis une phrase d'essai (`CALIBRATION`) ; rapport calcul ÷ parole > 1 ou démarrage > 15 s → « trop lente » (`calibrationVerdict`) : moteur libéré, verdict gardé jusqu'à la version suivante, visible dans la ligne parents et dans « État de cet appareil » ; « 🔄 Refaire l'essai de vitesse » (`retry()`) refait l'étalonnage sans retélécharger ; « Supprimer » (`remove()`) oublie aussi le verdict. Page cachée (`visibilitychange`) ou gelée (`freeze`) pendant le démarrage ou l'étalonnage : abandon sans verdict, reprise au retour (`resume` compris). Micro : `micWillStart()` abandonne un démarrage en cours ; sur mémoire faible (`navigator.deviceMemory` ≤ 4 Go, ou inconnue : Safari, Firefox), le moteur est libéré et reste en pause (`parked`) jusqu'à la prochaine ouverture de Caramel (Vosk, une fois chargé, reste en mémoire : le micro et la voix fluide ne coexistent jamais) ; ailleurs, il est relancé 3 s après que le micro s'est tu.

**🔊 n'est jamais muet (v2.2.1)** : une lecture qui échoue vraiment (aucun son sorti, ni coupée par l'appli, ni refusée faute de geste) passe la voix « en panne » pour la séance (`health() === 'broken'`) : la classe `html.vx-quiet` rend les 🔊 discrets ; un 🔊 touché qui échoue le dit UNE fois (`FAIL_TOAST`, toast) ; micro ouvert, 🔊 répond « Le micro t'écoute : coupe-le 🎤 pour m'entendre. ». Une lecture réussie, même tardive (`tts.onLateStart`), efface la panne. Espace parents : « ▶ Tester la voix » (sous « Lire les consignes à voix haute ») dit « Bonjour {P} ! Je suis {N}, et je lis les consignes à voix haute. » par la voix enregistrée (sans le prénom), puis par la voix du téléphone, et affiche le résultat de chacune : « La voix fonctionne ✓ » avec ce qui, dans les réglages de l'enfant, la ferait taire (sons coupés, « Non »), ou la cause (navigateur sans synthèse, aucune voix française, micro ouvert, échec) et la marche à suivre pour cet appareil (Android, iPhone ou iPad, autre).

### 8.9 « 📲 Mets Caramel sur l'écran d'accueil » (`js/core/install.js` pur, `js/ui/install.js`, `css/ui/install.css`) — v2.2.2
```js
parseUA(ua, { platform, maxTouchPoints }) → { os, osVersion, browser, browserVersion, ios, android, mobile, inApp }   // aussi pour §8.10
isStandalone(env) ; installMethod(env) → 'prompt' | 'ios-safari' | 'ios-chrome' (iOS ≥ 16.4) | null
readInstall() ; writeInstall(p) ; snooze() ; markInstalled() ; clearInstalled() ; snoozed(prefs) ; doneExpired(prefs, method)
shouldInvite({ standalone, method, prefs, now }) ; watch(target, storage) ; promptReady() ; prompt() → 'accepted' | 'dismissed' | 'unavailable'
onChange(fn) ; justInstalled() ; INSTALL_KEY = 'caramel-install', LATER_DAYS = 7, IOS_DONE_DAYS = 30
// js/ui/install.js
offerSheet({ audience: 'kid' | 'adult' }) ; offerThen(fn) ; homeBanner({ onSheet, onHide }) ; parentsRow({ say }) ; canInvite() ; kidSpeech(m)
```
Android (Chrome, Edge, Samsung Internet) et ordinateur avec Chrome ou Edge : le vrai bouton « Installer » (`prompt()` ; `watch()`, appelé au chargement de `js/main.js`, garde `beforeinstallprompt` : pas de mini-barre de Chrome, l'appli choisit son moment). iPhone et iPad (Safari ; Chrome à partir d'iOS 16.4) : la marche à suivre courte et illustrée (Partager › Sur l'écran d'accueil) et « C'est fait ✓ », invérifiable : l'invitation revient 30 jours après, toujours dans le navigateur. Navigateur sans installation possible ou intégré à une autre appli : rien côté enfant ; l'espace parents dit quoi faire (menu ⋮ ou ☰ du navigateur sur Android, ou ouvrir Caramel dans Chrome ou Safari). Où : feuille à la fin de la création d'un enfant (« Plus tard » de la fiche d'évaluation, `onboarding.js` et `import-eval.js` via `offerThen`), bannière discrète de l'accueil sous les boutons secondaires (✕ = 7 jours), ligne « Écran d'accueil » d'Espace parents › Sur cet appareil (vouvoiement). Jamais en mode installé, dans un jeu, avant ou pendant la visite guidée, avec le bandeau de mise à jour (`html.has-update`), celui de la rentrée ou un panneau du compagnon. `appinstalled` → `done`, plus d'invitation ; un nouveau `beforeinstallprompt` prouve une désinstallation (`done` effacé). Côté enfant, la feuille dit son titre et son « pourquoi » en s'ouvrant (clips `inst.*`), se tait en se fermant, et son 🔊 redit tout ; la bannière a son 🔊 et ne parle jamais toute seule.

### 8.10 État de cet appareil (`js/ui/diag.js`, espace parents › À propos) — v2.2.2, mode diagnostic en v2.2.3
`collect() → Promise<faits>` (navigateur) ; `describe(faits) → [{ key, label, value, ok }]` (pur, testé) ; `asText(rows, ua)` ; `diagCard()`. Pour qu'un parent envoie une capture quand quelque chose ne va pas, sans rien envoyer : version, navigateur et système (`parseUA` ; version d'Android par `navigator.userAgentData`), ouvert depuis l'écran d'accueil ou le navigateur, hors ligne, son, voix enregistrée (clips en cache, phrases dites : `voice.stats()`), voix fluide (pas téléchargée, téléchargement, prête avec sa vitesse mesurée, trop lente, en pause après le micro…), voix du téléphone, micro, reconnaissance, WebAssembly, stockage. Une ligne porte ✓ (fonctionne) ou ✗ (bloque quelque chose ; les lecteurs d'écran entendent « (problème) ») ; « Vérifier de nouveau », « Copier le texte » ; la carte se relit d'elle-même quand la voix fluide change d'état (et à chaque dizaine de % de son téléchargement), tant qu'elle est à l'écran. La carte suit `aboutCard` (dont les lignes « Sauvegarde automatique » et « Moteur vocal » sont parties ici).

**v2.2.3 — mode diagnostic** (demande du parent du 06/10/2026 : « si je l'active, ça enregistre ce qu'il se passe et je peux exporter des logs ») : sous la carte, `debugBox` : activer, exporter le journal (`js/core/debuglog.js` : `exportText({ names, header })`, fichier texte partagé par `navigator.share` ou téléchargé ; en tête, le texte de la carte ; prénoms des profils remplacés par « ‹prénom› »), effacer, désactiver. Reconnaissance « moteur intégré installé » quand le modèle est déjà extrait (`speech.modelReady()`).

### 8.11 Journal de diagnostic (`js/core/debuglog.js`) — v2.2.3
`enabled()`, `setEnabled(on)`, `dlog(catégorie, message, données?)`, `entries()`, `clear()`, `exportText({ names, header })`, `fileName(date)`, `scrub(texte, names)` (pur), `init()` (appelé par `js/main.js` : erreurs JavaScript, promesses rejetées, `console.error`, page cachée / visible). Par appareil (`localStorage` `caramel-debug` = `'1'`), journal gardé entre deux ouvertures (`caramel-debug-log`, borné à 4 000 événements et ≈ 600 000 caractères, les plus anciens partent d'abord). Désactivé, `dlog` ne coûte qu'une lecture de variable. Catégories : `appli`, `écran`, `micro` et `santé` (`js/core/speech.js`), `entendu` / `partiel` (textes reconnus), `tables`, `course`, `préchargement`, `erreur`, `console`. Jamais de son, jamais de photo. En partie, les tables affichent l'état du micro en petit sous l'oreille (`.tb-dbg`). Tests : `tests/debuglog.test.mjs`.

### 8.12 Préchargement (`js/core/preload.js`, `js/ui/preload.js`, `css/ui/preload.css`) — v2.2.3
Demande du parent du 06/10/2026 : « tous les chargements à la première ouverture, quitte à avoir une barre de chargement le temps qu'on configure son profil ». `start({ by })` lance, une fois pour toutes, le moteur du micro (`speech.prefetch` : bibliothèque ≈ 5,8 Mo + modèle ≈ 46 Mo, puis extraction) d'abord, puis la voix fluide (`voice-fluid.download`, ≈ 45 Mo) dès que le modèle du micro est arrivé ; l'extraction (calcul lourd) retient le démarrage de la voix fluide (`fluid.holdBoot` : son essai de vitesse serait faussé). Appelé par la création du profil (`js/ui/onboarding.js`) et l'accueil (`js/ui/home.js` : appareils déjà configurés) ; rien quand tout est prêt. **Une** barre discrète (« Je prépare ma voix et mes oreilles… 42 % », puis « Voix et micro prêts ✓ ») sous les pastilles de la création du profil, puis sous l'en-tête de l'accueil ; rien ne l'attend. Wi-Fi, câble, connexion inconnue : tout part seul ; données mobiles ou économie de données : un seul bouton pour l'adulte, « Télécharger maintenant (≈ 97 Mo) » (taille de ce qui manque ; accord gardé, `caramel-prechargement`) ; hors ligne : reprise au retour du réseau. Voix fluide : `autoDownload` (pur) garde ses exclusions (non supportée, appareil modeste, trop lente pour cette version, « Supprimer ») et la règle des jeux (un jeu interrompt son téléchargement, il reprend après la séance) ; « pas au premier lancement », « seulement après une séance » et l'exclusion iOS sont retirés. Un jeu qui attend le micro reçoit le pourcentage du préchargement (`followVosk`, via `js/ui/game-ctx.js`). Tests : `tests/preload.test.mjs`, `tests/voix-fluide.test.mjs`.

### 8.13 Effacement (`js/ui/wipe.js`) — v2.3
Espace parents › Profils › « Effacer toutes les données de cet appareil » (esprit des règles « enfants » des stores) : double confirmation (« Tout effacer sur cet appareil ? » avec « Télécharger d'abord une sauvegarde », puis « Vraiment tout effacer ? »), jamais hors connexion. Pur (testé, `tests/wipe.test.mjs`) : `isCaramelKey` (préfixe « caramel- »), `isCaramelCache` (caramel-*, vosk-*, piper-tts-*), `plan`, `scopeOf`. `wipeNow()` efface, pour Caramel seulement (l'origine github.io est partagée avec les autres sites du compte), les clés, les caches, les enregistrements du service worker de la portée et la base « /vosk » (résultat `'blocked'` si le worker de Vosk la tient), pose `sessionStorage['caramel-wipe']` ; `reloadApp()` recharge l'adresse de base ; au démarrage, `main.js` voit le drapeau et appelle `finishWipe()` AVANT `store.init` (clés réécrites en partant, drapeau, base « /vosk », que personne ne tient plus). Interface : `parentsCard({ backupFirst, say })`, sous la liste des profils.

### 8.14 Appli Android (Google Play, TWA) — v2.3, préparée
Trusted Web Activity (Bubblewrap) : `store/twa/twa-manifest.json` (identifiant à fixer avec l'adresse définitive du site : décision du parent du 07/10/2026 de passer à un domaine à lui avant Play), démarrage sur `?app=android`. `js/main.js` le note pour la session (`sessionStorage['caramel-app']`) : **jamais de secours de reconnaissance Google** (`js/core/speech.js` : Vosk qui ne démarre pas → `onError('unsupported', NO_GOOGLE_MSG)`, décision du parent du 07/10/2026) et l'appli se sait installée (`js/core/install.js` : pas d'invitation à installer). Pas à pas, fiche, visuels et captures : `store/`. Manifeste (v2.3) : icônes `any`, `maskable` (dessin dans le cercle de 80 %) et `monochrome` séparées ; son `id` ne doit jamais changer.

### 8.15 Répondre à voix haute dans les jeux (`js/ui/voice-answer.js`) — v2.3
Demande du parent du 07/10/2026 (« il faudrait pouvoir utiliser le micro sur les autres jeux, pas seulement les tables »). Le 🎤 des tables, généralisé : `createVoiceAnswer(ctx, { onNumber, onChoice, onProblem, onChange })` → `{ el, ear, dbg, attachKeypad(kp) (le 🎤 prend la case vide du pavé), attachChoices(grille), placeIn(conteneur, avant) (la case vide est remise dans le pavé), number({ answer, ignore, voice, words, touch }), choices([{ value, say, num, label }], { fillers, touch }), pause(oui, 'touch'?), autoStart(), start(), stop(), wanted(), destroy() }`. La voix TAPE la réponse : un nombre dit s'écrit dans le pavé et se valide, un choix dit touche son bouton (le jeu fait ses retours habituels) ; `onNumber` / `onChoice` pour qu'un jeu juge lui-même (opérations). Nombres : juge des tables (`createVoiceJudge`) ; la réponse précédente ne compte jamais faux ; `words` ajoute des mots à la grammaire (« retiens »…). Choix : `js/core/voice-choice.js` (choix dit en dernier, sur ses mots distinctifs ; final, ou partiel stable 0,6 s ; nombres par `num`) ; la grammaire change à chaque question sans rouvrir le micro (`speech.changeGrammar`) ; `fillers` remplace les mots d'appoint. `touch` : question qui ne se dit pas → « 👆 Ici, réponds avec le doigt ». Santé du micro comme aux tables (🎤 barré, phrase après 5 s). Le micro allumé dans un jeu le reste dans le suivant pendant la séance (`sessionStorage['caramel-micro']`, `autoStart()` ; les tables aussi) ; l'enfant l'éteint d'un toucher. Branché dans : Pommes express (pavé, estimation), la clôture (lire : entiers, fractions, décimaux par les piquets), le Chef d'orchestre (environ 4 questions sur 10, les autres au doigt), l'Atelier des opérations (le chiffre de la case), le Défi en famille et Avec un copain (`js/core/battle-voice.js`). Tests : `tests/voice-answer.test.mjs`, `tests/{cloture,orchestre,operations,battle}-voice.test.mjs`, `tests/speech-cycle.test.mjs` (changeGrammar). Mesuré (banc « enfant simulé ») : Pommes 10/10, opérations 106/108 sans faux injuste, orchestre 39/44 (1 faux injuste : liaison « avez‿un »), clôture décimaux 29/29 et fractions 13/14, défi 38/44.

## 9. Design system (`css/base.css`, ✅ écrit)
Jetons (v2.2, en plus de ceux ci-dessous) : échelle de tailles `--fs-*`, rayons `--r-xs`/`--r-xl`, relief `--shadow-press`, espacements `--sp-*`, couleurs fixes du pré `--n-sky-*`, `--n-grass-*`, `--n-meadow`, `--n-amber-400` (or des médailles, jauge de joie), alias sémantiques `--pri-*` / `--sec-*` / `--on-*` (les noms historiques `--pink-*` / `--amber-*` restent la famille secondaire / principale). Mouvement réduit : transitions nulles (plus de transition de 1 ms sur toutes les propriétés, qui faussait les mesures de mise en page).
Jetons : `--bg-*`, `--ink…--ink-5`, `--title`, `--pink-*`, `--amber-*`, `--ok*`, `--soft*` (erreur douce), `--fr`/`--ma`, et en v2.1 `--bg-pattern`, `--shade`, `--accent`, `--focus`, `--panel-bg`/`--panel-line`, `--ava-ring`, `--tile-<jeu>` (thémables, §8.5), `--r-s/m/l/pill`, `--shadow-1/2/btn`, `--font-ui` (Fredoka), `--font-read` (Andika), `--ease-out`, `--ease-pop`, `--dur-1/2/3` (150/300/600 ms), `--safe-*`.
Classes : `.screen` (`.is-full` plein cadre), `.stack`, `.row`, `.grid-2`, `.title`, `.title-xl`, `.subtitle`, `.section-title`, `.read`, `.num`, `.muted`, `.small`, `.topbar`/`.back`/`.topbar-title`, `.btn` (`.pink` `.white` `.ghost` `.big` `.small` `.block`), `.btn-icon`, `.card` (`.tap` `.dashed` `.hero` `.locked`), `.chip`, `.wallet`, `.badge`, `.dots`/`.dot` (`.done` `.helped` `.now`), `.gauge`, `.choices`/`.choice` (`.right` `.wrong` `.dim`), `.answer`, `.keypad`/`.key` (`.ok` `.del`), `.bubble` (`.hint` `.soft` `.good`), `.banner`, `.toast`, `.overlay`/`.sheet`, `.field`/`.input`/`.seg`/`.switch`.
Chaque écran/jeu ajoute son CSS dans `css/ui/` ou `css/games/` et **réutilise les jetons** (aucune couleur d'habillage en dur : elle ne suivrait pas le thème ; seuls les décors naturels des jeux — ciel, herbe, bois — gardent leurs couleurs).

## 10. Tests et validation
- `node tests/run.mjs` : tous les `tests/*.test.mjs` (migration, store, profils/templating sur 2 genres × 8 montures, économie, adaptatif, Leitner, session, radar-model, numbers-fr, chaque générateur — déterminisme, bornes, réponses justes, ≥ 200 items distincts par palier —, conjugaison, histoires — ni apostrophe ni trait d'union, lexique Vosk, ≥ 150 mots en CM2 —, cohérence `sw.js`/fichiers ; v2.1 : thèmes et contrastes, rig et ancres du compagnon, planificateur et ciel du moteur de vie, famille — compteurs, classements, concours, points du défi —, détection du radar sur fiches synthétiques et perturbées, gabarits des fiches Repères — ordre des compétences et convention d'angle ; v2.2.2 : `tests/voix-clips.test.mjs` — inventaire, plans, lecture des clips sur un faux Web Audio —, `tests/voix-fluide.test.mjs` — aiguillage, politique de téléchargement, étalonnage, micro, ligne parents, sur un faux cache et un faux moteur —, `tests/install.test.mjs` — invitation à installer, `describe` de l'état de l'appareil).
- `node tools/check.mjs` : `node --check` sur chaque module + tests.
- `node tools/voix.mjs --check` (v2.2.2) : chaque phrase de l'inventaire a son clip à jour (aucun manquant ni orphelin), dans le budget de `BUDGET` (1,9 Mo : relevé pour la voix d'enfant). Un texte de l'inventaire changé → `PIPER=… PIPER_MODEL=… FFMPEG=… node tools/voix.mjs` (seuls les clips changés sont refaits).
- Bancs d'essai navigateur (`tests/harness/`, dont `piper.html` pour la voix fluide) + parcours de bout en bout en Chrome headless avant chaque push (capture en 390 × 844).
- Avant push : `node tools/precache.mjs` (liste ASSETS + VERSION à jour).
