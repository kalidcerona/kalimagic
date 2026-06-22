/**
 * kalimagic editor — ?edit=1 파라미터로 활성화
 * 배포판에도 포함되지만 파라미터 없으면 완전히 비활성
 */
(function () {
  if (!new URLSearchParams(location.search).has('edit')) return;

  document.addEventListener('DOMContentLoaded', init);

  const GOLD = '#E0904E';
  const BG   = '#1a1410';
  const TEXT = '#e2d8cc';
  const BAR_H = 52;

  function init() {
    /* ── 툴바 ──────────────────────────────────────────────── */
    const bar = document.createElement('div');
    bar.id = 'ke-bar';
    Object.assign(bar.style, {
      position: 'fixed', top: '0', left: '0', right: '0', zIndex: '99999',
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '0 16px', height: BAR_H + 'px',
      background: BG, borderBottom: '2px solid ' + GOLD,
      fontFamily: 'Pretendard, sans-serif', fontSize: '13px', color: TEXT,
      boxSizing: 'border-box',
    });

    const pageName = location.pathname.split('/').pop() || 'index.html';

    bar.innerHTML = `
      <span style="font-weight:700;color:${GOLD};white-space:nowrap;flex-shrink:0;">✏️ 편집 모드</span>
      <span style="opacity:0.45;font-size:11px;white-space:nowrap;flex-shrink:0;">${pageName}</span>
      <div style="flex:1;"></div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button id="ke-vp-mob"  title="모바일 390px"   style="${vpBtnStyle()}">📱 모바일</button>
        <button id="ke-vp-tab"  title="태블릿 768px"   style="${vpBtnStyle()}">📟 태블릿</button>
        <button id="ke-vp-desk" title="데스크탑 1280px" style="${vpBtnStyle()}">🖥 데스크탑</button>
      </div>
      <span id="ke-vpw" style="font-size:11px;opacity:0.45;min-width:56px;text-align:right;flex-shrink:0;"></span>
      <button id="ke-export" style="background:${GOLD};color:${BG};border:none;border-radius:6px;padding:6px 14px;font-weight:700;cursor:pointer;font-size:13px;flex-shrink:0;">내보내기</button>
      <span id="ke-count" style="font-size:11px;opacity:0.65;flex-shrink:0;white-space:nowrap;">변경 0</span>
    `;

    document.body.prepend(bar);
    document.body.style.paddingTop = BAR_H + 'px';

    /* ── 뷰포트 너비 표시 ────────────────────────────────── */
    function updateVpLabel() {
      const el = document.getElementById('ke-vpw');
      if (el) el.textContent = window.innerWidth + 'px';
    }
    updateVpLabel();
    window.addEventListener('resize', updateVpLabel);

    /* ── 뷰포트 직접 축소 (편집 유지) ──────────────────── */
    let _narrowW = null;

    document.getElementById('ke-vp-mob') .addEventListener('click', () => setNarrow(390));
    document.getElementById('ke-vp-tab') .addEventListener('click', () => setNarrow(768));
    document.getElementById('ke-vp-desk').addEventListener('click', () => setNarrow(null));

    function setNarrow(targetW) {
      if (_narrowW === targetW) { clearNarrow(); return; }
      _narrowW = targetW;
      if (targetW === null) { clearNarrow(); return; }

      const main = document.querySelector('main') || document.body;
      const header = document.querySelector('header');
      const footer = document.querySelector('footer');

      [main, header, footer].forEach(el => {
        if (!el) return;
        el.style.maxWidth = targetW + 'px';
        el.style.marginLeft = 'auto';
        el.style.marginRight = 'auto';
        el.style.boxSizing = 'border-box';
      });

      document.body.style.background = '#111';

      const vpw = document.getElementById('ke-vpw');
      if (vpw) vpw.textContent = targetW + 'px ✏️';
    }

    function clearNarrow() {
      _narrowW = null;
      const main = document.querySelector('main') || document.body;
      const header = document.querySelector('header');
      const footer = document.querySelector('footer');

      [main, header, footer].forEach(el => {
        if (!el) return;
        el.style.maxWidth = '';
        el.style.marginLeft = '';
        el.style.marginRight = '';
        el.style.boxSizing = '';
      });

      document.body.style.background = '';
      updateVpLabel();
    }

    /* ── 텍스트 편집 ────────────────────────────────────── */
    const changes = new Map();

    const SELECTOR = [
      'h1', 'h2', 'h3', 'h4', 'h5',
      'p', 'li',
      '.eyebrow', '.hero-headline', '.hero-sub',
      '.video-desc',
      '.vcard h3', '.vcard p',
      '.secondary-cta-box h2',
    ].join(',');

    document.querySelectorAll(SELECTOR).forEach(el => {
      if (el.closest('#ke-bar') || el.closest('script') || el.closest('style')) return;
      if (!el.textContent.trim()) return;
      el.style.cursor = 'text';

      el.addEventListener('click', function (e) {
        if (document.getElementById('ke-preview')) return;
        e.stopPropagation();
        if (this.isContentEditable) return;
        if (!changes.has(this)) changes.set(this, { original: this.textContent });
        this.contentEditable = 'true';
        this.style.outline = '2px solid ' + GOLD;
        this.style.outlineOffset = '2px';
        this.style.background = 'rgba(224,144,78,0.07)';
        this.style.borderRadius = '3px';
        this.focus();
      });

      el.addEventListener('blur', function () {
        this.contentEditable = 'false';
        const entry = changes.get(this);
        if (entry) {
          if (this.textContent.trim() === entry.original.trim()) {
            changes.delete(this);
            this.style.outline = '';
            this.style.background = '';
            this.style.borderRadius = '';
          } else {
            this.style.outline = '2px dashed ' + GOLD;
            this.style.background = 'rgba(224,144,78,0.05)';
          }
        }
        updateCount();
      });
    });

    function updateCount() {
      const el = document.getElementById('ke-count');
      if (el) el.textContent = '변경 ' + changes.size;
    }

    /* ── 내보내기 ───────────────────────────────────────── */
    document.getElementById('ke-export').addEventListener('click', () => {
      if (changes.size === 0) {
        showModal('수정된 내용이 없어.\n\n텍스트를 클릭해서 수정해봐.', false);
        return;
      }
      let text = '[' + pageName + '] 수정 내용\n' + '─'.repeat(40) + '\n\n';
      let i = 1;
      changes.forEach(({ original }, el) => {
        const current = el.textContent;
        if (current.trim() !== original.trim()) {
          text += i + '. 원본:  ' + original.trim() + '\n';
          text += '   수정:  ' + current.trim() + '\n\n';
          i++;
        }
      });
      text += '─'.repeat(40) + '\n이 내용을 리더(Claude)에게 전달하면 파일에 반영해줘.';
      showModal(text, true);
    });

    function showModal(text, copyable) {
      const existing = document.getElementById('ke-modal');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'ke-modal';
      Object.assign(overlay.style, {
        position: 'fixed', inset: '0', zIndex: '999999',
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      });

      const box = document.createElement('div');
      Object.assign(box.style, {
        background: '#241c17', border: '2px solid ' + GOLD, borderRadius: '12px',
        padding: '24px', maxWidth: '560px', width: '100%',
        fontFamily: 'Pretendard, sans-serif',
      });

      const title = document.createElement('p');
      title.textContent = copyable ? '📋 수정 내용 — 복사해서 리더에게 전달해줘' : '알림';
      Object.assign(title.style, { color: GOLD, fontWeight: '700', margin: '0 0 12px' });

      const ta = document.createElement('textarea');
      ta.value = text;
      ta.readOnly = true;
      Object.assign(ta.style, {
        width: '100%', height: copyable ? '240px' : '72px',
        background: '#1a1410', color: TEXT,
        border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
        padding: '12px', fontSize: '13px', fontFamily: 'monospace',
        resize: 'vertical', boxSizing: 'border-box',
      });

      const btns = document.createElement('div');
      Object.assign(btns.style, {
        display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end',
      });

      if (copyable) {
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 복사';
        Object.assign(copyBtn.style, {
          background: GOLD, color: BG, border: 'none', borderRadius: '6px',
          padding: '8px 18px', fontWeight: '700', cursor: 'pointer', fontSize: '13px',
        });
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(text).catch(() => {
            ta.select(); document.execCommand('copy');
          });
          copyBtn.textContent = '✓ 복사됨!';
          copyBtn.style.background = '#6dbf6d';
        };
        btns.appendChild(copyBtn);
      }

      const closeBtn = document.createElement('button');
      closeBtn.textContent = '닫기';
      Object.assign(closeBtn.style, {
        background: 'rgba(255,255,255,0.08)', color: TEXT,
        border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
        padding: '8px 16px', cursor: 'pointer', fontSize: '13px',
      });
      closeBtn.onclick = () => overlay.remove();
      btns.appendChild(closeBtn);

      box.appendChild(title);
      box.appendChild(ta);
      box.appendChild(btns);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      if (copyable) ta.select();
    }
  }

  function vpBtnStyle() {
    return 'background:rgba(255,255,255,0.08);color:' + TEXT + ';border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:13px;white-space:nowrap;';
  }

})();
