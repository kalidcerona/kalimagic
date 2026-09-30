# 독립 검토

검토자: gpt-6.1-sol, medium (코디네이터가 실제 spawn 인수 확인). 앱·빌드·테스트 코드는 읽기만 했으며 이 보고서만 소유한다.

## 최종 판정

**현재 개인 앱 코드는 공개 배포 준비 상태(READY)다.** 모든 그룹·cleanup·회귀 테스트 수정과 최종 빌드 근거를 검토한 결과 수정이 필요한 결함을 발견하지 않았다. 이 검토는 배포 실행이나 라이브 확인의 증거가 아니다. 사용자에게 거절된 TYCHE v1 재질 후보는 적용하지 않았고, 새 카지노 테이블·다트 캐비닛 장면 후보(v2)는 별도 진행 중이다. 배경 작업을 완료로 판정하지 않는다.

- `distribution-snapshots/calculator` 11파일은 HEAD의 `tools/calc` 전체 목록·바이트와 같다. `distribution-snapshots/qr` 13파일은 HEAD의 `zz13` 전체 목록·바이트와 같다.
- `DISTRIBUTION_APPS`의 두 입력만 스냅샷으로 바뀌었으며 `tool=calc`와 `tool=arosaegida`, 게이트 삽입, customize off 및 manifest 변환 코드는 유지된다.
- `MIRROR_PAIRS`의 `tools/calc` 목적지 11쌍은 제거됐고 `zz3` 11쌍은 유지된다. 기존 레거시 트리 배포 제외 필터는 유지된다.
- 최종 빌드 후 `dist/tools`와 `shared-before.json`을 다시 독립 SHA-256 비교했다. baseline 138, current 138, 추가 0, 삭제 0, 변경 0이다. `shared-after.json`의 결과 요약도 동일하다.
- 새 회귀는 두 공유 트리의 전체 파일 목록과 각 바이트를 검사한다. 기존 KAIROS 스냅샷/개인이 반드시 달라야 한다는 단언을 삭제한 것은 입력 고정 검증을 약화시키지 않는다. 스냅샷 비교와 차이가 있는 개인 파일의 유출 검사는 유지된다.

## 실행한 검사

| 실제 명령 | 종료 코드 | 출력 |
| --- | --- | --- |
| `node --check kalis_magic_playground/scripts/build-public.mjs` | 0 | 없음 |
| `node --check kalis_magic_playground/tests/community/build-public.test.mjs` | 0 | 없음 |
| `git diff --check -- kalis_magic_playground/scripts/build-public.mjs kalis_magic_playground/tests/community/build-public.test.mjs` | 0 | 없음 |
| `node --input-type=module`에서 `MIRROR_PAIRS` 및 `DISTRIBUTION_APPS` 읽기 | 0 | calcMirrors 0, zz3Mirrors 11, calculator→hitsuzen/calc, qr→arosaegida/arosaegida |
| `python3`에서 `git ls-tree`·`git show HEAD`와 두 스냅샷 목록/바이트 비교 | 0 (해당 비교) | calculator 11 / qr 13, inventory exact True, byte mismatches [] |
| 같은 `python3` 실행의 `git ls-tree a23fc` 산출물 조회 | 1 | a23fc dist/tools 추적 파일 0; actual 138; AssertionError |
| `python3`에서 `shared-before.json`과 현재 `dist/tools` SHA-256 비교 | 0 | baseline 138 current 138 added [] removed [] changed [] |

`a23fc`의 dist가 추적되지 않아 직접 git tree 비교는 실패했다. 코디네이터가 지정한 `shared-before.json`으로 기준을 수정하고 비교를 완료했다. 최종 공유 비교에서 `shared-after.json`을 해시 맵으로 잘못 취급한 첫 시도는 종료 코드 1이었다. 실제 스키마가 결과 요약임을 확인한 다음 baseline과 실제 dist 해시를 비교하고 요약을 별도로 단언해 종료 코드 0으로 완료했다.

## 근거

