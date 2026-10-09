"""Circular true-void and clipped-sash contracts; Python or Blender."""
import json,math,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from building_lib.apertures import from_spec,contains
from building_lib.polygons import area
from building_lib.schema import validate
try:import bpy
except ImportError:bpy=None
FIXTURE=Path(__file__).parent/'building_lib/fixtures/synthetic-circular-apertures.json'
class Pure(unittest.TestCase):
 def test_circle_excludes_square_corners_and_has_all_radial_quadrants(self):
  s={'x':2,'z':3,'width':2,'height':2,'head':'circular'};p=from_spec(s)
  self.assertEqual(len(p),24);self.assertTrue(contains(p,(2,3)))
  for x,z in [(2.8,3.8),(1.2,3.8),(1.2,2.2),(2.8,2.2)]:self.assertFalse(contains(p,(x,z)))
  for x,z in p:self.assertAlmostEqual(math.hypot(x-2,z-3),1)
  self.assertAlmostEqual(area(p),12*math.sin(math.pi/12))
 def test_equal_diameter_and_unsupported_joinery_fail_preflight(self):
  base={'x':2,'z':3,'width':2,'height':2,'head':'circular'}
  for change in [{'height':1.9},{'archRise':.2},{'archSegments':8}]:
   with self.assertRaises(ValueError):from_spec(dict(base,**change))
  r=json.loads(FIXTURE.read_text());self.assertEqual(validate(r),[])
  for change in [{'kind':'door'},{'lowerPanel':{'height':.3}},{'warehouse':{'shutters':{}}},{'mullions':[0]},{'transom':1}]:
   q=json.loads(FIXTURE.read_text());q['frontages'][0]['openings'][0].update(change);self.assertTrue(validate(q),change)
@unittest.skipIf(bpy is None,'Blender geometry checks')
class Solids(unittest.TestCase):
 def setUp(self):
  for obj in list(bpy.context.scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
  self.mat=bpy.data.materials.new('test');self.spec={'id':'Oculus','x':2,'z':3,'width':2,'height':2,'head':'circular','kind':'window','storey':'ground','mullions':[.2,.5,.8],'transom':.3}
 def test_through_hole_retains_corners_and_closed_masonry_volume(self):
  import bmesh
  from mathutils import Vector
  from building_lib.walls import facade_with_apertures
  from building_lib.layout import SURFACES
  wall=facade_with_apertures(4,[(0,6),(4,6)],self.mat,[self.spec])
  for x,z in [(2,3),(2.7,3),(2,3.7)]:self.assertFalse(wall.ray_cast(Vector((x,-1,z)),Vector((0,1,0)),distance=2)[0])
  for x,z in [(2.8,3.8),(1.2,2.2)]:self.assertTrue(wall.ray_cast(Vector((x,-1,z)),Vector((0,1,0)),distance=2)[0])
  bm=bmesh.new();bm.from_mesh(wall.data);self.assertTrue(all(e.is_manifold for e in bm.edges))
  self.assertAlmostEqual(abs(bm.calc_volume()),(24-area(from_spec(self.spec)))*(SURFACES['shell_back']-SURFACES['shell_front']),places=5);bm.free()
 def test_closed_recessed_pane_matching_profile_no_rectangular_sill_and_clipped_bars(self):
  import bmesh
  from building_lib.openings import recessed_opening
  recessed_opening(self.spec,self.mat,self.mat,glass_depth=.12)
  pane=bpy.data.objects['Oculus recessed glazing'];bm=bmesh.new();bm.from_mesh(pane.data);self.assertTrue(all(e.is_manifold for e in bm.edges));bm.free()
  for name in ['Oculus outer trim','Oculus jamb profile']:
   obj=bpy.data.objects[name];bm=bmesh.new();bm.from_mesh(obj.data);self.assertTrue(all(e.is_manifold for e in bm.edges));self.assertGreater(bm.calc_volume(signed=True),0,'Frame ring normals must face outward');bm.free()
  self.assertEqual(len([o for o in bpy.context.scene.objects if 'outer trim' in o.name]),1,'Perimeter must be one joined closed ring, not cracked butt-ended beams')
  self.assertAlmostEqual(min(v.co.y for v in pane.data.vertices),.12,places=6)
  self.assertFalse(any('sill' in o.name or 'threshold' in o.name or 'kick panel' in o.name for o in bpy.context.scene.objects))
  pane_profile=from_spec(self.spec)
  for obj in bpy.context.scene.objects:
   if 'recessed mullion' in obj.name or 'sash division' in obj.name:
    for v in obj.data.vertices:self.assertTrue(contains(pane_profile,(v.co.x,v.co.z)),obj.name+' protrudes outside circle')
  offcenter=bpy.data.objects['Oculus recessed mullion'];self.assertLess(max(v.co.z for v in offcenter.data.vertices)-min(v.co.z for v in offcenter.data.vertices),1.65)
 def test_rotated_fixture_all_created_geometry_stays_above_authored_street(self):
  from building_lib.archetypes import build
  r=json.loads(FIXTURE.read_text());r['frontages'][0].update(rotation=.71,origin=[4,7]);objects=build(r,Path('.cache/blender-building-materials'))
  self.assertTrue(objects);self.assertGreaterEqual(min((o.matrix_world@v.co).z for o in objects for v in o.data.vertices),-.01)
  self.assertEqual({o.get('frontageId') for o in objects if 'oculus' in o.name},{'street'})
if __name__=='__main__':unittest.main(argv=[sys.argv[0]])
