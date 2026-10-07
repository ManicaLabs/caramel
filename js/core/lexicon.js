/* ============ LEXIQUE DU MICRO, LU SUR L'APPAREIL (v2.6, « Mes poésies ») ============
   Vosk ne reconnaît JAMAIS un mot absent du lexique de son modèle, même s'il est dans la grammaire. Pour les histoires,
   la liste des mots hors lexique est figée et vérifiée par les tests (tests/lexicon.mjs) ; une poésie, elle, est tapée par
   l'adulte : il faut le lexique sur l'appareil pour lui dire quels mots le micro ne connaît pas (et pour que le joker
   [unk] les valide, comme les noms propres).

   Rien à télécharger de plus : le lexique est la table de symboles de graph/Gr.fst, DANS le modèle déjà sur l'appareil
   (vosk-model-small-fr-0.22 : 135 769 mots ; la table occupe les octets 65 à 2,83 Mo de Gr.fst, lui-même à 26,1 Mo du
   début de l'archive décompressée). Deux voies :
   1. l'archive du cache 'vosk-model-v1' (js/core/speech.js, getModelBlob) décompressée au fil de l'eau
      (DecompressionStream), arrêtée dès la table lue : ≈ 29 Mo décompressés, peu de mémoire ;
   2. repli : Gr.fst déjà extrait par vosk-browser dans IndexedDB (base '/vosk', IDBFS), lu d'un bloc (24 Mo).
   Ni l'une ni l'autre (modèle pas encore téléchargé, navigateur sans DecompressionStream ni IndexedDB) → null : l'écran
   dit qu'il vérifiera plus tard. Jamais de réseau ici, jamais de base IndexedDB créée.
   Le lexique (≈ 135 000 mots en mémoire) est oublié 2 minutes après son dernier usage.

   API : LEX_ID (modèle du lexique, gardé avec la poésie), loadLexicon() → Promise<Set|null>, lexiconLoaded(),
   forgetLexicon() ; pour les tests : parseSymbols(octets), lexiconFromTar(flux de l'archive décompressée). */

import { MODEL_URL, IDB, modelDir } from './speech.js';
import { dlog } from './debuglog.js';

