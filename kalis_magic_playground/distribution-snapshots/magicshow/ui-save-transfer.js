'use strict';
  // Transport envelopes reuse manual slots; the serialized game schema never changes.
  const SaveTransfer = (() => {
    const maxBytes = 4 * 1024 * 1024;
    function decode(text) {
      if (typeof text !== 'string' || text.length > maxBytes) throw new Error('Invalid save file');
      const slot = JSON.parse(text.replace(/^\uFEFF/, ''));
      if (!C.validSlot(slot) || !C.deserialize(slot.data)) throw new Error('Invalid save file');
      return slot;
    }
    function encode(current, now = Date.now()) {
      const text = JSON.stringify({v: 1, savedAt: now, summary: C.slotSummary(current), data: C.serialize(current)});
      decode(text);
      return text;
    }
    function filename(now = new Date()) {
      const pad = n => String(n).padStart(2, '0');
      return `칼리마술-저장-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.kmsave`;
    }
    return {encode, decode, filename, maxBytes};
  })();
  function mountSaveTransfer(body, status, loadOnly) {
    const host = element('section', '', 'save-transfer');
    host.append(element('h2', '다른 기기로 옮기기'));
    let candidate = null;
    const preview = element('div'), editor = element('textarea');
    editor.hidden = true; editor.setAttribute('aria-label', '저장 코드'); editor.spellcheck = false;
    const error = () => { status.textContent = '읽을 수 없는 저장이에요. 칼리마술 저장 파일·코드를 골라 주세요.'; };
    const clear = () => { candidate = null; preview.replaceChildren(); };
    const prepare = text => {
      clear();
      try {
        const slot = SaveTransfer.decode(text);
        // Recompute the preview from validated data instead of trusting imported labels.
        const summary = C.slotSummary(C.deserialize(slot.data));
        candidate = slot;
        preview.append(element('p', `${summary.venueName} · 레벨 ${summary.level} · 동전 ${summary.coins}`),
          element('p', `${SaveSlots.date(slot.savedAt)} · 플레이 ${summary.playMinutes}분`),
          element('p', '지금 진행은 백업에 남아요. 불러올까요?'));
        preview.append(action('이 저장 불러오기', () => {
          if (!candidate || slotSavePending || restoring || newerSave || !saveStore) return;
          try {
            // Flush current in-memory progress before the same protected backup used by slots.
            if (!loadOnly && !save()) { status.textContent = '현재 진행을 저장하지 못했어요. 다시 눌러 주세요.'; return; }
            if (!SaveSlots.restore(localStorage, saveStore, candidate)) { error(); return; }
            restoring = true;
            const url = new URL(location.href); url.searchParams.delete('restore'); url.searchParams.set('restored', '1');
            if (loadOnly) url.searchParams.set('_titleStart', '1');
            location.replace(url.href);
          } catch (e) { status.textContent = '불러오지 못했어요. 저장 공간을 확인해 주세요.'; }
        }, inaccessible || newerSave || restoring || !saveStore), action('취소', clear));
        status.textContent = '';
      } catch (e) { error(); }
    };
    if (!loadOnly) {
      host.append(action('파일로 내보내기', () => {
        try {
          const text = SaveTransfer.encode(state), url = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
          const link = document.createElement('a'); link.href = url; link.download = SaveTransfer.filename();
          document.body.append(link); link.click(); link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          status.textContent = '저장 파일을 내보냈어요.';
        } catch (e) { status.textContent = '내보내지 못했어요. 다시 눌러 주세요.'; }
      }, newerSave || restoring));
      host.append(action('코드 복사', async () => {
        try {
          const text = SaveTransfer.encode(state);
          editor.value = text; editor.hidden = false; editor.focus(); editor.select();
          try { await navigator.clipboard.writeText(text); status.textContent = '저장 코드를 복사했어요.'; }
          catch (e) { status.textContent = '코드를 길게 눌러 복사해 주세요.'; }
        } catch (e) { status.textContent = '코드를 만들지 못했어요. 다시 눌러 주세요.'; }
      }, newerSave || restoring));
    }
    const file = document.createElement('input'); file.type = 'file'; file.accept = '.kmsave,.json,application/json'; file.hidden = true;
    let readGeneration = 0;
    file.addEventListener('change', async () => {
      const picked = file.files?.[0], generation = ++readGeneration; file.value = ''; clear();
      if (!picked) return;
      if (picked.size > SaveTransfer.maxBytes) { error(); return; }
      try {
        const text = await picked.text();
        if (generation === readGeneration && host.isConnected && menu === 'saveslots') prepare(text);
      } catch (e) { if (host.isConnected) error(); }
    });
    host.append(action('파일에서 불러오기', () => { clear(); file.click(); }, inaccessible || newerSave || restoring || !saveStore), file);
    host.append(action('코드 붙여넣기', () => {
      ++readGeneration; clear(); editor.value = ''; editor.hidden = false; editor.focus();
      status.textContent = '코드를 붙여넣고 확인을 눌러 주세요.';
    }, inaccessible || newerSave || restoring || !saveStore), editor);
    host.append(action('코드 확인', () => { ++readGeneration; prepare(editor.value); }), preview);
    body.append(host);
  }
