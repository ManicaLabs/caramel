/* Moteur de conjugaison (js/content/fr/verbs.js) : tables de référence ÉCRITES À LA MAIN
   (orthographe traditionnelle), 21 verbes × 6 temps × 6 personnes, accords du participe passé
   avec être (masculin / féminin), élision, découpage radical + terminaison, fautes typiques. */
import { test, assert } from './_t.mjs';
import {
  conjugate, formOf, pronoun, withPronoun, participle, agree, pastParticiple, groupOf, auxOf, isEtreVerb,
  isPlainForm, plainForm, stemEnding, paradigm, verbInfo, VERBS, TENSES, PERSONS, TENSE_LABEL, PERSON_LABEL
} from '../js/content/fr/verbs.js';

const T = ['present', 'imparfait', 'futur', 'passe_compose', 'passe_simple', 'plus_que_parfait'];
/* Une ligne par temps, les 6 personnes séparées par « , » (je, tu, il, nous, vous, ils).
   Pour les verbes avec être : pc / pqp = masculin, pcF / pqpF = féminin. */
const REF = {
  'être': {
    present: 'suis, es, est, sommes, êtes, sont',
    imparfait: 'étais, étais, était, étions, étiez, étaient',
    futur: 'serai, seras, sera, serons, serez, seront',
    passe_compose: 'ai été, as été, a été, avons été, avez été, ont été',
    passe_simple: 'fus, fus, fut, fûmes, fûtes, furent',
    plus_que_parfait: 'avais été, avais été, avait été, avions été, aviez été, avaient été'
  },
  avoir: {
    present: 'ai, as, a, avons, avez, ont',
    imparfait: 'avais, avais, avait, avions, aviez, avaient',
    futur: 'aurai, auras, aura, aurons, aurez, auront',
    passe_compose: 'ai eu, as eu, a eu, avons eu, avez eu, ont eu',
    passe_simple: 'eus, eus, eut, eûmes, eûtes, eurent',
    plus_que_parfait: 'avais eu, avais eu, avait eu, avions eu, aviez eu, avaient eu'
  },
  aller: {
    present: 'vais, vas, va, allons, allez, vont',
    imparfait: 'allais, allais, allait, allions, alliez, allaient',
    futur: 'irai, iras, ira, irons, irez, iront',
    passe_compose: 'suis allé, es allé, est allé, sommes allés, êtes allés, sont allés',
    passe_composeF: 'suis allée, es allée, est allée, sommes allées, êtes allées, sont allées',
    passe_simple: 'allai, allas, alla, allâmes, allâtes, allèrent',
    plus_que_parfait: 'étais allé, étais allé, était allé, étions allés, étiez allés, étaient allés',
    plus_que_parfaitF: 'étais allée, étais allée, était allée, étions allées, étiez allées, étaient allées'
  },
  faire: {
    present: 'fais, fais, fait, faisons, faites, font',
    imparfait: 'faisais, faisais, faisait, faisions, faisiez, faisaient',
    futur: 'ferai, feras, fera, ferons, ferez, feront',
    passe_compose: 'ai fait, as fait, a fait, avons fait, avez fait, ont fait',
    passe_simple: 'fis, fis, fit, fîmes, fîtes, firent',
    plus_que_parfait: 'avais fait, avais fait, avait fait, avions fait, aviez fait, avaient fait'
  },
  dire: {
    present: 'dis, dis, dit, disons, dites, disent',
    imparfait: 'disais, disais, disait, disions, disiez, disaient',
    futur: 'dirai, diras, dira, dirons, direz, diront',
    passe_compose: 'ai dit, as dit, a dit, avons dit, avez dit, ont dit',
    passe_simple: 'dis, dis, dit, dîmes, dîtes, dirent',
    plus_que_parfait: 'avais dit, avais dit, avait dit, avions dit, aviez dit, avaient dit'
  },
  venir: {
    present: 'viens, viens, vient, venons, venez, viennent',
    imparfait: 'venais, venais, venait, venions, veniez, venaient',
    futur: 'viendrai, viendras, viendra, viendrons, viendrez, viendront',
    passe_compose: 'suis venu, es venu, est venu, sommes venus, êtes venus, sont venus',
    passe_composeF: 'suis venue, es venue, est venue, sommes venues, êtes venues, sont venues',
    passe_simple: 'vins, vins, vint, vînmes, vîntes, vinrent',
    plus_que_parfait: 'étais venu, étais venu, était venu, étions venus, étiez venus, étaient venus',
    plus_que_parfaitF: 'étais venue, étais venue, était venue, étions venues, étiez venues, étaient venues'
  },
  pouvoir: {
    present: 'peux, peux, peut, pouvons, pouvez, peuvent',
    imparfait: 'pouvais, pouvais, pouvait, pouvions, pouviez, pouvaient',
    futur: 'pourrai, pourras, pourra, pourrons, pourrez, pourront',
    passe_compose: 'ai pu, as pu, a pu, avons pu, avez pu, ont pu',
    passe_simple: 'pus, pus, put, pûmes, pûtes, purent',
    plus_que_parfait: 'avais pu, avais pu, avait pu, avions pu, aviez pu, avaient pu'
  },
  voir: {
    present: 'vois, vois, voit, voyons, voyez, voient',
    imparfait: 'voyais, voyais, voyait, voyions, voyiez, voyaient',
    futur: 'verrai, verras, verra, verrons, verrez, verront',
    passe_compose: 'ai vu, as vu, a vu, avons vu, avez vu, ont vu',
    passe_simple: 'vis, vis, vit, vîmes, vîtes, virent',
    plus_que_parfait: 'avais vu, avais vu, avait vu, avions vu, aviez vu, avaient vu'
  },
  vouloir: {
    present: 'veux, veux, veut, voulons, voulez, veulent',
    imparfait: 'voulais, voulais, voulait, voulions, vouliez, voulaient',
    futur: 'voudrai, voudras, voudra, voudrons, voudrez, voudront',
    passe_compose: 'ai voulu, as voulu, a voulu, avons voulu, avez voulu, ont voulu',
    passe_simple: 'voulus, voulus, voulut, voulûmes, voulûtes, voulurent',
    plus_que_parfait: 'avais voulu, avais voulu, avait voulu, avions voulu, aviez voulu, avaient voulu'
  },
  prendre: {
    present: 'prends, prends, prend, prenons, prenez, prennent',
    imparfait: 'prenais, prenais, prenait, prenions, preniez, prenaient',
    futur: 'prendrai, prendras, prendra, prendrons, prendrez, prendront',
    passe_compose: 'ai pris, as pris, a pris, avons pris, avez pris, ont pris',
    passe_simple: 'pris, pris, prit, prîmes, prîtes, prirent',
    plus_que_parfait: 'avais pris, avais pris, avait pris, avions pris, aviez pris, avaient pris'
  },
  finir: {
    present: 'finis, finis, finit, finissons, finissez, finissent',
    imparfait: 'finissais, finissais, finissait, finissions, finissiez, finissaient',
    futur: 'finirai, finiras, finira, finirons, finirez, finiront',
    passe_compose: 'ai fini, as fini, a fini, avons fini, avez fini, ont fini',
    passe_simple: 'finis, finis, finit, finîmes, finîtes, finirent',
    plus_que_parfait: 'avais fini, avais fini, avait fini, avions fini, aviez fini, avaient fini'
  },
  chanter: {
    present: 'chante, chantes, chante, chantons, chantez, chantent',
    imparfait: 'chantais, chantais, chantait, chantions, chantiez, chantaient',
    futur: 'chanterai, chanteras, chantera, chanterons, chanterez, chanteront',
    passe_compose: 'ai chanté, as chanté, a chanté, avons chanté, avez chanté, ont chanté',
    passe_simple: 'chantai, chantas, chanta, chantâmes, chantâtes, chantèrent',
    plus_que_parfait: 'avais chanté, avais chanté, avait chanté, avions chanté, aviez chanté, avaient chanté'
  },
  manger: {
    present: 'mange, manges, mange, mangeons, mangez, mangent',
    imparfait: 'mangeais, mangeais, mangeait, mangions, mangiez, mangeaient',
    futur: 'mangerai, mangeras, mangera, mangerons, mangerez, mangeront',
    passe_compose: 'ai mangé, as mangé, a mangé, avons mangé, avez mangé, ont mangé',
    passe_simple: 'mangeai, mangeas, mangea, mangeâmes, mangeâtes, mangèrent',
    plus_que_parfait: 'avais mangé, avais mangé, avait mangé, avions mangé, aviez mangé, avaient mangé'
  },
  commencer: {
    present: 'commence, commences, commence, commençons, commencez, commencent',
    imparfait: 'commençais, commençais, commençait, commencions, commenciez, commençaient',
    futur: 'commencerai, commenceras, commencera, commencerons, commencerez, commenceront',
    passe_compose: 'ai commencé, as commencé, a commencé, avons commencé, avez commencé, ont commencé',
    passe_simple: 'commençai, commenças, commença, commençâmes, commençâtes, commencèrent',
    plus_que_parfait: 'avais commencé, avais commencé, avait commencé, avions commencé, aviez commencé, avaient commencé'
  },
  appeler: {
    present: 'appelle, appelles, appelle, appelons, appelez, appellent',
    imparfait: 'appelais, appelais, appelait, appelions, appeliez, appelaient',
    futur: 'appellerai, appelleras, appellera, appellerons, appellerez, appelleront',
    passe_compose: 'ai appelé, as appelé, a appelé, avons appelé, avez appelé, ont appelé',
    passe_simple: 'appelai, appelas, appela, appelâmes, appelâtes, appelèrent',
    plus_que_parfait: 'avais appelé, avais appelé, avait appelé, avions appelé, aviez appelé, avaient appelé'
  },
  jeter: {
    present: 'jette, jettes, jette, jetons, jetez, jettent',
    imparfait: 'jetais, jetais, jetait, jetions, jetiez, jetaient',
    futur: 'jetterai, jetteras, jettera, jetterons, jetterez, jetteront',
    passe_compose: 'ai jeté, as jeté, a jeté, avons jeté, avez jeté, ont jeté',
    passe_simple: 'jetai, jetas, jeta, jetâmes, jetâtes, jetèrent',
    plus_que_parfait: 'avais jeté, avais jeté, avait jeté, avions jeté, aviez jeté, avaient jeté'
  },
  acheter: {
    present: 'achète, achètes, achète, achetons, achetez, achètent',
    imparfait: 'achetais, achetais, achetait, achetions, achetiez, achetaient',
    futur: 'achèterai, achèteras, achètera, achèterons, achèterez, achèteront',
    passe_compose: 'ai acheté, as acheté, a acheté, avons acheté, avez acheté, ont acheté',
    passe_simple: 'achetai, achetas, acheta, achetâmes, achetâtes, achetèrent',
    plus_que_parfait: 'avais acheté, avais acheté, avait acheté, avions acheté, aviez acheté, avaient acheté'
  },
  nettoyer: {
    present: 'nettoie, nettoies, nettoie, nettoyons, nettoyez, nettoient',
    imparfait: 'nettoyais, nettoyais, nettoyait, nettoyions, nettoyiez, nettoyaient',
    futur: 'nettoierai, nettoieras, nettoiera, nettoierons, nettoierez, nettoieront',
    passe_compose: 'ai nettoyé, as nettoyé, a nettoyé, avons nettoyé, avez nettoyé, ont nettoyé',
    passe_simple: 'nettoyai, nettoyas, nettoya, nettoyâmes, nettoyâtes, nettoyèrent',
    plus_que_parfait: 'avais nettoyé, avais nettoyé, avait nettoyé, avions nettoyé, aviez nettoyé, avaient nettoyé'
  },
  envoyer: {
    present: 'envoie, envoies, envoie, envoyons, envoyez, envoient',
    imparfait: 'envoyais, envoyais, envoyait, envoyions, envoyiez, envoyaient',
    futur: 'enverrai, enverras, enverra, enverrons, enverrez, enverront',
    passe_compose: 'ai envoyé, as envoyé, a envoyé, avons envoyé, avez envoyé, ont envoyé',
    passe_simple: 'envoyai, envoyas, envoya, envoyâmes, envoyâtes, envoyèrent',
    plus_que_parfait: 'avais envoyé, avais envoyé, avait envoyé, avions envoyé, aviez envoyé, avaient envoyé'
  },
  partir: {
    present: 'pars, pars, part, partons, partez, partent',
    imparfait: 'partais, partais, partait, partions, partiez, partaient',
    futur: 'partirai, partiras, partira, partirons, partirez, partiront',
    passe_compose: 'suis parti, es parti, est parti, sommes partis, êtes partis, sont partis',
    passe_composeF: 'suis partie, es partie, est partie, sommes parties, êtes parties, sont parties',
    passe_simple: 'partis, partis, partit, partîmes, partîtes, partirent',
    plus_que_parfait: 'étais parti, étais parti, était parti, étions partis, étiez partis, étaient partis',
    plus_que_parfaitF: 'étais partie, étais partie, était partie, étions parties, étiez parties, étaient parties'
  },
  mettre: {
    present: 'mets, mets, met, mettons, mettez, mettent',
    imparfait: 'mettais, mettais, mettait, mettions, mettiez, mettaient',
    futur: 'mettrai, mettras, mettra, mettrons, mettrez, mettront',
    passe_compose: 'ai mis, as mis, a mis, avons mis, avez mis, ont mis',
    passe_simple: 'mis, mis, mit, mîmes, mîtes, mirent',
    plus_que_parfait: 'avais mis, avais mis, avait mis, avions mis, aviez mis, avaient mis'
  }
};
const split = row => row.split(', ');

