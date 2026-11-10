# /// script
# requires-python = ">=3.11"
# dependencies = ["shapely>=2.0"]
# ///
"""Compare the game's water mask source (OpenFreeMap basemap-water) with current
BGT waterdeel (PDOK, CC0). Writes artifacts/land-mask/diff.json: clusters where
the mask has water but BGT has none ("falseWater": land the game drowns) and the
reverse ("missingWater"), plus the totals.
  uv run scripts/land-mask/compare-water-mask.py
"""
import json, math, argparse
from shapely.geometry import shape, box, mapping
from shapely.ops import unary_union, transform
from shapely.prepared import prep
ap = argparse.ArgumentParser()
ap.add_argument('--water', default='/Users/blackmad/Code/map-recall2-source-data-elevation/terrain/amsterdam/raw/basemap-water.geojson')
ap.add_argument('--min-m2', type=float, default=150)
a = ap.parse_args()
O = (4.9, 52.37); MX = 111320 * math.cos(math.radians(O[1])); MY = 111320
loc = lambda g: transform(lambda xs, ys, z=None: ([(x - O[0]) * MX for x in xs], [(y - O[1]) * MY for y in ys]), g)
unloc = lambda g: transform(lambda xs, ys, z=None: ([x / MX + O[0] for x in xs], [y / MY + O[1] for y in ys]), g)
bgt = json.load(open('artifacts/land-mask/bgt/waterdeel-city.json'))
bgt = [loc(shape(f['g']).buffer(0)) for f in bgt if f['h'] == 0 or f['h'] is None]
osm = [loc(shape(f['geometry']).buffer(0)) for f in json.load(open(a.water))['features']]
B = unary_union(bgt).buffer(0.5).buffer(-0.5); Ow = unary_union(osm)
# restrict to the game bbox of the mask data (BGT covers more than OSM tiles do)
bb = box(*loc(box(4.71, 52.27, 5.10, 52.43)).bounds)
B = B.intersection(bb); Ow = Ow.intersection(bb)
# tolerance: ignore edge slop below 3 m (BGT edges vs simplified OSM)
fw = Ow.difference(B.buffer(3)).buffer(-1.5).buffer(1.5)
mw = B.difference(Ow.buffer(3)).buffer(-1.5).buffer(1.5)
def clusters(g, tag):
    parts = [p for p in (g.geoms if hasattr(g, 'geoms') else [g]) if p.area >= a.min_m2]
    out = []
    for p in parts:
        c = unloc(p.representative_point())
        out.append({'kind': tag, 'm2': round(p.area), 'lng': round(c.x, 6), 'lat': round(c.y, 6), 'geometry': mapping(unloc(p.simplify(0.5)))})
    return sorted(out, key=lambda r: -r['m2'])
fc = clusters(fw, 'falseWater'); mc = clusters(mw, 'missingWater')
res = {'osmWaterM2': round(Ow.area), 'bgtWaterM2': round(B.area), 'falseWaterM2': round(fw.area), 'missingWaterM2': round(mw.area), 'falseWater': fc, 'missingWater': mc}
json.dump(res, open('artifacts/land-mask/diff.json', 'w'))
print({k: v for k, v in res.items() if not isinstance(v, list)})
for r in fc[:25]: print('false ', r['m2'], r['lat'], r['lng'])
for r in mc[:15]: print('missing', r['m2'], r['lat'], r['lng'])
