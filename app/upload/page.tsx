"use client";
import { useState } from "react";
import Board, { type F } from "@/components/Board";

const STAGES = ["Sampling frames (1 fps, blur filter)", "SAM 3.1: segmenting and tracking items", "Matching items across visits", "Muse Spark: judging each change", "Muse Image: comparison cards"];
export default function Upload() {
  const [rooms, setRooms] = useState([{ room: "Bedroom", before: null as File | null, after: null as File | null }]);
  const [stage, setStage] = useState(-1);
  const [result, setResult] = useState<{ property: string; findings: F[]; mock: boolean } | null>(null);

  async function run() {
    setResult(null);
    for (let i = 0; i < STAGES.length; i++) { setStage(i); await new Promise((r) => setTimeout(r, 700)); }
    const res = await fetch("/demo/sample.json").then((r) => r.json());
    setStage(STAGES.length);
    setResult({ property: res.property, findings: res.findings, mock: true });
  }
  const ready = rooms.every((r) => r.before && r.after);
  return (
    <main className="wrap">
      <a href="/">← Fair Wear</a>
      <h1 style={{ fontSize: 34 }}>New comparison</h1>
      <div className="banner">Public demo mode: the live site never holds a model key, so uploads are not analysed here. The progress below shows the real pipeline stages and the board shows the pre-computed sample.</div>
      {rooms.map((r, i) => (
        <div className="card" key={i} style={{ marginBottom: 12 }}>
          <input value={r.room} onChange={(e) => setRooms(rooms.map((x, j) => (j === i ? { ...x, room: e.target.value } : x)))} style={{ fontSize: 16, padding: 6, marginBottom: 10 }} />
          <div>Move-in video: <input type="file" accept="video/*" onChange={(e) => setRooms(rooms.map((x, j) => (j === i ? { ...x, before: e.target.files?.[0] ?? null } : x)))} /></div>
          <div style={{ marginTop: 8 }}>Move-out video: <input type="file" accept="video/*" onChange={(e) => setRooms(rooms.map((x, j) => (j === i ? { ...x, after: e.target.files?.[0] ?? null } : x)))} /></div>
        </div>
      ))}
      <div className="row">
        <button className="chip" onClick={() => setRooms([...rooms, { room: `Room ${rooms.length + 1}`, before: null, after: null }])}>+ Add room</button>
        <button className="btn" disabled={!ready || (stage >= 0 && stage < STAGES.length)} onClick={run} style={{ opacity: ready ? 1 : 0.5 }}>Analyse</button>
      </div>
      {stage >= 0 && <ol style={{ lineHeight: 1.9 }}>{STAGES.map((s, i) => <li key={s} style={{ opacity: i <= stage ? 1 : 0.35 }}>{i < stage || stage === STAGES.length ? "✓" : i === stage ? "…" : "·"} {s}</li>)}</ol>}
      {result && <Board property={result.property} findings={result.findings} banner="Pre-computed sample, not an analysis of your files. All scenes simulated." />}
    </main>
  );
}
