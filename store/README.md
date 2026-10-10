# Publier Caramel sur Google Play — pas à pas (Linux)

> Préparé le 7 octobre 2026 pour Caramel 2.2.4. Application Android = **TWA** (Trusted Web Activity) : une petite
> coquille Android qui ouvre https://caramel.manica.fr/ en plein écran dans Chrome (domaine de Manica Labs, dépôt
> github.com/ManicaLabs/caramel, depuis le 07/10/2026). Le site reste la source unique : chaque déploiement GitHub Pages
> met l'appli à jour, sans nouvelle version sur le Play Store.
> Étude complète (règles, sources) : rapport « stores » du 6 octobre 2026.

Ce dossier `store/` n'est **jamais précaché** par le service worker (tools/precache.mjs) :

| Chemin | Contenu |
|---|---|
| `fiche-play.md` | textes de la fiche, réponses aux questionnaires (Sécurité des données, IARC, Familles, DSA) |
| `twa/twa-manifest.json` | configuration Bubblewrap prête à l'emploi |
| `twa/assetlinks.json` | modèle du lien appli ↔ site, à poser dans `.well-known/` de CE dépôt (étape 6) |
| `visuels/` | icône Play 512, image de présentation 1024 × 500, icône iOS 1024 (pour plus tard) |
| `captures/` | captures téléphone, tablette 7" et 10" (profil fictif « Léa ») |
| `sources/` | dessins SVG des icônes, page de l'image de présentation |
| `outils/visuels.sh`, `outils/captures.mjs` | régénérer les icônes, les captures et l'image de présentation |

Les pages publiques (confidentialité, mentions légales, aide, licences) sont dans `pages/` et s'ouvrent depuis
l'espace parents, rubrique « À propos ».

---

## Étape 0 — Décisions et marqueurs (avant de payer quoi que ce soit)

1. **Nom de l'appli** : voir `fiche-play.md` §1 (« Caramel : lire et compter » proposé). Recherche INPI / TMview.
2. **Type de compte** : personnel (nom légal et pays affichés ; test fermé 12 testeurs × 14 jours) ou organisation
   (association, numéro D-U-N-S ; pas de test fermé).
3. **Adresse e-mail dédiée** (publique sur Play) : créez-la maintenant.
4. **Identifiant d'appli** : `fr.manica.caramel` (dans `twa/twa-manifest.json` ; domaine manica.fr à l'envers). **Il ne
   pourra plus jamais changer** une fois l'appli créée dans la Play Console.
5. **Secours de reconnaissance vocale de Google** : le couper dans l'appli Android (recommandé ; la TWA démarre sur
   `/?app=android`, ce qui permet de la reconnaître) ou le garder et le déclarer (fiche §6).
6. **Remplir les marqueurs** `[À COMPLÉTER : …]` : `grep -rn "À COMPLÉTER" pages/ store/` (dans les pages, l'espace
   fine fait écrire `[À COMPLÉTER&#8239;: …]`). Ils sont surlignés en jaune dans les pages tant qu'ils restent :
   remplacez tout le `<span class="todo">…</span>` par le texte.
7. **Publier le site** (vous seul décidez du push) avec les nouvelles icônes, le manifeste et les pages, après
   `node tools/precache.mjs`. Bubblewrap télécharge les icônes **depuis le site en ligne** : elles doivent y être.
   Vérifiez : https://caramel.manica.fr/icon-maskable-512.png et …/pages/confidentialite.html.

## Étape 1 — Installer Bubblewrap (JDK 17 et SDK Android compris)

```bash
node --version                      # 18 ou plus (vous avez Node 20)
npm install -g @bubblewrap/cli      # ou préfixer chaque commande par « npx @bubblewrap/cli »
bubblewrap doctor
```

Au premier lancement, Bubblewrap demande s'il doit installer **le JDK 17** puis **le SDK Android** : répondez
**Oui** aux deux et acceptez les licences. Il les range dans `~/.bubblewrap/` (environ 1 Go, plusieurs minutes).
`bubblewrap doctor` doit finir sans erreur.

## Étape 2 — Préparer les dossiers (hors du dépôt public !)

```bash
mkdir -p ~/caramel-android ~/caramel-cles
cp ~/www/caramel/store/twa/twa-manifest.json ~/caramel-android/
```

`twa-manifest.json` attend la clé dans `../caramel-cles/caramel-envoi.keystore` (chemin relatif au projet), alias
`caramel`. Le dépôt ignore déjà `*.keystore`, `*.jks`, `*.apk`, `*.aab` et `store/android/` (`.gitignore`), mais le
plus sûr est de ne jamais mettre ces fichiers dans `~/www/caramel`.

## Étape 3 — Créer la clé de signature… et la GARDER

