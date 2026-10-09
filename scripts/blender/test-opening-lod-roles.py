"""Semantic omissions must retain the visible entry and actual aperture."""
import unittest
from building_lib.opening_mesh_capture import capture_opening

class Roles(unittest.TestCase):
    def test_arched_entry_keeps_opacity_and_outline(self):
        spec={'id':'entry','kind':'door','head':'segmental','archRise':.13,'x':1,'z':1.5,'width':1,'height':2.8,'transom':.25,'mullions':[.5],'doorLeaf':{'style':'panelled','rows':2,'columns':1}}
        objects,_=capture_opening(spec,'#bbbbbb','#445544','#998844')
        roles={o['lodRole'] for o in objects}
        self.assertEqual(roles,{'glazing','outer-trim','jamb-profile','sash-division','door-leaf','raised-panel','sill-threshold','handle'})
        for o in objects:
            self.assertTrue(o['vertices'] and o['faces'])
            if o['lodRole'] in ('glazing','outer-trim','door-leaf','sill-threshold'):
                self.assertTrue(o['lodFacade'] and o['lodMassing'])
            if o['lodRole'] in ('jamb-profile','raised-panel','handle'):
                self.assertFalse(o['lodFacade'] or o['lodMassing'])
        self.assertEqual(sum(o['lodRole']=='door-leaf' for o in objects),1)
    def test_grid_remains_at_facade_and_omits_only_at_massing(self):
        objects,_=capture_opening({'id':'grid','kind':'window','head':'rectangular','x':1,'z':2,'width':1.4,'height':2,'horizontalMullions':[.33,.66]},'#bbbbbb','#445544')
        sash=[o for o in objects if o['lodRole']=='sash-division']
        self.assertEqual(len(sash),4)
        self.assertTrue(all(o['lodFacade'] and not o['lodMassing'] for o in sash))

if __name__=='__main__':unittest.main()
