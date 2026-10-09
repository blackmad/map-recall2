"""Portable regression for draw accounting across GLB material splits."""
import json, struct, tempfile, unittest
from pathlib import Path
from building_lib.export import glb_draw_calls,authored_frontage_bounds
import math


class ExportAccounting(unittest.TestCase):
    def test_offset_and_corner_frontage_envelope_preserves_all_planes(self):
        recipe={'roof':{'eaves':11},'frontages':[
            {'origin':[0,0],'width':5,'rotation':0},
            {'origin':[-4.5,-.4],'width':4.4,'rotation':0},
            {'origin':[-4.5,12],'width':12.4,'rotation':-math.pi/2,'eaves':10}]}
        bounds=authored_frontage_bounds(recipe)
        self.assertEqual(bounds['count'],3)
        for a,b in zip(bounds['min'],[-4.5,-.4,0]):self.assertAlmostEqual(a,b)
        for a,b in zip(bounds['max'],[5,12,11]):self.assertAlmostEqual(a,b)
        for a,b in zip(bounds['outwardPlan'],[-1/math.sqrt(5),-2/math.sqrt(5)]):self.assertAlmostEqual(a,b)

    def test_opposing_fronts_omit_undefined_oblique_direction(self):
        bounds=authored_frontage_bounds({'roof':{'eaves':8},'frontages':[
            {'origin':[0,0],'width':6,'rotation':0},{'origin':[6,10],'width':6,'rotation':math.pi}]})
        self.assertNotIn('outwardPlan',bounds)

    def test_single_front_envelope_keeps_original_origin_width(self):
        bounds=authored_frontage_bounds({'roof':{'eaves':8},'frontages':[{'origin':[0,0],'width':6}]})
        self.assertEqual(bounds,{'count':1,'min':[0,0,0],'max':[6,0,8]})

    def test_multi_material_mesh_counts_every_exported_primitive(self):
        document={'asset':{'version':'2.0'},'meshes':[
            {'primitives':[{'material':0},{'material':1}]},
            {'primitives':[{'material':1}]}]}
        payload=json.dumps(document).encode()
        payload+=b' '*((-len(payload))%4)
        data=struct.pack('<4sII',b'glTF',2,20+len(payload))+struct.pack('<II',len(payload),0x4E4F534A)+payload
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'split.glb';path.write_bytes(data)
            self.assertEqual(glb_draw_calls(path),3)
            path.write_bytes(data[:-1])
            with self.assertRaises(ValueError):glb_draw_calls(path)


if __name__=='__main__':
    unittest.main()
