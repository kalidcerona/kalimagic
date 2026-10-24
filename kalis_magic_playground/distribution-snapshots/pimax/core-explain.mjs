import {
  LETTER_NAME,
  LINES,
  lineDigits,
  lineCompact,
} from "./core-stack.mjs";
import {
  canonicalAnswerText,
} from "./core-grading.mjs";

export function visiblePrompt(question, { showHint = false, showAnswer = false, phonetic = false } = {}) {
  const parts = [
    question.public.kicker,
    question.public.big,
    question.public.note,
    question.public.placeholder,
  ];
  if (phonetic && question.public.phonetic) parts.push(question.public.phonetic);
  if (showHint) parts.push(question.hint);
  if (showAnswer) parts.push(...explainQuestion(question));
  return parts.filter(Boolean).join("\n");
}

export function explainQuestion(question, options = {}) {
  const phonetic = options.phonetic !== false;
  const answer = question.answer;
  if (answer.type === "map") {
    const letter = answer.kind === "digit" ? answer.letter : answer.prompt;
    const digit = answer.kind === "digit" ? answer.prompt : answer.digit;
    return [
      `${digit} ↔ ${letter}`,
      phonetic ? `글자 이름 ${LETTER_NAME[letter]}` : "",
      "대응은 영문 철자 기준입니다. 한글 발음으로 숫자를 정하지 않습니다.",
    ].filter(Boolean);
  }
  if (answer.type === "phrase-next") return canonicalAnswerText(question).split("\n");
  if (answer.type === "phrase") {
    return [
      answer.phrase,
      answer.digits,
      "영어 문장 전체를 숫자로 바꿉니다. 앞의 0도 포함합니다.",
    ];
  }
  if (answer.type === "row") {
    if (answer.kind === "sequence") {
      return [
        LINES.map((line) => line.phrase).join(" / "),
        phonetic ? LINES.map((line) => line.spoken).join(" · ") : "",
        "마지막 줄 다음은 첫 줄로 돌아갑니다.",
      ].filter(Boolean);
    }
    const line = LINES[answer.row];
    const cycle = answer.kind.startsWith("next-")
      ? `${LINES[answer.from].phrase} 다음은 ${line.phrase} 입니다.`
      : `암기 줄 ${answer.row}`;
    return [
      cycle,
      phonetic ? `${line.phrase} · ${line.spoken}` : line.phrase,
      lineDigits(answer.row),
      phonetic ? `글자 이름 ${[...lineCompact(answer.row)].map((ch) => LETTER_NAME[ch]).join(" ")}` : "",
    ].filter(Boolean);
  }
  if (answer.type === "odd") {
    if (answer.special === "pi") {
      return [
        "1쪽의 첫 세 숫자는 314입니다.",
        "이 값만 실제 원주율의 시작입니다. 52자리 순환으로 계산하지 않습니다.",
      ];
    }
    return [
      `${answer.page}쪽 · 암기 줄 ${answer.row} · ${answer.column}번째`,
      `${answer.letters} · ${answer.digits}`,
      "10의 자리는 암기표의 줄 0-4, 1의 자리는 1부터 세는 글자 위치입니다.",
      "끝자리가 0이면 10번째입니다.",
      "고른 글자와 다음 두 글자를 52자리에서 이어서 읽습니다.",
      answer.page === 49 ? "49쪽 다음은 페이지 2 연습 범위 밖입니다." : "",
    ].filter(Boolean);
  }
  if (answer.type === "next") {
    return [
      `들은 다섯 자리 ${answer.given}`,
      `바로 다음 열 자리 ${answer.nexts.join(" 또는 ")}`,
      "다섯 자리는 정답 열 자리에 포함하지 않습니다. 52번째 다음은 처음으로 돌아갑니다.",
    ];
  }
  if (answer.type === "birthday") {
    const orderLabel = answer.order === "MMDD" ? "월일(MMDD)" : "일월(DDMM)";
    return [
      `${answer.month}월 ${answer.day}일 · ${orderLabel} · ${answer.dateStr}`,
      `쪽 ${answer.page} · 줄 ${answer.line} · ${answer.column}번째`,
      "쪽 = 일 + 50",
      "줄 = 월 × 2",
      "MMDD(월일) 시작 = 월 + 3",
      "DDMM(일월) 시작 = 월 + 1",
      "2월 29일 허용 · 번호는 1부터",
      "생일의 줄 번호와 암기표의 줄 번호는 다릅니다.",
    ];
  }
  if (answer.type === "lie") {
    const lines = answer.candidates.map(
      (candidate) =>
        `위치 ${candidate.position} · 원래 ${candidate.original} · 들은 ${candidate.heardDigit} · 실제 ${candidate.actual}`,
    );
    return [
      `${answer.heard.length}자리에서 한 자리만 다른 후보 ${answer.candidates.length}개`,
      ...lines,
      "맞는 후보의 위치와 원래 숫자는 모두 정답입니다.",
    ];
  }
  return [];
}

export function referenceNotes() {
  return {
    page21FormulaDigits: "201",
    page21FormulaLetters: "NOI",
    page21DemoDigits: "386",
    page21Warning: "시연 메모의 21쪽 386은 이 계산과 다릅니다. 연습 정답은 NOI / 201입니다.",
    piWarning: "1쪽만 실제 원주율 314입니다. 52자리 순환의 답이 아닙니다.",
    after49: "49쪽 다음은 페이지 2 범위 밖이라 순환 스택 연습으로 이어 갑니다.",
  };
}
