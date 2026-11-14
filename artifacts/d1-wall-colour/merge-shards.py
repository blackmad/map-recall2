# merge captures-belt-s*.json (round 2, with `nb`) over captures-belt.json -> argv[1]
import json,glob,sys
m={r['pandId']:r for r in json.load(open('artifacts/d1-wall-colour/captures-belt.json'))['rows']}
for f in sorted(glob.glob('artifacts/d1-wall-colour/captures-belt-s*.json')):
  for r in json.load(open(f))['rows']:
    o=m.get(r['pandId'])
    if o is None or (r['captures'] and all('nb' in c for c in r['captures'])) or not o['captures']: m[r['pandId']]=r
json.dump({'rows':list(m.values())},open(sys.argv[1],'w'))
print(len(m), sum(1 for r in m.values() if r['captures'] and all('nb' in c for c in r['captures'])))
