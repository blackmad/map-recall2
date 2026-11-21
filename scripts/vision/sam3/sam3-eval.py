"""Score sam3-probe.py output: storeys and bays against gold-crops.json, souterrain against souterrain-gold.json.

Research spike 2026-11-21 (docs/reports/sam3-storeys-20261121.md). Pure numpy; run with any Python that has numpy.

  python3 sam3-eval.py storeys PROBE_DIR [--owl OWL_JSON]
  python3 sam3-eval.py souterrain PROBE_DIR

Rules are fixed in code (A PRIORI below) and also tuned split-half exactly like owl-eval.py (dev = even
positions of the sorted gold keys, test = odd), so the held-out number is comparable with OWLv2's.
"""
import json, os, sys, collections, itertools
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PPM = 40.0


def load(probe_dir, name):
    z = np.load(os.path.join(probe_dir, name.rsplit(".", 1)[0] + ".npz"))
    W, H = int(z["W"]), int(z["H"])
    out = {"W": W, "H": H}
    for k in z.files:
        if "|" not in k:
            continue
        p, kind = k.split("|")
        out.setdefault(p, {})[kind] = z[k]
    for p, d in list(out.items()):
        if isinstance(d, dict) and "masks" in d:
            d["masks"] = np.unpackbits(d["masks"], axis=-1)[..., :W].astype(bool) if len(d["masks"]) else np.zeros((0, H, W), bool)
    return out


def inst(d, p, thr):
    if p not in d:
        return []
    r = []
    for b, s, m in zip(d[p]["boxes"], d[p]["scores"], d[p]["masks"]):
        if s < thr or not m.any():
            continue
        ys, xs = np.nonzero(m)
        r.append(dict(box=b, score=float(s), x0=xs.min(), x1=xs.max(), y0=ys.min(), y1=ys.max(), area=int(m.sum()), mask=m))
    return r


def inside(pt, box, pad=0):
    x, y = pt
    return box[0] - pad <= x <= box[2] + pad and box[1] - pad <= y <= box[3] + pad


def rows_of(ws):
    """Group windows into rows: a window joins a row when its vertical extent overlaps the row's median band by >= 50 %."""
    rows = []
    for w in sorted(ws, key=lambda w: (w["y0"] + w["y1"]) / 2):
        placed = False
        for r in rows:
            a0 = np.median([q["y0"] for q in r]); a1 = np.median([q["y1"] for q in r])
            ov = min(a1, w["y1"]) - max(a0, w["y0"])
            if ov >= 0.5 * min(a1 - a0, w["y1"] - w["y0"]):
                r.append(w); placed = True; break
        if not placed:
            rows.append([w])
    return rows


def measure(d, thr=0.4, ground_m=3.2, min_frac=0.5, roof_excl=True, need_two=False):
    H = d["H"]
    win = [w for w in inst(d, "window", thr)
           if 0.35 <= (w["x1"] - w["x0"]) / PPM <= 3.0 and 0.45 <= (w["y1"] - w["y0"]) / PPM <= 3.6]
    dorm = inst(d, "dormer", 0.4)
    doors = inst(d, "door", 0.4)
    shop = inst(d, "shop window", 0.4)
    keep = []
    for w in win:
        c = ((w["x0"] + w["x1"]) / 2, (w["y0"] + w["y1"]) / 2)
        if roof_excl and any(inside(c, q["box"]) for q in dorm):
            continue  # window of a dormer
        if any(inside(c, q["box"]) for q in doors):
            continue  # door glazing
        keep.append(w)
    rows = rows_of(keep)
    counts = [len(r) for r in rows]
    mx = max(counts) if counts else 0
    body = [r for r in rows if len(r) >= max(2 if need_two else 1, int(np.ceil(min_frac * mx)))]
    upper = [r for r in body if (H - np.median([q["y1"] for q in r])) / PPM > ground_m]
    storeys = len(upper) + 1
    # bays: mode of window count per upper row (fall back to all rows)
    pool = [len(r) for r in (upper or body)]
    bays = collections.Counter(pool).most_common(1)[0][0] if pool else 0
    return storeys, bays, dict(rows=rows, keep=keep, upper=upper, dorm=dorm, doors=doors, shop=shop)


