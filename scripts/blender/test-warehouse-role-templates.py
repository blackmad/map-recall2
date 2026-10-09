"""Warehouse loading grids must not spread onto small flank/crest apertures."""
import copy,unittest
from building_lib.facade_patterns import opening_pattern
from building_lib.opening_mesh_capture import capture_opening
class WarehouseTemplates(unittest.TestCase):
 def test_independent_joinery_and_input(self):
  for width in (4.5,5.5,7):
   front={'width':width,'profile':[(0,12),(width/2,16),(width,12)]};floors={'body':{'bottom':8,'top':11},'attic':{'bottom':12,'top':16}}
   spec={'preset':'warehouse-stack','id':'loading','storeys':['body','attic'],'loadingTemplate':{'head':'rectangular','mullions':[.5],'horizontalMullions':[.3,.6],'transom':None,'frameColour':'#d0d1bd','sashColour':'#393e36'},'flankTemplate':{'head':'rectangular','mullions':[],'transom':None,'frameColour':'#544b40'},'crestTemplate':{'head':'rectangular','mullions':[],'frameColour':'#544b40'}};before=copy.deepcopy(spec)
   openings=opening_pattern(spec,front,floors);self.assertEqual(spec,before)
   for o in openings:
    if o['id'].endswith('-loading'):
     objects,_=capture_opening(o,o['frameColour'],o['glassColour']);bars=[obj for obj in objects if 'grid bar' in obj['name'] or 'recessed mullion' in obj['name']];self.assertEqual(len(bars),3);self.assertTrue(all(obj['material']=='#393e36' for obj in bars))
    else:self.assertFalse(o.get('horizontalMullions'));self.assertEqual(o['mullions'],[]);self.assertEqual(o['frameColour'],'#544b40')
 def test_bad_templates_reject(self):
  for key in ('loadingTemplate','flankTemplate','crestTemplate'):
   with self.assertRaises(ValueError):opening_pattern({'preset':'warehouse-stack','storeys':['body'],key:[]},{'width':5,'profile':[(0,10),(5,10)]},{'body':{'bottom':3,'top':6}})
if __name__=='__main__':unittest.main()
