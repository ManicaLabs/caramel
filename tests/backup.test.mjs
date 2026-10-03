/* Sauvegardes (js/ui/backup.js) : export / import sans perte, refus des fichiers invalides,
   ajout avec nouvel id, remplacement ciblé, fichier caramel-eval (annexe A du CDC). Prénoms fictifs. */
import { test, assert, memoryStorage } from './_t.mjs';
import { exportProfile, exportAll, parseBackup, mergeProfile, replaceAll, findMatch, sameName, evalSummary,
         stashEval, takeStash, SAVE_FORMAT, SAVE_VERSION } from '../js/ui/backup.js';
import { defaultProfile, normalizeProfile } from '../js/core/profiles.js';
import { normalizeData } from '../js/core/migrate.js';
import { applyEval } from '../js/core/adaptive.js';
import * as store from '../js/core/store.js';

const TODAY = '2026-10-02';
const NOW = new Date('2026-10-02T18:30:00Z');

/* profil « riche » : compagnon équipé, étoiles, compétences, évaluation, Leitner, historique, MCLM, réglages */
function richProfile(id = 'p1', name = 'Zoé') {
  const p = defaultProfile({ id, name, g: 'f', classe: 'CM2', today: '2026-09-01' });
  p.companion.type = 'unicorn';
  p.companion.owned = ['pony', 'unicorn'];
  p.companion.equip = { owned: ['chapeau', 'foulard'], worn: ['chapeau'] };
  p.companion.name = 'Étoile';
  p.wallet = { apples: 137, stars: { pomme: 3, foret: 2, 'cm1-aurore': 1 } };
  p.streak = { count: 12, last: '2026-10-01', freezes: 1, freezeWeek: '2026-W40' };
  p.skills = {
    'fr.fluence': { t: 1.62, n: 9, last: '2026-10-01', trend: 0.21, src: 'eval' },
    'ma.faits': { t: 2.3141, n: 40, last: '2026-09-30', trend: -0.05, src: 'defaut' }
  };
  applyEval(p, { source: 'Repères', date: '2026-09', classe: 'CM2',
    fr: { 'fr.comp_oral': 2.4, 'fr.vocab': null }, ma: { 'ma.ligne': 0.7 }, precision: 'lecture photo ±0,3' }, '2026-09-15');
  p.leitner = {
    'ma.faits:7x8': { b: 1, due: '2026-10-03', seen: 3, ok: 1, last: '2026-10-02' },
    'fr.conjug:prendre|present|3p': { b: 2, due: '2026-10-04', seen: 2, ok: 1, last: '2026-10-02' },
    'fr.fluence:ecurie': { b: 1, due: '2026-10-03', seen: 1, ok: 0, last: '2026-10-02', w: 'écurie' }
  };
  p.history = [{ d: '2026-10-01', t: 1759300000000, g: 'tables', ax: 'ma.faits', n: 10, ok: 8, hint: 1, ms: 180000, th: 2.31, mode: 'balade' }];
  p.mclm = [{ d: '2026-10-01', t: 1759300000000, s: 'pomme', v: 92, p: 95, z: 88 }];
  p.settings = { sessionMin: 20, timers: true, sound: false, motion: 'soft', subMethod: 'cassage' };
  p.stats = { minutes: 42.5, sessions: 7, items: 81 };
  p.futureField = { kept: true };              /* clé inconnue : conservée (compatibilité ascendante) */
  return p;
}
function twoProfiles() {
  return normalizeData({ schema: 3, active: 'p1', migratedFrom: 'v11', created: '2026-09-01',
    profiles: { p1: richProfile('p1', 'Zoé'), p2: defaultProfile({ id: 'p2', name: 'Hugo', g: 'm', classe: 'CE2', today: '2026-09-02' }) } }, TODAY);
}

