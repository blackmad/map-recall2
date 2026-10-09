"""Original plan reconstruction from official parent rings; source mesh faces inform height zones only."""
import json, math
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import unary_union
from pyproj import Transformer
P=Path(__file__).parent
archive=Path('/Users/blackmad/Code/map-recall2-worktrees/source-archive/models/melkweg')
j=json.load(open(archive/'feedback-survey-20261007/bag-neighbors.json'))
survey=json.load(open(P/'melkweg-footprints.json')); anchor=survey['anchorLngLat'];K=111320*math.cos(math.radians(anchor[1]))
def native(r):return [[(x-anchor[0])*K,(anchor[1]-y)*111320] for x,y,*_ in r]
def saved(poly):return {'ring':list(map(list,list(poly.exterior.coords)[:-1])),'holes':[list(map(list,list(r.coords)[:-1])) for r in poly.interiors]}
bag={f['properties']['identificatie']:f for f in j['features']}
hall=Polygon(native(bag['0363100012173457']['geometry']['coordinates'][0]))
raw=json.load(open('/Users/blackmad/Code/map-recall2/artifacts/melkweg-web-reference-20261007/3dbag-retained-73457.json'));tr=raw['metadata']['transform'];verts=raw['feature']['vertices'];tx=Transformer.from_crs(28992,4326,always_xy=True)
vs=[]
for v in verts:
 xyz=[v[i]*tr['scale'][i]+tr['translate'][i] for i in range(3)];ll=tx.transform(*xyz[:2]);vs.append([*native([ll])[0],xyz[2]-.378])
