/* ============ LA COURSE : MOTEUR DE LECTURE (port v11, module pur) ============
   Logique de « La course de Caramel » v11.3 (index.html @ c5bd8d1), séparée de l'interface pour être
   testée sous Node (tests/course-engine.test.mjs la compare au code v11 lui-même).
   Aucun accès à window/document/navigator : l'heure est passée en paramètre, et les réactions de
   l'interface (sons, sauts, chutes, défilement) sont rendues sous forme d'« effets » que le jeu exécute
   dans le même ordre que la v11.

   VERBATIM v11 (copié caractère pour caractère, seul « export » est ajouté) :
     FORGIVE, normalize, tokenize, computeProper, median, isMatch, levenshtein.
   PORTÉ À L'IDENTIQUE (même code, mêmes conditions, même ordre ; DOM et sons → effets, Date.now() → now) :
     processTranscript (alignement tolérant, joker [unk], indulgence des mots-outils, horodatage,
     évaluation des pauses → obstacles), règle de placement des obstacles (openStory), grammaire Vosk
     (startVoskEngine), ligne 👂 (ingest), avancée de Zip (minuteur de micTap), calculs de finishExercise.
   AJOUTS v2 : les mots OOV (absents du lexique Vosk) du texte rejoignent les noms propres (validables
     par [unk]) ; Zip adaptatif ; repérage du passage d'une question (citeRange). */

/* mots-outils courts que la reco avale souvent : on les pardonne quand la suite est bonne */
export const FORGIVE = new Set(['le','la','les','un','une','des','de','du','au','aux','et','en','y','a',
                         'ce','se','sa','son','ses','ne','que','qui','il','ils','elle','ou']);

/* ---------- VERBATIM v11 ---------- */
export function normalize(w){
  return w.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
}
/* tokens : mot + drapeau "pause" si ponctuation (y compris ponctuation détachée « ! » « : ») */
export function tokenize(text){
  const parts = text.split(/\s+/).filter(Boolean);
  const out = [];
  for(const raw of parts){
    const norm = normalize(raw);
    if(!norm){
      if(out.length){ out[out.length-1].raw += ' ' + raw; out[out.length-1].pause = true; }
      continue;
    }
    out.push({ raw, norm, pause: /[,;:.!?…»]$/.test(raw) });
  }
  if(out.length) out[out.length-1].pause = false; /* dernier mot : rien à juger derrière */
  return out;
}
/* noms propres du texte (Léa...) : jamais vus en minuscule, majuscule en milieu de phrase ou répétés */
export function computeProper(tokens){
  const capCount = {}, lowSeen = new Set(), midCap = new Set();
  tokens.forEach((w, idx)=>{
    const m = w.raw.match(/^[A-Za-zÀ-ÖØ-öø-ÿŒœ]+/);
    if(!m) return;
    if(/^[a-zà-öø-ÿœ]/.test(m[0])) lowSeen.add(w.norm);
    else {
      capCount[w.norm] = (capCount[w.norm]||0) + 1;
      const sentStart = idx===0 || /[.!?…]\s*$/.test(tokens[idx-1].raw);
      if(!sentStart) midCap.add(w.norm);
    }
  });
  const set = new Set();
  for(const nrm of Object.keys(capCount)){
    if(lowSeen.has(nrm)) continue;
    if(midCap.has(nrm) || capCount[nrm]>=2) set.add(nrm);
  }
  return set;
}
export function median(arr){
  if(!arr.length) return 0;
  const s = [...arr].sort((a,b)=>a-b);
  return s[Math.floor(s.length/2)];
}
export function isMatch(a,b){
  if(a===b) return true;
  const L = Math.min(a.length,b.length);
  if(L>=3 && levenshtein(a,b)<=1) return true;
  if(L>=7 && levenshtein(a,b)<=2) return true;
  return false;
}
export function levenshtein(a,b){
  const m=a.length, n=b.length;
  const d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);
  for(let j=1;j<=n;j++) d[0][j]=j;
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    d[i][j]=Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return d[m][n];
}

/* ---------- préparation d'une course (openStory v11) ---------- */
/* forme de la grammaire Vosk d'un mot (startVoskEngine v11) : minuscules, accents gardés */
const grammarForm = raw => raw.toLowerCase().replace(/[^\p{L}0-9]/gu, '');

