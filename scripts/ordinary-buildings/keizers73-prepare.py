import json,math,pathlib,numpy as np
from pyproj import Transformer
from shapely.geometry import Polygon,Point
from shapely import make_valid,constrained_delaunay_triangles
from shapely.ops import unary_union,nearest_points
P=pathlib.Path('/tmp/canal-ordinary-source35/experiments/canal-belt-continuation-20261007/next-ordinary39-source55/0363100012169218')
RAW=json.loads((P/'raw/3dbag.json').read_text());F=RAW['feature'];TF=RAW['metadata']['transform'];VV=[[v[i]*TF['scale'][i]+TF['translate'][i] for i in range(3)] for v in F['vertices']];G=next(g for o in F['CityObjects'].values() for g in o.get('geometry',[]) if g['lod']=='2.2');RR={v:b for b,v in zip(G['boundaries'][0],G['semantics']['values'][0]) if G['semantics']['surfaces'][v]['type']=='RoofSurface'}
S=json.loads((P/'processed/geometry-scope-review.json').read_text());R=json.loads((P/'processed/roof-surfaces.json').read_text());native=S['native']['geometry'];rr=native['coordinates'][0][:-1];anchor=[sum(p[0] for p in rr)/len(rr),sum(p[1] for p in rr)/len(rr)];kx=111320*math.cos(math.radians(anchor[1]));local=lambda p:[(p[0]-anchor[0])*kx,-(p[1]-anchor[1])*111320];ring=[local(p) for p in rr];poly=Polygon(ring);tr=Transformer.from_crs(28992,4326,always_xy=True)
def polys(g):
 if g.is_empty:return []
 if g.geom_type=='Polygon':return [g]
 return [p for q in getattr(g,'geoms',[]) for p in polys(q)]
def rec(p,plane,s,**kw):return dict(surface=s,ring=list(map(list,p.exterior.coords[:-1])),holes=[list(map(list,h.coords[:-1])) for h in p.interiors],plane=plane,areaMetres2=p.area,**kw)
roofs=[];owners=[];omitted=[]
for r in R['surfaces']:
 allrings=[np.array([[*local(tr.transform(VV[v][0],VV[v][1])),VV[v][2]-R['groundNAP']] for v in ids]) for ids in RR[r['semantic']]];xyz=np.concatenate(allrings);p=make_valid(Polygon(allrings[0][:,:2],[x[:,:2] for x in allrings[1:]]));
 if p.area==0:omitted.append({'surface':r['semantic'],'reason':'Exactly zero plan area; raw record retained'});continue
 a=np.column_stack([xyz[:,0],xyz[:,1],np.ones(len(xyz))]);plane=np.linalg.lstsq(a,xyz[:,2],rcond=None)[0].tolist();res=max(abs(a@plane-xyz[:,2]));assert res<.05,(r['semantic'],res)
 for q in polys(p.intersection(poly)):
  if q.area==0:continue
  o=rec(q,plane,r['semantic'],role='survey-roof-owner',sourceHeightRange=[r['heightMinRelative'],r['heightMaxRelative']],fitResidualMetres=float(res));roofs.append(o);owners.append((q,o))
covered=unary_union([p for p,o in owners]);sourceholes=[Polygon(h) for h in getattr(covered,'interiors',[])];protected=unary_union(sourceholes);unresolved=[];closures=[]
pending=[(patch,0) for gap in polys(poly.difference(covered).difference(protected)) for patch in polys(constrained_delaunay_triangles(gap))]
while pending:
 patch,depth=pending.pop()
 if True:
  if patch.area<1e-10:continue
  coords=list(patch.exterior.coords[:-1]);owner=min(owners,key=lambda po:po[0].distance(patch.representative_point()));p,o=owner;d=max(p.distance(Point(v)) for v in coords)
  if d>.7:
   if min(po[0].distance(patch.representative_point()) for po in owners)<.7 and depth<7 and patch.area>.001:
    a,b,c=coords;ab=[(a[k]+b[k])/2 for k in range(2)];bc=[(b[k]+c[k])/2 for k in range(2)];ca=[(c[k]+a[k])/2 for k in range(2)];pending.extend((Polygon(v),depth+1) for v in [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]]);continue
   unresolved.append(rec(patch,[0,0,0],-1,nearestOwnerDistance=d));continue
  xyz=[]
  for v in coords:
   q=nearest_points(p,Point(v))[0];h=o['plane'][0]*q.x+o['plane'][1]*q.y+o['plane'][2];xyz.append([v[0],v[1],h])
  xyz=np.array(xyz);plane=np.linalg.lstsq(np.column_stack([xyz[:,:2],np.ones(len(xyz))]),xyz[:,2],rcond=None)[0].tolist();closures.append(rec(patch,plane,o['surface'],role='native-quantization-fringe',nearestOwnerDistance=d))
