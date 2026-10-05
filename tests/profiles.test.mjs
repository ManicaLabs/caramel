/* Profils : création, normalisation (invariants du contrat §2), templating v11, classe. */
import { test, assert } from './_t.mjs';
import { defaultProfile, normalizeProfile, sanitizeName, tplMap, fillTemplate, setClasse, nextClasse,
         offerNextClasse, newProfileId, toDay, CAPS, DEFAULT_SETTINGS, READ_ALOUD_MODES } from '../js/core/profiles.js';
import { MOUNTS, SHOP } from '../js/content/companion-data.js';
import { thetaFromMclm } from '../js/core/levels.js';
import { deepClone } from '../js/core/util.js';

const TODAY = '2026-10-02';

/* 10 histoires v11 VERBATIM (index.html @ c5bd8d1, [id, titre, texte]) : à elles seules, les 17 jetons */
const V11_STORIES = [
  ["ce1-bain", "Le grand bain",
   "Ce matin, {N} est plein de boue. {P} prépare un grand bain tiède. {El} frotte le dos, les jambes et la tête. {N} secoue tout son corps et envoie des gouttes partout ! {P} rit très fort. Maintenant, {leM} est tout propre et tout doux."],
  ["pomme", "{N} {leM}",
   "{P} arrive à la ferme ce matin. {SonM} {N} attend près de la barrière. {El} brosse {sonM} doucement et lui donne une pomme bien rouge. {N} remue la queue car {ilM} est {contentM}. Ensuite, {P} pose la selle et met son casque pour la promenade."],
  ["cirque", "{N} au cirque",
   "Ce samedi, un cirque arrive au village avec des lumières partout. {N} regarde les acrobates qui volent sous le grand chapiteau rouge. Un clown rigolo lui offre un ballon jaune. {LeM} salue le public avec une belle révérence, et tout le monde applaudit très fort. {P} est {fiere} de {sonM}, une vraie star du cirque !"],
  ["plage", "{N} à la plage",
   "Cet été, {P} emmène {N} voir la mer pour la première fois. {LeM} pose une patte sur le sable chaud, puis {ilM} recule, {surprisM}. Une vague douce vient chatouiller ses jambes. {P} rit très fort. Ensemble, ils galopent le long de la plage, et le vent salé les décoiffe tous les deux."],
  ["concours", "Le grand concours",
   "Dimanche, le grand jour arrive enfin : le concours du club. {P} respire un grand coup, {el} a un peu peur. {N} avance vers le premier obstacle et saute très haut. Le public applaudit fort. À la fin du parcours, {P} reçoit un joli ruban bleu. {El} serre {sonM} dans ses bras car ils forment une belle équipe."],
  ["tresor", "Le trésor {duM} pirate",
   "Un matin, {P} trouve une vieille carte au fond de la grange. Elle montre un trésor caché près du grand chêne. {N} porte un foulard rouge, comme un vrai pirate. Ils suivent le chemin, passent le pont de bois et comptent dix pas. Sous la terre, ils découvrent un coffre rempli de pommes dorées !"],
  ["fee", "La fée des chevaux",
   "Cette nuit, une fée entre sans bruit dans la petite écurie. Elle touche la tête de {N} avec sa baguette magique. {LeM} brille comme une étoile et des ailes dorées poussent sur son dos. {IlM} vole très haut dans le ciel plein de nuages roses. Au matin, {P} trouve une plume dorée posée sur la paille."],
  ["reve", "Un rêve dans les nuages",
   "Cette nuit, {N} fait un rêve extraordinaire. {IlM} porte un casque brillant et flotte doucement au milieu des planètes colorées. Les étoiles dansent tout autour comme des lucioles géantes. {IlM} rebondit sur la lune, {legerM} comme une plume, et salue une comète pressée. Au réveil, {leM} observe longtemps le ciel du matin, comme pour garder un morceau de son rêve."],
  ["cm1-orage", "La nuit de la tempête",
   "Depuis le matin, de gros nuages sombres roulent dans le ciel de la ferme. Le vent se lève, les volets claquent, et les poules courent se cacher dans leur abri. {P} décide de rentrer {N} avant la pluie. Soudain, un éclair déchire le ciel et le tonnerre gronde comme un tambour géant. {LeM} tremble un peu, alors {P} pose une main douce sur son cou et lui parle calmement. Ensemble, ils traversent la cour sous les premières gouttes. Dans la grange, bien au sec, ils écoutent la pluie danser sur le toit. {N} pose sa tête contre {P}, {rassureM}, et la tempête devient presque une musique."],
  ["cm1-aurore", "Les lumières du nord",
   "Une légende raconte que, une nuit par an, le ciel du nord se remplit de couleurs dansantes. Cette nuit est arrivée. {P} prépare deux couvertures chaudes, un thermos de chocolat, et guide {N} vers le sommet de la colline. Le froid pique les joues, mais le spectacle mérite chaque pas. Vers minuit, un premier ruban vert ondule entre les étoiles, puis un voile rose, puis un fleuve violet qui traverse tout le ciel. {N} lève la tête, {fascineM}, les yeux remplis de lumière. {P} murmure que certaines merveilles se méritent avec de la patience. Ils restent là longtemps, dans un silence heureux, pendant que le ciel peint pour eux le plus beau tableau du monde."]
];
const TOKENS = ['P', 'N', 'El', 'el', 'fiere', 'leM', 'LeM', 'sonM', 'SonM', 'duM', 'IlM', 'ilM',
                'contentM', 'surprisM', 'legerM', 'rassureM', 'fascineM'];

