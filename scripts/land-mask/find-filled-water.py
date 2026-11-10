# /// script
# requires-python = ">=3.11"
# dependencies = ["shapely>=2.0", "rasterio", "numpy", "scipy", "pyproj"]
# ///
"""Find water the mask still draws where AHN (open, CC0) says there is land:
pixels inside the mask's water polygons whose DTM height is well above canal
level, kept when a blob is at least --min-m2 and wider than --min-width (so
bridge-deck interpolation, quay slivers and mooring edges drop out).

Writes a STAGING geojson (default artifacts/land-mask/staging/filled-water.geojson)
of land polygons (lng/lat) and prints per-area totals. The integrator reviews it
before scripts/land-mask/apply-land-fixes.py is run on the elevation builder's input.

  uv run scripts/land-mask/find-filled-water.py [--tiles 8414_5376,...]
"""
import argparse, glob, json, math, os, re
import numpy as np, rasterio
from rasterio import features
from rasterio.windows import from_bounds
from scipy import ndimage
from shapely.geometry import shape, box, mapping
from shapely.ops import transform as shp_transform
from shapely.strtree import STRtree
from pyproj import Transformer
ap = argparse.ArgumentParser()
ap.add_argument('--src', default='/Users/blackmad/Code/map-recall2-source-data-elevation/terrain/amsterdam/raw')
ap.add_argument('--water', default='/Users/blackmad/Code/map-recall2-source-data-elevation/terrain/amsterdam/raw/basemap-water.geojson')
ap.add_argument('--out', default='artifacts/land-mask/staging/filled-water.geojson')
ap.add_argument('--tiles', default='')
ap.add_argument('--min-above', type=float, default=0.8, help='DTM m NAP; canal level is -0.4')
ap.add_argument('--min-m2', type=float, default=400)
ap.add_argument('--min-width', type=float, default=5.0, help='m, opening diameter')
ap.add_argument('--min-bgt-land', type=float, default=0.4, help='share of a candidate that current BGT land objects must cover')
ap.add_argument('--candidates', default='', help='skip the AHN scan: take merged candidates from this geojson (a previous run) and only corroborate')
a = ap.parse_args()
to_rd = Transformer.from_crs(4326, 28992, always_xy=True).transform
to_ll = Transformer.from_crs(28992, 4326, always_xy=True).transform
W = [(shp_transform(to_rd, shape(f['geometry']).buffer(0))) for f in json.load(open(a.water))['features']]
tree = STRtree(W)
want = set(a.tiles.split(',')) if a.tiles else None
out = []
if a.candidates: out = json.load(open(a.candidates))['features']
for tif in ([] if a.candidates else sorted(glob.glob(os.path.join(a.src, 'dtm-14-*.tif')))):
    key = '_'.join(re.findall(r'dtm-14-(\d+)-(\d+)', tif)[0])
    if want and key not in want: continue
    with rasterio.open(tif) as ds:
        dtm = ds.read(1).astype('float32')
        if ds.nodata is not None: dtm[dtm == ds.nodata] = np.nan
        tr = ds.transform; bnd = box(*ds.bounds)
        idx = tree.query(bnd)
        if len(idx) == 0: continue
        water = features.rasterize([(W[i], 1) for i in idx], out_shape=dtm.shape, transform=tr, fill=0, dtype='uint8').astype(bool)
        hi = water & (dtm > a.min_above)
        if not hi.any(): continue
        px = abs(tr.a)
        r = int(round(a.min_width / px / 2))
        st = np.ones((2 * r + 1, 2 * r + 1), bool)
        core = ndimage.binary_opening(hi, structure=st)
        lab, n = ndimage.label(core)
        if n == 0: continue
        area = ndimage.sum(core, lab, range(1, n + 1)) * px * px
        keep = np.isin(lab, [i + 1 for i, v in enumerate(area) if v >= a.min_m2])
        if not keep.any(): continue
        # grow back toward the water edge: the opening eroded the rim
        keep = ndimage.binary_dilation(keep, structure=st) & hi
        for geom, v in features.shapes(keep.astype('uint8'), mask=keep, transform=tr):
            g = shape(geom)
            if g.area < a.min_m2: continue
            med = float(np.nanmedian(dtm[features.rasterize([(g, 1)], out_shape=dtm.shape, transform=tr, fill=0, dtype='uint8').astype(bool)]))
            gl = shp_transform(to_ll, g.simplify(0.6))
            c = gl.representative_point()
            out.append({'type': 'Feature', 'properties': {'tile': key, 'm2': round(g.area), 'medianNAP': round(med, 2), 'lat': round(c.y, 6), 'lng': round(c.x, 6)}, 'geometry': mapping(gl)})
    print(key, len(out), flush=True)
