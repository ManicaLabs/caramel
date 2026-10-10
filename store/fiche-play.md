# Fiche Google Play de Caramel — textes et réponses aux questionnaires

> Préparé le 7 octobre 2026 (Caramel 2.2.4, application Android en TWA). Rien n'est publié.
> Source des règles : étude des stores du 6 octobre 2026 (§2 et §6) ; chiffres à revérifier dans la Play Console
> au moment de remplir. Les passages **[DÉCISION : …]** et **[À COMPLÉTER : …]** attendent le parent.

## 1. Nom de l'application (30 caractères au plus)

« Caramel » seul existe déjà plusieurs fois sur les stores (Play accepte les doublons, l'App Store non) et un outil
pour enseignants s'appelle aussi « Caramel » (activités H5P) : un nom plus précis évite la confusion.

| Proposition | Caractères | Commentaire |
|---|---|---|
| **Caramel : lire et compter** | 25 | Recommandé : dit ce que fait l'appli ; même nom que le manifeste (« Caramel — lire et compter »). |
| Caramel – du CP au CM2 | 22 | Dit le public ; sur l'App Store, la catégorie Enfants l'autorise. |
| Caramel, lecture et maths | 25 | Plus neutre. |

**Décidé (07/10/2026) : « Caramel : lire et compter ».** Avant de payer quoi que ce soit, chercher « Caramel » sur data.inpi.fr et TMview
(classes 9 et 41). Ne jamais mettre « Repères » dans le titre ni dans la description courte.

Nom sous l'icône (launcherName) : « Caramel ».

## 2. Description courte (80 caractères au plus)

Proposée (72 caractères) :

> Lire à voix haute et compter, du CP au CM2, avec un compagnon à soigner.

Variante (79) : « Lecture, tables, calcul : 10 minutes par jour avec son compagnon, du CP au CM2. »
Interdits dans le titre, l'icône et le nom du développeur : « gratuit », « sans pub », « n° 1 », « meilleur ».

## 3. Description longue (4 000 caractères au plus ; ≈ 2 400 ici)

```
Caramel accompagne votre enfant en lecture et en maths, du CP au CM2 (6-11 ans). Chaque jour, une courte « balade » de 10 à 20 minutes enchaîne des petits jeux qui s'adaptent en douceur à ses forces et à ses besoins : pas de note, pas de niveau affiché, un indice puis une nouvelle chance à chaque erreur.

🐴 UN COMPAGNON À SOIGNER
Poney, licorne, dragon… L'enfant nourrit, brosse et promène son compagnon, qui grandit avec le temps d'apprentissage. Le compagnon lit les consignes à voix haute : les plus jeunes lecteurs avancent seuls, une étape à la fois.

📖 LIRE À VOIX HAUTE
Dans la course de lecture, l'enfant lit une histoire à voix haute. Caramel suit sa lecture mot à mot et le fait courir contre Zip le papillon, puis pose une question de compréhension. La voix est reconnue sur l'appareil, sans rien enregistrer.

🔢 COMPTER ET CALCULER
• Le Galop des tables : les tables et les faits numériques, au doigt ou à la voix
• Pommes express : le calcul rapide
• Le Chemin de la clôture : placer les nombres sur une ligne graduée
• L'Atelier des opérations : les opérations posées, étape par étape
• Le Chef d'orchestre : la conjugaison et l'accord du verbe

👪 POUR LES PARENTS
L'espace parents, protégé par une porte (un calcul d'adulte ou votre code), montre en 30 secondes où en est votre enfant : ce qui progresse, ce qui est à revoir, sa vitesse de lecture, des radars de compétences. Vous pouvez y saisir sa fiche d'évaluation de rentrée (photo lue sur l'appareil, ou saisie à la main) pour adapter son parcours. Plusieurs enfants peuvent jouer sur le même appareil, chacun à son niveau, et se lancer des défis en famille.

🔒 VIE PRIVÉE
• Pas de compte, pas de publicité, pas d'achat, aucun pisteur.
• Les progrès restent sur l'appareil ; vous pouvez en télécharger une sauvegarde.
• Le micro et l'appareil photo sont facultatifs et analysés sur l'appareil : aucun son ni aucune photo n'est enregistré ni envoyé.
• Tout s'efface en un geste depuis l'espace parents.

📶 HORS CONNEXION
À la première ouverture, Caramel télécharge sa voix et son moteur de reconnaissance vocale (environ 93 Mo, une seule fois ; en données mobiles, il vous demande avant). Ensuite, tout fonctionne sans Internet.

Les contenus suivent les programmes de l'école (cycles 2 et 3) et s'inspirent des formats des évaluations nationales de début d'année. Caramel n'est pas affilié au ministère de l'Éducation nationale.
```

**Décidé (07/10/2026) : secours Google coupé dans l'appli Android** (v2.3 : `?app=android` → js/core/speech.js n'appelle jamais Web Speech). La phrase « aucun son … n'est envoyé » n'est vraie que parce que la version Android
**n'utilise pas** le secours de reconnaissance de Google (Web Speech) quand Vosk ne démarre pas (recommandation de
l'étude, §2.3 et §5.1). Si le secours reste actif, remplacer la puce par : « Le micro et l'appareil photo sont
facultatifs. La voix est reconnue sur l'appareil ; si ce n'est pas possible, Chrome peut utiliser la reconnaissance
vocale de Google (voir la politique de confidentialité). » — et répondre autrement à la Sécurité des données (§6).

