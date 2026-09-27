"""Make same-capture lower-facade crops to isolate context/scale sensitivity.
No cross-panorama registration. Plane heights select only an approximate band.
"""
import argparse,json,hashlib,copy
from pathlib import Path
from PIL import Image


def sha(p):
    with open(p,'rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cohort',type=Path,required=True)
    p.add_argument('--pilot',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    a=p.parse_args()
    if a.out.exists():raise SystemExit('Use a fresh output directory')
    cohort=json.loads(a.cohort.read_text()); pilot=json.loads((a.pilot/'receipt.json').read_text())
    if sha(a.cohort)!=pilot['manifestSha256']:raise ValueError('Cohort changed')
    a.out.mkdir(parents=True)
    entries=[]; transforms=[]
    for r in pilot['records']:
        if r['kind']!='full':continue
        entry=copy.deepcopy(next(e for e in cohort['entries'] if e['index']==r['index']))
        source=next(s for s in entry['images'] if s['kind']=='full')
        if sha(source['path'])!=r['sourceSha256']:raise ValueError('Source changed')
        image=Image.open(source['path']).convert('RGB'); w,h=image.size
        plane=source['plane']; top=min(plane['topZ'],entry['groundNAP']+4.6)
        y=max(0,min(h-1,round(h*(plane['topZ']-top)/(plane['topZ']-plane['baseZ']))))
        path=a.out/f'{r["index"]:03d}-same-capture-ground.png'
        image.crop((0,y,w,h)).save(path)
        # This crop is a view within full source, not the independent ground pano.
        source.update(kind='ground',path=str(path.resolve()),sha256=sha(path),width=w,height=h-y)
        source.pop('url',None);source['plane']={**plane,'topZ':plane['topZ']-y/h*(plane['topZ']-plane['baseZ'])}
        entry['images']=[source];entries.append(entry)
        transforms.append({'index':r['index'],'sourceSha256':r['sourceSha256'],'cropSha256':source['sha256'],'cropBoxPx':[0,y,w,h],'originalSize':[w,h]})
    result={'entries':entries,'parentManifestSha256':sha(a.cohort),'pilotReceiptSha256':sha(a.pilot/'receipt.json'),'transforms':transforms,'purpose':'Same-capture context ablation; not metric geometry acceptance'}
    (a.out/'manifest.json').write_text(json.dumps(result,indent=2)+'\n')
    print(len(entries),'same-capture crops')

if __name__=='__main__':main()
