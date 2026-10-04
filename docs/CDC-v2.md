# CDC — Caramel 2 · Accompagnement scolaire CP → CM2

> Spec de référence de la refonte « v2 » (produit). Rédigée le 02/10/2026.
> Remplace `docs/CDC-v11.md` comme source de vérité (à archiver dans `docs/archive/`).
> Code de départ : `main` @ `c5bd8d1` (v11.3). Versions suivantes : `v2.0`, `v2.1`… (un commit = une version).
> **État au 03/10/2026 : v2.0 livrée** (périmètre et écarts : §18). En cours : 2.1 = compagnon vivant, radar automatique, thèmes (§15).

## 0. Vision

Transformer « La course de Caramel » (fluence seule) en **compagnon d'accompagnement scolaire CP→CM2** qui :
- couvre **tous les axes des évaluations nationales Repères** en français et en mathématiques ;
- s'adapte **en douceur** à chaque enfant : classe choisie + évaluation nationale importée (photo de la fiche) + réussites au fil des jours ;
- reste un **jeu** : séances courtes, mini-jeux variés, compagnon à faire grandir, motion design soigné ;
- ne fait **jamais sortir une donnée de l'appareil**.

## 1. Utilisatrices & principes non négociables

- Cible primaire : les deux filles de Cédric (CM2 en 2026-27). Leurs profils Repères de septembre 2026 existent en fichiers locaux (§8.4) — **jamais dans le repo**. Priorités observées : lecture à voix haute (commune), ligne graduée, calcul rapide, tables, accord du verbe, compréhension écrite → elles justifient la sélection de la phase 2.0.
- Cible secondaire : toute famille CP→CM2 (lien public).

