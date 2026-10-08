"""Insert surveyed driving surfaces into the terrain's render proxy.

This is deck elevation, not ground or bathymetry. Detailed meshes can replace
the proxy later; native basemap roads must remain elevated without those meshes.
"""
import math
import numpy as np
from rasterio.features import rasterize
from rasterio.windows import Window, transform as window_transform

def insert_deck(height, quality, transform, outline, samples, axis, origin_rd, local_to_rd, half_width=3.5):
    points = outline + [s['point'] for s in samples]
    rd = [local_to_rd(p) for p in points]
    inverse = ~transform
    pixels = [inverse * p for p in rd]
    padding = int(math.ceil(half_width / abs(transform.a))) + 2
    x0 = max(0, math.floor(min(p[0] for p in pixels)) - padding)
    x1 = min(height.shape[1], math.ceil(max(p[0] for p in pixels)) + padding)
    y0 = max(0, math.floor(min(p[1] for p in pixels)) - padding)
    y1 = min(height.shape[0], math.ceil(max(p[1] for p in pixels)) + padding)
    if x1 <= x0 or y1 <= y0: return 0
    tr = window_transform(Window(x0, y0, x1-x0, y1-y0), transform)
    h, q = height[y0:y1, x0:x1], quality[y0:y1, x0:x1]
    shape = h.shape
    yy, xx = np.indices(shape)
    east = tr.c + (xx+.5)*tr.a + (yy+.5)*tr.b
    north = tr.f + (xx+.5)*tr.d + (yy+.5)*tr.e
    # Transform the local deck axis into RD, including meridian convergence.
    along = np.array(local_to_rd(axis),dtype=float) - np.array(origin_rd,dtype=float)
    along /= np.linalg.norm(along)
    station = 24 + (east-origin_rd[0])*along[0] + (north-origin_rd[1])*along[1]
    mask = rasterize([({'type':'Polygon','coordinates':[[*map(local_to_rd,outline),local_to_rd(outline[0])]]},1)],out_shape=shape,transform=tr).astype(bool)
    # An overland viaduct has two road levels. Do not turn the bare ground or
    # its lower road into the upper deck. This proxy is for water crossings.
    if np.count_nonzero(mask & (q == 254)) < 4: return 0
    stations = [s['s'] for s in samples]
    nap = [s['surfaceNAP'] for s in samples]
    h[mask] = np.interp(station[mask],stations,nap)
    q[mask] = 253
    # Bank-side approaches use their own connected centreline, not an extension
    # of the deck axis across adjacent canals. Fade only the outer eight metres.
    for a,b in zip(samples,samples[1:]):
        pa,pb = np.array(local_to_rd(a['point'])),np.array(local_to_rd(b['point']))
        delta=pb-pa; length2=float(delta@delta)
        if length2 < .0001: continue
        t=((east-pa[0])*delta[0]+(north-pa[1])*delta[1])/length2
        clipped=np.clip(t,0,1)
        distance=np.hypot(east-pa[0]-clipped*delta[0],north-pa[1]-clipped*delta[1])
        selected=(t>=0)&(t<=1)&(distance<=half_width)&(~mask)&(q!=254)&(q!=0)
        s=a['s']+clipped*(b['s']-a['s'])
        fade=np.clip(np.minimum(s-stations[0],stations[-1]-s)/8,0,1)
        fade=fade*fade*(3-2*fade)
        target=a['surfaceNAP']+clipped*(b['surfaceNAP']-a['surfaceNAP'])
        h[selected]=h[selected]*(1-fade[selected])+target[selected]*fade[selected]
        q[selected]=253
    return int(mask.sum())
