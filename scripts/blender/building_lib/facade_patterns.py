"""Small photo-selected facade patterns expanded into the existing IR.

These are quick authoring choices, not observations or measurements. Override
individual explicit openings for unusual fronts; no building IDs live here.
"""
from copy import deepcopy

GROUND_PATTERNS={
    'shop':[('entry',.12,.15,'door'),('display',.58,.67,'window')],
    'left-entry':[('entry',.14,.18,'door'),('display',.62,.57,'window')],
    'right-entry':[('display',.38,.55,'window'),('entry',.85,.18,'door')],
    'center-entry':[('left-window',.19,.25,'window'),('entry',.50,.17,'door'),('right-window',.81,.25,'window')],
    'two-entries':[('left-entry',.10,.13,'door'),('left-window',.35,.25,'window'),
                   ('right-window',.65,.25,'window'),('right-entry',.90,.13,'door')],
    'double-entry-display':[('left-entry',.10,.14,'door'),('second-entry',.30,.14,'door'),('display',.70,.48,'window')],
    'display-double-entry':[('display',.25,.44,'window'),('first-entry',.63,.18,'door'),('second-entry',.85,.18,'door')],
    'four-doors': [('entry-'+str(i+1),(i+.5)/4,.19,'door') for i in range(4)],
    'three-entries':[('left-entry',.08,.12,'door'),('left-window',.29,.22,'window'),('middle-entry',.50,.14,'door'),('right-window',.71,.22,'window'),('right-entry',.92,.12,'door')],
    'garage-right-entry':[('garage',.40,.75,'door'),('entry',.91,.12,'door')],
}


def opening_pattern(spec,front,floors):
    if 'startFraction' in spec or 'endFraction' in spec:
        import math
        from .roof_surfaces import silhouette_height
        start,end=spec.get('startFraction'),spec.get('endFraction')
        if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in (start,end)) or not 0<=start<end<=1:
            raise ValueError('Pattern interval needs ordered start/end fractions within the frontage')
        left,right=front['width']*start,front['width']*end
        local=deepcopy(front);local['width']=right-left
        local['profile']=[(0,silhouette_height(front['profile'],left))]+[(x-left,z) for x,z in front['profile'] if left<x<right]+[(right-left,silhouette_height(front['profile'],right))]
        inner=deepcopy(spec);inner.pop('startFraction');inner.pop('endFraction')
        result=opening_pattern(inner,local,floors)
        if any(o['x']-o['width']/2<0 or o['x']+o['width']/2>local['width'] for o in result):
            raise ValueError('Pattern opening extends outside its frontage interval')
        for opening in result:opening['x']+=left
        return result
    preset=spec['preset']
    if preset=='industrial-grid':return industrial_grid(spec,front,floors)
    if preset=='attic-lights':return attic_lights(spec,front,floors)
    if preset=='warehouse-stack':return warehouse_stack(spec,front,floors)
    if preset not in GROUND_PATTERNS:raise ValueError('Unknown facade opening pattern: '+str(preset))
    floor=floors[spec.get('storey','ground')];span=floor['top']-floor['bottom']
    result=[]
    for label,x,width,kind in GROUND_PATTERNS[preset]:
        height=span*(.86 if kind=='door' else .76);bottom=floor['bottom']+span*(.04 if kind=='door' else .12)
        opening={'id':spec.get('id','ground')+'-'+label,'x':front['width']*x,
            'z':bottom+height/2,'width':front['width']*width,'height':height,
            'head':'rectangular','kind':kind,'storey':spec.get('storey','ground'),
            'transom':.23,'frameColour':'#d0ceba','glassColour':'#3b4b43',
            'provenance':deepcopy(spec.get('provenance',{'status':'inferred','basis':'Photo-selected facade pattern with illustrative proportions'}))}
        if kind=='door':opening['lowerPanel']={'height':.5,'colour':'#30433b'}
        else:opening['mullions']=[.5]
        opening.update(deepcopy(spec.get('template',{})))
        opening.update(deepcopy(spec.get('doorTemplate' if kind=='door' else 'windowTemplate',{})))
        if opening.get('doorLeaf') and kind=='door':opening.pop('lowerPanel',None)
        if preset=='garage-right-entry' and label=='garage':
            opening.pop('doorLeaf',None)
            opening.pop('lowerPanel',None)
            opening.update(mullions=[],transom=None,frameColour='#aaa99c',warehouse={'shutters':{'angle':0,'style':'panel','colour':'#343b3a','material':'ivorytimber'}})
        result.append(opening)
    return result


def industrial_grid(spec,front,floors):
    """Broad rectangular steel grids, with independent storey schedules."""
    columns=spec.get('columns',1);rows=spec.get('rows',4)
    if any(isinstance(n,bool) or not isinstance(n,int) or not 1<=n<=12 for n in (columns,rows)):
        raise ValueError('Industrial grid needs one to twelve pane columns/rows')
    result=[]
    for storey in spec['storeys']:
        floor=floors[storey];span=floor['top']-floor['bottom']
        item={'id':spec.get('id','industrial')+'-'+storey,'storey':storey,'kind':'window','head':'rectangular',
            'x':front['width']/2,'z':floor['bottom']+span*.49,'width':front['width']*.80,'height':span*.79,
            'mullions':[i/columns for i in range(1,columns)],'horizontalMullions':[i/rows for i in range(1,rows)],
            'transom':None,'frameColour':'#c3c4b9','sashColour':'#292e2d','glassColour':'#4a5755',
            'provenance':deepcopy(spec.get('provenance',{'status':'inferred','basis':'Stock broad industrial grid'}))}
        item.update(deepcopy(spec.get('template',{})));result.append(item)
    return result


