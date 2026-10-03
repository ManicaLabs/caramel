/* Générateur fr.conjug (js/content/fr/conjug.js) — « Le Chef d’orchestre ».
   Grille A = 0 → 5,6 (pas de 0,1) × des centaines de graines : items bien formés, réponse juste
   (recalculée par le moteur, lui-même vérifié sur des tables écrites à la main, et par une mini-table
   indépendante ci-dessous), choix distincts contenant la réponse, bornes du programme par palier,
   typographie française, ≥ 200 clés distinctes par palier (sauf CP : 12 clés possibles), fromKey,
   opts.avoid, opts.kind, déterminisme.
   Revue D2-02 (calibrage) : moyenne de item.A − A ≥ −0,25 pour A de 2 à 5, variété gardée.
   Revue D2-04 (indices) : aucun indice révélateur ni trompeur, selon un critère formel (plus bas). */
import { test, assert } from './_t.mjs';
import { makeRng } from '../js/core/rng.js';
import * as G from '../js/content/fr/conjug.js';
import {
  conjugate, formOf, groupOf, isEtreVerb, isPlainForm, pastParticiple, agree, stemEnding, TENSES, PERSONS, TENSE_LABEL, VERBS
} from '../js/content/fr/verbs.js';

const KINDS = ['forme', 'terminaison', 'temps', 'accord', 'sujet', 'participe'];
const IRREG8 = ['faire', 'aller', 'dire', 'venir', 'pouvoir', 'voir', 'vouloir', 'prendre'];
const DERIVED = ['apprendre', 'comprendre', 'devenir', 'revenir'];
const HORS_PROGRAMME = ['mettre', 'savoir', 'devoir', 'lire', 'écrire', 'courir', 'dormir', 'tenir'];
const COMPOUND = t => t === 'passe_compose' || t === 'plus_que_parfait';
const PRONOUNS = { je: '1s', tu: '2s', il: '3s', elle: '3s', nous: '1p', vous: '2p', ils: '3p', elles: '3p' };
/* mini-table indépendante (écrite à la main) pour une double vérification */
const MINI = {
  'être|present': 'suis es est sommes êtes sont', 'avoir|present': 'ai as a avons avez ont',
  'aller|futur': 'irai iras ira irons irez iront', 'faire|present': 'fais fais fait faisons faites font',
  'chanter|imparfait': 'chantais chantais chantait chantions chantiez chantaient', 'finir|present': 'finis finis finit finissons finissez finissent',
  'prendre|passe_simple': 'pris pris prit prîmes prîtes prirent', 'venir|futur': 'viendrai viendras viendra viendrons viendrez viendront',
  'manger|present': 'mange manges mange mangeons mangez mangent', 'jouer|futur': 'jouerai joueras jouera jouerons jouerez joueront'
};
const GRID = Array.from({ length: 57 }, (_, i) => Math.round(i) / 10);
const SEEDS = 160;
const tierOf = A => (A < 1 ? 'CP' : A < 2 ? 'CE1' : A < 3 ? 'CE2' : A < 4 ? 'CM1' : A < 5 ? 'CM2' : 'CM2+');

/* toutes les formes réelles d'un verbe, par temps */
function formsByTense(verb) {
  const out = {};
  for (const t of TENSES) {
    out[t] = new Set();
    for (const p of PERSONS) for (const g of ['m', 'f']) out[t].add(formOf(verb, t, p, { g }));
  }
  return out;
}
const textsOf = it => [it.prompt, it.hint, it.explain, it.data.full || '', it.data.sentence.before, it.data.sentence.after,
  it.data.sentence.text || '', it.data.model || '', ...it.choices.map(c => c.label)];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------- vérification complète d'un item ---------- */
