
// Lane 1g: presentation-only adornments retain the existing handlers and save model.
(function installKitV2() {
  const stage = document.getElementById('stage');
  if (!stage) return;
  const menu = document.getElementById('phoneMore');
  const title = document.createElement('h2');
  title.className = 'kit-menu-title'; title.textContent = '메뉴 · 설정'; menu.prepend(title);
  const decorate = root => {
    if (!(root instanceof Element)) return;
    const close = document.getElementById('closePanel');
    const closeLabel = close.textContent.trim();
    const simpleClose = ['닫기', '뒤로', '← 뒤로'].includes(closeLabel);
    close.classList.toggle('kit-close', simpleClose);
    if (simpleClose) close.setAttribute('aria-label', closeLabel);
    for (const tile of root.querySelectorAll('.shop-cosmetic-tile')) {
      const equipped = tile.getAttribute('aria-pressed') === 'true';
      tile.classList.toggle('kit-locked', !equipped && !!tile.querySelector('.shop-cosmetic-lock'));
      if (equipped && !tile.querySelector('.kit-equipped')) {
        const badge = document.createElement('img'); badge.src = 'assets/kit/badge-equipped.webp';
        badge.alt = '착용 중'; badge.className = 'kit-equipped'; tile.append(badge);
      }
    }
    for (const price of root.querySelectorAll('.shop-cosmetic-tile small')) {
      if (/^실크\s*\d/.test(price.textContent.trim())) price.classList.add('kit-price');
    }
    for (const lock of root.querySelectorAll('.shop-cosmetic-lock')) {
      if (lock.querySelector('.kit-lock-mark')) continue;
      const icon = document.createElement('img'); icon.src = 'assets/kit/icon-lock.webp';
      icon.alt = ''; icon.className = 'kit-lock-mark'; lock.prepend(icon);
    }
  };
  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; decorate(stage); });
  });
  for (const id of ['panelBody', 'phoneMore', 'closePanel']) {
    observer.observe(document.getElementById(id), { childList:true, subtree:true, characterData:true });
  }
  decorate(stage);
})();
