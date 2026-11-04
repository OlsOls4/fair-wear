import { demoEvaluation as ev } from "@/lib/demo";

export default function DemoEvaluation() {
  return <section id="sample-evaluation" className="evaluation-panel" aria-label="Published evaluation on generated imagery">
    <div className="evaluation-heading"><div><p className="eyebrow">The published test, including the misses</p><h2>Real pipeline evaluation: 4 generated rooms, 8 planted changes</h2></div><span className="sample-stamp">Not a real-world accuracy claim</span></div>
    <div className="evaluation-metrics">
      <div><strong>{ev.detected}<span>/{ev.planted}</span></strong><span>Changes detected</span></div>
      <div><strong>{ev.exactVerdict}<span>/{ev.planted}</span></strong><span>Exact verdicts</span></div>
      <div><strong>{ev.damageFound}<span>/{ev.damagePlanted}</span></strong><span>Damage correctly labelled</span></div>
      <div><strong>{ev.decoysWronglyDamage}<span>/{ev.decoys}</span></strong><span>Fair-wear decoys called damage</span></div>
      <div><strong>{ev.falseAlarms}<span>/{ev.unplantedItemsChecked}</span></strong><span>Unplanted crop observations flagged as changed</span></div>
    </div>
    <p className="meta">The {ev.unplantedItemsChecked} unplanted crop observations span five item groups. The one flagged observation was labelled fair wear, not damage; these are not nine independent items.</p>
    <p className="meta">These are results on generated scenes, not accuracy estimates for real homes or determinations of tenant responsibility. The disagreements with planted test intent are also flagged on matching finding cards. Planted intent is not independent annotation of the generated pixels.</p>
    <details className="evaluation-errors"><summary>Inspect label disagreements and missed planted changes <span aria-hidden="true">+</span></summary><ul>
      {ev.rows.filter((row) => !row.exact).map((row) => <li key={`${row.room}/${row.item}`}><b>{row.room} {row.item}:</b> planted {row.planted.replaceAll("_", " ")}; {row.got === "not_segmented" ? "no matched crop pair or judge result was saved, so no finding card was produced. The historical evaluator labelled this ‘not segmented’; raw segmentation traces were not saved, so the exact failure stage cannot be verified" : `model reported ${row.got.replaceAll("_", " ")}`}.</li>)}
      {ev.falseAlarmItems.map((item) => <li key={item}><b>False alarm:</b> {item.replaceAll("_", " ")}.</li>)}
    </ul></details>
  </section>;
}
