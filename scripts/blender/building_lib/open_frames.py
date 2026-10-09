"""Open atrium structure in a facade frame; voids never receive glazing."""
import math,json
from .attachment_contracts import finite


def frame_plan(raw,front,eaves):
    if not isinstance(raw,dict) or not raw.get('id'):raise ValueError('Open frame requires id')
    values=[raw.get(k) for k in ('x','width','bottom','top','depth')]
    if not all(finite(v) for v in values):raise ValueError('Open frame dimensions must be finite')
    x,w,b,t,d=values;pier=raw.get('pierWidth',.30);head=raw.get('headHeight',.30)
    from .materials import entries,linear
    if raw.get('beamMaterial') and raw['beamMaterial'] not in {s['id'] for s in entries()}:raise ValueError('Unknown open frame beam material')
    if raw.get('beamColour'):linear(raw['beamColour'])
    il,ir=raw.get('backInsetLeft',0),raw.get('backInsetRight',0)
    if not all(finite(v) and 0<=v<=w/3 for v in (il,ir)) or w-il-ir<2*pier+.5:raise ValueError('Open frame rear taper invalid')
    if not all(finite(v) for v in (pier,head)) or not .15<=pier<=.8 or not .15<=head<=.8:raise ValueError('Open frame member dimensions invalid')
    if not 0<=x-w/2<x+w/2<=front['width'] or w<2*pier+.5 or not 0<=b<t<=eaves+.01 or t-b<head+.5 or not .4<=d<=6:raise ValueError('Open frame dimensions outside supported facade')
    beams=raw.get('crossBeams',[])
    if not isinstance(beams,list) or len(beams)>16:raise ValueError('Open frame crossBeams must be a bounded list')
    for beam in beams:
        if not isinstance(beam,dict):raise ValueError('Open frame cross beam requires object')
        thick=beam.get('thickness',.10);setback=beam.get('setback',d*.5)
        if not finite(thick) or not .04<=thick<=.3 or not finite(setback) or not 0<=setback<=d:raise ValueError('Open frame cross beam thickness/setback invalid')
        if not isinstance(beam,dict) or not finite(beam.get('height')) or not b+.15<beam['height']<t-head-.05 or beam.get('axis','across') not in ('across','depth'):raise ValueError('Open frame beam axis/height invalid')
        if beam.get('axis','across')=='depth' and (not finite(beam.get('xFraction')) or not 0<beam['xFraction']<1):raise ValueError('Open frame depth beam xFraction must be inside void')
        if beam.get('axis','across')=='depth' and not il<=(w-2*pier)*beam['xFraction']<=w-2*pier-ir:raise ValueError('Open frame depth beam must remain inside tapered rear void')
    return dict(raw,pierWidth=pier,headHeight=head,backInsetLeft=il,backInsetRight=ir,crossBeams=beams,aperture={'id':raw['id']+' / open void','x':x,'z':(b+t-head)/2,'width':w-2*pier,'height':t-head-b,'kind':'window','head':'rectangular','storey':'attic'})


def frame_apertures(front,eaves):
    cuts=[frame_plan(r,front,eaves)['aperture'] for r in front.get('openFrames',[])]
    for raw in front.get('recessedUpperPanels',[]):
        if not raw.get('cutFacade',False):continue
        p=recessed_panel_plan(raw,front,eaves)
        cuts.append({'id':p['id']+' / recessed void','x':p['x'],'z':(p['bottom']+p['top'])/2,
                     'width':p['width'],'height':p['top']-p['bottom'],'head':'rectangular','kind':'window','storey':'upper'})
    return cuts


def validate_open_frames(recipe):
    errors=[]
    for front in recipe.get('frontages',[]):
        items=front.get('openFrames',[])
        if not isinstance(items,list):errors.append('Open frames must be a list');continue
        for item in items:
            try:frame_plan(item,front,front.get('eaves',recipe['roof']['eaves']))
            except (ValueError,TypeError,KeyError) as e:errors.append('Open frame: '+str(e))
        panels=front.get('recessedUpperPanels',[])
        if not isinstance(panels,list):errors.append('Recessed upper panels must be a list')
        else:
            for panel in panels:
                try:recessed_panel_plan(panel,front,front.get('eaves',recipe['roof']['eaves']))
                except (ValueError,TypeError,KeyError) as e:errors.append('Recessed upper panel: '+str(e))
    return errors


