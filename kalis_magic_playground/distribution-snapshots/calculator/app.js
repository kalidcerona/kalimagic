    function setupCalculator() {
      const app = document.getElementById("app");
      const display = document.getElementById("display");
      const keypad = document.querySelector(".keypad");
      const clearKey = keypad.querySelector('[data-key="C"]');
      const percentKey = keypad.querySelector('[data-key="%"]');
      const penIcon = document.getElementById("pen-icon");
      const clockIcon = document.getElementById("clock-icon");
      const stackIcon = document.getElementById("stack-icon");
      const stackResult = document.getElementById("stack-result");
      const dateSettings = document.getElementById("date-settings");
      let desktopSettingsAccess = null;

      const dateDelayValue = document.getElementById("date-delay-value");
      const dateHourCycleButton = document.getElementById("date-hour-cycle");
      const skinToggleButton = document.getElementById("skin-toggle");
      const releaseDaysValue = document.getElementById("release-days-value");
      const releaseDaysClear = document.getElementById("release-days-clear");
      const dateHintKeys = keypad.querySelectorAll(
        '[data-key="+"], [data-key="−"], [data-key="0"], [data-key="1"], ' +
        '[data-key="2"], [data-key="3"], [data-key="4"], [data-key="5"], ' +
        '[data-key="6"], [data-key="7"], [data-key="8"], [data-key="9"]'
      );
      let expr = "";
      let resultShown = false;
      let lastResult = null;
      let errorShown = false;
      let dateTrickState = { phase: "off", queue: null, queueIndex: 0 };
      let dateDelaySeconds = 20;
      let dateHourCycle = "24";
      let skin = /iPhone|iPad|iPod/.test(navigator.userAgent)
        ? "iphone"
        : "default";
      let stackLongPressTimer = null;
      let stackLongPressConsumed = false;
      try {
        const savedDelay = Number.parseInt(
          localStorage.getItem("magic-calc-date-delay"),
          10
        );
        if (Number.isInteger(savedDelay)) {
          dateDelaySeconds = Math.min(120, Math.max(5, savedDelay));
        }
        const savedHourCycle = localStorage.getItem("magic-calc-hour-cycle");
        if (savedHourCycle === "12" || savedHourCycle === "24") {
          dateHourCycle = savedHourCycle;
        }
        const savedSkin = localStorage.getItem("magic-calc-skin");
        if (savedSkin === "default" || savedSkin === "iphone") {
          skin = savedSkin;
        }
      } catch {
        // Storage is optional; keep the default settings when unavailable.
      }
      let trickState = {
        phase: "off",
        storedText: null,
        lastKey: null,
        pendingSole: null
      };
      let receivedDays = null;
      let receivedRevision = null;
      let receivedTargetActive = false;

      const currentValueText = () =>
        resultShown && lastResult !== null
          ? decToPlainString(lastResult)
          : soleNumberText(expr);

      const dateResultText = () =>
        resultShown && lastResult !== null
          ? decToPlainString(lastResult)
          : null;

      const computeDateTrickValues = (currentText) =>
        dateTrickTarget(
          currentText,
          Date.now(),
          dateDelaySeconds,
          dateHourCycle
        );

      const displayedValue = () =>
        errorShown ? "오류" : displayValue(expr);

      const render = () => {
        const rawDisplay = displayedValue();
        app.classList.toggle("skin-iphone", skin === "iphone");
        display.textContent = formatDisplay(rawDisplay);
        clearKey.textContent = skin === "iphone" && rawDisplay !== "0" && rawDisplay !== "오류"
          ? "⌫"
          : skin === "iphone" ? "AC" : "C";
        percentKey.classList.toggle("trick-set", trickState.phase === "set");
        percentKey.classList.toggle("trick-ready", trickState.phase === "ready");
        penIcon.classList.toggle("date-armed", dateTrickState.phase !== "off");
        dateDelayValue.textContent = `${dateDelaySeconds}초`;
        dateHourCycleButton.textContent = `${dateHourCycle}h`;
        skinToggleButton.textContent = skin === "iphone" ? "스킨: 아이폰" : "스킨: 기본";
        releaseDaysValue.textContent = receivedDays === null ? "아직 받은 값이 없어요." : `${receivedDays}일을 받았어요.`;
        releaseDaysClear.disabled = receivedDays === null;

        let neededOp = null;
        let digitHintKey = null;
        const currentText = dateResultText();
        if (dateTrickState.phase === "armed" && currentText !== null) {
          const dateValues = computeDateTrickValues(currentText);
          neededOp = dateValues.neededOp;
          const digitCount = (dateValues.queueText.match(/\d/g) ?? []).length;
          if (digitCount >= 1 && digitCount <= 10) {
            digitHintKey = String(digitCount % 10);
          }
        }
        dateHintKeys.forEach((key) => {
          key.classList.toggle(
            "date-key-hint",
            key.dataset.key === neededOp || key.dataset.key === digitHintKey
          );
        });
        fitDisplayText(display);
      };

      const handleKey = (key) => {
        stackResult.hidden = true;

        if (dateTrickState.phase !== "off") {
          const currentText = dateResultText();
          const ctx = { currentValueText: currentText };

          if (
            dateTrickState.phase === "armed" &&
            (key === "+" || key === "−") &&
            currentText !== null
          ) {
            Object.assign(
              ctx,
              computeDateTrickValues(currentText)
            );
          }

          const dateTransition = dateTrickStep(dateTrickState, key, ctx);
          dateTrickState = dateTransition.state;
          if (dateTransition.action === "swallow") return;
          key = dateTransition.replaceKey;
        }

        if (errorShown && trickErrorGate(trickState, key) === "blocked") return;

        if (key === "%") {
          const transition = trickStep(
            trickState,
            key,
            { soleNumberText: soleNumberText(expr) }
          );
          trickState = transition.state;

          if (transition.action === "set") {
            receivedTargetActive = false;
            expr = "";
            resultShown = false;
            lastResult = null;
            errorShown = false;
            render();
            return;
          }
          if (transition.action === "arm") {
            render();
            return;
          }
          if (errorShown) {
            render();
            return;
          }
        } else if (key === "=") {
          const storedBeforeStep = trickState.storedText;

          if (trickState.phase === "ready") {
            const transition = trickStep(
              trickState,
              key,
              { soleNumberText: null }
            );
            trickState = transition.state;

            if (transition.action === "fire") {
              receivedTargetActive = false;
              expr = storedBeforeStep ?? "";
              resultShown = true;
              lastResult = expr === "" ? null : decFromString(expr);
              errorShown = false;
              render();
              return;
            }
          }

          if (expr !== "" && !resultShown) {
            const tokens = tokenize(expr);
            const value = tokens === null ? null : evaluate(tokens);

            if (value === null) {
              errorShown = true;
              resultShown = false;
              lastResult = null;
            } else {
              expr = decToDisplay(value);
              resultShown = true;
              lastResult = value;
            }
          }

          const transition = trickStep(
            trickState,
            key,
            { soleNumberText: null }
          );
          trickState = transition.state;
          render();
          return;
        } else {
          const transition = trickStep(
            trickState,
            key,
            { soleNumberText: null }
          );
          trickState = transition.state;
        }

        if (key === "C") {
          expr = "";
          resultShown = false;
          lastResult = null;
          errorShown = false;
          render();
          return;
        }

        if (key === "⌫" && resultShown) {
          expr = "";
          resultShown = false;
          lastResult = null;
          render();
          return;
        }

        if (resultShown) {
          if (/^(?:[0-9]|\.|\(\))$/.test(key)) {
            expr = "";
          } else if (lastResult !== null) {
            expr = decToPlainString(lastResult);
          }
          resultShown = false;
          lastResult = null;
        }

        expr = applyKey(expr, key);
        if ("+−×÷".includes(key) && displayValue(expr) === "오류") {
          errorShown = true;
          resultShown = false;
          lastResult = null;
        }
        render();
      };

      keypad.addEventListener("pointerdown", (event) => {
        if (!isPrimaryPointer(event)) return;
        const button = event.target.closest("button[data-key]");
        if (!button || !keypad.contains(button)) return;

        event.preventDefault();

        button.classList.add("pressed");
        window.setTimeout(() => button.classList.remove("pressed"), 140);
        const key = button.dataset.key === "C" &&
          skin === "iphone" &&
          displayedValue() !== "0" &&
          displayedValue() !== "오류"
          ? "⌫"
          : button.dataset.key;
        handleKey(key);
      });

      penIcon.addEventListener("pointerdown", (event) => {
        if (!isPrimaryPointer(event)) return;
        event.preventDefault();
        dateTrickState = dateTrickState.phase === "off"
          ? { phase: "armed", queue: null, queueIndex: 0 }
          : { phase: "off", queue: null, queueIndex: 0 };
        render();
      });

      stackIcon.addEventListener("pointerdown", (event) => {
        if (!isPrimaryPointer(event)) return;
        event.preventDefault();
        try {
          stackIcon.setPointerCapture?.(event.pointerId);
        } catch {}

        window.clearTimeout(stackLongPressTimer);
        stackLongPressConsumed = false;
        stackLongPressTimer = window.setTimeout(() => {
          stackLongPressTimer = null;
          stackLongPressConsumed = true;

          const text = currentValueText();
          if (text === null) return;

          const result = undoSetupLookup(text);
          if (result === null) return;

          stackResult.textContent = `${result.upper}번째 · ${result.lower}번째`;
          stackResult.hidden = false;
        }, 500);
      });

      const finishStackPress = () => {
        const timerWasPending = stackLongPressTimer !== null;
        window.clearTimeout(stackLongPressTimer);
        stackLongPressTimer = null;

        if (!timerWasPending && !stackLongPressConsumed) return;
        if (stackLongPressConsumed) {
          stackLongPressConsumed = false;
          return;
        }

        if (!stackResult.hidden) {
          stackResult.hidden = true;
          return;
        }

        const text = currentValueText();
        if (text === null) return;

        const cutResult = mnemonicaCutLookup(text);
        if (cutResult !== null) {
          stackResult.textContent = `${cutResult.cut}장 · ${cutResult.bottom}`;
          stackResult.hidden = false;
          return;
        }

        const result = mnemonicaLookup(text);
        const parts = [];
        if (result.position !== null) parts.push(`${result.position}번째`);
        if (result.card !== null) parts.push(result.card);
        if (parts.length === 0) return;

        stackResult.textContent = parts.join(" · ");
        stackResult.hidden = false;
      };

      const cancelStackPress = () => {
        window.clearTimeout(stackLongPressTimer);
        stackLongPressTimer = null;
        stackLongPressConsumed = false;
      };

      const openDateSettings = () => {
        if (dateSettings.classList.contains("open")) return;
        cancelStackPress();
        document.getElementById("settings-entry-tutorial").hidden = true;
        dateSettings.classList.add("open");
        dateSettings.setAttribute("aria-hidden", "false");
        desktopSettingsAccess?.updateButton();
        window.MagicUpdate?.offer(); // settings is off-stage
      };

      stackIcon.addEventListener("pointerup", finishStackPress);
      stackIcon.addEventListener("pointercancel", cancelStackPress);
      stackIcon.addEventListener("pointerleave", cancelStackPress);

      window.MagicUpdate?.init({ registrationPromise: navigator.serviceWorker?.ready, safe: () => dateSettings.classList.contains("open") });
      installSettingsSwipe(openDateSettings, cancelStackPress, () => !dateSettings.classList.contains("open"));
      desktopSettingsAccess = bindDesktopSettingsAccess(
        document.getElementById("desktop-settings-entry"),
        openDateSettings,
        () => !dateSettings.classList.contains("open"),
        () => !dateSettings.classList.contains("open"),
      );

      dateSettings.addEventListener("pointerdown", (event) => {
        if (!isPrimaryPointer(event)) return;
        const button = event.target.closest("button[data-date-action]");
        if (!button || !dateSettings.contains(button)) return;
        event.preventDefault();

        if (button.dataset.dateAction === "release-clear") {
          const bridge = window.MagicPerformanceLink;
          let cleared = false;
          try { cleared = Boolean(bridge?.clear(localStorage, location.pathname)); } catch (_) {}
          if (!cleared) return;
          if (receivedTargetActive) {
            trickState = { phase: "off", storedText: null, lastKey: null, pendingSole: null };
          }
          receivedDays = null;
          receivedTargetActive = false;
          render();
          return;
        }

        if (button.dataset.dateAction === "close") {
          dateSettings.classList.remove("open");
          dateSettings.setAttribute("aria-hidden", "true");
          window.MagicUpdate?.hide();
          desktopSettingsAccess?.updateButton();
          return;
        }

        if (button.dataset.dateAction === "hour-cycle") {
          dateHourCycle = dateHourCycle === "24" ? "12" : "24";
          try {
            localStorage.setItem("magic-calc-hour-cycle", dateHourCycle);
          } catch {
            // Keep the in-memory setting when storage is unavailable.
          }
          render();
          return;
        }

        if (button.dataset.dateAction === "skin") {
          skin = skin === "iphone" ? "default" : "iphone";
          try {
            localStorage.setItem("magic-calc-skin", skin);
          } catch {
            // Keep the in-memory setting when storage is unavailable.
          }
          render();
          return;
        }

        const change = button.dataset.dateAction === "increase" ? 5 : -5;
        dateDelaySeconds = Math.min(120, Math.max(5, dateDelaySeconds + change));
        try {
          localStorage.setItem(
            "magic-calc-date-delay",
            String(dateDelaySeconds)
          );
        } catch {
          // Keep the in-memory setting when storage is unavailable.
        }
        render();
      });

      window.addEventListener("resize", () => fitDisplayText(display));
      const receiveReleaseDays = () => {
        const bridge = window.MagicPerformanceLink;
        if (!bridge) return;
        let handoff = null;
        try { handoff = bridge.read(localStorage, location.pathname); } catch (_) { return; }
        // Removing a RELEASE handoff disarms only its imported target, preserving the expression.
        if (!handoff) {
          if (receivedDays !== null) {
            if (receivedTargetActive) trickState = { phase: "off", storedText: null, lastKey: null, pendingSole: null };
            receivedDays = null;
            receivedRevision = null;
            receivedTargetActive = false;
            render();
          }
          return;
        }
        if (expr !== "" || resultShown || errorShown || dateTrickState.phase !== "off"
          || !stackResult.hidden || stackLongPressTimer !== null
          || (trickState.phase !== "off" && !(receivedTargetActive && trickState.phase === "set"))) return;
        if (handoff.revision === receivedRevision) return;
        receivedDays = handoff.days;
        receivedRevision = handoff.revision;
        receivedTargetActive = true;
        trickState = { phase: "set", storedText: String(handoff.days), lastKey: null, pendingSole: null };
        render();
      };
      // Deferred bridge scripts finish before DOMContentLoaded; focus can arrive earlier.
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", receiveReleaseDays, { once: true });
      else receiveReleaseDays();
      window.addEventListener("pageshow", receiveReleaseDays);
      window.addEventListener("focus", receiveReleaseDays);
      render();
    }

