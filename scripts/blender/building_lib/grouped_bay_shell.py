"""Shared hollow projecting bays: pierced front/returns and closed base/cap.

Panels are independently closed masonry solids; junctions overlap deliberately.
The compound assembly is not claimed to be one Boolean-unioned manifold.
"""
import copy,math
from .layout import SURFACES
from .facade_mesh import compile_facade
from .portable_triangulation import earcut_rings
from .opening_mesh_capture import capture_opening


def shell_parts(plan,wall,frame,glass):
    if plan.get('construction')!='hollow':raise ValueError('Shared bay shell requires explicit hollow construction')
    if plan['baseRise']:raise ValueError('Hollow grouped bay currently requires a level base')
    thickness=plan.get('shellThickness',.20)
    if isinstance(thickness,bool) or not isinstance(thickness,(int,float)) or not math.isfinite(thickness) or not .16<=thickness<=min(.29,plan['projection']-.035):
        raise ValueError('Hollow bay shell thickness must fit the projection and recessed glazing')
    left,right,inset,projection,bottom,top=[plan[k] for k in ('left','right','returnInset','projection','bottom','top')]
    parts=[]
    def transform(obj,origin,angle):
        c,s=math.cos(angle),math.sin(angle)
        obj['vertices']=[[origin[0]+x*c-y*s,origin[1]+x*s+y*c,z+bottom] for x,y,z in obj['vertices']]
        obj.update(componentId=plan['id'],componentKind='grouped-bay');parts.append(obj)
    def face(label,a,b,openings,joinery=True):
        length=math.dist(a,b);angle=math.atan2(b[1]-a[1],b[0]-a[0]);local=[]
        for item in openings:
            item=copy.deepcopy(item);item['z']-=bottom;local.append(item)
        slab=compile_facade(length,[(0,top-bottom),(length,top-bottom)],local,front=0,back=thickness,triangulator=earcut_rings)
        transform({'name':plan['id']+' / pierced '+label+' masonry','vertices':slab.vertices,'faces':slab.faces,'material':wall,'bayFace':label},a,angle)
        if joinery:
            for item in local:
                objects,_=capture_opening(item,frame,glass)
                for obj in objects:
                    if obj['name'].endswith(' sill'):
                        centre=SURFACES['shell_front']+plan['sillDepth']/2-plan['sillProjection']
                        obj['vertices']=[[x,centre+(y+.08)*plan['sillDepth']/.40,z] for x,y,z in obj['vertices']]
                    obj['vertices']=[[x,y+.035,z] for x,y,z in obj['vertices']]
                    obj.update(featureId=item.get('sourceOpeningId',item['id']),storey=item['storey'],bayFace=label)
                    transform(obj,a,angle)
    localfront=[dict(o,x=o['x']-left-inset) for o in plan['openings']]
    face('front',(left+inset,-projection),(right-inset,-projection),localfront)
    # Rear piercings retain the flat facade's authored aperture ownership.
    face('rear',(right,SURFACES['shell_back']),(left,SURFACES['shell_back']),[dict(o,x=right-o['x']) for o in plan['openings']],False)
    for label,a,b in [('left',(left,SURFACES['shell_front']),(left+inset,-projection)),('right',(right-inset,-projection),(right,SURFACES['shell_front']))]:
        windows=[];length=math.dist(a,b)
        if plan['sideWindows']:
            for o in plan['openings']:
                item=copy.deepcopy(o);item.update(id=o['id']+' / '+label+' return',sourceOpeningId=o['id'],x=length/2,width=length-.16,mullions=[],upperLights=[],sashBars=[]);windows.append(item)
        face(label,a,b,windows)
    ring=[(left,SURFACES['shell_back']),(right,SURFACES['shell_back']),(right,SURFACES['shell_front']),(right-inset,-projection),(left+inset,-projection),(left,SURFACES['shell_front'])]
    ring.reverse()
    def slab(label,z,height,material):
        n=len(ring);verts=[(x,y,zz) for zz in (z,z+height) for x,y in ring];faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        parts.append({'name':plan['id']+' / '+label,'vertices':verts,'faces':faces,'material':material,'componentId':plan['id'],'componentKind':'grouped-bay'})
    slab('closed base',bottom,thickness,wall)
    slab('closed roof',top-thickness,thickness,wall)
    if plan['capHeight']:
        x=plan['x'];y=(-projection+SURFACES['shell_back'])/2;w=plan['width']+2*plan['capProjection'];d=projection+SURFACES['shell_back']+2*plan['capProjection'];h=plan['capHeight']
        parts.append({'name':plan['id']+' / top cornice','vertices':[(x+sx*w/2,y+sy*d/2,top+sz*h/2) for sz in (-1,1) for sy in (-1,1) for sx in (-1,1)],'faces':[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],'material':frame,'componentId':plan['id'],'componentKind':'grouped-bay'})
    return parts