function hero(g, type, extra = {}) {
  const p = defaultProfile({ id: 'p1', name: 'Zoé', g, today: TODAY });
  p.companion.type = type;
  p.companion.name = 'Pistou';
  return Object.assign(p, extra);
}

/* ---------- templating ---------- */
/* v2 : accords du duo héros + monture et de la monture, ajoutés APRÈS les 17 jetons v11 */
const V2_EXTRA = ['ils', 'Ils', 'eux', 'tousD', 'assisD', 'premiersD', 'herosD', 'pleinM', 'toutM', 'douxM'];
test('templating : 2 genres de héros × 8 montures, aucune accolade restante', () => {
  const used = new Set();
  for (const [, title, text] of V11_STORIES) for (const m of (title + text).matchAll(/\{(\w+)\}/g)) used.add(m[1]);
  assert.deepEqual([...used].sort(), [...TOKENS].sort(), 'la fixture couvre les 17 jetons');
  assert.equal(Object.keys(MOUNTS).length, 8);
  for (const g of ['f', 'm']) {
    for (const type of Object.keys(MOUNTS)) {
      const p = hero(g, type);
      const keys = Object.keys(tplMap(p));
      assert.deepEqual(keys.slice(0, TOKENS.length), TOKENS, 'dictionnaire v11 : mêmes clés, même ordre');
      assert.deepEqual(keys.slice(TOKENS.length), V2_EXTRA, 'jetons v2 ajoutés à la suite');
      for (const [id, title, text] of V11_STORIES) {
        for (const src of [title, text]) {
          const out = fillTemplate(src, p);
          assert.ok(!/[{}]/.test(out), `${g}/${type}/${id} : ${out}`);
          if (src.includes('{P}')) assert.ok(out.includes('Zoé'));
          if (src.includes('{N}')) assert.ok(out.includes('Pistou'));
          if (/\{(leM|LeM|sonM|SonM|duM)\}/.test(src)) assert.ok(out.includes(MOUNTS[type].noun), `${type} : ${out}`);
          assert.ok(!/ {2}/.test(out) && !/undefined|null/.test(out), out);
        }
      }
    }
  }
});

