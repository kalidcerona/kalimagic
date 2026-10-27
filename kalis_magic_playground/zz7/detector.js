import { openSettings } from "./controller.js";
import { settingsVisible } from "./dom.js";
import { installLocalPreview } from './local-preview.js'; // local-preview-hook

if ("serviceWorker" in navigator) {
  const registration = navigator.serviceWorker.register("./sw.js");
  registration.catch(() => {});
  window.MagicUpdate?.init({ registrationPromise: registration, safe: () => settingsVisible() });
}
installLocalPreview(() => { document.querySelector(".first-run-guide button")?.click(); openSettings(); }); // local-preview-hook
