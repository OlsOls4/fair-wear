// Stage 1: frame sampling (server / sandbox only — needs ffmpeg on PATH).
// Samples at `fps`, scores sharpness with variance of the Laplacian on a small grey
// copy, drops the blurriest frames and keeps the sharpest frame per window.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface SampledFrame { t: number; file: string; sharpness: number }

export function probeDuration(video: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video]).toString().trim();
  return Number(out) || 0;
}

export function laplacianVariance(grey: Uint8Array, w: number, h: number): number {
  let sum = 0, sum2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const v = 4 * grey[i] - grey[i - 1] - grey[i + 1] - grey[i - w] - grey[i + w];
    sum += v; sum2 += v * v; n++;
  }
  const mean = sum / n;
  return sum2 / n - mean * mean;
}

/** Grey thumbnails at `fps` (w=160) in one ffmpeg pass, for sharpness scoring. */
function greyThumbs(video: string, fps: number, w = 160): { frames: Uint8Array[]; w: number; h: number } {
  const probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:stream_side_data=rotation", "-of", "json", video]).toString();
  const s = JSON.parse(probe).streams[0];
  const rot = Math.abs(Number(s.side_data_list?.[0]?.rotation ?? 0)) % 180 === 90;
  const [vw, vh] = rot ? [s.height, s.width] : [s.width, s.height];
  const h = Math.round((w * vh) / vw / 2) * 2;
  const buf = execFileSync("ffmpeg", ["-v", "error", "-i", video, "-vf", `fps=${fps},scale=${w}:${h}`, "-pix_fmt", "gray", "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 });
  const frames: Uint8Array[] = [];
  for (let o = 0; o + w * h <= buf.length; o += w * h) frames.push(new Uint8Array(buf.buffer, buf.byteOffset + o, w * h));
  return { frames, w, h };
}

/**
 * Sample sharp keyframes. Scores at 4 fps, keeps the sharpest frame in each 1/fps window,
 * then drops windows whose best frame is below `minRel` x median sharpness (motion blur).
 */
export function sampleFrames(video: string, outDir: string, opts: { fps?: number; minRel?: number; width?: number } = {}): SampledFrame[] {
  const fps = opts.fps ?? 1, minRel = opts.minRel ?? 0.35, width = opts.width ?? 768;
  const scoreFps = 4;
  const { frames, w, h } = greyThumbs(video, scoreFps);
  const scores = frames.map((f) => laplacianVariance(f, w, h));
  const per = Math.max(1, Math.round(scoreFps / fps));
  const picks: { idx: number; s: number }[] = [];
  for (let i = 0; i < scores.length; i += per) {
    let best = i;
    for (let j = i; j < Math.min(i + per, scores.length); j++) if (scores[j] > scores[best]) best = j;
    picks.push({ idx: best, s: scores[best] });
  }
  const med = [...picks].map((p) => p.s).sort((a, b) => a - b)[Math.floor(picks.length / 2)] ?? 0;
  const keep = picks.filter((p) => p.s >= minRel * med);
  fs.mkdirSync(outDir, { recursive: true });
  return keep.map((p) => {
    const t = p.idx / scoreFps;
    const file = path.join(outDir, `t${t.toFixed(2).padStart(7, "0")}.jpg`);
    if (!fs.existsSync(file)) execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", video, "-frames:v", "1", "-vf", `scale=${width}:-2`, "-q:v", "3", file]);
    return { t, file, sharpness: p.s };
  });
}
