    function formatDateTarget(date, hourCycle = "24") {
      const hour = hourCycle === "12"
        ? ((date.getHours() + 11) % 12) + 1
        : date.getHours();
      return (
        String(date.getFullYear() % 100) +
        String(date.getMonth() + 1) +
        String(date.getDate()) +
        String(hour) +
        String(date.getMinutes()).padStart(2, "0")
      );
    }

    function dateTrickTarget(currentText, nowMs, delaySeconds, hourCycle) {
      const targetText = formatDateTarget(
        new Date(nowMs + delaySeconds * 1000),
        hourCycle
      );
      const diff = decSub(
        decFromString(targetText),
        decFromString(currentText)
      );
      return {
        targetText,
        neededOp: diff.s >= 0 ? "+" : "−",
        queueText: decToPlainString(diff.s >= 0 ? diff : { ...diff, s: 1 })
      };
    }

    function dateTrickStep(state, key, ctx) {
      if (
        state.phase === "armed" &&
        (key === "+" || key === "−") &&
        typeof ctx?.currentValueText === "string" &&
        typeof ctx?.targetText === "string"
      ) {
        if (key === ctx.neededOp) {
          return {
            state: {
              phase: "entering",
              queue: ctx.queueText,
              queueIndex: 0
            },
            action: "none",
            replaceKey: key
          };
        }
        return { state, action: "swallow" };
      }

      if (state.phase === "entering") {
        if (/^[0-9.]$/.test(key)) {
          if (state.queueIndex < state.queue.length) {
            return {
              state: { ...state, queueIndex: state.queueIndex + 1 },
              action: "none",
              replaceKey: state.queue[state.queueIndex]
            };
          }
          return { state, action: "swallow", replaceKey: key };
        }
        if (key === "⌫") {
          if (state.queueIndex === 0) {
            return { state, action: "swallow" };
          }
          return {
            state: { ...state, queueIndex: state.queueIndex - 1 },
            action: "none",
            replaceKey: key
          };
        }
        if (key === "C" || key === "=") {
          return {
            state: { phase: "off", queue: null, queueIndex: 0 },
            action: "none",
            replaceKey: key
          };
        }
        return { state, action: "swallow" };
      }

      return { state, action: "none", replaceKey: key };
    }

    function trickErrorGate(state, key) {
      if (key === "C") return "pass";
      if (key === "=" && state.phase === "ready") return "pass";
      if (key === "%" && state.phase === "set") return "pass";
      return "blocked";
    }

    function trickStep(state, key, exprInfo) {
      const current = {
        phase: ["off", "set", "ready"].includes(state?.phase)
          ? state.phase
          : "off",
        storedText: typeof state?.storedText === "string" ? state.storedText : null,
        lastKey: state?.lastKey ?? null,
        pendingSole: typeof state?.pendingSole === "string" ? state.pendingSole : null
      };
      const next = { ...current, lastKey: key };

      if (
        key === "%" &&
        current.lastKey === "%" &&
        current.phase === "set"
      ) {
        return {
          state: {
            ...next,
            phase: "ready",
            pendingSole: null
          },
          action: "arm"
        };
      }

      if (
        key === "%" &&
        current.lastKey === "%" &&
        current.phase === "off" &&
        current.pendingSole !== null
      ) {
        return {
          state: {
            ...next,
            phase: "set",
            storedText: current.pendingSole,
            pendingSole: null
          },
          action: "set"
        };
      }

      if (key === "%") {
        return {
          state: {
            ...next,
            pendingSole:
              typeof exprInfo?.soleNumberText === "string"
                ? exprInfo.soleNumberText
                : null
          },
          action: "none"
        };
      }

      if (key === "=" && current.phase === "ready") {
        return {
          state: {
            phase: "off",
            storedText: null,
            lastKey: null,
            pendingSole: null
          },
          action: "fire"
        };
      }

      return {
        state: { ...next, pendingSole: null },
        action: "none"
      };
    }

