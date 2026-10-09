"""Pure, metre-based contracts for optional facade details and street furniture.

Defaults are authoring presets, never observations. Components are independent
of roof/gable family, so the same dressing works on ordinary urban blocks.
"""
import copy
import math

VERSION=1
FACADES={
 'cornice':{'material':'limestone','height':.26,'projection':.30,'overhang':.08,'profile':'stepped'},
 'stringcourse':{'material':'limestone','height':.12,'projection':.09,'overhang':0},
 'lintel':{'material':'limestone','height':.18,'projection':.08,'margin':.15},
 'sill':{'material':'bluestone','height':.10,'projection':.22,'margin':.12,'drop':.05},
 'quoins':{'material':'limestone','width':.34,'alternateWidth':.48,'height':.27,'spacing':.42,'projection':.065,'bottom':.35,'edges':['left','right']},
 'pilaster':{'material':'limestone','width':.30,'projection':.10,'bottom':0},
 'corbel':{'material':'limestone','width':.15,'height':.42,'projection':.30},
 'mailboxes':{'material':'greystone','width':.75,'height':1.05,'projection':.065,'rows':4,'columns':2},
 'dressing':{'material':'limestone','width':.13,'projection':.07},
 'balcony':{'material':'limestone','frameMaterial':'iron','depth':.70,'height':.90,'slabThickness':.12,'balusterSpacing':.28,'railThickness':.035},
}
SITE={
 'table':{'material':'weatheredtimber','frameMaterial':'iron','width':.78,'depth':.70,'height':.73,'shape':'square'},
 'chair':{'material':'weatheredtimber','frameMaterial':'iron','width':.44,'depth':.48,'height':.83,'seatHeight':.43},
 'planter':{'material':'greystone','soilMaterial':'brownbrick','plantMaterial':'creamrender','plantColour':'#5d7955','width':.65,'depth':.48,'height':.44,'plantHeight':.35},
}


def _number(value,name,positive=False):
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):
        raise ValueError(name+' must be a finite number')
    if positive and value<=0:raise ValueError(name+' must be positive')
    return value


def _opening(front,identifier):
    if not identifier:raise ValueError('Opening detail requires openingId')
    matches=[o for o in front.get('openings',[]) if o['id']==identifier]
    if len(matches)!=1:raise ValueError('Opening detail needs one unambiguous openingId: '+str(identifier))
    return matches[0]


