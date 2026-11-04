// Handwritten protocol fixtures. These are not captured model outputs or accuracy evidence.
import assert from "node:assert/strict";
import { readSamOutput, receiveSamOutput, SamResponseError } from "../lib/pipeline/sam-response";
import { parseSamLines } from "../lib/pipeline/models";
import { createAnalyzeHandler } from "../lib/pipeline/analyze";

globalThis.fetch = async () => { throw new Error("Network forbidden in SAM response regressions"); };
const event = (type: string, fields: object = {}) => `data: ${JSON.stringify({ type, ...fields })}\n\n`;
const complete = event("response.completed", { response: { status: "completed" } });
const line = "<0f>10<|box;x1=10;y1=20;x2=14;y2=24;w=100;h=80;c=0.75|><|mask;x=0;y=0;data=5,5,!fixture|>\n";
const delta = (text: string) => event("response.output_text.delta", { delta: text });
const finish = (text: string) => event("response.output_text.done", { text }) + complete;
let checks = 0;
function check(label: string, run: () => void) { run(); checks++; console.log(`ok ${label}`); }
check("a complete valid stream preserves sparse IDs and geometry", () => {
  const result = parseSamLines(readSamOutput(delta(line) + finish(line)));
  assert.equal(result.length, 1); assert.equal(result[0].id, 10); assert.deepEqual(result[0].box, [10, 20, 14, 24]);
});
check("deltas may split anywhere, including inside tokens", () => {
  for (let split = 0; split <= line.length; split++) assert.equal(readSamOutput(delta(line.slice(0, split)) + delta(line.slice(split)) + finish(line)), line);
});
check("completed zero matches is valid without any deltas", () => {
  assert.equal(readSamOutput(complete), "");
  assert.equal(readSamOutput(event("response.completed", { response: { output: [] } })), "");
  assert.equal(readSamOutput(event("response.completed", { response: { output: [{ type: "reasoning", summary: [] }] } })), "");
  assert.deepEqual(parseSamLines(readSamOutput(event("response.completed", { response: { status: "completed", output: [{ content: [{ type: "output_text", text: "" }] }] } }))), []);
});
check("SSE comments, CRLF, no-space and multiline data fields work", () => {
  assert.equal(readSamOutput(": heartbeat\r\n\r\n" + (delta(line) + finish(line)).replaceAll("data: ", "data:").replaceAll("\n", "\r\n")), line);
  assert.equal(readSamOutput('data: {"type":\ndata: "response.completed"}\n\n'), "");
});
check("lane finalizers do not duplicate deltas; aggregate output is ignored", () => {
  const done = event("response.output_text.done", { text: line });
  const content = event("response.content_part.done", { part: { type: "output_text", text: line } });
  const final = event("response.completed", { response: { status: "completed", output: [{ content: [{ type: "output_text", text: line }] }] } });
  for (const raw of [delta(line) + done + content + final, done + final]) assert.equal(readSamOutput(raw), line);
  assert.throws(() => readSamOutput(final), SamResponseError);
  const aggregate = event("response.completed", { response: { status: "completed", output: [{ content: [{ type: "output_text", text: "different aggregate" }] }] } });
  assert.equal(readSamOutput(delta(line) + done + aggregate), line);
  assert.throws(() => readSamOutput(delta(line) + aggregate), SamResponseError);
});
check("unrelated lifecycle and reasoning events cannot finalize output", () => {
  const reasoning = event("response.content_part.done", { part: { type: "reasoning_text", text: "not segmentation" } });
  assert.equal(readSamOutput(event("response.created") + reasoning + complete), "");
  assert.throws(() => readSamOutput(reasoning), SamResponseError);
});
check("HTTP-200 failure, incomplete and refusal events fail even after valid text", () => {
  for (const type of ["error", "response.failed", "response.incomplete", "response.refusal.delta", "response.refusal.done"]) {
    for (const prefix of ["", delta(line)]) assert.throws(() => readSamOutput(prefix + event(type) + complete), SamResponseError);
  }
  assert.throws(() => readSamOutput(event("response.content_part.done", { part: { type: "refusal", refusal: "no" } }) + complete), SamResponseError);
  assert.throws(() => readSamOutput(event("response.completed", { response: { output: [{ content: [{ type: "refusal" }] }] } })), SamResponseError);
});
check("EOF and DONE without completion never yield zero or partial detections", () => {
  for (const raw of ["", delta(line), "data: [DONE]\n\n", delta(line) + "data: [DONE]\n\n", event("response.output_text.done", { text: line })]) assert.throws(() => readSamOutput(raw), SamResponseError);
  assert.equal(readSamOutput(delta(line) + finish(line) + "data: [DONE]\n\n"), line);
});
check("malformed events and contradictory final output fail closed", () => {
  for (const raw of ["data: {\n\n" + complete, "data: null\n\n" + complete,
    event("response.output_text.delta", { delta: 1 }) + complete,
    delta(line) + event("response.output_text.done", { text: "" }) + complete,
    delta("") + event("response.output_text.done", { text: line }) + complete,
    event("response.output_text.done", { text: line }) + event("response.output_text.done", { text: line }) + complete,
    event("response.content_part.done", { part: { type: "output_text", text: line } }) + event("response.content_part.done", { part: { type: "output_text", text: line } }) + complete,
    complete + delta(line), complete + complete,
    event("response.completed", { response: { status: "failed" } }),
    event("response.completed", { response: "oops" }),
    event("response.completed", { response: null }),
    event("response.completed", { response: [] }),
    ...[{}, [{}], [null], [{ content: {} }], [{ content: [null] }], [{ content: [{ type: "output_text" }] }], [{ content: [{ type: "output_text", text: "unfinalized output" }] }], [{ type: "refusal" }]]
      .map(output => event("response.completed", { response: { output } })),
    ...[{ output_index: -1 }, { output_index: "0" }, { content_index: 0.5 }, { content_index: Number.MAX_SAFE_INTEGER + 1 }, { item_id: 123 }, { item_id: "" }, { item_id: " " }]
      .map(identity => event("response.output_text.delta", { delta: line, ...identity }) + finish(line)),
    event("response.output_text.delta", { delta: line, output_index: 0 }) + event("response.output_text.delta", { delta: line, output_index: 1 }) + complete,
  ]) assert.throws(() => readSamOutput(raw), SamResponseError);
});

