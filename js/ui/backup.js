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
   replaceAll(data) → données caramel-v3 normalisées (pour store.replaceData) ou null */

import { dayStr, slug, deepClone, fmtNum, frTypo, download as utilDownload, h } from '../core/util.js';
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
   parsed : résultat de parseBackup (kind 'profile' ou 'all') ; deps = { store, kit } (modules) ;
   → Promise<{ mode: 'add' | 'replace' | 'all', ids } | null> (null = annulé) */
const dateFr = iso => {
  try {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
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

export function restoreFlow(parsed, { store, kit } = {}) {
  ensureCSS();
  return new Promise(resolve => {
    if (!parsed || !store || !kit || (parsed.kind !== 'profile' && parsed.kind !== 'all')) { resolve(null); return; }
    let settled = false;
    const fin = v => { if (!settled) { settled = true; resolve(v); } };
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
        toast(frTypo('Profil « ' + p.name + ' » ajouté ✓'));
        fin({ mode: 'add', ids: [res.id] });
      };
      const replace = async id => {
        const target = store.getProfile(id);
        const ok = await kit.confirmSheet(frTypo('Remplacer les progrès de « ' + (target ? target.name : '') + ' » sur cet appareil par ceux de la sauvegarde ?'),
          { ok: 'Remplacer', cancel: 'Annuler', icon: '♻️' });
        if (!ok) { fin(null); return; }
        store.mutate(d => { mergeProfile(d, p, 'replace', id); });
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
      kit.sheet({ title: 'Importer une sauvegarde', content, actions, onClose: r => { if (r !== 'action') fin(null); } });
      return;
    }

    /* toutes les données */
    const all = parsed.payload;
    const names = Object.values(all.profiles).map(p => p.name);
    const content = h('div', { class: 'bk-sheet' },
      h('div', { class: 'bk-card' },
        h('div', { class: 'bk-name' }, plural(names.length, 'profil', 'profils')),
        h('div', { class: 'bk-meta' }, names.join(', ')),
        when ? h('div', { class: 'bk-meta' }, 'Sauvegarde du ' + when) : null),
      h('p', { class: 'bk-help' }, 'Vous pouvez remplacer toutes les données de cet appareil par cette sauvegarde, ou simplement ajouter ces profils à ceux qui existent.'));
    const addAll = () => {
      const ids = [];
      store.mutate(d => { for (const p of Object.values(all.profiles)) ids.push(mergeProfile(d, p, 'add').id); });
      toast(plural(ids.length, 'profil ajouté ✓', 'profils ajoutés ✓'));
      fin({ mode: 'add', ids });
    };
    const replaceEverything = async () => {
      const hasData = store.listProfiles().length > 0;
      if (hasData) {
        const ok = await kit.confirmSheet(frTypo('Remplacer TOUTES les données de cet appareil par cette sauvegarde ? Les profils actuels seront remplacés.'),
          { ok: 'Tout remplacer', cancel: 'Annuler', icon: '♻️' });
        if (!ok) { fin(null); return; }
      }
      const d = replaceAll(all);
      if (!d || !store.replaceData(d)) { toast('Cette sauvegarde n’a pas pu être importée.'); fin(null); return; }
      toast('Sauvegarde restaurée ✓');
      fin({ mode: 'all', ids: Object.keys(d.profiles) });
    };
    const actions = store.listProfiles().length
      ? [{ label: 'Ajouter ces profils', onClick: addAll }, { label: 'Tout remplacer', kind: 'white', onClick: () => { replaceEverything(); } }]
      : [{ label: 'Restaurer la sauvegarde', onClick: () => { replaceEverything(); } }];
    kit.sheet({ title: 'Importer une sauvegarde', content, actions, onClose: r => { if (r !== 'action') fin(null); } });
  });
}
