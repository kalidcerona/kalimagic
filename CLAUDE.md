# 칼리 마직 랜딩페이지

GitHub: kalidcerona/kalimagic → subfolder kalis_magic_playground/
Push workflow: `kalis_magic_playground/` 직접 수정 → `git add` → `git commit` → `git push`
**레포 루트 = `kalis magic/`(상위 폴더), `kalis_magic_playground/`는 서브디렉터리** — `git rev-parse --show-toplevel`로 확인. 커밋 시 파일 경로를 명시할 것(`git add -A` 금지) — 안 그러면 무관한 상위 파일(루트 CLAUDE.md, docs/ 등 병행 세션 변경분)이 같이 스테이징됨.

## 배포 구조 (Deployment)
- `kalis_magic_playground/` = 유일한 SSOT, 직접 편집 (2026-07-06 전환)
- **`zz2`·`zz3`·`tools/calc`는 미러 사본, 진짜 소스는 `../magic-calculator-v2`·`../magic-stopwatch`(별도 git repo, remote 없음 — push 불가, 로컬 커밋만).** 소스 수정 후 반드시 zz 폴더에 재미러. `build-public.mjs`의 `verifyMirrors()`가 소스↔zz 불일치 시 빌드를 막음(소스 없는 CI 환경에선 스킵).
- `kali_playground_v2/`, `kalimagic-v2/`는 2026-07-08 폐기(휴지통) — 더 이상 존재하지 않음
- 배포되는 폴더: `kalis_magic_playground/` (Netlify → kalidcerona/kalimagic GitHub 자동 배포)
- **netlify.toml이 두 개고, 먹히는 건 `kalis_magic_playground/netlify.toml`(`publish = "dist"` + `command = "npm run build"`)이다.** 레포 루트의 `netlify.toml`(`base = ""` + `publish = "kalis_magic_playground"`, 2026-06-22 최종 수정)은 폐기된 v2 미러 시절 잔재라 현재 읽히지 않는다 — 실증: `DESIGN.md`·`MAGIC-PLAYGROUND-PRD.md`가 404(폴더 전체 배포였다면 200). **루트 쪽을 살려 고치면 큐레이션된 `dist/` 대신 폴더 전체가 공개된다** — 배포 설정은 하위 파일만 수정할 것. **루트 `netlify.toml`은 2026-08-12 삭제 완료**(대시보드 Build settings의 Base directory = `kalis_magic_playground` 확인 → 애초에 읽히지 않던 파일). 이제 배포 설정 파일은 하위 하나뿐.
- **허용목록은 양방향으로 위험하다 — 빠지면 깨지고, 들어가면 공개된다.** `PUBLIC_DIRS`에 든 폴더 안에 만든 파일은 링크·sitemap 없이도 다음 배포에서 그대로 공개된다(2026-08-09 실증: `reports/`의 번개 리포트 2종이 이 경로로 계속 공개돼 있었고, 그 폴더 파일 12개가 전부 배포 대상이었음). 내부 산출물·초안·이미지 수출물을 레포 폴더에 만들기 전에 그 폴더가 허용목록에 있는지 먼저 확인.
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
- **Tailwind CDN은 유틸리티를 런타임에 주입해 정적 `<style>` 뒤에 붙는다** — 같은 특이도면 항상 Tailwind가 이긴다. `!important` 대신 `html ` 접두(0,1,1)로 올릴 것. 인라인 `style`은 어떤 선택자로도 못 이기므로, 선언을 쪼개 충돌하는 속성만 빼는 게 정석(`border-color` → `border-top/right/bottom-color`).
- **진입 애니메이션은 "최종값은 마크업에, 0은 JS가" 방향으로 쓴다** — CSS에 `width:0`·`opacity:0`을 두면 JS가 죽는 순간 콘텐츠가 영구히 사라진다. 최종 상태를 인라인 style에 두고 JS가 런타임에 0으로 만든 뒤 채울 것. 스크린샷·검증은 `prefers-reduced-motion: reduce`로 로드하면 스크립트가 early return 해 최종 상태 그대로 남는다.

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
- **`badges.js`는 `window.PgUtil`에 의존한다(2026-08-12 중복 제거)**: `escapeHtml`·`fetchJson`을 자체 구현하지 않고 `pg-util.js`에서 가져오므로, badges.js를 쓰는 페이지는 반드시 `pg-util.js`를 먼저 로드해야 한다(현재 admin·mypage·post·playground·reviews·write 6개 전부 충족).
- **검증 명령**: `npm run verify` (test + build + `check-dist-safety.mjs` + `tests/test_site.py`) — 배포 전 항상 GREEN 확인
- **작업 시작 전에 baseline 테스트를 먼저 돌릴 것**: 기능을 바꾸고 단언을 안 고친 상시 RED가 2건 있었다(후기 Q&A 개편 후 `test_reviews.py`, 모임 기록 게시판 제거 후 `playground-modules.test.mjs`, 둘 다 2026-08-11~12에야 적발). baseline을 모르면 기존 RED를 자기 변경 탓으로 오진한다. 반대로 기능을 제거·개편하는 커밋은 해당 테스트 단언도 같은 커밋에서 갱신할 것.
- **Codex sandbox git-index 가드가 문서 전용 작업까지 오탐**: 프롬프트에 "git commit" 같은 설명 문구만 있어도 `bin/worker.sh`가 hang 방지로 거부 → 순수 문서(스펙·계획) 작업은 `WORKER_ALLOW_GIT=1` 접두로 우회
- **로그인 필요 페이지(mypage.html 등) 실렌더 검증 기법**: `window.MagicAuth.getSession/authHeader`와 `window.fetch`를 mock으로 override한 뒤, `XMLHttpRequest`로 실제 JS 파일(`/mypage.js`) 텍스트를 가져와 `<script>` 태그로 eval하면 그 파일의 `init()`이 mock 데이터로 정상 실행되어 DOM 전체(퀘스트 배지·팝업 등)를 실제 화면으로 검증 가능. 함수를 낱개로 추출해 재조립하는 것보다 안정적.
- **신규 기능 요청 전 기존 구현 여부 확인 필수**: "배지 선택 시스템"(마이페이지 대표배지 선택 `mypage.js badgeTile`, 글쓰기 배지 선택 `playground-compose.js badgePickerHtml`, 게시글/댓글 배지 표시 `imageBadgesHtml`)이 이미 커밋 `710f431`로 라이브에 있었음 — 비슷한 요청 들어오면 재구현 전에 grep으로 기존 여부부터 확인할 것.
- **새 등급(role)+배지 추가 패턴**: "전문가"가 이미 역할(권한)과 동명 배지(장식)로 분리돼 있음 — 새 등급도 이 패턴 재사용. 역할 추가=`_lib/access-policy.mjs`(isExpertOrHigher 등 권한 tier)+`admin-members.mjs`(WRITABLE_ROLES)+`admin.js`(회원관리 부여버튼)+`profiles.role` CHECK 제약(마이그레이션 필수, 제약명 환경별 다를 수 있어 `pg_constraint`에서 동적 조회 후 교체). 배지 추가=`_lib/badges.mjs`(VALID_BADGE_CODES+SELECTABLE_BADGE_CODES)+`badges.js`(BADGE_META+역할칩 BADGES)+`assets/playground/badges/{code}.webp`(512×512) — 이 상수들만 건드리면 팝오버 부여·닉네임 표시·글쓰기 선택 전부 자동 반영됨(중복 로직 없음).
- **expert_only/kali_only 게이트 단일 초크포인트**: `_lib/access-policy.mjs`의 `isExpertOrHigher`/`isElevated` → `canReadPostBody`. posts/comments는 이걸 통과하지만 **event-reviews.mjs는 게이트 자체가 없음(항상 public 고정)** — 새 역할 추가 시 이 파일도 영향받는지 매번 확인할 것.
- **배지 노출 규칙은 세 군데가 서로 다르다**: 게시글 작성자 배지 = `_lib/badges.mjs`의 `HIDDEN_PUBLIC_AUTHOR_BADGE_CODES`(kali만 숨김) / 회원 팝오버·마이페이지의 보유 배지 = `member-badges.mjs`의 `shapeMemberBadges(..., {canSeeOwnerOnly})`(본인 또는 `isElevated`만 kali·hecate·hecate_2 열람, 2026-08-12 추가) / 배지 도감 = 같은 파일의 `OWNER_ONLY_CATALOG_CODES`. 노출 정책을 바꿀 땐 세 곳을 모두 확인할 것.
- **회원 이메일은 `profiles`에 없다 — `auth.users`에만 있음**: `admin-members.mjs`는 `user_id,nickname,role,created_at`만 반환한다. user_id로 이메일이 필요하면 `supabase.auth.admin.getUserById(userId)`를 쓸 것(`invite-redeem.mjs:34`의 기존 패턴). 이메일 기반 테이블(tool_access 등)과 회원 목록을 잇는 모든 기능이 이 다리를 거친다.
- **관리자 회원 행에 기능 추가 시 기존 갱신 패턴을 따를 것**: `admin.js`의 `memberRow(member)`가 행 전체를 만들고, 변경 후 `card.replaceWith(memberRow(member))`로 통째로 다시 그린다(`memberRoleChangeButton` 참고). 부분 DOM 조작 대신 이 방식이 상태 꼬임이 없다. 회원 수만큼 API를 호출하지 말고 목록 로드 시 1회만 조회해 맵으로 매칭할 것.
- **Supabase SQL Editor 결과 혼동 주의(단일/멀티 문장 공통)**: 멀티 SELECT는 어느 문장 결과인지 헷갈리기 쉽고, **단일 문장도 cmd+Return이 씹혀 이전 실행 결과가 그대로 남을 수 있음**(마이그레이션이 실행 안 됐는데 "적용됨"으로 오판할 뻔한 실증 2026-07-28) — Run 버튼을 직접 클릭(destructive 확인 모달 뜨면 "Run query"도 클릭)하고, 적용 여부는 항상 `information_schema`/`pg_indexes` 재조회로 확인. 서브쿼리로 묶어 단일 결과행으로 볼 것.

