// Deposit adjudication guidance (England & Wales), encoded as data + deterministic maths.
// The LLM never does the arithmetic: Muse Spark classifies the change, this module apportions it.
// NOT legal advice. Sources (checked 30 Oct 2026):
//  - mydeposits Fair Wear & Tear checklist: "the consistent approach taken by all adjudicators for décor and carpets
//    starts at five years (in student properties it is closer to three years)"; other items are "case by case".
//  - DPS "In disputes – be fair": apportionment = residual lifespan / average lifespan x replacement cost
//    (worked example: £500 carpet, 2 years old, 5-year life).
// Lives marked "indicative" are our own working figures, not from a scheme table: treat them as a starting point.
import type { Verdict } from "./types";

export interface Ref { label: string; url: string }
export const SCHEME_REFS: Ref[] = [
  { label: "mydeposits: Fair wear and tear checklist (carpets and décor start at 5 years)", url: "https://www.mydeposits.co.uk/wp-content/uploads/2021/04/mydep_GEN-Fair-Wear-and-Tear-Checklist_EW_9708.pdf" },
  { label: "DPS: In disputes, be fair (betterment and apportionment formula)", url: "https://www.depositprotection.com/learning-centre/disputes/in-disputes-be-fair" },
  { label: "TDS: A guide to deposits, disputes and damages", url: "https://www.tenancydepositscheme.com/article/A-Guide-to-Deposits-Disputes-and-Damages" },
];
export const HELP_LINKS: Ref[] = [
  { label: "TDS: raising a dispute (free)", url: "https://www.tenancydepositscheme.com/article/Raising-a-Dispute" },
  { label: "DPS: dispute resolution for tenants (free)", url: "https://www.depositprotection.com/claims-and-disputes-for-tenants/tenant-dispute-resolution-process" },
  { label: "mydeposits: disputes for tenants (free)", url: "https://www.mydeposits.co.uk/tenants/disputes/" },
  { label: "Shelter: tenancy deposits", url: "https://england.shelter.org.uk/housing_advice/tenancy_deposits" },
  { label: "Citizens Advice: getting your deposit back", url: "https://www.citizensadvice.org.uk/housing/renting-privately/ending-your-tenancy/getting-your-tenancy-deposit-back/" },
];

