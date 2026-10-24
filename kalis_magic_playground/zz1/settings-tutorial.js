    const SETTINGS_TUTORIAL_KEY = "stopwatch-settings-entry-tutorial-v1";
    function showSettingsEntryTutorial() {
      const tutorial = document.getElementById("settings-entry-tutorial");
      if (!tutorial || !tutorial.hidden || location.hash.includes("selftest") || new URLSearchParams(location.search).has("selftest")) return;
      try { if (localStorage.getItem(SETTINGS_TUTORIAL_KEY) === "1") return; } catch (_) {}
      tutorial.hidden = false;
    }
    document.getElementById("settings-entry-tutorial").addEventListener("pointerdown", (event) => {
      if (event.target.closest("#settings-entry-tutorial-dismiss")) return;
      event.preventDefault();
      event.stopPropagation();
    });
    document.getElementById("settings-entry-tutorial-dismiss").addEventListener("click", () => {
      const tutorial = document.getElementById("settings-entry-tutorial");
      try { localStorage.setItem(SETTINGS_TUTORIAL_KEY, "1"); } catch (_) {}
      tutorial.hidden = true;
    });

export { showSettingsEntryTutorial };
