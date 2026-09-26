"""Create source/overlay panels for human or multimodal-model criticism."""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--input',type=Path,required=True)
    ap.add_argument('--out',type=Path,required=True)
    ap.add_argument('--address',action='append',help='Exact source address; repeatable')
    args=ap.parse_args()
    if args.out.exists():ap.error('Use a new immutable output directory')
    manifest_path=args.input/'manifest.json';run=json.loads(manifest_path.read_text())
    args.out.mkdir(parents=True);font=ImageFont.load_default();records=[]
    palette={'observed':'#16a8e0','inferred':'#e0a51b','partial':'#9b65ef','review':'#ed625f'}
    for record in run['records']:
        if args.address and record['source']['address'] not in args.address:continue
        source=args.input/record['image']
        if sha(source)!=record['sourceSha256']:raise ValueError(f'Source changed: {record["id"]}')
        image=Image.open(source).convert('RGB');overlay=image.copy();draw=ImageDraw.Draw(overlay)
        for opening in record['openings']:
            partial=opening.get('visibility',{}).get('state')=='partial'
            colour=(palette['review'] if opening['state']!='proposed' else palette['partial'] if partial
                    else palette['inferred'] if opening.get('basis')=='inferred' or opening.get('reconstruction') else palette['observed'])
            box=opening['box'];draw.rectangle(box,outline=colour,width=max(2,round(image.width/250)))
            label=opening['id'];left,top=box[0],max(0,box[1]-14)
            draw.rectangle([left,top,left+max(28,6*len(label)),top+13],fill='#111111')
            draw.text((left+2,top+1),label,fill=colour,font=font)
        header=46;panel=Image.new('RGB',(image.width*2, image.height+header),'#f4f1e9')
        panel.paste(image,(0,header));panel.paste(overlay,(image.width,header));pd=ImageDraw.Draw(panel)
        pd.text((8,8),f'{record["source"]["address"]} · source',fill='#21302b',font=font)
        pd.text((image.width+8,8),'overlay: cyan observed · amber inferred · purple partial · red review',fill='#21302b',font=font)
        filename=record['id']+'.review.png';panel.save(args.out/filename,optimize=True)
        inventory=[{'id':opening['id'],
                    'status':'review' if opening['state']!='proposed' else 'partial' if opening.get('visibility',{}).get('state')=='partial' else 'inferred' if opening.get('basis')=='inferred' or opening.get('reconstruction') else 'observed',
                    'kind':opening['kind'],'box':opening['box']}
                   for opening in record['openings']]
        records.append({'pandId':record['source']['pandId'],'address':record['source']['address'],'sourceSha256':record['sourceSha256'],
                        'file':filename,'sha256':sha(args.out/filename),'width':panel.width,'height':panel.height,
                        'openingInventory':inventory,
                        'openingCounts':{'observed':sum(o['state']=='proposed' and o.get('basis')!='inferred' and not o.get('reconstruction') for o in record['openings']),
                                         'inferred':sum(o['state']=='proposed' and bool(o.get('basis')=='inferred' or o.get('reconstruction')) for o in record['openings']),
                                         'needsReview':sum(o['state']!='proposed' for o in record['openings'])}})
        print(record['source']['address'],records[-1]['openingCounts'])
    report={'schemaVersion':2,'generatedAt':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
            'sourceRun':str(args.input),'sourceManifestSha256':sha(manifest_path),'generatorSha256':sha(Path(__file__)),
            'records':records,'acceptance':'None. Review panels expose observed, inferred, partial and rejected candidates; they do not establish ground truth.'}
    (args.out/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    print(args.out)


if __name__=='__main__':main()
