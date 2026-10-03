/* Migration v1 / v11 → caramel-v3 (contrat §3, CDC §13.3).
   Les sauvegardes v11 sont FABRIQUÉES avec une copie des fonctions v11 (defaultSave, persist,
   bumpStreak, finishExercise, shopTap, mountTap, sanitizeName — index.html @ c5bd8d1) :
   même structure, mêmes types, même ordre de clés que sur les téléphones. Prénoms fictifs. */
import { test, assert, memoryStorage } from './_t.mjs';
import { migrate, buildFromLegacy, estimateFluence, emptyData, normalizeData,
         KEY, V11, V1, BACKUP, CORRUPT, LEGACY_TARGETS } from '../js/core/migrate.js';
import { MOUNTS, SHOP } from '../js/content/companion-data.js';
import { tplMap } from '../js/core/profiles.js';
import { bumpStreak, totalStars } from '../js/core/economy.js';
import { addDays } from '../js/core/util.js';

const TODAY = '2026-10-02';

/* ---------- copie de la v11 (sans DOM ni sons) ---------- */
function defaultSave(now) {
  return { stars:{}, apples:0, streak:{ count:0, last:'' },
    hero:{ name:'Léa', g:'f' },
    mount:{ type:'pony', name:'Caramel', owned:['pony'] },
    equip:{ owned:[], worn:[] },
    pet:{ faim:80, forme:80, joie:80, last:now, brushLast:0, walkDay:'' } };
}
const persist = save => JSON.stringify(save);
function bumpStreakV11(save, today) {
  if (save.streak.last === today) return 0;
  save.streak.count = (save.streak.last === addDays(today, -1)) ? save.streak.count + 1 : 1;
  save.streak.last = today;
  let bonus = 10;
  if (save.streak.count % 7 === 0) bonus += 50;
  save.apples += bonus;
  return bonus;
}
/* économie de finishExercise : meilleur score, étoiles × 10 🍎, série du jour */
function finishRace(save, id, stars, today) {
  save.stars[id] = Math.max(save.stars[id] || 0, stars);
  save.apples += stars * 10;
  bumpStreakV11(save, today);
}
function shopTap(save, id) {
  const it = SHOP.find(o => o.id === id);
  if (!it) return;
  if (!save.equip.owned.includes(id)) {
    if (save.apples < it.price) return;
    save.apples -= it.price;
    save.equip.owned.push(id);
  }
  if (save.equip.worn.includes(id)) {
    save.equip.worn = save.equip.worn.filter(x => x !== id);
  } else {
    save.equip.worn = save.equip.worn.filter(x => { const o = SHOP.find(s => s.id === x); return o && o.slot !== it.slot; });
    save.equip.worn.push(id);
  }
}
function mountTap(save, t) {
  const m = MOUNTS[t];
  if (!save.mount.owned.includes(t)) {
    if (save.apples < m.price) return;
    save.apples -= m.price;
    save.mount.owned.push(t);
  }
  save.mount.type = t;
}
function sanitizeNameV11(v, fallback) {
  const s = String(v || '').replace(/[{}]/g, '').trim().slice(0, 14);
  return s || fallback;
}
const ORDER = Object.keys(LEGACY_TARGETS);          /* ordre des histoires v11 */

