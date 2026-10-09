"""Projecting grouped-window volumes in the selected frontage frame.

The structural bay is continuous between storeys; independent front and side
apertures cut its closed masonry shell. Opaque recessed panes retain the common
mobile fallback. Dimensions are authored presets unless provenance says more.
"""
import copy,json,math
from .layout import SURFACES
from .apertures import from_spec


def _number(value,name,low=None,high=None):
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):raise ValueError(name+' must be finite')
    if low is not None and value<low or high is not None and value>high:raise ValueError(name+' is outside supported range')
    return value


def bay_plan(raw,front,eaves):
    if not isinstance(raw,dict) or not isinstance(raw.get('id'),str) or not raw['id']:raise ValueError('Grouped bay requires a string id')
    result={'projection':.55,'returnInset':.12,'sideWindows':True,'sillDepth':.22,'sillProjection':.12,'capHeight':.12,'capProjection':.08,'baseRise':0.0}
    result.update(copy.deepcopy(raw))
    if result.get('construction','solid') not in ('solid','hollow'):raise ValueError('Unknown grouped bay construction')
    if result.get('construction')=='hollow':
        thickness=result.setdefault('shellThickness',.20)
        _number(thickness,'shellThickness',.16,min(.29,result.get('projection',.55)-.035))
        if result.get('baseRise'):raise ValueError('Hollow grouped bay currently requires a level base')
    for key in ('x','width','bottom','top'):_number(result.get(key),key)
    if result['width']<=.3 or result['bottom']<0 or not result['bottom']+.3<result['top']<=eaves+1e-7:raise ValueError('Grouped bay width and vertical bounds are invalid')
    _number(result['projection'],'projection',.20,1.5);_number(result['returnInset'],'returnInset',0,result['width']*.2)
    for key in ('capHeight','capProjection'):_number(result[key],key,0,.3)
    _number(result['baseRise'],'baseRise',0,min(1.5,result['top']-result['bottom']-.3))
    _number(result['sillDepth'],'sillDepth',.10,.40);_number(result['sillProjection'],'sillProjection',.03,result['sillDepth']-.02)
    if not isinstance(result['sideWindows'],bool):raise ValueError('Grouped bay sideWindows must be boolean')
    if result['x']-result['width']/2<0 or result['x']+result['width']/2>front['width']:raise ValueError('Grouped bay lies outside selected frontage')
    identifiers=result.get('openingIds')
    if not isinstance(identifiers,list) or not identifiers or any(not isinstance(i,str) for i in identifiers) or len(set(identifiers))!=len(identifiers):raise ValueError('Grouped bay requires unique openingIds')
    openings=[];left=result['x']-result['width']/2;right=result['x']+result['width']/2
    for identifier in identifiers:
        matches=[o for o in front.get('openings',[]) if o['id']==identifier]
        if len(matches)!=1:raise ValueError('Grouped bay requires one existing openingId: '+identifier)
        item=copy.deepcopy(matches[0])
        if item.get('head','rectangular')!='rectangular' or item.get('kind')!='window':raise ValueError('Grouped bay currently supports rectangular window groups')
        if any(key in item for key in ('warehouse','balcony','lowerPanel','transomArch')):raise ValueError('Grouped bay does not support door/shutter/panel assemblies')
        if item['x']-item['width']/2<left+result['returnInset']+.075 or item['x']+item['width']/2>right-result['returnInset']-.075:raise ValueError('Grouped bay opening needs front jamb margin')
        if item['z']-item['height']/2<result['bottom']+result['baseRise']+.06 or item['z']+item['height']/2>result['top']-.06:raise ValueError('Grouped bay opening lies outside structural vertical bounds')
        openings.append(item)
    # Do not silently give side return lights fractional heights unrelated to
    # their front group. The same row datum owns every visible face.
    rows=sorted(openings,key=lambda o:o['z'])
    for a,b in zip(rows,rows[1:]):
        if a['z']+a['height']/2+.08>b['z']-b['height']/2:raise ValueError('Grouped bay rows overlap or lack a spandrel')
    side_length=math.hypot(result['returnInset'],result['projection']+SURFACES['shell_front'])
    if result['sideWindows'] and side_length<.28:raise ValueError('Glazed bay return needs room for jambs')
    result.update(openings=openings,left=left,right=right,sideLength=side_length,
                  sideReturnAngleDegrees=math.degrees(math.atan2(result['projection']+SURFACES['shell_front'],result['returnInset'])))
    from .materials import entries,linear
    names={entry['id'] for entry in entries()}
    for key in ('material','frameMaterial','glassMaterial'):
        if key in result and result[key] not in names:raise ValueError('Unknown grouped bay '+key)
    for key in ('colour','frameColour','glassColour'):
        if key in result:
            try:linear(result[key])
            except (ValueError,TypeError,AttributeError):raise ValueError('Invalid grouped bay '+key)
    result.setdefault('provenance',{'status':'authored','basis':'component preset; no photographic measurement asserted'})
    return result


