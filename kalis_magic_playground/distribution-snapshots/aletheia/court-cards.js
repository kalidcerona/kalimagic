import { cardAtIndex } from './logic.js';
import { createDeckSlots } from './deck-loader.js';
import { SUIT_CODE } from './dom.js';
import { liveUrls, revokeUrl, loadKeptImage } from './images.js';

const COURT_CARD_COUNT = 12;

// Local vector faces. currentColor is not used so the SVG paints without a stylesheet.
function suitShape(suit, ink) {
  if (suit === 'heart') {
    return `<path fill="${ink}" d="M50 92C18 66 2 50 2 32 2 16 14 6 28 6c10 0 16 6 22 14C56 12 62 6 72 6c14 0 26 10 26 26 0 18-16 34-48 60z"/>`;
  }
  if (suit === 'diamond') {
    return `<path fill="${ink}" d="M50 2 94 50 50 98 6 50Z"/>`;
  }
  if (suit === 'club') {
    return `<g fill="${ink}"><circle cx="50" cy="30" r="16"/><circle cx="30" cy="54" r="16"/><circle cx="70" cy="54" r="16"/><path d="M43 56h14l8 38H35z"/></g>`;
  }
  return `<g fill="${ink}"><path d="M50 2C50 2 10 36 10 60c0 16 12 26 26 22-2 8-8 16-8 16h36s-6-8-8-16c14 4 26-6 26-22C90 36 50 2 50 2z"/><path d="M42 76h16l8 22H34z"/></g>`;
}

function courtCardSvg(card) {
  const red = card.suit === 'heart' || card.suit === 'diamond';
  const ink = red ? '#C0392B' : '#141414';
  const shape = suitShape(card.suit, ink);
  const rank = card.rank;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1080" viewBox="0 0 720 1080">
  <rect width="720" height="1080" fill="#F7F1E6"/>
  <rect x="22" y="22" width="676" height="1036" rx="36" fill="#FFFCF7" stroke="${ink}" stroke-width="10"/>
  <text x="70" y="140" fill="${ink}" font-family="Georgia, 'Times New Roman', serif" font-size="112" font-weight="700">${rank}</text>
  <g transform="translate(44,156) scale(0.78)">${shape}</g>
  <g transform="translate(360,430) scale(3.15) translate(-50,-50)">${shape}</g>
  <text x="360" y="760" text-anchor="middle" fill="${ink}" font-family="Georgia, 'Times New Roman', serif" font-size="210" font-weight="700">${rank}</text>
  <g transform="translate(720 1080) rotate(180)">
    <text x="70" y="140" fill="${ink}" font-family="Georgia, 'Times New Roman', serif" font-size="112" font-weight="700">${rank}</text>
    <g transform="translate(44,156) scale(0.78)">${shape}</g>
  </g>
</svg>`;
}

function loadSvgImage(svg) {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  liveUrls.add(url);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        revokeUrl(url);
        reject(new Error('decode'));
        return;
      }
      resolve({ image, url });
    };
    image.onerror = () => {
      revokeUrl(url);
      reject(new Error('decode'));
    };
    image.src = url;
  });
}

async function loadVectorCourtDeck() {
  const images = [];
  const urls = [];
  try {
    for (let index = 0; index < COURT_CARD_COUNT; index += 1) {
      const card = cardAtIndex(index);
      if (!card) throw new Error('decode');
      const loaded = await loadSvgImage(courtCardSvg(card));
      images.push(loaded.image);
      urls.push(loaded.url);
    }
    return { images, urls };
  } catch (error) {
    for (const url of urls) revokeUrl(url);
    throw error;
  }
}

function createCourtDeckSlots() {
  const loaders = Array.from({ length: COURT_CARD_COUNT }, (_, index) => async () => {
    const card = cardAtIndex(index);
    if (!card) throw new Error('decode');
    try {
      return { image: await loadKeptImage(`./court-cards/${slotLabel(card)}.webp`) };
    } catch {
      return loadSvgImage(courtCardSvg(card));
    }
  });
  return createDeckSlots(loaders, ({ image, url }) => {
    if (url) revokeUrl(url);
    if (image) image.src = '';
  }, { eager: false });
}

function slotLabel(card) {
  return `${SUIT_CODE[card.suit]}-${card.rank}`;
}

export { COURT_CARD_COUNT, createCourtDeckSlots, slotLabel };
