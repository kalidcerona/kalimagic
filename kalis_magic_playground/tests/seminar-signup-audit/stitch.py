import json
import sys
from PIL import Image

capture = json.load(sys.stdin)
image = Image.new('RGB', (capture['width'], capture['height']))
covered = 0
for frame in capture['frames']:
    with Image.open(frame['file']) as tile:
        y = frame['y']
        assert 0 <= y <= covered and tile.width == image.width, (frame,covered,tile.size,image.size)
        image.paste(tile, (0, y))
        covered = max(covered, y + tile.height)
assert covered >= image.height
image.save(capture['file'])
