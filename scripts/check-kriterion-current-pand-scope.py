"""Current decoded asset ground masonry union versus BOTH official PDOK parents.
Run check-kriterion-runtime-footprint.ts to unique current-decoded-world-mesh.json first.
Historical old OSM footprint proof is not evidence for this asset.
"""
import json, math, hashlib
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import unary_union
root=Path('.');folder=root/'artifacts/kriterion-rear-research'
mesh=json.loads((folder/'current-decoded-world-mesh.json').read_text());spec=next(x for x in json.loads((root/'src/canalRecall/landmarks/manualCatalogue.json').read_text())if x['id']=='kriterion');lon,lat=spec['surveyed']['anchor']
def world(p):return [(p[0]-lon)*111320*math.cos(math.radians(lat)),(p[1]-lat)*111320]
parents=[]
for name in ['front','rear']:
 d=json.loads((root/f'scripts/landmarks/kriterion-{name}-roof-zones.json').read_text());geom=d['footprint'];polygon=Polygon([world(p)for p in geom['coordinates'][0]],[[world(p)for p in h]for h in geom['coordinates'][1:]]);parents.append((d['pandId'],polygon))
masonry=[];projected=[]
for t in mesh['triangles']:
 p=Polygon([v[:2]for v in t['points']]);
 if p.area<1e-9:continue
 if t['material'] in {'brick','greyBrick'}:projected.append(p)
 if t['material'] in {'brick','greyBrick'}and all(abs(v[2])<.025 for v in t['points']):masonry.append(p)
body=unary_union(masonry);whole=unary_union([p for _,p in parents]);all_masonry=unary_union(projected);asset=(root/'public/canal-drive/models/kriterion.glb').read_bytes();sha=hashlib.sha256(asset).hexdigest()
rows=[]
for id,p in parents:rows.append(dict(pandId=id,officialAreaMetres2=p.area,groundMasonryCoveredFraction=p.intersection(body).area/p.area,missingMetres2=p.difference(body).area))
result=dict(status='Current decoded geometry scope measured; visual acceptance separate',assetSha256=sha,assetVersion=sha[:16],bytes=len(asset),runtimeModelRotationDegrees=mesh['placement']['modelRotationDegrees'],groundTriangleToleranceMetres=.025,groundMasonryTriangleCount=len(masonry),currentParents=rows,officialUnionAreaMetres2=whole.area,groundMasonryUnionAreaMetres2=body.area,groundMasonryCoveredFraction=body.intersection(whole).area/whole.area,groundMasonryMissingMetres2=whole.difference(body).area,groundMasonryOutsideOfficialUnionMetres2=body.difference(whole).area,allHeightBrickProjectionOutsideUnionMetres2=all_masonry.difference(whole).area,notes=['True decoded ground-facing brick triangles through runtime matrix, not roof silhouette or facade detail','Small missing slivers include current BAG versus AHN roof-zone boundary revisions and quantization','Existing old~623m2 runtime-footprint-proof.json remains historical; no overwrite','No conclusion about source-font fit, courtyard visibility, neighbors or performance'])
(folder/'current-two-pand-ground-proof.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
assert result['groundMasonryCoveredFraction']>.999
assert result['groundMasonryOutsideOfficialUnionMetres2']<.1