test('verbs : tables de référence (21 verbes × 6 temps × 6 personnes)', () => {
  let n = 0;
  for (const [verb, rows] of Object.entries(REF)) {
    for (const t of T) {
      const exp = split(rows[t]);
      assert.equal(exp.length, 6, verb + ' ' + t);
      PERSONS.forEach((p, i) => {
        const g = 'm';
        assert.equal(conjugate(verb, t, p, { g }).form, exp[i], `${verb} · ${t} · ${p}`);
        n++;
      });
      if (rows[t + 'F']) {
        const expF = split(rows[t + 'F']);
        PERSONS.forEach((p, i) => { assert.equal(conjugate(verb, t, p, { g: 'f' }).form, expF[i], `${verb} · ${t} · ${p} · f`); n++; });
      }
    }
  }
  assert.ok(n >= 21 * 36, 'formes vérifiées : ' + n);
});

test('verbs : autres verbes (formes écrites à la main)', () => {
  const C = [
    ['crier', 'imparfait', '1p', 'criions'], ['crier', 'imparfait', '2p', 'criiez'], ['oublier', 'imparfait', '2p', 'oubliiez'],
    ['oublier', 'futur', '1s', 'oublierai'], ['colorier', 'present', '3p', 'colorient'],
    ['essuyer', 'futur', '1s', 'essuierai'], ['essuyer', 'present', '3p', 'essuient'], ['essuyer', 'imparfait', '1p', 'essuyions'],
    ['aboyer', 'present', '3p', 'aboient'], ['aboyer', 'futur', '3s', 'aboiera'], ['appuyer', 'present', '1s', 'appuie'],
    ['lever', 'futur', '3p', 'lèveront'], ['lever', 'present', '1p', 'levons'], ['lever', 'present', '2s', 'lèves'],
    ['promener', 'present', '3p', 'promènent'], ['promener', 'futur', '1s', 'promènerai'], ['promener', 'imparfait', '3s', 'promenait'],
    ['lancer', 'present', '1p', 'lançons'], ['lancer', 'passe_simple', '3s', 'lança'], ['avancer', 'imparfait', '3p', 'avançaient'],
    ['avancer', 'passe_simple', '3p', 'avancèrent'], ['annoncer', 'imparfait', '1p', 'annoncions'],
    ['nager', 'present', '1p', 'nageons'], ['nager', 'imparfait', '3s', 'nageait'], ['voyager', 'passe_simple', '1p', 'voyageâmes'],
    ['plonger', 'passe_simple', '3p', 'plongèrent'], ['ranger', 'imparfait', '2p', 'rangiez'], ['partager', 'futur', '3p', 'partageront'],
    ['habiter', 'present', '1s', 'habite'], ['jouer', 'futur', '1p', 'jouerons'], ['jouer', 'futur', '3p', 'joueront'],
    ['choisir', 'present', '3p', 'choisissent'], ['grandir', 'imparfait', '1s', 'grandissais'], ['obéir', 'passe_simple', '3p', 'obéirent'],
    ['applaudir', 'passe_simple', '1p', 'applaudîmes'], ['remplir', 'futur', '2p', 'remplirez'], ['atterrir', 'present', '3p', 'atterrissent'],
    ['apprendre', 'present', '3p', 'apprennent'], ['apprendre', 'passe_simple', '3s', 'apprit'], ['comprendre', 'passe_simple', '3p', 'comprirent'],
    ['comprendre', 'imparfait', '1p', 'comprenions'], ['devenir', 'futur', '1s', 'deviendrai'], ['devenir', 'passe_simple', '3s', 'devint'],
    ['revenir', 'passe_simple', '3p', 'revinrent'], ['revenir', 'present', '3p', 'reviennent'], ['tenir', 'passe_simple', '1p', 'tînmes'],
    ['tenir', 'futur', '3s', 'tiendra'], ['sortir', 'present', '1s', 'sors'], ['sortir', 'present', '3s', 'sort'], ['dormir', 'present', '3p', 'dorment'],
    ['savoir', 'present', '3p', 'savent'], ['savoir', 'futur', '1s', 'saurai'], ['savoir', 'passe_simple', '3p', 'surent'],
    ['devoir', 'present', '3p', 'doivent'], ['devoir', 'futur', '2p', 'devrez'], ['devoir', 'passe_simple', '3s', 'dut'],
    ['lire', 'present', '2p', 'lisez'], ['lire', 'passe_simple', '1p', 'lûmes'], ['écrire', 'present', '1p', 'écrivons'],
    ['écrire', 'passe_simple', '3p', 'écrivirent'], ['écrire', 'imparfait', '3s', 'écrivait'], ['courir', 'futur', '1s', 'courrai'],
    ['courir', 'passe_simple', '3p', 'coururent'], ['courir', 'present', '3s', 'court']
  ];
  for (const [v, t, p, f] of C) assert.equal(formOf(v, t, p), f, `${v} · ${t} · ${p}`);
  /* temps composés */
  assert.equal(formOf('sortir', 'passe_compose', '3p', { g: 'f' }), 'sont sorties');
  assert.equal(formOf('devenir', 'plus_que_parfait', '3s', { g: 'f' }), 'était devenue');
  assert.equal(formOf('revenir', 'passe_compose', '1p', { g: 'm' }), 'sommes revenus');
  assert.equal(formOf('tomber', 'passe_compose', '3s', { g: 'f' }), 'est tombée');
  assert.equal(formOf('arriver', 'plus_que_parfait', '3p', { g: 'f' }), 'étaient arrivées');
  assert.equal(formOf('devoir', 'passe_compose', '3s'), 'a dû');
  assert.equal(formOf('écrire', 'passe_compose', '1s'), 'ai écrit');
  assert.equal(formOf('courir', 'plus_que_parfait', '2s'), 'avais couru');
  assert.equal(formOf('mettre', 'passe_compose', '3p'), 'ont mis');
});