def validate_grouped_bays(recipe):
    errors=[]
    for front in recipe.get('frontages',[]):
        raw=front.get('groupedBays',[])
        if not isinstance(raw,list):errors.append('groupedBays must be a list');continue
        seen=set();owners=set();plans=[]
        for item in raw:
            try:
                plan=bay_plan(item,front,recipe['roof']['eaves'])
                if plan['id'] in seen:raise ValueError('Duplicate grouped bay id')
                seen.add(plan['id'])
                if owners.intersection(plan['openingIds']):raise ValueError('Grouped opening has multiple bay owners')
                owners.update(plan['openingIds']);plans.append(plan)
            except (ValueError,KeyError,TypeError) as error:errors.append('Grouped bay: '+str(error))
        for i,a in enumerate(plans):
            for b in plans[i+1:]:
                if min(a['right'],b['right'])-max(a['left'],b['left'])>1e-7 and min(a['top'],b['top'])-max(a['bottom'],b['bottom'])>1e-7:errors.append('Grouped bay volumes overlap')
    return errors


def opening_owners(front):
    return {identifier:bay['id'] for bay in front.get('groupedBays',[]) for identifier in bay.get('openingIds',[])}


def _transform(obj,origin,angle):
    """Bake local joinery into the facade frame before the common parent."""
    from mathutils import Matrix,Vector
    matrix=Matrix.Translation(Vector((origin[0],origin[1],0)))@Matrix.Rotation(angle,4,'Z')@obj.matrix_basis
    obj.data.transform(matrix);obj.matrix_world=Matrix.Identity(4);obj.data.update()


def _resize_sill(obj,plan):
    if obj.name.endswith(' sill'):
        centre=SURFACES['shell_front']+plan['sillDepth']/2-plan['sillProjection']
        for vertex in obj.data.vertices:vertex.co.y=centre+(vertex.co.y+.08)*plan['sillDepth']/.40
        obj.data.update()


def _side_cut(obj,item,origin,angle,material):
    import bpy
    from .walls import _closed_profile
    cutter=_closed_profile('CUTTER / bay return '+item['id'],from_spec(item),-.03,.26,material)
    _transform(cutter,origin,angle)
    modifier=obj.modifiers.new('Bay return / '+item['id'],'BOOLEAN');modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    try:bpy.ops.object.modifier_apply(modifier=modifier.name)
    finally:
        data=cutter.data;bpy.data.objects.remove(cutter,do_unlink=True)
        if not data.users:bpy.data.meshes.remove(data)