test('export d’un profil : nom de fichier, enveloppe caramel-save v3', () => {
  const p = richProfile();
  const { filename, json } = exportProfile(p, { today: TODAY, now: NOW, app: '2.0.0' });
  assert.equal(filename, 'caramel-zoe-2026-10-02.json');
  const o = JSON.parse(json);
  assert.equal(o.format, SAVE_FORMAT);
  assert.equal(o.v, SAVE_VERSION);
  assert.equal(o.app, '2.0.0');
  assert.equal(o.exported, '2026-10-02T18:30:00.000Z');
  assert.equal(o.profile.name, 'Zoé');
  assert.ok(!('data' in o));
  /* prénom composé, accents, espaces */
  assert.equal(exportProfile({ name: 'Anne-Lou Éva' }, { today: TODAY }).filename, 'caramel-anne-lou-eva-2026-10-02.json');
  assert.equal(exportProfile({}, { today: TODAY }).filename, 'caramel-profil-2026-10-02.json');
  assert.equal(exportAll(twoProfiles(), { today: TODAY }).filename, 'caramel-tous-2026-10-02.json');
});

test('aller-retour d’un profil sans perte (export → import → remplacement)', () => {
  const p = normalizeProfile(richProfile(), TODAY);
  const { json } = exportProfile(p, { today: TODAY, now: NOW });
  const r = parseBackup(json, { today: TODAY });
  assert.deepEqual(r.errors, []);
  assert.equal(r.kind, 'profile');
  assert.deepEqual(r.payload, p, 'profil identique après l’aller-retour');
  assert.equal(r.meta.exported, '2026-10-02T18:30:00.000Z');
  /* remplacement dans les données : le profil revient exactement, avec son id */
  const data = twoProfiles();
  data.profiles.p1.wallet.apples = 0;            /* l'appareil a « perdu » des pommes */
  const res = mergeProfile(data, r.payload, 'replace', 'p1', TODAY);
  assert.deepEqual(res, { id: 'p1', mode: 'replace' });
  assert.deepEqual(data.profiles.p1, p);
  assert.equal(data.profiles.p1.settings.subMethod, 'cassage');
  assert.equal(data.profiles.p1.leitner['fr.fluence:ecurie'].w, 'écurie');
  assert.deepEqual(data.profiles.p1.futureField, { kept: true });
});

test('aller-retour de toutes les données sans perte', () => {
  const data = twoProfiles();
  const { json } = exportAll(data, { today: TODAY, now: NOW });
  const r = parseBackup(json, { today: TODAY });
  assert.deepEqual(r.errors, []);
  assert.equal(r.kind, 'all');
  assert.deepEqual(r.payload, data);
  const d = replaceAll(r.payload, TODAY);
  assert.deepEqual(d, data);
  /* le store accepte le résultat tel quel et le persiste */
  const st = memoryStorage();
  store.init(st, TODAY);
  assert.equal(store.replaceData(d), true);
  assert.deepEqual(JSON.parse(st.getItem('caramel-v3')), data);
  assert.equal(store.getProfile('p1').name, 'Zoé');
});

test('contenu brut de caramel-v3 accepté comme « tous les profils »', () => {
  const data = twoProfiles();
  const r = parseBackup(JSON.stringify(data), { today: TODAY });
  assert.equal(r.kind, 'all');
  assert.deepEqual(r.payload, data);
});

