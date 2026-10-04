/* Espace parents (B3) : code parent haché, attente après erreurs, calcul d'adulte, élision, SHA-256,
   notation unique des niveaux (⊕), aucun caractère invisible littéral dans les sources touchées ;
   Mes progrès : médailles sur les seules compétences jouées, axe sans valeur posé sur la corde de ses voisins.
   Retouches (B3-verif) : porte sans indication, pavé du code sans chiffre perdu, date de sauvegarde jamais héritée
   d'un autre enfant, médailles gardées après une nouvelle fiche (lectures chronométrées comprises) et réponses jamais
   remises à zéro par elle, notification de rappel exacte, triangles décoratifs. Prénoms fictifs uniquement. */
import { test, assert, memoryStorage } from './_t.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { deNom, frList, frTypo, sha256Hex, sha256HexSync } from '../js/core/util.js';
import {
  PARENT_KEY, PIN_LEN, LOCK_MS, LOCK_MAX_MS, readPrefs, writePrefs, setCode, checkCode, clearCode,
  validCode, lockLeft, noteFail, noteSuccess, newChallenge, hashCode, pinEntry, dropProfile, playedAxis, answerCount
} from '../js/ui/parents.js';
import { levelMarks, levelText, levelSpeech, axisEmoji, chordPoint } from '../js/ui/radar.js';
import { earnedMedals } from '../js/ui/progres.js';
import * as backup from '../js/ui/backup.js';
import * as store from '../js/core/store.js';
import * as notifs from '../js/core/notifs.js';
import { defaultProfile } from '../js/core/profiles.js';
import { applyEval } from '../js/core/adaptive.js';

const SRC = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const TODAY = '2026-10-04';
const NOW = new Date('2026-10-04T08:15:00Z');

/* API du navigateur simulées le temps d'un test, puis rendues telles quelles (les autres tests vérifient leur absence) */
async function withGlobals(defs, fn) {
  const saved = new Map();
  const define = (k, v) => {
    if (!saved.has(k)) saved.set(k, Object.getOwnPropertyDescriptor(globalThis, k));
    Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  };
  try {
    for (const [k, v] of Object.entries(defs)) define(k, v);
    return await fn(define);
  } finally {
    for (const [k, d] of saved) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
  }
}
/* document minimal pour util.h() (feuilles de restauration construites, jamais affichées) */
function fakeDocument() {
  const el = tag => ({
    tag, attrs: {}, children: [], style: {}, dataset: {}, listeners: {}, textContent: '',
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    querySelector: () => null
  });
  return { createElement: el, createElementNS: (ns, t) => el(t), createTextNode: t => ({ text: String(t) }), querySelector: () => null, head: el('head'), body: el('body') };
}
/* kit simulé : chaque feuille est gardée, le test choisit l'action */
function fakeKit() {
  const sheets = [];
  return { sheets, sheet: o => { sheets.push(o); return { el: {}, close: async () => {} }; }, toast: () => {} };
}
const action = (sheet, re) => {
  const a = (sheet.actions || []).find(x => re.test(x.label));
  assert.ok(a, 'action introuvable : ' + re + ' parmi ' + (sheet.actions || []).map(x => x.label).join(' | '));
  return a.onClick();
};

test('élision : de / d’ devant un prénom ou un mois', () => {
  assert.equal(deNom('Inès'), 'd’Inès');
  assert.equal(deNom('Zoé'), 'de Zoé');
  assert.equal(deNom('Léo'), 'de Léo');
  assert.equal(deNom('Élodie'), 'd’Élodie');
  assert.equal(deNom('octobre 2026'), 'd’octobre 2026');
  assert.equal(deNom('août'), 'd’août');
  assert.equal(deNom('septembre'), 'de septembre');
  assert.equal(deNom('Hugo'), 'de Hugo');               /* jamais d'élision devant h */
  assert.equal(deNom('Yanis'), 'de Yanis');             /* y + voyelle : consonne */
  assert.equal(deNom('Yves'), 'd’Yves');
  assert.equal(frList(['a']), 'a');
  assert.equal(frList(['a', 'b']), 'a et b');
  assert.equal(frList(['Zoé', 'Hugo', 'Inès']), 'Zoé, Hugo et Inès');
  assert.equal(frList([]), '');
});

