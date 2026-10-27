import { openSettings } from "./controller.js";
import { settingsVisible } from "./dom.js";

if ("serviceWorker" in navigator) {
  const registration = navigator.serviceWorker.register("./sw.js");
  registration.catch(() => {});
  window.MagicUpdate?.init({ registrationPromise: registration, safe: () => settingsVisible() });
}
