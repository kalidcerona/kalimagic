# 칼리 마술 성장기 친구 베타 배포 인수인계

2026-10-11, `magicshow-beta` 작업 범위: `kalis_magic_playground/`.

## 목표와 완료 조건

`/tools/magicshow/`에 게임을 배포하고, 기존 친구 앱과 같은 로그인 및 앱별 관리자 승인으로 보호한다. 관리자 카드 이름은 `칼리 마술 성장기 (베타)`, 설명은 `마술 공연 방치형 게임 베타`다. manifest와 두 설치 아이콘만 공개한다. 쿠키는 `kali_magicshow_gate`다.

구현 담당자가 배포 코드와 스냅샷을 작성했다. 원본 게임은 다른 작업자가 편집 중이며 이 작업에서는 읽기만 했다. 커밋, 배포, DB 마이그레이션 적용은 수행하지 않았다. 이 작업에 하위 에이전트는 사용하지 않았다.

## 스냅샷 재생성

프로젝트 폴더에서 `node scripts/sync-magicshow-snapshot.mjs`를 실행한다. 원본은 `/Users/sumpie/Desktop/AI/AiGo/magic-show-game/v3/`다. 스크립트는 게임의 HTML/CSS/JS 6개와 `assets/`의 PNG만 읽으며, 스냅샷 내부의 이전 파일을 지운 다음 배포용 추가 파일을 생성한다. 원본의 변경은 이 명령을 다시 실행해야 반영된다.

스냅샷: **235개 파일, 13,328,575바이트**. PNG 게임 자산 225개와 루트 파일 10개다. 설치 아이콘은 원본 `assets/magician-head.png`를 Pillow의 NEAREST 방식으로 192/512 정사각형의 75% 이내로 맞추고 `#151020` 배경 중앙에 합성했다. 아이콘 PNG는 한 번 생성하여 이 폴더에 보관했고 동기화 시 그대로 복사한다.

`sw-template.js`는 Pi Max의 버전별 일관된 캐시 및 네트워크 우선 manifest 처리를 따른다. 파일 목록은 동기화 스크립트가 만들며 배포 파일 목록과 정확히 같다. 캐시 버전은 배포 파일 내용과 템플릿의 SHA-256에서 계산한다. prefix는 `magicshow-dist-`다. 로그인 확인은 캐시하지 않는다. HTML에는 공통 `accessGuard()`를 삽입한다. 빌드는 이미 삽입된 확인 스크립트를 중복 추가하지 않는다.

게임의 manifest는 `/tools/magicshow/`를 id/start_url/scope로 사용하며 `fullscreen`, `landscape`를 유지한다. 기존 앱의 standalone 정책 검사에는 이 경로만 예외로 등록했다.

## 검증 결과

- `node scripts/sync-magicshow-snapshot.mjs`: 종료 0, `magicshow snapshot: 235 files, 13328575 bytes`.
- `node --test tests/community/magicshow-dist.test.mjs tests/community/friend-apps-gate.test.mjs tests/community/admin-app-model.test.mjs tests/community/tool-login-ui.test.mjs`: 종료 0, tests 43 / pass 42 / fail 0 / skipped 1. 배포 산출물 검사는 환경변수로 별도 실행한다.
- `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)|^✖ " | sort -u`: npm 종료 1, tests 1866 / pass 1852 / fail 11. 실패 이름 집합은 사용자 제공 기준 11개와 정확히 같았다. JS 테스트 실패로 npm의 후속 Python 테스트는 실행되지 않았다. 전체 테스트 환경은 Node v24.18.0이다.
- 서비스 워커 추가 검증: `node --test tests/community/magicshow-dist.test.mjs tests/community/pwa-manifest-freshness.test.mjs tests/community/sw-coherent-release.test.mjs`: 종료 0, tests 125 / pass 124 / fail 0 / skipped 1.
- `npm run build`: 종료 1, `mirror drift: ../../magic-calculator-v2/index.html ↔ zz3/index.html`. 빌드 스크립트에는 verifyMirrors 생략이나 출력 경로 지정 옵션이 없다. 산출물 복사 후 기존 미러 검증에서 멈춘다.
- `MAGICSHOW_VERIFY_DIST=1 node --test tests/community/magicshow-dist.test.mjs`: 종료 0, tests 6 / pass 6 / fail 0 / skipped 0. 빌드 산출물의 235개 파일이 스냅샷과 바이트 단위로 같으며, HTML 참조 파일과 게임 표시 정책도 검증했다.
- `node scripts/check-dist-safety.mjs`: 종료 0, `dist 안전 검사 통과함: dist / files=1063`.
- `git diff --check`: 종료 0, 출력 없음.

초기 검증에서는 npm 테스트의 빌드와 별도 빌드를 겹쳐 실행해 dist 삭제 충돌이 있었다. 이후 순차 실행으로 검증했다. 워커 행렬에 추가한 두 테스트의 초기 실패는 캐시 버전 표시와 이전 캐시 삭제를 수정하여 해소했다.

## 검색에서 유지한 항목과 남은 일

요청한 pimax grep과 choice 검색을 전체 작업 트리에서 수행했다. 친구 권한 등록, 로그인, 관리자 모델, 빌드 목록과 관련 테스트를 갱신했다. 이전 SQL 마이그레이션은 이력으로 보존하고 해당 이력 테스트의 비교 목록만 조정했다. 개인 앱 `zz*`, 기존 pimax/choice 게임 코드와 전용 테스트, 공통 설정 UI의 게임 이름 및 일반적인 choice 변수는 친구 권한 등록이 아니므로 변경하지 않았다. `dist/`는 빌드로 재생성되는 미추적 산출물이다.

루트/프로젝트의 Codex-native AGENTS 파일은 없었다. 제공된 작업 지침과 `MAGIC-PLAYGROUND-RUNBOOK.md`를 사용했다. CLAUDE.md는 읽지 않았다. `zz2`, `zz3`, `tools/calc`, `tools/stopwatch`, verifyMirrors는 직접 수정하지 않았다.

구현은 완료되었다. 기존 11개 테스트 실패와 계산기 미러 드리프트는 범위 밖으로 남겼다. 리더가 파일을 검토하여 커밋하고 정상 배포 절차에서 새 SQL 마이그레이션을 적용해야 한다.
