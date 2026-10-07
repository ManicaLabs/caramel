/* Problèmes (axe ma.problemes, « Les Missions du ranch ») — générateur js/content/maths/problemes.js.
   Beaucoup de tirages par classe et par palier : réponses justes (calcul refait), nombres dans les bornes du programme,
   énoncés bien écrits (accords, pluriels, élisions, inversions, typographie), six choix au format Repères,
   contre-exemples aux mots inducteurs, calendrier des notions. */
import { test, assert } from './_t.mjs';
import { makeRng } from '../js/core/rng.js';
import { fillTemplate } from '../js/core/profiles.js';
import {
  axis, gen, KIND_IDS, KIND_INFO, NOTIONS, FAMILIES, CALENDAR, atLevel, choiceMode, elides, de, qn, inv, NAMES, POOL
} from '../js/content/maths/problemes.js';

/* échantillon : A de 0 à 5,6 (pas 0,1) × 40 graines, puis chaque gabarit imposé à plusieurs niveaux */
const ITEMS = [];
for (let i = 0; i <= 56; i++) {
  const rng = makeRng('pb-' + i);
  for (let k = 0; k < 40; k++) ITEMS.push(gen(i / 10, rng));
}
for (const kind of KIND_IDS) for (const A of [0, 1, 2, 3, 4, 5.6]) {
  const rng = makeRng('pb-kind-' + kind + A);
  for (let k = 0; k < 15; k++) ITEMS.push(gen(A, rng, { kind }));
}
/* profils de remplissage des jetons : prénoms et compagnons qui commencent par une voyelle (élisions), deux genres */
const PROFILES = [
  { name: 'Inès', g: 'f', companion: { type: 'unicorn', name: 'Olive' } },
  { name: 'Yanis', g: 'm', companion: { type: 'pony', name: 'Éclair' } },
  { name: 'Léo', g: 'm', companion: { type: 'horse', name: 'Hermès' } },
  { name: 'Zoé', g: 'f', companion: { type: 'dragon', name: 'Caramel' } }
];
const allTexts = it => [...it.data.sentences, it.data.question, it.hint, it.explain, it.data.answerText,
  it.data.steps.comprendre, it.data.steps.modeliser, it.data.steps.repondre, ...it.data.steps.calculer,
  ...it.data.inter.map(x => x.txt), it.unit];
const filled = it => PROFILES.flatMap(p => allTexts(it).map(t => fillTemplate(t, p)));
const NUM_RE = /\d+(?:[\u202F]\d{3})*(?:,\d+)?/g;
const toNum = s => Number(s.replace(/\u202F/g, '').replace(',', '.'));

test('contrat : axe, champs de l’item, déterminisme', () => {
  assert.equal(axis, 'ma.problemes');
  for (const it of ITEMS) {
    assert.equal(it.axis, 'ma.problemes');
    assert.ok(KIND_IDS.includes(it.kind), it.kind);
    assert.match(it.key, /^ma\.problemes:[a-z0-9]+:[\d.-]+:[a-zé0-9-]+$/u, it.key);
    assert.ok(typeof it.prompt === 'string' && it.prompt.length > 20);
    assert.ok(it.A >= 0 && it.A <= 5.6);
    assert.equal(it.leitner, false);
    assert.ok(it.hint && it.explain && it.unit, it.key);
    for (const ph of ['Comprendre', 'Modéliser', 'Calculer', 'Répondre']) assert.ok(it.explain.includes(ph), ph);
    assert.ok(['choices', 'keypad'].includes(it.data.mode));
  }
  for (const A of [0, 0.7, 1.5, 2.6, 3.8, 5.6]) {
    const a = gen(A, makeRng('det-' + A)), b = gen(A, makeRng('det-' + A));
    assert.deepEqual(a, b, 'même graine → même item (A = ' + A + ')');
  }
});

