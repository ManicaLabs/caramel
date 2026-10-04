/* ============ SAUVEGARDES : export / import de fichiers (CDC §12, annexe A ; JEUX.md §8) ============
   Logique PURE (testable sous Node : aucun accès au DOM, au stockage ni au navigateur au chargement)
   + petits helpers DOM (téléchargement, partage, choix de fichier, feuille de restauration) à l'appel.

   Formats reconnus par parseBackup :
   - caramel-save v3 : { format: 'caramel-save', v: 3, app: '2.0.0', exported: ISO, profile }   (un profil)
                       { format: 'caramel-save', v: 3, app: '2.0.0', exported: ISO, data }      (tous les profils)
   - caramel-eval v1 (annexe A du CDC) : { format: 'caramel-eval', v: 1, profil: { prenom, g, classe },
       evaluation: { source, date, classe, fr: { axe: θ | null }, ma: {…}, precision } }
   - contenu brut de la clé caramel-v3 ({ schema: 3, profiles }) : traité comme « tous les profils ».

   exportProfile(profile) / exportAll(data) → { filename, json }
     filename : 'caramel-<prénom>-AAAA-MM-JJ.json' | 'caramel-tous-AAAA-MM-JJ.json'
   parseBackup(text) → { kind: 'profile' | 'all' | 'eval' | null, payload, errors: [], warnings: [], meta }
   mergeProfile(data, profile, 'add' | 'replace', targetId?) → { id, mode }   (modifie data : à appeler dans store.mutate)
   replaceAll(data) → données caramel-v3 normalisées (pour store.replaceData) ou null
   noteSaved(profils) / lastSaved(profil) / forgetSaved(ids | null) : date de la dernière sauvegarde téléchargée d'ici
     (réglage d'appareil, lu et écrit à l'appel seulement ; voir plus bas)
   Vocabulaire constant (espace parents et feuilles) : « Télécharger » une sauvegarde, « Restaurer » une sauvegarde ;
   tout remplacement dit qu'il est définitif et propose de télécharger d'abord ce qui sera remplacé. */

import { dayStr, slug, deepClone, fmtNum, frTypo, frList, download as utilDownload, h } from '../core/util.js';
import { normalizeProfile, sanitizeName, newProfileId } from '../core/profiles.js';
import { normalizeData } from '../core/migrate.js';
import { AXES, CLASSES } from '../core/axes.js';

export const SAVE_FORMAT = 'caramel-save';
export const EVAL_FORMAT = 'caramel-eval';
export const SAVE_VERSION = 3;
export const EVAL_VERSION = 1;
export const APP_VERSION = '2.0.0';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const has = (o, k) => isObj(o) && Object.prototype.hasOwnProperty.call(o, k);
const MONTH_RE = /^\d{4}-\d{2}(-\d{2})?$/;

/* version de l'appli (méta de index.html), lue à l'appel ; sous Node : APP_VERSION */
export function appVersion() {
  try {
    const m = globalThis.document && globalThis.document.querySelector('meta[name="caramel-version"]');
    const v = m && m.getAttribute('content');
    if (v) return v;
  } catch (_) {}
  return APP_VERSION;
}

/* ============ EXPORT ============ */
function envelope(body, { app, now }) {
  const d = now instanceof Date && !isNaN(now) ? now : new Date();
  return { format: SAVE_FORMAT, v: SAVE_VERSION, app: app || appVersion(), exported: d.toISOString(), ...body };
}
export function exportProfile(profile, { today = dayStr(), app, now } = {}) {
  const p = deepClone(isObj(profile) ? profile : {});
  const name = typeof p.name === 'string' && p.name.trim() ? p.name : 'profil';
  return {
    filename: 'caramel-' + slug(name) + '-' + today + '.json',
    json: JSON.stringify(envelope({ profile: p }, { app, now }), null, 2)
  };
}
export function exportAll(data, { today = dayStr(), app, now } = {}) {
  const d = deepClone(isObj(data) ? data : {});
  return {
    filename: 'caramel-tous-' + today + '.json',
    json: JSON.stringify(envelope({ data: d }, { app, now }), null, 2)
  };
}

