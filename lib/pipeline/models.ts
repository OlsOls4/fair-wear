// Meta Model API wrappers (base https://api.meta.ai/v1, Bearer MODEL_API_KEY).
// MOCK mode (no key or MOCK=1) returns fixtures so the UI works without credits.
const BASE = process.env.META_API_BASE ?? "https://api.meta.ai/v1";
const KEY = process.env.MODEL_API_KEY ?? process.env.META_API_KEY;
export const MOCK = !KEY || process.env.MOCK === "1";
export const SPARK_MODEL = process.env.SPARK_MODEL ?? "muse-spark-1.3";

const headers = () => ({ Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" });

async function post(path: string, body: unknown, accept = "application/json") {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(`${BASE}${path}`, { method: "POST", headers: { ...headers(), Accept: accept }, body: JSON.stringify(body) });
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 500 * 2 ** attempt + Math.random() * 250)); continue; }
    if (!r.ok) throw new Error(`${path} ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return r;
  }
  throw new Error(`${path}: retries exhausted`);
}

// ---------- SAM 3.1 ----------
export interface SamRecord { frame: number; id: number; box: [number, number, number, number]; w: number; h: number; conf?: number; mask: string }

// Parse the special-token wire format: "<Nf>id<|box;...|><|mask;...|>,id<|box..|><|mask..|>"
export function parseSamLines(text: string): SamRecord[] {
  const out: SamRecord[] = [];
  for (const line of text.split("\n")) {
    const fm = line.match(/^<(\d+)f>/);
    if (!fm) continue;
    const frame = +fm[1];
    const re = /(\d+)<\|box;([^|]*)\|><\|mask;([^|]*(?:\|(?!>)[^|]*)*)\|>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line.slice(fm[0].length)))) {
      const kv = Object.fromEntries(m[2].split(";").map((p) => p.split("=") as [string, string]));
      out.push({ frame, id: +m[1], box: [+kv.x1, +kv.y1, +kv.x2, +kv.y2], w: +kv.w, h: +kv.h, conf: kv.c ? +kv.c : undefined, mask: m[3] });
    }
  }
  return out;
}

async function samCall(prompt: string, media: { image_url?: string; video_url?: string; file_id?: string }, kind: "image" | "video") {
  const part = kind === "image" ? { type: "input_image", ...media } : { type: "input_video", ...media };
  const r = await post("/responses", {
    model: "sam-3.1",
    input: [{ type: "message", role: "user", content: [{ type: "input_text", text: prompt }, part] }],
    stream: false,
    metadata: { include_confidence: "true", mask_encoding: "one_bit" },
  });
  const j = await r.json();
  const text: string = j.output_text ?? (j.output ?? []).flatMap((o: any) => o.content ?? []).map((c: any) => c.text ?? "").join("\n");
  return parseSamLines(text ?? "");
}

export async function sam31Segment(imageUrl: string, concept: string): Promise<SamRecord[]> {
  if (MOCK) return [{ frame: 0, id: 0, box: [10, 10, 100, 100], w: 640, h: 360, conf: 0.9, mask: "" }];
  return samCall(concept, { image_url: imageUrl }, "image");
}

export async function sam31Track(video: { video_url?: string; file_id?: string }, concept: string): Promise<SamRecord[]> {
  if (MOCK) return [{ frame: 0, id: 0, box: [10, 10, 100, 100], w: 640, h: 360, conf: 0.9, mask: "" }];
  return samCall(concept, video, "video");
}

// ---------- Muse Spark (vision + structured output) ----------
export async function museSparkJSON<T>(system: string, user: string, imageUrls: string[] = [], schema?: Record<string, unknown>): Promise<T> {
  if (MOCK) return {} as T;
  const content: any[] = [{ type: "text", text: user }, ...imageUrls.map((url) => ({ type: "image_url", image_url: { url } }))];
  const r = await post("/chat/completions", {
    model: SPARK_MODEL,
    messages: [{ role: "system", content: system }, { role: "user", content }],
    response_format: schema ? { type: "json_schema", json_schema: { name: "out", schema, strict: true } } : { type: "json_object" },
  });
  const j = await r.json();
  return JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as T;
}

export async function museSparkText(system: string, user: string): Promise<string> {
  if (MOCK) return "";
  const r = await post("/chat/completions", { model: SPARK_MODEL, messages: [{ role: "system", content: system }, { role: "user", content: user }] });
  return (await r.json()).choices?.[0]?.message?.content ?? "";
}

// ---------- Muse Image ----------
export async function museImageCard(prompt: string): Promise<string> {
  if (MOCK) return "/sample-card.png";
  const r = await post("/images/generations", { model: "muse-image-1.0", prompt, n: 1 });
  const d = (await r.json()).data?.[0] ?? {};
  return d.url ?? (d.b64_json ? `data:image/png;base64,${d.b64_json}` : "");
}