## reports/ (행사 후기 페이지 — 배포 안 함)
- `reports/`는 **`PUBLIC_DIRS`에서 제외됨(2026-08-09)** — 로컬 열람 전용. 다시 배포하려면 허용목록에 넣어야 하고, 그 순간 폴더 안 모든 파일이 같이 공개된다(`reports/png/` 포함).
- **참가자 인용문은 원본 설문 시트와 바이트 대조로만 검증한다.** 커밋 대조는 "오늘 안 바뀌었다"만 증명한다 — 2026-08-09에 17건 중 6건이 조용히 다듬어져 있었고(맞춤법 교정 + `흘러간 것 같고`→`흘러갔다` 같은 완곡→단정), 시트 대조로만 적발됐다. 같은 인용이 공개용·내부용 두 파일에 각각 하드코딩돼 있으니 한쪽만 고치면 갈라진다(실제로 3건 갈라졌음).
- 설문에 **인용 허락 컬럼**이 있다. 거절자 응답은 어느 파일에도 넣지 않는다.

## planb/ (Plan.B 공연 페이지, 2026-07-21)
- **sips -Z 리사이즈가 오히려 파일을 키울 수 있음**: 이미 최적화된 JPEG는 재인코딩 시 원본보다 커지는 경우가 잦음(이번 세션 3회 실증) — 리사이즈 후 반드시 원본과 용량 비교, 작을 때만 채택하고 크면 원본 유지.
- **`loading="lazy"` + puppeteer 헤드리스 캡처 = 이미지 무작위 로드 실패**: file://·http:// 무관, 매 캡처마다 다른 이미지가 naturalWidth=0으로 실패(서버는 curl로 200 정상 확인, 파일도 정상) — 헤드리스 검증이 필요한 페이지는 `loading="lazy"` 대신 eager 권장. 이미지 10장 이하 단일 페이지면 전부 eager로 위험 원천 차단.

