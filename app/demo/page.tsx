import Board from "@/components/Board";
import data from "@/public/demo/sample.json";

export const metadata = { title: "Fair Wear: findings board" };
export default function Demo() {
  return (
    <main className="wrap">
      <a href="/">← Fair Wear</a>
      <h1 style={{ fontSize: 34, margin: "12px 0 0" }}>Findings board</h1>
      <Board property={data.property} findings={data.findings as any} banner="Sample board: a hand-labelled illustration of the output format, not model output. All scenes are simulated." />
    </main>
  );
}
