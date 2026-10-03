/* Mini-harnais de tests (Node 20, aucune dépendance).
   Dans un fichier tests/xxx.test.mjs :
     import { test, assert } from './_t.mjs';
     test('nom lisible', () => { assert.equal(1 + 1, 2); });
   Lancer : node tests/run.mjs            (tous)
            node tests/run.mjs migrate    (fichiers dont le nom contient « migrate ») */
import assert from 'node:assert/strict';

const registry = [];
let currentFile = '';
export function setFile(f) { currentFile = f; }
export function test(name, fn) { registry.push({ file: currentFile, name, fn }); }
export { assert };

/* stockage localStorage simulé (pour store/migrate) */
export function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    _map: m
  };
}

export async function runRegistered() {
  let ok = 0, ko = 0;
  for (const t of registry) {
    try {
      await t.fn();
      ok++;
    } catch (e) {
      ko++;
      console.log(`✗ [${t.file}] ${t.name}\n    ${String(e && e.stack || e).split('\n').slice(0, 6).join('\n    ')}`);
    }
  }
  console.log(`\n${ok} réussi(s), ${ko} échec(s) sur ${registry.length} test(s).`);
  return ko;
}
