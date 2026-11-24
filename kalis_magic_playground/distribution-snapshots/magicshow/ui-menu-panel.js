// Presentation-only menu grouping. Originals retain their IDs, listeners and unlock state.
(function installMenuPanel() {
  'use strict';
  const $ = id => document.getElementById(id);
  const sheet = $('phoneMore');
  if (!sheet) return;
  const proxies = new Map();
  const groups = {
    menuPrepareItems: ['bookButton', 'equipButton', 'bestiaryButton', 'rebirthButton', 'missionsButton', 'gemShopButton', 'mapButton', 'statsButton', 'practiceButton', 'storyButton', 'endingReplayButton'],
    menuTogetherItems: ['coffeeButton', 'openChatButton'],
    menuAudio: ['soundButton', 'musicButton', 'musicVolume', 'hapticsButton'],
    menuDisplay: ['textSpeedButton', 'reduceMotionButton', 'caseArrangeButton', 'customizeButton'],
    menuUtilityItems: ['saveSlotsButton', 'replayTutorial', 'installButton'],
    menuExit: ['retreatButton']
  };
  const labels = { bookButton: '비법', bestiaryButton: '도감', mapButton: '무대 지도', statsButton: '능력치', practiceButton: '연습 모드', caseArrangeButton: '케이스 정리' };
  let settings = false, wasOpen = false, lastEntry = null;
  const outside = new Map();
  function isolate(open, target = sheet) {
    if (!open) {
      for (const [node, inert] of outside) node.inert = inert;
      outside.clear();
      return;
    }
    for (let branch = target; branch.parentElement; branch = branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling === branch || sibling.id === 'touchRotateGuard' || outside.has(sibling)) continue;
        outside.set(sibling, sibling.inert);
        sibling.inert = true;
      }
      if (branch.parentElement === document.body) break;
    }
  }
  const visible = el => !el.disabled && !el.closest('[hidden]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const controls = () => [...sheet.querySelectorAll('button, input, select, [tabindex="0"]')].filter(visible);
  function settingsView(on, focus = true) {
    settings = on;
    $('menuHome').hidden = on;
    $('menuSettingsPanel').hidden = !on;
    $('menuSettingsBack').hidden = !on;
    $('menuSettings').setAttribute('aria-expanded', String(on));
    $('moreTitle').textContent = on ? '설정' : '메뉴';
    sheet.classList.toggle('more-in-settings', on);
    sheet.scrollTop = 0;
    if (focus) (on ? $('menuSettingsBack') : $('menuSettings')).focus();
  }
  function sync() {
    const stage = $('stage'), scale = stage.getBoundingClientRect().width / stage.offsetWidth || 1;
    sheet.style.setProperty('--more-scale', scale);
    sheet.style.setProperty('--more-inverse', 1 / scale);
    for (const [hostId, ids] of Object.entries(groups)) {
      const host = $(hostId);
      let at = host.querySelector(':scope > legend') ? 1 : 0;
      const place = node => {
        if (host.children[at] !== node) host.insertBefore(node, host.children[at] || null);
        at++;
      };
      for (const id of ids) {
        const source = $(id);
        if (!source) continue;
        const node = id === 'musicVolume' ? source.closest('label') : source;
        // HUD controls stay where the existing responsive layout places them.
        // A menu shortcut forwards to the exact original listener, never game logic.
        if (!sheet.contains(node)) {
          let proxy = proxies.get(id);
          if (!proxy) {
            proxy = document.createElement('button');
            proxy.type = 'button'; proxy.id = id + 'Menu';
            proxy.addEventListener('click', () => source.click());
            proxies.set(id, proxy);
          }
          proxy.textContent = labels[id] || source.textContent;
          proxy.hidden = source.hidden;
          proxy.disabled = source.disabled;
          if (source.hasAttribute('aria-pressed')) proxy.setAttribute('aria-pressed', source.getAttribute('aria-pressed'));
          place(proxy);
        } else {
          const proxy = proxies.get(id);
          if (proxy) { proxy.remove(); proxies.delete(id); }
          place(node);
          const label = node.querySelector('.kit-label');
          if (label && labels[id]) label.textContent = labels[id];
        }
      }
    }
    const build = sheet.querySelector('[data-game-build]');
    if (build && build.parentNode !== $('menuUtilities')) $('menuUtilities').append(build);
    $('menuGroupPlay').hidden = true;
    $('menuGroupSettings').hidden = true;
  }
  function close() {
    settingsView(false, false);
    $('closeMore').click(); // The original hideMore handler owns the close state.
  }
  $('menuContinue').addEventListener('click', close);
  $('closeMore').addEventListener('click', () => settingsView(false, false));
  $('menuSettings').addEventListener('click', () => settingsView(true));
  $('menuSettingsBack').addEventListener('click', () => settingsView(false));
  for (const [trigger, target] of [['menuPrepare', 'menuPrepareItems'], ['menuTogether', 'menuTogetherItems']]) {
    $(trigger).addEventListener('click', () => {
      const open = $(target).hidden;
      $(target).hidden = !open;
      $(trigger).setAttribute('aria-expanded', String(open));
    });
  }
  sheet.addEventListener('click', e => {
    const button = e.target.closest('button');
    if (button && !['closeMore', 'menuContinue'].includes(button.id)) lastEntry = button;
  }, true);
  // The existing sheet contract is hidden/aria-expanded, shared by pause and panel-return paths.
  new MutationObserver(() => {
    const open = !sheet.hidden;
    if (open !== wasOpen) {
      wasOpen = open;
      isolate(open, $('practicePrompt').hidden ? sheet : $('practicePrompt'));
      if (open) {
        sync();
        const focus = !$('practicePrompt').hidden ? $('practiceStart') : lastEntry && visible(lastEntry) ? lastEntry : settings ? $('menuSettingsBack') : $('menuContinue');
        focus.focus();
      } else if (!$('leaveConfirm').hidden) {
        $('leaveStay').focus();
      } else if (!$('introStory').hidden) {
        [...$('introStory').querySelectorAll('button')].find(visible)?.focus();
      } else if (!$('panel').hidden && !$('panel').contains(document.activeElement)) {
        const target = [$('closePanel'), ...$('panel').querySelectorAll('button,input,select')].find(visible);
        target?.focus({ preventScroll: true });
      } else if (sheet.contains(document.activeElement) && $('panel').hidden) {
        $('moreButton').focus();
      }
    }
  }).observe(sheet, { attributes: true, attributeFilter: ['hidden'] });
  // Practice is an existing sibling modal that can open above the menu without hiding it.
  new MutationObserver(() => {
    if (sheet.hidden) return;
    isolate(false);
    const prompt = $('practicePrompt');
    isolate(true, prompt.hidden ? sheet : prompt);
    if (!prompt.hidden) $('practiceStart').focus();
    else (lastEntry && visible(lastEntry) ? lastEntry : $('menuContinue')).focus();
  }).observe($('practicePrompt'), { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('keydown', e => {
    if (!sheet.hidden && !$('practicePrompt').hidden) {
      if (e.key === 'Escape') { e.preventDefault(); $('practiceDismiss').click(); }
      if (e.key === 'Tab') {
        const first = $('practiceStart'), last = $('practiceDismiss');
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      e.stopImmediatePropagation();
      return;
    }
    if (sheet.hidden || !$('panel').hidden || !$('leaveConfirm').hidden || !$('touchRotateGuard').hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (settings) settingsView(false); else close();
    } else if (e.key === 'Tab') {
      const items = controls(), first = items[0], last = items[items.length - 1];
      if (!items.length) { e.preventDefault(); sheet.focus(); }
      else if (!sheet.contains(document.activeElement) || (e.shiftKey && document.activeElement === first)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      e.stopImmediatePropagation();
    } else {
      // Do not run game shortcuts while navigating the menu or adjusting a slider.
      e.stopPropagation();
    }
  }, true);
  $('moreButton').setAttribute('aria-controls', 'phoneMore');
  window.MagicShowMenu = { sync };
  sync();
})();
