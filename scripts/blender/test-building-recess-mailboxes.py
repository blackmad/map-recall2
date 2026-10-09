"""Facade recess depth and aperture-safe mailbox bank contracts."""
import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from building_lib.component_catalog import resolve
from building_lib.open_frames import frame_apertures,recessed_panel_plan
from building_lib.ir import resolve as resolve_ir
from building_lib.schema import validate
FIXTURE=Path(__file__).parent/'building_lib/fixtures/synthetic-keyhole-apertures.json'
class Contracts(unittest.TestCase):
    def test_recess_and_mailbox_fixture(self):
        r=resolve_ir(json.loads(FIXTURE.read_text()));self.assertEqual(validate(r),[])
        cuts=frame_apertures(r['frontages'][0],6)
        self.assertEqual(len(cuts),1);self.assertEqual(cuts[0]['height'],1.8500000000000005)
    def test_mailbox_rejects_overlap_and_invalid_grid(self):
        front={'width':4,'openings':[{'x':1,'z':1.5,'width':1,'height':2}]}
        valid={'id':'bank','kind':'mailboxes','x':3,'z':1.5,'width':.6,'height':1.2}
        resolve(valid,front,6)
        for change in [{'x':1},{'rows':True},{'columns':0},{'rows':8,'columns':8},{'z':.1},{'width':.05}]:
            with self.assertRaises(ValueError):resolve(valid|change,front,6)
    def test_recess_rejects_bounds_and_uncontained_back_openings(self):
        raw={'id':'inset','x':2,'width':2,'bottom':3,'top':5,'setback':.75,'openings':[]}
        for change in [{'setback':.1},{'bottom':-1},{'top':7},{'openings':[{'id':'bad','x':2,'z':4,'width':3,'height':1,'head':'rectangular'}]}]:
            with self.assertRaises(ValueError):recessed_panel_plan(raw|change,{'width':4},6)
    def test_panel_above_stepped_facade_does_not_claim_a_new_cut(self):
        p=Path(__file__).parent/'expansion/recipes/bloemstraat-3-5-7.json'
        r=resolve_ir(json.loads(p.read_text()));f=r['frontages'][0]
        cuts=frame_apertures(f,r['roof']['eaves'])
        self.assertEqual(len(cuts),len(f['openFrames']))
        self.assertTrue(all('recessed void' not in c['id'] for c in cuts))

def blender_checks():
    import bpy,bmesh
    from mathutils import Vector
    from building_lib.walls import facade_with_apertures
    from building_lib.open_frames import build_recessed_upper_panels
    from building_lib.component_details import build_front_components
    bpy.ops.wm.read_factory_settings(use_empty=True)
    r=resolve_ir(json.loads(FIXTURE.read_text()));f=r['frontages'][0];mat=bpy.data.materials.new('test')
    facade=facade_with_apertures(8,[(0,6),(8,6)],mat,f['openings']+frame_apertures(f,6))
    assert not facade.ray_cast(Vector((3,-1,4.7)),Vector((0,1,0)),distance=2)[0],'Inset must cut original facade'
    build_recessed_upper_panels(f,6,lambda *args:mat)
    back=next(o for o in bpy.context.scene.objects if 'closed recessed wall' in o.name)
    hit=back.ray_cast(Vector((3,-1,4.7)),Vector((0,1,0)))[1]
    assert abs(hit.y-.75)<1e-6,'Actual wall setback required'
    assert not back.ray_cast(Vector((4,-1,4.7)),Vector((0,1,0)),distance=3)[0],'Back window must also be a true void'
    boxes=build_front_components(r,f,lambda *args:mat)
    assert len(boxes)==25,'One backing and three closed details per mailbox'
    for o in bpy.context.scene.objects:
        if o.type!='MESH':continue
        bm=bmesh.new();bm.from_mesh(o.data)
        assert all(e.is_manifold for e in bm.edges),o.name
        assert bm.calc_volume(signed=True)>0,o.name
        bm.free()
    print('RECESS_MAILBOX_RESULT true facade and back-wall voids, .75 m setback, closed returns and 8 closed mailbox cells pass')
if __name__=='__main__':
    result=unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(Contracts))
    if not result.wasSuccessful():raise SystemExit(1)
    try:import bpy
    except ImportError:pass
    else:blender_checks()
