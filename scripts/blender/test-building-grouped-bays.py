"""Grouped-bay contracts and actual closed-shell/aperture geometry."""
import copy,json,math,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib.ir import resolve
from building_lib.schema import validate
from building_lib.grouped_bays import bay_plan,opening_owners
FIXTURE=ROOT/'scripts/blender/building_lib/fixtures/grouped-bays/stacked-return-windows.json'
OUTPUT=ROOT/'artifacts/grouped-bay-pilot'
def fixture():return resolve(json.loads(FIXTURE.read_text()))

class Contracts(unittest.TestCase):
    def test_fixture_valid_and_continuous_across_storeys(self):
        r=fixture();self.assertEqual(validate(r),[])
        plan=bay_plan(r['frontages'][0]['groupedBays'][0],r['frontages'][0],9)
        self.assertEqual(len(plan['openings']),2);self.assertEqual(plan['bottom'],3);self.assertEqual(plan['top'],9)
        self.assertGreater(plan['sideReturnAngleDegrees'],70);self.assertLess(plan['sideReturnAngleDegrees'],90)
    def test_plans_do_not_mutate_original_openings(self):
        r=fixture();before=copy.deepcopy(r);front=r['frontages'][0];plan=bay_plan(front['groupedBays'][0],front,9)
        plan['openings'][0]['x']=0;self.assertEqual(r,before)
        self.assertEqual(len(opening_owners(front)),4)
    def test_invalid_geometry_and_materials_rejected(self):
        for change in ({'projection':0},{'projection':2},{'projection':True},{'projection':float('nan')},{'bottom':-1},{'top':10},{'width':.1},{'returnInset':1},{'x':0},{'sideWindows':'yes'},{'material':'bad'},{'frameColour':'bad'}):
            r=fixture();r['frontages'][0]['groupedBays'][0].update(change);self.assertTrue(validate(r),change)
    def test_missing_duplicate_or_incompatible_owners_rejected(self):
        for identifiers in ([],None,['missing'],['left-upper_1','left-upper_1']):
            r=fixture();r['frontages'][0]['groupedBays'][0]['openingIds']=identifiers;self.assertTrue(validate(r))
        r=fixture();front=r['frontages'][0];front['groupedBays'].append(copy.deepcopy(front['groupedBays'][0]));self.assertTrue(validate(r))
        r=fixture();r['frontages'][0]['openings'][0]['head']='segmental';self.assertTrue(validate(r))
    def test_multiple_rows_must_leave_structural_spandrel(self):
        r=fixture();r['frontages'][0]['openings'][1]['z']=5;self.assertTrue(validate(r))
    def test_projection_requires_glazed_return_clearance(self):
        r=fixture();raw=r['frontages'][0]['groupedBays'][1];raw.update(projection=.20,returnInset=0)
        self.assertTrue(validate(r));raw['sideWindows']=False;self.assertEqual(validate(r),[])