test('SHA-256 : vecteurs connus, calcul JavaScript identique à crypto.subtle', async () => {
  assert.equal(sha256HexSync(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256HexSync('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256HexSync('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  for (let n = 0; n < 140; n += 7) {
    const s = 'é' + 'x'.repeat(n) + '😀';
    const ref = Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(s))).toString('hex');
    assert.equal(sha256HexSync(s), ref, 'longueur ' + n);
    assert.equal(await sha256Hex(s), ref);
  }
});

test('code parent : 4 chiffres (zéro en tête compris), haché et salé, jamais en clair', async () => {
  const st = memoryStorage();
  assert.equal(PIN_LEN, 4);
  assert.ok(validCode('0123'));
  assert.ok(!validCode('123') && !validCode('12345') && !validCode('12a4') && !validCode(1234));
  assert.equal(await setCode('12', st), false);
  assert.equal(st.getItem(PARENT_KEY), null);
  assert.equal(await setCode('0123', st), true);
  const raw = st.getItem(PARENT_KEY);
  assert.ok(!/0123/.test(raw), 'code en clair : ' + raw);
  const p = JSON.parse(raw);
  assert.match(p.pin.h, /^[0-9a-f]{64}$/);
  assert.equal(p.pin.h, await hashCode('0123', p.pin.s));
  assert.equal(await checkCode('0123', st), true);
  assert.equal(await checkCode('123', st), false);
  assert.equal(await checkCode('0124', st), false);
  /* même code, nouveau sel : empreinte différente */
  await setCode('0123', st);
  assert.notEqual(JSON.parse(st.getItem(PARENT_KEY)).pin.h, p.pin.h);
  assert.ok(clearCode(st));
  assert.equal(readPrefs(st).pin, null);
  assert.equal(await checkCode('0123', st), false);
});

test('réglages d’appareil illisibles : valeurs par défaut, jamais d’exception', () => {
  for (const bad of ['{', 'null', '[]', '"x"', JSON.stringify({ pin: { h: 'zz', s: 1 }, fails: -3, until: 'x', saved: [1] })]) {
    const st = memoryStorage({ [PARENT_KEY]: bad });
    const p = readPrefs(st);
    assert.equal(p.pin, null);
    assert.equal(p.fails, 0);
    assert.equal(p.until, 0);
    assert.deepEqual(p.saved, {});
  }
  assert.equal(readPrefs(null).pin, null);
  assert.equal(writePrefs({ v: 1 }, null), false);
  const ko = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.equal(writePrefs({ v: 1 }, ko), false);
});

test('erreurs : 3 de suite → attente de 30 s, doublée ensuite, plafonnée ; une réussite remet à zéro', () => {
  let p = readPrefs(memoryStorage());
  let r;
  r = noteFail(p, 1000); p = r.prefs; assert.equal(r.locked, false);
  r = noteFail(p, 1000); p = r.prefs; assert.equal(r.locked, false);
  r = noteFail(p, 1000); p = r.prefs; assert.equal(r.locked, true);
  assert.equal(lockLeft(p, 1000), LOCK_MS);
  assert.equal(p.fails, 0);
  for (let i = 0; i < 3; i++) { r = noteFail(p, 100000); p = r.prefs; }
  assert.equal(lockLeft(p, 100000), 2 * LOCK_MS);
  for (let k = 0; k < 10; k++) for (let i = 0; i < 3; i++) { r = noteFail(p, 1e7); p = r.prefs; }
  assert.equal(lockLeft(p, 1e7), LOCK_MAX_MS);
  p = noteSuccess(p);
  assert.equal(lockLeft(p, 0), 0);
  assert.equal(p.strikes, 0);
});

test('calcul d’adulte : racine carrée d’un carré de 32² à 99², jamais deux fois la même', () => {
  let prev = null;
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const c = newChallenge(Math.random, prev);
    assert.ok(c.answer >= 32 && c.answer <= 99, 'racine ' + c.answer);
    assert.notEqual(c.answer % 5, 0);
    assert.equal(c.square, c.answer * c.answer);
    if (prev) assert.notEqual(c.answer, prev.answer);
    seen.add(c.answer);
    prev = c;
  }
  assert.ok(seen.size > 40, 'variété : ' + seen.size);
  assert.equal(newChallenge(() => 0).answer, 32);
  assert.equal(newChallenge(() => 0.9999).answer, 99);
});

