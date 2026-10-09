import pathlib,json,hashlib,datetime
root=pathlib.Path('../map-recall2-source-data/models/fire-station-osdorp');raw=root/'raw';records=[]
for p in sorted(raw.glob('*.provenance.json')):
 d=json.loads(p.read_text());f=pathlib.Path(str(p).removesuffix('.provenance.json'));d.update(path=str(f.relative_to(root)),rawPath=str(f.resolve()),bytes=f.stat().st_size,checksumVerified=hashlib.sha256(f.read_bytes()).hexdigest()==d['sha256'],rights=d.get('rights','Private research only; copyright/restrictions unchanged. Municipal panorama CC BY4.0; OSM ODbL;3DBAG CC BY4.0. ARCAM photographer attribution not stated.'));records.append(d)
processed=[{'path':str(p.relative_to(root)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'raw':False,'operation':'perspectiveCrop, exact settings in matching JSON; or normalized camera selection'}for p in (root/'processed').iterdir()]
manifest={'id':'fire-station-osdorp','retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':records,'derived':processed,'selectedCameraRecord':'selected-panoramas.json','accessGaps':[{'url':'https://archief.amsterdam/beeldbank/?mode=gallery&q=Ookmeerweg%202%20brandweerkazerne','state':'HTTP200JSshell; bounded address/name search, no catalogue photo or drawing inspected.'}],'publishState':'root source commit/push required before public model commit'}
(root/'source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
assert all(r['checksumVerified'] for r in records)
print(json.dumps({'rawSourceRecords':len(records),'rawBytes':sum(r['bytes']for r in records),'checksumVerified':True}))
