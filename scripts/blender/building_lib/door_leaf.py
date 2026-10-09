"""Shared opaque timber leaf below a separate glazed transom."""
import math
from .attachment_contracts import finite

def door_leaf_blocks(spec,glass_depth=.12):
    leaf=spec.get('doorLeaf')
    if leaf is None:return []
    if not isinstance(leaf,dict) or leaf.get('style') not in ('plain','panelled'):
        raise ValueError('Door leaf requires plain or panelled style')
    head=spec.get('head','rectangular')
    if spec.get('kind')!='door' or head not in ('rectangular','segmental','rounded') or any(spec.get(k) for k in ('warehouse','lowerPanel','transomArch')):
        raise ValueError('Timber door leaf requires a door without a competing panel or warehouse assembly')
    x,z,w,h=[spec[k] for k in ('x','z','width','height')];transom=spec.get('transom',.25)
    if not all(finite(v) for v in (x,z,w,h,glass_depth)) or min(w,h)<=0 or (transom is not None and (not finite(transom) or not 0<transom<1)):
        raise ValueError('Door leaf requires finite dimensions and a valid transom')
    if head!='rectangular':
        from .apertures import from_spec
        from_spec(spec) # Validate the actual arched aperture before composition.
        rise=spec.get('archRise',min(w/2,h*.45) if head=='rounded' else min(h*.12,.2))
        if transom is None or h*transom<rise:
            raise ValueError('Arched door requires its opaque leaf below the arch spring')
    colour=leaf.get('colour')
    if colour is not None:
        from .materials import linear
        linear(colour)
    bottom=z-h/2+.035;top=z+h/2-h*(transom or 0)-.035;width=w-.10;height=top-bottom
    if width<.22 or height<.5:raise ValueError('Door leaf has no useful panel span')
    y=glass_depth-.047
    blocks=[('opaque timber leaf',x,y,(bottom+top)/2,width,.06,height)]
    if leaf['style']=='panelled':
        rows=leaf.get('rows',2);columns=leaf.get('columns',1)
        if any(isinstance(v,bool) or not isinstance(v,int) for v in (rows,columns)) or not 1<=rows<=4 or not 1<=columns<=2:
            raise ValueError('Door leaf panel grid must be one to four rows and one or two columns')
        pw=width/columns-.12;ph=height/rows-.16
        if min(pw,ph)<.10:raise ValueError('Door leaf panel grid is too dense for its opening')
        for row in range(rows):
            for column in range(columns):
                blocks.append(('raised timber panel '+str(row)+'-'+str(column),x-width/2+width*(column+.5)/columns,y-.043,bottom+height*(row+.5)/rows,pw,.026,ph))
    return blocks
