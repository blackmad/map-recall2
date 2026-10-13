import json,math,pathlib,urllib.request,urllib.parse,concurrent.futures,xml.etree.ElementTree as E,hashlib
raw=pathlib.Path('../map-recall2-source-data/models/fire-station-anton/raw');f=json.load(open('scripts/landmarks/fire-station-anton-footprints.json'));angle=-f['localRotationRadians'];c=math.cos(angle);s=math.sin(angle)
points=[(-15,z) for z in [22.5,27,32,37,42,47,52,57]]+[(5,z) for z in [22.5,27,32,37,42,47,52,57]]+[(x,z) for x,z in [(-28,28),(-28,18),(-28,8),(-28,-4),(-28,-16),(-8,-17),(-8,-27),(-8,-37),(6,-36),(17,-27),(17,-16),(17,0),(17,15),(17,28),(-13,-7),(-13,-14),(-12,0)]]
def get(q):
 x,z=q;ex=126770+c*x-s*z;ny=480010-s*x-c*z;p=dict(service='WMS',version='1.3.0',request='GetFeatureInfo',layers='dtm_05m',query_layers='dtm_05m',crs='EPSG:28992',bbox=f'{ex-1},{ny-1},{ex+1},{ny+1}',width=3,height=3,i=1,j=1,info_format='application/json',format='image/png');u='https://service.pdok.nl/rws/actueel-hoogtebestand-nederland/wms/v1_0?'+urllib.parse.urlencode(p);file=raw/f'ahn-ground-{x}-{z}.json'
 for attempt in range(3):
  try:
   b=file.read_bytes() if file.exists() else urllib.request.urlopen(u,timeout=20).read();file.write_bytes(b);j=json.loads(b);value=j['features'][0]['properties']['value_list'];rec={'local':[x,z],'rd':[ex,ny],'heightNAP':float(value.split(',')[0]) if value not in ['nodata',''] else None,'url':u,'path':str(file),'sha256':hashlib.sha256(b).hexdigest(),'retrievedOn':'2026-10-09','access':'HTTP200'};return rec
  except Exception as e:
   if attempt==2:return {'local':[x,z],'url':u,'error':str(e)}
rs=list(concurrent.futures.ThreadPoolExecutor(5).map(get,points));(raw/'ahn-ground-samples.json').write_text(json.dumps(rs,indent=2)+'\n');print([(r['local'],r.get('heightNAP',r.get('error'))) for r in rs])
