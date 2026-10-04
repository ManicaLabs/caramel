/* ============ IMPORT DE LA FICHE D'ÉVALUATION (#/import) — CDC §8, annexe A ; JEUX.md §8 ============
   Query : from = 'onboarding' | 'parents' | … (retour : onboarding → #/home, parents → #/parents, sinon retour),
           method = 'photo' | 'manual' | 'file' (sinon écran de choix), profile = profil visé (défaut : actif).
   (a) FICHIER caramel-eval (annexe A) : profil cible (même prénom présélectionné ; sinon créer le profil ou le
       rattacher à un profil existant, avec option de renommer celui-ci) → applyEval (+ classe si absente) → résumé.
       Une sauvegarde caramel-save choisie ici est restaurée (backup.restoreFlow).
   (b) SAISIE MANUELLE : classe + matière → radar interactif au gabarit de la FICHE (ficheTemplate)
       → ficheToAxes → applyEval.
   (c) PHOTO (CDC §8.2, §8.3) : classe → photo (<input capture>) → « Je cherche le radar… » : détection automatique
       (js/ui/radar-detect.js, dans un worker) → si le radar est lu avec assez de confiance : gros plan REDRESSÉ du radar
       (perspective corrigée), gabarit calé, poignées pré-placées, points incertains signalés (halo orange) ; « C’est bon ✓ »
       → récapitulatif, ou « Réaligner à la main » (plan B). Sinon : alignement manuel en 2 touches (centre = cartable ;
       haut du cercle +++), pré-rempli avec ce que la détection a trouvé, puis réglages fins (rotation, ±½ pas, rayon),
       poignées glissées sur les sommets (aimantées à 0,1), « absent » par axe → récapitulatif → applyEval.
       Le calage propose aussi « Reprendre la photo », avec un conseil de prise de vue (radar coupé, trop petit, de biais).
       La matière vient du nombre d'axes du radar lu (sinon de la couleur de la bande des familles, modifiable) ; les points
       à vérifier sont signalés aussi aux lecteurs d'écran (aria-description « à vérifier »).
       La photo n'est JAMAIS stockée : URL d'objet révoquée et vue redressée effacée dès qu'elles ne servent plus.
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
let flow = null;              /* { targetId, classe, done: Set, values: { fr, ma, photo-fr, photo-ma }, photoSubject, subjectSrc,
                                 align, date, auto: { conf, unsure: Set }, kept: { subject, unsure } (après réalignement),
                                 prefill: { c, t }, miss (raison de l'échec), hint (conseil de prise de vue) } */
let photo = null;             /* { url, img, natW, natH, view } — jamais stockée (view : radar redressé) */
let live = null;              /* zone aria-live */
let cleanups = [];
let scanSeq = 0;              /* jeton de la détection en cours (une détection périmée est ignorée) */
let detWorker = null;         /* worker de détection (créé à la demande, arrêté en quittant l'écran) */
const UNSURE = 0.6;           /* en dessous : point signalé « à vérifier » */
const INPUT_MAX = 1600;       /* côté de l'image analysée (= INPUT_MAX de radar-detect.js) */

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
  dropView();
  photo = null;
}
/* vue redressée du radar (canevas en mémoire) : effacée dès qu'elle ne sert plus */
function dropView() {
  if (!photo || !photo.view) return;
  try { photo.view.img.width = 0; photo.view.img.height = 0; photo.view.img.remove(); } catch (_) {}
  photo.view = null;
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
/* La matière n'est plus devinée d'après la teinte de la photo entière : sur les vraies photos (lumière chaude, cartable et
   illustrations orangés, table en bois), elle désignait les maths pour les fiches de français. Elle vient du radar lu
   (nombre d'axes) ou, s'il n'est qu'entrevu, de la couleur de la bande des familles rapportée au papier (radar-detect.js). */

/* conseil de prise de vue d'après la détection (res.hint) */
const SHOT_TIP = {
  'hors-cadre': 'Une partie du radar sort de la photo : reculez un peu pour le photographier en entier.',
  'trop-petit': 'Le radar est petit sur la photo : approchez le téléphone pour qu’il remplisse l’image.',
  'de-biais': 'La photo est prise de biais : tenez le téléphone bien au-dessus de la fiche, parallèle à la table.'
};

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
        h('li', null, frTypo('Posez la fiche bien à plat, avec une bonne lumière. Tenez le téléphone juste au-dessus, parallèle à la table, et photographiez tout le radar.')),
        h('li', null, frTypo('Caramel cherche le radar et lit les points tout seul.')),
        h('li', null, frTypo('Vérifiez les points (vous pouvez les déplacer), puis enregistrez.'))),
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
    photo = { url, img, natW: img.naturalWidth, natH: img.naturalHeight, view: null };
    flow.photoSubject = nextSubject() || 'fr';
    flow.subjectSrc = null;
    flow.align = null;
    flow.auto = null;
    flow.prefill = null;
    flow.hint = null;
    flow.kept = null;
    renderPhotoScan();
  };
  img.onerror = () => {
    try { URL.revokeObjectURL(url); } catch (_) {}
    if (host) renderPhotoStart('Cette image n’a pas pu être ouverte. Essayez une autre photo.');
  };
  img.src = url;
}

