import { setupStorageRecovery } from './storage-recovery.mjs';
import { setupRendering } from './rendering.mjs';
import { setupSettings } from './settings.mjs';
import { setupGesturesEditing } from './gestures-editing.mjs';
import { setupExport } from './export.mjs';
import { setupInstall } from './install.mjs';
import { setupWakeLock } from './wake-lock.mjs';
import { installLocalPreview } from './local-preview.mjs'; // local-preview-hook
const key=location.pathname.toLowerCase().startsWith('/tools/arosaegida')?'magic-qr-session-v1-arosaegida':'magic-qr-session-v1';
const ctx={$:id=>document.getElementById(id),key,preservedKey:key+'-preserved-raw',preview:null,armedSuppress:null,undoPointer:null,viewEpoch:0};
setupStorageRecovery(ctx);
setupRendering(ctx);
setupWakeLock(ctx);
setupSettings(ctx);
setupGesturesEditing(ctx);
setupExport(ctx);
setupInstall(ctx);
ctx.askToKeepStoredData();
ctx.loadStored();
ctx.syncDot();
ctx.persist();ctx.render();ctx.renderInstall();if(ctx.storageNote)ctx.notice(ctx.storageNote);if('serviceWorker'in navigator){const registration=navigator.serviceWorker.register('./sw.js',{scope:'./'});registration.catch(()=>{});globalThis.MagicUpdate?.init({registrationPromise:registration,safe:()=>ctx.$('settings').open===true});}
ctx.syncPerformanceWakeLock();
installLocalPreview(() => { document.querySelector(".first-run-guide button")?.click(); ctx.open(); }); // local-preview-hook
