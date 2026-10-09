import urllib.request,json,pathlib,hashlib,datetime,time,sys
root=pathlib.Path('../map-recall2-source-data/models/meerpadkerk/raw');root.mkdir(parents=True,exist_ok=True)
manifest=root.parent/'acquisition.json'; rows=json.loads(manifest.read_text()) if manifest.exists() else []
def fetch(name,url,rights='Unknown; reference only'):
 for attempt in range(3):
  rec={'file':'raw/'+name,'url':url,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rights':rights,'attempt':attempt+1}
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'CanalRecall landmark research/1.0'}),timeout=40) as r: data=r.read();rec.update(status=r.status,contentType=r.headers.get('Content-Type'),sha256=hashlib.sha256(data).hexdigest(),bytes=len(data))
   (root/name).write_bytes(data);rows.append(rec);manifest.write_text(json.dumps(rows,indent=2));print(name,rec['status'],len(data));return
  except Exception as e:
   rec.update(accessState='request failed; retryable',error=str(e));rows.append(rec);manifest.write_text(json.dumps(rows,indent=2));print(name,str(e));time.sleep(attempt+1)
if __name__=='__main__': fetch(sys.argv[1],sys.argv[2],sys.argv[3] if len(sys.argv)>3 else 'Unknown; reference only')
