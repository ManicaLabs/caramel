/* ============ PRÉCACHE DU SERVICE WORKER ============
   Réécrit, entre les marqueurs « ASSETS:START » et « ASSETS:END » de sw.js, la VERSION (= version de
   package.json) et la liste ASSETS : index.html, manifest.webmanifest, icônes, fonts/*.woff2,
   css/**\/*.css, js/**\/*.js, (v2.2.4) pages publiques pages/*.html|css|js (lisibles hors ligne) — jamais models/,
   tests/, docs/, tools/, store/ (visuels et captures des stores). Met aussi à jour
   <meta name="caramel-version"> de index.html (version affichable par les écrans).
     node tools/precache.mjs           écrit (à lancer avant chaque push)
     node tools/precache.mjs --check   vérifie seulement : code de sortie 1 si sw.js n'est pas à jour
   Importable : listAssets(root), readVersion(root), renderBlock(version, assets). */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const START = '/* ASSETS:START */';
export const END = '/* ASSETS:END */';
const ICON = /^(icon|favicon|apple-touch-icon)[\w.-]*\.(png|svg|ico|webp)$/;
const PRECACHE_BUDGET = 3 * 1024 * 1024;       /* CDC §14 : v2.2.2 ≈ 2,5 Mo non minifié (≈ 0,9 Mo compressé) ; alerte au-delà de 3 Mo */

const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function walk(dir, ext, recursive, out = []) {
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
  for (const d of entries) {
    if (d.name.startsWith('.')) continue;
    const p = join(dir, d.name);
    if (d.isDirectory()) { if (recursive) walk(p, ext, true, out); }
    else if (d.isFile() && d.name.endsWith(ext)) out.push(p);
  }
  return out;
}

/* liste ordonnée des fichiers à précacher (chemins relatifs, séparateur /) */
export function listAssets(root = ROOT) {
  const rel = p => relative(root, p).split(sep).join('/');
  let top = [];
  try { top = readdirSync(root, { withFileTypes: true }).filter(d => d.isFile()).map(d => d.name); } catch (_) {}
  return [
    ...['index.html', 'manifest.webmanifest'].filter(f => top.includes(f)),
    ...top.filter(f => ICON.test(f)).sort(byPath),
    ...walk(join(root, 'fonts'), '.woff2', false).map(rel).sort(byPath),
    ...walk(join(root, 'css'), '.css', true).map(rel).sort(byPath),
    ...walk(join(root, 'js'), '.js', true).map(rel).sort(byPath),
    ...['.html', '.css', '.js'].flatMap(ext => walk(join(root, 'pages'), ext, false)).map(rel).sort(byPath)
  ];
}

export function readVersion(root = ROOT) {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
}

export function renderBlock(version, assets) {
  return START + '\n' +
    'const VERSION = ' + JSON.stringify(version).replace(/"/g, "'") + ';\n' +
    'const ASSETS = [\n' + assets.map(a => '  ' + JSON.stringify(a).replace(/"/g, "'")).join(',\n') + '\n];\n' +
    END;
}

/* contenu de sw.js et de index.html mis à jour (sans écrire) */
export function build(root = ROOT) {
  const version = readVersion(root);
  const assets = listAssets(root);
  const swPath = join(root, 'sw.js');
  const sw = readFileSync(swPath, 'utf8');
  const a = sw.indexOf(START), b = sw.indexOf(END);
  if (a < 0 || b < a) throw new Error('sw.js : marqueurs ' + START + ' … ' + END + ' introuvables');
  const nextSw = sw.slice(0, a) + renderBlock(version, assets) + sw.slice(b + END.length);
  const indexPath = join(root, 'index.html');
  let index = null, nextIndex = null;
  try {
    index = readFileSync(indexPath, 'utf8');
    nextIndex = index.replace(/(<meta name="caramel-version" content=")[^"]*(")/, '$1' + version + '$2');
  } catch (_) {}
  const bytes = assets.reduce((s, f) => { try { return s + statSync(join(root, f)).size; } catch (_) { return s; } }, 0);
  return { version, assets, bytes, swPath, sw, nextSw, indexPath, index, nextIndex };
}

function main() {
  const checkOnly = process.argv.includes('--check');
  let r;
  try { r = build(); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
  const stale = [];
  if (r.nextSw !== r.sw) stale.push('sw.js');
  if (r.index !== null && r.nextIndex !== r.index) stale.push('index.html');
  const size = Math.round(r.bytes / 1024) + ' Ko';
  if (checkOnly) {
    if (stale.length) { console.log('✗ précache à régénérer (' + stale.join(', ') + ') : node tools/precache.mjs'); process.exit(1); }
    console.log('✓ précache à jour : ' + r.assets.length + ' fichiers, ' + size + ', version ' + r.version);
    return;
  }
  if (r.nextSw !== r.sw) writeFileSync(r.swPath, r.nextSw);
  if (r.index !== null && r.nextIndex !== r.index) writeFileSync(r.indexPath, r.nextIndex);
  console.log((stale.length ? '✓ mis à jour (' + stale.join(', ') + ')' : '✓ déjà à jour') + ' : ' +
    r.assets.length + ' fichiers précachés, ' + size + ' (hors modèle), version ' + r.version);
  if (r.bytes > PRECACHE_BUDGET) console.log('⚠ précache au-delà de 3 Mo (CDC §14 : budget hors modèle)');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
