import { discoverSources, readImportFile } from './data.mjs';
import {
  activateProfile,
  applyImport,
  listProfiles,
  pendingCandidates,
  previewImport,
  readImportDetails,
} from './apply.mjs';
const containers = {
  kairos: '#settings-card',
  'kairos-classic': '#settings-card',
  release: '#settings-screen',
  hitsuzen: '#date-settings',
  choice: '#settings',
  aletheia: '#settings',
  tobira: '#settings',
  usotsuki: '#settings-screen',
  asrai: '#settings-screen',
  alter: '#settings',
  tyche: '#settings',
  memdeck: '[data-product-settings]',
  arosaegida: '#settings',
  pimax: '[data-product-settings]',
  uramichi: '#settings',
};
const node = (tag, text) => {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  return el;
};
function downloadJSON(target, name, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = node('a');
  link.href = url;
  link.download = `${target}-${name}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function comparisonRows(existing, incoming) {
  const left = new Map(existing || []), right = new Map(incoming || []);
  return [...new Set([...left.keys(), ...right.keys()])].sort().map(
    (key) => [key, left.has(key) ? left.get(key) : null, right.has(key) ? right.get(key) : null],
  );
}
function appendComparison(parent, existing, incoming) {
  const detail = node('details');
  detail.append(node('summary', '기존 공개본 / 이전 ZZ본 설정값 비교'));
  const wrap = node('div');
  wrap.style.overflowX = 'auto';
  const table = node('table');
  const head = node('tr');
  for (const label of ['저장 항목', '기존 공개본', '이전 ZZ본']) {
    const cell = node('th', label);
    cell.scope = 'col';
    head.append(cell);
  }
  table.append(head);
  for (const row of comparisonRows(existing, incoming)) {
    const tr = node('tr');
    for (const value of row) {
      const cell = node('td');
      const text = node('pre', value === null ? '(없음)' : value === '' ? '(빈 문자열)' : value);
      text.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;min-width:8rem';
      cell.append(text);
      tr.append(cell);
    }
    table.append(tr);
  }
  wrap.append(table);
  detail.append(wrap);
  parent.append(detail);
}
function appendRetainedDetails(parent, details, target) {
  appendComparison(parent, details.profiles.public?.entries, details.profiles.zz?.entries);
  const archive = node('details');
  archive.append(
    node(
      'summary',
      `보관 전용: 설정 ${details.archiveCounts.settings}건 · 기록 ${details.archiveCounts.records}건`,
    ),
  );
  const text = node('pre', JSON.stringify(details.archive, null, 2));
  text.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:20rem;overflow:auto';
  archive.append(text);
  parent.append(archive);
  parent.append(
    node(
      'p',
      '상세 JSON에는 양쪽 설정 원문과 보관 항목, 사진 참조만 담습니다. 사진 파일은 포함하지 않으며 전체 복원 파일이 아닙니다.',
    ),
  );
  const button = node('button', '보관 상세 JSON 저장 (사진 제외)');
  button.type = 'button';
  button.onclick = () => downloadJSON(target, 'zz-details', details);
  parent.append(button);
}
export function mountImportSettings(target, exclusiveWrite) {
  let starting = false;
  const startWhenVisible = () => {
    const root = document.querySelector(containers[target]);
    if (
      starting || !root || root.closest('[hidden],[aria-hidden="true"]') || !root.getClientRects().length ||
      getComputedStyle(root).visibility === 'hidden'
    ) return;
    starting = true;
    observer.disconnect();
    createImportSettings(target, exclusiveWrite).catch((error) => {
      const message = node('p', `이전 데이터를 확인하지 못했습니다: ${error.message}`);
      message.setAttribute('role', 'status');
      root.append(message);
    });
  };
  const observer = new MutationObserver(startWhenVisible);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-product-settings', 'hidden', 'aria-hidden', 'class', 'style', 'open'],
  });
  startWhenVisible();
}
async function createImportSettings(target, exclusiveWrite) {
  const discovered = await discoverSources(target);
  const candidates = await pendingCandidates(target, discovered.candidates);
  const profiles = await listProfiles(target);
  const panel = node('details');
  panel.dataset.zzImport = '';
  panel.style.cssText =
    'margin:16px 0;padding:12px;border:1px solid currentColor;border-radius:8px;max-width:100%;overflow-wrap:anywhere';
  panel.append(
    node(
      'summary',
      candidates.length
        ? '이전 ZZ 데이터 가져오기'
        : profiles.length
        ? '가져온 ZZ 데이터 관리'
        : '백업 파일 가져오기',
    ),
  );
  const status = node('p');
  status.setAttribute('role', 'status');
  panel.append(status);
  const choices = node('div');
  panel.append(choices);
  let busy = false;
  async function show(candidate) {
    choices.replaceChildren();
    status.textContent = '가져올 내용을 확인하고 있습니다.';
    try {
      const preview = await previewImport(target, candidate);
      if (preview.alreadyImported) {
        status.textContent = '이미 가져온 백업입니다. 보관된 상세와 프로필을 확인할 수 있습니다.';
        const retained = await readImportDetails(target, { contentHash: candidate.contentHash });
        if (retained) {
          appendRetainedDetails(choices, retained, target);
          return;
        }
      }
      status.textContent = '기존 공개본과 백업은 가져온 뒤에도 보관합니다.';
      const counts = node(
        'pre',
        JSON.stringify(preview.counts, null, 2).replaceAll('existing', '기존 공개본').replaceAll(
          'incoming',
          '이전 ZZ본',
        ).replaceAll('archiveSettings', '보관 설정').replaceAll('archiveRecords', '보관 기록').replaceAll(
          'archive',
          '보관 전용',
        ).replaceAll('settings', '설정').replaceAll('records', '기록').replaceAll('photos', '사진')
          .replaceAll('lists', '목록').replaceAll('groups', '묶음').replaceAll('items', '항목').replaceAll(
            'slots',
            '고정 칸',
          ),
      );
      counts.style.whiteSpace = 'pre-wrap';
      choices.append(counts);
      choices.append(
        node(
          'p',
          `설정 충돌 ${
            Array.isArray(preview.conflicts) ? preview.conflicts.length : preview.conflicts || 0
          }건 · 사진 충돌 ${preview.mediaConflicts?.length || 0}건`,
        ),
      );
      appendComparison(choices, preview.existingEntries, preview.incomingEntries);
      const detail = node('details');
      detail.append(node('summary', '원본 설정과 보관 항목 보기'));
      const raw = node('pre', JSON.stringify(candidate.rawEntries, null, 2));
      raw.style.cssText = 'white-space:pre-wrap;max-height:20rem;overflow:auto';
      detail.append(raw);
      choices.append(detail);
      detail.append(
        node(
          'p',
          '매니페스트 JSON에는 설정과 사진 참조만 담습니다. 사진 파일은 포함하지 않아 사진 백업 전체를 복원하는 파일이 아닙니다.',
        ),
      );
      const exportButton = node('button', 'ZZ 매니페스트 JSON 저장 (사진 제외)');
      exportButton.type = 'button';
      exportButton.onclick = () => downloadJSON(target, 'zz-manifest', candidate.snapshot);
      detail.append(exportButton);
      const label = node('label');
      const activate = node('input');
      activate.type = 'checkbox';
      label.append(activate, document.createTextNode(' 가져온 이전 ZZ본을 바로 사용'));
      choices.append(label);
      const confirm = node('button', '둘 다 보관하고 가져오기');
      confirm.type = 'button';
      choices.append(confirm);
      if (preview.invalid?.length) {
        confirm.disabled = true;
        status.textContent =
          '앱에서 읽을 수 없는 항목이 있어 적용하지 않습니다. 원본 설정을 내보내 보관할 수 있습니다.';
        choices.append(node('p', preview.invalid.map((item) => `${item.key}: ${item.message}`).join('\n')));
      }
      confirm.onclick = async () => {
        if (busy) return;
        busy = true;
        confirm.disabled = true;
        try {
          await exclusiveWrite(() =>
            applyImport(target, candidate, {
              activate: activate.checked ? 'zz' : 'public',
              expectedRevision: preview.revision,
            })
          );
          location.reload();
        } catch (error) {
          status.textContent = `가져오지 못했습니다: ${error.message}`;
          busy = false;
          confirm.disabled = false;
        }
      };
    } catch (error) {
      status.textContent = `확인하지 못했습니다: ${error.message}`;
    }
  }
  for (const candidate of candidates) {
    const button = node(
      'button',
      candidate.source === 'raw' ? '기기에 남은 ZZ 데이터 확인' : '저장된 ZZ 백업 확인',
    );
    button.type = 'button';
    button.onclick = () => show(candidate);
    panel.append(button);
  }
  const fileLabel = node('label', '백업 파일에서 가져오기 ');
  const file = node('input');
  file.type = 'file';
  file.accept = '.json,.zip,application/json,application/zip';
  fileLabel.append(file);
  panel.append(fileLabel);
  file.onchange = async () => {
    if (!file.files[0]) return;
    try {
      await show(await readImportFile(file.files[0], target));
    } catch (error) {
      status.textContent = `파일을 읽지 못했습니다: ${error.message}`;
    }
  };
  if (profiles && (Array.isArray(profiles) ? profiles.length : Object.keys(profiles).length)) {
    const retainedButton = node('button', '가져온 데이터 상세 · 내보내기');
    retainedButton.type = 'button';
    retainedButton.onclick = async () => {
      try {
        const retained = await readImportDetails(target);
        choices.replaceChildren();
        if (retained) appendRetainedDetails(choices, retained, target);
        else status.textContent = '보관된 상세가 없습니다.';
      } catch (error) {
        status.textContent = `보관 상세를 읽지 못했습니다: ${error.message}`;
      }
    };
    panel.append(retainedButton);
    for (
      const [id, title] of [['public', '기존 공개본'], ['zz', '이전 ZZ본'], ['merged', '합친 목록']].filter((
        [id],
      ) => profiles.some((profile) => profile.id === id))
    ) {
      const button = node('button', `${title} 사용`);
      button.type = 'button';
      button.onclick = async () => {
        try {
          await exclusiveWrite(() => activateProfile(target, id));
          location.reload();
        } catch (error) {
          status.textContent = error.message;
        }
      };
      panel.append(button);
    }
  }
  const later = node('button', '나중에');
  later.type = 'button';
  later.onclick = () => {
    panel.open = false;
    try {
      localStorage.setItem(
        `zz-import-dismissed:${target}`,
        JSON.stringify(candidates.map((candidate) => candidate.contentHash)),
      );
    } catch {}
  };
  if (candidates.length) panel.append(later);
  if (discovered.warnings?.length) status.textContent = discovered.warnings.join(' ');
  else {
    let dismissed = [];
    try {
      dismissed = JSON.parse(localStorage.getItem(`zz-import-dismissed:${target}`) || '[]');
    } catch {}
    if (
      candidates.some((candidate) => !Array.isArray(dismissed) || !dismissed.includes(candidate.contentHash))
    ) status.textContent = '가져올 이전 ZZ 데이터가 있습니다. 내용을 확인해 주세요.';
  }
  const attach = () => {
    const root = document.querySelector(containers[target]);
    if (root && !root.contains(panel)) root.append(panel);
  };
  attach();
  new MutationObserver(attach).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-product-settings'],
  });
}
