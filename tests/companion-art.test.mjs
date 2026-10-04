/* Compagnon redessiné (js/ui/mount-svg.js, CDC §10.3) : contrat du rig, bonne formation, déterminisme, poids.
   Pour chaque espèce × humeur × stade × combinaison d'accessoires : SVG bien formé (analyse simple des balises et
   des attributs), dimensions (rapport 100 : 84), classes du contrat, 8 expressions (+ le visage de la tristesse),
   aucun NaN / undefined, aucun id, taille raisonnable, même entrée → même chaîne. Révision v2.1 (critique A2) : oreilles
   du lion au-dessus de la crinière, ailes du dragon masquées par les ailes de fée, vague du dauphin au premier plan,
   options shadow / phase / view, poses de mount.css portées par des variables (Chrome n'affiche pas rotate / translate
   d'un groupe dont transform est animé). */
import { test, assert } from './_t.mjs';
import { readFileSync } from 'node:fs';
import { mountSVG, mountAnchors, EXPRESSIONS, MOODS } from '../js/ui/mount-svg.js';
import { MOUNTS, SHOP } from '../js/content/companion-data.js';

const TYPES = Object.keys(MOUNTS);
const MOOD_SET = ['', ...MOODS, 'joy dance', 'sad walk'];
const STAGES = [undefined, 1, 2, 3];
const ALL_IDS = SHOP.map(s => s.id);
/* combinaisons : rien, chaque objet seul, un objet par emplacement (deux jeux), tout (conflits d'emplacement) */
const COMBOS = [[], ...ALL_IDS.map(id => [id]),
  ['ailes', 'noeud', 'selle', 'echarpe', 'couronne', 'lunettes'],
  ['ailes', 'noeud', 'selle', 'foulard', 'chapeau', 'lunettes'],
  ALL_IDS];

/* classes du contrat (docs/ARCHITECTURE.md) */
const CONTRACT = ['m-root', 'c-rig', 'c-shadow', 'c-all', 'm-body', 'm-legF', 'm-legB', 'c-leg', 'm-tail', 'c-tail-tip',
  'c-head', 'm-ear', 'c-ear-l', 'c-ear-r', 'c-mane', 'c-face', 'c-eyes', 'c-eye', 'c-pupil', 'm-lid', 'c-cheek', 'c-nose',
  'c-wings', 'm-mouth', ...EXPRESSIONS.map(e => 'x-' + e), 'x-sad'];
/* groupes animés en CSS (transform-box: fill-box) : ne doivent jamais porter d'attribut transform */
const ANIMATED = new Set(['c-all', 'm-body', 'c-head', 'm-tail', 'c-tail-tip', 'm-ear', 'c-leg', 'm-legF', 'm-legB', 'c-eye',
  'c-pupil', 'm-lid', 'c-cheek', 'm-mouth', 'c-wing', 'c-fw', 'c-shadow', 'c-zz', 'c-spark', 'c-glint', 'c-wave']);
const VOID_OK = new Set(['path', 'ellipse', 'circle', 'rect']);

/* analyse minimale : balises équilibrées, attributs nom="valeur" uniques ; renvoie la liste des éléments */
function parse(svg) {
  const els = [], stack = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+="[^"<>]*")*)\s*(\/?)>/g;
  let m, last = 0;
  while ((m = re.exec(svg))) {
    assert.equal(svg.slice(last, m.index).trim(), '', 'texte inattendu entre deux balises : « ' + svg.slice(last, m.index).slice(0, 40) + ' »');
    last = re.lastIndex;
    const [, close, tag, attrStr, selfClose] = m;
    if (close) {
      assert.ok(!attrStr && !selfClose, 'balise fermante malformée');
      assert.equal(stack.pop(), tag, 'balise </' + tag + '> mal imbriquée');
      continue;
    }
    const attrs = {};
    for (const a of attrStr.matchAll(/([\w:-]+)="([^"]*)"/g)) {
      assert.ok(!(a[1] in attrs), 'attribut en double : ' + a[1] + ' sur <' + tag + '>');
      attrs[a[1]] = a[2];
    }
    const el = { tag, attrs, cls: (attrs.class || '').split(/\s+/).filter(Boolean), depth: stack.length };
    els.push(el);
    if (selfClose) assert.ok(VOID_OK.has(tag), '<' + tag + '/> auto-fermant inattendu');
    else { assert.ok(tag === 'svg' || tag === 'g', 'conteneur inattendu : <' + tag + '>'); stack.push(tag); }
  }
  assert.equal(svg.slice(last).trim(), '', 'texte après la dernière balise');
  assert.equal(stack.length, 0, 'balises non fermées : ' + stack.join(','));
  return els;
}

