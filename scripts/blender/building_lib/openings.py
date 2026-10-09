"""Compatibility panels and opt-in joinery inside shared true aperture profiles."""
import math
from .geometry import mesh,box,beam
from .layout import SURFACES
def opening(name,x,z,w,h,frame,glass,arched=False,door=False,mullions=None,transom=.25,brass=None,upper_lights=None):
    # Glazing is inset behind projecting timber frames and sill.
    t=min(.085,w*.07)
    rise=min(h*.12,.20) if arched else 0
    pts=[(x-w/2,z-h/2),(x+w/2,z-h/2),(x+w/2,z+h/2-rise)]
    if arched:
        pts += [(x+w/2*math.cos(a),z+h/2-rise+rise*math.sin(a)) for a in [i*math.pi/12 for i in range(1,13)]]
    else:pts.append((x-w/2,z+h/2))
    mesh(name+' recessed glass',[(a,SURFACES['glass'],b) for a,b in pts],[tuple(range(len(pts)))],glass)
    for i in range(len(pts)):
        a,b=pts[i],pts[(i+1)%len(pts)]
        beam(name+' frame',(a[0],SURFACES['frame'],a[1]),(b[0],SURFACES['frame'],b[1]),t,.08,frame)
    box(name+' sill',x,-.16,z-h/2,w+.12,.25,.085,frame)
    for fraction in (mullions if mullions is not None else ([.5] if w>1 else [])):
        box(name+' mullion',x-w/2+w*fraction,-.135,z,t*.65,.08,h-.07,frame)
    box(name+' transom',x,-.135,z+h/2-h*transom,w,.08,t*.7,frame)
    for fraction in upper_lights or []:
        upperHeight=h*transom
        box(name+' upper sash light',x-w/2+w*fraction,-.135,z+h/2-upperHeight/2,t*.55,.08,upperHeight,frame)
    if door:
        box(name+' timber kick panel',x,-.14,z-h*.33,w-.08,.08,h*.29,frame)
        box(name+' brass handle',x+w*.3,-.21,z-.05,.035,.045,.18,brass)



# Explicit construction roles survive both Blender objects and portable capture.
# Unknown roles are retained by consumers; opacity and aperture silhouettes stay.
_LOD_KEEP = {
    'glazing': (True, True), 'outer-trim': (True, True),
    'jamb-profile': (False, False), 'sash-division': (True, False),
    'opaque-panel': (True, True), 'door-leaf': (True, True),
    'raised-panel': (False, False), 'louvre': (False, False),
    'sill-threshold': (True, True), 'handle': (False, False),
    'entrance-recess': (True, True),
}
def _lod_create(factory, role, *args):
    obj = factory(*args)
    facade, massing = _LOD_KEEP[role]
    obj['lodRole'] = role
    obj['lodFacade'] = facade
    obj['lodMassing'] = massing
    return obj

def lod_mesh(role, *args): return _lod_create(mesh, role, *args)
def lod_box(role, *args): return _lod_create(box, role, *args)
def lod_beam(role, *args): return _lod_create(beam, role, *args)

