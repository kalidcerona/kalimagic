import { loadState, validateState, validateCards, replaceStack } from './core.mjs';

// Each app boot owns its context; modules do not retain browser or practice state.
export function createStorage(ctx) {
  // Preserve unreadable or invalid bytes until a validated import is safely stored.
  try {
    const saved = localStorage.getItem(ctx.KEY);
    if (saved != null) {
      ctx.originalRaw = saved;
      try {
        ctx.state = loadState(saved);
        ctx.originalRaw = null;
      } catch {
        ctx.writeBlocked = true;
        ctx.storageWarning = '저장된 기록 형식이 올바르지 않습니다. 원본은 그대로 두었습니다. 이 화면의 기본 연습은 복구된 원본이 아닙니다. 연습은 이 화면에만 남고 기기에 덮어쓰지 않습니다. 검증된 백업을 가져올 때만 기록을 바꿉니다.';
      }
    }
  } catch {
    ctx.writeBlocked = true;
    ctx.originalRaw = null;
    ctx.storageWarning = '저장된 기록을 읽지 못했습니다. 원본은 그대로 두었습니다. 이 화면의 기본 연습은 복구된 원본이 아닙니다. 연습은 이 화면에만 남고 기기에 덮어쓰지 않습니다. 검증된 백업을 가져올 때만 기록을 바꿉니다.';
  }

  function message(text) {
    if (ctx.writeBlocked) {
      ctx.notice.textContent = `${ ctx.storageWarning }${ text ? ` ${ text }` : '' }`;
      return;
    }
    ctx.notice.textContent = (ctx.persistenceError ? '기기에 저장되지 않았습니다. 현재 연습은 이 화면에서 계속할 수 있지만, 닫기 전에 백업을 내려받으세요. ' : '') + text;
  }

  function persist(candidate, {
    recovery: recovery = false
  } = {}) {
    if (ctx.writeBlocked && (!recovery || !ctx.recoveryReady)) {
      ctx.persistenceError = true;
      message('');
      return false;
    }
    let serialized;
    try {
      serialized = JSON.stringify(candidate);
    } catch {
      ctx.persistenceError = true;
      message('');
      return false;
    }
    try {
      localStorage.setItem(ctx.KEY, serialized);
    } catch {
      ctx.persistenceError = true;
      message('');
      return false;
    }
    ctx.persistenceError = false;
    if (recovery) {
      ctx.writeBlocked = false;
      ctx.originalRaw = null;
      ctx.recoveryReady = false;
      ctx.storageWarning = '';
    }
    return true;
  }

  function save() {
    return persist(ctx.state);
  }

  function prepareRecovery() {
    if (!ctx.writeBlocked) {
      download('memdeck-before-import.json', ctx.state);
      return;
    }
    ctx.recoveryReady = false;
    if (ctx.originalRaw == null) {
      try {
        const raw = localStorage.getItem(ctx.KEY);
        if (typeof raw === 'string')
          ctx.originalRaw = raw;
      } catch {
      }
      if (ctx.originalRaw == null)
        throw new Error('원본을 읽고 보관할 수 없어 저장소를 바꾸지 않았습니다.');
    }
    try {
      localStorage.setItem(ctx.PRESERVED_KEY, ctx.originalRaw);
      if (localStorage.getItem(ctx.PRESERVED_KEY) !== ctx.originalRaw)
        throw new Error('verify');
    } catch {
      throw new Error('원본을 기기에 따로 보관하지 못해 저장소를 바꾸지 않았습니다.');
    }
    ctx.recoveryReady = true;
    try {
      downloadText('memdeck-original-raw.json', ctx.originalRaw);
    } catch {
    }
  }

  function downloadText(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function download(name, data) {
    downloadText(name, JSON.stringify(data, null, 2));
  }

  function wireImports() {
    document.querySelector('#export').onclick = () => {
      if (ctx.writeBlocked) {
        if (ctx.originalRaw != null) {
          downloadText('memdeck-original-raw.json', ctx.originalRaw);
          message('저장소 원본 그대로의 다운로드를 요청했습니다. 이 화면의 기본 연습은 복구된 원본이 아닙니다.');
        } else
          message('저장된 원본을 읽지 못해 원본 파일을 만들 수 없습니다. 이 화면의 기본 연습은 복구된 원본이 아닙니다.');
        return;
      }
      download('memdeck-backup.json', ctx.state);
    };
    document.querySelector('#stack-export').onclick = () => {
      if (ctx.writeBlocked) {
        message('저장소 원본을 보호 중이라 이 화면의 순서를 원본처럼 내려받지 않습니다.');
        return;
      }
      download(`${ ctx.state.selected }-order.json`, ctx.cards());
    };
    document.querySelector('#import').onchange = async e => {
      const file = e.target.files[0];
      if (!file)
        return;
      try {
        if (file.size > 2000000)
          throw new Error('백업 파일은 2MB 이하만 지원합니다.');
        const next = validateState(JSON.parse(await file.text()));
        prepareRecovery();
        if (!persist(next, { recovery: true }))
          throw new Error('브라우저 저장 공간에 쓰지 못해 백업을 적용하지 않았습니다.');
        ctx.state = next;
        ctx.questionStart = performance.now();
        ctx.render();
        message('백업을 가져왔습니다. 두 스택의 기록을 확인하세요.');
      } catch (error) {
        message(`가져오기 실패: ${ error.message } 기존 기록은 유지됩니다.`);
      }
    };
    document.querySelector('#stack-import').onclick = () => {
      try {
        const next = validateCards(JSON.parse(document.querySelector('#stack-json').value));
        if (ctx.writeBlocked) {
          message('저장소 원본을 보호 중이라 순서를 적용하지 않았습니다. 기존 순서와 기록은 유지됩니다.');
          return;
        }
        download('memdeck-before-order-change.json', ctx.state);
        const candidate = replaceStack(ctx.state, ctx.state.selected, next);
        if (!persist(candidate))
          throw new Error('브라우저 저장 공간에 쓰지 못해 순서를 적용하지 않았습니다.');
        ctx.state = candidate;
        ctx.render();
        message('카드 순서를 적용하고 이 스택의 기록을 새로 시작했습니다.');
      } catch (error) {
        message(`순서 적용 실패: ${ error.message } 기존 순서와 기록은 유지됩니다.`);
      }
    };
  }
  return { wireImports, message, persist, save, prepareRecovery, downloadText, download };
}
