"""Build a simulated evidence pack from cached findings, without model calls.
Set FAIRWEAR_DEMO_INPUT_DIR / FAIRWEAR_DEMO_OUTPUT_DIR for isolated validation.
Original cached artifacts are not rewritten unless the default output is used.
"""
import datetime
import json
import math
import os
from pathlib import Path
from xml.sax.saxutils import escape


VERDICT_ORDER = ["damage", "missing", "cleaning", "fair_wear", "added", "unresolved"]
VERDICT_LABELS = {"damage": "DAMAGE", "fair_wear": "FAIR WEAR & TEAR", "cleaning": "CLEANING", "missing": "MISSING", "added": "ADDED", "unresolved": "UNRESOLVED: NEEDS EVIDENCE"}


def finite_nonnegative(value):
    return isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0


def confidence_label(value):
    """Show threshold proximity without rounding a sub-90% score up to 90%."""
    if not finite_nonnegative(value) or value > 1:
        return "unavailable"
    rounded = round(value * 100, 2)
    if value < 0.9 and rounded >= 90:
        return "under 90%"
    if value < 1 and rounded >= 100:
        return "over 99.99%"
    if value > 0 and rounded == 0:
        return "under 0.01%"
    return f"{rounded:g}%"


def share_label(finding):
    """Never trust an old cached percentage without explicit calculation inputs."""
    if finding.get("verdict") not in ("damage", "missing"):
        return "Not applicable"
    basis = finding.get("calculationBasis") or {}
    age, tenancy, life = finding.get("ageYears"), finding.get("tenancyYears"), basis.get("usefulLifeYears")
    quality = basis.get("qualityBasis")
    if (not all(finite_nonnegative(v) for v in (age, tenancy, life)) or life <= 0
            or not isinstance(quality, str) or not quality.strip()):
        return "Legacy estimate withheld: basis unknown" if finding.get("apportionmentPct") is not None else "Not estimated: inputs needed"
    pct = math.floor(max(0, min(1, 1 - (age + tenancy) / life)) * 100 + 0.5)
    return f"{pct}% illustrative remaining life"


