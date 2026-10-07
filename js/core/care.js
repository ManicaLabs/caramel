/* ============ SOINS DU COMPAGNON : règles (v2.4, retours du parent du 07/10/2026) ============
   Module pur (aucun accès au navigateur), testé par tests/soins.test.mjs ; écran : js/ui/companion.js (scène de
   l'accueil) ; concours « En famille » : js/core/family.js (gaugesNow = gaugesAt, mêmes jauges que la scène).
   Retours du parent :
     « On peut nourrir Caramel à l'infini : s'il n'a plus faim, ça ne doit plus être possible. »
     « La promenade et le brossage ont un usage gratuit par jour, puis on doit utiliser des pommes. »
     « Adapter l'achat de nourriture selon l'animal. » (aliments : js/content/companion-data.js, FOODS / DIET)
   Règles :
   - Jauges (faim, forme, joie) : décroissance douce depuis pet.last, plancher PET.FLOOR, plafond PET.MAX (v11).
   - Une jauge « sert » un soin si elle est sous PET.FULL (90) ET qu'au moins la moitié du gain y entre
     (fits) : rien ne se paie pour rien. Nourrir : faim ≥ 90 → « il n'a plus faim » (tout le garde-manger) ; aliment
     trop gros pour sa faim (la tarte à 80) → « choisis plus petit ». Brossage (joie) et promenade (forme) : idem.
   - Brossage et promenade : le PREMIER du jour est gratuit, toujours permis (petit rituel quotidien, même jauge
     pleine) ; les suivants coûtent PET.BRUSH.price / PET.WALK.price 🍎, seulement s'ils servent. Compteur du jour :
     pet.care = { d, brush, walk } (remis à zéro le lendemain ; profil d'avant la 2.4 : pet.brushLast et pet.walkDay
     disent ce qui a déjà été fait aujourd'hui). Plus de délai de 4 h ni de promenade unique (v11).
   - Anti-hardcore (CDC §7.7) : les pommes ne baissent que par une dépense choisie (aliment, soin payant), jamais
     sous 0 (economy.addApples) ; un soin refusé ne coûte rien.
   API : gaugesAt(pet, now) → { faim, forme, joie } · settle(pet, now) (fige les jauges avant une modification) ·
     level(valeur) (arrondi) · fits(valeur, gain) · careToday(pet, jour) → { brush, walk } ·
     foodOffer(profil, idAliment, now) → { ok, why: null | 'unknown' | 'full' | 'big' | 'short', food, price, missing } ·
     feed(profil, idAliment, now) → idem, appliqué si ok ·
     careOffer(profil, 'brush' | 'walk', jour, now) → { ok, why: null | 'unknown' | 'full' | 'short', kind, free, price, full, missing, count } ·
     doCare(profil, kind, jour, now) → idem, appliqué si ok.
   feed et doCare modifient le profil reçu : à appeler dans store.mutateProfile. */

