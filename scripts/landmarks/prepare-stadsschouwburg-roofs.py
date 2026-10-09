"""Native original roof assemblies reconstructed from surveyed plan/plane evidence, not imported source meshes."""
import json,math
from pathlib import Path
from pyproj import Transformer
from shapely.geometry import Polygon
from shapely.ops import unary_union
p=Path(__file__).parent;coupled=json.load(open(p/'melkweg-coupled-footprints.json'));spec=next(s for s in json.load(open(p/'industrial-theater-specs.json')) if s['id']=='stadsschouwburg');a=spec['surveyed']['anchor'];h=math.radians(spec['footprint']['headingDegrees']);K=111320*math.cos(math.radians(a[1]));tx=Transformer.from_crs(28992,4326,always_xy=True)
raw=json.load(open('/Users/blackmad/Code/map-recall2-worktrees/source-archive/models/stadsschouwburg/files/stadsschouwburg-current-3dbag.json'));tr=raw['metadata']['transform'];ground=raw['feature']['CityObjects']['NL.IMBAG.Pand.0363100012168738']['attributes']['b3_h_maaiveld'];verts=[]
for v in raw['feature']['vertices']:
 q=[v[i]*tr['scale'][i]+tr['translate'][i] for i in range(3)];lng,lat=tx.transform(q[0],q[1]);e=(lng-a[0])*K;s=(a[1]-lat)*111320;verts.append([e*math.sin(h)-s*math.cos(h),e*math.cos(h)+s*math.sin(h),q[2]-ground])
r=coupled['stadsschouwburgNativePolygons'][0];pand=Polygon(r[0],r[1:]);frontScale=coupled['historicFrontFit']['scaleX'];frontCenter=coupled['historicFrontFit']['centerLocalX'];w=spec['footprint']['lengthMetres'];d=spec['footprint']['widthMetres'];front=d/2-.4;main=w*.64
owned=[Polygon(q['ring'],q['holes']) for q in coupled['historicSmallTowerBodies']]
for x in [-main*.54,main*.54]:
 cx=x*frontScale+frontCenter;cz=front-3.8;owned.append(Polygon([[cx-3.4*frontScale,cz-3.4],[cx+3.4*frontScale,cz-3.4],[cx+3.4*frontScale,cz+3.4],[cx-3.4*frontScale,cz+3.4]]))
towers=unary_union(owned).intersection(pand)
def saved(poly):return {'ring':list(map(list,list(poly.exterior.coords)[:-1])),'holes':[list(map(list,list(h.coords)[:-1])) for h in poly.interiors]}
def fit(vs):
 cx=sum(q[0] for q in vs)/len(vs);cz=sum(q[1] for q in vs)/len(vs);cy=sum(q[2] for q in vs)/len(vs);xx=zz=xz=xy=zy=0
 for x,z,y in vs:
  dx=x-cx;dz=z-cz;dy=y-cy;xx+=dx*dx;zz+=dz*dz;xz+=dx*dz;xy+=dx*dy;zy+=dz*dy
 det=xx*zz-xz*xz
 if abs(det)<1e-10:return [0,0,cy],max(abs(v[2]-cy) for v in vs)
 A=(xy*zz-zy*xz)/det;B=(zy*xx-xy*xz)/det;C=cy-A*cx-B*cz
 return [A,B,C],max(abs(A*x+B*z+C-y) for x,z,y in vs)
