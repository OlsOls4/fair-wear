"""Optional real-browser regression for /inspect; requires an allowed Chromium environment.
Start the production app, then FAIRWEAR_TEST_URL=http://127.0.0.1:3215 python scripts/test-evidence-browser.py.
No model calls. All source requests stay on the local server. This script does not publish anything.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = os.environ.get("FAIRWEAR_TEST_URL", "http://127.0.0.1:3215")
out = Path(os.environ.get("FAIRWEAR_TEST_ARTIFACTS", "/tmp/fair-wear-evidence-browser"))
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    launch = {"headless": True}
    if os.environ.get("FAIRWEAR_TEST_BROWSER_PATH"):
        launch["executable_path"] = os.environ["FAIRWEAR_TEST_BROWSER_PATH"]
    browser = p.chromium.launch(**launch)
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(base + "/inspect")
    detail = page.get_by_test_id("inspection-case")
    expect(detail).to_contain_text("82% self-reported confidence")
    page.screenshot(path=str(out / "desktop-overview.png"), full_page=True)
    page.get_by_text("Inspect full room inputs", exact=False).click()
    expect(detail.locator("img")).to_have_count(4)
    detail.get_by_label("Your review of this evidence").select_option("challenge")
    page.get_by_role("button", name="Evidence gap", exact=False).click()
    expect(detail).to_contain_text("A missing observation is not a missing item")
    page.get_by_role("button", name="Decoy called damage", exact=False).click()
    expect(detail.get_by_label("Your review of this evidence")).to_have_value("challenge")
    expect(page.locator("#inspect-case-title")).to_be_focused()
    page.get_by_role("button", name="≥ 90%", exact=True).click()
    expect(detail).to_contain_text("All observations withheld")
    expect(page.get_by_test_id("inspection-threshold-results")).to_contain_text("13/20")
    expect(page.get_by_test_id("inspection-threshold-results")).to_contain_text("2/8")
    page.get_by_role("button", name="All saved results", exact=True).click()
    page.get_by_role("button", name="Verify all 51 source files", exact=True).click()
    expect(page.get_by_test_id("inspection-integrity")).to_contain_text("All 51 source files match", timeout=30000)
    with page.expect_download() as event:
        page.get_by_role("button", name="Download inspection report (.json)", exact=True).click()
    event.value.save_as(out / "inspection.json")
    report = json.loads((out / "inspection.json").read_text())
    assert report["integrityCheck"]["state"] == "done"
    assert len(report["sources"]) == 51 and len(report["cases"]) == 13
    assert next(x for x in report["cases"] if x["caseId"] == "bedroom/carpet")["humanReview"] == "challenge"
    page.get_by_role("button", name="Verify all 51 source files", exact=True).click()
    expect(page.get_by_test_id("inspection-integrity")).to_contain_text("All 51 source files match", timeout=30000)
    detail.get_by_role("link", name="Open this crop’s finding on the board").click()
    expect(page).to_have_url(base + "/demo#finding=bedroom-carpet-0-0")
    selected = page.locator('[data-finding-id="bedroom-carpet-0-0"]')
    expect(selected).to_be_focused()
    expect(selected).to_contain_text("Inspection notes are not imported")
    selected.get_by_role("combobox").select_option("Not claimed")
    page.reload()
    expect(selected).to_be_focused()
    expect(selected.get_by_role("combobox")).to_have_value("Not claimed")
    page.go_back()
    expect(page).to_have_url(base + "/inspect")
    page.reload()
    expect(page.get_by_test_id("inspection-case").get_by_label("Your review of this evidence")).to_have_value("unreviewed")
    for width in [390, 320]:
        page.set_viewport_size({"width": width, "height": 844})
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), f"Overflow at {width}px"
        page.screenshot(path=str(out / f"mobile-{width}.png"), full_page=True)
    assert not errors, errors
    browser.close()
    print("Passed evidence-lab browser checks: source imagery, local review persistence, missing evidence, threshold sensitivity, native download, integrity verification, navigation, reload and mobile overflow.")
