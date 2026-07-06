#!/usr/bin/env python3
"""kalimagic-v2 정적 사이트 검증 — stdlib만, 무의존.

실행: /opt/homebrew/bin/python3 tests/test_site.py   (사이트 루트 또는 어디서든)
RED(빌드 전)→GREEN(빌드 후) 회귀 가드. 실패 시 exit 1.
"""
import os
import re
import shutil
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["index.html", "intro.html", "lesson.html", "works.html",
         "reviews.html", "video.html"]
# index = 옵션조합 9섹션 (landing-final 보정본)
INDEX_SECTIONS = ["hero", "visitor", "problem", "solution", "path",
                  "review", "lesson", "faq", "final"]

failures = []
checks = 0


def test_magic_playground_static_files_exist():
    playground = (ROOT / "playground.html").read_text(encoding="utf-8")
    nav = (ROOT / "nav.js").read_text(encoding="utf-8")
    style = (ROOT / "style.css").read_text(encoding="utf-8")
    check("마술 놀이터" in playground, "[놀이터] playground.html 제목 없음")
    check("playground.js" in playground, "[놀이터] playground.js 로드 없음")
    check("auth.js" in playground, "[놀이터] auth.js 로드 없음")
    check("data-question-form" in playground, "[놀이터] 질문 작성 폼 없음")
    check("data-post-detail" in playground, "[놀이터] 게시글 상세 영역 없음")
    check("playground.html" in nav, "[놀이터] nav.js 링크 없음")
    check(".playground-shell" in style, "[놀이터] style.css 스코프 없음")
    assert not failures


def test_reviews_event_review_mount_exists():
    reviews = (ROOT / "reviews.html").read_text(encoding="utf-8")
    check("data-event-review-app" in reviews, "[후기] 모임 후기 작성 영역 없음")
    check("reviews-community.js" in reviews, "[후기] reviews-community.js 로드 없음")
    assert not failures


def test_admin_page_static_shell_exists():
    admin = (ROOT / "admin.html").read_text(encoding="utf-8")
    check("관리자" in admin, "[관리자] admin.html 제목 없음")
    check("admin.js" in admin, "[관리자] admin.js 로드 없음")
    check("auth.js" in admin, "[관리자] auth.js 로드 없음")
    assert not failures


def check(cond, msg):
    global checks
    checks += 1
    if not cond:
        failures.append(msg)


class Collector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []          # href 값
        self.imgs = []           # (src, alt-or-None)
        self.has_viewport = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.add(a["id"])
        if tag == "a" and "href" in a:
            self.links.append(a["href"])
        if tag == "img":
            self.imgs.append((a.get("src"), a.get("alt")))
        if tag == "meta" and a.get("name") == "viewport":
            self.has_viewport = True


def parse(path):
    p = Collector()
    p.feed(path.read_text(encoding="utf-8"))
    return p


