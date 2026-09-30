# 개인 앱 모바일 검증 도구

`mobile-verify.cjs`는 13개 개인 앱의 설정 화면을 Chromium 터치 에뮬레이션으로 확인한다. 이 도구는 앱 코드를 수정하지 않는다. 결과는 반드시 이 validation 디렉터리 안의 `--out` 경로에 저장한다. 구조 근거는 상위 `ARCHITECTURE_AUDIT.md`다. zz9는 로컬 PRIVATE 앱이며 공개 배포 여부를 이 도구에서 변경하지 않는다.

전체 실행:

```bash
/Users/sumpie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node "/Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/validation/mobile-verify.cjs" --base-url http://127.0.0.1:19362 --baseline-url http://127.0.0.1:19365 --out "/Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/validation/artifacts"
```

특정 앱만 다시 실행하려면 별도 결과 경로와 `--apps zz1,zz12,zz13`을 사용한다. 기준 서버가 없으면 `--baseline-url`을 생략할 수 있으나 공연 보존 비교가 미실행으로 기록된다. 서버는 `/zz1/`부터 `/zz13/`까지 활성 진입점과 자산을 제공해야 한다. 이전 서버는 실제 이전 앱 파일과 자산을 제공해야 하며 현재 파일을 기준 서버로 재사용하지 않는다.

검사 화면은 A 320×740, B 390×844, C 480×960, D 280×900, E 768×900, F 744×1133, G 820×1180, H 1280×1848이다. 전체 실행의 설정 케이스는 104건이다. 케이스별로 초기 설정 상단, 펼친 설정 하단, 입력 필드가 있는 경우 높이 축소 화면을 저장한다. D에서는 같은 페이지에서 cover → inner → cover로 크기를 바꾸고 각 상태를 저장한다. 갤러리는 화면 크기 탭, 앱별 화면, 흑백 전환을 제공한다.

설정 진입은 zz12의 기존 설정·백업 탭을 제외하면 CDP 네이티브 두 손가락 아래 스와이프다. 진입 전에 실제 공연 시작 버튼을 눌러야 하는 앱은 해당 버튼을 사용한다. 설정 제스처 뒤 800ms를 기다린다. 진입 실패는 실패와 캡처로 기록하며 숨김 속성 변경이나 PC 단축키로 대체하지 않는다. 초기 안내를 생략하는 저장 키는 활성 소스의 가이드 키로 한정한다. zz9는 격리된 브라우저에서 작은 PNG 두 장을 실제 업로드 필드로 올린다. zz10은 Chromium 가상 카메라와 실제 시작 버튼을 사용한다.

가로 넘침, 설정 콘텐츠 560px 제한, 표시된 활성 컨트롤의 44px 터치 영역, 정체성 기호의 문구 오른쪽·중앙 정렬, 마지막 CTA의 화면 내 스크롤 도달과 가림 여부를 검사한다. 체크박스·라디오·파일 입력의 실제 연결 라벨을 터치 영역으로 인정한다. 닫힌 세부 설정은 실제 summary 클릭으로 펼쳐 검사한다. 긴 한국어 검사에서는 기존 텍스트 노드 일부에 긴 문구를 넣고 측정 후 복원한다. 입력 필드 검사는 포커스를 유지하면서 화면 높이를 55%로 줄이고 필드를 중앙으로 수동 스크롤하여 고정 하단 CTA 위에 놓은 뒤 실제 가림 여부를 검사한다. 필드 캡처 후 CTA를 따로 스크롤하고 캡처한다.

공연 B 화면은 기준·현재를 저장하고 날짜·시간용 선택자만 마스크한다. 비교 PNG와 변경 픽셀 수는 검토 근거다. 무작위, 카메라, QR, canvas 차이가 포함될 수 있으므로 픽셀 차이를 곧바로 공연 변경으로 단정하지 않는다. 보존 확인에는 활성 소스의 변경 범위 검토가 함께 필요하다. PC 설정 보조 UI의 실제 화면 노출은 검사하지만 모든 소스의 구조적 삭제 확인은 별도 담당의 검사다.

`report.json`의 최상위 failures에 설정, 스트레스, Fold, 공연 비교 오류와 실행 오류를 모은다. 실패 케이스 수, 전체 실패 항목 수, 이번 실행 생성 PNG 수, 결과 디렉터리의 실제 PNG 수는 구분한다. 실패 시 종료 코드 1, 도구 실행 중단 시 2, 검사 실패가 없으면 0이다. `SUMMARY.md`와 `gallery.html`은 같은 결과에서 생성된다.

