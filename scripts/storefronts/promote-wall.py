# Promote an alternate-wall crop to a business's reference: keeps the old crop as <slug>-w0-orig,
# rewrites the wall in storefrontWalls.generated.ts. stdin: "slug<TAB>alt-name" per line.
#   python3 scripts/storefronts/promote-wall.py tmp/storefronts/refs tmp/storefronts/refs-alt < picks.tsv
import json, shutil, sys
refs, alt = sys.argv[1], sys.argv[2]
p = 'src/canalRecall/storefrontWalls.generated.ts'; s = open(p).read(); head, body = s.split('= ', 1); data = json.loads(body.rstrip().rstrip(';'))
r = lambda v: round(v * 1e7) / 1e7
for line in sys.stdin:
    if not line.strip(): continue
    slug, name = line.split()
    try: shutil.copy(f'{refs}/{slug}.jpg', f'{refs}/{slug}-orig.jpg'); shutil.copy(f'{refs}/{slug}.json', f'{refs}/{slug}-orig.json')
    except FileNotFoundError: pass
    m = json.load(open(f'{alt}/{name}.json')); w = m['wall']
    m['name'] = slug; m['image'] = slug + '.jpg'; m['note'] = f'Wall picked by eye from alternate walls ({name}); the --near wall showed no shopfront.'
    shutil.copy(f'{alt}/{name}.jpg', f'{refs}/{slug}.jpg'); json.dump(m, open(f'{refs}/{slug}.json', 'w'))
    data[slug] = {'pand': m['buildingIds'][0], 'start': [r(x) for x in w['startLngLat']], 'end': [r(x) for x in w['endLngLat']], 'lengthM': round(w['lengthM'] * 100) / 100, 'alongM': w['lengthM'] / 2}
    print('promoted', slug, '<-', name)
open(p, 'w').write(head + '= ' + json.dumps(data, separators=(',', ':')) + ';\n')
