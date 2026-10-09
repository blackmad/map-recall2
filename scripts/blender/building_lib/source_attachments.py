"""Explicit semantic roof support for railings; no analytic covering substitution."""
import math,json
from .attachment_contracts import finite
from .source_massing import compile_source_massing
from .roof_surfaces import RoofSurface


def selected_roof(recipe,indices,derived_patch=None):
    if not isinstance(indices,list) or not indices or any(not isinstance(i,int) or isinstance(i,bool) for i in indices) or len(set(indices))!=len(indices):
        raise ValueError('Semantic roof support requires unique sourceSurfaceIndices')
    compiled=compile_source_massing(recipe,exclude_attachment_voids=True)
    if derived_patch is None:
        if any(i<0 or i>=len(recipe['sourceShell']['surfaces']) for i in indices):raise ValueError('Source roof support cannot target derived replacement indices')
    else:
        patch=next((p for p in compiled.audit['sourcePatches'] if p['id']==derived_patch),None)
        if patch is None or any(i not in patch['replacementSurfaceIndices'] for i in indices):raise ValueError('Derived roof support requires matching explicit source patch')
    selected=[s for s in compiled.surfaces if s['index'] in indices]
    if len(selected)!=len(indices) or any(s['type']!='roof' for s in selected):raise ValueError('Selected source surfaces must be retained roof surfaces')
    vertices=[];triangles=[]
    for s in selected:
        offset=len(vertices);vertices.extend(s['vertices']);triangles.extend(tuple(offset+i for i in face) for face in s['triangles'])
    return RoofSurface(vertices,triangles,[],0,0)


def attachment_roof(recipe,raw):
    if raw.get('supportMode')=='inferred-appearance-roof':
        if not recipe.get('massing',{}).get('appearanceRoof') or raw.get('sourceSurfaceIndices') is not None or raw.get('provenance',{}).get('status')!='inferred':
            raise ValueError('Appearance dormer requires explicit inferred roof support')
        compiled=compile_source_massing(recipe,exclude_attachment_voids=True)
        vertices=[];triangles=[]
        for s in compiled.surfaces:
            if s['type']!='roof':continue
            offset=len(vertices);vertices.extend(s['vertices']);triangles.extend(tuple(offset+i for i in face) for face in s['triangles'])
        return RoofSurface(vertices,triangles,[],0,0)
    if raw.get('supportMode')=='inferred-appearance-patch':
        if raw.get('sourceSurfaceIndices') is not None or not isinstance(raw.get('sourcePatchId'),str) or not raw['sourcePatchId'].strip() or raw.get('provenance',{}).get('status')!='inferred':
            raise ValueError('Derived attachment requires patch id, derived indices and inferred provenance')
        return selected_roof(recipe,raw.get('derivedSurfaceIndices'),raw['sourcePatchId'])
    if raw.get('supportMode') not in (None,'source-retained') or raw.get('derivedSurfaceIndices') is not None or raw.get('sourcePatchId') is not None:
        raise ValueError('Unsupported or ambiguous source attachment support mode')
    return selected_roof(recipe,raw.get('sourceSurfaceIndices'))


