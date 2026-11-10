# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "shapely>=2.0"]
# ///
"""PDOK luchtfoto (open data) crop with water-mask outlines drawn on it.
  uv run scripts/land-mask/ortho-overlay.py --bbox W,S,E,N --out f.jpg [--layer file.geojson:colour ...] [--water-dir elevation-v1-dir]
`--layer` draws GeoJSON polygon outlines; `--water-dir` draws an elevation-v1 water mask (cells decoded to lng/lat).
"""
import argparse, io, json, os, urllib.request
from PIL import Image, ImageDraw
ap = argparse.ArgumentParser()
ap.add_argument('--bbox', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--layer', action='append', default=[]); ap.add_argument('--water-dir', action='append', default=[])
ap.add_argument('--width', type=int, default=1400)
a = ap.parse_args()
W, S, E, N = map(float, a.bbox.split(','))
H = int(a.width * (N - S) * 111320 / ((E - W) * 111320 * 0.6128))
url = f'https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0?service=WMS&version=1.3.0&request=GetMap&layers=Actueel_orthoHR&styles=&crs=EPSG:4326&bbox={S},{W},{N},{E}&width={a.width}&height={H}&format=image/jpeg'
img = Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'map-recall-land-mask/1'}), timeout=60).read())).convert('RGB'); d = ImageDraw.Draw(img, 'RGBA')
px = lambda lng, lat: ((lng - W) / (E - W) * a.width, (N - lat) / (N - S) * H)
def rings(geom):
    t, c = geom['type'], geom['coordinates']
    polys = [c] if t == 'Polygon' else c if t == 'MultiPolygon' else []
    for poly in polys:
        for r in poly: yield r
def draw(rs, col):
    for r in rs: d.line([px(*p[:2]) for p in r] + [px(*r[0][:2])], fill=col, width=3)
for spec in a.layer:
    f, col = spec.rsplit(':', 1)
    draw([r for ft in json.load(open(f))['features'] for r in rings(ft['geometry'])], col)
for wd in a.water_dir:
    idx = json.load(open(os.path.join(wd, 'index.json'))); q = idx['quantization']['xy']; sz = idx['cellSizeM']; mxy = idx['metresPerDegree']; o = idx['origin']
    for cx, cy, *_ in idx['cells']:
        p = os.path.join(wd, 'cells', f'{cx}_{cy}.json')
        if not os.path.exists(p): continue
        for poly in json.load(open(p))['water']:
            for ring in poly:
                pts = [(o[0] + (cx * sz + ring[i] * q) / mxy[0], o[1] + (cy * sz + ring[i + 1] * q) / mxy[1]) for i in range(0, len(ring), 2)]
                if max(p[0] for p in pts) < W or min(p[0] for p in pts) > E or max(p[1] for p in pts) < S or min(p[1] for p in pts) > N: continue
                d.line([px(*p) for p in pts] + [px(*pts[0])], fill='#ff2a2a', width=3)
img.save(a.out, quality=88); print(a.out, img.size)
