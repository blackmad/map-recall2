"""Pure component contracts plus opt-in Blender integration and render checks."""
import copy,json,math,sys,unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib.component_catalog import resolve,resolve_zone,validate_components
FIXTURE=ROOT/'scripts/blender/building_lib/recipes/synthetic-dressed-block.json'
OUTPUT=ROOT/'artifacts/building-library/components'


class Contracts(unittest.TestCase):
    def setUp(self):self.recipe=json.loads(FIXTURE.read_text());self.front=self.recipe['frontages'][0]
    def test_ordinary_fixture_valid(self):self.assertEqual(validate_components(self.recipe),[])
    def test_opening_anchor_tracks_changed_opening(self):
        opening=self.front['openings'][4];opening.update(x=7.1,z=4.7,width=3.1)
        resolved=resolve({'id':'lintel','kind':'lintel','openingId':opening['id']},self.front,9)
        self.assertAlmostEqual(resolved['x'],7.1);self.assertAlmostEqual(resolved['width'],3.4)
        self.assertGreater(resolved['z']-resolved['height']/2,opening['z'])
    def test_profile_does_not_depend_on_gable(self):
        before=resolve({'id':'cornice','kind':'cornice'},self.front,9)
        self.recipe['gable']['profile']=[[0,9],[6.75,12],[13.5,9]]
        self.assertEqual(resolve({'id':'cornice','kind':'cornice'},self.front,9),before)
    def test_invalid_inputs_fail_before_scene(self):
        for raw in [ {'id':'q','kind':'quoins','spacing':.1}, {'id':'p','kind':'pilaster'},
                     {'id':'s','kind':'sill','openingId':'missing'}, {'id':'a','kind':'unknown'},
                     {'id':'l','kind':'lintel','openingId':'upper_1-left','height':float('nan')} ]:
            with self.assertRaises(ValueError):resolve(raw,self.front,9)
    def test_zone_overlap_rejected(self):
        self.front['materialZones'].append(copy.deepcopy(self.front['materialZones'][0]))
        self.assertTrue(any('overlap' in e for e in validate_components(self.recipe)))
    def test_furniture_dimensions_and_placement(self):
        for raw in self.recipe['siteComponents']:
            result=resolve(raw,site=True)
            self.assertGreater(result['height'],0);self.assertEqual(result['position'][2],0)
        for raw in [{'id':'chair','kind':'chair','position':[0,0,0],'seatHeight':1},
                    {'id':'table','kind':'table','position':[0,0,-1]},
                    {'id':'planter','kind':'planter','position':[0,0,0],'width':.1}]:
            with self.assertRaises(ValueError):resolve(raw,site=True)
    def test_balcony_uses_explicit_across_bay_span(self):
        result=resolve({'id':'balcony','kind':'balcony','x':6.75,'z':3.6,'width':8.2},self.front,9)
        self.assertEqual(result['width'],8.2);self.assertEqual(result['depth'],.7)
        for changes in ({'width':20},{'z':0},{'depth':-1}):
            spec={'id':'balcony','kind':'balcony','x':6.75,'z':3.6,'width':8.2};spec.update(changes)
            with self.assertRaises(ValueError):resolve(spec,self.front,9)


