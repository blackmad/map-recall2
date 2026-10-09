"""Recessed shopfronts and explicit threshold assemblies in facade-local metres.

A recipe owns the whole recess, including the shared wall aperture. Values are
layout inputs, never a claim that a photograph provided registered dimensions.
"""
import math


def storefront_plan(width,height,recess=.45,side_return=.4,sill=0,head=None,x=0,front_depth=0):
    """Angled returns meet one recessed display plane and one named anchor."""
    head=height if head is None else head
    if not all(math.isfinite(v) for v in (width,height,recess,side_return,sill,head,x,front_depth)):
        raise ValueError('Storefront dimensions must be finite')
    if width<=0 or height<=0 or not 0<recess<=2 or not 0<side_return<width/2:
        raise ValueError('Invalid recessed storefront dimensions')
    if not 0<=sill<head<=height:raise ValueError('Storefront sill/head outside assembly')
    p=[(x,front_depth),(x+side_return,front_depth+recess),
       (x+width-side_return,front_depth+recess),(x+width,front_depth)]
    return {'width':width,'height':height,'anchor':x+width/2,'sill':sill,'head':head,
            'recess':recess,'outline':p,'panels':[{'id':id,'start':a,'end':b} for id,a,b in zip(('left-return','display','right-return'),p,p[1:])]}


def assembly_aperture(spec):
    """The wall/finish/plinth cutter for one recessed-storefront owner."""
    if spec.get('headShape','rectangular')!='rectangular':
        raise ValueError('Recessed storefront currently requires rectangular head')
    return {'id':spec['id'],'x':spec['x'],'z':(spec['sill']+spec['head'])/2,
            'width':spec['width'],'height':spec['head']-spec['sill'],
            'head':'rectangular','kind':'storefront','storey':'ground',
            'provenance':spec.get('provenance',{'status':'synthetic'})}


def _panel_box(name,a,b,bottom,top,width,depth,material):
    """Closed frame/glass prism, with depth normal to its glazing facet."""
    from .geometry import mesh
    length=math.dist(a,b)
    if length<=1e-8:raise ValueError('Storefront facet has zero length')
    ux,uy=(b[0]-a[0])/length,(b[1]-a[1])/length
    # Facet depth axis points into the building; keep right-handed prism winding.
    nx,ny=-uy,ux
    corners=[(a[0]-ux*width/2,a[1]-uy*width/2),(b[0]+ux*width/2,b[1]+uy*width/2)]
    verts=[(p[0]+nx*d,p[1]+ny*d,z) for z in (bottom,top) for d in (-depth/2,depth/2) for p in corners]
    return mesh(name,verts,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],material)


def recessed_storefront(name,plan,frame,glass,lining=None):
    """Closed opaque glazing fallback, connected frames, floor and soffit."""
    from .geometry import mesh
    bottom,top=plan['sill'],plan['head'];t=.07;lining=lining or frame
    for panel in plan['panels']:
        a,b=panel['start'],panel['end'];label=name+' / '+panel['id']
        _panel_box(label+' glazing',a,b,bottom,top,0,.014,glass)
        for z in (bottom,top):_panel_box(label+' horizontal frame',a,b,z-t/2,z+t/2,0,.08,frame)
        length=math.dist(a,b);ux,uy=(b[0]-a[0])/length,(b[1]-a[1])/length
        for p in (a,b):
            start=(p[0]-ux*t/2,p[1]-uy*t/2);end=(p[0]+ux*t/2,p[1]+uy*t/2)
            _panel_box(label+' jamb',start,end,bottom,top,0,.08,frame)
    p=plan['outline'];floor=[(x,y,bottom) for x,y in (p[0],p[3],p[2],p[1])]
    mesh(name+' / recessed threshold floor',floor,[(0,1,2,3)],lining)
    mesh(name+' / recessed soffit',[(x,y,top) for x,y,z in floor],[(3,2,1,0)],lining)
    return {'anchor':plan['anchor'],'glazingFacets':3,'threshold':bottom,'head':top}


def recessed_storefront_from_spec(spec,frame,glass,lining=None):
    from .layout import SURFACES
    plan=storefront_plan(spec['width'],spec['head'],spec['recess'],spec['sideReturn'],spec['sill'],spec['head'],
                         spec['x']-spec['width']/2,spec.get('frontDepth',SURFACES['shell_front']))
    return recessed_storefront(spec['id'],plan,frame,glass,lining)


def entrance_steps(name,width,rise,run,material,max_step=.18):
    """Explicit threshold datum: use only for a recipe with a raised entrance."""
    from .geometry import box
    if not all(math.isfinite(v) for v in (width,rise,run,max_step)) or width<=0 or rise<0 or run<=0 or max_step<=0:
        raise ValueError('Invalid entrance dimensions')
    if rise==0:return []
    n=math.ceil(rise/max_step);step_h=rise/n;step_run=run/n;objects=[]
    for i in range(n):
        height=step_h*(i+1);depth=step_run*(n-i)
        objects.append(box(name+f' / step {i+1}',width/2,-depth/2,height/2,width,depth,height,material))
    return objects
