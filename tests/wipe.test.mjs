/* « Effacer toutes les données de cet appareil » (v2.2.4, js/ui/wipe.js) : seulement ce qui appartient à Caramel
   (l'origine github.io est partagée avec les autres sites du compte), drapeau de fin de ménage, base « /vosk » bloquée
   par le worker de Vosk, fin du ménage au démarrage (main.js, avant store.init). Navigateur simulé. */
import { test, assert, memoryStorage } from './_t.mjs';
import { readFileSync } from 'node:fs';
import { WIPE_FLAG, VOSK_DB, isCaramelKey, isCaramelCache, scopeOf, plan, wipeNow, finishWipe, pending } from '../js/ui/wipe.js';
import { IDB } from '../js/core/speech.js';

const SRC = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const SCOPE = 'https://exemple.test/caramel/';
const now = fn => fn();                    /* minuteur immédiat : une base qui ne répond jamais part en « timeout » */

/* navigateur simulé : stockages, Cache Storage, service workers, IndexedDB (mode : 'ok' | 'blocked' | 'silent' | 'throw') */
function fakeBrowser({ ls = {}, ss = {}, caches = [], scopes = [], idb = 'ok', online = true } = {}) {
  const cacheSet = new Set(caches), calls = { unregistered: [], dbDeleted: [] };
  const regs = scopes.map(scope => ({ scope, unregister: async () => { calls.unregistered.push(scope); return true; } }));
  const g = {
    localStorage: memoryStorage(ls), sessionStorage: memoryStorage(ss),
    location: { href: SCOPE + 'index.html#/parents', replace(u) { calls.replaced = u; } },
    navigator: { onLine: online, serviceWorker: { getRegistrations: async () => regs } },
    caches: { keys: async () => [...cacheSet], delete: async n => cacheSet.delete(n) },
    indexedDB: {
      deleteDatabase(name) {
        if (idb === 'throw') throw new Error('interdit');
        calls.dbDeleted.push(name);
        const r = {};
        if (idb === 'ok') setTimeout(() => r.onsuccess && r.onsuccess(), 0);
        if (idb === 'blocked') setTimeout(() => r.onblocked && r.onblocked(), 0);
        return r;
      }
    }
  };
  return { g, cacheSet, calls };
}

test('wipe : nom de la base du micro = celui de speech.js ; drapeau préfixé « caramel- »', () => {
  assert.equal(VOSK_DB, IDB.name);
  assert.ok(isCaramelKey(WIPE_FLAG));
  assert.equal(scopeOf(SCOPE + 'index.html#/parents'), SCOPE);
  assert.equal(scopeOf('https://exemple.test/caramel/'), SCOPE);
});

test('wipe : seulement ce qui est à Caramel (clés caramel-, caches caramel-/vosk-/piper-tts-, sa portée)', () => {
  for (const k of ['caramel-v3', 'caramel-parent', 'caramel-save-v2', 'caramel-progress-v1', 'caramel-debug-log', 'caramel-theme'])
    assert.ok(isCaramelKey(k), k);
  for (const k of ['autre-appli', 'caramelv3', 'Caramel-v3', '', null, 42]) assert.ok(!isCaramelKey(k), String(k));
  for (const n of ['caramel-2.2.4', 'caramel-shell-v1', 'caramel-voix-v1', 'vosk-model-v1', 'vosk-lib-v1', 'piper-tts-v1'])
    assert.ok(isCaramelCache(n), n);
  for (const n of ['autre-appli-v1', 'workbox-precache', 'piper', '']) assert.ok(!isCaramelCache(n), n);
  const p = plan({
    lsKeys: ['caramel-v3', 'mon-autre-site', 'caramel-parent'], ssKeys: ['caramel-picked', 'x'],
    cacheNames: ['caramel-2.2.4', 'autre-v1', 'vosk-model-v1', 'piper-tts-v1'],
    regs: [{ scope: SCOPE }, { scope: 'https://exemple.test/autre-projet/' }, { scope: 'https://exemple.test/' }],
    scope: SCOPE
  });
  assert.deepEqual(p.ls, ['caramel-v3', 'caramel-parent']);
  assert.deepEqual(p.ss, ['caramel-picked']);
  assert.deepEqual(p.caches, ['caramel-2.2.4', 'vosk-model-v1', 'piper-tts-v1']);
  assert.deepEqual(p.regs.map(r => r.scope), [SCOPE], 'jamais le service worker d’un autre projet ni de la racine');
  assert.deepEqual(plan({ regs: [{ scope: SCOPE }] }).regs, [], 'portée inconnue : aucun service worker touché');
});

