(function () {
  const POST_SHARE_PATH = '/p/';
  const escapeHtml = window.PgUtil.escapeHtml;

  function postShareUrl(postId) {
    return new URL(`${POST_SHARE_PATH}${encodeURIComponent(postId)}`, window.location.origin).href;
  }

  function roleBadgeHtml(role) {
    return window.KalisBadges && typeof window.KalisBadges.badgeHtml === 'function'
      ? window.KalisBadges.badgeHtml(role)
      : '';
  }

  function imageBadgesHtml(codes) {
    return window.KalisBadges && typeof window.KalisBadges.imageBadgesHtml === 'function'
      ? window.KalisBadges.imageBadgesHtml(codes)
      : '';
  }

  function answerRoleChipHtml(role) {
    const labels = { expert: '전문가', god: '마술의 신' };
    const key = String(role || '').trim().toLowerCase();
    const label = labels[key];
    return label ? `<span class="answer-role-chip answer-role-chip--${key}">${label}</span>` : '';
  }

  function reportButtonHtml(targetType, targetId, isOwn) {
    if (isOwn || !targetId) return '';
    return `<button type="button" class="pg-report-button" data-report-target-type="${targetType}" data-report-target-id="${escapeHtml(targetId)}">신고</button>`;
  }

  function authorIdAttr(authorId) {
    return authorId ? ` data-author-id="${escapeHtml(authorId)}"` : '';
  }


  function countText(post, key) {
    if (post.canReadBody === false || post[key] === null || post[key] === undefined) return '-';
    return String(post[key]);
  }

  function createYouTubeLiteEmbed(videoId, title) {
    const id = String(videoId || '').trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return '';
    return `
      <div class="yt-lite">
        <button
          type="button"
          class="yt-lite__button"
          aria-label="${escapeHtml(title || '첨부된 유튜브 영상')} 재생"
          data-youtube-id="${escapeHtml(id)}"
          style="background-image: url(&quot;https://img.youtube.com/vi/${escapeHtml(id)}/hqdefault.jpg&quot;)"
        >
          <span class="yt-lite__play" aria-hidden="true">▶</span>
          <span class="yt-lite__label">${escapeHtml(title || '첨부된 유튜브 영상')}</span>
        </button>
      </div>
    `;
  }

  function bodyHtml(post) {
    if (post.canReadBody === false || post.bodyLocked) {
      return '<div class="pg-locked-body">비공개 글입니다. 본문 읽기 권한이 필요합니다.</div>';
    }
    const body = escapeHtml(post.body || '').replaceAll('\n', '<br>');
    return `<div class="pg-detail-body">${body}</div>${createYouTubeLiteEmbed(post.youtubeVideoId, '질문에 첨부된 영상')}`;
  }

  function answerForm(post) {
    return `
      <form class="playground-comment-form" data-answer-form>
        <h4 class="playground-answer-form-title">답변 작성</h4>
        <textarea name="body" rows="4" required placeholder="답변 내용을 적어주세요."></textarea>
        <select name="visibility">
          <option value="public" ${post.visibility === 'public' ? 'selected' : ''}>전체 공개</option>
          <option value="author_only" ${post.visibility !== 'public' ? 'selected' : ''}>질문자에게만</option>
        </select>
        <input name="youtubeUrl" type="url" placeholder="유튜브 링크 선택">
        <button type="submit" class="playground-button">답변 등록</button>
        <p class="playground-form-status" data-answer-status></p>
      </form>
    `;
  }

  function answerHelpfulButton(answer) {
    if (answer.canMarkHelpful === false) return '';
    return `
      <button
        type="button"
        class="pg-answer-helpful-button ${answer.viewerHelpful ? 'is-active' : ''}"
        data-answer-helpful="${escapeHtml(answer.id)}"
        aria-pressed="${answer.viewerHelpful ? 'true' : 'false'}"
      >
        ${answer.viewerHelpful ? '도움됐어요 취소' : '도움됐어요'}
      </button>
    `;
  }

  function answerHtml(post, answers, viewerCanAnswer) {
    return `
      <section class="pg-detail-section">
        <h3>답변</h3>
        ${answers && answers.length ? answers.map((answer) => `
          <article class="pg-answer">
            <p>${escapeHtml(answer.body || '').replaceAll('\n', '<br>')}</p>
            ${createYouTubeLiteEmbed(answer.youtubeVideoId, '답변에 첨부된 영상')}
            <small${authorIdAttr(answer.authorId)}>${escapeHtml(answer.authorLabel || '익명')}${answerRoleChipHtml(answer.authorRole)}${imageBadgesHtml(answer.authorBadges)}</small>
            <div class="pg-answer-actions">${answerHelpfulButton(answer)}</div>
          </article>
        `).join('') : '<p class="pg-loading">아직 답변이 없습니다.</p>'}
        ${viewerCanAnswer ? answerForm(post) : ''}
      </section>
    `;
  }

  function commentForm(parentCommentId) {
    return `
      <form class="playground-comment-form" data-comment-form data-parent-comment-id="${escapeHtml(parentCommentId || '')}">
        <textarea name="body" rows="3" required placeholder="${parentCommentId ? '답글을 남겨주세요.' : '댓글을 남겨주세요.'}"></textarea>
        <select name="displayMode">
          <option value="nickname">닉네임</option>
          <option value="anonymous">익명</option>
        </select>
        <button type="submit" class="playground-button">${parentCommentId ? '답글 올리기' : '댓글 올리기'}</button>
        <p class="playground-form-status" data-comment-status></p>
      </form>
    `;
  }

  function commentLoginButtonHtml() {
    return '<button type="button" class="playground-button" data-comment-login>로그인하고 댓글 남기기</button>';
  }

  function commentHtml(comments, viewerCanComment, viewerUserId) {
    return `
      <section class="pg-detail-section">
        <h3>댓글</h3>
        ${comments && comments.length ? comments.map((comment) => `
          <article class="${comment.parentCommentId ? 'pg-comment is-reply' : 'pg-comment'}">
            <strong${authorIdAttr(comment.authorId)}>${escapeHtml(comment.authorLabel || '익명')}${roleBadgeHtml(comment.authorRole)}${imageBadgesHtml(comment.authorBadges)}</strong>
            <p>${escapeHtml(comment.body || '').replaceAll('\n', '<br>')}</p>
            ${comment.parentCommentId || !viewerCanComment ? '' : `<button type="button" class="pg-reply-button" data-reply-to="${escapeHtml(comment.id)}">답글</button>`}
            ${viewerCanComment ? reportButtonHtml('comment', comment.id, comment.authorId === viewerUserId) : ''}
          </article>
        `).join('') : '<p class="pg-loading">아직 댓글이 없습니다.</p>'}
        ${viewerCanComment ? commentForm(null) : commentLoginButtonHtml()}
      </section>
    `;
  }

  function detailHtml(data) {
    const { post, answers, comments } = data;
    const authorBadge = roleBadgeHtml(post.authorRole);
    const likeButton = post.canReadBody === false ? '' : `
      <button type="button" class="pg-like-button ${post.viewerLiked ? 'is-active' : ''}" data-like-post="${escapeHtml(post.id)}">
        ${post.viewerLiked ? '추천 취소' : '추천'}
      </button>
    `;
    const deleteButton = post.canDelete ? `
      <button type="button" class="pg-delete-button" data-delete-post="${escapeHtml(post.id)}">삭제</button>
    ` : '';
    const nativeShareButton = typeof navigator.share === 'function' ? `
      <button type="button" class="pg-share-button" data-share-post>공유하기</button>
    ` : '';

    return `
      <article class="pg-detail">
        <header class="pg-detail-head">
          <span class="pg-prefix">${escapeHtml(post.prefix || '')}</span>
          <h2>${post.isNotice ? '📌 ' : ''}${escapeHtml(post.title)}</h2>
          <div class="pg-detail-meta">
            <span${authorIdAttr(post.authorId)}>${escapeHtml(post.authorLabel || '익명')}${authorBadge}${imageBadgesHtml(post.authorBadges)}</span>
            <span>${window.PgUtil.formatDate(post.createdAt, 'detail')}</span>
            <span>조회 ${countText(post, 'viewCount')}</span>
            <span data-like-count>추천 ${countText(post, 'likeCount')}</span>
          </div>
          <div class="pg-detail-actions">
            ${likeButton}
            ${deleteButton}
            ${data.viewerCanComment ? reportButtonHtml('post', post.id, post.canDelete || post.authorId === data.viewerUserId) : ''}
          </div>
        </header>
        <div class="pg-share-row">
          <button type="button" class="pg-share-button" data-copy-post-link>링크 복사</button>
          ${nativeShareButton}
          <span class="pg-share-status" data-share-status role="status" aria-live="polite"></span>
        </div>
        ${bodyHtml(post)}
        ${post.canReadBody === false ? '' : answerHtml(post, answers || [], data.viewerCanAnswer)}
        ${post.canReadBody === false ? '' : commentHtml(comments || [], data.viewerCanComment, data.viewerUserId)}
        <p class="pg-detail-status" data-detail-status></p>
      </article>
    `;
  }

  function initPlaygroundDetail({ api, root }) {
    let currentPost = null;
    let currentPostId = null;
    let currentViewerId = null;
    let shareStatusTimer = null;

    function showShareStatus(message) {
      const status = root.querySelector('[data-share-status]');
      if (!status) return;
      status.textContent = message;
      window.clearTimeout(shareStatusTimer);
      shareStatusTimer = window.setTimeout(() => {
        status.textContent = '';
      }, 2400);
    }

    function clear() {
      currentPost = null;
      currentPostId = null;
      root.innerHTML = '<p class="pg-detail-placeholder">글을 선택하면 상세 내용이 열립니다.</p>';
    }

    async function loadPost(postId) {
      currentPostId = postId;
      root.innerHTML = '<p class="pg-loading">글을 불러오는 중입니다.</p>';
      try {
        const data = await api.getPostDetail(postId);
        const session = window.MagicAuth && window.MagicAuth.getSession
          ? await window.MagicAuth.getSession()
          : null;
        data.viewerCanComment = Boolean(session);
        data.viewerUserId = session?.user?.id || null;
        currentPost = data.post;
        currentViewerId = data.viewerUserId;
        root.innerHTML = detailHtml(data);
      } catch (error) {
        console.error('Failed to load playground post detail:', error);
        root.innerHTML = `
          <div class="pg-empty pg-error">
            <svg class="pg-empty-icon" viewBox="0 0 24 24" fill="none" stroke="var(--point-gold)" aria-hidden="true">
              <path d="M12 8v4"></path>
              <path d="M12 16h.01"></path>
              <path d="M10.3 3.9h3.4l8.1 14.2-1.7 2.9H3.9l-1.7-2.9 8.1-14.2Z"></path>
            </svg>
            <p>기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
          </div>
        `;
      }
    }

    root.addEventListener('click', async (event) => {
      const youtubeButton = event.target.closest('[data-youtube-id]');
      if (youtubeButton) {
        const id = youtubeButton.dataset.youtubeId;
        const wrapper = youtubeButton.closest('.yt-lite');
        wrapper.innerHTML = `
          <iframe
            class="yt-lite__iframe"
            src="https://www.youtube-nocookie.com/embed/${escapeHtml(id)}?autoplay=1"
            title="${escapeHtml((youtubeButton.querySelector('.yt-lite__label')?.textContent || '').trim() || '첨부된 유튜브 영상')}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
            loading="lazy"
          ></iframe>
        `;
        wrapper.classList.add('yt-lite--loaded');
        return;
      }

      const commentLoginButton = event.target.closest('[data-comment-login]');
      if (commentLoginButton && window.MagicAuth && window.MagicAuth.login) {
        await window.MagicAuth.login();
        return;
      }

      const copyLinkButton = event.target.closest('[data-copy-post-link]');
      if (copyLinkButton && currentPost) {
        const url = postShareUrl(currentPost.id);
        try {
          if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
            throw new Error('clipboard_unavailable');
          }
          await navigator.clipboard.writeText(url);
        } catch {
          window.prompt('아래 링크를 복사해주세요.', url);
        }
        showShareStatus('링크를 복사했어요');
        return;
      }

      const shareButton = event.target.closest('[data-share-post]');
      if (shareButton && currentPost && typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: currentPost.title,
            url: postShareUrl(currentPost.id)
          });
        } catch (error) {
          if (error.name !== 'AbortError') showShareStatus('공유하지 못했어요');
        }
        return;
      }

      const likeButton = event.target.closest('[data-like-post]');
      if (likeButton && currentPost) {
        const status = root.querySelector('[data-detail-status]');
        try {
          const result = await api.togglePostLike(likeButton.dataset.likePost);
          currentPost.likeCount = result.likeCount;
          currentPost.viewerLiked = result.viewerLiked;
          likeButton.classList.toggle('is-active', result.viewerLiked);
          likeButton.textContent = result.viewerLiked ? '추천 취소' : '추천';
          const likeCount = root.querySelector('[data-like-count]');
          if (likeCount) likeCount.textContent = `추천 ${result.likeCount}`;
        } catch (error) {
          if (status) status.textContent = error.status === 401 ? '로그인하면 추천할 수 있어요' : error.message;
        }
        return;
      }

      const reportButton = event.target.closest('[data-report-target-type]');
      if (reportButton && currentViewerId) {
        const reason = window.prompt('신고 사유를 입력해주세요.');
        if (reason === null) return;
        const status = root.querySelector('[data-detail-status]');
        const trimmedReason = reason.trim();
        if (trimmedReason.length < 1 || trimmedReason.length > 300) {
          if (status) status.textContent = '신고 사유는 1~300자로 입력해주세요.';
          return;
        }
        reportButton.disabled = true;
        try {
          const result = await api.fetchJson('/.netlify/functions/report', {
            method: 'POST',
            body: JSON.stringify({
              targetType: reportButton.dataset.reportTargetType,
              targetId: reportButton.dataset.reportTargetId,
              reason: trimmedReason
            })
          });
          if (status) status.textContent = result.already ? '이미 신고했어' : '신고 접수됐어';
        } catch (error) {
          if (status) status.textContent = error.status === 401 ? '로그인하면 신고할 수 있어요' : (error.message || '신고를 접수하지 못했어요.');
        } finally {
          reportButton.disabled = false;
        }
        return;
      }

      const answerHelpfulButton = event.target.closest('[data-answer-helpful]');
      if (answerHelpfulButton) {
        const status = root.querySelector('[data-detail-status]');
        const answerId = answerHelpfulButton.dataset.answerHelpful;
        const active = answerHelpfulButton.classList.contains('is-active');
        answerHelpfulButton.disabled = true;
        try {
          const result = active
            ? await api.unmarkAnswerHelpful(answerId)
            : await api.markAnswerHelpful(answerId);
          answerHelpfulButton.classList.toggle('is-active', result.helpful);
          answerHelpfulButton.setAttribute('aria-pressed', result.helpful ? 'true' : 'false');
          answerHelpfulButton.textContent = result.helpful ? '도움됐어요 취소' : '도움됐어요';
        } catch (error) {
          if (status) {
            status.textContent = error.status === 401
              ? '로그인하면 답변을 표시할 수 있어요'
              : error.status === 403
                ? '내 답변에는 표시할 수 없어요'
                : error.message;
          }
        } finally {
          answerHelpfulButton.disabled = false;
        }
        return;
      }

      const deleteButton = event.target.closest('[data-delete-post]');
      if (deleteButton && currentPost) {
        const ok = window.confirm('이 글을 삭제할까요?');
        if (!ok) return;
        const status = root.querySelector('[data-detail-status]');
        try {
          await api.deletePost(deleteButton.dataset.deletePost);
          root.innerHTML = '<p class="pg-detail-status">글이 삭제되었습니다.</p>';
          document.dispatchEvent(new CustomEvent('playground:post-deleted'));
        } catch (error) {
          if (status) status.textContent = error.message || '답변이 달린 질문은 삭제할 수 없어요';
        }
        return;
      }

      const replyButton = event.target.closest('[data-reply-to]');
      if (replyButton) {
        const item = replyButton.closest('.pg-comment');
        if (item && !item.querySelector('[data-comment-form]')) {
          item.insertAdjacentHTML('beforeend', commentForm(replyButton.dataset.replyTo));
        }
      }
    });

    root.addEventListener('submit', async (event) => {
      const answer = event.target.closest('[data-answer-form]');
      if (answer && currentPost) {
        event.preventDefault();
        const status = answer.querySelector('[data-answer-status]');
        const formData = new FormData(answer);
        status.textContent = '답변을 등록하는 중입니다.';
        try {
          await api.fetchJson('/.netlify/functions/answers', {
            method: 'POST',
            body: JSON.stringify({
              questionPostId: currentPost.id,
              body: formData.get('body'),
              visibility: formData.get('visibility'),
              youtubeUrl: formData.get('youtubeUrl')
            })
          });
          await loadPost(currentPostId);
        } catch (error) {
          status.textContent = error.message || '답변을 등록하지 못했어요.';
        }
        return;
      }

      const comment = event.target.closest('[data-comment-form]');
      if (comment && currentPostId) {
        event.preventDefault();
        const status = comment.querySelector('[data-comment-status]');
        const formData = new FormData(comment);
        const parentCommentId = comment.dataset.parentCommentId || null;
        status.textContent = '댓글을 올리는 중입니다.';
        try {
          await api.fetchJson('/.netlify/functions/comments', {
            method: 'POST',
            body: JSON.stringify({
              postId: currentPostId,
              parentCommentId,
              body: formData.get('body'),
              displayMode: formData.get('displayMode')
            })
          });
          await loadPost(currentPostId);
        } catch (error) {
          status.textContent = error.message || '댓글을 올리지 못했어요.';
        }
      }
    });

    document.addEventListener('playground:select-post', (event) => {
      loadPost(event.detail.postId);
    });

    if (window.KalisBadges && typeof window.KalisBadges.bindAuthorCells === 'function') {
      window.KalisBadges.bindAuthorCells(root);
    }

    clear();
    return { loadPost, clear };
  }

  window.KalisPlaygroundDetail = {
    initPlaygroundDetail
  };
})();
