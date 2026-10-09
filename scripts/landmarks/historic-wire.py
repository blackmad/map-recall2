import sys,re
R='/Users/blackmad/Code/map-recall2/.claude/worktrees/agent-a6f3b0ae5db5d1fe9/'
id,fn=sys.argv[1],sys.argv[2]
p=R+'scripts/landmarks/build-manual-landmarks.ts'
s=open(p).read()
imp="import {%s} from './%s-builder';\n"%(fn,id)
if imp not in s:
    a="import {buildTheaterBellevue} from './theater-bellevue-builder';\n"
    s=s.replace(a,a+imp,1)
    d="    else buildCulturalLandmark(id,w,d,helpers);"
    s=s.replace(d,"    else if(id==='%s')%s(w,d,helpers);\n"%(id,fn)+d,1)
    open(p,'w').write(s)
c=R+'scripts/check-historic-geometry.ts'
t=open(c).read()
if "'%s':"%id not in t:
    t=t.replace("import {buildTheaterBellevue}",imp.replace("./","./landmarks/",1)+"import {buildTheaterBellevue}",1)
    t=t.replace("'theater-bellevue':buildTheaterBellevue","'theater-bellevue':buildTheaterBellevue,'%s':%s"%(id,fn),1)
    open(c,'w').write(t)
