# CDC — Caramel 2 · Accompagnement scolaire CP → CM2

> Spec de référence de la refonte « v2 » (produit). Rédigée le 02/10/2026.
> Remplace `docs/CDC-v11.md` comme source de vérité (à archiver dans `docs/archive/`).
> Code de départ : `main` @ `c5bd8d1` (v11.3). Versions suivantes : `v2.0`, `v2.1`… (un commit = une version).
> **État au 05/10/2026 : v2.2.1 en production, v2.2.2 prête** (la voix du compagnon : voix d'enfant enregistrée, voix fluide calculée sur l'appareil, lecture à voix haute pour tous, invitation à installer, état de l'appareil ; périmètre et écarts : §18). Ensuite : essais sur les téléphones des filles, puis 2.3 (§15).

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

- v2.4 — **au rythme de la classe** : le niveau demandé (jamais θ) est plafonné à ce qui est vu en classe à la date, selon le calendrier des notions (`js/content/calendar.js`) et le rythme choisi par le parent ; « 🌱 Pas encore appris » repousse une notion au mois suivant (journal v2.4, ARCHITECTURE §5.7 ter).

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
- v2.2 : accueil « un seul gros bouton » (§1 principe 7) — en-tête avatar · « Bonjour {P} ! » · 🎨 (thème) · 🔒 (espace parents) ; le compagnon en grand, ses soins en icônes-jauges et UN « Jouer ▶ » qui lance l'étape du jour.
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
- **Scène héros** (v2.2) : sur l'accueil, le compagnon en grand ; soins en icônes dont l'anneau est la jauge ; bulle de pensée 🍎 quand il a faim ; ✓ quand un soin est déjà fait ; boutique en deux rayons avec **cabine d'essayage** (essayer avant d'acheter, pour tous les objets — choix du parent) ; « Il te manque N 🍎 » ; l'aliment à 10 🍎 s'appelle « Poire » 🍐 (une « pomme » à 10 pommes prêtait à confusion).
- **Diorama** : ciel selon l'heure réelle (lever et coucher du soleil en France, aube, crépuscule, nuit étoilée), saisons (feuilles, flocons, pétales, lucioles) ; météo et décor achetable : 2.4.
- **Évolution en 3 stades** (petit → junior → champion, à 60 puis 300 min) selon les minutes d'apprentissage cumulées, pas selon le score ; chaque évolution est fêtée une seule fois.
- **Validation** : planche contact (`tests/harness/companion.html` en Chrome headless : espèces × expressions × humeurs × stades, rangée de silhouettes noires) relue avant chaque push ; chaque espèce doit être reconnaissable en silhouette.

- v2.5 (demande du parent du 07/10/2026 : « des animaux que les enfants aiment ») : l'**ours**, le **koala** et le **chien** (un chiot) rejoignent les compagnons, dans le même style « kawaii flat ». L'ours est un **ourson en peluche debout sur ses deux pattes** (v2.5.1, à la demande du parent) : gros ventre clair, petits bras, il se dandine en marchant, lève les bras de joie, tient son repas contre lui et s'endort assis. Chacun se reconnaît au premier coup d'œil, même en avatar de 48 px : l'ours à ses oreilles rondes et à son museau clair, le koala à ses grandes oreilles duveteuses et à son gros nez noir, le chien à ses oreilles tombantes et à sa truffe au bout du museau. Le chien remue la queue (plus vite quand il est content ou qu'il mange) et tire la langue quand il est heureux. Leurs repas, du petit au régal : ours — cerises, poisson, miel ; koala — rien que de l'eucalyptus (une pousse, des feuilles, une branche) ; chien — croquettes, saucisse, os. Leurs petites actions : l'ourson renifle, tente d'attraper un papillon, savoure, pousse un petit « grrr » ; le koala bâille et savoure ; le chien renifle, gratte la terre, se trémousse.
- **Baleine** (v2.5, demande du parent du 07/10/2026) : 🐳 bleue à grosse tête ronde, gorge claire à rainures, petite nageoire, caudale à deux lobes ; elle nage dans le lac comme le dauphin et souffle un **jet d'eau** quand elle est joyeuse (action spontanée « souffle » : elle inspire puis fait jaillir une gerbe de gouttes) ; elle saute hors de l'eau et fait des bulles. Elle mange une crevette, des petits poissons 🐠, un calamar. Foulard et écharpe noués sous le menton, chapeau et couronne sur l'avant de la tête, jet d'eau derrière.
- **Oiseaux (v2.5, demande du parent du 07/10/2026 : « fais les 4 »)** : une chouette (ronde, aigrettes, disque facial clair, très grands yeux, bec crochu, ventre à chevrons), un perroquet (tête rouge, joues blanches, gros bec crochu, corps vert, ailes bleues, longue queue), un pingouin (dos bleu nuit, masque et ventre blancs, bec et pieds orange, il se dandine et ne s'envole pas) et un poussin (boule jaune duveteuse, houppette, petits ailerons). Mêmes règles que les autres compagnons (8 expressions : le bec s'ouvre pour sourire, 3 stades, portrait, 8 accessoires) ; ils sautillent en marchant (le pingouin se dandine), battent des ailes de joie, dorment la tête dans les plumes. Repas : chouette 🐛 chenille, 🦗 grillon, 🍢 brochette de grillons (jamais de souris) ; perroquet 🌻 graines, 🍌 banane, 🥭 mangue ; pingouin 🦐 crevette, 🐟 poisson, 🍣 sushis ; poussin 🌾 blé, 🌽 maïs, 🍉 pastèque. Actions : la chouette penche la tête et bâille, le perroquet chante, le poussin picore, le pingouin s'ébroue.

