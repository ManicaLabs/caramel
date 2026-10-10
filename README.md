# Caramel

**Le compagnon qui fait progresser en lecture et en maths, du CP au CM2.**
Application web gratuite (PWA) : https://caramel.manica.fr/ (éditeur : Manica Labs ; dépôt : github.com/ManicaLabs/caramel).
Ancienne adresse, gardée le temps du déménagement des progrès : https://cdelalande38.github.io/caramel/

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
- **Simple, une étape à la fois** : l'accueil tient sur un écran avec un seul gros bouton « Jouer ▶ » ; le compagnon
  lit à voix haute les questions, les indices et les bilans (réglable par les parents).
- **Une voix d'enfant** : les phrases du compagnon sont enregistrées ; les calculs et le prénom de l'enfant sont dits
  d'un seul tenant par la même voix, calculée sur l'appareil (« voix fluide », téléchargée une fois : ≈ 45 Mo).
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
(moteur Vosk embarqué) ; la voix du compagnon est jouée ou calculée sur l'appareil ; la photo d'une fiche
d'évaluation n'est jamais conservée. Les échanges se font
uniquement par export et import de fichiers.

## Technique

Site statique (GitHub Pages), modules ES natifs sans étape de build, hors ligne après la première visite,
installable sur l'écran d'accueil (Caramel le propose, avec la marche à suivre sur iPhone et iPad).
Spécifications : [docs/CDC-v2.md](docs/CDC-v2.md) · architecture : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
conception des jeux : [docs/JEUX.md](docs/JEUX.md).

```bash
node tests/run.mjs        # tests (Node 20)
node tools/check.mjs      # syntaxe de tous les modules + tests
node tools/precache.mjs   # liste des fichiers mis en cache par le service worker (avant chaque déploiement)
node tools/voix.mjs --check   # voix enregistrée : chaque phrase de l'inventaire a son clip à jour
PIPER=…/piper PIPER_MODEL=…/fr_FR-siwis-medium.onnx node tools/voix.mjs   # (re)génère les clips changés
python3 tools/piper-modele.py …/fr_FR-siwis-medium.onnx   # voix fluide : modèle en poids float16 → models/piper/
```

Banc d'essai de la voix fluide (même moteur que l'appli, `js/core/piper-tts.js`) : `tests/harness/piper.html`.

Créé par [Cédric Delalande](https://www.linkedin.com/in/cedric-delalande-57bb7860/).
Polices Fredoka et Andika sous licence SIL OFL ([fonts/OFL.txt](fonts/OFL.txt)) ;
modèle de reconnaissance vocale `vosk-model-small-fr-0.22` (Alpha Cephei, licence Apache 2.0 ; depuis la 2.2.4, à la place de `vosk-model-small-fr-pguyot-0.3`, CC BY-NC-SA 4.0).
Voix du compagnon : Piper (Rhasspy, licence MIT), voix siwis — SIWIS French Speech Synthesis Database, CC BY 4.0
([datashare.is.ed.ac.uk/handle/10283/2353](https://datashare.is.ed.ac.uk/handle/10283/2353)) : phrases enregistrées
une fois pour toutes (modèle `fr_FR-siwis-medium`, voix rajeunie : hauteur et timbre relevés de 5 demi-tons ;
découpées et encodées en MP3 par `tools/voix.mjs` : mono 22,05 kHz, passe-bas 9,3 kHz, ≈ 1,8 Mo en tout).
Voix fluide (la même voix, calculée sur l'appareil, téléchargée à part : ≈ 45 Mo) : modèle `fr_FR-siwis-medium`
(Piper, MIT ; SIWIS, CC BY 4.0), poids convertis en float16 par `tools/piper-modele.py` (`models/piper/`), voix rajeunie
de même ;
onnxruntime-web 1.22.0 (Microsoft, licence MIT) et piper-phonemize (paquet `@diffusionstudio/piper-wasm` 1.0.0, licence
MIT), qui embarque espeak-ng (licence GPL-3.0 ou ultérieure, code source :
[github.com/rhasspy/espeak-ng](https://github.com/rhasspy/espeak-ng)) — téléchargés depuis jsDelivr, aucun fichier
d'espeak-ng n'est hébergé dans ce dépôt ; seule sa partie française est gardée sur l'appareil.
Modèle de reconnaissance vocale et vosk-browser 0.0.8 (Ciaran O'Reilly ; Vosk et Kaldi embarqués) : licence Apache 2.0.
Application Android : coquille Trusted Web Activity générée par Bubblewrap (Google, Apache 2.0). Crédits complets,
licences et liens : [pages/licences.html](pages/licences.html).

## Pages publiques et stores

- `pages/` : politique de confidentialité, mentions légales, aide, licences et crédits (adresses données aux stores,
  ouvertes depuis l'espace parents › À propos, lisibles hors ligne).
- `store/` : publication sur Google Play (application Android en TWA) — mode d'emploi pas à pas
  ([store/README.md](store/README.md)), textes de la fiche ([store/fiche-play.md](store/fiche-play.md)), icônes,
  captures, configuration Bubblewrap. Jamais précaché.