def rail_plan(recipe,raw):
    if not isinstance(raw,dict) or not raw.get('id'):raise ValueError('Source rail requires id')
    surface=attachment_roof(recipe,raw)
    points=raw.get('points');height=raw.get('height',.65);spacing=raw.get('postSpacing',1.0);thickness=raw.get('thickness',.035);levels=raw.get('railLevels',[.25,1])
    if not isinstance(points,list) or len(points)<2 or any(not isinstance(p,list) or len(p)!=2 or not all(finite(v) for v in p) for p in points):raise ValueError('Source rail requires finite XY polyline')
    if not all(finite(v) for v in (height,spacing,thickness)) or not .25<=height<=1.5 or not .2<=spacing<=2 or not .015<=thickness<=.10:raise ValueError('Source rail dimensions outside supported range')
    if not isinstance(levels,list) or not levels or any(not finite(v) or not 0<v<=1 for v in levels) or any(a>=b for a,b in zip(levels,levels[1:])):raise ValueError('Source rail levels must be ordered positive fractions')
    if not isinstance(raw.get('provenance'),dict) or not raw['provenance'].get('basis'):raise ValueError('Source rail requires explicit support provenance')
    segments=[];posts=[]
    for a,b in zip(points,points[1:]):
        dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy)
        if length<.05:raise ValueError('Source rail segment too short')
        # Split at every projected triangle edge, proving support across gaps.
        knots={0.,1.}
        for face in surface.triangles:
            polygon=[surface.vertices[i] for i in face]
            for c,d in zip(polygon,polygon[1:]+polygon[:1]):
                ex,ey=d[0]-c[0],d[1]-c[1];den=dx*ey-dy*ex
                if abs(den)<1e-10:continue
                cx,cy=c[0]-a[0],c[1]-a[1];t=(cx*ey-cy*ex)/den;u=(cx*dy-cy*dx)/den
                if 0<t<1 and -1e-7<=u<=1+1e-7:knots.add(t)
        ordered=sorted(knots)
        for l,r in zip(ordered,ordered[1:]):surface.height(a[0]+dx*(l+r)/2,a[1]+dy*(l+r)/2)
        for l,r in zip(ordered,ordered[1:]):
            p=(a[0]+dx*l,a[1]+dy*l);q=(a[0]+dx*r,a[1]+dy*r)
            segments.append(((*p,surface.height(*p)),(*q,surface.height(*q))))
        count=math.ceil(length/spacing)
        for i in range(count+1):
            p=(a[0]+dx*i/count,a[1]+dy*i/count);post=(*p,surface.height(*p))
            if not any(math.dist(post,q)<1e-7 for q in posts):posts.append(post)
    return {'id':raw['id'],'segments':segments,'posts':posts,'height':height,'thickness':thickness,'levels':levels,'provenance':raw['provenance']}


def validate_source_attachments(recipe):
    errors=[];items=recipe.get('details',{}).get('sourceRails',[])
    if not isinstance(items,list):return ['Source rails must be a list']
    for item in items:
        try:rail_plan(recipe,item)
        except (ValueError,KeyError,TypeError,IndexError) as e:errors.append('Source rail: '+str(e))
    dormers=recipe.get('details',{}).get('sourceDormers',[])+recipe.get('details',{}).get('appearanceDormers',[])
    if not isinstance(dormers,list):errors.append('Source dormers must be a list')
    else:
        for item in dormers:
            try:dormer_plan(recipe,item)
            except (ValueError,KeyError,TypeError,IndexError) as e:errors.append('Source dormer: '+str(e))
    return errors


def build_source_attachments(recipe,material):
    from .geometry import beam
    for raw in recipe.get('details',{}).get('sourceRails',[]):
        plan=rail_plan(recipe,raw);h=plan['height'];t=plan['thickness'];objects=[]
        for p in plan['posts']:objects.append(beam(plan['id']+' / supported post',(p[0],p[1],p[2]-.02),(p[0],p[1],p[2]+h),t,t,material))
        for a,b in plan['segments']:
            for level in plan['levels']:objects.append(beam(plan['id']+' / horizontal rail',(a[0],a[1],a[2]+h*level),(b[0],b[1],b[2]+h*level),t,t,material))
        for obj in objects:obj['componentId']=plan['id'];obj['componentKind']='source-roof-rail';obj['componentProvenance']=json.dumps(plan['provenance'])


