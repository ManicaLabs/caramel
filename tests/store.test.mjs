/* Store : singleton caramel-v3 (contrat §4) — chargement via migrate, persistance JSON, abonnés. */
import { test, assert, memoryStorage } from './_t.mjs';
import * as store from '../js/core/store.js';
import { KEY, V11, V1, BACKUP } from '../js/core/migrate.js';
import { defaultProfile } from '../js/core/profiles.js';

const TODAY = '2026-10-02';
const saved = st => JSON.parse(st.getItem(KEY));
const kid = (name, extra = {}) => Object.assign(defaultProfile({ name, classe: 'CM2', today: TODAY }), extra);

test('store : installation neuve → aucun profil, données persistées', () => {
  const st = memoryStorage();
  const { data, report } = store.init(st, TODAY);
  assert.equal(report.from, 'none');
  assert.equal(store.getData(), data);
  assert.deepEqual(data.profiles, {});
  assert.equal(store.getProfile(), null);
  assert.deepEqual(store.listProfiles(), []);
  assert.equal(store.storageOk(), true);
  assert.deepEqual(saved(st), data);
});

test('store : addProfile → copie normalisée, active, persistée', () => {
  const st = memoryStorage();
  store.init(st, TODAY);
  const src = kid(' {Zoé} ');
  const id = store.addProfile(src);
  assert.equal(id, 'p1');
  const p = store.getProfile();
  assert.equal(p.id, 'p1');
  assert.equal(p.name, 'Zoé');
  assert.notEqual(p, src, 'le store garde sa propre copie');
  assert.equal(store.getProfile('p1'), p);
  assert.equal(store.getData().active, 'p1');
  assert.equal(saved(st).profiles.p1.name, 'Zoé');
  assert.equal(saved(st).active, 'p1');
  /* deuxième enfant : p2, devient actif ; un id déjà pris est remplacé */
  const id2 = store.addProfile(kid('Lou', { id: 'p1' }));
  assert.equal(id2, 'p2');
  assert.equal(store.getData().active, 'p2');
  assert.equal(store.getProfile().name, 'Lou');
  assert.equal(store.addProfile(kid('Noé', { id: 'p7' })), 'p7', 'id libre au bon format : conservé');
  assert.equal(store.addProfile(kid('Ana')), 'p8');
  assert.equal(store.addProfile(null), 'p9');
  assert.equal(store.getProfile('p9').name, 'Léa');
});

test('store : listProfiles trié par date de création, setActive', () => {
  const st = memoryStorage();
  store.init(st, TODAY);
  store.addProfile(kid('Lou', { created: '2026-10-02' }));
  store.addProfile(kid('Zoé', { created: '2026-09-01' }));
  store.addProfile(kid('Ana', { created: '2026-10-02' }));
  assert.deepEqual(store.listProfiles().map(p => p.name), ['Zoé', 'Lou', 'Ana']);
  assert.equal(store.setActive('p1'), true);
  assert.equal(store.getProfile().name, 'Lou');
  assert.equal(saved(st).active, 'p1');
  assert.equal(store.setActive('p42'), false);
  assert.equal(store.setActive(null), false);
  assert.equal(store.getData().active, 'p1');
  assert.equal(store.getProfile(null), null);
  assert.equal(store.getProfile('p42'), null);
  assert.equal(store.getProfile('constructor'), null);
});

