"""Bounded, image-checked regularisation of observed opening rectangles.

Coordinates are outer-frame proposals in source pixels. No missing cells are
created; grouping is a revisable prior, not observed architecture or confidence.
"""
from copy import deepcopy
import cv2
import numpy as np
from scipy.optimize import least_squares

VERSION = 'opening-fit/2'
CONFIG = {'maximumMovePx': 5, 'maximumMoveFraction': .08,
          'rowCentreHeightFraction': .22, 'minimumHeightRatio': .72,
          'equalWidthRatio': 1.14, 'familyHeightRatio': 1.18,
          'familyAspectRatio': 1.16, 'bayCentreWidthFraction': .16,
          'edgeMinimum': .12, 'edgeMaximumLoss': .07}


def clusters(indices, compatible):
    """Complete-link groups prevent a chain of neighbours joining different rows."""
    result = []
    for i in indices:
        group = next((g for g in result if all(compatible(i, j) for j in g)), None)
        if group is None:
            result.append([i])
        else:
            group.append(i)
    return [g for g in result if len(g) >= 2]


def edge_maps(rgb):
    grey = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    return [np.abs(cv2.Sobel(grey, cv2.CV_32F, 1, 0, ksize=3))/4,
            np.abs(cv2.Sobel(grey, cv2.CV_32F, 0, 1, ksize=3))/4]


