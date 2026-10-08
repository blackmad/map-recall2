# /// script
# requires-python = ">=3.11"
# dependencies = ["shapely>=2,<3"]
# ///
"""Clip only the mapped water underneath each pilot deck; never cover adjoining banks."""
import argparse,json,math,hashlib
from pathlib import Path
from shapely.geometry import shape,Polygon,mapping,MultiPolygon
from shapely.ops import unary_union
from shapely.strtree import STRtree
p=argparse.ArgumentParser();p.add_argument('--archive',required=True);p.add_argument('--ids',default='BRU0057,BRU0059,BRU0065');a=p.parse_args()
root=Path(a.archive);source=root/'terrain/amsterdam/raw/basemap-water.geojson';raw=source.read_bytes();geometries=[shape(f['geometry']) for f in json.loads(raw)['features']];tree=STRtree(geometries)
profiles=json.loads((root/'bridges/amsterdam-measured/raw/bridge-surfaces-v1.json').read_text())['bridges'];result={}
for b in profiles:
 if b['id'] not in a.ids.split(','):continue
 points=[[b['origin'][0]+x/(111320*math.cos(math.radians(b['origin'][1]))),b['origin'][1]+y/111320] for x,y in b['outline']];deck=Polygon(points)
 candidates=[geometries[i] for i in tree.query(deck) if geometries[i].intersects(deck)]
 water=unary_union(candidates).intersection(deck) if candidates else MultiPolygon()
 if water.geom_type=='Polygon':water=MultiPolygon([water])
 if water.geom_type!='MultiPolygon':water=MultiPolygon([g for g in water.geoms if g.geom_type=='Polygon'])
 result[b['id']]=mapping(water)
path=root/'bridges/amsterdam-measured/processed/water-clearance.json';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps({'sourceSha256':hashlib.sha256(raw).hexdigest(),'method':'exact intersection of municipal deck footprint with archived native basemap water polygons','bridges':result},indent=2)+'\n');print(json.dumps({k:len(v['coordinates']) for k,v in result.items()}))
