import json
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import unary_union
root=Path(__file__).resolve().parents[2]
data=json.loads((root/'artifacts/melkweg-coupled/decoded-top-ownership-triangles.json').read_text())
report=[]
for plane,other in [(15,'slate'),(18.3,'bronze')]:
    triangles=[t for t in data['triangles'] if t['plane']==plane]
    ownerTriangles=[Polygon(t['ring']) for t in triangles if t['material']=='dark']
    dark=unary_union(ownerTriangles)
    alternate=unary_union([Polygon(t['ring']) for t in triangles if t['material']==other])
    overlap=dark.intersection(alternate).area
    report.append({'planeM':plane,'owner':'dark','removedDuplicateMaterial':other,'decodedCrossMaterialOverlapM2':overlap,'decodedOwnerDuplicateAreaM2':max(0,sum(p.area for p in ownerTriangles)-dark.area),'decodedOwnerPlanAreaM2':dark.area,'decodedAlternatePlanAreaM2':alternate.area,'triangles':len(triangles)})
out=root/'artifacts/melkweg-coupled/decoded-top-ownership-proof.json'
out.write_text(json.dumps({'asset':data['path'],'planes':report,'toleranceM':.004},indent=2)+'\n')
print(report)
assert all(r['decodedCrossMaterialOverlapM2']<1e-6 and r['decodedOwnerDuplicateAreaM2']<1e-6 for r in report), 'Coplanar ownership conflict'