def edge_support(edges, box, axis):
    x0, y0, x1, y1 = map(int, box)
    h, w = edges[0].shape
    if axis in (0, 2):
        x = (x0, x1-1)[axis//2]; inset = max(1, (y1-y0)//8)
        data = edges[0][max(0,y0+inset):min(h,y1-inset), max(0,x-1):min(w,x+2)]
        profile = data.max(axis=1) if data.size else np.array([])
    else:
        y = y0 if axis == 1 else y1-1; inset = max(1, (x1-x0)//8)
        data = edges[1][max(0,y-1):min(h,y+2), max(0,x0+inset):min(w,x1-inset)]
        profile = data.max(axis=0) if data.size else np.array([])
    return float(np.minimum(profile/40, 1).mean()) if len(profile) else 0.


def overlap(a, b):
    return min(a[2],b[2]) > max(a[0],b[0]) and min(a[3],b[3]) > max(a[1],b[1])


def fit(rgb, openings):
    result = deepcopy(openings)
    active = [i for i,o in enumerate(result) if o['kind']=='window' and o['state']=='proposed']
    original = np.array([o['box'] for o in result], dtype=float).reshape(-1,4)
    widths = original[:,2]-original[:,0]; heights = original[:,3]-original[:,1]
    cx = (original[:,0]+original[:,2])/2; cy = (original[:,1]+original[:,3])/2
    rows = clusters(sorted(active,key=lambda i:(cy[i],cx[i])), lambda i,j:
                    abs(cy[i]-cy[j]) < CONFIG['rowCentreHeightFraction']*min(heights[i],heights[j])
                    and min(heights[i],heights[j])/max(heights[i],heights[j]) > CONFIG['minimumHeightRatio']
                    and abs(cx[i]-cx[j]) > .5*(widths[i]+widths[j]))
    def same_family(i,j):
        aspects=widths/heights
        return (max(widths[i],widths[j])/min(widths[i],widths[j]) <= CONFIG['equalWidthRatio']
                and max(heights[i],heights[j])/min(heights[i],heights[j]) <= CONFIG['familyHeightRatio']
                and max(aspects[i],aspects[j])/min(aspects[i],aspects[j]) <= CONFIG['familyAspectRatio'])
    # Heads can align across different opening proportions, while sills and
    # widths only regularise within a repeated family. This preserves the tall
    # central glazing in Bloemstraat beside its shorter side windows.
    equal_width = [g for row in rows for g in clusters(row,same_family)]
    sill_rows = [g for row in rows for g in clusters(row,same_family)]
    families = clusters(sorted(active,key=lambda i:(widths[i],heights[i],cx[i])),same_family)
    bays = clusters(sorted(active,key=lambda i:(cx[i],cy[i])),lambda i,j:
                    abs(cx[i]-cx[j]) < CONFIG['bayCentreWidthFraction']*min(widths[i],widths[j])
                    and abs(cy[i]-cy[j]) > .5*(heights[i]+heights[j])
                    and max(widths[i],widths[j])/min(widths[i],widths[j]) <= CONFIG['equalWidthRatio'])
    participating = sorted(set(i for group in rows+bays for i in group))
    def deviations(boxes):
        metrics = {}
        for name, groups, values in [('rowWidths', equal_width, boxes[:,2]-boxes[:,0]),
                                    ('rowHeads', rows, boxes[:,1]), ('rowSills', sill_rows, boxes[:,3]),
                                    ('bayCentres', bays, (boxes[:,0]+boxes[:,2])/2)]:
            ds = [abs(values[i]-np.median(values[g])) for g in groups for i in g]
            metrics[name+'MeanDeviationPx'] = round(float(np.mean(ds)),3) if ds else None
        return metrics
    summary = {'version': VERSION, 'config': CONFIG, 'basis':'inferred', 'state':'proposed',
               'rows': [[result[i]['id'] for i in g] for g in rows],
               'sillGroups': [[result[i]['id'] for i in g] for g in sill_rows],
               'widthGroups': [[result[i]['id'] for i in g] for g in equal_width],
               'windowFamilies': [[result[i]['id'] for i in g] for g in families],
               'bays': [[result[i]['id'] for i in g] for g in bays],
               'before': deviations(original), 'note': 'Heads may align across local window families; widths and sills regularise only within a repeated width/height/aspect family. No grid completion, equal storey heights, or forced facade symmetry.'}
    if not participating:
        summary.update(after=summary['before'], adjustedCount=0, attemptedCount=0)
        return result, summary
    limits = np.minimum(CONFIG['maximumMovePx'], np.maximum(1, np.c_[widths,heights,widths,heights]*CONFIG['maximumMoveFraction']))
    # Robust residuals softly fit each shared dimension; the measured raw box
    # remains an explicit competing term. No floor is coupled to another's height.
    def residual(flat):
        boxes = original.copy(); boxes[participating] = flat.reshape(-1,4)
        terms = [((boxes[participating]-original[participating])/limits[participating]).ravel()]
        for groups, values in [(equal_width,boxes[:,2]-boxes[:,0]), (rows,boxes[:,1]),
                               (sill_rows,boxes[:,3]), (bays,(boxes[:,0]+boxes[:,2])/2)]:
            for g in groups:
                terms.append((values[g]-values[g].mean())*.9)
        return np.concatenate(terms)
    solved = least_squares(residual, original[participating].ravel(),
                           bounds=((original-limits)[participating].ravel(), (original+limits)[participating].ravel()),
                           loss='soft_l1', max_nfev=80)
    candidates = original.copy(); candidates[participating] = np.rint(solved.x.reshape(-1,4))
    edges = edge_maps(rgb); attempted = adjusted = 0
    for i in participating:
        raw = original[i].astype(int).tolist(); candidate = candidates[i].astype(int).tolist()
        moved = [a for a in range(4) if raw[a]!=candidate[a]]
        if not moved:
            continue
        attempted += 1; reasons = []
        before = [edge_support(edges,raw,a) for a in range(4)]
        after = [edge_support(edges,candidate,a) for a in range(4)]
        if any(abs(candidate[a]-raw[a]) > limits[i,a]+.01 for a in moved):
            reasons.append('Rounded fit exceeds movement bound')
        if candidate[0]<0 or candidate[1]<0 or candidate[2]>rgb.shape[1] or candidate[3]>rgb.shape[0] or candidate[2]<=candidate[0] or candidate[3]<=candidate[1]:
            reasons.append('Invalid fitted rectangle')
        if any(after[a] < max(CONFIG['edgeMinimum'],before[a]-CONFIG['edgeMaximumLoss']) for a in moved):
            reasons.append('Image edges do not support the adjustment')
        if any(j!=i and o['state']=='proposed' and overlap(candidate,o['box']) for j,o in enumerate(result)):
            reasons.append('Fit would overlap another opening')
        result[i]['fit'] = {'version':VERSION, 'rawBox':raw, 'candidateBox':candidate,
                            'applied':not reasons, 'basis':'inferred', 'state':'proposed',
                            'edgeSupportBefore':[round(v,3) for v in before],
                            'edgeSupportAfter':[round(v,3) for v in after],
                            'maximumMovePx':round(float(max(abs(np.array(candidate)-raw))),3), 'reasons':reasons}
        if not reasons:
            result[i]['box'] = candidate; result[i]['basis'] = 'inferred'
            result[i].pop('appearance',None); adjusted += 1
    summary.update(after=deviations(np.array([o['box'] for o in result])), adjustedCount=adjusted,
                   attemptedCount=attempted, solverConverged=bool(solved.success))
    return result, summary
