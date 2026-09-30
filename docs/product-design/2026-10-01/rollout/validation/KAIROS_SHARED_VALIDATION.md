# KAIROS 공유판 검증

사용자가 승인한 개인 KAIROS와 동일한 설정 UI를 실제 빌드된 `/tools/kairos/`와 `/tools/kairos-classic/` 경로에서 확인했다. 두 경로 각각 세로 A-H 8건, 총 16건 모두 실패 0건이다. 세로 시작·랩·정지·재설정과 가로 START·STOP·RESET도 두 경로 모두 통과했다. 앱 코드는 이 검증 담당이 수정하지 않았다.

## 실제 브라우저 근거

서버 `http://127.0.0.1:19366`은 루트 담당이 새 `kalis_magic_playground/dist`를 제공하도록 시작한 서버다. 테스트가 직접 개인 zz1 경로를 열거나 공유 페이지에 숨김 속성을 조작한 것이 아니다.

| 결과 디렉터리 | 실행 범위 | 실패 | 실제 PNG |
|---|---|---:|---:|
| shared-kairos | tools/kairos A-H 설정 8건 | 0 | 36 |
| shared-kairos-classic | tools/kairos-classic A-H 설정 8건 | 0 | 36 |
| shared-kairos-timer | KAIROS 세로·가로 실제 타이머 입력 2건 | 0 | 4 |
| shared-kairos-classic-timer | Classic 세로·가로 실제 타이머 입력 2건 | 0 | 4 |

각 디렉터리의 `report.json`이 원본 결과이며 설정 디렉터리의 `gallery.html`에 A-H와 합성 캡처가 있다. JSON의 실패 목록과 PNG 파일을 별도로 재계수했다. 총 PNG는 80개다.

설정 진입은 실제 CDP 두 손가락 아래 스와이프다. 제스처 뒤 800ms를 기다린다. 가로 넘침, 560px 설정 콘텐츠, 44px 활성 터치 영역, 기호 오른쪽·중앙 정렬, 마지막 CTA 스크롤 도달과 가림 여부, 긴 한국어, 실제 CSS env()를 대체하는 합성 safe-area를 검사했다. 각 경로 D에서는 같은 페이지에서 cover → inner → cover 전환도 확인했다. 커스텀 UI가 꺼진 공유 설정에서 현재 보이는 일반 텍스트 필드가 없으면 높이 축소 필드 검사는 대상 없음으로 기록하고 통과했다고 주장하지 않는다.

타이머는 390×844에서 실제 시작 버튼, 320ms 경과, 실제 랩 버튼으로 기록 1개, 실제 중단 버튼, 정지 시간 유지, 실제 재설정 버튼을 확인했다. 844×390에서는 실제 설정을 열어 ‘가로’ 모드 버튼과 닫기를 누르고 대기한 뒤 실제 START/STOP/RESET을 터치했다. 설정 속성을 직접 바꾸지 않았다.

## 원본·빌드의 동일성과 허용된 변환

`kairos-shared-source-evidence.json`에 파일별 SHA-256과 빌드 검증을 저장했다. `kalis_magic_playground/zz1`과 `distribution-snapshots/kairos`의 12개 파일이 바이트 단위로 모두 동일했다. 대상 파일은 index.html, logic.js, settings-ui.css, settings-ui.js, sw.js, manifest.webmanifest, fullscreen.js, brand-logo.jpg, brand-logo.png, icon.svg, icon-192.png, icon-512.png다.

실제 각 공유 dist는 기존 PRIVATE_PATTERNS에 따라 fullscreen.js를 제외한 11개 파일이다. 이 필터의 근거는 `kalis_magic_playground/scripts/build-public.mjs:78`이다. 제외한 파일을 누락 문제로 처리하지 않았다. 첫 비교 시 dist에 12개 모두 있다고 잘못 가정해 FileNotFoundError로 exit 1이 발생했으며, 실제 기존 필터를 확인하고 11개 목록과 제외 사유를 구분해 재검증했다. 수정한 비교는 exit 0이다.

각 공유 경로에서 스냅샷과 달라지는 파일은 index.html, logic.js, manifest.webmanifest 세 개뿐이었다. index와 logic의 저장 키 변환은 빌드 규칙대로 정확히 일치했다. index에 기존 HTTPS 인증 스크립트와 `data-magic-customize="off"`만 삽입된 예상 결과가 실제 빌드와 정확히 일치했다. manifest의 id는 각 공유 경로, start_url과 scope는 `./`인 예상 객체와 동일했다. 나머지 8개 파일은 스냅샷과 바이트 동일했다. 근거는 `build-public.mjs:229-270`과 source-evidence JSON이다.

커스텀 카드의 비노출은 기존 공유 정책이다. `zz1/settings-ui.js:52,69,76`의 경로·off 조건이 해당 카드를 만들지 않는다. 개인 설정과 차이가 있는 이 조건을 이번 검증에서 제거하지 않았다.

## 실행 명령과 결과

모든 Node 명령의 실행 파일은 `/Users/sumpie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`이고, 검증 도구는 `/Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/validation` 아래 있다. 실제 명령은 다음과 같았다.

```bash
/Users/sumpie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node "/Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/validation/mobile-verify.cjs" --base-url http://127.0.0.1:19366 --apps zz1 --route tools/kairos --out "/Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/validation/shared-kairos"
/Users/sumpie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node "/Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/validation/mobile-verify.cjs" --base-url http://127.0.0.1:19366 --apps zz1 --route tools/kairos-classic --out "/Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/validation/shared-kairos-classic"
/Users/sumpie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node "/Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/validation/shared-kairos-timer.cjs" --base-url http://127.0.0.1:19366 --apps zz1 --route tools/kairos --out "/Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/validation/shared-kairos-timer"
/Users/sumpie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node "/Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/validation/shared-kairos-timer.cjs" --base-url http://127.0.0.1:19366 --apps zz1 --route tools/kairos-classic --out "/Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/validation/shared-kairos-classic-timer"
```

네 브라우저 실행 모두 exit 0. 설정 출력은 각각 `settingsCases:8, failedSettingsCases:0, failures:0, pngCount:36`, 타이머 출력은 각각 `timerCases:2, failures:0, pngCount:4`다.

`mobile-verify.cjs`의 --route는 앱 하나를 선택할 때만 경로를 바꾼다. 기존 개인 앱 기본 경로는 그대로다. 앱 두 개와 --route를 함께 보낸 부정 검사는 기대한 exit 1과 `--route requires exactly one app and a relative route` 오류로 거부됐다. 두 CJS 문법 검사와 JSON/PNG 재계수는 exit 0이다.

공유판의 알려진 안내·세로 모드 테스트 preference만 실제 빌드의 friend namespace로 매핑했다. HTTPS 확인 코드를 바꾸거나 요청을 가로채지 않았다. 로컬 HTTP에서는 원래 코드의 HTTPS 조건이 실행되지 않으므로 실제 HTTPS 인증·권한 동작을 확인했다고 주장하지 않는다. 물리 기기·운영체제 IME·물리 safe-area 확인도 포함하지 않는다.

STATUS: DONE
Files changed: mobile-verify.cjs, shared-kairos-timer.cjs, KAIROS_SHARED_VALIDATION.md, README.md, kairos-shared-source-evidence.json 및 네 shared-kairos 결과 디렉터리
Verification: 공유 설정 16건과 타이머 4건 exit 0, 12개 원본 동일성 및 허용된 빌드 변환 exit 0, 실제 PNG 총 80개
Open issues: 실제 HTTPS 인증·물리 기기·OS IME는 이 로컬 검사 범위 밖