type Notes = { wear: string; damage: string; cleaning: string };
export interface Guide { usefulLifeYears: number; source: "scheme" | "indicative"; notes: Notes }
const S = "scheme" as const, I = "indicative" as const;
const TABLE: Record<string, Guide> = {
  carpet: { usefulLifeYears: 5, source: S, notes: { wear: "Flattening, shading and fading in walkways are expected wear.", damage: "Burns, tears and stains that won't clean are damage, but the carpet's age still limits what can be charged.", cleaning: "Marks that a normal clean removes are a cleaning matter, not replacement." } },
  wall: { usefulLifeYears: 5, source: S, notes: { wear: "Small nail holes, light scuffs and fading are expected wear on décor.", damage: "Gouges, holes and large marks are damage; décor older than about 5 years would need repainting anyway.", cleaning: "Marks that wipe off are a cleaning matter." } },
  floor: { usefulLifeYears: 10, source: I, notes: { wear: "Light scuffing is wear.", damage: "Deep gouges are damage.", cleaning: "Dirt is a cleaning matter." } },
  "skirting board": { usefulLifeYears: 10, source: I, notes: { wear: "Light scuffs are wear.", damage: "Broken or gouged sections are damage.", cleaning: "Dust and marks are cleaning." } },
  door: { usefulLifeYears: 15, source: I, notes: { wear: "Minor handle wear is expected.", damage: "Holes and splits are damage.", cleaning: "Finger marks are cleaning." } },
  window: { usefulLifeYears: 20, source: I, notes: { wear: "Ageing seals are wear.", damage: "Cracked glass is usually damage.", cleaning: "Condensation marks and mould often come from ventilation or the building, so they are not automatically the tenant's fault." } },
  curtains: { usefulLifeYears: 5, source: I, notes: { wear: "Sun fading is wear.", damage: "Tears and burns are damage.", cleaning: "Stains that wash out are cleaning." } },
  worktop: { usefulLifeYears: 15, source: I, notes: { wear: "Light knife marks are wear.", damage: "Burns and deep cuts are damage.", cleaning: "Stains that clean off are cleaning." } },
  hob: { usefulLifeYears: 10, source: I, notes: { wear: "Faded markings are wear.", damage: "Cracked glass is damage.", cleaning: "Grease is a cleaning matter." } },
  oven: { usefulLifeYears: 10, source: I, notes: { wear: "Worn seals are wear.", damage: "Broken doors or racks are damage.", cleaning: "Grease and burnt-on food are a cleaning matter: a reasonable cleaning cost, not a new oven." } },
  fridge: { usefulLifeYears: 8, source: I, notes: { wear: "Yellowing plastic is wear.", damage: "Broken shelves are damage.", cleaning: "Defrost and clean at the end of the tenancy." } },
  sink: { usefulLifeYears: 15, source: I, notes: { wear: "Dulling is wear.", damage: "Chips and cracks are damage.", cleaning: "Limescale is cleaning." } },
  bath: { usefulLifeYears: 20, source: I, notes: { wear: "Surface dulling is wear.", damage: "Chips and cracks are damage.", cleaning: "Black mould on sealant usually points to condensation and ventilation first; it is not automatically the tenant's fault." } },
  sealant: { usefulLifeYears: 5, source: I, notes: { wear: "Sealant discolours and needs renewing every few years.", damage: "Cut or pulled-out sealant is damage.", cleaning: "Mould on sealant often comes from condensation and ventilation; ask what caused it before accepting a charge." } },
  "shower screen": { usefulLifeYears: 10, source: I, notes: { wear: "Light etching is wear.", damage: "Cracks are damage.", cleaning: "Limescale is cleaning." } },
  toilet: { usefulLifeYears: 15, source: I, notes: { wear: "Ageing is wear.", damage: "Cracks are damage.", cleaning: "A cleaning matter unless cracked." } },
  mattress: { usefulLifeYears: 7, source: I, notes: { wear: "Light sagging is wear.", damage: "Burns and tears are damage.", cleaning: "Stains that clean are cleaning." } },
  sofa: { usefulLifeYears: 8, source: I, notes: { wear: "Seat compression is wear.", damage: "Rips are damage.", cleaning: "Stains that clean are cleaning." } },
  table: { usefulLifeYears: 10, source: I, notes: { wear: "Light surface marks are wear.", damage: "Burns and deep scratches are damage.", cleaning: "Sticky marks are cleaning." } },
  wardrobe: { usefulLifeYears: 15, source: I, notes: { wear: "Light scuffs are wear.", damage: "Broken doors are damage.", cleaning: "Dust is cleaning." } },
};
const ALIAS: Record<string, string> = { curtain: "curtains", "kitchen worktop": "worktop", bathtub: "bath" };
const key = (label: string) => { const l = label.toLowerCase().trim(); return ALIAS[l] ?? l; };

/** The guidance note that matches the verdict (never a "this is wear" note under a Damage verdict). */
export function noteFor(label: string, verdict: Verdict | string): string {
  const g = TABLE[key(label)];
  if (!g) return "";
  if (verdict === "fair_wear" || verdict === "no_change") return g.notes.wear;
  if (verdict === "cleaning") return g.notes.cleaning;
  return g.notes.damage;
}
export function guidanceFor(label: string, verdict: Verdict | string = "damage") {
  const g = TABLE[key(label)];
  return { usefulLifeYears: g?.usefulLifeYears, source: g?.source, note: noteFor(label, verdict), refs: SCHEME_REFS.map((r) => r.label), links: SCHEME_REFS };
}
export const KNOWN_LABELS = Object.keys(TABLE);

/** Mould / condensation / damp: never auto-accepted, because the cause is often the building or ventilation. */
export const isMouldLike = (text: string) => /mou?ld|mildew|condensation|damp|black spots?/i.test(text);

