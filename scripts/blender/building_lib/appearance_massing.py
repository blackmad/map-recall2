"""Opt-in photo-inferred massing; immutable BAG geometry remains audit evidence."""
import copy,hashlib,json,math
from .polygons import area,cross


def pitched_covering(recipe,spec):
    """Shared analytic covering, clipped to independent adjacent roof spans."""
    from .roof_surfaces import compile_roof,_RoofMesh,clip_half_plane,silhouette_height
    front=recipe['frontages'][0];width=front['width']
    if abs(front['rotation'])>1e-8 or any(abs(v)>1e-8 for v in front['origin']):
        raise ValueError('Appearance pitches require the primary frontage coordinate frame')
    fractions=spec.get('parts',[{'fraction':1}])
    if not isinstance(fractions,list) or not fractions or any(not isinstance(p,dict) or not isinstance(p.get('fraction'),(int,float)) or isinstance(p['fraction'],bool) or not math.isfinite(p['fraction']) or p['fraction']<=0 for p in fractions) or abs(sum(p['fraction'] for p in fractions)-1)>1e-8:
        raise ValueError('Appearance roof parts require positive fractions summing to one')
    flat_steps=spec['kind']=='flat-stepped'
    if flat_steps:
        heights=[p.get('eaves') for p in fractions]
        if len(heights)<2 or any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in heights):
            raise ValueError('Stepped flat roofs require at least two explicit finite part heights')
        if min(heights)!=spec['eaves'] or max(heights)!=spec['peak'] or spec['eaves']==spec['peak']:
            raise ValueError('Stepped flat parts must reach the owner minimum eaves and maximum peak')
        if any('peak' in p and p['peak']!=p['eaves'] for p in fractions):
            raise ValueError('Flat roof parts cannot have a pitched peak')
    scoped=any('eaves' in p or 'peak' in p for p in fractions)
    mesh=_RoofMesh(weld_digits=3,weld_xy=not scoped);offset=0
    spans=[]
    for part in fractions:
        right=offset+width*part['fraction'];spans.append((offset,right,'flat' if flat_steps else 'pitched',part));offset=right
    left=min(p[0] for p in recipe['footprint']);right=max(p[0] for p in recipe['footprint'])
    if left<0:spans.append((left,0,'flat',{'eaves':fractions[0].get('eaves',spec['eaves'])}))
    if right>width:spans.append((width,right,'flat',{'eaves':fractions[-1].get('eaves',spec['eaves'])}))
    for left,right,kind,part in spans:
        eaves=part.get('eaves',spec['eaves']);peak=eaves if kind=='flat' else part.get('peak',spec['peak'])
        finite=all(isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) for v in (eaves,peak))
        ordered=finite and (spec['eaves']<=eaves<=peak<=spec['peak'] if kind=='flat' else spec['eaves']<=eaves<peak<=spec['peak'])
        if not ordered:
            raise ValueError('Scoped pitched roof heights must fit the explicit owner envelope')
        if flat_steps and 0<=left<right<=width:
            # Sample within each interval; shared step coordinates have two
            # heights and must not be interpreted as an inclined roof.
            knots=sorted({left,right,*[x for x,z in front['profile'] if left<x<right]})
            if any(abs(silhouette_height(front['profile'],(a+b)/2)-eaves)>1e-6 for a,b in zip(knots,knots[1:])):
                raise ValueError('Stepped flat roof part must match its horizontal street silhouette')
        working=copy.deepcopy(recipe)
        working['gable']['profile']=[(0,eaves),(width,eaves)]
        pitch_left,pitch_right=left,right;ridge=(left+right)/2;top=peak
        if kind=='pitched':
            # A decorative crest may rise above the covering. Bound the
            # complete pitch by the front silhouette, not just its first row,
            # so the rear roof cannot project through curved shoulders.
            knots=[left,right]+[x for x,z in front['profile'] if left<x<right]
            lows=[x for x in knots if (silhouette_height(front['profile'],x) or eaves)<=eaves+.08]
            pitch_left=max([left]+[x for x in lows if x<ridge])
            pitch_right=min([right]+[x for x in lows if x>ridge])
            limits=[top-eaves]
            for x in knots:
                if not pitch_left<x<pitch_right:continue
                fraction=(x-pitch_left)/(ridge-pitch_left) if x<=ridge else (pitch_right-x)/(pitch_right-ridge)
                limits.append(max(0,(silhouette_height(front['profile'],x)-eaves-.04)/fraction))
            top=eaves+min(limits)
            if top-eaves<.2:raise ValueError('Decorative gable leaves no useful pitched roof span')
        working['roof']={'kind':kind,'eaves':eaves,'top':top,
            'setback':min(p[1] for p in recipe['footprint']),
            'frontTransition':spec.get('frontTransition',1.5),'gableClearance':.08,'pitchSpan':[pitch_left,pitch_right],'ridgeX':ridge}
        if kind=='pitched':working['roof'].update(frontJoin='hip',frontHipRun=spec.get('frontTransition',1.5))
        surface=compile_roof(working,source_ownership=True)
        for face in surface.triangles:
            polygon=[surface.vertices[i][:2] for i in face]
            polygon=clip_half_plane(polygon,lambda p:p[0]-left)
            polygon=clip_half_plane(polygon,lambda p:right-p[0])
            if len(polygon)>=3:mesh.patch(polygon,surface.height)
    # Adjacent pitches may subdivide their common valley differently. Split
    # every triangle edge at existing coplanar vertices before extracting the
    # outer boundary, so a valley cannot become two spurious internal walls.
    original=list(mesh.triangles);vertices=list(mesh.vertices);conformed=[]
    for face in original:
        if len(set(face))<3 or abs(area([vertices[i][:2] for i in face]))<=1e-8:continue
        polygon=[]
        for ai,bi in zip(face,face[1:]+face[:1]):
            a,b=vertices[ai],vertices[bi];delta=[b[i]-a[i] for i in range(3)]
            length2=sum(v*v for v in delta);knots=[(0,ai)]
            for index,p in enumerate(vertices):
                if index in face:continue
                axes=range(2) if scoped else range(3)
                projected_length=sum(delta[i]**2 for i in axes)
                t=sum((p[i]-a[i])*delta[i] for i in axes)/projected_length
                if 1e-7<t<1-1e-7 and sum((p[i]-a[i]-t*delta[i])**2 for i in axes)<1e-12:
                    # At a height step, insert the other pitch's XY subdivision
                    # at this edge's own elevation, never weld the two heights.
                    knot=mesh.vertex(tuple(a[i]+t*delta[i] for i in range(3))) if scoped else index
                    if not any(knot==j for _,j in knots):knots.append((t,knot))
            polygon.extend(index for _,index in sorted(knots))
        if len(polygon)==3:conformed.append(tuple(polygon));continue
        centre=mesh.vertex(tuple(sum(mesh.vertices[j][i] for j in polygon)/len(polygon) for i in range(3)))
        conformed.extend((a,b,centre) for a,b in zip(polygon,polygon[1:]+polygon[:1]))
    mesh.triangles=conformed
    return mesh.surface(min(p[1] for p in recipe['footprint']),spec['eaves'])


