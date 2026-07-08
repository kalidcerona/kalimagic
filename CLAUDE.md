# 칼리 마직 랜딩페이지

GitHub: kalidcerona/kalimagic → subfolder kalis_magic_playground/
Push workflow: `kalis_magic_playground/` 직접 수정 → `git add` → `git commit` → `git push`
**레포 루트 = `kalis magic/`(상위 폴더), `kalis_magic_playground/`는 서브디렉터리** — `git rev-parse --show-toplevel`로 확인. 커밋 시 파일 경로를 명시할 것(`git add -A` 금지) — 안 그러면 무관한 상위 파일(루트 CLAUDE.md, docs/ 등 병행 세션 변경분)이 같이 스테이징됨.

## 배포 구조 (Deployment)
- `kalis_magic_playground/` = 유일한 SSOT, 직접 편집 (2026-07-06 전환)
- `kali_playground_v2/`, `kalimagic-v2/`는 2026-07-08 폐기(휴지통) — 더 이상 존재하지 않음
- 배포되는 폴더: `kalis_magic_playground/` (Netlify → kalidcerona/kalimagic GitHub 자동 배포)
- **Netlify base dir = `kalis_magic_playground`** (대시보드 고정값) — netlify.toml에서 publish 경로는 반드시 `base = ""` 명시 후 `publish = "kalis_magic_playground"` 로 쓸 것. 안 그러면 `kalis_magic_playground/kalis_magic_playground` 이중경로 오류
- **Netlify 빌드 시간 리셋**: Free plan Effective from May 25 → 매월 25일 UTC 00:00 (한국시간 오전 9시) 리셋
- **검증 워크플로우**: `kalis_magic_playground/`에서 `npm run verify` GREEN 확인 후 push

## CSS 주의사항 (CSS Gotchas)
- **전역 `img { display: block; }`(style.css) 리셋이 `element.hidden = true`를 무력화함** — author 일반 규칙이 UA `[hidden]` 규칙을 항상 이김(specificity 무관). 이미지 404 fallback은 `img.style.display = 'none'`을 인라인으로 병행 설정할 것.
- `mmbs.html`은 `.secondary-cta-box` 안에 `.members-cta-title` 사용
  → `.secondary-cta-box h2` 전역 규칙 추가 시 반드시 `:not(.members-cta-title)` 붙일 것
- **카테고리 탭은 DOM이 두 벌**: `playground.html`의 정적 `button[data-category="all|question|event_review|review|free|magazine"]`(초기 HTML, JS 로드 전 잠깐 보임)와 `playground-list.js`가 실제로 렌더하는 `.pg-tab[data-tab-id="all|question|review_meeting|review_tool|free|magazine"]`(값 매핑 다름: event_review↔review_meeting, review↔review_tool)가 별개. 탭 관련 CSS/기능은 반드시 두 셀렉터 모두 타겟팅하고 browse 실렌더로 확인할 것 — 정적 셀렉터만 쓰면 실사용 화면에서 조용히 무효됨
- 테마 토큰: `--point-gold-rgb: 201, 168, 76` (rgba 리터럴 대신 `rgba(var(--point-gold-rgb), .4)` 형태로)
- **index.html 인라인 grid 주의**: `kx-cards3`·`kx-grid2`·`kx-cards2` 등 `.kx-*` 클래스 요소에 `style="display:grid; grid-template-columns:..."` 인라인 값이 붙어있으면 CSS 미디어쿼리가 먹히지 않음. 반응형 작업 시 인라인 grid 속성 제거 후 style.css 클래스로 이전 필요
- **index.html `<head>` 인라인 `<style>` 블록**: 880px에서 `.kx-*` 클래스들을 `!important`로 덮는 규칙 있음. 브레이크포인트 변경 시 이 블록도 확인

## kalimeeting PNG 생성 (네이버 카페용)
- **3열 레이아웃**: 960px 뷰포트로 렌더링 → 양쪽 68px 크롭 → 824px 산출물
- **모바일 1열**: 640px 이하 뷰포트 → 양쪽 14px 크롭 → 612px 산출물
- 860px는 태블릿 브레이크포인트(641-900px)에 걸려 `.g3` 카드 2+1로 깨짐 — 사용 금지
- **신규 이미지 푸시 누락 주의**: 이미지 추가 시 `git add img/파일명` 반드시 포함 (untracked 상태면 Netlify에 미배포)
- 네이버 카페 HTML 소스 입력 여부: 직접 테스트 없이 단정 금지 (소스 모드에서도 `<a>` 태그 차단될 수 있음)

