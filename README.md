# Caramel

**Le compagnon qui fait progresser en lecture et en maths, du CP au CM2.**
Application web gratuite (PWA) : https://cdelalande38.github.io/caramel/

L'enfant choisit sa classe, s'occupe de son compagnon (poney, licorne, dragon…) et fait chaque jour une courte
« balade » de 10 à 20 minutes. Les mini-jeux s'adaptent en douceur à ses forces et à ses besoins, sans note
ni niveau affiché, avec indice puis nouvelle chance à chaque erreur.

- **La course de Caramel** : lecture à voix haute avec reconnaissance vocale mot à mot, contre Zip le papillon
  (fluence), puis une question de compréhension.
- **Le Chemin de la clôture** (ligne graduée), **Le Galop des tables** (faits numériques, réponse au clavier ou à la voix),
  **Pommes express** (calcul rapide), **Le Chef d'orchestre** (conjugaison et accord du verbe),
  **L'Atelier des opérations** (opérations posées guidées, soustraction par compensation ou par cassage).
- **Mes progrès** : radars calqués sur les fiches des évaluations nationales Repères ; un adulte peut saisir la fiche
  de l'enfant (photo lue automatiquement, saisie ou fichier) pour adapter le parcours.
- **Espace parents** : détail par compétence, courbe de lecture, réglages, sauvegardes à télécharger.
- **Simple, une étape à la fois** : l'accueil tient sur un écran avec un seul gros bouton « Jouer ▶ » ; pour les
  petits lecteurs (CP-CE1), le compagnon lit à voix haute les questions, les indices et les bilans.
- **Un compagnon vivant** : huit animaux qui respirent, regardent l'enfant, jouent tout seuls, dorment la nuit,
  réagissent quand on les nourrit, les brosse ou les promène, et grandissent avec le temps d'apprentissage.
- **En famille** : plusieurs enfants sur le même téléphone, chacun sa progression ; classements de la semaine
  (effort et régularité, jamais le niveau), concours de compagnons et défi à tour de rôle où chacun répond
  à des questions de son niveau.
- **Huit thèmes visuels** au choix (Caramel, Licorne, Princesse, Super-héros, Dinosaures, Bolides, Espace, Océan).

Les contenus suivent les programmes en vigueur (cycle 2 : BO n°41 du 31/10/2024 ; cycle 3 : BO n°16 du 17/04/2025)
et les formats des évaluations Repères. Tous les textes sont originaux.

## Vie privée

Tout reste sur l'appareil : pas de compte, pas de serveur, pas de suivi. La voix est analysée localement
(moteur Vosk embarqué) ; la photo d'une fiche d'évaluation n'est jamais conservée. Les échanges se font
uniquement par export et import de fichiers.

## Technique

Site statique (GitHub Pages), modules ES natifs sans étape de build, hors ligne après la première visite.
Spécifications : [docs/CDC-v2.md](docs/CDC-v2.md) · architecture : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
conception des jeux : [docs/JEUX.md](docs/JEUX.md).

```bash
node tests/run.mjs        # tests (Node 20)
node tools/check.mjs      # syntaxe de tous les modules + tests
node tools/precache.mjs   # liste des fichiers mis en cache par le service worker (avant chaque déploiement)
```

Créé par [Cédric Delalande](https://www.linkedin.com/in/cedric-delalande-57bb7860/).
Polices Fredoka et Andika sous licence SIL OFL ([fonts/OFL.txt](fonts/OFL.txt)) ;
modèle de reconnaissance vocale `vosk-model-small-fr-pguyot-0.3`.
