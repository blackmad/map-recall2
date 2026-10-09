"""Closed source roof details and real dormer aperture contracts."""
import sys,json,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
import bpy
from mathutils import Vector
from building_lib.ir import resolve
from building_lib.archetypes import build
from building_lib.source_attachments import dormer_plan
class Geometry(unittest.TestCase):
 def setUp(self):
  self.r=resolve(json.loads((Path(__file__).parent/'building_lib/fixtures/synthetic-source-attachments.json').read_text()))
  with tempfile.TemporaryDirectory() as cache:self.objects=build(self.r,cache)
 def test_posts_are_based_on_two_measured_roof_levels(self):
  posts=[o for o in self.objects if 'supported post' in o.name]
  self.assertTrue(posts)
  for o in posts:self.assertAlmostEqual(min((o.matrix_world@v.co).z for v in o.data.vertices),7.98,places=5)
 def test_dormer_volume_closed_and_has_real_aperture(self):
  p=dormer_plan(self.r,self.r['details']['sourceDormers'][0]);o=bpy.data.objects['lower-wing-dormer / closed cheeks']
  import bmesh
  bm=bmesh.new();bm.from_mesh(o.data);self.assertTrue(all(len(e.link_faces)==2 for e in bm.edges));bm.free()
  w=p['window'];hit,point,_,_=o.ray_cast(Vector((w['x'],p['y']-.2,w['z'])),Vector((0,1,0)))
  self.assertTrue(hit);self.assertGreaterEqual(point.y,p['y']+.28)
  pane=bpy.data.objects[w['id']+' recessed glazing'];self.assertGreater(min((pane.matrix_world@v.co).y for v in pane.data.vertices),p['y']+.1)
 def test_all_created_geometry_has_authored_bounds(self):
  points=[o.matrix_world@v.co for o in self.objects for v in o.data.vertices]
  self.assertGreaterEqual(min(p.z for p in points),-.10)
  self.assertLess(max(p.z for p in points),9.0)
if __name__=='__main__':unittest.main(argv=[sys.argv[0]])