test('templating : accords féminins de la licorne', () => {
  const map = tplMap(hero('f', 'unicorn'));
  assert.deepEqual(
    [map.leM, map.LeM, map.sonM, map.SonM, map.duM, map.IlM, map.ilM, map.contentM, map.surprisM, map.legerM, map.rassureM, map.fascineM],
    ['la licorne', 'La licorne', 'sa licorne', 'Sa licorne', 'de la licorne', 'Elle', 'elle', 'contente', 'surprise', 'légère', 'rassurée', 'fascinée']);
  const story = id => V11_STORIES.find(s => s[0] === id);
  /* sortie v11 exacte de « Pistou la licorne » (histoire pomme) */
  const p = hero('f', 'unicorn');
  assert.equal(fillTemplate(story('pomme')[1], p), 'Pistou la licorne');
  assert.equal(fillTemplate(story('pomme')[2], p),
    'Zoé arrive à la ferme ce matin. Sa licorne Pistou attend près de la barrière. Elle brosse sa licorne doucement et lui donne une pomme bien rouge. Pistou remue la queue car elle est contente. Ensuite, Zoé pose la selle et met son casque pour la promenade.');
  assert.equal(fillTemplate(story('tresor')[1], p), 'Le trésor de la licorne pirate');
  assert.ok(fillTemplate(story('plage')[2], p).includes('puis elle recule, surprise.'));
  assert.ok(fillTemplate(story('reve')[2], p).includes('Elle rebondit sur la lune, légère comme une plume'));
  assert.ok(fillTemplate(story('cm1-orage')[2], p).includes('Pistou pose sa tête contre Zoé, rassurée,'));
  assert.ok(fillTemplate(story('cm1-aurore')[2], p).includes('Pistou lève la tête, fascinée,'));
  /* le genre du héros ne dépend pas de celui de la monture */
  const boy = hero('m', 'unicorn');
  assert.equal(tplMap(boy).El, 'Il');
  assert.ok(fillTemplate(story('cirque')[2], boy).includes('Zoé est fier de sa licorne'));
});

test('templating : accords masculins et genre du héros', () => {
  for (const type of Object.keys(MOUNTS).filter(t => t !== 'unicorn')) {
    const m = tplMap(hero('m', type));
    const noun = MOUNTS[type].noun;
    assert.equal(MOUNTS[type].g, 'm');
    assert.deepEqual([m.leM, m.LeM, m.sonM, m.SonM, m.duM], ['le ' + noun, 'Le ' + noun, 'son ' + noun, 'Son ' + noun, 'du ' + noun]);
    assert.deepEqual([m.IlM, m.ilM, m.contentM, m.surprisM, m.legerM, m.rassureM, m.fascineM],
      ['Il', 'il', 'content', 'surpris', 'léger', 'rassuré', 'fasciné']);
    assert.deepEqual([m.El, m.el, m.fiere], ['Il', 'il', 'fier']);
  }
  const girl = tplMap(hero('f', 'capy'));
  assert.deepEqual([girl.El, girl.el, girl.fiere, girl.SonM], ['Elle', 'elle', 'fière', 'Son capybara']);
  const concours = V11_STORIES.find(s => s[0] === 'concours')[2];
  assert.ok(fillTemplate(concours, hero('m', 'pony')).includes('Zoé respire un grand coup, il a un peu peur.'));
  assert.ok(fillTemplate(concours, hero('f', 'pony')).includes('Elle serre son poney dans ses bras'));
});

test('fillTemplate : jeton inconnu laissé tel quel, entrées farfelues', () => {
  const p = hero('f', 'pony');
  assert.equal(fillTemplate('{X} {constructor} {toString} {P} {N}', p), '{X} {constructor} {toString} Zoé Pistou');
  assert.equal(fillTemplate('{ P } {P', p), '{ P } {P');
  assert.equal(fillTemplate(undefined, p), '');
  assert.equal(fillTemplate(42, p), '42');
  /* profil absent ou partiel : valeurs par défaut de la v11 */
  assert.equal(fillTemplate('{P} et {N}, {leM}, {El}', null), 'Léa et Caramel, le poney, Elle');
  assert.equal(fillTemplate('{SonM}', { companion: { type: 'licorne' } }), 'Son poney');
  assert.equal(fillTemplate('{SonM}', { companion: { type: 'unicorn' } }), 'Sa licorne');
});

