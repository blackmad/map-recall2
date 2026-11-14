"""Lane WC (#384): score house:frames runs of one list (wall dE against the photo, pose.json lab), with paired bootstrap CIs.

  python3 scripts/house-specs/wall-exposure/score.py NAME=<dir> ... [--archived <scores.json> NAME,...] [--base NAME] [--json out]

Per setting: n, mean / median OKLab wall dE (game vs photo), the 95 % bootstrap CI of the mean, pixel L and C against the
photo's, worse / better than the base by more than 0.02, the paired difference against every other setting (mean and
95 % CI, 4,000 resamples, seed 1), and how often the target wall changed against the base (pose.json drawn.specRecipeWall).
--archived adds per-pair dE of W3's runs (benchmark-v2 scores.json settings, e.g. W1,band05: same poses, older code).
Pairs count when every run framed them and none flagged otherBuilding.
"""
import json, math, os, random, statistics as st, sys
args = sys.argv[1:]; runs = []; base = None; out = None; arch = None; archNames = []
i = 0
while i < len(args):
    a = args[i]
    if a == '--base': base = args[i + 1]; i += 2; continue
    if a == '--json': out = args[i + 1]; i += 2; continue
    if a == '--archived': arch = args[i + 1]; archNames = args[i + 2].split(','); i += 3; continue
    runs.append(a.split('=', 1)); i += 1
def load(d):
    o = {}
    for k in os.listdir(d):
        f = os.path.join(d, k, 'pose.json')
        if os.path.exists(f):
            p = json.load(open(f))
            if p.get('lab', {}).get('photo') and p['lab'].get('game'): o[p['key']] = p
    return o
data = {n: load(d) for n, d in runs}
keys = sorted(set.intersection(*[set(v) for v in data.values()]))
keys = [k for k in keys if not any(data[n][k]['flags'].get('otherBuilding') for n in data)]
v = lambda l: (l['L'], l['C'] * math.cos(math.radians(l['h'])), l['C'] * math.sin(math.radians(l['h'])))
first = runs[0][0]
photo = {k: data[first][k]['lab']['photo'] for k in keys}
E = {n: {k: math.dist(v(data[n][k]['lab']['game']), v(photo[k])) for k in keys} for n in data}
if arch:
    s = json.load(open(arch))['settings']
    for n in archNames:
        pp = s[n]['perPair']
        keys = [k for k in keys if k in pp]
    for n in archNames: E['W3:' + n] = {k: s[n]['perPair'][k] for k in keys}
names = list(E)
rng = random.Random(1)
def ci(xs, R=4000):
    m = [st.mean(rng.choices(xs, k=len(xs))) for _ in range(R)]; m.sort(); return (round(m[int(0.025 * R)], 4), round(m[int(0.975 * R)], 4))
res = {'n': len(keys), 'photoL': round(st.mean(photo[k]['L'] for k in keys), 3), 'photoC': round(st.mean(photo[k]['C'] for k in keys), 3), 'settings': {}, 'paired': {}}
b = base or first
for n in names:
    xs = [E[n][k] for k in keys]
    r = {'meanDE': round(st.mean(xs), 4), 'ci': ci(xs), 'medianDE': round(st.median(xs), 4)}
    if n in data:
        r['pixelL'] = round(st.mean(data[n][k]['lab']['game']['L'] for k in keys), 3); r['pixelC'] = round(st.mean(data[n][k]['lab']['game']['C'] for k in keys), 3)
        r['wallChangedVsBase'] = sum((data[n][k].get('drawn') or {}).get('specRecipeWall') != (data[b][k].get('drawn') or {}).get('specRecipeWall') for k in keys) if b in data else None
    r['worseThanBase'] = sum(E[n][k] > E[b][k] + 0.02 for k in keys); r['betterThanBase'] = sum(E[n][k] < E[b][k] - 0.02 for k in keys)
    r['perPair'] = {k: round(E[n][k], 4) for k in keys}
    res['settings'][n] = r
for n in names:
    for m in names:
        if n >= m: continue
        d = [E[n][k] - E[m][k] for k in keys]
        res['paired'][f'{n} - {m}'] = {'mean': round(st.mean(d), 4), 'ci': ci(d)}
print(f"n {res['n']}  photo L {res['photoL']} C {res['photoC']}")
print(f"{'setting':16s} {'mean dE':>8s} {'95% CI':>18s} {'median':>7s} {'px L':>6s} {'px C':>6s} {'worse/better vs ' + b:>24s} {'wall changed':>12s}")
for n, r in res['settings'].items():
    print(f"{n:16s} {r['meanDE']:8.4f} {str(r['ci']):>18s} {r['medianDE']:7.4f} {r.get('pixelL', ''):>6} {r.get('pixelC', ''):>6} {str(r['worseThanBase']) + ' / ' + str(r['betterThanBase']):>24s} {str(r.get('wallChangedVsBase', '')):>12s}")
for k, d in res['paired'].items(): print(f"  {k:36s} {d['mean']:+.4f} {d['ci']}")
if out: json.dump(res, open(out, 'w'), indent=1)