test('tous les gabarits sortent à leur niveau, et chacun couvre A de 0 à 5,6 (remédiation)', () => {
  const seen = new Set(ITEMS.map(it => it.kind));
  for (const k of KIND_IDS) assert.ok(seen.has(k), 'gabarit jamais tiré : ' + k);
  /* tirage libre : un gabarit n'arrive jamais avant son niveau */
  for (let i = 0; i <= 56; i++) {
    const rng = makeRng('lo-' + i);
    for (let k = 0; k < 30; k++) {
      const it = gen(i / 10, rng);
      assert.ok(KIND_INFO[it.kind].lo <= i / 10 + 1e-9, it.kind + ' tiré à A = ' + i / 10);
    }
  }
  /* gabarit imposé avant son arrivée : pris à son niveau */
  const it = gen(0, makeRng('force'), { kind: 'algebre' });
  assert.equal(it.kind, 'algebre');
  assert.ok(it.A >= KIND_INFO.algebre.lo);
});

test('réponses justes : le calcul refait étape par étape donne la réponse', () => {
  for (const it of ITEMS) {
    const ops = it.data.ops;
    assert.ok(ops.length >= 1 && ops.length === it.data.nsteps, it.key);
    for (const o of ops) {
      const v = o.op === '+' ? o.a + o.b : o.op === '−' ? o.a - o.b : o.op === '×' ? o.a * o.b : Math.floor(o.a / o.b + 1e-9);
      assert.ok(Math.abs(Math.round(v * 100) - Math.round(o.r * 100)) < 1, it.key + ' : ' + JSON.stringify(o));
      if (o.op === '÷') {
        if (o.rest) assert.equal(o.a - o.r * o.b, o.rest, it.key);
        else assert.ok(Math.abs(o.a / o.b - o.r) < 1e-9, 'division exacte ' + it.key);
      }
      assert.ok(o.r > 0);
    }
    assert.ok(Math.abs(ops[ops.length - 1].r - it.answer) < 1e-9, it.key);
    /* chaque opérande vient de l'énoncé, d'une étape d'avant, ou d'une constante connue (60 min, moitié, un de plus) */
    const known = new Set([...it.data.numbers, ...it.data.consts, ...ops.map(o => o.r), 60, 2, 1].map(x => Math.round(x * 100)));
    for (const o of ops) if (!o.time) for (const x of [o.a, o.b]) assert.ok(known.has(Math.round(x * 100)), it.key + ' : opérande ' + x);
    /* résultats intermédiaires : jamais la réponse, toujours positifs */
    for (const x of it.data.inter) { assert.ok(x.v > 0 && Math.abs(x.v - it.answer) > 1e-9, it.key); assert.ok(x.txt.length > 5); }
  }
});

test('réponse ≥ 2, entière (ou prix au centime), différente des nombres de l’énoncé', () => {
  for (const it of ITEMS) {
    const a = it.answer;
    if (it.data.decimals) assert.ok(Math.abs(Math.round(a * 100) - a * 100) < 1e-6 && a > 0, it.key);
    else assert.ok(Number.isInteger(a) && a >= 2, it.key + ' → ' + a);
    for (const n of it.data.numbers) {
      assert.ok(Math.abs(n - a) > 1e-9, 'nombre de l’énoncé égal à la réponse : ' + it.key);
      assert.ok(n >= 2 || (it.data.decimals && n > 0), 'nombre ≥ 2 : ' + it.key);
    }
    assert.equal(new Set(it.data.numbers).size, it.data.numbers.length, 'nombres distincts : ' + it.key);
  }
});

test('nombres dans les bornes du programme (champ numérique par classe)', () => {
  /* plus grand nombre (énoncé et réponse) permis au niveau A de l'item */
  const cap = A => (A < 0.2 ? 20 : A < 0.45 ? 30 : A < 0.7 ? 59 : A < 1 ? 100 : A < 2 ? 1000 : A < 3.4 ? 10000 : 999999);
  for (let i = 0; i <= 56; i++) {
    const A = i / 10;
    const rng = makeRng('cap-' + i);
    for (let k = 0; k < 40; k++) {
      const it = gen(A, rng);
      const all = [...it.data.numbers, it.answer, ...it.data.inter.map(x => x.v)];
      const lim = cap(Math.max(A, KIND_INFO[it.kind].lo));
      /* durées : les heures et minutes d'une horloge restent petites ; tout le reste sous le plafond */
      for (const n of all) assert.ok(n <= lim, `${it.key} : ${n} > ${lim} (A = ${A})`);
      /* CP : deux étapes et multiplicatifs ≤ 30 */
      if (Math.max(A, KIND_INFO[it.kind].lo) < 1 && (it.data.nsteps > 1 || /[×÷]/.test(it.data.ops.map(o => o.op).join('')))) {
        for (const n of all) assert.ok(n <= 30, 'CP, ≤ 30 : ' + it.key);
      }
      /* décimaux : seulement des prix, à partir du CE2 */
      if (it.data.decimals || it.data.numbers.some(n => !Number.isInteger(n))) {
        assert.ok(it.A >= 2.2, 'décimaux trop tôt : ' + it.key);
      }
    }
  }
});

