"""Optional facade dressings and low-poly sidewalk furniture from recipes.

Front hooks run before the shared facade parent transform. Site components use
the building frame and explicit anchors; they never depend on a gable family.
"""
import json
import math
from .component_catalog import resolve,resolve_zone,validate_components


def _mark(objects,spec,recipe):
    provenance=spec.get('provenance',{'status':'synthetic' if recipe.get('synthetic') else 'unknown'})
    for obj in objects:
        obj['componentId']=spec['id'];obj['componentKind']=spec.get('kind','material-zone')
        obj['componentProvenance']=json.dumps(provenance)
    return objects


def _cuts(front):
    from .ground_floors import assembly_aperture
    assemblies=front.get('storefront',{}).get('recessedAssemblies',[]) or front.get('recessedAssemblies',[])
    recesses=[{'id':p['id']+' / recessed void','x':p['x'],'z':(p['bottom']+p['top'])/2,
               'width':p['width'],'height':p['top']-p['bottom'],'head':'rectangular'}
              for p in front.get('recessedUpperPanels',[]) if p.get('cutFacade',False)]
    return list(front.get('openings',[]))+[assembly_aperture(s) for s in assemblies]+recesses


def _cut_overlapping(obj,cuts):
    """Skip disjoint cutters; quoin stacks otherwise repeat hundreds of booleans."""
    from .walls import cut_apertures
    xs=[v.co.x for v in obj.data.vertices];zs=[v.co.z for v in obj.data.vertices]
    selected=[o for o in cuts if (o['x']+o['width']/2>min(xs)+1e-7 and o['x']-o['width']/2<max(xs)-1e-7 and
              o['z']+o['height']/2>min(zs)+1e-7 and o['z']-o['height']/2<max(zs)-1e-7)]
    return cut_apertures(obj,selected)


