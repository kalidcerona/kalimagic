// Limits, labels and user-facing messages for ALETHEIA.

export const LIMITS = Object.freeze({
  maxPresets: 8,
  maxNameLength: 24,
  maxImageBytes: 6 * 1024 * 1024,
  minBrush: 12,
  maxBrush: 140,
  defaultBrush: 46,
  minCoverage: 40,
  maxCoverage: 260,
  defaultCoverage: 110,
  minHidden: 0,
  maxHidden: 100,
  defaultHidden: 100,
  gestureDistance: 96,
  stageCount: 4,
  stageUnlockRatio: 0.6,
  maxMaskSide: 1600,
  gradualStampAlpha: 0.22,
  allowedMime: Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
});

export const MODES = Object.freeze(['free', 'gradual', 'stages']);

export const MODE_LABELS = Object.freeze({
  free: '자유 스크래치',
  gradual: '서서히 공개',
  stages: '단계 공개',
});

export const MODE_HINTS = Object.freeze({
  free: '문지른 자리가 바로 열립니다.',
  gradual: '같은 자리를 여러 번 문질러야 조금씩 드러납니다.',
  stages: '위쪽 구역부터 순서대로 열립니다. 현재 구역만 문지를 수 있습니다.',
});

export const TITLES = Object.freeze({
  settings: 'ALETHEIA',
  performance: '이미지',
  installed: '이미지',
});

export const VEIL_COLOR = '#121212';
export const STAGE_COLOR = '#000000';
export const ERASED_ALPHA_MAX = 128;

export const MESSAGES = Object.freeze({
  nameRequired: '이름을 입력하세요. 최대 24자입니다.',
  nameTooLong: '이름은 24자 이하여야 합니다.',
  nameInvalid: '이름에 사용할 수 없는 문자가 있습니다.',
  modeInvalid: '공개 방식은 자유 스크래치, 서서히 공개, 단계 공개 중에서 고르세요.',
  brushInvalid: '붓 크기는 12에서 140 사이의 숫자여야 합니다.',
  hiddenInvalid: '처음 가림 비율은 비우거나 0에서 100 사이의 숫자여야 합니다.',
  imageRequired: '공개할 이미지를 선택하세요.',
  imageEmpty: '이미지 파일이 비어 있습니다. 기존 데이터는 바꾸지 않았습니다.',
  imageTooLarge: '이미지는 6MB 이하여야 합니다. 이 파일은 저장하지 않았고, 기존 데이터도 바꾸지 않았습니다.',
  imageType: 'JPEG, PNG, WEBP, GIF 이미지만 사용할 수 있습니다. 기존 데이터는 바꾸지 않았습니다.',
  tooManyPresets: '프리셋은 최대 8개까지 저장할 수 있습니다. 기존 프리셋은 유지됩니다.',
  metaCorrupt: '저장된 프리셋 정보를 해석할 수 없습니다. 기존 데이터는 자동으로 지우지 않았습니다.',
  storageFailed: '저장에 실패했습니다. 기존 데이터는 바꾸지 않았습니다.',
  storageReadFailed: '저장된 데이터를 읽지 못했습니다. 기존 값을 바꾸지 않도록 저장을 막아 두었습니다.',
  imageStoreFailed: '이미지를 저장하지 못했습니다. 기존 프리셋은 바꾸지 않았습니다.',
  imageReadFailed: '이미지를 불러오지 못했습니다. 프리셋은 그대로 두었습니다.',
  dbOpenFailed: '이미지 저장소를 열지 못했습니다. 프리셋 목록은 바꾸지 않았습니다.',
  imageMissing: '이 프리셋의 이미지를 찾지 못했습니다. 프리셋 목록은 유지했습니다.',
  imageDecodeFailed: '이미지를 열 수 없습니다. 프리셋은 유지했습니다.',
  imageDeleteFailed: '프리셋 목록에서는 뺐지만 이미지 파일을 지우지 못했습니다. 다른 프리셋은 그대로입니다.',
  previousImageKept: '프리셋은 저장했습니다. 이전 이미지 파일은 지우지 못했습니다.',
  resetImagesFailed: '프리셋 목록은 비웠지만 일부 이미지를 지우지 못했습니다.',
  choosePreset: '공연할 프리셋을 선택하세요.',
  saved: '저장했습니다.',
  repaired: '읽을 수 있는 프리셋만 다시 저장했습니다.',
});
