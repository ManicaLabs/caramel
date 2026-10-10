/* Service worker (contrat §8.4) : cohérence de la liste ASSETS avec les fichiers, version, et comportement
   réel de sw.js exécuté dans un bac à sable Node (vm) avec Cache Storage / fetch simulés. */
import { test, assert } from './_t.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { listAssets, readVersion, START, END } from '../tools/precache.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const swSrc = readFileSync(join(root, 'sw.js'), 'utf8');
const SCOPE = 'https://exemple.test/caramel/';
const VOSK_LIB = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';

/* exécute sw.js ; caches = noms de caches déjà présents ; net(url, init) → Response (sinon réponse « ok ») */
function loadSw({ caches: initial = [], net = null } = {}) {
  const listeners = {}, store = new Map(), calls = { skipWaiting: 0, claim: 0, notes: [], fetches: [], opened: [], focus: 0 };
  for (const n of initial) store.set(n, new Map());
  const key = r => new URL(typeof r === 'string' ? r : r.url, SCOPE + 'sw.js').href;
  const cacheOf = name => ({
    async match(r) { const m = store.get(name); const k = key(r); return m && m.has(k) ? m.get(k).clone() : undefined; },
    async put(r, res) { store.get(name).set(key(r), res); },
    async addAll(reqs) {
      for (const r of reqs) {
        const res = await ctx.fetch(r);
        if (!res.ok) throw new TypeError('addAll : ' + key(r));
        store.get(name).set(key(r), res);
      }
    }
  });
  const ctx = {
    console, URL, Request, Response, Headers, Promise, setTimeout, clearTimeout,
    location: new URL(SCOPE + 'sw.js'),
    caches: {
      async open(n) { if (!store.has(n)) store.set(n, new Map()); return cacheOf(n); },
      async has(n) { return store.has(n); },
      async keys() { return [...store.keys()]; },
      async delete(n) { return store.delete(n); }
    },
    fetch: async (r, init) => {
      const url = key(r);
      calls.fetches.push({ url, init, mode: r && r.mode, cache: r && r.cache });
      if (net) return net(url, init);
      const res = new Response('réseau:' + url, { status: 200 });
      Object.defineProperty(res, 'type', { value: 'basic' });
      return res;
    },
    clients: {
      claim: async () => { calls.claim++; },
      matchAll: async () => ctx._windows || [],
      openWindow: async u => { calls.opened.push(u); }
    },
    registration: { scope: SCOPE, showNotification: async (title, o) => { calls.notes.push({ title, ...o }); } },
    skipWaiting: async () => { calls.skipWaiting++; },
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); }
  };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(swSrc, ctx, { filename: 'sw.js' });
  /* déclenche un événement ; renvoie la réponse fournie à respondWith, ou null si non interceptée */
  async function dispatch(type, extra = {}) {
    const waits = [];
    let responded = null;
    const ev = { ...extra, waitUntil: p => { waits.push(p); }, respondWith: p => { responded = p; } };
    for (const fn of listeners[type] || []) fn(ev);
    const res = responded ? await responded : null;
    await Promise.all(waits);
    return res;
  }
  const get = (url, mode = 'no-cors', method = 'GET') => dispatch('fetch', { request: { url, mode, method } });
  return { ctx, store, calls, dispatch, get, key };
}
const assetsInSw = () => {
  const block = swSrc.slice(swSrc.indexOf(START), swSrc.indexOf(END));
  const m = block.match(/const ASSETS = (\[[\s\S]*?\]);/);
  return new Function('return ' + m[1])();
};

