/* ============ NOMBRES ↔ MOTS (français) ============
   Module pur (aucun accès au DOM) — importable dans Node pour les tests.

   toWords(n)      écriture avec les FORMES DU LEXIQUE VOSK (vosk-model-small-fr-pguyot-0.3 ; mêmes formes dans
                   vosk-model-small-fr-0.22, le modèle de la 2.2.4 : tests/lexicon.mjs),
                   mots séparés par des espaces : c'est ce que la reconnaissance peut renvoyer.
                   - de 0 à 99 : UN seul mot du lexique (« vingt-et-un », « soixante-et-onze »,
                     « quatre-vingts », « quatre-vingt-un », « quatre-vingt-dix-sept ») ;
                   - au-delà : mots séparés (« deux cent quarante-cinq », « deux cents », « mille un »,
                     « quatre-vingt mille », « deux millions ») car le lexique n'a pas de forme soudée
                     régulière (« deux-cents » existe mais ni « trois-cent », ni « cent-un », ni « cent-mille »).
   spell(n)        orthographe rectifiée de 1990 (référence des programmes) pour l'AFFICHAGE :
                   traits d'union partout (« deux-cent-quarante-cinq »), sauf autour de million/milliard (noms).
   grammarFor(max) liste minimale des mots du lexique permettant de dire tout nombre de 0 à max
                   (grammaire Vosk ; le moteur vocal ajoute lui-même '[unk]').
   parseSpoken(t)  DERNIER nombre complet énoncé dans un texte reconnu (chiffres ou mots, traits d'union
                   ou espaces, « et », cent(s), mille, septante/huitante/octante/nonante), ou null. */

export const MAX = 999999999999;            /* 999 milliards… : bien au-delà du CM2 */

const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
const TEENS = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

/* 0 ≤ n ≤ 99 → un seul mot du lexique ; plural : « quatre-vingts » (fin de nombre) ou « quatre-vingt » (devant mille) */
function below100(n, plural = true) {
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 70) {
    const t = Math.floor(n / 10), u = n % 10;
    return TENS[t] + (u === 0 ? '' : u === 1 ? '-et-un' : '-' + UNITS[u]);
  }
  if (n < 80) return n === 71 ? 'soixante-et-onze' : 'soixante-' + TEENS[n - 70];
  if (n === 80) return plural ? 'quatre-vingts' : 'quatre-vingt';
  return 'quatre-vingt-' + (n < 90 ? UNITS[n - 80] : TEENS[n - 90]);
}

/* groupe de 1 à 999 → liste de mots.
   « cent » et « vingt » prennent un s quand ils sont multipliés et terminent le nombre, ou devant
   « millions » / « milliards » (des noms) ; jamais devant « mille » (adjectif numéral invariable). */
function group(n, plural) {
  const h = Math.floor(n / 100), r = n % 100, w = [];
  if (h) {
    if (h > 1) w.push(UNITS[h]);
    w.push(h > 1 && r === 0 && plural ? 'cents' : 'cent');
  }
  if (r) w.push(below100(r, plural));
  return w;
}

function check(n) {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 0 || v > MAX) throw new RangeError('Nombre hors limites (entier de 0 à ' + MAX + ') : ' + n);
  return v;
}

/* découpe en tranches (milliards, millions, milliers, unités) → [{ v, big }] (big : 1e9, 1e6, 1e3, 1) */
function slices(n) {
  return [
    { v: Math.floor(n / 1e9), big: 1e9 },
    { v: Math.floor(n / 1e6) % 1000, big: 1e6 },
    { v: Math.floor(n / 1e3) % 1000, big: 1e3 },
    { v: n % 1000, big: 1 }
  ].filter(s => s.v > 0);
}

/* 245 → 'deux cent quarante-cinq' ; 80 → 'quatre-vingts' ; 2000 → 'deux mille' */
export function toWords(n) {
  n = check(n);
  if (n === 0) return 'zéro';
  const out = [];
  for (const { v, big } of slices(n)) {
    if (big === 1e3) { if (v > 1) out.push(...group(v, false)); out.push('mille'); }
    else {
      out.push(...group(v, true));
      if (big === 1e6) out.push(v > 1 ? 'millions' : 'million');
      if (big === 1e9) out.push(v > 1 ? 'milliards' : 'milliard');
    }
  }
  return out.join(' ');
}

