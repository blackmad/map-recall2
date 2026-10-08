# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "shapely>=2.1,<3", "pillow"]
# ///
"""Bake vector-conforming land openings, level water, quay walls and deck caps.

Terrain shaders still sample AHN. These triangles replace only the terrain mesh
topology; they never stretch a coarse heightfield down to the canal surface.
"""
import argparse,hashlib,json,math,struct,gzip
from pathlib import Path
from functools import lru_cache
from io import BytesIO
import numpy as np
import shapely
from shapely.geometry import shape,box,Polygon,MultiPoint
from shapely.ops import transform,unary_union
from PIL import Image

EXTENT=8192
RADIUS=6371008.8
SCALE=1/(2*math.pi*RADIUS*math.cos(math.radians(52.37)))
def merc(lon,lat):return ((lon+180)/360,(1-np.arcsinh(np.tan(np.radians(lat)))/math.pi)/2)
OX,OY=merc(4.9,52.37)
def world(p,z):return [(p[0]-OX)/SCALE,-(p[1]-OY)/SCALE,z]
def polys(g):
    if g.is_empty:return []
    if g.geom_type=='Polygon':return [g]
    if not hasattr(g,'geoms'):return []
    return [p for item in g.geoms for p in polys(item)]
def triangles(g):
    return [list(t.exterior.coords)[:3] for p in polys(g) for t in shapely.constrained_delaunay_triangles(p).geoms]
