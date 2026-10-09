"""Reusable low-poly roof finishes for synthetic architectural studies."""
from .geometry import box,beam,mesh


def thicken_covering(obj,thickness=.10):
    import bpy
    modifier=obj.modifiers.new('Covering thickness','SOLIDIFY')
    modifier.thickness=thickness;modifier.offset=-1
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def ridge_cap(x,front,back,z,material,width=.16):
    beam('Roof / ridge cap',(x,front,z+.04),(x,back,z+.04),width,.12,material)


def gutters(width,depth,eaves,material):
    for x in (-.035,width+.035):
        box('Roof / side gutter',x,depth/2,eaves-.045,.16,depth,.13,material)
    # A single downpipe is a useful silhouette cue at the facade edge.
    beam('Roof / downpipe',(width-.08,-.17,.18),(width-.08,-.17,eaves-.08),.065,.07,material)


def surface_gutters(surface,material,options=True):
    """Follow actual horizontal eave edges, including notched footprints."""
    options=options if isinstance(options,dict) else {}
    for ai,bi in surface.boundary:
        a,b=surface.vertices[ai],surface.vertices[bi]
        if abs(a[2]-surface.eaves)<1e-7 and abs(b[2]-surface.eaves)<1e-7:
            beam('Roof / supported eave gutter',(a[0],a[1],a[2]-.045),
                 (b[0],b[1],b[2]-.045),.14,.12,material)
    for pipe in options.get('downpipes',[]):
        x,y=pipe['x'],pipe['y']
        top=surface.height(x,y)-.08
        beam('Roof / downpipe',(x,y,pipe.get('bottom',.18)),(x,y,top),.065,.07,material)


def chimney(surface,x,y,wall,coping,size=.42,height=.85):
    corners=[surface.height(x+dx*size/2,y+dy*size/2) for dx in (-1,1) for dy in (-1,1)]
    bottom=min(corners)-.06;top=max(corners)+height
    box('Roof / supported chimney',x,y,(bottom+top)/2,size,size,top-bottom,wall)
    box('Roof / chimney coping',x,y,top+.035,size+.12,size+.12,.10,coping)
    box('Roof / chimney mouth',x,y,top+.09,size*.63,size*.63,.025,wall)


def mansard(width,depth,eaves,rise,material,inset=.72,top_inset=1.35):
    """Closed hipped broken roof with a flat upper deck, for sample blocks.

    One nested rectangle per datum establishes true roof volume and clean joins.
    Each trapezoid is planar and explicitly triangulated before export.
    """
    from .roof_surfaces import compile_roof
    recipe={'footprint':[[0,0],[width,0],[width,depth],[0,depth]],
            'frontages':[{'width':width}], 'gable':{'profile':[(0,eaves),(width,eaves)]},
            'roof':{'kind':'mansard','eaves':eaves,'top':eaves+rise,
                    'kneeInset':inset,'topInset':top_inset,'kneeHeight':eaves+rise*.76}}
    surface=compile_roof(recipe)
    obj=mesh('Roof / mansard broken covering',surface.vertices,surface.triangles,material)
    thicken_covering(obj)
    return surface


def dormer(surface,x,y,width,height,wall,roof,frame,glass):
    """A supported forward-facing dormer with a modest pitched roof."""
    from .openings import opening
    import bpy
    before=set(bpy.context.scene.objects)
    from .attachment_contracts import dormer_support
    bottom,head,depth=dormer_support(surface,x,y,width,height)
    box('Dormer / cheek walls',x,y+depth/2,(bottom+head)/2,width,depth,head-bottom,wall)
    profile=[(-width/2,head),(0,head+.38),(width/2,head)]
    verts=[(x+a,y+dy,z) for dy in (0,depth) for a,z in profile]
    mesh('Dormer / pitched cap',verts,[(0,1,4,3),(1,2,5,4),(0,2,1),(3,4,5)],roof)
    # Reuse established joinery with its facade-local front moved to the dormer.
    prior=set(bpy.context.scene.objects)
    opening('Dormer / window',x,head-height*.49,width*.70,height*.68,frame,glass,
            mullions=[.5],transom=.45)
    for obj in set(bpy.context.scene.objects)-prior:obj.location.y=y-.09
    return list(set(bpy.context.scene.objects)-before)
