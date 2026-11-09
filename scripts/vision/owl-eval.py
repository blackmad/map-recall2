"""Score owl-probe.py output against gold-labels.json (window clustering; PARKED spike).
Usage: python3 owl-eval.py EVAL_DIR OWL_JSON"""
import os
import json,sys,collections
import numpy as np
g=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'gold-labels.json')));o=json.load(open(sys.argv[2]));r=json.load(open(sys.argv[1]+'/truth.json'))
ppm=40
def nms(b,s,thr=0.5):
    idx=np.argsort(-np.array(s));keep=[]
    for i in idx:
        ok=True
        for j in keep:
            a,c=b[i],b[j]
            iw=min(a[2],c[2])-max(a[0],c[0]);ih=min(a[3],c[3])-max(a[1],c[1])
            if iw>0 and ih>0:
                inter=iw*ih;u=(a[2]-a[0])*(a[3]-a[1])+(c[2]-c[0])*(c[3]-c[1])-inter
                if inter/u>thr: ok=False;break
        if ok: keep.append(i)
    return keep
def cluster(v,gap):
    v=sorted(v);cl=[]
    for x in v:
        if cl and x-cl[-1][-1]<=gap: cl[-1].append(x)
        else: cl.append([x])
    return cl
def meas(d,thr,rowgap,colgap,minrow):
    W,H=d['W'],d['H']
    bx=[b for b,s,l in zip(d['boxes'],d['scores'],d['labels']) if s>=thr and l==0]
    sc=[s for s,l in zip(d['scores'],d['labels']) if s>=thr and l==0]
    k=nms(bx,sc);bx=[bx[i] for i in k]
    win=[]
    for x0,y0,x1,y1 in bx:
        w=(x1-x0)/ppm;h=(y1-y0)/ppm
        if 0.4<=w<=2.8 and 0.6<=h<=3.4 and y1<=H*1.02: win.append(((x0+x1)/2,(y0+y1)/2,w,h))
    rows=[c for c in cluster([w[1]/ppm for w in win],rowgap) if len(c)>=minrow]
    cols=[c for c in cluster([w[0]/ppm for w in win],colgap) if len(c)>=2]
    return len(cols),len(rows)
ks=sorted(g,key=int)
best=[]
for thr in (0.1,0.15,0.2,0.3):
  for rg in (1.2,1.6,2.0):
    for cg in (0.6,0.9,1.2):
      for mr in (1,2):
        res=[meas(o[k],thr,rg,cg,mr) for k in ks]
        b=np.mean([res[i][0]==g[k][0] for i,k in enumerate(ks)]);s=np.mean([res[i][1]==g[k][1] for i,k in enumerate(ks)])
        s1=np.mean([res[i][1]+1==g[k][1] for i,k in enumerate(ks)])
        best.append((round(b,2),round(s,2),round(s1,2),thr,rg,cg,mr))
best.sort(key=lambda x:-(x[0]+max(x[1],x[2])))
for x in best[:8]: print(x)
print('sec',np.mean([d['sec'] for d in o.values()]))
print('--- all labels, rows cluster of >=2 boxes; ground row from bottom 4.5 m')
def meas2(d,thr,rg,mr,gm):
    W,H=d['W'],d['H']
    bx=[b for b,s in zip(d['boxes'],d['scores']) if s>=thr]
    sc=[s for s in d['scores'] if s>=thr]
    k=nms(bx,sc);bx=[bx[i] for i in k]
    c=[((b[1]+b[3])/2/ppm,(b[2]-b[0])/ppm,(b[3]-b[1])/ppm) for b in bx if 0.4<=(b[2]-b[0])/ppm<=3.0 and 0.6<=(b[3]-b[1])/ppm<=4.5]
    rows=[x for x in cluster([y for y,_,_ in c],rg) if len(x)>=mr]
    return len(rows)
for thr in (0.1,0.15,0.2):
  for rg in (1.0,1.4,1.8):
    for mr in (2,3):
      res=[meas2(o[k],thr,rg,mr,4.5) for k in ks]
      print(thr,rg,mr,round(np.mean([res[i]==g[k][1] for i,k in enumerate(ks)]),2),collections.Counter((g[k][1],res[i]) for i,k in enumerate(ks)).most_common(4))
print('--- split-half')
dev=ks[::2];test=ks[1::2]
def acc(kk,thr,rg,mr):
    return np.mean([meas2(o[k],thr,rg,mr,4.5)==g[k][1] for k in kk])
def accb(kk,thr,rg,cg,mr):
    return np.mean([meas(o[k],thr,rg,cg,mr)[0]==g[k][0] for k in kk])
grid=[(t,rg,mr) for t in (0.08,0.1,0.12,0.15) for rg in (0.8,1.0,1.2,1.6) for mr in (2,3)]
bd=max(grid,key=lambda p:acc(dev,*p));print('storeys dev best',bd,round(acc(dev,*bd),2),'test',round(acc(test,*bd),2))
bd=max(grid,key=lambda p:acc(test,*p));print('storeys test best',bd,round(acc(test,*bd),2),'dev',round(acc(dev,*bd),2))
print('majority dev/test',np.mean([g[k][1]==4 for k in dev]),np.mean([g[k][1]==4 for k in test]))
gb=[(t,rg,cg,1) for t in (0.08,0.1,0.15) for rg in (1.2,) for cg in (0.5,0.6,0.9)]
bd=max(gb,key=lambda p:accb(dev,*p));print('bays dev best',bd,round(accb(dev,*bd),2),'test',round(accb(test,*bd),2))