def catalog():
    return {name:{'recipePath':'frontages[].openingPatterns[]','preset':name,
        'description':'Normalized ground openings; layout and materials remain editable.',
        'features':[{'role':role,'centreFraction':x,'widthFraction':w,'kind':kind} for role,x,w,kind in pattern]}
        for name,pattern in GROUND_PATTERNS.items()}


def attic_lights(spec,front,floors):
    """Stock lights within a raised facade; native owner peak is not a gable top."""
    import math
    floor=floors[spec.get('storey','attic')];bottom=floor['bottom']
    top=min(floor['top'],max(p[1] for p in front['profile']));rise=top-bottom
    if not math.isfinite(rise) or rise<.7:raise ValueError('Attic lights need a raised facade profile')
    layout=spec.get('layout','single');segments=spec.get('segments',1)
    if isinstance(segments,bool) or segments not in (1,2):raise ValueError('Attic layout supports one or two gables')
    dimensions={'single':[(.55,.24 if segments==2 else .15,.28,.95)],
                'wide':[(.40,.28,.35,1.25)],
                'stacked':[(.30,.22,.22,1.1),(.70,.13,.20,.85)]}
    if layout not in dimensions:raise ValueError('Unknown attic light layout')
    result=[]
    for segment in range(segments):
        for index,(centre,width,height,cap) in enumerate(dimensions[layout]):
            opening=deepcopy(spec.get('template',{}))
            opening.update(id=spec.get('id','attic')+'-'+str(segment+1)+'-'+str(index+1),storey=spec.get('storey','attic'),
                x=front['width']*(segment+.5)/segments,z=bottom+rise*centre,width=front['width']*width/segments,
                height=min(cap,rise*height),kind='window',head='rectangular')
            opening.setdefault('mullions',[.5]);opening.setdefault('transom',.25)
            opening.setdefault('provenance',deepcopy(spec.get('provenance',{'status':'inferred','basis':'Library attic-light proportions'})))
            result.append(opening)
    return result


def warehouse_stack(spec,front,floors):
    """Loading openings with small flank lights; independent adjacent warehouses."""
    import math
    from .roof_surfaces import silhouette_height
    segments=spec.get('segments',1)
    for key in ('loadingTemplate','flankTemplate','crestTemplate'):
        if key in spec and not isinstance(spec[key],dict):raise ValueError('Warehouse '+key+' must be an opening template')
    if isinstance(segments,bool) or not isinstance(segments,int) or not 1<=segments<=4:raise ValueError('Warehouse stack needs one to four segments')
    templates=spec.get('segmentTemplates',[{} for _ in range(segments)])
    if not isinstance(templates,list) or len(templates)!=segments or any(not isinstance(t,dict) for t in templates):raise ValueError('Warehouse segment templates must match segment count')
    result=[];unit=front['width']/segments
    for storey in spec['storeys']:
        floor=floors[storey];span=floor['top']-floor['bottom'];attic=storey=='attic'
        for segment in range(segments):
            if attic:span=min(floor['top'],silhouette_height(front['profile'],unit*(segment+.5)))-floor['bottom']
            template=deepcopy(spec.get('template',{}));template.update(deepcopy(templates[segment]))
            shutters=template.pop('shutters',None)
            centre=floor['bottom']+span*(.29 if attic else .49)
            for role,x,width,height in [('loading',.5,.33,min(1.9,span*.4) if attic else span*.80),('left-light',.26 if attic else .18,.10 if attic else .14,min(.8,span*.20) if attic else span*.40),('right-light',.74 if attic else .82,.10 if attic else .14,min(.8,span*.20) if attic else span*.40)]:
                item={'id':spec.get('id','warehouse')+'-'+str(segment+1)+'-'+storey+'-'+role,'storey':storey,'x':unit*(segment+x),'z':centre,'width':unit*width,'height':height,'head':'rounded','kind':'door' if role=='loading' else 'window','mullions':[.5] if role=='loading' else [],'transom':.35 if role=='loading' else None,'frameColour':'#443e36','glassColour':'#354044','provenance':deepcopy(spec.get('provenance',{'status':'inferred','basis':'Stock warehouse loading/flank rhythm'}))}
                item.update(template)
                item.update(deepcopy(spec.get('loadingTemplate' if role=='loading' else 'flankTemplate',{})))
                if role=='loading':item['warehouse']={'shutters':deepcopy(shutters)} if shutters and storey!='ground' else {}
                result.append(item)
            if attic and spec.get('crestLights',True):
                crest={'id':spec.get('id','warehouse')+'-'+str(segment+1)+'-crest','storey':storey,'x':unit*(segment+.5),'z':floor['bottom']+span*.76,'width':unit*.12,'height':min(.8,span*.17),'head':'rectangular','kind':'window','mullions':[],'transom':None,'frameColour':'#c4b9a1','glassColour':'#354044','provenance':deepcopy(spec.get('provenance',{}))}
                crest.update(deepcopy(spec.get('crestTemplate',{})));result.append(crest)
    return result
