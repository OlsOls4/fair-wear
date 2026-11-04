import { defaultDecision, type Decision } from "./decisions";
import type { F } from "./findings";

/** Local, reviewable text only. This function neither sends a message nor agrees a sum. */
export function replyDraft(property: string, findings: F[], decisions: Record<string, Decision> = {}) {
  const included = findings.filter((f) => (Object.hasOwn(decisions, f.id) ? decisions[f.id] : defaultDecision(f)) !== "Not claimed");
  const lines = included.map((f, i) => {
    const explicit = Object.hasOwn(decisions, f.id);
    const decision = explicit ? decisions[f.id] : defaultDecision(f);
    const heading = `${i + 1}. ${f.room} ${f.item} [${f.id}]`;
    if (decision === "Dispute") {
      const reason = f.verdict === "unresolved"
        ? "The available observations do not establish a change. Please provide comparable dated move-in and move-out evidence; an absent observation does not prove an item is missing or added."
        : f.verdict === "fair_wear"
        ? "The comparison suggests ordinary wear; please explain why a deduction is proposed."
        : f.verdict === "cleaning" && /\bmou?ld\b/i.test(f.description)
          ? "Please provide evidence of the cause of the reported mould and who is responsible."
          : "Please provide dated evidence of the claimed change and why responsibility is attributed to me.";
      return `${heading}: ${explicit ? "Dispute. I dispute this proposed deduction." : "Review pending. No reviewer response selected."} ${reason}`;
    }
    return `${heading}: ${explicit ? "Discuss after evidence. I am willing to discuss this proposed deduction after reviewing supporting evidence. I have not accepted responsibility or agreed an amount." : "Review pending. No reviewer response selected."} Please provide the relevant inventory, dated comparison evidence and invoice or quote before any amount is agreed. For replacement costs, please also provide the item's age and condition and the basis of any allowance for prior use.`;
  });
  const source = findings.some((f) => f.provenance === "precomputed_generated_sample")
    ? "\nSOURCE: includes real SAM 3.1 and Muse Spark pipeline outputs from an offline run on Muse Image-generated scenes. The models ran beforehand; no live model calls run here. These sample findings are not an analysis of your property or files." : "";
  return `DRAFT FOR REVIEW — NOT SENT${findings.some((f) => f.simulated) ? "\nDEMO DATA: not a reply about an actual tenancy." : ""}${source}\n\nRe: deposit deductions, ${property}\n\nPlease provide an itemised deduction list and the supporting evidence. Selected responses and evidence requests for unreviewed items are below. Untouched suggestions are not my decisions. No amount is agreed in this draft.\n\n${lines.length ? lines.join("\n\n") : "No items are currently included in this draft."}\n\nI will review the evidence and costs before agreeing any deduction. Please do not treat model estimates or an illustrative useful-life percentage as an agreed amount.`;
}