function checkOne(type, worn, size, mood, opts) {
  const svg = mountSVG(type, worn, size, mood, opts);
  assert.equal(typeof svg, 'string');
  assert.ok(!/NaN|undefined|null|Infinity|\[object/.test(svg), `${type} ${mood} : valeur invalide dans le SVG`);
  assert.ok(!/\sid="/.test(svg), 'aucun id (pas de collision entre compagnons)');
  const els = parse(svg);
  const root = els[0];
  assert.equal(root.tag, 'svg');
  const t = MOUNTS[type] ? type : 'pony';
  for (const c of ['m-root', 'c-rig', 'sp-' + t]) assert.ok(root.cls.includes(c), 'racine : classe ' + c);
  for (const c of String(mood || '').split(/\s+/).filter(Boolean)) assert.ok(root.cls.includes(c), 'humeur ' + c + ' sur la racine');
  assert.equal(root.attrs['data-species'], t);
  assert.equal(root.attrs['data-expr'], EXPRESSIONS.includes(opts && opts.expr) ? opts.expr : 'neutral');
  assert.equal(root.attrs.viewBox, '0 0 100 84');
  assert.equal(+root.attrs.width, size);
  assert.equal(+root.attrs.height, Math.round(size * 0.84));
  const has = new Set(els.flatMap(e => e.cls));
  for (const c of CONTRACT) assert.ok(has.has(c), `${type} : classe du contrat manquante .${c}`);
  /* 4 pattes (nageoires du dauphin), 2 par groupe */
  for (const grp of ['m-legF', 'm-legB']) {
    const i = els.findIndex(e => e.cls.includes(grp));
    const inside = [];
    for (let k = i + 1; k < els.length && els[k].depth > els[i].depth; k++) if (els[k].cls.includes('c-leg')) inside.push(els[k]);
    assert.equal(inside.length, 2, `${type} : .${grp} contient deux .c-leg`);
  }
  /* pivots en ligne sur .c-head et .m-tail */
  for (const grp of ['c-head', 'm-tail']) {
    const e = els.find(x => x.cls.includes(grp));
    const mm = /transform-origin:(-?[\d.]+)% (-?[\d.]+)%/.exec(e.attrs.style || '');
    assert.ok(mm && Number.isFinite(+mm[1]) && Number.isFinite(+mm[2]), `${type} : pivot de .${grp}`);
  }
  /* groupes animés sans attribut transform (sinon fill-box décalerait la transformation statique) */
  /* (.m-lid fait exception : son transform="scale(1 0)" ne sert qu'au rendu sans CSS ; la CSS le remplace) */
  for (const e of els) if (e.cls.some(c => ANIMATED.has(c)) && !e.cls.includes('m-lid')) assert.ok(!('transform' in e.attrs), `${type} : .${e.cls.join('.')} porte un transform`);
  /* rendu sans CSS : seule l'expression neutre est affichée, paupières repliées, « z » masqués */
  for (const e of els.filter(x => x.cls.includes('c-x'))) assert.equal(e.attrs.display, e.cls.includes('x-neutral') ? undefined : 'none', 'affichage par défaut de .' + e.cls.join('.'));
  for (const e of els.filter(x => x.cls.includes('m-lid'))) assert.equal(e.attrs.transform, 'scale(1 0)');
  const zz = els.filter(x => x.cls.includes('c-zz'));
  assert.equal(zz.length, 2, 'deux « z »');
  for (const z of zz) assert.equal(z.attrs.display, 'none');
  /* accessoires : un par emplacement (ordre de SHOP), rien d'autre */
  const expect = new Set();
  const slots = new Set();
  for (const it of SHOP) if ((worn || []).includes(it.id) && !slots.has(it.slot)) { slots.add(it.slot); expect.add(it.id); }
  for (const id of ALL_IDS) assert.equal(has.has('acc-' + id), expect.has(id), `${type} : accessoire ${id} ${expect.has(id) ? 'absent' : 'en trop'}`);
  return svg;
}

test('compagnon : contrat du rig pour toutes les espèces × humeurs × stades × accessoires', () => {
  let n = 0;
  for (const type of TYPES) for (const mood of MOOD_SET) for (const stage of STAGES) for (const worn of COMBOS) {
    checkOne(type, worn, 100, mood, stage === undefined ? undefined : { stage });
    n++;
  }
  assert.ok(n > 1000, n + ' combinaisons');
});

test('compagnon : expressions initiales et valeur par défaut', () => {
  for (const type of TYPES) for (const expr of [...EXPRESSIONS, 'inconnue', undefined]) checkOne(type, [], 120, '', { expr });
});

test('compagnon : dimensions (rapport 100 : 84 de la v11) et tailles extrêmes', () => {
  for (const size of [46, 50, 58, 66, 92, 100, 135, 190, 220]) {
    const svg = mountSVG('cat', [], size, '');
    assert.ok(svg.includes(`width="${size}" height="${Math.round(size * 0.84)}"`), 'taille ' + size);
  }
  for (const bad of [0, -5, NaN, '12abc', undefined]) {
    const svg = mountSVG('pony', [], bad, '');
    parse(svg);
    const w = +/width="([^"]+)"/.exec(svg)[1];
    assert.ok(Number.isInteger(w) && w >= 1, 'largeur valide pour ' + String(bad));
  }
});