/* ---------- prénom ---------- */
test('sanitizeName : règles v11 (accolades, trim, 14 caractères, repli)', () => {
  assert.equal(sanitizeName(' {Lé}a ', 'X'), 'Léa');
  assert.equal(sanitizeName('', 'Léa'), 'Léa');
  assert.equal(sanitizeName(null, 'Léa'), 'Léa');
  assert.equal(sanitizeName(undefined, 'Caramel'), 'Caramel');
  assert.equal(sanitizeName('{}', 'Léa'), 'Léa');
  assert.equal(sanitizeName('   ', 'Licorne'), 'Licorne');
  assert.equal(sanitizeName('Marie-Antoinette Dupont', 'X'), 'Marie-Antoinet');
  assert.equal(sanitizeName('Marie-Antoinette Dupont', 'X').length, 14);
  assert.equal(sanitizeName(42, 'X'), '42');
  assert.equal(sanitizeName(0, 'X'), 'X');                    /* String(v || '') comme en v11 */
  /* améliorations : pas d'emoji coupé, pas d'espace final après troncature, pas de caractère de contrôle */
  assert.equal(sanitizeName('Abcdefghijklm🦄', 'X'), 'Abcdefghijklm');
  assert.equal(sanitizeName('Abcdefghijkl🦄', 'X'), 'Abcdefghijkl🦄');
  assert.equal(sanitizeName('Abcdefghijklm Z', 'X'), 'Abcdefghijklm');
  assert.equal(sanitizeName('Lé\na\t', 'X'), 'Léa');
  assert.equal(sanitizeName(sanitizeName(' {Zoé} ', 'X'), 'X'), 'Zoé');
});

/* ---------- profil par défaut ---------- */
test('defaultProfile : profil complet, réglages par défaut', () => {
  const p = defaultProfile({ id: 'p2', name: '  Zoé ', classe: 'CM2', today: TODAY });
  assert.equal(p.id, 'p2');
  assert.equal(p.name, 'Zoé');
  assert.equal(p.g, 'f');
  assert.equal(p.classe, 'CM2');
  assert.equal(p.classeSince, TODAY);
  assert.equal(p.created, TODAY);
  assert.deepEqual(p.companion, {
    type: 'pony', name: 'Caramel', owned: ['pony'], equip: { owned: [], worn: [] },
    pet: { faim: 80, forme: 80, joie: 80, last: 0, brushLast: 0, walkDay: '' }, stage: 1, minutes: 0 });
  assert.deepEqual(p.wallet, { apples: 0, stars: {} });
  assert.deepEqual(p.streak, { count: 0, last: '', freezes: 1, freezeWeek: '' });
  assert.deepEqual(p.settings, { sessionMin: 15, timers: false, sound: true, motion: 'full', theme: 'caramel', readAloud: 'on' });
  assert.deepEqual(p.settings, DEFAULT_SETTINGS);
  assert.notEqual(p.settings, DEFAULT_SETTINGS, 'copie, pas la référence partagée');
  assert.deepEqual(p.stats, { minutes: 0, sessions: 0, items: 0 });
  for (const k of ['skills', 'leitner']) assert.deepEqual(p[k], {});
  for (const k of ['evals', 'snapshots', 'history', 'mclm']) assert.deepEqual(p[k], []);
  assert.equal(p.today, null);
  assert.equal(p.legacy, null);
  const q = defaultProfile({ g: 'm', classe: 'sixième', today: TODAY });
  assert.equal(q.g, 'm');
  assert.equal(q.classe, null);
  assert.equal(q.classeSince, '');
  assert.equal(q.name, 'Léa');
  assert.equal(defaultProfile({ classe: 'ce1', today: TODAY }).classe, 'CE1');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(defaultProfile().created));
});

