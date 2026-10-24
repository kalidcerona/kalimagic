export const STORAGE_KEY = 'magic-choice.v1.store';
export const BACKUP_KEY = 'magic-choice.v1.store.backup';
export const SWIPE_PX = 96;

export const PUBLIC_COPY = {
  choose: '번호를 선택하세요',
  reveal: '목록 보기'
};

export const APPEARANCES = {
  memo: { heading: '메모', icon: '✎' },
  ranking: { heading: '순위', icon: '1' },
  todo: { heading: '할 일', icon: '☐' },
  menu: { heading: '메뉴', icon: '✦' },
  travel: { heading: '여행', icon: '⌖' }
};

export const MSG = {
  emptyList: '목록이 비어 있습니다.',
  tooManyItems: '항목은 200개를 넘길 수 없습니다.',
  badItemType: '목록 형식이 올바르지 않습니다.',
  badChoice: '번호는 1부터 목록 개수까지의 정수여야 합니다.',
  badTarget: '목표 항목 위치가 올바르지 않습니다.',
  needTarget: '목표 항목을 선택하세요.',
  locked: '이미 공개된 결과입니다.',
  chooseFirst: '번호를 먼저 선택하세요.',
  differentLists: '서로 다른 두 목록을 선택하세요.',
  missingList: '목록을 찾을 수 없습니다.',
  corruptJson: '저장된 데이터를 읽을 수 없습니다. 원본은 그대로 두었습니다.',
  badShape: '저장된 데이터 구조가 올바르지 않습니다. 원본은 그대로 두었습니다.',
  partial: '일부 목록만 복구할 수 있습니다. 원본은 그대로 두었습니다.',
  duplicateName: '같은 이름의 목록이 있습니다.',
  needName: '목록 이름을 입력하세요.',
  nameTooLong: '목록 이름은 40자까지 입력할 수 있습니다.',
  badAppearance: '목록 모양이 올바르지 않습니다.',
  unknownVersion: '지원하지 않는 저장 버전입니다. 원본은 그대로 두었습니다.',
  badMode: '공연 방식이 올바르지 않습니다.',
  storageRead: '저장소를 읽지 못했습니다.',
  storageWrite: '저장 공간이 부족하거나 저장소에 쓸 수 없습니다.',
  badTwoList: '두 목록 설정을 읽을 수 없습니다. 원본은 그대로 두었습니다.',
  needForce: '예언 항목을 입력하세요.'
};

const MAX_ITEMS = 200;
const MAX_CHARS = 120;
const MAX_NAME = 40;

export function charLength(value) {
  return Array.from(String(value)).length;
}

// Where the app opens: the settings screen, or the performance (fake home screen first).
export const START_MODES = ['settings', 'performance'];
export const DISPLAY_MODES = ['performance', 'practice'];

export const NOTE_FONT_RANGE = { min: 14, max: 30, step: 1 };
export const NOTE_LINE_HEIGHTS = ['compact', 'normal', 'relaxed'];
export const NOTE_EMPHASES = ['none', 'bold', 'highlight', 'underline'];
export const ICON_SIZE_RANGE = { min: 80, max: 120 };
export const LABEL_SIZE_RANGE = { min: 10, max: 16 };
export const BOTTOM_GAP_RANGE = { min: 0, max: 120 };
export const WALLPAPERS = ['default', 'photo'];

export function defaultOptions() {
  return {
    startMode: 'settings',
    display: 'performance',
    vibrate: false,
    noteFont: 17,
    noteLine: 'normal',
    noteEmphasis: 'none',
    iconSize: 100,
    labelSize: 13,
    bottomGap: 0,
    wallpaper: 'default',
    wallpaperId: ''
  };
}

function clampNumber(value, range, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(range.min, Math.min(range.max, Math.round(value)));
}

// Lenient on purpose: an unknown or missing option falls back to its default and
// never rejects the store, so saved notes and targets are not put at risk.
export function normalizeOptions(value) {
  const base = defaultOptions();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  return {
    // Older saves used 'normal' (number picker) and 'home-notes'. Both now mean the performance.
    startMode: START_MODES.includes(value.startMode) ? value.startMode
      : (value.startMode === 'normal' || value.startMode === 'home-notes' ? 'performance' : base.startMode),
    display: DISPLAY_MODES.includes(value.display) ? value.display : base.display,
    vibrate: value.vibrate === true,
    noteFont: clampNumber(value.noteFont, NOTE_FONT_RANGE, base.noteFont),
    noteLine: NOTE_LINE_HEIGHTS.includes(value.noteLine) ? value.noteLine : base.noteLine,
    noteEmphasis: NOTE_EMPHASES.includes(value.noteEmphasis) ? value.noteEmphasis : base.noteEmphasis,
    iconSize: clampNumber(value.iconSize, ICON_SIZE_RANGE, base.iconSize),
    labelSize: clampNumber(value.labelSize, LABEL_SIZE_RANGE, base.labelSize),
    bottomGap: clampNumber(value.bottomGap, BOTTOM_GAP_RANGE, base.bottomGap),
    wallpaper: WALLPAPERS.includes(value.wallpaper) ? value.wallpaper : base.wallpaper,
    // Names the stored photo so a new photo can be written before the old one is dropped.
    wallpaperId: typeof value.wallpaperId === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(value.wallpaperId) ? value.wallpaperId : base.wallpaperId
  };
}

export { MAX_ITEMS, MAX_CHARS, MAX_NAME };
