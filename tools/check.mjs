/* ============ VÉRIFICATION AVANT PUSH ============
   1. node --check sur chaque .js / .mjs de js/, tests/, tools/, et sur sw.js ;
   2. manifest.webmanifest : JSON valide ;
   3. node tests/run.mjs (tous les tests, ou ceux dont le nom contient le filtre).
   Code de sortie ≠ 0 au moindre échec.   node tools/check.mjs [filtre] */
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rel = p => relative(ROOT, p).split(sep).join('/');

function walk(dir, out = []) {
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
  for (const d of entries) {
    if (d.name.startsWith('.') || d.name === 'node_modules') continue;
    const p = join(dir, d.name);
    if (d.isDirectory()) walk(p, out);
    else if (d.isFile() && /\.m?js$/.test(d.name)) out.push(p);
  }
  return out;
}

function run(cmd, args, { inherit = false } = {}) {
  return new Promise(res => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
    let out = '';
    if (!inherit) {
      child.stdout.on('data', d => { out += d; });
      child.stderr.on('data', d => { out += d; });
    }
    child.on('error', e => res({ code: 1, out: String(e) }));
    child.on('close', code => res({ code: code ?? 1, out }));
  });
}

async function syntaxCheck(files) {
  const failures = [];
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const f = files[next++];
      const { code, out } = await run(process.execPath, ['--check', f]);
      if (code !== 0) failures.push({ f, out: out.trim() });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(8, cpus().length)) }, worker));
  return failures;
}

const files = [...walk(join(ROOT, 'js')), ...walk(join(ROOT, 'tests')), ...walk(join(ROOT, 'tools'))];
if (existsSync(join(ROOT, 'sw.js'))) files.push(join(ROOT, 'sw.js'));
files.sort();

let failed = 0;
const syntax = await syntaxCheck(files);
for (const { f, out } of syntax) console.log('✗ syntaxe : ' + rel(f) + '\n    ' + out.split('\n').slice(0, 6).join('\n    '));
console.log((syntax.length ? '✗' : '✓') + ' node --check : ' + (files.length - syntax.length) + '/' + files.length + ' fichiers');
failed += syntax.length;

try { JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8')); console.log('✓ manifest.webmanifest : JSON valide'); }
catch (e) { console.log('✗ manifest.webmanifest : ' + e.message); failed++; }

const filter = process.argv[2] || '';
console.log('— tests' + (filter ? ' « ' + filter + ' »' : '') + ' —');
const tests = await run(process.execPath, [join(ROOT, 'tests', 'run.mjs'), ...(filter ? [filter] : [])], { inherit: true });
if (tests.code !== 0) failed++;

console.log(failed ? '\n✗ vérification échouée' : '\n✓ tout est bon');
process.exit(failed ? 1 : 0);