/* ---------- normalisation ---------- */
function messyProfile() {
  return {
    id: 'p3', name: '{Zoé}', g: 'x', classe: 'CM1', classeSince: 'hier', created: 12,
    companion: {
      type: 'unicorn', name: '', owned: ['dragon', 'dragon', 'licorne', 5],
      equip: { owned: ['chapeau', 'couronne', 'ailes', 'cape'], worn: ['chapeau', 'lunettes', 'ailes', 'couronne', 'cape'] },
      pet: { faim: -5, forme: '55.5', joie: 250, last: 'x', brushLast: -3, walkDay: 'mardi' },
      stage: 9, minutes: -4, accessoire: { futur: true }
    },
    wallet: { apples: -12.7, stars: { pomme: 5, foret: '2', cirque: 'abc', __proto__x: 1 } },
    streak: { count: '7', last: '2026-13-45x', freezes: 99, freezeWeek: 'W40' },
    skills: {
      'ma.faits': { t: 4.2, n: '3', last: TODAY, trend: 9, src: '' },
      'fr.fluence': { t: 'abc', n: 2 },
      'ma.ligne': { t: -1, n: 1 },
      'pas un axe': { t: 1, n: 1 }
    },
    evals: [{ date: '2026-09', classe: 'cm2', fr: { 'fr.vocab': 3.4, 'fr.ortho': null, 'fr.comp_oral': 'x' }, ma: { 'ma.ligne': 1.8 } }, 'abîmée'],
    snapshots: Array.from({ length: CAPS.snapshots + 6 }, (_, i) => ({ w: '2025-W' + String(i % 53 + 1).padStart(2, '0'), d: TODAY, s: { 'ma.faits': i / 40 } })),
    leitner: { 'ma.faits:7x8': { b: 9, due: 'demain', seen: 3.5, ok: -1 }, 'ma.faits:2x3': 'abîmé' },
    history: Array.from({ length: CAPS.history + 20 }, (_, i) => ({ d: TODAY, t: i, g: 'tables', ax: 'ma.faits', n: 10, ok: 8, th: i === CAPS.history + 19 ? 'x' : 3.5 })),
    mclm: Array.from({ length: CAPS.mclm + 10 }, (_, i) => ({ d: TODAY, t: i, s: 'pomme', v: i === 0 ? 'x' : 90 })),
    today: { d: TODAY, blocks: 'abîmé' },
    legacy: { from: 'v11', mclm: 'x', stars: 12.5 },
    settings: { sessionMin: 12, timers: 'oui', motion: 'turbo' },
    stats: { minutes: -1, sessions: 2.7 },
    champFutur: [1, 2, 3]
  };
}

test('normalizeProfile : invariants (bornes, ids, un objet par emplacement, plafonds)', () => {
  const src = messyProfile();
  const copy = deepClone(src);
  const p = normalizeProfile(src, TODAY);
  assert.deepEqual(src, copy, 'l’entrée n’est pas modifiée');
  assert.equal(p.name, 'Zoé');
  assert.equal(p.g, 'f');
  assert.equal(p.classe, 'CM1');
  assert.equal(p.classeSince, '');
  assert.equal(p.created, TODAY);
  /* compagnon */
  const c = p.companion;
  assert.equal(c.type, 'unicorn');
  assert.equal(c.name, 'Caramel');
  assert.deepEqual(c.owned, ['pony', 'dragon', 'unicorn']);  /* pony et le type courant toujours présents */
  assert.deepEqual(c.equip.owned, ['chapeau', 'couronne', 'ailes']);
  assert.deepEqual(c.equip.worn, ['ailes', 'couronne']);      /* ⊆ owned, un seul objet par emplacement (le dernier) */
  const slots = c.equip.worn.map(id => SHOP.find(s => s.id === id).slot);
  assert.equal(new Set(slots).size, slots.length);
  assert.deepEqual(c.pet, { faim: 15, forme: 55.5, joie: 100, last: 0, brushLast: 0, walkDay: '' });
  assert.equal(c.stage, 3);
  assert.equal(c.minutes, 0);
  assert.deepEqual(c.accessoire, { futur: true });             /* clé inconnue conservée */
  /* portefeuille, série */
  assert.equal(p.wallet.apples, 0);
  assert.deepEqual(p.wallet.stars, { pomme: 3, foret: 2, cirque: 0, __proto__x: 1 });
  assert.deepEqual(p.streak, { count: 7, last: '', freezes: CAPS.freezes, freezeWeek: '' });
  /* compétences : θ borné 0-3, θ illisible → axe retiré */
  assert.deepEqual(p.skills, {
    'ma.faits': { t: 3, n: 3, last: TODAY, trend: 3, src: 'defaut' },
    'ma.ligne': { t: 0, n: 1, last: '', trend: 0, src: 'defaut' }
  });
  assert.equal(p.evals.length, 1);
  assert.deepEqual(p.evals[0], { src: 'reperes', date: '2026-09', classe: 'CM2',
    fr: { 'fr.vocab': 3, 'fr.ortho': null }, ma: { 'ma.ligne': 1.8 }, added: '', precision: '' });
  /* plafonds : on garde les plus récents */
  assert.equal(p.snapshots.length, CAPS.snapshots);
  assert.equal(p.snapshots[0].s['ma.faits'], 6 / 40);
  assert.equal(p.history.length, CAPS.history);
  assert.equal(p.history[0].t, 20);
  assert.equal(p.history[0].th, 3);
  assert.ok(!('th' in p.history[CAPS.history - 1]), 'θ illisible retiré');
  assert.equal(p.mclm.length, CAPS.mclm);
  assert.ok(p.mclm.every(e => e.v === 90));
  /* Leitner */
  assert.deepEqual(p.leitner, { 'ma.faits:7x8': { b: 5, due: TODAY, seen: 3, ok: 0, last: '' } });
  /* divers */
  assert.equal(p.today, null);
  assert.deepEqual(p.legacy, { from: 'v11', mclm: null, stars: 12 });
  assert.deepEqual(p.settings, { sessionMin: 15, timers: false, sound: true, motion: 'full', theme: 'caramel', readAloud: 'on' });
  assert.deepEqual(p.stats, { minutes: 0, sessions: 2, items: 0 });
  assert.deepEqual(p.champFutur, [1, 2, 3]);
});