def resolve(spec,front=None,eaves=None,site=False):
    """Resolve one component without importing Blender or mutating the recipe."""
    if not isinstance(spec,dict) or not spec.get('id'):raise ValueError('Component requires an id')
    catalog=SITE if site else FACADES
    kind=spec.get('kind')
    if kind not in catalog:raise ValueError('Unsupported '+('site' if site else 'facade')+' component: '+str(kind))
    result=copy.deepcopy(catalog[kind]);result.update(copy.deepcopy(spec))
    if site:
        position=result.get('position')
        if not isinstance(position,(list,tuple)) or len(position)!=3:raise ValueError('Site component requires building-local position [x,y,z]')
        for value in position:_number(value,'position')
        _number(result.setdefault('rotation',0),'rotation')
        for name in ('width','depth','height'):_number(result[name],name,True)
        if position[2]<0:raise ValueError('Site component base cannot be below its street datum')
        if kind=='table' and result['shape'] not in ('square','round'):raise ValueError('Unsupported table shape')
        if kind=='chair':
            _number(result['seatHeight'],'seatHeight',True)
            if not .15<result['seatHeight']<result['height']-.08:raise ValueError('Chair seat must lie below its back')
        if kind=='planter':
            _number(result['plantHeight'],'plantHeight',True)
            if min(result['width'],result['depth'],result['height'])<=.15:raise ValueError('Planter is too small for its shell')
        return result
    if front is None or eaves is None:raise ValueError('Facade details require frontage and eaves')
    width=front['width']
    if kind=='balcony':
        for name in ('x','z','width'):
            if name not in result:raise ValueError('Balcony requires explicit '+name)
            _number(result[name],name,name=='width')
        for name in ('depth','height','slabThickness','balusterSpacing','railThickness'):_number(result[name],name,True)
        if result['railThickness']>=min(result['depth'],result['height'])/3:raise ValueError('Balcony railing is too thick for its span')
        if result['z']<=result['slabThickness']:raise ValueError('Balcony slab must sit above its street datum')
        if result['x']-result['width']/2 < -1e-7 or result['x']+result['width']/2>width+1e-7:
            raise ValueError('Balcony span is outside its facade')
    elif kind in ('lintel','sill','dressing'):
        opening=_opening(front,result.get('openingId'));result['opening']=copy.deepcopy(opening)
        if kind=='dressing' and opening.get('head','rectangular')!='rectangular':
            raise ValueError('Stone dressing currently requires a rectangular opening')
        result.setdefault('x',opening['x'])
        if kind in ('lintel','sill'):
            result.setdefault('width',opening['width']+2*result['margin'])
            result.setdefault('z',opening['z']+opening['height']/2+result['height']/2 if kind=='lintel'
                              else opening['z']-opening['height']/2-result['drop']-result['height']/2)
    elif kind in ('cornice','stringcourse'):
        result.setdefault('x',width/2);result.setdefault('width',width+2*result['overhang'])
        if kind=='cornice':result.setdefault('z',eaves)
        if 'z' not in result:raise ValueError('Stringcourse requires an explicit z datum')
    elif kind=='pilaster':
        if 'x' not in result:raise ValueError('Pilaster requires an explicit x')
        result.setdefault('top',eaves);result.setdefault('height',result['top']-result['bottom'])
        result.setdefault('z',(result['top']+result['bottom'])/2)
        panels=result.get('panels',[])
        if not isinstance(panels,list):raise ValueError('Pilaster panels must be a list')
        previous=result['bottom']
        for panel in panels:
            if not isinstance(panel,dict):raise ValueError('Pilaster panel requires bounds and inset')
            for key in ('bottom','top','margin','inset'):_number(panel.get(key),'panel '+key)
            if not previous<=panel['bottom']<panel['top']<=result['top'] or panel['bottom']<=result['bottom'] or panel['top']>=result['top']:
                raise ValueError('Pilaster panels require ordered disjoint interior bounds')
            if not 0<panel['margin']<result['width']/2 or not 0<panel['inset']<result['projection']:
                raise ValueError('Pilaster panel requires positive side margins and a retained back')
            previous=panel['top']
    elif kind=='corbel':
        if 'x' not in result:raise ValueError('Corbel requires an explicit x')
        result.setdefault('z',eaves-result['height']/2)
        if result['x']-result['width']/2<0 or result['x']+result['width']/2>width or result['z']-result['height']/2<0:
            raise ValueError('Corbel must sit within its facade above the street')
    elif kind=='mailboxes':
        for key in ('x','z'):_number(result.get(key),'mailboxes '+key)
        for key in ('rows','columns'):
            if isinstance(result[key],bool) or not isinstance(result[key],int) or not 1<=result[key]<=8:raise ValueError('Mailbox grid requires 1–8 integer rows/columns')
        if result['rows']*result['columns']>32 or result['width']/result['columns']<.15 or result['height']/result['rows']<.12:
            raise ValueError('Mailbox grid count or cell dimensions unsupported')
        if result['x']-result['width']/2<0 or result['x']+result['width']/2>width or not 0<=result['z']-result['height']/2<result['z']+result['height']/2<=eaves:
            raise ValueError('Mailbox grid must lie within facade body')
        for opening in front.get('openings',[]):
            if min((result['width']+opening['width'])/2-abs(result['x']-opening['x']), (result['height']+opening['height'])/2-abs(result['z']-opening['z']))>1e-7:
                raise ValueError('Mailbox grid cannot reblock a facade opening')
    elif kind=='quoins':
        result.setdefault('top',eaves-.30)
        if any(edge not in ('left','right') for edge in result['edges']) or not result['edges']:
            raise ValueError('Quoin edges must be left/right')
        if result['spacing']<result['height']:raise ValueError('Quoin spacing must leave distinct blocks')
        if result['top']<=result['bottom']:raise ValueError('Quoins must have an ordered vertical range')
    for name in ('width','height','projection','spacing','alternateWidth'):
        if name in result:_number(result[name],name,True)
    for name in ('x','z','top','bottom','margin','drop','overhang'):
        if name in result:_number(result[name],name)
    if 'x' in result and not 0<=result['x']<=width:raise ValueError('Component anchor is outside facade')
    if kind=='cornice' and result['profile'] not in ('flat','stepped'):raise ValueError('Unsupported cornice profile')
    return result


