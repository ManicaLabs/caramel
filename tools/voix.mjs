/* ============ VOIX ENREGISTRÉE DU COMPAGNON : génération des clips (v2.2.2) ============
   Lit l'inventaire (js/content/voice-lines.js), fait lire chaque entrée par Piper (voix neuronale libre
   « fr_FR-siwis-medium », réglages de l'échantillon validé par le parent), la rajeunit en voix d'enfant, découpe, encode
   en MP3 mono 22,05 kHz et écrit audio/voix/<id>.mp3 + le manifeste js/content/voice-manifest.js (id → durée, empreinte).
   Voix d'enfant (décision du parent du 05/10/2026, après écoute : degré 4, r = YOUTH = 1,33, +5 demi-tons) : Piper lit
   avec length_scale × r (et un silence entre phrases × r), puis ffmpeg « asetrate=22050×r, aresample=22050 » relit le son
   r fois plus vite : hauteur et timbre montent de r, le débit redevient celui de Siwis (≈ 5 % plus vif : Piper arrondit
   les durées de ses phonèmes ; idem dans l'échantillon validé). Réglages PARTAGÉS avec la voix
   fluide (PARAMS et YOUTH de js/core/piper-engine.js, qui fait la même chose dans le navigateur).
   Régénération idempotente : seuls les clips dont le texte lu, la découpe ou les réglages ont changé sont refaits ;
   les fichiers qui ne sont plus dans l'inventaire sont supprimés.

     node tools/voix.mjs              génère ce qui manque ou a changé (Piper et ffmpeg requis)
     node tools/voix.mjs --check      vérifie seulement (sans Piper) : chaque entrée a son fichier à jour → code 1 sinon
     node tools/voix.mjs --force      régénère tout
     node tools/voix.mjs --only=n1    ne régénère que les identifiants qui commencent par « n1 » (essais)

   Variables d'environnement :
     PIPER        exécutable piper (paquet Python piper-tts ≥ 1.3 : `python3 -m venv v && v/bin/pip install piper-tts`) ; défaut « piper »
     PIPER_MODEL  modèle fr_FR-siwis-medium.onnx (+ .onnx.json à côté) — huggingface.co/rhasspy/piper-voices,
                  fr/fr_FR/siwis/medium ; obligatoire pour générer
     FFMPEG       exécutable ffmpeg (libmp3lame) ; défaut « ffmpeg »

   Format : MP3 (MPEG-2 Layer III) mono 22,05 kHz, débit variable LAME V9 (≈ 29 kbit/s sur la voix) coupé à 7 kHz × YOUTH
   (9,3 kHz, ENC : la part de la voix de Siwis que gardait la coupure à 7 kHz avant la voix d'enfant ; à 7 kHz, les
   consonnes sifflantes montées de 1,33 étaient rognées — 123 nombres isolés reconnus par Vosk une fois ramenés à la
   hauteur de Siwis : 76 à 7 kHz, 115 à 9,3 kHz, 116 avec l'ancienne voix) —
   le seul format compressé que Chrome Android ET Safari iOS (12 et suivants) décodent à coup sûr, en <audio> comme en
   Web Audio (decodeAudioData) ; Opus n'est lu par Safari que depuis iOS 17-18, AAC manque aux Chromium sans codecs
   propriétaires. Mesuré sur 8 phrases (distance spectrale au WAV de Piper, 0-5 kHz) : V9 + 7 kHz 5,8 dB et 6,8 kHz de
   bande pour 82 Ko ; 32 kbit/s constant 7,0 dB / 8 kHz pour 96 Ko ; 24 kbit/s constant 10,0 dB / 5,2 kHz (voix étouffée)
   pour 72 Ko.
   Découpe : silences de tête et de queue retirés (un clip commence et finit sur la voix, 4 ms de fondu) ; les morceaux
   « cut: 'carrier' » sont lus dans la phrase porteuse « <texte> : la. » puis coupés avant « la » : ils gardent
   l'intonation montante d'une suite de phrase (« sept… fois… huit »). */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, existsSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LINES, synthText } from '../js/content/voice-lines.js';
import { PARAMS, YOUTH } from '../js/core/piper-engine.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const AUDIO_DIR = 'audio/voix';
export const MANIFEST = 'js/content/voice-manifest.js';
/* poids visé de tous les clips : 1,5 Mo en 2.2.2 (petits lecteurs), relevé à 1,6 Mo quand la lecture à voix haute est
   devenue la règle pour TOUS les enfants (décision du parent, 04/10/2026) : la visite guidée des CM1-CM2 est enregistrée
   (≈ 45 Ko) ; puis à 1,7 Mo pour l'invitation « 📲 Mets Caramel sur l'écran d'accueil » côté enfant (feuille, bannière,
   marche à suivre de l'iPhone et de l'iPad : ≈ 115 Ko ; « tout texte dit a son clip quand c'est possible ») ; puis à
   1,9 Mo pour la voix d'enfant (05/10/2026 : coupure relevée de 7 à 9,3 kHz, ≈ +12 %) ; hors précache, téléchargé
   phrase par phrase */
