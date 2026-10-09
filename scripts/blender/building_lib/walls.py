from .geometry import mesh,box
from .layout import SURFACES

def _edge_owned(a,b,front,tolerance=.04):
    import math
    angle=front.get('rotation',0);ox,oy=front['origin'];cs,sn=math.cos(angle),math.sin(angle)
    points=[((x-ox)*cs+(y-oy)*sn,-(x-ox)*sn+(y-oy)*cs) for x,y in (a,b)]
    return all(abs(y)<=tolerance and -tolerance<=x<=front['width']+tolerance for x,y in points)

def _uncovered_edge_segments(a,b,frontages,tolerance=1e-6):
    """Subtract owned facade spans and end caps, retaining original edge lines.

    A source edge may extend past the selected frontage. Splitting that edge is
    necessary: retaining it whole re-blocks glazing; dropping it loses a wing.
    """
    import math
    intervals=[(0.,1.)]
    for front in frontages:
        angle=front.get('rotation',0);ox,oy=front['origin'];cs,sn=math.cos(angle),math.sin(angle)
        local=[((x-ox)*cs+(y-oy)*sn,-(x-ox)*sn+(y-oy)*cs) for x,y in (a,b)]
        if all(abs(y)<=.04 for x,y in local):
            x0,x1=local[0][0],local[1][0]
            if abs(x1-x0)<=tolerance:continue
            lo,hi=sorted(((0-x0)/(x1-x0),(front['width']-x0)/(x1-x0)))
        elif any(all(abs(x-end)<=tolerance for x,y in local) for end in (0,front['width'])):
            y0,y1=local[0][1],local[1][1]
            if abs(y1-y0)<=tolerance:continue
            lo,hi=sorted(((SURFACES['shell_front']-y0)/(y1-y0),(SURFACES['shell_back']-y0)/(y1-y0)))
        else:continue
        remaining=[]
        for start,end in intervals:
            if hi<=start or lo>=end:remaining.append((start,end));continue
            if lo>start:remaining.append((start,min(lo,end)))
            if hi<end:remaining.append((max(hi,start),end))
        intervals=remaining
    def point(t):return (a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)
    return [(point(start),point(end)) for start,end in intervals if end-start>tolerance]


def shell(recipe,wall):
    ring=recipe['footprint'];h=recipe['roof']['eaves'];n=len(ring)
    verts=[(x,y,0) for x,y in ring];faces=[tuple(range(n-1,-1,-1))]
    for i,a in enumerate(ring):
        b=ring[(i+1)%n]
        if any(_edge_owned(a,b,front) for front in recipe['frontages']):continue
        for p,q in _uncovered_edge_segments(a,b,recipe['frontages']):
            index=len(verts);verts.extend([(p[0],p[1],0),(q[0],q[1],0),(q[0],q[1],h),(p[0],p[1],h)])
            faces.append(tuple(range(index,index+4)))
    return mesh('Shell / side and rear walls',verts,faces,wall)

def facade(width,profile,wall):
    outline=[(0,0),(width,0)]+list(reversed(profile));n=len(outline)
    return mesh('Facade / shaped street wall',[(x,y,z) for y in (SURFACES['shell_front'],SURFACES['shell_back']) for x,z in outline],[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],wall)

def finish(width,height,material):
    front,back=SURFACES['finish_front'],SURFACES['finish_back']
    return box('Ground / finish',width/2,(front+back)/2,height/2,width,back-front,height,material)


