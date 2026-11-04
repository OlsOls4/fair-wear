/** Input qualification, not authentication of dates, provenance, identity or model reasoning. */
export interface AnalysisRoom {
  room: string; moveInUrl: string; moveOutUrl: string;
  moveInDate: string; moveOutDate: string;
  provenance: "user_supplied_records";
  sameRoomConfirmed: true;
  sameItemsConfirmed: true;
}
export interface AnalysisRequest {
  property: string;
  context: "tenancy";
  tenancyYears: number;
  rooms: AnalysisRoom[];
}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const text = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0;
function date(x: unknown): x is string {
  if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const ms = Date.parse(x);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === x;
}
export function qualifyAnalysisRequest(input: unknown): { ok: true; value: AnalysisRequest } | { ok: false; reason: string } {
  if (!record(input) || input.context !== "tenancy") return { ok: false, reason: "Explicit tenancy context is required. Cleaning comparisons and unknown contexts are not supported by this tenancy analysis endpoint." };
  if (typeof input.tenancyYears !== "number" || !Number.isFinite(input.tenancyYears) || input.tenancyYears <= 0) return { ok: false, reason: "Supply a positive finite tenancyYears value; no tenancy length is inferred." };
  if (!text(input.property) || !Array.isArray(input.rooms) || !input.rooms.length) return { ok: false, reason: "Supply a property label and at least one room with dated evidence records." };
  for (const room of input.rooms) {
    if (!record(room) || !text(room.room) || !text(room.moveInUrl) || !text(room.moveOutUrl)) return { ok: false, reason: "Each room needs a label and both source references." };
    if (room.provenance !== "user_supplied_records" || room.sameRoomConfirmed !== true || room.sameItemsConfirmed !== true) return { ok: false, reason: "Attest that both records depict the same room and the items intended for comparison, and declare user-supplied record provenance. Unknown provenance cannot qualify." };
    if (!date(room.moveInDate) || !date(room.moveOutDate) || room.moveInDate >= room.moveOutDate) return { ok: false, reason: "Supply valid move-in and move-out dates in YYYY-MM-DD order. Missing, equal or reversed dates cannot qualify." };
  }
  return { ok: true, value: input as unknown as AnalysisRequest };
}
