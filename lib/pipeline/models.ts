// Thin wrappers over the Meta model APIs. Real endpoints are wired in once hackathon
// access is granted (26 Oct 2026). Until then MOCK=1 (default when no key) returns fixtures.
export const MOCK = !process.env.META_API_KEY || process.env.MOCK === "1";

export async function sam31Segment(frameUrl: string, prompts: string[]): Promise<{ label: string; maskRle: string; score: number }[]> {
  if (MOCK) return prompts.map((label) => ({ label, maskRle: "", score: 0.9 }));
  throw new Error("SAM 3.1 endpoint not wired yet");
}

export async function sam31Track(videoUrl: string, prompts: string[]): Promise<{ id: string; label: string; frames: number[] }[]> {
  if (MOCK) return prompts.map((label, i) => ({ id: `obj${i}`, label, frames: [0] }));
  throw new Error("SAM 3.1 video tracking not wired yet");
}

export async function museSparkJSON<T>(system: string, user: string, imageUrls: string[] = []): Promise<T> {
  if (MOCK) return {} as T;
  throw new Error("Muse Spark endpoint not wired yet");
}

export async function museImageCard(prompt: string, imageUrls: string[]): Promise<string> {
  if (MOCK) return "/sample-card.png";
  throw new Error("Muse Image endpoint not wired yet");
}
