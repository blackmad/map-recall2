#!/usr/bin/env python3
"""Rank cached panorama records for one explicit target; never acquire sources.

Example:
  python3 scripts/canalhouse-recipes/select-cached-reference-cameras.py \
    --inventory=target.json --cache=.../panorama-audit --output=/tmp/cameras.json \
    --freeze=/tmp/selected-camera-inventory.json --select=1

The frozen entry is a SOURCE owner accepted by prepare-neighbor-references.mts.
It does not replace the target entry. Scores establish neither target visibility
nor metric eligibility. Front-side uses the right normal of orderedFrontageRD;
use --front-side=left if that inventory's directed frontage needs the opposite.
"""
import argparse
import datetime
import hashlib
import json
import math
from pathlib import Path


def sha256(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n')


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--inventory', type=Path, required=True)
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--front-side', choices=['right', 'left'], default='right')
    parser.add_argument('--max-distance', type=float, default=100)
    parser.add_argument('--max-obliquity', type=float, default=85)
    parser.add_argument('--max-manifests', type=int, default=100)
    parser.add_argument('--max-records', type=int, default=20000)
    parser.add_argument('--limit', type=int, choices=[3, 4, 5], default=5)
    parser.add_argument('--freeze', type=Path)
    parser.add_argument('--select', type=int, default=1, help='One-based printed candidate to freeze')
    args = parser.parse_args()
    if args.output.resolve() == args.inventory.resolve() or (args.freeze and args.freeze.resolve() in [args.inventory.resolve(), args.output.resolve()]):
        parser.error('Reports and frozen source inventory must use distinct paths from the target inventory')
    if args.max_manifests <= 0 or args.max_records <= 0:
        parser.error('Scan bounds must be positive')
    if not 0 < args.max_distance <= 500 or not 0 < args.max_obliquity < 90:
        parser.error('Distance must be in (0,500], obliquity in (0,90)')
    entries = json.loads(args.inventory.read_text()).get('entries', [])
    if len(entries) != 1:
        parser.error('Inventory must contain exactly one explicit target')
    target = entries[0]
    if not isinstance(target.get('cachedOwnerId'), str) or not target['cachedOwnerId']:
        parser.error('Target requires cachedOwnerId')
    front = target.get('orderedFrontageRD', [])
    if len(front) != 2 or any(not finite(p.get(k)) for p in front for k in ['x', 'y']):
        parser.error('Target needs two finite orderedFrontageRD points')
    dx, dy = front[1]['x'] - front[0]['x'], front[1]['y'] - front[0]['y']
    length = math.hypot(dx, dy)
    if length <= 0:
        parser.error('Target frontage has zero length')
    mx, my = (front[0]['x'] + front[1]['x']) / 2, (front[0]['y'] + front[1]['y']) / 2
    sign = 1 if args.front_side == 'right' else -1
    nx, ny = sign * dy / length, -sign * dx / length
    manifests = sorted(args.cache.glob('*/evidence/manifest.json'))
    if len(manifests) > args.max_manifests:
        parser.error('Manifest bound exceeded; choose a narrower cache or explicit larger bound')
    if not manifests:
        parser.error('No original */evidence/manifest.json files found')
    counts = {'manifests': len(manifests), 'records': 0, 'nearbyFrontSide': 0, 'verifiedRecords': 0}
    issues, candidates, digest_cache = [], [], {}

    def verify_view(manifest_path, record, tier):
        view = record.get('images', {}).get(tier)
        if not isinstance(view, dict):
            raise ValueError('missing tier ' + tier)
        pose = view.get('pose', {})
        if any(not finite(pose.get(k)) for k in ['x', 'y', 'z']):
            raise ValueError('missing finite camera pose: ' + tier)
        pano_id = view.get('panoramaId', '')
        filename = view.get('file', '')
        if not pano_id or Path(pano_id).name != pano_id or not filename or Path(filename).name != filename:
            raise ValueError('invalid original/crop filename association: ' + tier)
        original = (manifest_path.parent / 'panoramas' / (pano_id + '.jpg')).resolve()
        crop = (manifest_path.parent / 'images' / filename).resolve()
        for path, expected in [(original, view.get('panoramaSha256')), (crop, view.get('sha256'))]:
            if not path.is_file():
                raise ValueError('missing file: ' + str(path))
            if not isinstance(expected, str) or len(expected) != 64:
                raise ValueError('missing checksum: ' + str(path))
            if path not in digest_cache:
                digest_cache[path] = sha256(path)
            if digest_cache[path] != expected:
                raise ValueError('checksum mismatch: ' + str(path))
        return {'tier': tier, 'path': str(crop), 'sha256': view['sha256'], 'manifestPath': str(manifest_path),
                'originalPath': str(original), 'panoramaSha256': view['panoramaSha256'],
                'panoramaId': pano_id, 'captureDate': view.get('date'), 'pose': pose,
                'sourceUrl': view.get('url'), 'datum': view.get('datum'),
                'heightInferred': view.get('heightInferred'), 'metricEligible': False}

    def geometry(view):
        x, y = view['pose']['x'] - mx, view['pose']['y'] - my
        distance = math.hypot(x, y)
        side = x * nx + y * ny
        angle = math.degrees(math.acos(max(-1, min(1, side / distance)))) if distance else 180
        return {'distanceM': round(distance, 3), 'frontSideStandoffM': round(side, 3), 'obliquityDeg': round(angle, 2)}

    for manifest_path in manifests:
        manifest_path = manifest_path.resolve()
        try:
            manifest = json.loads(manifest_path.read_text())
        except (OSError, ValueError) as error:
            issues.append({'manifestPath': str(manifest_path), 'reason': str(error)})
            continue
        for record in manifest.get('records', []):
            counts['records'] += 1
            if counts['records'] > args.max_records:
                parser.error('Record bound exceeded; no output written')
            full = record.get('images', {}).get('full', {})
            pose = full.get('pose', {})
            if not finite(pose.get('x')) or not finite(pose.get('y')):
                continue
            approximate = geometry(full)
            if approximate['distanceM'] > args.max_distance or approximate['obliquityDeg'] > args.max_obliquity:
                continue
            counts['nearbyFrontSide'] += 1
            try:
                if not record.get('buildingId') or record.get('elevationId', '').replace(':e:', '_e_') != record.get('id'):
                    raise ValueError('source owner/facade/record association mismatch')
                images = [verify_view(manifest_path, record, tier) for tier in ['full', 'roof']]
                for tier in ['context', 'ground']:
                    if tier in record.get('images', {}):
                        images.append(verify_view(manifest_path, record, tier))
            except (OSError, ValueError) as error:
                issues.append({'manifestPath': str(manifest_path), 'recordId': record.get('id'), 'reason': str(error)})
                continue
            roof = geometry(images[1])
            if roof['distanceM'] > args.max_distance or roof['obliquityDeg'] > args.max_obliquity:
                continue
            counts['verifiedRecords'] += 1
            dates = [image.get('captureDate') or '' for image in images[:2]]
            candidate = {'sourceCameraOwnerId': record['buildingId'], 'sourceAddress': record.get('address'),
                         'sourceRecordId': record['id'], 'manifestPath': str(manifest_path),
                         'manifestSha256': sha256(manifest_path), 'fullCamera': approximate, 'roofCamera': roof,
                         'captureDates': dates, 'targetVisibility': 'not-evaluated', 'metricEligible': False,
                         'prepareNeighborCompatible': {i['tier'] for i in images} == {'full', 'roof', 'context', 'ground'},
                         'sourceInventory': {'schemaVersion': 1, 'entries': [{
                             'address': record.get('address') or record['buildingId'],
                             'cachedOwnerId': record['buildingId'], 'selectedFacade': record['elevationId'],
                             'orderedFrontageRD': [record.get('wall', {}).get(k) for k in ['start', 'end']],
                             'images': images}]}}
            candidate['score'] = round(max(g['distanceM'] * (1 + g['obliquityDeg'] / 90) for g in [approximate, roof]), 3)
            candidates.append(candidate)
    # Keep distinct full+roof camera combinations, rather than repeating owners
    # which used exactly the same verified source pose and panorama.
    candidates.sort(key=lambda c: (c['manifestPath'], c['sourceRecordId']))
    candidates.sort(key=lambda c: min(c['captureDates']), reverse=True)
    candidates.sort(key=lambda c: (not c['prepareNeighborCompatible'], c['score']))
    unique, seen = [], set()
    for candidate in candidates:
        views = candidate['sourceInventory']['entries'][0]['images'][:2]
        key = tuple((v['panoramaId'], v['panoramaSha256'], v['pose']['x'], v['pose']['y'], v['pose']['z']) for v in views)
        if key in seen:
            continue
        seen.add(key)
        unique.append(candidate)
    selected = unique[:args.limit]
    report = {'schemaVersion': 1, 'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'target': {'address': target.get('address'), 'pandId': target['cachedOwnerId'], 'orderedFrontageRD': front},
              'ranking': 'Compatible four-tier records first; lower max(full,roof) distance*(1+obliquity/90); newer oldest full/roof date breaks ties. No visibility or metric claim.',
              'frontSide': args.front_side, 'counts': counts, 'uniqueCameraCombinations': len(unique),
              'suggestions': selected, 'verificationIssues': issues}
    if args.freeze:
        if not 1 <= args.select <= len(selected):
            parser.error('--select is outside the available suggestions')
        candidate = selected[args.select - 1]
        if not candidate['prepareNeighborCompatible']:
            parser.error('Selected record lacks all four verified tiers required by prepare-neighbor-references.mts')
        frozen = candidate['sourceInventory'] | {'selection': {
            'targetPandId': target['cachedOwnerId'], 'targetInventoryPath': str(args.inventory.resolve()),
            'sourceRecordId': candidate['sourceRecordId'], 'manifestSha256': candidate['manifestSha256'],
            'targetVisibility': 'not-evaluated', 'metricEligible': False}}
        write_json(args.freeze, frozen)
        report['frozenSourceInventoryPath'] = str(args.freeze.resolve())
    write_json(args.output, report)
    for index, candidate in enumerate(selected, 1):
        print(json.dumps({'rank': index, **{k: candidate[k] for k in ['sourceAddress', 'sourceCameraOwnerId', 'sourceRecordId', 'manifestPath', 'fullCamera', 'roofCamera', 'captureDates', 'prepareNeighborCompatible']},
                          'originalPaths': [i['originalPath'] for i in candidate['sourceInventory']['entries'][0]['images'][:2]]}))
    print(json.dumps({'output': str(args.output.resolve()), 'counts': counts, 'suggestions': len(selected), 'verificationIssues': len(issues)}))


if __name__ == '__main__':
    main()
