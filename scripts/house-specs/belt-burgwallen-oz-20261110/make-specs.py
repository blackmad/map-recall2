#!/usr/bin/env python3
"""Belt builder, Burgwallen-Oude Zijde (issue #364): readings.json -> scripts/house-specs/specs/<pandId>.json.

Each reading is one pand read by hand from a row view (scripts/house-frames/row-view.ts, across the canal) and the
house:crops crop. The design is a complete CanalHouseIntent body (fronts, roof, palette), so the spec takes the recipe
route (toRecipe). Provenance: one `author` receipt per top-level design key, dated by the photo that shows it.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
readings = json.load(open(os.path.join(HERE, 'readings.json')))
out_dir = os.path.join(ROOT, 'scripts/house-specs/specs')
only = set(sys.argv[1:])
DEFAULT_FRONT = {'basement': 'none', 'cornice': 'none', 'doorBay': 0, 'windows': 'sash', 'hoist': False}
for r in readings['pands']:
    if only and r['pandId'] not in only and r['label'] not in only:
        continue
    photo = readings['photos'][r['photo']]
    front = {'id': 'front0', 'street': r['street'], **DEFAULT_FRONT, **r['front']}
    design = {'fronts': [front], 'roof': r.get('roof', {'material': 'black-tile'}), 'palette': {**readings['palette'], **r['palette']}}
    if r.get('notes'):
        design['notes'] = r['notes']
    ref = lambda what: f"lane belt-burgwallen-oz-build-20261110 hand read ({what}) of {photo['ref']}"
    prov = {
        'fronts/0': {'source': 'author', 'confidence': 0.85, 'ref': ref('front: crown, storeys, axes, windows, ground storey'), 'at': photo['at']},
        'roof': {'source': 'author', 'confidence': 0.6, 'ref': ref('roof from the front'), 'at': photo['at']},
        'palette': {'source': 'author', 'confidence': 0.7, 'ref': ref('wall and trim colours') + (f"; wall {r['colourRef']}" if r.get('colourRef') else ''), 'at': photo['at']},
    }
    if r.get('notes'):
        prov['notes'] = {'source': 'author', 'confidence': 0.9, 'ref': ref('notes'), 'at': photo['at']}
    spec = {'schemaVersion': 1, 'pandId': r['pandId'], 'address': f"{r['street']} {r['label']}", 'design': design, 'provenance': prov}
    if r.get('limits'):
        spec['schemaLimits'] = [{'component': c, 'what': w} for c, w in r['limits']]
    with open(os.path.join(out_dir, f"{r['pandId']}.json"), 'w') as f:
        f.write(json.dumps(spec, indent=1, ensure_ascii=False) + '\n')
    print(r['pandId'], r['label'])
