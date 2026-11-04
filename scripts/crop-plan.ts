/** No image-registration verifier exists here. Equal dimensions or a fixed-camera
 * label are not registration evidence. Never transfer a box between source images. */
export function independentCropBoxes(before: number[], after: number[]) {
  const valid = (p: number[]) => p.length === 6 && p.every(Number.isFinite)
    && p[4] > 0 && p[5] > 0 && p[0] >= 0 && p[1] >= 0
    && p[2] > p[0] && p[3] > p[1] && p[2] <= p[4] && p[3] <= p[5];
  if (!valid(before) || !valid(after)) throw new Error("Invalid source-local crop bounds; comparison withheld.");
  return { before: before.slice(0, 4), after: after.slice(0, 4),
    registration: "unverified" as const, sharedCoordinates: false as const };
}
