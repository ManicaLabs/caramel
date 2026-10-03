/* ============ OPÉRATIONS POSÉES — axe 'ma.operations' · jeu « L’Atelier des opérations » ============
   Module pur (aucun DOM). Contrat : docs/ARCHITECTURE.md §6 ; mise en scène : docs/JEUX.md §7.
   gen(A, rng, opts) → item, déterministe pour (A, graine, opts), pour tout A ∈ [0 ; 5,6] (core/levels.js).
   fromKey(key, A, rng) → l'item de même clé (même opération, même méthode).
   Un item = UNE opération posée, guidée colonne par colonne. Le générateur fournit la grille FINALE (les cases à
   découvrir sont marquées hidden) et la suite des étapes : l'interface ne calcule rien, elle joue les étapes.

   ---------- SOURCES ----------
   Programme du cycle 2, BO n°41 du 31/10/2024 : addition posée au CP en P4-P5 (45 + 37 ; 28 + 8 + 56) ; CE1 : 2 ou 3
   nombres de 1 à 3 chiffres (76 + 7 + 568), soustraction posée au plus tard en P3, « par cassage » ou « par
   compensation », un seul algorithme par école du CE1 au CM2 ; CE2 : + et − jusqu'à 10 000, montants en euros au plus
   tard en P2 (4,56 € + 15,30 €) et en P4 (74,36 € − 12,50 €), multiplication posée au plus tard en P4 (2-3 chiffres ×
   1-2 chiffres, le nombre qui a le moins de chiffres en 2e ligne ; règle des 0 préférée au décalage, fiche Repères
   début CM1). Programme du cycle 3, BO n°16 du 17/04/2025 et Exemples de réussite : CM1 décimaux en colonnes
   (56,75 + 234 + 0,8 ; 34,5 − 2,58), 876 × 208, décimal × entier < 10 (7 × 46,55 €), division euclidienne par un
   nombre à 1 chiffre, dividende jusqu'à 5 chiffres (9 456 ÷ 7) ; CM2 décimal × entier (8,76 × 208), division décimale
   par un nombre à 1 chiffre arrêtée au plus tard au centième avec un reste nul (785 ÷ 4 ; 148,2 ÷ 5 ; 9 855 ÷ 6 ;
   7 854 ÷ 8 ; 986,3 ÷ 5) ; diviseur à 2 chiffres = 6e (jamais ici). Éduscol « Le calcul aux cycles 2 et 3 » (2016) et
   fiche d'intervention 2026 : soustractions intermédiaires écrites dans la potence, encadrement préalable du nombre de
   chiffres du quotient, « unités sous les unités ». Synthèse : rapports de recherche du 02/10/2026, maths-c2 §2.6,
   §3.6, §4.6, §5, §10 ; maths-c3 §5, §8.

   ---------- PALIERS (A → opérations nouvelles ; les précédentes restent, sur le champ numérique de l'année) ----------
   Champ : CP ≤ 20 (P1), ≤ 59 (P2), ≤ 100 · CE1 ≤ 1 000 · CE2 et CM1 P1-P2 ≤ 9 999 · CM1 P3 → CM2 P2 ≤ 999 999 ·
   ensuite ≤ 999 999 999 (jamais le milliard).
   | A          | opération posée (niveau d'arrivée)                                                           |
   |------------|----------------------------------------------------------------------------------------------|
   | 0 – 1      | CP : 2 chiffres + 1 chiffre sans retenue (0) ; 2 chiffres + 2 chiffres sans retenue (0,3) ;   |
   |            |   avec retenue, somme ≤ 100 : 45 + 37 (0,6)                                                  |
   | 1 – 2      | CE1 : 2 nombres de 2-3 chiffres sans retenue (1), avec retenues (1,2) ; 3 nombres de 1 à 3     |
   |            |   chiffres 76 + 7 + 568 (1,3) ; soustraction : 2 chiffres sans retenue (1,5), 3 chiffres sans  |
   |            |   retenue (1,6), avec retenue (1,7), avec un 0 à traverser 503 − 47 (1,85)                    |
   | 2 – 3      | CE2 : + et − jusqu'à 9 999 (2 ; 3 termes ou 0 à traverser 2,1) ; euros 4,56 € + 15,30 € (2,4), |
   |            |   74,36 € − 12,50 € (2,7) ; multiplication : 2 chiffres × 1 (2,6), 3 chiffres × 1 (2,7),      |
   |            |   2 chiffres × 2 (2,8), 3 chiffres × 2 (2,9), produit ≤ 9 999                                |
   | 3 – 4      | CM1 : 4 chiffres × 1 (3) ; division euclidienne, dividende de 3 chiffres (3,2), 4 (3,5),        |
   |            |   5 (3,8) ; décimaux en colonnes avec zéros utiles en pâle 56,75 + 234 + 0,8, 34,5 − 2,58 (3,3) ;|
   |            |   décimal × entier < 10 : 7 × 46,55 € (3,3) ; 876 × 208 et nombres ≤ 999 999 (3,4)            |
   | 4 – 5      | CM2 : décimal × entier 8,76 × 208 (4) ; division décimale : quotient à 1 décimale 9 855 ÷ 6   |
   |            |   (4), à 2 décimales 785 ÷ 4 (4,2), dividende décimal 148,2 ÷ 5 ou de 5 chiffres (4,3) ;      |
   |            |   millièmes en + et − (4)                                                                    |
   | 5 – 5,6    | Plus long, toujours au programme du CM2 : 3 termes décimaux, 4 chiffres × 3 chiffres (entier  |
   |            |   ou décimal), divisions de 5 chiffres (jamais de diviseur à 2 chiffres)                     |
   Tirage de l'opération : + seule avant 1,5 ; puis + et − ; × dès 2,6 ; ÷ euclidienne dès 3,2 ; ÷ décimale dès 4.

   ---------- ITEM ----------
   { axis: 'ma.operations', kind, key, A, prompt, answer, hint, explain, leitner: false, data }
   kind    'add' | 'sub' | 'mul' | 'div' (division euclidienne) | 'divdec' (division décimale, reste nul)
   prompt  '347 + 58', '76 + 7 + 568', '4,56 € + 15,30 €', '364 − 18', '16 × 548', '9 456 ÷ 7' (nombres fmtNum)
   answer  = data.result (chaîne : '405', '196,25', '19,90')
   key     'ma.operations:<kind>:<opérandes ASCII, dans l'ordre de l'énoncé>[:<méthode>][:euros]' — exemples :
           'ma.operations:add:347+58', 'ma.operations:sub:364-18:cassage', 'ma.operations:mul:16x548',
           'ma.operations:add:4.56+15.30:euros', 'ma.operations:div:9456/7', 'ma.operations:divdec:785/4'
           (la méthode, 'compensation' ou 'cassage', n'existe que pour la soustraction et fait partie de la clé)
   hint    stratégie générale de l'opération ; explain : le résultat et sa vérification (« Vérifie : 405 − 58 = 347. »)
   item.A  niveau réel de l'opération (taille, retenues, zéros, décimaux), puis A demandé borné à [ce niveau ; + 0,6]
   opts    avoid (Set de clés), kind (imposé ; s'il n'existe pas encore, pris au premier niveau où il existe),
           subMethod : 'compensation' (défaut) | 'cassage' — réglage parent settings.subMethod, à transmettre par
           ctx.nextItem(null, { subMethod: ctx.settings.subMethod })

   ---------- data : CONTRAT AVEC L'INTERFACE (js/games/operations.js) ----------
   data = {
     op        '+' | '−' | '×' | '÷'
     operands  ['347', '58'] : chaînes, virgule décimale, sans espace, DANS L'ORDRE POSÉ (de haut en bas ; × : le
               nombre qui a le moins de chiffres en 2e ligne, l'entier en 2e ligne à égalité ; ÷ : [dividende, diviseur])
     method    'colonnes' (+) | 'compensation' | 'cassage' (−) | 'zeros' (×, règle des 0) | 'potence' (÷)
     result    '405' : résultat écrit (÷ : le quotient), virgule décimale ; remainder : reste ('6') de la division
               euclidienne, sinon null ; unit : '€' pour un montant (l'énoncé porte « € », la grille n'a que des chiffres)
     grid = { rows, cols, rowInfo, cells }
       colonne 0 à gauche, une case par chiffre, unités sous les unités (+ − : virgules alignées) ;
       rowInfo[r] = { role, small } : 'carry' (retenues) | 'mark' (marques de compensation ou de cassage) |
         'operand' | 'rule' (trait) | 'partial' (produit partiel) | 'result' | 'sub' et 'rest' (lignes de la potence) ;
         small = ligne d'annotations en petit (moins haute) ; une ligne sans aucune case visible peut être repliée
       cells[] = { r, c, ch, role, small, hidden, strike, pale?, pos?, zero?, from? } — état FINAL de la feuille :
         ch      un caractère : chiffre, signe (+ − ×), ',' ou trait ('─' horizontal, '│' vertical, '├' angle de la
                 potence) ; seule exception, la marque « +1 » de la compensation
         role    'operand' (nombres posés, dividende), 'sign' (+ − × devant une ligne ; − des soustractions de la
                 potence), 'rule', 'carry', 'partial', 'result', 'comma', 'quotient', 'divisor', 'sub' (produit à
                 soustraire dans la potence, à souligner), 'rest' (reste ou chiffre abaissé), 'mark'
         small   annotation écrite en petit (retenues, marques)
         hidden  case invisible au départ, dévoilée par EXACTEMENT une étape (step.cells) ; les autres sont visibles
         strike  barrée à la fin (cassage) : barrée par l'étape qui la cite dans step.strike
         pale    zéro utile écrit en pâle (34,5 → 34,50 ; 785 → 785,00 dans la potence) ou sa virgule
         pos     annotation collée au chiffre de même (r, c) : 'apres' = virgule en bas à droite du chiffre (la
                 virgule n'occupe pas de colonne) ; 'avant' = petit « 1 » en haut à gauche (le 4 devient 14).
                 Sans pos, (r, c) est unique
         zero    0 posé automatiquement par la règle des 0 (×)
         from    { r, c } : case d'origine d'un chiffre abaissé (÷), pour l'animer en glissant
     steps[] = { id, type, ask, expect, cells, focus, strike, prompt, hint, say } — à jouer dans l'ordre :
         type    'pad' (zéros utiles en pâle), 'digit' (chiffre d'un résultat ou d'un produit partiel, retenue finale
                 écrite à gauche), 'carry' (retenue qui apparaît), 'mark' (compensation : « 1 » devant le chiffre du
                 haut et « +1 » sous la colonne suivante ; cassage : chiffre(s) barré(s), nouveau chiffre au-dessus,
                 « 1 » devant), 'zero' (règle des 0), 'comma' (virgule du résultat, du quotient ou du dividende),
                 'count' (nombre de chiffres du quotient), 'quotient', 'product', 'rest', 'bring' (chiffre abaissé),
                 'info' (commentaire seul)
         ask     true : l'enfant tape UN chiffre ; expect = ce chiffre ('0'…'9') ; cells = la case où il s'écrit (une
                 seule ; aucune pour 'count', dont la réponse ne s'écrit pas dans la grille). false : étape automatique
                 (retenue, 0 de la règle des 0, chiffre abaissé, virgule, marques, zéros pâles, commentaire)
         cells   cases dévoilées par l'étape ; strike : cases barrées ; focus : cases à surligner (colonne courante,
                 chiffres en jeu). Une case est désignée par { r, c } (+ pos pour une annotation)
         prompt  question posée AVANT la réponse, sans la réponse (ask ; sinon null)
         hint    aide après une erreur, sans la réponse (ask ; sinon null)
         say     commentaire : après la réponse (ou le chiffre posé après la 2e erreur) pour ask ; pendant l'étape sinon
   }
   Jouer les étapes en écrivant expect dans chaque case donne exactement data.result (et data.remainder).
   Tailles (pour la mise en page) : + − × ≤ 10 colonnes ; potence ≤ 12 colonnes (euclidienne), ≤ 13 (décimale, ≤ 16
   au-delà de A = 5) et ≤ 15 lignes ; au plus 22 chiffres à taper (4 chiffres × 3 chiffres). Suggestions d'affichage :
   pâlir les retenues d'un produit partiel terminé ; souligner les cases 'sub' ; une case cachée visée par l'étape en
   cours se dessine en pointillés. */