def resolve_zone(zone,front,eaves):
    if not isinstance(zone,dict) or not zone.get('id') or not zone.get('material'):
        raise ValueError('Material zone requires id and material')
    result=copy.deepcopy(zone)
    if result.get('construction','boolean') not in ('boolean','pierced','clipped'):
        raise ValueError('Unknown material zone construction')
    for name in ('x','z','width','height'):_number(result.get(name),name, name in ('width','height'))
    if (result['x']-result['width']/2 < -1e-7 or result['x']+result['width']/2>front['width']+1e-7 or
        result['z']-result['height']/2 < -1e-7 or result['z']+result['height']/2>eaves+1e-7):
        raise ValueError('Material zone must lie inside the facade body')
    result.setdefault('frontDepth',-.085);result.setdefault('thickness',.025)
    _number(result['frontDepth'],'frontDepth');_number(result['thickness'],'thickness',True)
    if not -.25<result['frontDepth']<-.035 or result['thickness']>.08:
        raise ValueError('Material zone must be a thin exterior finish')
    return result


def validate_components(recipe):
    """Schema hook: errors before scene mutation, preserving absent components."""
    errors=[];seen=set()
    def check(spec,front=None,site=False,zone=False):
        try:
            resolved=resolve_zone(spec,front,recipe['roof']['eaves']) if zone else resolve(spec,front,recipe['roof']['eaves'],site)
            key=(front.get('id') if front else 'site',resolved['id'])
            if key in seen:raise ValueError('Duplicate component id: '+resolved['id'])
            seen.add(key)
        except (ValueError,TypeError,KeyError) as error:errors.append(str(error))
    for front in recipe.get('frontages',[]):
        if front.get('coping'):
            from .gables import coping_mesh
            from .materials import linear
            try:
                spec=front['coping'];linear(spec['colour'])
                if spec.get('provenance',{}).get('status') not in ('inferred','synthetic') or not spec.get('provenance',{}).get('basis'):
                    raise ValueError('Coping requires explicit authoring provenance')
                coping_mesh(front['profile'],spec.get('width',.11),spec.get('depth',.34),inset_top=True)
            except (ValueError,TypeError,KeyError) as error:errors.append('Coping: '+str(error))
        from .facade_finish import finish_plan
        try:finish_plan(recipe,front)
        except (ValueError,TypeError,KeyError) as error:errors.append(str(error))
        for spec in front.get('components',[]):check(spec,front)
        zones=front.get('materialZones',[])
        for zone in zones:check(zone,front,zone=True)
        for i,a in enumerate(zones):
            for b in zones[i+1:]:
                try:
                    overlap_x=(a['width']+b['width'])/2-abs(a['x']-b['x'])
                    overlap_z=(a['height']+b['height'])/2-abs(a['z']-b['z'])
                    if min(overlap_x,overlap_z)>1e-7:errors.append('Material zones overlap: '+a['id']+' / '+b['id'])
                except (KeyError,TypeError):pass
    for spec in recipe.get('siteComponents',[]):check(spec,site=True)
    return errors


