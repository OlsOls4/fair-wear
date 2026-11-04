"""Real-browser case builder regression; local-only inputs and no model calls."""
from pathlib import Path
import hashlib, json, os, struct, tempfile
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("FAIRWEAR_CASE_TEST_URL", "http://127.0.0.1:3342")
OUT = Path(os.environ.get("FAIRWEAR_CASE_TEST_OUTPUT", "/tmp/fair-wear-case-builder")); OUT.mkdir(parents=True, exist_ok=True)
ROOT = Path(__file__).resolve().parents[1]
checks = []
def check(name):
    checks.append(name); print("ok", name, flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("FAIRWEAR_TEST_BROWSER_PATH", "/usr/bin/chromium"), headless=True, args=["--no-sandbox"])
    context = browser.new_context(viewport={"width":1440,"height":1100}, accept_downloads=True)
    page = context.new_page(); errors=[]; page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE+"/case-builder", wait_until="networkidle")
    expect(page.get_by_role("heading", name="A deduction is a claim. Build your response.")).to_be_visible()
    expect(page.get_by_test_id("case-summary")).to_contain_text("£910.00")
    expect(page.get_by_text("The evaluation disagrees.")).to_be_visible()
    page.screenshot(path=str(OUT/"sample-desktop.png"), full_page=True)
    check("sample opens with fictional £910 demand and known model error")
    page.get_by_label("What should your response say?").fill("REVIEW CORRECTION: ordinary planted wear, please explain replacement.")
    page.get_by_role("button", name="02 oven kitchen Question this deduction £80.00").click()
    page.get_by_label("Discuss after evidence", exact=True).check()
    expect(page.get_by_test_id("case-summary")).to_contain_text("£830.00")
    expect(page.get_by_test_id("case-summary")).to_contain_text("£80.00")
    page.get_by_role("button", name="03 bath bathroom Question this deduction £350.00").click()
    page.get_by_label("Leave out of response", exact=True).check()
    expect(page.get_by_test_id("case-summary")).to_contain_text("£480.00")
    expect(page.get_by_test_id("case-summary")).to_contain_text("1 item(s) left out")
    page.get_by_role("button", name="01 carpet bedroom Question this deduction £480.00").click()
    expect(page.get_by_label("What should your response say?")).to_have_value("REVIEW CORRECTION: ordinary planted wear, please explain replacement.")
    page.get_by_text("Explore cost assumptions", exact=False).click()
    for label,value in [("Replacement cost in pounds","600"),("Age at move-in in years","3"),("Tenancy length in years","2"),("Expected useful life in years","8"),("Quality and starting-condition basis","Illustrative assumptions only")]: page.get_by_label(label, exact=True).fill(value)
    expect(page.get_by_test_id("replacement-illustration")).to_contain_text("£225.00")
    page.get_by_label("Age at move-in in years", exact=True).fill("5")
    expect(page.get_by_test_id("replacement-illustration")).to_contain_text("£75.00")
    expect(page.get_by_label("Proposed amount in pounds", exact=True)).to_have_value("480")
    check("response choices persist across claims; illustrative value changes without changing claim")
    page.get_by_role("button",name="Preview response draft").click()
    expect(page.locator("#case-current-reply")).to_contain_text("REVIEW CORRECTION")
    expect(page.locator("#case-current-reply")).to_contain_text("willing to discuss")
    expect(page.locator("#case-current-reply")).not_to_contain_text("Replace bath")
    with page.expect_download() as download:
        page.get_by_role("button",name="Export current evidence bundle").click()
    sample_path=OUT/"sample-export.html"; download.value.save_as(str(sample_path))
    source=sample_path.read_text(); assert "REVIEW CORRECTION" in source and "Original verdict: damage" in source and "£75.00" in source and "Replace bath" not in source
    exportpage=context.new_page(); requests=[]; exportpage.on("request",lambda r:requests.append(r.url))
    exportpage.goto(sample_path.as_uri(),wait_until="networkidle")
    assert exportpage.locator("img").count()==4
    assert exportpage.locator("script").count()==0
    assert exportpage.locator("img").evaluate_all("xs => xs.every(x => x.complete && x.naturalWidth > 0)")
    assert not [r for r in requests if r.startswith(("http:","https:"))]
    exportpage.pdf(path=str(OUT/"sample-export.pdf"),format="A4",print_background=True)
    check("current HTML export has corrected note, original model output and photos; opens offline and prints PDF")
    # Mode change dismissal must preserve current work.
    def dismiss(dialog): dialog.dismiss()
    page.once("dialog",dismiss); page.get_by_role("button",name="Start a private case").click()
    expect(page.get_by_label("What should your response say?")).to_have_value("REVIEW CORRECTION: ordinary planted wear, please explain replacement.")
    page.once("dialog",lambda dialog:dialog.accept()); page.get_by_role("button",name="Start a private case").click()
    expect(page.get_by_text("Your case, kept in this tab.")).to_be_visible()
    expect(page.get_by_label("Room",exact=True)).to_have_value("")
    assert page.locator("img").count()==0
    check("mode-change cancellation preserves work; confirmed private mode clears all sample content")
    requests=[]; page.on("request",lambda r:requests.append({"url":r.url,"method":r.method,"body":r.post_data}))
    page.get_by_label("Room",exact=True).fill("My bedroom")
    page.get_by_label("Item",exact=True).fill("My carpet")
    page.get_by_label("Proposed amount in pounds",exact=True).fill("300.30")
    page.get_by_label("What is being claimed?",exact=True).fill("Replace carpet: private claim")
    page.get_by_label("What should your response say?").fill('PRIVATE NOTE <script>alert("test")</script>')
    first=ROOT/"public/demo/flat/bedroom-move-in.jpg"; second=ROOT/"public/demo/flat/bedroom-move-out.jpg"
    page.get_by_label("Move-in photo",exact=True).set_input_files(str(first))
    expect(page.get_by_role("status")).to_contain_text("Photo ready")
    page.get_by_label("Move-out photo",exact=True).set_input_files(str(second))
    expect(page.get_by_role("status")).to_contain_text("Photo ready")
    assert page.locator("img").count()==2
    assert page.locator("img").evaluate_all("xs => xs.every(x => x.src.startsWith('data:image/jpeg;base64,'))")
    with page.expect_download() as download:
        page.get_by_role("button",name="Export current evidence bundle").click()
    private_path=OUT/"private-export.html";download.value.save_as(str(private_path))
    assert not requests, requests
    private_html=private_path.read_text();assert hashlib.sha256(first.read_bytes()).hexdigest() in private_html
    assert "were not uploaded or analysed by AI" in private_html
    assert "&lt;script&gt;" in private_html
    privatepage=context.new_page();privatepage.goto(private_path.as_uri(),wait_until="networkidle")
    assert privatepage.locator("script").count()==0 and privatepage.locator("img").count()==2
    assert privatepage.locator("img").evaluate_all("xs => xs.every(x => x.complete && x.naturalWidth > 0)")
    page.screenshot(path=str(OUT/"private-desktop.png"),full_page=True)
    check("personal photo selection, note entry and export make zero network requests; hashes match originals; HTML is escaped")
    # Hostile headers are refused before decode, no app crash.
    png=bytearray(33);png[:8]=bytes([137,80,78,71,13,10,26,10]);png[8:12]=struct.pack(">I",13);png[12:16]=b"IHDR";png[16:20]=struct.pack(">I",100000);png[20:24]=struct.pack(">I",100000)
    page.get_by_label("Move-in photo",exact=True).set_input_files({"name":"oversized.png","mimeType":"image/png","buffer":bytes(png)})
    expect(page.get_by_role("status")).to_contain_text("24 megapixels")
    page.get_by_label("Move-in photo",exact=True).set_input_files({"name":"script.svg","mimeType":"image/svg+xml","buffer":b'<svg onload="alert(1)"/>'})
    expect(page.get_by_role("status")).to_contain_text("JPEG, PNG or WebP")
    assert page.locator("img").count()==2
    check("oversized image header and SVG are rejected without replacing existing photos")
    page.get_by_role("button",name="+ Add a deduction").click()
    page.get_by_label("Room",exact=True).fill("Kitchen")
    page.get_by_label("Item",exact=True).fill("Sink")
    page.get_by_label("Proposed amount in pounds",exact=True).fill("1.001")
    expect(page.get_by_label("Proposed amount in pounds",exact=True)).to_have_attribute("aria-invalid","true")
    expect(page.get_by_test_id("case-summary")).to_contain_text("1 included amount(s) unknown or invalid")
    page.get_by_label("Leave out of response",exact=True).check()
    expect(page.get_by_test_id("case-summary")).not_to_contain_text("unknown or invalid")
    check("invalid claim amount is excluded visibly; omitting item clears included unknown count")
    # Fresh mobile context tests initial render, controls and horizontal overflow.
    mobile=browser.new_context(viewport={"width":390,"height":844},device_scale_factor=1,is_mobile=True,has_touch=True)
    mp=mobile.new_page();mp.goto(BASE+"/case-builder",wait_until="networkidle")
    assert mp.evaluate("document.documentElement.scrollWidth <= window.innerWidth"),"Mobile horizontal overflow"
    mp.get_by_label("Discuss after evidence",exact=True).check()
    mp.get_by_role("button",name="Preview response draft").click()
    expect(mp.locator("#case-current-reply")).to_contain_text("willing to discuss")
    mp.screenshot(path=str(OUT/"sample-mobile.png"),full_page=True)
    check("390px mobile layout has no horizontal overflow; response and draft controls work")
    assert not errors, errors
    check("no uncaught browser errors")
    (OUT/"results.json").write_text(json.dumps({"checks":checks,"browser_errors":errors},indent=2))
    browser.close()
print(f"Passed {len(checks)} real-browser checks. Artifacts: {OUT}")
