# 칼리매직 v2 — 나머지 6페이지 디자인 적용 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 클로드 디자인이 만든 6페이지(index·intro·video·mmbs·works·lesson) 디자인을 kalimagic-v2에 적용 — 이미지는 v2 원본 고화질 경로, 디자인/레이아웃만.

**Architecture:** 디자인 output(로컬 `assets/리소스/PRD 기반 가설 검증 설계/*.html`)은 base64 self-contained. 적용 = ①`<body>` 마크업·인라인 `<style>` 채택 ②head/nav를 v2 표준(`style.css`+`nav.js renderNav`)으로 ③base64 이미지 → v2 원본 경로 치환. test_site.py GREEN 게이트.

**Tech Stack:** 순수 HTML/CSS/JS, test_site.py(파이썬 정적 검사), nav.js renderNav.

## Global Constraints

- 이미지: 디자인 base64 전량 폐기 → v2 원본 경로. 디코드 금지(저화질).
- `kalis_magic_playground`·`kali_playground_v2` 미수정(diff0).
- 후기·카피 verbatim, 각색 금지(QSE). placeholder("곧 열려" span) 비활성 유지.
- 미배포 — "푸시해줘" 전까지 push 안 함.
- 디자인 소스 경로(DESIGN): `/Users/sumpie/Desktop/AI/AiGo/assets/리소스/PRD 기반 가설 검증 설계/`
- v2 루트(V2): `/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic/kalimagic-v2/`
- 테스트: `PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/python3 tests/test_site.py` (exit 0=GREEN)

## base64 → v2 원본 경로 매핑 (정독 확정)

| 페이지 | 디자인 이미지 | v2 원본 경로 |
|---|---|---|
| intro | Hero 배경 1 (본문 img 0) | `assets/profile/summer-crowd.jpg` |
| lesson | Hero 배경 1 (본문 img 0) | `assets/profile/portrait.jpg` |
| video | Hero + 썸네일 "영상 1~8" + free-lesson 썸네일 | Hero=`assets/profile/street-magic.jpg`, 썸네일=`imigi3/1.jpg`~`imigi3/8.jpg`, free-lesson=잠금 placeholder(이미지 선택은 구현 시) |
| works | 제품 카드 16 | v2 works 현재 store-grid 이미지 유지(작은 손질이라 마크업 보존) |
| mmbs | 강의 썸네일 8 | v2 mmbs 현재 JS 동적 썸네일 유지 |
| index | Hero/갤러리 4 | v2 index 현재 경로 유지(보조 CTA만 변경) |

## CTA 가격 사다리 (브리핑 §3, "영상"=works 확정)

- video 두 CTA → intro · intro 보조 → works · works 메인 → lesson(보조 intro 유지) · mmbs → works(유지) · index 히어로 보조 → video · lesson 다운셀 → intro(유지)

---

### Task 1: works — 이모지→✦ + CTA 확인 (작은 손질)

**Files:** Modify `works.html`

- [ ] **Step 1:** DESIGN/works.html에서 카테고리 제목 이모지(📼🃏 등)가 `✦`로 바뀐 부분 확인 → V2 works.html 해당 제목에 `✦` 적용(마크업·이미지·store-grid 보존)
- [ ] **Step 2:** CTA 사다리 확인 — 메인 CTA→lesson, 보조→intro (디자인과 일치하는지)
- [ ] **Step 3:** `tests/test_site.py` GREEN
- [ ] **Step 4:** commit `feat(works): 카테고리 제목 브랜드 정리(✦)`

### Task 2: mmbs — "구매자 전용" eyebrow (작은 손질)

**Files:** Modify `mmbs.html`

- [ ] **Step 1:** DESIGN/mmbs.html 헤더의 "구매자 전용" 골드 eyebrow 마크업 추출 → V2 mmbs.html `.members-header`에 추가(nav 미노출·noindex·JS 동적 썸네일 보존, `.members-cta-title` :not 규칙 주의)
- [ ] **Step 2:** test GREEN (mmbs는 존재·메타만 검사)
- [ ] **Step 3:** commit `feat(mmbs): 구매자 전용 eyebrow 추가`

### Task 3: index — 히어로 보조 CTA → video (작은 손질)

**Files:** Modify `index.html`

- [ ] **Step 1:** V2 index.html Hero 보조 CTA(현재 `lesson.html` "레슨 상담해보기")를 `video.html`(무료 영상, 사다리 맨 아랫칸)로 변경. 메인 CTA(intro)는 유지
- [ ] **Step 2:** test GREEN (Hero에 intro 링크 존재 검사 통과 확인)
- [ ] **Step 3:** commit `feat(index): 히어로 보조 CTA를 무료 영상(사다리)으로`