test('fichiers invalides refusés avec un message (jamais d’exception)', () => {
  const bad = [
    undefined, '', '   ', 'pas du json', '{', '[]', '42', 'null', '"texte"',
    '{}', '{"format":"autre"}',
    JSON.stringify({ format: 'caramel-save', v: 3 }),
    JSON.stringify({ format: 'caramel-save', v: 3, profile: 42 }),
    JSON.stringify({ format: 'caramel-save', v: 3, profile: [] }),
    JSON.stringify({ format: 'caramel-save', v: 3, profile: { foo: 1 } }),
    JSON.stringify({ format: 'caramel-save', v: 3, data: { profiles: {} } }),
    JSON.stringify({ format: 'caramel-save', v: 3, data: { profiles: { p1: 'x' } } }),
    JSON.stringify({ format: 'caramel-save', v: 3, data: [] }),
    JSON.stringify({ format: 'caramel-save', v: 9, profile: { name: 'Zoé' } }),
    JSON.stringify({ format: 'caramel-save', v: 'x', profile: { name: 'Zoé' } }),
    JSON.stringify({ format: 'caramel-eval', v: 1 }),
    JSON.stringify({ format: 'caramel-eval', v: 1, evaluation: 'x' }),
    JSON.stringify({ format: 'caramel-eval', v: 1, evaluation: { fr: { 'fr.inconnu': 2 }, ma: {} } }),
    JSON.stringify({ format: 'caramel-eval', v: 1, evaluation: { fr: { 'fr.vocab': 'abc' } } }),
    JSON.stringify({ format: 'caramel-eval', v: 2, evaluation: { fr: { 'fr.vocab': 2 } } })
  ];
  for (const t of bad) {
    const r = parseBackup(t, { today: TODAY });
    assert.equal(r.kind, null, String(t));
    assert.equal(r.payload, null, String(t));
    assert.ok(r.errors.length >= 1 && r.errors.every(e => typeof e === 'string' && e.length > 5), String(t));
    assert.ok(r.errors.every(e => !/'/.test(e)), 'apostrophe typographique : ' + r.errors.join(' | '));
  }
  assert.equal(replaceAll(null), null);
  assert.equal(replaceAll({ profiles: {} }), null);
  assert.equal(replaceAll({ schema: 3 }), null);
});

test('ajout comme nouveau profil : nouvel id, rien d’autre ne bouge', () => {
  const data = twoProfiles();
  const before = JSON.parse(JSON.stringify(data));
  const incoming = normalizeProfile(richProfile('p1', 'Zoé'), TODAY);
  const res = mergeProfile(data, incoming, 'add', null, TODAY);
  assert.deepEqual(res, { id: 'p3', mode: 'add' });
  assert.equal(data.profiles.p3.id, 'p3');
  assert.equal(data.profiles.p3.name, 'Zoé');
  assert.equal(data.profiles.p3.wallet.apples, 137);
  assert.deepEqual(data.profiles.p1, before.profiles.p1);
  assert.deepEqual(data.profiles.p2, before.profiles.p2);
  assert.equal(data.active, 'p1', 'le profil actif ne change pas');
  /* le profil importé n'est pas modifié (copie) */
  assert.equal(incoming.id, 'p1');
  /* données vides : le profil ajouté devient actif */
  const empty = { schema: 3, active: null, profiles: {} };
  const r2 = mergeProfile(empty, incoming, 'add', null, TODAY);
  assert.equal(r2.id, 'p1');
  assert.equal(empty.active, 'p1');
});

test('remplacement ciblé : seul le profil visé change, son id est conservé', () => {
  const data = twoProfiles();
  const keepP1 = JSON.parse(JSON.stringify(data.profiles.p1));
  const incoming = normalizeProfile({ ...richProfile('p9', 'Hugo'), g: 'm', classe: 'CE2' }, TODAY);
  const res = mergeProfile(data, incoming, 'replace', 'p2', TODAY);
  assert.deepEqual(res, { id: 'p2', mode: 'replace' });
  assert.equal(data.profiles.p2.id, 'p2');
  assert.equal(data.profiles.p2.wallet.apples, 137);
  assert.deepEqual(data.profiles.p1, keepP1);
  assert.deepEqual(Object.keys(data.profiles).sort(), ['p1', 'p2']);
  assert.throws(() => mergeProfile(data, incoming, 'replace', 'p7', TODAY));
  assert.throws(() => mergeProfile(data, incoming, 'replace', null, TODAY));
  assert.throws(() => mergeProfile(null, incoming, 'add'));
});

test('correspondance de profils (prénom sans accents ni majuscules)', () => {
  const data = twoProfiles();
  assert.ok(sameName('LÉA', 'Léa'));
  assert.ok(!sameName('', ''));
  assert.equal(findMatch(data, { id: 'p1', name: 'zoe' }), 'p1');
  assert.equal(findMatch(data, { id: 'p5', name: 'Hugo' }), 'p2');
  assert.equal(findMatch(data, { id: 'p2', name: 'Inès' }), null);
});

test('fichier caramel-eval reconnu (annexe A) : null = absence, clés inconnues ignorées', () => {
  const file = { format: 'caramel-eval', v: 1,
    profil: { prenom: 'Zoé', g: 'f', classe: 'cm2' },
    evaluation: { source: 'Repères', date: '2026-09', classe: 'CM2',
      fr: { 'fr.comp_oral': 2.4, 'fr.vocab': null, 'fr.ortho': '2,5', 'fr.inconnu': 1, 'ma.ligne': 1.8 },
      ma: { 'ma.faits': 3.4, 'ma.problemes': -1, 'ma.nombres': 'x' },
      precision: 'lecture photo ±0,3 ; null = absente à l’exercice' } };
  const r = parseBackup(JSON.stringify(file), { today: TODAY });
  assert.deepEqual(r.errors, []);
  assert.equal(r.kind, 'eval');
  assert.deepEqual(r.payload.profil, { prenom: 'Zoé', g: 'f', classe: 'CM2' });
  const ev = r.payload.evaluation;
  assert.equal(ev.source, 'Repères');
  assert.equal(ev.date, '2026-09');
  assert.equal(ev.classe, 'CM2');
  assert.deepEqual(ev.fr, { 'fr.comp_oral': 2.4, 'fr.vocab': null, 'fr.ortho': 2.5 });
  assert.deepEqual(ev.ma, { 'ma.ligne': 1.8, 'ma.faits': 3, 'ma.problemes': 0 }, 'axe reclassé, valeurs ramenées dans 0-3');
  assert.deepEqual(r.payload.counts, { fr: 3, ma: 3, absent: 1 });
  assert.equal(r.warnings.length, 3, r.warnings.join(' | '));
  assert.equal(evalSummary(ev), 'Français\u00A0: 3\u00A0compétences (1\u00A0absence) · Maths\u00A0: 3\u00A0compétences');
  /* l'évaluation lue s'applique telle quelle au moteur */
  const p = defaultProfile({ id: 'p1', name: 'Zoé', classe: 'CM2', today: TODAY });
  const out = applyEval(p, ev, TODAY);
  assert.deepEqual(out.absent, ['fr.vocab']);
  assert.equal(p.skills['fr.ortho'].t, 2.5);
  assert.equal(p.evals.length, 1);
  assert.equal(p.evals[0].src, 'reperes');
  /* sans profil ni classe : accepté quand même */
  const r2 = parseBackup(JSON.stringify({ format: 'caramel-eval', evaluation: { fr: { 'fr.conjug': 1.5 } } }));
  assert.equal(r2.kind, 'eval');
  assert.deepEqual(r2.payload.profil, { prenom: '', g: null, classe: null });
  assert.equal(r2.payload.evaluation.classe, null);
  assert.equal(r2.payload.evaluation.date, '');
});

test('relais d’un fichier d’évaluation entre écrans', () => {
  assert.equal(takeStash(), null);
  stashEval({ kind: 'eval' });
  assert.deepEqual(takeStash(), { kind: 'eval' });
  assert.equal(takeStash(), null);
});

test('module pur : importable sans DOM, export sans document (version par défaut)', () => {
  const { json } = exportProfile(defaultProfile({ id: 'p1', name: 'Zoé', today: TODAY }), { today: TODAY });
  assert.equal(JSON.parse(json).app, '2.0.0');
});
