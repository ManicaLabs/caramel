/* ============ COMPAGNON : SVG GÉNÉRÉ (port v11) ============
   mountSVG(type, worn, size, moodClass) → chaîne SVG : copie VERBATIM de la v11.3 (index.html @ c5bd8d1),
   seules différences : « export », l'appel à ensureMountCSS() en première ligne, et MOUNTS / SHOP importés
   de js/content/companion-data.js (données v11 à l'identique).
     type      : clé de MOUNTS (pony horse cat capy dolphin lion unicorn dragon ; inconnue → poney)
     worn      : ids d'accessoires portés (SHOP), un par emplacement (wings back tail neck head face)
     size      : largeur en px (hauteur = 0,84 × largeur, viewBox 0 0 100 84)
     moodClass : classes ajoutées à la racine .m-root : '' | 'sad' | 'joy' | 'walk' | 'dance' (+ autres)
   Rig v11 : groupes .m-body (respiration), .m-tail (queue), .m-lid (paupières), .m-ear, .m-legF / .m-legB
   (pattes ou nageoires) ; animations dans css/ui/mount.css (chargé une seule fois, au premier dessin).
   Module importable dans Node (aucun accès au DOM au chargement ; mountSVG renvoie une simple chaîne). */

import { MOUNTS, SHOP } from '../content/companion-data.js';
import { loadCSS } from '../core/util.js';

let cssPromise = null;
/* charge css/ui/mount.css une seule fois (résolu depuis l'emplacement de ce module : marche aussi sous un
   sous-chemin GitHub Pages et dans les bancs d'essai) ; déjà présent dans la page → rien à faire.
   → Promise<boolean> (true quand la feuille est appliquée) */
export function ensureMountCSS(){
  if(cssPromise) return cssPromise;
  const d = globalThis.document;
  if(!d) return Promise.resolve(false);
  try{
    if(d.querySelector('link[href$="css/ui/mount.css"]')) return (cssPromise = Promise.resolve(true));
    cssPromise = loadCSS(new URL('../../css/ui/mount.css', import.meta.url).href);
  }catch(_){ cssPromise = Promise.resolve(false); }
  return cssPromise;
}