test('wipeNow : efface stockages, caches, base et service worker de Caramel, garde le reste, pose le drapeau', async () => {
  const b = fakeBrowser({
    ls: { 'caramel-v3': '{}', 'caramel-parent': '{}', 'caramel-debug-log': '[]', 'autre-site': 'garde-moi' },
    ss: { 'caramel-parents-until': '9', 'caramel-picked': 'p1', 'autre-session': '1' },
    caches: ['caramel-2.2.4', 'caramel-voix-v1', 'vosk-model-v1', 'vosk-lib-v1', 'piper-tts-v1', 'autre-appli-v3'],
    scopes: [SCOPE, 'https://exemple.test/autre-projet/']
  });
  const r = await wipeNow(b.g);
  assert.deepEqual([...b.g.localStorage._map.keys()], ['autre-site']);
  assert.deepEqual([...b.g.sessionStorage._map.keys()].sort(), ['autre-session', WIPE_FLAG].sort());
  assert.deepEqual([...b.cacheSet], ['autre-appli-v3']);
  assert.deepEqual(b.calls.unregistered, [SCOPE]);
  assert.deepEqual(b.calls.dbDeleted, ['/vosk']);
  assert.deepEqual(r, { ls: 3, ss: 2, caches: 5, db: 'ok', sw: 1 });
  assert.ok(pending(b.g));
});

test('wipeNow : base tenue par le worker de Vosk (bloquée), muette ou interdite → le ménage continue', async () => {
  const blocked = fakeBrowser({ ls: { 'caramel-v3': '{}' }, idb: 'blocked' });
  assert.equal((await wipeNow(blocked.g)).db, 'blocked');
  assert.ok(pending(blocked.g), 'drapeau posé : la base partira au démarrage');
  const silent = fakeBrowser({ idb: 'silent' });
  assert.equal((await wipeNow(silent.g, { timer: now })).db, 'timeout');
  const thrown = fakeBrowser({ idb: 'throw' });
  assert.equal((await wipeNow(thrown.g)).db, 'error');
  /* navigateur sans rien (navigation privée stricte, API absentes) : jamais d'exception */
  const bare = { location: { href: SCOPE }, navigator: {} };
  Object.defineProperty(bare, 'localStorage', { get() { throw new Error('SecurityError'); } });
  assert.deepEqual(await wipeNow(bare), { ls: 0, ss: 0, caches: 0, db: 'none', sw: 0 });
  assert.equal(pending(bare), false);
});

test('finishWipe (démarrage) : clés réécrites en partant, drapeau et base « /vosk » effacés ; rien sans drapeau', async () => {
  const b = fakeBrowser({ ls: { 'caramel-debug-log': '[1]', 'caramel-motion': 'full', 'autre-site': '1' }, ss: { [WIPE_FLAG]: '1' } });
  assert.ok(pending(b.g));
  const r = await finishWipe(b.g);
  assert.deepEqual([...b.g.localStorage._map.keys()], ['autre-site']);
  assert.equal(pending(b.g), false, 'le drapeau part avec le reste : un seul ménage');
  assert.deepEqual(b.calls.dbDeleted, ['/vosk']);
  assert.equal(r.db, 'ok');
  assert.equal(pending(fakeBrowser().g), false);
});

test('main.js : fin du ménage AVANT store.init, sur le même drapeau ; parents : carte dans « Profils »', () => {
  const main = SRC('js/main.js').replace(/\/\*[\s\S]*?\*\//g, '');
  const at = main.indexOf("sessionStorage.getItem('" + WIPE_FLAG + "')");
  assert.ok(at > 0, 'drapeau lu au démarrage');
  assert.ok(main.indexOf('finishWipe()') > at);
  assert.ok(main.indexOf('finishWipe()') < main.indexOf("load('./core/store.js')"), 'avant store.init');
  const parents = SRC('js/ui/parents.js');
  assert.match(parents, /section\('profils', 'Profils', profilesCard\(\), wipe\.parentsCard\(/);
  /* double confirmation, jamais hors connexion */
  const w = SRC('js/ui/wipe.js');
  assert.match(w, /Tout effacer sur cet appareil/);
  assert.match(w, /Vraiment tout effacer/);
  assert.match(w, /onLine === false/);
  assert.ok(!/[\u00A0\u202f\u200B\u2009\u0300-\u036F]/.test(w), 'caractère invisible littéral');
});
