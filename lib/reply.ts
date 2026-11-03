import { defaultDecision, type Decision } from "./decisions";
import type { F } from "./findings";

/** Local, reviewable text only. This function neither sends a message nor agrees a sum. */
export function replyDraft(property: string, findings: F[], decisions: Record<string, Decision> = {}) {
  const included = findings.filter((f) => (decisions[f.id] ?? defaultDecision(f)) !== "Not claimed");
  const lines = included.map((f, i) => {
    const decision = decisions[f.id] ?? defaultDecision(f);
    const heading = `${i + 1}. ${f.room} ${f.item} [${f.id}]`;
    if (decision === "Dispute") {
      const reason = f.verdict === "fair_wear"
        ? "The comparison suggests ordinary wear; please explain why a deduction is proposed."
        : f.verdict === "cleaning" && /\bmou?ld\b/i.test(f.description)
          ? "Please provide evidence of the cause of the reported mould and who is responsible."
          : "Please provide dated evidence of the claimed change and why responsibility is attributed to me.";
      return `${heading}: Dispute. I dispute this proposed deduction. ${reason}`;
    }
    const item = f.verdict === "cleaning" ? "a reasonable cleaning charge" : "a reasonable contribution for this item";
    return `${heading}: Agree in principle, subject to evidence. I am open to ${item} if responsibility and cost are substantiated. Please provide the relevant inventory, dated comparison evidence and invoice or quote before any amount is agreed. For replacement costs, please also provide the item's age and condition and the basis of any allowance for prior use.`;
  });
  const source = findings.some((f) => f.provenance === "precomputed_generated_sample")
    ? "\nSOURCE: includes precomputed model findings from generated sample scenes. These sample findings are not an analysis of your property or files." : "";
  return `DRAFT FOR REVIEW — NOT SENT${findings.some((f) => f.simulated) ? "\nSIMULATED DEMO: not a reply about an actual tenancy." : ""}${source}\n\nRe: deposit deductions, ${property}\n\nPlease provide an itemised deduction list and the supporting evidence. My provisional responses are below. No amount is agreed in this draft.\n\n${lines.length ? lines.join("\n\n") : "No items are currently included in this draft."}\n\nI will review the evidence and costs before agreeing any deduction. Please do not treat model estimates or an illustrative useful-life percentage as an agreed amount.`;
}
