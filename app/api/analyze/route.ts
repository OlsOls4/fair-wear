import { NextResponse } from "next/server";
import { buildPack, extractItems, judge, matchItems } from "@/lib/pipeline";
import { MOCK } from "@/lib/pipeline/models";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { property = "Demo flat", tenancyYears = 2, rooms = [] } = await req.json().catch(() => ({}));
  // rooms: [{ room, moveInUrl, moveOutUrl }]
  const findings = [];
  for (const r of rooms as { room: string; moveInUrl: string; moveOutUrl: string }[]) {
    const [b, a] = await Promise.all([extractItems(r.moveInUrl, "move_in", r.room), extractItems(r.moveOutUrl, "move_out", r.room)]);
    for (const p of matchItems(b, a)) findings.push(await judge(p, tenancyYears));
  }
  return NextResponse.json({ mock: MOCK, pack: await buildPack(property, findings) });
}