import { fmtNum, frTypo } from '../../core/util.js';

export const axis = 'ma.operations';
export const KINDS = ['add', 'sub', 'mul', 'div', 'divdec'];
export const SUB_METHODS = ['compensation', 'cassage'];

const A_TOP = 5.6, TRIES = 30, SPAN = 0.6, SAMPLE_TRIES = 40;
const KIND_FROM = { add: 0, sub: 1.5, mul: 2.6, div: 3.2, divdec: 4 };
const OP_ASCII = { add: '+', sub: '-', mul: 'x', div: '/', divdec: '/' };
const NNBSP = '\u202f';

const clampA = A => { const a = Number(A); return Math.min(A_TOP, Math.max(0, Number.isFinite(a) ? a : 0)); };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r2 = x => Math.round(x * 100) / 100;
const toSet = v => (v instanceof Set ? v : new Set(Array.isArray(v) ? v : []));
const T = s => frTypo(s);
const S = n => String(n);
const f = n => fmtNum(Number(n));
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
const pl = (n, sing, plur) => (Math.abs(n) >= 2 ? plur : sing);

/* ---------- nombres décimaux écrits en chaînes (« 15,30 ») ---------- */
function parse(str) {
  const [int, frac = ''] = String(str).split(',');
  return { str: String(str), int, frac, s: int + frac, dec: frac.length };
}
/* chiffre au rang p (0 = unités, 1 = dizaines, −1 = dixièmes…) ; null s'il n'est pas écrit */
const digitAt = (n, p) => { const i = n.int.length - 1 - p; return i >= 0 && i < n.s.length ? Number(n.s[i]) : null; };
const topOf = n => n.int.length - 1;
const scaled = (n, D) => BigInt(n.s + '0'.repeat(D - n.dec));
function decStr(v, D) {                                       /* BigInt à D décimales → « 196,25 » */
  let s = v.toString();
  if (!D) return s;
  s = s.padStart(D + 1, '0');
  return `${s.slice(0, -D)},${s.slice(-D)}`;
}
const toNum = str => Number(String(str).replace(',', '.'));
const fs = str => { const d = (String(str).split(',')[1] || '').length; return fmtNum(toNum(str), d || undefined); };
const ascii = str => String(str).replace(',', '.');
const padTo = (n, D) => (D ? `${n.int},${n.frac.padEnd(D, '0')}` : n.int);
const nd = (rng, k) => rng.int(k <= 1 ? 1 : 10 ** (k - 1), 10 ** k - 1);

/* ---------- rangs ---------- */
const RANK = {
  '-3': ['millième', 'millièmes'], '-2': ['centième', 'centièmes'], '-1': ['dixième', 'dixièmes'],
  0: ['unité', 'unités'], 1: ['dizaine', 'dizaines'], 2: ['centaine', 'centaines'], 3: ['millier', 'milliers'],
  4: ['dizaine de milliers', 'dizaines de milliers'], 5: ['centaine de milliers', 'centaines de milliers'],
  6: ['million', 'millions'], 7: ['dizaine de millions', 'dizaines de millions'],
  8: ['centaine de millions', 'centaines de millions'], 9: ['millier de millions', 'milliers de millions']
};
const rk = (p, n = 2) => (RANK[p] || RANK[0])[Math.abs(n) >= 2 ? 1 : 0];
const colName = p => cap1(rk(p));

/* ---------- champ numérique ---------- */
function maxField(A) {
  if (A < 0.2) return 20;
  if (A < 0.45) return 59;
  if (A < 1) return 100;
  if (A < 2) return 1000;
  if (A < 3.4) return 9999;
  if (A < 4.4) return 999999;
  return 999999999;
}
function fieldLevel(x) {
  const n = Math.floor(Math.abs(Number(x)));
  if (n <= 20) return 0;
  if (n <= 59) return 0.2;
  if (n <= 100) return 0.45;
  if (n <= 1000) return 1;
  if (n <= 9999) return 2;
  if (n <= 999999) return 3.4;
  return 4.4;
}

/* ---------- grille et étapes ---------- */
function makeGrid() {
  const cells = [], index = new Map();
  const k = (r, c, pos) => `${r},${c},${pos || ''}`;
  function add(r, c, ch, role, o = {}) {
    if (index.has(k(r, c, o.pos))) throw new Error(`case déjà occupée ${r},${c}`);
    const cell = { r, c, ch: S(ch), role, small: !!o.small, hidden: !!o.hidden, strike: false };
    if (o.pale) cell.pale = true;
    if (o.pos) cell.pos = o.pos;
    if (o.zero) cell.zero = true;
    if (o.from) cell.from = { r: o.from.r, c: o.from.c };
    index.set(k(r, c, o.pos), cell);
    cells.push(cell);
    return cell;
  }
  const get = (r, c, pos) => index.get(k(r, c, pos)) || null;
  return { cells, add, get };
}
const ref = cell => (cell.pos ? { r: cell.r, c: cell.c, pos: cell.pos } : { r: cell.r, c: cell.c });
function makeSteps() {
  const steps = [];
  function push(o) {
    const strike = (o.strike || []).filter(Boolean);
    for (const c of strike) c.strike = true;
    steps.push({
      id: `s${steps.length + 1}`, type: o.type, ask: !!o.ask, expect: o.ask ? S(o.expect) : null,
      cells: (o.cells || []).filter(Boolean).map(ref), focus: (o.focus || []).filter(Boolean).map(ref), strike: strike.map(ref),
      prompt: o.ask ? T(o.prompt) : null, hint: o.ask ? T(o.hint) : null, say: T(o.say)
    });
  }
  return { steps, push };
}

