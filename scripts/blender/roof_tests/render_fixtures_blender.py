"""Roof topology fixtures rendered in contrasting neutral materials."""
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib import walls
from building_lib.roofs import build_roof
from check_roofs import fixtures

OUTPUT = ROOT/'artifacts/building-library/roof-tests/fixtures'


def material(name,colour):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*colour,1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*colour,1)
    shader.inputs['Roughness'].default_value = .72
    return result


def main():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    roof = material('Roof fixture / blue slate',(.09,.24,.29))
    wall = material('Roof fixture / ivory facade',(.62,.54,.42))
    for recipe in fixtures():
        for obj in list(bpy.context.scene.objects):
            bpy.data.objects.remove(obj,do_unlink=True)
        walls.shell(recipe,wall)
        walls.facade(6,recipe['gable']['profile'],wall)
        build_roof(recipe,roof,wall)
        bpy.ops.object.light_add(type='AREA',location=(2,-8,17))
        bpy.context.object.data.energy = 2200
        bpy.context.object.data.size = 7
        bpy.ops.object.light_add(type='AREA',location=(11,9,16))
        bpy.context.object.data.energy = 1600
        bpy.context.object.data.size = 9
        bpy.ops.object.camera_add()
        camera = bpy.context.object
        camera.data.type = 'ORTHO'
        scene = bpy.context.scene
        scene.camera = camera
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = 8
        scene.render.resolution_x = 600
        scene.render.resolution_y = 600
        scene.render.resolution_percentage = 100
        scene.world.color = (.5,.5,.5)
        scene.view_settings.view_transform = 'AgX'
        for name,position,target,scale in [('roof',(14,-8,21),(3,4,8),16),('front',(3,-25,9.5),(3,0,9.5),8)]:
            camera.location = position
            camera.rotation_euler = (Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
            camera.data.ortho_scale = scale
            scene.render.filepath = str(OUTPUT/f'{recipe["id"]}-{name}.png')
            bpy.ops.render.render(write_still=True)
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT/f'{recipe["id"]}.blend'))
        (OUTPUT/f'{recipe["id"]}.json').write_text(json.dumps(recipe,indent=2)+'\n')
        print('ROOF_FIXTURE '+recipe['id'],flush=True)

if __name__ == '__main__':
    main()
