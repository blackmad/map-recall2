#!/usr/bin/env python3
"""Archive operator pages and PDOK address responses; preserve exact address identities."""
import urllib.request, urllib.parse, json, re, html, hashlib, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[3]
ARCHIVE=ROOT.parent/'map-recall2-source-data'/'firestations-inventory'
ARCHIVE.mkdir(parents=True,exist_ok=True)
records=[]
def fetch(url,key):
 p=ARCHIVE/key
 if p.exists():return p.read_bytes()
 for i in range(3):
  try:
   with urllib.request.urlopen(url,timeout=30) as r:b=r.read();status=r.status
   p.write_bytes(b)
   (ARCHIVE/(key+'.provenance.json')).write_text(json.dumps({'url':url,'retrievedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'httpStatus':status,'sha256':hashlib.sha256(b).hexdigest(),'rights':'Publicly available operator/PDOK response; reuse terms not independently assessed.','raw':True},indent=2)+'\n')
   return b
  except Exception as e:
   if i==2:raise
   time.sleep(2**i)
index='https://www.brandweer.nl/amsterdam-amstelland/kazernes/'
fetch(index,'operator-index.html')
fetch('https://www.brandweer.nl/kazerne/jan-van-der-heyde/','jan-van-der-heyde.html')
names=['Hendrik','Anton','Dirk','IJsbrand','Nico','Osdorp','Pieter','Teunis','Victor','Willem','Zebra','Driemond','Weesp']
def station(name):
 slug=('amsterdam-'+name.lower()) if name not in ['Driemond','Weesp'] else name.lower()
 u='https://www.brandweer.nl/kazerne/'+slug+'/'
 b=fetch(u,slug+'.html').decode()
 contact=b.split('### Contact')[-1] if '### Contact' in b else b[b.rfind('<h4>'):]
 match=re.search(r'<h4[^>]*>.*?</h4>\s*<p>\s*(.*?)<br\s*/?>\s*(.*?)<br',contact,re.S)
 if not match:raise Exception('no contact '+name)
 address=html.unescape(re.sub('<[^>]*>','',match[1])).strip();pc_city=html.unescape(match[2]).strip()
 q=address+' '+pc_city
 pu='https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?'+urllib.parse.urlencode({'q':q,'fq':'type:adres','rows':5})
 pd=json.loads(fetch(pu,slug+'-pdok.json'))
 docs=pd['response']['docs'];d=docs[0]
 coord=re.search(r'POINT\(([-\d.]+) ([-\d.]+)\)',d['centroide_ll'])
 vbo_url='https://api.data.amsterdam.nl/v1/bag/verblijfsobjecten/'+d['adresseerbaarobject_id']+'/'
 vbo=json.loads(fetch(vbo_url,slug+'-vbo.json'))
 parents=vbo['_links']['ligtInPanden']
 for parent in parents: fetch(parent['href'],slug+'-pand-'+parent['identificatie']+'.json')
 print(name,address,pc_city,[x['identificatie'] for x in parents],flush=True)
 return {'name':'Kazerne '+name,'proposedModelId':'fire-station-'+name.lower(),'officialName':name if name in ['Weesp','Driemond'] else 'Amsterdam '+name,'address':address,'postcodeCity':pc_city,'sourceUrl':u,'addressMatch':d['weergavenaam'],'municipality':d.get('gemeentenaam'),'centerLatLon':[float(coord[2]),float(coord[1])],'coordinateMeaning':'BAG address/VBO centroid from PDOK; public entrance and physical footprint still require verification','bag':{k:d.get(k) for k in ['nummeraanduiding_id','adresseerbaarobject_id','id']},'bagPandIds':[x['identificatie'] for x in parents],'municipalVboSourceUrl':vbo_url,'identityState':'official current station with BAG address match; footprint/OSM scope pending','modeled':False,'modeledAudit':'No firestation-name entry in manualCatalogue at inventory research time','rawSourcePaths':[str((ARCHIVE/(slug+'.html')).relative_to(ROOT.parent/'map-recall2-source-data')),str((ARCHIVE/(slug+'-pdok.json')).relative_to(ROOT.parent/'map-recall2-source-data')),str((ARCHIVE/(slug+'-vbo.json')).relative_to(ROOT.parent/'map-recall2-source-data'))]+[str((ARCHIVE/(slug+'-pand-'+x['identificatie']+'.json')).relative_to(ROOT.parent/'map-recall2-source-data')) for x in parents]}
with ThreadPoolExecutor(max_workers=4) as pool:records=list(pool.map(station,names))
out={'version':1,'researchedOn':time.strftime('%Y-%m-%d'),'scope':'Current land firestations of the Amsterdam municipality, including Driemond and Weesp. Operator index is region-wide; exclude neighboring municipalities.','sourceUrls':[index],'sourceArchivePath':'firestations-inventory/','stations':records,'separateFacilities':[{'name':'Blusboot Jan van der Heyde IV','kind':'fireboat/boathouse; not a land firestation','sourceUrl':'https://www.brandweer.nl/kazerne/jan-van-der-heyde/','state':'Official index lists separately; land-building scope not admitted'}],'excludedMunicipalities':['Aalsmeer','Amstelveen','Diemen','Duivendrecht (Ouder-Amstel)','Uithoorn'],'remainingChecks':['Fetch physical footprints/current OSM identity per station before authoring.','Check map/runtime coverage for peripheral Driemond and Weesp.','Inventory excludes logistics and training facilities not listed as current operational land stations.']}
import gzip
found={bid:[] for station in records for bid in station['bagPandIds']}
for tile in (ROOT/'public/data/extracts/amsterdam/building-tiles').rglob('*.geojson.gz'):
 for feature in json.load(gzip.open(tile)).get('features',[]):
  fid=feature.get('properties',{}).get('id','');bid=fid.replace('NL.IMBAG.Pand.','')
  if bid in found and not any(x['feature']==feature for x in found[bid]):found[bid].append({'tile':str(tile.relative_to(ROOT)),'feature':feature})
for station in records:
 matches=[feature for bid in station['bagPandIds'] for feature in found[bid]]
 station['installedBuildingIds']=sorted(set(f['feature']['properties']['id'] for f in matches))
 station['installedTilePaths']=sorted(set(f['tile'] for f in matches))
 station['mapExtractCoverage']='present' if matches else 'not found in installed building tiles'
 station['nativeTileFeatures']=matches
(ROOT/'scripts/landmarks/firestations-inventory.json').write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n')