def build_open_frames(recipe,front,material,mat=None):
    from .geometry import box,mesh
    for raw in front.get('openFrames',[]):
        p=frame_plan(raw,front,front.get('eaves',recipe['roof']['eaves']));x,w,b,t,d=p['x'],p['width'],p['bottom'],p['top'],p['depth'];pw,hh=p['pierWidth'],p['headHeight'];objects=[]
        structure=mat(p.get('beamMaterial','iron'),p.get('beamColour')) if mat and p.get('beamMaterial') else material
        # Front members coincide with the cut facade's perimeter, so only the
        # inward extension is added; no redundant front-plane layer.
        def prism(label,plan,lo,hi):
            objects.append(mesh(p['id']+' / '+label,[(xx,yy,z) for z in (lo,hi) for xx,yy in plan],[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],material))
        left,right=x-w/2,x+w/2;il,ir=p['backInsetLeft'],p['backInsetRight']
        for label,plan in [('left',[(left,.24),(left+pw,.24),(left+il+pw,d),(left+il,d)]),('right',[(right-pw,.24),(right,.24),(right-ir,d),(right-ir-pw,d)])]:
            fraction=(d-pw-.24)/(d-.24)
            rear=[(plan[0][0]+(plan[3][0]-plan[0][0])*fraction,d-pw),(plan[1][0]+(plan[2][0]-plan[1][0])*fraction,d-pw),plan[2],plan[3]]
            prism(label+' rear pier',rear,b,t-hh);prism(label+' side head',plan,t-hh,t)
        objects.append(box(p['id']+' / rear head',x+(il-ir)/2,d-pw/2,t-hh/2,w-il-ir,pw,hh,material))
        prism('terrace deck',[(left,0),(right,0),(right-ir,d),(left+il,d)],b-.12,b)
        for i,beam in enumerate(p['crossBeams']):
            thick=beam.get('thickness',.10)
            if beam.get('axis','across')=='depth':
                bx=x-w/2+pw+(w-2*pw)*beam['xFraction'];objects.append(box(p['id']+' / depth beam '+str(i),bx,d/2,beam['height'],thick,d,thick,structure))
                # Recess upright front faces behind the crossed horizontal
                # members; intersecting coplanar faces otherwise flicker.
                for label,yy in [('front',.04+thick/2),('rear',d-pw/2)]:objects.append(box(p['id']+' / '+label+' interior upright '+str(i),bx,yy,(b+t-hh)/2,thick,thick,t-hh-b,structure))
            else:
                setback=beam.get('setback',d*.5);fraction=setback/d
                objects.append(box(p['id']+' / cross beam '+str(i),x+(il-ir)*fraction/2,setback,beam['height'],w-2*pw-(il+ir)*fraction,thick,thick,structure))
        for obj in objects:obj['componentId']=p['id'];obj['componentKind']='open-atrium-frame';obj['componentProvenance']=json.dumps(p.get('provenance',{'status':'synthetic' if recipe.get('synthetic') else 'unknown'}))


def roof_region(raw,front,eaves):
    p=frame_plan(raw,front,eaves)
    x,w,d,pw=p['x'],p['width'],p['depth'],p['pierWidth']
    fraction=(d-pw-.24)/(d-.24)
    return [(x-w/2+pw,.24),(x+w/2-pw,.24),(x+w/2-pw-p['backInsetRight']*fraction,d-pw),(x-w/2+pw+p['backInsetLeft']*fraction,d-pw)]


def cut_analytic_roof_voids(recipe):
    import bpy
    from .geometry import mesh
    for front in recipe['frontages']:
        for raw in front.get('openFrames',[]):
            p=frame_plan(raw,front,front.get('eaves',recipe['roof']['eaves']));region=roof_region(raw,front,recipe['roof']['eaves'])
            material=next(o for o in bpy.context.scene.objects if o.name.startswith('Roof / continuous triangulated covering')).data.materials[0]
            cutter=mesh('Temporary open frame roof cutter',[(x,y,z) for z in (p['top']-1,p['top']+1) for x,y in region],[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],material)
            ox,oy=front['origin'];angle=front.get('rotation',0)
            for v in cutter.data.vertices:
                xx,yy=v.co.x,v.co.y;v.co.x=ox+xx*math.cos(angle)-yy*math.sin(angle);v.co.y=oy+xx*math.sin(angle)+yy*math.cos(angle)
            for roof in [o for o in bpy.context.scene.objects if o.name.startswith('Roof / continuous triangulated covering')]:
                modifier=roof.modifiers.new('Explicit open atrium roof ownership','BOOLEAN');modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter;bpy.context.view_layer.objects.active=roof;bpy.ops.object.modifier_apply(modifier=modifier.name)
            bpy.data.objects.remove(cutter,do_unlink=True)


