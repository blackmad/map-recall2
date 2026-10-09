"""Closed projecting brackets and blind panels preserve facade apertures."""
import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from building_lib.component_catalog import resolve
from building_lib.ir import resolve as resolve_ir
from building_lib.schema import validate
FIXTURE=Path(__file__).parent/'building_lib/fixtures/synthetic-cornice-brackets-panels.json'

class Contracts(unittest.TestCase):
    def test_fixture_and_absent_panels(self):
        recipe=resolve_ir(json.loads(FIXTURE.read_text()))
        self.assertEqual(validate(recipe),[])
        spec=resolve({'id':'plain','kind':'pilaster','x':1},recipe['frontages'][0],9)
        self.assertNotIn('panels',spec)
    def test_invalid_bounds_and_back_removal_rejected(self):
        front={'width':4,'openings':[]}
        spec={'id':'panel','kind':'pilaster','x':1,'width':.3,'projection':.1,'bottom':0,'top':3,
              'panels':[{'bottom':.4,'top':2.7,'margin':.05,'inset':.03}]}
        for change in [{'bottom':0},{'top':3.1},{'margin':0},{'margin':.15},{'inset':.1},{'inset':True},{'top':float('nan')}]:
            bad=copy.deepcopy(spec);bad['panels'][0].update(change)
            with self.assertRaises(ValueError):resolve(bad,front,9)
        bad=copy.deepcopy(spec);bad['panels'].append(copy.deepcopy(bad['panels'][0]))
        with self.assertRaises(ValueError):resolve(bad,front,9)
        for x,z in [(0,8),(4,8),(1,.05)]:
            with self.assertRaises(ValueError):resolve({'id':'c','kind':'corbel','x':x,'z':z},front,9)

def blender_checks():
    import bpy,bmesh
    from mathutils import Vector
    from building_lib.component_details import build_front_components
    from building_lib.layout import SURFACES
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mat=bpy.data.materials.new('test')
    front={'id':'rotated','width':4,'origin':[5,6],'rotation':.7,'openings':[],
        'components':[{'id':'bracket','kind':'corbel','x':2,'z':8.5},
            {'id':'panel','kind':'pilaster','x':1,'width':.3,'bottom':0,'top':3,'projection':.1,
             'panels':[{'bottom':.4,'top':2.7,'margin':.05,'inset':.03}]}]}
    objects=build_front_components({'synthetic':True,'roof':{'eaves':9}},front,lambda *args:mat)
    for obj in objects:
        bm=bmesh.new();bm.from_mesh(obj.data)
        assert all(e.is_manifold for e in bm.edges),obj.name
        assert bm.calc_volume(signed=True)>0,obj.name
        bm.free()
    shaft=next(o for o in objects if 'shaft' in o.name)
    panel=shaft.ray_cast(Vector((1,-1,1.5)),Vector((0,1,0)))[1]
    edge=shaft.ray_cast(Vector((.87,-1,1.5)),Vector((0,1,0)))[1]
    assert abs(panel.y-(SURFACES['shell_front']-.1+.03))<1e-6
    assert abs(panel.y-edge.y-.03)<1e-6,'Panel must be recessed into a retained closed shaft'
    bracket=next(o for o in objects if 'bracket' in o.name)
    assert not bracket.ray_cast(Vector((2,-1,8.35)),Vector((0,1,0)),distance=.8)[0],'Underside must retain its concave silhouette'
    # A crossing bracket is cut by the same aperture owner as a course/pilaster.
    front['openings']=[{'id':'upper','head':'rectangular','x':2,'z':8.5,'width':.5,'height':1}]
    crossing=build_front_components({'synthetic':True,'roof':{'eaves':9}},front,lambda *args:mat)
    for obj in crossing:
        if obj.get('componentKind')=='corbel':
            assert not obj.ray_cast(Vector((2,-1,8.5)),Vector((0,1,0)),distance=2)[0]
    print('CORNICE_PANEL_BLENDER_RESULT closed positive volumes, blind recess, concave support and clear crossing aperture pass')

if __name__=='__main__':
    result=unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(Contracts))
    if not result.wasSuccessful():raise SystemExit(1)
    try:import bpy
    except ImportError:pass
    else:blender_checks()
