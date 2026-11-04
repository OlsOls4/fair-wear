import { type CaseDocument, type CaseImage, type CaseItem } from "./case-builder";
import { EVIDENCE_STATUS_LABELS, type EvidenceChecklist } from "./case-evidence-gaps";
import { imageDimensions } from "./image-dimensions";

export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;
export const BACKUP_FORMAT = "fair-wear-private-case";
const MAX_IMAGE_CHARACTERS = 5 * 1024 * 1024;
const fail = (): never => { throw new Error("This is not a supported Fair Wear private-case backup. Your current case has not changed."); };
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  if (Object.keys(value).some((key) => !keys.includes(key))) return fail();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length > max) return fail();
  return value;
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== "string" || !choices.includes(value as T)) return fail();
  return value as T;
}
function image(value: unknown): CaseImage | undefined {
  if (value === undefined) return undefined;
  const data = record(value, ["src", "origin", "sha256"]);
  if (data.origin !== "local") return fail();
  const src = text(data.src, MAX_IMAGE_CHARACTERS);
  // Never allow a remote URL, SVG, HTML, or arbitrary data MIME into an image sink.
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(src);
  if (!match || match[1].length % 4) return fail();
  const decoded = atob(match[1]);
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  const dimensions = imageDimensions(bytes, "image/jpeg");
  if (dimensions.width > 1600 || dimensions.height > 1600) return fail();
  // Prepared display JPEGs end in EOI; reject obvious truncation or appended payloads.
  if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return fail();
  const sha256 = data.sha256 === undefined ? undefined : text(data.sha256, 64);
  if (sha256 !== undefined && !/^[a-f0-9]{64}$/.test(sha256)) return fail();
  return { src, origin: "local", ...(sha256 ? { sha256 } : {}) };
}
const stringLimits = {
  id: 80, room: 100, item: 100, claimPounds: 15, claimDescription: 500, note: 5000,
  replacementCost: 15, ageAtMoveIn: 8, tenancyYears: 8, usefulLife: 8, qualityBasis: 500,
} as const;
function item(value: unknown): CaseItem {
  const data = record(value, [...Object.keys(stringLimits), "response", "costType", "evidenceChecklist", "before", "after"]);
  const strings = Object.fromEntries(Object.entries(stringLimits).map(([key, limit]) => [key, text(data[key], limit)])) as Pick<CaseItem, keyof typeof stringLimits>;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(strings.id)) return fail();
  let evidenceChecklist: EvidenceChecklist | undefined;
  if (data.evidenceChecklist !== undefined) {
    const evidence = record(data.evidenceChecklist, ["moveIn", "moveOut", "cost", "ageCondition"]);
    evidenceChecklist = Object.fromEntries(Object.entries(evidence).map(([key, value]) => [key, choice(value, Object.keys(EVIDENCE_STATUS_LABELS))]));
  }
  return { ...strings, response: choice(data.response, ["question", "discuss", "omit"]), costType: choice(data.costType, ["unknown", "replacement", "repair", "cleaning"]),
    ...(evidenceChecklist ? { evidenceChecklist } : {}), ...(data.before !== undefined ? { before: image(data.before) } : {}), ...(data.after !== undefined ? { after: image(data.after) } : {}) };
}
/** Local JSON only. Reconstruct allowlisted fields rather than spreading imported objects. */
export function parseCaseBackup(source: string): CaseDocument {
  if (new TextEncoder().encode(source).byteLength > MAX_BACKUP_BYTES) throw new Error("This backup is larger than 32 MB. Your current case has not changed.");
  try {
    const envelope = record(JSON.parse(source), ["format", "version", "case"]);
    if (envelope.format !== BACKUP_FORMAT || envelope.version !== 1) return fail();
    const data = record(envelope.case, ["mode", "title", "items", "photoContext"]);
    if (data.mode !== "personal" || !Array.isArray(data.items) || data.items.length < 1 || data.items.length > 12) return fail();
    const items = data.items.map(item);
    if (new Set(items.map((entry) => entry.id)).size !== items.length) return fail();
    return { mode: "personal", title: text(data.title, 200), photoContext: choice(data.photoContext, ["tenancy", "other"] as const), items };
  } catch { return fail(); }
}
export function serializeCaseBackup(document: CaseDocument): string {
  if (document.mode !== "personal") throw new Error("Editable backups are available for private cases only.");
  const source = JSON.stringify({ format: BACKUP_FORMAT, version: 1, case: { ...document, photoContext: document.photoContext ?? "tenancy" } });
  if (new TextEncoder().encode(source).byteLength > MAX_BACKUP_BYTES || document.items.some((item) => [item.before, item.after].some((photo) => photo && photo.src.length > MAX_IMAGE_CHARACTERS))) {
    throw new Error("This case has too much photo data for an editable backup (32 MB total; 5 MB per display photo). No backup was saved. Your case is still here. Keep your originals, then remove some display photos or replace them with smaller copies and try again. You can also export the evidence bundle before leaving.");
  }
  // Apply the same constraints at creation so every saved backup can be reopened.
  parseCaseBackup(source);
  return source;
}
