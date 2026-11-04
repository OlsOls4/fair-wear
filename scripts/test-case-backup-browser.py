"""Local-only native browser test: generated fixture photos, no model calls or personal data."""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("FAIRWEAR_CASE_TEST_URL", "http://127.0.0.1:3342")
ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get("FAIRWEAR_CASE_TEST_OUTPUT", "/tmp/fair-wear-case-backup")); OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("FAIRWEAR_TEST_BROWSER_PATH", "/usr/bin/chromium"), headless=True, args=["--no-sandbox"])
    context = browser.new_context(viewport={"width": 1280, "height": 960}, accept_downloads=True)
    page = context.new_page(); errors = []; page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE + "/case-builder", wait_until="networkidle")
    page.get_by_role("button", name="Start a private case").click()
    page.get_by_label("Item", exact=True).fill("Synthetic test carpet")
    page.get_by_label("What should your response say?").fill("Synthetic local backup test, not real-user validation.")
    page.get_by_label("Move-in photo", exact=True).set_input_files(ROOT / "public/demo/flat/crops/bedroom-move_in-carpet-0.jpg")
    expect(page.get_by_text("Photo ready.", exact=False)).to_be_visible()
    requests = []; page.on("request", lambda request: requests.append(request.url))
    with page.expect_download() as download:
        page.get_by_role("button", name="Save editable backup").click()
    path = OUT / "case.fairwear.json"; download.value.save_as(path)
    backup = json.loads(path.read_text()); assert backup["case"]["items"][0]["before"]["src"].startswith("data:image/jpeg;base64,")
    page.on("dialog", lambda dialog: dialog.accept())
    page.reload(wait_until="networkidle"); requests.clear()
    page.get_by_label("Reopen private case backup").set_input_files(path)
    expect(page.get_by_label("Item", exact=True)).to_have_value("Synthetic test carpet")
    expect(page.get_by_text("Private case reopened locally.", exact=False)).to_be_visible()
    assert page.locator("img").evaluate_all("imgs => imgs.every(img => img.complete && img.naturalWidth > 0 && img.naturalWidth <= 1600)")
    assert not requests, requests
    bad = json.loads(path.read_text()); bad["case"]["items"][0]["before"]["src"] = "data:image/jpeg;base64,/9j/wAAICAABAAEA/9k="
    bad_path = OUT / "broken.fairwear.json"; bad_path.write_text(json.dumps(bad))
    page.get_by_label("Reopen private case backup").set_input_files(bad_path)
    expect(page.get_by_text("A backup photo could not be decoded safely.", exact=False)).to_be_visible()
    expect(page.get_by_label("Item", exact=True)).to_have_value("Synthetic test carpet")
    assert not requests, requests
    page.screenshot(path=str(OUT / "desktop.png"), full_page=True)
    page.set_viewport_size({"width": 390, "height": 844})
    page.get_by_role("heading", name="Pick up where you left off").scroll_into_view_if_needed()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.screenshot(path=str(OUT / "mobile.png"), full_page=True)
    assert not errors, errors
    browser.close()
print("Native download/reopen, decoded synthetic photo, broken JPEG recovery, no-network and mobile overflow checks passed.")
