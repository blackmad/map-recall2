"""Attach exact frozen source RD frames after owner/revision/vertex binding checks."""
import json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
entries=[]
for path in ('scripts/blender/jordaan-pois-source.json','scripts/blender/expansion/source-manifest.json'):
 entries.extend(json.loads((ROOT/path).read_text())['entries'])
paths=list((ROOT/'scripts/blender/building_lib/recipes').glob('*.json'))+list((ROOT/'scripts/blender/expansion/recipes').glob('*.json'))
staged=ROOT/'artifacts/l37-scope-correction/lauriergracht-37.json'
if staged.exists():paths.append(staged)
for path in paths:
 recipe=json.loads(path.read_text())
 if recipe.get('synthetic'):continue
 entry=next((e for e in entries if e['id']==recipe['id']),None)
 if not entry:
  print('HELD no exact source owner',recipe['id']);continue
 owner=entry['owner'];assert owner['id']==recipe['buildingId'] and owner['geometryRevision']==recipe['geometryRevision'],path
 source=owner['geometry']['building'];origin=source['coordinateFrame']['originRD'];a,b=recipe['placement']['frontageLocal']
 width=math.dist(a,b);u=[(b[k]-a[k])/width for k in (0,1)];det=recipe['placement']['inputFrameDeterminant'];v=[-u[1]*det,u[0]*det]
 assert abs(det+1)<1e-9,'Unsupported source frame handedness'
 assert len(recipe['sourceShell']['surfaces'])==len(source['surfaces'])
 for s,raw in zip(recipe['sourceShell']['surfaces'],source['surfaces']):
  for ring,rawring in zip(s['rings'],raw['rings']):
   assert len(ring)==len(rawring)
   for p,q in zip(ring,rawring):
    assert math.hypot(a[0]+p[0]*u[0]+p[1]*v[0]-q[0],a[1]+p[0]*u[1]+p[1]*v[1]-q[2])<.001,(path,p,q)
 recipe['placement']['sourceRDFrame']={'anchorRD':[origin['x']+a[0],origin['y']-a[1]],'xAxisRD':[u[0],-u[1]],'yAxisRD':[v[0],-v[1]],'geometryRevision':recipe['geometryRevision'],'buildingId':recipe['buildingId'],'source':'Frozen 3DBAG coordinateFrame.originRD and ordered physical frontage; normalized source vertices checked within 1 mm.'}
 path.write_text(json.dumps(recipe,indent=2)+'\n');print(recipe['id'],str(path.relative_to(ROOT)))
