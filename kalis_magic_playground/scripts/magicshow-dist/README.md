# 칼리 마술 성장기 친구 베타 배포 인수인계

2026-10-11, `magicshow-beta` 작업 범위: `kalis_magic_playground/`.

## 목표와 완료 조건

`/tools/magicshow/`는 2026-10-11 소유자 결정에 따라 링크만 있으면 플레이하는 공개 베타다. 엣지 게이트의 `MAGICSHOW_PUBLIC_BETA = true`가 정규화된 해당 경로 전체를 공개한다. `false`로 바꾸면 기존 친구별 승인 게이트가 돌아온다. 점 경로는 기존처럼 차단하며, magicshow의 중복 슬래시는 추가로 차단한다. 다른 도구의 정책은 유지한다. 관리자 카드, 친구 도구 목록, 마이그레이션과 `kali_magicshow_gate` 쿠키 도우미는 보존한다.

구현 담당자가 배포 코드와 스냅샷을 작성했다. 원본 게임은 다른 작업자가 편집 중이며 이 작업에서는 읽기만 했다. 커밋, 배포, DB 마이그레이션 적용은 수행하지 않았다. 이 작업에 하위 에이전트는 사용하지 않았다.

## 스냅샷 재생성

프로젝트 폴더에서 `node scripts/sync-magicshow-snapshot.mjs`를 실행한다. 기본 원본은 `/Users/sumpie/Desktop/AI/AiGo/magic-show-game/v3/`다. 위치 인자 또는 `--source PATH`가 `MAGICSHOW_SOURCE` 환경변수보다 우선한다. 이번 동기화 원본은 `/private/tmp/claude-501/-Users-sumpie-Desktop-AI/f78f813c-e74a-406c-aef7-8c7268ddebed/scratchpad/u12frozen`이다. 스크립트는 게임의 HTML/CSS/JS 6개, `assets/`의 PNG, `fonts/`의 woff2와 OFL.md를 읽으며, 스냅샷 내부의 이전 파일을 지운 다음 배포용 추가 파일을 생성한다. 원본의 변경은 이 명령을 다시 실행해야 반영된다.

현재 스냅샷: **368개 파일, 24,723,753바이트**. 설치 UI의 JS/CSS와 폰트도 빌드 허용 목록과 서비스 워커 사전 캐시에 포함한다. 설치 아이콘은 원본 `assets/magician-head.png`를 Pillow의 NEAREST 방식으로 192/512 정사각형의 75% 이내로 맞추고 `#151020` 배경 중앙에 합성했다. 아이콘 PNG는 한 번 생성하여 이 폴더에 보관했고 동기화 시 그대로 복사한다.

`sw-template.js`는 Pi Max의 버전별 일관된 캐시 및 네트워크 우선 manifest 처리를 따른다. 파일 목록은 동기화 스크립트가 만들며 배포 파일 목록과 정확히 같다. 캐시 버전은 배포 파일 내용과 템플릿의 SHA-256에서 계산한다. prefix는 `magicshow-dist-`다. HTML에는 로그인 확인을 삽입하지 않는다. 빌드도 magicshow에 `accessGuard()`를 삽입하지 않아 쿠키와 `/tools/_check` 호출 없이 플레이한다.

게임의 manifest는 `/tools/magicshow/`를 id/start_url/scope로 사용하며 `fullscreen`, `landscape`를 유지한다. 기존 앱의 standalone 정책 검사에는 이 경로만 예외로 등록했다.

## 설치 안내와 현재 검증 (2026-10-11)

첫 방문에 한국어 설치 안내를 표시한다. 표시·닫기 시각을 로컬 저장소에 기록하고 자동 재안내는 최소 3일 뒤에 가능하다. 저장소를 사용할 수 없는 환경에서는 방문 간 간격을 보장할 수 없다. fullscreen/standalone 및 navigator.standalone으로 실행 중이면 표시하지 않는다. 설치 가능 환경에는 왼쪽 위 44px 이상 `앱 설치` 버튼이 있다. 안내를 닫으면 기존 게임 인트로를 그대로 사용할 수 있다.

