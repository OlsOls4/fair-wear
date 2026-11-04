import run from "../../public/demo/flat-results.json";
import truth from "../../public/evidence/planted.json";
import manifest from "../../public/evidence/manifest.json";
import { buildEvidenceCases, analyzeEvidence } from "./analysis";
export const evidenceCases = buildEvidenceCases(run.findings, truth);
export const baselineEvidence = analyzeEvidence(evidenceCases);
export const evidenceManifest = manifest;