g=raw['feature']['CityObjects']['NL.IMBAG.Pand.0363100012173457-0']['geometry'][-1];zones=[];notes=[];lowzones=[];highzones=[]
for face,idx in zip(g['boundaries'][0],g['semantics']['values'][0]):
 sem=g['semantics']['surfaces'][idx]
 if sem['type']!='RoofSurface':continue
 pts=[vs[i] for i in face[0]];poly=Polygon([p[:2] for p in pts]).buffer(0).intersection(hall);z=sorted(p[2] for p in pts)[len(pts)//2]
 if poly.area<1:continue
 notes.append({'areaM2':poly.area,'medianRoofM':z,'minM':min(p[2] for p in pts),'maxM':max(p[2] for p in pts)})
 if z>25:zones.append(poly);highzones.append((poly,z))
 else:lowzones.append((poly,z))
upper=unary_union(zones).intersection(hall).buffer(0)
# Rounded survey slices can leave tiny slivers; native exact footprint remains authoritative.
polys=list(upper.geoms) if upper.geom_type=='MultiPolygon' else [upper]
parts=[]
for i,(p,z) in enumerate(highzones):
 ps=list(p.geoms) if p.geom_type=='MultiPolygon' else [p]
 for k,q in enumerate(ps):
  if q.area>1:parts.append({'id':'rabozaal-raised-native-'+str(i)+'-'+str(k),**saved(q),'bottom':18.3,'top':round(z,2),'heightEvidence':'Component roof median, source plane slope simplified into original bounded flat volume; not equipment maximum.'})
# Preserve actual low remainder; slanted narrow transition surface13.1m is not a whole hall.
low=hall.difference(upper);lows=list(low.geoms) if low.geom_type=='MultiPolygon' else [low]
lowparts=[]
for i,(p,z) in enumerate(lowzones):
 p=p.difference(upper); ps=list(p.geoms) if p.geom_type=='MultiPolygon' else [p]
 for k,q in enumerate(ps):
  if q.area>1:lowparts.append({'id':'rabozaal-low-connector-'+str(i)+'-'+str(k),**saved(q),'bottom':15 if z>18 else 0,'top':round(z,2)})
# Registered outline and rounded roof projection differ by narrow boundary strips.
# Close projected ownership at the documented15m foyer floor, retaining all air below.
covered=unary_union([Polygon(p['ring'],p['holes']) for p in parts+lowparts])
residue=hall.difference(covered)
for i,q in enumerate(getattr(residue,'geoms',[residue])):
 if q.area>1e-8:lowparts.append({'id':'rabozaal-native-foyer-floor-edge-'+str(i),**saved(q),'bottom':14.8,'top':15.0,'heightEvidence':'Narrow survey-outline reconciliation at source-documented15m foyer/floor datum; no new tall/ground-up volume.'})

core=upper.buffer(-3,join_style=2);cores=list(core.geoms) if core.geom_type=='MultiPolygon' else [core]
cores=[{'id':'rabozaal-inset-core-'+str(i),**saved(p),'bottom':0,'top':15,'approximation':'Three metre source-photo guided inset, not surveyed facade position.'} for i,p in enumerate(cores) if p.area>1]
# Arcam exterior/text: distinct widened blue glass corridor at8m, outside slender lower core.
corePlans=[Polygon(p['ring'],p['holes']) for p in cores]+[Polygon(p['ring'],p['holes']) for p in survey['parts'] if p['id']=='modern-glazed-lower-core']
modernPlans=[Polygon(p['ring'],p['holes']) for p in parts+lowparts]+[Polygon(p['ring'],p['holes']) for p in survey['parts'] if p['id'].startswith('east-high-hall')]
wideCorridor=unary_union(corePlans).buffer(1.25,join_style=2).intersection(unary_union(modernPlans)).buffer(0)
corridors=[{'id':'shared-blue-corridor-'+str(i),**saved(p),'bottom':8.0,'top':10.2,'approximation':'Source-explicit8m floor;2.2m band height and1.25m core projection are bounded Arcam exterior-photo guided proportions, not surveyed facade dimensions.'} for i,p in enumerate(getattr(wideCorridor,'geoms',[wideCorridor])) if p.area>1]

# Existing historic mesh basis is east/south rotated by heading; retain its placement.
sp=json.load(open(P/'industrial-theater-specs.json'));sp=next(s for s in sp if s['id']=='stadsschouwburg');a=sp['surveyed']['anchor'];h=math.radians(sp['footprint']['headingDegrees']);lk=111320*math.cos(math.radians(a[1]))
stadr=[]
for ring in bag['0363100012168738']['geometry']['coordinates']:
 out=[]
 for x,y in ring[:-1]:
  e=(x-a[0])*lk;s=(a[1]-y)*111320;out.append([e*math.sin(h)-s*math.cos(h),e*math.cos(h)+s*math.sin(h)])
 stadr.append(out)
stPoly=Polygon(stadr[0],stadr[1:]);frontScale=26.118893121515473/(sp['footprint']['lengthMetres']*.86+5.1);frontCenter=-4.039757103485408;front=sp['footprint']['widthMetres']/2-.4;main=sp['footprint']['lengthMetres']*.64;frontBody=Polygon([[frontCenter-main*frontScale/2,front-12],[frontCenter+main*frontScale/2,front-12],[frontCenter+main*frontScale/2,front],[frontCenter-main*frontScale/2,front]]).intersection(stPoly)
smallTowerBodies=[]
for x in [-sp['footprint']['lengthMetres']*.43,sp['footprint']['lengthMetres']*.43]:
 cx=frontCenter+x*frontScale;cz=51.95-5.1/2-.15;smallTowerBodies.append(saved(Polygon([[cx-5.1*frontScale/2,cz-2.55],[cx+5.1*frontScale/2,cz-2.55],[cx+5.1*frontScale/2,cz+2.55],[cx-5.1*frontScale/2,cz+2.55]]).intersection(stPoly)))
result={'modelId':'melkweg-coupled-rabozaal','sourceUrls':['https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012173457','https://arcam.nl/architectuur-gids/rabozaal-melkweg/','https://ita.nl/nl/verhuur/nieuwe-foyer/'], 'anchorLngLat':anchor,'hallBagId':'0363100012173457','hallExact':saved(hall),'upperParts':parts,'lowerParts':lowparts,'insetCores':cores,'corridorParts':corridors,'roofSummary':notes,'outlineCorrection':{'previousDeficitM2':residue.area,'treatment':'Thin14.8–15m source-datum floor edge only; high roof zones unchanged, void below preserved'},'stadsschouwburgNativePolygons':[stadr],'stadsschouwburgBagId':'0363100012168738','historicFrontBody':saved(frontBody),'historicSmallTowerBodies':smallTowerBodies,'historicFrontFit':{'frontWidthM':26.118893121515473,'centerLocalX':frontCenter,'scaleX':frontScale,'groundRecessPreserved':True},'limits':['Core inset and component floor15m are photo guided, exact primary facade extent and roof slope require native review.','No alias destinations; root retains existing genuine POI identities.','Historical front detailing remains existing authored approximation pending its separate review.']}
(P/'melkweg-coupled-footprints.json').write_text(json.dumps(result,indent=2)+'\n')
print({'hallArea':hall.area,'upperArea':upper.area,'lowArea':low.area,'coreArea':core.area,'roofZones':notes})
