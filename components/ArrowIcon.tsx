/** Decorative arrows use SVG so they do not depend on the device's symbol fonts. */
export default function ArrowIcon({ direction = "diagonal" }: { direction?: "diagonal" | "down" | "turn" }) {
  const path = direction === "down" ? "M8 2v12m-5-5 5 5 5-5" : direction === "turn" ? "M3 2v8h10m-4-4 4 4-4 4" : "M3 13 13 3M4 3h9v9";
  return <svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}><path d={path} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
