async function loadRecorder(theme) {
 return Promise.all([import("./recorder-engine.js"), fetch(new URL(`./${theme}.html`, import.meta.url)).then(response => {
  if (!response.ok) throw new Error(`Recorder skin: ${response.status}`);
  return response.text();
 })]);
}
// Renderer resources are activated only while A or D is selected.
export function createRecorderThemeController(screen, readState, load = loadRecorder) {
  let theme = null, generation = 0, renderer = null, host = null, observer = null;
  let suspended = false;
  let pressed = false, pendingFinish = null, startedState = null;
  const active = () => theme === "recorder-a" || theme === "recorder-d";
  function layout() {
    if (!host || suspended) return;
    const screenBox = screen.getBoundingClientRect();
    const { width, height } = screenBox;
    const scale = Math.min(width / 412, height / 893);
    host.style.setProperty("--ad-scale", scale);
    // The stage is the single transform authority, including browser subpixel rounding.
    // Read after setting scale; do not independently refit the native hit target.
    const stageBox = host.shadowRoot.querySelector('#stage').getBoundingClientRect();
    const renderedScale = stageBox.width / 412;
    screen.style.setProperty("--ad-key-left", `${stageBox.x - screenBox.x + 132 * renderedScale}px`);
    screen.style.setProperty("--ad-key-top", `${stageBox.y - screenBox.y + 566 * renderedScale}px`);
    screen.style.setProperty("--ad-key-size", `${148 * renderedScale}px`);
  }
  function destroy() {
    renderer?.destroy(); renderer = null;
    observer?.disconnect(); observer = null;
    host?.remove(); host = null;
    pendingFinish = null;
  }
  function switchTheme(next) {
    if (next === theme) return;
    generation++; destroy(); theme = next; suspended = false;
    // Keep the screen available for the two-finger settings gesture.
    screen.inert = false;
    if (screen.dataset) screen.dataset.recorderLoading = active() ? "true" : "false";
    if (!active() || typeof screen.attachShadow !== "function" || typeof document.createElement !== "function") return;
    const token = generation;
    load(next).then(([module, markup]) => {
      if (generation !== token || suspended) return;
      host = document.createElement("div"); host.className = "recorder-theme-host";
      host.dataset.concept = next === "recorder-d" ? "d" : "a";
      // Fit before connecting SVG text: its first layout must not see the 1x fallback.
      // Re-read after asynchronous loading so rotation/resizing during load is respected.
      const { width, height } = screen.getBoundingClientRect();
      host.style.setProperty("--ad-scale", Math.min(width / 412, height / 893));
      host.setAttribute("aria-hidden", "true"); screen.append(host);
      const root = host.attachShadow({ mode: "open" }); root.innerHTML = markup;
      renderer = module.mountRecorder(root, {skin:host.dataset.concept, ink:"#1a120c"});
      observe();
      layout();
      const state = readState(); renderer.setSoundEnabled(state.sound);
      if (state.holding) renderer.begin(state);
      else if (pendingFinish) { renderer.begin(pendingFinish.state); renderer.finish(...pendingFinish.args); pendingFinish = null; }
      renderer.setPressed(pressed);
      screen.inert = false;
      if (screen.dataset) screen.dataset.recorderLoading = "false";
    }).catch(error => {
      if (generation === token) {
        destroy(); suspended = true; screen.inert = false;
        screen.dataset.recorderLoadError = error.message; console.error(error);
      }
    });
  }
  function observe() {
    if (!observer && typeof ResizeObserver === "function") { observer = new ResizeObserver(layout); observer.observe(screen); }
  }
  function resume() {
    if (!suspended || !active()) return;
    if (!renderer) { const next = theme; theme = null; switchTheme(next); return; }
    suspended = false; observe(); layout();
    renderer.setSoundEnabled(readState().sound);
  }
  return {
    active, switchTheme, resume,
    begin() { resume(); pendingFinish = null; startedState=readState(); renderer?.begin(startedState); },
    finish(...args) { if (suspended) return; if(renderer)renderer.finish(...args); else if(active())pendingFinish={state:startedState || readState(),args}; },
    setPressed(value) { pressed=value; if (suspended && !value) return; if (value) resume(); renderer?.setPressed(value); },
    setSoundEnabled(value) { renderer?.setSoundEnabled(value); },
    unlock() { resume(); renderer?.unlock(); },
    suspend() { screen.inert = false; generation++; suspended = true; pressed = false; pendingFinish = null; startedState = null; observer?.disconnect(); observer = null; renderer?.suspend(); },
    snapshot:()=>renderer?.snapshot() ?? null,
  };
}
