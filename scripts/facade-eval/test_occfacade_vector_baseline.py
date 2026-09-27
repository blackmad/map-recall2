"""Small source/mask fixtures for the diagnostic component extractor."""

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

SCRIPT = Path(__file__).with_name('occfacade_vector_baseline.py')
sys.path.insert(0, str(SCRIPT.parent))
from occfacade_vector_baseline import components, sha256


class ComponentsTest(unittest.TestCase):
    def test_keeps_fragments_and_never_joins_diagonal_or_occluded_windows(self):
        labels = np.zeros((100, 100), dtype=np.uint8)
        labels[10:20, 10:20] = 4
        labels[21:31, 21:31] = 4  # separated by background; no completed span
        labels[0:2, 90:92] = 1  # tiny clipped door fragment, retained as filtered
        found = components(labels, minimum_area_fraction=.0005, minimum_side=3)
        windows = [item for item in found if item['rawClass'] == 'window']
        self.assertEqual([item['pixelBounds'] for item in windows],
                         [[10, 10, 20, 20], [21, 21, 31, 31]])
        self.assertEqual(windows[0]['normalizedBounds'], [100.0, 100.0, 100.0, 100.0])
        self.assertTrue(all(item['status'] == 'proposal' for item in windows))
        door = next(item for item in found if item['rawClass'] == 'door')
        self.assertEqual(door['status'], 'filtered-fragment')
        self.assertIn('side-below-threshold', door['filterReasons'])
        self.assertTrue(door['touchesImageEdge'])

    def test_cli_verifies_both_sources_and_preserves_output_on_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / 'source.png'
            labels = root / '000-full-labels.png'
            Image.new('RGB', (20, 20), '#704030').save(source)
            array = np.zeros((20, 20), dtype=np.uint8)
            array[2:9, 3:11] = 4
            Image.fromarray(array).save(labels)
            cohort_path = root / 'cohort.json'
            cohort_path.write_text(json.dumps({'entries': [{
                'index': 0, 'buildingId': 'building', 'observationId': 'observation',
                'geometryRevision': 'revision', 'images': [{
                    'kind': 'full', 'path': str(source), 'sha256': sha256(source),
                }],
            }]}))
            receipt_path = root / 'receipt.json'
            receipt = {
                'manifestSha256': sha256(cohort_path), 'checkpointSha256': 'model-hash',
                'classes': list(range(8)), 'records': [{
                    'index': 0, 'kind': 'full', 'buildingId': 'building',
                    'observationId': 'observation', 'geometryRevision': 'revision',
                    'sourceSha256': sha256(source), 'labelsSha256': sha256(labels),
                    'size': [20, 20],
                }],
            }
            receipt_path.write_text(json.dumps(receipt))
            command = [sys.executable, str(SCRIPT), '--cohort', str(cohort_path),
                       '--occ-receipt', str(receipt_path), '--labels-dir', str(root),
                       '--indices', '0', '--out']
            success = subprocess.run(command + [str(root / 'good')], capture_output=True, text=True)
            self.assertEqual(success.returncode, 0, success.stderr)
            output = json.loads((root / 'good' / 'manifest.json').read_text())
            self.assertEqual(output['records'][0]['proposalCount'], 1)
            self.assertEqual(output['records'][0]['components'][0]['pixelBounds'], [3, 2, 11, 9])
            self.assertEqual(sha256(root / 'good' / '000-overlay.png'),
                             output['records'][0]['overlaySha256'])
            array[2, 3] = 0
            Image.fromarray(array).save(labels)
            failed = subprocess.run(command + [str(root / 'bad')], capture_output=True, text=True)
            self.assertNotEqual(failed.returncode, 0)
            self.assertIn('Mask SHA mismatch', failed.stderr)
            self.assertFalse((root / 'bad').exists())


if __name__ == '__main__':
    unittest.main()
