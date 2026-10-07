/* Journal de diagnostic (js/core/debuglog.js, v2.2.3) : activé par appareil, borné, prénoms masqués à l'export. */
import { test, assert } from './_t.mjs';
import * as dl from '../js/core/debuglog.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m };
}

test('désactivé par défaut : rien n’est noté', () => {
  const st = fakeStorage();
  dl._setStorage(st);
  assert.equal(dl.enabled(), false);
  dl.dlog('micro', 'écoute');
  assert.equal(dl.entries().length, 0);
});

test('activé : événements notés, gardés entre deux ouvertures, effaçables', async () => {
  const st = fakeStorage();
  dl._setStorage(st);
  dl.setEnabled(true);
  assert.equal(st.getItem(dl.FLAG_KEY), '1');
  dl.dlog('micro', 'écoute', { moteur: 'vosk', retard: 0.123456, long: 'x'.repeat(500) });
  const e = dl.entries();
  assert.equal(e.length, 2, 'activation + écoute');
  assert.equal(e[1].c, 'micro');
  assert.equal(e[1].d.retard, 0.123, 'nombres arrondis');
  assert.ok(e[1].d.long.length < 310, 'textes raccourcis');
  await new Promise(r => setTimeout(r, 1700));           /* écriture différée */
  dl._setStorage(st);                                    /* « nouvelle ouverture » : relu depuis le stockage */
  assert.equal(dl.enabled(), true);
  assert.equal(dl.entries().length, 2);
  dl.clear();
  assert.equal(dl.entries().length, 1, 'seule la ligne « journal effacé »');
  dl.setEnabled(false);
  assert.equal(st.getItem(dl.FLAG_KEY), null);
  dl.dlog('micro', 'après');
  assert.ok(!dl.entries().some(x => x.m === 'après'), 'désactivé : plus rien');
});

test('borné : les plus anciens partent d’abord', () => {
  const st = fakeStorage();
  dl._setStorage(st);
  dl.setEnabled(true);
  for (let i = 0; i < dl.MAX_ENTRIES + 50; i++) dl.dlog('santé', 'n' + i);
  const e = dl.entries();
  assert.ok(e.length <= dl.MAX_ENTRIES);
  assert.equal(e[e.length - 1].m, 'n' + (dl.MAX_ENTRIES + 49));
  assert.ok(!e.some(x => x.m === 'n0'));
  dl.setEnabled(false);
});

test('export : en-tête, une ligne par événement, prénoms masqués', () => {
  const st = fakeStorage();
  dl._setStorage(st);
  dl.setEnabled(true);
  dl.dlog('entendu', 'Léa a dit cinquante-six', { prénom: 'Léa' });
  const txt = dl.exportText({ names: ['Léa', 'X'], header: { Version: '2.2.3' } });
  assert.ok(txt.startsWith('Journal de diagnostic de Caramel'));
  assert.ok(txt.includes('Version : 2.2.3'));
  assert.ok(/\d\d:\d\d:\d\d\.\d{3} \[entendu\] ‹prénom› a dit cinquante-six/.test(txt), txt);
  assert.ok(!txt.includes('Léa'), 'aucun prénom');
  assert.equal(dl.scrub('Léana et léa, Mélanie', ['Léa']), 'Léana et ‹prénom›, Mélanie', 'mots entiers, sans tenir compte de la casse');
  assert.ok(/^caramel-journal-\d{4}-\d\d-\d\d-\d\dh\d\d\.txt$/.test(dl.fileName(new Date(2026, 9, 6, 9, 5))));
  dl.setEnabled(false);
  dl._setStorage(null);
});
