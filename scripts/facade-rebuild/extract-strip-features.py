"""Offline, inspectable opening proposals from rectified strips. Never accepts registration.

Requires numpy, Pillow, scipy and onnxruntime. Supply an existing local model
directory containing weights.onnx, inference_config.json and class_names.txt.
No download, credentials, hosted inference, generated grids or model training.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import shutil
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image
from scipy import ndimage

VERSION = 'strip-features/1'
KNOWN_BAD = {'Prinsengracht-285__0363100012164996__2025-01-20.jpg'}
CONFIG = {'horizontalMargin': 1.06, 'belowGroundM': 0.8, 'aboveTopM': 0.5,
          'closingMetres': 0.12, 'minimumWidthM': 0.32, 'minimumHeightM': 0.45}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def components(mask, class_id, scale_x, scale_y):
    """Join nearby glazing fragments locally; never populate empty grid cells."""
    binary = mask == class_id
    kernel = (max(1, round(CONFIG['closingMetres'] / scale_y)),
              max(1, round(CONFIG['closingMetres'] / scale_x)))
    joined = ndimage.binary_closing(binary, structure=np.ones(kernel), border_value=0)
    labels, _ = ndimage.label(joined)
    boxes = []
    for label, region in enumerate(ndimage.find_objects(labels), 1):
        if region is None:
            continue
        ys, xs = np.nonzero(binary & (labels == label))
        if not len(xs):
            continue
        x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
        if ((x1 - x0) * scale_x < CONFIG['minimumWidthM']
                or (y1 - y0) * scale_y < CONFIG['minimumHeightM']):
            continue
        boxes.append({'box': [x0, y0, x1, y1], 'maskPixels': len(xs),
                      'maskFill': round(len(xs) / ((x1 - x0) * (y1 - y0)), 3)})
    return sorted(boxes, key=lambda b: (b['box'][1], b['box'][0]))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--strips', type=Path, required=True)
    ap.add_argument('--model-dir', type=Path, required=True)
    ap.add_argument('--files', nargs='+', required=True)
    ap.add_argument('--out', type=Path, required=True, help='New immutable run directory')
    args = ap.parse_args()
    if args.out.exists():
        ap.error('Output exists; choose a new run directory to preserve previous evidence')
    manifest_path = args.strips / 'manifest.json'
    source_manifest = json.loads(manifest_path.read_text())
    sources = {s['file']: s for s in source_manifest['strips']}
    config_path = args.model_dir / 'inference_config.json'
    preprocessing = json.loads(config_path.read_text())
    config = preprocessing['network_input']
    if (config['color_mode'] != 'rgb' or config['resize_mode'] != 'stretch'
            or preprocessing.get('image_pre_processing') is not None):
        raise ValueError('Unsupported preprocessing; do not silently run another model convention')
    names = (args.model_dir / 'class_names.txt').read_text().splitlines()
    if names != ['background', 'building', 'door', 'sky', 'window']:
        raise ValueError('Unexpected semantic classes')
    weights = args.model_dir / 'weights.onnx'
    if sha(weights) != 'c3c08d7bb4354ac828efe00fc94d0fff4c6f2b88f429899d027e287532f7def5':
        raise ValueError('Weights differ from the pinned development baseline; review model provenance before replacing it')
    session = ort.InferenceSession(str(weights), providers=['CPUExecutionProvider'])
    args.out.mkdir(parents=True)
    model = {'id': 'amsterdam-facade/2', 'weightsSha256': sha(weights),
             'preprocessingSha256': sha(config_path), 'preprocessing': preprocessing,
             'classes': names, 'runtime': f'onnxruntime/{ort.__version__}',
             'source': 'https://universe.roboflow.com/cmp-zosci/amsterdam-facade',
             'projectLicense': 'CC BY 4.0', 'execution': 'local CPU; no image upload',
             'confidence': 'uncalibrated; class masks and box fill are not correctness probabilities'}
    records = []
    for filename in args.files:
        if Path(filename).name != filename or filename not in sources:
            raise ValueError(f'Not a strip manifest entry: {filename}')
        src = args.strips / filename
        meta = sources[filename]
        pixels = np.array(Image.open(src).convert('RGB'))
        h, w = pixels.shape[:2]
        record = {'id': src.stem, 'source': meta, 'sourceSha256': sha(src),
                  'width': w, 'height': h, 'registration': 'unreviewed',
                  'status': 'proposed', 'openings': [], 'unknown': ['roof', 'gable', 'window style', 'occlusion completeness']}
        records.append(record)
        if (filename in KNOWN_BAD or filename.startswith('Spuistraat-234__') and '__2025-06-16' in filename
                or float(pixels.std()) < 8):
            record.update(status='rejected', reason='Known missing-height source or nearly uniform strip')
            print(filename, 'REJECTED', flush=True)
            continue
        shutil.copyfile(src, args.out / filename)
        record['image'] = filename
        width_m = float(meta['wallWidthM'])
        margin = float(meta.get('horizontalMargin', 1.0 if 'cropBaseNapM' in meta else 1.06))
        crop_base = float(meta.get('cropBaseNapM', float(meta['groundZ']) - .8))
        crop_top = float(meta.get('cropTopNapM', float(meta['topZ']) + .5))
        height_m = crop_top - crop_base
        sx, sy = width_m * margin / w, height_m / h
        record['frame'] = {'metresPerPixelX': sx, 'metresPerPixelY': sy,
                           'leftM': -(margin - 1) * width_m / 2, 'topM': crop_top - float(meta['groundZ']),
                           'wallWidthM': width_m,
                           'note': f'Reconstructed from declared strip bounds and horizontal margin {margin:.3f}. Rounded manifest dimensions; provisional scale, not surveyed accuracy.'}
        size = config['training_input_size']
        rgb = np.array(Image.fromarray(pixels).resize((size['width'], size['height']), Image.Resampling.BILINEAR), dtype=np.float32)
        mean, std = config['normalization']
        tensor = ((rgb / config['scaling_factor'] - np.array(mean, dtype=np.float32))
                  / np.array(std, dtype=np.float32)).transpose(2, 0, 1)[None]
        logits = session.run(None, {session.get_inputs()[0].name: tensor})[0][0]
        # Argmax at network resolution, nearest-neighbour class labels back to source.
        mask = np.array(Image.fromarray(logits.argmax(axis=0).astype('uint8')).resize((w, h), Image.Resampling.NEAREST))
        mask_name = src.stem + '.mask.png'
        Image.fromarray(mask).save(args.out / mask_name)
        record['mask'] = mask_name
        record['maskSha256'] = sha(args.out / mask_name)
        record['classShare'] = {name: round(float((mask == i).mean()), 4) for i, name in enumerate(names)}
        if record['classShare']['sky'] > 0.7:
            record.update(status='needs-review', reason='Model reports mostly sky; no render proposal', wallColour=None)
            continue
        for kind in ['window', 'door']:
            for box in components(mask, names.index(kind), sx, sy):
                x0, y0, x1, y1 = box['box']
                left, right = record['frame']['leftM'] + x0 * sx, record['frame']['leftM'] + x1 * sx
                bottom = record['frame']['topM'] - y1 * sy
                reasons = []
                if left < 0 or right > width_m:
                    reasons.append('outside declared wall')
                if bottom < 0:
                    reasons.append('below declared ground')
                if y0 <= 3 or y1 >= h - 3:
                    reasons.append('touches image edge')
                record['openings'].append({**box, 'id': f'{kind}-{len(record["openings"]) + 1}', 'kind': kind,
                                            'state': 'needs-review' if reasons else 'proposed', 'reasons': reasons,
                                            'basis': 'observed', 'confidence': None})
        wall = ndimage.binary_erosion(mask == names.index('building'), iterations=3)
        # Exclude the image margins and darkest/lightest wall-class samples; no claim
        # to remove all shadows, or to estimate intrinsic reflectance from camera RGB.
        wall[:, :round(w * 0.03)] = False
        wall[:, round(w * 0.97):] = False
        samples = pixels[wall]
        if len(samples) > 30:
            luminance = samples.mean(axis=1)
            lo, hi = np.quantile(luminance, [0.2, 0.8])
            samples = samples[(luminance >= lo) & (luminance <= hi)]
            colour = np.median(samples, axis=0).astype(int)
            record['wallColour'] = {'rgb': colour.tolist(), 'hex': '#' + ''.join(f'{c:02x}' for c in colour),
                                    'samplePixels': len(samples), 'basis': 'observed', 'state': 'proposed',
                                    'note': 'Median camera RGB in eroded building mask, middle 60% brightness. Shadow and occluder contamination remain possible; not intrinsic surface colour.'}
        else:
            record['wallColour'] = None
        print(filename, len(record['openings']), 'opening proposals', flush=True)
    run = {'schemaVersion': 1, 'extractor': VERSION, 'scriptSha256': sha(Path(__file__)),
           'sourceManifestSha256': sha(manifest_path), 'sourceMetadata': source_manifest['metadata'],
           'model': model, 'config': CONFIG, 'records': records,
           'rights': 'Source imagery © Gemeente Amsterdam. Local development cache; no redistribution or training performed.',
           'acceptance': 'None. Features are proposals from unreviewed registration. No benchmark accuracy claimed.'}
    (args.out / 'manifest.json').write_text(json.dumps(run, indent=2) + '\n')


if __name__ == '__main__':
    main()
