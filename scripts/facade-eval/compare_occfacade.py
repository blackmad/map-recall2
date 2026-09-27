"""Compare same-source OccFacade/Vistas masks and same-capture context ablation.
Writes diagnostics only. Agreement is not accuracy; predicted visible wall is
not certified masonry. No game data or acceptance state is modified.
"""
import argparse,hashlib,html,json,statistics
from pathlib import Path
import numpy as np
from PIL import Image


def sha(p):
    with open(p,'rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()


def check(p,expected):
    if sha(p)!=expected:raise ValueError(f'Hash mismatch: {p}')


def masked(rgb,mask):
    out=np.full_like(rgb,230);out[mask]=rgb[mask];return Image.fromarray(out)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['pilot','vistas','out']:p.add_argument('--'+name,type=Path,required=True)
    for name in ['context-input','context']:p.add_argument('--'+name,type=Path)
    p.add_argument('--wall-only',action='store_true')
    p.add_argument('--review',type=Path)
    a=p.parse_args()
    if a.out.exists():raise SystemExit('Use a fresh output directory')
    pilot=json.loads((a.pilot/'receipt.json').read_text()); vistas=json.loads((a.vistas/'s1.provenance.json').read_text())
    if not a.wall_only and (not a.context or not a.context_input):p.error('Context paths required unless --wall-only')
    if not a.wall_only:
        contexts=json.loads((a.context/'receipt.json').read_text()); transforms=json.loads((a.context_input/'manifest.json').read_text())
        check(a.context_input/'manifest.json',contexts['manifestSha256']);check(a.pilot/'receipt.json',transforms['pilotReceiptSha256'])
        if contexts['checkpointSha256']!=pilot['checkpointSha256']:raise ValueError('Different OccFacade checkpoints')
    if vistas['classMapping']['contract']['2']!='building':raise ValueError('Unexpected Vistas class contract')
    strips=Path(vistas['stripsDir']);check(strips/'manifest.json',vistas['sourceManifestSha256'])
    a.out.mkdir(parents=True)
    reviews=json.loads(a.review.read_text())['records'] if a.review else []
    rows=[];cards=[]
    for r in pilot['records']:
        if r['kind']!='full':continue
        name=f'{r["index"]:03d}';source=Path(r['sourcePath']);check(source,r['sourceSha256'])
        occpath=a.pilot/f'{name}-full-labels.png';check(occpath,r['labelsSha256'])
        vr=next(x for x in vistas['records'] if x['stem']==r['sourceSha256'])
        vp=a.vistas/vr['mask'];check(vp,vr['maskSha256']);check(strips/vr['file'],r['sourceSha256'])
        rgb=np.array(Image.open(source).convert('RGB'));occ=np.array(Image.open(occpath));v=np.array(Image.open(vp))
        if occ.shape!=v.shape or occ.shape!=rgb.shape[:2]:raise ValueError('Dimensions differ')
        occwall=occ==5; building=v==2; combined=occwall & building
        Image.fromarray((combined*255).astype('uint8')).save(a.out/f'{name}-combined.png')
        for suffix,mask in [('occ',occwall),('vistas',building),('combined',combined)]:
            masked(rgb,mask).save(a.out/f'{name}-{suffix}.jpg',quality=95)
        Image.fromarray(rgb).save(a.out/f'{name}-source.jpg',quality=95)
        agreement=None; crop_box=None
        if not a.wall_only:
            transform=next(x for x in transforms['transforms'] if x['index']==r['index'])
            if transform['sourceSha256']!=r['sourceSha256']:raise ValueError('Wrong parent crop')
            cr=next(x for x in contexts['records'] if x['index']==r['index'])
            if cr['sourceSha256']!=transform['cropSha256']:raise ValueError('Wrong child crop')
            check(cr['sourcePath'],cr['sourceSha256'])
            cp=a.context/f'{name}-ground-labels.png';check(cp,cr['labelsSha256'])
            x,y,w,h=transform['cropBoxPx']; fullground=occ[y:h,x:w]; closeup=np.array(Image.open(cp))
            if fullground.shape!=closeup.shape:raise ValueError('Context crop dimensions differ')
            palette=np.array(pilot['palette'],dtype='uint8')
            Image.fromarray(rgb[y:h,x:w]).save(a.out/f'{name}-ground.jpg',quality=95)
            Image.fromarray(palette[fullground]).save(a.out/f'{name}-full-context.png')
            Image.fromarray(palette[closeup]).save(a.out/f'{name}-close-context.png')
            agreement=float((fullground==closeup).mean()); crop_box=transform['cropBoxPx']
        record={'index':r['index'],'address':r['address'],'sourceSha256':r['sourceSha256'],'occMaskSha256':r['labelsSha256'],
                'vistasMaskSha256':vr['maskSha256'],'combinedMaskSha256':sha(a.out/f'{name}-combined.png'),
                'wallPixelsOcc':int(occwall.sum()),'wallPixelsCombined':int(combined.sum()),
                'occWallRejectedByVistasFraction':float((occwall & ~building).sum()/max(1,occwall.sum())),
                'occWallOccluderFraction':float((occwall & (v==3)).sum()/max(1,occwall.sum())),
                'sameCaptureClassAgreement':agreement,
                'photoMedianOcc':np.median(rgb[occwall],axis=0).tolist() if occwall.any() else None,
                'photoMedianCombined':np.median(rgb[combined],axis=0).tolist() if combined.any() else None,
                'cropBoxPx':crop_box,'sourceIdentity':'not-certified'}
        rows.append(record)
        review=next((x for x in reviews if x['index']==r['index']),None)
        if review:
            if review['sourceSha256']!=r['sourceSha256'] or review['combinedMaskSha256']!=record['combinedMaskSha256']:
                raise ValueError('Visual review is stale for this source/mask')
            if review['status'] not in ['withhold-colour','limited-evidence']:
                raise ValueError('Unsupported visual review status')
            record['visualReview']=review
            if review['status']=='withhold-colour':
                record['photoMedianCombined']=None
        record['measurementEligibility']='withheld-by-visual-audit' if review and review['status']=='withhold-colour' else 'unaccepted-diagnostic-only'
        wallfigs=''.join(f'<figure><img loading="lazy" src="{name}-{s}.jpg"><figcaption>{label}</figcaption></figure>' for s,label in [('source','Source'),('occ','OccFacade wall'),('vistas','Vistas building (includes windows)'),('combined','Intersection candidate')])
        context_html=''
        if not a.wall_only:
            contextfigs=''.join(f'<figure><img loading="lazy" src="{name}-{suffix}"><figcaption>{label}</figcaption></figure>' for suffix,label in [('ground.jpg','Same-photo lower crop'),('full-context.png','Prediction with whole-facade context'),('close-context.png','Prediction on lower crop alone')])
            context_html=f'<h3>Context test — identical photo pixels</h3><p>Class agreement {agreement:.1%}; no accuracy claim.</p><div class="context">{contextfigs}</div>'
        review_html=f'<p><strong>{html.escape(review["status"])}</strong>: {html.escape(review["note"])}</p>' if review else '<p>Not visually audited in this pass; no colour acceptance.</p>'
        cards.append(f'<article id="case-{name}"><h2>{r["index"]}: {html.escape(r["address"])}</h2>{review_html}<p>Vistas rejects {record["occWallRejectedByVistasFraction"]:.1%} of OccFacade wall pixels. This measures disagreement, not correctness.</p><div class="grid">{wallfigs}</div>{context_html}</article>')
    receipt={'policy':'Diagnostic unaccepted intersection and context ablation; no ground truth accuracy',
             'runnerSha256':sha(__file__),'pilotReceiptSha256':sha(a.pilot/'receipt.json'),'vistasProvenanceSha256':sha(a.vistas/'s1.provenance.json'),
             'visualReviewSha256':sha(a.review) if a.review else None,
             'contextReceiptSha256':sha(a.context/'receipt.json') if not a.wall_only else None,'contextManifestSha256':sha(a.context_input/'manifest.json') if not a.wall_only else None,
             'medianSameCaptureClassAgreement':statistics.median(x['sameCaptureClassAgreement'] for x in rows) if not a.wall_only else None,'records':rows}
    (a.out/'comparison.json').write_text(json.dumps(receipt,indent=2)+'\n')
    page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>OccFacade context and visible wall test</title><style>body{font:16px system-ui;background:#f7f5ef;color:#252922;margin:24px}article{background:white;padding:16px;margin:24px 0;border:1px solid #ddd}.grid,.context{display:grid;gap:8px;grid-template-columns:repeat(4,minmax(0,1fr))}.context{grid-template-columns:repeat(3,minmax(0,1fr))}figure{margin:0}img{width:100%;height:430px;object-fit:contain;background:#eee}.context img{height:230px}figcaption{font-size:13px}@media(max-width:750px){body{margin:10px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.context{grid-template-columns:1fr}img{height:300px}}</style><h1>OccFacade: visible-wall and context tests</h1><p>Yellow wall · red window · orange door · green shop · purple balcony · blue roof · cyan sky.</p><p>Intersection retains pixels both models call wall/building. It is a candidate mask, not proof of visible masonry. Context test uses an exact crop from the same photograph, eliminating different capture dates/viewpoints.</p><p><a href="comparison.json">Evidence and measurements</a></p>'''+''.join(cards)+'</html>'
    (a.out/'index.html').write_text(page)
    print(json.dumps({'cases':len(rows),'medianSameCaptureClassAgreement':receipt['medianSameCaptureClassAgreement']}))

if __name__=='__main__':main()
