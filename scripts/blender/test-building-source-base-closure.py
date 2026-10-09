import json,sys,copy,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent));sys.path.insert(0,str(Path(__file__).parent/'expansion'))
from seed_to_ir import foundation
from building_lib.ir import resolve
from building_lib.source_base_closure import loop_signature,audit_base_closure
from building_lib.source_massing import compile_source_massing
class Contracts(unittest.TestCase):
 def setUp(self):
  root=Path(__file__).resolve().parents[2];seed=json.loads((root/'artifacts/jordaan-building-library/source-seeds/0363100012164995.json').read_text());self.r=resolve(foundation(seed,'probe','probe','probe',3,3)[0]);self.r['massing']={'mode':'source-derived'}
  self.loop=json.loads((root/'artifacts/jordaan-building-library/bloemstraat-3-5-7-boundary-diagnostic.json').read_text())['loops'][0]['points']
  self.spec={'geometryRevision':self.r['geometryRevision'],'sourceLoopSignatures':[loop_signature(self.loop)],'datumZ':.0020000076,'maxFootprintDeviationM':.025,'provenance':{'status':'inferred','basis':'Exact basal perimeter reviewed; closed interior source floor dips below exteriordatum'}}
 def test_default_rejects_and_explicit_closes_without_erasing_low_patch(self):
  with self.assertRaisesRegex(ValueError,'above ground'):compile_source_massing(self.r)
  self.r['massing']['baseClosure']=self.spec;p=compile_source_massing(self.r)
  self.assertEqual(p.audit['groundLoopsClosed'],1)
  low=next(s for s in p.surfaces if s['index']==49)
  self.assertLess(min(v[2] for v in low['vertices']),-.18)
 def test_signature_invariant_under_rotation_and_direction(self):
  self.assertEqual(loop_signature(self.loop),loop_signature(list(reversed(self.loop[3:]+self.loop[:3]))))
 def test_revision_signature_datum_footprint_provenance_strict(self):
  for key,value in [('geometryRevision','wrong'),('sourceLoopSignatures',['wrong']),('datumZ',.05),('maxFootprintDeviationM',.005),('provenance',{})]:
   r=copy.deepcopy(self.r);r['massing']['baseClosure']=dict(self.spec,**{key:value})
   with self.assertRaises(ValueError):compile_source_massing(r)
 def test_unapproved_upper_loop_rejected_even_with_basal_signature(self):
  r=copy.deepcopy(self.r);r['massing']['baseClosure']=self.spec
  loop=copy.deepcopy(self.loop)
  for p in loop:p[2]+=4
  with self.assertRaises(ValueError):audit_base_closure(r,[self.loop,loop],-.188)
if __name__=='__main__':unittest.main()
