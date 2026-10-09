"""Open facade voids, source ownership and closed structural member checks."""
import json,sys,copy,unittest,tempfile,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from building_lib.ir import resolve
from building_lib.schema import validate
from building_lib.open_frames import frame_plan
ROOT=Path(__file__).resolve().parents[2]
def fixture():return resolve(json.loads((Path(__file__).parent/'building_lib/fixtures/synthetic-open-atrium.json').read_text()))
def real():return resolve(json.loads((Path(__file__).parent/'expansion/recipes/bloemstraat-3-5-7.json').read_text()))
class Pure(unittest.TestCase):
 def test_fixture_and_real_preflight(self):self.assertEqual(validate(fixture()),[]);self.assertEqual(validate(real()),[])
 def test_invalid_frame_and_beams_reject(self):
  r=fixture();f=r['frontages'][0];p=f['openFrames'][0]
  for changes in ({'depth':float('nan')},{'pierWidth':5},{'top':20},{'crossBeams':[{'height':7.2,'thickness':-1}]},{'crossBeams':[{'height':7.2,'axis':'depth','xFraction':2}]}):
   with self.assertRaises(ValueError):frame_plan(dict(p,**changes),f,r['roof']['eaves'])
 def test_source_roof_revision_index_and_region_bound(self):
  for changes in ({'geometryRevision':'wrong'},{'surfaceIndices':[11]},{'surfaceIndices':[48,48]}):
   r=real();opening=r['frontages'][0]['openFrames'][0]['sourceRoofOpening'];opening.update(changes);self.assertTrue(validate(r))
  r=real();r['frontages'][0]['openFrames'][0]['depth']=6;self.assertTrue(validate(r))
 def test_source_side_cut_is_exact_audited_and_rejects_arbitrary_wall(self):
  from building_lib.source_massing import compile_source_massing
  r=real();audit=compile_source_massing(r).audit['openFrameSideOwnership'][0]
  self.assertEqual(audit['surfaceIndices'],[13]);self.assertAlmostEqual(audit['removedAreaM2'],8.527005697,places=6)
  self.assertEqual(audit['clippedLocalExtents'][1],[.24,2.8])
  for change in ({'surfaceIndices':[4]},{'surfaceIndices':[11]},{'geometryRevision':'wrong'},{'maxLateralDeviationM':.8},{'provenance':{}}):
   r=real();r['frontages'][0]['openFrames'][0]['sourceSideOpening'].update(change);self.assertTrue(validate(r))
try:import bpy
except ImportError:bpy=None
@unittest.skipUnless(bpy,'Blender geometry checks')
class Geometry(unittest.TestCase):
 def setUp(self):
  from building_lib.archetypes import build
  self.r=fixture()
  with tempfile.TemporaryDirectory() as cache:self.objects=build(self.r,cache)
 def test_open_void_and_no_glazing(self):
  from mathutils import Vector
  wall=bpy.data.objects['Facade / shaped street wall'];hit,*_=wall.ray_cast(Vector((5,-1,8.5)),Vector((0,1,0)));self.assertFalse(hit)
  self.assertFalse(any('open void' in o.name and 'glazing' in o.name for o in self.objects))
 def test_roof_opening_rays_and_closed_frame_members(self):
  from mathutils import Vector
  roof=next(o for o in self.objects if o.name.startswith('Roof / continuous'))
  hit,*_=roof.ray_cast(Vector((5,1.5,11)),Vector((0,0,-1)));self.assertFalse(hit)
  import bmesh
  for o in self.objects:
   if o.get('componentKind')!='open-atrium-frame':continue
   bm=bmesh.new();bm.from_mesh(o.data);self.assertTrue(all(len(e.link_faces)==2 for e in bm.edges));bm.free()
 def test_crossed_front_uprights_have_recessed_faces(self):
  upright=next(o for o in self.objects if 'front interior upright' in o.name)
  bars=[o for o in self.objects if '/ cross beam' in o.name]
  upright_front=min((upright.matrix_world@v.co).y for v in upright.data.vertices)
  for bar in bars:
   bar_front=min((bar.matrix_world@v.co).y for v in bar.data.vertices)
   self.assertGreater(upright_front-bar_front,.04)
 def test_rotated_translated_frame_uses_single_parent(self):
  from building_lib.archetypes import build
  from mathutils import Vector
  names={o.name:[o.matrix_world@v.co for v in o.data.vertices] for o in self.objects if o.get('componentKind')=='open-atrium-frame'}
  r=fixture();r['frontages'][0].update(origin=[3,-2],rotation=.4)
  with tempfile.TemporaryDirectory() as cache:build(r,cache)
  for name,points in names.items():
   obj=bpy.data.objects[name]
   for before,v in zip(points,obj.data.vertices):
    expected=Vector((3+before.x*math.cos(.4)-before.y*math.sin(.4),-2+before.x*math.sin(.4)+before.y*math.cos(.4),before.z));self.assertLess((obj.matrix_world@v.co-expected).length,2e-5)
if __name__=='__main__':unittest.main(argv=[sys.argv[0]])
