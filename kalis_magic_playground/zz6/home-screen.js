// Decorative launcher only; all input continues to the performance gesture layer.
const homeApps = [
  ['갤러리', '#b74675', '<rect x="5" y="6" width="22" height="20" rx="3"/><circle cx="12" cy="12" r="2"/><path d="m6 23 7-7 5 5 4-4 5 6"/>'],
  ['시계', '#454a60', '<circle cx="16" cy="16" r="11"/><path d="M16 8v8l5 3"/>'],
  ['캘린더', '#c55245', '<rect x="5" y="7" width="22" height="21" rx="3"/><path d="M10 4v6m12-6v6M5 13h22m-16 6h3m4 0h3m-10 4h3m4 0h3"/>'],
  ['메모', '#ad7630', '<rect x="7" y="4" width="18" height="24" rx="3"/><path d="M12 11h8m-8 5h8m-8 5h5"/>'],
  ['날씨', '#287c9c', '<circle cx="16" cy="16" r="6"/><path d="M16 3v3m0 20v3M3 16h3m20 0h3M7 7l2 2m14 14 2 2M7 25l2-2M23 9l2-2"/>'],
  ['계산기', '#467e61', '<rect x="7" y="4" width="18" height="24" rx="3"/><path d="M11 9h10m-10 7h3m-1.5-1.5v3M18 16h3m-10 6h3m4 0h3"/>'],
  ['음악', '#9263ad', '<path d="M13 23V8l13-3v15M13 12l13-3"/><ellipse cx="9" cy="24" rx="4" ry="3"/><ellipse cx="22" cy="21" rx="4" ry="3"/>'],
  ['지도', '#398d84', '<path d="m4 8 8-3 8 3 8-3v21l-8 3-8-3-8 3Zm8-3v21m8-18v21"/>'],
  ['전화', '#3a9656', '<path d="m8 5 5 5-3 4c2 4 4 6 8 8l4-3 5 5-3 4C13 28 4 19 4 9Z"/>'],
  ['메시지', '#3279b1', '<path d="M7 6h18a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H13l-7 5v-5a3 3 0 0 1-3-3V9a3 3 0 0 1 4-3Z"/><path d="M9 12h14M9 17h9"/>'],
  ['카메라', '#525767', '<path d="M4 10h6l3-4h6l3 4h6v17H4Z"/><circle cx="16" cy="18" r="5"/>'],
  ['설정', '#697686', '<circle cx="16" cy="16" r="7"/><circle cx="16" cy="16" r="2"/><path d="M16 3v6m0 14v6M3 16h6m14 0h6M7 7l4 4m10 10 4 4M7 25l4-4M21 11l4-4"/>'],
];

function renderHomeScreen() {
  const home = document.querySelector('.home');
  if (!home) return;
  const icon = ([label, color, glyph]) => `<div class="home-app"><span class="home-icon" style="--app-color:${color}"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">${glyph}</svg></span><span class="home-label">${label}</span></div>`;
  home.innerHTML = `<div class="home-icons">${homeApps.slice(0, 8).map(icon).join('')}</div><div class="home-pages"><i></i><i></i><i></i></div><div class="home-dock">${homeApps.slice(8).map(icon).join('')}</div>`;
}

export { renderHomeScreen };
