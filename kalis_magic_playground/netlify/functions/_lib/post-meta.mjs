export const DESCRIPTION_LIMIT = 80;

const SITE_NAME = '칼리형';
const GENERIC_TITLE = '마술문화 기록소 | 칼리형';
const GENERIC_DESCRIPTION = '질문과 후기, 리뷰가 쌓이는 칼리형의 마술문화 기록소입니다.';
const DEFAULT_IMAGE = 'https://kalimagic.netlify.app/assets/profile/portrait.jpg';

function decodeHtmlEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"'
  };
  return String(value || '').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
    if (code[0] !== '#') return named[code.toLowerCase()] ?? entity;
    const point = code[1].toLowerCase() === 'x'
      ? Number.parseInt(code.slice(2), 16)
      : Number.parseInt(code.slice(1), 10);
    try {
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
    } catch {
      return entity;
    }
  });
}

function plainText(value) {
  return decodeHtmlEntities(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`*_~>#-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value, limit) {
  const characters = Array.from(value);
  if (characters.length <= limit) return value;
  return `${characters.slice(0, limit - 1).join('').trimEnd()}…`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildPostMeta(post, canonicalUrl) {
  const title = String(post?.title || '').replace(/\s+/g, ' ').trim();
  const description = truncate(plainText(post?.body), DESCRIPTION_LIMIT) || GENERIC_DESCRIPTION;
  const pageTitle = title ? `${title} | ${SITE_NAME}` : GENERIC_TITLE;
  const ogTitle = title || GENERIC_TITLE;
  const safePageTitle = escapeHtml(pageTitle);
  const safeOgTitle = escapeHtml(ogTitle);
  const safeDescription = escapeHtml(description);
  const safeUrl = escapeHtml(canonicalUrl);

  return {
    description,
    html: [
      `<title>${safePageTitle}</title>`,
      `<meta name="description" content="${safeDescription}">`,
      '<meta property="og:type" content="article">',
      `<meta property="og:title" content="${safeOgTitle}">`,
      `<meta property="og:description" content="${safeDescription}">`,
      `<meta property="og:image" content="${DEFAULT_IMAGE}">`,
      `<meta property="og:url" content="${safeUrl}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<link rel="canonical" href="${safeUrl}">`
    ].join('\n  ')
  };
}

export function injectPostMeta(shell, metaHtml) {
  const pattern = /<!-- POST_META_START -->[\s\S]*?<!-- POST_META_END -->/;
  if (!pattern.test(shell)) throw new Error('post_meta_markers_missing');
  return shell.replace(pattern, `<!-- POST_META_START -->\n  ${metaHtml}\n  <!-- POST_META_END -->`);
}
