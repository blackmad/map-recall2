"""Warehouse shutters and hoist assemblies sharing the true aperture profile.

Angles are degrees: 0 closed, 90 projecting into the street, 180 folded back.
Leaf geometry is transformed before the facade parent is assigned, so the
common composer can keep one facade frame without destroying hinge transforms.
"""
from copy import deepcopy
import json
import math
from .apertures import from_spec
from .polygons import area,triangulate


def _number(value,name,minimum=None,maximum=None):
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):
        raise ValueError(name+' must be finite')
    if minimum is not None and value<minimum or maximum is not None and value>maximum:
        raise ValueError(name+' is outside its supported range')
    return value


def warehouse_opening_spec(item):
    """Keep semantic kind and shared shape; omit stock sash bars unless authored."""
    result=deepcopy(item)
    if 'warehouse' in result:
        result.setdefault('mullions',[])
        result.setdefault('transom',None)
        result.setdefault('upperLights',[])
    return result


def _clip(points,axis,bound,greater=True):
    result=[]
    for a,b in zip(points,points[1:]+points[:1]):
        da=(a[axis]-bound)*(1 if greater else -1);db=(b[axis]-bound)*(1 if greater else -1)
        if da>=-1e-10:result.append(a)
        if (da>1e-10 and db< -1e-10) or (da< -1e-10 and db>1e-10):
            fraction=da/(da-db)
            result.append(tuple(a[i]+fraction*(b[i]-a[i]) for i in (0,1)))
    clean=[]
    for point in result:
        if not clean or math.dist(point,clean[-1])>1e-9:clean.append(point)
    if len(clean)>1 and math.dist(clean[0],clean[-1])<1e-9:clean.pop()
    return clean


def _rectangle_clip(points,xmin,xmax,zmin=None,zmax=None):
    for axis,bound,greater in [(0,xmin,True),(0,xmax,False),(1,zmin,True),(1,zmax,False)]:
        if bound is not None:points=_clip(points,axis,bound,greater)
        if len(points)<3:return []
    return points


def shutter_layout(item):
    """Return two exact half-outlines and hinge transforms without Blender."""
    if 'warehouse' not in item:return []
    warehouse=item['warehouse']
    if not isinstance(warehouse,dict):raise ValueError('warehouse must be an object')
    if 'shutters' not in warehouse:return []
    options=warehouse['shutters']
    if not isinstance(options,dict):raise ValueError('warehouse.shutters must be an object')
    angle=_number(options.get('angle',180),'shutter angle',0,180)
    style=options.get('style','plank')
    if style not in ('plank','panel'):raise ValueError('Shutter style must be plank or panel')
    thickness=_number(options.get('thickness',.035),'shutter thickness',.012,.12)
    gap=_number(warehouse.get('leafGap',.012),'shutter centre gap',0,item['width']*.12)
    plank_width=_number(options.get('plankWidth',.18),'plank width',.05,1)
    if item['width']/2/plank_width>64:raise ValueError('Shutter plank subdivision exceeds low-poly budget')
    hinge_y=_number(options.get('hingeDepth',-.28),'hinge depth',-.45,-.18)
    if hinge_y+thickness+.035>-.18:raise ValueError('Shutter hinge depth must clear outer trim and leaf hardware at folded angles')
    _materials(options,('material','ironMaterial'))
    points=from_spec(item);centre=item['x'];left=centre-item['width']/2;right=centre+item['width']/2
    result=[]
    for side,hinge,greater,bound,rotation in [('left',left,False,centre-gap/2,-angle),
                                             ('right',right,True,centre+gap/2,angle)]:
        leaf=_clip(points,0,bound,greater)
        if len(leaf)<3 or abs(area(leaf))<1e-8:raise ValueError('Shutter gap removes the leaf')
        triangulate(leaf)
        result.append({'side':side,'outline':leaf,'hinge':[hinge,hinge_y],
                       'angle':angle,'rotation':math.radians(rotation),'thickness':thickness,
                       'style':style,'plankWidth':plank_width,'material':options.get('material','weatheredtimber'),
                       'colour':options.get('colour','#405f51'),'ironMaterial':options.get('ironMaterial','iron'),
                       'provenance':warehouse.get('provenance',item.get('provenance',{'status':'authored','basis':'component preset; no observation asserted'}))})
    return result


