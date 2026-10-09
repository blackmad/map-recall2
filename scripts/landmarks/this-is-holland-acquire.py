import urllib.request,json,hashlib,time,pathlib,concurrent.futures
root=pathlib.Path('../map-recall2-source-data/models/this-is-holland');(root/'files').mkdir(parents=True,exist_ok=True)
urls={
'bag-bbox.json':'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?bbox=4.9014,52.3836,4.9031,52.3848&limit=100&f=json',
'architect.html':'https://www.damastarchitects.nl/this-is-holland-amsterdam',
'operator.html':'https://www.thisisholland.com/en/contact/',
'commons.html':'https://commons.wikimedia.org/wiki/File:2023_Overhoeksplein,_Asd-This_is_Holland.jpg',
'beeldbank.html':'https://archief.amsterdam/beeldbank/?query=This%20is%20Holland',
'engineering.html':'https://cauberghuygen.nl/project/this-is-holland/'}
def fetch(k,u):
 p=root/'files'/k
 if p.exists():return {'file':str(p),'url':u,'state':'cached','sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
 for i in range(3):
  now=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
  try:
   r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=30);data=r.read();p.write_bytes(data)
   return {'file':str(p),'url':u,'retrievedAt':now,'status':r.status,'sha256':hashlib.sha256(data).hexdigest(),'rights':'source-specific; research reference only'}
  except Exception as e:
   err=str(e)
   if i<2:time.sleep(2*(i+1))
 return {'url':u,'retrievedAt':now,'state':'access gap after 3 bounded attempts','error':err}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:results=list(ex.map(lambda kv:fetch(*kv),urls.items()))
(root/'acquisition.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
