/* Banc d'essai des jeux (cf. game.html). Monte un jeu comme la coquille réelle, sans toucher à la vraie sauvegarde. */
import * as store from '../../js/core/store.js';
import { defaultProfile } from '../../js/core/profiles.js';
import { createManche } from '../../js/core/manche.js';
import { ensureToday } from '../../js/core/session.js';
import { loadGenerator, hasGenerator } from '../../js/content/index.js';
import { loadGame, GAME_BY_ID } from '../../js/games/index.js';
import { h, loadCSS, dayStr } from '../../js/core/util.js';
import { buildCtx } from '../../js/ui/game-ctx.js';
import { createHeader } from '../../js/ui/game-header.js';
import * as audio from '../../js/core/audio.js';
import * as motion from '../../js/core/motion.js';

const ROOT = new URL('../../', import.meta.url);
const q = new URLSearchParams(location.search);
const id = q.get('id') || 'tables';
const today = q.get('today') || dayStr();
const H = window.__h = { ready: false, items: [], reports: [], summary: null, summaries: [], quit: null, left: null, error: null };

/* sauvegarde en mémoire */
const mem = new Map();
const storage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };

async function main() {
  /* ?module=… : charger un module de jeu hors registre (ex. demo-game.js) ; ?gen=… : injecter un générateur */
  let custom = null, injected = null;
  if (q.get('module')) custom = (await import(new URL(q.get('module'), location.href).href)).default;
  if (q.get('gen')) injected = await import(new URL(q.get('gen'), location.href).href);
  const game = custom
    ? { id: custom.id, title: custom.title, icon: custom.icon, axes: custom.axes, primary: custom.axes[0] }
    : GAME_BY_ID[id];
  if (!game) throw new Error('Jeu inconnu : ' + id);
  store.init(storage, today);
  const p = defaultProfile({ id: 'p1', name: q.get('name') || 'Léa', g: q.get('g') || 'f', classe: q.get('classe') || 'CM2', today });
  p.companion.type = q.get('mount') || 'pony';
  p.companion.name = q.get('mountName') || 'Caramel';
  if (!p.companion.owned.includes(p.companion.type)) p.companion.owned.push(p.companion.type);
  /* accessoires portés (worn=chapeau,foulard) et minutes d'apprentissage (stade : 0 petit, 60 junior, 300 champion) */
  if (q.get('worn')) { const w = q.get('worn').split(',').filter(Boolean); p.companion.equip.owned = w.slice(); p.companion.equip.worn = w.slice(); }
  if (q.get('minutes')) p.companion.minutes = Math.max(0, Number(q.get('minutes')) || 0);
  Object.assign(p.settings, {
    timers: q.get('timers') === '1',
    subMethod: q.get('sub') || 'compensation',
    sound: q.get('sound') !== '0',
    motion: q.get('motion') || 'full',
    sessionMin: Number(q.get('session') || 15)
  });
  const theta = q.get('theta');
  if (theta !== null) for (const ax of game.axes) p.skills[ax] = { t: Number(theta), n: 4, last: today, trend: 0, src: 'eval' };
  if (q.get('mclm')) p.mclm = q.get('mclm').split(',').map((v, i) => ({ d: today, t: Date.now() - 1e6 + i, s: 'pomme', v: Number(v), p: 95, z: 80 }));
  if (q.get('stars')) for (const kv of q.get('stars').split(',')) { const [k, v] = kv.split(':'); p.wallet.stars[k] = Number(v); }
  store.addProfile(p);
  if (q.get('theme')) p.settings.theme = q.get('theme');
  try { document.documentElement.dataset.theme = p.settings.theme || 'caramel'; } catch (_) {}
  audio.setMuted(p.settings.sound === false);
  motion.setMode(p.settings.motion);

  const mode = q.get('mode') || 'libre';
  let blockIdx = null;
  if (mode === 'balade') {
    store.mutateProfile(pp => ensureToday(pp, today));
    const plan = store.getProfile().today;
    const i = plan && plan.blocks ? plan.blocks.findIndex(b => b.game === id) : -1;
    blockIdx = i >= 0 ? i : null;
  }
  if (!injected) await Promise.all(game.axes.filter(hasGenerator).map(loadGenerator));
  const mod = custom || await loadGame(id);
  if (mod.css) await loadCSS(new URL(mod.css, ROOT).href);

  const makeManche = () => createManche({
    gameId: game.id, mode, blockIdx, today,
    ...(custom ? { axis: game.primary, count: Number(q.get('count') || 6) } : {}),
    ...(injected ? { generators: { [injected.axis]: injected } } : {}),
    count: q.get('count') ? Number(q.get('count')) : undefined,
    seed: q.get('seed') ? Number(q.get('seed')) : undefined
  });

  const app = document.getElementById('app');
  const body = h('main', { class: 'game-body' });
  let ctx = null;
  const header = createHeader({
    icon: mod.icon || game.icon, title: '', hints: 2,
    onBack: () => ctx && ctx.quit(),
    onJoker: () => ctx && ctx._joker()
  });
  app.appendChild(h('div', { class: 'screen is-full game-screen' }, header.el, body));

  ctx = buildCtx({
    game, makeManche, mode, header,
    onEnd: (summary, extra) => { H.summary = summary; H.summaries.push(summary); if (!extra.stay) showSummary(summary, extra); return summary; },
    onQuit: summary => { H.quit = summary || { aborted: true }; showSummary(H.quit, null); },
    onLeave: summary => { H.left = summary || { left: true }; showSummary(H.left, { leave: true }); }
  });
  header.setTitle(ctx.fill(game.title), ctx.fill(game.short || game.title));
  /* enregistrement pour le pilotage automatisé */
  const nextItem = ctx.nextItem, report = ctx.report;
  ctx.nextItem = (ax, opts) => { const it = nextItem(ax, opts); if (it) H.items.push(it); H.current = it; return it; };
  ctx.report = (item, outcome) => { const fb = report(item, outcome); H.reports.push({ key: item && item.key, outcome, fb }); return fb; };
  Object.assign(H, { ctx, game: mod, store, header });
  Object.defineProperty(H, 'manche', { get: () => ctx.manche });

  await mod.mount(body, ctx);
  H.ready = true;
}

function showSummary(summary, extra) {
  const box = h('div', { class: 'h-summary' }, 'FIN DE MANCHE\n' + JSON.stringify({ summary, extra }, null, 1));
  document.body.appendChild(box);
}

main().catch(e => { H.error = String(e && e.stack || e); console.error(e); document.body.appendChild(h('pre', { class: 'h-summary' }, H.error)); });
