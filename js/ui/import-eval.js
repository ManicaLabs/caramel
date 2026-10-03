/* ============ IMPORT DE LA FICHE D'ÉVALUATION (#/import) — CDC §8, annexe A ; JEUX.md §8 ============
   Query : from = 'onboarding' | 'parents' | … (retour : onboarding → #/home, parents → #/parents, sinon retour),
           method = 'photo' | 'manual' | 'file' (sinon écran de choix), profile = profil visé (défaut : actif).
   (a) FICHIER caramel-eval (annexe A) : profil cible (même prénom présélectionné ; sinon créer le profil ou le
       rattacher à un profil existant, avec option de renommer celui-ci) → applyEval (+ classe si absente) → résumé.
       Une sauvegarde caramel-save choisie ici est restaurée (backup.restoreFlow).
   (b) SAISIE MANUELLE : classe + matière → radar interactif au gabarit de la FICHE (ficheTemplate)
       → ficheToAxes → applyEval.
   (c) PHOTO (CDC §8.2) : classe → photo (<input capture>) → matière détectée par la teinte (modifiable) → photo en
       fond semi-transparent, alignement en 2 touches (centre = cartable ; haut du cercle +++ → rayon et rotation),
       puis gros plan sur le radar : réglages fins (rotation, ±½ pas d'axe si le gabarit n'est pas exact, rayon),
       poignées glissées sur les sommets (aimantées à 0,1), « absent » par axe → récapitulatif → applyEval.
       La photo n'est JAMAIS stockée : URL d'objet révoquée dès qu'elle ne sert plus (enregistrement, sortie).
   Les deux matières à la suite (« Ajouter la fiche de maths »).
   Toute écriture passe par store.addProfile / store.mutateProfile. */

import { h, clear, loadCSS, dayStr, frTypo, fmtNum } from '../core/util.js';
import * as store from '../core/store.js';
import * as router from '../router.js';
import { CLASSES, SUBJECTS, ficheTemplate, ficheToAxes, radarTemplate } from '../core/axes.js';
import { applyEval } from '../core/adaptive.js';
import { referenceValues } from '../core/radar-model.js';
import { defaultProfile, setClasse, sanitizeName } from '../core/profiles.js';
import { MOUNTS } from '../content/companion-data.js';
import * as kit from './kit.js';
import * as motion from '../core/motion.js';
import * as audio from '../core/audio.js';
import { renderRadar, radarReady, levelText } from './radar.js';
import * as backup from './backup.js';

const G = globalThis;
const PARENTS_SEL = 'caramel-parents-sel';   /* sessionStorage : profil à afficher au retour dans l'espace parents */
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const SUBJ = {
  fr: { the: 'de français', title: 'Français', emo: SUBJECTS.fr.emoji },
  ma: { the: 'de maths', title: 'Maths', emo: SUBJECTS.ma.emoji }
};
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const plural = (n, one, many) => fmtNum(n) + '\u00A0' + (n > 1 ? many : one);

/* ---------- état de l'écran ---------- */
let host = null;              /* conteneur de la vue (routeur) */
let Q = {};                   /* paramètres de la route */
let flow = null;              /* { targetId, classe, done: Set, values: { fr, ma }, photoSubject, align, date } */
let photo = null;             /* { url, img, natW, natH, detected } — jamais stockée */
let live = null;              /* zone aria-live */
let cleanups = [];

function cleanupStep() { for (const fn of cleanups.splice(0)) { try { fn(); } catch (_) {} } }
const later = fn => { const t = setTimeout(fn, 0); cleanups.push(() => clearTimeout(t)); };
function say(msg) {
  if (!live) return;
  const el = live;
  el.textContent = '';
  setTimeout(() => { if (el.isConnected) el.textContent = msg; }, 40);
}
function releasePhoto() {
  if (!photo) return;
  try { photo.img.removeAttribute('src'); } catch (_) {}
  try { URL.revokeObjectURL(photo.url); } catch (_) {}
  photo = null;
}
function monthLabel(ym) {
  const m = /^(\d{4})-(\d{2})/.exec(String(ym || ''));
  return m ? MONTHS[Number(m[2]) - 1] + ' ' + m[1] : '';
}
/* mois de l'année scolaire en cours, de septembre au mois actuel (au plus juin) */
function schoolMonths(today) {
  const y = Number(today.slice(0, 4)), mo = Number(today.slice(5, 7));
  const y0 = mo >= 9 ? y : y - 1;
  const out = [];
  for (let k = 0; k < 10; k++) {
    const yy = k < 4 ? y0 : y0 + 1, mm = ((8 + k) % 12) + 1;
    const ym = yy + '-' + String(mm).padStart(2, '0');
    if (ym > today.slice(0, 7) && k > 0) break;
    out.push(ym);
  }
  return out;
}
function histDepth() {
  try { const s = G.history.state; return s && Number.isInteger(s.caramel) ? s.caramel : 0; } catch (_) { return 0; }
}

/* ---------- navigation ---------- */
function target() { return flow && flow.targetId ? store.getProfile(flow.targetId) : null; }
function nextSubject() { return ['fr', 'ma'].find(g => !flow.done.has(g)) || null; }
/* sortie de l'écran (← à la première étape, « Terminer », « Plus tard ») */
function leave() {
  releasePhoto();
  const id = flow && flow.targetId;
  if (Q.from === 'onboarding') { router.go('home', { replace: true }); return; }
  if (Q.from === 'parents') {
    try { if (id) G.sessionStorage.setItem(PARENTS_SEL, id); } catch (_) {}
    if (histDepth() > 0) router.back();
    else router.go('parents', { replace: true });
    return;
  }
  router.back();
}
/* retour à l'écran de choix, ou sortie si la méthode était imposée par le lien */
function backToStart() {
  if (Q.method === 'photo' || Q.method === 'manual' || Q.method === 'file') leave();
  else renderChoose();
}

