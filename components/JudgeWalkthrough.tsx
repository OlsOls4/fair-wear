import { evidenceFindingHref } from "@/lib/evidence-navigation";

/** Optional orientation only. Navigation never changes a review or imports case data. */
export default function JudgeWalkthrough() {
  return <details className="judge-walkthrough">
    <summary><strong>Try the full workflow</strong><span>Evidence → human review → a response you control</span></summary>
    <ol>
      <li><span className="eyebrow">01 / Inspect</span><h3>Look beyond the label.</h3><p>Compare the saved room images and item crops in the <a href="/inspect">Evidence lab</a>. Try the <a href="/inspect#inspect-threshold-heading">confidence threshold</a> and watch which signals disappear. It filters saved results; it does not rerun or improve the model.</p></li>
      <li><span className="eyebrow">02 / Decide</span><h3>Keep the human in charge.</h3><p><a href={evidenceFindingHref("bedroom-carpet-0-0")}>Review the bedroom carpet</a>: the model’s damage label disagrees with planted fair-wear intent. Inspect the evidence and choose your response. A model label is not a liability decision.</p></li>
      <li><span className="eyebrow">03 / Respond</span><h3>Ask for what is missing.</h3><p>Use <b>Continue to case builder</b> on the board to carry selected responses into the fictional case. Track missing records per deduction, edit your wording and export a local bundle. Or <a href="/case-builder">explore a fresh example case</a>.</p></li>
    </ol>
    <p className="judge-walkthrough-note">No sign-up or personal files needed. Lab notes stay separate from board responses. Case edits are not saved: export before leaving. Nothing is sent.</p>
  </details>;
}
