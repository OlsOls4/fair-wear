import Board from "@/components/Board";
import { demoData as data, demoFindings } from "@/lib/demo";
import reply from "@/public/demo/reply-draft.json";
import DemoEvaluation from "@/components/DemoEvaluation";

export const metadata = { title: "Fair Wear: findings board" };
export default function Demo() {
  return (
    <main className="wrap">
      <a href="/">← Fair Wear</a>
      <h1 style={{ fontSize: 34, margin: "12px 0 0" }}>Findings board</h1>
      <DemoEvaluation />
      <Board property={data.property} findings={demoFindings} reply={reply.text} pdf="/demo/fair-wear-evidence-pack.pdf" banner="Generated test images · Real model results. Muse Image created the scenes; SAM 3.1 segmented items and Muse Spark classified changes in an earlier offline run. No live model calls or tenant data are used here." />
    </main>
  );
}
