/* Appearance-only preferences: no effect values or performance state are changed. */
(function (root) {
  'use strict';
  var profiles = {
    stopwatch: { name: 'KAIROS', container: '#settings-card', targets: '#p-time-display, #l-time-display', labels: [{ selector: '#p-tabs .tab-world > span', name: '세계 시계 이름' }], story: ["흘러가는 시간 중에도\n유난히 오래 남는\n순간이 있잖아요.\nKAIROS는 그런 결정적인\n순간에서 이름을 가져왔어요.", "우연히 멈춘 것 같은 시간이\n사실 가장 알맞은 때였다는\n이야기를 만들고 싶었어요."] },
    unlock: { name: 'RELEASE', container: '#settings-screen .settings-inner', targets: '#time-face', targetSelection: 'clock', labels: [{ selector: '#emergency > span', name: '잠금 화면 안내 이름', dynamic: true, selection: 'pin' }, { selector: '#prompt', name: 'PIN 안내 문구', dynamic: true, selection: 'pin' }, { selector: '#delete', name: '취소 버튼 문구', dynamic: true, selection: 'pin', idleOnly: true }], elements: [{ id: 'pin', name: 'PIN 화면', preview: '#input-screen', hit: '#keypad, #prompt, #emergency' }, { id: 'clock', name: '리와인드 시계', preview: '#time-lock', hit: '#time-face' }], story: ["카드캡터 사쿠라의 봉인해제,\n레리즈에서 이름을 가져왔어요.\n잠금이 풀리는 순간,\n그 안에 있던 이야기도 함께\n열리는 느낌이 좋았거든요.", "하나의 숫자가 열쇠가 돼서\n닫혀 있던 시간과 기억의 문을\n여는 순간을 만들고 싶었어요."], note: '미리보기에서 PIN 화면이나 리와인드 시계를 누르면 그 요소의 크기와 위치만 나와요. 잠금·해제 배경은 기존 사진 정렬 설정에서 맞춰 주세요.' },
    calculator: { name: 'HITSUZEN', container: '#date-settings', targets: '.display-wrap', targetSelection: 'result', labels: [], elements: [{ id: 'result', name: '계산 결과', preview: '#app', hit: '.display-wrap' }, { id: 'keypad', name: '계산 버튼', preview: '#app', hit: '.keypad' }], story: ["HITSUZEN은 일본어로\n필연이라는 뜻이에요.\n마음대로 선택하고 계산했는데\n마지막엔 하나의 결과로\n이어지는 장면에서 시작했어요.", "자유롭게 흘러간 과정이\n처음부터 그 결론을 향하고\n있었던 것 같은 마술을\n만들고 싶었어요."], note: '미리보기에서 계산 결과나 계산 버튼을 누르면 그 요소의 크기와 위치만 나와요. 계산 내용과 버튼 동작은 그대로예요.' },
    choice: { name: '너의 선택은?', container: '#settings .shell', targets: '#fake-notes-title', labels: [{ selector: '#fake-notes-title', name: '메모 화면 이름', dynamic: true }], story: ["너의 이름은의 무스비와\n붉은 실에서 시작했어요.\n서로 멀리 떨어진 선택과 결과가\n보이지 않는 실로 이어져 있다는\n느낌이 좋았어요.", "선택은 자유로웠지만\n인연은 이미 있었던 것 같은\n순간을 만들고 싶었어요."] },
    aletheia: { name: 'ALETHEIA', container: '#settings .settings-inner', targets: '', labels: [], story: ["ALETHEIA는 가려져 있던\n진실이 드러난다는 이미지에서\n가져왔어요. 보이지 않았을 뿐,\n처음부터 거기에 있었던 것처럼\n말이에요.", "베일을 걷었을 때 무언가를\n새로 만드는 대신 발견하는\n느낌의 마술을 만들고 싶었어요."], note: '공연 이미지는 내 사진 세트에서, 지우는 범위와 칸 미리보기는 공연 설정에서 조절해 주세요.' },
    tobira: { name: 'TOBIRA', container: '#settings .sheet', targets: '#settings .sheet > h1', labels: [{ selector: '#settings .sheet > h1', name: '준비 화면 이름' }], story: ["TOBIRA는 일본어로\n문이라는 뜻이에요.\n화면 속 세계와 현실 사이에도\n드나들 수 있는 작은 문이 있다면\n어떨까 생각했어요.", "안쪽의 물건이 밖으로 나오고\n다시 돌아가는, 두 세계 사이의\n문이 잠깐 열린 것 같은 마술을\n만들고 싶었어요."], note: '크기와 위치는 준비 화면 이름에 적용돼요. 공연 물건은 기존 크기 설정과 두 손가락 확대·축소로 맞춰 주세요.' },
    usotsuki: { name: 'USOTSUKI', container: '#settings-screen', targets: '#performance-title', labels: [{ selector: '#performance-title', name: '검사 화면 이름' }], story: ["USOTSUKI는 일본어로\n거짓말쟁이라는 뜻이에요.\n완벽하게 숨겼다고 생각했는데\n작은 신호 하나로 새어 나오는\n순간에서 시작했어요.", "웃으면서 시작했는데\n마지막에는 정말 들킨 건가 싶은\n느낌이 남는 마술을\n만들고 싶었어요."] },
    asrai: { name: '아스라이', container: '#settings-screen .settings-wrap', targets: '#contact-list-screen .list-header > h1', labels: [{ selector: '#contact-list-screen .list-header > h1', name: '연락처 목록 이름' }], story: ["멀고 희미한 것이 어렴풋하게\n보이는 아스라이라는 말을\n기억과 연결해 봤어요.\n기억은 사라지기보다 잠깐\n멀어지는 것 같거든요.", "많은 사람의 흔적 사이에서\n한 사람만 다시 선명해지는,\n잊힌 흔적을 되찾는 마술을\n만들고 싶었어요."], note: '크기와 위치는 연락처 목록 이름에 적용돼요. 이름·번호·지역·메모는 기존 연락처 설정에서 준비해 주세요.' },
    'false-memory': { name: 'FALSE MEMORY', container: '#settings-screen .settings-panel', targets: '.result-title', labels: [{ selector: '.result-title', name: '사진 설명 이름' }], story: ["기억은 그대로 남는 기록보다\n지금의 정보로 다시 만들어지는\n것 같아요. 분명 다르게 봤는데\n지금 화면이 너무 자연스러우면\n기억부터 흔들리잖아요.", "처음부터 이랬던 건 아닐까 하는\n질문이 남는, 현실보다 기억의\n균열을 보여 주는 마술을\n만들고 싶었어요."] },
    alter: { name: 'ALTER', container: '#settings .settings-panel', targets: '#setup .tagline', labels: [{ selector: '#setup .tagline', name: '시작 화면 문구' }], story: ["페르소나와 또 다른 자아에서\n시작했어요. 같은 존재도\n보는 방식이 달라지면\n전혀 다른 얼굴을 보여 줄 수\n있다고 생각했거든요.", "카메라가 단순한 기록 장치가\n아니라 현실의 또 다른 얼굴을\n비추는 창이 되는 마술을\n만들고 싶었어요."], note: '크기와 위치는 시작 화면 문구에 적용돼요. 카메라 속 카드의 정렬은 유지하고 밝기는 기존 설정에서 맞춰 주세요.' },
    spinner: { name: 'TYCHE', container: '#settings .settings-panel', targets: '#wheel-wrap', labels: [{ selector: '.status-brand', name: '회전판 이름' }], story: ["TYCHE는 우연과 행운의\n이미지에서 가져온\n이름이에요.\n누구 편도 아닌 우연이\n단 한 번만 방향을 갖는다면\n어떨까 생각했어요.", "운명이라 하기엔 너무 짧고\n우연이라 하기엔\n너무 정확한\n순간을 만들고 싶었어요."] }
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
  function read(storage, key, profile) { try { return sanitize(JSON.parse(storage.getItem(key)), profile); } catch (_) { return sanitize(null, profile); } }
  function write(storage, key, value, profile) { try { storage.setItem(key, JSON.stringify(sanitize(value, profile))); return true; } catch (_) { return false; } }
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
  var api = { profiles: profiles, sanitize: sanitize, storageKey: storageKey, read: read, write: write, reset: reset, clipOffset: clipOffset, screenDelta: screenDelta, translateFor: translateFor, controlVisible: controlVisible };
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
    var storage;
    try { storage = root.localStorage; } catch (_) { storage = null; }
    var key = storageKey(app, root.location), prefs = read(storage, key, profile), defaults = {};
    function node(tag, text, className) { var el = doc.createElement(tag); if (text != null) el.textContent = text; if (className) el.className = className; return el; }
    function group(title, className) { var el = node('details', null, 'magic-settings-group ' + className); el.appendChild(node('summary', title)); return el; }
    var overview = group('개요', 'magic-overview');
    overview.appendChild(node('h2', profile.name));
    profile.story.forEach(function (text) { overview.appendChild(node('p', text)); });
    overview.appendChild(node('p', '친구들과 같이 즐기거나\n선물해 주려고 만들었어요.\n각자 편한 화면으로 조금씩\n바꿔서 써 주세요.'));
    var link = node('div', null, 'magic-customize-link'), openCustomize = node('button', '화면 커스텀', 'magic-customize-open');
    openCustomize.type = 'button'; openCustomize.setAttribute('data-fullscreen-skip', ''); link.appendChild(openCustomize); container.appendChild(link);
    var customPage = node('section', null, 'magic-customize-page'); customPage.id = 'magic-customize-page'; customPage.hidden = true;
    customPage.setAttribute('role', 'dialog'); customPage.setAttribute('aria-modal', 'true'); customPage.setAttribute('aria-label', '화면 커스텀'); customPage.setAttribute('data-fullscreen-skip', '');
    var header = node('header', null, 'magic-customize-header'), back = node('button', '‹ 설정으로', 'magic-customize-back'); back.type = 'button';
    header.appendChild(back); header.appendChild(node('h1', '화면 커스텀')); header.appendChild(node('span', profile.name, 'magic-customize-product')); customPage.appendChild(header);
    var preview = node('div', null, 'magic-customize-preview'), phone = node('div', null, 'magic-preview-phone');
    preview.appendChild(node('p', '실시간 미리보기', 'magic-preview-label')); preview.appendChild(phone); customPage.appendChild(preview);
    var customize = node('div', null, 'magic-customize'); customPage.appendChild(customize); doc.body.appendChild(customPage);
    var previousFocus, previousUrl;
    function closeCustom() { customPage.hidden = true; if (root.location.hash === '#customize' && root.history) root.history.replaceState(null, '', previousUrl || root.location.pathname + root.location.search); previousFocus?.focus?.(); }
    openCustomize.addEventListener('click', function () { previousFocus = doc.activeElement; previousUrl = root.location.pathname + root.location.search + root.location.hash; customPage.hidden = false; if (root.history && root.location.hash !== '#customize') root.history.pushState(null, '', '#customize'); schedule(); back.focus?.(); });
    back.addEventListener('click', closeCustom);
    root.addEventListener('popstate', function () { if (root.location.hash !== '#customize') { customPage.hidden = true; previousFocus?.focus?.(); } });
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
      if (type === 'range') { var minus = node('button', '−'), plus = node('button', '+'); minus.type = plus.type = 'button'; minus.setAttribute('aria-label', title + ' 줄이기'); plus.setAttribute('aria-label', title + ' 늘리기'); [minus, plus].forEach(function (button, index) { button.addEventListener('click', function () { input.value = Number(input.value) + (index ? 1 : -1); input.dispatchEvent(new root.Event('input', { bubbles: true })); }); }); row.appendChild(minus); row.appendChild(input); row.appendChild(plus); label.appendChild(row); } else label.appendChild(input); label.appendChild(output); customize.appendChild(label); controls.push(input);
      function update() { if (type === 'range') output.textContent = input.value + unit; }
      input.addEventListener('input', update); update(); return input;
    }
    var scale = field('표시 크기', 'range', prefs.scale, 70, 140, { selection: profile.targetSelection, unit: '%' }), offset = field('위아래 위치', 'range', prefs.offset, -12, 12, { selection: profile.targetSelection, unit: 'vh' }), axisX = field('좌우 위치', 'range', prefs.x, -12, 12, { selection: profile.targetSelection, unit: 'vw' });
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
    save.type = clear.type = 'button'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    actions.appendChild(save); actions.appendChild(clear); customize.appendChild(actions); customize.appendChild(status);
    function collect() { var value = { scale: Number(scale.value), offset: Number(offset.value), x: Number(axisX.value), labels: {}, parts: {} }; labelFields.forEach(function (item) { if (item.input.value !== defaults[item.definition.selector]) value.labels[item.definition.selector] = item.input.value; }); partFields.forEach(function (part) { value.parts[part.definition.selector] = { scale: Number(part.scale.value), offset: Number(part.offset.value), x: Number(part.x.value) }; }); prefs = sanitize(value, profile); applyLabels(); schedule(); }
    controls.forEach(function (input) { input.addEventListener('input', collect); });
    save.addEventListener('click', function () { collect(); status.textContent = write(storage, key, prefs, profile) ? '이 기기에 저장했어요.' : '화면에는 적용했어요. 이 브라우저에서는 저장할 수 없어요.'; });
    clear.addEventListener('click', function () { prefs = sanitize(null, profile); scale.value = 100; offset.value = 0; axisX.value = 0; partFields.forEach(function (part) { part.scale.value = 100; part.offset.value = 0; part.x.value = 0; }); labelFields.forEach(function (item) { item.input.value = defaults[item.definition.selector]; }); controls.filter(function (input) { return input.type === 'range'; }).forEach(function (input) { input.dispatchEvent(new root.Event('input')); }); var removed = reset(storage, key); applyLabels(); schedule(); status.textContent = removed ? '꾸미기를 처음 모습으로 돌렸어요.' : '처음 모습으로 돌렸어요. 저장된 설정은 지울 수 없어요.'; });
    container.appendChild(overview);
    container.appendChild(node('p', '수정이 필요하거나 버그를 발견하셨다면, 개선할 점이나 새로운 아이디어가 있으셔도 카카오톡 KaliDCerona로 연락해 주세요.', 'magic-settings-footer'));
    applyLabels(); applySelection(); schedule();
    if (root.location.hash === '#customize') { customPage.hidden = false; schedule(); }
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
