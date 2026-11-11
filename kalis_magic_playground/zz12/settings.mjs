// Each app boot owns its context; modules do not retain browser or practice state.
export function createSettings(ctx) {
  function contactHref(nav) {
    var code = 'eshVqDvk7WKk0zDKtiC9UTa.T6Q-', ua = nav.userAgent || '';
    if (/Android/i.test(ua))
      return 'intent://viewer?#Intent;scheme=kakaotalkqrcode%3A%2F%2F' + code + ';action=android.intent.action.SEND;category=android.intent.category.BROWSABLE;package=com.kakao.talk;end;';
    if (/iPhone|iPad|iPod/i.test(ua) || nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
      return 'kakaotalkqrcode://' + code;
    return 'https://qr.kakao.com/talk/' + code;
  }

  function renderSettings() {
    ctx.main.setAttribute('data-product-settings', '');
    ctx.main.setAttribute('data-settings-root', '');
    ctx.main.innerHTML = `<header class="settingsbrand"><img src="./brand-logo.png" alt="멤덱 연습실 로고" width="600" height="200"></header><details class="overview"><summary>개요</summary><p>흩어진 카드에도 마술사만 아는 질서가 있다는 발상임.</p><p>52장이 정해진 순서로 이어지면 카드마다 자기 자리가 생김.</p><p>반복으로 그 질서를 머릿속에 쌓아가는 연습실임.</p><p>흩어진 것처럼 보이는 모든 것에도 저마다의 자리가 있음.</p><p>멤덱 연습실은 보이지 않는 질서를 기억 속에 하나씩 쌓아가는 도구임.</p></details><div class="settings-groups"><section class="panel"><h3>기록 옮기기</h3><p class="subtle">${ ctx.writeBlocked ? '두 스택의 순서와 학습 기록,<br>포카드·기억법·복습 일정을 담습니다.<br>검증된 백업만 저장소의 원본을 바꿉니다.<br>이 화면의 기본 연습은 복구된 원본이 아닙니다.' : '두 스택의 순서와 학습 기록,<br>포카드·기억법·복습 일정을 담습니다.<br>가져오면 현재 기록을 바꿉니다.<br>진행 중 퀴즈는 이어지지 않습니다.' }</p><button id="export" class="primary">백업 내려받기</button><label class="file-label">백업 가져오기<input id="import" type="file" accept=".json,application/json"></label><p class="hint">${ ctx.writeBlocked ? ctx.originalRaw != null ? '저장된 원본은 바꾸지 않습니다. 검증된 백업을 가져오기 전에 기기에 원본을 보관하고 다운로드도 요청합니다. 이 화면의 기본 연습은 복구된 원본이 아닙니다.' : '저장된 원본을 읽지 못했습니다. 검증된 백업을 가져오기 전에는 저장소를 바꾸지 않습니다. 이 화면의 기본 연습은 복구된 원본이 아닙니다.' : '잘못된 파일은 적용하지 않습니다.<br>적용 전에 현재 기록의<br>안전 백업 다운로드를 요청합니다.' }</p></section><section class="panel"><h3>카드 순서 가져오기</h3><p class="subtle">지금 스택의 순서만 바꿉니다.<br>가진 자료와 비교하세요.<br>순서를 바꾸면 이 스택의<br>학습·포카드·기억법 기록이 초기화됩니다.<br>장면·궁전·이야기·복습도 처음부터입니다.</p><textarea id="stack-json" aria-label="52장 카드 순서 JSON" placeholder='["QH", "2S", ... 52장]'></textarea><div class="controls"><button id="stack-export">현재 순서 받기</button><button id="stack-import">순서 적용</button></div><p class="hint">A·2-10·J·Q·K와 S♠ H♥ D♦ C♣. 중복 없는 52장 JSON입니다.</p></section><section class="panel"><h3>홈 화면에서 연습하기</h3><p class="subtle">브라우저 메뉴를 여세요.<br>‘홈 화면에 추가’ 또는<br>‘앱 설치’를 고르세요.</p><p class="hint">한 번 온라인으로 열면 이후 오프라인에서도 됩니다.<br>저장 공간을 지우면 기록도 사라지니 백업을 두세요.</p></section><section class="panel"><h3>순서의 출처</h3><p class="subtle">두 스택의 순서는 공개 자료끼리<br>서로 대조했습니다.<br>저자의 책을 직접 확인하지는 않았습니다.</p><p class="hint"><a href="https://mem-deck.com/stacks/redford/" target="_blank" rel="noopener">Redford · Mem Deck</a><br><a href="https://help.electricks.info/docs/peeksmith-app/card-stacks" target="_blank" rel="noopener">교차 확인 · Electricks</a><br><a href="https://mnemonica.app/blog/mnemonica-stack-order" target="_blank" rel="noopener">Mnemonica · Sinfonika</a></p></section></div><div class="magic-settings-footer"><h2 class="magic-contact-heading">의견 보내기</h2><p class="magic-contact-note"><span>수정할 점이나 버그,</span><span>새로운 아이디어가 있다면</span><span>카카오톡으로 알려주세요.</span></p><div class="magic-contact-actions"><a class="magic-contact-link" href="${ contactHref(navigator) }">카카오톡 문의</a><button type="button" class="magic-contact-copy" id="contact-copy">ID 복사</button></div><details class="magic-contact-help"><summary>연결이 안 될 때</summary><p><span>카카오톡이 열리지 않으면</span><span>ID를 복사해 주세요.</span><span>카카오톡 친구 추가에서</span><span>ID 검색을 선택한 뒤</span><span>복사한 ID로 찾아 주세요.</span></p><p class="magic-contact-id">ID: KaliDCerona</p></details></div>`;
    document.querySelector('#contact-copy').onclick = () => {
      const button = document.querySelector('#contact-copy');
      const text = 'KaliDCerona';
      const finish = ok => {
        button.textContent = ok ? '복사됨' : 'ID 복사';
        if (ok)
          setTimeout(() => {
            if (button.isConnected && button.textContent === '복사됨')
              button.textContent = 'ID 복사';
          }, 1500);
      };
      const fallback = () => {
        try {
          const area = document.createElement('textarea');
          area.value = text;
          area.setAttribute('readonly', '');
          area.style.position = 'fixed';
          area.style.left = '-999px';
          document.body.appendChild(area);
          area.select();
          const ok = document.execCommand('copy');
          area.remove();
          return ok;
        } catch {
          return false;
        }
      };
      const clip = navigator.clipboard;
      if (clip && typeof clip.writeText === 'function')
        clip.writeText(text).then(() => finish(true), () => finish(fallback()));
      else
        finish(fallback());
    };
    ctx.wireImports();
  }

  return { contactHref, renderSettings };
}
