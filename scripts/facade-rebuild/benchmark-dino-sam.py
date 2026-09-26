"""Reproducible local Grounding DINO + SAM2 image benchmark. No hosted inference.

--models points to a catalog of pinned, already-downloaded HF snapshot paths.
SAM is measured with DINO boxes and separately with reference boxes; it is not
a second independent window detector. Model scores are not measured accuracy.
"""
import argparse
import gc
import hashlib
import html
import json
import platform
import resource
import shutil
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy.optimize import linear_sum_assignment
from scipy import ndimage
import torch
import transformers
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection, Sam2Processor, Sam2Model

PROMPT='a window. a door.'
THRESHOLD=.30


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def iou(a,b):
    x=max(0,min(a[2],b[2])-max(a[0],b[0]));y=max(0,min(a[3],b[3])-max(a[1],b[1]))
    intersection=x*y
    return intersection/max(1,(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-intersection)


def evaluate(boxes, reference):
    targets=reference['boxes']
    scores=np.array([[iou(a,b) for b in boxes] for a in targets])
    matched=[0.]*len(targets)
    if boxes and targets:
        rows,cols=linear_sum_assignment(-scores)
        for i,j in zip(rows,cols):matched[int(i)]=float(scores[i,j])
    return {'labelledFrames':len(targets),'matchesAtIoU05':sum(s>=.5 for s in matched),
            'meanMatchedIoUIncludingMisses':round(float(np.mean(matched)),3) if matched else None,
            'perFrameIoU':[round(s,3) for s in matched],
            'negativeBoxOverlaps':sum(any(iou(b,n)>.3 for n in reference.get('negativeBoxes',[])) for b in boxes),
            'unlabelledProposalsNotScoredAsFalsePositives':True}


def nms(items):
    chosen=[]
    for item in sorted(items,key=lambda i:-i['score']):
        if not any(iou(item['box'],prev['box'])>.5 for prev in chosen):chosen.append(item)
    return chosen[:40]


def sync(device):
    if device=='mps':torch.mps.synchronize()


def memory(device):
    return {'processPeakRssMiB':round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/(1024**2 if platform.system()=='Darwin' else 1024),1),
            'mpsAllocatedMiB':round(torch.mps.current_allocated_memory()/1024**2,1) if device=='mps' else None,
            'mpsDriverMiB':round(torch.mps.driver_allocated_memory()/1024**2,1) if device=='mps' else None}


def overlay(record, stage, out):
    palette=['#2ac5ff','#ffb548','#ee74f0','#59e69b','#f57d7d']
    parts=[f'<svg viewBox="0 0 {record["width"]} {record["height"]}" xmlns="http://www.w3.org/2000/svg"><image href="{html.escape(record["image"])}" width="{record["width"]}" height="{record["height"]}"/>']
    for index,p in enumerate(stage.get('proposals',[])):
        c=palette[index%len(palette)]
        if p.get('mask'):
            mask=np.array(Image.open(out/p['mask']))
            contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
            for contour in contours:
                if cv2.contourArea(contour)<5:continue
                points=cv2.approxPolyDP(contour,1,True)[:,0,:]
                coords=' '.join(f'{x},{y}' for x,y in points)
                parts.append(f'<polygon points="{coords}" fill="{c}" fill-opacity=".25" stroke="{c}" stroke-width="1"/>')
        x0,y0,x1,y1=p['box']
        parts.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="none" stroke="{c}" stroke-width="1.4"/><text x="{x0+2}" y="{y0+10}" fill="white" stroke="black" stroke-width=".3" font-size="9">{index+1}</text>')
    parts.append('</svg>')
    return ''.join(parts)


