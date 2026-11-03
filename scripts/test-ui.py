"""Optional browser regression checks against a running local production server.
Requires Python Playwright and Chromium. Set FAIRWEAR_TEST_BROWSER_PATH to use an
existing Chromium binary. No model calls or external-site interactions.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = os.environ.get("FAIRWEAR_TEST_URL", "http://127.0.0.1:3200")
artifacts = Path(os.environ.get("FAIRWEAR_TEST_ARTIFACTS", "/tmp/fair-wear-ui"))
artifacts.mkdir(parents=True, exist_ok=True)
checks = 0

def passed(label):
    global checks
    checks += 1
    print(f"ok {label}")

with sync_playwright() as p:
    launch = {"headless": True}
    if os.environ.get("FAIRWEAR_TEST_BROWSER_PATH"):
        launch["executable_path"] = os.environ["FAIRWEAR_TEST_BROWSER_PATH"]
    browser = p.chromium.launch(**launch)
    context = browser.new_context(viewport={"width": 1280, "height": 1000}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(f"{base}/demo")
    expect(page.locator("select")).to_have_count(20)
    summary = page.get_by_test_id("decision-summary")
    expect(summary).to_contain_text("Agree: 2")
    expect(summary).to_contain_text("Dispute: 5")
    expect(summary).to_contain_text("Not claimed: 13")
    passed("20 findings and exact requested default distribution")

    def response(item):
        return page.locator(f'[data-finding-id="{item}"] select')

    expect(response("bathroom-bath-0-0")).to_have_value("Dispute")
    expect(response("bedroom-carpet-0-0")).to_have_value("Dispute")
    expect(response("living-room-carpet-0-1")).to_have_value("Agree")
    expect(response("kitchen-oven-0-0")).to_have_value("Agree")
    passed("mould, uncertain damage, high-confidence damage and ordinary cleaning defaults")
    expect(page.locator('[data-finding-id="bedroom-carpet-0-0"]')).to_contain_text("planted test expected fair wear")
    expect(page.get_by_role("region", name="Published simulated evaluation")).to_contain_text("no finding card was produced")
    passed("known false positive and unsegmented miss disclosed")

    page.get_by_role("button", name="Show current draft", exact=True).click()
    draft = page.get_by_test_id("current-draft")
    expect(draft).to_contain_text("DRAFT FOR REVIEW")
    expect(draft).to_contain_text("No amount is agreed")
    assert "I accept 71%" not in draft.inner_text()
    assert "I accept 100%" not in draft.inner_text()
    passed("current draft has no automatic percentage admissions")

    response("kitchen-oven-0-0").select_option("Dispute")
    expect(draft).to_contain_text("[kitchen-oven-0-0]: Dispute.")
    page.get_by_role("button", name="Damage (4)", exact=True).click()
    expect(page.get_by_role("button", name="Damage (4)", exact=True)).to_have_attribute("aria-pressed", "true")
    expect(page.locator("select")).to_have_count(4)
    expect(draft).to_contain_text("[kitchen-oven-0-0]: Dispute.")
    page.get_by_role("button", name="All (20)", exact=True).click()
    expect(response("kitchen-oven-0-0")).to_have_value("Dispute")
    passed("choices survive filtering and hidden findings remain in draft")

    response("living-room-carpet-0-1").select_option("Not claimed")
    expect(draft).not_to_contain_text("[living-room-carpet-0-1]")
    response("bedroom-wall-0-1").select_option("Agree")
    expect(draft).to_contain_text("[bedroom-wall-0-1]: Agree in principle")
    page.get_by_role("button", name="Hide current draft", exact=True).click()
    page.get_by_role("button", name="Show current draft", exact=True).click()
    expect(draft).to_contain_text("[bedroom-wall-0-1]: Agree in principle")
    passed("manual Not claimed and no-change overrides respected after reply reopen")

    with page.expect_download() as download_event:
        page.get_by_role("button", name="Download current draft (.txt)", exact=True).click()
    downloaded = download_event.value
    downloaded.save_as(artifacts / "current-draft.txt")
    assert (artifacts / "current-draft.txt").read_text() == draft.inner_text()
    passed("downloaded text matches current decisions")
    context.grant_permissions(["clipboard-read", "clipboard-write"])
    page.get_by_role("button", name="Copy current draft", exact=True).click()
    expect(page.get_by_role("status")).to_contain_text("Draft copied")
    assert page.evaluate("navigator.clipboard.readText()") == draft.inner_text()
    passed("clipboard text matches current decisions")

    archive = page.get_by_role("region", name="Original precomputed demo artifacts")
    expect(archive).to_contain_text("do not include your selected responses")
    expect(archive.get_by_role("link")).to_have_attribute("href", "/demo/fair-wear-evidence-pack.pdf")
    archive.get_by_text("View original Muse Spark reply (unchanged)", exact=True).click()
    expect(archive).to_contain_text("I accept 71%")
    expect(draft).not_to_contain_text("I accept 71%")
    passed("unchanged archive is separate from the current draft")

    page.get_by_role("button", name="Reset suggested responses", exact=True).click()
    expect(response("kitchen-oven-0-0")).to_have_value("Agree")
    expect(response("living-room-carpet-0-1")).to_have_value("Agree")
    expect(response("bedroom-wall-0-1")).to_have_value("Not claimed")
    passed("reset restores all suggested defaults")

    card = page.locator('[data-finding-id="bedroom-carpet-0-0"]')
    enlarge = card.get_by_role("button", name="Enlarge move-in evidence for bedroom carpet", exact=True)
    enlarge.click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()
    expect(dialog.locator("img")).to_have_attribute("src", "/demo/flat/crops/bedroom-move_in-carpet-0.jpg")
    dialog.get_by_role("button", name="Move-out", exact=True).click()
    expect(dialog.locator("img")).to_have_attribute("src", "/demo/flat/crops/bedroom-move_out-carpet-0.jpg")
    page.screenshot(path=str(artifacts / "evidence-enlarged.png"))
    page.keyboard.press("Escape")
    expect(dialog).not_to_be_visible()
    expect(enlarge).to_be_focused()
    enlarge.click()
    page.get_by_role("dialog").get_by_role("button", name="Close", exact=True).click()
    expect(page.get_by_role("dialog")).not_to_be_visible()
    enlarge.click()
    page.mouse.click(2, 2)
    expect(page.get_by_role("dialog")).not_to_be_visible()
    passed("evidence enlarge, image switch, Escape, focus return, reopen, Close and backdrop dismissal")
    page.evaluate("window.scrollTo(0, 0)")
    page.screenshot(path=str(artifacts / "demo-desktop.png"))

    response("kitchen-oven-0-0").select_option("Dispute")
    page.reload()
    expect(response("kitchen-oven-0-0")).to_have_value("Agree")
    passed("reload resets decisions as disclosed")
    page.goto(base)
    expect(page.get_by_text("Simulated, precomputed prototype.", exact=False)).to_be_visible()
    page.get_by_role("link", name="Explore sample comparison", exact=True).click()
    expect(page.locator('input[type="file"]')).to_have_count(0)
    page.get_by_role("button", name="Show sample findings", exact=True).click()
    response("kitchen-oven-0-0").select_option("Dispute")
    page.get_by_role("button", name="Hide sample findings", exact=True).click()
    page.get_by_role("button", name="Show sample findings", exact=True).click()
    expect(response("kitchen-oven-0-0")).to_have_value("Dispute")
    passed("truthful sample flow has no file intake and preserves choices when hidden")
    page.go_back()
    expect(page.get_by_role("heading", name="Fair Wear", exact=True)).to_be_visible()
    page.go_forward()
    expect(page.get_by_role("heading", name="Explore a sample comparison", exact=True)).to_be_visible()
    passed("Back and Forward navigation works")

    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(f"{base}/demo")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.screenshot(path=str(artifacts / "demo-mobile.png"))
    response("bathroom-bath-0-0").select_option("Agree")
    page.get_by_role("button", name="Show current draft", exact=True).click()
    expect(page.get_by_test_id("current-draft")).to_contain_text("[bathroom-bath-0-0]: Agree in principle")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    passed("mobile layout has no horizontal overflow and decisions update draft")
    assert errors == [], errors
    passed("no browser JavaScript errors")
    print(json.dumps({"checks": checks, "browser_errors": errors, "artifacts": str(artifacts)}))
    browser.close()