test('normalizeProfile : idempotente, sans effet sur un profil sain', () => {
  const p = normalizeProfile(messyProfile(), TODAY);
  const again = normalizeProfile(p, '2027-03-01');
  assert.equal(JSON.stringify(again), JSON.stringify(p));
  const q = defaultProfile({ id: 'p1', name: 'Lou', classe: 'CE2', today: TODAY });
  q.skills['ma.faits'] = { t: 1.62, n: 12, last: TODAY, trend: 0.1, src: 'jeu' };
  q.history.push({ d: TODAY, t: 1759400000000, g: 'tables', ax: 'ma.faits', n: 10, ok: 8, hint: 1, ms: 180000, th: 1.62, mode: 'balade' });
  q.mclm.push({ d: TODAY, t: 1759400000000, s: 'pomme', v: 92, p: 95, z: 88 });
  q.today = { d: TODAY, idx: 0, done: false, rewarded: false, blocks: [{ kind: 'echauffement', game: 'tables', axis: 'ma.faits', count: 7, offset: -0.6, done: false, result: null }] };
  q.settings = { sessionMin: 20, timers: true, sound: false, motion: 'soft', theme: 'ocean', readAloud: 'on' };
  assert.equal(JSON.stringify(normalizeProfile(q, '2030-01-01')), JSON.stringify(q));
  /* entrée non objet → profil par défaut */
  for (const bad of [null, undefined, 42, 'texte', [1, 2]]) {
    const d = normalizeProfile(bad, TODAY);
    assert.equal(d.name, 'Léa');
    assert.equal(d.companion.type, 'pony');
    assert.deepEqual(d.settings, DEFAULT_SETTINGS);
  }
});

test('réglage readAloud : Oui pour tous par défaut (v2.2.2), Non d’un parent gardé, anciens réglages convertis', () => {
  assert.deepEqual([...READ_ALOUD_MODES], ['on', 'off']);
  assert.equal(DEFAULT_SETTINGS.readAloud, 'on');
  const ra = (v, classe = 'CM2') => normalizeProfile({ name: 'Inès', classe, settings: v === undefined ? {} : { readAloud: v } }, TODAY).settings.readAloud;
  assert.equal(ra(undefined), 'on', 'profil d’avant la 2.2 (réglage absent) : lecture activée');
  assert.equal(ra('auto'), 'on', 'ancien « Automatique (CP-CE1) » de la 2.2 : activée, CM2 compris');
  assert.equal(ra('auto', 'CP'), 'on');
  assert.equal(ra('on'), 'on');
  assert.equal(ra('off'), 'off', '« Jamais » choisi par un parent : gardé');
  assert.equal(ra(true), 'on', 'ancien booléen vrai');
  assert.equal(ra(false), 'off', 'ancien booléen faux');
  for (const bad of [null, '', 'ON', 'OFF', 'oui', 1, 0, {}, ['off']]) assert.equal(ra(bad), 'on', JSON.stringify(bad));
  const p = normalizeProfile({ name: 'Hugo', classe: 'CP', settings: { readAloud: false, sessionMin: 10 } }, TODAY);
  assert.equal(p.settings.readAloud, 'off');
  assert.equal(p.settings.sessionMin, 10);
  assert.equal(JSON.stringify(normalizeProfile(p, '2027-01-01')), JSON.stringify(p), 'idempotent');
  assert.equal(defaultProfile({ name: 'Zoé', g: 'f', classe: 'CM2', today: TODAY }).settings.readAloud, 'on', 'nouveau profil CM2');
});

