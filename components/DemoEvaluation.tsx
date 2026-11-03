import { demoEvaluation as ev } from "@/lib/demo";

export default function DemoEvaluation() {
  return <section className="card" style={{ margin: "12px 0" }} aria-label="Published evaluation on generated imagery">
    <b>Real pipeline evaluation: 4 generated rooms, 8 planted changes</b>
    <div className="meta">Detected {ev.detected}/{ev.planted} · exact verdict {ev.exactVerdict}/{ev.planted} · damage found {ev.damageFound}/{ev.damagePlanted} · fair-wear decoys called damage {ev.decoysWronglyDamage}/{ev.decoys} · false alarms on unplanted items {ev.falseAlarms}/{ev.unplantedItemsChecked}.</div>
    <p className="meta">These are results on generated scenes, not accuracy estimates for real homes or determinations of tenant responsibility. The known errors below are also flagged on matching finding cards.</p>
    <ul className="meta">
      {ev.rows.filter((row) => !row.exact).map((row) => <li key={`${row.room}/${row.item}`}>{row.room} {row.item}: planted {row.planted.replaceAll("_", " ")}; {row.got === "not_segmented" ? "not segmented, so no finding card was produced" : `model reported ${row.got.replaceAll("_", " ")}`}.</li>)}
      {ev.falseAlarmItems.map((item) => <li key={item}>False alarm: {item.replaceAll("_", " ")}.</li>)}
    </ul>
  </section>;
}