/* grammaire : la reco ne connaît que les mots de cette histoire → précision maximale (le moteur ajoute [unk]) */
export function grammarOf(tokens){
  return [...new Set(tokens.map(w => grammarForm(w.raw)))].filter(Boolean);
}

/* obstacles liés aux pauses de ponctuation (openStory v11) : un par mot-pause, sauf le dernier mot ;
   textes longs (> 10 mots-pause) : obstacles uniquement en fin de phrase (l'évaluation statistique des
   pauses reste faite sur TOUTES les ponctuations). → indices k des mots suivis d'un obstacle */
export function hurdleSlots(tokens){
  const n = tokens.length;
  const pauseCount = tokens.filter((w,k)=>w.pause && k<n-1).length;
  const onlySentenceEnds = pauseCount > 10;
  const out = [];
  tokens.forEach((w, k)=>{
    if(!w.pause || k >= n-1) return;
    if(onlySentenceEnds && !/[.!?…»]$/.test(w.raw)) return;
    out.push(k);
  });
  return out;
}
/* positions sur la piste (% de la largeur), comme la v11 */
export const hurdleLeft = (k, n) => 100*(k+1)/n * 0.85;
export const actorLeft = pct => Math.min(pct,100) * 0.85;

/* nouvel état de course (Object.assign de openStory v11).
   mountNoun : nom commun de la monture (« licorne », « capybara »… peuvent manquer au lexique Vosk :
   le joker [unk] peut alors le valider, comme un prénom — règle v11.2).
   oov : Set des mots hors lexique (forme grammaire) — amélioration v2 : ceux du texte rejoignent
   les noms propres. */
export function createRace(text, { mountNoun = '', oov = null } = {}){
  const state = { target: tokenize(String(text ?? '')), progress:0, startTime:null, running:false,
    finalTranscript:'', streak:0, flyDone:false, childFinished:false, gotAnyResult:false,
    wordTime:[], gaps:[], pauseResults:[], hurdles: new Set() };
  state.status = new Array(state.target.length).fill('pending');
  state.wordTime = new Array(state.target.length).fill(null);
  state.pauseResults = new Array(state.target.length).fill(null);
  state.proper = computeProper(state.target);
  if(mountNoun) state.proper.add(normalize(String(mountNoun)));
  if(oov && typeof oov.has === 'function'){
    for(const t of state.target) if(oov.has(grammarForm(t.raw))) state.proper.add(t.norm);
  }
  for(const k of hurdleSlots(state.target)) state.hurdles.add(k);
  return state;
}

/* ---------- ce qu'on a entendu (ingest v11) ---------- */
/* 5 derniers mots entendus ; [unk] (mot hors grammaire, souvent un prénom) s'affiche « … » */
export function heardTail(allText){
  const tail = String(allText ?? '').trim().split(/\s+/).slice(-5).join(' ');
  return tail ? tail.replace(/\[unk\]/g, '…') : '';
}

/* ---------- alignement (processTranscript v11) ----------
   Alignement tolérant : fenêtre de 4 mots + Levenshtein, indulgence sur les mots-outils.
   Code v11 inchangé ; chaque action d'interface devient un effet poussé dans fx, dans le même ordre :
     { t:'streak', n }                    → « 🔥 série : n » (+ étincelle ✨ si n ≥ 5)
     { t:'move', pct }                    → le compagnon avance (moveActor('pony', pct))
     { t:'pony', cls }                    → animation du compagnon : 'hop' | 'hop-big' | 'stumble'
     { t:'beep', f, d, g }                → audio.beep(f, d, g)
     { t:'scroll' }                       → défilement vers le mot courant
     { t:'hurdle', k, cls }               → obstacle k : 'jumped' (devient ✨) | 'crushed'
     { t:'vibrate', ms }                  → vibration
     { t:'render' }                       → couleurs des mots
     { t:'finish' }                       → arrivée : fin de course 500 ms plus tard
   now = horloge en ms (Date.now() en v11). → fx */
