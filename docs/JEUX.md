# Caramel 2 — Conception des jeux et des écrans (v2.1)

> Complète le CDC v2 (§6 catalogue, §9 radar, §10 compagnon, §11 motion) et `docs/ARCHITECTURE.md` (API).
> Public : enfants de 6 à 11 ans, sur téléphone Android (Chrome), parfois tablette ou PC.

## 0. Direction artistique commune

- **Univers** : le ranch de Caramel — prés, clôtures, pommiers, grange, ciel changeant. Illustrations **SVG inline en aplats** (formes rondes, contour brun chaud `#4a2c1a` de 2-3 px quand utile, une ombre douce, un reflet), cohérentes avec la palette de `css/base.css`. Emoji acceptés en décor ou en icône, jamais comme seule illustration d'un jeu.
- **Typo** : Fredoka (interface, chiffres), Andika (tout texte à lire : histoires, phrases, consignes longues). Grands corps : énoncés ≥ 1,6 rem, chiffres de calcul ≥ 2 rem.
- **Mise en page mobile** (390 × 844 de référence) : un jeu tient **sans défilement de page** (`.screen.is-full`) ; zone de jeu en haut, zone de réponse (pavé, QCM) en bas à portée de pouce ; rien sous 48 px de hauteur tactile.
- **Retour « juicy » et doux** : bonne réponse = pop + paillettes + note pentatonique qui monte avec la série + 🍎 qui vole vers le compteur ; erreur = petite secousse (6 px) + son de bois doux + indice en bulle (couleur orange douce, jamais rouge) ; jamais de son ou de mot négatif. `kit.cheer()` fournit les phrases.
- **Mouvement** : courbes `--ease-out` (entrées) et `--ease-pop` (rebonds), durées 150/300/600 ms ; `motion.reduced()` → fondus seulement. Aucune animation ne bloque une saisie plus de 400 ms.
- **Compagnon dans les jeux (v2.1)** : toujours `ctx.petSVG(size, mood, opts)` (jamais `mountSVG` en direct) — même espèce, mêmes accessoires portés et même stade (petit / junior / champion) qu'à l'accueil ; **une seule ombre au sol**, celle du rig (`{ shadow: false }` si le jeu pose la sienne) ; viser la bouche ou poser un objet sur lui avec `ctx.petAnchors()` ; quand il se déplace, il marche (classe `walk` du rig), classe retirée à l'arrêt ; quand il saute, bondit ou trébuche, c'est **son corps** qui bouge (groupe `.c-all` du rig, en composition « add ») : l'ombre reste au sol et rétrécit pendant qu'il est en l'air, la vague du dauphin reste dans l'eau, un objet tenu (la carotte de la clôture) suit sa bouche.
- **Son** : WebAudio synthétisé (`audio.js`) ; muet respecté partout.
- **Accessibilité** : contrastes AA sur le texte, `aria-label` sur les boutons-icônes, focus visible, `aria-live="polite"` pour les retours (« Bravo ! », indice).

## 1. Coquille de jeu (`js/ui/game-shell.js`, route `#/play/<id>?mode=balade&block=<i>`)

