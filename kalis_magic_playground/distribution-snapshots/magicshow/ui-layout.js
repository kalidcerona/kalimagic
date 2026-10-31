'use strict';
  const glyphTemplates = new Map(), numPending = new Map(), NUM_MS = 100;
  function glyphFor(ch) {
    let template = glyphTemplates.get(ch);
    if (!template) {
      template = document.createElement('span');
      template.setAttribute('aria-hidden', 'true');
      if (/\d/.test(ch)) {
        template.className = 'digit';
        for (const bit of patterns[Number(ch)]) {
          const pixel = document.createElement('i');
          if (bit === '0') pixel.className = 'off';
          template.append(pixel);
        }
      } else { template.className = 'digit-separator'; template.textContent = ch; }
      glyphTemplates.set(ch, template);
    }
    return template.cloneNode(true);
  }
  function writeNum(el, text) {
    el.dataset.rendered = text;
    el.setAttribute('aria-label', text);
    const next = Array.from(text), previous = el.__glyphs;
    if (previous && previous.length === next.length && el.children.length === next.length) {
      for (let i = 0; i < next.length; i++) if (previous[i] !== next[i]) el.replaceChild(glyphFor(next[i]), el.children[i]);
    } else {
      el.replaceChildren(...next.map(glyphFor));
    }
    el.__glyphs = next; el.__numAt = performance.now();
  }
  function numText(el, value, soft) {
    const text = typeof value === 'number' ? C.formatNumber(value) : String(value);
    if (el.dataset.rendered === text) { numPending.delete(el); return; }
    if (soft && el.__numAt !== undefined && performance.now() - el.__numAt < NUM_MS) { numPending.set(el, text); return; }
    numPending.delete(el);
    writeNum(el, text);
  }
  function flushNums() {
    if (!numPending.size) return;
    const now = performance.now();
    for (const [el, text] of numPending) if (now - el.__numAt >= NUM_MS) { numPending.delete(el); if (el.dataset.rendered !== text) writeNum(el, text); }
  }
  const rounded = v => C.formatNumber(Math.max(0, Math.round(v)));
  const randomLine = list => list[Math.floor(Math.random() * list.length)];
  // U36: innerWidth/innerHeight flush layout, and portrait() runs inside paused(), which a frame calls dozens of times after DOM writes.
  // Phone portrait (shortest side under 740 CSS px, 12-115) and, since s4d, an upright touch tablet (up to 1400 CSS px) play in the portrait layout.
  // portrait() stays the pause/rotate gate for other tall viewports (a tall desktop window).
  // Same source as PhoneLayout.measure(): fit() writes this cache from layout.portrait (visual viewport).
  const portraitLayout = () => { let v = geo.get('portraitLayout'); if (v === undefined) { v = innerHeight > innerWidth && (Math.min(innerWidth, innerHeight) < 740 || (coarse && Math.max(innerWidth, innerHeight) <= 1400)); geo.set('portraitLayout', v); } return v; };
  const portrait = () => { let v = geo.get('portrait'); if (v === undefined) { v = innerHeight > innerWidth && !portraitLayout(); geo.set('portrait', v); } return v; };
  const presentation=new Presentation.Queue();
  // A tap during a character dialogue is retained and collected only after the dialogue ends.
  const lineOpen = () => !!state.u15.scene || !$('storyDialog').hidden; // v4 U49b 1: a character dialog is on screen (the pickup is never collected then)
  // Menu and panel sheets block every layout, including the portrait dock's full-screen sheets.
  const blockingSheetOpen = () => !!menu || !$('phoneMore').hidden || $('moreButton').getAttribute('aria-expanded')==='true' || !$('panel').hidden;
  const dialogOnlyPause = () => lineOpen() && !blockingSheetOpen() && !state.u18.map && !wonMoment?.pending && !document.hidden && !portrait() && $('offlineCard').hidden && !stageRewardHost && $('leaveConfirm').hidden && $('sceneCard').hidden;
  var seronaFail={pending:false,index:-1}; // var: paused() can be called before this line runs
  const paused = () => skillNoticePending() || (state._theaterBeat && clock < state._theaterBeat.until) || /* s5b: the phase-1 win beat holds the show */ wonMoment?.pending || state.u18.map || !!state.u15.scene || (typeof seronaFail !== 'undefined' && !!seronaFail && seronaFail.index >= 0) /* s5t */ || (state.u15.tutorial.active && (state.u15.tutorial.phase!=='fight' || state.u15.tutorial.won)) || schoolChainPaused() || !state.onboarding.intro || document.hidden || blockingSheetOpen() || portrait() || !!stageRewardHost || !$('offlineCard').hidden || !$('leaveConfirm').hidden || !$('sceneCard').hidden;
  function fit() {
    const vv = window.visualViewport;
    const width = vv ? vv.width : innerWidth, height = vv ? vv.height : innerHeight;
    geo.clear(); wandOffset = null; geoAge = 0;
    const probe = getComputedStyle($('safeArea'));
    const safe = Object.fromEntries(['left','right','top','bottom'].map(side => [side, parseFloat(probe.getPropertyValue(`padding-${side}`)) || 0]));
    const layout = PhoneLayout.measure(width, height, safe, coarse, true);
    geo.set('portraitLayout', !!layout.portrait);
    phone = layout.phone;
    document.body.classList.toggle('phone', phone);
    document.body.classList.toggle('tablet',!!layout.tablet);
    document.body.classList.toggle('phone-tight', phone && layout.height <= 340);
    document.body.classList.toggle('compact-notice', phone && !layout.portrait && !layout.tablet && (layout.height <= 340 || layout.audience < 360));
    document.body.classList.toggle('phone-compact',phone&&!layout.tablet&&layout.height<352);
    document.body.classList.toggle('phone-narrow',phone&&!layout.tablet&&layout.audience<260);
    document.body.classList.toggle('phone-low',phone&&!layout.tablet&&layout.height<320);
    document.body.classList.toggle('phone-xshort',phone&&!layout.tablet&&layout.height<300);
    document.body.classList.toggle('phone-short',phone&&!layout.tablet&&layout.height<400);
    document.body.classList.toggle('portrait-layout', !!layout.portrait);
    document.body.classList.toggle('portrait-compact', !!layout.portrait?.compact);
    document.body.classList.toggle('portrait', portrait());
    scale = phone ? (layout.zoom || 1) : Math.min(innerWidth / 1600, innerHeight / 900); // s4d: an upright tablet scales the portrait layout up
    layoutWidth = phone ? layout.width : 1600; layoutHeight = phone ? layout.height : 900;
    const frame = $('frame'), stage = $('stage');
    frame.style.width = `${layoutWidth * scale}px`; frame.style.height = `${layoutHeight * scale}px`;
    frame.style.position = phone ? 'absolute' : 'relative';
    frame.style.left = phone ? `${safe.left + (layout.tablet ? (width-safe.left-safe.right-layout.width)/2 : 0) + (vv?.offsetLeft || 0)}px` : '';
    frame.style.top = phone ? `${safe.top + (vv?.offsetTop || 0)}px` : '';
    stage.style.width = `${layoutWidth}px`; stage.style.height = `${layoutHeight}px`;
    stage.style.transform = `scale(${scale})`;
    stage.style.setProperty('--menu-tap-height', `${45 / scale}px`);
    stage.style.setProperty('--layout-height',`${layoutHeight}px`);
    stage.style.setProperty('--stage-w',`${layoutWidth}px`); // v4 U50: the stage width for the one-scene layout (style.css U50 block)
    stage.style.setProperty('--board-size', `${layout.board}px`);
    stage.style.setProperty('--audience-width', `${layout.audience}px`);
    if (layout.portrait) {
      const p = layout.portrait;
      stage.style.setProperty('--p-top', `${p.top}px`);
      stage.style.setProperty('--p-board-h', `${p.boardH}px`);
      stage.style.setProperty('--p-venue', `${p.venue}px`);
      stage.style.setProperty('--p-row-gap', `${p.rowGap}px`);
      stage.style.setProperty('--p-hp', `${p.hp}px`);
      stage.style.setProperty('--p-stage', `${p.stageH}px`);
      stage.style.setProperty('--p-stats', `${p.stats}px`);
      stage.style.setProperty('--p-finale', `${p.finale}px`);
      stage.style.setProperty('--p-skills', `${p.skills}px`);
      stage.style.setProperty('--p-board-top', `${p.boardTop}px`);
      stage.style.setProperty('--p-pad', `${p.pad}px`);
      stage.style.setProperty('--p-gap', `${p.gap}px`);
      // One case plus the docked dialogue: the square that fits above the line, still centred.
      const soloRoom = layout.height - p.boardTop - p.skills - 108;
      stage.style.setProperty('--p-solo', `${Math.max(96, Math.min(layout.board, layout.width - 16, soloRoom))}px`);
    } else {
      for (const name of ['--p-board-h','--p-top','--p-venue','--p-row-gap','--p-hp','--p-stage','--p-stats','--p-finale','--p-skills','--p-board-top','--p-pad','--p-gap','--p-solo']) stage.style.removeProperty(name);
    }
    const dpr = phone ? Math.min(2, window.devicePixelRatio || 1) : 1;
    canvas.width = Math.round(layoutWidth * dpr); canvas.height = Math.round(layoutHeight * dpr);
    canvas.style.width = `${layoutWidth}px`; canvas.style.height = `${layoutHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    caps.particles = phone ? 48 : (coarse ? 120 : 240); caps.icons = phone ? 8 : 24;
    particles.length = 0; flights.length = 0; numbers.length = 0; badges.length = 0;
    invalidateStageAudience();
    phoneChrome(); release(); previous = 0; snapAudience();
    if (menu === 'book') tree();
  }
  // v4 U50: the doubt and 야유 bars stand upright (style.css U50); their text plates become siblings so the turned bars hold only the fill.
  for (const [sel, cls] of [['.doubt > .doubt-label', 'doubt-plate'], ['#heckleMeter > .heckle-label', 'heckle-plate']]) { const el = document.querySelector(sel); if (el) { el.classList.add(cls); $('audienceCard').append(el); } }
  const chromeHomes = new Map();
  // v4 U48 N3: 도감 stays in the top bar (nav .menu) next to 메뉴 on desktop too.
  const DESKTOP_MENU = ['caseArrangeButton','equipButton','missionsButton','gemShopButton','customizeButton','rebirthButton','soundButton','musicButton','musicVolume','hapticsButton','textSpeedButton','retreatButton','coffeeButton','openChatButton'];
  function moveChrome(el, host) {
    if (!el) return;
    if (!chromeHomes.has(el)) chromeHomes.set(el, { parent: el.parentNode, next: el.nextSibling });
    host.append(el);
  }
  function phoneChrome() {
    const portraitNow = phone && portraitLayout();
    if (!portraitNow) leavePortraitChrome();
    if (phone) {
      moveChrome(document.querySelector('.venue-heading'), $('phoneVenue'));
      moveChrome(document.querySelector('.hud'), $('phoneWallet'));
      moveChrome($('goalStrip'),$('phoneTop'));
      moveChrome($('bookButton'),$('phoneTop'));
      moveChrome($('storyDialog'),$('stage')); // v4 U50b: out of the isolated audience card, so the widened dialog is drawn (and tapped) above the skill column
      moveChrome($('equipButton'),$('phoneMore')); // Equipment lives in the menu; the notebook stays in the top row.
      // Portrait only: one row of the skills, then 비법 and 연습 모드, 실크 상점, 도감 and 메뉴 (s4c).
      if (portraitNow) placePortraitDock();
      else {
        showBookButton(true);
        moveChrome($('bestiaryButton'),$('phoneTop')); moveChrome($('wardrobeButton'),$('phoneTop')); // v4 U48 N3: 도감 sits in the top bar next to 메뉴, not in the menu
        moveChrome($('moreButton'), $('phoneTop')); $('moreButton').textContent='☰ 메뉴';
      }
      for (const id of ['storyButton','installButton','statsButton','rebirthButton','missionsButton','gemShopButton','customizeButton','soundButton','musicButton','musicVolume','hapticsButton','textSpeedButton','retreatButton','helperControls','debug','coffeeButton','openChatButton']) moveChrome(id==='musicVolume'?$(id).parentElement:$(id), $('phoneMore'));
      if (!portraitNow && $('practiceButton')) moveChrome($('practiceButton'), $('phoneMore')); // 연습 모드 is in the menu outside portrait
      if (portraitNow) pxText($('equipButton'), '🎩 마술용품');
      else { pxText($('bookButton'), '비법'); pxText($('equipButton'), '🎩 마술용품'); /* v4 U50b: a full label, it lives in the menu now */ $('moreButton').textContent=innerWidth<=740?'☰':'☰ 메뉴'; pxText($('bestiaryButton'), innerWidth<=740?'📚':'📚 도감'); }
      $('moreButton').setAttribute('aria-label','메뉴'); $('bestiaryButton').setAttribute('aria-label','도감');
      updateSoundButton();const on=window.Sfx?.musicEnabled();$('musicButton').textContent=on?'음악 ON':'음악 OFF';
      $('closePanel').textContent = '← 뒤로';
    } else {
      for (const [el, home] of [...chromeHomes].reverse()) home.parent.insertBefore(el, home.next?.parentNode === home.parent ? home.next : null);
      updateSoundButton();const on=window.Sfx?.musicEnabled();$('musicButton').textContent=on?'배경음악 켜짐':'배경음악 꺼짐';
      chromeHomes.clear(); $('moreButton').textContent='☰ 메뉴'; pxText($('equipButton'), '🎩 마술용품'); showBookButton(true); pxText($('bookButton'), '비법'); pxText($('bestiaryButton'), '도감'); $('closePanel').textContent = '닫기';
      // v4 U46 A7: desktop keeps only 비법서 and 메뉴 at the top, like the phone; everything else lives in the menu sheet.
      for (const id of DESKTOP_MENU) moveChrome(id==='musicVolume'?$(id).parentElement:$(id), $('phoneMore'));
      moveChrome($('statsButton'), $('phoneMore'));
      if ($('practiceButton')) moveChrome($('practiceButton'), $('phoneMore'));
    }
    if ($('practiceButton')) $('practiceButton').hidden = false; // 연습 모드 is shared: every layout reaches it
    if (!portraitNow) moveChrome($('caseArrangeButton'), $('phoneMore'));
    $('caseArrangeMenuButton').hidden = true;
    // Keep the single map control in the shared main-screen chrome across rotations.
    moveChrome($('mapButton'), phone ? $('phoneTop') : document.querySelector('nav.menu'));
    $('mapButton').setAttribute('aria-label', '무대 지도');
    pxText($('mapButton'), phone ? '지도' : '무대 지도');
    placePortraitMeters(portraitNow);
    portraitCopy();
    dressSharedButtons(portraitNow);
    placePortraitDecor(portraitNow);
    // v4 U48 M: fit() runs on every viewport resize or scroll (a phone's address bar, the keyboard); the open menu stays open unless the layout kind changed.
    if (phoneChrome.kind !== phone) { phoneChrome.kind = phone; $('phoneMore').hidden = true; $('moreButton').setAttribute('aria-expanded', 'false'); }
  }
  // Portrait only: the stage light, Kali's table, the board frame and the menu sheet's close button.
  function placePortraitDecor(on) {
    for (const id of ['stageLight', 'kaliTable', 'boardFrame']) if ($(id)) $(id).hidden = !on;
    if (on) syncKaliTable();
    let close = $('closeMore');
    if (on && !close) {
      close = action('메뉴 닫기', hideMore);
      close.id = 'closeMore';
      close.style.order = '-4'; close.style.gridColumn = '1 / -1';
    }
    if (on) { close.hidden = false; if (close.parentNode !== $('phoneMore') || close !== $('phoneMore').firstChild) $('phoneMore').prepend(close); }
    else if (close) close.remove();
  }
  // Leaving portrait: undo the dock, the skill row and the kit faces, so the landscape chrome is the backup's.
  function leavePortraitChrome() {
    const dock = $('actionDock'), skills = $('activeSkills');
    const gloveHome = chromeHomes.get($('item-auto-glove'));
    if (gloveHome && $('item-auto-glove')) skills.append($('item-auto-glove'));
    if (!dock && !$('skillRow') && !document.querySelector('.kit-btn, .top-dogam')) return;
    releaseSkillRow();
    for (const id of ['caseArrangeButton', 'bookButton', 'practiceButton', 'bestiaryButton', 'moreButton', 'gemShopQuick', 'wardrobeButton']) clearKitFace($(id));
    for (const button of skills.querySelectorAll('.active-skill')) button.classList.remove('kit-btn');
    const dogam = $('bestiaryButton');
    if (dogam) { dogam.classList.remove('top-dogam'); dogam.querySelectorAll(':scope > img.top-dogam-ico, :scope > .top-dogam-label').forEach(n => n.remove()); delete dogam.dataset.pxText; }
    if ($('gemShopQuick')) skills.prepend($('gemShopQuick')); // first in #activeSkills, as on a fresh landscape load
    if ($('bookButton')) $('bookButton').style.removeProperty('display');
    if (dock) {
      // Put every moved button back to its saved home (or the landscape skill host) before the dock goes.
      for (const el of [...dock.children]) {
        const home = chromeHomes.get(el);
        if (home && home.parent !== dock && home.parent.isConnected) home.parent.insertBefore(el, home.next?.parentNode === home.parent ? home.next : null);
        else skills.append(el);
      }
      dock.remove();
    }
  }
  // Portrait: audience HP (name, 의심 number, purple bar) is its own framed strip under the venue.
  // 액트 and 연출 are numbers under the venue name. The stats band is 멘탈, 자신감, 피날레, then the audience 야유 gauge.
  let portraitChromeOn = false;
  // Portrait moves record each node's landscape parent and next sibling the first time; leaving portrait puts them back in reverse order.
  const portraitHomes = new Map();
  function portraitMove(el, host) {
    if (!el || !host) return;
    if (!portraitHomes.has(el)) portraitHomes.set(el, { parent: el.parentNode, next: el.nextSibling, known: new Set(el.parentNode ? el.parentNode.children : []) });
    host.append(el);
  }
  function restorePortraitHomes() {
    for (const [el, home] of [...portraitHomes].reverse()) {
      if (!home.parent) continue;
      // A node that was last goes right after its last remaining old sibling, before the siblings created while it was away, as on a fresh load.
      let next = home.next?.parentNode === home.parent ? home.next : undefined;
      if (next === undefined) { const old = [...home.parent.children].filter(c => c !== el && home.known.has(c)).pop(); next = old ? old.nextSibling : home.parent.firstChild; }
      home.parent.insertBefore(el, next);
    }
    portraitHomes.clear();
  }
  function placePortraitMeters(on) {
    const doubt = document.querySelector('.doubt-plate');
    const bar = document.querySelector('.doubt');
    let host = $('portraitMeters');
    if (on) {
      if (!host) { host = element('div', '', 'portrait-meters'); host.id = 'portraitMeters'; }
      $('stage').append(host);
      let left = host.querySelector('.meter-left');
      if (!left) { left = element('div', '', 'meter-left'); host.append(left); }
      portraitMove(doubt, left);
      portraitMove(bar, host);
      placePortraitGauges(true);
      portraitChromeOn = true;
    } else if (portraitChromeOn) {
      restorePortraitHomes();
      if (host) host.remove();
      placePortraitGauges(false);
      portraitChromeOn = false;
    }
  }
  // s5f: the stats strip (멘탈, 자신감, 피날레 | 액트, 연출) is the same markup in every layout; portrait only moves the audience 야유 gauge.
  function placePortraitGauges(on) {
    const heckle = $('heckleMeter');
    const plate = document.querySelector('.heckle-plate');
    if (on) {
      if (heckle) {
        heckle.classList.add('audience-gauge');
        portraitMove(plate, heckle);
        portraitMove(heckle, $('portraitMeters'));
      }
    } else if (heckle) heckle.classList.remove('audience-gauge'); // restorePortraitHomes() already put the moved nodes back
  }
  function portraitCopy() {
    const on = portraitLayout();
    const title = $('doubtTitle');
    const kind = title.dataset.kind || '의심';
    const name = title.dataset.audience || '';
    const full = name ? `${name}의 ${kind}` : title.textContent;
    const next = on ? kind : full;
    if (title.dataset.audience && title.textContent !== next) title.textContent = next;
    const heckle = document.querySelector('.heckle-plate > span');
    if (heckle) { const label = on ? '야유' : '관객의 야유'; if (heckle.textContent !== label) heckle.textContent = label; }
    let nameEl = $('doubtName');
    const left = $('portraitMeters') && $('portraitMeters').querySelector('.meter-left');
    if (on && left) {
      if (!nameEl) { nameEl = element('span', '', 'doubt-name'); nameEl.id = 'doubtName'; }
      left.prepend(nameEl);
      if (nameEl.textContent !== name) nameEl.textContent = name;
      nameEl.hidden = !name;
    } else if (nameEl) nameEl.remove();
  }
  function showBookButton(on) {
    const book = $('bookButton');
    if (!book) return;
    if (on) {
      book.hidden = false;
      book.style.setProperty('display', 'inline-flex', 'important');
      book.removeAttribute('aria-hidden');
      book.removeAttribute('tabindex');
      book.textContent = '비법';
      delete book.dataset.pxText;
    } else {
      book.style.removeProperty('display');
      book.hidden = true;
      book.setAttribute('aria-hidden', 'true');
      book.tabIndex = -1;
    }
  }
  function ensureActionDock() {
    let dock = $('actionDock');
    if (!dock) {
      dock = element('div', '', 'action-dock');
      dock.id = 'actionDock';
      dock.setAttribute('role', 'group');
      dock.setAttribute('aria-label', '비법, 연습 모드, 실크 상점, 도감, 메뉴');
      $('activeSkills').append(dock);
    }
    dock.hidden = false;
    return dock;
  }
  function ensureSkillRow() {
    let row = $('skillRow');
    if (!row) {
      row = element('div', '', 'skill-row');
      row.id = 'skillRow';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', '스킬');
    }
    const skills = $('activeSkills');
    for (const button of [...skills.querySelectorAll(':scope > .active-skill')]) {
      if (button.id === 'gemShopQuick') continue;
      row.append(button);
    }
    if (!row.originalOrder) row.originalOrder = [...row.children];
    if (row.parentNode !== skills) skills.prepend(row);
    for (const id of ['skill-cardrain', 'skill-showtime', 'skill-cheer']) if ($(id)?.parentNode === row) row.append($(id));
    row.hidden = false;
    return row;
  }
  function releaseSkillRow() {
    const row = $('skillRow');
    if (!row) return;
    const skills = $('activeSkills');
    const dock = $('actionDock');
    for (const button of [...row.children].sort((a,b) => row.originalOrder.indexOf(a) - row.originalOrder.indexOf(b))) {
      if (dock && dock.parentNode === skills) skills.insertBefore(button, dock);
      else skills.append(button);
    }
    row.remove();
  }
  function dressTopDogam() {
    const button = $('bestiaryButton');
    if (!button) return;
    clearKitFace(button);
    button.classList.add('top-dogam');
    button.setAttribute('aria-label', '도감');
    let ico = button.querySelector(':scope > img.top-dogam-ico');
    if (!ico) {
      button.replaceChildren();
      ico = document.createElement('img');
      ico.className = 'top-dogam-ico';
      ico.alt = '';
      ico.width = 20;
      ico.height = 20;
      ico.draggable = false;
      button.append(ico,element('span','도감','top-dogam-label'));
    }
    if (ico.getAttribute('src') !== 'assets/kit/icon-collection.webp') ico.src = 'assets/kit/icon-collection.webp';
    delete button.dataset.pxText;
  }
  function placePortraitDock() {
    const dock = ensureActionDock();
    ensureSkillRow();
    showBookButton(true);
    moveChrome($('bookButton'), dock);
    if ($('gemShopQuick')) moveChrome($('gemShopQuick'), dock);
    if ($('practiceButton')) { $('practiceButton').hidden = false; moveChrome($('practiceButton'), dock); }
    // s4c: one button row; 정리 and 옷장 live in the menu sheet (review3 P1-6).
    moveChrome($('caseArrangeButton'), $('phoneMore'));
    moveChrome($('wardrobeButton'), $('phoneMore'));
    moveChrome($('moreButton'), dock);
    delete $('moreButton').dataset.pxText;
    $('moreButton').setAttribute('aria-label', '메뉴');
    $('bookButton').setAttribute('aria-label', '비법');
    if ($('gemShopQuick')) $('gemShopQuick').setAttribute('aria-label', '실크 상점');
    if ($('practiceButton')) $('practiceButton').setAttribute('aria-label', '연습 모드');
    dressTopDogam();
    moveChrome($('bestiaryButton'), dock);
    // #skillRow, then the dock, in one row (portrait.css s4c block stacks 비법 over 연습 모드 and 도감 over 메뉴).
    $('activeSkills').append(dock);
    dressPortraitButtons();
    // s5f (owner option 4): 칼리 덱 is the fourth action tile of the row (after 카드 비, 마술 모자, 비둘기), not a 메뉴 sheet item.
    const glove = $('item-auto-glove');
    if (glove) {
      if (!chromeHomes.has(glove)) chromeHomes.set(glove, { parent: $('activeSkills'), next: null });
      if (glove.parentNode !== $('skillRow') || glove.nextElementSibling) $('skillRow').append(glove);
      if (!glove.classList.contains('kit-btn')) glove.classList.add('kit-btn');
    }
  }
  function clearKitFace(button) {
    if (!button) return;
    button.classList.remove('kit-btn');
    for (const node of button.querySelectorAll(':scope > .kit-ico, :scope > .kit-label, :scope > small[data-kit]')) node.remove();
    // Put back the label text that dressKitButton() took out.
    if (button.dataset.kitText !== undefined) {
      if (button.dataset.kitText && ![...button.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) button.append(button.dataset.kitText);
      delete button.dataset.kitText;
    }
    delete button.dataset.pxText;
  }
  function dressKitButton(button, src, label) {
    if (!button) return;
    button.classList.add('kit-btn');
    let ico = button.querySelector(':scope > img.kit-ico');
    if (!ico) {
      ico = document.createElement('img');
      ico.className = 'kit-ico';
      ico.alt = '';
      ico.draggable = false;
      button.prepend(ico);
    }
    if (ico.getAttribute('src') !== src) ico.src = src;
    let lab = button.querySelector(':scope > .kit-label');
    if (!lab) {
      lab = document.createElement('span');
      lab.className = 'kit-label';
      const small = button.querySelector(':scope > small');
      if (small) button.insertBefore(lab, small); else button.append(lab);
    }
    if (lab.textContent !== label) lab.textContent = label;
    if (!button.querySelector(':scope > small')) { const small = document.createElement('small'); small.dataset.kit = '1'; button.append(small); }
    const text = [...button.childNodes].filter(node => node.nodeType === 3 && node.textContent.trim());
    if (button.dataset.kitText === undefined) button.dataset.kitText = text.map(node => node.textContent).join('');
    for (const node of text) node.remove();
  }
  function dressPortraitButtons() {
    dressKitButton($('bookButton'), 'assets/kit/icon-secret.webp', '비법');
    dressKitButton($('gemShopQuick'), 'assets/kit/icon-silk-shop.webp', '실크 상점');
    dressKitButton($('practiceButton'), 'assets/kit/icon-practice.webp', '연습 모드');
    dressKitButton($('caseArrangeButton'), 'assets/kit/icon-sort.webp', '정리');
    dressKitButton($('moreButton'), 'assets/kit/icon-menu.webp', '메뉴');
    dressKitButton($('bestiaryButton'), 'assets/kit/icon-collection.webp', '도감');
    dressKitButton($('wardrobeButton'), 'assets/kit/icon-wardrobe.webp', '옷장');
    // kit-btn right after active-skill, so a button dressed again after a rotation has a fresh load's class order.
    for (const button of document.querySelectorAll('#skillRow > .active-skill')) if (!button.classList.contains('kit-btn')) { const [first, ...rest] = button.classList; button.className = [first, 'kit-btn', ...rest].join(' '); }
  }
  // Overlay faces preserve each landscape button's original text metrics and hit box.
  function dressSharedButtons(portraitNow) {
    const faces=[['bookButton','icon-secret','비법'],['bestiaryButton','icon-collection','도감'],
      ['moreButton','icon-menu','메뉴'],['practiceButton','icon-practice','연습 모드'],
      ['caseArrangeButton','icon-sort','케이스 정리'],['caseArrangeMenuButton','icon-sort','케이스 정리'],
      ['gemShopButton','icon-silk-shop','실크 상점'],['wardrobeButton','icon-wardrobe','옷장']];
    for(const [id,icon,label] of faces){
      const button=$(id);if(!button)continue;
      let face=button.querySelector(':scope > .shared-kit-face');
      button.classList.toggle('shared-kit',!portraitNow);
      if(portraitNow){face?.remove();continue;}
      if(!face){
        face=element('span','','shared-kit-face');face.setAttribute('aria-hidden','true');
        const art=element('img');art.src=icon==='wardrobe'?'assets/icon-wardrobe-64.webp':icon?`assets/kit/${icon}.webp`:'assets/cur-silk.webp';art.alt='';art.draggable=false;
        face.append(art,element('span',label));button.append(face);
      }
      button.setAttribute('aria-label',label);
    }
  }
