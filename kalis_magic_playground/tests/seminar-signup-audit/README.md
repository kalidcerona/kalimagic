# 로컬 화면 검증 재현

`kalis_magic_playground`를 현재 디렉터리로 사용한다. 기존 Node, Python 3, Pillow, playwright-core와 Chrome 설치가 필요하다. 이 절차는 새 패키지를 설치하거나 실제 API·Google 시트에 연결하지 않는다.

첫 번째 터미널에서 루프백 전용 임시 정적 서버를 시작한다. 검사가 끝나면 이 터미널에서 Ctrl+C로 종료한다.

```sh
python3 -m http.server 8927 --bind 127.0.0.1 --directory dist
```

두 번째 터미널에서 이미 설치된 패키지와 실행 파일의 경로를 지정한다. 아래 예시 경로는 각 환경의 실제 경로로 바꾼다. 로컬 Node에서 `playwright-core`를 해석할 수 있으면 `PLAYWRIGHT_CORE_PATH`는 생략할 수 있다.

```sh
export SEMINAR_AUDIT_DIR="$(mktemp -d)"
export PLAYWRIGHT_CORE_PATH='/absolute/path/to/node_modules/playwright-core'
export CHROME_PATH='/absolute/path/to/chrome-executable'
node tests/seminar-signup-audit/regression.mjs
node tests/seminar-signup-audit/browser-audit.cjs
node tests/seminar-signup-audit/retry-audit.cjs
node tests/seminar-signup-audit/consent-refresh.cjs
python3 tests/seminar-signup-audit/summarize.py
```

`regression.mjs`는 자체 루프백 포트에서 실제 신청 함수와 Code.gs를 모의 Google 서비스에 연결해 재시도 키·한 행 저장·매진·오류 정정을 검증한다.

화면 캡처용 브라우저는 `http://127.0.0.1:8927/seminar-signup/`만 방문하며 두 신청 API는 합성 응답으로 대체한다. PNG, JSON, 한국어 검증 보고서는 소스 트리 밖에 지정한 SEMINAR_AUDIT_DIR에 기록한다. 화면에는 합성 참가자·테스트 계좌만 사용한다. 실제 Google 잠금·저장 검증 결과로 해석하면 안 된다.
