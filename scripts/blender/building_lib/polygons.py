"""Pure polygon checks and ear clipping; preserves concave footprint boundaries."""
def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def area(r):return sum(p[0]*r[(i+1)%len(r)][1]-r[(i+1)%len(r)][0]*p[1] for i,p in enumerate(r))/2

def triangulate(ring):
    if len(ring)<3:raise ValueError('Degenerate polygon')
    # Ownership clipping produces valid sub-millimetre edges. Cross products
    # have squared length units, so a fixed metre tolerance rejects small
    # polygons or blocks their ears. Work in a translated unit-sized frame;
    # returned indices still address every original, unmoved vertex.
    low=[min(p[k] for p in ring) for k in (0,1)]
    scale=max(max(p[k] for p in ring)-low[k] for k in (0,1))
    if not scale:raise ValueError('Degenerate polygon')
    ring=[[(p[k]-low[k])/scale for k in (0,1)] for p in ring]
    epsilon=1e-12
    if abs(area(ring))<epsilon:raise ValueError('Degenerate polygon')
    indices=list(range(len(ring)))
    if area(ring)<0:indices.reverse()
    result=[]
    while len(indices)>3:
      ear=None
      for j,b in enumerate(indices):
       a,c=indices[j-1],indices[(j+1)%len(indices)]
       if cross(ring[a],ring[b],ring[c])<=epsilon:continue
       def inside(p):return all(cross(ring[u],ring[v],p)>=-epsilon for u,v in ((a,b),(b,c),(c,a)))
       if any(inside(ring[k]) for k in indices if k not in (a,b,c)):continue
       ear=j;result.append((a,b,c));break
      if ear is None:raise ValueError('Self-intersecting or unsupported degenerate polygon; provide explicit volumes')
      indices.pop(ear)
    result.append(tuple(indices));return result