/**
 * Share of a like-for-like cost a tenant could fairly bear, 0-100.
 * - fair_wear / no_change / added: 0. cleaning: 100 of a reasonable cleaning cost (not depreciated).
 * - damage / missing: remaining useful life / useful life (DPS formula). `ageAtMoveInYears` null = unknown:
 *   the result is the most the landlord could claim IF the item was new at move-in; they have to prove its age.
 * Returns undefined when the item's useful life is unknown ("needs a quote and proof of age").
 */
export function apportion(verdict: Verdict | string, label: string, tenancyYears: number, ageAtMoveInYears: number | null = null): number | undefined {
  if (verdict === "no_change" || verdict === "fair_wear" || verdict === "added") return 0;
  if (verdict === "cleaning") return 100;
  const life = guidanceFor(label).usefulLifeYears;
  if (!life) return undefined;
  const age = Math.max(0, ageAtMoveInYears ?? 0) + Math.max(0, tenancyYears);
  return Math.round(Math.max(0, Math.min(1, 1 - age / life)) * 100);
}

export interface Explained { pct?: number; life?: number; remaining?: number; ageKnown: boolean; amount?: number; formula: string; plain: string }
const yrs = (n: number) => `${Math.round(n * 10) / 10} year${Math.round(n * 10) / 10 === 1 ? "" : "s"}`;
const gbp = (n: number) => `£${n.toFixed(0)}`;

/** Plain-English apportionment, e.g. "The carpet had about 3 of its 5 years left, so at most 60% ..." */
export function explain(verdict: Verdict | string, label: string, tenancyYears: number, ageAtMoveInYears: number | null = null, claimed?: number): Explained {
  const item = label.toLowerCase();
  const ageKnown = ageAtMoveInYears !== null && ageAtMoveInYears !== undefined;
  if (verdict === "fair_wear" || verdict === "no_change") return { pct: 0, ageKnown, amount: claimed !== undefined ? 0 : undefined, formula: "fair wear and tear → 0%", plain: `Ordinary wear over ${yrs(tenancyYears)} is not chargeable, so you should pay nothing for the ${item}.` };
  if (verdict === "added") return { pct: 0, ageKnown, formula: "added item → nothing to apportion", plain: "Nothing to pay: this item was added, not damaged." };
  if (verdict === "cleaning") return { pct: 100, ageKnown, amount: claimed, formula: "cleaning → reasonable cleaning cost (not depreciated)", plain: `A reasonable cleaning cost only${claimed !== undefined ? ` (up to ${gbp(claimed)} if that is what cleaning costs)` : ""}, with an invoice. Never the price of a new ${item}.` };
  const g = guidanceFor(label);
  if (!g.usefulLifeYears) return { ageKnown, formula: "useful life unknown", plain: `No useful-life figure for the ${item}: ask for its age, a quote and an invoice before agreeing anything.` };
  const life = g.usefulLifeYears;
  const used = (ageAtMoveInYears ?? 0) + tenancyYears;
  const remaining = Math.max(0, life - used);
  const pct = Math.round((remaining / life) * 100);
  const amount = claimed !== undefined ? Math.round((claimed * pct) / 100) : undefined;
  const formula = `max(0, ${life} − (${ageKnown ? ageAtMoveInYears : "0 if new"} + ${tenancyYears})) ÷ ${life} = ${yrs(remaining).replace(/ years?/, "")}/${life} → ${pct}%`;
  const money = amount !== undefined ? ` (${gbp(amount)} of the ${gbp(claimed!)} claimed)` : "";
  const plain = remaining <= 0
    ? `The ${item} had reached the end of its ~${life}-year life, so the landlord would have had to replace it anyway: at most a small contribution, not a replacement.`
    : ageKnown
      ? `The ${item} had about ${yrs(remaining)} of its ~${life} years left, so at most ${pct}% of a like-for-like replacement${money}, and only with an invoice.`
      : `If the ${item} was brand new at move-in, it had about ${yrs(remaining)} of its ~${life} years left, so at most ${pct}% of a like-for-like replacement${money}. Its age is unknown: the landlord has to prove it (and show an invoice), and an older item means you pay less.`;
  return { pct, life, remaining, ageKnown, amount, formula, plain };
}
