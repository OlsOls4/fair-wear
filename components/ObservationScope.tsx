/** Counts describe the retained historical fixture, not independent test cases. */
export default function ObservationScope({ className = "meta" }: { className?: string }) {
  return <p className={className} data-testid="observation-scope">
    The 20 findings are saved crop-pair observations covering 12 room/item groups, not 20 changes. Multiple crops can describe one item, including no-change results. The eight planted changes are eight item groups: seven have saved observations; bathroom sealant has none but stays in the denominator. Nine observations cover five groups without planted changes. <a href="/demo/flat-results.json">Saved findings</a> · <a href="/evidence/planted.json">Planted test intent</a>.
  </p>;
}
