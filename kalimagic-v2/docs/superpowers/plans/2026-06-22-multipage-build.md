# 칼리매직 랜딩 v2 멀티페이지 7개 업그레이드 — 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.
> 1단계 설계 plan = `~/.claude/plans/wobbly-wobbling-crescent.md`. SSOT PRD = `personal/projects/퍼널/칼리매직-리드페이지-PRD.md`.

**Goal:** kalimagic-v2를 v1식 멀티페이지 7개(index/works/video/intro/reviews/lesson/mmbs)로 완성하고, test_site.py를 RED→GREEN 회귀 가드로 통과시킨다.

**Architecture:** 정적 HTML + 공용 `style.css`/`nav.js`. index만 옵션조합(landing-final) 단일 랜딩으로 self-contained 인라인 디자인이되 헤더는 nav.js로 통일. test_site.py(Python stdlib)가 회귀 가드.

**Tech Stack:** HTML5, CSS3, vanilla JS, Python3 stdlib(test). 이미지 최적화 = `sips`(macOS).

## Global Constraints

- **`kalimagic-v2/`만 수정.** `kalis_magic_playground`·`kali_playground_v2` 절대 미수정 (diff0 검증).
- 카피·후기는 **옵션시스템·v1 verbatim 재활용, 각색 금지.**
- 이미지 예산 **장당 400KB 미만.**
- 테라코타 토큰: `--bg-color #1a1512`, `--bg-alt #1f1815`, `--card-bg #261d18`, `--text-main #f4efe9`, `--text-muted #ab9f92`, `--point-gold #E0904E`.
- QSE 룰: **"지금은"(시한 암시) 금지, 전수 단정("다 만족") 금지.**
- 테스트 실행: `PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/python3 tests/test_site.py` (cwd = kalimagic-v2). exit 0 = GREEN.
- 깊은 모듈(nav.js·test_site.py)은 **외과적 수정만**(데이터·검사 추가, 로직 구조 유지) — 칼리형 승인됨.
- 워커: 구현=Codex, 자산복사=리더 Bash, 검증=claude-main+Codex read-only+browse, 발행검수=QSE.

## File Structure

| 파일 | 책임 | 작업 |
|---|---|---|
| `assets/` 인근 `imigi3/`, `imigi3-orig/` | 영상·강의 썸네일 | 신규(최적화 복사 + 원본 백업) |
| `nav.js` | 공용 헤더 6페이지 | 외과 수정(video 추가) |
| `tests/test_site.py` | 회귀 가드 | 외과 수정(검사 확장) |
| `style.css` | 공용 스타일 | video-*/members-* 클래스 추가 |
| `index.html` | 옵션조합 단일 랜딩 | landing-final 보정 교체 |
| `video.html` | 무료 영상 | v1 이식 |
| `mmbs.html` | 구매자 강의(noindex) | v1 이식 |
| `works/intro/lesson/reviews.html` | 기존 페이지 | PRD 점검(경미) |

---

### Task 1: 썸네일 자산 최적화 복사 (선행 — 다른 task가 의존)

**Files:**
- Create: `kalimagic-v2/imigi3/` (1-8.jpg, g1-g8.jpg), `kalimagic-v2/imigi3-orig/` (원본 백업)
- Source(읽기 전용): `kalis_magic_playground/imigi3/` (1-8.jpg, g1-g8.png)

- [ ] **Step 1: 원본 백업 + 출력 폴더 생성**

```bash
cd "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic"
mkdir -p kalimagic-v2/imigi3 kalimagic-v2/imigi3-orig
cp kalis_magic_playground/imigi3/* kalimagic-v2/imigi3-orig/
```

- [ ] **Step 2: video 썸네일 최적화 (1-8.jpg → 폭 800px, JPEG q80)**

```bash
cd "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic/kalimagic-v2/imigi3-orig"
for n in 1 2 3 4 5 6 7 8; do
  sips -Z 800 -s format jpeg -s formatOptions 80 "$n.jpg" --out "../imigi3/$n.jpg"
done
```

- [ ] **Step 3: mmbs 강의 썸네일 최적화 (g1-g8.png → 폭 1600px, JPEG q85, .jpg 변환)**

