/* Lexique du modèle Vosk de l'appli (2.2.4 : vosk-model-small-fr-0.22, models/fr-small-0.22.tar.gz ; avant :
   vosk-model-small-fr-pguyot-0.3, models/fr.tar.gz) — nom du fichier tiré de MODEL_URL (js/core/speech.js).
   Le dictionnaire est la table de symboles OpenFst embarquée dans Gr.fst (135 774 mots ; 90 120 pour l'ancien).
   Un mot absent de ce lexique ne peut JAMAIS être reconnu par Vosk, même s'il est dans la grammaire.
   Résultat mis en cache dans tests/.cache/lexicon.txt (ignoré par git).
     import { loadLexicon, normalizeForGrammar } from './lexicon.mjs';
     const lex = loadLexicon();  lex.has('licorne') // true */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MODEL_URL } from '../js/core/speech.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = join(root, ...MODEL_URL.split('/'));
/* cache par modèle : changer de modèle ne relit jamais l'ancien lexique */
const CACHE = join(root, 'tests', '.cache', 'lexicon-' + MODEL_URL.split('/').pop().replace(/\.tar\.gz$/, '') + '.txt');

function extractGrFst(tarGz) {
  const tar = gunzipSync(tarGz);
  let off = 0;
  while (off + 512 <= tar.length) {
    const name = tar.toString('utf8', off, off + 100).replace(/\0.*$/s, '');
    if (!name) break;
    const size = parseInt(tar.toString('utf8', off + 124, off + 136).replace(/\0.*$/s, '').trim() || '0', 8);
    const base = name.split('/').pop();
    if (base === 'Gr.fst') return tar.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error('Gr.fst introuvable dans le modèle');
}
function parseSymbols(buf) {
  let off = buf.indexOf(Buffer.from([0x74, 0xfb, 0xb2, 0x7e]));   /* magic SymbolTable OpenFst */
  if (off < 0) throw new Error('table de symboles introuvable');
  off += 4;
  const str = () => { const n = buf.readInt32LE(off); off += 4; const s = buf.toString('utf8', off, off + n); off += n; return s; };
  str();                                   /* nom de la table */
  off += 8;                                /* available_key */
  const size = Number(buf.readBigInt64LE(off)); off += 8;
  const words = [];
  for (let i = 0; i < size; i++) { words.push(str()); off += 8; }
  return words.filter(w => !/^(<eps>|!SIL|#0|<s>|<\/s>)$/.test(w));
}

let memo = null;
export function loadLexicon() {
  if (memo) return memo;
  let words;
  if (existsSync(CACHE)) words = readFileSync(CACHE, 'utf8').split('\n').filter(Boolean);
  else {
    words = parseSymbols(extractGrFst(readFileSync(MODEL)));
    try { mkdirSync(dirname(CACHE), { recursive: true }); writeFileSync(CACHE, words.join('\n') + '\n'); } catch (_) {}
  }
  memo = new Set(words);
  return memo;
}
/* normalisation EXACTE de la grammaire v11 (startVoskEngine) : minuscules, lettres/chiffres seulement, accents conservés */
export function normalizeForGrammar(raw) {
  return String(raw).toLowerCase().replace(/[^\p{L}0-9]/gu, '');
}
