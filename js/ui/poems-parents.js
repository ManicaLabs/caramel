/* ============ ESPACE PARENTS : « 📜 Mes poésies » (v2.6) ============
   Par enfant : l'adulte tape ou colle la poésie à apprendre (titre, auteur facultatif, texte en vers), la modifie, la
   supprime. Elle apparaît en tête de la course de lecture (js/games/course.js) : l'enfant la lit, puis l'apprend par cœur
   étape par étape (js/content/poems.js). Après chaque enregistrement, Caramel dit quels mots le micro ne connaît pas
   (lexique du modèle Vosk lu sur l'appareil : js/core/lexicon.js) et ce que ça change. Vouvoiement.
   La carte se redessine elle-même (sans redessiner tout l'espace parents). Données : profile.poems (normalisées par
   js/core/profiles.js, dans les sauvegardes du profil). Styles : css/ui/parents.css (bloc « Mes poésies », .pa-poem*). */

import { h, clear, frTypo, dayStr, daysBetween, parseDay } from '../core/util.js';
import * as store from '../core/store.js';
import * as kit from './kit.js';
import * as audio from '../core/audio.js';
import { loadLexicon, LEX_ID } from '../core/lexicon.js';
import {
  POEMS_MAX, TITLE_MAX, AUTHOR_MAX, TEXT_MAX, LINES_MAX, WORDS_MAX, STAGE_MAX, STAGES, stageOf, cleanPoemText, cleanLabel, firstVerse,
  poemLayout, normPoems, newPoemId, poemsOf, oovWords, progressOf
} from '../content/poems.js';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const de = name => (/^[aeiouyàâäéèêëîïôöùûüœh]/i.test(String(name || '')) ? 'd’' : 'de ') + name;
const plural = (n, one, many) => n + '\u00a0' + (n > 1 ? many : one);
function when(d, today = dayStr()) {
  if (!d) return '';
  const k = daysBetween(d, today);
  if (k === 0) return 'aujourd’hui';
  if (k === 1) return 'hier';
  const x = parseDay(d);
  return 'le ' + (x.getDate() === 1 ? '1er' : x.getDate()) + '\u00a0' + MONTHS[x.getMonth()];
}
const safe = fn => { try { return fn(); } catch (e) { console.error('poésies', e); return null; } };

/* vérification des mots en arrière-plan : une tentative ratée (modèle absent) n'est refaite qu'une minute plus tard */
let failedAt = 0;
const RETRY_MS = 60000;
/* mots hors lexique de chaque poésie du profil pas encore vérifiée (ou vérifiée avec un autre modèle) → true si écrit */
async function checkPoems(pid, onlyId = null) {
  const p = store.getProfile(pid);
  const todo = poemsOf(p).filter(x => (onlyId ? x.id === onlyId : x.lex !== LEX_ID));
  if (!todo.length) return { ok: true, changed: false };
  if (!onlyId && failedAt && Date.now() - failedAt < RETRY_MS) return { ok: false, changed: false };
  const lex = await loadLexicon();
  if (!lex) { failedAt = Date.now(); return { ok: false, changed: false }; }
  const has = w => lex.has(w);
  const found = new Map(todo.map(x => [x.id, oovWords(x.text, has)]));
  store.mutateProfile(q => {
    for (const x of poemsOf(q)) if (found.has(x.id)) { x.oov = found.get(x.id); x.lex = LEX_ID; }
  }, pid);
  return { ok: true, changed: true, found };
}

/* phrase pour l'adulte : ce que le micro ne connaît pas, et ce que ça change */
export function oovSentence(oov, name) {
  if (!Array.isArray(oov)) return frTypo('🎤 Les mots seront vérifiés quand le micro de Caramel sera installé sur cet appareil (il se télécharge à la première ouverture).');
  if (!oov.length) return frTypo('🎤 Le micro connaît tous les mots de cette poésie.');
  const digits = oov.some(w => /\d/.test(w));
  return frTypo('🎤 Le micro ne connaît pas ' + (oov.length > 1 ? 'ces ' + oov.length + ' mots' : 'ce mot') + ' : « ' + oov.join(' », « ')
    + ' ». Quand ' + name + (oov.length > 1 ? ' les dit' : ' le dit') + ', Caramel l’accepte sans pouvoir vraiment l’entendre (comme pour un prénom).'
    + (digits ? ' Écrivez plutôt les nombres en lettres (« trois » et non « 3 »).' : ' Si c’est une faute de frappe, corrigez-la.'));
}