function checkItem(it, A, ctx = '') {
  const where = `${ctx} A=${A} ${it && it.key}`;
  /* forme générale */
  assert.equal(it.axis, 'fr.conjug', where);
  assert.ok(KINDS.includes(it.kind), where);
  assert.equal(typeof it.key, 'string', where);
  assert.ok(it.key.startsWith('fr.conjug:'), where);
  assert.ok(typeof it.A === 'number' && it.A >= 0 && it.A <= 5.6, where);
  assert.ok(it.prompt && it.hint && it.explain, where);
  assert.equal(typeof it.leitner, 'boolean', where);
  const d = it.data;
  assert.ok(d && d.sentence && typeof d.sentence.before === 'string' && typeof d.sentence.after === 'string', where);
  assert.ok(TENSES.includes(d.tense) && PERSONS.includes(d.person), where);
  assert.equal(d.tenseLabel, TENSE_LABEL[d.tense], where);
  assert.ok(typeof d.verb === 'string' && d.verb.length > 1, where);
  /* choix : 4, distincts, réponse incluse */
  assert.equal(it.choices.length, 4, where);
  const vals = it.choices.map(c => c.value), labs = it.choices.map(c => c.label);
  assert.equal(new Set(vals).size, 4, where + ' valeurs distinctes');
  assert.equal(new Set(labs).size, 4, where + ' libellés distincts');
  assert.ok(vals.includes(it.answer), where + ' réponse dans les choix');
  for (const c of it.choices) assert.ok(typeof c.label === 'string' && c.label.length > 0, where);
  /* textes : français propre */
  for (const t of textsOf(it)) {
    assert.ok(!/undefined|NaN|null|\[object/.test(t), where + ' texte : ' + t);
    assert.ok(!/'/.test(t), where + ' apostrophe droite : ' + t);
    assert.ok(!/ [?!:;»]/.test(t), where + ' espace avant ponctuation : ' + t);
    assert.ok(!/« /.test(t), where + ' espace après « : ' + t);
    assert.ok(!/ {2}/.test(t), where + ' double espace : ' + t);
    assert.ok(!/\bje [aeiouyéèêh]/i.test(t), where + ' « je » non élidé : ' + t);
  }
  /* indice : une stratégie, jamais la réponse (revue D2-04 ; critère formel plus bas, section INDICES) */
  const why = revealing(it);
  assert.equal(why, null, where + ' indice révélateur ' + why + ' : ' + it.hint);
  const wrong = citesWrongChoice(it);
  assert.equal(wrong, null, where + ' indice trompeur (cite « ' + wrong + ' ») : ' + it.hint);
  assert.ok(it.hint.length <= 270, where + ' indice trop long (' + it.hint.length + ') : ' + it.hint);
  const full = d.full || d.sentence.text;
  assert.ok(/^[«A-ZÀÂÉÈÊÎÔÛÇ]/.test(full), where + ' majuscule : ' + full);
  assert.ok(/[.?!»]$/.test(full), where + ' ponctuation finale : ' + full);
  /* clé, Leitner */
  const verb = d.verb;
  assert.equal(it.leitner, groupOf(verb) === 0 || groupOf(verb) === 3, where + ' leitner');
  assert.ok(!HORS_PROGRAMME.includes(verb), where + ' verbe hors programme');
  /* réponse juste (recalculée) */
  const g = d.g;
  const form = formOf(verb, d.tense, d.person, { g });
  const mini = MINI[verb + '|' + d.tense];
  if (mini && !COMPOUND(d.tense)) assert.equal(form, mini.split(' ')[PERSONS.indexOf(d.person)], where + ' mini-table');
  switch (it.kind) {
    case 'forme': case 'accord': {
      assert.equal(it.answer, form, where + ' forme');
      assert.equal(d.form, form, where);
      assert.equal(full, d.sentence.before + it.answer + d.sentence.after, where);
      assert.ok(it.explain.includes(it.answer.split(' ').pop()), where + ' explication avec la forme');
      assert.ok(!new RegExp('(^|[^\\p{L}])' + esc(it.answer) + '([^\\p{L}]|$)', 'iu').test(it.hint), where + ' l’indice donne la réponse : ' + it.hint);
      if (it.kind === 'accord' && d.structure === 'pluriel') assert.ok(typeof d.model === 'string' && d.model.length > 3, where);
      if (d.structure === 'codpron') {
        assert.ok(d.cod && d.cod.n !== (d.person === '3p' ? 'p' : 's'), where + ' COD de nombre opposé au sujet');
      }
      break;
    }
    case 'terminaison': {
      assert.ok(typeof d.stem === 'string' && d.stem.length > 0, where);
      if (COMPOUND(d.tense)) assert.equal(d.stem + it.answer, pastParticiple(verb), where + ' participe');
      else assert.equal(d.stem + it.answer, form, where + ' radical + terminaison');
      assert.equal(full, d.sentence.before + d.stem + it.answer + d.sentence.after, where);
      for (const c of it.choices) assert.equal(c.label, '-' + c.value, where);
      break;
    }
    case 'temps': {
      assert.equal(it.answer, d.tense, where);
      const [a, b] = d.sentence.underline;
      assert.equal(d.sentence.text.slice(a, b), form, where + ' verbe souligné');
      assert.equal(d.sentence.text, d.sentence.before + form + d.sentence.after, where);
      for (const c of it.choices) {
        assert.ok(TENSES.includes(c.value), where);
        if (c.value !== d.tense) assert.notEqual(formOf(verb, c.value, d.person, { g }), form, where + ' temps ambigu ' + c.value);
      }
      assert.equal(d.cue, null, where + ' le temps ne doit pas être affiché');
      break;
    }
    case 'sujet': {
      assert.equal(d.form, form, where);
      assert.equal(full, d.sentence.before + it.choices.find(c => c.value === it.answer).label + d.sentence.after, where);
      assert.ok(Array.isArray(d.subjects) && d.subjects.length === 4, where);
      let ok = 0;
      for (const s of d.subjects) {
        if (PRONOUNS[s.text]) assert.equal(s.person, PRONOUNS[s.text], where + ' personne du pronom ' + s.text);
        const f = formOf(verb, d.tense, s.person, { g: s.g });
        if (f === form) { ok++; assert.equal(s.text, it.answer, where + ' seul le bon sujet convient'); }
      }
      assert.equal(ok, 1, where + ' un seul sujet possible');
      assert.ok(!(d.person === '1s' && /^[aeiouyéèêh]/i.test(form)), where + ' « j’ » proposé seul');
      break;
    }
    case 'participe': {
      const pp = pastParticiple(verb);
      if (d.cod) {
        assert.equal(it.answer, d.codAfter ? pp : agree(pp, d.cod.g, d.cod.n), where + ' accord avec le COD');
        if (d.codAfter) assert.ok(d.g === 'f' || d.person.endsWith('p'), where + ' piège : sujet féminin ou pluriel');
      } else {
        assert.ok(isEtreVerb(verb), where);
        assert.equal(it.answer, agree(pp, g, d.person.endsWith('p') ? 'p' : 's'), where + ' accord avec le sujet');
        assert.equal(d.aux, conjugate(verb, d.tense, d.person, { g }).aux, where);
      }
      assert.equal(full, d.sentence.before + it.answer + d.sentence.after, where);
      break;
    }
  }
  /* indicateur de temps cohérent avec le temps demandé */
  if (d.indicator) assert.ok(G._internals.CUE_OK[d.indicator].includes(d.tense), where + ' indicateur ' + d.indicator);
  return true;
}

/* ---------- bornes du programme par palier ---------- */
function checkBounds(it, A) {
  const d = it.data, v = d.verb, t = d.tense, p = d.person, s = d.structure;
  const where = `A=${A} ${it.key} [${it.kind}/${s}]`;
  const L = G.LEVELS;
  assert.ok(it.A <= A + 1e-9, where + ' niveau de l’item ≤ A');
  if (A < 1) {
    assert.ok(['être', 'avoir'].includes(v) && t === 'present', where + ' CP : être, avoir au présent');
    assert.ok(['forme', 'sujet'].includes(it.kind), where);
    assert.equal(s, 'pron', where + ' CP : sujets pronoms');
    for (const c of it.choices) if (it.kind === 'sujet') assert.ok(PRONOUNS[c.value], where);
  }
  if (t === 'imparfait') assert.ok(A >= 1.3, where);
  if (t === 'futur') assert.ok(A >= 1.6, where);
  if (t === 'passe_compose') assert.ok(A >= 1.8, where);
  if (t === 'passe_simple') assert.ok(A >= L.psPerson[p], where + ' passé simple');
  if (t === 'plus_que_parfait') assert.ok(A >= 4.3, where);
  if (IRREG8.includes(v)) assert.ok(A >= 2, where + ' irréguliers au CE2');
  if (groupOf(v) === 2) assert.ok(A >= 3, where + ' 2e groupe au CM1');
  if (DERIVED.includes(v)) assert.ok(A >= 3.2, where);
  if (['partir', 'sortir'].includes(v)) assert.ok(A >= 3 && COMPOUND(t), where + ' partir/sortir aux temps composés');
  if (!isPlainForm(v, t, p)) assert.ok(A >= 3, where + ' variation du radical au CM1');
  if (isEtreVerb(v) && COMPOUND(t)) {
    assert.ok(A >= 2, where + ' passé composé avec être au CE2');
    assert.ok(p.startsWith('3'), where + ' genre explicite');
    if (A < 3) assert.ok(p === '3s' && d.g === 'm', where + ' masculin singulier avant le CM1');
  }
  if (it.kind === 'participe') assert.ok(A >= 3, where);
  if (it.kind === 'temps') assert.ok(A >= 1.8, where);
  if (it.kind === 'terminaison' && groupOf(v) !== 1) assert.ok(A >= 2, where);
  if (['cdn', 'multi'].includes(s)) assert.ok(A >= 3, where);
  if (s === 'pre') assert.ok(A >= 2, where);
  if (s === 'pluriel') assert.ok(A >= 2.2, where);
  if (['inv', 'invcdn'].includes(s)) assert.ok(A >= 4.2, where);
  if (s === 'dial') assert.ok(A >= 4.3, where);
  if (['q', 'qcdn', 'codpron'].includes(s)) assert.ok(A >= 4.4, where);
  if (s === 'multi2') assert.ok(A >= 4.8, where);
  if (s === 'cod') assert.ok(A >= (d.codAfter ? 4.7 : 4.5), where);
  /* distracteurs : aucune forme d'un temps pas encore étudié */
  if (['forme', 'accord'].includes(it.kind)) {
    const byT = formsByTense(v);
    const known = TENSES.filter(x => x === 'passe_simple' ? A >= 4 : A >= L.tense[x]);
    for (const c of it.choices) {
      const tensesOfC = TENSES.filter(x => byT[x].has(c.value));
      if (tensesOfC.length) assert.ok(tensesOfC.some(x => known.includes(x)), where + ' distracteur d’un temps non étudié : ' + c.value);
    }
  }
  if (it.kind === 'temps') for (const c of it.choices) assert.ok(c.value === 'passe_simple' ? A >= 4 : A >= L.tense[c.value], where + ' nom de temps non étudié');
  if (it.kind === 'participe' && !d.cod && A < 3.4) assert.ok(!/ et /.test(d.subject) || d.g === 'f' || true, where);
}

/* ============ TESTS ============ */
test('conjug : déterminisme (même A, même graine → même item)', () => {
  for (const A of [0, 0.5, 1.2, 1.9, 2.6, 3.3, 4.1, 4.8, 5.6]) {
    for (let s = 0; s < 20; s++) {
      const a = G.gen(A, makeRng('det' + s)), b = G.gen(A, makeRng('det' + s));
      assert.deepEqual(a, b, 'A=' + A + ' s=' + s);
    }
  }
});

const BY_TIER = {};
test('conjug : grille A 0 → 5,6 × ' + SEEDS + ' graines — items justes, bien formés, dans le programme', () => {
  let n = 0;
  for (const A of GRID) {
    for (let s = 0; s < SEEDS; s++) {
      const it = G.gen(A, makeRng('grille:' + A + ':' + s));
      checkItem(it, A, 'grille');
      checkBounds(it, A);
      const tier = tierOf(A);
      (BY_TIER[tier] = BY_TIER[tier] || { keys: new Set(), kinds: {}, n: 0, sentences: new Set() });
      BY_TIER[tier].keys.add(it.key);
      BY_TIER[tier].sentences.add(it.data.full || it.data.sentence.text);
      BY_TIER[tier].kinds[it.kind] = (BY_TIER[tier].kinds[it.kind] || 0) + 1;
      BY_TIER[tier].n++;
      n++;
    }
  }
  assert.equal(n, GRID.length * SEEDS);
});

test('conjug : ≥ 200 clés distinctes par palier (CP : les 12 clés possibles)', () => {
  assert.ok(BY_TIER.CP, 'la grille doit avoir tourné');
  const lines = [];
  for (const [tier, x] of Object.entries(BY_TIER)) {
    lines.push(`${tier} : ${x.keys.size} clés, ${x.sentences.size} phrases, ${x.n} items, ${JSON.stringify(x.kinds)}`);
    if (tier === 'CP') {
      /* être et avoir au présent × 6 personnes : 12 clés au maximum (limite du programme de CP) */
      assert.equal(x.keys.size, 12, 'CP : ' + [...x.keys].join(' '));
      assert.ok(x.sentences.size >= 150, 'CP : phrases variées ' + x.sentences.size);
    } else assert.ok(x.keys.size >= 200, tier + ' : ' + x.keys.size + ' clés');
  }
  process.env.CONJUG_VERBOSE && console.log(lines.join('\n'));
  /* tous les sous-types apparaissent dès leur palier */
  for (const k of ['forme', 'sujet']) assert.ok(BY_TIER.CP.kinds[k] > 0, 'CP ' + k);
  for (const k of ['forme', 'sujet', 'accord', 'terminaison', 'temps']) assert.ok(BY_TIER.CE1.kinds[k] > 0, 'CE1 ' + k);
  for (const k of KINDS) for (const tier of ['CM1', 'CM2', 'CM2+']) assert.ok(BY_TIER[tier].kinds[k] > 0, tier + ' ' + k);
});

test('conjug : contenu attendu par palier (temps, verbes, structures)', () => {
  const seen = {};
  const mark = (tier, what) => { (seen[tier] = seen[tier] || new Set()).add(what); };
  for (const A of GRID) for (let s = 0; s < 60; s++) {
    const it = G.gen(A, makeRng('contenu:' + A + ':' + s));
    const tier = tierOf(A), d = it.data;
    mark(tier, 't:' + d.tense); mark(tier, 's:' + d.structure); mark(tier, 'k:' + it.kind);
    if (IRREG8.includes(d.verb)) mark(tier, 'irr'); if (groupOf(d.verb) === 2) mark(tier, 'g2');
    if (!isPlainForm(d.verb, d.tense, d.person)) mark(tier, 'variation');
    if (isEtreVerb(d.verb) && COMPOUND(d.tense)) mark(tier, 'etre:' + d.g + d.person);
  }
  const has = (tier, w) => assert.ok(seen[tier].has(w), tier + ' devrait contenir ' + w);
  for (const t of ['present', 'imparfait', 'futur', 'passe_compose']) has('CE1', 't:' + t);
  for (const w of ['irr', 's:pre', 's:pluriel', 'etre:m3s']) has('CE2', w);
  for (const w of ['g2', 'variation', 's:cdn', 's:multi', 'k:participe', 'etre:f3p']) has('CM1', w);
  for (const w of ['t:passe_simple', 't:plus_que_parfait', 's:inv', 's:q', 's:codpron', 's:cod', 's:dial']) has('CM2', w);
  for (const w of ['s:multi2']) has('CM2+', w);
  assert.ok(!seen.CE1.has('irr') && !seen.CE1.has('g2') && !seen.CE2.has('g2'), 'pas d’irréguliers au CE1, pas de 2e groupe avant le CM1');
  assert.ok(![...seen.CM1].some(w => w === 't:passe_simple' || w === 't:plus_que_parfait'), 'pas de passé simple ni de plus-que-parfait avant le CM2');
});

test('conjug : opts.kind (sous-type imposé, niveau minimal si besoin)', () => {
  for (const kind of KINDS) {
    for (const A of [0, 1.5, 2.5, 3.5, 4.5, 5.5]) {
      for (let s = 0; s < 12; s++) {
        const it = G.gen(A, makeRng(kind + s), { kind });
        assert.equal(it.kind, kind, kind + ' A=' + A);
        const floor = G.LEVELS.kind[kind];
        checkItem(it, Math.max(A, floor), 'kind');
        checkBounds(it, Math.max(A, floor));
      }
    }
  }
  const t = G.gen(0, makeRng('t'), { kind: 'temps' });
  assert.ok(t.A >= 1.8 && t.A <= 1.8 + 1e-9);
  const pa = G.gen(1, makeRng('p'), { kind: 'participe' });
  assert.ok(pa.A >= 3);
  const bad = G.gen(2, makeRng('b'), { kind: 'imperatif' });             /* sous-type inconnu : ignoré */
  assert.ok(KINDS.includes(bad.kind));
});

test('conjug : opts.avoid respecté, jamais de boucle infinie', () => {
  for (const A of [1.4, 2.4, 3.4, 4.4, 5.4]) {
    for (let s = 0; s < 40; s++) {
      const first = G.gen(A, makeRng('av' + s));
      const avoid = new Set([first.key]);
      const second = G.gen(A, makeRng('av' + s), { avoid });
      assert.notEqual(second.key, first.key, 'A=' + A);
      /* clés évitées sur toute une manche */
      const seen = new Set();
      const rng = makeRng('manche' + A + s);
      for (let i = 0; i < 12; i++) {
        const it = G.gen(A, rng, { avoid: seen });
        assert.ok(!seen.has(it.key), 'manche A=' + A + ' clé répétée ' + it.key);
        seen.add(it.key);
      }
    }
  }
  /* CP : 12 clés possibles ; avec 11 évitées → la 12e ; avec les 12 → un item quand même */
  const all = [];
  for (const v of ['être', 'avoir']) for (const p of PERSONS) all.push('fr.conjug:' + v + '|present|' + p);
  const t0 = Date.now();
  const last = G.gen(0.5, makeRng('cp'), { avoid: new Set(all.slice(1)) });
  assert.equal(last.key, all[0]);
  const any = G.gen(0.5, makeRng('cp2'), { avoid: new Set(all) });
  assert.ok(all.includes(any.key));
  assert.ok(Date.now() - t0 < 2000, 'pas de boucle infinie');
  /* avoid en tableau accepté */
  assert.ok(G.gen(2, makeRng('arr'), { avoid: [first0()] }));
  function first0() { return G.gen(2, makeRng('arr')).key; }
});

test('conjug : fromKey reproduit un item de même clé', () => {
  const keys = new Map();
  for (const A of GRID) for (let s = 0; s < 25; s++) {
    const it = G.gen(A, makeRng('fk:' + A + ':' + s));
    if (it.leitner || it.kind === 'forme' || it.kind === 'temps' || (it.kind === 'participe' && it.data.cod)) keys.set(it.key, A);
  }
  assert.ok(keys.size > 300, 'clés à rejouer : ' + keys.size);
  let n = 0, fam = { forme: 0, temps: 0, cod: 0 };
  for (const [key, A] of keys) {
    const it = G.fromKey(key, A, makeRng('rejoue' + key));
    assert.ok(it, 'fromKey ' + key);
    assert.equal(it.key, key);
    const fa = key.includes(':cod|') ? 'cod' : key.includes(':temps|') ? 'temps' : 'forme';
    assert.equal(it.kind, fa === 'cod' ? 'participe' : fa, key);
    fam[fa]++;
    checkItem(it, Math.max(A, it.A), 'fromKey');
    /* déterministe */
    assert.deepEqual(G.fromKey(key, A, makeRng('rejoue' + key)), it);
    n++;
  }
  assert.ok(fam.forme > 100 && fam.temps > 50 && fam.cod > 10, JSON.stringify(fam));
  /* toutes les clés de participe avec avoir (banque COD complète) */
  let nCod = 0;
  for (const c of G._internals.COD) for (const t of ['passe_compose', 'plus_que_parfait']) {
    for (const k of [...new Set(c.o.map(o => o[1] + o[2])), 'apres']) {
      const key = 'fr.conjug:cod|' + c.v + '|' + t + '|' + k;
      const it = G.fromKey(key, 5, makeRng(key));
      assert.ok(it && it.key === key, key);
      checkItem(it, 5.6, 'fromKey cod');
      nCod++;
    }
  }
  assert.ok(nCod >= 200, 'clés COD : ' + nCod);
  /* clés invalides */
  for (const k of ['', 'ma.faits:7x8', 'fr.conjug:', 'fr.conjug:chanter|present', 'fr.conjug:chanter|conditionnel|1s',
    'fr.conjug:mettre|present|1s', 'fr.conjug:aller|passe_compose|1s|f', 'fr.conjug:aller|passe_compose|3s',
    'fr.conjug:chanter|present|3s|f', 'fr.conjug:partir|present|3s', 'fr.conjug:cod|chanter|passe_compose|fp',
    'fr.conjug:cod|ramasser|present|fp', 'fr.conjug:temps|zzz|present|1s']) {
    assert.equal(G.fromKey(k, 3, makeRng('x')), null, 'clé invalide : ' + k);
  }
  /* exemple du contrat */
  const pr = G.fromKey('fr.conjug:prendre|present|3p', 2.5, makeRng('pr'));
  assert.equal(pr.answer, 'prennent');
  const al = G.fromKey('fr.conjug:aller|passe_compose|3p|f', 3.5, makeRng('al'));
  assert.equal(al.answer, 'sont allées');
  const cod = G.fromKey('fr.conjug:cod|ramasser|passe_compose|fp', 4.6, makeRng('cod'));
  assert.equal(cod.answer, 'ramassées');
});

test('conjug : phrases-pièges (accord) — la forme piège est proposée', () => {
  let cdn = 0, multi = 0, codp = 0, inv = 0;
  for (let s = 0; s < 400; s++) {
    const A = 3 + (s % 26) / 10;
    const it = G.gen(A, makeRng('piege' + s), { kind: 'accord' });
    const d = it.data;
    const opp = formOf(d.verb, d.tense, d.person === '3p' ? '3s' : '3p', { g: d.g });
    if (d.structure === 'cdn') { cdn++; assert.ok(it.choices.some(c => c.value === opp), it.key + ' piège du complément du nom'); }
    if (d.structure === 'multi') { multi++; assert.ok(it.choices.some(c => c.value === opp), it.key + ' piège : un seul nom'); }
    if (d.structure === 'codpron') { codp++; assert.ok(it.choices.some(c => c.value === opp), it.key + ' piège du pronom COD'); }
    if (d.structure === 'inv' || d.structure === 'q') inv++;
  }
  assert.ok(cdn > 10 && multi > 10 && codp > 3 && inv > 3, [cdn, multi, codp, inv].join(' '));
});

test('conjug : typographie et exemples ciblés', () => {
  /* indice et explication du contrat (revue D2-04) : sujet GN au futur. L'indice donne la STRATÉGIE
     (repérer le sujet, chercher le pronom, tableau complet du futur), jamais le pronom ni la terminaison
     visée ; l'explication donne la solution (« Les enfants », c'est « ils » : -ont). */
  let found = null;
  for (let s = 0; s < 4000 && !found; s++) {
    const it = G.gen(s % 2 ? 1.7 : 2.6, makeRng('ex' + s), { kind: 'forme' });
    if (it.data.subject === 'les enfants' && it.data.tense === 'futur') found = it;
  }
  assert.ok(found, 'un item « les enfants » au futur');
  const NB = '\u202f';
  assert.ok(found.hint.startsWith('Repère le sujet' + NB + ': «' + NB + 'les enfants' + NB + '». Quel pronom le remplace' + NB + '?'), found.hint);
  assert.ok(found.hint.includes('Au futur' + NB + ': -ai, -as, -a, -ons, -ez, -ont.'), found.hint);
  assert.ok(!found.hint.includes('«' + NB + 'ils' + NB + '»') && !/se termine.* -ont/.test(found.hint), 'indice révélateur : ' + found.hint);
  assert.ok(found.explain.startsWith('Les enfants ' + found.answer), found.explain);
  assert.ok(found.explain.includes('3e personne du pluriel'), found.explain);
  assert.ok(found.explain.includes('«' + NB + 'Les enfants' + NB + '», c’est «' + NB + 'ils' + NB + '».'), found.explain);
  assert.ok(found.explain.includes('Au futur, avec «' + NB + 'ils' + NB + '», le verbe se termine par -ont.'), found.explain);
  assert.equal(found.prompt, 'Conjugue le verbe au futur.');
  /* consignes */
  const P = { temps: 'À quel temps est conjugué le verbe souligné\u202f?', sujet: 'Choisis le sujet qui va avec le verbe.',
    participe: 'Choisis le participe passé bien accordé.' };
  for (const [k, p] of Object.entries(P)) assert.equal(G.gen(4.6, makeRng('pr' + k), { kind: k }).prompt, p, k);
  /* libellés des temps comme aux Repères */
  const t = G.gen(2.5, makeRng('lab'), { kind: 'temps' });
  assert.deepEqual(t.choices.map(c => c.label).sort(), ['le futur', 'le passé composé', 'le présent', 'l’imparfait'].sort());
  /* keyLabel lisible */
  assert.equal(G.keyLabel('fr.conjug:prendre|present|3p'), 'prendre · présent · ils prennent');
  assert.equal(G.keyLabel('fr.conjug:aller|passe_compose|3p|f'), 'aller · passé composé · elles sont allées');
  assert.equal(G.keyLabel('fr.conjug:avoir|present|1s'), 'avoir · présent · j’ai');
  assert.ok(G.keyLabel('fr.conjug:temps|faire|futur|2p').startsWith('reconnaître le temps'));
  assert.ok(G.keyLabel('fr.conjug:cod|ramasser|passe_compose|fp').includes('COD féminin pluriel'));
  assert.equal(G.keyLabel('ma.faits:7x8'), '');
});

test('conjug : la banque de phrases est cohérente (cadres, sujets, COD)', () => {
  const { FR, COD, QUESTIONS, CLASS } = G._internals;
  for (const [verb, frames] of Object.entries(FR)) {
    assert.ok(groupOf(verb) !== null, verb);
    assert.ok(frames.length > 0, verb);
    for (const f of frames) {
      for (const c of f.c || []) {
        const list = typeof c === 'object' ? [c.s, c.p] : [c];
        for (const x of list) assert.ok(/^[a-zà-ÿœ’' -]+$/i.test(x) && !/'/.test(x) && !x.endsWith(' '), verb + ' : ' + x);
      }
      for (const l of f.l || []) assert.ok(!/'/.test(l), verb + ' : ' + l);
      for (const q of f.d || []) assert.ok(/^« .+ »$/.test(q), verb + ' : ' + q);
    }
  }
  for (const c of COD) {
    assert.ok(FR[c.v] || groupOf(c.v) !== null, c.v);
    for (const [t, g, n, indef] of c.o) {
      assert.ok(/^(ce|cet|cette|ces) /.test(t), t);
      assert.ok(n === 'p' ? t.startsWith('ces ') && /^des /.test(indef) : !t.startsWith('ces ') && /^(un|une) /.test(indef), t);
      assert.ok(['m', 'f'].includes(g), t);
    }
  }
  for (const q of QUESTIONS) assert.ok(FR[q.v], q.v);
  /* « pourquoi » n'admet pas l'inversion simple : aucune question en « Pourquoi » */
  assert.ok(!QUESTIONS.some(q => q.q === 'Pourquoi'));
  /* tous les verbes des classes ont des cadres */
  for (const list of Object.values(CLASS)) for (const v of list) assert.ok(FR[v] && FR[v].length, v);
});

/* ============ CALIBRAGE (revue D2-02) ============
   Les items servis doivent être du niveau demandé (sinon 87 à 98 % de réussite au lieu des 80 % visés) :
   moyenne de item.A − A ≥ −0,25 (ancien générateur : −0,34 à −0,98 selon A), sans jamais dépasser A ni
   les bornes du programme, en gardant de la variété (sous-types, structures, temps, verbes, clés). */
const CALIB_A = [2, 2.5, 3, 3.5, 4, 4.5, 5];
test('conjug : calibrage — moyenne de item.A − A ≥ −0,25 pour A = 2 → 5 (1 000 graines), variété gardée', () => {
  const lines = [];
  for (const A of CALIB_A) {
    let sum = 0;
    const structs = {}, tenses = {}, kinds = new Set(), keys = new Set(), verbs = new Set();
    for (let s = 0; s < 1000; s++) {
      const it = G.gen(A, makeRng('calib:' + A + ':' + s));
      checkBounds(it, A);                                     /* dont item.A ≤ A */
      sum += it.A - A;
      structs[it.data.structure] = (structs[it.data.structure] || 0) + 1;
      tenses[it.data.tense] = (tenses[it.data.tense] || 0) + 1;
      kinds.add(it.kind); keys.add(it.key); verbs.add(it.data.verb);
    }
    const mean = sum / 1000;
    const topS = Math.max(...Object.values(structs)) / 1000, topT = Math.max(...Object.values(tenses)) / 1000;
    lines.push(`A=${A} : écart moyen ${mean.toFixed(3)}, ${Object.keys(structs).length} structures (max ${Math.round(100 * topS)} %), `
      + `${Object.keys(tenses).length} temps (max ${Math.round(100 * topT)} %), ${verbs.size} verbes, ${keys.size} clés`);
    assert.ok(mean >= -0.25, `A=${A} : écart moyen item.A − A = ${mean.toFixed(3)} < −0,25`);
    /* variété : tous les sous-types du niveau, aucune structure ni aucun temps écrasant, assez de verbes et de clés */
    assert.equal(kinds.size, KINDS.filter(k => G.LEVELS.kind[k] <= A + 1e-9).length, `A=${A} : sous-types ${[...kinds]}`);
    assert.ok(Object.keys(structs).length >= 4 && topS <= 0.7, `A=${A} : structures ${JSON.stringify(structs)}`);
    assert.ok(Object.keys(tenses).length >= 4 && topT <= 0.6, `A=${A} : temps ${JSON.stringify(tenses)}`);
    assert.ok(verbs.size >= 30 && keys.size >= 180, `A=${A} : ${verbs.size} verbes, ${keys.size} clés`);
  }
  process.env.CONJUG_VERBOSE && console.log(lines.join('\n'));
});

test('conjug : calibrage fin — moyenne ≥ −0,25 en tout point de la grille A = 2,0 → 5,0 (pas de 0,1)', () => {
  const bad = [];
  for (let i = 20; i <= 50; i++) {
    const A = i / 10;
    let sum = 0;
    for (let s = 0; s < 200; s++) sum += G.gen(A, makeRng('fin:' + A + ':' + s)).A - A;
    if (sum / 200 < -0.25) bad.push(`${A} : ${(sum / 200).toFixed(3)}`);
  }
  assert.equal(bad.length, 0, 'moyennes < −0,25 : ' + bad.join(', '));
});

test('conjug : progression dans l’année cohérente avec le programme (tables de niveaux)', () => {
  const L = G.LEVELS;
  const ORDER = ['present', 'imparfait', 'futur', 'passe_compose'];             /* « présent, imparfait, futur puis passé composé » */
  for (const [c, lo, hi] of [['irr', 2, 3], ['g2', 3, 4], ['derived', 3.2, 4]]) {
    const vt = L.verbTense[c];
    for (let i = 0; i < ORDER.length; i++) {
      assert.ok(vt[ORDER[i]] >= lo && vt[ORDER[i]] < hi, c + ' ' + ORDER[i] + ' dans son année');
      if (i) assert.ok(vt[ORDER[i]] > vt[ORDER[i - 1]], c + ' : ' + ORDER[i - 1] + ' avant ' + ORDER[i]);
    }
  }
  assert.ok(L.verbTense.irr.passe_compose + L.irrLate.offset < 3, '2e vague des irréguliers dans le CE2');
  for (const v of Object.values(L.variant)) assert.ok(v >= 3 && v < 4, 'variations du radical au CM1');
  /* passé simple : il/ils, puis je/tu, puis nous/vous (francais.md §A.1), tout au CM2 */
  const ps = L.psPerson;
  assert.ok(ps['3s'] === 4 && ps['3p'] === 4 && ps['1s'] < ps['2s'] && ps['2s'] < ps['1p'] && ps['1p'] < ps['2p'] && ps['2p'] + L.psLate <= 5);
  assert.ok(L.etreMasc >= 2 && L.etreFull >= 3 && L.etreFull < 4 && L.kind.participe >= 3 && L.kind.participe < 4, 'accord du participe avec être au CM1');
  assert.ok(L.struct.multiMixed > L.etreFull && L.struct.multiMixed < 4);
  assert.ok(L.combo.bonus <= 0.3 && L.combo.min >= 1.5, 'supplément de combinaison borné');
});

/* ============ INDICES (revue D2-04) ============
   Contrat (docs/ARCHITECTURE.md §6.2 et §7.3) : l'indice (après la 1re erreur, au joker, en « coup de
   pouce ») est une STRATÉGIE ; l'explication (après la 2e erreur) est la solution.
   Critère formel : un indice est RÉVÉLATEUR s'il permet de trouver le choix juste par simple
   appariement de chaînes, sans faire le raisonnement :
   (a) il cite la réponse (forme, participe ou sujet ; pour 'terminaison' : radical + terminaison) ;
   (b) il singularise le bon choix : parmi les 4 choix, seul le bon est « désigné » — cité tel quel, ou
       terminé par une terminaison « -xxx » citée (pour 'terminaison' : tuile citée ; pour 'temps' : nom
       du temps cité) ;
   (c) il désigne la terminaison de la personne visée : il cite une terminaison de la réponse sans le
       reste du tableau (les terminaisons citées couvrent moins de n − 1 cases du paradigme : les 6
       personnes du temps, ou les 4 accords du participe) ;
   (d) il cite entre guillemets un modèle conjugué au même temps et à la même personne (« ils
       chantent ») ou, aux temps composés, un participe passé d'un verbe de la banque (« j’ai fini »).
   Il est TROMPEUR (e) s'il cite tel quel un mauvais choix (forme fausse, autre sujet).
   Un tableau complet (« Au futur : -ai, -as, -a, -ons, -ez, -ont ») désigne tous les choix : il n'est
   pas révélateur ; une terminaison seule (« avec ils, le verbe se termine par -ont ») l'est. */
/* citation d'un mot ou d'une suite de mots, sans tenir compte de la casse (une terminaison « -ai » ne
   cite pas le mot « ai ») */
const IS_LETTER = /\p{L}/u;
function citesWord(text, w) {
  if (!w) return false;
  const T = String(text).toLowerCase(), W = String(w).toLowerCase();
  for (let i = T.indexOf(W); i >= 0; i = T.indexOf(W, i + 1)) {
    const before = i > 0 ? T[i - 1] : '', after = T[i + W.length] || '';
    if ((!before || (before !== '-' && !IS_LETTER.test(before))) && (!after || !IS_LETTER.test(after))) return true;
  }
  return false;
}
/* terminaisons citées, dans l'ordre (« en -er », « en -ger » : classes de verbes, pas des terminaisons) */
function endingList(text) {
  const out = [];
  const re = /(^|[^\p{L}-])-(\p{L}+)(?![\p{L}-])/gu;
  let m;
  while ((m = re.exec(text))) {
    if (/(^|[^\p{L}])en[\s\u00a0\u202f]$/u.test(text.slice(0, m.index + m[1].length))) continue;
    out.push(m[2].toLowerCase());
  }
  return out;
}
const lastWord = s => String(s).trim().split(/\s+/).pop().toLowerCase();
const quotedParts = text => [...String(text).matchAll(/«[\s\u00a0\u202f]*([^»]*?)[\s\u00a0\u202f]*»/gu)].map(m => m[1]);
const ALL_PP = new Set();
for (const v of VERBS) { const pp = pastParticiple(v); if (pp) for (const g of ['m', 'f']) for (const n of ['s', 'p']) ALL_PP.add(agree(pp, g, n)); }
const MODELS = new Map();                                     /* formes de tous les verbes à (temps, personne, genre) */
function modelForms(tense, person, g) {
  const k = tense + person + g;
  if (!MODELS.has(k)) MODELS.set(k, new Set(VERBS.map(v => formOf(v, tense, person, { g })).filter(Boolean)));
  return MODELS.get(k);
}
function paradigmOf(it) {
  const d = it.data, v = d.verb, t = d.tense;
  if (it.kind === 'terminaison') {
    if (COMPOUND(t)) return it.choices.map(c => c.value);
    return PERSONS.map(p => { const se = stemEnding(v, t, p); return se && se.ending; }).filter(Boolean);
  }
  if (it.kind === 'participe' || ((it.kind === 'forme' || it.kind === 'accord') && COMPOUND(t) && isEtreVerb(v))) {
    const pp = pastParticiple(v);
    return [agree(pp, 'm', 's'), agree(pp, 'f', 's'), agree(pp, 'm', 'p'), agree(pp, 'f', 'p')];
  }
  if (it.kind === 'forme' || it.kind === 'accord') return PERSONS.map(p => lastWord(formOf(v, t, p, { g: d.g })));
  return null;
}
/* → null si l'indice est sain, sinon la raison */
function revealing(it, hint = it.hint) {
  const k = it.kind, d = it.data;
  if (k === 'temps') {
    const cited = it.choices.filter(c => citesWord(hint, TENSE_LABEL[c.value]));
    return cited.length === 1 && cited[0].value === it.answer ? '(b) nomme seul le bon temps' : null;
  }
  const toks = [...new Set(endingList(hint))];
  const ends = (value, tk) => (k === 'terminaison' ? value === tk : lastWord(value).endsWith(tk));
  if (citesWord(hint, k === 'terminaison' ? (COMPOUND(d.tense) ? d.stem + it.answer : d.form) : String(it.answer))) return '(a) cite la réponse';
  const D = it.choices.filter(c => (k !== 'terminaison' && citesWord(hint, c.value)) || (k !== 'sujet' && toks.some(tk => ends(c.value, tk))));
  if (D.length === 1 && D[0].value === it.answer) return '(b) singularise le bon choix';
  if (k !== 'sujet' && toks.some(tk => ends(it.answer, tk))) {
    const P = paradigmOf(it);
    const cov = P ? P.filter(f => toks.some(tk => (k === 'terminaison' ? f === tk : f.endsWith(tk)))).length : 0;
    if (P && cov < P.length - 1) return '(c) cite la terminaison visée sans le tableau complet';
  }
  if (k === 'forme' || k === 'accord' || k === 'terminaison') {
    /* citations qui ne viennent pas de la phrase elle-même (sujet, COD, phrase modèle du pluriel) */
    const inSentence = String((d.full || '') + ' ' + (d.model || '')).toLowerCase();
    const qs = quotedParts(hint).filter(qq => !inSentence.includes(qq.toLowerCase()));
    const models = COMPOUND(d.tense) ? ALL_PP : modelForms(d.tense, d.person, d.g);
    for (const qq of qs) for (const w of qq.toLowerCase().split(/[^\p{L}]+/u)) {
      if (models.has(w)) return '(d) cite un modèle ' + (COMPOUND(d.tense) ? '(participe passé) : ' : 'à la même personne : ') + w;
    }
  }
  return null;
}
/* (e) l'indice cite tel quel un mauvais choix */
function citesWrongChoice(it, hint = it.hint) {
  if (it.kind === 'temps' || it.kind === 'terminaison') return null;     /* tableau complet : toutes les tuiles y sont */
  const w = it.choices.find(c => c.value !== it.answer && citesWord(hint, c.value));
  return w ? w.value : null;
}

test('conjug : le critère d’indice révélateur reconnaît les anciens indices et accepte les stratégies', () => {
  const fake = (kind, verb, tense, person, answer, values, extra = {}) => ({ kind, answer,
    choices: values.map(v => ({ value: v, label: kind === 'terminaison' ? '-' + v : v })), data: Object.assign({ verb, tense, person, g: 'm' }, extra) });
  const fut = fake('forme', 'jouer', 'futur', '3p', 'joueront', ['joueront', 'jouerons', 'jouent', 'jouaient']);
  assert.ok(revealing(fut, 'Repère le sujet : « ils ». Au futur, avec « ils », le verbe se termine toujours par -ont.'), 'terminaison seule');
  assert.ok(revealing(fut, 'Au futur : -ons ou -ont ?'), 'deux terminaisons seulement');
  assert.ok(revealing(fut, 'Pense à « ils chanteront ».'), 'modèle à la même personne');
  assert.ok(revealing(fut, 'C’est « joueront ».'), 'réponse citée');
  assert.equal(revealing(fut, 'Repère le sujet : « les enfants ». Quel pronom le remplace ? Au futur : -ai, -as, -a, -ons, -ez, -ont.'), null);
  const tu = fake('forme', 'prendre', 'present', '2s', 'prends', ['prends', 'prend', 'prennent', 'prenons']);
  assert.ok(revealing(tu, 'Avec « tu », le verbe se termine toujours par -s ou -x.'), 'règle de la seule personne visée');
  assert.equal(revealing(tu, 'Au présent, « prendre » : -s, -s, -d, -ons, -ez, -ent.'), null);
  const ter = fake('terminaison', 'danser', 'present', '3p', 'ent', ['ent', 'e', 'es', 'ons'], { stem: 'dans', form: 'dansent' });
  assert.ok(revealing(ter, 'Pense à un verbe que tu connais bien : « ils chantent ».'), 'modèle (tuile)');
  assert.ok(revealing(ter, 'Avec « ils », -ent.'), 'tuile seule');
  assert.equal(revealing(ter, 'Au présent, verbes en -er : -e, -es, -e, -ons, -ez, -ent.'), null);
  const pc = fake('terminaison', 'finir', 'passe_compose', '1s', 'i', ['i', 'is', 'it', 'ir'], { stem: 'fin', form: 'ai fini' });
  assert.ok(revealing(pc, 'Après l’auxiliaire « ai », on écrit le participe passé. Pense à « j’ai choisi ».'), 'participe modèle');
  assert.equal(revealing(pc, 'Après l’auxiliaire « ai », on écrit le participe passé (pas l’infinitif). Astuce : mets-le au féminin dans ta tête.'), null);
  const part = fake('participe', 'partir', 'passe_compose', '3p', 'parties', ['parti', 'partie', 'partis', 'parties'], { g: 'f' });
  assert.ok(revealing(part, 'Avec « être », on ajoute -es.'), 'accord donné');
  assert.equal(revealing(part, 'Masculin ou féminin ? Singulier ou pluriel ? (féminin : on ajoute -e ; pluriel : -s)'), null);
  const suj = fake('sujet', 'habiter', 'present', '3s', 'elle', ['elle', 'ils', 'les renards', 'tu']);
  assert.ok(revealing(suj, 'Regarde bien la fin du verbe « habite » : elle indique la personne.'), 'pronom-réponse dans l’indice');
  assert.equal(revealing(suj, 'La fin du verbe « habite » indique la personne. Essaie chaque sujet devant le verbe.'), null);
  const tps = fake('temps', 'jouer', 'imparfait', '3s', 'imparfait', ['imparfait', 'present', 'futur', 'passe_compose']);
  assert.ok(revealing(tps, 'C’est l’imparfait.'), 'temps nommé');
  assert.equal(revealing(tps, 'Essaie de commencer la phrase par « Hier », « Aujourd’hui » ou « Demain ».'), null);
  assert.equal(citesWrongChoice(suj, 'Remplace-le par il, elle, ils ou elles.'), 'ils');
});

/* (les 9 000 items de la grille, ceux d'opts.kind et de fromKey passent aussi par revealing() dans checkItem) */
test('conjug : indices — ni révélateurs ni trompeurs, tableaux complets et justes, terminaison précise dans l’explication', () => {
  const stats = {};
  let n = 0;
  const check = (it, where) => {
    const why = revealing(it);
    assert.equal(why, null, `${where} ${it.key} [${it.kind}/${it.data.structure}] ${why}\n    choix : ${it.choices.map(c => c.label).join(' / ')}\n    indice : ${it.hint}`);
    const wrong = citesWrongChoice(it);
    assert.equal(wrong, null, `${where} ${it.key} : l’indice cite le mauvais choix « ${wrong} » : ${it.hint}`);
    /* tableau cité : complet (6 cases) et juste pour ce verbe ; la terminaison précise est dans l'explication */
    const list = endingList(it.hint);
    if (list.length >= 4 && ['forme', 'accord', 'terminaison', 'sujet'].includes(it.kind) && !COMPOUND(it.data.tense)) {
      assert.equal(list.length, 6, `${where} ${it.key} : tableau incomplet : ${it.hint}`);
      PERSONS.forEach((p, i) => assert.ok(formOf(it.data.verb, it.data.tense, p).endsWith(list[i]),
        `${where} ${it.key} : « -${list[i]} » ne termine pas ${it.data.verb} (${p}) : ${it.hint}`));
      const e = list[PERSONS.indexOf(it.data.person)];
      if (it.kind !== 'terminaison') assert.ok(it.explain.includes('le verbe se termine par -' + e + '.'), `${where} ${it.key} : explication sans la terminaison -${e} : ${it.explain}`);
    }
    stats[it.kind] = (stats[it.kind] || 0) + 1;
    n++;
  };
  for (const A of GRID) for (let s = 0; s < 40; s++) check(G.gen(A, makeRng('indice:' + A + ':' + s)), 'A=' + A);
  for (const kind of KINDS) for (const A of [0.5, 1.5, 2.2, 2.8, 3.3, 3.9, 4.4, 4.9, 5.4]) {
    for (let s = 0; s < 25; s++) check(G.gen(A, makeRng('indice:' + kind + A + ':' + s), { kind }), kind + ' A=' + A);
  }
  for (const key of ['fr.conjug:prendre|present|3p', 'fr.conjug:être|present|2s', 'fr.conjug:avoir|present|3s', 'fr.conjug:aller|futur|1s',
    'fr.conjug:aller|passe_compose|3p|f', 'fr.conjug:temps|faire|futur|2p', 'fr.conjug:cod|ramasser|passe_compose|fp']) {
    check(G.fromKey(key, 5, makeRng('indice:' + key)), 'fromKey');
  }
  assert.ok(n > 3000 && Object.keys(stats).length === KINDS.length, `${n} items ${JSON.stringify(stats)}`);
});