test('verbs : accord du participe passé (être, COD placé avant)', () => {
  const r = conjugate('aller', 'passe_compose', '3p', { g: 'f' });
  assert.deepEqual([r.form, r.aux, r.participle, r.auxVerb], ['sont allées', 'sont', 'allées', 'être']);
  assert.equal(conjugate('partir', 'passe_compose', '3s', { g: 'f' }).participle, 'partie');
  assert.equal(conjugate('venir', 'plus_que_parfait', '3p', { g: 'm' }).form, 'étaient venus');
  /* avoir : invariable sans COD, accord avec le COD placé avant */
  assert.equal(conjugate('ramasser', 'passe_compose', '1s').form, 'ai ramassé');
  assert.equal(conjugate('ramasser', 'passe_compose', '1s', { g: 'f' }).form, 'ai ramassé');
  assert.equal(conjugate('ramasser', 'passe_compose', '1s', { cod: { g: 'f', n: 'p' } }).form, 'ai ramassées');
  assert.equal(conjugate('prendre', 'passe_compose', '3s', { cod: { g: 'f', n: 's' } }).form, 'a prise');
  assert.equal(conjugate('prendre', 'passe_compose', '3s', { cod: { g: 'm', n: 'p' } }).form, 'a pris');
  assert.equal(conjugate('faire', 'plus_que_parfait', '3p', { cod: { g: 'f', n: 'p' } }).form, 'avaient faites');
  assert.equal(conjugate('voir', 'passe_compose', '1p', { cod: { g: 'f', n: 'p' } }).form, 'avons vues');
  assert.equal(conjugate('finir', 'passe_compose', '2s', { cod: { g: 'f', n: 's' } }).form, 'as finie');
  /* accords écrits à la main */
  const A = { allé: 'allé allée allés allées', fait: 'fait faite faits faites', pris: 'pris prise pris prises', fini: 'fini finie finis finies',
    'dû': 'dû due dus dues', 'été': 'été été été été', vu: 'vu vue vus vues', dit: 'dit dite dits dites' };
  for (const [pp, row] of Object.entries(A)) {
    const [ms, fs, mp, fp] = row.split(' ');
    assert.deepEqual([agree(pp, 'm', 's'), agree(pp, 'f', 's'), agree(pp, 'm', 'p'), agree(pp, 'f', 'p')], [ms, fs, mp, fp], pp);
  }
  assert.equal(participle('sortir', 'f', 'p'), 'sorties');
  assert.equal(pastParticiple('apprendre'), 'appris');
  assert.equal(pastParticiple('devenir'), 'devenu');
  assert.equal(pastParticiple('choisir'), 'choisi');
  assert.equal(pastParticiple('nettoyer'), 'nettoyé');
});

