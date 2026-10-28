"""Extract object-level ground truth (labels + added/removed/moved) for the SceneDiff SD-V pairs we evaluate on.
SceneDiff is MIT-licensed (arXiv 2512.16908). Only labels are committed; videos stay local (not redistributed).
Usage: python3 scripts/scenediff-gt.py <scenediff_benchmark dir> <pick.json> > eval/scenediff/gt.json"""
import json, pickle, sys, os
root, pick = sys.argv[1], json.load(open(sys.argv[2]))
out = {}
for d in pick:
    seg = pickle.load(open(os.path.join(root, "data", d, "segments.pkl"), "rb"))
    objs = []
    for o in seg["objects"]:
        st = "added" if not o["in_video1"] else "removed" if not o["in_video2"] else "moved"
        objs.append({"label": o["label"], "status": st, "deformability": o.get("deformability")})
    vids = sorted(f for f in os.listdir(os.path.join(root, "data", d)) if f.lower().startswith("original_video"))
    out[d] = {"scene_type": seg.get("scene_type"), "videos": vids, "objects": objs}
print(json.dumps(out, indent=1))
