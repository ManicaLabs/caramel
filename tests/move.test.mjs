/* Déménagement vers caramel.manica.fr (v2.4, décision du parent du 07/10/2026) : le paquet des progrès voyage après le #
   de l'adresse (jamais envoyé à un serveur), rien n'est effacé sur l'ancienne adresse, la nouvelle range ce qui arrive
   (appareil vide), ignore un paquet déjà reçu et laisse l'adulte choisir s'il y avait déjà des progrès. Prénoms fictifs. */
import { test, assert, memoryStorage } from './_t.mjs';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/store.js';
import * as backup from '../js/ui/backup.js';
import * as mv from '../js/core/move.js';
import { defaultProfile } from '../js/core/profiles.js';

const SRC = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const TODAY = '2026-10-07';
const OLD = { host: 'cdelalande38.github.io', href: 'https://cdelalande38.github.io/caramel/#/', pathname: '/caramel/', search: '', hash: '#/' };
const NEW = h => ({ host: 'caramel.manica.fr', href: 'https://caramel.manica.fr/' + h, pathname: '/', search: '', hash: h });
const fakeHist = () => ({ calls: [], replaceState(_, __, u) { this.calls.push(u); } });

/* données d'une famille : n enfants, chacun avec beaucoup de parties (poids réaliste après une année) */
function family(names, games = 400) {
  store.init(memoryStorage(), TODAY);
  for (const name of names) {
    const id = store.addProfile({ name, classe: 'CE2' });
    store.mutateProfile(p => {
      for (let i = 0; i < games; i++) p.history.push({ d: '2026-0' + (1 + (i % 9)) + '-1' + (i % 9), t: i, g: 'tables', ax: 'ma.faits', n: 10, ok: 8, hint: 1, ms: 300000 + i, th: 1.5 + (i % 7) / 10, mode: 'libre' });
    }, id);
  }
  return JSON.stringify(store.getData());
}

test('paquet : aller-retour compressé et en JSON seul ; abîmé, tronqué ou d’un autre format → null', async () => {
  const v3 = family(['Léa', 'Tom'], 30);
  const b = mv.bundle({ 'caramel-v3': v3, 'caramel-parent': '{"v":1,"pin":null}', 'caramel-debug-log': '[]' }, { now: new Date('2026-10-07T10:00:00Z'), from: OLD.href, id: 'abc' });
  assert.deepEqual(Object.keys(b.keys).sort(), ['caramel-parent', 'caramel-v3'], 'seulement les clés à emporter');
  for (const zip of [true, false]) {
    const t = await mv.pack(b, { zip });
    assert.match(t, zip ? /^z\.[A-Za-z0-9_-]+$/ : /^j\.[A-Za-z0-9_-]+$/);
    const back = await mv.unpack(t);
    assert.equal(back.id, 'abc');
    assert.equal(back.keys['caramel-v3'], v3, 'profils intacts');
    if (zip) { assert.equal(await mv.unpack(t.slice(0, -12)), null, 'tronqué'); }
  }
  assert.equal(await mv.unpack('j.' + Buffer.from('{"f":"autre","v":1}').toString('base64url')), null, 'autre format');
  assert.equal(await mv.unpack('n’importe quoi'), null);
  assert.equal(await mv.unpack(await mv.pack(mv.bundle({ 'caramel-parent': '{"v":1}' }))), null, 'sans profils : rien');
  assert.equal(mv.readHash('#demenagement=z.AbC-_9'), 'z.AbC-_9');
  assert.equal(mv.readHash('#/home'), null);
  assert.equal(mv.moveUrl('z.x', 'https://caramel.manica.fr/'), 'https://caramel.manica.fr/#demenagement=z.x');
});

test('poids : une famille de 4 enfants après une année tient dans une adresse (< 200 Ko)', async () => {
  const v3 = family(['Léa', 'Tom', 'Zoé', 'Noé'], 600);
  const t = await mv.pack(mv.bundle({ 'caramel-v3': v3 }));
  assert.ok(t.length < 200 * 1024, Math.round(t.length / 1024) + ' Ko');
  console.log('    paquet d’une famille de 4 (600 parties chacun) : ' + Math.round(v3.length / 1024) + ' Ko de données → ' + Math.round(t.length / 1024) + ' Ko dans l’adresse');
});

