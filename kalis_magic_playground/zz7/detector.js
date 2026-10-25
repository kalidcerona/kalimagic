import { openSettings } from "./controller.js"; // local-preview-hook
import { installLocalPreview } from './local-preview.js'; // local-preview-hook

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
installLocalPreview(() => { document.querySelector(".first-run-guide button")?.click(); openSettings(); }); // local-preview-hook