export function processTranscript(state, spoken, now = Date.now(), fx = []){
  const spokenWords = spoken.split(/\s+/).map(normalize).filter(Boolean);
  const n = state.target.length;
  const status = new Array(n).fill('pending');
  let ti = 0;
  for(const sw of spokenWords){
    if(ti >= n) break;
    let found = -1;
    if(sw === 'unk'){
      /* [unk] = mot hors vocabulaire de la grammaire (souvent un prénom comme Léa) :
         il ne peut valider qu'un nom propre attendu dans la fenêtre */
      for(let k=ti; k<Math.min(ti+4,n); k++){
        if(state.proper && state.proper.has(state.target[k].norm)){ found=k; break; }
      }
      if(found < 0) continue;
    } else {
      for(let k=ti; k<Math.min(ti+4,n); k++){
        if(isMatch(sw, state.target[k].norm)){ found=k; break; }
      }
    }
    if(found >= 0){
      /* mots sautés : les petits mots-outils sont pardonnés (la reco les avale souvent) */
      for(let k=ti; k<found; k++)
        status[k] = FORGIVE.has(state.target[k].norm) ? 'read' : 'missed';
      status[found]='read';
      ti = found+1;
    }
  }
  const prevProgress = state.progress;
  const prevMissed = state.status.filter(s=>s==='missed').length;
  state.status = status; state.progress = ti;
  if(!state.startTime && ti>0) state.startTime = now;

  /* --- horodatage des mots validés --- */
  for(let k=prevProgress; k<ti; k++) state.wordTime[k] = now;
  for(let k=Math.max(1,prevProgress); k<ti; k++){
    const g = state.wordTime[k] - (state.wordTime[k-1] || state.wordTime[k]);
    if(g>120 && g<4000 && !state.target[k-1].pause) state.gaps.push(g);
  }
  if(state.gaps.length>40) state.gaps.splice(0, state.gaps.length-40);

  let streak = 0;
  for(let k=ti-1; k>=0 && status[k]==='read'; k--) streak++;
  state.streak = streak;
  fx.push({ t:'streak', n: streak });

  if(ti > prevProgress){
    fx.push({ t:'move', pct: 100*ti/n });
    fx.push({ t:'pony', cls:'hop' });
    fx.push({ t:'beep', f: 440 + Math.min(streak,10)*40, d: 0.05, g: 0.08 });
    fx.push({ t:'scroll' });
  }

  /* --- évaluation des pauses → saut d'obstacle ou chute --- */
  for(let k=0; k<ti-1; k++){
    if(!state.target[k].pause || state.pauseResults[k]!==null) continue;
    if(state.wordTime[k]==null || state.wordTime[k+1]==null) continue;
    if(state.status[k]!=='read'){
      state.pauseResults[k]='skip';
      if(state.hurdles.has(k)) fx.push({ t:'hurdle', k, cls:'crushed' });
      continue;
    }
    const gap = state.wordTime[k+1] - state.wordTime[k];
    const base = median(state.gaps);
    const need = Math.min(Math.max(base ? base+280 : 800, 550), 2000);
    const ok = gap >= need;
    state.pauseResults[k] = ok ? 'ok' : 'fast';
    /* v11 : sur les textes longs, seuls les fins de phrase ont un obstacle ;
       les anims saut/chute ne jouent que si un obstacle existe (l'évaluation, elle, reste faite) */
    if(state.hurdles.has(k)){
      if(ok){
        fx.push({ t:'hurdle', k, cls:'jumped' });
        fx.push({ t:'pony', cls:'hop-big' });
        fx.push({ t:'beep', f:880, d:0.16, g:0.13 });
        fx.push({ t:'vibrate', ms:40 });
      } else {
        fx.push({ t:'hurdle', k, cls:'crushed' });
        fx.push({ t:'pony', cls:'stumble' });
        fx.push({ t:'beep', f:180, d:0.14, g:0.07 });
      }
    }
  }

  const nowMissed = status.filter(s=>s==='missed').length;
  if(nowMissed > prevMissed){
    fx.push({ t:'pony', cls:'stumble' });
    fx.push({ t:'beep', f:180, d:0.12, g:0.06 });
  }
  fx.push({ t:'render' });
  if(ti >= n && !state.childFinished){
    state.childFinished = true;
    fx.push({ t:'finish' });
  }
  return fx;
}

