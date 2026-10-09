"""Map bounded observed exterior-wall profiles onto installed native perimeter.
Preserve measured heights, select only parallel wall planes≤0.7m from edge,
exclude rejected chimney proxies, subtract coplanar existing decoded geometry.
"""
import argparse,json,math
from pathlib import Path
import numpy as np
from shapely.geometry import Polygon,box,LineString,Point
from shapely import make_valid,constrained_delaunay_triangles
from shapely.ops import unary_union
from pyproj import CRS,Transformer
p=argparse.ArgumentParser();p.add_argument('--raw',required=True,type=Path);p.add_argument('--baseline',required=True,type=Path);p.add_argument('--spec',type=Path,default=Path('scripts/ordinary-buildings/keizers575-spec.json'));args=p.parse_args()
s=json.loads(args.spec.read_text());j=json.loads(args.raw.read_text());f=j['feature'];tr=j['metadata']['transform'];verts=np.asarray(f['vertices'])*tr['scale']+tr['translate'];anchor=s['anchor'];kx=111320*math.cos(math.radians(anchor[1]));rd=CRS.from_proj4('+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs');tf=Transformer.from_crs(rd,4326,always_xy=True)
def local(v):
 lng,lat=tf.transform(v[0],v[1]);return[(lng-anchor[0])*kx,v[2]-s['groundNAPMetres'],-(lat-anchor[1])*111320]
def polys(g):
 if g.is_empty:return[]
 if g.geom_type=='Polygon':return[g]
 return[p for q in getattr(g,'geoms',[])for p in polys(q)]
tri=np.asarray([r['v']for r in json.loads(args.baseline.read_text())]);selected=[];proxy={66,102,103,127,175,180,184,185,186,187,192,193};native=s['nativeRing']
for obj in f['CityObjects'].values():
 for g in obj.get('geometry',[]):
  if g['lod']!='2.2':continue
  for index,(bound,val)in enumerate(zip(g['boundaries'][0],g['semantics']['values'][0])):
   if g['semantics']['surfaces'][val]['type']!='WallSurface' or index in proxy:continue
   rings=[np.asarray([local(verts[i])for i in r])for r in bound];vv=rings[0]
   if vv[:,1].max()>23.7:continue
   best=np.argmax(np.linalg.norm(vv[:,[0,2]]-vv[0,[0,2]],axis=1));delta=vv[best,[0,2]]-vv[0,[0,2]];L0=np.linalg.norm(delta)
   if L0<.03:continue
   tangent=delta/L0
   matches=[]
   for edge,a in enumerate(native):
    a=np.asarray(a);b=np.asarray(native[(edge+1)%len(native)]);L=np.linalg.norm(b-a);t=(b-a)/L;n=np.array([-t[1],0,t[0]])
    if abs(t.dot(tangent))<.98:continue
    distances=np.abs(np.sum((vv-np.array([a[0],0,a[1]]))*n,axis=1));u=(vv[:,0]-a[0])*t[0]+(vv[:,2]-a[1])*t[1]
    if distances.max()>.7:continue
    if min(u.max(),L)-max(u.min(),0)<.03 and not(index==20 and edge==3):continue
    matches.append((distances.max(),edge,a,L,t,n))
   if not matches:continue
   for match in matches:
    distance,edge,a,L,t,n=match
    uv=lambda v:np.stack([(v[...,0]-a[0])*t[0]+(v[...,2]-a[1])*t[1],v[...,1]],axis=-1)
    xyz=lambda q:np.array([a[0]+t[0]*q[0],q[1],a[1]+t[1]*q[0]],dtype=np.float32)
    projectedRings=[uv(r) for r in rings]
    if index==20 and edge==3:
     # The surveyed short high/low roof return lies just inside shifted native
     # corner4. Move its bounded measured profile to native corner4, retaining
     # its own0.212m frontage and source vertex heights, not a building cap.
     shift=L-max(v[0]for v in projectedRings[0])
     projectedRings=[np.stack([r[:,0]+shift,r[:,1]],axis=1)for r in projectedRings]
    wall=make_valid(Polygon(projectedRings[0],projectedRings[1:])).intersection(box(0,-1,L,30))
    if wall.area<.0001:continue
    projected=uv(tri);dist=np.sum((tri-np.array([a[0],0,a[1]]))*n,axis=2);mask=np.max(abs(dist),axis=1)<.025
    cover=unary_union([Polygon(v)for v in projected[mask]if Polygon(v).area>1e-8]);remain=wall.difference(cover)
    if remain.area<.0001:continue
    points=[]
    for poly in polys(remain):
     for face in polys(constrained_delaunay_triangles(poly)):
      ps=np.asarray([xyz(q)for q in list(face.exterior.coords)[:-1]]);normal=np.cross(ps[1]-ps[0],ps[2]-ps[0])
      if np.linalg.norm(normal)<1e-7:continue
      if normal.dot(n)<0:ps=ps[::-1]
      points.extend(ps.tolist())
    if not points:continue
    faces=np.asarray(points).reshape(-1,3,3);areas=np.linalg.norm(np.cross(faces[:,1]-faces[:,0],faces[:,2]-faces[:,0]),axis=1);sampleXYZ=faces[int(np.argmax(areas))].mean(axis=0)
    sourceLine=LineString([(p[0],p[2])for p in vv]);transferredDistance=max(sourceLine.distance(Point(p[0],p[2]))for p in points);assert transferredDistance<=.70001,(index,edge,transferredDistance)
    selected.append({'rawWallIndex':index,'nativeEdge':edge,'maxSourceNativePlanOffsetMetres':float(distance),'maxTransferredVertexDistanceMetres':transferredDistance,'sourceRings':[r.tolist()for r in rings],'triangles':points,'addedAreaMetres2':remain.area,'sample':sampleXYZ.tolist(),'normal':n.tolist(),'cornerReturnPlanShiftMetres':float(shift) if index==20 and edge==3 else 0,'heightMethod':'Original source wall vertex heights; bounded plan projection to exact installed edge; existing coplanar coverage subtracted, no scalar cap'})
s['nativeSourceWallProfiles']=selected;s['nativeSourceWallProfileDecision']={'source':'cached/raw/3dbag.json','reason':'Actualv03GPU openings atwestedge6/rightdormer andlongrear seam; roof-owner-only enclosure does not represent source vertical profile. Rawwall36outside native mapped to own nativefront edge with measured elevations.','maxOwnerDistanceMetres':.7,'parallelTangentMinimum':.98,'excludedProxyWalls':sorted(proxy),'sourceCapMaximumExcludedMetres':23.7,'coplanarSubtractToleranceMetres':.025}
args.spec.write_text(json.dumps(s,indent=2)+'\n');print(json.dumps({'profiles':len(selected),'triangles':sum(len(r['triangles'])for r in selected)//3,'area':sum(r['addedAreaMetres2']for r in selected),'records':[(r['rawWallIndex'],r['nativeEdge'],round(r['addedAreaMetres2'],3))for r in selected]}))
