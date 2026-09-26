"""DINO observations → bounded opening fit → remeasured appearance → photo lab.

Consumes a completed offline benchmark; never promotes identity/registration.
Preserves raw detections, mask derivatives and every fitting decision.
"""
import argparse
from copy import deepcopy
import hashlib
import json
import shutil
from pathlib import Path
import numpy as np
from PIL import Image
import fit_openings
import photo_appearance
import feature_ontology
import layout_hypotheses


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verified_copy(root, out, name, digest):
    if Path(name).name != name or sha(root/name) != digest:
        raise ValueError(f'Stale or invalid asset: {name}')
    shutil.copyfile(root/name, out/name)


def proposals(record, benchmark):
    result = []
    sx = record['frame']['metresPerPixelX']; left = record['frame']['leftM']
    for i, detection in enumerate(benchmark['dino']['proposals']):
        coords = detection['box']
        if len(coords)!=4 or not all(np.isfinite(v) for v in coords):
            raise ValueError('Invalid detector box')
        box = [max(0, min(record['width' if k%2==0 else 'height'],round(v))) for k,v in enumerate(coords)]
        if box[2]<=box[0] or box[3]<=box[1]:
            continue
        reasons = []
        words = detection['label'].lower().split()
        kind = 'door' if 'door' in words and 'window' not in words else 'window'
        if not ('door' in words or 'window' in words):
            reasons.append('Detector label is absent')
        if detection['score']<.25:
            reasons.append('Below primary detector threshold; secondary evidence required')
        if left+box[0]*sx<0 or left+box[2]*sx>record['frame']['wallWidthM']:
            reasons.append('Outside target wall; no identity inference from image detection')
        boundary=[]
        if box[0]<=1:boundary.append('left')
        if box[1]<=1:boundary.append('top')
        if box[2]>=record['width']-1:boundary.append('right')
        if box[3]>=record['height']-1:boundary.append('bottom')
        if boundary:
            reasons.append('Truncated opening at source boundary')
        ownership=[]
        if box[3]*record['frame']['metresPerPixelY']>record['frame']['topM']:
            reasons.append('Extends below provisional ground; review basement/foreground')
            ownership.append('below-provisional-ground')
        result.append({'id':f'dino-{i+1}', 'kind':kind, 'box':box, 'basis':'observed', 'confidence':None,
                       'state':'needs-review' if reasons else 'proposed', 'reasons':reasons,
                       'visibility':{'state':'partial' if boundary else 'visible','sourceBoundaries':boundary,
                                     'note':'Source truncation records visibility only; it does not decide whether the visible pixels belong to the target wall.'},
                       'ownership':{'state':'needs-review' if ownership else 'proposed','reasons':ownership,
                                    'note':'Provisional wall/ground ownership is independent of image detection and visibility.'},
                       'kindEvidence':{'value':None if 'door' in words and 'window' in words else kind,
                                       'basis':'unknown' if 'door' in words and 'window' in words else 'inferred',
                                       'note':'Ambiguous opening types use generic window quads for display; geometry remains a separate proposal.'},
                       'detector':{'box':coords, 'label':detection['label'], 'score':detection['score'],
                                   'sourceCrop':detection.get('sourceCrop'),
                                   'note':'Uncalibrated model score, not correctness probability'}})
    # Nested proposals can be a door within a window-shaped surround. Preserve
    # both hypotheses for review; never choose silently using array order.
    for i,a in enumerate(result):
        for b in result[i+1:]:
            if a['state']=='proposed' and b['state']=='proposed' and fit_openings.overlap(a['box'],b['box']):
                outer,inner=sorted([a,b],key=lambda o:-(o['box'][2]-o['box'][0])*(o['box'][3]-o['box'][1]))
                if a['kind']==b['kind'] and all(outer['box'][k]<=inner['box'][k]+1 for k in [0,1]) and all(outer['box'][k]>=inner['box'][k]-1 for k in [2,3]):
                    inner['reasons'].append(f'Nested same-type hypothesis within {outer["id"]}; retain outer assembly')
                    outer.setdefault('nestedHypotheses',[]).append(inner['id'])
                    outer['assembly']={'role':'parent','componentIds':[inner['id']], 'basis':'inferred','state':'proposed',
                                       'note':'Nested detector rectangles support one outer opening assembly; the inner same-type rectangle remains a reviewable duplicate hypothesis.'}
                    inner['assembly']={'role':'nested-hypothesis','parentId':outer['id'],'basis':'inferred','state':'needs-review'}
                    continue
                a['reasons'].append(f'Overlapping detector hypothesis: {b["id"]}')
                b['reasons'].append(f'Overlapping detector hypothesis: {a["id"]}')
    for o in result:
        if o['reasons']:o['state']='needs-review'
    # A transom can be a separate observed rectangle immediately above a door.
    # Record the relationship without merging boxes or promoting either part.
    for door in [o for o in result if o['kind']=='door']:
        x0,y0,x1,y1=door['box'];width=x1-x0;height=y1-y0
        components=[]
        for pane in [o for o in result if o['kind']=='window']:
            a,b,c,d=pane['box'];overlap=max(0,min(x1,c)-max(x0,a))
            gap=y0-d
            if overlap>=.65*min(width,c-a) and -.04*height<=gap<=.12*height and (d-b)<=.55*height:
                components.append(pane['id'])
                pane.setdefault('assembly',{'role':'transom-candidate','parentId':door['id'],'basis':'inferred','state':'proposed'})
        if components and 'assembly' not in door:
            door['assembly']={'role':'parent','componentIds':components,'basis':'inferred','state':'proposed',
                              'note':'Adjacent observed rectangles support a door/transom assembly hypothesis; component extents remain separate measurements.'}
    return result


