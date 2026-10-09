"""Run with Python (profiles) or Blender (through-hole/manifold/raycast checks)."""
import json,math,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from building_lib.apertures import outline,from_spec,contains,validate,validate_layout
from building_lib.polygons import area
from building_lib.ground_floors import storefront_plan,assembly_aperture
try:import bpy
except ImportError:bpy=None

class ApertureProfiles(unittest.TestCase):
 def test_head_shape_has_true_void_without_corner_fill(self):
  p=outline(2,3,2,3,'segmental',.3)
  self.assertTrue(contains(p,(2,3)));self.assertTrue(contains(p,(2,4.49)))
  self.assertFalse(contains(p,(2.99,4.49)));self.assertLess(abs(area(p)),6)
 def test_half_round_is_distinct_from_shallow_segment(self):
  half=outline(2,3,2,3,'rounded');segment=outline(2,3,2,3,'segmental')
  self.assertLess(abs(area(half)),abs(area(segment)))
  self.assertTrue(contains(half,(2,4.49)))
 def test_bad_units_and_unsupported_heads_fail(self):
  for args in [(1,2,0,3),(1,2,1,float('nan'))]:
   with self.assertRaises(ValueError):outline(*args)
  with self.assertRaises(ValueError):outline(1,2,1,2,'pointed')
  with self.assertRaises(ValueError):validate({'x':.2,'z':2,'width':1,'height':2},4)
 def test_storefront_returns_meet_display_and_share_anchor(self):
  p=storefront_plan(5,3,.6,.45,.12,2.8);panels=p['panels']
  self.assertEqual(p['anchor'],2.5);self.assertEqual(panels[0]['end'],panels[1]['start']);self.assertEqual(panels[1]['end'],panels[2]['start']);self.assertEqual(panels[1]['start'][1],.6)
  self.assertEqual(panels[0]['start'][1],0)
  with self.assertRaises(ValueError):storefront_plan(5,3,.6,3)
 def test_silhouette_checks_entire_edges_and_aperture_owners(self):
  boundary=[(0,0),(5,0),(5,7),(3,7),(3,5.5),(2,5.5),(2,7),(0,7)]
  # All four vertices lie in the wall, but its upper edge crosses a notch.
  crossing={'id':'crossing','x':2.5,'z':5.7,'width':3,'height':.4}
  with self.assertRaises(ValueError):validate_layout([crossing],5,boundary)
  rectangular=[(0,0),(5,0),(5,7),(0,7)]
  a={'id':'a','x':1.5,'z':2,'width':2,'height':2}
  b={'id':'b','x':2.5,'z':2,'width':2,'height':2}
  with self.assertRaises(ValueError):validate_layout([a,b],5,rectangular)
 def test_recess_owner_uses_exact_explicit_opening_datums(self):
  spec={'id':'display-owner','x':3,'width':4,'sill':.12,'head':2.8,'recess':.55,'sideReturn':.5}
  aperture=assembly_aperture(spec)
  self.assertAlmostEqual(aperture['z']-aperture['height']/2,.12)
  self.assertAlmostEqual(aperture['z']+aperture['height']/2,2.8)
  self.assertEqual(aperture['x'],spec['x']);self.assertEqual(aperture['width'],spec['width'])
  p=storefront_plan(4,3,.55,.5,.12,2.8,x=1,front_depth=-.035)
  self.assertEqual(p['anchor'],3);self.assertAlmostEqual(p['panels'][1]['start'][1],.515)

