"""Offline reciprocal-address fixtures for both cached preparation stages."""
import gzip
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent


class CachedCornerIdentityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='cached-corner-identity-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.cache = self.root / 'cache'
        self.stage = self.root / 'stage'
        self.references = self.root / 'references'
        for folder in [self.cache, self.stage, self.references]:
            folder.mkdir()
        self.pid = '0363100012168079'
        self.parent_uuid = 'pand-corner-uuid'
        self.inventory_path = self.root / 'inventory.json'
        self.register_path = self.root / 'register.json.gz'
        self.register_path.write_bytes(gzip.compress(json.dumps({'rce': [], 'municipal': []}).encode()))
        self.vbos = [self.vbo('alias-11', 'Derde Leliedwarsstraat', 11, '0001'),
                     self.vbo('alias-13', 'Derde Leliedwarsstraat', 13, '0002'),
                     self.vbo('canonical-130', 'Bloemgracht', 130, '0003'),
                     self.vbo('alias-15', 'Derde Leliedwarsstraat', 15, '0004')]
        self.raw = self.cache / '3dbag-1.json'
        self.write(self.raw, {'features': [{'id': 'NL.IMBAG.Pand.' + self.pid}]})
        self.write(Path(str(self.raw) + '.source.json'), {'url': 'https://fixture.invalid/native'})
        self.write(self.inventory_path, {'entries': [{
            'address': 'Bloemgracht 130', 'cachedOwnerId': self.pid,
            'images': [{'tier': tier, 'panoramaId': 'fixture-pano', 'captureDate': '2023-02-27T00:00:00Z',
                        'sourceUrl': 'https://fixture.invalid/pano', 'path': '/tmp/fixture-' + tier + '.jpg'}
                       for tier in ['full', 'ground']],
            'criticalTraits': ['Synthetic corner fixture'], 'rootInspection': 'Synthetic fixture only'}]})
        self.write(self.stage / '130-native-screen.json', {'endpointHeights': [[8], [8]], 'ground': 0, 'exact': [[0, 0], [4, 0]]})
        self.write(self.references / 'bloemgracht-130-recipe-input.json', {'id': 'bloemgracht-130', 'crown': {'shape': {'family': 'hals'}}})
        self.write(self.references / 'bloemgracht-130-survey.json', {'bagId': self.pid, 'surveyFootprintPolygonsRD': [], 'attributes': {}})
        self.sync_cache()

    @staticmethod
    def write(path, value):
        path.write_text(json.dumps(value))

    def vbo(self, uuid, street, number, official_id):
        return {'id': uuid, 'properties': {'identificatie': official_id, 'status': 'Verblijfsobject in gebruik',
                'openbare_ruimte_naam': street, 'huisnummer': number, 'pand.href': ['https://fixture.invalid/pand/' + self.parent_uuid]}}

    def sync_cache(self):
        self.write(self.cache / 'bag-1.json', {'links': [{'href': 'https://fixture.invalid/bag'}], 'features': [{
            'id': self.parent_uuid, 'geometry': {'type': 'Polygon', 'coordinates': []},
            'properties': {'identificatie': self.pid, 'status': 'Pand in gebruik',
                           'verblijfsobject.href': ['https://fixture.invalid/vbo/' + v['id'] for v in self.vbos]}}]})
        self.write(self.cache / 'addresses-1.json', {'links': [{'href': 'https://fixture.invalid/addresses'}], 'features': self.vbos})

    def identities(self):
        return subprocess.run(['python3', str(SCRIPTS / 'prepare-cached-identities.py'),
                               '--inventory=' + str(self.inventory_path), '--stage=' + str(self.stage),
                               '--cache=' + str(self.cache), '--register=' + str(self.register_path)], capture_output=True, text=True)

    def admissions(self):
        return subprocess.run(['python3', str(SCRIPTS / 'prepare-cached-admissions.py'),
                               '--inventory=' + str(self.inventory_path), '--stage=' + str(self.stage),
                               '--references=' + str(self.references)], capture_output=True, text=True)

    def admission(self):
        return json.loads((self.references / 'bloemgracht-130-source-admission.json').read_text())

    def test_corner_aliases_are_all_retained_and_canonical_vbo_selected(self):
        result = self.identities()
        self.assertEqual(result.returncode, 0, result.stderr)
        joins = json.loads((self.stage / 'official-parent-joins.json').read_text())
        self.assertEqual({j['feature']['id'] for j in joins}, {v['id'] for v in self.vbos})
        result = self.admissions()
        self.assertEqual(result.returncode, 0, result.stderr)
        identity = self.admission()['officialIdentity']
        self.assertEqual(identity['address'], 'Bloemgracht 130')
        self.assertEqual(identity['vboId'], '0003')
        self.assertEqual(set(identity['joinEvidence']['vboFeatureIds']), {v['id'] for v in self.vbos})

    def test_canonical_must_match_both_requested_street_and_base_number(self):
        self.vbos[2]['properties']['huisnummer'] = 132
        self.vbos[0]['properties']['huisnummer'] = 130
        self.sync_cache()
        result = self.identities()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Missing exact requested canonical street and base house number', result.stderr)
        self.assertFalse((self.stage / 'official-parent-joins.json').exists())

    def test_foreign_nonreciprocal_corner_alias_is_rejected(self):
        self.vbos[0]['properties']['pand.href'] = ['https://fixture.invalid/pand/foreign-owner']
        self.sync_cache()
        result = self.identities()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Non-reciprocal official join', result.stderr)

    def test_admission_rejects_missing_canonical_or_corrupt_reciprocal_join(self):
        self.assertEqual(self.identities().returncode, 0)
        path = self.stage / 'official-parent-joins.json'
        joins = json.loads(path.read_text())
        self.write(path, [j for j in joins if j['feature']['id'] != 'canonical-130'])
        result = self.admissions()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Missing exact requested canonical', result.stderr)
        joins[0]['feature']['properties']['pand.href'] = ['https://fixture.invalid/pand/foreign-owner']
        self.write(path, joins)
        result = self.admissions()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Non-reciprocal or inactive official join', result.stderr)

    def test_multiple_apartments_choose_canonical_reproducibly(self):
        other = self.vbo('canonical-130-a', 'Bloemgracht', 130, '0000')
        other['properties']['huisletter'] = 'A'
        self.vbos.append(other)
        self.sync_cache()
        self.assertEqual(self.identities().returncode, 0)
        self.assertEqual(self.admissions().returncode, 0)
        self.assertEqual(self.admission()['officialIdentity']['vboId'], '0000')
        (self.references / 'bloemgracht-130-source-admission.json').unlink()
        path = self.stage / 'official-parent-joins.json'
        self.write(path, list(reversed(json.loads(path.read_text()))))
        self.assertEqual(self.admissions().returncode, 0)
        self.assertEqual(self.admission()['officialIdentity']['vboId'], '0000')

    def test_original_single_street_owner_preserves_identity(self):
        self.vbos = [self.vbos[2]]
        self.sync_cache()
        self.assertEqual(self.identities().returncode, 0)
        self.assertEqual(self.admissions().returncode, 0)
        identity = self.admission()['officialIdentity']
        self.assertEqual(identity['vboId'], '0003')
        self.assertEqual(identity['joinEvidence']['vboFeatureIds'], ['canonical-130'])
        self.assertEqual(self.admission()['status'], 'human-source-screened;candidate-only')


if __name__ == '__main__':
    unittest.main()