### Task 4: video — 히어로 + free-lesson 게이트 + 썸네일 8 (큰 재구성)

**Files:** Modify `video.html`, `style.css`(free-gate 클래스 없으면 추가)

- [ ] **Step 1:** DESIGN/video.html `<body>` 마크업 + 인라인 `<style>` 추출(base64 스트립). 섹션: Hero("형이 방금 한 마술, 너도 할 수 있어") → `#free-lesson`(고무줄 무료, 비활성 span+TODO 주석) → 입문 유도 → 추천영상 그리드
- [ ] **Step 2:** base64 치환 — Hero→`assets/profile/street-magic.jpg`, 영상 썸네일 1~8→`imigi3/1.jpg`~`imigi3/8.jpg`. head=v2 표준(style.css+nav.js `renderNav('video')`)
- [ ] **Step 3:** `.free-gate` 등 신규 클래스가 디자인 인라인 style에 있으면 그대로, 없으면 style.css 추가. `.video-*`는 v2 기존 재사용
- [ ] **Step 4:** CTA 두 박스 모두 intro (lesson 직행 제거). placeholder span 비활성 유지
- [ ] **Step 5:** test GREEN — `#free-lesson` 섹션 존재 검사 추가
- [ ] **Step 6:** commit `feat(video): 욕구 히어로 + 고무줄 무료 게이트(placeholder)`

### Task 5: intro — 욕구 히어로 + 옵션 비교 + 후기 (큰 재구성, North Star)

**Files:** Modify `intro.html`, `style.css`(intro-* 클래스 추가)

- [ ] **Step 1:** DESIGN/intro.html `<body>`+인라인 `<style>` 추출. 섹션 흐름: Hero("그 자리에서 기억에 남는 사람이 되는 법", 5천원 서브카피) → 강의 8편 그리드 → 옵션 비교(₩5천/₩1.5만 "바로 연습 가능" 뱃지) → 후기 4개 verbatim → 진행 3step → 최종 CTA
- [ ] **Step 2:** base64 치환 — Hero 배경→`assets/profile/summer-crowd.jpg`(본문 img 없음). head=v2 표준. 스모어 폼 `9lJCkgl77U` 유지
- [ ] **Step 3:** `.intro-lessons/.intro-options/.intro-steps/.intro-reviews` 클래스를 디자인 인라인 style에서 채택(v2 style.css에 없음). 모바일 미디어쿼리 포함
- [ ] **Step 4:** CTA 보조 → works(영상 칸). 후기 verbatim·"바로 연습 가능" 뱃지(PRD §12) 확인
- [ ] **Step 5:** test GREEN — intro에 `9lJCkgl77U` 폼 검사 통과 유지
- [ ] **Step 6:** commit `feat(intro): 욕구 히어로 + 옵션 비교 + 후기 리치 재구성`

### Task 6: lesson — prose→리치 (큰 재구성)

**Files:** Modify `lesson.html`, `style.css`(lesson-* 클래스 추가)

- [ ] **Step 1:** DESIGN/lesson.html `<body>`+인라인 `<style>` 추출. 섹션: Hero → 대화 먼저 → 1:1/소그룹 카드 → FAQ → 가격 2카드 → 후기 verbatim → CTA
- [ ] **Step 2:** base64 치환 — Hero→`assets/profile/portrait.jpg`(본문 img 없음). head=v2 표준. 스모어 폼 `gGhx9MrYgu` 유지
- [ ] **Step 3:** `.lesson-modes/.lesson-price/.lesson-steps/.lesson-reviews` 클래스 디자인 인라인 style에서 채택
- [ ] **Step 4:** CTA 다운셀 보조 → intro 유지. 가격(60~70만)·후기 verbatim 확인
- [ ] **Step 5:** test GREEN — lesson에 `gGhx9MrYgu` 폼 검사 통과 유지
- [ ] **Step 6:** commit `feat(lesson): 1:1·소그룹 리치 재구성`

---

## 검증 (3단계 증명에서)

1. test_site.py GREEN (검사 확장: video `#free-lesson`)
2. browse 6페이지 + 모바일 390px
3. CTA 사다리 6페이지 링크 정합
4. diff0 (playground 폴더 미수정)
5. 후기·카피 verbatim, placeholder 비활성
6. Codex read-only 리뷰

## Self-Review (작성자 체크)

- 스펙 커버리지: 브리핑 §2 6페이지 전부 task 매핑 ✓
- 이미지 매핑: 정독 확정(intro/lesson Hero만, video 썸네일 8) ✓
- CTA 사다리: §3 6페이지 전부 task에 명시 ✓
- placeholder: video TODO+span 유지 명시 ✓
