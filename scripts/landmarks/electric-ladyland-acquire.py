import json,pathlib,urllib.request,urllib.parse,hashlib,datetime,time,sys
P=pathlib.Path('../map-recall2-source-data/models/electric-ladyland');R=P/'raw';R.mkdir(parents=True,exist_ok=True)
def fetch(url,name,rights='Unknown; reference research only'):
 p=R/name; m=p.with_suffix(p.suffix+'.json')
 if p.exists() and m.exists():return p.read_bytes()
 for i in range(3):
  rec=dict(url=url,retrievedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),attempt=i+1,rights=rights,rawPath='raw/'+name)
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'CanalRecall/1.0'}),timeout=30)as r:b=r.read();rec.update(status=r.status,contentType=r.headers.get('Content-Type'),sha256=hashlib.sha256(b).hexdigest(),bytes=len(b),accessState='acquired')
   p.write_bytes(b);m.write_text(json.dumps(rec,indent=2));return b
  except Exception as e:
   rec.update(accessState='failed this attempt; retry later',error=str(e));m.write_text(json.dumps(rec,indent=2));print(name,i+1,str(e)[:150]);time.sleep(1+i*2)
 return None
if __name__=='__main__':
 fetch(sys.argv[1],sys.argv[2])