/* ---------- addition colonne par colonne (addition posée, somme des produits partiels) ---------- */
function addColumns(St, o) {
  let carry = 0, carryCell = null;
  for (let p = o.pMin; p <= o.pMax; p++) {
    const ds = o.colDigits(p);                                   /* [{ v, cell }] */
    const vals = ds.map(x => x.v);
    const s = vals.reduce((t, v) => t + v, 0) + carry, digit = s % 10, out = Math.floor(s / 10);
    const expr = [...vals, ...(carry ? [carry] : [])].join(' + ');
    const prompt = vals.length === 1 && !carry ? `${o.name(p)} : il n’y a que ${vals[0]}. Quel chiffre écris-tu ?`
      : `${o.name(p)} : ${vals.join(' + ')}${carry ? ` + ${carry} de retenue` : ''}. Quel chiffre écris-tu ?`;
    const hint = s >= 10 ? 'Le total dépasse 9 : écris seulement son chiffre des unités et garde les dizaines en retenue.'
      : carry ? 'N’oublie pas la retenue écrite en haut de la colonne.'
        : vals.length === 1 ? 'Il n’y a rien à ajouter : recopie ce chiffre.' : 'Ajoute les chiffres de la colonne.';
    const say = vals.length + (carry ? 1 : 0) > 1 ? `${expr} = ${s} : je pose ${digit}${out ? ` et je retiens ${out}` : ''}.` : `Je pose ${digit}.`;
    St.push({ type: 'digit', ask: true, expect: digit, cells: [o.resultCell(p)], focus: [...ds.map(x => x.cell), carryCell], prompt, hint, say });
    carryCell = null;
    if (out && p < o.pMax) {
      carryCell = o.newCarry(p + 1, out);
      const rp = o.rank ? o.rank(p) : null;
      St.push({ type: 'carry', cells: [carryCell], focus: [carryCell],
        say: rp === null ? `La retenue ${out} monte en haut de la colonne suivante.`
          : `${s} ${rk(rp, s)}, c’est ${out} ${rk(rp + 1, out)} et ${digit} ${rk(rp, digit)} : la retenue ${out} monte dans la colonne des ${rk(rp + 1)}.` });
    } else if (out) {
      const lead = o.resultCell(p + 1);
      St.push({ type: 'digit', ask: true, expect: out, cells: [lead], focus: [lead],
        prompt: 'Il n’y a plus de colonne : quel chiffre écris-tu à gauche ?', hint: 'Écris dans le résultat ce que tu as retenu.',
        say: `J’écris la retenue ${out} devant : ${o.total}.` });
    }
    carry = out;
    if (o.after) o.after(p);
  }
}
function padSay(padded, D) {
  const list = padded.map(([n, s]) => `${fs(n.str)} = ${fs(s)}`);
  return `J’écris des 0 en pâle pour avoir ${D} ${pl(D, 'chiffre', 'chiffres')} après la virgule partout : `
    + `${list.length > 1 ? `${list.slice(0, -1).join(', ')} et ${list[list.length - 1]}` : list[0]}.`;
}
/* chiffres d'un nombre posé sur la ligne r (colonne du rang p : col(p)), virgule attachée, zéros utiles pâles */
function putNumber(g, r, n, D, col, pads, padded) {
  for (let p = topOf(n); p >= -n.dec; p--) g.add(r, col(p), digitAt(n, p), 'operand');
  if (n.dec) g.add(r, col(0), ',', 'comma', { pos: 'apres' });
  if (n.dec < D) {
    if (!n.dec) pads.push(g.add(r, col(0), ',', 'comma', { pos: 'apres', pale: true, hidden: true }));
    for (let p = -n.dec - 1; p >= -D; p--) pads.push(g.add(r, col(p), '0', 'operand', { pale: true, hidden: true }));
    padded.push([n, padTo(n, D)]);
  }
}
const digPad = (n, p, D) => { const v = digitAt(n, p); return v === null && p < 0 && p >= -D ? 0 : v; };

/* ========== ADDITION ========== */
function buildAdd(terms, unit) {
  const N = terms.map(parse);
  const D = Math.max(...N.map(n => n.dec));
  const total = N.reduce((t, n) => t + scaled(n, D), 0n);
  const result = decStr(total, D), R = parse(result);
  const k = N.length, top = Math.max(...N.map(topOf));
  const cols = 1 + topOf(R) + 1 + D;
  const col = p => cols - 1 - (p + D);
  const g = makeGrid(), St = makeSteps();
  const rT = i => 1 + i, rRule = k + 1, rRes = k + 2;
  const rowInfo = [{ role: 'carry', small: true }, ...N.map(() => ({ role: 'operand', small: false })),
    { role: 'rule', small: false }, { role: 'result', small: false }];
  const pads = [], padded = [];
  N.forEach((n, i) => { if (i) g.add(rT(i), 0, '+', 'sign'); putNumber(g, rT(i), n, D, col, pads, padded); });
  for (let c = 0; c < cols; c++) g.add(rRule, c, '─', 'rule');
  for (let p = topOf(R); p >= -D; p--) g.add(rRes, col(p), digitAt(R, p), 'result', { hidden: true });
  const resComma = D ? g.add(rRes, col(0), ',', 'comma', { pos: 'apres', hidden: true }) : null;
  if (pads.length) St.push({ type: 'pad', cells: pads, focus: pads, say: padSay(padded, D) });
  addColumns(St, {
    pMin: -D, pMax: top, total: `${fs(result)}${unit ? `${NNBSP}€` : ''}`, name: colName, rank: p => p,
    colDigits: p => N.map((n, i) => ({ v: digPad(n, p, D), cell: g.get(rT(i), col(p)) })).filter(x => x.v !== null),
    resultCell: p => g.get(rRes, col(p)),
    newCarry: (p, v) => g.add(0, col(p), v, 'carry', { small: true, hidden: true }),
    after: p => {
      if (p === -1 && resComma) St.push({ type: 'comma', cells: [resComma], focus: [resComma],
        say: unit ? 'J’écris la virgule du résultat sous les autres virgules : les euros à gauche, les centimes à droite.'
          : 'J’écris la virgule du résultat sous les autres virgules.' });
    }
  });
  return { op: '+', operands: terms.slice(), method: 'colonnes', result, remainder: null, unit: unit || null,
    grid: { rows: rowInfo.length, cols, rowInfo, cells: g.cells }, steps: St.steps };
}