/* orthographe rectifiée (1990) : 245 → 'deux-cent-quarante-cinq' ; 2 500 000 → 'deux millions cinq-cent-mille' */
export function spell(n) {
  n = check(n);
  if (n === 0) return 'zéro';
  const parts = [];
  let pending = [];              /* numéraux à souder par des traits d'union (jusqu'au prochain nom) */
  const flush = () => { if (pending.length) parts.push(pending.join('-')); pending = []; };
  for (const { v, big } of slices(n)) {
    if (big === 1e3) { if (v > 1) pending.push(...group(v, false)); pending.push('mille'); }
    else if (big === 1) pending.push(...group(v, true));
    else {
      pending.push(...group(v, true));
      flush();
      parts.push(big === 1e6 ? (v > 1 ? 'millions' : 'million') : (v > 1 ? 'milliards' : 'milliard'));
    }
  }
  flush();
  return parts.join(' ');
}

/* Mots nécessaires à partir de quel nombre (le premier qui les emploie) : grammaire minimale.
   0-99 : un mot chacun ; puis les mots de structure. Vérifié par force brute dans les tests. */
const STRUCTURE = [
  ['cent', 100], ['cents', 200], ['mille', 1000], ['quatre-vingt', 80000],
  ['million', 1e6], ['millions', 2e6], ['milliard', 1e9], ['milliards', 2e9]
];
export function grammarFor(max = 100) {
  const m = Math.max(0, Math.min(MAX, Math.floor(Number(max) || 0)));
  const out = [];
  for (let n = 0; n <= Math.min(m, 99); n++) out.push(below100(n));
  for (const [w, first] of STRUCTURE) if (m >= first) out.push(w);
  return out;
}

/* ---------- Analyse d'un texte reconnu ---------- */

/* jetons : k = 'num' (chiffres) | 'zero' | 'unit' | 'teen' | 'tens' | 'cent' | 'big' | 'et' ; w = forme canonique */
const LEX = new Map();
const def = (k, v, w, ...forms) => forms.forEach(f => LEX.set(f, { k, v, w }));
def('zero', 0, 'zero', 'zero');
['un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'].forEach((u, i) => def('unit', i + 1, u, u));
def('unit', 1, 'un', 'une');
['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'].forEach((t, i) => def('teen', 10 + i, t, t));
def('tens', 20, 'vingt', 'vingt', 'vingts');
[['trente', 30], ['quarante', 40], ['cinquante', 50], ['soixante', 60], ['septante', 70], ['nonante', 90]]
  .forEach(([w, v]) => def('tens', v, w, w));
def('tens', 80, 'huitante', 'huitante', 'octante');
def('cent', 100, 'cent', 'cent', 'cents');
def('big', 1e3, 'mille', 'mille', 'milles', 'mil');
def('big', 1e6, 'million', 'million', 'millions');
def('big', 1e9, 'milliard', 'milliard', 'milliards');
def('et', 0, 'et', 'et');

/* toutes les façons de dire 1…99 (canoniques et tolérées) → valeur */
const U = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
const UNDER100 = new Map();
const put = (words, v) => { const k = words.join(' '); if (!UNDER100.has(k)) UNDER100.set(k, v); };
const teenForms = v => (v <= 16 ? [[['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'][v - 10]]] : [['dix', U[v - 10]]]);
for (let u = 1; u <= 9; u++) put([U[u]], u);
for (let v = 10; v <= 19; v++) teenForms(v).forEach(f => put(f, v));
for (const [w, t] of [['vingt', 20], ['trente', 30], ['quarante', 40], ['cinquante', 50], ['soixante', 60],
  ['septante', 70], ['huitante', 80], ['nonante', 90]]) {
  put([w], t);
  put([w, 'et', 'un'], t + 1);
  put([w, 'un'], t + 1);                                   /* « vingt un » (le « et » avalé) */
  for (let u = 2; u <= 9; u++) put([w, U[u]], t + u);
}
for (let v = 10; v <= 19; v++) teenForms(v).forEach(f => put(['soixante', ...f], 60 + v));
put(['soixante', 'et', 'onze'], 71);
put(['quatre', 'vingt'], 80);
for (let u = 1; u <= 9; u++) put(['quatre', 'vingt', U[u]], 80 + u);
put(['quatre', 'vingt', 'et', 'un'], 81);
for (let v = 10; v <= 19; v++) teenForms(v).forEach(f => put(['quatre', 'vingt', ...f], 80 + v));
put(['quatre', 'vingt', 'et', 'onze'], 91);

