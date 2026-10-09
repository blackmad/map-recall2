"""Write an isolated evidence/render review and compact provenance audit."""
import hashlib
import html
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
BASE=ROOT/'artifacts/building-library/expansion'

def read(path):return json.loads(path.read_text())
def esc(value):return html.escape(str(value))

def source_plan(recipe):
    """Draw measured plan scope without converting it to a bounding rectangle."""
    ring=recipe['footprint'];surfaces=recipe['sourceShell']['surfaces']
    points=ring+[[p[0],p[1]] for s in surfaces for r in s['rings'] for p in r]
    xmin,xmax=min(p[0] for p in points),max(p[0] for p in points)
    ymin,ymax=min(p[1] for p in points),max(p[1] for p in points)
    scale=min(620/(xmax-xmin),840/(ymax-ymin));ox=55-xmin*scale;oy=55-ymin*scale
    to_svg=lambda p:f'{ox+p[0]*scale:.2f},{oy+p[1]*scale:.2f}'
    source_roofs=[s for s in surfaces if s['type']=='roof']
    heights=[p[2] for s in source_roofs for r in s['rings'] for p in r]
    low,high=(min(heights),max(heights)) if heights else (0,0)
    polygons=[]
    for number,s in enumerate(source_roofs):
        z=sum(p[2] for p in s['rings'][0])/len(s['rings'][0]);f=(z-low)/(high-low) if high>low else .5
        colour=f'hsl({220-190*f:.0f},65%,65%)'
        paths=['M '+' L '.join(to_svg(p) for p in r)+' Z' for r in s['rings']]
        polygons.append(f'<path d="{" ".join(paths)}" fill="{colour}" fill-opacity=".6" fill-rule="evenodd" stroke="#49515a" stroke-width=".7"><title>Semantic source roof {number}: mean vertex height {z:.2f} m, source surface only.</title></path>')
    width=ox+xmax*scale+55;height=oy+ymax*scale+105;front_width=recipe['frontages'][0]['width']
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.2f} {height:.2f}">
<rect width="100%" height="100%" fill="#f6f6f3"/>
<text x="20" y="25" font-family="sans-serif" font-size="15">Exact owner footprint and semantic source roof planes</text>
<polygon points="{' '.join(to_svg(p) for p in ring)}" fill="#dde3e8" stroke="#101820" stroke-width="2"/>
{''.join(polygons)}<polygon points="{' '.join(to_svg(p) for p in ring)}" fill="none" stroke="#101820" stroke-width="2"/>
<line x1="{ox}" y1="{oy}" x2="{ox+front_width*scale}" y2="{oy}" stroke="#d92020" stroke-width="5"/>
<text x="20" y="{height-50}" font-family="sans-serif" font-size="13">Red: selected street frontage. Interior points downward; scale {scale:.1f} px/m.</text>
<text x="20" y="{height-30}" font-family="sans-serif" font-size="13">Source roof vertices: {low:.2f}–{high:.2f} m above owner ground. Blue low → orange high.</text>
<text x="20" y="{height-10}" font-family="sans-serif" font-size="13">Semantic roof surfaces are owner-wide; no hidden-side photographic acceptance.</text></svg>'''
    (BASE/f"{recipe['id']}-source-plan.svg").write_text(svg+'\n')

def main():
    entries=read(ROOT/'scripts/blender/expansion/source-manifest.json')['entries']
    notes=read(ROOT/'scripts/blender/expansion/authoring-notes.json')['entries']
    manifest_path=BASE/'models/manifest.json'
    models={m['id']:m for m in read(manifest_path)['models']} if manifest_path.is_file() else {}
    audit=[];sections=[]
    for e in entries:
        id=e['id'];spec=notes[id]
        path=ROOT/f'scripts/blender/expansion/recipes/{id}.json';recipe=read(path)
        source_plan(recipe)
        bundle=read(BASE/f'evidence/{id}.json');model=models.get(id)
        derived_integrity=[]
        for evidence in bundle['derived']:
            image_path=ROOT/evidence['path']
            derived_integrity.append({'path':evidence['path'],'exists':image_path.is_file(),
                                      'hashMatches':image_path.is_file() and hashlib.sha256(image_path.read_bytes()).hexdigest()==evidence['id']})
        source_roofs=[p[2] for s in recipe['sourceShell']['surfaces'] if s['type']=='roof' for ring in s['rings'] for p in ring]
        metric=recipe['heightChoice'];wall_candidates=recipe['heightEvidence'][0]['frontWallTopCandidates']
        crop_bindings=[]
        for tier,source in e['source'].items():
            matches=[o for o in e['owner']['observations'] if o['payload'].get('images',{}).get(tier,{}).get('sha256')==source['sha256']]
            crop_bindings.append({'tier':tier,'sourceHash':source['sha256'],'observationIds':[o['id'] for o in matches],
                                  'featureHashMatches':e['shapeFeatures'][tier].get('cropSha256')==source['sha256'],
                                  'status':'exact-crop-identity; metric-frontage-registration-unresolved'})
        row={'id':id,'status':spec['readiness'],'recipeFileSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
             'ownerId':recipe['buildingId'],'geometryRevision':recipe['geometryRevision'],
             'footprintAreaM2':abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(recipe['footprint'],recipe['footprint'][1:]+recipe['footprint'][:1])))/2,
             'frontageWidthM':recipe['frontages'][0]['width'],'frontWallBinding':bool(wall_candidates),
             'heightEvidence':{'frontWallTopM':metric['eavesM'],'draftRoofPeakM':metric['roofPeakM'],'draftRoofStatus':'inferred',
                               'reportedRoofStatisticM':metric['reportedRoofStatisticM'],
                               'allOwnerRoofSurfaceRangeM':[min(source_roofs),max(source_roofs)] if source_roofs else None,
                               'allOwnerRoofRangeIsPrimaryFrontMeasurement':False},
             'cropBindings':crop_bindings,'captures':len({d['captureKey'] for d in bundle['derived']}),
             'derivedEvidenceIntegrity':{'crops':len(derived_integrity),'allPresent':all(i['exists'] for i in derived_integrity),
                                         'allHashesMatch':all(i['hashMatches'] for i in derived_integrity),
                                         'failures':[i for i in derived_integrity if not i['exists'] or not i['hashMatches']]},
             'years':bundle['searchedYears'],'registeredFeatures':0,'rendered':bool(model),
             'buildRecipeHashMatches':model.get('recipeFileSha256')==hashlib.sha256(path.read_bytes()).hexdigest() if model else None}
        audit.append(row)
        stats=f"{row['frontageWidthM']:.2f} m frontage · {row['footprintAreaM2']:.1f} m² footprint · {row['captures']} captures · {', '.join(row['years'])}"
        if model:stats+=f" · {model['triangles']:,} triangles · {model['drawCalls']} draw calls"
        images=[]
        for view in ('front','ground','oblique','roof'):
            image=BASE/f'scenes/{id}-{view}.png'
            if image.is_file():images.append(f'<figure><img loading="lazy" src="scenes/{id}-{view}.png"><figcaption>{view}</figcaption></figure>')
        renders='<div class="renders">'+''.join(images)+'</div>' if images else '<p class="pending">Blender views pending.</p>'
        observed=''.join(f'<li>{esc(v)}</li>' for v in spec['observed'])
        limitations=''.join(f'<li>{esc(v)}</li>' for v in spec['limitations'])
        download=f'<a href="models/{id}.glb">GLB</a> · <a href="scenes/{id}.blend">editable scene</a> · ' if model else ''
        stale='<p class="pending">The export recipe hash differs from the current recipe; rebuild before acceptance.</p>' if model and not row['buildRecipeHashMatches'] else ''
        sections.append(f'''<section id="{id}"><h2>{esc(e['address'])}</h2><p>{esc(spec['readiness'])}</p>
