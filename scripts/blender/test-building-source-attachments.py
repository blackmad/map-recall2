"""Pure contracts for explicitly selected retained semantic roof support."""
import unittest,json,sys,copy
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from building_lib.ir import resolve
from building_lib.source_attachments import rail_plan,selected_roof
class Contracts(unittest.TestCase):
 def setUp(self):
  self.recipe=resolve(json.loads((Path(__file__).parent/'expansion/recipes/bloemgracht-51.json').read_text()))
  self.rail=self.recipe['details']['sourceRails'][0]
 def test_measured_support_not_analytic_descriptor(self):
  plan=rail_plan(self.recipe,self.rail)
  self.assertEqual(len(plan['posts']),4)
  self.assertTrue(all(15.18<p[2]<15.22 for p in plan['posts']))
  self.recipe['roof']['top']=100
  self.assertEqual(plan,rail_plan(self.recipe,self.rail))
 def test_outside_midspan_rejected(self):
  raw=dict(self.rail,points=[[.12,.4],[4.8,.4]])
  with self.assertRaisesRegex(ValueError,'outside'):rail_plan(self.recipe,raw)
 def test_clipped_front_slab_is_not_support(self):
  with self.assertRaisesRegex(ValueError,'outside'):rail_plan(self.recipe,dict(self.rail,points=[[.12,.16],[2.98,.16]]))
 def test_wrong_surface_and_duplicate_selection_rejected(self):
  for indices in ([0],[20,20],[],None):
   with self.assertRaises(ValueError):selected_roof(self.recipe,indices)
 def test_invalid_dimensions_and_levels_rejected(self):
  for changes in ({'height':float('nan')},{'postSpacing':0},{'railLevels':[1,.3]},{'railLevels':[0]},{'points':[[1,1],[1,1]]}):
   with self.assertRaises(ValueError):rail_plan(self.recipe,dict(self.rail,**changes))
 def test_provenance_required(self):
  with self.assertRaises(ValueError):rail_plan(self.recipe,dict(self.rail,provenance={}))
if __name__=='__main__':unittest.main()