/* ============ IMPORT : lecture et validation ============ */
const plural = (n, one, many) => fmtNum(n) + '\u00A0' + (n > 1 ? many : one);

/* un objet ressemble-t-il à un profil Caramel ? (le reste est complété par normalizeProfile) */
function looksLikeProfile(p) {
  if (!isObj(p)) return false;
  return typeof p.name === 'string' || isObj(p.wallet) || isObj(p.companion) || isObj(p.skills) || typeof p.classe === 'string';
}

export function parseBackup(text, { today = dayStr() } = {}) {
  const res = { kind: null, payload: null, errors: [], warnings: [], meta: {} };
  if (typeof text !== 'string' || !text.trim()) { res.errors.push('Le fichier est vide.'); return res; }
  let obj;
  try { obj = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch (_) { res.errors.push('Ce fichier n’est pas lisible : ce n’est pas une sauvegarde Caramel.'); return res; }
  if (!isObj(obj)) { res.errors.push('Ce fichier n’est pas une sauvegarde Caramel.'); return res; }
  if (obj.format === SAVE_FORMAT) return parseSave(obj, res, today);
  if (obj.format === EVAL_FORMAT) return parseEval(obj, res);
  if (obj.schema === 3 && isObj(obj.profiles)) return parseData(obj, res, today);
  res.errors.push('Ce fichier n’est pas une sauvegarde Caramel.');
  return res;
}

function parseSave(obj, res, today) {
  const v = Number(obj.v);
  if (!Number.isInteger(v) || v < 1) { res.errors.push('Version de sauvegarde inconnue.'); return res; }
  if (v > SAVE_VERSION) {
    res.errors.push('Cette sauvegarde vient d’une version plus récente de Caramel : mettez l’application à jour, puis réessayez.');
    return res;
  }
  res.meta = { app: typeof obj.app === 'string' ? obj.app : '', exported: typeof obj.exported === 'string' ? obj.exported : '' };
  if (has(obj, 'profile')) {
    if (!looksLikeProfile(obj.profile)) { res.errors.push('Le profil de cette sauvegarde est illisible.'); return res; }
    res.payload = normalizeProfile(obj.profile, today);
    res.kind = 'profile';
    return res;
  }
  if (has(obj, 'data')) return parseData(obj.data, res, today);
  res.errors.push('Cette sauvegarde ne contient aucun profil.');
  return res;
}

function parseData(data, res, today) {
  if (!isObj(data) || !isObj(data.profiles)) { res.errors.push('Cette sauvegarde ne contient aucun profil.'); return res; }
  const all = Object.entries(data.profiles);
  const good = all.filter(([id, p]) => id && looksLikeProfile(p));
  if (!good.length) { res.errors.push('Cette sauvegarde ne contient aucun profil lisible.'); return res; }
  if (good.length < all.length) res.warnings.push(plural(all.length - good.length, 'profil illisible a été ignoré.', 'profils illisibles ont été ignorés.'));
  const clean = { ...data, profiles: Object.fromEntries(good) };
  res.payload = normalizeData(clean, today);
  res.kind = 'all';
  return res;
}

/* valeur d'axe : nombre (ou chaîne « 1,8 ») borné 0-3, null = absence ; illisible → undefined */
function evalValue(v) {
  if (v === null) return { v: null };
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.trim().replace(',', '.')) : NaN;
  if (!Number.isFinite(n)) return { v: undefined };
  const c = Math.min(3, Math.max(0, n));
  return { v: Math.round(c * 1e4) / 1e4, clamped: c !== n };
}
const normClasse = c => {
  const up = typeof c === 'string' ? c.trim().toUpperCase() : '';
  return CLASSES.includes(up) ? up : null;
};

