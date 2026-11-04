import { NextResponse } from "next/server";
import { buildPack, extractItems, judge, JudgeValidationError, matchItems } from "@/lib/pipeline";
import { MOCK } from "@/lib/pipeline/models";

export const maxDuration = 300;

export async function POST(req: Request) {
  // This public prototype serves a cached sample, never a pretend analysis of
  // caller input. Refuse before reading input or creating any placeholder pack.
  if (MOCK) {
    return NextResponse.json({
      mock: true,
      error: "analysis_unavailable",
      message: "Live analysis is unavailable in demo mode. Explore the precomputed sample instead. No evidence pack was generated.",
    }, { status: 503 });
  }
  const { property = "Demo flat", tenancyYears = 2, rooms = [] } = await req.json().catch(() => ({}));
  // rooms: [{ room, moveInUrl, moveOutUrl }]
  try {
    const findings = [];
    for (const r of rooms as { room: string; moveInUrl: string; moveOutUrl: string }[]) {
      const [b, a] = await Promise.all([extractItems(r.moveInUrl, "move_in", r.room), extractItems(r.moveOutUrl, "move_out", r.room)]);
      for (const p of matchItems(b, a)) findings.push(await judge(p, tenancyYears));
    }
    return NextResponse.json({ mock: MOCK, pack: await buildPack(property, findings) });
  } catch (error) {
    if (!(error instanceof JudgeValidationError)) throw error;
    return NextResponse.json({
      mock: MOCK,
      error: "judgement_unavailable",
      message: "A model response could not be validated. No findings or evidence pack were returned. Review the source evidence and retry the analysis.",
    }, { status: 502 });
  }
}
