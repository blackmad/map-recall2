"""Projected dormers own raised volume and remove exactly their roof support."""
import copy,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib.ir import resolve
from building_lib.source_massing import compile_source_massing
from building_lib.source_attachments import dormer_plan
from building_lib.polygons import area

class FlatDormers(unittest.TestCase):
 def setUp(self):
  self.recipe=resolve(json.loads((ROOT/'artifacts/building-batch-scale-200/recipes/bag-0363100012239834.recipe.json').read_text()))
 def test_supported_pair_removes_roof_and_reaches_peak_without_mutating_evidence(self):
  r=self.recipe;before=copy.deepcopy(r)
  whole=compile_source_massing(r,exclude_attachment_voids=True);cut=compile_source_massing(r)
  def roof_area(compiled):
   return sum(abs(area([s['vertices'][i][:2] for i in t])) for s in compiled.surfaces if s['type']=='roof' for t in s['triangles'])
  plans=[dormer_plan(r,d) for d in r['details']['appearanceDormers']]
  self.assertAlmostEqual(roof_area(whole)-roof_area(cut),sum(p['width']*p['depth'] for p in plans),places=5)
  for p in plans:
   self.assertAlmostEqual(p['capTop'],r['roof']['top'])
   self.assertGreater(p['depth'],1)
   self.assertLess(p['window']['z']+p['window']['height']/2,p['head'])
  self.assertEqual(before,r)
 def test_invalid_owners_are_rejected(self):
  for failure in ('overlap','outside','peak','facade'):
   with self.subTest(failure=failure):
    r=copy.deepcopy(self.recipe)
    if failure=='overlap':r['details']['appearanceDormers'][1]['x']=r['details']['appearanceDormers'][0]['x']
    if failure=='outside':r['details']['appearanceDormers'][0]['x']=-1
    if failure=='peak':r['roof']['top']+=.5
    if failure=='facade':r['frontages'][0]['profile'][0][1]+=1
    with self.assertRaises(ValueError):compile_source_massing(r)

if __name__=='__main__':unittest.main()