<p>{stats}</p><p>Selected wall top {metric['eavesM']:.2f} m; illustrative roof peak {metric['roofPeakM']:.2f} m;
reported owner roof statistic {metric['reportedRoofStatisticM']:.2f} m. These values represent different measurements.</p>
<p>{download}<a href="evidence/{id}.json">dated source bundle</a> · <a href="{id}-source-plan.svg">source roof/footprint plan</a></p>{stale}
<h3>Observed composition</h3><ul>{observed}</ul>
<img class="evidence" loading="lazy" src="{id}-dated-full.jpg" alt="Dated evidence for {esc(e['address'])}">
{renders}<img class="plan" loading="lazy" src="{id}-source-plan.svg" alt="Source roof and footprint plan"><h3>Review limitations</h3><ul>{limitations}</ul></section>''')
    (BASE/'review-audit.json').write_text(json.dumps({'reviewDate':'2026-10-01','registeredFeatures':0,'buildings':audit},indent=2)+'\n')
    document='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ordinary building sample review</title><style>
body{font:16px/1.5 system-ui,sans-serif;background:#f5f4f0;color:#222;margin:0 auto;max-width:1500px;padding:24px}
h1,h2,h3{line-height:1.2}section{margin:36px 0;padding:24px;background:white;border:1px solid #ddd}a{color:#18538a}
.evidence{width:100%;max-height:1100px;object-fit:contain}.renders{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
figure{margin:0}figure img{width:100%}.pending{background:#fff2c9;padding:10px}li{margin:5px 0}
.plan{width:100%;max-height:750px;object-fit:contain;margin:20px 0}
@media(max-width:800px){.renders{grid-template-columns:repeat(2,minmax(0,1fr))}body{padding:10px}section{padding:14px}}
</style><h1>Ordinary building sample review</h1>
<p>Six staged source-bound proposals, including one held diagnostic. Photos and numerical validation do not establish metric reconstruction acceptance.
Compare source composition, facade/ground-floor joins, roof silhouette and source footprint before promotion.</p>
<p><a href="review-audit.json">Compact identity and height audit</a></p>'''+''.join(sections)
    (BASE/'review.html').write_text(document+'\n')
    print(json.dumps({'review':'artifacts/building-library/expansion/review.html','recipes':len(audit),'exported':len(models),'registered':0}))

if __name__=='__main__':main()
