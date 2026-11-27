from collections import Counter
from pathlib import Path
import json
import math
import os
from PIL import Image, ImageColor

root = Path(os.environ['SEMINAR_AUDIT_DIR']).resolve(strict=True)
if root.is_relative_to(Path(__file__).resolve().parents[3]):
    raise ValueError('Choose an output directory outside the worktree')
reports = json.loads((root / 'form-audit.json').read_text()) + json.loads((root / 'sold-out.json').read_text())
prefixes = {'초기':'initial','선택':'selected','오류':'error','완료':'success','매진':'sold-out'}

def luminance(color):
    components = [c / 255 for c in color]
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in components]
    return sum(a*b for a,b in zip(linear,[.2126,.7152,.0722]))

samples = []
lines = ['# 대번개 신청 화면 검증', '', '지정한 8개 폭에서 로컬 빌드를 열어 보이는 블록의 줄 수를 측정했다. 픽셀 대비는 각 요소의 실제 PNG 영역 안에서 전경색과 배경색을 모두 찾아 계산했다.', '']
for state, prefix in prefixes.items():
    entries = [r for r in reports if r['state'] == state]
    assert [r['width'] for r in entries] == [320,375,390,414,768,1024,1280,1440]
    assert all(not r['overflow'] for r in entries)
    lines += ['## '+state,'','| 블록 | ' + ' | '.join(str(r['width']) for r in entries) + ' |','| --- |'+' ---: |'*8]
    for i, block in enumerate(entries[0]['blocks']):
        assert all(r['blocks'][i]['text'] == block['text'] for r in entries)
        lines.append('| '+block['text'].replace('|','/')+' | '+' | '.join(str(r['blocks'][i]['lines']) for r in entries)+' |')
    lines.append('')
    for r in entries:
        file = f"{prefix}-{r['width']}.png"
        with Image.open(root / file) as image:
            for sample in r['samples']:
                left,top,right,bottom = sample['box']
                crop = image.crop((math.floor(left),math.floor(top),math.ceil(right),math.ceil(bottom))).convert('RGB')
                counts = Counter(crop.get_flattened_data())
                colors = [ImageColor.getrgb(sample[k]) for k in ('fg','bg')]
                counts_pair = [counts[c] for c in colors]
                assert min(counts_pair) > 0, (file,sample['selector'],counts_pair)
                low,high = sorted(luminance(c) for c in colors)
                ratio = (high+.05)/(low+.05)
                assert ratio >= sample['minimum'], (file,sample,ratio)
                samples.append(dict(file=file,**sample,counts=counts_pair,ratio=round(ratio,2)))
assert any(s['selector']=='focus ring' for s in samples)
(root/'pixel-results.json').write_text(json.dumps(samples,ensure_ascii=False,indent=2))
(root/'검증 보고서.md').write_text('\n'.join(lines)+'\n')
print(f"5개 상태 × 8폭, 200% 확대 1회, 요소 영역별 픽셀 대비 {len(samples)}건 통과, 최소 {min(s['ratio'] for s in samples)}:1")