C'est la **clé d'importation** (« upload key ») : elle signe chaque version envoyée à Google, qui re-signe ensuite
l'appli avec sa propre clé (« signature des applications par Google Play », obligatoire pour les nouvelles applis).

```bash
KEYTOOL="$(node -p "require(process.env.HOME + '/.bubblewrap/config.json').jdkPath")/bin/keytool"
"$KEYTOOL" -genkeypair -v -keystore ~/caramel-cles/caramel-envoi.keystore -alias caramel \
  -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Caramel, C=FR"
```

keytool demande un **mot de passe** (6 caractères au moins) : choisissez-en un long, rangez-le dans un gestionnaire
de mots de passe.

> ⚠️ **Considérez sa perte comme irréversible.** Sans ce fichier ET son mot de passe, plus aucune mise à jour de
> l'appli n'est possible (Google peut, au mieux, réinitialiser une clé d'importation sur demande, en plusieurs jours,
> et jamais pour une appli signée hors Play). Faites **deux copies** dès maintenant : une clé USB rangée à part et un
> stockage en ligne chiffré. Jamais dans le dépôt public, jamais par e-mail.

Notez l'empreinte SHA-256 de cette clé (elle ira dans `assetlinks.json`) :

```bash
"$KEYTOOL" -list -v -keystore ~/caramel-cles/caramel-envoi.keystore -alias caramel | grep SHA256
```

## Étape 4 — Compiler

```bash
cd ~/caramel-android
bubblewrap build
```

La première fois, Bubblewrap ne trouve pas `manifest-checksum.txt` et propose de **générer le projet Android**
depuis `twa-manifest.json` : répondez **Oui**. Il télécharge les icônes du site, prépare Gradle (long la première
fois), demande les deux mots de passe (le même, si vous n'en avez choisi qu'un), puis produit :

- `app-release-bundle.aab` : **à envoyer sur Google Play** ;
- `app-release-signed.apk` : **pour essayer sur un téléphone**.

Vérifiez qu'aucune permission publicitaire ne s'est glissée (règlement Familles) ; seule `POST_NOTIFICATIONS` doit
apparaître (plus éventuellement des permissions internes du navigateur) :

```bash
"$(ls -d ~/.bubblewrap/android_sdk/build-tools/* | tail -1)/aapt2" dump permissions app-release-signed.apk
```

Aucune ligne `AD_ID` ne doit sortir.

## Étape 5 — Essayer sur un téléphone Android

1. Sur le téléphone : Paramètres › À propos › appuyer 7 fois sur « Numéro de build » ; puis Options pour les
   développeurs › **Débogage USB**. Brancher le câble, accepter l'empreinte de l'ordinateur.
