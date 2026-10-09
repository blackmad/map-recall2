"""Copy selected local evidence bundles and their derived crops into the preview.

No source caches are changed and no new photographic/metric acceptance is implied.
"""
import argparse
import json
from pathlib import Path
import shutil
import hashlib
from building_lib.batch import atomic_json

ROOT=Path(__file__).resolve().parents[2]

def publish_bundle(source,output,root=ROOT):
    source=Path(source).resolve();output=Path(output);root=Path(root).resolve()
    bundle=json.loads(source.read_text());copies=[]
    for crop in bundle.get('derived',[]):
        path=(root/crop['path']).resolve() if crop.get('path') else (source.parent/Path(crop['url']).name).resolve()
        if not path.is_file():raise ValueError('Missing derived image: '+str(path))
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        if crop.get('sha256') and crop['sha256']!=digest:raise ValueError('Derived image hash differs from evidence: '+str(path))
        # Cached filenames repeat across dates/directories. Content and capture
        # identity own the destination, so two dates cannot overwrite one URL.
        date=(crop.get('captureDate') or 'undated')[:10].replace('-','')
        name=f"{bundle['id']}-{crop.get('tier','crop')}-{date}-{digest[:24]}{path.suffix}"
        destination=output/name;copies.append((path,destination))
        crop['sourceUrlBeforePreview']=crop.get('url',crop.get('path'))
        crop['url']='./models/building-library/evidence/'+name
    output.mkdir(parents=True,exist_ok=True)
    for path,destination in copies:
        if path!=destination.resolve():shutil.copy2(path,destination)
    bundle['previewSourceBundle']=str(source.relative_to(root))
    atomic_json(output/source.name,bundle)
    return bundle

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle',action='append',required=True)
    args=parser.parse_args()
    output=ROOT/'public/canal-drive/models/building-library/evidence'
    output.mkdir(parents=True,exist_ok=True)
    for filename in args.bundle:
        source=Path(filename).resolve();bundle=publish_bundle(source,output)
        print(json.dumps({'bundle':source.name,'derivedCrops':len(bundle.get('derived',[])),'years':[c['year'] for c in bundle.get('coverage',[])]}))

if __name__=='__main__':main()