Notes de version (1re publication) : « Première version de Caramel sur Google Play. »

## 4. Catégorie, coordonnées, liens

| Champ | Réponse |
|---|---|
| Type | Application (pas « Jeu ») |
| Catégorie | **Éducation** |
| Tags | Éducation, Apprentissage, Lecture, Mathématiques (choisir dans la liste proposée) |
| Adresse e-mail (publique) | **hello@manica.fr** (Manica Labs) |
| Site web | https://caramel.manica.fr/ |
| Téléphone | facultatif (laisser vide) |
| Politique de confidentialité | https://caramel.manica.fr/pages/confidentialite.html |
| Assistance (dans la description ou le site) | https://caramel.manica.fr/pages/aide.html |
| Pays | **[DÉCISION]** proposé : France, Belgique, Suisse, Luxembourg, Monaco (+ Canada si souhaité). Se limiter aux pays francophones évite des obligations propres aux États-Unis. |
| Prix | Gratuit (définitif sur Play : une appli gratuite ne peut plus devenir payante) |

## 5. Éléments graphiques (dossier store/)

| Élément | Fichier | Exigence |
|---|---|---|
| Icône | `store/visuels/icone-play-512.png` | 512 × 512, PNG 32 bits, carré plein (Google arrondit) |
| Image de présentation | `store/visuels/presentation-play-1024x500.png` | 1024 × 500, PNG 24 bits sans transparence |
| Captures téléphone | `store/captures/telephone-1 … 7-*.png` | 1080 × 1920 (9:16), 2 à 8 ; ≥ 4 de ≥ 1080 px pour la mise en avant |
| Captures tablette 7" | `store/captures/tablette-7-1 … 7-*.png` | 1224 × 2176 (9:16) |
| Captures tablette 10" | `store/captures/tablette-10-1 … 7-*.png` | 2560 × 1440 (16:9) |
| Vidéo | — | facultative (YouTube non répertoriée) |

