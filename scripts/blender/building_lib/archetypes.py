"""Composition shared by real and synthetic recipes; no building-ID switches."""
import bpy,math,json
from .geometry import box,line,mesh
from .openings import recessed_opening
from .warehouse import warehouse_opening_spec,build_warehouse_attachments
from .grouped_bays import opening_owners,build_grouped_bays
from . import walls,roofs,signage,details,gables,ground_floors
from .materials.blender import material
from .component_details import build_front_components,build_site_components

def build(recipe,cache):
    from .schema import validate
    errors=validate(recipe)
    if errors:raise ValueError('Invalid building recipe: '+'; '.join(errors))
    for obj in list(bpy.context.scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
    for collection in list(bpy.data.collections):
      if collection.name.startswith('SOURCE /'):bpy.data.collections.remove(collection)
    mat=lambda id,colour=None:material(id,cache,colour,style=recipe.get('style','simple'))
    wall=mat(recipe['materials']['wall'],recipe['materials'].get('wallColour'));roof=mat(recipe['materials']['roof']);cream=mat(recipe['materials'].get('frame','ivorytimber'));stone=mat('limestone');glass=mat('glass',recipe['materials'].get('glassColour'));iron=mat('iron');brass=mat('brass');lettering=mat('ivorytimber','#eeeece')
    from .source_massing import build_source_massing,frontage_profile
    if recipe.get('massing'):
      build_source_massing(recipe,wall,roof);height=None
    else:
      walls.shell(recipe,wall);height=roofs.build_roof(recipe,roof,wall)
      from .open_frames import cut_analytic_roof_voids
      cut_analytic_roof_voids(recipe)
    for front in recipe['frontages']:
      before=set(bpy.context.scene.objects);w=front['width'];storefront=front['storefront'];gh=storefront['height'];eaves=front.get('eaves',recipe['roof']['eaves'])
      profile=frontage_profile(recipe,front)
      openings=front.get('openings',[])
      assemblies=storefront.get('recessedAssemblies',[])
      cuts=openings+[ground_floors.assembly_aperture(spec) for spec in assemblies]
      from .open_frames import frame_apertures,build_open_frames
      cuts+=frame_apertures(front,eaves)
      facade_wall=walls.facade_with_apertures(w,profile,wall,cuts)
      if front is recipe['frontages'][0] and recipe['gable'].get('material'):
        walls.assign_height_material(facade_wall,eaves,mat(recipe['gable']['material'],recipe['gable'].get('colour')))
      walls.finish_with_apertures(w,gh,mat('whiterender',storefront['finishColour']),cuts)
      plinth=box('Ground / stone plinth',w/2,-.055,.18,w,.11,.36,mat('bluestone'))
      walls.cut_apertures(plinth,[item for item in cuts if item['storey']=='ground'])
      if storefront.get('cornice',True):box('Storefront / cornice',w/2,-.10,gh,w+.08,.23,.13,cream)
      if front.get('eavesCornice',True):box('Facade / eaves cornice',w/2,-.12,eaves,w+.16,.31,.18,cream)
      if front.get('coping'):
        spec=front['coping'];vertices,faces=gables.coping_mesh(profile,spec.get('width',.11),spec.get('depth',.34),inset_top=True)
        mesh('Gable / continuous coping',vertices,faces,mat('limestone',spec['colour']))
      elif len(profile)>2:gables.coping(profile,stone,.105,.35)
      bay_owners=opening_owners(front)
      build_open_frames(recipe,front,wall,mat)
      from .open_frames import build_recessed_upper_panels
      build_recessed_upper_panels(front,eaves,mat)
      for item in front.get('openings',[]):
        if item['id'] in bay_owners:continue
        prior=set(bpy.context.scene.objects)
        recessed_opening(warehouse_opening_spec(item),mat('ivorytimber',item['frameColour']) if item.get('frameColour') else cream,mat('glass',item['glassColour']) if item.get('glassColour') else glass,mat('iron',item['handleColour']) if item.get('handleColour') else brass,glass_depth=item.get('glazingDepth',.10),lower_panel=mat('ivorytimber',item['lowerPanel']['colour']) if item.get('lowerPanel',{}).get('colour') else None,sash=mat('iron',item['sashColour']) if item.get('sashColour') else None,door_leaf=mat('ivorytimber',item['doorLeaf']['colour']) if item.get('doorLeaf',{}).get('colour') else None,material_factory=mat)
        for obj in set(bpy.context.scene.objects)-prior:obj['featureId']=item['id'];obj['provenance']=json.dumps(item.get('provenance',{'status':'synthetic'}));obj['storey']=item['storey']
        if item.get('balcony'):details.balcony(item['x'],item['z']-item['height']/2,item['width'],stone,iron)
      for spec in assemblies:
        prior=set(bpy.context.scene.objects)
        ground_floors.recessed_storefront_from_spec(spec,cream,glass,stone)
        for obj in set(bpy.context.scene.objects)-prior:
          obj['featureId']=spec['id'];obj['provenance']=json.dumps(spec.get('provenance',{'status':'synthetic'}));obj['storey']='ground'
      from .entrance_stairs import stair_meshes
      for step in storefront.get('entranceSteps',[]):
        for part in stair_meshes(step,front,recipe):
          obj=mesh(part['name'],part['vertices'],part['faces'],mat('iron' if 'rail' in part['name'] else 'bluestone',part['material']))
          obj['featureId']=step['id'];obj['provenance']=json.dumps(step.get('provenance',{'status':'synthetic'}));obj['storey']='ground'
      signage.build(storefront,mat,lettering)
      build_front_components(recipe,front,mat)
      build_warehouse_attachments(front,mat,recipe)
      build_grouped_bays(recipe,front,mat)
      if front.get('bicycleSign') or (front is recipe['frontages'][0] and recipe.get('details',{}).get('bicycleSign')):
        details.bicycle_sign(w*.80,3.55,cream,iron)
      # One parent transform owns raw mesh coordinates and positioned text.
      angle=front.get('rotation',0);ox,oy=front['origin']
      children=set(bpy.context.scene.objects)-before
      parent=bpy.data.objects.new('Facade frame / '+front['id'],None);bpy.context.collection.objects.link(parent)
      parent.location=(ox,oy,0);parent.rotation_euler.z=angle
      for obj in children:obj.parent=parent;obj['frontageId']=front['id']
    build_site_components(recipe,mat)
    from .source_attachments import build_source_attachments,build_source_dormers
    build_source_attachments(recipe,iron)
    build_source_dormers(recipe,wall,roof,cream,glass,mat)
    if height is not None:roofs.build_details(recipe,height,wall,roof,cream,glass,iron,stone)
    for obj in bpy.context.scene.objects:
      if obj.type=='MESH':obj['buildingId']=recipe.get('buildingId',recipe['id']);obj['recipeId']=recipe['id']
    bpy.context.view_layer.update()
    return [o for o in bpy.context.scene.objects if o.type=='MESH' and not o.get('sourceOnly')]

def source_overlay(recipe):
    """Exact 3DBAG semantic surfaces, isolated from authored/exported geometry."""
    if not recipe.get('sourceShell'):return
    import bmesh
    collection=bpy.data.collections.new('SOURCE / 3DBAG shell (toggle for audit)');bpy.context.scene.collection.children.link(collection)
    mat=bpy.data.materials.new('Source shell audit');mat.diffuse_color=(.1,.6,1,.3)
    for n,s in enumerate(recipe['sourceShell']['surfaces']):
      if any(len(r)<3 for r in s['rings']):continue
      verts=s['rings'][0];obj=mesh('SOURCE / '+s['type']+' '+str(n),verts,[tuple(range(len(verts)))],mat)
      for old in list(obj.users_collection):old.objects.unlink(obj)
      collection.objects.link(obj);obj.hide_render=True;obj.hide_set(True);obj['sourceOnly']=True;obj['geometryRevision']=recipe['geometryRevision']