test('store : mutateProfile → persiste, notifie, renvoie le résultat', () => {
  const st = memoryStorage();
  store.init(st, TODAY);
  store.addProfile(kid('Zoé'));
  store.addProfile(kid('Lou'));
  const calls = [];
  const off = store.subscribe(d => calls.push(d));
  const r = store.mutateProfile(p => { p.wallet.apples += 5; return 'ok'; });
  assert.equal(r, 'ok');
  assert.equal(calls.length, 1);
  assert.equal(calls[0], store.getData());
  assert.equal(saved(st).profiles.p2.wallet.apples, 5);
  store.mutateProfile(p => { p.wallet.apples = 12; }, 'p1');
  assert.equal(saved(st).profiles.p1.wallet.apples, 12);
  assert.equal(calls.length, 2);
  /* profil inexistant : rien, pas de notification */
  assert.equal(store.mutateProfile(() => 'jamais', 'p42'), undefined);
  assert.equal(calls.length, 2);
  /* mutate : données entières */
  assert.equal(store.mutate(d => Object.keys(d.profiles).length), 2);
  assert.equal(calls.length, 3);
  off();
  store.mutateProfile(p => { p.wallet.apples++; });
  assert.equal(calls.length, 3, 'désabonné');
  assert.equal(typeof store.subscribe('pas une fonction'), 'function');
});

test('store : une exception dans fn est relancée, le changement partiel est persisté', () => {
  const st = memoryStorage();
  store.init(st, TODAY);
  store.addProfile(kid('Zoé'));
  assert.throws(() => store.mutateProfile(p => { p.wallet.apples = 3; throw new Error('bug'); }), /bug/);
  assert.equal(saved(st).profiles.p1.wallet.apples, 3);
  assert.throws(() => store.mutate(() => { throw new Error('bug2'); }), /bug2/);
});

test('store : abonnés robustes (erreur isolée, commit pendant une notification)', () => {
  const st = memoryStorage();
  store.init(st, TODAY);
  store.addProfile(kid('Zoé'));
  const err = console.error;
  console.error = () => {};
  try {
    let seen = 0, nested = 0;
    const offs = [
      store.subscribe(() => { throw new Error('abonné en panne'); }),
      store.subscribe(() => { seen++; }),
      store.subscribe(() => { if (nested++ === 0) store.mutateProfile(p => { p.wallet.apples = 99; }); })
    ];
    store.commit();
    assert.equal(seen, 2, 'second tour après le commit imbriqué');
    assert.equal(saved(st).profiles.p1.wallet.apples, 99);
    offs.forEach(f => f());
  } finally { console.error = err; }
});

test('store : removeProfile → l’actif passe au premier profil restant', () => {
  const st = memoryStorage();
  store.init(st, TODAY);
  store.addProfile(kid('Zoé', { created: '2026-09-01' }));
  store.addProfile(kid('Lou', { created: '2026-09-05' }));
  store.addProfile(kid('Ana', { created: '2026-09-03' }));
  assert.equal(store.getData().active, 'p3');
  assert.equal(store.removeProfile('p3'), true);
  assert.equal(store.getData().active, 'p1');
  assert.equal(store.removeProfile('p2'), true);
  assert.equal(store.getData().active, 'p1', 'actif inchangé');
  assert.equal(store.removeProfile('p42'), false);
  store.removeProfile('p1');
  assert.equal(store.getData().active, null);
  assert.equal(store.getProfile(), null);
  assert.deepEqual(saved(st).profiles, {});
  assert.equal(store.addProfile(kid('Noé')), 'p1');
});

test('store : replaceData → données normalisées ; import invalide refusé', () => {
  const st = memoryStorage();
  store.init(st, TODAY);
  store.addProfile(kid('Zoé'));
  const before = st.getItem(KEY);
  for (const bad of [null, 42, 'texte', [], { profiles: [] }, { profiles: 'x' }, {}]) {
    assert.equal(store.replaceData(bad), false, JSON.stringify(bad));
  }
  assert.equal(st.getItem(KEY), before);
  const ok = store.replaceData({ schema: 3, active: 'p9', profiles: {
    p2: { name: 'Lou', created: '2026-09-01', companion: { type: 'dragon', equip: { owned: ['selle'], worn: ['selle', 'selle'] } } },
    p5: { name: 'Ana', created: '2026-09-02' }
  } });
  assert.equal(ok, true);
  const d = store.getData();
  assert.equal(d.active, 'p2');
  assert.deepEqual(Object.keys(d.profiles), ['p2', 'p5']);
  assert.deepEqual(d.profiles.p2.companion.owned, ['pony', 'dragon']);
  assert.deepEqual(d.profiles.p2.companion.equip.worn, ['selle']);
  assert.equal(saved(st).profiles.p5.name, 'Ana');
  assert.equal(store.addProfile(kid('Noé')), 'p6');
});