def recessed_panel_plan(raw,front,eaves):
    if not isinstance(raw,dict) or not raw.get('id'):raise ValueError('Recessed upper panel requires id')
    if not isinstance(raw.get('cutFacade',False),bool):raise ValueError('Recessed panel cutFacade requires a boolean')
    x,w,b,t,d=[raw.get(k) for k in ('x','width','bottom','top','setback')]
    from .materials import linear
    if raw.get('colour'):linear(raw['colour'])
    if not all(finite(v) for v in (x,w,b,t,d)) or not 0<=x-w/2<x+w/2<=front['width'] or not 0<b<t<=eaves or not .35<=d<=3:raise ValueError('Recessed upper panel dimensions unsupported')
    openings=raw.get('openings',[])
    from .apertures import validate_layout
    validate_layout(openings,front['width'],[(x-w/2,b),(x+w/2,b),(x+w/2,t),(x-w/2,t)])
    return raw


def build_recessed_upper_panels(front,eaves,mat):
    import bpy
    from .geometry import box
    from .walls import cut_apertures
    from .openings import recessed_opening
    for raw in front.get('recessedUpperPanels',[]):
        p=recessed_panel_plan(raw,front,eaves);before=set(bpy.context.scene.objects);d=p['setback']
        body=box(p['id']+' / closed recessed wall',p['x'],d+.12,(p['bottom']+p['top'])/2,p['width'],.24,p['top']-p['bottom'],mat('whiterender',p.get('colour','#55574f')))
        cut_apertures(body,p.get('openings',[]),front=d-.03,back=d+.27)
        # The facade void exposes a real inset wall. Closed perimeter returns
        # connect it to the retained facade slab without touching native roofs.
        if p.get('cutFacade',False):
            finish=mat('whiterender',p.get('colour','#55574f'));depth=d-.24
            for sign,label in [(-1,'left'),(1,'right')]:
                box(p['id']+' / '+label+' closed return',p['x']+sign*(p['width']/2+.06),(.24+d)/2,
                    (p['bottom']+p['top'])/2,.12,depth,p['top']-p['bottom'],finish)
            for z,label in [(p['bottom']-.06,'floor'),(p['top']+.06,'ceiling')]:
                box(p['id']+' / '+label+' closed return',p['x'],(.24+d)/2,z,p['width'],depth,.12,finish)
        for spec in p.get('openings',[]):
            prior=set(bpy.context.scene.objects);recessed_opening(spec,mat('ivorytimber',spec.get('frameColour','#979b92')),mat('glass',spec.get('glassColour','#647571')))
            for obj in set(bpy.context.scene.objects)-prior:obj.location.y+=d+.035
        for obj in set(bpy.context.scene.objects)-before:obj['componentId']=p['id'];obj['componentKind']='recessed-upper-panel';obj['componentProvenance']=json.dumps(p.get('provenance',{'status':'unknown'}))


def audit_source_roof_openings(recipe,original):
    from .polygons import area
    from .roof_surfaces import clip_half_plane
    from .source_massing import _local
    for front in recipe['frontages']:
        for raw in front.get('openFrames',[]):
            opening=raw.get('sourceRoofOpening')
            if not isinstance(opening,dict) or opening.get('geometryRevision')!=recipe['geometryRevision'] or not opening.get('provenance',{}).get('basis'):raise ValueError('Source open frame roof ownership requires revision and provenance')
            indices=opening.get('surfaceIndices')
            if not isinstance(indices,list) or not indices or len(set(indices))!=len(indices) or any(not isinstance(i,int) or isinstance(i,bool) or not any(s['index']==i and s['type']=='roof' for s in original) for i in indices):raise ValueError('Source open frame roof ownership requires unique roof indices')
            region=roof_region(raw,front,front.get('eaves',recipe['roof']['eaves']));expected=abs(area(region));covered=0
            for s in original:
                if s['index'] not in indices:continue
                for face in s['triangles']:
                    polygon=[_local(s['vertices'][i],front)[:2] for i in face]
                    for a,b in zip(region,region[1:]+region[:1]):
                        polygon=clip_half_plane(polygon,lambda p,a=a,b=b:(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))
                        if len(polygon)<3:break
                    if len(polygon)>=3:covered+=abs(area(polygon))
            if abs(covered-expected)>max(1e-6,expected*1e-7):raise ValueError('Source open frame roof region requires complete nonoverlapping selected roof support')


