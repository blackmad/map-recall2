"""Explicit inferred semantic replacements with exact immutable source boundaries."""
import copy,math,json,hashlib
from collections import Counter


def _edges(surfaces):
    directed=Counter()
    for surface in surfaces:
        for ring in surface['rings']:
            points=[tuple(p) for p in ring]
            if len(points)>1 and points[-1]==points[0]:points.pop()
            for a,b in zip(points,points[1:]+points[:1]):
                if a==b:raise ValueError('Patch surfaces require nonzero exact edges')
                directed[a,b]+=1
    if any(n>1 for n in directed.values()):raise ValueError('Patch has duplicate directed edges')
    boundary={edge:n-directed.get((edge[1],edge[0]),0) for edge,n in directed.items() if n>directed.get((edge[1],edge[0]),0)}
    if not boundary:raise ValueError('Source patch requires an explicit preserved interface boundary')
    return boundary



def _check_boundary_connected(surfaces, boundary):
    """Every edge-connected replacement component must meet the source interface."""
    owners = {}
    for index, surface in enumerate(surfaces):
        for ring in surface['rings']:
            points = [tuple(p) for p in ring]
            if points[-1] == points[0]:
                points.pop()
            for a, b in zip(points, points[1:] + points[:1]):
                owners.setdefault(tuple(sorted((a, b))), set()).add(index)
    neighbors = [set() for _ in surfaces]
    for indices in owners.values():
        for index in indices:
            neighbors[index].update(indices - {index})
    reached = set()
    pending = []
    for a, b in boundary:
        pending.extend(owners[tuple(sorted((a, b)))])
    while pending:
        index = pending.pop()
        if index not in reached:
            reached.add(index)
            pending.extend(neighbors[index] - reached)
    if len(reached) != len(surfaces):
        raise ValueError('Source patch has replacement components disconnected from preserved interface')


