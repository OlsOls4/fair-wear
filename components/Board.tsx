"use client";
import { useMemo, useState } from "react";

export interface F { id: string; room: string; item: string; verdict: string; confidence: number | null; description: string; usefulLifeYears?: number; tenancyYears: number; apportionmentPct?: number; guidanceNote?: string; simulated?: boolean; before?: string; after?: string }
const LABEL: Record<string, string> = { damage: "Damage", fair_wear: "Fair wear & tear", cleaning: "Cleaning", no_change: "No change", missing: "Missing", added: "Added" };
const ORDER = ["damage", "missing", "cleaning", "fair_wear", "added", "no_change"];

export function replyDraft(property: string, fs: F[]) {
  const lines = fs.filter((f) => f.verdict !== "no_change").map((f, i) => {
    const what = `${f.room} ${f.item}`;
    if (f.verdict === "fair_wear") return `${i + 1}. ${what}: I dispute any deduction. ${f.description}. This is fair wear and tear over a ${f.tenancyYears}-year tenancy (TDS fair wear and tear guide).`;
    if (f.verdict === "cleaning") return `${i + 1}. ${what}: I accept a reasonable cleaning charge. ${f.description}. Please send the invoice.`;
    if (f.verdict === "missing") return `${i + 1}. ${what}: ${f.description}. Please show where this was listed in the inventory.`;
    const share = f.apportionmentPct;
    return `${i + 1}. ${what}: ${f.description}. I accept responsibility only for the remaining useful life${f.usefulLifeYears ? ` (about ${f.usefulLifeYears} years; ${f.tenancyYears} already elapsed)` : ""}${share !== undefined ? `, which is ${share}% of a like-for-like repair` : ""}. Please send the invoice.`;
  });
  return `Re: deposit deductions, ${property}\n\nThank you for the deduction list. I have compared my dated move-in and move-out walkthrough videos item by item. My response:\n\n${lines.join("\n")}\n\nPlease provide invoices for all claimed costs. I am happy to use the deposit scheme's free dispute resolution if we cannot agree.`;
}

export default function Board({ property, findings, banner }: { property: string; findings: F[]; banner?: string }) {
  const [filter, setFilter] = useState("all");
  const [showReply, setShowReply] = useState(false);
  const counts = useMemo(() => { const c: Record<string, number> = {}; findings.forEach((f) => (c[f.verdict] = (c[f.verdict] ?? 0) + 1)); return c; }, [findings]);
  const shown = findings.filter((f) => filter === "all" || f.verdict === filter).sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict));
  return (
    <div>
      {banner && <div className="banner">{banner}</div>}
      <h2 style={{ margin: "8px 0" }}>{property}</h2>
      <div className="row">
        <button className={`chip ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>All ({findings.length})</button>
        {ORDER.filter((v) => counts[v]).map((v) => <button key={v} className={`chip ${filter === v ? "on" : ""}`} onClick={() => setFilter(v)}>{LABEL[v]} ({counts[v]})</button>)}
      </div>
      <div className="grid">
        {shown.map((f) => (
          <div className="card" key={f.id}>
            <span className={`badge v-${f.verdict}`}>{LABEL[f.verdict] ?? f.verdict}</span>
            <h3 style={{ marginTop: 8 }}>{f.item}</h3>
            <div className="room">{f.room}{f.simulated ? " · simulated" : ""}</div>
            {(f.before || f.after) && <div className="pair">{f.before && <figure style={{ margin: 0 }}><img src={f.before} alt="before" /><figcaption>Move-in</figcaption></figure>}{f.after && <figure style={{ margin: 0 }}><img src={f.after} alt="after" /><figcaption>Move-out</figcaption></figure>}</div>}
            <div>{f.description}</div>
            {f.apportionmentPct !== undefined && f.verdict !== "fair_wear" && f.verdict !== "no_change" && (<div className="meta">Tenant share if charged: <b>{f.apportionmentPct}%</b>{f.usefulLifeYears ? ` (${f.usefulLifeYears}-year life, ${f.tenancyYears} yrs elapsed)` : ""}<div className="bar"><i style={{ width: `${f.apportionmentPct}%` }} /></div></div>)}
            {f.verdict === "fair_wear" && <div className="meta">Not chargeable: ordinary wear over {f.tenancyYears} years.</div>}
            {f.guidanceNote && <div className="meta">{f.guidanceNote}</div>}
            {f.confidence != null && <div className="meta">Model confidence {Math.round(f.confidence * 100)}%</div>}
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 24 }}>
        <button className="btn" onClick={() => setShowReply((s) => !s)}>{showReply ? "Hide" : "Draft"} reply to landlord</button>
        <button className="btn" onClick={() => window.print()}>Print / save evidence pack</button>
      </div>
      {showReply && <pre className="reply">{replyDraft(property, findings)}</pre>}
    </div>
  );
}
