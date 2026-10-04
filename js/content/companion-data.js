/* ============ COMPAGNON : DONNÉES (v11, couleurs redessinées en v2.1) ============
   Module pur (aucun accès au DOM). Ids, prix et champs identiques à la v11 : les sauvegardes migrées y font
   référence (monture possédée, accessoires portés). Seule l'apparence a changé en v2.1 (compagnon redessiné,
   js/ui/mount-svg.js : couleurs, emoji du capybara) : elle n'est jamais enregistrée dans les sauvegardes.
   MOUNTS[type] : em = emoji (le capybara n'a pas d'emoji : 🐹, rongeur rond et petites oreilles, plutôt que le castor
                  🦫, absent des Android antérieurs à 11) · label = nom affiché · noun = nom commun (templating {leM}…)
                  g = genre grammatical de la monture (licorne = féminin) · kind = squelette SVG
                  horn = corne (licorne) · price = prix en 🍎 · body/mane/belly = robe, crins, ventre et museau
                  look = couleurs de détail du dessin : inner (creux des oreilles), hoof (sabots), sock (bas des
                  jambes), blaze (liste), shade (pattes du fond), mane2/mane3 (bandes de crinière), paw (pieds),
                  nose (truffe), wave (vague), spike (piques), wing (ailes), horn (cornes), muzzle (museau du
                  capybara), fin (nageoires du dauphin), frill (collerettes du dragon)
   FOODS : faim / joie = gain de jauge · SHOP : slot = emplacement (un seul objet porté par slot) */

export const MOUNTS = {
  pony:    { em:'🐴', label:'Poney',    noun:'poney',    g:'m', kind:'horse',   price:0,   body:'#c8863f', mane:'#7a4a24', belly:'#f0d2a2',
             look:{ inner:'#e8a98a', hoof:'#5e3a22' } },
  horse:   { em:'🐎', label:'Cheval',   noun:'cheval',   g:'m', kind:'horse',   price:60,  body:'#9a5530', mane:'#2e1c14', belly:'#d6a679',
             look:{ inner:'#c98a6a', hoof:'#2a1a12', sock:'#2e1c14', blaze:'#fffaf0' } },
  cat:     { em:'🐱', label:'Chat',     noun:'chat',     g:'m', kind:'cat',     price:80,  body:'#f59e3b', mane:'#c8641c', belly:'#fff1d6',
             look:{ inner:'#ffb3c1', paw:'#fff1d6' } },
  capy:    { em:'🐹', label:'Capybara', noun:'capybara', g:'m', kind:'capy',    price:100, body:'#b07a4c', mane:'#7f5232', belly:'#dcb48a',
             look:{ paw:'#5e3d26', inner:'#6e4630', nose:'#2e1d14', muzzle:'#c99467' } },
  dolphin: { em:'🐬', label:'Dauphin',  noun:'dauphin',  g:'m', kind:'dolphin', price:120, body:'#9cc4e4', mane:'#7aa6cc', belly:'#f7fbff',
             look:{ fin:'#86b1d6', wave:'#c9ecff' } },
  lion:    { em:'🦁', label:'Lion',     noun:'lion',     g:'m', kind:'lion',    price:130, body:'#eaa63c', mane:'#a8521e', belly:'#fde7b0',
             look:{ inner:'#a8521e', nose:'#7a4528' } },
  unicorn: { em:'🦄', label:'Licorne',  noun:'licorne',  g:'f', kind:'horse',   horn:1, price:150, body:'#fdf8ff', mane:'#f9a8d4', belly:'#ffe9f4',
             look:{ inner:'#ffc4dd', hoof:'#f6c344', shade:'#e6dcf6', mane2:'#c4b5fd', mane3:'#93c5fd' } },
  dragon:  { em:'🐉', label:'Dragon',   noun:'dragon',   g:'m', kind:'dragon',  price:150, body:'#3db6a2', mane:'#23806f', belly:'#fdf0c4',
             look:{ spike:'#f59e45', wing:'#ffcf8c', horn:'#fff3d6', frill:'#ffc27a' } }
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
