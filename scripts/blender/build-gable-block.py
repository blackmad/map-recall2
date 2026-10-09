"""Editable, deliberately synthetic low-poly Dutch architectural sample block.

Blender --background --python scripts/blender/build-gable-block.py
No real addresses or measurement confidence are attached to these prototypes.
"""
import json,math,sys,time
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib import gables,roof_details,walls
from building_lib.geometry import box,mesh,beam
from building_lib.roofs import build_roof
from building_lib.roof_surfaces import compile_roof
from building_lib.openings import recessed_opening

OUT=ROOT/'public/canal-drive/models/gable-block'
ART=ROOT/'artifacts/gable-block'


def material(name,hexcolour):
    colour=tuple(int(hexcolour[i:i+2],16)/255 for i in (0,2,4))
    # Blender expects linear node colours; preserve a predictable matte palette.
    colour=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in colour)
    mat=bpy.data.materials.new(name);mat.diffuse_color=(*colour,1);mat.use_nodes=True
    shader=mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(*colour,1)
    shader.inputs['Roughness'].default_value=.86
    return mat


SAMPLES=[
 {'id':'stepped-house','label':'Stepped gable','family':'stepped','width':4.8,'depth':7.5,'eaves':9.2,'rise':3.0,'brick':'8e4939','roof':'tile','roofRise':2.05,'ground':'residential'},
 {'id':'bell-house','label':'Bell gable','family':'bell','width':4.5,'depth':7.8,'eaves':10.2,'rise':3.0,'brick':'b89870','roof':'slate','roofRise':1.3,'ground':'shop'},
 {'id':'neck-house','label':'Neck gable','family':'neck','width':4.4,'depth':7.2,'eaves':9.4,'rise':3.2,'brick':'643e3b','roof':'tile','roofRise':1.45,'ground':'residential'},
 {'id':'triangle-house','label':'Triangular gable','family':'triangular','width':4.6,'depth':8.3,'eaves':10.0,'rise':2.6,'brick':'9a6754','roof':'slate','roofRise':2.48,'ground':'shop'},
 {'id':'cornice-terrace','label':'Straight cornice terrace','family':'straight','width':5.2,'depth':7.5,'eaves':9.2,'rise':2.2,'brick':'a57d59','roof':'tile','roofRise':1.8,'ground':'residential'},
 {'id':'mansard-house','label':'Mansard with dormers','family':'mansard','width':5.8,'depth':8.2,'eaves':10.6,'rise':2.4,'brick':'765952','roof':'slate','ground':'shop'},
 {'id':'hip-corner','label':'Hip roof residence','family':'hip','width':5.8,'depth':7.8,'eaves':9.8,'rise':2.5,'brick':'bd9d78','roof':'tile','ground':'residential'},
 {'id':'gambrel-warehouse','label':'Gambrel warehouse','family':'gambrel','width':6.2,'depth':9.3,'eaves':8.1,'rise':3.2,'brick':'8a4c3b','roof':'slate','ground':'warehouse'},
]


def opening_spec(name,x,z,w,h,storey='upper',door=False,head='rectangular'):
    return {'id':name,'x':x,'z':z,'width':w,'height':h,'storey':storey,
            'kind':'door' if door else 'window','head':head,'mullions':[] if door else [.5],'transom':.47,'archSegments':8}


