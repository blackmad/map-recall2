# /// script
# requires-python = ">=3.11"
# dependencies = ["shapely>=2.0"]
# ///
"""Build the compact canal-elevation extract (water openings, shorelines, bridge decks).

Visual-only elevation for Canal Recall (`?elevation=1`). Land stays at the game's
z=0 (street / quay level); water sits a fixed freeboard below it; bridges carry
measured AHN deck profiles. See docs/elevation.md.

Inputs (private source pack, `map-recall2-source-data-elevation`):
  terrain/amsterdam/raw/basemap-water.geojson   OpenFreeMap z14 water, snapshot 20261004
  bridges/amsterdam-measured/raw/bridge-surfaces-v1.json   729 AHN DSM/DTM deck profiles
  scripts/data/amsterdam-bridge-register.json  (repo) municipal bridge footprints

Writes to a staging directory (default artifacts/elevation/staging/elevation-v1)
and prints a coverage report. Publish by copying the staging directory to
public/data/extracts/amsterdam/elevation-v1 after review.

  uv run scripts/elevation/build-canal-elevation.py --source ../map-recall2-source-data-elevation
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import statistics
import sys
from collections import defaultdict

from shapely import STRtree
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box, shape
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

ORIGIN = (4.9, 52.37)
MX = 111320.0 * math.cos(math.radians(ORIGIN[1]))
MY = 111320.0
CELL_M = 1000
QUANT = 10  # decimetres
MIN_WATER_AREA_M2 = 25.0
SIMPLIFY_M = 0.2
# Stadsboezem reference water target (AGV 2008 peilbesluiten), metres NAP.
WATER_LEVEL_NAP = -0.40


def to_local(lng: float, lat: float) -> tuple[float, float]:
    return ((lng - ORIGIN[0]) * MX, (lat - ORIGIN[1]) * MY)


def tile_bounds(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    n = 2 ** z
    west = x / n * 360 - 180
    east = (x + 1) / n * 360 - 180
    north = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    south = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return west, south, east, north


def project_geom(geom):
    from shapely.ops import transform
    return transform(lambda xs, ys, z=None: ([(x - ORIGIN[0]) * MX for x in xs], [(y - ORIGIN[1]) * MY for y in ys]), geom)


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def polygons(geom):
    if geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    return [g for part in getattr(geom, 'geoms', []) for g in polygons(part)]


def q(v: float) -> int:
    return int(round(v * QUANT))


def on_boundary(a, b, coverage_boundary, tol=0.3) -> bool:
    mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    return all(coverage_boundary.distance(Point(p)) < tol for p in (a, b, mid))


def clip_segment(a, b, x0, y0, x1, y1):
    """Liang-Barsky; returns the clipped (a, b) or None, preserving direction."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    t0, t1 = 0.0, 1.0
    for p, qv in ((-dx, a[0] - x0), (dx, x1 - a[0]), (-dy, a[1] - y0), (dy, y1 - a[1])):
        if p == 0:
            if qv < 0:
                return None
            continue
        r = qv / p
        if p < 0:
            t0 = max(t0, r)
        else:
            t1 = min(t1, r)
        if t0 > t1:
            return None
    return (a[0] + t0 * dx, a[1] + t0 * dy), (a[0] + t1 * dx, a[1] + t1 * dy)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', default=os.path.expanduser('~/Code/map-recall2-source-data-elevation'))
    parser.add_argument('--register', default='scripts/data/amsterdam-bridge-register.json')
    parser.add_argument('--out', default='artifacts/elevation/staging/elevation-v1')
    args = parser.parse_args()

    water_path = os.path.join(args.source, 'terrain/amsterdam/raw/basemap-water.geojson')
    profiles_path = os.path.join(args.source, 'bridges/amsterdam-measured/raw/bridge-surfaces-v1.json')
    tiles_dir = os.path.join(args.source, 'terrain/amsterdam/raw/basemap-water')
    os.makedirs(os.path.join(args.out, 'cells'), exist_ok=True)

    # ---- coverage: the archived z14 tiles -------------------------------------
    tile_boxes = []
    for name in os.listdir(tiles_dir):
        m = re.match(r'(\d+)-(\d+)-(\d+)\.pbf$', name)
        if m:
            w, s, e, n = tile_bounds(*map(int, m.groups()))
            x0, y0 = to_local(w, s)
            x1, y1 = to_local(e, n)
            tile_boxes.append(box(x0, y0, x1, y1))
    coverage = unary_union(tile_boxes).buffer(0.01).buffer(-0.01)
    coverage_boundary = coverage.boundary
    print(f'coverage: {len(tile_boxes)} z14 tiles, {coverage.area / 1e6:.1f} km2', file=sys.stderr)

    # ---- water union ------------------------------------------------------------
    with open(water_path) as fh:
        features = json.load(fh)['features']
    kept = []
    for feature in features:
        props = feature['properties']
        if props.get('class') == 'swimming_pool' or props.get('brunnel') == 'tunnel' or props.get('intermittent') == 1:
            continue
        geom = project_geom(shape(feature['geometry']))
        if not geom.is_valid:
            geom = geom.buffer(0)
        kept.append(geom)
    print(f'water: {len(kept)}/{len(features)} source polygons kept', file=sys.stderr)
    # Close sub-decimetre seams between tile-clipped pieces before the union.
    water = unary_union([g.buffer(0.05, join_style='mitre') for g in kept]).buffer(-0.05, join_style='mitre')
    water = water.intersection(coverage)
    water = water.simplify(SIMPLIFY_M, preserve_topology=True)
    water_polys = [orient(p, 1.0) for p in polygons(water) if p.area >= MIN_WATER_AREA_M2]
    water = MultiPolygon(water_polys)
    print(f'water union: {len(water_polys)} polygons, {water.area / 1e6:.2f} km2', file=sys.stderr)

    # ---- shorelines: every ring edge except where water meets the coverage edge --
    shore_edges = []
    seam_edges = 0
    for poly in water_polys:
        for ring in [poly.exterior, *poly.interiors]:
            coords = list(ring.coords)
            for a, b in zip(coords, coords[1:]):
                if a == b:
                    continue
                if on_boundary(a, b, coverage_boundary):
                    seam_edges += 1
                    continue
                shore_edges.append((a, b))
    print(f'shore edges: {len(shore_edges)} (+{seam_edges} coverage seams skipped)', file=sys.stderr)

    # ---- cells -----------------------------------------------------------------
    minx, miny, maxx, maxy = water.bounds
    cx0, cy0 = math.floor(minx / CELL_M), math.floor(miny / CELL_M)
    cx1, cy1 = math.floor(maxx / CELL_M), math.floor(maxy / CELL_M)
    tree = STRtree(water_polys)
    cells = {}
    for cx in range(cx0, cx1 + 1):
        for cy in range(cy0, cy1 + 1):
            x0, y0 = cx * CELL_M, cy * CELL_M
            cell_box = box(x0, y0, x0 + CELL_M, y0 + CELL_M)
            rings = []
            for idx in tree.query(cell_box):
                part = water_polys[idx].intersection(cell_box)
                for p in polygons(part):
                    if p.area < 1.0:
                        continue
                    p = orient(p, 1.0)
                    rings.append([[c for xy in list(r.coords)[:-1] for c in (q(xy[0] - x0), q(xy[1] - y0))]
                                  for r in [p.exterior, *p.interiors]])
            if rings:
                cells[(cx, cy)] = {'water': rings, 'shore': []}
    # Shore segments per cell, split at cell edges with direction kept (water on the left).
    for a, b in shore_edges:
        for cx in range(math.floor(min(a[0], b[0]) / CELL_M), math.floor(max(a[0], b[0]) / CELL_M) + 1):
            for cy in range(math.floor(min(a[1], b[1]) / CELL_M), math.floor(max(a[1], b[1]) / CELL_M) + 1):
                x0, y0 = cx * CELL_M, cy * CELL_M
                clipped = clip_segment(a, b, x0, y0, x0 + CELL_M, y0 + CELL_M)
                if not clipped:
                    continue
                (ax, ay), (bx, by) = clipped
                if math.hypot(bx - ax, by - ay) < 0.05:
                    continue
                cell = cells.setdefault((cx, cy), {'water': [], 'shore': []})
                cell['shore'].append([q(ax - x0), q(ay - y0), q(bx - x0), q(by - y0)])
    # Join consecutive shore segments into polylines (smaller, and lets walls share vertices).
    for cell in cells.values():
        polylines = []
        for seg in cell['shore']:
            if polylines and polylines[-1][-2:] == seg[:2]:
                polylines[-1].extend(seg[2:])
            else:
                polylines.append(list(seg))
        cell['shore'] = polylines

    # ---- measured bridge profiles ---------------------------------------------
    with open(profiles_path) as fh:
        profiles = json.load(fh)['bridges']
    measured = []
    measured_ids = set()
    endpoint_nap_belt = []
    for b in profiles:
        olng, olat = b['origin']
        # Profile points are east/north metres around the bridge origin.
        lat_scale = 111320.0
        lng_scale = 111320.0 * math.cos(math.radians(olat))
        pts = []
        for s in b['samples']:
            lng = olng + s['point'][0] / lng_scale
            lat = olat + s['point'][1] / lat_scale
            pts.append((*to_local(lng, lat), s['s'], max(0.0, s['heightM'])))
        line = LineString([(x, y) for x, y, _, _ in pts])
        crossing = None
        hits = [water_polys[i] for i in tree.query(line)]
        inter = unary_union([line.intersection(h) for h in hits]) if hits else None
        if inter is not None and not inter.is_empty and inter.length > 0.5:
            ss = [line.project(Point(c)) for g in getattr(inter, 'geoms', [inter]) for c in g.coords]
            crossing = [round(min(ss) + pts[0][2], 2), round(max(ss) + pts[0][2], 2)]
        outline = [to_local(olng + x / lng_scale, olat + y / lat_scale) for x, y in b['outline']]
        endpoint = b['provenance']['renderDatum']['endpointNAP']
        if 4.875 < olng < 4.915 and 52.358 < olat < 52.382:
            endpoint_nap_belt.extend(endpoint)
        measured_ids.add(b['id'])
        measured.append({
            'id': b['id'], 'name': b['name'], 'roadIds': b['roadIds'], 'family': b['family'],
            'width': round(b['widthM'], 2), 'approachHalfWidth': round(b['approachHalfWidthM'], 2),
            'deck': [round(v, 2) for v in b['deckRangeM']], 'water': crossing,
            'outline': [c for xy in outline for c in (q(xy[0]), q(xy[1]))],
            'endpointNAP': endpoint,
            # x, y in decimetres (local frame), s and h in centimetres.
            'p': [v for x, y, s, h in pts for v in (q(x), q(y), int(round(s * 100)), int(round(h * 100)))],
        })

    # ---- unmeasured register bridges over water: flat fallback footprints -------
    with open(args.register) as fh:
        register = json.load(fh)
    fields = register['fields']
    fallback = []
    fallback_types = defaultdict(int)
    for row in register['bridges']:
        rec = dict(zip(fields, row))
        if rec['number'] in measured_ids or not rec['ring'] or len(rec['ring']) < 4:
            continue
        poly = Polygon([to_local(*c) for c in rec['ring']])
        if not poly.is_valid:
            poly = poly.buffer(0)
        if poly.is_empty or poly.area < 4:
            continue
        over = sum(poly.intersection(water_polys[i]).area for i in tree.query(poly))
        if over < 0.25 * poly.area:
            continue
        poly = orient(polygons(poly)[0] if not isinstance(poly, Polygon) else poly, 1.0).simplify(0.1)
        fallback_types[rec['type'] or 'unknown'] += 1
        fallback.append({
            'id': rec['number'] or f'register-{len(fallback)}', 'name': rec['name'], 'type': rec['type'],
            'ring': [c for xy in list(poly.exterior.coords)[:-1] for c in (q(xy[0]), q(xy[1]))],
        })

    # ---- write -----------------------------------------------------------------
    freeboard = round(statistics.median(endpoint_nap_belt) - WATER_LEVEL_NAP, 2)
    cell_index = []
    total_bytes = 0
    for (cx, cy), cell in sorted(cells.items()):
        key = f'{cx}_{cy}'
        payload = json.dumps({'cell': [cx, cy], **cell}, separators=(',', ':'))
        with open(os.path.join(args.out, 'cells', f'{key}.json'), 'w') as fh:
            fh.write(payload)
        total_bytes += len(payload)
        cell_index.append([cx, cy, sum(len(r) // 2 for poly in cell['water'] for r in poly), sum(len(p) // 2 - 1 for p in cell['shore'])])
    bridges_payload = json.dumps({'measured': measured, 'fallback': fallback}, separators=(',', ':'))
    with open(os.path.join(args.out, 'bridges.json'), 'w') as fh:
        fh.write(bridges_payload)
    index = {
        'version': 1,
        'origin': list(ORIGIN),
        'metresPerDegree': [MX, MY],
        'cellSizeM': CELL_M,
        'quantization': {'xy': 1 / QUANT, 'profileS': 0.01, 'profileH': 0.01},
        'waterLevelNAP': WATER_LEVEL_NAP,
        'quayFreeboardM': freeboard,
        'quayFreeboardMethod': f'median measured bridge-approach DTM height in the canal belt ({len(endpoint_nap_belt)} endpoints) minus the stadsboezem reference level',
        'cells': cell_index,
        'sources': {
            'water': {'file': 'terrain/amsterdam/raw/basemap-water.geojson', 'sha256': sha256(water_path), 'snapshot': 'OpenFreeMap 20261004_113936_pt z14'},
            'profiles': {'file': 'bridges/amsterdam-measured/raw/bridge-surfaces-v1.json', 'sha256': sha256(profiles_path), 'method': 'AHN dsm_05m deck / dtm_05m approaches'},
            'register': {'file': args.register, 'sha256': sha256(args.register)},
            'waterLevel': 'https://www.agv.nl/siteassets/werk-in-uitvoering/waterpeil/peilbesluitenamsterdam.pdf',
        },
        'attribution': 'Water © OpenStreetMap contributors / OpenMapTiles via OpenFreeMap; heights AHN (PDOK, CC0); bridges Gemeente Amsterdam',
    }
    with open(os.path.join(args.out, 'index.json'), 'w') as fh:
        json.dump(index, fh, separators=(',', ':'))
    report = {
        'cells': len(cells), 'cellBytes': total_bytes, 'bridgeBytes': len(bridges_payload),
        'measured': len(measured), 'measuredOverWater': sum(1 for b in measured if b['water']),
        'fallback': len(fallback), 'fallbackTypes': dict(fallback_types),
        'quayFreeboardM': freeboard, 'shoreEdges': len(shore_edges), 'waterKm2': round(water.area / 1e6, 3),
    }
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
