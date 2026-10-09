"""Scene isolation and frontage-frame bicycle regressions, run in Blender."""
import copy,json,math,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
import bpy
from mathutils import Vector,Matrix
from building_lib.archetypes import build

BASE=Path(__file__).parent/'building_lib/recipes/synthetic-terrace.json'

class ScenePreflight(unittest.TestCase):
    def test_invalid_neighbor_preserves_existing_scene_before_valid_neighbor(self):
        good=json.loads(BASE.read_text())
        with tempfile.TemporaryDirectory() as cache:
            build(good,cache)
            objects=set(bpy.context.scene.objects)
            invalid=[copy.deepcopy(good) for _ in range(3)]
            invalid[0]['frontages'][0]['openings'][0]['glazingDepth']=.23
            invalid[1]['details']={'dormers':[{'x':30,'y':3,'width':1,'height':1}]}
            invalid[2]['details']={'ridgeCap':True};invalid[2]['roof']['kind']='flat'
            for bad in invalid:
                with self.assertRaisesRegex(ValueError,'Invalid building recipe'):build(bad,cache)
                self.assertEqual(set(bpy.context.scene.objects),objects)
            build(good,cache)
            self.assertTrue(any(o.name.startswith('Facade / shaped') for o in bpy.context.scene.objects))

    def test_bicycle_vertices_follow_translated_rotated_frontage(self):
        recipe=json.loads(BASE.read_text());recipe['details']={'bicycleSign':True}
        with tempfile.TemporaryDirectory() as cache:
            build(recipe,cache)
            def points():
                bpy.context.view_layer.update()
                return {o.name:[o.matrix_world@v.co for v in o.data.vertices] for o in bpy.context.scene.objects
                        if o.type=='MESH' and ('bicycle' in o.name)}
            original=points();self.assertTrue(original)
            recipe['frontages'][0].update(origin=[6,0],rotation=math.pi/2)
            build(recipe,cache);rotated=points()
            frame=Matrix.Translation(Vector((6,0,0)))@Matrix.Rotation(math.pi/2,4,'Z')
            for name,vertices in original.items():
                self.assertEqual(len(vertices),len(rotated[name]))
                for a,b in zip(vertices,rotated[name]):self.assertLess((frame@a-b).length,1e-5)
            self.assertTrue(all(o.get('frontageId')==recipe['frontages'][0]['id'] for o in bpy.context.scene.objects if 'bicycle' in o.name))

if __name__=='__main__':unittest.main(argv=[sys.argv[0]])
