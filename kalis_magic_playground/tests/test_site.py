#!/usr/bin/env python3
"""kalimagic-v2 정적 사이트 검증 — stdlib만, 무의존.

실행: /opt/homebrew/bin/python3 tests/test_site.py   (사이트 루트 또는 어디서든)
RED(빌드 전)→GREEN(빌드 후) 회귀 가드. 실패 시 exit 1.
"""
import hashlib
import os
import re
import shutil
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["index.html", "intro.html", "lesson.html", "works.html",
         "reviews.html", "video.html"]
LANDING_PAGES = PAGES + ["about.html"]
# index = 옵션조합 9섹션 (landing-final 보정본)
INDEX_SECTIONS = ["hero", "visitor", "problem", "solution", "path",
                  "review", "lesson", "faq", "final"]

failures = []
checks = 0


def test_magic_playground_static_files_exist():
    playground = (ROOT / "playground.html").read_text(encoding="utf-8")
    nav = (ROOT / "nav.js").read_text(encoding="utf-8")
    style = (ROOT / "style.css").read_text(encoding="utf-8")
    check("마술문화 기록소" in playground, "[놀이터] playground.html 제목 없음")
    check("playground.js" in playground, "[놀이터] playground.js 로드 없음")
    check("auth.js" in playground, "[놀이터] auth.js 로드 없음")
    check("data-post-list" in playground, "[놀이터] 게시글 목록 영역 없음")
    check("data-write-link" in playground and "write.html" in playground, "[놀이터] 글쓰기 링크 없음")
    check("playground.html" in nav, "[놀이터] nav.js 링크 없음")
    check(".playground-shell" in style, "[놀이터] style.css 스코프 없음")
    assert not failures


def test_reviews_event_review_list_exists_and_form_mounts_in_playground():
    reviews = (ROOT / "reviews.html").read_text(encoding="utf-8")
    reviews_community = (ROOT / "reviews-community.js").read_text(encoding="utf-8")
    check("data-event-review-list" in reviews, "[후기] 모임 후기 목록 영역 없음")
    check("reviews-community.js" in reviews, "[후기] reviews-community.js 로드 없음")
    check("KalisEventReviewForm" in reviews_community, "[후기] 모임 후기 작성 폼 연결 없음")
    assert not failures


def test_admin_page_static_shell_exists():
    admin = (ROOT / "admin.html").read_text(encoding="utf-8")
    check("관리자" in admin, "[관리자] admin.html 제목 없음")
    check("admin-tools.js" in admin, "[관리자] 앱 권한 관리 스크립트 로드 없음")
    community = (ROOT / "admin-community.html").read_text(encoding="utf-8")
    check("admin.js" in community, "[커뮤니티 관리자] admin.js 로드 없음")
    check("auth.js" in admin, "[관리자] auth.js 로드 없음")
    assert not failures


def test_community_route_and_seo_files():
    reviews_community = (ROOT / "reviews-community.js").read_text(encoding="utf-8")
    playground = (ROOT / "playground.html").read_text(encoding="utf-8")
    playground_list = (ROOT / "playground-list.js").read_text(encoding="utf-8")
    playground_detail = (ROOT / "playground-detail.js").read_text(encoding="utf-8")
    write = (ROOT / "write.html").read_text(encoding="utf-8")
    build_public = (ROOT / "scripts" / "build-public.mjs").read_text(encoding="utf-8")

    check("/p/" in reviews_community,
          "[후기] reviews-community.js 상세 기록 링크가 /p/가 아님")
    check("playground.html?post=" not in reviews_community,
          "[후기] reviews-community.js에 이전 playground.html?post= 링크가 남아 있음")
    check("const POST_SHARE_PATH = '/p/'" in playground_detail,
          "[공유] playground-detail.js에 OG 상세 공유 URL 패턴이 없음")
    check("MAGIC CULTURE ARCHIVE" in playground,
          "[기록소] playground.html 영문 눈썹 문구가 갱신되지 않음")
    check('href="intro.html">5,000원 입문 강의 보기 →</a>' in playground,
          "[기록소] 입문 강의 카드 문구 또는 intro.html 링크 없음")
    check("이 기록소의 지도" in playground_list,
          "[기록소] playground-list.js 빈 상태 문구가 갱신되지 않음")
    check("nickname-onboarding.js" in write,
          "[글쓰기] write.html이 nickname-onboarding.js를 로드하지 않음")

    for page in ["admin.html", "write.html", "mypage.html"]:
        raw = (ROOT / page).read_text(encoding="utf-8")
        check("noindex" in raw, f"[메타] {page} noindex 없음")

    sitemap = ROOT / "sitemap.xml"
    robots = ROOT / "robots.txt"
    check(sitemap.is_file(), "[SEO] sitemap.xml 없음")
    if sitemap.is_file():
        check("playground.html" in sitemap.read_text(encoding="utf-8"),
              "[SEO] sitemap.xml에 playground.html 없음")
    check(robots.is_file(), "[SEO] robots.txt 없음")
    check("sitemap.xml" in build_public and "robots.txt" in build_public,
          "[빌드] sitemap.xml 또는 robots.txt가 PUBLIC_FILES에 없음")


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