def build(sample,palette,xoffset,index):
    before=set(bpy.context.scene.objects);w,d,e=sample['width'],sample['depth'],sample['eaves'];family=sample['family']
    facade_family=family if family not in ('mansard','hip') else 'straight'
    profile=gables.profile(facade_family,w,e,sample['rise'])
    brick=material('Brick / '+sample['id'],sample['brick'])
    roof=palette[sample['roof']];cream=palette['cream'];glass=palette['glass'];iron=palette['iron'];green=palette['green']
    spec={'kind':'pitched','eaves':e,'top':e+sample.get('roofRise',sample['rise']),
          'setback':.24,'gableClearance':.06,'frontTransition':1,'status':'synthetic'}
    if family=='gambrel':spec.update(kind='gambrel',kneeSpan=[w*.18,w*.82],kneeHeight=e+sample['rise']*.72,top=e+sample['rise']-.04)
    if family=='hip':spec.update(kind='hip',hipEndRun=2.5)
    if family=='mansard':spec.update(kind='mansard',kneeInset=.72,topInset=1.35,kneeHeight=e+sample['rise']*.76)
    recipe={'id':sample['id'],'synthetic':True,'footprint':[[0,0],[w,0],[w,d],[0,d]],
            'frontages':[{'width':w,'origin':[0,0]}],'roof':spec,'gable':{'profile':profile}}
    walls.shell(recipe,brick)
    openings=[];ground=sample['ground'];groundtop=2.7
    bays=3 if w>5.5 else 2
    for row in range(2 if family=='gambrel' else 3):
        z=groundtop+(e-groundtop)*(row+.5)/(2 if family=='gambrel' else 3)
        for bay in range(bays):
            openings.append(opening_spec('Window / %d-%d'%(row,bay),w*(bay+1)/(bays+1),z,.94 if bays==3 else 1.08,1.50 if family=='gambrel' else 1.6,
                                         head='segmental' if family in ('stepped','bell') else 'rectangular'))
    if ground=='residential':
        openings += [opening_spec('Entry / panelled door',w*.25,1.22,.87,2.44,'ground',True),
                     opening_spec('Ground / sash window',w*.69,1.45,1.50,1.72,'ground')]
    elif ground=='shop':
        openings += [opening_spec('Shop / display',w*.39,1.32,w*.48,2.2,'ground'),
                     opening_spec('Shop / entry',w*.79,1.22,.90,2.44,'ground',True)]
    else:
        openings += [opening_spec('Warehouse / loading door',w*.5,1.30,2.6,2.6,'ground',True)]
    # Attic light stays inside the narrow silhouette rather than using a roof bbox.
    if family in ('stepped','neck','triangular','bell','gambrel'):
        openings.append(opening_spec('Attic / window',w*.5,e+sample['rise']*.48,.65,.83,'attic'))
    facade=walls.facade_with_apertures(w,profile,brick,openings)
    for item in openings:
        recessed_opening(item,green if item['kind']=='door' else cream,glass,palette['brass'],glass_depth=.10)
    # Foundation, horizontal cornice and subtle corner quoins unify the block.
    plinth=box('Facade / stone plinth',w/2,-.09,.16,w,.16,.32,palette['stone'])
    walls.cut_apertures(plinth,[item for item in openings if item['storey']=='ground'])
    box('Facade / string course',w/2,-.07,groundtop,w+.06,.16,.105,cream)
    if facade_family=='straight':
        box('Facade / deep cornice',w/2,-.05,e-.04,w+.14,.35,.22,cream)
        box('Facade / cornice fascia',w/2,-.17,e-.25,w+.08,.10,.10,cream)
    else:gables.coping(profile,cream,.105,.35)
    if ground=='shop':
        for px in (.09,w-.09):box('Shop / timber pilaster',px,-.12,1.35,.15,.16,2.7,green)
        box('Shop / blank fascia',w/2,-.14,2.52,w-.17,.16,.29,green)
    if family=='mansard':
        surface=roof_details.mansard(w,d,e,sample['rise'],roof)
        for px in (w*.29,w*.71):roof_details.dormer(surface,px,.63,1.05,1.23,cream,roof,cream,glass)
    else:
        build_roof(recipe,roof,brick);surface=compile_roof(recipe)
        covering=next(o for o in set(bpy.context.scene.objects)-before if o.name.startswith('Roof / continuous'))
        roof_details.thicken_covering(covering)
        if family!='hip':roof_details.ridge_cap(w/2,.42,d-.05,spec['top'],roof)
        else:roof_details.ridge_cap(w/2,.24+2.5,d-2.5,spec['top'],roof)
    roof_details.gutters(w,d,e,iron)
    if family not in ('mansard','gambrel'):
        roof_details.chimney(surface,w*.77,d*.71,brick,cream,height=.65)
    # The two block ends and the exposed corner residence get return windows.
    if index in (0,6,7):
        for yy in (d*.28,d*.65):
            for zz in (4.1,6.6):
                box('Return / glazing',w+.012,yy,zz,.03,1.00,1.40,glass)
                for z in (zz-.73,zz+.73):box('Return / horizontal frame',w+.045,yy,z,.07,1.14,.075,cream)
                for y in (yy-.54,yy,yy+.54):box('Return / vertical frame',w+.045,y,zz,.07,.07,1.50,cream)
    children=set(bpy.context.scene.objects)-before
    parent=bpy.data.objects.new(sample['id'],None);bpy.context.collection.objects.link(parent)
    parent.location.x=xoffset;parent['family']=family;parent['synthetic']=True
    for obj in children:obj.parent=parent;obj['buildingId']=sample['id'];obj['synthetic']=True
    bpy.context.view_layer.update()
    bounds=[obj.matrix_world@Vector(corner) for obj in children if obj.type=='MESH' for corner in obj.bound_box]
    return {'id':sample['id'],'label':sample['label'],'family':family,'x':xoffset,'width':w,'depth':d,
            'height':max(point.z for point in bounds)-min(point.z for point in bounds),'parameters':sample,'roofSpec':spec,'gableProfile':profile,
            'synthetic':True,'status':'synthetic visual prototype'}


