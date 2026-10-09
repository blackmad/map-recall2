import urllib.request,urllib.parse,pathlib,json,hashlib,datetime,time,concurrent.futures
BASE=pathlib.Path('../map-recall2-source-data/models/uilenburger-synagoge');BASE.mkdir(parents=True,exist_ok=True)
def fetch(name,url,rights='Unknown; reference-only private archive',params=None):
 p=BASE/'raw'/name;p.parent.mkdir(parents=True,exist_ok=True)
 if p.exists():return p
 for attempt in range(3):
  try:
   r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 CanalRecall research'}),timeout=45);content=r.read();p.write_bytes(content)
   m={'url':r.url,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':r.status,'sha256':hashlib.sha256(content).hexdigest(),'rights':rights,'bytes':len(content),'original':True}
   p.with_suffix(p.suffix+'.provenance.json').write_text(json.dumps(m,indent=2));print(name,r.status,len(content),flush=True);return p
  except Exception as e:
   (BASE/'raw'/f'{name}.access.json').write_text(json.dumps({'url':url,'attempt':attempt+1,'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'state':'transient-failure','error':str(e)},indent=2));print(name,str(e)[:120],flush=True);time.sleep(2**attempt)
 return None
if __name__=='__main__':
 jobs=[('register5798.html','https://monumentenregister.cultureelerfgoed.nl/monumenten/5798'),('operator.html','https://www.uilenburgersjoel.nl/'),('operator-history.html','https://www.uilenburgersjoel.nl/the-uilenburger-synagogue/'),('monumentenstad.html','https://www.amsterdam-monumentenstad.nl/database/grachtenboek_objecten.php?id=6156'),('beeldbank-search.html','https://archief.amsterdam/beeldbank/?mode=gallery&view=horizontal&q=Nieuwe%20Uilenburgerstraat%2091'),('address.json','https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=Nieuwe%20Uilenburgerstraat%2091%20Amsterdam&rows=5'),('osm.json','https://overpass-api.de/api/interpreter?data=[out:json];(way[building](52.3697,4.9048,52.3705,4.9060);node(452804039););out%20body%20geom;')]
 with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:list(ex.map(lambda j:fetch(*j),jobs))