def recessed_opening(spec,frame,glass,brass=None,glass_depth=.12,lower_panel=None,sash=None,door_leaf=None,lining=None,material_factory=None):
    """Joinery and opaque glazing inside an actual cut wall aperture.

    Projecting outer trim preserves the compatibility facade frame plane. Inner
    sash/glazing and jamb profiles share the requested recess, rather than float
    as a dark plaque in front of uncut masonry.
    """
    if spec.get('entranceRecess'):
        from .recessed_entries import entry_parts
        for obj in entry_parts(spec,frame,glass,brass,lining):
            material=obj['material']
            if isinstance(material,str) and not isinstance(frame,str):
                if material_factory is None:raise ValueError('Blender recessed entries require the material factory')
                material=material_factory('creamrender' if obj.get('componentKind')=='entrance-recess' else 'ivorytimber',material)
            lod_mesh('entrance-recess',obj['name'],obj['vertices'],obj['faces'],material)
        return {'entranceRecess':True,'depth':spec['entranceRecess']['depth']}
    from .door_leaf import door_leaf_blocks
    leaf_blocks=door_leaf_blocks(spec,glass_depth)
    from .sash_bars import sash_bar_plan
    partial_bars=sash_bar_plan(spec)
    from .apertures import from_spec
    from .geometry import beam
    transom=spec.get('transom',.25)
    if transom is None and (spec.get('upperLights') or spec.get('upperLightBars')):
        raise ValueError('Upper lights require a transom division')
    if spec.get('upperLightBars') and spec.get('transomArch'):
        raise ValueError('Horizontal upper light bars require a straight transom')
    glass_thickness=.014
    if not math.isfinite(glass_depth) or not SURFACES['shell_front']<glass_depth<glass_depth+glass_thickness<SURFACES['shell_back']:
        raise ValueError('Glazing recess must be inside the wall depth')
    name=spec['id'];x,z,w,h=spec['x'],spec['z'],spec['width'],spec['height'];points=from_spec(spec);t=min(.085,w*.07)
    # Opaque mobile fallback is a closed pane, so oblique/back views cannot
    # expose an empty interior through single-sided geometry.
    n=len(points)
    lod_mesh('glazing',name+' recessed glazing',[(px,depth,pz) for depth in (glass_depth,glass_depth+glass_thickness) for px,pz in points],
         [tuple(range(n)),tuple(range(2*n-1,n-1,-1))]+[(i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n)],glass)
    if spec.get('head') in ('circular','keyhole'):
        def ring(role,label,thickness,near,far):
            vertices=[];faces=[]
            if spec.get('head')=='keyhole':
                from .apertures import offset_profile
                contours=[offset_profile(points,thickness/2),offset_profile(points,-thickness/2)]
            else:
                contours=[[(x+(px-x)*radius/(w/2),z+(pz-z)*radius/(w/2)) for px,pz in points] for radius in (w/2-thickness/2,w/2+thickness/2)]
            for depth in (near,far):
                for contour in contours:vertices.extend((px,depth,pz) for px,pz in contour)
            for i in range(n):
                j=(i+1)%n
                faces.extend([(i,j,j+n,i+n),(i+2*n,i+3*n,j+3*n,j+2*n),(i,i+2*n,j+2*n,j),(i+n,j+n,j+3*n,i+3*n)])
            return lod_mesh(role,name+label,vertices,[tuple(reversed(face)) for face in faces],frame)
        ring('outer-trim',' outer trim',t,SURFACES['frame']-.04,SURFACES['frame']+.04)
        ring('jamb-profile',' jamb profile',t*.65,SURFACES['frame']+.02,glass_depth-.015)
    else:
        for a,b in zip(points,points[1:]+points[:1]):
            lod_beam('outer-trim',name+' outer trim',(a[0],SURFACES['frame'],a[1]),(b[0],SURFACES['frame'],b[1]),t,.08,frame)
            # Longitudinal joinery joins the visible outer trim to the recessed sash.
            near=SURFACES['frame']+.02;far=glass_depth-.015
            lod_beam('jamb-profile',name+' jamb profile',(a[0],(near+far)/2,a[1]),(b[0],(near+far)/2,b[1]),t*.65,far-near,frame)
    sash_depth=glass_depth-.035
    sash=frame if sash is None else sash
    if spec.get('head') in ('circular','keyhole'):
        if spec.get('kind','window')!='window' or any(spec.get(k) for k in ('warehouse','lowerPanel','transomArch','upperLights','upperLightBars')):
            raise ValueError('Circular and keyhole apertures support window sash only')
        # Chords inside the shared faceted outline, inset from the perimeter
        # trim. Sampling both edges of each bar keeps its square ends inside.
        def interval(value,vertical):
            hits=[];axis=0 if vertical else 1;other=1-axis
            for a,b in zip(points,points[1:]+points[:1]):
                if abs(a[axis]-b[axis])<1e-10:continue
                if min(a[axis],b[axis])-1e-10<=value<=max(a[axis],b[axis])+1e-10:
                    f=(value-a[axis])/(b[axis]-a[axis]);hits.append(a[other]+f*(b[other]-a[other]))
            if len(hits)<2:raise ValueError('Circular sash division outside aperture')
            return min(hits)+t*.65,max(hits)-t*.65
        def chord(label,value,vertical,thickness):
            bounds=[interval(value+d,vertical) for d in (-thickness/2,thickness/2)]
            lo=max(p[0] for p in bounds);hi=min(p[1] for p in bounds)
            if hi<=lo:raise ValueError('Circular sash division too close to perimeter')
            if vertical:lod_box('sash-division',name+label,value,sash_depth,(lo+hi)/2,thickness,.06,hi-lo,frame)
            else:lod_box('sash-division',name+label,(lo+hi)/2,sash_depth-.006,value,hi-lo,.06,thickness,frame)
        for fraction in spec.get('mullions',[.5]):
            chord(' recessed mullion',x-w/2+w*fraction,True,t*.65)
        if transom is not None:chord(' recessed sash division',z+h/2-h*transom,False,t*.7)
        return {'apertureOutline':points,'glazingDepth':glass_depth,'glazingThickness':glass_thickness,'thresholdZ':z-h/2,'outerTrimDepth':SURFACES['frame']}
    for fraction in spec.get('mullions',[.5] if w>1 else []):
        lod_box('sash-division',name+' recessed mullion',x-w/2+w*fraction,sash_depth,z,t*.65,.06,h-.07,sash)
    for fraction in spec.get('horizontalMullions',[]):
        lod_box('sash-division',name+' horizontal grid bar',x,sash_depth,z-h/2+h*fraction,w-.07,.06,t*.65,sash)
    for index,(x1,z1,x2,z2) in enumerate(partial_bars):
        if z1==z2:
            lod_box('sash-division',name+' partial sash bar '+str(index),(x1+x2)/2,sash_depth,z1,abs(x2-x1),.06,t*.65,sash)
        else:
            lod_box('sash-division',name+' partial sash bar '+str(index),x1,sash_depth,(z1+z2)/2,t*.65,.06,abs(z2-z1),sash)
    if transom is not None:
        division=z+h/2-h*transom
        if spec.get('transomArch'):
            rise=spec['transomArch']['rise']
            if not 0<rise<h*transom:raise ValueError('Transom arch rise must fit upper pane')
            arch=[(x-w/2*math.cos(i*math.pi/16),sash_depth-.006,division+rise*math.sin(i*math.pi/16)) for i in range(17)]
            for a,b in zip(arch,arch[1:]):lod_beam('sash-division',name+' curved sash division',a,b,t*.7,.06,frame)
        else:
            lod_box('sash-division',name+' recessed sash division',x,sash_depth-.006,division,w,.06,t*.7,frame)
    for fraction in spec.get('upperLights',[]):
        top_h=h*transom
        if spec.get('transomArch'):
            top_h-=spec['transomArch']['rise']*math.sqrt(max(0,1-(2*fraction-1)**2))
        lod_box('sash-division',name+' upper light',x-w/2+w*fraction,sash_depth,z+h/2-top_h/2,t*.55,.06,top_h,frame)
    for fraction in spec.get('upperLightBars',[]):
        # Fractions run upward from the transom to the aperture head.
        bar_z=z+h/2-h*transom*(1-fraction)
        lod_box('sash-division',name+' upper horizontal light',x,sash_depth-.003,bar_z,w-.07,.06,t*.55,frame)
    threshold=z-h/2
    if spec.get('lowerPanel'):
        panel_h=spec['lowerPanel']['height']
        if not 0<panel_h<h:raise ValueError('Lower panel must fit opening height')
        divisions=[0]+spec['lowerPanel'].get('divisions',[])+[1]
        for index,(left,right) in enumerate(zip(divisions,divisions[1:])):
            px=x-w/2+w*(left+right)/2;pw=w*(right-left)-.08
            suffix='' if len(divisions)==2 else ' '+str(index+1)
            lod_box('opaque-panel',name+' lower display panel'+suffix,px,sash_depth-.012,threshold+panel_h/2,pw,.06,panel_h,lower_panel or frame)
            count=spec['lowerPanel'].get('louvreCount',0)
            if count:
                spacing=panel_h/(count+1)
                for row in range(count):
                    lod_box('louvre',name+' lower panel louvre'+suffix,px,sash_depth-.047,threshold+spacing*(row+1),pw-.03,.025,spacing*.35,lower_panel or frame)
    for label,bx,by,bz,bw,bd,bh in leaf_blocks:
        lod_box('door-leaf' if label=='opaque timber leaf' else 'raised-panel',name+' '+label,bx,by,bz,bw,bd,bh,door_leaf or frame)
    lod_box('sill-threshold',name+(' threshold' if spec.get('kind')=='door' else ' sill'),x,-.08,threshold-.04,w+.12,.40,.08,frame)
    if spec.get('kind')=='door' and 'warehouse' not in spec:
        if not spec.get('lowerPanel') and not spec.get('doorLeaf'):
            # The opaque panel covers lower sash joinery. Give its face a clear
            # streetward offset instead of sharing the mullion's front plane.
            lod_box('opaque-panel',name+' recessed kick panel',x,sash_depth-.012,z-h*.33,w-.08,.06,h*.29,frame)
        if brass:
            for fraction in spec.get('handleFractions',[.8]):
                lod_box('handle',name+' door handle',x-w/2+w*fraction,sash_depth-.06,z-.05,.035,.045,.18,brass)
    return {'apertureOutline':points,'glazingDepth':glass_depth,'glazingThickness':glass_thickness,'thresholdZ':threshold,'outerTrimDepth':SURFACES['frame']}