import { PET, FOOD_BY_ID } from '../content/companion-data.js';
import { addApples } from './economy.js';
import { dayStr } from './util.js';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, def = 0) => { const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN; return Number.isFinite(n) ? n : def; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const GAUGES = ['faim', 'forme', 'joie'];

/* jauges à l'instant `now` (pet.last = 0 → pas encore de référence : valeurs enregistrées) */
export function gaugesAt(pet, now = Date.now()) {
  const p = isObj(pet) ? pet : {};
  const last = num(p.last, 0);
  const dt = last > 0 ? Math.max(0, now - last) : 0;
  const g = k => clamp(num(p[k], PET.START) - (100 * dt) / PET.DECAY[k], PET.FLOOR, PET.MAX);
  return { faim: g('faim'), forme: g('forme'), joie: g('joie') };
}
/* fige les valeurs courantes avant toute modification (pet.last = now) */
export function settle(pet, now = Date.now()) {
  if (!isObj(pet)) return pet;
  const g = gaugesAt(pet, now);
  for (const k of GAUGES) pet[k] = g[k];
  pet.last = now;
  return pet;
}
/* niveau d'une jauge tel que l'enfant le voit (arrondi : l'anneau et le nom accessible disent « 90 sur 100 ») ; sans
   l'arrondi, une faim remontée à 90 tout juste repasserait sous 90 la milliseconde suivante */
export const level = v => Math.round(num(v, PET.START));
/* un gain « sert » : jauge sous PET.FULL et au moins la moitié du gain y entre */
export function fits(value, gain) {
  const v = level(value);
  return v < PET.FULL && PET.MAX - v >= num(gain, 0) / 2;
}

/* ---------- brossage, promenade : compteur du jour ---------- */
const KINDS = Object.freeze({
  brush: { gauge: 'joie', gain: () => PET.BRUSH.joie, price: () => PET.BRUSH.price },
  walk: { gauge: 'forme', gain: () => PET.WALK.forme, price: () => PET.WALK.price }
});
const count = v => clamp(Math.trunc(num(v, 0)), 0, 99);
export function careToday(pet, today = dayStr()) {
  const p = isObj(pet) ? pet : {};
  const c = isObj(p.care) ? p.care : null;
  if (c && c.d === today) return { brush: count(c.brush), walk: count(c.walk) };
  /* rien de compté aujourd'hui (sauvegarde d'avant la 2.4, ou compteur d'un autre jour) : l'ancienne règle a pu
     brosser ou promener aujourd'hui même — c'était alors le soin gratuit du jour */
  const bl = num(p.brushLast, 0);
  return { brush: bl > 0 && dayStr(new Date(bl)) === today ? 1 : 0, walk: p.walkDay === today ? 1 : 0 };
}
const apples = profile => Math.max(0, Math.trunc(num(isObj(profile) && isObj(profile.wallet) ? profile.wallet.apples : 0, 0)));
const petOf = profile => (isObj(profile) && isObj(profile.companion) && isObj(profile.companion.pet) ? profile.companion.pet : null);

export function careOffer(profile, kind, today = dayStr(), now = Date.now()) {
  const K = KINDS[kind];
  const pet = petOf(profile);
  if (!K || !pet) return { ok: false, why: 'unknown', kind, free: false, price: 0, full: false, missing: 0, count: 0 };
  const done = careToday(pet, today)[kind];
  const free = done === 0;
  const full = !fits(gaugesAt(pet, now)[K.gauge], K.gain());
  const price = free ? 0 : K.price();
  const have = apples(profile);
  const why = free ? null : full ? 'full' : have < price ? 'short' : null;
  return { ok: !why, why, kind, free, price, full, missing: why === 'short' ? price - have : 0, count: done };
}
export function doCare(profile, kind, today = dayStr(), now = Date.now()) {
  const o = careOffer(profile, kind, today, now);
  if (!o.ok) return o;
  const pet = settle(petOf(profile), now);
  if (o.price) addApples(profile, -o.price);
  const c = careToday(pet, today);
  c[kind] = Math.min(99, c[kind] + 1);
  pet.care = { d: today, brush: c.brush, walk: c.walk };
  if (kind === 'brush') {
    pet.joie = Math.min(PET.MAX, pet.joie + PET.BRUSH.joie);
    pet.brushLast = now;                                   /* champ v11, gardé (sauvegardes, anciennes versions) */
  } else {
    pet.forme = Math.min(PET.MAX, pet.forme + PET.WALK.forme);
    pet.joie = Math.min(PET.MAX, pet.joie + PET.WALK.joie);
    pet.walkDay = today;                                   /* champ v11, gardé */
  }
  return o;
}

/* ---------- nourrir ---------- */
export function foodOffer(profile, foodId, now = Date.now()) {
  const f = FOOD_BY_ID[foodId] || null;
  const pet = petOf(profile);
  if (!f || !pet) return { ok: false, why: 'unknown', food: f, price: f ? f.price : 0, missing: 0 };
  const faim = gaugesAt(pet, now).faim;
  const have = apples(profile);
  const why = level(faim) >= PET.FULL ? 'full' : !fits(faim, f.faim) ? 'big' : have < f.price ? 'short' : null;
  return { ok: !why, why, food: f, price: f.price, missing: why === 'short' ? f.price - have : 0 };
}
export function feed(profile, foodId, now = Date.now()) {
  const o = foodOffer(profile, foodId, now);
  if (!o.ok) return o;
  const pet = settle(petOf(profile), now);
  addApples(profile, -o.price);
  pet.faim = Math.min(PET.MAX, pet.faim + o.food.faim);
  pet.joie = Math.min(PET.MAX, pet.joie + (o.food.joie || 0));
  return o;
}
