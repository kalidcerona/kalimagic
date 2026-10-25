import { LIMITS, normalizeCoverage } from './logic.js';
import {
  CELL_GUIDE_KEY, COVERAGE_KEY, cellGuideInput, coverageInput, coverageReadout,
} from './dom.js';
import { setError, setStatus } from './status.js';

let cellGuideEnabled = false;
let coverageSize = LIMITS.defaultCoverage;

// Missing or unreadable values stay off. Other stored presets and photos are left untouched.
function parseCellGuideEnabled(raw) {
  if (typeof raw !== 'string' || !raw) return false;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  return parsed.enabled === true;
}

function loadCellGuidePreference() {
  cellGuideEnabled = false;
  try {
    cellGuideEnabled = parseCellGuideEnabled(localStorage.getItem(CELL_GUIDE_KEY));
  } catch {
    cellGuideEnabled = false;
  }
  if (cellGuideInput) cellGuideInput.checked = cellGuideEnabled;
}

function loadCoveragePreference() {
  try {
    const raw = localStorage.getItem(COVERAGE_KEY);
    coverageSize = raw === null ? LIMITS.defaultCoverage : normalizeCoverage(JSON.parse(raw));
  } catch {
    coverageSize = LIMITS.defaultCoverage;
  }
  coverageInput.value = String(coverageSize);
  coverageReadout.textContent = `${coverageSize}px`;
}

function onCoverageChange() {
  if (coverageInput.disabled) return;
  const next = normalizeCoverage(coverageInput.value);
  try {
    const payload = JSON.stringify(next);
    localStorage.setItem(COVERAGE_KEY, payload);
    if (localStorage.getItem(COVERAGE_KEY) !== payload) throw new Error('verify');
  } catch {
    coverageInput.value = String(coverageSize);
    coverageReadout.textContent = `${coverageSize}px`;
    setError('지우개 범위를 저장하지 못했습니다. 이전 설정을 유지합니다.');
    return;
  }
  coverageSize = next;
  coverageReadout.textContent = `${next}px`;
}

function persistCellGuideEnabled(enabled) {
  const payload = JSON.stringify({ version: 1, enabled: Boolean(enabled) });
  const previous = localStorage.getItem(CELL_GUIDE_KEY);
  localStorage.setItem(CELL_GUIDE_KEY, payload);
  const stored = localStorage.getItem(CELL_GUIDE_KEY);
  if (stored !== payload) {
    if (previous == null) localStorage.removeItem(CELL_GUIDE_KEY);
    else localStorage.setItem(CELL_GUIDE_KEY, previous);
    throw new Error('verify');
  }
}

function onCellGuideChange() {
  if (!cellGuideInput || cellGuideInput.disabled) return;
  const next = cellGuideInput.checked === true;
  try {
    persistCellGuideEnabled(next);
  } catch {
    cellGuideInput.checked = cellGuideEnabled;
    setError('칸 번호 안내 설정을 저장하지 못했습니다. 기존 저장 내용은 바꾸지 않았습니다.');
    return;
  }
  cellGuideEnabled = next;
  setStatus(next
    ? '칸 이미지 미리보기를 켰습니다. 12칸 공연을 시작할 때만 카드가 잠시 비칩니다.'
    : '칸 이미지 미리보기를 껐습니다. 공연 화면은 검은 상태로 시작합니다.');
}

export {
  cellGuideEnabled, coverageSize, loadCellGuidePreference, loadCoveragePreference, onCoverageChange,
  onCellGuideChange,
};
