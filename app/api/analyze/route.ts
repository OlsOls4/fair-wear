import { buildPack, extractItems, judge } from "@/lib/pipeline";
import { createAnalyzeHandler } from "@/lib/pipeline/analyze";
import { MOCK } from "@/lib/pipeline/models";

export const maxDuration = 300;
export const POST = createAnalyzeHandler({ buildPack, extractItems, judge, mock: MOCK });
