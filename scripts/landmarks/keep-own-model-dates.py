#!/usr/bin/env python3
"""Keep only the given landmark ids' entries of model-dates.json from the working copy, everything else as at HEAD.

    python3 scripts/landmarks/keep-own-model-dates.py <id> [<id> ...]

build-manual-landmarks / build-landmark-lods rewrite unrelated entries' dates; a lane commits only its own ids.
"""
import json, subprocess, sys

ids = sys.argv[1:]
p = 'public/canal-drive/models/model-dates.json'
new = json.load(open(p))
old = json.loads(subprocess.check_output(['git', 'show', 'HEAD:' + p]))


def find(d, path=()):
    for k, v in d.items():
        if isinstance(v, dict):
            if any(k == i or k.startswith(i + '.') for i in ids):
                yield path + (k,)
            else:
                yield from find(v, path + (k,))


for path in list(find(new)):
    o, n = old, new
    for k in path[:-1]:
        o = o.setdefault(k, {})
        n = n[k]
    o[path[-1]] = n[path[-1]]
with open(p, 'w') as f:
    json.dump(old, f, indent=2)
    f.write('\n')
print('kept', ids)
