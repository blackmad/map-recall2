"""Cached original survey -> native scale1 original geometry parameters. No source download."""
import argparse,json,math
from pathlib import Path
import numpy as np
from pyproj import CRS,Transformer
from shapely.geometry import Polygon,Point
from shapely.ops import unary_union
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,default=Path('scripts/ordinary-buildings/heren208-spec.json'));a=p.parse_args()
c=json.loads((a.source/'candidate-derived.json').read_text());s=json.loads((a.source/'processed/roof-surfaces.json').read_text());anchor=c['center'];kx=111320*math.cos(math.radians(anchor[1]))
rd=CRS.from_proj4('+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs');tr=Transformer.from_crs(rd,4326,always_xy=True)
def loc(lng,lat):return [(lng-anchor[0])*kx,-(lat-anchor[1])*111320]
def xyz(v):
 x,z=loc(*tr.transform(v[0],v[1]));return [x,v[2]-s['groundNAP'],z]
faces=[];roofs=[];grounds=[]
for r in s['allLoD22Surfaces']:
 rings=[[xyz(v) for v in ring] for ring in r['ringsRDAbsolute']];points=np.array(rings[0]);mean=points.mean(axis=0);_,_,vt=np.linalg.svd(points-mean);normal=vt[-1];basis=vt[:2];proj=(points-mean)@basis.T
 from shapely import constrained_delaunay_triangles
 poly=Polygon(proj,[((np.array(h)-mean)@basis.T).tolist() for h in rings[1:]])
 tris=[]
 for t in constrained_delaunay_triangles(poly).geoms:
  if poly.covers(t.representative_point()):
   tri=np.array(t.exterior.coords[:-1])@basis+mean
   # preserve raw face winding in localXYZ (RD north->south transform).
   raw=np.cross(points[1]-points[0],points[2]-points[0]);n=np.cross(tri[1]-tri[0],tri[2]-tri[0]);
   if n@raw<0:tri=tri[::-1]
   if r['semantics']['type']=='RoofSurface' and np.cross(tri[1]-tri[0],tri[2]-tri[0])[1]<0:tri=tri[::-1]
   if r['semantics']['type']=='GroundSurface' and np.cross(tri[1]-tri[0],tri[2]-tri[0])[1]>0:tri=tri[::-1]
   tris.extend(tri.tolist())
 rec={'part':r['cityObject'],'face':r['face'],'semantic':r['semantic'],'type':r['semantics']['type'],'rings':rings,'triangles':tris,'heightRange':[r['heightMinRelative'],r['heightMaxRelative']]};faces.append(rec)
 if rec['type']=='RoofSurface':
  poly=Polygon([[v[0],v[2]] for v in rings[0]],[[[v[0],v[2]] for v in h] for h in rings[1:]])
  pt=poly.representative_point();roofs.append({'part':rec['part'],'face':rec['face'],'semantic':rec['semantic'],'area':poly.area,'sample':[pt.x,pt.y],'rings':rings,'heightRange':rec['heightRange']})
 if rec['type']=='GroundSurface':grounds.append(Polygon([[v[0],v[2]] for v in rings[0]],[[[v[0],v[2]] for v in h] for h in rings[1:]]))
native=[loc(*v) for v in c['feature']['geometry']['coordinates'][0][:-1]];poly=Polygon(native);gap=poly.difference(unary_union(grounds));garden=max(gap.geoms,key=lambda p:p.area) if hasattr(gap,'geoms') else gap
# Interior points, inset1m from all source boundaries; narrow discrepancies excluded.
gardenInset=garden.buffer(-1);gardenProbes=[]
for x in np.arange(garden.bounds[0],garden.bounds[2],1.5):
 for z in np.arange(garden.bounds[1],garden.bounds[3],1.5):
  if gardenInset.contains(Point(x,z)):gardenProbes.append([float(x),float(z)])
spec={'id':c['id'],'digits':c['id'].split('.')[-1],'label':'Herengracht204/208/216','anchor':anchor,'bearing':0,'scale':1,'groundNAP':s['groundNAP'],'footprint':c['feature']['geometry'],'nativeRing':native,'faces':faces,'roofs':roofs,'gardenProbes':gardenProbes,'suppress':[c['id']],'retain':['NL.IMBAG.Pand.'+n for n in ['0363100012164993','0363100012169303','0363100012177218','0363100012252731']],'sourceCommit':'82d2b738eab30911ee7e8c965824eb70bd7b2d36','sourcePack':'experiments/canal-belt-continuation-20261007/next-ordinary40-source58','limitations':['AHN3/2014survey is older than2024currentfacade/currentaerial; exact aerial flight date unresolved.','Raisedroof5/14material unresolved; retained as light opaque surfaces rather than open sky.','Sculpture/capital/festoon/curvedrails are original bounded low-poly approximations.','No archive original or Bouwdossier sheet inspected; rear openings uncertain.','Independent gallery/game/performance acceptance pending.']}
a.output.write_text(json.dumps(spec,indent=2)+'\n');print({'faces':len(faces),'roofs':len(roofs),'gardenProbes':len(gardenProbes),'nativeBounds':poly.bounds})
for i in [21,22,35,36]:print(i,native[i])
for r in roofs:print(r['semantic'],r['part'][-1],round(r['area'],1),[round(v,2) for v in r['heightRange']],r['sample'])
