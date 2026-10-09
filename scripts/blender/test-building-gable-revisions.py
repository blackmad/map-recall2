"""Roof/gable regression contracts; geometry does not establish visual acceptance."""
import json,sys,unittest,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib import ir
from building_lib.gables import profile
from building_lib.roof_surfaces import silhouette_height,roof_height,pitch_profile,compile_roof
from building_lib.schema import validate

def load(path):return ir.resolve(json.loads((ROOT/'scripts/blender/building_lib'/path).read_text()))

class Contracts(unittest.TestCase):
    def test_raised_preserves_every_original_shape_ratio(self):
        for family in ('neck','bell'):
            base=profile(family,6,8,3);raised=profile(family,6,8,3,.35)
            self.assertEqual(len(raised),len(base)+2)
            for (x,z),(rx,rz) in zip(base,raised[1:-1]):
                self.assertAlmostEqual(x,rx);self.assertAlmostEqual(rz-z,.35)
    def test_shallow_roof_entire_envelope_fits_decorative_silhouette(self):
        for family in ('neck','bell'):
            r=load('fixtures/roof-components/raised-'+family+'-pitched.json');w=r['frontages'][0]['width']
            for i in range(601):
                x=w*i/600;self.assertLessEqual(roof_height(r['roof'],w,x),silhouette_height(r['gable']['profile'],x)+1e-6,(family,x))
    def test_gambrel_covering_and_front_knots_are_parallel(self):
        for path in ('fixtures/roof-components/gambrel-warehouse.json','fixtures/warehouse-components/loading-shutters.json'):
            r=load(path);w=r['frontages'][0]['width'];p=pitch_profile(r['roof'],w)
            for x,z in p[1:-1]:self.assertAlmostEqual(silhouette_height(r['gable']['profile'],x)-z,.06)
            left,knee,ridge=p[:3]
            self.assertGreater((knee[1]-left[1])/(knee[0]-left[0]),4*(ridge[1]-knee[1])/(ridge[0]-knee[0]))
    def test_r158_symmetry_preserves_binding_and_inferred_status(self):
        r=load('recipes/rozengracht-158.json');w=r['frontages'][0]['width'];p=r['gable']['profile']
        for a,b in zip(p,reversed(p)):self.assertAlmostEqual(a[0]+b[0],w);self.assertAlmostEqual(a[1],b[1])
        self.assertEqual(r['gable']['status'],'inferred');self.assertEqual(r['gable']['material'],'whiterender');self.assertEqual(validate(r),[])
        self.assertAlmostEqual(r['roof']['eaves'],12.315649992704392);self.assertAlmostEqual(r['roof']['top'],14.038999991416933)
        self.assertEqual(len(r['gable']['provenance']['sources']),3)
    def test_front_hip_is_one_transverse_plane_intersecting_real_pitches(self):
        r=load('recipes/rozengracht-158.json');surface=compile_roof(r);spec=r['roof'];w=r['frontages'][0]['width']
        for x in (.5,1.3,w/2,2.4,3):
            for y in (.3,.75,1.7,4):
                expected=min(roof_height(spec,w,x),spec['eaves']+(spec['top']-spec['eaves'])*(y-spec['setback'])/spec['frontHipRun'])
                self.assertAlmostEqual(surface.height(x,y),expected,places=7)
        # Covering starts at the common wall-back plane with no folded spikes.
        self.assertTrue(all(abs(surface.vertices[a][2]-spec['eaves'])<1e-7 and abs(surface.vertices[b][2]-spec['eaves'])<1e-7
                            for a,b in surface.boundary if abs(surface.vertices[a][1]-spec['setback'])<1e-7 and abs(surface.vertices[b][1]-spec['setback'])<1e-7))
    def test_invalid_front_hip_parameters_fail_preflight(self):
        for value in (None,True,0,-1,float('nan'),100):
            r=load('recipes/rozengracht-158.json');r['roof']['frontHipRun']=value;self.assertTrue(validate(r))
        r=load('recipes/rozengracht-158.json');r['roof']['frontJoin']='folded';self.assertTrue(validate(r))
    def test_gable_material_rejects_invalid_parameters(self):
        for changes in ({'material':'bad'},{'colour':'bad'},{'colour':None}):
            r=load('recipes/rozengracht-158.json');r['gable'].update(changes);self.assertTrue(validate(r))


def blender_checks():
    import bpy,bmesh
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    from building_lib import archetypes
    r=load('recipes/rozengracht-158.json');objects=archetypes.build(r,ROOT/'artifacts/roof-gable-revision/textures')
    wall=next(o for o in objects if o.name=='Facade / shaped street wall');datum=r['roof']['eaves'];checks=[]
    def record(name,ok,details=None):checks.append({'id':name,'status':'pass' if ok else 'fail','details':details})
    bm=bmesh.new();bm.from_mesh(wall.data)
    record('gable-material-split-retains-closed-solid',all(edge.is_manifold for edge in bm.edges) and bm.calc_volume(signed=True)>0)
    record('material-faces-do-not-span-eaves-datum',all(not(min(v.co.z for v in face.verts)<datum-1e-6 and max(v.co.z for v in face.verts)>datum+1e-6) for face in bm.faces))
    upper=[face for face in bm.faces if face.calc_center_median().z>datum+1e-6]
    record('actual-upper-wall-faces-use-pale-gable-material',bool(upper) and all(wall.data.materials[face.material_index]['materialId']=='whiterender' for face in upper))
    bm.free();tree=BVHTree.FromObject(wall,bpy.context.evaluated_depsgraph_get());attic=r['frontages'][0]['openings'][6]
    record('gable-material-keeps-attic-aperture-clear',tree.ray_cast(Vector((attic['x'],-1,attic['z'])),Vector((0,1,0)),2)[0] is None)
    report={'status':'pass' if all(c['status']=='pass' for c in checks) else 'fail','checks':checks};out=ROOT/'artifacts/roof-gable-revision';out.mkdir(parents=True,exist_ok=True);(out/'material-geometry-checks.json').write_text(json.dumps(report,indent=2)+'\n')
    for check in checks:print('GABLE_CHECK '+json.dumps(check),flush=True)
    if report['status']!='pass':raise RuntimeError('Gable material geometry failed')

if __name__=='__main__':
    result=unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(Contracts))
    if not result.wasSuccessful():raise SystemExit(1)
    try:import bpy
    except ImportError:print('Pure roof/gable contracts passed; Blender checks not run.')
    else:blender_checks()
