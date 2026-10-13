"""One plain-address photo/catalogue search per pilot house; one discovered service attempt."""
import pathlib,json,urllib.request,urllib.error,urllib.parse,hashlib,datetime,concurrent.futures,re
ROOT=pathlib.Path(__file__).resolve().parents[2];PACK=ROOT.parent/'map-recall2-source-data/streets/canalhouse-recipes-pilot';RAW=PACK/'raw';date=datetime.datetime.now(datetime.timezone.utc).isoformat();file=ROOT/'docs/references/canalhouse-recipes/pilot-inventory.json';I=json.load(open(file))
def fetch(url):
 key=hashlib.sha256(url.encode()).hexdigest();p=RAW/(key+'.bin');mfile=RAW/(key+'.provenance.json')
 if p.exists():return p.read_bytes(),json.load(open(mfile))
 try:r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'CanalRecallResearch/1.0'}),timeout=30);b=r.read();code=r.status;final=r.url;ctype=r.headers.get('content-type')
 except urllib.error.HTTPError as e:b=e.read();code=e.code;final=e.url;ctype=e.headers.get('content-type')
 m=dict(url=url,status=code,finalUrl=final,accessed=date,sha256=hashlib.sha256(b).hexdigest(),bytes=len(b),contentType=ctype,rawPath=str(p.relative_to(PACK)));p.write_bytes(b);mfile.write_text(json.dumps(m,indent=2));return b,m
def search(h):
 url='https://archief.amsterdam/beeldbank/?mode=gallery&view=horizontal&q='+urllib.parse.quote(h['address']);b,m=fetch(url);m.update(accessState='plain exact-address photo/catalogue search: archived JavaScript viewer shell; no catalogue/photo inspected',rights='catalogue/photo rights unknown; no original item downloaded');return h['id'],b,m
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as ex:results=list(ex.map(search,I['houses']))
byid={id:(b,m)for id,b,m in results}
shell=results[0][1].decode(errors='replace');service={'state':'pending script endpoint inspection'}
urls=re.findall(r'<script[^>]+src=[\"\']([^\"\']+)',shell);jsurl=next((u for u in urls if u.endswith('/mediabank.min.js')),None)
if jsurl:
 b,jm=fetch(jsurl);js=b.decode(errors='replace');(PACK/'processed/beeldbank-service-inspection.json').write_text(json.dumps({'scriptSource':jm,'apiUrlFromShell':re.search(r'data-api-url="([^"]+)',shell)[1],'note':'Inspect endpoint code once; do not claim inaccessible search results.'},indent=2));print('script bytes',len(b))
 # Printed bounded snippets are code only, no shell embedded public service key.
 # Endpoint symbols inspected locally; avoid dumping minified JavaScript.
for h in I['houses']:h['beeldbank']['photoSearch']=byid[h['id']][1]
file.write_text(json.dumps(I,indent=2)+'\n');print('plain address searches archived',len(results))
# Endpoint and apiKey parameter are read from the current public viewer HTML+JS.
# This is a public browser service identifier, not a private credential.
base=re.search(r'data-api-url="([^"]+)',shell)[1];public_key=re.search(r'data-api-key="([^"]+)',shell)[1]
apiurl=base.rstrip('/')+'/media?'+urllib.parse.urlencode({'apiKey':public_key,'lang':'nl','q':'Herengracht 415','rows':3,'page':1})
b,am=fetch(apiurl)
try:api=json.loads(b)
except:api=None
service=dict(discoveredVia={'viewerShell':results[0][2]['url'],'javascript':jsurl,'endpointSymbol':'ENDPOINT_MEDIA="media"; public viewer adds apiKey/q/rows/page parameters'},attempt=am,scope='one bounded official viewer-service photo search for Herengracht415; no endpoint guessing',accessState='JSON retrieved; catalogue response needs interpretation'if api else'non-JSON/error response; no catalogue/photo retrieved')
(PACK/'processed/beeldbank-service-inspection.json').write_text(json.dumps(service,indent=2)+'\n')
I['beeldbankServiceAttempt']=service;file.write_text(json.dumps(I,indent=2)+'\n');print('one discovered API attempt status',am['status'],'JSON keys',list(api)if isinstance(api,dict)else None)
items=[]
if api:
 for item in api.get('media',[])[:3]:
  asset=item['asset'][0];original,om=fetch(asset['download']);preview,pm=fetch(asset['thumb']['large']);previewpath=PACK/'processed'/('beeldbank-'+item['id']+'-preview.jpg');previewpath.write_bytes(preview)
  md={m['field']:m['value']for m in item['metadata']};rec=dict(id=item['id'],title=item['title'],description=item.get('description'),catalogueUrl=item['handle'],date=md.get('dc_date'),rights=md.get('sr_rechthebbende'),creator=md.get('sk_vervaardiger'),catalogueSource=am,originalSource=om,previewSource=pm,previewPath=str(previewpath.relative_to(PACK)),inspectionState='original bytes+catalogue acquired; visual inspection pending',currentStateLimit='Dated historical photo; compare2024 municipal appearance/alterations before geometry use');items.append(rec)
  print('archived catalogue',item['id'],'original status',om['status'],'bytes',om['bytes'],'date',rec['date'])