test('niveaux : une seule notation ⊕ (celle de la fiche), valeur parlée pour les lecteurs d’écran', () => {
  assert.equal(levelMarks(0.8), '');
  assert.equal(levelMarks(1), '⊕');
  assert.equal(levelMarks(2.1), '⊕⊕');
  assert.equal(levelMarks(1.96), '⊕⊕');                 /* arrondi au dixième, comme l'affichage */
  assert.equal(levelMarks(3), '⊕⊕⊕');
  assert.equal(levelText(2.1), '⊕⊕\u00A02,1');
  assert.equal(levelText(0.8), 'sous\u00A0⊕\u00A00,8');
  assert.equal(levelSpeech(2.1), '2,1 sur 3');
  assert.equal(levelText(null), '');
  assert.equal(axisEmoji('ma.faits'), '🏇');
  assert.equal(axisEmoji('fr.conjug'), '🎻');
});

test('sources : aucun caractère invisible littéral, aucun « + » nu comme repère de niveau', () => {
  for (const f of ['js/ui/parents.js', 'js/ui/radar.js', 'js/ui/progres.js', 'js/ui/backup.js', 'js/core/notifs.js', 'js/core/util.js']) {
    assert.ok(!/[\u00A0\u202f\u200B\u2009\u0300-\u036F]/.test(SRC(f)), 'caractère invisible littéral dans ' + f);
  }
  assert.ok(!/mark: '\+/.test(SRC('js/ui/radar.js')), 'repères des cercles en « + »');
  /* textes des parents : vouvoiement (pas de « installe », « ton écran ») */
  assert.ok(!/installe Caramel sur ton/.test(SRC('js/core/notifs.js')));
});

test('Mes progrès : médailles seulement sur les compétences entraînées par un jeu ET jouées (jamais la fiche seule)', () => {
  const fiche = { src: 'reperes', date: '2026-09', classe: 'CM2', fr: { 'fr.vocab': 2.6, 'fr.conjug': 2.2, 'fr.fluence': 1.5 }, ma: { 'ma.faits': 2.9, 'ma.ligne': 1.2 } };
  const base = { id: 'p1', name: 'Zoé', classe: 'CM2', evals: [fiche], skills: {} };
  /* poids d'initialisation de la fiche (src 'eval', n = 4) : rien de joué → aucune médaille */
  for (const [k, v] of Object.entries({ ...fiche.fr, ...fiche.ma })) base.skills[k] = { t: v, n: 4, src: 'eval', trend: 0 };
  assert.deepEqual(earnedMedals(base), []);
  /* tables jouées (réponses observées au-delà de l'initialisation) → or ; vocabulaire « joué » mais sans jeu → rien */
  const played = JSON.parse(JSON.stringify(base));
  played.skills['ma.faits'] = { t: 2.9, n: 30, src: 'eval', trend: 0.2 };
  played.skills['fr.vocab'] = { t: 2.6, n: 12, src: 'obs', trend: 0 };
  played.skills['fr.conjug'] = { t: 2.2, n: 9, src: 'obs', trend: 0 };
  played.skills['fr.fluence'] = { t: 0.4, n: 9, src: 'obs', trend: 0 };
  const m = earnedMedals(played);
  assert.deepEqual(m.map(x => x.id), ['ma.faits', 'fr.conjug']);
  assert.equal(m[0].tier, 'or');
  assert.ok(!m.some(x => x.id === 'fr.vocab'), 'médaille sur une compétence sans jeu');
  assert.ok(!m.some(x => x.id === 'fr.fluence'), 'médaille sous le seuil du bronze');
  assert.deepEqual(earnedMedals({ id: 'p2', name: 'Hugo', classe: 'CP' }), []);
});

test('radar de l’enfant : un axe sans valeur se pose sur la corde de ses voisins (jamais au centre)', () => {
  /* rayon horizontal vers la droite, voisins en (1, 1) et (1, −1) → (1, 0) */
  assert.deepEqual(chordPoint([0, 0], [1, 1], [1, -1], [2, 0]).map(v => Math.round(v * 1e6) / 1e6), [1, 0]);
  /* corde plus loin que le bout du rayon, rayon parallèle à la corde, corde derrière le centre : pas d'intersection */
  assert.equal(chordPoint([0, 0], [3, 1], [3, -1], [2, 0]), null);
  assert.equal(chordPoint([0, 0], [1, 1], [2, 1], [2, 0]), null);
  assert.equal(chordPoint([0, 0], [-1, 1], [-1, -1], [2, 0]), null);
  /* voisins à des rayons différents : le point reste sur le segment */
  const X = chordPoint([0, 0], [0, 2], [2, 0], [3, 3]);
  assert.ok(Math.abs(X[0] - 1) < 1e-9 && Math.abs(X[1] - 1) < 1e-9);
});

/* ============ retouches après la contre-vérification (B3-verif) ============ */

test('porte sans code : l’écran ne dit pas comment entrer (ni nom de l’opération ni calculatrice)', () => {
  const code = SRC('js/ui/parents.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/calculatrice/i.test(code), 'invitation à la calculatrice');
  assert.ok(!/pa-gate-hint/.test(code), 'paragraphe d’indication de la porte');
  /* le nom de l'opération n'est donné qu'aux lecteurs d'écran */
  assert.match(code, /spoken\.textContent = 'Racine carrée de '/);
  assert.match(code, /const spoken = h\('span', \{ class: 'sr-only' \}\)/);
});

test('pavé du code : un chiffre tapé juste après le 4e n’est jamais perdu (il commence la confirmation)', () => {
  const timers = [];
  const done = [];
  let shown = -1;
  const e = pinEntry({ onComplete: c => done.push(c), onChange: n => { shown = n; }, timer: fn => timers.push(fn) });
  for (const k of '1357') assert.ok(e.press(k));
  assert.equal(shown, 4);
  assert.equal(timers.length, 1, 'validation programmée après la courte pause');
  /* pendant la pause : chiffres gardés en file, effacement ignoré, saisie affichée inchangée */
  assert.ok(e.press('1'));
  assert.ok(e.press('3'));
  assert.equal(e.press('del'), false);
  assert.equal(e.value(), '1357');
  timers.shift()();
  assert.deepEqual(done, ['1357']);
  e.clear();                                       /* l'appelant attend la confirmation : la file y entre aussitôt */
  assert.equal(e.value(), '13');
  assert.equal(shown, 2);
  e.press('5'); e.press('7');
  timers.shift()();
  assert.deepEqual(done, ['1357', '1357']);
  /* file plafonnée à 4 chiffres ; une file de 4 chiffres complète la saisie suivante */
  for (const k of '246802') e.press(k);
  e.clear();
  assert.equal(e.value(), '2468');
  assert.equal(timers.length, 1);
  timers.shift()();
  assert.deepEqual(done.slice(-1), ['2468']);
  /* pavé désactivé (code vérifié, attente après erreurs) : rien n'entre, rien n'est gardé */
  e.press('9');
  e.setOff(true);
  e.clear();
  assert.equal(e.value(), '');
  assert.equal(e.press('1'), false);
  e.setOff(false);
  assert.ok(e.press('4'));
  assert.equal(e.value(), '4');
});

test('dernière sauvegarde : jamais attribuée à un autre enfant (suppression, identifiant réutilisé, restauration)', async () => {
  const st = memoryStorage();
  store.init(st, TODAY);
  const ids = ['Zoé', 'Hugo', 'Inès'].map(name => store.addProfile(defaultProfile({ name, classe: 'CM2', today: TODAY })));
  assert.deepEqual(ids, ['p1', 'p2', 'p3']);
  assert.ok(await setCode('2580', st));
  const ines = store.getProfile('p3');
  assert.ok(backup.noteSaved([ines], { st, now: NOW }));
  assert.equal(backup.lastSaved(ines, { st }), NOW.toISOString());
  /* les écritures de l'espace parents (code, essais) gardent les dates telles quelles */
  writePrefs(noteSuccess(readPrefs(st)), st);
  assert.equal(backup.lastSaved(ines, { st }), NOW.toISOString());
  assert.equal(await checkCode('2580', st), true);

  await withGlobals({ document: fakeDocument() }, async () => {
    /* Inès supprimée, puis Léo restauré « comme nouveau profil » : il reçoit p3, sans la date d'Inès */
    assert.ok(dropProfile('p3', { st }));
    assert.equal(backup.lastSaved(ines, { st }), '', 'date d’un profil supprimé');
    backup.noteSaved([ines], { st, now: NOW });                         /* comme une ancienne version : date restée */
    const leo = defaultProfile({ id: 'p9', name: 'Léo', g: 'm', classe: 'CE2', today: TODAY });
    const kit = fakeKit();
    const pr = backup.restoreFlow(backup.parseBackup(backup.exportProfile(leo).json, { today: TODAY }), { store, kit, storage: st });
    action(kit.sheets[0], /^Ajouter comme nouveau profil$/);
    const res = await pr;
    assert.deepEqual(res, { mode: 'add', ids: ['p3'] });
    assert.equal(store.getProfile('p3').name, 'Léo');
    assert.equal(backup.lastSaved(store.getProfile('p3'), { st }), '', 'Léo hérite de la date d’Inès');
    /* même sans l'oubli explicite, une date n'est montrée que pour le prénom enregistré avec elle */
    backup.noteSaved([{ id: 'p3', name: 'Inès' }], { st, now: NOW });
    assert.equal(backup.lastSaved(store.getProfile('p3'), { st }), '');
    backup.noteSaved([{ id: 'p1', name: 'Zoe' }], { st, now: NOW });       /* accents et majuscules ignorés */
    assert.equal(backup.lastSaved(store.getProfile('p1'), { st }), NOW.toISOString());

    /* « Tout remplacer » : Léo devient p1, il n'hérite pas de la date de Zoé ; toutes les dates sont oubliées */
    backup.noteSaved(store.listProfiles(), { st, now: NOW });
    const other = { schema: 3, active: 'p1', profiles: {
      p1: defaultProfile({ id: 'p1', name: 'Léo', g: 'm', classe: 'CE2', today: TODAY }),
      p2: defaultProfile({ id: 'p2', name: 'Léa', classe: 'CP', today: TODAY }) } };
    const kit2 = fakeKit();
    const pr2 = backup.restoreFlow(backup.parseBackup(backup.exportAll(other).json, { today: TODAY }), { store, kit: kit2, storage: st });
    action(kit2.sheets[0], /^Tout remplacer$/);
    assert.equal(kit2.sheets.length, 2, 'confirmation « Tout remplacer ? »');
    assert.match(kit2.sheets[1].title, /Tout remplacer/);
    action(kit2.sheets[1], /^Tout remplacer$/);
    const res2 = await pr2;
    assert.equal(res2.mode, 'all');
    assert.equal(store.getProfile('p1').name, 'Léo');
    for (const p of store.listProfiles()) assert.equal(backup.lastSaved(p, { st }), '', 'date héritée par ' + p.name);
    assert.deepEqual(readPrefs(st).saved, {});
    assert.equal(await checkCode('2580', st), true, 'le code parent survit à la restauration');
  });
  /* stockage illisible ou absent : jamais d'exception */
  assert.equal(backup.lastSaved({ id: 'p1', name: 'Zoé' }, { st: memoryStorage({ [PARENT_KEY]: '{' }) }), '');
  assert.equal(backup.noteSaved([{ id: 'p1', name: 'Zoé' }], { st: null }), false);
  assert.equal(backup.forgetSaved(['p1'], { st: { getItem: () => { throw new Error('bloqué'); } } }), true);
});

test('Mes progrès : une nouvelle fiche importée n’efface pas les médailles gagnées en jouant', () => {
  const p = defaultProfile({ id: 'p1', name: 'Zoé', classe: 'CM2', today: '2026-09-01' });
  applyEval(p, { source: 'Repères', date: '2026-09', classe: 'CM2',
    fr: { 'fr.vocab': 1.8, 'fr.conjug': 1.2, 'fr.fluence': 1.4 }, ma: { 'ma.faits': 1.3, 'ma.operations': 2.2, 'ma.ligne': 1.0 } }, '2026-09-20');
  /* parties jouées : la manche note l'axe dans l'historique et fait grandir n */
  const played = { 'ma.faits': 2.8, 'fr.conjug': 2.3, 'ma.operations': 2.3, 'fr.fluence': 1.7, 'ma.ligne': 1.35 };
  let day = 1;
  for (const [ax, t] of Object.entries(played)) {
    p.skills[ax] = { t, n: 4 + 12, last: '2026-10-0' + day, trend: 0.1, src: 'eval' };
    p.history.push({ d: '2026-10-0' + day, t: Date.parse('2026-10-0' + day), g: 'jeu', ax, n: 12, ok: 9, hint: 0, ms: 120000, th: t, mode: 'balade' });
    day++;
  }
  const before = earnedMedals(p);
  assert.deepEqual(before.map(m => m.id + ':' + m.tier),
    ['ma.faits:or', 'fr.conjug:argent', 'ma.operations:argent', 'fr.fluence:bronze']);
  /* fiche de janvier : chaque axe repart de sa valeur (n = 4, src 'eval'), vocabulaire jamais joué */
  applyEval(p, { source: 'Repères', date: '2027-01', classe: 'CM2',
    fr: { 'fr.vocab': 2.9, 'fr.conjug': 2.3, 'fr.fluence': 1.6 }, ma: { 'ma.faits': 2.8, 'ma.operations': 2.4, 'ma.ligne': 1.2 } }, '2027-01-15');
  assert.equal(p.skills['ma.faits'].n, 4);
  assert.equal(p.skills['ma.faits'].src, 'eval');
  const after = earnedMedals(p);
  assert.deepEqual(after, before, 'médailles perdues après la nouvelle fiche');
  assert.ok(!after.some(m => m.id === 'fr.vocab'), 'médaille sur une compétence jamais jouée');
});

test('lecture à voix haute : une lecture chronométrée compte comme jouée ; une nouvelle fiche ne remet pas les réponses à zéro', () => {
  const p = defaultProfile({ id: 'p1', name: 'Léa', classe: 'CM2', today: '2026-09-01' });
  applyEval(p, { source: 'Repères', date: '2026-09', classe: 'CM2',
    fr: { 'fr.fluence': 1.2, 'fr.conjug': 1.0 }, ma: { 'ma.faits': 1.1 } }, '2026-09-20');
  /* lectures de la course : mesures de mots lus par minute, que l'historique (plafonné) ne contient plus */
  p.mclm.push({ d: '2026-10-01', t: Date.parse('2026-10-01'), s: 'pomme', v: 96, p: 95, z: 90 },
    { d: '2026-10-03', t: Date.parse('2026-10-03'), s: 'foret', v: 101, p: 96, z: 92 });
  p.skills['fr.fluence'] = { t: 1.7, n: 4 + 9, last: '2026-10-03', trend: 0.2, src: 'eval' };
  /* tables : trois parties de 10 réponses dans l'historique */
  p.skills['ma.faits'] = { t: 2.8, n: 4 + 30, last: '2026-10-02', trend: 0.2, src: 'eval' };
  for (let i = 1; i <= 3; i++) p.history.push({ d: '2026-10-0' + i, t: Date.parse('2026-10-0' + i), g: 'tables', ax: 'ma.faits', n: 10, ok: 8, hint: 0, ms: 120000, th: 2.8, mode: 'balade' });
  const before = earnedMedals(p).map(m => m.id + ':' + m.tier);
  assert.deepEqual(before, ['ma.faits:or', 'fr.fluence:bronze']);
  assert.equal(answerCount(p, 'ma.faits'), 30);
  /* fiche de janvier (mêmes valeurs) : n = 4 partout, plus aucune réponse « observée » */
  applyEval(p, { source: 'Repères', date: '2027-01', classe: 'CM2',
    fr: { 'fr.fluence': 1.7, 'fr.conjug': 1.1 }, ma: { 'ma.faits': 2.8 } }, '2027-01-15');
  assert.equal(p.skills['fr.fluence'].n, 4);
  assert.deepEqual(earnedMedals(p).map(m => m.id + ':' + m.tier), before, 'médaille de lecture perdue après la nouvelle fiche');
  assert.ok(playedAxis(p, 'fr.fluence'), 'lecture chronométrée non comptée comme jouée');
  assert.ok(!playedAxis(p, 'fr.conjug'), 'fiche seule comptée comme jouée');
  assert.equal(answerCount(p, 'ma.faits'), 30, 'réponses remises à zéro par la nouvelle fiche');
  assert.equal(answerCount(p, 'fr.fluence'), 2, 'lectures de la course non comptées');
  assert.equal(answerCount(p, 'fr.conjug'), 0);
});

test('rappels : la notification de confirmation n’annonce jamais un rappel qui ne partira pas', async () => {
  const bodies = [];
  const N = function (title, o) { bodies.push(o && o.body); };
  N.permission = 'default';
  N.requestPermission = () => Promise.resolve('granted');
  await withGlobals({ localStorage: memoryStorage(), Notification: N }, async define => {
    /* onglet Chrome, appli non installée : pas de synchronisation périodique */
    const reg = { showNotification: async (t, o) => { bodies.push(o.body); } };
    define('navigator', { serviceWorker: { ready: Promise.resolve(reg) }, permissions: { query: async () => ({ state: 'prompt' }) } });
    assert.equal(await notifs.enable(), 'on');
    assert.equal(bodies.pop(), frTypo(notifs.NO_DAILY));
    /* appli installée : rappel quotidien enregistré */
    const tags = [];
    const reg2 = { periodicSync: { register: async tag => { tags.push(tag); }, getTags: async () => tags }, showNotification: async (t, o) => { bodies.push(o.body); } };
    define('navigator', { serviceWorker: { ready: Promise.resolve(reg2) }, permissions: { query: async () => ({ state: 'granted' }) } });
    assert.equal(await notifs.enable(), 'daily');
    assert.deepEqual(tags, [notifs.SYNC_TAG]);
    assert.equal(bodies.pop(), frTypo(notifs.DAILY_ON));
    /* sans service worker : notification simple, mêmes mots */
    define('navigator', {});
    assert.equal(await notifs.enable(), 'on');
    assert.equal(bodies.pop(), frTypo(notifs.NO_DAILY));
    assert.equal(bodies.length, 0);
  });
  assert.ok(!/Rappels activés/.test(SRC('js/core/notifs.js')), 'ancien texte « Rappels activés ! »');
  /* la ligne d'état de l'espace parents reprend les mêmes mots */
  assert.match(SRC('js/ui/parents.js'), /frTypo\(notifs\.NO_DAILY\)/);
});

test('triangles des résumés repliables : décoratifs, hors du nom accessible', () => {
  const css = SRC('css/ui/parents.css').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const block of css.split('}')) {
    const m = /content:\s*'([^']+)'/.exec(block);
    if (!m) continue;
    assert.match(block, /content:\s*'[^']+'\s*\/\s*''/, 'contenu généré lu par les lecteurs d’écran : ' + block.trim().slice(0, 80));
  }
});

