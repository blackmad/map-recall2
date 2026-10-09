"""Batch input/evidence isolation and content-verified resume regressions."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from building_lib.batch import load_inputs, evidence_for, fingerprint, can_resume, atomic_json


class BatchTests(unittest.TestCase):
    def test_manifest_relative_and_bad_input_isolation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            atomic_json(root / 'a.json', {'id': 'valid'})
            atomic_json(root / 'unsafe.json', {'id': '../escape'})
            atomic_json(root / 'manifest.json', {'schemaVersion': 1, 'recipes': ['a.json', 'missing.json', 'unsafe.json']})
            records, explicit = load_inputs(root, manifest_path=root / 'manifest.json')
            self.assertTrue(explicit)
            self.assertEqual(records[0]['recipe']['id'], 'valid')
            self.assertTrue(records[1]['errors'])
            self.assertTrue(records[2]['errors'])

    def test_duplicate_id_cannot_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ('a', 'b'):
                atomic_json(root / (name + '.json'), {'id': 'same'})
            records, _ = load_inputs(root)
            self.assertIn('Duplicate', records[1]['errors'][0])

    def test_evidence_owner_revision_and_path(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            atomic_json(root / 'source.json', {'ownerId': 'owner', 'geometryRevision': 'rev',
                                             'physicalFacade': {'frontage': [[0, 0], [5, 0]]}})
            recipe = {'buildingId': 'owner', 'geometryRevision': 'rev', 'sourceBundle': 'source.json',
                      'placement': {'frontageLocal': [[0, 0], [5, 0]]}}
            self.assertEqual(evidence_for(recipe, root)['ownerId'], 'owner')
            for change in ({'buildingId': 'wrong'}, {'geometryRevision': 'old'}, {'sourceBundle': '../outside.json'}):
                with self.assertRaises(ValueError):
                    evidence_for(dict(recipe, **change), root)

    def test_source_rd_frame_binds_physical_plane_not_padded_observation(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            plane={'start':{'x':120000,'y':487000},'end':{'x':120005,'y':487000}}
            bundle={'ownerId':'owner','geometryRevision':'rev','physicalFacade':{'frontage':[[0,0],[5,0]],'plane':plane,'originalObservationPlane':{'start':{'x':119999,'y':487000},'end':{'x':120006,'y':487000}}}}
            frame={'anchorRD':[120000,487000],'xAxisRD':[1,0],'yAxisRD':[0,1],'buildingId':'owner','geometryRevision':'rev'}
            recipe={'buildingId':'owner','geometryRevision':'rev','sourceBundle':'source.json','placement':{'frontageLocal':[[0,0],[5,0]],'sourceRDFrame':frame}}
            atomic_json(root/'source.json',bundle);evidence_for(recipe,root)
            for key,value in (('anchorRD',[119999,487000]),('xAxisRD',[-1,0]),('anchorRD',[float('nan'),0]),('geometryRevision','stale')):
                changed=json.loads(json.dumps(recipe));changed['placement']['sourceRDFrame'][key]=value
                with self.assertRaises(ValueError):evidence_for(changed,root)
            del bundle['physicalFacade']['plane'];atomic_json(root/'source.json',bundle)
            with self.assertRaises(ValueError):evidence_for(recipe,root)

    def test_resume_invalidated_by_content_or_build_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = [root / 'one.glb', root / 'one.blend']
            for path in paths:
                path.write_bytes(b'original')
            key = fingerprint({'id': 'one'}, {'date': '2025'}, 'lib')
            record = {'id': 'one', 'status': 'built', 'fingerprint': key,
                      'files': {str(p.resolve()): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}
            self.assertTrue(can_resume(record, key, root, root))
            self.assertFalse(can_resume(record, fingerprint({'id': 'one'}, {'date': '2024'}, 'lib'), root, root))
            self.assertFalse(can_resume(record, fingerprint({'id': 'one'}, {'date': '2025'}, 'changed-lib'), root, root))
            self.assertFalse(can_resume(record, fingerprint({'id': 'one'}, {'date': '2025'}, 'lib', True), root, root))
            paths[0].write_bytes(b'corrupted')
            self.assertFalse(can_resume(record, key, root, root))

    def test_same_owner_wrong_or_reversed_frontage_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            bundle = {'ownerId': 'owner', 'geometryRevision': 'rev', 'physicalFacade': {'frontage': [[0,0],[5,0]]}}
            atomic_json(root / 'source.json', bundle)
            recipe = {'buildingId': 'owner', 'geometryRevision': 'rev', 'sourceBundle': 'source.json',
                      'placement': {'frontageLocal': [[0,0],[5,0]]}}
            evidence_for(recipe, root)
            recipe['placement']['frontageLocal'] = [[0.03, 0], [5.03, 0]]
            evidence_for(recipe, root)
            for wrong in ([[5,0],[0,0]], [[0,0],[0,5]], [[0,0],[float('nan'),0]]):
                recipe['placement']['frontageLocal'] = wrong
                with self.assertRaises(ValueError):
                    evidence_for(recipe, root)

    def test_real_evidence_requires_both_frontage_bindings(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for observed, authored in ((False, False), (True, False), (False, True)):
                with self.subTest(observed=observed, authored=authored):
                    bundle = {'ownerId': 'owner', 'geometryRevision': 'rev'}
                    recipe = {'buildingId': 'owner', 'geometryRevision': 'rev', 'sourceBundle': 'source.json'}
                    if observed:
                        bundle['physicalFacade'] = {'frontage': [[0, 0], [5, 0]]}
                    if authored:
                        recipe['placement'] = {'frontageLocal': [[0, 0], [5, 0]]}
                    atomic_json(root / 'source.json', bundle)
                    with self.assertRaisesRegex(ValueError, 'require ordered physical frontage'):
                        evidence_for(recipe, root)

    def test_malformed_frontage_bindings_rejected_on_both_sides(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            malformed = (None, {}, 'frontage', [], [[0, 0]], [[0, 0], [0, 0]], [[0, 0], [5, 0, 0]],
                         [[0, 0], [True, 0]], [[0, 0], ['5', 0]],
                         [[0, 0], [float('nan'), 0]], [[0, 0], [float('inf'), 0]])
            for side in ('physicalFacade', 'placement'):
                for value in malformed:
                    with self.subTest(side=side, value=value):
                        bundle = {'ownerId': 'owner', 'geometryRevision': 'rev',
                                  'physicalFacade': {'frontage': [[0, 0], [5, 0]]}}
                        recipe = {'buildingId': 'owner', 'geometryRevision': 'rev', 'sourceBundle': 'source.json',
                                  'placement': {'frontageLocal': [[0, 0], [5, 0]]}}
                        target = bundle if side == 'physicalFacade' else recipe
                        field = 'frontage' if side == 'physicalFacade' else 'frontageLocal'
                        target[side][field] = value
                        # JSON's permissive nonfinite parser must still be rejected by evidence binding.
                        (root / 'source.json').write_text(json.dumps(bundle))
                        with self.assertRaisesRegex(ValueError, 'require ordered physical frontage'):
                            evidence_for(recipe, root)

                for container in (None, [], 'invalid'):
                    with self.subTest(side=side, container=container):
                        bundle = {'ownerId': 'owner', 'geometryRevision': 'rev',
                                  'physicalFacade': {'frontage': [[0, 0], [5, 0]]}}
                        recipe = {'buildingId': 'owner', 'geometryRevision': 'rev', 'sourceBundle': 'source.json',
                                  'placement': {'frontageLocal': [[0, 0], [5, 0]]}}
                        (bundle if side == 'physicalFacade' else recipe)[side] = container
                        atomic_json(root / 'source.json', bundle)
                        with self.assertRaisesRegex(ValueError, 'require ordered physical frontage'):
                            evidence_for(recipe, root)

    def test_matching_zero_length_frontage_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            atomic_json(root / 'source.json', {
                'ownerId': 'owner', 'geometryRevision': 'rev',
                'physicalFacade': {'frontage': [[2, 3], [2, 3]]}})
            recipe = {'buildingId': 'owner', 'geometryRevision': 'rev', 'sourceBundle': 'source.json',
                      'placement': {'frontageLocal': [[2, 3], [2, 3]]}}
            with self.assertRaisesRegex(ValueError, 'require ordered physical frontage'):
                evidence_for(recipe, root)

    def test_synthetic_evidence_does_not_require_frontage(self):
        self.assertEqual(evidence_for({'synthetic': True}, '/unused'), {})


if __name__ == '__main__':
    unittest.main()
