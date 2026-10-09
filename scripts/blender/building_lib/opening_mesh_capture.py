"""Portable capture of the existing recessed joinery builder for draft studies.

Only mesh, box and facade-plane beams are supported. Unsupported beam axes
fail instead of silently producing a different assembly. The temporary module
adapter is restored even on failure and never touches Blender's scene.
"""
import importlib,math,sys,types


def _capture(build):
    objects=[]
    def mesh(name,vertices,faces,material):
        obj={'name':name,'vertices':[list(p) for p in vertices],
             'faces':[list(face) for face in faces],'material':material}
        objects.append(obj);return obj
    def box(name,x,y,z,w,d,h,material):
        if min(w,d,h)<=0:raise ValueError('Captured box dimensions must be positive')
        return mesh(name,[(x+sx*w/2,y+sy*d/2,z+sz*h/2) for sz in (-1,1) for sy in (-1,1) for sx in (-1,1)],
                    [(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],material)
    def beam(name,a,b,width,depth,material):
        if abs(a[1]-b[1])>1e-9:
            direction=[b[i]-a[i] for i in range(3)];length=math.sqrt(sum(v*v for v in direction))
            if length<=1e-9:raise ValueError('Captured beam has zero length')
            direction=[v/length for v in direction];up=[0,0,1]
            dot=sum(up[i]*direction[i] for i in range(3));yaxis=[up[i]-dot*direction[i] for i in range(3)]
            norm=math.sqrt(sum(v*v for v in yaxis));yaxis=[v/norm for v in yaxis]
            xaxis=[yaxis[1]*direction[2]-yaxis[2]*direction[1],yaxis[2]*direction[0]-yaxis[0]*direction[2],yaxis[0]*direction[1]-yaxis[1]*direction[0]]
            obj=box(name,0,0,0,width,depth,length,material);center=[(a[i]+b[i])/2 for i in range(3)]
            obj['vertices']=[[center[i]+x*xaxis[i]+y*yaxis[i]+z*direction[i] for i in range(3)] for x,y,z in obj['vertices']]
            return obj
        dx,dz=b[0]-a[0],b[2]-a[2];length=math.hypot(dx,dz)
        if length<=1e-9:raise ValueError('Portable joinery beam has zero length')
        obj=box(name,0,0,0,width,depth,length,material)
        center=[(a[k]+b[k])/2 for k in range(3)]
        # Track Z/up Y means local Y tracks the world-up reference (+Z),
        # not world Y. At an exactly vertical beam Blender uses its fallback.
        dx,dz=dx/length,dz/length
        if abs(dx)>1e-9:
            sign=1 if dx>0 else -1
            obj['vertices']=[[center[0]-y*dz*sign+z*dx,
                              center[1]+x*sign,center[2]+y*abs(dx)+z*dz]
                             for x,y,z in obj['vertices']]
        else:
            sign=1 if dz>0 else -1
            obj['vertices']=[[center[0]+x,center[1]+y*sign,center[2]+z*sign]
                             for x,y,z in obj['vertices']]
        return obj
    key=__package__+'.geometry';opening_key=__package__+'.openings'
    prior_geometry=sys.modules.get(key);prior_openings=sys.modules.get(opening_key)
    adapter=types.ModuleType(key);adapter.mesh=mesh;adapter.box=box;adapter.beam=beam
    try:
        sys.modules[key]=adapter;sys.modules.pop(opening_key,None)
        audit=build()
        return objects,audit
    finally:
        for name,prior in ((key,prior_geometry),(opening_key,prior_openings)):
            sys.modules.pop(name,None)
            if prior is not None:sys.modules[name]=prior


def capture_opening(spec,frame,glass,brass=None):
    def build():
        builder=importlib.import_module(__package__+'.openings')
        return builder.recessed_opening(spec,frame,glass,brass,glass_depth=spec.get('glazingDepth',.10),lower_panel=spec.get('lowerPanel',{}).get('colour'),sash=spec.get('sashColour'),door_leaf=spec.get('doorLeaf',{}).get('colour'))
    return _capture(build)


def capture_warehouse(front,recipe=None):
    def build():
        from .warehouse import build_warehouse_attachments
        objects=build_warehouse_attachments(front,lambda material,colour=None:colour or ('#343b37' if material=='iron' else '#5a5143'),recipe)
        return {'warehouseObjects':len(objects),'status':'shared warehouse assembly; GPU validation pending'}
    return _capture(build)