test('les nombres écrits dans l’énoncé sont ceux du problème (et la donnée inutile)', () => {
  for (const it of ITEMS) {
    const nums = new Set([...it.data.numbers, ...(it.data.useless !== null ? [it.data.useless] : [])].map(x => Math.round(x * 100)));
    const text = it.data.sentences.join(' ') + ' ' + it.data.question;
    for (const m of text.match(NUM_RE) || []) {
      const v = toNum(m);
      assert.ok(nums.has(Math.round(v * 100)) || v === 0 || v === 1, `${it.key} : ${m} absent de data.numbers`);
    }
    if (it.data.useless !== null) {
      assert.ok(it.A >= 2.2, 'donnée inutile avant le CE2 : ' + it.key);
      assert.ok(it.data.sentences.includes(it.data.uselessText));
      assert.ok(!it.data.numbers.includes(it.data.useless));
    }
  }
});

/* ---------- français ---------- */
const VOWEL = /^[aeiouyàâäéèêëîïôöùûüœæ]/i;
const H_ASP = /^(haricot|hérisson|hibou|hangar|harnais|hamac|hotte)/i;
const nounGender = {};
const SG_ONLY = new Set(), PL_ONLY = new Set();
for (const [sg, pl, g] of [['pomme', 'pommes', 'f'], ['carotte', 'carottes', 'f'], ['œuf', 'œufs', 'm'], ['poney', 'poneys', 'm'],
  ['cheval', 'chevaux', 'm'], ['poule', 'poules', 'f'], ['mouton', 'moutons', 'm'], ['chèvre', 'chèvres', 'f'], ['lapin', 'lapins', 'm'],
  ['botte', 'bottes', 'f'], ['sac', 'sacs', 'm'], ['piquet', 'piquets', 'm'], ['seau', 'seaux', 'm'], ['ruban', 'rubans', 'm'],
  ['fer', 'fers', 'm'], ['boîte', 'boîtes', 'f'], ['paquet', 'paquets', 'm'], ['visiteur', 'visiteurs', 'm'], ['litre', 'litres', 'm'],
  ['euro', 'euros', 'm'], ['minute', 'minutes', 'f'], ['an', 'ans', 'm'], ['tour', 'tours', 'm'], ['place', 'places', 'f'],
  ['selle', 'selles', 'f'], ['chapeau', 'chapeaux', 'm'], ['tenue', 'tenues', 'f'], ['brosse', 'brosses', 'f'],
  ['pile', 'piles', 'f'], ['gâteau', 'gâteaux', 'm'], ['fruit', 'fruits', 'm'], ['légume', 'légumes', 'm'], ['goûter', 'goûters', 'm'],
  ['chien', 'chiens', 'm'], ['chat', 'chats', 'm'], ['arbre', 'arbres', 'm'], ['degré', 'degrés', 'm'], ['ferme', 'fermes', 'f'],
  ['râtelier', 'râteliers', 'm'], ['sachet', 'sachets', 'm'], ['kilo', 'kilos', 'm'], ['année', 'années', 'f'], ['centimètre', 'centimètres', 'm']]) {
  SG_ONLY.add(sg); PL_ONLY.add(pl); nounGender[sg] = g; nounGender[pl] = g;
}
const COLORS = { blanc: 'm1', blanche: 'f1', blancs: 'm', blanches: 'f', noir: 'm1', noire: 'f1', noirs: 'm', noires: 'f',
  brun: 'm1', brune: 'f1', bruns: 'm', brunes: 'f', roux: 'm', rousse: 'f1', rousses: 'f', gris: 'm', grise: 'f1', grises: 'f',
  vert: 'm1', verte: 'f1', verts: 'm', vertes: 'f', bleu: 'm1', bleue: 'f1', bleus: 'm', bleues: 'f', rouges: '*', jaunes: '*' };