### 10.4 En famille (v2.1, demande du parent)
Un seul téléphone ou une seule tablette pour plusieurs enfants : chacun garde sa progression, et la famille joue ensemble.
- **Classements de la semaine** (remis à zéro le lundi) : ⏱️ minutes d'entraînement, 🍎 pommes gagnées, 🔥 série en cours, ⭐ étoiles de lecture, 🏅 défis gagnés. On ne classe **que l'effort**, **jamais le niveau** ; podiums et « Bravo à tous ! », ex aequo partout, jamais de « dernier ».
- **Concours de compagnons** : trois juges notent la croissance (stade et minutes d'apprentissage), les soins (jauges) et l'élégance (accessoires, montures) ; chaque compagnon reçoit un ruban ; le gagnant de la semaine reçoit un trophée.
- **Défi en famille** (2 à 4 joueurs, 3 ou 5 manches, à tour de rôle sur le même appareil) : tables, calcul éclair, conjugaison ou mélange ; chacun reçoit des questions **à son niveau** (tout le monde peut gagner) ; + 100 par bonne réponse, bonus de rapidité relatif au seuil de la question et de série, jamais de points retirés ; 5 🍎 de participation, + 10 🍎 et un trophée pour le gagnant ; revanche (un autre enfant commence) ; chaque réponse fait progresser l'enfant comme dans ses jeux.
- **Avec un copain** (v2.3, décision du parent du 07/10/2026, palier 1 de l'étude multijoueur) : 2 à 4 enfants, chacun sur SON téléphone, sans réseau ni Bluetooth (le Bluetooth web ne peut pas faire se trouver deux téléphones). L'hôte choisit le défi et donne un code à 4 chiffres (défi, nombre de questions, numéro de partie, chiffre de contrôle), dit par le compagnon ; les autres le tapent ; chacun reçoit ses questions à son niveau (barème du Défi en famille : les points se comparent) ; à la fin, on compare en montrant son écran. 🍎 des bonnes réponses + 5 de participation, pas de trophée. Plus tard : QR du résultat (échange du podium), sifflement (ggwave), partie en direct sur un même Wi-Fi ; appli native seulement si les stores le justifient.

### 10.5 Thèmes visuels (v2.1, demande du parent)
8 univers au choix : Caramel (l'original), Licorne, Princesse, Super-héros (générique, aucune marque), Dinosaures, Bolides, Espace, Océan. Présélection à la création du profil (Dinosaures pour un garçon, Caramel pour une fille), modifiable par l'enfant (« 🎨 Mon thème » sur l'accueil) et dans l'espace parents ; un thème par profil, appliqué dès l'ouverture. Les couleurs de réussite (vert), d'erreur douce (orange), des radars officiels et des décors naturels des jeux ne changent pas ; contrastes de texte ≥ 4,5:1 dans tous les thèmes ; v2.2 : l'habillage d'un thème reste loin de l'orange de l'erreur et n'est jamais rouge (Dinosaures ocre, Océan bleu, Bolides gris), anneau de focus ≥ 4,5:1.

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
- **Voix du compagnon** (v2.2.2, `docs/ARCHITECTURE.md` §8.8) : la lecture à voix haute vaut pour tous les enfants (réglage des parents : Oui par défaut, ou Non) ; le texte reste toujours affiché. Trois voix :
  - la **voix enregistrée** : clips MP3 de Piper « siwis medium » (voix neuronale libre choisie par le parent), pour toute phrase qu'un clip couvre (consignes, encouragements, bilans fixes) : instantanée ;
  - la **voix fluide** : la même voix, calculée sur l'appareil (≈ 45 Mo téléchargés à part), pour les phrases composées (calculs, nombres, astuces, explications) et le prénom de l'enfant ;
  - sinon la **voix du téléphone** (`speechSynthesis`) ; sans elle, les clips composés en dernier recours.
- **Voix d'enfant** (v2.2.2, décision du parent du 05/10/2026, après écoute : degré 4) : Siwis rajeunie d'un facteur 1,33 (+5 demi-tons ; hauteur et timbre montés, débit de Siwis à ≈ 5 % près : Piper arrondit ses durées, comme dans l'échantillon validé), pour les clips comme pour la voix fluide ; la voix du téléphone est réglée plus aiguë.

## 12. Sauvegardes & rapports

- **Export** : fichier `caramel-<prenom>-<AAAA-MM-JJ>.json` (un profil ou tous), via Blob + `a[download]`.
- **Import** : validation de schéma, puis choix « remplacer » ou « ajouter comme nouveau profil ».
- **Rapport** : page imprimable A4 (`@media print`) → « Enregistrer en PDF ». Contenu : radars officiel vs actuel, tableau par axe, courbe MCLM, temps passé, jeux joués, faits et mots maîtrisés, 3 conseils templatés bienveillants.
- **Carte PNG** (canvas) partageable via Web Share.
- **Bilan hebdo** : carte dans l'espace parents chaque lundi.
- **Tout effacer** (v2.3, préparation des stores) : espace parents › Profils › « Effacer toutes les données de cet appareil » : double confirmation (avec « Télécharger d'abord une sauvegarde »), jamais hors connexion ; efface, pour Caramel seulement, les clés `caramel-…`, les caches (caramel-*, vosk-*, piper-tts-*), la base IndexedDB « /vosk » et le service worker, puis l'appli repart à la création d'un enfant (`docs/ARCHITECTURE.md` §8.13).

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
- Garder l'exclusion de `/models/` (modèles Vosk et, v2.2.2, Piper : la page les range dans leur propre cache).
- Caches gardés à chaque mise à jour : `vosk-model-v1`, `vosk-lib-v1` et (v2.2.2) `caramel-voix-v1` (clips de la voix) ; `piper-tts-v1` (voix fluide) ne commence pas par « caramel- » : jamais purgé.

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
- **Perf** : précache des modules (v2.1 : ≈ 2,1 Mo non minifié, ≈ 0,75 Mo compressé, hors modèle ; alerte de `tools/precache.mjs` au-delà de 3 Mo depuis la 2.2.2), chargement paresseux par jeu. v2.2.2 : 118 fichiers, 2 560 Ko le 05/10/2026 (alerte relevée de 2,5 à 3 Mo) ; hors précache : les clips de la voix (≈ 1,8 Mo, budget de 1,9 Mo vérifié par `node tools/voix.mjs --check`, téléchargés à la première écoute ou en tâche de fond) et la voix fluide (≈ 45 Mo, téléchargée à part).
- **Dépendances externes** (jsDelivr, versions figées, jamais copiées dans le dépôt) : `vosk-browser` (reconnaissance) ; v2.2.2, pour la voix fluide seulement : `onnxruntime-web` 1.22.0 (repli 1.18.0 sans mémoire partagée) et `@diffusionstudio/piper-wasm` 1.0.0 (piper-phonemize et espeak-ng, sous GPL : seul son sous-ensemble français est gardé sur l'appareil). Licences de la voix : Piper (MIT), données SIWIS (CC BY 4.0 : crédit dans À propos et dans le README), poids du modèle convertis en float16 (`tools/piper-modele.py`, `models/piper/LISEZMOI.txt`).

## 15. Plan de livraison

| Version | Contenu | Acceptation |
|---|---|---|
| **2.0 — Socle + priorités CM2** ✅ livrée le 03/10/2026 (§18) | store v3, migration, multi-profils, onboarding (classe), référentiel + gabarits CM2, saisie guidée + import JSON, moteur adaptatif + balade du jour, vue radar, export/import de sauvegarde, `motion.js` ; jeux : Caramel (Zip adaptatif + 10 textes CM2), Chemin de la clôture, Galop des tables, Pommes express, Chef d'orchestre, Atelier des opérations | les profils s'importent ; une balade de 15 min ciblée fonctionne ; les données v11 sont intactes |
| **2.1 — Compagnon vivant, radar automatique, thèmes, En famille** ✅ livrée le 04/10/2026 (§18) (priorités du parent après l'essai de la 2.0) | refonte des 8 espèces (kawaii, rig commun, expressions, accessoires vectoriels, stades), moteur de vie (attente, regard, sommeil la nuit, réactions aux soins), diorama jour/nuit ; détection automatique du radar photographié (plan B : réglage manuel) ; 8 thèmes visuels au choix (présélection à la création du profil) ; En famille (Qui joue ?, classements, concours, défi) ; audit design et espace parents revu | chaque espèce reconnaissable en silhouette ; une photo de fiche se lit sans réglage dans la plupart des cas ; aucun thème illisible ; plusieurs enfants sur un appareil sans rien perdre |
| **2.2 — Simple, étape par étape** ✅ livrée le 04/10/2026 (§18), suivie de la 2.2.1 (retours du terrain, 04/10/2026), de la 2.2.2 (la voix du compagnon, 05/10/2026) de la 2.2.3 (micro fiable, mode diagnostic, préchargement, 07/10/2026) et de la 2.2.4 (modèle de reconnaissance libre, 07/10/2026) (consigne du parent, §1 principe 7 ; proposition validée par le parent le 04/10/2026 : jury de 3 pistes, synthèse « un seul gros bouton » + voix ; voix automatique en CP-CE1, liens LinkedIn dans l'espace parents, essayage avant achat pour tous les objets de la boutique) | accueil « un seul gros bouton » (compagnon en grand, soins en icônes-jauges, « Jouer ▶ » qui lance l'étape du jour), balade enchaînée depuis le bilan, en-tête de jeu sur une ligne, bilans et Mes progrès allégés ; lecture à voix haute en CP-CE1 (consignes, indices, bilans) ; balade jamais bloquée (sans micro : autre jeu) ; pavé en paysage ; constats d'audit restants (`docs/AUDIT-DESIGN.md`) | un CP sait quoi toucher sans lire ; l'accueil tient dans un écran de téléphone ; aucune fonctionnalité perdue |
| **2.3 — Avec un copain** (décision du parent du 07/10/2026, après la 2.2.3 et la 2.2.4) | « 👫 Avec un copain » (palier 1 : code à 4 chiffres, chacun son téléphone, sans réseau) ; « Effacer toutes les données de cet appareil » ; icônes maskable et monochrome ; préparation de Google Play (pages publiques, fiche, TWA, visuels : publiés quand les mentions légales et l'adresse définitive du site seront prêtes) ; appli Android sans secours Google | deux téléphones jouent le même défi avec un code ; effacement complet vérifié |
| 2.4 — Tout le cycle 3 | Détective, Radio Ferme, Lettres envolées, Jardin des mots, Marché aux mots, Train de la phrase, Caméléon, Boîte aux nombres, Formes du nombre, Missions du ranch ; Grand check-up ; rapports PDF/PNG ; bilan hebdo ; snapshots + morphing | 9 axes français + 7 axes maths du CM2 jouables, ≥ 200 items par axe |
| 2.5 — Cycle 2 | contenus CP→CE2 pour tous les jeux ; Syllabes qui dansent, Atelier des lettres ; Caramel CP (syllabes/mots) | un profil CP jouable de bout en bout |
| 2.6 — Polish | badges, carte des mondes, décor achetable du diorama, accessibilité (police aérée, contrastes), nettoyage des anciennes clés | — |

**La suite (05/10/2026)** : publier la 2.2.2 avec l'accord du parent ; l'essayer sur les téléphones des filles, une tablette et un iPhone (voix d'enfant, voix fluide — téléchargement réel, étalonnage, délai des questions —, invitation à installer : §18, Limites) ; trancher les choix ouverts de la 2.2.2 (§18) ; puis la 2.3, avec les constats restants de `docs/AUDIT-DESIGN.md`.

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
- Voix du compagnon (v2.2.2) : tout texte dit a son clip quand c'est possible. Un texte de l'inventaire (`js/content/voice-lines.js`) changé → régénérer les clips (`node tools/voix.mjs`, avec Piper et ffmpeg : variables `PIPER`, `PIPER_MODEL`, `FFMPEG`), puis `node tools/voix.mjs --check` (budget 1,9 Mo) ; un réglage de voix changé (dont la voix d'enfant `YOUTH`) refait tous les clips.
- espeak-ng, embarqué par piper-phonemize, est sous GPL : jamais dans le dépôt (téléchargé depuis jsDelivr par l'appareil, seul le sous-ensemble français est gardé). Modèle Piper (MIT) et données SIWIS (CC BY 4.0) : crédit obligatoire (À propos, README, `models/piper/LISEZMOI.txt`).
- Une synthèse de la voix fluide ne s'interrompt pas : ne préparer à l'avance que ce qui sera dit (question suivante, bilan, visite guidée), jamais ce qui retarderait la phrase suivante (astuces, explications). Le découpage des phrases longues aux virgules a été essayé puis écarté : il crée des sauts de hauteur, le défaut reproché aux clips assemblés.
- Tests de la voix en Chrome headless : le service worker sert l'ancien code tant que `sw.js` ne change pas (régénérer le précache ou partir d'un profil neuf), et un ancien serveur resté lancé sur le même port sert un autre code (l'arrêter avant de relancer) ; le ralentissement du processeur de DevTools ne s'applique pas aux workers (mesurer la voix fluide sur le fil principal : `?piper=main`) ; une page gelée par CDP (`Page.setWebLifecycleState frozen`) reste cachée après `active` (simuler le retour avec `Emulation.setFocusEmulationEnabled`) ; `pkill -f` tue aussi le shell qui le lance.

## 17. Checklist de démarrage (nouvelle session)

1. `git log` (attendu : un commit `v2.2.2 : …` en tête), lire ce CDC (§1 principe 7 et §18 surtout), `docs/ARCHITECTURE.md`, `docs/JEUX.md` et `docs/AUDIT-DESIGN.md`.
2. `node tools/check.mjs` doit être vert ; ouvrir `tests/harness/game.html` pour voir un jeu isolé.
3. Recueillir le retour du terrain (téléphones des filles), corriger si besoin (`v2.2.x`).
4. Essayer la 2.2.2 sur les téléphones des filles, une tablette et un iPhone (voix d'enfant ; voix fluide : téléchargement réel, étalonnage, délai des questions ; voix du téléphone ; micro des tables pendant que la voix parle ; invitation à installer ; retour Android avec une feuille ouverte ; zone du pouce ; « État de cet appareil » donne l'essentiel en une capture), puis avec des enfants (protocole : 4 enfants sur 5 lancent la balade seuls en 1 toucher, aucun achat par erreur) ; ensuite la 2.3 (§15) et les constats restants de `docs/AUDIT-DESIGN.md`.
5. Avant le push : précache, check, `node tools/voix.mjs --check`, version, mise à jour de ce CDC (§18).

## 18. Journal de livraison

### v2.6.2 (08/10/2026) — le décor aussi sur téléphone
**Retour du parent** : « sur le PC je vois le fond, mais pas sur mobile ». Choix du parent : un décor vertical par univers — sur téléphone et tablette debout, le décor de l'univers apparaît derrière l'accueil (ciel en haut, personnages dans les coins du bas), adouci.

### v2.6.1 (08/10/2026) — des illustrations
**Demande du parent** : une image d'accueil générée avec Gemini ; choix du parent : la verticale pour le premier écran, l'horizontale en décor de l'accueil sur grand écran, celle du pique-nique pour la fiche Google Play. Le premier écran montre le pré, le poney et ses amis au-dessus de « Bonjour ! Comment tu t'appelles ? » ; sur ordinateur, l'accueil n'a plus de grands côtés vides, avec un décor par univers (château de la licorne, vallée des dinosaures, planètes de l'espace, fond marin de l'océan…) pour que tout reste raccord avec le thème choisi par l'enfant (ARCHITECTURE §8.6 quater).

### v2.6 (07/10/2026) — la dictée de la semaine, mes poésies
**Demandes du parent** : un jeu autour de la dictée (« dicte à haute voix lentement ») ; « charger un texte libre pour renseigner leur poésie à apprendre ». Décisions : mots et poésies TAPÉS par l'adulte (pas d'OCR, souvent écrits à la main), dictée par la voix de Caramel, l'enfant compare et coche ; poésies dans la course, mode « par cœur » par paliers, sans Zip ni étoiles. Espace parents : rubrique « Devoirs de la semaine ». **Devoirs à part** (décision du 08/10/2026) : la dictée et les poésies ne comptent pas dans le temps de jeu du jour et restent possibles quand il est atteint (« 📝 Devoirs » sur l'accueil ; dans la course, les poésies seules).
**La dictée** :
- **§6, nouvelle ligne** (ou complément du jeu 6) : 6 bis, **La dictée de {N}** (v2.6), axe `fr.ortho` (sans mesure de θ).
  - La liste de la semaine est tapée par l'adulte dans l'espace parents : 1 à 20 mots, phrase facultative.
  - Dictée lente au rythme de la classe (« mot… phrase… mot »), voix fluide calculée d'avance.
  - L'enfant écrit sur papier puis compare avec le mot juste : « ✓ Juste » ou « ✗ À revoir » puis recopie.
  - Leitner ; les mots à revoir passent en tête la fois suivante. Dans la balade seulement si une liste existe.
  - Motion : oreille qui ondule, ✍️, tampon ✓.
  - Pas de photo ni de lecture de l'écriture (décisions du 07/10/2026).
- **Journal, v2.6.** « La dictée de la semaine », demandée par le parent. Décisions du 07/10/2026 :
  - mots tapés par l'adulte, sans OCR ;
  - voix de Caramel (voix fluide, repli voix du téléphone), lente, « mot… phrase… mot » ;
  - correction par l'enfant, mot par mot (✓ / à revoir puis recopie) ;
  - écrans d'une action.
  - La liste ne bouge pas θ de `fr.ortho` (déjà travaillée en classe, auto-correction).
  - 🍎 aussi pour la recopie : l'honnêteté n'est jamais punie.
  - Étude : rapport dictee-problemes §A.
**Les poésies** (§6, la course : … + **« Mes poésies »** (v2.6) : la poésie de l'école tapée par l'adulte, lue puis apprise par cœur en 5 étapes (texte qui
s'efface : mots, premières lettres, débuts de vers, rien), micro qui suit la récitation, sans Zip ni étoiles.) :
**Demande du parent** (07/10/2026) : « charger un texte libre pour renseigner leur poésie à apprendre ; on leur ferait lire et ça
les aide à l'apprendre ». **Livré** : dans l'espace parents, « 📜 Mes poésies » (par enfant, 12 au plus) : l'adulte tape ou colle
le texte en vers ; Caramel lui dit aussitôt quels mots le micro ne connaît pas (lexique lu dans le modèle déjà sur l'appareil) —
l'enfant peut les dire, ils sont acceptés comme un prénom. Dans la course, la poésie vient en tête : l'enfant la lit (le micro
suit, le compagnon avance), puis l'apprend par cœur en 5 étapes où le texte s'efface ; « Montre-moi » montre le vers oublié.
Ni Zip, ni chrono, ni étoiles : un entraînement ; 🍎 d'effort, minutes du compagnon, série. La grammaire du micro garde les
apostrophes et traits d'union (« l'herbe », « dit-elle ») : beaucoup moins de mots impossibles à entendre. La photo de la
poésie (OCR) est écartée.

### v2.5.2 (07/10/2026) — Caramel déménage
**Accord du parent** (« gère l'invitation à migrer sur l'ancienne URL ») : sur l'ancienne adresse, l'écran « Caramel déménage ! 🏡 » invite à partir sur **caramel.manica.fr** ; un toucher emporte les progrès (profils, compagnons, pommes, code parent), rien n'est effacé ; un nouveau visiteur sans progrès y part directement. Sur iPhone avec Caramel sur l'écran d'accueil : passer par une sauvegarde (espace parents).

### Domaine (07/10/2026) — caramel.manica.fr
Le dépôt est passé chez **ManicaLabs** (github.com/ManicaLabs/caramel) ; l'adresse de Caramel devient **https://caramel.manica.fr/** (fichier `CNAME`, DNS du parent). L'ancienne adresse (cdelalande38.github.io/caramel) reste en ligne grâce à un dépôt recréé à l'ancien nom : les progrès des enfants y vivent, et c'est là que s'allumera le déménagement (ARCHITECTURE §8.16) une fois le nouveau domaine vérifié en HTTPS.

### v2.5.1 (07/10/2026) — l'ours debout, « une pomme »
**Retours du parent** : « l'ours est à 4 pattes, il serait mieux debout sur ses deux pattes » ; « 1 pomme = une pomme et pas un pomme ; fais aussi attention aux liaisons ». **Corrigé** : l'ours se tient debout, façon ourson en peluche (bras qui balancent, dandinement, il grignote en ramenant sa patte, s'endort assis) ; avant la voix du téléphone et la voix fluide, « 1 » s'accorde avec le nom qui suit (« une pomme », « une heure », « quarante-et-une chèvres ») et fait sa liaison (« un‿œuf », « un‿euro »), « neuf ans » se dit « neuv‿ans » (`agree`, ARCHITECTURE §8.8) ; un test oblige à classer tout nouveau nom qui suit un nombre dans les exercices.

### v2.5 (07/10/2026) — seize compagnons
**Demande du parent** : « l'ours, le chien, un oiseau, la baleine et le koala, des animaux que les enfants aiment » ; pour l'oiseau : « fais les 4 ». **Livré** (§10.3, ARCHITECTURE §8.6) : l'ours, le koala, le chien, la baleine (elle nage dans le lac et souffle son jet d'eau), la chouette, le perroquet, le pingouin et le poussin rejoignent la boutique (de 70 à 140 🍎), dans le style des autres, avec leurs expressions, leurs stades, les accessoires, leurs trois aliments (miel de l'ours, os du chien, eucalyptus du koala, graines du perroquet…) et leurs petites actions ; brossage des oiseaux : « quelles belles plumes ! » ; course de lecture : « l'ours » élidé. 25 phrases enregistrées de plus.

### v2.4.1 (07/10/2026) — les milliers dits en entier
**Retour du parent** (tablette d'une de ses filles) : « Lorsqu'il y a 1 000, il dit 1 zéro zéro zéro au lieu de mille. » Les nombres s'écrivent avec une espace fine entre les tranches ; la voix du téléphone les coupait en deux (« un… zéro zéro zéro », « cinquante-quatre… zéro quatorze »). **Corrigé** : avant la voix du téléphone et la voix fluide, les tranches sont recollées et tout entier à partir de 1 000 est écrit en lettres (« mille quatre cent soixante-quatorze », « deux cent cinquante mille », « deux millions trois cent mille ») — `bigNumbers`, ARCHITECTURE §8.8 ; la voix enregistrée composait déjà « mille » et les centaines.

### v2.4 (07/10/2026) — un temps de jeu raisonnable, des soins qui ont du sens, au rythme de la classe
**Retours du parent et d'autres familles** (07/10/2026) : un enfant a joué 3 heures d'affilée ; on pouvait nourrir le compagnon à l'infini ; tous les animaux mangeaient la même chose ; en octobre, le programme de toute l'année tombait déjà ; pas de moyen rapide de couper le son ; sur un grand écran d'ordinateur, la scène et « Jouer » étaient décalés.
**Livré** :
- **temps de jeu du jour** (`docs/ARCHITECTURE.md` §5.7 bis) : 1 h par défaut, réglable par enfant (30 min à 2 h, ou sans limite) avec « Encore 15 minutes aujourd'hui » ; passé la limite, les jeux sont grisés, le gros bouton dit « À demain ! 💤 » et le compagnon fait la sieste (la nuit le soir) ; jamais punitif : une partie commencée se finit, les soins restent possibles ;
- **au fil de l'année** (ARCHITECTURE §5.7 ter) : Caramel ne propose une notion qu'environ deux semaines après le début de la période où elle est vue en classe (calendrier des programmes 2024-2025 : passé simple en novembre au CM2, table de 8 en mars au CE1…) ; la rentrée commence par deux semaines de révisions, rien de la classe suivante n'arrive pendant l'été. Le parent choisit, par enfant, « Au rythme de la classe » (défaut), « Un peu en avance » ou « Selon ses réussites » (comportement d'avant), et peut indiquer pour chaque notion de l'année « Déjà vu en classe » ou « Pas encore vu ». Après une première erreur, l'enfant (CE1 → CM2) peut dire « 🌱 Pas encore appris » : la notion revient le mois suivant — une fois par partie, trois notions en attente au plus, deux reports de suite au plus, jamais en défi ni avec un copain, sans effet sur ses progrès ; le parent voit ces reports et peut les remettre. Les plus à l'aise peuvent trouver les questions un peu plus faciles qu'avant : « Un peu en avance » ou « Selon ses réussites » rendent l'ancien comportement ;
- poids : précache ≈ 3,25 Mo non minifié (≈ 1,2 Mo compressé ; alerte relevée à 3,5 Mo) ; voix enregistrée 4,2 Mo, jamais téléchargée d'avance pour les nouvelles phrases (chacune la première fois qu'elle est dite) ;
- **déménagement préparé (éteint)** vers caramel.manica.fr (ARCHITECTURE §8.16) : sur l'ancienne adresse, « Caramel déménage ! 🏡 » et UN bouton qui emporte les progrès (dans l'adresse, jamais envoyés à un serveur ; rien n'est effacé) ; la nouvelle adresse les range. Allumé quand le domaine sera en place et vérifié ;
- **🔊 / 🔇 toujours à portée** (ARCHITECTURE §8.6 ter) : en haut de l'accueil et de chaque jeu, un toucher coupe ou remet le son (le réglage « Sons » de l'enfant) ; « Écouter encore » devient 🔁 et le joker 💡 un rond ; accueil réaligné sur les grands écrans d'ordinateur ;
- **soins** (§5.2 bis) : on ne nourrit plus un compagnon rassasié (ni avec un aliment beaucoup trop gros) ; brossage et promenade : le premier du jour gratuit, les suivants 5 et 10 🍎 ; trois aliments par espèce (le dragon mange du piment, du pop-corn et de la pizza, le chat des croquettes, du poisson et des sushis…).

### v2.3.1 (07/10/2026) — le micro dans tous les jeux
**Retour du parent** (07/10/2026, journal du mode diagnostic joint : 10 réponses sur 10 aux tables, moteur sans retard) : « le micro ça va mieux. Par contre il faudrait pouvoir utiliser le micro sur les autres jeux, pas seulement les tables ».
**Livré** : le 🎤 des tables, généralisé (`js/ui/voice-answer.js`, `docs/ARCHITECTURE.md` §8.15) et branché dans Pommes express, le Chemin de la clôture, le Chef d'orchestre, l'Atelier des opérations, le Défi en famille et Avec un copain ; la voix tape la réponse (mêmes retours qu'au doigt) ; le micro allumé reste allumé d'un jeu à l'autre pendant la séance ; une question qui ne se dit pas sans risque (homophones, mots inconnus du modèle, « placer » sur la clôture) se fait au doigt (« 👆 Ici, réponds avec le doigt »).
**Vérifié** : banc « enfant simulé » (voix Piper rajeunie dans un faux micro, vrai moteur Vosk) : Pommes 10/10 ; opérations 106 chiffres sur 108 sans faux injuste ; orchestre 39/44 (1 faux injuste) ; clôture décimaux 29/29, fractions 13/14 ; défi 38/44 ; mise en page identique micro allumé ou non (400 et 360 px).
**Limites** : voix d'enfant simulées seulement ; la musique du Chef d'orchestre dans le vrai micro (annulation d'écho) n'est vérifiable que sur un vrai téléphone ; liaisons (« vous avez‿un ») à surveiller.

### v2.3 (07/10/2026) — Avec un copain
**Décisions du parent** (07/10/2026, après les études « multijoueur » et « stores ») : faire le palier 1 du multijoueur ; préparer Google Play en parallèle (nom « Caramel : lire et compter », éditeur la société Manica Labs, contact hello@manica.fr, secours Google coupé dans l'appli Android, adresse définitive du site sur un domaine à lui AVANT Play).
**Livré** :
- **« 👫 Avec un copain »** (§10.4, `docs/ARCHITECTURE.md` §5.9 bis) : tuile au bas de la feuille « 🎲 Jeux » de l'accueil et bouton dans « En famille » ; « Je lance » (choix du défi, code à 4 chiffres en très grand, dit chiffre par chiffre) / « Je rejoins » (code tapé au pavé, faute de frappe refusée en douceur) ; partie au moteur du Défi en famille, à son niveau ; bilan à montrer (compagnon, points en très gros, jamais le prénom) ;
- **« Effacer toutes les données de cet appareil »** (§12) ;
- **icônes** maskable et monochrome séparées dans le manifeste (icône Android correcte) ;
- **appli Android** : `?app=android` → jamais de secours de reconnaissance Google, pas d'invitation à installer.
**Préparé, pas encore publié** : pages publiques (`pages/` : confidentialité, mentions légales, aide, licences), fiche Play, configuration Bubblewrap, visuels et captures (`store/`). Restent : mentions légales de Manica Labs (forme, SIREN, siège, directeur de la publication), adresse définitive du site (domaine) et transfert des progrès des familles, compte Play d'organisation (D-U-N-S).
**Vérifié** : 571 tests Node (code de partie : 800 codes, fautes de frappe et inversions ; règle ; comparaison ; effacement ; appli Android sans Google) ; deux Chrome jouant le même défi avec un code (CM1 et CE1 : même code, mêmes types de questions, bilans sans prénom, rechargement sans double gain) ; effacement de bout en bout.

### v2.2.4 (07/10/2026) — un modèle de reconnaissance libre, meilleur avec les voix d'enfant
**Décision du parent** (07/10/2026, après les mesures de la 2.2.3) : « basculer directement » sur `vosk-model-small-fr-0.22` (Alpha Cephei, **licence Apache 2.0**), à la place du modèle de la v11 `vosk-model-small-fr-pguyot-0.3` (CC BY-NC-SA 4.0 : usage commercial interdit, incompatible avec la publication sur les stores).
**Mesuré** (banc « enfant simulé », vrai moteur) : voix d'enfant simulée aux tables 13 réponses sur 14 (9 sur 14 avec l'ancien modèle) ; voix adulte 10 sur 10 ; 8 voix × 50 nombres : 320/400 (311) ; hésitations prises pour un nombre : 12/192 (27) ; course « La carotte du matin » 100 %, 3 ⭐ ; fil principal occupé à 90 % : 8 sur 8 (en 2,9 s : le modèle calcule 66 % plus longtemps). Lexique plus riche : tous les nombres, tous les mots d'appoint, et 7 mots des histoires de plus.
**Migration** : nouveau fichier `models/fr-small-0.22.tar.gz` (42 Mo) ; sur les appareils déjà équipés, le nouveau modèle se télécharge (préchargement de la 2.2.3), puis l'ancien quitte le cache et le stockage (≈ 92 Mo au total, mesuré). Tailles annoncées : moteur du micro ≈ 48 Mo, tout ≈ 93 Mo.
**Limite** : voix d'enfant SIMULÉES seulement (voix de synthèse rajeunies) : à confirmer sur de vraies voix, avec le mode diagnostic.

### v2.2.3 (07/10/2026) — un micro fiable, un mode diagnostic, tout prêt dès la première ouverture
**Retours du terrain** (parent et autres utilisateurs, 06/10/2026) : « Parfois il est affiché que le micro écoute, l'enfant parle et il se passe rien. Passé 3-4 étapes d'un exercice, il a beaucoup de mal » ; « pendant les exercices, la première fois, on est invité à cliquer pour charger les modèles de voix : il faudrait que tous les chargements se fassent à la première ouverture » ; « prévois un mode débug : si je l'active, ça enregistre ce qu'il se passe et je peux exporter des logs ».

**Causes trouvées** (banc « enfant simulé » : voix Piper jouée dans un faux micro, vrai jeu des tables, vrai moteur Vosk ; `docs/ARCHITECTURE.md` §8.1) :
- le modèle Vosk était **réextrait à chaque ouverture** dans le stockage du navigateur (≈ 54 Mo de plus à chaque fois, 3 ouvertures = 206 Mo mesurés), et **toutes** les copies étaient rechargées en mémoire au démarrage du micro : un téléphone beaucoup essayé finissait saturé ;
- le moteur traite chaque morceau de son dans l'ordre sans jamais en sauter : sur un appareil lent, son **retard** grandissait sans fin (processeur bridé : 28 s, **0 réponse comprise sur 10**), et chaque relance du micro (veille des tables, ou l'enfant qui touche 🎤 plusieurs fois) attendait derrière ;
- le son du micro passait par le fil principal de la page : quand le jeu l'occupe, le navigateur **perd des morceaux de son** (fil principal occupé à 90 % : 1 réponse sur 8 comprise, son haché) ;
- une réponse dite **sans pause** après la précédente était ignorée (oubli de toute la phrase en cours, 2.2.1) ;
- si le chargement du modèle échouait, « Préparation du micro… » restait affiché pour toujours.

**Corrigé** : modèle extrait une seule fois sous une adresse fixe (copies anciennes supprimées : 206 → 99 Mo ; démarrage du micro 2 s au lieu de 3,8 s) ; capture du micro sur le fil audio (AudioWorklet ; secours : la capture de la v11) ; quand le moteur prend du retard, les blancs ne lui sont plus envoyés, et au-delà de 4 s de retard les tables rattrapent (la course, elle, garde toujours la voix lue) ; micro muet → rouvert tout seul ; réponse enchaînée sans pause → entendue ; chargement borné dans le temps.

**Ajouté** :
- **🎤 barré** quand le micro n'entend plus rien ou que le téléphone est trop lent (tables et course), avec une phrase pour l'enfant ; toucher le 🎤 barré relance l'écoute (tables) ; l'oreille 👂 bat quand une voix arrive ;
- **mode diagnostic** (espace parents › À propos › État de cet appareil) : activer, refaire la partie qui pose problème, **exporter le journal** (fichier texte partagé ou téléchargé ; en tête, l'état de l'appareil ; aucun son, prénoms masqués), effacer, désactiver ; en partie, l'état du micro s'affiche en petit sous l'oreille ;
- **préchargement à la première ouverture** : le moteur du micro (≈ 52 Mo) puis la voix fluide (≈ 45 Mo) se téléchargent en arrière-plan dès la création du premier profil (et, sur les appareils déjà configurés, à l'ouverture suivante), sous **une** barre discrète (« Je prépare ma voix et mes oreilles… 42 % », puis « Voix et micro prêts ✓ ») ; rien ne l'attend ; en données mobiles, un seul bouton pour l'adulte (« Télécharger maintenant (≈ 97 Mo) ») ; les jeux n'invitent plus à télécharger.

**Vérifié** : 546 tests Node ; préchargement en Chrome (création du profil : barre de 0 à 98 % puis « prêts », étapes fluides ; profil existant ; tout déjà prêt : aucune barre ; données mobiles : bouton seul ; course lancée pendant le téléchargement) ; banc « enfant simulé » sur PC (12 réponses sur 12, 0,5 s après la fin de la phrase), fil principal occupé à 90 % (8 sur 8, contre 1 sur 8 avec la capture de la v11), modèle abîmé (réinstallé à l'ouverture suivante) ; non-régression de la course : « La carotte du matin » 38/38 mots, précision 100 %, 3 ⭐ ; tests Node du moteur (faux Vosk : oubli par mots, retard, micro muet, voix gardée pour la course), du journal, de l'état de l'appareil.

**Limites** :
- **voix d'enfant** : une voix de synthèse rajeunie (substitut imparfait d'un enfant) est moins bien reconnue par le modèle actuel (« treize » → 20, « seize » → 50 : 9 sur 14 justes, contre 14 sur 14 pour la voix adulte). Le modèle Vosk `small-fr-0.22` (Apache 2.0, aussi utile pour les stores) fait un peu mieux sur les voix d'enfant simulées (+7 %), mais calcule 66 % plus lentement : à essayer sur de vraies voix d'enfant avant de choisir ;
- le comportement exact des téléphones (fil audio, mise en veille, autre appli qui prend le micro) n'est vérifiable que sur de vrais appareils : c'est le rôle du mode diagnostic.

### v2.2.2 (05/10/2026) — la voix du compagnon
**Livré** (décisions du parent des 04 et 05/10/2026, après écoute) :
- **voix enregistrée** : ≈ 360 phrases et morceaux (consignes, encouragements, bilans, visite guidée, invitation à installer, nombres de 0 à 100, morceaux de calcul) enregistrés une fois pour toutes avec Piper « siwis medium », voix neuronale libre (`tools/voix.mjs`, `audio/voix/`, ≈ 1,8 Mo hors précache) ; jouée sans trou par Web Audio, phrases courantes préchargées ;
- **voix fluide** : la même voix calculée sur l'appareil (Piper dans un worker ; modèle de 32 Mo en float16 hébergé dans `models/piper/`) : calculs, astuces, explications et prénom de l'enfant dits d'un seul tenant (« 7 × 8 = ? » en 1,0 s sans pause, contre 1,7 s et 2 pauses en clips assemblés). ≈ 45 Mo téléchargés une fois : jamais au premier lancement ni pendant un jeu ; tout seuls après une séance en Wi-Fi (Android) ou sur un ordinateur ; sinon proposés aux parents (« Sur cet appareil › Voix fluide »). Étalonnage une fois par version (« trop lente » → voix du téléphone ; « Refaire l'essai de vitesse ») ; question suivante, bilan et visite guidée préparés à l'avance ; hors ligne une fois téléchargée ;
- **aiguillage entre trois voix** : un clip pour ce qu'un clip couvre, la voix fluide pour le reste quand elle est prête, sinon la voix du téléphone, sinon les clips composés ;
- **voix d'enfant** (degré 4) : Siwis rajeunie de 5 demi-tons (facteur 1,33 : hauteur et timbre montés, débit de Siwis à ≈ 5 % près), clips régénérés et voix fluide rééchantillonnée ; voix du téléphone plus aiguë ;
- **lecture à voix haute pour tous** : « Lire les consignes à voix haute » Oui (défaut) / Non ; l'ancien « Automatique » devient Oui ; 🔊 partout où un texte est dit, même sons coupés ; visite guidée des CM1-CM2 enregistrée ;
- **invitation à installer** (« 📲 Mets Caramel sur l'écran d'accueil ») : feuille à la fin de la création d'un enfant, bannière discrète de l'accueil, ligne de l'espace parents ; vrai bouton « Installer » sur Android et ordinateur, marche à suivre illustrée et dite sur iPhone et iPad ;
- **État de cet appareil** (espace parents › À propos) : ce que l'appareil sait faire (son, trois voix, micro, reconnaissance, stockage…), ✓ / ✗, « Copier le texte » ;
- crédits et licences : Piper (MIT), SIWIS (CC BY 4.0), onnxruntime-web et piper-phonemize (MIT), espeak-ng (GPL, téléchargé depuis jsDelivr, jamais hébergé).

**Vérifié** : ≈ 520 tests Node (voix enregistrée, voix fluide sur faux cache et faux moteur, installation, état de l'appareil) ; `node tools/voix.mjs --check` ; une vérification indépendante par chantier en Chrome headless : 21 constats (5 sur la voix enregistrée, 9 sur la lecture pour tous, l'installation et l'état de l'appareil, 7 sur la voix fluide), tous corrigés, preuves avant / après. Parcours simulés : CP sur Android (53 phrases sur 53 en clips, aucun chevauchement entre voix ni avec le micro), CM2 sur iPhone ; dictée des tables 8/8 et course 3 ⭐ au faux micro Piper. Voix fluide : la question part ≈ 0,3 s après la demande aux tables (≈ 50 ms avant la voix d'enfant), ≈ 0,45 s à Pommes express en CP (médianes sur PC) ; Wi-Fi, données mobiles, hors ligne, mise à jour depuis la 2.2.1, appareil lent (processeur ×4 et ×6 : « trop lente »), micro sur 4 Go, page gelée pendant l'étalonnage ; Vosk reconnaît les phrases calculées ; 0 erreur console.

**Écarts** : lecture à voix haute étendue à tous les enfants (2.2 : automatique en CP-CE1) ; voix neuronale enregistrée et calculée sur l'appareil au lieu de la seule synthèse du téléphone (§11) ; deux dépendances jsDelivr de plus, pour la voix fluide seulement (§14) ; précache à 2 560 Ko, alerte relevée de 2,5 à 3 Mo (§14) ; coupure MP3 des clips relevée de 7 à 9,3 kHz (7 kHz × 1,33 : les « s » montés de la voix d'enfant étaient rognés ; sur 123 nombres, Vosk en reconnaît 76 à 7 kHz et 115 à 9,3 kHz, voix ramenée à la hauteur de Siwis) et budget des clips porté de 1,7 à 1,9 Mo (≈ +12 %).

**À trancher par le parent** : une phrase à prénom qu'un clip couvre garde ce clip, sans le prénom, tant que la voix fluide n'est pas prête (sinon : la voix du téléphone, qui dit le prénom) ; après « Arrêter » par un parent, les règles ordinaires reprennent (en Wi-Fi sur Android, le téléchargement repart après une séance) ; sur un appareil de 4 Go ou moins, la voix fluide reste en pause après le micro jusqu'à la prochaine ouverture ; feuille d'installation avant la création du premier enfant sur iPhone et iPad (pas faite).

**Limites** (il faut un vrai téléphone) :
- vitesse de la voix fluide sur les téléphones des filles : l'émulation ×4 la juge « trop lente » ; iPhone 8 ou X et Android de milieu de gamme incertains (chauffe, petits cœurs) : l'étalonnage tranche sur l'appareil ;
- iPhone : mémoire partagée d'onnxruntime 1.22 (repli 1.18 vérifié seulement en simulant le refus dans Chrome), SIMD (iOS 16.4 et plus), workers modules, mémoire (+280 Mo) ; Safari efface le cache après 7 jours sans visite si Caramel n'est pas installé ; marche à suivre de l'installation ;
- `navigator.connection` réel (Android en Wi-Fi, ordinateur) ; téléchargement réel (≈ 44 Mo, ≈ 18 s à 20 Mbit/s ; un jeu qui l'interrompt fait repartir de zéro le fichier en cours) ;
- délai de la question préparée, à mesurer sur les téléphones des filles : sur PC, avec la voix d'enfant (34 % de calcul en plus), ≈ 0,3 s aux tables et ≈ 0,45 s à Pommes express en CP (médianes ; à Pommes, 0,3 à 1,2 s avant la voix d'enfant, tous niveaux) ; sur un téléphone deux fois plus lent, ≈ 1,1 s aux tables (estimation) ; batterie (un cœur occupé pendant chaque calcul) ; au-delà de 4 Go, Vosk et la voix fluide restent tous deux en mémoire ;
- voix d'enfant à écouter sur le haut-parleur d'un téléphone ; sans voix fluide prête, quelques phrases partent encore à la voix du téléphone (euros, nombres de 26 à 98 finissant par 6 ou 8 et suivis d'un nom, liaisons devant voyelle).

### v2.2.1 (04/10/2026) — retours du terrain (voix et dictée)
**Corrigé** (essais du parent sur deux téléphones Android) : la **dictée des réponses** des tables se déréglait après la 1re réponse (la grammaire ne connaissait que des nombres : « euh » → 16, « je sais pas » → 7, comptés faux ; phrase coupée entre deux calculs ; micro rendu sourd par Android) ; le **🔊** restait muet (aucune phrase à relire hors tables et clôture, ou téléphone sans voix française — cas d'une ROM chinoise sans services Google) ; l'appareil photo de l'import ne s'ouvrait pas sans le dire (autorisation Android de Chrome) : message et contournement par « Choisir une image ».
**Ajouté** : **visite guidée parlée** de l'accueil au premier passage (une fois par enfant, profils existants compris) ; présentation de chaque jeu en une phrase à la 1re partie ; « ▶ Tester la voix » et « Revoir la visite guidée » dans l'espace parents.
**Vérifié** : dictée de 8 à 10 calculs d'affilée avec hésitations, en CP et en CM2, avec le vrai moteur Vosk et une voix Piper en faux micro (0 faux essai, micro jamais relancé ; Android simulé : AudioContext suspendu, piste coupée) ; non-régression de la course (38/38 mots, 6/6 pauses, 3 ⭐) ; ≈ 480 tests.
**Limites** : la voix de synthèse du téléphone reste plate (phrases enregistrées avec une voix neuronale libre — Siwis, choisie par le parent — en 2.2.2) ; « bah » dit seul est encore entendu « vingt » ; le comportement exact d'Android (focus audio) n'est vérifiable que sur un vrai téléphone.

### v2.2 (04/10/2026) — simple, étape par étape
**Livré** :
- **accueil « un seul gros bouton »** (proposition arbitrée par un jury de 3 pistes — un seul bouton, le compagnon guide, une zone = une chose — et validée par le parent) : il tient sur un écran (58 → 6 mots pour un CP, 1 700 → 844 px), un seul bouton principal par écran enfant ;
- **balade enchaînée** depuis le bilan (« Étape suivante ▶ ») et **jamais bloquée** : sans micro, « Changer de jeu ➜ » ; en CP, la mission n'est plus une lecture de 44 mots ;
- **voix des petits lecteurs** (automatique en CP-CE1, réglable par les parents) : question, consigne au premier calcul, mot doux et astuce, explication, bilan ; elle se tait quand le micro écoute ou quand le son est coupé ; 🔊 pour réécouter ;
- **en-tête de jeu sur une ligne**, mot doux (« Presque ! ») puis l'astuce seule, bilans à un seul nombre, Mes progrès un radar à la fois ;
- **compagnon** : soins en icônes-jauges, bulle 🍎 quand il a faim, cabine d'essayage dans la boutique ;
- **audit design traité** : pavé de réponse atteignable en paysage et avec une grande police, retour Android qui ferme les feuilles (et confirme avant de quitter une partie), contrastes et focus (anneau Caramel #78350f, interrupteurs, champs, choix « coché »), thèmes qui ne détournent plus l'orange de l'erreur, bulles en Andika, annonces aux lecteurs d'écran sans doublon, titres d'onglet et focus à chaque écran, textes (« Une question pour tes parents » à l'arrivée, vocabulaire), jetons du design system (tailles, espacements, rayons, couleurs du pré).
**Vérifié** : ≈ 460 tests Node ; 3 correcteurs par fichiers puis 2 vérificateurs indépendants (parcours de bout en bout dont la balade sans micro, le paysage, la mise à jour v2.1 → v2.2 ; 8 thèmes × écrans, contrastes mesurés, mouvement réduit, clavier) : 13 problèmes trouvés et corrigés, revérifiés.
**Écarts** : orientation de l'appli non forcée en portrait (les tablettes en paysage restent possibles : le pavé défile si l'écran est court) ; « Mes progrès » apparaît sur l'accueil après la première partie d'un nouvel enfant.
**Limites connues** : pas encore d'essai sur un vrai téléphone ni avec des enfants ; écran de résultats de la course encore chargé (fidèle à la v11, à alléger avec le parent) ; quelques emojis récents des histoires peuvent manquer sur de vieux Android ; à 1280 px, la colonne de droite de l'accueil est vide quand un panneau du compagnon est ouvert ; restes du design system (composants communs) dans `docs/AUDIT-DESIGN.md`.

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
