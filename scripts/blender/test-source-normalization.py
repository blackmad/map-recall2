"""Exact source duplicate removal, including strict actual-source compilation."""
import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'expansion'))
from building_lib.source_normalization import normalize_source_shell,SourceNormalizationError
from building_lib.source_massing import compile_source_massing,_tessellate_rings
from building_lib.polygons import area
from seed_to_ir import foundation

class ExactNormalization(unittest.TestCase):
    def test_fixture_immutable_area_holes_and_coordinates(self):
        source={'surfaces':[{'type':'roof','rings':[
            [[0,0,2],[6,0,2],[6,0,2],[6,6,2],[0,6,2],[0,0,2],[0,0,2]],
            [[2,2,2],[2,4,2],[4,4,2],[4,4,2],[4,2,2],[2,2,2]]]}]}
        before=copy.deepcopy(source);fixed,audit=normalize_source_shell(source,'fixture-v1')
        self.assertEqual(source,before);self.assertEqual(audit['removedVertexCount'],5)
        self.assertEqual(normalize_source_shell(fixed,'fixture-v1')[1]['removedVertexCount'],0)
        points,faces,_=_tessellate_rings(fixed['surfaces'][0]['rings'],.03)
        self.assertAlmostEqual(sum(abs(area([points[i][:2] for i in f])) for f in faces),32)
        for f in faces:
            x=sum(points[i][0] for i in f)/3;y=sum(points[i][1] for i in f)/3
            self.assertFalse(2<x<4 and 2<y<4)
        self.assertTrue(all(list(p) in source['surfaces'][0]['rings'][0]+source['surfaces'][0]['rings'][1] for p in points))

    def test_closed_compound_and_invalid_exclusions(self):
        recipe=json.loads((Path(__file__).parent/'building_lib/fixtures/synthetic-source-compound.json').read_text())
        baseline=compile_source_massing(recipe)
        for surface in recipe['sourceShell']['surfaces']:
            for ring in surface['rings']:ring.insert(1,copy.deepcopy(ring[0]));ring.append(copy.deepcopy(ring[0]))
        original=copy.deepcopy(recipe['sourceShell']);compiled=compile_source_massing(recipe)
        self.assertEqual(recipe['sourceShell'],original)
        self.assertEqual(compiled.surfaces,baseline.surfaces)
        self.assertEqual(compiled.audit['groundLoopsClosed'],1)
        self.assertTrue(compiled.audit['sourceClosedAboveGround'])
        good={'geometryRevision':recipe['geometryRevision'],'surfaceIndices':[0],'provenance':{'basis':'fixture','note':'attempt valid-surface exclusion'}}
        for change in ({},{'geometryRevision':'stale'},{'provenance':{}},{'surfaceIndices':[True]}):
            spec={**good,**change}
            with self.assertRaises(ValueError):normalize_source_shell(original,recipe['geometryRevision'],spec)

    def test_small_valid_edge_not_removed_or_tolerance_relaxed(self):
        recipe=json.loads((Path(__file__).parent/'building_lib/fixtures/synthetic-source-compound.json').read_text())
        ring=recipe['sourceShell']['surfaces'][0]['rings'][0];ring.insert(1,[ring[0][0]+.00001,*ring[0][1:]])
        fixed,audit=normalize_source_shell(recipe['sourceShell'],recipe['geometryRevision'])
        self.assertEqual(audit['removedVertexCount'],0);recipe['sourceShell']=fixed
        with self.assertRaisesRegex(ValueError,'millimetre'):compile_source_massing(recipe)

    def test_actual_brouwers_source_postrepair_topology(self):
        path=Path('artifacts/jordaan-building-library/source-seeds/0363100012176879.json')
        seed=json.loads(path.read_text());recipe,_=foundation(seed,'brouwers-source-audit','Brouwers source audit','Brouwersgracht907–925',3,2)
        recipe['massing']={'mode':'source-derived','frontageTolerance':.04,'maxPlanarityDeviation':.03}
        recipe['gable']['profile']=[[0,recipe['height']],[recipe['frontages'][0]['width'],recipe['height']]]
        original=copy.deepcopy(recipe['sourceShell'])
        with self.assertRaises(SourceNormalizationError) as caught:normalize_source_shell(original,recipe['geometryRevision'])
        audit=caught.exception.audit
        self.assertEqual([(r['surfaceIndex'],r['ringIndex'],r['vertexIndex']) for r in audit['removedVertices']],[(18,0,1),(21,0,2)])
        self.assertEqual(audit['degenerateRings'],[{'surfaceIndex':18,'ringIndex':0,'retainedDistinctVertices':2}])
        self.assertEqual(recipe['sourceShell'],original)
        with self.assertRaisesRegex(ValueError,'degenerate'):compile_source_massing(recipe)
        recipe['massing']['sourceNormalization']={'geometryRevision':recipe['geometryRevision'],'surfaceIndices':[18],'provenance':{'basis':'Exact cached-source duplicate audit','note':'Surface18 is [A,A,B], zero area; omit only this explicitly bound degenerate face.'}}
        compiled=compile_source_massing(recipe)
        self.assertEqual(recipe['sourceShell'],original)
        self.assertEqual(compiled.audit['sourceSurfaceCount'],83)
        self.assertEqual(compiled.audit['sourceNormalization']['excludedSurfaces'][0]['surfaceIndex'],18)
        # The valid adjacent wall repair passes triangulation, without accepting the owner.
        wall=copy.deepcopy(original);wall['surfaces']=[original['surfaces'][21]]
        fixed,_=normalize_source_shell(wall,recipe['geometryRevision'])
        _tessellate_rings(fixed['surfaces'][0]['rings'],.03)
        target=Path('artifacts/jordaan-building-library/brouwers-normalization');target.mkdir(exist_ok=True)
        (target/'source-repair-probe.recipe.json').write_text(json.dumps(recipe,indent=2))
        (target/'audit.json').write_text(json.dumps({'normalization':audit,'postRepairStatus':'strict source compiler passed with explicit revision-bound surface18 exclusion','postRepairCompilerAudit':compiled.audit,'scope':'source geometry only; not authored or accepted reconstruction'},indent=2))

if __name__=='__main__':unittest.main()
