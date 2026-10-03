/* ============ COMPAGNON : DONNÉES (reprises VERBATIM de la v11) ============
   Module pur (aucun accès au DOM). Ids, prix, couleurs et champs identiques à la v11 :
   les sauvegardes migrées y font référence (monture possédée, accessoires portés).
   MOUNTS[type] : em = emoji · label = nom affiché · noun = nom commun (templating {leM}…)
                  g = genre grammatical de la monture (licorne = féminin) · kind = squelette SVG
                  horn = corne (licorne) · price = prix en 🍎 · body/mane/belly = couleurs de robe
   FOODS : faim / joie = gain de jauge · SHOP : slot = emplacement (un seul objet porté par slot) */

export const MOUNTS = {
  pony:    { em:'🐴', label:'Poney',    noun:'poney',    g:'m', kind:'horse',   price:0,   body:'#c8863f', mane:'#8a5a2b', belly:'#e9c391' },
  horse:   { em:'🐎', label:'Cheval',   noun:'cheval',   g:'m', kind:'horse',   price:60,  body:'#a16207', mane:'#3f2412', belly:'#e7c8a0' },
  cat:     { em:'🐱', label:'Chat',     noun:'chat',     g:'m', kind:'cat',     price:80,  body:'#f59e0b', mane:'#b45309', belly:'#fef3c7' },
  capy:    { em:'🦫', label:'Capybara', noun:'capybara', g:'m', kind:'capy',    price:100, body:'#b08e63', mane:'#87683f', belly:'#dcc7a1' },
  dolphin: { em:'🐬', label:'Dauphin',  noun:'dauphin',  g:'m', kind:'dolphin', price:120, body:'#8fb4d9', mane:'#5a86ad', belly:'#eef6fc' },
  lion:    { em:'🦁', label:'Lion',     noun:'lion',     g:'m', kind:'lion',    price:130, body:'#d97706', mane:'#92400e', belly:'#fde68a' },
  unicorn: { em:'🦄', label:'Licorne',  noun:'licorne',  g:'f', kind:'horse',   horn:1, price:150, body:'#f6f0ff', mane:'#f472b6', belly:'#ffffff' },
  dragon:  { em:'🐉', label:'Dragon',   noun:'dragon',   g:'m', kind:'dragon',  price:150, body:'#4caf7d', mane:'#166534', belly:'#bbf7d0' }
};

export const FOODS = [
  { id:'carotte', e:'🥕', name:'Carotte', price:5,  faim:15, joie:0 },
  { id:'pomme',   e:'🍎', name:'Pomme',   price:10, faim:30, joie:5 },
  { id:'tarte',   e:'🥧', name:'Tarte',   price:25, faim:70, joie:12 }
];

export const SHOP = [
  { id:'foulard',  e:'🧣', name:'Foulard',      price:30,  slot:'neck' },
  { id:'noeud',    e:'🎀', name:'Nœud',         price:30,  slot:'tail' },
  { id:'chapeau',  e:'👒', name:'Chapeau',      price:50,  slot:'head' },
  { id:'lunettes', e:'🕶️', name:'Lunettes',    price:50,  slot:'face' },
  { id:'echarpe',  e:'🌈', name:'Écharpe',      price:80,  slot:'neck' },
  { id:'selle',    e:'🏵️', name:'Selle dorée', price:80,  slot:'back' },
  { id:'couronne', e:'👑', name:'Couronne',     price:120, slot:'head' },
  { id:'ailes',    e:'🦋', name:'Ailes de fée', price:150, slot:'wings' }
];

/* Jauges du compagnon (bienveillant, jamais punitif) — constantes v11.
   FLOOR = plancher (jamais de « mort ») · DECAY = durée d'une baisse de 100 points (ms),
   décroissance calculée à la volée depuis pet.last (pet.last = 0 → pas encore de référence).
   START = valeur initiale (defaultSave v11) · actions v11 : brossage (délai 4 h), promenade (1 fois/jour), caresse. */
export const PET = {
  FLOOR: 15,
  MAX: 100,
  START: 80,
  DECAY: { faim: 48 * 3600e3, forme: 72 * 3600e3, joie: 96 * 3600e3 },
  BRUSH: { cooldown: 4 * 3600e3, joie: 15 },
  WALK: { forme: 25, joie: 8 },
  TAP: { joie: 2 }
};