2. `bubblewrap install` (installe `app-release-signed.apk` par adb).
3. À vérifier : icône (adaptative, sans coins transparents), écran de démarrage, micro (autorisation demandée par
   Chrome), photo d'une fiche, rappels (autorisation de notifications sur Android 13+), hors connexion après la
   première ouverture, bouton retour, liens de l'espace parents, « Effacer toutes les données de cet appareil », et
   **aucune invitation « Mets Caramel sur l'écran d'accueil »** (l'appli doit se savoir installée ; sinon, faire
   reconnaître l'adresse de démarrage `?app=android` par js/core/install.js).
4. **Une barre d'adresse en haut est normale à ce stade** : le lien entre l'appli et le site
   (`assetlinks.json`, étape 6) n'existe pas encore.

## Étape 6 — Le lien appli ↔ site (`assetlinks.json`)

Chrome vérifie `https://caramel.manica.fr/.well-known/assetlinks.json`, **à la racine du domaine**. Avec le domaine de
Manica Labs, la racine du site EST ce dépôt : pas de second dépôt.

1. Copier le modèle et remplir ses deux marqueurs par les empreintes SHA-256 (format `AB:CD:…`, 32 paires) — celle de
   la clé d'importation (étape 3) pour les essais, et celle de la **clé de signature de Google** (étape 8) pour les
   versions installées depuis Play :
   ```bash
   mkdir -p .well-known && cp store/twa/assetlinks.json .well-known/assetlinks.json
   touch .nojekyll        # sans lui, GitHub Pages ignore les dossiers qui commencent par un point (.well-known)
   ```
2. Publier (vous seul décidez du push).
3. Vérifier :
   ```bash
   curl -s https://caramel.manica.fr/.well-known/assetlinks.json
   ```
   puis l'outil de Google « Statement List Generator and Tester »
   (https://developers.google.com/digital-asset-links/tools/generator) : domaine `caramel.manica.fr`, paquet
   `fr.manica.caramel`, empreinte. Désinstaller puis réinstaller l'APK : la barre d'adresse disparaît.
4. Ce fichier doit rester en ligne **pour toujours** : s'il disparaît, la barre d'adresse revient dans l'appli.

Variante : Bubblewrap sait écrire le fichier lui-même (`bubblewrap fingerprint add <SHA-256> --name=play`, puis
`bubblewrap fingerprint generateAssetLinks`).

## Étape 7 — Ouvrir le compte Google Play Console

1. https://play.google.com/console/signup : compte **personnel** (ou organisation, selon l'étape 0), 25 $ une fois.
2. Pièce d'identité, adresse e-mail dédiée et téléphone vérifiés par code ; pour un compte personnel, Google peut
   demander de prouver l'accès à un vrai téléphone Android (application Play Console). Compter quelques jours.
3. Ce qui devient public : votre **nom légal**, votre **pays** et l'**adresse e-mail** de contact.
4. Statut DSA : **non professionnel** (fiche §9), à confirmer dans la rubrique proposée à l'inscription.
5. Se connecter régulièrement : Google ferme les comptes inactifs.

## Étape 8 — Créer l'appli et la fiche, envoyer la première version en test fermé

1. Play Console › Créer une appli : nom (étape 0), langue par défaut **français (France)**, **Application**,
   **Gratuite**, déclarations acceptées.
2. Remplir **toutes** les rubriques de « Configurer votre appli » avec `fiche-play.md` : accès à l'appli, annonces,
   classification du contenu, public cible (6-8 et 9-12 ans), sécurité des données, appli gouvernementale, fonctions
   financières, santé, actualités ; puis la **fiche principale** (textes, icône, image de présentation, captures).
3. Tester et publier › **Test fermé** › créer une piste, ajouter la liste des testeurs (12 adresses au moins), le
   canal de retours (votre adresse e-mail), les pays.
4. Créer une version : envoyer `app-release-bundle.aab`, accepter la **signature des applications par Google Play**.
5. Puis Configuration › **Intégrité de l'appli** › Signature de l'appli : copier l'empreinte SHA-256 de la
   **clé de signature de l'appli** et l'ajouter à `assetlinks.json` (étape 6). Sinon : barre d'adresse visible
   uniquement dans la version installée depuis Play (erreur la plus fréquente).
6. Envoyer la version en examen. Les testeurs reçoivent un lien d'inscription (« opt-in ») puis installent depuis Play.

## Étape 9 — Le test fermé : 12 testeurs pendant 14 jours

- **12 testeurs au moins, inscrits sans interruption pendant au moins 14 jours** (une désinscription relance le
  décompte) : familles, collègues, enseignants, avec un compte Google sur un téléphone Android.
- Leur demander d'utiliser vraiment l'appli et d'écrire leurs retours : Google pose des questions sur le déroulement
  du test.
- Corriger sur le site (un push suffit) ; une nouvelle version Android n'est utile que si `twa-manifest.json`,
  l'icône ou le nom changent (`appVersionCode` +1 : `bubblewrap update`).

## Étape 10 — La production

1. Après 14 jours : Tableau de bord › **Demander l'accès à la production** (questionnaire en trois parties).
   Réponse en 7 jours environ.
2. Production › Créer une version (le même AAB, ou un nouveau avec `appVersionCode` +1) › déploiement.
3. L'appli entre automatiquement dans la file « Approuvé par les enseignants » si elle respecte le règlement Familles.

## Entretien

- **Chaque année avant le 31 août** : Google relève le niveau d'API exigé (API 36 en 2026). Mettre à jour Bubblewrap
  (`npm install -g @bubblewrap/cli@latest`), puis dans `~/caramel-android` : `bubblewrap update` (version +1),
  `bubblewrap build`, envoyer l'AAB.
- Changement du manifeste web (nom, icônes, couleurs) : `bubblewrap merge`, puis `bubblewrap build`.
- Chaque push sur GitHub Pages met immédiatement à jour l'appli des familles : relire les règles « Familles » avant
  chaque push (pas de lien sortant côté enfant, pas de nouvelle connexion non déclarée, politique de confidentialité
  à jour et datée).
- Garder `assetlinks.json` en ligne, la clé et ses copies, la boîte e-mail d'assistance.
- Mettre à jour la Sécurité des données et le public cible si l'appli change (ex. jeu à plusieurs sur deux
  téléphones, appareil photo pour scanner un code).

## Régénérer les visuels

```bash
bash store/outils/visuels.sh                 # icônes (Inkscape + ImageMagick)
# captures et image de présentation : serveur local depuis le dossier PARENT du dépôt, puis le script
(cd .. && python3 -m http.server 8997 --bind 127.0.0.1) &
node store/outils/captures.mjs               # ou un filtre : node store/outils/captures.mjs telephone
```
