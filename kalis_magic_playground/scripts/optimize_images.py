#!/usr/bin/env python3
"""kalimagic-v2 이미지 최적화 — 결정적·멱등.

입력: AiGo/assets/리소스/포폴용/ (카톡 원본 최대 6.5MB)
출력: kalimagic-v2/assets/ (가로 max 1600px, JPEG q82, EXIF strip)

용도 기반 슬러그:
  2026 Garage Life Festval → garage-demo-NN.jpg  (Hero·문제·솔루션)
  24년 여름                → summer24-crowd-NN.jpg (커뮤니티 단체)
  25년 여름                → summer25-intimate-NN.jpg (후기·About)

멱등: 출력 파일이 이미 있으면 skip. 강제 재생성은 --force.
"""
import sys
from pathlib import Path
from PIL import Image, ImageOps

SRC_ROOT = Path("/Users/sumpie/Desktop/AI/AiGo/assets/리소스/포폴용")
OUT_DIR = Path(__file__).resolve().parent.parent / "assets"

# 입력 폴더 → 출력 슬러그 prefix (정렬된 파일에 01부터 번호 부여)
FOLDER_SLUG = {
    "2026 Garage Life Festval": "garage-demo",
    "24년 여름": "summer24-crowd",
    "25년 여름": "summer25-intimate",
}

MAX_WIDTH = 1600
QUALITY = 82


def optimize(src: Path, dst: Path, force: bool) -> str:
    if dst.exists() and not force:
        return f"skip   {dst.name} (이미 존재)"
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)  # EXIF 회전 적용 후 메타는 버림
        im = im.convert("RGB")
        if im.width > MAX_WIDTH:
            h = round(im.height * MAX_WIDTH / im.width)
            im = im.resize((MAX_WIDTH, h), Image.LANCZOS)
        im.save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    kb = dst.stat().st_size / 1024
    return f"write  {dst.name}  {kb:.0f}KB"


def main() -> int:
    force = "--force" in sys.argv
    if not SRC_ROOT.is_dir():
        print(f"[ERR] 입력 폴더 없음: {SRC_ROOT}", file=sys.stderr)
        return 1
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    over_budget = []
    for folder, slug in FOLDER_SLUG.items():
        src_dir = SRC_ROOT / folder
        if not src_dir.is_dir():
            print(f"[WARN] 폴더 없음 — skip: {src_dir}")
            continue
        files = sorted(p for p in src_dir.iterdir()
                       if p.suffix.lower() in (".jpg", ".jpeg", ".png"))
        for i, src in enumerate(files, 1):
            dst = OUT_DIR / f"{slug}-{i:02d}.jpg"
            print(optimize(src, dst, force))
            if dst.exists() and dst.stat().st_size > 400 * 1024:
                over_budget.append(f"{dst.name} {dst.stat().st_size/1024:.0f}KB")
    if over_budget:
        print(f"\n[BUDGET] 400KB 초과: {', '.join(over_budget)}", file=sys.stderr)
        return 2
    print("\n완료 — 전부 400KB 이하")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