export function mountSVG(type, worn, size, moodClass){
  ensureMountCSS();
  const M = MOUNTS[type] || MOUNTS.pony;
  const K = M.kind || 'horse';
  const w = worn || [];
  const eq = slot => { const it = SHOP.find(o => o.slot===slot && w.includes(o.id)); return it ? it.e : ''; };
  const T = (em,a)=> em ? '<text x="'+a[0]+'" y="'+a[1]+'" font-size="'+a[2]+'" text-anchor="middle">'+em+'</text>' : '';
  const eye = (x,y)=> '<circle cx="'+x+'" cy="'+y+'" r="1.9" fill="#3f2d20"/>' +
    '<rect class="m-lid" x="'+(x-2.6)+'" y="'+(y-2.5)+'" width="5.2" height="4.4" rx="2.2" fill="'+M.body+'"/>';
  let p = '';
  const A = { wings:[42,28,16], back:[49,36,13], tail:[14,54,11], neck:[71,42,12], head:[80,10,13], face:[86,27,10] };

  if(K === 'dolphin'){
    /* nageoire caudale (pivot inline : attache a droite du groupe) */
    p += '<g class="m-tail" style="transform-origin:95% 50%"><path d="M26,44 Q13,34 6,29 L15,44 L6,59 Q13,54 26,49 Z" fill="'+M.body+'"/></g>';
    /* nageoires : classes m-legB/m-legF => elles ondulent avec l anim de marche (= nage) */
    p += '<g class="m-legB"><path d="M44,50 Q40,62 32,65 Q40,54 40,47 Z" fill="'+M.mane+'" opacity=".85"/></g>';
    p += '<g class="m-body"><ellipse cx="52" cy="44" rx="28" ry="13" fill="'+M.body+'"/>' +
         '<ellipse cx="55" cy="50" rx="18" ry="6" fill="'+M.belly+'"/>' +
         '<path d="M46,32 Q51,15 61,23 Q53,25 51,33 Z" fill="'+M.body+'"/></g>';
    p += '<g class="m-legF"><path d="M60,50 Q56,64 46,68 Q54,56 54,47 Z" fill="'+M.body+'"/></g>';
    p += '<ellipse cx="80" cy="40" rx="12" ry="9" fill="'+M.body+'"/>' +
         '<ellipse cx="92" cy="44" rx="6.5" ry="3" fill="'+M.belly+'"/>' +
         '<path d="M87,46 Q92,49 97,46" stroke="'+M.mane+'" stroke-width="1" fill="none" stroke-linecap="round"/>' +
         eye(84,38);
    A.wings=[46,24,16]; A.back=[52,34,13]; A.tail=[12,44,11]; A.neck=[71,50,12]; A.head=[81,26,13]; A.face=[88,39,10];
  } else {
    /* ---------- quadrupedes : squelette commun + variantes ---------- */
    /* queue : toujours un seul groupe .m-tail => pivot commun a toutes ses pieces */
    if(K === 'dragon'){
      p += '<g class="m-tail"><path d="M28,46 Q10,50 6,62 L14,58 Q13,52 28,52 Z" fill="'+M.body+'"/>' +
           '<polygon points="4,64 12,58 10,66" fill="'+M.mane+'"/></g>';
    } else if(K === 'cat'){
      p += '<g class="m-tail" style="transform-origin:95% 92%"><path d="M28,46 Q16,42 15,28 Q15,24 19,22" stroke="'+M.body+'" stroke-width="5" fill="none" stroke-linecap="round"/>' +
           '<circle cx="19" cy="22" r="3" fill="'+M.mane+'"/></g>';
      A.tail = [17,18,10];
    } else if(K === 'lion'){
      p += '<g class="m-tail"><path d="M28,46 Q12,50 10,61" stroke="'+M.body+'" stroke-width="4.5" fill="none" stroke-linecap="round"/>' +
           '<circle cx="10" cy="63" r="3.5" fill="'+M.mane+'"/></g>';
    } else if(K === 'capy'){
      /* pas de queue chez le capybara : groupe vide (les regles CSS .m-tail restent sans effet) */
      p += '<g class="m-tail"></g>';
      A.tail = [26,38,10];
    } else {
      p += '<g class="m-tail"><path d="M28,44 Q14,46 11,62" stroke="'+M.mane+'" stroke-width="6" fill="none" stroke-linecap="round"/></g>';
    }
    /* pattes arriere (capybara : pattes courtes) */
    const ly = K==='capy' ? 56 : 50, lh = K==='capy' ? 18 : 24;
    p += '<g class="m-legB"><rect x="34" y="'+ly+'" width="5.5" height="'+lh+'" rx="2.5" fill="'+M.body+'"/>' +
         '<rect x="43" y="'+ly+'" width="5.5" height="'+lh+'" rx="2.5" fill="'+M.mane+'" opacity=".85"/></g>';
    if(K === 'dragon') p += '<path d="M48,36 Q36,14 22,18 Q34,28 42,40 Z" fill="'+M.belly+'" stroke="'+M.mane+'" stroke-width="1.5"/>';
    /* corps + ventre (respiration) */
    p += '<g class="m-body"><ellipse cx="50" cy="46" rx="'+(K==='capy'?26:24)+'" ry="'+(K==='capy'?15:14)+'" fill="'+M.body+'"/>' +
         '<ellipse cx="50" cy="52" rx="15" ry="6.5" fill="'+M.belly+'"/>';
    if(K === 'cat') p += '<path d="M40,34 Q42,41 40,47" stroke="'+M.mane+'" stroke-width="2.5" fill="none" opacity=".5"/>' +
                         '<path d="M50,32 Q52,41 50,46" stroke="'+M.mane+'" stroke-width="2.5" fill="none" opacity=".5"/>';
    p += '</g>';
    if(K === 'dragon') p += '<path d="M32,34 L36,26 L40,34 L44,25 L48,34 L52,26 L56,34 Z" fill="'+M.mane+'"/>';
    /* pattes avant */
    p += '<g class="m-legF"><rect x="58" y="'+ly+'" width="5.5" height="'+lh+'" rx="2.5" fill="'+M.body+'"/>' +
         '<rect x="67" y="'+ly+'" width="5.5" height="'+lh+'" rx="2.5" fill="'+M.mane+'" opacity=".85"/></g>';
    if(K === 'capy'){
      /* signature capybara : tete en brique, museau carre legerement tombant,
         oeil et oreille hauts et en arriere, pas de cou */
      p += '<ellipse cx="70" cy="32" rx="9" ry="9" fill="'+M.body+'"/>' +
           '<path d="M70,18 Q70,13 77,12 L87,13 Q94,14 94,22 L93,30 Q92,34 85,34 L76,33 Q70,32 70,26 Z" fill="'+M.body+'"/>' +
           '<path d="M87,14 Q94,15 94,22 L93,30 Q92,34 86,34 L85,14 Z" fill="'+M.belly+'" opacity=".55"/>' +
           '<ellipse cx="91" cy="17.5" rx="1.3" ry="1" fill="#5b3a29"/>' +
           '<ellipse class="m-ear" cx="74" cy="11.5" rx="2.6" ry="2.1" fill="'+M.mane+'"/>' +
           eye(79,20);
      A.wings=[42,26,16]; A.back=[49,34,13]; A.neck=[66,40,12]; A.head=[80,7,13]; A.face=[87,21,10];
    } else {
      p += '<path d="M62,44 L74,20 L84,26 L74,50 Z" fill="'+M.body+'"/>';
      if(K === 'lion') p += '<circle cx="81" cy="23" r="14" fill="'+M.mane+'"/>';
      if(K === 'horse') p += '<path d="M73,13 Q68,26 64,40 Q71,37 76,26 Q79,18 80,14 Z" fill="'+M.mane+'"/>';
      p += '<ellipse cx="82" cy="23" rx="10" ry="8" fill="'+M.body+'"/>' +
           '<ellipse cx="90" cy="26" rx="5" ry="4" fill="'+M.belly+'"/>' +
           '<circle cx="91.5" cy="26" r=".9" fill="#5b3a29"/>';
      if(K === 'cat'){
        p += '<polygon class="m-ear" points="73,7 78,18 69,16" fill="'+M.body+'"/>' +
             '<polygon class="m-ear" points="87,9 90,18 81,15" fill="'+M.body+'"/>' +
             '<path d="M87,25 L97,22 M87,27 L98,27" stroke="'+M.mane+'" stroke-width=".8" fill="none"/>';
      } else if(K === 'lion'){
        p += '<circle class="m-ear" cx="75" cy="12" r="3.5" fill="'+M.body+'"/>';
      } else {
        p += '<polygon class="m-ear" points="76,9 80,18 71,17" fill="'+M.body+'"/>';
      }
      if(M.horn) p += '<polygon points="82,2 85,13 79,13" fill="#fbbf24"/>';
      if(K === 'dragon') p += '<polygon points="84,10 88,15 82,16" fill="'+M.mane+'"/>';
      p += eye(82,21.5);
    }
  }
  /* equipements portes */
  p += T(eq('wings'),A.wings) + T(eq('back'),A.back) + T(eq('tail'),A.tail) +
       T(eq('neck'),A.neck) + T(eq('head'),A.head) + T(eq('face'),A.face);
  return '<svg class="m-root ' + (moodClass||'') + '" width="' + size + '" height="' + Math.round(size*0.84) +
    '" viewBox="0 0 100 84" xmlns="http://www.w3.org/2000/svg">' + p + '</svg>';
}