test('ancienne adresse : écran seulement si allumé (ou essai) ; « Plus tard » pour la séance ; rien n’est effacé', async () => {
  const ss = memoryStorage();
  assert.equal(mv.MOVE_ON, false, 'éteint tant que caramel.manica.fr n’est pas vérifiée');
  assert.equal(mv.wanted({ loc: OLD, ss }), false);
  assert.equal(mv.wanted({ loc: OLD, ss, on: true }), true);
  assert.equal(mv.wanted({ loc: NEW('#/'), ss, on: true }), false, 'jamais sur la nouvelle adresse');
  mv.later(ss);
  assert.equal(mv.wanted({ loc: OLD, ss, on: true }), false, 'Plus tard');
  const ss2 = memoryStorage({ 'caramel-move-test': JSON.stringify({ to: 'http://localhost:8998/caramel/' }) });
  assert.equal(mv.wanted({ loc: NEW('#/'), ss: ss2 }), true, 'essai de bout en bout');
  assert.equal(mv.target(ss2), 'http://localhost:8998/caramel/');
  const v3 = family(['Léa'], 5);
  const ls = memoryStorage({ 'caramel-v3': v3, 'caramel-parent': '{"v":1,"pin":{"h":"x","s":"y"}}' });
  const url = await mv.leave({ ls, loc: OLD });
  assert.match(url, /^https:\/\/caramel\.manica\.fr\/#demenagement=[zj]\./);
  assert.equal(ls.getItem('caramel-v3'), v3, 'rien n’est effacé ici');
  assert.ok(mv.moved(ls), 'déménagement noté');
  assert.equal(await mv.leave({ ls: memoryStorage(), loc: OLD }), null, 'rien à emporter');
});

test('nouvelle adresse : appareil vide → rangé ; déjà reçu → rien ; des progrès ici → l’adulte choisit ; adresse nettoyée', async () => {
  const v3 = family(['Léa', 'Tom'], 10);
  const pkt = mv.bundle({ 'caramel-v3': v3, 'caramel-parent': '{"v":1,"pin":{"h":"x","s":"y"}}' }, { id: 'p1' });
  const hash = '#demenagement=' + await mv.pack(pkt);
  /* appareil vide */
  store.init(memoryStorage(), TODAY);
  let ls = memoryStorage(), hist = fakeHist();
  let r = await mv.arrive(store, backup, { loc: NEW(hash), hist, ls });
  assert.equal(r.status, 'arrived');
  assert.deepEqual(store.listProfiles().map(p => p.name).sort(), ['Léa', 'Tom']);
  assert.equal(JSON.parse(ls.getItem('caramel-parent')).pin.h, 'x', 'code parent emporté');
  assert.deepEqual(hist.calls, ['/#/'], 'le paquet quitte l’adresse aussitôt');
  /* le même paquet une 2e fois */
  r = await mv.arrive(store, backup, { loc: NEW(hash), hist: fakeHist(), ls });
  assert.equal(r.status, 'already');
  /* des progrès différents ici */
  store.init(memoryStorage(), TODAY);
  store.addProfile({ name: 'Zoé', classe: 'CP' });
  ls = memoryStorage();
  r = await mv.arrive(store, backup, { loc: NEW(hash), hist: fakeHist(), ls });
  assert.equal(r.status, 'choose');
  assert.deepEqual(r.here, ['Zoé']);
  assert.deepEqual(r.there.sort(), ['Léa', 'Tom']);
  assert.deepEqual(store.listProfiles().map(p => p.name), ['Zoé'], 'rien ne change avant le choix');
  assert.equal(r.take(), true);
  assert.deepEqual(store.listProfiles().map(p => p.name).sort(), ['Léa', 'Tom']);
  /* paquet abîmé */
  r = await mv.arrive(store, backup, { loc: NEW('#demenagement=z.AAAA'), hist: fakeHist(), ls });
  assert.equal(r.status, 'broken');
  assert.equal(await mv.arrive(store, backup, { loc: NEW('#/home'), hist: fakeHist(), ls }), null);
});

test('branché au démarrage : arrivée avant le premier écran, écran du déménagement, espace parents toujours ouvert', () => {
  const m = SRC('js/main.js');
  assert.match(m, /'demenagement': \(\) => import\('\.\/ui\/move\.js'\)/);
  assert.ok(m.indexOf('mv.arrive(store, backup)') < m.indexOf('initialRoute(store)'), 'arrivée avant le choix du premier écran');
  assert.match(m, /const MOVE_FREE = \['demenagement', 'parents'\];/);
  assert.ok(!/defaultProfile/.test(SRC('js/core/move.js')), 'module sans dépendance');
  assert.ok(defaultProfile);
});

test('les phrases de l’écran du déménagement sont enregistrées (voix de Caramel)', async () => {
  const { TEXT } = await import('../js/ui/move.js').catch(() => ({ TEXT: null }));
  const { LINES } = await import('../js/content/voice-lines.js');
  const src = SRC('js/ui/move.js');
  for (const k of ['go', 'done', 'offline', 'wait']) {
    const t = TEXT ? TEXT[k] : new RegExp(k + ": '([^']+)'").exec(src)[1];
    assert.ok(LINES.some(l => l.id === 'move.' + k && l.text === t), k);
  }
});
