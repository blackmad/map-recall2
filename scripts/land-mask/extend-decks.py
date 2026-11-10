# /// script
# requires-python = ">=3.11"
# ///
"""Apply scripts/land-mask/deck-extensions.json to a staging copy of elevation-v1/bridges.json.
  uv run scripts/land-mask/extend-decks.py [--in public/data/extracts/amsterdam/elevation-v1/bridges.json] [--out artifacts/elevation/staging/elevation-v1/bridges.json]
Only `deck` of the named measured bridges changes; the file is otherwise re-emitted exactly as the builder writes it.
"""
import argparse, json
ap = argparse.ArgumentParser()
ap.add_argument('--in', dest='src', default='public/data/extracts/amsterdam/elevation-v1/bridges.json')
ap.add_argument('--out', default='artifacts/elevation/staging/elevation-v1/bridges.json')
ap.add_argument('--ext', default='scripts/land-mask/deck-extensions.json')
a = ap.parse_args()
raw = open(a.src).read()
data = json.loads(raw)
by_id = {b['id']: b for b in data['measured']}
for e in json.load(open(a.ext))['extensions']:
    b = by_id[e['id']]
    assert b['deck'] == e['was'], f"{e['id']}: deck is {b['deck']}, expected {e['was']}"
    s_end = b['p'][-2] / 100
    assert 0 <= e['deck'][0] < e['deck'][1] <= s_end, f"{e['id']}: deck {e['deck']} outside the profile 0..{s_end}"
    b['deck'] = e['deck']
    print(f"{e['id']} {e['name']}: deck {e['was']} -> {e['deck']}")
# Patch the text in place so every other byte of the file stays as the builder wrote it.
for e in json.load(open(a.ext))['extensions']:
    at = raw.index(f'"id":"{e["id"]}"')
    old = '"deck":' + json.dumps(e['was'], separators=(',', ':'))
    pos = raw.index(old, at)
    assert pos - at < 400, f"{e['id']}: deck field not in the object header"
    raw = raw[:pos] + '"deck":' + json.dumps(e['deck'], separators=(',', ':')) + raw[pos + len(old):]
open(a.out, 'w').write(raw)
assert json.loads(raw)['measured'] and len(raw) - len(open(a.src).read()) < 40
print('written', a.out)
