import urllib.request,json,time,hashlib, pathlib,concurrent.futures
ROOT=pathlib.Path('../map-recall2-source-data/models/nieuwendammerkerk'); (ROOT/'raw').mkdir(parents=True,exist_ok=True)
def fetch(name,url,rights='Not established; private research only'):
 p=ROOT/'raw'/name
 if p.exists(): return p.read_bytes()
 for i in range(3):
  try:
   r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'CanalRecall architecture research/1.0'}),timeout=50);data=r.read();p.write_bytes(data)
   (ROOT/'raw'/(name+'.provenance.json')).write_text(json.dumps({'url':url,'retrievedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'status':r.status,'sha256':hashlib.sha256(data).hexdigest(),'rights':rights},indent=2));return data
  except Exception as e:
   (ROOT/'raw'/(name+'.access.json')).write_text(json.dumps({'url':url,'attempt':i+1,'time':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'error':str(e),'state':'retryable access failure'},indent=2));time.sleep(2**i)
 return b''
if __name__=='__main__':
 urls={
 'register.html':'https://monumentenregister.cultureelerfgoed.nl/monumenten/508536',
 'register-mirror.html':'https://www.monumenten.nl/monument/508536',
 'operator-building.html':'https://nieuwendammerkerk.nl/gebouwen-nieuwendammerkerk/',
 'municipal-address.html':'https://data.amsterdam.nl/adressen/0363200000057778',
 'beeldbank-search.html':'https://archief.amsterdam/beeldbank/?mode=gallery&q=Brede%20Kerkepad%208',
 'municipal-history.html':'https://amsterdamopdekaart.nl/1850-1940/Brede_Kerkepad/Nieuwendammerkerk',
 'commons-category.html':'https://commons.wikimedia.org/wiki/Category:Nieuwendammerkerk',
 'bag-nearby.json':'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?bbox=4.9402,52.3914,4.9412,52.3921&limit=100&f=json',
 'osm-nearby.json':'https://overpass-api.de/api/interpreter?data=[out:json];way[building](52.3914,4.9402,52.3921,4.9412);out%20geom;'
 }
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  for name,data in pool.map(lambda q:(q[0],fetch(*q)),urls.items()):print(name,len(data))
