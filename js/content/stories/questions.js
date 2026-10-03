/* ============ QUESTIONS DE COMPRÉHENSION (1 QCM par histoire) ============
   Posées après la course (fr.comp_ecrit). Module pur.
     type    : 'explicite' (l'information est écrite) | 'inference' (il faut la déduire)
               | 'vocabulaire' (sens d'un mot ou d'une expression dans le contexte) ;
     q       : la question ; choices : 4 réponses ; answer : index de la bonne réponse ;
     cite    : passage du texte (sous-chaîne exacte du gabarit) qui justifie la réponse,
               pour l'indice « relis ce passage » ou pour le surligner dans le texte.
   Textes AFFICHÉS (jamais lus par la reco) : apostrophe typographique ’ et traits d'union permis.
   Templatés avec les mêmes jetons que les histoires ({P} {N} {El} {el} {ilM} {IlM} {sonM}
   {contentM}…) → les passer à fillTemplate avant affichage (q, chaque choix et cite).
   Jamais « de {P} », « que {N} »… : le prénom peut commencer par une voyelle (« d’Emma »).
   Espaces fines insécables avant ? ! : ; ajoutées ici par frTypo (les sources gardent
   des espaces normales, plus lisibles). Les choix ne sont pas mélangés : le jeu peut le faire
   (en suivant l'index answer), les bonnes réponses sont déjà réparties sur les 4 positions.
   Les inférences deviennent majoritaires à partir du CM (CDC §5.2). */

import { frTypo } from '../../core/util.js';

