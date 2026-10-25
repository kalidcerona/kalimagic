    function isPrimaryPointer(event) {
      return (
        event.isPrimary !== false &&
        (event.button === undefined || event.button === 0)
      );
    }

    function fitDisplayText(display) {
      display.style.removeProperty("font-size");
      const textLength = display.textContent?.length ?? 0;
      const naturalStyle = getComputedStyle(display);
      const naturalSize = Number.parseFloat(naturalStyle.fontSize);
      const lengthScale =
        textLength <= 10 ? 1 :
        textLength <= 16 ? 0.82 :
        textLength <= 24 ? 0.64 :
        textLength <= 36 ? 0.48 : 0.36;
      let fittedSize = naturalSize * lengthScale;
      display.style.fontSize = `${fittedSize}px`;

      const fittedStyle = getComputedStyle(display);
      const availableWidth =
        display.clientWidth -
        Number.parseFloat(fittedStyle.paddingLeft) -
        Number.parseFloat(fittedStyle.paddingRight);
      const canvas =
        fitDisplayText.canvas ??
        (fitDisplayText.canvas = document.createElement("canvas"));
      const context = canvas.getContext("2d");

      if (context !== null && availableWidth > 0) {
        context.font =
          `${fittedStyle.fontStyle} ${fittedStyle.fontWeight} ` +
          `${fittedSize}px ${fittedStyle.fontFamily}`;
        const letterSpacing = Number.parseFloat(fittedStyle.letterSpacing) || 0;
        const measuredWidth =
          context.measureText(display.textContent ?? "").width +
          Math.max(0, textLength - 1) * letterSpacing;

        if (measuredWidth > availableWidth) {
          fittedSize *= (availableWidth / measuredWidth) * 0.98;
          display.style.fontSize = `${Math.max(1, fittedSize)}px`;
        }
      }
    }

