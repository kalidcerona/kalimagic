    const SETTINGS_TUTORIAL_KEY = `calculator-settings-entry-tutorial-v1:${location.pathname.replace(/index\.html$/, "").replace(/\/$/, "")}`;
    function showSettingsEntryTutorial() {
      try { if (localStorage.getItem(SETTINGS_TUTORIAL_KEY) === "1") return; } catch (_) {}
      const tutorial = document.getElementById("settings-entry-tutorial");
      tutorial.hidden = false;
    }
    document.getElementById("settings-entry-tutorial-dismiss").addEventListener("click", () => {
      document.getElementById("settings-entry-tutorial").hidden = true;
      try { localStorage.setItem(SETTINGS_TUTORIAL_KEY, "1"); } catch (_) {}
    });

