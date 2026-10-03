/* ============ « MES PROGRÈS » (enfant) — JEUX.md §8, CDC §9 ============
   Deux radars (Français, Maths) au gabarit de la classe (radarTemplate) : polygone actuel plein
   (currentValues), fiche officielle en pointillés (referenceValues), étincelles ✨ sur les axes en progrès
   (inProgress), axes sans jeu en v2.0 grisés « bientôt » ; animation de la fiche vers l'actuel.
   Médailles par axe (economy.badgeOf : bronze / argent / or), message d'encouragement.
   Bienveillance (CDC §1, §7.6) : aucun chiffre de θ, aucun niveau scolaire, aucune note. */

import { h, clear, loadCSS, dayStr, frTypo } from '../core/util.js';
import * as store from '../core/store.js';
import * as router from '../router.js';
import { radarTemplate, AXES, SUBJECTS } from '../core/axes.js';
import { currentValues, referenceValues, inProgress } from '../core/radar-model.js';
import { badgeOf } from '../core/economy.js';
import { fillTemplate } from '../core/profiles.js';
import { GAMES } from '../games/index.js';
import { MOUNTS } from '../content/companion-data.js';
import { renderRadar, radarReady } from './radar.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const TIERS = { or: { label: 'Or', rank: 0 }, argent: { label: 'Argent', rank: 1 }, bronze: { label: 'Bronze', rank: 2 } };
/* axes entraînés par au moins un jeu de la v2.0 (axe principal ou secondaire, ex. compréhension dans la course) */
const TRAINED = new Set(GAMES.flatMap(g => g.axes || []));

let radars = [];
let timers = [];
let unsub = null;

/* « a, b et c » */
function listFr(items) {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + ' et ' + items[items.length - 1];
}
/* mois de la dernière fiche importée (« septembre »), ou '' */
function ficheMonth(profile) {
  const evals = Array.isArray(profile.evals) ? profile.evals : [];
  let best = '';
  for (const e of evals) if (e && typeof e.date === 'string' && e.date > best) best = e.date;
  const m = /^\d{4}-(\d{2})/.exec(best);
  return m ? MONTHS[Number(m[1]) - 1] || '' : '';
}
/* « de septembre », « d’août », « d’octobre » */
const deMonth = m => (/^[aeiouyéèêàâîôû]/i.test(m) ? 'd’' : 'de ') + m;

function legendItem(kind, text) {
  const sw = h('span', { class: 'pg-key pg-key--' + kind, 'aria-hidden': 'true' }, kind === 'star' ? '✨' : null);
  return h('span', { class: 'pg-legend-item' }, sw, text);
}

function medal(id, tier, i) {
  const def = AXES[id];
  return h('li', { class: 'pg-medal pg-medal--' + tier, style: { '--i': String(i) } },
    h('span', { class: 'pg-medal-disc', 'aria-hidden': 'true' }, h('span', { class: 'pg-medal-emo' }, def.emoji || '⭐')),
    h('span', { class: 'pg-medal-name' }, def.child),
    h('span', { class: 'pg-medal-tier' }, 'Médaille ' + (tier === 'or' ? 'd’or' : tier === 'argent' ? 'd’argent' : 'de bronze')));
}

