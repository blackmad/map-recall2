import copy,unittest
from building_lib.sash_bars import sash_bar_plan
from building_lib.opening_mesh_capture import capture_opening

class PartialSashBars(unittest.TestCase):
 def test_mirrored_geometry_and_material(self):
  for width in [1,1.6,2.4]:
   for split in [.32,.68]:
    spec=dict(id='mirrored-side-pane',x=3,z=4,width=width,height=2,head='rectangular',kind='window',mullions=[split],transom=None,sashColour='#454a44',sashBars=[[0,.62,split,.62]] if split==.32 else [[split,.62,1,.62]])
    before=copy.deepcopy(spec);objects,_=capture_opening(spec,'#ccccbb','#65756d');bars=[o for o in objects if 'partial sash bar' in o['name']];self.assertEqual(len(bars),1);bar=bars[0];self.assertEqual(bar['material'],spec['sashColour']);xs=[p[0] for p in bar['vertices']];self.assertAlmostEqual(max(xs)-min(xs),width*(.32 if split==.32 else .32));self.assertAlmostEqual(sum(p[2] for p in bar['vertices'])/8,4-1+2*.62);self.assertEqual(spec,before)
 def test_invalid(self):
  base=dict(x=0,z=1,width=1,height=2,kind='window',head='rectangular')
  for bars in [None,[[0,0,1,1]],[[.2,.2,.2,.2]],[[0,0,1,0]],[[0,.5,1.1,.5]],[[False,.5,1,.5]],[[0,.5,1,.5],[1,.5,0,.5]]]:
   with self.assertRaises(ValueError):sash_bar_plan(dict(base,sashBars=bars))
  for head in ['segmental','circular']:
   with self.assertRaises(ValueError):sash_bar_plan(dict(base,head=head,sashBars=[[0,.5,1,.5]]))

if __name__=='__main__':unittest.main()
