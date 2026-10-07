/* ============ ESPACE PARENTS : « 📝 La dictée de la semaine » (v2.6, décisions du parent du 07/10/2026) ============
   Par enfant : l'adulte TAPE la liste de mots de la semaine (souvent recopiée à la main par l'enfant dans son cahier) —
   un mot par ligne ou séparés par des virgules, 1 à 20 mots, phrase facultative après « : » —, la modifie, la vide ;
   « ▶ » fait entendre un mot comme il sera dicté (« mot… phrase… mot », lentement) ; la date de la liste ; les mots que
   l'enfant a marqués « À revoir » à sa dernière dictée. Le jeu : js/games/dictee.js ; la logique : js/core/dictee.js.
   La carte se redessine elle-même (sans redessiner tout l'espace parents). Données : profile.dictee (normalisée par
   js/core/profiles.js, dans les sauvegardes du profil). Vouvoiement. Styles : css/ui/parents.css (bloc « La dictée de la
   semaine », .pa-dc*). */

import { h, clear, frTypo, dayStr, daysBetween, parseDay } from '../core/util.js';
import * as store from '../core/store.js';
import * as kit from './kit.js';
import * as audio from '../core/audio.js';
import * as voice from './voice.js';
import { fillTemplate } from '../core/profiles.js';
import { MAX_WORDS, parseList, listText, listOf, wordState, playRitual } from '../core/dictee.js';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const plural = (n, one, many) => n + '\u00a0' + (n > 1 ? many : one);
const safe = fn => { try { return fn(); } catch (e) { console.error('dictée (parents)', e); return null; } };
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
/* « du mardi 7 octobre » (+ « , il y a 9 jours » au-delà d'une semaine : une nouvelle liste ?) */
function dateLabel(d, today = dayStr()) {
  if (!d) return '';
  const x = parseDay(d);
  const k = daysBetween(d, today);
  const base = (k === 0 ? 'd’aujourd’hui' : k === 1 ? 'd’hier' : 'du ' + DAYS[x.getDay()] + ' ' + (x.getDate() === 1 ? '1er' : x.getDate()) + '\u00a0' + MONTHS[x.getMonth()]);
  return k >= 7 ? base + ', il y a ' + plural(k, 'jour', 'jours') : base;
}

/* brouillon en cours, par profil (un redessin de l'espace parents ne le perd pas) */
const drafts = new Map();
/* « ▶ » en cours : un seul mot à la fois */
let playing = null;

export const EXAMPLE = 'maison : Je rentre à la maison.\nun chat\nvert : Le pré est vert.\nla forêt, le loup, aujourd’hui';

/* la carte (redessinée sur place) */
export function dicteeCard(p) {
  const id = p.id;
  const card = h('div', { class: 'card pa-card pa-dc', id: 'pa-dictee' });
  const draw = (focus = null) => {
    const q = store.getProfile(id);
    if (!q || !card) return;
    clear(card);
    const N = safe(() => fillTemplate('{N}', q)) || 'Caramel';
    card.append(
      h('h3', { class: 'pa-h3', tabindex: '-1' }, h('span', { 'aria-hidden': 'true' }, '📝 '), 'La dictée de la semaine'),
      h('p', { class: 'pa-note' }, frTypo('Tapez les mots de la liste de la semaine : ' + N + ' les dictera à ' + q.name
        + ' lentement, comme en classe (« le mot… une phrase… le mot »). ' + q.name + ' écrit sur une feuille, puis compare avec le mot juste et se corrige '
        + (q.g === 'm' ? 'seul' : 'seule') + '. Les mots à revoir reviennent en premier la fois suivante.')));
    const words = listOf(q);
    if (drafts.has(id) || !words.length) card.appendChild(editor(q, words, draw));
    else card.appendChild(listView(q, words, draw));
    if (focus) {
      const el = card.querySelector(focus);
      if (el) { try { el.focus({ preventScroll: true }); } catch (_) {} }
    }
  };
  draw();
  return card;
}