/* scène : la photo (ou une partie : view, en pixels de l'image) affichée dans la largeur du conteneur.
   src = { img, natW, natH } : la photo elle-même, ou la vue redressée du radar (détection automatique) */
function makeStage(cls, src0) {
  const stage = h('div', { class: 'im-stage ' + cls });
  const geo = { k: 1, ox: 0, oy: 0, W: 0, H: 0, view: { x: 0, y: 0, w: 1, h: 1 } };
  const layout = (view, { maxH = 0, square = false } = {}) => {
    const W = Math.round(stage.clientWidth || 0);
    const src = src0 || photo;
    if (W < 60 || !photo || !src) return false;
    let k = W / view.w, H = square ? W : view.h * k;
    if (!square && maxH && H > maxH) { k = maxH / view.h; H = maxH; }
    const ox = (W - view.w * k) / 2, oy = (H - view.h * k) / 2;
    Object.assign(geo, { k, ox, oy, W, H: Math.round(H), view });
    /* hauteur de la boîte intérieure = H exactement (la bordure s'ajoute) : repère 1:1 avec le radar superposé */
    const bh = Math.max(0, stage.offsetHeight - stage.clientHeight);
    stage.style.height = (Math.round(H) + bh) + 'px';
    const img = src.img;
    img.style.width = (src.natW * k).toFixed(2) + 'px';
    img.style.height = (src.natH * k).toFixed(2) + 'px';
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

/* ---------- détection automatique du radar (CDC §8.3, js/ui/radar-detect.js) ---------- */
let detSeq = 0;
/* pixels de la photo réduite à INPUT_MAX px → { width, height, data, k } (k : échelle photo → image analysée) */
function photoPixels() {
  const k = Math.min(1, INPUT_MAX / Math.max(photo.natW, photo.natH));
  const w = Math.max(1, Math.round(photo.natW * k)), hh = Math.max(1, Math.round(photo.natH * k));
  const c = document.createElement('canvas');
  c.width = w; c.height = hh;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(photo.img, 0, 0, w, hh);
  const data = x.getImageData(0, 0, w, hh).data;
  c.width = 0; c.height = 0;
  return { width: w, height: hh, data, k };
}
/* analyse dans un worker (repli : sur le fil principal, une image plus tard) → { res, view, k } ou null */
function runDetection(opts) {
  return new Promise(resolve => {
    let settled = false;
    const done = v => { if (settled) return; settled = true; clearTimeout(timer); resolve(v); };
    const timer = setTimeout(() => done(null), 15000);
    const fallback = () => {
      import('./radar-detect.js').then(m => {
        setTimeout(() => {
          if (settled || !photo) { done(null); return; }
          try {
            const px = photoPixels();
            const image = { width: px.width, height: px.height, data: px.data };
            const res = m.detectRadar(image, opts);
            let view = null;
            if (res && res.homography && opts.viewSize > 0) {
              const v = m.rectify(image, res, { size: opts.viewSize, extent: opts.viewExtent });
              view = { width: v.width, height: v.height, R: v.R, extent: opts.viewExtent, buffer: v.data.buffer };
            }
            done({ res, view, k: px.k });
          } catch (_) { done(null); }
        }, 60);
      }).catch(() => done(null));
    };
    let px = null;
    try { px = photoPixels(); } catch (_) { done(null); return; }
    let wk = null;
    try {
      if (!detWorker) detWorker = new Worker(new URL('./radar-detect-worker.js', import.meta.url), { type: 'module' });
      wk = detWorker;
    } catch (_) { wk = null; }
    if (!wk) { fallback(); return; }
    const id = ++detSeq;
    const off = () => { try { wk.removeEventListener('message', onMsg); wk.removeEventListener('error', onErr); } catch (_) {} };
    const onMsg = e => {
      const d = e.data || {};
      if (d.id !== id) return;
      off();
      if (d.error) { fallback(); return; }
      done({ res: d.res, view: d.view, k: px.k });
    };
    const onErr = () => { off(); try { wk.terminate(); } catch (_) {} if (detWorker === wk) detWorker = null; fallback(); };
    wk.addEventListener('message', onMsg);
    wk.addEventListener('error', onErr);
    try {
      const buf = px.data.buffer;
      wk.postMessage({ id, width: px.width, height: px.height, buffer: buf, opts }, [buf]);
    } catch (_) { off(); fallback(); }
  });
}
/* point du gabarit (u, v) → pixel de la PHOTO (repère CSS : coin du pixel), via l'homographie de l'image analysée */
function photoPoint(out, u, v) {
  const H = out.res.homography;
  const w = H[6] * u + H[7] * v + H[8];
  const x = (H[0] * u + H[1] * v + H[2]) / w, y = (H[3] * u + H[4] * v + H[5]) / w;
  return [(x + 0.5) / out.k, (y + 0.5) / out.k];
}
/* repères pré-remplis de l'alignement manuel (centre, haut du cercle +++) d'après ce que la détection a trouvé */
function prefillFrom(out) {
  if (!out || !out.res || !out.res.homography) return null;
  const c = photoPoint(out, 0, 0), t = photoPoint(out, 0, -1);
  if (![...c, ...t].every(Number.isFinite)) return null;
  return { c, t };
}

/* écran « Je cherche le radar… » : la photo, un balayage façon radar, puis le radar trouvé (ou l'alignement manuel) */
function renderPhotoScan() {
  if (!photo) { renderPhotoStart(); return; }
  const token = ++scanSeq;
  const S = makeStage('is-scan');
  const { stage } = S;
  stage.appendChild(photo.img);
  const sweep = h('span', { class: 'im-sweep', 'aria-hidden': 'true' });
  const lens = h('span', { class: 'im-lens', 'aria-hidden': 'true' }, '🔍');
  const found = h('span', { class: 'im-found', 'aria-hidden': 'true', hidden: true });
  stage.append(sweep, found, lens);
  const capT = h('span', { class: 'im-scan-t' }, 'Je cherche le radar');
  const dots = h('span', { class: 'im-dots', 'aria-hidden': 'true' }, h('i', null, '.'), h('i', null, '.'), h('i', null, '.'));
  const cap = h('div', { class: 'im-scan-cap', 'aria-hidden': 'true' }, h('span', { class: 'im-scan-emo' }, '🔍'), h('span', { class: 'im-scan-l' }, capT, dots));
  const manual = h('button', { type: 'button', class: 'btn ghost block', on: { click: () => {
    audio.tap(); scanSeq++; flow.auto = null; flow.prefill = null; flow.miss = null; renderPhotoAlign();
  } } }, 'Placer les points à la main');
  screen('Lecture de la photo', () => { scanSeq++; releasePhoto(); renderPhotoStart(); },
    cap, stage, h('p', { class: 'im-private' }, h('span', { 'aria-hidden': 'true' }, '🔒 '), frTypo('La photo est analysée sur ce téléphone : elle n’est ni enregistrée ni envoyée.')),
    h('div', { class: 'im-actions' }, manual));
  stage.setAttribute('aria-label', 'Photo de la fiche en cours d’analyse');
  const place = () => {
    S.layout({ x: 0, y: 0, w: photo.natW, h: photo.natH }, { maxH: Math.max(280, Math.round((G.innerHeight || 700) * 0.6)) });
  };
  place();
  observe(stage, place);
  say('Je cherche le radar sur la photo…');
  const t0 = Date.now();
  const dpr = Math.min(3, Math.max(1, G.devicePixelRatio || 1));
  const viewSize = Math.round(Math.min(1100, Math.max(640, (stage.clientWidth || 360) * dpr * 1.15)));
  const opts = { templates: { fr: ficheTemplate(flow.classe, 'fr'), ma: ficheTemplate(flow.classe, 'ma') }, viewSize, viewExtent: 1.3 };
  runDetection(opts).then(out => {
    if (token !== scanSeq || !host || !photo) return;
    /* le balayage reste visible un court instant : on voit que Caramel a cherché */
    const wait = Math.max(0, (motion.reduced() ? 200 : 1000) - (Date.now() - t0));
    const t = setTimeout(() => {
      if (token !== scanSeq || !host || !photo) return;
      const res0 = out && out.res;
      /* défense en profondeur : bande des familles franchement orange (maths) mais gabarit de français retenu →
         lecture douteuse, on passe par le calage (pré-rempli) plutôt que d'enregistrer une fiche sous la mauvaise matière */
      const colorClash = !!(res0 && res0.ok && res0.subject === 'fr' && res0.subjectColor === 'ma');
      if (out && res0 && res0.ok && out.view && !colorClash) {
        /* radar trouvé : cercle tracé sur la photo, puis gros plan redressé */
        const [cx, cy] = photoPoint(out, 0, 0), [tx, ty] = photoPoint(out, 0, -1);
        const [sx, sy] = S.toStage(cx, cy), [qx, qy] = S.toStage(tx, ty);
        const r = Math.hypot(qx - sx, qy - sy);
        Object.assign(found.style, { left: sx + 'px', top: sy + 'px', width: 2 * r + 'px', height: 2 * r + 'px' });
        found.hidden = false;
        stage.classList.add('is-found');
        clear(capT); capT.textContent = 'Radar trouvé';
        dots.replaceChildren(h('b', { class: 'im-scan-ok' }, ' ✓'));
        audio.success(2);
        say('Radar trouvé. Lecture des points.');
        const t2 = setTimeout(() => { if (token === scanSeq && host && photo) enterAuto(out); }, motion.reduced() ? 120 : 700);
        cleanups.push(() => clearTimeout(t2));
      } else {
        flow.auto = null;
        flow.prefill = prefillFrom(out);
        flow.miss = res0 ? res0.reason || 'confiance-faible' : 'erreur';
        flow.hint = res0 && res0.hint ? res0.hint : null;
        /* radar repéré sans lecture complète : matière et points lus avec assurance repris. La matière vient du gabarit
           (nombre d'axes) si ses axes ont bien été retrouvés, sinon de la couleur de la bande des familles. */
        if (flow.prefill && res0 && res0.template && Array.isArray(res0.axes) && res0.axes.length) {
          const st = res0.debug && res0.debug.stats;
          const axesSeen = !!(st && st.ray >= 0.6) && !colorClash;
          const subject = axesSeen ? (res0.subject === 'ma' ? 'ma' : 'fr') : (res0.subjectColor || null);
          if (subject) {
            flow.photoSubject = subject;
            flow.subjectSrc = axesSeen ? 'radar' : 'couleur';
          }
          /* les valeurs lues appartiennent au gabarit retenu : reprises seulement si c'est bien la matière proposée */
          if (axesSeen) {
            const v = res0.axes.map(a => (a.confidence >= UNSURE ? a.theta : undefined));
            if (v.some(x => x !== undefined)) flow.values['photo-' + subject] = { classe: flow.classe, v };
          }
        }
        renderPhotoAlign();
      }
    }, wait);
    cleanups.push(() => clearTimeout(t));
  });
}
/* radar lu : vue redressée (perspective corrigée), gabarit calé, valeurs pré-placées, points incertains signalés */
function enterAuto(out) {
  const { res, view } = out;
  dropView();
  const cv = document.createElement('canvas');
  cv.width = view.width; cv.height = view.height;
  cv.className = 'im-photo im-photo--view';
  try {
    cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(view.buffer), view.width, view.height), 0, 0);
  } catch (_) {
    flow.auto = null; flow.prefill = prefillFrom(out); flow.miss = 'erreur'; renderPhotoAlign(); return;
  }
  photo.view = { img: cv, natW: view.width, natH: view.height, R: view.R };
  const subject = res.subject === 'ma' ? 'ma' : 'fr';
  flow.photoSubject = subject;
  flow.subjectSrc = 'radar';
  flow.hint = res.hint || null;
  /* centre du gabarit : pixel (taille / 2) de la vue, repère CSS (+ 0,5) */
  const c = view.width / 2 + 0.5;
  flow.align = { cx: c, cy: c, R: view.R, rot: 0, off: 0 };
  flow.values['photo-' + subject] = { classe: flow.classe, v: res.axes.map(a => (a.theta === null ? null : a.theta)) };
  flow.auto = { conf: res.confidence, unsure: new Set(res.axes.filter(a => a.confidence < UNSURE).map(a => a.index)) };
  flow.kept = null;
  flow.prefill = prefillFrom(out);
  flow.miss = null;
  renderPhotoPoints();
}

