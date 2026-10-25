    if (location.hash === "#selftest") {
      document.getElementById("app").hidden = true;
      const panel = document.getElementById("selftest");
      panel.style.display = "block";
      runSelfTests();
    } else {
      setupCalculator();
      showSettingsEntryTutorial();
      acquireWakeLock();
    }
