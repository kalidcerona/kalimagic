(function () {
  var KALI_EVENTS = [
    { code: '2026-08', label: '칼리의 대번개' },
    { code: 'garage-life-2026', label: 'GARAGE LIFE FESTIVAL (Deus Ex Machina + RSG) · 2026' },
    { code: 'kwangwoon-2026', label: '광운대 특강 · 2026' },
    { code: 'yonsei-korea-sogang-2026', label: '연세·고려·서강대 합동 특강 · 2026' },
    { code: 'hanyang-2026', label: '한양대 동아리 행사 · 2026' },
    { code: 'hanyang-2025-2', label: '한양대 동아리 행사 2차 · 2025' },
    { code: 'kali-big-meetup-2025', label: '25년 칼리의 대번개' },
    { code: 'hanyang-2025-1', label: '한양대 동아리 행사 1차 · 2025' },
    { code: 'hanyang-2024', label: '한양대 동아리 행사 · 2024' },
    { code: 'umu-lecture-2023', label: '23년 대학마술연합 UMU 특강' }
  ];

  window.KALI_EVENTS = KALI_EVENTS;

  var el = window.PgUtil.el;
  var clear = window.PgUtil.clear;
  var fetchJson = window.PgUtil.fetchJson;

  function roleBadgeHtml(role) {
    return window.KalisBadges && typeof window.KalisBadges.badgeHtml === 'function'
      ? window.KalisBadges.badgeHtml(role)
      : '';
  }

  function field(name, label, placeholder, rows) {
    var wrapper = el('label', 'event-review-field');
    wrapper.appendChild(el('span', '', label));
    var input = rows ? document.createElement('textarea') : document.createElement('input');
    input.name = name;
    input.required = name !== 'youtubeUrl';
    input.placeholder = placeholder;
    if (rows) input.rows = rows;
    if (name === 'youtubeUrl') input.type = 'url';
    wrapper.appendChild(input);
    return wrapper;
  }

  function eventSelectField(currentEventCode, onChange) {
    var wrapper = el('label', 'event-review-field');
    wrapper.appendChild(el('span', '', '어떤 모임이었나요?'));
    var select = document.createElement('select');
    select.name = 'eventCode';
    select.required = true;
    KALI_EVENTS.forEach(function (eventInfo) {
      var option = document.createElement('option');
      option.value = eventInfo.code;
      option.textContent = eventInfo.label;
      if (eventInfo.code === currentEventCode) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', function () {
      onChange(select.value);
    });
    wrapper.appendChild(select);
    return wrapper;
  }

  function renderPhotoPicker(photos, selected, onSelectionChange) {
    var grid = el('div', 'event-review-photos');
    if (!photos.length) {
      grid.appendChild(el('p', 'event-review-muted', '선택할 사진이 아직 준비되지 않았습니다.'));
      return grid;
    }
    photos.forEach(function (photo) {
      var button = el('button', 'event-review-photo');
      button.type = 'button';
      var image = document.createElement('img');
      image.src = photo.image_src;
      image.alt = photo.alt_text;
      button.appendChild(image);
      button.appendChild(el('span', '', photo.alt_text));
      button.addEventListener('click', function () {
        var index = selected.indexOf(photo.id);
        if (index >= 0) selected.splice(index, 1);
        else if (selected.length < 5) selected.push(photo.id);
        button.classList.toggle('is-selected', selected.includes(photo.id));
        onSelectionChange();
      });
      grid.appendChild(button);
    });
    return grid;
  }

  function renderReviews(list, reviews) {
    clear(list);
    if (!reviews.length) {
      return;
    }
    reviews.forEach(function (review) {
      var item = el('article', 'event-review-card');
      var link = el('a', '', review.title);
      link.href = '/p/' + encodeURIComponent(review.id);
      item.appendChild(link);
      item.appendChild(el('p', '', review.body));
      var author = el('span', '', review.authorLabel || '마술인');
      var authorBadge = roleBadgeHtml(review.authorRole);
      if (authorBadge) author.insertAdjacentHTML('beforeend', authorBadge);
      item.appendChild(author);
      list.appendChild(item);
    });
  }

  async function loadReviews(list, eventCode) {
    var code = eventCode || list.dataset.eventCode || '2026-08';
    var data = await fetchJson('/.netlify/functions/event-reviews?eventCode=' + encodeURIComponent(code));
    renderReviews(list, data.reviews || []);
  }

  function mountReviewForm(root, options) {
    options = options || {};
    var currentEventCode = options.eventCode || root.dataset.eventCode || '2026-08';
    var selected = [];
    clear(root);

    var form = el('form', 'event-review-form');
    if (options.showEventSelect) {
      form.appendChild(eventSelectField(currentEventCode, function (nextEventCode) {
        currentEventCode = nextEventCode;
        refreshPhotos();
      }));
    }

    form.appendChild(field('goodMoment', '오늘 좋았던 순간', '함께 웃었던 순간, 기억에 남는 대화를 적어줘.', 3));
    form.appendChild(field('impressiveScene', '인상 깊었던 장면', '공연, 분위기, 사람들 중 기억나는 장면을 적어줘.', 3));
    form.appendChild(field('nextProgram', '다음에 보고 싶은 프로그램', '다음 모임에 있으면 좋을 코너를 적어줘.', 2));
    form.appendChild(field('messageToFirstTimer', '처음 오는 사람에게 한마디', '처음 오는 사람이 안심할 수 있는 말을 적어줘.', 2));
    form.appendChild(field('youtubeUrl', '유튜브 링크 선택', 'https://youtu.be/...', 0));
    form.appendChild(el('p', 'event-review-muted', '보여주고 싶은 사진 2-5장을 골라줘.'));

    var count = el('p', 'event-review-count', '0장 선택됨');
    count.dataset.photoCount = '';
    form.appendChild(count);

    var photoHost = el('div');
    form.appendChild(photoHost);

    var submit = el('button', 'playground-button', '후기 올리기');
    submit.type = 'submit';
    form.appendChild(submit);
    var status = el('p', 'event-review-status');
    form.appendChild(status);
    root.appendChild(form);

    function updateCount() {
      count.textContent = selected.length + '장 선택됨';
    }

    async function refreshPhotos() {
      selected.splice(0, selected.length);
      updateCount();
      clear(photoHost);
      photoHost.appendChild(el('p', 'event-review-muted', '사진을 불러오는 중입니다.'));
      var photos = [];
      try {
        var photoData = await fetchJson('/.netlify/functions/event-photos?eventCode=' + encodeURIComponent(currentEventCode));
        photos = photoData.photos || [];
      } catch {
        photos = [];
      }
      clear(photoHost);
      photoHost.appendChild(renderPhotoPicker(photos, selected, updateCount));
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (selected.length < 2 || selected.length > 5) {
        status.textContent = '사진은 2-5장 골라줘.';
        status.classList.add('is-error');
        return;
      }
      var formData = new FormData(form);
      status.classList.remove('is-error');
      status.textContent = '후기를 올리는 중입니다.';
      try {
        var result = await fetchJson('/.netlify/functions/event-reviews', {
          method: 'POST',
          body: JSON.stringify({
            eventCode: currentEventCode,
            photoIds: selected,
            goodMoment: formData.get('goodMoment'),
            impressiveScene: formData.get('impressiveScene'),
            nextProgram: formData.get('nextProgram'),
            messageToFirstTimer: formData.get('messageToFirstTimer'),
            youtubeUrl: formData.get('youtubeUrl')
          })
        });
        form.reset();
        if (options.showEventSelect) {
          form.querySelector('select[name="eventCode"]').value = currentEventCode;
        }
        selected.splice(0, selected.length);
        Array.prototype.forEach.call(form.querySelectorAll('.event-review-photo'), function (button) {
          button.classList.remove('is-selected');
        });
        updateCount();
        status.textContent = '후기가 올라갔습니다.';
        if (typeof options.onSuccess === 'function') {
          await options.onSuccess(Object.assign({ eventCode: currentEventCode }, result));
        }
      } catch (error) {
        status.textContent = error.message || '후기를 올리지 못했습니다.';
        status.classList.add('is-error');
      }
    });

    refreshPhotos();
    return {
      refreshPhotos: refreshPhotos
    };
  }

  async function initReviewApp(root) {
    var eventCode = root.dataset.eventCode || '2026-08';
    var originalTitle = root.querySelector('h2')?.textContent || '모임 후기 남기기';
    var originalLead = root.querySelector('p')?.textContent || '';
    clear(root);
    root.appendChild(el('h2', 'event-review-title', originalTitle));
    root.appendChild(el('p', 'event-review-muted', originalLead));

    var formRoot = el('div');
    root.appendChild(formRoot);

    var list = el('div', 'event-review-list');
    list.dataset.eventReviewList = '';
    list.dataset.eventCode = eventCode;
    root.appendChild(list);

    mountReviewForm(formRoot, {
      eventCode: eventCode,
      onSuccess: async function () {
        await loadReviews(list, eventCode);
      }
    });
    await loadReviews(list, eventCode);
  }

  function initReviewList(list) {
    var eventCode = list.dataset.eventCode || '2026-08';
    loadReviews(list, eventCode).catch(function (error) {
      clear(list);
    });
  }

  function init() {
    var apps = Array.prototype.slice.call(document.querySelectorAll('[data-event-review-app]'));
    var lists = Array.prototype.slice.call(document.querySelectorAll('[data-event-review-list]')).filter(function (list) {
      return !list.closest('[data-event-review-app]');
    });

    apps.forEach(function (root) {
      initReviewApp(root).catch(function (error) {
        clear(root);
        root.appendChild(el('p', 'event-review-muted', error.message || '후기 영역을 불러오지 못했습니다.'));
      });
    });

    lists.forEach(initReviewList);
  }

  window.KalisEventReviewForm = {
    mount: mountReviewForm
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
