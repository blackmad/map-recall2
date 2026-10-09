import copy,json,unittest
from pathlib import Path
from building_lib.ir import resolve
from building_lib.warehouse import hoist_plan,validate_warehouse
from building_lib.source_attachments import dormer_plan
from building_lib.opening_mesh_capture import capture_warehouse
class AttachmentHoists(unittest.TestCase):
 def recipe(self,suffix):return resolve(json.loads(Path('artifacts/building-batch-scale-200/recipes/bag-036310001'+suffix+'.recipe.json').read_text()))
 def spec(self,r):
  raw=r['details']['appearanceDormers'][0];p=dormer_plan(r,raw);pitched=p['capStyle']=='pitched'
  return {'id':'mounted-beam','supportAttachmentId':raw['id'],'supportRegion':'cap' if pitched else 'body','x':p['x'],'z':p['head']+.16 if pitched else p['head']-.09,'height':.10,'width':.11,'projection':1.4,'rearDepth':.24,'tipRise':.05,'bracketDrop':.05 if pitched else .18}
 def test_shared_capture_binds_beam_and_support_plane(self):
  for suffix in ('2174863','2239570'):
   r=self.recipe(suffix);f=r['frontages'][0];s=self.spec(r);f['warehouseHoists']=[s];before=copy.deepcopy(r);p=hoist_plan(s,f['width'],r,f);self.assertEqual(validate_warehouse(r),[]);objects,_=capture_warehouse(f,r);self.assertEqual(len(objects),4);timber=next(o for o in objects if 'heavy timber beam' in o['name']);ys=[v[1] for v in timber['vertices']];self.assertLess(min(ys),p['mountY']-1.3);self.assertGreater(max(ys),p['mountY']+.2);self.assertEqual(before,r)
 def test_bad_attachment_support_rejects(self):
  r=self.recipe('2239570');f=r['frontages'][0];s=self.spec(r)
  for patch in ({'supportAttachmentId':'missing'},{'supportRegion':'cap'},{'x':s['x']+2},{'z':s['z']+1},{'z':s['z']-.7},{'bracketDrop':3},{'rearDepth':.5,'tipRise':3}):
   with self.assertRaises(ValueError):hoist_plan(dict(s,**patch),f['width'],r,f)
  with self.assertRaises(ValueError):hoist_plan(s,f['width'])
  moved=copy.deepcopy(f);moved['rotation']=.2
  with self.assertRaises(ValueError):hoist_plan(s,f['width'],r,moved)
if __name__=='__main__':unittest.main()
