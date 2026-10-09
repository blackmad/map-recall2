"""Actual aperture rays, retained wings and transformed source-derived shells."""
import copy,json,math,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
import bpy
from mathutils import Vector,Matrix
from building_lib.archetypes import build,source_overlay

FIXTURE=Path(__file__).parent/'building_lib/fixtures/synthetic-source-compound.json'

class SourceSceneContracts(unittest.TestCase):
    def test_owned_apertures_unblocked_and_wing_retained_in_both_frames(self):
        original=json.loads(FIXTURE.read_text())
        for rotated in (False,True):
            recipe=copy.deepcopy(original);frame=Matrix.Identity(4)
            if rotated:
                frame=Matrix.Translation(Vector((-7,-3,0)))@Matrix.Rotation(math.pi/2,4,'Z')
                recipe['footprint']=[list((frame@Vector((*p,0)))[:2]) for p in recipe['footprint']]
                for s in recipe['sourceShell']['surfaces']:s['rings']=[[list(frame@Vector(p)) for p in ring] for ring in s['rings']]
                recipe['frontages'][0].update(origin=[-7,-3],rotation=math.pi/2)
            with tempfile.TemporaryDirectory() as cache:objects=build(recipe,cache)
            bpy.context.view_layer.update()
            def ray(obj,x,z):
                origin=frame@Vector((x,-1,z));direction=frame.to_3x3()@Vector((0,1,0));inverse=obj.matrix_world.inverted()
                return obj.ray_cast(inverse@origin,inverse.to_3x3()@direction,distance=1.6)[0]
            slabs=[o for o in objects if o.name.startswith(('Massing / source-derived wall','Facade / shaped','Ground / finish'))]
            for opening in recipe['frontages'][0]['openings']:
                self.assertFalse(any(ray(o,opening['x'],opening['z']) for o in slabs))
            self.assertTrue(any(ray(o,-1,2) for o in slabs),'Unowned wing was lost')
            roofs=[o for o in objects if o.name.startswith('Massing / source-derived roof')]
            self.assertEqual(len(roofs),2)
            self.assertEqual({round(v.co.z,6) for o in roofs for v in o.data.vertices},{4,8})
            self.assertTrue(all(o.get('sourceDerived') for o in roofs))
            source_overlay(recipe)
            self.assertTrue(any(o.get('sourceOnly') for o in bpy.context.scene.objects))
            self.assertFalse(any(o.get('sourceOnly') for o in objects))

if __name__=='__main__':unittest.main(argv=[sys.argv[0]])
