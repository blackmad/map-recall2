"""Versioned recipe validation. Fail on unsupported topology before scene mutation."""
import math
from .layout import validate_surfaces

def validate(recipe):
    from .materials import linear
    errors=[]
    def check(ok, message):
        if not ok: errors.append(message)
    from .attachment_contracts import finite,dormer_support,ridge_support
    from .source_massing import compile_source_massing,frontage_profile
    surface=None
    check(recipe.get('schemaVersion')==1,'Unsupported recipe schema')
    for k in ('id','name','footprint','frontages','roof','gable','materials','storeys','assumptions'): check(k in recipe,f'Missing {k}')
    if errors: return errors
    placement=recipe.get('placement',{});rdframe=placement.get('sourceRDFrame')
    if rdframe is not None:
        check(isinstance(rdframe,dict),'Source RD frame must be an object')
        if isinstance(rdframe,dict):
            pairs=[rdframe.get(k) for k in ('anchorRD','xAxisRD','yAxisRD')]
            good=all(isinstance(p,list) and len(p)==2 and all(finite(v) for v in p) for p in pairs)
            check(good,'Source RD frame requires finite endpoint/axis pairs')
            check(rdframe.get('buildingId')==recipe.get('buildingId') and rdframe.get('geometryRevision')==recipe.get('geometryRevision'),'Source RD frame owner/revision mismatch')
            if good:
                _,u,v=pairs
                check(abs(math.hypot(*u)-1)<1e-6 and abs(math.hypot(*v)-1)<1e-6 and abs(u[0]*v[0]+u[1]*v[1])<1e-6 and abs(u[0]*v[1]-u[1]*v[0]-1)<1e-6,'Source RD frame axes must preserve unit metre handedness')
                endpoints=placement.get('frontageLocal',[])
                if len(endpoints)==2:
                    a,b=endpoints;width=math.dist(a,b)
                    if width>0:check(math.dist(u,[(b[0]-a[0])/width,-(b[1]-a[1])/width])<1e-6,'Source RD frame axis differs from physical frontage')
    ring=recipe['footprint']; check(len(ring)>=3,'Footprint needs three vertices')
    check(all(math.isfinite(v) for p in ring for v in p),'Nonfinite footprint')
    check(not recipe.get('holes'),'Courtyard holes not supported in initial compiler')
    try:
        from .polygons import triangulate
        triangulate(ring)
    except ValueError as e: errors.append(str(e))
    check(recipe['roof']['kind'] in ('pitched','flat','shed','hip','gambrel','mansard'),'Unsupported roof kind')
    check(recipe['roof']['top']>=recipe['roof']['eaves']>0,'Invalid roof heights')
    try:
        if recipe.get('massing'):
            compile_source_massing(recipe)
        else:
            from .roof_surfaces import compile_roof
            surface=compile_roof(recipe)
    except (ValueError,KeyError,TypeError,IndexError) as e:errors.append('Roof: '+str(e))
    details=recipe.get('details',{})
    from .open_frames import validate_open_frames
    errors.extend(validate_open_frames(recipe))
    from .source_attachments import validate_source_attachments
    errors.extend(validate_source_attachments(recipe))
    if recipe.get('massing'):
        check(not any(details.get(k) for k in ('dormers','ridgeCap','chimney','gutters','coveringThickness')),
              'Source-derived massing attachments require explicit semantic support; analytic roof details unsupported')
    for item in details.get('dormers',[]):
        try:
            values=[item[k] for k in ('x','y','width','height')]
            if surface is not None:dormer_support(surface,*values)
            elif not all(finite(v) for v in values) or values[2]<=0 or values[3]<=0:
                raise ValueError('Dormer coordinates must be finite and dimensions positive')
        except (ValueError,KeyError,TypeError) as e:errors.append('Dormer: '+str(e))
    if details.get('ridgeCap') and surface is not None:
        try:ridge_support(recipe,surface)
        except (ValueError,KeyError,TypeError) as e:errors.append('Ridge cap: '+str(e))
    try:validate_surfaces()
    except ValueError as e:errors.append(str(e))
    floors={f['id']:f for f in recipe['storeys']}
    check('ground' in floors,'Ground storey required')
    for front in recipe['frontages']:
        check(front['width']>0,'Invalid facade width')
        check(isinstance(front.get('storefront',{}).get('cornice',True),bool),'Storefront cornice must be boolean')
        for sign in front.get('storefront',{}).get('signs',[]):
            size=sign.get('fontSize',.22)
            check(isinstance(size,(int,float)) and not isinstance(size,bool) and math.isfinite(size) and size>0,'Sign fontSize must be finite and positive')
        from .ground_floors import assembly_aperture,storefront_plan
        cuts=list(front.get('openings',[]))
        for assembly in front.get('storefront',{}).get('recessedAssemblies',[]):
            try:
                cuts.append(assembly_aperture(assembly))
                storefront_plan(assembly['width'],assembly['head'],assembly['recess'],assembly['sideReturn'],assembly['sill'],assembly['head'])
            except (ValueError,KeyError) as e:errors.append(f'Recessed storefront: {e}')
        from .entrance_stairs import stair_plan
        for step in front.get('storefront',{}).get('entranceSteps',[]):
            try:stair_plan(step,front,recipe)
            except (KeyError,TypeError,ValueError) as e:errors.append('Entrance steps: '+str(e))
        from .apertures import validate_layout
        profile=frontage_profile(recipe,front)
        try:validate_layout(cuts,front['width'],[(0,0),(front['width'],0)]+list(reversed(profile)))
        except ValueError as e:errors.append(str(e))
        for o in cuts:
            from .recessed_entries import entry_plan
            try:entry_plan(o)
            except (ValueError,KeyError,TypeError) as e:errors.append(f"{o.get('id','opening')}: {e}")
            from .sash_bars import sash_bar_plan
            try:sash_bar_plan(o)
            except (ValueError,KeyError,TypeError) as e:errors.append(f"{o.get('id','opening')}: {e}")
            x,z,w,h=o['x'],o['z'],o['width'],o['height']
            if 'horizontalMullions' in o:
                bars=o['horizontalMullions']
                check(o.get('head','rectangular')=='rectangular' and isinstance(bars,list) and all(finite(v) and 0<v<1 for v in bars) and all(a<b for a,b in zip(bars,bars[1:])),f"{o['id']}: Horizontal grid bars require rectangular head and ordered inside fractions")
            if 'sashColour' in o:
                try:linear(o['sashColour'])
                except (ValueError,TypeError,AttributeError):errors.append(f"{o['id']}: Invalid sash colour")
            if o.get('head') in ('circular','keyhole'):
                check(o.get('kind','window')=='window' and not any(o.get(k) for k in ('warehouse','lowerPanel','transomArch','upperLights','upperLightBars')),'Circular aperture supports window sash only')
                circle_mullions=o.get('mullions',[.5])
                check(isinstance(circle_mullions,list) and all(finite(v) and .05<v<.95 for v in circle_mullions),'Circular mullions require inside fractions')
                check(o.get('transom',.25) is None or finite(o.get('transom',.25)) and .05<o.get('transom',.25)<.95,'Circular transom requires inside fraction')
            from .layout import SURFACES
            depth=o.get('glazingDepth',.10)
            check(finite(depth) and SURFACES['shell_front']<depth<depth+.014<SURFACES['shell_back'],
                  f"{o['id']}: Glazing recess must be inside wall depth")
            if 'upperLightBars' in o:
                bars=o['upperLightBars'];transom=o.get('transom',.25)
                check(isinstance(bars,list) and all(finite(v) and 0<v<1 for v in bars) and all(a<b for a,b in zip(bars,bars[1:])),
                      f"{o['id']}: Upper light bars must be ordered inside fractions")
                check(finite(transom) and 0<transom<1 and not o.get('transomArch'),
                      f"{o['id']}: Upper light bars require a straight transom")
            if 'transomArch' in o:
                arch=o['transomArch'];transom=o.get('transom',.25)
                rise=arch.get('rise') if isinstance(arch,dict) else None
                numeric=lambda v:isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)
                check(numeric(rise) and numeric(transom) and 0<transom<1 and 0<rise<h*transom,
                      f"{o['id']}: Transom arch rise must fit upper pane")
            if 'doorLeaf' in o:
                from .door_leaf import door_leaf_blocks
                try:door_leaf_blocks(o,o.get('glazingDepth',.12))
                except (ValueError,KeyError,TypeError) as error:errors.append(o['id']+': '+str(error))
            if 'lowerPanel' in o:
                panel=o['lowerPanel'];panel_h=panel.get('height') if isinstance(panel,dict) else None
                check(isinstance(panel_h,(int,float)) and not isinstance(panel_h,bool) and math.isfinite(panel_h) and 0<panel_h<h,
                      f"{o['id']}: Lower panel must fit opening height")
                if isinstance(panel,dict):
                    divisions=panel.get('divisions',[]);count=panel.get('louvreCount',0)
                    check(isinstance(divisions,list) and all(finite(v) and 0<v<1 for v in divisions) and all(a<b for a,b in zip(divisions,divisions[1:])),
                          f"{o['id']}: Lower panel divisions must be ordered fractions")
                    if isinstance(divisions,list) and all(finite(v) for v in divisions):
                        check(all(w*(b-a)>.11 for a,b in zip([0]+divisions,divisions+[1])),f"{o['id']}: Lower panel leaves too narrow")
                    check(isinstance(count,int) and not isinstance(count,bool) and 0<=count<=32,f"{o['id']}: Louvre count must be 0–32")
            if 'handleFractions' in o:
                values=o['handleFractions']
                check(isinstance(values,list) and all(finite(v) and 0<v<1 for v in values),f"{o['id']}: Door handles require inside fractions")
            check(w>0 and h>0 and x-w/2>=-.01 and x+w/2<=front['width']+.01,f"{o['id']}: opening outside facade width")
            f=floors.get(o.get('storey'))
            check(f is not None or o.get('storey')=='attic',f"{o['id']}: unknown storey")
            if f:check(z-h/2>=f['bottom']-.16 and z+h/2<=f['top']+.01,f"{o['id']}: opening outside storey")
    if not recipe.get('synthetic'):
        check(bool(recipe.get('sourceBundle')),'Real building requires dated source bundle')
        check(bool(recipe.get('geometryRevision')),'Real building requires geometry revision')
    if recipe['gable'].get('material'):
        from .materials import entries,linear
        check(recipe['gable']['material'] in {entry['id'] for entry in entries()},'Unknown gable material')
        if 'colour' in recipe['gable']:
            try:linear(recipe['gable']['colour'])
            except (ValueError,TypeError,AttributeError):errors.append('Invalid gable colour')
    from .component_catalog import validate_components
    errors.extend(validate_components(recipe))
    from .warehouse import validate_warehouse
    errors.extend(validate_warehouse(recipe))
    from .grouped_bays import validate_grouped_bays
    errors.extend(validate_grouped_bays(recipe))
    return errors