def main():
    # 1. 핵심 파일 존재
    for f in PAGES + ["style.css", "nav.js"]:
        check((ROOT / f).is_file(), f"[존재] {f} 없음")

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

    # 페이지가 하나도 없으면 여기서 정리 (RED 단계)
    existing = [f for f in PAGES if (ROOT / f).is_file()]
    if not existing:
        return report()

    parsed = {f: parse(ROOT / f) for f in existing}

    # 2. index 8섹션 id
    if "index.html" in parsed:
        ids = parsed["index.html"].ids
        for sec in INDEX_SECTIONS:
            check(sec in ids, f"[섹션] index.html에 id='{sec}' 없음")

    for f, pg in parsed.items():
        raw = (ROOT / f).read_text(encoding="utf-8")
        # 6. lang=ko / title / viewport
        check('lang="ko"' in raw, f"[메타] {f} lang=\"ko\" 없음")
        check("<title>" in raw and "</title>" in raw, f"[메타] {f} <title> 없음")
        check(pg.has_viewport, f"[메타] {f} viewport meta 없음")

        # 3. 내부 링크 해소 (*.html 파일 존재 / #anchor id 존재)
        for href in pg.links:
            if href.startswith(("http://", "https://", "mailto:", "tel:")):
                continue
            base = href.split("#")[0]
            frag = href.split("#")[1] if "#" in href else None
            if base and base.endswith(".html"):
                check((ROOT / base).is_file(), f"[링크] {f}: '{base}' 대상 파일 없음")
            if frag:
                target = parsed.get(base or f)
                if target:
                    check(frag in target.ids,
                          f"[앵커] {f}: '#{frag}' id 없음")

        # 4. img src 존재 / 5. alt 비어있지 않음
        for src, alt in pg.imgs:
            if src and not src.startswith(("http://", "https://", "data:")):
                check((ROOT / src).is_file(), f"[이미지] {f}: '{src}' 파일 없음")
            check(alt is not None and alt.strip() != "",
                  f"[접근성] {f}: <img src='{src}'> alt 비어있음")

    # 7. 폼/외부 링크 문자열 존재
    if "intro.html" in parsed:
        check("9lJCkgl77U" in (ROOT / "intro.html").read_text(encoding="utf-8"),
              "[폼] intro.html에 입문 smore 폼(9lJCkgl77U) 링크 없음")
    if "lesson.html" in parsed:
        check("gGhx9MrYgu" in (ROOT / "lesson.html").read_text(encoding="utf-8"),
              "[폼] lesson.html에 레슨 smore 폼(gGhx9MrYgu) 링크 없음")
    if "works.html" in parsed:
        check("lnmagic.co.kr" in (ROOT / "works.html").read_text(encoding="utf-8"),
              "[외부] works.html에 lnmagic.co.kr 링크 없음")

    # 7-1. reviews.html deep JS modules
    if "reviews.html" in parsed:
        raw = (ROOT / "reviews.html").read_text(encoding="utf-8")
        for module in ["collapsible.js", "modal.js"]:
            check((ROOT / module).is_file(), f"[JS] {module} 없음")
            check(f'<script src="{module}"></script>' in raw,
                  f"[JS] reviews.html이 {module} 로드 안 함")
        check('data-collapsible' in raw,
              "[JS] reviews.html에 data-collapsible 진입점 없음")
        check('class="field-reviews" data-modal' in raw,
              "[JS] reviews.html에 data-modal 진입점 없음")
        check('class="field-card" data-modal-card' in raw,
              "[JS] reviews.html에 data-modal-card 카드 진입점 없음")
        check("<script>\n    (function () {" not in raw,
              "[JS] reviews.html에 이전 인라인 IIFE 스크립트가 남아 있음")

    node = shutil.which("node")
    if node:
        for module in ["collapsible.js", "modal.js"]:
            result = subprocess.run(
                [node, "--check", str(ROOT / module)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            check(result.returncode == 0,
                  f"[JS] node --check {module} 실패: {result.stderr.strip()}")
    else:
        print("SKIP: node 없음 — collapsible.js/modal.js 구문 검사는 건너뜀")

    # 8. Hero primary CTA → intro.html (hero 섹션 안에 intro.html 링크)
    if "index.html" in parsed:
        raw = (ROOT / "index.html").read_text(encoding="utf-8")
        m = re.search(r'id="hero".*?</section>', raw, re.S)
        hero = m.group(0) if m else ""
        check("intro.html" in hero,
              "[CTA] index.html Hero 섹션에 intro.html(입문 5천) primary CTA 없음")

    # 10. mmbs(비공개 강의) — 존재·기본 메타·noindex만 (JS 동적 썸네일이라 img 검사 예외)
    mmbs = ROOT / "mmbs.html"
    check(mmbs.is_file(), "[존재] mmbs.html 없음")
    if mmbs.is_file():
        raw = mmbs.read_text(encoding="utf-8")
        check('lang="ko"' in raw, "[메타] mmbs.html lang 없음")
        check("<title>" in raw, "[메타] mmbs.html title 없음")
        check('name="viewport"' in raw, "[메타] mmbs.html viewport 없음")
        check("noindex" in raw, "[메타] mmbs.html noindex 없음")

    return report()


def report():
    print(f"검사 {checks}건 · 실패 {len(failures)}건")
    for f in failures:
        print("  ✗", f)
    if failures:
        print("RED")
        return 1
    print("GREEN — 전부 통과")
    return 0


if __name__ == "__main__":
    sys.exit(main())