@unittest.skipIf(bpy is None,'Run Blender for actual solids/through-holes')
class BlenderApertures(unittest.TestCase):
 def setUp(self):
  for obj in list(bpy.context.scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
  self.material=bpy.data.materials.new('Aperture test masonry');self.material.diffuse_color=(.3,.2,.15,1)
  self.frame=bpy.data.materials.new('Aperture test timber');self.frame.diffuse_color=(.72,.7,.65,1)
  self.glass=bpy.data.materials.new('Aperture test glass');self.glass.diffuse_color=(.03,.07,.07,1)
  self.specs=[{'id':'Rectangular','x':1.2,'z':2,'width':1.2,'height':2,'head':'rectangular','storey':'ground','kind':'window'}, {'id':'Segmental','x':3.8,'z':2,'width':1.2,'height':2,'head':'segmental','archRise':.25,'storey':'ground','kind':'window'}]
 def test_shell_and_finish_have_complete_shared_through_holes(self):
  import bmesh
  from mathutils import Vector
  from building_lib.walls import facade_with_apertures,finish_with_apertures
  from building_lib.layout import SURFACES
  wall=facade_with_apertures(5,[(0,5),(2.5,6),(5,5)],self.material,self.specs)
  finish=finish_with_apertures(5,3.4,self.material,self.specs)
  for obj in (wall,finish):
   for spec in self.specs:
    hit,*_=obj.ray_cast(Vector((spec['x'],-1,spec['z'])),Vector((0,1,0)),distance=2);self.assertFalse(hit,obj.name+' opening still occluded by wall')
   hit,*_=obj.ray_cast(Vector((2.5,-1,2)),Vector((0,1,0)),distance=2);self.assertTrue(hit,obj.name+' lost wall between openings')
   bm=bmesh.new();bm.from_mesh(obj.data);self.assertTrue(all(e.is_manifold for e in bm.edges),obj.name+' promised closed solid is open')
   depth=(SURFACES['shell_back']-SURFACES['shell_front']) if obj==wall else (SURFACES['finish_back']-SURFACES['finish_front'])
   outer=27.5 if obj==wall else 17
   expected=(outer-sum(abs(area(from_spec(o))) for o in self.specs))*depth
   self.assertAlmostEqual(bm.calc_volume(),expected,places=4);bm.free()
 def test_optional_source_shell_preserves_rear_wall_height(self):
  from building_lib.walls import shell_from_source
  recipe=json.loads((Path(__file__).parent/'building_lib/recipes/elandsgracht-96.json').read_text())
  objects=shell_from_source(recipe,self.material)
  expected=max(v[2] for s in recipe['sourceShell']['surfaces'] if s['type']=='wall' for ring in s['rings'] for v in ring)
  actual=max(v.co.z for obj in objects for v in obj.data.vertices)
  self.assertAlmostEqual(actual,expected,places=5)
  self.assertGreater(actual,recipe['roof']['eaves'])
  self.assertTrue(all(max(abs(v.co.y) for v in obj.data.vertices)>.08 for obj in objects))
 def test_recessed_pane_is_inside_wall_and_threshold_matches(self):
  from building_lib.openings import recessed_opening
  from building_lib.layout import SURFACES
  from building_lib.walls import facade_with_apertures,finish_with_apertures
  wall=facade_with_apertures(5,[(0,5),(2.5,6),(5,5)],self.material,self.specs);finish_with_apertures(5,3.4,self.material,self.specs)
  for spec in self.specs:
   result=recessed_opening(spec,self.frame,self.glass,glass_depth=.12)
   self.assertGreater(result['glazingDepth'],SURFACES['shell_front']);self.assertLess(result['glazingDepth'],SURFACES['shell_back']);self.assertEqual(result['thresholdZ'],1)
   pane=bpy.data.objects[spec['id']+' recessed glazing']
   self.assertAlmostEqual(min(v.co.y for v in pane.data.vertices),.12,places=6)
   self.assertAlmostEqual(max(v.co.y for v in pane.data.vertices),.134,places=6)
   sill=bpy.data.objects[spec['id']+' sill'];self.assertAlmostEqual(max(v.co.z for v in sill.data.vertices),1,places=6)
   # The closed wall has generated reveal faces spanning its full depth.
   revealPolygons=[p for p in wall.data.polygons if abs(p.normal.y)<.5]
   self.assertGreater(len(revealPolygons),6)
  out=Path(__file__).resolve().parents[2]/'artifacts/building-library/apertures';out.mkdir(parents=True,exist_ok=True)
  bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(out/'aperture-components.blend'))


 def test_rotated_frontage_has_no_uncut_shell_wall_behind_it(self):
  from mathutils import Vector
  from building_lib.walls import shell
  recipe={'footprint':[(0,0),(6,0),(6,8),(0,8)],'roof':{'eaves':5},'frontages':[
   {'width':6,'origin':[0,0],'rotation':0}, {'width':8,'origin':[6,0],'rotation':math.pi/2}]}
  obj=shell(recipe,self.material)
  # The return facade occupies x=6; shell side x=0 and rear y=8 remain.
  for direction,point in ((Vector((-1,0,0)),Vector((7,4,2))), (Vector((0,1,0)),Vector((3,-1,2)))):
   hit,*_=obj.ray_cast(point,direction,distance=1.5);self.assertFalse(hit,'Shell occludes its authored frontage')
  hit,*_=obj.ray_cast(Vector((-1,4,2)),Vector((1,0,0)),distance=1.5);self.assertTrue(hit,'Unowned side wall was removed')
  hit,*_=obj.ray_cast(Vector((3,9,2)),Vector((0,-1,0)),distance=1.5);self.assertTrue(hit,'Rear wall was removed')
 def test_street_door_clears_wall_finish_and_plinth(self):
  import bmesh
  from mathutils import Vector
  from building_lib.geometry import box
  from building_lib.walls import facade_with_apertures,finish_with_apertures,cut_apertures
  spec={'id':'street-door','x':2.5,'z':1.2,'width':1.1,'height':2.4,'head':'rectangular','storey':'ground','kind':'door'}
  wall=facade_with_apertures(5,[(0,5),(5,5)],self.material,[spec]);finish=finish_with_apertures(5,3.4,self.material,[spec])
  plinth=cut_apertures(box('Door test plinth',2.5,-.055,.18,5,.11,.36,self.material),[spec])
  for obj in (wall,finish,plinth):
   for z in (.001,.18,.359):
    hit,*_=obj.ray_cast(Vector((2.5,-1,z)),Vector((0,1,0)),distance=2);self.assertFalse(hit,obj.name+' blocks street-level threshold')
   bm=bmesh.new();bm.from_mesh(obj.data);self.assertTrue(all(e.is_manifold for e in bm.edges));self.assertGreater(bm.calc_volume(),0);bm.free()
 def test_angled_recess_is_clear_and_glazing_is_closed(self):
  import bmesh
  from mathutils import Vector
  from building_lib.ground_floors import recessed_storefront_from_spec
  from building_lib.walls import facade_with_apertures,finish_with_apertures
  spec={'id':'Synthetic angled shop','x':3,'width':4,'sill':.12,'head':2.8,'recess':.55,'sideReturn':.5}
  aperture=assembly_aperture(spec)
  wall=facade_with_apertures(6,[(0,5),(6,5)],self.material,[aperture]);finish_with_apertures(6,3.4,self.material,[aperture])
  result=recessed_storefront_from_spec(spec,self.frame,self.glass,self.material)
  self.assertEqual(result['anchor'],3);self.assertEqual(result['threshold'],.12)
  hit,*_=wall.ray_cast(Vector((3,-1,1.5)),Vector((0,1,0)),distance=2);self.assertFalse(hit)
  pane=bpy.data.objects[spec['id']+' / display glazing']
  hit,point,*_=pane.ray_cast(Vector((3,-1,1.5)),Vector((0,1,0)),distance=2)
  self.assertTrue(hit);self.assertAlmostEqual(point.y,.508,places=5)
  for obj in bpy.context.scene.objects:
   if obj.name.startswith(spec['id']) and ('glazing' in obj.name or 'frame' in obj.name or 'jamb' in obj.name):
    bm=bmesh.new();bm.from_mesh(obj.data);self.assertTrue(all(e.is_manifold for e in bm.edges),obj.name);self.assertGreater(bm.calc_volume(),0,obj.name);bm.free()
  for label,normal in (('recessed threshold floor',1),('recessed soffit',-1)):
   obj=bpy.data.objects[spec['id']+' / '+label];self.assertAlmostEqual(obj.data.polygons[0].normal.z,normal)
  out=Path(__file__).resolve().parents[2]/'artifacts/building-library/apertures';out.mkdir(parents=True,exist_ok=True)
  bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(out/'recessed-storefront-components.blend'))

if __name__=='__main__':
 suite=unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__]);result=unittest.TextTestRunner(verbosity=2).run(suite)
 if bpy is not None:
  out=Path(__file__).resolve().parents[2]/'artifacts/building-library/apertures';out.mkdir(parents=True,exist_ok=True)
  (out/'checks.json').write_text(json.dumps({'passed':result.wasSuccessful(),'testsRun':result.testsRun,'skipped':len(result.skipped),
   'failures':len(result.failures),'errors':len(result.errors),'contracts':['through apertures','shared finish/plinth cuts','closed manifold slabs','profile-area volume','recessed opaque glazing','street-zero threshold','angled return continuity and outward normals','explicit assembly datums']},indent=2)+'\n')
 if not result.wasSuccessful():sys.exit(1)

