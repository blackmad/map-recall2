"""Measured semantic massing, with explicit authored frontage ownership.

The original sourceShell remains an audit input. This compiler triangulates its
separately tagged derived shell, closes only audited ground loops, and subtracts
only wall regions owned by authored facade slabs. Source roofs stay measured.
"""
from collections import Counter,defaultdict
from dataclasses import dataclass
import math
from .polygons import area,triangulate,cross
from .layout import SURFACES

TOLERANCE=.001

def _key(point):return tuple(round(v,3) for v in point)
def _finite(value):return isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)

def frontage_profile(recipe,front):
    if 'profile' in front:return front['profile']
    eaves=front.get('eaves',recipe['roof']['eaves'])
    return recipe['gable']['profile'] if front is recipe['frontages'][0] else [(0,eaves),(front['width'],eaves)]

def _normal(points):
    result=[0.,0.,0.]
    for a,b in zip(points,points[1:]+points[:1]):
        result[0]+=(a[1]-b[1])*(a[2]+b[2]);result[1]+=(a[2]-b[2])*(a[0]+b[0]);result[2]+=(a[0]-b[0])*(a[1]+b[1])
    length=math.sqrt(sum(v*v for v in result))
    if length<1e-9:raise ValueError('Source surface is degenerate')
    return [v/length for v in result]

def _triangles(points,max_deviation):
    normal=_normal(points)
    deviation=max(abs(sum(normal[k]*(p[k]-points[0][k]) for k in range(3))) for p in points)
    if deviation>max_deviation:raise ValueError('Source surface exceeds allowed planarity deviation')
    axis=max(range(3),key=lambda k:abs(normal[k]));axes=[k for k in range(3) if k!=axis]
    faces=triangulate([[p[k] for k in axes] for p in points])
    # The projection's CCW triangles must follow the original 3D winding.
    sign=normal[axis]*(-1 if axis==1 else 1)
    if sign<0:faces=[tuple(reversed(face)) for face in faces]
    return faces,deviation

