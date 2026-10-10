/* ============ CAPTURES DE LA FICHE GOOGLE PLAY (et image de présentation 1024 × 500) ============
   Chrome sans interface (puppeteer-core), sur un PROFIL FICTIF (« Léa », CE1, poney Caramel : aucune donnée d'enfant
   réelle, le dépôt est public). Rien n'est envoyé nulle part : un petit serveur local sert le site.
     1. depuis le dossier PARENT du dépôt :  python3 -m http.server 8997 --bind 127.0.0.1
     2. depuis le dépôt :                     node store/outils/captures.mjs [filtre]
        variables : PUPPETEER (chemin de puppeteer-core.js), CHROME (/usr/bin/google-chrome par défaut),
                    BASE (http://127.0.0.1:8997/caramel/ par défaut), PROFILE_DIR (dossier de profil Chrome jetable)
   Sorties (PNG 24 bits sans alpha, aplaties par ImageMagick) :
     store/captures/telephone-<n>-<écran>.png    1080 × 1920 (9:16 ; ≥ 1080 px : éligible à la mise en avant)
     store/captures/tablette-7-<n>-<écran>.png   1224 × 2176 (9:16, tablette 7" en portrait)
     store/captures/tablette-10-<n>-<écran>.png  2560 × 1440 (16:9, tablette 10" en paysage)
     store/visuels/presentation-play-1024x500.png
   Mise en scène : appli « installée » (display-mode standalone : pas d'invitation à installer), hors connexion simulé
   (navigator.onLine = false : pas de barre de préchargement de la voix et du micro), mouvement réduit (images stables),
   10 h 30 le 7 octobre 2026 (le compagnon ne dort pas). store/ n'est jamais précaché (tools/precache.mjs). */
import { mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUPPETEER = process.env.PUPPETEER || 'puppeteer-core';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8997/caramel/';
const PROFILE_DIR = process.env.PROFILE_DIR || join(tmpdir(), 'caramel-captures-chrome');
const FILTER = process.argv[2] || '';
const OUT = join(ROOT, 'store', 'captures');
const NOW = '2026-10-07T10:30:00';
const TODAY = '2026-10-07';
const UA_PHONE = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const UA_TABLET = 'Mozilla/5.0 (Linux; Android 15; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const DEVICES = [
  { id: 'telephone', width: 360, height: 640, dpr: 3, ua: UA_PHONE, mobile: true },
  { id: 'tablette-7', width: 612, height: 1088, dpr: 2, ua: UA_TABLET, mobile: true },
  { id: 'tablette-10', width: 1280, height: 720, dpr: 2, ua: UA_TABLET, mobile: true }
];
/* écrans montrés, dans l'ordre de la fiche ; setup(page) : gestes avant la capture */
const SCENES = [
  { id: 'accueil', hash: '#/home' },
  { id: 'course', hash: '#/play/course', setup: startStory },
  { id: 'tables', hash: '#/play/tables' },
  { id: 'operations', hash: '#/play/operations' },
  { id: 'balade', hash: '#/balade' },
  { id: 'progres', hash: '#/progres' },
  { id: 'parents', hash: '#/parents', gate: true }
];