/* licorne équipée couronne + ailes, série de 12 jours (dernier jour = hier) */
function licorneSave() {
  const save = defaultSave(Date.parse('2026-09-20T17:00:00'));
  save.hero.name = sanitizeNameV11('  Zoé ', 'Léa');
  for (let i = 0; i < 12; i++) {
    const day = addDays('2026-09-20', i);
    finishRace(save, ORDER[2 * i], 3, day);
    finishRace(save, ORDER[2 * i + 1], i % 2 ? 2 : 3, day);
    if (i === 4) finishRace(save, ORDER[2 * i], 2, day);   /* revanche moins bonne : le meilleur score reste */
  }
  mountTap(save, 'horse');
  mountTap(save, 'unicorn');
  save.mount.name = sanitizeNameV11('Paillette', MOUNTS.unicorn.label);
  shopTap(save, 'chapeau');
  shopTap(save, 'couronne');                        /* remplace le chapeau (même emplacement) */
  shopTap(save, 'ailes');
  save.pet = { faim: 57.291666666666664, forme: 61.80555555555556, joie: 93.5,
               last: Date.parse('2026-10-01T18:12:00'), brushLast: Date.parse('2026-10-01T18:10:00'), walkDay: '2026-10-01' };
  return save;
}
/* petit cavalier CE1 : cheval, foulard, série de 3 jours terminée le 28/09 */
function chevalSave() {
  const save = defaultSave(Date.parse('2026-09-26T08:00:00'));
  save.hero = { name: sanitizeNameV11('Timéo', 'Léa'), g: 'm' };
  ['2026-09-26', '2026-09-27', '2026-09-28'].forEach((day, i) => {
    finishRace(save, ORDER[i], i === 1 ? 2 : 3, day);
    finishRace(save, ORDER[i + 1], 1, day);
  });
  mountTap(save, 'horse');
  save.mount.name = sanitizeNameV11('Tonnerre', 'Cheval');
  shopTap(save, 'foulard');
  return save;
}

const snapshot = st => Object.fromEntries(st._map);
function spyWrites(st) {
  const writes = [];
  const set = st.setItem, rm = st.removeItem;
  st.setItem = (k, v) => { writes.push(k); set(k, v); };
  st.removeItem = k => { writes.push('-' + k); rm(k); };
  return writes;
}
const backupOf = st => JSON.parse(st.getItem(BACKUP));

/* ---------- fixtures obligatoires ---------- */
test('migration : stockage vide → installation neuve, aucune sauvegarde de secours', () => {
  const st = memoryStorage();
  const { data, report } = migrate(st, TODAY);
  assert.deepEqual(report, { from: 'none', backedUp: false, wrote: true });
  assert.deepEqual(data, emptyData(TODAY));
  assert.equal(data.active, null);
  assert.equal(data.migratedFrom, null);
  assert.deepEqual(JSON.parse(st.getItem(KEY)), data);
  assert.equal(st.getItem(BACKUP), null);
  assert.deepEqual(Object.keys(snapshot(st)), [KEY]);
});

test('migration : v1 seul → étoiles reprises, 10 🍎 par étoile, +1 gel, classe à choisir', () => {
  const rawV1 = JSON.stringify({ stars: { pomme: 3, foret: 2, cirque: 3, plage: 1, feuilles: 5, neige: 0 } });
  const st = memoryStorage({ [V1]: rawV1, 'caramel-notifs': 'on' });
  const { data, report } = migrate(st, TODAY);
  assert.deepEqual(report, { from: 'v1', backedUp: true, wrote: true });
  assert.equal(data.migratedFrom, 'v1');
  assert.equal(data.active, 'p1');
  const p = data.profiles.p1;
  assert.deepEqual(p.wallet.stars, { pomme: 3, foret: 2, cirque: 3, plage: 1, feuilles: 3, neige: 0 });
  assert.equal(p.wallet.apples, (3 + 2 + 3 + 1 + 3) * 10);       /* Σ min(3, ⭐) × 10 */
  assert.equal(p.classe, null);
  assert.equal(p.name, 'Léa');
  assert.equal(p.g, 'f');
  assert.equal(p.companion.type, 'pony');
  assert.equal(p.companion.name, 'Caramel');
  assert.deepEqual(p.streak, { count: 0, last: '', freezes: 1, freezeWeek: '' });
  assert.deepEqual(p.legacy, { from: 'v1', mclm: 52, stars: 12 });   /* feuilles (52) à 3 ⭐ */
  assert.deepEqual(p.skills, {});
  /* copie brute + anciennes clés intactes */
  assert.deepEqual(backupOf(st), { savedAt: TODAY, [V11]: null, [V1]: rawV1 });
  assert.equal(st.getItem(V1), rawV1);
  assert.equal(st.getItem(V11), null);
  assert.equal(st.getItem('caramel-notifs'), 'on');
});

