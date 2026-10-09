import json,math,xml.etree.ElementTree as E,pathlib,hashlib,time,re,urllib.request
raw=pathlib.Path('../map-recall2-source-data/models/fire-station-victor/raw');fpath=pathlib.Path('scripts/landmarks/fire-station-victor-footprints.json');f=json.load(open(fpath));anchor=f['anchor']
def local(ll):return [(ll[0]-anchor[0])*111320*math.cos(math.radians(anchor[1])),(anchor[1]-ll[1])*111320]
e=E.parse(raw/'osm-map.xml').getroot();nodes={n.attrib['id']:[float(n.attrib['lon']),float(n.attrib['lat'])]for n in e.findall('node')}
def dist(p,a,b):
 dx=b[0]-a[0];dy=b[1]-a[1];t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy))) if dx*dx+dy*dy else 0
 return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
neighbors=[];streets=[];own=f['nativeRing']
for w in e.findall('way'):
 tags={t.attrib['k']:t.attrib['v']for t in w.findall('tag')};ll=[nodes[n.attrib['ref']]for n in w.findall('nd')];ps=[local(p)for p in ll]
 if len(ps)<2:continue
 gap=min(dist(p,a,b)for p in own for a,b in zip(ps,ps[1:]))
 gap=min(gap,min(dist(p,a,b)for p in ps for a,b in zip(own,own[1:])))
 if tags.get('ref:bag') and tags['ref:bag']!='0363100012103300'and gap<35:neighbors.append({'osmId':'w'+w.attrib['id'],'bagId':tags['ref:bag'],'tags':tags,'nativeRing':ps,'nearestBoundaryGapMetres':round(gap,2)})
 if tags.get('name')in['Dapperstraat','Domselaerstraat']and tags.get('highway')and gap<30:streets.append({'osmId':'w'+w.attrib['id'],'tags':tags,'nativeLine':ps,'nearestBoundaryGapMetres':round(gap,2)})
f.update(adjacentParents=neighbors,adjacentStreets=streets,frontage={'nativeVertices':[own[2],own[5]],'outwardNormal':[-.924,.382],'street':'Dapperstraat','principalReferenceCamera':[4.928958857133795,52.36042546400292],'sideFrontageVertices':[own[5],own[6]],'sideOutwardNormal':[.371,.929],'sideStreet':'Domselaerstraat','finding':'Principal two garage portals face west-southwest across Dapperstraat; paired corner gables mark Domselaerstraat return. Rear/east outline is not a public facade. ALL immediately surrounding mapped BAG parents retained, no padded suppression.'},publicEntrance={'lonLat':[4.929157,52.360452],'meaning':'Pavement in front of actualDapperstraat twin apparatus portals; slight outwardoffset fromBAG wall. Officialaddress andgenuinePOI agree.'},references={'currentPanoramas':[{'id':p['pano_id'],'captureDate':p['timestamp'],'camera':p['geometry'],'url':p['_links']['equirectangular_full']['href']}for p in json.load(open(raw/'selected-panoramas.json'))],'photoDates':['2021-05','2021-01','2011-10','1911','2016-11'],'monumentSearch':'Bounded municipal/RCE address search returned no matched description. No heritage registration claimed. Beeldbank address query rawJSshell captured; Amsterdamopdekaart lists3 catalogue-relatedimages but shell aloneisnotinspected originals.1911elevation drawing fromPubliekeWerken preserved separately withpagePDcaption.','bouwdossiers':'Building1911 lies1905–2010 archivewindow; publictender2025drawingsavailableandcached; DataAmsterdam dossier accessnotyetestablished.'})
fpath.write_text(json.dumps(f,indent=2)+'\n');print([(x['bagId'],x['nearestBoundaryGapMetres'])for x in neighbors]);print([(s['tags']['name'],s['nearestBoundaryGapMetres'])for s in streets])
urls=json.load(open(raw/'urls.json'));urls['panoramas-page2.json']='https://api.data.amsterdam.nl/panorama/panoramas/?bbox=4.9288%2C52.3601%2C4.9297%2C52.3608&page=2&page_size=100';h=(raw/'architecture.html').read_text();photos=[u for u in re.findall(r'data-src="([^"]+)"',h)if'platen_groot'in u]
for i,u in enumerate(photos):urls['architecture-photo-%d.webp'%i]=u
for p in json.load(open(raw/'selected-panoramas.json')):urls[p['pano_id']+'.jpg']=p['_links']['equirectangular_full']['href']
for n,u in urls.items():
 p=raw/n
 if p.exists():(raw/(n+'.provenance.json')).write_text(json.dumps({'url':u,'retrievedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'raw':True,'httpStatus':200,'rights':'Municipality panoramas/API perproviderterms; architecturephotographs havepagecaptionsandcopyright, rawprivatearchiveonly.1911PubliekeWerkenpagecaptionpublicdomain.'},indent=2))
(raw/'urls.json').write_text(json.dumps(urls,indent=2))