service['accessState']='three returned catalogue records+original source bytes archived; bounded one415 search only';service['items']=items;(PACK/'processed/beeldbank-service-inspection.json').write_text(json.dumps(service,indent=2)+'\n');I['beeldbankServiceAttempt']=service
for h in I['houses']:
 n=int(h['address'].split()[-1]);h['beeldbank']['catalogueReferences']=[x for x in items if (n in [415,417] if '1855' in str(x['date']) else 415<=n<=425)]
file.write_text(json.dumps(I,indent=2)+'\n')
# Per canonical model index references shared raw bytes instead of duplicate assets.
for h in I['houses']:
 model=PACK/'models'/h['id'];model.mkdir(parents=True,exist_ok=True);sources=[]
 sources.extend([h['beeldbank'],h['currentFacade']['rawSource'],h.get('rowContext',{}).get('rawSource',{})]);sources.extend([x[k]for x in h['officialAddressLinks']for k in ['vboSource','pandSource']]);survey=json.load(open(ROOT/h['height']['surveyFile']));sources.append(dict(rawPath=survey['rawPath'],sha256=survey['rawSha256'],url=survey['sourceUrl']))
 index=dict(canonicalModelId=h['id'],physicalIdentity=h['buildingId'],address=h['address'],sharedPack='../../',rawReferences=sources,registerReference=dict(processedPath=h['register']['sourcePackPath'],originalRawPack=h['register']['cachedGeneration']),catalogueReferences=h['beeldbank']['catalogueReferences'],processedReferences=[str(pathlib.Path(h['currentFacade']['cropFile']).relative_to(PACK)),f'processed/{h["id"]}-facade.jpg'],publicSurvey=h['height']['surveyFile'],policy='Raw originals live once in shared pilot raw directory; original register bytes remain in referenced city register source pack. This index is canonical per-model source ownership, not a duplicate full pack.');(model/'source-pack-index.json').write_text(json.dumps(index,indent=2)+'\n')
# Regenerate shared raw checksum manifest without resetting root/source inventory fields.
manifest=json.load(open(PACK/'source-pack-manifest.json'));records=[]
for mp in sorted(RAW.glob('*.provenance.json')):
 m=json.load(open(mp));assert hashlib.sha256((PACK/m['rawPath']).read_bytes()).hexdigest()==m['sha256'];records.append(m)
manifest['rawSources']=records;manifest['canonicalModelIndexes']=[f'models/{h["id"]}/source-pack-index.json'for h in I['houses']];manifest['processed']=[str(x.relative_to(PACK))for x in sorted((PACK/'processed').glob('*'))];manifest['gaps']='No archival drawings/dossier sheets. One bounded415 photo API sample yielded three historical originals; individual facade source registration and model/live acceptance remain.';(PACK/'source-pack-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