def transform_point(leaf,point):
    """Point uses closed facade x, hinge-relative y depth, absolute z."""
    x,y,z=point;hinge_x,hinge_y=leaf['hinge'];cs,sn=math.cos(leaf['rotation']),math.sin(leaf['rotation'])
    local=x-hinge_x
    return (hinge_x+cs*local-sn*y,hinge_y+sn*local+cs*y,z)


def _materials(spec,keys):
    from .materials import entries,linear
    names={entry['id'] for entry in entries()}
    for key in keys:
        if key in spec and (not isinstance(spec[key],str) or spec[key] not in names):raise ValueError('Unknown warehouse '+key)
    if 'colour' in spec:
        try:linear(spec['colour'])
        except (ValueError,TypeError,AttributeError):raise ValueError('Warehouse colour must be a valid hex colour')


def hoist_plan(spec,front_width,recipe=None,front=None):
    result={'projection':1.0,'width':.18,'height':.20,'material':'weatheredtimber','colour':'#5a5143',
            'ironMaterial':'iron','bracketDrop':.55,'rearDepth':.24,'tipRise':0.0}
    if not isinstance(spec,dict) or not spec.get('id'):raise ValueError('Warehouse hoist requires an id')
    result.update(deepcopy(spec))
    _materials(result,('material','ironMaterial'))
    if not isinstance(result['id'],str):raise ValueError('Warehouse hoist id must be a string')
    for name in ('x','z'):_number(result.get(name),name)
    for name in ('projection','width','height','bracketDrop'):_number(result[name],name,.03)
    _number(result['rearDepth'],'rearDepth',.05,.5)
    _number(result['tipRise'],'tipRise',0)
    if result['projection']<=.12:raise ValueError('Hoist projection must clear its support attachment')
    if not result['width']/2<=result['x']<=front_width-result['width']/2:raise ValueError('Hoist beam is outside facade width')
    if result['z']<=result['bracketDrop']:raise ValueError('Hoist bracket goes below the street datum')
    result['mountY']=-.035
    attachment=result.get('supportAttachmentId')
    if attachment is not None:
        if not isinstance(attachment,str) or not attachment.strip() or recipe is None or front is None:
            raise ValueError('Roof attachment hoist requires an explicit attachment id and recipe/front context')
        if front['id']!=recipe['frontages'][0]['id'] or abs(front.get('rotation',0))>1e-8 or any(abs(v)>1e-8 for v in front['origin']):
            raise ValueError('Roof attachment hoist requires the primary attachment coordinate frame')
        from .source_attachments import dormer_plan
        candidates=[d for key in ('sourceDormers','appearanceDormers') for d in recipe.get('details',{}).get(key,[]) if d.get('id')==attachment]
        if len(candidates)!=1:raise ValueError('Hoist support attachment must resolve uniquely')
        p=dormer_plan(recipe,candidates[0]);left=result['x']-result['width']/2;right=result['x']+result['width']/2
        if left<p['x']-p['width']/2 or right>p['x']+p['width']/2:raise ValueError('Hoist beam must fit its attachment width')
        region=result.get('supportRegion','body')
        if region not in ('body','cap'):raise ValueError('Hoist support region must be body or cap')
        bottom,head=p['bottom'],p['head'];result['mountY']=p['frontY']-.035
        if region=='cap':
            if p.get('capStyle')!='pitched':raise ValueError('Cap-mounted hoist requires a pitched cap')
            bottom=p['head']+.02;half=(p['width']+.12)/2
            head=min(bottom+(p['capTop']-bottom)*(1-abs(x-p['x'])/half) for x in (left,right))
            result['mountY']=p['frontY']-.09
        if result['z']+result['height']/2>head or result['z']-result['bracketDrop']<bottom:
            raise ValueError('Hoist beam and bracket must remain inside attachment support')
        if result['rearDepth']+.035>p['bodyDepth'] or result['z']-result['tipRise']*(result['rearDepth']+.035)/result['projection']-result['height']/2<bottom:
            raise ValueError('Hoist rear beam must remain inside attachment support')
        if region=='body':
            for opening in p['windows']:
                if left<opening['x']+opening['width']/2 and right>opening['x']-opening['width']/2:
                    low,high=opening['z']-opening['height']/2,opening['z']+opening['height']/2
                    rear_z=result['z']-result['tipRise']*min(result['rearDepth']+.035,.325)/result['projection']
                    if any(low<z<high for z in (result['z'],result['z']-result['bracketDrop'])) or min(high,result['z']+result['height']/2)>max(low,rear_z-result['height']/2):
                        raise ValueError('Hoist anchors cross attachment glazing; choose solid support')
    elif 'supportRegion' in result:raise ValueError('Hoist supportRegion requires supportAttachmentId')
    return result


