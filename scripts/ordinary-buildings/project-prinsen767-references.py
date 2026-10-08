"""Perspective reference views, never game texture assets. North-at-centre municipal convention."""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image
if len(sys.argv) != 2:
    raise SystemExit('Usage: project-prinsen767-references.py PRIVATE_SOURCE_PACK')
pack=Path(sys.argv[1])
out=pack/'processed';out.mkdir(exist_ok=True)
views=json.loads((pack/'kerk126-selected-views.json').read_text())
for v in views:
    lng,lat,_=v['panorama']['geometry']['coordinates']
    dx=(v['target'][0]-lng)*68000;dy=(v['target'][1]-lat)*111320
    yaw=math.atan2(dx,dy);pitch=math.radians(24);fov=math.radians(125)
    w,h=1200,900
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
    v['projection']={'kind':'perspective','heading':math.degrees(yaw)%360,'pitch':24,'horizontalFov':125,'width':w,'height':h,'orientation':'world-aligned-north-at-centre','referenceImage':name}
(pack/'kerk126-selected-views.json').write_text(json.dumps(views,indent=2))
(out/'kerk126-projection-metadata.json').write_text(json.dumps(views,indent=2))