/* ---------- classe ---------- */
test('setClasse : classe, classeSince, fluence initialisée depuis la v11', () => {
  const p = defaultProfile({ id: 'p1', today: '2026-09-01' });
  p.legacy = { from: 'v11', mclm: 78, stars: 45 };
  p.today = { d: TODAY, blocks: [] };
  assert.equal(setClasse(p, 'CM2', TODAY), p);
  assert.equal(p.classe, 'CM2');
  assert.equal(p.classeSince, TODAY);
  assert.equal(p.today, null, 'plan du jour recalculé pour la nouvelle classe');
  assert.deepEqual(p.skills['fr.fluence'], { t: thetaFromMclm(78, 'CM2', TODAY), n: 1, last: '', trend: 0, src: 'v11' });
  const cm2 = p.skills['fr.fluence'].t;
  assert.ok(cm2 > 0 && cm2 < 2);
  /* correction de la classe le lendemain : estimation recalculée, classeSince mis à jour */
  setClasse(p, 'cm1', '2026-10-03');
  assert.equal(p.classe, 'CM1');
  assert.equal(p.classeSince, '2026-10-03');
  assert.equal(p.skills['fr.fluence'].t, thetaFromMclm(78, 'CM1', '2026-10-03'));
  assert.ok(p.skills['fr.fluence'].t > cm2);
  /* même classe : classeSince inchangé */
  setClasse(p, 'CM1', '2026-11-20');
  assert.equal(p.classeSince, '2026-10-03');
  /* classe invalide : rien ne change */
  setClasse(p, '6e', TODAY);
  assert.equal(p.classe, 'CM1');
});

test('setClasse : fluence déjà observée → estimation v11 ignorée', () => {
  const observed = [
    p => { p.mclm.push({ d: TODAY, t: 1, s: 'pomme', v: 95, p: 97, z: 90 }); },
    p => { p.skills['fr.fluence'] = { t: 2.4, n: 4, last: TODAY, trend: 0, src: 'eval' }; },
    p => { p.skills['fr.fluence'] = { t: 1.9, n: 2, last: TODAY, trend: 0.1, src: 'v11' }; }
  ];
  for (const make of observed) {
    const p = defaultProfile({ id: 'p1', today: TODAY });
    p.legacy = { from: 'v11', mclm: 100, stars: 60 };
    make(p);
    const before = deepClone(p.skills);
    setClasse(p, 'CM2', TODAY);
    assert.deepEqual(p.skills, before);
  }
  /* fluence par défaut non observée (n = 0) : remplacée */
  const p = defaultProfile({ id: 'p1', today: TODAY });
  p.legacy = { from: 'v1', mclm: 52, stars: 12 };
  p.skills['fr.fluence'] = { t: 1.5, n: 0, last: '', trend: 0, src: 'defaut' };
  setClasse(p, 'CE2', TODAY);
  assert.equal(p.skills['fr.fluence'].src, 'v11');
  /* pas d'estimation (aucune histoire à 2 ⭐) : aucun skill créé */
  const q = defaultProfile({ id: 'p1', today: TODAY });
  q.legacy = { from: 'v11', mclm: null, stars: 3 };
  setClasse(q, 'CE1', TODAY);
  assert.deepEqual(q.skills, {});
});

