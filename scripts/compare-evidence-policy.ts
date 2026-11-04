// Read-only, offline: prints a fixed-label comparator over the saved evidence.
import { evidenceCases } from "../lib/evidence/demo";
import { compareDamagePolicy } from "../lib/evidence/policy-baseline";
console.log(JSON.stringify({
  scope: "Fixed damage-label policy on saved crop observations, not a model comparison or ablation.",
  scoring: "Any matching crop counts for a planted item group. Unplanted flags count crop observations, not groups. Missing records stay absent. Confidence eligibility is unchanged.",
  ...compareDamagePolicy(evidenceCases),
}, null, 2));
