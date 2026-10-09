import copy,json,unittest
from pathlib import Path
from building_lib.ir import resolve
from building_lib.source_attachments import dormer_plan,pitched_dormer_cap
from building_lib.source_massing import compile_source_massing
class PitchedCap(unittest.TestCase):
 def test_shared_closed_cap_reaches_peak(self):
  r=resolve(json.loads(Path('artifacts/building-batch-scale-200/recipes/bag-0363100012169595.recipe.json').read_text()));raw=r['details']['appearanceDormers'][0];raw.update(capStyle='pitched',capHeight=.3,height=raw['height']-.23);before=copy.deepcopy(r);p=dormer_plan(r,raw);self.assertAlmostEqual(p['capTop'],r['roof']['top']);compile_source_massing(r);v,f=pitched_dormer_cap(p);edges={}
  for face in f:
   for a,b in zip(face,face[1:]+face[:1]):edges[(a,b)]=edges.get((a,b),0)+1
  self.assertTrue(all(n==1 and edges.get((b,a))==1 for (a,b),n in edges.items()));self.assertEqual(max(x[2] for x in v),p['capTop']);self.assertEqual(r,before)
 def test_malformed_or_conflicting_cap_rejects(self):
  r=resolve(json.loads(Path('artifacts/building-batch-scale-200/recipes/bag-0363100012169595.recipe.json').read_text()))
  for patch in ({'capStyle':'pitched','capHeight':0},{'capStyle':'pitched','capHeight':.3,'capRise':.1},{'capStyle':'flat','capHeight':.3},{'capStyle':'unknown'}):
   raw=dict(r['details']['appearanceDormers'][0],**patch)
   with self.assertRaises(ValueError):dormer_plan(r,raw)
if __name__=='__main__':unittest.main()
