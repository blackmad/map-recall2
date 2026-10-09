import pathlib,urllib.request,json,time,hashlib,shutil,concurrent.futures
root=pathlib.Path('../map-recall2-source-data/models/fire-station-teunis/raw')
root.mkdir(parents=True,exist_ok=True)
for p in pathlib.Path('../map-recall2-source-data/firestations-inventory').glob('amsterdam-teunis*'):shutil.copy2(p,root/p.name)
urls={'3dbag.json':'https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012241010','osm-map.xml':'https://api.openstreetmap.org/api/0.6/map?bbox=4.8625,52.3840,4.8645,52.3852','panoramas.json':'https://api.data.amsterdam.nl/panorama/panoramas/?bbox=4.8628,52.3842,4.8641,52.3850&page_size=100','operator-history.pdf':'https://www.brandweer.nl/wp-content/uploads/2024/03/SITRAP-150-jaar-BAA.pdf','brandbase.html':'https://brandbase.hetbrandweerforum.nl/kazernes/13-24-amsterdam-teunis/','contractor.html':'https://klavergiant.nl/projecten/klimaatinstallatie-kazerne-teunis-te-amsterdam','beeldbank.html':'https://archief.amsterdam/beeldbank/?mode=gallery&q=Vredenhofweg%203%20brandweerkazerne'}
def fetch(pair):
 name,url=pair
 for i in range(3):
  try:
   data=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'CanalRecallResearch/1.0'}),timeout=40).read();(root/name).write_bytes(data);(root/(name+'.provenance.json')).write_text(json.dumps({'url':url,'retrievedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'sha256':hashlib.sha256(data).hexdigest(),'raw':True,'httpStatus':200},indent=2));return name,len(data)
  except Exception as e:
   if i==2:return name,str(e)
   time.sleep(2+i*2)
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex: print(list(ex.map(fetch,urls.items())))
(root/'urls.json').write_text(json.dumps(urls,indent=2))