/* ---------- briques ---------- */
function screen(title, onBack, ...children) {
  if (!host) return null;               /* écran démonté entre-temps (fichier lu, feuille fermée…) */
  cleanupStep();
  clear(host);
  live = h('div', { class: 'sr-only', 'aria-live': 'polite' });
  const back = h('button', { type: 'button', class: 'back', 'aria-label': onBack ? 'Étape précédente' : 'Quitter l’import',
    on: { click: () => { audio.tap(); (onBack || leave)(); } } }, '←');
  const el = h('div', { class: 'screen im-screen' },
    h('div', { class: 'topbar' }, back, h('h1', { class: 'topbar-title' }, title), h('span', { class: 'im-gap', 'aria-hidden': 'true' })),
    live, ...children);
  host.appendChild(el);
  try { G.scrollTo(0, 0); } catch (_) {}
  motion.stagger([...el.children].filter(c => c !== live && !c.classList.contains('topbar')), c => motion.enter(c, { from: 'bottom', dist: 12, dur: 380 }), 50);
  return el;
}
/* groupe de boutons exclusifs (radiogroup) → { el, set(v) } */
function seg(options, value, onPick, label, cls = '') {
  const box = h('div', { class: 'seg im-seg ' + cls, role: 'radiogroup', 'aria-label': label });
  const btns = options.map(([v, text]) => h('button', { type: 'button', role: 'radio', class: v === value ? 'on' : null,
    'aria-checked': v === value ? 'true' : 'false', 'data-v': String(v) }, text));
  const set = v => btns.forEach(b => { const on = b.dataset.v === String(v); b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
  box.append(...btns);
  box.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || !box.contains(b)) return;
    const opt = options.find(o => String(o[0]) === b.dataset.v);
    if (!opt) return;
    audio.tap();
    set(opt[0]);
    onPick(opt[0]);
  });
  return { el: box, set };
}
function field(label, control, help) {
  return h('div', { class: 'im-field' }, h('div', { class: 'im-label' }, label), control, help ? h('p', { class: 'im-help' }, frTypo(help)) : null);
}
function avatarOf(p) { const m = MOUNTS[p && p.companion && p.companion.type] || MOUNTS.pony; return m.em; }
function notice(text, kind = 'soft') {
  return h('div', { class: 'bubble im-bubble ' + kind, role: kind === 'soft' ? 'alert' : 'status' }, frTypo(text));
}

/* ============ 0. CHOIX DE LA MÉTHODE ============ */
function renderChoose() {
  const p = target();
  const opt = (emo, title, sub, method) => h('button', { type: 'button', class: 'card tap im-method', 'data-method': method,
    on: { click: () => { audio.tap(); start(method); } } },
  h('span', { class: 'im-method-emo', 'aria-hidden': 'true' }, emo),
  h('span', { class: 'im-method-txt' }, h('span', { class: 'im-method-t' }, title), h('span', { class: 'im-method-s' }, frTypo(sub))),
  h('span', { class: 'im-method-go', 'aria-hidden': 'true' }, '›'));
  screen('Fiche d’évaluation', null,
    h('div', { class: 'card im-intro' },
      h('div', { class: 'im-intro-ico', 'aria-hidden': 'true' }, '📄', h('span', { class: 'im-intro-star' }, '✨')),
      h('p', { class: 'im-lead' }, p ? 'La fiche Repères de ' + p.name : 'La fiche Repères'),
      h('p', { class: 'im-note' }, frTypo('Avec la fiche de restitution des évaluations nationales, Caramel démarre directement au bon niveau. La photo et les résultats restent sur cet appareil.'))),
    h('div', { class: 'im-methods' },
      opt('📷', 'Photo de la fiche', 'Vous placez les points du radar sur la photo.', 'photo'),
      opt('✋', 'Saisie manuelle', 'Vous recopiez le radar, compétence par compétence.', 'manual'),
      opt('📄', 'Fichier', 'Un fichier « caramel-eval », ou une sauvegarde Caramel à restaurer.', 'file')),
    Q.from === 'onboarding'
      ? h('button', { type: 'button', class: 'btn ghost block im-later', on: { click: () => { audio.tap(); leave(); } } }, 'Plus tard')
      : null);
}
function start(method) {
  if (method === 'file') { renderFile(); return; }
  if (!target()) { renderNoProfile(method); return; }
  if (method === 'photo') renderPhotoStart();
  else renderManualSetup();
}
function renderNoProfile() {
  screen('Fiche d’évaluation', backToStart,
    h('div', { class: 'card im-intro' },
      h('div', { class: 'im-intro-ico', 'aria-hidden': 'true' }, '🧒'),
      h('p', { class: 'im-lead' }, 'Créons d’abord le profil de l’enfant'),
      h('p', { class: 'im-note' }, frTypo('La fiche sera ensuite rattachée à son profil. Un fichier « caramel-eval » peut aussi créer le profil tout seul.'))),
    h('div', { class: 'im-actions' },
      h('button', { type: 'button', class: 'btn big block', on: { click: () => { audio.tap(); router.go('onboarding'); } } }, 'Créer un profil ➕'),
      h('button', { type: 'button', class: 'btn white block', on: { click: () => { audio.tap(); renderFile(); } } }, h('span', { 'aria-hidden': 'true' }, '📄'), 'Importer un fichier')));
}

