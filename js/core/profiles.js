/* ============ PROFILS : création, normalisation, templating, classe (contrat §5.1) ============
   Module pur (aucun accès au DOM ni au stockage) : importable dans Node.
   normalizeProfile garantit les invariants du schéma caramel-v3 (contrat §2) : nombres finis et bornés,
   ids de monture / d'accessoires valides, un seul objet porté par emplacement, tableaux plafonnés.
   Les clés inconnues sont conservées (compatibilité ascendante : champs ajoutés par une version future). */

import { clamp, dayStr, capFirst, deepClone } from './util.js';
import { CLASSES, radarTemplate } from './axes.js';
import { currentValues } from './radar-model.js';
import { badgeOf } from './economy.js';
import { thetaFromMclm } from './levels.js';
import { MOUNTS, SHOP, PET } from '../content/companion-data.js';
import { normalizeTheme, DEFAULT_THEME } from './themes.js';

export const DEFAULT_HERO = 'Léa';            /* héros par défaut de la v11 (defaultSave) */
export const DEFAULT_MOUNT_NAME = 'Caramel';
export const SESSION_MINUTES = Object.freeze([10, 15, 20]);
/* theme : thème visuel du profil (js/core/themes.js) ; id inconnu → 'caramel'.
   readAloud : lecture des consignes à voix haute (js/ui/voice.js) : 'on' = oui (défaut, pour TOUS les enfants depuis la
   2.2.2), 'off' = non (choisi par un parent, toujours gardé) ; l'ancien 'auto' (CP-CE1, jusqu'à la 2.2.1), un réglage
   absent ou inconnu → 'on' ; anciens booléens acceptés (true → 'on', false → 'off') */
export const READ_ALOUD_MODES = Object.freeze(['on', 'off']);
export const DEFAULT_SETTINGS = Object.freeze({ sessionMin: 15, timers: false, sound: true, motion: 'full', theme: DEFAULT_THEME, readAloud: 'on' });
/* plafonds des tableaux (contrat §2) ; freezes = gels de série cumulables au plus */
export const CAPS = Object.freeze({ history: 500, mclm: 300, snapshots: 104, freezes: 3 });
const NAME_MAX = 14;

/* ---------- petits utilitaires de normalisation ---------- */
const has = (o, k) => o !== null && o !== undefined && Object.prototype.hasOwnProperty.call(o, k);
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEK_RE = /^\d{4}-W\d{2}$/;
const AXIS_RE = /^[a-z]{2}\.[a-z_]+$/;
const SHOP_BY_ID = new Map(SHOP.map(it => [it.id, it]));
const isDay = v => typeof v === 'string' && DAY_RE.test(v);
/* nombre fini (nombre ou chaîne numérique, comme la coercition implicite de la v11), sinon def */
function num(v, def) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  return Number.isFinite(n) ? n : def;
}
const int = (v, def) => Math.trunc(num(v, def));
const uniq = arr => [...new Set(arr)];

/* date du jour normalisée 'AAAA-MM-JJ' (chaîne, Date ou horodatage ; invalide → aujourd'hui) */
export function toDay(v) {
  try {
    const s = v === undefined || v === null ? dayStr() : dayStr(typeof v === 'number' ? new Date(v) : v);
    return isDay(s) ? s : dayStr();
  } catch (_) { return dayStr(); }
}

/* recopie (en profondeur) les clés inconnues de src après les clés connues de out */
function withExtras(out, src) {
  if (!isObj(src)) return out;
  for (const k of Object.keys(src)) {
    if (has(out, k) || BAD_KEYS.has(k) || src[k] === undefined) continue;
    try { out[k] = deepClone(src[k]); } catch (_) { /* valeur non clonable : ignorée */ }
  }
  return out;
}

/* ---------- prénom / nom du compagnon ---------- */
/* v11 : retire { } (jetons de template), trim, ≤ 14 caractères ; vide → fallback.
   En plus : caractères de contrôle retirés, pas d'emoji coupé en deux par la troncature. */