test('verbs : pronom et élision', () => {
  assert.equal(pronoun('1s', 'ai'), 'j’');
  assert.equal(pronoun('1s', 'habite'), 'j’');
  assert.equal(pronoun('1s', 'étais'), 'j’');
  assert.equal(pronoun('1s', 'irai'), 'j’');
  assert.equal(pronoun('1s', 'suis allée'), 'je');
  assert.equal(pronoun('1s', 'vais'), 'je');
  assert.equal(pronoun('2s', 'aimes'), 'tu');
  assert.equal(pronoun('3s', 'chante'), 'il');
  assert.equal(pronoun('3s', 'chante', 'f'), 'elle');
  assert.equal(pronoun('3p', 'sont', 'f'), 'elles');
  assert.equal(pronoun('1p', 'avons'), 'nous');
  assert.equal(pronoun('2p', 'êtes'), 'vous');
  assert.equal(withPronoun('1s', 'ai chanté'), 'j’ai chanté');
  assert.equal(withPronoun('1s', 'écoute'), 'j’écoute');
  assert.equal(withPronoun('3p', 'sont parties', 'f'), 'elles sont parties');
  assert.equal(withPronoun('1s', 'chante'), 'je chante');
});

test('verbs : informations, groupes, auxiliaires', () => {
  assert.equal(groupOf('être'), 0); assert.equal(groupOf('avoir'), 0);
  assert.equal(groupOf('chanter'), 1); assert.equal(groupOf('finir'), 2); assert.equal(groupOf('aller'), 3);
  assert.equal(groupOf('prendre'), 3); assert.equal(groupOf('apprendre'), 3); assert.equal(groupOf('inconnu'), null);
  for (const v of ['aller', 'arriver', 'entrer', 'tomber', 'rester', 'monter', 'rentrer', 'partir', 'sortir', 'venir', 'devenir', 'revenir']) {
    assert.equal(auxOf(v), 'être', v); assert.ok(isEtreVerb(v), v);
  }
  for (const v of ['avoir', 'être', 'chanter', 'finir', 'faire', 'prendre', 'dormir', 'courir']) assert.equal(auxOf(v), 'avoir', v);
  assert.deepEqual(verbInfo('appeler'), { inf: 'appeler', group: 1, aux: 'avoir', pp: 'appelé', variant: 'll', irregular: false });
  assert.equal(verbInfo('zzz'), null);
  /* tous les verbes de la liste se conjuguent à tous les temps, sans trou */
  for (const v of VERBS) for (const t of TENSES) for (const p of PERSONS) {
    const r = conjugate(v, t, p, { g: 'f' });
    assert.ok(r && typeof r.form === 'string' && r.form.length > 0 && !/undefined|null/.test(r.form), `${v} ${t} ${p}`);
  }
  /* aucun verbe à double orthographe admise */
  for (const v of ['payer', 'essayer', 'préférer', 'espérer', 'répéter', 'balayer', 'nettoyer']) {
    if (v === 'nettoyer') assert.ok(VERBS.includes(v)); else assert.ok(!VERBS.includes(v), v);
  }
  assert.equal(conjugate('chanter', 'conditionnel', '1s'), null);
  assert.equal(conjugate('chanter', 'present', '4s'), null);
  assert.equal(TENSE_LABEL.plus_que_parfait, 'plus-que-parfait');
  assert.equal(PERSON_LABEL['1s'], '1re personne du singulier');
});