const SEP = { k: 'sep' };

function tokenize(text) {
  let s = String(text ?? '').toLowerCase();
  /* groupes de milliers à la française : « 1 000 », « 12 345 678 » (espace, insécable ou fine insécable) */
  s = s.replace(/(^|[^\d])(\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?!\d)/g, (_, p, g) => p + g.replace(/\D/g, ''));
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const out = [];
  for (const m of s.matchAll(/\d+(?:[.,]\d+)?|[a-z]+/g)) {
    const w = m[0];
    if (w.charCodeAt(0) <= 57) out.push({ k: 'num', v: Number(w.replace(',', '.')) });
    else out.push(LEX.get(w) || SEP);
  }
  return out;
}

const under100 = t => {
  const v = UNDER100.get(t.map(x => x.w).join(' '));
  return v === undefined ? null : v;
};
/* tolère un « et » d'ouverture après cent / mille (« cent et un », « mille et une ») */
const dropEt = t => (t.length > 1 && t[0].k === 'et' ? t.slice(1) : t);

/* groupe < 1000 qui couvre EXACTEMENT les jetons t, ou null */
function under1000(t) {
  const c = t.findIndex(x => x.k === 'cent');
  if (c < 0) return under100(t);
  let h;
  if (c === 0) h = 1;
  else if (c === 1 && t[0].k === 'unit') h = t[0].v;     /* « deux cent » ; « un cent » toléré */
  else return null;
  const rest = dropEt(t.slice(c + 1));
  if (!rest.length) return h * 100;
  const r = under100(rest);
  return r === null ? null : h * 100 + r;
}

/* nombre complet qui couvre EXACTEMENT les jetons t, ou null */
function exact(t) {
  if (!t.length || t[0].k === 'et' || t[t.length - 1].k === 'et') return null;
  if (t.length === 1 && t[0].k === 'zero') return 0;
  if (t.some(x => x.k === 'zero')) return null;
  if (t[0].k === 'num') {
    if (t.length === 1) return t[0].v;
    if (t.length === 2 && t[1].k === 'big') return t[0].v * t[1].v;   /* « 2 millions » */
    return null;
  }
  if (t.some(x => x.k === 'num')) return null;
  let total = 0, last = Infinity, start = 0;
  for (let k = 0; k <= t.length; k++) {
    if (k < t.length && t[k].k !== 'big') continue;
    const seg = start > 0 ? dropEt(t.slice(start, k)) : t.slice(start, k);
    if (k === t.length) {
      if (seg.length) {
        const v = under1000(seg);
        if (v === null) return null;
        total += v;
      }
      break;
    }
    const big = t[k].v;
    if (big >= last) return null;                          /* ordre décroissant : pas de « mille mille » */
    let mult = 1;                                           /* « mille » seul ; « million » toléré seul */
    if (seg.length) {
      mult = under1000(seg);
      if (!mult) return null;
    }
    total += mult * big;
    last = big;
    start = k + 1;
  }
  return total;
}

/* « sept fois huit, euh… cinquante-six » → 56 ; « quarante-huit… non, cinquante-six » → 56 ; rien → null */
export function parseSpoken(text) {
  const toks = tokenize(text);
  /* suites de jetons numériques (les mots parasites séparent) */
  const runs = [];
  let cur = [];
  for (const t of toks) {
    if (t.k === 'sep') { if (cur.length) runs.push(cur); cur = []; }
    else cur.push(t);
  }
  if (cur.length) runs.push(cur);
  for (let r = runs.length - 1; r >= 0; r--) {
    let run = runs[r];
    while (run.length && run[0].k === 'et') run = run.slice(1);
    while (run.length && run[run.length - 1].k === 'et') run = run.slice(0, -1);
    if (!run.length) continue;
    /* le plus long suffixe qui forme un nombre valide = le dernier nombre complet */
    for (let i = Math.max(0, run.length - 40); i < run.length; i++) {
      const v = exact(run.slice(i));
      if (v !== null) return v;
    }
  }
  return null;
}
