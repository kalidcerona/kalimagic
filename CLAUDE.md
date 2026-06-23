# 칼리 마직 랜딩페이지

GitHub: kalidcerona/kalimagic → subfolder kalis_magic_playground/
Push workflow: edit files → `git add` → `git commit` → `git push`

## 배포 구조 (Deployment)
- 배포되는 폴더: `kalis_magic_playground/` (Netlify → kalidcerona/kalimagic GitHub 자동 배포)
- `kali_playground_v2/`는 배포 안 됨 — 작업 대상 아님
- 푸시 제외 파일: `nav.js`, `script.js`, `index-test.html`, `kali_playground_v2/`
- **Netlify base dir = `kalis_magic_playground`** (대시보드 고정값) — netlify.toml에서 publish 경로는 반드시 `base = ""` 명시 후 `publish = "kalis_magic_playground"` 로 쓸 것. 안 그러면 `kalis_magic_playground/kalis_magic_playground` 이중경로 오류
- **배포 흐름**: `kalimagic-v2/` 편집 → rsync 미러 → push → Netlify 자동 배포 (`kalis_magic_playground/`)

## CSS 주의사항 (CSS Gotchas)
- `mmbs.html`은 `.secondary-cta-box` 안에 `.members-cta-title` 사용
  → `.secondary-cta-box h2` 전역 규칙 추가 시 반드시 `:not(.members-cta-title)` 붙일 것
- 테마 토큰: `--point-gold-rgb: 201, 168, 76` (rgba 리터럴 대신 `rgba(var(--point-gold-rgb), .4)` 형태로)
- **index.html 인라인 grid 주의**: `kx-cards3`·`kx-grid2`·`kx-cards2` 등 `.kx-*` 클래스 요소에 `style="display:grid; grid-template-columns:..."` 인라인 값이 붙어있으면 CSS 미디어쿼리가 먹히지 않음. 반응형 작업 시 인라인 grid 속성 제거 후 style.css 클래스로 이전 필요
- **index.html `<head>` 인라인 `<style>` 블록**: 880px에서 `.kx-*` 클래스들을 `!important`로 덮는 규칙 있음. 브레이크포인트 변경 시 이 블록도 확인

## kalimagic-v2 (멀티페이지 7개, 2026-06-22)
- 작업 폴더: `kalimagic-v2/` 전용. `kalis_magic_playground/`·`kali_playground_v2/` 절대 미수정
- 테스트: `PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/python3 kalimagic-v2/tests/test_site.py` (280검사, exit 0=GREEN). 7페이지: index(옵션조합 단일랜딩)·works·video·intro(스모어폼)·reviews(행사갤러리)·lesson·mmbs(nav미노출·noindex·JS동적썸네일)
- **자체 git 레포** (AiGo와 별개) — 커밋은 이 디렉터리에서. `kalis_magic_playground`·`kali_playground_v2`의 오래된 modified 잔재는 이번 작업과 무관, 미수정
- **`.gitignore` 루트 한정(`/`) 필수** — 경로무관 패턴(`style.css`·`*.html`·`imigi3/`·`nav.js`)은 kalimagic-v2/* 핵심파일까지 무시. 새 파일이 git에 안 잡히면 이거 확인
- 무거운 썸네일 최적화: `sips -Z <폭> -s format jpeg -s formatOptions <품질> in --out out.jpg` (표시 크기 2배 해상도면 데스크탑 화질 손실 없음, 원본은 백업 후 .gitignore)
- Progressive enhancement: nav.js 최상단 `document.documentElement.classList.add('js-anim')` → CSS는 `.js-anim .fade-in { opacity:0 }` (JS off 시 콘텐츠 기본 표시)
- Deep modules (기본 수정 금지): `nav.js`·`scripts/optimize_images.py`·`tests/test_site.py` — 단 페이지 추가 같은 기능 확장 시엔 칼리형 승인 하 외과적 수정 가능
- 셸 중복 deepening 트리거: 페이지 5개 이상 또는 OG/메타 자주 변경 → `scripts/build.py` + `_shell.html` 빌드 스텝
- QSE 룰: "지금은" 제거(시한 암시), 전수 단정("다 만족") 금지 — offer-principles 핵심

## Self-intro mechanism
- UserPromptSubmit hook (~/.claude/settings.json) shows .claude-intro on first RC message
- "자기 소개해봐" → runs `cat .claude-intro` via Bash
- SessionStart systemMessage is NOT visible in Remote Control (terminal only)
