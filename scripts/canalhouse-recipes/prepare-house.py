#!/usr/bin/env python3
"""Prepare one cached native owner and reference set; human observation follows."""
import argparse
import json
import math
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


def save_report(path, report):
    path.write_text(json.dumps(report, indent=2) + '\n')


def execute_phases(phases, stage, report, runner=subprocess.run):
    report_path = stage / 'prepare-report.json'
    save_report(report_path, report)
    for name, command in phases:
        started = time.perf_counter()
        log = stage / (name + '.log')
        try:
            result = runner(command, capture_output=True, text=True)
        except OSError as error:
            log.write_text(str(error) + '\n')
            report['phases'].append({'name': name, 'seconds': round(time.perf_counter() - started, 3),
                                     'exitCode': None, 'launchError': str(error), 'log': str(log)})
            report['status'] = 'failed-' + name
            save_report(report_path, report)
            raise RuntimeError(name + ' could not launch; later phases were not run. See ' + str(log)) from error
        log.write_text(result.stdout + result.stderr)
        report['phases'].append({'name': name, 'seconds': round(time.perf_counter() - started, 3),
                                 'exitCode': result.returncode, 'log': str(log)})
        if result.returncode:
            report['status'] = 'failed-' + name
            save_report(report_path, report)
            raise RuntimeError(name + ' failed; later phases were not run. See ' + str(log))
        save_report(report_path, report)
    report['status'] = 'ready-for-human-source-observation'
    report['finishedAt'] = datetime.now(timezone.utc).isoformat()
    save_report(report_path, report)


