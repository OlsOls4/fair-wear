import { JudgeValidationError } from "./judgement";
import { matchItems } from "./matching";
import type { EvidencePack, Finding, Item, MatchedPair, MatchingResult } from "./types";

type Dependencies = {
  extractItems: (url: string, visit: Item["visit"], room: string) => Promise<Item[]>;
  judge: (pair: MatchedPair, tenancyYears: number) => Promise<Finding>;
  buildPack: (property: string, findings: Finding[]) => Promise<EvidencePack>;
  mock: boolean;
};

/** Shared, injectable route orchestration: unresolved items never enter the judge/pack findings. */
export function createAnalyzeHandler(deps: Dependencies) {
  return async (req: Request) => {
    if (deps.mock) return Response.json({
      mock: true, error: "analysis_unavailable",
      message: "Live analysis is unavailable in demo mode. Explore the precomputed sample instead. No evidence pack was generated.",
    }, { status: 503 });
    try {
      const { property = "Demo flat", tenancyYears = 2, rooms = [] } = await req.json().catch(() => ({}));
      const findings: Finding[] = [];
      const correspondence: (MatchingResult & { room: string })[] = [];
      for (const r of rooms as { room: string; moveInUrl: string; moveOutUrl: string }[]) {
        const [b, a] = await Promise.all([
          deps.extractItems(r.moveInUrl, "move_in", r.room), deps.extractItems(r.moveOutUrl, "move_out", r.room),
        ]);
        const result = matchItems(b, a);
        correspondence.push({ room: r.room, ...result });
        for (const pair of result.pairs) findings.push(await deps.judge(pair, tenancyYears));
      }
      const pack = findings.length ? await deps.buildPack(property, findings) : {
        property, generatedAt: new Date().toISOString(), findings, replyDraft: "No supported comparisons were judged.",
      };
      const unresolvedCount = correspondence.reduce((n, r) => n + r.unresolved.length, 0);
      // Keep the review gap inside the pack too, so exporting only pack cannot silently lose it.
      return Response.json({ mock: deps.mock, pack: {
        ...pack, correspondence,
        replyDraft: unresolvedCount
          ? `Correspondence needs review for ${unresolvedCount} item observations. No added, missing, or condition verdict was made for these observations.\n\n${pack.replyDraft}`
          : pack.replyDraft,
      } });
    } catch (error) {
      if (!(error instanceof JudgeValidationError)) throw error;
      return Response.json({
        mock: deps.mock, error: "judgement_unavailable",
        message: "A model response could not be validated. No findings or evidence pack were returned. Review the source evidence and retry the analysis.",
      }, { status: 502 });
    }
  };
}