/* ---------- la carte ---------- */
export function poemsCard(p) {
  const pid = p && p.id;
  const card = h('div', { class: 'card pa-card pa-poems', id: 'pa-poesies' });
  let msg = null;                                     /* { text, kind } : résultat du dernier enregistrement */
  function render() {
    const q = store.getProfile(pid);
    clear(card);
    if (!q) return;
    const list = poemsOf(q);
    card.append(
      h('h3', { class: 'pa-h3', tabindex: '-1', 'data-fk': 'sec-poesies' }, h('span', { 'aria-hidden': 'true' }, '📜 '), 'Mes poésies'),
      h('p', { class: 'pa-note' }, frTypo('Tapez ou collez la poésie que ' + q.name + ' apprend à l’école. ' + q.name
        + ' la lira à voix haute dans la course de lecture (le micro suit sa lecture), puis l’apprendra par cœur, étape par étape : le texte s’efface peu à peu. Sans chrono, sans étoiles : c’est un entraînement.')));
    if (list.length) card.appendChild(h('ul', { class: 'pa-poem-list' }, list.map(x => poemRow(q, x))));
    else card.appendChild(h('p', { class: 'pa-help pa-poem-empty' }, frTypo('Aucune poésie pour l’instant.')));
    if (msg) card.appendChild(h('p', { class: 'pa-poem-msg' + (msg.kind ? ' is-' + msg.kind : ''), role: 'status' }, msg.text));
    const full = list.length >= POEMS_MAX;
    card.appendChild(h('div', { class: 'pa-actions' },
      h('button', { type: 'button', class: 'btn', disabled: full ? '' : null, 'data-fk': 'poem-add', on: { click: () => { audio.tap(); openEditor(null); } } },
        h('span', { class: 'pa-lbl' }, h('span', { class: 'pa-lbl-emo', 'aria-hidden': 'true' }, '➕\u00a0'), 'Ajouter une poésie'))));
    if (full) card.appendChild(h('p', { class: 'pa-help' }, frTypo(POEMS_MAX + ' poésies au plus : supprimez-en une pour en ajouter une autre.')));
    /* poésies pas encore vérifiées (modèle du micro arrivé depuis, ou changé) : vérifiées en arrière-plan */
    if (list.some(x => x.lex !== LEX_ID)) {
      checkPoems(pid).then(r => { if (r && r.changed && card.isConnected) render(); }, () => {});
    }
  }

  function poemRow(q, x) {
    const pr = progressOf(x);
    const st = stageOf(pr.stage);
    const verses = poemLayout(x.text).verses.length;
    const step = pr.mastered
      ? frTypo('🏆 Sue par cœur' + (x.done ? ' (' + when(x.done) + ')' : '') + ' !')
      : frTypo('Étape ' + pr.stage + ' sur ' + STAGE_MAX + ' : ' + st.emoji + ' ' + st.label);
    const usage = pr.runs
      ? frTypo(plural(pr.runs, 'entraînement', 'entraînements') + (pr.last ? ', le dernier ' + when(pr.last) : ''))
      : frTypo('Pas encore lue');
    return h('li', { class: 'pa-poem' },
      h('div', { class: 'pa-poem-head' },
        h('span', { class: 'pa-poem-title' }, x.title),
        x.author ? h('span', { class: 'pa-poem-author' }, x.author) : null),
      h('p', { class: 'pa-poem-step' }, step, h('span', { class: 'pa-poem-meta' }, ' · ' + plural(verses, 'vers', 'vers') + ' · ' + usage)),
      h('ol', { class: 'pa-poem-ladder', 'aria-label': 'Étapes' }, STAGES.map(s => h('li', {
        class: 'pa-poem-rung' + (s.n <= pr.best ? ' is-done' : s.n === pr.stage && !pr.mastered ? ' is-cur' : ''),
        title: s.label, 'aria-label': s.label + (s.n <= pr.best ? ' : réussie' : s.n === pr.stage && !pr.mastered ? ' : en cours' : '')
      }, h('span', { 'aria-hidden': 'true' }, s.emoji)))),
      /* mots que le micro ne connaît pas (sauf juste après l'enregistrement : le message sous la liste le dit déjà) */
      msg && msg.id === x.id ? null : h('p', { class: 'pa-help pa-poem-oov' + (x.lex === LEX_ID && x.oov && x.oov.length ? ' is-warn' : '') },
        oovSentence(x.lex === LEX_ID ? x.oov || [] : null, q.name)),
      h('div', { class: 'pa-poem-acts' },
        h('button', { type: 'button', class: 'btn small white', 'data-fk': 'poem-edit-' + x.id, on: { click: () => { audio.tap(); openEditor(x.id); } } },
          h('span', { 'aria-hidden': 'true' }, '✏️ '), 'Modifier'),
        h('button', { type: 'button', class: 'btn small white', 'data-fk': 'poem-del-' + x.id, on: { click: () => { audio.tap(); remove(x.id); } } },
          h('span', { 'aria-hidden': 'true' }, '🗑️ '), 'Supprimer')));
  }

  async function remove(id) {
    const q = store.getProfile(pid);
    const x = poemsOf(q).find(e => e.id === id);
    if (!x) return;
    const yes = await kit.confirmSheet(frTypo('Supprimer « ' + x.title + ' » ? Sa progression sera perdue.'), { ok: 'Supprimer', cancel: 'Garder', icon: '🗑️' });
    if (!yes) return;
    store.mutateProfile(r => { r.poems = poemsOf(r).filter(e => e.id !== id); if (!r.poems.length) delete r.poems; }, pid);
    msg = { text: frTypo('Poésie supprimée.'), kind: '' };
    kit.toast('Poésie supprimée');
    render();
  }

  /* ---------- feuille d'écriture (ajout ou modification) ---------- */
  function openEditor(id) {
    const q = store.getProfile(pid);
    if (!q) return;
    const old = id ? poemsOf(q).find(e => e.id === id) : null;
    if (!old && poemsOf(q).length >= POEMS_MAX) return;
    const uid = 'pa-poem-' + Math.random().toString(36).slice(2, 7);
    const title = h('input', { class: 'input', type: 'text', id: uid + '-t', maxlength: String(TITLE_MAX), autocomplete: 'off', enterkeyhint: 'next',
      placeholder: 'Ex. : Le Lièvre et la Tortue', value: old ? old.title : '' });
    const author = h('input', { class: 'input', type: 'text', id: uid + '-a', maxlength: String(AUTHOR_MAX), autocomplete: 'off', enterkeyhint: 'next',
      placeholder: 'Ex. : Jean de La Fontaine', value: old && old.author ? old.author : '' });
    const text = h('textarea', { class: 'input pa-poem-text', id: uid + '-x', rows: '10', maxlength: String(TEXT_MAX + 400), spellcheck: 'true',
      autocapitalize: 'sentences', 'aria-describedby': uid + '-h ' + uid + '-e', placeholder: 'Un vers par ligne.\nUne ligne vide entre deux strophes.' });
    text.value = old ? old.text.replace(/\u202f/g, ' ') : '';
    const err = h('p', { class: 'pa-poem-err', id: uid + '-e', role: 'alert' });
    const form = h('div', { class: 'pa-poem-form' },
      h('div', { class: 'field' }, h('label', { for: uid + '-t' }, 'Titre'), title),
      h('div', { class: 'field' }, h('label', { for: uid + '-a' }, 'Auteur (facultatif)'), author),
      h('div', { class: 'field' }, h('label', { for: uid + '-x' }, 'Le texte de la poésie'), text,
        h('p', { class: 'pa-help', id: uid + '-h' }, frTypo('Un vers par ligne, une ligne vide entre deux strophes ; le titre et l’auteur vont dans leurs cases. Recopiez-la exactement : '
          + q.name + ' apprendra ce texte tel quel. Écrivez les nombres en lettres.'))),
      err);
    const save = () => {
      const t = cleanPoemText(text.value);
      const n = poemLayout(t).n;
      if (!n) { err.textContent = frTypo('Tapez au moins un vers.'); text.setAttribute('aria-invalid', 'true'); safe(() => text.focus()); return false; }
      /* bornes atteintes (TEXT_MAX caractères, LINES_MAX lignes, WORDS_MAX mots) : la fin a été coupée */
      const shorter = n < String(text.value).split(/\s+/).filter(w => /[\p{L}\d]/u.test(w)).length;
      const entry = {
        ...(old || {}),
        id: old ? old.id : newPoemId(poemsOf(q)),
        title: cleanLabel(title.value, TITLE_MAX) || firstVerse(t),
        text: t,
        created: old && old.created ? old.created : dayStr()
      };
      const au = cleanLabel(author.value, AUTHOR_MAX);
      if (au) entry.author = au; else delete entry.author;
      if (!old || old.text !== t) { delete entry.lex; delete entry.oov; }   /* texte changé : mots à revérifier */
      store.mutateProfile(r => {
        const cur = poemsOf(r);
        r.poems = normPoems(old ? cur.map(e => (e.id === old.id ? entry : e)) : [entry, ...cur]);
      }, pid);
      audio.tap();
      const cutTxt = shorter ? ' La fin a été coupée : ' + TEXT_MAX + ' caractères, ' + LINES_MAX + ' lignes et ' + WORDS_MAX + ' mots au plus.' : '';
      msg = { id: entry.id, text: frTypo('✓ « ' + entry.title + ' » est enregistrée.' + cutTxt + ' Je vérifie les mots…'), kind: '' };
      render();
      checkPoems(pid, entry.id).then(r => {
        const x = poemsOf(store.getProfile(pid)).find(e => e.id === entry.id);
        if (!x) return;
        const name = (store.getProfile(pid) || {}).name || '';
        const checked = !!(r && r.ok && x.lex === LEX_ID);
        msg = { id: x.id, text: frTypo('✓ « ' + x.title + ' » est enregistrée.' + cutTxt + ' ') + oovSentence(checked ? x.oov || [] : null, name),
          kind: !checked ? '' : x.oov && x.oov.length ? 'warn' : 'ok' };
        kit.toast('Poésie enregistrée ✓', 1800);
        if (card.isConnected) render();
      }, () => {});
      return true;
    };
    text.addEventListener('input', () => { text.removeAttribute('aria-invalid'); err.textContent = ''; });
    kit.sheet({
      title: old ? 'Modifier la poésie' : 'Ajouter une poésie',
      content: form,
      actions: [{ label: 'Annuler', kind: 'white' }, { label: 'Enregistrer', onClick: () => save() }]
    });
    setTimeout(() => safe(() => (old ? text : title).focus({ preventScroll: true })), 60);
  }

  render();
  return card;
}
