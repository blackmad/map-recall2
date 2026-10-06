"""Perspective reference views, never game texture assets. North-at-centre municipal convention."""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image
pack=Path(sys.argv[1] if len(sys.argv)>1 else '../map-recall2-source-data/experiments/large-ordinary-fast-pass')
out=pack/'processed';out.mkdir(exist_ok=True)
demo=Path('public/canal-drive/ordinary-building-pilot-data')
views=json.loads((pack/'selected-views.json').read_text())
for v in views:
    lng,lat,_=v['panorama']['geometry']['coordinates']
    dx=(v['target'][0]-lng)*68000;dy=(v['target'][1]-lat)*111320
    yaw=math.atan2(dx,dy);pitch=math.radians(23);fov=math.radians(90)
    w,h=1000,750
    x=(np.arange(w)+.5-w/2)/(w/2)*math.tan(fov/2)
    y=-(np.arange(h)+.5-h/2)/(w/2)*math.tan(fov/2)
    xx,yy=np.meshgrid(x,y)
    right=np.array([math.cos(yaw),-math.sin(yaw),0])
    up=np.array([-math.sin(yaw)*math.sin(pitch),-math.cos(yaw)*math.sin(pitch),math.cos(pitch)])
    forward=np.array([math.sin(yaw)*math.cos(pitch),math.cos(yaw)*math.cos(pitch),math.sin(pitch)])
    rays=forward+xx[...,None]*right+yy[...,None]*up
    rays/=np.linalg.norm(rays,axis=2)[...,None]
    im=np.asarray(Image.open(pack/v['file']).convert('RGB'))
    ih,iw=im.shape[:2]
    u=((np.arctan2(rays[:,:,0],rays[:,:,1])/(2*math.pi)+.5)%1)*iw
    vv=(.5-np.arcsin(rays[:,:,2])/math.pi)*ih
    # Bilinear sampling, wrap seam and clamp poles.
    a=np.floor(u).astype(int)%iw;b=np.clip(np.floor(vv).astype(int),0,ih-1)
    tx=(u-np.floor(u))[...,None];ty=(vv-np.floor(vv))[...,None]
    pixels=(im[b,a]*(1-tx)+im[b,(a+1)%iw]*tx)*(1-ty)+(im[np.minimum(b+1,ih-1),a]*(1-tx)+im[np.minimum(b+1,ih-1),(a+1)%iw]*tx)*ty
    name=f"reference-{v['id']}-{v['year']}.jpg"
    Image.fromarray(np.uint8(pixels)).save(out/name,quality=92)
    (demo/name).write_bytes((out/name).read_bytes())
    v['projection']={'kind':'perspective','heading':math.degrees(yaw)%360,'pitch':23,'horizontalFov':90,'width':w,'height':h,'orientation':'world-aligned-north-at-centre','referenceImage':name}
(pack/'selected-views.json').write_text(json.dumps(views,indent=2))
(demo/'references.json').write_text(json.dumps(views,indent=2))