def _facade_detail(spec,front,mat):
    from .geometry import box
    from .layout import SURFACES
    material=mat(spec['material'],spec.get('colour'));kind=spec['kind'];objects=[]
    front_plane=SURFACES['shell_front']
    def block(label,x,z,w,h,projection=None):
        projection=spec['projection'] if projection is None else projection
        obj=box(spec['id']+' / '+label,x,front_plane-projection/2,z,w,projection,h,material)
        objects.append(obj);return obj
    if kind in ('stringcourse','lintel','sill'):
        obj=block(kind,spec['x'],spec['z'],spec['width'],spec['height'])
        # A deliberate course may cross a window row; it shares the aperture
        # owner instead of covering a glazed opening with a solid strip.
    elif kind=='cornice':
        from .cornice_plan import cornice_blocks
        for label,x,z,w,h,projection in cornice_blocks(spec):
            block(label,x,z,w,h,projection)
    elif kind=='pilaster':
        from .pilaster_plan import pilaster_mesh,pilaster_blocks
        from .geometry import mesh
        vertices,faces=pilaster_mesh(spec,front_plane)
        obj=mesh(spec['id']+' / shaft',vertices,faces,material);objects.append(obj)
        if spec.get('panels'):obj['wallContract']='closed pilaster with blind recessed panels'
        for label,x,y,z,w,d,h in pilaster_blocks(spec,front_plane):objects.append(box(spec['id']+' / '+label,x,y,z,w,d,h,material))
    elif kind=='corbel':
        import bmesh
        from .geometry import mesh
        # A slim wall foot grows into a projecting cornice support. Preserve
        # the concave underside rather than substituting a rectangular block.
        profile=[(0,0),(.14,0),(.14,.20),(.24,.22),(.28,.45),(.50,.50),(.55,.70),(1,.80),(1,1),(0,1)]
        n=len(profile);x=spec['x'];w=spec['width'];h=spec['height'];z=spec['z']-h/2;d=spec['projection']
        verts=[(x+side*w/2,front_plane-a*d,z+b*h) for side in (-1,1) for a,b in profile]
        faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        obj=mesh(spec['id']+' / concave bracket',verts,faces,material)
        bm=bmesh.new();bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bmesh.ops.triangulate(bm,faces=[f for f in bm.faces if len(f.verts)>4])
        bm.to_mesh(obj.data);bm.free();obj.data.update();objects.append(obj)
    elif kind=='mailboxes':
        x,z,w,h=spec['x'],spec['z'],spec['width'],spec['height']
        block('backing',x,z,w,h)
        cw,ch=w/spec['columns'],h/spec['rows'];dark=mat('iron','#41473f');label=mat('ivorytimber','#bfc1ac')
        for row in range(spec['rows']):
            for column in range(spec['columns']):
                cx=x-w/2+cw*(column+.5);cz=z-h/2+ch*(row+.5);y=front_plane-spec['projection']-.012
                objects.append(box(spec['id']+f' / plate {row}-{column}',cx,y,cz,cw-.018,.02,ch-.018,material))
                objects.append(box(spec['id']+f' / slot {row}-{column}',cx,y-.013,cz+ch*.24,cw*.67,.012,.018,dark))
                objects.append(box(spec['id']+f' / label {row}-{column}',cx,y-.014,cz-ch*.12,cw*.38,.012,ch*.15,label))
    elif kind=='quoins':
        for edge in spec['edges']:
            count=int((spec['top']-spec['bottom'])/spec['spacing'])+1
            for index in range(count):
                h=min(spec['height'],spec['top']-(spec['bottom']+index*spec['spacing']))
                if h<=1e-8:continue
                width=spec['width'] if index%2 else spec['alternateWidth']
                x=width/2 if edge=='left' else front['width']-width/2
                obj=block(edge+' block '+str(index),x,spec['bottom']+index*spec['spacing']+h/2,width,h)
    elif kind=='dressing':
        opening=spec['opening'];x,z=opening['x'],opening['z'];w,h=opening['width'],opening['height'];t=spec['width']
        for sign,label in [(-1,'left jamb'),(1,'right jamb')]:block(label,x+sign*(w+t)/2,z,t,h)
        block('stone head',x,z+(h+t)/2,w+2*t,t)
        if spec.get('includeSill',opening.get('kind')!='door'):block('stone foot',x,z-(h+t)/2,w+2*t,t)
    elif kind=='balcony':
        from .balcony_plan import balcony_blocks
        rail=mat(spec['frameMaterial'],spec.get('frameColour'))
        for label,x,y,z,w,d,h,role in balcony_blocks(spec,front_plane):
            objects.append(box(spec['id']+' / '+label,x,y,z,w,d,h,material if role=='slab' else rail))
    if kind in ('cornice','stringcourse','pilaster','quoins','corbel'):
        for obj in objects:_cut_overlapping(obj,_cuts(front))
    return objects


def build_front_components(recipe,front,material_factory):
    """Call inside the facade loop before applying its existing parent frame."""
    from .geometry import box
    objects=[];eaves=recipe['roof']['eaves']
    from .facade_finish import finish_mesh
    finish=finish_mesh(recipe,front)
    if finish:
        from .geometry import mesh
        obj=mesh(front['id']+' / upper finish',finish.vertices,finish.faces,
                 material_factory('creamrender',front['upperFinish']['colour']))
        obj['componentKind']='upper-finish';objects.append(obj)
    for raw in front.get('materialZones',[]):
        zone=resolve_zone(raw,front,eaves)
        if zone.get('construction') in ('pierced','clipped'):
            from .facade_finish import zone_mesh
            from .geometry import mesh
            finish=zone_mesh(zone,{**front,'openings':_cuts(front)})
            obj=mesh(zone['id']+' / material finish',finish.vertices,finish.faces,material_factory(zone['material'],zone['colour']))
        else:
            obj=box(zone['id']+' / material finish',zone['x'],zone['frontDepth']+zone['thickness']/2,
                    zone['z'],zone['width'],zone['thickness'],zone['height'],material_factory(zone['material'],zone.get('colour')))
            _cut_overlapping(obj,_cuts(front))
        obj['materialZoneId']=zone['id']
        objects.extend(_mark([obj],zone,recipe))
    for raw in front.get('components',[]):
        spec=resolve(raw,front,eaves)
        objects.extend(_mark(_facade_detail(spec,front,material_factory),spec,recipe))
    return objects