def storeys_main(probe_dir, owl=None):
    g = json.load(open(os.path.join(HERE, "gold-crops.json")))
    ks = sorted(g, key=int)
    dev, test = ks[::2], ks[1::2]
    data = {k: load(probe_dir, g[k]["file"]) for k in ks}
    run = json.load(open(os.path.join(probe_dir, "run.json")))
    res = {}
    for lab in ("storeys", "storeysV2"):
        kk = [k for k in ks if g[k][lab] is not None]
        maj = collections.Counter(g[k][lab] for k in kk).most_common(1)[0][0]
        pred = {k: measure(data[k]) for k in kk}
        acc = lambda keys, f: float(np.mean([f(k) for k in keys])) if keys else float("nan")
        r = dict(n=len(kk),
                 apriori=acc(kk, lambda k: pred[k][0] == g[k][lab]),
                 apriori_dev=acc([k for k in dev if k in kk], lambda k: pred[k][0] == g[k][lab]),
                 apriori_test=acc([k for k in test if k in kk], lambda k: pred[k][0] == g[k][lab]),
                 within1=acc(kk, lambda k: abs(pred[k][0] - g[k][lab]) <= 1),
                 majority=acc(kk, lambda k: g[k][lab] == maj),
                 majority_test=acc([k for k in test if k in kk], lambda k: g[k][lab] == maj),
                 bag3d=acc(kk, lambda k: g[k]["storeys3dbag"] == g[k][lab]),
                 bag3d_minus1=acc(kk, lambda k: g[k]["storeys3dbag"] - 1 == g[k][lab]),
                 typeTruth=acc(kk, lambda k: g[k]["typeStoreys"] == g[k][lab]),
                 confusion=collections.Counter(f"{g[k][lab]}->{pred[k][0]}" for k in kk).most_common())
        grid = list(itertools.product((0.3, 0.4, 0.5, 0.6), (2.6, 3.2, 3.8), (0.34, 0.5, 0.67), (True, False)))
        A = lambda keys, p: np.mean([measure(data[k], *p)[0] == g[k][lab] for k in keys])
        dk = [k for k in dev if k in kk]; tk = [k for k in test if k in kk]
        bd = max(grid, key=lambda p: A(dk, p)); bt = max(grid, key=lambda p: A(tk, p))
        r.update(tuned_on_dev=dict(params=bd, dev=float(A(dk, bd)), test=float(A(tk, bd))),
                 tuned_on_test=dict(params=bt, test=float(A(tk, bt)), dev=float(A(dk, bt))))
        res[lab] = r
    bays = {k: measure(data[k])[1] for k in ks}
    res["bays"] = dict(apriori=float(np.mean([bays[k] == g[k]["bays"] for k in ks])),
                       test=float(np.mean([bays[k] == g[k]["bays"] for k in test])),
                       width_rule=float(np.mean([(2 if g[k]["widthM"] <= 4.6 else 3) == g[k]["bays"] for k in ks])),
                       confusion=collections.Counter(f"{g[k]['bays']}->{bays[k]}" for k in ks).most_common())
    res["per_front"] = {k: dict(file=g[k]["file"], gold=g[k]["storeys"], goldV2=g[k]["storeysV2"], bag3d=g[k]["storeys3dbag"],
                                pred=measure(data[k])[0], goldBays=g[k]["bays"], predBays=bays[k]) for k in ks}
    res["run"] = run
    print(json.dumps({k: v for k, v in res.items() if k != "per_front"}, indent=1, default=str))
    json.dump(res, open(os.path.join(probe_dir, "storeys-eval.json"), "w"), indent=1, default=str)


def souterrain_rule(d, thr=0.4, low_top_m=1.6, low_bottom_m=0.5, need_stoop=False, stoop_ok=False):
    """Souterrain if a window (not inside a door or shop-window box) has its bottom within low_bottom_m of the
    ground line (crop bottom = strip ground) and its top under low_top_m above it. Optional stoop evidence:
    'stairs' or 'railing' instance whose bottom touches the ground zone."""
    H = d["H"]
    win = inst(d, "window", thr)
    doors = inst(d, "door", 0.4) + inst(d, "shop window", 0.5)
    low = []
    for w in win:
        c = ((w["x0"] + w["x1"]) / 2, (w["y0"] + w["y1"]) / 2)
        if any(inside(c, q["box"]) for q in doors):
            continue
        bot = (H - w["y1"]) / PPM; top = (H - w["y0"]) / PPM
        if bot <= low_bottom_m and top <= low_top_m and (w["x1"] - w["x0"]) / PPM >= 0.3:
            low.append(w)
    stoop = [q for q in inst(d, "stairs", thr) + inst(d, "railing", thr) if (H - q["y1"]) / PPM <= 0.8 and (H - q["y0"]) / PPM <= 2.5]
    if need_stoop:
        return bool(low) and bool(stoop), low, stoop
    if stoop_ok:
        return bool(low) or bool(stoop), low, stoop
    return bool(low), low, stoop


def prf(pred, gold):
    tp = sum(p and g for p, g in zip(pred, gold)); fp = sum(p and not g for p, g in zip(pred, gold)); fn = sum(g and not p for p, g in zip(pred, gold))
    P = tp / (tp + fp) if tp + fp else float("nan"); R = tp / (tp + fn) if tp + fn else float("nan")
    return dict(tp=tp, fp=fp, fn=fn, precision=round(P, 3), recall=round(R, 3), acc=round(float(np.mean([p == g for p, g in zip(pred, gold)])), 3))


def souterrain_main(probe_dir):
    g = json.load(open(os.path.join(HERE, "souterrain-gold.json")))
    data = [load(probe_dir, r["file"]) for r in g]
    gold = [r["souterrain"] for r in g]
    out = {}
    variants = dict(A_low_window=dict(), B_low_window_and_stoop=dict(need_stoop=True), C_low_window_or_stoop=dict(stoop_ok=True),
                    A_strict_top12=dict(low_top_m=1.2), A_loose_top20=dict(low_top_m=2.0, low_bottom_m=0.8),
                    A_thr03=dict(thr=0.3), A_thr05=dict(thr=0.5))
    for n, kw in variants.items():
        pred = [souterrain_rule(d, **kw)[0] for d in data]
        out[n] = prf(pred, gold)
    stoop_only = [bool(souterrain_rule(d)[2]) for d in data]
    out["stoop_only"] = prf(stoop_only, gold)
    out["per_front"] = [dict(file=r["file"], gold=r["souterrain"], A=souterrain_rule(d)[0], nLow=len(souterrain_rule(d)[1]),
                             stoop=bool(souterrain_rule(d)[2])) for r, d in zip(g, data)]
    print(json.dumps({k: v for k, v in out.items() if k != "per_front"}, indent=1))
    json.dump(out, open(os.path.join(probe_dir, "souterrain-eval.json"), "w"), indent=1)


if __name__ == "__main__":
    if sys.argv[1] == "storeys":
        storeys_main(sys.argv[2])
    else:
        souterrain_main(sys.argv[2])