async function main() {
  assert.equal(await receiveSamOutput(async () => new Response(delta(line) + finish(line))), line);
  for (const request of [
    async (): Promise<Response> => { throw new TypeError("private transport detail"); },
    async () => ({ text: async () => { throw new Error("private body detail"); } }) as unknown as Response,
  ]) await assert.rejects(receiveSamOutput(request), error => error instanceof SamResponseError && !error.message.includes("private"));
  let judgeCalls = 0, packCalls = 0;
  const handler = createAnalyzeHandler({ mock: false,
    extractItems: async () => { readSamOutput(delta(line)); return []; },
    judge: async () => { judgeCalls++; throw new Error("Must not judge incomplete segmentation"); },
    buildPack: async () => { packCalls++; throw new Error("Must not pack incomplete segmentation"); },
  });
  const body = { property: "Protocol fixture", context: "tenancy", tenancyYears: 2, rooms: [{
    room: "bedroom", moveInUrl: "fixture-a", moveOutUrl: "fixture-b", moveInDate: "2022-01-01", moveOutDate: "2024-01-01",
    provenance: "user_supplied_records", sameRoomConfirmed: true, sameItemsConfirmed: true,
  }] };
  const response = await handler(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }));
  assert.equal(response.status, 502);
  const result = await response.json();
  assert.equal(result.error, "segmentation_unavailable"); assert.equal("pack" in result, false);
  assert.equal(judgeCalls, 0); assert.equal(packCalls, 0);
  console.log(`Passed ${checks} SAM transport checks plus analysis failure containment; no network or model calls.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