g=raw['feature']['CityObjects']['NL.IMBAG.Pand.0363100012168738-0']['geometry'][-1];parts=[];facts=[];residuals=[];unclipped=[]
for idx,(face,si) in enumerate(zip(g['boundaries'][0],g['semantics']['values'][0])):
 sem=g['semantics']['surfaces'][si]
 if sem['type']!='RoofSurface':continue
 rings=[[verts[k] for k in ring] for ring in face];q=Polygon([v[:2] for v in rings[0]],[[v[:2] for v in rr] for rr in rings[1:]]).buffer(0);vs=[v for rr in rings for v in rr];plane,res=fit(vs);facts.append({'face':idx,'areaM2':q.area,'sourceSlopeDegrees':sem.get('b3_hellingshoek'),'sourceMinM':min(v[2] for v in vs),'sourceMaxM':max(v[2] for v in vs),'nativeCenter':list(q.centroid.coords)[0],'maxPlaneResidualM':res})
 if q.area<.01:continue
 # High-res survey rings can carry mixed roof/vertical boundary residues; retain failures rather than huge fitted fins.
 if res>.2:residuals.append({'face':idx,'residualM':res,'treatment':'Use bounded median of current planar roof vertices; do not extend mixed-height source ring into unsupported fins.'});plane=[0,0,sorted(v[2] for v in vs)[len(vs)//2]]
 q=q.intersection(pand).difference(towers).buffer(0);polys=list(q.geoms) if q.geom_type=='MultiPolygon' else [q]
 for k,poly in enumerate(polys):
  if poly.area<.00001:continue
  ys=[plane[0]*x+plane[1]*z+plane[2] for x,z in poly.exterior.coords];part={'id':'historic-roof-'+str(idx)+'-'+str(k),'sourceFace':idx,**saved(poly),'plane':plane,'bottom':0,'eaveMinM':min(ys),'eaveMaxM':max(ys),'sourcePlaneResidualM':res,'material':'frame' if sem.get('b3_hellingshoek',0)<30 and q.area>50 else 'slate','originalAuthorship':'Original native footprint shell and fitted roof-plane reconstruction. No source triangulation/mesh imported.'};parts.append(part)
union=unary_union([Polygon(x['ring'],x['holes']) for x in parts]);missing=pand.difference(union.union(towers));repairs=[]
for i,q in enumerate(getattr(missing,'geoms',[missing])):
 if q.area<1e-8:continue
 candidates=[t for t in parts if Polygon(t['ring'],t['holes']).area>30 and abs(t['plane'][0])+abs(t['plane'][1])<1.5];near=min(candidates,key=lambda t:q.distance(Polygon(t['ring'],t['holes'])));ys=[near['plane'][0]*x+near['plane'][1]*z+near['plane'][2] for x,z in q.exterior.coords];repairs.append({'id':'historic-boundary-rounding-'+str(i),'sourceFace':near['sourceFace'],**saved(q),'plane':near['plane'],'bottom':0,'eaveMinM':min(ys),'eaveMaxM':max(ys),'sourcePlaneResidualM':0,'material':near['material'],'roundingCorrection':q.area})
parts+=repairs
j={'id':'stadsschouwburg-native-roofs','sourceBagId':'0363100012168738','sourceUrl':'https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012168738','sourceGroundNAP':ground,'captureSource':'ahn5','nativeLocalBasis':'Established historic local basis, exact8738 footprint; glTFY up. SourceRD transformedEPSG4326 then projected, centered least squares planes.','parts':parts,'authoredTowerOwnership':[saved(q) for q in owned],'roofFacts':facts,'mixedRoofPlaneFailures':residuals,'outlineRoundingRepairsM2':missing.area,'registerUrl':'https://monumentenregister.cultureelerfgoed.nl/monumenten/46503','architecturalAssertions':['Separate audience building and higher independent stagehouse','Audience mansard with three round roof dormers and central ventilator','Stagehouse shallow gable; slate/zinc roof mixture','Long side facades twelve window axes, basement apertures and varied risalits','Covered side passages and lower service wings'],'limits':['Front/ornament original authored approximations retained; source roof shapes do not establish facade ornament dimensions.','Ground1.269NAP is source survey statistic; common glTFground0 retained, relative roofs are source-ground differences.','Roof-plane residual failures listed explicitly; no source equipment maximum applied to entire complex.']}
(p/'stadsschouwburg-native-roofs.json').write_text(json.dumps(j,indent=2)+'\n');print({'parts':len(parts),'pandArea':pand.area,'surveyRoofArea':union.area,'towerOwnedArea':towers.area,'outlineResidue':missing.area,'mixedPlaneFailures':residuals})
