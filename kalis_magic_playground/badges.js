(function () {
  var escapeHtml = window.PgUtil.escapeHtml;
  var fetchJson = window.PgUtil.fetchJson;

  var BADGES = {
    expert: { label: '전문가', className: 'kali-badge--expert' },
    god: { label: '마술의 신', className: 'kali-badge--god' },
    admin: { label: '칼리', className: 'kali-badge--kali' },
    kali: { label: '칼리', className: 'kali-badge--kali' }
  };

  function badgeHtml(role) {
    var key = String(role || '').trim().toLowerCase();
    var badge = BADGES[key];
    if (!badge) return '';
    return '<span class="kali-badge ' + badge.className + '">' + badge.label + '</span>';
  }

  var BADGE_META = {
    user: { label: '브론즈 깃털', description: '첫 질문, 배움의 시작' },
    supporter_3000: { label: '은빛 편지', description: '질문을 남기고 기록소에 작은 마음을 보탠 사람' },
    supporter_10000: { label: '금장 책갈피', description: '오래 남을 질문과 기록을 함께 쌓는 사람' },
    supporter_50000: { label: '오리할콘 열쇠', description: '기록소의 문을 함께 지키는 수호자' },
    expert: { label: '브론즈 촛불', description: '질문에 답을 비춰주는 첫 안내자' },
    expert_3000: { label: '은빛 봉인등', description: '신뢰 있는 답변자이자 기록소에 마음을 보탠 사람' },
    expert_10000: { label: '금빛 기록등', description: '오래 남을 답변과 지식을 보관하는 안내자' },
    expert_50000: { label: '오리할콘 수호등', description: '기록소를 지키는 상급 안내자' },
    kali: { label: '칼리의 루비 문장', description: '칼리형' },
    hecate: { label: '마술의 신', description: '마술의 신 — 헤카테의 열쇠 문양' },
    hecate_2: { label: '마술의 신', description: '마술의 신 — 삼월 문양' }
  };

  var BADGE_CODES = Object.keys(BADGE_META);
  var BADGE_IMAGE_BASE = 'assets/playground/badges/';

  function imageBadgesHtml(codes) {
    var list = Array.isArray(codes) ? codes : [];
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var meta = BADGE_META[list[i]];
      if (!meta) continue;
      html += '<img class="kali-badge-img" src="' + BADGE_IMAGE_BASE + encodeURIComponent(list[i]) + '.webp" ' +
        'alt="' + escapeHtml(meta.label) + '" title="' + escapeHtml(meta.label) + '" loading="lazy">';
    }
    return html;
  }

  var STYLE_ID = 'kali-badge-popover-style';
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '[data-author-id]{cursor:pointer;}' +
      '.kali-badge-img{width:18px;height:18px;border-radius:50%;object-fit:cover;margin-right:2px;vertical-align:middle;}' +
      '.kali-member-popover{position:fixed;z-index:9999;min-width:220px;max-width:280px;padding:14px;' +
      'background:#1c1009;border:1px solid rgba(201,154,91,0.4);border-radius:12px;color:#f3ece3;' +
      'box-shadow:0 12px 32px rgba(0,0,0,0.45);font-size:13px;line-height:1.5;}' +
      '.kali-member-popover__name{font-weight:700;margin-bottom:8px;font-size:14px;}' +
      '.kali-member-popover__badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;}' +
      '.kali-member-popover__badge{display:flex;align-items:center;gap:4px;padding:3px 8px;' +
      'border:1px solid rgba(201,154,91,0.3);border-radius:999px;background:rgba(201,154,91,0.08);}' +
      '.kali-member-popover__empty{opacity:0.7;margin-bottom:8px;}' +
      '.kali-member-popover__admin{margin-top:8px;padding-top:8px;border-top:1px dashed rgba(201,154,91,0.3);}' +
      '.kali-member-popover__toggle{display:flex;align-items:center;justify-content:space-between;gap:6px;' +
      'width:100%;padding:4px 6px;margin-bottom:4px;background:transparent;border:1px solid rgba(201,154,91,0.25);' +
      'border-radius:8px;color:#f3ece3;font-size:12px;cursor:pointer;text-align:left;}' +
      '.kali-member-popover__toggle[data-granted="true"]{background:rgba(201,154,91,0.18);}' +
      '.kali-member-popover__toggle:disabled{opacity:0.5;cursor:wait;}';
    document.head.appendChild(style);
  }

  var activePopover = null;
  var activeOutsideHandler = null;
  var activeKeyHandler = null;

  function closePopover() {
    if (activePopover && activePopover.parentNode) activePopover.parentNode.removeChild(activePopover);
    activePopover = null;
    if (activeOutsideHandler) document.removeEventListener('mousedown', activeOutsideHandler, true);
    if (activeKeyHandler) document.removeEventListener('keydown', activeKeyHandler, true);
    activeOutsideHandler = null;
    activeKeyHandler = null;
  }

  async function getViewerRole() {
    if (!window.MagicAuth) return null;
    try {
      var session = await window.MagicAuth.getSession();
      if (!session) return null;
      var profile = await fetchJson('/.netlify/functions/profile');
      return profile.role || null;
    } catch {
      return null;
    }
  }

  function positionPopover(popover, anchorEl) {
    var rect = anchorEl.getBoundingClientRect();
    var top = rect.bottom + 8;
    var left = rect.left;
    var maxLeft = window.innerWidth - 296;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    if (top + 260 > window.innerHeight) top = Math.max(8, rect.top - 268);
    popover.style.top = top + 'px';
    popover.style.left = left + 'px';
  }

  function renderBadgeList(container, codes) {
    container.innerHTML = '';
    var list = Array.isArray(codes) ? codes : [];
    if (list.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'kali-member-popover__empty';
      empty.textContent = '아직 배지가 없어요';
      container.appendChild(empty);
      return;
    }
    var wrap = document.createElement('div');
    wrap.className = 'kali-member-popover__badges';
    list.forEach(function (code) {
      var meta = BADGE_META[code];
      if (!meta) return;
      var item = document.createElement('span');
      item.className = 'kali-member-popover__badge';
      item.innerHTML = imageBadgesHtml([code]) + '<span>' + escapeHtml(meta.label) + '</span>';
      item.title = meta.description || '';
      wrap.appendChild(item);
    });
    container.appendChild(wrap);
  }

  function renderAdminControls(container, userId, currentCodes, onChange) {
    container.innerHTML = '';
    var granted = new Set(currentCodes || []);
    var heading = document.createElement('div');
    heading.className = 'kali-member-popover__admin';
    heading.textContent = '배지 부여/회수';
    container.appendChild(heading);

    BADGE_CODES.forEach(function (code) {
      var meta = BADGE_META[code];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kali-member-popover__toggle';
      btn.setAttribute('data-granted', granted.has(code) ? 'true' : 'false');
      btn.innerHTML = '<span>' + imageBadgesHtml([code]) + escapeHtml(meta.label) + '</span><span>' +
        (granted.has(code) ? '회수' : '부여') + '</span>';
      btn.addEventListener('click', async function () {
        btn.disabled = true;
        try {
          var action = granted.has(code) ? 'revoke' : 'grant';
          var result = await fetchJson('/.netlify/functions/admin-badges', {
            method: 'POST',
            body: JSON.stringify({ userId: userId, badgeCode: code, action: action })
          });
          onChange(result.badges || []);
        } catch (error) {
          window.alert(error.message || '배지 변경에 실패했어요');
        } finally {
          btn.disabled = false;
        }
      });
      container.appendChild(btn);
    });
  }

  async function openMemberPopover(options) {
    var userId = options && options.userId;
    var nickname = (options && options.nickname) || '마술인';
    var anchorEl = options && options.anchorEl;
    if (!userId || !anchorEl) return;

    closePopover();
    ensureStyle();

    var popover = document.createElement('div');
    popover.className = 'kali-member-popover';

    var nameEl = document.createElement('div');
    nameEl.className = 'kali-member-popover__name';
    nameEl.textContent = nickname;
    popover.appendChild(nameEl);

    var badgeListEl = document.createElement('div');
    popover.appendChild(badgeListEl);

    var adminEl = document.createElement('div');
    popover.appendChild(adminEl);

    document.body.appendChild(popover);
    positionPopover(popover, anchorEl);
    activePopover = popover;

    activeOutsideHandler = function (event) {
      if (popover.contains(event.target) || anchorEl.contains(event.target)) return;
      closePopover();
    };
    activeKeyHandler = function (event) {
      if (event.key === 'Escape') closePopover();
    };
    document.addEventListener('mousedown', activeOutsideHandler, true);
    document.addEventListener('keydown', activeKeyHandler, true);

    var currentCodes = [];
    try {
      var data = await fetchJson('/.netlify/functions/member-badges?userId=' + encodeURIComponent(userId));
      currentCodes = (data.badges || []).map(function (badge) { return badge.code; });
      if (data.nickname) nameEl.textContent = data.nickname;
    } catch {
      // 배지 조회 실패해도 팝오버 자체는 유지
    }
    renderBadgeList(badgeListEl, currentCodes);

    var viewerRole = await getViewerRole();
    if (viewerRole === 'admin' || viewerRole === 'kali') {
      var refreshAdmin = function (nextCodes) {
        currentCodes = nextCodes;
        renderBadgeList(badgeListEl, currentCodes);
        renderAdminControls(adminEl, userId, currentCodes, refreshAdmin);
      };
      renderAdminControls(adminEl, userId, currentCodes, refreshAdmin);
    }
  }

  function bindAuthorCells(root) {
    ensureStyle();
    var container = root || document;
    container.addEventListener('click', function (event) {
      var target = event.target.closest('[data-author-id]');
      if (!target || !container.contains(target)) return;
      var userId = target.getAttribute('data-author-id');
      if (!userId) return;
      var nickname = target.getAttribute('data-author-nickname') || target.textContent || '마술인';
      openMemberPopover({ userId: userId, nickname: nickname, anchorEl: target });
    });
  }

  window.KalisBadges = {
    badgeHtml: badgeHtml,
    BADGE_META: BADGE_META,
    imageBadgesHtml: imageBadgesHtml,
    openMemberPopover: openMemberPopover,
    bindAuthorCells: bindAuthorCells
  };
})();
