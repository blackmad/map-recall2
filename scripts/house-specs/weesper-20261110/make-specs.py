"""Hand specs for the Weesperbuurt / Sarphatistrook / Plantage lane (2026-11-10): readings.json -> specs/<pandId>.json.

Each reading names the pand, the strip it was read on, and the design fields the author states over the block face's own
(the face intent, scripts/block-face/faces/<run>/intent.json, stays the streetlevel-measured source; build-house-specs
resolves both). Run from the repo root: python3 scripts/house-specs/weesper-20261110/make-specs.py
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
readings = json.load(open(os.path.join(HERE, 'readings.json')))
out = os.path.join(HERE, 'specs'); os.makedirs(out, exist_ok=True)
for r in readings['pands']:
    design, prov = {}, {}
    for path, value in r['fields'].items():
        node = design
        parts = path.split('/')
        for i, k in enumerate(parts[:-1]):
            nxt = parts[i + 1]
            if k == 'fronts':
                node = node.setdefault('fronts', [])
                continue
            if isinstance(node, list):
                idx = int(k)
                while len(node) <= idx: node.append({})
                node = node[idx]
                continue
            node = node.setdefault(k, {})
        last = parts[-1]
        if isinstance(node, list):
            idx = int(last)
            while len(node) <= idx: node.append({})
            node[idx] = value
        else:
            node[last] = value
        prov[path] = {'source': 'author', 'confidence': r.get('confidence', 0.9), 'ref': r['ref'], 'at': r['at']}
    spec = {'schemaVersion': 1, 'pandId': r['pandId'], 'address': r['address'], 'design': design, 'provenance': prov}
    if r.get('schemaLimits'): spec['schemaLimits'] = r['schemaLimits']
    text = json.dumps(spec, indent=1) + '\n'
    dest = os.path.join(out, r['pandId'] + '.json')
    # Only rewrite a changed spec: house:stage refuses a preview receipt older than the spec file.
    if not os.path.exists(dest) or open(dest).read() != text: open(dest, 'w').write(text)
print(len(readings['pands']), 'specs ->', out)