Ordre conseillé : accueil, course de lecture, tables, opérations, balade, mes progrès, espace parents. Profil fictif
« Léa » ; régénérer avec `node store/outils/captures.mjs` après un changement visible (mode d'emploi en tête du script).

## 6. Sécurité des données (Data safety)

Obligatoire même sans collecte. « Collecter » = transmettre hors de l'appareil ; ce qui est traité seulement sur
l'appareil (micro, photo, progrès) n'est pas une collecte.

| Question | Réponse proposée |
|---|---|
| Votre appli collecte-t-elle ou partage-t-elle des types de données requis ? | **Non** |
| Toutes les données collectées sont-elles chiffrées en transit ? | (sans objet ; si demandé : Oui, HTTPS) |
| Les utilisateurs peuvent-ils demander la suppression ? | (sans objet : rien sur un serveur) ; la politique explique « Effacer toutes les données de cet appareil » |
| Lien de politique de confidentialité | https://caramel.manica.fr/pages/confidentialite.html |
| Création de compte | Aucune |

Zones grises assumées par écrit dans la politique : GitHub Pages et jsDelivr voient l'adresse IP, comme pour tout site
(hébergement, pas collecte par Caramel). Secours Google coupé dans l'appli (décidé le 07/10/2026) ; s'il était un jour réactivé dans la
version Android, l'audio de l'enfant peut partir chez Google : il faudrait alors déclarer « Audio › Enregistrements
vocaux ou sonores » (collecté, traitement éphémère, non conservé par le développeur), ce qui pèse lourd pour une appli
d'enfants. Recommandation : couper ce secours quand Caramel tourne dans l'application (adresse de démarrage
`/caramel/?app=android`, prévue dans `store/twa/twa-manifest.json`).

## 7. Classification du contenu (questionnaire IARC)

| Rubrique | Réponse proposée |
|---|---|
| Adresse e-mail pour l'IARC | hello@manica.fr |
| Catégorie | « Toutes les autres applications » (référence, éducation…) — pas « Jeu » : l'appli est classée en Éducation |
| Violence, peur, sexualité, langage grossier, substances, jeux d'argent | Non à tout |
| Interaction entre utilisateurs, partage de contenus | Non |
| Partage de la position | Non |
| Achats numériques | Non |
| Navigation libre sur Internet | Non (seuls quelques liens, derrière la porte parentale, ouvrent le navigateur) |
| Résultat attendu | PEGI 3 / « Tous publics » |

## 8. Public cible et contenu, règlement « Familles »

| Question | Réponse proposée |
|---|---|
| Tranches d'âge | **6-8 ans** et **9-12 ans** seulement (ne PAS cocher 18 ans et plus : on passerait en « public mixte ») |
| L'appli attire-t-elle les enfants ? | Oui (destinée aux enfants) → tout le règlement Familles s'applique |
| Publicités | Non, aucune |
| SDK publicitaires ou d'analyse | Aucun |
| Identifiants (AAID, IMEI, numéro de série…) | Aucun ; vérifier après la compilation qu'aucune permission `AD_ID` n'est déclarée (store/README.md, étape 6) |
| Localisation | Non |
| Données sensibles (micro, caméra) | Traitées sur l'appareil, jamais transmises : écrit dans la politique (§ 4 à 6) |
| Programme « Approuvé par les enseignants » | Automatique pour les applis conformes au règlement Familles ; Caramel se joue seul : éligible |

## 9. Autres déclarations de la Play Console

| Rubrique | Réponse proposée |
|---|---|
| Accès à l'appli | « Toutes les fonctions sont accessibles sans compte. L'espace parents est protégé : touchez 🔒 en haut de l'accueil ; la porte affiche « √ N = ? » : saisissez la racine carrée de N (calculatrice). Aucun identifiant n'est nécessaire. » |
| Publicités | Non |
| Appli gouvernementale, fonctions financières, santé, actualités | Non |
| Permissions de l'APK | `POST_NOTIFICATIONS` seulement (rappels quotidiens, demandés par le parent). Micro et caméra : tenus par Chrome, pas par l'appli ; aucune permission « sensible » à déclarer. |
| Statut DSA (professionnel) | **Éditeur : la société Manica Labs** (décidé le 07/10/2026) : statut de **professionnel** probable, même pour une appli gratuite → adresse et téléphone de la société affichés par Google. À confirmer à l'inscription. |
| Type de compte | **Organisation : Manica Labs** (décidé le 07/10/2026) : numéro D-U-N-S de la société exigé (gratuit, quelques jours à obtenir) ; pas de test fermé obligatoire pour une organisation (à vérifier à l'inscription). |
| Nom public du développeur | **Manica Labs** |

## 10. Test fermé (comptes personnels créés après novembre 2023)

- Piste « Test fermé », liste de 12 adresses Gmail au moins (familles, collègues, enseignants) sur Android, qui
  acceptent l'invitation et **restent inscrites 14 jours d'affilée** (une désinscription relance le décompte).
- Canal de retours : hello@manica.fr.
- Après 14 jours : « Demander l'accès à la production » (questionnaire : déroulement du test, appli, préparation),
  réponse en 7 jours environ.