test('réglage « Lire les consignes à voix haute » : masqué tant qu’aucun écran de l’enfant n’applique readAloud', () => {
  const ready = /const READ_ALOUD_READY = true/.test(SRC('js/ui/parents.js'));
  const files = ['games', 'ui'].flatMap(d => readdirSync(new URL('../js/' + d + '/', import.meta.url)).map(f => 'js/' + d + '/' + f))
    .filter(f => f.endsWith('.js') && f !== 'js/ui/parents.js');
  const applied = files.some(f => /readAloud/.test(SRC(f).replace(/\/\*[\s\S]*?\*\//g, '')));
  /* sans effet, le réglage promettait aux parents « La voix de l’appareil lit les consignes et les indices des jeux » */
  if (!applied) assert.ok(!ready, 'réglage readAloud affiché alors qu’aucun jeu ne le lit');
  assert.match(SRC('js/ui/parents.js'), /if \(READ_ALOUD_READY\) card\.appendChild/);
});

/* médailles gardées : earnedMedals montre la meilleure entre celle gardée (profile.medals) et celle gagnée en jouant */
test('Mes progrès : une médaille gardée ne disparaît pas et n’est jamais rabaissée', () => {
  const p = { id: 'p1', name: 'Zoé', classe: 'CM2', medals: { 'fr.vocab': 'or', 'ma.faits': 'or' }, skills: {}, evals: [], history: [] };
  const ids = earnedMedals(p).map(m => m.id + ':' + m.tier).sort();
  assert.deepEqual(ids, ['fr.vocab:or', 'ma.faits:or']);
  p.skills['ma.faits'] = { t: 1.6, n: 9, last: '2026-10-03', trend: 0, src: 'jeu' };
  p.history = [{ d: '2026-10-03', t: 1, g: 'tables', ax: 'ma.faits', n: 10, ok: 6, hint: 0, ms: 60000, th: 1.6, mode: 'libre' }];
  const m = earnedMedals(p).find(x => x.id === 'ma.faits');
  assert.equal(m.tier, 'or', 'θ plus bas aujourd’hui : la médaille d’or reste');
});
