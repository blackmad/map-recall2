"""Warehouse contracts and actual mesh geometry through the common composer."""
import copy,json,math,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib.warehouse import shutter_layout,transform_point,warehouse_opening_spec,validate_warehouse,hoist_plan
from building_lib.apertures import from_spec
from building_lib.polygons import area
from building_lib.schema import validate
from building_lib.ir import resolve
FIXTURE=ROOT/'scripts/blender/building_lib/fixtures/warehouse-components/loading-shutters.json'
OUTPUT=ROOT/'artifacts/warehouse-components'

def fixture():return resolve(json.loads(FIXTURE.read_text()))

class Contracts(unittest.TestCase):
    def setUp(self):self.recipe=fixture();self.item=self.recipe['frontages'][0]['openings'][0]
    def test_common_ir_valid_and_explicitly_synthetic(self):
        self.assertTrue(self.recipe['synthetic']);self.assertEqual(validate(self.recipe),[])
    def test_arch_is_clipped_not_replaced_by_rectangle(self):
        self.item['warehouse']['leafGap']=0
        leaves=shutter_layout(self.item);outline=from_spec(self.item)
        self.assertAlmostEqual(sum(abs(area(leaf['outline'])) for leaf in leaves),abs(area(outline)),places=8)
        self.assertEqual(len(leaves),2)
        self.assertGreater(len(leaves[0]['outline']),4)
        for leaf in leaves:
            hinge=leaf['hinge'][0];xs=[p[0] for p in leaf['outline']]
            self.assertAlmostEqual(hinge,min(xs) if leaf['side']=='left' else max(xs))
            self.assertTrue(all(x<=self.item['x']+1e-9 if leaf['side']=='left' else x>=self.item['x']-1e-9 for x in xs))
    def test_gap_and_rotations_preserve_hinge_and_project_streetward(self):
        for angle in (0,45,90,135,180):
            self.item['warehouse']['shutters']['angle']=angle
            left,right=shutter_layout(self.item)
            self.assertAlmostEqual(min(x for x,z in right['outline'])-max(x for x,z in left['outline']),.012)
            for leaf in (left,right):
                hx,hy=leaf['hinge'];self.assertEqual(transform_point(leaf,(hx,0,1)),(hx,hy,1))
                seam_x=max(x for x,z in leaf['outline']) if leaf['side']=='left' else min(x for x,z in leaf['outline'])
                x,y,z=transform_point(leaf,(seam_x,0,1))
                self.assertLessEqual(y,hy+1e-9)
                if angle==90:self.assertAlmostEqual(x,hx);self.assertLess(y,hy-.7)
                if angle==180:self.assertLess(x,hx) if leaf['side']=='left' else self.assertGreater(x,hx)
    def test_joinery_defaults_do_not_mutate_or_erase_authored_values(self):
        before=copy.deepcopy(self.item);spec=warehouse_opening_spec(self.item)
        self.assertEqual(self.item,before);self.assertIsNone(spec['transom']);self.assertEqual(spec['mullions'],[])
        self.item.update(transom=.3,mullions=[.5]);spec=warehouse_opening_spec(self.item)
        self.assertEqual(spec['transom'],.3);self.assertEqual(spec['mullions'],[.5])
    def test_invalid_inputs_are_schema_errors(self):
        for options in ({'angle':-1},{'angle':181},{'angle':True},{'angle':float('nan')},{'style':'fabric'},{'thickness':.001},{'thickness':.12,'hingeDepth':-.18},{'material':'no-such-material'},{'colour':'wrong'}):
            r=fixture();r['frontages'][0]['openings'][0]['warehouse']['shutters'].update(options)
            self.assertTrue(validate(r),options)
        for collection in (None,{},'hoist'):
            r=fixture();r['frontages'][0]['warehouseHoists']=collection;self.assertTrue(validate(r))
        for change in ({'x':-1},{'z':20},{'projection':.05},{'id':4},{'colour':None}):
            r=fixture();r['frontages'][0]['warehouseHoists'][0].update(change);self.assertTrue(validate(r),change)
    def test_hoist_defaults_and_duplicate_ids(self):
        spec=hoist_plan({'id':'beam','x':3,'z':9},6);self.assertEqual(spec['projection'],1);self.assertEqual(spec['tipRise'],0)
        r=fixture();r['frontages'][0]['warehouseHoists']*=2;self.assertTrue(validate(r))
    def test_raised_hoist_requires_nonnegative_finite_rise(self):
        self.assertEqual(hoist_plan({'id':'beam','x':3,'z':9,'tipRise':.75},6)['tipRise'],.75)
        for rise in (-.1,float('nan'),True,'high'):
            with self.assertRaises(ValueError):hoist_plan({'id':'beam','x':3,'z':9,'tipRise':rise},6)
    def test_provenance_fallback_does_not_assert_synthetic_evidence(self):
        del self.item['provenance'];del self.item['warehouse']['provenance']
        self.assertEqual(shutter_layout(self.item)[0]['provenance']['status'],'authored')


