import json, pathlib, urllib.request, hashlib, datetime, time, concurrent.futures
ROOT=pathlib.Path('../map-recall2-source-data/models/luther-museum/raw'); ROOT.mkdir(parents=True,exist_ok=True)
items={
'register.html':'https://monumentenregister.cultureelerfgoed.nl/monumenten/525060',
'operator.html':'https://luthermuseum.nl/nl/over-het-museum',
'operator-home.html':'https://luthermuseum.nl/nl',
'beeldbank.html':'https://archief.amsterdam/beeldbank/?mode=gallery&q=Nieuwe%20Keizersgracht%20570',
'bag-neighbors.json':'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?bbox=4.9078,52.3649,4.9102,52.3661&limit=100&f=json',
'address.json':'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=Nieuwe%20Keizersgracht%20570%20Amsterdam&rows=3',
'commons.html':'https://commons.wikimedia.org/wiki/Category:Lutherse_Diaconiehuis_(Amsterdam)',
'renovation.html':'https://hillen-roosen.nl/project/wittenberg/'
}
def fetch(pair):
 name,url=pair; path=ROOT/name; entry={'path':str(path),'url':url,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rights':'Source-specific; research reference only; no redistribution in public game'}
 if path.exists(): entry.update(status='cached',sha256=hashlib.sha256(path.read_bytes()).hexdigest()); return entry
 for delay in [0,2,5]:
  time.sleep(delay)
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'CanalRecall architectural research contact project repository'}),timeout=40) as r: data=r.read(); entry['httpStatus']=r.status
   path.write_bytes(data);entry.update(status='downloaded',bytes=len(data),sha256=hashlib.sha256(data).hexdigest());return entry
  except Exception as e: entry.update(status='retryable-access-gap',error=str(e))
 return entry
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool: results=list(pool.map(fetch,items.items()))
 (ROOT.parent/'acquisition.json').write_text(json.dumps(results,indent=2));print(json.dumps([{k:v for k,v in e.items() if k not in ['rights']} for e in results],indent=2))