/* ========== SOUSTRACTION (compensation ou cassage) ========== */
function buildSub(aStr, bStr, method, unit) {
  const a = parse(aStr), b = parse(bStr);
  const D = Math.max(a.dec, b.dec);
  const diff = scaled(a, D) - scaled(b, D);
  if (diff <= 0n || b.int.length > a.int.length) return null;
  const result = decStr(diff, D), R = parse(result);
  const top = topOf(a);
  const cols = 1 + top + 1 + D;
  const col = p => cols - 1 - (p + D);
  const comp = method !== 'cassage';
  const rTop = comp ? 0 : 1, rBot = comp ? 1 : 2, rMark = comp ? 2 : 0, rRule = 3, rRes = 4;
  const ops = { role: 'operand', small: false }, mk = { role: 'mark', small: true };
  const rowInfo = comp ? [ops, ops, mk, { role: 'rule', small: false }, { role: 'result', small: false }]
    : [mk, ops, ops, { role: 'rule', small: false }, { role: 'result', small: false }];
  const g = makeGrid(), St = makeSteps();
  const pads = [], padded = [];
  putNumber(g, rTop, a, D, col, pads, padded);
  g.add(rBot, 0, '−', 'sign');
  putNumber(g, rBot, b, D, col, pads, padded);
  for (let c = 0; c < cols; c++) g.add(rRule, c, '─', 'rule');
  for (let p = topOf(R); p >= -D; p--) g.add(rRes, col(p), digitAt(R, p), 'result', { hidden: true });
  const resComma = D ? g.add(rRes, col(0), ',', 'comma', { pos: 'apres', hidden: true }) : null;
  if (pads.length) St.push({ type: 'pad', cells: pads, focus: pads, say: padSay(padded, D) });
  const commaStep = p => {
    if (p === -1 && resComma) St.push({ type: 'comma', cells: [resComma], focus: [resComma],
      say: unit ? 'J’écris la virgule du résultat sous les autres virgules : les euros à gauche, les centimes à droite.'
        : 'J’écris la virgule du résultat sous les autres virgules.' });
  };
  const leading = p => p > topOf(R);                       /* 0 à gauche du résultat : il ne s'écrit pas */

  if (comp) {
    let k = 0;
    for (let p = -D; p <= top; p++) {
      const t = digPad(a, p, D), bv = digPad(b, p, D), bt = bv ?? 0, need = bt + k;
      const topCell = g.get(rTop, col(p)), botCell = g.get(rBot, col(p)), plusCell = k ? g.get(rMark, col(p)) : null;
      let tv = t, kNext = 0, one = null;
      if (t < need) {
        one = g.add(rTop, col(p), '1', 'mark', { small: true, hidden: true, pos: 'avant' });
        const plus = g.add(rMark, col(p + 1), '+1', 'mark', { small: true, hidden: true });
        tv = t + 10; kNext = 1;
        St.push({ type: 'mark', cells: [one, plus], focus: [topCell, botCell, plusCell],
          say: `${t} < ${need} : j’ajoute 10 ${rk(p)} au nombre du haut (le ${t} devient ${tv}) et 1 ${rk(p + 1, 1)} au nombre du bas `
            + `(le +1 sous les ${rk(p + 1)}). Les deux nombres augmentent autant : l’écart ne change pas.` });
      }
      const d = tv - need, focus = [topCell, one, botCell, plusCell];
      if (leading(p)) St.push({ type: 'info', focus, say: `${colName(p)} : ${tv} − ${need} = 0. On n’écrit pas de 0 au début d’un nombre.` });
      else {
        const prompt = k ? (bv === null ? `${colName(p)} : en bas, il n’y a que la retenue 1. Combien font ${tv} − 1 ?`
          : `${colName(p)} : en bas, ${bt} + 1 de retenue = ${need}. Combien font ${tv} − ${need} ?`)
          : bv === null ? `${colName(p)} : rien à enlever. Quel chiffre écris-tu ?` : `${colName(p)} : ${tv} − ${bt}. Quel chiffre écris-tu ?`;
        const hint = one ? `Avec le petit 1 écrit devant, le chiffre du haut vaut ${tv}.`
          : k ? 'La retenue s’ajoute au chiffre du bas, puis on soustrait.'
            : bv === null ? 'Il n’y a rien à enlever : recopie le chiffre du haut.' : 'Enlève le chiffre du bas au chiffre du haut.';
        St.push({ type: 'digit', ask: true, expect: d, cells: [g.get(rRes, col(p))], focus, prompt, hint,
          say: bv !== null || k ? `${tv} − ${need} = ${d} : je pose ${d}${kNext ? ' et je retiens 1' : ''}.` : `Je pose ${d}.` });
      }
      k = kNext;
      commaStep(p);
    }
  } else {
    const cur = {}, cell = {}, orig = {};
    for (let p = -D; p <= top; p++) { cur[p] = digPad(a, p, D); cell[p] = g.get(rTop, col(p)); orig[p] = cell[p]; }
    for (let p = -D; p <= top; p++) {
      const bv = digPad(b, p, D), bt = bv ?? 0, botCell = g.get(rBot, col(p));
      let one = null;
      if (cur[p] < bt) {
        const before = cur[p];
        let q = p + 1; while (cur[q] === 0) q++;
        const strikes = [cell[q]], marks = [], dq = cur[q], nv = dq - 1;
        if (q === top && nv === 0) cell[q] = null;                /* chiffre de tête qui devient 0 : barré, rien au-dessus */
        else { const m = g.add(rMark, col(q), nv, 'mark', { small: true, hidden: true }); marks.push(m); cell[q] = m; }
        cur[q] = nv;
        const zeros = [];
        for (let z = q - 1; z > p; z--) {
          strikes.push(cell[z]);
          const m = g.add(rMark, col(z), 9, 'mark', { small: true, hidden: true });
          marks.push(m); cell[z] = m; cur[z] = 9; zeros.push(z);
        }
        const host = cell[p];
        one = g.add(host.r, host.c, '1', 'mark', { small: true, hidden: true, pos: 'avant' });
        marks.push(one);
        cur[p] += 10;
        const lack = zeros.length ? ` et il n’y a ${zeros.length === 1 ? `pas de ${rk(zeros[0], 1)}` : `ni ${zeros.map(z => rk(z, 1)).reverse().join(' ni ')}`} à casser` : '';
        let txt = `${before} < ${bt}${lack} : je casse 1 ${rk(q, 1)}. Le ${dq} des ${rk(q)} devient ${nv}`;
        for (const z of zeros) txt += `, et le 0 des ${rk(z)} devient 10. Je casse 1 de ces ${rk(z)} : il en reste 9`;
        txt += `, et le ${before} des ${rk(p)} devient ${before + 10}.`;
        St.push({ type: 'mark', cells: marks, strike: strikes, focus: [host, botCell], say: txt });
      }
      const d = cur[p] - bt, focus = [cell[p] || orig[p], one, botCell];
      if (leading(p)) St.push({ type: 'info', focus, say: `${colName(p)} : il ne reste rien. On n’écrit pas de 0 au début d’un nombre.` });
      else {
        const rewritten = cell[p] && cell[p] !== orig[p] && !one;
        const prompt = bv === null ? `${colName(p)} : rien à enlever. Quel chiffre écris-tu ?` : `${colName(p)} : ${cur[p]} − ${bt}. Quel chiffre écris-tu ?`;
        const hint = one ? `Après le cassage, le chiffre du haut vaut ${cur[p]}.`
          : rewritten ? 'Ce chiffre a été barré : utilise le nouveau chiffre écrit au-dessus.'
            : bv === null ? 'Il n’y a rien à enlever : recopie le chiffre du haut.' : 'Enlève le chiffre du bas au chiffre du haut.';
        St.push({ type: 'digit', ask: true, expect: d, cells: [g.get(rRes, col(p))], focus, prompt, hint,
          say: bv !== null ? `${cur[p]} − ${bt} = ${d} : je pose ${d}.` : `Je pose ${d}.` });
      }
      commaStep(p);
    }
  }
  return { op: '−', operands: [aStr, bStr], method: comp ? 'compensation' : 'cassage', result, remainder: null, unit: unit || null,
    grid: { rows: rowInfo.length, cols, rowInfo, cells: g.cells }, steps: St.steps };
}

/* ========== MULTIPLICATION (règle des 0) ========== */
const ZEROS_TXT = { 1: 'un 0 aux unités', 2: 'deux 0, aux unités et aux dizaines', 3: 'trois 0, aux unités, aux dizaines et aux centaines' };
function buildMul(topStr, botStr, unit, swapped) {
  const a = parse(topStr), b = parse(botStr);
  if (b.dec || b.s.length > a.s.length || /^0/.test(a.s) || /^0/.test(b.s)) return null;
  const Av = BigInt(a.s), P = Av * BigInt(b.s);
  const result = decStr(P, a.dec), Ps = P.toString();
  const bd = [...b.s].reverse().map(Number);
  const parts = [];
  bd.forEach((dj, j) => { if (dj) parts.push({ j, dj, v: Av * BigInt(dj), str: (Av * BigInt(dj)).toString() + '0'.repeat(j) }); });
  const m = parts.length;
  const W = Math.max(a.s.length, b.s.length, Ps.length, ...parts.map(x => x.str.length));
  const cols = 1 + W;
  const colI = i => cols - 1 - i;                            /* i = rang du chiffre en partant de la droite */
  const g = makeGrid(), St = makeSteps();
  const carryRow = t => m - 1 - t, rA = m, rB = m + 1, rRule = m + 2;
  const rAddCarry = m + 3, rPart = t => (m === 1 ? m + 3 : m + 4 + t), rRule2 = m + 4 + m, rRes = m === 1 ? m + 3 : rRule2 + 1;
  const rowInfo = [...parts.map(() => ({ role: 'carry', small: true })), { role: 'operand', small: false }, { role: 'operand', small: false },
    { role: 'rule', small: false }];
  if (m === 1) rowInfo.push({ role: 'result', small: false });
  else rowInfo.push({ role: 'carry', small: true }, ...parts.map(() => ({ role: 'partial', small: false })), { role: 'rule', small: false }, { role: 'result', small: false });
  const L = a.s.length;
  for (let i = 0; i < L; i++) g.add(rA, colI(i), a.s[L - 1 - i], 'operand');
  const aComma = a.dec ? g.add(rA, colI(a.dec), ',', 'comma', { pos: 'apres' }) : null;
  g.add(rB, 0, '×', 'sign');
  for (let i = 0; i < b.s.length; i++) g.add(rB, colI(i), b.s[b.s.length - 1 - i], 'operand');
  for (let c = 0; c < cols; c++) g.add(rRule, c, '─', 'rule');
  parts.forEach((x, t) => {
    const r = rPart(t), role = m === 1 ? 'result' : 'partial';
    for (let i = 0; i < x.str.length; i++) g.add(r, colI(i), x.str[x.str.length - 1 - i], role, { hidden: true, zero: i < x.j });
    if (t > 0) g.add(r, 0, '+', 'sign', { hidden: true });
  });
  if (m > 1) {
    for (let c = 0; c < cols; c++) g.add(rRule2, c, '─', 'rule');
    for (let i = 0; i < Ps.length; i++) g.add(rRes, colI(i), Ps[Ps.length - 1 - i], 'result', { hidden: true });
  }
  const resComma = a.dec ? g.add(rRes, colI(a.dec), ',', 'comma', { pos: 'apres', hidden: true }) : null;
  const aInt = f(a.s), bTxt = fs(botStr);

  if (swapped) St.push({ type: 'info', focus: g.cells.filter(c => c.r === rA || c.r === rB),
    say: b.s.length < a.s.length ? `Je pose ${fs(topStr)} en haut et ${bTxt} en dessous : le nombre qui a le moins de chiffres va sur la deuxième ligne.`
      : `Je pose ${fs(topStr)} en haut et ${bTxt} en dessous : on multiplie par le nombre entier.` });
  if (a.dec) St.push({ type: 'info', focus: [aComma], say: `On multiplie sans s’occuper de la virgule : ${aInt} × ${bTxt}. On placera la virgule à la fin.` });
  let t = 0;
  for (let j = 0; j < bd.length; j++) {
    const dj = bd[j], bCell = g.get(rB, colI(j));
    if (!dj) { St.push({ type: 'info', focus: [bCell], say: `Le chiffre des ${rk(j)} de ${bTxt} est 0 : ${aInt} × 0 = 0, il n’y a pas de ligne à écrire.` }); continue; }
    const x = parts[t], pr = rPart(t);
    const lineTxt = `${aInt} × ${f(dj * 10 ** j)} = ${f(x.str)}`;
    if (j > 0) {
      const zs = []; for (let i = 0; i < j; i++) zs.push(g.get(pr, colI(i)));
      St.push({ type: 'zero', cells: [...zs, t > 0 ? g.get(pr, 0) : null], focus: [bCell, ...zs],
        say: `Le ${dj} de ${bTxt} vaut ${dj} ${rk(j, dj)} : je multiplie par ${f(dj * 10 ** j)}. J’écris d’abord ${ZEROS_TXT[j] || `${j} zéros`} (règle des 0), puis je multiplie par ${dj}.` });
    }
    let carry = 0, carryCell = null;
    for (let i = 0; i < L; i++) {
      const ai = Number(a.s[L - 1 - i]), aCell = g.get(rA, colI(i));
      const prod = ai * dj, v = prod + carry, digit = v % 10, out = Math.floor(v / 10), last = i === L - 1;
      St.push({ type: 'digit', ask: true, expect: digit, cells: [g.get(pr, colI(i + j))], focus: [aCell, bCell, carryCell],
        prompt: `${dj} × ${ai}${carry ? ` + ${carry} de retenue` : ''}. Quel chiffre écris-tu ?`,
        hint: carry ? 'Multiplie, puis ajoute la retenue. Écris le chiffre des unités et retiens les dizaines.'
          : v >= 10 ? 'Écris le chiffre des unités du produit ; les dizaines partent en retenue.' : 'C’est un résultat de la table : écris-le.',
        say: `${dj} × ${ai} = ${prod}${carry ? `, et ${prod} + ${carry} = ${v}` : ''} : je pose ${digit}${out ? ` et je retiens ${out}` : ''}.`
          + `${last && !out ? ` Ligne terminée : ${lineTxt}.` : ''}` });
      carryCell = null;
      if (out && !last) {
        carryCell = g.add(carryRow(t), colI(i + 1), out, 'carry', { small: true, hidden: true });
        St.push({ type: 'carry', cells: [carryCell], focus: [carryCell, g.get(rA, colI(i + 1))],
          say: `Je retiens ${out} : je l’écris au-dessus du ${a.s[L - 2 - i]}, pour l’ajouter après la prochaine multiplication.` });
      } else if (out) {
        const lead = g.get(pr, colI(i + j + 1));
        St.push({ type: 'digit', ask: true, expect: out, cells: [lead], focus: [lead],
          prompt: 'Plus de chiffre à multiplier : quel chiffre écris-tu à gauche ?', hint: 'Écris ce que tu as retenu.',
          say: `J’écris ${out}. Ligne terminée : ${lineTxt}.` });
      }
      carry = out;
    }
    t++;
  }
  if (m > 1) {
    St.push({ type: 'info', focus: g.cells.filter(c => c.role === 'partial'), say: 'Il reste à additionner les lignes, colonne par colonne, en commençant par la droite.' });
    addColumns(St, {
      pMin: 0, pMax: Math.max(...parts.map(x => x.str.length)) - 1, total: f(Ps), name: () => 'Addition', rank: a.dec ? null : (p => p),
      colDigits: p => parts.map((x, k) => { const i = x.str.length - 1 - p; return i >= 0 ? { v: Number(x.str[i]), cell: g.get(rPart(k), colI(p)) } : null; }).filter(Boolean),
      resultCell: p => g.get(rRes, colI(p)),
      newCarry: (p, v) => g.add(rAddCarry, colI(p), v, 'carry', { small: true, hidden: true })
    });
  }
  if (resComma) St.push({ type: 'comma', cells: [resComma], focus: [aComma, resComma],
    say: `${fs(topStr)} a ${a.dec} ${pl(a.dec, 'chiffre', 'chiffres')} après la virgule : le résultat aussi. ${f(Ps)} devient ${fs(result)}.` });
  return { op: '×', operands: [topStr, botStr], method: 'zeros', result, remainder: null, unit: unit || null,
    grid: { rows: rowInfo.length, cols, rowInfo, cells: g.cells }, steps: St.steps };
}

