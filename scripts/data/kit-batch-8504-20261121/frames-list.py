#!/usr/bin/env python3
"""house:frames list entries at the poses of each recipe's archived crops (lane kit-batch-8504-20261121).

  python3 -I scripts/data/kit-batch-8504-20261121/frames-list.py <house-id>... > list.json

One entry per cited crop: the crop's panorama, its wall bearing and centre, key <house>-<tag>. Reads
$MAP_RECALL_SOURCE_DATA/pand-reference-walls/<pand>/walls.json.
"""
import json, os, sys

root = os.environ['MAP_RECALL_SOURCE_DATA']
out = []
for house in sys.argv[1:]:
    intent = json.load(open(f'scripts/building-recipes/houses/{house}/intent.json'))
    pand = intent['pandId']
    walls = json.load(open(f'{root}/pand-reference-walls/{pand}/walls.json'))
    walls = walls.get('walls', walls) if isinstance(walls, dict) else walls
    rows = walls.values() if isinstance(walls, dict) else walls
    by_tag = {w['tag']: w for w in rows if isinstance(w, dict) and 'tag' in w}
    for s in intent.get('sources', []):
        img = s.get('image', '')
        if not img.startswith('source-data://pand-reference-walls/'):
            continue
        tag = os.path.basename(img).removesuffix('.jpg')
        w = by_tag.get(tag)
        if not w or not w.get('panoId'):
            continue
        out.append({'pandId': pand, 'bearing': w['bearing'], 'at': w['centre'], 'pano': w['panoId'],
                    'maxDistM': max(35, round(w.get('cameraDistM', 30) + 10)), 'key': f'{house}--{tag}'})
json.dump(out, sys.stdout, indent=1)
print()
