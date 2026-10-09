"""Revision-bound basal loop exceptions; default source audit stays strict."""
import hashlib,json,math
from .attachment_contracts import finite


def loop_signature(ring):
    keys=[tuple(round(v*1000) for v in p) for p in ring]
    rotations=[keys[i:]+keys[:i] for i in range(len(keys))]
    reverse=list(reversed(keys));rotations += [reverse[i:]+reverse[:i] for i in range(len(keys))]
    return hashlib.sha256(json.dumps(min(rotations),separators=(',',':')).encode()).hexdigest()


def _distance(point,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1];length=dx*dx+dy*dy
    if length<1e-14:raise ValueError('Base footprint contains degenerate edge')
    t=max(0,min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length))
    return math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy)


def audit_base_closure(recipe,loops,source_minimum):
    spec=recipe.get('massing',{}).get('baseClosure')
    if spec is None:
        if any(abs(p[2]-source_minimum)>.001 for loop in loops for p in loop):raise ValueError('Source shell has open boundaries above ground')
        return {'mode':'strict-source-minimum','sourceMinimumM':source_minimum}
    if not isinstance(spec,dict) or spec.get('geometryRevision')!=recipe.get('geometryRevision'):raise ValueError('Explicit source base closure requires matching geometryRevision')
    expected=spec.get('sourceLoopSignatures');actual=sorted(loop_signature(ring) for ring in loops)
    if not isinstance(expected,list) or not expected or len(set(expected))!=len(expected) or sorted(expected)!=actual:raise ValueError('Explicit source base closure loop signatures do not match exact boundaries')
    z=spec.get('datumZ');tolerance=spec.get('maxFootprintDeviationM',.03)
    if not finite(z) or not finite(tolerance) or not 0<tolerance<=.03:raise ValueError('Explicit source base closure datum/tolerance invalid')
    if any(abs(p[2]-z)>.001 for loop in loops for p in loop):raise ValueError('Explicit source base closure requires all approved loops at datum')
    provenance=spec.get('provenance')
    if not isinstance(provenance,dict) or not provenance.get('basis'):raise ValueError('Explicit source base closure requires audit provenance')
    if len(loops)!=1:raise ValueError('Explicit source base closure currently supports one exterior basal loop')
    from .polygons import triangulate
    loop=loops[0];ring=recipe['footprint'];triangulate([p[:2] for p in loop])
    error=max(max(min(_distance(p,a,b) for a,b in zip(ring,ring[1:]+ring[:1])) for p in loop),max(min(_distance(p,a,b) for a,b in zip(loop,loop[1:]+loop[:1])) for p in ring))
    if error>tolerance:raise ValueError('Explicit source base closure boundary does not match owner footprint')
    return {'mode':'explicit-audited-basal-loop','sourceMinimumM':source_minimum,'datumZ':z,'sourceLoopSignatures':actual,'maxFootprintDeviationM':error,'provenance':provenance}