const RAW = {
  /* ---------- Premiers galops ---------- */
  'ce1-carotte': { type: 'explicite', q: 'Que donne {P} à {N} ?',
    choices: ['Une carotte orange', 'Une pomme rouge', 'Une fleur du pré', 'Un sac de foin'], answer: 0,
    cite: '{El} lui donne une carotte orange.' },
  'ce1-bain': { type: 'inference', q: 'Pourquoi {P} prépare-t-{el} un bain ?',
    choices: ['Pour jouer avec les gouttes', 'Parce qu’il fait très froid', 'Pour enlever la boue', 'Pour fêter un anniversaire'], answer: 2,
    cite: 'Ce matin, {N} est {pleinM} de boue.' },
  'ce1-verger': { type: 'explicite', q: 'Combien de pommes {P} attrape-t-{el} ?',
    choices: ['Une', 'Deux', 'Trois', 'Dix'], answer: 2,
    cite: 'attrape trois belles pommes' },
  'ce1-nuit': { type: 'explicite', q: 'Quelle histoire {P} raconte-t-{el} à {N} ?',
    choices: ['Une histoire de fées', 'Une histoire de pirates et de trésors', 'Une histoire de loups', 'Une histoire de chevaliers'], answer: 1,
    cite: 'une petite histoire de pirates et de trésors' },
  'ce1-flaque': { type: 'vocabulaire', q: 'Dans l’histoire, « rire aux éclats », c’est :',
    choices: ['rire très fort', 'pleurer un peu', 'se fâcher', 'rire tout bas'], answer: 0,
    cite: 'rit aux éclats' },
  'ce1-cadeau': { type: 'explicite', q: 'Qu’y a-t-il dans le gros cadeau rouge ?',
    choices: ['Un ballon et des pommes', 'Un chapeau et des bonbons', 'Un ruban et une étoile', 'Une couverture et un sac de carottes'], answer: 3,
    cite: 'Dedans, il y a une couverture toute douce et un sac de carottes !' },

  /* ---------- Petit trot ---------- */
  'pomme': { type: 'explicite', q: 'Pourquoi {N} remue-t-{ilM} la queue ?',
    choices: ['Parce qu’{ilM} a froid', 'Parce qu’{ilM} a peur', 'Parce qu’{ilM} est {contentM}', 'Parce qu’{ilM} veut dormir'], answer: 2,
    cite: '{N} remue la queue car {ilM} est {contentM}.' },
  'foret': { type: 'inference', q: 'Pourquoi {P} félicite-t-{el} {sonM} ?',
    choices: ['Parce qu’{ilM} reste calme quand le lapin traverse', 'Parce qu’{ilM} court très vite', 'Parce qu’{ilM} attrape le lapin', 'Parce qu’{ilM} trouve un chemin plein de fleurs'], answer: 0,
    cite: '{N} reste très calme et {P} félicite {sonM} avec une caresse.' },
  'cirque': { type: 'explicite', q: 'Qu’offre le clown à {N} ?',
    choices: ['Un ballon rouge', 'Un ballon jaune', 'Un chapeau jaune', 'Une fleur rouge'], answer: 1,
    cite: 'Un clown rigolo lui offre un ballon jaune.' },
  'plage': { type: 'vocabulaire', q: 'Le vent salé les « décoiffe ». Cela veut dire que le vent :',
    choices: ['les fait tomber', 'met leurs cheveux en désordre', 'les mouille', 'les réchauffe'], answer: 1,
    cite: 'le vent salé les décoiffe {tousD} les deux' },
  'feuilles': { type: 'explicite', q: 'À quelle saison se passe cette histoire ?',
    choices: ['Au printemps', 'En été', 'En automne', 'En hiver'], answer: 2,
    cite: 'Cet automne' },

  /* ---------- Grand galop ---------- */
  'concours': { type: 'explicite', q: 'Comment se sent {P} au début du concours ?',
    choices: ['{El} a un peu peur', '{El} s’ennuie', '{El} a très faim', '{El} se met en colère'], answer: 0,
    cite: '{P} respire un grand coup, {el} a un peu peur.' },
  'tresor': { type: 'explicite', q: 'Où le trésor est-il caché ?',
    choices: ['Au fond de la grange', 'Près du grand chêne', 'Sous le pont de bois', 'Au bord de la rivière'], answer: 1,
    cite: 'Elle montre un trésor caché près du grand chêne.' },
  'pluie': { type: 'inference', q: 'Qu’est-ce que l’« arc de couleurs géant » qui traverse le ciel ?',
    choices: ['Un arc-en-ciel', 'Un avion', 'Une étoile filante', 'Un cerf-volant'], answer: 0,
    cite: 'un arc de couleurs géant traverse le ciel' },
  'neige': { type: 'vocabulaire', q: 'Dans le texte, que désigne « la poudre blanche » ?',
    choices: ['La farine', 'Le sucre', 'Les nuages', 'La neige'], answer: 3,
    cite: 'des traces rigolotes dans la poudre blanche' },
  'montagne': { type: 'inference', q: 'Pourquoi les maisons du village ressemblent-elles à des jouets minuscules ?',
    choices: ['Parce que ce sont de vrais jouets', 'Parce que le village est tout neuf', 'Parce qu’il fait nuit', 'Parce qu’elles sont très loin, tout en bas'], answer: 3,
    cite: 'Tout en haut, la vue est magnifique : les maisons du village ressemblent à des jouets minuscules.' },

  /* ---------- Champion ---------- */
  'fee': { type: 'inference', q: 'Que montre la plume dorée trouvée au matin sur la paille ?',
    choices: ['Que la nuit magique a vraiment eu lieu', 'Qu’un oiseau a dormi dans l’écurie', 'Qu’il faut changer la paille', 'Qu’il a neigé pendant la nuit'], answer: 0,
    cite: 'des ailes dorées poussent sur son dos' },
  'poulain': { type: 'explicite', q: 'Quel nom {P} choisit-{el} pour le poulain ?',
    choices: ['Pistache', 'Flocon', 'Noisette', 'Praline'], answer: 2,
    cite: '{P} lui choisit un joli nom : Noisette.' },
  'dragon': { type: 'explicite', q: 'Pourquoi Pistache est-il triste au début de l’histoire ?',
    choices: ['Parce qu’il a perdu sa flamme', 'Parce que tout le monde a peur de lui', 'Parce qu’il a froid', 'Parce qu’il n’a pas de pomme'], answer: 1,
    cite: 'Il est triste car tout le monde a peur de lui.' },
  'etoiles': { type: 'explicite', q: 'Que fait {P} quand l’étoile filante traverse la nuit ?',
    choices: ['{El} applaudit très fort', '{El} court chercher l’étoile', '{El} rentre se coucher', '{El} ferme les yeux et fait un vœu'], answer: 3,
    cite: '{P} ferme les yeux et fait un vœu secret.' },
  'reve': { type: 'inference', q: 'Pourquoi {N} observe-t-{ilM} longtemps le ciel au réveil ?',
    choices: ['Pour savoir s’il va pleuvoir', 'Pour retrouver la comète pressée', 'Pour garder un peu de son beau rêve', 'Pour compter les nuages'], answer: 2,
    cite: 'comme pour garder un morceau de son rêve' },

  /* ---------- Cavalier émérite ---------- */
  'cm1-orage': { type: 'inference', q: 'Pourquoi {P} parle-t-{el} calmement à {N} ?',
    choices: ['Pour ne pas réveiller les poules', 'Pour lui apprendre une chanson', 'Pour calmer {N}, qui a peur de l’orage', 'Parce que la pluie s’arrête'], answer: 2,
    cite: '{LeM} tremble un peu, alors {P} pose une main douce sur son cou et lui parle calmement.' },
  'cm1-course': { type: 'explicite', q: 'Par où passe le chemin de la course, dans l’ordre ?',
    choices: ['Le bois, les champs, puis la rivière', 'La rivière, le bois, puis les champs', 'Les champs, la rivière, puis le bois', 'Les champs, le bois, puis la rivière'], answer: 3,
    cite: 'Le chemin monte entre les champs dorés, plonge dans un petit bois, puis longe la rivière qui scintille.' },
  'cm1-chouette': { type: 'inference', q: 'Comment {P} comprend-{el} que la chouette montre le chemin ?',
    choices: ['Elle hulule de plus en plus fort', 'Elle porte une petite lumière', 'Elle vole un peu plus loin, puis attend, à chaque pas', 'Elle tourne en rond au-dessus des arbres'], answer: 2,
    cite: 'Chaque fois que {leM} avance, la chouette vole un peu plus loin et attend.' },
  'cm1-riviere': { type: 'inference', q: 'Pourquoi {P} choisit-{el} cet endroit pour traverser ?',
    choices: ['Parce que le pont y est encore solide', 'Parce que le courant y est très fort', 'Parce que le village est juste en face', 'Parce que la rivière y est large et peu profonde'], answer: 3,
    cite: 'un endroit où la rivière devient large et peu profonde' },
  'cm1-phare': { type: 'vocabulaire', q: 'Un escalier « en colimaçon », c’est un escalier :',
    choices: ['très étroit et sombre', 'qui tourne en spirale', 'fait de corde', 'qui monte tout droit'], answer: 1,
    cite: 'le grand escalier en colimaçon' },
  'cm1-aurore': { type: 'inference', q: 'Que veut dire {P} quand {el} murmure que certaines merveilles se méritent avec de la patience ?',
    choices: ['Qu’il faut vite rentrer se coucher', 'Que le chocolat est trop chaud', 'Que les couleurs vont bientôt disparaître', 'Qu’il faut savoir attendre pour voir de belles choses'], answer: 3,
    cite: '{P} murmure que certaines merveilles se méritent avec de la patience.' },

  /* ---------- Légende du ranch (CM2) ---------- */
  'cm2-abeilles': { type: 'vocabulaire', q: 'Dans l’histoire, qu’est-ce que la « grappe vivante et dorée » ?',
    choices: ['Des raisins bien mûrs', 'Des milliers d’abeilles serrées les unes contre les autres', 'Des fleurs de tilleul', 'Un panier rempli de miel'], answer: 1,
    cite: 'une énorme grappe vivante et dorée : des milliers de petites abeilles serrées les unes contre les autres' },
  'cm2-moulin': { type: 'inference', q: 'Pourquoi {P} choisit-{el} de creuser une rigole plutôt que de détruire le barrage ?',
    choices: ['Parce que c’est plus rapide', 'Parce que le meunier le lui demande', 'Pour attraper les castors', 'Pour ne pas abîmer la maison des castors'], answer: 3,
    cite: 'Détruire leur maison ? Jamais !' },
  'cm2-pie': { type: 'inference', q: 'Pourquoi la pie emporte-t-elle tous ces objets ?',
    choices: ['Parce qu’elle veut jouer avec {N}', 'Parce qu’ils brillent', 'Parce qu’ils sont faciles à manger', 'Parce que la fermière les lui donne'], answer: 1,
    cite: 'tous les objets disparus brillent au soleil' },
  'cm2-phoque': { type: 'inference', q: 'Pourquoi le promeneur rappelle-t-il son chien ?',
    choices: ['Parce que la mer remonte', 'Parce que son chien a faim', 'Pour que son chien ne dérange pas le bébé phoque', 'Pour aller chercher le gardien'], answer: 2,
    cite: '{P} explique la situation, et le promeneur rappelle son chien.' },
  'cm2-chevreau': { type: 'inference', q: 'Comment {N} retrouve-t-{ilM} Flocon ?',
    choices: ['{IlM} entend un faible bêlement', '{IlM} suit le tintement des clochettes', '{IlM} suit ses traces près du torrent', '{IlM} voit Flocon courir sur le sentier'], answer: 0,
    cite: '{N} se fige et écoute : un faible bêlement monte derrière un buisson épineux.' },
  'cm2-brouillard': { type: 'vocabulaire', q: 'Dans l’histoire, que veut dire « la lisière de la forêt » ?',
    choices: ['Le cœur de la forêt', 'Le bord de la forêt', 'Un sentier de la forêt', 'La plus haute colline'], answer: 1,
    cite: 'retrouvent enfin la lisière de la forêt. Là, le brouillard se déchire' },
  'cm2-citrouille': { type: 'inference', q: 'Pourquoi le jury décerne-t-il un prix spécial ?',
    choices: ['Pour récompenser le courage et l’entraide pendant la sécheresse', 'Parce que cette citrouille est la plus grosse de la foire', 'Parce que la vieille Rose fait partie du jury', 'Parce que la soupe est délicieuse'], answer: 0,
    cite: 'quand le jury apprend comment cette citrouille a survécu à la sécheresse, et comment Rose a sauvé ses tomates grâce à {P} et à {N}' },
  'cm2-grotte': { type: 'inference', q: 'Pourquoi {P} trace-t-{el} une flèche à la craie à chaque carrefour ?',
    choices: ['Pour décorer la grotte', 'Pour compter les cristaux', 'Pour pouvoir retrouver le chemin de la sortie', 'Pour faire un jeu avec Gaspard'], answer: 2,
    cite: '{P} trace une flèche à la craie sur la roche, par prudence.' },
  'cm2-neige': { type: 'inference', q: 'Pourquoi la cheminée qui ne fume pas inquiète-t-elle {P} ?',
    choices: ['Parce que Jeanne est partie en voyage', 'Parce que la cheminée est trop vieille', 'Parce que la neige va bientôt fondre', 'Parce que la maison de Jeanne n’est sans doute plus chauffée'], answer: 3,
    cite: 'la cheminée de Jeanne ne fume pas' },
  'cm2-lanternes': { type: 'vocabulaire', q: 'Dans l’histoire, « refuser de baisser les bras », c’est :',
    choices: ['ne pas vouloir abandonner', 'avoir mal aux bras', 'refuser de lever la main', 'vouloir se reposer'], answer: 0,
    cite: '{P} refuse de baisser les bras.' }
};

/* typographie française appliquée à l'affichage (q et choix) ; cite reste identique au texte */
export const QUESTIONS = Object.fromEntries(Object.entries(RAW).map(([id, x]) => [id, {
  type: x.type,
  q: frTypo(x.q),
  choices: x.choices.map(frTypo),
  answer: x.answer,
  cite: x.cite
}]));
