"""Expose exact semantic survey rings including courtyard holes; no hull fitting."""
import json,pathlib
root=pathlib.Path(__file__).resolve().parents[2];pack=root.parent/'map-recall2-source-data/streets/canalhouse-recipes-pilot';inv=json.load(open(root/'docs/references/canalhouse-recipes/pilot-inventory.json'))
for h in inv['houses']:
 p=root/h['height']['surveyFile'];s=json.load(open(p));raw=json.load(open(pack/s['rawPath']));t=raw['metadata']['transform'];v=[[c*t['scale'][i]+t['translate'][i] for i,c in enumerate(p)]for p in raw['feature']['vertices']];ground=[];surfaces=[]
 for oid,obj in raw['feature']['CityObjects'].items():
  for g in obj.get('geometry',[]):
   if str(g.get('lod'))!='2.2':continue
   for shell_i,shell in enumerate(g['boundaries']):
    for surface_i,inds in enumerate(shell):
     sem=g['semantics']['surfaces'][g['semantics']['values'][shell_i][surface_i]];typ=sem['type'];rings=[[v[i]for i in ring]for ring in inds]
     rec=dict(objectId=oid,shellIndex=shell_i,surfaceIndex=surface_i,type=typ,ringsRD=rings,semantics=sem)
     surfaces.append(rec)
     if typ=='GroundSurface':ground.append(rec)
     if typ=='RoofSurface':
      match=next((r for r in s['roofsRD']if r['surfaceId']==f'{oid}:lod22:roof:{surface_i}'),None)
      if match:match['ringsRD']=rings;match['holeCount']=len(rings)-1
 s['semanticSurfacesRD']=surfaces;s['groundSurfacesRD']=ground;s['surveyFootprintsRD']=[[[p[0],p[1]]for p in ring]for surface in ground for ring in surface['ringsRD']];s['surveyFootprintPolygonsRD']=[[[[p[0],p[1]]for p in ring]for ring in surface['ringsRD']]for surface in ground];s['modelProfileTolerance']={'horizontalM':0.02,'verticalM':0.02,'policy':'Exact official3DBAG semantic rings drive survey partition; 2cm accommodates arithmetic only, not BAG/3DBAG footprint mismatch. Source reconstruction errors recorded separately in attributes; no artificial inflation.'};s['groundRingPolicy']='GroundSurface outer and interior rings preserved per polygon; surveyFootprintPolygonsRD is grouped by actual ground polygon. Never flatten interior rings into independent solid patches.';p.write_text(json.dumps(s,indent=2)+'\n');print(h['address'],'ground polys',len(ground),'holes',sum(len(g['ringsRD'])-1 for g in ground))
