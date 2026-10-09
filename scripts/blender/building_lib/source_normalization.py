"""Geometry-preserving exact ring normalization; original source remains immutable."""
import copy, hashlib, json, math

class SourceNormalizationError(ValueError):
    def __init__(self,message,audit):
        super().__init__(message);self.audit=audit

def normalize_source_shell(source, geometry_revision, exclusion=None):
    if not isinstance(geometry_revision,str) or not geometry_revision.strip():
        raise ValueError('Source normalization requires geometryRevision')
    normalized=copy.deepcopy(source);removals=[];degenerate=[]
    def vector(ring):
        return tuple(sum(a[(k+1)%3]*b[(k+2)%3]-a[(k+2)%3]*b[(k+1)%3]
                         for a,b in zip(ring,ring[1:]+ring[:1])) for k in range(3))
    for si,surface in enumerate(normalized.get('surfaces',[])):
        for ri,ring in enumerate(surface.get('rings',[])):
            if any(not isinstance(p,(list,tuple)) or len(p)!=3 or any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in p) for p in ring):
                raise ValueError('Source normalization requires finite 3D coordinates')
            kept=[];indices=[]
            for i,p in enumerate(ring):
                if kept and p==kept[-1]:
                    removals.append({'surfaceIndex':si,'ringIndex':ri,'vertexIndex':i,'equalToVertexIndex':indices[-1],'kind':'exact-consecutive','coordinate':list(p)})
                else:kept.append(p);indices.append(i)
            while len(kept)>1 and kept[-1]==kept[0]:
                removals.append({'surfaceIndex':si,'ringIndex':ri,'vertexIndex':indices[-1],'equalToVertexIndex':indices[0],'kind':'exact-closure','coordinate':list(kept[-1])});kept.pop();indices.pop()
            if len(kept)<3:degenerate.append({'surfaceIndex':si,'ringIndex':ri,'retainedDistinctVertices':len(kept)})
            if vector(ring)!=vector(kept):raise ValueError('Exact normalization changed ring area vector')
            surface['rings'][ri]=kept
    digest=lambda value:hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()
    audit={'policy':'exact-consecutive-and-closure-duplicates/v1','geometryRevision':geometry_revision,
                       'originalSourceDigest':digest(source),'normalizedSourceDigest':digest(normalized),
                       'removedVertices':removals,'removedVertexCount':len(removals),
                       'ringAreaVectorsPreserved':True,'retainedCoordinatesUnchanged':True,
                       'epsilonUsed':False,'degenerateRings':degenerate}
    excluded=[]
    if exclusion is not None:
        if not isinstance(exclusion,dict) or exclusion.get('geometryRevision')!=geometry_revision:
            raise ValueError('Source normalization exclusion requires matching geometryRevision')
        provenance=exclusion.get('provenance',{})
        if not isinstance(provenance,dict) or any(not isinstance(provenance.get(k),str) or not provenance[k].strip() for k in ('basis','note')):
            raise ValueError('Source normalization exclusion requires explicit provenance')
        indices=exclusion.get('surfaceIndices')
        if not isinstance(indices,list) or not indices or len(set(indices))!=len(indices) or any(isinstance(i,bool) or not isinstance(i,int) or not 0<=i<len(normalized['surfaces']) for i in indices):
            raise ValueError('Source normalization exclusion requires unique surface indices')
        for i in indices:
            rings=normalized['surfaces'][i]['rings']
            if len(rings)!=1 or len(rings[0])>2 or len(set(tuple(p) for p in rings[0]))>2 or any(vector(rings[0])):
                raise ValueError('Only exact duplicate-degenerate single-ring surfaces may be excluded')
            excluded.append({'surfaceIndex':i,'originalSurface':copy.deepcopy(source['surfaces'][i]),'normalizedRing':rings[0],
                             'zeroAreaVector':list(vector(rings[0])),'provenance':copy.deepcopy(provenance)})
    audit['excludedSurfaces']=excluded
    if any(r['surfaceIndex'] not in [e['surfaceIndex'] for e in excluded] for r in degenerate):
        raise SourceNormalizationError('Exact normalization exposes degenerate source ring; explicit source repair required',audit)
    return normalized,audit
