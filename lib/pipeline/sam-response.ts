/** SAM transport validation. Offline fixtures test this boundary, not model accuracy. */
export class SamResponseError extends Error {
  readonly code = "SAM_RESPONSE_INVALID";
  constructor(message: string) { super(message); this.name = "SamResponseError"; }
}

/**
 * Read a complete SSE body, not a live chunk. An empty completed output is valid;
 * a failed, refused or cut-off response must never masquerade as zero detections.
 * Sources: https://dev.meta.ai/docs/sam/reading-segmentation
 *          https://github.com/meta-models/meta-sam/blob/main/protocol/sam3.md
 */
export function readSamOutput(raw: string): string {
  let text = "", completed = false, finalized: string | undefined;
  let lane: string | undefined;
  let sawDelta = false;
  const finalizers = new Set<string>();
  const checkLane = (ev: any) => {
    if (ev.output_index !== undefined || ev.content_index !== undefined || ev.item_id !== undefined) {
      for (const value of [ev.output_index, ev.content_index]) {
        if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new SamResponseError("SAM output-text lane index is malformed.");
      }
      if (ev.item_id !== undefined && (typeof ev.item_id !== "string" || !ev.item_id.trim())) throw new SamResponseError("SAM output-text item identity is malformed.");
      const key = JSON.stringify([ev.output_index, ev.content_index, ev.item_id]);
      if (lane !== undefined && lane !== key) throw new SamResponseError("SAM returned multiple output-text lanes.");
      lane = key;
    }
  };
  const finalize = (ev: any, value: unknown) => {
    if (completed || finalizers.has(ev.type)) throw new SamResponseError("SAM repeated a text finalizer or finalized after completion.");
    checkLane(ev);
    finalizers.add(ev.type);
    checkText(value);
  };
  const checkText = (value: unknown) => {
    if (typeof value !== "string") throw new SamResponseError("SAM output text is malformed.");
    if (finalized !== undefined && finalized !== value) throw new SamResponseError("SAM output snapshots disagree.");
    if (sawDelta && text !== value) throw new SamResponseError("SAM output snapshot disagrees with streamed text.");
    finalized = value;
  };
  // SSE allows CRLF, comments, data without a space, and multiple data fields.
  for (const block of raw.replace(/\r\n?/g, "\n").split("\n\n")) {
    const data = block.split("\n").filter(line => line.startsWith("data:"))
      .map(line => line.slice(5).replace(/^ /, "")).join("\n");
    if (!data) continue;
    if (data.trim() === "[DONE]") break;
    let ev: any;
    try { ev = JSON.parse(data); } catch { throw new SamResponseError("SAM stream contains malformed event JSON."); }
    if (!ev || typeof ev !== "object" || typeof ev.type !== "string") throw new SamResponseError("SAM stream event has no type.");
    if (["error", "response.failed", "response.incomplete", "response.refusal.delta", "response.refusal.done"].includes(ev.type)
      || (ev.type === "response.content_part.done" && ev.part?.type === "refusal")) {
      // Do not expose remote error text or source data in downstream API messages.
      throw new SamResponseError("SAM response failed, was incomplete, or was refused.");
    }
    if (ev.type === "response.output_text.delta" || ev.type === "response.output_text.done") {
      if (completed) throw new SamResponseError("SAM emitted text after completion.");
      checkLane(ev);
      if (ev.type === "response.output_text.delta") {
        if (finalized !== undefined || typeof ev.delta !== "string") throw new SamResponseError("SAM text delta is malformed or follows final text.");
        sawDelta = true;
        text += ev.delta;
      } else finalize(ev, ev.text);
    }
    if (ev.type === "response.content_part.done" && ev.part?.type === "output_text") finalize(ev, ev.part.text);
    if (ev.type === "response.completed") {
      if (completed || (ev.response?.status !== undefined && ev.response.status !== "completed")) throw new SamResponseError("SAM completion status is inconsistent.");
      if (ev.response !== undefined && (!ev.response || typeof ev.response !== "object" || Array.isArray(ev.response))) throw new SamResponseError("SAM completion payload is malformed.");
      // Aggregate output is not the output-text lane and must not repair or contradict it.
      // Public Meta docs allow completed empty output with no deltas. For nonempty
      // or delta-bearing lanes, require an explicit output-text finalizer.
      if ((sawDelta || text) && finalized === undefined) throw new SamResponseError("SAM completed before its output-text lane was finalized.");
      if (finalized === undefined && ev.response?.output !== undefined) {
        // Guard only the empty compatibility exception: aggregate data must never
        // turn known nonempty/refused/malformed output into "zero matches".
        // It still cannot supply parser input or reconcile an established lane.
        const output = ev.response.output;
        if (!Array.isArray(output)) throw new SamResponseError("SAM empty completion has malformed aggregate output.");
        for (const item of output) {
          if (!item || typeof item !== "object" || Array.isArray(item)
            || (item.content !== undefined && !Array.isArray(item.content))) throw new SamResponseError("SAM empty completion has malformed output items.");
          if (item.type === "refusal") throw new SamResponseError("SAM response was refused.");
          if (item.content === undefined && item.type !== "reasoning") throw new SamResponseError("SAM empty completion has no inspectable output content.");
          for (const part of item.content ?? []) {
            if (!part || typeof part !== "object" || typeof part.type !== "string") throw new SamResponseError("SAM empty completion has malformed content.");
            if (part.type === "refusal") throw new SamResponseError("SAM response was refused.");
            if (part.type === "output_text" && part.text !== "") throw new SamResponseError("SAM output text was not finalized as an empty lane.");
          }
        }
      }
      completed = true;
    }
  }
  if (!completed) throw new SamResponseError("SAM stream ended before response.completed.");
  return finalized ?? text;
}

/** Wrap request/body transport failures without exposing provider details or source media. */
export async function receiveSamOutput(request: () => Promise<Response>): Promise<string> {
  try { return readSamOutput(await (await request()).text()); }
  catch (error) {
    if (error instanceof SamResponseError) throw error;
    throw new SamResponseError("SAM request or response body did not complete.");
  }
}