def inset_convex(ring,distance):
    if any(cross(a,b,c)<=1e-8 for a,b,c in zip(ring,ring[1:]+ring[:1],ring[2:]+ring[:2])):
        raise ValueError('Mansard footprint must be convex; split compound owners into explicit parts')
    lines=[]
    for a,b in zip(ring,ring[1:]+ring[:1]):
        dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy)
        nx,ny=-dy/length,dx/length
        lines.append((nx,ny,nx*a[0]+ny*a[1]+distance))
    result=[]
    for i,(nx,ny,c) in enumerate(lines):
        px,py,pc=lines[i-1];det=px*ny-py*nx
        if abs(det)<1e-8:raise ValueError('Mansard footprint has parallel consecutive edges')
        point=((pc*ny-py*c)/det,(px*c-pc*nx)/det)
        if any(x*point[0]+y*point[1]<v-1e-7 for x,y,v in lines):raise ValueError('Mansard inset collapses footprint')
        result.append(point)
    return result


def appearance_shell(recipe):
    spec=recipe['massing']['appearanceRoof'];proof=spec.get('provenance',{})
    if spec.get('geometryRevision')!=recipe.get('geometryRevision') or proof.get('status')!='inferred' or not all(proof.get(k) for k in ('basis','sourcePath','captureDate')):
        raise ValueError('Appearance roof requires matching revision and dated inferred photo provenance')
    if any(recipe['massing'].get(k) for k in ('sourcePatches','sourceNormalization','baseClosure')):
        raise ValueError('Whole-owner appearance replacement cannot also apply native source patches')
    if recipe.get('details',{}).get('sourceDormers'):
        raise ValueError('Native supported dormers must be rebound to inferred appearance roof')
    ring=[tuple(p) for p in recipe['footprint']]
    if area(ring)<0:ring.reverse()
    eaves,peak=spec.get('eaves'),spec.get('peak')
    if not all(isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) for v in (eaves,peak)) or not 0<eaves<=peak:
        raise ValueError('Appearance heights must be finite positive ordered metres')
    if abs(recipe['roof']['eaves']-eaves)>1e-7 or abs(recipe['roof']['top']-peak)>1e-7:
        raise ValueError('Recipe roof datums must agree with explicit appearance heights')
    for front in recipe['frontages']:
        if max(p[1] for p in front['profile'])>peak+1e-7:
            raise ValueError('Authored frontage exceeds selected appearance peak')
    surfaces=[]
    def add(kind,points):surfaces.append({'type':kind,'rings':[points]})
    if spec['kind'] in ('behind-gable','flat-stepped'):
        roof=pitched_covering(recipe,spec)
        for face in roof.triangles:add('roof',[roof.vertices[i] for i in face])
        # Share every roof boundary subdivision with its wall, avoiding open
        # upper edges when pitches meet an irregular owner footprint.
        grouped={}
        for ai,bi in roof.boundary:
            a,b=roof.vertices[ai],roof.vertices[bi]
            key=tuple(sorted(tuple(round(v,3) for v in p[:2]) for p in (a,b)))
            grouped.setdefault(key,[]).append((a,b))
        for edges in grouped.values():
            if len(edges)==1:
                a,b=edges[0];add('wall',[(a[0],a[1],0),(b[0],b[1],0),b,a])
            elif len(edges)==2:
                a,b=edges[0];c,d=edges[1]
                if math.dist(a[:2],c[:2])<math.dist(a[:2],d[:2]):c,d=d,c
                if abs(a[2]-d[2])+abs(b[2]-c[2])>1e-7:add('wall',[b,a,d,c])
            else:raise ValueError('Scoped roof has ambiguous overlapping boundary ownership')
        if any('eaves' in p or 'peak' in p for p in spec.get('parts',[])):
            # Close the ends of a party-wall step: outer vertical wall edges
            # must split at both neighboring eave heights.
            vertices=[p for s in surfaces for p in s['rings'][0]]
            for surface in surfaces:
                ring=surface['rings'][0];conformed=[]
                for a,b in zip(ring,ring[1:]+ring[:1]):
                    delta=[b[i]-a[i] for i in range(3)];length=sum(v*v for v in delta);knots={tuple(round(v,3) for v in a):(0,a)}
                    for p in vertices:
                        t=sum((p[i]-a[i])*delta[i] for i in range(3))/length
                        if 1e-7<t<1-1e-7 and sum((p[i]-a[i]-t*delta[i])**2 for i in range(3))<1e-12:
                            key=tuple(round(v,3) for v in p)
                            if key!=tuple(round(v,3) for v in b):knots[key]=(t,p)
                    conformed.extend(p for t,p in sorted(knots.values()))
                surface['rings'][0]=conformed
        return {'surfaces':surfaces}
    for a,b in zip(ring,ring[1:]+ring[:1]):
        add('wall',[(a[0],a[1],0),(b[0],b[1],0),(b[0],b[1],eaves),(a[0],a[1],eaves)])
    if spec['kind'] in ('flat','behind-parapet','flat-with-dormers'):
        if spec['kind']=='flat' and peak!=eaves:raise ValueError('Flat appearance roof requires equal eaves and peak')
        if spec['kind']=='flat-with-dormers':
            if not recipe.get('details',{}).get('appearanceDormers') or peak<=eaves:
                raise ValueError('Flat roof with dormers requires explicit attachments above eaves')
            if any(raw.get('supportMode')!='inferred-appearance-roof' for raw in recipe['details']['appearanceDormers']):
                raise ValueError('Flat dormers require explicit inferred appearance support')
            if any(max(z for _,z in f['profile'])>eaves+1e-7 for f in recipe['frontages']):
                raise ValueError('Flat roof dormers own the raised volume; body frontage must stop at eaves')
        if spec['kind']=='behind-parapet' and abs(max(p[1] for f in recipe['frontages'] for p in f['profile'])-peak)>1e-7:
            raise ValueError('Parapet appearance peak must be reached by an authored frontage')
        add('roof',[(x,y,eaves) for x,y in ring])
    elif spec['kind']=='mansard':
        knee,deck,kz=(spec.get(k) for k in ('kneeInset','topInset','kneeHeight'))
        if not all(isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) for v in (knee,deck,kz)) or not 0<knee<deck or not eaves<kz<peak or (kz-eaves)/knee<=(peak-kz)/(deck-knee):
            raise ValueError('Mansard requires ordered insets/heights and steeper lower pitch')
        courses=[[(x,y,z) for x,y in points] for points,z in ((ring,eaves),(inset_convex(ring,knee),kz),(inset_convex(ring,deck),peak))]
        for outer,inner in zip(courses,courses[1:]):
            for i in range(len(ring)):add('roof',[outer[i],outer[(i+1)%len(ring)],inner[(i+1)%len(ring)],inner[i]])
        add('roof',courses[-1])
    else:raise ValueError('Appearance roof currently supports flat, flat-stepped, flat-with-dormers, behind-parapet, behind-gable and convex mansard')
    return {'surfaces':surfaces}