test('migration : v11 seul → pommes, étoiles, monture, foulard, jauges, série +1 gel', () => {
  const save = chevalSave();
  const raw = persist(save);
  const st = memoryStorage({ [V11]: raw });
  const { data, report } = migrate(st, TODAY);
  assert.deepEqual(report, { from: 'v11', backedUp: true, wrote: true });
  const p = data.profiles.p1;
  assert.equal(p.name, 'Timéo');
  assert.equal(p.g, 'm');
  assert.equal(p.wallet.apples, save.apples);
  assert.ok(p.wallet.apples > 0);
  assert.deepEqual(p.wallet.stars, save.stars);
  assert.equal(totalStars(p), 3 + 2 + 3 + 1);          /* ce1-bain : 1 ⭐ puis 2 ⭐ → meilleur score = 2 */
  assert.equal(p.companion.type, 'horse');
  assert.equal(p.companion.name, 'Tonnerre');
  assert.deepEqual(p.companion.owned, ['pony', 'horse']);
  assert.deepEqual(p.companion.equip, { owned: ['foulard'], worn: ['foulard'] });
  assert.deepEqual(p.companion.pet, save.pet);
  assert.deepEqual(p.streak, { count: 3, last: '2026-09-28', freezes: 1, freezeWeek: '' });
  assert.equal(p.classe, null);
  assert.equal(p.legacy.from, 'v11');
  assert.equal(p.legacy.stars, 9);
  assert.equal(p.legacy.mclm, LEGACY_TARGETS[ORDER[2]]);  /* plus difficile à 3 ⭐ : ce1-verger (36) */
  assert.equal(st.getItem(V11), raw);
  assert.equal(backupOf(st)[V11], raw);
});

test('migration : v1 + v11 → la v11 fait foi (elle avait déjà migré v1)', () => {
  const rawV1 = JSON.stringify({ stars: { pomme: 3, foret: 3, cirque: 2 } });
  const save = defaultSave(Date.parse('2026-06-01T10:00:00'));
  /* loadSave v11 : reprise des étoiles v1 + rétro-crédit, puis du jeu */
  save.stars = JSON.parse(rawV1).stars;
  save.apples = 80;
  finishRace(save, 'plage', 3, '2026-06-01');
  shopTap(save, 'lunettes');
  const rawV11 = persist(save);
  const st = memoryStorage({ [V1]: rawV1, [V11]: rawV11 });
  const { data, report } = migrate(st, TODAY);
  assert.equal(report.from, 'v11');
  const p = data.profiles.p1;
  assert.equal(p.wallet.apples, save.apples);           /* pas de second rétro-crédit v1 */
  assert.deepEqual(p.wallet.stars, { pomme: 3, foret: 3, cirque: 2, plage: 3 });
  assert.deepEqual(p.companion.equip.worn, ['lunettes']);
  assert.deepEqual(p.streak, { count: 1, last: '2026-06-01', freezes: 1, freezeWeek: '' });
  assert.deepEqual(backupOf(st), { savedAt: TODAY, [V11]: rawV11, [V1]: rawV1 });
  assert.equal(st.getItem(V1), rawV1);
  assert.equal(st.getItem(V11), rawV11);
});

test('migration : v11 corrompu + v1 valide → reprise depuis v1, brut corrompu sauvegardé', () => {
  const rawV11 = '{"stars":{"pomme":3,"foret":2},"apples":1';          /* JSON tronqué */
  const rawV1 = JSON.stringify({ stars: { pomme: 3, foret: 2 } });
  const st = memoryStorage({ [V11]: rawV11, [V1]: rawV1 });
  const { data, report } = migrate(st, TODAY);
  assert.deepEqual(report, { from: 'v1', backedUp: true, wrote: true });
  const p = data.profiles.p1;
  assert.equal(p.wallet.apples, 50);
  assert.deepEqual(p.wallet.stars, { pomme: 3, foret: 2 });
  assert.equal(p.streak.freezes, 1);
  assert.deepEqual(backupOf(st), { savedAt: TODAY, [V11]: rawV11, [V1]: rawV1 });
  assert.equal(st.getItem(V11), rawV11);
  assert.equal(st.getItem(V1), rawV1);
});

