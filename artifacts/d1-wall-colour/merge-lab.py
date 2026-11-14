# merge rows-lab-v3.json (photo + v3) into rows-lab-v2.json (photo, today, staged, v2a, v2) -> rows-lab-r2.json; row means
# recomputed over the pands that read in the photo and in every run kept
import json
a=json.load(open('artifacts/d1-wall-colour/rows-lab-v2.json')); b=json.load(open('artifacts/d1-wall-colour/rows-lab-v3.json'))
runs=['photo','today','staged','v2','v3']; out={}
for k,r in a.items():
  per={}
  for i,v in r['per'].items():
    w=b.get(k,{}).get('per',{}).get(i) or {}
    per[i]={**{x:v.get(x) for x in ['photo','today','staged','v2']}, 'v3': w.get('v3')}
  ok=[i for i,v in per.items() if all(v.get(x) for x in runs)]
  mean={x:({'L':round(sum(per[i][x]['L'] for i in ok)/len(ok),3),'C':round(sum(per[i][x]['C'] for i in ok)/len(ok),3)} if ok else {'L':None,'C':None}) for x in runs}
  out[k]={'side':r['side'],'n':len(ok),'photoScene':r.get('photoScene'),'mean':mean,'per':per}
json.dump(out,open('artifacts/d1-wall-colour/rows-lab-r2.json','w'),indent=1)
pages=json.load(open('artifacts/d1-wall-colour/pages.json'))
for pg,ks in pages.items():
  s={x:[0,0,0,0] for x in ['today','staged','v2','v3']}
  for k in ks:
    m=out.get(k,{}).get('mean')
    if not m or m['photo']['L'] is None: continue
    for x in s: s[x][0]+=abs(m[x]['L']-m['photo']['L']); s[x][1]+=m[x]['L']-m['photo']['L']; s[x][2]+=m[x]['C']-m['photo']['C']; s[x][3]+=1
  print(pg.ljust(22),' | '.join(f"{x} |dL| {v[0]/v[3]:.3f} dL {v[1]/v[3]:+.3f} dC {v[2]/v[3]:+.3f}" for x,v in s.items() if v[3]))
for k,r in out.items():
  m=r['mean']; print(k.ljust(30),'n',r['n'],' '.join(f"{x} {m[x]['L']}/{m[x]['C']}" for x in runs))