/* ============ (a) FICHIER ============ */
function renderFile(err) {
  const stashed = backup.takeStash();
  if (stashed && stashed.kind === 'eval' && stashed.payload) { renderFileTarget(stashed); return; }
  let busy = false;
  const pick = async () => {
    if (busy) return;
    busy = true;
    audio.tap();
    const f = await backup.pickFile();
    busy = false;
    if (!f || !host) return;
    let text = '';
    try { text = await backup.readFileText(f); } catch (_) { renderFile('Ce fichier n’a pas pu être lu.'); return; }
    if (!host) return;
    const parsed = backup.parseBackup(text);
    if (parsed.errors.length) { audio.soft(); renderFile(parsed.errors.join(' ')); return; }
    if (parsed.kind === 'eval') { renderFileTarget(parsed); return; }
    const res = await backup.restoreFlow(parsed, { store, kit });
    if (!res || !host) return;
    audio.success(3);
    if (res.ids && res.ids[0]) flow.targetId = res.ids[0];
    leave();
  };
  screen('Fichier', backToStart,
    h('div', { class: 'card im-intro' },
      h('div', { class: 'im-intro-ico', 'aria-hidden': 'true' }, '📄'),
      h('p', { class: 'im-lead' }, 'Choisir un fichier'),
      h('p', { class: 'im-note' }, frTypo('Un fichier d’évaluation « caramel-eval » (.json), ou une sauvegarde Caramel à restaurer sur cet appareil.'))),
    err ? notice(err) : null,
    h('button', { type: 'button', class: 'btn big block im-pick', on: { click: pick } }, h('span', { 'aria-hidden': 'true' }, '📂'), 'Choisir le fichier'));
  if (err) say(err);
}

