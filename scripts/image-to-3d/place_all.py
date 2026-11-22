"""Place and render every output of one model run: python3 -I place_all.py <runs/<model>> <front axis> <up axis> <glb name, {id} = input id> [--force]

Fronts: scaled to the game's building top height (house:preview measure.json heights.topM), framed at the BAG wall
length. Ornaments: scaled to the crop's height in metres (crop px x the view's m/px at the target)."""
import json, os, subprocess, sys
run, front, up, glbname = sys.argv[1:5]
A = "artifacts/image-to-3d"
inputs = json.load(open(f"{A}/inputs/inputs.json"))
for k, meta in inputs.items():
    d = os.path.join(run, k)
    glb = os.path.join(d, glbname.replace("{id}", k))
    if os.path.exists(f"{d}/placed/place.json") and "--force" not in sys.argv:
        continue
    if not os.path.exists(glb):
        print(k, "no", glbname); continue
    if meta["kind"] == "front":
        ms = json.load(open(f"{A}/today/{meta['pandId']}/measure.json"))
        h, w = ms["heights"]["topM"], ms["wall"]["lengthM"]
    else:
        x0, y0, x1, y1 = meta["box"]
        h, w = (y1 - y0) * meta["view"]["mPerPx"], (x1 - x0) * meta["view"]["mPerPx"]
    r = subprocess.run(["node", "--import", "tsx", "scripts/image-to-3d/place-render.ts", f"--glb={glb}", f"--out={d}/placed",
                        f"--height={h:.2f}", f"--width={w:.2f}", f"--front={front}", f"--up={up}"], capture_output=True, text=True)
    print(k, r.stdout.strip().splitlines()[-1][:220] if r.stdout.strip() else r.stderr[-500:])
