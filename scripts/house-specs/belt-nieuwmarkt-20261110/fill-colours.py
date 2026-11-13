"""Batch 3 wall colours from the preview's crop reading (artifacts/house-preview/<pand>/measure.json photo.measure.wall):
2025-01-08 low-sun crops get wallcast.cast, the rest a 10 % lightness lift. Writes b3-colours.json, which row3.py applies
(pand -> {brick, read, rule}). Run after a first preview pass; re-run row3.py and make-specs.py after it."""
import json, os, sys, colorsys
here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here)
from wallcast import cast
root = os.path.abspath(os.path.join(here, '../../..'))
def lift(hexs, k=1.1):
    r, g, b = (int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)); h, l, s = colorsys.rgb_to_hls(r, g, b)
    r, g, b = colorsys.hls_to_rgb(h, min(1, l * k), s); return '#%02x%02x%02x' % tuple(round(v * 255) for v in (r, g, b))
R = json.load(open(os.path.join(here, 'readings.json'))); out = {}
for p, v in R.items():
    if not (isinstance(v, dict) and v.get('batch') == 3 and 'design' in v): continue
    f = os.path.join(root, 'artifacts/house-preview', p, 'measure.json')
    if not os.path.exists(f): continue
    m = json.load(open(f)); w = m.get('photo', {}).get('measure', {}).get('wall')
    # Trusted readings only: not NO EVIDENCE (foliage/washed out), brick fronts (a white painted or stucco front in shade reads
    # brown), and not the 2021-01-25 across-the-canal crops, whose lower half is the quay wall and fence.
    if not w or m.get('verdict', {}).get('verdict') == 'NO EVIDENCE' or v['date'] == '2021-01-25': continue
    if v['design']['palette'].get('wallMaterial', 'brick') != 'brick': continue
    # the cast applies to a sunlit wall only; a 2025-01-08 wall in shade (HSL lightness under 0.3) gets the lift
    low = v['date'] == '2025-01-08' and colorsys.rgb_to_hls(*(int(w[i:i + 2], 16) / 255 for i in (1, 3, 5)))[1] >= 0.3
    out[p] = {'brick': cast(w) if low else lift(w), 'read': w, 'rule': 'wallcast (2025-01-08 low sun)' if low else 'lift 10 %'}
json.dump(out, open(os.path.join(here, 'b3-colours.json'), 'w'), indent=1)
print(len(out), 'colours')
