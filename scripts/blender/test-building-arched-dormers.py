"""Source-supported curved dormers share true cap, cheek and aperture outlines."""
import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from building_lib.source_attachments import dormer_plan
from building_lib.apertures import from_spec,outline,contains
FIXTURE=Path(__file__).parent/'building_lib/fixtures/synthetic-arched-source-dormers.json'

class Contracts(unittest.TestCase):
    def setUp(self):
        self.recipe=json.loads(FIXTURE.read_text());self.raw=self.recipe['details']['sourceDormers'][1]
    def test_window_remains_inside_arched_cheeks_and_default_is_flat(self):
        p=dormer_plan(self.recipe,self.raw)
        body=outline(p['x'],(p['bottom']+p['head'])/2,p['width'],p['head']-p['bottom'],'segmental',p['capRise'])
        self.assertTrue(all(contains(body,q) for q in from_spec(p['window'])))
        flat=dormer_plan(self.recipe,self.recipe['details']['sourceDormers'][0])
        self.assertEqual(flat['capRise'],0);self.assertEqual(flat['window']['head'],'rectangular')
    def test_rise_and_rear_spring_clearance_rejected(self):
        for rise in [True,-.1,float('nan'),1.0]:
            with self.assertRaises(ValueError):dormer_plan(self.recipe,{**self.raw,'capRise':rise})
        with self.assertRaisesRegex(ValueError,'spring'):
            dormer_plan(self.recipe,{**self.raw,'height':.21,'capRise':.105})

def blender_checks():
    import bpy,bmesh
    from mathutils import Vector
    from building_lib.source_attachments import build_source_dormers
    bpy.ops.wm.read_factory_settings(use_empty=True)
    r=json.loads(FIXTURE.read_text());m=bpy.data.materials.new('test')
    build_source_dormers(r,m,m,m,m)
    for name in ['arched / arched cheeks','arched / curved cap','arched / curved front fascia']:
        obj=bpy.data.objects[name];bm=bmesh.new();bm.from_mesh(obj.data)
        assert all(e.is_manifold for e in bm.edges),name
        assert bm.calc_volume(signed=True)>0,name
        bm.free()
    p=dormer_plan(r,r['details']['sourceDormers'][1]);body=bpy.data.objects['arched / arched cheeks']
    assert not body.ray_cast(Vector((p['x'],p['y']-1,p['window']['z'])),Vector((0,1,0)),distance=1.28)[0],'Front aperture must be clear'
    cap=bpy.data.objects['arched / curved cap']
    center=cap.ray_cast(Vector((p['x'],p['y']+.3,p['head']+1)),Vector((0,0,-1)))[1]
    edge=cap.ray_cast(Vector((p['x']+p['width']*.47,p['y']+.3,p['head']+1)),Vector((0,0,-1)))[1]
    assert center.z-edge.z>.20,'Cap must have a real curved rise'
    assert not any(o.name.startswith('CUTTER /') for o in bpy.context.scene.objects)
    print('ARCHED_DORMER_BLENDER_RESULT closed positive curved cap/cheeks/fascia, true aperture and cap rise pass')

if __name__=='__main__':
    result=unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(Contracts))
    if not result.wasSuccessful():raise SystemExit(1)
    try:import bpy
    except ImportError:pass
    else:blender_checks()
