"""Bounded cached source requests; originals remain in private source pack."""
import urllib.request,urllib.parse,json,hashlib,pathlib,datetime,time
ROOT=pathlib.Path('../map-recall2-source-data/models/posthoornkerk');RAW=ROOT/'raw';RAW.mkdir(parents=True,exist_ok=True)
def fetch(name,url,rights='Unknown; reference only',feature=''):
 p=RAW/name;meta=ROOT/'acquisition.json';records=json.loads(meta.read_text()) if meta.exists() else {}
 if p.exists():return p
 attempts=[]
 for delay in [0,2,5]:
  if delay:time.sleep(delay)
  at=datetime.datetime.now(datetime.timezone.utc).isoformat()
  try:
   r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'MapRecall landmark research (original geometry)'}),timeout=45);data=r.read();p.write_bytes(data)
   records[name]={'url':url,'retrievedAt':at,'status':r.status,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'rights':rights,'feature':feature,'rawPath':'raw/'+name,'attempts':attempts};meta.write_text(json.dumps(records,indent=2));print(name,r.status,len(data));return p
  except Exception as e:attempts.append({'at':at,'error':str(e)});print(name,str(e)[:180])
 records[name]={'url':url,'accessState':'transient failure; retry later','attempts':attempts,'rights':rights,'feature':feature};meta.write_text(json.dumps(records,indent=2));return None
if __name__=='__main__':
 sources={
 'register.html':'https://monumentenregister.cultureelerfgoed.nl/monumenten/1289',
 'operator.html':'https://stadsherstel.nl/monumenten/de-posthoornkerk/',
 'operator-venue.html':'https://stadsherstel.nl/eventlocatie/posthoornkerk/',
 'municipal-address-history.html':'https://amsterdamopdekaart.nl/1850-1940/Haarlemmerstraat/Posthoornkerk',
 'beeldbank-search.html':'https://archief.amsterdam/beeldbank/?mode=gallery&view=horizontal&q=Posthoornkerk%20Haarlemmerstraat',
 'bag-area.json':'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?f=json&bbox=4.8901,52.3809,4.8911,52.3817&limit=100',
 'osm-area.json':'https://overpass-api.de/api/interpreter?data='+urllib.parse.quote('[out:json];way[building](52.3809,4.8901,52.3817,4.8911);out tags geom;')}
 for name,url in sources.items():fetch(name,url,feature='identity, architectural assertions, current footprint and neighboring buildings')
