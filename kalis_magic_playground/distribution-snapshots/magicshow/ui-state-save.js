'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'magicShowBuster.v3';
  document.querySelectorAll('[data-game-build]').forEach(node => { node.textContent = `빌드 ${GAME_BUILD}`; });
  const debug = new URLSearchParams(location.search).get('debug') === '1';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer:coarse)').matches;
  let phone = false, layoutWidth = 1600, layoutHeight = 900;
  let reduced = motion.matches, scale = 1, clock = 0, previous = 0;
  let menu = '', focusBeforePanel = null, lastAudience = '', lastLayout = '';
  // v4 U48 M: true while a panel opened from the menu sheet is showing; its 닫기/뒤로 then returns to the menu.
  let moreReturn = false;
  let practiceOn = false, practiceHold = null, practiceWake = null;
  let practiceIdleAt = 0, deckContinuousMs = 0, deckSaverAsked = false;
  let wakePending = false;
  let gloveRun = 0; // v4 U48 A2: the longest auto-practice time left seen in this run (a brick is 30 minutes), for the button's ring
  function showMore() { $('phoneMore').hidden = false; $('moreButton').setAttribute('aria-expanded', 'true'); autoStartStage.since=0; release(); clearDecorations(); }
  function hideMore() { $('phoneMore').hidden = true; $('moreButton').setAttribute('aria-expanded', 'false'); moreReturn = false; autoStartStage.since=0; }
  let dialogueTimer, dealerBusy = false, dealerMessage = '';
  let booTimer=null, failureAudience=null, failureVenue=null;
  let failureCause = 'mental', practiceRec = null;
  let saveWarning = false, failure = null, lastMode = '';
  let boardHolds = [];
  let caseArrange = false, arrangeFrom = null, arrangePress = null;
  const pointer = { id: null, held: false, x: -1, y: -1, inside: false };
  const particles = [], flights = [], numbers = [], cells = [];
  let badges = [], wonMoment = null;
  // School tutorial before the core NDD fight. The mark lives in u15.bios (tchain:step:line) so a reload can resume.
  // Fights themselves are rolled back: core still treats a tutorial win as the end of the only tutorial battle.
  let chainFighting = false, chainBackup = '', chainNodeId = '', chainNodeLevel = -1, chainFocused = false, chainBookChecked = false;
  // One lifetime owner survives button replacement and pointer capture changes.
  let tooltipOwner=null,tooltipPending=0,tooltipExpiry=0;
  const tooltipBindings=new WeakMap();
  function hideEasyTooltip(){
    clearTimeout(tooltipPending);clearTimeout(tooltipExpiry);
    tooltipObserver.disconnect();
    tooltipPending=tooltipExpiry=0;tooltipOwner=null;$('easyTooltip').hidden=true;
  }
  for(const name of ['pointerdown','pointerup','pointercancel','scroll'])document.addEventListener(name,hideEasyTooltip,true);
  for(const name of ['resize','orientationchange','blur'])window.addEventListener(name,hideEasyTooltip);
  document.addEventListener('visibilitychange',hideEasyTooltip);
  const tooltipObserver=new MutationObserver(records=>{
    const owner=tooltipOwner;if(!owner)return;
    if(!owner.isConnected||records.some(r=>r.target===owner||owner.contains(r.target)||[...r.removedNodes].some(n=>n===owner||n.contains?.(owner))))hideEasyTooltip();
  });
  function observeEasyTooltip(){
  tooltipObserver.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','hidden','aria-label']});
  }
  // s4i: the portrait top bar shares its row with four currencies; the title scales by its width in em (portrait.css s4i block).
  { const venueLen=()=>{ const t=[...$('venueName').textContent.trim()], em=t.reduce((n,c)=>n+(c===' '?.25:/[\u3131-\uD7A3]/.test(c)?.92:.62),0); $('venueName').style.setProperty('--venue-em',String(Math.max(4,em).toFixed(2))); }; venueLen(); new MutationObserver(venueLen).observe($('venueName'),{childList:true,characterData:true,subtree:true}); }
  function easyTooltip(button,copy){
    button.title=copy;button.setAttribute('aria-description',copy);
    if(tooltipBindings.has(button)){tooltipBindings.get(button).copy=copy;return;}
    const binding={copy,long:false};tooltipBindings.set(button,binding);
    const show=(suppressClick=true)=>{
      if(!button.isConnected){hideEasyTooltip();return;}
      hideEasyTooltip();tooltipOwner=button;observeEasyTooltip();binding.long=suppressClick;
      const tip=$('easyTooltip');tip.textContent=binding.copy;tip.hidden=false;
      const r=button.getBoundingClientRect(),stage=$('stage').getBoundingClientRect();
      tip.style.left=Math.max(4,Math.min(layoutWidth-240,(r.left-stage.left)/scale-240))+'px';tip.style.top=Math.max(48,(r.top-stage.top)/scale)+'px';
      tooltipExpiry=setTimeout(hideEasyTooltip,3000);
    };
    button.addEventListener('pointerdown',()=>{hideEasyTooltip();binding.long=false;tooltipOwner=button;observeEasyTooltip();tooltipPending=setTimeout(show,400);});
    button.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')show(false);});
    for(const event of ['pointerup','pointercancel','pointerleave','lostpointercapture'])button.addEventListener(event,hideEasyTooltip);
    button.addEventListener('click',e=>{if(binding.long){e.stopImmediatePropagation();binding.long=false;}},true);
  }
  // End transient tooltips.
  const lastHeckles = new Map(), happyCache = new Map();
  const caps = { particles: coarse ? 120 : 240, icons: 24, numbers: 4 };
  const canvas = $('effects'), ctx = canvas.getContext('2d');
  const animations = new WeakMap();
  // U39: the pattern label breaks only at " · ": every part is its own inline-block, so a part moves whole to the next line (and wraps inside only if it is wider than the label).
  // Writers keep assigning textContent; an unchanged text is ignored, so the label also stops rebuilding every frame.
  (() => {
    const el = $('patternLabel'); let raw = '';
    Object.defineProperty(el, 'textContent', { configurable: true, get() { return raw; }, set(value) {
      value = String(value); if (value === raw) return; raw = value;
      const nodes = [];
      value.split(' · ').forEach((part, i) => { if (i) nodes.push(document.createTextNode(' · ')); const s = document.createElement('span'); s.className = 'pat-part'; s.textContent = part; nodes.push(s); });
      el.replaceChildren(...(value ? nodes : []));
    } });
  })();
  const patterns = ['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
  let corrupt = false, inaccessible = false, newerSave = false, restoring = false, giftEnded = false;
  let saveStore = null, loaded0 = false, repairedSave = false, recoveredSave = false, refundedCoins = 0, refundedKeys = 0;
  let state = C.newGame(Date.now() >>> 0);
  const launchQuery = new URLSearchParams(location.search);
  // A one-navigation launch token lives in the URL, never in serialized state.
  const titleLaunchPending = !(navigator.webdriver && launchQuery.get('title') !== '1') && launchQuery.get('_titleStart') !== '1';
  if (launchQuery.has('_titleStart')) {
    const url = new URL(location.href); url.searchParams.delete('_titleStart');
    try { history.replaceState(null, '', url.href); } catch (error) { /* Cosmetic URL cleanup. */ }
  }
  let seasonReset = false;
  if (titleLaunchPending) {
    // Do not migrate, repair or overwrite a save before the player chooses a path.
    try { saveStore = C.createSaveStore(localStorage); newerSave = C.isNewerSave(localStorage.getItem(KEY)); }
    catch (error) { inaccessible = true; }
  } else try {
    // v4 U45: one-time test-season reset before anything reads the save (see Core.applySaveEpoch and CONST.saveEpoch).
    try { seasonReset = C.applySaveEpoch(localStorage).reset; } catch (error) { /* storage blocked: the store below reports it */ }
    saveStore = C.createSaveStore(localStorage);
    const loaded = saveStore.load();
    if (loaded.state) { state = loaded.state; C.step(state,0,{taps:[],quiet:true}); loaded0 = true; }
    corrupt = loaded.backedUp && !loaded.recovered;
    recoveredSave = !!loaded.recovered;
    // v4 U38: 'refund:<coins>' in the repair list is the paid-back endless nodes; it has its own toast, not the generic repair one.
    const repairList = loaded.repairs || [];
    refundedCoins = repairList.map(r => /^refund:(\d+)$/.exec(r)).filter(Boolean).reduce((n, m) => n + Number(m[1]), 0);
    refundedKeys = repairList.map(r => /^refundKeys:(\d+)$/.exec(r)).filter(Boolean).reduce((n, m) => n + Number(m[1]), 0);
    repairedSave = repairList.some(r => !/^refund(Keys)?:/.test(r));
    newerSave = loaded.newer;
    giftEnded = loaded.giftEnded;
  } catch (error) { inaccessible = true; }
  // ?restore=1: one-tap automatic restore of the most progressed backup, before anything can save over it.
  let restoreNoBetter = false;
  if (!titleLaunchPending && launchQuery.get('restore') === '1' && saveStore && !inaccessible) {
    try {
      const rank = (s) => [s.dimension|0, s.stage|0, typeof s.coins === 'number' && isFinite(s.coins) ? s.coins : 0, s.date|0];
      const better = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i] > b[i]; } return false; };
      const best = saveStore.list().filter(item => item.restorable).reduce((top, item) => (!top || better(rank(item), rank(top)) ? item : top), null);
      // A missing or unreadable current save counts as lowest; the date only orders backups against each other.
      const cur = (corrupt || !loaded0) ? [-1,-1,-1] : [state.dimension|0, state.vMax|0, Number(state.coins) || 0];
      if (best && !newerSave && better(rank(best).slice(0,3), cur) && saveStore.restore(best.key, true)) {
        restoring = true;
        const url = new URL(location.href); url.searchParams.delete('restore'); url.searchParams.set('restored','1');
        location.replace(url.href);
      } else restoreNoBetter = !!best && !newerSave;
    } catch (error) { restoreNoBetter = false; }
  }

  function showSaveNotice() {
    if ($('saveVersionNotice')) return;
    const host = document.createElement('div');
    host.id = 'saveVersionNotice'; host.className = 'save-version-notice'; host.setAttribute('role','status');
    host.append(document.createTextNode('새 버전이 있어요. 페이지를 새로고침해 주세요 '));
    const link = document.createElement('a'); link.href = 'update.html'; link.textContent = '새 버전 열기'; link.className = 'save-update-button';
    host.append(link); document.body.append(host);
  }
  // Manual save slots: this block owns slot storage, confirmations and the menu hook.
  const SaveSlots = (() => {
    const key = n => {
      if (!Number.isInteger(n) || n < 1 || n > 3) throw new Error('Invalid save slot');
      return C.SAVE_KEYS.slotPrefix + n;
    };
    function read(storage, n) {
      const raw = storage.getItem(key(n));
      if (raw === null) return {empty: true, slot: null};
      try { const slot = JSON.parse(raw); return {empty: false, slot: C.validSlot(slot) ? slot : null}; }
      catch (error) { return {empty: false, slot: null}; }
    }
    function raw(storage, n) { return storage.getItem(key(n)); }
    function write(storage, n, current, now = Date.now()) {
      const slot = {v: 1, savedAt: now, summary: C.slotSummary(current), data: C.serialize(current)};
      if (!C.validSlot(slot)) throw new Error('Unreadable save snapshot');
      storage.setItem(key(n), JSON.stringify(slot));
      return slot;
    }
    function confirmation() {
      let pending = null;
      return {tap(token, required) {
        if (!required || pending === token) { pending = null; return true; }
        pending = token; return false;
      }, reset() { pending = null; }};
    }
    function restore(storage, store, slot) {
      if (!C.validSlot(slot) || !C.deserialize(slot.data)) return false;
      const main = storage.getItem(C.SAVE_KEYS.main);
      if (main !== null) {
        if (C.isNewerSave(main)) return false;
        store.backup(main, null, true);
        // U37 deduplicates against rolling backups too. Ensure that duplicate is protected.
        if (!store.list().some(item => item.protectedCopy && storage.getItem(item.key) === main)) {
          const prefix = C.SAVE_KEYS.keepPrefix;
          let stamp = Math.max(Date.now(), ...store.list().filter(item => item.protectedCopy).map(item => item.date + 1));
          while (storage.getItem(prefix + stamp) !== null) stamp++;
          storage.setItem(prefix + stamp, main);
        }
      }
      store.backup(slot.data, null, false);
      const target = store.list().find(item => item.restorable && storage.getItem(item.key) === slot.data);
      // The existing restore code alone writes the live key; reload uses its normal load/autosave path.
      const ok = !!target && store.restore(target.key, true);
      if (ok) settleDeckGift(storage, slot);
      return ok;
    }
    // v4 U48b: a slot saved before version 20 would grant the 칼리 덱 gift again on every load. The restore above still loads the original
    // data (so the gift is given this once); the slot itself is rewritten as version 20 without the gift, so restoring it later gives nothing.
    function settleDeckGift(storage, slot) {
      try {
        const s = C.deserialize(slot.data);
        if (!s || !(s._deckGift > 0)) return;
        s.u15.gloves = Math.max(0, s.u15.gloves - s._deckGift);
        const data = C.serialize(s);
        for (let n = 1; n <= 3; n++) {
          const cur = read(storage, n).slot;
          if (cur && cur.data === slot.data && cur.savedAt === slot.savedAt) storage.setItem(key(n), JSON.stringify({v: 1, savedAt: cur.savedAt, summary: cur.summary, data}));
        }
      } catch (error) { /* the slot stays as it was */ }
    }
    function date(ms) {
      const d = new Date(ms), h = d.getHours();
      return `${d.getMonth() + 1}월 ${d.getDate()}일 ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return {read, raw, write, confirmation, restore, date};
  })();
  let slotSavePending = false, slotSaveWake = null;
  // 12-118: the save feedback waits end early when the panel closes, so the leave question comes back at once and no timer runs into a closed panel.
  function slotSaveWait(ms) {
    return new Promise(resolve => {
      const done = () => { clearTimeout(timer); if (slotSaveWake === done) slotSaveWake = null; resolve(); };
      const timer = setTimeout(done, ms); slotSaveWake = done;
    });
  }
  function openSaveSlots(loadOnly = false) {
    loadOnly = loadOnly === true; // Menu click events keep the normal save-and-load mode.
    if (slotSavePending) return;
    release(); $('phoneMore').hidden = true; $('moreButton').setAttribute('aria-expanded', 'false');
    openPanel('saveslots', '저장 칸');
    const confirm = SaveSlots.confirmation(), buttons = [];
    const status = element('p', '', 'save-slots-status'); status.setAttribute('role', 'status');
    const resetLabels = () => buttons.forEach(button => { button.textContent = button.dataset.label; });
    const body = $('panelBody');
    body.append(element('p', '불러오기 전 진행은 백업에 남아요.', 'save-slots-note'));
    try {
      for (let n = 1; n <= 3; n++) {
        const item = SaveSlots.read(localStorage, n), slot = item.slot;
        const row = element('section', '', 'save-slots-row');
        row.append(element('h2', `저장 칸 ${n}`));
        if (slot) {
          row.append(element('p', `${slot.summary.venueName} · 레벨 ${slot.summary.level} · 동전 ${slot.summary.coins}`),
            element('p', `${SaveSlots.date(slot.savedAt)} · 플레이 ${slot.summary.playMinutes}분`, 'save-slots-time'));
        } else row.append(element('p', item.empty ? '비어 있음' : '읽을 수 없는 저장'));
        const controls = element('div', '', 'save-slots-actions');
        const saveButton = action('여기에 저장', async () => {
          if (slotSavePending) return;
          resetLabels();
          const disabledButtons = [];
          const leaving = leavePending;
          try {
            const currentRaw = SaveSlots.raw(localStorage, n);
            if (!confirm.tap(`save:${n}:${currentRaw}`, currentRaw !== null)) {
              saveButton.textContent = '덮어쓸까요? 한 번 더 누르기'; return;
            }
            slotSavePending = true;
            for (const button of buttons) { disabledButtons.push([button, button.disabled]); button.disabled = true; }
            status.textContent = '';
            saveButton.dataset.saveState = 'saving';
            saveButton.setAttribute('aria-busy', 'true');
            saveButton.textContent = '저장 중…';
            SaveSlots.write(localStorage, n, state); lastSlotSaveAt = Date.now(); toast('저장 칸에 남겼어요');
            await slotSaveWait(600);
            if (saveButton.isConnected && menu === 'saveslots' && !$('panel').hidden) {
              saveButton.dataset.saveState = 'saved';
              saveButton.setAttribute('aria-busy', 'false');
              saveButton.textContent = '저장했어요';
              await slotSaveWait(1200);
            }
          }
          catch (error) { status.textContent = '저장할 수 없어요. 다시 눌러 주세요'; return; }
          finally {
            if (disabledButtons.length) {
              slotSavePending = false;
              for (const [button, disabled] of disabledButtons) button.disabled = disabled;
              delete saveButton.dataset.saveState;
              saveButton.removeAttribute('aria-busy');
              saveButton.textContent = saveButton.dataset.label;
            }
          }
          // Do not reopen a panel the player closed or replaced during feedback.
          if (!saveButton.isConnected || menu !== 'saveslots' || $('panel').hidden) {
            // 12-118: the slot was written, so a leave question that led here comes back as after a finished feedback (once, no panel refresh).
            if (leaving) { leavePending = false; if ($('panel').hidden && $('leaveConfirm').hidden) showLeaveConfirm(true); }
            return;
          }
          openSaveSlots(loadOnly);
          if (leaving) { leavePending = false; closePanel(); showLeaveConfirm(true); }
        }, inaccessible || newerSave || restoring);
        const loadButton = action('불러오기', () => {
          if (slotSavePending) return;
          resetLabels();
          if (!confirm.tap(`load:${n}`, true)) {
            loadButton.textContent = '지금 진행이 이 저장으로 바뀌어요. 한 번 더 누르기'; return;
          }
          try {
            const latest = SaveSlots.read(localStorage, n).slot;
            if (!latest || latest.data !== slot.data || latest.savedAt !== slot.savedAt) {
              openSaveSlots(loadOnly); toast('저장 칸이 바뀌었어요. 다시 골라 주세요'); return;
            }
            if (!SaveSlots.restore(localStorage, saveStore, latest)) { status.textContent = '불러올 수 없어요'; return; }
            restoring = true;
            const url = new URL(location.href); url.searchParams.delete('restore'); url.searchParams.set('restored', '1');
            if (loadOnly) url.searchParams.set('_titleStart', '1');
            location.replace(url.href);
          } catch (error) { status.textContent = '불러오기를 마치지 못했어요. 백업을 확인해 주세요'; }
        }, !slot || inaccessible || newerSave || restoring || !saveStore);
        for (const button of [saveButton, loadButton]) { button.dataset.label = button.textContent; buttons.push(button); }
        if (!loadOnly) controls.append(saveButton);
        controls.append(loadButton); row.append(controls); body.append(row);
      }
    } catch (error) { status.textContent = '저장 칸을 읽을 수 없어요'; }
    body.append(status);
  }
  // v4 U47 6: a plain "저장" entry at the top of the menu (above the 놀기 and 설정 groups); it opens the same save-slot panel. Auto-save is unchanged.
  const saveSlotsButton = action('저장', openSaveSlots);
  saveSlotsButton.id = 'saveSlotsButton'; saveSlotsButton.title = '저장 칸에 저장하거나 불러와요';
  $('menuGroupSettings').insertAdjacentElement('afterend', saveSlotsButton);
  // Keep the existing more-menu host on desktop and through phone/desktop resize.

  function openRestore() {
    openPanel('restore', '저장 백업 복원');
    try {
      const backups = saveStore.list();
      if (!backups.length) $('panelBody').append(element('p','복원할 백업이 없어요.'));
      for (const item of backups) {
        const date = item.date ? new Date(item.date).toLocaleString('ko-KR') : '날짜 확인 불가';
        const venue = item.stage ? D.venues[item.stage-1] : null;
        const stage = item.stage ? (venue && venue.name ? venue.name : `무대 ${item.stage}`) : '무대 확인 불가';
        const coins = item.coins === null ? '동전 확인 불가' : `동전 ${C.formatNumber(item.coins)}`;
        const label = `${item.key.endsWith('.auto') ? '자동 백업 · ' : ''}${date} · ${stage} · ${coins}`;
        $('panelBody').append(action(label, () => {
          openPanel('restore', '이 백업을 복원할까요?');
          $('panelBody').append(element('p',label),element('p','현재 저장도 백업한 뒤 선택한 저장으로 바꿔요.'));
          $('panelBody').append(action('복원하기', () => {
            try {
              if (!saveStore.restore(item.key,true)) { toast('이 백업은 복원할 수 없어요'); return; }
              restoring = true;
              const url = new URL(location.href); url.searchParams.delete('restore');
              location.replace(url.href);
            } catch (error) { toast('복원할 수 없어요. 기존 저장은 유지돼요'); }
          }),action('취소',openRestore));
        }, !item.restorable));
      }
    } catch (error) { $('panelBody').append(element('p','백업을 읽을 수 없어요.')); }
  }

  // U36: pixel digits are rebuilt per glyph from cached templates, and fast-changing values (combo, case percent, doubt, coins) are
  // written at most 10 times per second (the newest value is always shown; flushNums runs every frame).
