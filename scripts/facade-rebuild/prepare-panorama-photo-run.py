"""Build a photo-compiler input from registration-reviewed panorama strips.

The wall envelope is geometric sampling support, not semantic agreement. Window
and door evidence remains empty until an independent detector report is compiled.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--strips', type=Path, required=True)
    ap.add_argument('--review', type=Path, required=True)
    ap.add_argument('--benchmark', type=Path, required=True)
    ap.add_argument('--out', type=Path, required=True)
    args = ap.parse_args()
    if args.out.exists():
        ap.error('Use a new immutable output directory')

    manifest_path = args.strips / 'manifest.json'
    source = json.loads(manifest_path.read_text())
    review = json.loads(args.review.read_text())
    benchmark_path = args.benchmark / 'report.json'
    benchmark = json.loads(benchmark_path.read_text())
    source_hash = sha(manifest_path)
    if review['sourceManifestSha256'] != source_hash:
        raise ValueError('Review fixture does not pin the source manifest')
    if benchmark.get('sourceManifestSha256') != source_hash or not benchmark.get('complete'):
        raise ValueError('Benchmark is incomplete or belongs to another source manifest')
    if benchmark.get('sourceReview', {}).get('sha256') != sha(args.review):
        raise ValueError('Benchmark does not pin this registration review')

    review_by_hash = {item['sourceSha256']: item for item in review['cases']}
    benchmark_by_hash = {item['sourceSha256']: item for item in benchmark['records']}
    if len(review_by_hash) != len(review['cases']) or len(benchmark_by_hash) != len(benchmark['records']):
        raise ValueError('Duplicate source hash')

    args.out.mkdir(parents=True)
    records = []
    for strip in source['strips']:
        decision = review_by_hash.get(strip['sourceSha256'])
        if decision is None:
            raise ValueError(f'Missing review for {strip["pandId"]}')
        if decision['disposition'] == 'diagnostic-only':
            continue
        if decision['disposition'] not in {'usable-development', 'usable-hard-negative'}:
            raise ValueError(f'Unsupported review disposition: {decision["disposition"]}')
        if strip['sourceSha256'] not in benchmark_by_hash:
            raise ValueError(f'Usable source is absent from benchmark: {strip["pandId"]}')
        src = args.strips / strip['file']
        if Path(strip['file']).name != strip['file'] or sha(src) != strip['sourceSha256']:
            raise ValueError(f'Stale or invalid strip: {strip["file"]}')
        image = Image.open(src).convert('RGB')
        width, height = image.size
        shutil.copyfile(src, args.out / strip['file'])

        crop_top = float(strip['cropTopNapM'])
        crop_base = float(strip['cropBaseNapM'])
        ground = float(strip['groundZ'])
        ridge = float(strip['topZ'])
        span = crop_top - crop_base
        if not crop_base < ground < ridge < crop_top:
            raise ValueError(f'Invalid vertical bounds: {strip["pandId"]}')
        top_px = max(0, min(height, round((crop_top-ridge)/span*height)))
        ground_px = max(0, min(height, round((crop_top-ground)/span*height)))
        mask = np.zeros((height, width), dtype=np.uint8)
        mask[top_px:ground_px] = 1
        mask_name = Path(strip['file']).stem + '.wall-envelope.png'
        Image.fromarray(mask).save(args.out / mask_name)

        wall_width = float(strip['wallWidthM'])
        margin = float(strip.get('horizontalMargin', 1))
        record = {
            'id': Path(strip['file']).stem,
            'source': strip,
            'sourceSha256': strip['sourceSha256'],
            'width': width,
            'height': height,
            'image': strip['file'],
            'mask': mask_name,
            'maskSha256': sha(args.out / mask_name),
            'registration': 'reviewed-development',
            'sourceReview': decision,
            'semanticBaseline': {
                'state': 'unknown',
                'method': 'registered-wall-envelope',
                'wallEnvelopeRows': [top_px, ground_px],
                'note': 'Class 1 marks the metric target-wall envelope for bounded appearance sampling. It includes occluders and possible sky around roof profiles, and supplies no independent window/door agreement.'
            },
            'frame': {
                'metresPerPixelX': wall_width*margin/width,
                'metresPerPixelY': span/height,
                'leftM': -(margin-1)*wall_width/2,
                'topM': crop_top-ground,
                'wallWidthM': wall_width,
                'note': 'Exact declared panorama-strip bounds. Registration review is development evidence; pixel geometry is not surveyed accuracy.'
            },
            'status': 'proposed',
            'openings': [],
            'unknown': ['semantic wall pixels', 'occlusion completeness', 'roof profile', 'gable profile', 'window style']
        }
        records.append(record)

    run = {
        'schemaVersion': 1,
        'preparer': 'panorama-photo-input/1',
        'scriptSha256': sha(Path(__file__)),
        'benchmarkSourceManifestSha256': source_hash,
        'sourceManifestSha256': source_hash,
        'reviewSha256': sha(args.review),
        'benchmarkSha256': sha(benchmark_path),
        'sourceMetadata': source['metadata'],
        'model': {
            'id': 'registered-wall-envelope/1',
            'classes': ['background', 'wall-envelope', 'door', 'sky', 'window'],
            'execution': 'local geometry only',
            'confidence': 'No semantic model. The wall envelope is a bounded sampling candidate and never counts as detector agreement.'
        },
        'records': records,
        'rights': 'Source imagery © Gemeente Amsterdam, CC BY 4.0. Local development cache.',
        'acceptance': 'Registration-reviewed development sources. Opening, occlusion, appearance and building-identity correctness remain unaccepted.'
    }
    (args.out / 'manifest.json').write_text(json.dumps(run, indent=2) + '\n')
    print(f'{args.out}: {len(records)} usable records; {len(source["strips"])-len(records)} diagnostics excluded')


if __name__ == '__main__':
    main()