test('verbs : variations du radical et formes « fautives »', () => {
  assert.equal(isPlainForm('manger', 'present', '3p'), true);
  assert.equal(isPlainForm('manger', 'present', '1p'), false);
  assert.equal(isPlainForm('manger', 'imparfait', '1p'), true);
  assert.equal(isPlainForm('manger', 'imparfait', '3s'), false);
  assert.equal(isPlainForm('appeler', 'present', '1p'), true);
  assert.equal(isPlainForm('appeler', 'futur', '1p'), false);
  assert.equal(isPlainForm('nettoyer', 'present', '3s'), false);
  assert.equal(isPlainForm('envoyer', 'futur', '3s'), false);
  assert.equal(isPlainForm('chanter', 'present', '3s'), true);
  assert.equal(plainForm('aboyer', 'present', '3p'), 'aboyent');
  assert.equal(plainForm('manger', 'present', '1p'), 'mangons');
  assert.equal(plainForm('commencer', 'imparfait', '3s'), 'commencait');
  assert.equal(plainForm('appeler', 'present', '3s'), 'appele');
  assert.equal(plainForm('acheter', 'futur', '1s'), 'acheterai');
  assert.equal(plainForm('envoyer', 'futur', '3s'), 'envoyera');
  for (const f of ['aboyent', 'mangons', 'commencait', 'appele', 'acheterai', 'envoyera']) {
    const v = { aboyent: 'aboyer', mangons: 'manger', commencait: 'commencer', appele: 'appeler', acheterai: 'acheter', envoyera: 'envoyer' }[f];
    assert.ok(!paradigm(v).has(f), f + ' ne doit pas être une vraie forme');
  }
  assert.ok(paradigm('prendre').has('prit') && paradigm('prendre').has('prirent') && paradigm('prendre').has('prises'));
  assert.ok(!paradigm('prendre').has('a prit'));
});