def validate_warehouse(recipe):
    errors=[]
    for front in recipe.get('frontages',[]):
        for item in front.get('openings',[]):
            if 'warehouse' not in item:continue
            try:
                shutter_layout(item)
                spec=warehouse_opening_spec(item)
                if spec.get('transom') is None and spec.get('upperLights'):raise ValueError('Warehouse upperLights require an explicit transom')
                if spec.get('transom') is not None:_number(spec['transom'],'warehouse transom fraction',.01,.99)
                for key in ('mullions','upperLights'):
                    if not isinstance(spec[key],list):raise ValueError('Warehouse '+key+' must be a list')
                    for fraction in spec[key]:_number(fraction,key+' fraction',.01,.99)
            except (ValueError,KeyError,TypeError) as error:errors.append(item.get('id','warehouse')+': '+str(error))
        seen=set()
        hoists=front.get('warehouseHoists',[])
        if not isinstance(hoists,list):
            errors.append('warehouseHoists must be a list');continue
        for raw in hoists:
            try:
                spec=hoist_plan(raw,front['width'],recipe,front)
                from .source_massing import frontage_profile
                profile=frontage_profile(recipe,front)
                for a,b in zip(profile,profile[1:]) if not spec.get('supportAttachmentId') else []:
                    if min(a[0],b[0])<=spec['x']<=max(a[0],b[0]) and a[0]!=b[0]:
                        head=a[1]+(b[1]-a[1])*(spec['x']-a[0])/(b[0]-a[0])
                        if spec['z']+spec['height']/2>head:raise ValueError('Warehouse hoist beam must remain supported below facade head')
                        break
                if spec['id'] in seen:raise ValueError('Duplicate warehouse hoist id')
                seen.add(spec['id'])
            except (ValueError,KeyError,TypeError) as error:errors.append(str(error))
    return errors


def shutter_prism(points,front,back,leaf):
    """Pure closed leaf mesh, shared by Blender and portable consumers."""
    if len(points)<3 or abs(area(points))<1e-10:return None
    points=list(points)
    if area(points)<0:points.reverse()
    n=len(points);caps=triangulate(points)
    verts=[transform_point(leaf,(x,y,z)) for y in (front,back) for x,z in points]
    faces=list(caps)+[tuple(n+i for i in reversed(face)) for face in caps]
    faces.extend((i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n))
    return verts,faces


def _prism(name,points,front,back,material,leaf):
    """Closed leaf/detail prism with caps triangulated from the shared outline."""
    from .geometry import mesh
    plan=shutter_prism(points,front,back,leaf)
    if plan is None:return None
    verts,faces=plan
    obj=mesh(name,verts,faces,material)
    obj['shutterSide']=leaf['side'];obj['shutterAngleDegrees']=leaf['angle'];obj['hingeFacadeMetres']=leaf['hinge']
    return obj