def frontage_summary(screen_path):
    discovery = json.loads(screen_path.read_text()).get('frontageDiscovery') if screen_path.exists() else None
    if not discovery:
        return {'status': 'missing-discovery-report', 'selectedWidthM': None,
                'candidateWidthM': None, 'extendsSelectedFront': None,
                'warning': 'Frontage discovery report unavailable; inspect the native ground boundary before authoring.'}
    candidate = discovery.get('candidate')
    expanded = candidate.get('extendsSelectedFront', False) if candidate else None
    warning = None
    if expanded:
        warning = ('Selected frontage covers only part of a bounded native street-facing candidate. '
                   'Inspect the candidate edges, jogs and source photos before counting openings or authoring; '
                   'selected endpoints have not changed and the candidate is not accepted.')
    elif not candidate:
        warning = 'No bounded complete-frontage candidate found; inspect the native ground boundary and source photos before authoring.'
    elif discovery.get('possiblePartialFront'):
        warning = ('Possible partial selected frontage: another outward facade lies beyond a rejected native jog of at most 1m. '
                   'Inspect source photos and native-screen stop measurements before explicitly reviewing a jog-limit override; '
                   'selected endpoints have not changed and the candidate is not accepted.')
    return {'status': discovery['status'], 'selectedWidthM': discovery['selectedWidthM'],
            'candidateWidthM': candidate.get('widthM') if candidate else None,
            'extendsSelectedFront': expanded, 'possiblePartialFront': discovery.get('possiblePartialFront', False),
            'limits': discovery.get('limits'), 'warning': warning,
            'nativeScreen': str(screen_path)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--address', required=True)
    parser.add_argument('--pand-id', help='Explicit physical owner within a multi-Pand official address')
    parser.add_argument('--anchor', required=True)
    parser.add_argument('--side', choices=['left', 'right'], required=True)
    parser.add_argument('--frontage-rd', help='Explicit exact native endpoints; does not relax adjacency checks')
    parser.add_argument('--frontage-max-jog-m', type=float, default=.35,
                        help='Discovery-only jog limit, greater than zero and at most 1m (default: .35)')
    parser.add_argument('--stage', required=True, type=Path)
    parser.add_argument('--camera-rank', type=int, default=1)
    args = parser.parse_args()
    if not math.isfinite(args.frontage_max_jog_m) or not 0 < args.frontage_max_jog_m <= 1:
        parser.error('--frontage-max-jog-m must be greater than zero and at most 1m')
    if not re.fullmatch(r'[\w .-]+ [0-9]+', args.address) or args.camera_rank < 1 or args.camera_rank > 5:
        parser.error('Use one base house address and camera rank1–5')
    root = Path.cwd().resolve()
    stage = args.stage.resolve()
    if stage == root or root in stage.parents:
        parser.error('Reference images must be staged outside the public game repository')
    model = re.sub(r'\s+', '-', args.address.lower())
    refs = root / 'docs/references/canalhouse-recipes'
    inventory = refs / (model + '-trial.json')
    protected = [stage, inventory] + [refs / (model + '-' + suffix + '.json')
                                     for suffix in ['survey', 'source-admission', 'recipe-input', 'recipes']]
    if any(path.exists() for path in protected):
        parser.error('Refusing to overwrite a prior stage, trial, survey or authored candidate')
    stage.mkdir(parents=True)
    scripts = root / 'scripts/canalhouse-recipes'
    raw_cache = root / '.worktrees/amsterdam-facade-rebuild/.cache/city-appearance/areas/jordaan-sample-v1/raw'
    camera_cache = raw_cache.parent / 'panorama-audit'
    seed = [sys.executable, str(scripts / 'seed-cached-trial.py'), '--address=' + args.address,
            '--anchor=' + args.anchor, '--side=' + args.side, '--output=' + str(inventory)]
    if args.frontage_rd:
        seed.append('--frontage-rd=' + args.frontage_rd)
    if args.pand_id:
        seed.append('--pand-id=' + args.pand_id)
    ranking, frozen = stage / 'camera-ranking.json', stage / 'selected-camera-inventory.json'
    phases = [
        ('identity-frontage', seed),
        ('official-joins-register', [sys.executable, str(scripts / 'prepare-cached-identities.py'),
                                    '--inventory=' + str(inventory), '--stage=' + str(stage)]),
        ('native-survey', ['node', '--import', 'tsx', str(scripts / 'prepare-cached-surveys.mts'),
                           '--inventory=' + str(inventory), '--stage=' + str(stage), '--mode=survey',
                           '--frontage-max-jog-m=' + str(args.frontage_max_jog_m)]),
        ('camera-selection', [sys.executable, str(scripts / 'select-cached-reference-cameras.py'),
                              '--inventory=' + str(inventory), '--cache=' + str(camera_cache),
                              '--output=' + str(ranking), '--freeze=' + str(frozen), '--select=' + str(args.camera_rank)]),
        ('reference-projections', ['node', '--import', 'tsx', str(scripts / 'prepare-neighbor-references.mts'),
                                   '--inventory=' + str(inventory), '--source-inventory=' + str(frozen),
                                   '--stage=' + str(stage)]),
    ]
    report = {'schemaVersion': 1, 'address': args.address, 'modelId': model, 'inventory': str(inventory),
              'stage': str(stage), 'startedAt': datetime.now(timezone.utc).isoformat(), 'status': 'preparing',
              'networkRequests': 0, 'acceptance': False, 'phases': [],
              'nextAction': 'Inspect actual source images and native screen; record independently reviewed counts, assemblies and holds before authoring.',
              'limits': ['No house style, opening count or roof family inferred.', 'No source admission, recipe, export or visual acceptance produced.',
                         'Camera rank is source discovery; it does not prove target visibility or metric rectification.']}
    try:
        execute_phases(phases, stage, report)
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1
    frontage = frontage_summary(stage / (args.address.rsplit(' ', 1)[1] + '-native-screen.json'))
    report['frontageDiscovery'] = frontage
    save_report(stage / 'prepare-report.json', report)
    if frontage['warning']:
        print('WARNING: ' + frontage['warning'], file=sys.stderr)
    print(json.dumps({'status': report['status'], 'modelId': model,
                      'report': str(stage / 'prepare-report.json'), 'phasesSeconds': sum(p['seconds'] for p in report['phases']),
                      'frontageDiscovery': frontage,
                      'acceptance': False}))
    return 0


if __name__ == '__main__':
    sys.exit(main())