export const LEX_ID = MODEL_URL.split('/').pop();      /* 'fr-small-0.22.tar.gz' : un autre modèle → poésies à revérifier */
const MODEL_CACHE = 'vosk-model-v1';
const MAGIC = [0x74, 0xfb, 0xb2, 0x7e];                 /* table de symboles OpenFst (kSymbolTableMagicNumber, petit-boutiste) */
const SKIP = /^(<eps>|!SIL|#0|<s>|<\/s>)$/;             /* symboles techniques (comme tests/lexicon.mjs) */
const WANT = 4 << 20;                                   /* octets de Gr.fst lus d'abord (la table finit à 2,83 Mo) */
const KEEP_MS = 120000;

function indexOf(u8, pat, from = 0) {
  outer: for (let i = from; i <= u8.length - pat.length; i++) {
    for (let k = 0; k < pat.length; k++) if (u8[i + k] !== pat[k]) continue outer;
    return i;
  }
  return -1;
}
/* table de symboles OpenFst → mots ; RangeError si les octets s'arrêtent avant la fin de la table */
export function parseSymbols(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let off = indexOf(u8, MAGIC);
  if (off < 0) throw new Error('table de symboles introuvable');
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const td = new TextDecoder('utf-8');
  const need = n => { if (n < 0 || off + n > u8.length) throw new RangeError('table de symboles incomplète'); };
  const str = () => {
    need(4);
    const n = dv.getInt32(off, true);
    off += 4;
    need(n);
    const s = td.decode(u8.subarray(off, off + n));
    off += n;
    return s;
  };
  off += 4;
  str();                                                /* nom de la table */
  need(16);
  off += 8;                                             /* available_key */
  const size = Number(dv.getBigInt64(off, true));
  off += 8;
  if (!(size > 0 && size < 5e6)) throw new Error('table de symboles illisible');
  const words = [];
  for (let i = 0; i < size; i++) {
    const w = str();
    need(8);
    off += 8;                                           /* clé */
    if (!SKIP.test(w)) words.push(w);
  }
  return words;
}

/* lecteur d'octets sur un flux (ReadableStream) : read(n) exactement n octets (moins à la fin), skip(n) */
function byteReader(stream) {
  const reader = stream.getReader();
  let chunk = new Uint8Array(0), off = 0, done = false;
  async function fill() {
    while (off >= chunk.length && !done) {
      const r = await reader.read();
      if (r.done) { done = true; break; }
      chunk = r.value instanceof Uint8Array ? r.value : new Uint8Array(r.value);
      off = 0;
    }
  }
  return {
    async read(n) {
      const out = new Uint8Array(n);
      let got = 0;
      while (got < n) {
        await fill();
        if (off >= chunk.length) break;
        const k = Math.min(n - got, chunk.length - off);
        out.set(chunk.subarray(off, off + k), got);
        got += k; off += k;
      }
      return got === n ? out : out.subarray(0, got);
    },
    async skip(n) {
      let left = n;
      while (left > 0) {
        await fill();
        if (off >= chunk.length) return false;
        const k = Math.min(left, chunk.length - off);
        off += k; left -= k;
      }
      return true;
    },
    cancel() { try { const p = reader.cancel(); if (p && p.catch) p.catch(() => {}); } catch (_) {} }
  };
}
const cstr = (u8, a, n) => { let e = a; while (e < a + n && u8[e]) e++; return new TextDecoder().decode(u8.subarray(a, e)); };
/* flux de l'archive tar DÉCOMPRESSÉE du modèle → mots du lexique (null : pas de Gr.fst) */
export async function lexiconFromTar(stream) {
  const br = byteReader(stream);
  try {
    for (;;) {
      const hd = await br.read(512);
      if (hd.length < 512) return null;
      const name = cstr(hd, 0, 100);
      if (!name) return null;
      const prefix = cstr(hd, 345, 155);
      const path = prefix ? prefix + '/' + name : name;
      const size = parseInt(cstr(hd, 124, 12).trim() || '0', 8) || 0;
      const type = hd[156];
      if ((type === 0 || type === 48) && /(^|\/)Gr\.fst$/.test(path)) {
        const first = await br.read(Math.min(size, WANT));
        try { return parseSymbols(first); }
        catch (e) { if (!(e instanceof RangeError) || first.length >= size) throw e; }
        const rest = await br.read(size - first.length);
        const all = new Uint8Array(first.length + rest.length);
        all.set(first); all.set(rest, first.length);
        return parseSymbols(all);
      }
      if (!(await br.skip(Math.ceil(size / 512) * 512))) return null;
    }
  } finally { br.cancel(); }
}

/* voie 1 : archive du cache du modèle */
async function fromCache() {
  if (typeof caches === 'undefined' || typeof DecompressionStream !== 'function') return null;
  const c = await caches.open(MODEL_CACHE);
  const res = await c.match(MODEL_URL);
  if (!res || !res.body) return null;
  return lexiconFromTar(res.body.pipeThrough(new DecompressionStream('gzip')));
}
/* voie 2 : Gr.fst déjà extrait dans IndexedDB (sans jamais créer la base si elle n'existe pas) */
function idbOpenExisting() {
  return new Promise((res) => {
    let r;
    try { r = indexedDB.open(IDB.name); } catch (_) { res(null); return; }
    r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (_) {} };
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
    r.onblocked = () => res(null);
  });
}
const idbReq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function fromIdb() {
  if (typeof indexedDB === 'undefined' || !indexedDB) return null;
  let url;
  try { url = new URL(MODEL_URL, (typeof document !== 'undefined' && document.baseURI) || location.href).href; } catch (_) { return null; }
  const dir = modelDir(url);
  const db = await idbOpenExisting();
  if (!db) return null;
  try {
    if (!db.objectStoreNames.contains(IDB.store)) return null;
    const st = db.transaction([IDB.store]).objectStore(IDB.store);
    const keys = (await idbReq(st.getAllKeys(IDBKeyRange.bound(dir + '/', dir + '/\uffff')))).map(String);
    const key = keys.find(k => /\/graph\/Gr\.fst$/.test(k));
    if (!key) return null;
    const rec = await idbReq(db.transaction([IDB.store]).objectStore(IDB.store).get(key));
    return rec && rec.contents ? parseSymbols(rec.contents) : null;
  } finally { try { db.close(); } catch (_) {} }
}

let memo = null, pending = null, timer = 0;
function keep() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { memo = null; timer = 0; }, KEEP_MS);
  try { if (timer && timer.unref) timer.unref(); } catch (_) {}
}
/* → Promise<Set de mots | null> (une seule lecture à la fois) */
export function loadLexicon() {
  if (memo) { keep(); return Promise.resolve(memo); }
  if (!pending) {
    pending = (async () => {
      const t0 = Date.now();
      let words = null, via = '';
      try { words = await fromCache(); via = 'cache'; } catch (e) { dlog('lexique', 'archive illisible : ' + String((e && e.message) || e)); }
      if (!words) { try { words = await fromIdb(); via = 'idb'; } catch (e) { dlog('lexique', 'IndexedDB illisible : ' + String((e && e.message) || e)); } }
      if (!words || words.length < 1000) { dlog('lexique', 'indisponible (modèle pas encore sur l’appareil ?)'); return null; }
      memo = new Set(words);
      keep();
      dlog('lexique', 'lu', { voie: via, mots: memo.size, ms: Date.now() - t0 });
      return memo;
    })().catch(() => null).finally(() => { pending = null; });
  }
  return pending;
}
export const lexiconLoaded = () => !!memo;
export function forgetLexicon() { memo = null; if (timer) { clearTimeout(timer); timer = 0; } }