function renderFileTarget(parsed) {
  const { profil, evaluation, counts } = parsed.payload;
  const name = profil.prenom || '';
  const classe = evaluation.classe || profil.classe || null;
  const list = store.listProfiles();
  const same = name ? list.find(q => backup.sameName(q.name, name)) : null;
  const cur = target();
  let choice = same ? same.id : (Q.from === 'onboarding' && cur) ? cur.id : (name || !cur ? 'new' : cur.id);
  let rename = false;

  /* carte du fichier */
  const lines = [];
  for (const g of ['fr', 'ma']) {
    const vals = Object.values(evaluation[g] || {});
    if (!vals.length) continue;
    const abs = vals.filter(v => v === null).length;
    lines.push(h('div', { class: 'im-file-l' }, h('span', { 'aria-hidden': 'true' }, SUBJ[g].emo + ' '),
      frTypo((g === 'fr' ? 'Français' : 'Maths') + ' : ' + plural(vals.length, 'compétence', 'compétences') + (abs ? ' (' + plural(abs, 'absence', 'absences') + ')' : ''))));
  }
  const fileCard = h('div', { class: 'card im-file' },
    h('div', { class: 'im-file-t' }, h('span', { 'aria-hidden': 'true' }, '📄 '),
      ['Évaluation ' + (evaluation.source || 'Repères'), monthLabel(evaluation.date), classe].filter(Boolean).join(' · ')),
    h('div', { class: 'im-file-who' }, name ? name + (profil.g ? (profil.g === 'm' ? ' · garçon' : ' · fille') : '') : 'Prénom non indiqué dans le fichier'),
    ...lines,
    evaluation.precision ? h('div', { class: 'im-file-m' }, evaluation.precision) : null,
    parsed.warnings.length ? h('div', { class: 'im-file-m' }, parsed.warnings.join(' ')) : null);

  /* choix du profil */
  const nameInput = h('input', { class: 'input im-name', type: 'text', maxlength: '14', value: name, autocomplete: 'off',
    'aria-label': 'Prénom du nouveau profil', enterkeyhint: 'done' });
  const renameSw = h('span', { class: 'switch', 'aria-hidden': 'true' });
  const renameBtn = h('button', { type: 'button', class: 'im-switch', role: 'switch', 'aria-checked': 'false' },
    h('span', { class: 'im-switch-l' }), renameSw);
  const renameRow = h('div', { class: 'im-rename' }, renameBtn);
  renameBtn.addEventListener('click', () => {
    rename = !rename;
    renameBtn.setAttribute('aria-checked', rename ? 'true' : 'false');
    renameSw.setAttribute('aria-checked', rename ? 'true' : 'false');
    audio.tap();
  });
  const opts = [];
  const optEl = (id, ava, title, meta, tag) => {
    const b = h('button', { type: 'button', role: 'radio', class: 'im-target', 'data-id': id, 'aria-checked': 'false' },
      h('span', { class: 'im-target-ava', 'aria-hidden': 'true' }, ava),
      h('span', { class: 'im-target-txt' }, h('span', { class: 'im-target-t' }, title), meta ? h('span', { class: 'im-target-m' }, meta) : null),
      tag ? h('span', { class: 'im-tag' }, tag) : null,
      h('span', { class: 'im-target-dot', 'aria-hidden': 'true' }));
    opts.push(b);
    return b;
  };
  const group = h('div', { class: 'im-targets', role: 'radiogroup', 'aria-label': 'Profil qui reçoit l’évaluation' },
    list.map(q => optEl(q.id, avatarOf(q), q.name, [q.classe || 'classe à choisir', q.companion && q.companion.name ? 'avec ' + q.companion.name : ''].filter(Boolean).join(' · '),
      same && q.id === same.id ? 'même prénom' : null)),
    same ? null : optEl('new', '➕', name ? frTypo('Nouveau profil : ' + name) : 'Nouveau profil', classe ? 'classe de ' + classe : null));
  const newRow = h('div', { class: 'im-newname' }, field('Prénom du nouveau profil', nameInput));
  const refresh = () => {
    opts.forEach(b => { const on = b.dataset.id === choice; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
    const q = choice !== 'new' ? store.getProfile(choice) : null;
    const canRename = !!(q && name && !backup.sameName(q.name, name));
    renameRow.hidden = !canRename;
    if (canRename) renameBtn.firstChild.textContent = frTypo('Renommer « ' + q.name + ' » en « ' + name + ' »');
    newRow.hidden = choice !== 'new' || !!name;
  };
  group.addEventListener('click', e => {
    const b = e.target.closest('.im-target');
    if (!b) return;
    audio.tap();
    choice = b.dataset.id;
    rename = false;
    renameBtn.setAttribute('aria-checked', 'false');
    renameSw.setAttribute('aria-checked', 'false');
    refresh();
  });

  const apply = () => {
    const today = dayStr();
    let id = choice;
    if (choice === 'new') {
      const nm = sanitizeName(name || nameInput.value, '');
      if (!nm) { kit.gentleWrong(nameInput); nameInput.focus(); say('Indiquez le prénom de l’enfant.'); return; }
      const prev = store.getData().active;
      id = store.addProfile(defaultProfile({ name: nm, g: profil.g || 'f', classe, today }));
      /* depuis l'espace parents, l'enfant actif ne change pas */
      if (Q.from !== 'onboarding' && prev && prev !== id && store.getProfile(prev)) store.setActive(prev);
    }
    if (!store.getProfile(id)) return;
    let res = null;
    store.mutateProfile(q => {
      if (rename && choice !== 'new' && name) { q.name = sanitizeName(name, q.name); if (profil.g) q.g = profil.g; }
      if (!q.classe && classe) setClasse(q, classe, today);
      res = applyEval(q, evaluation, today);
    }, id);
    flow.targetId = id;
    const subjects = ['fr', 'ma'].filter(g => Object.keys(evaluation[g] || {}).length);
    subjects.forEach(g => flow.done.add(g));
    renderDone({ kind: 'file', subjects, res, created: choice === 'new' });
  };

  screen('Fichier d’évaluation', () => renderFile(),
    fileCard,
    h('h2', { class: 'section-title im-h2' }, frTypo('Pour quel enfant ?')),
    group, newRow, renameRow,
    h('button', { type: 'button', class: 'btn big block im-go', on: { click: () => { audio.tap(); apply(); } } }, 'Importer l’évaluation ✓'));
  refresh();
  say('Fichier lu : ' + (counts.fr + counts.ma) + ' compétences.');
}

/* ============ (b) SAISIE MANUELLE ============ */
function classeField(p, onPick) {
  const s = seg(CLASSES.map(c => [c, c]), flow.classe || (p && p.classe) || null, onPick, 'Classe de la fiche');
  return field('Classe de la fiche', s.el, p && p.classe ? null : 'La classe de l’enfant sera enregistrée en même temps.');
}
function renderManualSetup(subject) {
  const p = target();
  if (!p) { renderNoProfile(); return; }
  let classe = flow.classe || p.classe || null;
  let subj = subject || nextSubject() || 'fr';
  const go = h('button', { type: 'button', class: 'btn big block', on: { click: () => {
    if (!classe) { kit.gentleWrong(go); say('Choisissez d’abord la classe de la fiche.'); return; }
    audio.tap();
    flow.classe = classe;
    renderManualRadar(subj);
  } } }, 'Continuer ➜');
  const setGo = () => go.setAttribute('aria-disabled', classe ? 'false' : 'true');
  const subjSeg = seg([['fr', SUBJ.fr.emo + ' Français'], ['ma', SUBJ.ma.emo + ' Maths']], subj, v => { subj = v; }, 'Matière');
  screen('Saisie manuelle', backToStart,
    h('div', { class: 'card im-card' },
      h('div', { class: 'im-who' }, h('span', { class: 'im-who-ava', 'aria-hidden': 'true' }, avatarOf(p)), h('span', null, 'Fiche de ' + p.name)),
      classeField(p, v => { classe = v; setGo(); }),
      field('Matière', subjSeg.el, 'La fiche de français est gris-vert (turquoise sur le PDF), celle de maths orange.')),
    go);
  setGo();
}

function renderManualRadar(subject) {
  const p = target();
  const tpl = ficheTemplate(flow.classe, subject);
  const prev = flow.values[subject];
  let values = prev && prev.classe === flow.classe && prev.v.length === tpl.axes.length ? prev.v.slice() : tpl.axes.map(() => undefined);
  const holder = h('div', { class: 'im-radar' });
  const editorHost = h('div', { class: 'im-editor' });
  const progress = h('p', { class: 'im-progress', 'aria-live': 'polite' });
  let r = null;
  const upd = () => {
    const left = values.filter(v => v === undefined).length;
    progress.textContent = left ? frTypo(plural(tpl.axes.length - left, 'compétence placée', 'compétences placées') + ' sur ' + tpl.axes.length) : 'Toutes les compétences sont placées ✓';
    progress.classList.toggle('is-done', !left);
    flow.values[subject] = { classe: flow.classe, v: values.slice() };
  };
  const check = () => {
    const first = values.findIndex(v => v === undefined);
    if (first >= 0) {
      const left = values.filter(v => v === undefined).length;
      const msg = 'Il reste ' + plural(left, 'compétence', 'compétences') + ' à placer (« Absent » si elle n’a pas été évaluée).';
      kit.toast(frTypo(msg), 2600);
      say(msg);
      if (r) r.select(first);
      return;
    }
    audio.tap();
    renderRecap('manual', subject, tpl, values);
  };
  screen(SUBJ[subject].title + ' · ' + flow.classe, () => renderManualSetup(subject),
    h('p', { class: 'im-note im-howto' }, frTypo('Recopiez chaque point de la fiche : glissez la poignée le long de son axe, ou touchez une compétence puis réglez avec − et +. « Absent » si l’enfant n’a pas été positionné.')),
    h('div', { class: 'card im-radar-card im-radar-card--' + subject }, holder),
    editorHost, progress,
    h('button', { type: 'button', class: 'btn big block', on: { click: check } }, 'Vérifier ➜'));
  upd();
  later(() => {
    if (!holder.isConnected) return;
    r = renderRadar(holder, {
      template: tpl, values, subject, labels: 'official', showValues: true, animate: false, size: 620,
      title: 'Fiche ' + SUBJ[subject].the + ' de ' + p.name,
      interactive: { snap: 0.1, absent: true, editor: editorHost, onChange: (i, v, all) => { values = all; upd(); } }
    });
    cleanups.push(() => r.destroy());
  });
}

/* ============ (c) PHOTO ============ */
/* matière d'après la teinte moyenne des pixels colorés : turquoise / gris-vert → français ; orange → maths */
export function detectSubject(img) {
  try {
    const S = 80;
    const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = ratio >= 1 ? S : Math.max(8, Math.round(S * ratio));
    c.height = ratio >= 1 ? Math.max(8, Math.round(S / ratio)) : S;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, c.width, c.height);
    return subjectFromPixels(x.getImageData(0, 0, c.width, c.height).data);
  } catch (_) { return null; }
}
export function subjectFromPixels(d) {
  let fr = 0, ma = 0;
  for (let i = 0; i + 2 < d.length; i += 4) {
    const R = d[i] / 255, Gr = d[i + 1] / 255, B = d[i + 2] / 255;
    const mx = Math.max(R, Gr, B), mn = Math.min(R, Gr, B), dd = mx - mn;
    const s = mx ? dd / mx : 0;
    if (s < 0.12 || mx < 0.3 || dd < 0.04) continue;
    let hue = mx === R ? 60 * (((Gr - B) / dd) % 6) : mx === Gr ? 60 * ((B - R) / dd + 2) : 60 * ((R - Gr) / dd + 4);
    if (hue < 0) hue += 360;
    if (hue >= 8 && hue <= 50) ma += s;
    else if (hue >= 140 && hue <= 215) fr += s;
  }
  if (fr + ma < 1.5) return null;
  if (ma > fr * 1.3) return 'ma';
  if (fr > ma * 1.3) return 'fr';
  return null;
}

function renderPhotoStart(err) {
  const p = target();
  if (!p) { renderNoProfile(); return; }
  let classe = flow.classe || p.classe || null;
  const inCam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
  const inGal = h('input', { type: 'file', accept: 'image/*', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
  const onFile = e => {
    const f = e.target.files && e.target.files[0];
    try { e.target.value = ''; } catch (_) {}
    if (f) { flow.classe = classe; loadPhoto(f); }
  };
  inCam.addEventListener('change', onFile);
  inGal.addEventListener('change', onFile);
  const ask = input => () => {
    if (!classe) { kit.gentleWrong(cam); say('Choisissez d’abord la classe de la fiche.'); return; }
    audio.tap();
    try { input.click(); } catch (_) {}
  };
  const cam = h('button', { type: 'button', class: 'btn big block im-cam', on: { click: ask(inCam) } }, h('span', { 'aria-hidden': 'true' }, '📷'), 'Prendre la photo');
  const gal = h('button', { type: 'button', class: 'btn white block im-gal', on: { click: ask(inGal) } }, h('span', { 'aria-hidden': 'true' }, '🖼️'), 'Choisir une image');
  const setBtns = () => { cam.setAttribute('aria-disabled', classe ? 'false' : 'true'); gal.setAttribute('aria-disabled', classe ? 'false' : 'true'); };
  const next = nextSubject();
  screen('Photo de la fiche', backToStart,
    h('div', { class: 'card im-card' },
      h('div', { class: 'im-who' }, h('span', { class: 'im-who-ava', 'aria-hidden': 'true' }, avatarOf(p)),
        h('span', null, (flow.done.size && next ? 'Fiche ' + SUBJ[next].the + ' de ' : 'Fiche de ') + p.name)),
      h('ol', { class: 'im-steps' },
        h('li', null, frTypo('Posez la fiche bien à plat, avec une bonne lumière, et photographiez tout le radar.')),
        h('li', null, frTypo('Touchez le cartable au centre, puis le haut du grand cercle : le gabarit se cale sur la photo.')),
        h('li', null, frTypo('Glissez chaque point sur celui de la fiche, puis vérifiez.'))),
      classeField(p, v => { classe = v; flow.classe = v; setBtns(); }),
      h('p', { class: 'im-private' }, h('span', { 'aria-hidden': 'true' }, '🔒 '), frTypo('La photo reste sur ce téléphone : elle n’est ni enregistrée ni envoyée.'))),
    err ? notice(err) : null,
    h('div', { class: 'im-actions' }, cam, gal), inCam, inGal);
  setBtns();
  if (err) say(err);
}

function loadPhoto(file) {
  releasePhoto();
  let url = '';
  try { url = URL.createObjectURL(file); } catch (_) { renderPhotoStart('Cette image n’a pas pu être ouverte. Essayez une autre photo.'); return; }
  const img = new Image();
  img.alt = '';
  img.decoding = 'async';
  img.className = 'im-photo';
  img.draggable = false;
  img.onload = () => {
    if (!host || !img.naturalWidth) { try { URL.revokeObjectURL(url); } catch (_) {} return; }
    photo = { url, img, natW: img.naturalWidth, natH: img.naturalHeight, detected: detectSubject(img) };
    flow.photoSubject = photo.detected || nextSubject() || 'fr';
    flow.align = null;
    renderPhotoAlign();
  };
  img.onerror = () => {
    try { URL.revokeObjectURL(url); } catch (_) {}
    if (host) renderPhotoStart('Cette image n’a pas pu être ouverte. Essayez une autre photo.');
  };
  img.src = url;
}

/* scène : la photo (ou une partie : view, en pixels de l'image) affichée dans la largeur du conteneur */
function makeStage(cls) {
  const stage = h('div', { class: 'im-stage ' + cls });
  const geo = { k: 1, ox: 0, oy: 0, W: 0, H: 0, view: { x: 0, y: 0, w: 1, h: 1 } };
  const layout = (view, { maxH = 0, square = false } = {}) => {
    const W = Math.round(stage.clientWidth || 0);
    if (W < 60 || !photo) return false;
    let k = W / view.w, H = square ? W : view.h * k;
    if (!square && maxH && H > maxH) { k = maxH / view.h; H = maxH; }
    const ox = (W - view.w * k) / 2, oy = (H - view.h * k) / 2;
    Object.assign(geo, { k, ox, oy, W, H: Math.round(H), view });
    /* hauteur de la boîte intérieure = H exactement (la bordure s'ajoute) : repère 1:1 avec le radar superposé */
    const bh = Math.max(0, stage.offsetHeight - stage.clientHeight);
    stage.style.height = (Math.round(H) + bh) + 'px';
    const img = photo.img;
    img.style.width = (photo.natW * k).toFixed(2) + 'px';
    img.style.height = (photo.natH * k).toFixed(2) + 'px';
    img.style.transform = 'translate(' + (ox - view.x * k).toFixed(2) + 'px, ' + (oy - view.y * k).toFixed(2) + 'px)';
    return true;
  };
  const toStage = (ix, iy) => [geo.ox + (ix - geo.view.x) * geo.k, geo.oy + (iy - geo.view.y) * geo.k];
  const toImage = (sx, sy) => [geo.view.x + (sx - geo.ox) / geo.k, geo.view.y + (sy - geo.oy) / geo.k];
  return { stage, geo, layout, toStage, toImage };
}
function observe(el, fn) {
  let raf = 0, lastW = -1;
  const run = () => { raf = 0; const w = el.clientWidth; if (w !== lastW) { lastW = w; fn(); } };
  try {
    const ro = new ResizeObserver(() => { if (!raf) raf = requestAnimationFrame(run); });
    ro.observe(el);
    cleanups.push(() => { ro.disconnect(); if (raf) cancelAnimationFrame(raf); });
  } catch (_) {
    const on = () => fn();
    G.addEventListener('resize', on);
    cleanups.push(() => G.removeEventListener('resize', on));
  }
}

function subjectRow() {
  const det = photo && photo.detected;
  const s = seg([['fr', SUBJ.fr.emo + ' Français'], ['ma', SUBJ.ma.emo + ' Maths']], flow.photoSubject, v => {
    if (v !== flow.photoSubject) { flow.photoSubject = v; say('Matière : ' + (v === 'fr' ? 'français' : 'maths')); }
  }, 'Matière de la fiche', 'im-seg-subj');
  return field('Matière', s.el, det ? 'Reconnue d’après la couleur de la fiche ; touchez l’autre matière si besoin.' : 'Choisissez la matière de cette fiche.');
}

function renderPhotoAlign() {
  if (!photo) { renderPhotoStart(); return; }
  const S = makeStage('is-align');
  const { stage } = S;
  stage.appendChild(photo.img);
  const markC = h('span', { class: 'im-mark im-mark--c', 'aria-hidden': 'true', hidden: true });
  const markT = h('span', { class: 'im-mark im-mark--t', 'aria-hidden': 'true', hidden: true });
  const ring = h('span', { class: 'im-ring', 'aria-hidden': 'true', hidden: true });
  stage.append(ring, markC, markT);
  let taps = [];
  const instr = h('div', { class: 'im-instr', role: 'status' });
  const setInstr = () => {
    clear(instr);
    const n = taps.length;
    instr.append(h('span', { class: 'im-instr-n' }, (n + 1) + '/2'),
      h('span', { class: 'im-instr-t' }, n === 0
        ? frTypo('Touchez le centre du radar : le cartable 🎒')
        : frTypo('Touchez maintenant le haut du grand cercle (+++)')));
  };
  const place = () => {
    if (!S.layout({ x: 0, y: 0, w: photo.natW, h: photo.natH }, { maxH: Math.max(280, Math.round((G.innerHeight || 700) * 0.62)) })) return;
    const pos = (el, p) => { const [x, y] = S.toStage(p[0], p[1]); el.style.transform = 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px)'; };
    markC.hidden = taps.length < 1;
    markT.hidden = taps.length < 2;
    if (taps[0]) pos(markC, taps[0]);
    if (taps[1]) pos(markT, taps[1]);
  };
  const tap = (sx, sy) => {
    const [ix, iy] = S.toImage(sx, sy);
    if (ix < -20 || iy < -20 || ix > photo.natW + 20 || iy > photo.natH + 20) return;
    if (taps.length === 1) {
      const d = Math.hypot(ix - taps[0][0], iy - taps[0][1]) * S.geo.k;
      if (d < 24) { say('Touchez plus loin du centre : le haut du grand cercle.'); kit.toast(frTypo('Un peu plus loin du centre : le haut du grand cercle.')); return; }
    }
    taps.push([ix, iy]);
    place();
    const mk = taps.length === 1 ? markC : markT;
    motion.pop(mk, { scale: 1.4, dur: 300 });
    if (taps.length === 1) {
      audio.tap();
      setInstr();
      say('Centre placé. Touchez maintenant le haut du grand cercle.');
      return;
    }
    const [c, t] = taps;
    const dx = t[0] - c[0], dy = t[1] - c[1];
    flow.align = { cx: c[0], cy: c[1], R: Math.hypot(dx, dy), rot: Math.atan2(dx, -dy) * 180 / Math.PI, off: 0 };
    audio.success(2);
    say('Gabarit calé sur la photo.');
    const t2 = setTimeout(() => { if (host) renderPhotoPoints(); }, motion.reduced() ? 60 : 320);
    cleanups.push(() => clearTimeout(t2));
  };
  let down = null;
  stage.addEventListener('pointerdown', e => { if (e.button > 0) return; down = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
  stage.addEventListener('pointerup', e => {
    if (!down || e.pointerId !== down.id) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 12) return;                      /* glissement = défilement, pas une touche */
    const r = stage.getBoundingClientRect();
    /* repère de la photo = boîte intérieure de la scène (sans sa bordure) */
    tap(e.clientX - r.left - stage.clientLeft, e.clientY - r.top - stage.clientTop);
  });
  stage.addEventListener('pointercancel', () => { down = null; });
  const reset = h('button', { type: 'button', class: 'btn white small', on: { click: () => { audio.tap(); taps = []; place(); setInstr(); say('Alignement remis à zéro.'); } } }, 'Recommencer');
  /* repli sans toucher précis (clavier, lecteur d'écran) : gabarit centré sur la photo, à ajuster ensuite */
  const auto = h('button', { type: 'button', class: 'btn ghost small', on: { click: () => {
    audio.tap();
    const m = Math.min(photo.natW, photo.natH);
    flow.align = { cx: photo.natW / 2, cy: photo.natH / 2, R: m * 0.36, rot: 0, off: 0 };
    renderPhotoPoints();
  } } }, 'Centrer sans toucher');
  screen('Caler le gabarit', () => { releasePhoto(); renderPhotoStart(); },
    subjectRow(), instr, stage, h('div', { class: 'im-row im-row--tools' }, reset, auto));
  setInstr();
  stage.setAttribute('aria-label', 'Photo de la fiche');
  place();
  observe(stage, place);
}

function renderPhotoPoints() {
  if (!photo || !flow.align) { renderPhotoAlign(); return; }
  const p = target();
  const subject = flow.photoSubject;
  const tpl = ficheTemplate(flow.classe, subject);
  const step = 360 / tpl.axes.length;
  const prev = flow.values['photo-' + subject];
  let values = prev && prev.classe === flow.classe && prev.v.length === tpl.axes.length ? prev.v.slice() : tpl.axes.map(() => undefined);
  const A = flow.align;
  const S = makeStage('is-points');
  const { stage } = S;
  stage.appendChild(photo.img);
  const editorHost = h('div', { class: 'im-editor' });
  const progress = h('p', { class: 'im-progress', 'aria-live': 'polite' });
  let r = null;
  const upd = () => {
    const left = values.filter(v => v === undefined).length;
    progress.textContent = left ? frTypo(plural(tpl.axes.length - left, 'point placé', 'points placés') + ' sur ' + tpl.axes.length) : 'Tous les points sont placés ✓';
    progress.classList.toggle('is-done', !left);
    flow.values['photo-' + subject] = { classe: flow.classe, v: values.slice() };
  };
  const apply = () => {
    const half = A.R * 1.24;
    if (!S.layout({ x: A.cx - half, y: A.cy - half, w: 2 * half, h: 2 * half }, { square: true }) || !r) return;
    const [cx, cy] = S.toStage(A.cx, A.cy);
    r.setTransform({ cx, cy, R: A.R * S.geo.k, rotation: A.rot + A.off, width: S.geo.W, height: S.geo.H });
  };
  const tool = (label, aria, fn) => h('button', { type: 'button', class: 'im-tool', 'aria-label': aria, on: { click: () => { audio.tap(); fn(); apply(); } } }, label);
  const tools = h('div', { class: 'im-tools', role: 'group', 'aria-label': 'Ajuster le gabarit' },
    h('div', { class: 'im-tool-g' }, h('span', { class: 'im-tool-l' }, 'Tourner'),
      tool('↺', 'Tourner le gabarit d’un degré vers la gauche', () => { A.rot -= 1; }),
      tool('↻', 'Tourner le gabarit d’un degré vers la droite', () => { A.rot += 1; })),
    h('div', { class: 'im-tool-g' }, h('span', { class: 'im-tool-l' }, 'Taille'),
      tool('−', 'Réduire le gabarit', () => { A.R *= 0.985; }),
      tool('+', 'Agrandir le gabarit', () => { A.R *= 1.015; })),
    tpl.exact ? null : h('div', { class: 'im-tool-g' }, h('span', { class: 'im-tool-l' }, '½ pas'),
      tool('−½', 'Décaler les axes d’un demi-pas vers la gauche', () => { A.off -= step / 2; }),
      tool('+½', 'Décaler les axes d’un demi-pas vers la droite', () => { A.off += step / 2; })));
  const check = () => {
    const first = values.findIndex(v => v === undefined);
    if (first >= 0) {
      const left = values.filter(v => v === undefined).length;
      const msg = 'Il reste ' + plural(left, 'point', 'points') + ' à placer (« Absent » si la compétence n’a pas été évaluée).';
      kit.toast(frTypo(msg), 2600);
      say(msg);
      if (r) r.select(first);
      return;
    }
    audio.tap();
    renderRecap('photo', subject, tpl, values);
  };
  screen('Placer les points', () => renderPhotoAlign(),
    h('p', { class: 'im-note im-howto' }, frTypo('Glissez chaque poignée sur la pastille blanche du radar de la fiche (son axe s’allume). Réglez avec − et +, ou « Absent » si l’enfant n’a pas été positionné.')),
    stage, tools, editorHost, progress,
    h('div', { class: 'im-actions' },
      h('button', { type: 'button', class: 'btn big block', on: { click: check } }, 'Vérifier ➜'),
      h('button', { type: 'button', class: 'btn ghost block', on: { click: () => { audio.tap(); renderPhotoAlign(); } } }, 'Recaler le gabarit')));
  upd();
  stage.setAttribute('aria-label', 'Photo de la fiche ' + SUBJ[subject].the + ' avec le gabarit');
  later(() => {
    if (!stage.isConnected) return;
    r = renderRadar(stage, {
      template: tpl, values, subject, labels: 'none', animate: false,
      title: 'Gabarit de la fiche ' + SUBJ[subject].the + ' de ' + p.name,
      interactive: { snap: 0.1, absent: true, editor: editorHost, onChange: (i, v, all) => { values = all; upd(); } }
    });
    cleanups.push(() => r.destroy());
    apply();
    observe(stage, apply);
  });
}

/* ============ RÉCAPITULATIF + ENREGISTREMENT ============ */
function renderRecap(kind, subject, tpl, values) {
  const p = target();
  const today = dayStr();
  const months = schoolMonths(today);
  let date = flow.date && months.includes(flow.date) ? flow.date : months[0];
  const absent = values.filter(v => v === null).length;
  const rows = tpl.axes.map((a, i) => {
    const v = values[i];
    return h('li', { class: 'im-recap-row' + (v === null ? ' is-null' : '') },
      h('span', { class: 'im-recap-l' }, a.label),
      h('span', { class: 'im-recap-v num' }, isNum(v) ? levelText(v) : 'absent'));
  });
  const sel = h('select', { class: 'input im-select', 'aria-label': 'Date de la fiche' },
    months.map(ym => h('option', { value: ym, selected: ym === date ? true : null }, monthLabel(ym))));
  sel.addEventListener('change', () => { date = sel.value; });
  const save = () => {
    const vals = ficheToAxes(tpl, values.map(v => (v === undefined ? null : v)));
    const evaluation = {
      source: 'Repères', date, classe: flow.classe,
      fr: subject === 'fr' ? vals : {}, ma: subject === 'ma' ? vals : {},
      precision: kind === 'photo' ? 'lecture sur photo' : 'saisie manuelle'
    };
    let res = null;
    store.mutateProfile(q => {
      if (!q.classe && flow.classe) setClasse(q, flow.classe, today);
      res = applyEval(q, evaluation, today);
    }, flow.targetId);
    flow.done.add(subject);
    flow.date = date;
    delete flow.values[subject];
    delete flow.values['photo-' + subject];
    if (kind === 'photo') releasePhoto();
    renderDone({ kind, subjects: [subject], res });
  };
  screen('Vérifier', () => (kind === 'photo' ? renderPhotoPoints() : renderManualRadar(subject)),
    h('div', { class: 'card im-card im-recap im-recap--' + subject },
      h('div', { class: 'im-recap-t' }, h('span', { 'aria-hidden': 'true' }, SUBJ[subject].emo + ' '),
        'Fiche ' + SUBJ[subject].the + ' de ' + p.name + ' · ' + flow.classe),
      h('ul', { class: 'im-recap-list' }, rows),
      absent ? h('p', { class: 'im-help' }, frTypo(plural(absent, 'compétence absente', 'compétences absentes') + ' : elles restent « non positionnées » et Caramel les découvrira en jouant.')) : null,
      field('Date de la fiche', sel)),
    h('button', { type: 'button', class: 'btn big block im-save', on: { click: () => { audio.tap(); save(); } } }, 'Enregistrer ✓'));
}

/* ============ RÉSUMÉ ============ */
function renderDone({ kind, subjects, res, created = false }) {
  const p = target();
  if (!p) { leave(); return; }
  const applied = res ? res.applied.length : 0, absent = res ? res.absent.length : 0;
  const other = kind === 'file' ? null : nextSubject();
  const title = kind === 'file' ? 'Évaluation importée' : 'Fiche ' + SUBJ[subjects[0]].the + ' enregistrée';
  const check = h('div', { class: 'im-done-ico', 'aria-hidden': 'true' }, '✓');
  const radars = h('div', { class: 'im-done-radars' });
  const classe = p.classe || flow.classe || 'CM2';
  const holders = subjects.map(g => {
    const holder = h('div', { class: 'im-done-radar' });
    radars.appendChild(h('div', { class: 'card im-radar-card im-radar-card--' + g },
      h('h3', { class: 'im-h3' }, h('span', { 'aria-hidden': 'true' }, SUBJ[g].emo + ' '), g === 'fr' ? 'Français' : 'Mathématiques'), holder));
    return [g, holder];
  });
  const txt = [plural(applied, 'compétence enregistrée', 'compétences enregistrées') + (absent ? ', ' + plural(absent, 'absence', 'absences') : '') + '.',
    'Caramel adapte maintenant les jeux à ces niveaux.'].join(' ');
  screen('C’est enregistré', null,
    h('div', { class: 'card im-done' }, check,
      h('p', { class: 'im-lead' }, title),
      h('p', { class: 'im-done-who' }, h('span', { 'aria-hidden': 'true' }, avatarOf(p) + ' '), p.name + (created ? ' · nouveau profil' : '')),
      h('p', { class: 'im-note' }, frTypo(txt))),
    radars,
    h('div', { class: 'im-actions' },
      other ? h('button', { type: 'button', class: 'btn block im-next', on: { click: () => {
        audio.tap();
        if (kind === 'photo') { flow.photoSubject = other; renderPhotoStart(); }
        else renderManualRadar(other);
      } } }, h('span', { 'aria-hidden': 'true' }, SUBJ[other].emo), 'Ajouter la fiche ' + SUBJ[other].the + ' ➜') : null,
      h('button', { type: 'button', class: other ? 'btn white block' : 'btn big block', on: { click: () => { audio.tap(); leave(); } } }, 'Terminer ✓')));
  audio.success(4);
  try { motion.pop(check, { scale: 1.25, dur: 420 }); } catch (_) {}
  say(title + '. ' + txt);
  later(() => {
    for (const [g, holder] of holders) {
      if (!holder.isConnected) continue;
      const tpl = radarTemplate(classe, g);
      const ref = referenceValues(p, g) || {};
      const rr = renderRadar(holder, {
        template: tpl, values: ref, subject: g, labels: 'official', showValues: true, size: 440,
        nullLabel: id => (Object.prototype.hasOwnProperty.call(ref, id) && ref[id] === null ? 'absent' : 'non positionné'),
        title: 'Fiche ' + SUBJ[g].the + ' de ' + p.name
      });
      cleanups.push(() => rr.destroy());
    }
  });
}

/* ============ ÉCRAN ============ */
export default {
  async mount(root, params = {}, query = {}) {
    host = root;
    Q = { ...(query || {}) };
    const data = store.getData();
    const wanted = Q.profile && store.getProfile(Q.profile) ? Q.profile : (data.active && store.getProfile(data.active) ? data.active : null);
    flow = { targetId: wanted, classe: null, done: new Set(), values: {}, photoSubject: 'fr', align: null, date: '' };
    await Promise.race([Promise.all([loadCSS('css/ui/import.css'), radarReady()]), new Promise(r => setTimeout(r, 1200))]);
    if (host !== root) return;
    try { document.title = 'Fiche d’évaluation · Caramel'; } catch (_) {}
    if (Q.method === 'file') renderFile();
    else if (Q.method === 'photo' || Q.method === 'manual') start(Q.method);
    else renderChoose();
  },
  unmount() {
    cleanupStep();
    releasePhoto();
    host = null;
    live = null;
    flow = null;
    /* retour Android pendant qu'une feuille de restauration est ouverte : on la referme */
    try { if (document.querySelector('.kit-overlay')) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch (_) {}
  }
};