def secondary_pass(rgb, openings, benchmark, baseline_mask=None, semantic_state='proposed'):
    """Recover a weak observation through layout or independent detector agreement.

This is an inferred proposal, never a confidence calibration or acceptance.
"""
    edges=fit_openings.edge_maps(rgb)
    strong=deepcopy([o for o in openings if o['state']=='proposed' and o['kind']=='window'])
    for o in openings:
        if o['reasons']!=['Below primary detector threshold; secondary evidence required'] or o['kind']!='window':continue
        x0,y0,x1,y1=o['box'];w=x1-x0;h=y1-y0;cx=(x0+x1)/2
        row=[p['id'] for p in strong if abs(p['box'][1]-y0)<.15*h and .75<(p['box'][2]-p['box'][0])/w<1.33 and abs((p['box'][0]+p['box'][2])/2-cx)>w]
        bay=[p['id'] for p in strong if abs((p['box'][0]+p['box'][2])/2-cx)<.2*w and abs(p['box'][1]-y0)>h*.7]
        masks=[p for p in benchmark.get('samDinoClean',{}).get('proposals',[]) if p['promptBox']==o['detector']['box']]
        mask_ok=len(masks)==1 and not masks[0]['needsReview'] and photo_appearance.iou(o['box'],masks[0]['box'])>=.65
        support=[fit_openings.edge_support(edges,o['box'],a) for a in range(4)]
        edge_ok=sum(value>.3 for value in support)>=3 and float(np.mean(support))>.45
        semantic_share=(float(np.isin(baseline_mask[y0:y1,x0:x1],[2,4]).mean())
                        if baseline_mask is not None and semantic_state=='proposed' else None)
        overlaps=[p['id'] for p in openings if p['state']=='proposed' and fit_openings.overlap(o['box'],p['box'])]
        layout_pass=bool(row and bay and mask_ok and edge_ok and not overlaps)
        ensemble_pass=bool(semantic_share is not None and semantic_share>=.25 and mask_ok and edge_ok and not overlaps)
        # Roof openings often sit above the semantic wall crop and have no
        # same-row peer. Keep a measured dormer candidate when two lower
        # facade windows establish the building, while DINO, SAM and the four
        # classical rectangle edges independently agree on this exact box.
        lower_peers=[p['id'] for p in strong
                     if p['box'][1] >= y1 + .35*h]
        above_facade_openings=bool(strong and y1<=min(p['box'][1] for p in strong)+.25*h)
        roof_pass=bool(above_facade_openings and len(lower_peers)>=2 and mask_ok and edge_ok and
                       min(support)>.3 and not overlaps)
        passed=layout_pass or ensemble_pass or roof_pass
        o['secondaryCheck']={'rowPeers':row,'bayPeers':bay,'maskBounded':mask_ok,'edgeSupport':support,
                             'edgePassed':edge_ok,'semanticOpeningFraction':round(semantic_share,4) if semantic_share is not None else None,
                             'roofLowerPeerIds':lower_peers,
                             'aboveFacadeOpenings':above_facade_openings,
                             'supportMode':'layout-context' if layout_pass else 'cross-detector-ensemble' if ensemble_pass else 'roof-context' if roof_pass else None,
                             'overlappingAssemblies':overlaps,'passed':passed,'basis':'inferred',
                             'note':'A measured low-score candidate requires a bounded SAM mask and three supported rectangle edges. It then needs row plus column peers, at least 25% independent semantic opening pixels, or four supported edges above two lower facade windows. This combines distinct evidence paths without creating an empty grid cell.'}
        if passed:
            o['state']='proposed';o['basis']='inferred';o['reasons']=[]


