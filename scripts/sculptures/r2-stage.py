"""Stage the round-2 (sculpture-r2-20261122) blind-A/B winners as installed-figures records, for the integrator to copy into
scripts/sculptures/installed/ (see docs/reports/sculpture-r2-20261122.md). Reads the run.json of each chosen candidate.

    python3 scripts/sculptures/r2-stage.py   ->  scripts/sculptures/staged-r2-20261122/{<model>.json, <model>/<name>.glb}
"""
import json, os, shutil
A = 'artifacts/sculpture-r2'; OUT = 'scripts/sculptures/staged-r2-20261122'
STATUES = {'spinoza-standbeeld': 'trellis-s42', 'mama-baranka': 'tsrL-cac10d4136', 'walraven-van-hall': 'tsr-82071fd7cb'}
RELIEFS = {'hoofdbureau-arms': 'trellis-s7', 'palace-pediment': 'tsr-cut2', 'west-india-pediment': 'tsr', 'barlaeus-group': 'tsr', 'hmdh-busts': 'trellis-s42'}
ROUTE = lambda l: ('TRELLIS.2 int8 (ComfyUI native), seed ' + l.split('-s')[-1]) if l.startswith('trellis') else 'TripoSR, one photo' + (' (base levelled)' if l.startswith('tsrL') else '')
cfg = json.load(open('scripts/sculptures/rebuild-r2-20261122.json'))['statues']
os.makedirs(OUT, exist_ok=True)
for sid, label in STATUES.items():
    run = json.load(open(f'{A}/statues/{sid}/{label}/run.json')); f = cfg[sid]['figures'][0]
    os.makedirs(f'{OUT}/{sid}', exist_ok=True); shutil.copy(f'{A}/statues/{sid}/{label}/figure.glb', f'{OUT}/{sid}/{f["name"]}.glb')
    rec = {'id': sid, 'provenance': f'scripts/sculptures/rebuild-sources-r2/{sid}.json', 'figures': [{
        'name': f['name'], 'glb': f'scripts/sculptures/installed/{sid}/{f["name"]}.glb', 'at': run['at'], 'cut': f['cut'],
        'cutMaterials': f.get('cutMaterials', ['bronze']), 'material': f.get('material', 'bronze'), 'route': f'{ROUTE(label)}, {label}, round 2 2026-11-22'}]}
    json.dump(rec, open(f'{OUT}/{sid}.json', 'w'), indent=1); open(f'{OUT}/{sid}.json', 'a').write('\n')
for key, label in RELIEFS.items():
    run = json.load(open(f'{A}/reliefs/{key}/{label}/run.json')); model = run['model']; r = dict(run['record'])
    r['route'] = f'{ROUTE(label)}, {label}, wall relief round 2 2026-11-22'
    os.makedirs(f'{OUT}/{model}', exist_ok=True); shutil.copy(f'{A}/reliefs/{key}/{label}/relief.glb', f'{OUT}/{model}/{key}.glb')
    rec = {'id': model, 'provenance': f'scripts/sculptures/rebuild-sources-r2/reliefs.json#{key}', 'figures': [r]}
    json.dump(rec, open(f'{OUT}/{model}.json', 'w'), indent=1); open(f'{OUT}/{model}.json', 'a').write('\n')
print(sorted(os.listdir(OUT)))