def _build_leaf(item,leaf,mat):
    from .geometry import box
    points=leaf['outline'];t=leaf['thickness'];wood=mat(leaf['material'],leaf['colour']);iron=mat(leaf['ironMaterial'])
    label=item['id']+' / '+leaf['side'];objects=[]
    def prism(label_suffix,profile,front,back,material):
        obj=_prism(label+' '+label_suffix,profile,front,back,material,leaf)
        if obj is not None:objects.append(obj)
    prism('closed shutter leaf',points,-t,0,wood)
    xmin,xmax=min(p[0] for p in points),max(p[0] for p in points)
    bottom,top=min(p[1] for p in points),max(p[1] for p in points)
    if leaf['style']=='plank':
        count=math.ceil((xmax-xmin)/leaf['plankWidth']);step=(xmax-xmin)/count
        for index in range(count):
            board=_rectangle_clip(points,xmin+step*index+.0015,xmin+step*(index+1)-.0015)
            prism('front plank '+str(index),board,-t-.006,-t+.001,wood)
            prism('back plank '+str(index),board,-.001,.006,wood)
    else:
        # Raised rails/stiles describe actual panels, while the solid backing
        # retains the complete arched leaf rather than replacing it with a box.
        strips=[(xmin,xmin+.055,None,None),(xmax-.055,xmax,None,None),
                (xmin,xmax,bottom+.08,bottom+.14),(xmin,xmax,(bottom+top)/2-.03,(bottom+top)/2+.03),
                (xmin,xmax,top-.18,top-.12)]
        for index,strip in enumerate(strips):
            panel=_rectangle_clip(points,*strip)
            prism('front panel rail '+str(index),panel,-t-.012,-t+.001,wood)
            prism('back panel rail '+str(index),panel,-.001,.012,wood)
    # Iron straps and handle rotate with each leaf, including its curved head.
    for index,z in enumerate((bottom+(top-bottom)*.23,bottom+(top-bottom)*.68)):
        strap=_rectangle_clip(points,xmin+.018,xmax-.018,z-.025,z+.025)
        prism('front strap '+str(index),strap,-t-.018,-t-.010,iron)
        prism('back strap '+str(index),strap,.009,.018,iron)
    handle_x=xmax-.075 if leaf['side']=='left' else xmin+.075
    handle=_rectangle_clip(points,handle_x-.013,handle_x+.013,bottom+(top-bottom)*.43-.065,bottom+(top-bottom)*.43+.065)
    prism('pull handle',handle,-t-.035,-t-.020,iron)
    # Fixed hinge pins sit on the actual vertical jamb axis. These are not
    # rotating child objects and survive the facade's single parent transform.
    for z in (bottom+(top-bottom)*.23,bottom+(top-bottom)*.68):
        objects.append(box(label+' hinge pin',leaf['hinge'][0],leaf['hinge'][1],z,.035,.035,.13,iron))
    for obj in objects:
        obj['featureId']=item['id'];obj['warehouseComponent']='paired-shutter';obj['storey']=item.get('storey','unknown')
        obj['provenance']=json.dumps(leaf['provenance'])
    return objects


def _build_hoist(spec,mat):
    from .geometry import box,beam,mesh
    wood=mat(spec['material'],spec.get('colour'));iron=mat(spec['ironMaterial'])
    x,z=spec['x'],spec['z'];mount=spec.get('mountY',-.035);front=mount-spec['projection'];back=mount+.035+spec['rearDepth']
    rise=spec['tipRise'];tip_z=z+rise
    # z is the mount centre at y=-.035. The raised tip extends streetward;
    # the rear end follows the same line instead of lifting the wall support.
    rear_z=z-rise*(back-mount)/spec['projection']
    half_height=spec['height']/2/math.sqrt(1+(rise/spec['projection'])**2)
    if rise:
        timber=beam(spec['id']+' / heavy timber beam',(x,back,rear_z),(x,front,tip_z),spec['width'],spec['height'],wood)
    else:
        timber=box(spec['id']+' / heavy timber beam',x,(front+back)/2,z,spec['width'],back-front,spec['height'],wood)
    objects=[timber,beam(spec['id']+' / diagonal iron support',(x,mount-.005,z-spec['bracketDrop']),
                        (x,front+.12,tip_z-rise*.12/spec['projection']-half_height),.035,.035,iron)]
    # A small closed low-poly eye in the x/z plane, below the beam's tip.
    outer=.105;inner=.065;cz=tip_z-half_height-.14;n=10
    verts=[(x+radius*math.cos(i*math.tau/n),front+depth,cz+radius*math.sin(i*math.tau/n))
           for depth in (-.018,.018) for radius in (outer,inner) for i in range(n)]
    faces=[]
    for i in range(n):
        j=(i+1)%n;faces.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),
                              (i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
    objects.append(mesh(spec['id']+' / iron hoist eye',verts,faces,iron))
    objects.append(box(spec['id']+' / eye hanger',x,front,tip_z-half_height-.04,.035,.035,.13,iron))
    for obj in objects:
        obj['featureId']=spec['id'];obj['warehouseComponent']='hoist'
        obj['provenance']=json.dumps(spec.get('provenance',{'status':'authored','basis':'component preset; no observation asserted'}))
    return objects


def build_warehouse_attachments(front,material_factory,recipe=None):
    """Facade-local hook after ordinary recessed openings, before parenting."""
    objects=[]
    for item in front.get('openings',[]):
        for leaf in shutter_layout(item):objects.extend(_build_leaf(item,leaf,material_factory))
    for raw in front.get('warehouseHoists',[]):objects.extend(_build_hoist(hoist_plan(raw,front['width'],recipe,front),material_factory))
    return objects
