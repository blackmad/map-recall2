# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "rasterio", "scipy", "pillow", "pyproj", "requests"]
# ///
"""uv run scripts/elevation/build-terrain.py --archive PATH [--bounds W,S,E,N].
Raw RD/NAP AHN bytes stay in the private source pack; only processed XYZ PNGs
are published. Cached matching requests rebuild offline. Alpha records quality:
255 measured ground, 253 measured bridge proxy, 128 interpolated ground,
254 mapped water, 0 unknown/fallback.
"""
import argparse, concurrent.futures, datetime, hashlib, json, math, os, time
from pathlib import Path
import numpy as np
import requests
import rasterio
from rasterio.features import rasterize
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_bounds
from pyproj import Transformer
from scipy.ndimage import distance_transform_edt, label, find_objects, gaussian_filter
from PIL import Image
from bridge_decks import insert_deck

R = 20037508.342789244
BASE = 14
SIZE = 256

def tile_xy(lon, lat, z):
    return ((lon + 180) / 360 * 2**z, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2**z)
def mercator_box(x, y, z):
    s = 2 * R / 2**z
    return (-R + x*s, R-(y+1)*s, -R+(x+1)*s, R-y*s)
def encode(h, quality):
    code = np.rint((h+10000)*10).astype(np.uint32)
    return np.stack([(code>>16)&255, (code>>8)&255, code&255, quality], axis=-1).astype(np.uint8)
