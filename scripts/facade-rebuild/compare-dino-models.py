"""Render cached Tiny/Base proposals against the same development labels."""
import argparse
import hashlib
import html
import json
import shutil
import statistics
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec

spec=spec_from_file_location('evaluation',Path(__file__).with_name('evaluate-opening-fit.py'))
evaluation=module_from_spec(spec);spec.loader.exec_module(evaluation)


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def svg(record, proposals):
    parts=[f'<svg viewBox="0 0 {record["width"]} {record["height"]}"><image href="{html.escape(record["image"])}" width="{record["width"]}" height="{record["height"]}"/>']
    for p in proposals:
        x0,y0,x1,y1=p['box'];score=p.get('score');colour='#f4c35a' if score is not None and score<.25 else '#35b5ef'
        parts.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="none" stroke="{colour}" stroke-width="1.3"/>')
        if score is not None:parts.append(f'<text x="{x0}" y="{y0+9}" font-size="8" fill="white" stroke="black" stroke-width=".2">{score:.3f}</text>')
    return ''.join(parts)+'</svg>'


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--tiny',type=Path,required=True);ap.add_argument('--base',type=Path,required=True)
    ap.add_argument('--labels',type=Path,default=Path('src/canalRecall/facade/fixtures/opening-fit-expansion.json'))
    ap.add_argument('--out',type=Path,required=True);args=ap.parse_args()
    if args.out.exists():ap.error('Use a new output directory')
    reports={name:json.loads((root/'report.json').read_text()) for name,root in [('tiny',args.tiny),('base',args.base)]}
    if not all(r.get('complete') for r in reports.values()):raise ValueError('Incomplete benchmark')
    if reports['tiny']['sourceManifestSha256']!=reports['base']['sourceManifestSha256']:raise ValueError('Different source manifest')
    for key in ['boxThreshold','textThreshold','prompt']:
        if reports['tiny'][key]!=reports['base'][key]:raise ValueError(f'Comparison differs in {key}')
    labels=json.loads(args.labels.read_text());args.out.mkdir(parents=True)
    data={'labelsSha256':sha(args.labels),'runs':{},'cases':[]};sections=[]
    for name,root in [('tiny',args.tiny),('base',args.base)]:
        r=reports[name];times=[t for case in r['records'] for t in case['dino']['timesSeconds'][1:]]
        data['runs'][name]={'reportSha256':sha(root/'report.json'),'warmMedianSeconds':statistics.median(times),
                            'dinoDriverMemoryMiB':max(s['mpsDriverMiB'] for s in r['memorySamples'] if s['stage']=='dino'),
                            'model':next(m['repo'] for m in r['models'] if 'grounding-dino' in m['repo'])}
    for case in labels['cases']:
        records={name:next(r for r in report['records'] if r['sourceSha256']==case['sourceSha256']) for name,report in reports.items()}
        source=records['tiny'];path=args.tiny/source['image']
        if Path(source['image']).name!=source['image'] or sha(path)!=case['sourceSha256']:raise ValueError('Changed source')
        shutil.copyfile(path,args.out/source['image'])
        panels=['<section><h3>Annotated visible frames</h3>'+svg(source,[{'box':b} for b in case['boxes']])+'</section>'];metrics={}
        for name,record in records.items():
            proposals=record['dino']['proposals'];metric=evaluation.score([p['box'] for p in proposals],case['boxes']);metrics[name]=metric
            panels.append(f'<section><h3>DINO {name.title()}</h3>{svg(record,proposals)}<p>{metric["matchedAtIoU05"]}/{metric["labelledFrames"]} annotated frames matched; mean box IoU {metric["meanIoU"]}.</p><p>{len(proposals)} total candidates; unlabelled candidates are not scored as false positives.</p></section>')
        data['cases'].append({'address':case['address'],'scores':metrics})
        sections.append(f'<h2>{html.escape(case["address"])}</h2><div class="row">'+''.join(panels)+'</div>')
    (args.out/'report.json').write_text(json.dumps(data,indent=2)+'\n')
    text='<h1>Does a larger DINO help?</h1><p>Same images, prompt and 0.20 candidate threshold. Amber boxes have scores below the 0.25 primary threshold; they remain secondary-check or review candidates.</p><p>The dormer miss drove this comparison, so this is development evidence. A recovered proposal does not accept its registration, shape or material.</p>'
    (args.out/'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DINO Tiny / Base</title><style>body{font:14px system-ui;margin:24px;background:#f5f2eb;color:#293731}.row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}section{background:white;padding:12px;border:1px solid #d3d6cf;min-width:0}svg{width:100%;height:570px}p{font-size:13px}pre{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:700px){.row{grid-template-columns:1fr}}</style>'+text+''.join(sections)+'<h2>Recorded runtime</h2><p>Shared laptop timings vary; these are observed runs, not controlled latency guarantees. MPS driver samples include caches.</p><pre>'+html.escape(json.dumps(data['runs'],indent=2))+'</pre></html>')


if __name__=='__main__':main()