/* ========== DIVISION (potence ; euclidienne ou décimale) ========== */
function buildDiv(nStr, dStr, decimal) {
  const N = parse(nStr), d = Number(dStr);
  if (!(d >= 2 && d <= 9) || (!decimal && N.dec) || /^0/.test(N.s)) return null;
  const digits = [...N.s].map(Number), intLen = N.int.length;
  /* simulation : tranches successives */
  const parts = [];
  let pos = 0, cur = 0, extra = 0;
  while (pos < intLen) { cur = cur * 10 + digits[pos]; pos++; if (cur >= d) break; }
  if (cur < d) return null;                                  /* partie entière plus petite que le diviseur */
  const firstLen = pos;
  for (;;) {
    const q = Math.floor(cur / d), prod = q * d, rest = cur - prod;
    parts.push({ cur, q, prod, rest, e: pos });               /* e = colonne du dernier chiffre de la tranche */
    if (pos < digits.length) { cur = rest * 10 + digits[pos]; pos++; continue; }
    if (decimal && rest) {
      if (N.dec + extra >= 2) return null;                     /* quotient exact au centième au plus (CM2) */
      digits.push(0); extra++; cur = rest * 10; pos++; continue;
    }
    break;
  }
  const last = parts[parts.length - 1];
  if (decimal && last.rest) return null;
  const nq = parts.length, qIntLen = intLen - firstLen + 1;
  const qDigits = parts.map(x => x.q).join('');
  const qDec = qDigits.slice(qIntLen);
  if (decimal && !qDec) return null;                         /* division décimale : quotient non entier */
  const result = qDec ? `${qDigits.slice(0, qIntLen)},${qDec}` : qDigits;
  const L = digits.length, V = L + 1, cols = V + 1 + nq, rows = 1 + 2 * nq;
  const g = makeGrid(), St = makeSteps();
  const rowInfo = [{ role: 'operand', small: false }, ...parts.flatMap(() => [{ role: 'sub', small: false }, { role: 'rest', small: false }])];
  for (let i = 0; i < N.s.length; i++) g.add(0, 1 + i, N.s[i], 'operand');
  if (N.dec) g.add(0, intLen, ',', 'comma', { pos: 'apres' });
  for (let i = N.s.length; i < L; i++) g.add(0, 1 + i, '0', 'operand', { pale: true, hidden: true });
  const divComma = !N.dec && extra ? g.add(0, intLen, ',', 'comma', { pos: 'apres', pale: true, hidden: true }) : null;
  for (let r = 0; r < rows; r++) g.add(r, V, r === 1 ? '├' : '│', 'rule');
  const divCell = g.add(0, V + 1, d, 'divisor');
  for (let c = V + 1; c < cols; c++) g.add(1, c, '─', 'rule');
  const qCells = parts.map((x, t) => g.add(2, V + 1 + t, x.q, 'quotient', { hidden: true }));
  const qComma = qDec ? g.add(2, V + qIntLen, ',', 'comma', { pos: 'apres', hidden: true }) : null;
  const prodCells = [], restCells = [], bringCells = [];
  parts.forEach((x, t) => {
    const ps = S(x.prod), e = x.e, pr = 1 + 2 * t, rr = 2 + 2 * t;
    const pc = [g.add(pr, e - ps.length, '−', 'sign', { hidden: true })];
    for (let i = 0; i < ps.length; i++) pc.push(g.add(pr, e - ps.length + 1 + i, ps[i], 'sub', { hidden: true }));
    prodCells.push(pc);
    restCells.push(g.add(rr, e, x.rest, 'rest', { hidden: true }));
    bringCells.push(t < nq - 1 ? g.add(rr, e + 1, digits[e], 'rest', { hidden: true, from: { r: 0, c: e + 1 } }) : null);
  });
  const dividendCells = g.cells.filter(c => c.r === 0 && c.role === 'operand' && !c.hidden);
  /* 1. encadrement du quotient */
  const intVal = Number(N.int), lo = 10 ** (qIntLen - 1), hi = 10 ** qIntLen;
  St.push({ type: 'count', ask: true, expect: qIntLen, focus: [...dividendCells, divCell],
    prompt: `Avant de commencer : combien de chiffres aura ${decimal ? 'la partie entière du quotient' : 'le quotient'} ?`,
    hint: `Encadre ${f(intVal)} : ${d} × ${f(lo)} = ${f(d * lo)} et ${d} × ${f(hi)} = ${f(d * hi)}.`,
    say: `${f(d * lo)} ≤ ${f(intVal)} < ${f(d * hi)} : le quotient est entre ${f(lo)} et ${f(hi)}. Il a ${qIntLen} ${pl(qIntLen, 'chiffre', 'chiffres')}${decimal ? ' avant la virgule' : ''}.` });
  /* 2. première tranche */
  const p0 = intLen - firstLen, first = parts[0].cur;
  St.push({ type: 'info', focus: dividendCells.slice(0, firstLen),
    say: firstLen > 1 ? `${digits[0]} < ${d} : je prends ${f(first)} ${rk(p0, first)}.` : `Je commence par les ${first} ${rk(p0, first)} : ${first} ≥ ${d}.` });
  /* 3. chiffre par chiffre */
  parts.forEach((x, t) => {
    const partCells = t === 0 ? dividendCells.slice(0, firstLen) : [restCells[t - 1], bringCells[t - 1]];
    St.push({ type: 'quotient', ask: true, expect: x.q, cells: [qCells[t]], focus: [...partCells, divCell],
      prompt: `Dans ${f(x.cur)}, combien de fois ${d} ?`,
      hint: `Cherche dans la table de ${d} le plus grand résultat qui ne dépasse pas ${f(x.cur)}.`,
      say: x.q < 9 ? `${d} × ${x.q} = ${f(x.prod)} et ${d} × ${x.q + 1} = ${f(x.prod + d)} : dans ${f(x.cur)}, il y a ${x.q} fois ${d}.`
        : `${d} × 9 = ${f(x.prod)} : dans ${f(x.cur)}, il y a 9 fois ${d}.` });
    St.push({ type: 'product', cells: prodCells[t], focus: [qCells[t], divCell, ...prodCells[t]],
      say: `${x.q} × ${d} = ${f(x.prod)} : je l’écris sous ${f(x.cur)} pour le soustraire.` });
    St.push({ type: 'rest', ask: true, expect: x.rest, cells: [restCells[t]], focus: [...partCells, ...prodCells[t].slice(1)],
      prompt: `Combien font ${f(x.cur)} − ${f(x.prod)} ?`,
      hint: x.prod === x.cur ? 'Regarde bien : les deux nombres sont égaux.' : x.prod ? `Compte de ${f(x.prod)} jusqu’à ${f(x.cur)}.` : 'Enlever 0 ne change rien.',
      say: `${f(x.cur)} − ${f(x.prod)} = ${x.rest} : il reste ${x.rest}${x.rest ? `, c’est moins que ${d}` : ''}.` });
    if (t < nq - 1) {
      const idx = x.e, isExtra = idx >= N.s.length, src = g.get(0, idx + 1), next = parts[t + 1].cur, pn = intLen - 1 - idx;
      if (idx === intLen) St.push({ type: 'comma', cells: [qComma, divComma], focus: [qComma],
        say: N.dec ? 'J’arrive aux dixièmes du dividende : je mets la virgule au quotient.'
          : `Il n’y a plus de chiffre à abaisser, mais il reste ${x.rest} : je mets la virgule au quotient. ${x.rest} ${rk(0, x.rest)}, c’est ${x.rest * 10} dixièmes.` });
      St.push({ type: 'bring', cells: [isExtra ? src : null, bringCells[t]], focus: [src, bringCells[t]],
        say: isExtra ? `J’écris un 0 en pâle aux ${rk(pn)} du dividende et je l’abaisse : cela fait ${f(next)} ${rk(pn, next)}.`
          : `J’abaisse le ${digits[idx]} : cela fait ${f(next)} ${rk(pn, next)}.` });
    }
  });
  /* 4. conclusion */
  St.push({ type: 'info', focus: [restCells[nq - 1], ...qCells],
    say: decimal ? `Le reste est 0 : la division est terminée. ${fs(nStr)} ÷ ${d} = ${fs(result)}.`
      : `Le reste est ${last.rest}, plus petit que ${d} : ${f(intVal)} = ${d} × ${f(qDigits)} + ${last.rest}.` });
  return { op: '÷', operands: [nStr, S(d)], method: 'potence', result, remainder: decimal ? null : S(last.rest), unit: null,
    grid: { rows, cols, rowInfo, cells: g.cells }, steps: St.steps, qDec: qDec.length };
}

