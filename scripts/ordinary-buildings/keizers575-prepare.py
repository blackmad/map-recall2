"""Prepare the exact native Keizersgracht569–575 envelope from cached survey inputs.

Run with uv run --with numpy --with shapely --with pyproj python ...
Raw inputs remain in the private companion repository. Facade decisions are
added separately after source ownership/count review; this is not acceptance.
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np
from pyproj import CRS, Transformer
from shapely import make_valid, constrained_delaunay_triangles
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import triangulate, unary_union, split, nearest_points

parser = argparse.ArgumentParser()
parser.add_argument("--source", type=Path, required=True)
parser.add_argument("--output", type=Path, default=Path("scripts/ordinary-buildings/keizers575-spec.json"))
parser.add_argument("--source-commit", default="4ec0a0d69e202f87d573b5543650c9446f20102f", help="Verified private archive commit; override for later source admission")
args = parser.parse_args()
candidate = json.loads((args.source / "cached/candidate-derived.json").read_text())
survey = json.loads((args.source / "cached/processed/roof-surfaces.json").read_text())
anchor = candidate["center"]
kx = 111320 * math.cos(math.radians(anchor[1]))

def local(lng, lat):
    return [(lng - anchor[0]) * kx, -(lat - anchor[1]) * 111320]

native_ring = [local(*p) for p in candidate["feature"]["geometry"]["coordinates"][0][:-1]]
native = Polygon(native_ring)
assert native.is_valid and not native.interiors
rd = CRS.from_proj4("+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs")
transform = Transformer.from_crs(rd, CRS.from_epsg(4326), always_xy=True)

def polygons(geometry):
    if geometry.is_empty:
        return []
    if geometry.geom_type == "Polygon":
        return [geometry]
    if hasattr(geometry, "geoms"):
        return [p for g in geometry.geoms for p in polygons(g)]
    return []

def record(poly, plane, surface, **extra):
    return {"surface": surface, "ring": [list(p) for p in poly.exterior.coords[:-1]],
            "holes": [[list(p) for p in h.coords[:-1]] for h in poly.interiors],
            "plane": plane, "areaMetres2": poly.area, **extra}

roofs = []
source_polys = []
omitted = []
for row in survey["rows"]:
    rings = []
    points = []
    for ring in row["ringsRDAbsoluteZ"]:
        xyz = []
        for x, y, z in ring:
            xx, zz = local(*transform.transform(x, y))
            xyz.append([xx, z - survey["groundDatum"], zz])
        if len(xyz) > 1 and np.linalg.norm(np.asarray(xyz[0]) - xyz[-1]) < 1e-7:
            xyz.pop()
        rings.append([[p[0], p[2]] for p in xyz])
        points.extend(xyz)
    poly = Polygon(rings[0], rings[1:])
    repaired = not poly.is_valid
    if repaired:
        poly = make_valid(poly)
    if poly.area < .0001:
        omitted.append({"surface": row["surface"], "areaMetres2": poly.area,
                        "reason": "Numerical plan sliver below one square centimetre; original retained."})
        continue
    xyz = np.asarray(points)
    mean = xyz.mean(axis=0)
    design = np.column_stack((xyz[:, 0] - mean[0], xyz[:, 2] - mean[2]))
    slopes, _, rank, singular = np.linalg.lstsq(design, xyz[:, 1] - mean[1], rcond=None)
    assert rank == 2, row["surface"]
    plane = [float(slopes[0]), float(slopes[1]), float(mean[1] - slopes[0] * mean[0] - slopes[1] * mean[2])]
    residual = float(np.max(np.abs(xyz[:, 1] - xyz[:, 0] * plane[0] - xyz[:, 2] * plane[1] - plane[2])))
    assert residual < .03, (row["surface"], residual)
    clipped = poly.intersection(native)
    for p in polygons(clipped):
        if p.area < .0001:
            continue
        roofs.append(record(p, plane, row["surface"], fitResidualMetres=residual,
                            sourceHeightRange=[row["relativeZMin"], row["relativeZMax"]],
                            sourcePolygonRepaired=repaired, role="survey-roof-owner"))
        source_polys.append(p)

# The official/current survey differs from the installed outline by about35cm.
# Fill only the uncovered native fringe, with the nearest observed roof plane.
# This prevents a blanket low cap or a whole-building maximum-height slab.
covered = unary_union(source_polys)
missing = native.difference(covered)
closures = []
unresolved = []
pending = [(piece, 0) for gap in polygons(missing) for triangle in triangulate(gap)
           for piece in polygons(triangle.intersection(gap)) if piece.area >= .0001]
while pending:
    piece, depth = pending.pop()
    sample = piece.representative_point()
    vertices = [Point(p) for p in piece.exterior.coords[:-1]]
    owner_distances = [[p.distance(v) for v in vertices] for p in source_polys]
    index = min(range(len(source_polys)), key=lambda i: max(owner_distances[i]))
    owner, distances = roofs[index], owner_distances[index]
    distance = max(distances)
    if distance >= .7:
        # Retain the genuine unobserved garden gap. Only split a near-source
        # fringe that crosses several observed owners; distant holes stay open.
        nearest_sample = min(p.distance(sample) for p in source_polys)
        ring = list(piece.exterior.coords[:-1])
        edge = max(range(len(ring)), key=lambda i: math.dist(ring[i], ring[(i + 1) % len(ring)]))
        a, b = ring[edge], ring[(edge + 1) % len(ring)]
        length = math.dist(a, b)
        if nearest_sample < .7 and length > .35 and depth < 16:
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            nx, ny = -(b[1] - a[1]) / length, (b[0] - a[0]) / length
            line = LineString([(mid[0] - nx * 500, mid[1] - ny * 500),
                               (mid[0] + nx * 500, mid[1] + ny * 500)])
            children = polygons(split(piece, line))
            if len(children) > 1:
                assert abs(sum(p.area for p in children) - piece.area) < 1e-6
                pending.extend((p, depth + 1) for p in children if p.area >= .0001)
                continue
        unresolved.append({"ring": [list(p) for p in piece.exterior.coords[:-1]],
                           "areaMetres2": piece.area, "nearestOwnerDistanceMetres": distance,
                           "nearestSurface": owner["surface"],
                           "representativeLngLat": [anchor[0] + sample.x / kx, anchor[1] - sample.y / 111320]})
        continue
    # Transfer measured rim heights to shifted native vertices. Evaluating
    # an inclined plane past its surveyed crest can still create an unsupported
    # taller gable, even when every plan vertex is within the bounded fringe.
    for patch in polygons(constrained_delaunay_triangles(piece)):
        ring = list(patch.exterior.coords[:-1])
        xyz = []
        for p in ring:
            q = nearest_points(source_polys[index], Point(p))[0]
            h = owner["plane"][0] * q.x + owner["plane"][1] * q.y + owner["plane"][2]
            xyz.append([p[0], h, p[1]])
        xyz = np.asarray(xyz)
        mean = xyz.mean(axis=0)
        slopes = np.linalg.lstsq(np.column_stack((xyz[:, 0] - mean[0], xyz[:, 2] - mean[2])),
                                 xyz[:, 1] - mean[1], rcond=None)[0]
        plane = [float(slopes[0]), float(slopes[1]), float(mean[1] - slopes[0] * mean[0] - slopes[1] * mean[2])]
        closures.append(record(patch, plane, owner["surface"], role="survey-to-native-fringe",
                               nearestOwnerDistanceMetres=distance, ownerVertexDistancesMetres=distances,
                               heightMethod="Nearest observed roof rim; no height extrapolation beyond survey outline",
                               observedHeightRange=owner["sourceHeightRange"]))

spec = {"id": candidate["id"], "digits": "0363100012176752", "label": "Keizersgracht 569–575",
        "anchor": anchor, "bearing": 0, "scale": 1, "footprint": candidate["feature"]["geometry"],
        "nativeRing": native_ring, "suppress": [candidate["id"]], "retain": ["NL.IMBAG.Pand.0363100012176757", "NL.IMBAG.Pand.0363100012176758"],
        "roofs": roofs + closures, "groundNAPMetres": survey["groundDatum"],
        "sourceRoofCount": len(survey["rows"]), "omittedNumericalSlivers": omitted,
        "coverage": {"nativeAreaMetres2": native.area, "surveyNativeIntersectionMetres2": covered.area,
                     "fringeClosureMetres2": sum(r["areaMetres2"] for r in closures),
                     "largestFringeOwnerDistanceMetres": max((r["nearestOwnerDistanceMetres"] for r in closures), default=0),
                     "maxPlaneResidualMetres": max(r["fitResidualMetres"] for r in roofs)},
        "sourcePack": "experiments/canal-belt-continuation-20261007/keizers575-next-source37",
        "supplementarySourcePack": "experiments/canal-belt-continuation-20261007/keizers575-next-source37",
        "sourceCommit": args.source_commit,
        "unresolvedRoofCoverage": unresolved,
        "facades": [], "acceptance": "Survey/native envelope preparation only. Facade source ownership, unresolved roof coverage, roof role/color interpretation and all visual/game checks pending."}
# Current2025 and dated2012 photos show narrow independent chimney stems.
# Raw224/226 broad surfaces are surveyed cap/proxy extents, not loadbearing
# wall polygons. Restore the interrupted main roof with bounded adjacent rim
# heights, preserving original proxy owners verbatim for audit.
structural_pairs = [(r, Polygon(r['ring'], r['holes'])) for r in roofs
                    if r['surface'] in [235, 237]]
chimney_replacements = []
for proxy in [r for r in roofs + closures if r['surface'] in [224, 226]]:
    for triangle in polygons(constrained_delaunay_triangles(Polygon(proxy['ring'], proxy['holes']))):
        ring = list(triangle.exterior.coords[:-1])
        xyz, support = [], []
        for p in ring:
            owner, poly = min(structural_pairs, key=lambda pair: pair[1].distance(Point(p)))
            q = nearest_points(poly, Point(p))[0]
            height = owner['plane'][0] * q.x + owner['plane'][1] * q.y + owner['plane'][2]
            xyz.append([p[0], height, p[1]])
            support.append({'sourceSurface': owner['surface'], 'rimPoint': [q.x, q.y], 'height': height})
        xyz = np.asarray(xyz)
        mean = xyz.mean(axis=0)
        slopes = np.linalg.lstsq(np.column_stack((xyz[:, 0]-mean[0], xyz[:, 2]-mean[2])), xyz[:, 1]-mean[1], rcond=None)[0]
        plane = [float(slopes[0]), float(slopes[1]), float(mean[1]-slopes[0]*mean[0]-slopes[1]*mean[2])]
        chimney_replacements.append(record(triangle, plane, -1000-len(chimney_replacements),
            role='photo-supported-main-roof-restoration', replacedProxySurface=proxy['surface'],
            boundedObservedRimSupport=support, heightMethod='Nearest adjacent structural front/rear roof rim, no equipment-cap wall ownership'))
spec['chimneyProxyDecision'] = {
    'excludeSupportSurfaces': [224,226],
    'reason': 'CurrentJan2025 and dated2012 show four slender masonry stems with independently visible stone/copper caps. Broad roof224/226 footprints represent equipment/proxy extent, not full-width exterior/support wall.',
    'sourceEvidence': ['processed/opposite-b_20250115_1329_Track12_Sphere_00032.jpg','raw/fullfront2012.webp'],
    'originalSurveyPreserved': True,
    'roofRestorationMethod': 'Only original224/226 roof footprints restored using nearest measured structural235/237 rim heights. Original proxy polygons/planes remain in roofs for provenance; builder excludes their tops/supports.'}
spec['chimneyRoofReplacements'] = chimney_replacements

args.output.write_text(json.dumps(spec, indent=2) + "\n")
print(json.dumps({"roofs": len(roofs), "closures": len(closures), "omitted": omitted, "coverage": spec["coverage"], "unresolved": unresolved}))
if unresolved:
    raise SystemExit("Unresolved roof coverage preserved; no blanket cap or author acceptance.")