/* ---------- profil fictif « Léa » (CE1) : quelques semaines de jeu, une fiche saisie ---------- */
function demoData() {
  const day = n => { const d = new Date(TODAY + 'T12:00:00'); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const skill = (t, n, trend = 0.1, src = 'obs') => ({ t, n, last: day(1), trend, src });
  const fiche = { src: 'reperes', date: '2026-09', classe: 'CE1', added: day(30), precision: '',
    fr: { 'fr.comp_ecrit': 1.9, 'fr.comp_oral': 2.3, 'fr.decodage': 1.7, 'fr.fluence': 1.4, 'fr.ecrire_syll': 2.1, 'fr.ortho': 1.8, 'fr.conjug': null },
    ma: { 'ma.nombres': 2.2, 'ma.ligne': 1.6, 'ma.faits': 1.8, 'ma.procedures': 2.0, 'ma.operations': 1.7, 'ma.problemes': 1.5, 'ma.denombrer': 2.6 } };
  const skills = {
    'fr.fluence': skill(1.9, 14, 0.4), 'fr.comp_ecrit': skill(2.1, 12, 0.2), 'fr.conjug': skill(1.8, 30, 0.3),
    'ma.ligne': skill(2.0, 40, 0.4), 'ma.faits': skill(2.3, 90, 0.5), 'ma.procedures': skill(2.1, 60, 0.1),
    'ma.operations': skill(1.9, 24, 0.2), 'fr.comp_oral': skill(2.3, 4, 0, 'eval'), 'fr.decodage': skill(1.7, 4, 0, 'eval'),
    'fr.ecrire_syll': skill(2.1, 4, 0, 'eval'), 'fr.ortho': skill(1.8, 4, 0, 'eval'), 'ma.nombres': skill(2.2, 4, 0, 'eval'),
    'ma.problemes': skill(1.5, 4, 0, 'eval'), 'ma.denombrer': skill(2.6, 4, 0, 'eval')
  };
  const stories = ['ce1-carotte', 'ce1-bain', 'ce1-verger', 'ce1-nuit'];
  const mclm = [22, 25, 24, 28, 30, 29, 33, 35].map((v, i) => ({ d: day(28 - i * 3), t: 0, s: stories[i % 4], v, p: 92 + (i % 3) * 3, z: 26 + i }));
  const games = ['course', 'tables', 'cloture', 'operations', 'pommes', 'orchestre'];
  const axisOf = { course: 'fr.fluence', tables: 'ma.faits', cloture: 'ma.ligne', operations: 'ma.operations', pommes: 'ma.procedures', orchestre: 'fr.conjug' };
  const history = [];
  for (let i = 0; i < 36; i++) {
    const g = games[i % games.length], th = Math.min(3, 1.4 + i * 0.025);
    history.push({ d: day(11 - Math.floor(i / 3)), t: 0, g, ax: axisOf[g], n: 8, ok: 6 + (i % 3), hint: i % 2, ms: 240000, th: Math.round(th * 100) / 100, mode: 'balade' });
  }
  const snapshots = [5, 4, 3, 2, 1, 0].map((k, i) => {
    const d = day(k * 7);
    const s = {};
    for (const [a, v] of Object.entries(skills)) if (v.src === 'obs') s[a] = Math.round(Math.max(0.5, v.t - (5 - i) * 0.08) * 100) / 100;
    return { w: weekKey(d), d, s };
  });
  const p = {
    id: 'p1', name: 'Léa', g: 'f', classe: 'CE1', classeSince: day(37), created: day(37),
    companion: { type: 'pony', name: 'Caramel', owned: ['pony', 'unicorn'], equip: { owned: [], worn: [] },
      pet: { faim: 82, forme: 76, joie: 90, last: Date.parse(NOW) - 3600e3, brushLast: Date.parse(NOW) - 7200e3, walkDay: TODAY },
      stage: 2, minutes: 140 },
    wallet: { apples: 37, stars: { 'ce1-carotte': 3, 'ce1-bain': 2, 'ce1-verger': 2 } },
    streak: { count: 6, last: day(1), freezes: 1, freezeWeek: '' },
    skills, evals: [fiche], snapshots, leitner: {}, history, mclm, today: null, legacy: null,
    settings: { sessionMin: 15, timers: false, sound: true, motion: 'full', theme: 'caramel', readAloud: 'on' },
    stats: { minutes: 140, sessions: 19, items: 560 }, medals: {},
    seen: { tour: true, games: Object.fromEntries(games.map(g => [g, true])) }
  };
  return { schema: 3, active: 'p1', migratedFrom: null, created: day(37), profiles: { p1: p } };
}
/* semaine ISO « 2026-W41 » (comme js/core/util.js weekKey) */
function weekKey(s) {
  const d = new Date(s + 'T12:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const w = 1 + Math.round(((d - first) / 864e5 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return d.getUTCFullYear() + '-W' + String(w).padStart(2, '0');
}

/* ---------- gestes ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function startStory(page) {
  /* course : choisir « La carotte du matin » si la liste des histoires s'affiche */
  const pick = await page.$('[data-id="ce1-carotte"]');
  if (pick) { await pick.click(); await sleep(1200); }
}

/* ---------- mise en scène commune (avant tout script de la page) ---------- */
function stage({ data, gate, now }) {
  const T0 = Date.parse(now), t0 = performance.now(), D = Date;
  class FixedDate extends D {
    constructor(...a) { if (a.length) super(...a); else super(T0 + (performance.now() - t0)); }
    static now() { return T0 + (performance.now() - t0); }
  }
  globalThis.Date = FixedDate;
  Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false, configurable: true });
  const mm = window.matchMedia.bind(window);
  window.matchMedia = q => /display-mode:\s*standalone/.test(q)
    ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
    : mm(q);
  try {
    if (!localStorage.getItem('caramel-v3')) localStorage.setItem('caramel-v3', JSON.stringify(data));
    localStorage.setItem('caramel-notifs', 'later');
    sessionStorage.setItem('caramel-picked', 'p1');
    if (gate) sessionStorage.setItem('caramel-parents-until', String(T0 + 3600e3));
    /* invitation au code parent : « Plus tard » déjà choisi */
    localStorage.setItem('caramel-parent', JSON.stringify({ v: 1, pin: null, fails: 0, strikes: 0, until: 0, later: now.slice(0, 10), saved: {} }));
  } catch (e) {}
}

