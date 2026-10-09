"""Captured foundation covering algorithm, only for before/after diagnostics.

Source: building_lib/roofs.py read before this task's edits, 2026-09-30.
No Blender import or mutation. Deliberately retains the original interpolation
and n-gon patches; this must never be imported by the production compiler.
"""
from building_lib.polygons import triangulate


def clip(polygon, axis, value, less):
    result = []
    for p, q in zip(polygon, polygon[1:] + polygon[:1]):
        inside = p[axis] <= value if less else p[axis] >= value
        other = q[axis] <= value if less else q[axis] >= value
        if inside:
            result.append(p)
        if inside != other:
            t = (value-p[axis])/(q[axis]-p[axis])
            result.append(tuple(p[j]+t*(q[j]-p[j]) for j in range(2)))
    return result


def silhouette_height(profile, x):
    intersections = []
    for p, q in zip(profile, profile[1:]):
        if min(p[0],q[0])-1e-7 <= x <= max(p[0],q[0])+1e-7:
            if abs(q[0]-p[0]) < 1e-8:
                intersections.extend((p[1],q[1]))
            else:
                intersections.append(p[1]+(q[1]-p[1])*(x-p[0])/(q[0]-p[0]))
    return min(intersections) if intersections else profile[0][1]


def patches(recipe):
    spec = recipe['roof']
    width = recipe['frontages'][0]['width']
    ring, profile = recipe['footprint'], recipe['gable']['profile']
    setback = spec.get('setback',.24)
    xs = sorted(set([min(p[0] for p in ring),max(p[0] for p in ring),width/2]+[p[0] for p in profile]))
    ys = sorted(set([setback,setback+1.5,max(p[1] for p in ring)]))

    def height(x,y):
        if spec['kind'] == 'flat':
            return spec['eaves']
        if spec['kind'] == 'shed':
            return spec['eaves']+(spec['top']-spec['eaves'])*x/width
        h = spec['eaves']+(spec['top']-spec['eaves'])*max(0,1-abs(x-width/2)/(width/2))
        front = min(h,silhouette_height(profile,x)-.02)
        t = min(1,max(0,(y-setback)/1.5))
        return front+(h-front)*t

    result = []
    for x0,x1 in zip(xs,xs[1:]):
        for y0,y1 in zip(ys,ys[1:]):
            for triangle in triangulate(ring):
                p = [ring[i] for i in triangle]
                for axis,value,less in ((0,x0,False),(0,x1,True),(1,y0,False),(1,y1,True)):
                    p = clip(p,axis,value,less)
                twice_area = sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p)))
                if len(p) >= 3 and abs(twice_area) > 1e-8:
                    result.append([(x,y,height(x,y)) for x,y in p])
    return result
