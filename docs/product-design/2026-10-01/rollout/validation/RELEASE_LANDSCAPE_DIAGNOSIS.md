# RELEASE 진입 반복·가로 화면 진단

최초 전체 검사에서 RELEASE E의 설정 진입 1건이 실패했다. 같은 입력을 현재와 기준의 새 브라우저 컨텍스트에서 각각 8회 반복한 결과 16회 모두 성공했고, RELEASE 전체 8개 세로 화면 재검증도 통과했다. 최초 실패는 재현되지 않은 간헐 실패로 구분한다. 정확한 원인은 확인하지 못했으며 최초 `final/report.json`과 실패 PNG를 보존했다. 제품 코드와 진입 단언은 수정하지 않았다.

## 근거

- `release-entry/source-evidence.json`: 두 로컬 서버에서 실제 RELEASE index.html의 touchstart/move/end/cancel 블록과 time-machine.js의 isSettingsSwipe 함수를 읽어 저장했다. 현재·기준 모두 바이트 동일이다. 판별 조건은 각 손가락의 아래 이동 96px 이상, 가로 이동은 아래 이동의 0.65배 이하이다. 실제 touchstart는 두 터치의 시작점과 ID를 기록하고 기본 처리를 막으며 touchmove가 조건을 만족하면 설정 화면으로 이동한다.
- `release-entry/report.json`: 현재 8건·기준 8건의 동일 E 768×900 입력과 이벤트 타임라인. 현재의 초기 상태는 8건 모두 `input-screen` 768×900, ‘암호 입력’이다. 실제 입력 이동은 최신 도구의 40→85→135→175px와 제스처 후 800ms 대기를 그대로 사용했다.
- `release-final/report.json`: RELEASE A-H 8건 재검증. 설정 진입, 콘텐츠 폭·터치 영역·정체성 정렬, 긴 한국어, 높이 축소 수동 스크롤, 합성 safe-area 및 D의 같은 페이지 Fold 검사 포함. 실패 0건, PNG 54개다.

반복 성공은 최초 실패를 지우지 않으며 모든 상황의 제스처 신뢰성을 증명하지 않는다. 기존 코드가 기준과 동일하고 동일 실패가 이번 제한된 반복에서 재현되지 않았다는 근거다. 실기 재현은 확인하지 않았다.

## 요청한 가로 화면

`release-entry/report.json`에서 844×390과 1180×820 두 화면을 TYCHE, USOTSUKI, QR, Memdeck 각각 확인했다. 실제 설정 진입과 합성 safe-area를 포함한 설정 8건, 공연·학습 동작 8건 모두 실패 0건이다.

| 앱 | 실제 입력과 확인 | 결과 |
|---|---|---|
| USOTSUKI | 검사 버튼 네이티브 터치 시작, 120ms 후 종료 | ‘검사 중’ → ‘취소됨’, 두 화면 통과 |
| TYCHE | 실제 회전판에서 목표 지정 후 다시 터치 | 저장된 spins 1, 두 화면 통과 |
| Memdeck | 실제 다음 카드 버튼 | Q♥ 1번 → 2♠ 2번, 두 화면 통과 |
| QR | 실제 생성 버튼 후 캔버스 픽셀을 jsQR로 판독 | 두 화면 모두 생성·판독 성공 |

가로 공연·학습 문서의 가로 넘침도 검사했다. QR 판독은 내장 jsQR이며 물리 카메라 검사와 다르다. 모든 입력은 격리된 로컬 브라우저 컨텍스트에서 이루어졌으며 설정·회차는 사용자 브라우저에 저장하지 않았다.

## 실제 검증

Node 실행 파일은 `/Users/sumpie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`다. 도구 위치는 `/Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/validation`이다.

```bash
node release-landscape-diagnostic.cjs --base-url http://127.0.0.1:19362 --baseline-url http://127.0.0.1:19365 --out "/Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/validation/release-entry"
```

실제 위 절대 Node 실행 파일로 수행: exit 0. 출력 `releaseTrials:16, releaseFailures:0, landscapeSettingsCases:8, landscapePerformanceCases:8, failures:0, pngCount:80`. `release-entry/gallery.html`에 캡처를 모았다.

```bash
node mobile-verify.cjs --base-url http://127.0.0.1:19362 --baseline-url http://127.0.0.1:19365 --apps zz2 --out "/Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/validation/release-final"
```

실제 위 절대 Node 실행 파일로 수행: exit 0. 출력 `settingsCases:8, failedSettingsCases:0, failures:0, pngCount:54`. JSON과 실제 PNG를 별도로 재계수했고 80개·54개가 일치했다. 소스 계약 읽기·해시 비교도 exit 0, `sameTouchContract:true, sameThresholdContract:true`였다.

STATUS: DONE
Files changed: release-landscape-diagnostic.cjs, RELEASE_LANDSCAPE_DIAGNOSIS.md, README.md 및 release-entry/release-final 근거 파일
Verification: 진단 exit 0, RELEASE 8건 재검증 exit 0, 결정적 JSON/PNG 재계수 exit 0
Open issues: 최초 간헐 실패의 정확한 원인과 물리 기기 재현 여부 미확인