## tools/ 마술 도구 서버 게이트 (Netlify Edge Functions, 2026-07-28)
- **Edge Function 접근 제어는 반드시 allow-list로 짤 것, deny-list는 실사고로 이어짐**: "이런 확장자·슬래시 패턴만 게이트"식 deny-list는 `/tools/calc`(슬래시 없음)·`/tools/CALC/`(대문자)·`/tools/calc/index`(확장자 없는 pretty-URL) 같은 변형에서 실제로 뚫려 보호 대상 페이지 전문이 그대로 내려감(로컬 netlify dev 실측으로 발견). "기본 전부 차단, 공개할 것만 명시 허용" 구조로 짜고, 무슬래시·대문자·상위경로(`..`/`%2e`)·중복슬래시 변형을 전부 테스트할 것.
- **HttpOnly 쿠키가 `Path=/tools`처럼 좁게 스코프돼 있으면, 그 쿠키를 읽어야 하는 새 엔드포인트도 같은 경로 하위에 있어야 함**: `/.netlify/functions/*`는 다른 경로 스코프라 쿠키가 안 실려온다 — `netlify.toml`에 `/tools/_check → /.netlify/functions/tool-check` 같은 rewrite를 추가하고, 그 경로를 엣지 게이트의 공개 허용목록에 넣을 것.
- **로컬에서 Edge Function이 비밀값을 못 읽어 전부 차단되면 버그가 아니라 `netlify dev`가 셸 env를 안 넘겨주는 것**: 루트에 `.env` 파일로 `TOOL_GATE_SECRET` 등을 넣어야 `Netlify.env.get`/`Deno.env.get`이 값을 읽음.
- **Netlify는 `.webmanifest` MIME을 몰라 `application/octet-stream`으로 내려보냄 → 전역 `nosniff`와 겹쳐 브라우저가 manifest를 아예 파싱 안 함 → PWA 설치 프롬프트가 조용히 안 뜸**(앱은 정상 동작해서 눈치채기 어려움). manifest 추가 시 `netlify.toml`에 경로별 `Content-Type = "application/manifest+json"` 헤더를 반드시 같이 넣을 것.
- **"라이트 모드에서 상단에 흰 줄" 제보는 앱 버그가 아닐 가능성이 높음**: 헤드리스 라이트모드로 캡처해 최상단 픽셀을 직접 읽어 확인할 것(우리 페이지가 y=0까지 정상 렌더면 그 줄은 브라우저 자체 UI). 근본 해결은 홈 화면 설치 후 아이콘 실행이며 CSS로는 못 없앤다.
- **PWA 설치 안내는 OS별로 다름**: 아이폰은 **사파리 전용**(공유→홈 화면에 추가, 크롬으로는 불가), 안드로이드는 크롬 ⋮ → 앱 설치. 설치 후 **아이콘으로 실행해야** 전체화면·브라우저 UI 제거가 적용됨.

## Self-intro mechanism
- UserPromptSubmit hook (~/.claude/settings.json) shows .claude-intro on first RC message
- "자기 소개해봐" → runs `cat .claude-intro` via Bash
- SessionStart systemMessage is NOT visible in Remote Control (terminal only)