def dormer_plan(recipe,raw):
    if not isinstance(raw,dict) or not raw.get('id'):raise ValueError('Source dormer requires id')
    surface=attachment_roof(recipe,raw)
    x,y,width,height,depth=[raw.get(k) for k in ('x','y','width','height','depth')]
    if not all(finite(v) for v in (x,y,width,height,depth)) or min(width,height,depth)<=.2 or width>4 or height>(6 if raw.get('assembly')=='roof-box' else 3) or depth>2:raise ValueError('Source dormer dimensions invalid')
    roof_box=raw.get('assembly')=='roof-box'
    if raw.get('assembly') not in (None,'dormer','roof-box'):raise ValueError('Unsupported roof attachment assembly')
    if roof_box and raw.get('supportMode')!='inferred-appearance-roof':raise ValueError('Roof boxes require explicit inferred appearance support')
    rise=raw.get('capRise',0)
    style=raw.get('capStyle','flat');pitch=raw.get('capHeight',0)
    if style not in ('flat','pitched'):raise ValueError('Dormer cap style must be flat or pitched')
    if style=='pitched' and (rise or roof_box or not finite(pitch) or not .1<=pitch<=min(1.2,width/2)):
        raise ValueError('Pitched dormer cap requires bounded capHeight and rectangular dormer body')
    if style=='flat' and pitch:raise ValueError('capHeight requires a pitched dormer cap')
    if not finite(rise) or not 0<=rise<=min(width/2,height*.5):raise ValueError('Source dormer cap rise must be bounded by span and height')
    from .roof_surfaces import clip_half_plane
    from .polygons import area
    left,right=x-width/2,x+width/2;covered=0
    for face in surface.triangles:
        polygon=[surface.vertices[i][:2] for i in face]
        for dist in (lambda p:p[0]-left,lambda p:right-p[0],lambda p:p[1]-y,lambda p:y+depth-p[1]):
            polygon=clip_half_plane(polygon,dist)
            if len(polygon)<3:break
        if len(polygon)>=3:covered+=abs(area(polygon))
    if abs(covered-width*depth)>1e-6:raise ValueError('Source dormer footprint must have complete nonoverlapping selected roof support')
    support=[surface.height(xx,yy) for xx in (left,right) for yy in (y,y+depth)]
    bottom=min(support)-.08;head=surface.height(x,y)+height
    if head-rise<max(support)+.12:raise ValueError('Source dormer spring must clear rear covering')
    if not isinstance(raw.get('provenance'),dict) or not raw['provenance'].get('basis'):raise ValueError('Source dormer requires explicit support provenance')
    window_h=head-max(support[0],support[2])-.25
    if window_h<.5:raise ValueError('Source dormer front glazing too short')
    window={'id':raw['id']+' window','x':x,'z':head-.12-window_h/2,'width':width*.78,'height':window_h,'kind':'window','head':'segmental' if rise else 'rectangular','mullions':[.5],'transom':.20}
    if rise:window['archRise']=rise*.78
    windows=[window];front_y=y;body_depth=depth
    if roof_box:
        if rise:raise ValueError('Roof box currently requires a flat cap')
        projection=raw.get('frontProjection',0);base=raw.get('baseZ',bottom)
        if not finite(projection) or not 0<=projection<=.75 or not finite(base) or not min(support)-2<=base<head-.5:
            raise ValueError('Roof box projection/base outside supported appearance range')
        bottom=base;front_y=y-projection;body_depth=depth+projection
        rows=raw.get('frontWindows')
        if not isinstance(rows,list) or not 1<=len(rows)<=6:raise ValueError('Roof box requires one to six explicit front windows')
        windows=[]
        for i,row in enumerate(rows):
            if not isinstance(row,dict):raise ValueError('Roof box front window must be an object')
            xf,zf,wf,hf=[row.get(k) for k in ('xFraction','zFraction','widthFraction','heightFraction')]
            if not all(finite(v) and 0<v<1 for v in (xf,zf,wf,hf)):raise ValueError('Roof box windows require positive fractions below one')
            opening=dict(row.get('template',{}),id=raw['id']+' window '+str(i),kind='window',x=left+width*xf,z=bottom+(head-bottom)*zf,width=width*wf,height=(head-bottom)*hf)
            windows.append(opening)
        from .apertures import validate_layout
        local=[dict(o,x=o['x']-left,z=o['z']-bottom) for o in windows]
        validate_layout(local,width,[(0,0),(width,0),(width,head-bottom),(0,head-bottom)])
    return dict(raw,bottom=bottom,head=head,capRise=rise,capStyle=style,capTop=head+.02+pitch if style=='pitched' else head+.09 if not rise else head+.10,window=windows[0],windows=windows,frontY=front_y,bodyDepth=body_depth)


