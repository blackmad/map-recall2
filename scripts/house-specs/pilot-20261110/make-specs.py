"""Lane H7: readings.json -> specs/<pandId>.json (HouseSpec v1, source author, one receipt per field)."""
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
R = json.load(open(os.path.join(here, 'readings.json')))
out = os.path.join(here, 'specs'); os.makedirs(out, exist_ok=True)
for pand, r in R.items():
    if pand.startswith('_'): continue
    spec = {'schemaVersion': 1, 'pandId': pand, 'address': r['address'].split(' (')[0], 'design': {}, 'provenance': {}}
    for path, value in r['fields'].items():
        parts = path.split('/')
        if parts[0] == 'fronts':
            fronts = spec['design'].setdefault('fronts', [{}]); fronts[int(parts[1])][parts[2]] = value
        elif parts[0] == 'facts':
            spec.setdefault('facts', {})[parts[1]] = value
        else:
            spec['design'].setdefault(parts[0], {})[parts[1]] = value
        spec['provenance'][path] = {'source': 'author', 'confidence': 0.9, 'ref': f"h7 hand read of {r['photo']}: {r['why'][path]}", 'at': '2026-11-10'}
    if r.get('limits'): spec['schemaLimits'] = r['limits']
    text, f = json.dumps(spec, indent=1, ensure_ascii=False) + '\n', os.path.join(out, f'{pand}.json')
    if not os.path.exists(f) or open(f).read() != text: open(f, 'w').write(text)  # unchanged specs keep their mtime (house:stage receipt rule)
print(len(os.listdir(out)), 'specs')
