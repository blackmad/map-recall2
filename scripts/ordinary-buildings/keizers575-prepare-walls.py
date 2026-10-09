"""Select source-supported interior/dormer walls; subtract existing coplanar triangles.
Run against original raw3DBAG plus a decoded build made with --support-baseline.
No generic shared helper, geometry cap, proxy chimney or garden fill is changed.
"""
import json,math,argparse
from pathlib import Path
import numpy as np
from shapely.geometry import Polygon,Point,LineString,box
from shapely import constrained_delaunay_triangles,make_valid
from shapely.ops import unary_union
from pyproj import Transformer,CRS
p=argparse.ArgumentParser();p.add_argument('--raw',type=Path,required=True);p.add_argument('--baseline',type=Path,required=True);p.add_argument('--spec',type=Path,default=Path('scripts/ordinary-buildings/keizers575-spec.json'));a=p.parse_args()
spec=json.loads(a.spec.read_text());j=json.loads(a.raw.read_text());f=j['feature'];tr=j['metadata']['transform'];verts=[[v[i]*tr['scale'][i]+tr['translate'][i]for i in range(3)]for v in f['vertices']]
rd=CRS.from_proj4('+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs');tf=Transformer.from_crs(rd,4326,always_xy=True);anchor=spec['anchor'];kx=111320*math.cos(math.radians(anchor[1]))
def local(v):
 lng,lat=tf.transform(v[0],v[1]);return[(lng-anchor[0])*kx,v[2]-spec['groundNAPMetres'],-(lat-anchor[1])*111320]
def polys(g):
 if g.is_empty:return[]
 if g.geom_type=='Polygon':return[g]
 return[p for x in getattr(g,'geoms',[])for p in polys(x)]
tri=np.array([t['v']for t in json.loads(a.baseline.read_text())]);native=Polygon(spec['nativeRing'])
# Explicit evidence-bounded groups: nonproxy west roof wells/skylight junctions,
# central rear roof assembly162–168, and right-dormer223/231/235 wall junctions.
selected=[41,172,20,119,145,197,6,27,28,35,37,51,53,72,73,78,88,91,98,108,110,111,133,136,137,138,157,162,163,164,165,166,167,168,169,25,38,120,121,123,124,176,183,194,202]
proxyExcluded=[66,102,103,127,175,180,184,185,186,187,192,193]
result=[]
for name,obj in f['CityObjects'].items():
 for g in obj.get('geometry',[]):
  if g['lod']!='2.2':continue
  for idx,(bounds,val)in enumerate(zip(g['boundaries'][0],g['semantics']['values'][0])):
   if idx not in selected:continue
   assert g['semantics']['surfaces'][val]['type']=='WallSurface'
   vv=np.array([local(verts[v])for v in bounds[0]]);origin=vv[0];best=np.argmax(np.linalg.norm(vv[:,[0,2]]-origin[[0,2]],axis=1));t=vv[best,[0,2]]-origin[[0,2]];L=np.linalg.norm(t)
   if L<.001:continue
   t=t/L;n=np.array([-t[1],0,t[0]])
   def uv(v):return np.stack([(v[...,0]-origin[0])*t[0]+(v[...,2]-origin[2])*t[1],v[...,1]],axis=-1)
   def xyz(v):return[origin[0]+t[0]*v[0],v[1],origin[2]+t[1]*v[0]]
   rings=[uv(np.array([local(verts[v])for v in r])).tolist()for r in bounds];raw=make_valid(Polygon(rings[0],rings[1:]));projected=uv(tri);dist=np.sum((tri-origin)*n,axis=2);mask=np.max(abs(dist),axis=1)<.025
   cover=unary_union([Polygon(r)for r in projected[mask]if Polygon(r).area>1e-8]);remaining=raw.difference(cover)
   # Clip the vertical polygon's plan intervals to installed native footprint.
   umin,_,umax,_=raw.bounds;plan=native.intersection(LineString([xyz([umin,0])[::2],xyz([umax,0])[::2]]));intervals=[]
   lines=[plan]if plan.geom_type=='LineString'else list(getattr(plan,'geoms',[]))
   for line in lines:
    if line.geom_type!='LineString':continue
    us=[(q[0]-origin[0])*t[0]+(q[1]-origin[2])*t[1]for q in line.coords];intervals.append(box(min(us),-1,max(us),30))
   remaining=remaining.intersection(unary_union(intervals));vertices=[]
   # Original source winding establishes exterior normal; each retained triangle
   # follows it. Float32-degenerate pieces are omitted, not promoted to walls.
   sourceNormal=None
   for i in range(1,len(vv)-1):
    normal=np.cross(vv[i]-vv[0],vv[i+1]-vv[0])
    if np.linalg.norm(normal)>1e-7:sourceNormal=normal/np.linalg.norm(normal);break
   for poly in polys(remaining):
    for triangle in polys(constrained_delaunay_triangles(poly)):
     ps=np.array([xyz(q)for q in list(triangle.exterior.coords)[:-1]],dtype=np.float32)
     normal=np.cross(ps[1]-ps[0],ps[2]-ps[0])
     if np.linalg.norm(normal)<1e-7:continue
     if normal.dot(sourceNormal)<0:ps=ps[::-1]
     vertices.extend(ps.tolist())
   sample=(max(polys(remaining),key=lambda x:x.area).representative_point() if remaining.area>.0001 else raw.representative_point());sampleXYZ=xyz([sample.x,sample.y])
   result.append({'rawWallIndex':idx,'role':'source-supported-interior-roof-wall','rawAreaMetres2':raw.area,'existingCoplanarCoverageMetres2':raw.intersection(cover).area,'addedAreaMetres2':remaining.area,'triangles':vertices,'sourceSample':sampleXYZ,'normal':sourceNormal.tolist(),'rawRings':[[local(verts[v])for v in r]for r in bounds],'scope':'Selected roof/dormer wall, clipped native; existing coplanar triangles subtracted at25mm tolerance; original roof/source garden unchanged.'})
spec['sourceInteriorWalls']=result;spec['sourceInteriorWallDecision']={'rawPath':'cached/raw/3dbag.json','sourceCommit':'4ec0a0d69e202f87d573b5543650c9446f20102f','selectedRawIndices':selected,'excludedChimneyProxyIndices':proxyExcluded,'coplanarSubtractToleranceMetres':.025,'evidence':'Actualv02GPU failed roofjunctions plus independentraw27/72/91/110/162–168audit; rightdormer223/231/235adjacentwallsemantics. Source41 aerials show roof structures, not courts. Only bounded original surveyed wall polygons used as measured-profile support; no foreign mesh import.','addedAreaMetres2':sum(r['addedAreaMetres2']for r in result)}
a.spec.write_text(json.dumps(spec,indent=2)+'\n');print(json.dumps({'walls':len(result),'triangles':sum(len(r['triangles'])for r in result)//3,'addedAreaMetres2':spec['sourceInteriorWallDecision']['addedAreaMetres2'],'byWall':[(r['rawWallIndex'],round(r['addedAreaMetres2'],3))for r in result]}))