/* ---------- Zip le papillon (minuteur de 250 ms de micTap v11) ----------
   zip = vitesse de Zip en mots/min (v11 : cible de l'histoire ; v2 : Zip adaptatif).
   → null tant que le premier mot n'est pas lu, sinon { secs, flyPct } ; pose state.flyDone. */
export function zipTick(state, now, zip){
  if(!state.startTime) return null;
  const elapsed = (now - state.startTime) / 1000;
  const flyWords = (elapsed/60) * zip;
  const flyPct = 100 * flyWords / state.target.length;
  if(flyPct >= 100 && !state.flyDone) state.flyDone = true;
  return { secs: Math.round(elapsed), flyPct };
}

/* ---------- fin et étoiles (finishExercise v11) ---------- */
export function raceResult(state, now){
  const elapsedMs = state.startTime ? (now-state.startTime) : 0;
  const minutes = Math.max(elapsedMs/60000, 0.05);
  const correct = state.status.filter(s=>s==='read').length;
  const mclm = Math.round(correct/minutes);
  const precision = Math.round(100*correct/state.target.length);
  const beatFly = state.childFinished && !state.flyDone;
  const stars = (precision>=90 && beatFly) ? 3 : (precision>=75) ? 2 : 1;
  const evald = state.pauseResults.filter(r=>r==='ok'||r==='fast').length;
  const okp = state.pauseResults.filter(r=>r==='ok').length;
  let pausesMsg = '';
  if(evald >= 3 && okp/evald >= 0.8) pausesMsg = 'expressive';
  else if(evald >= 2 && okp/evald < 0.4) pausesMsg = 'astuce';
  const notRead = state.target.filter((_,i)=>state.status[i]!=='read');
  return {
    elapsedMs, correct, mclm, precision, beatFly, stars, evald, okp, pausesMsg,
    missed: notRead.map(w=>w.raw),                                  /* « Mots à apprivoiser » (v11 : 6 premiers) */
    missedNorm: notRead.map(w=>w.norm),                             /* rapport à la manche (Leitner) */
    readNorm: state.target.filter((_,i)=>state.status[i]==='read').map(w=>w.norm)
  };
}

/* ---------- Zip adaptatif (v2, contrat §7.4) ----------
   MCLM déjà observés → médiane des 5 derniers × 1,05, bornée entre 20 et la cible de fin d'année de la
   classe ; aucun → min(cible de l'histoire, cible de la classe). → mots/min (entier) */
export function adaptiveZip(mclmLog, storyTarget, classTarget){
  const cap = Number.isFinite(+classTarget) && +classTarget > 0 ? +classTarget : 120;
  const vals = (Array.isArray(mclmLog) ? mclmLog : [])
    .map(e => (e && typeof e === 'object' ? Number(e.v) : Number(e)))
    .filter(v => Number.isFinite(v) && v > 0);
  if(vals.length) return Math.round(Math.min(cap, Math.max(20, median(vals.slice(-5)) * 1.05)));
  const st = Number(storyTarget);
  return Math.round(Math.min(Number.isFinite(st) && st > 0 ? st : cap, cap));
}

/* ---------- passage d'une question (v2) ----------
   cite = extrait exact du texte (tous deux templatés pour le même profil) → [premier, dernier] indice
   des tokens de tokenize(text) qui le recouvrent, ou null. Rejoue le découpage de tokenize
   (morceaux sans lettre ni chiffre rattachés au mot précédent). */
export function citeRange(text, cite){
  const T = String(text ?? ''), C = String(cite ?? '').trim();
  if(!C) return null;
  const pos = T.indexOf(C);
  if(pos < 0) return null;
  const end = pos + C.length;
  const re = /\S+/g;
  let m, idx = -1, first = -1, last = -1;
  while((m = re.exec(T))){
    if(normalize(m[0])) idx++;
    else if(idx < 0) continue;
    const a = m.index, b = a + m[0].length;
    if(b > pos && a < end){ if(first < 0) first = idx; last = idx; }
  }
  return first < 0 ? null : [first, last];
}
