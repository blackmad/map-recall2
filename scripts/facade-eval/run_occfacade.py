"""Bounded OccFacade ENPC pilot; raw masks/evidence only, never game acceptance.

Uses the upstream architecture and ENPC2014 preprocessing (RGB /255, 512px
letterbox, softmax, remove padding, bilinear probability resize, argmax).
Requires torch, numpy, Pillow; no CUDA, dataset labels or VOC bootstrap required.
Full checkpoint loading is strict and weights_only=True. See OCCFACADE_PILOT.md.
"""
import argparse
import hashlib
import html
import json
from pathlib import Path
import statistics
import subprocess
import sys
import time

import numpy as np
from PIL import Image
import torch
import torch.nn.functional as F

CLASSES = ['background', 'door', 'shop', 'balcony', 'window', 'wall', 'sky', 'roof']
PALETTE = np.array([[0,0,0],[255,128,0],[0,255,0],[128,0,255],
                    [255,0,0],[255,255,0],[128,255,255],[0,0,255]], dtype=np.uint8)


def sha(path):
    with open(path, 'rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def synchronize(device):
    if device == 'mps':
        torch.mps.synchronize()
    elif device == 'cuda':
        torch.cuda.synchronize()


def infer(model, image, device):
    width, height = image.size
    scale = min(512 / width, 512 / height)
    nw, nh = max(1, int(width * scale)), max(1, int(height * scale))
    left, top = (512 - nw) // 2, (512 - nh) // 2
    padded = Image.new('RGB', (512, 512), (128, 128, 128))
    padded.paste(image.resize((nw, nh), Image.Resampling.BICUBIC), (left, top))
    tensor = torch.from_numpy(np.array(padded, dtype=np.float32).transpose(2, 0, 1) / 255).unsqueeze(0).to(device)
    synchronize(device)
    started = time.perf_counter()
    with torch.inference_mode():
        prob = model(tensor).softmax(dim=1)
        synchronize(device)
        forward_seconds = time.perf_counter() - started
        # CPU bilinear matches upstream OpenCV INTER_LINEAR half-pixel mapping.
        prob = prob[:, :, top:top + nh, left:left + nw].cpu()
        prob = F.interpolate(prob, size=(height, width), mode='bilinear', align_corners=False)[0]
        confidence, mask = prob.max(dim=0)
    return mask.numpy().astype(np.uint8), confidence.numpy(), forward_seconds


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, required=True)
    parser.add_argument('--checkpoint', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--indices', default='0,1,3,10,11,13,17,30,52,64')
    parser.add_argument('--kinds', choices=['full', 'ground', 'both'], default='both')
    parser.add_argument('--device', choices=['mps', 'cpu', 'cuda'], default='mps')
    args = parser.parse_args()
    if args.out.exists():
        raise SystemExit('Use a fresh output directory; existing evidence is never overwritten.')
    torch.set_num_threads(4)
    indices = [int(x) for x in args.indices.split(',')]
    manifest = json.loads(args.manifest.read_text())
    entries = {x['index']: x for x in manifest['entries']}
    sources = []
    for index in indices:
        for source in entries[index]['images']:
            if source['kind'] in ('full', 'ground') and (args.kinds == 'both' or source['kind'] == args.kinds):
                if sha(source['path']) != source['sha256']:
                    raise ValueError(f'Source hash mismatch: {index}/{source["kind"]}')
                sources.append((entries[index], source))
    sys.path.insert(0, str(args.repo.resolve()))
    from nets.OccFacade import OcclusionNet
    checkpoint = torch.load(args.checkpoint, map_location='cpu', weights_only=True)
    state = checkpoint['model']
    model = OcclusionNet(num_classes=8, pretrained=False, backbone='vgg', MD_Module=True, MRC_Module=True)
    # Upstream forward documents window_conv as the alternative when MRC=False.
    # ENPC enables MRC and its checkpoint retains this unused legacy module.
    # Drop ONLY that known inactive prefix; all active keys/shapes load strictly.
    ignored = [k for k in state if k.startswith('window_conv.')]
    state = {k: v for k, v in state.items() if k not in ignored}
    model.load_state_dict(state, strict=True)
    model.eval().to(args.device)
    args.out.mkdir(parents=True)
    receipt = {
        'model': 'OccFacade ENPC2014', 'classes': CLASSES, 'palette': PALETTE.tolist(),
        'checkpointSha256': sha(args.checkpoint), 'checkpointBytes': args.checkpoint.stat().st_size,
        'upstreamCommit': subprocess.check_output(['git', '-C', str(args.repo), 'rev-parse', 'HEAD'], text=True).strip(),
        'upstreamTrackedDiffSha256': hashlib.sha256(subprocess.check_output(['git', '-C', str(args.repo), 'diff', 'HEAD'])).hexdigest(),
        'runnerSha256': sha(__file__), 'manifestSha256': sha(args.manifest),
        'device': args.device, 'torch': torch.__version__, 'strictCheckpointLoad': True,
        'parameters': sum(p.numel() for p in model.parameters()),
        'checkpointEpoch': checkpoint['epoch'],
        'ignoredInactiveLegacyKeys': ignored,
        'policy': 'Unaccepted semantic predictions. Occluded wall labels are not observed wall pixels. No pixel ground truth; no accuracy claim.',
        'records': [],
    }
    # Separate warmup from measured inference, explicitly record it.
    entry, source = sources[0]
    _, _, receipt['warmupForwardSeconds'] = infer(model, Image.open(source['path']).convert('RGB'), args.device)
    cards = []
    for entry, source in sources:
        image = Image.open(source['path']).convert('RGB')
        mask, confidence, seconds = infer(model, image, args.device)
        name = f'{entry["index"]:03d}-{source["kind"]}'
        image.save(args.out / f'{name}-source.jpg', quality=95)
        Image.fromarray(mask).save(args.out / f'{name}-labels.png')
        colour = Image.fromarray(PALETTE[mask])
        colour.save(args.out / f'{name}-mask.png')
        Image.blend(image, colour, .42).save(args.out / f'{name}-overlay.jpg', quality=95)
        wall = (mask == 5)
        pixels = np.asarray(image)
        wall_only = np.full_like(pixels, 224)
        wall_only[wall] = pixels[wall]
        Image.fromarray(wall_only).save(args.out / f'{name}-wall.jpg', quality=95)
        record = {
            'index': entry['index'], 'address': entry['address'], 'buildingId': entry['buildingId'],
            'observationId': entry['observationId'], 'geometryRevision': entry['geometryRevision'],
            'kind': source['kind'], 'sourceSha256': source['sha256'], 'sourcePath': source['path'],
            'forwardSeconds': seconds, 'size': list(image.size),
            'classFractions': {c: float((mask == i).mean()) for i, c in enumerate(CLASSES)},
            'meanTopClassProbability': float(confidence.mean()),
            'predictedWallPhotoMedianRGB': np.median(pixels[wall], axis=0).tolist() if wall.any() else None,
            'labelsSha256': sha(args.out / f'{name}-labels.png'),
        }
        receipt['records'].append(record)
        print(json.dumps({'index': entry['index'], 'kind': source['kind'], 'seconds': round(seconds, 3), 'fractions': record['classFractions']}), flush=True)
        (args.out / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
        figures = ''.join(f'<figure><img src="{name}-{suffix}" loading="lazy"><figcaption>{title}</figcaption></figure>' for suffix, title in [('source.jpg','Source'),('mask.png','Prediction'),('overlay.jpg','Overlay'),('wall.jpg','Predicted wall pixels — may include occluders')])
        cards.append(f'<article id="{name}"><h2>{entry["index"]}: {html.escape(entry["address"])} · {source["kind"]}</h2><div class="grid">{figures}</div></article>')
    receipt['medianForwardSeconds'] = statistics.median(r['forwardSeconds'] for r in receipt['records'])
    (args.out / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    legend = ''.join(f'<span><i style="background:rgb{tuple(map(int, PALETTE[i]))}"></i>{c}</span>' for i,c in enumerate(CLASSES))
    page = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>OccFacade local pilot</title><style>body{font:16px system-ui;background:#f7f5ef;color:#252922;margin:24px}article{margin:28px 0;padding:16px;background:white;border:1px solid #ddd}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}figure{margin:0}img{width:100%;height:480px;object-fit:contain;background:#eee}figcaption{font-size:13px}.legend{display:flex;gap:16px;flex-wrap:wrap}i{display:inline-block;width:15px;height:15px;margin-right:5px}@media(max-width:750px){body{margin:10px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}img{height:300px}}</style><h1>OccFacade · local Apple GPU pilot</h1><p>Unaccepted predictions on our existing facade crops. Yellow wall labels can include hidden walls behind trees/cars: do not sample these pixels as brick colour without an independent occlusion mask. No ground-truth accuracy score.</p><p><a href="receipt.json">Source, model and timing receipt</a></p><div class="legend">' + legend + '</div>' + ''.join(cards) + '</html>'
    (args.out / 'index.html').write_text(page)
    print(f'Complete: {len(sources)} crops; median forward {receipt["medianForwardSeconds"]:.3f}s', flush=True)


if __name__ == '__main__':
    main()
