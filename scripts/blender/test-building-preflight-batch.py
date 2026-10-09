"""Invalid attachment neighbors and replacements preserve last-good GLB/scene."""
import hashlib,json,subprocess,tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
CLI=ROOT/'scripts/blender/build-buildings.py'
BLENDER='/Applications/Blender.app/Contents/MacOS/Blender'
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

with tempfile.TemporaryDirectory(prefix='preflight-batch-',dir=ROOT/'.cache') as directory:
    root=Path(directory);out=root/'models';art=root/'build'
    good=json.loads((ROOT/'scripts/blender/building_lib/recipes/synthetic-terrace.json').read_text())
    good['id']='valid-neighbor'
    bad=[]
    for index in range(3):
        item=json.loads(json.dumps(good));item['id']='invalid-'+str(index)
        if index==0:item['frontages'][0]['openings'][0]['glazingDepth']=.23
        if index==1:item['details']={'dormers':[{'x':30,'y':3,'width':1,'height':1}]}
        if index==2:item['roof']['kind']='flat';item['details']={'ridgeCap':True}
        bad.append(item)
    for recipe in bad+[good]:(root/(recipe['id']+'.json')).write_text(json.dumps(recipe))
    manifest=root/'manifest.json';manifest.write_text(json.dumps({'schemaVersion':1,'recipes':[r['id']+'.json' for r in bad+[good]]}))
    def run():
        result=subprocess.run([BLENDER,'--background','--python-exit-code','1','--python',str(CLI),'--',
                               '--manifest',str(manifest),'--output-root',str(out),'--artifact-root',str(art)],
                              capture_output=True,text=True)
        assert result.returncode==1,result.stdout[-2000:]+result.stderr[-2000:]
        return json.loads((art/'batch-report.json').read_text())
    report=run();assert (report['built'],report['failed'])==(1,3),report
    outputs=[out/'valid-neighbor.glb',art/'valid-neighbor.blend']
    before=[digest(p) for p in outputs]
    good['frontages'][0]['openings'][0]['glazingDepth']=.23
    (root/'valid-neighbor.json').write_text(json.dumps(good))
    report=run();assert (report['built'],report['failed'])==(0,4),report
    assert [digest(p) for p in outputs]==before
    result={'passed':True,'checks':['glazing/dormer/ridge invalid neighbors rejected before build',
                                   'valid neighbor exports','invalid replacement preserves last-good GLB and editable scene']}
    destination=ROOT/'artifacts/infrastructure-hardening/batch-checks.json';destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
