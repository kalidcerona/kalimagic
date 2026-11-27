export const InputKind = Object.freeze({ NONE: 'NONE', NUMBER: 'NUMBER', CARD: 'CARD', TEXT: 'TEXT', DATE: 'DATE', SEQUENCE: 'SEQUENCE' });
export const INPUT_KINDS = Object.freeze(['NONE', 'NUMBER', 'CARD', 'TEXT', 'DATE', 'SEQUENCE']);
export const ArmMode = Object.freeze({ ONCE: 'ONCE', ALWAYS: 'ALWAYS', SEQUENCE: 'SEQUENCE' });
const ARM_MODES = ['ONCE', 'ALWAYS', 'SEQUENCE'];

export const KIND_NAME = Object.freeze({ NONE: '목록', NUMBER: '번호', CARD: '카드', TEXT: '검색어', DATE: '날짜', SEQUENCE: '순서대로' });
export const KIND_HELP = Object.freeze({
  NONE: '항목을 누르면 그 주소가 준비됩니다',
  NUMBER: '번호를 누르면 그 번호의 항목이 준비됩니다. 주소에 {number}를 넣으면 누른 번호로 바뀝니다',
  CARD: '카드를 고르면 그 카드의 항목이 준비됩니다. 번호는 QH, 10S 또는 121 같은 숫자로 적습니다. 주소에 {card}를 넣으면 고른 카드로 바뀝니다',
  TEXT: '주소에 {text}를 넣으면 입력한 글자로 바뀝니다',
  DATE: '주소에 {yyyy} {M} {MM} {d} {dd} {MMMM} {mmmm}를 넣으면 고른 날짜로 바뀝니다',
  SEQUENCE: '찍을 때마다 다음 항목이 열리고, 마지막 항목 뒤에는 해제됩니다'
});

export const entry = (id, label, url, code = '') => ({ id, label, url, code });
export const category = (id, name, inputKind, entries) => ({ id, name, inputKind, entries });
export const armed = (categoryId, entryId, label, url, mode, seqIndex = 0) => ({ categoryId, entryId, label, url, mode, seqIndex });
export const recent = (categoryId, entryId, label, url, kind) => ({ categoryId, entryId, label, url, kind });

const replaceAll = (s, token, value) => s.split(token).join(value);
export function sameArmed(a, b) {
  if (!a || !b) return a === b;
  return a.categoryId === b.categoryId && a.entryId === b.entryId && a.label === b.label && a.url === b.url && a.mode === b.mode && a.seqIndex === b.seqIndex;
}

export {
  replaceAll,
  ARM_MODES,
};
