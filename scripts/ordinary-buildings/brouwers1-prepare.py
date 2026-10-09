"""Prepare the exact native hospital envelope from cached survey inputs.

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
parser.add_argument("--output", type=Path, default=Path("scripts/ordinary-buildings/brouwers1-spec.json"))
parser.add_argument("--source-commit", default="62af8c1d3642f1a50cda830ce7921c27006aac5d", help="Verified private archive commit; override for later source admission")
args = parser.parse_args()
candidate = json.loads((args.source / "candidate-derived.json").read_text())
survey = json.loads((args.source / "processed/roof-surfaces.json").read_text())
anchor = candidate["center"]
kx = 111320 * math.cos(math.radians(anchor[1]))

def local(lng, lat):
    return [(lng - anchor[0]) * kx, -(lat - anchor[1]) * 111320]

native_ring = [local(*p) for p in candidate["feature"]["geometry"]["coordinates"][0][:-1]]
native_ring=[p for i,p in enumerate(native_ring) if i==0 or math.dist(p,native_ring[i-1])>1e-7]
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
# Raw LoD0 minus LoD2.2 ground is a independently verified rear garden,
# not survey missing roofs. Do not transfer outer quantization fringe into it.
raw=json.loads((args.source/'raw/3dbag.json').read_text());tr=raw['metadata']['transform'];verts=[[v[i]*tr['scale'][i]+tr['translate'][i] for i in range(3)] for v in raw['feature']['vertices']]
ground0=[];ground22=[]
for o in raw['feature']['CityObjects'].values():
 for g in o.get('geometry',[]):
  if g['lod'] not in ['0','2.2']:continue
  faces=g['boundaries'] if g['type']=='MultiSurface' else g['boundaries'][0]
  for i,face in enumerate(faces):
   if g['lod']=='2.2':
    sv=g['semantics']['values'][0][i]
    if sv is None or g['semantics']['surfaces'][sv]['type']!='GroundSurface':continue
   rings=[[local(*transform.transform(*verts[v][:2])) for v in ring] for ring in face]
   poly=Polygon(rings[0],rings[1:]);poly=make_valid(poly) if not poly.is_valid else poly
   (ground0 if g['lod']=='0' else ground22).append(poly)
garden=unary_union(ground0).difference(unary_union(ground22)).intersection(native)
covered = unary_union(source_polys)
missing = native.difference(covered).difference(garden)
closures = []
unresolved = []
pending = [(piece, 0) for gap in polygons(missing) for triangle in triangulate(gap)
           for piece in polygons(triangle.intersection(gap)) if piece.area >= .0001]
while pending:
    piece, depth = pending.pop()
    sample = piece.representative_point()
    vertices = [Point(p) for p in piece.exterior.coords[:-1]]
    owner_distances = [[p.distance(v) for v in vertices] for p in source_polys]
    index = min((i for i in range(len(source_polys)) if roofs[i]["surface"]!=246), key=lambda i: max(owner_distances[i]))
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

scope=json.loads((args.source/'processed/scope-decision.json').read_text())
# Source-edge roof step support split at every crossing owner boundary.
# Neighbor heights come from actual adjacent owner planes. Equipment patches
# gain only a local support above the lower roof, never a ground-height slab.
owners=roofs+closures
supports=[]
for r in owners:
 poly=Polygon(r['ring'],r['holes']);ring=r['ring'];area=sum(p[0]*ring[(i+1)%len(ring)][1]-p[1]*ring[(i+1)%len(ring)][0] for i,p in enumerate(ring));sgn=1 if area>0 else -1
 for i,a in enumerate(ring):
  b=ring[(i+1)%len(ring)];length=math.dist(a,b)
  if length<.005:continue
  tangent=((b[0]-a[0])/length,(b[1]-a[1])/length);normal=(sgn*tangent[1],-sgn*tangent[0]);line=LineString([a,b]);cuts=[0,length]
  for n in owners:
   for geom in [line.intersection(Polygon(n['ring'],n['holes']).boundary)]:
    pieces=[geom] if geom.geom_type in ['Point','LineString'] else list(getattr(geom,'geoms',[]))
    for q in pieces:
     if q.geom_type=='Point':cuts.append(line.project(q))
     elif q.geom_type=='LineString':cuts.extend(line.project(Point(p)) for p in q.coords)
  cuts=sorted(set(round(c,8) for c in cuts))
  for u0,u1 in zip(cuts,cuts[1:]):
   if u1-u0<.01:continue
   mid=line.interpolate((u0+u1)/2);outside=Point(mid.x+normal[0]*.02,mid.y+normal[1]*.02)
   if not native.contains(outside) or native.boundary.distance(mid)<.15:continue
   candidates=[n for n in owners if n is not r and Polygon(n['ring'],n['holes']).buffer(.001).contains(outside)]
   at=lambda n,p:n['plane'][0]*p[0]+n['plane'][1]*p[1]+n['plane'][2]
   upper=at(r,(mid.x,mid.y));lower=max((at(n,(mid.x,mid.y)) for n in candidates),default=0)
   if upper-lower<.10:continue
   n=max(candidates,key=lambda n:at(n,(mid.x,mid.y))) if candidates else None
   p=[a[0]+tangent[0]*u0,a[1]+tangent[1]*u0];q=[a[0]+tangent[0]*u1,a[1]+tangent[1]*u1]
   highs=[at(r,p),at(r,q)];lows=[at(n,p),at(n,q)] if n else [0,0]
   if min(highs[k]-lows[k] for k in range(2))<.01:continue
   points=[[p[0],lows[0],p[1]],[q[0],lows[1],q[1]],[q[0],highs[1],q[1]],[p[0],highs[0],p[1]]]
   if area>0:points.reverse()
   supports.append({'upper':r['surface'],'lower':n['surface'] if n else 'garden/open-ground','points':points,'method':'Exact source edges split at all owner crossings; source-supported local height difference'})
spec={"id":candidate["id"],"digits":"0363100012171101","label":"Brouwersgracht 1–5 / Singel 16, 22–26","anchor":anchor,"bearing":0,"scale":1,"footprint":candidate["feature"]["geometry"],"nativeRing":native_ring,"suppress":[candidate["id"]],"retain":scope["retainNeighbors"],"roofs":roofs+closures,"supports":supports,"gardenOpenings":[record(p,[0,0,0],"raw-ground-exclusion") for p in polygons(garden)],"groundNAPMetres":survey["groundDatum"],"sourceRoofCount":len(survey["rows"]),"omittedNumericalSlivers":omitted,"coverage":{"nativeAreaMetres2":native.area,"surveyNativeIntersectionMetres2":covered.area,"fringeClosureMetres2":sum(r["areaMetres2"] for r in closures),"largestFringeOwnerDistanceMetres":max((r["nearestOwnerDistanceMetres"] for r in closures),default=0),"maxPlaneResidualMetres":max(r["fitResidualMetres"] for r in roofs)},"sourcePack":"experiments/canal-belt-continuation-20261007/next-ordinary37-source42/0363100012171101","sourceCommit":args.source_commit,"unresolvedRoofCoverage":unresolved,"acceptance":"Full architecture draft; independent source/gallery/native game/pan/performance acceptance pending"}
spec['streetSideGroups']=[{'group':'white-double-warehouse','nativeStart':2,'nativeEnd':3,'widthMetres':math.dist(native_ring[2],native_ring[3]),'axes':6,'headGroups':[3,3],'source':'Original municipal recording2025-06-16_03-46-32_01245/01246; independently projected native vertices; current00892/00893 detail','confidence':'high source group and axis count; approximate joinery/silhouette dimensions'},{'group':'brick-window-band-front','nativeStart':3,'nativeEnd':4,'widthMetres':math.dist(native_ring[3],native_ring[4]),'source':'Same original01245/01246 scope projection and near00892 detail','traits':['white lower facade/spandrels','broad multi-pane horizontal bands','brick upper face','smaller paired top window','straight/slightly sloping termination','restrained hoist'],'confidence':'high source group; approximate band dimensions'},{'group':'Singel16 corner','nativeStart':0,'nativeEnd':2,'frontAxes':6,'source':'5255/current00898/00899'},{'group':'Singel26','nativeStart':14,'nativeEnd':15,'frontAxes':3,'source':'5260/current00905/00906'},{'group':'Singel24','nativeStart':15,'nativeEnd':17,'frontAxes':3,'source':'5259/current00903/00905'},{'group':'Singel22','nativeStart':17,'nativeEnd':21,'frontAxes':3,'source':'5258/current00902/00903'}]
spec['unadmittedSourceSurfaces']=[{'surface':246,'sourcePlanMetres2':.453,'sourceHeightMetres':[12.2915009598732,12.3485009598732],'visibleGeometry':'Raised roof and two talllocal supports omitted; low245 envelope underneath retained','reason':'Independent currentaerial overlay at shadowed retainedneighborboundary/treecanopy has no corroborated isolatedchimney; rawroof/wall semanticclassification alone does not prove triangular9m shaft','cause':'Uncertain neighbor/equipment/surveyfit patch; do not label definitively tree','confidence':'High scoped omission decision pending architectural evidence; low causal identity','evidence':'/tmp/brouwers1-independent-review37/roof246-aerial-overlay.png; original privately archived current-pdok-aerial.jpg and raw3dbagWallSurfaces35/203/204'}]
args.output.write_text(json.dumps(spec,indent=2)+'\n')
print(json.dumps(spec['coverage']))
