"""Save editable scenes; merge only duplicated export objects; report actual costs."""
import json,hashlib,time,struct,math
from pathlib import Path

def glb_draw_calls(path):
    """Count exported primitives, including material splits within one mesh."""
    with Path(path).open('rb') as stream:
        header=stream.read(12)
        if len(header)!=12:raise ValueError('Truncated GLB header')
        magic,version,total=struct.unpack('<4sII',header)
        if magic!=b'glTF' or version!=2 or total!=Path(path).stat().st_size:
            raise ValueError('Invalid GLB header')
        chunk=stream.read(8)
        if len(chunk)!=8:raise ValueError('Truncated GLB JSON chunk header')
        length,kind=struct.unpack('<II',chunk)
        if kind!=0x4E4F534A or length>total-20:raise ValueError('Invalid GLB JSON chunk')
        payload=stream.read(length)
        if len(payload)!=length:raise ValueError('Truncated GLB JSON chunk')
    document=json.loads(payload)
    return sum(len(mesh.get('primitives',[])) for mesh in document.get('meshes',[]))

def authored_frontage_bounds(recipe):
    """Geometric envelope of authored planes; does not assert review acceptance."""
    points=[]
    for front in recipe['frontages']:
        angle=front.get('rotation',0);ox,oy=front['origin']
        top=front.get('eaves',recipe['roof']['eaves'])
        for x in (0,front['width']):
            for z in (0,top):points.append((ox+math.cos(angle)*x,oy+math.sin(angle)*x,z))
    result={'count':len(recipe['frontages']),'min':[min(p[i] for p in points) for i in range(3)],
            'max':[max(p[i] for p in points) for i in range(3)]}
    if len(recipe['frontages'])>1:
        normal=[sum(math.sin(f.get('rotation',0)) for f in recipe['frontages']),
                -sum(math.cos(f.get('rotation',0)) for f in recipe['frontages'])]
        length=math.hypot(*normal)
        if length>1e-6:result['outwardPlan']=[v/length for v in normal]
    return result

def save_and_export(recipe,objects,out,art):
    import bpy
    from mathutils import Vector
    objects=[o for o in objects if not o.get('sourceOnly')]
    out=Path(out);art=Path(art);out.mkdir(parents=True,exist_ok=True);art.mkdir(parents=True,exist_ok=True)
    bpy.context.view_layer.update();coords=[o.matrix_world@Vector(p) for o in objects for p in o.bound_box]
    bounds={'min':[min(p[i] for p in coords) for i in range(3)],'max':[max(p[i] for p in coords) for i in range(3)]}
    bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(art/(recipe['id']+'.blend')))
    copies=[]
    for o in objects:
      duplicate=o.copy();duplicate.data=o.data.copy();bpy.context.collection.objects.link(duplicate);world=o.matrix_world.copy();duplicate.parent=None;duplicate.matrix_world=world;copies.append(duplicate)
    groups={}
    for o in copies:groups.setdefault(o.data.materials[0].name,[]).append(o)
    for group in groups.values():
      bpy.ops.object.select_all(action='DESELECT')
      for o in group:o.select_set(True)
      bpy.context.view_layer.objects.active=group[0]
      if len(group)>1:bpy.ops.object.join()
    bpy.ops.object.select_all(action='DESELECT')
    exportObjects=[g[0] for g in groups.values()]
    for o in exportObjects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(out/(recipe['id']+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_extras=True)
    drawCalls=glb_draw_calls(out/(recipe['id']+'.glb'))
    triangles=0;textureBytes=0;images=set()
    for o in exportObjects:
      o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
      for m in o.data.materials:
       for node in m.node_tree.nodes:
        if node.type=='TEX_IMAGE' and node.image:images.add(node.image)
    for img in images:textureBytes+=img.size[0]*img.size[1]*4
    result={'id':recipe['id'],'name':recipe['name'],'address':recipe.get('address','Synthetic architectural fixture'),'buildingId':recipe.get('buildingId'),'caseId':recipe.get('caseId'),'synthetic':recipe.get('synthetic',False),'modelUrl':'./models/building-library/'+recipe['id']+'.glb','widthMetres':recipe['frontages'][0]['width'],'depthMetres':max(p[1] for p in recipe['footprint'])-min(p[1] for p in recipe['footprint']),'heightMetres':bounds['max'][2]-bounds['min'][2],'boundsBlenderMetres':bounds,'triangles':triangles,'approxTriangles':triangles,'drawCalls':drawCalls,'textureMemoryBytesRGBA':textureBytes,'textureCount':len(images),'bytes':(out/(recipe['id']+'.glb')).stat().st_size,'geometryRevision':recipe.get('geometryRevision'),'limitations':recipe['assumptions'],'status':'synthetic' if recipe.get('synthetic') else 'unaccepted-evidence-candidate','sourceBundle':None if recipe.get('synthetic') else './models/building-library/evidence/'+recipe['sourceBundle'],'heightEvidence':recipe.get('heightEvidence',[]),'heightChoice':recipe.get('heightChoice'),'shellSource':recipe.get('sourceShell',{}).get('source')}
    if recipe.get('massing'):
        result['massingMode']=recipe['massing']['mode']
        audit=next((o.get('massingAudit') for o in objects if o.get('massingAudit')),None)
        if audit:result['massingAudit']=json.loads(audit)
    result['authoredFrontageBoundsBlenderMetres']=authored_frontage_bounds(recipe)
    placement=recipe.get('placement',{})
    result.update({key:placement[key] for key in ('anchor','xAxisBearingDegrees','frontageLocal','inputFrameDeterminant','axes','sourceRDFrame') if key in placement})
    # Keep original authored objects and source overlay intact.
    for o in exportObjects:bpy.data.objects.remove(o,do_unlink=True)
    return result
