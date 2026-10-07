"""Render decoded exact compressed candidate; CPU preflight, not game acceptance."""
import bpy,json,math,pathlib,hashlib
from mathutils import Vector
root=pathlib.Path.cwd();out=root/'artifacts/electric-ladyland'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(out/'electric-ladyland-decoded.glb'))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=12;s.render.threads_mode='FIXED';s.render.threads=4;s.render.resolution_x=1400;s.render.resolution_y=1050;s.render.resolution_percentage=100;s.view_settings.view_transform='Standard';s.view_settings.look='None';s.world=bpy.data.worlds.new('neutral');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.68,.70,.73,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.8
bpy.ops.mesh.primitive_plane_add(size=100,location=(0,0,-.03));mat=bpy.data.materials.new('pavement');mat.diffuse_color=(.51,.51,.48,1);bpy.context.object.data.materials.append(mat)
bpy.ops.object.light_add(type='AREA',location=(-10,-20,28));bpy.context.object.data.energy=3200;bpy.context.object.data.size=20
bpy.ops.object.camera_add();cam=bpy.context.object;s.camera=cam;cam.data.type='PERSP';cam.data.lens=35
views=[('full-front',(4,-29,7),(4,-1,6)),('north-oblique',(-11,-20,6),(4,-1,5.5)),('south-oblique',(24,-20,6),(4,-1,5.5)),('lower-front',(4,-18,2.5),(4,-4.85,2.3)),('roof-rear',(22,19,22),(4,1,7))]
for name,pos,target in views:
 cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(out/f'cpu-{name}.png');bpy.ops.render.render(write_still=True)
state={'candidateSha256':hashlib.sha256((out/'electric-ladyland.glb').read_bytes()).hexdigest(),'renderer':'Blender Cycles CPU12samples exact meshopt-decoded candidate','axes':'Builder X along north to south facade; +Z toward street. Blender imported X=X, Y=-Z, Z=height. Model rotates -70.147 degrees into East/South for map placement.','views':[{'name':n,'blenderCamera':p,'blenderTarget':t,'lensMM':35} for n,p,t in views],'limits':'Editorial source views are composition comparisons, not calibrated camera matches. Neutral pavement Y-up datum0 matches visible basement minimum; not surveyed NAP. No neighbor geometry. Gallery/native/live/performance pending.'}
(out/'cpu-review-state.json').write_text(json.dumps(state,indent=2)+'\n')
