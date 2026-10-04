/* Appearance-only preferences: no effect values or performance state are changed. */
(function (root) {
  'use strict';
  var profiles = {
    stopwatch: { name: 'KAIROS', container: '#settings-card', targets: '#p-time-display, #l-time-display', labels: [{ selector: '#p-tabs .tab-world > span', name: '세계 시계 이름' }], story: ["오래 남는 결정적 순간에서 KAIROS라는 이름을 가져왔어요.", "우연히 멈춘 듯한 시간이 가장 알맞은 때였으면 했어요."] },
    unlock: { name: 'RELEASE', container: '#settings-screen .settings-inner', targets: '#time-face', targetSelection: 'clock', labels: [{ selector: '#emergency > span', name: '잠금 화면 안내 이름', dynamic: true, selection: 'pin' }, { selector: '#prompt', name: 'PIN 안내 문구', dynamic: true, selection: 'pin' }, { selector: '#delete', name: '취소 버튼 문구', dynamic: true, selection: 'pin', idleOnly: true }], elements: [{ id: 'pin', name: 'PIN 화면', preview: '#input-screen', hit: '#keypad, #prompt, #emergency' }, { id: 'clock', name: '리와인드 시계', preview: '#time-lock', hit: '#time-face' }], story: ["봉인해제처럼, 잠금이 열리며 안의 이야기도 열리길 바랐어요.", "숫자 하나가 시간과 기억의 문을 여는 열쇠예요."], note: '미리보기에서 PIN 화면이나 리와인드 시계를 누르면 그 요소의 크기와 위치만 나와요. 잠금·해제 배경은 기존 사진 정렬 설정에서 맞춰 주세요.' },
    calculator: { name: 'HITSUZEN', container: '#date-settings', targets: '.display-wrap', targetSelection: 'result', labels: [], elements: [{ id: 'result', name: '계산 결과', preview: '#app', hit: '.display-wrap' }, { id: 'keypad', name: '계산 버튼', preview: '#app', hit: '.keypad' }], story: ["히츠젠은 필연. 자유롭게 계산해도 하나의 결과로 이어져요.", "흘러간 과정이 처음부터 그 결론을 향했던 마술이에요."], note: '미리보기에서 계산 결과나 계산 버튼을 누르면 그 요소의 크기와 위치만 나와요. 계산 내용과 버튼 동작은 그대로예요.' },
    choice: { name: '너의 선택은?', container: '#settings .shell', targets: '#fake-notes-title', labels: [{ selector: '#fake-notes-title', name: '메모 화면 이름', dynamic: true }], story: ["멀리 떨어진 선택과 결과가 보이지 않는 실로 이어져요.", "선택은 자유로웠지만, 인연은 이미 있었어요."] },
    aletheia: { name: 'ALETHEIA', container: '#settings .settings-inner', targets: '', labels: [], story: ["가려져 있던 진실이, 처음부터 거기 있었던 것처럼 드러나요.", "베일을 걷으면 새로 만들지 않고 발견하는 마술이에요."], note: '공연 이미지는 내 사진 세트에서, 지우는 범위와 칸 미리보기는 공연 설정에서 조절해 주세요.' },
    tobira: { name: 'TOBIRA', container: '#settings .sheet', targets: '', labels: [], story: ["토비라는 문. 화면과 현실 사이를 드나드는 작은 문이에요.", "안쪽 물건이 나왔다 돌아가는, 잠깐 열린 문이에요."], note: '선택한 물건의 크기와 시작 위치를 조절해요. 공연 중 화면을 탭하면 그 위치에 물건이 나타납니다.' },
    usotsuki: { name: 'USOTSUKI', container: '#settings-screen', targets: '#performance-title', labels: [{ selector: '#performance-title', name: '검사 화면 이름' }], story: ["우소츠키는 거짓말쟁이. 숨긴 마음이 작은 신호로 새어 나와요.", "웃으며 시작해도, 마지막엔 들킨 것 같은 느낌이 남아요."] },
    asrai: { name: '아스라이', container: '#settings-screen .settings-wrap', targets: '#contact-list-screen .list-header > h1', labels: [{ selector: '#contact-list-screen .list-header > h1', name: '연락처 목록 이름' }], story: ["아스라이처럼, 기억은 사라지기보다 잠깐 멀어져요.", "많은 흔적 속에서 한 사람만 다시 선명해져요."], note: '크기와 위치는 연락처 목록 이름에 적용돼요. 이름·번호·지역·메모는 기존 연락처 설정에서 준비해 주세요.' },
    'false-memory': { name: 'FALSE MEMORY', container: '#settings-screen .settings-panel', targets: '.result-title', labels: [{ selector: '.result-title', name: '사진 설명 이름' }], story: ["기억은 지금 정보로 다시 만들어져요. 자연스러운 화면이 기억을 흔들어요.", "처음부터 이랬나 싶은, 기억의 균열을 보여 주는 마술이에요."] },
    alter: { name: 'ALTER', container: '#settings .settings-panel', targets: '#setup .tagline', labels: [{ selector: '#setup .tagline', name: '시작 화면 문구' }], story: ["같은 존재도 보는 방식이 달라지면 다른 얼굴을 보여요.", "카메라가 현실의 또 다른 얼굴을 비추는 창이 돼요."], note: '크기와 위치는 시작 화면 문구에 적용돼요. 카메라 속 카드의 정렬은 유지하고 밝기는 기존 설정에서 맞춰 주세요.' },
    spinner: { name: 'TYCHE', container: '#settings .settings-panel', targets: '#wheel-wrap', labels: [{ selector: '.status-brand', name: '회전판 이름' }], story: ["티케는 우연. 누구 편도 아닌 우연이 한 번만 방향을 가져요.", "운명이라기엔 짧고, 우연이라기엔 정확한 순간이에요."] }
  };
  var parts = {
    stopwatch: [{ selector: '#p-buttons', name: '시작·랩 버튼' }, { selector: '#p-tabs', name: '하단 메뉴' }],
    unlock: [{ selector: '#keypad', name: 'PIN 버튼', selection: 'pin' }, { selector: '#prompt', name: 'PIN 안내', selection: 'pin' }],
    calculator: [{ selector: '.keypad', name: '계산 버튼', selection: 'keypad' }],
    usotsuki: [{ selector: '.signal-monitor', name: '신호 모니터' }, { selector: '#detector-button', name: '길게 누르기 버튼' }]
  };
  var previews = { stopwatch: '#portrait-app', unlock: '#input-screen', calculator: '#app', choice: '#fake-home', aletheia: '#stage', tobira: '#stage', usotsuki: '#performance-screen', asrai: '#contact-list-screen', 'false-memory': '#performance-screen', alter: '#setup', spinner: '.stage' };
  Object.keys(profiles).forEach(function (app) { profiles[app].parts = parts[app] || []; profiles[app].preview = previews[app]; });
  function sanitize(value, profile) {
    value = value && typeof value === 'object' ? value : {};
    var number = function (v, fallback, min, max) { return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback; };
    var result = { scale: number(value.scale, 100, 70, 140), offset: number(value.offset, 0, -12, 12), x: number(value.x, 0, -12, 12), labels: {}, parts: {} };
    (profile.labels || []).forEach(function (label) {
      var text = value.labels && value.labels[label.selector];
      if (typeof text === 'string') result.labels[label.selector] = text.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40);
    });
    (profile.parts || []).forEach(function (part) {
      var saved = value.parts && value.parts[part.selector];
      if (saved && typeof saved === 'object') result.parts[part.selector] = { scale: number(saved.scale, 100, 70, 130), offset: number(saved.offset, 0, -8, 8), x: number(saved.x, 0, -8, 8) };
    });
    return result;
  }
  function storageKey(app, location) { var pathname = location.pathname.replace(/^\/tools\/release(?=\/|$)/, '/tools/unlock').replace(/^\/tools\/hitsuzen(?=\/|$)/, '/tools/calc').replace(/^\/tools\/kairos-classic(?=\/|$)/, '/tools/stopwatch').replace(/^\/tools\/kairos(?=\/|$)/, '/tools/stopwatch-uni').replace(/^\/tools\/tyche(?=\/|$)/, '/tools/spinner'); return 'magic-appearance:v1:' + app + ':' + location.origin + pathname; }
  function load(storage, key, profile) {
    var raw;
    try { raw = storage.getItem(key); } catch (_) { return { status: 'unreadable', raw: null, value: sanitize(null, profile) }; }
    if (raw === null) return { status: 'missing', raw: null, value: sanitize(null, profile) };
    try {
      var value = JSON.parse(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid appearance');
      return { status: 'valid', raw: raw, value: sanitize(value, profile) };
    } catch (_) { return { status: 'invalid', raw: raw, value: sanitize(null, profile) }; }
  }
  function read(storage, key, profile) { return load(storage, key, profile).value; }
  function write(storage, key, value, profile) { var loaded = load(storage, key, profile); if (loaded.status === 'invalid' || loaded.status === 'unreadable') return false; try { storage.setItem(key, JSON.stringify(sanitize(value, profile))); return true; } catch (_) { return false; } }
  function reset(storage, key) { try { storage.removeItem(key); return true; } catch (_) { return false; } }
  function clipOffset(rect, viewport, dx, dy) { return { x: Math.max(8 - rect.left, Math.min(viewport.width - 8 - rect.right, dx)), y: Math.max(8 - rect.top, Math.min(viewport.height - 8 - rect.bottom, dy)) }; }
  /* Horizontal percent uses the face's visible width; vertical uses its visible height. Portrait rotation swaps those screen axes. */
  function screenDelta(xPercent, yPercent, viewport, rotated) {
    var xAmount = (Number(xPercent) || 0) / 100 * (rotated ? viewport.height : viewport.width);
    var yAmount = (Number(yPercent) || 0) / 100 * (rotated ? viewport.width : viewport.height);
    return rotated ? { x: -yAmount, y: xAmount } : { x: xAmount, y: yAmount };
  }
  function translateFor(delta, rotated) { return rotated ? delta.y + 'px ' + (-delta.x) + 'px' : delta.x + 'px ' + delta.y + 'px'; }
  function controlVisible(controlSelection, selectedId, selective) { return !selective || controlSelection === selectedId; }
  function customizationAllowed(pathname, flag) { return flag !== 'off' && !/^\/tools(?:\/|$)/i.test(pathname || '') && !(pathname || '').includes('/distribution-snapshots/'); }
  var api = { customizationAllowed: customizationAllowed, profiles: profiles, sanitize: sanitize, storageKey: storageKey, load: load, read: read, write: write, reset: reset, clipOffset: clipOffset, screenDelta: screenDelta, translateFor: translateFor, controlVisible: controlVisible };
  root.MagicSettingsUI = api;
  if (!root.document) return;
  function mount() {
    if (root.location.hash.indexOf('selftest') !== -1 || /(?:[?&])selftest(?:=|&|$)/.test(root.location.search)) return;
    var doc = root.document;
    var app = doc.body.dataset.magicApp;
    if (!profiles[app]) {
      var mapping = { 'stopwatch-uni': 'stopwatch', 'calculator-v2': 'calculator' };
      var path = root.location.pathname.match(/magic-([^/]+)/);
      app = path && (mapping[path[1]] || path[1]);
    }
    var profile = profiles[app];
    if (!profile) return;
    var container = doc.querySelector('[data-settings-root], [data-magic-settings-container]') || doc.querySelector(profile.container);
    if (!container || container.querySelector('.magic-overview')) return;
    var customizeEnabled = customizationAllowed(root.location.pathname, doc.body.dataset.magicCustomize);
    function node(tag, text, className) { var el = doc.createElement(tag); if (text != null) el.textContent = text; if (className) el.className = className; return el; }
    function removeRepeatedDisclosureLabels(scope) {
      Array.from(scope.querySelectorAll('details > summary')).forEach(function (summary) {
        var title = (summary.textContent || '').replace(/\s+/g, ' ').trim();
        if (title !== '화면 디자인') return;
        var details = summary.parentElement;
        Array.from(details.querySelectorAll('label')).forEach(function (label) {
          var selects = label.querySelectorAll('select'), controls = label.querySelectorAll('input, select, textarea, button');
          if (selects.length !== 1 || controls.length !== 1) return;
          var prefix = [], beforeSelect = true;
          Array.from(label.childNodes).forEach(function (child) {
            if (child === selects[0]) { beforeSelect = false; return; }
            if (beforeSelect && child.nodeType === 3) prefix.push(child);
            else if (beforeSelect && child.nodeType === 1) prefix.push(null);
          });
          if (prefix.length !== 1 || !prefix[0] || prefix[0].nodeValue.replace(/\s+/g, ' ').trim() !== title) return;
          if (!selects[0].getAttribute('aria-label')) selects[0].setAttribute('aria-label', title);
          label.removeChild(prefix[0]);
        });
      });
    }
    function group(title, className) { var el = node('details', null, 'magic-settings-group ' + className); el.appendChild(node('summary', title)); return el; }
    var overview = group('개요', 'magic-overview');
    overview.appendChild(node('h2', profile.name));
    profile.story.forEach(function (text) { overview.appendChild(node('p', text)); });
    overview.appendChild(node('p', customizeEnabled ? '같이 쓰거나 선물하려고 만들었어요. 화면은 조금씩 바꿀 수 있어요.' : '같이 쓰거나 선물하려고 만들었어요. 편하게 즐겨 주세요.'));
    function contactHref(nav) {
  var code = 'eshVqDvk7WKk0zDKtiC9UTa.T6Q-', ua = nav.userAgent || '';
  if (/Android/i.test(ua)) return 'intent://viewer?#Intent;scheme=kakaotalkqrcode%3A%2F%2F' + code + ';action=android.intent.action.SEND;category=android.intent.category.BROWSABLE;package=com.kakao.talk;end;';
  if (/iPhone|iPad|iPod/i.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)) return 'kakaotalkqrcode://' + code;
  return 'https://qr.kakao.com/talk/' + code;
}
    var contactUrl = contactHref(root.navigator || {});
    var contactId = 'KaliDCerona';
    function fallbackCopy(text) {
      try {
        var area = doc.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.left = '-999px';
        doc.body.appendChild(area);
        area.select();
        var ok = doc.execCommand('copy');
        area.remove();
        return ok;
      } catch (_) { return false; }
    }
    function copyContactId(button) {
      function finish(ok) {
        button.textContent = ok ? '복사됨' : 'ID 복사';
        if (ok) root.setTimeout(function () { if (button.textContent === '복사됨') button.textContent = 'ID 복사'; }, 1500);
      }
      var clipboard = root.navigator && root.navigator.clipboard;
      if (clipboard && typeof clipboard.writeText === 'function') {
        clipboard.writeText(contactId).then(function () { finish(true); }, function () { finish(fallbackCopy(contactId)); });
        return;
      }
      finish(fallbackCopy(contactId));
    }
    function contactFooter() {
      var footer = node('div', null, 'magic-settings-footer');
      var heading = node('h2', '의견 보내기', 'magic-contact-heading');
      footer.appendChild(heading);
      var note = node('p', null, 'magic-contact-note');
      ['수정할 점이나 버그,', '새로운 아이디어가 있다면', '카카오톡으로 알려주세요.'].forEach(function (text) { note.appendChild(node('span', text)); });
      footer.appendChild(note);
      var actions = node('div', null, 'magic-contact-actions');
      var link = node('a', '카카오톡 문의', 'magic-contact-link');
      link.href = contactUrl;
      link.rel = 'noopener noreferrer';
      actions.appendChild(link);
      var copy = node('button', 'ID 복사', 'magic-contact-copy');
      copy.type = 'button';
      copy.addEventListener('click', function () { copyContactId(copy); });
      actions.appendChild(copy);
      footer.appendChild(actions);
      var help = node('details', null, 'magic-contact-help');
      help.appendChild(node('summary', '연결이 안 될 때'));
      var directions = node('p');
      ['카카오톡이 열리지 않으면', 'ID를 복사해 주세요.', '카카오톡 친구 추가에서', 'ID 검색을 선택한 뒤', '복사한 ID로 찾아 주세요.'].forEach(function (text) { directions.appendChild(node('span', text)); });
      help.appendChild(directions);
      help.appendChild(node('p', 'ID: ' + contactId, 'magic-contact-id'));
      footer.appendChild(help);
      return footer;
    }
    removeRepeatedDisclosureLabels(container);
    if (!customizeEnabled) { container.appendChild(overview); container.appendChild(contactFooter()); return; }
    var storage;
    try { storage = root.localStorage; } catch (_) { storage = null; }
    var key = storageKey(app, root.location), loadedAppearance = load(storage, key, profile), prefs = loadedAppearance.value, defaults = {};
    function recoveryNotice() { return '저장된 꾸미기를 읽지 못해 원본을 보존했어요. 저장하려면 꾸미기 초기화를 누르세요. 연출 설정은 유지돼요.'; }
    function appearanceBlocked() { return loadedAppearance.status === 'invalid' || loadedAppearance.status === 'unreadable'; }
    var link = node('div', null, 'magic-customize-link'), openCustomize = node('button', '화면 커스텀', 'magic-customize-open');
    openCustomize.type = 'button'; link.appendChild(openCustomize); container.appendChild(link);
    var customPage = node('section', null, 'magic-customize-page'); customPage.id = 'magic-customize-page'; customPage.hidden = true;
    customPage.setAttribute('role', 'dialog'); customPage.setAttribute('aria-modal', 'true'); customPage.setAttribute('aria-label', '화면 커스텀');
    var header = node('header', null, 'magic-customize-header'), back = node('button', '‹ 설정으로', 'magic-customize-back'); back.type = 'button';
    header.appendChild(back); header.appendChild(node('h1', '화면 커스텀')); header.appendChild(node('span', profile.name, 'magic-customize-product')); customPage.appendChild(header);
    var preview = node('div', null, 'magic-customize-preview'), phone = node('div', null, 'magic-preview-phone');
    preview.appendChild(node('p', '실시간 미리보기', 'magic-preview-label')); preview.appendChild(phone); customPage.appendChild(preview);
    var customize = node('div', null, 'magic-customize'); customPage.appendChild(customize); doc.body.appendChild(customPage);
    var previousFocus, previousUrl;
    function closeCustom() { customPage.hidden = true; if (app === 'calculator') { container.classList.add('open'); container.setAttribute('aria-hidden', 'false'); } if (app === 'spinner') { var settings = doc.querySelector('#settings'); if (settings) settings.hidden = false; } if (root.location.hash === '#customize' && root.history) root.history.replaceState(null, '', previousUrl || root.location.pathname + root.location.search); previousFocus?.focus?.(); }
    openCustomize.addEventListener('click', function () { previousFocus = doc.activeElement; syncNativeAppearance(); previousUrl = root.location.pathname + root.location.search + root.location.hash; customPage.hidden = false; if (root.history && root.location.hash !== '#customize') root.history.pushState(null, '', '#customize'); schedule(); back.focus?.(); });
    back.addEventListener('click', closeCustom);
    root.addEventListener('popstate', function () { if (root.location.hash !== '#customize' && !customPage.hidden) closeCustom(); });
    customPage.addEventListener('keydown', function (event) { if (event.key === 'Escape') { closeCustom(); event.stopPropagation(); } });
    ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'click'].forEach(function (type) { customPage.addEventListener(type, function (event) { event.stopPropagation(); }); });
    var selectedId = profile.elements && profile.elements[0] ? profile.elements[0].id : '';
    var previewSelector = profile.preview;
    var elementSelect = null;
    if (profile.elements && profile.elements.length) {
      previewSelector = profile.elements[0].preview || profile.preview;
      var previewLabel = node('label', '조정할 요소', 'magic-preview-select'); elementSelect = node('select');
      elementSelect.setAttribute('aria-label', '조정할 요소');
      profile.elements.forEach(function (item) { var option = node('option', item.name); option.value = item.id; elementSelect.appendChild(option); });
      previewLabel.appendChild(elementSelect); customize.appendChild(previewLabel);
      elementSelect.addEventListener('change', function () { choose(elementSelect.value); });
    }
    function choose(id) {
      if (!profile.elements) return;
      var item = null;
      profile.elements.forEach(function (entry) { if (entry.id === id) item = entry; });
      if (!item) return;
      var previousPreview = previewSelector;
      selectedId = id;
      previewSelector = item.preview || profile.preview;
      if (elementSelect) elementSelect.value = id;
      applySelection();
      if (previewSelector !== previousPreview) schedule();
    }
    var previewStyles;
    function updatePreview() {
      if (customPage.hidden || !root.getComputedStyle) return;
      var source = doc.querySelector(previewSelector), width = root.innerWidth, height = root.innerHeight;
      phone.replaceChildren();
      if (app === 'tobira' && root.MagicTobiraAppearance) {
        var model = root.MagicTobiraAppearance.preview(), sample = node('div', null, 'magic-object-preview'), object = node('div', null, 'magic-preview-object');
        var sampleHeight = Math.max(1, Math.min(preview.clientHeight - 24, (preview.clientWidth - 48) * height / width)); phone.style.height = sampleHeight + 'px'; phone.style.width = (sampleHeight * width / height) + 'px'; phone.style.aspectRatio = width + '/' + height;
        var art = node('img'); art.alt = '선택한 공연 물건'; art.src = model.image;
        sample.style.setProperty('--object-width', (Math.min(1, model.widthRatio) * Math.min(phone.clientWidth, phone.clientHeight)) + 'px');
        sample.style.setProperty('--object-x', (model.startX * 100) + '%'); sample.style.setProperty('--object-y', (model.startY * 100) + '%');
        object.appendChild(art); sample.appendChild(object); phone.appendChild(sample); return;
      }
      if (!source) { phone.appendChild(node('p', profile.name)); return; }
      if (!previewStyles) {
        previewStyles = Array.from(doc.styleSheets).map(function (sheet) { try { return Array.from(sheet.cssRules).map(function (rule) { return rule.cssText; }).join('\n'); } catch (_) { return ''; } }).join('\n')
          .replace(/:root/g, ':host').replace(/\bhtml\b/g, ':host').replace(/\bbody\b/g, '.magic-preview-body');
      }
      var surface = node('div', null, 'magic-preview-surface'); surface.style.width = width + 'px'; surface.style.height = height + 'px';
      var shadow = surface.attachShadow({ mode: 'open' }), style = node('style', previewStyles);
      style.textContent += '\n.magic-preview-body {position:relative !important;margin:0 !important;width:' + width + 'px !important;height:' + height + 'px !important;overflow:hidden !important;}';
      shadow.appendChild(style);
      var body = node('div', null, 'magic-preview-body'); body.style.color = root.getComputedStyle(doc.body).color; body.style.font = root.getComputedStyle(doc.body).font; shadow.appendChild(body);
      var ancestors = [], ancestor = source.parentElement;
      while (ancestor && ancestor !== doc.body) { ancestors.unshift(ancestor); ancestor = ancestor.parentElement; }
      var parent = body;
      ancestors.forEach(function (original) { var copy = original.cloneNode(false); copy.hidden = false; parent.appendChild(copy); parent = copy; });
      var clone = source.cloneNode(true); clone.hidden = false; parent.appendChild(clone);
      var originals = [source].concat(Array.from(source.querySelectorAll('*'))), copies = [clone].concat(Array.from(clone.querySelectorAll('*')));
      copies.forEach(function (copy, index) {
        copy.removeAttribute('autofocus'); copy.removeAttribute('tabindex'); copy.removeAttribute('for');
        Array.from(copy.attributes || []).forEach(function (attr) { if (/^on/i.test(attr.name)) copy.removeAttribute(attr.name); });
        if (/^(SCRIPT|STYLE|IFRAME|VIDEO|AUDIO)$/.test(copy.tagName) || originals[index].closest('[data-settings-root], .magic-customize-page, #settings-entry-tutorial, #install-nudge')) { copy.remove(); return; }
        if (copy.tagName === 'CANVAS' && originals[index].width && originals[index].height) { try { copy.getContext('2d').drawImage(originals[index], 0, 0); } catch (_) {} }
      });
      surface.inert = true; surface.setAttribute('aria-hidden', 'true'); surface.style.transform = 'scale(1)'; phone.appendChild(surface);
      if (app === 'unlock' && previewSelector === '#time-lock') { var now = new Date(); [['#time-hour', String(now.getHours()).padStart(2, '0')], ['#time-minute', String(now.getMinutes()).padStart(2, '0')]].forEach(function (item) { var el = shadow.querySelector(item[0]); if (el && !el.textContent.trim()) el.textContent = item[1]; }); }
      function previewLayout(selector, value) {
        Array.from(shadow.querySelectorAll(selector)).forEach(function (el) {
          var rotated = app === 'stopwatch' && el.id === 'l-time-display' && root.matchMedia && root.matchMedia('(orientation: portrait)').matches;
          var viewport = { width: width, height: height };
          el.style.removeProperty('scale'); el.style.removeProperty('translate');
          if ((value.scale || 100) === 100 && !(value.offset || 0) && !(value.x || 0)) return;
          function bounds() { if ((app === 'stopwatch' || app === 'unlock') && selector === profile.targets && el.textContent.trim()) { var range = doc.createRange(); range.selectNodeContents(app === 'unlock' ? (el.querySelector('#time-clock') || el) : el); return range.getBoundingClientRect(); } return el.getBoundingClientRect(); }
          var box = bounds(); if (!box.width || !box.height) return;
          el.style.scale = String(Math.min(value.scale / 100, (width - 16) / box.width, (height - 16) / box.height));
          var moved = bounds(), origin = surface.getBoundingClientRect();
          var rect = { left: moved.left - origin.left, right: moved.right - origin.left, top: moved.top - origin.top, bottom: moved.bottom - origin.top, width: moved.width, height: moved.height };
          var screen = screenDelta(value.x || 0, value.offset || 0, viewport, rotated);
          el.style.translate = translateFor(clipOffset(rect, viewport, screen.x, screen.y), rotated);
        });
      }
      if (profile.targets) previewLayout(profile.targets, prefs);
      (profile.parts || []).forEach(function (part) { previewLayout(part.selector, prefs.parts[part.selector] || { scale: 100, offset: 0, x: 0 }); });
      var fit = Math.min(phone.clientWidth / width, phone.clientHeight / height); surface.style.transform = 'scale(' + fit + ')';
      if (!profile.elements) return;
      var host = phone.getBoundingClientRect();
      profile.elements.forEach(function (item) {
        if ((item.preview || profile.preview) !== previewSelector) return;
        Array.from(shadow.querySelectorAll(item.hit)).forEach(function (el) {
          var rect = el.getBoundingClientRect(); if (!rect.width || !rect.height) return;
          var hit = node('button', '', 'magic-preview-hit'); hit.type = 'button';
          hit.setAttribute('data-selection', item.id); hit.setAttribute('aria-label', item.name + ' 선택'); hit.setAttribute('aria-pressed', item.id === selectedId ? 'true' : 'false');
          hit.style.left = (rect.left - host.left - (phone.clientLeft || 0)) + 'px'; hit.style.top = (rect.top - host.top - (phone.clientTop || 0)) + 'px'; hit.style.width = rect.width + 'px'; hit.style.height = rect.height + 'px';
          hit.addEventListener('click', function () { choose(item.id); }); phone.appendChild(hit);
        });
      });
    }
    customize.appendChild(node('p', profile.note || '크기와 위치는 화면의 표시 영역에만 적용돼요. 아래 이름도 원하는 문구로 바꿔 주세요.'));
    var targets = profile.targets ? Array.from(doc.querySelectorAll(profile.targets)) : [];
    var controls = [];
    function field(title, type, value, min, max, options) {
      options = options || {};
      var label = node('label', title, 'magic-appearance-field'), input = node('input');
      if (options.selection) label.setAttribute('data-selection', options.selection);
      input.type = type;
      if (type === 'range') { input.min = min; input.max = max; input.step = 1; } else { input.maxLength = 40; input.autocomplete = 'off'; }
      input.value = value;
      var output = node('output'), row = node('div', null, 'magic-range-row'), unit = options.unit || (min >= 0 ? '%' : 'vh');
      if (type === 'range') { var minus = node('button', '−'), plus = node('button', '+'); minus.type = plus.type = 'button'; minus.setAttribute('aria-label', title + ' 줄이기'); plus.setAttribute('aria-label', title + ' 늘리기'); [minus, plus].forEach(function (button, index) { button.addEventListener('click', function () { input.value = Number(input.value) + (index ? 1 : -1) * (Number(input.step) || 1); input.dispatchEvent(new root.Event('input', { bubbles: true })); }); }); row.appendChild(minus); row.appendChild(input); row.appendChild(plus); label.appendChild(row); } else label.appendChild(input); label.appendChild(output); customize.appendChild(label); controls.push(input);
      function update() { if (type === 'range') output.textContent = (options.ratio ? Math.round(Number(input.value) * 100) : input.value) + unit; }
      input.addEventListener('input', update); update(); return input;
    }
    var scale = field('표시 크기', 'range', prefs.scale, 70, 140, { selection: profile.targetSelection, unit: '%' }), offset = field('위아래 위치', 'range', prefs.offset, -12, 12, { selection: profile.targetSelection, unit: 'vh' }), axisX = field('좌우 위치', 'range', prefs.x, -12, 12, { selection: profile.targetSelection, unit: 'vw' });
    var nativeAppearanceFields = [], syncingNativeAppearance = false;
    if (app === 'tobira') {
      [['coinSize', '#coin-size', '물건 크기'], ['startX', '#start-x', '시작 위치 · 좌우'], ['startY', '#start-y', '시작 위치 · 위아래']].forEach(function (item) {
        var original = doc.querySelector(item[1]); if (!original) return;
        var input = field(item[2], 'range', original.value || original.min, Number(original.min), Number(original.max), { unit: '%', ratio: true });
        input.step = original.step || '0.01'; nativeAppearanceFields.push({ name: item[0], original: original, input: input });
        input.addEventListener('input', function () { if (syncingNativeAppearance || !root.MagicTobiraAppearance) return; var value = {}; nativeAppearanceFields.forEach(function (entry) { value[entry.name] = Number(entry.input.value); }); Promise.resolve(root.MagicTobiraAppearance.update(value)).then(schedule).catch(function () { status.textContent = '물건 설정을 저장하지 못했어요. 다시 시도해 주세요.'; }); });
      });
    }
    function syncNativeAppearance() { if (!nativeAppearanceFields.length || !root.MagicTobiraAppearance) return; var value = root.MagicTobiraAppearance.read(); syncingNativeAppearance = true; nativeAppearanceFields.forEach(function (entry) { entry.input.min = entry.original.min; entry.input.max = entry.original.max; entry.input.step = entry.original.step; entry.input.value = value[entry.name]; entry.input.dispatchEvent(new root.Event('input')); }); syncingNativeAppearance = false; }
    if (!profile.targets) { [scale, offset, axisX].forEach(function (input) { input.parentElement.hidden = true; }); }
    var labelFields = profile.labels.map(function (label) {
      var el = doc.querySelector(label.selector); if (!el) return null;
      defaults[label.selector] = el.dataset.magicNativeLabel || el.textContent;
      return { definition: label, element: el, input: field(label.name, 'text', prefs.labels[label.selector] || defaults[label.selector], null, null, { selection: label.selection }) };
    }).filter(Boolean);
    var partFields = (profile.parts || []).map(function (part) {
      var elements = Array.from(doc.querySelectorAll(part.selector)); if (!elements.length) return null;
      var heading = node('h2', part.name, 'magic-customize-subtitle'); if (part.selection) heading.setAttribute('data-selection', part.selection); customize.appendChild(heading);
      var saved = prefs.parts[part.selector] || { scale: 100, offset: 0, x: 0 };
      return { definition: part, elements: elements, scale: field(part.name + ' 크기', 'range', saved.scale, 70, 130, { selection: part.selection, unit: '%' }), offset: field(part.name + ' 위아래 위치', 'range', saved.offset, -8, 8, { selection: part.selection, unit: 'vh' }), x: field(part.name + ' 좌우 위치', 'range', saved.x || 0, -8, 8, { selection: part.selection, unit: 'vw' }) };
    }).filter(Boolean);
    function applySelection() {
      if (!profile.elements || typeof customize.querySelectorAll !== 'function') return;
      Array.from(customize.querySelectorAll('[data-selection]')).forEach(function (el) { el.hidden = !controlVisible(el.getAttribute('data-selection'), selectedId, true); });
      Array.from(phone.querySelectorAll('.magic-preview-hit')).forEach(function (hit) { hit.setAttribute('aria-pressed', hit.getAttribute('data-selection') === selectedId ? 'true' : 'false'); });
    }
    function applyLabels() { labelFields.forEach(function (item) {
      var definition = item.definition, el = item.element;
      if (el.dataset.magicNativeLabel != null) { defaults[definition.selector] = el.dataset.magicNativeLabel; if (!prefs.labels[definition.selector]) item.input.value = defaults[definition.selector]; }
      if (definition.idleOnly && el.dataset.magicCustomIdle !== 'true') return;
      var value = prefs.labels[definition.selector] || defaults[definition.selector];
      if (el.textContent !== value) el.textContent = value;
    }); }
    var pending = false;
    function schedule() { if (!pending) { pending = true; root.requestAnimationFrame(function () { pending = false; applyLayout(); updatePreview(); }); } }
    function applyLayout() {
      targets.forEach(function (el) {
        var rotated = app === 'stopwatch' && el.id === 'l-time-display' && root.matchMedia && root.matchMedia('(orientation: portrait)').matches;
        el.style.removeProperty('scale'); el.style.removeProperty('translate');
        if (prefs.scale === 100 && prefs.offset === 0 && !prefs.x) return;
        function visualRect() {
          if ((el.children.length === 0 || app === 'stopwatch' || app === 'unlock') && el.textContent.trim()) { var range = doc.createRange(); range.selectNodeContents(app === 'unlock' ? (el.querySelector('#time-clock') || el) : el); return range.getBoundingClientRect(); }
          return el.getBoundingClientRect();
        }
        var base = visualRect(); if (!base.width || !base.height) return;
        var viewport = { width: root.innerWidth, height: root.innerHeight };
        var s = Math.min(prefs.scale / 100, (viewport.width - 16) / base.width, (viewport.height - 16) / base.height);
        el.style.scale = String(Math.max(0.01, s));
        var rect = visualRect();
        var screen = screenDelta(prefs.x || 0, prefs.offset, viewport, rotated);
        el.style.translate = translateFor(clipOffset(rect, viewport, screen.x, screen.y), rotated);
      });
      partFields.forEach(function (part) { var value = prefs.parts[part.definition.selector] || { scale: 100, offset: 0, x: 0 }; part.elements.forEach(function (el) { var rotated = app === 'stopwatch' && el.id === 'l-time-display' && root.matchMedia && root.matchMedia('(orientation: portrait)').matches; el.style.removeProperty('scale'); el.style.removeProperty('translate'); if (value.scale === 100 && value.offset === 0 && !(value.x || 0)) return; var base = el.getBoundingClientRect(), viewport = { width: root.innerWidth, height: root.innerHeight }; var factor = base.width && base.height ? Math.min(value.scale / 100, (viewport.width - 16) / base.width, (viewport.height - 16) / base.height) : value.scale / 100; el.style.scale = String(factor); var rect = el.getBoundingClientRect(); var screen = screenDelta(value.x || 0, value.offset || 0, viewport, rotated); el.style.translate = translateFor(clipOffset(rect, viewport, screen.x, screen.y), rotated); }); });
      /* The stopwatch's native hit zones recalculate from the displayed rectangle. */
      doc.dispatchEvent(new root.CustomEvent('magic-appearance-change', { detail: { app: app } }));
    }
    var actions = node('div', null, 'magic-appearance-actions'), save = node('button', '저장'), clear = node('button', '꾸미기 초기화'), status = node('p', '', 'magic-appearance-status');
    save.type = clear.type = 'button'; if (app === 'tobira' && !appearanceBlocked()) clear.hidden = true; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    actions.appendChild(save); actions.appendChild(clear); customize.appendChild(actions); customize.appendChild(status);
    if (appearanceBlocked()) status.textContent = recoveryNotice();
    function collect() { var value = { scale: Number(scale.value), offset: Number(offset.value), x: Number(axisX.value), labels: {}, parts: {} }; labelFields.forEach(function (item) { if (item.input.value !== defaults[item.definition.selector]) value.labels[item.definition.selector] = item.input.value; }); partFields.forEach(function (part) { value.parts[part.definition.selector] = { scale: Number(part.scale.value), offset: Number(part.offset.value), x: Number(part.x.value) }; }); prefs = sanitize(value, profile); applyLabels(); schedule(); }
    controls.forEach(function (input) { input.addEventListener('input', collect); });
    save.addEventListener('click', function () { collect(); if (appearanceBlocked()) { status.textContent = recoveryNotice(); return; } var saved = write(storage, key, prefs, profile); if (!saved) loadedAppearance = load(storage, key, profile); status.textContent = saved ? '이 기기에 저장했어요.' : appearanceBlocked() ? recoveryNotice() : '화면에는 적용했어요. 이 브라우저에서는 저장할 수 없어요.'; if (saved) closeCustom(); });
    clear.addEventListener('click', function () { prefs = sanitize(null, profile); scale.value = 100; offset.value = 0; axisX.value = 0; partFields.forEach(function (part) { part.scale.value = 100; part.offset.value = 0; part.x.value = 0; }); labelFields.forEach(function (item) { item.input.value = defaults[item.definition.selector]; }); controls.filter(function (input) { return input.type === 'range'; }).forEach(function (input) { input.dispatchEvent(new root.Event('input')); }); var removed = reset(storage, key); if (removed) loadedAppearance = { status: 'missing', raw: null, value: prefs }; applyLabels(); schedule(); status.textContent = removed ? '꾸미기를 처음 모습으로 돌렸어요.' : '처음 모습으로 돌렸어요. 저장된 설정은 지울 수 없어요.'; });
    container.appendChild(overview);
    container.appendChild(contactFooter());
    applyLabels(); applySelection(); schedule();
    if (root.location.hash === '#customize') { customPage.hidden = false; syncNativeAppearance(); schedule(); }
    root.addEventListener('load', function () { syncNativeAppearance(); schedule(); });
    root.addEventListener('resize', schedule); root.addEventListener('orientationchange', schedule);
    if (typeof root.ResizeObserver === 'function') { var sizeObserver = new root.ResizeObserver(schedule); targets.forEach(function (el) { sizeObserver.observe(el); }); }
    if (typeof root.MutationObserver === 'function') {
      /* Watch visibility on known target ancestors, never the whole document subtree. */
      var visibility = new root.MutationObserver(schedule), observed = new Set();
      (profile.elements || [{ preview: profile.preview }]).forEach(function (item) { var el = doc.querySelector(item.preview); if (el) { visibility.observe(el, { attributes: true, attributeFilter: ['hidden', 'class'] }); observed.add(el); } });
      targets.concat(partFields.flatMap(function (part) { return part.elements; })).forEach(function (el) { for (var ancestor = el.parentElement; ancestor && ancestor !== doc.body; ancestor = ancestor.parentElement) { if (!observed.has(ancestor)) { observed.add(ancestor); visibility.observe(ancestor, { attributes: true, attributeFilter: ['hidden', 'class'] }); } } });
      labelFields.forEach(function (item) { if (item.definition.dynamic) new root.MutationObserver(function () { applyLabels(); schedule(); }).observe(item.element, { attributes: true, attributeFilter: ['data-magic-native-label', 'data-magic-custom-idle'], childList: true, characterData: true, subtree: true }); });
    }
  }
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})(typeof window === 'undefined' ? globalThis : window);
