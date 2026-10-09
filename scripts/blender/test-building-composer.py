"""Blender integration contracts for common recipe composition and source edges."""
import json,sys,unittest,tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
import bpy
from mathutils import Vector,Matrix
from building_lib.archetypes import build
from building_lib.schema import validate
from building_lib.walls import _uncovered_edge_segments

ROOT=Path(__file__).resolve().parents[2]

def frontage_ray(obj,front,x,z,distance=1.5):
    angle=front.get('rotation',0)
    frame=Matrix.Translation(Vector((*front['origin'],0)))@Matrix.Rotation(angle,4,'Z')
    origin=frame@Vector((x,-1,z));direction=frame.to_3x3()@Vector((0,1,0))
    inverse=obj.matrix_world.inverted()
    return obj.ray_cast(inverse@origin,inverse.to_3x3()@direction,distance=distance)[0]

class ComposerContracts(unittest.TestCase):
 def test_shell_end_caps_do_not_duplicate_facade(self):
  f={'origin':[0,0],'width':5}
  self.assertEqual(_uncovered_edge_segments((5,0),(5,8),[f]),[((5,.24),(5,8))])
  f={'origin':[4,2],'width':5,'rotation':1.5707963267948966}
  parts=_uncovered_edge_segments((4,7),(-4,7),[f])
  self.assertAlmostEqual(parts[0][0][0],3.76)
  self.assertEqual(parts[0][1],(-4,7))
 def test_crossing_street_edge_preserves_only_unowned_wings(self):
  f={'origin':[0,0],'width':5}
  parts=_uncovered_edge_segments((-3,-.02),(8,-.02),[f])
  self.assertEqual(len(parts),2)
  self.assertEqual(parts[0][0],(-3,-.02));self.assertAlmostEqual(parts[0][1][0],0)
  self.assertAlmostEqual(parts[1][0][0],5);self.assertEqual(parts[1][1],(8,-.02))
  reverse=_uncovered_edge_segments((8,-.02),(-3,-.02),[f])
  self.assertEqual(len(reverse),2)
  self.assertAlmostEqual(reverse[0][1][0],5)
 def test_recipes_cut_frontage_and_shell_with_object_local_rays(self):
  paths=sorted((Path(__file__).parent/'building_lib/recipes').glob('*.json'))
  paths.append(Path(__file__).parent/'expansion/recipes/lauriergracht-37.json')
  with tempfile.TemporaryDirectory() as cache:
   for path in paths:
    recipe=json.loads(path.read_text())
    with self.subTest(recipe=recipe['id']):
     self.assertEqual(validate(recipe),[]);build(recipe,cache);bpy.context.view_layer.update()
     self.assertFalse(any(o.name.startswith('CUTTER') for o in bpy.context.scene.objects))
     shell=next(o for o in bpy.context.scene.objects if o.name=='Shell / side and rear walls')
     for front in recipe['frontages']:
      slabs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('frontageId')==front['id'] and o.name.startswith(('Facade / shaped','Ground / finish','Ground / stone plinth'))]
      self.assertEqual(len(slabs),3)
      for opening in front['openings']:
       for slab in slabs+[shell]:
        self.assertFalse(frontage_ray(slab,front,opening['x'],opening['z']), (path.name,slab.name,opening['id']))
      # A control ray through solid facade masonry must actually hit it.
      facade=next(o for o in slabs if o.name.startswith('Facade / shaped'))
      self.assertTrue(frontage_ray(facade,front,.02,recipe['roof']['eaves']*.95),path.name+' missing control wall')
     if recipe['id']=='lauriergracht-37':
      self.assertTrue(frontage_ray(shell,recipe['frontages'][0],-2,5),'Unowned left wing was removed')
if __name__=='__main__':unittest.main(argv=[sys.argv[0]])
