import pathlib,urllib.request,json,time,hashlib,shutil,concurrent.futures
root=pathlib.Path('../map-recall2-source-data/models/fire-station-pieter/raw');root.mkdir(parents=True,exist_ok=True)
for p in pathlib.Path('../map-recall2-source-data/firestations-inventory').glob('amsterdam-pieter*'):shutil.copy2(p,root/p.name)
urls={'3dbag.json':'https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012088589','osm-map.xml':'https://api.openstreetmap.org/api/0.6/map?bbox=4.8430,52.3484,4.8443,52.3495','panoramas.json':'https://api.data.amsterdam.nl/panorama/panoramas/?bbox=4.8430,52.3485,4.8441,52.3492&page_size=100','beeldbank.html':'https://archief.amsterdam/beeldbank/?mode=gallery&q=Poeldijkstraat%201020%20brandweer'}
def fetch(pair):
 name,url=pair
 for i in range(3):
  try:
   data=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'CanalRecallResearch/1.0'}),timeout=40).read();(root/name).write_bytes(data);(root/(name+'.provenance.json')).write_text(json.dumps({'url':url,'retrievedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'sha256':hashlib.sha256(data).hexdigest(),'raw':True,'httpStatus':200},indent=2));return name,len(data)
  except Exception as e:
   if i==2:return name,str(e)
   time.sleep(2+i*2)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:print(list(ex.map(fetch,urls.items())))
(root/'urls.json').write_text(json.dumps(urls,indent=2))
url='https://api.data.amsterdam.nl/panorama/panoramas/?bbox=4.8430,52.3485,4.8441,52.3492&page_size=100&page='
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:print(list(ex.map(fetch,[(f'panoramas-{i}.json',url+str(i)) for i in range(2,8)])))
allp=[]
for p in root.glob('panoramas*.json'):
 if 'provenance' not in p.name: allp.extend(json.load(open(p)).get('_embedded',{}).get('panoramas',[]))
# Principal south-front and east side, latest capture dates preferred.
allp.sort(key=lambda p:p['timestamp'],reverse=True)
selected=[]
for target in [(4.84362,52.34869),(4.84389,52.34884),(4.84385,52.34910)]:
 recent=[p for p in allp if p['timestamp'][:4]>='2024']
 pool=recent or allp
 p=min(pool,key=lambda p:((p['geometry']['coordinates'][0]-target[0])*.61)**2+(p['geometry']['coordinates'][1]-target[1])**2)
 if p not in selected:selected.append(p)
(root/'selected-panoramas.json').write_text(json.dumps(selected,indent=2))
print([(p['pano_id'],p['timestamp'],p['geometry']['coordinates']) for p in selected])
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:print(list(ex.map(fetch,[(p['pano_id']+'.jpg',p['_links']['equirectangular_full']['href']) for p in selected])))
