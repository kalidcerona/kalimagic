'use strict';
  // All reveal memory and animation handles belong to this UI session only.
  const bookMotion = { owner: null, dimension: null, tab: null, visits: new Map(), live: [], pending: new Set() };
  function bookMotionFinish() {
    for (const animation of bookMotion.live) animation.cancel();
    bookMotion.live = [];
  }
  function bookMotionBaseline() {
    if (bookMotion.owner === state && bookMotion.dimension === state.dimension) return;
    bookMotionFinish();
    Object.assign(bookMotion,{owner:state,dimension:state.dimension,tab:null});
    bookMotion.visits.clear(); bookMotion.pending.clear();
  }
  // Wallet affordability is deliberately independent of stage eligibility.
  function bookOpenStages() {
    const open = new Set();
    for (const slot of D.bookLayout.slots) {
      if (slot.visibleAfterHire && !(state.tree[slot.visibleAfterHire] > 0)) continue;
      for (const id of slot.ids) {
        const info = C.nodeInfo(state,id), reason = info.blockedReason || '';
        if (info.displayable && info.stageOpen !== false &&
            (!reason || / 부족$/.test(reason) || info.cost === null)) open.add(id);
      }
    }
    return open;
  }
  function bookMotionBeforeBuy() {
    bookMotionBaseline();
    return {owner:state,dimension:state.dimension,open:bookOpenStages()};
  }
  function bookMotionAfterBuy(before) {
    bookMotionBaseline();
    if (before.owner !== state || before.dimension !== state.dimension) return;
    for (const id of bookOpenStages()) if (!before.open.has(id)) bookMotion.pending.add(id);
  }
  function bookMotionRender(cards, body, entering, revision) {
    bookMotionBaseline(); bookMotionFinish();
    bookMotion.observer?.disconnect();
    const tab = bookSession.tab, now = Date.now();
    const entry = entering || bookMotion.tab !== tab;
    const replay = entry && now - (bookMotion.visits.get(tab) ?? -Infinity) >= 1000;
    if (entry) bookMotion.visits.set(tab,now);
    bookMotion.tab = tab;
    const valid = () => menu === 'book' && bookSession.revision === revision && cards.isConnected;
    if (typeof MutationObserver === 'function') {
      bookMotion.observer = new MutationObserver(() => { if (!valid()) bookMotionFinish(); });
      bookMotion.observer.observe($('panel'),{attributes:true});
      bookMotion.observer.observe(body,{childList:true});
    }
    // Scroll restoration is synchronous before this single visibility measurement.
    if (replay && !reduced && cards.animate) {
      const bounds = body.getBoundingClientRect();
      const visible = [...cards.children].filter(card => {
        const rect = card.getBoundingClientRect();
        return rect.bottom > bounds.top && rect.top < bounds.bottom;
      }).slice(0,6);
      for (const [index,card] of visible.entries()) {
        bookMotion.live.push(card.animate([
          {opacity:0,transform:'translateY(4px)'}, {opacity:1,transform:'translateY(0)'}
        ],{duration:160,delay:index*35,easing:'ease-out',fill:'backwards'}));
      }
    }
    for (const button of cards.querySelectorAll('[data-stage]')) {
      if (!bookMotion.pending.has(button.dataset.stage)) continue;
      bookMotion.pending.delete(button.dataset.stage);
      if (!valid() || !button.animate) continue;
      const frames = reduced
        ? [{outline:'2px solid #e8c36a',outlineOffset:'-2px'},{outline:'2px solid #e8c36a',outlineOffset:'-2px'}]
        : [{backgroundColor:'#665333'},{backgroundColor:'#302735'}];
      bookMotion.live.push(button.animate(frames,{duration:reduced ? 300 : 180}));
      button.setAttribute('aria-description','새 단계가 열렸어요');
    }
    for (const name of ['pointerdown','focusin','keydown']) cards.addEventListener(name,bookMotionFinish,{capture:true,once:true});
  }
  if (typeof window !== 'undefined') {
    for (const name of ['resize','orientationchange','presentationmotionchange']) window.addEventListener(name,bookMotionFinish);
    // Closing the panel also retires delayed animations before any later re-entry.
    window.addEventListener('click',() => { if (menu !== 'book') bookMotionFinish(); });
    document.addEventListener('visibilitychange',bookMotionFinish);
  }
  const bookCurrencyNames = {coins:'동전',keys:'책',starlight:'비둘기',gems:'실크'};
  function bookStatus(info) {
    if (info.cost === null) return {text:'완성했어요',kind:'complete'};
    if (info.purchasable) return {text:'배울 수 있어요',kind:'ready'};
    if (/ 부족$/.test(info.blockedReason || '')) return {text:'재화가 부족해요',kind:'short'};
    return {text:'잠긴 비법이에요',kind:'locked'};
  }
  function bookRemaining(detail,info) {
    const reason = info.blockedReason || '';
    if (reason && !/ 부족$/.test(reason) && info.cost !== null) detail.append(element('p',`잠금 · ${reason}`,'book-lock'));
    if (info.gate && !info.gate.met && state.dimension < 2 && info.gate.text !== reason) detail.append(element('p',`잠금 · ${info.gate.text}`,'book-lock'));
    if (!(info.cost > 0)) return;
    const name = bookCurrencyNames[info.currency], held = Math.max(0,Number(state[info.currency]) || 0);
    const remaining = Math.max(0,info.cost-held), percent = Math.max(0,Math.min(100,held/info.cost*100));
    const host = element('div','','book-remaining');
    const text = `${name} ${C.formatNumber(remaining)}${info.currency === 'keys' ? '권' : '개'} 더 필요`;
    const bar = element('div','','book-remaining-bar');
    bar.setAttribute('role','progressbar'); bar.setAttribute('aria-label',text);
    bar.setAttribute('aria-valuemin','0'); bar.setAttribute('aria-valuemax','100');
    bar.setAttribute('aria-valuenow',String(percent));
    const fill = element('span'); fill.style.width = `${percent}%`; bar.append(fill);
    host.append(element('p',text),bar); detail.append(host);
  }