def decode(im):
    a = np.asarray(im).astype(np.float32)
    return -10000 + (a[:,:,0]*65536+a[:,:,1]*256+a[:,:,2])*.1

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--archive', required=True)
    p.add_argument('--bounds', default='4.708,52.274,5.104,52.432')
    p.add_argument('--output', default='public/data/extracts/amsterdam/terrain')
    p.add_argument('--workers', type=int, default=8)
    p.add_argument('--maxzoom', type=int, default=18)
    p.add_argument('--fetch', action='store_true')
    a = p.parse_args()
    west,south,east,north = map(float,a.bounds.split(','))
    if not (west<east and south<north and 14<=a.maxzoom<=18): raise ValueError('Invalid bounds/zoom')
    archive, out = Path(a.archive), Path(a.output)
    raw = archive/'raw'; raw.mkdir(parents=True,exist_ok=True)
    water_path = raw/'basemap-water.geojson' if (raw/'basemap-water.geojson').exists() else raw/'water.geojson'
    water = json.loads(water_path.read_text())['features']
    from rasterio.warp import transform_geom
    def coords(geometry):
        def walk(a):
            if isinstance(a[0],(int,float)):yield a
            else:
                for item in a:yield from walk(item)
        return list(walk(geometry['coordinates']))
    water_shapes=[]
    for f in water:
        if f['geometry']['type'] not in ('Polygon','MultiPolygon'):continue
        g=transform_geom('EPSG:4326','EPSG:28992',f['geometry']);points=coords(g)
        water_shapes.append((g,(min(p[0] for p in points),min(p[1] for p in points),max(p[0] for p in points),max(p[1] for p in points))))
    to_rd = Transformer.from_crs(3857,28992,always_xy=True)
    x0,y1=tile_xy(west,south,BASE);x1,y0=tile_xy(east,north,BASE)
    keys=[(x,y) for x in range(math.floor(x0),math.floor(x1)+1) for y in range(math.floor(y0),math.floor(y1)+1)]
    # Preserve measured bank-side roads at bridge joins; taper only their surrounding shore.
    profile_path=archive.parent.parent/'bridges/amsterdam-measured/raw/bridge-surfaces-v1.json'
    profile_bytes=profile_path.read_bytes() if profile_path.exists() else b''
    profile_shapes=[]
    deck_profiles=[]
    ll_to_rd=Transformer.from_crs(4326,28992,always_xy=True)
    def remember(points):
        xs=[p[0] for p in points];ys=[p[1] for p in points]
        profile_shapes.append(({'type':'Polygon','coordinates':[points+[points[0]]]},(min(xs),min(ys),max(xs),max(ys))))
    for bridge in json.loads(profile_bytes).get('bridges',[]) if profile_bytes else []:
        def rdpoint(p):
            lon=bridge['origin'][0]+p[0]/(111320*math.cos(math.radians(bridge['origin'][1])))
            lat=bridge['origin'][1]+p[1]/111320
            return list(ll_to_rd.transform(lon,lat))
        remember([rdpoint(p) for p in bridge['outline']])
        deck_profiles.append((bridge,profile_shapes[-1][1]))
        width=min(3.5,bridge['approachHalfWidthM'])
        for before,after in zip(bridge['samples'],bridge['samples'][1:]):
            if before['s']>=bridge['deckRangeM'][0] and after['s']<=bridge['deckRangeM'][1]:continue
            a0,b0=rdpoint(before['point']),rdpoint(after['point']);dx=b0[0]-a0[0];dy=b0[1]-a0[1];length=math.hypot(dx,dy)
            if length<.01:continue
            nx=-dy/length*width;ny=dx/length*width
            remember([[a0[0]+nx,a0[1]+ny],[a0[0]-nx,a0[1]-ny],[b0[0]-nx,b0[1]-ny],[b0[0]+nx,b0[1]+ny]])
    source_records=[]; failures=[]
    processing_hash=hashlib.sha256(Path(__file__).read_bytes()+Path(__file__).with_name('bridge_decks.py').read_bytes()+water_path.read_bytes()+profile_bytes).hexdigest()
    def build(key):
        x,y=key; bbox=mercator_box(x,y,BASE)
        corners=[to_rd.transform(px,py) for px in [bbox[0],bbox[2]] for py in [bbox[1],bbox[3]]]
        rd=[math.floor(min(c[0] for c in corners)-100),math.floor(min(c[1] for c in corners)-100),math.ceil(max(c[0] for c in corners)+100),math.ceil(max(c[1] for c in corners)+100)]
        params={'SERVICE':'WCS','VERSION':'1.0.0','REQUEST':'GetCoverage','COVERAGE':'dtm_05m','CRS':'EPSG:28992','BBOX':','.join(map(str,rd)),'RESX':'0.5','RESY':'0.5','FORMAT':'GEOTIFF'}
        url=requests.Request('GET','https://service.pdok.nl/rws/ahn/wcs/v1_0',params=params).prepare().url
        file=raw/f'dtm-{BASE}-{x}-{y}.tif';meta=file.with_suffix('.json')
        record=json.loads(meta.read_text()) if meta.exists() else {}
        if not file.exists() or record.get('url')!=url:
            if not a.fetch: raise RuntimeError(f'Missing matching cached raster {file}')
            attempts=record.get('attempts',[])[:]
            for attempt in range(3):
                try:
                    response=requests.get(url,timeout=90);response.raise_for_status()
                    if response.content[:2] not in [b'II',b'MM']: raise RuntimeError('WCS returned non-TIFF content')
                    file.write_bytes(response.content)
                    record={'url':url,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sha256':hashlib.sha256(response.content).hexdigest(),'attempts':attempts,'access':'success','horizontalCRS':'EPSG:28992','verticalDatum':'NAP','coverage':'dtm_05m','resolutionM':.5}
                    meta.write_text(json.dumps(record,indent=2)+'\n');break
                except Exception as e:
                    attempts.append({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'error':str(e)})
                    meta.write_text(json.dumps({'url':url,'access':'failed','attempts':attempts},indent=2)+'\n')
                    if attempt==2: raise
                    time.sleep(2**attempt)
        marker=out/'completed'/f'{x}-{y}.json'
        stamp={'processing':processing_hash,'raw':record['sha256'],'maxzoom':a.maxzoom}
        if marker.exists() and json.loads(marker.read_text())==stamp:
            return {'key':f'{BASE}/{x}/{y}','file':str(file.relative_to(archive)),**record}
        with rasterio.open(file) as src:
            h=src.read(1);valid=np.isfinite(h)&(h>-50)&(h<100)
            # Water is an independently mapped mask, never a nearest-ground fill.
            # Reproject water polygons once to the RD raster coordinate system.
            local_water=[(g,1) for g,b in water_shapes if b[0]<=rd[2] and b[2]>=rd[0] and b[1]<=rd[3] and b[3]>=rd[1]]
            w=rasterize(local_water,out_shape=h.shape,transform=src.transform,fill=0).astype(bool) if local_water else np.zeros(h.shape,bool)
            quality=np.where(valid,255,0).astype(np.uint8)
            # Fill holes within each connected land component. No cross-canal donor.
            components,count=label(~w)
            for component,sl in enumerate(find_objects(components),1):
                if sl is None:continue
                region=components[sl]==component;donors=valid[sl]&region
                holes=region&~valid[sl]
                if not donors.any() or not holes.any():continue
                dist,ix=distance_transform_edt(~donors,return_indices=True)
                fill=holes&(dist<=200)
                local=h[sl];local[fill]=local[ix[0][fill],ix[1][fill]];quality[sl][fill]=128
            # Smooth sensor-scale variation on land, with no water/nodata donors.
            # Deck profiles are inserted afterwards so smoothing never flattens a ramp.
            known=(quality>0)&(~w)
            weights=gaussian_filter(known.astype(np.float32),2)
            smooth=gaussian_filter(np.where(known,h,0),2)
            h[known]=smooth[known]/np.maximum(weights[known],1e-6)
            h[quality==0]=0
            # The render proxy remains continuous at the shoreline. Separate
            # vector-clipped terrain geometry removes water; the water plane and
            # vertical bank meshes own the actual canal surface and quay edge.
            if w.any() and known.any():
                _,ix=distance_transform_edt(~known,return_indices=True)
                h[w]=h[ix[0][w],ix[1][w]]
            quality[w]=254
            # Native roads drape onto this proxy even when detailed bridge meshes
            # are disabled/unavailable. Ground-only AHN leaves bridge decks out.
            for bridge,b in deck_profiles:
                if not (b[0]<=rd[2] and b[2]>=rd[0] and b[1]<=rd[3] and b[3]>=rd[1]):continue
                def deck_rd(p):
                    lon=bridge['origin'][0]+p[0]/(111320*math.cos(math.radians(bridge['origin'][1])))
                    lat=bridge['origin'][1]+p[1]/111320
                    return ll_to_rd.transform(lon,lat)
                insert_deck(h,quality,src.transform,bridge['outline'],bridge['samples'],bridge['deckAxis'],deck_rd([0,0]),deck_rd,min(3.5,bridge['approachHalfWidthM']))
            n=SIZE*2**(a.maxzoom-BASE)
            dst=np.zeros((n,n),np.float32);q=np.zeros((n,n),np.uint8)
            tr=from_bounds(*bbox,n,n)
            reproject(h,dst,src_transform=src.transform,src_crs=src.crs,dst_transform=tr,dst_crs='EPSG:3857',resampling=Resampling.bilinear)
            reproject(quality,q,src_transform=src.transform,src_crs=src.crs,dst_transform=tr,dst_crs='EPSG:3857',resampling=Resampling.nearest)
            # Keep water level exact after bilinear reprojection.
            dst[q==0]=0
        image=Image.fromarray(encode(dst,q))
        # Derive all zooms within this parent from the same continuous raster.
        for z in range(BASE,a.maxzoom+1):
            factor=2**(z-BASE);scaled=image if z==a.maxzoom else Image.fromarray(encode(np.asarray(Image.fromarray(dst).resize((SIZE*factor,SIZE*factor),Image.Resampling.BILINEAR)),np.asarray(Image.fromarray(q).resize((SIZE*factor,SIZE*factor),Image.Resampling.NEAREST))))
            for dx in range(factor):
                path=out/str(z)/str(x*factor+dx);path.mkdir(parents=True,exist_ok=True)
                for dy in range(factor):
                    crop=scaled.crop((dx*SIZE,dy*SIZE,(dx+1)*SIZE,(dy+1)*SIZE))
                    if z==16: crop.getchannel('A').save(path/f'{y*factor+dy}.quality.png')
                    crop.putalpha(255);crop.save(path/f'{y*factor+dy}.png',compress_level=6)
        marker.parent.mkdir(parents=True,exist_ok=True);marker.write_text(json.dumps(stamp))
        return {'key':f'{BASE}/{x}/{y}','file':str(file.relative_to(archive)),**record}
    with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as pool:
        jobs={pool.submit(build,k):k for k in keys}
        for i,job in enumerate(concurrent.futures.as_completed(jobs),1):
            try: source_records.append(job.result())
            except Exception as e:failures.append({'key':jobs[job],'error':str(e)});print('FAILED',jobs[job],str(e),flush=True)
            if i%5==0 or i==len(keys):print(f'terrain {i}/{len(keys)}; failures {len(failures)}',flush=True)
    archive.joinpath('manifest.json').write_text(json.dumps({'version':1,'bounds':[west,south,east,north],'sources':sorted(source_records,key=lambda r:r['key']),'failures':failures,'water':{'file':str(water_path.relative_to(archive)),'sha256':hashlib.sha256(water_path.read_bytes()).hexdigest(),'source':'archived OpenFreeMap native z14 water polygons; source snapshot in raw/basemap-water/manifest.json'},'processing':'same-land-component nearest ground fill <=100m; sigma 1m normalized Gaussian land smoothing; continuous nearest-land render proxy beneath mapped water; vector-conforming terrain topology removes canals and water crossings; absolute-NAP DSM water-crossing deck profiles with connected road approaches blending at outer 8m; overland lower roads retain DTM; RD to EPSG:3857 bilinear; TerrainRGB 0.1m'},indent=2)+'\n')
    if failures:raise RuntimeError(f'{len(failures)} acquisition failures; incomplete tiles are not publishable')
    # Overview levels blend decoded heights, never average RGB bytes.
    children=set(keys)
    for z in range(BASE-1,9,-1):
        parents={(x//2,y//2) for x,y in children}
        for x,y in parents:
            heights=np.zeros((512,512),np.float32);quality=np.zeros((512,512),np.uint8)
            for dx in range(2):
                for dy in range(2):
                    f=out/str(z+1)/str(x*2+dx)/f'{y*2+dy}.png'
                    if f.exists():
                        im=Image.open(f);heights[dy*256:(dy+1)*256,dx*256:(dx+1)*256]=decode(im);quality[dy*256:(dy+1)*256,dx*256:(dx+1)*256]=np.asarray(im)[:,:,3]
            hh=np.asarray(Image.fromarray(heights).resize((256,256),Image.Resampling.BILINEAR));qq=np.asarray(Image.fromarray(quality).resize((256,256),Image.Resampling.NEAREST))
            dest=out/str(z)/str(x);dest.mkdir(parents=True,exist_ok=True);im=Image.fromarray(encode(hh,qq));im.putalpha(255);im.save(dest/f'{y}.png')
        children=parents
    fingerprint=hashlib.sha256(json.dumps(sorted((r['key'],r['sha256']) for r in source_records)).encode()+water_path.read_bytes()+processing_hash.encode()).hexdigest()[:16]
    meta={'tilejson':'3.0.0','version':1,'name':'Amsterdam AHN ground and bridge surface proxy','scheme':'xyz','tiles':['{z}/{x}/{y}.png'],'minzoom':10,'maxzoom':a.maxzoom,'bounds':[west,south,east,north],'tileSize':256,'encoding':'mapbox','datum':'NAP','exaggeration':1,'fingerprint':fingerprint,'qualityTiles':['16/{x}/{y}.quality.png'],'qualityCodes':{'measured':255,'bridge':253,'interpolated':128,'water':254,'unknown':0},'waterFallbackNAP':0,'shoreTransitionM':0,'landSmoothingSigmaM':1,'waterRenderProxy':'nearest smooth land; actual water is separate geometry','bridgeRoadProtection':bool(profile_bytes),'bridgeDeckProfiles':len(deck_profiles),'bridgeDeckRepresentation':'water-crossing render proxy; separate generic deck geometry owns masked spans; overland lower roads retain ground','attribution':'AHN / Rijkswaterstaat / PDOK; water © OpenStreetMap contributors'}
    out.joinpath('tilejson.json').write_text(json.dumps(meta,indent=2)+'\n')
    print(json.dumps({'tiles':len(list(out.glob('*/*/*.png'))),'fingerprint':fingerprint,'sources':len(source_records)}),flush=True)
if __name__=='__main__':main()
