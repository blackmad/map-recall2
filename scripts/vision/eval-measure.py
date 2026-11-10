# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow", "numpy", "opencv-python-headless", "scipy"]
# ///
"""Evaluate measure-facade.py (classic CV) on the eval set against (a) the placed
type's bays/storeys (truth.json) and (b) the hand-labelled gold subset
(gold-labels.json, keyed by index into truth.json), with constant baselines.

Usage: eval-measure.py EVAL_DIR   (EVAL_DIR from build-eval-set.py)
"""
import collections, importlib.util, json, os, sys, time
here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("mf", os.path.join(here, "measure-facade.py"))
mf = importlib.util.module_from_spec(spec); spec.loader.exec_module(mf)
d = sys.argv[1]
rows = json.load(open(os.path.join(d, "truth.json")))
gold = json.load(open(os.path.join(here, "gold-labels.json")))
res, ms = [], []
for x in rows:
    t = time.time(); o = mf.measure(os.path.join(d, x["file"]), x["ppm"]); ms.append((time.time() - t) * 1000); res.append(o)
n = len(rows)
def pct(a, b): return round(100 * a / b, 1)
print("N", n, "mean ms", round(sum(ms) / n), "median ms", sorted(ms)[n // 2])
print("vs placed-type truth: bays", pct(sum(o["bays"] == x["bays"] for o, x in zip(res, rows)), n),
      "storeys", pct(sum(o["storeys"] == x["storeys"] for o, x in zip(res, rows)), n))
print("width-only baseline bays (<=4.6 m -> 2 else 3)", pct(sum((2 if x["widthM"] <= 4.6 else 3) == x["bays"] for x in rows), n))
print("constant-4 baseline storeys vs truth", pct(sum(x["storeys"] == 4 for x in rows), n))
ks = sorted(gold, key=int)
gb = sum(res[int(k)]["bays"] == gold[k][0] for k in ks); gs = sum(res[int(k)]["storeys"] == gold[k][1] for k in ks)
print("vs gold (N=%d): bays" % len(ks), pct(gb, len(ks)), "storeys", pct(gs, len(ks)))
print("gold: width baseline bays", pct(sum((2 if rows[int(k)]["widthM"] <= 4.6 else 3) == gold[k][0] for k in ks), len(ks)),
      "constant-4 storeys", pct(sum(gold[k][1] == 4 for k in ks), len(ks)),
      "placed-type truth vs gold: bays", pct(sum(rows[int(k)]["bays"] == gold[k][0] for k in ks), len(ks)),
      "storeys", pct(sum(rows[int(k)]["storeys"] == gold[k][1] for k in ks), len(ks)))
print("bay confusion vs gold (gold,pred):", sorted(collections.Counter((gold[k][0], res[int(k)]["bays"]) for k in ks).items()))
print("storey confusion vs gold:", sorted(collections.Counter((gold[k][1], res[int(k)]["storeys"]) for k in ks).items()))
print("bay failures vs gold:", [(rows[int(k)]["file"], gold[k][0], res[int(k)]["bays"]) for k in ks if res[int(k)]["bays"] != gold[k][0]])
