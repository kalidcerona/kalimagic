    function decPow10(exponent) {
      if (!Number.isInteger(exponent) || exponent < 0) {
        throw new RangeError("Decimal exponent must be a non-negative integer");
      }
      return 10n ** BigInt(exponent);
    }

    function decNormalize(sign, digits, scale) {
      let d = digits < 0n ? -digits : digits;
      let e = scale;

      if (d === 0n) return { s: 1, d: 0n, e: 0 };

      while (e > 0 && d % 10n === 0n) {
        d /= 10n;
        e -= 1;
      }

      return { s: sign < 0 ? -1 : 1, d, e };
    }

    function decFromString(str) {
      const source = String(str).trim();
      const match = /^([+\-−]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/.exec(source);

      if (!match) {
        throw new TypeError(`Invalid decimal literal: ${source}`);
      }

      const sign = match[1] === "-" || match[1] === "−" ? -1 : 1;
      const integer = match[2] ?? "";
      const fraction = match[3] ?? match[4] ?? "";
      const digits = BigInt(`${integer}${fraction}` || "0");

      return decNormalize(sign, digits, fraction.length);
    }

    function decAdd(a, b) {
      const scale = Math.max(a.e, b.e);
      const left = BigInt(a.s) * a.d * decPow10(scale - a.e);
      const right = BigInt(b.s) * b.d * decPow10(scale - b.e);
      const sum = left + right;

      return decNormalize(sum < 0n ? -1 : 1, sum, scale);
    }

    function decSub(a, b) {
      return decAdd(a, { s: b.s * -1, d: b.d, e: b.e });
    }

    function decMul(a, b) {
      return decNormalize(a.s === b.s ? 1 : -1, a.d * b.d, a.e + b.e);
    }

    function decDiv(a, b) {
      if (b.d === 0n) return null;
      if (a.d === 0n) return decNormalize(1, 0n, 0);

      const digitDelta = a.d.toString().length - b.d.toString().length;
      const belowPower = digitDelta >= 0
        ? a.d < b.d * decPow10(digitDelta)
        : a.d * decPow10(-digitDelta) < b.d;
      const ratioExponent = belowPower ? digitDelta - 1 : digitDelta;
      const longDivisionPower = 30 - ratioExponent;
      const scaledNumerator = longDivisionPower >= 0
        ? a.d * decPow10(longDivisionPower)
        : a.d;
      const scaledDenominator = longDivisionPower >= 0
        ? b.d
        : b.d * decPow10(-longDivisionPower);
      const extendedQuotient = scaledNumerator / scaledDenominator;
      const guardDigit = extendedQuotient % 10n;
      let quotient = extendedQuotient / 10n;

      if (guardDigit >= 5n) {
        quotient += 1n;
      }

      const quotientExponent = ratioExponent + b.e - a.e;
      const resultScale = 29 - quotientExponent;
      const sign = a.s === b.s ? 1 : -1;

      return resultScale >= 0
        ? decNormalize(sign, quotient, resultScale)
        : decNormalize(sign, quotient * decPow10(-resultScale), 0);
    }

    function decToPlainString(dec) {
      const value = decNormalize(dec.s, dec.d, dec.e);
      if (value.d === 0n) return "0";

      const digits = value.d.toString();
      const sign = value.s < 0 ? "-" : "";
      const decimalPosition = digits.length - value.e;

      if (decimalPosition <= 0) {
        return `${sign}0.${"0".repeat(-decimalPosition)}${digits}`;
      }
      if (decimalPosition >= digits.length) {
        return `${sign}${digits}${"0".repeat(decimalPosition - digits.length)}`;
      }
      return `${sign}${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`;
    }

    const DISPLAY_SIG = 16;

    function decToDisplay(dec) {
      const value = decNormalize(dec.s, dec.d, dec.e);
      if (value.d === 0n) return "0";

      const rawDigits = value.d.toString();
      let exponent = rawDigits.length - value.e - 1;
      let roundedDigits = value.d;

      if (rawDigits.length > DISPLAY_SIG) {
        const cut = rawDigits.length - DISPLAY_SIG;
        const divisor = decPow10(cut);
        const remainder = roundedDigits % divisor;
        roundedDigits /= divisor;

        if (remainder * 2n >= divisor) {
          roundedDigits += 1n;
        }

        if (roundedDigits.toString().length > DISPLAY_SIG) {
          roundedDigits /= 10n;
          exponent += 1;
        }
      }

      const significant = roundedDigits.toString().replace(/0+$/, "");
      const sign = value.s < 0 ? "-" : "";
      const useExponent = exponent >= 16 || exponent < -9;

      if (useExponent) {
        const mantissa = significant.length === 1
          ? significant
          : `${significant[0]}.${significant.slice(1)}`;
        return `${sign}${mantissa}E${exponent}`;
      }

      const decimalPosition = exponent + 1;
      if (decimalPosition <= 0) {
        return `${sign}0.${"0".repeat(-decimalPosition)}${significant}`;
      }
      if (decimalPosition >= significant.length) {
        return `${sign}${significant}${"0".repeat(decimalPosition - significant.length)}`;
      }
      return `${sign}${significant.slice(0, decimalPosition)}.${significant.slice(decimalPosition)}`;
    }

