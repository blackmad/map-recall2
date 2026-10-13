import json,math,pathlib,xml.etree.ElementTree as E
root=pathlib.Path('../map-recall2-source-data/models/fire-station-osdorp/raw');out=pathlib.Path('scripts/landmarks')
exec(open('scripts/landmarks/fire-station-hendrik-prepare.py').read().split('j=json.load')[0].split('def rdll')[1].join(['def rdll','']).split("root=")[0] if False else open('scripts/landmarks/fire-station-hendrik-prepare.py').read()[open('scripts/landmarks/fire-station-hendrik-prepare.py').read().index('def rdll'):open('scripts/landmarks/fire-station-hendrik-prepare.py').read().index('def local')])
anchor=rdll(115157,486680);ang=.317;co=math.cos(ang);si=math.sin(ang)
def local(ll):
 x=(ll[0]-anchor[0])*111320*math.cos(math.radians(anchor[1]));z=(anchor[1]-ll[1])*111320
 return [co*x-si*z,si*x+co*z]
pand=json.load(open(root/'amsterdam-osdorp-pand-0363100012096223.json'));ringLL=[rdll(*v[:2]) for v in pand['geometrie']['coordinates'][0]];ring=[local(p) for p in ringLL]
j=json.load(open(root/'3dbag.json'));f=j['feature'];tr=j['metadata']['transform'];verts=[]
for v in f['vertices']:
 p=[v[i]*tr['scale'][i]+tr['translate'][i] for i in range(3)];l=local(rdll(*p[:2]));verts.append([l[0],p[2]+.902,l[1]])
g=f['CityObjects']['NL.IMBAG.Pand.0363100012096223-0']['geometry'][-1];roofs=[]
for i,b in enumerate(g['boundaries'][0]):
 if g['semantics']['surfaces'][g['semantics']['values'][0][i]]['type']=='RoofSurface':roofs.append({'index':i,'rings':[[verts[v] for v in rr] for rr in b]})
e=E.parse(root/'osm-map.xml').getroot();nodes={n.attrib['id']:[float(n.attrib['lon']),float(n.attrib['lat'])] for n in e.findall('node')};near=[];streets=[]
for w in e.findall('way'):
 ts={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')};ps=[nodes[n.attrib['ref']] for n in w.findall('nd')]
 if ts.get('ref:bag') and ts['ref:bag']!='0363100012096223':near.append({'osmId':'w'+w.attrib['id'],'bagId':ts['ref:bag'],'localRing':[local(p) for p in ps]})
 if ts.get('name')=='Ookmeerweg':streets.append({'osmId':'w'+w.attrib['id'],'localLine':[local(p) for p in ps],'highway':ts.get('highway')})
rec={'id':'fire-station-osdorp','anchor':anchor,'localRotationRadians':ang,'bagId':'0363100012096223','osmId':'w31779761','poiId':'n2793598969','nativeRing':ring,'buildingFootprint':{'type':'Polygon','coordinates':[ringLL]},'surveyRoofParts':roofs,'groundNAP':-.902,'registeredYear':2005,'sourceUrls':list(json.load(open(root/'urls.json')).values())+['https://arcam.nl/wp-content/uploads/2021/06/1-159.jpg','https://arcam.nl/wp-content/uploads/2021/06/2-135.jpg'],'adjacentParents':near,'streets':streets,'sourceArchivePath':'models/fire-station-osdorp/','heightNotes':'AHN5 2023 terrain -.902 NAP; brick parapet approx14m, hall rolling roof approx7.5-10.7m. 3DBAG slanted planes approximate continuous curved roof, not facades.'}
(out/'fire-station-osdorp-footprints.json').write_text(json.dumps(rec,indent=2)+'\n');print('anchor',anchor,'ring',[[round(x,2) for x in p] for p in ring]);
for r in roofs:print(r['index'],[[round(x,2) for x in v] for v in r['rings'][0]])
