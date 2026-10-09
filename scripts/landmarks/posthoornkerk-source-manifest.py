"""Verify only this worker's private pack; do not touch git or shared archive objects."""
from pathlib import Path
import json,hashlib,datetime
root=Path('../map-recall2-source-data/models/posthoornkerk');ac=json.load(open(root/'acquisition.json'))
for n in ['roof-aerial-current.jpg']:
 ac[n]['accessState']='HTTP 200 but inspected image entirely blank; unusable as reference. Preserved failed image; WGS84 retry succeeded.'
for n in ['roof-aerial-current-wgs.jpg','roof-aerial-2026.jpg']:
 ac[n]['date']='2026_orthoHR vintage confirmed: explicit 2026 layer bytes match current-service image. Exact flight day unstated.'
ac['front-commons.jpg']['rights']='bMA/Gemeente Amsterdam attribution permission for any purpose per archived Commons catalogue; private reference only.'
ac['front-commons.jpg']['date']='Capture date unknown; original upload 2007-09-10 is not photograph date.'
(root/'acquisition.json').write_text(json.dumps(ac,indent=2))
records=[]
for n,v in ac.items():
 if (root/'raw'/n).exists():records.append({**v,'path':'raw/'+n,'raw':True,'representation':'original-http-response-body'})
 else:records.append({**v,'accessState':v.get('accessState','Failed request; retry later')})
for sidecar in sorted((root/'raw').glob('*.provenance.json')):
 v=json.load(open(sidecar));path=str(sidecar.relative_to(root)).replace('.provenance.json','');records.append({**v,'path':path,'raw':True,'representation':'original-http-response-body','bytes':(root/path).stat().st_size})
for file in sorted((root/'processed').glob('*.jpg')):
 settings=json.load(open(file.with_suffix('.json')));records.append({'path':str(file.relative_to(root)),'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'bytes':file.stat().st_size,'derivedFrom':settings['raw'],'representation':'derived-perspective-projection-not-original','rights':'Gemeente Amsterdam CC BY 4.0','cameraSettings':settings['settings']})
known={r.get('path') for r in records}
for file in [root/'acquisition.json',*sorted((root/'processed').glob('*.json')),*sorted((root/'raw').glob('*.provenance.json'))]:
 path=str(file.relative_to(root))
 if path not in known:records.append({'path':path,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'bytes':file.stat().st_size,'representation':'worker-acquisition-and-projection-provenance','rights':'Source rights retained in records'})
for r in records:
 if not r.get('path'):continue
 p=root/r['path'];assert p.is_file()
 if r.get('sha256'):assert hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256'],str(p)
 if r.get('bytes') is not None:assert p.stat().st_size==r['bytes']
(root/'research-manifest.json').write_text(json.dumps(records,indent=2))
manifest_path=root/'manifest.json';manifest=json.load(open(manifest_path)) if manifest_path.exists() else {'modelId':'posthoornkerk','modelName':'Posthoornkerk','files':[]}
manifest.update({'archivedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rights':'Private research archive. Source copyright and restrictions retained. Original model uses no photo pixels.','sourceUrls':sorted(set(v['url'] for v in ac.values())),'publicationState':'Ready for coordinator scoped archival verification and commit/push; worker has no git-index authority.'})
manifest_path.write_text(json.dumps(manifest,indent=2));print('Verified private source records:',len(records))