/* ========== NIVEAU RÉEL D'UNE OPÉRATION ========== */
function addCarries(N, D) {
  let carry = 0, n = 0;
  const top = Math.max(...N.map(topOf));
  for (let p = -D; p <= top; p++) {
    let s = carry;
    for (const x of N) s += digPad(x, p, D) ?? 0;
    carry = Math.floor(s / 10);
    if (carry) n++;
  }
  return n;
}
function borrowInfo(a, b, D) {                                 /* emprunts de la soustraction, passage par un 0 */
  const top = topOf(a), cur = {};
  for (let p = -D; p <= top; p++) cur[p] = digPad(a, p, D) ?? 0;
  let borrows = 0, cascade = false;
  for (let p = -D; p <= top; p++) {
    const bt = digPad(b, p, D) ?? 0;
    if (cur[p] < bt) {
      let q = p + 1; while (q <= top && cur[q] === 0) q++;
      if (q > top) return null;
      if (q > p + 1) cascade = true;
      cur[q]--; for (let z = q - 1; z > p; z--) cur[z] = 9; cur[p] += 10; borrows++;
    }
  }
  return { borrows, cascade };
}
function levelAdd(terms, unit) {
  const N = terms.map(parse), D = Math.max(...N.map(n => n.dec)), k = N.length;
  const R = parse(decStr(N.reduce((t, n) => t + scaled(n, D), 0n), D));
  const w = Math.max(...N.map(n => n.int.length)), carries = addCarries(N, D);
  let lo;
  if (unit) lo = 2.4;
  else if (D) lo = D <= 2 ? 3.3 : 4;
  else if (w <= 2 && k === 2) lo = carries ? 0.6 : Math.min(...N.map(n => n.int.length)) === 1 ? 0 : 0.3;
  else if (w <= 3) lo = k >= 3 ? 1.3 : carries ? 1.2 : 1;
  else if (w <= 4) lo = k >= 3 ? 2.1 : 2;
  else lo = 3.4;
  return Math.max(lo, fieldLevel(R.int));
}
function levelSub(aStr, bStr, unit) {
  const a = parse(aStr), b = parse(bStr), D = Math.max(a.dec, b.dec), w = a.int.length;
  const info = borrowInfo(a, b, D);
  if (!info) return Infinity;
  let lo;
  if (unit) lo = 2.7;
  else if (D) lo = D <= 2 ? 3.3 : 4;
  else if (w <= 2) lo = info.borrows ? 1.7 : 1.5;
  else if (w <= 3) lo = info.cascade ? 1.85 : info.borrows ? 1.7 : 1.6;
  else if (w <= 4) lo = info.cascade ? 2.1 : 2;
  else lo = 3.4;
  return Math.max(lo, fieldLevel(a.int));
}
function levelMul(topStr, botStr) {
  const a = parse(topStr), b = parse(botStr), na = a.s.length, nb = b.s.length;
  const R = parse(decStr(BigInt(a.s) * BigInt(b.s), a.dec));
  let lo;
  if (a.dec) lo = nb === 1 ? (na <= 4 ? 3.3 : 4) : na <= 3 ? 4 : nb === 2 ? 4.3 : 5;
  else if (nb === 1) lo = na <= 2 ? 2.6 : na === 3 ? 2.7 : na === 4 ? 3 : 3.4;
  else if (nb === 2) lo = na <= 2 ? 2.8 : na === 3 ? 2.9 : 3.4;
  else lo = na <= 3 ? 3 : 5;
  return Math.max(lo, fieldLevel(R.int));
}
function levelDiv(nStr, decimal, qDec) {
  const N = parse(nStr), n = N.s.length;
  if (!decimal) return Math.max(n <= 3 ? 3.2 : n === 4 ? 3.5 : 3.8, fieldLevel(N.int));
  return Math.max(N.dec || n >= 5 ? 4.3 : qDec >= 2 ? 4.2 : 4, fieldLevel(N.int));
}

/* ========== TIRAGES ========== */
const sumOf = ts => ts.reduce((s, x) => s + x, 0);
const carriesInt = ts => addCarries(ts.map(t => parse(S(t))), 0);
const order = (rng, ts) => (rng.chance(0.8) ? [...ts].sort((x, y) => y - x) : ts).map(S);
const topFirst = ts => (ts[0] < 10 ? [...ts.slice(1), ts[0]] : ts);       /* jamais un nombre à 1 chiffre en haut */
function fracDigits(rng, d, money) {                         /* d chiffres après la virgule (dernier ≠ 0 hors monnaie) */
  let s = '';
  for (let i = 0; i < d; i++) s += S(i === d - 1 && !money ? rng.int(1, 9) : rng.int(0, 9));
  return s;
}
const money = (rng, maxInt) => `${rng.int(1, maxInt)},${fracDigits(rng, 2, true)}`;
function decimalTerm(rng, maxIntDigits, d) {
  const k = rng.int(0, maxIntDigits);
  const ip = k === 0 ? 0 : nd(rng, k);
  return d ? `${ip},${fracDigits(rng, d, false)}` : S(ip || nd(rng, 2));
}
const endsWithZeroDec = str => /,\d*0$/.test(str);
function intDigitsCap(A) { return A < 3.4 ? 4 : A < 4.4 ? 6 : 7; }

