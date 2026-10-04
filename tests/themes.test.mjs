/* Thèmes visuels (v2.1) : catalogue, présélection, normalisation, et css/themes.css lu comme du texte :
   chaque thème redéfinit TOUS les jetons thémables, contraste AA (≥ 4,5:1) de chaque texte sur ses fonds,
   pas de rose dans les thèmes qui ne le sont pas, aucune marque, cohérence avec index.html. */
import { test, assert } from './_t.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES, THEME_IDS, DEFAULT_THEME, normalizeTheme, defaultThemeFor, themeOf, isTheme } from '../js/core/themes.js';
import { defaultProfile, normalizeProfile, DEFAULT_SETTINGS } from '../js/core/profiles.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(join(root, f), 'utf8');
const IDS = ['caramel', 'licorne', 'princesse', 'superheros', 'dinosaures', 'bolides', 'espace', 'ocean'];
const PINK_OK = new Set(['caramel', 'licorne', 'princesse']);           /* thèmes où le rose est voulu */
const BRANDS = /marvel|\bdc\b|disney|pixar|spider|batman|superman|avengers|iron ?man|hulk|ferrari|mclaren|flash mcqueen|jurassic|nasa|barbie|reine des neiges|frozen|nemo|dory/i;

/* ---------- lecture des CSS ---------- */
function decls(body) {
  const out = {};
  for (const m of body.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
function blockAfter(css, head) {
  const i = css.indexOf(head);
  if (i < 0) return null;
  const a = css.indexOf('{', i), b = css.indexOf('}', a);
  return decls(css.slice(a + 1, b));
}
const BASE = read('css/base.css'), THEMES_CSS = read('css/themes.css');
const CARAMEL = blockAfter(BASE, ':root, [data-theme="caramel"]');
const FIXED = blockAfter(BASE, ':root {');
const TOKENS = {};
for (const id of IDS) TOKENS[id] = id === 'caramel' ? CARAMEL : blockAfter(THEMES_CSS, '[data-theme="' + id + '"] {');

/* ---------- couleurs ---------- */
const HEX = /^#[0-9a-f]{6}$/i;
function rgb(h) { const x = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16)); }
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = h => { const [r, g, b] = rgb(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function hsl(h) {
  const [r, g, b] = rgb(h).map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hh *= 60; if (hh < 0) hh += 360;
  return { h: hh, s, l };
}
/* valeur hexadécimale d'un jeton (jetons du thème, sinon jetons fixes ; var(--x) suivi) */
function val(id, k, depth = 0) {
  if (k.startsWith('#')) return k;
  const v = (TOKENS[id] && TOKENS[id][k]) || FIXED[k];
  if (!v) return null;
  const m = /^var\((--[\w-]+)\)$/.exec(v);
  return m && depth < 4 ? val(id, m[1], depth + 1) : v;
}

/* jetons que chaque thème DOIT redéfinir (sinon une carte d'aperçu hériterait du thème de la page) */
const THEMABLE = Object.keys(CARAMEL);

/* paires texte / fond exigées à 4,5:1 (usages réels des écrans, cf. css/) */
const BGS_INK = ['--card', '--bg-1', '--bg-2', '--bg-3', '--pink-50', '--pink-100', '--amber-50', '--amber-100', '--amber-200', '--panel-bg'];
const PAIRS = [
  ...BGS_INK.map(b => ['--ink', b]),
  ...BGS_INK.map(b => ['--ink-2', b]),
  ...['--card', '--bg-1', '--bg-2', '--bg-3', '--pink-50', '--amber-50', '--amber-100', '--panel-bg'].map(b => ['--ink-3', b]),
  ...['--card', '--bg-1', '--bg-2', '--bg-3', '--pink-50', '--amber-50', '--amber-100', '--panel-bg'].map(b => ['--title', b]),
  ...['--card', '--pink-50', '--pink-100'].map(b => ['--pink-800', b]),
  ...['--amber-400', '--amber-300', '--amber-200', '--amber-100', '--amber-50', '--card'].map(b => ['--amber-900', b]),
  ['#ffffff', '--ink'], ['#ffffff', '--title'],
  ...['course', 'cloture', 'tables', 'pommes', 'orchestre', 'operations'].flatMap(g => [['--ink', '--tile-' + g], ['--ink-2', '--tile-' + g]])
];

/* ============ catalogue ============ */
test('thèmes : 8 thèmes, ids stables, fiches complètes, libellés neutres et sans marque', () => {
  assert.deepEqual([...THEME_IDS], IDS);
  assert.equal(DEFAULT_THEME, 'caramel');
  assert.ok(Object.isFrozen(THEMES) && THEMES.every(t => Object.isFrozen(t) && Object.isFrozen(t.party)));
  for (const t of THEMES) {
    assert.ok(typeof t.name === 'string' && t.name.length >= 3, t.id + ' : nom');
    assert.ok(typeof t.emoji === 'string' && t.emoji, t.id + ' : emoji');
    assert.ok(typeof t.blurb === 'string' && t.blurb.length >= 8, t.id + ' : description');
    assert.match(t.bar, HEX, t.id + ' : couleur de barre');
    assert.ok(t.party.length >= 3 && t.party.every(e => typeof e === 'string' && e), t.id + ' : emojis de fête');
    assert.equal(typeof t.sticker, 'string');
    assert.ok(!/fille|garçon|garcon/i.test(t.name + ' ' + t.blurb), t.id + ' : libellé neutre');
    assert.ok(!BRANDS.test(t.name + ' ' + t.blurb), t.id + ' : aucune marque');
    assert.ok(/^[a-z]{3,12}$/.test(t.id), t.id + ' : id accepté par le script de démarrage (index.html)');
  }
  assert.ok(!BRANDS.test(THEMES_CSS) && !BRANDS.test(read('js/core/themes.js')), 'aucune marque dans les thèmes');
});

test('thèmes : présélection selon le genre (fille → Caramel, garçon → Dinosaures), sans exclusivité', () => {
  assert.equal(defaultThemeFor('f'), 'caramel');
  assert.equal(defaultThemeFor('m'), 'dinosaures');
  for (const g of [undefined, null, '', 'x', 42]) assert.equal(defaultThemeFor(g), 'caramel');
  /* tout thème reste choisissable par tout profil */
  for (const g of ['f', 'm']) for (const id of IDS) {
    const p = defaultProfile({ id: 'p1', name: 'Sam', g, today: '2026-10-03' });
    p.settings.theme = id;
    assert.equal(normalizeProfile(p, '2026-10-03').settings.theme, id);
  }
});

test('thèmes : normalisation (id inconnu → Caramel) et réglage du profil', () => {
  for (const id of IDS) { assert.equal(normalizeTheme(id), id); assert.ok(isTheme(id)); assert.equal(themeOf(id).id, id); }
  assert.equal(normalizeTheme(' Licorne '), 'licorne');
  assert.equal(normalizeTheme('OCEAN'), 'ocean');
  for (const bad of [undefined, null, '', 'marvel', 'océan', 'super-heros', 42, {}, ['espace']]) {
    assert.equal(normalizeTheme(bad), 'caramel', JSON.stringify(bad));
    assert.equal(themeOf(bad).id, 'caramel');
  }
  assert.equal(isTheme('Licorne'), false, 'isTheme : id exact seulement');
  assert.equal(DEFAULT_SETTINGS.theme, 'caramel');
  assert.equal(defaultProfile({ g: 'm', today: '2026-10-03' }).settings.theme, 'caramel', 'défaut du profil (la présélection est faite par l’arrivée)');
  const p = normalizeProfile({ name: 'Lou', settings: { theme: 'inconnu', sessionMin: 10 } }, '2026-10-03');
  assert.equal(p.settings.theme, 'caramel');
  assert.equal(p.settings.sessionMin, 10);
  const q = normalizeProfile({ name: 'Lou', settings: { theme: 'Espace' } }, '2026-10-03');
  assert.equal(q.settings.theme, 'espace');
  assert.equal(JSON.stringify(normalizeProfile(q, '2027-01-01')), JSON.stringify(q), 'idempotent');
  assert.equal(normalizeProfile({ name: 'Lou' }, '2026-10-03').settings.theme, 'caramel', 'profil v2.0 sans thème');
});

/* ============ css/themes.css ============ */
test('thèmes CSS : chaque thème redéfinit tous les jetons thémables (cartes d’aperçu justes partout)', () => {
  assert.ok(CARAMEL && THEMABLE.length >= 30, 'bloc Caramel de base.css : ' + THEMABLE.length + ' jetons');
  for (const k of ['--bg-1', '--bg-pattern', '--ink', '--title', '--pink-200', '--amber-400', '--amber-900', '--shade', '--accent', '--focus', '--ava-ring', '--tile-course'])
    assert.ok(THEMABLE.includes(k), 'jeton thémable ' + k);
  for (const id of IDS) {
    const t = TOKENS[id];
    assert.ok(t, id + ' : bloc [data-theme] présent');
    const missing = THEMABLE.filter(k => !(k in t));
    assert.deepEqual(missing, [], id + ' : jetons manquants');
    assert.equal(t['--bg-1'].toLowerCase(), themeOf(id).bar, id + ' : barre d’état = --bg-1');
    for (const k of THEMABLE) {
      if (/^--(bg|ink|title|pink|amber|shade|accent|focus|panel|tile)/.test(k) && !/pattern/.test(k)) assert.match(val(id, k), HEX, id + ' ' + k);
    }
    if (id !== 'caramel') {
      assert.match(t['--bg-pattern'], /^url\("data:image\/svg\+xml,%3Csvg /, id + ' : motif SVG');
      const svg = decodeURIComponent(t['--bg-pattern'].slice(5, -2).replace(/^data:image\/svg\+xml,/, ''));
      assert.ok(/^<svg [^>]*width='\d+' height='\d+'/.test(svg) && svg.endsWith('</svg>'), id + ' : SVG du motif');
      assert.ok(svg.length < 3000, id + ' : motif léger (' + svg.length + ' car.)');
    }
  }
  assert.equal(CARAMEL['--bg-pattern'], 'none', 'Caramel : aucun motif (inchangé)');
});

test('thèmes CSS : contraste AA (≥ 4,5:1) de chaque texte sur ses fonds, dans chaque thème', () => {
  const report = [];
  for (const id of IDS) {
    let min = Infinity, worst = '';
    for (const [f, b] of PAIRS) {
      const a = val(id, f), c = val(id, b);
      assert.ok(a && c, id + ' : ' + f + ' / ' + b + ' lisibles');
      const r = contrast(a, c);
      assert.ok(r >= 4.5, `${id} : ${f} sur ${b} = ${r.toFixed(2)}:1`);
      if (r < min) { min = r; worst = f + ' / ' + b; }
    }
    report.push(id + ' ' + min.toFixed(2) + ' (' + worst + ')');
  }
  console.log('    contraste minimal par thème : ' + report.join(' · '));
});

test('thèmes CSS : pas de rose dans les thèmes qui ne sont pas roses', () => {
  for (const id of IDS) {
    if (PINK_OK.has(id)) continue;
    for (const k of THEMABLE) {
      const v = val(id, k);
      if (!v || !HEX.test(v)) continue;
      const c = hsl(v);
      assert.ok(!(c.h >= 295 && c.h <= 345 && c.s >= 0.3 && c.l > 0.15), `${id} ${k} = ${v} (teinte ${Math.round(c.h)}°) : rose`);
    }
    for (const m of TOKENS[id]['--bg-pattern'].matchAll(/%23([0-9a-f]{6})/gi)) {
      const c = hsl('#' + m[1]);
      assert.ok(!(c.h >= 295 && c.h <= 345 && c.s >= 0.3), `${id} : motif rose #${m[1]}`);
    }
  }
});

test('thèmes : index.html charge themes.css après base.css et pose le thème mémorisé avant l’affichage', () => {
  const html = read('index.html');
  const a = html.indexOf('href="css/base.css"'), b = html.indexOf('href="css/themes.css"');
  assert.ok(a > 0 && b > a, 'css/themes.css après css/base.css');
  const s = html.indexOf("localStorage.getItem('caramel-theme')");
  assert.ok(s > 0 && s < a, 'script du thème avant les feuilles de style');
  const re = /\/\^\(\[a-z\]\{3,12\}\)\\\|\(#\[0-9a-f\]\{6\}\)\$\//;
  assert.ok(re.test(html), 'format du cache « id|#couleur »');
  for (const t of THEMES) assert.ok(/^([a-z]{3,12})\|(#[0-9a-f]{6})$/.test(t.id + '|' + t.bar), t.id + ' : cache lisible au démarrage');
});
