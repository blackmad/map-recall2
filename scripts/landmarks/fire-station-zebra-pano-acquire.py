exec(open('scripts/landmarks/fire-station-zebra-acquire.py').read().split('urls=')[0])
import math
urls={f'panoramas-{p}.json':f'https://api.data.amsterdam.nl/panorama/panoramas/?bbox=4.954,52.3957,4.956,52.3970&page={p}&page_size=100' for p in range(2,12)}
exec(open('scripts/landmarks/fire-station-zebra-acquire.py').read().split('def fetch')[1].split("(root/'urls.json')")[0].join(['def fetch','']))
ps=json.load(open(root/'panoramas.json'))['_embedded']['panoramas']
for p in range(2,12):ps+=json.load(open(root/f'panoramas-{p}.json'))['_embedded']['panoramas']
# Two south-front stations and north rear across current captures.
targets=[[4.95474,52.39602],[4.95518,52.39617],[4.95502,52.39648]];selected=[]
for t in targets:
 cand=[p for p in ps if p['timestamp'][:4]>='2024'];p=min(cand,key=lambda p:math.dist([(p['geometry']['coordinates'][0]-t[0])*.61,p['geometry']['coordinates'][1]-t[1]],[0,0]));selected.append(p)
(root/'selected-panoramas.json').write_text(json.dumps(selected,indent=2));urls={p['pano_id']+'.jpg':p['_links']['equirectangular_full']['href'] for p in selected};exec(open('scripts/landmarks/fire-station-zebra-acquire.py').read().split('def fetch')[1].split("(root/'urls.json')")[0].join(['def fetch','']));print([(p['pano_id'],p['timestamp'],p['geometry']['coordinates']) for p in selected])