test('compagnon : entrées inattendues (espèce inconnue → poney, worn absent, humeur nettoyée)', () => {
  const svg = checkOne('licorne-arc-en-ciel', [], 100, '', {});
  assert.ok(svg.includes('sp-pony'));
  assert.doesNotThrow(() => mountSVG('cat', null, 100, null, null));
  assert.doesNotThrow(() => mountSVG('cat', 'chapeau', 100, 'joy', 'x'));
  const evil = mountSVG('cat', [], 100, 'joy"><script>alert(1)</script>', { expr: '"><b>' });
  assert.ok(!evil.includes('<script') && !evil.includes('<b>'), 'humeur et expression assainies');
  parse(evil);
});

test('compagnon : déterministe (même entrée → même chaîne, quel que soit l\'ordre des appels)', () => {
  const args = [['dragon', ['ailes', 'couronne'], 100, 'walk', { stage: 3 }], ['capy', [], 46, '', { expr: 'happy' }], ['dolphin', ALL_IDS, 220, 'sleep', {}]];
  const first = args.map(a => mountSVG(...a));
  mountSVG('unicorn', ['echarpe'], 77, 'dance', { stage: 1 });
  const again = args.slice().reverse().map(a => mountSVG(...a)).reverse();
  assert.deepEqual(again, first);
});

test('compagnon : poids du SVG (≈ 8 Ko par personnage avec ses 8 expressions, accessoires en plus)', () => {
  for (const type of TYPES) {
    const base = mountSVG(type, [], 100, '').length;
    const two = mountSVG(type, ['chapeau', 'foulard'], 100, '').length;
    const all = mountSVG(type, ['ailes', 'noeud', 'selle', 'echarpe', 'couronne', 'lunettes'], 100, '', { stage: 3 }).length;
    /* mesuré après la révision v2.1 : 8,6 à 10,9 Ko sans accessoire (8 expressions + le visage triste, bulle du petit
       creux, vague du dauphin, ailes à doigts du dragon), + 0,5 à 0,9 Ko par accessoire */
    assert.ok(base <= 11500, `${type} : ${base} octets sans accessoire`);
    assert.ok(two <= 13000, `${type} : ${two} octets avec deux accessoires`);
    assert.ok(all <= 16600, `${type} : ${all} octets tout équipé`);
  }
});

test('compagnon : les stades changent le dessin sans casser le contrat', () => {
  for (const type of TYPES) {
    const [a, b, c] = [1, 2, 3].map(stage => mountSVG(type, [], 100, '', { stage }));
    assert.notEqual(a, b); assert.notEqual(b, c);
    assert.ok(c.includes('c-rosette'), type + ' : rosette du champion');
    assert.ok(!b.includes('c-rosette'));
    assert.ok(a.includes('data-stage="1"') && b.includes('data-stage="2"') && c.includes('data-stage="3"'));
  }
});

