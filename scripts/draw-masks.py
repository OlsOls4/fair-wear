"""Draws the kept SAM 3.1 masks (scripts/save-masks.ts) as coloured, labelled outlines. Free (no model calls).
Outputs:
  public/demo/seg/<room>-<visit>.jpg        full room photo with every segmented item outlined + labelled
  public/demo/flat/pairs/<finding>-{in,out}[-seg].jpg   fixed 4:3 context crops around each matched pair (plain + mask)
and adds before43/after43/beforeSeg/afterSeg/sam fields to public/demo/flat-results.json.
Run: python3 scripts/draw-masks.py"""
import json, os, re
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

D = "public/demo"
recs = [r for r in json.load(open(f"{D}/seg/sam-records.json"))["records"] if (r.get("conf") or 1) >= 0.5 and r.get("maskW")]
PAL = {"wall": (43, 95, 180), "carpet": (214, 108, 0), "curtains": (122, 61, 184), "wardrobe": (0, 140, 120), "worktop": (214, 108, 0),
       "oven": (180, 35, 24), "hob": (122, 61, 184), "sink": (0, 140, 120), "bath": (43, 95, 180), "toilet": (0, 140, 120),
       "shower screen": (122, 61, 184), "sealant": (214, 160, 0)}
def font(sz, bold=True):
    p = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    return ImageFont.truetype(p, sz) if os.path.exists(p) else ImageFont.load_default()

def full_mask(r, W, H):
    m = Image.open(f"data/masks/{r['key']}.pgm").convert("L")
    canvas = Image.new("L", (W, H), 0); canvas.paste(m, (int(r["box"][0]), int(r["box"][1]))); return canvas

def overlay(img, rs, label=True, width=3):
    img = img.convert("RGB"); W, H = img.size
    tint = img.copy(); d = ImageDraw.Draw(img)
    for r in rs:
        col = PAL.get(r["label"], (43, 95, 180)); m = full_mask(r, W, H)
        fill = Image.new("RGB", (W, H), col)
        tint = Image.composite(Image.blend(tint, fill, 0.28), tint, m)
    img = tint; d = ImageDraw.Draw(img)
    for r in rs:
        col = PAL.get(r["label"], (43, 95, 180)); m = full_mask(r, W, H)
        edge = ImageChops.subtract(m.filter(ImageFilter.MaxFilter(width * 2 + 1)), m)
        img.paste(Image.new("RGB", (W, H), col), (0, 0), edge); d = ImageDraw.Draw(img)
        if label:
            x1, y1 = r["box"][0], r["box"][1]
            t = f'{r["label"]} #{r["id"]} {round((r.get("conf") or 1) * 100)}%'
            f = font(15); tw = d.textlength(t, font=f)
            bx, by = max(2, min(W - tw - 12, x1 + 4)), max(2, y1 + 4)
            d.rounded_rectangle((bx, by, bx + tw + 10, by + 22), 6, fill=col); d.text((bx + 5, by + 2), t, fill="white", font=f)
    return img

os.makedirs(f"{D}/seg", exist_ok=True)
for room in sorted({r["room"] for r in recs}):
    for visit, vs in (("move_in", "move-in"), ("move_out", "move-out")):
        img = Image.open(f"{D}/flat/{room}-{vs}.jpg")
        o = overlay(img, [r for r in recs if r["room"] == room and r["visit"] == visit])
        d = ImageDraw.Draw(o); d.text((12, o.height - 28), "SIMULATED (Muse Image) · masks: SAM 3.1", fill="white", font=font(15), stroke_width=2, stroke_fill="black")
        o.save(f"{D}/seg/{room}-{vs}.jpg", quality=82)

def key_from_crop(path):  # /demo/flat/crops/bedroom-move_in-carpet-0.jpg -> (room, visit, label, id)
    m = re.match(r".*/(.+)-(move_in|move_out)-(.+)-(\d+)\.jpg$", path); room, visit, label, i = m.groups()
    label = label.replace("_", " "); label = "curtains" if label == "curtain" else label
    return room, visit, label, int(i)
def find(room, visit, label, i):
    for r in recs:
        if r["room"] == room and r["visit"] == visit and r["label"] == label and r["id"] == i: return r
def crop43(img, box, pad=0.25, out=(640, 480)):
    W, H = img.size; x1, y1, x2, y2 = box; cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    w, h = (x2 - x1) * (1 + pad), (y2 - y1) * (1 + pad); w = max(w, h * 4 / 3, 240); h = w * 3 / 4
    if h > H: h = H; w = h * 4 / 3
    if w > W: w = W; h = w * 3 / 4
    l = min(max(0, cx - w / 2), W - w); t = min(max(0, cy - h / 2), H - h)
    return img.crop((int(l), int(t), int(l + w), int(t + h))).resize(out, Image.LANCZOS)

res = json.load(open(f"{D}/flat-results.json")); os.makedirs(f"{D}/flat/pairs", exist_ok=True); report = []
for f in res["findings"]:
    kb, ka = key_from_crop(f["before"]), key_from_crop(f["after"]); rb, ra = find(*kb), find(*ka)
    if not rb or not ra: report.append(f'{f["id"]}: no kept mask (before {bool(rb)}, after {bool(ra)})'); continue
    u = [min(rb["box"][0], ra["box"][0]), min(rb["box"][1], ra["box"][1]), max(rb["box"][2], ra["box"][2]), max(rb["box"][3], ra["box"][3])]
    # sanity: the original crop's aspect should match this union box if SAM returned the same objects
    oc = Image.open("public" + f["before"]); ar_old = oc.width / oc.height; ar_new = (u[2] - u[0]) / max(1, (u[3] - u[1]))
    ok = abs(ar_old - ar_new) / ar_new < 0.15
    report.append(f'{f["id"]}: union-box aspect {ar_new:.2f} vs original crop {ar_old:.2f} -> {"match" if ok else "DIFFERENT"}')
    base = f'{D}/flat/pairs/{f["id"]}'
    for tag, r, vs in (("in", rb, "move-in"), ("out", ra, "move-out")):
        img = Image.open(f'{D}/flat/{f["room"]}-{vs}.jpg').convert("RGB")
        crop43(img, u).save(f"{base}-{tag}.jpg", quality=84)
        crop43(overlay(img, [r], label=False, width=4), u).save(f"{base}-{tag}-seg.jpg", quality=84)
    f["before43"], f["after43"] = f'/demo/flat/pairs/{f["id"]}-in.jpg', f'/demo/flat/pairs/{f["id"]}-out.jpg'
    f["beforeSeg"], f["afterSeg"] = f'/demo/flat/pairs/{f["id"]}-in-seg.jpg', f'/demo/flat/pairs/{f["id"]}-out-seg.jpg'
    f["sam"] = {"before": {"key": rb["key"], "conf": rb.get("conf"), "box": rb["box"], "maskPx": rb["maskArea"]}, "after": {"key": ra["key"], "conf": ra.get("conf"), "box": ra["box"], "maskPx": ra["maskArea"]}, "sameObjectsAsJudgedRun": ok}
json.dump(res, open(f"{D}/flat-results.json", "w"), indent=1)
print("\n".join(report))
