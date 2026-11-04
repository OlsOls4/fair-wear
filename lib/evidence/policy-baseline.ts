import { analyzeEvidence, type EvidenceCase } from "./analysis";

/** Fixed-label counterfactual on saved observations, not fresh inference or an ablation.
 * Preserve cases, crop multiplicity, confidence eligibility and absent observations.
 * The planted labels are used only by the shared scorer, never to choose predictions.
 */
export function compareDamagePolicy(cases: EvidenceCase[]) {
  const summarize = (input: EvidenceCase[]) => {
    const result = analyzeEvidence(input);
    return {
      observations: result.observationCount,
      retainedObservations: result.retainedCount,
      plantedGroups: result.planted,
      detectedGroups: result.detected,
      exactLabelGroups: result.exactVerdict,
      damageGroups: result.damagePlanted,
      damageFound: result.damageFound,
      fairWearGroups: result.decoys,
      fairWearCalledDamage: result.decoysWronglyDamage,
      unplantedGroups: result.rows.filter(row => row.expected === null).length,
      unplantedObservations: result.unplantedItemsChecked,
      unplantedChangeFlags: result.falseAlarms,
      unplantedDamageFlags: result.rows.filter(row => row.expected === null)
        .reduce((count, row) => count + row.flagged.filter(o => o.verdict === "damage").length, 0),
      missingRecordGroups: result.missingRecords,
    };
  };
  const counterfactual = cases.map(group => ({ ...group,
    observations: group.observations.map(observation => ({ ...observation, verdict: "damage" })),
  }));
  return { recorded: summarize(cases), alwaysDamage: summarize(counterfactual) };
}
