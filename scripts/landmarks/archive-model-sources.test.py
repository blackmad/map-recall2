#!/usr/bin/env python3
"""Bounded, network-free archive regression fixtures. Run directly with python3."""
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('archiver', Path(__file__).with_name('archive-model-sources.py'))
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)


class ScopedArchiveTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.repo, self.dest = self.root / 'game', self.root / 'private'
        self.models = [{'id': 'fixture-alpha', 'name': 'Alpha'}, {'id': 'fixture-beta', 'name': 'Beta'}]
        self.save(self.repo / 'src/canalRecall/landmarks/manualCatalogue.json', self.models)
        self.save(self.repo / 'scripts/landmarks/shared-spec.json', {'id': 'fixture-alpha', 'relatedLandmarkIds': ['fixture-beta']})
        self.save(self.repo / 'scripts/landmarks/shared-footprints.json', {'survey': 'shared survey'})
        self.save(self.repo / 'scripts/landmarks/fixture-alpha-sources.json', {'id': 'fixture-alpha', 'referenceUrl': 'https://example.test/original', 'reference': 'artifacts/landmarks/fixture-alpha/references/original.jpg'})
        self.save(self.repo / 'scripts/landmarks/fixture-beta-sources.json', {'id': 'fixture-beta', 'notes': 'untouched'})
        for filename in ('README.md', 'archive-index.json', 'capture-requests.json'):
            self.save(self.dest / filename, {'sentinel': filename})
        self.save(self.dest / 'models/fixture-beta/manifest.json', {'sentinel': 'beta manifest'})
        self.save(self.dest / 'models/fixture-beta/README.md', {'sentinel': 'beta readme'})
        original = self.object(b'private-only original photo')
        body = self.object(b'private-only original HTTP body')
        self.save(self.dest / 'models/fixture-alpha/manifest.json', {
            'modelId': 'fixture-alpha', 'researchProvenance': {'worker': 'direct raw source pack'},
            'files': [{'sourcePath': str(self.repo / 'artifacts/landmarks/fixture-alpha/references/original.jpg'),
                       'repositoryPath': 'artifacts/landmarks/fixture-alpha/references/original.jpg',
                       'originalFilename': 'original.jpg', 'representation': 'image-or-document-source-bytes',
                       'mediaType': 'image/jpeg', 'provenance': 'downloaded original', **original}],
            'webCaptures': [{'url': 'https://example.test/original', 'success': True,
                             'representation': 'raw-http-response-body', 'contentType': 'text/html', **body}],
            'sourceUrls': ['https://example.test/original'], 'missingLocalFiles': []})
        self.unrelated = self.object(b'unrelated object never hashed')

    def save(self, path, data):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data))

    def object(self, data):
        sha = hashlib.sha256(data).hexdigest()
        path = self.dest / 'objects/sha256' / sha[:2] / sha
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return {'archiveObject': str(path.relative_to(self.dest)), 'sha256': sha, 'bytes': len(data)}

    def run_archive(self, *flags):
        def run(command, **kwargs):
            stdout = json.dumps(self.models) if command[0] == 'node' else ('fixture-commit\n' if 'rev-parse' in command else '')
            return subprocess.CompletedProcess(command, 0, stdout=stdout)
        hashed = []
        original_digest = archive.digest
        def digest(path):
            hashed.append(path)
            return original_digest(path)
        with patch.object(sys, 'argv', ['archive', '--repo', str(self.repo), '--destination', str(self.dest), '--downloads', str(self.root / 'downloads'), *flags]), \
                patch.object(archive.subprocess, 'run', side_effect=run), \
                patch.object(archive, 'digest', side_effect=digest), contextlib.redirect_stdout(io.StringIO()) as out:
            archive.main()
        return json.loads(out.getvalue()), hashed

    def test_scoped_preserves_private_sources_and_unrelated_packs(self):
        protected = {path: (path.read_bytes(), path.stat().st_mtime_ns) for path in self.dest.rglob('*')
                     if path.is_file() and ('fixture-beta' in path.parts or path.parent == self.dest)}
        result, hashed = self.run_archive('--only', 'fixture-alpha', '--verify')
        self.assertEqual(result['selectedModelIds'], ['fixture-alpha'])
        self.assertEqual(result['sourceFiles'], 4)  # alpha record, shared spec/survey, catalogue
        self.assertNotIn(self.dest / self.unrelated['archiveObject'], hashed)
        self.assertFalse(any(path.name == 'fixture-beta-sources.json' for path in hashed))
        for path, before in protected.items():
            self.assertEqual((path.read_bytes(), path.stat().st_mtime_ns), before)
        manifest = json.loads((self.dest / 'models/fixture-alpha/manifest.json').read_text())
        original = next(f for f in manifest['files'] if f['originalFilename'] == 'original.jpg')
        self.assertEqual(original['provenance'], 'downloaded original')
        self.assertEqual(manifest['researchProvenance']['worker'], 'direct raw source pack')
        self.assertEqual(manifest['missingLocalFiles'], [])
        self.assertTrue(manifest['webCaptures'][0]['success'])
        for field in ('files', 'webCaptures'):
            for record in manifest[field]:
                self.assertEqual(archive.digest(self.dest / record['archiveObject']), record['sha256'])
                self.assertIn(record['archiveObject'], result['requiredPaths'])
                self.assertIn(record['readableArchivePath'], result['requiredPaths'])
        self.assertTrue(all(path.startswith(('models/fixture-alpha/', 'objects/', 'runs/')) for path in result['changedPaths']))
        print(json.dumps({key: result[key] for key in ('sourceFiles', 'newObjectBytesCopied', 'objectsVerified', 'elapsedSeconds')}))

    def test_direct_worker_raw_pack_is_preserved_and_normalized(self):
        folder = self.dest / 'models/fixture-alpha'
        (folder / 'manifest.json').unlink()
        raw = b'worker-only original HTTP response'
        source = folder / 'files/operator.html'
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_bytes(raw)
        records = [{'path': 'files/operator.html', 'url': 'https://example.test/operator',
                    'sha256': hashlib.sha256(raw).hexdigest(), 'kind': 'original HTTP body',
                    'rights': 'retained source rights'}]
        self.save(folder / 'research-manifest.json', records)
        result, _ = self.run_archive('--only', 'fixture-alpha', '--verify')
        manifest = json.loads((folder / 'manifest.json').read_text())
        record = next(f for f in manifest['files'] if f['originalFilename'] == 'operator.html')
        self.assertEqual(record['kind'], 'original HTTP body')
        self.assertEqual(record['rights'], 'retained source rights')
        self.assertEqual(manifest['privateResearchRecords'], records)
        self.assertEqual((self.dest / record['archiveObject']).read_bytes(), raw)
        self.assertIn(record['archiveObject'], result['requiredPaths'])

    def test_unknown_rejected_without_archive_writes(self):
        before = {str(path): path.read_bytes() for path in self.dest.rglob('*') if path.is_file()}
        with self.assertRaisesRegex(SystemExit, 'Unknown model IDs: unknown-model'):
            self.run_archive('--only', 'fixture-alpha,unknown-model')
        self.assertEqual(before, {str(path): path.read_bytes() for path in self.dest.rglob('*') if path.is_file()})

    def legacy_acquisition_pack(self):
        # The Rock's direct worker manifest is a list, including failed requests
        # without paths and derived PDF pages alongside downloaded originals.
        folder = self.dest / 'models/fixture-alpha'
        records = []
        for relative, data, url, extra in (
                ('files/brochure.pdf', b'original PDF bytes', 'https://example.test/brochure.pdf', {'raw': True}),
                ('webpages/owner.html', b'original owner HTML', 'https://example.test/', {'raw': True}),
                ('processed/brochure-page7.png', b'derived PDF page bytes', None,
                 {'raw': False, 'derivedFrom': 'files/brochure.pdf', 'page': 7})):
            source = folder / relative
            source.parent.mkdir(parents=True, exist_ok=True)
            source.write_bytes(data)
            record = {'path': relative, 'sha256': hashlib.sha256(data).hexdigest(),
                      'bytes': len(data), 'accessState': 'original HTTP response downloaded', **extra}
            if url:
                record.update({'url': url, 'retrievedAt': '2026-10-06T10:07:37.310412+00:00',
                               'rights': 'Copyright respective owner/photographer; private research reference only'})
            else:
                record['accessState'] = 'local PDF page rendering; original PDF retained'
            records.append(record)
        records.append({'url': 'https://overpass.kumi.systems/api/interpreter',
                        'retrievedAt': '2026-10-06', 'accessState': '30s timeout; bounded fallback successful OSM map API'})
        self.save(folder / 'manifest.json', records)
        return folder, records

    def test_actual_legacy_acquisition_list_preserves_original_and_provenance(self):
        folder, records = self.legacy_acquisition_pack()
        original_manifest = (folder / 'manifest.json').read_bytes()
        result, _ = self.run_archive('--only', 'fixture-alpha', '--verify')
        manifest = json.loads((folder / 'manifest.json').read_text())
        self.assertEqual((folder / 'original-worker-manifest.json').read_bytes(), original_manifest)
        self.assertIn('models/fixture-alpha/original-worker-manifest.json', result['requiredPaths'])
        self.assertEqual(manifest['privateAcquisitionRecords'], records)
        self.assertEqual(manifest['privateSourceAccessRecords'], [records[-1]])
        self.assertIn(records[-1]['url'], manifest['sourceUrls'])
        for original in records[:-1]:
            archived = next(f for f in manifest['files'] if f.get('path') == original['path'])
            for key, value in original.items():
                self.assertEqual(archived[key], value)
            self.assertEqual(archive.digest(self.dest / archived['archiveObject']), original['sha256'])
            self.assertIn('models/fixture-alpha/' + original['path'], result['requiredPaths'])
            self.assertEqual(archived['representation'], 'raw-http-response-body' if original['raw'] else 'derived-source-rendering')
        self.run_archive('--only', 'fixture-alpha', '--verify')
        self.assertEqual((folder / 'original-worker-manifest.json').read_bytes(), original_manifest)
        repeated = json.loads((folder / 'manifest.json').read_text())
        self.assertEqual(repeated['privateAcquisitionRecords'], records)
        self.assertEqual(repeated['privateSourceAccessRecords'], [records[-1]])

    def test_legacy_claimed_original_checksum_and_missing_file_rejected(self):
        folder, records = self.legacy_acquisition_pack()
        source = folder / records[0]['path']
        source.write_bytes(b'corrupted original')
        with self.assertRaisesRegex(SystemExit, 'Checksum failure'):
            self.run_archive('--only', 'fixture-alpha', '--verify')
        source.unlink()
        with self.assertRaisesRegex(SystemExit, 'Missing selected private original'):
            self.run_archive('--only', 'fixture-alpha', '--verify')

    def test_repeatable_selection_and_default_full_mode(self):
        result, _ = self.run_archive('--only', 'fixture-alpha', '--only', 'fixture-beta,fixture-alpha', '--verify')
        self.assertEqual(result['selectedModelIds'], ['fixture-alpha', 'fixture-beta'])
        self.assertTrue((self.dest / 'models/fixture-beta/files/fixture-beta-sources.json').exists())
        self.run_archive('--verify')
        index = json.loads((self.dest / 'archive-index.json').read_text())
        self.assertEqual(index['manifestModelsIncludingPending'], 2)
        self.assertIn('_unassigned', index['modelManifests'])

    def test_selected_corrupt_existing_object_rejected(self):
        manifest = json.loads((self.dest / 'models/fixture-alpha/manifest.json').read_text())
        (self.dest / manifest['files'][0]['archiveObject']).write_bytes(b'corrupt')
        with self.assertRaisesRegex((SystemExit, ValueError), 'checksum|Checksum'):
            self.run_archive('--only', 'fixture-alpha', '--verify')


if __name__ == '__main__':
    unittest.main()
