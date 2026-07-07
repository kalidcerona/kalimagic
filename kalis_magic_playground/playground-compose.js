(function () {
  const PLAYGROUND_GUIDES = {
    all: {
      label: '전체 게시판',
      categoryHelp: '어떤 기록을 남길지 먼저 골라주면 됨. 질문, 모임 후기, 도구 리뷰, 자유 기록 중에서 가장 가까운 곳에 남기면 사람들이 더 잘 찾아볼 수 있음.',
      titlePlaceholder: '먼저 게시판을 선택하면 제목 예시가 나타남',
      bodyPlaceholder: '남기고 싶은 이야기에 가장 가까운 게시판을 선택하면, 그 글에 맞는 안내가 열림',
      extra: ''
    },
    free: {
      label: '자유 게시판',
      description: '오늘의 연습, 문득 든 생각, 마술하면서 생긴 작은 이야기를 편하게 남기는 공간임.',
      titleExamples: [
        '오늘 연습하다가 이런 생각이 들었음',
        '카드 한 벌 들고 나갔다가 생긴 일',
        '요즘 연습 중인 루틴 기록',
        '오늘 마술 보여주고 느낀 점'
      ],
      titleGuide: '오늘 남기고 싶은 이야기를 한 줄로 적으면 좋음.',
      bodyGuide: '연습한 것, 느낀 점, 사람들 반응, 다음에 해보고 싶은 것을 편하게 적으면 됨. 짧아도 좋고, 기록처럼 남겨도 좋음.',
      extra: '작은 기록도 쌓이면 누군가에게 길잡이가 됨.'
    },
    question: {
      label: '질문 게시판',
      description: '마술을 배우다 막히는 순간이 있으면 질문을 남기는 공간임. 먼저 지나간 사람이 답을 알고 있을 수 있음.',
      titleExamples: [
        '이 마술은 어디서 배워야 하나요?',
        '제 마술 피드백해 주실 수 있나요?',
        '카드 컨트롤은 어떤 순서로 연습하면 좋나요?',
        '처음 보여주기 좋은 마술 추천받고 싶음',
        '이 상황에서는 어떤 연출이 잘 맞을까요?'
      ],
      titleGuide: '궁금한 점이 바로 보이도록 한 줄로 적으면 답변받기 좋음.',
      bodyGuide: '궁금한 점과 현재 알고 있는 내용을 편하게 적으면 됨. 연습 중인 영상, 참고한 강의, 막힌 부분을 함께 남기면 더 구체적인 답변을 받을 수 있음.',
      youtubeGuide: '피드백을 받고 싶은 영상이 있다면 유튜브 링크를 함께 붙이면 좋음. 질문을 보는 사람이 장면을 바로 보고 답변할 수 있음.',
      extra: '처음 묻는 질문도 좋음. 누군가에게는 같은 고민을 해결하는 첫 기록이 될 수 있음.'
    },
    meeting: {
      label: '모임 후기 게시판',
      description: '모임에서 느낀 분위기와 기억에 남은 순간을 남기는 공간임. 그날의 기록이 다음 모임을 더 좋게 만듦.',
      titleExamples: [
        '이번 모임 다녀온 후기',
        '처음 참석해본 플랜비 후기',
        '오늘 모임에서 기억에 남은 순간',
        '마술 없이도 재밌었던 모임 기록',
        '다음 모임에도 가고 싶은 이유'
      ],
      titleGuide: '어떤 모임을 다녀왔는지 알 수 있게 적으면 좋음.',
      bodyGuide: '모임에서 좋았던 점, 기억에 남은 사람이나 순간, 다음에 추가되면 좋을 프로그램을 편하게 적으면 됨. 짧은 감상도 좋은 기록이 됨.',
      photoGuide: '칼리형이 올린 사진 중에서 마음에 드는 사진 2-5장을 골라 함께 남길 수 있음.',
      extra: '모임 후기는 처음 오는 사람에게 가장 큰 안내서가 됨.'
    },
    tool: {
      label: '리뷰 후기 게시판',
      description: '직접 써본 도구와 강의 경험을 남기는 공간임. 좋은 점과 활용 장면을 남기면 다음 사람이 선택하기 쉬워짐.',
      titleExamples: [
        '이 덱 직접 써본 후기',
        '초보자가 쓰기 좋았던 카드 도구',
        '이 강의 보고 실제로 써본 느낌',
        '실전에서 반응 좋았던 도구 리뷰',
        '가격 대비 만족스러웠던 마술 도구'
      ],
      titleGuide: '무엇을 써봤는지와 어떤 느낌이었는지 드러나게 적으면 좋음.',
      bodyGuide: '사용해 본 도구나 강의의 장점, 실제로 써본 상황, 추천하고 싶은 사람을 적으면 좋음. 반응이 좋았던 장면이나 연습 난이도를 함께 남기면 더 도움이 됨.',
      extraItemGuide: '가능하면 가격대, 난이도, 필요한 준비물, 실전 활용도를 함께 적으면 기록의 가치가 커짐.',
      extra: '내가 써본 경험이 누군가에게는 시행착오를 줄여주는 길잡이가 됨.'
    },
    magazine: {
      label: '매거진 게시판',
      description: '마술 놀이터에 쌓인 좋은 질문과 답변, 후기와 리뷰를 골라 오래 볼 수 있게 모아두는 공간임.',
      userGuide: '이곳은 마술 놀이터에서 오래 남기고 싶은 글을 모아두는 공간임. 좋은 질문, 좋은 답변, 좋은 후기, 좋은 리뷰가 매거진 후보가 될 수 있음.',
      titleExamples: [
        '처음 마술을 배우는 사람에게 필요한 질문',
        '입문자가 가장 많이 막히는 지점',
        '모임 후기로 보는 마술 놀이터 분위기',
        '실전에서 반응 좋았던 도구 모음',
        '이번 주 좋은 질문과 답변'
      ],
      titleGuide: '나중에 다시 찾아보고 싶은 주제가 드러나게 적으면 좋음.',
      bodyGuide: '원글의 핵심, 답변에서 얻을 수 있는 배움, 다음 사람이 참고할 포인트를 정리하면 좋음. 원글과 답변을 연결해 작은 아카이브처럼 남기면 됨.',
      extra: '매거진은 흘러가는 게시판에서 오래 남길 만한 기록을 건져 올리는 공간임.'
    }
  };

  const POST_TYPE_BY_CATEGORY = {
    question: 'question',
    tool: 'review_comment',
    magazine: 'magazine'
  };

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function categoryFromTarget(target) {
    if (!target || target.id === 'all') return 'all';
    if (target.id === 'question') return 'question';
    if (target.id === 'review_tool') return 'tool';
    if (target.id === 'review_meeting') return 'meeting';
    if (target.id === 'magazine') return 'magazine';
    if (target.id === 'free') return 'free';
    return 'all';
  }

  function guideHtml(category) {
    const guide = PLAYGROUND_GUIDES[category] || PLAYGROUND_GUIDES.all;
    const examples = guide.titleExamples ? `<p class="pg-compose-examples">${guide.titleExamples.map(escapeHtml).join(' / ')}</p>` : '';
    const lines = [
      guide.categoryHelp,
      guide.description,
      guide.userGuide,
      guide.titleGuide,
      guide.bodyGuide,
      guide.youtubeGuide,
      guide.photoGuide,
      guide.extraItemGuide,
      guide.extra
    ].filter(Boolean);

    return `
      <div class="pg-compose-guide">
        <strong>${escapeHtml(guide.label)}</strong>
        ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
        ${examples}
      </div>
    `;
  }

  function selectHtml(selected) {
    const options = [
      ['all', '게시판 선택'],
      ['question', '질문함'],
      ['tool', '도구 리뷰'],
      ['meeting', '모임 후기'],
      ['magazine', '매거진'],
      ['free', '자유 기록🔒']
    ];
    return `
      <label>
        <span>게시판</span>
        <select name="category" required>
          ${options.map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </label>
    `;
  }

  function formHtml(category) {
    const guide = PLAYGROUND_GUIDES[category] || PLAYGROUND_GUIDES.all;
    const titlePlaceholder = guide.titleGuide || guide.titlePlaceholder || PLAYGROUND_GUIDES.all.titlePlaceholder;
    const bodyPlaceholder = guide.bodyGuide || guide.bodyPlaceholder || PLAYGROUND_GUIDES.all.bodyPlaceholder;

    if (category === 'free') {
      return `
        ${guideHtml('free')}
        <p class="pg-compose-status">자유 기록은 준비 중입니다. 질문함과 리뷰가 자리 잡은 뒤 열립니다.</p>
      `;
    }

    if (category === 'meeting') {
      return `
        ${guideHtml('meeting')}
        <p class="pg-compose-status">모임 후기는 기존 모임 후기 작성 화면에서 남깁니다.</p>
        <a class="pg-compose-link" href="reviews.html">모임 후기 작성하러 가기</a>
      `;
    }

    return `
      ${guideHtml(category)}
      <form data-playground-compose-form>
        ${selectHtml(category)}
        <label>
          <span>제목</span>
          <input name="title" type="text" maxlength="120" required placeholder="${escapeHtml(titlePlaceholder)}">
        </label>
        <label>
          <span>내용</span>
          <textarea name="body" rows="7" required placeholder="${escapeHtml(bodyPlaceholder)}"></textarea>
        </label>
        <div class="pg-compose-grid">
          <label>
            <span>공개 범위</span>
            <select name="visibility">
              <option value="public">전체 공개</option>
              <option value="kali_only">칼리에게만 공개</option>
              <option value="expert_only">전문가 이상 공개</option>
            </select>
          </label>
          <label>
            <span>표시 이름</span>
            <select name="displayMode">
              <option value="nickname">닉네임 표시</option>
              <option value="anonymous">익명</option>
            </select>
          </label>
        </div>
        <label>
          <span>유튜브 링크 선택</span>
          <input name="youtubeUrl" type="url" placeholder="https://youtu.be/video-id">
        </label>
        <button type="submit" class="pg-submit">글 올리기</button>
        <p class="pg-compose-status" data-compose-status></p>
      </form>
    `;
  }

  function initPlaygroundCompose({ api, root, getActiveTarget, onCreated }) {
    let openCategory = categoryFromTarget(getActiveTarget && getActiveTarget());

    function renderClosed() {
      root.innerHTML = `
        <div class="pg-compose-closed">
          <button type="button" class="pg-write-button" data-open-compose>글쓰기</button>
        </div>
      `;
    }

    function open(category = categoryFromTarget(getActiveTarget && getActiveTarget())) {
      openCategory = category;
      root.innerHTML = `
        <section class="pg-compose" aria-label="글쓰기">
          <div class="pg-compose-head">
            <h2>글쓰기</h2>
            <button type="button" class="pg-compose-close" data-close-compose>닫기</button>
          </div>
          ${formHtml(openCategory)}
        </section>
      `;
    }

    function close() {
      renderClosed();
    }

    root.addEventListener('click', (event) => {
      if (event.target.closest('[data-open-compose]')) open();
      if (event.target.closest('[data-close-compose]')) close();
    });

    root.addEventListener('change', (event) => {
      if (event.target.name === 'category') open(event.target.value);
    });

    root.addEventListener('submit', async (event) => {
      const form = event.target.closest('[data-playground-compose-form]');
      if (!form) return;
      event.preventDefault();
      const status = form.querySelector('[data-compose-status]');
      const formData = new FormData(form);
      const category = formData.get('category');
      const postType = POST_TYPE_BY_CATEGORY[category];
      if (!postType) {
        status.textContent = '이 게시판은 아직 글쓰기를 지원하지 않습니다.';
        return;
      }

      status.textContent = '올리는 중입니다.';
      try {
        const result = await api.createPost({
          postType,
          title: formData.get('title'),
          body: formData.get('body'),
          visibility: formData.get('visibility'),
          displayMode: formData.get('displayMode'),
          youtubeUrl: formData.get('youtubeUrl') || null
        });
        status.textContent = '글이 올라갔습니다.';
        close();
        if (onCreated) onCreated(result);
      } catch (error) {
        status.textContent = error.message || '글을 올리지 못했어요.';
      }
    });

    document.addEventListener('playground:tab-change', (event) => {
      openCategory = categoryFromTarget(event.detail);
    });

    renderClosed();
    return { open, close };
  }

  window.KalisPlaygroundCompose = {
    initPlaygroundCompose,
    PLAYGROUND_GUIDES
  };
})();
