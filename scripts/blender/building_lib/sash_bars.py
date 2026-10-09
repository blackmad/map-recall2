"""Partial, axis-aligned sash bars for asymmetric photo-selected window panes."""
import math


def sash_bar_plan(spec):
    raw=spec.get('sashBars',[])
    if not isinstance(raw,list) or len(raw)>24:raise ValueError('Sash bars must be a list of at most 24 segments')
    if raw and (spec.get('head','rectangular')!='rectangular' or spec.get('kind','window')!='window' or spec.get('doorLeaf') or spec.get('warehouse')):
        raise ValueError('Partial sash bars currently require rectangular windows')
    result=[];seen=set()
    for segment in raw:
        if not isinstance(segment,list) or len(segment)!=4 or any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not 0<=v<=1 for v in segment):
            raise ValueError('Sash bar endpoints require four finite aperture fractions')
        x1,z1,x2,z2=segment
        if not ((x1==x2 and z1!=z2) or (z1==z2 and x1!=x2)):
            raise ValueError('Sash bars require nonzero axis-aligned segments')
        if x1==x2 and not 0<x1<1 or z1==z2 and not 0<z1<1:
            raise ValueError('Sash bars must divide the aperture interior')
        key=tuple(sorted(((x1,z1),(x2,z2))))
        if key in seen:raise ValueError('Duplicate sash bar segment')
        seen.add(key)
        x,z,w,h=[spec[k] for k in ('x','z','width','height')]
        result.append((x-w/2+w*x1,z-h/2+h*z1,x-w/2+w*x2,z-h/2+h*z2))
    return result