function parseEval(obj, res) {
  if (obj.v !== undefined && Number(obj.v) > EVAL_VERSION) {
    res.errors.push('Ce fichier d’évaluation vient d’une version plus récente de Caramel : mettez l’application à jour.');
    return res;
  }
  const ev = obj.evaluation;
  if (!isObj(ev)) { res.errors.push('Ce fichier ne contient pas d’évaluation.'); return res; }
  const groups = { fr: {}, ma: {} };
  let unknown = 0, unreadable = 0, clamped = 0;
  for (const g of ['fr', 'ma']) {
    if (ev[g] === undefined || ev[g] === null) continue;
    if (!isObj(ev[g])) { unreadable++; continue; }
    for (const [k, raw] of Object.entries(ev[g])) {
      const def = AXES[k];
      if (!def) { unknown++; continue; }
      const r = evalValue(raw);
      if (r.v === undefined) { unreadable++; continue; }
      if (r.clamped) clamped++;
      if (!has(groups[def.subject], k)) groups[def.subject][k] = r.v;   /* axe rangé dans l'autre matière : reclassé */
    }
  }
  const nFr = Object.keys(groups.fr).length, nMa = Object.keys(groups.ma).length;
  if (!nFr && !nMa) { res.errors.push('Aucune compétence reconnue dans ce fichier.'); return res; }
  if (unknown) res.warnings.push(plural(unknown, 'compétence inconnue a été ignorée.', 'compétences inconnues ont été ignorées.'));
  if (unreadable) res.warnings.push(plural(unreadable, 'valeur illisible a été ignorée.', 'valeurs illisibles ont été ignorées.'));
  if (clamped) res.warnings.push(plural(clamped, 'valeur hors de l’échelle 0-3 a été ramenée dans l’échelle.', 'valeurs hors de l’échelle 0-3 ont été ramenées dans l’échelle.'));
  const pf = isObj(obj.profil) ? obj.profil : {};
  const profil = {
    prenom: sanitizeName(typeof pf.prenom === 'string' ? pf.prenom : '', ''),
    g: pf.g === 'm' || pf.g === 'f' ? pf.g : null,
    classe: normClasse(pf.classe)
  };
  const classe = normClasse(ev.classe) || profil.classe;
  const absent = [...Object.values(groups.fr), ...Object.values(groups.ma)].filter(v => v === null).length;
  res.payload = {
    profil,
    evaluation: {
      source: typeof ev.source === 'string' && ev.source.trim() ? ev.source.trim() : typeof ev.src === 'string' && ev.src ? ev.src : 'Repères',
      date: typeof ev.date === 'string' && MONTH_RE.test(ev.date.trim()) ? ev.date.trim() : '',
      classe,
      fr: groups.fr, ma: groups.ma,
      precision: typeof ev.precision === 'string' ? ev.precision : ''
    },
    counts: { fr: nFr, ma: nMa, absent }
  };
  res.kind = 'eval';
  return res;
}

/* résumé lisible d'une évaluation : « Français : 9 compétences (2 absences) · Maths : 7 compétences » */
export function evalSummary(evaluation) {
  const ev = isObj(evaluation) ? evaluation : {};
  const part = (g, label) => {
    const vals = Object.values(isObj(ev[g]) ? ev[g] : {});
    if (!vals.length) return '';
    const abs = vals.filter(v => v === null).length;
    return label + '\u00A0: ' + plural(vals.length, 'compétence', 'compétences') + (abs ? ' (' + plural(abs, 'absence', 'absences') + ')' : '');
  };
  return [part('fr', 'Français'), part('ma', 'Maths')].filter(Boolean).join(' · ');
}

/* ============ IMPORT : fusion dans les données ============ */
/* prénoms comparés sans accents ni majuscules (« LÉA » = « Léa ») */
export const sameName = (a, b) => typeof a === 'string' && typeof b === 'string' && a.trim() !== '' && slug(a) === slug(b);

/* profil existant correspondant à un profil importé : même id ET même prénom, sinon même prénom → id | null */
export function findMatch(data, profile) {
  const profiles = isObj(data) && isObj(data.profiles) ? data.profiles : {};
  if (!isObj(profile)) return null;
  if (typeof profile.id === 'string' && has(profiles, profile.id) && sameName(profiles[profile.id].name, profile.name)) return profile.id;
  const hit = Object.keys(profiles).find(id => sameName(profiles[id].name, profile.name));
  return hit || null;
}

