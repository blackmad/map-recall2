import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from building_lod import keep_object
class LODContracts(unittest.TestCase):
    def test_structural_and_unknown_meshes_are_never_discarded(self):
        for level in ['facade','massing']:
            for name,kind in [('Massing / source-derived roof 14',''),('Window recessed glazing',''),('bay / continuous projecting masonry','grouped-bay'),('frame / terrace deck','open-atrium-frame'),('frame / depth beam 2','open-atrium-frame'),('dormer / curved cap','source-roof-dormer'),('inset / left closed return','recessed-upper-panel'),('custom new architecture','')]:
                self.assertTrue(keep_object(name,level,kind))
    def test_only_known_fine_roles_omitted(self):
        for name in ['window recessed mullion.002','window upper light','door door handle','Storefront / shop lettering']:
            self.assertTrue(keep_object(name,'detail'));self.assertFalse(keep_object(name,'facade'));self.assertFalse(keep_object(name,'massing'))
        self.assertTrue(keep_object('window outer trim.003','facade'));self.assertFalse(keep_object('window outer trim.003','massing'))
        self.assertTrue(keep_object('balcony / closed slab','massing','balcony'))
        self.assertTrue(keep_object('balcony / front handrail','massing','balcony'))
        self.assertFalse(keep_object('balcony / front baluster 3','massing','balcony'))
    def test_unknown_level_rejected(self):
        with self.assertRaises(ValueError):keep_object('roof','cardboard')
if __name__=='__main__':unittest.main()