test('ASSETS de sw.js = exactement les fichiers présents (node tools/precache.mjs)', () => {
  const inSw = assetsInSw(), onDisk = listAssets(root);
  assert.equal(new Set(inSw).size, inSw.length, 'doublons dans ASSETS');
  const missing = onDisk.filter(f => !inSw.includes(f)), extra = inSw.filter(f => !onDisk.includes(f));
  assert.deepEqual({ missing, extra }, { missing: [], extra: [] }, 'liste périmée : lancer node tools/precache.mjs');
  for (const f of inSw) assert.ok(!/^(models|tests|docs|tools)\//.test(f) && f !== 'sw.js', f);
  for (const f of ['index.html', 'manifest.webmanifest', 'icon-192.png', 'css/base.css', 'js/main.js', 'js/router.js', 'js/core/speech.js'])
    assert.ok(inSw.includes(f), f);
});

test('VERSION de sw.js (et méta de index.html) = version de package.json', () => {
  const v = readVersion(root);
  assert.ok(swSrc.slice(swSrc.indexOf(START), swSrc.indexOf(END)).includes("const VERSION = '" + v + "';"));
  const { ctx } = loadSw();
  assert.equal(vm.runInContext('CACHE', ctx), 'caramel-' + v);
  const index = readFileSync(join(root, 'index.html'), 'utf8');
  assert.ok(index.includes('<meta name="caramel-version" content="' + v + '">'), 'méta caramel-version');
});

test('statique : vosk-model-v1, vosk-lib-v1 et caramel-voix-v1 ne sont jamais supprimés', () => {
  assert.ok(swSrc.includes("const MODEL_CACHE = 'vosk-model-v1';"));
  assert.ok(swSrc.includes("const LIB_CACHE = 'vosk-lib-v1';"));
  assert.ok(swSrc.includes("const VOICE_CACHE = 'caramel-voix-v1';"));
  assert.ok(swSrc.includes('const KEEP = [MODEL_CACHE, LIB_CACHE, VOICE_CACHE];'));
  /* un seul appel caches.delete, filtré par isObsolete (préfixe caramel-, ni la version courante, ni KEEP) */
  assert.equal(swSrc.match(/caches\.delete\(/g).length, 1);
  assert.ok(/keys\.filter\(isObsolete\)\.map\(k => caches\.delete\(k\)\)/.test(swSrc));
  assert.ok(swSrc.includes("const isObsolete = key => key.startsWith('caramel-') && key !== CACHE && !KEEP.includes(key);"));
  assert.ok(!/delete\(\s*(['"`]vosk|MODEL_CACHE|LIB_CACHE)/.test(swSrc));
  assert.ok(!/\.delete\(/.test(swSrc.replace(/caches\.delete\(k\)/, '')), 'aucune autre suppression');
});

test('install : précache complet ; skipWaiting seulement si le cache v11 existe', async () => {
  const v = readVersion(root), assets = assetsInSw();
  const a = loadSw();
  await a.dispatch('install');
  assert.equal(a.calls.skipWaiting, 0);
  assert.deepEqual([...a.store.get('caramel-' + v).keys()].sort(), assets.map(f => SCOPE + f).sort());
  const b = loadSw({ caches: ['caramel-shell-v1'] });
  await b.dispatch('install');
  assert.equal(b.calls.skipWaiting, 1);
  /* précache sans copie périmée du cache HTTP */
  assert.equal(b.calls.fetches.length, assets.length);
  assert.ok(b.calls.fetches.every(f => f.cache === 'reload'), 'cache: reload');
});

test('activate : purge des caramel-* obsolètes, jamais vosk-model-v1, vosk-lib-v1 ni caramel-voix-v1', async () => {
  const v = readVersion(root);
  const s = loadSw({ caches: ['caramel-shell-v1', 'caramel-1.9.0', 'caramel-' + v, 'vosk-model-v1', 'vosk-lib-v1', 'caramel-voix-v1', 'autre-appli'] });
  await s.dispatch('activate');
  assert.deepEqual([...s.store.keys()].sort(), ['autre-appli', 'caramel-' + v, 'caramel-voix-v1', 'vosk-lib-v1', 'vosk-model-v1']);
  assert.equal(s.calls.claim, 1);
});

test('message SKIP_WAITING → skipWaiting', async () => {
  const s = loadSw();
  await s.dispatch('message', { data: { type: 'AUTRE' } });
  assert.equal(s.calls.skipWaiting, 0);
  await s.dispatch('message', { data: { type: 'SKIP_WAITING' } });
  assert.equal(s.calls.skipWaiting, 1);
});

test('fetch : coquille, cache d’abord, exclusions (/models/, autres origines, POST, autres pages)', async () => {
  const v = readVersion(root);
  const s = loadSw();
  await s.dispatch('install');
  const shell = await s.store.get('caramel-' + v).get(SCOPE + 'index.html').clone().text();
  for (const u of [SCOPE, SCOPE + 'index.html', SCOPE + '?utm=1', SCOPE + 'index.html#/home'])
    assert.equal(await (await s.get(u, 'navigate')).text(), shell, u);
  assert.equal(await s.get(SCOPE + 'tests/harness/speech.html', 'navigate'), null, 'autres pages : réseau normal');
  assert.equal(await s.get(SCOPE + 'models/fr.tar.gz', 'cors'), null, '/models/ exclu');
  assert.equal(await s.get('https://ailleurs.test/x.js'), null, 'autre origine');
  assert.equal(await s.get(SCOPE + 'js/main.js', 'no-cors', 'POST'), null, 'POST');
  const n = s.calls.fetches.length;
  assert.equal(await (await s.get(SCOPE + 'js/main.js')).text(), 'réseau:' + SCOPE + 'js/main.js');
  assert.equal(s.calls.fetches.length, n, 'servi par le cache, sans réseau');
  /* ressource absente du précache : réseau puis mise en cache */
  await s.get(SCOPE + 'js/nouveau.js');
  assert.equal(s.calls.fetches.length, n + 1);
  await s.get(SCOPE + 'js/nouveau.js');
  assert.equal(s.calls.fetches.length, n + 1, 'mis en cache au premier passage');
});

test('fetch : hors ligne sans cache → page de secours ; vosk.js gardé dans vosk-lib-v1', async () => {
  const s = loadSw({ net: async () => { throw new TypeError('hors ligne'); } });
  const off = await s.get(SCOPE, 'navigate');
  assert.equal(off.status, 503);
  assert.ok((await off.text()).includes('Reconnecte-toi'));
  const t = loadSw({ net: async (url, init) => new Response('vosk', { status: 200, headers: { 'x-mode': String(init && init.mode) } }) });
  const r1 = await t.get(VOSK_LIB, 'no-cors');
  assert.equal(await r1.text(), 'vosk');
  assert.equal(t.calls.fetches.at(-1).init.mode, 'cors', 'requête CORS : vrai statut avant mise en cache');
  assert.ok(t.store.get('vosk-lib-v1').has(VOSK_LIB));
  const n = t.calls.fetches.length;
  assert.equal(await (await t.get(VOSK_LIB, 'no-cors')).text(), 'vosk');
  assert.equal(t.calls.fetches.length, n, 'servi depuis vosk-lib-v1');
  const u = loadSw({ net: async () => new Response('erreur', { status: 404 }) });
  await u.get(VOSK_LIB, 'no-cors');
  assert.ok(!u.store.get('vosk-lib-v1').has(VOSK_LIB), 'une erreur n’est jamais mise en cache');
});

test('rappel quotidien et clic sur la notification', async () => {
  const s = loadSw();
  await s.dispatch('periodicsync', { tag: 'autre' });
  assert.equal(s.calls.notes.length, 0);
  await s.dispatch('periodicsync', { tag: 'caramel-daily' });
  assert.equal(s.calls.notes.length, 1);
  const n = s.calls.notes[0];
  assert.equal(n.title, 'Caramel 🐴');
  assert.equal(n.tag, 'caramel-daily');
  const msgs = vm.runInContext('MSGS', s.ctx);
  assert.ok(msgs.length >= 5 && msgs.includes(n.body));
  for (const m of msgs) {
    assert.ok(!/ [!?;:]/.test(m), 'espace fine insécable avant ! ? ; : → ' + m);
    assert.ok(!m.includes("'"), 'apostrophe typographique → ' + m);
    assert.ok(!/course de Caramel/.test(m));
  }
  let closed = false;
  await s.dispatch('notificationclick', { notification: { close() { closed = true; } } });
  assert.ok(closed);
  assert.deepEqual(s.calls.opened, ['./']);
  s.ctx._windows = [{ focus() { s.calls.focus++; } }];
  await s.dispatch('notificationclick', { notification: { close() {} } });
  assert.equal(s.calls.focus, 1);
});

test('voix enregistrée (v2.2.2) : clips hors précache, cache dédié caramel-voix-v1, hors ligne → 503', async () => {
  const assets = assetsInSw();
  assert.ok(!assets.some(f => f.startsWith('audio/')), 'aucun clip dans ASSETS (budget du précache)');
  const v = readVersion(root);
  const clip = SCOPE + 'audio/voix/n7.mp3?v=0123abcd';
  const s = loadSw({ net: async url => { const r = new Response('mp3:' + url, { status: 200 }); Object.defineProperty(r, 'type', { value: 'basic' }); return r; } });
  await s.dispatch('install');
  const n = s.calls.fetches.length;
  assert.equal(await (await s.get(clip, 'cors')).text(), 'mp3:' + clip);
  assert.equal(s.calls.fetches.length, n + 1, 'premier passage : réseau');
  assert.ok(s.store.get('caramel-voix-v1').has(clip), 'rangé dans caramel-voix-v1');
  assert.ok(!s.store.get('caramel-' + v).has(clip), 'jamais dans le cache versionné (vidé aux mises à jour)');
  assert.equal(await (await s.get(clip, 'cors')).text(), 'mp3:' + clip);
  assert.equal(s.calls.fetches.length, n + 1, 'ensuite : servi par le cache, sans réseau');
  /* une nouvelle version du texte (autre empreinte) est un autre clip */
  await s.get(SCOPE + 'audio/voix/n7.mp3?v=feedbeef', 'cors');
  assert.equal(s.calls.fetches.length, n + 2);
  /* hors ligne : clip jamais entendu → 503 (la page prend la voix du téléphone) ; erreur et réponse partielle jamais gardées */
  const off = loadSw({ net: async () => { throw new TypeError('hors ligne'); } });
  const r = await off.get(clip, 'cors');
  assert.equal(r.status, 503);
  const bad = loadSw({ net: async () => new Response('', { status: 404 }) });
  await bad.get(clip, 'cors');
  assert.ok(!bad.store.get('caramel-voix-v1') || !bad.store.get('caramel-voix-v1').has(clip), '404 jamais mis en cache');
  const part = loadSw({ net: async () => { const x = new Response('x', { status: 206 }); Object.defineProperty(x, 'type', { value: 'basic' }); return x; } });
  await part.get(clip, 'cors');
  assert.ok(!part.store.get('caramel-voix-v1').has(clip), 'réponse partielle (206) jamais mise en cache');
});

test('pages publiques (v2.2.4) : précachées, servies hors ligne à la navigation ; les autres pages restent au réseau', async () => {
  const assets = assetsInSw(), v = readVersion(root);
  const pages = ['pages/confidentialite.html', 'pages/mentions-legales.html', 'pages/aide.html', 'pages/licences.html', 'pages/pages.css', 'pages/pages.js'];
  for (const f of pages) assert.ok(listAssets(root).includes(f), 'précache : ' + f);
  assert.ok(!listAssets(root).some(f => f.startsWith('store/')), 'jamais les visuels ni les captures des stores');
  let offline = false;
  const s = loadSw({ net: async url => {
    if (offline) throw new TypeError('hors ligne');
    const r = new Response('réseau:' + url, { status: 200 }); Object.defineProperty(r, 'type', { value: 'basic' }); return r;
  } });
  /* précache simulé à partir de la liste réelle (sw.js peut être en attente de régénération) */
  const cache = await s.ctx.caches.open('caramel-' + v);
  for (const f of new Set([...assets, ...pages])) await cache.put(SCOPE + f, new Response('cache:' + f, { status: 200 }));
  offline = true;
  assert.equal(await (await s.get(SCOPE + 'pages/aide.html', 'navigate')).text(), 'cache:pages/aide.html');
  assert.equal(await (await s.get(SCOPE + 'pages/confidentialite.html', 'navigate')).text(), 'cache:pages/confidentialite.html');
  assert.equal(await s.get(SCOPE + 'tests/harness/speech.html', 'navigate'), null, 'bancs d’essai : réseau normal');
  assert.equal(await s.get(SCOPE + 'store/README.md', 'navigate'), null);
});