# Every native perimeter interval receives source-rim-supported masonry, even
# when strict roof containment would miss an entire quantized wall.
area=sum(p[0]*ring[(i+1)%len(ring)][1]-p[1]*ring[(i+1)%len(ring)][0] for i,p in enumerate(ring));walls=[]
for edge,a in enumerate(ring):
 b=ring[(edge+1)%len(ring)];L=math.dist(a,b);steps=math.ceil(L/.35);normal=[(b[1]-a[1])/L,-(b[0]-a[0])/L];normal=[n*(1 if area>0 else -1) for n in normal]
 for j in range(steps):
  pa=[a[k]+(b[k]-a[k])*j/steps for k in range(2)];pb=[a[k]+(b[k]-a[k])*(j+1)/steps for k in range(2)];mid=Point([(pa[k]+pb[k])/2 for k in range(2)]);p,o=min(owners,key=lambda po:po[0].distance(mid));heights=[]
  for v in [pa,pb]:
   q=nearest_points(p,Point(v))[0];heights.append(o['plane'][0]*q.x+o['plane'][1]*q.y+o['plane'][2])
  walls.append(dict(edge=edge,a=pa,b=pb,heights=heights,normal=normal,sourceSurface=o['surface'],ownerDistance=p.distance(mid)))
spec=dict(id=S['native']['properties']['id'],digits='0363100012169218',label='Keizersgracht73 / Herengracht54',anchor=anchor,bearing=0,scale=1,footprint=native,nativeRing=ring,suppress=[S['native']['properties']['id']],retain=[r['id'] for r in S['nearInstalled'] if r['id']!=S['native']['properties']['id']],roofs=roofs+closures,nativeWalls=walls,groundNAPMetres=R['groundNAP'],sourceRoofCount=len(R['surfaces']),protectedSourceHoles=[list(map(list,p.exterior.coords[:-1])) for p in sourceholes],rawRoofHoleCounts={str(k):len(v)-1 for k,v in RR.items() if len(v)>1},omittedZeroArea=omitted,unresolvedRoofCoverage=unresolved,sourceCommit='2da8260fedb128bd297b3d1f70fc93947e2c2a11',sourcePack='experiments/canal-belt-continuation-20261007/next-ordinary39-source55/0363100012169218',coverage=dict(nativeArea=poly.area,roofCoveredArea=covered.area,fringeArea=sum(r['areaMetres2'] for r in closures)),facades=[dict(name='keizers73',start=6,end=9),dict(name='heren54',start=12,end=13)],acceptance='Draft: independent native/gallery/live/performance checks pending')

from shapely.geometry import LineString,box
sourcewalls=[]
for idx,(bounds,val) in enumerate(zip(G['boundaries'][0],G['semantics']['values'][0])):
 if G['semantics']['surfaces'][val]['type']!='WallSurface':continue
 rings3=[np.array([[*local(tr.transform(VV[v][0],VV[v][1])),VV[v][2]-R['groundNAP']] for v in ids])[:,[0,2,1]] for ids in bounds];vv=rings3[0];origin=vv[0];best=np.argmax(np.linalg.norm(vv[:,[0,2]]-origin[[0,2]],axis=1));t=vv[best,[0,2]]-origin[[0,2]];L=np.linalg.norm(t)
 if L<.001:continue
 t=t/L;uv=lambda v:np.stack([(v[...,0]-origin[0])*t[0]+(v[...,2]-origin[2])*t[1],v[...,1]],axis=-1);xyz=lambda v:[origin[0]+t[0]*v[0],v[1],origin[2]+t[1]*v[0]]
 rings=[uv(v).tolist() for v in rings3];raw=make_valid(Polygon(rings[0],rings[1:]));umin,_,umax,_=raw.bounds;line=LineString([xyz([umin,0])[::2],xyz([umax,0])[::2]])
 if poly.boundary.distance(line.interpolate(.5,normalized=True))<.06:continue
 plan=poly.intersection(line);lines=[plan] if plan.geom_type=='LineString' else list(getattr(plan,'geoms',[]));intervals=[]
 for li in lines:
  if li.geom_type!='LineString' or li.is_empty:continue
  us=[(q[0]-origin[0])*t[0]+(q[1]-origin[2])*t[1] for q in li.coords];intervals.append(box(min(us),-1,max(us),30))
 remaining=raw.intersection(unary_union(intervals));normal=None
 for i in range(1,len(vv)-1):
  n=np.cross(vv[i]-vv[0],vv[i+1]-vv[0])
  if np.linalg.norm(n)>1e-7:normal=n/np.linalg.norm(n);break
 if normal is None:continue
 vertices=[]
 for p in polys(remaining):
  for triangle in polys(constrained_delaunay_triangles(p)):
   ps=np.array([xyz(q) for q in list(triangle.exterior.coords)[:-1]],dtype=np.float32);n=np.cross(ps[1]-ps[0],ps[2]-ps[0])
   if np.linalg.norm(n)<1e-7:continue
   if n.dot(normal)<0:ps=ps[::-1]
   vertices.extend(ps.tolist())
 if vertices:sourcewalls.append(dict(rawWallIndex=idx,triangles=vertices,normal=normal.tolist(),areaMetres2=remaining.area))
spec['sourceInteriorWalls']=sourcewalls

pathlib.Path('scripts/ordinary-buildings/keizers73-spec.json').write_text(json.dumps(spec,indent=2)+'\n');print({'roofs':len(roofs),'fringe':len(closures),'walls':len(walls),'unresolved':sum(p['areaMetres2'] for p in unresolved)})
