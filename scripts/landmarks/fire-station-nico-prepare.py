import json,math,pathlib,xml.etree.ElementTree as E
root=pathlib.Path('../map-recall2-source-data/models/fire-station-nico/raw');out=pathlib.Path('scripts/landmarks')
anchor=[4.90927401,52.37005792]
def rdll(x,y):
 dx=(x-155000)*1e-5;dy=(y-463000)*1e-5
 la=52.15517440+sum(a*dx**p*dy**q for p,q,a in [(0,1,3235.65389),(2,0,-32.58297),(0,2,-.2475),(2,1,-.84978),(0,3,-.0655),(2,2,-.01709),(1,0,-.00738),(4,0,.0053),(2,3,-.00039),(4,1,.00033),(1,1,-.00012)])/3600
 lo=5.38720621+sum(a*dx**p*dy**q for p,q,a in [(1,0,5260.52916),(1,1,105.94684),(1,2,2.45656),(3,0,-.81885),(1,3,.05594),(3,1,-.05607),(0,1,.01199),(3,2,-.00256),(1,4,.00128),(0,2,.00022),(2,0,-.00022),(5,0,.00026)])/3600
 return [lo,la]
def local(ll):return [(ll[0]-anchor[0])*111320*math.cos(math.radians(anchor[1])),(anchor[1]-ll[1])*111320]
j=json.load(open(root/'3dbag.json'));f=j['feature'];tr=j['metadata']['transform'];vs=[[v[i]*tr['scale'][i]+tr['translate'][i] for i in range(3)] for v in f['vertices']];verts=[[local(rdll(v[0],v[1]))[0],v[2]-1.768,local(rdll(v[0],v[1]))[1]] for v in vs]
g=f['CityObjects']['NL.IMBAG.Pand.0363100012165618-0']['geometry'][-1];roofs=[]
for i,b in enumerate(g['boundaries'][0]):
 if g['semantics']['surfaces'][g['semantics']['values'][0][i]]['type']=='RoofSurface':roofs.append({'index':i,'rings':[[verts[v] for v in ring] for ring in b]})

pand=json.load(open(root/'amsterdam-nico-pand-0363100012165618.json'));ringLL=[rdll(*v[:2]) for v in pand['geometrie']['coordinates'][0]];ring=[local(p) for p in ringLL]
e=E.parse(root/'osm-map.xml').getroot();nodes={n.attrib['id']:[float(n.attrib['lon']),float(n.attrib['lat'])] for n in e.findall('node')};w=next(w for w in e.findall('way') if w.attrib['id']=='268783309');osm=[nodes[n.attrib['ref']] for n in w.findall('nd')]
record={'id':'fire-station-nico','anchor':anchor,'bagId':'0363100012165618','osmId':'w268783309','poiId':'n1139360975','nativeRing':ring,'buildingFootprint':{'type':'Polygon','coordinates':[ringLL]},'surveyRoofParts':roofs,'groundNAP':1.768,'registeredYear':1972,'sourceUrls':list(json.load(open(root/'urls.json')).values()),'sourceArchivePath':'models/fire-station-nico/','heightNotes':'2023AHN5 1.768NAP ground. Variable flat roof masses, equipment max24.982NAP is not wholebuildingheight. 2025roofrenovation photo confirms greybrick/whiteglazinglargeupperpanel.'}
(out/'fire-station-nico-footprints.json').write_text(json.dumps(record,indent=2)+'\n')
for r in roofs:
 p=r['rings'][0];print(r['index'],len(p),'height',round(sum(v[1] for v in p)/len(p),2),'box',[(round(min(v[i] for v in p),1),round(max(v[i] for v in p),1)) for i in [0,2]])