function subjectRow() {
  const src = flow.subjectSrc;
  const s = seg([['fr', SUBJ.fr.emo + ' Français'], ['ma', SUBJ.ma.emo + ' Maths']], flow.photoSubject, v => {
    if (v !== flow.photoSubject) { flow.photoSubject = v; flow.subjectSrc = null; say('Matière : ' + (v === 'fr' ? 'français' : 'maths')); }
  }, 'Matière de la fiche', 'im-seg-subj');
  const help = src === 'radar' ? 'Reconnue d’après le radar de la fiche ; touchez l’autre matière si besoin.'
    : src === 'couleur' ? 'Reconnue d’après la couleur du radar ; touchez l’autre matière si besoin.'
      : 'Choisissez la matière de cette fiche.';
  return field('Matière', s.el, help);
}

function renderPhotoAlign() {
  if (!photo) { renderPhotoStart(); return; }
  scanSeq++;
  const S = makeStage('is-align');
  const { stage } = S;
  stage.appendChild(photo.img);
  const markC = h('span', { class: 'im-mark im-mark--c', 'aria-hidden': 'true', hidden: true });
  const markT = h('span', { class: 'im-mark im-mark--t', 'aria-hidden': 'true', hidden: true });
  const ring = h('span', { class: 'im-ring', 'aria-hidden': 'true', hidden: true });
  stage.append(ring, markC, markT);
  /* repères pré-remplis par la détection (centre, haut du cercle +++) : il suffit de vérifier */
  const pre = flow.prefill;
  let taps = pre ? [pre.c.slice(), pre.t.slice()] : [];
  let fromDetect = !!pre;
  const instr = h('div', { class: 'im-instr', role: 'status' });
  const confirm = h('button', { type: 'button', class: 'btn big block im-confirm', hidden: true, on: { click: () => { audio.tap(); commit(); } } }, 'C’est bien placé ➜');
  const setInstr = () => {
    clear(instr);
    const n = taps.length;
    if (n === 2 && fromDetect) {
      instr.append(h('span', { class: 'im-instr-n' }, '✓'),
        h('span', { class: 'im-instr-t' }, frTypo('Vérifiez les deux repères : le cartable au centre et le haut du grand cercle. Touchez la photo pour les replacer.')));
    } else {
      instr.append(h('span', { class: 'im-instr-n' }, Math.min(2, n + 1) + '/2'),
        h('span', { class: 'im-instr-t' }, n === 0
          ? frTypo('Touchez le centre du radar : le cartable 🎒')
          : frTypo('Touchez maintenant le haut du grand cercle (+++)')));
    }
    confirm.hidden = !(n === 2 && fromDetect);
  };
  const place = () => {
    if (!S.layout({ x: 0, y: 0, w: photo.natW, h: photo.natH }, { maxH: Math.max(280, Math.round((G.innerHeight || 700) * 0.62)) })) return;
    const pos = (el, p) => { const [x, y] = S.toStage(p[0], p[1]); el.style.transform = 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px)'; };
    markC.hidden = taps.length < 1;
    markT.hidden = taps.length < 2;
    if (taps[0]) pos(markC, taps[0]);
    if (taps[1]) pos(markT, taps[1]);
    /* cercle +++ esquissé quand les deux repères sont posés */
    ring.hidden = taps.length < 2;
    if (taps.length === 2) {
      const [cx, cy] = S.toStage(taps[0][0], taps[0][1]), [tx, ty] = S.toStage(taps[1][0], taps[1][1]);
      const r = Math.hypot(tx - cx, ty - cy);
      Object.assign(ring.style, { width: 2 * r + 'px', height: 2 * r + 'px', transform: 'translate(' + (cx - r).toFixed(1) + 'px, ' + (cy - r).toFixed(1) + 'px)' });
    }
  };
  const commit = () => {
    const [c, t] = taps;
    const dx = t[0] - c[0], dy = t[1] - c[1];
    flow.align = { cx: c[0], cy: c[1], R: Math.hypot(dx, dy), rot: Math.atan2(dx, -dy) * 180 / Math.PI, off: 0 };
    renderPhotoPoints();
  };
  const tap = (sx, sy) => {
    const [ix, iy] = S.toImage(sx, sy);
    if (ix < -20 || iy < -20 || ix > photo.natW + 20 || iy > photo.natH + 20) return;
    /* repères proposés par la détection : une touche recommence la pose (centre d'abord) */
    if (fromDetect) { fromDetect = false; taps = []; }
    if (taps.length === 1) {
      const d = Math.hypot(ix - taps[0][0], iy - taps[0][1]) * S.geo.k;
      if (d < 24) { say('Touchez plus loin du centre : le haut du grand cercle.'); kit.toast(frTypo('Un peu plus loin du centre : le haut du grand cercle.')); return; }
    }
    if (taps.length >= 2) taps = [];
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
    audio.success(2);
    say('Gabarit calé sur la photo.');
    const t2 = setTimeout(() => { if (host) commit(); }, motion.reduced() ? 60 : 320);
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
  const reset = h('button', { type: 'button', class: 'btn white small', on: { click: () => { audio.tap(); taps = []; fromDetect = false; place(); setInstr(); say('Alignement remis à zéro.'); } } }, 'Recommencer');
  /* repli sans toucher précis (clavier, lecteur d'écran) : gabarit centré sur la photo, à ajuster ensuite */
  const auto = h('button', { type: 'button', class: 'btn ghost small', on: { click: () => {
    audio.tap();
    const m = Math.min(photo.natW, photo.natH);
    flow.align = { cx: photo.natW / 2, cy: photo.natH / 2, R: m * 0.36, rot: 0, off: 0 };
    renderPhotoPoints();
  } } }, 'Centrer sans toucher');
  /* message bienveillant quand la détection automatique n'a pas abouti */
  let miss = null, missText = '';
  if (flow.miss) {
    const msg = pre
      ? 'J’ai repéré le radar, mais pas assez nettement pour lire tous les points. Vérifiez les deux repères, puis placez les points : c’est rapide !'
      : 'Je n’ai pas trouvé le radar tout seul sur cette photo. Touchez le cartable au centre, puis le haut du grand cercle : on y arrive ensemble !';
    const tip = SHOT_TIP[flow.hint] || '';
    const extra = flow.miss === 'axes-introuvables' && !tip ? ' Vérifiez aussi que la fiche est bien une fiche de ' + flow.classe + '.' : '';
    /* plan B, autre issue : une meilleure photo (conseil de prise de vue d'après ce que la détection a vu) */
    const retake = h('button', { type: 'button', class: 'btn white small im-retake', on: { click: () => { audio.tap(); releasePhoto(); renderPhotoStart(); } } },
      h('span', { 'aria-hidden': 'true' }, '📷'), 'Reprendre la photo');
    missText = frTypo(msg + extra + (tip ? ' ' + tip : ''));
    miss = h('div', { class: 'bubble soft im-bubble im-miss', role: 'status' },
      h('span', { class: 'im-miss-emo', 'aria-hidden': 'true' }, '🤔'),
      h('span', { class: 'im-miss-txt' }, h('span', null, frTypo(msg + extra)),
        tip ? h('span', { class: 'im-miss-tip' }, frTypo(tip)) : null, retake));
  }
  screen('Caler le gabarit', () => { releasePhoto(); renderPhotoStart(); },
    miss, subjectRow(), instr, stage, confirm, h('div', { class: 'im-row im-row--tools' }, reset, auto));
  setInstr();
  stage.setAttribute('aria-label', 'Photo de la fiche');
  place();
  observe(stage, place);
  if (miss) say(missText);
}

function renderPhotoPoints() {
  if (!photo || !flow.align) { renderPhotoAlign(); return; }
  scanSeq++;
  const p = target();
  const subject = flow.photoSubject;
  const tpl = ficheTemplate(flow.classe, subject);
  const step = 360 / tpl.axes.length;
  const prev = flow.values['photo-' + subject];
  let values = prev && prev.classe === flow.classe && prev.v.length === tpl.axes.length ? prev.v.slice() : tpl.axes.map(() => undefined);
  const A = flow.align;
  /* lecture automatique : gros plan redressé du radar (la perspective de la photo est corrigée) ; après un réalignement à
     la main, les points lus « à vérifier » le restent tant qu'on ne les a pas regardés */
  const auto = !!(flow.auto && photo.view);
  const unsure = auto ? flow.auto.unsure : flow.kept && flow.kept.subject === subject ? flow.kept.unsure : new Set();
  const src = auto ? photo.view : photo;
  const S = makeStage('is-points' + (auto ? ' is-view' : ''), src);
  const { stage } = S;
  stage.appendChild(src.img);
  const editorHost = h('div', { class: 'im-editor' });
  const progress = h('p', { class: 'im-progress', 'aria-live': 'polite' });
  let r = null;
  const upd = () => {
    const left = values.filter(v => v === undefined).length;
    if (!left && unsure.size) {
      progress.textContent = frTypo(unsure.size > 1 ? 'Encore ' + unsure.size + ' points à vérifier (entourés d’orange)' : 'Encore un point à vérifier (entouré d’orange)');
      progress.className = 'im-progress is-check';
    } else {
      progress.textContent = left ? frTypo(plural(tpl.axes.length - left, 'point placé', 'points placés') + ' sur ' + tpl.axes.length) : 'Tous les points sont placés ✓';
      progress.className = 'im-progress' + (left ? '' : ' is-done');
    }
    flow.values['photo-' + subject] = { classe: flow.classe, v: values.slice() };
  };
  /* point signalé « à vérifier » : halo orange qui s'éteint dès qu'on l'a regardé ou déplacé */
  const checked = i => {
    if (!unsure.has(i)) return;
    unsure.delete(i);
    try {
      const g = r && r.el.querySelector('.radar-handle[data-i="' + i + '"]');
      if (g) { g.classList.remove('is-unsure'); g.removeAttribute('aria-description'); }
    } catch (_) {}
    upd();
  };
  const apply = () => {
    const half = A.R * 1.24;
    if (!S.layout({ x: A.cx - half, y: A.cy - half, w: 2 * half, h: 2 * half }, { square: true }) || !r) return;
    const [cx, cy] = S.toStage(A.cx, A.cy);
    r.setTransform({ cx, cy, R: A.R * S.geo.k, rotation: A.rot + A.off, width: S.geo.W, height: S.geo.H });
  };
  const tool = (label, aria, fn) => h('button', { type: 'button', class: 'im-tool', 'aria-label': aria, on: { click: () => { audio.tap(); fn(); apply(); } } }, label);
  const tools = auto ? null : h('div', { class: 'im-tools', role: 'group', 'aria-label': 'Ajuster le gabarit' },
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
  /* retour au calage manuel (plan B) : la vue redressée ne sert plus, les valeurs lues restent */
  const manual = () => {
    audio.tap();
    flow.kept = { subject, unsure };
    flow.auto = null;
    flow.miss = null;
    dropView();
    renderPhotoAlign();
  };
  /* message selon la part de points incertains (lus difficilement sur cette photo) */
  const many = unsure.size * 2 > tpl.axes.length, all = unsure.size === tpl.axes.length;
  const tip = SHOT_TIP[flow.hint] ? ' ' + SHOT_TIP[flow.hint] : '';
  const head = auto
    ? h('div', { class: 'bubble good im-bubble im-auto', role: 'status' },
      h('span', { class: 'im-auto-ico', 'aria-hidden': 'true' }, '✓'),
      h('span', { class: 'im-auto-txt' },
        h('b', null, frTypo(many ? 'J’ai trouvé le radar ✓' : 'J’ai trouvé le radar et lu les points ✓')), ' ',
        frTypo(all ? 'Les points sont difficiles à lire sur cette photo : vérifiez-les un à un (entourés d’orange), vous pouvez les déplacer.' + tip
          : many ? 'Certains points sont difficiles à lire sur cette photo : vérifiez ceux entourés d’orange, vous pouvez les déplacer.' + tip
            : unsure.size ? 'Vérifiez-les : vous pouvez les déplacer. Les points entourés d’orange sont à regarder de près.'
              : 'Vérifiez-les : vous pouvez les déplacer.')))
    : h('p', { class: 'im-note im-howto' }, frTypo('Glissez chaque poignée sur la pastille blanche du radar de la fiche (son axe s’allume). Réglez avec − et +, ou « Absent » si l’enfant n’a pas été positionné.'));
  const actions = auto
    ? h('div', { class: 'im-actions' },
      h('button', { type: 'button', class: 'btn big block im-ok', on: { click: check } }, 'C’est bon ✓'),
      h('button', { type: 'button', class: 'btn white block im-realign', on: { click: manual } }, h('span', { 'aria-hidden': 'true' }, '✋'), 'Réaligner à la main'))
    : h('div', { class: 'im-actions' },
      h('button', { type: 'button', class: 'btn big block', on: { click: check } }, 'Vérifier ➜'),
      h('button', { type: 'button', class: 'btn ghost block', on: { click: () => { audio.tap(); renderPhotoAlign(); } } }, 'Recaler le gabarit'));
  screen(auto ? 'Vérifier les points' : 'Placer les points', auto ? () => { releasePhoto(); renderPhotoStart(); } : () => renderPhotoAlign(),
    head, stage, tools, editorHost, progress, actions);
  upd();
  stage.setAttribute('aria-label', (auto ? 'Radar de la fiche ' : 'Photo de la fiche ') + SUBJ[subject].the + ' avec le gabarit');
  later(() => {
    if (!stage.isConnected) return;
    r = renderRadar(stage, {
      template: tpl, values, subject, labels: 'none', animate: false,
      title: 'Gabarit de la fiche ' + SUBJ[subject].the + ' de ' + p.name,
      interactive: { snap: 0.1, absent: true, editor: editorHost,
        onChange: (i, v, all) => { values = all; checked(i); upd(); },
        onSelect: i => checked(i) }
    });
    cleanups.push(() => r.destroy());
    /* points à vérifier : halo orange, et signalés aux lecteurs d'écran (pas seulement par la couleur) */
    for (const i of unsure) {
      const g = r.el.querySelector('.radar-handle[data-i="' + i + '"]');
      if (g) { g.classList.add('is-unsure'); g.setAttribute('aria-description', 'à vérifier'); }
    }
    apply();
    observe(stage, apply);
    if (auto) {
      const names = [...unsure].sort((a, b) => a - b).map(i => tpl.axes[i] && tpl.axes[i].label).filter(Boolean);
      say('Radar lu. ' + (unsure.size ? frTypo(plural(unsure.size, 'point est', 'points sont') + ' à vérifier : ' + names.join(', ') + '.') : 'Vérifiez les points.'));
      if (!motion.reduced()) {
        /* les poignées apparaissent une à une, comme si Caramel les posait */
        motion.stagger([...r.el.querySelectorAll('.radar-handle')], g => motion.enter(g, { from: 'scale', dur: 280 }), 55);
      }
    }
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
      precision: kind === 'photo' ? (flow.auto ? 'lecture automatique de la photo, vérifiée' : 'lecture sur photo') : 'saisie manuelle'
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
    flow = { targetId: wanted, classe: null, done: new Set(), values: {}, photoSubject: 'fr', subjectSrc: null, align: null, date: '', auto: null, kept: null, prefill: null, miss: null, hint: null };
    await Promise.race([Promise.all([loadCSS('css/ui/import.css'), radarReady()]), new Promise(r => setTimeout(r, 1200))]);
    if (host !== root) return;
    try { document.title = 'Fiche d’évaluation · Caramel'; } catch (_) {}
    if (Q.method === 'file') renderFile();
    else if (Q.method === 'photo' || Q.method === 'manual') start(Q.method);
    else renderChoose();
  },
  unmount() {
    scanSeq++;
    cleanupStep();
    releasePhoto();
    try { if (detWorker) detWorker.terminate(); } catch (_) {}
    detWorker = null;
    host = null;
    live = null;
    flow = null;
    /* retour Android pendant qu'une feuille de restauration est ouverte : on la referme */
    try { if (document.querySelector('.kit-overlay')) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch (_) {}
  }
};