def blender_checks():
    import bpy
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    from building_lib import archetypes,walls
    from building_lib.component_details import build_front_components,build_site_components
    from building_lib.materials.blender import material
    recipe=json.loads(FIXTURE.read_text());OUTPUT.mkdir(parents=True,exist_ok=True)
    checks=[]
    def record(name,condition,details=None):
        checks.append({'id':name,'status':'pass' if condition else 'fail','details':details})
    cache=OUTPUT/'textures'
    simple=material('redbrick',cache,style='simple');textured=material('redbrick',cache,style='textured')
    record('simple-style-no-textures',not any(n.type=='TEX_IMAGE' for n in simple.node_tree.nodes))
    record('material-style-cache-is-distinct',simple!=textured and material('redbrick',cache,style='simple')==simple)
    glass=material('glass',cache,style='simple')
    record('simple-glass-palette',glass['opaqueMobileFallback'] and glass.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value>.85)
    # Use the integrated ordinary composition, exercising schema/build hooks.
    objects=archetypes.build(recipe,cache)
    component_objects=[o for o in objects if o.get('componentId')]
    expected={s['id'] for s in recipe['frontages'][0]['components']+recipe['siteComponents']+recipe['frontages'][0]['materialZones']}
    record('integrated-components-present',expected <= {o['componentId'] for o in component_objects})
    bpy.context.view_layer.update()
    door=recipe['frontages'][0]['openings'][1]
    zones=[o for o in component_objects if o.get('materialZoneId')]
    clear=True
    for obj in zones:
        tree=BVHTree.FromObject(obj,bpy.context.evaluated_depsgraph_get())
        for z in (.10,1.2,2.50):
            hit=tree.ray_cast(Vector((door['x'],-.5,z)),Vector((0,1,0)),.8)[0]
            if hit is not None:clear=False
    record('zones-keep-entry-clear',clear)
    # Add a separate zone/crossing course with both a door and a recessed owner.
    front={'id':'test','width':6,'origin':[0,0],'openings':[{'id':'door','x':1,'z':1.2,'width':.8,'height':2.4,'head':'rectangular','kind':'door','storey':'ground'}],
           'storefront':{'recessedAssemblies':[{'id':'recess','x':4,'width':2,'sill':0,'head':2.4}]},
           'materialZones':[{'id':'test-zone','x':3,'z':1.3,'width':6,'height':2.6,'material':'creamrender'}],
           'components':[{'id':'crossing-course','kind':'stringcourse','z':1.3,'height':.18}]}
    mat=lambda id,colour=None:material(id,cache,colour,style='simple')
    test_objects=build_front_components(recipe,front,mat)
    clear=True
    for obj in test_objects:
        tree=BVHTree.FromObject(obj,bpy.context.evaluated_depsgraph_get())
        for x in (1,4):
            if tree.ray_cast(Vector((x,-.5,1.3)),Vector((0,1,0)),.8)[0] is not None:clear=False
    record('zone-and-course-share-recessed-cutters',clear)
    for obj in test_objects:bpy.data.objects.remove(obj,do_unlink=True)
    # Furniture bottoms coincide with their explicit street datum after rotation.
    sites=[o for o in component_objects if o['componentKind'] in ('table','chair','planter')]
    minimum=min((o.matrix_world@Vector(c)).z for o in sites for c in o.bound_box)
    record('furniture-on-street-datum',abs(minimum)<1e-6,minimum)
    record('finite-component-geometry',all(math.isfinite(value) for o in component_objects for v in o.data.vertices for value in v.co))
    from building_lib.geometry import box
    box('Review / pavement',6.75,3,-.18,15,12,.30,material('concrete',cache,style='simple'))
    bpy.ops.object.light_add(type='AREA',location=(4,-9,18));bpy.context.object.data.energy=2200;bpy.context.object.data.size=10
    bpy.ops.object.light_add(type='AREA',location=(16,5,15));bpy.context.object.data.energy=1600;bpy.context.object.data.size=10
    bpy.ops.object.camera_add(location=(17,-20,13));camera=bpy.context.object
    camera.rotation_euler=(Vector((6.75,2,4))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=19
    scene=bpy.context.scene;scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.samples=16
    scene.world.color=(.65,.68,.7);scene.view_settings.view_transform='AgX'
    scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.render.filepath=str(OUTPUT/'ordinary-block.png');bpy.ops.render.render(write_still=True)
    bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT/'ordinary-block.blend'))
    camera.location=(9,-9,5.5);camera.rotation_euler=(Vector((4,-.3,1.4))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=10
    scene.render.filepath=str(OUTPUT/'street-components.png');bpy.ops.render.render(write_still=True)
    (OUTPUT/'blender-checks.json').write_text(json.dumps({'status':'pass' if all(c['status']=='pass' for c in checks) else 'fail','checks':checks},indent=2)+'\n')
    for check in checks:print('COMPONENT_CHECK '+json.dumps(check),flush=True)
    if not all(c['status']=='pass' for c in checks):raise RuntimeError('Component Blender checks failed')


if __name__=='__main__':
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(Contracts)
    result=unittest.TextTestRunner().run(suite)
    if not result.wasSuccessful():raise SystemExit(1)
    try:import bpy
    except ImportError:print('Pure component checks passed; Blender checks not run.')
    else:blender_checks()
