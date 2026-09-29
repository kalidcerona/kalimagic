// Compatibility API: apps retain the browser UI and never request fullscreen.
(function () {
  'use strict';
  window.MagicFullscreen = Object.freeze({ request() { return false; } });
  for (const note of document.querySelectorAll('[data-fullscreen-note]')) {
    note.textContent = '앱은 전체 화면을 사용하지 않습니다. 브라우저와 기기의 상태 표시를 유지합니다.';
    note.hidden = false;
  }
})();