test('migration : v11 corrompu sans v1 → profil vierge « v11-corrompu », brut conservé', () => {
  for (const rawV11 of ['{"stars":{"pomme":3}', 'null', '[1,2]', '"texte"', '']) {
    const st = memoryStorage({ [V11]: rawV11 });
    const { data, report } = migrate(st, TODAY);
    assert.equal(report.from, 'v11-corrompu', rawV11);
    assert.equal(data.migratedFrom, 'v11-corrompu');
    assert.equal(data.active, 'p1');
    const p = data.profiles.p1;
    assert.equal(p.wallet.apples, 0);
    assert.deepEqual(p.wallet.stars, {});
    assert.equal(p.legacy, null);
    assert.equal(p.classe, null);
    assert.equal(p.streak.freezes, 1);
    assert.equal(backupOf(st)[V11], rawV11);
    assert.equal(st.getItem(V11), rawV11);
  }
});

test('migration : v11 licorne équipée (couronne + ailes), série de 12 jours', () => {
  const save = licorneSave();
  const raw = persist(save);
  const st = memoryStorage({ [V11]: raw });
  const { data, report } = migrate(st, TODAY);
  assert.equal(report.from, 'v11');
  const p = data.profiles.p1;
  /* pommes et étoiles */
  assert.equal(p.wallet.apples, save.apples);
  assert.ok(save.apples >= 0 && save.mount.owned.includes('unicorn'), 'la fixture a bien acheté la licorne');
  assert.deepEqual(p.wallet.stars, save.stars);
  assert.equal(Object.keys(p.wallet.stars).length, 24);
  assert.equal(p.wallet.stars[ORDER[8]], 3, 'meilleur score conservé malgré la revanche');
  /* monture et accessoires */
  assert.equal(p.companion.type, 'unicorn');
  assert.equal(p.companion.name, 'Paillette');
  assert.deepEqual(p.companion.owned, ['pony', 'horse', 'unicorn']);
  assert.deepEqual(p.companion.equip.owned, ['chapeau', 'couronne', 'ailes']);
  assert.deepEqual(p.companion.equip.worn, ['couronne', 'ailes']);
  /* jauges : valeurs v11 exactes (la décroissance se calcule depuis pet.last) */
  assert.deepEqual(p.companion.pet, save.pet);
  /* série : 12 jours, +1 gel */
  assert.deepEqual(p.streak, { count: 12, last: '2026-10-01', freezes: 1, freezeWeek: '' });
  /* héros et accords */
  assert.equal(p.name, 'Zoé');
  assert.equal(p.g, 'f');
  const map = tplMap(p);
  assert.equal(map.SonM, 'Sa licorne');
  assert.equal(map.contentM, 'contente');
  /* fluence estimée : plus difficile histoire à 3 ⭐ */
  const best3 = Math.max(...Object.entries(save.stars).filter(([, v]) => v >= 3).map(([id]) => LEGACY_TARGETS[id]));
  assert.deepEqual(p.legacy, { from: 'v11', mclm: best3, stars: totalStars(p) });
  /* la série continue le lendemain de la migration */
  const r = bumpStreak(p, TODAY);
  assert.deepEqual(r, { bonus: 10, count: 13, usedFreeze: false });
});

test('migration : caramel-v3 déjà présent → aucune réécriture', () => {
  const st = memoryStorage({ [V11]: persist(licorneSave()) });
  const first = migrate(st, TODAY);
  const before = snapshot(st);
  const writes = spyWrites(st);
  const second = migrate(st, '2026-10-05');
  assert.deepEqual(second.report, { from: 'v3', backedUp: false, wrote: false });
  assert.deepEqual(writes, []);
  assert.deepEqual(second.data, first.data);
  assert.deepEqual(snapshot(st), before);
});

