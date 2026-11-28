(function () {
  var el = window.PgUtil.el;
  var clear = window.PgUtil.clear;
  var fetchJson = window.PgUtil.fetchJson;

  function roleBadgeHtml(role) {
    return window.KalisBadges && typeof window.KalisBadges.badgeHtml === 'function'
      ? window.KalisBadges.badgeHtml(role)
      : '';
  }

  function renderReviews(list, reviews) {
    clear(list);
    if (!reviews.length) {
      return;
    }
    reviews.forEach(function (review) {
      var item = el('article', 'event-review-card');
      item.appendChild(el('strong', '', review.title));
      item.appendChild(el('p', '', review.body));
      var author = el('span', '', review.authorLabel || '마술인');
      var authorBadge = roleBadgeHtml(review.authorRole);
      if (authorBadge) author.insertAdjacentHTML('beforeend', authorBadge);
      item.appendChild(author);
      list.appendChild(item);
    });
  }

  function mobileReviewList(section, list) {
    var details = el('details');
    details.dataset.eventCode = list.dataset.eventCode;
    var title = list.closest('.event-block').querySelector('.event-block-title').cloneNode(true);
    var photoCount = title.querySelector('.ev-count');
    if (photoCount) photoCount.remove();
    details.appendChild(el('summary', '', title.textContent.trim()));
    var content = el('div', 'event-review-list', '후기를 불러오는 중입니다.');
    content.setAttribute('aria-live', 'polite');
    details.appendChild(content);
    section.appendChild(details);
    return content;
  }

  async function loadReviews(list, mobileList) {
    try {
      var code = list.dataset.eventCode || '2026-08';
      var data = await fetchJson('/.netlify/functions/event-reviews?eventCode=' + encodeURIComponent(code));
      var reviews = data.reviews || [];
      renderReviews(list, reviews);
      if (mobileList) {
        renderReviews(mobileList, reviews);
        if (!reviews.length) mobileList.textContent = '아직 등록된 후기가 없습니다.';
      }
    } catch {
      clear(list);
      if (mobileList) mobileList.textContent = '후기를 불러오지 못했습니다.';
    }
  }

  function init() {
    var section = document.querySelector('.mobile-event-reviews');
    document.querySelectorAll('[data-event-review-list]').forEach(function (list) {
      loadReviews(list, section && mobileReviewList(section, list));
    });
    if (section) section.hidden = false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
