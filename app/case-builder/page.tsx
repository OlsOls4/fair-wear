import CaseBuilder from "@/components/CaseBuilder";
import { demoFindings } from "@/lib/demo";
import { sampleCaseItems } from "@/lib/case-builder";

export const metadata = { title: "Build your response", description: "Organise proposed deductions, review evidence and prepare a private, portable evidence bundle." };
export default function CaseBuilderPage() { return <CaseBuilder sampleItems={sampleCaseItems(demoFindings)} />; }
