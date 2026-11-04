import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { buildCaseHtml, caseReply, caseTotals, emptyCaseItem, moneyPence, pounds, replacementIllustration, sampleCaseItems, type CaseDocument, type CaseItem } from "../lib/case-builder";
import { embedCaseImages, localCaseImage, MAX_IMAGE_BYTES } from "../lib/case-images";
import { demoFindings } from "../lib/demo";

let checks = 0;
function test(name: string, fn: () => void) { fn(); checks++; console.log(`ok ${name}`); }
const png = "data:image/png;base64,iVBORw0KGgo=";
const sample = sampleCaseItems(demoFindings);
const document: CaseDocument = { mode: "sample", title: "Review of example deductions", items: sample.map((item) => ({ ...item, before: { src: png, origin: "sample" }, after: { src: png, origin: "sample" } })) };
const complete: CaseItem = { ...emptyCaseItem("calculation"), costType: "replacement", replacementCost: "480", ageAtMoveIn: "2", tenancyYears: "2", usefulLife: "8", qualityBasis: "Fictional demonstration assumption only" };

test("money is exact at pennies and blank is unknown", () => {
  assert.equal(moneyPence("0"), 0); assert.equal(moneyPence(" 480.20 "), 48020); assert.equal(moneyPence("0.01"), 1); assert.equal(moneyPence("1000000"), 100000000);
  for (const bad of ["", " ", "-1", "0.001", "1e2", "NaN", "Infinity", "1,000", "£1", "1000000.01", "<img>"]) assert.equal(moneyPence(bad), null, bad);
  assert.equal(pounds(48020), "£480.20");
});
test("sample amounts are fictional, initial responses question every item", () => {
  assert.equal(sample.length, 3); assert.equal(caseTotals(sample).question, 91000); assert.equal(caseTotals(sample).discuss, 0); assert.equal(sample[0].model!.confidence, 0.82); assert.ok(sample[0].model!.evaluationNote!.includes("fair wear"));
  assert.ok(sample.every((item) => !item.ageAtMoveIn && !item.usefulLife && !item.qualityBasis));
  assert.throws(() => sampleCaseItems([]), /Recorded sample finding missing/);
});
test("unknown, discussion, omitted and zero amounts are separate", () => {
  const items = [{ ...sample[0], claimPounds: "" }, { ...sample[1], response: "discuss" as const }, { ...sample[2], response: "omit" as const }];
  assert.deepEqual(caseTotals(items), { question: 0, discuss: 8000, unknown: 1, omitted: 1, included: 2 });
  assert.equal(caseTotals([{ ...sample[0], claimPounds: "0" }]).unknown, 0);
});
test("remaining-value illustration requires every explicit input", () => {
  assert.equal(replacementIllustration(complete).status, "illustrative");
  for (const key of ["replacementCost", "ageAtMoveIn", "tenancyYears", "usefulLife", "qualityBasis"]) assert.equal(replacementIllustration({ ...complete, [key]: "" }).status, "needs_inputs", key);
  assert.equal(replacementIllustration({ ...complete, usefulLife: "0" }).status, "needs_inputs");
  assert.equal(replacementIllustration({ ...complete, ageAtMoveIn: "-1" }).status, "needs_inputs");
  assert.equal(replacementIllustration({ ...complete, tenancyYears: "Infinity" }).status, "needs_inputs");
  assert.equal(replacementIllustration({ ...complete, usefulLife: "1001" }).status, "needs_inputs");
});
test("illustration caps at zero and never modifies claim totals", () => {
  const result = replacementIllustration(complete); assert.equal(result.status, "illustrative"); if (result.status === "illustrative") assert.equal(result.remainingPence, 24000);
  const old = replacementIllustration({ ...complete, ageAtMoveIn: "20" }); if (old.status === "illustrative") assert.equal(old.remainingPence, 0); else assert.fail();
  for (const type of ["repair", "cleaning", "unknown"] as const) assert.equal(replacementIllustration({ ...complete, costType: type }).status, "not_applicable");
  assert.equal(caseTotals([{ ...complete, claimPounds: "480" }]).question, 48000);
});
test("half-penny illustrations use exact decimal rounding", () => {
  for (const [cost, expected] of [["300.30", 13514], ["30.30", 1364], ["1000.30", 45014]] as const) {
    const value = replacementIllustration({ ...complete, replacementCost: cost, ageAtMoveIn: "11", tenancyYears: "0", usefulLife: "20" });
    assert.equal(value.status, "illustrative"); if (value.status === "illustrative") assert.equal(value.remainingPence, expected);
  }
  const fractional = replacementIllustration({ ...complete, replacementCost: "100", ageAtMoveIn: "0.1", tenancyYears: "0.2", usefulLife: "1" });
  if (fractional.status === "illustrative") assert.equal(fractional.remainingPence, 7000); else assert.fail();
});
test("review choices and notes propagate, omitted evidence disappears", () => {
  const altered = { ...document, items: document.items.map((item, i) => ({ ...item, response: i === 1 ? "discuss" as const : i === 2 ? "omit" as const : item.response, note: i === 0 ? "REVIEWER CORRECTION SENTINEL" : "" })) };
  const html = buildCaseHtml(altered), reply = caseReply(altered);
  assert.match(html, /REVIEWER CORRECTION SENTINEL/); assert.match(reply, /REVIEWER CORRECTION SENTINEL/); assert.match(reply, /willing to discuss/); assert.doesNotMatch(html, /bathroom-bath|Replace bath|Evidence 3/); assert.match(html, /2 included item\(s\).*1 omitted item\(s\)/);
  assert.match(html, /£480\.00/); assert.match(html, /£80\.00/); assert.match(html, /I have not accepted responsibility or agreed an amount/);
});
test("original model result stays intact beside human correction", () => {
  const html = buildCaseHtml(document);
  assert.match(html, /Original verdict: damage/); assert.match(html, /82% \(uncalibrated\)/); assert.match(html, /planted test expected fair wear/); assert.match(html, /Preserved model suggestion/);
  assert.match(html, /fictional examples, not a real landlord demand/); assert.match(caseReply(document), /DEMONSTRATION ONLY/);
});
test("HTML is script-free, self-contained and escapes all reviewer text", () => {
  const malicious = '</p><script>fetch("https://example.com")</script><img src=x onerror=alert(1)>';
  const html = buildCaseHtml({ ...document, title: malicious, items: [{ ...document.items[0], item: malicious, note: malicious, claimDescription: malicious }] });
  const parsed = new JSDOM(html).window.document;
  assert.equal(parsed.querySelectorAll("script").length, 0); assert.equal(parsed.querySelectorAll("img").length, 2); assert.equal(parsed.querySelectorAll("[onerror]").length, 0);
  assert.ok(parsed.querySelector('meta[http-equiv="Content-Security-Policy"]')!.getAttribute("content")!.includes("default-src 'none'"));
  for (const img of parsed.querySelectorAll("img")) assert.ok(img.src.startsWith("data:image/"));
  assert.match(html, /&lt;script&gt;/);
});
test("export rejects external, SVG and invalid image references", () => {
  for (const bad of ["https://example.com/photo.jpg", "/demo/flat/crops/x.jpg", "data:image/svg+xml;base64,PHN2Zz4=", 'data:image/png;base64,abc\" onerror=alert(1)']) assert.throws(() => buildCaseHtml({ ...document, items: [{ ...document.items[0], before: { src: bad, origin: "local" } }] }), /embedded JPEG/);
});
test("personal export never claims AI analysis or file authenticity", () => {
  const personal: CaseDocument = { mode: "personal", title: "My case", items: [{ ...emptyCaseItem("claim-1"), note: "My note", before: { src: png, origin: "local", sha256: "123abc" } }] };
  const html = buildCaseHtml(personal);
  assert.match(html, /were not uploaded or analysed by AI/); assert.match(html, /does not verify date, authorship or authenticity/); assert.match(html, /Move-out photo not provided/); assert.doesNotMatch(html, /Original verdict/);
});
test("full calculation exports assumptions and no settlement conclusion", () => {
  const html = buildCaseHtml({ ...document, items: [complete] });
  assert.match(html, /£240\.00/); assert.match(html, /Fictional demonstration assumption only/); assert.match(html, /not a suggested settlement or tenant liability/);
});
(async () => {
  const realFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Unexpected network use"); };
  const localDocument: CaseDocument = { mode: "personal", title: "Private", items: [{ ...emptyCaseItem("local"), before: { src: png, origin: "local" } }] };
  assert.equal(JSON.stringify(await embedCaseImages(localDocument)), JSON.stringify(localDocument)); checks++; console.log("ok personal photo export performs no fetch");
  const omitted = await embedCaseImages({ ...document, items: [{ ...sample[0], response: "omit" }] }); assert.equal(calls, 0); assert.equal(omitted.items[0].before, undefined); checks++; console.log("ok omitted sample photos are not fetched");
  await assert.rejects(embedCaseImages({ ...document, items: [{ ...sample[0], before: { src: "https://example.com/track", origin: "sample" } }] }), /Unexpected sample image/); assert.equal(calls, 0); checks++; console.log("ok sample loader rejects external source before fetch");
  globalThis.fetch = realFetch;
  await assert.rejects(localCaseImage({ type: "image/svg+xml", size: 100 } as File), /JPEG, PNG or WebP/);
  await assert.rejects(localCaseImage({ type: "image/jpeg", size: MAX_IMAGE_BYTES + 1 } as File), /8 MB/);
  await assert.rejects(localCaseImage({ type: "image/jpeg", size: 0 } as File), /8 MB/); checks++; console.log("ok local image type and size bounds");
  console.log(`${checks} case-builder checks passed. No model calls.`);
})();
