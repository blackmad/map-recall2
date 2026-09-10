"""Compare independent opening paths and attribute each recovered proposal."""
import argparse
import hashlib
import html
import json
from pathlib import Path

import numpy as np
from scipy.optimize import linear_sum_assignment
from photo_appearance import iou


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def metric(openings, labels, negatives):
    boxes=[item['box'] for item in openings]
    matched=[0.0]*len(labels)
    if boxes and labels:
        matrix=np.array([[iou(label,box) for box in boxes] for label in labels])
        rows,cols=linear_sum_assignment(-matrix)
        for row,col in zip(rows,cols):matched[int(row)]=float(matrix[row,col])
    return {'proposalCount':len(boxes),'labelCount':len(labels),'matchedAtIoU05':sum(value>=.5 for value in matched),
            'recallAtIoU05':round(sum(value>=.5 for value in matched)/len(labels),4) if labels else None,
            'meanLabelIoU':round(float(np.mean(matched)),4) if matched else None,
            'explicitNegativeHits':sum(any(iou(box,negative)>.3 for negative in negatives) for box in boxes)}


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--context-run',type=Path,required=True)
    ap.add_argument('--ensemble-run',type=Path,required=True)
    ap.add_argument('--final-run',type=Path,required=True)
    ap.add_argument('--labels',type=Path,nargs='+',required=True)
    ap.add_argument('--out',type=Path,required=True)
    args=ap.parse_args()
    if args.out.exists():ap.error('Use a new immutable output directory')
    args.out.mkdir(parents=True)
    paths=[args.context_run/'manifest.json',args.ensemble_run/'manifest.json',args.final_run/'manifest.json']
    context,ensemble,final=[json.loads(path.read_text()) for path in paths]
    labels={case['sourceSha256']:case for source in args.labels for case in json.loads(source.read_text())['cases']}
    stage_records=[]
    for name,run in [('family-context',context),('cross-detector-ensemble',ensemble),('grid-and-roof-context',final)]:
        stage_records.append((name,{record['sourceSha256']:record for record in run['records']}))
    source_ids=set(stage_records[0][1])
    if any(set(records)!=source_ids for _,records in stage_records[1:]):raise ValueError('Runs do not contain identical sources')
    rows=[]
    for source_id in sorted(source_ids):
        records=[stage_records[i][1][source_id] for i in range(3)];record=records[-1]
        labelled=labels.get(source_id,{})
        truth=labelled.get('boxes',[]);negatives=labelled.get('negativeBoxes',[])
        baseline=[item for item in record.get('baselineOpenings',[]) if item['state']=='proposed']
        stages=[('semantic-cnn',baseline)]+[(name,[item for item in stage['openings'] if item['state']=='proposed']) for (name,_),stage in zip(stage_records,records)]
        ids=[set(item['id'] for item in items) for _,items in stages]
        contributions=[]
        # Semantic components use their own window-* IDs, so ID-set deltas are
        # meaningful only after the DINO candidate inventory has been fixed.
        for index in range(2,len(stages)):
            by_id={item['id']:item for item in stages[index][1]}
            contributions.append({'stage':stages[index][0],'addedIds':sorted(ids[index]-ids[index-1]),
                                  'removedIds':sorted(ids[index-1]-ids[index]),
                                  'evidence':{item_id:(by_id[item_id].get('secondaryCheck') or by_id[item_id].get('reconstruction'))
                                              for item_id in sorted(ids[index]-ids[index-1])}})
        rows.append({'address':record['source']['address'],'sourceSha256':source_id,
                     'approaches':{name:metric(items,truth,negatives) for name,items in stages},
                     'contributions':contributions})
    report={'schemaVersion':1,'runs':[{'path':str(path),'sha256':sha(path)} for path in paths],
            'labels':[{'path':str(path),'sha256':sha(path)} for path in args.labels],
            'approaches':{
                'semantic-cnn':'Independent Amsterdam-facade ONNX class components.',
                'family-context':'DINO rectangles, bounded SAM masks and repeated row/bay context.',
                'cross-detector-ensemble':'Adds low-score DINO candidates only when SAM, semantic opening pixels and classical rectangle edges agree.',
                'grid-and-roof-context':'Adds explicit dense-lattice cells and measured roof candidates supported by DINO, bounded SAM, four edges and lower facade windows.'},
            'records':rows,'acceptance':'Development comparison only. Recall is reported only where rectangle labels exist; unlabelled proposals are not counted as false positives.'}
    (args.out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    stage_names=list(report['approaches'])
    body=''.join(f'<tr><td>{html.escape(row["address"])}</td>'+''.join(
        f'<td>{row["approaches"][stage]["proposalCount"]}</td><td>{row["approaches"][stage]["matchedAtIoU05"]}/{row["approaches"][stage]["labelCount"]}</td>'
        for stage in stage_names)+f'<td><code>{html.escape(json.dumps(row["contributions"],separators=(",",":")))}</code></td></tr>' for row in rows)
    heads=''.join(f'<th colspan="2">{html.escape(stage)}</th>' for stage in stage_names)
    subs=''.join('<th>proposals</th><th>label recall</th>' for _ in stage_names)
    (args.out/'index.html').write_text(f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Opening detector comparison</title><style>body{{font:14px system-ui;margin:24px;background:#eeeae2;color:#24332d}}main{{max-width:1600px;margin:auto;background:white;padding:20px}}table{{border-collapse:collapse;width:100%}}th,td{{padding:7px;border:1px solid #d5d8d3;text-align:left;vertical-align:top}}code{{font-size:11px;overflow-wrap:anywhere}}</style><main><h1>Opening detector comparison</h1><p>{html.escape(report['acceptance'])}</p><table><thead><tr><th rowspan="2">facade</th>{heads}<th rowspan="2">stage contributions</th></tr><tr>{subs}</tr></thead><tbody>{body}</tbody></table></main></html>''')
    for row in rows:
        print(row['address'],{name:(value['proposalCount'],value['matchedAtIoU05'],value['labelCount']) for name,value in row['approaches'].items()},
              [(item['stage'],item['addedIds']) for item in row['contributions'] if item['addedIds']])
    print(args.out)


if __name__=='__main__':main()
