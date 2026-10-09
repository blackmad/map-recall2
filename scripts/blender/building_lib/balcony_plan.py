"""Shared closed balcony boxes and repeated facade layout, without Blender."""
import math
from copy import deepcopy


def balcony_blocks(spec,front_plane):
    if spec['kind']!='balcony':raise ValueError('Balcony planner requires a resolved balcony')
    x,z,w,d,h=spec['x'],spec['z'],spec['width'],spec['depth'],spec['height'];t=spec['railThickness']
    rear=front_plane;street=rear-d
    blocks=[('closed slab',x,(rear+street)/2,z-spec['slabThickness']/2,w,d,spec['slabThickness'],'slab')]
    def rail(label,bx,by,bz,bw,bd,bh):blocks.append((label,bx,by,bz,bw,bd,bh,'rail'))
    left,right=x-w/2+t/2,x+w/2-t/2;front_y=street+t/2
    count=max(1,math.ceil((right-left)/spec['balusterSpacing']))
    for i in range(count+1):rail('front baluster '+str(i),left+(right-left)*i/count,front_y,z+h/2,t,t,h)
    rail('front handrail',x,front_y,z+h,w,t,t)
    rail('front lower rail',x,front_y,z+.12,w,t,t)
    for side,label in [(left,'left'),(right,'right')]:
        rail(label+' handrail',side,(rear+front_y)/2,z+h,t,rear-front_y,t)
        rail(label+' lower rail',side,(rear+front_y)/2,z+.12,t,rear-front_y,t)
        count=max(1,math.ceil((rear-front_y)/spec['balusterSpacing']))
        for i in range(count):rail(label+' return baluster '+str(i),side,rear+(front_y-rear)*i/count,z+h/2,t,t,h)
    return blocks


def balcony_pattern(pattern,front,floors):
    if pattern.get('preset')!='balcony-stack':raise ValueError('Unknown component pattern')
    storeys=pattern['storeys'];positions=pattern['centresFraction'];width=pattern['widthFraction'];bottom=pattern.get('bottomFraction',.17)
    if not isinstance(storeys,list) or not storeys or len(set(storeys))!=len(storeys):raise ValueError('Balcony stack needs unique storeys')
    if not isinstance(positions,list) or not positions:raise ValueError('Balcony stack needs centre fractions')
    values=[width,bottom,*positions]
    if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in values):raise ValueError('Balcony fractions must be finite')
    if not 0<width<=1 or not 0<=bottom<1 or any(not width/2<=v<=1-width/2 for v in positions):raise ValueError('Balcony fractions must fit the frontage')
    components=[]
    for storey in storeys:
        floor=floors[storey]
        for index,position in enumerate(positions):
            spec=deepcopy(pattern.get('template',{}))
            spec.update(id=pattern['id']+'-'+storey+'-'+str(index+1),kind='balcony',x=position*front['width'],
                        z=floor['bottom']+bottom*(floor['top']-floor['bottom']),width=width*front['width'])
            spec.setdefault('provenance',deepcopy(pattern.get('provenance',{'status':'inferred','basis':'Library repeated balcony layout'})))
            components.append(spec)
    return components
