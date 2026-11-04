import ArrowIcon from "@/components/ArrowIcon";
import Board from "@/components/Board";
import { demoData as data, demoFindings } from "@/lib/demo";
import reply from "@/public/demo/reply-draft.json";
import DemoEvaluation from "@/components/DemoEvaluation";

export const metadata = { title: "Sample review" };
export default function Demo() {
  return (
    <main id="main-content" className="wrap review-page">
      <div className="page-heading"><div><p className="eyebrow">The evidence desk / Generated sample</p><h1>Findings board</h1><p>Look closer. Question the model. Choose your response.</p></div><a className="text-link" href="/upload">About this comparison <ArrowIcon /></a></div>
      <DemoEvaluation />
      <Board allowEvidenceNavigation rememberSampleResponses property={data.property} findings={demoFindings} reply={reply.text} pdf="/demo/fair-wear-evidence-pack.pdf" banner="Generated test images · Real model results. Muse Image created the scenes; SAM 3.1 segmented items and Muse Spark classified changes in an earlier offline run. No live model calls or tenant data are used here." />
    </main>
  );
}
