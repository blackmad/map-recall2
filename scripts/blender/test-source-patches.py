"""Revision-bound inferred patches preserve source interfaces and owner anchors."""
import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from building_lib.source_patches import apply_source_patches
from building_lib.source_massing import compile_source_massing

class SourcePatches(unittest.TestCase):
    def fixture(self):
        recipe=json.loads((Path(__file__).parent/'building_lib/fixtures/synthetic-source-compound.json').read_text())
        ring=recipe['sourceShell']['surfaces'][5]['rings'][0];middle=[2,4,7.5]
        surfaces=[copy.deepcopy(recipe['sourceShell']['surfaces'][0])]+[{'type':'roof','rings':[[a,b,middle]]} for a,b in zip(ring,ring[1:]+ring[:1])]
        recipe['massing']['sourcePatches']=[{'id':'bowed-front','mode':'inferred-appearance','geometryRevision':recipe['geometryRevision'],'surfaceIndices':[0,5],'replacementSurfaces':surfaces,'provenance':{'basis':'synthetic contract','note':'Interior bow, fixed exact perimeter.','evidenceKeys':['synthetic-fixture']}}]
        return recipe
    def test_valid_patch_preserves_unowned_wing_source_and_strict_topology(self):
        recipe=self.fixture();original=copy.deepcopy(recipe['sourceShell']);source,excluded,audit=apply_source_patches(recipe)
        self.assertEqual(recipe['sourceShell'],original);self.assertEqual(excluded,{0,5})
        self.assertEqual(source['surfaces'][:len(original['surfaces'])],original['surfaces'])
        self.assertTrue(audit[0]['exactDirectedBoundaryPreserved']);self.assertEqual(audit[0]['addedCoordinates'],[[2,4,7.5]])
        compiled=compile_source_massing(recipe)
        self.assertTrue(compiled.audit['sourceClosedAboveGround']);self.assertEqual(compiled.audit['groundLoopsClosed'],1)
        for index in [6,7,8,9]:
            self.assertTrue(any(s['index']==index for s in compiled.surfaces))
    def test_invalid_contracts_and_neighbor_removal_rejected(self):
        for change in ({'geometryRevision':'stale'},{'mode':'source-retained'},{'surfaceIndices':[0,6]},{'surfaceIndices':[True]},{'provenance':{'basis':'x','note':'x'}},{'surfaceIndices':[999]}):
            recipe=self.fixture();recipe['massing']['sourcePatches'][0].update(change)
            with self.assertRaises(ValueError):apply_source_patches(recipe)
        recipe=self.fixture();recipe['massing']['sourcePatches'].append(copy.deepcopy(recipe['massing']['sourcePatches'][0]));recipe['massing']['sourcePatches'][1]['id']='overlap'
        with self.assertRaises(ValueError):apply_source_patches(recipe)
    def test_boundary_reflection_holes_and_height_changes_rejected(self):
        for mutation in ('boundary','reverse','height','ground','hole'):
            recipe=self.fixture();surfaces=recipe['massing']['sourcePatches'][0]['replacementSurfaces']
            if mutation=='boundary':surfaces[0]['rings'][0][0]=[0,.1,0]
            if mutation=='reverse':surfaces[0]['rings'][0].reverse()
            if mutation=='height':
                for s in surfaces[1:]:s['rings'][0][2]=[2,4,9]
            if mutation=='ground':
                for s in surfaces[1:]:s['rings'][0][2]=[2,4,0]
            if mutation=='hole':surfaces[0]['rings'].append([[1,0,1],[1.1,0,1],[1.1,0,1.1]])
            with self.assertRaises(ValueError):apply_source_patches(recipe)
    def test_extent_and_owner_guards(self):
        recipe=self.fixture()
        for surface in recipe['massing']['sourcePatches'][0]['replacementSurfaces'][1:]:surface['rings'][0][2]=[100,4,7.5]
        with self.assertRaisesRegex(ValueError,'envelope'):apply_source_patches(recipe)
        recipe=self.fixture();recipe['footprint']=[[0,0],[4,0],[4,8],[3,8],[3,3],[1,3],[1,8],[0,8]]
        with self.assertRaisesRegex(ValueError,'footprint'):apply_source_patches(recipe)

    def test_extra_closed_interior_component_rejected(self):
        recipe = self.fixture()
        a, b, c, d = [1,2,2], [2,2,2], [1,3,2], [1,2,3]
        faces = [[a,c,b], [a,b,d], [b,c,d], [c,a,d]]
        recipe['massing']['sourcePatches'][0]['replacementSurfaces'].extend(
            {'type':'wall', 'rings':[face]} for face in faces)
        with self.assertRaisesRegex(ValueError, 'disconnected'):
            apply_source_patches(recipe)

    def test_removing_unique_interior_height_anchor_rejected(self):
        recipe=self.fixture()
        ring=copy.deepcopy(recipe['sourceShell']['surfaces'][5]['rings'][0])
        peak=[2,4,8.5]
        roof=[{'type':'roof','rings':[[a,b,peak]]} for a,b in zip(ring,ring[1:]+ring[:1])]
        first_added=len(recipe['sourceShell']['surfaces'])
        recipe['sourceShell']['surfaces'][5]=roof[0]
        recipe['sourceShell']['surfaces'].extend(roof[1:])
        recipe['massing']['sourcePatches'][0]['surfaceIndices']=[0,5]+list(range(first_added,first_added+len(roof)-1))
        # Boundary and envelope still pass, but lowering the only interior peak
        # would make the audit's ownerVerticalAnchorsPreserved claim false.
        with self.assertRaisesRegex(ValueError,'removed owner vertical anchors'):
            apply_source_patches(recipe)

    def test_positive_multiple_hole_interface(self):
        recipe = self.fixture()
        # Two independently preserved openings in the selected wall. Unchanged
        # wall and bowed roof remain connected through their shared top edge.
        holes = [
            [[.5,0,1],[.5,0,2],[1,0,2],[1,0,1]],
            [[2,0,1],[2,0,2],[2.5,0,2],[2.5,0,1]],
        ]
        recipe['sourceShell']['surfaces'][0]['rings'].extend(copy.deepcopy(holes))
        recipe['massing']['sourcePatches'][0]['replacementSurfaces'][0]['rings'].extend(copy.deepcopy(holes))
        original = copy.deepcopy(recipe['sourceShell'])
        source, excluded, audit = apply_source_patches(recipe)
        self.assertEqual(recipe['sourceShell'], original)
        self.assertEqual(excluded, {0,5})
        self.assertEqual(source['surfaces'][10]['rings'][1:], holes)
        self.assertTrue(audit[0]['exactDirectedBoundaryPreserved'])
        self.assertTrue(audit[0]['replacementComponentsMeetInterface'])
        self.assertGreaterEqual(len(audit[0]['preservedDirectedBoundaryEdges']), 8)

    def test_attachment_source_and_derived_support_are_distinct(self):
        from building_lib.source_attachments import attachment_roof
        recipe=self.fixture()
        with self.assertRaises(ValueError):attachment_roof(recipe,{'sourceSurfaceIndices':[5]})
        with self.assertRaises(ValueError):attachment_roof(recipe,{'sourceSurfaceIndices':[11]})
        valid={'supportMode':'inferred-appearance-patch','sourcePatchId':'bowed-front','derivedSurfaceIndices':[11,12,13,14,15], 'provenance':{'status':'inferred'}}
        surface=attachment_roof(recipe,valid);self.assertAlmostEqual(surface.height(2,4),7.5)
        for change in ({'sourcePatchId':'wrong'},{'provenance':{'status':'measured'}},{'sourceSurfaceIndices':[5]},{'derivedSurfaceIndices':[9]}):
            with self.assertRaises(ValueError):attachment_roof(recipe,{**valid,**change})
        attachment_roof(recipe,{'sourceSurfaceIndices':[9]})

if __name__=='__main__':unittest.main(argv=[sys.argv[0]])