def pitched_dormer_cap(plan):
    """Closed triangular prism shared by Blender and portable consumers."""
    if plan.get('capStyle')!='pitched':raise ValueError('Pitched cap requires a pitched dormer plan')
    x,w=plan['x'],plan['width']+.12;z=plan['head']+.02
    vertices=[(xx,yy,zz) for yy in (plan['frontY']-.09,plan['frontY']+plan['bodyDepth']+.04)
              for xx,zz in ((x-w/2,z),(x+w/2,z),(x,plan['capTop']))]
    return vertices,[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)]


def build_source_dormers(recipe,wall,roof,frame,glass,material_factory=None):
    import bpy
    from .geometry import box
    from .walls import cut_apertures
    from .openings import recessed_opening
    for raw in recipe.get('details',{}).get('sourceDormers',[])+recipe.get('details',{}).get('appearanceDormers',[]):
        if material_factory:
            wall=material_factory(recipe['materials']['wall'],raw['wallColour']) if raw.get('wallColour') else material_factory(recipe['materials']['wall'],recipe['materials'].get('wallColour'))
            roof=material_factory(recipe['materials']['roof'],raw.get('roofColour'))
            frame=material_factory(recipe['materials'].get('frame','ivorytimber'),raw.get('frameColour'))
            glass=material_factory('glass',raw.get('glassColour',recipe['materials'].get('glassColour')))
        p=dormer_plan(recipe,raw);x,y,w,d=p['x'],p['frontY'],p['width'],p['bodyDepth'];before=set(bpy.context.scene.objects)
        if p['capRise']:
            from .apertures import outline
            from .walls import _closed_profile
            profile=outline(x,(p['bottom']+p['head'])/2,w,p['head']-p['bottom'],'segmental',p['capRise'])
            body=_closed_profile(p['id']+' / arched cheeks',profile,y,y+d,wall)
            # The entire curved cap is a closed shallow extrusion. Its inner
            # arc shares the body's outline, so no gaps appear at the cheeks.
            arc=profile[2:]
            cap=[(xx,zz+.10) for xx,zz in arc]+list(reversed(arc))
            _closed_profile(p['id']+' / curved cap',cap,y-.06,y+d+.06,roof)
            fascia=arc+[(xx,zz-.12) for xx,zz in reversed(arc)]
            _closed_profile(p['id']+' / curved front fascia',fascia,y-.055,y+.035,frame)
        else:
            body=box(p['id']+' / closed cheeks',x,y+d/2,(p['bottom']+p['head'])/2,w,d,p['head']-p['bottom'],wall)
            if p['capStyle']=='pitched':
                from .geometry import mesh
                vertices,faces=pitched_dormer_cap(p);mesh(p['id']+' / pitched cap',vertices,faces,roof)
            else:box(p['id']+' / flat cap',x,y+d/2-.025,p['head']+.04,w+.12,d+.13,.10,roof)
            box(p['id']+' / pale front fascia',x,y-.045,p['head']-.03,w+.10,.12,.14,frame)
        cut_apertures(body,p['windows'],front=y-.05,back=y+.29)
        for opening in p['windows']:
            prior=set(bpy.context.scene.objects);recessed_opening(opening,frame,glass)
            for obj in set(bpy.context.scene.objects)-prior:obj.location.y+=y+.035
        for obj in set(bpy.context.scene.objects)-before:obj['componentId']=p['id'];obj['componentKind']='appearance-roof-box' if p.get('assembly')=='roof-box' else 'appearance-roof-dormer' if p.get('supportMode')=='inferred-appearance-roof' else 'source-roof-dormer';obj['componentProvenance']=json.dumps(p['provenance'])