const PP = ['gagné', 'cassé', 'reçu', 'pondu', 'produit', 'ajouté', 'mangé', 'vendu', 'arrivé'];

test('français : élisions, pluriels, inversions, participes, adjectifs, typographie', () => {
  let checked = 0;
  for (const it of ITEMS) {
    for (const t of filled(it)) {
      checked++;
      assert.doesNotMatch(t, /'/, 'apostrophe droite : ' + t);
      assert.doesNotMatch(t, / {2}/, 'double espace : ' + t);
      assert.doesNotMatch(t, /\{\w+\}/, 'jeton non rempli : ' + t);
      assert.doesNotMatch(t, /[ \u00A0][?!;:]/, 'espace fine avant ? ! ; : (frTypo) : ' + t);
      assert.doesNotMatch(t, /[^\u202F][?!;]/, 'espace fine avant ? ! ; : ' + t);
      /* élisions : de, que, le, la, je, ne, se, si (devant il) */
      for (const m of t.matchAll(/(?:^|[\s(«\u202F])(de|que|le|la|je|ne|se) (\p{L}+)/gu)) {
        if (VOWEL.test(m[2]) || (/^h/i.test(m[2]) && !H_ASP.test(m[2]))) {
          /* « de un » n'existe pas dans nos textes ; « le » article devant voyelle non plus */
          assert.fail(`élision manquante « ${m[1]} ${m[2]} » : ${t}`);
        }
      }
      /* nombre + nom : accord (0 et 1 au singulier, à partir de 2 au pluriel) */
      for (const m of t.matchAll(/(\d+(?:[\u202F]\d{3})*(?:,\d+)?)\u00A0(\p{L}+)/gu)) {
        const n = toNum(m[1]), w = m[2];
        if (n >= 2) assert.ok(!(SG_ONLY.has(w) && !PL_ONLY.has(w)), `pluriel manquant « ${m[0]} » : ${t}`);
        else assert.ok(!(PL_ONLY.has(w) && !SG_ONLY.has(w)), `singulier attendu « ${m[0]} » : ${t}`);
      }
      assert.doesNotMatch(t, /(^|\s)1\u00A0(pommes|carottes|œufs|poneys)/u);
      /* pluriel fabriqué sur un mot invariable (« poidss », « prixs », « tapiss ») */
      assert.doesNotMatch(t, /\p{L}(?:ss|xs|zs)(?!\p{L})/u, 'pluriel fautif : ' + t);
      /* inversions : « a-t-il », « met-il » ; jamais « a-il », « met-t-il » */
      for (const m of t.matchAll(/(\p{L}+)-t-(il|elle|ils|elles|on)\b/gu)) assert.match(m[1], /[aeéiouy]$/u, 'inversion : ' + m[0]);
      for (const m of t.matchAll(/(\p{L}+)-(il|elle|ils|elles|on)\b/gu)) {
        if (m[1] === 't') continue;
        assert.match(m[1], /[dt]$/u, 'inversion sans -t- : ' + m[0] + ' — ' + t);
      }
    }
    /* questions : « Combien de N … a-t-il <participe> » accordé avec N */
    for (const p of PROFILES) {
      const q = fillTemplate(it.data.question, p);
      const m = /^Combien (?:de |d’)(\p{L}+)/u.exec(q);
      if (m && nounGender[m[1]]) {
        const g = nounGender[m[1]];
        for (const base of PP) {
          if (q.includes(' ' + base + 'es ')) assert.equal(g, 'f', 'participe féminin pour un nom masculin : ' + q);
          else if (q.includes(' ' + base + 's ')) assert.equal(g, 'm', 'participe masculin pour un nom féminin : ' + q);
          assert.ok(!new RegExp(' ' + base + ' \\u202F?\\?').test(q) || !/ (?:a|ont)-t?-?(?:il|elle|ils|elles) /.test(q), 'participe non accordé : ' + q);
        }
      }
      /* phrases : majuscule au début, point ou point d'interrogation à la fin, longueur raisonnable */
      const sents = it.data.sentences.map(s => fillTemplate(s, p));
      for (const s of sents) {
        assert.match(s, /^[\p{Lu}\d]/u, 'majuscule : ' + s);
        assert.match(s, /\.$/u, 'point final : ' + s);
        assert.ok(s.split(/\s+/).length <= 24, 'phrase trop longue : ' + s);
      }
      assert.match(q, /^[\p{Lu}]/u);
      assert.match(q, /\u202F\?$/u, 'question : ' + q);
      assert.ok(q.split(/\s+/).length <= 22, 'question trop longue : ' + q);
      assert.ok(fillTemplate(it.prompt, p).length <= 320, 'énoncé trop long : ' + it.prompt);
    }
    /* adjectifs de couleur : pluriel, au genre du nom de l'item */
    const unitG = nounGender[String(it.unit).split(' ')[0]];
    for (const t of [...it.data.sentences, it.data.question]) {
      for (const m of t.matchAll(/\b(blanc|blanche|blancs|blanches|noir|noire|noirs|noires|brun|brune|bruns|brunes|roux|rousse|rousses|gris|grise|grises|vert|verte|verts|vertes|bleu|bleue|bleus|bleues|rouges|jaunes)\b/gu)) {
        const k = COLORS[m[1]];
        assert.ok(!/1$/.test(k), 'adjectif au singulier : ' + t);
        if (unitG && k !== '*' && m[1] !== 'gris' && m[1] !== 'roux') assert.equal(k, unitG, `accord de « ${m[1]} » : ${t}`);
      }
    }
  }
  assert.ok(checked > 10000);
});

test('personnages : aucun prénom réel — animaux du ranch inventés, rôles, jetons du profil ; jamais « de {N} » ni « que {N} »', () => {
  for (const it of ITEMS) {
    for (const t of allTexts(it)) {
      assert.doesNotMatch(t, /\b(de|que|qu’|le|la|du) \{[NP]\}/u, 'élision imprévisible devant un jeton : ' + t);
      assert.doesNotMatch(t, /d’\{[NP]\}/u);
      /* tout mot à majuscule après le début de phrase est un nom connu, un jeton ou un mot d'interface */
      for (const m of t.matchAll(/[^.!?\s]\s+([A-ZÉ][a-zéèêëàâîïôûç]+)/gu)) {
        const w = m[1];
        assert.ok(NAMES.includes(w) || ['Comprendre', 'Modéliser', 'Calculer', 'Répondre', 'Étape', 'Étapes', 'De', 'Il', 'Elle', 'Attention', 'Chaque', 'Puis', 'Après', 'Avant', 'Maintenant', 'Partage', 'Compte', 'Fais', 'Le', 'La', 'Les', 'Une', 'Un', 'On', 'Si', 'Deux', 'Au', 'Ce', 'Cette', 'En', 'Dans', 'Samedi', 'Dimanche', 'Lundi', 'Jeudi', 'Janvier', 'Pour', 'Aujourd', 'Saules', 'Moulin', 'Sans', 'Dans'].includes(w),
          'nom inconnu « ' + w + ' » : ' + t);
      }
    }
  }
  assert.ok(POOL.length >= 8);
  assert.equal(new Set(POOL.map(p => p.g)).size, 2, 'des filles et des garçons');
});

test('six choix (format Repères) : réponse incluse, distincts, positifs, rangés ; 6 choix en CP-CE1, pavé ensuite', () => {
  for (const it of ITEMS) {
    const ch = it.data.choices;
    assert.equal(ch.length, 6, it.key);
    assert.equal(new Set(ch.map(c => c.value)).size, 6, 'choix distincts : ' + it.key);
    assert.equal(ch.filter(c => Math.abs(c.value - it.answer) < 1e-9).length, 1, it.key);
    for (let i = 1; i < 6; i++) assert.ok(ch[i].value > ch[i - 1].value, 'choix rangés : ' + it.key);
    for (const c of ch) { assert.ok(c.value > 0); assert.equal(typeof c.label, 'string'); }
    assert.equal(it.data.distractors.length, 5);
    for (const d of it.data.distractors) assert.ok(['inverse', 'donnee', 'etape', 'inutile', 'proche'].includes(d.why), d.why);
    /* un distracteur au moins vient d'une vraie erreur (mauvaise opération, étape oubliée, nombre de l'énoncé) */
    assert.ok(it.data.distractors.some(d => d.why !== 'proche'), 'distracteur d’erreur typique : ' + it.key);
    if (it.data.mode === 'choices') assert.deepEqual(it.choices, ch);
    else assert.equal(it.choices, undefined);
  }
  assert.equal(choiceMode(0.5), 'choices');
  assert.equal(choiceMode(1.9), 'choices');
  assert.equal(choiceMode(2.2, 2), 'choices');
  assert.equal(choiceMode(2.2, 1), 'keypad');
  assert.equal(choiceMode(4, 3), 'keypad');
});

test('mots inducteurs : à partir du CE1, environ un problème additif sur trois est un contre-exemple', () => {
  for (const [lo, hi] of [[1, 2], [2, 3], [3, 5.6]]) {
    let add = 0, trap = 0;
    for (let i = 0; i < 1500; i++) {
      const A = lo + (hi - lo) * (i / 1500);
      const it = gen(A, makeRng('trap-' + lo + '-' + i));
      if (!KIND_INFO[it.kind].add) continue;
      add++;
      if (it.data.trap) trap++;
    }
    const share = trap / add;
    assert.ok(share >= 0.22 && share <= 0.5, `part des contre-exemples ${lo}-${hi} : ${share.toFixed(2)}`);
  }
  /* au début du CP, pas de piège (ordre du livret CP) */
  for (let i = 0; i < 200; i++) assert.equal(gen(0.1, makeRng('cp-' + i)).data.trap, false);
  /* un contre-exemple : « plus », « gagné » ou « moins » avec l'opération contraire */
  const t = gen(1.5, makeRng('ref'), { kind: 'referent' });
  assert.ok(t.data.trap);
  const word = /de plus/.test(t.prompt) ? '−' : '+';
  assert.equal(t.data.ops[0].op, word, t.prompt);
});

test('schéma en barres : données cohérentes (inconnue marquée, parties = tout)', () => {
  for (const it of ITEMS) {
    const s = it.data.schema;
    assert.ok(s, it.key);
    if (s.grid) { assert.equal(s.grid.n * s.grid.m * (s.grid.times || 1), it.answer); continue; }
    assert.ok(Array.isArray(s.rows) && s.rows.length >= 1 && s.rows.length <= 3, it.key);
    let unknown = 0;
    for (const r of s.rows) {
      assert.ok(r.segs.length >= 1 && r.segs.length <= 10, it.key);
      if (r.n && r.n.q) unknown++;
      for (const g of r.segs) { assert.ok(g.v > 0, it.key); if (g.q) unknown++; assert.equal(typeof g.t, 'string'); }
      if (r.total) {
        if (r.total.q) unknown++;
        const dots = r.segs.some(g => g.dots) || (s.groups && r.segs.length < s.groups) || (r.n && r.n.q);
        if (!dots) {
          const sum = r.segs.reduce((a, g) => a + g.v, 0);
          assert.ok(Math.abs(sum - r.total.v) < 1e-6, `parties ≠ tout (${sum} / ${r.total.v}) : ${it.key}`);
        }
      }
    }
    assert.ok(unknown >= 1, 'inconnue « ? » : ' + it.key);
  }
});

test('calendrier : notions datées, familles, CALENDAR au format de js/content/calendar.js, item.notion(s), opts.locked', () => {
  assert.ok(Object.keys(NOTIONS).length >= 15);
  for (const [id, n] of Object.entries(NOTIONS)) {
    assert.match(id, /^ma\.problemes:[a-z0-9.]+$/);
    assert.match(n.at, /^(CP|CE1|CE2|CM1|CM2)-P[1-5]$/);
    assert.ok(FAMILIES[n.fam], 'famille : ' + n.fam);
    assert.ok(['bo', 'livret', '2019', 'annee', 'courant', 'caramel'].includes(n.src));
    assert.match(id, /^[a-z]{2}\.[a-z_]+:[A-Za-z0-9_.-]{1,40}$/, 'FAM_RE de calendar.js');
    assert.match(n.fam, /^[a-z]{2}\.[a-z_]+:[A-Za-z0-9_.-]{1,40}$/);
  }
  assert.equal(CALENDAR.notions, NOTIONS);
  assert.equal(CALENDAR.families, FAMILIES);
  for (const f of Object.values(FAMILIES)) assert.ok(f.child && f.adult && f.icon);
  assert.equal(atLevel('CP-P1'), 0);
  assert.equal(atLevel('CE2-P3'), 2.4);
  assert.equal(atLevel('CM2-P5'), 4.8);
  for (const it of ITEMS) {
    assert.ok(NOTIONS[it.notion], it.notion);
    assert.equal(it.notions[0], it.notion);
    for (const n of it.notions) {
      assert.ok(NOTIONS[n], n);
      assert.ok(atLevel(NOTIONS[n].at) <= atLevel(NOTIONS[it.notion].at), 'la principale est la plus récente : ' + it.key);
    }
    assert.equal(KIND_INFO[it.kind].notion, it.notion);
    assert.ok(it.A >= atLevel(NOTIONS[it.notion].at) - 1e-9, it.key);
  }
  /* ordre du livret CP : retrait/parties-tout → partie inconnue → transformation → état initial */
  assert.ok(atLevel(NOTIONS['ma.problemes:pt'].at) < atLevel(NOTIONS['ma.problemes:pt.partie'].at));
  assert.ok(atLevel(NOTIONS['ma.problemes:pt.partie'].at) < atLevel(NOTIONS['ma.problemes:tr.ecart'].at));
  assert.ok(atLevel(NOTIONS['ma.problemes:tr.ecart'].at) < atLevel(NOTIONS['ma.problemes:tr.initial'].at));
  /* verrou : aucune notion verrouillée ; tout verrouillé → on l'ignore plutôt que de ne rien proposer */
  const locked = new Set(Object.keys(NOTIONS).filter(n => n !== 'ma.problemes:pt'));
  for (let i = 0; i < 100; i++) assert.equal(gen(2.5, makeRng('lk-' + i), { locked }).notion, 'ma.problemes:pt');
  const all = new Set(Object.keys(NOTIONS));
  assert.ok(gen(2.5, makeRng('lk-all'), { locked: all }).key);
});

test('variété : au moins 200 énoncés différents par palier ; avoid respecté', () => {
  for (const A of [0, 0.3, 0.6, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5.2]) {
    const rng = makeRng('var-' + A);
    const keys = new Set();
    for (let i = 0; i < 600; i++) keys.add(gen(A, rng).key);
    assert.ok(keys.size >= 200, `A = ${A} : ${keys.size} énoncés`);
  }
  const rng = makeRng('avoid');
  const first = gen(1, rng);
  for (let i = 0; i < 30; i++) assert.notEqual(gen(1, makeRng('avoid-' + i), { avoid: new Set([first.key]) }).key === first.key && i === 0, true);
});

test('outils de français', () => {
  assert.equal(de('pommes'), 'de pommes');
  assert.equal(de('œufs'), 'd’œufs');
  assert.equal(de('euros'), 'd’euros');
  assert.equal(de('heures'), 'd’heures');
  assert.equal(de('haricots'), 'de haricots');
  assert.equal(elides('ânes'), true);
  assert.equal(inv('a', 'il'), 'a-t-il');
  assert.equal(inv('mange', 'elle'), 'mange-t-elle');
  assert.equal(inv('met', 'il'), 'met-il');
  assert.equal(inv('vend', 'elle'), 'vend-elle');
  assert.equal(qn(1, { sg: 'pomme', pl: 'pommes' }), '1\u00A0pomme');
  assert.equal(qn(2, { sg: 'cheval', pl: 'chevaux' }), '2\u00A0chevaux');
  assert.equal(qn(1500, { sg: 'visiteur', pl: 'visiteurs' }), '1\u202F500\u00A0visiteurs');
});
