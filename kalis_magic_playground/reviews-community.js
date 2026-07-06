(function () {
  var apps = Array.prototype.slice.call(document.querySelectorAll('[data-event-review-app]'));

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  async function fetchJson(url, options) {
    var headers = window.MagicAuth ? await window.MagicAuth.authHeader() : {};
    if (options && options.body) headers['content-type'] = 'application/json; charset=utf-8';
    var response = await fetch(url, Object.assign({}, options, { headers: headers }));
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.message || data.error || '요청을 처리하지 못했습니다.');
    return data;
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

  function renderPhotoPicker(root, photos, selected) {
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
        root.querySelector('[data-photo-count]').textContent = selected.length + '장 선택됨';
      });
      grid.appendChild(button);
    });
    return grid;
  }

  function renderReviews(root, reviews) {
    var list = root.querySelector('[data-event-review-list]');
    clear(list);
    if (!reviews.length) {
      list.appendChild(el('p', 'event-review-muted', '아직 올라온 모임 후기가 없습니다.'));
      return;
    }
    reviews.forEach(function (review) {
      var item = el('article', 'event-review-card');
      var link = el('a', '', review.title);
      link.href = 'playground.html?post=' + encodeURIComponent(review.id);
      item.appendChild(link);
      item.appendChild(el('p', '', review.body));
      item.appendChild(el('span', '', review.authorLabel || '마술인'));
      list.appendChild(item);
    });
  }

  async function loadReviews(root, eventCode) {
    var data = await fetchJson('/.netlify/functions/event-reviews?eventCode=' + encodeURIComponent(eventCode));
    renderReviews(root, data.reviews || []);
  }

  async function initApp(root) {
    var eventCode = root.dataset.eventCode || '2026-08';
    var selected = [];
    var originalTitle = root.querySelector('h2')?.textContent || '모임 후기 남기기';
    var originalLead = root.querySelector('p')?.textContent || '';
    clear(root);
    root.appendChild(el('h2', 'event-review-title', originalTitle));
    root.appendChild(el('p', 'event-review-muted', originalLead));

    var form = el('form', 'event-review-form');
    form.appendChild(field('goodMoment', '오늘 좋았던 순간', '함께 웃었던 순간, 기억에 남는 대화를 적어줘.', 3));
    form.appendChild(field('impressiveScene', '인상 깊었던 장면', '공연, 분위기, 사람들 중 기억나는 장면을 적어줘.', 3));
    form.appendChild(field('nextProgram', '다음에 보고 싶은 프로그램', '다음 모임에 있으면 좋을 코너를 적어줘.', 2));
    form.appendChild(field('messageToFirstTimer', '처음 오는 사람에게 한마디', '처음 오는 사람이 안심할 수 있는 말을 적어줘.', 2));
    form.appendChild(field('youtubeUrl', '유튜브 링크 선택', 'https://youtu.be/...', 0));
    form.appendChild(el('p', 'event-review-muted', '보여주고 싶은 사진 2-5장을 골라줘.'));
    form.appendChild(el('p', 'event-review-count', '0장 선택됨')).dataset.photoCount = '';

    var photos = [];
    try {
      var photoData = await fetchJson('/.netlify/functions/event-photos?eventCode=' + encodeURIComponent(eventCode));
      photos = photoData.photos || [];
    } catch {
      photos = [];
    }
    form.appendChild(renderPhotoPicker(form, photos, selected));

    var submit = el('button', 'playground-button', '후기 올리기');
    submit.type = 'submit';
    form.appendChild(submit);
    var status = el('p', 'event-review-status');
    form.appendChild(status);
    root.appendChild(form);

    var list = el('div', 'event-review-list');
    list.dataset.eventReviewList = '';
    root.appendChild(list);

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
        await fetchJson('/.netlify/functions/event-reviews', {
          method: 'POST',
          body: JSON.stringify({
            eventCode: eventCode,
            photoIds: selected,
            goodMoment: formData.get('goodMoment'),
            impressiveScene: formData.get('impressiveScene'),
            nextProgram: formData.get('nextProgram'),
            messageToFirstTimer: formData.get('messageToFirstTimer'),
            youtubeUrl: formData.get('youtubeUrl')
          })
        });
        form.reset();
        selected.splice(0, selected.length);
        Array.prototype.forEach.call(form.querySelectorAll('.event-review-photo'), function (button) {
          button.classList.remove('is-selected');
        });
        form.querySelector('[data-photo-count]').textContent = '0장 선택됨';
        status.textContent = '후기가 올라갔습니다.';
        await loadReviews(root, eventCode);
      } catch (error) {
        status.textContent = error.message || '후기를 올리지 못했습니다.';
        status.classList.add('is-error');
      }
    });

    await loadReviews(root, eventCode);
  }

  apps.forEach(function (root) {
    initApp(root).catch(function (error) {
      clear(root);
      root.appendChild(el('p', 'event-review-muted', error.message || '후기 영역을 불러오지 못했습니다.'));
    });
  });
})();
