/* Caramel sur l'écran d'accueil (v2.2.2) : agent utilisateur, mode installé, méthode d'installation, mémoire « plus tard »
   de l'appareil, quand inviter, invitation du navigateur gardée (js/core/install.js) ; diagnostic de l'appareil
   (js/ui/diag.js : faits → lignes en mots simples) ; branchements (main.js, accueil, fin de création, espace parents). */
import { test, assert, memoryStorage } from './_t.mjs';
import { readFileSync } from 'node:fs';
import * as I from '../js/core/install.js';
import { describe, fmtBytes, asText } from '../js/ui/diag.js';

const SRC = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const code = p => SRC(p).replace(/\/\*[\s\S]*?\*\//g, '');
const UA = {
  androidChrome: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0',
  webview: 'Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.71 Mobile/15E148 Safari/604.1',
  /* Safari 26 : version d'iOS figée à 18_6 dans l'agent utilisateur, seule Version/ suit la vraie (S22V-4) */
  ios26Safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  ios26Chrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1',
  ios18Safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  ios26App: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  oldChromeIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/110.0.5481.83 Mobile/15E148 Safari/604.1',
  firefoxIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/605.1.15',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.25.84',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  edgeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0'
};
const env = (ua, o = {}) => ({ ua, platform: '', maxTouchPoints: 0, navStandalone: false, matchMedia: () => false, ...o });

test('agent utilisateur : système, navigateur et version, iPad déguisé en Mac, navigateurs intégrés', () => {
  const p = (ua, o) => I.parseUA(ua, o);
  let d = p(UA.androidChrome);
  assert.deepEqual([d.os, d.osVersion, d.browser, d.browserVersion, d.android, d.ios, d.mobile, d.inApp], ['Android', '10', 'Chrome', '141', true, false, true, false]);
  d = p(UA.samsung);
  assert.deepEqual([d.browser, d.browserVersion, d.osVersion], ['Samsung Internet', '25', '14']);
  d = p(UA.firefoxAndroid);
  assert.deepEqual([d.os, d.osVersion, d.browser, d.browserVersion], ['Android', '14', 'Firefox', '125']);
  d = p(UA.webview);
  assert.equal(d.inApp, true, 'vue web Android');
  d = p(UA.iphoneSafari);
  assert.deepEqual([d.os, d.osVersion, d.browser, d.browserVersion, d.ios, d.inApp], ['iOS', '17.4', 'Safari', '17.4', true, false]);
  d = p(UA.iphoneChrome);
  assert.deepEqual([d.os, d.browser, d.browserVersion, d.ios], ['iOS', 'Chrome', '124', true]);
  d = p(UA.firefoxIOS);
  assert.equal(d.browser, 'Firefox');
  d = p(UA.ios26Safari);
  assert.deepEqual([d.os, d.osVersion, d.browser, d.browserVersion], ['iOS', '26.0', 'Safari', '26.0'], 'Safari 26 : la vraie version d’iOS, pas le « 18_6 » figé');
  assert.equal(p(UA.ios26Chrome).osVersion, '26.0.1', 'Chrome sur iOS donne la vraie version');
  assert.equal(p(UA.ios18Safari).osVersion, '18.6', 'Safari 18 : inchangé');
  assert.equal(p(UA.ios26App).osVersion, '18.6', 'vue web d’une appli (sans Safari/) : rien de mieux à lire');
  d = p(UA.instagram);
  assert.equal(d.inApp, true, 'navigateur intégré à Instagram');
  d = p(UA.macSafari, { platform: 'MacIntel', maxTouchPoints: 5 });
  assert.deepEqual([d.os, d.osVersion, d.ios, d.browser], ['iPadOS', '17.4', true, 'Safari'], 'iPad (Safari se présente comme un Mac)');
  d = p(UA.macSafari, { platform: 'MacIntel', maxTouchPoints: 0 });
  assert.deepEqual([d.os, d.ios, d.mobile], ['macOS', false, false], 'vrai Mac');
  d = p(UA.edgeWin);
  assert.deepEqual([d.os, d.browser, d.browserVersion, d.mobile], ['Windows', 'Edge', '124', false]);
  d = p('');
  assert.deepEqual([d.os, d.browser], ['inconnu', 'inconnu']);
  assert.equal(I.atLeast('16.4', '16.4'), true);
  assert.equal(I.atLeast('17', '16.4'), true);
  assert.equal(I.atLeast('16.3.1', '16.4'), false);
  assert.equal(I.atLeast('', '16.4'), false);
});

test('mode installé et méthode : vrai bouton (invitation du navigateur), iPhone / iPad, sinon rien', () => {
  assert.equal(I.isStandalone(env(UA.iphoneSafari, { navStandalone: true })), true, 'iPhone : navigator.standalone');
  assert.equal(I.isStandalone(env(UA.androidChrome, { matchMedia: q => q === '(display-mode: standalone)' })), true);
  assert.equal(I.isStandalone(env(UA.androidChrome, { matchMedia: q => q === '(display-mode: minimal-ui)' })), true);
  assert.equal(I.isStandalone(env(UA.androidChrome, { matchMedia: () => { throw new Error('x'); } })), false);
  const m = (ua, o = {}, prompt = false) => I.installMethod(env(ua, o), { prompt });
  assert.equal(m(UA.androidChrome, {}, true), 'prompt', 'Chrome Android : beforeinstallprompt gardé');
  assert.equal(m(UA.edgeWin, {}, true), 'prompt', 'ordinateur : Chrome / Edge');
  assert.equal(m(UA.androidChrome), null, 'sans invitation du navigateur (déjà installé, ou pas encore installable) : rien');
  assert.equal(m(UA.firefoxAndroid), null);
  assert.equal(m(UA.webview), null);
  assert.equal(m(UA.iphoneSafari), 'ios-safari');
  assert.equal(m(UA.macSafari, { platform: 'MacIntel', maxTouchPoints: 5 }), 'ios-safari', 'iPad');
  assert.equal(m(UA.iphoneChrome), 'ios-chrome');
  assert.equal(m(UA.oldChromeIOS), null, 'Chrome avant iOS 16.4 : pas d’ajout à l’écran d’accueil');
  assert.equal(m(UA.firefoxIOS), null);
  assert.equal(m(UA.instagram), null, 'navigateur intégré : rien');
  assert.equal(m(UA.macSafari, { platform: 'MacIntel' }), null, 'Safari sur Mac : rien');
  assert.equal(m(UA.iphoneSafari, { navStandalone: true }), null, 'déjà ouvert depuis l’écran d’accueil : jamais');
  assert.equal(m(UA.androidChrome, { matchMedia: q => q === '(display-mode: standalone)' }, true), null);
});

test('mémoire de l’appareil : « plus tard » = 7 jours, installé = plus d’invitation, stockage illisible sans dégât', () => {
  const st = memoryStorage();
  const T = Date.UTC(2026, 9, 4, 18);
  assert.deepEqual(I.readInstall(st), { v: 1, later: 0, done: 0 });
  assert.equal(I.shouldInvite({ method: 'ios-safari', prefs: I.readInstall(st), now: T }), true);
  I.snooze(st, T);
  const p = I.readInstall(st);
  assert.equal(p.later, T);
  assert.equal(I.shouldInvite({ method: 'ios-safari', prefs: p, now: T + 6.9 * 86400000 }), false, 'moins de 7 jours');
  assert.equal(I.shouldInvite({ method: 'ios-safari', prefs: p, now: T + 7 * 86400000 }), true, 'elle revient dans 7 jours');
  assert.equal(I.shouldInvite({ method: 'ios-safari', prefs: p, now: T - 3600000 }), true, 'horloge revenue en arrière : pas de silence infini');
  I.markInstalled(st, T + 1);
  assert.equal(I.readInstall(st).later, 0);
  assert.equal(I.shouldInvite({ method: 'prompt', prefs: I.readInstall(st), now: T + 30 * 86400000 }), false, 'installé');
  I.clearInstalled(st);
  assert.equal(I.readInstall(st).done, 0);
  assert.equal(I.shouldInvite({ method: null, prefs: I.readInstall(st), now: T }), false, 'aucune installation possible');
  assert.equal(I.shouldInvite({ standalone: true, method: 'prompt', prefs: I.readInstall(st), now: T }), false, 'mode installé');
  /* « C'est fait » sur iPhone et iPad : rien ne le vérifie (S22V-3) ; 30 jours après, toujours dans le navigateur, l'invitation revient */
  const ios = memoryStorage();
  I.markInstalled(ios, T);
  const done = I.readInstall(ios);
  for (const m of ['ios-safari', 'ios-chrome']) {
    assert.equal(I.shouldInvite({ method: m, prefs: done, now: T + 29 * 86400000 }), false, m + ' : moins de 30 jours');
    assert.equal(I.shouldInvite({ method: m, prefs: done, now: T + I.IOS_DONE_DAYS * 86400000 }), true, m + ' : 30 jours après, toujours dans le navigateur');
    assert.equal(I.shouldInvite({ method: m, prefs: done, now: T - 86400000 }), false, m + ' : horloge revenue en arrière');
    assert.equal(I.shouldInvite({ standalone: true, method: m, prefs: done, now: T + 90 * 86400000 }), false, m + ' : ouvert depuis l’icône, jamais');
  }
  assert.equal(I.shouldInvite({ method: 'prompt', prefs: done, now: T + 90 * 86400000 }), false, 'installation vérifiée (appinstalled) : définitive');
  I.snooze(ios, T + 31 * 86400000);
  assert.equal(I.shouldInvite({ method: 'ios-safari', prefs: I.readInstall(ios), now: T + 32 * 86400000 }), false, '✕ après le retour : 7 jours, comme ailleurs');
  assert.equal(I.shouldInvite({ method: 'ios-safari', prefs: I.readInstall(ios), now: T + 38 * 86400000 }), true);
  for (const bad of ['{', 'null', '[]', '{"later":"x","done":-4}', '"oui"']) {
    assert.deepEqual(I.readInstall(memoryStorage({ [I.INSTALL_KEY]: bad })), { v: 1, later: 0, done: 0 }, bad);
  }
  const broken = { getItem() { throw new Error('bloqué'); }, setItem() { throw new Error('bloqué'); } };
  assert.deepEqual(I.readInstall(broken), { v: 1, later: 0, done: 0 });
  assert.equal(I.writeInstall({ later: 1 }, broken), false);
  assert.doesNotThrow(() => I.snooze(broken));
  assert.doesNotThrow(() => I.readInstall(null));
});

test('invitation du navigateur : gardée (sans mini-barre), servie une fois ; appinstalled → installé, tout disparaît', async () => {
  I._reset();
  const st = memoryStorage();
  I.markInstalled(st, 5);
  const target = new EventTarget();
  I.watch(target, st);
  I.watch(target, st);                                   /* une seule fois */
  let changes = 0;
  const off = I.onChange(() => { changes++; });
  assert.equal(I.promptReady(), false);
  assert.equal(await I.prompt(), 'unavailable');
  const ev = new Event('beforeinstallprompt', { cancelable: true });
  let shown = 0;
  ev.prompt = async () => { shown++; };
  ev.userChoice = Promise.resolve({ outcome: 'accepted' });
  target.dispatchEvent(ev);
  assert.equal(ev.defaultPrevented, true, 'pas de mini-barre du navigateur : l’appli choisit son moment');
  assert.equal(I.promptReady(), true);
  assert.equal(I.readInstall(st).done, 0, 'invitation du navigateur = Caramel n’est plus installé');
  assert.equal(changes, 1);
  assert.equal(await I.prompt(), 'accepted');
  assert.equal(shown, 1);
  assert.equal(I.promptReady(), false, 'une invitation ne sert qu’une fois');
  assert.equal(await I.prompt(), 'unavailable');
  target.dispatchEvent(new Event('appinstalled'));
  assert.equal(I.justInstalled(), true);
  assert.ok(I.readInstall(st).done > 0, 'noté sur l’appareil');
  assert.ok(changes >= 3);
  /* refus dans la fenêtre du navigateur */
  const ev2 = new Event('beforeinstallprompt', { cancelable: true });
  ev2.prompt = async () => {};
  ev2.userChoice = Promise.resolve({ outcome: 'dismissed' });
  target.dispatchEvent(ev2);
  assert.equal(I.justInstalled(), false);
  assert.equal(await I.prompt(), 'dismissed');
  off();
  I._reset();
});

test('diagnostic : faits → lignes en mots simples, ✓ / ✗, texte à copier', () => {
  assert.equal(fmtBytes(0), '0\u00A0o');
  assert.equal(fmtBytes(1536), '1,5\u00A0ko');
  assert.equal(fmtBytes(52428800), '50\u00A0Mo');
  assert.equal(fmtBytes(1.25 * 1024 ** 3), '1,3\u00A0Go');
  assert.equal(fmtBytes(NaN), '');
  const good = {
    version: '2.2.2', ua: UA.androidChrome, osVersion: '14', standalone: true, sw: true,
    audio: { supported: true, state: 'running', muted: false },
    rec: { supported: true, total: 349, cached: 120, said: 4, health: 'ok' },
    tts: { api: true, voices: 12, fr: 3, frLocal: 2, voice: 'Français France' },
    mic: { api: true, permission: 'granted', inputs: 1 },
    reco: { vosk: 'downloaded', web: true, google: false }, wasm: true,
    storage: { ok: true, persisted: true, usage: 50 * 1024 ** 2, quota: 2 * 1024 ** 3 }
  };
  const rows = describe(good);
  assert.deepEqual(rows.map(r => r.key), ['version', 'browser', 'os', 'open', 'offline', 'sound', 'rec', 'tts', 'mic', 'reco', 'wasm', 'storage']);
  const by = k => rows.find(r => r.key === k);
  assert.equal(by('version').value, 'Caramel 2.2.2');
  assert.equal(by('browser').value, 'Chrome 141');
  assert.equal(by('os').value, 'Android 14', 'version précise d’Android (userAgentData) plutôt que le « 10 » figé');
  assert.equal(by('open').ok, true);
  assert.match(by('rec').value, /^120 phrases sur 349 sur l’appareil\u202F; 4\u00A0dites depuis l’ouverture$/);
  assert.match(by('tts').value, /3\u00A0voix françaises/);
  assert.equal(by('mic').value, 'autorisé');
  assert.equal(by('storage').value, 'protégé\u202F; 50\u00A0Mo sur 2\u00A0Go');
  assert.ok(rows.every(r => r.ok !== false), 'tout va bien');
  const bad = describe({
    version: '2.2.2', ua: UA.instagram, standalone: false, sw: false,
    audio: { supported: false }, rec: { supported: false }, tts: { api: true, voices: 4, fr: 0 },
    mic: { api: true, permission: 'denied', inputs: 1 }, reco: { vosk: 'no', web: false }, wasm: false, storage: { ok: false }
  });
  const ko = bad.filter(r => r.ok === false).map(r => r.key);
  assert.deepEqual(ko, ['browser', 'sound', 'rec', 'tts', 'mic', 'reco', 'wasm', 'storage']);
  assert.equal(bad.find(r => r.key === 'offline').ok, null, 'première visite : pas encore prêt, ce n’est pas une panne');
  assert.equal(describe({ sw: null }).find(r => r.key === 'offline').ok, false, 'pas de service worker : impossible');
  assert.equal(describe({ rec: { supported: true, total: 349, cached: 0 } }).find(r => r.key === 'rec').value, 'téléchargée à la première écoute');
  assert.equal(bad.find(r => r.key === 'browser').value, 'intégré à une autre appli\u202F: ouvrez Caramel dans Safari');
  assert.equal(describe({ mic: { api: true, inputs: 0 } }).find(r => r.key === 'mic').value, 'aucun micro détecté');
  assert.equal(describe({ mic: { api: true, permission: 'prompt' } }).find(r => r.key === 'mic').ok, null);
  const txt = asText(rows, 'UA-test');
  assert.match(txt, /^Version\u202F: Caramel 2\.2\.2$/m);
  assert.match(txt, /Micro\u202F: autorisé ✓/);
  assert.match(txt, /Agent utilisateur\u202F: UA-test$/);
  for (const r of [...rows, ...bad]) assert.doesNotMatch(r.value, /undefined|NaN|null/, r.key);
});

test('branchements : capturée tôt, une invitation à la fois, fin de création, espace parents', () => {
  const main = code('js/main.js');
  assert.ok(main.indexOf('watchInstall(window)') > 0 && main.indexOf('watchInstall(window)') < main.indexOf('async function boot'), 'main.js : dès le chargement');
  assert.match(main, /classList\.toggle\('has-update', show\)/, 'bandeau de mise à jour signalé (l’accueil range son invitation)');
  const home = code('js/ui/home.js');
  assert.match(home, /!my\.tour && hasSeen\(q, 'tour'\) && !nextBox\.firstChild/, 'jamais avant ni pendant la visite, ni avec la rentrée');
  assert.match(home, /instBan\.show\(false\);/, 'la visite range la bannière');
  assert.match(SRC('css/ui/install.css'), /html\.has-update \.hm-inst-slot/);
  assert.match(SRC('css/ui/install.css'), /\.hm:has\(\.cc\.has-panel\) \.hm-inst-slot/);
  const ui = code('js/ui/install.js');
  assert.match(ui, /if \(!m \|\| standalone\(\)\) return 'none';/, 'feuille : jamais en mode installé ni sans installation possible');
  assert.match(ui, /install\.snooze\(\);\s*hide\(\);/, '✕ : 7 jours');
  /* espace parents (S22V-3, S22V-7, S22V-8) : « Installé ✓ » seulement vérifié ; iPhone « C'est fait » → « Comment faire ? » reste */
  assert.match(ui, /install\.justInstalled\(\) \|\| \(prefs\.done && !m\)/, 'installé : vérifié (appinstalled), jamais sur la seule parole de « C’est fait »');
  assert.match(ui, /Noté comme installé\. Pas d’icône sur l’écran d’accueil \?'\);\s*acts\.appendChild\(howBtn\(\)\);/);
  assert.match(ui, /btn\(frTypo\('Comment faire \?'\)/, 'libellé typographié');
  assert.doesNotMatch(ui, /btn\('[^']*[?!:;]'/, 'aucun libellé de bouton sans frTypo');
  assert.match(ui, /d && d\.android \? 'Dans le menu du navigateur/, 'Firefox, Opera… sur Android : leur menu sait le faire');
  /* Chrome sur iPhone et iPad : Partager, à droite de la barre d'adresse (aide de Google), plus le menu ⋯ (S22V-5) */
  assert.match(ui, /m === 'ios-chrome'\s*\? \[step\(1, w\.touch \+ ' ', key\('share', 'Partager'\), frTypo\(' \(à droite de la barre d’adresse\)\.'\)\)/);
  assert.doesNotMatch(ui, /key\('more'/);
  /* lecture à voix haute côté enfant (S22V-6) : dite à l'ouverture, tue à la fermeture, 🔊 dans la feuille et la bannière */
  assert.match(ui, /if \(said\) \{ try \{ if \(voice\.voiceOn\(\)\) voice\.speak\(said\.open\); \} catch \(_\) \{\} \}/);
  assert.match(ui, /if \(said\) \{ try \{ voice\.hush\(\); \} catch \(_\) \{\} \}/);
  assert.match(ui, /if \(said && voice\.listenOn\(\)\) listen = voice\.listenButton\(\(\) => said\.all, \{ label: 'Écouter encore' \}\)/);
  assert.match(ui, /const said = w\.kid \? kidSpeech\(m\) : null;/, 'côté parents : ni voix ni 🔊');
  assert.match(ui, /if \(voice\.listenOn\(\)\) \{ const t = kidSpeech\(method\(\)\)\.open; listen = voice\.listenButton\(\(\) => t, \{ label: 'Écouter' \}\); \}/, 'bannière : 🔊, jamais de voix toute seule');
  /* iPhone et iPad : l'icône repart de zéro (mémoire séparée de Safari, S22V-2) */
  assert.match(ui, /Caramel ouvert depuis l’icône repart de zéro \(sa mémoire est séparée de Safari\)/);
  assert.match(code('js/ui/onboarding.js'), /offerInstallThen\(\(\) =>/);
  assert.match(code('js/ui/import-eval.js'), /if \(Q\.from === 'onboarding'\) \{ offerInstallThen\(/);
  const pa = code('js/ui/parents.js');
  assert.match(pa, /card\.appendChild\(installRow\(\{ say \}\)\);[\s\S]{0,160}?card\.appendChild\(fluidRow\(\{ say, saved \}\)\);\s*card\.appendChild\(remindersRow\(\)\);/);
  assert.match(pa, /section\('apropos', 'À propos', aboutCard\(\), diagCard\(\)\)/);
  assert.match(pa, /seg\(\[\['on', 'Oui'\], \['off', 'Non'\]\]/, 'lecture à voix haute : Oui / Non');
  /* jamais pendant un jeu : seuls l'accueil, la fin de la création et l'espace parents l'importent */
  for (const f of ['js/ui/game-shell.js', 'js/ui/game-ctx.js', 'js/ui/battle.js', 'js/ui/balade.js']) assert.doesNotMatch(SRC(f), /install\.js/, f);
});