def unmerc(x,y):return [x*360-180,math.degrees(math.atan(math.sinh(math.pi*(1-2*y))))]

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--archive',required=True);ap.add_argument('--spacing',type=float,default=8);ap.add_argument('--bounds');ap.add_argument('--terrain',default='public/data/extracts/amsterdam/terrain');ap.add_argument('--output',default='public/data/extracts/amsterdam/surfaces');a=ap.parse_args()
    private=Path(a.archive);terrain=Path(a.terrain);out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
    meta=json.loads((terrain/'tilejson.json').read_text());waterraw=(private/'terrain/amsterdam/raw/basemap-water.geojson').read_bytes();profraw=(private/'bridges/amsterdam-measured/raw/bridge-surfaces-v1.json').read_bytes()
    water=unary_union([shapely.make_valid(transform(merc,shape(f['geometry']))) for f in json.loads(waterraw)['features']])
    bridges=[]
    for b in json.loads(profraw)['bridges']:
        ring=[merc(b['origin'][0]+x/(111320*math.cos(math.radians(b['origin'][1]))),b['origin'][1]+y/111320) for x,y in b['outline']]
        footprint=Polygon(ring)
        # Land viaducts must not create new water. Require actual mapped water
        # beneath a part of the surveyed span before joining its cartographic gap.
        if footprint.intersection(water).area/SCALE**2<1:continue
        bridges.append((b,footprint))
    water=unary_union([water,*[p for b,p in bridges]])
    @lru_cache(maxsize=64)
    def height_tile(x,y):
        key=f'14-{x>>2}-{y>>2}';index=json.loads((terrain/'packs'/f'{key}.json').read_text());offset,length=index['tiles'][f'16/{x}/{y}']
        with (terrain/'packs'/f'{key}.bin').open('rb') as f:f.seek(offset);data=f.read(length)
        return np.asarray(Image.open(BytesIO(data))).astype(np.float32)
    def height(p):
        x,y=p[0]*65536,p[1]*65536;tx,ty=math.floor(x),math.floor(y)
        try:im=height_tile(tx,ty)
        except (KeyError,FileNotFoundError):return 0
        u,v=np.clip((x-tx)*256-.5,0,255),np.clip((y-ty)*256-.5,0,255);ix,iy=int(u),int(v);h=0
        for dx in range(2):
            for dy in range(2):
                c=im[min(255,iy+dy),min(255,ix+dx)];value=-10000+(c[0]*65536+c[1]*256+c[2])*.1
                h+=value*((u-ix) if dx else (1-u+ix))*((v-iy) if dy else (1-v+iy))
        return float(h)
    levels=[]
    pilot_shapes=[p for b,p in bridges if b['id'] in ['BRU0057','BRU0059','BRU0065']]
    for p in polys(water):
        ring=list(p.exterior.coords);step=max(1,len(ring)//64);banks=sorted(height(point) for point in ring[::step])
        is_boezem=any(p.intersects(pilot) for pilot in pilot_shapes)
        # The pilot canal network uses the published stadsboezem reference peil.
        # Other disconnected waters use an explicitly estimated below-bank level
        # until a regional peilgebied source is integrated; never invent 0 NAP land.
        level=-.4 if is_boezem else min(0,banks[max(0,int(len(banks)*.1))]-.4) if banks else 0
        levels.append((p,round(level,2),'stadsboezem-reference' if is_boezem else 'estimated-below-bank'))
    level_tree=shapely.STRtree([p for p,h,q in levels])
    def deck(b,poly):
        origin=merc(*b['origin']);axis=np.array(b['deckAxis'],dtype=float)
        # Work in the source local metre frame for the longitudinal stations.
        def local(x,y):
            lon,lat=unmerc(x,y);return [(lon-b['origin'][0])*111320*math.cos(math.radians(b['origin'][1])),(lat-b['origin'][1])*111320]
        localpoly=transform(lambda x,y:np.array([local(px,py) for px,py in zip(np.atleast_1d(x),np.atleast_1d(y))]).T,poly)
        result=[];stations=[s['s'] for s in b['samples']];nap=[s['surfaceNAP'] for s in b['samples']]
        def globalp(p):return merc(b['origin'][0]+p[0]/(111320*math.cos(math.radians(b['origin'][1]))),b['origin'][1]+p[1]/111320)
        def hp(p):return float(np.interp(24+np.dot(p,axis),stations,nap))+.035
        def axispoint(s,t):return [axis[0]*(s-24)-axis[1]*t,axis[1]*(s-24)+axis[0]*t]
        for lo,hi in zip(stations,stations[1:]):
            strip=Polygon([axispoint(lo,-200),axispoint(hi,-200),axispoint(hi,200),axispoint(lo,200)])
            for tri in triangles(localpoly.intersection(strip)):
                result.extend(world(globalp(p),hp(p)) for p in tri)
        # A simple source-footprint cap is the fallback, rather than a floating
        # ribbon or decorative unreviewed arch. Detailed models replace this cap.
        ring=list(localpoly.exterior.coords)
        for p,q in zip(ring,ring[1:]):
            pa,pb=world(globalp(p),hp(p)),world(globalp(q),hp(q));qa=[*pa[:2],pa[2]-.3];qb=[*pb[:2],pb[2]-.3]
            result.extend([pa,qa,qb,pa,qb,pb])
        return result
    source=json.loads((private/'terrain/amsterdam/manifest.json').read_text());keys=[tuple(map(int,r['key'].split('/')[1:])) for r in source['sources']]
    if a.bounds:
        west,south,east,north=map(float,a.bounds.split(','));mn=merc(west,north);mx=merc(east,south)
        keys=[(x,y) for x,y in keys if x/16384<=mx[0] and (x+1)/16384>=mn[0] and y/16384<=mx[1] and (y+1)/16384>=mn[1]]
    catalogue=[]
    for number,(x,y) in enumerate(keys,1):
        cell=box(x/16384,y/16384,(x+1)/16384,(y+1)/16384);localwater=water.intersection(cell);land=cell.difference(localwater)
        spacing=a.spacing*SCALE
        gx,gy=np.meshgrid(np.arange(cell.bounds[0]+spacing/2,cell.bounds[2],spacing),np.arange(cell.bounds[1]+spacing/2,cell.bounds[3],spacing))
        selected=shapely.contains_xy(land,gx,gy)
        points=list(zip(gx[selected],gy[selected]))
        for p in polys(land):
            for ring in [p.exterior,*p.interiors]:points.extend(ring.coords)
        landtri=[]
        if points:
            candidate=shapely.delaunay_triangles(MultiPoint(points))
            clipped=shapely.intersection(np.array(list(candidate.geoms),dtype=object),land)
            for g in clipped:
                for tri in triangles(g):landtri.extend([[(p[0]*16384-x)*EXTENT,(p[1]*16384-y)*EXTENT] for p in tri])
        waterpos=[];bankpos=[];waterrecords=[]
        for i in level_tree.query(cell):
            p,level,confidence=levels[int(i)];visible=p.intersection(cell)
            if not polys(visible):continue
            for tri in triangles(visible):waterpos.extend(world(p,level) for p in tri)
            waterrecords.append({'geometry':shapely.geometry.mapping(shapely.geometry.MultiPolygon(polys(visible))),'heightM':level,'confidence':confidence})
            # Intersect the real boundary, never the artificial tile border.
            lines=p.boundary.intersection(cell)
            items=list(lines.geoms) if hasattr(lines,'geoms') else [lines]
            for line in items:
                if line.geom_type!='LineString':continue
                line=shapely.segmentize(line,2*SCALE);ring=list(line.coords)
                for pa,pb in zip(ring,ring[1:]):
                    ha,hb=max(level,height(pa)),max(level,height(pb));topa,topb=world(pa,ha),world(pb,hb);lowa,lowb=world(pa,level),world(pb,level)
                    bankpos.extend([topa,lowa,lowb,topa,lowb,topb])
        decks=[];deckpos=[]
        for b,p in bridges:
            # Own a span in its origin cell to avoid duplicate complete caps.
            ox,oy=merc(*b['origin'])
            if math.floor(ox*16384)!=x or math.floor(oy*16384)!=y:continue
            positions=deck(b,p);decks.append({'id':b['id'],'offset':len(deckpos)*3,'count':len(positions)*3});deckpos.extend(positions)
        arrays=[np.asarray(a,dtype='<f4').reshape(-1) for a in [landtri,waterpos,bankpos,deckpos]];offset=0;descriptors={};payload=[]
        for name,array in zip(['land','water','banks','decks'],arrays):descriptors[name]={'offset':offset,'count':len(array)};raw=array.tobytes();payload.append(raw);offset+=len(raw)
        data=b''.join(payload);key=f'14-{x}-{y}';compressed=gzip.compress(data,compresslevel=6,mtime=0);(out/f'{key}.bin.gz').write_bytes(compressed)
        index={'version':1,'key':key,'extent':EXTENT,'terrainFingerprint':meta['fingerprint'],'mesh':descriptors,'decks':decks,'waterRegions':waterrecords,'sha256':hashlib.sha256(data).hexdigest(),'byteLength':len(data),'compressedByteLength':len(compressed)}
        (out/f'{key}.json').write_text(json.dumps(index,separators=(',',':'))+'\n');catalogue.append({'key':key,'bytes':len(data),'compressedBytes':len(compressed),'landTriangles':len(landtri)//3})
        if number%5==0 or number==len(keys):print(f'surfaces {number}/{len(keys)}; {len(landtri)//3} land triangles; {len(data)} bytes',flush=True)
    manifest={'version':1,'compression':'gzip','fingerprint':hashlib.sha256(Path(__file__).read_bytes()+waterraw+profraw+meta['fingerprint'].encode()+str(a.spacing).encode()).hexdigest()[:16],'terrainFingerprint':meta['fingerprint'],'extent':EXTENT,'origin':[4.9,52.37],'landSpacingM':a.spacing,'sourceWaterSha256':hashlib.sha256(waterraw).hexdigest(),'sourceProfilesSha256':hashlib.sha256(profraw).hexdigest(),'referenceWaterLevel':{'heightM':-.4,'source':'https://www.agv.nl/siteassets/werk-in-uitvoering/waterpeil/peilbesluitenamsterdam.pdf','scope':'connected pilot canal network; reference target, not a live water measurement'},'otherWaterLevels':'estimated below mapped bank; regional peilgebieden not yet integrated','tiles':catalogue}
    (out/'index.json').write_text(json.dumps(manifest,indent=2)+'\n');processed=private/'terrain/amsterdam/processed';processed.mkdir(exist_ok=True);(processed/'surface-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'tiles':len(keys),'bytes':sum(t['bytes'] for t in catalogue),'bridges':len(bridges)}),flush=True)
if __name__=='__main__':main()