1. **Bienveillant, jamais hardcore** : aucune vie perdue, aucun chrono imposé par défaut, toute erreur → indice + nouvelle chance, zone de réussite visée ≈ 80 %.
2. **Local-first / RGPD** : voix, photos, résultats restent sur l'appareil ; pas de backend ; échanges uniquement par export/import manuels.
3. **Hors ligne** après la première visite (PWA).
4. **Séance courte** : 10-20 min/jour, 3-5 jours/semaine, alternance langage / rythme, bilan du jour (format inspiré de Poppins) — **sans prétention thérapeutique ni diagnostique**.
5. **Alignement officiel** : contenus calés sur les programmes 2024-2025 et sur les **formats d'exercices des Repères** (transfert maximal vers l'école).
6. **Aucune donnée nominative d'enfant** dans le repo public (prénoms, résultats, photos).
7. **Simple, étape par étape** (consigne du parent, 03/10/2026) : c'est pour des enfants — ne pas surcharger l'écran. Côté enfant : **une seule action principale par écran**, une question ou un choix à la fois (divulgation progressive, pastilles d'étapes), une phrase courte plutôt qu'un paragraphe, icônes et voix plutôt que lecture ; on retire avant d'ajouter. L'espace parents peut être plus dense, mais chaque section reste claire.

## 2. Point de départ (v11.3 en prod)

- `index.html` monofichier (1 607 lignes), `sw.js` (cache `caramel-shell-v1`, periodic sync `caramel-daily`), `models/fr.tar.gz` (Vosk small-fr-pguyot-0.3, 44 Mo).
- Sauvegarde `caramel-save-v2` = `{stars{storyId:best}, apples, streak{count,last}, hero{name,g}, mount{type,name,owned[]}, equip{owned[],worn[]}, pet{faim,forme,joie,last,brushLast,walkDay}}` ; legacy `caramel-progress-v1` = `{stars}` ; préférence `caramel-notifs`.
- 27 histoires (ids `ce1-carotte…ce1-cadeau`, `pomme…reve`, `cm1-orage…cm1-aurore`), 8 montures (`pony horse cat capy dolphin lion unicorn dragon`), 8 accessoires, 3 aliments, `FEEDBACK_URL` = post LinkedIn.
- Moteur vocal = CDC v11 §4 → **conservé verbatim**, simplement déplacé dans un module.
- `docs/CDC-v11.md` n'a pas été mis à jour après la v11 (état resté « en cours ») → archiver.

## 3. Sources officielles

| Sujet | Référence | Conséquence |
|---|---|---|
| Programmes cycle 2 (CP-CE1-CE2), français + maths | BO n°41 du 31/10/2024 (annexes `ensel135_*`, maths C2 = annexe 4), en vigueur rentrée 2025 | attendus par année ; fractions dès le CE1 ; priorité numération, calcul mental, problèmes |
| Programmes cycle 3 (CM1-CM2-6e), français + maths | BO n°16 du 17/04/2025 (MENE2504620A) ; CM1/6e rentrée 2025, **CM2 rentrée 2026** | les filles sont la 1re promo de CM2 sur ce programme ; schéma en barres ; plus-que-parfait, accord du participe avec COD antéposé, phrase complexe en CM2 |
| Évaluations Repères CP, mi-CP, CE1, CE2, CM1, CM2 | Guides DEPP 2026 sur eduscol (`26cpp`, `26ce1p`, `26ce2p`, `26cm1p`, `26cm2p`…), fiches parents `education.gouv.fr/evaluations-fiches` | liste des compétences évaluées et formats d'exercices → §4 et §6 |
| Fluence (MCLM attendus en fin d'année) | Programmes C2/C3 (confirmé le 02/10/2026) | CP 30 sans préparation (50 après) · CE1 70 · CE2 90 · CM1 110 · CM2 120 · 6e 130 ; seuils Repères de rentrée = attendu de fin de l'année précédente (début CM2 : ≤ 89 à besoins, 90-109 fragile, ≥ 110 satisfaisant) |
| Inspiration | Poppins (jeu sérieux pour enfants dys de 7-11 ans : mini-jeux de langage écrit + jeux rythmiques, ≈ 20 min/jour, 3-5×/semaine, bilan quotidien) | structure de séance, jeux rythmiques, bilan du jour |

**Droits** : ne jamais reproduire les textes des cahiers d'évaluation ni des manuels. S'inspirer uniquement des formats. Tous les textes Caramel sont originaux.

**Vérification des textes officiels (02/10/2026)** — les points « (à confirmer) » ont été vérifiés dans les BO n°41/2024 et n°16/2025 et les guides Repères 2026 ; le BO fait foi. Corrections principales intégrées aux §4-§6 :
- division posée au CM2 : diviseur à **1 chiffre** (division décimale arrêtée au plus tard au centième, reste nul) — le diviseur à 2 chiffres est au programme de **6e** ;
- nombres entiers : CM1 ≤ 999 999, CM2 ≤ 999 999 999 (**pas de milliard** avant la 6e) ; décimaux : centièmes au CM1, millièmes au CM2 ;
- soustraction posée : « par cassage » **ou** « par compensation », un seul algorithme par école du CE1 au CM2 → réglage parent ;
- multiplication posée : le 0 est écrit (« règle des 0 ») plutôt que de « décaler » ; dès le CE2 (2-3 chiffres × 1-2 chiffres) ;
- conjugaison : pas de 2e groupe avant le CM1, passé simple et plus-que-parfait **au CM2** seulement, impératif et conditionnel en 6e ;
- fluence de fin de CP : 30 mots/min sans préparation ;
- formats Repères : QCM à 4 choix en français (sauf dictées et conjugaison écrite), 6 choix pour les problèmes et les fractions de la ligne graduée, tables en 1 min (25 calculs), procédures en 3 min (30 calculs).

## 4. Référentiel interne de compétences

### 4.1 Axes (ids stables, utilisés partout : moteur, radar, import, rapports)

**Français**

| id | Axe | Compétences Repères couvertes | Niveaux |
|---|---|---|---|
| `fr.phono` | Phonologie | Manipuler des syllabes / des phonèmes | CP-CE1 |
| `fr.lettres` | Lettres & sons | Connaître le nom / le son des lettres | CP |
| `fr.decodage` | Lire des mots | Lire à voix haute des mots | mi-CP-CE1 |
| `fr.fluence` | Lire à voix haute un texte | Lire à voix haute un texte (MCLM) | mi-CP→CM2 |
| `fr.comp_ecrit` | Comprendre un texte lu | Comprendre des phrases lues / un texte lu | CP→CM2 |
| `fr.comp_oral` | Comprendre un texte entendu | Comprendre des mots / phrases / un texte entendus | CP→CM2 |
| `fr.ecrire_syll` | Écrire des syllabes | Écrire des syllabes dictées | CP-CE1 |
| `fr.ortho` | Écrire des mots | Écrire des mots dictés | mi-CP→CM2 |
| `fr.vocab` | Synonymes & familles | Trouver des synonymes ; trouver des mots de la même famille | CE1→CM2 |
| `fr.constituants` | Sujet, verbe, compléments | Identifier les principaux constituants de la phrase ; la relation sujet-verbe | CE1→CM2 |
| `fr.classes` | Nature des mots | Différencier les principales classes de mots | CE1→CM2 |
| `fr.accord_gn` | Accords dans le GN | Accorder au sein du groupe nominal | CE1→CM2 |
| `fr.conjug` | Conjugaison & accord S-V | Mémoriser des temps de conjugaison ; accorder le sujet et le verbe | CE1→CM2 |

**Mathématiques**

| id | Axe | Compétences Repères couvertes | Niveaux |
|---|---|---|---|
| `ma.denombrer` | Dénombrer | Dénombrer des collections | CP |
| `ma.nombres` | Lire & écrire des nombres | Lire / écrire des nombres entiers (dictée) | CP→CM2 |
| `ma.repres` | Représentations | Décomposition additive, comparer, lire fractions et décimaux, interpréter/représenter des fractions, comparer à l'unité | CP→CM2 |
| `ma.ligne` | Ligne graduée | Placer un nombre sur une ligne graduée | CP→CM2 |
| `ma.faits` | Faits numériques | Mémoriser des faits numériques (tables) | CP→CM2 |
| `ma.procedures` | Calcul rapide | Mémoriser des procédures (calcul mental réfléchi) | CE1→CM2 |
| `ma.operations` | Poser et calculer | Poser et effectuer des opérations | CE1→CM2 |
| `ma.problemes` | Résoudre des problèmes | Problèmes (+ en CM2 : algébriques, géométrie plane, données, proportionnalité) | CP→CM2 |
| `ma.geo` | Géométrie, grandeurs & mesures | hors radar (sauf problèmes CM2) | phase 2.4 |

### 4.2 Échelle de maîtrise (identique aux fiches officielles)

`θ ∈ [0 ; 3]` : sous 1 = à consolider, 1 = ⊕, 2 = ⊕⊕, 3 = ⊕⊕⊕, `null` = absence / non positionné.
Rendu radial calqué sur le papier : `r(θ) = R·θ/2` si θ ≤ 1, sinon `R·(0,5 + 0,25·(θ−1))` → les cercles ⊕ / ⊕⊕ / ⊕⊕⊕ tombent à 0,5R / 0,75R / R.

### 4.3 Gabarits radar officiels

**CM2** (relevés sur des fiches réelles de septembre 2026). Angles en degrés, sens horaire depuis le haut.

Français, 9 axes, pas de 40° :
20° `fr.comp_oral` « Comprendre un texte » [ORAL] · 60° `fr.vocab` « Reconnaître des synonymes et des mots de la même famille » [VOCABULAIRE] · 100° `fr.ortho` « Écrire des mots » [VOCABULAIRE] · 140° `fr.constituants` « Repérer le sujet, le verbe et le complément » [GRAMMAIRE ET ORTHOGRAPHE] · 180° `fr.classes` « Identifier la nature des mots » · 220° `fr.accord_gn` « Accorder le nom et l'adjectif » · 260° `fr.conjug` « Maîtriser l'accord du verbe conjugué » · 300° `fr.fluence` « Lire à voix haute un texte » [LECTURE] · 340° `fr.comp_ecrit` « Comprendre un texte lu » [LECTURE].

Maths, 7 axes, pas de 360/7 :
25,7° `ma.repres` « Utiliser différentes représentations des nombres » [NOMBRES] · 77,1° `ma.faits` « Connaître les tables de multiplication » [CALCUL MENTAL] · 128,6° `ma.procedures` « Calculer rapidement » · 180° `ma.operations` « Poser et calculer » [OPÉRATIONS] · 231,4° `ma.problemes` « Résoudre des problèmes » [RÉSOLUTION DE PROBLÈMES] · 282,9° `ma.nombres` « Écrire des nombres » [NOMBRES] · 334,3° `ma.ligne` « Placer un nombre sur une ligne graduée » [NOMBRES].

Couleurs : français gris-vert (trait `#7f9c97`, aplat `#e3ebe9`) ; maths orange (trait `#e8945a`, aplat `#fbe1cc`). Repères visuels : cartable au centre, pastilles blanches cerclées aux sommets.

**CP, CE1, CE2, CM1** : axes des fiches 2026 relevés dans les guides et maquettes DEPP (CM1 : 11 + 7 axes ; CE2 : 11 + 9 ; CE1 : 8 + 7 ; CP : 7 + 6), codés dans `js/core/axes.js` (`ficheTemplate`). Plusieurs axes officiels peuvent correspondre au même axe interne (ex. CM1 « synonymes » + « mots de la même famille » → `fr.vocab`) : l'import en fait la moyenne. Angles relevés sur des fiches réelles au CM2 ; du CP au CM1, axes répartis régulièrement, le haut entre deux axes (1er axe de la liste à −pas/2), ordre lu sur les maquettes DEPP 2026 et les mini-radars des fiches descriptives pour les parents (ARCHITECTURE §8.7, `tests/fiches.test.mjs`). Le radar « Mes progrès » utilise les axes internes de la classe (`CLASS_AXES`).
Sur la fiche, l'échelle est notée « + / ++ / +++ » (trois groupes : à besoins, fragile, satisfaisant) ; absence = « Pas de positionnement », point au centre. Couleurs des PDF officiels : français turquoise ≈ `#92D1D7`, maths orange pêche ≈ `#F8B886` (les teintes photographiées diffèrent : la détection se fait par la teinte).

## 5. Progression des contenus par niveau

Paramètres des générateurs (`js/content/**`), vérifiés dans les programmes (BO n°41/2024 cycle 2, BO n°16/2025 cycle 3) le 02/10/2026. Les générateurs travaillent sur une échelle absolue A (0 = rentrée de CP … 5 = fin de CM2, cf. `docs/ARCHITECTURE.md` §5.4).

### 5.1 Mathématiques

| Axe | CP | CE1 | CE2 | CM1 | CM2 |
|---|---|---|---|---|---|
| Nombres (dictée, lettres↔chiffres) | ≤ 100 (lettres ≤ 50) | ≤ 1 000 | ≤ 10 000 | ≤ 999 999 | ≤ 999 999 999 (pas de milliard) |
| Ligne graduée | pas de 1, jusqu'à 20 puis 100 | pas de 1, 10, 100 jusqu'à 1 000 ; déduire le pas | pas de 1, 10, 100, 1 000 jusqu'à 10 000 ; fractions d'unité ≤ 1 (quarts, dixièmes…) | entiers jusqu'à 999 999 ; fractions (dén. ≤ 20, > 1) ; décimaux au centième (zoom) | décimaux au millième (zoom) ; fractions > 1 ; grands nombres |
| Représentations | dizaines/unités, comparer | fractions ≤ 1 (dén. 2, 3, 4, 5, 6, 8, 10) | fractions ≤ 1 (dén. ≤ 12), égalités | fractions décimales ↔ virgule, centièmes, arrondi à l'unité | millièmes, encadrer au dixième/centième |
| Faits numériques | tables d'addition 0-10 dans les deux sens, compléments à 10, doubles/moitiés | tables d'addition ; tables de multiplication sur l'année (1-6 et 10, puis 7, 8, toutes) | toutes les tables, deux sens | + quotients associés, 25 × 1 à 4, décompositions de 60, × 10/100/1 000 | + moitiés des impairs ≤ 15, décimal × et ÷ 10/100/1 000 |
| Calcul rapide | ±1, ±2, ±10, complément à la dizaine, + 9 = + 10 − 1 | ± dizaines/centaines, × 10, + 9/19/29, − 9, 11-19 × n | × 10, × 100, ± 8…39, × 4, × 8, 11-99 × n, complément à 100 | × 5 = × 10 puis moitié, 9 × 400, distributivité, dixièmes/centièmes sans retenue, décimal × ou ÷ 10 | décimaux (8,6 + 7,8), ± 98/99, 900 × 700, double/moitié d'un décimal, ÷ 4, ÷ 8, décimal × 5 et × 50, ordres de grandeur |
| Opérations posées | addition (fin d'année) | addition ; soustraction (cassage **ou** compensation, choix de l'école) | jusqu'à 10 000, montants à virgule ; multiplication 2-3 × 1-2 chiffres (règle des 0) | multiplication d'entiers (876 × 208), décimal × entier < 10, décimaux en colonnes, division euclidienne par 1 chiffre | décimal × entier, division décimale par 1 chiffre (au centième, reste nul) — 2 chiffres en 6e |
| Problèmes | parties-tout 1 étape, additifs 2 étapes, partage | + comparaison, multiplicatifs, mixtes 2 étapes, schéma en barres introduit | mixtes 2-3 étapes, comparaison multiplicative, produit cartésien | multi-étapes, fractions unitaires d'une quantité, données | proportionnalité (linéarité), durées (h, min, s), données, « algébriques » au schéma en barres |

### 5.2 Français

| Axe | CP | CE1 | CE2 | CM1 | CM2 |
|---|---|---|---|---|---|
| Phonologie, lettres | syllabes, phonèmes, nom et son des lettres | (remédiation) | — | — | — |
| Fluence (cible fin d'année) | 30 sans préparation (50 après) | 70 | 90 | 110 | 120, ponctuation, liaisons, unités de sens |
| Compréhension écrite et orale | phrases et textes courts lus par l'adulte (TTS) | textes courts lus seul, explicite | inférences simples, personnages | inférences, chronologie, documentaires, consignes | textes longs, implicite, point de vue, documentaires |
| Écrire des mots | syllabes, mots simples | mots fréquents, invariables | irréguliers fréquents, morphologie | radical/préfixe/suffixe, homophones lexicaux | lettres muettes, doubles consonnes, invariables |
| Vocabulaire | catégories, contraires | synonymes/antonymes simples | synonymes, familles de mots | polysémie, préfixes/suffixes | champs lexicaux, sens propre/figuré |
| Classes de mots | — | nom, verbe, déterminant | + adjectif, pronom personnel sujet | + adverbe, préposition | + conjonction de coordination |
| Constituants | — | sujet, verbe | groupe sujet, verbe, compléments | compléments du verbe / de phrase | + attribut, phrase complexe |
| Accords GN | — | -s, -e | -x, -aux, réguliers | GN étendu | GN étendu, participe passé |
| Conjugaison | (être, avoir : observation) | présent → imparfait → futur → passé composé (être, avoir, 1er groupe) | les 4 temps + faire, aller, dire, venir, pouvoir, voir, vouloir, prendre | + 2e groupe, variations du radical (-cer, -ger, -yer, -eler, -eter), participe passé avec être, sujet éloigné ou multiple | + passé simple et plus-que-parfait, sujet inversé, participe passé avec avoir + COD placé avant |

## 6. Catalogue de jeux

Règles communes :
- 1 manche = 8 à 12 items (≈ 3 min).
- Formats calqués sur les Repères : QCM à 4 choix, 6 choix pour les problèmes, ligne graduée, dictées de mots et de nombres, intrus, synonyme en contexte, mot souligné, temps du verbe, sprints optionnels.
- Feedback « juicy » et aucune punition.
- Réponse par toucher ou clavier, plus la voix (Vosk) dans les jeux de lecture et de tables.

| # | Jeu | Axes | Mécanique | Motion / son |
|---|---|---|---|---|
| 1 | **La course de Caramel** (existant) | fr.fluence, fr.decodage (CP : syllabes/mots), bonus fr.comp_ecrit | karaoké contre Zip. **Zip adaptatif** : vitesse = médiane MCLM récente × 1,05, bornée par la cible de la classe. Question de compréhension en fin de course. +10 textes CM2 longs (≥ 150 mots, sans apostrophes) | existant + nouvelles anims |
| 2 | **Les Syllabes qui dansent** | fr.phono | taper chaque syllabe sur le temps (métronome WebAudio), segmenter/fusionner, à la Poppins | pulsations, notes pentatoniques |
| 3 | **L'Atelier des lettres** | fr.lettres, fr.ecrire_syll | entendre un son (TTS) → toucher le graphème ; composer une syllabe | lettres qui rebondissent |
| 4 | **Le Détective du ranch** | fr.comp_ecrit | texte court (≤ 300 mots en CM) → 3-5 QCM (explicite, inférence, sens en contexte) ; après une erreur, « reviens au texte » surligne l'indice | loupe, indices scintillants |
| 5 | **Radio Ferme** | fr.comp_oral | TTS lit le texte 2 fois (comme aux Repères) → QCM ; variante « suis la consigne » (glisser des objets) | ondes radio |
| 6 | **Les Lettres envolées** | fr.ortho | dictée TTS répétée 2 fois ; on tape (CM) ou on attrape les lettres-ballons dans l'ordre (CP-CE1) ; Leitner sur les mots ratés | ballons → confettis de lettres |
| 7 | **Le Jardin des mots** | fr.vocab | planter chaque mot sur l'arbre de sa famille ; l'intrus ; synonyme en contexte ; mémory synonymes/contraires | arbres qui poussent |
| 8 | **Le Marché aux mots** | fr.classes | tapis roulant : le mot souligné va dans le bon panier (nom, verbe, adjectif, déterminant, pronom…) | paniers, combo |
| 9 | **Le Train de la phrase** | fr.constituants | phrase en wagons : accrocher sujet, verbe, compléments ; trouver le sujet parmi 4 | locomotive, fumée |
| 10 | **Le Caméléon des accords** | fr.accord_gn | le caméléon change de couleur selon genre et nombre ; choisir le mot bien accordé parmi 4 ; construire le GN | changement de couleur |
| 11 | **Le Chef d'orchestre** | fr.conjug | conjuguer en rythme (sujet sur le temps fort → terminaison) ; identifier le temps parmi 4 ; tempo progressif | musiciens animés |
| 12 | **La Boîte aux nombres** | ma.nombres, ma.denombrer | dictée de nombres (TTS) → clavier ; lettres ↔ chiffres ; dénombrer (CP) | chiffres qui tombent |
| 13 | **Le Chemin de la clôture** | ma.ligne | Caramel saute de piquet en piquet sur une clôture graduée : lire le nombre pointé ou placer un nombre ; zoom pour les décimaux ; tolérance progressive | saut en arc, zoom caméra |
| 14 | **Les Formes du nombre** | ma.repres | apparier décomposition, fraction (tarte/barre), décimal, écriture en lettres ; comparer à l'unité ; crocodile < > | parts de tarte qui s'emboîtent |
| 15 | **Le Galop des tables** | ma.faits | runner rythmique : répondre avant l'obstacle ; Leitner par fait (7×8…) ; réponse au clavier **ou à la voix** (grammaire Vosk réduite aux nombres) ; mode zen sans chrono | galop, combo |
| 16 | **Pommes express** | ma.procedures | série calme de 10 ou sprint de 60 s (opt-in) ; après une erreur, la stratégie est montrée (+9 = +10−1) | compteur de pommes |
| 17 | **L'Atelier des opérations** | ma.operations | grille de calcul posé interactive, colonne par colonne, retenues guidées | retenues qui s'envolent |
| 18 | **Les Missions du ranch** | ma.problemes | énoncé lu (TTS) et affiché → **construire le schéma en barres** → réponse (6 choix ou clavier) ; contextes tirés de la vie du ranch ; diagrammes en barres en CM | barres qui se dessinent |
| — | **Le Grand check-up** | tous | positionnement adaptatif ≈ 10 min, 2-3 items par axe, aucun score affiché à l'enfant | — |

## 7. Moteur adaptatif « doux »

### 7.1 Modèle
- Par profil et par axe : `{t:θ, n:nb d'observations, last, trend}`.
- Chaque item a une difficulté `b ∈ [0;3]` sur la même échelle, relative à la classe : 2 = attendu de la classe, < 1 ≈ classe inférieure, > 2,5 = avancé.
- `p = 1/(1+e^(−1,7(θ−b)))`.
- Après une réponse `r` (1 = juste, 0,6 = juste après indice, 0 = faux) : `θ ← clamp(θ + K(r−p), 0, 3)`, avec `K = max(0,08 ; 0,4/√(n+1))`.
- Axes à composante vitesse (faits, procédures) : r = 1 seulement sous le temps « automatisé » (≈ 3 s par fait), sinon 0,8. Fluence : θ est dérivé du MCLM rapporté à la cible de la classe.

### 7.2 Initialisation
Ordre de priorité :
1. évaluation importée (θ = valeur, n = 4) ;
2. Grand check-up (n = 3) ;
3. défaut θ = 1,5 (on démarre légèrement sous l'attendu pour la confiance).

### 7.3 Choix des items et filet de sécurité
- Cible p ≈ 0,8, soit `b ≈ θ − 0,8`.
- 2 erreurs de suite → item plus facile (b − 0,5) + indice visuel.
- 4 réussites de suite → b + 0,3.
- Jamais 3 erreurs d'affilée sans aide.

### 7.4 « Ma balade du jour » (≈ 15 min, réglable 10/15/20)
Quatre blocs :
1. échauffement facile sur un point fort ;
2. priorité 1 ;
3. révision espacée ou priorité 2 ;
4. récompense (course de Caramel ou jeu libre).

Poids d'un axe = `(3 − θ)^1,5 × importance × fraîcheur`. Importance par défaut ×1,3 pour fluence et faits numériques (leviers transverses). Jamais deux fois le même jeu de suite. Chaque axe actif est vu au moins une fois par semaine.
Règles affinées en v2.0 (revue pédagogique, simulations sur 10-30 jours) : l'échauffement **tourne** parmi les 3 meilleurs θ (de préférence ≥ 2) sans reprendre celui des 2 jours précédents ; un axe faible pris en échauffement peut revenir en révision à son vrai niveau ; la révision ne reprend pas l'axe révisé la veille ; la règle hebdomadaire porte sur une pratique **au niveau** (hors échauffement) ; un bloc de lecture en priorité ou révision compte **2 histoires** (3 pour 20 min), 1 en échauffement ou récompense.

### 7.5 Répétition espacée
Leitner à 5 boîtes (1, 2, 4, 8, 16 jours) pour : faits des tables, mots de dictée, formes verbales irrégulières, mots ratés en fluence (ex-lot 3 v11). Une clé ne monte que si sa révision était due et pas déjà faite le jour même (pas de bachotage) ; une erreur la ramène en boîte 1 ; la part d'items dus dans une manche grandit avec l'arriéré (0,4 + dues/50, plafond 0,8).

### 7.6 Remédiation invisible
Si θ < 1, le générateur puise dans le niveau inférieur, présenté comme « échauffement ». L'enfant voit des mondes et des étapes, **jamais** « CE2 » ni une note.

### 7.7 Anti-hardcore
- Aucune perte de 🍎 ni de ⭐.
- Chrono opt-in (réglage parent), affiché comme une jauge douce.
- 2 jokers-indices gratuits par manche.
- 1 gel de série offert par semaine.
- Messages d'encouragement contextualisés.

## 8. Import de l'évaluation nationale

### 8.1 Parcours
Onboarding ou espace parents → « J'ai ma fiche Repères » → choix classe + matière (détection automatique par la teinte : gris-vert = français, orange = maths) → photo via `<input type=file accept="image/*" capture="environment">` → saisie.

### 8.2 v2.0 — saisie guidée sur la photo
1. La photo s'affiche en fond semi-transparent.
2. Le gabarit officiel (§4.3) est superposé ; l'utilisateur l'aligne en 2 touches (centre = cartable, haut du cercle ⊕⊕⊕).
3. Il fait glisser chaque sommet sur la photo (aimanté à 0,1). Bouton « absent » par axe.
4. Les valeurs sont calculées par l'inverse de r(θ).

Sans photo : même gabarit, réglage axe par axe.

### 8.3 v2.1 — détection automatique (avancée de la 2.4, demandée après l'essai de la 2.0)
Dès que la photo est choisie, la fiche est lue **automatiquement, sur l'appareil** (Web Worker) : les trois cercles ⊕ / ⊕⊕ / ⊕⊕⊕ donnent le centre, l'échelle et la perspective (photo de biais, papier ondulé) ; le nombre d'axes distingue le français des mathématiques ; chaque axe est lu par la pastille blanche cerclée, le contour du polygone et la teinte ; la mention « Pas de positionnement : absence » rend l'axe absent. Les points arrivent pré-placés et le parent valide le récapitulatif. **Plan B toujours disponible** : corriger un point ou réaligner le gabarit à la main (saisie guidée v2.0) ; échec ou confiance faible → message clair, conseil de prise de vue (« reculez un peu », « posez la fiche bien à plat »…), « 📷 Reprendre la photo » et saisie guidée. La photo n'est jamais conservée.

### 8.4 Import par fichier
Format `caramel-eval` (annexe A). Les profils réels lus sur les fiches de septembre 2026 sont les fichiers `profil-*.json` locaux de Cédric, **jamais committés**.

### 8.5 Effets de l'import
- Fixe le θ initial des axes.
- Les axes « absent » sont proposés au Grand check-up.
- L'évaluation est conservée comme référence (polygone pointillé, §9).

## 9. Vue radar & progression

- **« Mes progrès »** (enfant) : deux radars (français, maths) au gabarit de sa classe. Polygone actuel plein, évaluation officielle en pointillés, étoiles qui scintillent sur les axes en progrès, libellés enfant (« Lire à voix haute 🎤 »).
- **Espace parents** (porte des adultes : code à 4 chiffres facultatif choisi par le parent, haché sur l'appareil ; sinon une racine carrée hors de portée d'un enfant ; « Code oublié ? » ; elle se referme dès qu'on revient côté enfant) — en tête, **« En bref »** (la semaine, ce qui progresse, ce qui est à travailler par rapport à l'attendu de la classe ⊕⊕, « À revoir ensemble ») ; détail par compétence replié par défaut :
  - mêmes radars avec curseur temporel (snapshots hebdomadaires) et morphing animé ;
  - détail par axe : θ, tendance, items, temps ;
  - courbe MCLM vs attendu de la classe ;
  - faits et mots à revoir.
- Snapshot automatique chaque semaine dans `snapshots[]` (plafond 104).

## 10. Profils, économie, compagnon v2

### 10.1 Multi-profils
- Sélecteur au lancement (avatars = compagnons) + bouton « Ajouter un enfant ».
- Chaque profil : prénom, genre (accords), classe, compagnon, progression.
- Bouton « Je passe en … ! » pendant l'été et à la rentrée.
- v2.1 : l'avatar de l'accueil ouvre « Qui joue ? » : changer d'enfant en un geste (sans rien perdre : chacun sa progression, son compagnon, son thème), ajouter un enfant, aller « En famille » (§10.4).

### 10.2 Économie
- ⭐ (courses Caramel, inchangé) et 🍎.
- Gains en 🍎 : 1 par bonne réponse, +10 par séance terminée, bonus de streak v11.
- Badges de compétence par axe : bronze θ ≥ 1,5, argent ≥ 2,25, or ≥ 2,75.

### 10.3 Compagnon — direction artistique
- **Style « kawaii flat » unifié** pour les 8 espèces : tête ≈ 45 % de la hauteur, contours ronds de 3 px brun chaud `#4a2c1a`, aplats + une ombre + un reflet, grands yeux à 2 reflets, joues rosées.
- **Rig SVG commun** : groupes `body head earL earR eyes mouth tail legs[]/fins`, ancres nommées `headTop face neck back tail`. Tous les accessoires s'adaptent ainsi à toutes les espèces. `transform-box: fill-box` partout (leçon v11.2).
- **Expressions** (échange des calques yeux/bouche) : neutre, content, ravi, fier, surpris, endormi, petit creux, concentré (pendant les jeux).
- **Idle** : respiration 3,5 s, clignement aléatoire toutes les 3-6 s, oreilles et queue en follow-through (décalage 120 ms), regard qui suit le doigt.
- **Réactions** : manger (mâche + miettes), brossage (paillettes), promenade (cycle de marche), célébration (saut + vrille), câlin sur appui long.
- **Vie** (v2.1, `js/ui/companion-life.js`) : actions spontanées propres à chaque espèce toutes les 8-20 s (le chat joue avec un papillon, le dauphin saute hors du lac, le dragon bat des ailes…), regard qui suit le doigt, humeur liée aux jauges (petit creux, bâillements), sommeil de 22 h à 7 h, réactions aux soins (la nourriture vole jusqu'à sa bouche, la brosse passe sur son dos, il sort se promener et revient), câlin sur appui long ; vie légère sur tous les avatars ; tout s'arrête hors de l'écran et en mouvement réduit.
- **Diorama** : ciel selon l'heure réelle (lever et coucher du soleil en France, aube, crépuscule, nuit étoilée), saisons (feuilles, flocons, pétales, lucioles) ; météo et décor achetable : 2.4.
- **Évolution en 3 stades** (petit → junior → champion, à 60 puis 300 min) selon les minutes d'apprentissage cumulées, pas selon le score ; chaque évolution est fêtée une seule fois.
- **Validation** : planche contact (`tests/harness/companion.html` en Chrome headless : espèces × expressions × humeurs × stades, rangée de silhouettes noires) relue avant chaque push ; chaque espèce doit être reconnaissable en silhouette.

### 10.4 En famille (v2.1, demande du parent)
Un seul téléphone ou une seule tablette pour plusieurs enfants : chacun garde sa progression, et la famille joue ensemble.
- **Classements de la semaine** (remis à zéro le lundi) : ⏱️ minutes d'entraînement, 🍎 pommes gagnées, 🔥 série en cours, ⭐ étoiles de lecture, 🏅 défis gagnés. On ne classe **que l'effort**, **jamais le niveau** ; podiums et « Bravo à tous ! », ex aequo partout, jamais de « dernier ».
- **Concours de compagnons** : trois juges notent la croissance (stade et minutes d'apprentissage), les soins (jauges) et l'élégance (accessoires, montures) ; chaque compagnon reçoit un ruban ; le gagnant de la semaine reçoit un trophée.
- **Défi en famille** (2 à 4 joueurs, 3 ou 5 manches, à tour de rôle sur le même appareil) : tables, calcul éclair, conjugaison ou mélange ; chacun reçoit des questions **à son niveau** (tout le monde peut gagner) ; + 100 par bonne réponse, bonus de rapidité relatif au seuil de la question et de série, jamais de points retirés ; 5 🍎 de participation, + 10 🍎 et un trophée pour le gagnant ; revanche (un autre enfant commence) ; chaque réponse fait progresser l'enfant comme dans ses jeux.

### 10.5 Thèmes visuels (v2.1, demande du parent)
8 univers au choix : Caramel (l'original), Licorne, Princesse, Super-héros (générique, aucune marque), Dinosaures, Bolides, Espace, Océan. Présélection à la création du profil (Dinosaures pour un garçon, Caramel pour une fille), modifiable par l'enfant (« 🎨 Mon thème » sur l'accueil) et dans l'espace parents ; un thème par profil, appliqué dès l'ouverture. Les couleurs de réussite (vert), d'erreur douce (orange), des radars officiels et des décors naturels des jeux ne changent pas ; contrastes de texte ≥ 4,5:1 dans tous les thèmes.

## 11. Motion design & sound design

- **`js/core/motion.js`** (Web Animations API, zéro dépendance) :
  - `pop`, `squash`, `flyTo` (arc vers le portefeuille), `burst` (particules canvas), `countUp`, `shake` doux (6 px, jamais de rouge vif), `morphPolygon` (radar) ;
  - transitions d'écran à élément partagé (la carte de jeu s'agrandit en écran de jeu).
- **Courbes et durées** : overshoot `cubic-bezier(.34,1.56,.64,1)`, entrée `cubic-bezier(.22,1,.36,1)` ; durées 150 / 300 / 600 ms.
- **Moments chorégraphiés** :
  - bonne réponse : pop + paillettes + note qui monte avec la série ;
  - fin de manche : étoiles qui volent dans la jauge ;
  - badge : révélation rotative + halo ;
  - déblocage : porte de l'enclos qui s'ouvre ;
  - séance du jour finie : le compagnon danse.
- **Accessibilité** : `prefers-reduced-motion` → fondus seulement ; réglage « animations douces ».
- **Son** (synthèse WebAudio, aucun fichier) : pentatonique pour les réussites, bois doux pour les erreurs, métronome pour les jeux rythmiques, nappe d'ambiance par monde, muet mémorisé.
- **TTS** : `speechSynthesis` fr-FR, avec texte affiché en secours si aucune voix n'est disponible.

## 12. Sauvegardes & rapports

- **Export** : fichier `caramel-<prenom>-<AAAA-MM-JJ>.json` (un profil ou tous), via Blob + `a[download]`.
- **Import** : validation de schéma, puis choix « remplacer » ou « ajouter comme nouveau profil ».
- **Rapport** : page imprimable A4 (`@media print`) → « Enregistrer en PDF ». Contenu : radars officiel vs actuel, tableau par axe, courbe MCLM, temps passé, jeux joués, faits et mots maîtrisés, 3 conseils templatés bienveillants.
- **Carte PNG** (canvas) partageable via Web Share.
- **Bilan hebdo** : carte dans l'espace parents chaque lundi.

## 13. Données & migration v11 → v2

### 13.1 Schéma `caramel-v3`
```json
{ "schema": 3, "active": "p1", "migratedFrom": "v11",
  "profiles": { "p1": {
    "id": "p1", "name": "Léa", "g": "f", "classe": "CM2", "created": "2026-10-02",
    "companion": { "type": "pony", "name": "Caramel", "owned": ["pony"],
                   "equip": { "owned": [], "worn": [] },
                   "pet": { "faim": 80, "forme": 80, "joie": 80, "last": 0, "brushLast": 0, "walkDay": "" },
                   "stage": 1 },
    "wallet": { "apples": 0, "stars": { "pomme": 3 } },
    "streak": { "count": 0, "last": "", "freezes": 1 },
    "skills": { "fr.fluence": { "t": 1.5, "n": 0, "last": "" } },
    "evals": [ { "src": "reperes", "date": "2026-09", "classe": "CM2", "fr": {}, "ma": {} } ],
    "snapshots": [], "leitner": {}, "history": [], "mclm": [],
    "settings": { "sessionMin": 15, "timers": false, "sound": true, "motion": "full" } } } }
```
`history[]` est plafonné à 500 entrées.

### 13.2 Algorithme (au boot, si `caramel-v3` est absent)
1. Lire `caramel-save-v2` (v11), sinon `caramel-progress-v1` (v1-v10).
2. Copier le brut dans `caramel-backup-v11` ; cette clé n'est jamais réécrite ensuite.
3. Créer `p1` :
   - name/g ← hero ;
   - companion ← mount + equip + pet ;
   - wallet ← apples + stars (ids d'histoires inchangés) ;
   - streak ← streak (+1 gel offert) ;
   - cas v1 seul : apples = Σ⭐ × 10 (règle v11).
4. `skills["fr.fluence"]` est estimé depuis les étoiles (faute d'historique MCLM) ; les autres axes restent non initialisés.
5. `classe = null` → écran « Bienvenue dans Caramel 2 ! Tes X 🍎 et Y ⭐ sont bien là. Tu es en quelle classe ? » + célébration.
6. Écrire `caramel-v3`. Ne supprimer aucune ancienne clé en v2.0 (nettoyage à partir de v2.4).

Contraintes : idempotent, try/catch partout. JSON corrompu → profil vierge, backup conservé.

### 13.3 Tests obligatoires
Fixtures : vide · v1 seul · v11 seul · v1 + v11 · v11 corrompu · v11 avec licorne équipée et streak de 12 jours.
Assertions : pommes, étoiles, monture, accessoires portés, jauges, streak.

### 13.4 Faire réellement arriver la mise à jour
- Service worker : cache versionné `caramel-2.x`, `skipWaiting`, bandeau « Nouvelle version — touche pour mettre à jour ».
- Garder l'exclusion de `/models/`.

## 14. Architecture technique

Toujours un site statique GitHub Pages, sans build, en **ES modules natifs** (le monofichier atteint sa limite).

```
index.html                 coquille + router (#/home #/play/<jeu> #/progres #/parents)
css/{base,components,motion}.css
js/main.js                 boot, migration, router
js/core/{store,profiles,migrate,adaptive,leitner,session,radar-model}.js
js/core/{speech,tts,audio,motion,rng}.js     speech = moteur Vosk v11 verbatim
js/ui/{home,companion,radar,report,import-eval,parents,onboarding}.js
js/games/<id>.js           un fichier par jeu, interface commune
js/content/{fr,maths}/<axe>.js    générateurs + banques par niveau
js/content/stories/*.js    histoires Caramel templatées (sans apostrophes ni traits d'union)
sw.js  manifest.webmanifest  icons  models/fr.tar.gz
tests/*.mjs                node : générateurs, migration, adaptatif, templating
package.json               { "type": "module" } (vérifs locales uniquement)
docs/CDC-v2.md
```

- **Interface jeu** : `export default { id, title, axes, levels, mount(root, ctx), unmount() }`, avec `ctx = { profile, nextItem(axis), report(item, r, ms), motion, audio, tts, speech, end(summary) }`.
- **Générateur** : `gen(axis, classe, b, rng) → { prompt, answer, choices?, b, meta }`, déterministe sur un `rng` seedé (tests reproductibles). Cible : ≥ 200 items distincts par axe × niveau (procédural en maths ; banques + gabarits combinatoires en français).
- **Contenu français** : banques originales par niveau (phrases à trous, GN, verbes du programme, familles de mots, textes de 80 à 300 mots + questions). La règle « pas d'apostrophes ni de traits d'union » ne vaut que pour les textes lus à voix haute (reco vocale).
- **Validation avant push** :
  - `node --check` sur chaque module ;
  - `node tests/run.mjs` ;
  - planche contact SVG ;
  - templating vérifié sur toutes les combinaisons (genre du héros × 8 montures) ;
  - migration vérifiée sur les fixtures du §13.3.
- **Perf** : précache des modules (v2.1 : ≈ 2,1 Mo non minifié, ≈ 0,75 Mo compressé, hors modèle ; alerte de `tools/precache.mjs` au-delà de 2,5 Mo), chargement paresseux par jeu.

## 15. Plan de livraison

| Version | Contenu | Acceptation |
|---|---|---|
| **2.0 — Socle + priorités CM2** ✅ livrée le 03/10/2026 (§18) | store v3, migration, multi-profils, onboarding (classe), référentiel + gabarits CM2, saisie guidée + import JSON, moteur adaptatif + balade du jour, vue radar, export/import de sauvegarde, `motion.js` ; jeux : Caramel (Zip adaptatif + 10 textes CM2), Chemin de la clôture, Galop des tables, Pommes express, Chef d'orchestre, Atelier des opérations | les profils s'importent ; une balade de 15 min ciblée fonctionne ; les données v11 sont intactes |
| **2.1 — Compagnon vivant, radar automatique, thèmes, En famille** ✅ prête le 04/10/2026 (§18) (priorités du parent après l'essai de la 2.0) | refonte des 8 espèces (kawaii, rig commun, expressions, accessoires vectoriels, stades), moteur de vie (attente, regard, sommeil la nuit, réactions aux soins), diorama jour/nuit ; détection automatique du radar photographié (plan B : réglage manuel) ; 8 thèmes visuels au choix (présélection à la création du profil) ; En famille (Qui joue ?, classements, concours, défi) ; audit design et espace parents revu | chaque espèce reconnaissable en silhouette ; une photo de fiche se lit sans réglage dans la plupart des cas ; aucun thème illisible ; plusieurs enfants sur un appareil sans rien perdre |
| 2.2 — Simple, étape par étape (consigne du parent, §1 principe 7 ; proposition validée par le parent le 04/10/2026 : jury de 3 pistes, synthèse « un seul gros bouton » + voix ; voix automatique en CP-CE1, liens LinkedIn dans l'espace parents, essayage avant achat pour tous les objets de la boutique) | accueil « un seul gros bouton » (compagnon en grand, soins en icônes-jauges, « Jouer ▶ » qui lance l'étape du jour), balade enchaînée depuis le bilan, en-tête de jeu sur une ligne, bilans et Mes progrès allégés ; lecture à voix haute en CP-CE1 (consignes, indices, bilans) ; balade jamais bloquée (sans micro : autre jeu) ; pavé en paysage ; constats d'audit restants (`docs/AUDIT-DESIGN.md`) | un CP sait quoi toucher sans lire ; l'accueil tient dans un écran de téléphone ; aucune fonctionnalité perdue |
| 2.3 — Tout le cycle 3 | Détective, Radio Ferme, Lettres envolées, Jardin des mots, Marché aux mots, Train de la phrase, Caméléon, Boîte aux nombres, Formes du nombre, Missions du ranch ; Grand check-up ; rapports PDF/PNG ; bilan hebdo ; snapshots + morphing | 9 axes français + 7 axes maths du CM2 jouables, ≥ 200 items par axe |
| 2.4 — Cycle 2 | contenus CP→CE2 pour tous les jeux ; Syllabes qui dansent, Atelier des lettres ; Caramel CP (syllabes/mots) | un profil CP jouable de bout en bout |
| 2.5 — Polish | badges, carte des mondes, décor achetable du diorama, accessibilité (police aérée, contrastes), nettoyage des anciennes clés | — |

## 16. Pièges & conventions

- Reprendre le CDC v11 §4 (moteur vocal, ne pas régresser) et §8 (pièges).
- Aucune donnée nominative d'enfant dans le repo ; aucun texte copié des évaluations ou des manuels.
- L'enfant ne voit jamais un niveau inférieur, une note ou un classement de niveau. Les classements « En famille » (v2.1, §10.4) ne portent que sur l'effort et l'engagement, et le défi pose à chacun des questions à son niveau.
- TTS Android : certaines voix demandent le réseau → toujours afficher le texte en secours.
- Une version = un commit `v2.x : …` ; ce CDC est mis à jour à chaque déploiement.
- Avant tout push : `node tools/precache.mjs` (liste ASSETS + version de sw.js) puis `node tools/check.mjs` (syntaxe + tests). Changer `version` dans package.json pour chaque version publiée (le nom du cache du service worker en dépend).
- Textes lus à voix haute : chaque mot doit exister dans le lexique Vosk (`tests/lexicon.mjs`) ; aucune élision possible devant un prénom (« de Inès ») ; accords du duo héros + compagnon par jetons (`{ils}`, `{tousD}`…, cf. `tplMap`).
- Caractères invisibles (espace fine U+202F, insécable U+00A0, accents combinants) : toujours en séquence d'échappement dans le code (`\u202f`), jamais en littéral.
- Polices : les fichiers Fredoka ont été modifiés (ajout d'un glyphe U+202F de 0,2 em, absent à l'origine) ; ne pas les remplacer par une version téléchargée sans refaire cet ajout.
- Bancs d'essai : `tests/harness/game.html?id=<jeu>&classe=…&theta=…` monte un jeu avec le vrai ctx et une sauvegarde en mémoire ; `window.__caramelDebug = {}` expose l'item en cours dans l'app réelle (tests automatisés). Tests vocaux : voix de synthèse Piper en faux micro (`--use-file-for-fake-audio-capture`), outil de développement hors dépôt.

## 17. Checklist de démarrage (nouvelle session)

1. `git log` (attendu : un commit `v2.1 : …` en tête), lire ce CDC (§1 principe 7 et §18 surtout), `docs/ARCHITECTURE.md`, `docs/JEUX.md` et `docs/AUDIT-DESIGN.md`.
2. `node tools/check.mjs` doit être vert ; ouvrir `tests/harness/game.html` pour voir un jeu isolé.
3. Recueillir le retour du terrain (téléphones des filles), corriger si besoin (`v2.1.x`).
4. Attaquer la 2.2 (§15) : simplification « étape par étape » validée par le parent, lecture à voix haute, constats d'audit restants (`docs/AUDIT-DESIGN.md`).
5. Avant le push : précache, check, version, mise à jour de ce CDC (§18).

## 18. Journal de livraison

### v2.1 (04/10/2026) — compagnon vivant, radar automatique, thèmes, En famille, audit design
**Livré** :
- **compagnon redessiné** : 8 espèces sur un rig commun, expressions, humeurs et 3 stades ; dauphin, dragon et capybara refaits après une critique indépendante ;
- **compagnon vivant** : attente, regard qui suit le doigt, sommeil la nuit, réactions aux soins, câlin, diorama jour/nuit/saisons ; il est intégré partout, avec le bon stade, ses accessoires et une seule ombre, et la carotte arrive à la bouche dans la clôture ;
- **détection automatique du radar photographié**, calibrée sur 4 vraies photos de fiches CM2 (32 axes sur 32 lus sans réglage) ; plan B manuel avec conseil de prise de vue et « Reprendre la photo » ;
- **gabarits des fiches CP→CM1 corrigés** : convention d'angle, ordre du CP maths et du CE1 français — une fiche CP→CM1 importée en v2.0 a pu être rangée sous la compétence voisine, il faut la réimporter ;
- **8 thèmes visuels**, présélectionnés à la création du profil ;
- **En famille** : « Qui joue ? » depuis l'avatar, classements de la semaine (effort seulement), concours de compagnons, défi à tour de rôle ;
- **espace parents revu** (audit design) : porte des adultes avec code à 4 chiffres facultatif, synthèse « En bref », repères ⊕ avec l'attendu de la classe, confidentialité exacte sur la voix, sauvegardes datées ; Mes progrès : nouvelles médailles seulement sur les compétences jouées, et une médaille déjà montrée n'est jamais retirée (un profil d'avant la 2.1 garde celles de la v2.0), or fixe, compagnon dessiné.
**Vérifié** : tests Node (≈ 430 : thèmes et contrastes, rig du compagnon, moteur de vie, famille, détection du radar sur fiches synthétiques et perturbées, gabarits des fiches, espace parents) ; audit design en 4 volets avec les skills design (ergonomie enfant, accessibilité WCAG AA, rendu visuel et design system, textes), chaque constat contre-vérifié (106 retenus) ; vérification de chaque chantier par un agent indépendant ; parcours en Chrome headless (390 × 844, 360 × 740, 1280 × 800, 8 thèmes, mouvement réduit) ; vérification de mise en production (parcours de bout en bout, rendu, régressions v2.0 → v2.1), constats corrigés avant publication : « À revoir » des parents limité aux éléments réellement manqués (un fait juste du premier coup y figurait), podium des ex aequo de « En famille » (valeurs superposées sur téléphone), bouton « C'est parti ! » de nouveau visible sans défiler sur les Android 360 × 740 (D1-05, compagnon et scène réduits ensemble), réglage de lecture des consignes masqué (voir Limites connues).
**Écarts au CDC initial** : détection du radar avancée de la 2.4 à la 2.1 ; classements « En famille » (effort seulement, §16 amendé) ; précache au-delà de 2 Mo (≈ 2,1 Mo non minifié, ≈ 0,75 Mo compressé).
**Limites connues** : la simplification « étape par étape » des écrans enfant (consigne du parent, §1 principe 7) est prototypée et arbitrée (jury de 3) mais pas encore intégrée : 2.2 ; restent aussi la lecture à voix haute dans les jeux (le réglage parent « Lire les consignes à voix haute » est prêt dans le code mais masqué tant qu'aucun jeu ne lit : il promettait une lecture qui n'existe pas), la balade bloquée sans micro et le pavé en paysage (constats d'audit `docs/AUDIT-DESIGN.md`) ; pas d'essai sur un vrai téléphone avant publication.

### v2.0 (03/10/2026)

**Livré** : sauvegarde `caramel-v3` multi-profils avec migration v1/v11 (copie brute `caramel-backup-v11`, anciennes clés intactes, idempotente) ; accueil, profils, nouvel enfant, bienvenue après migration ; « Ma balade du jour » (4 blocs, rotation) ; moteur adaptatif θ/b (CDC §7) avec filet de sécurité, jokers et Leitner ; **6 jeux** : la course (moteur vocal v11 porté à l'identique — test vocal de non-régression : mêmes résultats que la v11 —, Zip adaptatif, question de compréhension, 10 histoires CM2 inédites), le Chemin de la clôture, le Galop des tables (réponse au clavier ou à la voix), Pommes express (sprint si chrono autorisé), le Chef d'orchestre, l'Atelier des opérations (compensation ou cassage) ; Mes progrès (radars au gabarit officiel, médailles) ; espace parents (porte, détail par axe, courbe de lecture, à revoir, réglages, sauvegardes, profils, rappels) ; import de la fiche Repères (fichier `caramel-eval`, saisie manuelle, photo guidée avec alignement et rotation) ; export/import des sauvegardes ; service worker versionné avec bandeau de mise à jour et hors-ligne ; polices Fredoka/Andika auto-hébergées.
**Vérifié** : ≈ 340 tests Node (migration sur fixtures réelles, générateurs sur toute l'échelle A avec réponses recalculées, 17 832 formes de conjugaison contre une table de référence, 4 500 opérations posées rejouées, histoires contre le lexique Vosk) ; parcours en Chrome headless (390 × 844 et 1280 × 800) ; aucune requête réseau hors de l'origine et du CDN Vosk.
**Écarts au CDC initial** : division posée du CM2 par un diviseur à 1 chiffre (le BO place les 2 chiffres en 6e) ; ligne graduée et faits calés sur les pas et listes du BO ; QCM à 6 choix pour la ligne en CP/CE1 et les fractions (format Repères) ; accords du duo fille + licorne corrigés dans 19 phrases v11 (nouveaux jetons) ; 3 élisions v11 reformulées ; précache ≈ 1,6 Mo non minifié (≈ 0,45 Mo compressé).
**Limites connues** : comprendre l'oral, vocabulaire, écriture, classes, constituants, accords du GN, représentations, problèmes = « bientôt » (2.1) ; Grand check-up et rapports PDF : 2.1 ; compagnon redessiné : 2.2 ; contenus CP dédiés : 2.3 ; détection automatique du radar photographié : 2.4. La voix reste à confirmer sur téléphone réel (Chrome Android).

## Annexe A — Format d'import `caramel-eval` (v1)

```json
{ "format": "caramel-eval", "v": 1,
  "profil": { "prenom": "…", "g": "f", "classe": "CM2" },
  "evaluation": { "source": "Repères", "date": "2026-09", "classe": "CM2",
    "fr": { "fr.comp_oral": 2.4, "fr.vocab": null },
    "ma": { "ma.ligne": 1.8 },
    "precision": "lecture photo ±0,3" } }
```

Règles :
- valeurs dans [0 ; 3] ou `null` (absence) ; clés inconnues ignorées ;
- si aucun profil ne porte ce prénom, l'import en crée un ;
- sinon l'évaluation est ajoutée au profil choisi et devient la référence du radar.
