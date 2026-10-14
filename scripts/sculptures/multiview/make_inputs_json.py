"""Write artifacts/sculpture-reconstruction/de-dokwerker/inputs/inputs.json: the seven impostor Commons views
(scripts/sculptures/dokwerker/impostor-views.json boxes) plus every panorama tight crop (pano-crops.ts).

  python3 -I scripts/sculptures/multiview/make_inputs_json.py   (from the worktree root)
"""
import json, os

A = 'artifacts/sculpture-reconstruction/de-dokwerker'
FACING = 252
imp = json.load(open('scripts/sculptures/dokwerker/impostor-views.json'))
src = os.path.expanduser('~/Code/map-recall2-source-data/experiments/sculptures/dokwerker/images/')
views = []
for v in imp['views']:
    views.append({"name": f"commons-az{v['azimuthDeg']:+d}-{v['photo'][:-4]}", "src": src + v['photo'], "box": v['box'],
                  "model": v.get('model', 'isnet-general-use'), "azimuthDeg": v['azimuthDeg']})
pv = json.load(open(f'{A}/pano/views.json'))
for p in pv['views']:
    if not p['file'].endswith('-tight.jpg'):
        continue
    az = (p['azimuthFromStatueDeg'] - FACING + 540) % 360 - 180
    views.append({"name": "pano-" + p['panoId'], "src": f"{A}/pano/{p['file']}", "box": [254, 174, 514, 600],
                  "model": "u2net", "upscale": 2, "azimuthDeg": round(az), "date": p["date"][:10]})
os.makedirs(f'{A}/inputs', exist_ok=True)
json.dump({"views": views}, open(f'{A}/inputs/inputs.json', 'w'), indent=1)
print(len(views))
