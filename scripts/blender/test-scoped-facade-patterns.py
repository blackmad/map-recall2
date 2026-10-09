"""Physical interval ownership and shared steel-grid joinery regressions."""
import copy,unittest
from building_lib.facade_patterns import opening_pattern
from building_lib.opening_mesh_capture import capture_opening

class ScopedPatterns(unittest.TestCase):
    def test_independent_schedules_and_interval_ownership(self):
        floors={'old':{'bottom':3,'top':6},'modern':{'bottom':7,'top':10}}
        for width in (7,10,14):
            front={'width':width,'profile':[(0,9),(width*.3,12),(width*.6,9),(width*.6,14),(width,14)]}
            before=copy.deepcopy(front)
            left=opening_pattern({'preset':'warehouse-stack','id':'old','storeys':['old'],'startFraction':0,'endFraction':.6},front,floors)
            right=opening_pattern({'preset':'industrial-grid','id':'new','storeys':['modern'],'columns':5,'rows':4,'startFraction':.6,'endFraction':1},front,floors)
            self.assertEqual(before,front)
            self.assertTrue(all(o['x']+o['width']/2<=width*.6 for o in left))
            self.assertTrue(all(o['x']-o['width']/2>=width*.6 for o in right))
            self.assertTrue(all(o['z']-o['height']/2>=7 for o in right))
            grid=right[0];objects,_=capture_opening(grid,grid['frameColour'],grid['glassColour'])
            bars=[o for o in objects if 'grid bar' in o['name'] or 'recessed mullion' in o['name']]
            self.assertEqual(len(bars),7)
            self.assertTrue(all(o['material']==grid['sashColour'] for o in bars))
            self.assertTrue(all(o['material']==grid['frameColour'] for o in objects if 'outer trim' in o['name']))
            for obj in bars:
                self.assertTrue(all(width*.6<=p[0]<=width and 7<=p[2]<=10 for p in obj['vertices']))

    def test_invalid_scope_rejected(self):
        front={'width':10,'profile':[(0,10),(10,10)]};floors={'ground':{'bottom':0,'top':3}}
        for start,end in ((-.1,.6),(.6,.5),(0,1.1),(False,.5),(.2,None)):
            with self.assertRaises(ValueError):
                opening_pattern({'preset':'industrial-grid','storeys':['ground'],'startFraction':start,'endFraction':end},front,floors)

if __name__=='__main__':unittest.main()