def blender_checks():
    import bpy,bmesh
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    from building_lib import archetypes
    OUTPUT.mkdir(parents=True,exist_ok=True);cache=OUTPUT/'textures';checks=[]
    def record(name,ok,details=None):
        checks.append({'id':name,'status':'pass' if ok else 'fail','details':details})
    recipe=fixture();objects=archetypes.build(recipe,cache)
    warehouse=[o for o in objects if o.get('warehouseComponent')]
    shutter=[o for o in warehouse if o.get('warehouseComponent')=='paired-shutter']
    record('common-composer-components',len([o for o in shutter if 'closed shutter leaf' in o.name])==8 and len([o for o in warehouse if o.get('warehouseComponent')=='hoist'])==4)
    record('no-residential-loading-door-hardware',not any('loading' in o.name and any(label in o.name for label in ('kick panel','door handle','sash division','recessed mullion')) for o in objects))
    manifold=True;volumes=[]
    for obj in shutter:
        bm=bmesh.new();bm.from_mesh(obj.data)
        manifold &= all(edge.is_manifold for edge in bm.edges)
        volumes.append(bm.calc_volume(signed=True));bm.free()
    record('all-shutter-parts-closed-positive-solids',manifold and all(volume>0 for volume in volumes),{'parts':len(shutter),'minVolume':min(volumes)})
    # Rays test the exported solids, rather than re-implementing clipping.
    leaf_objects=[o for o in shutter if 'closed shutter leaf' in o.name]
    closed=[o for o in leaf_objects if o['featureId']=='ground-loading'];folded=[o for o in leaf_objects if o['featureId']=='upper_2-loading']
    def hit(objects,x,z):
        return any(BVHTree.FromObject(o,bpy.context.evaluated_depsgraph_get()).ray_cast(Vector((x,-2,z)),Vector((0,1,0)),3)[0] is not None for o in objects)
    record('closed-leaves-cover-aperture-with-real-centre-seam',hit(closed,2.65,1.4) and hit(closed,3.35,1.4) and not hit(closed,3,1.4) and not hit(closed,2.21,2.83))
    record('folded-leaves-clear-opening-and-extend-beyond-jambs',not hit(folded,3,7.3) and hit(folded,1.7,7.3) and hit(folded,4.3,7.3))
    projected=[o for o in leaf_objects if o['featureId']=='upper_1-loading']
    narrow=True
    for obj in projected:
        hinge=obj['hingeFacadeMetres'][0]
        narrow &= all(abs((obj.matrix_world@v.co).x-hinge)<=.036 for v in obj.data.vertices)
    record('ninety-degree-leaves-project-streetward-and-clear-loading-centre',narrow and not hit(projected,3,4.43) and min((o.matrix_world@v.co).y for o in projected for v in o.data.vertices)<-1.05)
    hoist_closed=True
    for obj in warehouse:
        if obj.get('warehouseComponent')!='hoist':continue
        bm=bmesh.new();bm.from_mesh(obj.data)
        hoist_closed &= all(edge.is_manifold for edge in bm.edges) and bm.calc_volume(signed=True)>0
        bm.free()
    record('hoist-beam-brace-eye-and-hanger-are-closed-positive-solids',hoist_closed)
    base={o.name:[tuple(o.matrix_world@v.co) for v in o.data.vertices] for o in warehouse}
    shifted=fixture();angle=.63;ox,oy=4.2,-3.1;shifted['frontages'][0].update(origin=[ox,oy],rotation=angle)
    objects=archetypes.build(shifted,cache);transformed=[o for o in objects if o.get('warehouseComponent')]
    max_error=0
    for obj in transformed:
        for v,original in zip(obj.data.vertices,base[obj.name]):
            x,y,z=original;expected=Vector((ox+math.cos(angle)*x-math.sin(angle)*y,oy+math.sin(angle)*x+math.cos(angle)*y,z))
            max_error=max(max_error,(obj.matrix_world@v.co-expected).length)
    record('rotated-translated-facade-preserves-baked-hinges-and-hoist',max_error<3e-6,max_error)
    raised=fixture();spec=raised['frontages'][0]['warehouseHoists'][0];spec['tipRise']=.75
    objects=archetypes.build(raised,cache);bpy.context.view_layer.update()
    parts=[o for o in objects if o.get('featureId')==spec['id'] and o.get('warehouseComponent')=='hoist']
    solid=True
    for obj in parts:
        bm=bmesh.new();bm.from_mesh(obj.data)
        solid &= all(e.is_manifold for e in bm.edges) and bm.calc_volume(signed=True)>0;bm.free()
    record('raised-hoist-parts-remain-closed-positive-solids',solid and len(parts)==4)
    timber=next(o for o in parts if 'heavy timber beam' in o.name)
    tip=timber.matrix_world@Vector((0,0,max(v.co.z for v in timber.data.vertices)))
    record('raised-hoist-tip-rises-streetward-from-wall-mount',
           abs(tip.z-(spec['z']+.75))<2e-6 and abs(tip.y-(-.035-spec.get('projection',1)))<2e-6,
           {'tip':list(tip),'mountZ':spec['z']})
    eye=next(o for o in parts if 'iron hoist eye' in o.name)
    eye_z=sum((eye.matrix_world@v.co).z for v in eye.data.vertices)/len(eye.data.vertices)
    record('raised-hoist-eye-follows-elevated-tip',spec['z']+.4<eye_z<tip.z,{'eyeCentreZ':eye_z})
    result={'status':'pass' if all(c['status']=='pass' for c in checks) else 'fail','checks':checks}
    (OUTPUT/'geometry-checks.json').write_text(json.dumps(result,indent=2)+'\n')
    for check in checks:print('WAREHOUSE_CHECK '+json.dumps(check),flush=True)
    if result['status']!='pass':raise RuntimeError('Warehouse geometry checks failed')

if __name__=='__main__':
    result=unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(Contracts))
    if not result.wasSuccessful():raise SystemExit(1)
    try:import bpy
    except ImportError:print('Pure warehouse contracts passed; Blender geometry checks not run.')
    else:blender_checks()
