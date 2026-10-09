"""Renderer-neutral physical material catalog and cached portable maps."""
import json,hashlib,struct,zlib,math
from pathlib import Path
CATALOG=Path(__file__).with_name('catalog.json')

def entries():return json.loads(CATALOG.read_text())['materials']
def rgb(colour):return [int(colour.lstrip('#')[i:i+2],16) for i in (0,2,4)]
def linear(colour):return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in (c/255 for c in rgb(colour)))+(1,)
def png(path,size,pixels):
    def chunk(tag,data):return struct.pack('>I',len(data))+tag+data+struct.pack('>I',zlib.crc32(tag+data)&0xffffffff)
    rows=b''.join(b'\0'+bytes(pixels[y*size*3:(y+1)*size*3]) for y in range(size))
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>2I5B',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(rows,9))+chunk(b'IEND',b''))

def maps(spec,cache,size=128):
    key=hashlib.sha256(json.dumps({'version':2,'spec':spec,'size':size},sort_keys=True).encode()).hexdigest()
    cache=Path(cache);cache.mkdir(parents=True,exist_ok=True)
    paths={kind:cache/(key+'-'+kind+'.png') for kind in ('colour','roughness','normal')}
    if all(p.exists() for p in paths.values()):return paths,key,True
    base=rgb(spec['baseColour']);mortar=rgb(spec.get('mortarColour') or spec['baseColour']);family=spec['family'];bond=spec.get('bond','running');seed=spec['seed'];height=[];colour=[];rough=[]
    def hash2(x,y):return ((x*73856093)^(y*19349663)^seed)&0xffffffff
    for y in range(size):
      row=y//32
      for x in range(size):
        shift=16 if row%2 else 0;bx=(x+shift)%32;joint=False;cell=((x+shift)//32)%4
        if family in ('brick','painted-brick','stone'):
          bw=16 if bond=='header' else 32
          bx=(x+shift)%bw;cell=((x+shift)//bw)%(size//bw);joint=y%32<2 or bx<2
        elif family in ('slate','clay-tile'):joint=y%32<2 or bx<2
        elif family=='metal-roof':joint=x%32<2
        v=(hash2(cell,row)%7)-3 if family in ('brick','painted-brick','stone','slate','clay-tile') else 0
        # Fine noise has exact tile period; mortar retains its own colour.
        fine=hash2(x,y)%3-1;source=mortar if joint else base
        colour.extend(max(0,min(255,c+(0 if joint else v)+fine)) for c in source)
        h=.25 if joint else .6
        if family=='timber':h=.55+.02*math.sin(x*math.tau/16)
        height.append(h);r=int(spec['roughness']*255);rough.extend([r]*3)
    normals=[]
    for y in range(size):
      for x in range(size):
        dx=(height[y*size+(x+1)%size]-height[y*size+(x-1)%size])*spec.get('normalStrength',.3)
        dy=(height[((y+1)%size)*size+x]-height[((y-1)%size)*size+x])*spec.get('normalStrength',.3)
        l=math.sqrt(dx*dx+dy*dy+1);normals.extend(int((v/l*.5+.5)*255) for v in (-dx,-dy,1))
    for kind,pixels in [('colour',colour),('roughness',rough),('normal',normals)]:png(paths[kind],size,pixels)
    return paths,key,False