export const BUDGET = 1.9 * 1024 * 1024;
const RATE = 22050;
const ENC = Object.freeze(['-q:a', '9', '-cutoff', String(Math.round(7000 * YOUTH))]);   /* LAME V9, passe-bas 9,3 kHz */
/* réglages Piper de l'échantillon validé par le parent (voix/1-siwis.mp3), voix d'enfant comprise (PARAMS.youth) */
export { PARAMS, YOUTH };
const r4 = x => Math.round(x * 1e4) / 1e4;
/* lecture r fois plus rapide : le son de Piper relu à 22 050 × r Hz, ramené à 22 050 Hz */
export const YOUTH_FILTER = 'asetrate=' + Math.round(RATE * YOUTH) + ',aresample=' + RATE;
const CARRIER = ' : la.';                                /* phrase porteuse des morceaux coupés */
const TRIM = { lead: 0.012, tail: 0.03, fade: 0.004 };   /* s gardées avant / après la voix, fondus */

/* ce que Piper lit pour une entrée */
export function pieceText(e) {
  const t = synthText(e);
  return e.cut === 'carrier' ? t.replace(/[\s,;:]+$/, '') + CARRIER : t;
}
/* empreinte : texte lu + découpe + réglages (un changement de l'un d'eux refait le clip) */
export function hashOf(e) {
  return createHash('sha1').update(JSON.stringify([pieceText(e), e.cut || '', PARAMS, YOUTH_FILTER, ENC, TRIM])).digest('hex').slice(0, 8);
}

