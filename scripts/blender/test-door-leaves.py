"""Opaque entry leaves preserve separate transoms and shared aperture ownership."""
import copy,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from building_lib.door_leaf import door_leaf_blocks
from building_lib.opening_mesh_capture import capture_opening
from building_lib.facade_patterns import opening_pattern
class Doors(unittest.TestCase):
 def setUp(self):
  self.spec={'id':'entry','kind':'door','x':1,'z':1.5,'width':.8,'height':2.6,'head':'rectangular','transom':.25,'mullions':[],'upperLights':[.5],'doorLeaf':{'style':'panelled','rows':2,'columns':1,'colour':'#293c32'}}
 def test_opaque_geometry_fits_below_transom_and_shared_capture_preserves_input(self):
  before=copy.deepcopy(self.spec);blocks=door_leaf_blocks(self.spec,.10)
  self.assertEqual(len(blocks),3)
  for _,x,y,z,w,d,h in blocks:
   self.assertLess(z+h/2,self.spec['z']+self.spec['height']/2-self.spec['height']*.25)
   self.assertGreater(z-h/2,self.spec['z']-self.spec['height']/2)
   self.assertGreater(w,0)
  objects,_=capture_opening(self.spec,'#eeeeee','#526252','#9f8851')
  leaf=[o for o in objects if 'timber' in o['name']]
  self.assertEqual(len(leaf),3);self.assertTrue(all(o['material']=='#293c32' for o in leaf))
  self.assertTrue(any(o['name'].endswith('upper light') for o in objects))
  self.assertEqual(before,self.spec)
 def test_door_template_never_paints_display_windows(self):
  spec={'preset':'right-entry','doorTemplate':{'doorLeaf':self.spec['doorLeaf']},'windowTemplate':{'mullions':[.25,.75]}}
  openings=opening_pattern(spec,{'width':5},{'ground':{'bottom':0,'top':3}})
  door=next(o for o in openings if o['kind']=='door');window=next(o for o in openings if o['kind']=='window')
  self.assertIn('doorLeaf',door);self.assertNotIn('lowerPanel',door);self.assertNotIn('doorLeaf',window);self.assertEqual(window['mullions'],[.25,.75])
 def test_garage_closure_keeps_entry_leaf_only(self):
  openings=opening_pattern({'preset':'garage-right-entry','doorTemplate':{'doorLeaf':self.spec['doorLeaf']}},{'width':6},{'ground':{'bottom':0,'top':3}})
  garage=next(o for o in openings if 'garage' in o['id']);entry=next(o for o in openings if o['id'].endswith('entry'))
  self.assertIn('warehouse',garage);self.assertNotIn('doorLeaf',garage);self.assertIn('doorLeaf',entry)
 def test_invalid_leaf_contracts_reject(self):
  for change in ({'kind':'window'},{'lowerPanel':{'height':.5}},{'head':'rounded','transom':.05},{'transom':.99},{'doorLeaf':{'style':'panelled','rows':99}},{'doorLeaf':{'style':'plain','colour':'bad'}}):
   with self.subTest(change=change):
    with self.assertRaises(ValueError):door_leaf_blocks(dict(self.spec,**change))
 def test_arched_transom_keeps_panelled_leaf_below_spring(self):
  for head,rise in [('segmental',.13),('rounded',.4)]:
   spec=dict(self.spec,head=head,archRise=rise);before=copy.deepcopy(spec)
   objects,_=capture_opening(spec,'#eeeeee','#526252','#9f8851')
   spring=spec['z']+spec['height']/2-rise
   leaf=[o for o in objects if 'timber' in o['name']]
   self.assertEqual(len(leaf),3)
   self.assertTrue(all(max(p[2] for p in o['vertices'])<spring for o in leaf))
   self.assertTrue(all(o['material']=='#293c32' for o in leaf))
   self.assertEqual(spec,before)
   for transom in (None,.01):
    with self.assertRaises(ValueError):door_leaf_blocks(dict(spec,transom=transom))
if __name__=='__main__':unittest.main()
