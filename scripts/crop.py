# usage: crop.py in.jpg x1 y1 x2 y2 out.jpg [pad=0.08] [maxside=640]; prints "W H" of the input if only `in` given
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB")
if len(sys.argv) == 2:
    print(im.width, im.height); sys.exit()
x1, y1, x2, y2 = map(float, sys.argv[2:6]); out = sys.argv[6]
pad = float(sys.argv[7]) if len(sys.argv) > 7 else 0.08
mx = int(sys.argv[8]) if len(sys.argv) > 8 else 640
w, h = x2 - x1, y2 - y1
box = (max(0, x1 - w * pad), max(0, y1 - h * pad), min(im.width, x2 + w * pad), min(im.height, y2 + h * pad))
c = im.crop(tuple(int(v) for v in box)); c.thumbnail((mx, mx)); c.save(out, quality=85)