/* ---------- la liste enregistrée ---------- */
function listView(q, words, draw) {
  const id = q.id;
  const today = dayStr();
  const d = isObj(q.dictee) ? q.dictee.d : '';
  const review = words.filter(e => wordState(q, e.w, today) === 'revoir').length;
  const head = h('p', { class: 'pa-dc-head' },
    h('strong', null, frTypo('Liste ' + dateLabel(d, today))), ' · ', plural(words.length, 'mot', 'mots'),
    review ? h('span', { class: 'pa-dc-rev-n' }, ' · ' + plural(review, 'mot', 'mots') + ' à revoir') : null);
  const list = h('ul', { class: 'pa-dc-list' }, words.map(e => {
    const st = wordState(q, e.w, today);
    const play = h('button', { type: 'button', class: 'pa-dc-play', 'aria-label': 'Écouter « ' + e.w + ' » comme dans la dictée' },
      h('span', { 'aria-hidden': 'true' }, '▶'));
    play.addEventListener('click', () => listenWord(e, play));
    return h('li', { class: 'pa-dc-item' + (st === 'revoir' ? ' is-rev' : '') },
      play,
      h('span', { class: 'pa-dc-txt' },
        h('span', { class: 'pa-dc-w', lang: 'fr' }, e.w),
        e.s ? h('span', { class: 'pa-dc-s' }, frTypo(e.s)) : null),
      st === 'revoir' ? h('span', { class: 'pa-dc-tag' }, 'à revoir') : null);
  }));
  const edit = h('button', { type: 'button', class: 'btn small white', 'data-fk': 'dc-edit' },
    h('span', { 'aria-hidden': 'true' }, '✏️ '), 'Modifier la liste');
  edit.addEventListener('click', () => { audio.tap(); drafts.set(id, listText(store.getProfile(id).dictee)); draw('.pa-dc-text'); });
  const empty = h('button', { type: 'button', class: 'btn small white pa-dc-clear', 'data-fk': 'dc-clear' },
    h('span', { 'aria-hidden': 'true' }, '🗑️ '), 'Vider la liste');
  empty.addEventListener('click', async () => {
    audio.tap();
    const ok = await kit.confirmSheet(frTypo('Vider la liste de ' + q.name + ' ? Les mots ne seront plus dictés (ce que ' + q.name + ' a déjà réussi reste dans ses progrès).'),
      { ok: 'Vider', cancel: 'Garder', icon: '🗑️' });
    if (!ok) return;
    stopListen();
    store.mutateProfile(x => { delete x.dictee; }, id);
    drafts.delete(id);
    saved('Liste vidée');
    draw('.pa-dc-text');
  });
  const help = h('p', { class: 'pa-help' }, frTypo('« ▶ » : le mot tel qu’il sera dicté. '
    + (review ? '« À revoir » : ' + q.name + ' l’a marqué ainsi à la dernière dictée ; il sera dicté en premier. ' : '')
    + 'Dans la balade du jour, la dictée prend 6 à 10 mots ; dans « 🎲 Jeux », toute la liste.'));
  return h('div', { class: 'pa-dc-view' }, head, list, help, h('div', { class: 'pa-actions' }, edit, empty));
}

