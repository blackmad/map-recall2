import json,math,pathlib,xml.etree.ElementTree as E
root=pathlib.Path('../map-recall2-source-data/models/fire-station-weesp/raw');out=pathlib.Path('scripts/landmarks')
anchor=[5.04486,52.30270]
def rdll(x,y):
 dx=(x-155000)*1e-5;dy=(y-463000)*1e-5
 la=52.15517440+sum(a*dx**p*dy**q for p,q,a in [(0,1,3235.65389),(2,0,-32.58297),(0,2,-.2475),(2,1,-.84978),(0,3,-.0655),(2,2,-.01709),(1,0,-.00738),(4,0,.0053),(2,3,-.00039),(4,1,.00033),(1,1,-.00012)])/3600
 lo=5.38720621+sum(a*dx**p*dy**q for p,q,a in [(1,0,5260.52916),(1,1,105.94684),(1,2,2.45656),(3,0,-.81885),(1,3,.05594),(3,1,-.05607),(0,1,.01199),(3,2,-.00256),(1,4,.00128),(0,2,.00022),(2,0,-.00022),(5,0,.00026)])/3600
 return [lo,la]
def local(ll):return [(ll[0]-anchor[0])*111320*math.cos(math.radians(anchor[1])),(anchor[1]-ll[1])*111320]
j=json.load(open(root/'3dbag.json'));f=j['feature'];tr=j['metadata']['transform'];vs=[[v[i]*tr['scale'][i]+tr['translate'][i] for i in range(3)] for v in f['vertices']];verts=[[local(rdll(v[0],v[1]))[0],v[2]+1.006,local(rdll(v[0],v[1]))[1]] for v in vs]
g=f['CityObjects']['NL.IMBAG.Pand.0457100000062823-0']['geometry'][-1];roofs=[]
for i,b in enumerate(g['boundaries'][0]):
 if g['semantics']['surfaces'][g['semantics']['values'][0][i]]['type']=='RoofSurface':roofs.append({'index':i,'rings':[[verts[v] for v in ring] for ring in b]})

pand=json.load(open(root/'weesp-pand-0457100000062823.json'));ringLL=[rdll(*v[:2]) for v in pand['geometrie']['coordinates'][0]];ring=[local(p) for p in ringLL]
record={'id':'fire-station-weesp','anchor':anchor,'bagId':'0457100000062823','poiId':'n1618230174','nativeRing':ring,'buildingFootprint':{'type':'Polygon','coordinates':[ringLL]},'surveyRoofParts':roofs,'groundNAP':-1.006,'registeredYear':2010,'sourceUrls':['https://www.brandweer.nl/kazerne/weesp/','https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0457100000062823','https://brandbase.hetbrandweerforum.nl/kazernes/13-45-weesp/','https://www.tgooi.info/weesp/brandweer.php'],'sourceArchivePath':'models/fire-station-weesp/'}
(out/'fire-station-weesp-footprints.json').write_text(json.dumps(record,indent=2)+'\n')
for r in roofs:
 print(r['index'], len(r['rings'][0]),[(round(min(v[i] for v in r['rings'][0]),1),round(max(v[i] for v in r['rings'][0]),1)) for i in [0,1,2]])