def _closed_profile(name,points,front,back,material):
    """Closed wall/cutter prism with outward normals and triangulated caps."""
    import bmesh
    if back<=front:raise ValueError('Wall/cutter must have positive depth')
    n=len(points)
    obj=mesh(name,[(x,y,z) for y in (front,back) for x,z in points],
             [tuple(range(n)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],material)
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bmesh.ops.triangulate(bm,faces=[f for f in bm.faces if len(f.verts)>4])
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    return obj


def cut_apertures(obj,openings,front=None,back=None):
    """Cut through a closed local wall/finish slab using shared aperture profiles.

    Called before applying a frontage parent transform. Exact booleans generate
    genuine reveal faces and remove the complete front/rear patch. Source mesh
    collections and existing defaults remain unchanged until callers opt in.
    """
    import bpy,bmesh
    from .apertures import from_spec
    front=min(v.co.y for v in obj.data.vertices)-.02 if front is None else front
    back=max(v.co.y for v in obj.data.vertices)+.02 if back is None else back
    if not openings:return obj
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    for spec in openings:
        points=from_spec(spec)
        # A street-level door cuts past the slab bottom, avoiding a coincident
        # cutter cap at z=0. The visible jamb/head outline stays unchanged.
        points=[(x,z-.01 if abs(z)<1e-8 else z) for x,z in points]
        cutter=_closed_profile('CUTTER / '+spec.get('id','opening'),points,front,back,obj.data.materials[0])
        # Both use the same local transform, even in standalone component tests.
        cutter.matrix_world=obj.matrix_world.copy()
        modifier=obj.modifiers.new('Aperture / '+spec.get('id','opening'),'BOOLEAN');modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
        try:
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        finally:
            cutter_data=cutter.data
            bpy.data.objects.remove(cutter,do_unlink=True)
            if cutter_data.users==0:bpy.data.meshes.remove(cutter_data)
    obj['apertureCount']=len(openings);obj['wallContract']='closed slab with through apertures and reveals'
    obj.data.update()
    # Boolean-created jamb/head faces use the same physical metre UV density.
    tile=obj.data.materials[0].get('tileMetres',[1,1]);uv=obj.data.uv_layers.active
    for polygon in obj.data.polygons:
        for index in polygon.loop_indices:
            v=obj.data.vertices[obj.data.loops[index].vertex_index].co;n=polygon.normal
            uv.data[index].uv=((v.x/tile[0],v.y/tile[1]) if abs(n.z)>.6 else (v.x/tile[0],v.z/tile[1]) if abs(n.y)>abs(n.x) else (v.y/tile[0],v.z/tile[1]))
    return obj


def facade_with_apertures(width,profile,material,openings):
    """Versioned opt-in replacement for the initial compatibility slab."""
    from .apertures import validate_layout
    boundary=[(0,0),(width,0)]+list(reversed(profile))
    validate_layout(openings,width,boundary)
    return cut_apertures(facade(width,profile,material),openings)


def finish_with_apertures(width,height,material,openings):
    """Ground finish shares exactly the shell's aperture profiles."""
    ground=[spec for spec in openings if spec.get('storey')=='ground']
    return cut_apertures(finish(width,height,material),ground)


def shell_from_source(recipe,material,frontage_tolerance=.08):
    """Opt-in exact 3DBAG side/rear walls instead of a uniform eaves extrusion.

    The street-facing wall regions belong to the authored aperture compiler.
    Preserve other semantic wall polygons and their metric ground-relative
    heights; roof reconstruction remains independent of this source-wall choice.
    """
    import math
    source=recipe.get('sourceShell')
    if not source:raise ValueError('Exact source shell required; synthetic fixtures use shell()')
    objects=[]
    for index,surface in enumerate(source['surfaces']):
        if surface['type']!='wall':continue
        if len(surface['rings'])!=1:raise ValueError('Source wall holes require explicit topology support')
        points=surface['rings'][0]
        if len(points)<3:raise ValueError('Invalid source wall polygon')
        owned=False
        for frontage in recipe['frontages']:
            angle=frontage.get('rotation',0);ox,oy=frontage['origin'];sx,cy=math.sin(angle),math.cos(angle)
            offsets=[-(x-ox)*sx+(y-oy)*cy for x,y,z in points]
            if max(abs(y) for y in offsets)<=frontage_tolerance:
                owned=True;break
        if owned:continue
        obj=mesh('Shell / exact 3DBAG wall '+str(index),points,[tuple(range(len(points)))],material)
        obj['sourceGeometry']='3DBAG semantic wall';obj['geometryRevision']=recipe['geometryRevision'];obj['sourceSurfaceIndex']=index
        objects.append(obj)
    if not objects:raise ValueError('Source shell contains no remaining side/rear walls')
    return objects


def assign_height_material(obj,bottom,material):
    """Split existing solid faces at a height; no overlay or duplicate wall.

    Aperture reveals retain their topology and receive the upper material only
    above the same datum. Suitable for independently finished street gables.
    """
    import bmesh,math
    if not math.isfinite(bottom):raise ValueError('Material height datum must be finite')
    obj.data.materials.append(material);index=len(obj.data.materials)-1
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,
                          plane_co=(0,0,bottom),plane_no=(0,0,1),clear_inner=False,clear_outer=False)
    for face in bm.faces:
        if face.calc_center_median().z>bottom+1e-7:face.material_index=index
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    return obj