/* ajoute (nouvel id) ou remplace (targetId) un profil dans data — data est modifié en place.
   Le profil importé est normalisé ; en remplacement, l'id cible est conservé. → { id, mode } */
export function mergeProfile(data, profile, mode = 'add', targetId = null, today = dayStr()) {
  if (!isObj(data)) throw new TypeError('Données absentes.');
  if (!isObj(profile)) throw new TypeError('Profil absent.');
  if (!isObj(data.profiles)) data.profiles = {};
  if (mode === 'replace') {
    if (!targetId || !has(data.profiles, targetId)) throw new Error('Profil à remplacer introuvable.');
    const p = normalizeProfile({ ...deepClone(profile), id: targetId }, today);
    p.id = targetId;
    data.profiles[targetId] = p;
    return { id: targetId, mode: 'replace' };
  }
  const id = newProfileId(data);
  const p = normalizeProfile({ ...deepClone(profile), id }, today);
  p.id = id;
  data.profiles[id] = p;
  if (typeof data.active !== 'string' || !has(data.profiles, data.active)) data.active = id;
  return { id, mode: 'add' };
}

/* « remplacer tout » : données caramel-v3 normalisées, ou null si elles n'ont aucun profil */
export function replaceAll(newData, today = dayStr()) {
  if (!isObj(newData) || !isObj(newData.profiles) || !Object.keys(newData.profiles).length) return null;
  const d = normalizeData(deepClone(newData), today);
  return Object.keys(d.profiles).length ? d : null;
}

/* ============ date de la dernière sauvegarde téléchargée d'ici (réglage d'APPAREIL, jamais exporté) ============
   Rangée dans la clé de l'espace parents ('caramel-parent', champ saved : { [idProfil]: { at: ISO, name } }) ;
   ces fonctions ne touchent qu'à ce champ. Un identifiant de profil peut resservir à un autre enfant (profil supprimé
   puis nouveau profil, restauration) : une restauration qui écrit un profil oublie sa date, « Tout remplacer » les
   oublie toutes, la suppression d'un profil aussi (parents.js) ; et la date n'est montrée que si le prénom
   enregistré avec elle correspond encore (sameName). st : stockage (localStorage par défaut). */
export const SAVED_KEY = 'caramel-parent';
const localStore = () => { try { return globalThis.localStorage || null; } catch (_) { return null; } };
/* fn(saved) → true s'il a changé quelque chose (seulement alors on écrit) ; → true si tout s'est bien passé */
function editSaved(fn, st) {
  try {
    if (!st) return false;
    let o = null;
    try { o = JSON.parse(st.getItem(SAVED_KEY) || 'null'); } catch (_) { o = null; }
    if (!isObj(o)) o = {};
    if (!isObj(o.saved)) o.saved = {};
    if (fn(o.saved)) st.setItem(SAVED_KEY, JSON.stringify(o));
    return true;
  } catch (_) { return false; }
}
/* profils = [{ id, name }] qui viennent d'être téléchargés (ou partagés) d'ici */
export function noteSaved(profiles, { st = localStore(), now = new Date() } = {}) {
  const at = (now instanceof Date && !isNaN(now) ? now : new Date()).toISOString();
  const list = (Array.isArray(profiles) ? profiles : []).filter(p => isObj(p) && typeof p.id === 'string' && p.id);
  return editSaved(saved => {
    for (const p of list) saved[p.id] = { at, name: typeof p.name === 'string' ? p.name : '' };
    return list.length > 0;
  }, st);
}
/* ids = liste d'identifiants, ou null pour tout oublier */
export function forgetSaved(ids, { st = localStore() } = {}) {
  return editSaved(saved => {
    const keys = ids === null ? Object.keys(saved) : (Array.isArray(ids) ? ids : []).filter(id => has(saved, id));
    for (const k of keys) delete saved[k];
    return keys.length > 0;
  }, st);
}
/* → ISO de la dernière sauvegarde de ce profil téléchargée d'ici, ou '' (jamais, ou date d'un autre enfant) */
export function lastSaved(profile, { st = localStore() } = {}) {
  if (!isObj(profile) || typeof profile.id !== 'string' || !st) return '';
  try {
    const o = JSON.parse(st.getItem(SAVED_KEY) || 'null');
    const e = isObj(o) && isObj(o.saved) && has(o.saved, profile.id) ? o.saved[profile.id] : null;
    if (!isObj(e) || typeof e.at !== 'string' || isNaN(new Date(e.at))) return '';
    return sameName(e.name, profile.name) ? e.at : '';
  } catch (_) { return ''; }
}

