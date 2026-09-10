"""Image-supported appearance proposals. No grid completion or architectural labels
from an address. Numerical support is diagnostic, never calibrated confidence.
"""
import numpy as np
import cv2
from scipy import ndimage, signal
from copy import deepcopy

VERSION = 'photo-appearance/1'


def runs(binary):
    edges = np.diff(np.r_[False, binary, False].astype(int))
    return list(zip(np.where(edges == 1)[0], np.where(edges == -1)[0]))


def colour(samples):
    if len(samples) < 20:
        return None
    median = np.median(samples, axis=0).astype(int)
    return {'hex': '#' + ''.join(f'{v:02x}' for v in median), 'rgb': median.tolist(),
            'p10': np.quantile(samples, .1, axis=0).astype(int).tolist(),
            'p90': np.quantile(samples, .9, axis=0).astype(int).tolist(), 'pixels': len(samples),
            'basis': 'observed', 'state': 'proposed', 'confidence': None}


def iou(a, b):
    x0, y0, x1, y1 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    intersection = max(0, x1-x0) * max(0, y1-y0)
    return intersection / max(1, (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - intersection)


def edge_rectangles(rgb, mask, sx, sy):
    grey = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(grey, 35, 95)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    rectangles = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if not (.45 < w*sx < 3.5 and .7 < h*sy < 5.5):
            continue
        area = cv2.contourArea(c)
        if area/(w*h) < .7 or np.isin(mask[y:y+h, x:x+w], [2, 4]).mean() < .25:
            continue
        rectangles.append([x, y, x+w, y+h])
    return rectangles


def refine_openings(rgb, mask, record):
    sx, sy = record['frame']['metresPerPixelX'], record['frame']['metresPerPixelY']
    rectangles = edge_rectangles(rgb, mask, sx, sy)
    result = []
    for raw in record['openings']:
        x0, y0, x1, y1 = raw['box']
        binary = mask[y0:y1, x0:x1] == (4 if raw['kind'] == 'window' else 2)
        # A broad low-support horizontal gap can separate storeys. Short gaps
        # corresponding to glazing bars are closed, not treated as new windows.
        profile = ndimage.uniform_filter1d(binary.mean(axis=1), size=3)
        gaps = [(a, b) for a, b in runs(profile < .35)
                if (b-a)*sy >= .14 and a*sy > 1.2 and (y1-y0-b)*sy > 1.2
                and not any(min(x1,r[2])-max(x0,r[0]) > .6*(x1-x0)
                            and r[1]+4 < y0+(a+b)/2 < r[3]-4 for r in rectangles)]
        spans, start = [], 0
        for a, b in gaps:
            if (a-start)*sy >= 1.2:
                spans.append((start, a)); start = b
        spans.append((start, y1-y0))
        for index, (a, b) in enumerate(spans):
            box = [x0, y0+int(a), x1, y0+int(b)]
            candidates = sorted(((iou(box, r), r) for r in rectangles), reverse=True)
            edge_support = candidates[0][0] if candidates else 0
            if edge_support >= .48:
                box = candidates[0][1]
            if any(iou(box, o['box']) > .65 for o in result):
                continue
            reasons = []
            # Rounded strip widths can put a frame edge less than one pixel beyond
            # the declared wall. Clip only that rounding tolerance; retain larger
            # disagreements for review.
            wall_left = -record['frame']['leftM']/sx
            wall_right = (record['frame']['wallWidthM']-record['frame']['leftM'])/sx
            if 0 < wall_left-box[0] < 1:
                box[0] = int(np.ceil(wall_left))
            if 0 < box[2]-wall_right < 1:
                box[2] = int(np.floor(wall_right))
            if box[1] <= 3 or box[3] >= record['height']-3:
                reasons.append('Truncated opening at source boundary')
            if record['frame']['leftM'] + box[0]*sx < 0 or record['frame']['leftM'] + box[2]*sx > record['frame']['wallWidthM']:
                reasons.append('Outside target wall')
            result.append({'id': f'{raw["id"]}' + (f'-part{index+1}' if len(spans) > 1 else ''),
                           'kind': raw['kind'], 'box': box, 'rawIds': [raw['id']],
                           'state': 'needs-review' if reasons else 'proposed', 'basis': 'observed',
                           'confidence': None, 'reasons': reasons,
                           'fit': {'edgeRectangleIoU': round(edge_support, 3), 'splitAtMaskGap': len(spans) > 1}})
    return supported_region(result, record)


def supported_region(result, record, keep_exceptions=False):
    sy = record['frame']['metresPerPixelY']
    # Choose the span of rows supported by multiple openings. Isolated shop / door
    # exceptions are retained for review, not silently called false positives.
    supported = []
    for o in result:
        x0, y0, x1, y1 = o['box']
        peers = [p for p in result if p['id'] != o['id'] and p['state'] == 'proposed'
                 and min(x1, p['box'][2])-max(x0, p['box'][0]) < .2*(x1-x0)
                 and abs((y0+y1-p['box'][1]-p['box'][3])/2)*sy < .55
                 and min(y1-y0, p['box'][3]-p['box'][1])/max(y1-y0, p['box'][3]-p['box'][1]) > .5]
        if peers and o['state'] == 'proposed' and (y1-y0)*sy > 1.2:
            supported.append(o)
    if len(supported) < 2:
        return result, None
    if keep_exceptions:
        supported = [o for o in result if o['state']=='proposed']
    top = max(0, min(o['box'][1] for o in supported)-round(.3/sy))
    bottom = min(record['height'], max(o['box'][3] for o in supported)+round(.12/sy))
    for o in result:
        if o['box'][1] < top or o['box'][3] > bottom:
            o['state'] = 'needs-review'; o['reasons'].append('Outside repeated-opening evidence region; foreground or ground-floor exception needs review')
    return result, [int(top), int(bottom)]


def wall_evidence(rgb, mask, openings, rows, sx, sy):
    h, w = mask.shape
    valid = ndimage.binary_erosion(mask == 1, iterations=2)
    valid[:rows[0]] = False; valid[rows[1]:] = False
    valid[:, :round(.06*w)] = False; valid[:, round(.94*w):] = False
    for b in openings:
        x0, y0, x1, y1 = b['box']; d = max(2, round(.1/sx))
        valid[max(0,y0-d):min(h,y1+d), max(0,x0-d):min(w,x1+d)] = False
    # Candidate patches must be mostly wall-labelled and retain their exact pixels.
    # This makes light/shadow disagreement inspectable, rather than one pooled RGB.
    pw, ph = max(8, round(.28/sx)), max(8, round(.45/sy))
    patches = []
    for y in range(rows[0], rows[1]-ph, max(4, ph//2)):
        for x in range(0, w-pw, max(4, pw//2)):
            use = valid[y:y+ph, x:x+pw]
            if use.mean() < .94:
                continue
            sample = rgb[y:y+ph, x:x+pw][use]
            median = np.median(sample, axis=0)
            if median.mean() < 20 or median.mean() > 245:
                continue
            patches.append({'box': [x, y, x+pw, y+ph], 'colour': colour(sample),
                            'luminance': float(median.mean())})
    if not patches:
        return {'colour': None, 'patches': [], 'material': {'value': None, 'basis': 'unknown'}, 'texture': None}, valid
    # Equal patch weights avoid a large shadow/foreground region dominating. The
    # brighter half is a deliberate sampling rule, not recovered reflectance.
    threshold = np.quantile([p['luminance'] for p in patches], .5)
    lit = [p for p in patches if p['luminance'] >= threshold]
    medians = np.array([p['colour']['rgb'] for p in lit])
    wall_colour = colour(np.repeat(medians, 20, axis=0))
    wall_colour['patchCount'] = len(lit)
    wall_colour['note'] = 'Equal-weight brighter-half wall patches inside the opening-supported region. Camera RGB under source lighting; not intrinsic reflectance.'
    selected = sorted(lit, key=lambda p: abs(p['luminance']-np.median([q['luminance'] for q in lit])))[:8]
    for i, p in enumerate(selected):
        p['id'] = f'wall-patch-{i+1}'; p.pop('luminance')
    # Course spacing needs repeated horizontal texture, at least three courses,
    # and enough pixels per course. At low resolution, abstain on bond/scale.
    periodic = []
    for p in selected:
        x0,y0,x1,y1 = p['box']
        grey = rgb[y0:y1,x0:x1].mean(axis=2).mean(axis=1)
        detrended = grey-ndimage.gaussian_filter1d(grey, 2)
        energy = float(np.dot(detrended, detrended))
        if energy < len(grey)*2:
            continue
        for lag in range(max(3, round(.045/sy)), min(len(grey)//3, round(.14/sy))+1):
            score = float(np.dot(detrended[:-lag], detrended[lag:]) / max(1, np.linalg.norm(detrended[:-lag])*np.linalg.norm(detrended[lag:])))
            if score > .35:
                periodic.append({'patchId': p['id'], 'lagPx': lag, 'spacingM': round(lag*sy, 4), 'correlation': round(score,3)})
    texture = {'horizontalRepeats': periodic, 'bond': None, 'roughness': None,
               'note': 'Autocorrelation candidates, not a brick classifier. Brick bond, mortar scale and roughness require review or higher-resolution evidence.'}
    material = {'value': 'masonry-candidate' if len({p['patchId'] for p in periodic}) >= 2 else None,
                'basis': 'inferred' if periodic else 'unknown', 'state': 'proposed', 'confidence': None}
    return {'colour': wall_colour, 'patches': selected, 'candidatePatchCount': len(patches), 'material': material, 'texture': texture}, valid


def window_evidence(rgb, mask, opening):
    x0,y0,x1,y1 = opening['box']; image = rgb[y0:y1,x0:x1]
    h,w = image.shape[:2]
    semantic = mask[y0:y1,x0:x1]
    glass_mask = ndimage.binary_erosion(semantic == (4 if opening['kind'] == 'window' else 2), iterations=2)
    interior = colour(image[glass_mask])
    glass = interior if opening['kind']=='window' else None
    panel = interior if opening['kind']=='door' else None
    # Bright edge samples support frame colour; dark painted frames remain unknown
    # rather than being assigned white by a prior.
    border = np.zeros((h,w),bool); dx,dy = max(2,round(w*.12)),max(2,round(h*.08))
    border[:dy] = True; border[-dy:] = True; border[:,:dx] = True; border[:,-dx:] = True
    luminance = image.mean(axis=2)
    threshold = max(70, float(np.quantile(luminance[border], .65)))
    trim_mask = border & (luminance >= threshold)
    trim = colour(image[trim_mask])
    lines = []
    if trim and w >= 18 and h >= 28:
        # Search for long straight runs whose colour resembles the observed frame.
        # Reflections and branches may still imitate bars: proposed geometry only.
        distance = np.linalg.norm(image.astype(float)-np.array(trim['rgb']),axis=2)
        bright = (distance < 65) & (luminance > max(65, threshold*.65))
        for axis, profile in [('vertical', bright[dy:h-dy].mean(axis=0)), ('horizontal', bright[:,dx:w-dx].mean(axis=1))]:
            size = w if axis == 'vertical' else h
            smooth = ndimage.uniform_filter1d(profile, size=2)
            peaks, props = signal.find_peaks(smooth, height=.42, prominence=.13, distance=max(4, round(size*.12)))
            for i, pos in enumerate(peaks):
                if not .25 < pos/size < .75:
                    continue
                lines.append({'axis': axis, 'fraction': round(float(pos/size),4),
                              'sourceLine': [x0+int(pos),y0+dy,x0+int(pos),y1-dy] if axis=='vertical' else [x0+dx,y0+int(pos),x1-dx,y0+int(pos)],
                              'support': round(float(props['peak_heights'][i]),3), 'basis': 'observed', 'state': 'proposed'})
        # Dark glazing bars can differ from the pale outer frame. A local ridge
        # must be darker than both sides along a substantial fraction of its span.
        for axis, dim in [('vertical',1), ('horizontal',0)]:
            size=w if dim==1 else h
            delta=np.minimum(np.roll(luminance,3,axis=dim),np.roll(luminance,-3,axis=dim))-luminance
            support=(delta>9)
            profile=support[dy:h-dy].mean(axis=0) if dim==1 else support[:,dx:w-dx].mean(axis=1)
            peaks,props=signal.find_peaks(profile,height=.38,prominence=.15,distance=max(4,round(size*.14)))
            for i,pos in enumerate(peaks):
                fraction=pos/size
                if not .2<fraction<.8 or any(l['axis']==axis and abs(l['fraction']-fraction)<.07 for l in lines):
                    continue
                samples=image[dy:h-dy,max(0,pos-1):pos+2].reshape(-1,3) if dim==1 else image[max(0,pos-1):pos+2,dx:w-dx].reshape(-1,3)
                lines.append({'axis':axis,'fraction':round(float(fraction),4),
                              'sourceLine':[x0+int(pos),y0+dy,x0+int(pos),y1-dy] if dim==1 else [x0+dx,y0+int(pos),x1-dx,y0+int(pos)],
                              'colour':colour(samples),'support':round(float(props['peak_heights'][i]),3),
                              'basis':'observed','state':'proposed','method':'dark-ridge'})
    lines.sort(key=lambda l:(l['axis'],l['fraction']))
    vertical = sum(l['axis']=='vertical' for l in lines); horizontal = sum(l['axis']=='horizontal' for l in lines)
    style = 'divided-light-candidate' if vertical or horizontal else None
    unknown = (['opening mechanism', 'frame depth', 'sash versus casement', 'hidden bars'] if opening['kind']=='window'
               else ['opening mechanism', 'frame depth', 'door panel layout', 'glazing extent'])
    note = ('Image line candidates; pane layout is inferred. Sash/casement mechanism cannot be established from these lines.'
            if opening['kind']=='window' else
            'Eroded door-mask pixels supply a panel colour proposal. Door glazing and panel layout remain unknown without separate part masks.')
    return {'boundBox': opening['box'], 'trimColour': trim, 'glassColour': glass, 'panelColour': panel,
            'bars': lines, 'style': {'value': style, 'basis': 'inferred' if style else 'unknown', 'state': 'proposed', 'confidence': None},
            'paneLayout': {'columns': vertical+1, 'rows': horizontal+1} if lines else None,
            'unknown': unknown, 'note': note}


def analyse(rgb, mask, record, preserve_boxes=False):
    openings, rows = (supported_region(deepcopy(record['openings']), record, keep_exceptions=True) if preserve_boxes
                      else refine_openings(rgb, mask, record))
    if rows is None:
        return {'version': VERSION, 'state': 'needs-review', 'reason': 'No supported multi-opening region', 'openings': openings}, None
    sx,sy = record['frame']['metresPerPixelX'],record['frame']['metresPerPixelY']
    wall, valid = wall_evidence(rgb,mask,openings,rows,sx,sy)
    windows = {b['id']: window_evidence(rgb,mask,b) for b in openings if b['state']=='proposed'}
    return {'version': VERSION, 'state': 'proposed', 'region': {'rows': rows, 'basis': 'inferred', 'state': 'proposed',
            'note': 'Span supported by repeated visible openings. May exclude a distinctive or occluded ground floor; not a building boundary.'},
            'openings': openings, 'wall': wall, 'windows': windows,
            'coverage': {'imageRowsFraction': round((rows[1]-rows[0])/record['height'],3), 'rawOpeningCount': len(record['openings']),
                         'proposedOpeningCount': sum(b['state']=='proposed' for b in openings), 'unknownOpeningCount': sum(b['state']!='proposed' for b in openings)},
            'unknown': ['roof', 'gable', 'cornice geometry', 'occlusion completeness', 'true material reflectance']}, valid
