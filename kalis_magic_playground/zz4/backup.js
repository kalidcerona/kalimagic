import {
  IMPORT_MAX_BYTES, applyImportPlan, buildBackup, parseBackup, planImport,
} from './logic.js';
import { precheckRow } from './precheck.js';
import { store, recoveryState, persist } from './controller.js';

const backupMessage = document.getElementById('backup-message');
const importPreview = document.getElementById('import-preview');
const importList = document.getElementById('import-list');

let pendingImport = null;

function onBackupExport() {
  const backup = buildBackup(store, Date.now());
  const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
  const link = document.createElement('a');
  const day = new Date().toISOString().slice(0, 10);
  link.href = URL.createObjectURL(blob);
  link.download = `너의-선택은-백업-${day}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  backupMessage.textContent = `목록 ${backup.presets.length}개, 묶음 ${backup.sets.length}개, 일상 메모 ${backup.dummyNotes.length}개를 내보냈습니다.`;
}

function renderImportPreview(plan, issues) {
  const label = { add: '추가', 'add-copy': '사본으로 추가', skip: '건너뜀', full: '가져오지 못함' };
  const rows = [];
  const push = (kind, entries) => entries.forEach((entry) => rows.push(precheckRow(
    `${kind} 「${entry.newName && entry.newName !== entry.name ? `${entry.name} → ${entry.newName}` : entry.name}」: ${label[entry.action]}${entry.reason ? ` (${entry.reason})` : ''}`,
    entry.action === 'skip' ? '' : (entry.action === 'full' ? 'warn' : 'ok')
  )));
  push('목록', plan.presets);
  push('일상 메모', plan.dummies);
  push('묶음', plan.sets);
  issues.forEach((issue) => rows.push(precheckRow(`읽지 못함: ${issue}`, 'warn')));
  rows.push(precheckRow(`합계: 추가 ${plan.counts.added}개 (그중 사본 ${plan.counts.copies}개), 건너뜀 ${plan.counts.skipped}개${plan.counts.dropped ? `, 한도 때문에 가져오지 못함 ${plan.counts.dropped}개` : ''}. 지금 저장된 것은 바꾸지 않습니다.`, plan.counts.dropped ? 'warn' : ''));
  importList.replaceChildren(...rows);
  importPreview.hidden = false;
  document.getElementById('import-apply').disabled = plan.counts.added === 0;
}

async function onImportFile(event) {
  const file = event.target.files?.[0];
  pendingImport = null;
  importPreview.hidden = true;
  if (!file) return;
  if (recoveryState) { backupMessage.textContent = '저장본을 먼저 처리하세요.'; return; }
  if (file.size > IMPORT_MAX_BYTES) { backupMessage.textContent = '파일이 너무 큽니다. 2MB 이하의 백업 파일만 가져올 수 있습니다.'; event.target.value = ''; return; }
  const text = await file.text().catch(() => '');
  const parsed = parseBackup(text);
  if (!parsed.ok) { backupMessage.textContent = parsed.error; return; }
  const plan = planImport(store, parsed.backup);
  pendingImport = { plan };
  backupMessage.textContent = '';
  renderImportPreview(plan, parsed.issues);
}

function onImportApply() {
  if (!pendingImport) return;
  const merged = applyImportPlan(store, pendingImport.plan);
  const { added: count, dropped } = pendingImport.plan.counts;
  if (!persist({ ...store, presets: merged.presets, sets: merged.sets, dummyNotes: merged.dummyNotes })) {
    backupMessage.textContent = '저장하지 못했습니다. 저장된 목록은 그대로입니다.';
    return;
  }
  pendingImport = null;
  importPreview.hidden = true;
  document.getElementById('import-file').value = '';
  backupMessage.textContent = dropped ? `${count}개를 가져왔습니다. 한도 때문에 ${dropped}개는 가져오지 못했습니다.` : `${count}개를 가져왔습니다.`;
}

function onImportCancel() {
  pendingImport = null;
  importPreview.hidden = true;
  document.getElementById('import-file').value = '';
  backupMessage.textContent = '가져오기를 취소했습니다. 아무것도 바뀌지 않았습니다.';
}

function bindBackup() {
  document.getElementById('export-backup').addEventListener('click', onBackupExport);
  document.getElementById('import-file').addEventListener('change', (event) => { onImportFile(event); });
  document.getElementById('import-apply').addEventListener('click', onImportApply);
  document.getElementById('import-cancel').addEventListener('click', onImportCancel);
}

export { bindBackup };