function render(root) {
  radars.forEach(r => { try { r.destroy(); } catch (_) {} });
  radars = [];
  clear(root);
  const today = dayStr();
  const profile = store.getProfile();

  const back = h('button', { type: 'button', class: 'back', 'aria-label': 'Retour à l’accueil', on: { click: () => { audio.tap(); router.back(); } } }, '←');
  const top = h('div', { class: 'topbar' }, back, h('h1', { class: 'topbar-title' }, 'Mes progrès 📈'), h('span', { class: 'pg-top-gap', 'aria-hidden': 'true' }));
  const screen = h('div', { class: 'screen pg-screen' }, top);
  root.appendChild(screen);

  if (!profile) {
    screen.appendChild(h('div', { class: 'card pg-empty' },
      h('p', { class: 'subtitle' }, 'Choisis d’abord ton profil pour voir tes progrès.'),
      h('button', { type: 'button', class: 'btn block mt-2', on: { click: () => router.go('home') } }, 'Retour à l’accueil 🏠')));
    return;
  }

  const classe = profile.classe || 'CM2';
  const fill = s => frTypo(fillTemplate(s, profile));
  const mount = MOUNTS[profile.companion && profile.companion.type] || MOUNTS.pony;

  /* ---------- données des deux radars ---------- */
  const subjects = ['fr', 'ma'].map(subject => {
    const tpl = radarTemplate(classe, subject);
    const values = currentValues(profile, tpl);
    const ref = referenceValues(profile, subject);
    const twinkle = tpl.axes.filter(a => TRAINED.has(a.id) && inProgress(profile, a.id, today)).map(a => a.id);
    const dim = tpl.axes.filter(a => !TRAINED.has(a.id)).map(a => a.id);
    return { subject, tpl, values, ref, twinkle, dim };
  });
  const progressing = [];
  subjects.forEach(s => s.twinkle.forEach(id => { if (!progressing.includes(id)) progressing.push(id); }));
  const known = subjects.some(s => Object.values(s.values).some(v => typeof v === 'number'));
  const month = ficheMonth(profile);
  const hasRef = subjects.some(s => s.ref);

  /* ---------- message d'encouragement ---------- */
  let headline, msg;
  if (progressing.length) {
    headline = fill('Bravo {P} !');
    const names = progressing.slice(0, 3).map(id => '« ' + AXES[id].child + ' »');
    msg = 'Tu progresses ! Regarde les étoiles qui brillent sur ' + listFr(names) + (progressing.length > 3 ? ', et ailleurs encore' : '') + ' ✨';
  } else if (known) {
    headline = fill('Ton radar, {P}');
    msg = 'Chaque partie fait grandir ton radar. Continue comme ça, tu avances bien !';
  } else {
    headline = fill('Ton radar t’attend, {P} !');
    msg = 'Joue à ta balade du jour : ton radar va se remplir au fil des parties.';
  }
  const hero = h('section', { class: 'card pg-hero', 'aria-live': 'polite' },
    h('div', { class: 'pg-hero-ava anim-float', 'aria-hidden': 'true' }, mount.em),
    h('div', { class: 'pg-hero-txt' },
      h('h2', { class: 'pg-hero-title' }, frTypo(headline)),
      h('p', { class: 'pg-hero-msg' }, frTypo(msg))));
  screen.appendChild(hero);

  /* ---------- légende ---------- */
  const legend = h('div', { class: 'pg-legend' },
    hasRef ? legendItem('ref', month ? 'Ta fiche ' + deMonth(month) : 'Ta fiche') : null,
    legendItem('cur', 'Maintenant'),
    progressing.length ? legendItem('star', 'En progrès') : null);
  screen.appendChild(legend);

  /* ---------- radars ---------- */
  const grid = h('div', { class: 'pg-radars' });
  screen.appendChild(grid);
  const cards = [];
  for (const s of subjects) {
    const subj = SUBJECTS[s.subject];
    const label = s.subject === 'fr' ? 'Français' : 'Maths';
    const holder = h('div', { class: 'pg-radar' });
    const card = h('section', { class: 'card pg-card pg-card--' + s.subject, 'aria-label': label },
      h('h2', { class: 'pg-card-title' }, h('span', { class: 'pg-card-emo', 'aria-hidden': 'true' }, subj.emoji), label),
      holder);
    grid.appendChild(card);
    cards.push(card);
    radars.push(renderRadar(holder, {
      template: s.tpl, values: s.values, reference: s.ref, subject: s.subject, labels: 'child',
      twinkle: s.twinkle, dim: s.dim, nullLabel: 'à découvrir', size: 440,
      title: 'Ton radar de ' + (s.subject === 'fr' ? 'français' : 'maths')
    }));
  }

  /* ---------- médailles ---------- */
  const seen = new Set();
  const medals = [];
  for (const s of subjects) {
    for (const a of s.tpl.axes) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      const tier = badgeOf(s.values[a.id]);
      if (tier) medals.push({ id: a.id, tier });
    }
  }
  medals.sort((x, y) => TIERS[x.tier].rank - TIERS[y.tier].rank);
  const medalSec = h('section', { class: 'pg-medals-sec', 'aria-labelledby': 'pg-medals-t' },
    h('h2', { class: 'section-title', id: 'pg-medals-t' }, 'Mes médailles 🏅'));
  if (medals.length) {
    medalSec.appendChild(h('ul', { class: 'pg-medals' }, medals.map((m, i) => medal(m.id, m.tier, i))));
  } else {
    medalSec.appendChild(h('div', { class: 'card dashed pg-medals-empty' },
      h('span', { class: 'pg-medals-empty-emo', 'aria-hidden': 'true' }, '🏅'),
      h('p', null, frTypo('Tes premières médailles arrivent bientôt : continue à jouer !'))));
  }
  screen.appendChild(medalSec);

  screen.appendChild(h('button', { type: 'button', class: 'btn white block pg-home', on: { click: () => { audio.tap(); router.go('home'); } } }, 'Retour à l’accueil 🏠'));

  /* ---------- chorégraphie d'ouverture ---------- */
  motion.enter(hero, { from: 'top', dur: 420 });
  motion.stagger(cards, el => motion.enter(el, { from: 'bottom' }), 110);
  const medalEls = [...medalSec.querySelectorAll('.pg-medal')];
  if (medalEls.length) {
    medalEls.forEach(el => el.classList.add('is-waiting'));
    timers.push(setTimeout(() => {
      medalEls.forEach(el => { el.classList.remove('is-waiting'); el.classList.add('anim-spin-in'); });
      try { audio.success(2); } catch (_) {}
    }, motion.reduced() ? 0 : 900));
  }
}

export default {
  async mount(root) {
    await Promise.race([Promise.all([loadCSS('css/ui/progres.css'), radarReady()]), new Promise(r => setTimeout(r, 1200))]);
    try { document.title = 'Mes progrès · Caramel'; } catch (_) {}
    render(root);
    /* un autre onglet / la manche modifie le profil : on redessine (rare ici) */
    let lastActive = store.getData().active;
    unsub = store.subscribe(d => { if (d.active !== lastActive) { lastActive = d.active; render(root); } });
  },
  unmount() {
    timers.forEach(t => clearTimeout(t));
    timers = [];
    radars.forEach(r => { try { r.destroy(); } catch (_) {} });
    radars = [];
    if (unsub) { unsub(); unsub = null; }
  }
};
