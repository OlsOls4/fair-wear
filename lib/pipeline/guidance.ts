// Typical useful-life figures used by UK deposit adjudicators when apportioning.
// Indicative only; verify against current TDS / DPS / mydeposits guidance before relying on them.
const TABLE: Record<string, number> = { carpet: 7, curtains: 5, wall: 4, mattress: 7, sofa: 8, worktop: 15, oven: 10, hob: 10, fridge: 8 };
export function guidanceFor(label: string) {
  return { usefulLifeYears: TABLE[label], refs: ["TDS guide: fair wear and tear", "DPS: deposit deductions guidance", "mydeposits: betterment and apportionment"] };
}
