"""Apply blind/key.json to the judge's verdicts: python3 -I unblind.py <artifacts/image-to-3d>.

Reads judge-raw.json (B vs A per sheet) and writes judge.json with each verdict as model vs today
("better" = the model beat today), then prints a per-model tally."""
import json, sys
from collections import Counter
A = sys.argv[1]
key = json.load(open(f"{A}/blind/key.json"))
raw = json.load(open(f"{A}/judge-raw.json"))
flip = {"B better": "worse", "same": "same", "B worse": "better"}
keep = {"B better": "better", "same": "same", "B worse": "worse"}
out = []
for r in raw:
    rid = r["sheet"].removesuffix(".jpg")
    model, inp = rid.split("--")
    b_is_model = key[rid] == "A=today"
    m = keep if b_is_model else flip
    fm, ft = (r["failuresB"], r["failuresA"]) if b_is_model else (r["failuresA"], r["failuresB"])
    out.append({"model": model, "input": inp, "verdict": m[r["verdict"]], "front": m[r["front"]],
                "oblique": m[r["oblique"]], "reason": r["reason"], "modelFailures": fm, "todayFailures": ft,
                "bIsModel": b_is_model})
json.dump(out, open(f"{A}/judge.json", "w"), indent=1)
for model in sorted({o["model"] for o in out}):
    rows = [o for o in out if o["model"] == model]
    for kind in ("front", "orn"):
        c = Counter(o["verdict"] for o in rows if o["input"].startswith(kind))
        print(model, kind, dict(c))
