/* Générateur « opérations posées » (js/content/maths/operations.js) — contrat docs/ARCHITECTURE.md §6 et en-tête du
   module (data.grid, data.steps). On JOUE les étapes (on écrit expect dans chaque case demandée), puis on relit la
   feuille : résultat, quotient et reste doivent être exacts (arithmétique BigInt indépendante) ; chaque case cachée
   est dévoilée par exactement une étape ; colonnes alignées ; retenues, marques de compensation et de cassage,
   produits partiels et potence recalculés colonne par colonne. Bornes : rapports de recherche maths-c2 §2.6, §3.6,
   §4.6, §5 ; maths-c3 §5, §8 (recopiées ici indépendamment du générateur). */
import { test, assert } from './_t.mjs';
import { makeRng } from '../js/core/rng.js';
import { fmtNum } from '../js/core/util.js';
import * as O from '../js/content/maths/operations.js';

const NNBSP = '\u202f';
const GRID = Array.from({ length: 57 }, (_, i) => i / 10);
const METHODS = ['compensation', 'cassage'];
const TYPES = ['pad', 'digit', 'carry', 'mark', 'zero', 'comma', 'count', 'quotient', 'product', 'rest', 'bring', 'info'];
const ROLES = ['operand', 'sign', 'rule', 'carry', 'partial', 'result', 'comma', 'quotient', 'divisor', 'sub', 'rest', 'mark'];
const ROW_ROLES = ['carry', 'mark', 'operand', 'rule', 'partial', 'result', 'sub', 'rest'];
const SIGN = { add: '+', sub: '−', mul: '×', div: '÷', divdec: '÷' };

/* ---------- décimaux exacts (BigInt mis à l'échelle) ---------- */
const P = str => { const [i, d = ''] = String(str).split(','); return { v: BigInt(i + d), d: d.length, int: i, frac: d }; };
const up = (x, D) => x.v * 10n ** BigInt(D - x.d);
const show = (v, D) => { let s = v.toString(); if (!D) return s; s = s.padStart(D + 1, '0'); return `${s.slice(0, -D)},${s.slice(-D)}`; };
const sameValue = (a, b) => { const x = P(a), y = P(b), D = Math.max(x.d, y.d); return up(x, D) === up(y, D); };
const decimalsOf = s => (String(s).split(',')[1] || '').length;
const intDigits = s => String(s).split(',')[0].length;
const fieldCap = A => (A < 0.2 ? 20 : A < 0.4 ? 59 : A < 1 ? 100 : A < 2 ? 1000 : A < 3 ? 10000 : A < 3.4 ? 9999 : A < 4.4 ? 999999 : 999999999);

