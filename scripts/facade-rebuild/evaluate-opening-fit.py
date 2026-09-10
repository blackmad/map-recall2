"""Score cached raw/fitted boxes and named recovery cases without model calls."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from scipy.optimize import linear_sum_assignment
from photo_appearance import iou


def score(boxes, labels):
    matched=[0.]*len(labels)
    edge_errors=[]
    if labels and boxes:
        matrix=np.array([[iou(a,b) for b in boxes] for a in labels])
        rows,cols=linear_sum_assignment(-matrix)
        for i,j in zip(rows,cols):
            matched[int(i)]=float(matrix[i,j])
            if matrix[i,j]>=.5:edge_errors.extend(abs(a-b) for a,b in zip(labels[i],boxes[j]))
    return {'labelledFrames':len(labels),'matchedAtIoU05':sum(v>=.5 for v in matched),
            'meanIoU':round(float(np.mean(matched)),4) if matched else None,
            'edgeMeanAbsoluteErrorPx':round(float(np.mean(edge_errors)),3) if edge_errors else None}


def negative_hits(boxes, negatives):
    return sum(any(iou(box, negative)>.3 for negative in negatives) for box in boxes)


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--runs',type=Path,nargs='+',required=True)
    ap.add_argument('--labels',type=Path,nargs='+',required=True)
    ap.add_argument('--out',type=Path,required=True)
    args=ap.parse_args()
    if args.out.exists():ap.error('Use a new report filename')
    labels={c['sourceSha256']:c for p in args.labels for c in json.loads(p.read_text())['cases']}
    recovery=json.loads(Path('src/canalRecall/facade/fixtures/opening-recovery-development.json').read_text())
    report={'records':[], 'inputs':[], 'notes':'Development rectangle checks with separate fully visible, partial, occluded and explicit-negative denominators. Unlabelled proposals are not false positives; appearance and geographic identity are unmeasured.'}
    gates=[]
    for root in args.runs:
        manifest=root/'manifest.json';run=json.loads(manifest.read_text())
        report['inputs'].append({'path':str(manifest),'sha256':hashlib.sha256(manifest.read_bytes()).hexdigest()})
        for r in run['records']:
            if 'rawOpenings' not in r:continue
            lab=labels.get(r['sourceSha256'],{}).get('boxes',[])
            labelled=labels.get(r['sourceSha256'],{})
            partial=labelled.get('partialBoxes',[]);occluded=labelled.get('occludedBoxes',[]);negatives=labelled.get('negativeBoxes',[])
            raw_boxes=[o['box'] for o in r['rawOpenings']]
            fitted_boxes=[o['box'] for o in r['openings']]
            rendered_boxes=[o['box'] for o in r['openings'] if o['state']=='proposed']
            measured_boxes=[o.get('reconstruction',{}).get('measuredBox',o['box']) for o in r['openings']
                            if o.get('reconstruction',{}).get('measuredBox',o['box']) is not None]
            inferred_only=[o for o in r['openings'] if o.get('reconstruction',{}).get('measuredBox','present') is None]
            entry={'address':r['source']['address'], 'sourceSha256':r['sourceSha256'],
                   'baseline':score([o['box'] for o in r['baselineOpenings'] if o['state']=='proposed'],lab),
                   'rawCandidates':score(raw_boxes,lab),
                   'measuredGeometry':score(measured_boxes,lab),
                   'fittedCandidates':score(fitted_boxes,lab),
                   'renderEligible':score(rendered_boxes,lab),
                   'partial':{'raw':score(raw_boxes,partial),'renderEligible':score(rendered_boxes,partial)},
                   'occluded':{'raw':score(raw_boxes,occluded),'renderEligible':score(rendered_boxes,occluded)},
                   'explicitNegatives':{'labelledRegions':len(negatives),'rawHits':negative_hits(raw_boxes,negatives),
                                        'renderHits':negative_hits(rendered_boxes,negatives)},
                   'families':[{**family,'raw':score(raw_boxes,family['boxes']),'fitted':score(fitted_boxes,family['boxes'])}
                               for family in labelled.get('families',[])],
                   'coverage':labelled.get('coverage'),
                   'fitting':r['fitting'], 'inferredOnlyCount':len(inferred_only),
                   'inferredOnlyIds':[o['id'] for o in inferred_only],
                   'renderCount':sum(o['state']=='proposed' for o in r['openings']),
                   'unknownCount':sum(o['state']!='proposed' for o in r['openings']),
                   'renderedVersusDetectedOmissions':sum(o['state']!='proposed' for o in r['openings'])}
            if lab:
                before=entry['rawCandidates'];after=entry['fittedCandidates']
                entry['fitGatePassed']=after['matchedAtIoU05']>=before['matchedAtIoU05'] and after['meanIoU']>=before['meanIoU']-.02
                gates.append(entry['fitGatePassed'])
            if negatives:gates.append(entry['explicitNegatives']['renderHits']==0)
            if r['sourceSha256']==recovery['sourceSha256']:
                candidates=[o for o in r['openings'] if o['state']=='proposed']
                matches=[o for o in candidates if iou(o['box'],recovery['requiredCandidate'])>=.5]
                negatives=[o for o in candidates if iou(o['box'],recovery['negativeCandidate'])>.3]
                entry['namedRecovery']={'name':recovery['name'],'recovered':bool(matches),'headlightProposals':len(negatives),
                                        'evidence':[o.get('secondaryCheck') for o in matches]}
                gates.append(bool(matches) and not negatives)
            gates.append(all(not o.get('fit',{}).get('applied') or o['fit']['maximumMovePx']<=5 for o in r['openings']))
            report['records'].append(entry)
    report['gatesPassed']=all(gates) and bool(gates)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(report,indent=2)+'\n')
    for r in report['records']:print(r['address'],r['rawCandidates'],r['fittedCandidates'],'render',r['renderCount'],'unknown',r['unknownCount'])
    print('GATES',report['gatesPassed'])
    if not report['gatesPassed']:raise SystemExit(1)


if __name__=='__main__':main()
