"""Review adapter: build staged drafts using the shared library, isolated outputs."""
import argparse,hashlib,json,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib.schema import validate

def main():
    p=argparse.ArgumentParser();p.add_argument('--building',action='append');p.add_argument('--render',action='store_true');p.add_argument('--validate-only',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:])
    recipes=[json.loads(f.read_text()) for f in sorted((ROOT/'scripts/blender/expansion/recipes').glob('*.json'))]
    selected=[r for r in recipes if r['id'] in a.building] if a.building else [r for r in recipes if not r['authoringStatus'].startswith('held-')]
    if a.building and set(a.building)-{r['id'] for r in recipes}:raise ValueError('Unknown draft ID')
    for r in selected:
        if errors:=validate(r):raise ValueError(errors)
        bundle=json.loads((ROOT/r['sourceBundlePath']).read_text())
        assert bundle['ownerId']==r['buildingId'] and bundle['geometryRevision']==r['geometryRevision']
    if a.validate_only:
        print(json.dumps({'valid':len(selected),'ids':[r['id'] for r in selected],'registered':0,'status':'draft-review-only'},indent=2));return
    from building_lib.archetypes import build,source_overlay
    from building_lib.export import save_and_export
    from building_lib.review import render
    output=ROOT/'artifacts/building-library/expansion/models';artifact=ROOT/'artifacts/building-library/expansion/scenes';cache=ROOT/'.cache/blender-building-materials'
    output.mkdir(exist_ok=True);artifact.mkdir(exist_ok=True)
    results=[]
    for r in selected:
        start=time.perf_counter();objects=build(r,cache);source_overlay(r);result=save_and_export(r,objects,output,artifact)
        if a.render:render(r,artifact)
        result.update(authoringStatus=r['authoringStatus'],buildSeconds=time.perf_counter()-start,accepted=False)
        result.update(modelUrl='./'+r['id']+'.glb',sourceBundle='../evidence/'+r['sourceBundle'],
                      recipeFileSha256=hashlib.sha256((ROOT/'scripts/blender/expansion/recipes'/(r['id']+'.json')).read_bytes()).hexdigest())
        results.append(result);print('DRAFT_BUILD '+json.dumps({k:result[k] for k in ('id','triangles','drawCalls','bytes','buildSeconds')}),flush=True)
    (output/'manifest.json').write_text(json.dumps({'version':1,'draftOnly':True,'models':results},indent=2)+'\n')

if __name__=='__main__':main()
