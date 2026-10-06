import json,pathlib
from pyproj import Transformer
from shapely.geometry import Polygon
r=pathlib.Path('../map-recall2-source-data/models/beta-boulders');x=json.load(open(r/'webpages/survey.json'));t=x['metadata']['transform'];v=[[p[i]*t['scale'][i]+t['translate'][i] for i in range(3)] for p in x['feature']['vertices']];g=list(x['feature']['CityObjects'].values())[1]['geometry'][-1];ground=.72;cx=118800;cy=484187
roofs=[];omitted=[]
for k,(bounds,s) in enumerate(zip(g['boundaries'][0],g['semantics']['values'][0])):
 if g['semantics']['surfaces'][s]['type']!='RoofSurface':continue
 rings=[[[v[i][0]-cx,cy-v[i][1],v[i][2]-ground] for i in ring] for ring in bounds]
 poly=Polygon([p[:2] for p in rings[0]],[[p[:2] for p in ring] for ring in rings[1:]])
 if poly.area<18:omitted.append({'index':k,'area':poly.area,'reason':'small equipment/roof-fit patch; not whole-building height'});continue
 roofs.append({'index':k,'rings':rings,'area':poly.area})
bag=json.load(open(r/'webpages/bag-parent.json'));tf=Transformer.from_crs(4326,28992,always_xy=True);outline=[[[tf.transform(*p)[0]-cx,cy-tf.transform(*p)[1]] for p in ring] for ring in bag['geometry']['coordinates']];poly=Polygon(outline[0]);simple=list(poly.simplify(.08,preserve_topology=True).exterior.coords);anchor=Transformer.from_crs(28992,4326,always_xy=True).transform(cx,cy)
d={'id':'beta-boulders','anchor':list(anchor),'groundNAP':ground,'bagId':bag['properties']['identificatie'],'building':bag,'outline':outline,'facadePerimeter':simple,'roofs':roofs,'omittedRoofPatches':omitted,'sourceDate':'2026-10-06','sourceUrls':['https://betaboulders.nl/','https://theolympicamsterdam.nl/nl/single-company/beta-boulders','https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012087748','https://architectenweb.nl/nieuws/artikel.aspx?id=47074'],'scope':'Whole north garage native parent,15 tenants; Beta VBO424m² usable area is not footprint. Olympiahuisje and southern garage remain separate.','archiveSearch':{'url':'https://archief.amsterdam/beeldbank/?mode=gallery&q=Stadionplein%2018','state':'HTTP200 viewer shell; no inspected historical drawing. Address may also refer to relocated Olympiahuisje; no facade assertion transferred.'},'heightNotes':'AHN5(2023) terrainNAP0.72; main roofNAP15.8; large raised office/roof volumes aroundNAP19.4–19.6. Small fitted/equipment plates above20m omitted; not a whole body height.','uncertainty':'Roof garden/atrium interior details simplified. No ground through-court assertion; enclosed glazed atria. Exterior current window rhythm is photo guided, not measured.'}
p=pathlib.Path('scripts/landmarks/beta-boulders-footprints.json');p.write_text(json.dumps(d,indent=2)+'\n')
print({'anchor':anchor,'outline':simple,'roofs':[(q['index'],round(q['area']),round(min(p[2] for p in q['rings'][0]),1)) for q in roofs]})
