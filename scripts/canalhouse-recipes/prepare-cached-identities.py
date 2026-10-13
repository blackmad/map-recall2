#!/usr/bin/env python3
"""Batch exact cached Pand/VBO/native-source joins for a recipe trial; no network."""
import argparse, gzip, hashlib, json
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--inventory',required=True);p.add_argument('--stage',required=True)
p.add_argument('--cache',default='.worktrees/amsterdam-facade-rebuild/.cache/city-appearance/areas/jordaan-sample-v1/raw')
p.add_argument('--register',default='/Users/blackmad/Code/map-recall2-source-data/datasets/amsterdam-monument-register/2026-10-05T06-10-55-572Z-83107/normalized/records.json.gz')
a=p.parse_args();inventory_path=Path(a.inventory);inventory=json.loads(inventory_path.read_text());stage=Path(a.stage);stage.mkdir(parents=True,exist_ok=True);cache=Path(a.cache);owners={e['cachedOwnerId'] for e in inventory['entries']};parents={};joins=[];skipped=[]
for path in sorted(cache.glob('bag-*.json')):
 data=json.loads(path.read_text())
 if not isinstance(data,dict) or 'features' not in data:continue
 for f in data['features']:
  pid=f['properties']['identificatie']
  if pid in owners and f['properties']['status']=='Pand in gebruik':
   if pid in parents and parents[pid]['feature']!=f:raise ValueError(f'Ambiguous current Pand {pid}')
   parents[pid]={'raw':str(path),'feature':f}
assert owners==set(parents),'Missing current official Pand'
links={pid:{url.split('/')[-1] for url in rec['feature']['properties'].get('verblijfsobject.href',[])} for pid,rec in parents.items()}
for path in sorted(cache.glob('addresses*.json')):
 try:data=json.loads(path.read_text())
 except ValueError:skipped.append(str(path));continue
 if not isinstance(data,dict) or 'features' not in data:skipped.append(str(path));continue
 for f in data['features']:
  if f['properties'].get('status')!='Verblijfsobject in gebruik':continue
  for pid,ids in links.items():
   if f['id'] in ids:
    assert parents[pid]['feature']['id'] in {url.split('/')[-1] for url in f['properties']['pand.href']},'Non-reciprocal official join'
    joins.append({'pand':pid,'raw':str(path),'feature':f})
for pid in owners:assert any(j['pand']==pid for j in joins),'Missing current reciprocal VBO'
register=json.loads(gzip.decompress(Path(a.register).read_bytes()))
for entry in inventory['entries']:
 pid=entry['cachedOwnerId'];street,number=entry['address'].rsplit(' ',1)
 assert number.isdigit(),'Select an explicit base house number'
 assert any(j['feature']['properties']['openbare_ruimte_naam']==street and str(j['feature']['properties']['huisnummer'])==number for j in joins if j['pand']==pid),'Missing exact requested canonical street and base house number'
 matches=[]
 for path in sorted(cache.glob('3dbag-*.json')):
  raw=path.read_bytes()
  if pid.encode() not in raw:continue
  data=json.loads(raw)
  if any(f['id']=='NL.IMBAG.Pand.'+pid for f in data.get('features',[])):
   matches.append({'path':str(path),'sha256':hashlib.sha256(raw).hexdigest(),'featureIds':['NL.IMBAG.Pand.'+pid],'state':'Cached exact owner feature; no new request'})
 assert len(matches)==1,f'Ambiguous or absent raw native owner {pid}'
 entry['nativeRawSource']=matches[0]
 reg=[r for r in register['rce']+register['municipal'] if pid in r.get('bagPandIds',[])]
 (stage/f'{number}-register.json').write_text(json.dumps(reg,indent=2)+'\n')
(stage/'official-parent-joins.json').write_text(json.dumps(joins,indent=2)+'\n');(stage/'official-pands.json').write_text(json.dumps(parents,indent=2)+'\n');(stage/'nonfeature-responses.json').write_text(json.dumps(skipped,indent=2)+'\n');inventory_path.write_text(json.dumps(inventory,indent=2)+'\n')
print(json.dumps({'owners':len(owners),'currentReciprocalVbos':len(joins),'nonfeatureResponsesSkipped':len(skipped),'networkRequests':0}))