function addShape(A, rng) {
  const cap = maxField(A);
  if (A < 0.3) {
    const a = rng.int(10, Math.min(89, cap - 2)), b = rng.int(2, 8);
    return a % 10 + b <= 9 && a + b <= cap ? { terms: [S(a), S(b)] } : null;
  }
  if (A < 0.6) {
    const a = rng.int(11, 78), b = rng.int(11, 78);
    return a % 10 + b % 10 <= 9 && a + b <= cap ? { terms: order(rng, [a, b]) } : null;
  }
  if (A < 1) {
    const a = rng.int(12, 89), b = rng.chance(0.3) ? rng.int(3, 9) : rng.int(12, 89);
    return a % 10 + b % 10 >= 10 && a + b <= Math.min(cap, 100) ? { terms: order(rng, [a, b]) } : null;
  }
  if (A < 1.3) {
    const a = rng.int(100, 899), b = rng.chance(0.35) ? rng.int(11, 99) : rng.int(100, 899);
    const c = carriesInt([a, b]);
    if (a + b > 1000 || (A < 1.2 ? c > 0 : c === 0)) return null;
    return { terms: order(rng, [a, b]) };
  }
  if (A < 2) {
    if (rng.chance(0.45)) {
      const ts = [rng.int(10, 99), rng.int(2, 9), rng.int(100, 799)];
      return sumOf(ts) <= 1000 && carriesInt(ts) >= 1 ? { terms: topFirst(rng.shuffle(ts)).map(S) } : null;
    }
    const a = rng.int(100, 899), b = rng.int(100, 899);
    return a + b <= 1000 && carriesInt([a, b]) >= 1 ? { terms: order(rng, [a, b]) } : null;
  }
  const opts = A < 2.4 ? [['int', 1]] : A < 3.3 ? [['int', 0.65], ['eur', 0.35]] : [['int', 0.35], ['eur', 0.15], ['dec', 0.5]];
  const kind = rng.weighted(opts.map(x => x[0]), opts.map(x => x[1]));
  if (kind === 'int') {
    const maxD = intDigitsCap(A), k = rng.chance(A >= 5 ? 0.5 : A >= 2.2 ? 0.3 : 0.15) ? 3 : 2;
    const ts = [nd(rng, rng.chance(0.7) ? maxD : Math.max(2, maxD - 1))];
    for (let i = 1; i < k; i++) ts.push(nd(rng, rng.int(k === 3 && i === 2 ? 1 : 2, maxD)));
    if (sumOf(ts) > cap || carriesInt(ts) === 0) return null;
    return { terms: k === 3 ? topFirst(rng.shuffle(ts)).map(S) : order(rng, ts) };
  }
  if (kind === 'eur') {
    const k = A >= 3 && rng.chance(0.2) ? 3 : 2, maxI = A >= 2.8 ? 999 : 99;
    const ts = [money(rng, maxI)];
    for (let i = 1; i < k; i++) ts.push(rng.chance(0.2) ? `0,${S(rng.int(10, 99))}` : money(rng, maxI));
    const N = ts.map(parse);
    if (addCarries(N, 2) === 0) return null;
    if (toNum(decStr(N.reduce((t, n) => t + scaled(n, 2), 0n), 2)) > cap) return null;
    return { terms: ts, unit: '€' };
  }
  const maxDec = A < 4 ? 2 : 3, k = rng.chance(A >= 5 ? 0.6 : 0.35) ? 3 : 2;
  const ts = [];
  for (let i = 0; i < k; i++) ts.push(decimalTerm(rng, A < 4 ? 3 : 4, rng.int(i === 0 ? 1 : 0, maxDec)));
  const N = ts.map(parse), D = Math.max(...N.map(n => n.dec));
  const res = decStr(N.reduce((t, n) => t + scaled(n, D), 0n), D);
  if (!D || endsWithZeroDec(res) || toNum(res) > cap || ts.every(t => /^0,/.test(t))) return null;
  return { terms: ts };
}
function subShape(A, rng) {
  const cap = maxField(A);
  const ok = (a, b, unit) => {
    const pa = parse(a), pb = parse(b), D = Math.max(pa.dec, pb.dec);
    const diff = scaled(pa, D) - scaled(pb, D);
    if (diff <= 0n || pb.int.length > pa.int.length) return null;
    const R = parse(decStr(diff, D));
    if (R.int.length < pa.int.length - 1 && pa.int.length > 2) return null;   /* pas de longue suite de 0 en tête */
    if (!unit && D && endsWithZeroDec(R.str)) return null;
    return { a, b, unit: unit || null };
  };
  const info = (a, b) => borrowInfo(parse(S(a)), parse(S(b)), 0);
  if (A < 1.6) { const a = rng.int(20, 99), b = rng.chance(0.3) ? rng.int(2, 9) : rng.int(11, a - 10); return info(a, b).borrows ? null : ok(S(a), S(b)); }
  if (A < 1.7) { const a = rng.int(120, 999), b = rng.chance(0.3) ? rng.int(11, 99) : rng.int(100, a - 20); return info(a, b).borrows ? null : ok(S(a), S(b)); }
  if (A < 1.85) {
    const a = rng.chance(0.35) ? rng.int(21, 99) : rng.int(111, 999), b = rng.int(2, a - 10);
    if (/0/.test(S(a))) return null;
    const x = info(a, b);
    return x.borrows && !x.cascade ? ok(S(a), S(b)) : null;
  }
  if (A < 2) {
    const a = rng.chance(0.5) ? rng.int(1, 9) * 100 + rng.int(0, 9) : rng.int(111, 999), b = rng.int(12, a - 10);
    return info(a, b).borrows ? ok(S(a), S(b)) : null;
  }
  const opts = A < 2.7 ? [['int', 1]] : A < 3.3 ? [['int', 0.65], ['eur', 0.35]] : [['int', 0.4], ['eur', 0.15], ['dec', 0.45]];
  const kind = rng.weighted(opts.map(x => x[0]), opts.map(x => x[1]));
  if (kind === 'int') {
    const w = rng.chance(0.7) ? intDigitsCap(A) : Math.max(3, intDigitsCap(A) - 1);
    let a = nd(rng, w);
    if (rng.chance(0.3)) { const s = [...S(a)]; for (let i = 1; i < s.length; i++) if (rng.chance(0.45)) s[i] = '0'; a = Number(s.join('')); }
    if (a > cap) return null;
    const b = nd(rng, rng.int(2, w));
    if (b >= a || (rng.chance(0.85) && !info(a, b).borrows)) return null;
    return ok(S(a), S(b));
  }
  if (kind === 'eur') {
    const a = money(rng, A >= 3 ? 999 : 99), b = rng.chance(0.2) ? `0,${S(rng.int(10, 99))}` : money(rng, Math.max(1, Math.floor(toNum(a))));
    return ok(a, b, '€');
  }
  const maxDec = A < 4 ? 2 : 3;
  const a = A >= 3.5 && rng.chance(0.25) ? S(nd(rng, rng.int(2, A < 4 ? 3 : 4))) : decimalTerm(rng, A < 4 ? 3 : 4, rng.int(1, maxDec));
  const b = decimalTerm(rng, Math.max(1, parse(a).int.length), rng.int(1, maxDec));
  if (toNum(a) > cap) return null;
  return ok(a, b);
}
function mulShape(A, rng) {
  const cap = maxField(A);
  const shapes = [];                                           /* [chiffres en haut, chiffres en bas, décimales, poids] */
  if (A >= 2.6) shapes.push([2, 1, 0, 1]);
  if (A >= 2.7) shapes.push([3, 1, 0, 1.2]);
  if (A >= 2.8) shapes.push([2, 2, 0, 1.2], [3, 2, 0, 1]);
  if (A >= 3) shapes.push([4, 1, 0, 0.8]);
  if (A >= 3.3) shapes.push([3, 1, 1, 1], [4, 1, 2, 1.2]);
  if (A >= 3.4) shapes.push([3, 3, 0, 1.4], [4, 2, 0, 0.8]);
  if (A >= 4) shapes.push([3, 3, 2, 1.4], [3, 2, 1, 1], [4, 2, 2, 0.8]);
  if (A >= 5) shapes.push([4, 3, 2, 1.2], [4, 3, 0, 0.8]);
  /* les petites multiplications s'effacent quand les grandes arrivent (« plus long » au-delà du CM1) */
  const fade = sh => (sh[0] * sh[1] <= 3 ? (A >= 5 ? 0.2 : A >= 3.4 ? 0.4 : 1) : 1);
  const [na, nb, dec] = rng.weighted(shapes, shapes.map(sh => sh[3] * fade(sh)));
  const top = nd(rng, na), bot = nb === 1 ? rng.int(2, 9) : nd(rng, nb);
  if (top % 10 === 0 || bot % 10 === 0) return null;
  if (A >= 2.7 && !mulHasCarry(S(top), S(bot))) return null;      /* au moins une retenue, sauf toutes premières fois */
  if (dec && (top % 10) * (bot % 10) % 10 === 0) return null;  /* pas de 0 final après la virgule */
  const ts = S(top), topStr = dec ? `${ts.slice(0, -dec)},${ts.slice(-dec)}` : ts, botStr = S(bot);
  if (toNum(decStr(BigInt(top) * BigInt(bot), dec)) > cap) return null;
  const unit = dec === 2 && nb === 1 && rng.chance(0.35) ? '€' : null;
  const [x, y] = rng.chance(0.5) ? [topStr, botStr] : [botStr, topStr];
  return mulSpec(x, y, unit);
}
function mulHasCarry(top, bot) {
  for (const dj of bot) {
    let carry = 0;
    for (let i = top.length - 1; i >= 0; i--) { const v = Number(top[i]) * Number(dj) + carry; carry = Math.floor(v / 10); if (carry) return true; }
  }
  return false;
}
function mulSpec(x, y, unit) {
  const X = parse(x), Y = parse(y);
  if (X.dec && Y.dec) return null;
  let top, bot;
  if (X.dec || Y.dec) [top, bot] = X.dec ? [x, y] : [y, x];
  else [top, bot] = Y.s.length > X.s.length ? [y, x] : [x, y];
  if (parse(bot).s.length > parse(top).s.length) return null;
  return { x, y, top, bot, unit: unit || null };
}
function divShape(A, rng) {
  const n = A < 3.5 ? 3 : A < 3.8 ? rng.pick([3, 4]) : A < 5 ? rng.pick([3, 4, 4, 5]) : rng.pick([4, 5, 5]);
  return { n: S(nd(rng, n)), d: S(rng.int(2, 9)) };
}
/* largeur de la potence d'une division décimale : chiffres du dividende (+ zéros ajoutés) + 2 + chiffres du quotient */
function potenceCols(nStr, d) {
  const N = parse(nStr), q = decStr(BigInt(N.s) * 10n ** BigInt(2 - N.dec) / BigInt(d), 2).replace(/,?0+$/, '');
  const qd = (q.split(',')[1] || '').length;
  return N.s.length + Math.max(0, qd - N.dec) + 2 + q.replace(',', '').length;
}
function divdecShape(A, rng) {
  const maxCols = A >= 5 ? 16 : 13;                            /* tient sur un téléphone (785 ÷ 4 : 12 colonnes) */
  if (A >= 4.3 && rng.chance(0.4)) {
    const n = rng.pick(A >= 5 ? [4, 5] : [3, 4, 4, 5]), d = rng.int(2, 9), Ns = nd(rng, n);
    if (Ns % 10 === 0 || (Ns * 10) % d !== 0 || Ns % (10 * d) === 0) return null;
    const str = `${S(Ns).slice(0, -1)},${S(Ns).slice(-1)}`;
    return Number(str.split(',')[0]) >= d && potenceCols(str, d) <= maxCols ? { n: str, d: S(d) } : null;
  }
  const n = A < 4.2 ? rng.pick([3, 4, 4]) : rng.pick([3, 4, 4, 5]);
  const d = rng.weighted([2, 4, 5, 6, 8], [1, 1.4, 1, 0.8, 1.4]), N = nd(rng, n);
  if (N % d === 0 || (N * 100) % d !== 0 || (A < 4.2 && (N * 10) % d !== 0)) return null;
  return potenceCols(S(N), d) <= maxCols ? { n: S(N), d: S(d) } : null;
}
const SHAPES = { add: addShape, sub: subShape, mul: mulShape, div: divShape, divdec: divdecShape };
function sample(kind, A, rng) {
  for (let i = 0; i < SAMPLE_TRIES; i++) {
    let s = null;
    try { s = SHAPES[kind](A, rng); } catch (_) { s = null; }
    if (s) return s;
  }
  return null;
}
function kindWeights(A) {
  if (A < 1.5) return [['add', 1]];
  if (A < 2.6) return [['add', 0.45], ['sub', 0.55]];
  if (A < 3) return [['add', 0.25], ['sub', 0.3], ['mul', 0.45]];
  if (A < 3.2) return [['add', 0.2], ['sub', 0.2], ['mul', 0.6]];
  if (A < 4) return [['add', 0.15], ['sub', 0.15], ['mul', 0.35], ['div', 0.35]];
  return [['add', 0.1], ['sub', 0.12], ['mul', 0.3], ['div', 0.18], ['divdec', 0.3]];
}
function pickKind(A, rng) { const w = kindWeights(A); return rng.weighted(w.map(x => x[0]), w.map(x => x[1])); }