test('révision : oreilles du lion visibles, ailes de fée à la place des ailes du dragon, vague du dauphin, mandarine', () => {
  /* lion : les oreilles sont dessinées APRÈS la crinière (sinon elle les recouvre) */
  const lion = parse(mountSVG('lion', [], 100, ''));
  const iEar = lion.findIndex(e => e.cls.includes('m-ear')), iMane = lion.findIndex(e => e.cls.includes('c-mane-b'));
  assert.ok(iMane >= 0 && iEar > iMane, 'oreilles du lion après la crinière');
  for (const type of TYPES.filter(t => t !== 'lion')) {
    const els = parse(mountSVG(type, [], 100, ''));
    assert.ok(els.findIndex(e => e.cls.includes('m-ear')) < els.findIndex(e => e.cls.includes('c-mane-b')), type + ' : oreilles derrière la crinière');
  }
  /* dragon : ses ailes s'effacent quand il porte les ailes de fée (pas de fouillis), le groupe reste */
  const wingsOf = svg => { const els = parse(svg); const i = els.findIndex(e => e.cls.includes('c-wings')); return els.slice(i + 1).filter(e => e.depth > els[i].depth && e.cls.includes('c-wing')).length; };
  assert.equal(wingsOf(mountSVG('dragon', [], 100, '')), 2);
  assert.equal(wingsOf(mountSVG('dragon', ['ailes'], 100, '')), 0);
  assert.ok(mountSVG('dragon', ['ailes'], 100, '').includes('acc-ailes'));
  /* dauphin : vague au premier plan, HORS de .c-all (il saute hors de l'eau), après le corps ; rien d'autre n'en a */
  for (const type of TYPES) {
    const els = parse(mountSVG(type, [], 100, 'joy'));
    const iWave = els.findIndex(e => e.cls.includes('c-wave')), iAll = els.findIndex(e => e.cls.includes('c-all'));
    if (type !== 'dolphin') { assert.equal(iWave, -1, type + ' : pas de vague'); continue; }
    assert.ok(iWave > iAll && els[iWave].depth === els[iAll].depth, 'vague au premier plan, sœur de .c-all');
  }
  /* capybara : la mandarine (cercle #ffa33a dans .x-happy, cherché par companion-life.js) sans chapeau ni couronne */
  const capy = mountSVG('capy', [], 100, '');
  const happy = capy.slice(capy.indexOf('class="c-x x-happy"'));
  assert.ok(/^[^]*?<circle[^>]*fill="#ffa33a"/.test(happy.slice(0, happy.indexOf('class="c-x x-delighted"'))), 'mandarine dans .x-happy');
  assert.ok(!mountSVG('capy', ['chapeau'], 100, '').includes('#ffa33a'), 'pas de mandarine sous un chapeau');
});

test('options : sans ombre, phase, portrait (carré centré sur la tête), contour affiné en grand', () => {
  for (const type of TYPES) {
    const no = parse(mountSVG(type, [], 100, '', { shadow: false }));
    const i = no.findIndex(e => e.cls.includes('c-shadow'));
    assert.ok(i >= 0, type + ' : groupe .c-shadow conservé');
    assert.ok(!no[i + 1] || no[i + 1].depth <= no[i].depth, type + ' : ombre vide');
    const ph = parse(mountSVG(type, [], 100, '', { phase: 2.5 }))[0];
    assert.equal(ph.attrs.style, '--c-ph:-2.5s');
    assert.ok(!('style' in parse(mountSVG(type, [], 100, ''))[0].attrs), 'pas de style sans phase');
    const pt = parse(mountSVG(type, ['chapeau'], 50, 'joy', { view: 'portrait', stage: 1 }))[0];
    assert.equal(pt.attrs.width, '50'); assert.equal(pt.attrs.height, '50');
    assert.equal(pt.attrs.overflow, 'hidden');
    const [x, y, w, h] = pt.attrs.viewBox.split(' ').map(Number);
    assert.ok(w === h && w > 25 && w < 60, type + ' : cadre carré ' + pt.attrs.viewBox);
    const a = mountAnchors(type, { stage: 1 });
    for (const p of [a.mouth, ...a.eyes]) assert.ok(p[0] > x && p[0] < x + w && p[1] > y && p[1] < y + h, type + ' : visage dans le portrait');
  }
  /* contour : 2,3 u jusqu'à 140 px, puis ≈ 3 px à l'écran (JEUX §0) */
  const widths = svg => new Set([...svg.matchAll(/stroke-width="([\d.]+)"/g)].map(m => +m[1]));
  assert.ok(widths(mountSVG('pony', [], 135, '')).has(2.3));
  const big = widths(mountSVG('pony', [], 190, ''));
  assert.ok(!big.has(2.3) && big.has(1.7), 'contour affiné à 190 px');
});

