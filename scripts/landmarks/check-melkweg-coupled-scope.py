import json
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import unary_union
p=Path(__file__).parent;s=json.load(open(p/'melkweg-footprints.json'));c=json.load(open(p/'melkweg-coupled-footprints.json'))
f=lambda x:Polygon(x['ring'],x['holes']);hall=f(c['hallExact']);hp=unary_union([f(x) for x in c['upperParts']+c['lowerParts']]);melk=Polygon(s['exactBagRing']);mp=unary_union([f(x) for x in s['parts']]);r=c['stadsschouwburgNativePolygons'][0];st=Polygon(r[0],r[1:]);historic={}
for v in ['coupled','legacy-before']:
 j=json.load(open('artifacts/melkweg-coupled/historic-large-ground-boxes-'+v+'.json'));qs=[Polygon(x['ring']) for x in j]
 if v=='coupled':
  roofPath=p/'stadsschouwburg-native-roofs.json'
  if roofPath.exists():
   roofs=json.load(open(roofPath));qs=[f(x) for x in roofs['parts']]+[f(x).intersection(st) for x in roofs['authoredTowerOwnership']]
  else:qs.extend([f(c['historicFrontBody']),*[f(x) for x in c['historicSmallTowerBodies']]])
 historic[v]={'largeGroundVolumes':len(qs),'outsideParentM2':unary_union(qs).difference(st).area,'perVolumeOutsideM2':[q.difference(st).area for q in qs]}
j={'hallExactAreaM2':hall.area,'hallAuthoredAreaM2':hp.area,'hallMissingM2':hall.difference(hp).area,'hallOutsideM2':hp.difference(hall).area,'melkExactAreaM2':melk.area,'melkAuthoredAreaM2':mp.area,'melkMissingM2':melk.difference(mp).area,'melkOutsideM2':mp.difference(melk).area,'historicGroundAllocation':historic,'corridorApproximation':{'floorM':8,'topM':10.2,'projectionM':1.25,'source':'Arcam explicit8m floor/current exterior original; other dimensions photo-guided'},'remainingHistoricPrecisionResidueM2':historic['coupled']['outsideParentM2']}
Path('artifacts/melkweg-coupled/scope-check.json').write_text(json.dumps(j,indent=2)+'\n');print(j['historicGroundAllocation'])
if max(j['hallMissingM2'],j['hallOutsideM2'],j['melkMissingM2'],j['melkOutsideM2'],historic['coupled']['outsideParentM2'])>1e-8:raise RuntimeError('Native scope mismatch')
