import { SamResponseError } from "./sam-response";

export interface SamRecord {
  frame: number;
  /** Decimal string: object identifiers need not fit JavaScript's number precision. */
  id: string;
  /** Half-open source-pixel bounds, converted from SAM's inclusive far corner. */
  box: [number, number, number, number];
  w: number; h: number; conf?: number;
  /** Original mask token fields. Encoded pixels are NOT decoded or verified here. */
  mask: string;
}
export interface SamWarning { code: "ignored_field" | "ignored_token" | "ignored_confidence"; key: string; line: number }
const fail = () => { throw new SamResponseError("SAM segmentation geometry is malformed; no detections were accepted."); };

/** Protocol-aware geometry boundary. Any malformed line invalidates the whole response.
 * https://github.com/meta-models/meta-sam/blob/main/protocol/sam3.md
 * Not a replacement for the official mask decoder: encoded pixels remain opaque.
 */
export function parseSamText(text: string, kind?: "image" | "video"): { records: SamRecord[]; warnings: SamWarning[] } {
  const records: SamRecord[] = [], warnings: SamWarning[] = [];
  const warned = new Set<string>();
  const warn = (code: SamWarning["code"], key: string, line: number) => {
    const identity = `${code}:${key}`;
    if (!warned.has(identity)) { warned.add(identity); warnings.push({ code, key, line }); }
  };
  const integer = (value: string | undefined, signed = false): number => {
    if (value === undefined || !(signed ? /^-?\d+$/ : /^\d+$/).test(value)) return fail();
    const n = Number(value);
    if (!Number.isSafeInteger(n)) return fail();
    return n === 0 ? 0 : n;
  };
  const fields = (raw: string, known: string[], line: number) => {
    const out = new Map<string, string | undefined>();
    const duplicates = new Set<string>();
    for (const field of raw.split(";")) {
      if (!field.trim()) continue;
      const eq = field.indexOf("=");
      const key = (eq < 0 ? field : field.slice(0, eq)).trim();
      const value = eq < 0 ? undefined : field.slice(eq + 1).trim();
      if (out.has(key)) duplicates.add(key);
      out.set(key, value);
      if (!known.includes(key)) warn("ignored_field", key, line);
    }
    if ([...duplicates].some(key => key !== "c")) return fail();
    return { out, duplicates };
  };
  const confidence = (f: ReturnType<typeof fields>, line: number): number | undefined => {
    if (!f.out.has("c")) return undefined;
    const raw = f.out.get("c");
    const value = raw === undefined ? NaN : Number(raw);
    if (f.duplicates.has("c") || raw === undefined || !/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)
      || !Number.isFinite(value) || value < 0 || value > 1) {
      warn("ignored_confidence", "c", line); return undefined;
    }
    return value === 0 ? 0 : value;
  };
  for (const [lineIndex, rawLine] of text.replace(/\r\n?/g, "\n").split("\n").entries()) {
    if (!rawLine.trim()) continue;
    const line = lineIndex + 1;
    const header = /^<(\d+)f(?:;([^>]*))?>/.exec(rawLine);
    if (!header) return fail();
    const frame = integer(header[1]);
    if (kind === "image" && frame !== 0) return fail();
    if (header[2]) for (const field of header[2].split(";")) if (field.trim()) warn("ignored_field", field.split("=")[0].trim(), line);
    let rest = rawLine.slice(header[0].length), count = 0;
    while (rest.length) {
      if (rest.startsWith(",")) rest = rest.slice(1);
      const id = /^\d+/.exec(rest)?.[0];
      if (!id) return fail();
      rest = rest.slice(id.length);
      const tokens = new Map<string, string>();
      while (rest.startsWith("<|")) {
        const token = /^<\|([A-Za-z][A-Za-z0-9_.-]*)(?:;([\s\S]*?))?\|>/.exec(rest);
        if (!token) return fail();
        const [, name, raw = ""] = token;
        if (name === "box" || name === "mask") {
          if (tokens.has(name)) return fail();
          tokens.set(name, raw);
        } else warn("ignored_token", name, line);
        rest = rest.slice(token[0].length);
      }
      if (!tokens.has("box") || !tokens.has("mask")) return fail();
      const box = fields(tokens.get("box")!, ["x1", "y1", "x2", "y2", "w", "h", "c"], line);
      const [x1, y1, x2, y2] = ["x1", "y1", "x2", "y2"].map(key => integer(box.out.get(key), true));
      const w = integer(box.out.get("w")), h = integer(box.out.get("h"));
      if (w <= 0 || h <= 0 || x1 < 0 || y1 < 0 || x2 < x1 || y2 < y1 || x2 >= w || y2 >= h) return fail();
      const conf = confidence(box, line);
      const mask = fields(tokens.get("mask")!, ["x", "y", "data", "c"], line);
      if (mask.out.get("x") !== "0" || mask.out.get("y") !== "0") return fail();
      const data = /^(\d+),(\d+),([!~])(.+)$/.exec(mask.out.get("data") ?? "");
      if (!data) return fail();
      const mh = integer(data[1]), mw = integer(data[2]);
      if (mh <= 0 || mw <= 0 || !Number.isSafeInteger(mh * mw)) return fail();
      // Alphabet/envelope only: no arithmetic decoding or mask/box alignment claim.
      if ([...data[4]].some(char => char < "!" || char > "{" || '\\",;<>|'.includes(char))) return fail();
      confidence(mask, line); // The mask's confidence may differ; it never replaces box confidence.
      records.push({ frame, id, box: [x1, y1, x2 + 1, y2 + 1], w, h, conf, mask: tokens.get("mask")! });
      count++;
    }
    if (!count) return fail();
  }
  return { records, warnings };
}

/** Compatibility helper; callers needing diagnostics should use parseSamText. */
export function parseSamLines(text: string): SamRecord[] { return parseSamText(text).records; }
