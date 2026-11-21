"""Re-score an owl-probe.py run (on the reconstructed gold crops) against gold-crops.json, both label columns,
with owl-eval.py's storeys rule and split-half protocol. Usage: python3 owl-rescore.py OWL_JSON"""
import json, os, sys, importlib.util, io, contextlib
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
g = json.load(open(os.path.join(HERE, "gold-crops.json")))
o = json.load(open(sys.argv[1]))
# reuse nms/cluster from owl-eval.py without running its module body
src = open(os.path.join(HERE, "..", "owl-eval.py")).read()
ns = {"np": np}
exec(src[src.index("def nms"):src.index("ks=sorted")], ns)
nms, cluster = ns["nms"], ns["cluster"]


def meas2(d, thr, rg, mr):
    ppm = 40
    bx = [b for b, s in zip(d["boxes"], d["scores"]) if s >= thr]
    sc = [s for s in d["scores"] if s >= thr]
    k = nms(bx, sc); bx = [bx[i] for i in k]
    c = [((b[1] + b[3]) / 2 / ppm) for b in bx if 0.4 <= (b[2] - b[0]) / ppm <= 3.0 and 0.6 <= (b[3] - b[1]) / ppm <= 4.5]
    return len([x for x in cluster(c, rg) if len(x) >= mr])


ks = sorted(g, key=int)
dev, test = ks[::2], ks[1::2]
grid = [(t, rg, mr) for t in (0.08, 0.1, 0.12, 0.15) for rg in (0.8, 1.0, 1.2, 1.6) for mr in (2, 3)]
out = {}
for lab in ("storeys", "storeysV2"):
    dk = [k for k in dev if g[k][lab] is not None]; tk = [k for k in test if g[k][lab] is not None]
    A = lambda kk, p: float(np.mean([meas2(o[k], *p) == g[k][lab] for k in kk]))
    bd = max(grid, key=lambda p: A(dk, p)); bt = max(grid, key=lambda p: A(tk, p))
    out[lab] = dict(tuned_on_dev=dict(params=bd, dev=A(dk, bd), test=A(tk, bd)), tuned_on_test=dict(params=bt, test=A(tk, bt), dev=A(dk, bt)),
                    held_out_mean=(A(tk, bd) + A(dk, bt)) / 2, sec_mean=float(np.mean([o[k]["sec"] for k in ks])))
print(json.dumps(out, indent=1))
