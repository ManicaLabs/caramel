/* ============ LE CHEF D’ORCHESTRE : RÉPONDRE À VOIX HAUTE (logique pure, aucun DOM) ============
   v2.3, demande du parent du 07/10/2026 : « il faudrait pouvoir utiliser le micro sur les autres jeux, pas seulement
   les tables ». Importable par Node (tests/orchestre-voice.test.mjs) ; utilisée par js/games/orchestre.js avec le module
   commun js/ui/voice-answer.js (le choix dit touche son bouton, comme un doigt) et le juge js/core/voice-choice.js.
   voiceChoices(item) → { list: [{ value, say: [formes dites], label }], why: '' }, ou { list: null, why } : micro en
   pause pour cette question. Formes dites de chaque choix, selon le sous-type de l'item (js/content/fr/conjug.js) :
   - forme, accord : la forme conjuguée (« mangeons », « ai mangé ») ; « j’ » collé comme Vosk l'écrit (« j’ai ») ;
   - terminaison : le mot entier que l'enfant dit, radical + terminaison (tuile « -ons » → « mangeons ») ;
   - temps : « présent », « le présent », « au présent »… « passé composé », « plus-que-parfait » ;
   - sujet : le pronom ou le groupe nominal (« vous », « ma cousine ») ;
   - participe : le participe passé.
   Chaque forme est entourée de la phrase (10 mots au plus de chaque côté du trou : « aujourd’hui nous mangeons une
   pomme » ; pour « temps », la phrase puis le temps) : ces mots entrent dans la grammaire de Vosk, qui sinon prendrait
   ceux que l'enfant lit avec sa réponse pour des choix (mesuré : « Aujourd’hui » entendu « oh je suis », le choix
   « suis » compté faux) ; communs à tous les choix, ils ne départagent rien (js/core/voice-choice.js) : le choix se
   reconnaît à ses seuls mots, dit avec ou sans la phrase. Chaque forme dite doit désigner son choix (vérifié ici même),
   sinon sans la suite de la phrase, puis sans phrase.
   Micro en pause plutôt qu'une erreur injuste (why) :
   - 'lexique' : un mot d'un choix est hors du lexique du modèle Vosk (VOICE_OOV, liste figée, exacte, vérifiée par
     tests/orchestre-voice.test.mjs) : Vosk ne peut pas l'entendre, l'enfant qui le dit serait compris de travers ;
   - 'oral' : la bonne réponse se dit (presque) comme un autre choix (tooClose) : homophones (« mange », « manges »,
     « mangent » ; « il », « ils » ; « allé », « allées »), é et è confondus (« chantait », « chanté », « chantez »),
     « i » glissé (« chantons », « chantions ») ; ou la phrase lue contient un choix à l'oral (« Il y a longtemps »
     et le choix « il », « et » et le choix « ai ») ; ou deux choix qu'aucune forme ne sépare (« le chien » dans « la
     chienne et le chien ») ;
   - 'type' : sous-type inconnu, réponse absente des choix, moins de deux choix. */

import { wordsOf, matchChoice } from '../core/voice-choice.js';

/* ---------- formes dites des temps (choix de « temps ») ---------- */
export const TENSE_SAY = Object.freeze({
  present: ['présent', 'le présent', 'au présent'],
  imparfait: ['imparfait', 'l’imparfait', 'à l’imparfait'],
  futur: ['futur', 'le futur', 'au futur'],
  passe_compose: ['passé composé', 'le passé composé', 'au passé composé'],
  passe_simple: ['passé simple', 'le passé simple', 'au passé simple'],
  plus_que_parfait: ['plus-que-parfait', 'le plus-que-parfait', 'au plus-que-parfait', 'plus que parfait', 'le plus que parfait']
});

