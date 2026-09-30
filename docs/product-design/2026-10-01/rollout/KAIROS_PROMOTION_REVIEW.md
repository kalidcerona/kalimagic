# KAIROS 공유 UI 승격 독립 검토

검토자: gpt-6.1-sol / medium. 소유 파일은 이 보고서뿐이다. 앱·스냅샷·빌드는 읽기만 했고 기존 독립 보고서를 수정하지 않았다.

최종 판정: **두 KAIROS 공유 경로 UI 승격 READY, 추가 수정 사항 없음.** 사용자의 새 승인이 KAIROS 두 공유 경로의 UI 고정을 개인 UI와 동일하게 바꾸는 예외를 허용했다. 이전 138파일 동결 검증은 당시 결과로 보존한다. 다른 공유 앱의 승격은 없다. 실제 공유 경로 A–H 브라우저16사례도 통과했다.

## 승격 범위

`distribution-snapshots/kairos`의 전체 12파일은 현재 개인 `zz1`과 목록 및 바이트가 정확히 같다. 이전 스냅샷 대비 수정은 index.html, settings-ui.css, sw.js 세 파일이다. 설정 B UI와 PC 진입 제거가 반영됐고 서비스 워커는 `v20260930-3`에서 `v20261001-1`로 바뀌었다. core/logic·마술 타이밍·매니페스트 변경은 없다.

최종 `dist/tools` 138파일과 `shared-before.json`을 독립 SHA-256 대조했다. 변경은 두 KAIROS 경로 각각 index.html/settings-ui.css/sw.js, 정확히 6개다. 나머지 132개는 바이트가 같으며 여기에는 KAIROS의 나머지 16개와 KAIROS 외 공유 116개가 포함된다. 파일 추가/삭제는 없다. `shared-kairos-after.json`의 목록과 일치한다.

## 공유 계약 보존

각 경로는 snapshot 12개 중 기존 fullscreen.js 제외 규칙을 적용한 11개 파일을 가진다. 각 파일의 최종 바이트를 기존 빌드 변환과 직접 대조했다.

- `/tools/kairos/`의 게이트 tool id는 `stopwatch-uni`, `/tools/kairos-classic/`은 `stopwatch`다. friend-apps-check 삽입 코드와 redirect 대상 계약은 바꾸지 않았다.
- 두 HTML은 `data-magic-customize="off"`를 유지한다. 개인과 동일한 UI 셸을 사용해도 공유 커스텀 허용 정책은 이전대로다.
- `stopwatch_`, `stopwatch2_` 저장 키 및 설정 진입 안내 키는 route별 `friend-kairos`와 `friend-kairos-classic` 이름으로 격리된다. index.html과 logic.js는 해당 변환을 적용한 snapshot과 정확히 같다.
- manifest id는 각각 `/tools/kairos/`, `/tools/kairos-classic/`, start_url/scope는 `./`다. 나머지 manifest 값은 snapshot과 같다.
- 나머지 파일은 snapshot과 바이트가 같다. sw.js의 기존 인증/API/사용자 데이터 네트워크 유지 규칙과 scope 기반 캐시 접두사는 유지된다.

## 실제 검증

| 명령 / 근거 | 종료 코드 | 실제 결과 |
| --- | --- | --- |
| `python3` 전체 파일 목록·바이트·SHA-256·공유 변환 단언 | 0 | snapshot/personal 12 exact; 각 공유 inventory 11 및 변환 바이트 exact; shared138 중 변경6/동일132 |
| `git diff -- kalis_magic_playground/distribution-snapshots/kairos/index.html kalis_magic_playground/distribution-snapshots/kairos/sw.js` 읽기 | 0 | 설정 B·PC 진입 삭제·캐시 버전 변경 확인 |
| 코디네이터의 `NODE_OPTIONS=--no-experimental-global-navigator npm run verify` / `npm-verify-kairos-shared.log` | 0 | JS336 pass/fail0, pytest4 pass, 사이트478 실패0, dist601파일 GREEN |
| `python3` `validation/shared-kairos/report.json` 및 `shared-kairos-classic/report.json` 결과 단언 | 0 | 실제 공유 경로 각각 A–H 8/8, 실패0, runtimeErrors0. 합계16사례 |

전체 verify와 브라우저 검증은 코디네이터/검증 작업자가 실행했고 독립 검토자는 실제 로그·JSON을 읽었다. 같은 전체 테스트를 중복 실행하지 않았다. 브라우저는 Chromium 터치 에뮬레이션이다. 키보드 높이 축소와 safe-area는 합성 검사이며 실기 IME 확인이 아니다. 추가 실제 타이머·랩·중단·가로 모드 조작 검증은 별도 검증 작업자가 수행한다.

STATUS: DONE

Files changed:
- `docs/product-design/2026-10-01/rollout/KAIROS_PROMOTION_REVIEW.md`

Verification: 소스·빌드 변환 독립 검사 exit0, 전체 verify 저장 로그 exit0.

Open issues: 이 승격 검토의 잔여 결함 없음. 추가 실제 타이머 조작 결과와 배포·라이브 검증은 코디네이터의 별도 보고 범위다.