/* ---------- taper ou modifier la liste ---------- */
function editor(q, words, draw) {
  const id = q.id;
  const field = h('textarea', { class: 'input pa-dc-text', id: 'pa-dc-text-' + id, rows: '7', spellcheck: 'true', autocapitalize: 'none',
    autocomplete: 'off', 'aria-describedby': 'pa-dc-help-' + id + ' pa-dc-count-' + id, placeholder: EXAMPLE, 'data-fk': 'dc-text' });
  field.value = drafts.has(id) ? drafts.get(id) : listText(q.dictee);
  const count = h('p', { class: 'pa-dc-count', id: 'pa-dc-count-' + id, role: 'status' });
  const paint = () => {
    const r = parseList(field.value);
    const bits = [];
    bits.push(r.words.length ? plural(r.words.length, 'mot', 'mots') + (r.words.some(e => e.s) ? ' (dont ' + plural(r.words.filter(e => e.s).length, 'phrase', 'phrases') + ')' : '') : 'Aucun mot pour l’instant');
    if (r.extra) bits.push(plural(r.extra, 'mot ignoré', 'mots ignorés') + ' : ' + MAX_WORDS + ' au plus');
    if (r.dup) bits.push(plural(r.dup, 'doublon retiré', 'doublons retirés'));
    count.textContent = frTypo(bits.join(' · '));
    count.classList.toggle('is-warn', !!(r.extra || r.dup));
    save.disabled = !r.words.length;
  };
  field.addEventListener('input', () => { drafts.set(id, field.value); paint(); });
  const save = h('button', { type: 'button', class: 'btn small', 'data-fk': 'dc-save' }, 'Enregistrer la liste');
  save.addEventListener('click', () => {
    const r = parseList(field.value);
    if (!r.words.length) { try { field.focus(); } catch (_) {} return; }
    stopListen();
    store.mutateProfile(x => { x.dictee = { words: r.words, d: dayStr() }; }, id);
    drafts.delete(id);
    audio.tap();
    saved(frTypo('Liste enregistrée ✓ ' + plural(r.words.length, 'mot', 'mots')));
    draw('[data-fk="dc-edit"]');
  });
  const acts = [save];
  if (words.length) {
    const cancel = h('button', { type: 'button', class: 'btn small white', 'data-fk': 'dc-cancel' }, 'Annuler');
    cancel.addEventListener('click', () => { audio.tap(); drafts.delete(id); draw('[data-fk="dc-edit"]'); });
    acts.push(cancel);
  }
  const box = h('div', { class: 'pa-dc-form' },
    h('label', { class: 'pa-row-label', for: 'pa-dc-text-' + id }, words.length ? 'Modifier les mots' : 'Les mots de la semaine'),
    field,
    count,
    h('p', { class: 'pa-help', id: 'pa-dc-help-' + id }, frTypo('Un mot par ligne, ou plusieurs séparés par des virgules (' + MAX_WORDS
      + ' au plus). Écrivez-les exactement comme sur la liste (accents, majuscules). Phrase facultative après deux-points : « maison : Je rentre à la maison. » Elle aide à distinguer les mots qui se prononcent pareil (vert, verre, ver).')),
    h('div', { class: 'pa-actions' }, ...acts));
  paint();
  return box;
}

/* ---------- « ▶ » : un mot comme dans la dictée (geste explicite : dit même si les sons de l'enfant sont coupés) ---------- */
function stopListen() {
  if (!playing) return;
  playing.stop = true;
  if (playing.btn) playing.btn.classList.remove('is-on');
  playing = null;
  voice.hush();
}
function listenWord(entry, btn) {
  const was = playing && playing.btn === btn;
  stopListen();
  if (was) return;
  const me = playing = { btn, stop: false };
  btn.classList.add('is-on');
  const alive = () => playing === me && !me.stop && btn.isConnected;
  let heard = false;
  playRitual(entry, {
    speak: (t, slow) => voice.speak(t, { force: true, slow }).then(r => { if (r) heard = true; return r; }),
    wait: ms => new Promise(r => setTimeout(r, ms)),
    alive
  }).then(() => {
    const cut = !alive();                 /* coupé : autre ▶, écran quitté */
    if (playing === me) { playing = null; btn.classList.remove('is-on'); }
    if (!heard && !cut) safe(() => kit.toast(frTypo('La voix n’a pas pu parler : voyez « ▶ Tester la voix » dans les réglages.'), 3200));
  });
}

function saved(msg) { safe(() => kit.toast(msg, 1600)); }
