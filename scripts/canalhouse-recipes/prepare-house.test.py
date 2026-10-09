import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('prepare_house', Path(__file__).with_name('prepare-house.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class OrderedPreparationTests(unittest.TestCase):
    def test_unsafe_frontage_jog_cli_rejected_before_preparation(self):
        with tempfile.TemporaryDirectory() as directory:
            stage = Path(directory) / 'new-stage'
            for value in ['0', '-.1', '1.01', 'nan', 'inf']:
                result = subprocess.run(['python3', str(Path(__file__).with_name('prepare-house.py')),
                                         '--address=Bloemgracht 1', '--anchor=unused', '--side=left',
                                         '--stage=' + str(stage), '--frontage-max-jog-m=' + value],
                                        capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('greater than zero and at most 1m', result.stderr)
                self.assertFalse(stage.exists())

    def test_partial_front_warning_and_explicit_limits_remain_visible_in_summary(self):
        with tempfile.TemporaryDirectory() as directory:
            screen = Path(directory) / 'native-screen.json'
            discovery = {'status': 'discovery-only-not-acceptance', 'selectedWidthM': 3,
                         'candidate': {'widthM': 3, 'extendsSelectedFront': False},
                         'possiblePartialFront': True, 'limits': {'maxJogM': .35}}
            screen.write_text(json.dumps({'frontageDiscovery': discovery}))
            summary = module.frontage_summary(screen)
            self.assertIn('Possible partial selected frontage', summary['warning'])
            self.assertEqual(summary['limits']['maxJogM'], .35)
            self.assertFalse(summary['extendsSelectedFront'])
            discovery['candidate'] = {'widthM': 6, 'extendsSelectedFront': True}
            discovery['limits']['maxJogM'] = .5
            screen.write_text(json.dumps({'frontageDiscovery': discovery}))
            summary = module.frontage_summary(screen)
            self.assertIn('candidate is not accepted', summary['warning'])
            self.assertEqual(summary['limits']['maxJogM'], .5)

    def test_failed_survey_preserves_evidence_and_prevents_camera_or_render_continuation(self):
        calls = []
        def runner(command, **kwargs):
            calls.append(command[0])
            return subprocess.CompletedProcess(command, 1 if command[0] == 'survey' else 0, 'retained evidence\n', 'failure\n')
        with tempfile.TemporaryDirectory() as directory:
            stage = Path(directory)
            report = {'status': 'preparing', 'phases': [], 'acceptance': False}
            with self.assertRaisesRegex(RuntimeError, 'later phases were not run'):
                module.execute_phases([(name, [name]) for name in ['identity', 'survey', 'camera', 'render']], stage, report, runner)
            self.assertEqual(calls, ['identity', 'survey'])
            self.assertEqual(json.loads((stage / 'prepare-report.json').read_text())['status'], 'failed-survey')
            self.assertIn('failure', (stage / 'survey.log').read_text())
            self.assertFalse((stage / 'camera.log').exists())

    def test_launch_failure_is_recorded_as_terminal_failure(self):
        def runner(command, **kwargs):
            raise FileNotFoundError('node executable unavailable')
        with tempfile.TemporaryDirectory() as directory:
            stage = Path(directory)
            report = {'status': 'preparing', 'phases': [], 'acceptance': False}
            with self.assertRaisesRegex(RuntimeError, 'could not launch'):
                module.execute_phases([('survey', ['node']), ('reference', ['node'])], stage, report, runner)
            saved = json.loads((stage / 'prepare-report.json').read_text())
            self.assertEqual(saved['status'], 'failed-survey')
            self.assertEqual(len(saved['phases']), 1)
            self.assertIsNone(saved['phases'][0]['exitCode'])
            self.assertFalse((stage / 'reference.log').exists())

    def test_success_is_observation_ready_and_never_acceptance(self):
        with tempfile.TemporaryDirectory() as directory:
            stage = Path(directory)
            report = {'status': 'preparing', 'phases': [], 'acceptance': False}
            module.execute_phases([('identity', ['identity']), ('reference', ['reference'])], stage, report,
                                  lambda command, **kwargs: subprocess.CompletedProcess(command, 0, '{}\n', ''))
            saved = json.loads((stage / 'prepare-report.json').read_text())
            self.assertEqual(saved['status'], 'ready-for-human-source-observation')
            self.assertFalse(saved['acceptance'])
            self.assertEqual([p['name'] for p in saved['phases']], ['identity', 'reference'])

    def test_existing_candidate_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run(['python3', str(Path(__file__).with_name('prepare-house.py')),
                                     '--address=Bloemgracht 170', '--anchor=unused', '--side=left',
                                     '--stage=' + str(Path(directory) / 'new-stage')], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Refusing to overwrite', result.stderr)
            self.assertFalse((Path(directory) / 'new-stage').exists())

if __name__ == '__main__':
    unittest.main()