def catalog():
    facade=copy.deepcopy(FACADES)
    for spec in facade.values():spec['recipePath']='frontages[].components[]'
    facade['cornice']['parameters']=['id','x','z','width','height','projection','overhang','profile','material','colour']
    facade['stringcourse']['required']=['z']
    for kind in ('lintel','sill','dressing'):facade[kind]['required']=['openingId']
    facade['pilaster']['required']=['x']
    facade['pilaster']['parameters']=['x','width','bottom','top','projection','panels']
    facade['pilaster']['note']='Optional panels have ordered bottom/top bounds, side margin and positive inset smaller than projection; recessed shaft retains its solid back.'
    facade['corbel']['required']=['x']
    facade['corbel']['note']='Closed faceted concave bracket beneath a cornice; explicit width, height and projection, default top at eaves. Shape is an authoring preset.'
    facade['mailboxes']['parameters']=['id','x','z','width','height','projection','rows','columns','material','colour','provenance']
    facade['mailboxes']['note']='Closed wall-mounted backing, cell plates, dark slots and labels. Maximum 32 cells; must remain beside every authored facade aperture.'
    facade['mailboxes']['required']=['x','z']
    facade['mailboxes']['note']='Bounded grid of opaque face plates, dark slots and pale labels; cannot overlap an authored facade opening. Cell count and dimensions are presets.'
    facade['balcony']['required']=['x','z','width']
    facade['balcony']['note']='z is walking/slab TOP datum; height is front and side railing height above it; explicit width may span several bays'
    site=copy.deepcopy(SITE)
    for spec in site.values():spec.update(recipePath='siteComponents[]',required=['id','position'],parameters=['width','depth','height','rotation','material','colour'])
    openings={
      'raised-entry-stairs':{'recipePath':'frontages[].storefront.entranceSteps[]',
        'parameters':['id','openingId','x','width','rise','run','construction','direction','landing','railHeight','colour','railColour','scope','provenance'],
        'note':'Shared closed solid steps or open treads/stringers with supported landing and diagonal rail. Rise must meet owned door threshold. Outward/left/right approaches; a cross-frontage approach requires explicit inferred same-owner scope and projected owner bounds.'},
      'recessed-entrance':{'recipePath':'frontages[].openings[].entranceRecess',
        'parameters':['depth','liningThickness','liningColour','thresholdRise','doorWidthFraction','doorHeightFraction','doorTemplate','provenance'],
        'note':'Rectangular ground door aperture owns closed solid passage returns, floor, soffit, pierced rear wall and smaller rear door. Shared Blender/portable geometry; depths and rear-door proportions explicitly inferred. Outer doorLeaf/warehouse assemblies cannot coexist.'},
      'timber-entry-leaf':{'recipePath':'frontages[].openings[].doorLeaf or openingPatterns[].doorTemplate.doorLeaf',
        'parameters':['style','rows','columns','colour'],
        'note':'Opaque plain/panelled timber below a separate glazed transom. Rectangular, segmental and rounded doors supported; arched transoms must keep the rectangular leaf entirely below the arch spring. Door templates are independent of display-window templates; preserves shared aperture ownership and separate surrounding facade/frame finishes.'},
      'rectangular':{'label':'Rectangular aperture','recipePath':'frontages[].openings[]','parameters':['x','z','width','height','kind','storey','mullions','sashBars','transom','transomArch','upperLights','upperLightBars','lowerPanel','lowerPanel.divisions','lowerPanel.louvreCount','handleFractions','handleColour','glassColour','glazingDepth'],'head':'rectangular'},
      'segmental':{'label':'Circular segment arch','recipePath':'frontages[].openings[]','head':'segmental','parameters':['archRise','archSegments'],'note':'archRise is circular sag, no greater than half the span'},
      'rounded':{'label':'Rounded or elliptical head','recipePath':'frontages[].openings[]','head':'rounded','parameters':['archRise','archSegments'],'note':'archRise equal to width/2 gives a semicircle; other positive rises give an ellipse'},
      'circular':{'label':'Full circular oculus','recipePath':'frontages[].openings[]','head':'circular','parameters':['x','z','width','height','archSegments','mullions','transom','glazingDepth'],'note':'Equal width/height; true through-wall circle with shared reveal/frame/pane and clipped sash chords. Window only; no rectangular sill, kickpanel or shutters.'},
      'keyhole':{'label':'Circular bulb with narrow stem','recipePath':'frontages[].openings[]','head':'keyhole','parameters':['x','z','width','height','stemWidth','archSegments','mullions','transom','glazingDepth'],'note':'True keyhole void, continuous mitered frame/reveal rings and outline-clipped sash. Width is bulb diameter; height includes the stem. Window only.'},
    }
    roofs={
      'flat':{'parameters':['eaves','top','setback'],'topology':'concave simple exterior ring; top equals covering eaves'},
      'shed':{'parameters':['eaves','top','setback'],'topology':'concave simple exterior ring; pitch follows frontage x'},
      'pitched':{'parameters':['eaves','top','pitchSpan','ridgeX','setback','frontTransition','gableClearance','frontJoin','frontHipRun'],'topology':'concave simple exterior ring'},
      'gambrel':{'parameters':['eaves','top','pitchSpan','ridgeX','kneeSpan','kneeHeight'],'required':['kneeSpan','kneeHeight'],'topology':'concave simple exterior ring; steep lower and shallow upper pitches'},
      'hip':{'parameters':['eaves','top','hipEndRun','ridgeX'],'required':['hipEndRun'],'topology':'axis-aligned actual rectangular footprint'},
      'mansard':{'parameters':['eaves','top','kneeInset','topInset','kneeHeight'],'required':['kneeInset','topInset','kneeHeight'],'topology':'axis-aligned actual rectangular footprint with nested broken pitches'},
    }
    for spec in roofs.values():spec['recipePath']='roof'
    gables={family:{'builder':'building_lib.gables.profile','recipePath':'gable.family (resolved to gable.profile by IR)','parameters':['width','eaves','rise','material','colour'],
             'note':'Author a silhouette independently of the roof; preset ratios are synthetic'}
            for family in ('straight','triangular','spout','stepped','neck','bell','gambrel','pediment')}
    gables['continuous-coping']={'builder':'building_lib.gables.coping_mesh',
        'recipePath':'frontages[].coping','parameters':['width','depth','colour','provenance'],
        'note':'Closed mitered band follows the resolved frontage silhouette. Explicit coping sits below the chosen facade peak; Blender and portable builders share vertices.'}
    for family in ('neck','bell'):
        gables[family]['parameters'].append('raised')
        gables[family]['note']='raised is a complete parapet base below an unchanged decorative silhouette, never extra height stretched through its shoulders'
    gables['stepped']['aliases']=['trap'];gables['spout']['aliases']=['tuit'];gables['triangular']['aliases']=['punt']
    gables['neck']['aliases']=['hals'];gables['bell']['aliases']=['klok'];gables['straight']['aliases']=['cornice']
    retail={
      'recessed-storefront':{'recipePath':'frontages[].storefront.recessedAssemblies[]','parameters':['id','x','width','sill','head','recess','sideReturn','frontDepth'],
                            'note':'One aperture owner with angled returns, opaque recessed glass, threshold floor and soffit'},
      'entrance-steps':{'builder':'building_lib.entrance_stairs.stair_meshes','recipePath':'frontages[].storefront.entranceSteps[]','parameters':['id','openingId','x','width','rise','run','construction','direction','landing','railHeight','colour','railColour','scope','provenance'],
                        'note':'Integrated assembly; use only with an explicitly raised entrance datum'},
      'entry-door':{'recipePath':'frontages[].openings[]','kind':'door','parameters':['x','z','width','height','head','glazingDepth'],
                    'note':'Threshold is z minus height/2, independent of image crop bounds'},
    }
    signage={
      'sign':{'recipePath':'frontages[].storefront.signs[]','parameters':['id','x','z','width','height','text','colour','anchor','substrate','letteringColour','letteringDepth','fontSize'],
              'note':'anchor=storefront uses the parent assembly anchor'},
      'awning':{'recipePath':'frontages[].storefront.awnings[]','parameters':['x','z','width','height','projection','colour','text'],
                'note':'Sloping canopy, front valance and optional bounded lettering'},
      'bicycle-sign':{'recipePath':'frontages[].bicycleSign','value':True,
                      'note':'Optional bicycle silhouette and bracket follow selected translated/rotated frontage; details.bicycleSign is a primary-frontage alias'},
    }
    warehouse={
      'loading-flank-stack':{'recipePath':'frontages[].openingPatterns[].preset=warehouse-stack',
          'parameters':['storeys','segments','startFraction','endFraction','template','loadingTemplate','flankTemplate','crestTemplate','crestLights'],
          'note':'Independent loading, small flank and crest joinery. Separate body/attic schedules for converted warehouses; balcony-stack can share central slab datums. All proportions remain inferred.'},
      'paired-shutters':{'recipePath':'frontages[].openings[].warehouse','parameters':['leafGap','shutters.angle','shutters.style','shutters.material','shutters.colour','shutters.thickness','shutters.plankWidth','shutters.hingeDepth'],
                        'styles':['plank','panel'],'note':'Exact aperture arch halves; angle 0 closed, 90 streetward, 180 folded back. Defaults omit residential sash and single-door hardware.'},
      'hoist':{'recipePath':'frontages[].warehouseHoists[]','required':['id','x','z'],'parameters':['projection','width','height','material','colour','ironMaterial','bracketDrop','rearDepth','tipRise','supportAttachmentId','supportRegion'],
               'note':'Separate frontage-local timber beam with iron brace and suspended eye; defaults are authored presets.'},
    }
    roof_details={
      'stepped-flat-parts':{'recipePath':'massing.appearanceRoof.kind=flat-stepped + parts[]',
          'parameters':['fraction','eaves','provenance'],
          'note':'Independent horizontal owner spans with shared closed step walls. At least two explicit heights; owner minimum eaves/maximum peak and street silhouette must match. No invented pitch.'},
      'flat-roof-dormers':{'recipePath':'massing.appearanceRoof.kind=flat-with-dormers + details.appearanceDormers[]',
          'parameters':['eaves','peak','x','y','width','height','depth','capStyle','capHeight','wallColour','roofColour','frameColour','provenance'],
          'note':'Body front stops at eaves; supported closed dormers own the raised volume and openings. Flat cap top reaches the selected peak. Explicit inferred support, nonoverlapping complete roof footprints required.'},
      'independent-pitched-parts':{'recipePath':'massing.appearanceRoof.parts[]',
        'parameters':['fraction','eaves','peak'],
        'note':'Adjacent behind-gable coverings can use independent heights within the owner envelope. Weld matching heights only and close step walls. Hidden pitches remain inferred; edit each scoped part in Recipe JSON.'},
      'projecting-roof-box':{'recipePath':'details.appearanceDormers[].assembly=roof-box',
        'parameters':['x','y','width','height','depth','frontProjection','baseZ','frontWindows','wallColour','frameColour','glassColour','roofColour','provenance'],
        'note':'Inferred flat roof attachment with explicit supported footprint, bounded projecting base and one to six independent normalized front windows; shared pierced cheeks and cap in both consumers.'},
      'source-roof-rail':{'recipePath':'details.sourceRails[]','parameters':['id','sourceSurfaceIndices','supportMode','sourcePatchId','derivedSurfaceIndices','points','height','postSpacing','thickness','railLevels','provenance'],
                         'note':'Exact retained selected semantic roof triangle support; every polyline interval audited before scene mutation'},
      'source-roof-dormer':{'recipePath':'details.sourceDormers[]','parameters':['id','sourceSurfaceIndices','supportMode','sourcePatchId','derivedSurfaceIndices','x','y','width','height','depth','capRise','provenance'],
                           'note':'Default flat or optional segmental curved cap, closed cheeks and real recessed aperture; whole footprint supported by selected retained semantic roof, with rear spring clearance'},
      'covering-thickness':{'recipePath':'details.coveringThickness','parameters':['thickness'],'note':'Positive layer behind the covering'},
      'gutters':{'recipePath':'details.gutters','parameters':['downpipes'],'downpipeParameters':['x','y','bottom'],'note':'Gutters follow actual horizontal covering boundary edges'},
      'chimney':{'recipePath':'details.chimney','parameters':['x','y','size','height'],'note':'Footprint corner queries bury the base in the actual covering'},
      'dormer':{'recipePath':'details.dormers[]','parameters':['x','y','width','height'],'note':'Whole 0.85m-deep footprint must be roof-supported; head clears rear support; checked before scene mutation'},
      'ridge-cap':{'recipePath':'details.ridgeCap','value':True,'roofKinds':['pitched','gambrel','hip'],
                   'note':'Positive rise and uninterrupted nonzero ridge span at roof top; checked before scene mutation'},
    }
    grouped_bays={'projecting-group':{'recipePath':'frontages[].groupedBays[]','required':['id','x','width','bottom','top','openingIds'],
                     'parameters':['construction','shellThickness','projection','returnInset','baseRise','sideWindows','sillDepth','sillProjection','capHeight','capProjection','material','colour','frameMaterial','frameColour','glassMaterial','glassColour'],
                     'note':'Solid construction retains the Boolean builder; explicit hollow construction uses shared pierced closed panels in Blender and portable export (level base, bounded .16-.29m shell thickness). Continuous projecting masonry volume across storeys, linked actual front apertures and optional glazed angled side returns. returnInset controls the angle; optional baseRise slopes the supported underside upwards towards the projecting face (default0 is flat). Dimensions remain authored unless registered.'}}
    open_frames={'open-atrium-frame':{'recipePath':'frontages[].openFrames[]','parameters':['id','x','width','bottom','top','depth','pierWidth','headHeight','backInsetLeft','backInsetRight','crossBeams','beamMaterial','beamColour','sourceRoofOpening','sourceSideOpening','provenance'],'note':'True unglazed facade/roof void, perimeter posts/head, supported crossbeam/uprights and tapered deck. Source roof/side ownership requires exact revision, indices, provenance and support audit.'},
                 'recessed-upper-panel':{'recipePath':'frontages[].recessedUpperPanels[]','parameters':['id','x','width','bottom','top','setback','cutFacade','colour','openings','provenance'],'note':'Closed setback wall with real recessed apertures, composed in the same facade frame'}}
    return {'version':VERSION,'units':'metres','facade':facade,'site':site,'openFrames':open_frames,
            'openings':openings,'warehouse':warehouse,'groupedBays':grouped_bays,'roofs':roofs,'gables':gables,'retail':retail,'signage':signage,'roofDetails':roof_details,
            'materialZones':{'rectangular':{'recipePath':'frontages[].materialZones[]','parameters':['id','x','z','width','height','material','colour','frontDepth','thickness','construction'],
                                         'note':'Exterior finish inside the wall body. Pierced construction requires wholly contained apertures. Clipped construction supports bands crossing doors, windows and arched heads, using shared closed notched boundaries in Blender and portable export. Legacy Boolean construction remains Blender-only.'}},
            'materialStyles':{'simple':{'textures':False,'roughness':.86,'glassColour':'#91a6a3'},'textured':{'textures':True,'note':'Cached portable original maps; opaque glass fallback'}},
            'contracts':['facade components use the selected frontage frame','site positions use the building frame',
                         'defaults are authored presets, not measurements','material zones share aperture cutters']}