def _furniture(spec,mat):
    import bpy
    from .geometry import box,mesh
    before=set(bpy.context.scene.objects);w,d,h=spec['width'],spec['depth'],spec['height']
    material=mat(spec['material'],spec.get('colour'));frame=mat(spec.get('frameMaterial',spec['material']),spec.get('frameColour'))
    def block(name,x,y,z,width,depth,height,m=None):return box(spec['id']+' / '+name,x,y,z,width,depth,height,m or material)
    kind=spec['kind']
    if kind=='table':
        if spec['shape']=='round':
            n=8;verts=[(math.cos(i*math.tau/n)*w/2,math.sin(i*math.tau/n)*d/2,z) for z in (h-.055,h) for i in range(n)]
            mesh(spec['id']+' / octagonal top',verts,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+
                 [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],material)
        else:block('top',0,0,h-.025,w,d,.05)
        support=h-(.055 if spec['shape']=='round' else .05)
        for sx in (-1,1):
            for sy in (-1,1):block('leg',sx*w*.34,sy*d*.34,support/2,.045,.045,support,frame)
    elif kind=='chair':
        seat=spec['seatHeight'];block('seat',0,0,seat-.025,w,d,.05)
        for sx in (-1,1):
            for sy in (-1,1):block('leg',sx*(w/2-.04),sy*(d/2-.04),(seat-.05)/2,.04,.04,seat-.05,frame)
        for sx in (-1,1):block('back upright',sx*(w/2-.04),d/2-.04,(seat+h)/2,.04,.045,h-seat,frame)
        for z in (seat+.17,h-.055):block('back slat',0,d/2-.04,z,w,.045,.095)
    elif kind=='planter':
        t=.06;block('bottom',0,0,t/2,w,d,t)
        for sx in (-1,1):block('side wall',sx*(w-t)/2,0,h/2,t,d,h)
        for sy in (-1,1):block('end wall',0,sy*(d-t)/2,h/2,w-2*t,t,h)
        for sx in (-1,1):block('rim',sx*(w-t)/2,0,h+.018,t+.035,d+.035,.045)
        for sy in (-1,1):block('rim',0,sy*(d-t)/2,h+.018,w-2*t,t+.035,.045)
        block('soil',0,0,h-.06,w-2*t,d-2*t,.035,mat(spec['soilMaterial'],spec.get('soilColour')))
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(0,0,h+spec['plantHeight']*.38))
        shrub=bpy.context.object;shrub.name=spec['id']+' / faceted shrub'
        shrub.scale=(w*.43,d*.43,spec['plantHeight']*.65)
        shrub.data.materials.append(mat(spec['plantMaterial'],spec['plantColour']))
    objects=list(set(bpy.context.scene.objects)-before)
    anchor=bpy.data.objects.new(spec['id']+' / site anchor',None);bpy.context.collection.objects.link(anchor)
    anchor.location=spec['position'];anchor.rotation_euler.z=spec['rotation']
    for obj in objects:obj.parent=anchor
    anchor['componentId']=spec['id'];anchor['componentKind']=kind
    return objects


def build_site_components(recipe,material_factory):
    objects=[]
    for raw in recipe.get('siteComponents',[]):
        spec=resolve(raw,site=True)
        objects.extend(_mark(_furniture(spec,material_factory),spec,recipe))
    return objects


def build_components(recipe,material_factory):
    """Standalone convenience hook; do not also call the per-front hook."""
    import bpy
    errors=validate_components(recipe)
    if errors:raise ValueError('; '.join(errors))
    objects=[]
    for front in recipe.get('frontages',[]):
        children=build_front_components(recipe,front,material_factory)
        if not children:continue
        anchor=bpy.data.objects.new('Components / '+front['id'],None);bpy.context.collection.objects.link(anchor)
        anchor.location=(*front['origin'],0);anchor.rotation_euler.z=front.get('rotation',0)
        for child in children:child.parent=anchor;child['frontageId']=front['id']
        objects.extend(children)
    return objects+build_site_components(recipe,material_factory)
