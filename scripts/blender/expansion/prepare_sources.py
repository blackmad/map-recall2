"""Cache-only expansion selection. Writes staged source entries, never live recipes."""
import copy, json, math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CASES = ROOT / '.worktrees/amsterdam-facade-rebuild/public/data/facade-repair-preview/cases.json'
SELECTION = [
    ('case-05', 'lauriergracht-67-69', 'Lauriergracht residential pair', '#5c4d45'),
    ('case-08', 'rozengracht-251', 'Moeders', '#754e40'),
    ('case-09', 'rozengracht-228', 'Narrow gabled house', '#5d4031'),
    ('case-10', 'rozengracht-114', 'Rozengracht straight cornice house', '#6b5a52'),
    ('case-23', 'lauriergracht-37', 'Lauriergracht apartment building', '#675346'),
    ('case-25', 'rozengracht-249', 'Rozengracht balcony terrace reserve', '#745546'),
]

def distance(a, b):
    return math.hypot(a['x'] - b['x'], a['y'] - b['y'])

def main():
    cases = {c['caseId']: c for c in json.loads(CASES.read_text())['cases']}
    entries, audit = [], []
    for case_id, slug, name, colour in SELECTION:
        c = cases[case_id]
        f = c['frame']
        front = [f['a'], [f['a'][i] + f['u'][i] * f['width'] for i in (0, 1)]]
        owner = copy.deepcopy(c['owner'])
        origin = owner['geometry']['building']['coordinateFrame']['originRD']
        target = [{'x': origin['x'] + p[0], 'y': origin['y'] - p[1]} for p in front]
        options = []
        for observation in owner['observations']:
            images = observation['payload'].get('images', {})
            image = images.get('full') or images.get('ground')
            if not image:
                continue
            plane = image['plane']
            direct = max(distance(target[i], plane[k]) for i, k in enumerate(('start', 'end')))
            reverse = max(distance(target[1-i], plane[k]) for i, k in enumerate(('start', 'end')))
            options.append((min(direct, reverse), reverse < direct, observation, direct, reverse))
        error, reversed_front, primary, direct, reverse = min(options, key=lambda v: v[0])
        if reversed_front:
            front.reverse()
        # Existing importer picks the first full observation; deliberately place
        # the closest physical plane first while retaining all alternatives.
        owner['observations'].sort(key=lambda o: o['id'] != primary['id'])
        entry = {k: copy.deepcopy(c[k]) for k in ('caseId', 'address', 'frame', 'shapeFeatures', 'source')}
        entry.update(id=slug, name=name, owner=owner, front=front, brickColour=colour)
        entry['expansionAudit'] = {
            'reviewDate': '2026-09-30', 'selectedObservationId': primary['id'],
            'originalPlaneEndpointErrorM': error, 'originalFrameReversedForPhoto': reversed_front,
            'physicalFrontageStatus': 'shell-selected; rectification/anchor registration unresolved',
            'sourceCasePath': str(CASES.relative_to(ROOT)),
            'manualOverridesPreserved': True,
        }
        entries.append(entry)
        audit.append({'id': slug, 'caseId': case_id, **entry['expansionAudit']})
    out = ROOT / 'scripts/blender/expansion/source-manifest.json'
    out.write_text(json.dumps({'version': 1, 'entries': entries}, indent=2) + '\n')
    (ROOT / 'artifacts/building-library/expansion/source-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
    print(json.dumps(audit, indent=2))

if __name__ == '__main__':
    main()