def context_check(openings, baseline_mask, rgb=None, benchmark=None, semantic_state='proposed'):
    """Abstain on isolated objects when the independent semantic path disagrees.

Can exclude a real unusual entrance: retained for review, never called a proven
false positive. Agreement is not an acceptance test either.
"""
    if semantic_state == 'unknown':
        for o in openings:
            if o['state']!='proposed':continue
            o['contextCheck']={'baselineOpeningFraction':None,'nearbyOpeningIds':[],
                               'weakObservedPeerIds':[],'state':'unknown',
                               'note':'No independent semantic baseline was available. This gate abstains and does not promote or reject the detector observation.'}
        return
    if semantic_state != 'proposed':
        raise ValueError(f'Unsupported semantic baseline state: {semantic_state}')
    active=deepcopy([o for o in openings if o['state']=='proposed'])
    edges=fit_openings.edge_maps(rgb) if rgb is not None else None
    masks=(benchmark or {}).get('samDinoClean',{}).get('proposals',[])

    def supported_weak_peer(candidate, subject):
        if candidate['reasons']!=['Below primary detector threshold; secondary evidence required']:
            return False
        x0,y0,x1,y1=subject['box'];w=x1-x0;h=y1-y0
        a,b,c,d=candidate['box'];dx=max(0,a-x1,x0-c);dy=max(0,b-y1,y0-d)
        if dx>w or dy>h or fit_openings.overlap(subject['box'],candidate['box']):return False
        found=[m for m in masks if m['promptBox']==candidate['detector']['box']]
        if len(found)!=1 or found[0]['needsReview'] or photo_appearance.iou(candidate['box'],found[0]['box'])<.65:return False
        return edges is not None and min(fit_openings.edge_support(edges,candidate['box'],axis) for axis in range(4))>.3
    for o in openings:
        if o['state']!='proposed':continue
        x0,y0,x1,y1=o['box'];w=x1-x0;h=y1-y0
        share=float(np.isin(baseline_mask[y0:y1,x0:x1],[2,4]).mean())
        peers=[]
        for p in active:
            if p['id']==o['id']:continue
            a,b,c,d=p['box']
            dx=max(0,a-x1,x0-c);dy=max(0,b-y1,y0-d)
            if dx<=w and dy<=h:peers.append(p['id'])
        weak=[p['id'] for p in openings if p['id']!=o['id'] and supported_weak_peer(p,o)]
        roof_supported=(o.get('secondaryCheck') or {}).get('supportMode')=='roof-context'
        o['contextCheck']={'baselineOpeningFraction':round(share,4),'nearbyOpeningIds':peers,
                           'weakObservedPeerIds':weak,
                           'roofContextSupported':roof_supported,
                           'state':'needs-review' if share<.05 and not peers and not weak and not roof_supported else 'proposed',
                           'note':'Isolation plus model disagreement flags possible signage/foreground. A nearby low-score observation only supplies context when its own SAM mask and four edges are supported. A measured roof candidate may remain proposed when its bounded SAM mask, four edges and two lower facade windows agree. Neither agreement nor detector score proves a real architectural opening.'}
        if o['contextCheck']['state']=='needs-review':
            o['state']='needs-review';o['reasons'].append('Isolated candidate with semantic disagreement; inspect signage or foreground')


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--input',type=Path,required=True)
    ap.add_argument('--benchmark',type=Path,required=True)
    ap.add_argument('--out',type=Path,required=True)
    ap.add_argument('--no-fit',action='store_true',help='Control: identical DINO and appearance, no joint fitting')
    ap.add_argument('--image-study',action='store_true',help='Use source-image extent for an unplaced study; retain provisional wall/ground disagreements as warnings')
    ap.add_argument('--layout-hypotheses',action='store_true',help='Preview explicit inferred geometry from repeated opening assemblies')
    ap.add_argument('--grid-completion',action='store_true',help='Add explicit inferred cells at strongly supported row/column crossings')
    args = ap.parse_args()
    if args.out.exists():ap.error('Use a new immutable output directory')
    run = json.loads((args.input/'manifest.json').read_text())
    report = json.loads((args.benchmark/'report.json').read_text())
    benchmark_source_hash=run.get('benchmarkSourceManifestSha256',sha(args.input/'manifest.json'))
    if not report.get('complete') or report['sourceManifestSha256']!=benchmark_source_hash:
        raise ValueError('Incomplete benchmark or changed input manifest')
    by_sha = {r['sourceSha256']:r for r in report['records']}
    if len(by_sha)!=len(report['records']):raise ValueError('Duplicate benchmark source')
    args.out.mkdir(parents=True)
    for record in run['records']:
        if record['status']!='proposed':continue
        bench = by_sha.get(record['sourceSha256'])
        if bench is None:
            record.update(status='needs-review',reason='No DINO/SAM observation for this source')
            continue
        for name,digest in [('image','sourceSha256'),('mask','maskSha256')]:
            verified_copy(args.input,args.out,record[name],record[digest])
        if bench['width']!=record['width'] or bench['height']!=record['height']:
            raise ValueError('Benchmark image dimensions changed')
        rgb = np.array(Image.open(args.out/record['image']).convert('RGB'))
        semantic = np.array(Image.open(args.out/record['mask']))
        record['baselineOpenings'] = record['openings']
        record['baselineMask'] = record['mask']; record['baselineMaskSha256'] = record['maskSha256']
        record['rawWallColour'] = record.get('wallColour')
        raw = proposals(record,bench); record['rawOpenings'] = deepcopy(raw)
        if args.image_study:
            record['provisionalFrame']=deepcopy(record['frame'])
            record['frame'].update(leftM=0,wallWidthM=record['width']*record['frame']['metresPerPixelX'],
                                   note='Source-image extent for an unplaced wall study; not the registered BAG frontage. Provisional frame retained separately.')
            for o in raw:
                spatial=[reason for reason in o['reasons'] if reason.startswith(('Outside target wall','Extends below provisional ground'))]
                o['identityWarnings']=spatial
                o['reasons']=[reason for reason in o['reasons'] if reason not in spatial]
                if not o['reasons']:o['state']='proposed'
        semantic_state=record.get('semanticBaseline',{}).get('state','proposed')
        secondary_pass(rgb,raw,bench,semantic,semantic_state)
        context_check(raw,semantic,rgb,bench,semantic_state)
        fitted, summary = (deepcopy(raw),None) if args.no_fit else fit_openings.fit(rgb,raw)
        if args.layout_hypotheses or args.grid_completion:
            fitted=layout_hypotheses.propose(fitted,rgb,complete_missing=args.grid_completion)
        record['fitting'] = summary
        record['openings'] = fitted
        # Preserve conservative building/background classes. Replace the old
        # window labels only with bounded, cleaned SAM evidence; leaked masks
        # abstain. A rejected SAM mask does not revoke a valid DINO rectangle.
        semantic[np.isin(semantic,[2,4])] = 0
        for opening in fitted:
            if not opening.get('detector'):
                opening['maskEvidence']={'state':'unknown','reason':'Inferred grid cell has no detector prompt or source mask'}
                continue
            prompt = opening['detector']['box']
            candidates = [p for p in bench.get('samDinoClean',{}).get('proposals',[]) if p['promptBox']==prompt]
            if len(candidates)!=1:
                opening['maskEvidence']={'state':'unknown','reason':'No unique SAM mask for detector prompt'}
                continue
            p = candidates[0]
            verified_copy(args.benchmark,args.out,p['mask'],p['maskSha256'])
            opening['maskEvidence'] = {**p, 'state':'needs-review' if p['needsReview'] else 'proposed',
                                      'note':'Mask is bound to the raw detector prompt; clipped sampling extent is derived from the current fitted box.'}
            if p['needsReview'] or opening['state']!='proposed':continue
            mask = np.array(Image.open(args.out/p['mask']))>0
            if mask.shape!=semantic.shape:raise ValueError('SAM mask dimensions differ')
            x0,y0,x1,y1=opening['box']; inside=np.zeros_like(mask);inside[y0:y1,x0:x1]=True
            semantic[mask & inside] = 2 if opening['kind']=='door' else 4
        filename=record['id']+'.dino-sam-semantic.png'
        Image.fromarray(semantic).save(args.out/filename)
        record['mask']=filename;record['maskSha256']=sha(args.out/filename)
        appearance,valid = photo_appearance.analyse(rgb,semantic,record,preserve_boxes=True)
        record['appearance']=appearance;record['openings']=appearance['openings']
        if appearance['state']=='proposed':
            record['visibleRows']=appearance['region']['rows'];record['wallColour']=appearance['wall']['colour']
            if semantic_state=='unknown':
                colour=appearance['wall'].get('colour')
                if colour:
                    colour.update(basis='inferred',state='needs-review',
                                  note=(colour.get('note','')+' Geometric wall-envelope sampling cannot exclude foreground, glazing or neighboring surface pixels; review before treating this as wall colour.').strip())
                material=appearance['wall'].get('material')
                if material:
                    material.update(basis='inferred',state='needs-review')
                appearance['wall']['samplingContext']={
                    'state':'needs-review','basis':'inferred',
                    'note':'The registered wall envelope bounded sampling, but no independent semantic wall mask certified which pixels depict the wall surface.'}
            for b in record['openings']:b['appearance']=appearance['windows'].get(b['id'])
            # A reconstructed extent is not a new colour/bar observation. Sample
            # only its measured rectangle, then map measured lines into the
            # proposed geometry. The original sampling extent remains explicit.
            for b in record['openings']:
                reconstruction=b.get('reconstruction')
                if b['state']!='proposed' or not reconstruction:continue
                measured=reconstruction['measuredBox']
                if measured is None:
                    b['appearance']=None
                    appearance['windows'].pop(b['id'],None)
                    continue
                detail=photo_appearance.window_evidence(rgb,semantic,{**b,'box':measured})
                detail['sampleBox']=measured;detail['boundBox']=b['box']
                for bar in detail['bars']:
                    axis=0 if bar['axis']=='vertical' else 1
                    bar['fraction']=round((bar['sourceLine'][axis]-b['box'][axis])/(b['box'][axis+2]-b['box'][axis]),4)
                detail['note']+=' Sampling remains inside the measured extent; inferred extension supplies no colour evidence.'
                b['appearance']=detail
                appearance['windows'][b['id']]=detail
            filename=record['id']+'.wall-samples.png';Image.fromarray((valid*255).astype('uint8')).save(args.out/filename)
            appearance['wall'].update(samplingMask=filename,samplingMaskSha256=sha(args.out/filename))
        else:record.update(status='needs-review',reason=appearance['reason'])
        record['featureOntology']=feature_ontology.build(record)
        print(record['source']['address'],appearance.get('coverage'),summary and {'adjusted':summary['adjustedCount'],'attempted':summary['attemptedCount']},flush=True)
    run['openingStage']={'version':'dino-photo/1', 'inputManifestSha256':sha(args.input/'manifest.json'),
                         'benchmarkSha256':sha(args.benchmark/'report.json'), 'models':report['models'],
                         'runnerSha256':sha(Path(__file__)), 'fitSha256':sha(Path(fit_openings.__file__)),
                         'appearanceSha256':sha(Path(photo_appearance.__file__)), 'fittingEnabled':not args.no_fit,
                         'ontologySha256':sha(Path(feature_ontology.__file__)),
                         'imageStudy':args.image_study,'layoutHypotheses':args.layout_hypotheses,
                         'gridCompletion':args.grid_completion,
                         'layoutSha256':sha(Path(layout_hypotheses.__file__)),
                         'note':'Independent observation, fitted recipe and appearance stages. No acceptance is inherited.'}
    run['acceptance']='DINO/SAM, fitted geometry and appearance remain development proposals. Any registration-reviewed source disposition is retained per record and does not accept feature correctness or building identity.'
    (args.out/'manifest.json').write_text(json.dumps(run,indent=2)+'\n')


if __name__=='__main__':main()