```bash
cd "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic/kalimagic-v2/imigi3-orig"
for n in 1 2 3 4 5 6 7 8; do
  sips -Z 1600 -s format jpeg -s formatOptions 85 "g$n.png" --out "../imigi3/g$n.jpg"
done
```

- [ ] **Step 4: 예산 확인 — 모든 출력이 400KB 미만**

```bash
cd "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic/kalimagic-v2/imigi3"
for f in *.jpg; do kb=$(($(stat -f%z "$f")/1024)); [ $kb -ge 400 ] && echo "OVER: $f ${kb}KB" || true; done
echo "확인 완료 (OVER 출력 없으면 전부 400KB 미만)"
```
Expected: OVER 출력 없음. (있으면 해당 파일 q70 또는 폭 더 줄여 재실행)

> **주의:** g*.png → g*.jpg로 **확장자 바뀜** → mmbs.html의 src도 `.jpg`로 (Task 7에서 반영).

---

### Task 2: nav.js에 video 페이지 추가 (깊은 모듈 외과 수정)

**Files:** Modify `kalimagic-v2/nav.js`

**Interfaces:** Produces — nav가 6페이지(홈·작품·영상·입문·후기·레슨) 렌더. `renderNav('video')` 등 key로 active.

- [ ] **Step 1: pages 배열에 video 추가 + 순서 조정**

`nav.js`의 `pages` 배열을 아래로 교체(주석의 "5페이지"도 "6페이지"로):

```javascript
// kalimagic v2 공통 헤더 — 6페이지(홈·작품·영상·입문·후기·레슨)
document.documentElement.classList.add('js-anim');

function renderNav(activePage) {
    const pages = [
        { key: 'home',   label: '홈',   href: 'index.html' },
        { key: 'works',  label: '작품', href: 'works.html' },
        { key: 'video',  label: '영상', href: 'video.html' },
        { key: 'intro',  label: '입문', href: 'intro.html' },
        { key: 'reviews', label: '후기', href: 'reviews.html' },
        { key: 'lesson', label: '레슨', href: 'lesson.html', cta: true },
    ];
    // (이하 links/root 렌더 로직은 변경 없음)
```

- [ ] **Step 2: 검증 (Task 3·6 GREEN으로 확인 — 단독 테스트 없음, 정적 JS)**

수동: 브라우저에서 video.html 열면 nav에 6개 + "영상" active. (Task 9 browse에서 확인)

---

### Task 3: test_site.py 확장 (깊은 모듈 외과 수정) — RED 유발

**Files:** Modify `kalimagic-v2/tests/test_site.py`

이 task가 **RED를 만든다**(아직 index 미보정·video 없음). Task 5·6이 GREEN으로 만든다.

- [ ] **Step 1: PAGES·INDEX_SECTIONS 교체 + mmbs/imigi3 검사 추가**

`test_site.py` 상단 상수를 교체:

```python
ROOT = Path(__file__).resolve().parent.parent
PAGES = ["index.html", "intro.html", "lesson.html", "works.html",
         "reviews.html", "video.html"]
# index = 옵션조합 9섹션 (landing-final 보정본)
INDEX_SECTIONS = ["hero", "visitor", "problem", "solution", "path",
                  "review", "lesson", "faq", "final"]
```

`main()`의 이미지 예산 블록(현재 `assets.glob("*.jpg")`)을 imigi3까지 확장:

```python
    # 9. 이미지 예산 (assets + imigi3)
    assets = ROOT / "assets"
    imgs = list(assets.glob("*.jpg")) if assets.is_dir() else []
    imigi3 = ROOT / "imigi3"
    if imigi3.is_dir():
        imgs += list(imigi3.glob("*.jpg"))
    check(len(imgs) >= 12, f"[이미지] *.jpg {len(imgs)}개 (12개 이상 기대)")
    for img in imgs:
        kb = img.stat().st_size / 1024
        check(kb < 400, f"[예산] {img.name} {kb:.0f}KB ≥ 400KB")
```

`main()` 끝(report() 직전)에 mmbs 최소 검사 추가:

