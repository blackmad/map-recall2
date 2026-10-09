"""Exercise real CLI failure isolation, resume and last-good asset preservation."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[2]
BLENDER='/Applications/Blender.app/Contents/MacOS/Blender'
CLI=ROOT/'scripts/blender/build-buildings.py'

def run(arguments):
    result=subprocess.run([BLENDER,'--background','--python-exit-code','1','--python',str(CLI),'--',*map(str,arguments)],capture_output=True,text=True)
    if result.returncode not in (0,1):
        raise AssertionError(result.stdout[-3000:]+result.stderr[-3000:])
    return result

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

with tempfile.TemporaryDirectory(prefix='batch-regression-',dir=ROOT/'.cache') as directory:
    root=Path(directory);out=root/'models';art=root/'artifacts'
    good=json.loads((ROOT/'scripts/blender/building_lib/fixtures/ir/ordinary-shop-terrace.json').read_text())
    bad=json.loads(json.dumps(good));bad['id']='invalid-building';bad['roof']['kind']='unsupported'
    (root/'good.json').write_text(json.dumps(good));(root/'bad.json').write_text(json.dumps(bad))
    manifest=root/'batch.json';manifest.write_text(json.dumps({'schemaVersion':1,'recipes':['bad.json','good.json']}))
    options=['--manifest',manifest,'--output-root',out,'--artifact-root',art]
    first=run(options);assert first.returncode==1,first.stdout
    report=json.loads((art/'batch-report.json').read_text())
    assert (report['built'],report['failed'])==(1,1),report
    asset=out/(good['id']+'.glb');before=sha(asset)
    second=run(options+['--resume']);assert second.returncode==1,second.stdout
    report=json.loads((art/'batch-report.json').read_text())
    assert (report['resumed'],report['failed'])==(1,1),report
    assert sha(asset)==before
    # A bad replacement for the same owner must preserve its previous asset.
    good['roof']['kind']='unsupported';(root/'good.json').write_text(json.dumps(good))
    third=run(options);assert third.returncode==1,third.stdout
    report=json.loads((art/'batch-report.json').read_text())
    assert (report['built'],report['failed'])==(0,2),report
    assert sha(asset)==before
    result={'passed':True,'checks':['valid neighbor builds despite bad recipe','unchanged output resumes','failed replacement preserves last good GLB']}
    destination=ROOT/'artifacts/building-library/batch-integration-checks.json';destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