export function sanitizeName(v, fallback) {
  let s = String(v || '').replace(/[{}]/g, '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, NAME_MAX);
  if (/[\ud800-\udbff]$/.test(s)) s = s.slice(0, -1);
  s = s.trim();
  return s || fallback;
}

/* ---------- profil complet par défaut ---------- */
export function defaultProfile({ id = '', name, g = 'f', classe = null, today } = {}) {
  const d = toDay(today);
  const cl = normClasse(classe);
  return {
    id: typeof id === 'string' ? id : String(id ?? ''),
    name: sanitizeName(name, DEFAULT_HERO),
    g: normG(g),
    classe: cl,
    classeSince: cl ? d : '',
    created: d,
    companion: {
      type: 'pony', name: DEFAULT_MOUNT_NAME, owned: ['pony'],
      equip: { owned: [], worn: [] },
      /* last = 0 : pas encore de référence de décroissance (comme `pet.last || now` en v11) */
      pet: { faim: PET.START, forme: PET.START, joie: PET.START, last: 0, brushLast: 0, walkDay: '' },
      stage: 1,
      minutes: 0
    },
    wallet: { apples: 0, stars: {} },
    streak: { count: 0, last: '', freezes: 1, freezeWeek: '' },
    skills: {},
    evals: [],
    snapshots: [],
    leitner: {},
    history: [],
    mclm: [],
    today: null,
    legacy: null,
    settings: { ...DEFAULT_SETTINGS },
    stats: { minutes: 0, sessions: 0, items: 0 },
    medals: {}
  };
}

function normClasse(v) {
  const up = typeof v === 'string' ? v.trim().toUpperCase() : '';
  return CLASSES.includes(up) ? up : null;
}
const normG = g => (typeof g === 'string' && g.trim().toLowerCase() === 'm' ? 'm' : 'f');

/* ---------- normalisation (idempotente : normaliser deux fois ne change plus rien) ---------- */
export function normalizeProfile(p, today) {
  const d = toDay(today);
  const src = isObj(p) ? p : {};
  const classe = normClasse(src.classe);
  const out = {
    id: typeof src.id === 'string' ? src.id : '',
    name: sanitizeName(src.name, DEFAULT_HERO),
    g: normG(src.g),
    classe,
    classeSince: classe && isDay(src.classeSince) ? src.classeSince : '',
    created: isDay(src.created) ? src.created : d,
    companion: normCompanion(src.companion),
    wallet: normWallet(src.wallet),
    streak: normStreak(src.streak),
    skills: normSkills(src.skills),
    evals: normEvals(src.evals),
    snapshots: normSnapshots(src.snapshots),
    leitner: normLeitner(src.leitner, d),
    history: normHistory(src.history),
    mclm: normMclm(src.mclm),
    today: normPlan(src.today),
    legacy: normLegacy(src.legacy),
    settings: normSettings(src.settings),
    stats: normStats(src.stats)
  };
  if (has(src, 'trophies')) out.trophies = normTrophies(src.trophies);   /* facultatif (v2.1, « En famille ») */
  if (has(src, 'seen')) out.seen = normSeen(src.seen);                   /* facultatif (v2.2.1, « déjà vu ») */
  /* médailles gagnées (v2.1) : jamais retirées ; un profil d'avant la 2.1 (champ absent) garde celles que la v2.0
     lui montrait (legacyMedals), même si la nouvelle règle ne les donnerait plus (CDC §1 : aucune perte) */
  out.medals = has(src, 'medals') ? normMedals(src.medals) : legacyMedals(out);
  return withExtras(out, src);
}

/* ---------- « déjà vu » (v2.2.1) ----------
   profile.seen = { tour: true, games: { <id de jeu>: true } } : la visite guidée de l'accueil et la phrase du compagnon à
   la 1re partie de chaque jeu ne viennent qu'UNE fois par enfant. Champ facultatif : absent = rien vu (les profils
   d'avant la 2.2.1 voient la visite une fois, l'accueil ayant changé en 2.2 ; la phrase d'un jeu déjà joué, elle,
   n'est pas montrée : game-shell.js, playedBefore). Clés : 'tour' | 'game:<id>'.
   again (facultatif) = true : un parent a demandé « Revoir la visite guidée » ; les phrases des jeux reviennent alors
   aussi pour les jeux déjà joués. */
const SEEN_ID_RE = /^[a-z][a-z0-9_-]{0,23}$/;
function normSeen(v) {
  const s = isObj(v) ? v : {};
  const games = {};
  if (isObj(s.games)) for (const [k, x] of Object.entries(s.games)) if (SEEN_ID_RE.test(k) && x === true) games[k] = true;
  const out = { tour: s.tour === true, games };
  if (has(s, 'again')) out.again = s.again === true;
  return withExtras(out, s);
}
export function hasSeen(p, key) {
  const s = isObj(p) && isObj(p.seen) ? p.seen : null;
  if (!s) return false;
  const k = String(key || '');
  if (k === 'tour') return s.tour === true;
  const m = /^game:(.+)$/.exec(k);
  return !!(m && isObj(s.games) && s.games[m[1]] === true);
}
/* à appeler dans store.mutateProfile ; on = false oublie (« Revoir la visite guidée ») */
export function markSeen(p, key, on = true) {
  if (!isObj(p)) return p;
  const s = p.seen = normSeen(p.seen);
  const k = String(key || '');
  if (k === 'tour') { s.tour = !!on; return p; }
  const m = /^game:(.+)$/.exec(k);
  if (m && SEEN_ID_RE.test(m[1])) { if (on) s.games[m[1]] = true; else delete s.games[m[1]]; }
  return p;
}

/* ---------- médailles (Mes progrès) ----------
   profile.medals = { 'ma.faits': 'or', … } : la meilleure médaille déjà montrée par axe, jamais retirée.
   Depuis la v2.1, une nouvelle médaille ne vient que d'une compétence réellement jouée (js/ui/progres.js,
   earnedMedals) ; legacyMedals rejoue la règle de la v2.0 (badgeOf sur la valeur actuelle de chaque axe du radar
   de la classe, fiche comprise) pour les profils qui l'ont connue, à leur première normalisation en 2.1. */
export const MEDAL_TIERS = Object.freeze(['bronze', 'argent', 'or']);
export function legacyMedals(p) {
  const out = {};
  if (!isObj(p)) return out;
  const classe = p.classe || 'CM2';
  for (const subject of ['fr', 'ma']) {
    let tpl = null, values = null;
    try { tpl = radarTemplate(classe, subject); values = currentValues(p, tpl); } catch (_) { continue; }
    for (const a of (tpl && tpl.axes) || []) {
      if (has(out, a.id)) continue;
      const tier = badgeOf(values[a.id]);
      if (tier) out[a.id] = tier;
    }
  }
  return out;
}
function normMedals(m) {
  const out = {};
  if (!isObj(m)) return out;
  for (const [id, tier] of Object.entries(m)) {
    if (typeof id === 'string' && id && !BAD_KEYS.has(id) && MEDAL_TIERS.includes(tier)) out[id] = tier;
  }
  return out;
}

const gauge = v => clamp(num(v, PET.START), PET.FLOOR, PET.MAX);

/* worn : un seul objet par emplacement — on garde le dernier porté (la v11 l'ajoute en fin de liste) */
function oneBySlot(ids) {
  const seen = new Set(), keep = [];
  for (let i = ids.length - 1; i >= 0; i--) {
    const it = SHOP_BY_ID.get(ids[i]);
    if (!it || seen.has(it.slot)) continue;
    seen.add(it.slot);
    keep.unshift(ids[i]);
  }
  return keep;
}

function normCompanion(c) {
  c = isObj(c) ? c : {};
  const type = has(MOUNTS, c.type) ? c.type : 'pony';
  const owned = uniq((Array.isArray(c.owned) ? c.owned : []).filter(t => typeof t === 'string' && has(MOUNTS, t)));
  if (!owned.includes('pony')) owned.unshift('pony');
  if (!owned.includes(type)) owned.push(type);
  const e = isObj(c.equip) ? c.equip : {};
  const eqOwned = uniq((Array.isArray(e.owned) ? e.owned : []).filter(id => SHOP_BY_ID.has(id)));
  const worn = oneBySlot((Array.isArray(e.worn) ? e.worn : []).filter(id => eqOwned.includes(id)));
  const pet = isObj(c.pet) ? c.pet : {};
  return withExtras({
    type,
    name: sanitizeName(c.name, DEFAULT_MOUNT_NAME),
    owned,
    equip: withExtras({ owned: eqOwned, worn }, e),
    pet: withExtras({
      faim: gauge(pet.faim), forme: gauge(pet.forme), joie: gauge(pet.joie),
      last: Math.max(0, num(pet.last, 0)),
      brushLast: Math.max(0, num(pet.brushLast, 0)),
      walkDay: isDay(pet.walkDay) ? pet.walkDay : ''
    }, pet),
    stage: clamp(int(c.stage, 1), 1, 3),
    minutes: Math.max(0, num(c.minutes, 0))
  }, c);
}

function normWallet(w) {
  w = isObj(w) ? w : {};
  const stars = {};
  if (isObj(w.stars)) {
    for (const [k, v] of Object.entries(w.stars)) {
      if (!k || BAD_KEYS.has(k)) continue;
      stars[k] = clamp(int(v, 0), 0, 3);        /* ids d'histoires conservés tels quels */
    }
  }
  return withExtras({ apples: Math.max(0, int(w.apples, 0)), stars }, w);
}

function normStreak(s) {
  s = isObj(s) ? s : {};
  return withExtras({
    count: Math.max(0, int(s.count, 0)),
    last: isDay(s.last) ? s.last : '',
    freezes: clamp(int(s.freezes, 1), 0, CAPS.freezes),
    freezeWeek: typeof s.freezeWeek === 'string' && WEEK_RE.test(s.freezeWeek) ? s.freezeWeek : ''
  }, s);
}

/* θ illisible → axe retiré (il redevient « non observé », valeur par défaut du moteur adaptatif) */
function normSkills(sk) {
  const out = {};
  if (!isObj(sk)) return out;
  for (const [k, v] of Object.entries(sk)) {
    if (!AXIS_RE.test(k) || !isObj(v)) continue;
    const t = num(v.t, NaN);
    if (!Number.isFinite(t)) continue;
    out[k] = withExtras({
      t: clamp(t, 0, 3),
      n: Math.max(0, int(v.n, 0)),
      last: isDay(v.last) ? v.last : '',
      trend: clamp(num(v.trend, 0), -3, 3),
      src: typeof v.src === 'string' && v.src ? v.src : 'defaut'
    }, v);
  }
  return out;
}

/* { axe: θ } : valeurs finies bornées 0-3 (allowNull : null = absence à l'évaluation) */
function thetaMap(m, allowNull) {
  const out = {};
  if (!isObj(m)) return out;
  for (const [k, v] of Object.entries(m)) {
    if (!AXIS_RE.test(k)) continue;
    if (v === null) { if (allowNull) out[k] = null; continue; }
    const n = num(v, NaN);
    if (Number.isFinite(n)) out[k] = clamp(n, 0, 3);
  }
  return out;
}

function normEvals(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(isObj).map(e => withExtras({
    src: typeof e.src === 'string' && e.src ? e.src : 'reperes',
    date: typeof e.date === 'string' ? e.date : '',
    classe: normClasse(e.classe),
    fr: thetaMap(e.fr, true),
    ma: thetaMap(e.ma, true),
    added: isDay(e.added) ? e.added : '',
    precision: typeof e.precision === 'string' ? e.precision : ''
  }, e));
}

function normSnapshots(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(x => isObj(x) && typeof x.w === 'string' && x.w)
    .slice(-CAPS.snapshots)
    .map(x => withExtras({ w: x.w, d: isDay(x.d) ? x.d : '', s: thetaMap(x.s, false) }, x));
}

/* échéance illisible → aujourd'hui (la clé redevient due) */
function normLeitner(obj, d) {
  const out = {};
  if (!isObj(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (!k || BAD_KEYS.has(k) || !isObj(v)) continue;
    out[k] = withExtras({
      b: clamp(int(v.b, 1), 1, 5),
      due: isDay(v.due) ? v.due : d,
      seen: Math.max(0, int(v.seen, 0)),
      ok: Math.max(0, int(v.ok, 0)),
      last: isDay(v.last) ? v.last : ''
    }, v);
  }
  return out;
}

/* historique : on garde les 500 dernières manches ; th (θ après la manche) borné ou retiré */
function normHistory(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(isObj).slice(-CAPS.history).map(e => {
    const o = deepClone(e);
    if (has(o, 'th')) {
      const th = num(o.th, NaN);
      if (Number.isFinite(th)) o.th = clamp(th, 0, 3); else delete o.th;
    }
    return o;
  });
}

/* MCLM : entrées sans valeur lisible retirées, 300 dernières conservées */
function normMclm(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(e => isObj(e) && Number.isFinite(num(e.v, NaN)))
    .slice(-CAPS.mclm)
    .map(e => ({ ...deepClone(e), v: Math.max(0, num(e.v, 0)) }));
}

/* plan de la balade du jour (structure gérée par session.js) : conservé s'il est lisible */
function normPlan(t) {
  return isObj(t) && typeof t.d === 'string' && Array.isArray(t.blocks) ? deepClone(t) : null;
}

function normLegacy(l) {
  if (!isObj(l)) return null;
  const m = num(l.mclm, NaN);
  return withExtras({
    from: typeof l.from === 'string' ? l.from : '',
    mclm: Number.isFinite(m) && m > 0 ? m : null,
    stars: Math.max(0, int(l.stars, 0))
  }, l);
}

function normReadAloud(v) {
  return v === 'off' || v === false ? 'off' : DEFAULT_SETTINGS.readAloud;
}
function normSettings(s) {
  s = isObj(s) ? s : {};
  const m = num(s.sessionMin, NaN);
  return withExtras({
    sessionMin: SESSION_MINUTES.includes(m) ? m : DEFAULT_SETTINGS.sessionMin,
    timers: typeof s.timers === 'boolean' ? s.timers : DEFAULT_SETTINGS.timers,
    sound: typeof s.sound === 'boolean' ? s.sound : DEFAULT_SETTINGS.sound,
    motion: s.motion === 'soft' ? 'soft' : 'full',
    theme: normalizeTheme(s.theme),
    readAloud: normReadAloud(s.readAloud)
  }, s);
}

function normStats(s) {
  s = isObj(s) ? s : {};
  const out = {
    minutes: Math.max(0, num(s.minutes, 0)),
    sessions: Math.max(0, int(s.sessions, 0)),
    items: Math.max(0, int(s.items, 0))
  };
  /* compteur de la semaine (economy.bumpWeek) : facultatif ; semaine illisible → retiré (il repartira de zéro) */
  const { week, ...rest } = s;
  if (isObj(week) && typeof week.w === 'string' && WEEK_RE.test(week.w)) {
    out.week = withExtras({
      w: week.w,
      minutes: Math.max(0, num(week.minutes, 0)),
      apples: Math.max(0, int(week.apples, 0)),
      items: Math.max(0, int(week.items, 0))
    }, week);
  }
  return withExtras(out, rest);
}

/* trophées (economy.addTrophy) : { k, d, w, … } lisibles seulement ; on garde les plus récents */
const TROPHIES_CAP = 300;
function normTrophies(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(t => isObj(t) && typeof t.k === 'string' && t.k && isDay(t.d))
    .slice(-TROPHIES_CAP)
    .map(t => {
      const o = deepClone(t);
      if (typeof o.w !== 'string' || !WEEK_RE.test(o.w)) delete o.w;
      return o;
    });
}

/* ---------- templating héros / monture (dictionnaire v11 EXACT) ----------
   Jetons : {P} héros · {N} compagnon · {leM}/{LeM}/{sonM}/{SonM}/{duM} · {ilM}/{IlM}
   {El}/{el}/{fiere} (genre du héros) · {contentM}{surprisM}{legerM}{rassureM}{fascineM} (genre de la monture)
   v2 : {ils}{Ils}{eux}{tousD}{assisD}{premiersD}{herosD} (duo héros + monture) · {pleinM}{toutM}{douxM} (monture) */
export function tplMap(profile) {
  const p = isObj(profile) ? profile : {};
  const c = isObj(p.companion) ? p.companion : {};
  const m = has(MOUNTS, c.type) ? MOUNTS[c.type] : MOUNTS.pony;
  const mf = m.g === 'f';                                  /* genre de la monture (licorne = féminin) */
  const hf = (p.g === undefined ? 'f' : p.g) === 'f';      /* genre du héros */
  const le = mf ? 'la' : 'le', son = mf ? 'sa' : 'son', du = mf ? 'de la' : 'du';
  const df = hf && mf;                                     /* duo entièrement féminin */
  return {
    P: typeof p.name === 'string' ? p.name : DEFAULT_HERO,
    N: typeof c.name === 'string' ? c.name : DEFAULT_MOUNT_NAME,
    El: hf ? 'Elle' : 'Il', el: hf ? 'elle' : 'il', fiere: hf ? 'fière' : 'fier',
    leM: le + ' ' + m.noun,  LeM: capFirst(le) + ' ' + m.noun,
    sonM: son + ' ' + m.noun, SonM: capFirst(son) + ' ' + m.noun,
    duM: du + ' ' + m.noun,
    IlM: mf ? 'Elle' : 'Il', ilM: mf ? 'elle' : 'il',
    contentM: mf ? 'contente' : 'content',
    surprisM: mf ? 'surprise' : 'surpris',
    legerM:   mf ? 'légère'   : 'léger',
    rassureM: mf ? 'rassurée' : 'rassuré',
    fascineM: mf ? 'fascinée' : 'fasciné',
    /* v2 : accords du DUO héros + monture (féminin seulement si les deux le sont : une fille et sa licorne)… */
    ils: df ? 'elles' : 'ils', Ils: df ? 'Elles' : 'Ils', eux: df ? 'elles' : 'eux',
    tousD: df ? 'toutes' : 'tous', assisD: df ? 'assises' : 'assis',
    premiersD: df ? 'premières' : 'premiers', herosD: df ? 'héroïnes' : 'héros',
    /* …et de la monture seule */
    pleinM: mf ? 'pleine' : 'plein', toutM: mf ? 'toute' : 'tout', douxM: mf ? 'douce' : 'doux'
  };
}
/* remplace {jeton} via tplMap ; jeton inconnu laissé tel quel */
export function fillTemplate(str, profile) {
  const map = tplMap(profile);
  return String(str ?? '').replace(/\{(\w+)\}/g, (all, k) => (has(map, k) ? map[k] : all));
}

/* ---------- classe ---------- */
/* fluence déjà observée ? (lecture en v2, évaluation importée…) ; l'estimation v11 seule ne compte pas */
function fluenceObserved(p) {
  if (Array.isArray(p.mclm) && p.mclm.length) return true;
  const sk = isObj(p.skills) ? p.skills['fr.fluence'] : null;
  if (!isObj(sk)) return false;
  const n = num(sk.n, 0);
  return sk.src === 'v11' ? n > 1 : n > 0;
}

/* choisit la classe (mutation en place, renvoie le profil).
   Si une estimation de fluence v11 attend la classe (legacy.mclm) et qu'aucune lecture n'a encore été
   observée → θ initial de fr.fluence (n = 1, src 'v11'). Recalculé si la classe est corrigée ensuite. */
export function setClasse(profile, classe, today) {
  const cl = normClasse(classe);
  if (!isObj(profile) || !cl) return profile;
  const d = toDay(today);
  const changed = profile.classe !== cl;
  profile.classe = cl;
  if (changed || !isDay(profile.classeSince)) profile.classeSince = d;
  if (changed) profile.today = null;          /* plan de balade calculé pour l'ancienne classe */
  const mclm = isObj(profile.legacy) ? num(profile.legacy.mclm, NaN) : NaN;
  if (Number.isFinite(mclm) && mclm > 0 && !fluenceObserved(profile)) {
    if (!isObj(profile.skills)) profile.skills = {};
    profile.skills['fr.fluence'] = { t: thetaFromMclm(mclm, cl, d), n: 1, last: '', trend: 0, src: 'v11' };
  }
  return profile;
}

/* classe suivante ; CM2 (ou inconnue) → null */
export function nextClasse(classe) {
  const i = CLASSES.indexOf(classe);
  return i >= 0 && i < CLASSES.length - 1 ? CLASSES[i + 1] : null;
}

/* bouton « Je passe en … ! » : du 1er juillet au 30 septembre, si la classe a été choisie
   avant le 1er juillet de l'année en cours (sinon elle vient d'être choisie pour la rentrée) */
export function offerNextClasse(profile, today) {
  if (!isObj(profile)) return null;
  const next = nextClasse(profile.classe);
  if (!next) return null;
  const d = toDay(today);
  const month = Number(d.slice(5, 7));
  if (month < 7 || month > 9) return null;
  const since = isDay(profile.classeSince) ? profile.classeSince : '';
  return since < d.slice(0, 4) + '-07-01' ? next : null;
}

/* prochain id libre : 'p' + (plus grand numéro existant + 1) */
export function newProfileId(data) {
  const profiles = data && isObj(data.profiles) ? data.profiles : {};
  let max = 0;
  for (const k of Object.keys(profiles)) {
    const m = /^p(\d+)$/.exec(k);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return 'p' + (max + 1);
}