test('mount.css : crochets de compatibilité (marche « step », témoin de danse, mouvement réduit, expressions)', () => {
  const css = readFileSync(new URL('../css/ui/mount.css', import.meta.url), 'utf8');
  assert.ok(/@keyframes step\b/.test(css), 'keyframes « step » (tables.js règle leur vitesse par ce nom)');
  assert.ok(/\.c-rig\.dance\s*\{[^}]*animation:/.test(css), 'animation témoin sur la racine en danse (companion.js, balade.js)');
  assert.ok(/prefers-reduced-motion/.test(css) && /html\.motion-soft/.test(css), 'mouvement réduit et animations douces');
  assert.ok(/transform-box:\s*fill-box/.test(css));
  for (const e of EXPRESSIONS.filter(x => x !== 'neutral')) assert.ok(css.includes(`[data-expr="${e}"] .x-${e}`), 'affichage de .x-' + e);
  for (const m of MOODS) assert.ok(new RegExp('\\.c-rig\\.' + m + '\\b').test(css), 'humeur .' + m);
  assert.ok(css.includes('.c-rig.sad[data-expr="neutral"] .x-sad'), 'visage de la tristesse');
  /* Chrome ne dessine pas rotate / translate d'un groupe dont transform est animé : aucune pose de ce type sur la tête,
     le torse ou la queue (elles passent par les variables de la racine, reprises dans les keyframes) */
  const rules = [...css.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  for (const [, sel, body] of rules) {
    if (!/\.(c-head|m-body|m-tail)\b/.test(sel) || /@|%|from|to\b/.test(sel.trim().split(/\s+/)[0])) continue;
    assert.ok(!/(^|;|\s)(rotate|translate)\s*:/.test(body), 'pose interdite (rotate / translate) : ' + sel.trim());
  }
  /* les keyframes jouées par ces groupes reprennent la pose */
  for (const k of ['c-breathe', 'c-breathe-deep', 'c-breathe-soft', 'c-nod', 'c-look', 'c-tail', 'c-swish', 'c-fluke', 'c-chew-head', 'step']) {
    const m = new RegExp('@keyframes ' + k + '\\s*\\{([^]*?)\\n\\}').exec(css) || new RegExp('@keyframes ' + k + '\\s*\\{(.*)\\}').exec(css);
    assert.ok(m, 'keyframes ' + k);
    const frames = m[1].match(/transform:[^;}]*/g) || [];
    assert.ok(frames.length >= 2 && frames.every(f => f.includes('translate(var(--px), var(--py)) rotate(var(--pr))')), 'pose reprise dans ' + k);
  }
  for (const v of ['--c-hr', '--c-hy', '--c-by', '--c-tr', '--c-ty']) assert.ok(new RegExp('@property ' + v + '\\s*\\{[^}]*inherits:\\s*true').test(css), '@property ' + v);
});

test('mountAnchors : points d\'ancrage finis, dans le cadre, bouche devant les yeux (tourné vers la droite)', () => {
  for (const type of [...TYPES, 'inconnu']) for (const stage of [1, 2, 3]) {
    const a = mountAnchors(type, { stage });
    const pts = [a.mouth, a.top, a.neck, a.back, a.chest, a.tail, ...a.eyes];
    for (const p of pts) {
      assert.equal(p.length, 2);
      assert.ok(p.every(Number.isFinite), `${type} : ${p}`);
      assert.ok(p[0] > -10 && p[0] < 110 && p[1] > -15 && p[1] < 84, `${type} stade ${stage} : point hors cadre ${p}`);
    }
    assert.ok(a.mouth[0] > Math.min(...a.eyes.map(e => e[0])), `${type} : bouche à droite des yeux`);
    assert.ok(a.top[1] < a.mouth[1], `${type} : sommet de tête au-dessus de la bouche`);
    assert.ok(Math.abs(a.ground - 74) < 0.5, 'sol à y ≈ 74 (cloture.js : FEET = 0,74)');
  }
});
