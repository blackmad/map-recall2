"""Optional reconstruction hypotheses. Never relabel them as measurements."""
from copy import deepcopy
from statistics import median
import fit_openings
import numpy as np

VERSION='layout-hypotheses/1'


def complete_grid(openings,rgb):
    """Infer a missing row/column crossing only from a dense observed lattice."""
    if rgb is None:return openings
    anchors=[o for o in openings if o['kind']=='window' and o['state']=='proposed' and o.get('detector')]
    if len(anchors)<6:return openings
    boxes=np.array([o['box'] for o in anchors],dtype=float)
    widths=boxes[:,2]-boxes[:,0];heights=boxes[:,3]-boxes[:,1]
    cx=(boxes[:,0]+boxes[:,2])/2;cy=(boxes[:,1]+boxes[:,3])/2
    indices=list(range(len(anchors)))
    rows=fit_openings.clusters(sorted(indices,key=lambda i:(cy[i],cx[i])),lambda i,j:
        abs(cy[i]-cy[j])<.24*min(heights[i],heights[j]) and
        min(heights[i],heights[j])/max(heights[i],heights[j])>.62)
    cols=fit_openings.clusters(sorted(indices,key=lambda i:(cx[i],cy[i])),lambda i,j:
        abs(cx[i]-cx[j])<.22*min(widths[i],widths[j]) and
        min(widths[i],widths[j])/max(widths[i],widths[j])>.68)
    rows=[group for group in rows if len(group)>=2];cols=[group for group in cols if len(group)>=2]
    if len(rows)<2 or len(cols)<3:return openings
    occupied={(ri,ci) for ri,row in enumerate(rows) for ci,col in enumerate(cols)
              if set(row)&set(col)}
    density=len(occupied)/(len(rows)*len(cols))
    if density<.5:return openings
    edges=fit_openings.edge_maps(rgb);result=deepcopy(openings);serial=1
    for ri,row in enumerate(rows):
        for ci,col in enumerate(cols):
            if (ri,ci) in occupied:continue
            row_ids=[anchors[i]['id'] for i in row];col_ids=[anchors[i]['id'] for i in col]
            x=median(cx[col]);y=median(cy[row]);w=median(widths[col]);h=median(heights[col])
            candidate=[round(x-w/2),round(y-h/2),round(x+w/2),round(y+h/2)]
            if candidate[0]<1 or candidate[1]<1 or candidate[2]>=rgb.shape[1]-1 or candidate[3]>=rgb.shape[0]-1:continue
            if any(fit_openings.overlap(candidate,o['box']) for o in result):continue
            support=[fit_openings.edge_support(edges,candidate,axis) for axis in range(4)]
            edge_ok=sum(value>.3 for value in support)>=3 and float(np.mean(support))>.45
            lattice_ok=len(row)>=2 and len(col)>=2 and density>=.72
            if not (edge_ok or lattice_ok):continue
            while any(o['id']==f'grid-{serial}' for o in result):serial+=1
            result.append({'id':f'grid-{serial}','kind':'window','box':candidate,'state':'proposed','reasons':[],
                           'basis':'inferred','confidence':None,
                           'visibility':{'state':'inferred-occluded' if not edge_ok else 'inferred-visible','sourceBoundaries':[],
                                         'note':'Visibility is inferred from a repeated facade lattice; no opening pixels were measured for this cell.'},
                           'ownership':{'state':'proposed','reasons':[],'note':'The candidate remains inside the reviewed image wall; feature correctness is unaccepted.'},
                           'kindEvidence':{'value':'window','basis':'inferred','note':'Repeated row and column peers support a window-family hypothesis.'},
                           'reconstruction':{'version':VERSION,'method':'grid-crossing','measuredBox':None,'inferredBox':candidate,
                                             'basis':'inferred','state':'proposed','rowPeerIds':row_ids,'columnPeerIds':col_ids,
                                             'peerIds':row_ids+col_ids,'latticeDensity':round(density,3),
                                             'edgeSupport':[round(value,3) for value in support],'edgePassed':edge_ok,
                                             'reason':'A dense observed row/column lattice supports this missing crossing. No source colour, mask or frame detail is inferred.'}})
            serial+=1
    return result


def propose(openings,rgb=None,complete_missing=False):
    result=deepcopy(openings)
    # A failed SAM mask may be an occluder. Existing weak detections with strong
    # row, column and edge support can still supply inferred geometry, but not
    # texture or colours from the rejected mask.
    for o in result:
        check=o.get('secondaryCheck') or {}
        x0,y0,x1,y1=o['box'];w=x1-x0;h=y1-y0
        nearby_bay=[p['id'] for p in openings if p['state']=='proposed' and p['kind']=='window'
                    and abs((p['box'][0]+p['box'][2]-x0-x1)/2)<=.35*w
                    and abs(p['box'][1]-y0)>h and .8<=(p['box'][2]-p['box'][0])/w<=1.25]
        bay=check.get('bayPeers') or (nearby_bay if len(nearby_bay)>=2 else [])
        if (o['reasons']==['Below primary detector threshold; secondary evidence required']
                and check.get('rowPeers') and bay and not check.get('overlappingAssemblies')
                and check.get('edgePassed')):
            o.update(state='proposed',basis='inferred',reasons=[])
            o['reconstruction']={'version':VERSION,'measuredBox':o['box'][:],'inferredBox':o['box'][:],
                                 'basis':'inferred','state':'proposed','reason':'Row, column and visible edges support an existing observation despite an unusable mask.',
                                 'peerIds':check['rowPeers']+bay}
    measured=deepcopy(result)
    for o in result:
        if o['kind']!='window' or o['state']!='proposed':continue
        x0,y0,x1,y1=o['box'];w=x1-x0;h=y1-y0
        # Repeated smaller windows are their own family, not truncated copies
        # of the tall central glazing. Two other rows corroborate that exception.
        family=[p for p in measured if p['id']!=o['id'] and p['state']=='proposed' and p['kind']=='window'
                and abs((p['box'][0]+p['box'][2]-x0-x1)/2)<=.35*w
                and abs(p['box'][1]-y0)>h and abs((p['box'][3]-p['box'][1])-h)<=.1*h]
        if len(family)>=2:continue
        # Opening assemblies (including a door + transom) may corroborate a
        # common ground-floor sill. Two agreeing taller peers are required;
        # a single tall door never dictates the dimensions of nearby windows.
        peers=[p for p in measured if p['id']!=o['id'] and p['state']=='proposed'
               and abs(p['box'][1]-y0)<=.08*h and .75<=(p['box'][2]-p['box'][0])/w<=1.3
               and abs((p['box'][0]+p['box'][2]-x0-x1)/2)>w
               and .08*h<p['box'][3]-y1<=.32*h]
        if len(peers)<2:continue
        bottoms=[p['box'][3] for p in peers]
        if max(bottoms)-min(bottoms)>.08*h:continue
        candidate=[x0,y0,x1,round(median(bottoms))]
        if any(p['id']!=o['id'] and p['state']=='proposed' and fit_openings.overlap(candidate,p['box']) for p in result):continue
        o['reconstruction']={'version':VERSION,'measuredBox':o['box'][:],'inferredBox':candidate,
                             'basis':'inferred','state':'proposed','peerIds':[p['id'] for p in peers],
                             'reason':'Two similarly wide opening assemblies agree on a lower sill; hypothesised continuation of a shorter observation.'}
        o['box']=candidate;o['basis']='inferred'
    return complete_grid(result,rgb) if complete_missing else result