- `kalis_magic_playground/scripts/build-public.mjs`
- `kalis_magic_playground/tests/community/build-public.test.mjs`
- `kalis_magic_playground/distribution-snapshots/calculator/`
- `kalis_magic_playground/distribution-snapshots/qr/`
- `docs/product-design/2026-10-01/rollout/shared-before.json`
- `docs/product-design/2026-10-01/rollout/baseline-manifest.json`
- `PRODUCT_DESIGN_SYSTEM.md`, `docs/product-design/2026-10-01/rollout/apps/*/design.md`

## 전체 앱 소스 검토 (최종 cleanup 전)

그룹 1·2·3 종료 후 각 활성 런타임 diff와 baseline을 읽었다. 별도의 중대한 동작 회귀를 발견하지 않았다. 전체 13개 `index.html`의 폼 조작 요소를 `html.parser`로 대조한 결과 input·select·textarea의 추가/삭제는 0이고, 버튼 삭제는 zz1·zz2·zz3의 desktop-settings-entry, zz11의 desktop-settings, zz13의 setup 총 5개뿐이다. 나머지 버튼은 유지됐고 외부 script src와 순서는 전부 같다. 이 비교는 종료 코드 0이었다.

`baseline-manifest.json` 및 baseline 사본과 대조한 core·logic·data·manifest·vision·camera-geometry·performance·calibration·photo-logic·sensor-motion·time-machine 파일은 그룹 종료 시점에 바이트가 같았다(종료 코드 0). 이후 승인된 cleanup에서 zz4 logic.js의 미사용 PC 전용 `isRehearsalShortcut` 9줄만 삭제했다. 다른 계산·스와이프 함수 변경은 없다. zz5–zz11의 공연 `style.css`도 각각 바이트가 같다. zz7은 실제 `detector.js`, zz8은 실제 `contacts.js`에서 PC 키보드 진입 함수/리스너만 삭제됐고 미사용 app.js는 연결하지 않았다. zz9의 현재 photo.js 변경은 Shift+Escape 바인딩 삭제뿐이다. zz12의 설정 가져오기/내보내기 handlers는 그대로이며 설정 표시는 다른 학습 탭을 렌더할 때 제거된다.

zz13의 `installManual()` 데스크톱 전용 안내는 cleanup에서 모바일·중립 fallback으로 수정됐다. zz4의 미사용 `isRehearsalShortcut`도 삭제됐다. zz12의 문서 전역 학습 단축키와 단축키 설명이 제거됐으며 폼 submit 및 입력 Enter는 남아 있다. zz9의 원래 없는 settings-ui.js precache/runtime 목록을 제거해 설치 실패 원인을 정리했고 scope/API/민감 URL 우회는 보존했다. zz3·zz13 조작 크기 보정은 설정 CSS에만 한정했다. 해당 exact diff에서 새 결함을 발견하지 않았다. zz13 landscape 제목의 `padding-right:96px` 제거는 PC 설정 버튼 자리 제거이며 QR canvas·stage 크기 규칙은 같다. 브라우저의 실제 기하 확인이 최종 판정에 필요하다.

변경 runtime/cache JS·MJS 23개를 `node --check`로 각각 독립 실행했고 모두 종료 코드 0, 출력 없음이었다. 최종 cleanup 이후 추가 변경은 코디네이터 최종 verify 결과와 대조한다.

## TYCHE 후보 검토

SVG 세 개를 XML 파싱하고 요소/속성을 검사한 실제 결과(종료 코드 0): felt 13155바이트, aged-matte-wood 7251바이트, pressed-leather 3221바이트, 모두 viewBox `0 0 390 844`, script·foreignObject·image·이벤트 속성·외부 참조 0. 앱에 후보를 적용한 변경은 없다. `preview/style.css`와 baseline/current zz11 style.css는 바이트가 같고, wheel-face와 spinner-arrow SVG는 baseline·현재 앱·stage preview 세 곳이 바이트가 같다(종료 코드 0). 휠 SHA-256 `8101b9188b9b980b0408f96833bac7f75b1d367559aaaa54b479a7f4fe055fea`, 화살 SHA-256 `2a8fc342db98c024acb58154e21cf1d7ab0b6509eef2cecef99ac3fcbde13937`.

