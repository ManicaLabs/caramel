/* Lance tous les tests/*.test.mjs (ou ceux dont le nom contient l'argument). */
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { setFile, runRegistered } from './_t.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] || '';
const files = readdirSync(here).filter(f => f.endsWith('.test.mjs') && f.includes(filter)).sort();
if (!files.length) { console.log('Aucun fichier de test pour « ' + filter + ' ».'); process.exit(1); }

for (const f of files) {
  setFile(f);
  try {
    await import(pathToFileURL(join(here, f)).href);
  } catch (e) {
    console.log(`✗ [${f}] impossible de charger le fichier\n    ${String(e && e.stack || e).split('\n').slice(0, 6).join('\n    ')}`);
    process.exitCode = 1;
  }
}
const failed = await runRegistered();
if (failed) process.exitCode = 1;