/* ---------- manifeste ---------- */
export function readManifest(root = ROOT) {
  const p = join(root, MANIFEST);
  if (!existsSync(p)) return { clips: {} };
  const src = readFileSync(p, 'utf8');
  const m = /export const VOICE = (\{[\s\S]*\});\s*$/.exec(src);
  if (!m) return { clips: {} };
  try { return JSON.parse(m[1]); } catch (_) { return { clips: {} }; }
}
function writeManifest(clips, root = ROOT) {
  const ids = Object.keys(clips).sort();
  const body = { voice: 'fr_FR-siwis-medium', youth: YOUTH, mp3: 'V9 ' + ENC[3], base: AUDIO_DIR + '/', clips: Object.fromEntries(ids.map(i => [i, clips[i]])) };
  const json = JSON.stringify(body).replace(/\],"/g, '],\n"').replace('"clips":{', '"clips":{\n');
  writeFileSync(join(root, MANIFEST),
    '/* GÉNÉRÉ par tools/voix.mjs — ne pas modifier à la main.\n' +
    '   Voix du compagnon : Piper (Rhasspy, licence MIT), voix siwis — SIWIS French Speech Synthesis Database, CC BY 4.0 —\n' +
    '   rajeunie en voix d’enfant (youth : hauteur et timbre × 1,33).\n' +
    '   clips : id → [durée en ms, empreinte] ; fichier : base + id + \'.mp3?v=\' + empreinte. */\n' +
    'export const VOICE = ' + json + ';\n');
}

/* ---------- vérification (sans Piper) ---------- */
export function check(root = ROOT) {
  const man = readManifest(root);
  const problems = [];
  let bytes = 0, ms = 0;
  for (const e of LINES) {
    const c = man.clips && man.clips[e.id];
    const f = join(root, AUDIO_DIR, e.id + '.mp3');
    if (!c) { problems.push(e.id + ' : absent du manifeste'); continue; }
    if (c[1] !== hashOf(e)) problems.push(e.id + ' : texte changé, clip à refaire');
    if (!existsSync(f)) { problems.push(e.id + ' : fichier manquant'); continue; }
    bytes += statSync(f).size;
    ms += c[0];
  }
  const known = new Set(LINES.map(e => e.id));
  for (const id of Object.keys(man.clips || {})) if (!known.has(id)) problems.push(id + ' : dans le manifeste mais plus dans l’inventaire');
  let files = [];
  try { files = readdirSync(join(root, AUDIO_DIR)).filter(f => f.endsWith('.mp3')); } catch (_) {}
  for (const f of files) if (!known.has(f.slice(0, -4))) problems.push(f + ' : fichier orphelin');
  if (bytes > BUDGET) problems.push('poids total ' + Math.round(bytes / 1024) + ' Ko > ' + Math.round(BUDGET / 1024) + ' Ko');
  return { problems, bytes, ms, count: LINES.length };
}

/* ---------- audio ---------- */
function run(cmd, args, { input, binary = false } = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [], err = [];
    p.stdout.on('data', d => out.push(d));
    p.stderr.on('data', d => err.push(d));
    p.on('error', rej);
    p.on('close', code => {
      if (code !== 0) rej(new Error(cmd + ' : code ' + code + '\n' + Buffer.concat(err).toString().slice(-800)));
      else res(binary ? Buffer.concat(out) : Buffer.concat(out).toString());
    });
    if (input !== undefined) p.stdin.end(input); else p.stdin.end();
  });
}
/* WAV PCM 16 bits → { rate, samples: Float32Array } */
export function readWav(buf) {
  let off = 12, fmt = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { ch: buf.readUInt16LE(off + 10), rate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    if (id === 'data') {
      if (!fmt || fmt.bits !== 16 || fmt.ch !== 1) throw new Error('WAV inattendu');
      const n = Math.floor(Math.min(size, buf.length - off - 8) / 2);
      const s = new Float32Array(n);
      for (let i = 0; i < n; i++) s[i] = buf.readInt16LE(off + 8 + 2 * i) / 32768;
      return { rate: fmt.rate, samples: s };
    }
    off += 8 + size + (size & 1);
  }
  throw new Error('WAV sans données');
}
/* énergie par trame de 10 ms */
function frames(s, rate) {
  const h = Math.round(rate * 0.01), out = [];
  for (let i = 0; i + h <= s.length; i += h) {
    let e = 0;
    for (let j = i; j < i + h; j++) e += s[j] * s[j];
    out.push(Math.sqrt(e / h));
  }
  return out;
}
/* découpe d'un clip : silences retirés ; phrase porteuse coupée avant « la » → { samples, cut } */
export function shape(samples, rate, carrier) {
  const f = frames(samples, rate);
  const peak = Math.max(...f, 1e-6);
  const on = f.map(v => v > Math.max(peak * 0.04, 0.004));
  let first = on.indexOf(true), last = on.lastIndexOf(true);
  if (first < 0) return { samples: new Float32Array(0), cut: false };
  let cut = false;
  if (carrier) {
    /* « la » : dernière plage de voix ; on remonte jusqu'au silence (≥ 50 ms) qui la précède */
    let i = last;
    while (i > first && on[i]) i--;                       /* début de « la » */
    let gap = 0, j = i;
    while (j > first && !on[j]) { gap++; j--; }
    /* « la » peut commencer par une voyelle faible : on accepte un silence court, mais il en faut un */
    if (gap >= 5 && j > first) { last = j; cut = true; }
  }
  const a = Math.max(0, Math.round((first * 0.01 - TRIM.lead) * rate));
  const b = Math.min(samples.length, Math.round(((last + 1) * 0.01 + TRIM.tail) * rate));
  const out = samples.slice(a, b);
  const fd = Math.round(TRIM.fade * rate);
  for (let k = 0; k < fd && k < out.length; k++) { const g = k / fd; out[k] *= g; out[out.length - 1 - k] *= g; }
  return { samples: out, cut };
}
const toPcm = s => { const b = Buffer.alloc(s.length * 2); for (let i = 0; i < s.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s[i] * 32767))), 2 * i); return b; };