후보는 Grok이 코드로 작성한 벡터이며 실사 이미지 생성 결과가 아니다. 사용자가 이 v1 후보를 거절했다. 위 안전·기하 검사는 폐기된 후보의 근거로 보존하고, v2 카지노 테이블·다트 캐비닛 장면은 아직 검토 대상 결과가 없다. 앱 배경은 변경하지 않았다.

## 최종 검증 근거

아래 실행은 코디네이터/검증 작업자가 수행했고 독립 검토자는 저장된 로그·결과와 실제 파일을 읽어 확인했다. 같은 전체 테스트를 중복 실행하지 않았다.

| 실제 실행 / 원본 근거 | 종료 코드 | 실제 결과 |
| --- | --- | --- |
| `NODE_OPTIONS=--no-experimental-global-navigator npm run verify` / `npm-verify-final.log` | 0 | JS 336 pass, fail 0; pytest 4 pass; 사이트 검사 478 실패 0; dist 601파일; GREEN |
| 원본 9개 프로젝트 각각 `npm test` / `source-test-results.json`, 각 `magic-*-test.log` | 모두 0 | 총 280테스트. choice 36, aletheia 20, tobira 73, usotsuki 17, asrai 16, alter 47, spinner 9, memdeck 19, qr 43 |
| Chromium 터치 에뮬레이션 / `validation/comparison/report.json` | 결과 실패 0 | 13앱 × A–H 104/104. runtimeErrors 0. RELEASE 최신 8클래스 재실행을 합쳐 비교 갤러리에 기록 |
| 최초 전체 실행 / `validation/final/report.json` | 실패 사례 1 보존 | zz2 E의 native swipe 실패 1. 이 기록은 삭제하지 않음 |
| RELEASE 재검증 / `validation/release-entry/report.json`, `validation/release-final/report.json` | 실패 0 | current E 8회 + baseline E 8회 총16회, RELEASE A–H 8회 통과. landscape 4앱 ×2클래스 설정8/공연8 통과 |
| 최종 `python3` SHA-256·결과 요약 단언 | 0 | 공유138 해시 exact; 원본9 exit 모두0, 테스트 합계280 |

실제 등록된 터치 입력 경로, TYCHE 회전, QR 생성 후 내장 jsQR 픽셀 판독, USOTSUKI 짧은 홀드 취소, 멤덱 다음 카드 버튼은 저장된 브라우저 결과로 확인됐다. 높이 축소 키보드와 safe-area는 합성 검사이며 OS IME/물리 기기 확인이 아니다. 공연 픽셀 비교는 소스 보존 검토의 보조 근거다. zz9-D 및 zz12-B PNG를 직접 열어 좁은 폼·상징 겹침과 학습 헤더/설정 분리를 시각 확인했다.

`REGRESSION_UPDATE_REPORT.md`, `QR_CACHE_TEST_REPORT.md`, Grok JSONL의 실제 old/new 변경과 원본 테스트를 읽었다. PC 전용 테스트/문구 기대만 제거·교체했고 모바일 터치·카운터·회전·QR 디코드·저장 실패·설치 동의/완료·스코프·다른 캐시/API 보호 단언은 유지된다. QR 테스트 설정 진입은 실제 등록된 pointer 이벤트를 사용한다. zz13 `시작 메뉴, 런치패드` 문구도 제거됐다. 검토에서 추가 수정 요청은 없다.

STATUS: DONE

Files changed:
- `docs/product-design/2026-10-01/rollout/INDEPENDENT_REVIEW.md`

Verification: 위 실제 명령 및 종료 코드 참조.

Open issues: 개인 앱 코드 검토의 잔여 결함 없음. TYCHE v2 장면 후보는 별도 진행 중이며 아직 미적용·미검토다. 커밋·배포·라이브 확인은 코디네이터의 별도 최종 보고 범위다. 실기 IME·센서·카메라 확인은 이 에뮬레이션 검증의 한계로 남는다.