```python
    # 10. mmbs(비공개 강의) — 존재·기본 메타·noindex만 (JS 동적 썸네일이라 img 검사 예외)
    mmbs = ROOT / "mmbs.html"
    check(mmbs.is_file(), "[존재] mmbs.html 없음")
    if mmbs.is_file():
        raw = mmbs.read_text(encoding="utf-8")
        check('lang="ko"' in raw, "[메타] mmbs.html lang 없음")
        check("<title>" in raw, "[메타] mmbs.html title 없음")
        check("noindex" in raw, "[메타] mmbs.html noindex 없음")
```

- [ ] **Step 2: 실행해 RED 확인**

```bash
cd "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic/kalimagic-v2"
PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/python3 tests/test_site.py
```
Expected: **RED** — video.html 없음, index에 옵션조합 섹션 id 없음, mmbs.html 없음 등 실패. (이게 Task 5·6·7의 목표)

- [ ] **Step 3: 커밋**

```bash
git -C "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic" add kalimagic-v2/tests/test_site.py kalimagic-v2/nav.js
git -C "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic" commit -m "test(kalimagic-v2): 7페이지 검사 확장 (RED) + nav video 추가"
```

---

### Task 4: style.css에 video-*/members-* 클래스 이식

**Files:** Modify `kalimagic-v2/style.css` (append)

**Interfaces:** Produces — `.video-grid/.video-card/.video-thumb/.video-info`(video용), `.members-header/.members-title/.video-list/.video-item/.video-wrapper/.play-btn` 등(mmbs용).

- [ ] **Step 1: v1 style.css에서 해당 클래스 블록 복사**

`kalis_magic_playground/style.css`의 아래 라인 범위를 읽어 `kalimagic-v2/style.css` 끝에 append:
- video-card 계열: `1212-1276` (.video-grid/.video-card/.video-thumb/.video-info + @media)
- members + video-list 계열: `1278-1440` (.members-header~.members-cta-title, .video-list/.video-item/.video-wrapper/.play-btn)
- youtube-banner는 v2에 이미 있음(4건) → 중복 추가 금지.

색상값이 옛 골드(`#C9A84C` 등)면 테라코타로 치환하되, **대부분 var() 토큰이나 중립색이라 그대로 OK**. append 후 `grep -i "c9a84c\|#121212" style.css`로 잔존 확인.

- [ ] **Step 2: 잔존 옛 토큰 확인**

```bash
cd "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic/kalimagic-v2"
grep -ni "c9a84c\|#121212\|#1e1e1e" style.css || echo "잔존 없음 (테라코타 유지)"
```
Expected: 잔존 없음.

- [ ] **Step 3: 커밋**

```bash
git -C "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic" add kalimagic-v2/style.css
git -C "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic" commit -m "feat(kalimagic-v2): style.css에 video/members 클래스 이식"
```

---

### Task 5: index 보정 (landing-final → index)

**Files:** Modify `kalimagic-v2/index.html` (현 옛 8섹션을 landing-final 기반으로 교체), 소스 참고 `kalimagic-v2/landing-final.html`

**Interfaces:** Consumes — Task 2의 nav 6페이지. Produces — index가 옵션조합 9섹션 + 섹션 id + nav.js 헤더.

- [ ] **Step 1: landing-final.html 본문을 index.html로 가져오되 헤더를 nav.js로 교체**

`landing-final.html`의 `<head>`·`<main>`·옵션조합 9섹션·`<style>`·bindHover `<script>`를 index.html로 옮긴다. **단 헤더는 인라인 `<header style=...>`(line 39-51) 대신 nav.js 방식으로:**

