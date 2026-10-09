"""Pure support checks shared by preflight and Blender roof attachments."""
import math
from .roof_surfaces import clip_half_plane, pitch_breaks
from .polygons import area


def finite(value):
    return isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)


def dormer_support(surface,x,y,width,height):
    if not all(finite(v) for v in (x,y,width,height)) or width<=0 or height<=0:
        raise ValueError('Dormer coordinates must be finite and dimensions positive')
    depth=.85
    left,right=x-width/2,x+width/2
    covered=0
    for face in surface.triangles:
        polygon=[surface.vertices[i][:2] for i in face]
        for distance in (lambda p:p[0]-left,lambda p:right-p[0],
                         lambda p:p[1]-y,lambda p:y+depth-p[1]):
            polygon=clip_half_plane(polygon,distance)
            if len(polygon)<3:break
        if len(polygon)>=3:covered+=abs(area(polygon))
    if abs(covered-width*depth)>max(1e-7,width*depth*1e-7):
        raise ValueError('Dormer footprint is not fully supported by roof covering')
    supports=[surface.height(xx,yy) for xx in (left,right) for yy in (y,y+depth)]
    bottom=min(supports)-.12;head=surface.height(x,y)+height
    if head<=max(supports)+.05:
        raise ValueError('Dormer height must clear its rear roof support; move it uphill or increase height')
    return bottom,head,depth


def ridge_support(recipe,surface):
    spec=recipe['roof']
    if spec['kind'] not in ('pitched','gambrel','hip') or spec['top']<=spec['eaves']:
        raise ValueError('Ridge cap requires a pitched, gambrel or hip roof with positive rise')
    structural=dict(spec)
    if spec['kind']=='hip':
        structural.setdefault('pitchSpan',[min(p[0] for p in recipe['footprint']),max(p[0] for p in recipe['footprint'])])
    x=pitch_breaks(structural,recipe['frontages'][0]['width'])[1]
    front,back=min(p[1] for p in surface.vertices),max(p[1] for p in surface.vertices)
    if spec['kind']=='hip':front+=spec['hipEndRun'];back-=spec['hipEndRun']
    else:front+=spec['frontHipRun'] if spec.get('frontJoin')=='hip' else spec.get('frontTransition',1.5)
    if back-front<=1e-7:raise ValueError('Ridge cap requires a nonzero supported ridge span')
    # A concave owner can interrupt the ridge even when both ends are supported.
    breaks={front,back}
    for face in surface.triangles:
        points=[surface.vertices[i] for i in face]
        for a,b in zip(points,points[1:]+points[:1]):
            if min(a[0],b[0])<=x<=max(a[0],b[0]) and abs(b[0]-a[0])>1e-9:
                y=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])
                if front<y<back:breaks.add(y)
    ordered=sorted(breaks)
    for a,b in zip(ordered,ordered[1:]):
        for y in (a,(a+b)/2,b):
            if abs(surface.height(x,y)-spec['top'])>1e-6:
                raise ValueError('Ridge cap span is not supported at roof top')
    return x,front,back,spec['top']
