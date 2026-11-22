"""Collect per run: seconds, peak memory, triangles, textures, placement -> artifacts/image-to-3d/results.json."""
import json, os, re, sys
A = sys.argv[1]
rows = []
for m in sorted(os.listdir(f"{A}/runs")):
    for k in sorted(os.listdir(f"{A}/runs/{m}")):
        d = f"{A}/runs/{m}/{k}"
        r = {"model": m, "input": k}
        if os.path.exists(f"{d}/timing.json"):  # TripoSR
            t = json.load(open(f"{d}/timing.json"))
            r["seconds"] = round(t["loadS"] + t["cutoutS"] + t["modelS"] + t["meshS"], 1)
            r["secondsExclLoad"] = round(t["cutoutS"] + t["modelS"] + t["meshS"], 1)
            tt = open(f"{d}/time.txt").read()
            mm = re.search(r"(\d+)\s+peak memory footprint", tt)
            r["peakGB"] = round(int(mm.group(1)) / 1e9, 1) if mm else None
        if os.path.exists(f"{d}/run.json"):
            t = json.load(open(f"{d}/run.json"))
            r.update(seconds=t["seconds"], peakGB=round(t["peakFootprintMB"] / 1024, 1), status=t["status"], error=t["error"], params=t.get("params"))
        if os.path.exists(f"{d}/placed/place.json"):
            p = json.load(open(f"{d}/placed/place.json"))
            r.update(triangles=p["triangles"], textures=p["textures"], vertexColours=p["vertexColours"], extentsM=p["extentsM"],
                     depthOverWidth=p["depthOverWidth"], widthErrorPct=p["widthErrorPct"])
        rows.append(r)
json.dump(rows, open(f"{A}/results.json", "w"), indent=1)
for r in rows:
    print(r["model"], r["input"], r.get("seconds"), r.get("peakGB"), r.get("triangles"), r.get("textures"), r.get("depthOverWidth"), r.get("widthErrorPct"), r.get("error") and r["error"][:80])