def report_html(report,out):
    cards=[]
    for record in report['records']:
        panels=[]
        names=['baseline','dino','samDinoClean' if 'samDinoClean' in record else 'samDino','samReferenceClean' if 'samReferenceClean' in record else 'samReference']
        for name in names:
            stage=record.get(name)
            if not stage:continue
            score=stage['evaluation'];timing=stage.get('timesSeconds',[])
            labels={'baseline':'Previous detector','dino':'DINO boxes','samDino':'SAM · DINO prompts','samDinoClean':'Cleaned SAM · DINO prompts','samReference':'SAM · reference prompts','samReferenceClean':'Cleaned SAM · reference prompts'}
            metric=(f'{score["matchesAtIoU05"]}/{score["labelledFrames"]} annotated frames at IoU ≥ .5; mean IoU {score["meanMatchedIoUIncludingMisses"]}. Other openings are not scored.' if score['labelledFrames'] else 'No labelled frames on this image; accuracy unmeasured.')
            elapsed=f'{html.escape(str(timing))} seconds' if timing else 'Derived result; see model timing above.'
            panels.append(f'<section><h3>{labels[name]}</h3>{overlay(record,stage,out)}<p>{len(stage.get("proposals",[]))} proposals. {metric}</p><p>{elapsed}</p></section>')
        cards.append(f'<h2>{html.escape(record["address"])}</h2><div class="row">'+''.join(panels)+'</div>')
    body=''.join(cards)
    totals=[]
    for key in ['baseline','dino','samDino','samDinoClean','samReference','samReferenceClean']:
        stages=[r[key] for r in report['records'] if key in r]
        if not stages:continue
        n=sum(s['evaluation']['labelledFrames'] for s in stages);matched=sum(s['evaluation']['matchesAtIoU05'] for s in stages)
        warm=[t for s in stages for t in s.get('timesSeconds',[])[1:]]
        timing=f'{np.median(warm):.3f} s warm median' if warm else 'derived result'
        totals.append(f'<li>{key}: {matched}/{n} labelled frame matches; {timing}</li>')
    body='<p>Box threshold '+str(report['boxThreshold'])+'. Component-cleaned SAM keeps its largest connected region; raw masks and both scores remain in report.json. This is a development comparison, not a blind benchmark.</p><ul>'+''.join(totals)+'</ul>'+body
    reviewed=report.get('sourceReview');diagnostics=reviewed and 'diagnostic-only' in reviewed['includedDispositions']
    source_status=(('Inputs passed the pinned raw-panorama registration review; diagnostic-only sources were included.' if diagnostics else 'Inputs passed the pinned raw-panorama registration review; diagnostic-only sources were excluded.') if reviewed else 'No registration-review fixture was supplied.')
    (out/'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local DINO / SAM benchmark</title><style>body{font:14px system-ui;margin:24px;background:#f5f2eb;color:#293731}.row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}section{background:white;padding:12px;border:1px solid #d3d6cf}svg{height:460px;width:100%}p{font-size:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere}section{min-width:0}@media(max-width:800px){.row{grid-template-columns:1fr 1fr}}</style><h1>Local Grounding DINO + SAM 2.1</h1><p>Frozen development inputs. '+source_status+' SAM uses box prompts. Its reference-box run isolates segmentation from detection. Rectangle labels do not establish pixel-mask accuracy.</p>'+body+'<h2>Run metadata</h2><pre>'+html.escape(json.dumps({k:v for k,v in report.items() if k!='records'},indent=2))+'</pre></html>')


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--input',type=Path,required=True)
    ap.add_argument('--models',type=Path,required=True)
    ap.add_argument('--labels',type=Path,default=Path('src/canalRecall/facade/fixtures/dino-sam-development.json'))
    ap.add_argument('--review',type=Path,help='Pinned source-registration review; only usable dispositions run')
    ap.add_argument('--include-diagnostic',action='store_true',help='Also run diagnostic-only sources from --review')
    ap.add_argument('--out',type=Path,required=True)
    ap.add_argument('--device',choices=['mps','cpu'],default='mps')
    ap.add_argument('--repeats',type=int,default=3)
    ap.add_argument('--box-threshold',type=float,default=THRESHOLD)
    ap.add_argument('--text-threshold',type=float,default=.25)
    ap.add_argument('--all-inputs',action='store_true',help='Include unlabelled input images; report no accuracy for them')
    ap.add_argument('--target',action='append',help='Limit to exact source address; repeatable')
    ap.add_argument('--tile-retry',action='store_true',help='Three overlapping horizontal crops; add uncovered candidates only')
    args=ap.parse_args()
    if args.out.exists():ap.error('Use a new immutable output directory')
    if args.repeats<1:ap.error('repeats must be positive')
    if not .2 <= args.box_threshold <= 1:ap.error('box-threshold must be between .2 and 1 (raw proposal floor is .2)')
    torch.manual_seed(0);torch.set_num_threads(8)
    if args.device=='mps' and not torch.backends.mps.is_available():ap.error('MPS unavailable')
    catalog=json.loads(args.models.read_text());source=json.loads((args.input/'manifest.json').read_text());labels=json.loads(args.labels.read_text())
    review=None;review_by_hash={};allowed_dispositions={'usable-development','usable-hard-negative'}
    if args.include_diagnostic and not args.review:ap.error('--include-diagnostic requires --review')
    if args.review:
        review=json.loads(args.review.read_text())
        if Path(review['sourceRun']).resolve()!=args.input.resolve():ap.error('--review sourceRun does not match --input')
        if review['sourceManifestSha256']!=sha(args.input/'manifest.json'):ap.error('--review does not pin this source manifest')
        if 'strips' not in source:ap.error('--review currently requires a strip manifest')
        review_by_hash={r['sourceSha256']:r for r in review['cases']}
        if len(review_by_hash)!=len(review['cases']):ap.error('--review contains duplicate source hashes')
        strip_by_hash={r['sourceSha256']:r for r in source['strips']};manifest_hashes=set(strip_by_hash)
        if set(review_by_hash)!=manifest_hashes:ap.error('--review must cover every source strip exactly once')
        known=allowed_dispositions|{'diagnostic-only'}
        if any(r['disposition'] not in known for r in review['cases']):ap.error('--review contains an unknown disposition')
        if any(strip_by_hash[h]['pandId']!=r['pandId'] for h,r in review_by_hash.items()):ap.error('--review BAG ids do not match the source strips')
        if args.include_diagnostic:allowed_dispositions.add('diagnostic-only')
    references={r['sourceSha256']:r for r in labels['cases']}
    records=[];images=[]
    args.out.mkdir(parents=True)
    source_records=source.get('records')
    if source_records is None:
        source_records=[]
        for strip in source.get('strips',[]):
            image=Image.open(args.input/strip['file'])
            source_records.append({'id':Path(strip['file']).stem,'source':strip,
                                   'sourceSha256':strip['sourceSha256'],'width':image.width,'height':image.height,
                                   'image':strip['file'],'status':'proposed','openings':[]})
    for r in source_records:
        if args.target and r['source']['address'] not in args.target:continue
        if r['status']!='proposed' or (r['sourceSha256'] not in references and not args.all_inputs):continue
        review_case=review_by_hash.get(r['sourceSha256'])
        if review and review_case['disposition'] not in allowed_dispositions:continue
        references.setdefault(r['sourceSha256'], {'boxes':[], 'negativeBoxes':[]})
        path=args.input/r['image']
        if path.name!=r['image'] or sha(path)!=r['sourceSha256']:raise ValueError('Source image changed')
        shutil.copyfile(path,args.out/r['image'])
        images.append(Image.open(path).convert('RGB'))
        proposals=[{'box':b['box'],'id':b['id']} for b in r['openings'] if b['state']=='proposed']
        record={'id':r['id'],'address':r['source']['address'],'image':r['image'],'width':r['width'],'height':r['height'],
                'sourceSha256':r['sourceSha256'],'baseline':{'proposals':proposals,'evaluation':evaluate([p['box'] for p in proposals],references[r['sourceSha256']])}}
        if review_case:record['sourceReview']={'pandId':review_case['pandId'],'disposition':review_case['disposition'],'review':review_case['review']}
        records.append(record)
    report={'schemaVersion':1,'device':args.device,'dtype':'float32','torch':torch.__version__,'transformers':transformers.__version__,
            'machine':platform.platform(),'seed':0,'prompt':PROMPT,'boxThreshold':args.box_threshold,'textThreshold':args.text_threshold,'nmsIoU':.5,
            'tileRetry':{'enabled':args.tile_retry,'bands':[[0,.55],[.225,.775],[.45,1]],'maximumAttemptsPerSource':3,
                         'merge':'augment only; no replacement of full-frame proposals; reject internal crop-edge truncation'},
            'labelsSha256':sha(args.labels),'sourceManifestSha256':sha(args.input/'manifest.json'),'scriptSha256':sha(Path(__file__)),
            'labelsNote':labels['note'],'records':records,'models':catalog,'loads':{},'memorySamples':[],
            'timingDefinition':'Synchronized end-to-end preprocessing + forward + postprocessing, excludes disk writes. First run includes initial kernel compilation; repeated runs reuse loaded weights.',
            'memoryDefinition':'Process peak RSS is cumulative; MPS driver memory is sampled after calls, includes caches and is not an exact peak.',
            'network':'Only checkpoint acquisition; source images remain local. Inference uses local_files_only.'}
    if review:
        report['sourceReview']={'path':str(args.review),'sha256':sha(args.review),'schemaVersion':review['schemaVersion'],
                                'reviewedAt':review['reviewedAt'],'method':review['reviewMethod'],
                                'includedDispositions':sorted(allowed_dispositions),
                                'excludedDiagnosticCount':sum(r['disposition']=='diagnostic-only' for r in review['cases']) if not args.include_diagnostic else 0}
    def save():
        (args.out/'report.json').write_text(json.dumps(report,indent=2)+'\n');report_html(report,args.out)
    for c in catalog:
        c['files']=[{'file':p.name,'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(Path(c['path']).glob('*')) if p.is_file() and p.suffix in ['.json','.safetensors','.txt']]
    spec=next(c for c in catalog if 'grounding-dino' in c['repo'])
    t=time.perf_counter();processor=AutoProcessor.from_pretrained(spec['path'],local_files_only=True)
    model=AutoModelForZeroShotObjectDetection.from_pretrained(spec['path'],local_files_only=True,dtype=torch.float32,disable_custom_kernels=True).to(args.device).eval()
    sync(args.device);report['loads']['dinoSeconds']=round(time.perf_counter()-t,3);print('DINO loaded',report['loads']['dinoSeconds'],flush=True)
    for r,image in zip(records,images):
        times=[];raw=[];selected=[]
        for repeat in range(args.repeats):
            sync(args.device);t=time.perf_counter()
            inputs=processor(images=image,text=PROMPT,return_tensors='pt').to(args.device)
            with torch.inference_mode():output=model(**inputs)
            processed=processor.post_process_grounded_object_detection(output,inputs.input_ids,threshold=.20,text_threshold=args.text_threshold,target_sizes=[image.size[::-1]])[0]
            text_labels=processed['text_labels'] if 'text_labels' in processed else processed['labels']
            raw=[{'box':[round(float(v),3) for v in b.tolist()],'score':round(float(s),5),'label':str(label)} for b,s,label in zip(processed['boxes'].cpu(),processed['scores'].cpu(),text_labels)]
            selected=nms([p for p in raw if p['score']>=args.box_threshold])
            if args.tile_retry:
                for lo,hi in [(0,.55),(.225,.775),(.45,1)]:
                    top,bottom=round(image.height*lo),round(image.height*hi)
                    crop=image.crop((0,top,image.width,bottom))
                    tile_inputs=processor(images=crop,text=PROMPT,return_tensors='pt').to(args.device)
                    with torch.inference_mode():tile_output=model(**tile_inputs)
                    tile=processor.post_process_grounded_object_detection(tile_output,tile_inputs.input_ids,threshold=.20,text_threshold=args.text_threshold,target_sizes=[crop.size[::-1]])[0]
                    candidates=[]
                    for b,s,label in zip(tile['boxes'].cpu(),tile['scores'].cpu(),tile['text_labels']):
                        box=[round(float(v),3) for v in b.tolist()]
                        if (top>0 and box[1]<3) or (bottom<image.height and box[3]>crop.height-3):continue
                        box[1]+=top;box[3]+=top
                        candidate={'box':box,'score':round(float(s),5),'label':str(label),'sourceCrop':[0,top,image.width,bottom]}
                        raw.append(candidate)
                        if candidate['score']>=args.box_threshold:candidates.append(candidate)
                    for candidate in nms(candidates):
                        a=candidate['box'];area=max(1,(a[2]-a[0])*(a[3]-a[1]))
                        def covered(p):
                            b=p['box'];intersection=max(0,min(a[2],b[2])-max(a[0],b[0]))*max(0,min(a[3],b[3])-max(a[1],b[1]))
                            return iou(a,b)>.3 or intersection/area>.9
                        if not any(covered(p) for p in selected) and len(selected)<60:selected.append(candidate)
                    del tile_inputs,tile_output,tile
            sync(args.device);times.append(round(time.perf_counter()-t,3));report['memorySamples'].append({'stage':'dino','image':r['address'],**memory(args.device)})
            print('DINO',r['address'],repeat+1,times[-1],'s',len(selected),'boxes',flush=True)
        r['dino']={'timesSeconds':times,'rawAbove02':raw,'proposals':selected,'evaluation':evaluate([p['box'] for p in selected],references[r['sourceSha256']])};save()
    del model,processor,inputs,output,processed;gc.collect()
    if args.device=='mps':torch.mps.empty_cache()
    spec=next(c for c in catalog if 'sam2' in c['repo'])
    t=time.perf_counter();processor=Sam2Processor.from_pretrained(spec['path'],local_files_only=True)
    model,loading=Sam2Model.from_pretrained(spec['path'],local_files_only=True,dtype=torch.float32,output_loading_info=True)
    report['samLoadingInfo']={k:sorted(v) if isinstance(v,set) else v for k,v in loading.items()}
    if any(loading.values()):raise ValueError('SAM checkpoint did not load cleanly')
    model=model.to(args.device).eval()
    sync(args.device);report['loads']['samSeconds']=round(time.perf_counter()-t,3);print('SAM loaded',report['loads']['samSeconds'],flush=True)
    for r,image in zip(records,images):
        for key,boxes in [('samDino',[p['box'] for p in r['dino']['proposals']]),('samReference',references[r['sourceSha256']]['boxes'])]:
            if not boxes:continue
            times=[]
            for repeat in range(args.repeats):
                sync(args.device);t=time.perf_counter()
                inputs=processor(images=image,input_boxes=[boxes],return_tensors='pt').to(args.device)
                with torch.inference_mode():output=model(**inputs,multimask_output=True)
                masks=processor.post_process_masks(output.pred_masks.cpu(),inputs['original_sizes'].cpu())[0]
                scores=output.iou_scores[0].cpu().numpy()
                selected_masks=[masks[i,int(scores[i].argmax())].numpy().astype('uint8') for i in range(len(boxes))]
                sync(args.device);times.append(round(time.perf_counter()-t,3));report['memorySamples'].append({'stage':key,'image':r['address'],**memory(args.device)})
                print('SAM',key,r['address'],repeat+1,times[-1],'s',len(boxes),'box prompts',flush=True)
            proposals=[]
            for i,mask in enumerate(selected_masks):
                ys,xs=np.nonzero(mask)
                if not len(xs):continue
                filename=f'{r["id"]}.{key}.{i}.png';Image.fromarray(mask*255).save(args.out/filename)
                proposals.append({'box':[int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1],
                                  'promptBox':boxes[i],'mask':filename,'maskSha256':sha(args.out/filename),'maskPixels':int(mask.sum()),
                                  'modelPredictedIoU':round(float(scores[i].max()),5)})
            r[key]={'timesSeconds':times,'promptCount':len(boxes),'proposals':proposals,'evaluation':evaluate([p['box'] for p in proposals],references[r['sourceSha256']])}
            t=time.perf_counter();clean=[]
            for p in proposals:
                mask=np.array(Image.open(args.out/p['mask']))>0
                components,count=ndimage.label(mask);areas=np.bincount(components.ravel());areas[0]=0
                keep=components==areas.argmax();ys,xs=np.nonzero(keep)
                filename=p['mask'].replace('.png','.component.png');Image.fromarray(keep.astype('uint8')*255).save(args.out/filename)
                x0,y0,x1,y1=map(int,p['promptBox']);outside=1-float(keep[max(0,y0):max(0,y1),max(0,x0):max(0,x1)].sum())/float(keep.sum())
                clean.append({**p,'box':[int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1],
                              'mask':filename,'maskSha256':sha(args.out/filename),'maskPixels':int(keep.sum()),
                              'retainedPixelFraction':round(float(keep.sum()/mask.sum()),4),'outsidePromptFraction':round(outside,4),
                              'needsReview':outside>.15})
            r[key+'Clean']={'method':'largest-connected-component; raw mask retained','componentFilteringSeconds':round(time.perf_counter()-t,4),
                           'proposals':clean,'evaluation':evaluate([p['box'] for p in clean],references[r['sourceSha256']])};save()
    report['complete']=True;save();print('COMPLETE',args.out,flush=True)


if __name__=='__main__':main()
