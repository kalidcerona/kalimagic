    (() => {
      try {
        const KEY = 'gwayubulgeup_install_nudge_done';
        if (localStorage.getItem(KEY)) return;
        const standalone = typeof window.matchMedia === 'function' &&
          window.matchMedia('(display-mode: standalone)').matches;
        if (standalone || navigator.standalone) return;

        let deferred = null;
        let bar = null;
        let closed = false;
        let installRevision = 0;
        const pending = '설치 요청을 받았습니다. 앱 아이콘을 확인하세요. 없으면 Chrome 메뉴(⋮)에서 다시 시도하세요.';
        const done = () => {
          closed = true;
          installRevision += 1;
          try { localStorage.setItem(KEY, '1'); } catch (error) {}
          if (bar) bar.remove();
          bar = null;
          deferred = null;
        };
        const showOffer = () => {
          if (bar || closed) return;
          bar = document.createElement('div');
          bar.id = 'install-nudge';
          bar.innerHTML = '<span>홈 화면에 앱으로 설치할 수 있어요</span>' +
            '<button type="button" data-act="install">설치</button>' +
            '<button type="button" data-act="close" aria-label="닫기">✕</button>';
          bar.addEventListener('pointerdown', (event) => event.stopPropagation());
          bar.addEventListener('click', async (event) => {
            event.stopPropagation();
            const button = event.target.closest('button[data-act]');
            const act = button ? button.dataset.act : null;
            if (act === 'install' && deferred) {
              const revision = installRevision;
              const promptEvent = deferred;
              deferred = null;
              try {
                await promptEvent.prompt();
                const choice = await promptEvent.userChoice;
                if (revision !== installRevision || !bar) return;
                bar.querySelector('span').textContent = choice?.outcome === 'accepted'
                  ? '설치 요청을 보냈습니다. 앱 아이콘을 확인하세요. 없으면 Chrome 메뉴(⋮)에서 다시 시도하세요.'
                  : 'Chrome 메뉴(⋮)에서 앱 설치를 선택하세요.';
              } catch (error) {
                if (revision !== installRevision || !bar) return;
                bar.querySelector('span').textContent = '설치 창을 열지 못했습니다. Chrome 메뉴(⋮)에서 앱 설치를 선택하세요.';
              }
            } else if (act === 'install') {
              if (bar) bar.querySelector('span').textContent = 'Chrome 메뉴(⋮)에서 앱 설치를 선택하세요.';
            } else if (act === 'close') {
              done();
            }
          });
          document.body.appendChild(bar);
        };
        window.addEventListener('appinstalled', () => {
          installRevision += 1;
          deferred = null;
          showOffer();
          if (bar) bar.querySelector('span').textContent = pending;
        });
        window.addEventListener('beforeinstallprompt', (event) => {
          if (closed) return;
          event.preventDefault();
          installRevision += 1;
          deferred = event;
          showOffer();
          if (bar) bar.querySelector('span').textContent = '홈 화면에 앱으로 설치할 수 있어요';
        });
      } catch (error) {}
    })();
