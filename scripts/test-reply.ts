// Offline regression checks. No model calls, network requests, or message sends.
import assert from "node:assert/strict";
import { DECISIONS, type Decision } from "../lib/decisions";
import type { F } from "../lib/findings";
import { replyDraft } from "../lib/reply";

let checks = 0;
function check(name: string, fn: () => void) {
  fn();
  checks++;
  console.log(`ok ${name}`);
}
function finding(id: string, verdict: string, confidence: number | null = 1, description = "Observed change."): F {
  return { id, verdict, confidence, description, room: "bedroom", item: "wall", tenancyYears: 2, usefulLifeYears: 4, apportionmentPct: 50 };
}
function itemLine(draft: string, id: string): string | undefined {
  return draft.split("\n").find((line) => line.includes(`[${id}]:`));
}
function assertDecision(draft: string, id: string, decision: Decision) {
  const line = itemLine(draft, id);
  if (decision === "Not claimed") assert.equal(line, undefined);
  else {
    assert.ok(line, `Missing item ${id}`);
    assert.ok(line.includes(`]: ${decision === "Agree" ? "Agree in principle, subject to evidence." : "Dispute."}`), line);
  }
}

const defaults: [F, Decision][] = [
  [finding("mould", "cleaning", 0.99, "Black mould on sealant."), "Dispute"],
  [finding("mold", "cleaning", 1, "MOLD on sealant."), "Dispute"],
  [finding("wear", "fair_wear", 1), "Dispute"],
  [finding("uncertain-damage", "damage", 0.899999), "Dispute"],
  [finding("cleaning", "cleaning", 0.2, "Grease on oven."), "Agree"],
  [finding("unchanged", "no_change", 0.2), "Not claimed"],
  [finding("threshold-damage", "damage", 0.9), "Agree"],
  [finding("certain-damage", "damage", 1), "Agree"],
  [finding("unknown-confidence", "damage", null), "Dispute"],
];
for (const [f, decision] of defaults) {
  check(`default ${f.id}: ${decision}`, () => assertDecision(replyDraft("Test property", [f]), f.id, decision));
}

// Every override must win over every verdict, including the otherwise excluded no_change.
for (const verdict of ["cleaning", "fair_wear", "damage", "no_change", "missing", "added"]) {
  for (const decision of DECISIONS) {
    const f = finding(`override-${verdict}`, verdict, 0.8, "Black mould on sealant.");
    check(`${verdict} manually overridden to ${decision}`, () => {
      assertDecision(replyDraft("Test property", [f], { [f.id]: decision }), f.id, decision);
    });
  }
}

check("repeated item labels have distinct IDs and independent decisions", () => {
  const fs = [finding("first-wall", "damage"), finding("second-wall", "damage"), finding("third-wall", "damage")];
  const draft = replyDraft("Test property", fs, { "first-wall": "Dispute", "second-wall": "Agree", "third-wall": "Not claimed" });
  assertDecision(draft, "first-wall", "Dispute");
  assertDecision(draft, "second-wall", "Agree");
  assertDecision(draft, "third-wall", "Not claimed");
  assert.match(itemLine(draft, "first-wall")!, /^1\./);
  assert.match(itemLine(draft, "second-wall")!, /^2\./);
});

check("mould dispute requests cause and responsibility evidence", () => {
  assert.match(replyDraft("Test property", [defaults[0][0]]), /evidence of the cause of the reported mould and who is responsible/i);
});

check("agreement is conditional and makes no percentage or liability admission", () => {
  const fs = [finding("damage", "damage"), finding("clean", "cleaning")];
  fs[0].description = "I accept 50% and admit liability.";
  const draft = replyDraft("Test property", fs);
  assert.doesNotMatch(draft, /\d+(?:\.\d+)?\s*%|I accept|I admit|I am responsible|I agree to pay/i);
  assert.match(draft, /if responsibility and cost are substantiated/i);
  assert.match(draft, /inventory, dated comparison evidence and invoice or quote/i);
  assert.match(draft, /No amount is agreed/i);
  assert.match(draft, /DRAFT FOR REVIEW.*NOT SENT/);
});

check("simulated data always carries a disclaimer, even when excluded", () => {
  const f = { ...finding("demo", "no_change"), simulated: true };
  assert.match(replyDraft("Demo", [f]), /SIMULATED DEMO: not a reply about an actual tenancy\./);
  assert.doesNotMatch(replyDraft("Real property", [finding("real", "damage")]), /SIMULATED DEMO/);
});

check("precomputed sample provenance survives text export", () => {
  const f: F = { ...finding("sample", "damage"), simulated: true, provenance: "precomputed_generated_sample" };
  const draft = replyDraft("Sample", [f]);
  assert.match(draft, /SOURCE: includes precomputed model findings from generated sample scenes/);
  assert.match(draft, /not an analysis of your property or files/);
  assert.doesNotMatch(replyDraft("Other", [finding("other", "damage")]), /SOURCE: includes precomputed/);
});

check("empty and fully excluded drafts have no item responses", () => {
  for (const draft of [replyDraft("Test", []), replyDraft("Test", [finding("excluded", "damage")], { excluded: "Not claimed" })]) {
    assert.match(draft, /No items are currently included/);
    assert.doesNotMatch(draft, /^\d+\. /m);
  }
});

check("input findings and overrides remain unchanged", () => {
  const fs = [finding("frozen", "damage")];
  const decisions: Record<string, Decision> = { frozen: "Dispute" };
  const before = JSON.stringify({ fs, decisions });
  Object.freeze(fs[0]);
  Object.freeze(fs);
  Object.freeze(decisions);
  replyDraft("Test property", fs, decisions);
  assert.equal(JSON.stringify({ fs, decisions }), before);
});

console.log(`Passed ${checks} reply checks.`);