# Tiles overlap by a margin: merge duplicates (and pieces cut at a tile edge).
from shapely.ops import unary_union
merged = []
union = unary_union([shape(f['geometry']).buffer(1e-6) for f in out])
my, mx = 111320.0, 111320.0 * math.cos(math.radians(52.37))
for part in (union.geoms if hasattr(union, 'geoms') else [union]):
    src = [f['properties'] for f in out if shape(f['geometry']).intersects(part)]
    c = part.representative_point()
    merged.append({'type': 'Feature', 'properties': {'m2': round(part.area * mx * my), 'medianNAP': round(float(np.median([p['medianNAP'] for p in src])), 2), 'lat': round(c.y, 6), 'lng': round(c.x, 6)}, 'geometry': mapping(part.simplify(2e-6))})
out = merged
# ---- BGT corroboration -------------------------------------------------------
# AHN's DTM interpolates over open water next to a bank (a strip of 'land' at +1.7 m NAP in the Westpoort docks), so
# a candidate stands only when current BGT land objects (roads, terrain, pands) cover most of it.
import time, urllib.request
BGT = 'https://api.pdok.nl/lv/bgt/ogc/v1/collections/%s/items?f=json&limit=1000&bbox=%s'
LAND_COLLECTIONS = ['wegdeel', 'onbegroeidterreindeel', 'begroeidterreindeel', 'ondersteunendwegdeel', 'pand', 'overigbouwwerk']
def bgt_land(bb):
    geoms = []
    for coll in LAND_COLLECTIONS:
        url = BGT % (coll, ','.join(f'{v:.6f}' for v in bb))
        while url:
            for attempt in range(5):
                try:
                    j = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'map-recall-land-mask/1'}), timeout=60)); break
                except Exception: time.sleep(2 * (attempt + 1))
            else: raise RuntimeError(url)
            for f in j['features']:
                pr = f['properties']
                if pr.get('status') != 'bestaand' or pr.get('eind_registratie') or pr.get('relatieve_hoogteligging', 0) != 0: continue
                geoms.append(shape(f['geometry']).buffer(0))
            url = next((l['href'] for l in j['links'] if l['rel'] == 'next'), None)
    return unary_union(geoms) if geoms else None
from shapely.geometry import Point
rejects = [Point(r['lng'], r['lat']) for r in json.load(open(os.path.join(os.path.dirname(__file__), 'land-rejects.json')))['rejects']]
confirmed, unconfirmed = [], []
for f in out:
    if any(shape(f['geometry']).contains(pt) for pt in rejects):
        f['properties']['bgtLandShare'] = -1; unconfirmed.append(f); continue
    g = shape(f['geometry']); land = bgt_land(g.bounds)
    share = g.intersection(land).area / g.area if land is not None else 0.0
    f['properties']['bgtLandShare'] = round(share, 2)
    (confirmed if share >= a.min_bgt_land else unconfirmed).append(f)
print('BGT-confirmed', len(confirmed), 'unconfirmed', len(unconfirmed))
out = confirmed
os.makedirs(os.path.dirname(a.out), exist_ok=True)
json.dump({'type': 'FeatureCollection', 'features': out}, open(a.out, 'w'))
json.dump({'type': 'FeatureCollection', 'features': unconfirmed}, open(a.out.replace('.geojson', '.unconfirmed.geojson'), 'w'))
print('polygons', len(out), 'm2', sum(f['properties']['m2'] for f in out))
for f in sorted(out, key=lambda f: -f['properties']['m2'])[:30]: print(f['properties'])
