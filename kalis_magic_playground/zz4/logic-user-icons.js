import { MSG } from './logic-core.js';
import { cleanText } from './logic-extras.js';
import { HOME_LAYOUT, HOME_PAGES, homeCellDigit } from './logic-fake-home.js';

// ----- User app icons (device only) ------------------------------------------------------

export const USER_ICON_KEY = 'magic-choice.v1.user-icons';
export const USER_ICON_MAX = 24;
export const USER_ICON_LABEL_MAX = 8;
const USER_ICON_DATA = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const USER_ICON_BYTES = 90000;

/** Pages 0-1 keep the keypad block free; page 2 is an ordinary home, every cell is 0. */
export function isZeroSlot(page, row, col) {
  if (!Number.isInteger(page) || !Number.isInteger(row) || !Number.isInteger(col)) return false;
  if (page < 0 || page >= HOME_PAGES || row < 0 || row >= HOME_LAYOUT.rows || col < 0 || col >= HOME_LAYOUT.cols) return false;
  if (page === 2) return true;
  return homeCellDigit(row, col) === 0;
}

// Cells that must keep their own behaviour (the notes app). reserved: [{ page, row, col }].
export function isReservedSlot(page, row, col, reserved = []) {
  return reserved.some((cell) => cell.page === page && cell.row === row && cell.col === col);
}

export function normalizeUserIcons(raw, reserved = []) {
  if (!Array.isArray(raw)) return [];
  const bySlot = new Map();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    if (typeof entry.id !== 'string' || !entry.id) continue;
    if (typeof entry.dataUrl !== 'string' || entry.dataUrl.length > USER_ICON_BYTES || !USER_ICON_DATA.test(entry.dataUrl)) continue;
    if (!isZeroSlot(entry.page, entry.row, entry.col) || isReservedSlot(entry.page, entry.row, entry.col, reserved)) continue;
    const label = cleanText(entry.label, USER_ICON_LABEL_MAX).trim();
    if (!label) continue;
    bySlot.set(`${entry.page}:${entry.row}:${entry.col}`, { id: entry.id, label, dataUrl: entry.dataUrl, page: entry.page, row: entry.row, col: entry.col });
  }
  return [...bySlot.values()].slice(0, USER_ICON_MAX);
}

export function placeUserIcon(icons, input, { now = Date.now(), rand = Math.random(), reserved = [] } = {}) {
  const current = normalizeUserIcons(icons, reserved);
  if (!isZeroSlot(input?.page, input?.row, input?.col)) return { ok: false, error: '이 칸은 숫자 칸이라 쓸 수 없습니다.' };
  if (isReservedSlot(input.page, input.row, input.col, reserved)) return { ok: false, error: '이 칸은 노트 앱 자리라 쓸 수 없습니다.' };
  const label = cleanText(input?.label, USER_ICON_LABEL_MAX).trim();
  if (!label) return { ok: false, error: '앱 이름을 입력하세요.' };
  const icon = { id: input.id || `ui_${now.toString(36)}_${Math.floor(rand * 1e9).toString(36)}`, label, dataUrl: input.dataUrl, page: input.page, row: input.row, col: input.col };
  const checked = normalizeUserIcons([icon], reserved);
  if (!checked.length) return { ok: false, error: '그림을 읽을 수 없거나 너무 큽니다.' };
  const rest = current.filter((entry) => !(entry.page === icon.page && entry.row === icon.row && entry.col === icon.col) && entry.id !== icon.id);
  if (rest.length >= USER_ICON_MAX) return { ok: false, error: `내 앱 아이콘은 ${USER_ICON_MAX}개까지 둘 수 있습니다.` };
  return { ok: true, icon, icons: rest.concat(icon) };
}

export function removeUserIcon(icons, id, reserved = []) {
  const current = normalizeUserIcons(icons, reserved);
  if (!current.some((entry) => entry.id === id)) return { ok: false, error: '아이콘을 찾을 수 없습니다.' };
  return { ok: true, icons: current.filter((entry) => entry.id !== id) };
}

export function loadUserIcons(storage, reserved = []) {
  try {
    const raw = storage.getItem(USER_ICON_KEY);
    return raw ? normalizeUserIcons(JSON.parse(raw), reserved) : [];
  } catch {
    return [];
  }
}

export function saveUserIcons(storage, icons) {
  try {
    storage.setItem(USER_ICON_KEY, JSON.stringify(normalizeUserIcons(icons)));
    return { ok: true };
  } catch {
    return { ok: false, error: MSG.storageWrite };
  }
}
