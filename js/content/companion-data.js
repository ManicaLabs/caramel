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
                  capybara), fin (nageoires du dauphin), frill (collerettes du dragon) ; v2.5 : beak (bec), feet (pattes des
                  oiseaux), et ce que chaque nouvelle espèce documente
   FOODS : faim / joie = gain de jauge · say = l'aliment avec son article : le compagnon dit « Miam, une carotte ! » en
           le croquant (foodLine ; clips enregistrés : js/content/voice-lines.js) · DIET[type] = les 3 aliments de l'espèce (v2.4)
   SHOP : slot = emplacement (un seul objet porté par slot) */

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
             look:{ fin:'#86b1d6', wave:'#c9ecff' }, coat:'peau', water:true },
  lion:    { em:'🦁', label:'Lion',     noun:'lion',     g:'m', kind:'lion',    price:130, body:'#eaa63c', mane:'#a8521e', belly:'#fde7b0',
             look:{ inner:'#a8521e', nose:'#7a4528' } },
  unicorn: { em:'🦄', label:'Licorne',  noun:'licorne',  g:'f', kind:'horse',   horn:1, price:150, body:'#fdf8ff', mane:'#f9a8d4', belly:'#ffe9f4',
             look:{ inner:'#ffc4dd', hoof:'#f6c344', shade:'#e6dcf6', mane2:'#c4b5fd', mane3:'#93c5fd' } },
  dragon:  { em:'🐉', label:'Dragon',   noun:'dragon',   g:'m', kind:'dragon',  price:150, body:'#3db6a2', mane:'#23806f', belly:'#fdf0c4',
             look:{ spike:'#f59e45', wing:'#ffcf8c', horn:'#fff3d6', frill:'#ffc27a' }, coat:'ecailles' },
  /* v2.5 (demande du parent du 07/10/2026 : « l'ours, le chien, un oiseau, la baleine et le koala, des animaux que les
     enfants aiment » ; pour l'oiseau : « fais les 4 » — chouette, perroquet, pingouin, poussin). coat = ce que le
     brossage complimente (poil par défaut, peau, ecailles, plumes) ; water = vit dans l'eau (scène du lac, pas d'ombre
     au sol, « faire un petit tour » au lieu de « se dégourdir les pattes ») */
  /* -- terre (ours, koala, chien) : look.muzzle = museau clair de l'ours, look.paw = pieds gris foncé du koala et
     chaussettes du chien, look.blaze (repli blanc) = bout de la queue du chien ; liste et museau du chien = belly -- */
  bear:    { em:'🐻', label:'Ours',      noun:'ours',      g:'m', kind:'bear',   price:110, body:'#a8703f', mane:'#7a4a24', belly:'#e8c79a',
             look:{ inner:'#e8c79a', nose:'#2e1d14', muzzle:'#e8c79a' } },
  koala:   { em:'🐨', label:'Koala',     noun:'koala',     g:'m', kind:'koala',  price:90,  body:'#a9a9b8', mane:'#7c7c8c', belly:'#f2f0f5',
             look:{ inner:'#f4f2f7', nose:'#3a3340', paw:'#77748a' } },
  dog:     { em:'🐶', label:'Chien',     noun:'chien',     g:'m', kind:'dog',    price:70,  body:'#d9a066', mane:'#8a5a32', belly:'#fff1dc',
             look:{ inner:'#8a5a32', nose:'#2e1d14', paw:'#fff1dc' } },
  /* -- eau (baleine) -- */
  whale:   { em:'🐳', label:'Baleine',   noun:'baleine',   g:'f', kind:'whale',  price:140, body:'#6f9fd8', mane:'#5585c0', belly:'#eaf4ff',
             look:{ fin:'#5d8fcc', wave:'#c9ecff' }, coat:'peau', water:true },
  /* -- oiseaux (chouette, perroquet, pingouin, poussin) -- */
  owl:     { em:'🦉', label:'Chouette',  noun:'chouette',  g:'f', kind:'bird',   price:120, body:'#b98a5a', mane:'#8a6038', belly:'#f3dfc0',
             look:{ beak:'#f0a830', beak2:'#c98320', feet:'#f2b33d', wing:'#9a6a3e', disk:'#fbefd9' }, coat:'plumes' },
  parrot:  { em:'🦜', label:'Perroquet', noun:'perroquet', g:'m', kind:'bird',   price:130, body:'#4cc26a', mane:'#e8453c', belly:'#ffe066',
             look:{ head:'#e8453c', face:'#fffaf0', beak:'#f4ead6', beak2:'#4a3a34', wing:'#3a8de0', tail2:'#ffd23f', feet:'#8a8a9a' }, coat:'plumes' },
  penguin: { em:'🐧', label:'Pingouin',  noun:'pingouin',  g:'m', kind:'bird',   price:110, body:'#3d4a63', mane:'#2a3346', belly:'#fbfbff',
             look:{ beak:'#ffb02e', beak2:'#f08c1c', feet:'#ffb02e' }, coat:'plumes' },
  chick:   { em:'🐥', label:'Poussin',   noun:'poussin',   g:'m', kind:'bird',   price:70,  body:'#ffd84a', mane:'#f6b92b', belly:'#fff3b0',
             look:{ beak:'#ff9a3c', beak2:'#f07a22', feet:'#ff9a3c', wing:'#ffcd38' }, coat:'plumes' }
};
/* ce que le brossage complimente, et l'eau */
export const coatOf = type => (MOUNTS[type] && MOUNTS[type].coat) || 'poil';
export const inWater = type => !!(MOUNTS[type] && MOUNTS[type].water);