/* ========== ITEM ========== */
const euro = (str, unit) => `${fs(str)}${unit ? `${NNBSP}€` : ''}`;
function makeItem(kind, spec, method, A) {
  let data, lo, prompt, ops, hint, explain;
  try {
    if (kind === 'add') {
      data = buildAdd(spec.terms, spec.unit); lo = levelAdd(spec.terms, spec.unit);
      ops = spec.terms.map(ascii).join('+');
      prompt = spec.terms.map(t => euro(t, spec.unit)).join(' + ');
      const D = Math.max(...spec.terms.map(t => parse(t).dec));
      hint = D ? 'Pose virgule sous virgule. Calcule colonne par colonne en commençant par la droite, sans oublier les retenues.'
        : 'Calcule colonne par colonne en commençant par les unités, sans oublier les retenues.';
      const res = euro(data.result, spec.unit);
      explain = spec.terms.length === 2 ? `${prompt} = ${res}. Vérifie : ${res} − ${euro(spec.terms[1], spec.unit)} = ${euro(spec.terms[0], spec.unit)}.` : `${prompt} = ${res}.`;
    } else if (kind === 'sub') {
      data = buildSub(spec.a, spec.b, method, spec.unit); lo = levelSub(spec.a, spec.b, spec.unit);
      ops = `${ascii(spec.a)}-${ascii(spec.b)}`;
      prompt = `${euro(spec.a, spec.unit)} − ${euro(spec.b, spec.unit)}`;
      hint = method === 'cassage'
        ? 'Calcule colonne par colonne en commençant par la droite. Si le chiffre du haut est trop petit, casse 1 dizaine (ou 1 centaine…) du nombre du haut.'
        : 'Calcule colonne par colonne en commençant par la droite. Si le chiffre du haut est trop petit, ajoute 10 en haut et 1 en bas dans la colonne suivante.';
      if (data) { const res = euro(data.result, spec.unit); explain = `${prompt} = ${res}. Vérifie : ${res} + ${euro(spec.b, spec.unit)} = ${euro(spec.a, spec.unit)}.`; }
    } else if (kind === 'mul') {
      const swapped = spec.top !== spec.x;
      data = buildMul(spec.top, spec.bot, spec.unit, swapped); lo = levelMul(spec.top, spec.bot);
      ops = `${ascii(spec.x)}x${ascii(spec.y)}`;
      const show = s => euro(s, parse(s).dec ? spec.unit : null);
      prompt = `${show(spec.x)} × ${show(spec.y)}`;
      const nb = parse(spec.bot).s.length, dec = parse(spec.top).dec;
      hint = (nb === 1 ? 'Multiplie chaque chiffre du haut par le chiffre du bas, de droite à gauche, sans oublier les retenues.'
        : 'Une ligne par chiffre du bas : écris d’abord les 0 de la règle des 0, puis multiplie. Additionne enfin les lignes.')
        + (dec ? ' Place la virgule à la fin.' : '');
      if (data) {
        const res = euro(data.result, spec.unit);
        explain = dec ? `${prompt} = ${res} : on a calculé ${f(parse(spec.top).s)} × ${f(spec.bot)} = ${f(BigInt(parse(spec.top).s) * BigInt(spec.bot))}, puis placé la virgule.`
          : `${prompt} = ${res}.`;
      }
    } else {
      const decimal = kind === 'divdec';
      data = buildDiv(spec.n, spec.d, decimal);
      if (data) { lo = levelDiv(spec.n, decimal, data.qDec); delete data.qDec; }
      ops = `${ascii(spec.n)}/${spec.d}`;
      prompt = `${fs(spec.n)} ÷ ${spec.d}`;
      hint = 'Dans la potence : combien de fois le diviseur ? Multiplie, soustrais, puis abaisse le chiffre suivant.'
        + (decimal ? ' Quand il n’y a plus de chiffre à abaisser et qu’il reste quelque chose, mets la virgule au quotient et continue avec des 0.' : '');
      if (data) explain = decimal ? `${prompt} = ${fs(data.result)}. Vérifie : ${fs(data.result)} × ${spec.d} = ${fs(spec.n)}.`
        : `${f(spec.n)} = ${spec.d} × ${f(data.result)} + ${data.remainder}, et ${data.remainder} < ${spec.d} : le quotient est ${f(data.result)}, le reste ${data.remainder}.`;
    }
  } catch (_) { return null; }
  if (!data || !Number.isFinite(lo)) return null;
  const key = `${axis}:${kind}:${ops}${kind === 'sub' ? `:${data.method}` : ''}${spec.unit ? ':euros' : ''}`;
  const item = {
    axis, kind, key, A: r2(clamp(A, lo, lo + SPAN)),
    prompt, answer: data.result, hint: T(hint), explain: T(explain), leitner: false, data
  };
  return { item, lo };
}

export function gen(A, rng, opts = {}) {
  const a = clampA(A);
  const o = opts && typeof opts === 'object' ? opts : {};
  const method = o.subMethod === 'cassage' ? 'cassage' : 'compensation';
  const avoid = toSet(o.avoid);
  const forced = KINDS.includes(o.kind) ? o.kind : null;
  let last = null;
  for (let i = 0; i < TRIES; i++) {
    const kind = forced || pickKind(a, rng);
    const aa = forced ? Math.max(a, KIND_FROM[kind]) : a;
    const spec = sample(kind, aa, rng);
    if (!spec) continue;
    const res = makeItem(kind, spec, method, aa);
    if (!res || res.lo > aa + 1e-9) continue;                 /* hors programme à ce niveau : autre tirage */
    last = res.item;
    if (!avoid.has(res.item.key)) return res.item;
  }
  if (last) return last;
  return makeItem('add', { terms: ['12', '5'] }, method, a).item;   /* filet de sécurité */
}

const NUM_RE = /^(0|[1-9]\d*)(\.\d+)?$/;
export function fromKey(key, A) {
  const m = /^ma\.operations:(add|sub|mul|div|divdec):([0-9.+\-x/]+)((?::[a-z]+)*)$/.exec(String(key || ''));
  if (!m) return null;
  const [, kind, ops, flagStr] = m;
  const flags = flagStr.split(':').filter(Boolean);
  const unit = flags.includes('euros') ? '€' : null;
  const methods = flags.filter(x => SUB_METHODS.includes(x));
  if (flags.some(x => x !== 'euros' && !SUB_METHODS.includes(x))) return null;
  if (kind === 'sub' ? methods.length !== 1 : methods.length) return null;
  const parts = ops.split(OP_ASCII[kind]);
  if (parts.some(x => !NUM_RE.test(x))) return null;
  const nums = parts.map(x => x.replace('.', ','));
  let spec = null;
  if (kind === 'add') spec = parts.length >= 2 && parts.length <= 3 ? { terms: nums, unit } : null;
  else if (kind === 'sub') spec = parts.length === 2 ? { a: nums[0], b: nums[1], unit } : null;
  else if (kind === 'mul') spec = parts.length === 2 ? mulSpec(nums[0], nums[1], unit) : null;
  else spec = parts.length === 2 && /^[2-9]$/.test(parts[1]) && !unit ? { n: nums[0], d: nums[1] } : null;
  if (!spec) return null;
  const res = makeItem(kind, spec, methods[0] || 'compensation', clampA(A));
  return res && res.item.key === key ? res.item : null;
}
