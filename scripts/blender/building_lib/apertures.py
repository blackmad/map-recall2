"""Pure shared opening outlines used by wall cutters, reveals and joinery.

Coordinates are facade-local (x,z) metres. Rectification uncertainty belongs
in the recipe; this module validates topology, not photographic resemblance.
"""
import math
from .polygons import triangulate,cross


def outline(x,z,width,height,head='rectangular',arch_rise=None,segments=12,stem_width=None):
    if not all(math.isfinite(v) for v in (x,z,width,height)) or min(width,height)<=0:
        raise ValueError('Aperture dimensions must be positive finite metres')
    if head not in ('rectangular','segmental','rounded','circular','keyhole'):
        raise ValueError('Unsupported aperture head')
    if not isinstance(segments,int) or not 4<=segments<=128:
        raise ValueError('Curved aperture needs 4–128 integer segments')
    if head=='keyhole':
        if arch_rise is not None:raise ValueError('Keyhole aperture does not use archRise')
        stem=stem_width if stem_width is not None else width*.35
        if isinstance(stem,bool) or not isinstance(stem,(int,float)) or not math.isfinite(stem) or not width*.15<=stem<=width*.75:
            raise ValueError('Keyhole stem width must be 15–75 percent of bulb diameter')
        if height<=width+.1 or segments<12:raise ValueError('Keyhole requires a distinct lower stem and at least 12 arc segments')
        radius=width/2;center=z+height/2-radius;angle=math.acos(stem/width)
        return [(x-stem/2,z-height/2),(x+stem/2,z-height/2)]+[
            (x+radius*math.cos(-angle+(math.pi+2*angle)*i/segments),center+radius*math.sin(-angle+(math.pi+2*angle)*i/segments))
            for i in range(segments+1)]
    if head=='circular':
        if abs(width-height)>1e-8:raise ValueError('Circular aperture requires equal width and height')
        if arch_rise is not None:raise ValueError('Circular aperture does not use archRise')
        if segments<12:raise ValueError('Circular aperture needs at least12segments')
        return [(x+width/2*math.cos(i*2*math.pi/segments),z+height/2*math.sin(i*2*math.pi/segments)) for i in range(segments)]
    if head=='rectangular':
        return [(x-width/2,z-height/2),(x+width/2,z-height/2),(x+width/2,z+height/2),(x-width/2,z+height/2)]
    rise=arch_rise if arch_rise is not None else (min(width/2,height*.45) if head=='rounded' else min(height*.12,.2))
    if not math.isfinite(rise) or not 0<rise<height:raise ValueError('Arch rise must be inside opening height')
    if head=='segmental' and rise>width/2:raise ValueError('Segmental head cannot exceed a half-circle')
    spring=z+height/2-rise
    points=[(x-width/2,z-height/2),(x+width/2,z-height/2),(x+width/2,spring)]
    if head=='segmental':
        # Circular segment: rise and span fix the circle, unlike an ellipse.
        radius=(width*width/4+rise*rise)/(2*rise)
        centre_z=spring+rise-radius
        half_angle=math.asin(min(1,width/(2*radius)))
        if rise>width/2:half_angle=math.pi-half_angle
        points += [(x+radius*math.sin(half_angle*(1-2*i/segments)),centre_z+radius*math.cos(half_angle*(1-2*i/segments))) for i in range(1,segments+1)]
    else:
        points += [(x+width/2*math.cos(i*math.pi/segments),spring+rise*math.sin(i*math.pi/segments)) for i in range(1,segments+1)]
    return points


def from_spec(spec):
    return outline(spec['x'],spec['z'],spec['width'],spec['height'],spec.get('head','rectangular'),spec.get('archRise'),spec.get('archSegments',24 if spec.get('head') in ('circular','keyhole') else 12),spec.get('stemWidth'))


def offset_profile(points,distance):
    """Miter offset of a counterclockwise simple outline; positive is inward."""
    from .polygons import area
    if area(points)<=0:raise ValueError('Profile offset requires counterclockwise outline')
    result=[]
    for i,p in enumerate(points):
        a,b=points[i-1],points[(i+1)%len(points)]
        edges=[(p[0]-a[0],p[1]-a[1]),(b[0]-p[0],b[1]-p[1])]
        normals=[]
        for dx,dz in edges:
            length=math.hypot(dx,dz)
            if length<1e-10:raise ValueError('Profile offset has a zero edge')
            normals.append((-dz/length,dx/length))
        nx,nz=normals[0][0]+normals[1][0],normals[0][1]+normals[1][1]
        divisor=nx*normals[1][0]+nz*normals[1][1]
        if abs(divisor)<1e-8:raise ValueError('Profile offset has a collapsed miter')
        dx,dz=distance*nx/divisor,distance*nz/divisor
        if math.hypot(dx,dz)>abs(distance)*4:raise ValueError('Profile offset miter exceeds supported bound')
        result.append((p[0]+dx,p[1]+dz))
    triangulate(result)
    return result


def validate(spec,width,wall_top=None):
    points=from_spec(spec);triangulate(points)
    if min(x for x,z in points)<-1e-6 or max(x for x,z in points)>width+1e-6:
        raise ValueError(f"{spec.get('id','Opening')}: outside frontage width")
    if min(z for x,z in points)<-1e-6:raise ValueError('Opening goes below street datum')
    if wall_top is not None and max(z for x,z in points)>wall_top+1e-6:
        raise ValueError('Opening goes above wall datum')
    return points


def contains(points,point):
    """Boundary-inclusive ray test for inspection and contract tests."""
    x,y=point;inside=False
    for i,a in enumerate(points):
        b=points[(i+1)%len(points)];dx=b[0]-a[0];dy=b[1]-a[1]
        if abs(dx*(y-a[1])-dy*(x-a[0]))<1e-8 and min(a[0],b[0])-1e-8<=x<=max(a[0],b[0])+1e-8 and min(a[1],b[1])-1e-8<=y<=max(a[1],b[1])+1e-8:return True
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:inside=not inside
    return inside


def _edges(points):
    return zip(points,points[1:]+points[:1])

def _proper_intersection(a,b,c,d):
    return cross(a,b,c)*cross(a,b,d)<-1e-12 and cross(c,d,a)*cross(c,d,b)<-1e-12

def validate_layout(specs,width,boundary):
    """Reject silhouette crossings and intersecting independent aperture owners.

    Vertex-only containment misses an edge crossing a concave neck gable.
    Openings that touch must be authored as one assembly, not overlapping cuts.
    """
    triangulate(boundary);profiles=[]
    for spec in specs:
        points=validate(spec,width,max(z for x,z in boundary))
        if any(not contains(boundary,p) for p in points) or any(
            _proper_intersection(a,b,c,d) for a,b in _edges(points) for c,d in _edges(boundary)):
            raise ValueError(f"{spec.get('id','Opening')}: aperture crosses facade/gable silhouette")
        for previous,prior_points in profiles:
            if any(contains(prior_points,p) for p in points) or any(contains(points,p) for p in prior_points) or any(
                _proper_intersection(a,b,c,d) for a,b in _edges(points) for c,d in _edges(prior_points)):
                raise ValueError(f"{spec.get('id','Opening')}: intersects aperture {previous.get('id','Opening')}")
        profiles.append((spec,points))
    return [points for spec,points in profiles]
