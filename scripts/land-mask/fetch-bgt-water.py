# /// script
# requires-python = ">=3.11"
# ///
"""Cache BGT waterdeel (current water surface) for the game bbox from PDOK (CC0).
Cache: artifacts/land-mask/bgt/waterdeel-city.json (not committed).
  uv run scripts/land-mask/fetch-bgt-water.py
"""
import json, urllib.request, time, concurrent.futures as cf, os
API = 'https://api.pdok.nl/lv/bgt/ogc/v1/collections/waterdeel/items'
X0, Y0, X1, Y1 = 4.70, 52.26, 5.11, 52.44
DX, DY = 0.02, 0.012
def get(url):
    for i in range(7):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'map-recall-land-mask/1'}), timeout=60) as r: return json.load(r)
        except Exception:
            time.sleep(2 * (i + 1))
    raise RuntimeError(url)
def tile(b):
    url = f"{API}?f=json&limit=1000&bbox={b[0]:.5f},{b[1]:.5f},{b[2]:.5f},{b[3]:.5f}"
    out = []
    while url:
        j = get(url)
        for f in j['features']:
            p = f['properties']
            if p.get('status') != 'bestaand' or p.get('eind_registratie'): continue
            out.append({'id': p['lokaal_id'], 'type': p['type'], 'h': p.get('relatieve_hoogteligging', 0), 'g': f['geometry']})
        url = next((l['href'] for l in j['links'] if l['rel'] == 'next'), None)
    return out
tiles = []
x = X0
while x < X1:
    y = Y0
    while y < Y1:
        tiles.append((x, y, x + DX, y + DY)); y += DY
    x += DX
feats = {}
with cf.ThreadPoolExecutor(6) as ex:
    for r in ex.map(tile, tiles):
        for f in r: feats[f['id']] = f
os.makedirs('artifacts/land-mask/bgt', exist_ok=True)
json.dump(list(feats.values()), open('artifacts/land-mask/bgt/waterdeel-city.json', 'w'))
print(len(tiles), 'tiles', len(feats), 'features')
