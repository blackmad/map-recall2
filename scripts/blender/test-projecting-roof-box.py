"""Multi-row roof box proof: bounded projection and independent apertures."""
import copy,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib.ir import resolve
from building_lib.source_attachments import dormer_plan
from building_lib.source_massing import compile_source_massing
from building_lib.polygons import area
class RoofBox(unittest.TestCase):
 def setUp(self):
  self.recipe=resolve(json.loads((ROOT/'artifacts/building-batch-scale-200/recipes/bag-0363100012243113.recipe.json').read_text()))
  self.raw=self.recipe['details']['appearanceDormers'][0]
 def test_actual_two_rows_below_eaves_with_supported_roof_cut(self):
  before=copy.deepcopy(self.recipe);p=dormer_plan(self.recipe,self.raw)
  self.assertEqual(len(p['windows']),2);self.assertLess(p['bottom'],self.recipe['roof']['eaves']);self.assertLess(p['frontY'],0)
  self.assertGreater(p['windows'][1]['z']-p['windows'][0]['z'],1)
  self.assertAlmostEqual(p['capTop'],self.recipe['roof']['top'])
  def covered(c):return sum(abs(area([s['vertices'][i][:2] for i in t])) for s in c.surfaces if s['type']=='roof' for t in s['triangles'])
  self.assertAlmostEqual(covered(compile_source_massing(self.recipe,True))-covered(compile_source_massing(self.recipe)),p['width']*p['depth'],places=5)
  self.assertEqual(before,self.recipe)
 def test_reject_invalid_apertures_and_projection(self):
  for change in ('overlap','crossing','projection','base','support'):
   with self.subTest(change=change):
    raw=copy.deepcopy(self.raw)
    if change=='overlap':raw['frontWindows'][1]['zFraction']=raw['frontWindows'][0]['zFraction']
    if change=='crossing':raw['frontWindows'][0]['widthFraction']=.99;raw['frontWindows'][0]['xFraction']=.3
    if change=='projection':raw['frontProjection']=2
    if change=='base':raw['baseZ']=0
    if change=='support':raw['supportMode']='source-retained'
    with self.assertRaises(ValueError):dormer_plan(self.recipe,raw)
if __name__=='__main__':unittest.main()
