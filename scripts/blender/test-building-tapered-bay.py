"""Optional bay soffit keeps wall support, closed volume and clear apertures."""
import json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib.ir import resolve
from building_lib.schema import validate
from building_lib.grouped_bays import bay_plan
P=ROOT/'scripts/blender/building_lib/fixtures/grouped-bays/tapered-soffit.json'
class Contracts(unittest.TestCase):
 def test_default_flat_and_tapered_bounds(self):
  r=resolve(json.loads(P.read_text()));self.assertEqual(validate(r),[]);front=r['frontages'][0]
  self.assertEqual(bay_plan(front['groupedBays'][1],front,9)['baseRise'],0)
  for rise in [-.1,True,float('nan'),.50,2]:
   front['groupedBays'][0]['baseRise']=rise;self.assertTrue(validate(r),rise)
if __name__=='__main__':
 result=unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(Contracts))
 if not result.wasSuccessful():raise SystemExit(1)
 try:import bpy
 except ImportError:pass
 else:
  import bmesh
  from mathutils import Vector
  from mathutils.bvhtree import BVHTree
  from building_lib.archetypes import build
  r=resolve(json.loads(P.read_text()));objects=build(r,ROOT/'artifacts/tapered-bay-fixture/textures')
  shell=next(o for o in objects if o.get('componentId')=='left-stack' and 'continuous projecting masonry' in o.name)
  bm=bmesh.new();bm.from_mesh(shell.data);assert all(e.is_manifold for e in bm.edges) and bm.calc_volume(signed=True)>0;bm.free()
  verts=[v.co for v in shell.data.vertices]
  assert any(abs(v.y+.035)<1e-6 and abs(v.z-3)<1e-6 for v in verts),'Rear soffit must meet the original wall at bottom datum'
  assert any(abs(v.y+.6)<1e-6 and abs(v.z-3.3)<1e-6 for v in verts),'Front soffit must rise without a detached horizontal slab'
  tree=BVHTree.FromObject(shell,bpy.context.evaluated_depsgraph_get())
  hit=tree.ray_cast(Vector((2,-.3175,2)),Vector((0,0,1)),2)[0]
  assert hit is not None and abs(hit.z-3.15)<2e-6,'Underside must be one supported planar slope'
  assert tree.ray_cast(Vector((2,-2,4.5)),Vector((0,1,0)),3)[0] is None,'Opening must stay clear through tapered volume'
  print('TAPERED_BAY_BLENDER_RESULT 5 checks pass')