test('nextClasse et offerNextClasse (« Je passe en … ! » de juillet au 30 septembre)', () => {
  assert.deepEqual(['CP', 'CE1', 'CE2', 'CM1', 'CM2'].map(nextClasse), ['CE1', 'CE2', 'CM1', 'CM2', null]);
  assert.equal(nextClasse('6e'), null);
  assert.equal(nextClasse(null), null);
  const p = defaultProfile({ classe: 'CM1', today: '2026-03-10' });
  assert.equal(offerNextClasse(p, '2026-06-30'), null);
  assert.equal(offerNextClasse(p, '2026-07-01'), 'CM2');
  assert.equal(offerNextClasse(p, '2026-08-15'), 'CM2');
  assert.equal(offerNextClasse(p, '2026-09-30'), 'CM2');
  assert.equal(offerNextClasse(p, '2026-10-01'), null);
  setClasse(p, 'CM2', '2026-08-20');
  assert.equal(offerNextClasse(p, '2026-09-02'), null, 'CM2 : pas de classe suivante');
  const q = defaultProfile({ classe: 'CE1', today: '2026-07-05' });
  assert.equal(offerNextClasse(q, '2026-09-10'), null, 'classe choisie cet été : déjà la bonne');
  assert.equal(offerNextClasse(q, '2027-07-02'), 'CE2', 'l’été suivant');
  q.classeSince = '';
  assert.equal(offerNextClasse(q, '2026-09-10'), 'CE2', 'date inconnue : on propose');
  assert.equal(offerNextClasse(defaultProfile({ today: TODAY }), '2026-08-01'), null, 'sans classe');
  assert.equal(offerNextClasse(null, '2026-08-01'), null);
});

test('newProfileId et toDay', () => {
  assert.equal(newProfileId({ profiles: {} }), 'p1');
  assert.equal(newProfileId(null), 'p1');
  assert.equal(newProfileId({ profiles: { p1: {} } }), 'p2');
  assert.equal(newProfileId({ profiles: { p1: {}, p3: {}, autre: {} } }), 'p4');
  assert.equal(toDay('2026-10-02T23:59:00'), '2026-10-02');
  assert.equal(toDay(new Date(2026, 9, 2, 12)), '2026-10-02');
  assert.equal(toDay(new Date(2026, 9, 2, 12).getTime()), '2026-10-02');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(toDay('n’importe quoi')));
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(toDay()));
});

/* ---------- médailles gardées (v2.1) : une mise à jour ne retire jamais une médaille déjà montrée ---------- */
import { legacyMedals, MEDAL_TIERS } from '../js/core/profiles.js';
const EVAL_CM2 = { src: 'reperes', date: '2026-09', classe: 'CM2', added: TODAY, precision: '',
  fr: { 'fr.vocab': 2.8, 'fr.fluence': 1.6, 'fr.conjug': 1.2 }, ma: { 'ma.ligne': 2.3, 'ma.faits': null } };

test('médailles : un profil neuf n’en a aucune (champ présent et vide)', () => {
  const p = defaultProfile({ id: 'p1', name: 'Léa', classe: 'CM2', today: TODAY });
  assert.deepEqual(p.medals, {});
  const n = normalizeProfile({ ...deepClone(p), evals: [deepClone(EVAL_CM2)] }, TODAY);
  assert.deepEqual(n.medals, {}, 'une fiche importée en 2.1 ne donne pas de médaille sans jouer');
});

test('médailles : un profil d’avant la 2.1 garde celles que la v2.0 montrait (fiche comprise)', () => {
  const old = deepClone(defaultProfile({ id: 'p1', name: 'Léa', classe: 'CM2', today: TODAY }));
  delete old.medals;
  old.evals = [deepClone(EVAL_CM2)];
  const n = normalizeProfile(old, TODAY);
  assert.deepEqual(n.medals, { 'fr.vocab': 'or', 'fr.fluence': 'bronze', 'ma.ligne': 'argent' });
  assert.deepEqual(legacyMedals(n), n.medals, 'même règle que la v2.0');
  const again = normalizeProfile(n, TODAY);
  assert.deepEqual(again.medals, n.medals, 'idempotent');
});

test('médailles : valeurs illisibles écartées, niveaux connus seulement', () => {
  const p = deepClone(defaultProfile({ id: 'p1', name: 'Léa', classe: 'CM2', today: TODAY }));
  p.medals = { 'ma.faits': 'or', 'fr.vocab': 'platine', '': 'or', 'ma.ligne': 3, __proto__x: 'bronze' };
  const n = normalizeProfile(p, TODAY);
  assert.deepEqual(n.medals, { 'ma.faits': 'or', __proto__x: 'bronze' });
  assert.deepEqual([...MEDAL_TIERS], ['bronze', 'argent', 'or']);
});
