// playground-youtube-lite.mjs
//
// 목적: Q&A 상세/답변에서 유튜브 영상을 iframe으로 즉시 로드하지 않고,
// 썸네일 카드 클릭 시 youtube-nocookie iframe을 생성함.

import { normalizeYouTube } from './playground-youtube.mjs';

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

export function createYouTubeLiteEmbed(input, options = {}) {
  const normalized = normalizeYouTube(input);
  const title = options.title || '첨부된 유튜브 영상';

  const wrapper = document.createElement('div');
  wrapper.className = 'yt-lite';

  if (!normalized.ok) {
    wrapper.classList.add('yt-lite--invalid');
    wrapper.textContent = options.invalidText || '유효하지 않은 유튜브 링크임';
    return wrapper;
  }

  wrapper.dataset.youtubeId = normalized.videoId;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'yt-lite__button';
  button.setAttribute('aria-label', `${title} 재생`);
  button.style.backgroundImage = `url("${normalized.thumbnailUrl}")`;

  const play = createTextElement('span', 'yt-lite__play', '▶');
  play.setAttribute('aria-hidden', 'true');

  const label = createTextElement('span', 'yt-lite__label', title);

  button.append(play, label);

  button.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.className = 'yt-lite__iframe';
    iframe.src = normalized.embedUrlAutoplay;
    iframe.title = title;
    iframe.allow = [
      'accelerometer', 'autoplay', 'clipboard-write', 'encrypted-media',
      'gyroscope', 'picture-in-picture', 'web-share',
    ].join('; ');
    iframe.allowFullscreen = true;
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    wrapper.replaceChildren(iframe);
    wrapper.classList.add('yt-lite--loaded');
  }, { once: true });

  wrapper.append(button);
  return wrapper;
}

export function mountYouTubeLiteEmbeds(root = document) {
  const targets = root.querySelectorAll('[data-youtube-url]:not([data-youtube-mounted])');
  for (const target of targets) {
    const url = target.getAttribute('data-youtube-url');
    const title = target.getAttribute('data-youtube-title') || '첨부된 유튜브 영상';
    target.replaceChildren(createYouTubeLiteEmbed(url, { title }));
    target.setAttribute('data-youtube-mounted', 'true');
  }
}