def compile_appearance_massing(recipe,exclude_attachment_voids=False):
    from .source_massing import compile_source_massing,_subtract_convex,_triangles
    derived=copy.deepcopy(recipe);derived['sourceShell']=appearance_shell(recipe)
    derived['massing']={'mode':'source-derived'}
    derived['details'].pop('appearanceDormers',None)
    for front in derived['frontages']:front.pop('sourceWallSelection',None)
    compiled=compile_source_massing(derived)
    if not exclude_attachment_voids:
        from .source_attachments import dormer_plan
        regions=[]
        for raw in recipe.get('details',{}).get('appearanceDormers',[]):
            p=dormer_plan(recipe,raw);x,y,w,d=p['x'],p['y'],p['width'],p['depth']
            regions.append([(x-w/2,y),(x+w/2,y),(x+w/2,y+d),(x-w/2,y+d)])
        if recipe['massing']['appearanceRoof']['kind']=='flat-with-dormers':
            plans=[dormer_plan(recipe,raw) for raw in recipe['details']['appearanceDormers']]
            if any(p['capRise'] for p in plans) or abs(max(p['capTop'] for p in plans)-recipe['roof']['top'])>1e-7:
                raise ValueError('Dormer caps must reach the explicit appearance peak; legacy curved caps are unsupported here')
            for i,a in enumerate(plans):
                for b in plans[i+1:]:
                    if min((a['width']+b['width'])/2-abs(a['x']-b['x']),min(a['frontY']+a['bodyDepth'],b['frontY']+b['bodyDepth'])-max(a['frontY'],b['frontY']))>1e-7:
                        raise ValueError('Flat dormers cannot own overlapping roof footprints')
        for surface in compiled.surfaces:
            if surface['type']!='roof':continue
            vertices=[];faces=[]
            for face in surface['triangles']:
                pieces=[[surface['vertices'][i] for i in face]]
                for region in regions:pieces=[piece for poly in pieces for piece in _subtract_convex(poly,region,lambda p:p[:2])]
                for poly in pieces:
                    try:triangles,_=_triangles(poly,.03)
                    except ValueError as error:
                        if str(error) not in ('Source surface is degenerate','Degenerate polygon'):raise
                        continue
                    offset=len(vertices);vertices.extend(poly);faces.extend(tuple(offset+i for i in face) for face in triangles)
            surface.update(vertices=vertices,triangles=faces)
    compiled.audit.update(sourceGeometryMode='inferred-appearance-replaced',nativePeakPreserved=False,
        originalSourceSHA256=hashlib.sha256(json.dumps(recipe['sourceShell'],sort_keys=True,separators=(',',':')).encode()).hexdigest(),
        originalSourceSurfaceCount=len(recipe['sourceShell']['surfaces']),appearanceRoof=copy.deepcopy(recipe['massing']['appearanceRoof']),
        roofOwnership='Entire displayed owner shell replaced by photo-inferred footprint-based appearance; raw sourceShell unchanged')
    return compiled