test('migration : double exécution → idempotente, backup inchangé, anciennes clés intactes', () => {
  const rawV1 = JSON.stringify({ stars: { pomme: 2 } });
  const rawV11 = persist(chevalSave());
  const st = memoryStorage({ [V1]: rawV1, [V11]: rawV11, 'caramel-notifs': 'later' });
  const a = migrate(st, TODAY);
  const after1 = snapshot(st);
  const b = migrate(st, TODAY);
  const after2 = snapshot(st);
  assert.equal(a.report.from, 'v11');
  assert.equal(b.report.from, 'v3');
  assert.equal(b.report.wrote, false);
  assert.deepEqual(after2, after1);
  assert.equal(after2[BACKUP], after1[BACKUP]);
  assert.equal(after2[V1], rawV1);
  assert.equal(after2[V11], rawV11);
  assert.equal(after2['caramel-notifs'], 'later');
  assert.deepEqual(b.data, a.data);
  /* une 3e migration après effacement de v3 ne réécrit pas le backup */
  st.removeItem(KEY);
  const writes = spyWrites(st);
  const c = migrate(st, '2026-11-15');
  assert.equal(c.report.backedUp, false);
  assert.ok(!writes.includes(BACKUP));
  assert.equal(st.getItem(BACKUP), after1[BACKUP]);
  assert.equal(JSON.parse(st.getItem(BACKUP)).savedAt, TODAY);
});

/* ---------- tolérance de loadSave() v11 ---------- */
test('migration : tolérance v11 (valeurs par défaut, |0, owned vide, type inconnu, ids filtrés)', () => {
  const raw = JSON.stringify({
    stars: { pomme: '3', foret: 2.9, cirque: -1, plage: 7 }, apples: '245.8',
    mount: { type: 'licorne', owned: [], name: '{Ju}{les}' },
    equip: { owned: ['couronne', 'chapeau', 'cape', 'ailes'], worn: ['chapeau', 'couronne', 'cape', 'noeud'] },
    pet: { faim: 3, joie: 140, forme: 'abc', walkDay: 12 }
  });
  const p = migrate(memoryStorage({ [V11]: raw }), TODAY).data.profiles.p1;
  assert.equal(p.wallet.apples, 245);
  assert.deepEqual(p.wallet.stars, { pomme: 3, foret: 2, cirque: 0, plage: 3 });
  assert.equal(p.name, 'Léa');                               /* hero absent → défaut v11 */
  assert.equal(p.g, 'f');
  assert.equal(p.companion.type, 'pony');                    /* type inconnu → pony */
  assert.deepEqual(p.companion.owned, ['pony']);             /* owned vide → ['pony'] */
  assert.equal(p.companion.name, 'Jules');
  assert.deepEqual(p.companion.equip.owned, ['couronne', 'chapeau', 'ailes']);
  assert.deepEqual(p.companion.equip.worn, ['couronne']);    /* 1 seul objet par emplacement, ⊆ owned */
  assert.deepEqual(p.companion.pet, { faim: 15, forme: 80, joie: 100, last: 0, brushLast: 0, walkDay: '' });
  assert.deepEqual(p.streak, { count: 0, last: '', freezes: 1, freezeWeek: '' });
});

test('migration : v11 avec seulement des étoiles et un héros garçon', () => {
  const raw = JSON.stringify({ stars: { 'cm1-orage': 2, reve: 2 }, hero: { name: 'Noé', g: 'm' } });
  const p = migrate(memoryStorage({ [V11]: raw }), TODAY).data.profiles.p1;
  assert.equal(p.name, 'Noé');
  assert.equal(p.g, 'm');
  assert.equal(p.wallet.apples, 0);                          /* pas de rétro-crédit pour une v11 */
  assert.equal(p.legacy.mclm, Math.round(0.85 * 78));        /* aucune 3 ⭐ : 0,85 × max des 2 ⭐ */
});

test('estimateFluence : 3 ⭐ → cible max ; sinon 0,85 × max des 2 ⭐ ; sinon null', () => {
  assert.equal(estimateFluence({ pomme: 3, 'cm1-aurore': 3, foret: 2 }), 100);
  assert.equal(estimateFluence({ pomme: 3, 'cm1-aurore': 2 }), 40);
  assert.equal(estimateFluence({ 'cm1-phare': 2, reve: 2, pomme: 1 }), Math.round(0.85 * 95));
  assert.equal(estimateFluence({ pomme: 1, foret: 0 }), null);
  assert.equal(estimateFluence({ 'histoire-inconnue': 3 }), null);
  assert.equal(estimateFluence({ pomme: '3' }), 40);
  assert.equal(estimateFluence(null), null);
  assert.equal(estimateFluence({}), null);
});

