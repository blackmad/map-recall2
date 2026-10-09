"""Pierced finish above a horizontal datum, clipped to the authored silhouette."""
import copy,math
from .source_massing import frontage_profile

def finish_plan(recipe,front):
    spec=front.get('upperFinish')
    if not spec:return None
    bottom=spec.get('bottom');profile=frontage_profile(recipe,front)
    if isinstance(bottom,bool) or not isinstance(bottom,(int,float)) or not math.isfinite(bottom) or not 0<bottom<min(z for x,z in profile):
        raise ValueError('Upper finish bottom must lie below the entire frontage profile')
    from .materials import linear
    linear(spec['colour'])
    openings=[]
    for opening in front.get('openings',[]):
        lo=opening['z']-opening['height']/2;hi=opening['z']+opening['height']/2
        if lo<bottom<hi:raise ValueError('Upper finish datum cannot cross an opening')
        if lo>=bottom:
            item=copy.deepcopy(opening);item['z']-=bottom;openings.append(item)
    return {'bottom':bottom,'colour':spec['colour'],'profile':[(x,z-bottom) for x,z in profile],'openings':openings}

def finish_mesh(recipe,front,triangulator=None):
    plan=finish_plan(recipe,front)
    if plan is None:return None
    from .facade_mesh import compile_facade
    result=compile_facade(front['width'],plan['profile'],plan['openings'],-.085,-.06,triangulator)
    result.vertices=[(x,y,z+plan['bottom']) for x,y,z in result.vertices]
    return result


def zone_mesh(zone,front,triangulator=None):
    """Closed rectangular finish with owned apertures; no scene Booleans."""
    if zone.get('construction')=='clipped':return clipped_zone_mesh(zone,front,triangulator)
    if zone.get('construction')!='pierced':
        raise ValueError('Portable material zones require explicit pierced construction')
    from .materials import linear
    linear(zone['colour'])
    left=zone['x']-zone['width']/2;bottom=zone['z']-zone['height']/2
    right=left+zone['width'];top=bottom+zone['height'];openings=[]
    for opening in front.get('openings',[]):
        lo=opening['z']-opening['height']/2;hi=opening['z']+opening['height']/2
        a=opening['x']-opening['width']/2;b=opening['x']+opening['width']/2
        if min(b,right)-max(a,left)<=1e-7 or min(hi,top)-max(lo,bottom)<=1e-7:continue
        if a<=left+1e-7 or b>=right-1e-7 or lo<=bottom+1e-7 or hi>=top-1e-7:
            raise ValueError('Pierced material zone boundary crosses or touches an aperture')
        item=copy.deepcopy(opening);item['x']-=left;item['z']-=bottom;openings.append(item)
    from .facade_mesh import compile_facade
    result=compile_facade(zone['width'],[(0,zone['height']),(zone['width'],zone['height'])],openings,
        zone['frontDepth'],zone['frontDepth']+zone['thickness'],triangulator)
    result.vertices=[(x+left,y,z+bottom) for x,y,z in result.vertices]
    return result


def clipped_zone_mesh(zone,front,triangulator=None):
    """Subtract aperture outlines from a finish rectangle.

    Rebuild only the boundary extrusion, including notches where openings
    cross the rectangle. Internal triangle edges never become wall faces.
    """
    from collections import Counter
    from .facade_mesh import FacadeMesh,_split_existing_edge_vertices
    from .source_massing import _subtract_convex
    from .polygons import area,cross,triangulate
    from .apertures import from_spec
    from .materials import linear
    linear(zone['colour'])
    left=zone['x']-zone['width']/2;right=left+zone['width']
    bottom=zone['z']-zone['height']/2;top=bottom+zone['height']
    # Partition around each aperture triangle. This pure path is identical
    # in both consumers and avoids bridging many aligned holes into one ring.
    pieces=[[(left,0,bottom),(right,0,bottom),(right,0,top),(left,0,top)]]
    for opening in front.get('openings',[]):
        a=opening['x']-opening['width']/2;b=a+opening['width']
        lo=opening['z']-opening['height']/2;hi=lo+opening['height']
        if min(b,right)-max(a,left)<=1e-9 or min(hi,top)-max(lo,bottom)<=1e-9:continue
        outline=from_spec(opening)
        for face in triangulate(outline):
            region=[outline[i] for i in face]
            pieces=[piece for polygon in pieces for piece in _subtract_convex(polygon,region,lambda p:(p[0],p[2]))]
    points=[];indices={};triangles=[]
    def index(p):
        key=(round(p[0],10),round(p[2],10))
        if key not in indices:indices[key]=len(points);points.append((p[0],p[2]))
        return indices[key]
    for polygon in pieces:
        if len(polygon)<3 or abs(area([(p[0],p[2]) for p in polygon]))<1e-12:continue
        row=[index(p) for p in polygon]
        for i in range(1,len(row)-1):
            tri=(row[0],row[i],row[i+1])
            if cross(*(points[j] for j in tri))>1e-12:triangles.append(tri)
    if not triangles:raise ValueError('Clipped material zone contains no wall surface')
    triangles=_split_existing_edge_vertices(triangles,points)
    edges=Counter((a,b) for face in triangles for a,b in zip(face,face[1:]+face[:1]))
    if any(count!=1 for count in edges.values()):raise ValueError('Clipped material zone has overlapping triangles')
    boundary=[(a,b) for a,b in edges if not edges[b,a]]
    front_depth=zone['frontDepth'];back=front_depth+zone['thickness'];n=len(points)
    vertices=[(x,depth,z) for depth in (front_depth,back) for x,z in points]
    faces=list(triangles)+[tuple(n+i for i in reversed(face)) for face in triangles]
    faces.extend((a,a+n,b+n,b) for a,b in boundary)
    directed=Counter((a,b) for face in faces for a,b in zip(face,face[1:]+face[:1]))
    if any(count!=1 or directed[b,a]!=1 for (a,b),count in directed.items()):
        raise ValueError('Clipped material zone is not a closed oriented manifold')
    return FacadeMesh(vertices,faces,[])
