/* ============ JEU DE DÉMONSTRATION = IMPLÉMENTATION DE RÉFÉRENCE DU DÉROULÉ D'UN ITEM ============
   (contrat docs/ARCHITECTURE.md §7.3) — utilisé par le banc d'essai :
   game.html?module=demo-game.js&gen=demo-gen.js&count=6
   1) nextItem → null = fin ; 2) item.assist → indice d'emblée (compte comme aidé) ;
   3) juste du 1er coup → célébration + report({ correct:true, hinted:false }) ;
   4) 1re erreur → secousse douce + indice → 2e essai ; juste → report({ correct:true, hinted:true, tries:2 }) ;
   5) 2e erreur → réponse + explication → « J’ai compris ✓ » → report({ correct:false, hinted:true, tries:2 }) ;
   6) joker 💡 (en-tête) → ctx.onJoker : indice avant de répondre, l'item compte comme aidé. */
import { h, clear, parseNum } from '../../js/core/util.js';

let kp = null, alive = false, timer = null;

export default {
  id: 'demo', title: 'Démo des tables', icon: '🧪', axes: ['ma.faits'],

  async mount(root, ctx) {
    alive = true;
    const promptEl = h('div', { class: 'title-xl num', style: { fontSize: '2.6rem', color: 'var(--ink)' } });
    const card = h('div', { class: 'card center', style: { margin: '10px 0', padding: '26px 16px' } }, promptEl);
    const help = h('div', { class: 'stack', style: { minHeight: '84px', margin: '6px 0 10px' } });
    root.append(card, help);

    let item = null, tries = 0, hinted = false, t0 = 0;
    const showBubble = (text, kind, icon) => { clear(help); help.append(ctx.kit.bubble(text, kind, { icon })); };

    ctx.onJoker(() => {
      if (!item || tries > 1) return false;
      hinted = true;
      showBubble(item.hint, 'hint', '💡');
      return true;
    });

    const next = () => {
      if (!alive) return;
      item = ctx.nextItem();
      if (!item) { ctx.end(); return; }
      tries = 0; hinted = !!item.assist; t0 = performance.now();
      promptEl.textContent = item.prompt;
      clear(help);
      if (item.assist) showBubble('Petit coup de pouce : ' + item.hint, 'hint', '💡');
      kp.clear(); kp.setState(null); kp.disable(false);
      ctx.motion.enter(card, { from: 'scale' });
    };

    kp = ctx.kit.keypad({
      decimal: false,
      onSubmit(str) {
        if (!item || !alive) return;
        const ms = performance.now() - t0;
        if (parseNum(str) === Number(item.answer)) {
          kp.setState('right'); kp.disable(true);
          const fb = ctx.report(item, { correct: true, hinted: hinted || tries > 0, ms, tries: tries + 1 });
          ctx.kit.celebrateRight(kp.answer, fb ? fb.streak : 0);
          showBubble(ctx.kit.cheer(tries || hinted ? 'helped' : 'right', ctx.rng), 'good', '🌟');
          ctx.announce(help.textContent);
          timer = setTimeout(next, 900);
        } else if (tries === 0) {
          tries = 1; hinted = true;
          kp.setState('wrong');
          ctx.kit.gentleWrong(kp.answer);
          showBubble(ctx.kit.cheer('retry', ctx.rng) + ' ' + item.hint, 'hint', '💡');
          ctx.announce(help.textContent);
          timer = setTimeout(() => { kp.clear(); kp.setState(null); }, 650);
        } else {
          tries = 2;
          kp.setState('wrong'); kp.disable(true);
          ctx.kit.gentleWrong(kp.answer);
          showBubble(ctx.kit.cheer('learn', ctx.rng) + ' ' + item.explain, 'soft', '🧐');
          help.append(h('button', { class: 'btn block', type: 'button', on: { click: () => {
            ctx.report(item, { correct: false, hinted: true, ms, tries: 2 });
            next();
          } } }, 'J’ai compris ✓'));
        }
      }
    });
    root.append(kp.el);
    next();
  },

  unmount() {
    alive = false;
    clearTimeout(timer);
    if (kp) kp.destroy();
    kp = null;
  }
};
