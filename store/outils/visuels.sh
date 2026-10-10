#!/usr/bin/env bash
# ============ ICÔNES DES STORES ET DU MANIFESTE (Google Play, plus tard l'App Store) ============
# Rend les PNG à partir des sources SVG de store/sources/ (Inkscape + ImageMagick) :
#   racine du site (déclarées dans manifest.webmanifest) :
#     icon-maskable-192.png, icon-maskable-512.png  « maskable » : fond plein, dessin dans le cercle central de 80 %
#     icon-monochrome-512.png                        « monochrome » : silhouette sur fond transparent
#   store/visuels/ (hors du site installé : rien n'y est précaché) :
#     icone-play-512.png    icône de la fiche Play (carré plein, Google arrondit lui-même)
#     icone-ios-1024.png    icône App Store, SANS canal alpha (pour plus tard)
# L'image de présentation 1024 × 500 et les captures sont faites par store/outils/captures.mjs (Chrome).
#   bash store/outils/visuels.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
SRC=store/sources
OUT=store/visuels
mkdir -p "$OUT"
png() { inkscape "$1" --export-type=png --export-filename="$2" -w "$3" -h "$3" >/dev/null 2>&1; }

png "$SRC/icone-maskable.svg" icon-maskable-512.png 512
png "$SRC/icone-maskable.svg" icon-maskable-192.png 192
png "$SRC/icone-monochrome.svg" icon-monochrome-512.png 512
png "$SRC/icone-pleine.svg" "$OUT/icone-play-512.png" 512
png "$SRC/icone-pleine.svg" "$OUT/icone-ios-1024.png" 1024

# fonds pleins : aucune transparence là où elle n'a rien à faire (maskable, Play), aucune couche alpha pour Apple
for f in icon-maskable-512.png icon-maskable-192.png "$OUT/icone-play-512.png"; do
  convert "$f" -background '#f9a8d4' -alpha remove -define png:compression-level=9 "$f"
done
convert "$OUT/icone-ios-1024.png" -background '#f9a8d4' -alpha remove -alpha off -define png:color-type=2 "$OUT/icone-ios-1024.png"
convert icon-monochrome-512.png -define png:color-type=6 -define png:compression-level=9 icon-monochrome-512.png
identify icon-maskable-512.png icon-maskable-192.png icon-monochrome-512.png "$OUT/icone-play-512.png" "$OUT/icone-ios-1024.png"