test('LEGACY_TARGETS : les 27 histoires v11', () => {
  assert.equal(Object.keys(LEGACY_TARGETS).length, 27);
  assert.equal(LEGACY_TARGETS['ce1-carotte'], 30);
  assert.equal(LEGACY_TARGETS.reve, 78);
  assert.equal(LEGACY_TARGETS['cm1-aurore'], 100);
});

test('buildFromLegacy : pur, v11 prioritaire, v1 sinon, profil vierge en dernier recours', () => {
  const v11 = { stars: { pomme: 3 }, apples: 12 };
  const v1 = { stars: { pomme: 3, foret: 3 } };
  assert.equal(buildFromLegacy({ v11, v1, today: TODAY }).profiles.p1.wallet.apples, 12);
  assert.equal(buildFromLegacy({ v1, today: TODAY }).profiles.p1.wallet.apples, 60);
  const blank = buildFromLegacy({ today: TODAY });
  assert.equal(blank.migratedFrom, 'v11-corrompu');
  assert.equal(buildFromLegacy({ v1: {}, today: TODAY, corrupt: 'v1' }).migratedFrom, 'v1-corrompu');
  assert.equal(blank.schema, 3);
  assert.equal(blank.created, TODAY);
  assert.equal(blank.profiles.p1.created, TODAY);
});

/* ---------- robustesse ---------- */
test('migration : v1 présent mais illisible (sans v11) → profil vierge « v1-corrompu »', () => {
  const st = memoryStorage({ [V1]: '{"stars":' });
  const { data, report } = migrate(st, TODAY);
  assert.equal(report.from, 'v1-corrompu');
  assert.equal(data.profiles.p1.wallet.apples, 0);
  assert.equal(backupOf(st)[V1], '{"stars":');
});

test('migration : caramel-v3 illisible → reconstruit depuis la v11, brut v3 conservé', () => {
  const rawV11 = persist(chevalSave());
  const st = memoryStorage({ [V11]: rawV11, [KEY]: '{"schema":3,"profiles":{"p1":' });
  const { data, report } = migrate(st, TODAY);
  assert.equal(report.from, 'v11');
  assert.equal(data.profiles.p1.companion.type, 'horse');
  assert.equal(st.getItem(CORRUPT), '{"schema":3,"profiles":{"p1":');
  assert.equal(JSON.parse(st.getItem(KEY)).profiles.p1.name, 'Timéo');
  /* schéma inconnu : même traitement */
  const st2 = memoryStorage({ [KEY]: JSON.stringify({ schema: 2, foo: 1 }) });
  assert.equal(migrate(st2, TODAY).report.from, 'none');
  assert.equal(st2.getItem(CORRUPT), JSON.stringify({ schema: 2, foo: 1 }));
});

test('migration : caramel-v3 à normaliser → réécrit une fois, puis plus rien', () => {
  const v3 = { schema: 3, active: 'p9', migratedFrom: 'v11', created: TODAY, profiles: {
    p1: { id: 'x', name: 'Zoé', created: '2026-10-01', companion: { type: 'unicorn', equip: { owned: ['couronne'], worn: ['couronne', 'couronne'] } },
          history: Array.from({ length: 510 }, (_, i) => ({ d: TODAY, ax: 'ma.faits', n: 10, ok: i % 10, th: 1.5 })) },
    p2: 'abîmé'
  } };
  const raw = JSON.stringify(v3);
  const st = memoryStorage({ [KEY]: raw });
  const { data, report } = migrate(st, TODAY);
  assert.deepEqual(report, { from: 'v3', backedUp: false, wrote: true });
  assert.equal(data.active, 'p1');                           /* actif inexistant → premier profil */
  assert.deepEqual(Object.keys(data.profiles), ['p1']);
  const p = data.profiles.p1;
  assert.equal(p.id, 'p1');
  assert.deepEqual(p.companion.owned, ['pony', 'unicorn']);
  assert.deepEqual(p.companion.equip.worn, ['couronne']);
  assert.equal(p.history.length, 500);
  assert.equal(p.history[0].ok, 0);                          /* les 10 plus anciennes ont été retirées */
  assert.equal(st.getItem(CORRUPT), raw);                    /* un profil illisible a disparu : brut conservé */
  const writes = spyWrites(st);
  assert.equal(migrate(st, TODAY).report.wrote, false);
  assert.deepEqual(writes, []);
});