class DraftTree(HTMLParser):
    """Collect the static announcement as a queryable element tree."""

    def __init__(self):
        super().__init__()
        self.root = ElementTree.Element("document")
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = ElementTree.SubElement(self.stack[-1], tag, dict(attrs))
        if tag not in {"meta", "link", "br", "img", "input", "hr"}:
            self.stack.append(node)

    def handle_endtag(self, tag):
        assert self.stack[-1].tag == tag
        self.stack.pop()

    def handle_data(self, data):
        node = self.stack[-1]
        if len(node):
            node[-1].tail = (node[-1].tail or "") + data
        else:
            node.text = (node.text or "") + data


def test_seminar_signup_public_contract():
    public = ROOT / "seminar-signup"
    expected = {"index.html", "pricing.mjs", "form.mjs", "styles.css",
                "event-config.mjs", "cupsnballs.html", "cups-form.mjs", "entry.mjs"}
    assert {entry.name for entry in public.iterdir()} == expected
    tree = DraftTree()
    tree.feed((public / "index.html").read_text())
    assert tree.root.find("html").get("lang") == "ko"
    form = tree.root.find(".//form")
    assert form.get("method").lower() == "post"
    assert form.get("action") == "/api/seminars/signup"
    assert "disabled" in form.find(".//button[@type='submit']").attrib
    assert "checked" not in form.find(".//input[@name='consent']").attrib
    manifest = (ROOT / "scripts/build-public.mjs").read_text()
    for filename in expected:
        assert f"'seminar-signup/{filename}'" in manifest
    cups = DraftTree()
    cups.feed((public / "cupsnballs.html").read_text())
    assert cups.root.find("html").get("lang") == "ko"
    cups_form = cups.root.find(".//form")
    assert cups_form.get("method").lower() == "post"
    assert cups_form.get("action") == "/api/seminars/signup"
    assert "disabled" in cups_form.find(".//button[@type='submit']").attrib
    for checkbox in cups_form.findall(".//input[@type='checkbox']"):
        if checkbox.get("name") != "samePayer":
            assert "checked" not in checkbox.attrib
    refund = "".join(cups_form.find(".//p[@id='refund-notice']").itertext())
    assert all(period in refund for period in ("12월 12일까지는 전액", "13-16일에는 70%",
                                                "17-18일에는 50%", "행사 당일인 12월 19일에는 환불이 불가능합니다."))
    landing = (ROOT / "cupsnballs/index.html").read_text()
    assert '<time datetime="2026-12-06">12월 6일</time>까지' in landing
    assert 'href="https://smore.im/form/' not in landing
    assert 'href="/seminar-signup/cupsnballs.html"' in landing
    routes = (ROOT / "netlify.toml").read_text()
    for api in ["seminars/offer", "seminars/signup"]:
        assert f'from = "/api/{api}"' in routes


