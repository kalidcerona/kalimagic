'use strict';
  function installGuide(manual = true) {
    if (suppressInstallGuide() || installWaitingForPortrait()) return;
    // The request comes from #phoneMore. That menu is not a blocking panel.
    // A real panel or the update prompt keeps the request until it closes.
    // Clicking while the guide panel is already open must not arm another open.
    if (menu || $('panel').hidden === false || $('magicUpdatePrompt')?.hidden === false) { if (menu !== 'install') installGuide.manual = true; return; }
    installGuide.manual = false;
    if (distributionInstall()) {
      const returnToMenu = !$('phoneMore').hidden;
      if (returnToMenu) hideMore();
      if (distributionInstall().offer(false, returnToMenu ? showMore : null)) {
        distributionOfferChecked = true;
        markInstallGuideSeen();
      }
      return;
    }
    markInstallGuideSeen();
    const ua = navigator.userAgent;
    const inApp = /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|; wv\)/i.test(ua);
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const copy = inApp ? '다른 브라우저로 열기: 메뉴에서 외부 브라우저를 선택해 Chrome 또는 Safari로 열어 주세요.' : ios ? 'Safari에서 공유 버튼을 누르고 홈 화면에 추가를 선택한 뒤 추가를 누르세요.' : 'Chrome 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택하세요.';
    if (portraitPhone()) {
      const returnToMenu = manual && !$('phoneMore').hidden;
      if (returnToMenu) hideMore();
      showPhoneInstallGuide(copy, !inApp && !ios, manual, returnToMenu);
      return;
    }
    openPanel('install', '홈 화면에 추가');
    $('panelBody').append(element('p', copy));
    if (installPrompt && !inApp && !ios) $('panelBody').append(action('설치', async () => { const prompt = installPrompt; installPrompt = null; try { await prompt.prompt(); } catch (e) {} }));
  }
  function showPhoneInstallGuide(copy, native, manual, returnToMenu) {
    $('phoneInstallGuide')?.remove();
    const guide = element('section', '', 'phone-install-strip');
    guide.id = 'phoneInstallGuide';
    guide.setAttribute('aria-label', '홈 화면에 추가');
    const details = element('p', copy, 'phone-install-details');
    details.id = 'phoneInstallDetails';
    details.hidden = true;
    const install = action('', async () => {
      if (native && installPrompt) {
        const prompt = installPrompt;
        installPrompt = null;
        install.disabled = true;
        try { await prompt.prompt(); }
        catch { showDetails(true); }
        finally { install.disabled = false; syncPhoneInstallAction(); }
      } else showDetails(details.hidden);
    });
    function showDetails(open) {
      details.hidden = !open;
      install.setAttribute('aria-expanded', String(open));
    }
    install.id = 'phoneInstallAction';
    install.dataset.native = String(native);
    install.setAttribute('aria-controls', details.id);
    showDetails(false);
    const close = action('×', () => {
      const focused = guide.contains(document.activeElement);
      guide.remove();
      if (returnToMenu) showMore();
      else if (manual && focused) $('moreButton').focus();
    });
    close.setAttribute('aria-label', '설치 안내 닫기');
    guide.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.stopPropagation(); close.click(); }
    });
    const row = element('div', '', 'phone-install-row');
    row.append(element('strong', '홈 화면에 추가'), install, close);
    guide.append(details, row);
    $('audienceCard').append(guide);
    syncPhoneInstallAction();
    if (manual) queueMicrotask(() => install.focus({preventScroll:true}));
  }