test('store : démarrage sur une sauvegarde v11 → profil migré, puis rechargement identique', () => {
  const rawV11 = JSON.stringify({ stars: { pomme: 3, foret: 2 }, apples: 42, streak: { count: 5, last: '2026-10-01' },
    hero: { name: 'Zoé', g: 'f' }, mount: { type: 'cat', name: 'Moustache', owned: ['pony', 'cat'] },
    equip: { owned: ['noeud'], worn: ['noeud'] }, pet: { faim: 70, forme: 60, joie: 90, last: 1759330000000, brushLast: 0, walkDay: '' } });
  const st = memoryStorage({ [V11]: rawV11 });
  const { report } = store.init(st, TODAY);
  assert.equal(report.from, 'v11');
  const p = store.getProfile();
  assert.equal(p.name, 'Zoé');
  assert.equal(p.companion.type, 'cat');
  assert.equal(p.wallet.apples, 42);
  assert.equal(p.classe, null, 'écran de bienvenue : classe à choisir');
  store.mutateProfile(q => { q.wallet.apples += 8; });
  /* redémarrage de l'app */
  const again = store.init(st, '2026-10-03');
  assert.equal(again.report.from, 'v3');
  assert.equal(again.report.wrote, false);
  assert.equal(store.getProfile().wallet.apples, 50);
  assert.equal(st.getItem(V11), rawV11, 'ancienne clé intacte');
  assert.equal(st.getItem(V1), null);
  assert.ok(st.getItem(BACKUP));
});

test('store : écriture impossible (quota, navigation privée) → l’app continue en mémoire', () => {
  const st = memoryStorage();
  st.setItem = () => { throw new Error('QuotaExceededError'); };
  const { report } = store.init(st, TODAY);
  assert.equal(report.wrote, false);
  assert.equal(store.storageOk(), true, 'pas encore d’échec constaté par le store');
  const id = store.addProfile(kid('Zoé'));
  assert.equal(store.storageOk(), false);
  assert.equal(store.getProfile(id).name, 'Zoé');
  assert.equal(store.mutateProfile(p => { p.wallet.apples = 7; return p.wallet.apples; }), 7);
  assert.equal(store.getProfile().wallet.apples, 7);
  assert.equal(store.commit(), false);
  /* aucun stockage du tout */
  store.init(null, TODAY);
  assert.equal(store.storageOk(), false);
  assert.equal(store.addProfile(kid('Lou')), 'p1');
  assert.equal(store.getProfile().name, 'Lou');
});

test('store : stockage illisible au démarrage → aucune écriture (rien n’est écrasé)', () => {
  const writes = [];
  const broken = { getItem() { throw new Error('NS_ERROR_FILE_CORRUPTED'); }, setItem(k) { writes.push(k); } };
  const { report } = store.init(broken, TODAY);
  assert.equal(report.readOnly, true);
  store.addProfile(kid('Zoé'));
  store.mutateProfile(p => { p.wallet.apples = 3; });
  assert.deepEqual(writes, []);
  assert.equal(store.storageOk(), false);
  assert.equal(store.getProfile().wallet.apples, 3);
});

test('store : appel avant init → données vides en mémoire, sans exception', async () => {
  const fresh = await import('../js/core/store.js?avant-init');
  assert.deepEqual(fresh.getData().profiles, {});
  assert.equal(fresh.getProfile(), null);
  assert.equal(fresh.commit(), false);
  assert.equal(fresh.storageOk(), false);
  assert.equal(fresh.addProfile(kid('Zoé')), 'p1');
});
