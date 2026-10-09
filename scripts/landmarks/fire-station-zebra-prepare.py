import json,math,pathlib,xml.etree.ElementTree as E
root=pathlib.Path('../map-recall2-source-data/models/fire-station-zebra/raw');out=pathlib.Path('scripts/landmarks')
exec(open('scripts/landmarks/fire-station-hendrik-prepare.py').read().split('def rdll')[1].split('def local')[0].join(['def rdll','']))
anchor=rdll(125581,489912);angle=.418;co=math.cos(angle);si=math.sin(angle)
def local(ll):
 x=(ll[0]-anchor[0])*111320*math.cos(math.radians(anchor[1]));z=(anchor[1]-ll[1])*111320
 return [co*x-si*z,si*x+co*z]
pand=json.load(open(root/'amsterdam-zebra-pand-0363100012109022.json'));ringLL=[rdll(*v[:2]) for v in pand['geometrie']['coordinates'][0]];ring=[local(p) for p in ringLL]
j=json.load(open(root/'3dbag.json'));f=j['feature'];tr=j['metadata']['transform'];ob=f['CityObjects']['NL.IMBAG.Pand.0363100012109022-0']
ground=f['CityObjects']['NL.IMBAG.Pand.0363100012109022']['attributes']['b3_h_maaiveld'];verts=[]
for v in f['vertices']:
 p=[v[i]*tr['scale'][i]+tr['translate'][i] for i in range(3)];l=local(rdll(*p[:2]));verts.append([l[0],p[2]-ground,l[1]])
g=next(g for g in ob['geometry'] if g.get('lod')=='2.2');roofs=[]
for i,b in enumerate(g['boundaries'][0]):
 if g['semantics']['surfaces'][g['semantics']['values'][0][i]]['type']=='RoofSurface':roofs.append({'index':i,'rings':[[verts[v] for v in rr] for rr in b]})
e=E.parse(root/'osm-map.xml').getroot();nodes={n.attrib['id']:[float(n.attrib['lon']),float(n.attrib['lat'])] for n in e.findall('node')};near=[]
for w in e.findall('way'):
 ts={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')};ps=[nodes[n.attrib['ref']] for n in w.findall('nd')]
 if ts.get('ref:bag') and ts['ref:bag']!='0363100012109022':near.append({'osmId':'w'+w.attrib['id'],'bagId':ts['ref:bag'],'localRing':[local(p) for p in ps]})
rec={'id':'fire-station-zebra','anchor':anchor,'localRotationRadians':angle,'bagId':'0363100012109022','osmId':'w44892676','poiId':'n2848174313','nativeRing':ring,'buildingFootprint':{'type':'Polygon','coordinates':[ringLL]},'surveyRoofParts':roofs,'groundNAP':ground,'registeredYear':1973,'sourceUrls':list(json.load(open(root/'urls.json')).values())+list(json.load(open(root/'image-urls.json')).values()),'adjacentParents':near,'sourceArchivePath':'models/fire-station-zebra/'}
(out/'fire-station-zebra-footprints.json').write_text(json.dumps(rec,indent=2)+'\n');print('anchor',anchor,'ring',[[round(x,2) for x in p] for p in ring]);
for r in roofs:print(r['index'],[[round(x,2) for x in v] for v in r['rings'][0]])