/* ---------- clé sonore : à peu près ce qu'on entend (comparaison des choix d'une même question) ----------
   Lettres muettes finales retirées (-s, -t, -x, -d, -z, -e, -ent du pluriel des verbes), -er / -ez / -ai(s, t) → é,
   é / è / ê / ai confondus (é), e muet effacé, nasales (Ã, Õ, Ẽ), ch → S, g / ge doux → Z, c doux et ç → s,
   s entre voyelles → z, i / y devant voyelle → j, consonnes doubles simplifiées. */
const SMALL = { les: 'lé', des: 'dé', mes: 'mé', tes: 'té', ses: 'sé', ces: 'sé', es: 'é', est: 'é', et: 'é' };
const VOW = 'aeiouyàâäéèêëîïôöùûüœøUÃÕẼ';
const NOT_VN = '(?![' + VOW + 'nm])';
const RX = {
  ien: new RegExp('ien' + NOT_VN, 'g'),
  in: new RegExp('(ain|ein|aim|in|im|yn|ym|un|um)' + NOT_VN, 'g'),
  an: new RegExp('(an|am|en|em)' + NOT_VN, 'g'),
  on: new RegExp('(on|om)' + NOT_VN, 'g'),
  sz: new RegExp('(?<=[' + VOW + '])s(?=[' + VOW + '])', 'g'),
  glide: /[iy](?=[aeoUéøÃÕẼ])/g,
  eOpen: new RegExp('e(?=[^' + VOW + ']{2}|[^' + VOW + ']$)', 'g'),
  vowel: new RegExp('[' + VOW.replace('e', '') + ']')
};
export function wordKey(word) {
  let x = String(word ?? '').toLowerCase().normalize('NFC').replace(/[’`´]/g, "'");
  x = x.replace(/^(j|l|d|m|t|s|n|c|qu)'/, '$1').replace(/[-']/g, '');
  if (SMALL[x]) x = SMALL[x];
  /* fins muettes */
  if (/[vt]ient$/.test(x)) x = x.slice(0, -1);                       /* vient, tient : « -ien » */
  else if (x.length > 4 && /ent$/.test(x)) x = x.slice(0, -3) + 'e';  /* mangent, voient, disent : « -ent » muet */
  x = x.replace(/(ez|er)$/, 'é').replace(/ai[stx]*$/, 'é').replace(/et$/, 'é');
  x = x.replace(/[stdxzp]+$/, '').replace(/ge$/, 'Ze').replace(/ce$/, 'Çe');
  if (/[aeiouyéèêâîôû][nm]e$/.test(x)) x = x.replace(/([nm])e$/, '$1$1');   /* une, aime : pas de nasale */
  if (x.length > 2 && /e$/.test(x) && x !== 'que') x = x.slice(0, -1);
  /* graphies */
  x = x.replace(/eau/g, 'o').replace(/au/g, 'o').replace(/[œe]u/g, 'ø').replace(/ou/g, 'U');
  x = x.replace(/([aeoUéèêø])ill/g, '$1j').replace(/ill/g, 'ij');
  x = x.replace(/oy(?=[aeiouéè])/g, 'waj').replace(/oi/g, 'wa').replace(/ay(?=[aeiouéè])/g, 'éj');
  x = x.replace(RX.ien, 'jẼ').replace(RX.in, 'Ẽ').replace(RX.an, 'Ã').replace(RX.on, 'Õ');
  x = x.replace(/ai|ei|è|ê|ë/g, 'é');
  x = x.replace(/ch/g, 'S').replace(/ph/g, 'f').replace(/gn/g, 'N').replace(/qu/g, 'k').replace(/th/g, 't');
  x = x.replace(/gu(?=[eéiy])/g, 'g').replace(/ge(?=[aoUâôÃÕ])/g, 'Z').replace(/g(?=[eéiyè])/g, 'Z');
  x = x.replace(/c(?=[eéiyè])/g, 'Ç').replace(/ç/g, 'Ç').replace(/c/g, 'k');
  x = x.replace(/ss/g, 'Ç').replace(RX.sz, 'z').replace(/Ç/g, 's');
  x = x.replace(/x/g, 'ks').replace(/h/g, '');
  x = x.replace(/[âà]/g, 'a').replace(/[îï]/g, 'i').replace(/ô/g, 'o').replace(/[ûùü]/g, 'u');
  x = x.replace(RX.glide, 'j').replace(/y/g, 'i');
  /* e restant : è devant deux consonnes (elle, appelle), sinon e muet (effacé ; gardé dans « le », « je ») */
  x = x.replace(RX.eOpen, 'é');
  x = RX.vowel.test(x.replace(/e/g, '')) ? x.replace(/e/g, '') : x.replace(/e/g, 'ø');
  return x.replace(/([^aeiouéøUÃÕẼ])\1+/g, '$1');
}
export const soundKey = text => wordsOf(text).map(wordKey).join(' ');
/* deux choix trop proches à l'oral : même clé sonore, ou la même au « i » glissé près (chantons / chantions) */
export function tooClose(a, b) {
  const x = soundKey(a), y = soundKey(b);
  return x === y || x.replace(/j/g, '') === y.replace(/j/g, '');
}

/* ---------- bout de phrase autour du trou ---------- */
const CTX_MAX = 10;
/* mots lus avant le trou (toute la phrase : « Aujourd’hui » absent de la grammaire, Vosk entendait « oh je suis »), les
   10 derniers ; élision collée au trou (« j’ ») à part */
function wordsBefore(text) {
  let t = String(text ?? '');
  let elide = '';
  const m = t.match(/(\p{L}+)['’]$/u);
  if (m) { elide = m[1].toLowerCase() + "'"; t = t.slice(0, -m[0].length); }
  return { words: wordsOf(t).slice(-CTX_MAX).map(ctxWord), elide };
}
/* mots lus après le trou, les 10 premiers */
const wordsAfter = text => wordsOf(text).slice(0, CTX_MAX).map(ctxWord);
/* mot de la phrase pour la grammaire : sans son élision (« l’école » → « école », « qu’apporteront » → « apporteront ») */
export const ctxWord = w => String(w).replace(/^(j|l|d|m|t|s|n|c|qu)'/, '');
const uniq = a => [...new Set(a)];

const sayable = w => !VOICE_OOV.has(w);

/* la phrase hors du trou (toute : l'enfant la lit souvent en entier) contient-elle un choix à l'oral, ses mots dans
   l'ordre (« à » pour « a » ; « les fermiers » demande « les » puis « fermiers ») ? */
function phraseClash(item, bareWords) {
  const s = (item.data && item.data.sentence) || {};
  const heard = [...wordsOf(s.before), ...wordsOf(s.after)].map(wordKey);
  return bareWords.some(ws => {
    const need = ws.map(wordKey);
    let j = 0;
    for (const k of heard) if (j < need.length && k === need[j]) j++;
    return need.length > 0 && j === need.length;
  });
}
/* texte « nu » d'un choix (ce que l'enfant dit au minimum) */
function bareOf(item, c) {
  const k = item.kind;
  if (k === 'terminaison') return String((item.data && item.data.stem) || '') + String(c.value ?? '');
  if (k === 'temps') { const s = TENSE_SAY[c.value]; return s ? s[0] : ''; }
  return String(c.value ?? '');
}
const KINDS = new Set(['forme', 'accord', 'terminaison', 'temps', 'sujet', 'participe']);
/* morceaux d'un item, avant le lexique : mots nus des choix, bout de phrase avant / après, « j’ » collé */
function partsOf(item) {
  const list = item && Array.isArray(item.choices) ? item.choices : [];
  const bares = list.map(c => bareOf(item, c));
  const bareWords = bares.map(b => wordsOf(b));
  let pre = [], post = [], elide = '';
  const s = (item.data && item.data.sentence) || {};
  if (item.kind === 'temps') pre = wordsAfter(s.text);   /* la phrase lue, puis le temps dit */
  else {
    const b = wordsBefore(s.before);
    pre = b.words; elide = b.elide;
    post = wordsAfter(s.after);
  }
  /* « j’ » collé au mot dit, comme Vosk l'écrit (« j’ai », « j’étais ») quand son lexique le connaît (J_GLUE) ;
     « qu’ », « l’ » restent à part */
  const glued = bareWords.map(ws => (elide === "j'" && ws.length && J_GLUE.has(ws[0]) ? elide + ws[0] : ''));
  return { list, bares, bareWords, pre, post, glued };
}
/* mots d'appoint de la grammaire (js/ui/voice-answer.js, choices(…, { fillers })) : seulement des hésitations. Ceux des tables
   (« c'est », « sais », « attends », « oh », « ah »…) avalaient « tu es », « tu as », « ont », « a » avec une voix d'enfant */
export const FILLERS = Object.freeze(['euh', 'heu', 'hum', 'hm', 'mmh', 'bah', 'bon', 'alors', 'voilà', 'oups', 'zut']);

/* tous les mots qu'un item peut mettre dans la grammaire (lexique non vérifié) : tests, liste VOICE_OOV */
export function voiceWords(item) {
  if (!item || !KINDS.has(item.kind)) return [];
  const p = partsOf(item);
  const tense = item.kind === 'temps' ? p.list.flatMap(c => (TENSE_SAY[c.value] || []).flatMap(wordsOf)) : [];
  return uniq([...p.bareWords.flat(), ...tense, ...p.pre, ...p.post, ...p.glued.filter(Boolean)]);
}

export function voiceChoices(item) {
  if (!item || !KINDS.has(item.kind) || !Array.isArray(item.choices) || item.choices.length < 2) return { list: null, why: 'type' };
  const { list, bares, bareWords, glued, pre: pre0, post: post0 } = partsOf(item);
  /* un choix hors du lexique de Vosk : jamais entendu tel quel */
  if (bareWords.some(ws => !ws.length || !ws.every(sayable))) return { list: null, why: 'lexique' };
  /* la bonne réponse se dit comme un autre choix */
  const ai = list.findIndex(c => String(c.value) === String(item.answer));
  if (ai < 0) return { list: null, why: 'type' };
  if (bares.some((b, i) => i !== ai && tooClose(b, bares[ai]))) return { list: null, why: 'oral' };
  /* la phrase lue contient un choix à l'oral (« à » / « a », « Il y a longtemps » / « il ») : l'enfant qui lit la
     phrase serait pris au mot */
  if (item.kind !== 'temps' && phraseClash(item, bareWords)) return { list: null, why: 'oral' };
  /* la phrase : les mots que Vosk connaît (les autres sont simplement sautés) */
  const pre = pre0.filter(sayable), post = post0.filter(sayable);
  const build = (before, after) => list.map((c, i) => {
    const bare = bareWords[i];
    const heads = glued[i] ? [bare, [glued[i], ...bare.slice(1)]] : [bare];
    const forms = item.kind === 'temps' ? TENSE_SAY[c.value].map(f => [...before, ...wordsOf(f)]) : heads.map(hd => [...before, ...hd, ...after]);
    const label = item.kind === 'terminaison' ? bares[i] : String(c.label ?? c.value);
    return { value: c.value, say: uniq(forms.map(f => f.join(' '))), label };
  });
  /* chaque forme dite doit désigner son choix (js/core/voice-choice.js), sinon sans la suite de la phrase, puis sans
     phrase ; deux choix qu'aucune forme ne sépare → micro en pause */
  for (const [before, after] of [[pre, post], [pre, []], [[], []]]) {
    const out = build(before, after);
    if (out.every(c => c.say.every(f => { const m = matchChoice(f, out); return !!m && String(m.value) === String(c.value); }))) return { list: out, why: '' };
  }
  return { list: null, why: 'oral' };
}

/* ---------- lexique du modèle Vosk (vosk-model-small-fr-0.22), listes figées ----------
   Recalculées par tests/orchestre-voice.test.mjs avec loadLexicon() (tests/lexicon.mjs) sur tous les mots que les choix
   et les bouts de phrase de fr.conjug peuvent contenir (formes de tous les verbes de la banque à tous les temps, fautes
   typiques, tuiles, participes, sujets, mots des phrases) ; le test donne les nouvelles listes si le modèle ou la banque
   change. Mots sous la forme de wordsOf (minuscules, apostrophe droite).
   J_GLUE : mots que Vosk connaît précédés de « j’ » (« ai » → « j’ai »). */
export const J_GLUE = new Set((
  "a achetai achetais achete achète achèterai ai aide aimai aimais aime aimer aimerai allai allais annonçai annonce " +
  "appelai appelais appelle appellerai applaudis apportais apporte apporterai apprenais apprend apprendrai apprends " +
  "appris appuie appuyai arrivai arrivais arrive arriverai au aura aurai avais avait avançais avance écoutai " +
  "écoutais écoute écouterai en entrai entrais entre entrerai enverrai envoie envoyais essuie étais était eu eus " +
  "habitais habite habiterai irai obéirai obéis obéissais oubliai oubliais oublie oublierai y"
).split(' ').filter(Boolean));
/* VOICE_OOV : mots hors du lexique (Vosk ne peut pas les entendre) */
export const VOICE_OOV = new Set((
  "aboiera aboierai aboieras aboierez aboierons aboieront aboies aboyai aboyais aboyâmes aboyas aboyâtes aboye " +
  "aboyée aboyées aboyent aboyera aboyerai aboyeras aboyerez aboyerons aboyeront aboyes aboyez aboyiez aboyions " +
  "aboyons achetai achetâmes achetas achetâtes achetent achetera acheterai acheteras achetèrent acheterez " +
  "acheterons achèterons acheteront achetes achetions aimai allas allâtes allent allera allerai alleras allerez " +
  "allerons alleront annonca annoncai annonçai annoncaient annoncais annonçais annoncait annoncâmes annoncas " +
  "annonças annoncâtes annonçâtes annoncerai annonceras annoncerons annonceront annonciez annoncons appelai " +
  "appelâmes appelas appelâtes appelera appelerai appeleras appelerez appelerons appeleront appeles appelleras " +
  "appellerez applauda applaudai applaudaient applaudais applaudait applaudâmes applaudas applaudâtes applaudent " +
  "applaudèrent applaudez applaudies applaudiez applaudîmes applaudions applaudira applaudirai applaudiras " +
  "applaudirent applaudirez applaudirons applaudiront applaudissais applaudissiez applaudissions applaudîtes " +
  "applaudons apportai apportâmes apportas apportâtes apporterai apportiez apportions apprena apprendent apprendez " +
  "apprendons apprenèrent apprîtes appuierai appuieras appuierez appuierons appuieront appuyai appuyais appuyâmes " +
  "appuyas appuyâtes appuye appuyent appuyera appuyerai appuyeras appuyerez appuyerons appuyeront appuyes appuyiez " +
  "appuyions arrivai arrivas arrivâtes arrosai arrosais arrosâmes arrosas arrosâtes arrosera arroseras arrosèrent " +
  "arroserez arroserons arroseront arroses arrosiez arrosions atterra atterrai atterraient atterrais atterrâmes " +
  "atterras atterrâtes atterrent atterrèrent atterrez atterrie atterries atterriez atterrîmes atterrions atterrira " +
  "atterrirai atterriras atterrirez atterrirons atterriront atterrissaient atterrissais atterrissez atterrissiez " +
  "atterrissions atterrissons atterrîtes atterrons avanca avancai avançai avancaient avancais avançais avancait " +
  "avancâmes avançâmes avancas avanças avancâtes avançâtes avancerai avanceras avancerez avancerons avanceront " +
  "avanciez avancons bonda bondai bondaient bondais bondait bondâmes bondas bondâtes bondent bondèrent bondez " +
  "bondie bondies bondiez bondîmes bondions bondira bondirai bondiras bondirez bondirons bondiront bondis " +
  "bondissais bondissez bondissiez bondissions bondissons bondîtes bondons boulangères brillai brillâmes brillas " +
  "brillâtes brillée brillées brillerai brilleras brillerez brillerons brilleront brillés brillez brilliez " +
  "brillions brillons brossai brossaient brossais brossait brossâmes brossas brossâtes brossées brossent brossera " +
  "brosserai brosseras brossèrent brosserez brosserons brosseront brossés brossiez brossions brossons caressai " +
  "caressâmes caressas caressâtes caressées caressera caresserai caresseras caresserez caresserons caresseront " +
  "caressés caressez caressiez caressions caressons chantai chantâmes chantas chantâtes chanterai chanteras " +
  "chantèrent chanterons chanteront chantions cherchâmes cherchas cherchâtes chercheras choisa choisai choisaient " +
  "choisais choisait choisâmes choisas choisâtes choisent choisèrent choisez choisiez choisîmes choisions " +
  "choisissais choisîtes choisons chuchotai chuchotais chuchotâmes chuchotas chuchotâtes chuchoté chuchotée " +
  "chuchotent chuchotera chuchoterai chuchoteras chuchoterez chuchoterons chuchoteront chuchotes chuchotés " +
  "chuchotez chuchotions chuchotons coloria coloriai coloriaient coloriais coloriait coloriâmes colorias coloriâtes " +
  "coloriée coloriées colorient coloriera colorierai colorieras colorièrent colorierez colorierons colorieront " +
  "coloriez coloriiez coloriions colorions commencai commencaient commencais commencâmes commençâmes commencas " +
  "commenças commencâtes commençâtes commenceras commencons comprena comprendent comprendez comprendons " +
  "comprenèrent comprîmes comprîtes criai criâmes crias criâtes criées crierez criés criiez criions cuisina " +
  "cuisinai cuisinaient cuisinais cuisinâmes cuisinas cuisinâtes cuisinera cuisinerai cuisineras cuisinèrent " +
  "cuisinerez cuisinerons cuisineront cuisiniez cuisinions dansai dansais dansâmes dansas dansâtes dansées danserai " +
  "danseras danserez danserons danseront dansés dansions demandâmes demandas demandâtes dessinai dessinâmes " +
  "dessinas dessinâtes dessinerai dessinerez dessinerons dessineront dessiniez dessinions dessinons disèrent disez " +
  "donnas donnâtes écoutai écoutas écoutâtes écouterez écouterons entrai entras entrâtes entrerai entrions envoyai " +
  "envoyais envoyâmes envoyas envoyâtes envoyera envoyerai envoyeras envoyerez envoyerons envoyeront envoyes " +
  "envoyiez envoyions essuient essuiera essuierai essuieras essuierez essuierons essuieront essuyai essuyais " +
  "essuyâmes essuyas essuyâtes essuye essuyent essuyera essuyerai essuyeras essuyèrent essuyerez essuyerons " +
  "essuyeront essuyes essuyés essuyiez essuyions essuyons factrices faira fairai fairas fairez fairons fairont " +
  "faisent faisèrent fermâmes fermas fermâtes fermerai fermeras fermerons fermiez fermions finai finaient finais " +
  "finait finâmes finas finâtes finent finèrent finez finiez finîmes finions finissions finîtes finons fîtes fleura " +
  "fleurai fleuraient fleurais fleurait fleurâmes fleuras fleurâtes fleurent fleurèrent fleurez fleuriez fleurîmes " +
  "fleurions fleurira fleurirai fleuriras fleurirez fleurirons fleuriront fleurissais fleurissez fleurissiez " +
  "fleurissions fleurissons fleurîtes francha franchai franchaient franchais franchait franchâmes franchas " +
  "franchâtes franchent franchèrent franchez franchiez franchions franchiras franchirez franchiront franchissais " +
  "franchissiez franchîtes franchons fûtes gagnâmes gagnas gagnâtes galopai galopais galopâmes galopas galopâtes " +
  "galopée galopées galopera galoperai galopèrent galoperez galoperons galoperont galopes galopés galopez galopiez " +
  "galopions galopons gardâmes gardas gardâtes granda grandai grandais grandait grandâmes grandas grandâtes " +
  "grandent grandèrent grandez grandiez grandions grandirai grandiras grandirez grandirons grandiront grandissais " +
  "grandissez grandissiez grandissions grandissons grandîtes grandons grimpai grimpâmes grimpas grimpâtes grimpées " +
  "grimpera grimperai grimperas grimperez grimperons grimperont grimpés grimpiez grimpions grimpons habitai " +
  "habitâmes habitas habitâtes habiterai habiteras habiterez jetas jetâtes jetent jetera jeterai jeteras jeterez " +
  "jeterons jeteront jetes jetiez jetions jetteras jetterez jouai jouâmes jouas jouâtes joueras lanca lancai " +
  "lancaient lancais lancait lancâmes lançâmes lancas lanças lancâtes lançâtes lanceras lancerons lanciez lancions " +
  "lancons lapereaux lapines lavai lavâmes lavas lavâtes laveras laverez laverons laveront laviez lavions levâmes " +
  "levas levâtes levent levera leverai lèverai leveras lèveras leverez lèverez leverons lèverons leveront leves " +
  "mangai mangaient mangais mangait mangâmes mangâtes mangeas mangeâtes mangons marchâmes marchas marchâtes marchée " +
  "marchées marcherez marcherons marchiez miaula miaulai miaulaient miaulais miaulait miaulâmes miaulas miaulâtes " +
  "miaulé miaulée miaulées miaulera miaulerai miauleras miaulèrent miaulerez miaulerons miauleront miaulés miaulez " +
  "miauliez miaulions miaulons montas montâtes monteras nagai nagaient nagais nagait nagâmes nagas nagâtes nageâmes " +
  "nageas nageâtes nagée nagées nageons nagerai nageras nagerez nagerons nageront nagés nagiez nagons nettoieras " +
  "nettoierez nettoierons nettoieront nettoyai nettoyaient nettoyâmes nettoyas nettoyâtes nettoye nettoyera " +
  "nettoyerai nettoyeras nettoyèrent nettoyerez nettoyerons nettoyeront nettoyes nettoyions nettoyons nourra " +
  "nourrai nourraient nourrais nourrait nourrâmes nourras nourrâtes nourrent nourrèrent nourrez nourriez nourrîmes " +
  "nourrions nourrirai nourriras nourrirent nourrirez nourrirons nourriront nourrissais nourrissiez nourrissions " +
  "nourrîtes nourrons obéa obéai obéaient obéais obéait obéâmes obéas obéâtes obéent obéèrent obéez obéie obéies " +
  "obéiez obéîmes obéions obéiras obéirez obéiront obéissiez obéissions obéîtes obéons oubliai oubliâmes oublias " +
  "oubliâtes oublieras oubliiez oubliions parlâmes parlas parlâtes partaga partagai partagaient partagais partagait " +
  "partagâmes partagas partagâtes partageâmes partageas partageâtes partagons partîtes plantai plantaient plantais " +
  "plantâmes plantas plantâtes plantera planterai planteras planterez planteront plantiez plantions pleurâmes " +
  "pleuras pleurâtes pleurées pleurerai pleurerez pleurerons pleuriez pleurions plonga plongai plongaient plongais " +
  "plongait plongâmes plongas plongâtes plongeais plongeâmes plongeas plongeâtes plongeras plongerez plongerons " +
  "plongiez plongions plongons portâmes portas portâtes poussâmes poussas poussâtes pousseras poussiez poussions " +
  "pouvent pouvera pouverai pouveras pouverez pouverons pouveront pouvu prena prendent prendez prendons prenèrent " +
  "préparâmes préparas préparâtes prépareras préparerez préparions prîtes promenas promenâtes promene promenées " +
  "promenent promenera promenerai promènerai promeneras promèneras promenerez promènerez promenerons promènerons " +
  "promeneront promèneront promenes promeniez promenions pûtes racontâmes racontas racontâtes raconterez " +
  "raconteront racontions ralenta ralentai ralentaient ralentais ralentait ralentâmes ralentas ralentâtes ralentent " +
  "ralentèrent ralentez ralentiez ralentîmes ralentions ralentirai ralentiras ralentirez ralentirons ralentiront " +
  "ralentissais ralentissez ralentissiez ralentissions ralentissons ralentîtes ralentons ramassâmes ramassas " +
  "ramassâtes ramassera ramasserai ramasseras ramasserez ramasserons ramasseront ramassiez ramassions ramassons " +
  "ranga rangai rangaient rangais rangait rangâmes rangas rangâtes rangeai rangeâmes rangeas rangeâtes rangeons " +
  "rangeras rangerez rangerons rangeront rangiez rangons regardâmes regardas regardâtes rempla remplai remplaient " +
  "remplais remplait remplâmes remplas remplâtes remplent remplèrent remplez rempliez remplîmes remplions rempliras " +
  "remplirez remplissais remplîtes remplons renardeaux rentras rentrâtes restas restâtes réussa réussai réussaient " +
  "réussais réussait réussâmes réussas réussâtes réussent réussèrent réussez réussiez réussîmes réussions " +
  "réussissions réussîtes réussons rêvâmes rêvas rêvâtes rêvera rêverai rêveras rêvèrent rêverez rêverons rêveront " +
  "revîntes rêvions rouga rougai rougaient rougais rougait rougâmes rougas rougâtes rougent rougèrent rougez " +
  "rougiez rougîmes rougions rougiras rougirez rougirons rougiront rougissaient rougissez rougissiez rougissions " +
  "rougissons rougîtes rougons roulâmes roulas roulâtes roulerai rouleras roulerez roulerons rouleront rouliez " +
  "sautâmes sautas sautâtes sauteras sauterez sauteront sautiez sautions sifflai sifflais sifflâmes sifflas " +
  "sifflâtes sifflées sifflerai siffleras sifflèrent sifflerez sifflerons siffleront siffles sifflés sifflez " +
  "siffliez sifflions sifflons sonnai sonnâmes sonnas sonnâtes sonnées sonneras sonnerez sonnerons sonnes sonniez " +
  "sonnions sortîtes soufflai soufflaient soufflais soufflâmes soufflas soufflâtes soufflerai souffleras " +
  "soufflèrent soufflerez soufflerons souffleront souffliez soufflions soufflons tirâmes tiras tirâtes tirions " +
  "tombâmes tombas tombâtes tomberons tombions tournâmes tournas tournâtes tournerons tourniez travaillâmes " +
  "travaillas travaillâtes trouvas trouvâtes venent venira venirai veniras venirent venirez venirons veniront venit " +
  "visitâmes visitas visitâtes visiterai visiteras vîtes voira voirai voiras voirez voiront volai volâmes volas " +
  "volâtes volerai volerez volerons voleront voliez volions volons voula voulent voulera voulerai vouleras " +
  "voulèrent voulerez voulerons vouleront voulûmes voulûtes voyaga voyagai voyagaient voyagais voyagait voyagâmes " +
  "voyagas voyagâtes voyageai voyageais voyageâmes voyageas voyageâtes voyagée voyagées voyageras voyagèrent " +
  "voyageront voyagés voyagiez voyagons voyèrent"
).split(' ').filter(Boolean));
