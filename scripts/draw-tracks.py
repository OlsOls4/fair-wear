"""Renders the SAM 3.1 video-tracking result (scripts/track-video.ts) as a side-by-side move-in | move-out video
with persistent, cross-visit object IDs. Free (no model calls).
Cross-visit matching: same label + highest IoU of the object's mean box over frames both visits see (same camera path).
Outputs public/demo/video/bedroom-tracked.mp4, bedroom-tracked.gif, bedroom-tracked.jpg and adds `matches` to tracks.json.
Run: python3 scripts/draw-tracks.py"""
import json, os, subprocess, shutil
from collections import defaultdict
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

V = "public/demo/video"; T = json.load(open(f"{V}/tracks.json")); recs = [r for r in T["records"] if (r.get("conf") or 1) >= 0.4 and r.get("maskW")]
def font(sz): p = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"; return ImageFont.truetype(p, sz) if os.path.exists(p) else ImageFont.load_default()
objs = defaultdict(list)
for r in recs: objs[(r["visit"], r["label"], r["id"])].append(r)
def meanbox(rs): n = len(rs); return [sum(r["box"][i] for r in rs) / n for i in range(4)]
def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0])); iy = max(0, min(a[3], b[3]) - max(a[1], b[1])); i = ix * iy
    return i / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i + 1e-9)
ABBR = {"wall": "W", "carpet": "C", "curtains": "K", "wardrobe": "D", "window": "N", "radiator": "R"}
PAL = [(43, 95, 180), (214, 108, 0), (122, 61, 184), (0, 140, 120), (180, 35, 24), (200, 150, 0), (30, 130, 200), (160, 60, 120), (90, 120, 40), (20, 100, 100)]
gid = {}; matches = []; n = defaultdict(int); ci = 0
for label in ABBR:
    ins = [k for k in objs if k[0] == "move-in" and k[1] == label]; outs = [k for k in objs if k[0] == "move-out" and k[1] == label]
    pairs = sorted(((iou(meanbox(objs[a]), meanbox(objs[b])), a, b) for a in ins for b in outs), reverse=True); used = set()
    for s, a, b in pairs:
        if s < 0.3 or a in used or b in used: continue
        used |= {a, b}; n[label] += 1; g = f"{ABBR[label]}{n[label]}"; gid[a] = gid[b] = (g, PAL[ci % len(PAL)]); ci += 1
        matches.append({"globalId": g, "label": label, "moveInId": a[2], "moveOutId": b[2], "meanBoxIoU": round(s, 3), "framesIn": len(objs[a]), "framesOut": len(objs[b])})
    for k in ins + outs:
        if k not in used:
            n[label] += 1; g = f"{ABBR[label]}{n[label]}"; gid[k] = (g, PAL[ci % len(PAL)]); ci += 1
            matches.append({"globalId": g, "label": label, "moveInId": k[2] if k[0] == "move-in" else None, "moveOutId": k[2] if k[0] == "move-out" else None, "meanBoxIoU": None, "unmatched": True})

tmp = "/tmp/fw-track"; shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
frames = {}
for visit in ("move-in", "move-out"):
    d = f"{tmp}/{visit}"; os.makedirs(d); subprocess.run(["ffmpeg", "-v", "error", "-i", f"{V}/bedroom-{visit}-walkthrough.mp4", f"{d}/%03d.png"], check=True)
    frames[visit] = sorted(os.listdir(d))
def draw(visit, fi):
    img = Image.open(f"{tmp}/{visit}/{frames[visit][fi]}").convert("RGB"); W, H = img.size
    rs = [r for r in recs if r["visit"] == visit and r["frame"] == fi]
    for r in rs:
        g, col = gid[(visit, r["label"], r["id"])]
        m = Image.open(f"data/vmasks/{r['key']}.pgm").convert("L"); full = Image.new("L", (W, H), 0); full.paste(m, (int(r["box"][0]), int(r["box"][1])))
        img = Image.composite(Image.blend(img, Image.new("RGB", (W, H), col), 0.3), img, full)
        edge = ImageChops.subtract(full.filter(ImageFilter.MaxFilter(5)), full); img.paste(Image.new("RGB", (W, H), col), (0, 0), edge)
    d = ImageDraw.Draw(img)
    for r in rs:
        g, col = gid[(visit, r["label"], r["id"])]; t = f'{g} {r["label"]}'; f = font(13); tw = d.textlength(t, font=f)
        x = max(2, min(W - tw - 10, r["box"][0] + 3)); y = max(2, min(H - 20, r["box"][1] + 3))
        d.rounded_rectangle((x, y, x + tw + 8, y + 18), 5, fill=col); d.text((x + 4, y + 1), t, fill="white", font=f)
    return img
os.makedirs(f"{tmp}/out")
N = min(len(frames["move-in"]), len(frames["move-out"]))
for fi in range(N):
    a, b = draw("move-in", fi), draw("move-out", fi); W, H = a.size
    c = Image.new("RGB", (W * 2 + 12, H + 64), (29, 36, 51)); c.paste(a, (0, 52)); c.paste(b, (W + 12, 52)); d = ImageDraw.Draw(c)
    d.text((10, 8), "MOVE-IN walkthrough", fill="white", font=font(18)); d.text((W + 22, 8), "MOVE-OUT walkthrough", fill="white", font=font(18))
    d.text((10, 31), f"SAM 3.1 video tracking · same ID = same item across visits · frame {fi + 1}/{N} (5 fps)", fill=(200, 205, 215), font=font(13))
    d.text((10, H + 56 - 2), "", fill="white")
    d.text((W * 2 - 330, H + 54 - 6), "SIMULATED pan of Muse Image stills", fill=(255, 220, 120), font=font(13))
    c.save(f"{tmp}/out/{fi:03d}.png")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "5", "-i", f"{tmp}/out/%03d.png", "-vf", "format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", "24", "-preset", "slow", "-movflags", "+faststart", f"{V}/bedroom-tracked.mp4"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "5", "-i", f"{tmp}/out/%03d.png", "-vf", "scale=600:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64:stats_mode=diff[p];[s1][p]paletteuse=dither=none:diff_mode=rectangle", f"{V}/bedroom-tracked.gif"], check=True)
Image.open(f"{tmp}/out/{N // 2:03d}.png").convert("RGB").save(f"{V}/bedroom-tracked.jpg", quality=84)
T["matches"] = matches; json.dump(T, open(f"{V}/tracks.json", "w"), indent=1)
print(json.dumps(matches, indent=0)); print({f: os.path.getsize(f"{V}/{f}") for f in os.listdir(V)})
