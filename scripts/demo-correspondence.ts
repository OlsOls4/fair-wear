import { matchItems } from "../lib/pipeline/matching";
import type { Item } from "../lib/pipeline/types";

/** Record the full denominator before the crop runner selects two-sided comparisons. */
export function planDemoCorrespondence(room: string, before: Item[], after: Item[]) {
  const matching = matchItems(before, after);
  const pairs = matching.pairs.filter(x => x.before && x.after);
  return { pairs, report: {
    room, ...matching, judgedPairs: pairs.length,
    skippedOneSided: matching.pairs.filter(x => !x.before || !x.after),
    note: "Only accepted two-sided pairs are judged by this fixed-camera crop runner. Unresolved and one-sided observations are retained here, not counted as judged findings.",
  } };
}