- Charge : générateur(s) de l'axe (`loadGenerator`), module du jeu (`loadGame`), CSS du jeu (`loadCSS(game.css)`), puis crée la manche (`createManche`, `count` = bloc de balade ou `mancheSize(id, settings.sessionMin)`, `offset` du bloc).
- En-tête (56 px) : ← retour (quitter = `manche.abort()`, aucun reproche) · icône + titre (templaté) · bouton joker 💡 avec compteur (2) · compteur 🍎 de la manche. Sous l'en-tête : pastilles de progression (`ctx.progress`).
- Corps : `root` passé à `game.mount(root, ctx)`.
- Fin (`ctx.end()`) : `manche.finish()` puis **bilan** en feuille centrale : compagnon (SVG 120 px, classe `joy`), titre de `cheer('end')`, « 🍎 +N » (compte animé + pommes qui volent), phrase positive (« Tu as trouvé 7 réponses du premier coup ! » — on ne montre **jamais** le nombre d'erreurs ni un « 7/10 »), bonus de série éventuel (« 🔥 3 jours de suite : +10 🍎 »). Boutons : balade → « Continuer la balade ➜ » (`#/balade`) ; libre → « Rejouer 🔄 » et « Accueil 🏠 ». `extra.skipSummary` (course) : pas de bilan, retour direct.
- `unmount` du jeu toujours appelé (navigation, retour Android).

## 2. La course de {N} (`course`) — fr.fluence (+ fr.comp_ecrit)

**Port fidèle de la v11** (écran de lecture, piste, karaoké, résultats) avec les ajouts suivants.
- **Mode libre** : liste des **mondes** (`WORLDS`, jamais de nom de classe) et des histoires (cartes v11 : emoji, titre templaté, étoiles ou cadenas « Encore X ⭐ pour débloquer », allure de Zip). Déblocage : `isUnlocked(story, profile)`.
- **Mode balade** : histoires choisies par `ctx.nextItem('fr.fluence', { profile })` (débloquées, pas lues juste avant) → directement l'écran de lecture ; un bloc prioritaire en enchaîne 2 ou 3 (« Histoire suivante ➜ »).
- **Zip adaptatif** : `zip = profile.mclm.length ? clamp(médiane(5 derniers MCLM) × 1,05, 20, mclmTarget(classe)) : min(story.target, mclmTarget(classe))`. Affiché « 🦋 Zip : 95 mots/min ».
- **Moteur** : `speech.startListening({ grammar, onText })` avec la grammaire v11 (mots de l'histoire normalisés `raw.toLowerCase().replace(/[^\p{L}0-9]/gu,'')`). Alignement, indulgence, joker `[unk]`, pauses, sons, animations : **code v11 copié à l'identique**. Ajout : les mots `OOV` du texte rejoignent `state.proper`. Affichage (v2.1) : le compagnon **trotte** (classe `walk`) quand il avance, s'arrête si l'enfant marque une pause (900 ms sans nouveau mot) et se réjouit à l'arrivée (classe `joy`).
- **Question de compréhension** (après l'arrivée, avant les résultats) : « Petite question 🔎 » + `story.q` (templatée) + 4 choix mélangés (`choiceGrid`, police de lecture). 1re erreur → « Relis le passage, la réponse s'y cache ! » + bouton pour revoir le texte ; 2e erreur → bonne réponse montrée. Rapport sur l'axe `fr.comp_ecrit` (`b = relLevel(classe, story.lvl)`).
- **Résultats** : écran v11 (étoiles XL, message, course contre Zip, 🍎, MCLM, précision, sauts d'obstacles, déblocage, « mots à apprivoiser ») + 🍎 de la question. Rapport de course à la manche (§5.7 du contrat). Boutons : libre → Revanche / Suite / Histoires ; balade → « Continuer la balade ➜ » (`ctx.end({ skipSummary: true })`).

## 3. Le Chemin de la clôture (`cloture`) — ma.ligne

- **Décor** : pré au premier plan, ciel en dégradé, une **clôture en bois** horizontale (lisse + piquets) qui sert de ligne graduée : grands piquets = graduations principales (plaquettes numérotées sur certains), petits piquets = sous-graduations. Le compagnon (`ctx.petSVG`, ~64 px) se tient au départ, la carotte tenue à la bouche (`ctx.petAnchors().mouth`, selon l'espèce et le stade) ; après un saut, il atterrit la bouche contre la carotte, tourné vers elle des deux côtés.
- **Lire** (`data.mode === 'lire'`) : un drapeau 🚩 planté sur une graduation ; « Quel nombre se cache sous le drapeau ? » → QCM à 6 choix en CP/CE1 et pour les fractions (format Repères), pavé numérique sinon.
- **Placer** : « Place 47 sur la clôture » → l'enfant touche (ou fait glisser, ou règle avec les flèches ‹ › / le clavier) un marqueur 🥕 sur la lisse (aimanté aux graduations si `data.snap`, sinon grille d'un dixième d'intervalle) → « Valider ✓ » → le compagnon **saute en arc** jusqu'au marqueur. Juste si `|position − valeur| ≤ data.tolerance` (à l'estime : jamais moins de ±2 dixièmes d'intervalle).
- **Zoom** (`data.zoom`) : animation caméra (viewBox SVG) d'un intervalle vers son agrandissement pour les centièmes/millièmes.
- **Fractions** : écriture empilée (numérateur / barre / dénominateur) ; graduations selon le dénominateur.
- **Indice** : `item.hint` + mise en évidence du pas (« chaque petit piquet vaut 10 ») ; **explication** : le compagnon marche jusqu'au bon piquet, la valeur apparaît sur une plaquette.

## 4. Le Galop des tables (`tables`) — ma.faits

- **Décor** : course de profil en **parallaxe** (nuages, collines, herbe qui défile), compagnon au galop (classe `walk`), obstacle (botte de foin, rondin) qui arrive de la droite. Le calcul est écrit sur un panneau en bois au-dessus (« 7 × 8 = ? », « 7 × ? = 56 », « 56 ÷ 8 = ? », « 7 + 8 = ? », « double de 8 ? »…).
- **Réponse** : pavé numérique, ou **à la voix** (bouton 🎤 ; `speech.startListening({ grammar: grammarFor(max) })` ; `parseSpoken` ; réponse juste acceptée dès qu'elle est entendue ; un autre nombre stable 1,5 s = essai faux « J'ai entendu 54… »). Voix désactivée pour les réponses décimales.
- **Mode zen** (par défaut) : l'obstacle s'arrête devant le compagnon et attend. **Avec chrono** (`settings.timers`) : l'obstacle approche en `2 × autoMs` avec une jauge douce ; s'il arrive, le compagnon s'arrête et attend (aucun échec).
- **Juste** : saut par-dessus l'obstacle, combo « 🔥 3 », note qui monte. **Faux** : petit trébuchement, indice (stratégie : « 7 × 8, c'est le double de 7 × 4 », quadrillage de points pour les petits faits, comptage de 8 en 8) puis nouvel essai.
- Leitner par fait (clés du contrat §5.5).

## 5. Pommes express (`pommes`) — ma.procedures

- **Décor** : pommier en haut, **panier** en bas à droite qui se remplit ; chaque calcul est écrit sur une grosse pomme-carte.
- **Série tranquille** (10 calculs, par défaut). **Sprint 60 s** proposé seulement si `settings.timers` (jauge douce, pas d'échec).
- **Juste** : la pomme vole dans le panier (`motion.flyTo`), compteur +1. **Faux** : bulle « astuce » = la **stratégie** (`item.hint`, ex. « Pour ajouter 9, ajoute 10 puis enlève 1 »), nouvel essai ; 2e erreur → calcul détaillé (`item.explain`).
- Items à choix (ordres de grandeur) → `choiceGrid`.

## 6. Le Chef d'orchestre (`orchestre`) — fr.conjug

- **Décor** : petite scène avec 4 musiciens animaux (SVG simples) qui se balancent sur le temps ; le compagnon dirige avec une baguette. **Métronome** (`audio.metronome`) à 72 bpm, +4 bpm par réussite de suite jusqu'à 112 (tempo progressif), lumière de scène qui pulse sur le temps fort.
- **Items** (cf. générateur) : *forme* (phrase à trou + infinitif + temps → 4 formes), *temps* (verbe souligné → 4 temps), *accord* (sujet éloigné, inversé, pronom, sujets multiples → 4 formes), *sujet* (forme donnée → 4 sujets). Phrase en police de lecture, sujet mis en valeur sur le temps fort, choix qui pulsent doucement sur le temps.
- **Juste** : une note s'ajoute sur une **portée** en haut de l'écran et les musiciens jouent une petite phrase. À la fin de la manche, l'orchestre **rejoue la mélodie** formée par les notes gagnées. **Faux** : la musique s'interrompt en douceur, indice (« Le sujet est « les enfants » → ils. Au futur avec ils, on termine par -ont »), nouvel essai.

## 7. L'Atelier des opérations (`operations`) — ma.operations

- **Décor** : établi avec une feuille quadrillée (lignes seyès légères) ; chiffres en Fredoka (≥ 2 rem), une case par chiffre ; colonne courante surlignée (ambre), case attendue qui pulse ; bulle d'aide du compagnon au-dessus du pavé numérique.
- Suit les **étapes** fournies par le générateur (`item.data.steps`) : addition (retenues qui s'envolent vers la colonne suivante), soustraction selon `settings.subMethod` (**compensation** : « 1 » ajouté devant le chiffre du haut et « +1 » sous la colonne suivante ; **cassage** : chiffre du haut barré, nouveau chiffre écrit au-dessus), multiplication (retenues, produits partiels décalés avec le 0 posé automatiquement, addition finale), division en **potence** (« Combien de fois 7 dans 17 ? » → produit → soustraction → on abaisse le chiffre suivant), décimaux (virgules alignées, zéros utiles montrés en pâle).
- Juste → le chiffre se pose avec un pop. Faux → indice de l'étape ; 2e erreur → le chiffre est posé avec l'explication et on continue (on ne bloque jamais). Un item = une opération ; juste « du premier coup » si aucune étape n'a demandé d'aide.

## 8. Écrans

- **Accueil (`home`)** : en-tête (avatar du compagnon — v2.1 : il ouvre « Qui joue ? » —, « Bonjour {P} ! », « 👥 Changer d’enfant », « 🎨 Mon thème », porte-monnaie ⭐ 🍎 🔥) ; bandeau « Je passe en … ! » (`offerNextClasse`) ; **carte du compagnon** (port v11 : scène, jauges, nourrir/brosser/promener/boutique/réglages) ; **carte « Ma balade du jour »** (4 étapes, durée, bouton C'est parti / Continuer / Terminée ✓) ; grille **« Mes jeux »** ; bouton **« Mes progrès 📈 »** ; carte de rappels (v11) ; pied : « Espace parents 🔒 », crédits, version, statut du moteur vocal.
- **Profils (`profiles`)** : grandes cartes (compagnon + prénom) + « Ajouter un enfant ».
- **Bienvenue (`welcome`, profil migré)** : confettis, « Bienvenue dans Caramel 2 ! Tes X 🍎 et Y ⭐ sont bien là. », prénom modifiable, « Tu es en quelle classe ? » (5 gros boutons), puis proposition d'importer la fiche d'évaluation (parents) ou plus tard.
- **Nouvel enfant (`onboarding`)** : prénom + fille/garçon → classe → nom du compagnon → « Tu as ta fiche d'évaluation nationale ? » (importer / plus tard).
- **Balade (`balade`)** : chemin de 4 pierres (échauffement 🌅, mission ⭐, révision 🔁, récompense 🎁) ; le compagnon avance d'une pierre à chaque bloc terminé ; bloc « jeu libre » = choix parmi les jeux ; fin : le compagnon **danse**, +10 🍎, série du jour.
- **Mes progrès (`progres`)** : deux radars (Français, Maths) au gabarit de la classe ; polygone actuel plein, fiche officielle en pointillés, étoiles qui scintillent sur les axes en progrès, libellés enfant (`AXES[id].child` + emoji), axes sans jeu en v2.0 grisés « bientôt » ; animation de la fiche vers l'actuel (`morphPolygon`) à l'ouverture.
- **Espace parents (`parents`)** : porte des adultes (v2.1 : code parent facultatif à 4 chiffres, sinon racine carrée d'un carré parfait — « La calculatrice est permise » n'est pas dit à l'enfant —, « Code oublié ? », attente croissante après 3 erreurs, refermée dès le retour côté enfant), puis profil (pastilles), **« En bref »** (v2.1 : semaine, progrès, à travailler avec l'attendu ⊕⊕, « À revoir ensemble (N) »), radars + détail par axe (replié par défaut) (⊕ θ, tendance ↗→↘, observations, dernier entraînement, jeu associé), courbe MCLM vs attendu de la classe, « à revoir » (faits et formes Leitner en boîte 1, ou en boîte 2 s'ils ont déjà été manqués : un fait juste du premier coup n'y figure pas), évaluations importées + boutons d'import (photo / saisie / fichier), réglages (durée 10/15/20, chrono, sons, animations douces, méthode de soustraction, classe, prénom, genre, thème), sauvegardes (télécharger ce profil / tous, restaurer, partager ; date de la dernière sauvegarde ; « Tout remplacer » dit que c'est définitif), gestion des profils (ajouter, supprimer avec confirmation), rappels, version.
- **Import d'évaluation (`import`)** : méthode (📷 photo de la fiche · ✋ saisie · 📄 fichier `caramel-eval`) → matière (détection par teinte : gris-vert = français, orange = maths) et classe → **photo** : image en fond semi-transparent, gabarit superposé, alignement en 2 touches (centre = cartable, haut du cercle ⊕⊕⊕), puis glisser chaque sommet le long de son rayon (aimanté à 0,1), bouton « absent » par axe → enregistrement (`applyEval`). La photo n'est jamais stockée.
  v2.1 : la photo est d'abord **lue automatiquement** (`radar-detect.js`, dans un Web Worker) : points pré-placés, récapitulatif à valider ; l'alignement et le réglage manuels restent le plan B (échec, confiance faible, ou correction d'un point).
- **Qui joue ? (v2.1, feuille ouverte depuis l'accueil)** : les enfants de l'appareil (compagnon vivant + prénom) ; toucher = bascule immédiate (transition, thème de l'enfant, toast « À toi de jouer, … ! ») ; « Ajouter un enfant » ; « En famille ».
- **En famille (`famille`, v2.1)** : lancer un défi ; classements de la semaine en 5 onglets (⏱️ minutes, 🍎 pommes, 🔥 série, ⭐ étoiles, 🏅 défis) en podiums, « Bravo aussi à… » pour les autres, message d'encouragement si personne n'a encore joué ; carte du concours de compagnons et son spectacle (`#/famille/concours` : les trois juges notent, rubans, trophée de la semaine).
- **Défi en famille (`battle`, v2.1)** : réglages (joueurs 2 à 4, type de défi, 3 ou 5 manches) → arène (piste où avancent les compagnons) → passage de main (« À toi, … ! », « Passe l’appareil à … », aux couleurs du thème du joueur) → question à son niveau (pavé ou QCM, une seule réponse, pas de joker) → points qui s'envolent ; « Je m’arrête là 💤 » sans perdre ses points ; résultats (podium, pommes, trophée ; deux colonnes sur grand écran), « Revanche 🔄 » (un autre commence) ; « Reprendre le défi » après un rechargement. Arène resserrée à 4 joueurs sur petit écran ; en mouvement réduit, fondus à la place des déplacements.