test('verbs : radical + terminaison (tuiles)', () => {
  assert.deepEqual(stemEnding('chanter', 'present', '3p'), { stem: 'chant', ending: 'ent' });
  assert.deepEqual(stemEnding('chanter', 'futur', '1p'), { stem: 'chanter', ending: 'ons' });
  assert.deepEqual(stemEnding('chanter', 'imparfait', '3s'), { stem: 'chant', ending: 'ait' });
  assert.deepEqual(stemEnding('chanter', 'passe_simple', '3p'), { stem: 'chant', ending: 'èrent' });
  assert.deepEqual(stemEnding('chanter', 'passe_compose', '2s'), { stem: 'chant', ending: 'é' });
  assert.deepEqual(stemEnding('finir', 'present', '1p'), { stem: 'fin', ending: 'issons' });
  assert.deepEqual(stemEnding('finir', 'imparfait', '3p'), { stem: 'finiss', ending: 'aient' });
  assert.deepEqual(stemEnding('finir', 'passe_compose', '3s'), { stem: 'fin', ending: 'i' });
  assert.deepEqual(stemEnding('aller', 'futur', '2s'), { stem: 'ir', ending: 'as' });
  assert.deepEqual(stemEnding('faire', 'imparfait', '1p'), { stem: 'fais', ending: 'ions' });
  assert.deepEqual(stemEnding('appeler', 'futur', '3p'), { stem: 'appeller', ending: 'ont' });
  assert.equal(stemEnding('manger', 'imparfait', '1s'), null);          /* radical variable (mange-/mang-) */
  assert.equal(stemEnding('faire', 'present', '3p'), null);             /* présent irrégulier */
  assert.equal(stemEnding('aller', 'passe_compose', '3s'), null);       /* auxiliaire être */
  /* le radical + la terminaison redonnent toujours la forme */
  for (const v of ['jouer', 'finir', 'être', 'avoir', 'faire', 'venir', 'acheter', 'nettoyer', 'envoyer', 'grandir', 'crier'])
    for (const t of ['present', 'imparfait', 'futur', 'passe_simple'])
      for (const p of PERSONS) {
        const se = stemEnding(v, t, p);
        if (se) assert.equal(se.stem + se.ending, formOf(v, t, p), `${v} ${t} ${p}`);
      }
});
