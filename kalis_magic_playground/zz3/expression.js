    function expressionTokenCount(expr) {
      let count = 0;
      let index = 0;

      while (index < expr.length) {
        if (expr[index] === "-" && /[\d.]/.test(expr[index + 1] ?? "")) {
          index += 1;
        }

        if (/[\d.]/.test(expr[index] ?? "")) {
          while (index < expr.length && /[\d.]/.test(expr[index])) index += 1;
        } else {
          index += 1;
        }
        count += 1;
      }

      return count;
    }

    function applyKey(expr, key) {
      const source = String(expr ?? "");
      const acceptedKeys = /^(?:[0-9]|\.|\+|−|×|÷|\(\)|%|±|C|⌫)$/;

      if (!acceptedKeys.test(key)) return source;
      if (key === "C") return "";
      if (key === "⌫") return source.slice(0, -1);

      const withinTokenLimit = (candidate) =>
        expressionTokenCount(candidate) <= 100 ? candidate : source;
      const last = source.at(-1) ?? "";
      const binaryOperators = "+−×÷";
      const expectsOperand =
        source === "" || binaryOperators.includes(last) || last === "(" || last === "-";

      if (key === "±") {
        const trailingNumber = /(^|[+−×÷(])(-?)(\d+(?:\.\d*)?|\.\d+)$/.exec(source);
        if (trailingNumber === null) return source;
        const [numberText, prefix, sign, digits] = trailingNumber;
        const toggledNumber = `${prefix}${sign === "-" ? "" : "-"}${digits}`;
        return withinTokenLimit(`${source.slice(0, -numberText.length)}${toggledNumber}`);
      }

      if (/^\d$/.test(key)) {
        const currentNumber = /[\d.]+$/.exec(source)?.[0] ?? "";
        const digitCount = (currentNumber.match(/\d/g) ?? []).length;
        if (digitCount >= 16) return source;
        return withinTokenLimit(source + key);
      }

      if (key === ".") {
        if (expectsOperand) return withinTokenLimit(`${source}0.`);
        const currentNumber = /[\d.]+$/.exec(source)?.[0] ?? "";
        if (currentNumber === "" || currentNumber.includes(".")) return source;
        return withinTokenLimit(`${source}.`);
      }

      if (key === "()") {
        return source;
      }

      if (key === "%") {
        return /[\d.)%]/.test(last) ? withinTokenLimit(`${source}%`) : source;
      }

      if (key === "−") {
        if (expectsOperand) {
          return last === "-" ? source : withinTokenLimit(`${source}-`);
        }
        return withinTokenLimit(`${source}−`);
      }

      if (source === "" || last === "(" || last === "-") return source;
      if (binaryOperators.includes(last)) {
        return last === key
          ? source
          : withinTokenLimit(`${source.slice(0, -1)}${key}`);
      }
      return withinTokenLimit(`${source}${key}`);
    }

    function tokenize(expr) {
      const source = String(expr ?? "");
      const tokens = [];
      let index = 0;
      let openCount = 0;
      let expectsOperand = true;
      const push = (token) => {
        tokens.push(token);
        return tokens.length <= 100;
      };

      while (index < source.length) {
        const char = source[index];

        if (expectsOperand && (char === "-" || char === "−")) {
          if (source[index + 1] === "(") {
            if (!push({ t: "num", v: "-1" }) || !push({ t: "op", v: "*" })) {
              return null;
            }
            index += 1;
            continue;
          }
          const numberMatch = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(index + 1));
          if (!numberMatch || !push({ t: "num", v: `-${numberMatch[0]}` })) return null;
          index += numberMatch[0].length + 1;
          expectsOperand = false;
          continue;
        }

        if (/[\d.]/.test(char)) {
          if (!expectsOperand) return null;
          const numberMatch = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(index));
          if (!numberMatch || !push({ t: "num", v: numberMatch[0] })) return null;
          index += numberMatch[0].length;
          expectsOperand = false;
          continue;
        }

        if (char === "(") {
          if (!expectsOperand || !push({ t: "lp" })) return null;
          openCount += 1;
          index += 1;
          continue;
        }

        if (char === ")") {
          if (expectsOperand || openCount === 0 || !push({ t: "rp" })) return null;
          openCount -= 1;
          index += 1;
          expectsOperand = false;
          continue;
        }

        if (char === "%") {
          if (expectsOperand || !push({ t: "pct" })) return null;
          index += 1;
          continue;
        }

        const mappedOperator = {
          "+": "+",
          "−": "-",
          "×": "*",
          "÷": "/"
        }[char];
        if (mappedOperator) {
          if (expectsOperand || !push({ t: "op", v: mappedOperator })) return null;
          index += 1;
          expectsOperand = true;
          continue;
        }

        return null;
      }

      return tokens;
    }

    function evaluate(tokens) {
      if (!Array.isArray(tokens) || tokens.length === 0 || tokens.length > 100) return null;

      const prepared = tokens.map((token) => ({ ...token }));
      while (prepared.at(-1)?.t === "op") prepared.pop();
      if (prepared.length === 0) return null;

      let balance = 0;
      for (const token of prepared) {
        if (token.t === "lp") balance += 1;
        if (token.t === "rp") {
          balance -= 1;
          if (balance < 0) return null;
        }
      }
      while (balance > 0) {
        prepared.push({ t: "rp" });
        balance -= 1;
      }

      const values = [];
      const operators = [];
      const precedence = { "+": 1, "-": 1, "*": 1, "/": 1 };
      const hundred = decFromString("100");
      let expectsOperand = true;

      const applyTopOperator = () => {
        const operator = operators.pop();
        if (!operator || operator === "(" || values.length < 2) return false;
        const right = values.pop();
        const left = values.pop();
        const result = operator === "+"
          ? decAdd(left, right)
          : operator === "-"
            ? decSub(left, right)
            : operator === "*"
              ? decMul(left, right)
              : decDiv(left, right);
        if (result === null) return false;
        values.push(result);
        return true;
      };

      for (const token of prepared) {
        if (token.t === "num") {
          if (!expectsOperand || typeof token.v !== "string") return null;
          try {
            values.push(decFromString(token.v));
          } catch {
            return null;
          }
          expectsOperand = false;
          continue;
        }

        if (token.t === "pct") {
          if (expectsOperand || values.length === 0) return null;
          const percentage = decDiv(values.pop(), hundred);
          if (percentage === null) return null;
          values.push(percentage);
          continue;
        }

        if (token.t === "lp") {
          if (!expectsOperand) return null;
          operators.push("(");
          continue;
        }

        if (token.t === "rp") {
          if (expectsOperand) return null;
          while (operators.length > 0 && operators.at(-1) !== "(") {
            if (!applyTopOperator()) return null;
          }
          if (operators.pop() !== "(") return null;
          expectsOperand = false;
          continue;
        }

        if (token.t === "op" && Object.hasOwn(precedence, token.v)) {
          if (expectsOperand) return null;
          while (
            operators.length > 0 &&
            operators.at(-1) !== "(" &&
            precedence[operators.at(-1)] >= precedence[token.v]
          ) {
            if (!applyTopOperator()) return null;
          }
          operators.push(token.v);
          expectsOperand = true;
          continue;
        }

        return null;
      }

      if (expectsOperand) return null;
      while (operators.length > 0) {
        if (operators.at(-1) === "(" || !applyTopOperator()) return null;
      }
      return values.length === 1 ? values[0] : null;
    }

    function displayValue(expr) {
      const source = String(expr ?? "");
      if (source === "") return "0";

      if (/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:E-?\d+)?$/.test(source)) {
        return source;
      }

      const trailingNumber =
        /(?:^|[+−×÷(])(-?(?:\d+(?:\.\d*)?|\.\d+))$/.exec(source);
      if (trailingNumber) return trailingNumber[1];

      let evaluable = source;
      const last = source.at(-1);
      if ("+−×÷".includes(last)) {
        evaluable = source.slice(0, -1);
      } else if (last === "-") {
        evaluable = source.slice(0, -1);
        if (evaluable === "") return "0";
      }

      const tokens = tokenize(evaluable);
      const value = tokens === null ? null : evaluate(tokens);
      return value === null ? "오류" : decToDisplay(value);
    }

    function formatDisplay(str) {
      const source = String(str ?? "");
      if (source === "오류" || source.includes("E")) return source;

      const number = /^(-?)(\d+)(\.\d*)?$/.exec(source);
      if (number === null) return source;

      const [, sign, integer, fraction = ""] = number;
      const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return `${sign}${grouped}${fraction}`;
    }

    function soleNumberText(expr) {
      const source = String(expr ?? "");
      return /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(source) ? source : null;
    }

