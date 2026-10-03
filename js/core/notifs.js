/* ============ RAPPELS QUOTIDIENS (notifications) — port de la v11 ============
   v11 → v2 : maybeShowNotifCard → shouldOffer() (l'écran affiche lui-même sa carte « 🔔 Un petit rappel
   chaque jour ? »), enableNotifs → enable() (renvoie le statut), dismissNotifs → dismiss().
   Même préférence d'appareil 'caramel-notifs' ('on' | 'later' | 'denied'), même synchronisation
   périodique 'caramel-daily' (23 h) traitée par sw.js. Textes : « Caramel » au lieu de « La course de Caramel ».
   Aucun accès au navigateur au chargement du module. */
import { frTypo } from './util.js';

export const PREF_KEY = 'caramel-notifs';
export const SYNC_TAG = 'caramel-daily';
const MIN_INTERVAL = 23 * 60 * 60 * 1000;
const TITLE = 'Caramel 🐴';
const ICON = 'icon-192.png';
const SW_WAIT_MS = 4000;      /* navigator.serviceWorker.ready ne se résout jamais sans service worker */

function getPref() { try { return globalThis.localStorage.getItem(PREF_KEY); } catch (_) { return null; } }
function setPref(v) { try { globalThis.localStorage.setItem(PREF_KEY, v); } catch (_) {} }
function hasNotification() { try { return typeof globalThis.Notification === 'function'; } catch (_) { return false; } }

/* proposer la carte de rappels ? (API présente, permission jamais demandée, pas de choix mémorisé) */
export function shouldOffer() {
  try {
    if (!hasNotification()) return false;
    if (globalThis.Notification.permission !== 'default') return false;
    if (getPref()) return false;
    return true;
  } catch (_) { return false; }
}

/* « Plus tard » */
export function dismiss() { setPref('later'); }

/* état courant, pour l'espace parents : { supported, permission, pref, daily } (daily : rappel périodique enregistré) */
export async function status() {
  const out = { supported: hasNotification(), permission: 'unsupported', pref: getPref(), daily: false };
  try { if (out.supported) out.permission = globalThis.Notification.permission; } catch (_) {}
  try {
    const reg = await swReady();
    if (reg && reg.periodicSync) out.daily = (await reg.periodicSync.getTags()).includes(SYNC_TAG);
  } catch (_) {}
  return out;
}

function swReady() {
  try {
    const sw = globalThis.navigator && globalThis.navigator.serviceWorker;
    if (!sw) return Promise.resolve(null);
    return Promise.race([sw.ready, new Promise(r => setTimeout(() => r(null), SW_WAIT_MS))]);
  } catch (_) { return Promise.resolve(null); }
}

function requestPermission() {
  return new Promise(res => {
    try {
      const p = globalThis.Notification.requestPermission(res);   /* ancien Safari : forme à rappel */
      if (p && typeof p.then === 'function') p.then(res, () => res('denied'));
    } catch (_) { res('denied'); }
  });
}

function plainNotification(body) {
  try { new globalThis.Notification(TITLE, { body, icon: ICON }); } catch (_) {}
}

/* « Activer » → 'unsupported' | 'denied' | 'on' (notifications permises, pas de rappel automatique)
                | 'daily' (rappel quotidien enregistré) */
export async function enable() {
  try {
    if (!hasNotification()) return 'unsupported';
    const perm = await requestPermission();
    if (perm !== 'granted') { setPref('denied'); return 'denied'; }
    setPref('on');
    let periodic = false;
    const reg = await swReady();
    if (reg) {
      try {
        if ('periodicSync' in reg) {
          try {
            const st = await globalThis.navigator.permissions.query({ name: 'periodic-background-sync' });
            if (st.state === 'granted') {
              await reg.periodicSync.register(SYNC_TAG, { minInterval: MIN_INTERVAL });
              periodic = true;
            }
          } catch (_) {}
        }
        await reg.showNotification(TITLE, {
          body: periodic ? frTypo('Rappels quotidiens activés ! À demain 🌟')
            : frTypo('Notifications activées ! Pour les rappels automatiques : installe Caramel sur ton écran d’accueil (Chrome Android).'),
          icon: ICON
        });
      } catch (_) { plainNotification(frTypo('Notifications activées ! 🌟')); }
    } else {
      plainNotification(frTypo('Notifications activées ! 🌟'));
    }
    return periodic ? 'daily' : 'on';
  } catch (_) { return 'unsupported'; }
}
