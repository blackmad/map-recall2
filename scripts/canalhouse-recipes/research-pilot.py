"""Bounded official identity / archival lookup. Raw responses stay in private source pack."""
import json,gzip,pathlib,hashlib,urllib.request,urllib.parse,concurrent.futures,datetime,re
ROOT=pathlib.Path(__file__).resolve().parents[2]; PACK=ROOT.parent/'map-recall2-source-data/streets/canalhouse-recipes-pilot'; RAW=PACK/'raw';RAW.mkdir(parents=True,exist_ok=True)
DATE=datetime.datetime.now(datetime.timezone.utc).isoformat();manifest=[]
def fetch(url):
 key=hashlib.sha256(url.encode()).hexdigest();p=RAW/(key+'.bin');meta=RAW/(key+'.provenance.json')
 if p.exists():return p.read_bytes(),json.load(open(meta))
 try:
  r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'CanalRecallResearch/1.0'}),timeout=40);b=r.read();status=r.status;final=r.url;typ=r.headers.get('Content-Type')
 except urllib.error.HTTPError as e:b=e.read();status=e.code;final=e.url;typ=e.headers.get('Content-Type')
 p.write_bytes(b);m=dict(url=url,finalUrl=final,status=status,accessed=DATE,sha256=hashlib.sha256(b).hexdigest(),bytes=len(b),contentType=typ,rawPath=str(p.relative_to(PACK)));meta.write_text(json.dumps(m,indent=2));return b,m
def get(url):
 b,m=fetch(url)
 if m['status']!=200:raise Exception(str(m))
 return json.loads(b),m
D=json.load(gzip.open(ROOT.parent/'map-recall2-source-data/datasets/amsterdam-monument-register/2026-10-05T06-10-55-572Z-83107/normalized/records.json.gz'));R={r['monumentNumber']:r for r in D['rce']}
bag='https://api.pdok.nl/kadaster/bag/ogc/v2/collections';out=[]
def house(n):
 address=f'Herengracht {n}';mr=next(r for r in D['municipal'] if r['metadata'].get('adressering')==address and r['bagPandIds'] and r['bagPandIds'][0].startswith('0363'));rce=R.get(mr['monumentNumber']);descs=mr['descriptions'] or rce.get('descriptions',[])
 q=urllib.parse.urlencode({'q':f'straatnaam:Herengracht AND huisnummer:{n}','fq':'woonplaatsnaam:Amsterdam','rows':100,'fl':'*'})
 ads,am=get('https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?'+q);ads=[a for a in ads['response']['docs'] if a.get('type')=='adres' and a.get('straatnaam')=='Herengracht' and a.get('huisnummer')==n and a.get('woonplaatsnaam')=='Amsterdam'];links=[]
 for a in ads:
  v,vm=get(bag+'/verblijfsobject/items?identificatie='+a['adresseerbaarobject_id']+'&f=json');fs=v['features']
  if len(fs)!=1:raise Exception('ambiguous VBO')
  for u in fs[0]['properties'].get('pand.href',[]):
   p,pm=get(u+'?f=json');links.append(dict(address=a['weergavenaam'],addressId=a['nummeraanduiding_id'],vboId=a['adresseerbaarobject_id'],pandId=p['properties']['identificatie'],vboSource=vm,pandSource=pm,pand=p))
 match=[l for l in links if l['pandId'] in mr['bagPandIds']]
 if not match:raise Exception('No confirmed address VBO Pand register match '+address)
 p=match[0]['pand'];bmUrl='https://archief.amsterdam/beeldbank/?mode=gallery&view=horizontal&q='+urllib.parse.quote(address+' bouwtekening');_,bm=fetch(bmUrl)
 # Keep cached full normalized register input privately and references to original raw generation.
 register={'municipal':mr,'rce':rce};rp=PACK/'processed'/f'herengracht-{n}-register.json';rp.parent.mkdir(exist_ok=True);rp.write_text(json.dumps(register,indent=2))
 return dict(id=f'herengracht-{n}',address=address,bagId=p['properties']['identificatie'],buildingId='NL.IMBAG.Pand.'+p['properties']['identificatie'],geometry=p['geometry'],constructionYear=p['properties'].get('bouwjaar',p['properties'].get('oorspronkelijk_bouwjaar')),bagStatus=p['properties']['status'],officialAddressLinks=match,register=dict(monumentNumber=mr['monumentNumber'],municipalUrl=mr['recordUrl'],rceUrl=rce['recordUrl'],descriptions=descs,sourcePackPath=str(rp.relative_to(PACK)),cachedGeneration='datasets/amsterdam-monument-register/2026-10-05T06-10-55-572Z-83107'),beeldbank=dict(**bm,accessState='bounded search response archived; results/drawings not yet inspected',rights='unknown until catalogue item retrieved'),currentFacade=dict(status='pending municipal panorama inspection'),height=dict(status='unknown; BAG year/footprint are not height evidence'))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
 for h in ex.map(house,range(405,429,2)):out.append(h);print(h['address'],h['bagId'],flush=True)
# Preserve full original register archive raw response bytes with provenance; no network refetch.
source=ROOT.parent/'map-recall2-source-data/datasets/amsterdam-monument-register/2026-10-05T06-10-55-572Z-83107'
(PACK/'register-source-link.json').write_text(json.dumps({'sourceGenerationPath':str(source),'sourcePackManifestSha256':hashlib.sha256((source/'source-pack-manifest.json').read_bytes()).hexdigest(),'note':'Raw original register responses are preserved in this existing private pack; processed per-house extraction here references it.'},indent=2))
inventory=dict(schemaVersion=1,id='herengracht-405-427-odd-pilot',status='source-inventory-not-visual-acceptance',retrieved=DATE,privateSourcePack='streets/canalhouse-recipes-pilot',selection={'addresses':list(range(405,429,2)),'reason':'12 explicit Pand matches and complete register descriptions; straight cornice/neck/bell/point/step variety. Current panorama quality still to be inspected.'},houses=out)
(ROOT/'docs/references/canalhouse-recipes/pilot-inventory.json').write_text(json.dumps(inventory,indent=2)+'\n')