def render(width,view):
    scene=bpy.context.scene;scene.render.resolution_x=1800;scene.render.resolution_y=850;scene.render.resolution_percentage=100
    camera=scene.camera;camera.data.type='ORTHO';camera.data.ortho_scale=width*1.10
    if view=='front':position=(width/2,-50,8);target=(width/2,3,7)
    elif view=='roof':position=(width*.65,-22,43);target=(width/2,3.5,5.6)
    else:position=(width*.73,-35,24);target=(width/2,3.5,6)
    camera.location=position;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(ART/(view+'.png'));bpy.ops.render.render(write_still=True)


def main():
    started=time.monotonic();OUT.mkdir(parents=True,exist_ok=True);ART.mkdir(parents=True,exist_ok=True)
    for obj in list(bpy.context.scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
    palette={name:material(name,c) for name,c in {'cream':'e5dfcc','glass':'86a9b0','iron':'4b5a60','stone':'a5a092',
      'green':'405e55','brass':'a99860','tile':'a2573d','slate':'43515d','ground':'cec8b8'}.items()}
    rows=[];x=0
    for index,sample in enumerate(SAMPLES):
        rows.append(build(sample,palette,x,index));x+=sample['width']+.12
        print('BLOCK_BUILD '+sample['id'],flush=True)
    # A minimal paving plinth gives context while leaving every facade visible.
    box('Block / pavement',x/2,3.6,-.18,x+.8,10.5,.30,palette['ground'])
    bpy.context.view_layer.update()
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    triangles=0
    for obj in objects:obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
    bpy.ops.object.light_add(type='AREA',location=(x*.35,-14,32));bpy.context.object.data.energy=5500;bpy.context.object.data.size=22
    bpy.ops.object.light_add(type='AREA',location=(x*.85,11,24));bpy.context.object.data.energy=3500;bpy.context.object.data.size=18
    bpy.ops.object.camera_add();bpy.context.scene.camera=bpy.context.object
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
    scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.72,.77,.81,1)
    scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.65
    scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
    scene.render.film_transparent=False
    bpy.context.preferences.filepaths.save_version=0
    # Save the editable source before making temporary export copies.
    scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=x*1.10
    scene.camera.location=(x*.73,-35,24)
    scene.camera.rotation_euler=(Vector((x/2,3.5,6))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.wm.save_as_mainfile(filepath=str(ART/'block.blend'))
    copies=[];exports=[];export_parents=[];groups={}
    for original in objects:
        building_id=original.get('buildingId','block-pavement')
        key=(building_id,original.data.materials[0].name)
        # Preserve world coordinates before removing the inherited parent.
        world=original.matrix_world.copy()
        duplicate=original.copy();duplicate.data=original.data.copy()
        bpy.context.collection.objects.link(duplicate)
        duplicate.parent=None;duplicate.matrix_world=world
        groups.setdefault(key,[]).append(duplicate);copies.append(duplicate)
    parents={}
    for building_id in sorted({key[0] for key in groups}):
        parent=bpy.data.objects.new(building_id+' / export',None)
        bpy.context.collection.objects.link(parent);parents[building_id]=parent
        parent['buildingId']=building_id;parent['synthetic']=True;export_parents.append(parent)
    counts={}
    for (building_id,material_name),group in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in group:obj.select_set(True)
        bpy.context.view_layer.objects.active=group[0]
        if len(group)>1:bpy.ops.object.join()
        joined=group[0];joined.name=building_id+' / '+material_name
        world=joined.matrix_world.copy();joined.parent=parents[building_id];joined.matrix_world=world
        exports.append(joined);counts[building_id]=counts.get(building_id,0)+1
    for row in rows:row['drawCalls']=counts[row['id']]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in exports+export_parents:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/'block.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True)
    for obj in exports+export_parents:bpy.data.objects.remove(obj,do_unlink=True)
    for view in ('three-quarter','front','roof'):render(x,view)
    report={'id':'gable-block','name':'Synthetic Dutch gable study','synthetic':True,'buildings':rows,'triangles':triangles,'drawCalls':len(groups),
            'bytes':(OUT/'block.glb').stat().st_size,'width':x,'buildSeconds':time.monotonic()-started,
            'modelUrl':'./models/gable-block/block.glb','editableScene':'artifacts/gable-block/block.blend',
            'limitations':['Synthetic architecture, not measured Amsterdam buildings','Matte low-poly material study',
              'Opaque glazing fallback','Side windows are illustrative; front windows are through apertures']}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    (ART/'recipes.json').write_text(json.dumps(rows,indent=2)+'\n')
    print('BLOCK_COMPLETE '+json.dumps({'triangles':triangles,'bytes':report['bytes'],'seconds':report['buildSeconds']}),flush=True)


if __name__=='__main__':main()