/* ============ passage d'un fichier d'évaluation d'un écran à l'autre (parents → import) ============ */
let stash = null;
export function stashEval(parsed) { stash = parsed || null; }
export function takeStash() { const s = stash; stash = null; return s; }

/* ============ helpers DOM (à l'appel seulement) ============ */
/* téléchargement du fichier → true si lancé */
export function downloadExport(file) {
  if (!file || typeof file.json !== 'string') return false;
  return utilDownload(file.filename, file.json, 'application/json');
}

/* partage (Web Share avec fichier) ; Chrome Android refuse l'extension .json : on retente en .txt
   (le contenu reste du JSON, l'import accepte les deux). Repli : téléchargement.
   → 'shared' | 'cancelled' | 'downloaded' | 'failed' */
export async function shareExport(file, { title = 'Sauvegarde Caramel', text = '' } = {}) {
  const nav = globalThis.navigator;
  try {
    if (nav && typeof nav.share === 'function' && typeof nav.canShare === 'function' && typeof globalThis.File === 'function') {
      const variants = [
        new globalThis.File([file.json], file.filename, { type: 'application/json' }),
        new globalThis.File([file.json], file.filename.replace(/\.json$/, '.txt'), { type: 'text/plain' })
      ];
      for (const f of variants) {
        let ok = false;
        try { ok = nav.canShare({ files: [f] }); } catch (_) { ok = false; }
        if (!ok) continue;
        try { await nav.share({ files: [f], title, text: text || title }); return 'shared'; }
        catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; break; }
      }
    }
  } catch (_) {}
  return downloadExport(file) ? 'downloaded' : 'failed';
}

/* lecture d'un fichier choisi → texte */
export function readFileText(file) {
  return new Promise((resolve, reject) => {
    try {
      if (file && typeof file.text === 'function') { file.text().then(resolve, reject); return; }
      const fr = new globalThis.FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.onerror = () => reject(fr.error || new Error('lecture impossible'));
      fr.readAsText(file);
    } catch (e) { reject(e); }
  });
}

/* sélecteur de fichier (à appeler pendant un geste) → File | null (annulé) */
export function pickFile({ accept = '.json,.txt,application/json,text/plain' } = {}) {
  return new Promise(resolve => {
    try {
      const d = globalThis.document;
      const input = d.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.className = 'sr-only';
      input.tabIndex = -1;
      let done = false;
      const fin = f => { if (done) return; done = true; resolve(f || null); setTimeout(() => input.remove(), 0); };
      input.addEventListener('change', () => fin(input.files && input.files[0]));
      input.addEventListener('cancel', () => fin(null));
      d.body.appendChild(input);
      input.click();
    } catch (_) { resolve(null); }
  });
}

/* ============ feuille « restaurer une sauvegarde » (parents et import) ============
   parsed : résultat de parseBackup (kind 'profile' ou 'all') ; deps = { store, kit, storage? } (modules ; storage :
   stockage des dates de sauvegarde, localStorage par défaut). Les dates sont tenues ici, quel que soit l'écran
   appelant : « Télécharger d'abord » note la date de ce qui va être remplacé ; un profil ajouté ou remplacé oublie
   la sienne (son identifiant a pu servir à un autre enfant), « Tout remplacer » les oublie toutes.
   → Promise<{ mode: 'add' | 'replace' | 'all', ids } | null> (null = annulé) */
