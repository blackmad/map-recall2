"""Portable closed facade slabs with exact faceted aperture boundaries.

No scene mutation or Boolean runtime is needed. This study kernel consumes the
same aperture outlines as the reviewed Blender builders, including curved and
keyhole openings. Production Blender assembly remains unchanged.
"""
import math
from dataclasses import dataclass
from collections import Counter
from .apertures import from_spec,validate_layout
from .polygons import area
from .source_massing import _tessellate_rings


def _split_existing_edge_vertices(triangles,points):
    """Resolve triangulator T-junctions using unchanged input vertices only."""
    from .polygons import cross
    pending=list(triangles);result=[];iterations=0
    while pending:
        face=pending.pop();iterations+=1
        if iterations>len(points)*len(points)*8:raise ValueError('Facade edge subdivision did not converge')
        split=False
        for k in range(3):
            a,b,c=face[k],face[(k+1)%3],face[(k+2)%3]
            dx,dz=points[b][0]-points[a][0],points[b][1]-points[a][1]
            length=dx*dx+dz*dz
            if length<=1e-20:raise ValueError('Facade triangle edge collapsed')
            candidates=[]
            for i,p in enumerate(points):
                if i in face:continue
                t=((p[0]-points[a][0])*dx+(p[1]-points[a][1])*dz)/length
                if 1e-8<t<1-1e-8 and abs(cross(points[a],points[b],p))<=1e-10:
                    candidates.append((t,i))
            if candidates:
                _,i=min(candidates);pending.extend(((a,i,c),(i,b,c)));split=True;break
        if not split:result.append(face)
    return result


@dataclass
class FacadeMesh:
    vertices: list
    faces: list
    aperture_rings: list


def compile_facade(width,profile,openings,front=-.035,back=.24,triangulator=None):
    if not all(math.isfinite(v) for v in (width,front,back)) or width<=0 or front>=back:
        raise ValueError('Facade slab requires finite positive width and depth')
    boundary=[(0,0),(width,0)]+list(reversed(profile))
    validate_layout(openings,width,boundary)
    if area(boundary)<=0:raise ValueError('Facade boundary must be counterclockwise')
    holes=[list(reversed(from_spec(spec))) for spec in openings]
    rings=[boundary]+holes
    near=[[(x,front,z) for x,z in ring] for ring in rings]
    if triangulator is None:
        points,triangles,_=_tessellate_rings(near,.000001)
    else:
        points=[p for ring in near for p in ring]
        triangles=triangulator(rings)
        from .polygons import cross
        flat=[p for ring in rings for p in ring]
        if any(len(face)!=3 or any(not isinstance(i,int) or not 0<=i<len(flat) for i in face) for face in triangles):
            raise ValueError('Triangulator returned invalid indices')
        if any(cross(*(flat[i] for i in face)) < -1e-10 for face in triangles):
            raise ValueError('Triangulator returned reversed triangles')
        # Earcut can emit zero-area faces between vertically aligned openings.
        # Remove those faces, then restore edge subdivisions and independently
        # require area conservation and a closed oriented manifold below.
        triangles=[face for face in triangles if cross(*(flat[i] for i in face))>1e-10]
        triangles=_split_existing_edge_vertices(triangles,flat)
        expected=area(boundary)-sum(abs(area(ring)) for ring in holes)
        actual=sum(area([flat[i] for i in face]) for face in triangles)
        if abs(actual-expected)>max(1e-7,expected*1e-7):raise ValueError('Triangulator failed aperture area conservation')
    n=len(points)
    vertices=list(points)+[(x,back,z) for x,_,z in points]
    faces=list(triangles)+[tuple(n+i for i in reversed(face)) for face in triangles]
    offset=0
    for ring in rings:
        for i in range(len(ring)):
            a=offset+i;b=offset+(i+1)%len(ring)
            faces.append((a,a+n,b+n,b))
        offset+=len(ring)
    directed=Counter((a,b) for face in faces for a,b in zip(face,face[1:]+face[:1]))
    if any(count!=1 or directed[b,a]!=1 for (a,b),count in directed.items()):
        raise ValueError('Facade triangulation is not a closed oriented manifold')
    return FacadeMesh(vertices,faces,holes)