def apply_source_patches(recipe):
    source=copy.deepcopy(recipe.get('sourceShell',{}));patches=recipe.get('massing',{}).get('sourcePatches',[])
    if not isinstance(patches,list):raise ValueError('Source patches must be a list')
    if not patches:return source,set(),[]
    from .source_massing import _tessellate_rings,_contains
    original=recipe['sourceShell']['surfaces'];excluded=set();audit=[];ids=set()
    points=[p for s in original for ring in s['rings'] for p in ring];bottom=min(p[2] for p in points);top=max(p[2] for p in points)
    original_points={tuple(p) for p in points}
    def areas(surfaces):
        result=Counter()
        for s in surfaces:
            if s.get('type') not in ('wall','roof','ground'):raise ValueError('Patch has unsupported semantic surface type')
            rings=s.get('rings')
            if not isinstance(rings,list) or not rings:raise ValueError('Patch surface requires rings')
            for ring in rings:
                if not isinstance(ring,list) or len(ring)<3 or any(not isinstance(p,(list,tuple)) or len(p)!=3 or any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in p) for p in ring):raise ValueError('Patch requires finite 3D rings')
            vertices,faces,_=_tessellate_rings(rings,.03)
            value=0.
            for face in faces:
                a,b,c=[vertices[i] for i in face];u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
                value+=math.sqrt(sum((u[(k+1)%3]*v[(k+2)%3]-u[(k+2)%3]*v[(k+1)%3])**2 for k in range(3)))/2
            if value<=1e-10:raise ValueError('Patch has zero area surface')
            result[s['type']]+=value
        return dict(result)
    for patch in patches:
        if not isinstance(patch,dict) or patch.get('mode')!='inferred-appearance' or patch.get('geometryRevision')!=recipe.get('geometryRevision'):raise ValueError('Source patch requires inferred-appearance mode and matching geometryRevision')
        identifier=patch.get('id');provenance=patch.get('provenance')
        if not isinstance(identifier,str) or not identifier.strip() or identifier in ids:raise ValueError('Source patch requires unique id')
        ids.add(identifier)
        if not isinstance(provenance,dict) or any(not isinstance(provenance.get(k),str) or not provenance[k].strip() for k in ('basis','note')) or not isinstance(provenance.get('evidenceKeys'),list) or not provenance['evidenceKeys'] or any(not isinstance(k,str) or not k.strip() for k in provenance['evidenceKeys']):raise ValueError('Source patch requires explicit provenance and evidence keys')
        indices=patch.get('surfaceIndices');replacements=patch.get('replacementSurfaces')
        if not isinstance(indices,list) or not indices or any(isinstance(i,bool) or not isinstance(i,int) or not 0<=i<len(original) for i in indices) or len(set(indices))!=len(indices) or excluded.intersection(indices):raise ValueError('Source patch requires unique nonoverlapping original surface indices')
        if not isinstance(replacements,list) or not replacements:raise ValueError('Source patch requires explicit replacement surfaces')
        removed=[original[i] for i in indices];old_area=areas(removed);new_area=areas(replacements)
        old_boundary=_edges(removed);new_boundary=_edges(replacements)
        if old_boundary!=new_boundary:raise ValueError('Source patch changed exact directed interface boundary')
        _check_boundary_connected(replacements, old_boundary)
        added={tuple(p) for s in replacements for ring in s['rings'] for p in ring}-original_points
        selected_points=[p for s in removed for ring in s['rings'] for p in ring]
        envelope={'min':[min(p[k] for p in selected_points) for k in range(3)],'max':[max(p[k] for p in selected_points) for k in range(3)]}
        if any(any(p[k]<envelope['min'][k] or p[k]>envelope['max'][k] for k in range(3)) for p in added):raise ValueError('Source patch vertex exceeds selected source envelope')
        original_xy={tuple(p[:2]) for p in points};footprint=recipe['footprint']
        def in_owner(p):
            if tuple(p[:2]) in original_xy:return True
            if _contains(footprint,p[:2]):return True
            for a,b in zip(footprint,footprint[1:]+footprint[:1]):
                dx,dy=b[0]-a[0],b[1]-a[1];length=dx*dx+dy*dy
                if not length:continue
                u=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length
                if 0<=u<=1 and math.hypot(p[0]-a[0]-u*dx,p[1]-a[1]-u*dy)<1e-9:return True
            return False
        if any(not in_owner(p) for p in added):raise ValueError('Source patch vertex lies outside owner footprint')
        if any(p[2]<bottom or p[2]>top for p in added):raise ValueError('Source patch changed owner vertical anchors')
        if any(p[2]==bottom for p in added):raise ValueError('Source patch introduced ground vertices; source footprint anchors must remain exact')
        retained=[s for i,s in enumerate(original) if i not in excluded and i not in indices]
        prior_replacements=source['surfaces'][len(original):]
        effective_points=[p for s in retained+prior_replacements+replacements for ring in s['rings'] for p in ring]
        if min(p[2] for p in effective_points)!=bottom or max(p[2] for p in effective_points)!=top:
            raise ValueError('Source patch removed owner vertical anchors')
        slots=list(range(len(source['surfaces']),len(source['surfaces'])+len(replacements)))
        source['surfaces'].extend(copy.deepcopy(replacements));excluded.update(indices)
        audit.append({'id':identifier,'mode':'inferred-appearance','geometryRevision':patch['geometryRevision'],'sourceSurfaceIndices':indices,
                      'replacementSurfaceIndices':slots,'originalSurfaces':copy.deepcopy(removed),'replacementSurfaces':copy.deepcopy(replacements),
                      'removedAreaM2ByType':old_area,'replacementAreaM2ByType':new_area,'addedCoordinates':[list(p) for p in sorted(added)],
                      'preservedDirectedBoundaryEdges':[[list(a),list(b)] for a,b in sorted(old_boundary)],
                      'selectedSourceEnvelope':envelope,'replacementEnvelopeBounded':True,'originalSourceDigest':hashlib.sha256(json.dumps(recipe['sourceShell'],sort_keys=True,separators=(',',':')).encode()).hexdigest(),'replacementComponentsMeetInterface':True,'exactDirectedBoundaryPreserved':True,'sourceFootprintAnchorsPreserved':True,'ownerVerticalAnchorsPreserved':True,
                      'provenance':copy.deepcopy(provenance)})
    return source,excluded,audit
