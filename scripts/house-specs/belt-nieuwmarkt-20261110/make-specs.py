"""Belt lane Nieuwmarkt/Lastage (#363): readings.json -> specs/<pandId>.json (HouseSpec v1, recipe route).

One reading per pand: the full design (fronts, roof, palette) read by eye from the house:crops crop (and the panorama
named in `photo`), one `author` receipt per field path dated by the photo's capture day, so toRecipe sees a dated
human-review source and the spec takes the recipe route. `why` notes per field path go into the receipt; `limits` are
schemaLimits. Unchanged specs keep their mtime (the house:stage receipt rule).
"""
import json, os
here = os.path.dirname(os.path.abspath(__file__))
R = json.load(open(os.path.join(here, 'readings.json')))
out = os.path.join(here, 'specs'); os.makedirs(out, exist_ok=True)
n = 0
for pand, r in R.items():
    if pand.startswith('_'): continue
    d = r['design']
    spec = {'schemaVersion': 1, 'pandId': pand, 'address': r['address'], 'design': d, 'provenance': {}}
    why = r.get('why', {})
    def rec(path):
        note = why.get(path)
        ref = f"belt-nieuwmarkt hand read of {r['photo']}" + (f": {note}" if note else '')
        spec['provenance'][path] = {'source': 'author', 'confidence': r.get('confidence', 0.85), 'ref': ref, 'at': r['date']}
    for i, f in enumerate(d.get('fronts', [])):
        for k in f: rec(f'fronts/{i}/{k}')
    for part in ('roof', 'palette'):
        for k in d.get(part, {}): rec(f'{part}/{k}')
    if d.get('notes'): rec('notes')
    for k, v in r.get('facts', {}).items():
        spec.setdefault('facts', {})[k] = v; rec(f'facts/{k}')
    if r.get('limits'): spec['schemaLimits'] = r['limits']
    text, f = json.dumps(spec, indent=1, ensure_ascii=False) + '\n', os.path.join(out, f'{pand}.json')
    if not os.path.exists(f) or open(f).read() != text: open(f, 'w').write(text)
    n += 1
print(n, 'specs')
