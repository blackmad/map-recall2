"""Pure semantic-shell topology, measured roofs and frontage ownership."""
import copy,json,math,unittest
from pathlib import Path
from building_lib.source_massing import compile_source_massing,_tessellate_rings
from building_lib.polygons import area
from building_lib.schema import validate

FIXTURE=Path(__file__).parent/'building_lib/fixtures/synthetic-source-compound.json'

class SourceMassingContracts(unittest.TestCase):
    def recipe(self):return json.loads(FIXTURE.read_text())

    def test_measured_roofs_base_and_unowned_wing_preserved(self):
        recipe=self.recipe();compiled=compile_source_massing(recipe)
        self.assertEqual(validate(recipe),[])
        self.assertEqual(compiled.audit['groundLoopsClosed'],1)
        self.assertEqual(compiled.audit['sourceRoofCount'],2)
        self.assertEqual(compiled.audit['frontageOwnedAreaM2']['street'],32)
        for row in compiled.surfaces:
            if row['type']=='roof':
                expected=recipe['sourceShell']['surfaces'][row['index']]['rings'][0][0][2]
                self.assertTrue(all(abs(p[2]-expected)<1e-8 for p in row['vertices']))
                if row['index']==5:self.assertGreaterEqual(min(p[1] for p in row['vertices']),.24-1e-8)
        self.assertTrue(any(s['index']==6 for s in compiled.surfaces))
        self.assertFalse(any(s['index']==0 for s in compiled.surfaces))

    def test_partial_frontage_keeps_coplanar_unowned_interval(self):
        recipe=self.recipe();recipe['frontages'][0]['width']=2;recipe['frontages'][0]['profile']=[[0,8],[2,8]]
        compiled=compile_source_massing(recipe)
        retained=next(s for s in compiled.surfaces if s['index']==0)
        projected_area=sum(abs(area([(retained['vertices'][i][0],retained['vertices'][i][2]) for i in face])) for face in retained['triangles'])
        self.assertAlmostEqual(projected_area,16)
        self.assertGreaterEqual(min(p[0] for p in retained['vertices']),2)

    def test_translated_rotated_source_keeps_exact_roof_and_ownership(self):
        recipe=self.recipe();angle=math.pi/2
        def transform(p):return [-7+math.cos(angle)*p[0]-math.sin(angle)*p[1],-3+math.sin(angle)*p[0]+math.cos(angle)*p[1],*p[2:]]
        recipe['footprint']=[transform(p) for p in recipe['footprint']]
        for surface in recipe['sourceShell']['surfaces']:surface['rings']=[[transform(p) for p in ring] for ring in surface['rings']]
        recipe['frontages'][0].update(origin=[-7,-3],rotation=angle)
        compiled=compile_source_massing(recipe)
        self.assertAlmostEqual(compiled.audit['frontageOwnedAreaM2']['street'],32)
        self.assertEqual(compiled.audit['sourceRoofCount'],2)
        self.assertEqual(compiled.audit['groundLoopsClosed'],1)

    def test_hole_triangles_preserve_area_and_leave_hole_open(self):
        outer=[(0,0,2),(6,0,2),(6,6,2),(0,6,2)]
        hole=[(2,2,2),(2,4,2),(4,4,2),(4,2,2)]
        for rings in ([outer,hole],[list(reversed(outer)),list(reversed(hole))]):
            points,faces,error=_tessellate_rings(rings,.03)
            self.assertAlmostEqual(sum(abs(area([points[i][:2] for i in face])) for face in faces),32)
            for face in faces:
                x=sum(points[i][0] for i in face)/3;y=sum(points[i][1] for i in face)/3
                self.assertFalse(2<x<4 and 2<y<4)
        with self.assertRaises(ValueError):_tessellate_rings([outer,[(x+8,y,z) for x,y,z in hole]],.03)

    def test_explicit_wall_selection_revision_and_depth_are_checked(self):
        recipe=self.recipe();front=recipe['frontages'][0]
        front['sourceWallSelection']={'surfaceIndices':[0], 'depthRange':[-.01,.01], 'geometryRevision':recipe['geometryRevision'],
                                     'provenance':{'basis':'synthetic','note':'Explicit fixture street wall ownership'}}
        self.assertEqual(compile_source_massing(recipe).audit['removedOwnedWallSurfaces'],1)
        for change in ({'surfaceIndices':[5]},{'surfaceIndices':[999]}, {'geometryRevision':'stale'}, {'depthRange':[.1,.2]}, {'provenance':{}}, {'provenance':{'basis':'inferred','note':' '}}):
            bad=copy.deepcopy(recipe);bad['frontages'][0]['sourceWallSelection'].update(change)
            with self.assertRaises(ValueError):compile_source_massing(bad)

    def test_staggered_multiple_holes_preserve_all_voids(self):
        outer=[(0,0,3),(12,0,3),(12,12,3),(0,12,3)]
        holes=[[(1,1,3),(1,4,3),(3,4,3),(3,1,3)],
               [(5,3,3),(5,7,3),(7,7,3),(7,3,3)],
               [(9,6,3),(9,10,3),(11,10,3),(11,6,3)]]
        points,faces,_=_tessellate_rings([outer]+holes,.03)
        self.assertAlmostEqual(sum(abs(area([points[i][:2] for i in face])) for face in faces),144-6-8-8)
        for face in faces:
            x=sum(points[i][0] for i in face)/3;y=sum(points[i][1] for i in face)/3
            self.assertFalse((1<x<3 and 1<y<4) or (5<x<7 and 3<y<7) or (9<x<11 and 6<y<10))

    def test_invalid_shell_preflight(self):
        recipe=self.recipe()
        mutations=[lambda r:r['sourceShell']['surfaces'].pop(5),
                   lambda r:r['sourceShell']['surfaces'].append(copy.deepcopy(r['sourceShell']['surfaces'][5])),
                   lambda r:r['sourceShell']['surfaces'][5]['rings'][0][0].__setitem__(2,float('nan'))]
        for mutate in mutations:
            bad=copy.deepcopy(recipe);mutate(bad)
            with self.assertRaises(ValueError):compile_source_massing(bad)
            self.assertTrue(validate(bad))

if __name__=='__main__':unittest.main()