const dateFr = iso => {
  try {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s/g, '\u00A0');   /* « 3 octobre 2026 » d'un seul bloc */
  } catch (_) { return ''; }
};
function profileLine(p) {
  const bits = [];
  if (p.classe) bits.push(p.classe);
  bits.push(fmtNum((p.wallet && p.wallet.apples) || 0) + '\u00A0🍎');
  const stars = Object.values((p.wallet && p.wallet.stars) || {}).reduce((s, v) => s + Math.min(3, Math.max(0, v | 0)), 0);
  bits.push(fmtNum(stars) + '\u00A0⭐');
  return bits.join(' · ');
}

let cssAsked = false;
function ensureCSS() {
  if (cssAsked) return;
  cssAsked = true;
  try {
    const d = globalThis.document;
    if (!d || d.querySelector('link[href$="css/ui/backup.css"]')) return;
    const l = d.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('../../css/ui/backup.css', import.meta.url).href;
    d.head.appendChild(l);
  } catch (_) {}
}

/* confirmation d'un remplacement : dit que c'est définitif, propose « Télécharger d'abord » (retour sur le bouton
   lui-même : un toast cacherait les boutons de la feuille) → Promise<boolean> */
function confirmReplace(kit, { title, text, ok, backup }) {
  return new Promise(resolve => {
    let done = false;
    const fin = v => { if (!done) { done = true; resolve(v); } };
    let first = null;
    if (typeof backup === 'function') {
      first = h('button', { type: 'button', class: 'btn white small bk-first' }, h('span', { 'aria-hidden': 'true' }, '⬇️'), 'Télécharger d’abord');
      first.addEventListener('click', () => {
        let ok2 = false;
        try { ok2 = !!backup(); } catch (_) { ok2 = false; }
        first.textContent = ok2 ? frTypo('Sauvegarde téléchargée ✓') : frTypo('Le téléchargement n’a pas pu démarrer.');
        if (ok2) first.setAttribute('aria-disabled', 'true');
      });
    }
    const s = kit.sheet({
      title, content: h('div', { class: 'bk-sheet' }, h('p', { class: 'bk-help' }, text), first),
      actions: [{ label: 'Annuler', kind: 'white', onClick: () => fin(false) }, { label: ok, kind: 'pink', onClick: () => fin(true) }],
      onClose: () => fin(false)
    });
    if (!s || !s.el) fin(false);
  });
}