def blender_checks():
    import bpy,bmesh
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    from building_lib import archetypes
    OUTPUT.mkdir(parents=True,exist_ok=True);r=fixture();objects=archetypes.build(r,OUTPUT/'textures');checks=[]
    def record(name,ok,details=None):checks.append({'id':name,'status':'pass' if ok else 'fail','details':details})
    min_z=min((o.matrix_world@v.co).z for o in objects for v in o.data.vertices)
    record('whole-exported-fixture-has-no-orphan-below-street-strips',min_z>=-.10,min_z)
    bay_objects=[o for o in objects if o.get('componentKind')=='grouped-bay'];shells=[o for o in bay_objects if 'continuous projecting masonry' in o.name]
    record('integrated-continuous-bay-volumes',len(shells)==2 and {o['componentId'] for o in shells}=={'left-stack','right-stack'})
    closed=True;volumes=[]
    for obj in shells:
        bm=bmesh.new();bm.from_mesh(obj.data);closed &= all(edge.is_manifold for edge in bm.edges);volumes.append(bm.calc_volume(signed=True));bm.free()
    record('projected-shells-closed-positive-after-front-and-side-cuts',closed and all(v>0 for v in volumes),volumes)
    glass=[o for o in bay_objects if 'recessed glazing' in o.name]
    record('one-front-and-two-side-panes-per-group',len(glass)==12 and all(len([o for o in glass if o.get('featureId')==identifier])==3 for identifier in opening_owners(r['frontages'][0])))
    all_owned=[o for o in objects if o.get('featureId') in opening_owners(r['frontages'][0]) and 'recessed glazing' in o.name]
    record('no-duplicate-flat-wall-joinery',len(all_owned)==len(glass) and all(o.get('componentKind')=='grouped-bay' for o in all_owned))
    def ray(obj,origin,direction,length=3):
        inverse=obj.matrix_world.inverted();point=BVHTree.FromObject(obj,bpy.context.evaluated_depsgraph_get()).ray_cast(inverse@Vector(origin),inverse.to_3x3()@Vector(direction),length)[0]
        return obj.matrix_world@point if point is not None else None
    clear=True;solid=True;projected=True
    for shell in shells:
        raw=next(s for s in r['frontages'][0]['groupedBays'] if s['id']==shell['componentId']);plan=bay_plan(raw,r['frontages'][0],9)
        for item in plan['openings']:
            clear &= ray(shell,(item['x'],-2,item['z']),(0,1,0)) is None
            pane=next(o for o in glass if o.get('featureId')==item['id'] and o.get('bayFace')=='front');hit=ray(pane,(item['x'],-2,item['z']),(0,1,0))
            projected &= hit is not None and abs(hit.y-(-plan['projection']+.135))<2e-6
        solid &= ray(shell,(plan['x'],-2,6),(0,1,0)) is not None
    record('true-front-apertures-and-solid-between-storey-spandrels',clear and solid)
    record('front-panes-inset-behind-projecting-face',projected)
    # Side-face rays use actual cut volume and actual return-pane meshes.
    clear=True;inset_ok=True
    for shell in shells:
        raw=next(s for s in r['frontages'][0]['groupedBays'] if s['id']==shell['componentId']);plan=bay_plan(raw,r['frontages'][0],9)
        for side,a,b in [('left',(plan['left'],-.035),(plan['left']+plan['returnInset'],-plan['projection'])),('right',(plan['right']-plan['returnInset'],-plan['projection']),(plan['right'],-.035))]:
            dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy);normal=(-dy/length,dx/length)
            for item in plan['openings']:
                middle=((a[0]+b[0])/2,(a[1]+b[1])/2);origin=(middle[0]-normal[0],middle[1]-normal[1],item['z']);direction=(*normal,0)
                clear &= ray(shell,origin,direction,.24) is None
                pane=next(o for o in glass if o.get('featureId')==item['id'] and o.get('bayFace')==side);hit=ray(pane,origin,direction,2)
                inset_ok &= hit is not None and abs((hit.x-middle[0])*normal[0]+(hit.y-middle[1])*normal[1]-.135)<2e-6
    record('actual-return-apertures-with-recessed-side-panes',clear and inset_ok)
    lower=min((o.matrix_world@v.co).z for o in bay_objects for v in o.data.vertices)
    record('all-bay-joinery-stays-within-authored-storey-volume',lower>=2.9,lower)
    record('all-side-joinery-belongs-to-one-visible-return',all(o.get('bayFace') in ('left','right') for o in bay_objects if 'return' in o.name))
    base={o.name:[tuple(o.matrix_world@v.co) for v in o.data.vertices] for o in bay_objects}
    shifted=fixture();angle=.72;ox,oy=4,-2;shifted['frontages'][0].update(origin=[ox,oy],rotation=angle);objects=archetypes.build(shifted,OUTPUT/'textures');error=0
    for obj in objects:
        if obj.get('componentKind')!='grouped-bay':continue
        for v,(x,y,z) in zip(obj.data.vertices,base[obj.name]):
            expected=Vector((ox+math.cos(angle)*x-math.sin(angle)*y,oy+math.sin(angle)*x+math.cos(angle)*y,z));error=max(error,(obj.matrix_world@v.co-expected).length)
    record('rotated-facade-retains-front-return-and-volume-geometry',error<3e-6,error)
    report={'status':'pass' if all(c['status']=='pass' for c in checks) else 'fail','checks':checks};(OUTPUT/'geometry-checks.json').write_text(json.dumps(report,indent=2)+'\n')
    for check in checks:print('GROUPED_BAY_CHECK '+json.dumps(check),flush=True)
    if report['status']!='pass':raise RuntimeError('Grouped bay geometry checks failed')

if __name__=='__main__':
    result=unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(Contracts))
    if not result.wasSuccessful():raise SystemExit(1)
    try:import bpy
    except ImportError:print('Pure grouped-bay checks passed; Blender checks not run.')
    else:blender_checks()
