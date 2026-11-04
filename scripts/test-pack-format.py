"""Offline formatter checks. Importing build-pack must not generate any artifacts."""
import importlib.util
import sys
sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location("pack", "scripts/build-pack.py")
pack = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pack)
legacy = {"verdict": "damage", "tenancyYears": 2, "apportionmentPct": 71, "usefulLifeYears": 7}
assert pack.share_label(legacy) == "Legacy estimate withheld: basis unknown"
assert pack.share_label({"verdict": "missing"}) == "Not estimated: inputs needed"
assert pack.share_label({"verdict": "cleaning", "apportionmentPct": 100}) == "Not applicable"
basis = {"usefulLifeYears": 7, "qualityBasis": "Illustrative assumption"}
assert pack.share_label({**legacy, "ageYears": 0, "calculationBasis": basis}) == "71% illustrative remaining life"
for value in [None, -1, float("nan"), float("inf"), True]:
    assert "withheld" in pack.share_label({**legacy, "ageYears": value, "calculationBasis": basis})
    assert "withheld" in pack.share_label({**legacy, "ageYears": 0, "calculationBasis": {**basis, "usefulLifeYears": value}})
assert "withheld" in pack.share_label({**legacy, "ageYears": 0, "calculationBasis": {**basis, "qualityBasis": " "}})
assert "withheld" in pack.share_label({**legacy, "ageYears": 0, "calculationBasis": {**basis, "usefulLifeYears": 0}})
assert pack.share_label({**legacy, "ageYears": 99, "calculationBasis": basis}) == "0% illustrative remaining life"
assert pack.share_label({**legacy, "verdict": "unresolved", "ageYears": 0, "calculationBasis": basis}) == "Not applicable"
assert "unresolved" in pack.VERDICT_ORDER
assert pack.VERDICT_LABELS["unresolved"] == "UNRESOLVED: NEEDS EVIDENCE"
print("Passed offline pack formatter checks; no artifacts generated.")

for value, expected in [(0.89999, "under 90%"), (0.9, "90%"), (0.894, "89.4%"), (0.99999, "over 99.99%"), (1, "100%"), (0, "0%"), (0.000001, "under 0.01%"), (None, "unavailable"), (True, "unavailable"), (-1, "unavailable"), (float("nan"), "unavailable"), (1.1, "unavailable")]:
    assert pack.confidence_label(value) == expected, (value, pack.confidence_label(value))
print("Passed confidence boundary and invalid-score checks.")