/* ---------- textes ---------- */
const NUM = String.raw`\d{1,3}(?:\u202f\d{3})*(?:,\d+)?`;
const OPR = '[+−×÷]';
const EXPR = `(?:${NUM})(?: ${OPR} (?:${NUM}))*`;
const LB = String.raw`(?<![\d(]|\d,|\d\u202f)`, LA = String.raw`(?![\d)]|,\d|\u202f\d)`;
function evalFr(e) {
  const t = e.split(' ');
  const val = s => { const x = P(s.replace(/\u202f/g, '')); return { n: x.v, d: 10n ** BigInt(x.d) }; };
  const mul = (a, b) => ({ n: a.n * b.n, d: a.d * b.d }), div = (a, b) => ({ n: a.n * b.d, d: a.d * b.n });
  const add = (a, b, s) => ({ n: a.n * b.d + s * b.n * a.d, d: a.d * b.d });
  const terms = [val(t[0])], ops = [];
  for (let i = 1; i < t.length; i += 2) {
    const o = t[i], v = val(t[i + 1]);
    if (o === '×' || o === '÷') terms.push((o === '×' ? mul : div)(terms.pop(), v)); else { ops.push(o); terms.push(v); }
  }
  return ops.reduce((acc, o, i) => add(acc, terms[i + 1], o === '+' ? 1n : -1n), terms[0]);
}
const eqQ = (a, b) => a.n * b.d === b.n * a.d;
/* toute chaîne « e1 = e2 (= e3) » d'un texte est vraie (les « € » sont ignorés) */
function checkEqualities(text, ctx) {
  const s = text.replace(new RegExp(`${NNBSP}€`, 'g'), '');
  const re = new RegExp(`${LB}(${EXPR})((?: = ${EXPR})+)${LA}`, 'g');
  let m;
  while ((m = re.exec(s))) {
    const parts = m[0].split(' = ').map(evalFr);
    for (const p of parts.slice(1)) assert.ok(eqQ(p, parts[0]), `égalité fausse « ${m[0]} » (${ctx})`);
  }
  const ineq = new RegExp(`${LB}(${EXPR}) (<|≤) (${EXPR})${LA}`, 'g');
  while ((m = ineq.exec(s))) {
    const a = evalFr(m[1]), b = evalFr(m[3]), lhs = a.n * b.d, rhs = b.n * a.d;
    assert.ok(m[2] === '<' ? lhs < rhs : lhs <= rhs, `inégalité fausse « ${m[0]} » (${ctx})`);
  }
}
function checkText(s, ctx) {
  assert.equal(typeof s, 'string', ctx);
  assert.ok(s.length > 3, `texte vide (${ctx})`);
  assert.ok(!/undefined|NaN|null|\[object|Infinity/.test(s), `texte invalide « ${s} » (${ctx})`);
  assert.ok(!/'/.test(s), `apostrophe droite dans « ${s} »`);
  assert.ok(!/ [?!;:]/.test(s), `espace ordinaire avant ? ! ; : dans « ${s} »`);
  assert.ok(!/\S[?!;:]/.test(s.replace(new RegExp(NNBSP + '[?!;:]', 'g'), '')), `ponctuation haute collée dans « ${s} »`);
  assert.ok(!/ {2}/.test(s), `double espace dans « ${s} »`);
  assert.ok(!/\d ?-\d|(^|[^a-zé+])-\d/.test(s), `tiret au lieu du signe moins dans « ${s} »`);
  assert.ok(!/\d\.\d/.test(s), `point décimal dans « ${s} »`);
  assert.ok(!/(?<![\d,])\d{4,}/.test(s), `nombre sans espace des milliers dans « ${s} »`);
  assert.ok(/^[A-ZÀÉÈ0-9]/.test(s), `majuscule initiale dans « ${s} »`);
  assert.ok(/[.?!]$/.test(s), `ponctuation finale dans « ${s} »`);
  checkEqualities(s, ctx);
}

/* ---------- jouer les étapes ---------- */
const K = c => `${c.r},${c.c},${c.pos || ''}`;
function play(it, ctx) {
  const { grid, steps } = it.data;
  assert.ok(Number.isInteger(grid.rows) && Number.isInteger(grid.cols) && grid.rows > 0 && grid.cols > 0, ctx);
  assert.equal(grid.rowInfo.length, grid.rows, `${ctx} rowInfo`);
  for (const ri of grid.rowInfo) { assert.ok(ROW_ROLES.includes(ri.role), `${ctx} rôle de ligne ${ri.role}`); assert.equal(typeof ri.small, 'boolean'); }
  const byKey = new Map();
  for (const c of grid.cells) {
    assert.ok(!byKey.has(K(c)), `${ctx} case en double ${K(c)}`);
    byKey.set(K(c), c);
    assert.ok(c.r >= 0 && c.r < grid.rows && c.c >= 0 && c.c < grid.cols, `${ctx} case hors grille ${K(c)}`);
    assert.ok(ROLES.includes(c.role), `${ctx} rôle ${c.role}`);
    for (const k of ['small', 'hidden', 'strike']) assert.equal(typeof c[k], 'boolean', `${ctx} ${k}`);
    assert.ok(c.ch.length === 1 || (c.ch === '+1' && c.role === 'mark'), `${ctx} un caractère par case : « ${c.ch} »`);
    if (c.pos) { assert.ok(['avant', 'apres'].includes(c.pos)); assert.ok(byKey.has(`${c.r},${c.c},`) || grid.cells.some(x => x.r === c.r && x.c === c.c && !x.pos), `${ctx} annotation sans chiffre ${K(c)}`); }
    if (c.pos === 'apres') assert.ok(c.role === 'comma' && c.ch === ',', ctx);
    if (c.pos === 'avant') assert.ok(c.role === 'mark' && c.ch === '1' && c.small, ctx);
    if (c.role === 'carry' || c.role === 'mark') assert.ok(c.small, `${ctx} annotation en petit`);
    if (/^(operand|partial|result|quotient|divisor|sub|rest|carry)$/.test(c.role)) assert.match(c.ch, /^\d$/, `${ctx} chiffre ${c.role}`);
    if (c.role === 'rule') assert.ok(['─', '│', '├'].includes(c.ch), ctx);
    if (c.from) { const src = grid.cells.find(x => x.r === c.from.r && x.c === c.from.c && !x.pos); assert.ok(src && src.ch === c.ch && src.c === c.c, `${ctx} chiffre abaissé ${K(c)} ≠ sa source`); }
  }
  const revealed = new Map(), struck = new Map();
  let asks = 0;
  for (const st of steps) {
    const sx = `${ctx} ${st.id}`;
    assert.ok(TYPES.includes(st.type), `${sx} type ${st.type}`);
    for (const r of [...st.cells, ...st.focus, ...st.strike]) assert.ok(byKey.has(K(r)), `${sx} désigne une case inexistante ${K(r)}`);
    for (const r of st.cells) { assert.ok(byKey.get(K(r)).hidden, `${sx} dévoile une case déjà visible ${K(r)}`); revealed.set(K(r), (revealed.get(K(r)) || 0) + 1); }
    for (const r of st.strike) struck.set(K(r), (struck.get(K(r)) || 0) + 1);
    checkText(st.say, `${sx} say`);
    if (st.ask) {
      asks++;
      assert.match(st.expect, /^\d$/, `${sx} un seul chiffre attendu`);
      if (st.type === 'count') assert.equal(st.cells.length, 0, sx);
      else {
        assert.ok(['digit', 'quotient', 'rest'].includes(st.type), sx);
        assert.equal(st.cells.length, 1, `${sx} une case à écrire`);
        assert.equal(byKey.get(K(st.cells[0])).ch, st.expect, `${sx} la case reçoit le chiffre attendu`);
      }
      checkText(st.prompt, `${sx} prompt`); checkText(st.hint, `${sx} hint`);
      assert.ok(st.prompt.endsWith('?'), `${sx} question`);
      assert.ok(!/je pose|j’écris/.test(st.prompt + st.hint), `${sx} la question ou l'indice donnent la réponse`);
    } else {
      assert.equal(st.expect, null, sx); assert.equal(st.prompt, null, sx); assert.equal(st.hint, null, sx);
      assert.ok(!['quotient', 'rest', 'count'].includes(st.type), `${sx} étape automatique ${st.type}`);
    }
  }
  for (const c of grid.cells) {
    if (c.hidden) assert.equal(revealed.get(K(c)), 1, `${ctx} case cachée ${K(c)} « ${c.ch} » dévoilée ${revealed.get(K(c)) || 0} fois`);
    assert.equal(struck.get(K(c)) || 0, c.strike ? 1 : 0, `${ctx} case ${K(c)} barrée ${struck.get(K(c)) || 0} fois`);
    if (/^(result|partial|quotient)$/.test(c.role) && c.hidden && !c.zero) {
      const st = steps.find(s => s.cells.some(r => K(r) === K(c)));
      assert.ok(st.ask, `${ctx} le chiffre ${K(c)} du résultat est écrit par l'enfant`);
    }
  }
  assert.ok(asks >= 1, ctx);
  const at = (r, c, pos) => byKey.get(`${r},${c},${pos || ''}`) || null;
  return { at, byKey };
}
/* lit une ligne de nombre (chiffres + virgule attachée) */
function readRow(g, at, r, roles) {
  let s = '';
  for (let c = 0; c < g.cols; c++) {
    const x = at(r, c);
    if (x && roles.includes(x.role)) s += x.ch;
    if (at(r, c, 'apres')) s += ',';
  }
  return s;
}
const digitCells = (g, r, roles) => g.cells.filter(c => c.r === r && !c.pos && roles.includes(c.role)).sort((a, b) => a.c - b.c);

/* ---------- vérifications propres à chaque opération ---------- */
function exactResult(it) {
  const o = it.data.operands.map(P);
  if (it.kind === 'add') { const D = Math.max(...o.map(x => x.d)); return show(o.reduce((s, x) => s + up(x, D), 0n), D); }
  if (it.kind === 'sub') { const D = Math.max(o[0].d, o[1].d); return show(up(o[0], D) - up(o[1], D), D); }
  if (it.kind === 'mul') return show(o[0].v * o[1].v, o[0].d + o[1].d);
  const N = o[0], d = o[1].v;
  if (it.kind === 'div') return { q: (N.v / d).toString(), r: (N.v % d).toString() };
  const scaledN = N.v * 10n ** BigInt(2 - N.d);
  assert.equal(scaledN % d, 0n, `${it.key} quotient exact au centième`);
  return show(scaledN / d, 2);
}
function checkAddLike(g, at, opRows, carryRow, resRow, ctx, rankShift = 0) {
  /* colonne par colonne de droite à gauche : chiffres (zéros pâles compris) + retenue → chiffre du résultat, retenue suivante */
  const digit = (r, c) => { const x = at(r, c); return x && /^(operand|partial|result)$/.test(x.role) ? Number(x.ch) : null; };
  const minCol = Math.min(...opRows.flatMap(r => digitCells(g, r, ['operand', 'partial']).map(x => x.c)));
  for (let c = g.cols - 1; c >= minCol; c--) {
    const carryIn = at(carryRow, c) ? Number(at(carryRow, c).ch) : 0;
    const s = opRows.reduce((t, r) => t + (digit(r, c) ?? 0), 0) + carryIn;
    const res = digit(resRow, c);
    assert.equal(res, s % 10, `${ctx} colonne ${c} : ${s} → ${res}`);
    const out = Math.floor(s / 10);
    if (c > minCol) assert.equal(at(carryRow, c - 1) ? Number(at(carryRow, c - 1).ch) : 0, out, `${ctx} retenue de la colonne ${c}`);
    else if (out) assert.equal(digit(resRow, c - 1), out, `${ctx} retenue finale écrite dans le résultat`);
    else assert.equal(digit(resRow, c - 1), null, `${ctx} pas de chiffre en trop`);
  }
  void rankShift;
}
function checkAlignedNumbers(g, at, rows, D, ctx) {
  /* unités sous les unités : même colonne de virgule (D > 0) ou même dernier chiffre (D = 0) */
  const ref = [];
  for (const r of rows) {
    const ds = digitCells(g, r, ['operand', 'result']);
    if (D) {
      const commas = g.cells.filter(c => c.r === r && c.pos === 'apres');
      assert.equal(commas.length, 1, `${ctx} une virgule sur la ligne ${r}`);
      ref.push(commas[0].c);
      assert.equal(ds.filter(x => x.c > commas[0].c).length, D, `${ctx} ${D} chiffres après la virgule ligne ${r}`);
    } else ref.push(ds[ds.length - 1].c);
  }
  assert.equal(new Set(ref).size, 1, `${ctx} colonnes alignées ${ref}`);
}
function checkSub(it, g, at, ctx) {
  const comp = it.data.method === 'compensation';
  const rTop = comp ? 0 : 1, rBot = comp ? 1 : 2, rMark = comp ? 2 : 0, rRes = 4;
  const a = P(it.data.operands[0]), b = P(it.data.operands[1]), D = Math.max(a.d, b.d);
  const val = (r, c) => { const x = at(r, c); return x && /^(operand|result)$/.test(x.role) ? Number(x.ch) : null; };
  const cols = digitCells(g, rTop, ['operand']).map(x => x.c);
  let topSum = 0n, botSum = 0n;
  for (const c of cols) {
    const p = g.cols - 1 - c - D, w = 10n ** BigInt(p + D);
    let t, bt = val(rBot, c) ?? 0;
    if (comp) {
      t = val(rTop, c) + (at(rTop, c, 'avant') ? 10 : 0);
      if (at(rMark, c)) { assert.equal(at(rMark, c).ch, '+1', ctx); bt += 1; }
      assert.equal(!!at(rTop, c, 'avant'), !!at(rMark, c - 1), `${ctx} compensation : 10 en haut ⇔ +1 en bas à gauche (colonne ${c})`);
      assert.ok(!g.cells.some(x => x.strike), `${ctx} rien n'est barré en compensation`);
    } else {
      const top = at(rTop, c), mark = at(rMark, c);
      if (mark) assert.ok(top.strike, `${ctx} cassage : le chiffre réécrit au-dessus est barré`);
      t = mark ? Number(mark.ch) : top.strike ? 0 : Number(top.ch);
      if (mark ? at(rMark, c, 'avant') : at(rTop, c, 'avant')) t += 10;
      if (top.strike && mark) assert.equal(Number(mark.ch), (Number(top.ch) + 9) % 10, `${ctx} cassage : ${top.ch} → ${mark.ch}`);
      assert.ok(!at(rTop, c, 'avant') || !mark, `${ctx} le « 1 » se place devant le chiffre courant`);
    }
    const d = t - bt;
    assert.ok(d >= 0 && d <= 9, `${ctx} colonne ${c} : ${t} − ${bt}`);
    const res = val(rRes, c);
    if (res === null) assert.equal(d, 0, `${ctx} seul un 0 de tête n'est pas écrit`); else assert.equal(res, d, `${ctx} colonne ${c}`);
    topSum += BigInt(t) * w; botSum += BigInt(bt) * w;
  }
  if (!comp) assert.equal(topSum, up(a, D), `${ctx} cassage : le nombre du haut garde sa valeur`);
  else assert.equal(topSum - botSum, up(a, D) - up(b, D), `${ctx} compensation : l'écart ne change pas`);
}
function checkMul(it, g, at, ctx) {
  const info = g.rowInfo, rA = info.findIndex(x => x.role === 'operand'), rB = rA + 1, m = rA;
  const [top, bot] = it.data.operands;
  assert.ok(P(bot).d === 0, `${ctx} le multiplicateur est entier`);
  assert.ok(P(bot).v.toString().length <= P(top).v.toString().length, `${ctx} le nombre qui a le moins de chiffres en 2e ligne`);
  const aDigits = digitCells(g, rA, ['operand']), bDigits = digitCells(g, rB, ['operand']);
  assert.equal(aDigits.map(x => x.ch).join(''), P(top).v.toString(), ctx);
  assert.equal(bDigits.map(x => x.ch).join(''), P(bot).v.toString(), ctx);
  assert.equal(aDigits[aDigits.length - 1].c, g.cols - 1, `${ctx} alignés à droite`); assert.equal(bDigits[bDigits.length - 1].c, g.cols - 1, ctx);
  const partRows = m === 1 ? [g.rows - 1] : info.map((x, i) => (x.role === 'partial' ? i : -1)).filter(i => i >= 0);
  assert.equal(partRows.length, m, `${ctx} une ligne par chiffre non nul du multiplicateur`);
  const bd = [...P(bot).v.toString()].reverse().map(Number);
  let t = 0;
  bd.forEach((dj, j) => {
    if (!dj) return;
    const pr = partRows[t], cr = m - 1 - t;
    const ds = digitCells(g, pr, ['partial', 'result']);
    assert.equal(ds[ds.length - 1].c, g.cols - 1, `${ctx} produit partiel aligné à droite`);
    const zeros = ds.filter(x => x.zero);
    assert.equal(zeros.length, j, `${ctx} règle des 0 : ${j} zéro(s) écrit(s)`);
    for (const z of zeros) { assert.equal(z.ch, '0'); assert.ok(z.c > g.cols - 1 - j - 1 + 0, ctx); }
    assert.equal(BigInt(ds.map(x => x.ch).join('')), P(top).v * BigInt(dj) * 10n ** BigInt(j), `${ctx} produit partiel par ${dj}`);
    let carry = 0;
    for (let i = 0; i < aDigits.length; i++) {
      const ac = g.cols - 1 - i, ai = Number(at(rA, ac).ch);
      const cin = at(cr, ac) ? Number(at(cr, ac).ch) : 0;
      assert.equal(cin, carry, `${ctx} retenue au-dessus du chiffre ${ai}`);
      const v = ai * dj + carry;
      assert.equal(Number(at(pr, g.cols - 1 - i - j).ch), v % 10, `${ctx} ${dj} × ${ai} + ${carry}`);
      carry = Math.floor(v / 10);
    }
    if (carry) assert.equal(Number(at(pr, g.cols - 1 - aDigits.length - j).ch), carry, `${ctx} retenue finale du produit partiel`);
    t++;
  });
  if (m > 1) {
    const rCarry = info.findIndex((x, i) => i > rB && x.role === 'carry');
    checkAddLike(g, at, partRows, rCarry, g.rows - 1, `${ctx} somme des produits partiels`);
  }
  const res = readRow(g, at, g.rows - 1, ['result']);
  assert.equal(decimalsOf(res), P(top).d, `${ctx} autant de décimales que le facteur décimal`);
}
function checkDiv(it, g, at, ctx) {
  const [nStr, dStr] = it.data.operands, d = Number(dStr);
  assert.ok(/^[2-9]$/.test(dStr), `${ctx} diviseur à un chiffre (2 à 9)`);
  assert.ok(P(nStr).v.toString().length <= 5, `${ctx} dividende de 5 chiffres au plus`);
  const V = g.cells.find(c => c.ch === '├').c;
  assert.equal(at(1, V).ch, '├', ctx);
  for (let r = 0; r < g.rows; r++) assert.ok(at(r, V) && at(r, V).role === 'rule', `${ctx} trait vertical ligne ${r}`);
  assert.equal(at(0, V + 1).role, 'divisor', ctx); assert.equal(at(0, V + 1).ch, dStr, ctx);
  const qCells = digitCells(g, 2, ['quotient']);
  assert.equal(qCells[0].c, V + 1, `${ctx} quotient sous le diviseur`);
  const dividend = digitCells(g, 0, ['operand']);
  assert.equal(dividend[0].c, 1, ctx);
  dividend.forEach((x, i) => assert.equal(x.c, 1 + i, `${ctx} dividende en colonnes consécutives`));
  const nq = qCells.length;
  assert.equal(g.rows, 1 + 2 * nq, `${ctx} une soustraction écrite par chiffre du quotient`);
  /* tranche 1 : le plus petit début du dividende qui contient le diviseur */
  let cur = 0, e = 0;
  while (cur < d) { cur = cur * 10 + Number(dividend[e].ch); e++; }
  for (let t = 0; t < nq; t++) {
    const q = Number(qCells[t].ch), col = e;               /* colonne du dernier chiffre de la tranche */
    assert.equal(q, Math.floor(cur / d), `${ctx} chiffre ${t + 1} du quotient : dans ${cur}, ${Math.floor(cur / d)} fois ${d}`);
    const prod = digitCells(g, 1 + 2 * t, ['sub']);
    assert.equal(Number(prod.map(x => x.ch).join('')), q * d, `${ctx} produit ${q} × ${d} écrit`);
    assert.equal(prod[prod.length - 1].c, col, `${ctx} produit sous la tranche`);
    const sign = at(1 + 2 * t, prod[0].c - 1);
    assert.ok(sign && sign.role === 'sign' && sign.ch === '−', `${ctx} signe − de la soustraction`);
    const rest = at(2 + 2 * t, col);
    assert.ok(rest && rest.role === 'rest', `${ctx} reste sous les unités du produit`);
    assert.equal(Number(rest.ch), cur - q * d, `${ctx} reste ${cur} − ${q * d}`);
    assert.ok(Number(rest.ch) < d, `${ctx} reste < diviseur`);
    if (t < nq - 1) {
      const br = at(2 + 2 * t, col + 1);
      assert.ok(br && br.from && br.from.r === 0 && br.from.c === col + 1, `${ctx} chiffre abaissé dans sa colonne`);
      cur = Number(rest.ch) * 10 + Number(br.ch); e = col + 1;
    } else { const nx = at(2 + 2 * t, col + 1); assert.ok(!nx || nx.role === 'rule', `${ctx} rien d’abaissé après le dernier chiffre`); }
  }
}

/* ---------- vérification complète d'un item ---------- */
function checkItem(it, A, ctx, method = 'compensation') {
  assert.equal(it.axis, 'ma.operations', ctx);
  assert.ok(O.KINDS.includes(it.kind), `${ctx} kind`);
  assert.ok(!/undefined|NaN|Infinity/.test(JSON.stringify(it)), `${ctx} valeur invalide`);
  assert.ok(Number.isFinite(it.A) && it.A >= 0 && it.A <= 5.6, `${ctx} A`);
  assert.equal(it.leitner, false, ctx);
  const d = it.data;
  assert.equal(d.op, SIGN[it.kind], ctx);
  assert.equal(it.answer, d.result, `${ctx} answer = result`);
  assert.equal(d.method, { add: 'colonnes', sub: method, mul: 'zeros', div: 'potence', divdec: 'potence' }[it.kind], `${ctx} méthode`);
  assert.ok([null, '€'].includes(d.unit), ctx);
  for (const o of d.operands) assert.match(o, /^(0|[1-9]\d*)(,\d+)?$/, `${ctx} opérande « ${o} »`);
  /* énoncé, clé */
  const shown = d.operands.map(o => fmtNum(Number(o.replace(',', '.')), decimalsOf(o) || undefined));
  const keyOps = it.key.split(':')[2];
  assert.match(it.key, new RegExp(`^ma\\.operations:${it.kind}:[0-9.+\\-x/]+${it.kind === 'sub' ? `:${method}` : ''}${d.unit ? ':euros' : ''}$`), `${ctx} clé ${it.key}`);
  const promptNums = it.prompt.replace(new RegExp(`${NNBSP}€`, 'g'), '').split(/ [+−×÷] /);
  if (it.kind === 'mul') assert.deepEqual([...promptNums].sort(), [...shown].sort(), `${ctx} énoncé ↔ opérandes`);
  else assert.deepEqual(promptNums, shown, `${ctx} énoncé ↔ opérandes`);
  assert.equal(keyOps.split(/[+\-x/]/).map(x => fmtNum(Number(x), decimalsOf(x.replace('.', ',')) || undefined)).join('|'), promptNums.join('|'), `${ctx} clé ↔ énoncé`);
  assert.ok(it.prompt.includes(` ${SIGN[it.kind]} `), ctx);
  checkText(it.hint, `${ctx} hint`); checkText(it.explain, `${ctx} explain`);
  /* jouer, relire */
  const g = d.grid, { at } = play(it, ctx);
  const exact = exactResult(it);
  if (it.kind === 'div') {
    assert.equal(d.result, exact.q, `${ctx} quotient`); assert.equal(d.remainder, exact.r, `${ctx} reste`);
    assert.equal(readRow(g, at, 2, ['quotient']), d.result, `${ctx} quotient lu dans la potence`);
    assert.equal(at(g.rows - 1, digitCells(g, g.rows - 1, ['rest']).pop().c).ch, d.remainder, `${ctx} reste lu`);
    checkDiv(it, g, at, ctx);
  } else if (it.kind === 'divdec') {
    assert.ok(sameValue(d.result, exact), `${ctx} quotient ${d.result} ≠ ${exact}`);
    assert.equal(d.remainder, null, ctx);
    assert.ok(decimalsOf(d.result) >= 1 && decimalsOf(d.result) <= 2, `${ctx} quotient décimal au centième au plus`);
    assert.ok(!/,\d*0$/.test(d.result), ctx);
    assert.equal(readRow(g, at, 2, ['quotient']), d.result, `${ctx} quotient lu dans la potence`);
    assert.equal(digitCells(g, g.rows - 1, ['rest']).pop().ch, '0', `${ctx} reste nul`);
    checkDiv(it, g, at, ctx);
  } else {
    assert.ok(sameValue(d.result, exact), `${ctx} résultat ${d.result} ≠ ${exact}`);
    assert.equal(readRow(g, at, g.rows - 1, ['result']), d.result, `${ctx} résultat lu sur la feuille`);
    if (!d.unit && decimalsOf(d.result)) assert.ok(!/0$/.test(d.result), `${ctx} pas de 0 inutile au résultat`);
    if (it.kind === 'add' || it.kind === 'sub') {
      const D = Math.max(...d.operands.map(decimalsOf));
      const numRows = g.rowInfo.map((x, i) => (x.role === 'operand' || x.role === 'result' ? i : -1)).filter(i => i >= 0);
      checkAlignedNumbers(g, at, numRows, D, ctx);
      if (it.kind === 'add') checkAddLike(g, at, numRows.slice(0, -1), 0, g.rows - 1, ctx);
      else checkSub(it, g, at, ctx);
      numRows.slice(1, -1).forEach(r => assert.equal(at(r, 0).ch, SIGN[it.kind], `${ctx} signe en colonne 0`));
    } else checkMul(it, g, at, ctx);
  }
  return d;
}
/* bornes du programme au niveau réel de l'item */
function checkBounds(it, ctx) {
  const A = it.A + 1e-9, d = it.data, ops = d.operands, k = it.kind;
  const nums = k === 'div' || k === 'divdec' ? [ops[0], d.result] : [...ops, d.result];
  for (const n of nums) assert.ok(Number(n.split(',')[0]) <= fieldCap(A), `${ctx} ${n} hors du champ numérique à A=${it.A}`);
  const decs = Math.max(...ops.map(decimalsOf));
  /* v2.5 (calendrier, décisions du parent du 07/10/2026) : quotient décimal au CM2 en P2 (4,2), dividende décimal en
     P3 (4,4) ; montants en euros au CE2 « au plus tard en période 2 » (2,2) */
  assert.ok(it.A >= { add: 0, sub: 1.5, mul: 2.6, div: 3.2, divdec: 4.2 }[k] - 1e-9, `${ctx} ${k} avant sa classe`);
  if (k === 'divdec' && (decimalsOf(ops[0]) || P(ops[0]).v.toString().length >= 5)) assert.ok(A >= 4.4, `${ctx} dividende décimal en P3`);
  if (decs) {
    if (d.unit) assert.ok(A >= (k === 'add' ? 2.2 : k === 'sub' ? 2.7 : 3.3) && decs === 2, `${ctx} montants en euros`);
    else assert.ok(A >= (k === 'divdec' ? 4.4 : 3.3), `${ctx} décimaux au CM`);
    if (decs === 3) assert.ok(A >= 4, `${ctx} millièmes au CM2`);
  }
  if (k === 'add') {
    if (ops.length === 3) assert.ok(A >= 1.3, `${ctx} 3 nombres au CE1`);
    if (A < 1) assert.ok(ops.length === 2 && ops.every(o => o.length <= 2), `${ctx} CP : 2 nombres à 1 ou 2 chiffres`);
  }
  if (k === 'sub' && it.A < 1.7) {
    const a = ops[0], b = ops[1].padStart(a.length, '0');
    assert.ok([...a].every((ch, i) => Number(ch) >= Number(b[i])), `${ctx} pas de retenue avant 1,7`);
  }
  if (k === 'mul') {
    const na = P(ops[0]).v.toString().length, nb = P(ops[1]).v.toString().length;
    if (A < 3) assert.ok(na <= 3 && nb <= 2, `${ctx} CE2 : 2-3 chiffres × 1-2 chiffres`);
    if (nb >= 2) assert.ok(A >= 2.8, `${ctx} × 2 chiffres après × 1 chiffre`);
    if (decs && nb >= 2) assert.ok(A >= 4, `${ctx} décimal × entier à plusieurs chiffres : CM2`);
    if (na === 3 && nb === 3) assert.ok(A >= 3, `${ctx} 876 × 208 : CM1`);
  }
  if (k === 'div' || k === 'divdec') {
    assert.ok(Number(ops[1]) >= 2 && Number(ops[1]) <= 9, `${ctx} diviseur à 1 chiffre`);
    assert.ok(P(ops[0]).v.toString().length <= 5, `${ctx} dividende ≤ 5 chiffres`);
    if (k === 'div') assert.equal(decimalsOf(ops[0]), 0, ctx);
  }
}

/* ---------- tests ---------- */
test('opérations : exports du contrat', () => {
  assert.equal(O.axis, 'ma.operations');
  for (const fn of ['gen', 'fromKey']) assert.equal(typeof O[fn], 'function', fn);
  assert.deepEqual(O.KINDS, ['add', 'sub', 'mul', 'div', 'divdec']);
  assert.deepEqual(O.SUB_METHODS, ['compensation', 'cassage']);
});

test('opérations : déterminisme (gen, méthodes, fromKey)', () => {
  for (const A of GRID) for (let s = 0; s < 8; s++) for (const subMethod of METHODS)
    assert.deepEqual(O.gen(A, makeRng(`d${s}`), { subMethod }), O.gen(A, makeRng(`d${s}`), { subMethod }), `A=${A}`);
  for (const k of ['ma.operations:add:347+58', 'ma.operations:sub:364-18:cassage', 'ma.operations:mul:876x208', 'ma.operations:divdec:785/4'])
    assert.deepEqual(O.fromKey(k, 4), O.fromKey(k, 4), k);
});

test('opérations : des milliers d’opérations jouées étape par étape, exactes et dans le programme (57 niveaux × 2 méthodes × 70 graines)', () => {
  const count = {};
  for (const subMethod of METHODS) for (const A of GRID) for (let s = 0; s < 70; s++) {
    const it = O.gen(A, makeRng(`g${A}|${s}|${subMethod}`), { subMethod });
    const ctx = `A=${A} s=${s} ${subMethod} « ${it.prompt} »`;
    checkItem(it, A, ctx, subMethod);
    checkBounds(it, ctx);
    assert.ok(it.A <= A + 1e-9, `${ctx} niveau réel ${it.A} ≤ demandé`);
    /* la potence tient sur un téléphone : ≤ 12 colonnes (euclidienne), ≤ 13 (décimale) avant 5, ≤ 16 ensuite */
    if (it.kind === 'div') assert.ok(it.data.grid.cols <= 12, `${ctx} ${it.data.grid.cols} colonnes`);
    if (it.kind === 'divdec') assert.ok(it.data.grid.cols <= (A < 5 ? 13 : 16), `${ctx} ${it.data.grid.cols} colonnes`);
    if (it.kind !== 'div' && it.kind !== 'divdec') assert.ok(it.data.grid.cols <= 10, `${ctx} ${it.data.grid.cols} colonnes`);
    count[it.kind] = (count[it.kind] || 0) + 1;
  }
  for (const A of [0.29, 0.3, 0.59, 0.6, 0.99, 1, 1.19, 1.2, 1.29, 1.3, 1.49, 1.5, 1.69, 1.7, 1.84, 1.85, 1.99, 2, 2.19, 2.2, 2.39, 2.4, 2.59, 2.6, 2.69, 2.79, 2.8, 2.99, 3, 3.19, 3.2, 3.29, 3.3, 3.39, 3.4, 3.79, 3.8, 3.99, 4, 4.19, 4.2, 4.29, 4.3, 4.39, 4.4, 4.99, 5, 5.6])
    for (const subMethod of METHODS) for (let s = 0; s < 40; s++) {
      const it = O.gen(A, makeRng(`e${A}|${s}`), { subMethod });
      const ctx = `A=${A} ${subMethod} « ${it.prompt} »`;
      checkItem(it, A, ctx, subMethod); checkBounds(it, ctx); assert.ok(it.A <= A + 1e-9, ctx);
    }
  console.log(`    opérations : ${Object.entries(count).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
});

test('opérations : chaque opération arrive à son palier', () => {
  const kindsIn = (A0, A1, n = 1200) => {
    const c = {};
    for (let s = 0; s < n; s++) { const it = O.gen(A0 + (A1 - A0) * ((s % 40) / 40), makeRng(`p${A0}|${s}`)); c[it.kind] = (c[it.kind] || 0) + 1; }
    return c;
  };
  const cp = kindsIn(0, 1), ce1a = kindsIn(1, 1.5), ce1b = kindsIn(1.5, 2), ce2a = kindsIn(2, 2.6), ce2b = kindsIn(2.6, 3), cm1a = kindsIn(3, 3.2), cm1b = kindsIn(3.2, 4), cm2 = kindsIn(4, 5), adv = kindsIn(5, 5.6);
  assert.deepEqual(Object.keys(cp), ['add'], 'CP : addition seulement');
  assert.deepEqual(Object.keys(ce1a), ['add'], 'CE1 début : addition seulement');
  assert.ok(ce1b.sub > 300 && !ce1b.mul, 'CE1 P3 : soustraction posée');
  assert.ok(ce2a.add && ce2a.sub && !ce2a.mul, 'CE2 début : + et −');
  assert.ok(ce2b.mul > 300 && !ce2b.div, 'CE2 P4 : multiplication posée, pas de division');
  assert.ok(cm1a.mul && !cm1a.div, 'CM1 début : pas encore de division');
  assert.ok(cm1b.div > 200 && !cm1b.divdec, 'CM1 : division euclidienne');
  assert.ok(cm2.divdec > 200 && cm2.div > 50, 'CM2 : division décimale');
  assert.ok(adv.divdec && adv.mul && adv.add && adv.sub, 'au-delà : mélange');
  /* exemples des programmes et des Exemples de réussite */
  const ex = [
    ['add:45+37', '82', 0.6], ['add:28+8+56', '92', 1.3], ['add:245+437', '682', 1.2], ['add:76+7+568', '651', 1.3],
    ['sub:578-241:compensation', '337', 1.6], ['sub:72-47:cassage', '25', 1.7], ['sub:364-18:compensation', '346', 1.7],
    ['sub:4354-3366:cassage', '988', 2], ['add:672+9816', '10488', 3.4], ['add:4.56+15.30:euros', '19,86', 2.2],
    ['sub:74.36-12.50:compensation:euros', '61,86', 2.7], ['mul:16x548', '8768', 2.9], ['mul:305x5', '1525', 2.7],
    ['mul:418x23', '9614', 2.9], ['mul:876x208', '182208', 3.4], ['mul:7x46.55:euros', '325,85', 3.3],
    ['mul:8x17.3', '138,4', 3.3], ['add:56.75+234+0.8', '291,55', 3.3], ['sub:34.5-2.58:cassage', '31,92', 3.3],
    ['div:9456/7', '1350', 3.5], ['div:2458/6', '409', 3.5], ['mul:8.76x208', '1822,08', 4], ['divdec:785/4', '196,25', 4.3],
    ['divdec:148.2/5', '29,64', 4.4], ['divdec:9855/6', '1642,5', 4.2], ['divdec:7854/8', '981,75', 4.3], ['divdec:986.3/5', '197,26', 4.4]
  ];
  for (const [k, res, lo] of ex) {
    const it = O.fromKey('ma.operations:' + k, 5.6);
    assert.ok(it, `exemple officiel ${k}`);
    assert.equal(it.data.result, res, `${k} → ${res}`);
    const low = O.fromKey('ma.operations:' + k, 0);
    assert.ok(Math.abs(low.A - lo) < 1e-9, `${k} : niveau réel ${low.A}, attendu ${lo}`);
    checkItem(it, 5.6, k, k.includes('cassage') ? 'cassage' : 'compensation');
  }
  assert.equal(O.fromKey('ma.operations:div:9456/7', 4).data.remainder, '6');
  assert.equal(O.fromKey('ma.operations:div:2458/6', 4).data.remainder, '4');
});

test('opérations : soustraction, les deux techniques sur les mêmes nombres', () => {
  for (const [a, b] of [['364', '18'], ['503', '47'], ['1000', '1'], ['4000', '1257'], ['72', '47'], ['34,5', '2,58'], ['12', '4,75'], ['10003', '9']]) {
    const ops = `${a.replace(',', '.')}-${b.replace(',', '.')}`;
    const c = O.fromKey(`ma.operations:sub:${ops}:compensation`, 5), k = O.fromKey(`ma.operations:sub:${ops}:cassage`, 5);
    assert.ok(c && k, ops);
    checkItem(c, 5, `compensation ${ops}`, 'compensation'); checkItem(k, 5, `cassage ${ops}`, 'cassage');
    assert.equal(c.data.result, k.data.result, ops);
    assert.ok(!c.data.grid.cells.some(x => x.strike), 'compensation : rien de barré');
  }
  /* cassage à travers les zéros : 1 000 − 1 → 1 barré (rien au-dessus), 0 → 9, 0 → 9, le 0 des unités devient 10 */
  const k = O.fromKey('ma.operations:sub:1000-1:cassage', 5);
  const marks = k.data.grid.cells.filter(x => x.role === 'mark');
  assert.deepEqual(marks.filter(x => !x.pos).map(x => x.ch), ['9', '9']);
  assert.equal(marks.filter(x => x.pos === 'avant').length, 1);
  assert.equal(k.data.grid.cells.filter(x => x.strike).length, 3);
  assert.equal(k.data.steps.filter(s => s.type === 'mark').length, 1, 'un seul cassage en cascade');
  assert.match(k.data.steps.find(s => s.type === 'mark').say, /il n’y a ni dizaine ni centaine à casser/);
  /* compensation : « 1 » devant le chiffre du haut et « +1 » sous la colonne suivante */
  const c = O.fromKey('ma.operations:sub:364-18:compensation', 5);
  const one = c.data.grid.cells.find(x => x.pos === 'avant'), plus = c.data.grid.cells.find(x => x.ch === '+1');
  assert.equal(one.r, 0); assert.equal(plus.r, 2); assert.equal(plus.c, one.c - 1);
  assert.match(c.data.steps.find(s => s.type === 'mark').say, /l’écart ne change pas/);
  /* la méthode vient de opts.subMethod (défaut : compensation) */
  for (let s = 0; s < 60; s++) {
    const a = O.gen(2.5, makeRng(`m${s}`), { kind: 'sub' }), b = O.gen(2.5, makeRng(`m${s}`), { kind: 'sub', subMethod: 'cassage' });
    assert.equal(a.data.method, 'compensation'); assert.equal(b.data.method, 'cassage');
    assert.equal(O.gen(2.5, makeRng(`m${s}`), { kind: 'sub', subMethod: 'autre' }).data.method, 'compensation');
  }
});

test('opérations : multiplication (règle des 0, retenues par ligne, plus petit nombre en 2e ligne)', () => {
  const it = O.fromKey('ma.operations:mul:16x548', 5);
  assert.deepEqual(it.data.operands, ['548', '16'], '548 en haut, 16 en dessous');
  assert.match(it.data.steps[0].say, /le moins de chiffres va sur la deuxième ligne/);
  const zero = it.data.steps.find(s => s.type === 'zero');
  assert.match(zero.say, /règle des 0/);
  const m = O.fromKey('ma.operations:mul:876x208', 5);
  assert.ok(m.data.steps.some(s => s.type === 'info' && /Le chiffre des dizaines de 208 est 0/.test(s.say)), 'ligne du 0 sautée');
  assert.equal(m.data.grid.cells.filter(c => c.zero).length, 2, '× 200 : deux 0 posés');
  const dec = O.fromKey('ma.operations:mul:8.76x208', 5);
  const comma = dec.data.steps.filter(s => s.type === 'comma');
  assert.equal(comma.length, 1); assert.match(comma[0].say, /2 chiffres après la virgule/);
});

test('opérations : division (potence, encadrement, soustractions écrites, virgule)', () => {
  const it = O.fromKey('ma.operations:div:9456/7', 4);
  const count = it.data.steps[0];
  assert.equal(count.type, 'count'); assert.equal(count.expect, '4');
  assert.match(count.say, /7\u202f000 ≤ 9\u202f456 < 70\u202f000/);
  assert.equal(it.data.steps.filter(s => s.type === 'quotient').length, 4);
  assert.equal(it.data.steps.filter(s => s.type === 'product').length, 4, 'soustractions intermédiaires écrites');
  assert.match(it.data.steps.at(-1).say, /9\u202f456 = 7 × 1\u202f350 \+ 6/);
  const dd = O.fromKey('ma.operations:divdec:785/4', 5);
  assert.equal(dd.data.result, '196,25');
  assert.equal(dd.data.grid.cells.filter(c => c.pale && c.role === 'operand').length, 2, '785,00 : deux 0 pâles');
  const ci = dd.data.steps.findIndex(s => s.type === 'comma'), bi = dd.data.steps.findIndex((s, i) => i > ci && s.type === 'bring');
  assert.ok(ci > 0 && bi === ci + 1, 'la virgule du quotient avant d’abaisser le premier 0');
  /* jamais de diviseur à 2 chiffres, jamais plus de 2 décimales */
  for (const bad of ['ma.operations:div:9456/12', 'ma.operations:divdec:10/3', 'ma.operations:divdec:100/4', 'ma.operations:divdec:123/8', 'ma.operations:div:94.5/7'])
    assert.equal(O.fromKey(bad, 5), null, bad);
});

test('opérations : fromKey reconstruit la même opération', () => {
  const keys = new Map();
  for (const subMethod of METHODS) for (const A of GRID) for (let s = 0; s < 6; s++) { const it = O.gen(A, makeRng(`r${A}|${s}`), { subMethod }); keys.set(it.key, it); }
  assert.ok(keys.size > 300, `${keys.size} clés`);
  for (const [key, orig] of keys) {
    const it = O.fromKey(key, orig.A);
    assert.ok(it, key);
    assert.deepEqual(it, orig, `fromKey(${key}) identique`);
  }
  for (const bad of ['', 'ma.operations:', 'ma.operations:add:', 'ma.operations:add:12', 'ma.operations:sub:364-18', 'ma.operations:sub:18-364:cassage',
    'ma.operations:add:12+5:cassage', 'ma.operations:mul:4.5x2.5', 'ma.operations:add:012+5', 'ma.operations:sub:364-18:autre',
    'ma.operations:div:9456/1', 'ma.faits:7x8', null, undefined, 3]) assert.equal(O.fromKey(bad, 3), null, String(bad));
});

test('opérations : opts.avoid et opts.kind', () => {
  for (const A of GRID) for (let s = 0; s < 10; s++) {
    const a = O.gen(A, makeRng(`v${A}|${s}`));
    const b = O.gen(A, makeRng(`v${A}|${s}`), { avoid: new Set([a.key]) });
    assert.notEqual(b.key, a.key, `A=${A}`);
  }
  for (const kind of O.KINDS) for (const A of [0, 1.5, 2.8, 3.6, 4.5, 5.6]) for (let s = 0; s < 12; s++) for (const subMethod of METHODS) {
    const it = O.gen(A, makeRng(`k${kind}${A}|${s}`), { kind, subMethod });
    assert.equal(it.kind, kind, `${kind} à A=${A}`);
    const ctx = `${kind} imposé A=${A} « ${it.prompt} »`;
    checkItem(it, A, ctx, subMethod); checkBounds(it, ctx);
  }
  for (const A of [-1, 99, NaN, '2']) checkItem(O.gen(A, makeRng(1)), 0, `A=${A}`);
  checkItem(O.gen(2, makeRng(1), null), 2, 'opts null');
});

test('opérations : couverture par palier (≥ 200 opérations distinctes)', () => {
  const ranges = [[0, 1, 'CP'], [1, 2, 'CE1'], [2, 3, 'CE2'], [3, 4, 'CM1'], [4, 5, 'CM2'], [5, 5.6, '≥ 5']];
  const report = [];
  for (const [a, b, name] of ranges) {
    const keys = new Set();
    for (let s = 0; s < 1500; s++) keys.add(O.gen(a + (b - a) * ((s % 101) / 101), makeRng(`c${a}|${s}`)).key);
    report.push(`${name} : ${keys.size}`);
    assert.ok(keys.size >= 200, `${name} : ${keys.size} clés`);
  }
  console.log('    opérations, clés distinctes par palier (1 500 tirages) : ' + report.join(' · '));
});