async function synthesize(entries, { piper, model, dir }) {
  /* un seul lancement de Piper pour tout le lot : une ligne par clip, un WAV par ligne (noms croissants) */
  const input = entries.map(e => pieceText(e).replace(/\s+/g, ' ')).join('\n') + '\n';
  /* voix d'enfant : Piper parle YOUTH fois plus lentement (silences compris) ; youthful() relit le son YOUTH fois plus vite */
  await run(piper, ['-m', model, '-d', dir, '--length_scale', String(r4(PARAMS.length_scale * YOUTH)), '--noise_scale', String(PARAMS.noise_scale),
    '--noise_w', String(PARAMS.noise_w), '--sentence_silence', String(r4(PARAMS.sentence_silence * YOUTH)), '--volume', String(PARAMS.volume)], { input });
  const wavs = readdirSync(dir).filter(f => f.endsWith('.wav')).sort((x, y) => (BigInt(x.slice(0, -4)) < BigInt(y.slice(0, -4)) ? -1 : 1));
  if (wavs.length !== entries.length) throw new Error('Piper a écrit ' + wavs.length + ' fichiers pour ' + entries.length + ' lignes');
  return wavs.map(f => join(dir, f));
}
/* WAV de Piper → son de la voix d'enfant (Float32Array à 22 050 Hz) */
async function youthful(wav, ffmpeg) {
  const { rate } = readWav(readFileSync(wav));
  if (rate !== RATE) throw new Error(wav + ' : ' + rate + ' Hz');
  const raw = await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', wav, '-af', YOUTH_FILTER, '-ac', '1', '-f', 'f32le', 'pipe:1'], { binary: true });
  return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length - (raw.length % 4)));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--check')) {
    const r = check();
    const kb = Math.round(r.bytes / 1024);
    if (r.problems.length) {
      console.log('✗ voix enregistrée : ' + r.problems.length + ' problème(s)\n  ' + r.problems.slice(0, 30).join('\n  '));
      process.exit(1);
    }
    console.log('✓ voix enregistrée : ' + r.count + ' clips, ' + kb + ' Ko, ' + Math.round(r.ms / 1000) + ' s');
    return;
  }
  const piper = process.env.PIPER || 'piper';
  const model = process.env.PIPER_MODEL;
  const ffmpeg = process.env.FFMPEG || 'ffmpeg';
  if (!model || !existsSync(model)) { console.error('✗ PIPER_MODEL : chemin du modèle fr_FR-siwis-medium.onnx requis'); process.exit(1); }
  const force = args.includes('--force');
  const only = (args.find(a => a.startsWith('--only=')) || '').slice(7);
  const man = readManifest();
  const clips = { ...(man.clips || {}) };
  mkdirSync(join(ROOT, AUDIO_DIR), { recursive: true });
  const todo = LINES.filter(e => {
    if (only) return e.id.startsWith(only);
    const c = clips[e.id];
    return force || !c || c[1] !== hashOf(e) || !existsSync(join(ROOT, AUDIO_DIR, e.id + '.mp3'));
  });
  console.log(todo.length + ' clip(s) à générer sur ' + LINES.length);
  const warn = [];
  /* lot → WAV découpés ; une phrase porteuse sans silence avant « la » est relue (Piper tire au sort son bruit),
     jusqu'à 6 fois (la voix d'enfant enchaîne plus souvent « est : la. »), puis lue sans phrase porteuse */
  const shaped = new Map();
  let queue = todo, round = 0;
  while (queue.length) {
    const retry = [];
    for (let i = 0; i < queue.length; i += 120) {
      const batch = queue.slice(i, i + 120);
      const plain = round >= 6;
      const dir = mkdtempSync(join(tmpdir(), 'caramel-voix-'));
      try {
        const wavs = await synthesize(batch.map(e => (plain ? { ...e, cut: '' } : e)), { piper, model, dir });
        for (const [k, e] of batch.entries()) {
          const r = shape(await youthful(wavs[k], ffmpeg), RATE, e.cut === 'carrier' && !plain);
          if (e.cut === 'carrier' && !plain && !r.cut) { retry.push(e); continue; }
          if (plain) warn.push(e.id + ' : phrase porteuse jamais coupée, lu sans elle');
          shaped.set(e.id, r.samples);
        }
      } finally { rmSync(dir, { recursive: true, force: true }); }
      process.stdout.write('  lot ' + (round + 1) + ' : ' + Math.min(i + 120, queue.length) + '/' + queue.length + '\n');
    }
    queue = retry;
    round++;
  }
  for (const e of todo) {
    const pcm = shaped.get(e.id);
    const mp3 = await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 's16le', '-ar', String(RATE), '-ac', '1', '-i', 'pipe:0',
      '-c:a', 'libmp3lame', ...ENC, '-ar', String(RATE), '-ac', '1', '-map_metadata', '-1', '-id3v2_version', '0',
      '-write_xing', '1', '-f', 'mp3', 'pipe:1'], { input: toPcm(pcm), binary: true });
    writeFileSync(join(ROOT, AUDIO_DIR, e.id + '.mp3'), mp3);
    clips[e.id] = [Math.round(1000 * pcm.length / RATE), hashOf(e)];
  }
  /* inventaire seul : entrées retirées → hors du manifeste, fichiers supprimés */
  const known = new Set(LINES.map(e => e.id));
  for (const id of Object.keys(clips)) if (!known.has(id)) delete clips[id];
  for (const f of readdirSync(join(ROOT, AUDIO_DIR))) if (f.endsWith('.mp3') && !known.has(f.slice(0, -4))) unlinkSync(join(ROOT, AUDIO_DIR, f));
  writeManifest(clips);
  for (const w of warn) console.log('⚠ ' + w);
  const r = check();
  console.log((r.problems.length ? '✗ ' : '✓ ') + r.count + ' clips, ' + Math.round(r.bytes / 1024) + ' Ko, ' + Math.round(r.ms / 1000) + ' s'
    + (r.problems.length ? '\n  ' + r.problems.slice(0, 20).join('\n  ') : ''));
  if (r.problems.length) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(e => { console.error('✗ ' + (e && e.stack || e)); process.exit(1); });