export function restoreFlow(parsed, { store, kit, storage = localStore() } = {}) {
  ensureCSS();
  return new Promise(resolve => {
    if (!parsed || !store || !kit || (parsed.kind !== 'profile' && parsed.kind !== 'all')) { resolve(null); return; }
    let settled = false;
    const fin = v => { if (!settled) { settled = true; resolve(v); } };
    const st = storage;
    const when = parsed.meta && parsed.meta.exported ? dateFr(parsed.meta.exported) : '';
    const data = store.getData();
    const toast = msg => { try { kit.toast(msg); } catch (_) {} };

    if (parsed.kind === 'profile') {
      const p = parsed.payload;
      const match = findMatch(data, p);
      const others = store.listProfiles();
      const content = h('div', { class: 'bk-sheet' },
        h('div', { class: 'bk-card' },
          h('div', { class: 'bk-name' }, p.name),
          h('div', { class: 'bk-meta' }, profileLine(p)),
          when ? h('div', { class: 'bk-meta' }, 'Sauvegarde du ' + when) : null),
        h('p', { class: 'bk-help' }, frTypo(match
          ? '« ' + data.profiles[match].name + ' » existe déjà sur cet appareil. Vous pouvez le remplacer par la sauvegarde, ou garder les deux.'
          : 'Ce profil sera ajouté aux profils de cet appareil.')));
      const add = () => {
        let res = null;
        store.mutate(d => { res = mergeProfile(d, p, 'add'); });
        forgetSaved([res.id], { st });
        toast(frTypo('Profil « ' + p.name + ' » ajouté ✓'));
        fin({ mode: 'add', ids: [res.id] });
      };
      const replace = async id => {
        const target = store.getProfile(id);
        const ok = await confirmReplace(kit, {
          title: frTypo('Remplacer « ' + (target ? target.name : '') + ' » ?'),
          text: frTypo('Les progrès de « ' + (target ? target.name : '') + ' » sur cet appareil seront remplacés par ceux de la sauvegarde' +
            (when ? ' du ' + when : '') + '. C’est définitif.'),
          ok: 'Remplacer',
          backup: target ? () => {
            const done = downloadExport(exportProfile(target));
            if (done) noteSaved([target], { st });
            return done;
          } : null
        });
        if (!ok) { fin(null); return; }
        store.mutate(d => { mergeProfile(d, p, 'replace', id); });
        forgetSaved([id], { st });
        toast(frTypo('Profil « ' + p.name + ' » restauré ✓'));
        fin({ mode: 'replace', ids: [id] });
      };
      const actions = [];
      if (match) actions.push({ label: frTypo('Remplacer « ' + data.profiles[match].name + ' »'), kind: 'white', onClick: () => { replace(match); } });
      actions.push({ label: others.length ? 'Ajouter comme nouveau profil' : 'Ajouter ce profil', onClick: add });
      if (!match && others.length) {
        actions.push({ label: 'Remplacer un profil existant…', kind: 'ghost', onClick: () => {
          const list = h('div', { class: 'bk-list' }, others.map(o =>
            h('button', { type: 'button', class: 'btn white block', on: { click: () => { s2.close('action'); replace(o.id); } } }, frTypo('Remplacer « ' + o.name + ' »'))));
          const s2 = kit.sheet({ title: frTypo('Quel profil remplacer ?'), content: list, onClose: r => { if (r !== 'action') fin(null); } });
        } });
      }
      kit.sheet({ title: 'Restaurer une sauvegarde', content, actions, onClose: r => { if (r !== 'action') fin(null); } });
      return;
    }

    /* toutes les données */
    const all = parsed.payload;
    const names = Object.values(all.profiles).map(p => p.name);
    const content = h('div', { class: 'bk-sheet' },
      h('div', { class: 'bk-card' },
        h('div', { class: 'bk-name' }, plural(names.length, 'profil', 'profils')),
        h('div', { class: 'bk-meta' }, frList(names)),
        when ? h('div', { class: 'bk-meta' }, 'Sauvegarde du ' + when) : null),
      h('p', { class: 'bk-help' }, 'Vous pouvez remplacer toutes les données de cet appareil par cette sauvegarde, ou simplement ajouter ces profils à ceux qui existent.'));
    const addAll = () => {
      const ids = [];
      store.mutate(d => { for (const p of Object.values(all.profiles)) ids.push(mergeProfile(d, p, 'add').id); });
      forgetSaved(ids, { st });
      toast(plural(ids.length, 'profil ajouté ✓', 'profils ajoutés ✓'));
      fin({ mode: 'add', ids });
    };
    const replaceEverything = async () => {
      const current = store.listProfiles();
      if (current.length) {
        const ok = await confirmReplace(kit, {
          title: 'Tout remplacer ?',
          text: frTypo('Les profils de cet appareil (' + frList(current.map(p => p.name)) + ') seront remplacés par ceux de la sauvegarde' +
            (when ? ' du ' + when : '') + '. C’est définitif.'),
          ok: 'Tout remplacer',
          backup: () => {
            const done = downloadExport(exportAll(store.getData()));
            if (done) noteSaved(current, { st });
            return done;
          }
        });
        if (!ok) { fin(null); return; }
      }
      const d = replaceAll(all);
      if (!d || !store.replaceData(d)) { toast('Cette sauvegarde n’a pas pu être restaurée.'); fin(null); return; }
      forgetSaved(null, { st });
      toast('Sauvegarde restaurée ✓');
      fin({ mode: 'all', ids: Object.keys(d.profiles) });
    };
    const actions = store.listProfiles().length
      ? [{ label: 'Ajouter ces profils', onClick: addAll }, { label: 'Tout remplacer', kind: 'white', onClick: () => { replaceEverything(); } }]
      : [{ label: 'Restaurer la sauvegarde', onClick: () => { replaceEverything(); } }];
    kit.sheet({ title: 'Restaurer une sauvegarde', content, actions, onClose: r => { if (r !== 'action') fin(null); } });
  });
}
