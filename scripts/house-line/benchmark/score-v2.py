"""Wall-colour benchmark v2 (lane W3): score house:frames runs of one pair list against each other.

  python3 scripts/house-line/benchmark/score-v2.py --base W1=<dir>[,<repick dir>] NAME=<dir>[,<repick dir>] ... [--meta staging/benchmark-v2/benchmark-v2.json] [--json out]

Per setting: mean OKLab wall dE (pose.json lab: analyse.ts wallLab on photo and game), pairs worse / better than the base by
more than 0.02, pixel L/C against the photo, the pale-photo pairs (photo L >= 0.62), and spread: the std of wall L over all
pairs and per buurt (buurten with 3 or more pairs), each as a share of the photos'. A pair counts only when every run framed
it and none flagged otherBuilding.
"""
import json, math, os, sys, statistics as st, collections
args = sys.argv[1:]
base = None; runs = []; meta = None; out = None
i = 0
while i < len(args):
    a = args[i]
    if a == '--base': base = args[i + 1]; i += 2; continue
    if a == '--meta': meta = args[i + 1]; i += 2; continue
    if a == '--json': out = args[i + 1]; i += 2; continue
    runs.append(a); i += 1
if base: runs.insert(0, base)
runs = [r.split('=', 1) for r in runs]
def load(dirs):
    # NAME=dir[,dir...]: a later dir (the otherBuilding re-pick) overrides an earlier one's pair.
    o = {}
    for d in dirs.split(','):
      if not os.path.isdir(d): continue
      for k in os.listdir(d):
        f = os.path.join(d, k, 'pose.json')
        if not os.path.exists(f): continue
        p = json.load(open(f))
        if p.get('lab', {}).get('photo') and p['lab'].get('game'): o[p['key']] = p
    return o
data = {n: load(d) for n, d in runs}
info = {p['pandId']: p for p in json.load(open(meta))['pands']} if meta else {}
keys = sorted(set.intersection(*[set(v) for v in data.values()]))
keys = [k for k in keys if not any(data[n][k]['flags'].get('otherBuilding') for n in data)]
v = lambda l: (l['L'], l['C'] * math.cos(math.radians(l['h'])), l['C'] * math.sin(math.radians(l['h'])))
dE = lambda a, b: math.dist(v(a), v(b))
first = runs[0][0]
photo = {k: data[first][k]['lab']['photo'] for k in keys}
pale = [k for k in keys if photo[k]['L'] >= 0.62]
res = {'n': len(keys), 'palePhotos': len(pale), 'paleShare': round(len(pale) / max(1, len(keys)), 3), 'settings': {}}
sd = lambda xs: st.pstdev(xs) if len(xs) > 1 else 0
groups = collections.defaultdict(list)
for k in keys: groups[info.get(k, {}).get('buurt', '?')].append(k)
groups = {g: ks for g, ks in groups.items() if len(ks) >= 3}
phL = [photo[k]['L'] for k in keys]
for n, _ in runs:
    g = {k: data[n][k]['lab']['game'] for k in keys}
    e = {k: dE(g[k], photo[k]) for k in keys}
    r = {'meanDE': round(st.mean(e.values()), 4), 'medianDE': round(st.median(e.values()), 4),
         'pixelL': round(st.mean(x['L'] for x in g.values()), 3), 'pixelC': round(st.mean(x['C'] for x in g.values()), 3),
         'paleMeanDE': round(st.mean(e[k] for k in pale), 3) if pale else None,
         'spreadAll': round(sd([g[k]['L'] for k in keys]) / sd(phL), 2),
         'spreadBuurt': round(st.mean(sd([g[k]['L'] for k in ks]) for ks in groups.values()) / st.mean(sd([photo[k]['L'] for k in ks]) for ks in groups.values()), 2) if groups else None}
    if n != first:
        b = {k: dE(data[first][k]['lab']['game'], photo[k]) for k in keys}
        r['worseThanBase'] = sum(e[k] > b[k] + 0.02 for k in keys); r['betterThanBase'] = sum(e[k] < b[k] - 0.02 for k in keys)
    r['perPair'] = {k: round(e[k], 4) for k in keys}
    res['settings'][n] = r
res['photoL'] = round(st.mean(phL), 3); res['photoC'] = round(st.mean(photo[k]['C'] for k in keys), 3); res['buurtGroups'] = len(groups)
print(f"n {res['n']}  pale photos {res['palePhotos']} ({res['paleShare']:.1%})  photo L {res['photoL']} C {res['photoC']}  buurt groups {len(groups)}")
print('| setting | mean dE | median | worse/better vs ' + first + ' | pixel L | pixel C | pale-photo dE | spread all | spread per buurt |')
print('|---|---|---|---|---|---|---|---|---|')
for n, r in res['settings'].items():
    wb = f"{r.get('worseThanBase', '-')}/{r.get('betterThanBase', '-')}"
    print(f"| {n} | {r['meanDE']} | {r['medianDE']} | {wb} | {r['pixelL']} | {r['pixelC']} | {r['paleMeanDE']} | {r['spreadAll']} | {r['spreadBuurt']} |")
if out: json.dump(res, open(out, 'w'), indent=1)
