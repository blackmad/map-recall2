"""Owned street aperture, solid passage lining and recessed rear door."""
import copy,math

def entry_plan(opening):
    raw=opening.get('entranceRecess')
    if raw is None:return None
    if not isinstance(raw,dict) or opening.get('kind')!='door' or opening.get('head','rectangular')!='rectangular':
        raise ValueError('Entrance recess requires a rectangular door aperture')
    if opening.get('storey')!='ground' or any(opening.get(k) for k in ('warehouse','lowerPanel','doorLeaf','sashBars')):
        raise ValueError('Entrance recess owns ground passage and rear joinery separately')
    depth=raw.get('depth');ratio=raw.get('doorWidthFraction',.78);height=raw.get('doorHeightFraction',.8)
    lining=raw.get('liningThickness',.09);threshold=raw.get('thresholdRise',.06)
    values=(depth,ratio,height,lining,threshold)
    if not all(isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) for v in values):
        raise ValueError('Entrance recess dimensions must be finite numbers')
    w,h=opening['width'],opening['height']
    if not .3<=depth<=2 or not .55<=ratio<=.85 or not .6<=height<=.85 or not .06<=lining<=.15 or not 0<=threshold<=.18:
        raise ValueError('Entrance recess dimensions outside supported bounds')
    if w*ratio<.65 or (w-w*ratio)/2<lining+.02 or threshold+h*height>h-.15:
        raise ValueError('Rear door must leave supported passage returns and head clearance')
    from .materials import linear
    linear(raw['liningColour'])
    proof=raw.get('provenance',opening.get('provenance',{}))
    if proof.get('status') not in ('inferred','synthetic') or not proof.get('basis'):
        raise ValueError('Entrance recess requires explicit authoring provenance')
    bottom=opening['z']-h/2;top=opening['z']+h/2
    door=copy.deepcopy(opening);door.pop('entranceRecess')
    door.update(id=opening['id']+' / rear door',width=w*ratio,height=h*height,z=bottom+threshold+h*height/2)
    template=raw.get('doorTemplate',{})
    if not isinstance(template,dict) or set(template)-{'transom','mullions','doorLeaf','sashColour','handleFractions'}:
        raise ValueError('Rear door template cannot replace owned geometry or recurse')
    door.update(copy.deepcopy(template))
    transom=door.get('transom')
    if transom is not None and (isinstance(transom,bool) or not isinstance(transom,(int,float)) or not math.isfinite(transom) or not .05<=transom<=.6):
        raise ValueError('Rear door transom outside supported range')
    for key in ('mullions','handleFractions'):
        values=door.get(key,[])
        if not isinstance(values,list) or any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not 0<v<1 for v in values):
            raise ValueError('Rear door joinery fractions must lie inside the aperture')
    from .door_leaf import door_leaf_blocks
    door_leaf_blocks(door,.1)
    return {'depth':depth,'thickness':lining,'bottom':bottom,'top':top,'x':opening['x'],'width':w,
        'door':door,'liningColour':raw['liningColour']}

def entry_parts(opening,frame,glass,brass=None,lining=None):
    from .facade_mesh import compile_facade
    from .portable_triangulation import earcut_rings
    from .opening_mesh_capture import capture_opening
    from .layout import SURFACES
    p=entry_plan(opening)
    if p is None:raise ValueError('Missing entrance recess')
    x,w,t,lo,hi=p['x'],p['width'],p['thickness'],p['bottom'],p['top']
    front=SURFACES['finish_front'];rear=front+p['depth'];lining=lining or p['liningColour'];objects=[]
    def box(label,x,y,z,w,d,h):
        objects.append({'name':opening['id']+' / '+label,'vertices':[(x+sx*w/2,y+sy*d/2,z+sz*h/2) for sz in (-1,1) for sy in (-1,1) for sx in (-1,1)],
            'faces':[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],'material':lining,'componentKind':'entrance-recess'})
    box('left solid return',x-w/2+t/2,(front+rear)/2,(lo+hi)/2,t,p['depth'],hi-lo)
    box('right solid return',x+w/2-t/2,(front+rear)/2,(lo+hi)/2,t,p['depth'],hi-lo)
    box('passage floor',x,(front+rear)/2,lo-t/2,w,p['depth'],t)
    box('passage soffit',x,(front+rear)/2,hi+t/2,w,p['depth'],t)
    rise=p['door']['z']-p['door']['height']/2-lo
    if rise>1e-7:
        box('rear threshold step',x,rear-.11,lo+rise/2,p['door']['width']+.1,.22,rise)
    local=copy.deepcopy(p['door']);local['x']=w/2;local['z']-=lo-t
    wall=compile_facade(w,[(0,hi-lo+2*t),(w,hi-lo+2*t)],[local],rear,rear+t,earcut_rings)
    objects.append({'name':opening['id']+' / pierced rear wall','vertices':[(a+x-w/2,b,c+lo-t) for a,b,c in wall.vertices],
        'faces':wall.faces,'material':lining,'componentKind':'entrance-recess'})
    door=p['door'];parts,_=capture_opening(door,frame,glass,brass)
    for obj in parts:
        obj['vertices']=[(a,b+rear+.035,c) for a,b,c in obj['vertices']]
        obj['componentKind']='recessed-rear-door';objects.append(obj)
    return objects