def _contains(ring,point):
    x,y=point[:2];inside=False
    for a,b in zip(ring,ring[1:]+ring[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:inside=not inside
    return inside

def _tessellate_rings(rings,max_deviation):
    """Bridge contained hole rings without filling or moving source vertices."""
    if len(rings)==1:
        faces,error=_triangles(rings[0],max_deviation)
        return rings[0],faces,error
    normal=_normal(rings[0]);axis=max(range(3),key=lambda k:abs(normal[k]));axes=[k for k in range(3) if k!=axis]
    points=[p for ring in rings for p in ring];projected=[[p[k] for k in axes] for p in points]
    error=max(abs(sum(normal[k]*(p[k]-points[0][k]) for k in range(3))) for p in points)
    if error>max_deviation:raise ValueError('Source surface exceeds allowed planarity deviation')
    indices=[];start=0
    for ring in rings:
        row=list(range(start,start+len(ring)));start+=len(ring);indices.append(row)
    if area([projected[i] for i in indices[0]])<0:indices[0].reverse()
    for hole in indices[1:]:
        if area([projected[i] for i in hole])>0:hole.reverse()
    boundaries=[[projected[i] for i in row] for row in indices]
    if any(not _contains(boundaries[0],hole[0]) for hole in boundaries[1:]):raise ValueError('Source hole lies outside its outer ring')
    if any(_contains(a,b[0]) for a in boundaries[1:] for b in boundaries[1:] if a is not b):raise ValueError('Source hole rings overlap or nest')
    def intersects(a,b,c,d):
        if any(math.dist(p,q)<1e-8 for p in (a,b) for q in (c,d)):return False
        ac,ad=cross(a,b,c),cross(a,b,d);ca,cb=cross(c,d,a),cross(c,d,b)
        return ac*ad<-1e-12 and ca*cb<-1e-12
    merged=list(indices[0]);bridges=[]
    for hole in sorted(indices[1:],key=lambda row:max(projected[i][0] for i in row),reverse=True):
        h=max(range(len(hole)),key=lambda k:projected[hole[k]][0]);hp=projected[hole[h]]
        candidates=[]
        for j,index in enumerate(merged):
            target=projected[index];middle=[(hp[k]+target[k])/2 for k in range(2)]
            if not _contains(boundaries[0],middle) or any(_contains(ring,middle) for ring in boundaries[1:]):continue
            if any(intersects(hp,target,a,b) for ring in boundaries for a,b in zip(ring,ring[1:]+ring[:1])):continue
            if any(intersects(hp,target,a,b) for a,b in bridges):continue
            candidates.append((math.dist(hp,target),j))
        if not candidates:raise ValueError('Source hole has no supported visible bridge')
        j=min(candidates)[1];row=hole[h:]+hole[:h+1]
        bridges.append((hp,projected[merged[j]]))
        merged=merged[:j+1]+row+[merged[j]]+merged[j+1:]
    remaining=merged[:];faces=[]
    while len(remaining)>3:
        ear=None
        for j,b in enumerate(remaining):
            a,c=remaining[j-1],remaining[(j+1)%len(remaining)]
            if cross(projected[a],projected[b],projected[c])<=1e-9:continue
            blocked=False
            for k in remaining:
                if any(math.dist(projected[k],projected[v])<1e-8 for v in (a,b,c)):continue
                if all(cross(projected[u],projected[v],projected[k])>=-1e-9 for u,v in ((a,b),(b,c),(c,a))):blocked=True;break
            if blocked:continue
            ear=j;faces.append((a,b,c));break
        if ear is None:raise ValueError('Unsupported source hole tessellation or intersecting rings')
        remaining.pop(ear)
    faces.append(tuple(remaining))
    expected=abs(area(boundaries[0]))-sum(abs(area(ring)) for ring in boundaries[1:])
    actual=sum(abs(area([projected[i] for i in face])) for face in faces)
    if expected<=0 or abs(actual-expected)>max(1e-7,expected*1e-7):raise ValueError('Source hole tessellation failed area preservation')
    for face in faces:
        centroid=[sum(projected[i][k] for i in face)/3 for k in range(2)]
        if any(_contains(ring,centroid) for ring in boundaries[1:]):raise ValueError('Source tessellation covers a hole')
    if normal[axis]*(-1 if axis==1 else 1)<0:faces=[tuple(reversed(face)) for face in faces]
    return points,faces,error

def _clip(polygon,distance,inside=True):
    result=[]
    for a,b in zip(polygon,polygon[1:]+polygon[:1]):
        da,db=distance(a),distance(b)
        ina,inb=(da>=-1e-9,db>=-1e-9) if inside else (da<=1e-9,db<=1e-9)
        if ina:result.append(a)
        if ina!=inb:
            t=da/(da-db)
            result.append(tuple(a[k]+t*(b[k]-a[k]) for k in range(3)))
    clean=[]
    for point in result:
        if not clean or math.dist(point,clean[-1])>1e-8:clean.append(point)
    if len(clean)>1 and math.dist(clean[0],clean[-1])<1e-8:clean.pop()
    return clean

def _subtract_convex(polygon,region,coordinates):
    """Partition a source triangle around one convex ownership triangle."""
    if area(region)<0:region=list(reversed(region))
    remaining=polygon;outside=[]
    for a,b in zip(region,region[1:]+region[:1]):
        distance=lambda point:cross(a,b,coordinates(point))
        piece=_clip(remaining,distance,False) if any(distance(p)<-1e-9 for p in remaining) else []
        if len(piece)>=3:outside.append(piece)
        remaining=_clip(remaining,distance,True)
        if len(remaining)<3:break
    return outside

def _retained_roof(recipe,points,front):
    """Facade's closed top return owns any coincident roof inside its slab."""
    outline=[(0,0),(front['width'],0)]+list(reversed(frontage_profile(recipe,front)))
    pieces=[points]
    for face in triangulate(outline):
        region=[outline[i] for i in face]
        if area(region)<0:region.reverse()
        distances=[lambda p:_local(p,front)[1]-SURFACES['shell_front'],
                   lambda p:SURFACES['shell_back']-_local(p,front)[1]]
        for a,b in zip(region,region[1:]+region[:1]):
            distances.append(lambda p,a=a,b=b:cross(a,b,(_local(p,front)[0],p[2])))
        outside=[]
        for poly in pieces:
            remaining=poly
            for distance in distances:
                piece=_clip(remaining,distance,False) if any(distance(p)<-1e-9 for p in remaining) else []
                if len(piece)>=3:outside.append(piece)
                remaining=_clip(remaining,distance,True)
                if len(remaining)<3:break
        pieces=outside
    return pieces

def _local(point,front):
    x,y,z=point;ox,oy=front['origin'];angle=front.get('rotation',0)
    return ((x-ox)*math.cos(angle)+(y-oy)*math.sin(angle),
            -(x-ox)*math.sin(angle)+(y-oy)*math.cos(angle),z)

def _retained_wall(recipe,points,front,tolerance,surface_index):
    local=[_local(p,front) for p in points]
    selection=front.get('sourceWallSelection')
    if selection and surface_index not in selection['surfaceIndices']:return [points]
    if selection or all(abs(p[1])<=tolerance for p in local):
        ownership=selection.get('ownershipProfile') if selection else None
        outline=[(0,0),(front['width'],0)]+list(reversed(ownership or frontage_profile(recipe,front)))
        coordinates=lambda p:(_local(p,front)[0],p[2])
    else:
        end=next((end for end in (0,front['width']) if all(abs(p[0]-end)<=tolerance for p in local)),None)
        if end is None:return [points]
        profile=frontage_profile(recipe,front)
        z=profile[0][1] if end==0 else profile[-1][1]
        outline=[(SURFACES['shell_front'],0),(SURFACES['shell_back'],0),
                 (SURFACES['shell_back'],z),(SURFACES['shell_front'],z)]
        coordinates=lambda p:(_local(p,front)[1],p[2])
    pieces=[points]
    for face in triangulate(outline):
        region=[outline[i] for i in face]
        pieces=[piece for poly in pieces for piece in _subtract_convex(poly,region,coordinates)]
    return pieces

def _loops(boundary,positions):
    neighbors=defaultdict(set)
    for a,b in boundary:neighbors[a].add(b);neighbors[b].add(a)
    if any(len(values)!=2 for values in neighbors.values()):raise ValueError('Source boundary is not a simple closed ground loop')
    pending=set(neighbors);loops=[]
    while pending:
        start=min(pending);ring=[];previous=None;point=start
        while True:
            ring.append(positions[point]);pending.discard(point)
            candidate=next(p for p in sorted(neighbors[point]) if p!=previous)
            previous,point=point,candidate
            if point==start:break
            if point not in pending:raise ValueError('Source boundary loops intersect')
        if len(ring)<3:raise ValueError('Source ground loop is degenerate')
        loops.append(ring)
    return loops

@dataclass
class SourceMassing:
    surfaces:list
    audit:dict


def compile_source_massing(recipe,exclude_attachment_voids=False):
    options=recipe.get('massing',{})
    if options.get('mode')!='source-derived':raise ValueError('Unsupported massing mode')
    if options.get('appearanceRoof'):
        from .appearance_massing import compile_appearance_massing
        return compile_appearance_massing(recipe,exclude_attachment_voids)
    from .source_patches import apply_source_patches
    source,patch_excluded,patch_audit=apply_source_patches(recipe)
    from .source_normalization import normalize_source_shell
    source,normalization_audit=normalize_source_shell(source,recipe.get('geometryRevision'),options.get('sourceNormalization'))
    excluded_source_indices=patch_excluded|{row['surfaceIndex'] for row in normalization_audit['excludedSurfaces']}
    if not source.get('surfaces'):raise ValueError('Source-derived massing requires sourceShell surfaces')
    tolerance=options.get('frontageTolerance',.04);deviation=options.get('maxPlanarityDeviation',.03)
    if not all(_finite(v) and 0<v<=.05 for v in (tolerance,deviation)):
        raise ValueError('Source tolerances must be positive finite metres no greater than 0.05')
    if not recipe.get('geometryRevision'):raise ValueError('Source-derived massing requires geometryRevision')
    for front in recipe['frontages']:
        selection=front.get('sourceWallSelection')
        if selection is None:continue
        if not isinstance(selection,dict) or selection.get('geometryRevision')!=recipe['geometryRevision']:
            raise ValueError('Source frontage selection requires matching geometryRevision')
        if any(i in excluded_source_indices for i in selection.get('surfaceIndices',[]) if isinstance(i,int)):
            raise ValueError('Source frontage selection refers to excluded source surface')
        provenance=selection.get('provenance')
        if not isinstance(provenance,dict) or any(not isinstance(provenance.get(k),str) or not provenance[k].strip() for k in ('basis','note')):
            raise ValueError('Source frontage selection requires nonempty provenance basis and note')
        indices=selection.get('surfaceIndices');depth=selection.get('depthRange')
        if not isinstance(indices,list) or not indices or any(isinstance(i,bool) or not isinstance(i,int) or not 0<=i<len(source['surfaces']) for i in indices) or len(set(indices))!=len(indices):
            raise ValueError('Source frontage selection requires unique valid surface indices')
        if not isinstance(depth,list) or len(depth)!=2 or not all(_finite(v) for v in depth) or depth[0]>depth[1]:
            raise ValueError('Source frontage selection requires finite ordered local depthRange')
        ownership=selection.get('ownershipProfile')
        if ownership is not None:
            maximum=max(p[2] for i in indices for ring in source['surfaces'][i]['rings'] for p in ring)
            if (not isinstance(ownership,list) or len(ownership)<2 or any(not isinstance(p,(list,tuple)) or len(p)!=2 or not all(_finite(v) for v in p) or not 0<p[1]<=maximum+.01 for p in ownership)
                or abs(ownership[0][0])>1e-7 or abs(ownership[-1][0]-front['width'])>1e-7 or any(a[0]>b[0] for a,b in zip(ownership,ownership[1:]))):
                raise ValueError('Source ownership profile requires ordered facade extent below selected source wall top')
        for index in indices:
            surface=source['surfaces'][index]
            if surface.get('type')!='wall':raise ValueError('Source frontage selection can own only wall surfaces')
            if any(not depth[0]-1e-7<=_local(p,front)[1]<=depth[1]+1e-7 for ring in surface['rings'] for p in ring):
                raise ValueError('Selected source wall lies outside explicit frontage depthRange')
    positions={};edges=Counter();original=[];maximum=0.
    for index,surface in enumerate(source['surfaces']):
        if index in excluded_source_indices:continue
        if surface.get('type') not in ('wall','roof','ground'):raise ValueError('Unsupported semantic source surface type')
        rings=surface.get('rings',[])
        if not rings:raise ValueError('Source surface requires outer ring')
        cleaned=[]
        for ring in rings:
            points=[tuple(p) for p in ring]
            if len(points)>1 and points[0]==points[-1]:points.pop()
            if len(points)<3 or any(len(p)!=3 or not all(_finite(v) for v in p) for p in points):raise ValueError('Source surface requires finite 3D vertices')
            for a,b in zip(points,points[1:]+points[:1]):
                ka,kb=_key(a),_key(b)
                if ka==kb:raise ValueError('Source edge collapses at millimetre audit tolerance')
                positions.setdefault(ka,a);positions.setdefault(kb,b);edges[tuple(sorted((ka,kb)))]+=1
            cleaned.append(points)
        points,faces,error=_tessellate_rings(cleaned,deviation);maximum=max(maximum,error)
        original.append({'index':index,'type':surface['type'],'vertices':points,'triangles':faces})
    if any(count>2 for count in edges.values()):raise ValueError('Source shell has nonmanifold shared edges')
    boundary=[edge for edge,count in edges.items() if count==1]
    loops=_loops(boundary,positions) if boundary else []
    ground=min(p[2] for p in positions.values())
    from .source_base_closure import audit_base_closure
    base_audit=audit_base_closure(recipe,loops,ground)
    from .open_frames import audit_source_roof_openings
    audit_source_roof_openings(recipe,original)
    from .open_frames import audit_source_frame_sides
    side_audit=audit_source_frame_sides(recipe,original)
    dormers=[];dormer_ids=set()
    if not exclude_attachment_voids:
        from .source_attachments import dormer_plan
        for raw in recipe.get('details',{}).get('sourceDormers',[]):
            plan=dormer_plan(recipe,raw)
            if plan['id'] in dormer_ids:raise ValueError('Source dormers require unique ids')
            dormer_ids.add(plan['id'])
            region=[(plan['x']-plan['width']/2,plan['y']),(plan['x']+plan['width']/2,plan['y']),
                    (plan['x']+plan['width']/2,plan['y']+plan['depth']),(plan['x']-plan['width']/2,plan['y']+plan['depth'])]
            for other,_,_ in dormers:
                if min(plan['x']+plan['width']/2,other['x']+other['width']/2)>max(plan['x']-plan['width']/2,other['x']-other['width']/2)+1e-8 and min(plan['y']+plan['depth'],other['y']+other['depth'])>max(plan['y'],other['y'])+1e-8:
                    raise ValueError('Source dormer ownership footprints overlap')
            indices=raw.get('derivedSurfaceIndices') if raw.get('supportMode')=='inferred-appearance-patch' else raw['sourceSurfaceIndices']
            dormers.append((plan,region,indices))
    dormer_owned={plan['id']:0. for plan,_,_ in dormers}
    removed=0;derived=[];owned={front['id']:0. for front in recipe['frontages']};roof_clipped=0
    for surface in original:
        if surface['type']=='ground':derived.append(surface);continue
        vertices=[];faces=[]
        for face in surface['triangles']:
            pieces=[[surface['vertices'][i] for i in face]]
            for front in recipe['frontages']:
                if surface['type']=='roof':
                    pieces=[piece for poly in pieces for piece in _retained_roof(recipe,poly,front)]
                    from .open_frames import roof_region
                    for raw in front.get('openFrames',[]):
                        opening=raw.get('sourceRoofOpening')
                        if not isinstance(opening,dict) or opening.get('geometryRevision')!=recipe['geometryRevision'] or not isinstance(opening.get('provenance'),dict) or not opening['provenance'].get('basis'):
                            raise ValueError('Source open frame roof ownership requires revision and provenance')
                        indices=opening.get('surfaceIndices')
                        if not isinstance(indices,list) or not indices or any(not isinstance(i,int) or isinstance(i,bool) or not 0<=i<len(source['surfaces']) or source['surfaces'][i]['type']!='roof' for i in indices):
                            raise ValueError('Source open frame roof ownership requires valid roof surface indices')
                        if surface['index'] in indices:
                            region=roof_region(raw,front,front.get('eaves',recipe['roof']['eaves']))
                            pieces=[piece for poly in pieces for piece in _subtract_convex(poly,region,lambda p:_local(p,front)[:2])]
                    continue
                before=sum(abs(area([(_local(p,front)[0],p[2]) for p in poly])) for poly in pieces)
                pieces=[piece for poly in pieces for piece in _retained_wall(recipe,poly,front,tolerance,surface['index'])]
                from .open_frames import retain_source_frame_side
                pieces=[piece for poly in pieces for piece in retain_source_frame_side(recipe,poly,front,surface['index'])]
                after=sum(abs(area([(_local(p,front)[0],p[2]) for p in poly])) for poly in pieces)
                owned[front['id']]+=max(0,before-after)
            if surface['type']=='roof':
                for plan,region,indices in dormers:
                    if surface['index'] not in indices:continue
                    before=sum(abs(area([p[:2] for p in poly])) for poly in pieces)
                    pieces=[piece for poly in pieces for piece in _subtract_convex(poly,region,lambda p:p[:2])]
                    after=sum(abs(area([p[:2] for p in poly])) for poly in pieces)
                    dormer_owned[plan['id']]+=max(0,before-after)
            for poly in pieces:
                try:triangles,_=_triangles(poly,deviation)
                except ValueError as error:
                    # Ownership clipping can leave zero-area boundary slivers.
                    if str(error) not in ('Source surface is degenerate','Degenerate polygon'):raise
                    continue
                start=len(vertices);vertices.extend(poly);faces.extend(tuple(start+i for i in tri) for tri in triangles)
        if surface['type']=='roof':roof_clipped+=int(len(vertices)!=len(surface['vertices']) or faces!=surface['triangles'])
        if faces:derived.append({'index':surface['index'],'type':surface['type'],'vertices':vertices,'triangles':faces})
        elif surface['type']=='wall':removed+=1
    if any(value<=1e-6 for value in owned.values()):raise ValueError('Authored frontage has no matching physical source wall ownership')
    parents={index:[j for j,other in enumerate(loops) if j!=index and _contains(other,ring[0])] for index,ring in enumerate(loops)}
    for index,ring in enumerate(loops):
        if len(parents[index])%2:continue
        holes=[loop for j,loop in enumerate(loops) if len(parents[j])==len(parents[index])+1 and index in parents[j]]
        points,faces,_=_tessellate_rings([ring]+holes,deviation)
        # Base normals point down, regardless of boundary traversal order.
        if _normal(ring)[2]>0:faces=[tuple(reversed(face)) for face in faces]
        derived.append({'index':None,'type':'ground','vertices':points,'triangles':faces,'groundLoop':index})
    return SourceMassing(derived,{'sourcePatches':patch_audit,'sourceGeometryMode':'inferred-appearance-patched' if patch_audit else 'source-retained','sourceNormalization':normalization_audit,'sourceSurfaceCount':len(original),'sourceRoofCount':sum(s['type']=='roof' for s in original),
                                 'groundBoundaryEdges':len(boundary),'groundLoopsClosed':len(loops),
                                 'baseClosure':base_audit,
                                 'openFrameSideOwnership':side_audit,
                                 'maxPlanarityDeviationM':maximum,'removedOwnedWallSurfaces':removed,
                                 'roofOwnership':('explicit inferred appearance replacements plus measured unowned triangles; facade slabs clip owned fragments' if patch_audit else 'measured triangles retained except fragments inside closed authored facade slab'),
                                 'sourceRoofTessellatedCount':roof_clipped,'sourceDormerOwnedProjectedAreaM2':dormer_owned,
                                 'frontageOwnedAreaM2':owned,'sourceClosedAboveGround':True,
                                 'finalAssemblyWatertight':'not asserted; authored facade joints and apertures are separate'})


def build_source_massing(recipe,wall,roof):
    from .geometry import mesh
    import json
    compiled=compile_source_massing(recipe);objects=[]
    for surface in compiled.surfaces:
        suffix=str(surface['index']) if surface['index'] is not None else 'ground-'+str(surface['groundLoop'])
        obj=mesh('Massing / source-derived '+surface['type']+' '+suffix,surface['vertices'],surface['triangles'],roof if surface['type']=='roof' else wall)
        obj['sourceDerived']=True;obj['sourceSurfaceIndex']=surface['index'] if surface['index'] is not None else -1
        obj['geometryRevision']=recipe['geometryRevision'];obj['sourceGeometry']=recipe['sourceShell'].get('source','semantic source geometry')
        obj['massingAudit']=json.dumps(compiled.audit);objects.append(obj)
    return objects