def test_daebeongae_draft():
    folder = ROOT / "daebeongae"
    assert {str(p.relative_to(folder)) for p in folder.rglob("*") if p.is_file()} == {
        "index.html", "styles.css", "font/anton.woff2", "font/OFL-Anton.txt", "img/og.jpg",
        "img/august-group-560.webp", "img/august-group-1100.webp",
        "img/past-gathering.webp",
        "img/review-gathering.webp",
        "img/review-magic.webp",
        "img/park-younggyun.webp",
        "img/planb.webp",
        "img/tomataro.webp",
        "img/hellocool.webp",
        "font/OFL-notosanskr.txt",
        "font/noto-sans-ko-500.ttf",
        "font/noto-sans-ko-600.ttf",
        "font/noto-sans-ko-700.ttf",
        "font/noto-sans-ko.ttf"
    }
    html = (folder / "index.html").read_text()
    css = (folder / "styles.css").read_text()
    assert all(char not in html + css for char in ("—", "~"))
    assert re.findall(r'url\(["\']?([^"\')]+)', css) == [
        "font/noto-sans-ko.ttf",
        "font/noto-sans-ko-500.ttf",
        "font/noto-sans-ko-600.ttf",
        "font/noto-sans-ko-700.ttf"
    ]
    assert "@import" not in css
    parser = DraftTree()
    parser.feed(html)
    doc = parser.root
    assert doc.find("html").get("lang") == "ko"
    assert [link.get("href") for link in doc.iter("link")] == ["styles.css"]
    meta = {m.get("name") or m.get("property"): m.get("content") for m in doc.iter("meta")}
    base = "https://kalimagic.netlify.app/daebeongae/"
    assert doc.findtext(".//title") == meta["og:title"] == "칼리의 대번개 | 2027년 1월 10일"
    assert meta["robots"] == "noindex, nofollow"
    assert meta["viewport"] == "width=device-width, initial-scale=1"
    assert (meta["og:url"], meta["og:image"]) == (base, base + "img/og.jpg")
    assert (meta["og:image:width"], meta["og:image:height"]) == ("1200", "630")
    items = doc.findall(".//section[@id='program']/ol/li")
    assert [item.findtext(".//h3") for item in items] == ["특별 렉쳐", "렉쳐", "공연", "본모임", "오픈 세션"]
    copy = [" ".join("".join(item.itertext()).split()) for item in items]
    assert [item.findtext("div/p") for item in items] == [
        "11:00-12:00", "12:30-13:30", "14:00-15:00", "15:30-18:30", "18:30부터"
    ]
    assert "김치 마술사 · 1시간" in copy[0] and "진행 여부 추후 확정" not in copy[0]
    assert "박영균 마술사 · 김훈 마술사" in copy[1] and "메인 공연 1시간 김치 마술사" in copy[2]
    assert [s.strip() for s in ("".join(li.itertext()) for li in items[3].findall("ul/li"))] == [
        "15:10 입장", "에피타이저 갈라쇼 김시헌, 키노모토", "메인 갈라쇼 김치 마술사",
        "네트워킹 파티 약 1시간", "딜러부스"
    ]
    assert "가칭" not in copy[4]
    assert items[4].findtext("div/strong") == "음료와 장소 제공 · 식사 없음"
    assert ["".join(item.find("div/p[@class='price']").itertext()).strip() for item in items] == [
        "단품 30,000원", "단품 20,000원", "단품 40,000원", "단품 30,000원", "참가비 7,000원 · 통합권 별도"
    ]
    dealers = doc.find(".//section[@class='dealers']/div")
    assert dealers.findtext("p") == "예정"
    assert [li.text for li in dealers.findall("ul/li")] == ["플랜비", "토마타로", "펜돌사", "헬로쿨"]
    fields = {"".join(div.find("dt").itertext()): "".join(div.find("dd").itertext())
              for div in doc.findall(".//dl/div")}
    assert fields["장소"] == "블루라움 (Blue Raum)서울 동대문구 안암로 86-1지하 1층6호선 고려대역 도보 4분"
    assert fields["신청 링크"] == "12월 중순 오픈 예정"
    assert fields["참가비"] == "통합권 80,000원부터단품 20,000원부터오픈 세션 7,000원"
    signup = doc.find(".//section[@id='signup']/div")
    bundle = signup.find("div[@class='bundle card']")
    assert bundle.findtext("h3") == "통합권" and signup.find("dl").get("aria-label") == "단품"
    bundle_copy = bundle.find("p")
    assert list(bundle_copy.itertext()) == [
        "특별 렉쳐 + 렉쳐 + 공연 + 본모임", "따로 구매하면 120,000원", "오픈 세션 7,000원은 별도"
    ]
    singles, tiers = doc.findall(".//section[@id='signup']//dl")
    assert singles is signup.find("dl") and tiers is bundle.find("dl")
    assert [(d.findtext("dt"), [v.text for v in d.findall("dd")]) for d in tiers.findall("div")] == [
        ("슈퍼 얼리버드", ["80,000원", "12월 15일(화)-12월 24일"]),
        ("얼리버드", ["85,000원", "12월 25일-1월 1일"]),
        ("정가", ["90,000원", "1월 2일-1월 10일"]),
    ]
    assert [(d.findtext("dt"), "".join(d.find("dd").itertext())) for d in singles.findall("div")] == [
        ("공연", "40,000원"), ("렉쳐", "20,000원"), ("본모임", "30,000원"),
        ("특별 렉쳐", "30,000원"), ("오픈 세션", "7,000원"),
    ]
    signup_link = doc.find(".//a[@href='/seminar-signup/']")
    assert signup_link.get("aria-describedby") == "signup-note"
    assert signup_link.text == "대번개 신청서 열기"
    assert doc.findtext(".//*[@id='signup-note']") == "12월 15일 오전 10시부터 신청할 수 있습니다."
    assert not any(doc.findall(".//" + tag) for tag in ["form", "script", "iframe"])
    performers = doc.findall(".//section[@id='performers']//article")
    assert ["".join(card.find(".//h3").itertext()) for card in performers] == [
        "김치 마술사", "박영균 마술사 × 김훈 마술사", "김시헌 × 키노모토"
    ]
    assert performers[1].find("img").get("src") == "img/park-younggyun.webp"
    assert [img.get("src") for img in dealers.iter("img")] == [
        "img/planb.webp", "img/tomataro.webp", "img/hellocool.webp"
    ]
    assert doc.findtext(".//header") == "12월 중순 신청 오픈 예정"
    assert len(doc.findall(".//div[@class='review-card']")) == 4
    assert "지난 모임 130명" in html and "목표 60명" not in html
    assert "data:" not in html
    approved_images = [
        (".//section[@class='hero']//figure/img", "img/august-group-1100.webp", 1100, 733,
         "7067363a186d9df0c8678ee2b740bf1f769cbee2adb21f0ebef50497b047bcde"),
        (".//section[@id='history']//img", "img/past-gathering.webp", 1100, 825,
         "1b642326dfcb97692f85bc28136d13863c0f7d4e89bcd40d8258699d155ed3aa"),
        (".//section[@id='performers']//article[2]/img", "img/park-younggyun.webp", 480, 480,
         "be7ec04cf9bf967a675dc9f0ebfed741844b1cefd7645be0476f5ea40e2c389a"),
        (".//section[@class='dealers']//li[1]/img", "img/planb.webp", 160, 147,
         "20930a2dd96a20d9deed0a70e58afaa3eeb7e57112d7e7736e033e0374420103"),
        (".//section[@class='dealers']//li[2]/img", "img/tomataro.webp", 560, 560,
         "63383beabd2c5a49309c277fcf4c3c790d31e1e9d9cead52f98eeef2b02e5f6f"),
        (".//section[@class='dealers']//li[4]/img", "img/hellocool.webp", 378, 560,
         "fd80213bb692dba63d925f59363efe4dcdcc1cdcfed7ec212f359cf513834602"),
        (".//section[@id='reviews']//div[@class='grid grid-cols-2 gap-3']/div[1]/img", "img/review-gathering.webp", 1100, 733,
         "ec4b1225c1c3c0dc4f47760a8b7cf68794f515247da332bee8d8b4be5ea92613"),
        (".//section[@id='reviews']//div[@class='grid grid-cols-2 gap-3']/div[2]/img", "img/review-magic.webp", 1100, 733,
         "1f403d82e6cb1116b93d34d3ffffb302850c164339ec867cb15e5f00d81f8214"),
    ]
    assert len(list(doc.iter("img"))) == len(approved_images)
    for selector, src, width, height, digest in approved_images:
        img, = doc.findall(selector)
        assert img.get("src") == src and img.get("alt")
        assert (int(img.get("width")), int(img.get("height"))) == (width, height)
        assert hashlib.sha256((folder / src).read_bytes()).hexdigest() == digest
    reviews = doc.findall(".//section[@id='reviews']//div[@class='review-card']")
    assert [tuple(p.text for p in card.findall("p")) for card in reviews] == [
        ('"마술을 좋아하거나 공부하고있다? 무조건 오세요! 다들 재밌고, 게스트분들 아니여도 옆자리 앉은 사람의 마술도 굉장히 신기하답니다ㅋㄱ"', 'albe****** · ★5'),
        ('"초2때 처음 무대에 나가서 마술을 경험해봤는데 이러한 경험을 21살이 되어 또 겪어 정말 재밌었습니다. 이때까지 마술 공연, 관련 행사 중에 제일 만족스러운 하루였습니다 😄"', 'ihjh*** · ★5'),
        ('"영상에서만 보던 유명 마술사분들도 뵐 수 있었고 다양한 분들과 마술에대해 소통할 수 있어 좋았습니다. 다음에도 기회가 된다면 꼭 가고싶을 정도로 만족스러운 모임이었습니다."', '0311***** · ★5'),
        ('"마술을 취미란에 적고 즐기며 주변 사람들에게 \'얘 마술한대\' 소리를 듣는걸 즐기는 ○○라고 합니다. 또 가겠습니다. 또 빌겠습니다. 즐거웠습니다. 감사합니다!"', 'seoh***** · ★5'),
    ]
    faq = {item.findtext("p"): item.findall("p")[1].text
           for item in doc.findall(".//div[@id='faq']/div")}
    assert faq["오픈 세션에 식사가 포함되나요?"] == (
        "18시 30분부터 음료와 장소를 제공합니다. 식사는 없으며 참가비 7,000원은 통합권과 별도입니다."
    )
    photo, = doc.findall(".//section[@class='hero']//img")
    assert doc.find(".//section[@class='hero']//figure/img") is photo
    assert photo.get("src") == "img/august-group-1100.webp"
    assert photo.get("srcset") == "img/august-group-560.webp 560w, img/august-group-1100.webp 1100w"
    # Pin both full-frame derivatives of the August 2, 2026 group photograph.
    approved = {
        560: (373, "1523a7da1992daa834d727a9e8c39ac56edb37ea5cbf4d918a4fdd0a90dea6a2"),
        1100: (733, "7067363a186d9df0c8678ee2b740bf1f769cbee2adb21f0ebef50497b047bcde"),
    }
    for width, (height, digest) in approved.items():
        path = f"img/august-group-{width}.webp"
        data = (folder / path).read_bytes()
        assert hashlib.sha256(data).hexdigest() == digest
        assert data[:4] == b"RIFF" and data[8:16] == b"WEBPVP8 "
        assert data[23:26] == bytes.fromhex("9d012a")
        dimensions = tuple(int.from_bytes(data[i:i + 2], "little") & 0x3fff for i in (26, 28))
        assert dimensions == (width, height)
        if path == photo.get("src"):
            assert dimensions == (int(photo.get("width")), int(photo.get("height")))
    assert photo.get("alt") and photo.get("sizes")
    assert doc.findtext(".//figcaption") == "2026년 8월 대번개"
    ids = [node.get("id") for node in doc.iter() if "id" in node.attrib]
    assert len(ids) == len(set(ids))
    links = [a.get("href") for a in doc.iter("a")]
    assert links == ["#title", "#signup", "#program", "/seminar-signup/"] and all(link[1:] in ids for link in links if link.startswith("#"))
    build = (ROOT / "scripts/build-public.mjs").read_text()
    dirs = re.search(r"const PUBLIC_DIRS = \[(.*?)\];", build, re.S)
    assert dirs and dirs[1].count("'daebeongae'") == 1


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

    hero_variants = [
        assets / "profile" / "bar-reaction-1080w.jpg",
        assets / "profile" / "bar-reaction-800w.jpg",
        assets / "profile" / "magic-reaction-800w.jpg",
        assets / "profile" / "magic-reaction-480w.jpg",
    ]
    for img in hero_variants:
        check(img.is_file(), f"[히어로 이미지] {img.name} 없음")
        if img.is_file():
            kb = img.stat().st_size / 1024
            check(kb < 400, f"[예산] {img.name} {kb:.0f}KB ≥ 400KB")

    # 페이지가 하나도 없으면 여기서 정리 (RED 단계)
    existing = [f for f in PAGES if (ROOT / f).is_file()]
    if not existing:
        return report()

    parsed = {f: parse(ROOT / f) for f in existing}

    # 공유 랜딩 내비는 데스크톱/모바일 변형 바깥에 한 번만 마운트되어야 한다.
    nav = (ROOT / "nav.js").read_text(encoding="utf-8")
    landing_nav = nav.split("const LANDING_PAGES = [", 1)[1].split("];", 1)[0]
    community_nav = nav.split("const COMMUNITY_PAGES = [", 1)[1].split("];", 1)[0]
    # lesson 개편(2026-07): nav를 두 그룹으로 분리 — 레슨 CTA는 LANDING_PAGES,
    # 마술문화 기록소(playground)는 COMMUNITY_PAGES로 이동. 옛 "기록소가 LANDING_PAGES에" 규칙은 폐기됨.
    check("lesson.html" in landing_nav,
          "[내비] LANDING_PAGES에 레슨 CTA(lesson.html) 링크 없음")
    check("playground.html" in community_nav,
          "[내비] COMMUNITY_PAGES에 기록소(playground.html) 링크 없음")
    for f in LANDING_PAGES:
        raw = (ROOT / f).read_text(encoding="utf-8")
        nav_root = raw.find('id="nav-root"')
        desktop = raw.find('class="kx-desktop"')
        check(0 <= nav_root < desktop,
              f"[모바일 내비] {f} nav-root가 kx-desktop 바깥/앞에 있지 않음")

    # 첫 화면 히어로는 observer 실행 전에도 정적으로 보여야 한다.
    for f in ["index.html", "intro.html"]:
        raw = (ROOT / f).read_text(encoding="utf-8")
        hero_match = re.search(r'<section\b[^>]*id="hero"[^>]*>.*?</section>', raw, re.S)
        hero = hero_match.group(0) if hero_match else ""
        hero_fade = re.search(r'<(?:section|div)\b[^>]*class="([^"]*\bkx-fade\b[^"]*)"', hero)
        check(hero_fade is not None and "kx-in" in hero_fade.group(1).split(),
              f"[첫 화면] {f} 데스크톱 hero kx-fade에 kx-in 없음")
        mobile_first = re.search(
            r'<(?:div|main) class="kx-mobile">\s*<(?:div|main) class="kx-shell">(?:\s|<!--.*?-->)*(<div\b[^>]*>)',
            raw,
            re.S,
        )
        check(mobile_first is not None and re.search(r'class="[^"]*\bkx-in\b', mobile_first.group(1)),
              f"[첫 화면] {f} 첫 모바일 블록에 kx-in 없음")

    index_raw = (ROOT / "index.html").read_text(encoding="utf-8")
    index_hero = re.search(r'id="hero".*?</section>', index_raw, re.S)
    check(index_hero is not None and re.search(
        r'class="kx-pad"[^>]*max-width:1140px[^>]*>.*?<div class="[^"]*\bkx-grid2\b',
        index_hero.group(0),
        re.S,
    ), "[히어로] index.html 데스크톱 hero grid가 1140px kx-pad 안에 없음")

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

    test_community_route_and_seo_files()

    for name in ("privacy.html", "terms.html"):
        policy = (ROOT / name).read_text()
        check('lang="ko"' in policy and policy.count("data-policy-date") == 1
              and 'src="/member-policy.js"' in policy and not re.search(r"20\d\d년", policy), name)
        policy_config = (ROOT / "member-policy-config.mjs").read_text()
        date = re.search(r"POLICY_VERSION = '(\d{4}-\d{2}-\d{2})'", policy_config)[1]
        year, month, day = map(int, date.split("-"))
        published = ROOT / "dist" / name
        if published.exists():
            check(f'<time datetime="{date}">{year}년 {month}월 {day}일</time>' in published.read_text(),
                  f"정적 정책 시행일 {name}")
        check(name in (ROOT / "scripts/build-public.mjs").read_text(), f"정책 빌드 {name}")
    for source in ("tools/login/login.js", "admin-session.js", "mypage.js", "write.js",
                   "playground.js", "playground-detail.js"):
        check("MagicAuth.noticeHtml" in (ROOT / source).read_text(), f"로그인 안내 {source}")

    test_daebeongae_draft()
    test_seminar_signup_public_contract()
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
