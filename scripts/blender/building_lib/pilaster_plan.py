"""Closed projecting piers, including optional blind shaft panels."""
def pilaster_blocks(spec,front_plane):
    return [('base',spec['x'],front_plane-(spec['projection']+.035)/2,spec['bottom']+.10,spec['width']+.12,spec['projection']+.035,.20),
            ('capital',spec['x'],front_plane-(spec['projection']+.035)/2,spec['top']-.11,spec['width']+.12,spec['projection']+.035,.22)]

def pilaster_mesh(spec,front_plane):
    x,w=spec['x'],spec['width'];left=x-w/2;right=x+w/2;bottom,top=spec['bottom'],spec['top'];near=front_plane-spec['projection'];far=front_plane
    panels=spec.get('panels',[]);xs=sorted({left,right,*[v for p in panels for v in (left+p['margin'],right-p['margin'])]});zs=sorted({bottom,top,*[v for p in panels for v in (p['bottom'],p['top'])]})
    depth={}
    for i in range(len(xs)-1):
        for j in range(len(zs)-1):
            mx,mz=(xs[i]+xs[i+1])/2,(zs[j]+zs[j+1])/2
            depth[i,j]=near+next((p['inset'] for p in panels if left+p['margin']<mx<right-p['margin'] and p['bottom']<mz<p['top']),0)
    vertices=[];indices={};faces=[]
    def face(points):
        ids=[]
        for point in points:
            key=tuple(round(v,9) for v in point)
            if key not in indices:indices[key]=len(vertices);vertices.append(tuple(point))
            ids.append(indices[key])
        faces.append(tuple(ids))
    for (i,j),y in depth.items():
        ring=[(xs[i],zs[j]),(xs[i+1],zs[j]),(xs[i+1],zs[j+1]),(xs[i],zs[j+1])]
        face([(a,y,b) for a,b in ring]);face([(a,far,b) for a,b in reversed(ring)])
        neighbors=[(i,j-1),(i+1,j),(i,j+1),(i-1,j)]
        for (a,b),neighbor in zip(zip(ring,ring[1:]+ring[:1]),neighbors):
            other=depth.get(neighbor,far)
            if other>y+1e-9:face([(b[0],y,b[1]),(a[0],y,a[1]),(a[0],other,a[1]),(b[0],other,b[1])])
    # Different blind-panel depths may meet at a corner. Share all collinear
    # edge subdivisions so the retained shaft stays closed.
    result=[]
    for ids in faces:
        ring=[]
        for ai,bi in zip(ids,ids[1:]+ids[:1]):
            a,b=vertices[ai],vertices[bi];delta=[b[k]-a[k] for k in range(3)];length=sum(v*v for v in delta);knots=[(0,ai)]
            for index,p in enumerate(vertices):
                t=sum((p[k]-a[k])*delta[k] for k in range(3))/length
                if 1e-8<t<1-1e-8 and sum((p[k]-a[k]-t*delta[k])**2 for k in range(3))<1e-16:knots.append((t,index))
            ring.extend(index for _,index in sorted(knots))
        result.append(tuple(ring))
    return vertices,result
