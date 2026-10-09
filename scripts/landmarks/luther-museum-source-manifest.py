import pathlib,json,hashlib,datetime
root=pathlib.Path('../map-recall2-source-data/models/luther-museum');attempts=json.loads((root/'acquisition.json').read_text());by={}
for a in attempts:
 if a.get('status') in ['downloaded','cached']:by[pathlib.Path(a['path']).name]=a
records=[]
for p in sorted((root/'raw').glob('*')):
 if not p.is_file():continue
 a=by.get(p.name,{});data=p.read_bytes();digest=hashlib.sha256(data).hexdigest()
 if a.get('sha256'):assert digest==a['sha256'],p
 rights=a.get('rights','Derived local installed game source; not an HTTP response')
 if p.name=='historic-rce.jpg':rights='Catalogue metadata CC BY-SA4.0; full-resolution original downloaded after later retry'
 if p.name=='historic-rce-thumb.jpg':rights='Catalogue metadata CC BY-SA4.0; downloaded served1280px derivative, not full-resolution original'
 records.append({'path':str(p.relative_to(root)),'sha256':digest,'bytes':len(data),'url':a.get('url'),'retrievedAt':a.get('retrievedAt'),'httpStatus':a.get('httpStatus'),'kind':'original-http-response-bytes' if a.get('url') else 'derived-installed-feature-cache','rights':rights})
processed=[]
for p in sorted((root/'processed').glob('*')):
 if p.is_file():processed.append({'path':str(p.relative_to(root)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'kind':'processed-derived-not-original'})
gaps=[a for a in attempts if a.get('status')=='retryable-access-gap' and not(root/'raw'/pathlib.Path(a['path']).name).exists()];manifest={'modelId':'luther-museum','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCommit':None,'gitOwner':'root; worker did not stage/commit/push','rawSources':records,'processedSources':processed,'acquisitionLedger':'acquisition.json','selectedPanoramaMetadata':'selected-panoramas.json','gaps':gaps,'originalVersusProcessed':'Panoramas,WMS image,operator/renovation JPEG andAPI/HTML/XML files preserve their HTTP response bytes. Historic RCE full-resolution original and1280px served derivative both archived after a successful later retry. Perspective crops and OSM identity are derived files; no photo pixels enter public asset.'}
(root/'source-pack-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print({'raw':len(records),'processed':len(processed),'bytes':sum(r['bytes']for r in records),'retryableGaps':len(gaps),'hashesVerified':True})
