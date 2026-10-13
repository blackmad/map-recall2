import pathlib,urllib.request,json,hashlib,datetime,time,sys
root=pathlib.Path('../map-recall2-source-data/models/huize-frankendael'); (root/'raw').mkdir(parents=True,exist_ok=True)
manifest=root/'acquisition.json'; records=json.loads(manifest.read_text()) if manifest.exists() else []
def fetch(name,url,rights='Unknown; reference only'):
 p=root/'raw'/name
 if p.exists() and p.stat().st_size>100:return p
 for attempt in range(3):
  now=datetime.datetime.now(datetime.timezone.utc).isoformat()
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'CanalRecall architectural research/1.0'})
   with urllib.request.urlopen(req,timeout=35) as r: data=r.read();status=r.status
   p.write_bytes(data);records.append(dict(file=str(p),url=url,retrievedAt=now,status=status,sha256=hashlib.sha256(data).hexdigest(),bytes=len(data),rights=rights,access='downloaded original HTTP body'));manifest.write_text(json.dumps(records,indent=2)); print(name,len(data));return p
  except Exception as e:
   records.append(dict(file=str(p),url=url,retrievedAt=now,access='attempt failed; retryable',error=str(e)));manifest.write_text(json.dumps(records,indent=2));print(name,str(e));time.sleep(2**attempt)
 return None
if __name__=='__main__':fetch(sys.argv[1],sys.argv[2],sys.argv[3] if len(sys.argv)>3 else 'Unknown; reference only')
