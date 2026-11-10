# /// script
# requires-python = ">=3.11"
# dependencies = ["shapely>=2.0"]
# ///
"""Geometric diff of a staged elevation-v1 against the published one, per cell.

The builder's STRtree query order shifts when the polygon count changes, so a rebuild reorders rings in cells far from any
fix. This keeps the publish set minimal: a cell is 'changed' only when its water area differs (symmetric difference >
--tol m2); with --publish-dir it copies just those cells (plus index.json, bridges.json) so the integrator copies a handful
of files, not 600.
  uv run scripts/land-mask/diff-cells.py [--staged artifacts/elevation/staging/elevation-v1] [--published public/data/extracts/amsterdam/elevation-v1] [--publish-dir artifacts/elevation/staging/publish]
"""
import argparse, json, os, shutil
from shapely.geometry import Polygon
from shapely.ops import unary_union
ap = argparse.ArgumentParser()
ap.add_argument('--staged', default='artifacts/elevation/staging/elevation-v1')
ap.add_argument('--published', default='public/data/extracts/amsterdam/elevation-v1')
ap.add_argument('--publish-dir', default='artifacts/elevation/staging/publish')
ap.add_argument('--tol', type=float, default=10.0)
a = ap.parse_args()
def water(path):
    polys = []
    for poly in json.load(open(path))['water']:
        rings = [[(r[i] / 10, r[i + 1] / 10) for i in range(0, len(r), 2)] for r in poly]
        polys.append(Polygon(rings[0], rings[1:]).buffer(0))
    return unary_union(polys) if polys else Polygon()
changed, removed, added = [], 0.0, 0.0
for f in sorted(os.listdir(os.path.join(a.staged, 'cells'))):
    s, p = water(os.path.join(a.staged, 'cells', f)), water(os.path.join(a.published, 'cells', f))
    rem, add = p.difference(s).area, s.difference(p).area
    if rem + add > a.tol:
        changed.append((f, round(rem, 1), round(add, 1))); removed += rem; added += add
print(f'{len(changed)} cells changed; water removed {removed:.0f} m2, added {added:.0f} m2')
for c in changed: print(' ', *c)
if a.publish_dir:
    shutil.rmtree(a.publish_dir, ignore_errors=True); os.makedirs(os.path.join(a.publish_dir, 'cells'))
    for f, *_ in changed: shutil.copy(os.path.join(a.staged, 'cells', f), os.path.join(a.publish_dir, 'cells', f))
    for f in ('index.json', 'bridges.json'): shutil.copy(os.path.join(a.staged, f), os.path.join(a.publish_dir, f))
    print('publish set:', a.publish_dir)