## 마술 놀이터 커뮤니티 (kalis_magic_playground/, 2026-07-07)
- **새 게시판(카테고리) 추가 = enum 값만 추가, 새 DB 테이블 불필요**: `validators.mjs`(POST_TYPES/WRITABLE_POST_TYPES/LIST_CATEGORIES/categoryForPostType) + `playground-list.js`(PLAYGROUND_TABS) + `playground-compose.js`(POST_TYPE_BY_CATEGORY·select 옵션)에 값만 추가하면 `magazine`/`free`와 같은 제네릭 posts 플로우 재사용됨 (2026-07-09 "마술 보관소"/routine 신설로 확인).
- **신규 Supabase 테이블은 RLS 필수**: 기존 테이블 전부 RLS enabled + 정책 0개(anon/authenticated 차단, service_role만 우회) 패턴. 마이그레이션에 `alter table ... enable row level security` 빠뜨리면 대시보드가 "Potential issue detected" 경고를 띄움 — 정책 없이 RLS만 켜는 게 이 프로젝트의 기본값.
- 스택: 정적 HTML/JS + Netlify Functions(`netlify/functions/`) + Supabase(`supabase/migrations/`)
- **카카오톡·인스타 등 인앱 브라우저에서 Google 로그인이 "차단됨"으로 뜨는 건 우리 버그 아님**: 구글이 임베디드 웹뷰(`disallowed_useragent`)를 정책상 자체 차단하는 것 — `auth.js`의 `provider: 'google'` 코드로는 해결 불가. 대응은 "외부 브라우저로 열기" 유도 UI뿐, 원인 조사에 시간 쓰지 말 것.
- **루트 `.gitignore`의 광범위 exclude가 배포를 깬 전례 2건**: `kalis_magic_playground/scripts/`(빌드 스크립트 자체가 빠져 `MODULE_NOT_FOUND`) / `/docs/`(설계 스펙까지 막힘, `/docs/*` + `!/docs/superpowers/`로 좁혀서 해결). 새 `.gitignore` 패턴을 넓게 걸 때 배포·문서에 필요한 하위 폴더가 걸리는지 먼저 확인
- **`.gitignore` 루트 한정(`/`) 필수** — 경로 무관 패턴(`style.css`·`*.html`·`imigi3/`·`nav.js`)은 하위 SSOT 파일까지 무시할 수 있음. 새 파일이 git에 안 잡히면 이거 확인
- 무거운 썸네일 최적화: `sips -Z <폭> -s format jpeg -s formatOptions <품질> in --out out.jpg` (표시 크기 2배 해상도면 데스크탑 화질 손실 없음, 원본은 백업 후 `.gitignore`)
- Deep modules (기본 수정 금지): `nav.js`·`scripts/optimize_images.py`·`tests/test_site.py` — 기능 확장 때만 외과적으로 수정
- **Netlify secrets 스캐너 오탐**: publishable key/URL처럼 원래 공개되는 값을 HTML에 하드코딩하면 빌드가 막힘 → `netlify.toml`의 `[build.environment]`에 `SECRETS_SCAN_OMIT_KEYS = "SUPABASE_PUBLISHABLE_KEY,SUPABASE_URL"` (secret key는 스캔 유지)
- **`build-public.mjs`의 `PUBLIC_FILES` 목록에서 빠진 JS 하나가 사이트 전체를 깨뜨림**: `reveal.js` 누락 시 스크롤 리빌 대상 콘텐츠가 숨김 상태로 방치되어 여러 페이지가 빈 화면으로 보임 — 신규 JS/CSS 추가 시 반드시 `PUBLIC_FILES`/`PUBLIC_DIRS` 등록, `tests/community/build-public.test.mjs`가 dist 참조 무결성을 검사
- **검증 명령**: `npm run verify` (test + build + `check-dist-safety.mjs` + `tests/test_site.py`) — 배포 전 항상 GREEN 확인
- **Codex sandbox git-index 가드가 문서 전용 작업까지 오탐**: 프롬프트에 "git commit" 같은 설명 문구만 있어도 `bin/worker.sh`가 hang 방지로 거부 → 순수 문서(스펙·계획) 작업은 `WORKER_ALLOW_GIT=1` 접두로 우회

## Self-intro mechanism
- UserPromptSubmit hook (~/.claude/settings.json) shows .claude-intro on first RC message
- "자기 소개해봐" → runs `cat .claude-intro` via Bash
- SessionStart systemMessage is NOT visible in Remote Control (terminal only)