def main():
    from PIL import Image, ImageDraw, ImageFont
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle, PageBreak, KeepTogether
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    source = Path(os.environ.get("FAIRWEAR_DEMO_INPUT_DIR", "public/demo"))
    output = Path(os.environ.get("FAIRWEAR_DEMO_OUTPUT_DIR", "public/demo"))
    res = json.loads((source / "flat-results.json").read_text())
    reply = json.loads((source / "reply-draft.json").read_text())
    order, labels = VERDICT_ORDER, VERDICT_LABELS
    fl = sorted([f for f in res["findings"] if f["verdict"] != "no_change"], key=lambda f: order.index(f["verdict"]))
    assert len(fl) == len(reply["refs"]), "findings changed since reply draft was made; rerun make-reply.ts"
    for i, f in enumerate(fl):
        f["ref"] = f"E{i+1}"
        assert reply["refs"][i]["item"] == f["item"] and reply["refs"][i]["room"] == f["room"], "reply evidence references do not match"

    def font(size, bold=False):
        path = "/usr/share/fonts/truetype/dejavu/DejaVuSans" + ("-Bold" if bold else "") + ".ttf"
        return ImageFont.truetype(path, size) if os.path.exists(path) else ImageFont.load_default()

    def crop(url):
        # Existing /demo URLs can be resolved against an isolated input directory.
        path = source / url.removeprefix("/demo/") if url.startswith("/demo/") else Path(url) if Path(url).is_absolute() else Path("public") / url
        return Image.open(path).convert("RGB")

    (output / "cards").mkdir(parents=True, exist_ok=True)
    for f in fl:
        images = [crop(f[key]) if f.get(key) else Image.new("RGB", (480, 420), "#e4e0d6") for key in ("before", "after")]
        a, b = [im.resize((int(im.width * 420 / im.height), 420)) for im in images]
        width = a.width + b.width + 60
        card = Image.new("RGB", (width, 600), (250, 248, 244))
        draw = ImageDraw.Draw(card)
        card.paste(a, (20, 90)); card.paste(b, (40 + a.width, 90))
        draw.text((20, 18), f'{f["ref"]}  {f["room"]} {f["item"]} · {labels[f["verdict"]]}', fill="#1d2433", font=font(22, True))
        for key, x, title in (("before", 20, "MOVE-IN"), ("after", 40 + a.width, "MOVE-OUT")):
            draw.text((x, 62), title + (" (not supplied)" if not f.get(key) else ""), fill="#667085", font=font(18, True))
        draw.text((20, 525), "Simulated imagery. " + share_label(f), fill="#667085", font=font(16))
        draw.text((20, 552), "Illustrations are not tenant liability or agreed deductions.", fill="#667085", font=font(16))
        card.save(output / "cards" / f'{f["ref"]}.jpg', quality=88)

    ss = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=ss["BodyText"], fontSize=10, leading=14)
    small = ParagraphStyle("small", parent=body, textColor=colors.HexColor("#667085"), fontSize=8.5)
    paragraph = lambda text, style=body: Paragraph(escape(str(text)).replace("\n", "<br/>"), style)
    doc = SimpleDocTemplate(str(output / "fair-wear-evidence-pack.pdf"), pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=16*mm, bottomMargin=16*mm, title="Fair Wear evidence pack (simulated demo)", author="Fair Wear")
    story = [paragraph("Fair Wear: deposit evidence pack", ss["Title"]),
             paragraph(f'{res["property"]} · {res["tenancyYears"]}-year tenancy · generated {datetime.date.today():%d %B %Y}'),
             paragraph("DEMO PACK. Simulated imagery and model classifications are review aids, not evidence of liability or legal advice. Confidence is an uncalibrated model score, not a probability of correctness or responsibility.", small), Spacer(1, 8)]
    rows = [["Ref", "Item", "Verdict", "Calculation"]] + [[f["ref"], paragraph(f'{f["room"]} {f["item"]}', small), paragraph(labels[f["verdict"]].title(), small), paragraph(share_label(f), small)] for f in fl]
    table = Table(rows, colWidths=[15*mm, 55*mm, 38*mm, 55*mm], repeatRows=1)
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e4e0d6")), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e4e0d6")), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story += [table, Spacer(1, 6), paragraph("Remaining-life illustrations require explicit item age, tenancy length, expected lifespan and quality/condition assumptions. Generic lifespan examples and legacy percentages do not establish those facts. No percentage establishes responsibility, repair cost or a deduction. Cleaning is not shown as 100% liability.", small), Spacer(1, 10)]
    for f in fl:
        path = output / "cards" / f'{f["ref"]}.jpg'
        with Image.open(path) as image:
            height = 170*mm * image.height / image.width
        confidence = f.get("confidence")
        score_label = confidence_label(confidence)
        details = [paragraph(f'{f["ref"]} · {f["room"]} {f["item"]} · {labels[f["verdict"]].title()} · model confidence {score_label}'), RLImage(str(path), width=170*mm, height=height), paragraph(f["description"])]
        if f.get("calculationBasis"):
            details.append(paragraph(f'Supplied assumptions (unverified): age at move-in {f.get("ageYears", "unknown")}; tenancy years {f.get("tenancyYears", "unknown")}; lifespan years {f["calculationBasis"].get("usefulLifeYears", "unknown")}; quality/condition: {f["calculationBasis"].get("qualityBasis", "unknown")}.', small))
        details += [paragraph(share_label(f) + ". Responsibility and costs require separate evidence.", small), Spacer(1, 10)]
        story.append(KeepTogether(details))
    legacy = reply.get("calculationVersion") != 2
    story += [PageBreak(), paragraph("Original legacy reply (reference only)" if legacy else "Draft reply for review", ss["Heading2"]), paragraph("This original cached text predates the calculation safeguards. Any percentages, acceptance or liability language below are unverified historical output, not current advice or review selections. Do not send without rewriting." if legacy else "Model-generated draft. Check every statement and assumption before sending; no acceptance or liability is established by this pack.", small), Spacer(1, 6)]
    for text in reply["text"].split("\n\n"):
        story += [paragraph(text), Spacer(1, 4)]
    doc.build(story)
    (output / "cards.json").write_text(json.dumps({"cards": [{"ref": f["ref"], "card": f'/demo/cards/{f["ref"]}.jpg', "room": f["room"], "item": f["item"], "verdict": f["verdict"]} for f in fl]}, indent=1))
    print("ok", len(fl), output / "fair-wear-evidence-pack.pdf")


if __name__ == "__main__":
    main()