def build_grouped_bays(recipe,front,mat):
    import bpy,bmesh
    from .geometry import mesh,box
    from .walls import cut_apertures
    from .openings import recessed_opening
    objects=[]
    for raw in front.get('groupedBays',[]):
        plan=bay_plan(raw,front,recipe['roof']['eaves']);before=set(bpy.context.scene.objects)
        wall=mat(plan.get('material',recipe['materials']['wall']),plan.get('colour',recipe['materials'].get('wallColour')))
        frame=mat(plan.get('frameMaterial',recipe['materials'].get('frame','ivorytimber')),plan.get('frameColour'))
        glass=mat(plan.get('glassMaterial','glass'),plan.get('glassColour'))
        if plan.get('construction')=='hollow':
            from .grouped_bay_shell import shell_parts
            parts=shell_parts(plan,'wall','frame','glass')
            materials={'wall':wall,'frame':frame,'glass':glass}
            for part in parts:
                material=materials.get(part['material'])
                if material is None:material=mat('iron',part['material'])
                obj=mesh(part['name'],part['vertices'],part['faces'],material)
                for key in ('componentId','componentKind','featureId','storey','bayFace'):
                    if key in part:obj[key]=part[key]
                obj['provenance']=json.dumps(plan['provenance']);objects.append(obj)
            continue
        left,right,inset,projection=plan['left'],plan['right'],plan['returnInset'],plan['projection'];bottom,top=plan['bottom'],plan['top']
        ring=[(left,SURFACES['shell_back']),(right,SURFACES['shell_back']),(right,SURFACES['shell_front']),
              (right-inset,-projection),(left+inset,-projection),(left,SURFACES['shell_front'])]
        count=len(ring)
        verts=[(x,y,bottom+plan['baseRise']*max(0,min(1,(SURFACES['shell_front']-y)/(projection+SURFACES['shell_front'])))) for x,y in ring]
        verts += [(x,y,top) for x,y in ring]
        # The rear underside stays at the wall-contact datum; one planar
        # transverse soffit rises towards the projecting front. Split at the
        # contact edge instead of triangulating a nonplanar bottom polygon.
        bases=[(0,5,2,1),(5,4,3,2)] if plan['baseRise'] else [tuple(range(count-1,-1,-1))]
        faces=bases+[tuple(range(count,2*count))]+[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
        shell=mesh(plan['id']+' / continuous projecting masonry',verts,faces,wall)
        bm=bmesh.new();bm.from_mesh(shell.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(shell.data);bm.free()
        cut_apertures(shell,plan['openings'],front=-projection-.04,back=SURFACES['shell_back']+.04)
        shift=-projection-SURFACES['shell_front']
        for item in plan['openings']:
            prior=set(bpy.context.scene.objects)
            recessed_opening(item,frame,glass,glass_depth=item.get('glazingDepth',.10))
            for obj in set(bpy.context.scene.objects)-prior:
                _resize_sill(obj,plan)
                obj.location.y+=shift;obj['featureId']=item['id'];obj['storey']=item['storey'];obj['bayFace']='front'
        sides=[('left',(left,SURFACES['shell_front']),(left+inset,-projection)),
               ('right',(right-inset,-projection),(right,SURFACES['shell_front']))]
        if plan['sideWindows']:
            for side,a,b in sides:
                angle=math.atan2(b[1]-a[1],b[0]-a[0]);length=plan['sideLength']
                for item in plan['openings']:
                    side_item=copy.deepcopy(item);side_item.update(id=item['id']+' / '+side+' return',x=length/2,width=length-.16,mullions=[])
                    side_item['upperLights']=[]
                    _side_cut(shell,side_item,a,angle,wall)
                    prior=set(bpy.context.scene.objects)
                    recessed_opening(side_item,frame,glass,glass_depth=.10)
                    # Default facade front is -.035; this side's plane is 0.
                    offset=(a[0]-math.sin(angle)*.035,a[1]+math.cos(angle)*.035)
                    for obj in set(bpy.context.scene.objects)-prior:
                        _resize_sill(obj,plan)
                        _transform(obj,offset,angle);obj['featureId']=item['id'];obj['storey']=item['storey'];obj['bayFace']=side
        if plan['capHeight']:
            box(plan['id']+' / top cornice',plan['x'],(-projection+SURFACES['shell_back'])/2,top,
                plan['width']+2*plan['capProjection'],projection+SURFACES['shell_back']+2*plan['capProjection'],plan['capHeight'],frame)
        for obj in set(bpy.context.scene.objects)-before:
            obj['componentId']=plan['id'];obj['componentKind']='grouped-bay';obj['provenance']=json.dumps(plan['provenance']);objects.append(obj)
    return objects