test('migration : stockage absent ou en panne → jamais d’exception', () => {
  /* aucun stockage */
  const a = migrate(null, TODAY);
  assert.equal(a.report.from, 'none');
  assert.equal(a.report.wrote, false);
  assert.deepEqual(a.data, emptyData(TODAY));
  /* écriture impossible (quota, navigation privée) : données construites en mémoire */
  const st = memoryStorage({ [V11]: persist(licorneSave()) });
  st.setItem = () => { throw new Error('QuotaExceededError'); };
  const b = migrate(st, TODAY);
  assert.equal(b.report.from, 'v11');
  assert.equal(b.report.wrote, false);
  assert.equal(b.report.backedUp, false);
  assert.equal(b.data.profiles.p1.companion.type, 'unicorn');
  /* lecture impossible : rien n'est écrit, lecture seule signalée */
  const writes = [];
  const broken = { getItem() { throw new Error('NS_ERROR_FILE_CORRUPTED'); }, setItem(k) { writes.push(k); } };
  const c = migrate(broken, TODAY);
  assert.equal(c.report.readOnly, true);
  assert.equal(c.report.wrote, false);
  assert.deepEqual(writes, []);
  /* objet stockage farfelu */
  assert.doesNotThrow(() => migrate({}, TODAY));
  assert.doesNotThrow(() => migrate(memoryStorage({ [V11]: '{"stars":"oops","mount":5,"equip":"x","pet":[1]}' }), TODAY));
});

/* erreur imprévue simulée : un accesseur piégé sur Object.prototype fait lever la lecture d'un champ absent */
function withTrap(key, fn) {
  Object.defineProperty(Object.prototype, key, { get() { throw new Error('piège ' + key); }, configurable: true });
  try { return fn(); } finally { delete Object.prototype[key]; }
}
test('migration : filet de sécurité en cas d’erreur imprévue (rien n’est perdu ni écrasé)', () => {
  /* pendant la migration v11 : données vides en lecture seule, ancienne clé intacte, v3 non écrit */
  const rawV11 = JSON.stringify({ apples: 30 });               /* pas de « stars » → accès piégé */
  const st = memoryStorage({ [V11]: rawV11 });
  const r = withTrap('stars', () => migrate(st, TODAY));
  assert.equal(r.report.from, 'erreur');
  assert.equal(r.report.readOnly, true);
  assert.match(r.report.error, /piège stars/);
  assert.deepEqual(r.data, emptyData(TODAY));
  assert.equal(st.getItem(KEY), null, 'v3 non écrit : la migration sera retentée');
  assert.equal(st.getItem(V11), rawV11);
  assert.equal(migrate(st, TODAY).report.from, 'v11', 'au démarrage suivant, tout rentre dans l’ordre');
  /* pendant la normalisation d'un v3 lisible : servi tel quel, brut conservé */
  const v3 = JSON.stringify({ schema: 3, active: 'p1', profiles: { p1: { id: 'p1', name: 'Zoé' } } });
  const st2 = memoryStorage({ [KEY]: v3 });
  const r2 = withTrap('evals', () => migrate(st2, TODAY));
  assert.equal(r2.report.from, 'erreur');
  assert.equal(r2.report.readOnly, undefined);
  assert.equal(r2.data.profiles.p1.name, 'Zoé');
  assert.equal(st2.getItem(KEY), v3);
  assert.equal(st2.getItem(CORRUPT), v3);
});

test('normalizeData : enveloppe v3 complétée, clés inconnues conservées', () => {
  const d = normalizeData({ profiles: { p2: { name: 'Lou', created: '2026-09-01' }, p1: { name: 'Zoé', created: '2026-09-03' } }, extra: { a: 1 } }, TODAY);
  assert.equal(d.schema, 3);
  assert.equal(d.active, 'p2');                              /* le plus ancien */
  assert.equal(d.migratedFrom, null);
  assert.equal(d.created, TODAY);
  assert.deepEqual(d.extra, { a: 1 });
  assert.deepEqual(normalizeData(d, '2027-01-01'), d);       /* idempotent */
  assert.deepEqual(normalizeData(null, TODAY), emptyData(TODAY));
});
