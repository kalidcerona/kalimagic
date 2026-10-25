// ALETHEIA settings, local storage, and performance surface.
import { MESSAGES } from './logic.js';
import { view, warmCourtDeck, boot, startBootPerformance } from './controller.js';
import { setError } from './status.js';

boot().catch(() => {
  setError(MESSAGES.storageReadFailed);
}).then(startBootPerformance).catch(() => {
  setError('공연 화면을 준비하지 못했습니다. 저장된 데이터는 바꾸지 않았습니다.');
});
requestAnimationFrame(() => {
  if (view === 'settings') warmCourtDeck();
});
