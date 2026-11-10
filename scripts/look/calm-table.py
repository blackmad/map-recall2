import json,subprocess,sys,os
d=sys.argv[1]; names=['westerkerk','bloemgracht-80','nassaukade','leidsegracht-courtyard','ijburg-edge']
for variant in sys.argv[2:]:
    j=json.load(open(f'{d}/{variant}.json'))
    print('##',variant)
    for n in names:
        f=f'{d}/{n}-{variant}.png'
        out=subprocess.run(['npx','tsx','scripts/look/busyness.mts',f],capture_output=True,text=True).stdout.strip().splitlines()[-1]
        b=json.loads(out); ev=j[n].get('eval') or {}
        print(f"| {n} | edge {b['farOverNear'][0]} | var {b['farOverNear'][1]} | chroma {b['chroma']['farOverNear']} | near edge {b['near'][0]} | labels {ev.get('n')} poi {ev.get('kinds',{}).get('poi',0)} poiTop {ev.get('poiTop')} |")
