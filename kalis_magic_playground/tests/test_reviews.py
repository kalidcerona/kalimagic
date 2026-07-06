#!/usr/bin/env python3
"""kalimagic-v2 works 개선 + reviews 신규 검증.

test_site.py는 deep module(수정 금지)이라 신규 페이지 검증은 여기에 둔다.
실행: PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/python3 tests/test_reviews.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def read(name):
    p = os.path.join(ROOT, name)
    if not os.path.exists(p):
        return None
    with open(p, encoding="utf-8") as f:
        return f.read()


def main():
    checks = []

    def c(name, cond):
        checks.append((name, cond))

    reviews = read("reviews.html")
    works = read("works.html")
    nav = read("nav.js")

    # --- reviews.html (신규) ---
    c("reviews.html 존재", reviews is not None)
    if reviews:
        c("행사 갤러리 event-gallery", "event-gallery" in reviews)
        c("갤러리 figure 3개 이상", reviews.count("<figure>") >= 3)
        c("Q&A review-q-title 4블록", reviews.count("review-q-title") == 4)
        c("과외 후기 verbatim(자판기)", "자판기 같아요" in reviews)
        c("과외 후기 verbatim(정답지)", "정답지가 앞에 있는 느낌" in reviews)
        c("nav active=reviews", "renderNav('reviews')" in reviews)
        c("입문 CTA 링크(사다리)", "intro.html" in reviews)

    # --- works.html (제품 카드 개선) ---
    c("works.html 존재", works is not None)
    if works:
        c("store-grid 제품 그리드", "store-grid" in works)
        c("store-card 12개 이상", works.count("store-card") >= 12)
        c("카테고리(강의)", "category-title" in works and "강의" in works)
        c("제품 트레이스", "트레이스" in works)
        c("제품 썸네일 경로 assets/products/", "assets/products/" in works)
        c("구매자 후기 유지(오일앤워터)", "오일앤워터" in works)

    # --- nav.js 5페이지 ---
    c("nav.js reviews 항목", nav is not None and "reviews.html" in nav)

    # --- assets/products 복사 ---
    prod = os.path.join(ROOT, "assets", "products")
    n = len([f for f in os.listdir(prod) if f.endswith(".jpg")]) if os.path.isdir(prod) else 0
    c("assets/products 13개 이상", n >= 13)

    failed = [name for name, ok in checks if not ok]
    for name, ok in checks:
        print(("PASS" if ok else "FAIL") + ": " + name)
    print(f"\n{len(checks) - len(failed)}/{len(checks)} 통과")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
