"""Keyhole voids, continuous rings and clipped sash preserve masonry shoulders."""
import json,sys,unittest,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from building_lib.apertures import from_spec,contains,offset_profile
from building_lib.schema import validate
FIXTURE=Path(__file__).parent/'building_lib/fixtures/synthetic-keyhole-apertures.json'

class Contracts(unittest.TestCase):
    def test_stem_and_bulb_shape_and_offset(self):
        spec={'x':2,'z':3,'width':1.1,'height':2.4,'head':'keyhole','stemWidth':.32}
        p=from_spec(spec)
        self.assertTrue(contains(p,(2,2)))
        self.assertFalse(contains(p,(2.35,2)))
        self.assertTrue(contains(p,(2.4,3.65)))
        self.assertTrue(all(contains(p,q) for q in offset_profile(p,.025)))
        self.assertEqual(validate(json.loads(FIXTURE.read_text())),[])
    def test_unsupported_shapes_and_joinery_rejected(self):
        base={'x':2,'z':3,'width':1.1,'height':2.4,'head':'keyhole'}
        for change in [{'stemWidth':True},{'stemWidth':.1},{'stemWidth':1},{'height':1.1},{'archRise':.1},{'archSegments':8}]:
            with self.assertRaises(ValueError):from_spec(base|change)
        for change in [{'kind':'door'},{'lowerPanel':{'height':.3}},{'upperLightBars':[.5]}]:
            r=json.loads(FIXTURE.read_text());r['frontages'][0]['openings'][0].update(change)
            self.assertTrue(validate(r))

def blender_checks():
    import bpy,bmesh
    from mathutils import Vector
    from building_lib.walls import facade_with_apertures
    from building_lib.openings import recessed_opening
    bpy.ops.wm.read_factory_settings(use_empty=True);m=bpy.data.materials.new('test')
    spec={'id':'key','x':2,'z':3,'width':1.1,'height':2.4,'head':'keyhole','stemWidth':.32,'kind':'window','mullions':[.5],'transom':.28}
    wall=facade_with_apertures(4,[(0,6),(4,6)],m,[spec])
    for x,z in [(2,2),(2.4,3.65)]:assert not wall.ray_cast(Vector((x,-1,z)),Vector((0,1,0)),distance=2)[0]
    assert wall.ray_cast(Vector((2.35,-1,2)),Vector((0,1,0)),distance=2)[0],'Masonry shoulder must remain beside narrow stem'
    recessed_opening(spec,m,m)
    for obj in [wall,bpy.data.objects['key outer trim'],bpy.data.objects['key jamb profile'],bpy.data.objects['key recessed glazing']]:
        bm=bmesh.new();bm.from_mesh(obj.data)
        assert all(e.is_manifold for e in bm.edges),obj.name
        assert bm.calc_volume(signed=True)>0,obj.name
        bm.free()
    profile=from_spec(spec)
    for obj in bpy.context.scene.objects:
        if 'recessed mullion' in obj.name or 'sash division' in obj.name:
            assert all(contains(profile,(v.co.x,v.co.z)) for v in obj.data.vertices),obj.name
    assert not any(' sill' in obj.name for obj in bpy.context.scene.objects)
    print('KEYHOLE_BLENDER_RESULT true bulb/stem void, intact masonry shoulders, closed outward rings and clipped sash pass')

if __name__=='__main__':
    result=unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(Contracts))
    if not result.wasSuccessful():raise SystemExit(1)
    try:import bpy
    except ImportError:pass
    else:blender_checks()