async function flatten(src, dest) {
  execFileSync('convert', [src, '-background', '#fff1f5', '-alpha', 'remove', '-alpha', 'off', '-define', 'png:color-type=2', dest]);
}

async function main() {
  const { default: puppeteer } = await import(pathToFileURL(PUPPETEER).href);
  mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: PROFILE_DIR,
    args: ['--no-first-run', '--hide-scrollbars', '--lang=fr-FR', '--autoplay-policy=no-user-gesture-required'] });
  const data = demoData();
  try {
    /* image de présentation */
    if (!FILTER || 'presentation'.includes(FILTER)) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
      await page.goto(BASE + 'store/sources/presentation.html', { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts.ready);
      await sleep(500);
      const tmp = join(OUT, '.tmp.png');
      await page.screenshot({ path: tmp });
      await flatten(tmp, join(ROOT, 'store', 'visuels', 'presentation-play-1024x500.png'));
      execFileSync('rm', ['-f', tmp]);
      await page.close();
      console.log('✓ store/visuels/presentation-play-1024x500.png');
    }
    for (const dev of DEVICES) {
      let n = 0;
      for (const sc of SCENES) {
        n++;
        const name = dev.id + '-' + n + '-' + sc.id;
        if (FILTER && !name.includes(FILTER)) continue;
        const ctx = await browser.createBrowserContext();
        const page = await ctx.newPage();
        page.on('pageerror', e => console.log('  erreur de page (' + name + ') : ' + e.message));
        await page.setUserAgent(dev.ua);
        await page.setViewport({ width: dev.width, height: dev.height, deviceScaleFactor: dev.dpr, isMobile: dev.mobile, hasTouch: true });
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
        await page.evaluateOnNewDocument(stage, { data, gate: !!sc.gate, now: NOW });
        await page.goto(BASE + 'index.html' + sc.hash, { waitUntil: 'networkidle0', timeout: 60000 });
        await page.waitForFunction(() => document.documentElement.classList.contains('booted'), { timeout: 30000 }).catch(() => {});
        await page.evaluate(() => document.fonts.ready);
        await sleep(1500);
        if (sc.setup) await sc.setup(page);
        await sleep(800);
        const tmp = join(OUT, '.tmp-' + name + '.png');
        await page.screenshot({ path: tmp });
        await flatten(tmp, join(OUT, name + '.png'));
        execFileSync('rm', ['-f', tmp]);
        await ctx.close();
        console.log('✓ store/captures/' + name + '.png');
      }
    }
  } finally {
    await browser.close();
  }
}

if (!existsSync(join(ROOT, 'store', 'visuels'))) mkdirSync(join(ROOT, 'store', 'visuels'), { recursive: true });
main().catch(e => { console.error(e); process.exit(1); });
