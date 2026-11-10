# /// script
# requires-python = ">=3.11"
# dependencies = ["shapely>=2.0"]
# ///
"""Land-mask gap survey: BAG pand footprints whose representative point lies in
the water mask (basemap-water.geojson, the source of elevation-v1 water), by buurt.

  uv run scripts/land-mask/measure-land-mask-gaps.py --water <geojson> [--out artifacts/land-mask/gaps.json]
"""
import argparse, glob, gzip, json, collections, math
from shapely import STRtree
from shapely.geometry import shape, Point, Polygon
ap = argparse.ArgumentParser()
ap.add_argument('--water', default='/Users/blackmad/Code/map-recall2-source-data-elevation/terrain/amsterdam/raw/basemap-water.geojson')
ap.add_argument('--water-dir', default='', help='measure an elevation-v1 water mask (published or staging) instead of the source geojson')
ap.add_argument('--out', default='artifacts/land-mask/gaps.json')
ap.add_argument('--min-share', type=float, default=0.5)
a = ap.parse_args()
A = 'public/data/extracts/amsterdam/'
def load_water():
    if not a.water_dir:
        return [shape(f['geometry']) for f in json.load(open(a.water))['features']]
    import os
    idx = json.load(open(os.path.join(a.water_dir, 'index.json'))); q = idx['quantization']['xy']; sz = idx['cellSizeM']; mxy = idx['metresPerDegree']; o = idx['origin']
    out = []
    for cx, cy, *_ in idx['cells']:
        f = os.path.join(a.water_dir, 'cells', f'{cx}_{cy}.json')
        if not os.path.exists(f): continue
        for poly in json.load(open(f))['water']:
            rings = [[(o[0] + (cx * sz + r[i] * q) / mxy[0], o[1] + (cy * sz + r[i + 1] * q) / mxy[1]) for i in range(0, len(r), 2)] for r in poly]
            out.append(Polygon(rings[0], rings[1:]).buffer(0))
    return out
W = load_water()
tree = STRtree(W)
bd = [x for x in json.load(open(A + 'boundaries.json')) if x['kind'] != 'municipality']
kinds = collections.Counter(x['kind'] for x in bd)
nb = [x for x in bd if x['kind'] == kinds.most_common()[0][0] or 'neigh' in x['kind'] or 'buurt' in x['kind']]
polys = []
for x in nb:
    ps = [Polygon([(p[1], p[0]) for p in poly[0]]) for poly in x['geometry']]
    polys.append((x['name'], ps))
bpoly = [(n, p) for n, ps in polys for p in ps]
btree = STRtree([p for _, p in bpoly])
def buurt(pt):
    for i in btree.query(pt):
        if bpoly[i][1].contains(pt): return bpoly[i][0]
    return '?'
my = 111320.0
out = []; total = 0; seen = set()
for f in sorted(glob.glob(A + 'bag-tiles/14/*/*.geojson.gz')):
    for ft in json.load(gzip.open(f))['features']:
        pid = ft['properties']['id']
        if pid in seen or ft['geometry']['type'] != 'Polygon': continue
        seen.add(pid); total += 1
        g = shape(ft['geometry'])
        if g.is_empty or not g.is_valid: continue
        rp = g.representative_point()
        hit = [i for i in tree.query(rp) if W[i].contains(rp)]
        if not hit:
            continue
        inter = sum(g.intersection(W[i]).area for i in tree.query(g) if W[i].intersects(g))
        share = inter / g.area if g.area else 0
        if share < a.min_share: continue
        area = g.area * (my * my * math.cos(math.radians(rp.y)))
        out.append({'id': pid, 'lng': round(rp.x, 6), 'lat': round(rp.y, 6), 'm2': round(area, 1), 'share': round(share, 2), 'year': ft['properties'].get('year'), 'buurt': buurt(rp)})
by = collections.defaultdict(lambda: [0, 0.0])
for o in out: by[o['buurt']][0] += 1; by[o['buurt']][1] += o['m2']
res = {'pands': total, 'inWater': len(out), 'm2': round(sum(o['m2'] for o in out)), 'byBuurt': sorted(([k, v[0], round(v[1])] for k, v in by.items()), key=lambda r: -r[1]), 'items': out}
json.dump(res, open(a.out, 'w'))
print(total, len(out), res['m2']); [print(r) for r in res['byBuurt'][:25]]