/* Aliments (v2.4, retour du parent du 07/10/2026 : « adapter la nourriture selon l'animal ») : chaque espèce a SES trois
   aliments, sur le modèle v11 — un petit (5 🍎, +15 faim), un moyen (10 🍎, +30 faim, +5 joie), un régal (25 🍎, +70 faim,
   +12 joie). Ids stables (sauvegardes, clips de voix) ; carotte, pomme (la Poire) et tarte : ids v11 gardés pour la
   famille du cheval. Un même aliment peut nourrir deux espèces (poisson : chat et dauphin ; poire : poney, cheval et
   licorne) : mêmes prix et gains partout. Emoji d'Emoji 12 au plus (Android anciens) ; un emoji = un seul aliment
   (miettes de js/ui/companion-life.js, CRUMBS). */
export const FOODS = [
  /* poney, cheval (et licorne pour la poire) */
  { id:'carotte',    e:'🥕', name:'Carotte',    price:5,  faim:15, joie:0,  say:'une carotte' },
  { id:'pomme',      e:'🍐', name:'Poire',      price:10, faim:30, joie:5,  say:'une poire' },   /* id gardé (sauvegardes) ; une « pomme » à 10 🍎 prêtait à confusion (D4-24) */
  { id:'tarte',      e:'🥧', name:'Tarte',      price:25, faim:70, joie:12, say:'une tarte' },
  /* licorne */
  { id:'fraise',     e:'🍓', name:'Fraise',     price:5,  faim:15, joie:0,  say:'une fraise' },
  { id:'gateau',     e:'🍰', name:'Gâteau',     price:25, faim:70, joie:12, say:'du gâteau' },
  /* chat (le poisson aussi pour le dauphin) */
  { id:'croquettes', e:'🥣', name:'Croquettes', price:5,  faim:15, joie:0,  say:'des croquettes' },
  { id:'poisson',    e:'🐟', name:'Poisson',    price:10, faim:30, joie:5,  say:'du poisson' },
  { id:'sushi',      e:'🍣', name:'Sushi',      price:25, faim:70, joie:12, say:'des sushis' },
  /* dauphin */
  { id:'crevette',   e:'🦐', name:'Crevette',   price:5,  faim:15, joie:0,  say:'une crevette' },
  { id:'calamar',    e:'🦑', name:'Calamar',    price:25, faim:70, joie:12, say:'un calamar' },
  /* capybara (la mandarine : il en pose déjà une sur sa tête) */
  { id:'mandarine',  e:'🍊', name:'Mandarine',  price:5,  faim:15, joie:0,  say:'une mandarine' },
  { id:'salade',     e:'🥬', name:'Salade',     price:10, faim:30, joie:5,  say:'de la salade' },
  { id:'pasteque',   e:'🍉', name:'Pastèque',   price:25, faim:70, joie:12, say:'de la pastèque' },
  /* lion */
  { id:'poulet',     e:'🍗', name:'Poulet',     price:5,  faim:15, joie:0,  say:'du poulet' },
  { id:'steak',      e:'🥩', name:'Steak',      price:10, faim:30, joie:5,  say:'un steak' },
  { id:'burger',     e:'🍔', name:'Hamburger',  price:25, faim:70, joie:12, say:'un hamburger' },
  /* dragon (le maïs éclate en pop-corn, la pizza cuit à son feu) */
  { id:'piment',     e:'🌶\uFE0F', name:'Piment', price:5, faim:15, joie:0,  say:'un piment' },
  { id:'popcorn',    e:'🍿', name:'Pop-corn',   price:10, faim:30, joie:5,  say:'du pop-corn' },
  { id:'pizza',      e:'🍕', name:'Pizza',      price:25, faim:70, joie:12, say:'de la pizza' }
  /* v2.5 — terre (ours, koala, chien) : aliments ajoutés ici */
  /* ours : cerises, poisson (celui du chat), miel ; koala : rien que de l'eucalyptus (pousse, feuilles, branche) ; chien :
     croquettes (celles du chat), saucisse, os. Chaque entrée commence par sa virgule (la ligne de la pizza n'en a pas) */
  , { id:'cerises',    e:'🍒', name:'Cerises',    price:5,  faim:15, joie:0,  say:'des cerises' }
  , { id:'miel',       e:'🍯', name:'Miel',       price:25, faim:70, joie:12, say:'du miel' }
  , { id:'pousse',     e:'🌱', name:'Pousse',     price:5,  faim:15, joie:0,  say:'une pousse' }
  , { id:'feuilles',   e:'🍃', name:'Feuilles',   price:10, faim:30, joie:5,  say:'des feuilles' }
  , { id:'eucalyptus', e:'🌿', name:'Eucalyptus', price:25, faim:70, joie:12, say:'une branche d’eucalyptus' }
  , { id:'saucisse',   e:'🌭', name:'Saucisse',   price:10, faim:30, joie:5,  say:'une saucisse' }
  , { id:'os',         e:'🦴', name:'Os',         price:25, faim:70, joie:12, say:'un os' }
  /* v2.5 — eau (baleine) : aliments ajoutés ici */
  /* baleine : crevette et calamar (ceux du dauphin), petits poissons (en banc, comme le krill) entre les deux */
  , { id:'petitspoissons', e:'🐠', name:'Petits poissons', price:10, faim:30, joie:5, say:'des petits poissons' }
  /* v2.5 — oiseaux (chouette, perroquet, pingouin, poussin) : aliments ajoutés ici */
  /* chouette : des insectes, du plus petit au régal (jamais de souris) ; perroquet : graines de tournesol, fruits ;
     pingouin : crevette et poisson (ceux du dauphin), sushis en régal (ceux du chat : un menu à lui) ; poussin : blé,
     maïs, et la pastèque du capybara (les poules en raffolent) */
  , { id:'chenille',   e:'🐛', name:'Chenille',   price:5,  faim:15, joie:0,  say:'une chenille' }
  , { id:'grillon',    e:'🦗', name:'Grillon',    price:10, faim:30, joie:5,  say:'un grillon' }
  , { id:'brochette',  e:'🍢', name:'Brochette',  price:25, faim:70, joie:12, say:'une brochette de grillons' }
  , { id:'graines',    e:'🌻', name:'Graines',    price:5,  faim:15, joie:0,  say:'des graines' }
  , { id:'banane',     e:'🍌', name:'Banane',     price:10, faim:30, joie:5,  say:'une banane' }
  , { id:'mangue',     e:'🥭', name:'Mangue',     price:25, faim:70, joie:12, say:'une mangue' }
  , { id:'ble',        e:'🌾', name:'Blé',        price:5,  faim:15, joie:0,  say:'du blé' }
  , { id:'mais',       e:'🌽', name:'Maïs',       price:10, faim:30, joie:5,  say:'du maïs' }
];
export const FOOD_BY_ID = Object.freeze(Object.fromEntries(FOODS.map(f => [f.id, f])));
/* les trois aliments de chaque espèce, du petit au régal */
export const DIET = Object.freeze({
  pony:    ['carotte', 'pomme', 'tarte'],
  horse:   ['carotte', 'pomme', 'tarte'],
  unicorn: ['fraise', 'pomme', 'gateau'],
  cat:     ['croquettes', 'poisson', 'sushi'],
  dolphin: ['crevette', 'poisson', 'calamar'],
  capy:    ['mandarine', 'salade', 'pasteque'],
  lion:    ['poulet', 'steak', 'burger'],
  dragon:  ['piment', 'popcorn', 'pizza'],
  /* v2.5 : régimes provisoires (aliments existants), chaque agent remplace la ligne de ses espèces */
  bear:    ['cerises', 'poisson', 'miel'],
  koala:   ['pousse', 'feuilles', 'eucalyptus'],
  dog:     ['croquettes', 'saucisse', 'os'],
  whale:   ['crevette', 'petitspoissons', 'calamar'],
  owl:     ['chenille', 'grillon', 'brochette'],
  parrot:  ['graines', 'banane', 'mangue'],
  penguin: ['crevette', 'poisson', 'sushi'],
  chick:   ['ble', 'mais', 'pasteque']
});
/* aliments du garde-manger d'une espèce (espèce inconnue → ceux du poney) */
export const foodsOf = type => (DIET[type] || DIET.pony).map(id => FOOD_BY_ID[id]);
/* ce que dit le compagnon en croquant un aliment (affiché et dit : « Miam, une carotte ! ») */
export const foodLine = f => 'Miam, ' + f.say + ' !';

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
   décroissance calculée à la volée depuis pet.last (pet.last = 0 → pas encore de référence ; js/core/care.js gaugesAt).
   START = valeur initiale (defaultSave v11).
   Soins (v2.4, retours du parent du 07/10/2026 ; règles dans js/core/care.js) : FULL = jauge « presque pleine » :
   on ne nourrit plus un compagnon rassasié, on ne paie pas un brossage ni une promenade qui ne servirait à rien ;
   brossage (+15 joie) et promenade (+25 forme, +8 joie) : le premier du jour est gratuit, les suivants coûtent
   BRUSH.price / WALK.price 🍎 (le prix du petit et du moyen aliment : des gains du même ordre). Remplace le délai de
   4 h du brossage et la promenade unique de la v11. Caresse : +2 joie, toujours gratuite. */
export const PET = {
  FLOOR: 15,
  MAX: 100,
  START: 80,
  DECAY: { faim: 48 * 3600e3, forme: 72 * 3600e3, joie: 96 * 3600e3 },
  FULL: 90,
  BRUSH: { joie: 15, price: 5 },
  WALK: { forme: 25, joie: 8, price: 10 },
  TAP: { joie: 2 }
};
