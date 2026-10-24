    function runSelfTests() {
      const failures = [];
      let assertions = 0;
      const assert = (cond, name) => {
        assertions += 1;
        if (!cond) failures.push(name);
      };

      const d = (str) => decFromString(str);
      const show = (a) => a === null ? "(null)" : decToDisplay(a);
      assert(show(d("8.17")) === "8.17", "roundtrip 8.17");
      assert(show(d("-5")) === "-5", "roundtrip -5");
      assert(show(d("0817")) === "817", "display normalizes leading zero");
      assert(show(decAdd(d("0.1"), d("0.2"))) === "0.3", "0.1+0.2=0.3");
      assert(show(decSub(d("5"), d("7"))) === "-2", "5-7=-2");
      assert(show(decMul(d("1.5"), d("2"))) === "3", "1.5×2=3");
      assert(show(decMul(d("999999999999999"), d("999999999999999"))) === "9.99999999999998E29", "큰 곱셈 → 16자리 반올림 후 지수 표기");
      assert(show(d("999999999999.4")) === "999999999999.4", "1e16 미만은 십진 표시");
      assert(show(d("0.0000000009")) === "9E-10", "작은 쪽 지수 경계 유지");
      assert(show(decAdd(d("2.5"), d("2.5"))) === "5", "trailing zero removed");
      assert(decDiv(d("1"), d("0")) === null, "÷0 → null");
      assert(decDiv(d("0"), d("0")) === null, "0÷0 → null");
      assert(show(decDiv(d("1"), d("3"))) === "0.3333333333333333", "1÷3 유효16자리");
      assert(show(decDiv(d("2"), d("7"))) === "0.2857142857142857", "2÷7 순환소수 유효16자리");
      assert(show(decDiv(d("2"), d("3"))) === "0.6666666666666667", "2÷3 round-half-up 마지막 자리 7");
      assert(show(decDiv(d("10"), d("4"))) === "2.5", "10÷4 정확 종결");
      assert(show(decDiv(d("-1"), d("3"))) === "-0.3333333333333333", "부호 -+");
      assert(show(decDiv(d("-1"), d("-3"))) === "0.3333333333333333", "부호 --");
      assert(show(decDiv(d("1"), d("-3"))) === "-0.3333333333333333", "부호 +-");
      assert(show(decDiv(d("1"), d("0.0000000009"))) === "1111111111.111111", "0 근접 나눗셈(1.11e9 — 유효16자리 십진 표시)");
      assert(show(decDiv(d("1000000000000"), d("0.001"))) === "1000000000000000", "1e16 미만 큰 결과는 십진 표시");
      assert(decToPlainString(decFromString("1000000000000")) === "1000000000000", "fix2: plain 1e12");
      assert(decToPlainString(decFromString("-0.0000000009")) === "-0.0000000009", "fix2: plain small negative");
      assert(decToPlainString(decDiv(decFromString("1"),decFromString("3"))) === "0.333333333333333333333333333333", "fix2: plain 1/3 내부 30자리");
      assert(formatDisplay("931392") === "931,392", "쉼표: 정수");
      assert(formatDisplay("-1234.5678") === "-1,234.5678", "쉼표: 음수+소수부(소수부 미적용)");
      assert(formatDisplay("123") === "123", "쉼표: 3자리 이하 없음");
      assert(formatDisplay("1234567890123456") === "1,234,567,890,123,456", "쉼표: 16자리");
      assert(formatDisplay("1.234567891E15") === "1.234567891E15", "쉼표: 지수 표기 통과");
      assert(formatDisplay("오류") === "오류", "쉼표: 오류 통과");
      assert(formatDisplay("0.5") === "0.5", "쉼표: 소수만");

      // applyKey — 연산자·소수점·편집
      const seq = (keys, init="") => keys.reduce((e,k)=>applyKey(e,k), init);
      assert(seq(["5","+","×"]) === "5×", "연산자 교체");
      assert(seq(["5","+","+"]) === "5+", "같은 연산자 no-op");
      assert(seq(["5",".","5",".","5"]) === "5.55", "2번째 소수점 무시");
      assert(seq([".","5"]) === "0.5", "선두 . → 0.");
      assert(seq(["5","+","."]) === "5+0.", "연산자 직후 . → 0.");
      assert(seq(["+"]) === "", "빈 수식 이항연산자 무시");
      assert(seq(["÷"]) === "", "빈 수식 ÷ 무시");
      assert(seq(["−","5"]) === "-5", "빈 수식 − = 단항");
      assert(seq(["5","+","−","3"]) === "5+-3", "연산자 직후 − = 단항");
      assert(seq(["−","−","5"]) === "-5", "단항 − 연타 무시");
      assert(seq(["1","2","3","⌫"]) === "12", "백스페이스");
      assert(seq(["1","2","C"]) === "", "C 전체 클리어");
      assert(seq(["5","±"]) === "-5", "±: 양수 꼬리 숫자를 음수로");
      assert(seq(["−","5","±"]) === "5", "±: 음수 꼬리 숫자를 양수로");
      assert(seq(["1","2","+","3","±"]) === "12+-3", "±: 수식의 꼬리 숫자만 음수로");
      assert(seq(["1","2","+","−","3","±"]) === "12+3", "±: 수식의 음수 꼬리 숫자만 양수로");
      for (const expr of ["", "12+", "12×", "("]) {
        assert(applyKey(expr, "±") === expr, `± no-op: ${expr || "empty"}`);
      }
      assert(seq("1234567890123456".split("")) === "1234567890123456", "16자리 입력 허용");
      assert(seq("12345678901234567".split("")) === "1234567890123456", "17자리째 무시");
      assert(displayValue("123456789012÷") === "123456789012", "16자리 표시: 12자리 보존");
      assert(displayValue("1234567890123456×") === "1234567890123456", "16자리 표시: 16자리 보존");
      assert(seq(["()"]) === "", "() no-op");
      assert(seq(["5","()"]) === "5", "() no-op 2");
      // tokenize + evaluate
      const ev = (expr) => { const t = tokenize(expr); return t === null ? null : evaluate(t); };
      assert(show(ev(seq(["1","2","+","3","4","×","5"]))) === "230", "즉시계산: 12+34×5=230");
      assert(show(ev(seq(["9","×","9"]))) === "81", "9×9=81");
      assert(show(ev(seq(["5","±","+","3"]))) === "-2", "± evaluate: 5 ± + 3 = -2");
      assert(show(ev(seq("999999999999".split("").concat(["+","1"])))) === "1000000000000", "13자리 결과 십진 표시(지수 아님)");
      assert(displayValue("") === "0", "display: 빈 수식 0");
      assert(displayValue("9×9×") === "81", "display: 연산자 직후 중간결과 81");
      assert(displayValue("9×9×3") === "3", "display: 숫자 입력 중엔 그 숫자");
      assert(displayValue("12+34×") === "46", "display: 좌→우 중간결과 46");
      assert(displayValue("-5") === "-5", "display: 단항 음수 입력 중");
      assert(displayValue("12+-3") === "-3", "display: ±로 음수화한 꼬리 숫자");
      assert(displayValue("7÷0×") === "오류", "display: ÷0 중간결과는 오류");
      assert(displayValue("50%") === "0.5", "display: % 적용값");
      assert(show(ev("(2+3)×4")) === "20", "괄호");
      assert(ev("7÷0") === null, "÷0 오류");
      assert(show(ev("5+")) === "5", "dangling 연산자 드롭");
      assert(show(ev("(2+3")) === "5", "미폐괄호 자동 닫기");
      assert(show(ev("50%")) === "0.5", "% 단항");
      assert(show(ev("200×10%")) === "20", "%는 즉시 적용");
      assert(show(ev("-5+3")) === "-2", "단항 − 평가");
      // soleNumberText
      assert(soleNumberText("817") === "817", "단일 숫자");
      assert(soleNumberText("-5") === "-5", "단항 − 단일 숫자");
      assert(soleNumberText("08.17") === "08.17", "리터럴 그대로(선행 0 보존)");
      assert(soleNumberText("1234567890123456") === "1234567890123456", "16자리 무장 판정 가능");
      assert(soleNumberText("12+34") === null, "연산자 있으면 null");
      assert(soleNumberText("(5)") === null, "괄호 있으면 null");
      assert(soleNumberText("") === null, "빈 수식 null");

      // trickErrorGate
      const gate = typeof trickErrorGate === "function"
        ? trickErrorGate
        : () => "missing";
      const gateState = (phase) => ({
        phase, storedText: "817", lastKey: null, pendingSole: null
      });
      for (const phase of ["off", "set", "ready"]) {
        assert(gate(gateState(phase), "C") === "pass", `error gate: C passes in ${phase}`);
      }
      for (const phase of ["off", "set", "ready"]) {
        const expectedGate = phase === "ready" ? "pass" : "blocked";
        assert(gate(gateState(phase), "=") === expectedGate, `error gate: = in ${phase}`);
      }
      for (const phase of ["off", "set", "ready"]) {
        const expectedGate = phase === "set" ? "pass" : "blocked";
        assert(gate(gateState(phase), "%") === expectedGate, `error gate: % in ${phase}`);
      }
      for (const phase of ["off", "set", "ready"]) {
        for (const key of ["7", "+"]) {
          assert(gate(gateState(phase), key) === "blocked", `error gate: ${key} blocked in ${phase}`);
        }
      }
      let gatedState = gateState("set");
      let gatedTransition = { state: gatedState, action: "blocked" };
      for (const key of ["%", "%"]) {
        gatedTransition = gate(gatedState, key) === "pass"
          ? trickStep(gatedState, key, { soleNumberText: null })
          : { state: gatedState, action: "blocked" };
        gatedState = gatedTransition.state;
      }
      assert(
        gatedTransition.action === "arm" && gatedState.phase === "ready",
        "error gate: set 오류 상태에서도 %% → arm"
      );

      // trickStep
      const T0={phase:"off",storedText:null,lastKey:null,pendingSole:null};
      const st=(s,k,sole)=>trickStep(s,k,{soleNumberText:sole});
      let a=st(T0,"%","817");
      assert(a.action==="none","1번째 %는 평범");
      a=st(a.state,"%","8.17");
      assert(a.action==="set"&&a.state.phase==="set"&&a.state.storedText==="817","%% 세팅: 1번째 % 직전 리터럴 저장");
      let b=st(a.state,"3",null); b=st(b.state,"+",null); b=st(b.state,"5",null); b=st(b.state,"=",null);
      assert(b.action==="none"&&b.state.phase==="set"&&b.state.storedText==="817","set: 정상 계산 후에도 저장 유지");
      b=st(b.state,"1",null); b=st(b.state,"2",null); b=st(b.state,"×",null); b=st(b.state,"9",null); b=st(b.state,"=",null);
      assert(b.action==="none"&&b.state.phase==="set","set: 여러 계산에도 = 미카운트");
      let r=st(b.state,"%","108"); r=st(r.state,"%",null);
      assert(r.action==="arm"&&r.state.phase==="ready"&&r.state.storedText==="817","set에서 %% → ready, 저장값 보존");
      let c=st(r.state,"=",null);
      assert(c.action==="fire"&&c.state.phase==="off"&&c.state.storedText===null,"ready: =는 무조건 발동+초기화");
      // 보존
      let k=st(a.state,"C",null);
      assert(k.state.phase==="set"&&k.state.storedText==="817","C 보존");
      k=st(k.state,"⌫",null);
      assert(k.state.phase==="set","⌫ 보존");
      // ready에서 %% no-op
      let p=st(r.state,"%","55"); p=st(p.state,"%","0.55");
      assert(p.action==="none"&&p.state.phase==="ready"&&p.state.storedText==="817","ready에서 %% no-op");
      // 단일 숫자가 아닌 수식에서는 저장 안 됨
      let m=st(T0,"3",null); m=st(m.state,"+",null); m=st(m.state,"%",null); m=st(m.state,"%",null);
      assert(m.action==="none"&&m.state.phase==="off"&&m.state.storedText===null,"수식 중 %%는 저장 안 됨");
      // ÷는 무관
      let d0=st(T0,"÷","9"); d0=st(d0.state,"÷","9");
      assert(d0.state.phase==="off","÷÷는 이제 아무것도 안 함");
      // 비연속 %
      let n=st(T0,"%","9"); n=st(n.state,"5",null); n=st(n.state,"%",null);
      assert(n.state.phase==="off","% 사이 다른 키 = 세팅 안 됨");

      // date-time reveal
      assert(formatDateTarget(new Date(2026, 7, 20, 21, 47), "24") === "268202147", "date target: 24h example");
      assert(formatDateTarget(new Date(2026, 7, 20, 8, 5), "24") === "26820805", "date target: 24h single-digit hour");
      assert(formatDateTarget(new Date(2026, 11, 31, 23, 59), "24") === "2612312359", "date target: 24h December");
      assert(formatDateTarget(new Date(2026, 0, 9, 0, 5), "24") === "2619005", "date target: 24h January midnight");
      assert(formatDateTarget(new Date(2026, 7, 20, 21, 47), "12") === "26820947", "date target: 12h evening");
      assert(formatDateTarget(new Date(2026, 7, 20, 0, 30), "12") === "268201230", "date target: 12h midnight");
      assert(formatDateTarget(new Date(2026, 7, 20, 12, 5), "12") === "268201205", "date target: 12h noon");
      assert(formatDateTarget(new Date(2026, 7, 20, 21, 47)) === "268202147", "date target: default 24h");
      const dateTarget = typeof dateTrickTarget === "function"
        ? dateTrickTarget
        : () => null;
      const dateNowMs = new Date(2026, 7, 20, 21, 46, 40).getTime();
      const datePlus = dateTarget("86419746", dateNowMs, 20, "24");
      assert(
        datePlus?.targetText === "268202147" &&
        datePlus.neededOp === "+" &&
        datePlus.queueText === "181782401",
        "date target round trip: plus values"
      );
      assert(
        datePlus !== null &&
        decToPlainString(decAdd(d("86419746"), d(datePlus.queueText))) === datePlus.targetText,
        "date target round trip: plus arithmetic"
      );
      const dateMinus = dateTarget("999999999", dateNowMs, 20, "24");
      assert(
        dateMinus?.targetText === "268202147" &&
        dateMinus.neededOp === "−" &&
        dateMinus.queueText === "731797852",
        "date target round trip: minus values"
      );
      assert(
        dateMinus !== null &&
        decToPlainString(decSub(d("999999999"), d(dateMinus.queueText))) === dateMinus.targetText,
        "date target round trip: minus arithmetic"
      );
      const date12h = dateTarget("10000000", dateNowMs, 20, "12");
      assert(
        date12h?.targetText === "26820947" &&
        date12h.neededOp === "+" &&
        date12h.queueText === "16820947",
        "date target round trip: 12h values"
      );
      assert(
        date12h !== null &&
        decToPlainString(decAdd(d("10000000"), d(date12h.queueText))) === date12h.targetText,
        "date target round trip: 12h arithmetic"
      );
      const DT0={phase:"off",queue:null,queueIndex:0};
      const DTARM={phase:"armed",queue:null,queueIndex:0};
      const dt=(s,key,ctx={})=>dateTrickStep(s,key,ctx);
      let dtStep=dt(DTARM,"+",{currentValueText:"100",targetText:"223",neededOp:"+",queueText:"123"});
      assert(dtStep.state.phase==="entering"&&dtStep.state.queue==="123"&&dtStep.state.queueIndex===0,"date trick: correct op enters");
      dtStep=dt(dtStep.state,"7");
      assert(dtStep.replaceKey==="1"&&dtStep.state.queueIndex===1,"date trick: first forced digit");
      dtStep=dt(dtStep.state,"8");
      assert(dtStep.replaceKey==="2"&&dtStep.state.queueIndex===2,"date trick: second forced digit");
      dtStep=dt(dtStep.state,"9");
      assert(dtStep.replaceKey==="3"&&dtStep.state.queueIndex===3,"date trick: third forced digit");
      dtStep=dt(dtStep.state,"0");
      assert(dtStep.action==="swallow"&&dtStep.state.queueIndex===3,"date trick: extra digit swallowed");
      dtStep=dt(dtStep.state,"⌫");
      dtStep=dt(dtStep.state,"4");
      assert(dtStep.replaceKey==="3"&&dtStep.state.queueIndex===3,"date trick: backspace rewinds queue");
      assert(dt({phase:"entering",queue:"123",queueIndex:2},"C").state.phase==="off","date trick: C cancels");
      assert(dt({phase:"entering",queue:"123",queueIndex:3},"=").state.phase==="off","date trick: equals is one-shot");
      dtStep=dt(DTARM,"−",{currentValueText:"100",targetText:"223",neededOp:"+",queueText:"123"});
      assert(dtStep.state===DTARM&&dtStep.action==="swallow","date trick: wrong op stays armed");
      const DTENTER={phase:"entering",queue:"123",queueIndex:0};
      for (const key of ["%", "×"]) {
        dtStep=dt(DTENTER,key);
        assert(dtStep.state===DTENTER&&dtStep.action==="swallow",`date trick: entering swallows ${key}`);
      }
      dtStep=dt(DTENTER,"⌫");
      assert(dtStep.state===DTENTER&&dtStep.action==="swallow","date trick: queue-start backspace swallowed");
      for (const key of ["0","9",".","+","−","×","÷","%","()","⌫","C","="]) {
        dtStep=dt(DT0,key);
        assert(dtStep.state===DT0&&dtStep.replaceKey===key&&dtStep.action==="none",`date trick: off passes ${key}`);
      }

      assert(show(ev(seq(["5","+","+","7"]))) === "12", "E2E5: 5++7=12");
      assert(show(ev(seq(["5","+"])))=== "5", "E2E7: 5+=5");
      assert(show(ev(seq(["5",".","5",".","5"]))) === "5.55", "E2E6: 5.5.5=5.55");
      assert(ev(seq(["7","÷","0"])) === null, "E2E4: 7÷0 오류");
      assert(show(ev(seq(["1","2","+","3","4","×","5"]))) === "230", "E2E1: 12+34×5=230");

      // Mnemonica stack lookup
      const stack = typeof MNEMONICA === "undefined" ? [] : MNEMONICA;
      const lookup = typeof mnemonicaLookup === "function"
        ? mnemonicaLookup
        : () => ({ position: null, card: null });
      assert(stack.length === 52, "Mnemonica: 52 cards");
      assert(new Set(stack).size === 52, "Mnemonica: all cards unique");
      assert(
        ["S", "H", "C", "D"].every(
          (suit) => stack.filter((entry) => entry.endsWith(suit)).length === 13
        ),
        "Mnemonica: 13 cards per suit"
      );
      assert(lookup("11").position === 7 && lookup("11").card === "♥Q", "Mnemonica: 11");
      assert(lookup("113").position === 31 && lookup("113").card === null, "Mnemonica: 113");
      assert(lookup("43").position === 12 && lookup("43").card === "♣A", "Mnemonica: 43");
      assert(lookup("1").position === null && lookup("1").card === "♣4", "Mnemonica: 1");
      assert(lookup("52").position === null && lookup("52").card === "♦9", "Mnemonica: 52");
      assert(lookup("310").position === 24 && lookup("310").card === null, "Mnemonica: 310");
      assert(lookup("413").position === 26 && lookup("413").card === null, "Mnemonica: 413");
      for (const input of ["999", "-5", "3.5", ""]) {
        const result = lookup(input);
        assert(result.position === null && result.card === null, `Mnemonica: invalid ${input}`);
      }

      // Mnemonica cut lookup
      const cutLookup = typeof mnemonicaCutLookup === "function"
        ? mnemonicaCutLookup
        : () => null;
      assert(
        JSON.stringify(cutLookup("1337")) === JSON.stringify({ cut: 36, bottom: "♣J" }),
        "Mnemonica cut: ♠3 to position 37"
      );
      assert(
        JSON.stringify(cutLookup("1101")) === JSON.stringify({ cut: 6, bottom: "♦6" }),
        "Mnemonica cut: ♠A to position 01"
      );
      assert(
        JSON.stringify(cutLookup("11001")) === JSON.stringify({ cut: 33, bottom: "♣8" }),
        "Mnemonica cut: ♠10 to position 01"
      );
      assert(
        JSON.stringify(cutLookup("1107")) === JSON.stringify({ cut: 0, bottom: "♦9" }),
        "Mnemonica cut: no cut"
      );
      for (const input of ["1353", "5137", "137", "11", "113705", "3.5", ""]) {
        assert(cutLookup(input) === null, `Mnemonica cut: invalid ${input}`);
      }

      // Undo Influence joker setup
      const undoLookup = typeof undoSetupLookup === "function"
        ? undoSetupLookup
        : () => null;
      assert(
        JSON.stringify(undoLookup("1825")) === JSON.stringify({ upper: 28, lower: 47 }),
        "Undo Influence: 18:25"
      );
      assert(
        JSON.stringify(undoLookup("1843")) === JSON.stringify({ upper: 10, lower: 29 }),
        "Undo Influence: original 18:43 setup"
      );
      assert(
        JSON.stringify(undoLookup("625")) === JSON.stringify({ upper: 28, lower: 35 }),
        "Undo Influence: 6:25"
      );
      assert(
        JSON.stringify(undoLookup("1805")) === JSON.stringify({ upper: 35, lower: 41 }),
        "Undo Influence: reversed 18:05"
      );
      for (const input of ["1111", "1859", "1800", "18", "18253", "3.5"]) {
        assert(undoLookup(input) === null, `Undo Influence: invalid ${input}`);
      }

      const panel = document.getElementById("selftest");
      const passed = failures.length === 0;
      const headline = passed
        ? `ALL PASS (${assertions} assertions)`
        : `FAIL (${failures.length}/${assertions})`;
      panel.className = passed ? "pass" : "fail";
      panel.textContent = passed
        ? headline
        : `${headline}\n${failures.map((name) => `- ${name}`).join("\n")}`;
      console[passed ? "log" : "error"](panel.textContent);
      return { assertions, failures };
    }