`<head>`에 추가:
```html
    <link rel="stylesheet" href="style.css">
    <script src="nav.js"></script>
```
`<body>` 최상단(노이즈 오버레이 div 다음):
```html
    <header id="nav-root"></header>
    <script>renderNav('home')</script>
```
> nav.js는 `style.css`의 `.main-nav`/`.nav-links`/`.nav-cta` 클래스에 의존 → index가 `style.css`를 링크해야 nav 스타일이 나온다. 옵션조합 본문은 인라인 `<style>`이라 충돌 없음(body 토큰 동일 확인됨: #1a1512/#f4efe9). 단 `style.css`의 `.hero`/`.section` 등 범용 클래스를 옵션조합 섹션이 쓰지 않는지 확인(옵션조합은 `kx-*`·인라인이라 안전).

- [ ] **Step 2: 각 섹션에 id 부여 (test INDEX_SECTIONS 대응)**

옵션조합 9개 `<section data-screen-label="...">`에 id 추가:
`hero`/`visitor`(방문자 분기)/`problem`(문제·공감)/`solution`(해결)/`path`(제품 경로)/`review`(후기)/`lesson`(레슨 CTA)/`faq`/`final`(최종 CTA).

예: `<section id="hero" data-screen-label="Hero" ...>`

- [ ] **Step 3: final CTA를 lesson → intro로 (칼리형 지시: North Star 정렬)**

`final` 섹션(landing-final FINAL B "레슨 상담")의 CTA를 intro로:
```html
              <a href="intro.html" style="...background:#E0904E; color:#1a1410; ...">5,000원으로 시작하기</a>
```
헤드라인·서브카피도 "레슨 상담"→입문 전환 톤으로 verbatim 조정(예: "제대로 시작하고 싶다면" / "커피 한 잔 값으로 오늘 시작"). 옵션시스템 final A 카피 재활용 가능.

- [ ] **Step 4: 모든 `<img alt="">`에 의미 있는 한국어 alt 부여**

옵션조합 8개 이미지 alt를 채운다(test 접근성 검사 + 실제 접근성). 예:
`assets/profile/magic-reaction.jpg` → `alt="관객이 놀라는 마술 시연 현장"`, `magic-cards.jpg` → `alt="실내 카드 마술 시연"`, `street-magic.jpg` → `alt="야외에서 관객이 촬영하는 마술 시연"`, `magic-booth.jpg` → `alt="축제 부스 마술 공연"`, `lecture-outdoor.jpg` → `alt="야외 특강 현장"`, `magic-table.jpg` → `alt="테이블 마술 시연"`.

- [ ] **Step 5: Hero primary CTA가 intro.html인지 확인 (test 검사)**

hero A에 이미 `<a href="intro.html" ...>5,000원으로 시작하기</a>` 있음 → 유지.

- [ ] **Step 6: 실행해 index 관련 검사 GREEN 확인**

```bash
cd "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic/kalimagic-v2"
PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/python3 tests/test_site.py 2>&1 | grep -i "index\|섹션\|hero\|접근성" || echo "index 관련 실패 없음"
```
Expected: index 관련 실패 없음(video/mmbs는 아직 RED).

- [ ] **Step 7: 커밋**

```bash
git -C "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic" add kalimagic-v2/index.html
git -C "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic" commit -m "feat(kalimagic-v2): index를 옵션조합 단일 랜딩으로 (CTA intro·섹션 id·alt)"
```

---

### Task 6: video.html 이식 (v1 → v2)

**Files:** Create `kalimagic-v2/video.html`, 소스 `kalis_magic_playground/video.html`

- [ ] **Step 1: v1 video.html을 v2로 복사 + 점검**

`kalis_magic_playground/video.html`을 `kalimagic-v2/video.html`로 복사. 이미 `style.css`+`nav.js`(`renderNav('video')`) 사용하고 `imigi3/1-8.jpg` 참조 → **변경 거의 불필요.** 확인:
- `<script src="nav.js">` 있음 → nav 6페이지 자동.
- `imigi3/1.jpg`~`8.jpg` 참조 → Task 1 최적화본 사용(경로 동일).
- og:image의 절대 URL(`https://kalimagic.netlify.app/imigi3/1.jpg`)은 그대로 둬도 무방(배포 후 유효).
- script.js 참조가 있으면 v2에 script.js 존재 확인(없으면 제거).

- [ ] **Step 2: 실행해 video GREEN 확인**

```bash
cd "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic/kalimagic-v2"
PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/python3 tests/test_site.py 2>&1 | grep -i "video" || echo "video 관련 실패 없음"
```
Expected: video 관련 실패 없음.

- [ ] **Step 3: 커밋**

```bash
git -C "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic" add kalimagic-v2/video.html
git -C "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic" commit -m "feat(kalimagic-v2): video.html v1 이식"
```

---

### Task 7: mmbs.html 이식 (v1 → v2, noindex·구매자 전용)

**Files:** Create `kalimagic-v2/mmbs.html`, 소스 `kalis_magic_playground/mmbs.html`

- [ ] **Step 1: v1 mmbs.html을 v2로 복사 + 썸네일 확장자 .png → .jpg**

복사 후, JS의 썸네일 경로를 Task 1 변환(.jpg)에 맞춤:
```javascript
            img.src = `imigi3/g${num}.jpg`;
```
(원본은 `imigi3/g${num}.png`). nav 미노출(members-header 자체 헤더, renderNav 안 씀) → 그대로. noindex meta 유지. script.js 참조 확인.

- [ ] **Step 2: 실행해 mmbs GREEN 확인**

```bash
cd "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic/kalimagic-v2"
PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/python3 tests/test_site.py 2>&1 | grep -i "mmbs" || echo "mmbs 관련 실패 없음"
```
Expected: mmbs 관련 실패 없음.

- [ ] **Step 3: 커밋**

```bash
git -C "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic" add kalimagic-v2/mmbs.html
git -C "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic" commit -m "feat(kalimagic-v2): mmbs.html v1 이식 (noindex·썸네일 jpg)"
```

---

### Task 8: works·intro·lesson PRD 점검 (경미)

**Files:** Read `works.html`·`intro.html`·`lesson.html` (수정은 발견 시만)

- [ ] **Step 1: PRD §1·§7 대조**

세 페이지가 PRD와 정합인지 확인(이미 완성 상태로 파악됨): intro = 강의 8편·2옵션(₩5천/₩1.5만)·폼 9lJCkgl77U / lesson = 1:1·소그룹·가격 60/70만·폼 gGhx9MrYgu / works = store-grid 제품카드·lnmagic. nav 링크가 6페이지 반영되는지(nav.js 공용이라 자동). **어긋나는 점 없으면 수정 없음**(YAGNI).

- [ ] **Step 2: 변경 있었으면 커밋, 없으면 skip**

---

### Task 9: 최종 검증 (3단계 증명 진입 전 전체)

- [ ] **Step 1: 전체 test GREEN**

```bash
cd "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic/kalimagic-v2"
PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/python3 tests/test_site.py
```
Expected: **GREEN — 전부 통과**, exit 0.

- [ ] **Step 2: 기존 폴더 diff0 확인**

```bash
git -C "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic" status --short kalis_magic_playground/ kali_playground_v2/
```
Expected: 출력 없음(미수정).

- [ ] **Step 3: browse 렌더 (로컬 서버)**

```bash
cd "/Users/sumpie/Desktop/AI/AiGo/projects/kalis magic/kalimagic-v2" && /opt/homebrew/bin/python3 -m http.server 8082 &
```
브라우저: index(옵션조합 9섹션·nav 6개·final→intro)·video(썸네일·nav 영상 active)·mmbs(강의 리스트·nav 없음). 모바일 390px 깨짐 확인.

- [ ] **Step 4: Codex read-only 리뷰**

Codex로 HTML·CSS·접근성·링크 해소·이미지 경로 점검(수정 금지, 발견만).

---

## Self-Review

- **Spec 커버리지:** 설계 plan의 작업 1(index 보정)=Task5, 작업 2(video/mmbs)=Task6/7, 작업 3(깊은모듈)=Task2/3, 작업 4(자산)=Task1, style.css=Task4, works/intro/lesson=Task8, 검증=Task9. PRD 보정은 **별도 병렬 진행 중**(claude-main 워커). 커버 완료.
- **Placeholder:** "무료 마술 1개 TBD"는 PRD 미해결 항목이라 빌드 범위 밖(현재 단계=라이트 레슨 직접신청). 코드 플레이스홀더 아님.
- **타입 일관성:** nav key(`video`)·INDEX_SECTIONS id(`hero..final`)·imigi3 경로(.jpg)가 Task 간 일치.

## 코딩 순서 위치

2단계 개발(이 플랜) → 3단계 증명(`/verification-before-completion`) → 4단계 출하(`/finishing-a-development-branch` + QSE) → 5 유지보수.
