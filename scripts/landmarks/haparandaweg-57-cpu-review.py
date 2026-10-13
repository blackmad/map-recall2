"""CPU source-facing preflight; native/gallery/live acceptance remains pending."""
import bpy,json,math,pathlib
from mathutils import Vector
root=pathlib.Path.cwd();out=root/'artifacts/haparandaweg-57';fp=json.load(open(root/'scripts/landmarks/haparandaweg-57-footprints.json'))
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(out/'haparandaweg-57-uncompressed.glb'))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.render.threads_mode='FIXED';scene.render.threads=4;scene.render.resolution_x=1600;scene.render.resolution_y=1050;scene.render.resolution_percentage=100;scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.world=bpy.data.worlds.new('neutral');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.68,.68,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.8
bpy.ops.mesh.primitive_plane_add(size=100,location=(0,0,-.04));mat=bpy.data.materials.new('stage');mat.diffuse_color=(.63,.64,.60,1);bpy.context.object.data.materials.append(mat)
bpy.ops.object.light_add(type='AREA',location=(-15,-25,35));bpy.context.object.data.energy=5000;bpy.context.object.data.size=25
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='PERSP';cam.data.lens=36/(2*math.tan(math.radians(70/2)))
for name in ['south2021','east2021']:
 m=json.load(open(out/'raw'/f'{name}-metadata.json'));ll=m['geometry']['coordinates'];cx=(ll[0]-fp['anchor'][0])*111320*math.cos(math.radians(fp['anchor'][1]));cz=(fp['anchor'][1]-ll[1])*111320;heading=math.atan2(-cx,cz);cam.location=(cx,-cz,2.3);direction=Vector((math.sin(heading)*math.cos(math.radians(8)),math.cos(heading)*math.cos(math.radians(8)),math.sin(math.radians(8))));cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/f'cpu-{name}.png');bpy.ops.render.render(write_still=True)
for name,pos,target in [('higher',(55,-65,40),(0,0,3)),('opposite',(-55,65,25),(0,0,3))]:
 cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=42;scene.render.filepath=str(out/f'cpu-{name}.png');bpy.ops.render.render(write_still=True)
(out/'cpu-review-state.json').write_text(json.dumps({'renderer':'Blender Cycles CPU12samples','assetScope':'uncompressed original candidate matching meshopt builder geometry','sourceFacing':['south2021','east2021'],'limits':'No neighboring geometry/source image pixels. CPU preflight only; actual native/source/gallery/live/exact suppression/neighbor/performance review pending.'},indent=2))