각 케이스의 격리된 브라우저 컨텍스트에서 실제 스타일시트와 인라인 스타일의 `env(safe-area-inset-*)` 선언을 top 28px, right 18px, bottom 32px, left 18px로 대체한다. 전체 CSS 선언 순서와 중첩 미디어 규칙을 유지하며 테스트 전용 스타일로만 적용한다. 합성 상태에서 가로 넘침·560px 폭·44px 터치 영역·카드의 가로 잘림·CTA 도달과 가림을 측정하고 상단·하단 화면을 저장한다. 이후 테스트 스타일을 제거하고 변경한 인라인 선언을 복원하여 Fold 검사가 합성 스타일의 영향을 받지 않게 한다. 대체한 실제 env() 수, 읽을 수 없는 스타일시트, 복원 결과를 기록한다.

실기, 운영체제 키보드/IME, 물리 기기의 safe-area는 확인하지 않는다. 위 safe-area 검사는 합성 검사이며 물리 기기 확인을 통과로 주장하지 않는다. 카메라·QR의 실제 기기 판독도 확인하지 않는다.

## 작성 시 실제 확인

- 절대 Node 경로의 `node --check mobile-verify.cjs`: exit 0, 출력 없음.
- 브라우저 실행: 앱 작성자가 동시에 작업 중이므로 요청에 따라 미실행. 루트 담당이 앱 변경 완료 후 실행한다.

STATUS: DONE
Files changed: mobile-verify.cjs, README.md
Verification: Node 문법 검사 exit 0; 브라우저 검사 미실행
Open issues: 앱 변경 완료 후 루트 담당의 전체 실행과 결과 검토 필요

## 제스처·입력 도달 진단

`diagnostic/diagnostic.json`은 실제 네이티브 입력 이벤트 근거다. zz8은 기준과 현재 모두 40px부터 나누어 이동하면 첫 이동 뒤 브라우저 기본 panning으로 pointercancel이 발생하며 설정을 열지 못했다. 첫 이동을 175px로 보내는 빠른 두 손가락 아래 스와이프는 기준과 현재 모두 설정 진입에 성공했다. 따라서 zz8 검증은 실제 빠른 스와이프를 사용한다. touch-action이나 hidden을 바꾸지 않는다. 느린 분할 이동 실패는 기존 제스처 계약의 한계로 남으며 이번 변경으로 해결했다고 주장하지 않는다. 다른 앱은 기존 분할 이동 입력을 유지한다.

zz6 C/D/F의 preset-name은 가까운 위치까지만 스크롤했을 때 고정 start-bar에 가렸다. 실제 중앙 스크롤 후 세 크기 모두 필드와 터치 지점이 드러났다. 검증은 실제 수동 중앙 스크롤을 수행하고 가림 hit-test를 유지한다. 이는 자동 키보드 panning 검사가 아니다.

진단 명령: 절대 Node 경로로 `gesture-diagnostic.cjs --base-url http://127.0.0.1:19362 --baseline-url http://127.0.0.1:19365 --out /Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/validation/diagnostic`. 첫 실행은 동적으로 읽은 파일의 shebang 처리 누락으로 exit 1이었다. 도구 처리 수정 후 재실행은 exit 0이며 현재/기준 제스처 4건과 zz6 입력 도달 3건을 기록했다.

최종 집중 재검증: 절대 Node 경로의 `mobile-verify.cjs --base-url http://127.0.0.1:19362 --baseline-url http://127.0.0.1:19365 --apps zz6,zz8 --out "/Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/validation/diagnostic/focused"`: exit 0. 실제 출력은 `settingsCases:16`, `failedSettingsCases:0`, `failures:0`, `pngCount:108`이다. JSON 재계수로 설정 진입 16건, 합성 CSS 복원 16건, 실제 PNG 108개를 확인했다. 각 케이스의 실제 env() 대체 수는 zz6 14개, zz8 35개다. sizing 담당의 동시 수정이 반영된 현재 앱 서버를 확인했으며 이 도구는 앱 소스를 변경하지 않았다. 두 CJS의 `node --check`도 각각 exit 0, 출력 없음이다.

RELEASE E의 최초 전체 실패는 `RELEASE_LANDSCAPE_DIAGNOSIS.md`에 별도로 기록했다. 현재·기준 각각 8회 진입 반복과 RELEASE A-H 재검증은 통과했으며 최초 결과는 보존했다. 요청한 네 앱의 가로 화면 설정·실제 동작 검사도 `release-entry/report.json`에 기록했다.
