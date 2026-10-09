"""Compare archived baseline scenes against the new roof assembly only.

Blender --background --python scripts/blender/roof_tests/review_roofs_blender.py
Loads foundation scenes without saving over them; writes a dedicated review.
"""
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib.roofs import build_roof

ARTIFACTS = ROOT/'artifacts/building-library'
OUTPUT = ARTIFACTS/'roof-tests'


def roof_geometry():
    rows = []
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH' or 'covering' not in obj.name:
            continue
        for face in obj.data.polygons:
            points = [obj.data.vertices[i].co.copy() for i in face.vertices]
            distances = []
            for i in range(1,len(points)-1):
                vector = (points[i]-points[0]).cross(points[i+1]-points[0])
                if vector.length > 1e-9:
                    vector.normalize()
                    distances = [abs(vector.dot(point-points[0])) for point in points]
                    break
            rows.append({'vertices':len(points),'maxPlaneDistanceM':max(distances,default=0)})
    return {'coveringFaces':len(rows),
            'nonplanarFaces':sum(row['maxPlaneDistanceM']>1e-6 for row in rows),
            'maxPlaneDistanceM':max((row['maxPlaneDistanceM'] for row in rows),default=0)}


def render(recipe,state,view):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 8
    scene.render.resolution_x = 540
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.world.color = (.5,.5,.5)
    camera = scene.camera
    camera.data.type = 'ORTHO'
    width = recipe['frontages'][0]['width']
    depth = max(point[1] for point in recipe['footprint'])
    top = max(recipe['roof']['top'],max(p[1] for p in recipe['gable']['profile']))
    eaves = recipe['roof']['eaves']
    if view == 'front-gable':
        camera.location = (width/2,-25,(eaves+top)/2)
        target = (width/2,0,(eaves+top)/2)
        camera.data.ortho_scale = max(width*1.4,(top-eaves)*1.6,4)
    elif view == 'roof-join':
        camera.location = (width*1.65,-depth*.55,top+width*1.4)
        target = (width*.5,depth*.18,eaves+(top-eaves)*.5)
        camera.data.ortho_scale = max(width*2,depth*.75,6)
    else:
        camera.location = (width*2,depth*.7,top*1.5)
        target = (width*.5,depth*.45,eaves+(top-eaves)*.5)
        camera.data.ortho_scale = max(width*2,depth*1.1,6)
    camera.rotation_euler = (Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath = str(OUTPUT/f'{recipe["id"]}-{state}-{view}.png')
    bpy.ops.render.render(write_still=True)


def main():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    report = []
    for path in sorted((ROOT/'scripts/blender/building_lib/recipes').glob('*.json')):
        recipe = json.loads(path.read_text())
        baseline = ARTIFACTS/f'{recipe["id"]}.blend'
        if not baseline.exists():
            report.append({'id':recipe['id'],'status':'no-archived-baseline-scene'})
            continue
        bpy.ops.wm.open_mainfile(filepath=str(baseline))
        # Foundation .blend saves precede the builder's review render, so they
        # intentionally have no review camera or lights yet.
        width = recipe['frontages'][0]['width']
        top = recipe['roof']['top']
        bpy.ops.object.light_add(type='AREA',location=(width*.2,-8,top+4))
        bpy.context.object.data.energy = 1800
        bpy.context.object.data.size = 8
        bpy.ops.object.light_add(type='AREA',location=(width+5,8,top+1))
        bpy.context.object.data.energy = 1100
        bpy.context.object.data.size = 8
        bpy.ops.object.camera_add()
        bpy.context.scene.camera = bpy.context.object
        before = roof_geometry()
        covering = next(obj for obj in bpy.context.scene.objects if obj.type=='MESH' and 'covering' in obj.name)
        roof_material = covering.data.materials[0]
        wall = next(obj for obj in bpy.context.scene.objects if obj.type=='MESH' and obj.name.startswith('Shell /'))
        wall_material = wall.data.materials[0]
        for view in ('front-gable','roof-join','rear-roof'):
            render(recipe,'before',view)
        for obj in list(bpy.context.scene.objects):
            if obj.name.startswith('Roof /') and 'attached chimney' not in obj.name and 'chimney coping' not in obj.name:
                bpy.data.objects.remove(obj,do_unlink=True)
        build_roof(recipe,roof_material,wall_material)
        after = roof_geometry()
        for view in ('front-gable','roof-join','rear-roof'):
            render(recipe,'after',view)
        bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT/f'{recipe["id"]}-roof-review.blend'))
        report.append({'id':recipe['id'],'before':before,'after':after,
                       'sourceScene':str(baseline.relative_to(ROOT))})
        print('ROOF_COMPARE '+json.dumps(report[-1]),flush=True)
    (OUTPUT/'before-after-planarity.json').write_text(json.dumps(report,indent=2)+'\n')

if __name__ == '__main__':
    main()
