"""Measure named development failures. Does not turn the pilot into a gold set."""
import argparse
import hashlib
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from scipy.optimize import linear_sum_assignment
from photo_appearance import iou


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--before',type=Path,required=True)
    ap.add_argument('--after',type=Path,required=True)
    ap.add_argument('--labels',type=Path,default=Path('src/canalRecall/facade/fixtures/photo-appearance-development.json'))
    ap.add_argument('--out',type=Path,required=True)
    args=ap.parse_args()
    labels=json.loads(args.labels.read_text())
    runs=[json.loads((folder/'manifest.json').read_text()) for folder in [args.before,args.after]]
    records=[next(r for r in m['records'] if r['sourceSha256']==labels['sourceSha256']) for m in runs]
    image_path=args.after/records[1]['image']
    if sha(image_path)!=labels['sourceSha256']:
        raise ValueError('Image changed since development annotation')
    rgb=np.array(Image.open(image_path).convert('RGB'))
    colour_samples=np.concatenate([rgb[y0:y1,x0:x1].reshape(-1,3) for x0,y0,x1,y1 in labels['litWallPatches']])
    reference=np.median(colour_samples,axis=0)
    lab=lambda c: cv2.cvtColor(np.array([[c]],dtype=np.float32)/255,cv2.COLOR_RGB2Lab)[0,0]
    outcomes=[]
    for r in records:
        boxes=[b for b in r['openings'] if b['state']=='proposed']
        scores=np.array([[iou(label['box'],b['box']) for b in boxes] for label in labels['openings']])
        matched={}
        if len(boxes):
            rows,cols=linear_sum_assignment(-scores)
            matched={labels['openings'][i]['id']: {'proposalId':boxes[j]['id'],'iou':round(float(scores[i,j]),3)} for i,j in zip(rows,cols)}
        merged=0
        for b in boxes:
            coverage=[]
            for t in labels['openings']:
                a=t['box'];p=b['box'];intersection=max(0,min(a[2],p[2])-max(a[0],p[0]))*max(0,min(a[3],p[3])-max(a[1],p[1]))
                coverage.append(intersection/((a[2]-a[0])*(a[3]-a[1])))
            merged+=sum(c>.5 for c in coverage)>1
        negative={t['id']:sum(iou(t['box'],b['box'])>.3 for b in boxes) for t in labels['negativeRegions']}
        value=r['wallColour']['hex'];colour=[int(value[i:i+2],16) for i in [1,3,5]]
        outcomes.append({'matchedOpeningCountAtIoU05':sum(v['iou']>=.5 for v in matched.values()),'labelledOpeningCount':len(labels['openings']),
                         'matches':matched,'mergedAcrossLabelledStoreys':int(merged),'negativeRegionProposals':negative,
                         'wallColour':value,'wallCameraColourDeltaE76':round(float(np.linalg.norm(lab(colour)-lab(reference))),2)})
    line_result={'truePositive':0,'falsePositive':0,'falseNegative':0,'labelledWindows':len(labels['windowLines'])}
    for label in labels['windowLines']:
        opening=next((b for b in records[1]['openings'] if b['id']==label['openingId']),None)
        bars=opening.get('appearance',{}).get('bars',[]) if opening else []
        for axis,key,coord in [('horizontal','horizontalY',1),('vertical','verticalX',0)]:
            targets=list(label[key]);predicted=[b['sourceLine'][coord] for b in bars if b['axis']==axis and b['state']=='proposed']
            for p in predicted:
                if targets and min(abs(p-t) for t in targets)<=label['tolerancePx']:
                    target=min(targets,key=lambda t:abs(p-t));targets.remove(target);line_result['truePositive']+=1
                else:line_result['falsePositive']+=1
            line_result['falseNegative']+=len(targets)
    result={'scope':labels['note'],'sourceSha256':labels['sourceSha256'],'labelsSha256':sha(args.labels),
            'inputManifestHashes':[sha(folder/'manifest.json') for folder in [args.before,args.after]],
            'before':outcomes[0],'after':outcomes[1], 'lineCandidates':line_result,
            'referenceWallCameraRgb':reference.tolist(),
            'coverage':[{'address':r['source']['address'],'status':r['status'],**r.get('appearance',{}).get('coverage',{})} for r in runs[1]['records']],
            'limitations':['One previously examined development image; no confidence interval or generalisation claim',
                          'Two labelled opening rectangles and two lit wall patches do not certify the entire facade',
                          'Colour error compares camera RGB under the same lighting, not surface reflectance',
                          'Glazing-bar candidates still contain false positives; style acceptance remains separate']}
    args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'before':outcomes[0],'after':outcomes[1],'lines':line_result},indent=2))


if __name__=='__main__':main()