def retain_source_frame_side(recipe,points,front,index):
    from .source_massing import _clip,_local
    pieces=[points]
    for raw in front.get('openFrames',[]):
        spec=raw.get('sourceSideOpening')
        if spec is None:continue
        if not isinstance(spec,dict) or spec.get('geometryRevision')!=recipe['geometryRevision'] or not isinstance(spec.get('provenance'),dict) or not spec['provenance'].get('basis'):raise ValueError('Source frame side ownership requires revision and provenance')
        indices=spec.get('surfaceIndices')
        if not isinstance(indices,list) or not indices or len(set(indices))!=len(indices) or any(not isinstance(i,int) or isinstance(i,bool) or not 0<=i<len(recipe['sourceShell']['surfaces']) or recipe['sourceShell']['surfaces'][i]['type']!='wall' for i in indices):raise ValueError('Source frame side ownership requires explicit wall indices')
        if index not in indices:continue
        p=frame_plan(raw,front,front.get('eaves',recipe['roof']['eaves']));left,right=p['x']-p['width']/2,p['x']+p['width']/2
        bounds=[(left,right),(.24,p['depth']),(p['bottom'],p['top']-p['headHeight'])]
        distances=[fn for axis,(lo,hi) in enumerate(bounds) for fn in (lambda point,axis=axis,lo=lo:_local(point,front)[axis]-lo,lambda point,axis=axis,hi=hi:hi-_local(point,front)[axis])]
        outside=[]
        for poly in pieces:
            remaining=poly
            for distance in distances:
                part=_clip(remaining,distance,False)
                if len(part)>=3 and any(distance(q)<-1e-9 for q in remaining):outside.append(part)
                remaining=_clip(remaining,distance,True)
                if len(remaining)<3:break
        pieces=outside
    return pieces


def audit_source_frame_sides(recipe,original):
    from .source_massing import _clip,_local
    def surface_area(poly):
        a=poly[0];total=0
        for b,c in zip(poly[1:],poly[2:]):
            u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)];total+=math.sqrt(sum(q*q for q in (u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])))/2
        return total
    audits=[]
    for front in recipe['frontages']:
        for raw in front.get('openFrames',[]):
            spec=raw.get('sourceSideOpening')
            if spec is None:continue
            # Reuse exact revision/type/provenance validation before counting.
            retain_source_frame_side(recipe,[],front,-1)
            p=frame_plan(raw,front,front.get('eaves',recipe['roof']['eaves']));left,right=p['x']-p['width']/2,p['x']+p['width']/2
            allowed=spec.get('maxLateralDeviationM',.20)
            if not finite(allowed) or not 0<allowed<=.25:raise ValueError('Source frame side lateral tolerance must be bounded at .25m')
            bounds=[(left,right),(.24,p['depth']),(p['bottom'],p['top']-p['headHeight'])];clipped=[];area=0
            for surface in original:
                if surface['index'] not in spec['surfaceIndices']:continue
                amount=0
                for face in surface['triangles']:
                    poly=[surface['vertices'][i] for i in face]
                    for axis,(lo,hi) in enumerate(bounds):
                        poly=_clip(poly,lambda point,axis=axis,lo=lo:_local(point,front)[axis]-lo)
                        poly=_clip(poly,lambda point,axis=axis,hi=hi:hi-_local(point,front)[axis])
                        if len(poly)<3:break
                    if len(poly)<3:continue
                    locals=[_local(q,front) for q in poly]
                    def edge_error(side):
                        return max(abs(q[0]-(left+p['backInsetLeft']*(q[1]-.24)/(p['depth']-.24) if side=='left' else right-p['backInsetRight']*(q[1]-.24)/(p['depth']-.24))) for q in locals)
                    if min(edge_error('left'),edge_error('right'))>allowed:raise ValueError('Source frame side opening must follow a supported outer side plane')
                    amount+=surface_area(poly);clipped.extend(locals)
                if amount<=1e-6:raise ValueError('Source frame side selection has no supported clipped area')
                area+=amount
            if not clipped:raise ValueError('Source frame side opening removes no measured wall')
            audits.append({'frameId':p['id'],'surfaceIndices':spec['surfaceIndices'],'geometryRevision':spec['geometryRevision'],'clippedLocalExtents':[[min(q[k] for q in clipped),max(q[k] for q in clipped)] for k in range(3)],'removedAreaM2':area,'maxLateralDeviationM':allowed,'provenance':spec['provenance']})
    return audits
