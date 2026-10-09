"""Architectural contract checks without Blender."""
import json,math,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from building_lib.frames import FacadeFrame
from building_lib.layout import solve_storeys,SURFACES,validate_surfaces
from building_lib.schema import validate
from building_lib.polygons import triangulate,area
from building_lib.materials import maps,entries
ROOT=Path(__file__).resolve().parents[2]
RECIPES=Path(__file__).parent/'building_lib/recipes'

class BuildingContracts(unittest.TestCase):
 def test_facade_frame_roundtrip_and_explicit_handedness(self):
  f=FacadeFrame.from_frontage([3,5],[7,8],[3,9])
  for p in ([3,5],[7,8],[1,2]):
   for a,b in zip(f.world(f.local(p)),p):self.assertAlmostEqual(a,b)
  self.assertAlmostEqual(abs(f.determinant),1)
  self.assertAlmostEqual(f.local([7,8])[0],5)
 def test_asymmetric_storeys_close_without_moving_ground(self):
  floors=solve_storeys(3.2,10.2,heights=[2,3,2]);self.assertEqual([f['top'] for f in floors],[3.2,5.2,8.2,10.2]);self.assertEqual(floors[1]['id'],'upper_1')
  with self.assertRaises(ValueError):solve_storeys(3,8,heights=[2,2])
 def test_surface_stack_keeps_finish_visible_behind_glass(self):
  validate_surfaces();self.assertLess(SURFACES['finish_front'],SURFACES['shell_front']);self.assertLess(SURFACES['glass'],SURFACES['finish_front']);self.assertAlmostEqual((SURFACES['finish_front']+SURFACES['finish_back'])/2,-.0475)
  with self.assertRaises(ValueError):validate_surfaces({**SURFACES,'finish_front':-.035})
 def test_actual_concave_footprints_preserve_area(self):
  concave=0
  for p in RECIPES.glob('*.json'):
   recipe=json.loads(p.read_text());r=recipe['footprint'];tris=triangulate(r);a=sum(abs(area([r[i] for i in t])) for t in tris)
   self.assertAlmostEqual(a,abs(area(r)),places=6,msg=p.name);self.assertEqual(len(tris),len(r)-2)
   if len(r)>4:concave+=1
  self.assertGreater(concave,0)
 def test_bad_polygon_and_unsupported_holes_rejected(self):
  with self.assertRaises(ValueError):triangulate([[0,0],[2,2],[0,2],[2,0]])
  r=json.loads((RECIPES/'synthetic-terrace.json').read_text());r['holes']=[[[1,1],[2,1],[2,2]]];self.assertTrue(validate(r))
 def test_optional_shop_joinery_rejected_before_build(self):
  for field,values,message in (
    ('transomArch',(None,{}, {'rise':0},{'rise':float('nan')},{'rise':10},{'rise':True}), 'Transom arch'),
    ('lowerPanel',(None,{}, {'height':0},{'height':float('inf')},{'height':10},{'height':True}), 'Lower panel')):
   for value in values:
    with self.subTest(field=field,value=value):
     r=json.loads((RECIPES/'rozengracht-158.json').read_text())
     o=next(o for o in r['frontages'][0]['openings'] if o['id']=='Shop ground:window-1');o[field]=value
     self.assertTrue(any(message in e for e in validate(r)))
  r=json.loads((RECIPES/'rozengracht-158.json').read_text())
  o=next(o for o in r['frontages'][0]['openings'] if o['id']=='Shop ground:window-1');o['transom']=None
  self.assertTrue(any('Transom arch' in e for e in validate(r)))
 def test_source_rd_metadata_rejects_mismatched_or_invalid_frames(self):
  original=json.loads((Path(__file__).parent/'expansion/recipes/rozengracht-114.json').read_text())
  for field,value in (('anchorRD',[float('nan'),0]),('xAxisRD',[2,0]),('yAxisRD',[0,1]),('buildingId','other-owner'),('geometryRevision','stale')):
   r=json.loads(json.dumps(original));r['placement']['sourceRDFrame'][field]=value
   self.assertTrue(any('Source RD' in e for e in validate(r)),(field,value))

 def test_four_leaf_shop_options_validate(self):
  original=json.loads((Path(__file__).parent/'expansion/recipes/rozengracht-114.json').read_text())
  self.assertEqual(validate(original),[])
  for field,values in (('divisions',([.5,.25],[0],[1],[float('nan')],[.01],None)),('louvreCount',(-1,33,True,2.5))):
   for value in values:
    r=json.loads(json.dumps(original));r['frontages'][0]['openings'][-1]['lowerPanel'][field]=value
    self.assertTrue(validate(r),(field,value))
  for value in ([0],[1],[float('nan')],None):
   r=json.loads(json.dumps(original));r['frontages'][0]['openings'][-1]['handleFractions']=value
   self.assertTrue(validate(r),value)
 def test_recipes_floor_containment_and_corrections(self):
  for p in RECIPES.glob('*.json'):self.assertEqual(validate(json.loads(p.read_text())),[],p.name)
  b=json.loads((RECIPES/'rozengracht-212.json').read_text());f=b['frontages'][0];w=f['width'];ground=[o for o in f['openings'] if o['storey']=='ground'];self.assertAlmostEqual(next(o['x'] for o in ground if o['kind']=='window'),w/2)
  self.assertTrue(all(abs(s['x']-w/2)<1e-8 for s in f['storefront']['signs']))
  self.assertEqual(sorted(round(o['x']/w,2) for o in ground if o['kind']=='door'),[.16,.84])
  for r in [json.loads(p.read_text()) for p in RECIPES.glob('*.json')]:
   floors=[f for f in r['storeys'] if f['id'].startswith('upper')];heights=[f['top']-f['bottom'] for f in floors];self.assertLess(max(heights)-min(heights),1e-7)
  k=json.loads((RECIPES/'elandsgracht-96.json').read_text());self.assertGreater(k['roof']['eaves'],15.17);self.assertLess(k['roof']['eaves'],15.20);self.assertEqual(len(k['gable']['profile']),2);self.assertEqual(len([o for o in k['frontages'][0]['openings'] if o['storey'].startswith('upper')]),6)
  self.assertLess(k['roof']['eaves'],k['heightChoice']['surfaceRange'])
 def test_evidence_capture_years_do_not_double_count_crops(self):
  k=json.loads((ROOT/'public/canal-drive/models/building-library/evidence/elandsgracht-96.json').read_text());self.assertTrue({'2024','2025'} <= {y['year'] for y in k['coverage']})
  for year in k['coverage']:
   for region in ('ground','upper','roof'):self.assertGreaterEqual(len(year[region]['captures']),1);self.assertEqual(year[region]['registered'],0)
  self.assertEqual(k['featureProposals'],[])
  self.assertGreaterEqual(len(k['derived']),6)
 def test_material_cache_portable_maps_and_variants(self):
  spec=next(m for m in entries() if m['id']=='redbrick')
  with tempfile.TemporaryDirectory() as t:
   paths,h,hit=maps(spec,t);self.assertFalse(hit)
   paths2,h2,hit2=maps(spec,t);self.assertTrue(hit2);self.assertEqual(h,h2)
   self.assertTrue(all(p.read_bytes().startswith(b'\x89PNG') for p in paths.values()))
   _,variant,_=maps({**spec,'baseColour':'#998877'},t);self.assertNotEqual(h,variant)
  self.assertTrue({'brick','render','concrete','stone','slate','timber','metal','glass'} <= {m['family'] for m in entries()})
if __name__=='__main__':unittest.main()
