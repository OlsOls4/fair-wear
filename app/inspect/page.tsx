import EvidenceLab from "@/components/inspection/EvidenceLab";
import "./inspection.css";
export const metadata = { title: "Inspect the evidence", description: "Inspect real recorded Meta model results on generated room images, challenge model mistakes, and verify source-file integrity without new model calls." };
export default function Inspect() {
  return <main id="main-content" className="inspect-wrap"><EvidenceLab /></main>;
}