- Android Chrome·삼성 인터넷: beforeinstallprompt를 보관하고 설치 버튼의 사용자 클릭 안에서만 prompt()를 실행한다. 이벤트는 한 번만 사용하고 실패 시 수동 메뉴 안내를 제공한다.
- iPhone·iPad Safari: 공유(□↑) → 홈 화면에 추가 → 추가의 3단계 시각 안내. iPhone에는 아래쪽, iPad에는 위쪽 공유 방향 화살표를 표시한다.
- 카카오톡·Instagram·Facebook·네이버·Line: 브라우저로 열기와 링크 복사를 제공한다. iOS는 Safari 안내, Android 카카오는 Chrome intent 링크, 나머지는 ⋮ → 다른 브라우저로 열기 안내다.
- Galmuri 폰트, 44px 이상 버튼, 작은 가로 화면의 스크롤, Escape 닫기, Tab 순환 및 닫은 뒤 포커스 복귀를 제공한다.

실행 환경: 설치된 Node v24.18.0을 PATH에 지정했다. 하위 에이전트, 커밋, 배포, git 쓰기 명령은 사용하지 않았다.

1. `MAGICSHOW_SOURCE=/private/tmp/claude-501/-Users-sumpie-Desktop-AI/f78f813c-e74a-406c-aef7-8c7268ddebed/scratchpad/u12frozen node scripts/sync-magicshow-snapshot.mjs`: 종료 0.
   `magicshow snapshot: 368 files, 24723753 bytes`
2. `node --test tests/community/magicshow-dist.test.mjs tests/community/friend-apps-gate.test.mjs tests/community/admin-app-model.test.mjs tests/community/tool-login-ui.test.mjs`: 종료 0. tests 48 / pass 47 / fail 0 / skipped 1.
3. `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)|^✖ " | sort -u`: pipefail 기준 종료 1. tests 1871 / pass 1857 / fail 11. JS 단계 실패로 Python 단계는 실행되지 않았다.

전체 실패 이름 11개:

```text
ALETHEIA and USOTSUKI distribution builds use pinned snapshots and separate PWA identities
Asrai, ALTER, and spinner personal builds keep exact runtime mirrors and distinct install identities
HITSUZEN and AROSAEGIDA keep every pinned snapshot byte except gate, customize, and manifest identity
all final apps resolve to distinct install identities
persist writes the store once without parsing it back, and a second performance entry does not parse icons
personal KAIROS edits do not change either shared route
public build does not copy dotfiles from public directories
public build includes every local src and href referenced by dist html
public build serves integrated stopwatch on both retained entitlement routes
shared unlock stays on the pinned snapshot until explicit promotion
the first Android visit offers installation and uses Chrome’s native prompt after a tap
```

추가 확인: `MAGICSHOW_VERIFY_DIST=1 node --test tests/community/magicshow-dist.test.mjs`: 종료 0, tests 11 / pass 11 / fail 0. 스냅샷과 빌드의 파일 목록·내용이 일치하며 로컬 HTML 참조가 모두 존재한다. `npm run build`: 종료 1, 기존 `mirror drift: ../../magic-calculator-v2/index.html ↔ zz3/index.html`에서 멈춘다. 기본 Node v20.12.2에서 수정 전 전체 테스트는 tests 1866 / pass 1854 / fail 9였으므로 Node 24의 두 추가 실패를 같은 런타임의 사전 측정으로 비교하지는 않았다.

`node scripts/check-dist-safety.mjs`: 종료 0, `dist 안전 검사 통과함: dist / files=1196`. `git diff --check`: 종료 0, 출력 없음. Python hashlib 비교: 원본에서 복사한 361개 파일의 SHA-256 일치, 스냅샷 368개 파일 / 24,723,753바이트 확인.

실제 브라우저 확인은 자동 승인 검토가 로컬 URL `http://127.0.0.1:8765/` 접근을 사용자 권한 거부 사유로 거절했다. 우회하지 않았으며 로컬 서버를 종료했다. 플랫폼별 UI 동작은 VM 테스트로 확인했지만 실기기 설치와 화면 배치는 미검증이다.

## 이전 검증 결과 (공개 전 기록)

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

공개 베타 및 설치 안내 구현은 완료되었다. 기존 11개 테스트 실패와 계산기 미러 드리프트는 범위 밖으로 남겼다. 리더가 파일을 검토하여 커밋하고 정상 배포 절차에서 새 SQL 마이그레이션을 적용해야 한다.
