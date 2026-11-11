import { installLocalPreview } from './local-preview.js'; // local-preview-hook
import { installSpin } from './spin.js';
import { installWakeLock } from './wake-lock.js';
import { installTheme } from './theme.js';
import { installAppPrompt } from './install.js';

const { stage, arrow, spinStatus, settings, showSettings } = installSpin();
installTheme({ stage, arrow, spinStatus });
installWakeLock();
installAppPrompt();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // A replacement shell may claim this page. Reloading would clear the live wheel, open settings, and custom preview edits.
  try {
    // update-prompt.js registers the worker and may ask to update, only while settings is open.
    if (window.MagicUpdate) window.MagicUpdate.init({ swUrl: './sw.js', checkForUpdate: true, safe: () => !settings.hidden });
    else navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(() => {});
  } catch { /* Registration failure stays on this performance. */ }
}
installLocalPreview(() => { document.getElementById("guide-close")?.click(); showSettings(); }); // local-preview-hook
