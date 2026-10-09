"""Shared solid or open stairs in a physical frontage frame."""
import math

def stair_plan(spec,front,recipe=None):
    p=dict(spec)
    for key in ('x','width','rise','run'):
        value=p.get(key)
        if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):raise ValueError('Stairs require finite '+key)
    if not p.get('id') or p['width']<=0 or p['rise']<0 or p['run']<=0:raise ValueError('Invalid entrance stair dimensions')
    p.setdefault('direction','outward');p.setdefault('construction','solid');p.setdefault('landing',0);p.setdefault('railHeight',0);p.setdefault('maxStep',.18)
    if p['direction'] not in ('outward','from-left','from-right') or p['construction'] not in ('solid','open'):raise ValueError('Unknown stair direction or construction')
    for key in ('landing','railHeight','maxStep'):
        v=p[key]
        if isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or v<0:raise ValueError('Invalid stair '+key)
    if not .12<=p['maxStep']<=.22 or p['landing']>1 or p['railHeight']>1.3 or p['rise']>3.5:raise ValueError('Stair rise, landing or railing outside supported bounds')
    from .materials import linear
    linear(p.get('colour','#77776c'));linear(p.get('railColour','#323a32'))
    door=next((o for o in front.get('openings',[]) if o['id']==p.get('openingId')),None)
    if p.get('openingId') and (door is None or door.get('kind')!='door' or abs(door['z']-door['height']/2-p['rise'])>1e-6):raise ValueError('Entrance stairs must meet their owned door threshold')
    if p['rise']==0:return {**p,'count':0}
    if p['construction']=='open' and p['rise']<.18:raise ValueError('Open stairs require clearance for stringers and landing support')
    p['count']=math.ceil(p['rise']/p['maxStep'])
    if p['run']/p['count']<.12:raise ValueError('Stair run leaves insufficient tread depth')
    if p['direction']=='outward':
        if not 0<=p['x']-p['width']/2<p['x']+p['width']/2<=front['width']:raise ValueError('Stair width outside frontage')
        p['top']=(p['x'],-.065-p['landing']);p['axis']=(0,1);p['landingCentre']=(p['x'],-.065-p['landing']/2)
    else:
        sign=1 if p['direction']=='from-left' else -1
        p['top']=(p['x']-sign*p['landing']/2,-.065-p['width']/2);p['axis']=(sign,0);p['landingCentre']=(p['x'],-.065-p['width']/2)
        lo=min(p['top'][0],p['top'][0]-sign*p['run'],p['x']-p['landing']/2);hi=max(p['top'][0],p['top'][0]-sign*p['run'],p['x']+p['landing']/2)
        if lo<0 or hi>front['width']:
            proof=p.get('provenance',{})
            if recipe is None or p.get('scope')!='same-owner-cross-frontage' or proof.get('status')!='inferred' or not proof.get('basis'):raise ValueError('Cross-frontage stair requires explicit inferred owner scope')
            c,s=math.cos(front['rotation']),math.sin(front['rotation']);ox,oy=front['origin']
            xs=[ox+x*c-y*s for x in (lo,hi) for y in (-.065-p['width'],-.065)]
            bounds=[x for x,y in recipe['footprint']]
            if min(xs)<min(bounds)-.05 or max(xs)>max(bounds)+.05:raise ValueError('Stair extends beyond projected owner width')
    p['start']=tuple(p['top'][i]-p['axis'][i]*p['run'] for i in range(2))
    return p

def stair_meshes(spec,front,recipe=None):
    p=stair_plan(spec,front,recipe);objects=[]
    if not p['count']:return objects
    faces=[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)]
    colour=p.get('colour','#77776c');rail=p.get('railColour','#323a32')
    def box(label,x,y,z,w,d,h,material=colour):
        objects.append({'name':p['id']+' / '+label,'vertices':[(x+a*w/2,y+b*d/2,z+c*h/2) for c in (-1,1) for b in (-1,1) for a in (-1,1)],'faces':faces,'material':material,'componentKind':'entrance-stairs'})
    def beam(label,a,b,w,d,material):
        z=[b[i]-a[i] for i in range(3)];length=math.sqrt(sum(v*v for v in z));z=[v/length for v in z]
        reference=(0,0,1) if abs(z[2])<.99 else (0,1,0)
        x=[reference[1]*z[2]-reference[2]*z[1],reference[2]*z[0]-reference[0]*z[2],reference[0]*z[1]-reference[1]*z[0]];norm=math.sqrt(sum(v*v for v in x));x=[v/norm for v in x];y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]]
        vertices=[tuple((a[i]+b[i])/2+u*x[i]*w/2+v*y[i]*d/2+t*z[i]*length/2 for i in range(3)) for t in (-1,1) for v in (-1,1) for u in (-1,1)]
        objects.append({'name':p['id']+' / '+label,'vertices':vertices,'faces':faces,'material':material,'componentKind':'entrance-stairs'})
    n=p['count'];run=p['run']/n;rise=p['rise']/n;ax,ay=p['axis'];px,py=-ay,ax
    for i in range(1,n+1):
        height=rise*i
        if p['construction']=='solid':
            length=p['run']-run*(i-1);x=p['start'][0]+ax*(run*(i-1)+length/2);y=p['start'][1]+ay*(run*(i-1)+length/2)
            box('solid step '+str(i),x,y,height/2,length if ax else p['width'],p['width'] if ax else length,height)
        else:
            x=p['start'][0]+ax*run*(i-.5);y=p['start'][1]+ay*run*(i-.5)
            thickness=min(.08,rise*.6);box('open tread '+str(i),x,y,height-thickness/2,run+.025 if ax else p['width'],p['width'] if ax else run+.025,thickness)
    if p['construction']=='open':
        for sign in (-1,1):
            offset=sign*(p['width']/2-.09)
            beam('stringer '+str(sign),(p['start'][0]+px*offset,p['start'][1]+py*offset,.035),(p['top'][0]+px*offset,p['top'][1]+py*offset,p['rise']-.06),.1,.14,colour)
    if p['landing']:
        x,y=p['landingCentre'];box('landing',x,y,p['rise']-.06,p['landing'] if ax else p['width'],p['width'] if ax else p['landing'],.12)
        if p['construction']=='open':
            # Posts support the far edge without sealing the basement below.
            for sign in (-1,1):
                end=[p['top'][i]+p['axis'][i]*p['landing'] for i in range(2)]
                box('landing post '+str(sign),end[0]+px*sign*(p['width']/2-.06),end[1]+py*sign*(p['width']/2-.06),(p['rise']-.12)/2,.1,.1,p['rise']-.12)
    if p['railHeight']:
        # One outside rail leaves the building side open at the entrance.
        side=-1 if ax else 1;offset=side*(p['width']/2-.03)
        a=(p['start'][0]+px*offset,p['start'][1]+py*offset,p['railHeight'])
        b=(p['top'][0]+px*offset,p['top'][1]+py*offset,p['rise']+p['railHeight'])
        beam('sloping rail',a,b,.04,.04,rail)
        for fraction in (0,.5,1):
            x=a[0]+fraction*(b[0]-a[0]);y=a[1]+fraction*(b[1]-a[1]);base=fraction*p['rise']
            beam('rail post '+str(fraction),(x,y,base),(x,y,base+p['railHeight']),.04,.04,rail)
    return objects
