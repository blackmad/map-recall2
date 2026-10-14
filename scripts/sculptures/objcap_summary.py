"""Collect the multi-view (Object Capture) runs of the sculpture prototype into one pinned JSON:

    python3 -I scripts/sculptures/objcap_summary.py artifacts/sculpture-reconstruction scripts/sculptures/multiview-20261014.json

Per statue: the panorama views (pano id, capture time, distance, bearing; Gemeente Amsterdam, CC BY 4.0), the Commons
photos (title, author, licence, sha256), and every run under <id>/multiview/oc-*/ (report.json from objcap plus the
objcap_post.py summary where one was written). Standard library only.
"""
import glob
import json
import os
import sys

root, out = sys.argv[1], sys.argv[2]
summary = {"note": "Multi-view prototype 2026-10-14 (docs/sculpture-reconstruction-20261014.md, 'Multi-view: Object Capture'). Outputs are gitignored under artifacts/sculpture-reconstruction/<id>/.", "statues": {}}
for sdir in sorted(glob.glob(os.path.join(root, "*", "multiview"))):
    sid = sdir.split(os.sep)[-2]
    rec = {"panoramas": {}, "commons": [], "runs": {}}
    for pv in sorted(glob.glob(os.path.join(sdir, "panos*", "source.json"))):
        src = json.load(open(pv))
        rec["panoramas"][os.path.basename(os.path.dirname(pv))] = {
            "radiusM": src["radiusM"], "fovDeg": src["fovDeg"], "byYear": src["byYear"], "licence": src["licence"],
            "views": [{k: v.get(k) for k in ("file", "panoId", "timestamp", "distM", "bearingDeg", "statueHeightPx")} for v in src["views"]]}
    prov = os.path.join(sdir, "commons", "provenance.json")
    if os.path.exists(prov):
        rec["commons"] = [{k: p.get(k) for k in ("title", "local", "author", "licence", "licenceUrl", "date", "descriptionUrl", "sha256", "admitted")} for p in json.load(open(prov))]
    for rdir in sorted(glob.glob(os.path.join(sdir, "oc-*"))):
        rp = os.path.join(rdir, "report.json")
        if not os.path.exists(rp):
            continue
        r = json.load(open(rp))
        run = {k: r.get(k) for k in ("photos", "registered", "seconds", "status", "detail", "masking", "sensitivity", "error")}
        run["input"] = os.path.relpath(r["input"], sdir) if os.path.isabs(r["input"]) else r["input"]
        run["objTriangles"] = None
        for obj in glob.glob(os.path.join(rdir, "obj", "*.obj")):
            run["objTriangles"] = sum(1 for line in open(obj) if line.startswith("f "))
        posts = {}
        for pj in glob.glob(os.path.join(rdir, "*.json")):
            if os.path.basename(pj) in ("report.json", "poses.json"):
                continue
            p = json.load(open(pj))
            p.pop("registered", None)
            posts[os.path.basename(pj)[:-5]] = p
        if posts:
            run["post"] = posts
        rec["runs"][os.path.basename(rdir)] = run
    summary["statues"][sid] = rec
with open(out, "w") as f:
    json.dump(summary, f, indent=1, ensure_ascii=False)
    f.write("\n")
for sid, rec in summary["statues"].items():
    for name, r in rec["runs"].items():
        print(sid, name, r["photos"], r["registered"], r["seconds"], r["status"], r["detail"], r["objTriangles"], (r["error"] or "")[:70].replace("\n", " "))
