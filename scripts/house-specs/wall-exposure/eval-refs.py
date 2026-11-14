import json,math,statistics as st,random,sys
rows=json.load(open(sys.argv[1]))['rows']
def lin(v):
  v/=255; return v/12.92 if v<=0.04045 else ((v+0.055)/1.055)**2.4
def Y(h): r,g,b=[lin(int(h[i:i+2],16)) for i in (1,3,5)]; return 0.2126*r+0.7152*g+0.0722*b
def okL(y): return y**(1/3)  # OKLab L of a neutral at luminance y (approx)
refs={'none':lambda r:1,'white':lambda r:r['white'],'p80':lambda r:r['p80'],'scene':lambda r:r['scene'],
 'white*scene':lambda r:math.sqrt(r['white']*r['scene']),'p80*scene':lambda r:math.sqrt(r['p80']*r['scene'])}
groups=[[c for c in r['captures'] if c.get('ref')] for r in rows]; groups=[g for g in groups if len(g)>1]
print('pands',len(groups),'captures',sum(len(g) for g in groups))
for name,f in refs.items():
  for k in [1.0, 0.5]:  # full or half-strength normalisation (gain exponent)
    if name=='none' and k<1: continue
    ds=[]
    for g in groups:
      Ls=[okL(Y(c['w1']['hex'])*(1/f(c['ref']))**k) for c in g]
      for i in range(len(Ls)):
        for j in range(i+1,len(Ls)): ds.append(abs(math.log(Y(g[i]['w1']['hex'])/f(g[i]['ref'])**k)-math.log(Y(g[j]['w1']['hex'])/f(g[j]['ref'])**k)))
    # in OKLab-L units: dlogY/3 * L ~; report median |dlog Y|
    print(f'{name:12s} k={k}: pairs {len(ds)} mean|dlnY| {st.mean(ds):.3f} median {st.median(ds):.3f} ~dL@L0.4 {0.4*st.mean(ds)/3:.3f}')
print('--- ICC (between-pand share of variance of ln normalised Y; higher = keeps the wall, drops the day)')
for name,f in refs.items():
  for k in [1.0,0.5]:
    if name=='none' and k<1: continue
    vals=[[math.log(Y(c['w1']['hex'])/f(c['ref'])**k) for c in g] for g in groups]
    within=st.mean(st.pvariance(v) for v in vals)*len(vals[0])/(len(vals[0])-1) if False else st.mean(st.variance(v) for v in vals)
    means=[st.mean(v) for v in vals]; between=st.variance(means)
    print(f'{name:12s} k={k}: within {within:.3f} between {between:.3f} ICC {between/(between+within):.2f}')
