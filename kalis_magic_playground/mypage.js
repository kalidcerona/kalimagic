(function () {
  var state = { session: null, profile: null, mmbsRequest: null, badgeData: null, questBadgeData: null, tab: 'posts' };
  var profileEl = document.querySelector('[data-mypage-profile]');
  var inviteEl = document.querySelector('[data-mypage-invite]');
  var mmbsEl = document.querySelector('[data-mypage-mmbs]');
  var badgeEl = document.querySelector('[data-mypage-badges]');
  var questBadgeEl = document.querySelector('[data-mypage-quest-badges]');
  var tabsEl = document.querySelector('[data-mypage-tabs]');
  var listEl = document.querySelector('[data-mypage-list]');
  var tabLabels = {
    posts: '내가 쓴 글',
    received: '받은 답변',
    given: '해준 답변'
  };
  var emptyMessages = {
    posts: '아직 글이 없어요',
    received: '아직 받은 답변이 없어요',
    given: '아직 해준 답변이 없어요'
  };
  var questTrackLabels = {
    questions: '질문',
    answers: '답변',
    answer_helpful_votes: '도움됐어요',
    free_posts: '자유 기록',
    event_reviews: '모임 기록',
    tool_reviews: '도구 기록',
    invites: '초대',
    total_records: '전체 기록'
  };
  var questTrackOrder = [
    'questions',
    'answers',
    'answer_helpful_votes',
    'free_posts',
    'event_reviews',
    'tool_reviews',
    'invites',
    'total_records'
  ];
  var QUEST_BADGE_SEEN_STORAGE_KEY = 'kalimagic_seen_quest_badges_v1';
  var SPONSOR_BADGE_SEEN_STORAGE_KEY = 'kalimagic_seen_sponsor_badges_v1';
  var sponsorComingSoonOverlayText = {
    supporter_3000: '3천원 후원시 공개',
    supporter_10000: '1만원 후원시 공개',
    supporter_50000: '5만원 후원시 공개',
    expert_3000: '3천원 후원시 공개',
    expert_10000: '1만원 후원시 공개',
    expert_50000: '5만원 후원시 공개'
  };
  var badgeCelebrationQueue = [];
  var badgeCelebrationVisible = false;

  var el = window.PgUtil.el;
  var clear = window.PgUtil.clear;
  var fetchJson = window.PgUtil.fetchJson;
  var formatDate = window.PgUtil.formatDate;

  function uniqueBadgeCodes(codes) {
    var seen = {};
    var unique = [];
    (codes || []).forEach(function (code) {
      var cleanCode = String(code || '').trim();
      if (!cleanCode || seen[cleanCode]) return;
      seen[cleanCode] = true;
      unique.push(cleanCode);
    });
    return unique;
  }

  function diffNewlyOwnedBadgeCodes(previousSeenCodes, ownedNowCodes) {
    var ownedNow = uniqueBadgeCodes(ownedNowCodes);
    if (!Array.isArray(previousSeenCodes)) {
      return { newlyOwnedCodes: [], seenCodes: ownedNow, seeded: true };
    }

    var previousSeen = uniqueBadgeCodes(previousSeenCodes);
    var previousSeenMap = {};
    previousSeen.forEach(function (code) {
      previousSeenMap[code] = true;
    });

    var newlyOwnedCodes = ownedNow.filter(function (code) {
      return !previousSeenMap[code];
    });
    return {
      newlyOwnedCodes: newlyOwnedCodes,
      seenCodes: uniqueBadgeCodes(previousSeen.concat(ownedNow)),
      seeded: false
    };
  }

  function readSeenBadgeCodes(storageKey) {
    try {
      if (!window.localStorage) return null;
      var raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function writeSeenBadgeCodes(storageKey, codes) {
    try {
      if (!window.localStorage) return false;
      window.localStorage.setItem(storageKey, JSON.stringify(uniqueBadgeCodes(codes)));
      return true;
    } catch (error) {
      return false;
    }
  }

  function ownedBadgeCodes(catalog) {
    return uniqueBadgeCodes((catalog || [])
      .filter(function (badge) { return badge && badge.owned; })
      .map(function (badge) { return badge.code; }));
  }

  function newlyOwnedBadges(storageKey, catalog) {
    var diff = diffNewlyOwnedBadgeCodes(readSeenBadgeCodes(storageKey), ownedBadgeCodes(catalog));
    if (!writeSeenBadgeCodes(storageKey, diff.seenCodes)) return [];
    if (!diff.newlyOwnedCodes.length) return [];

    var badgeByCode = {};
    (catalog || []).forEach(function (badge) {
      if (badge && badge.code) badgeByCode[badge.code] = badge;
    });
    return diff.newlyOwnedCodes.map(function (code) {
      return badgeByCode[code];
    }).filter(Boolean);
  }

  function categoryLabel(value) {
    var labels = {
      question: '질문',
      event_review: '모임 후기',
      review: '리뷰',
      review_comment: '리뷰',
      free: '자유게시판',
      routine: '마술 보관소',
      magazine: '매거진'
    };
    return labels[value] || value || '기록';
  }

  function postUrl(id) {
    return '/p/' + encodeURIComponent(id);
  }

  function goToPost(id) {
    if (!id) return;
    window.location.href = postUrl(id);
  }

  function showLogin() {
    clear(profileEl);
    profileEl.hidden = true;
    if (inviteEl) clear(inviteEl);
    if (mmbsEl) clear(mmbsEl);
    clear(badgeEl);
    if (questBadgeEl) clear(questBadgeEl);
    clear(tabsEl);
    clear(listEl);
    var box = el('article', 'playground-empty');
    box.appendChild(el('h2', '', '로그인이 필요해요'));
    box.appendChild(el('p', '', '내 활동을 보려면 Google 로그인이 필요합니다.'));
    var button = el('button', 'playground-button', 'Google로 로그인');
    button.type = 'button';
    button.addEventListener('click', function () {
      window.MagicAuth.login();
    });
    box.appendChild(button);
    listEl.appendChild(box);
  }

  function profileForm() {
    var form = el('form', 'playground-comment-form');
    var input = document.createElement('input');
    input.name = 'nickname';
    input.type = 'text';
    input.minLength = 2;
    input.maxLength = 24;
    input.required = true;
    input.value = state.profile && state.profile.nickname ? state.profile.nickname : '';
    input.placeholder = '2-24자';
    var actions = el('div', 'admin-card__actions');
    var save = el('button', 'playground-button', '저장');
    save.type = 'submit';
    var cancel = el('button', 'playground-button playground-button--ghost', '취소');
    cancel.type = 'button';
    var status = el('p', 'playground-form-status');
    actions.appendChild(save);
    actions.appendChild(cancel);
    form.appendChild(input);
    form.appendChild(actions);
    form.appendChild(status);

    cancel.addEventListener('click', renderProfile);
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      status.classList.remove('is-error');
      status.textContent = '저장하는 중입니다.';
      save.disabled = true;
      try {
        var data = await fetchJson('/.netlify/functions/profile', {
          method: 'POST',
          body: JSON.stringify({ nickname: input.value })
        });
        state.profile = Object.assign({}, state.profile || {}, data);
        renderProfile();
      } catch (error) {
        status.textContent = error.code === 'nickname_taken' ? '이미 사용 중인 닉네임이에요' : '닉네임을 저장하지 못했습니다';
        status.classList.add('is-error');
        save.disabled = false;
        input.focus();
      }
    });
    return form;
  }

  function renderProfile() {
    clear(profileEl);
    var title = el('h2', 'playground-post__title', state.profile && state.profile.nickname ? state.profile.nickname : '닉네임 없음');
    title.classList.add('mypage-profile__title');
    var preferredBadgeCode = state.badgeData && state.badgeData.preferredBadgeCode;
    if (preferredBadgeCode && window.KalisBadges && window.KalisBadges.imageBadgesHtml) {
      title.insertAdjacentHTML('beforeend', window.KalisBadges.imageBadgesHtml([preferredBadgeCode]));
    }
    var meta = el('p', 'playground-post__body', '역할 ' + ((state.profile && state.profile.role) || 'member'));
    var actions = el('div', 'admin-card__actions');
    var change = el('button', 'playground-button playground-button--ghost', '닉네임 변경');
    change.type = 'button';
    change.addEventListener('click', function () {
      clear(profileEl);
      profileEl.appendChild(el('h2', 'playground-post__title', '닉네임 변경'));
      profileEl.appendChild(profileForm());
    });
    actions.appendChild(change);
    profileEl.appendChild(title);
    profileEl.appendChild(meta);
    profileEl.appendChild(actions);
  }

  function renderMmbsRequest() {
    if (!mmbsEl) return;
    clear(mmbsEl);
    mmbsEl.appendChild(el('h2', 'mypage-section-title', '입문 강의 (구매자 전용)'));

    var card = el('article', 'admin-card');
    var status = state.mmbsRequest && state.mmbsRequest.status;
    if (status === 'done') {
      card.appendChild(el('p', '', '안내 완료 — 카카오톡을 확인해주세요'));
      var courseLink = el('a', 'playground-button', '강의 보러 가기');
      courseLink.href = 'mmbs.html';
      card.appendChild(courseLink);
    } else if (status === 'requested') {
      var requestedButton = el('button', 'playground-button playground-button--ghost', '신청 접수됨 — 확인 중입니다');
      requestedButton.type = 'button';
      requestedButton.disabled = true;
      card.appendChild(requestedButton);
    } else {
      card.appendChild(el('p', '', '구매 확인 후 카카오톡으로 입문 강의 링크를 안내드립니다.'));
      var requestButton = el('button', 'playground-button', '열람 신청하기');
      requestButton.type = 'button';
      requestButton.addEventListener('click', async function () {
        requestButton.disabled = true;
        requestButton.textContent = '신청하는 중입니다.';
        try {
          state.mmbsRequest = await fetchJson('/.netlify/functions/mmbs-request', { method: 'POST' });
          clear(card);
          card.appendChild(el('p', 'playground-form-status', '신청이 접수되었습니다. 확인 후 카카오톡으로 안내드릴게요.'));
        } catch (error) {
          clear(card);
          card.appendChild(el('p', 'playground-form-status is-error', '신청 기능을 준비 중입니다. 잠시 후 다시 시도해주세요.'));
        }
      });
      card.appendChild(requestButton);
    }
    mmbsEl.appendChild(card);
  }

  function inviteLink(code) {
    return window.location.origin + '/?ref=' + code;
  }

  function renderInvite(invite) {
    if (!inviteEl) return;
    clear(inviteEl);
    inviteEl.appendChild(el('h2', 'mypage-section-title', '친구 초대'));

    if (!invite || !invite.code) {
      inviteEl.appendChild(el('p', 'playground-form-status is-error', '초대 링크를 만들지 못했습니다.'));
      return;
    }

    var link = inviteLink(invite.code);
    var input = document.createElement('input');
    input.type = 'text';
    input.value = link;
    input.readOnly = true;
    input.setAttribute('aria-label', '친구 초대 링크');
    var linkField = el('div', 'playground-comment-form');
    linkField.appendChild(input);
    inviteEl.appendChild(linkField);

    var actions = el('div', 'admin-card__actions');
    var copyButton = el('button', 'playground-button', '링크 복사');
    copyButton.type = 'button';
    copyButton.setAttribute('data-track', 'invite_share');
    copyButton.setAttribute('data-track-type', 'invite_click');
    copyButton.setAttribute('data-track-placement', 'mypage');
    copyButton.addEventListener('click', async function () {
      try {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
          throw new Error('clipboard_unavailable');
        }
        await navigator.clipboard.writeText(link);
      } catch (error) {
        window.prompt('아래 링크를 복사해주세요.', link);
      }
      copyButton.textContent = '링크를 복사했어요';
    });
    actions.appendChild(copyButton);
    inviteEl.appendChild(actions);
    inviteEl.appendChild(el('p', 'playground-form-status', Number(invite.redemptionCount || 0) + '명 초대함'));
  }

  async function loadInvite() {
    if (!inviteEl) return;
    clear(inviteEl);
    inviteEl.appendChild(el('h2', 'mypage-section-title', '친구 초대'));
    inviteEl.appendChild(el('p', 'playground-loading', '초대 링크를 불러오는 중입니다.'));
    try {
      var data = await fetchJson('/.netlify/functions/invite');
      if (!data.invite || !data.invite.code) {
        data = await fetchJson('/.netlify/functions/invite', { method: 'POST' });
      }
      renderInvite(data.invite);
    } catch (error) {
      clear(inviteEl);
      inviteEl.appendChild(el('h2', 'mypage-section-title', '친구 초대'));
      inviteEl.appendChild(el('p', 'playground-form-status is-error', '초대 링크를 불러오지 못했습니다.'));
    }
  }

  async function loadMmbsRequest() {
    if (!mmbsEl) return;
    clear(mmbsEl);
    mmbsEl.appendChild(el('h2', 'mypage-section-title', '입문 강의 (구매자 전용)'));
    mmbsEl.appendChild(el('p', 'playground-loading', '신청 상태를 불러오는 중입니다.'));
    try {
      state.mmbsRequest = await fetchJson('/.netlify/functions/mmbs-request');
      renderMmbsRequest();
    } catch (error) {
      clear(mmbsEl);
      mmbsEl.appendChild(el('h2', 'mypage-section-title', '입문 강의 (구매자 전용)'));
      var card = el('article', 'admin-card');
      card.appendChild(el('p', 'playground-form-status is-error', '신청 기능을 준비 중입니다. 잠시 후 다시 시도해주세요.'));
      mmbsEl.appendChild(card);
    }
  }

  function badgeImage(code, label) {
    var img = document.createElement('img');
    img.className = 'mypage-badge-tile__image';
    img.src = 'assets/playground/badges/' + encodeURIComponent(code) + '.webp';
    img.alt = label || code;
    img.loading = 'lazy';
    return img;
  }

  function badgeMetaText(badge) {
    var wrap = el('span', 'mypage-badge-tile__text');
    wrap.appendChild(el('strong', '', badge.label || badge.code));
    if (badge.description) wrap.appendChild(el('span', '', badge.description));
    return wrap;
  }

  function comingSoonOverlayText(code) {
    return sponsorComingSoonOverlayText[code] || '추후 공개';
  }

  async function savePreferredBadge(code, button) {
    if (!badgeEl) return;
    var status = badgeEl.querySelector('[data-badge-status]');
    if (status) status.textContent = '배지를 저장하는 중입니다.';
    if (button) button.disabled = true;
    try {
      state.badgeData = await fetchJson('/.netlify/functions/member-badges', {
        method: 'PATCH',
        body: JSON.stringify({ preferredBadgeCode: code })
      });
      var newSponsorBadges = newlyOwnedBadges(SPONSOR_BADGE_SEEN_STORAGE_KEY, state.badgeData.catalog || []);
      if (state.profile) renderProfile();
      renderBadges();
      queueSponsorBadgeCelebrations(newSponsorBadges);
    } catch (error) {
      if (status) {
        status.textContent = error.message || '배지를 저장하지 못했습니다.';
        status.classList.add('is-error');
      }
      if (button) button.disabled = false;
    }
  }

  function badgeTile(badge) {
    var canSelect = Boolean(badge.selectable && badge.owned);
    var isComingSoon = !badge.selectable;
    var isActive = state.badgeData && state.badgeData.preferredBadgeCode === badge.code;
    var tile = document.createElement(canSelect ? 'button' : 'div');
    tile.className = 'mypage-badge-tile' +
      (isActive ? ' is-active' : '') +
      (isComingSoon ? ' is-coming-soon' : '') +
      (!isComingSoon && !badge.owned ? ' is-unowned' : '');
    tile.appendChild(badgeImage(badge.code, badge.label));
    tile.appendChild(badgeMetaText(badge));

    if (canSelect) {
      tile.type = 'button';
      tile.setAttribute('role', 'radio');
      tile.setAttribute('aria-checked', isActive ? 'true' : 'false');
      tile.addEventListener('click', function () {
        savePreferredBadge(badge.code, tile);
      });
    } else {
      tile.setAttribute('aria-disabled', 'true');
      if (isComingSoon) {
        tile.appendChild(el('span', 'mypage-badge-tile__overlay', comingSoonOverlayText(badge.code)));
      } else {
        tile.appendChild(el('span', 'mypage-badge-tile__mark', '미보유'));
      }
    }

    return tile;
  }

  function renderBadges() {
    if (!badgeEl) return;
    clear(badgeEl);
    var title = el('h2', 'mypage-section-title', '배지');
    badgeEl.appendChild(title);

    if (!state.badgeData) {
      badgeEl.appendChild(el('p', 'playground-loading', '배지를 불러오는 중입니다.'));
      return;
    }

    var grid = el('div', 'mypage-badge-grid');
    grid.setAttribute('role', 'radiogroup');
    grid.setAttribute('aria-label', '기본 배지 선택');
    (state.badgeData.catalog || []).forEach(function (badge) {
      grid.appendChild(badgeTile(badge));
    });
    badgeEl.appendChild(grid);
    var status = el('p', 'playground-form-status');
    status.setAttribute('data-badge-status', '');
    badgeEl.appendChild(status);
  }

  async function loadBadges() {
    if (!badgeEl) return;
    state.badgeData = null;
    renderBadges();
    try {
      state.badgeData = await fetchJson('/.netlify/functions/member-badges');
      var newSponsorBadges = newlyOwnedBadges(SPONSOR_BADGE_SEEN_STORAGE_KEY, state.badgeData.catalog || []);
      if (state.profile) renderProfile();
      renderBadges();
      queueSponsorBadgeCelebrations(newSponsorBadges);
    } catch (error) {
      clear(badgeEl);
      badgeEl.appendChild(el('h2', 'mypage-section-title', '배지'));
      badgeEl.appendChild(el('p', 'playground-form-status is-error', '배지를 불러오지 못했습니다.'));
    }
  }

  function questBadgeMedia(badge) {
    var media = el('div', 'quest-badge-tile__media');
    var fallback = el('span', 'quest-badge-tile__placeholder', badge.symbol || '?');
    var img = document.createElement('img');
    img.className = 'quest-badge-tile__image';
    img.src = 'assets/playground/quest-badges/' + encodeURIComponent(badge.code) + '.webp';
    img.alt = badge.name || badge.code;
    img.loading = 'lazy';
    img.onerror = function () {
      img.hidden = true;
      img.style.display = 'none';
      media.classList.add('is-placeholder');
    };
    media.appendChild(img);
    media.appendChild(fallback);
    return media;
  }

  function questBadgeProgress(badge) {
    if (badge.owned) return el('span', 'quest-badge-tile__earned', '획득');
    var progress = badge.progress || {};
    var wrap = el('div', 'quest-badge-progress');
    var bar = el('span', 'quest-badge-progress__bar');
    var fill = el('span', 'quest-badge-progress__fill');
    fill.style.width = Math.max(0, Math.min(100, Number(progress.percent) || 0)) + '%';
    bar.appendChild(fill);
    wrap.appendChild(bar);
    wrap.appendChild(el('span', 'quest-badge-progress__text', (progress.current || 0) + '/' + (progress.required || badge.threshold || 0)));
    return wrap;
  }

  function questPublicTile(badge) {
    var tile = el('article', 'quest-badge-tile quest-badge-tile--' + (badge.rarity || 'common') + (badge.owned ? ' is-owned' : ' is-unowned'));
    tile.appendChild(questBadgeMedia(badge));
    var body = el('div', 'quest-badge-tile__body');
    body.appendChild(el('strong', 'quest-badge-tile__name', badge.name || badge.code));
    body.appendChild(el('span', 'quest-badge-tile__meta', (badge.material || '') + ' · ' + (badge.symbol || '')));
    body.appendChild(questBadgeProgress(badge));
    tile.appendChild(body);
    return tile;
  }

  function shouldConcealQuestBadge(badge) {
    return !badge.owned && Number(badge.level) >= 3;
  }

  function visibleQuestBadges(badges) {
    var tier3 = badges.find(function (b) { return Number(b.level) === 3; });
    var tier3Owned = Boolean(tier3 && tier3.owned);
    return badges.filter(function (b) { return Number(b.level) !== 5 || tier3Owned; });
  }

  function questLockedTile(badge) {
    var tile = el('article', 'quest-badge-tile quest-badge-tile--locked is-unowned');
    var media = el('div', 'quest-badge-tile__media quest-badge-tile__media--locked');
    media.appendChild(el('span', 'quest-badge-tile__unknown', '???'));
    tile.appendChild(media);
    var body = el('div', 'quest-badge-tile__body');
    body.appendChild(el('strong', 'quest-badge-tile__name', '조건 획득 시 공개'));
    body.appendChild(el('span', 'quest-badge-tile__hint', '획득하면 배지 문장이 열립니다'));
    tile.appendChild(body);
    return tile;
  }

  function questSecretTile(badge) {
    var tile = el('article', 'quest-badge-tile quest-badge-tile--secret' + (badge.owned ? ' is-owned' : ' is-unowned'));
    var media = el('div', 'quest-badge-tile__media quest-badge-tile__media--secret');
    media.appendChild(el('span', 'quest-badge-tile__unknown', '???'));
    tile.appendChild(media);
    var body = el('div', 'quest-badge-tile__body');
    body.appendChild(el('strong', 'quest-badge-tile__name', '???'));
    body.appendChild(el('span', 'quest-badge-tile__hint', badge.secretHint || '아직 조건이 숨겨져 있어요'));
    if (badge.owned) body.appendChild(el('span', 'quest-badge-tile__earned', '획득'));
    tile.appendChild(body);
    return tile;
  }

  function questCelebrationCondition(badge) {
    var description = badge.publicDescription || badge.public_description;
    if (description) return description;
    if (badge.secretHint) return badge.secretHint;
    var trackLabel = questTrackLabels[badge.track] || badge.track;
    if (trackLabel && badge.threshold) return trackLabel + ' ' + badge.threshold + '회 달성';
    return '조건을 달성했어요.';
  }

  function sponsorCelebrationCondition(badge) {
    var label = badge.label || '';
    var code = badge.code || '';
    if (code.indexOf('expert') === 0 || label.indexOf('전문가') !== -1) {
      return '전문가 등급으로 승급했어요.';
    }
    return '후원해주셔서 감사합니다.';
  }

  function badgeCelebrationName(item) {
    var badge = item.badge || {};
    if (item.kind === 'quest') return badge.name || (badge.isSecret ? '비밀 배지' : badge.code);
    return badge.label || badge.name || badge.code;
  }

  function badgeCelebrationCondition(item) {
    return item.kind === 'quest'
      ? questCelebrationCondition(item.badge || {})
      : sponsorCelebrationCondition(item.badge || {});
  }

  function badgeCelebrationMeta(item) {
    var badge = item.badge || {};
    if (item.kind !== 'quest') return badge.description || '';
    return [badge.material, badge.symbol].filter(Boolean).join(' · ');
  }

  function badgeCelebrationMedia(item) {
    if (item.kind === 'quest') return questBadgeMedia(item.badge || {});
    var wrap = el('div', 'badge-celebration-sponsor-media');
    wrap.appendChild(badgeImage((item.badge && item.badge.code) || '', badgeCelebrationName(item)));
    return wrap;
  }

  function dismissBadgeCelebration(overlay) {
    if (!badgeCelebrationVisible) return;
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    badgeCelebrationVisible = false;
    showNextBadgeCelebration();
  }

  function showNextBadgeCelebration() {
    if (badgeCelebrationVisible || !badgeCelebrationQueue.length || !document.body) return;
    var item = badgeCelebrationQueue.shift();
    var name = badgeCelebrationName(item);
    var titleId = 'badge-celebration-title';
    var overlay = el('div', 'badge-celebration-overlay');
    var card = el('article', 'badge-celebration-card');
    var close = el('button', 'badge-celebration-close', '닫기');
    var media = el('div', 'badge-celebration-media');
    var title = el('h2', 'badge-celebration-title', name);
    var meta = badgeCelebrationMeta(item);
    var confirm = el('button', 'playground-button badge-celebration-confirm', '확인');

    badgeCelebrationVisible = true;
    overlay.tabIndex = -1;
    overlay.setAttribute('role', 'presentation');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', titleId);
    title.id = titleId;
    close.type = 'button';
    close.setAttribute('aria-label', '배지 축하 팝업 닫기');
    confirm.type = 'button';

    media.appendChild(badgeCelebrationMedia(item));
    card.appendChild(close);
    card.appendChild(media);
    card.appendChild(title);
    if (meta) card.appendChild(el('p', 'badge-celebration-meta', meta));
    card.appendChild(el('p', 'badge-celebration-message', "축하합니다! '" + name + "' 배지를 획득했어요."));
    card.appendChild(el('p', 'badge-celebration-condition', badgeCelebrationCondition(item)));
    card.appendChild(confirm);
    overlay.appendChild(card);

    close.addEventListener('click', function () {
      dismissBadgeCelebration(overlay);
    });
    confirm.addEventListener('click', function () {
      dismissBadgeCelebration(overlay);
    });
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) dismissBadgeCelebration(overlay);
    });
    overlay.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') dismissBadgeCelebration(overlay);
    });

    document.body.appendChild(overlay);
    close.focus();
  }

  function queueBadgeCelebrations(badges, kind) {
    (badges || []).forEach(function (badge) {
      if (badge) badgeCelebrationQueue.push({ badge: badge, kind: kind });
    });
    showNextBadgeCelebration();
  }

  function queueQuestBadgeCelebrations(badges) {
    queueBadgeCelebrations(badges, 'quest');
  }

  function queueSponsorBadgeCelebrations(badges) {
    queueBadgeCelebrations(badges, 'sponsor');
  }

  function renderQuestBadges() {
    if (!questBadgeEl) return;
    clear(questBadgeEl);
    questBadgeEl.appendChild(el('h2', 'mypage-section-title', '퀘스트 배지'));

    if (!state.questBadgeData) {
      questBadgeEl.appendChild(el('p', 'playground-loading', '퀘스트 배지를 불러오는 중입니다.'));
      return;
    }

    var catalog = state.questBadgeData.catalog || [];
    var publicBadges = catalog.filter(function (badge) { return !badge.isSecret; });
    var secretBadges = catalog.filter(function (badge) { return badge.isSecret; });

    questTrackOrder.forEach(function (track) {
      var badges = publicBadges.filter(function (badge) { return badge.track === track; });
      if (!badges.length) return;
      var group = el('section', 'quest-badge-group');
      group.appendChild(el('h3', 'quest-badge-group__title', questTrackLabels[track] || track));
      var grid = el('div', 'quest-badge-grid');
      visibleQuestBadges(badges).forEach(function (badge) {
        grid.appendChild(shouldConcealQuestBadge(badge) ? questLockedTile(badge) : questPublicTile(badge));
      });
      group.appendChild(grid);
      questBadgeEl.appendChild(group);
    });

    if (secretBadges.length) {
      var secretGroup = el('section', 'quest-badge-group quest-badge-group--secret');
      secretGroup.appendChild(el('h3', 'quest-badge-group__title', '비밀 배지'));
      var secretGrid = el('div', 'quest-badge-grid');
      secretBadges.forEach(function (badge) {
        secretGrid.appendChild(questSecretTile(badge));
      });
      secretGroup.appendChild(secretGrid);
      questBadgeEl.appendChild(secretGroup);
    }
  }

  async function loadQuestBadges() {
    if (!questBadgeEl) return;
    state.questBadgeData = null;
    renderQuestBadges();
    try {
      state.questBadgeData = await fetchJson('/.netlify/functions/quest-badges');
      var newQuestBadges = newlyOwnedBadges(QUEST_BADGE_SEEN_STORAGE_KEY, state.questBadgeData.catalog || []);
      renderQuestBadges();
      queueQuestBadgeCelebrations(newQuestBadges);
    } catch (error) {
      clear(questBadgeEl);
      questBadgeEl.appendChild(el('h2', 'mypage-section-title', '퀘스트 배지'));
      questBadgeEl.appendChild(el('p', 'playground-form-status is-error', '퀘스트 배지를 불러오지 못했습니다.'));
    }
  }

  function renderTabs() {
    tabsEl.innerHTML = [
      '<button type="button" data-mypage-tab="posts" class="is-active">내가 쓴 글</button>',
      '<button type="button" data-mypage-tab="received">받은 답변</button>',
      '<button type="button" data-mypage-tab="given">해준 답변</button>'
    ].join('');
    Array.prototype.slice.call(tabsEl.querySelectorAll('[data-mypage-tab]')).forEach(function (button) {
      button.addEventListener('click', function () {
        var tab = button.getAttribute('data-mypage-tab') || 'posts';
        state.tab = tab;
        Array.prototype.slice.call(tabsEl.querySelectorAll('[data-mypage-tab]')).forEach(function (node) {
          node.classList.toggle('is-active', node === button);
        });
        loadActivity();
      });
    });
  }

  function clickableCard(card, id) {
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.addEventListener('click', function () {
      goToPost(id);
    });
    card.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        goToPost(id);
      }
    });
  }

  function postCard(item) {
    var card = el('article', 'admin-card');
    clickableCard(card, item.id);
    card.appendChild(el('h2', '', item.title || '제목 없음'));
    card.appendChild(el('p', '', categoryLabel(item.category) + ' · ' + formatDate(item.createdAt) + ' · 댓글 ' + (item.commentCount || 0)));
    return card;
  }

  function activityCard(item) {
    var card = el('article', 'admin-card');
    clickableCard(card, item.postId);
    card.appendChild(el('h2', '', item.postTitle || '제목 없음'));
    card.appendChild(el('p', '', item.body || '본문이 없습니다'));
    card.appendChild(el('span', '', formatDate(item.createdAt)));
    return card;
  }

  function renderActivity(items) {
    clear(listEl);
    if (!items.length) {
      var empty = el('article', 'playground-empty');
      empty.appendChild(el('h2', '', emptyMessages[state.tab]));
      listEl.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      listEl.appendChild(state.tab === 'posts' ? postCard(item) : activityCard(item));
    });
  }

  async function loadActivity() {
    clear(listEl);
    listEl.appendChild(el('p', 'playground-loading', tabLabels[state.tab] + '을 불러오는 중입니다.'));
    try {
      var data = await fetchJson('/.netlify/functions/my-activity?tab=' + encodeURIComponent(state.tab));
      renderActivity(data.items || []);
    } catch (error) {
      clear(listEl);
      var box = el('article', 'playground-empty');
      box.appendChild(el('h2', '', '활동을 불러오지 못했어요'));
      box.appendChild(el('p', '', error.message || '잠시 후 다시 시도해주세요.'));
      listEl.appendChild(box);
    }
  }

  async function init() {
    if (!profileEl || !tabsEl || !listEl || !window.MagicAuth) return;
    state.session = await window.MagicAuth.getSession();
    if (!state.session) {
      showLogin();
      return;
    }
    profileEl.hidden = false;
    profileEl.innerHTML = '<p class="playground-loading">프로필을 불러오는 중입니다.</p>';
    try {
      state.profile = await fetchJson('/.netlify/functions/profile');
      renderProfile();
    } catch (error) {
      clear(profileEl);
      profileEl.hidden = true;
    }
    await loadInvite();
    await loadMmbsRequest();
    await loadBadges();
    await loadQuestBadges();
    renderTabs();
    await loadActivity();
  }

  window.addEventListener('profile:nickname-updated', function (event) {
    state.profile = Object.assign({}, state.profile || {}, event.detail || {});
    if (profileEl) renderProfile();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
