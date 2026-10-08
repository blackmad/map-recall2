# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "rasterio"]
# ///
"""Regression: a native road rises over water without a detailed bridge mesh."""
import numpy as np
from rasterio.transform import from_origin
from bridge_decks import insert_deck

def check(bank,crest):
    h=np.full((80,80),bank,dtype=np.float32)
    q=np.full(h.shape,255,dtype=np.uint8)
    h[:,30:50]=0; q[:,30:50]=254
    outline=[[-5,-3],[5,-3],[5,3],[-5,3]]
    samples=[{'s':s,'point':[s-24,0],'surfaceNAP':height} for s,height in [(4,bank),(19,bank+.3),(24,crest),(29,bank+.3),(44,bank)]]
    before=h.copy()
    count=insert_deck(h,q,from_origin(-20,20,.5,.5),outline,samples,[1,0],[0,0],lambda p:p)
    assert count>0
    assert abs(h[40,40]-crest)<.1, (h[40,40],crest)
    assert q[40,40]==253, 'Deck must override water classification'
    assert h[5,40]==0 and q[5,40]==254, 'Adjacent canal must remain water'
    assert abs(h[40,0]-before[40,0])<.01, 'Outer approach must meet original bank'
    assert np.isfinite(h).all()
check(1.5,3.2)
check(-1.8,-.6)
land=np.full((80,80),1.5,dtype=np.float32);quality=np.full(land.shape,255,dtype=np.uint8)
samples=[{'s':s,'point':[s-24,0],'surfaceNAP':5} for s in [4,24,44]]
assert insert_deck(land,quality,from_origin(-20,20,.5,.5),[[-5,-3],[5,-3],[5,3],[-5,3]],samples,[1,0],[0,0],lambda p:p)==0
assert np.all(land==1.5), 'Overland viaducts must preserve the lower ground surface'
print('Bridge fallback: elevated water crossing, unchanged adjacent water/lower roads, joined approaches, negative NAP passed')
