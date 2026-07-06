// playground-youtube.mjs
//
// 목적: 마술 놀이터 Q&A에서 유튜브 링크를 안전하게 정규화함.
// 지원: watch?v= / youtu.be / shorts/ / embed/ / nocookie embed / live/ / raw VIDEO_ID

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be',
]);

const PATH_PREFIXES_WITH_ID = new Set(['shorts', 'embed', 'live']);

export function isValidYouTubeId(value) {
  return typeof value === 'string' && YOUTUBE_ID_RE.test(value.trim());
}

function normalizeHost(hostname) {
  return hostname.toLowerCase();
}

function cleanCandidateId(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .trim()
    .replace(/[?&#].*$/, '')
    .replace(/\/+$/, '');
  return YOUTUBE_ID_RE.test(cleaned) ? cleaned : null;
}

export function extractYouTubeId(input) {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw) return null;
  if (YOUTUBE_ID_RE.test(raw)) return raw;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = normalizeHost(url.hostname);
  if (!ALLOWED_HOSTS.has(host)) return null;

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const firstPathPart = url.pathname.split('/').filter(Boolean)[0];
    return cleanCandidateId(firstPathPart);
  }

  if (url.pathname === '/watch') {
    return cleanCandidateId(url.searchParams.get('v'));
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length >= 2 && PATH_PREFIXES_WITH_ID.has(parts[0])) {
    return cleanCandidateId(parts[1]);
  }

  return null;
}

export function buildYouTubeWatchUrl(videoId) {
  if (!isValidYouTubeId(videoId)) return null;
  return `https://www.youtube.com/watch?v=${videoId.trim()}`;
}

export function buildYouTubeEmbedUrl(videoId, options = {}) {
  if (!isValidYouTubeId(videoId)) return null;
  const params = new URLSearchParams();
  if (options.autoplay) params.set('autoplay', '1');
  if (options.rel === false) params.set('rel', '0');
  const query = params.toString();
  const base = `https://www.youtube-nocookie.com/embed/${videoId.trim()}`;
  return query ? `${base}?${query}` : base;
}

export function buildYouTubeThumbnailUrl(videoId, quality = 'hqdefault') {
  if (!isValidYouTubeId(videoId)) return null;
  const allowedQualities = new Set([
    'default', 'mqdefault', 'hqdefault', 'sddefault', 'maxresdefault',
  ]);
  const safeQuality = allowedQualities.has(quality) ? quality : 'hqdefault';
  return `https://img.youtube.com/vi/${videoId.trim()}/${safeQuality}.jpg`;
}

export function normalizeYouTube(input) {
  const videoId = extractYouTubeId(input);
  if (!videoId) {
    return {
      ok: false,
      videoId: null,
      watchUrl: null,
      embedUrl: null,
      embedUrlAutoplay: null,
      thumbnailUrl: null,
      error: 'INVALID_YOUTUBE_URL',
    };
  }
  return {
    ok: true,
    videoId,
    watchUrl: buildYouTubeWatchUrl(videoId),
    embedUrl: buildYouTubeEmbedUrl(videoId, { rel: false }),
    embedUrlAutoplay: buildYouTubeEmbedUrl(videoId, { autoplay: true, rel: false }),
    thumbnailUrl: buildYouTubeThumbnailUrl(videoId),
    error: null,
  };
}
